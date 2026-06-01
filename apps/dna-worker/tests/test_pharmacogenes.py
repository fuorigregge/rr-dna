from src.worker.pharmacogenes import (
    PHARMACOGENES,
    called_alleles,
    call_phenotype,
    call_all,
    resolve_tpmt,
    resolve_dpyd,
    resolve_ugt1a1,
    resolve_nat2,
    resolve_g6pd,
)


def _cyp2c19():
    return PHARMACOGENES["CYP2C19"]


def test_pharmacogenes_wellformed():
    seen = set()
    for gene, d in PHARMACOGENES.items():
        for snp in d["snps"]:
            assert snp["rs_id"].startswith("rs")
            assert snp["rs_id"] not in seen
            seen.add(snp["rs_id"])
            assert snp["chrom"] and isinstance(snp["pos"], int) and snp["pos"] > 0
            assert snp["allele"]  # the star allele its ALT defines
        # either a simple phenotype lookup OR a custom resolver
        assert d.get("phenotype") or d.get("resolver"), f"{gene} missing phenotype/resolver"


def test_cyp2c19_normal_metabolizer():
    # all reference -> *1/*1 -> Normal
    gt = {"rs4244285": [0, 0], "rs4986893": [0, 0], "rs12248560": [0, 0]}
    alleles = called_alleles(_cyp2c19(), gt)
    assert sorted(alleles) == ["*1", "*1"]
    assert call_phenotype(_cyp2c19(), alleles) == "Metabolizzatore normale"


def test_cyp2c19_poor_metabolizer():
    # *2/*2 (homozygous loss-of-function) -> Poor
    gt = {"rs4244285": [1, 1], "rs4986893": [0, 0], "rs12248560": [0, 0]}
    alleles = called_alleles(_cyp2c19(), gt)
    assert sorted(alleles) == ["*2", "*2"]
    assert call_phenotype(_cyp2c19(), alleles) == "Metabolizzatore lento"


def test_cyp2c19_intermediate():
    # *1/*2 -> Intermediate
    gt = {"rs4244285": [0, 1], "rs4986893": [0, 0], "rs12248560": [0, 0]}
    alleles = called_alleles(_cyp2c19(), gt)
    assert sorted(alleles) == ["*1", "*2"]
    assert call_phenotype(_cyp2c19(), alleles) == "Metabolizzatore intermedio"


def test_cyp2c19_ultrarapid():
    # *17/*17 -> Ultrarapid
    gt = {"rs4244285": [0, 0], "rs4986893": [0, 0], "rs12248560": [1, 1]}
    alleles = called_alleles(_cyp2c19(), gt)
    assert sorted(alleles) == ["*17", "*17"]
    assert call_phenotype(_cyp2c19(), alleles) == "Metabolizzatore ultrarapido"


def test_called_alleles_indeterminate_when_too_many():
    # three non-*1 alleles across the two haplotypes is impossible -> None
    gt = {"rs4244285": [1, 1], "rs4986893": [0, 1], "rs12248560": [0, 0]}
    assert called_alleles(_cyp2c19(), gt) is None


def test_called_alleles_nocall():
    gt = {"rs4244285": [-1, -1], "rs4986893": [0, 0], "rs12248560": [0, 0]}
    assert called_alleles(_cyp2c19(), gt) is None


# ---------------------------- TPMT ---------------------------------------

def test_tpmt_normal():
    gt = {"rs1800462": [0, 0], "rs1800460": [0, 0], "rs1142345": [0, 0]}
    dip, phen = resolve_tpmt(gt)
    assert dip == "*1/*1"
    assert "normale" in phen.lower()


def test_tpmt_3a_heterozygous_cis():
    # rs1800460 and rs1142345 both heterozygous → assumed *3A (one copy)
    gt = {"rs1800462": [0, 0], "rs1800460": [0, 1], "rs1142345": [0, 1]}
    dip, phen = resolve_tpmt(gt)
    assert dip == "*1/*3A"
    assert "intermedio" in phen.lower()


def test_tpmt_3a_homozygous():
    gt = {"rs1800462": [0, 0], "rs1800460": [1, 1], "rs1142345": [1, 1]}
    dip, phen = resolve_tpmt(gt)
    assert dip == "*3A/*3A"
    assert "lento" in phen.lower()


def test_tpmt_isolated_2_heterozygous():
    gt = {"rs1800462": [0, 1], "rs1800460": [0, 0], "rs1142345": [0, 0]}
    dip, phen = resolve_tpmt(gt)
    assert dip == "*1/*2"
    assert "intermedio" in phen.lower()


def test_tpmt_isolated_3b():
    # rs1800460 alt without rs1142345 → *3B (rare)
    gt = {"rs1800462": [0, 0], "rs1800460": [0, 1], "rs1142345": [0, 0]}
    dip, phen = resolve_tpmt(gt)
    assert dip == "*1/*3B"
    assert "intermedio" in phen.lower()


def test_tpmt_nocall_returns_none():
    gt = {"rs1800462": [-1, -1], "rs1800460": [0, 0], "rs1142345": [0, 0]}
    assert resolve_tpmt(gt) == (None, None)


def test_tpmt_too_many_variants_returns_none():
    # 3 no-function copies impossible without a recombinant
    gt = {"rs1800462": [1, 1], "rs1800460": [0, 1], "rs1142345": [0, 0]}
    assert resolve_tpmt(gt) == (None, None)


# ---------------------------- DPYD ---------------------------------------

def test_dpyd_normal():
    gt = {"rs3918290": [0, 0], "rs55886062": [0, 0], "rs67376798": [0, 0], "rs56038477": [0, 0]}
    dip, phen = resolve_dpyd(gt)
    assert dip == "*1/*1"
    assert "normale" in phen.lower()


def test_dpyd_intermediate_one_no_function():
    # one *2A copy → activity 1.0 → intermediate
    gt = {"rs3918290": [0, 1], "rs55886062": [0, 0], "rs67376798": [0, 0], "rs56038477": [0, 0]}
    dip, phen = resolve_dpyd(gt)
    assert "*2A" in dip and "*1" in dip
    assert "intermedio" in phen.lower()


def test_dpyd_intermediate_one_decreased():
    # one D949V copy → activity 1.5 → intermediate
    gt = {"rs3918290": [0, 0], "rs55886062": [0, 0], "rs67376798": [0, 1], "rs56038477": [0, 0]}
    dip, phen = resolve_dpyd(gt)
    assert "intermedio" in phen.lower()


def test_dpyd_poor_two_no_function():
    # *2A/*2A → activity 0 → poor (avoid fluoropyrimidines)
    gt = {"rs3918290": [1, 1], "rs55886062": [0, 0], "rs67376798": [0, 0], "rs56038477": [0, 0]}
    dip, phen = resolve_dpyd(gt)
    assert "lento" in phen.lower() or "evitare" in phen.lower()


def test_dpyd_impossible_combo_returns_none():
    # 3 variant copies → impossible
    gt = {"rs3918290": [1, 1], "rs55886062": [0, 1], "rs67376798": [0, 0], "rs56038477": [0, 0]}
    assert resolve_dpyd(gt) == (None, None)


# ---------------------------- UGT1A1 -------------------------------------

def test_ugt1a1_normal():
    gt = {"rs887829": [0, 0]}
    dip, phen = resolve_ugt1a1(gt)
    assert dip == "*1/*1"
    assert "normale" in phen.lower()


def test_ugt1a1_heterozygous_28():
    gt = {"rs887829": [0, 1]}
    dip, phen = resolve_ugt1a1(gt)
    assert dip == "*1/*28"
    assert "gilbert" in phen.lower()


def test_ugt1a1_homozygous_28():
    gt = {"rs887829": [1, 1]}
    dip, phen = resolve_ugt1a1(gt)
    assert dip == "*28/*28"
    assert "gilbert" in phen.lower() and "irinotecan" in phen.lower()


def test_ugt1a1_nocall():
    gt = {"rs887829": [-1, -1]}
    assert resolve_ugt1a1(gt) == (None, None)


# ---------------------------- NAT2 ---------------------------------------

def test_nat2_rapid_all_reference():
    gt = {"rs1801280": [0, 0], "rs1799930": [0, 0], "rs1799931": [0, 0]}
    dip, phen = resolve_nat2(gt)
    assert dip == "*4/*4"
    assert "rapido" in phen.lower()


def test_nat2_intermediate_one_slow():
    gt = {"rs1801280": [0, 1], "rs1799930": [0, 0], "rs1799931": [0, 0]}
    dip, phen = resolve_nat2(gt)
    assert dip == "*4/*5"
    assert "intermedio" in phen.lower()


def test_nat2_slow_two_distinct_slow_haplotypes():
    # *5 (341) + *6 (590) heterozygous → two slow haplotypes → slow acetylator
    gt = {"rs1801280": [0, 1], "rs1799930": [0, 1], "rs1799931": [0, 0]}
    dip, phen = resolve_nat2(gt)
    assert dip == "*5/*6"
    assert "lento" in phen.lower()


def test_nat2_slow_homozygous():
    gt = {"rs1801280": [1, 1], "rs1799930": [0, 0], "rs1799931": [0, 0]}
    dip, phen = resolve_nat2(gt)
    assert dip == "*5/*5"
    assert "lento" in phen.lower()


def test_nat2_unresolvable_too_many_slow():
    # homozygous *5 + heterozygous *6 → 3 slow copies, impossible without phasing
    gt = {"rs1801280": [1, 1], "rs1799930": [0, 1], "rs1799931": [0, 0]}
    assert resolve_nat2(gt) == (None, None)


def test_nat2_nocall():
    gt = {"rs1801280": [-1, -1], "rs1799930": [0, 0], "rs1799931": [0, 0]}
    assert resolve_nat2(gt) == (None, None)


# ---------------------------- CYP4F2 / CYP2B6 (simple) -------------------

def test_cyp4f2_reduced_homozygous_star3():
    gene = PHARMACOGENES["CYP4F2"]
    gt = {"rs2108622": [1, 1]}
    alleles = called_alleles(gene, gt)
    assert sorted(alleles) == ["*3", "*3"]
    assert "ridotta" in call_phenotype(gene, alleles).lower()


def test_cyp2b6_normal():
    gene = PHARMACOGENES["CYP2B6"]
    gt = {"rs3745274": [0, 0]}
    alleles = called_alleles(gene, gt)
    assert sorted(alleles) == ["*1", "*1"]
    assert "normale" in call_phenotype(gene, alleles).lower()


# ---------------------------- G6PD (X-linked) ---------------------------

def test_g6pd_male_hemizygous_normal():
    # haploid reference (male) → normal
    gt = {"rs5030868": [0], "rs1050828": [0], "rs1050829": [0]}
    dip, phen = resolve_g6pd(gt)
    assert dip == "B"
    assert "normale" in phen.lower()


def test_g6pd_male_mediterranean_deficient():
    gt = {"rs5030868": [1], "rs1050828": [0], "rs1050829": [0]}
    dip, phen = resolve_g6pd(gt)
    assert dip == "Mediterranea"
    assert "carente" in phen.lower()


def test_g6pd_male_a_minus_requires_both_snps():
    # 376 alone (A+) is NOT deficient
    gt = {"rs5030868": [0], "rs1050828": [0], "rs1050829": [1]}
    dip, phen = resolve_g6pd(gt)
    assert dip == "B"
    # 202 + 376 together → A- deficient
    gt2 = {"rs5030868": [0], "rs1050828": [1], "rs1050829": [1]}
    dip2, phen2 = resolve_g6pd(gt2)
    assert dip2 == "A-"
    assert "carente" in phen2.lower()


def test_g6pd_female_carrier():
    gt = {"rs5030868": [0, 1], "rs1050828": [0, 0], "rs1050829": [0, 0]}
    dip, phen = resolve_g6pd(gt)
    assert "carente" in dip.lower() or "portatrice" in phen.lower()


def test_g6pd_nocall():
    gt = {"rs5030868": [], "rs1050828": [0], "rs1050829": [0]}
    assert resolve_g6pd(gt) == (None, None)


def test_call_all_includes_new_genes():
    genes = {r["gene"] for r in call_all({})}
    for g in ("NAT2", "G6PD", "CYP4F2", "CYP2B6"):
        assert g in genes
