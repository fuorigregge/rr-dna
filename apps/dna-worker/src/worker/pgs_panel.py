"""Polygenic Risk Score genome-wide via PGS Catalog.

Scoring file dal PGS Catalog (da centinaia a milioni di SNP per score, con
effetto e frequenza popolazione armonizzati su GRCh38).

Architettura runtime:
- al primo avvio si scaricano i file in `src/data/pgs/` (vedi ensure_pgs)
- al boot del modulo costruiamo PGS_INDEX_SET: dict[chrom] -> set di posizioni
  (~7M per uno score genome-wide) per check O(1) durante parse_vcf
- durante parse: per ogni record gVCF che cade in PGS, catturiamo
  REF/ALT/genotype (per varianti) o segniamo come "coperto al riferimento"
  (per ref-block)
- al termine: per ogni PGS leggiamo di nuovo lo scoring file, e accumuliamo
  somma di n_effect_allele × weight, media e var attese da Hardy-Weinberg
  sulla frequenza popolazione, e z-score = (score-μ)/σ
"""
import math
from pathlib import Path

from src.worker.pgs_catalog import parse_pgs_header, iter_pgs_variants
from src.worker.genome_fasta import get_ref_base, is_available as fasta_available

PGS_DATA_DIR = Path(__file__).parent.parent / "data" / "pgs"

# Score selezionati dal PGS Catalog. Mix di tratti chiave (cardiovascolari,
# metabolici, oncologici); si aggiungono/rimuovono modificando questa lista.
PGS_SCORES = [
    {
        "pgs_id": "PGS000004",
        "trait_key": "BC_PGS",
        "trait": "Tumore al seno",
        "label": "Tumore al seno (PRS313 Mavaddat 2019)",
        "description": "313 SNP validato in larga coorte (Mavaddat 2019); usato in trial clinici.",
    },
    {
        "pgs_id": "PGS000018",
        "trait_key": "CAD_PGS",
        "trait": "Cardiopatia coronarica",
        "label": "Cardiopatia coronarica (metaGRS Inouye 2018)",
        "description": "Score genome-wide ~1,7M SNP (Inouye 2018, metaGRS).",
    },
    {
        "pgs_id": "PGS000014",
        "trait_key": "T2D_PGS",
        "trait": "Diabete tipo 2",
        "label": "Diabete tipo 2 (GPS_T2D Khera 2018)",
        "description": "Score genome-wide ~6,9M SNP (Khera 2018) per T2D.",
    },
    {
        "pgs_id": "PGS000027",
        "trait_key": "BMI_PGS",
        "trait": "Indice di massa corporea (BMI)",
        "label": "BMI (GPS_BMI Khera 2019)",
        "description": "Score genome-wide ~2,1M SNP (Khera 2019) per indice di massa corporea da adulto.",
    },
    {
        "pgs_id": "PGS000054",
        "trait_key": "ALZ_PGS",
        "trait": "Malattia di Alzheimer (esordio tardivo)",
        "label": "Alzheimer (ALZ21_EFIGA, Tosto 2017)",
        "description": "Score di 21 SNP per Alzheimer a esordio tardivo (Tosto 2017).",
    },
    {
        "pgs_id": "PGS000020",
        "trait_key": "T2D_DGRS",
        "trait": "Diabete tipo 2 (dGRS1000)",
        "label": "Diabete tipo 2 (dGRS1000 Vassy 2014)",
        "description": "Score di 7,5K SNP per T2D (Vassy 2014) — calibrato con frequenze allelica europea.",
    },
    {
        "pgs_id": "PGS000043",
        "trait_key": "VTE_PGS",
        "trait": "Trombosi venosa (VTE)",
        "label": "Trombosi venosa (VTE, Klarin 2019)",
        "description": "Score per il tromboembolismo venoso (Klarin 2019, 297 SNP) — calibrato. Complementa il pannello trombofilia ereditaria.",
    },
    {
        "pgs_id": "PGS000122",
        "trait_key": "BMD_PGS",
        "trait": "Densità minerale ossea (BMD, collo femorale)",
        "label": "Densità minerale ossea (BMD33 GRS, FN)",
        "description": "Score per la densità minerale ossea al collo femorale (33 SNP) — calibrato. Rischio relativo di osteoporosi.",
    },
    {
        "pgs_id": "PGS000040",
        "trait_key": "CD_PGS",
        "trait": "Celiachia",
        "label": "Celiachia (GRS_CeD, 228 SNP)",
        "description": "Score di 228 SNP per la celiachia — rilevante in popolazione italiana (HLA-DQ2/DQ8 al locus principale).",
    },
    {
        "pgs_id": "PGS000346",
        "trait_key": "BC_ER_NEG_PGS",
        "trait": "Tumore al seno (recettori estrogeno-negativi)",
        "label": "Tumore al seno ER-negativo (PRS287)",
        "description": "Score di 287 SNP specifico per il tumore al seno con recettori estrogeno-negativi (sottotipo più aggressivo) — complementa il PRS313 generale.",
    },
    # --- Espansione: ulteriori categorie cliniche -----------------------------
    {
        "pgs_id": "PGS000007", "trait_key": "BC_PRS3820", "trait": "Tumore al seno (PRS3820)",
        "label": "Tumore al seno (PRS3820 Mavaddat)", "description": "Score più ampio di 3.820 SNP per il tumore al seno (Mavaddat) — confronto con PRS313.",
    },
    {
        "pgs_id": "PGS000084", "trait_key": "PROSTATE_PGS", "trait": "Tumore alla prostata",
        "label": "Tumore alla prostata (CC_Prostate, 161 SNP)", "description": "Score di 161 SNP per il tumore della prostata.",
    },
    {
        "pgs_id": "PGS000351", "trait_key": "OVARIAN_PGS", "trait": "Tumore ovarico epiteliale invasivo",
        "label": "Tumore ovarico (PRS_EOC)", "description": "Score per il tumore ovarico epiteliale invasivo (30 SNP).",
    },
    {
        "pgs_id": "PGS000118", "trait_key": "MELANOMA_PGS", "trait": "Melanoma",
        "label": "Melanoma (MEL29)", "description": "Score di 29 SNP per il melanoma cutaneo.",
    },
    {
        "pgs_id": "PGS000119", "trait_key": "BCC_PGS", "trait": "Carcinoma basocellulare",
        "label": "Carcinoma basocellulare (BCC32)", "description": "Score di 32 SNP per il carcinoma basocellulare.",
    },
    {
        "pgs_id": "PGS000731", "trait_key": "SCC_PGS", "trait": "Carcinoma squamoso cutaneo",
        "label": "Carcinoma squamoso (PRS_SCC)", "description": "Score di 14 SNP per il carcinoma squamoso cutaneo.",
    },
    {
        "pgs_id": "PGS003386", "trait_key": "CRC_PGS", "trait": "Tumore colorettale",
        "label": "Tumore colorettale (best_COADREAD)", "description": "Score di 61 SNP per il tumore colorettale.",
    },
    {
        "pgs_id": "PGS000663", "trait_key": "PANC_PGS", "trait": "Tumore al pancreas",
        "label": "Tumore al pancreas (wGRS22)", "description": "Score di 22 SNP per il tumore al pancreas.",
    },
    {
        "pgs_id": "PGS000162", "trait_key": "THYROID_PGS", "trait": "Tumore alla tiroide",
        "label": "Tumore alla tiroide (cGRS_Thyroid)", "description": "Score di 6 SNP per il tumore alla tiroide.",
    },
    {
        "pgs_id": "PGS000038", "trait_key": "STROKE_PGS", "trait": "Ictus",
        "label": "Ictus (PRS90)", "description": "Score di 90 SNP per l'ictus.",
    },
    {
        "pgs_id": "PGS000709", "trait_key": "HF_PGS", "trait": "Insufficienza cardiaca",
        "label": "Insufficienza cardiaca (HC299, GW 183K)", "description": "Score genome-wide ~183.000 SNP per l'insufficienza cardiaca.",
    },
    {
        "pgs_id": "PGS001263", "trait_key": "AFLUTTER_PGS", "trait": "Flutter atriale",
        "label": "Flutter atriale (GBE_HC440, 2K SNP)", "description": "Score di 2.086 SNP per il flutter atriale.",
    },
    {
        "pgs_id": "PGS000661", "trait_key": "LDL_PGS", "trait": "Colesterolo LDL",
        "label": "Colesterolo LDL (PRS-LDL, 84 SNP)", "description": "Score di 84 SNP per il colesterolo LDL.",
    },
    {
        "pgs_id": "PGS000022", "trait_key": "T1D_PGS", "trait": "Diabete tipo 1",
        "label": "Diabete tipo 1 (T1D_GRS, 28 SNP)", "description": "Score di 28 SNP per il diabete tipo 1.",
    },
    {
        "pgs_id": "PGS000131", "trait_key": "HBA1C_PGS", "trait": "Emoglobina glicata (HbA1c)",
        "label": "HbA1c (GS-G-AFR, 19 SNP)", "description": "Score per l'emoglobina glicata.",
    },
    {
        "pgs_id": "PGS000126", "trait_key": "URATE_PGS", "trait": "Uricemia",
        "label": "Uricemia (Urate_GRS, 114 SNP)", "description": "Score di 114 SNP per i livelli di acido urico sierico — proxy per il rischio di gotta.",
    },
    {
        "pgs_id": "PGS001249", "trait_key": "GOUT_PGS", "trait": "Gotta",
        "label": "Gotta (GBE_HC1215, 42K)", "description": "Score di ~42.000 SNP per la gotta.",
    },
    {
        "pgs_id": "PGS002628", "trait_key": "ASTHMA_PGS", "trait": "Asma",
        "label": "Asma (PolyFun-pred GW 205K)", "description": "Score genome-wide ~205.000 SNP per l'asma diagnosticata.",
    },
    {
        "pgs_id": "PGS000124", "trait_key": "IOP_PGS", "trait": "Pressione intraoculare",
        "label": "Pressione intraoculare (IOP_AS)", "description": "Score di 103 SNP per la pressione intraoculare — proxy del rischio glaucoma.",
    },
    {
        "pgs_id": "PGS000350", "trait_key": "GLAUCOMA_PGS", "trait": "Glaucoma ad angolo aperto",
        "label": "Glaucoma POAG (GRS12)", "description": "Score di 12 SNP per il glaucoma primario ad angolo aperto.",
    },
    # --- Tratti non-malattia (kind="trait"): non sono rischi clinici ma posizioni
    #     su uno spettro fenotipico. Score compatti (hit genome-wide), catturano
    #     una frazione limitata della varianza → indicativi sulla direzione, non
    #     predittivi. Interpretazione neutra (vedi _interpret_trait). ---
    {
        "pgs_id": "PGS000297", "trait_key": "HEIGHT_PGS", "trait": "Altezza", "kind": "trait",
        "label": "Altezza (GRS3290, Xie 2020)",
        "description": "Score di 3.290 SNP per la statura adulta (lead SNP, coorte prevalentemente europea). Spiega solo una parte dell'altezza: nutrizione, sviluppo e migliaia di altri loci contano molto.",
    },
    {
        "pgs_id": "PGS002586", "trait_key": "CHRONOTYPE_PGS", "trait": "Cronotipo (mattiniero vs serotino)", "kind": "trait",
        "label": "Cronotipo (morning person, Weissbrod 2022)",
        "description": "Score di 255 SNP per la preferenza mattutina (UK Biobank, europei). Un valore alto tende al mattiniero, basso al serotino — tratto non patologico, l'ambiente (luce, abitudini, età) pesa molto.",
    },
    {
        "pgs_id": "PGS000906", "trait_key": "LONGEVITY_PGS", "trait": "Longevità", "kind": "trait",
        "label": "Longevità (PRS-5, Tesi 2021)",
        "description": "Score di 330 SNP associati alla longevità (europei). Cattura un effetto genetico piccolo: stile di vita, ambiente e fortuna restano di gran lunga i fattori dominanti. Curiosità, non una previsione.",
    },
]


def _file_path(pgs_id: str) -> Path:
    return PGS_DATA_DIR / f"{pgs_id}_hmPOS_GRCh38.txt.gz"


def loaded_scores() -> list[dict]:
    """PGS scelti il cui file è effettivamente presente in src/data/pgs/."""
    return [s for s in PGS_SCORES if _file_path(s["pgs_id"]).exists()]


def build_pgs_index() -> dict[str, tuple[list[int], set[int]]]:
    """Indice per check rapido durante parse_vcf:

      { chrom -> (sorted_positions_list, positions_set) }

    Il set serve per le varianti single-position (lookup O(1)); la lista
    ordinata permette range query con bisect per i ref-block lunghi
    (O(log N + k) invece di O(N)). Costruito dall'unione di tutti gli score
    caricati.
    """
    chrom_to_positions: dict[str, set[int]] = {}
    for score in loaded_scores():
        for v in iter_pgs_variants(_file_path(score["pgs_id"])):
            chrom_to_positions.setdefault(v.chrom, set()).add(v.pos)
    return {chrom: (sorted(positions), positions) for chrom, positions in chrom_to_positions.items()}


_PGS_INDEX_CACHE: dict[str, tuple[list[int], set[int]]] | None = None


def get_pgs_index() -> dict[str, tuple[list[int], set[int]]]:
    """Lazy-build dell'indice PGS (cache di processo). Idempotente."""
    global _PGS_INDEX_CACHE
    if _PGS_INDEX_CACHE is None:
        _PGS_INDEX_CACHE = build_pgs_index()
    return _PGS_INDEX_CACHE


def count_effect_allele(ref: str, alts: list[str], gt_alleles, effect_allele: str) -> int | None:
    """Quante copie dell'effect_allele il soggetto porta a questa posizione.

    Mappa ogni indice di genotipo cyvcf2 al nucleotide (REF se 0, ALT[i-1] se i)
    e conta i match con effect_allele. Restituisce None per chiamata mancante.
    """
    called = [a for a in (gt_alleles or []) if a is not None and a >= 0]
    if not called:
        return None
    n = 0
    for a in called:
        if a == 0:
            nuc = ref
        else:
            i = a - 1
            nuc = alts[i] if 0 <= i < len(alts) else None
        if nuc == effect_allele:
            n += 1
    return n


def compute_pgs_score(
    pgs_id: str,
    pgs_observations: dict[tuple[str, int], dict],
    pgs_ref_covered: set[tuple[str, int]],
    reference: dict | None = None,
) -> dict | None:
    """Calcola uno score PGS dato i dati catturati per il soggetto.

    pgs_observations: {(chrom,pos) -> {ref, alts, gt}} per i siti dove il
                      gVCF ha una chiamata variante.
    pgs_ref_covered:  set di (chrom,pos) dove il gVCF ha un ref-block coprente
                      (genotipo omozigote di riferimento, nucleotide assunto =
                      `other_allele` per convenzione di armonizzazione GRCh38).

    Restituisce dict con raw/mean/sd/z/percentile/markers o None se niente coperto.
    """
    path = _file_path(pgs_id)
    if not path.exists():
        return None

    raw = 0.0
    mu = 0.0
    var = 0.0
    markers_used = 0
    markers_total = 0
    markers_ref_assumed = 0
    markers_ref_resolved = 0  # ref-block risolti con FASTA (conteggio corretto)
    markers_ref_skipped = 0   # ref-block saltati per ambiguità non risolvibile
    use_fasta = fasta_available()

    for v in iter_pgs_variants(path):
        markers_total += 1
        key = (v.chrom, v.pos)
        obs = pgs_observations.get(key)
        n: int | None = None
        if obs is not None:
            n = count_effect_allele(obs["ref"], obs["alts"], obs["gt"], v.effect_allele)
        elif key in pgs_ref_covered:
            # Ref-block: il soggetto e' omozigote per la base di riferimento GRCh38.
            # Se abbiamo la FASTA, sappiamo qual e' la base: contiamo 2 copie di
            # effect_allele se effect==REF, altrimenti 0. Senza FASTA cadiamo su
            # assunzione "other_allele==REF" (convenzione di armonization).
            if use_fasta:
                ref_base = get_ref_base(v.chrom, v.pos)
                if ref_base is None:
                    # Posizione non risolvibile (FASTA non copre) -> skip
                    markers_ref_skipped += 1
                else:
                    # Per SNP il match e' diretto; per indel confrontiamo il primo
                    # carattere (rappresentazione VCF: REF e' la base d'ancoraggio).
                    ea_first = v.effect_allele[:1].upper() if v.effect_allele else ""
                    oa_first = v.other_allele[:1].upper() if v.other_allele else ""
                    if ref_base == ea_first:
                        n = 2
                    elif ref_base == oa_first or not oa_first:
                        n = 0
                    else:
                        markers_ref_skipped += 1
                    if n is not None:
                        markers_ref_resolved += 1
            else:
                # Fallback: assumi other_allele==REF, n=0. Lascia il safety net
                # |z|>3 a declassare se l'assunzione e' sbagliata su molti SNP.
                if v.other_allele and v.effect_allele != v.other_allele:
                    n = 0
                    markers_ref_assumed += 1
        if n is None:
            continue
        markers_used += 1
        raw += n * v.weight
        if v.effect_freq is not None:
            p = v.effect_freq
            mu += 2 * p * v.weight
            var += 2 * p * (1 - p) * v.weight * v.weight

    if markers_used == 0:
        return None

    # Preferisci la distribuzione di riferimento EMPIRICA (da scoring sui 503
    # sample EUR del 1000 Genomes); cade su HW dal file PGS solo se non c'e'
    # un'empirica e il file include allelefrequency_effect.
    calibration_source: str | None = None
    if reference is not None and reference.get("sd"):
        mean = reference["mean"]
        sd = reference["sd"]
        calibration_source = "empirical_1000G_EUR"
    elif var > 0:
        mean = mu
        sd = math.sqrt(var)
        calibration_source = "hardy_weinberg_file_AF"
    else:
        mean = None
        sd = None

    z = (raw - mean) / sd if (mean is not None and sd is not None and sd > 0) else None
    calibrated = z is not None
    # Safety net: applicato solo alla calibrazione HW (l'empirica gestisce gia'
    # correttamente LD e direzione allele, quindi |z| grandi sono reali).
    if z is not None and calibration_source == "hardy_weinberg_file_AF" and abs(z) > 3.0:
        calibrated = False
        mean = sd = z = None
        calibration_source = None
    percentile = (0.5 * (1.0 + math.erf(z / math.sqrt(2.0))) * 100.0) if z is not None else None

    return {
        "raw_score": round(raw, 4),
        "expected_mean": round(mean, 4) if mean is not None else None,
        "expected_sd": round(sd, 4) if sd is not None else None,
        "z_score": round(z, 3) if z is not None else None,
        "percentile": round(percentile, 1) if percentile is not None else None,
        "markers_used": markers_used,
        "markers_total": markers_total,
        "markers_ref_assumed": markers_ref_assumed,
        "markers_ref_resolved": markers_ref_resolved,
        "markers_ref_skipped": markers_ref_skipped,
        "calibrated": calibrated,
        "calibration_source": calibration_source,
    }


def _interpret(z: float | None, trait: str, raw: float) -> str:
    if z is None:
        return (
            f"Score grezzo {raw:+.2f} per {trait}. Percentile non disponibile "
            f"(il file PGS non fornisce una calibrazione di popolazione affidabile per "
            f"questo score). Il raw score >0 indica predisposizione sopra il baseline "
            f"(somma di log-OR x alleli rischio), <0 sotto. Per percentili rigorosi "
            f"serve una distribuzione di riferimento empirica."
        )
    if z >= 2.0:
        return f"Predisposizione genetica significativamente sopra la media (≥2 SD) per {trait}. Rischio relativo aumentato in modo marcato rispetto al riferimento — non è una diagnosi."
    if z >= 1.0:
        return f"Predisposizione genetica sopra la media per {trait} (1-2 SD). Rischio relativo aumentato in modo modesto rispetto al riferimento."
    if z <= -2.0:
        return f"Predisposizione genetica significativamente sotto la media per {trait}. Rischio relativo ridotto rispetto al riferimento."
    if z <= -1.0:
        return f"Predisposizione genetica sotto la media per {trait}."
    return f"Predisposizione genetica nella media della popolazione per {trait}."


# Poli interpretativi dei tratti non-malattia: (direzione per z alto, per z basso).
_TRAIT_POLES = {
    "HEIGHT_PGS": ("statura sopra la media", "statura sotto la media"),
    "CHRONOTYPE_PGS": ("cronotipo mattutino (early bird)", "cronotipo serotino (night owl)"),
    "LONGEVITY_PGS": ("longevità sopra la media", "longevità sotto la media"),
}


def _interpret_trait(z: float | None, trait: str, raw: float, poles: tuple[str, str]) -> str:
    """Interpretazione NEUTRA per i tratti non-malattia: nessun linguaggio di
    rischio, solo la posizione sullo spettro. Un valore alto non è "peggio"."""
    high, low = poles
    if z is None:
        return (
            f"Score grezzo {raw:+.2f} per {trait}. Percentile non disponibile "
            f"(manca una distribuzione di riferimento affidabile). È un tratto, non un rischio."
        )
    if z >= 1.0:
        return (
            f"Tendenza genetica verso {high} ({z:+.1f} SD sopra la media europea). "
            f"È un tratto non patologico: ambiente e molti altri geni contano almeno quanto lo score."
        )
    if z <= -1.0:
        return (
            f"Tendenza genetica verso {low} ({z:.1f} SD sotto la media europea). "
            f"È un tratto non patologico: ambiente e molti altri geni contano almeno quanto lo score."
        )
    return f"Predisposizione nella media della popolazione europea per {trait} (tratto non patologico)."


def call_all_pgs(pgs_observations: dict, pgs_ref_covered: set, references: dict | None = None) -> list[dict]:
    """Calcola tutti gli score PGS disponibili. Risultati pronti per persist.

    Se `references` (dict pgs_id -> {mean, sd, ...}) e' fornito (caricato da
    pgs_reference.json), usa quelle media/SD empiriche al posto di HW.
    """
    if references is None:
        from src.worker.pgs_reference import load_references
        references = load_references()
    out = []
    for score in loaded_scores():
        ref = references.get(score["pgs_id"])
        res = compute_pgs_score(score["pgs_id"], pgs_observations, pgs_ref_covered, ref)
        if res is None:
            continue
        if score.get("kind") == "trait":
            interp = _interpret_trait(
                res["z_score"], score["trait"], res["raw_score"],
                _TRAIT_POLES.get(score["trait_key"], ("valore alto", "valore basso")),
            )
        else:
            interp = _interpret(res["z_score"], score["trait"], res["raw_score"])
        out.append({
            **score,
            **res,
            "interpretation": interp,
        })
    return out
