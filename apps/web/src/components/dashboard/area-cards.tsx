import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';

interface AreaCardsProps {
  pathogenicCount: number;
  pharmacogenomicCount: number;
  carrierCount: number;
  ancestryCount: number;
  traitCount: number;
  fitnessCount: number;
}

export function AreaCards(props: AreaCardsProps) {
  const areas = [
    { label: 'Rischio Malattie', icon: '\ud83c\udfe5', count: props.pathogenicCount, sub: 'varianti patogeniche', to: '/diseases' as const, color: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)', text: '#fca5a5' },
    { label: 'Farmacogenomica', icon: '\ud83d\udc8a', count: props.pharmacogenomicCount, sub: 'interazioni farmaco', to: '/pharmacogenomics' as const, color: 'rgba(129,140,248,0.06)', border: 'rgba(129,140,248,0.15)', text: '#a5b4fc' },
    { label: 'Carrier Status', icon: '\ud83e\uddec', count: props.carrierCount, sub: 'condizioni portate', to: '/carrier' as const, color: 'rgba(251,146,60,0.06)', border: 'rgba(251,146,60,0.15)', text: '#fdba74' },
    { label: 'Ancestry', icon: '\ud83c\udf0d', count: props.ancestryCount, sub: 'marcatori ancestry', to: '/ancestry' as const, color: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.15)', text: '#6ee7b7' },
    { label: 'Tratti & Fitness', icon: '\ud83e\uddd0', count: props.traitCount + props.fitnessCount, sub: 'tratti e marcatori fitness', to: '/traits' as const, color: 'rgba(244,114,182,0.06)', border: 'rgba(244,114,182,0.15)', text: '#f9a8d4' },
  ];

  return (
    <div>
      <span className="text-sm font-semibold mb-3 block">Aree di Analisi</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {areas.map((a) => (
          <Link key={a.label} to={a.to}>
            <Card className="border cursor-pointer hover:ring-1 hover:ring-primary transition-all" style={{ background: a.color, borderColor: a.border }}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{a.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: a.text }}>{a.label}</span>
                </div>
                <div className="text-2xl font-bold">{a.count}</div>
                <div className="text-xs text-muted-foreground">{a.sub}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
