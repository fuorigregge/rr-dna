import { type CSSProperties } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from 'recharts';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Markdown } from '@/components/markdown';
import { ChromosomeMap } from '@/components/dashboard/chromosome-map';
import { isProtectiveTrait } from '@/lib/prs-direction';
import { Button, buttonVariants } from '@/components/ui/button';

export const Route = createFileRoute('/report')({ component: ReportPage });

const REPORT_QUERY = `
  query Report($vcfFileId: ID!, $sid: String!) {
    dashboardStats(vcfFileId: $vcfFileId) {
      totalVariants snpCount indelCount heterozygousCount homozygousCount
      pathogenicCount pharmacogenomicCount carrierCount traitCount ancestryCount fitnessCount
    }
    chromosomeSummaries(vcfFileId: $vcfFileId) { chromosome variantCount pathogenicCount }
    diseaseCounts: diseaseRiskCounts(vcfFileId: $sid) { total pathogenic likelyPathogenic uncertain likelyBenign benign }
    reportDiseases(vcfFileId: $vcfFileId) { id disease gene significance stars rsId genotype zygosity vaf depth lowConfidence populationAf populationAfNfe verdict reason description clinvarUrl omimUrl }
    acmgPanel(vcfFileId: $sid) { id gene condition variantName state zygosity genotype confidence interpretation }
    carrierPanel(vcfFileId: $sid) { id gene condition variantName state zygosity confidence interpretation }
    derivedCarriers(vcfFileId: $sid) { id gene condition rsId genotype zygosity inheritance state stars note }
    pharmacoPanel(vcfFileId: $sid) { id gene diplotype phenotype drugs confidence }
    traitPanel(vcfFileId: $sid) { rsId gene trait category state genotype zygosity interpretation }
    traitCounts(vcfFileId: $sid) { total metabolism physical cognitive }
    affinity: ancestryAffinity(vcfFileId: $sid) { population relativeScore markerCount }
    haplogroups(vcfFileId: $sid) { id lineage haplogroup detail quality source interpretation }
    prsResults(vcfFileId: $vcfFileId) { id traitKey trait pgsId zScore percentile rawScore calibrationSource }
    s_overview: aiSummary(vcfFileId: $sid, type: "overview") { summary detail createdAt }
    s_diseases: aiSummary(vcfFileId: $sid, type: "diseases") { summary }
    s_prs: aiSummary(vcfFileId: $sid, type: "prs") { summary }
    s_pharma: aiSummary(vcfFileId: $sid, type: "pharma") { summary }
    s_carrier: aiSummary(vcfFileId: $sid, type: "carrier") { summary }
    s_traits: aiSummary(vcfFileId: $sid, type: "traits") { summary }
    s_ancestry: aiSummary(vcfFileId: $sid, type: "ancestry") { summary }
  }
`;

// Light "document" palette: re-declare the theme tokens (the app runs in .dark)
// so Card/Badge/Markdown render dark-on-white — appropriate for a printed PDF.
const LIGHT_VARS = {
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.145 0 0)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.145 0 0)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.145 0 0)',
  '--primary': 'oklch(0.205 0 0)',
  '--primary-foreground': 'oklch(0.985 0 0)',
  '--secondary': 'oklch(0.97 0 0)',
  '--secondary-foreground': 'oklch(0.205 0 0)',
  '--muted': 'oklch(0.97 0 0)',
  '--muted-foreground': 'oklch(0.45 0 0)',
  '--border': 'oklch(0.9 0 0)',
  colorScheme: 'light',
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
} as CSSProperties;

const SECTIONS: Array<{ type: string; label: string; cats: string[] }> = [
  { type: 'diseases', label: 'Rischio malattie', cats: ['disease', 'acmg'] },
  { type: 'prs', label: 'Predisposizione poligenica', cats: [] },
  { type: 'pharma', label: 'Farmacogenomica', cats: ['pharma'] },
  { type: 'carrier', label: 'Stato di portatore', cats: ['carrier'] },
  { type: 'traits', label: 'Tratti fenotipici', cats: ['trait'] },
  { type: 'ancestry', label: 'Ancestralità', cats: ['haplogroup'] },
];

function DiseaseChart({ c }: { c: any }) {
  const data = [
    { name: 'Patogeniche', value: c.pathogenic, fill: 'hsl(0,72%,51%)' },
    { name: 'Prob. patog.', value: c.likelyPathogenic, fill: 'hsl(25,95%,53%)' },
    { name: 'Incerte', value: c.uncertain, fill: 'hsl(45,93%,47%)' },
    { name: 'Prob. benigne', value: c.likelyBenign, fill: 'hsl(142,71%,45%)' },
    { name: 'Benigne', value: c.benign, fill: 'hsl(142,76%,36%)' },
  ];
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} layout="vertical" margin={{ left: 90, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#475569' }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false} label={{ position: 'right', fontSize: 10, fill: '#475569' }}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AncestryChart({ affinity }: { affinity: any[] }) {
  const data = [...affinity]
    .sort((a, b) => b.relativeScore - a.relativeScore)
    .slice(0, 6)
    .map((a) => ({ name: a.population, value: +(a.relativeScore * 100).toFixed(1) }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ left: 150, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#475569' }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} fill="hsl(239,84%,67%)" isAnimationActive={false} label={{ position: 'right', fontSize: 10, fill: '#475569', formatter: (v: any) => `${v}%` }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PrsTopMovers({ rows }: { rows: any[] }) {
  // Tabella COMPLETA di tutti gli score, ordinati per |z| desc; i calibrati prima,
  // i raw-only in coda. I movers (|z|>=1) sono evidenziati.
  const sorted = [...rows].sort((a, b) => {
    const az = typeof a.zScore === 'number' ? Math.abs(a.zScore) : -1;
    const bz = typeof b.zScore === 'number' ? Math.abs(b.zScore) : -1;
    return bz - az;
  });
  const movers = sorted.filter((r) => typeof r.zScore === 'number' && Math.abs(r.zScore) >= 1).length;
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-secondary/50">
          <tr className="text-left">
            <th className="px-3 py-1.5 font-semibold">Tratto</th>
            <th className="px-3 py-1.5 font-semibold text-right">Percentile</th>
            <th className="px-3 py-1.5 font-semibold text-right">z-score</th>
            <th className="px-3 py-1.5 font-semibold">Lettura</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const calibrated = typeof r.zScore === 'number';
            const high = calibrated && r.zScore >= 1;
            const low = calibrated && r.zScore <= -1;
            const emphasize = high || low;
            // Per i tratti protettivi (BMD) la direzione sfavorevole è quella bassa.
            const protective = isProtectiveTrait(r.traitKey);
            const concerning = calibrated && (protective ? low : high);
            return (
              <tr key={r.id} className="border-t border-border" style={emphasize ? { background: concerning ? 'hsl(35,92%,96%)' : 'hsl(142,60%,96%)' } : undefined}>
                <td className="px-3 py-1.5" style={emphasize ? { fontWeight: 500 } : undefined}>
                  {r.trait}
                  {r.pgsId && <span className="ml-1.5 text-[9px] font-mono text-muted-foreground">{r.pgsId}</span>}
                  {protective && <span className="ml-1.5 text-[9px]" style={{ color: 'hsl(35,92%,38%)' }}>tratto protettivo</span>}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{calibrated ? `${Math.round(r.percentile)}°` : '—'}</td>
                <td className="px-3 py-1.5 text-right font-mono">{calibrated ? `${r.zScore >= 0 ? '+' : ''}${r.zScore.toFixed(2)}` : `raw ${r.rawScore >= 0 ? '+' : ''}${r.rawScore.toFixed(1)}`}</td>
                <td className="px-3 py-1.5">
                  {high && <span style={{ color: concerning ? 'hsl(25,95%,40%)' : 'hsl(142,71%,32%)' }}>↑ sopra la media{protective ? ' (favorevole)' : ''}</span>}
                  {low && <span style={{ color: concerning ? 'hsl(25,95%,40%)' : 'hsl(142,71%,32%)' }}>↓ sotto la media{protective ? ' (sfavorevole)' : ''}</span>}
                  {calibrated && !high && !low && <span className="text-muted-foreground">nella media</span>}
                  {!calibrated && <span className="text-muted-foreground">solo raw</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-1.5 text-[10px] text-muted-foreground bg-secondary/30 border-t border-border">
        {rows.length} score poligenici · {movers} si discostano marcatamente (|z| ≥ 1, evidenziati). Rischio relativo medio rispetto alla popolazione europea (calibrazione empirica 1000G EUR), non una diagnosi.
      </p>
      <p className="px-3 py-1.5 text-[10px] bg-secondary/30 border-t border-border" style={{ color: 'hsl(35,92%,35%)' }}>
        ⚠ <strong>Direzione del punteggio.</strong> Per la maggior parte degli score un valore alto è la direzione che desta attenzione e uno basso è rassicurante (verde). Fanno eccezione i <strong>tratti protettivi</strong> (etichettati): per la <strong>densità minerale ossea (BMD)</strong> è il valore basso a essere sfavorevole (rischio osteoporosi/fratture), non un beneficio. Il colore e la lettura tengono conto della direzione corretta.
      </p>
    </div>
  );
}

// ---- Componenti per-area del referto (enumerazione completa + falsi positivi) ----

const VERDICT_META: Record<string, { label: string; color: string; dot: string }> = {
  solid: { label: 'Reperti attendibili', color: 'hsl(0,72%,42%)', dot: 'hsl(0,72%,50%)' },
  review: { label: 'Da verificare', color: 'hsl(35,92%,38%)', dot: 'hsl(35,92%,50%)' },
  likely_false_positive: { label: 'Probabili falsi positivi / da confermare', color: 'hsl(215,16%,40%)', dot: 'hsl(215,16%,55%)' },
};
const VERDICT_ORDER = ['solid', 'review', 'likely_false_positive'];

function sigLabel(s: string): string {
  if (s === 'PATHOGENIC') return 'Patogenica';
  if (s === 'LIKELY_PATHOGENIC') return 'Prob. patogenica';
  if (s === 'UNCERTAIN') return 'Significato incerto';
  return s;
}

function zygLabel(z: string | null | undefined): string {
  if (z === 'HOMOZYGOUS') return 'omozigote';
  if (z === 'HETEROZYGOUS') return 'eterozigote';
  return z ?? '';
}

function DiseaseFinding({ r, isFp, color }: { r: any; isFp: boolean; color: string }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium" style={isFp ? { textDecoration: 'line-through', textDecorationColor: 'hsl(215,16%,70%)', textDecorationThickness: '1px' } : undefined}>
          {r.gene ? <span className="font-mono text-xs text-muted-foreground mr-1 no-underline">{r.gene}</span> : null}
          {r.disease}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">{sigLabel(r.significance)}{r.stars != null ? ` · ${r.stars}★ ClinVar` : ' · ClinVar n/d'}</span>
      </div>
      {/* Dettaglio della chiamata */}
      <div className="mt-0.5 text-[10px] font-mono text-muted-foreground flex flex-wrap gap-x-2">
        {r.rsId && <span>{r.rsId}</span>}
        {r.genotype && <span>genotipo {r.genotype}</span>}
        {r.zygosity && <span>{zygLabel(r.zygosity)}</span>}
        {typeof r.vaf === 'number' && <span>VAF {Math.round(r.vaf * 100)}%</span>}
        {typeof r.depth === 'number' && <span>profondità {r.depth}×</span>}
        {typeof r.populationAf === 'number' && (
          <span style={r.populationAf >= 0.01 ? { color: 'hsl(35,92%,35%)', fontWeight: 600 } : undefined}>
            gnomAD {r.populationAf >= 0.1 ? Math.round(r.populationAf * 100) : (r.populationAf * 100).toFixed(2)}%
            {typeof r.populationAfNfe === 'number' && r.populationAfNfe !== r.populationAf ? ` (EUR ${r.populationAfNfe >= 0.1 ? Math.round(r.populationAfNfe * 100) : (r.populationAfNfe * 100).toFixed(2)}%)` : ''}
          </span>
        )}
      </div>
      {r.description && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.description}</p>}
      <p className="text-[11px] mt-0.5" style={{ color }}>{isFp ? '⚠ ' : ''}{r.reason}</p>
      {(r.clinvarUrl || r.omimUrl || r.rsId) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px]">
          {r.clinvarUrl && <a href={r.clinvarUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(217,91%,45%)' }}>ClinVar ↗</a>}
          {r.omimUrl && <a href={r.omimUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(217,91%,45%)' }}>OMIM ↗</a>}
          {r.rsId && <a href={`https://www.ncbi.nlm.nih.gov/snp/${r.rsId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(217,91%,45%)' }}>dbSNP ↗</a>}
        </div>
      )}
    </div>
  );
}

function DiseaseFindings({ rows, counts }: { rows: any[]; counts: any }) {
  if (!rows || rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Nessuna variante patogenica, probabilmente patogenica o incerta di rilievo.</p>;
  }
  return (
    <div className="space-y-3">
      {VERDICT_ORDER.map((v) => {
        const group = rows.filter((r) => r.verdict === v);
        if (group.length === 0) return null;
        const meta = VERDICT_META[v];
        const isFp = v === 'likely_false_positive';
        return (
          <div key={v} className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/40 border-b border-border">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
              <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
              <span className="text-[10px] text-muted-foreground">({group.length})</span>
            </div>
            <div className="divide-y divide-border">
              {group.map((r) => <DiseaseFinding key={r.id} r={r} isFp={isFp} color={meta.color} />)}
            </div>
          </div>
        );
      })}
      {counts && (
        <p className="text-[10px] text-muted-foreground">
          Non elencate: {counts.uncertain.toLocaleString('it-IT')} varianti a significato incerto (VUS, non azionabili — solo le meglio caratterizzate ≥3★ compaiono sopra)
          {' · '}{(counts.benign + counts.likelyBenign).toLocaleString('it-IT')} benigne/probabilmente benigne (polimorfismi comuni, rumore di fondo).
        </p>
      )}
    </div>
  );
}

function PanelReport({ rows, positiveStates, posLabel }: { rows: any[]; positiveStates: string[]; posLabel: string; negLabel?: string }) {
  if (!rows || rows.length === 0) return null;
  const pos = rows.filter((r) => positiveStates.includes(r.state));
  const neg = rows.filter((r) => !positiveStates.includes(r.state));
  const notCovered = neg.filter((r) => r.state === 'NOT_COVERED');
  const cleared = neg.filter((r) => r.state !== 'NOT_COVERED');
  return (
    <div className="space-y-2">
      {pos.length > 0 ? (
        <div className="rounded-lg border border-border divide-y divide-border">
          {pos.map((r) => (
            <div key={r.id} className="px-3 py-1.5">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {r.gene ? <span className="font-mono text-xs text-muted-foreground mr-1">{r.gene}</span> : null}
                  {r.condition}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {posLabel}{r.variantName ? ` · ${r.variantName}` : ''}{r.zygosity ? ` · ${zygLabel(r.zygosity)}` : ''}{r.confidence === 'LOW' ? ' · bassa confidenza' : ''}
                </span>
              </div>
              {r.interpretation && <p className="text-[11px] text-muted-foreground mt-0.5">{r.interpretation}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nessun esito positivo: tutte le varianti del pannello risultano negative (genotipo di riferimento).</p>
      )}
      {/* Negativi rassicuranti, elencati esplicitamente per gene/condizione */}
      {cleared.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            Esiti negativi verificati ({cleared.length}) — non portati, risultato rassicurante
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
            {cleared.map((r) => (
              <div key={r.id} className="text-[11px] text-muted-foreground">
                <span className="font-mono mr-1">{r.gene}</span>{r.condition}
                {r.variantName ? <span className="text-muted-foreground/70"> · {r.variantName}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}
      {notCovered.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {notCovered.length} siti non valutabili (non coperti dal sequenziamento): {notCovered.map((r) => r.gene).join(', ')}.
        </p>
      )}
      <p className="text-[10px] text-muted-foreground/80 italic">
        Il pannello verifica una variante specifica per gene: un esito negativo non esclude altre varianti patogeniche nello stesso gene.
      </p>
    </div>
  );
}

function DerivedCarriersReport({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Portatore di malattie recessive (da varianti ClinVar)
      </div>
      <div className="rounded-lg border border-border divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="px-3 py-1.5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">
                <span className="font-mono text-xs text-muted-foreground mr-1">{r.gene}</span>
                {r.condition}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {r.state === 'AFFECTED' ? 'Due copie' : 'Portatore eterozigote'} · {r.inheritance}
                {r.stars != null ? ` · ${r.stars}★ ClinVar` : ''}{r.rsId ? ` · ${r.rsId}` : ''}{r.genotype ? ` · ${r.genotype}` : ''}
              </span>
            </div>
            {r.note && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{r.note}</p>}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/80 italic">
        Reperti patogenici eterozigoti in geni recessivi: sei portatore sano (non malato). Rilevanza riproduttiva — utile lo screening del partner.
      </p>
    </div>
  );
}

function PharmaPanelReport({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return null;
  const isAbnormal = (r: any) => r.phenotype && !/normale|standard/i.test(r.phenotype);
  const sorted = [...rows].sort((a, b) => Number(isAbnormal(b)) - Number(isAbnormal(a)));
  return (
    <div className="space-y-1">
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40">
            <tr className="text-left">
              <th className="px-3 py-1 font-semibold">Gene</th>
              <th className="px-3 py-1 font-semibold">Diplotipo</th>
              <th className="px-3 py-1 font-semibold">Fenotipo metabolizzatore</th>
              <th className="px-3 py-1 font-semibold">Farmaci</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const abn = isAbnormal(r);
              return (
                <tr key={r.id} className="border-t border-border" style={abn ? { background: 'hsl(35,92%,95%)' } : undefined}>
                  <td className="px-3 py-1 font-mono">{r.gene}</td>
                  <td className="px-3 py-1 font-mono">{r.diplotype ?? '—'}</td>
                  <td className="px-3 py-1" style={abn ? { color: 'hsl(35,92%,35%)', fontWeight: 500 } : undefined}>
                    {r.phenotype ?? '—'}{r.confidence === 'LOW' ? ' (bassa confidenza)' : ''}
                  </td>
                  <td className="px-3 py-1 text-muted-foreground">{r.drugs ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground italic">Evidenziati i fenotipi atipici (dosaggio/risposta non standard); gli altri geni hanno metabolismo normale.</p>
    </div>
  );
}

function TraitPanelReport({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return null;
  const carried = rows.filter((r) => r.state === 'CARRIED');
  const reference = rows.filter((r) => r.state === 'REFERENCE');
  if (carried.length === 0 && reference.length === 0) {
    return <p className="text-xs text-muted-foreground">Nessun marcatore del pannello tratti valutabile.</p>;
  }
  return (
    <div className="space-y-2">
      {carried.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {carried.map((r) => (
            <div key={r.rsId} className="px-3 py-1.5">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground mr-1">{r.gene}</span>
                  {r.trait}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {r.rsId}{r.genotype ? ` · ${r.genotype}` : ''}{r.zygosity ? ` · ${zygLabel(r.zygosity)}` : ''}
                </span>
              </div>
              {r.interpretation && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{r.interpretation}</p>}
            </div>
          ))}
        </div>
      )}
      {reference.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Genotipo standard / di riferimento ({reference.length}) — cosa significa
          </p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {reference.map((r) => (
              <div key={r.rsId} className="px-3 py-1.5">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-[13px] font-medium">
                    <span className="font-mono text-[10px] text-muted-foreground mr-1">{r.gene}</span>{r.trait}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">{r.rsId}{r.genotype ? ` · ${r.genotype}` : ''}</span>
                </div>
                {r.interpretation && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{r.interpretation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MethodologyNotes() {
  return (
    <section className="report-section space-y-2 border-t border-border pt-5 text-xs text-muted-foreground leading-relaxed">
      <h2 className="text-base font-semibold text-foreground">Note metodologiche</h2>
      <p>
        <strong className="text-foreground">Dato di partenza.</strong> Sequenziamento dell'intero genoma (WGS ~30×), file gVCF allineato su GRCh38.
        Le varianti sono estratte dai record che superano i filtri di qualità del chiamante; i ref-block (tratti omozigoti di riferimento) sono usati per
        distinguere un genotipo standard da un sito non coperto.
      </p>
      <p>
        <strong className="text-foreground">Annotazione clinica.</strong> Le varianti sono incrociate con ClinVar (significato clinico) e con pannelli
        curati (ACMG SF azionabili, carrier-screening, farmacogenomica, tratti). Il <em>review status</em> ClinVar è riportato in stelle (0–4): 0★ = nessun
        criterio di assertione (evidenza debole), ≥2★ = criteri multipli concordi.
      </p>
      <p>
        <strong className="text-foreground">Confidenza della chiamata.</strong> Per ogni variante si valutano frazione allelica (VAF) e profondità: un
        eterozigote dovrebbe avere VAF ~50%; valori molto diversi (o profondità bassa) segnalano una chiamata dubbia, possibile artefatto o evento mosaico.
      </p>
      <p>
        <strong className="text-foreground">Falsi positivi.</strong> Un reperto patogenico è classificato come <em>probabile falso positivo</em> quando: la
        chiamata è a bassa confidenza (VAF atipica → artefatto/mosaicismo); oppure la variante è troppo comune nella popolazione per causare una malattia rara
        (frequenza gnomAD v4 — regola ACMG BS1: una variante al 75% non è causale); oppure l'annotazione non è confermata (0★ ClinVar). Ogni reperto riporta la
        frequenza gnomAD (popmax ed europea); quelli declassati sono separati e segnalati con la motivazione, non presentati come rischi reali.
      </p>
      <p>
        <strong className="text-foreground">Predisposizione poligenica (PRS).</strong> Somma pesata di molti SNP da score del PGS Catalog. Media e deviazione
        standard di riferimento sono ricavate empiricamente sui 503 individui europei del 1000 Genomes Project; percentile e z-score esprimono il rischio
        <em> relativo</em> rispetto a quella popolazione, non una diagnosi.
      </p>
      <p>
        <strong className="text-foreground">Lineaggi.</strong> Aplogruppo materno (mtDNA) e paterno (cromosoma Y) determinati con strumenti dedicati
        (HaploGrep / yhaplo) sui marcatori diagnostici delle rispettive filogenesi.
      </p>
      <p>
        <strong className="text-foreground">Riassunti AI.</strong> I testi discorsivi di ciascuna sezione sono generati da un modello linguistico a partire
        ESCLUSIVAMENTE dai dati sopra (varianti, stelle, confidenza, verdetti dei pannelli), con vincoli espliciti contro l'invenzione di fonti.
      </p>
    </section>
  );
}

// Storia curata degli aplogruppi (popolazione-genetica reale, non derivata dai
// dati del soggetto). Match per prefisso più lungo: dal sotto-clade alla macro-
// famiglia. Copre i principali aplogruppi europei/eurasiatici; per quelli non in
// elenco si ricade su una descrizione generica della macro-famiglia.
interface HaploEntry { prefix: string; title: string; text: string }

const MT_HISTORY: HaploEntry[] = [
  { prefix: 'X2', title: 'mtDNA X2', text: "Sotto-ramo prevalentemente europeo, vicino-orientale e caucasico dell'aplogruppo X, espansosi dopo l'ultimo massimo glaciale (~21.000 anni fa). X2e, in particolare, è diffuso nel Mediterraneo e nell'Europa meridionale." },
  { prefix: 'X', title: 'mtDNA X', text: "Uno dei rami mitocondriali più antichi e rari dell'Eurasia occidentale, sorto ~30.000 anni fa. Distribuzione insolitamente frammentata: Europa, Vicino Oriente, Caucaso — e, caso unico fra gli aplogruppi euroasiatici, anche alcune popolazioni native nordamericane (traccia di antiche migrazioni)." },
  { prefix: 'H', title: 'mtDNA H', text: "L'aplogruppo mitocondriale più comune in Europa (~40% degli europei). Si espanse dal rifugio glaciale iberico/franco-cantabrico dopo l'ultimo massimo glaciale, ripopolando il continente ~15.000 anni fa." },
  { prefix: 'HV', title: 'mtDNA HV', text: "Lignaggio ancestrale di H e V, originato nel Vicino Oriente/Caucaso ~25.000 anni fa e diffuso verso l'Europa con le prime ondate post-glaciali." },
  { prefix: 'V', title: 'mtDNA V', text: "Ramo giovane (~15.000 anni) nato in Europa sud-occidentale; frequente fra i Sami della Scandinavia e nelle popolazioni iberiche, segno di una riespansione post-glaciale." },
  { prefix: 'J', title: 'mtDNA J', text: "Associato all'espansione neolitica dall'agricoltura del Vicino Oriente verso l'Europa ~9.000 anni fa; comune in Europa e nel Mediterraneo orientale." },
  { prefix: 'T', title: 'mtDNA T', text: "Anch'esso legato alla diffusione neolitica dell'agricoltura dal Vicino Oriente; presente in tutta Europa e fino all'Asia centrale." },
  { prefix: 'K', title: 'mtDNA K', text: "Sotto-ramo di U8, sorto ~30.000 anni fa nel Vicino Oriente; frequente fra gli agricoltori neolitici europei e in alcune popolazioni ebraiche ashkenazite." },
  { prefix: 'U5', title: 'mtDNA U5', text: "Il lignaggio mitocondriale europeo più antico: presente fra i cacciatori-raccoglitori paleolitici e mesolitici già ~30.000 anni fa, prima dell'arrivo dell'agricoltura." },
  { prefix: 'U', title: 'mtDNA U', text: "Macro-aplogruppo molto antico (~45.000 anni), fra i primi a colonizzare l'Eurasia occidentale dopo l'uscita dall'Africa; U5 è la firma dei cacciatori-raccoglitori europei." },
  { prefix: 'I', title: 'mtDNA I', text: "Ramo minore eurasiatico-occidentale (da N1), distribuito a bassa frequenza dall'Europa al Vicino Oriente." },
  { prefix: 'W', title: 'mtDNA W', text: "Lignaggio eurasiatico-occidentale poco frequente, diffuso dall'Europa orientale all'Asia meridionale." },
  { prefix: 'L', title: 'mtDNA L', text: "I lignaggi L (L0–L3) sono le radici dell'albero mitocondriale umano, originati in Africa: L0 è il ramo più antico (~150.000 anni), ancestrale di tutta la diversità mitocondriale moderna." },
  { prefix: 'M', title: 'mtDNA M', text: "Macro-aplogruppo nato poco dopo l'uscita dall'Africa (~50.000 anni); dominante in Asia meridionale e orientale, assente nativamente in Europa." },
  { prefix: 'A', title: 'mtDNA A', text: "Aplogruppo asiatico-orientale, fra i lignaggi fondatori delle popolazioni native americane attraverso la Beringia." },
  { prefix: 'N', title: 'mtDNA N', text: "Uno dei due grandi rami (con M) discesi da L3 alla base di tutta la diversità mitocondriale non-africana." },
];

const Y_HISTORY: HaploEntry[] = [
  { prefix: 'G2a', title: 'Y-DNA G2a', text: "Ramo principale dell'aplogruppo G, fortemente legato alla diffusione dell'agricoltura nel Neolitico: i primi agricoltori che colonizzarono l'Europa ~8.000 anni fa erano in larga parte G2a. Ötzi, l'Uomo del Similaun (~5.300 anni), apparteneva proprio a G2a. Oggi è raro ma diffuso, più frequente in Sardegna, Corsica, Caucaso e Anatolia." },
  { prefix: 'G', title: 'Y-DNA G', text: "Aplogruppo del cromosoma Y (definito da M201) nato in Asia occidentale/Caucaso ~26.000 anni fa, associato alle prime comunità agricole del Vicino Oriente che portarono l'agricoltura in Europa." },
  { prefix: 'R1b', title: 'Y-DNA R1b', text: "L'aplogruppo paterno più comune nell'Europa occidentale (oltre l'80% in Irlanda e Spagna nord-occidentale). Si espanse con le migrazioni dell'età del bronzo dalla steppa pontico-caspica ~4.500 anni fa (cultura Yamnaya)." },
  { prefix: 'R1a', title: 'Y-DNA R1a', text: "Diffuso nell'Europa orientale, Asia centrale e subcontinente indiano; legato alle espansioni indoeuropee dell'età del bronzo dalla steppa." },
  { prefix: 'R', title: 'Y-DNA R', text: "Grande macro-aplogruppo eurasiatico; i suoi rami R1a e R1b dominano l'Europa moderna grazie alle migrazioni della steppa nell'età del bronzo." },
  { prefix: 'I1', title: 'Y-DNA I1', text: "Aplogruppo nativo europeo, concentrato in Scandinavia e nell'Europa germanica; discende dai cacciatori-raccoglitori paleolitici europei." },
  { prefix: 'I2', title: 'Y-DNA I2', text: "Ramo europeo molto antico (cacciatori-raccoglitori paleolitici); oggi più frequente nei Balcani e in Sardegna." },
  { prefix: 'I', title: 'Y-DNA I', text: "Uno dei pochi aplogruppi Y nati in Europa, presente fra i cacciatori-raccoglitori del continente prima dell'arrivo dell'agricoltura." },
  { prefix: 'J1', title: 'Y-DNA J1', text: "Originato nel Vicino Oriente/Arabia; associato a popolazioni semitiche e alla pastorizia del Medio Oriente." },
  { prefix: 'J2', title: 'Y-DNA J2', text: "Nato nella Mezzaluna Fertile, diffuso in Mediterraneo e Vicino Oriente con l'agricoltura neolitica e le civiltà del bronzo." },
  { prefix: 'J', title: 'Y-DNA J', text: "Aplogruppo del Vicino Oriente legato alla nascita dell'agricoltura nella Mezzaluna Fertile e alla sua diffusione mediterranea." },
  { prefix: 'E1b1b', title: 'Y-DNA E1b1b', text: "Originato in Africa nord-orientale; diffuso nel Mediterraneo, nei Balcani e nel Nord Africa con migrazioni neolitiche e successive." },
  { prefix: 'E', title: 'Y-DNA E', text: "Macro-aplogruppo di origine africana; il ramo E1b1b è il principale presente in Europa meridionale e Nord Africa." },
  { prefix: 'N', title: 'Y-DNA N', text: "Aplogruppo eurasiatico settentrionale, diffuso dalla Siberia alla Scandinavia; associato a popolazioni uraliche." },
  { prefix: 'Q', title: 'Y-DNA Q', text: "Principale aplogruppo paterno dei nativi americani, giunto nelle Americhe attraverso la Beringia ~15.000 anni fa." },
  { prefix: 'T', title: 'Y-DNA T', text: "Aplogruppo raro di origine vicino-orientale, sparso a bassa frequenza nel Mediterraneo, Africa orientale e Asia meridionale." },
];

function matchHistory(table: HaploEntry[], code: string): HaploEntry | null {
  // longest-prefix-first: la tabella è ordinata dal clade più specifico al più generale
  for (const e of table) if (code.toUpperCase().startsWith(e.prefix.toUpperCase())) return e;
  return null;
}

function HaplogroupLineages({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return null;
  const mt = rows.find((r) => r.lineage === 'MT');
  const y = rows.find((r) => r.lineage === 'Y');
  const lineages: Array<{ row: any; label: string; sub: string; entry: HaploEntry | null }> = [];
  if (mt) lineages.push({ row: mt, label: 'Linea materna', sub: 'mtDNA · eredità dalla madre, da lei dalla nonna materna…', entry: matchHistory(MT_HISTORY, mt.detail || mt.haplogroup) });
  if (y) lineages.push({ row: y, label: 'Linea paterna', sub: 'cromosoma Y · eredità dal padre, da lui dal nonno paterno…', entry: matchHistory(Y_HISTORY, y.detail || y.haplogroup) });
  if (lineages.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lineaggi diretti (aplogruppi)</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {lineages.map(({ row, label, sub, entry }) => (
          <div key={row.id} className="rounded-lg border border-border p-3 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{row.source}{typeof row.quality === 'number' ? ` · q ${(row.quality * 100).toFixed(0)}%` : ''}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
            <div className="text-base font-bold font-mono">
              {row.haplogroup}
              {row.detail && row.detail !== row.haplogroup ? <span className="text-xs font-normal text-muted-foreground ml-1.5">({row.detail})</span> : null}
            </div>
            {entry && (
              <div className="pt-0.5">
                <div className="text-[11px] font-semibold">{entry.title}</div>
                <p className="text-[11px] text-muted-foreground leading-snug">{entry.text}</p>
              </div>
            )}
            {row.interpretation && <p className="text-[11px] text-muted-foreground leading-snug">{row.interpretation}</p>}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/80 italic">
        Gli aplogruppi tracciano due sole linee dirette (materna e paterna) su migliaia di antenati: raccontano viaggi profondi nel tempo, non l'intera ascendenza (per quella vedi l'affinità di popolazione sotto).
      </p>
    </div>
  );
}

function ReportPage() {
  const { activeFile } = useActiveVcf();

  const { data, isLoading } = useQuery({
    queryKey: ['report', activeFile?.id],
    queryFn: () => gqlClient.request<any>(REPORT_QUERY, { vcfFileId: activeFile!.id, sid: activeFile!.id }),
    enabled: !!activeFile,
  });

  if (!activeFile) {
    return <div className="p-8 text-center text-muted-foreground">Nessun file VCF selezionato.</div>;
  }
  if (isLoading || !data) {
    return <div className="p-8 text-center text-muted-foreground">Generazione referto…</div>;
  }

  const stats = data.dashboardStats;
  const overview = data.s_overview;
  const generated = overview?.createdAt ? new Date(overview.createdAt) : new Date();

  const headerStats = [
    { label: 'Varianti', value: stats.totalVariants.toLocaleString('it-IT') },
    { label: 'SNP', value: stats.snpCount.toLocaleString('it-IT') },
    { label: 'Indel', value: stats.indelCount.toLocaleString('it-IT') },
    { label: 'Patogeniche', value: stats.pathogenicCount.toLocaleString('it-IT') },
    { label: 'Farmacogeni', value: stats.pharmacogenomicCount.toLocaleString('it-IT') },
    { label: 'Carrier', value: stats.carrierCount.toLocaleString('it-IT') },
  ];

  return (
    <div style={LIGHT_VARS} className="bg-background text-foreground min-h-screen -mx-4 sm:-mx-6 px-0 -my-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav { display: none !important; }
          .report-section { break-inside: avoid; }
        }
        @page { margin: 1.4cm; }
      `}</style>

      <div className="mx-auto max-w-[860px] px-6 py-8 space-y-7">
        {/* Toolbar (hidden in print) */}
        <div className="no-print flex items-center justify-between gap-2">
          <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>← Dashboard</Link>
          <Button size="sm" onClick={() => window.print()}>Stampa / Salva PDF</Button>
        </div>

        {/* Header */}
        <header className="border-b border-border pb-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span>🧬</span> rr-dna · Referto genomico
          </div>
          <h1 className="mt-1 text-2xl font-bold">Referto di analisi del genoma</h1>
          <p className="mt-1 text-sm text-muted-foreground break-all">{activeFile.filename}</p>
          <p className="text-xs text-muted-foreground">
            Generato il {generated.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
            {headerStats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-secondary/40 px-2 py-2 text-center">
                <div className="text-base font-bold leading-tight">{s.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </header>

        {/* Chromosome map */}
        <section className="report-section space-y-2">
          <h2 className="text-lg font-semibold">Mappa cromosomica</h2>
          <ChromosomeMap data={data.chromosomeSummaries ?? []} />
        </section>

        {/* Per-section */}
        {SECTIONS.map((sec) => {
          const summary = data[`s_${sec.type}`]?.summary as string | undefined;
          return (
            <section key={sec.type} className="report-section space-y-2">
              <h2 className="text-lg font-semibold border-b border-border pb-1">{sec.label}</h2>
              {summary ? (
                <Markdown>{summary}</Markdown>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Riassunto AI non ancora generato per questa sezione (generalo dalla pagina dedicata).
                </p>
              )}

              {sec.type === 'diseases' && (
                <>
                  <DiseaseFindings rows={data.reportDiseases ?? []} counts={data.diseaseCounts} />
                  {(data.acmgPanel?.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pannello varianti azionabili (ACMG)</div>
                      <PanelReport rows={data.acmgPanel} positiveStates={['CARRIED']} posLabel="Variante azionabile portata" negLabel="Pannello ACMG" />
                    </div>
                  )}
                  {data.diseaseCounts && <DiseaseChart c={data.diseaseCounts} />}
                </>
              )}
              {sec.type === 'prs' && (data.prsResults?.length ?? 0) > 0 && <PrsTopMovers rows={data.prsResults} />}
              {sec.type === 'carrier' && (
                <>
                  <DerivedCarriersReport rows={data.derivedCarriers ?? []} />
                  {(data.carrierPanel?.length ?? 0) > 0 && (
                    <PanelReport rows={data.carrierPanel} positiveStates={['CARRIER', 'AFFECTED']} posLabel="Portatore" negLabel="Pannello carrier" />
                  )}
                </>
              )}
              {sec.type === 'pharma' && (data.pharmacoPanel?.length ?? 0) > 0 && <PharmaPanelReport rows={data.pharmacoPanel} />}
              {sec.type === 'ancestry' && (
                <>
                  <HaplogroupLineages rows={data.haplogroups ?? []} />
                  {(data.affinity?.length ?? 0) > 0 && <AncestryChart affinity={data.affinity} />}
                </>
              )}
              {sec.type === 'traits' && (
                <>
                  <TraitPanelReport rows={data.traitPanel ?? []} />
                  {data.traitCounts && (
                    <p className="text-xs text-muted-foreground">
                      Tratti rilevati — metabolismo: {data.traitCounts.metabolism} · fisici: {data.traitCounts.physical} · cognitivi: {data.traitCounts.cognitive}
                    </p>
                  )}
                </>
              )}
            </section>
          );
        })}

        {/* Overall AI summary */}
        <section className="report-section space-y-2 border-t-2 border-border pt-5">
          <h2 className="text-xl font-bold">Sommario generale</h2>
          {overview ? (
            <Markdown>{overview.detail || overview.summary}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Sommario generale non ancora generato. Vai in Dashboard e premi “Sommario AI” per crearlo.
            </p>
          )}
        </section>

        <MethodologyNotes />

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          Referto informativo generato da rr-dna a scopo divulgativo. Non costituisce una diagnosi medica:
          per l'interpretazione clinica rivolgersi a un genetista. I risultati a bassa confidenza vanno confermati con test mirati.
        </footer>
      </div>
    </div>
  );
}
