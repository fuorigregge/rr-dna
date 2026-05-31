import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/variants/')({ component: VariantsPage });
const QUERY = `query Variants($filter: VariantFilterInput, $pagination: PaginationInput) { variants(filter: $filter, pagination: $pagination) { items { id chromosome position rsId ref alt genotype zygosity notes } total hasMore } }`;

function VariantsPage() {
  const { activeFile } = useActiveVcf();
  const [search, setSearch] = useState('');
  const [chromosome, setChromosome] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const filter: any = {};
  if (activeFile) filter.vcfFileId = activeFile.id;
  if (search) filter.rsId = search;
  if (chromosome) filter.chromosome = chromosome;

  const { data } = useQuery({ queryKey: ['variants', filter, offset], queryFn: () => gqlClient.request<any>(QUERY, { filter, pagination: { offset, limit } }), enabled: !!activeFile });
  const items = data?.variants?.items ?? [];
  const total = data?.variants?.total ?? 0;
  const hasMore = data?.variants?.hasMore ?? false;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Explorer Varianti</h1>
      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Cerca per rsID..." value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} className="w-full sm:max-w-xs" />
        <Input placeholder="Cromosoma..." value={chromosome} onChange={(e) => { setChromosome(e.target.value); setOffset(0); }} className="w-full sm:max-w-xs" />
      </div>
      <Card><CardContent className="pt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Chr</TableHead><TableHead>Posizione</TableHead><TableHead>rsID</TableHead><TableHead>Ref</TableHead><TableHead>Alt</TableHead><TableHead>Genotipo</TableHead><TableHead>Zigosità</TableHead><TableHead title="Presenza di note personali">Note</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v: any) => (<TableRow key={v.id}><TableCell>{v.chromosome}</TableCell><TableCell>{v.position.toLocaleString()}</TableCell><TableCell>{v.rsId ? <Link to="/variants/$id" params={{ id: v.id }} className="text-primary underline">{v.rsId}</Link> : <Link to="/variants/$id" params={{ id: v.id }} className="text-primary underline text-xs">apri</Link>}</TableCell><TableCell className="font-mono text-xs">{v.ref}</TableCell><TableCell className="font-mono text-xs">{v.alt}</TableCell><TableCell className="font-mono text-xs">{v.genotype || '\u2014'}</TableCell><TableCell><Badge variant="secondary">{v.zygosity || '\u2014'}</Badge></TableCell><TableCell>{v.notes ? <span title={v.notes} className="text-amber-500">\ud83d\udcdd</span> : <span className="text-muted-foreground/40">\u2014</span>}</TableCell></TableRow>))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-4 text-sm">
          <span className="text-muted-foreground">{total.toLocaleString()} varianti totali</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Precedente</Button>
            <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setOffset(offset + limit)}>Successivo</Button>
          </div>
        </div>
      </CardContent></Card>
    </div>
  );
}
