"""Stima dell'eredità neandertaliana dai tag-SNP introgressi (Vernot & Akey 2016,
popolazione EUR), liftati a GRCh38 (vedi src/data/neanderthal/build_panel.py).

Metodo: a ogni tag-SNP introgresso si conta quante copie dell'allele ARCAICO
(la base del Neanderthal, allele derivato) il soggetto porta. La frazione arcaica
osservata, rapportata alla frequenza media europea sul pannello, dà un carico
relativo; calibrato sulla media neandertaliana del genoma europeo (~1.9%) produce
una stima percentuale. È un metodo basato su marcatori validati (S* + filtro
outgroup africano già applicato a monte), non una deconvoluzione genome-wide.

Polarità: il pannello include `ref_is_archaic` (la base di riferimento hg38 è
l'arcaica?), così un genotipo hom-ref (0/0) conta 2 copie arcaiche dove serve.
"""
import bisect
from pathlib import Path

PANEL_PATH = Path(__file__).parent.parent / "data" / "neanderthal" / "panel_hg38.tsv"

# Media neandertaliana del genoma negli europei (Prüfer et al.; ~1.8–2.0%).
EUR_GENOME_PCT = 1.9

_INDEX = None  # {chrom: (sorted_positions, {pos: (archaic_base, eur_freq, ref_is_archaic)})}


def is_available() -> bool:
    return PANEL_PATH.exists()


def get_index():
    """Indice lazy del pannello (cache di processo)."""
    global _INDEX
    if _INDEX is None:
        by_chrom: dict[str, dict[int, tuple[str, float, int]]] = {}
        if PANEL_PATH.exists():
            with open(PANEL_PATH) as f:
                next(f, None)
                for line in f:
                    parts = line.rstrip("\n").split("\t")
                    if len(parts) < 6:
                        continue
                    c, p, _anc, arc, eur, ria = parts
                    by_chrom.setdefault(c, {})[int(p)] = (arc, float(eur), int(ria))
        _INDEX = {c: (sorted(d), d) for c, d in by_chrom.items()}
    return _INDEX


def observe_record(obs: dict, record) -> None:
    """Aggiorna le osservazioni con un record gVCF (variante o ref-block).

    `obs` mappa (chrom,pos) -> (archaic_copies, eur_freq) per i siti coperti.
    Conta le copie dell'allele arcaico portate dal soggetto a ogni tag-SNP.
    """
    if record.FILTER is not None:
        return
    index = get_index()
    ent = index.get(record.CHROM)
    if ent is None:
        return
    sorted_pos, data = ent
    gts = record.genotypes[0][:-1] if record.genotypes else []
    called = [a for a in gts if a is not None and a >= 0]
    if not called:
        return

    if record.ALT:  # variante: conta gli alleli del genotipo uguali all'arcaico
        p = record.POS
        d = data.get(p)
        if d is None or (record.CHROM, p) in obs:
            return
        arc, eur, _ria = d
        n = 0
        for a in called:
            base = record.REF if a == 0 else (record.ALT[a - 1] if a - 1 < len(record.ALT) else None)
            if base == arc:
                n += 1
        obs[(record.CHROM, p)] = (n, eur)
    else:  # ref-block: hom-ref su tutto il range -> 2 copie arcaiche se ref==arcaico
        end = record.INFO.get("END") or record.POS
        lo = bisect.bisect_left(sorted_pos, record.POS)
        hi = bisect.bisect_right(sorted_pos, end)
        for p in sorted_pos[lo:hi]:
            if (record.CHROM, p) in obs:
                continue
            arc, eur, ria = data[p]
            obs[(record.CHROM, p)] = (2 * ria, eur)


def summarize(obs: dict) -> dict | None:
    """Riepilogo finale dalle osservazioni: carico relativo + stima percentuale."""
    index = get_index()
    total_panel = sum(len(d) for _, d in index.values())
    if not obs:
        return None
    covered = len(obs)
    archaic_copies = sum(v[0] for v in obs.values())
    exp_sum = sum(v[1] for v in obs.values())
    observed = archaic_copies / (2 * covered) if covered else 0.0
    expected = exp_sum / covered if covered else 0.0
    rel = observed / expected if expected else 0.0
    return {
        "panel_sites": total_panel,
        "covered_sites": covered,
        "archaic_alleles": archaic_copies,
        "observed_fraction": round(observed, 5),
        "expected_fraction": round(expected, 5),
        "relative_load": round(rel, 4),
        "est_percent": round(rel * EUR_GENOME_PCT, 3),
    }
