// ClinVar review status → ★ count: 0 = no assertion criteria provided (often noise),
// 1 = single submitter, 2 = multiple submitters no conflicts, 3 = expert panel,
// 4 = practice guideline. The gulf in reliability between 0★ and 2-4★ deserves to be
// visually obvious wherever a PATHOGENIC label is shown.
function starInfo(stars: number): { className: string; tooltip: string } {
  if (stars >= 4) return { className: 'text-yellow-500 font-semibold', tooltip: '4★ practice guideline (massima affidabilità ClinVar)' };
  if (stars >= 3) return { className: 'text-yellow-600 dark:text-yellow-400', tooltip: '3★ reviewed by expert panel' };
  if (stars >= 2) return { className: 'text-amber-500', tooltip: '2★ multiple submitters, no conflicts (segnale solido)' };
  if (stars >= 1) return { className: 'text-amber-600/60 dark:text-amber-400/60', tooltip: '1★ single submitter (criteri forniti, evidenza limitata)' };
  return { className: 'text-red-500/70 dark:text-red-400/70', tooltip: '0★ no assertion criteria — qualità minima, possibile errore/non validato' };
}

export function ClinvarStars({ stars, size = 'sm' }: { stars: number; size?: 'sm' | 'md' }) {
  const info = starInfo(stars);
  return (
    <span className={`font-mono ${size === 'sm' ? 'text-[11px]' : 'text-sm'} ${info.className}`} title={info.tooltip}>
      {stars}★
    </span>
  );
}
