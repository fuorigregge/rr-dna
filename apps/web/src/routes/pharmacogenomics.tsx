import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VariantLink } from '@/components/variant-link';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/pharmacogenomics')({ component: PharmacogenomicsPage });

const QUERY = `query($vcfFileId: String!, $category: String, $pagination: PaginationInput) { pharmacogenomics(vcfFileId: $vcfFileId, category: $category, pagination: $pagination) { items { id variantId drug effect metabolizerStatus evidenceLevel source metadata } total hasMore } }`;

const COUNTS_QUERY = `query($vcfFileId: String!) { pharmacogenomicsCounts(vcfFileId: $vcfFileId) { total contraindicated sensitivity altered } }`;

const PANEL_QUERY = `query($vcfFileId: String!) { pharmacoPanel(vcfFileId: $vcfFileId) { gene diplotype phenotype drugs confidence } }`;

const PAGE_SIZE = 25;

type SeverityCategory = 'contraindicated' | 'sensitivity' | 'altered';

const SEVERITY_CONFIG: Record<SeverityCategory, { label: string; bg: string; border: string; text: string; dot: string }> = {
  contraindicated: { label: 'Controindicato', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#ef4444', dot: 'bg-red-500' },
  sensitivity: { label: "Sensibilita' aumentata", bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', text: '#fb923c', dot: 'bg-orange-500' },
  altered: { label: 'Metabolismo alterato', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)', text: '#eab308', dot: 'bg-yellow-500' },
};

function classifySeverity(effect?: string): SeverityCategory {
  if (!effect) return 'altered';
  const lower = effect.toLowerCase();
  if (lower.includes('contraindicated') || lower.includes('controindicato') || lower.includes('controindicata')) return 'contraindicated';
  if (lower.includes('sensitivity') || lower.includes('sensibilit')) return 'sensitivity';
  return 'altered';
}

function getMetabolizerInfo(status?: string) {
  if (!status) return { className: 'bg-muted text-muted-foreground', label: '\u2014' };
  const lower = status.toLowerCase();
  if (lower.includes('poor') || lower.includes('slow') || lower.includes('lento')) return { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: status };
  if (lower.includes('ultra') || lower.includes('rapid')) return { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', label: status };
  if (lower.includes('intermediate') || lower.includes('intermedio')) return { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: status };
  if (lower.includes('normal') || lower.includes('extensive')) return { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: status };
  return { className: 'bg-secondary text-secondary-foreground', label: status };
}

function getEvidenceBadge(level?: string) {
  if (!level) return { className: 'bg-muted text-muted-foreground', label: 'N/D' };
  if (level.includes('1A')) return { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', label: level };
  if (level.includes('1B')) return { className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', label: level };
  if (level.includes('2A')) return { className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', label: level };
  if (level.includes('2B')) return { className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', label: level };
  return { className: 'bg-secondary text-secondary-foreground', label: level };
}

function PharmacogenomicsPage() {
  const { activeFile } = useActiveVcf();
  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['pharmacogenomics', activeFile?.id, page, categoryFilter],
    queryFn: () => gqlClient.request<any>(QUERY, { vcfFileId: activeFile?.id, category: categoryFilter || undefined, pagination: { offset: page * PAGE_SIZE, limit: PAGE_SIZE } }),
    enabled: !!activeFile,
  });

  const { data: countsData } = useQuery({
    queryKey: ['pharmacogenomicsCounts', activeFile?.id],
    queryFn: () => gqlClient.request<any>(COUNTS_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });

  const { data: panelData } = useQuery({
    queryKey: ['pharmacoPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(PANEL_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const panel = panelData?.pharmacoPanel ?? [];

  const items = data?.pharmacogenomics?.items ?? [];
  const total = data?.pharmacogenomics?.total ?? 0;
  const hasMore = data?.pharmacogenomics?.hasMore ?? false;
  const counts = countsData?.pharmacogenomicsCounts;

  return (
    <AiSummaryProvider vcfFileId={activeFile?.id} type="pharma" title="Analisi Farmacogenomica">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Farmacogenomica</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      {/* Pannello farmacogeni — diplotipo/fenotipo per gene (CPIC) */}
      {panel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pannello farmacogeni</CardTitle>
            <CardDescription>
              Diplotipo e fenotipo metabolizzatore per gene (modello CPIC) — il risultato
              autorevole, che tiene conto della direzione dell'allele (a differenza delle
              associazioni generiche per rsID sotto).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {panel.map((p: any) => {
                const m = getMetabolizerInfo(p.phenotype);
                return (
                  <div key={p.gene} className="p-3 rounded-lg bg-secondary/50 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">
                        {p.gene} <span className="font-mono text-muted-foreground">{p.diplotype ?? '—'}</span>
                      </span>
                      {p.confidence === 'LOW' && <Badge variant="outline" className="text-amber-600">bassa conf.</Badge>}
                    </div>
                    {p.phenotype && (
                      <span className={`inline-block text-xs px-2 py-0.5 rounded ${m.className}`}>{p.phenotype}</span>
                    )}
                    {p.drugs && <p className="text-xs text-muted-foreground">Farmaci: {p.drugs}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Cosa indica questa analisi?</CardTitle>
          <CardDescription>La farmacogenomica studia come il tuo DNA influenza la risposta ai farmaci</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Ogni persona metabolizza i farmaci in modo diverso in base alle proprie varianti genetiche.
            Conoscere il tuo profilo farmacogenomico aiuta il medico a scegliere il farmaco e il dosaggio
            piu' adatti a te, riducendo il rischio di effetti collaterali e migliorando l'efficacia della terapia.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Stato del metabolizzatore</p>
            <ul className="space-y-1.5 ml-1">
              <li className="flex items-start gap-2"><Badge className="mt-0.5 shrink-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0">Poor / Lento</Badge><span>Il farmaco si accumula nell'organismo con rischio maggiore di effetti collaterali.</span></li>
              <li className="flex items-start gap-2"><Badge className="mt-0.5 shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">Rapid / Ultra-rapid</Badge><span>Il farmaco viene eliminato troppo rapidamente, potrebbe non essere efficace.</span></li>
              <li className="flex items-start gap-2"><Badge className="mt-0.5 shrink-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0">Intermediate</Badge><span>Metabolismo intermedio, potrebbe servire un aggiustamento del dosaggio.</span></li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="https://www.pharmgkb.org/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">PharmGKB ↗</a>
            <a href="https://cpicpgx.org/guidelines/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Linee guida CPIC ↗</a>
          </div>
          <p className="text-xs border-t pt-3 text-muted-foreground/80">
            Queste informazioni hanno scopo puramente informativo. Consulta sempre il tuo medico prima di modificare qualsiasi terapia.
          </p>
        </CardContent>
      </Card>

      {/* Global counts */}
      {counts && counts.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(SEVERITY_CONFIG) as [SeverityCategory, typeof SEVERITY_CONFIG[SeverityCategory]][]).map(([key, config]) => (
            <Card key={key} style={{ background: config.bg, borderColor: config.border }} className="border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${config.dot}`} />
                  <span className="text-xs uppercase tracking-widest" style={{ color: config.text }}>{config.label}</span>
                </div>
                <div className="text-2xl font-bold">{counts[key]}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {counts.total > 0 ? `${Math.round((counts[key] / counts.total) * 100)}% delle ${counts.total} interazioni` : 'nessuna'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cards */}
      {/* Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{total} interazioni trovate</p>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          className="text-sm bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground"
        >
          <option value="">Tutte le categorie</option>
          <option value="contraindicated">Controindicato</option>
          <option value="sensitivity">Sensibilita' aumentata</option>
          <option value="altered">Metabolismo alterato</option>
        </select>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun dato farmacogenomico disponibile.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item: any) => {
              const severity = classifySeverity(item.effect);
              const severityConfig = SEVERITY_CONFIG[severity];
              const metab = getMetabolizerInfo(item.metabolizerStatus);
              const evidence = getEvidenceBadge(item.evidenceLevel);
              const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;

              return (
                <Card key={item.id} style={{ borderColor: severityConfig.border }} className="border">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${severityConfig.dot}`} />
                        <span className="font-semibold text-base">{item.drug}</span>
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0" style={{ background: severityConfig.bg, color: severityConfig.text }}>
                        {severityConfig.label}
                      </span>
                    </div>
                    {item.effect && <p className="text-sm text-muted-foreground leading-snug">{item.effect}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`${metab.className} border-0 text-[11px]`}>{metab.label}</Badge>
                      <Badge className={`${evidence.className} border-0 text-[11px]`}>Evidenza: {evidence.label}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{item.source}</span>
                    </div>
                    {meta && (meta.description || meta.links) && (
                      <div className="border-t pt-2 mt-1 space-y-1.5">
                        {meta.description && <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>}
                        {meta.links && (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(meta.links).map(([label, url]) => (
                              <a key={label} href={url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">{label} ↗</a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <VariantLink variantId={item.variantId} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {total > 0 ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} di ${total}` : 'Nessun risultato'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Precedente</Button>
              <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Successiva</Button>
            </div>
          </div>
        </>
      )}
    </div>
    </AiSummaryProvider>
  );
}
