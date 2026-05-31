import { Card, CardContent } from '@/components/ui/card';

interface StatsCardsProps {
  totalVariants: number;
  snpCount: number;
  indelCount: number;
  heterozygousCount: number;
  homozygousCount: number;
}

export function StatsCards({ totalVariants, snpCount, indelCount, heterozygousCount, homozygousCount }: StatsCardsProps) {
  const snpPercent = totalVariants > 0 ? Math.round((snpCount / totalVariants) * 100) : 0;
  const genotyped = heterozygousCount + homozygousCount;
  const hetPercent = genotyped > 0 ? Math.round((heterozygousCount / genotyped) * 100) : 0;
  const homPercent = genotyped > 0 ? 100 - hetPercent : 0;

  const stats = [
    { label: 'Totale Varianti', value: totalVariants.toLocaleString(), sub: 'dal file VCF', color: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)', text: '#818cf8' },
    { label: 'SNP / Indel', value: `${snpPercent}%`, sub: `${snpCount.toLocaleString()} SNP · ${indelCount.toLocaleString()} indel`, color: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: '#34d399' },
    { label: 'Zigosità', value: `${hetPercent}% het`, sub: `${homPercent}% omo · ${hetPercent}% etero`, color: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', text: '#fb923c' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((s) => (
        <Card key={s.label} style={{ background: s.color, borderColor: s.border }} className="border">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: s.text }}>{s.label}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
