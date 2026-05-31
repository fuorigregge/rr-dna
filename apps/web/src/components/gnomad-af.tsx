// Frequenza allelica gnomAD (popmax + EUR) con segnalazione ACMG BS1.
// Legge i campi iniettati nel metadata dei DiseaseRisk dal worker:
// gnomad_af_grpmax (popmax), gnomad_af_nfe (europea), bs1_level ('common'|'frequent').

function fmtAf(v: number): string {
  return v >= 0.1 ? `${Math.round(v * 100)}%` : `${(v * 100).toFixed(2)}%`;
}

export interface GnomadAfMeta {
  gnomad_af_grpmax?: number | null;
  gnomad_af_nfe?: number | null;
  gnomad_grpmax_group?: string | null;
  bs1_level?: string | null;
}

/** Inline, compatto (per celle di tabella). */
export function GnomadAf({ meta }: { meta?: GnomadAfMeta | null }) {
  const af = typeof meta?.gnomad_af_grpmax === 'number' ? meta.gnomad_af_grpmax : null;
  if (af == null) return <span className="text-muted-foreground">&mdash;</span>;
  const nfe = typeof meta?.gnomad_af_nfe === 'number' ? meta.gnomad_af_nfe : null;
  const bs1 = meta?.bs1_level;
  const cls =
    bs1 === 'common'
      ? 'text-amber-700 dark:text-amber-400 font-semibold'
      : bs1 === 'frequent'
        ? 'text-amber-600 dark:text-amber-500'
        : 'text-foreground';
  const title =
    bs1 === 'common'
      ? 'Polimorfismo comune in popolazione (gnomAD): troppo frequente per causare una malattia rara (ACMG BS1)'
      : bs1 === 'frequent'
        ? 'Frequenza non trascurabile in popolazione (gnomAD): valutare con cautela'
        : 'Frequenza allelica gnomAD (popmax)';
  return (
    <span className={`font-mono text-xs ${cls}`} title={title}>
      {fmtAf(af)}
      {nfe != null && nfe !== af ? <span className="text-muted-foreground"> · EUR {fmtAf(nfe)}</span> : null}
      {bs1 === 'common' ? ' · comune' : null}
    </span>
  );
}
