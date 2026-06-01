import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/pharmacogenomics')({ component: PharmacogenomicsPage });

const PANEL_QUERY = `query($vcfFileId: String!) { pharmacoPanel(vcfFileId: $vcfFileId) { gene diplotype phenotype drugs confidence } }`;

function getMetabolizerInfo(status?: string) {
  if (!status) return { className: 'bg-muted text-muted-foreground', label: '—' };
  const lower = status.toLowerCase();
  const red = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  const amber = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  const blue = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  const green = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  // "normale" prima di tutto: evita che "richiesta ridotta" su un normale sviii il colore
  if (lower.includes('normal') || lower.includes('extensive')) return { className: green, label: status };
  if (lower.includes('poor') || lower.includes('slow') || lower.includes('lento') || lower.includes('carente') || lower.includes('alta sensibilit')) return { className: red, label: status };
  if (lower.includes('ultra') || lower.includes('rapid')) return { className: amber, label: status };
  if (lower.includes('ridott') || lower.includes('portatrice')) return { className: amber, label: status };
  if (lower.includes('intermedi') || lower.includes('non-espressore') || lower.includes('non espressore')) return { className: blue, label: status };
  return { className: 'bg-secondary text-secondary-foreground', label: status };
}

function PharmacogenomicsPage() {
  const { activeFile } = useActiveVcf();

  const { data: panelData } = useQuery({
    queryKey: ['pharmacoPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(PANEL_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const panel = panelData?.pharmacoPanel ?? [];

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
              Diplotipo e fenotipo metabolizzatore per gene (modello CPIC), che tiene conto
              della direzione dell'allele — il risultato autorevole e azionabile.
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
    </div>
    </AiSummaryProvider>
  );
}
