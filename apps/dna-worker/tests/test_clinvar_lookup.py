"""Tests for allele-specific ClinVar lookup and annotation source resolution.

These guard the fix for the rsID-only annotation bug (false positives): ClinVar
disease/carrier data must be matched on the full (chrom, pos, ref, alt) coordinate,
not on rsID alone.
"""

from src.data.clinvar_loader import lookup_clinvar, _coord_key
from src.worker.annotator import resolve_annotation_sources


CFTR_ENTRY = {
    "gene": "CFTR",
    "disease_risks": [{"disease": "Cystic fibrosis", "significance": "PATHOGENIC"}],
}


def test_lookup_matches_exact_coordinate():
    db = {"7:117559590:ATCT:A": CFTR_ENTRY}
    assert lookup_clinvar(db, "7", 117559590, "ATCT", "A") is CFTR_ENTRY


def test_lookup_normalizes_chr_prefix():
    db = {"7:117559590:ATCT:A": CFTR_ENTRY}
    assert lookup_clinvar(db, "chr7", 117559590, "ATCT", "A") is CFTR_ENTRY


def test_lookup_rejects_different_alt():
    """The core bug fix: same rsID/position but a different ALT must NOT match."""
    db = {"7:117559590:ATCT:A": CFTR_ENTRY}
    assert lookup_clinvar(db, "7", 117559590, "ATCT", "G") is None


def test_lookup_rejects_different_position():
    db = {"7:117559590:ATCT:A": CFTR_ENTRY}
    assert lookup_clinvar(db, "7", 999, "ATCT", "A") is None


def test_coord_key_strips_chr_prefix():
    assert _coord_key("chr1", 100, "A", "T") == "1:100:A:T"
    assert _coord_key("1", 100, "A", "T") == "1:100:A:T"


def test_coord_key_normalizes_mitochondrial():
    """VCFs name the contig chrM/M; ClinVar uses MT. All must collapse to MT."""
    assert _coord_key("chrM", 73, "A", "G") == "MT:73:A:G"
    assert _coord_key("M", 73, "A", "G") == "MT:73:A:G"
    assert _coord_key("MT", 73, "A", "G") == "MT:73:A:G"
    assert _coord_key("chrMT", 73, "A", "G") == "MT:73:A:G"
    assert _coord_key("mt", 73, "A", "G") == "MT:73:A:G"
    assert _coord_key("chrm", 73, "A", "G") == "MT:73:A:G"


def test_resolver_hand_curated_overrides():
    hand, clinvar, pharma = {"gene": "H"}, {"gene": "C"}, {"gene": "P"}
    assert resolve_annotation_sources(hand, clinvar, pharma) == [hand]


def test_resolver_combines_clinvar_and_pharma():
    clinvar, pharma = {"gene": "C"}, {"gene": "P"}
    assert resolve_annotation_sources(None, clinvar, pharma) == [clinvar, pharma]


def test_resolver_pharma_only():
    pharma = {"gene": "P"}
    assert resolve_annotation_sources(None, None, pharma) == [pharma]


def test_resolver_no_match():
    assert resolve_annotation_sources(None, None, None) == []
