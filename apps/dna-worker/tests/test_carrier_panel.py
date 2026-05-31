from src.worker.carrier_panel import (
    CARRIER_PANEL,
    CARRIER_BY_CHROM,
    STATE_RANK,
    classify_carrier,
)


def test_panel_wellformed():
    seen = set()
    for e in CARRIER_PANEL:
        assert e["rs_id"].startswith("rs")
        assert e["rs_id"] not in seen
        seen.add(e["rs_id"])
        assert e["gene"] and e["condition"] and e["variant_name"]
        assert e["chrom"] and isinstance(e["pos"], int) and e["pos"] > 0
        assert e["ref"] and e["alt"]
        for st in ("CLEAR", "CARRIER", "AFFECTED", "NOT_COVERED"):
            assert st in e["interpretation"]


def test_by_chrom_index_covers_every_entry():
    flat = [e for entries in CARRIER_BY_CHROM.values() for e in entries]
    assert len(flat) == len(CARRIER_PANEL)


def test_state_rank_order():
    assert STATE_RANK["AFFECTED"] > STATE_RANK["CARRIER"] > STATE_RANK["CLEAR"] > STATE_RANK["NOT_COVERED"]


def test_clear_reference_block():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", [], [0, 0]) == ("CLEAR", None)


def test_carrier_heterozygous():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", ["T"], [0, 1]) == ("CARRIER", 1)


def test_affected_homozygous():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", ["T"], [1, 1]) == ("AFFECTED", 1)


def test_clear_when_variant_at_site_but_not_pathogenic_allele():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", ["G"], [0, 1]) == ("CLEAR", None)


def test_not_covered_missing():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", [], [-1, -1]) == ("NOT_COVERED", None)


def test_xlinked_male_hemizygous_variant_is_affected():
    # haploid genotype (single allele) carrying the pathogenic allele -> hemizygous affected
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", ["T"], [1]) == ("AFFECTED", 1)


def test_xlinked_male_hemizygous_reference_is_clear():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", [], [0]) == ("CLEAR", None)


def test_multiallelic_carrier_of_pathogenic_allele():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", ["A", "T"], [0, 2]) == ("CARRIER", 2)


def test_multiallelic_other_allele_is_clear():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    assert classify_carrier(e, 100, "C", ["A", "T"], [0, 1]) == ("CLEAR", None)
