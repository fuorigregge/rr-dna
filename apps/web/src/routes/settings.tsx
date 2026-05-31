import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gqlClient, VCF_FILES_QUERY } from '@/lib/graphql-client';
import { useMutationWithToast } from '@/lib/use-mutation-with-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute('/settings')({ component: SettingsPage });

const DELETE_MUTATION = `mutation($id: ID!) { deleteVcfFile(id: $id) }`;

const STATUS_STYLES: Record<string, { variant: any; label: string }> = {
  COMPLETED: { variant: 'default', label: 'Completato' },
  PROCESSING: { variant: 'secondary', label: 'In elaborazione' },
  FAILED: { variant: 'destructive', label: 'Errore' },
};

function SettingsPage() {
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vcfFiles'],
    queryFn: () => gqlClient.request<any>(VCF_FILES_QUERY),
  });

  const deleteMutation = useMutationWithToast({
    mutationFn: (id: string) => gqlClient.request<any>(DELETE_MUTATION, { id }),
    toast: {
      loading: 'Eliminazione in corso...',
      success: 'File VCF e tutti i dati associati eliminati',
      error: "Errore durante l'eliminazione",
    },
    onSuccess: () => {
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ['vcfFiles'] });
    },
  });

  const files = data?.vcfFiles ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestisci i tuoi file VCF e i dati genomici associati.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">File VCF Caricati</CardTitle>
          <p className="text-xs text-muted-foreground">
            Eliminare un file rimuove permanentemente tutte le varianti, annotazioni, rischi malattie,
            dati farmacogenomici, carrier status, marcatori ancestry e tratti fenotipici associati.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
          {!isLoading && files.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nessun file VCF caricato.
            </p>
          )}
          <div className="space-y-3">
            {files.map((f: any) => {
              const status = STATUS_STYLES[f.status] || STATUS_STYLES.PROCESSING;
              const isConfirming = confirmId === f.id;

              return (
                <div
                  key={f.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-secondary border border-border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{f.filename}</span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{f.totalVariants?.toLocaleString() ?? 0} varianti</span>
                      <span>{f.snpCount?.toLocaleString() ?? 0} SNP</span>
                      <span>{f.indelCount?.toLocaleString() ?? 0} indel</span>
                      <span>{new Date(f.uploadDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isConfirming ? (
                      <>
                        <span className="text-xs text-destructive sm:mr-2">Confermi l'eliminazione?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(f.id)}
                        >
                          {deleteMutation.isPending ? 'Eliminando...' : 'Elimina'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmId(null)}
                        >
                          Annulla
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                        onClick={() => setConfirmId(f.id)}
                      >
                        Elimina
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informazioni</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Database annotazioni:</span>
              <span className="ml-2">ClinVar + curato manualmente</span>
            </div>
            <div>
              <span className="text-muted-foreground">Assemblaggio genoma:</span>
              <span className="ml-2">GRCh38 (hg38)</span>
            </div>
            <div>
              <span className="text-muted-foreground">Fonti dati:</span>
              <span className="ml-2">ClinVar, PharmGKB, gnomAD, OMIM</span>
            </div>
            <div>
              <span className="text-muted-foreground">Versione:</span>
              <span className="ml-2">0.1.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
