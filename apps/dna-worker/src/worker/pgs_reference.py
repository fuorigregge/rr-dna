"""Distribuzione di riferimento empirica per i PGS scores.

Calcolata una sola volta sui 503 sample EUR del 1000 Genomes Project (subset
limitato alle posizioni PGS), produce media e SD empiriche per ciascun PGS.
Sostituisce l'approssimazione Hardy-Weinberg (che ignora LD e assume tutti
gli SNP indipendenti) con la distribuzione reale.

Output: src/data/genome/pgs_reference.json
  {
    "PGS000018": {"mean": ..., "sd": ..., "n_samples": 503,
                  "markers_total": N, "markers_used": K},
    ...
  }
"""
import json
import statistics
from pathlib import Path

from cyvcf2 import VCF

from src.worker.pgs_panel import PGS_SCORES, _file_path as pgs_file_path
from src.worker.pgs_catalog import iter_pgs_variants
from src.worker.genome_fasta import get_ref_base, is_available as fasta_available

GENOME_DIR = Path(__file__).parent.parent / "data" / "genome"
KG_DIR = GENOME_DIR / "kg"
REFERENCE_PATH = GENOME_DIR / "pgs_reference.json"


def _count_effect(ref: str, alts: list[str], gt_alleles, effect_allele: str) -> int | None:
    """Quante copie di effect_allele in un genotipo (n=0/1/2)."""
    called = [a for a in (gt_alleles or []) if a is not None and a >= 0]
    if not called:
        return None
    n = 0
    for a in called:
        nuc = ref if a == 0 else (alts[a - 1] if 0 <= a - 1 < len(alts) else None)
        if nuc == effect_allele:
            n += 1
    return n


def build_pgs_position_index() -> dict[tuple[str, int], list[dict]]:
    """{(chrom,pos) -> [pgs entries]} combinato per tutti gli score caricati."""
    idx: dict[tuple[str, int], list[dict]] = {}
    for score in PGS_SCORES:
        path = pgs_file_path(score["pgs_id"])
        if not path.exists():
            continue
        for v in iter_pgs_variants(path):
            idx.setdefault((v.chrom, v.pos), []).append({
                "pgs_id": score["pgs_id"],
                "effect_allele": v.effect_allele,
                "other_allele": v.other_allele,
                "weight": v.weight,
            })
    return idx


def compute_references(kg_vcfs: list[Path], progress=None) -> dict[str, dict]:
    """Calcola media/SD empiriche per ciascun PGS sui sample EUR del 1000G.

    Logica:
    - per ogni record dei VCF 1000G subset (che copre solo posizioni PGS),
      cerchiamo il PGS index e, per ogni sample, contiamo le copie di
      effect_allele in base al REF/ALT del record 1000G stesso
    - le posizioni PGS che non compaiono nei VCF 1000G (perche' tutti i
      sample EUR sono hom-ref) aggiungono un contributo COSTANTE a tutti i
      sample, che NON modifica la SD ma sposta la media; lo gestiamo a fine
      pass con la FASTA: se ref==effect_allele aggiungiamo 2*weight a tutti,
      altrimenti 0
    """
    pgs_index = build_pgs_position_index()
    n_positions = len(pgs_index)
    # Inizializza per-sample running scores per ogni PGS
    sample_scores: dict[str, dict[str, float]] = {s["pgs_id"]: {} for s in PGS_SCORES}
    samples_per_pgs: dict[str, list[str]] = {}

    positions_seen_in_kg: set[tuple[str, int]] = set()
    markers_resolved_per_pgs: dict[str, int] = {s["pgs_id"]: 0 for s in PGS_SCORES}

    for kg_vcf_path in kg_vcfs:
        if not kg_vcf_path.exists():
            continue
        vcf = VCF(str(kg_vcf_path))
        samples = list(vcf.samples)
        for pgs_id in sample_scores:
            if pgs_id not in samples_per_pgs:
                samples_per_pgs[pgs_id] = samples
                sample_scores[pgs_id] = {s: 0.0 for s in samples}
        for record in vcf:
            key = (record.CHROM, record.POS)
            entries = pgs_index.get(key)
            if entries is None:
                continue
            positions_seen_in_kg.add(key)
            alts = list(record.ALT)
            ref = record.REF
            for entry in entries:
                ea = entry["effect_allele"]
                weight = entry["weight"]
                pgs_id = entry["pgs_id"]
                for i, sample in enumerate(samples):
                    gt = record.genotypes[i]
                    pgt = list(gt[:-1])  # drop phase flag
                    n = _count_effect(ref, alts, pgt, ea)
                    if n is None:
                        continue
                    sample_scores[pgs_id][sample] += n * weight
                markers_resolved_per_pgs[pgs_id] += 1
        if progress:
            progress(f"processed {kg_vcf_path.name}, sites seen {len(positions_seen_in_kg):,}/{n_positions:,}")

    # Posizioni PGS non viste nei 1000G subset = tutti i sample EUR sono hom-ref
    # Contributo costante a tutti i sample via FASTA (se disponibile)
    constant_contrib_unseen: dict[str, float] = {s["pgs_id"]: 0.0 for s in PGS_SCORES}
    unseen_count_per_pgs: dict[str, int] = {s["pgs_id"]: 0 for s in PGS_SCORES}
    if fasta_available():
        for key, entries in pgs_index.items():
            if key in positions_seen_in_kg:
                continue
            chrom, pos = key
            ref_base = get_ref_base(chrom, pos)
            for entry in entries:
                ea_first = entry["effect_allele"][:1].upper() if entry["effect_allele"] else ""
                if ref_base == ea_first:
                    constant_contrib_unseen[entry["pgs_id"]] += 2 * entry["weight"]
                unseen_count_per_pgs[entry["pgs_id"]] += 1
    # Aggiungi il costante a tutti i sample (non modifica la SD)
    for pgs_id, contrib in constant_contrib_unseen.items():
        if contrib != 0:
            for s in sample_scores[pgs_id]:
                sample_scores[pgs_id][s] += contrib

    # Statistiche per ogni PGS
    out: dict[str, dict] = {}
    for score in PGS_SCORES:
        pgs_id = score["pgs_id"]
        scores = list(sample_scores[pgs_id].values())
        if not scores:
            continue
        out[pgs_id] = {
            "mean": statistics.mean(scores),
            "median": statistics.median(scores),
            "sd": statistics.stdev(scores) if len(scores) > 1 else 0.0,
            "n_samples": len(scores),
            "markers_resolved": markers_resolved_per_pgs[pgs_id],
            "markers_unseen_in_kg": unseen_count_per_pgs[pgs_id],
            "trait_key": score["trait_key"],
            "hist": _histogram(scores),
        }
    return out


def _histogram(values: list[float], nbins: int = 36) -> dict:
    """Istogramma empirico dei punteggi di riferimento, per disegnare la curva
    di distribuzione nel frontend. Restituisce binStart/binWidth/counts."""
    lo, hi = min(values), max(values)
    if hi <= lo:
        return {"binStart": lo, "binWidth": 0.0, "counts": [len(values)]}
    width = (hi - lo) / nbins
    counts = [0] * nbins
    for v in values:
        i = int((v - lo) / width)
        if i >= nbins:
            i = nbins - 1
        counts[i] += 1
    return {"binStart": lo, "binWidth": width, "counts": counts}


def save_references(refs: dict[str, dict]) -> None:
    REFERENCE_PATH.write_text(json.dumps(refs, indent=2))


def load_references() -> dict[str, dict]:
    if not REFERENCE_PATH.exists():
        return {}
    return json.loads(REFERENCE_PATH.read_text())


if __name__ == "__main__":
    import sys
    kg_vcfs = sorted(KG_DIR.glob("chr*.eur_pgs.vcf.gz"))
    if not kg_vcfs:
        print(f"[pgs_reference] nessun file in {KG_DIR}, abort", file=sys.stderr)
        sys.exit(1)
    print(f"[pgs_reference] processing {len(kg_vcfs)} VCF files")
    refs = compute_references(kg_vcfs, progress=lambda m: print(f"  {m}"))
    save_references(refs)
    print(f"[pgs_reference] saved {len(refs)} PGS distributions to {REFERENCE_PATH}")
    for pgs_id, info in sorted(refs.items()):
        print(f"  {pgs_id} ({info['trait_key']:32}): mean={info['mean']:+.3f} sd={info['sd']:.3f} n={info['n_samples']} resolved={info['markers_resolved']:,} unseen={info['markers_unseen_in_kg']:,}")
