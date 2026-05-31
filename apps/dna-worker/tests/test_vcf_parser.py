from src.worker.vcf_parser import (
    zygosity_for_allele,
    is_primary_contig,
    carried_alt_indices,
    format_genotype,
)


def test_zygosity_homozygous_alt():
    assert zygosity_for_allele([1, 1], 1) == "HOMOZYGOUS"


def test_zygosity_simple_heterozygous():
    assert zygosity_for_allele([0, 1], 1) == "HETEROZYGOUS"


def test_zygosity_compound_het_both_alleles_heterozygous():
    # GT 1/2: from each allele's perspective the sample is heterozygous
    assert zygosity_for_allele([1, 2], 1) == "HETEROZYGOUS"
    assert zygosity_for_allele([1, 2], 2) == "HETEROZYGOUS"


def test_zygosity_partial_multiallelic():
    # GT 0/2: heterozygous for allele 2
    assert zygosity_for_allele([0, 2], 2) == "HETEROZYGOUS"


def test_zygosity_homozygous_second_alt():
    # GT 2/2: homozygous for allele 2
    assert zygosity_for_allele([2, 2], 2) == "HOMOZYGOUS"


def test_zygosity_haploid_is_none():
    # chrY/MT haploid: no diploid zygosity concept
    assert zygosity_for_allele([1], 1) is None


def test_zygosity_nocall_is_none():
    assert zygosity_for_allele([-1, -1], 1) is None


def test_primary_contig_accepts_autosomes_and_sex_and_mt():
    for c in ("1", "22", "X", "Y", "MT"):
        assert is_primary_contig(c) is True


def test_primary_contig_accepts_chr_prefix_and_m_alias():
    assert is_primary_contig("chr1") is True
    assert is_primary_contig("chrX") is True
    assert is_primary_contig("chrM") is True
    assert is_primary_contig("M") is True


def test_primary_contig_rejects_decoy_and_unplaced():
    assert is_primary_contig("1_KI270706v1_random") is False
    assert is_primary_contig("Un_KI270302v1") is False
    assert is_primary_contig("17_GL000205v2_random") is False
    assert is_primary_contig("HLA-A*01:01") is False


def test_carried_alt_indices_heterozygous():
    # GT 0/1 -> carries alt allele #1 only
    assert carried_alt_indices([0, 1]) == {1}


def test_carried_alt_indices_homozygous_alt():
    # GT 1/1 -> carries alt allele #1
    assert carried_alt_indices([1, 1]) == {1}


def test_carried_alt_indices_compound_het():
    # GT 1/2 -> carries alt alleles #1 and #2
    assert carried_alt_indices([1, 2]) == {1, 2}


def test_carried_alt_indices_partial_multiallelic():
    # GT 0/2 -> carries alt allele #2 only, NOT #1
    assert carried_alt_indices([0, 2]) == {2}


def test_carried_alt_indices_homref_carries_nothing():
    assert carried_alt_indices([0, 0]) == set()


def test_carried_alt_indices_nocall_carries_nothing():
    # ./. -> cyvcf2 reports [-1, -1]
    assert carried_alt_indices([-1, -1]) == set()


def test_format_genotype_diploid():
    # cyvcf2 genotype entry: [allele1, allele2, phased_bool]
    assert format_genotype([0, 1, False]) == "0/1"
    assert format_genotype([1, 1, False]) == "1/1"


def test_format_genotype_haploid_drops_phase_flag():
    # chrY/MT/non-PAR X are haploid: [allele, phased_bool] -> single allele
    assert format_genotype([1, False]) == "1"


def test_format_genotype_missing_allele_rendered_as_dot():
    assert format_genotype([1, -1, False]) == "1/."
