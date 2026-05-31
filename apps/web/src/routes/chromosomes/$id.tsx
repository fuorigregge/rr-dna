import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const Route = createFileRoute('/chromosomes/$id')({ component: ChromosomeDetailPage });
const VARIANTS_QUERY = `query($filter: VariantFilterInput, $pagination: PaginationInput) { variants(filter: $filter, pagination: $pagination) { items { id position rsId ref alt genotype } total hasMore } }`;

function ChromosomeDetailPage() {
  const { id: chromosome } = Route.useParams();
  const { activeFile } = useActiveVcf();
  const { data } = useQuery({
    queryKey: ['chromosomeVariants', chromosome, activeFile?.id],
    queryFn: () => gqlClient.request<any>(VARIANTS_QUERY, { filter: { chromosome: `chr${chromosome}`, vcfFileId: activeFile?.id }, pagination: { offset: 0, limit: 100 } }),
    enabled: !!activeFile,
  });
  const items = data?.variants?.items ?? [];
  const total = data?.variants?.total ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cromosoma {chromosome}</h1>
      <p className="text-muted-foreground">{total.toLocaleString()} varianti</p>
      <Card><CardContent className="pt-4">
        <div className="overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead>Posizione</TableHead><TableHead>rsID</TableHead><TableHead>Ref</TableHead><TableHead>Alt</TableHead><TableHead>Genotipo</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((v: any) => (<TableRow key={v.id}><TableCell>{v.position.toLocaleString()}</TableCell><TableCell>{v.rsId ? <Link to="/variants/$id" params={{ id: v.id }} className="text-primary underline">{v.rsId}</Link> : '\u2014'}</TableCell><TableCell className="font-mono text-xs">{v.ref}</TableCell><TableCell className="font-mono text-xs">{v.alt}</TableCell><TableCell className="font-mono text-xs">{v.genotype || '\u2014'}</TableCell></TableRow>))}
        </TableBody></Table>
        </div>
      </CardContent></Card>
    </div>
  );
}
