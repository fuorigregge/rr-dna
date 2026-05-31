from src.worker.acmg_panel import (
    ACMG_PANEL,
    ACMG_BY_CHROM,
    STATE_RANK,
    classify_acmg,
)


def _entry(rs_id):
    return next(e for e in ACMG_PANEL if e["rs_id"] == rs_id)


def test_panel_wellformed():
    seen = set()
    for e in ACMG_PANEL:
        assert e["rs_id"].startswith("rs")
        assert e["rs_id"] not in seen
        seen.add(e["rs_id"])
        assert e["gene"] and e["condition"] and e["variant_name"]
        assert e["chrom"] and isinstance(e["pos"], int) and e["pos"] > 0
        assert e["ref"] and e["alt"]
        # every site must explain both the positive and the reassuring-negative result
        assert "CARRIED" in e["interpretation"]
        assert "NOT_CARRIED" in e["interpretation"]
        assert "NOT_COVERED" in e["interpretation"]


def test_by_chrom_index_covers_every_entry():
    flat = [e for entries in ACMG_BY_CHROM.values() for e in entries]
    assert len(flat) == len(ACMG_PANEL)
    for e in ACMG_PANEL:
        assert e in ACMG_BY_CHROM[e["chrom"]]


def test_state_rank_carried_beats_not_carried_beats_not_covered():
    assert STATE_RANK["CARRIED"] > STATE_RANK["NOT_CARRIED"] > STATE_RANK["NOT_COVERED"]


def test_carried_heterozygous_snp():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    state, idx = classify_acmg(e, 100, "C", ["T"], [0, 1])
    assert state == "CARRIED" and idx == 1


def test_carried_homozygous_snp():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    state, idx = classify_acmg(e, 100, "C", ["T"], [1, 1])
    assert state == "CARRIED" and idx == 1


def test_not_carried_reference_block():
    # a covering gVCF reference block (no ALT) with a real 0/0 call
    e = {"pos": 100, "ref": "C", "alt": "T"}
    state, idx = classify_acmg(e, 100, "C", [], [0, 0])
    assert state == "NOT_CARRIED" and idx is None


def test_not_carried_other_allele_at_site():
    # a variant exists at the site but it is NOT the pathogenic allele
    e = {"pos": 100, "ref": "C", "alt": "T"}
    state, idx = classify_acmg(e, 100, "C", ["G"], [0, 1])
    assert state == "NOT_CARRIED" and idx is None


def test_not_covered_missing_genotype():
    e = {"pos": 100, "ref": "C", "alt": "T"}
    state, idx = classify_acmg(e, 100, "C", [], [-1, -1])
    assert state == "NOT_COVERED" and idx is None


def test_carried_indel_exact_match():
    # BRCA2 6174delT style deletion GT>G
    e = {"pos": 32340300, "ref": "GT", "alt": "G"}
    state, idx = classify_acmg(e, 32340300, "GT", ["G"], [0, 1])
    assert state == "CARRIED" and idx == 1


def test_multiallelic_carries_pathogenic_allele():
    # pathogenic allele is index 2; sample is 0/2 -> CARRIED
    e = {"pos": 100, "ref": "C", "alt": "T"}
    state, idx = classify_acmg(e, 100, "C", ["A", "T"], [0, 2])
    assert state == "CARRIED" and idx == 2


def test_multiallelic_carries_other_allele_only():
    # pathogenic allele index 2 present in ALT list, but sample carries index 1 -> NOT_CARRIED
    e = {"pos": 100, "ref": "C", "alt": "T"}
    state, idx = classify_acmg(e, 100, "C", ["A", "T"], [0, 1])
    assert state == "NOT_CARRIED" and idx is None
