import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient, DASHBOARD_STATS_QUERY, CHROMOSOME_SUMMARIES_QUERY, REPORT_HIGHLIGHTS_QUERY, PRS_RESULTS_QUERY } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { ChromosomeMap } from '@/components/dashboard/chromosome-map';
import { AreaCards } from '@/components/dashboard/area-cards';
import { HighlightsGrouped } from '@/components/dashboard/highlights';
import { PrsCard } from '@/components/dashboard/prs-card';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { activeFile } = useActiveVcf();

  const statsQuery = useQuery({
    queryKey: ['dashboardStats', activeFile?.id],
    queryFn: () => gqlClient.request<any>(DASHBOARD_STATS_QUERY, { vcfFileId: activeFile.id }),
    enabled: !!activeFile,
  });

  const chromQuery = useQuery({
    queryKey: ['chromosomeSummaries', activeFile?.id],
    queryFn: () => gqlClient.request<any>(CHROMOSOME_SUMMARIES_QUERY, { vcfFileId: activeFile.id }),
    enabled: !!activeFile,
  });

  const highlightsQuery = useQuery({
    queryKey: ['reportHighlights', activeFile?.id],
    queryFn: () => gqlClient.request<any>(REPORT_HIGHLIGHTS_QUERY, { vcfFileId: activeFile.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });

  const prsQuery = useQuery({
    queryKey: ['prsResults', activeFile?.id],
    queryFn: () => gqlClient.request<any>(PRS_RESULTS_QUERY, { vcfFileId: activeFile.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <span className="text-4xl">{'🧬'}</span>
        <h1 className="text-2xl font-bold">Benvenuto in rr-dna</h1>
        <p className="text-muted-foreground">Carica un file VCF per iniziare l'analisi del tuo genoma.</p>
        <Link to="/upload" className="text-primary underline">Vai all'upload</Link>
      </div>
    );
  }

  const stats = statsQuery.data?.dashboardStats;
  const chromosomes = chromQuery.data?.chromosomeSummaries ?? [];
  const highlights = highlightsQuery.data?.reportHighlights ?? [];
  const prsResults = prsQuery.data?.prsResults ?? [];

  if (!stats) return <div>Caricamento...</div>;

  return (
    <AiSummaryProvider vcfFileId={activeFile.id} type="overview" title="Sommario generale">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <AiSummaryButton />
            <Link to="/report" className={buttonVariants({ size: 'sm' })}>Referto</Link>
          </div>
        </div>

        <AiSummaryCard />

        <StatsCards
          totalVariants={stats.totalVariants}
          snpCount={stats.snpCount}
          indelCount={stats.indelCount}
          heterozygousCount={stats.heterozygousCount}
          homozygousCount={stats.homozygousCount}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">In evidenza</CardTitle>
            <p className="text-xs text-muted-foreground">Risultati salienti estratti dai pannelli e dalle annotazioni cliniche.</p>
          </CardHeader>
          <CardContent>
            <HighlightsGrouped items={highlights} />
          </CardContent>
        </Card>

        <PrsCard results={prsResults} />

        <ChromosomeMap data={chromosomes} />

        <AreaCards
          pathogenicCount={stats.pathogenicCount}
          pharmacogenomicCount={stats.pharmacogenomicCount}
          carrierCount={stats.carrierCount}
          ancestryCount={stats.ancestryCount}
          traitCount={stats.traitCount}
          fitnessCount={stats.fitnessCount}
        />
      </div>
    </AiSummaryProvider>
  );
}
