"""Pharmacogene star-allele panel: from the defining SNP genotypes derive the
diplotype and the metabolizer/function phenotype (CPIC-style).

Unlike the rsID-keyed PharmGKB annotations (which are allele-direction-blind),
this gives the subject's actual phenotype per gene. Diplotypes are called from
unphased genotypes assuming no rare recombinant haplotypes. Coordinates are
1-based GRCh38, verified against the ClinVar coordinate map.

CYP2D6 is intentionally excluded: its copy-number variants and hybrids are not
reliably callable from short-read SNP/indel VCFs.
"""

PHARMACOGENES = {
    "CYP2C19": {
        "drugs": "clopidogrel, inibitori di pompa protonica, alcuni antidepressivi (SSRI), voriconazolo",
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs4244285", "chrom": "10", "pos": 94781859, "ref": "G", "allele": "*2"},
            {"rs_id": "rs4986893", "chrom": "10", "pos": 94780653, "ref": "G", "allele": "*3"},
            {"rs_id": "rs12248560", "chrom": "10", "pos": 94761900, "ref": "C", "allele": "*17"},
        ],
        "phenotype": {
            ("*1", "*1"): "Metabolizzatore normale",
            ("*1", "*17"): "Metabolizzatore rapido",
            ("*17", "*17"): "Metabolizzatore ultrarapido",
            ("*1", "*2"): "Metabolizzatore intermedio",
            ("*1", "*3"): "Metabolizzatore intermedio",
            ("*17", "*2"): "Metabolizzatore intermedio",
            ("*17", "*3"): "Metabolizzatore intermedio",
            ("*2", "*2"): "Metabolizzatore lento",
            ("*2", "*3"): "Metabolizzatore lento",
            ("*3", "*3"): "Metabolizzatore lento",
        },
    },
    "CYP2C9": {
        "drugs": "warfarin, FANS, fenitoina",
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs1799853", "chrom": "10", "pos": 94942290, "ref": "C", "allele": "*2"},
            {"rs_id": "rs1057910", "chrom": "10", "pos": 94981296, "ref": "A", "allele": "*3"},
        ],
        "phenotype": {
            ("*1", "*1"): "Metabolizzatore normale",
            ("*1", "*2"): "Metabolizzatore intermedio",
            ("*1", "*3"): "Metabolizzatore intermedio",
            ("*2", "*2"): "Metabolizzatore lento",
            ("*2", "*3"): "Metabolizzatore lento",
            ("*3", "*3"): "Metabolizzatore lento",
        },
    },
    "VKORC1": {
        "drugs": "warfarin (sensibilità)",
        "ref_allele": "C",
        "snps": [
            {"rs_id": "rs9923231", "chrom": "16", "pos": 31096368, "ref": "C", "allele": "T"},
        ],
        "phenotype": {
            ("C", "C"): "Sensibilità normale al warfarin (dose standard)",
            ("C", "T"): "Sensibilità intermedia al warfarin",
            ("T", "T"): "Alta sensibilità al warfarin (dose ridotta)",
        },
    },
    "SLCO1B1": {
        "drugs": "statine (rischio miopatia)",
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs4149056", "chrom": "12", "pos": 21178615, "ref": "T", "allele": "*5"},
        ],
        "phenotype": {
            ("*1", "*1"): "Funzione di trasporto normale",
            ("*1", "*5"): "Funzione intermedia (rischio miopatia da statine aumentato)",
            ("*5", "*5"): "Funzione ridotta (rischio miopatia da statine alto)",
        },
    },
    "NUDT15": {
        "drugs": "tiopurine (azatioprina, mercaptopurina)",
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs116855232", "chrom": "13", "pos": 48045719, "ref": "C", "allele": "*3"},
        ],
        "phenotype": {
            ("*1", "*1"): "Metabolizzatore normale",
            ("*1", "*3"): "Metabolizzatore intermedio",
            ("*3", "*3"): "Metabolizzatore lento (rischio tossicità tiopurine)",
        },
    },
    "CYP3A5": {
        "drugs": "tacrolimus",
        # NB: il riferimento *1 e' l'allele FUNZIONALE (espressore); *3 (alt) e' non-funzionale.
        # La maggioranza degli europei e' *3/*3 (non-espressore).
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs776746", "chrom": "7", "pos": 99672916, "ref": "T", "allele": "*3"},
        ],
        "phenotype": {
            ("*1", "*1"): "Espressore (metabolizzatore normale)",
            ("*1", "*3"): "Espressore intermedio",
            ("*3", "*3"): "Non-espressore (richiede dose di tacrolimus piu' alta)",
        },
    },
    # ---- Geni con risoluzione di diplotipo non banale (resolver custom) ----
    "TPMT": {
        "drugs": "tiopurine (azatioprina, mercaptopurina, tioguanina)",
        "ref_allele": "*1",
        # rs1800460 e rs1142345 in cis formano *3A — quando entrambi presenti si
        # assume cis (configurazione di gran lunga piu' comune nelle popolazioni
        # europee); senza fasaggio non si puo' distinguere da *3B+*3C in trans.
        "snps": [
            {"rs_id": "rs1800462", "chrom": "6", "pos": 18143724, "ref": "C", "allele": "*2"},
            {"rs_id": "rs1800460", "chrom": "6", "pos": 18138997, "ref": "C", "allele": "*3B"},
            {"rs_id": "rs1142345", "chrom": "6", "pos": 18130687, "ref": "T", "allele": "*3C"},
        ],
        "resolver": "tpmt",
    },
    "DPYD": {
        "drugs": "fluoropirimidine (5-FU, capecitabina, tegafur)",
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs3918290",  "chrom": "1", "pos": 97450058, "ref": "C", "allele": "*2A"},
            {"rs_id": "rs55886062", "chrom": "1", "pos": 97515787, "ref": "A", "allele": "*13"},
            {"rs_id": "rs67376798", "chrom": "1", "pos": 97082391, "ref": "T", "allele": "D949V"},
            {"rs_id": "rs56038477", "chrom": "1", "pos": 97573863, "ref": "C", "allele": "HapB3"},
        ],
        "resolver": "dpyd",
    },
    "UGT1A1": {
        "drugs": "irinotecan; metabolismo della bilirubina (sindrome di Gilbert)",
        "ref_allele": "*1",
        # rs887829 (T>C) e' in alto LD col polimorfismo del repeat TA nel promotore
        # (TA6 = *1, TA7 = *28); usato come proxy clinico standard.
        "snps": [
            {"rs_id": "rs887829", "chrom": "2", "pos": 233760498, "ref": "T", "allele": "*28"},
        ],
        "resolver": "ugt1a1",
    },
    "CYP4F2": {
        "drugs": "warfarin (richiesta di vitamina K, con VKORC1/CYP2C9)",
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs2108622", "chrom": "19", "pos": 15879621, "ref": "C", "allele": "*3"},
        ],
        "phenotype": {
            ("*1", "*1"): "Funzione normale (dose warfarin standard)",
            ("*1", "*3"): "Funzione intermedia (richiesta di warfarin leggermente aumentata)",
            ("*3", "*3"): "Funzione ridotta (richiesta di warfarin aumentata)",
        },
    },
    "CYP2B6": {
        "drugs": "efavirenz, metadone, bupropione, ciclofosfamide",
        # rs3745274 (516G>T, Q172H) e' il marker funzionale principale di *6 (proxy
        # clinico standard); senza rs2279343 non si distingue *6 da *9, ma la
        # funzione ridotta e' guidata da 516T.
        "ref_allele": "*1",
        "snps": [
            {"rs_id": "rs3745274", "chrom": "19", "pos": 41006936, "ref": "G", "allele": "*6"},
        ],
        "phenotype": {
            ("*1", "*1"): "Metabolizzatore normale",
            ("*1", "*6"): "Metabolizzatore intermedio",
            ("*6", "*6"): "Metabolizzatore lento (accumulo di efavirenz, piu' effetti sul SNC)",
        },
    },
    # ---- Geni con resolver custom (aplotipi lenti / X-linked) ----
    "NAT2": {
        "drugs": "isoniazide, idralazina, sulfamidici, procainamide, caffeina",
        "ref_allele": "*4",  # *4 = aplotipo rapido di riferimento
        "snps": [
            {"rs_id": "rs1801280", "chrom": "8", "pos": 18400344, "ref": "T", "allele": "*5"},
            {"rs_id": "rs1799930", "chrom": "8", "pos": 18400593, "ref": "G", "allele": "*6"},
            {"rs_id": "rs1799931", "chrom": "8", "pos": 18400860, "ref": "G", "allele": "*7"},
        ],
        "resolver": "nat2",
    },
    "G6PD": {
        "drugs": "rasburicase, primachina, dapsone, nitrofurantoina, blu di metilene; fave (favismo)",
        "ref_allele": "B",  # B = allele normale (wild-type)
        # X-linked: nel maschio emizigote (1 allele), nella femmina diploide.
        # Mediterranea (severa) = rs5030868; A- (moderata) = rs1050828 + rs1050829 in cis.
        "snps": [
            {"rs_id": "rs5030868", "chrom": "X", "pos": 154534419, "ref": "G", "allele": "Mediterranea"},
            {"rs_id": "rs1050828", "chrom": "X", "pos": 154536002, "ref": "C", "allele": "202A"},
            {"rs_id": "rs1050829", "chrom": "X", "pos": 154535277, "ref": "T", "allele": "376G"},
        ],
        "resolver": "g6pd",
    },
}


# Index of every defining SNP by chromosome, for cheap capture during the parse pass.
PHARMACO_BY_CHROM: dict[str, list[dict]] = {}
for _gene, _d in PHARMACOGENES.items():
    for _snp in _d["snps"]:
        PHARMACO_BY_CHROM.setdefault(_snp["chrom"], []).append(_snp)


def call_all(snp_genotypes: dict) -> list[dict]:
    """Per-gene result {gene, diplotype, phenotype, drugs} from captured SNP genotypes.

    For genes with a custom diplotype resolver (TPMT, DPYD, UGT1A1) the resolver
    returns (diplotype, phenotype) directly; the others use the simple
    called_alleles + call_phenotype pair.
    """
    results = []
    for gene, gene_def in PHARMACOGENES.items():
        resolver_name = gene_def.get("resolver")
        if resolver_name:
            dip, phen = RESOLVERS[resolver_name](snp_genotypes)
        else:
            alleles = called_alleles(gene_def, snp_genotypes)
            dip = "/".join(alleles) if alleles else None
            phen = call_phenotype(gene_def, alleles)
        results.append({
            "gene": gene,
            "diplotype": dip,
            "phenotype": phen,
            "drugs": gene_def["drugs"],
        })
    return results


def _alt_count(snp_genotypes: dict, rs_id: str) -> int | None:
    """Copies of the alt allele at this SNP (0/1/2), or None if no-call."""
    gt = snp_genotypes.get(rs_id)
    called = [a for a in (gt or []) if a is not None and a >= 0]
    if len(called) < 2:
        return None
    return sum(1 for a in called if a >= 1)


def resolve_tpmt(snp_genotypes: dict) -> tuple[str | None, str | None]:
    """TPMT diplotype with the composite *3A (rs1800460 + rs1142345 in cis).

    Assumes cis when both *3A-defining SNPs carry alt alleles (the common case in
    European populations; phased data would be needed to confirm vs. *3B+*3C in
    trans). All variant alleles are no-function for TPMT.
    """
    a = _alt_count(snp_genotypes, "rs1800462")  # *2
    b = _alt_count(snp_genotypes, "rs1800460")  # *3B alone
    c = _alt_count(snp_genotypes, "rs1142345")  # *3C alone
    if a is None or b is None or c is None:
        return None, None
    star3a = min(b, c)
    star3b = b - star3a
    star3c = c - star3a
    star2 = a
    star1 = 2 - (star2 + star3a + star3b + star3c)
    if star1 < 0:
        return None, None  # more no-function copies than haplotypes (impossible)
    alleles = sorted(
        ["*1"] * star1 + ["*2"] * star2 + ["*3A"] * star3a + ["*3B"] * star3b + ["*3C"] * star3c
    )
    diplotype = "/".join(alleles)
    no_func = star2 + star3a + star3b + star3c
    if no_func == 0:
        phen = "Metabolizzatore normale (attivita' TPMT completa)"
    elif no_func == 1:
        phen = "Metabolizzatore intermedio — ridurre la dose di tiopurine del 30-80%"
    else:
        phen = "Metabolizzatore lento — mielotossicita' grave: usare farmaco alternativo o ridurre la dose del ~90%"
    return diplotype, phen


def resolve_dpyd(snp_genotypes: dict) -> tuple[str | None, str | None]:
    """DPYD by CPIC activity score.

    *2A (rs3918290) e *13 (rs55886062) sono no-function (attivita' 0 per copia).
    D949V (rs67376798) e HapB3 (rs56038477) sono decreased (attivita' 0.5 per copia).
    Senza fasaggio si assume conservativamente che ogni variante sia su un aplotipo
    distinto; se piu' di due copie di varianti sono presenti la combinazione e'
    impossibile e si ritorna None.
    """
    a = _alt_count(snp_genotypes, "rs3918290")   # *2A
    b = _alt_count(snp_genotypes, "rs55886062")  # *13
    c = _alt_count(snp_genotypes, "rs67376798")  # D949V
    d = _alt_count(snp_genotypes, "rs56038477")  # HapB3
    if any(x is None for x in (a, b, c, d)):
        return None, None
    no_func = a + b
    dec = c + d
    if no_func + dec > 2:
        return None, None
    activity = 2.0 - no_func * 1.0 - dec * 0.5
    parts = (["*2A"] * a) + (["*13"] * b) + (["D949V"] * c) + (["HapB3"] * d)
    parts += ["*1"] * (2 - len(parts))
    diplotype = "/".join(sorted(parts))
    if activity >= 2.0:
        phen = "Metabolizzatore normale (attivita' DPYD completa)"
    elif activity >= 1.0:
        phen = "Metabolizzatore intermedio — riduzione ~50% della dose iniziale di fluoropirimidine"
    else:
        phen = "Metabolizzatore lento — evitare fluoropirimidine (rischio di tossicita' grave/letale)"
    return diplotype, phen


def resolve_ugt1a1(snp_genotypes: dict) -> tuple[str | None, str | None]:
    """UGT1A1 via rs887829 (proxy del repeat TA7 promoter = *28)."""
    c = _alt_count(snp_genotypes, "rs887829")
    if c is None:
        return None, None
    if c == 0:
        return "*1/*1", "Metabolizzatore normale (no Gilbert)"
    if c == 1:
        return "*1/*28", "Metabolizzatore intermedio (Gilbert lieve) — possibile lieve iperbilirubinemia; cautela con irinotecan"
    return "*28/*28", "Metabolizzatore lento (sindrome di Gilbert) — iperbilirubinemia non-coniugata; tossicita' aumentata da irinotecan (ridurre dose ~70%)"


def resolve_nat2(snp_genotypes: dict) -> tuple[str | None, str | None]:
    """Stato acetilatore NAT2 dal numero di aplotipi lenti (*5/*6/*7).

    Ogni allele variante e' no-function. *5 (341T>C), *6 (590G>A), *7 (857G>A)
    marcano aplotipi lenti distinti che in pratica non co-occorrono in cis, quindi
    il numero di alleli varianti = numero di aplotipi lenti (max 2). 0 = rapido,
    1 = intermedio, 2 = lento. >2 = combinazione non risolvibile senza fasaggio.
    """
    s5 = _alt_count(snp_genotypes, "rs1801280")
    s6 = _alt_count(snp_genotypes, "rs1799930")
    s7 = _alt_count(snp_genotypes, "rs1799931")
    if s5 is None or s6 is None or s7 is None:
        return None, None
    slow = s5 + s6 + s7
    if slow > 2:
        return None, None
    labels = ["*5"] * s5 + ["*6"] * s6 + ["*7"] * s7
    labels += ["*4"] * (2 - len(labels))
    diplotype = "/".join(sorted(labels))
    if slow == 0:
        phen = "Acetilatore rapido"
    elif slow == 1:
        phen = "Acetilatore intermedio"
    else:
        phen = "Acetilatore lento — maggior rischio di tossicita' da isoniazide/sulfamidici; clearance piu' lenta della caffeina"
    return diplotype, phen


def _x_ploidy_alt(snp_genotypes: dict, rs_id: str) -> tuple[int | None, int]:
    """(ploidia, copie dell'allele variante) per un SNP su X. ploidia 1 = maschio
    emizigote, 2 = femmina. ploidia None se no-call."""
    gt = snp_genotypes.get(rs_id)
    called = [a for a in (gt or []) if a is not None and a >= 0]
    if not called:
        return None, 0
    return len(called), sum(1 for a in called if a >= 1)


def resolve_g6pd(snp_genotypes: dict) -> tuple[str | None, str | None]:
    """G6PD (X-linked). Maschio emizigote: una sola copia → carente o normale.
    Femmina: het = portatrice (attivita' variabile per inattivazione dell'X),
    omozigote = carente. Mediterranea (rs5030868) e' severa; A- richiede
    rs1050828 + rs1050829 (assunti in cis nel maschio)."""
    pm, med = _x_ploidy_alt(snp_genotypes, "rs5030868")
    p2, v202 = _x_ploidy_alt(snp_genotypes, "rs1050828")
    p3, v376 = _x_ploidy_alt(snp_genotypes, "rs1050829")
    if pm is None or p2 is None or p3 is None:
        return None, None
    ploidy = max(pm, p2, p3)
    is_amin = v202 >= 1 and v376 >= 1  # A-: 202 + 376 (cis assunto)
    if ploidy == 1:  # maschio emizigote
        if med >= 1:
            return "Mediterranea", "Carente — variante Mediterranea (deficit severo): evitare fave e farmaci ossidanti (rasburicase, primachina, dapsone, nitrofurantoina)"
        if is_amin:
            return "A-", "Carente — variante A- (deficit moderato): cautela con farmaci ossidanti ad alte dosi"
        return "B", "Attivita' G6PD normale"
    # femmina diploide
    if med >= 2 or (is_amin and v202 >= 2 and v376 >= 2):
        return "carente/carente", "Carente (omozigote): evitare fave e farmaci ossidanti"
    if med >= 1 or is_amin:
        return "B/carente", "Portatrice — attivita' G6PD variabile (inattivazione dell'X); possibile carenza parziale"
    return "B/B", "Attivita' G6PD normale"


RESOLVERS = {
    "tpmt": resolve_tpmt,
    "dpyd": resolve_dpyd,
    "ugt1a1": resolve_ugt1a1,
    "nat2": resolve_nat2,
    "g6pd": resolve_g6pd,
}


def called_alleles(gene_def: dict, snp_genotypes: dict) -> list[str] | None:
    """Diplotype (two allele labels) from the gene's defining-SNP genotypes.

    snp_genotypes maps rs_id -> list of cyvcf2 allele indices. Returns None if any
    defining SNP is no-call, or if more than two non-reference alleles are present
    (an impossible combination without a rare recombinant).
    """
    ref_allele = gene_def.get("ref_allele", "*1")
    variant_alleles: list[str] = []
    for snp in gene_def["snps"]:
        gt = snp_genotypes.get(snp["rs_id"])
        called = [a for a in (gt or []) if a is not None and a >= 0]
        if len(called) < 2:
            return None  # no-call / missing -> can't call the diplotype
        alt_count = sum(1 for a in called if a >= 1)
        variant_alleles.extend([snp["allele"]] * alt_count)
    if len(variant_alleles) > 2:
        return None
    alleles = variant_alleles + [ref_allele] * (2 - len(variant_alleles))
    return sorted(alleles)


def call_phenotype(gene_def: dict, alleles: list[str] | None) -> str | None:
    """Map a called diplotype to its phenotype label, or None if unknown."""
    if not alleles:
        return None
    return gene_def["phenotype"].get(tuple(sorted(alleles)))
