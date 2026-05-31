"""Curated expanded carrier-screening panel.

For a set of well-characterized recessive (and X-linked) pathogenic variants in
classic carrier-screening genes, resolve an explicit verdict against the raw
gVCF at ingest:

  CLEAR        — the pathogenic allele is absent (reference at the site): not a
                 carrier of this variant. The reassuring negative, otherwise
                 invisible (hom-ref blocks never reach the Variant table).
  CARRIER      — heterozygous for the pathogenic allele: healthy carrier, with a
                 reproductive risk if the partner is also a carrier.
  AFFECTED     — two copies (homozygous), or hemizygous on chrX in a male:
                 compatible with being affected, not just a carrier.
  NOT_COVERED  — no reliable call at the site.

Each entry targets ONE specific (chrom, pos, ref, alt) pathogenic allele, with
forward-strand ref/alt taken from the ClinVar database (resolving strand polarity
and selecting the pathogenic allele among co-located variants). This is NOT
full-gene carrier screening: a CLEAR result rules out only the listed variant,
not other pathogenic variants in the same gene. Indels (CFTR F508del, GJB2 35delG)
are matched by exact representation and flagged confidence=LOW.

Not detectable from this SNP/indel data and therefore NOT in the panel:
SMA (SMN1, copy-number), fragile X (FMR1 CGG repeat), and other repeat/CNV
disorders — their absence here is not a negative result.

Informational, not diagnostic: any CARRIER/AFFECTED finding needs clinical
confirmation and genetic counseling.
"""

_NOT_COVERED_MSG = (
    "Sito non valutabile: nessuna chiamata affidabile a questa posizione nel sequenziamento."
)
_PANEL_SCOPE_CAVEAT = (
    " Questo pannello controlla una variante specifica: un risultato negativo NON esclude "
    "altre varianti patogeniche nello stesso gene."
)
SMA_CAVEAT = (
    "Nota: alcune condizioni recessive frequenti NON sono rilevabili da questo tipo di dato "
    "(es. atrofia muscolare spinale/SMN1, basata sul numero di copie; X-fragile/FMR1, da "
    "espansione di triplette) e quindi non compaiono nel pannello: la loro assenza qui non e' "
    "un risultato negativo."
)

CARRIER_PANEL = [
    {
        "rs_id": "rs334", "gene": "HBB", "variant_name": "c.20A>T (p.Glu6Val, HbS)",
        "condition": "Anemia falciforme / tratto falciforme", "inheritance": "Autosomica recessiva",
        "chrom": "11", "pos": 5227002, "ref": "T", "alt": "A",
        "interpretation": {
            "CLEAR": "Non porti l'allele HbS (anemia falciforme): non sei portatore di questa variante.",
            "CARRIER": "Sei portatore sano dell'allele HbS (tratto falciforme): in genere asintomatico. Rischio riproduttivo del 25% di figlio affetto se anche il/la partner e' portatore di un allele HBB patogenico (HbS, HbC o beta-talassemia).",
            "AFFECTED": "Due copie dell'allele HbS: compatibile con anemia falciforme. Richiede conferma e gestione clinica.",
        },
    },
    {
        "rs_id": "rs113993960", "gene": "CFTR", "variant_name": "p.Phe508del (F508del)",
        "condition": "Fibrosi cistica", "inheritance": "Autosomica recessiva",
        "chrom": "7", "pos": 117559590, "ref": "ATCT", "alt": "A", "confidence": "LOW",
        "interpretation": {
            "CLEAR": "Non porti F508del, la mutazione CFTR piu' comune della fibrosi cistica. NB: chiamata di indel da short-read; un negativo va confermato con test mirato in caso di forte sospetto.",
            "CARRIER": "Sei portatore sano di F508del (fibrosi cistica): asintomatico. Rischio del 25% di figlio affetto se anche il/la partner e' portatore di una mutazione CFTR.",
            "AFFECTED": "Due copie di F508del: compatibile con fibrosi cistica. Richiede conferma e gestione clinica.",
        },
    },
    {
        "rs_id": "rs113993959", "gene": "CFTR", "variant_name": "c.1624G>T (p.Gly542Ter, G542X)",
        "condition": "Fibrosi cistica", "inheritance": "Autosomica recessiva",
        "chrom": "7", "pos": 117587778, "ref": "G", "alt": "T",
        "interpretation": {
            "CLEAR": "Non porti la mutazione CFTR G542X (fibrosi cistica): non sei portatore di questa variante.",
            "CARRIER": "Sei portatore sano di CFTR G542X (fibrosi cistica): asintomatico. Rischio del 25% di figlio affetto se anche il/la partner e' portatore di una mutazione CFTR.",
            "AFFECTED": "Due copie di CFTR G542X: compatibile con fibrosi cistica. Richiede conferma e gestione clinica.",
        },
    },
    {
        "rs_id": "rs77010898", "gene": "CFTR", "variant_name": "c.3846G>A (p.Trp1282Ter, W1282X)",
        "condition": "Fibrosi cistica", "inheritance": "Autosomica recessiva",
        "chrom": "7", "pos": 117642566, "ref": "G", "alt": "A",
        "interpretation": {
            "CLEAR": "Non porti la mutazione CFTR W1282X (fibrosi cistica): non sei portatore di questa variante.",
            "CARRIER": "Sei portatore sano di CFTR W1282X (fibrosi cistica): asintomatico. Rischio del 25% di figlio affetto se anche il/la partner e' portatore di una mutazione CFTR.",
            "AFFECTED": "Due copie di CFTR W1282X: compatibile con fibrosi cistica. Richiede conferma e gestione clinica.",
        },
    },
    {
        "rs_id": "rs76763715", "gene": "GBA1", "variant_name": "c.1226A>G (p.Asn409Ser, N370S)",
        "condition": "Malattia di Gaucher (tipo 1)", "inheritance": "Autosomica recessiva",
        "chrom": "1", "pos": 155235843, "ref": "T", "alt": "C",
        "interpretation": {
            "CLEAR": "Non porti l'allele GBA1 N370S (Gaucher): non sei portatore di questa variante.",
            "CARRIER": "Sei portatore sano dell'allele GBA1 N370S (Gaucher tipo 1): asintomatico per Gaucher, con rischio riproduttivo del 25% se anche il/la partner e' portatore. NB: i portatori GBA1 hanno anche un rischio lievemente aumentato di malattia di Parkinson/demenza a corpi di Lewy (rischio relativo modesto, non una diagnosi).",
            "AFFECTED": "Due copie dell'allele GBA1 N370S: compatibile con malattia di Gaucher tipo 1. Richiede conferma e gestione clinica.",
        },
    },
    {
        "rs_id": "rs5030858", "gene": "PAH", "variant_name": "c.1222C>T (p.Arg408Trp, R408W)",
        "condition": "Fenilchetonuria (PKU)", "inheritance": "Autosomica recessiva",
        "chrom": "12", "pos": 102840493, "ref": "G", "alt": "A",
        "interpretation": {
            "CLEAR": "Non porti l'allele PAH R408W (fenilchetonuria): non sei portatore di questa variante.",
            "CARRIER": "Sei portatore sano dell'allele PAH R408W (PKU): asintomatico. Rischio del 25% di figlio affetto se anche il/la partner e' portatore di una mutazione PAH.",
            "AFFECTED": "Due copie dell'allele PAH R408W: compatibile con fenilchetonuria. Richiede conferma e gestione dietetica/clinica.",
        },
    },
    {
        "rs_id": "rs76151636", "gene": "ATP7B", "variant_name": "c.3207C>A (p.His1069Gln, H1069Q)",
        "condition": "Malattia di Wilson", "inheritance": "Autosomica recessiva",
        "chrom": "13", "pos": 51944145, "ref": "G", "alt": "T",
        "interpretation": {
            "CLEAR": "Non porti l'allele ATP7B H1069Q (malattia di Wilson): non sei portatore di questa variante.",
            "CARRIER": "Sei portatore sano dell'allele ATP7B H1069Q (Wilson): asintomatico. Rischio del 25% di figlio affetto se anche il/la partner e' portatore di una mutazione ATP7B.",
            "AFFECTED": "Due copie dell'allele ATP7B H1069Q: compatibile con malattia di Wilson (accumulo di rame). Trattabile: la diagnosi precoce e' importante, richiede conferma e gestione clinica.",
        },
    },
    {
        "rs_id": "rs61752717", "gene": "MEFV", "variant_name": "c.2080A>G (p.Met694Val, M694V)",
        "condition": "Febbre Mediterranea Familiare (FMF)", "inheritance": "Autosomica recessiva",
        "chrom": "16", "pos": 3243407, "ref": "T", "alt": "C",
        "interpretation": {
            "CLEAR": "Non porti l'allele MEFV M694V (Febbre Mediterranea Familiare): non sei portatore di questa variante.",
            "CARRIER": "Sei portatore dell'allele MEFV M694V (FMF): spesso asintomatico, ma l'ereditarieta' della FMF non e' sempre puramente recessiva (alcuni eterozigoti possono avere sintomi lievi). Rilevante in area mediterranea. Rischio riproduttivo se anche il/la partner e' portatore.",
            "AFFECTED": "Due copie dell'allele MEFV M694V: compatibile con Febbre Mediterranea Familiare (la variante a maggior gravita'). Richiede conferma e gestione clinica.",
        },
    },
    {
        "rs_id": "rs5030868", "gene": "G6PD", "variant_name": "c.563C>T (p.Ser188Phe, variante Mediterranea)",
        "condition": "Deficit di G6PD (favismo)", "inheritance": "X-linked recessiva",
        "chrom": "X", "pos": 154534419, "ref": "G", "alt": "A",
        "interpretation": {
            "CLEAR": "Non porti la variante G6PD Mediterranea (favismo): non sei portatore di questa variante.",
            "CARRIER": "Sei portatrice eterozigote della variante G6PD Mediterranea (favismo). Essendo X-linked, le femmine eterozigoti sono di norma asintomatiche (raramente sintomi per inattivazione sbilanciata dell'X); i figli maschi hanno 50% di probabilita' di essere affetti.",
            "AFFECTED": "Porti la variante G6PD Mediterranea in emizigosi (maschio) o omozigosi: compatibile con deficit di G6PD (rischio di crisi emolitiche da fave, alcuni farmaci, infezioni). Evitare i fattori scatenanti noti; informazione clinicamente utile.",
        },
    },
    {
        "rs_id": "rs80338939", "gene": "GJB2", "variant_name": "c.35delG (35delG)",
        "condition": "Sordita' neurosensoriale non sindromica (DFNB1)", "inheritance": "Autosomica recessiva",
        "chrom": "13", "pos": 20189546, "ref": "AC", "alt": "A", "confidence": "LOW",
        "interpretation": {
            "CLEAR": "Non porti la mutazione GJB2 35delG (sordita' non sindromica). NB: chiamata di indel da short-read; un negativo va confermato con test mirato in caso di forte sospetto.",
            "CARRIER": "Sei portatore sano di GJB2 35delG (sordita' non sindromica), la causa genetica piu' comune di sordita' congenita. Rischio del 25% di figlio affetto se anche il/la partner e' portatore di una mutazione GJB2.",
            "AFFECTED": "Due copie di GJB2 35delG: compatibile con sordita' neurosensoriale non sindromica. Richiede conferma e gestione clinica.",
        },
    },
]

# Append the panel-scope caveat to every reassuring negative; add shared NOT_COVERED.
for _e in CARRIER_PANEL:
    _e["interpretation"]["CLEAR"] += _PANEL_SCOPE_CAVEAT
    _e["interpretation"].setdefault("NOT_COVERED", _NOT_COVERED_MSG)

CARRIER_BY_CHROM: dict[str, list[dict]] = {}
for _e in CARRIER_PANEL:
    CARRIER_BY_CHROM.setdefault(_e["chrom"], []).append(_e)

# A more definitive verdict must not be downgraded by a later covering record.
STATE_RANK = {"NOT_COVERED": 1, "CLEAR": 2, "CARRIER": 3, "AFFECTED": 4}


def classify_carrier(entry: dict, rec_pos: int, rec_ref: str, rec_alts: list[str], gt_alleles) -> tuple[str, int | None]:
    """State for a carrier site given a covering gVCF record.

    Returns (state, matched_alt_index). Verdict is driven by the copy count of the
    SPECIFIC pathogenic allele (exact pos+ref+alt match):
      0 copies + a real call -> CLEAR; 1 copy diploid -> CARRIER;
      2 copies -> AFFECTED; 1 copy on a haploid call (X-linked male) -> AFFECTED.
    A covering record with no real call -> NOT_COVERED.
    """
    if rec_pos == entry["pos"] and rec_ref == entry["ref"] and rec_alts:
        for i, alt in enumerate(rec_alts, start=1):
            if alt == entry["alt"]:
                called = [a for a in gt_alleles if a is not None and a >= 0]
                copies = sum(1 for a in called if a == i)
                if copies == 0:
                    return ("CLEAR" if called else "NOT_COVERED"), None
                if copies >= 2:
                    return "AFFECTED", i
                # exactly one copy
                if len(called) == 1:  # hemizygous (X-linked, male)
                    return "AFFECTED", i
                return "CARRIER", i
    called = [a for a in gt_alleles if a is not None and a >= 0]
    if not called:
        return "NOT_COVERED", None
    return "CLEAR", None
