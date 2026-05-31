import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/carrier')({ component: CarrierPage });
const PANEL_QUERY = `query($vcfFileId: String!) {
  carrierPanel(vcfFileId: $vcfFileId) { id rsId gene variantName condition inheritance state genotype zygosity interpretation confidence }
}`;
const DERIVED_QUERY = `query($vcfFileId: String!) {
  derivedCarriers(vcfFileId: $vcfFileId) { id gene condition rsId genotype zygosity inheritance state stars note }
}`;

function DerivedCarriersCard({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Portatore di malattie recessive (da ClinVar)</CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Varianti patogeniche eterozigoti in geni a ereditariet&agrave; recessiva, non incluse nel pannello di
          screening curato sopra. Sei <strong>portatore sano</strong> (non malato): rilevanza riproduttiva.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-300/40">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <span className="font-medium text-sm">
                <span className="font-mono text-xs text-muted-foreground mr-1">{r.gene}</span>
                {r.condition}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {r.state === 'AFFECTED' ? 'Due copie' : 'Portatore'} · {r.inheritance}
                {r.stars != null ? ` · ${r.stars}★` : ''}{r.genotype ? ` · ${r.genotype}` : ''}
              </span>
            </div>
            {r.note && <p className="text-xs text-muted-foreground mt-1 leading-snug">{r.note}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const CARRIER_STATE: Record<string, { label: string; className: string }> = {
  CLEAR: { label: 'Non portatore', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300/50' },
  CARRIER: { label: 'Portatore', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-400/50' },
  AFFECTED: { label: 'Due copie / emizigote', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300/50' },
  NOT_COVERED: { label: 'Non valutabile', className: 'bg-muted text-muted-foreground border-border' },
};
const CARRIER_STATE_ORDER: Record<string, number> = { AFFECTED: 0, CARRIER: 1, CLEAR: 2, NOT_COVERED: 3 };

function CarrierPanelCard({ panel }: { panel: any[] }) {
  if (panel.length === 0) return null;
  const sorted = [...panel].sort(
    (a, b) => (CARRIER_STATE_ORDER[a.state] ?? 9) - (CARRIER_STATE_ORDER[b.state] ?? 9) || a.gene.localeCompare(b.gene),
  );
  const positives = sorted.filter((p) => p.state === 'CARRIER' || p.state === 'AFFECTED').length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pannello screening portatore</CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Verdetto certo su un set selezionato di varianti recessive/X-linked (fibrosi cistica, anemia falciforme,
          Gaucher, Wilson, PKU, favismo, sordità, FMF). Include i risultati <strong className="text-foreground">negativi rassicuranti</strong> (&quot;non portatore&quot;), normalmente invisibili.
          {positives === 0
            ? ' Non risulti portatore di nessuna di queste varianti.'
            : ` ${positives} esito/i positivo/i — vedi dettaglio.`}{' '}
          Ogni voce controlla <em>una</em> variante; un esito negativo non esclude altre varianti patogeniche nello stesso gene. Condizioni da numero di copie/triplette (SMA/SMN1, X-fragile/FMR1) non sono rilevabili da questo dato.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((c: any) => {
          const s = CARRIER_STATE[c.state] ?? CARRIER_STATE.NOT_COVERED;
          return (
            <div key={c.id} className="p-3 rounded-lg bg-secondary/40 border border-border/50 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {c.gene} <span className="font-mono text-xs text-muted-foreground">{c.variantName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {c.confidence === 'LOW' && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/50">bassa conf.</Badge>
                  )}
                  <Badge variant="outline" className={`text-[11px] ${s.className}`}>{s.label}</Badge>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.condition}
                {c.inheritance ? ` · ${c.inheritance}` : ''}
                {(c.state === 'CARRIER' || c.state === 'AFFECTED') && c.genotype ? ` · genotipo ${c.genotype}` : ''}
              </p>
              {c.interpretation && (
                <p className="text-xs text-muted-foreground/90 leading-relaxed">{c.interpretation}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}


function CarrierPage() {
  const { activeFile } = useActiveVcf();
  const { data: panelData } = useQuery({
    queryKey: ['carrierPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(PANEL_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const carrierPanel: any[] = panelData?.carrierPanel ?? [];

  const { data: derivedData } = useQuery({
    queryKey: ['derivedCarriers', activeFile?.id],
    queryFn: () => gqlClient.request<any>(DERIVED_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const derivedCarriers: any[] = derivedData?.derivedCarriers ?? [];

  // Riepilogo calcolato dai portatori puliti (curati + derivati BS1-filtrati),
  // non più dalla tabella legacy che includeva i falsi positivi comuni.
  const stats = useMemo(() => {
    const byPattern: Record<string, number> = {};
    for (const c of derivedCarriers) {
      const p = c.inheritance || 'Sconosciuto';
      byPattern[p] = (byPattern[p] || 0) + 1;
    }
    return { byPattern, total: derivedCarriers.length };
  }, [derivedCarriers]);

  return (
    <AiSummaryProvider vcfFileId={activeFile?.id} type="carrier" title="Analisi Carrier Status">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Carrier Status</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      <CarrierPanelCard panel={carrierPanel} />

      <DerivedCarriersCard rows={derivedCarriers} />

      {/* Spiegazione */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Essere <strong>portatore</strong> (carrier) significa possedere una copia di una mutazione recessiva senza generalmente manifestare la malattia.
            I portatori sono sani ma possono trasmettere la variante ai figli. Lo stato di portatore e' rilevante soprattutto in ambito riproduttivo.
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Pattern di ereditarieta':</strong></p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li><strong>Autosomico Recessivo</strong> &mdash; entrambi i genitori devono essere portatori; rischio del 25% per ogni figlio di essere affetto.</li>
              <li><strong>Autosomico Dominante</strong> &mdash; una sola copia mutata e' sufficiente; rischio del 50% di trasmissione per ogni figlio.</li>
              <li><strong>X-Linked</strong> &mdash; la mutazione si trova sul cromosoma X; colpisce principalmente i maschi, le femmine sono spesso portatrici.</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Per approfondire:{' '}
            <a href="https://omim.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OMIM</a>{' | '}
            <a href="https://www.nsgc.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">National Society of Genetic Counselors</a>.{' '}
            Questi risultati non sostituiscono una consulenza genetica professionale.
          </p>
        </CardContent>
      </Card>

      {/* Riepilogo (dai portatori puliti) */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card size="sm">
            <CardContent className="pt-3">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Condizioni portate</p>
            </CardContent>
          </Card>
          {Object.entries(stats.byPattern).map(([pattern, count]) => (
            <Card size="sm" key={pattern}>
              <CardContent className="pt-3">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{pattern}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </AiSummaryProvider>
  );
}
