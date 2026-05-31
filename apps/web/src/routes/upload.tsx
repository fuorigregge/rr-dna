import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithToast } from '@/lib/use-mutation-with-toast';
import { gqlClient, VCF_FILES_QUERY, VCF_PROGRESS_QUERY } from '@/lib/graphql-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/upload')({
  component: UploadPage,
});

function UploadPage() {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [ancestryMode, setAncestryMode] = useState<string>('none');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vcfFilesQuery = useQuery({
    queryKey: ['vcfFiles'],
    queryFn: () => gqlClient.request<any>(VCF_FILES_QUERY),
    refetchInterval: 5000,
  });

  const progressQuery = useQuery({
    queryKey: ['vcfProgress', activeFileId],
    queryFn: () => gqlClient.request<any>(VCF_PROGRESS_QUERY, { id: activeFileId }),
    enabled: !!activeFileId,
    refetchInterval: 2000,
  });

  const uploadMutation = useMutationWithToast({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ancestryMode', ancestryMode);
      const res = await fetch('/api/vcf/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    toast: {
      loading: 'Upload in corso...',
      success: 'File VCF caricato con successo',
      error: 'Errore durante l\'upload del file',
    },
    onSuccess: (data: any) => {
      setActiveFileId(data.id);
      vcfFilesQuery.refetch();
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.vcf') || file.name.endsWith('.vcf.gz'))) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation, ancestryMode]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }, [uploadMutation, ancestryMode]);

  const progress = progressQuery.data?.vcfFileProgress;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Upload VCF</h1>
      <Card>
        <CardContent className="pt-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-lg p-6 sm:p-12 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <p className="text-lg mb-2">Trascina il file VCF qui</p>
            <p className="text-sm text-muted-foreground mb-4">oppure</p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Seleziona file</Button>
            <input ref={fileInputRef} type="file" accept=".vcf,.vcf.gz" onChange={handleFileSelect} className="hidden" />
          </div>

          <div className="mt-4 p-4 rounded-lg bg-secondary">
            <label className="block text-sm font-medium mb-2">Analisi ancestry</label>
            <select
              value={ancestryMode}
              onChange={(e) => setAncestryMode(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="none">Nessuna analisi ancestry aggiuntiva</option>
              <option value="gnomad">Ancestry avanzata — gnomAD (8 popolazioni)</option>
            </select>
            {ancestryMode === 'gnomad' && (
              <p className="text-xs text-muted-foreground mt-2">
                Al primo utilizzo verra' scaricato il database gnomAD (~20 GB download, ~30-60 min).
                Le volte successive sara' istantaneo (~30-60 MB cache locale).
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {activeFileId && progress && (
        <Card>
          <CardHeader><CardTitle className="text-base">Processing</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {progress.error ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 space-y-2">
                <p className="text-sm font-medium text-destructive">Validazione fallita</p>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{progress.error}</pre>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>{progress.step}</span>
                  <span>{Math.round(progress.percentage)}%</span>
                </div>
                <Progress value={progress.percentage} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {vcfFilesQuery.data?.vcfFiles?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">File caricati</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vcfFilesQuery.data.vcfFiles.map((f: any) => (
                <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-secondary">
                  <div>
                    <p className="font-medium text-sm">{f.filename}</p>
                    <p className="text-xs text-muted-foreground">{f.totalVariants.toLocaleString()} varianti</p>
                  </div>
                  <Badge variant={f.status === 'COMPLETED' ? 'default' : f.status === 'FAILED' ? 'destructive' : 'secondary'}>{f.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
