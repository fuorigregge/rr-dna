from src.data.clinvar_loader import (
    get_reference,
    get_clinvar_by_coords,
    get_pharmgkb,
    get_ancestry_gnomad,
)
from src.db.queries import (
    get_variants_with_rsid,
    insert_annotation,
    insert_disease_risk,
    insert_pharmacogenomics,
    insert_carrier_status,
    insert_ancestry_marker,
    insert_phenotype_trait,
    update_chromosome_summary_counts,
)
from src.worker.gnomad_af import lookup_af, bs1_level


# Significati per cui ha senso il controllo BS1 (frequenza popolazione gnomAD):
# una variante "patogenica/incerta" comune è quasi certamente benigna.
_AF_RELEVANT_SIGNIFICANCE = {"PATHOGENIC", "LIKELY_PATHOGENIC", "UNCERTAIN"}


def _af_metadata(chromosome, position, ref, alt) -> dict | None:
    """Frequenze gnomAD + livello BS1 da fondere nel metadata di un DiseaseRisk."""
    af = lookup_af(chromosome, position, ref, alt)
    if af is None:
        return None
    return {
        "gnomad_af": af["af"],
        "gnomad_af_nfe": af["af_nfe"],
        "gnomad_af_grpmax": af["af_grpmax"],
        "gnomad_grpmax_group": af["grpmax_group"],
        "gnomad_nhomalt": af["nhomalt"],
        "bs1_level": bs1_level(af["af_grpmax"]),
    }


def resolve_annotation_sources(hand_entry, clinvar_entry, pharma_entry) -> list[dict]:
    """Decide which reference entries apply to a variant.

    Hand-curated entries (rsID) fully override automated sources. Otherwise the
    allele-specific ClinVar entry (coordinate) and the PharmGKB entry (rsID) are
    additive — each contributes its own annotations.
    """
    if hand_entry:
        return [hand_entry]
    return [e for e in (clinvar_entry, pharma_entry) if e]


def annotate_variants(conn, vcf_file_id: str, progress_callback=None, ancestry_mode: str = "none") -> dict:
    """Look up variants against the local reference DB and populate analysis tables."""
    variants = get_variants_with_rsid(conn, vcf_file_id)

    stats = {
        "disease_risks": 0,
        "pharmacogenomics": 0,
        "carrier_status": 0,
        "ancestry_markers": 0,
        "ancestry_gnomad": 0,
        "phenotype_traits": 0,
        "total_annotated": 0,
    }
    chrom_pathogenic: dict[str, int] = {}
    chrom_pharma: dict[str, int] = {}

    use_gnomad = ancestry_mode == "gnomad"

    for i, (variant_id, rs_id, chromosome, position, ref, alt) in enumerate(variants):
        entries = resolve_annotation_sources(
            get_reference(rs_id),
            get_clinvar_by_coords(chromosome, position, ref, alt),
            get_pharmgkb(rs_id),
        )

        if entries:
            stats["total_annotated"] += 1

        gene_annotated = False
        for ref_entry in entries:
            if ref_entry.get("gene") and not gene_annotated:
                insert_annotation(
                    conn, variant_id, "CLINVAR",
                    ref_entry["gene"], None, None,
                    {"source": "local_reference_db", "rsId": rs_id, "gene_function": ref_entry.get("gene_function")},
                )
                gene_annotated = True

            # Frequenza gnomAD calcolata una volta per variante (ACMG BS1);
            # iniettata nel metadata dei reperti clinicamente rilevanti.
            af_meta = None
            if any(dr["significance"] in _AF_RELEVANT_SIGNIFICANCE for dr in ref_entry.get("disease_risks", [])):
                af_meta = _af_metadata(chromosome, position, ref, alt)

            for dr in ref_entry.get("disease_risks", []):
                meta = dr.get("metadata")
                if af_meta and dr["significance"] in _AF_RELEVANT_SIGNIFICANCE:
                    meta = {**(meta or {}), **af_meta}
                insert_disease_risk(
                    conn, variant_id, dr["disease"],
                    dr["significance"], dr["source"],
                    dr.get("evidence_level"), meta,
                )
                stats["disease_risks"] += 1
                if dr["significance"] in ("PATHOGENIC", "LIKELY_PATHOGENIC"):
                    chrom_pathogenic[chromosome] = chrom_pathogenic.get(chromosome, 0) + 1

            for pg in ref_entry.get("pharmacogenomics", []):
                insert_pharmacogenomics(
                    conn, variant_id, pg["drug"],
                    pg.get("effect"), pg.get("metabolizer_status"),
                    pg["source"], pg.get("evidence_level"), pg.get("metadata"),
                )
                stats["pharmacogenomics"] += 1
                chrom_pharma[chromosome] = chrom_pharma.get(chromosome, 0) + 1

            for cs in ref_entry.get("carrier_status", []):
                insert_carrier_status(
                    conn, variant_id, cs["condition"],
                    cs.get("inheritance_pattern"),
                    cs.get("carrier_type"), cs["source"], cs.get("metadata"),
                )
                stats["carrier_status"] += 1

            for am in ref_entry.get("ancestry_markers", []):
                insert_ancestry_marker(
                    conn, variant_id, am.get("haplogroup"),
                    am.get("population"), am.get("frequency"), am.get("metadata"),
                )
                stats["ancestry_markers"] += 1

            for pt in ref_entry.get("phenotype_traits", []):
                insert_phenotype_trait(
                    conn, variant_id, pt["trait"],
                    pt.get("effect"), pt.get("category"),
                    pt["source"], pt.get("metadata"),
                )
                stats["phenotype_traits"] += 1

        # gnomAD ancestry enrichment (independent from ClinVar reference)
        if use_gnomad:
            gnomad_markers = get_ancestry_gnomad(rs_id)
            if gnomad_markers:
                for gm in gnomad_markers:
                    insert_ancestry_marker(
                        conn, variant_id, None,
                        gm["population"], gm["frequency"], gm["metadata"],
                    )
                    stats["ancestry_gnomad"] += 1

        if progress_callback and i % 10 == 0:
            progress_callback(i, len(variants))

    update_chromosome_summary_counts(conn, vcf_file_id, chrom_pathogenic, chrom_pharma)
    conn.commit()

    return stats
