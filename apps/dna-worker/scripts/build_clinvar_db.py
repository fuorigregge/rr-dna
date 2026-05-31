#!/usr/bin/env python3
"""
Build-time ETL: downloads ClinVar variant_summary.txt.gz, filters and compresses
into compact JSON lookup databases.

Outputs:
  - src/data/clinvar_db.json.gz   → ClinVar disease/carrier keyed by "chrom:pos:ref:alt"
                                     (allele-specific, avoids rsID-only false positives)
  - src/data/pharmgkb_db.json.gz  → PharmGKB pharmacogenomics keyed by rsID
  - src/data/clinvar_coords.json.gz → "chr:pos:ref:alt" -> rsID map (for VCF rsID resolution)
No external dependencies — uses only Python stdlib.
"""

import csv
import gzip
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

CLINVAR_URL = os.environ.get(
    "CLINVAR_URL",
    "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz",
)
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "clinvar_db.json.gz"
PHARMGKB_OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "pharmgkb_db.json.gz"
COORDS_PATH = Path(__file__).parent.parent / "src" / "data" / "clinvar_coords.json.gz"
DOWNLOAD_PATH = Path("/tmp/variant_summary.txt.gz")

SIGNIFICANCE_MAP = {
    "pathogenic": "PATHOGENIC",
    "likely pathogenic": "LIKELY_PATHOGENIC",
    "uncertain significance": "UNCERTAIN",
    "likely benign": "LIKELY_BENIGN",
    "benign": "BENIGN",
    "conflicting classifications of pathogenicity": "UNCERTAIN",
    "conflicting interpretations of pathogenicity": "UNCERTAIN",
}

# Used only by map_significance() to pick the most severe of a compound value
# (e.g. "Pathogenic/Likely pathogenic"). No longer used for cross-rsID dedup.
SEVERITY_ORDER = ["PATHOGENIC", "LIKELY_PATHOGENIC", "UNCERTAIN", "LIKELY_BENIGN", "BENIGN"]
SEVERITY_RANK = {s: i for i, s in enumerate(SEVERITY_ORDER)}

SKIP_PHENOTYPES = {
    "not specified", "not provided", "see cases", "",
    # Non-disease placeholders ClinVar puts in PhenotypeList — must not become a "disease".
    "variant of unknown significance", "association", "other", "none provided", "none",
}


def normalize_gene(raw: str | None) -> str | None:
    """Clean ClinVar's GeneSymbol: '-' means no gene, ';' separates multiple genes.

    Returns the first real gene symbol, or None. Avoids names like '--related
    condition' (gene '-') and 'A;B-related condition' (multi-gene) in the fallback.
    """
    if not raw:
        return None
    for part in raw.split(";"):
        g = part.strip()
        if g and g != "-":
            return g
    return None


def review_stars(review_status: str | None) -> int:
    """Map ClinVar ReviewStatus to its 0-4 star rating.

    Lets consumers cross significance with confidence: a PATHOGENIC call at 0 stars
    ('no assertion criteria provided') is a likely false alarm, not a diagnosis.
    """
    s = (review_status or "").strip().lower()
    if not s or "no assertion" in s or "no classification" in s:
        return 0
    if "practice guideline" in s:
        return 4
    if "expert panel" in s:
        return 3
    if "multiple submitters" in s and "no conflict" in s:
        return 2
    if "conflicting" in s:
        return 1
    if "criteria provided" in s:
        return 1
    return 0


def map_significance(raw: str) -> str | None:
    """Map ClinVar significance string to our enum. Returns None if unmappable."""
    raw_lower = raw.strip().lower()
    if raw_lower in SIGNIFICANCE_MAP:
        return SIGNIFICANCE_MAP[raw_lower]
    # Handle compound values like "Pathogenic/Likely pathogenic"
    parts = [p.strip().lower() for p in raw_lower.replace(",", "/").split("/")]
    mapped = [SIGNIFICANCE_MAP[p] for p in parts if p in SIGNIFICANCE_MAP]
    if not mapped:
        return None
    # Return the most severe
    return min(mapped, key=lambda s: SEVERITY_RANK.get(s, 99))


_PHENOTYPE_SEP = re.compile(r"[;|]")
_N_CONDITIONS = re.compile(r"^\d+\s+conditions?$")


def _is_skippable_phenotype(p: str) -> bool:
    pl = p.lower()
    return pl in SKIP_PHENOTYPES or bool(_N_CONDITIONS.match(pl))


def clean_phenotype(phenotype: str, gene: str | None) -> str:
    """Clean ClinVar phenotype string. Falls back to gene-based name.

    ClinVar joins multiple phenotypes with either ';' or '|'; we split on both and
    take the first real condition, skipping placeholders ('not provided', 'N
    conditions', etc.) that would otherwise become bogus disease names.
    """
    parts = [p.strip() for p in _PHENOTYPE_SEP.split(phenotype)]
    cleaned = [p for p in parts if not _is_skippable_phenotype(p)]
    if cleaned:
        return cleaned[0]
    return f"{gene}-related condition" if gene else "Unspecified condition"


def download_clinvar():
    """Download variant_summary.txt.gz if not already present."""
    if DOWNLOAD_PATH.exists():
        size_mb = DOWNLOAD_PATH.stat().st_size / (1024 * 1024)
        print(f"Using cached download: {DOWNLOAD_PATH} ({size_mb:.1f}MB)")
        return

    print(f"Downloading ClinVar from {CLINVAR_URL}...")

    def progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            pct = min(100, downloaded * 100 // total_size)
            mb = downloaded / (1024 * 1024)
            print(f"\r  {mb:.1f}MB ({pct}%)", end="", flush=True)

    urllib.request.urlretrieve(CLINVAR_URL, DOWNLOAD_PATH, reporthook=progress)
    print()
    size_mb = DOWNLOAD_PATH.stat().st_size / (1024 * 1024)
    print(f"Downloaded: {size_mb:.1f}MB")


def coord_key(chrom: str, pos: str, ref: str, alt: str) -> str:
    """Build the coordinate key used to index ClinVar entries. Chrom is stored bare
    (no 'chr' prefix), matching clinvar_loader._coord_key normalization. ClinVar's
    Chromosome column already uses 'MT' for mitochondria."""
    return f"{chrom}:{pos}:{ref}:{alt}"


def valid_vcf_coords(chrom: str, pos: str, ref: str, alt: str) -> bool:
    """True only if the row carries a real VCF placement. ClinVar uses '-1' for
    PositionVCF and 'na' for the allele columns when a variant has no genomic
    coordinate; those rows can never match a user variant and must be skipped."""
    if not (chrom and pos and ref and alt):
        return False
    if pos == "-1":
        return False
    if ref.lower() == "na" or alt.lower() == "na":
        return False
    return True


def add_clinvar_entry(db: dict, key: str, gene: str | None, disease_entry: dict, carrier_entry: dict | None) -> dict:
    """Merge a ClinVar classification into the coordinate-keyed db.

    Unlike the old rsID-keyed builder, this keeps every distinct classification: variants
    that share an rsID but differ in ALT land under different keys. Within a single
    coordinate, identical disease+significance (and carrier condition) pairs are deduped.
    """
    record = db.get(key)
    if record is None:
        record = {"gene": gene, "disease_risks": []}
        db[key] = record

    if not any(
        d["disease"] == disease_entry["disease"] and d["significance"] == disease_entry["significance"]
        for d in record["disease_risks"]
    ):
        record["disease_risks"].append(disease_entry)

    if carrier_entry:
        record.setdefault("carrier_status", [])
        if not any(c["condition"] == carrier_entry["condition"] for c in record["carrier_status"]):
            record["carrier_status"].append(carrier_entry)

    return record


def process_clinvar():
    """Stream ClinVar TSV and build coordinate-keyed lookup dict + coordinate-to-rsID mapping."""
    db: dict[str, dict] = {}
    coords: dict[str, str] = {}  # "chr:pos:ref:alt" -> "rs12345"
    stats = {"total": 0, "filtered": 0, "no_rsid": 0, "no_sig": 0, "wrong_assembly": 0, "no_coords": 0, "coords": 0}

    with gzip.open(DOWNLOAD_PATH, "rt", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter="\t")

        for row in reader:
            stats["total"] += 1
            if stats["total"] % 500_000 == 0:
                print(f"  Processed {stats['total']:,} rows, {len(db):,} coord entries, {len(coords):,} coords...")

            # Filter: GRCh38 only
            if row.get("Assembly") != "GRCh38":
                stats["wrong_assembly"] += 1
                continue

            # Filter: valid rsID
            rs_raw = row.get("RS# (dbSNP)", "-1").strip()
            if rs_raw == "-1" or not rs_raw.isdigit():
                stats["no_rsid"] += 1
                continue

            rs_id = f"rs{rs_raw}"

            # Build coordinate key for rsID lookup (chr:pos:ref:alt)
            chrom = row.get("Chromosome", "").strip()
            pos = row.get("PositionVCF", "").strip()
            ref = row.get("ReferenceAlleleVCF", "").strip()
            alt = row.get("AlternateAlleleVCF", "").strip()
            if valid_vcf_coords(chrom, pos, ref, alt):
                # Store both with and without chr prefix
                bare_key = f"{chrom}:{pos}:{ref}:{alt}"
                chr_key = f"chr{chrom}:{pos}:{ref}:{alt}"
                if bare_key not in coords:
                    coords[bare_key] = rs_id
                    coords[chr_key] = rs_id
                    stats["coords"] += 1

            # Filter: known significance
            significance = map_significance(row.get("ClinicalSignificance", ""))
            if not significance:
                stats["no_sig"] += 1
                continue

            gene = normalize_gene(row.get("GeneSymbol", ""))
            phenotype = clean_phenotype(row.get("PhenotypeList", ""), gene)
            evidence_level = row.get("ReviewStatus", "").strip() or None
            stars = review_stars(evidence_level)
            variation_id = row.get("VariationID", "").strip()

            # Build metadata
            metadata: dict = {
                "description": f"ClinVar: {phenotype} associato a {gene or 'unknown gene'} ({significance})",
                "stars": stars,
                "links": {},
            }
            if variation_id:
                metadata["links"]["ClinVar"] = f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{variation_id}/"
            metadata["links"]["dbSNP"] = f"https://www.ncbi.nlm.nih.gov/snp/{rs_id}"

            entry = {
                "disease": phenotype,
                "significance": significance,
                "source": "ClinVar",
                "evidence_level": evidence_level,
                "metadata": metadata,
            }

            # Build carrier status for pathogenic/likely pathogenic variants
            carrier_entry = None
            if significance in ("PATHOGENIC", "LIKELY_PATHOGENIC") and gene:
                origin = row.get("OriginSimple", "").strip().lower()
                if origin != "somatic":  # Only germline variants are relevant for carrier
                    carrier_entry = {
                        "condition": phenotype,
                        "inheritance_pattern": None,
                        "carrier_type": "at risk" if significance == "PATHOGENIC" else "uncertain",
                        "source": "ClinVar",
                        "metadata": {
                            "description": f"Variante {significance.lower().replace('_', ' ')} nel gene {gene} associata a {phenotype}.",
                            "stars": stars,
                            "links": metadata["links"],
                        },
                    }

            # Allele-specific coordinate key. Skip rows lacking a real VCF placement
            # ('-1'/'na' placeholders) — they cannot be matched to a user variant anyway.
            if not valid_vcf_coords(chrom, pos, ref, alt):
                stats["no_coords"] += 1
                continue
            add_clinvar_entry(db, coord_key(chrom, pos, ref, alt), gene, entry, carrier_entry)
            stats["filtered"] += 1

    return db, coords, stats


PHARMGKB_PATH = Path(__file__).parent.parent / "src" / "data" / "pharmgkb_annotations.tsv"

# --- Trait categorization ---
TRAIT_KEYWORDS: dict[str, list[str]] = {
    "METABOLISM": [
        "metabolism", "caffeine", "lactose", "alcohol", "acetylat", "glucos",
        "insulin", "lipid", "cholesterol", "vitamin", "folate", "iron",
        "drug metabolism", "pharmacokinetic", "metabolizer", "cyp",
        "diet", "nutrient", "obesity", "body mass", "bmi", "weight",
    ],
    "PHYSICAL": [
        "height", "blood pressure", "hypertension", "cardiovascular", "heart",
        "muscle", "bone", "skin", "hair", "eye color", "pigment",
        "athletic", "endurance", "sprint", "strength", "lung", "asthma",
        "immune", "inflammation", "aging", "longevity", "wound", "pain",
        "hearing", "vision", "myopia", "sleep", "circadian",
    ],
    "COGNITIVE": [
        "intelligence", "memory", "cogniti", "brain", "neuro", "anxiety",
        "depression", "schizophren", "bipolar", "adhd", "autism",
        "dopamine", "serotonin", "reward", "addiction", "stress",
        "learning", "attention",
    ],
}

# Phenotypes to SKIP (real diseases, not traits)
DISEASE_KEYWORDS = [
    "cancer", "carcinoma", "tumor", "leukemia", "lymphoma", "melanoma",
    "syndrome", "disease", "disorder", "deficiency", "dystrophy",
    "infection", "anemia", "fibrosis", "sclerosis", "failure",
    "not specified", "not provided",
]


def categorize_trait(phenotype: str) -> str | None:
    """Return METABOLISM/PHYSICAL/COGNITIVE if phenotype looks like a trait, None otherwise."""
    lower = phenotype.lower()
    # Skip obvious diseases
    if any(kw in lower for kw in DISEASE_KEYWORDS):
        return None
    for category, keywords in TRAIT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return category
    return None

CATEGORY_TO_EFFECT = {
    "Efficacy": "Efficacia alterata",
    "Toxicity": "Rischio tossicita'",
    "Metabolism/PK": "Metabolismo alterato",
    "Dosage": "Dosaggio da aggiustare",
    "Other": "Interazione nota",
}


def process_pharmgkb() -> tuple[dict, int]:
    """Build a standalone rsID-keyed PharmGKB pharmacogenomics db.

    Kept separate from the coordinate-keyed ClinVar db because PharmGKB indexes by
    rsID/haplotype, not by VCF allele. Returns (pharma_db, entry_count).
    """
    db: dict[str, dict] = {}
    if not PHARMGKB_PATH.exists():
        print(f"  PharmGKB file not found at {PHARMGKB_PATH}, skipping")
        return db, 0

    count = 0
    with open(PHARMGKB_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            rs_id = row.get("Variant/Haplotypes", "").strip()
            if not rs_id.startswith("rs"):
                continue

            drugs_raw = row.get("Drug(s)", "").strip()
            if not drugs_raw:
                continue

            gene = row.get("Gene", "").strip() or None
            level = row.get("Level of Evidence", "").strip()
            category = row.get("Phenotype Category", "").strip()
            url = row.get("URL", "").strip()
            phenotypes = row.get("Phenotype(s)", "").strip()

            effect = CATEGORY_TO_EFFECT.get(category, "Interazione nota")
            if phenotypes:
                effect = f"{effect} - {phenotypes}"

            # Split multiple drugs
            drugs = [d.strip() for d in drugs_raw.split(";") if d.strip()]

            for drug in drugs:
                pharma_entry = {
                    "drug": drug,
                    "effect": effect,
                    "metabolizer_status": None,
                    "source": "PharmGKB",
                    "evidence_level": level or None,
                    "metadata": {
                        "description": f"PharmGKB: {drug} - {effect} (gene {gene or 'unknown'}, evidenza livello {level})",
                        "links": {},
                    },
                }
                if url:
                    pharma_entry["metadata"]["links"]["PharmGKB"] = url
                pharma_entry["metadata"]["links"]["dbSNP"] = f"https://www.ncbi.nlm.nih.gov/snp/{rs_id}"

                # Add to db
                if rs_id not in db:
                    db[rs_id] = {"gene": gene, "disease_risks": []}
                if "pharmacogenomics" not in db[rs_id]:
                    db[rs_id]["pharmacogenomics"] = []
                # Update gene if missing
                if not db[rs_id].get("gene") and gene:
                    db[rs_id]["gene"] = gene
                db[rs_id]["pharmacogenomics"].append(pharma_entry)
                count += 1

    return db, count


def extract_traits_from_clinvar(db: dict) -> int:
    """Extract phenotype traits from ClinVar entries with BENIGN/UNCERTAIN significance."""
    count = 0
    for key, entry in list(db.items()):
        gene = entry.get("gene", "unknown")
        for dr in entry.get("disease_risks", []):
            sig = dr.get("significance", "")
            if sig not in ("BENIGN", "LIKELY_BENIGN", "UNCERTAIN"):
                continue

            phenotype = dr.get("disease", "")
            category = categorize_trait(phenotype)
            if not category:
                continue

            trait_entry = {
                "trait": phenotype,
                "effect": f"Variante {sig.lower().replace('_', ' ')} nel gene {gene}",
                "category": category,
                "source": "ClinVar",
                "metadata": {
                    "description": f"Tratto fenotipico derivato da ClinVar: {phenotype} (gene {gene})",
                    "links": dr.get("metadata", {}).get("links", {}),
                },
            }

            entry.setdefault("phenotype_traits", [])
            entry["phenotype_traits"].append(trait_entry)
            count += 1

    return count


def extract_traits_from_pharmgkb(db: dict) -> int:
    """Extract METABOLISM traits from PharmGKB entries."""
    count = 0
    for rs_id, entry in list(db.items()):
        for pharma in entry.get("pharmacogenomics", []):
            effect = (pharma.get("effect") or "").lower()
            if "metabolismo" in effect or "metabolism" in effect or "metaboli" in effect:
                drug = pharma.get("drug", "")
                gene = entry.get("gene", "unknown")
                trait_entry = {
                    "trait": f"Metabolismo di {drug}",
                    "effect": pharma.get("effect"),
                    "category": "METABOLISM",
                    "source": "PharmGKB",
                    "metadata": {
                        "description": f"Tratto metabolico: risposta alterata al farmaco {drug} (gene {gene})",
                        "links": pharma.get("metadata", {}).get("links", {}),
                    },
                }

                if "phenotype_traits" not in entry:
                    entry["phenotype_traits"] = []
                # Avoid duplicates
                existing = {t["trait"] for t in entry["phenotype_traits"]}
                if trait_entry["trait"] not in existing:
                    entry["phenotype_traits"].append(trait_entry)
                    count += 1

    return count


def main():
    print("=== ClinVar Database Builder ===\n")

    download_clinvar()

    print("\nProcessing ClinVar data...")
    db, coords, stats = process_clinvar()

    print(f"\n--- Stats ---")
    print(f"  Total rows:        {stats['total']:,}")
    print(f"  Wrong assembly:    {stats['wrong_assembly']:,}")
    print(f"  No rsID:           {stats['no_rsid']:,}")
    print(f"  No significance:   {stats['no_sig']:,}")
    print(f"  No coordinates:    {stats['no_coords']:,}")
    print(f"  Coordinate entries:{len(db):,}")
    print(f"  rsID coords map:   {stats['coords']:,}")

    print("\nProcessing PharmGKB data...")
    pharma_db, pharma_count = process_pharmgkb()
    print(f"  PharmGKB entries: {pharma_count:,} ({len(pharma_db):,} unique rsIDs)")

    print("\nExtracting phenotype traits...")
    clinvar_traits = extract_traits_from_clinvar(db)
    pharmgkb_traits = extract_traits_from_pharmgkb(pharma_db)
    print(f"  ClinVar traits: {clinvar_traits:,}")
    print(f"  PharmGKB traits: {pharmgkb_traits:,}")
    print(f"  Total traits: {clinvar_traits + pharmgkb_traits:,}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    print(f"\nWriting {OUTPUT_PATH}...")
    with gzip.open(OUTPUT_PATH, "wt", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    print(f"  ClinVar DB (coord-keyed): {size_mb:.1f}MB compressed")

    print(f"Writing {PHARMGKB_OUTPUT_PATH}...")
    with gzip.open(PHARMGKB_OUTPUT_PATH, "wt", encoding="utf-8") as f:
        json.dump(pharma_db, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = PHARMGKB_OUTPUT_PATH.stat().st_size / (1024 * 1024)
    print(f"  PharmGKB DB (rsID-keyed): {size_mb:.1f}MB compressed")

    print(f"Writing {COORDS_PATH}...")
    with gzip.open(COORDS_PATH, "wt", encoding="utf-8") as f:
        json.dump(coords, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = COORDS_PATH.stat().st_size / (1024 * 1024)
    print(f"  Coords DB: {size_mb:.1f}MB compressed")

    print("\nDone!")


if __name__ == "__main__":
    main()
