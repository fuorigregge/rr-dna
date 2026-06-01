import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient, PRS_RESULTS_QUERY } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';
import { effectiveZ, isProtectiveTrait, protectiveNote } from '@/lib/prs-direction';
import type { PrsResult } from '@/components/dashboard/prs-card';
import { PrsDistributionChart } from '@/components/prs-distribution-chart';

export const Route = createFileRoute('/prs')({ component: PrsPage });

type CategoryKey = 'trait' | 'cancer' | 'cardio' | 'metabolic' | 'autoimmune' | 'neuro' | 'bone' | 'eye' | 'other';

// Tratti non-malattia: nessun rischio clinico, solo posizione su uno spettro.
const NON_DISEASE: CategoryKey = 'trait';

const CATEGORY_OF: Record<string, CategoryKey> = {
  HEIGHT_PGS: 'trait', CHRONOTYPE_PGS: 'trait', LONGEVITY_PGS: 'trait',
  BC_PGS: 'cancer', BC_PRS3820: 'cancer', BC_ER_NEG_PGS: 'cancer',
  PROSTATE_PGS: 'cancer', OVARIAN_PGS: 'cancer', MELANOMA_PGS: 'cancer',
  BCC_PGS: 'cancer', SCC_PGS: 'cancer', CRC_PGS: 'cancer',
  PANC_PGS: 'cancer', THYROID_PGS: 'cancer',
  CAD_PGS: 'cardio', STROKE_PGS: 'cardio',
  HF_PGS: 'cardio', AFLUTTER_PGS: 'cardio', VTE_PGS: 'cardio', LDL_PGS: 'cardio',
  T2D_PGS: 'metabolic', T2D_DGRS: 'metabolic', T1D_PGS: 'metabolic',
  BMI_PGS: 'metabolic', HBA1C_PGS: 'metabolic', URATE_PGS: 'metabolic', GOUT_PGS: 'metabolic',
  CD_PGS: 'autoimmune', ASTHMA_PGS: 'autoimmune',
  ALZ_PGS: 'neuro',
  BMD_PGS: 'bone',
  IOP_PGS: 'eye', GLAUCOMA_PGS: 'eye',
};

const CATEGORY_META: Record<CategoryKey, { label: string; color: string }> = {
  trait:     { label: 'Tratti & longevità',    color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400' },
  cancer:    { label: 'Tumori',                color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  cardio:    { label: 'Cardiovascolare',       color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  metabolic: { label: 'Metabolico',            color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  autoimmune:{ label: 'Autoimmune & Allergie', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400' },
  neuro:     { label: 'Neurologico',           color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400' },
  bone:      { label: 'Osseo',                 color: 'bg-stone-500/15 text-stone-700 dark:text-stone-400' },
  eye:       { label: 'Oculistico',            color: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  other:     { label: 'Altro',                 color: 'bg-secondary text-muted-foreground' },
};

const CATEGORY_ORDER: CategoryKey[] = ['trait', 'cancer', 'cardio', 'metabolic', 'autoimmune', 'neuro', 'bone', 'eye', 'other'];

function categoryOf(r: PrsResult): CategoryKey {
  return CATEGORY_OF[r.traitKey] ?? 'other';
}

function isNonDisease(traitKey: string | undefined | null): boolean {
  return !!traitKey && CATEGORY_OF[traitKey] === NON_DISEASE;
}

// Tratti DAVVERO neutri: alto/basso non è meglio/peggio (altezza, cronotipo).
// La longevità è non-malattia ma direzionale (alto = favorevole) → protettiva.
const NEUTRAL_TRAITS = new Set(['HEIGHT_PGS', 'CHRONOTYPE_PGS']);
function isNeutralTrait(traitKey: string | undefined | null): boolean {
  return !!traitKey && NEUTRAL_TRAITS.has(traitKey);
}

function tierColor(z: number | null | undefined, raw: number, traitKey?: string): string {
  // Tratti neutri: colore NEUTRO. Alto/basso non è meglio/peggio, è solo dove
  // cadi sullo spettro — niente semantica rosso=rischio / verde=protetto.
  if (isNeutralTrait(traitKey)) return 'text-teal-600 dark:text-teal-400';
  if (z == null) {
    if (raw > 0) return 'text-amber-600 dark:text-amber-400';
    if (raw < 0) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-sky-600 dark:text-sky-400';
  }
  // Tratti protettivi (es. BMD): la direzione sfavorevole è quella bassa → si
  // valuta lo z "effettivo" invertito, così alto = attenzione per tutti.
  const ez = effectiveZ(traitKey, z);
  if (ez >= 2) return 'text-red-600 dark:text-red-400';
  if (ez >= 1) return 'text-amber-600 dark:text-amber-400';
  if (ez <= -1) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-sky-600 dark:text-sky-400';
}

function calibrationLabel(src: string | null | undefined, calibrated: boolean): string {
  if (!calibrated) return 'non disponibile';
  if (src === 'empirical_1000G_EUR') return 'empirica 1000G EUR';
  if (src === 'hardy_weinberg_file_AF') return 'HW (file PGS)';
  if (!src) return 'HW (frequenze popolazione)';
  return src;
}

function PercentileBar({ percentile, variant = 'risk' }: { percentile: number; variant?: 'risk' | 'neutral' | 'protective' }) {
  const clamped = Math.max(0, Math.min(100, percentile));
  // risk: verde(basso)→rosso(alto), alto = attenzione.
  // protective: invertito, rosso(basso)→verde(alto), basso = attenzione.
  // neutral: simmetrico, nessun lato "buono"/"cattivo".
  const grad =
    variant === 'neutral'
      ? 'bg-gradient-to-r from-sky-400/30 via-teal-400/25 to-violet-400/30'
      : variant === 'protective'
      ? 'bg-gradient-to-r from-red-500/40 via-sky-400/30 to-emerald-500/30'
      : 'bg-gradient-to-r from-emerald-500/30 via-sky-400/30 to-red-500/40';
  return (
    <div className={`relative h-2 rounded-full ${grad}`}>
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-foreground border-2 border-background shadow"
        style={{ left: `calc(${clamped}% - 6px)` }}
        title={`${percentile.toFixed(0)}° percentile`}
      />
    </div>
  );
}

function PrsRow({ r, expanded, onToggle }: { r: PrsResult; expanded: boolean; onToggle: () => void }) {
  const calibrated = typeof r.percentile === 'number' && typeof r.zScore === 'number';
  const barVariant: 'risk' | 'neutral' | 'protective' = isNeutralTrait(r.traitKey)
    ? 'neutral'
    : isProtectiveTrait(r.traitKey)
    ? 'protective'
    : 'risk';
  return (
    <div className="border-b last:border-b-0 border-border/60">
      <button
        onClick={onToggle}
        className="w-full text-left py-3 px-2 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{r.trait}</span>
              {r.pgsId && (
                <span className="text-[10px] font-mono text-muted-foreground">{r.pgsId}</span>
              )}
              {!calibrated && (
                <Badge variant="secondary" className="text-[10px] py-0">solo raw</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.interpretation}</p>
            {isProtectiveTrait(r.traitKey) && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 leading-snug">⚠ {protectiveNote(r.traitKey)}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`font-mono text-sm ${tierColor(r.zScore ?? null, r.rawScore, r.traitKey)}`}>
              {calibrated
                ? `${(r.percentile as number).toFixed(0)}° · z${(r.zScore as number) >= 0 ? '+' : ''}${(r.zScore as number).toFixed(2)}`
                : `raw ${r.rawScore >= 0 ? '+' : ''}${r.rawScore.toFixed(2)}`}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
        {calibrated && (
          <div className="mt-2">
            <PercentileBar percentile={r.percentile as number} variant={barVariant} />
          </div>
        )}
      </button>
      {expanded && (
        <div className="px-2 pb-4 pt-1 space-y-2 bg-secondary/20">
          {r.description && <p className="text-xs text-foreground/80 leading-relaxed">{r.description}</p>}
          {r.distribution && calibrated && (
            <PrsDistributionChart dist={r.distribution} rawScore={r.rawScore} percentile={r.percentile} />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Marker usati</span>
              <p className="font-mono">{r.markersUsed.toLocaleString()}/{r.markersTotal.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Raw score</span>
              <p className="font-mono">{r.rawScore >= 0 ? '+' : ''}{r.rawScore.toFixed(3)}</p>
            </div>
            {calibrated && (
              <>
                <div>
                  <span className="text-muted-foreground">μ atteso · σ</span>
                  <p className="font-mono">{(r.expectedMean as number).toFixed(2)} · {(r.expectedSd as number).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Calibrazione</span>
                  <p>{calibrationLabel(r.calibrationSource, calibrated)}</p>
                </div>
              </>
            )}
          </div>
          {r.pgsId && (
            <div className="pt-1">
              <a
                href={`https://www.pgscatalog.org/score/${r.pgsId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
              >
                Scheda PGS Catalog ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrsPage() {
  const { activeFile } = useActiveVcf();
  const [activeCat, setActiveCat] = useState<CategoryKey | 'all'>('all');
  const [onlyNotable, setOnlyNotable] = useState(false);
  const [onlyCalibrated, setOnlyCalibrated] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['prsResults', activeFile?.id],
    queryFn: () => gqlClient.request<{ prsResults: PrsResult[] }>(PRS_RESULTS_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });

  const all = data?.prsResults ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const r of all) {
      const k = categoryOf(r);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    let arr = all;
    if (activeCat !== 'all') arr = arr.filter((r) => categoryOf(r) === activeCat);
    if (onlyNotable) arr = arr.filter((r) => typeof r.zScore === 'number' && Math.abs(r.zScore) >= 1);
    if (onlyCalibrated) arr = arr.filter((r) => typeof r.percentile === 'number');
    return arr;
  }, [all, activeCat, onlyNotable, onlyCalibrated]);

  const byCategory = useMemo(() => {
    const groups = new Map<CategoryKey, PrsResult[]>();
    for (const r of filtered) {
      const k = categoryOf(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    // sort each group by |z| desc (calibrated first, then by |raw|)
    for (const list of groups.values()) {
      list.sort((a, b) => {
        const az = typeof a.zScore === 'number' ? Math.abs(a.zScore) : -Infinity;
        const bz = typeof b.zScore === 'number' ? Math.abs(b.zScore) : -Infinity;
        if (bz !== az) return bz - az;
        return Math.abs(b.rawScore) - Math.abs(a.rawScore);
      });
    }
    return groups;
  }, [filtered]);

  if (!activeFile) {
    return (
      <div className="text-center text-muted-foreground py-12">Carica un file VCF per vedere la predisposizione poligenica.</div>
    );
  }

  return (
    <AiSummaryProvider vcfFileId={activeFile.id} type="prs" title="Analisi Predisposizione Poligenica">
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Predisposizione poligenica</h1>
        <div className="flex items-center gap-2">
          <AiSummaryButton />
          <Link to="/" className="text-xs text-muted-foreground hover:underline">← Dashboard</Link>
        </div>
      </div>

      <AiSummaryCard />

      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Score poligenici (PGS) sommano l'effetto di centinaia o milioni di SNP, ciascuno con un piccolo
            contributo individuale. Il <strong>percentile</strong> e lo <strong>z-score</strong> esprimono il rischio
            <em> relativo</em> rispetto alla popolazione europea — non l'esito individuale. Stile di vita e altri
            fattori (ambiente, fenotipo, screening) restano determinanti per molte di queste condizioni.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Calibrazione empirica</strong>: media e σ ricavate sui 503 sample EUR del 1000 Genomes
            Project — la stima è precisa per il centro della distribuzione (±2 pct), meno per le code estreme
            (top/bottom 2%).
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
            <strong>⚠ Direzione del punteggio.</strong> Nella maggior parte degli score un valore <em>alto</em> è
            la direzione che desta attenzione (più rischio) e uno basso è rassicurante (verde). Alcuni score
            misurano però un <strong>tratto protettivo</strong>, dove è il valore <em>basso</em> a essere
            sfavorevole: in particolare la <strong>densità minerale ossea (BMD)</strong> — un percentile basso
            indica ossa meno dense e maggior rischio di osteoporosi, non un beneficio. Questi score sono
            segnalati e colorati di conseguenza.
          </p>
        </CardContent>
      </Card>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCat('all')}
          className={`px-3 py-1.5 rounded-md text-sm transition-all ${
            activeCat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Tutti <span className="ml-1 text-xs opacity-70">{counts.all ?? 0}</span>
        </button>
        {CATEGORY_ORDER.filter((k) => (counts[k] ?? 0) > 0).map((k) => (
          <button
            key={k}
            onClick={() => setActiveCat(k)}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              activeCat === k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {CATEGORY_META[k].label} <span className="ml-1 text-xs opacity-70">{counts[k]}</span>
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant={onlyNotable ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyNotable((v) => !v)}
        >
          |z| ≥ 1
        </Button>
        <Button
          variant={onlyCalibrated ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyCalibrated((v) => !v)}
        >
          Solo calibrati
        </Button>
      </div>

      {/* Gruppi per categoria */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nessuno score corrisponde ai filtri.</CardContent></Card>
      ) : (
        CATEGORY_ORDER.map((k) => {
          const list = byCategory.get(k);
          if (!list || list.length === 0) return null;
          const meta = CATEGORY_META[k];
          return (
            <Card key={k}>
              <CardContent className="pt-3 pb-1">
                <div className="flex items-center gap-2 mb-1 pb-2 border-b border-border/60">
                  <Badge className={meta.color}>{meta.label}</Badge>
                  <span className="text-xs text-muted-foreground">{list.length} score</span>
                </div>
                {k === 'trait' && (
                  <p className="text-xs text-muted-foreground py-2 leading-snug">
                    Non sono rischi di malattia. Altezza e cronotipo sono <strong>neutri</strong>
                    {' '}(alto/basso non è meglio/peggio, solo dove cadi sullo spettro). La
                    <strong> longevità</strong> ha invece una direzione: un valore basso è la
                    direzione sfavorevole (segnalata come gli altri tratti protettivi). Score
                    compatti — indicativi sulla direzione, non predittivi.
                  </p>
                )}
                {list.map((r) => (
                  <PrsRow
                    key={r.id}
                    r={r}
                    expanded={expandedId === r.id}
                    onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
    </AiSummaryProvider>
  );
}
