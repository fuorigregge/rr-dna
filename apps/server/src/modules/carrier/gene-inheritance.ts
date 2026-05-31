// Mappa curata gene → modello di ereditarietà, per derivare lo STATO DI PORTATORE
// dai reperti patogenici eterozigoti rilevati via ClinVar (che non portano l'info
// di ereditarietà). Un eterozigote patogenico in un gene RECESSIVO è un portatore
// sano (rilevanza riproduttiva), non un malato. In un gene DOMINANTE invece è un
// reperto di rischio (gestito nella sezione malattie), NON un portatore.
//
// Copre i principali geni di malattie recessive (incl. screening del portatore) e
// alcuni dominanti noti da ESCLUDERE. I geni non in mappa restano "sconosciuti":
// in via prudenziale NON vengono presentati come portatore (per non etichettare
// male un dominante), ma restano nella sezione malattie.

export type Inheritance = 'AR' | 'AD' | 'XL';

// Note speciali per geni dove l'eterozigosi ha comunque una rilevanza clinica
// oltre allo stato di portatore (es. ATM: rischio oncologico moderato nei portatori).
export const CARRIER_GENE_NOTE: Record<string, string> = {
  ATM: "Portatore per l'atassia-telangiectasia (recessiva). Nota: i portatori eterozigoti di ATM hanno un rischio oncologico moderatamente aumentato (in particolare tumore al seno) — rilevante per la sorveglianza, non solo riproduttivo.",
};

export const GENE_INHERITANCE: Record<string, Inheritance> = {
  // --- Recessivi: ciliopatie / discinesia ciliare primaria ---
  DNAI1: 'AR', DNAH5: 'AR', DNAI2: 'AR', CCDC39: 'AR', CCDC40: 'AR', DNAAF1: 'AR',
  DNAAF2: 'AR', CCDC103: 'AR', SPAG1: 'AR', ZMYND10: 'AR', RSPH1: 'AR', RSPH4A: 'AR',
  // --- Recessivi: instabilità genomica / riparazione del DNA ---
  ATM: 'AR', BLM: 'AR', NBN: 'AR', FANCA: 'AR', FANCC: 'AR', FANCG: 'AR', MUTYH: 'AR',
  WRN: 'AR', RECQL4: 'AR', ERCC6: 'AR', ERCC8: 'AR', XPA: 'AR', XPC: 'AR',
  // --- Recessivi: screening del portatore classico ---
  CFTR: 'AR', HBB: 'AR', HBA1: 'AR', HBA2: 'AR', GBA: 'AR', GBA1: 'AR', HEXA: 'AR',
  HEXB: 'AR', SMPD1: 'AR', ASPA: 'AR', PAH: 'AR', GALT: 'AR', GAA: 'AR', ATP7B: 'AR',
  MEFV: 'AR', GJB2: 'AR', SLC26A4: 'AR', USH2A: 'AR', MYO7A: 'AR', PCDH15: 'AR',
  CDH23: 'AR', ABCC8: 'AR', MMACHC: 'AR', MUT: 'AR', CBS: 'AR', BCKDHA: 'AR',
  BCKDHB: 'AR', DBT: 'AR', IDUA: 'AR', GALC: 'AR', ARSA: 'AR', NPC1: 'AR', NPC2: 'AR',
  DHCR7: 'AR', SLC25A13: 'AR', SERPINA1: 'AR', SACS: 'AR', FXN: 'AR', POLG: 'AR',
  ACADM: 'AR', ACADVL: 'AR', PCCA: 'AR', PCCB: 'AR', CTNS: 'AR', AGXT: 'AR',
  SLC12A3: 'AR', PKHD1: 'AR', NEB: 'AR', SGCA: 'AR', SGCB: 'AR', CAPN3: 'AR',
  DYSF: 'AR', TYR: 'AR', OCA2: 'AR', RPE65: 'AR', CNGB3: 'AR', ABCA4: 'AR',
  CYP21A2: 'AR', HSD17B4: 'AR', VPS13A: 'AR', LAMA2: 'AR',
  // --- X-linked recessivi (nel maschio l'emizigosi = malato; rilevanti per la prole) ---
  DMD: 'XL', F8: 'XL', F9: 'XL', G6PD: 'XL', OTC: 'XL', GLA: 'XL', IDS: 'XL',
  ABCD1: 'XL', BTK: 'XL', L1CAM: 'XL', PHEX: 'XL', AVPR2: 'XL', RPGR: 'XL',
  // --- Dominanti noti: NON sono "portatore" (l'eterozigosi è già il reperto di rischio) ---
  TP53: 'AD', BRCA1: 'AD', BRCA2: 'AD', APC: 'AD', VHL: 'AD', RB1: 'AD', NF1: 'AD',
  NF2: 'AD', MLH1: 'AD', MSH2: 'AD', MSH6: 'AD', PMS2: 'AD', STK11: 'AD', PTEN: 'AD',
  RET: 'AD', LDLR: 'AD', APOB: 'AD', PCSK9: 'AD', MYH7: 'AD', MYBPC3: 'AD', LMNA: 'AD',
  FBN1: 'AD', COL3A1: 'AD', KCNQ1: 'AD', SCN5A: 'AD', TTR: 'AD', HFE: 'AR',
};

export function geneInheritance(gene: string | null | undefined): Inheritance | null {
  if (!gene) return null;
  return GENE_INHERITANCE[gene.toUpperCase()] ?? null;
}

/** True se un eterozigote patogenico in questo gene è un PORTATORE (recessivo/X-linked). */
export function isCarrierGene(gene: string | null | undefined): boolean {
  const inh = geneInheritance(gene);
  return inh === 'AR' || inh === 'XL';
}
