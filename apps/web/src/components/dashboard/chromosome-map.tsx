import { useNavigate } from '@tanstack/react-router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';

interface ChromosomeData {
  chromosome: string;
  variantCount: number;
  pathogenicCount: number;
}

interface ChromosomeMapProps {
  data: ChromosomeData[];
}

const ORDERED = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','X','Y'];

function getBarColor(pathogenicCount: number, variantCount: number) {
  if (variantCount === 0) return 'hsl(220, 15%, 25%)';
  if (pathogenicCount === 0) return 'hsl(239, 84%, 67%)';
  const ratio = pathogenicCount / variantCount;
  if (ratio > 0.1) return 'hsl(0, 72%, 51%)';
  if (ratio > 0.01) return 'hsl(25, 95%, 53%)';
  return 'hsl(45, 93%, 47%)';
}

export function ChromosomeMap({ data }: ChromosomeMapProps) {
  const navigate = useNavigate();
  const dataMap = Object.fromEntries(data.map(d => [d.chromosome.replace('chr', ''), d]));

  const chartData = ORDERED.map(chr => ({
    chr,
    variantCount: dataMap[chr]?.variantCount ?? 0,
    pathogenicCount: dataMap[chr]?.pathogenicCount ?? 0,
  }));

  const hasData = chartData.some(d => d.variantCount > 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
        <span className="text-sm font-semibold">Mappa Cromosomica</span>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: 'hsl(0, 72%, 51%)' }} />{'> 10% patogeniche'}</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: 'hsl(25, 95%, 53%)' }} />{'1-10% patogeniche'}</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: 'hsl(45, 93%, 47%)' }} />{'< 1% patogeniche'}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1" />Nessuna patogenica</span>
        </div>
      </div>
      <div className="bg-secondary rounded-lg p-2 sm:p-4 border border-border overflow-x-auto">
        <div className="min-w-[480px]">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="chr" tick={{ fontSize: 9, fill: 'hsl(0, 0%, 60%)' }} axisLine={false} tickLine={false} />
              <YAxis hide domain={hasData ? [0, 'dataMax'] : [0, 1]} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(0, 0%, 10%)', border: '1px solid hsl(0, 0%, 20%)', borderRadius: 8, fontSize: 12 }}
                labelFormatter={chr => `Cromosoma ${chr}`}
                formatter={(value: any, _name: any, props: any) => {
                  const p = props.payload.pathogenicCount;
                  return [`${Number(value).toLocaleString()} varianti${p > 0 ? ` (${p} patogeniche)` : ''}`, 'Conteggio'];
                }}
              />
              <Bar dataKey="variantCount" radius={[3, 3, 0, 0]} cursor="pointer" onClick={(_data, index) => navigate({ to: '/chromosomes/$id', params: { id: chartData[index].chr } })}>
                {chartData.map((entry) => (
                  <Cell key={entry.chr} fill={getBarColor(entry.pathogenicCount, entry.variantCount)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
