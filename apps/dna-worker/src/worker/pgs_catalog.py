"""Loader per i file di scoring del PGS Catalog (formato HmPOS_GRCh38).

I file PGS Catalog (`PGS{id}_hmPOS_GRCh38.txt.gz`) hanno:
- linee `##` di intestazione/sezione (saltate)
- linee `#key=value` con metadata (pgs_id, pgs_name, trait_reported, ecc.)
- una riga di header con le colonne, poi righe dati TSV

Per il calcolo dello score usiamo le colonne armonizzate `hm_chr`/`hm_pos`
(GRCh38) e `effect_allele`/`effect_weight`. Quando presente, `allelefrequency_effect`
serve per stimare media e SD attese in popolazione (modello Hardy-Weinberg,
assumendo indipendenza tra SNP — sottostima la varianza in presenza di LD,
ma e' un buon punto di partenza per ottenere uno z-score interpretabile).
"""
from dataclasses import dataclass
from pathlib import Path
import gzip
import re
from typing import Iterator


@dataclass
class PgsScoreMeta:
    pgs_id: str
    name: str
    trait_reported: str
    genome_build: str
    hmpos_build: str
    variants_number: int
    citation: str


@dataclass
class PgsVariant:
    chrom: str
    pos: int
    effect_allele: str
    other_allele: str
    weight: float
    effect_freq: float | None = None  # population AF of the effect allele, if reported


_META_RE = re.compile(r"^#([a-zA-Z_][\w]*)\s*=\s*(.+?)\s*$")


def parse_pgs_header(path: Path) -> PgsScoreMeta:
    """Parse the `#key=value` metadata header of a PGS Catalog scoring file."""
    meta: dict[str, str] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("##") or line.startswith("###"):
                continue
            if not line.startswith("#"):
                break
            m = _META_RE.match(line.rstrip("\n"))
            if m:
                meta[m.group(1)] = m.group(2)
    return PgsScoreMeta(
        pgs_id=meta.get("pgs_id", path.stem.replace("_hmPOS_GRCh38", "")),
        name=meta.get("pgs_name", ""),
        trait_reported=meta.get("trait_reported", ""),
        genome_build=meta.get("genome_build", ""),
        hmpos_build=meta.get("HmPOS_build", ""),
        variants_number=int(meta.get("variants_number", "0") or "0"),
        citation=meta.get("citation", ""),
    )


def iter_pgs_variants(path: Path) -> Iterator[PgsVariant]:
    """Stream PGS Catalog scoring file as PgsVariant rows on GRCh38 coords.

    Prefers harmonized `hm_chr`/`hm_pos` columns; falls back to `chr_name`/
    `chr_position` (i.e., the original build) only if harmonized are missing.
    Skips rows with missing/non-numeric values.
    """
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header_line = None
        for line in f:
            if line.startswith("#"):
                continue
            header_line = line.rstrip("\n")
            break
        if not header_line:
            return
        cols = header_line.split("\t")
        idx = {col: i for i, col in enumerate(cols)}
        chr_col = idx.get("hm_chr", idx.get("chr_name"))
        pos_col = idx.get("hm_pos", idx.get("chr_position"))
        ea_col = idx.get("effect_allele")
        oa_col = idx.get("other_allele")
        w_col = idx.get("effect_weight")
        af_col = idx.get("allelefrequency_effect")
        if None in (chr_col, pos_col, ea_col, w_col):
            return
        for line in f:
            row = line.rstrip("\n").split("\t")
            try:
                chrom_val = row[chr_col]
                pos_val = row[pos_col]
                if not chrom_val or not pos_val:
                    continue
                chrom = str(chrom_val).replace("chr", "")
                pos = int(pos_val)
                ea = row[ea_col].upper()
                oa = (row[oa_col].upper() if oa_col is not None and oa_col < len(row) and row[oa_col] else "")
                w = float(row[w_col])
                af: float | None = None
                if af_col is not None and af_col < len(row) and row[af_col]:
                    try:
                        af = float(row[af_col])
                    except ValueError:
                        af = None
                yield PgsVariant(chrom=chrom, pos=pos, effect_allele=ea, other_allele=oa, weight=w, effect_freq=af)
            except (IndexError, ValueError):
                continue
