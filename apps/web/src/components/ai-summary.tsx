import { createContext, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutationWithToast } from '@/lib/use-mutation-with-toast';
import { gqlClient } from '@/lib/graphql-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Markdown } from '@/components/markdown';

const AI_SUMMARY_QUERY = `query($vcfFileId: String!, $type: String!) { aiSummary(vcfFileId: $vcfFileId, type: $type) { id summary detail createdAt } }`;
const AI_GENERATE = `mutation($vcfFileId: String!, $type: String!) { generateAiSummary(vcfFileId: $vcfFileId, type: $type) { id summary detail } }`;

interface AiContextValue {
  aiSummary: any;
  isPending: boolean;
  showConfirm: () => void;
}

const AiContext = createContext<AiContextValue | null>(null);

interface AiSummaryProviderProps {
  vcfFileId: string | undefined;
  type: string;
  title?: string;
  confirmMessage?: string;
  children: React.ReactNode;
}

export function AiSummaryProvider({ vcfFileId, type, title = 'Analisi AI', confirmMessage, children }: AiSummaryProviderProps) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const aiQuery = useQuery({
    queryKey: ['aiSummary', vcfFileId, type],
    queryFn: () => gqlClient.request<any>(AI_SUMMARY_QUERY, { vcfFileId, type }),
    enabled: !!vcfFileId,
  });
  const aiSummary = aiQuery.data?.aiSummary;

  const aiGenerate = useMutationWithToast({
    mutationFn: () => gqlClient.request<any>(AI_GENERATE, { vcfFileId, type }),
    toast: { loading: 'Generazione riassunto AI...', success: 'Riassunto generato', error: 'Errore nella generazione AI' },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aiSummary', vcfFileId, type] }); setConfirmOpen(false); },
  });

  return (
    <AiContext.Provider value={{ aiSummary, isPending: aiGenerate.isPending, showConfirm: () => setConfirmOpen(true) }}>
      {children}

      {/* Modale conferma */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmOpen(false)}>
          <Card className="max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-base">Generare riassunto AI?</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {confirmMessage || 'Claude analizzerà i dati e genererà un riassunto comprensibile.'}
                {aiSummary && ' Il riassunto precedente verrà sostituito.'}
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Annulla</Button>
                <Button size="sm" onClick={() => aiGenerate.mutate()} disabled={aiGenerate.isPending}>
                  {aiGenerate.isPending ? 'Generazione...' : 'Genera'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drawer dettaglio */}
      {drawerOpen && aiSummary?.detail && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full sm:w-1/2 bg-background sm:border-l border-border h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">AI</Badge>
                <h2 className="text-lg font-semibold">{title}</h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>Chiudi</Button>
            </div>
            <Markdown>{aiSummary.detail}</Markdown>
          </div>
        </div>
      )}
    </AiContext.Provider>
  );
}

export function AiSummaryButton() {
  const ctx = useContext(AiContext);
  if (!ctx) return null;
  return (
    <Button variant="outline" size="sm" onClick={ctx.showConfirm} disabled={ctx.isPending}>
      {ctx.isPending ? 'Generazione...' : 'Riassunto AI'}
    </Button>
  );
}

export function AiSummaryCard() {
  const ctx = useContext(AiContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!ctx?.aiSummary) return null;

  return (
    <>
      <Card className="border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setDrawerOpen(true)}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-[10px] shrink-0">AI</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(ctx.aiSummary.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-sm"><Markdown>{ctx.aiSummary.summary}</Markdown></div>
            </div>
            <span className="text-muted-foreground text-xs shrink-0 mt-1">Dettaglio →</span>
          </div>
        </CardContent>
      </Card>

      {/* Drawer inline per questa card */}
      {drawerOpen && ctx.aiSummary.detail && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full sm:w-1/2 bg-background sm:border-l border-border h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">AI</Badge>
                <h2 className="text-lg font-semibold">Analisi AI</h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>Chiudi</Button>
            </div>
            <Markdown>{ctx.aiSummary.detail}</Markdown>
          </div>
        </div>
      )}
    </>
  );
}

// Backward-compatible single component (wraps all three)
interface AiSummarySectionProps {
  vcfFileId: string | undefined;
  type: string;
  title?: string;
  confirmMessage?: string;
}

export function AiSummarySection({ vcfFileId, type, title, confirmMessage }: AiSummarySectionProps) {
  return (
    <AiSummaryProvider vcfFileId={vcfFileId} type={type} title={title} confirmMessage={confirmMessage}>
      <AiSummaryButton />
    </AiSummaryProvider>
  );
}
