from src.worker.trait_panel import (
    TRAIT_PANEL,
    PANEL_BY_CHROM,
    record_covers,
    classify_covering,
    resolve_interpretation,
    apoe_diplotype,
)


def _entry(rs_id):
    return next(e for e in TRAIT_PANEL if e["rs_id"] == rs_id)


def test_eye_color_heterozygous_is_not_blue():
    # rs12913832 A/G eterozigote: il testo NON deve far pensare agli occhi azzurri
    eye = _entry("rs12913832")
    het = resolve_interpretation(eye, "CARRIED", "HETEROZYGOUS")
    assert "eterozigote" in het.lower()
    assert "non basta" in het.lower() or "non e'" in het.lower()
    hom = resolve_interpretation(eye, "CARRIED", "HOMOZYGOUS")
    assert "azzurri" in hom.lower()
    assert het != hom


def test_resolve_falls_back_to_carried_when_no_zygosity_variant():
    # un tratto senza CARRIED_HET/HOM usa il testo CARRIED standard a prescindere
    caf = _entry("rs762551")  # CYP1A2, solo CARRIED
    assert resolve_interpretation(caf, "CARRIED", "HETEROZYGOUS") == caf["interpretation"]["CARRIED"]
    assert resolve_interpretation(caf, "REFERENCE", None) == caf["interpretation"]["REFERENCE"]


def test_apoe_e3e3_reference():
    assert apoe_diplotype([0, 0], [0, 0]) == "ε3/ε3"


def test_apoe_e4_alleles():
    assert apoe_diplotype([0, 1], [0, 0]) == "ε3/ε4"
    assert apoe_diplotype([1, 1], [0, 0]) == "ε4/ε4"


def test_apoe_e2_alleles():
    assert apoe_diplotype([0, 0], [0, 1]) == "ε2/ε3"
    assert apoe_diplotype([0, 0], [1, 1]) == "ε2/ε2"


def test_apoe_e2e4_compound():
    assert apoe_diplotype([0, 1], [0, 1]) == "ε2/ε4"


def test_apoe_nocall_returns_none():
    assert apoe_diplotype([-1, -1], [0, 0]) is None
    assert apoe_diplotype([0, 0], [-1, -1]) is None


def test_apoe_impossible_combo_returns_none():
    # two ε4 (C/C) cannot co-occur with an ε2 (T) without the ~nonexistent ε1
    assert apoe_diplotype([1, 1], [0, 1]) is None


def test_record_covers_variant_exact_pos():
    assert record_covers(100, 100, 100) is True
    assert record_covers(101, 100, 100) is False


def test_record_covers_refblock_range():
    assert record_covers(105, 100, 110) is True
    assert record_covers(100, 100, 110) is True
    assert record_covers(110, 100, 110) is True
    assert record_covers(120, 100, 110) is False
    assert record_covers(99, 100, 110) is False


def test_classify_carried_when_alt_present():
    assert classify_covering(True, [0, 1]) == "CARRIED"
    assert classify_covering(True, [1, 1]) == "CARRIED"


def test_classify_reference_when_homref_block():
    assert classify_covering(False, [0, 0]) == "REFERENCE"
    assert classify_covering(False, [0]) == "REFERENCE"  # haploid reference


def test_classify_not_covered_when_nocall():
    assert classify_covering(False, [-1, -1]) == "NOT_COVERED"
    assert classify_covering(False, []) == "NOT_COVERED"


def test_panel_entries_wellformed():
    seen_rsids = set()
    for e in TRAIT_PANEL:
        assert e["rs_id"].startswith("rs")
        assert e["rs_id"] not in seen_rsids, f"duplicate {e['rs_id']}"
        seen_rsids.add(e["rs_id"])
        assert e["chrom"] and isinstance(e["pos"], int) and e["pos"] > 0
        assert e["trait"] and e["gene"]
        assert e["category"] in ("METABOLISM", "PHYSICAL", "COGNITIVE", "APPEARANCE")
        # every panel entry must explain all three states
        for state in ("REFERENCE", "CARRIED", "NOT_COVERED"):
            assert state in e["interpretation"] and e["interpretation"][state]


def test_panel_index_groups_by_chrom():
    # PANEL_BY_CHROM must contain every panel entry, keyed by its chromosome
    total = sum(len(v) for v in PANEL_BY_CHROM.values())
    assert total == len(TRAIT_PANEL)
    for e in TRAIT_PANEL:
        assert e in PANEL_BY_CHROM[e["chrom"]]
