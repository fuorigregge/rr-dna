"""Per-call confidence from read support (allele balance + depth).

A variant caller can emit a PASS heterozygous call whose read support is atypical
— e.g. only ~17% of reads carry the alt allele instead of the ~50% expected for a
true germline heterozygote (e.g. AD ~30,6). Such allele imbalance,
or simply low coverage, marks a call as low confidence: it may be a false positive
(sequencing error, mismapping from a paralog) or a non-germline event (mosaicism).

This is NOT a probability that the variant is wrong — it is a flag that the read
support is inconsistent with a confident germline call, so the variant (and any
pathogenic interpretation) should be treated with caution and confirmed.

Thresholds (the "Standard" profile):
  - heterozygote: VAF < 0.25 or VAF > 0.75  -> low confidence (allele imbalance)
  - homozygote/hemizygote: VAF < 0.85       -> low confidence
  - any call with DP < 10                    -> low confidence (low coverage)
"""

MIN_DP = 10
HET_LOW = 0.25
HET_HIGH = 0.75
HOM_LOW = 0.85


def assess_confidence(
    ref_depth: int | None,
    alt_depth: int | None,
    dp: int | None,
    expect_high: bool,
) -> tuple[float | None, bool]:
    """Return (vaf, low_confidence) for one carried alt allele.

    vaf is alt / (ref + alt) when allele depths are available (else alt / dp, else
    None). `expect_high` is True for homozygous-alt and hemizygous (haploid) calls,
    where ~100% alt is expected; False for heterozygotes (~50% expected).
    """
    vaf: float | None = None
    if alt_depth is not None and ref_depth is not None and (ref_depth + alt_depth) > 0:
        vaf = alt_depth / (ref_depth + alt_depth)
    elif alt_depth is not None and dp:
        vaf = alt_depth / dp

    low = False
    if dp is not None and dp < MIN_DP:
        low = True
    if vaf is not None:
        if expect_high:
            if vaf < HOM_LOW:
                low = True
        else:
            if vaf < HET_LOW or vaf > HET_HIGH:
                low = True
    return vaf, low
