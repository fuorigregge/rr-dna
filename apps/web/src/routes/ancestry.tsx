import { Fragment, useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MetadataRow } from '@/components/metadata-row';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { VariantLink } from '@/components/variant-link';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/ancestry')({ component: AncestryPage });

// Ranking best-fit calcolato lato server su TUTTI i marcatori (verosimiglianza).
const AFFINITY_QUERY = `query($vcfFileId: String!) { ancestryAffinity(vcfFileId: $vcfFileId) { population meanLogLik relativeScore markerCount } }`;
// Tabella di dettaglio (esplorazione marcatori — non usata per l'inferenza).
const MARKERS_QUERY = `query($vcfFileId: String!, $pagination: PaginationInput) { ancestryMarkers(vcfFileId: $vcfFileId, pagination: $pagination) { items { id variantId population frequency metadata } total hasMore } }`;
// Aplogruppi diretti (mtDNA materno, Y paterno) calcolati con HaploGrep/yhaplo.
const HAPLOGROUPS_QUERY = `query($vcfFileId: String!) { haplogroups(vcfFileId: $vcfFileId) { lineage haplogroup detail quality source interpretation } }`;

const POP_COLORS: Record<string, string> = {
  'European': 'hsl(220, 70%, 55%)',
  'European (non-Finnish)': 'hsl(220, 70%, 55%)',
  'African': 'hsl(30, 80%, 55%)',
  'East Asian': 'hsl(0, 70%, 55%)',
  'South Asian': 'hsl(280, 60%, 55%)',
  'Mediterranean': 'hsl(170, 60%, 45%)',
  'Ashkenazi Jewish': 'hsl(45, 70%, 50%)',
  'Finnish': 'hsl(195, 65%, 50%)',
  'Latino/Admixed American': 'hsl(15, 75%, 55%)',
  'Middle Eastern': 'hsl(340, 65%, 55%)',
};

function AncestryPage() {
  const { activeFile, isLoading: vcfLoading } = useActiveVcf();

  const { data: affinityData, isLoading: affinityLoading } = useQuery({
    queryKey: ['ancestryAffinity', activeFile?.id],
    queryFn: () => gqlClient.request<any>(AFFINITY_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
  });
  const { data: markersData, isLoading: markersLoading } = useQuery({
    queryKey: ['ancestryMarkers', activeFile?.id],
    // limit must stay <= PaginationInput @Max(500); this table is only a sample.
    queryFn: () => gqlClient.request<any>(MARKERS_QUERY, { vcfFileId: activeFile?.id, pagination: { offset: 0, limit: 500 } }),
    enabled: !!activeFile,
  });

  const { data: haploData } = useQuery({
    queryKey: ['haplogroups', activeFile?.id],
    queryFn: () => gqlClient.request<any>(HAPLOGROUPS_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const haplogroups = haploData?.haplogroups ?? [];

  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [activeFile?.id]);

  const loading = vcfLoading || affinityLoading || markersLoading;

  const affinity = affinityData?.ancestryAffinity ?? [];
  const topPop = affinity[0];
  const gap = affinity.length >= 2 ? affinity[0].meanLogLik - affinity[1].meanLogLik : null;
  const items = [...(markersData?.ancestryMarkers?.items ?? [])].sort((a: any, b: any) => (b.frequency ?? 0) - (a.frequency ?? 0));

  const PAGE_SIZE = 25;
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasMore = (page + 1) * PAGE_SIZE < items.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Ancestry</h1>
        <Card>
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
            <p className="text-sm">Caricamento dati ancestry…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (affinity.length === 0) {
    return (
      <AiSummaryProvider vcfFileId={activeFile?.id} type="ancestry" title="Analisi Ancestry">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Ancestry</h1>
          <AiSummaryButton />
        </div>
        <Card><CardContent className="pt-4 text-center text-muted-foreground">Nessun dato disponibile.</CardContent></Card>
      </div>
      </AiSummaryProvider>
    );
  }

  return (
    <AiSummaryProvider vcfFileId={activeFile?.id} type="ancestry" title="Analisi Ancestry">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ancestry</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      {/* Aplogruppi diretti (materno mtDNA + paterno Y) */}
      {haplogroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aplogruppi</CardTitle>
            <p className="text-xs text-muted-foreground">
              Le tue due linee dirette — materna (mtDNA) e paterna (cromosoma Y). Sono lignaggi
              singoli, distinti dall'ancestralità complessiva (il best-fit qui sotto).
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {haplogroups.map((h: any) => (
                <div key={h.lineage} className="p-3 rounded-lg bg-secondary">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {h.lineage === 'MT' ? 'Materna (mtDNA)' : 'Paterna (cromosoma Y)'}
                    </span>
                    {h.quality != null && <Badge variant="secondary">qualità {(h.quality * 100).toFixed(0)}%</Badge>}
                  </div>
                  <div className="font-mono text-lg">
                    {h.haplogroup}
                    {h.detail && <span className="text-sm text-muted-foreground"> · {h.detail}</span>}
                  </div>
                  {h.interpretation && <p className="text-xs text-muted-foreground mt-1">{h.interpretation}</p>}
                  {h.source && <p className="text-[10px] text-muted-foreground mt-1">via {h.source}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spiegazione */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Per ogni popolazione calcoliamo quanto bene le frequenze alleliche di quel gruppo
            (dati <a href="https://gnomad.broadinstitute.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">gnomAD</a>)
            spiegano il tuo genotipo, con un modello a verosimiglianza (Hardy-Weinberg) su tutti i tuoi marcatori.
            La popolazione con il punteggio piu' alto e' quella che meglio si adatta ai tuoi alleli.
          </p>
          <p className="text-xs text-muted-foreground">
            Nota: non e' un test di ancestralita' certificato ne' una stima di admixture (percentuali tipo 23andMe).
            E' un best-fit relativo basato sui soli siti dove porti un allele alternativo. Un'analisi accurata richiede panel
            dedicati con marcatori informativi (AIMs): <a href="https://pubmed.ncbi.nlm.nih.gov/15088268/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Shriver et al. 2003</a>.
          </p>
        </CardContent>
      </Card>

      {/* Ranking best-fit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best-fit per Popolazione</CardTitle>
          <p className="text-xs text-muted-foreground">
            Punteggio relativo di adattamento (il migliore = 100%), su {topPop?.markerCount?.toLocaleString('it-IT')} marcatori.
            {topPop && <> Miglior adattamento: <Badge variant="secondary" className="ml-1">{topPop.population}</Badge></>}
            {gap != null && <> &middot; distacco dal 2&deg;: <span className="font-mono">{gap.toFixed(4)}</span> log-verosimiglianza/marcatore</>}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={affinity} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 100 }}>
              <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: 'hsl(0, 0%, 60%)' }} />
              <YAxis type="category" dataKey="population" tick={{ fontSize: 12, fill: 'hsl(0, 0%, 75%)' }} width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(0, 0%, 10%)', border: '1px solid hsl(0, 0%, 20%)', borderRadius: 8, fontSize: 12 }}
                formatter={(value: any, _name: any, props: any) => [
                  `${(Number(value) * 100).toFixed(1)}% (${props.payload.markerCount.toLocaleString('it-IT')} marcatori)`,
                  'Fit relativo',
                ]}
              />
              <Bar dataKey="relativeScore" radius={[0, 4, 4, 0]}>
                {affinity.map((entry: any) => (
                  <Cell key={entry.population} fill={POP_COLORS[entry.population] || 'hsl(220, 50%, 50%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Riepilogo per popolazione */}
      <Card>
        <CardHeader><CardTitle className="text-base">Riepilogo per Popolazione</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {affinity.map((pop: any) => (
              <div key={pop.population} className="p-3 rounded-lg bg-secondary">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{pop.population}</span>
                  <Badge variant="secondary">{(pop.relativeScore * 100).toFixed(1)}%</Badge>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pop.relativeScore * 100}%`, backgroundColor: POP_COLORS[pop.population] || 'hsl(220, 50%, 50%)' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{pop.markerCount.toLocaleString('it-IT')} marcatori</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabella dettagliata (esplorazione marcatori) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dettaglio Marcatori ({items.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Campione di marcatori e frequenza del tuo allele in una popolazione. Solo esplorazione: il best-fit qui sopra usa tutti i marcatori, non questo elenco.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Popolazione</TableHead>
                <TableHead className="text-right">Frequenza</TableHead>
                <TableHead className="text-right">Barra</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((d: any) => (
                <Fragment key={d.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: POP_COLORS[d.population] || 'hsl(220, 50%, 50%)' }} />
                    {d.population || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{d.frequency != null ? `${(d.frequency * 100).toFixed(1)}%` : '—'}</TableCell>
                  <TableCell className="text-right w-40">
                    <div className="w-full bg-background rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${(d.frequency ?? 0) * 100}%`, backgroundColor: POP_COLORS[d.population] || 'hsl(220, 50%, 50%)' }} />
                    </div>
                  </TableCell>
                  <TableCell><VariantLink variantId={d.variantId} /></TableCell>
                </TableRow>
                <MetadataRow id={d.id} metadata={d.metadata} colSpan={4} />
                </Fragment>
              ))}
            </TableBody>
          </Table>

          {/* Paginazione */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3">
            <p className="text-xs text-muted-foreground">
              {items.length > 0 ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, items.length)} di ${items.length}` : 'Nessun risultato'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Precedente</Button>
              <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Successiva</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </AiSummaryProvider>
  );
}
