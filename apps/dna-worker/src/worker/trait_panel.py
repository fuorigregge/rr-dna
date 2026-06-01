"""Curated trait / pharmacogenomic SNP panel.

Resolved against the raw gVCF at ingest so each listed SNP gets an explicit
verdict — CARRIED / REFERENCE (homozygous reference = standard genotype) /
NOT_COVERED — instead of silently vanishing when the sample matches the
reference (gVCF reference blocks are dropped from the Variant table).

Coordinates are 1-based GRCh38 (same as the VCF), verified against the ClinVar
coordinate map. Interpretations are allele-direction-aware: note ADH1B rs1229984,
where the GRCh38 reference allele is the *rarer* fast (His48/*2) allele, so
REFERENCE here is the notable genotype — not CARRIED.
"""

_NOT_COVERED_MSG = (
    "Sito non valutabile: nessuna chiamata affidabile a questa posizione nel sequenziamento."
)

TRAIT_PANEL = [
    {
        "rs_id": "rs762551", "gene": "CYP1A2", "trait": "Metabolismo della caffeina",
        "category": "METABOLISM", "chrom": "15", "pos": 74749576, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento per CYP1A2: cinetica della caffeina nella norma.",
            "CARRIED": "Porti l'allele A (CYP1A2*1F): associato a metabolismo della caffeina tipicamente piu' rapido (accelerato dal fumo, rallentato da alcuni farmaci).",
        },
    },
    {
        "rs_id": "rs4988235", "gene": "MCM6/LCT", "trait": "Persistenza della lattasi (lattosio)",
        "category": "METABOLISM", "chrom": "2", "pos": 135851076, "ref": "G",
        "interpretation": {
            "REFERENCE": "Allele ancestrale: lattasi non-persistenza -> tendenza all'intolleranza al lattosio in eta' adulta (genotipo comune nel mondo, minoritario in Europa).",
            "CARRIED": "Porti l'allele di persistenza della lattasi -> tolleranza al lattosio mantenuta in eta' adulta.",
        },
    },
    {
        "rs_id": "rs182549", "gene": "MCM6/LCT", "trait": "Persistenza della lattasi (sito linkato)",
        "category": "METABOLISM", "chrom": "2", "pos": 135859184, "ref": "C",
        "interpretation": {
            "REFERENCE": "Allele di riferimento al sito linkato alla persistenza della lattasi: coerente con non-persistenza.",
            "CARRIED": "Porti l'allele linkato alla persistenza della lattasi.",
        },
    },
    {
        "rs_id": "rs1229984", "gene": "ADH1B", "trait": "Metabolismo dell'alcol (ADH1B)",
        "category": "METABOLISM", "chrom": "4", "pos": 99318162, "ref": "T",
        "interpretation": {
            # NB: il riferimento GRCh38 qui e' l'allele His48 (ADH1B*2), quello "veloce".
            "REFERENCE": "Allele di riferimento His48 (ADH1B*2): metabolizzatore RAPIDO etanolo->acetaldeide (tende a flush/intolleranza). Raro in Europa.",
            "CARRIED": "Porti l'allele Arg48 (ADH1B*1): metabolismo dell'alcol standard. Comune in Europa.",
        },
    },
    {
        "rs_id": "rs671", "gene": "ALDH2", "trait": "Smaltimento acetaldeide (ALDH2)",
        "category": "METABOLISM", "chrom": "12", "pos": 111803962, "ref": "G",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento ALDH2*1: attivita' ALDH2 normale, nessun 'flush' da alcol di origine ALDH2.",
            "CARRIED": "Porti l'allele ALDH2*2: carenza di ALDH2 -> accumulo di acetaldeide, flush/intolleranza all'alcol (comune in Asia orientale).",
        },
    },
    {
        "rs_id": "rs16969968", "gene": "CHRNA5", "trait": "Risposta alla nicotina / dipendenza (CHRNA5)",
        "category": "METABOLISM", "chrom": "15", "pos": 78590583, "ref": "G",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento (Asp398, GG): l'allele CHRNA5 associato a maggior dipendenza NON e' presente — risposta alla nicotina nella media.",
            "CARRIED": "Porti l'allele A (Asn398, D398N) del recettore nicotinico CHRNA5: associato a maggiore dipendenza da nicotina, consumo di sigarette piu' alto e, nei fumatori, rischio di cancro al polmone aumentato (GA effetto intermedio, AA pieno). NB: riguarda la RISPOSTA/dipendenza recettoriale, non il metabolismo enzimatico della nicotina (CYP2A6, non valutabile in modo affidabile da questo dato). Rilevante soprattutto in caso di esposizione al fumo.",
        },
    },
    {
        "rs_id": "rs1815739", "gene": "ACTN3", "trait": "Profilo muscolare (ACTN3 R577X)",
        "category": "PHYSICAL", "chrom": "11", "pos": 66560624, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo RR (alfa-actinina-3 presente): profilo associato a potenza/sprint.",
            "CARRIED": "Porti l'allele X (577X): riduce/elimina l'alfa-actinina-3. CT = profilo intermedio, TT = profilo associato a resistenza.",
        },
    },
    {
        "rs_id": "rs1799752", "gene": "ACE", "trait": "ACE I/D (resistenza vs potenza)",
        "category": "PHYSICAL", "chrom": "17", "pos": 63488529, "ref": "T",
        "confidence": "LOW",
        "interpretation": {
            "REFERENCE": "Sembra D/D (nessuna inserzione rilevata): associato a forza/potenza. ATTENZIONE: l'inserzione Alu da 287bp e' poco rilevabile da short-read -> possibile falso negativo.",
            "CARRIED": "Porti l'inserzione (allele I): associato a profilo di resistenza/endurance.",
        },
    },
    {
        "rs_id": "rs1801133", "gene": "MTHFR", "trait": "Metabolismo dei folati (MTHFR C677T)",
        "category": "METABOLISM", "chrom": "1", "pos": 11796321, "ref": "G",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento C677 (CC): attivita' MTHFR normale, metabolismo dei folati nella norma.",
            "CARRIED": "Porti l'allele 677T: ridotta attivita' MTHFR -> metabolismo dei folati ridotto (CT lieve, TT marcato); rilevante per folati e omocisteina.",
        },
    },
    {
        "rs_id": "rs1801131", "gene": "MTHFR", "trait": "Metabolismo dei folati (MTHFR A1298C)",
        "category": "METABOLISM", "chrom": "1", "pos": 11794419, "ref": "T",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento A1298 (AA): attivita' MTHFR normale a questo sito.",
            "CARRIED": "Porti l'allele 1298C: lieve riduzione dell'attivita' MTHFR (effetto minore del C677T); conta soprattutto in combinazione col C677T.",
        },
    },
    {
        "rs_id": "rs2282679", "gene": "GC", "trait": "Livelli di vitamina D (GC)",
        "category": "METABOLISM", "chrom": "4", "pos": 71742666, "ref": "T",
        "interpretation": {
            "REFERENCE": "Allele di riferimento GC: nessun effetto al ribasso da questo locus sulla vitamina D.",
            "CARRIED": "Porti l'allele G (GC, binding protein): associato a vitamina D circolante piu' bassa (GG = effetto pieno). E' uno dei loci principali della 25(OH)D.",
        },
    },
    {
        "rs_id": "rs10741657", "gene": "CYP2R1", "trait": "Sintesi di vitamina D (CYP2R1)",
        "category": "METABOLISM", "chrom": "11", "pos": 14893332, "ref": "A",
        "interpretation": {
            "REFERENCE": "Allele di riferimento CYP2R1: nessun effetto al ribasso da questo locus.",
            "CARRIED": "Porti l'allele G (CYP2R1, 25-idrossilasi): associato a vitamina D piu' bassa.",
        },
    },
    {
        "rs_id": "rs12785878", "gene": "DHCR7/NADSYN1", "trait": "Sintesi di vitamina D (DHCR7)",
        "category": "METABOLISM", "chrom": "11", "pos": 71456403, "ref": "G",
        "interpretation": {
            # Qui il riferimento (G) e' l'allele associato a vitamina D piu' BASSA; l'alternativo T la aumenta.
            "REFERENCE": "Genotipo GG (allele di riferimento): associato a vitamina D piu' bassa (l'allele alternativo T e' quello che la aumenta).",
            "CARRIED": "Porti l'allele T (DHCR7): allele associato a vitamina D piu' alta.",
        },
    },
    {
        "rs_id": "rs601338", "gene": "FUT2", "trait": "Status secretore / vitamina B12 (FUT2)",
        "category": "METABOLISM", "chrom": "19", "pos": 48703417, "ref": "G",
        "interpretation": {
            "REFERENCE": "Secretore (FUT2 funzionale): antigeni dei gruppi sanguigni secreti nei fluidi; B12 sierica tipicamente piu' bassa; piu' suscettibile ad alcuni norovirus.",
            "CARRIED": "Porti l'allele non-secretore (A, nonsenso W143X). Solo in omozigosi (AA) sei non-secretore: B12 sierica piu' alta, microbiota intestinale diverso, resistenza ad alcuni norovirus. In eterozigosi resti secretore.",
        },
    },
    {
        "rs_id": "rs1800562", "gene": "HFE", "trait": "Sovraccarico di ferro (HFE C282Y)",
        "category": "METABOLISM", "chrom": "6", "pos": 26092913, "ref": "G",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento HFE C282: nessun allele C282Y di sovraccarico di ferro.",
            "CARRIED": "Porti l'allele C282Y (HFE). AA (omozigote) = principale genotipo a rischio di emocromatosi/sovraccarico di ferro; AG = portatore. Clinicamente valutabile con ferritina/saturazione transferrina.",
        },
    },
    {
        "rs_id": "rs1799945", "gene": "HFE", "trait": "Sovraccarico di ferro (HFE H63D)",
        "category": "METABOLISM", "chrom": "6", "pos": 26090951, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento HFE H63: nessuna variante H63D.",
            "CARRIED": "Porti l'allele H63D (HFE): variante piu' lieve; rischio di sovraccarico di ferro soprattutto come composto eterozigote con C282Y.",
        },
    },
    {
        "rs_id": "rs713598", "gene": "TAS2R38", "trait": "Percezione dell'amaro (TAS2R38)",
        "category": "PHYSICAL", "chrom": "7", "pos": 141973545, "ref": "C",
        "interpretation": {
            "REFERENCE": "Allele di riferimento (Pro): tipicamente 'taster' per l'amaro (PTC/PROP) — percepisci l'amaro piu' intensamente.",
            "CARRIED": "Porti l'allele Ala (non-taster). GG = non-taster (percepisci meno l'amaro, possibile maggiore gradimento delle verdure amare); CG = intermedio.",
        },
    },
    {
        "rs_id": "rs4680", "gene": "COMT", "trait": "Dopamina prefrontale (COMT Val158Met)",
        "category": "COGNITIVE", "chrom": "22", "pos": 19963748, "ref": "G",
        "interpretation": {
            "REFERENCE": "Genotipo Val/Val ('warrior'): clearance della dopamina prefrontale piu' rapida; tendenzialmente piu' resiliente allo stress. Effetto piccolo e contesto-dipendente.",
            "CARRIED": "Porti l'allele Met158 ('worrier'): dopamina prefrontale piu' persistente; AA associato a migliori memoria/attenzione ma maggiore reattivita' a stress/dolore. Effetti piccoli, modulati dal contesto.",
        },
    },
    {
        "rs_id": "rs6265", "gene": "BDNF", "trait": "Neuroplasticita' (BDNF Val66Met)",
        "category": "COGNITIVE", "chrom": "11", "pos": 27658369, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo Val/Val: secrezione di BDNF attivita'-dipendente nella norma.",
            "CARRIED": "Porti l'allele Met66: ridotta secrezione di BDNF attivita'-dipendente; associato (effetti piccoli) a differenze in memoria episodica e risposta a stress/ansia.",
        },
    },
    {
        "rs_id": "rs174537", "gene": "FADS1", "trait": "Metabolismo acidi grassi / omega (FADS1)",
        "category": "METABOLISM", "chrom": "11", "pos": 61785208, "ref": "G",
        "interpretation": {
            "REFERENCE": "Genotipo GG: conversione efficiente dei PUFA -> buona sintesi endogena di omega-3/6 a catena lunga (EPA/DHA/arachidonico) dai precursori vegetali.",
            "CARRIED": "Porti l'allele T (FADS1): conversione PUFA ridotta (TT ~meta' del GG); sintesi endogena di omega a catena lunga inferiore -> conta di piu' l'apporto diretto (pesce/EPA-DHA).",
        },
    },
    {
        "rs_id": "rs12913832", "gene": "HERC2/OCA2", "trait": "Colore degli occhi (HERC2/OCA2)",
        "category": "PHYSICAL", "chrom": "15", "pos": 28120472, "ref": "A",
        "interpretation": {
            "REFERENCE": "Genotipo AA (riferimento): allele 'occhi marroni' in omozigosi -> tendenza al marrone scuro. Singolo SNP, ma spiega la maggior parte della variazione del colore degli occhi nelle popolazioni europee.",
            # Eterozigote A/G: UNA sola copia di G non basta per gli occhi azzurri (servono due copie).
            "CARRIED_HET": "Sei eterozigote A/G: una sola copia dell'allele G NON basta per gli occhi azzurri (servono due copie, GG). Fenotipo tipico intermedio -> verde, nocciola o marrone chiaro. L'allele G riduce l'espressione di OCA2, ma in singola dose l'effetto e' solo parziale; il colore finale dipende anche da altri geni.",
            # Omozigote G/G: doppia copia -> azzurri probabili.
            "CARRIED_HOM": "Sei omozigote G/G: occhi azzurri molto probabili. La doppia copia dell'allele G spegne l'enhancer di HERC2 -> poco OCA2 -> poca melanina nell'iride.",
            # Fallback se la zigosita' non e' disponibile.
            "CARRIED": "Porti l'allele G (riduce l'espressione di OCA2): GG = occhi azzurri probabili, AG = intermedio (verdi, nocciola, marrone chiaro). NB: serve la doppia copia G per gli occhi azzurri.",
        },
    },
    {
        "rs_id": "rs1426654", "gene": "SLC24A5", "trait": "Pigmentazione cutanea (SLC24A5 Ala111Thr)",
        "category": "PHYSICAL", "chrom": "15", "pos": 48134287, "ref": "A",
        "interpretation": {
            # NB: il riferimento (A) e' l'allele derivato europeo Thr111 (pelle chiara);
            # l'alternativo G e' l'ancestrale Ala111 (pigmentazione piu' scura).
            "REFERENCE": "Genotipo AA (Thr/Thr): omozigote per la variante europea Ala111Thr -> pigmentazione chiara, fenotipo tipico delle popolazioni dell'Europa occidentale (frequenza ~99% in Europa).",
            "CARRIED": "Porti l'allele G (Ala111, ancestrale): associato a pigmentazione cutanea piu' scura per copia; piu' comune in popolazioni africane, sud-asiatiche, est-asiatiche. AG = intermedio, GG = pieno fenotipo ancestrale.",
        },
    },
    {
        "rs_id": "rs1805007", "gene": "MC1R", "trait": "MC1R R151C (capelli rossi / pelle chiara)",
        "category": "PHYSICAL", "chrom": "16", "pos": 89919709, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento MC1R a R151: nessuna variante R151C in questo sito (uno dei tre principali alleli 'red hair').",
            "CARRIED": "Porti l'allele T (MC1R R151C): variante loss-of-function del recettore della melanocortina; in combinazione con altre varianti MC1R contribuisce al fenotipo 'red hair / fair skin' (capelli rossi, pelle chiara, lentiggini, sensibilita' UV).",
        },
    },
    {
        "rs_id": "rs1805008", "gene": "MC1R", "trait": "MC1R R160W (capelli rossi / pelle chiara)",
        "category": "PHYSICAL", "chrom": "16", "pos": 89919736, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento MC1R a R160: nessuna variante R160W in questo sito.",
            "CARRIED": "Porti l'allele T (MC1R R160W): variante loss-of-function MC1R; concorre con le altre varianti R/RH al fenotipo capelli rossi / pelle chiara / sensibilita' UV.",
        },
    },
    {
        "rs_id": "rs1805009", "gene": "MC1R", "trait": "MC1R D294H (capelli rossi / pelle chiara)",
        "category": "PHYSICAL", "chrom": "16", "pos": 89920138, "ref": "G",
        "interpretation": {
            "REFERENCE": "Genotipo di riferimento MC1R a D294: nessuna variante D294H in questo sito.",
            "CARRIED": "Porti l'allele C (MC1R D294H): tra le varianti MC1R con effetto piu' forte sul fenotipo capelli rossi / pelle chiara / sensibilita' UV.",
        },
    },
    # --- Aspetto & curiosita': SNP singoli a effetto piccolo. Divertenti, NON diagnostici:
    # il fenotipo reale dipende da molti geni e dall'ambiente. Polarita' verificata su FASTA hg38.
    {
        "rs_id": "rs17822931", "gene": "ABCC11", "trait": "Cerume & odore corporeo",
        "category": "APPEARANCE", "chrom": "16", "pos": 48224287, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo CC: cerume UMIDO e odore ascellare tipico — il fenotipo della maggioranza di europei e africani. Lo stesso gene (ABCC11) regola cerume e ghiandole apocrine: stesso interruttore per entrambi.",
            "CARRIED": "Porti l'allele T (Gly180Arg): associato a cerume SECCO/squamoso e odore ascellare RIDOTTO. In omozigosi (TT) il tratto e' pieno; comune in Asia orientale, raro in Europa.",
        },
    },
    {
        "rs_id": "rs72921001", "gene": "OR6A2", "trait": "Coriandolo: sapore di sapone",
        "category": "APPEARANCE", "chrom": "11", "pos": 6868417, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo CC nel locus dei recettori olfattivi OR6A2, legato alla percezione del coriandolo (cilantro). Questo SNP spiega solo una piccola parte del fenomeno 'coriandolo = sapone': contano la genetica olfattiva piu' ampia e l'abitudine.",
            "CARRIED": "Porti una variante nel locus OR6A2 associato alla percezione del coriandolo. Effetto piccolo, non determinante.",
        },
    },
    {
        "rs_id": "rs4481887", "gene": "OR2M7", "trait": "Odore della pipi' dopo gli asparagi",
        "category": "APPEARANCE", "chrom": "1", "pos": 248333561, "ref": "A",
        "interpretation": {
            "REFERENCE": "Genotipo AA in un cluster di recettori olfattivi (OR2M7): tendenzialmente CAPACE di sentire l'odore caratteristico dell'urina dopo aver mangiato asparagi (quasi tutti lo PRODUCONO; non tutti lo percepiscono).",
            "CARRIED": "Porti l'allele G (anosmia per gli asparagi): associato a ridotta capacita' di percepire quell'odore. In eterozigosi l'effetto e' parziale.",
        },
    },
    {
        "rs_id": "rs10427255", "gene": "-", "trait": "Starnuto fotico (riflesso ACHOO)",
        "category": "APPEARANCE", "chrom": "2", "pos": 145367955, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo CC: associato a maggior tendenza allo STARNUTO FOTICO (starnutire passando alla luce intensa). Riflesso innocuo, presente in ~1 persona su 4.",
            "CARRIED": "Porti l'allele T: minor tendenza allo starnuto fotico rispetto a CC.",
        },
    },
    {
        "rs_id": "rs3827760", "gene": "EDAR", "trait": "Spessore dei capelli / incisivi a pala",
        "category": "APPEARANCE", "chrom": "2", "pos": 108897145, "ref": "A",
        "interpretation": {
            "REFERENCE": "Genotipo AA (ancestrale, europeo/africano): capelli di spessore tipico e incisivi 'piatti'.",
            "CARRIED": "Porti l'allele G (EDAR Val370Ala, derivato): capelli piu' SPESSI, piu' ghiandole sudoripare e incisivi 'a pala' (scavati sul retro). Variante selezionata in Asia orientale e nelle Americhe.",
        },
    },
    {
        "rs_id": "rs6152", "gene": "AR", "trait": "Calvizie androgenetica (X)",
        "category": "APPEARANCE", "chrom": "X", "pos": 67545785, "ref": "G",
        "interpretation": {
            "REFERENCE": "Allele G al recettore degli androgeni (AR, cromosoma X — nei maschi una sola copia): associato a rischio MINORE di calvizie androgenetica. NB: la calvizie e' poligenica, questo e' solo uno dei loci (il principale e' su X, ereditato dalla madre).",
            "CARRIED": "Porti l'allele A (AR): associato a rischio MAGGIORE di calvizie androgenetica. E' un fattore tra molti, non una condanna.",
        },
    },
    {
        "rs_id": "rs12203592", "gene": "IRF4", "trait": "Lentiggini & fotosensibilita'",
        "category": "APPEARANCE", "chrom": "6", "pos": 396321, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo CC: minor tendenza alle lentiggini legata a questo locus (IRF4 regola la melanogenesi).",
            "CARRIED": "Porti l'allele T (IRF4): associato a piu' LENTIGGINI, maggior sensibilita' al sole/fotoinvecchiamento e capelli leggermente piu' chiari. Uno dei locus piu' forti per le lentiggini.",
        },
    },
    {
        "rs_id": "rs16891982", "gene": "SLC45A2", "trait": "Pigmentazione (pelle/capelli/occhi)",
        "category": "APPEARANCE", "chrom": "5", "pos": 33951588, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo CC (ancestrale): pigmentazione piu' scura a questo locus; frequente fuori Europa.",
            "CARRIED": "Porti l'allele G (SLC45A2 Phe374Leu): allele di pelle/capelli/occhi piu' CHIARI, quasi fissato in Europa (>90%). In eterozigosi contribuisce parzialmente.",
        },
    },
    {
        "rs_id": "rs1042602", "gene": "TYR", "trait": "Lentiggini & abbronzatura (TYR)",
        "category": "APPEARANCE", "chrom": "11", "pos": 89178528, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo CC alla tirosinasi (TYR): pigmentazione di riferimento a questo sito.",
            "CARRIED": "Porti l'allele A (TYR Ser192Tyr): associato a piu' LENTIGGINI, pelle che si scotta piu' facilmente e occhi leggermente piu' chiari.",
        },
    },
    {
        "rs_id": "rs2153271", "gene": "BNC2", "trait": "Lentiggini (BNC2)",
        "category": "APPEARANCE", "chrom": "9", "pos": 16864523, "ref": "C",
        "interpretation": {
            "REFERENCE": "Genotipo CC al locus BNC2: minor contributo alle lentiggini da questo gene.",
            "CARRIED": "Porti l'allele T (BNC2): associato a maggior tendenza alle LENTIGGINI e a pelle chiara. BNC2 e' anche un locus introgresso dai Neanderthal.",
        },
    },
    {
        "rs_id": "rs11803731", "gene": "TCHH", "trait": "Capelli lisci vs ricci",
        "category": "APPEARANCE", "chrom": "1", "pos": 152110849, "ref": "A",
        "interpretation": {
            "REFERENCE": "Genotipo AA alla tricoialina (TCHH): tendenza a capelli piu' ondulati/ricci rispetto a chi porta l'allele 'liscio' (negli europei).",
            "CARRIED": "Porti l'allele T (TCHH): associato a capelli piu' LISCI negli europei. Effetto piccolo, la forma del capello e' poligenica.",
        },
    },
    {
        "rs_id": "rs12821256", "gene": "KITLG", "trait": "Capelli biondi",
        "category": "APPEARANCE", "chrom": "12", "pos": 88934558, "ref": "T",
        "interpretation": {
            "REFERENCE": "Genotipo TT al locus KITLG: non porti l'allele associato ai capelli biondi a questo sito.",
            "CARRIED": "Porti l'allele C (KITLG): associato a capelli piu' BIONDI negli europei (regola un enhancer di KITLG nel follicolo).",
        },
    },
    {
        "rs_id": "rs838133", "gene": "FGF21", "trait": "Preferenza per i dolci",
        "category": "APPEARANCE", "chrom": "19", "pos": 48756272, "ref": "A",
        "interpretation": {
            "REFERENCE": "Genotipo AA in FGF21 (ormone che modula l'appetito per i carboidrati): associato a un consumo di zuccheri/dolci tendenzialmente PIU' ALTO. Curiosamente l'allele 'goloso' e' qui il riferimento.",
            "CARRIED": "Porti l'allele G in FGF21: associato a un consumo di dolci tendenzialmente minore. Effetto piccolo, l'alimentazione conta molto di piu'.",
        },
    },
]

# Shared verdict for sites with no reliable call.
for _e in TRAIT_PANEL:
    _e["interpretation"].setdefault("NOT_COVERED", _NOT_COVERED_MSG)

# Index by chromosome for cheap per-record lookup during the single parse pass.
PANEL_BY_CHROM: dict[str, list[dict]] = {}
for _e in TRAIT_PANEL:
    PANEL_BY_CHROM.setdefault(_e["chrom"], []).append(_e)


# Higher rank wins when several records cover the same panel site (a definitive
# CARRIED call must not be downgraded by a later reference block).
STATE_RANK = {"NOT_COVERED": 1, "REFERENCE": 2, "CARRIED": 3}


def record_covers(panel_pos: int, rec_start: int, rec_end: int) -> bool:
    """True if a gVCF record spans the panel position.

    rec_end == rec_start for a variant line; for a reference block it is the END.
    """
    return rec_start <= panel_pos <= rec_end


# --- APOE: derived from two SNPs (rs429358 + rs7412) into the ε2/ε3/ε4 diplotype ---
# rs429358 alt allele (C) defines ε4; rs7412 alt allele (T) defines ε2; ε3 is neither.
APOE_SNPS = [
    {"rs_id": "rs429358", "chrom": "19", "pos": 44908684},  # ref T, alt C (ε4)
    {"rs_id": "rs7412", "chrom": "19", "pos": 44908822},    # ref C, alt T (ε2)
]
APOE_BY_CHROM: dict[str, list[dict]] = {}
for _s in APOE_SNPS:
    APOE_BY_CHROM.setdefault(_s["chrom"], []).append(_s)

_APOE_TABLE = {
    (0, 0): "ε3/ε3", (0, 1): "ε2/ε3", (0, 2): "ε2/ε2",
    (1, 0): "ε3/ε4", (1, 1): "ε2/ε4", (2, 0): "ε4/ε4",
}

APOE_INTERPRETATION = {
    "ε3/ε3": "Genotipo APOE piu' comune (ε3/ε3): rischio di Alzheimer a esordio tardivo nella media della popolazione.",
    "ε2/ε3": "ε2/ε3: l'allele ε2 e' associato a rischio di Alzheimer tardivo RIDOTTO (protettivo); puo' associarsi a trigliceridi piu' alti.",
    "ε2/ε2": "ε2/ε2 (raro): ε2 associato a rischio Alzheimer ridotto, ma possibile disbetalipoproteinemia (lipidi). Informazione sensibile.",
    "ε3/ε4": "ε3/ε4: un allele ε4 -> rischio di Alzheimer tardivo aumentato rispetto a ε3/ε3 (rischio RELATIVO a livello di popolazione, non una diagnosi). Informazione sensibile.",
    "ε2/ε4": "ε2/ε4: combinazione mista (un allele protettivo ε2 e uno di rischio ε4).",
    "ε4/ε4": "ε4/ε4: due alleli ε4 -> rischio di Alzheimer tardivo marcatamente aumentato (rischio RELATIVO, non destino). Informazione molto sensibile: valuta una consulenza genetica.",
}
APOE_NOT_COVERED = "Aplotipo APOE non determinabile: uno dei due SNP (rs429358/rs7412) non e' valutabile."


def apoe_diplotype(rs429358_alleles, rs7412_alleles) -> str | None:
    """Derive the APOE ε2/ε3/ε4 diplotype from the two defining SNP genotypes.

    Counts the alt allele at each site (rs429358 alt C = ε4; rs7412 alt T = ε2),
    assuming no ε1 (rs429358-C + rs7412-T in cis, vanishingly rare). Returns None
    for an uncalled site or an impossible combination.
    """
    def alt_count(alleles):
        called = [a for a in alleles if a is not None and a >= 0]
        if len(called) < 2:
            return None
        return called.count(1)

    c = alt_count(rs429358_alleles)
    t = alt_count(rs7412_alleles)
    if c is None or t is None:
        return None
    return _APOE_TABLE.get((c, t))


def resolve_interpretation(entry: dict, state: str, zygosity: str | None) -> str:
    """Interpretazione del pannello, sensibile alla zigosità quando serve.

    Per i tratti dose-dipendenti (es. colore degli occhi) l'entry può fornire
    `CARRIED_HET` / `CARRIED_HOM` oltre a `CARRIED`: si sceglie il testo più
    specifico in base alla zigosità del soggetto, evitando di descrivere il
    fenotipo omozigote estremo a un eterozigote (un solo allele G ≠ occhi azzurri).
    Per gli altri stati/tratti si usa il testo standard.
    """
    interp = entry["interpretation"]
    if state == "CARRIED":
        if zygosity == "HETEROZYGOUS" and "CARRIED_HET" in interp:
            return interp["CARRIED_HET"]
        if zygosity == "HOMOZYGOUS" and "CARRIED_HOM" in interp:
            return interp["CARRIED_HOM"]
    return interp[state]


def classify_covering(has_alt: bool, gt_alleles) -> str:
    """State for a panel site given the covering gVCF record.

    A variant call (ALT present) means the sample carries an alt allele -> CARRIED.
    A reference block with a real 0/0 call -> REFERENCE (standard genotype).
    A reference block whose genotype is all-missing (./.) -> NOT_COVERED.
    """
    if has_alt:
        return "CARRIED"
    called = [a for a in gt_alleles if a is not None and a >= 0]
    if not called:
        return "NOT_COVERED"
    return "REFERENCE"
