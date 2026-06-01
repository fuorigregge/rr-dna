import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VariantLink } from '@/components/variant-link';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/traits')({ component: TraitsPage });

const QUERY = `query($vcfFileId: String!, $category: String, $pagination: PaginationInput) {
  phenotypeTraits(vcfFileId: $vcfFileId, category: $category, pagination: $pagination) { items { id variantId trait effect category source metadata } total hasMore }
}`;

const COUNTS_QUERY = `query($vcfFileId: String!) { traitCounts(vcfFileId: $vcfFileId) { total metabolism physical cognitive } }`;

const PANEL_QUERY = `query($vcfFileId: String!) { traitPanel(vcfFileId: $vcfFileId) { rsId gene trait category state genotype zygosity interpretation confidence } }`;

const PANEL_STATE: Record<string, { label: string; cls: string }> = {
  CARRIED: { label: 'Variante portata', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  REFERENCE: { label: 'Standard (riferimento)', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  NOT_COVERED: { label: 'Non valutabile', cls: 'bg-secondary text-muted-foreground' },
};

const PAGE_SIZE = 25;

const TABS = [
  { key: '', label: 'Tutti', color: 'bg-secondary' },
  { key: 'METABOLISM', label: 'Metabolismo', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  { key: 'PHYSICAL', label: 'Fisico & Fitness', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  { key: 'COGNITIVE', label: 'Cognitivo', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400' },
];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  METABOLISM: {
    label: 'Metabolismo',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    description: 'Come il tuo organismo processa nutrienti, caffeina, alcol, farmaci e altre sostanze.',
  },
  PHYSICAL: {
    label: 'Fisico & Fitness',
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    description: 'Struttura corporea, cardiovascolare, prestazione sportiva, recupero e nutrigenomica.',
  },
  COGNITIVE: {
    label: 'Cognitivo',
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
    description: 'Funzioni cerebrali, neurotrasmettitori e processi cognitivi.',
  },
};

function TraitsPage() {
  const { activeFile } = useActiveVcf();
  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['phenotypeTraits', activeFile?.id, page, categoryFilter],
    queryFn: () => gqlClient.request<any>(QUERY, {
      vcfFileId: activeFile?.id,
      category: categoryFilter || undefined,
      pagination: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
    }),
    enabled: !!activeFile,
  });

  const { data: countsData } = useQuery({
    queryKey: ['traitCounts', activeFile?.id],
    queryFn: () => gqlClient.request<any>(COUNTS_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });

  const { data: panelData } = useQuery({
    queryKey: ['traitPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(PANEL_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const panel = panelData?.traitPanel ?? [];
  const appearance = panel.filter((p: any) => p.category === 'APPEARANCE');
  const corePanel = panel.filter((p: any) => p.category !== 'APPEARANCE');

  const items = data?.phenotypeTraits?.items ?? [];
  const total = data?.phenotypeTraits?.total ?? 0;
  const hasMore = data?.phenotypeTraits?.hasMore ?? false;
  const counts = countsData?.traitCounts;

  return (
    <AiSummaryProvider vcfFileId={activeFile?.id} type="traits" title="Analisi Tratti Fenotipici">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tratti & Fitness</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      {/* Aspetto & curiosità — tratti a SNP singolo, effetto piccolo, divertenti */}
      {appearance.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Aspetto & curiosità 🎭</h2>
              <p className="text-xs text-muted-foreground">
                Tratti a singolo SNP: cerume, coriandolo, asparagi, lentiggini, capelli, starnuto fotico…
                Effetto piccolo — il fenotipo reale dipende da molti geni e dall'ambiente. Per curiosità, non diagnostici.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {appearance.map((p: any) => {
                const st = PANEL_STATE[p.state] ?? PANEL_STATE.NOT_COVERED;
                return (
                  <div key={p.rsId} className="p-3 rounded-lg bg-secondary/50 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">
                        {p.trait} <span className="text-muted-foreground font-normal">({p.gene})</span>
                      </span>
                      <Badge className={st.cls}>{st.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground font-mono">
                      <span>{p.rsId}</span>
                      {p.genotype && <span>· {p.genotype}</span>}
                      {p.zygosity && <span>· {p.zygosity === 'HOMOZYGOUS' ? 'omozigote' : 'eterozigote'}</span>}
                    </div>
                    {p.interpretation && <p className="text-xs text-muted-foreground">{p.interpretation}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pannello tratti noti — verdetto esplicito anche per i genotipi standard (0/0) */}
      {corePanel.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Pannello tratti noti</h2>
              <p className="text-xs text-muted-foreground">
                Verdetto esplicito su SNP selezionati — incluso quando hai il genotipo di riferimento
                (standard), che altrimenti non comparirebbe nell'elenco sottostante.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {corePanel.map((p: any) => {
                const st = PANEL_STATE[p.state] ?? PANEL_STATE.NOT_COVERED;
                return (
                  <div key={p.rsId} className="p-3 rounded-lg bg-secondary/50 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">
                        {p.trait} <span className="text-muted-foreground font-normal">({p.gene})</span>
                      </span>
                      <Badge className={st.cls}>{st.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground font-mono">
                      <span>{p.rsId}</span>
                      {p.genotype && <span>· {p.genotype}</span>}
                      {p.zygosity && <span>· {p.zygosity === 'HOMOZYGOUS' ? 'omozigote' : 'eterozigote'}</span>}
                      {p.confidence === 'LOW' && <span className="text-amber-600 dark:text-amber-400">· bassa confidenza</span>}
                    </div>
                    {p.interpretation && <p className="text-xs text-muted-foreground">{p.interpretation}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spiegazione */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            I <strong>tratti fenotipici</strong> sono caratteristiche osservabili influenzate dalle tue varianti genetiche.
            Comprendono aspetti metabolici (come processi nutrienti e farmaci), fisici (prestazione sportiva, struttura corporea)
            e cognitivi (funzioni cerebrali e neurotrasmettitori).
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Categorie:</strong></p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li><strong>Metabolismo</strong> &mdash; metabolismo di caffeina, lattosio, alcol, farmaci, vitamine.</li>
              <li><strong>Fisico & Fitness</strong> &mdash; tipo fibre muscolari, capacita' aerobica, risposta pressoria, recupero, nutrigenomica.</li>
              <li><strong>Cognitivo</strong> &mdash; recettori dopamina/serotonina, predisposizioni cognitive, risposta allo stress.</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            I tratti sono influenzati sia dalla genetica che dall'ambiente.{' '}
            <a href="https://www.ebi.ac.uk/gwas/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GWAS Catalog</a>{' | '}
            <a href="https://www.snpedia.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SNPedia</a>{' | '}
            <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4721396/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Genetica e sport (PMC)</a>
          </p>
        </CardContent>
      </Card>

      {/* Contatori globali */}
      {counts && counts.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-2xl font-bold">{counts.total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Tratti totali</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-2xl font-bold">{counts.metabolism.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Metabolismo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-2xl font-bold">{counts.physical.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Fisico & Fitness</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-2xl font-bold">{counts.cognitive.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Cognitivo</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab filtro */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setCategoryFilter(tab.key); setPage(0); }}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              categoryFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {counts && (
              <span className="ml-1.5 text-xs opacity-70">
                {tab.key === '' ? counts.total : counts[tab.key.toLowerCase() as keyof typeof counts] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista tratti */}
      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun tratto trovato per questa categoria.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((d: any) => {
              const meta = typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata;
              const cfg = CATEGORY_CONFIG[d.category];

              return (
                <Card key={d.id} className="border">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm leading-tight">{d.trait}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cfg && <Badge variant="secondary" className={cfg.color}>{cfg.label}</Badge>}
                        <span className="text-xs text-muted-foreground">{d.source}</span>
                      </div>
                    </div>
                    {d.effect && <p className="text-sm text-foreground/80">{d.effect}</p>}
                    {meta?.description && <p className="text-sm text-muted-foreground">{meta.description}</p>}
                    {meta?.links && Object.keys(meta.links).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(meta.links).map(([label, url]) => (
                          <a key={label} href={url as string} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            {label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    <VariantLink variantId={d.variantId} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Paginazione */}
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
