"""Lookup della frequenza allelica gnomAD v4.1 (exomes) per il filtro ACMG BS1.

Per una variante (chrom, pos, ref, alt) restituisce la frequenza allelica nella
popolazione generale e per gruppo ancestrale. Serve a declassare i falsi positivi:
una variante ClinVar "patogenica" presente in larga parte della popolazione NON
può essere causa di una malattia rara (regola ACMG BS1).

I file slim (chr*.af.bcf, solo campi AF) stanno in src/data/gnomad/exomes/.
Lookup lazy con handle cyvcf2 cachati per cromosoma; se i file non sono presenti
(es. non ancora scaricati) restituisce None senza errori.
"""
from pathlib import Path

from cyvcf2 import VCF

GNOMAD_DIR = Path(__file__).parent.parent / "data" / "gnomad" / "exomes"

# Soglie ACMG BS1 sulla frequenza popmax (AF_grpmax).
BS1_COMMON = 0.05   # >=5%: polimorfismo comune, incompatibile con malattia rara
BS1_FREQUENT = 0.01  # >=1%: troppo frequente per una mendeliana rara (cautela)

_handles: dict[str, VCF | None] = {}


def _norm_chrom(chrom: str) -> str:
    return chrom if chrom.startswith("chr") else f"chr{chrom}"


def _vcf_for(chrom: str) -> VCF | None:
    key = _norm_chrom(chrom)
    if key not in _handles:
        path = GNOMAD_DIR / f"{key}.af.bcf"
        try:
            _handles[key] = VCF(str(path)) if path.exists() else None
        except Exception:
            _handles[key] = None
    return _handles[key]


def is_available() -> bool:
    """True se almeno un file slim gnomAD è presente."""
    return GNOMAD_DIR.exists() and any(GNOMAD_DIR.glob("chr*.af.bcf"))


def _as_float(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, (list, tuple)):
        v = v[0] if v else None
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def lookup_af(chrom: str, pos: int, ref: str, alt: str) -> dict | None:
    """Frequenze gnomAD per un match ESATTO (chrom,pos,ref,alt), o None.

    Ritorna: {af, af_nfe, af_grpmax, grpmax_group, faf95, nhomalt}.
    af_grpmax è la frequenza popmax (gruppo ancestrale a frequenza massima),
    usata per il test BS1.

    Correttezza: il match richiede POS, REF e ALT identici, quindi NON può mai
    restituire l'AF di una variante diversa (un (pos,ref,alt) identico È la stessa
    variante). gnomAD v4.1 è bi-allelico (un ALT per record), quindi l'AF è un
    singolo valore per record — nessuna ambiguità multi-allelica.

    Limite noto (in direzione SICURA): un indel in regione ripetuta/omopolimerica
    rappresentato con un left-alignment diverso da quello di gnomAD può non
    matchare → None → nessun AF → nessun declassamento BS1. È un falso negativo
    (non nasconde nulla), non un errore; gli SNV e gli indel a rappresentazione
    canonica matchano correttamente.
    """
    vcf = _vcf_for(chrom)
    if vcf is None:
        return None
    region = f"{_norm_chrom(chrom)}:{pos}-{pos}"
    try:
        for rec in vcf(region):
            if rec.POS != pos or rec.REF != ref:
                continue
            if alt not in rec.ALT:
                continue
            info = rec.INFO
            grp = info.get("grpmax")
            return {
                "af": _as_float(info.get("AF")),
                "af_nfe": _as_float(info.get("AF_nfe")),
                "af_grpmax": _as_float(info.get("AF_grpmax")),
                "grpmax_group": grp if isinstance(grp, str) else None,
                "faf95": _as_float(info.get("fafmax_faf95_max")),
                "nhomalt": _as_float(info.get("nhomalt")),
            }
    except Exception:
        return None
    return None


def bs1_level(af_grpmax: float | None) -> str | None:
    """Livello BS1 dalla frequenza popmax: 'common' (>=5%), 'frequent' (>=1%), None."""
    if af_grpmax is None:
        return None
    if af_grpmax >= BS1_COMMON:
        return "common"
    if af_grpmax >= BS1_FREQUENT:
        return "frequent"
    return None
