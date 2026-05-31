from src.worker.call_confidence import assess_confidence


def test_clean_het_not_flagged():
    # balanced heterozygote ~50%
    vaf, low = assess_confidence(ref_depth=20, alt_depth=20, dp=40, expect_high=False)
    assert vaf == 0.5 and low is False


def test_low_vaf_het_flagged():
    # eterozigote con VAF molto bassa (~17%, 30 ref / 6 alt) -> chiamata dubbia
    vaf, low = assess_confidence(ref_depth=30, alt_depth=6, dp=36, expect_high=False)
    assert abs(vaf - 0.1667) < 0.001 and low is True


def test_high_vaf_het_flagged():
    # heterozygote call but ~90% alt -> imbalance -> flagged
    vaf, low = assess_confidence(ref_depth=4, alt_depth=36, dp=40, expect_high=False)
    assert low is True


def test_het_at_boundary_25_not_flagged():
    # exactly 25% is the threshold (flag only strictly below)
    vaf, low = assess_confidence(ref_depth=30, alt_depth=10, dp=40, expect_high=False)
    assert vaf == 0.25 and low is False


def test_clean_hom_not_flagged():
    vaf, low = assess_confidence(ref_depth=0, alt_depth=40, dp=40, expect_high=True)
    assert vaf == 1.0 and low is False


def test_low_vaf_hom_flagged():
    # homozygous-alt call but only 75% alt -> below 85% -> flagged
    vaf, low = assess_confidence(ref_depth=10, alt_depth=30, dp=40, expect_high=True)
    assert vaf == 0.75 and low is True


def test_low_depth_flagged_regardless():
    # DP < 10 -> low confidence even with balanced VAF
    vaf, low = assess_confidence(ref_depth=4, alt_depth=4, dp=8, expect_high=False)
    assert low is True


def test_depth_at_boundary_10_not_flagged_when_balanced():
    vaf, low = assess_confidence(ref_depth=5, alt_depth=5, dp=10, expect_high=False)
    assert low is False


def test_missing_ad_uses_depth_only():
    # no allele depths -> vaf unknown; with adequate DP -> not flagged
    vaf, low = assess_confidence(ref_depth=None, alt_depth=None, dp=40, expect_high=False)
    assert vaf is None and low is False


def test_missing_ad_low_depth_flagged():
    vaf, low = assess_confidence(ref_depth=None, alt_depth=None, dp=5, expect_high=False)
    assert vaf is None and low is True


def test_hemizygous_clean_not_flagged():
    # X-linked male / chrY: single allele, expect ~100% alt -> not flagged
    vaf, low = assess_confidence(ref_depth=0, alt_depth=30, dp=30, expect_high=True)
    assert vaf == 1.0 and low is False


def test_all_missing_returns_none_false():
    vaf, low = assess_confidence(ref_depth=None, alt_depth=None, dp=None, expect_high=False)
    assert vaf is None and low is False
