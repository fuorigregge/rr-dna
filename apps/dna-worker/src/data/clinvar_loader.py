"""
Multi-tier reference database loader.
- Tier 1: hand-curated REFERENCE_DB (18 rsIDs with rich metadata) — always takes priority
- Tier 2: ClinVar database, keyed by (chrom, pos, ref, alt) — allele-specific disease/carrier lookup
- PharmGKB: pharmacogenomics database, keyed by rsID — additive lookup
- Ancestry: gnomAD population frequency database (millions of rsIDs) — separate lookup
"""

import gzip
import json
import os
from pathlib import Path

from src.data.reference_db import REFERENCE_DB

_DATA_DIR = Path(__file__).parent
_CLINVAR_PATH = Path(os.environ.get("CLINVAR_DB_PATH", _DATA_DIR / "clinvar_db.json.gz"))
_PHARMGKB_PATH = Path(os.environ.get("PHARMGKB_DB_PATH", _DATA_DIR / "pharmgkb_db.json.gz"))
_ANCESTRY_GNOMAD_PATH = Path(os.environ.get("ANCESTRY_GNOMAD_DB_PATH", _DATA_DIR / "ancestry_gnomad_db.json.gz"))

# gnomAD population ID → readable name
GNOMAD_POP_NAMES: dict[str, str] = {
    "afr": "African",
    "amr": "Latino/Admixed American",
    "asj": "Ashkenazi Jewish",
    "eas": "East Asian",
    "fin": "Finnish",
    "mid": "Middle Eastern",
    "nfe": "European (non-Finnish)",
    "sas": "South Asian",
}


def _load_clinvar() -> dict:
    if not _CLINVAR_PATH.exists():
        print(f"[clinvar_loader] Warning: {_CLINVAR_PATH} not found, using hand-curated DB only")
        return {}
    with gzip.open(_CLINVAR_PATH, "rt", encoding="utf-8") as f:
        db = json.load(f)
    print(f"[clinvar_loader] Loaded {len(db):,} ClinVar entries from {_CLINVAR_PATH}")
    return db


def _load_pharmgkb() -> dict:
    if not _PHARMGKB_PATH.exists():
        print(f"[clinvar_loader] Warning: {_PHARMGKB_PATH} not found, pharmacogenomics disabled")
        return {}
    with gzip.open(_PHARMGKB_PATH, "rt", encoding="utf-8") as f:
        db = json.load(f)
    print(f"[clinvar_loader] Loaded {len(db):,} PharmGKB entries from {_PHARMGKB_PATH}")
    return db


def _load_ancestry_gnomad() -> dict:
    if not _ANCESTRY_GNOMAD_PATH.exists():
        return {}
    with gzip.open(_ANCESTRY_GNOMAD_PATH, "rt", encoding="utf-8") as f:
        db = json.load(f)
    print(f"[clinvar_loader] Loaded {len(db):,} gnomAD ancestry entries from {_ANCESTRY_GNOMAD_PATH}")
    return db


CLINVAR_DB: dict[str, dict] = _load_clinvar()
PHARMGKB_DB: dict[str, dict] = _load_pharmgkb()
ANCESTRY_GNOMAD_DB: dict[str, dict] = _load_ancestry_gnomad()


def _coord_key(chrom: str, pos, ref: str, alt: str) -> str:
    """Build the canonical coordinate key matching the builder's keys.

    Normalizes away any 'chr' prefix and maps the mitochondrial contig (VCFs use
    chrM/M) onto ClinVar's 'MT' naming so mitochondrial variants still match.
    """
    c = str(chrom)
    if c.lower().startswith("chr"):
        c = c[3:]
    if c.upper() in ("M", "MT"):
        c = "MT"
    return f"{c}:{pos}:{ref}:{alt}"


def lookup_clinvar(db: dict, chrom: str, pos, ref: str, alt: str) -> dict | None:
    """Allele-specific ClinVar lookup by (chrom, pos, ref, alt)."""
    return db.get(_coord_key(chrom, pos, ref, alt))


def get_clinvar_by_coords(chrom: str, pos, ref: str, alt: str) -> dict | None:
    """Look up ClinVar disease/carrier data for the exact variant coordinate."""
    return lookup_clinvar(CLINVAR_DB, chrom, pos, ref, alt)


def get_pharmgkb(rs_id: str) -> dict | None:
    """Look up PharmGKB pharmacogenomics data by rsID."""
    return PHARMGKB_DB.get(rs_id)


def get_reference(rs_id: str) -> dict | None:
    """Look up hand-curated reference entry by rsID. Takes priority over ClinVar/PharmGKB."""
    return REFERENCE_DB.get(rs_id)


def get_ancestry_gnomad(rs_id: str) -> list[dict] | None:
    """Look up gnomAD population frequencies for rs_id.
    Returns list of {population, frequency, metadata} dicts ready for insert_ancestry_marker.
    """
    freqs = ANCESTRY_GNOMAD_DB.get(rs_id)
    if not freqs:
        return None

    markers = []
    for pop_id, af in freqs.items():
        pop_name = GNOMAD_POP_NAMES.get(pop_id)
        if not pop_name:
            continue
        markers.append({
            "population": pop_name,
            "frequency": af,
            "metadata": {
                "source": "gnomAD_v4",
                "description": f"Frequenza allelica nella popolazione {pop_name} (gnomAD v4 exomes)",
                "links": {
                    "gnomAD": f"https://gnomad.broadinstitute.org/variant/{rs_id}",
                },
            },
        })
    return markers


def reload_ancestry_gnomad():
    """Reload the gnomAD ancestry DB after it has been built."""
    global ANCESTRY_GNOMAD_DB
    ANCESTRY_GNOMAD_DB = _load_ancestry_gnomad()
