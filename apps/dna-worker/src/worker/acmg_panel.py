"""Curated ACMG-style actionable-variant panel.

For a small set of well-characterized, high-impact pathogenic variants in
clinically actionable genes (hereditary cancer, familial hypercholesterolemia,
amyloidosis, etc.), resolve an explicit verdict against the raw gVCF at ingest:

  CARRIED      — the sample carries the specific pathogenic allele (with zygosity)
  NOT_CARRIED  — the site is reference / the pathogenic allele is absent (the
                 reassuring negative, otherwise invisible because hom-ref blocks
                 never reach the Variant table)
  NOT_COVERED  — no reliable call at the site

Each entry targets ONE specific (chrom, pos, ref, alt) pathogenic allele. This is
NOT full-gene sequencing: a NOT_CARRIED result rules out only that variant, not
other pathogenic variants in the same gene. Coordinates are 1-based GRCh38,
verified against the ClinVar coordinate map. Indels (BRCA founder variants) are
matched by exact representation and flagged confidence=LOW, since short-read
indel representation is normalization-sensitive.

This panel is informational, not diagnostic: any CARRIED finding needs clinical
confirmation and genetic counseling.
"""

_NOT_COVERED_MSG = (
    "Sito non valutabile: nessuna chiamata affidabile a questa posizione nel sequenziamento."
)

# Caveat appended to every NOT_CARRIED verdict: the panel checks one variant per gene.
_PANEL_SCOPE_CAVEAT = (
    " Questo pannello controlla una variante specifica: un risultato negativo NON esclude "
    "altre varianti patogeniche nello stesso gene."
)

ACMG_PANEL = [
    {
        "rs_id": "rs5742904", "gene": "APOB", "variant_name": "c.10580G>A (p.Arg3527Gln)",
        "condition": "Ipercolesterolemia familiare (FH)", "inheritance": "Autosomica dominante",
        "chrom": "2", "pos": 21006288, "ref": "C", "alt": "T",
        "interpretation": {
            "CARRIED": "Porti la variante APOB R3527Gln: causa nota di ipercolesterolemia familiare (LDL elevato dalla nascita, rischio cardiovascolare precoce). Anche in eterozigosi e' clinicamente rilevante; valuta profilo lipidico e consulenza specialistica.",
            "NOT_CARRIED": "Non porti la variante APOB R3527Gln (la causa piu' comune di FH legata ad APOB): nessun rischio di FH da questa variante.",
        },
    },
    {
        "rs_id": "rs1801155", "gene": "APC", "variant_name": "c.3920T>A (p.Ile1307Lys)",
        "condition": "Rischio aumentato di tumore del colon-retto", "inheritance": "Dominante (penetranza moderata)",
        "chrom": "5", "pos": 112839514, "ref": "T", "alt": "A",
        "interpretation": {
            "CARRIED": "Porti l'allele APC I1307K: associato a un rischio di tumore del colon-retto circa raddoppiato (frequente negli ebrei ashkenaziti). Non e' la poliposi classica (FAP), ma giustifica uno screening colonscopico anticipato/piu' frequente.",
            "NOT_CARRIED": "Non porti l'allele APC I1307K: nessun rischio aggiuntivo di tumore del colon-retto da questa variante.",
        },
    },
    {
        "rs_id": "rs28934578", "gene": "TP53", "variant_name": "c.524G>A (p.Arg175His)",
        "condition": "Sindrome di Li-Fraumeni", "inheritance": "Autosomica dominante",
        "chrom": "17", "pos": 7675088, "ref": "C", "alt": "T",
        "interpretation": {
            "CARRIED": "Porti la variante TP53 R175His: una delle mutazioni piu' note della sindrome di Li-Fraumeni (predisposizione a tumori multipli a esordio precoce). Richiede conferma clinica e consulenza genetica dedicata.",
            "NOT_CARRIED": "Non porti la variante TP53 R175His (hotspot di Li-Fraumeni): nessun rischio da questa variante.",
        },
    },
    {
        "rs_id": "rs28929474", "gene": "SERPINA1", "variant_name": "c.1096G>A (p.Glu342Lys, allele Z / PiZ)",
        "condition": "Deficit di alfa-1 antitripsina", "inheritance": "Codominante",
        "chrom": "14", "pos": 94378610, "ref": "C", "alt": "T",
        "interpretation": {
            "CARRIED": "Porti l'allele Z (PiZ) di SERPINA1. In omozigosi (ZZ) -> deficit grave di alfa-1 antitripsina (rischio di enfisema, soprattutto nei fumatori, e di malattia epatica). In eterozigosi (MZ) -> portatore con rischio lieve/moderato, accentuato dal fumo. Usa genotype/zygosity per distinguere.",
            "NOT_CARRIED": "Non porti l'allele Z di SERPINA1: nessun deficit di alfa-1 antitripsina da questa variante (l'allele S, piu' lieve, non e' incluso in questo pannello).",
        },
    },
    {
        "rs_id": "rs76992529", "gene": "TTR", "variant_name": "c.424G>A (p.Val142Ile)",
        "condition": "Amiloidosi ereditaria da transtiretina", "inheritance": "Autosomica dominante",
        "chrom": "18", "pos": 31598655, "ref": "G", "alt": "A",
        "interpretation": {
            "CARRIED": "Porti la variante TTR V142Ile (nota anche come V122I): associata ad amiloidosi cardiaca/neurologica a esordio adulto (penetranza variabile, eta'-dipendente). Piu' frequente in persone di origine africana. Valuta sorveglianza cardiologica e consulenza.",
            "NOT_CARRIED": "Non porti la variante TTR V142Ile: nessun rischio di amiloidosi ereditaria da transtiretina da questa variante.",
        },
    },
    {
        "rs_id": "rs80357906", "gene": "BRCA1", "variant_name": "c.5266dupC (5382insC)",
        "condition": "Sindrome eredo-familiare seno-ovaio (HBOC)", "inheritance": "Autosomica dominante",
        "chrom": "17", "pos": 43057062, "ref": "T", "alt": "TG", "confidence": "LOW",
        "interpretation": {
            "CARRIED": "Porti la mutazione fondatrice BRCA1 c.5266dupC (5382insC): patogenica, aumenta in modo marcato il rischio di tumore di seno e ovaio. Richiede conferma clinica e consulenza genetica.",
            "NOT_CARRIED": "Non porti la mutazione fondatrice BRCA1 c.5266dupC (5382insC). NB: chiamata di indel da short-read; un negativo va confermato con test mirato se c'e' forte sospetto clinico/familiare.",
        },
    },
    {
        "rs_id": "rs80359550", "gene": "BRCA2", "variant_name": "c.5946delT (6174delT)",
        "condition": "Sindrome eredo-familiare seno-ovaio (HBOC)", "inheritance": "Autosomica dominante",
        "chrom": "13", "pos": 32340300, "ref": "GT", "alt": "G", "confidence": "LOW",
        "interpretation": {
            "CARRIED": "Porti la mutazione fondatrice BRCA2 c.5946delT (6174delT): patogenica, aumenta il rischio di tumore di seno e ovaio (e altri). Richiede conferma clinica e consulenza genetica.",
            "NOT_CARRIED": "Non porti la mutazione fondatrice BRCA2 c.5946delT (6174delT). NB: chiamata di indel da short-read; un negativo va confermato con test mirato se c'e' forte sospetto clinico/familiare.",
        },
    },
    {
        "rs_id": "rs6025", "gene": "F5", "variant_name": "c.1601G>A (p.Arg534Gln / R506Q, Factor V Leiden)",
        "condition": "Trombofilia ereditaria (Factor V Leiden)",
        "inheritance": "Autosomica dominante (penetranza moderata)",
        "chrom": "1", "pos": 169549811, "ref": "C", "alt": "T",
        "interpretation": {
            "CARRIED": "Porti la mutazione Factor V Leiden (R506Q): predispone a trombosi venosa profonda (~5x in eterozigosi, ~10x in omozigosi). Penetranza moderata: la maggior parte dei portatori non sviluppera' eventi tromboembolici. Rilevante per scelte cliniche su contraccettivi estro-progestinici, gravidanza, immobilizzazione prolungata, anestesia, anticoagulanti. Discutere con un medico le situazioni a rischio.",
            "NOT_CARRIED": "Non porti la mutazione Factor V Leiden: nessun rischio aumentato di trombosi venosa profonda da questa variante.",
        },
    },
    {
        "rs_id": "rs1799963", "gene": "F2", "variant_name": "c.*97G>A (Prothrombin G20210A)",
        "condition": "Trombofilia ereditaria (Prothrombin G20210A)",
        "inheritance": "Autosomica dominante (penetranza moderata)",
        "chrom": "11", "pos": 46739505, "ref": "G", "alt": "A",
        "interpretation": {
            "CARRIED": "Porti la variante Prothrombin G20210A: aumenta i livelli di protrombina e il rischio di trombosi venosa profonda (~3x in eterozigosi). Penetranza moderata. Vale lo stesso discorso del Leiden su contraccettivi/gravidanza/anestesia; la compresenza con Leiden (eterozigote composto) eleva ulteriormente il rischio.",
            "NOT_CARRIED": "Non porti la variante Prothrombin G20210A: nessun rischio aumentato di trombosi da questa variante.",
        },
    },
    {
        "rs_id": "rs80357914", "gene": "BRCA1", "variant_name": "c.68_69delAG (185delAG)",
        "condition": "Sindrome eredo-familiare seno-ovaio (HBOC)", "inheritance": "Autosomica dominante",
        "chrom": "17", "pos": 43124027, "ref": "ACT", "alt": "A", "confidence": "LOW",
        "interpretation": {
            "CARRIED": "Porti la mutazione fondatrice BRCA1 c.68_69delAG (185delAG): patogenica, aumenta in modo marcato il rischio di tumore di seno e ovaio. Richiede conferma clinica e consulenza genetica.",
            "NOT_CARRIED": "Non porti la mutazione fondatrice BRCA1 c.68_69delAG (185delAG). NB: chiamata di indel da short-read con rappresentazione variabile; un negativo va confermato con test mirato se c'e' forte sospetto clinico/familiare.",
        },
    },
    # ---- Varianti mitocondriali patogeniche (eredità materna) ----------------
    # mtDNA è aploide. Il quadro clinico dipende dall'ETEROPLASMIA (% di copie
    # mtDNA mutate): per la maggior parte delle varianti la manifestazione
    # richiede tipicamente >60-80% di carico. Il livello esatto va quantificato
    # con un'analisi dedicata, non si legge direttamente dalla chiamata 0/1.
    {
        "rs_id": "rs199474657", "gene": "MT-TL1", "variant_name": "m.3243A>G",
        "condition": "Sindrome MELAS (encefalomiopatia mitocondriale, acidosi lattica, stroke-like)",
        "inheritance": "Mitocondriale (eredita' materna)",
        "chrom": "MT", "pos": 3243, "ref": "A", "alt": "G",
        "interpretation": {
            "CARRIED": "Porti la variante mitocondriale m.3243A>G (MELAS, PATHOGENIC 3★ expert panel). NB: il quadro clinico mitocondriale dipende dall'ETEROPLASMIA (proporzione di copie mtDNA mutate nel tessuto); manifestazioni tipiche sopra il 60-80%. Richiede quantificazione dell'eteroplasmia con metodica dedicata e consulenza specialistica.",
            "NOT_CARRIED": "Non porti la variante MELAS m.3243A>G: nessun rischio di sindrome MELAS da questa variante.",
        },
    },
    {
        "rs_id": "rs199476112", "gene": "MT-ND4", "variant_name": "m.11778G>A",
        "condition": "Neuropatia ottica ereditaria di Leber (LHON)",
        "inheritance": "Mitocondriale (eredita' materna)",
        "chrom": "MT", "pos": 11778, "ref": "G", "alt": "A",
        "interpretation": {
            "CARRIED": "Porti la variante mtDNA m.11778G>A (LHON, la piu' comune in Europa, PATHOGENIC 3★). LHON ha penetranza incompleta (≈50% nei maschi, ≈10% nelle femmine portatrici) e dipende anche da eteroplasmia, fumo, alcol. Richiede valutazione oftalmologica e consulenza.",
            "NOT_CARRIED": "Non porti la variante LHON m.11778G>A: nessun rischio di LHON da questa variante.",
        },
    },
    {
        "rs_id": "rs199476118", "gene": "MT-ND1", "variant_name": "m.3460G>A",
        "condition": "Neuropatia ottica ereditaria di Leber (LHON)",
        "inheritance": "Mitocondriale (eredita' materna)",
        "chrom": "MT", "pos": 3460, "ref": "G", "alt": "A",
        "interpretation": {
            "CARRIED": "Porti la variante mtDNA m.3460G>A (LHON, seconda piu' comune, PATHOGENIC 3★). Penetranza incompleta, modulata da eteroplasmia e fattori ambientali. Richiede valutazione oftalmologica e consulenza.",
            "NOT_CARRIED": "Non porti la variante LHON m.3460G>A: nessun rischio di LHON da questa variante.",
        },
    },
    {
        "rs_id": "rs199476104", "gene": "MT-ND6", "variant_name": "m.14484T>C",
        "condition": "Neuropatia ottica ereditaria di Leber (LHON)",
        "inheritance": "Mitocondriale (eredita' materna)",
        "chrom": "MT", "pos": 14484, "ref": "T", "alt": "C",
        "interpretation": {
            "CARRIED": "Porti la variante mtDNA m.14484T>C (LHON, terza piu' comune, PATHOGENIC 3★). Tende ad avere prognosi visiva migliore rispetto a m.11778G>A. Valutazione oftalmologica e consulenza.",
            "NOT_CARRIED": "Non porti la variante LHON m.14484T>C: nessun rischio di LHON da questa variante.",
        },
    },
    {
        "rs_id": "rs118192098", "gene": "MT-TK", "variant_name": "m.8344A>G",
        "condition": "Sindrome MERRF (mioclono, epilessia, fibre rosse stracciate)",
        "inheritance": "Mitocondriale (eredita' materna)",
        "chrom": "MT", "pos": 8344, "ref": "A", "alt": "G",
        "interpretation": {
            "CARRIED": "Porti la variante mitocondriale m.8344A>G (MERRF, PATHOGENIC 3★). Quadro clinico dipendente dall'eteroplasmia; richiede quantificazione dedicata e valutazione neurologica.",
            "NOT_CARRIED": "Non porti la variante MERRF m.8344A>G: nessun rischio di MERRF da questa variante.",
        },
    },
    {
        "rs_id": "rs199476133", "gene": "MT-ATP6", "variant_name": "m.8993T>G",
        "condition": "NARP / Sindrome di Leigh materna (MILS)",
        "inheritance": "Mitocondriale (eredita' materna)",
        "chrom": "MT", "pos": 8993, "ref": "T", "alt": "G",
        "interpretation": {
            "CARRIED": "Porti la variante mitocondriale m.8993T>G (NARP/Leigh, PATHOGENIC 3★). A carichi eteroplasmici alti (>~90%) si manifesta come Leigh (MILS) infantile; carichi intermedi danno NARP (neuropatia, atassia, retinite pigmentosa). Richiede quantificazione e valutazione specialistica.",
            "NOT_CARRIED": "Non porti la variante NARP/Leigh m.8993T>G: nessun rischio di queste condizioni da questa variante.",
        },
    },
]

# Append the panel-scope caveat to every reassuring negative, and a shared
# NOT_COVERED message everywhere.
for _e in ACMG_PANEL:
    _e["interpretation"]["NOT_CARRIED"] += _PANEL_SCOPE_CAVEAT
    _e["interpretation"].setdefault("NOT_COVERED", _NOT_COVERED_MSG)

# Index by chromosome for cheap per-record lookup during the single parse pass.
ACMG_BY_CHROM: dict[str, list[dict]] = {}
for _e in ACMG_PANEL:
    ACMG_BY_CHROM.setdefault(_e["chrom"], []).append(_e)

# A definitive CARRIED must not be downgraded by a later covering record.
STATE_RANK = {"NOT_COVERED": 1, "NOT_CARRIED": 2, "CARRIED": 3}


def classify_acmg(entry: dict, rec_pos: int, rec_ref: str, rec_alts: list[str], gt_alleles) -> tuple[str, int | None]:
    """State for an ACMG site given a covering gVCF record.

    Returns (state, matched_alt_index). CARRIED only when the sample carries the
    SPECIFIC pathogenic allele (exact pos+ref+alt match and that alt index present
    in the genotype). A covering record with a real call but not the pathogenic
    allele -> NOT_CARRIED (reference block, or a different variant at the site).
    No real call -> NOT_COVERED.
    """
    if rec_pos == entry["pos"] and rec_ref == entry["ref"] and rec_alts:
        for i, alt in enumerate(rec_alts, start=1):
            if alt == entry["alt"] and any(a == i for a in gt_alleles):
                return "CARRIED", i
    called = [a for a in gt_alleles if a is not None and a >= 0]
    if not called:
        return "NOT_COVERED", None
    return "NOT_CARRIED", None
