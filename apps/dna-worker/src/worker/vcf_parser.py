from cyvcf2 import VCF
from collections import defaultdict
from src.config import BATCH_SIZE
from src.db.connection import get_connection
from src.db.queries import (
    insert_variants_batch, update_vcf_file, upsert_chromosome_summary,
    upsert_trait_panel_result, upsert_pharmaco_result, upsert_acmg_result,
    upsert_carrier_result, upsert_prs_result,
)
from src.worker.trait_panel import (
    TRAIT_PANEL, PANEL_BY_CHROM, record_covers, classify_covering, STATE_RANK,
    resolve_interpretation,
    APOE_BY_CHROM, apoe_diplotype, APOE_INTERPRETATION, APOE_NOT_COVERED,
)
from src.worker.pharmacogenes import PHARMACO_BY_CHROM, call_all
from src.worker.acmg_panel import (
    ACMG_PANEL, ACMG_BY_CHROM, classify_acmg, STATE_RANK as ACMG_STATE_RANK,
)
from src.worker.carrier_panel import (
    CARRIER_PANEL, CARRIER_BY_CHROM, classify_carrier, STATE_RANK as CARRIER_STATE_RANK,
)
from src.worker.pgs_panel import get_pgs_index, call_all_pgs, loaded_scores as loaded_pgs_scores
import bisect
from src.worker.call_confidence import assess_confidence
import uuid


def read_depths(record) -> tuple[list[int] | None, int | None]:
    """Extract per-allele depths (AD) and total depth (DP) for sample 0.

    cyvcf2 returns FORMAT fields as numpy arrays (or None if absent); missing
    values are negative. Returns (ad_list, dp) where ad_list[0] is ref depth and
    ad_list[i] the i-th alt depth, or (None, dp) when AD is unavailable.
    """
    ad_list = None
    try:
        ad = record.format("AD")
        if ad is not None:
            ad_list = [int(x) if x is not None and x >= 0 else None for x in ad[0]]
    except KeyError:
        ad_list = None
    dp = None
    try:
        dp_arr = record.format("DP")
        if dp_arr is not None and dp_arr[0][0] >= 0:
            dp = int(dp_arr[0][0])
    except KeyError:
        dp = None
    return ad_list, dp


def zygosity_for_allele(gt_alleles, allele_index: int) -> str | None:
    """Zygosity of a specific alt allele within the sample genotype.

    Computed per-allele (not from the whole GT string) so multiallelic sites are
    classified correctly: a 1/2 compound het is HETEROZYGOUS for each of its alt
    alleles. Returns None when there is no diploid call to judge (haploid chrY/MT,
    or a missing allele) — there is no HEMIZYGOUS value in the Zygosity enum.
    """
    present = [a for a in gt_alleles if a is not None and a >= 0]
    if len(present) < 2:
        return None
    count = present.count(allele_index)
    if count >= 2:
        return "HOMOZYGOUS"
    if count == 1:
        return "HETEROZYGOUS"
    return None


_PRIMARY_CONTIGS = {str(i) for i in range(1, 23)} | {"X", "Y", "MT"}


def is_primary_contig(chrom: str) -> bool:
    """True only for the primary GRCh38 assembly contigs (1-22, X, Y, MT).

    Strips an optional 'chr' prefix and maps the mitochondrial alias M->MT so we
    keep real chromosomes while discarding decoy/unplaced contigs (e.g.
    1_KI270706v1_random, Un_KI270302v1, HLA-*) which never match ClinVar and only
    pollute per-chromosome summaries.
    """
    c = str(chrom)
    if c.lower().startswith("chr"):
        c = c[3:]
    cu = c.upper()
    if cu == "M":
        cu = "MT"
    if cu in ("X", "Y", "MT"):
        return True
    return c in _PRIMARY_CONTIGS


def carried_alt_indices(gt_alleles) -> set[int]:
    """Alt allele indices (>=1) actually present in the sample genotype.

    cyvcf2 encodes genotype alleles as integers: 0=ref, >=1 alt, -1 missing.
    Returns the set of alt indices the sample carries so we insert only variants
    the person actually has — dropping hom-ref (0/0) and no-calls (./.), and for
    multiallelic sites keeping only the carried alleles (e.g. 0/2 -> {2}).
    """
    return {a for a in gt_alleles if a is not None and a >= 1}


def genotype_alleles(gt_entry) -> list[int]:
    """Allele indices from a cyvcf2 genotype entry, dropping the trailing phase flag.

    cyvcf2 returns [a1, a2, ..., phased_bool]; the last item is always the phased
    boolean. Haploid calls (chrY/MT/non-PAR X) are [a1, phased] — slicing [:2]
    would wrongly keep the phase flag as a second allele, so we drop the last item.
    """
    return list(gt_entry[:-1])


def format_genotype(gt_entry) -> str:
    """Render a cyvcf2 genotype entry as 'a/b' (or 'a' for haploid); missing -> '.'."""
    return "/".join("." if a < 0 else str(a) for a in genotype_alleles(gt_entry))


def _load_coord_map() -> dict[str, str]:
    """Load coordinate-to-rsID mapping from ClinVar build artifact."""
    import gzip
    import json
    from pathlib import Path

    coords_path = Path(__file__).parent.parent / "data" / "clinvar_coords.json.gz"
    if not coords_path.exists():
        print(f"[vcf_parser] clinvar_coords.json.gz not found, rsID annotation disabled")
        return {}
    with gzip.open(coords_path, "rt", encoding="utf-8") as f:
        db = json.load(f)
    print(f"[vcf_parser] Loaded {len(db):,} coordinate-to-rsID mappings")
    return db


# Load once at module level
_COORD_MAP: dict[str, str] = _load_coord_map()


def resolve_rsid(chrom: str, pos: int, ref: str, alt: str, record_id: str | None) -> str | None:
    """Resolve rsID from record ID or coordinate lookup."""
    if record_id and record_id != ".":
        return record_id
    if not _COORD_MAP:
        return None
    coord_key = f"{chrom}:{pos}:{ref}:{alt}"
    return _COORD_MAP.get(coord_key)


def _observe_panel_record(panel_results: dict, record) -> None:
    """Update panel_results in place from one PASS gVCF record (variant or ref block)."""
    if record.FILTER is not None or record.CHROM not in PANEL_BY_CHROM:
        return
    end_info = record.INFO.get("END")
    rec_end = end_info if end_info is not None else record.POS
    has_alt = bool(record.ALT)
    pgt = genotype_alleles(record.genotypes[0]) if record.genotypes else []
    for entry in PANEL_BY_CHROM[record.CHROM]:
        if not record_covers(entry["pos"], record.POS, rec_end):
            continue
        state = classify_covering(has_alt, pgt)
        prev = panel_results.get(entry["rs_id"])
        if prev and STATE_RANK[prev["state"]] >= STATE_RANK[state]:
            continue
        carried_idx = sorted(carried_alt_indices(pgt))
        panel_results[entry["rs_id"]] = {
            "state": state,
            "genotype": format_genotype(record.genotypes[0]) if record.genotypes else None,
            "zygosity": zygosity_for_allele(pgt, carried_idx[0]) if (state == "CARRIED" and carried_idx) else None,
        }


def persist_panel_results(conn, vcf_file_id: str, panel_results: dict) -> None:
    """Upsert one TraitPanelResult per panel SNP; sites never observed -> NOT_COVERED."""
    for entry in TRAIT_PANEL:
        res = panel_results.get(entry["rs_id"], {"state": "NOT_COVERED"})
        state = res["state"]
        upsert_trait_panel_result(
            conn, vcf_file_id, entry["rs_id"], entry["gene"], entry["trait"],
            entry["category"], state, res.get("genotype"), res.get("zygosity"),
            resolve_interpretation(entry, state, res.get("zygosity")), entry.get("confidence"),
            {"chrom": entry["chrom"], "pos": entry["pos"]},
        )


def _observe_apoe_record(apoe_obs: dict, record) -> None:
    """Capture the genotype alleles at the two APOE SNPs from a PASS record."""
    if record.FILTER is not None or record.CHROM not in APOE_BY_CHROM:
        return
    end_info = record.INFO.get("END")
    rec_end = end_info if end_info is not None else record.POS
    has_alt = bool(record.ALT)
    pgt = genotype_alleles(record.genotypes[0]) if record.genotypes else []
    for snp in APOE_BY_CHROM[record.CHROM]:
        if not record_covers(snp["pos"], record.POS, rec_end):
            continue
        # Prefer a variant call (exact genotype) over a covering reference block.
        if snp["rs_id"] not in apoe_obs or has_alt:
            apoe_obs[snp["rs_id"]] = pgt


def _observe_pharmaco_record(pharmaco_obs: dict, record) -> None:
    """Capture genotype alleles at the pharmacogene defining SNPs from a PASS record."""
    if record.FILTER is not None or record.CHROM not in PHARMACO_BY_CHROM:
        return
    end_info = record.INFO.get("END")
    rec_end = end_info if end_info is not None else record.POS
    has_alt = bool(record.ALT)
    pgt = genotype_alleles(record.genotypes[0]) if record.genotypes else []
    for snp in PHARMACO_BY_CHROM[record.CHROM]:
        if record_covers(snp["pos"], record.POS, rec_end):
            if snp["rs_id"] not in pharmaco_obs or has_alt:
                pharmaco_obs[snp["rs_id"]] = pgt


def persist_pharmaco_results(conn, vcf_file_id: str, pharmaco_obs: dict) -> None:
    """Derive per-gene diplotype/phenotype and store one PharmacoResult per gene."""
    for r in call_all(pharmaco_obs):
        upsert_pharmaco_result(conn, vcf_file_id, r["gene"], r["diplotype"], r["phenotype"], r["drugs"])


def _observe_acmg_record(acmg_results: dict, record) -> None:
    """Update acmg_results in place from one PASS gVCF record (variant or ref block)."""
    if record.FILTER is not None or record.CHROM not in ACMG_BY_CHROM:
        return
    end_info = record.INFO.get("END")
    rec_end = end_info if end_info is not None else record.POS + len(record.REF) - 1
    pgt = genotype_alleles(record.genotypes[0]) if record.genotypes else []
    rec_alts = list(record.ALT)
    for entry in ACMG_BY_CHROM[record.CHROM]:
        if not record_covers(entry["pos"], record.POS, rec_end):
            continue
        state, idx = classify_acmg(entry, record.POS, record.REF, rec_alts, pgt)
        prev = acmg_results.get(entry["rs_id"])
        if prev and ACMG_STATE_RANK[prev["state"]] >= ACMG_STATE_RANK[state]:
            continue
        acmg_results[entry["rs_id"]] = {
            "state": state,
            "genotype": format_genotype(record.genotypes[0]) if record.genotypes else None,
            "zygosity": zygosity_for_allele(pgt, idx) if (state == "CARRIED" and idx is not None) else None,
        }


def persist_acmg_results(conn, vcf_file_id: str, acmg_results: dict) -> None:
    """Upsert one AcmgResult per panel variant; sites never observed -> NOT_COVERED."""
    for entry in ACMG_PANEL:
        res = acmg_results.get(entry["rs_id"], {"state": "NOT_COVERED"})
        state = res["state"]
        upsert_acmg_result(
            conn, vcf_file_id, entry["rs_id"], entry["gene"], entry["variant_name"],
            entry["condition"], entry.get("inheritance"), state, res.get("genotype"),
            res.get("zygosity"), entry["interpretation"][state], entry.get("confidence"),
            {"chrom": entry["chrom"], "pos": entry["pos"], "ref": entry["ref"], "alt": entry["alt"]},
        )


def _observe_pgs_record(pgs_obs: dict, pgs_ref: set, pgs_index, record) -> None:
    """Capture PGS-relevant data per record: variant calls go into pgs_obs with
    REF/ALT/GT; ref-blocks add covered PGS positions to pgs_ref."""
    if record.FILTER is not None:
        return
    chrom = record.CHROM
    entry = pgs_index.get(chrom)
    if entry is None:
        return
    sorted_positions, pos_set = entry
    has_alt = bool(record.ALT)
    if has_alt:
        if record.POS in pos_set:
            pgs_obs[(chrom, record.POS)] = {
                "ref": record.REF,
                "alts": list(record.ALT),
                "gt": genotype_alleles(record.genotypes[0]) if record.genotypes else [],
            }
        return
    # ref-block: range query on the sorted list
    end_info = record.INFO.get("END")
    rec_end = end_info if end_info is not None else record.POS + len(record.REF) - 1
    pgt = genotype_alleles(record.genotypes[0]) if record.genotypes else []
    called = [a for a in pgt if a is not None and a >= 0]
    if not called:
        return  # no genotype -> skip (treat as not covered)
    left = bisect.bisect_left(sorted_positions, record.POS)
    right = bisect.bisect_right(sorted_positions, rec_end)
    for pos in sorted_positions[left:right]:
        pgs_ref.add((chrom, pos))


def persist_pgs_results(conn, vcf_file_id: str, pgs_obs: dict, pgs_ref: set) -> None:
    """Compute every loaded PGS score and persist as PrsResult rows (source=pgs_catalog)."""
    for r in call_all_pgs(pgs_obs, pgs_ref):
        upsert_prs_result(
            conn, vcf_file_id, r["trait_key"], r["trait"], r["label"], r.get("description"),
            r["raw_score"], r["expected_mean"], r["expected_sd"], r["z_score"], r["percentile"],
            r["markers_used"], r["markers_total"], r["interpretation"],
            {
                "markers_total": r["markers_total"],
                "markers_ref_assumed": r["markers_ref_assumed"],
                "markers_ref_resolved": r.get("markers_ref_resolved", 0),
                "markers_ref_skipped": r.get("markers_ref_skipped", 0),
            },
            pgs_id=r["pgs_id"], source="pgs_catalog",
            calibration_source=r.get("calibration_source"),
        )


def _observe_carrier_record(carrier_results: dict, record) -> None:
    """Update carrier_results in place from one PASS gVCF record (variant or ref block)."""
    if record.FILTER is not None or record.CHROM not in CARRIER_BY_CHROM:
        return
    end_info = record.INFO.get("END")
    rec_end = end_info if end_info is not None else record.POS + len(record.REF) - 1
    pgt = genotype_alleles(record.genotypes[0]) if record.genotypes else []
    rec_alts = list(record.ALT)
    for entry in CARRIER_BY_CHROM[record.CHROM]:
        if not record_covers(entry["pos"], record.POS, rec_end):
            continue
        state, idx = classify_carrier(entry, record.POS, record.REF, rec_alts, pgt)
        prev = carrier_results.get(entry["rs_id"])
        if prev and CARRIER_STATE_RANK[prev["state"]] >= CARRIER_STATE_RANK[state]:
            continue
        carrier_results[entry["rs_id"]] = {
            "state": state,
            "genotype": format_genotype(record.genotypes[0]) if record.genotypes else None,
            "zygosity": zygosity_for_allele(pgt, idx) if (idx is not None) else None,
        }


def persist_carrier_results(conn, vcf_file_id: str, carrier_results: dict) -> None:
    """Upsert one CarrierPanelResult per panel variant; sites never observed -> NOT_COVERED."""
    for entry in CARRIER_PANEL:
        res = carrier_results.get(entry["rs_id"], {"state": "NOT_COVERED"})
        state = res["state"]
        upsert_carrier_result(
            conn, vcf_file_id, entry["rs_id"], entry["gene"], entry["variant_name"],
            entry["condition"], entry.get("inheritance"), state, res.get("genotype"),
            res.get("zygosity"), entry["interpretation"][state], entry.get("confidence"),
            {"chrom": entry["chrom"], "pos": entry["pos"], "ref": entry["ref"], "alt": entry["alt"]},
        )


def persist_apoe_result(conn, vcf_file_id: str, apoe_obs: dict) -> None:
    """Derive the APOE ε diplotype from the two SNPs and store one panel row."""
    diplo = apoe_diplotype(apoe_obs.get("rs429358"), apoe_obs.get("rs7412"))
    if diplo is None:
        state, genotype, interp = "NOT_COVERED", None, APOE_NOT_COVERED
    else:
        state = "REFERENCE" if diplo == "ε3/ε3" else "CARRIED"
        genotype, interp = diplo, APOE_INTERPRETATION[diplo]
    upsert_trait_panel_result(
        conn, vcf_file_id, "rs429358", "APOE", "Aplotipo APOE (ε2/ε3/ε4)",
        "COGNITIVE", state, genotype, None, interp, None,
        {"derived_from": ["rs429358", "rs7412"], "sensitive": True},
    )


def parse_vcf(vcf_file_id: str, file_path: str, progress_callback=None) -> dict:
    vcf = VCF(file_path)

    batch = []
    total_count = 0
    snp_count = 0
    indel_count = 0
    rsid_resolved = 0
    chrom_stats = defaultdict(lambda: {"variant_count": 0, "snp_count": 0, "indel_count": 0})
    panel_results: dict[str, dict] = {}
    apoe_obs: dict[str, list] = {}
    pharmaco_obs: dict[str, list] = {}
    acmg_results: dict[str, dict] = {}
    carrier_results: dict[str, dict] = {}
    pgs_obs: dict[tuple, dict] = {}
    pgs_ref: set[tuple] = set()
    pgs_index = get_pgs_index() if loaded_pgs_scores() else {}

    with get_connection() as conn:
        for record in vcf:
            # Trait-panel capture: variants AND reference blocks (to catch standard 0/0
            # genotypes that the variant loop below drops).
            _observe_panel_record(panel_results, record)
            _observe_apoe_record(apoe_obs, record)
            _observe_pharmaco_record(pharmaco_obs, record)
            _observe_acmg_record(acmg_results, record)
            _observe_carrier_record(carrier_results, record)
            if pgs_index:
                _observe_pgs_record(pgs_obs, pgs_ref, pgs_index, record)

            # Skip gVCF reference blocks (no ALT) first — they are the bulk of a WGS gVCF.
            if not record.ALT:
                continue
            # Skip calls that failed quality/depth filters (cyvcf2: PASS -> None).
            if record.FILTER is not None:
                continue
            # Skip decoy/unplaced contigs (*_random, Un_*, HLA-*): never match ClinVar.
            if not is_primary_contig(record.CHROM):
                continue
            if not record.genotypes:
                continue

            alleles = genotype_alleles(record.genotypes[0])
            carried = carried_alt_indices(alleles)
            if not carried:  # hom-ref or no-call: the sample carries no alt allele
                continue

            gt = format_genotype(record.genotypes[0])
            chrom = record.CHROM
            ad_list, dp = read_depths(record)
            called_count = len([a for a in alleles if a is not None and a >= 0])

            for alt_index, alt in enumerate(record.ALT, start=1):
                if alt_index not in carried:  # multiallelic: keep only carried alleles
                    continue
                zygosity = zygosity_for_allele(alleles, alt_index)
                rs_id = resolve_rsid(record.CHROM, record.POS, record.REF, alt, record.ID)
                if rs_id:
                    rsid_resolved += 1

                ref_depth = ad_list[0] if ad_list else None
                alt_depth = ad_list[alt_index] if (ad_list and len(ad_list) > alt_index) else None
                # hemizygous (haploid) and homozygous-alt calls expect ~100% alt reads
                expect_high = zygosity == "HOMOZYGOUS" or called_count == 1
                vaf, low_confidence = assess_confidence(ref_depth, alt_depth, dp, expect_high)

                variant = {
                    "id": str(uuid.uuid4()),
                    "chromosome": chrom,
                    "position": record.POS,
                    "rs_id": rs_id,
                    "ref": record.REF,
                    "alt": alt,
                    "quality": record.QUAL,
                    "filter": record.FILTER,
                    "genotype": gt,
                    "zygosity": zygosity,
                    "depth": dp,
                    "vaf": round(vaf, 4) if vaf is not None else None,
                    "low_confidence": low_confidence,
                }
                batch.append(variant)
                total_count += 1

                chrom_stats[chrom]["variant_count"] += 1
                if len(record.REF) == 1 and len(alt) == 1:
                    snp_count += 1
                    chrom_stats[chrom]["snp_count"] += 1
                else:
                    indel_count += 1
                    chrom_stats[chrom]["indel_count"] += 1

                if len(batch) >= BATCH_SIZE:
                    insert_variants_batch(conn, vcf_file_id, batch)
                    conn.commit()
                    batch = []
                    if progress_callback:
                        progress_callback(total_count)

        if batch:
            insert_variants_batch(conn, vcf_file_id, batch)

        update_vcf_file(conn, vcf_file_id, totalVariants=total_count, snpCount=snp_count, indelCount=indel_count)

        for chrom, stats in chrom_stats.items():
            upsert_chromosome_summary(conn, vcf_file_id, chrom, stats)

        persist_panel_results(conn, vcf_file_id, panel_results)
        persist_apoe_result(conn, vcf_file_id, apoe_obs)
        persist_pharmaco_results(conn, vcf_file_id, pharmaco_obs)
        persist_acmg_results(conn, vcf_file_id, acmg_results)
        persist_carrier_results(conn, vcf_file_id, carrier_results)
        if pgs_index:
            persist_pgs_results(conn, vcf_file_id, pgs_obs, pgs_ref)

        conn.commit()

    return {
        "total": total_count,
        "snp": snp_count,
        "indel": indel_count,
        "chromosomes": len(chrom_stats),
        "rsid_resolved": rsid_resolved,
    }
