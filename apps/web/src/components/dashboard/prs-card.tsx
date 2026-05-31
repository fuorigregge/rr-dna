import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { effectiveZ, isProtectiveTrait, protectiveNote } from '@/lib/prs-direction';

export interface PrsResult {
  id: string;
  traitKey: string;
  trait: string;
  label: string;
  description?: string | null;
  pgsId?: string | null;
  source?: string | null;
  calibrationSource?: string | null;
  rawScore: number;
  expectedMean?: number | null;
  expectedSd?: number | null;
  zScore?: number | null;
  percentile?: number | null;
  markersUsed: number;
  markersTotal: number;
  interpretation?: string | null;
}

const TOP_N = 5;

function tierColor(z: number | null | undefined, raw: number, traitKey?: string): string {
  if (z == null) {
    // No calibration available — use raw score sign as a coarse signal
    if (raw > 0) return 'text-amber-600 dark:text-amber-400';
    if (raw < 0) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-sky-600 dark:text-sky-400';
  }
  // Per i tratti protettivi (es. BMD) la direzione sfavorevole è quella bassa:
  // si valuta lo z "effettivo" invertito, così alto = attenzione per tutti.
  const ez = effectiveZ(traitKey, z);
  if (ez >= 2) return 'text-red-600 dark:text-red-400';
  if (ez >= 1) return 'text-amber-600 dark:text-amber-400';
  if (ez <= -1) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-sky-600 dark:text-sky-400';
}

function PercentileBar({ percentile }: { percentile: number }) {
  // 0-100 horizontal bar with the user's percentile marked
  const clamped = Math.max(0, Math.min(100, percentile));
  return (
    <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500/30 via-sky-400/30 to-red-500/40 overflow-visible">
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-foreground border-2 border-background shadow"
        style={{ left: `calc(${clamped}% - 6px)` }}
        title={`${percentile.toFixed(0)}° percentile`}
      />
      <div className="absolute -bottom-4 left-0 text-[10px] text-muted-foreground">bassa</div>
      <div className="absolute -bottom-4 right-0 text-[10px] text-muted-foreground">alta</div>
    </div>
  );
}

export function PrsCard({ results }: { results: PrsResult[] }) {
  if (results.length === 0) return null;
  // Top N per |z|, calibrati prima; non-calibrati ordinati per |raw|
  const sorted = [...results].sort((a, b) => {
    const az = typeof a.zScore === 'number' ? Math.abs(a.zScore) : -Infinity;
    const bz = typeof b.zScore === 'number' ? Math.abs(b.zScore) : -Infinity;
    if (bz !== az) return bz - az;
    return Math.abs(b.rawScore) - Math.abs(a.rawScore);
  });
  const top = sorted.slice(0, TOP_N);
  const hidden = Math.max(0, results.length - TOP_N);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Predisposizione poligenica</CardTitle>
          <Link to="/prs" className="text-xs text-primary hover:underline">
            Vedi tutti ({results.length}) →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Top {top.length} score per scostamento dalla media (|z|).{' '}
          {hidden > 0 && <>Altri {hidden} score in <Link to="/prs" className="underline">pagina dedicata</Link>.</>}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {top.map((r) => {
          const calibrated = typeof r.percentile === 'number' && typeof r.zScore === 'number';
          return (
            <div key={r.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {r.label}
                  {r.pgsId && (
                    <a
                      href={`https://www.pgscatalog.org/score/${r.pgsId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-[10px] font-mono text-muted-foreground hover:underline"
                    >
                      {r.pgsId}↗
                    </a>
                  )}
                </span>
                <span className={`font-mono text-sm ${tierColor(r.zScore ?? null, r.rawScore, r.traitKey)}`}>
                  {calibrated
                    ? `${(r.percentile as number).toFixed(0)}° pct · z ${(r.zScore as number) >= 0 ? '+' : ''}${(r.zScore as number).toFixed(2)}`
                    : `raw ${r.rawScore >= 0 ? '+' : ''}${r.rawScore.toFixed(2)}`}
                </span>
              </div>
              {calibrated && <PercentileBar percentile={r.percentile as number} />}
              {calibrated && <div className="pt-3" />}
              <p className="text-xs text-muted-foreground leading-relaxed">{r.interpretation}</p>
              {isProtectiveTrait(r.traitKey) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">⚠ {protectiveNote(r.traitKey)}</p>
              )}
              <p className="text-[10px] text-muted-foreground/70 font-mono">
                {r.markersUsed.toLocaleString()}/{r.markersTotal.toLocaleString()} SNP · raw {r.rawScore.toFixed(2)}
                {calibrated && ` · μ ${(r.expectedMean as number).toFixed(2)} · σ ${(r.expectedSd as number).toFixed(2)}`}
                {calibrated && r.calibrationSource === 'empirical_1000G_EUR' && ' · calibrazione empirica 1000G EUR'}
                {calibrated && r.calibrationSource === 'hardy_weinberg_file_AF' && ' · calibrazione HW (file PGS)'}
                {calibrated && !r.calibrationSource && ' · calibrazione HW (frequenze popolazione)'}
                {!calibrated && ' · calibrazione non disponibile'}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
