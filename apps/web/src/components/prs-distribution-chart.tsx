import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { PrsDistribution } from '@/components/dashboard/prs-card';

/**
 * Curva di distribuzione di un PGS: istogramma empirico dei 503 europei 1000G
 * (area), con sopra la gaussiana teorica N(μ,σ²) (linea tratteggiata). Linee di
 * riferimento per media, mediana e punteggio del soggetto. Il divario μ↔mediana
 * e lo scostamento dell'area dalla gaussiana rendono visibile l'eventuale skew.
 */
export function PrsDistributionChart({
  dist, rawScore, percentile,
}: {
  dist: PrsDistribution;
  rawScore: number;
  percentile?: number | null;
}) {
  const { data, mean, median, domain } = useMemo(() => {
    const { counts, binStart, binWidth, sd, nSamples, mean, median } = dist;
    if (!counts?.length || !binWidth || binWidth <= 0 || nSamples == null) {
      return { data: [], mean: null, median: null, domain: [0, 1] as [number, number] };
    }
    const norm = 1 / (nSamples * binWidth); // counts → densità (area = 1)
    const gauss = (x: number) =>
      sd && sd > 0 ? Math.exp(-0.5 * ((x - (mean ?? 0)) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)) : 0;
    const pts = counts.map((c, i) => {
      const x = binStart! + (i + 0.5) * binWidth;
      return { x, emp: c * norm, gauss: gauss(x) };
    });
    const lo = Math.min(binStart!, rawScore);
    const hi = Math.max(binStart! + counts.length * binWidth, rawScore);
    const pad = (hi - lo) * 0.04;
    return { data: pts, mean, median, domain: [lo - pad, hi + pad] as [number, number] };
  }, [dist, rawScore]);

  if (!data.length) return null;

  return (
    <div className="mt-1">
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 2, left: 8 }}>
          <XAxis
            dataKey="x" type="number" domain={domain} scale="linear"
            tick={{ fontSize: 10 }} tickFormatter={(v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))}
            stroke="currentColor" className="text-muted-foreground"
          />
          <YAxis hide domain={[0, 'dataMax']} />
          <Area
            type="monotone" dataKey="emp" name="1000G EUR"
            stroke="none" fill="currentColor" fillOpacity={0.18} className="text-teal-500"
            isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="gauss" name="gaussiana"
            stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" dot={false}
            className="text-muted-foreground" isAnimationActive={false}
          />
          {mean != null && (
            <ReferenceLine x={mean} stroke="currentColor" strokeWidth={1} className="text-sky-500"
              label={{ value: 'μ', position: 'top', fontSize: 10, fill: 'currentColor' }} />
          )}
          {median != null && Math.abs((median ?? 0) - (mean ?? 0)) > (dist.binWidth ?? 0) * 0.4 && (
            <ReferenceLine x={median} stroke="currentColor" strokeWidth={1} strokeDasharray="2 2"
              className="text-violet-500"
              label={{ value: 'med', position: 'top', fontSize: 10, fill: 'currentColor' }} />
          )}
          <ReferenceLine
            x={rawScore} stroke="currentColor" strokeWidth={2} className="text-foreground"
            label={{ value: percentile != null ? `tu · ${percentile.toFixed(0)}°` : 'tu', position: 'top', fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-sm bg-teal-500/30" /> distribuzione 1000G EUR ({dist.nSamples})</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 border-t border-dashed border-muted-foreground" /> gaussiana N(μ,σ²)</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 border-t-2 border-foreground" /> il tuo punteggio</span>
      </div>
    </div>
  );
}
