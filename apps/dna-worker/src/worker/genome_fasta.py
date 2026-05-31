"""Wrapper su pyfaidx per lookup random-access del REF GRCh38 a una posizione.

Usato per risolvere l'ambiguità dei ref-block del gVCF nei PGS scoring:
quando il soggetto e' a un PGS position coperto da un ref-block (genotipo
omozigote di riferimento), occorre sapere QUALE base e' il riferimento per
contare le copie dell'effect_allele.
"""
from pathlib import Path

_FASTA_PATH = Path(__file__).parent.parent / "data" / "genome" / "GRCh38.fa"

_fa = None  # pyfaidx.Fasta, lazy-loaded


def _get():
    """Lazy-load FASTA. Restituisce None se il file non esiste (caso ok: i ref-block
    saranno comunque trattati conservativamente — n_effect=0 — finche' la FASTA
    non viene scaricata da ensure_databases.ensure_genome_fasta())."""
    global _fa
    if _fa is None:
        if not _FASTA_PATH.exists():
            return None
        # import lazy così l'import del modulo non fallisce nei test
        from pyfaidx import Fasta
        _fa = Fasta(str(_FASTA_PATH), as_raw=True)
    return _fa


def get_ref_base(chrom: str, pos: int) -> str | None:
    """Restituisce la base GRCh38 forward alla coordinata (1-based), oppure None
    se la FASTA non e' disponibile o il chrom/pos non e' valido.
    """
    fa = _get()
    if fa is None:
        return None
    try:
        seq = fa.get_seq(chrom, pos, pos)  # 1-based incluso
        if seq is None:
            return None
        s = str(seq).upper()
        return s if s else None
    except Exception:
        return None


def is_available() -> bool:
    """True se la FASTA GRCh38 e' scaricata e accessibile."""
    return _FASTA_PATH.exists() and _get() is not None
