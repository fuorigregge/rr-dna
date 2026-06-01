// Direzione interpretativa dei PRS.
//
// La maggior parte degli score predice un RISCHIO di malattia: un punteggio ALTO
// è la direzione che desta attenzione, uno BASSO è rassicurante (colore verde).
// Alcuni score però predicono un TRATTO PROTETTIVO in cui la direzione è opposta:
// un valore BASSO è quello sfavorevole. Senza correzione, colori e testo
// ingannerebbero (un valore basso apparirebbe "buono" quando invece preoccupa).
//
// I biomarcatori (BMI, LDL, HbA1c, uricemia, pressione intraoculare) predicono un
// LIVELLO in cui ALTO è già la direzione sfavorevole: la colorazione standard
// (alto = attenzione) è quindi corretta e non vanno invertiti.

// Tratti protettivi: valore ALTO = favorevole, valore BASSO = sfavorevole.
export const PROTECTIVE_TRAITS: Record<string, string> = {
  BMD_PGS:
    'Score protettivo: per la densità minerale ossea un valore BASSO è la direzione sfavorevole ' +
    '(ossa meno dense → maggior rischio di osteoporosi e fratture), al contrario degli score di ' +
    'rischio malattia dove a destare attenzione è un valore alto. Un percentile basso qui NON è rassicurante.',
  LONGEVITY_PGS:
    'Score protettivo: un valore ALTO indica più alleli associati alla longevità eccezionale ' +
    '(tarato su centenari vs anziani, Tesi 2021), un valore BASSO è la direzione sfavorevole — ' +
    'non un beneficio. L\'effetto resta però piccolo: stile di vita, ambiente e fortuna pesano molto di più.',
};

export function isProtectiveTrait(traitKey: string | undefined | null): boolean {
  return !!traitKey && traitKey in PROTECTIVE_TRAITS;
}

export function protectiveNote(traitKey: string | undefined | null): string | null {
  return traitKey && traitKey in PROTECTIVE_TRAITS ? PROTECTIVE_TRAITS[traitKey] : null;
}

// z "effettivo" ai fini di colore/direzione: per i tratti protettivi si inverte,
// così la stessa soglia (alto = attenzione) vale per tutti.
export function effectiveZ(traitKey: string | undefined | null, z: number): number {
  return isProtectiveTrait(traitKey) ? -z : z;
}
