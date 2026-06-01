import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/traits')({ component: TraitsPage });

const PANEL_QUERY = `query($vcfFileId: String!) { traitPanel(vcfFileId: $vcfFileId) { rsId gene trait category state genotype zygosity interpretation confidence } }`;

const PANEL_STATE: Record<string, { label: string; cls: string }> = {
  CARRIED: { label: 'Variante portata', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  REFERENCE: { label: 'Standard (riferimento)', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  NOT_COVERED: { label: 'Non valutabile', cls: 'bg-secondary text-muted-foreground' },
};

function TraitsPage() {
  const { activeFile } = useActiveVcf();

  const { data: panelData } = useQuery({
    queryKey: ['traitPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(PANEL_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const panel = panelData?.traitPanel ?? [];
  const appearance = panel.filter((p: any) => p.category === 'APPEARANCE');
  const corePanel = panel.filter((p: any) => p.category !== 'APPEARANCE');

  return (
    <AiSummaryProvider vcfFileId={activeFile?.id} type="traits" title="Analisi Tratti Fenotipici">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tratti & Fitness</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      {/* Pannello tratti noti — verdetto esplicito anche per i genotipi standard (0/0) */}
      {corePanel.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Pannello tratti noti</h2>
              <p className="text-xs text-muted-foreground">
                Verdetto esplicito su SNP selezionati — incluso quando hai il genotipo di riferimento (standard).
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

      {/* Spiegazione */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            I <strong>tratti fenotipici</strong> sono caratteristiche osservabili influenzate dalle tue varianti genetiche.
            Comprendono aspetti metabolici (come processi nutrienti e farmaci), fisici (prestazione sportiva, struttura corporea)
            e cognitivi (funzioni cerebrali e neurotrasmettitori).
          </p>
          <p className="text-xs text-muted-foreground">
            I tratti sono influenzati sia dalla genetica che dall'ambiente.{' '}
            <a href="https://www.ebi.ac.uk/gwas/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GWAS Catalog</a>{' | '}
            <a href="https://www.snpedia.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SNPedia</a>{' | '}
            <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4721396/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Genetica e sport (PMC)</a>
          </p>
        </CardContent>
      </Card>
    </div>
    </AiSummaryProvider>
  );
}
