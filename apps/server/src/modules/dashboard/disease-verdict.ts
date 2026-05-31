// Classificazione deterministica dell'attendibilità di un reperto malattia.
// Single source of truth per la distinzione tra reperti solidi, da verificare e
// PROBABILI FALSI POSITIVI — usata dal referto per non presentare come rischi
// reali ciò che è rumore di annotazione o di chiamata.
//
// Tre tipi distinti di falso positivo:
//  - chiamata: la variante è chiamata male (VAF lontana dal ~50% atteso per un
//    eterozigote → artefatto/mosaicismo), indipendentemente dall'annotazione
//  - frequenza (ACMG BS1): la variante è troppo comune nella popolazione (gnomAD)
//    per poter causare una malattia rara — un "patogenico" al 75% non è causale
//  - annotazione: 0★ ClinVar = nessun criterio di assertione, spesso polimorfismo

export type DiseaseVerdict = 'solid' | 'review' | 'likely_false_positive';

export interface DiseaseVerdictInput {
  significance: string; // PATHOGENIC | LIKELY_PATHOGENIC | UNCERTAIN | ...
  stars: number | null; // ClinVar review status 0-4 (null = non disponibile)
  lowConfidence: boolean; // supporto in letture atipico (VAF/profondità)
  vaf: number | null; // frazione allelica (0-1)
  zygosity: string | null; // HOMOZYGOUS | HETEROZYGOUS
  populationAf: number | null; // gnomAD AF popmax (AF_grpmax), 0-1, o null se assente
}

export interface DiseaseVerdictResult {
  verdict: DiseaseVerdict;
  reason: string; // spiegazione breve in italiano
}

// Soglie ACMG BS1 sulla frequenza popmax.
const AF_COMMON = 0.05; // polimorfismo comune
const AF_TOO_COMMON = 0.25; // troppo comune per essere causale a qualsiasi penetranza

function pct(v: number | null): string {
  return v == null ? 'n/d' : `${Math.round(v * 100)}%`;
}

function afPct(v: number): string {
  // frequenze alte: percento intero; frequenze basse: due decimali
  return v >= 0.1 ? `${Math.round(v * 100)}%` : `${(v * 100).toFixed(2)}%`;
}

export function classifyDiseaseFinding(i: DiseaseVerdictInput): DiseaseVerdictResult {
  const af = i.populationAf;

  // 1) La qualità della CHIAMATA prevale su tutto: una chiamata inaffidabile è un
  //    probabile falso positivo per quanto forte sia l'assertione.
  if (i.lowConfidence) {
    const isHet = i.zygosity === 'HETEROZYGOUS';
    const vafNote =
      i.vaf != null
        ? `VAF ${pct(i.vaf)}${isHet ? ' (atteso ~50% per eterozigote)' : ''}`
        : 'supporto in letture atipico';
    return {
      verdict: 'likely_false_positive',
      reason: `Chiamata a bassa confidenza: ${vafNote}. Probabile artefatto di sequenziamento/allineamento o mosaicismo — da confermare con test ortogonale.`,
    };
  }

  // 2) Significato incerto: VUS per definizione, non azionabile (non è un "falso
  //    positivo" perché non afferma patogenicità). Se comune, lo si annota.
  if (i.significance === 'UNCERTAIN') {
    const afNote = af != null && af >= AF_COMMON ? ` Inoltre comune in popolazione (gnomAD ${afPct(af)}): verosimilmente benigna.` : '';
    return {
      verdict: 'review',
      reason: `Variante a significato incerto (VUS): non azionabile, da rivalutare con nuove evidenze.${afNote}`,
    };
  }

  // 3) Frequenza di popolazione (ACMG BS1) per le PATOGENICHE/PROBABILI. Una
  //    variante molto comune non può causare una malattia rara, a prescindere
  //    dal rating ClinVar.
  if (af != null && af >= AF_TOO_COMMON) {
    return {
      verdict: 'likely_false_positive',
      reason: `Troppo comune per essere causale: frequenza gnomAD ${afPct(af)} nella popolazione (popmax). Incompatibile con una malattia rara anche con rating ClinVar alto (ACMG BS1) — probabile polimorfismo, da verificare.`,
    };
  }
  if (af != null && af >= AF_COMMON && (i.stars == null || i.stars <= 1)) {
    return {
      verdict: 'likely_false_positive',
      reason: `Polimorfismo comune: frequenza gnomAD ${afPct(af)} (popmax), incompatibile con una malattia rara (ACMG BS1). L'annotazione patogenica non è confermata da un rating ClinVar forte.`,
    };
  }

  // 4) Conflitto: ClinVar forte (≥2★) ma frequenza moderatamente alta (5–25%).
  if (af != null && af >= AF_COMMON && i.stars != null && i.stars >= 2) {
    return {
      verdict: 'review',
      reason: `ClinVar ${i.stars}★ ma frequenza gnomAD ${afPct(af)} (popmax) elevata per una malattia rara: possibile incoerenza (o condizione comune a penetranza ridotta) — da verificare.`,
    };
  }

  const afCaveat = af != null && af >= 0.01 ? ` Frequenza gnomAD ${afPct(af)} (popmax): non trascurabile, valutare con cautela.` : '';

  // 5) Fiducia nell'annotazione dal review status ClinVar (stelle).
  if (i.stars === 0) {
    return {
      verdict: 'likely_false_positive',
      reason: `0★ ClinVar (nessun criterio di assertione): annotazione non confermata, spesso polimorfismo comune mislabeled.${afCaveat}`,
    };
  }

  if (i.stars == null) {
    return {
      verdict: 'review',
      reason: `Rating ClinVar assente o interpretazioni discordanti: evidenza non consolidata.${afCaveat}`,
    };
  }

  if (i.stars === 1) {
    return {
      verdict: 'review',
      reason: `1★ ClinVar (singolo sottomittente con criteri): evidenza limitata, da approfondire.${afCaveat}`,
    };
  }

  // stars >= 2, chiamata standard, frequenza non comune, patogenica/probabile
  const rare = af != null ? ` Frequenza gnomAD ${afPct(af)} (popmax), coerente con variante rara.` : '';
  return {
    verdict: 'solid',
    reason: `${i.stars}★ ClinVar (criteri multipli concordi) e chiamata standard.${rare}`,
  };
}
