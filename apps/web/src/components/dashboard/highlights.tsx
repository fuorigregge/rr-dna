import { Link } from '@tanstack/react-router';

export interface Highlight {
  category: string;
  gene?: string | null;
  title: string;
  detail?: string | null;
  severity: string; // high | medium | info
}

const SEVERITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  info: 'bg-sky-500',
};

// Compact single finding (severity dot + title + detail). Used in the PDF report.
export function HighlightRow({ h }: { h: Highlight }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[h.severity] ?? 'bg-slate-400'}`} />
      <div className="min-w-0">
        <span className="text-sm font-medium">
          {h.gene ? <span className="font-mono text-xs text-muted-foreground mr-1">{h.gene}</span> : null}
          {h.title}
        </span>
        {h.detail ? <p className="text-xs text-muted-foreground leading-snug">{h.detail}</p> : null}
      </div>
    </div>
  );
}

// Dashboard "In evidenza": grouped by IMPORTANCE (not by data type) so the few
// things that matter come first; the many informational traits are collapsed.
const TIERS: Array<{ sev: string; label: string; dot: string; text: string }> = [
  { sev: 'high', label: 'Clinicamente rilevante', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { sev: 'medium', label: 'Da approfondire / verificare', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { sev: 'info', label: 'Informativo', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
];

function TierRow({ h }: { h: Highlight }) {
  return (
    <div className="leading-snug">
      <span className="text-sm font-medium">
        {h.gene ? <span className="font-mono text-xs text-muted-foreground mr-1">{h.gene}</span> : null}
        {h.title}
      </span>
      {h.detail ? <span className="text-xs text-muted-foreground"> · {h.detail}</span> : null}
    </div>
  );
}

export function HighlightsGrouped({ items }: { items: Highlight[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nessun risultato di particolare rilievo dai pannelli. Genera i riassunti AI delle sezioni per un quadro completo.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {TIERS.map((tier) => {
        const tierItems = items.filter((i) => i.severity === tier.sev);
        if (tierItems.length === 0) return null;

        // In the informational tier, collapse the (often many) carried traits
        // into a single count + link, keeping lineages and the like inline.
        const isInfo = tier.sev === 'info';
        const traits = isInfo ? tierItems.filter((i) => i.category === 'trait') : [];
        const rows = isInfo ? tierItems.filter((i) => i.category !== 'trait') : tierItems;

        return (
          <div key={tier.sev}>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5">
              <span className={`h-2 w-2 rounded-full ${tier.dot}`} />
              <span className={tier.text}>{tier.label}</span>
            </h3>
            <div className="space-y-1 pl-3.5">
              {rows.map((h) => (
                <TierRow key={`${h.category}-${h.gene ?? ''}-${h.title}`} h={h} />
              ))}
              {traits.length > 0 && (
                <Link to="/traits" className="inline-block text-sm text-primary hover:underline">
                  {traits.length} tratti notevoli portati →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
