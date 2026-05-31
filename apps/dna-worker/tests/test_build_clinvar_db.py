"""Tests for the coordinate-keyed ClinVar build logic.

Guards against the build-time severity dedup bug: two ClinVar classifications that
share an rsID but differ in ALT must be kept as two distinct coordinate entries,
not collapsed to the most severe one.
"""

import importlib.util
from pathlib import Path

_SCRIPT = Path(__file__).parent.parent / "scripts" / "build_clinvar_db.py"
_spec = importlib.util.spec_from_file_location("build_clinvar_db", _SCRIPT)
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)


def test_coord_key_format():
    assert build.coord_key("13", 32340301, "G", "A") == "13:32340301:G:A"


def test_valid_vcf_coords_rejects_placeholders():
    """ClinVar rows without a genomic placement use '-1'/'na' — must be rejected."""
    assert build.valid_vcf_coords("1", "100", "A", "T") is True
    assert build.valid_vcf_coords("22", "-1", "na", "na") is False
    assert build.valid_vcf_coords("1", "100", "na", "T") is False
    assert build.valid_vcf_coords("1", "100", "A", "") is False
    assert build.valid_vcf_coords("", "100", "A", "T") is False


def test_mitochondrial_builder_loader_contract():
    """The builder stores 'MT' (ClinVar's contig name); the loader must map a
    VCF-style chrM/M input onto that same key. Guards against drift between the two."""
    from src.data.clinvar_loader import _coord_key
    builder_key = build.coord_key("MT", 73, "A", "G")
    assert _coord_key("chrM", 73, "A", "G") == builder_key
    assert _coord_key("M", 73, "A", "G") == builder_key


def test_different_alt_kept_separately():
    """Same position, different ALT, opposite significance — both must survive."""
    db = {}
    build.add_clinvar_entry(
        db, build.coord_key("13", 32340301, "G", "A"), "BRCA2",
        {"disease": "Hereditary cancer", "significance": "PATHOGENIC"}, None,
    )
    build.add_clinvar_entry(
        db, build.coord_key("13", 32340301, "G", "C"), "BRCA2",
        {"disease": "Benign variant", "significance": "BENIGN"}, None,
    )
    assert db["13:32340301:G:A"]["disease_risks"][0]["significance"] == "PATHOGENIC"
    assert db["13:32340301:G:C"]["disease_risks"][0]["significance"] == "BENIGN"


def test_identical_classification_deduped():
    db = {}
    key = build.coord_key("1", 100, "A", "T")
    entry = {"disease": "Condition X", "significance": "PATHOGENIC"}
    build.add_clinvar_entry(db, key, "GENE1", entry, None)
    build.add_clinvar_entry(db, key, "GENE1", dict(entry), None)
    assert len(db[key]["disease_risks"]) == 1


def test_distinct_disease_same_coordinate_appended():
    db = {}
    key = build.coord_key("1", 100, "A", "T")
    build.add_clinvar_entry(db, key, "GENE1", {"disease": "X", "significance": "PATHOGENIC"}, None)
    build.add_clinvar_entry(db, key, "GENE1", {"disease": "Y", "significance": "BENIGN"}, None)
    assert len(db[key]["disease_risks"]) == 2


def test_normalize_gene_strips_placeholders():
    assert build.normalize_gene("TP53") == "TP53"
    assert build.normalize_gene("") is None
    assert build.normalize_gene(None) is None
    assert build.normalize_gene("-") is None          # ClinVar no-gene placeholder
    assert build.normalize_gene("  -  ") is None


def test_normalize_gene_multi_gene_takes_first_real():
    assert build.normalize_gene("MFF-DT;COL4A3") == "MFF-DT"   # ';' separates genes; '-' inside a name is fine
    assert build.normalize_gene("-;COL4A3") == "COL4A3"        # skip leading placeholder


def test_clean_phenotype_uses_real_condition():
    assert build.clean_phenotype("Li-Fraumeni syndrome", "TP53") == "Li-Fraumeni syndrome"


def test_clean_phenotype_skips_junk_placeholders():
    # 'Variant of unknown significance' is not a disease — must fall back, not be kept
    assert build.clean_phenotype("Variant of unknown significance", "BANK1") == "BANK1-related condition"
    assert build.clean_phenotype("not provided", "BANK1") == "BANK1-related condition"


def test_clean_phenotype_fallback_without_gene_is_unspecified():
    # gene already normalized to None -> no '--related condition'
    assert build.clean_phenotype("not provided", None) == "Unspecified condition"


def test_clean_phenotype_splits_on_pipe():
    # ClinVar also joins phenotypes with '|', not only ';'
    assert build.clean_phenotype(
        "21-Hydroxylase-Deficient Congenital Adrenal Hyperplasia|not provided", "CYP21A2"
    ) == "21-Hydroxylase-Deficient Congenital Adrenal Hyperplasia"


def test_clean_phenotype_pipe_skips_leading_junk():
    assert build.clean_phenotype("not provided|not specified|Optic atrophy 3", "OPA1") == "Optic atrophy 3"


def test_clean_phenotype_skips_n_conditions_placeholder():
    # 'N conditions' is a ClinVar aggregation count, not a disease
    assert build.clean_phenotype("12 conditions|Neoplasm", "TP53") == "Neoplasm"


def test_review_stars_mapping():
    assert build.review_stars("practice guideline") == 4
    assert build.review_stars("reviewed by expert panel") == 3
    assert build.review_stars("criteria provided, multiple submitters, no conflicts") == 2
    assert build.review_stars("criteria provided, conflicting classifications") == 1
    assert build.review_stars("criteria provided, single submitter") == 1
    assert build.review_stars("no assertion criteria provided") == 0
    assert build.review_stars(None) == 0
    assert build.review_stars("") == 0


def test_carrier_status_attached_and_deduped():
    db = {}
    key = build.coord_key("7", 117559590, "ATCT", "A")
    carrier = {"condition": "Cystic fibrosis", "carrier_type": "at risk"}
    build.add_clinvar_entry(db, key, "CFTR", {"disease": "CF", "significance": "PATHOGENIC"}, carrier)
    build.add_clinvar_entry(db, key, "CFTR", {"disease": "CF", "significance": "PATHOGENIC"}, dict(carrier))
    assert len(db[key]["carrier_status"]) == 1
