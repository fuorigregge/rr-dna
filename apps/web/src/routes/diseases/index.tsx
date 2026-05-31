import { Fragment, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { VariantLink } from '@/components/variant-link';
import { ClinvarStars } from '@/components/clinvar-stars';
import { GnomadAf } from '@/components/gnomad-af';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/diseases/')({ component: DiseasesPage });

const QUERY = `query DiseaseRisks($vcfFileId: String!, $significance: String, $pagination: PaginationInput) {
  diseaseRisks(vcfFileId: $vcfFileId, significance: $significance, pagination: $pagination) { items { id variantId disease significance source evidenceLevel metadata variant { lowConfidence vaf gene rsId genotype zygosity } } total hasMore }
}`;

const ZYG_LABEL: Record<string, string> = { HETEROZYGOUS: 'Eterozigote', HOMOZYGOUS: 'Omozigote' };
const ZYG_CLASS: Record<string, string> = {
  HETEROZYGOUS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-400/40',
  HOMOZYGOUS: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-400/40',
};

const COUNTS_QUERY = `query DiseaseRiskCounts($vcfFileId: String!) {
  diseaseRiskCounts(vcfFileId: $vcfFileId) { total pathogenic likelyPathogenic uncertain likelyBenign benign }
}`;

const ACMG_QUERY = `query AcmgPanel($vcfFileId: String!) {
  acmgPanel(vcfFileId: $vcfFileId) { id rsId gene variantName condition inheritance state genotype zygosity interpretation confidence }
}`;

const ACMG_STATE: Record<string, { label: string; className: string }> = {
  CARRIED: { label: 'Variante presente', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300/50' },
  NOT_CARRIED: { label: 'Non presente', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300/50' },
  NOT_COVERED: { label: 'Non valutabile', className: 'bg-muted text-muted-foreground border-border' },
};
const ACMG_STATE_ORDER: Record<string, number> = { CARRIED: 0, NOT_CARRIED: 1, NOT_COVERED: 2 };

const sigColor: Record<string, string> = { PATHOGENIC: 'destructive', LIKELY_PATHOGENIC: 'destructive', UNCERTAIN: 'secondary', LIKELY_BENIGN: 'default', BENIGN: 'default' };

const SIG_CHART_COLORS: Record<string, string> = {
  PATHOGENIC: 'hsl(0, 72%, 51%)',
  LIKELY_PATHOGENIC: 'hsl(25, 95%, 53%)',
  UNCERTAIN: 'hsl(45, 93%, 47%)',
  LIKELY_BENIGN: 'hsl(142, 71%, 45%)',
  BENIGN: 'hsl(142, 76%, 36%)',
};

const SIG_LABELS: Record<string, string> = {
  PATHOGENIC: 'Patogenico',
  LIKELY_PATHOGENIC: 'Probabilmente patogenico',
  UNCERTAIN: 'Significato incerto',
  LIKELY_BENIGN: 'Probabilmente benigno',
  BENIGN: 'Benigno',
};

const SIG_ORDER = ['PATHOGENIC', 'LIKELY_PATHOGENIC', 'UNCERTAIN', 'LIKELY_BENIGN', 'BENIGN'];


interface DiseaseMetadata {
  description?: string;
  gene?: string;
  rsId?: string;
  prevalence?: string;
  links?: Record<string, string>;
  stars?: number;
  gnomad_af_grpmax?: number | null;
  gnomad_af_nfe?: number | null;
  gnomad_grpmax_group?: string | null;
  bs1_level?: string | null;
}

function MetadataDetail({ metadata }: { metadata: DiseaseMetadata }) {
  const links = metadata.links ? Object.entries(metadata.links) : [];

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={8} className="pt-0 pb-4 pl-8 whitespace-normal">
        <div className="space-y-2">
          {metadata.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {metadata.description}
            </p>
          )}
          {metadata.prevalence && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Prevalenza:</span>{' '}
              {metadata.prevalence}
            </p>
          )}
          {links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {links.map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge variant="outline" className="cursor-pointer gap-1">
                    {label}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </Badge>
                </a>
              ))}
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

const PAGE_SIZE = 25;

function DiseasesPage() {
  const { activeFile } = useActiveVcf();
  const [page, setPage] = useState(0);
  const [sigFilter, setSigFilter] = useState<string>('');
  const { data } = useQuery({
    queryKey: ['diseaseRisks', activeFile?.id, page, sigFilter],
    queryFn: () =>
      gqlClient.request<any>(QUERY, {
        vcfFileId: activeFile?.id,
        significance: sigFilter || undefined,
        pagination: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
      }),
    enabled: !!activeFile,
  });
  const items = data?.diseaseRisks?.items ?? [];
  const total = data?.diseaseRisks?.total ?? 0;
  const hasMore = data?.diseaseRisks?.hasMore ?? false;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: countsData } = useQuery({
    queryKey: ['diseaseRiskCounts', activeFile?.id],
    queryFn: () => gqlClient.request<any>(COUNTS_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const counts = countsData?.diseaseRiskCounts;

  const { data: acmgData } = useQuery({
    queryKey: ['acmgPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(ACMG_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile,
    staleTime: 30_000,
  });
  const acmgPanel: any[] = useMemo(() => {
    const rows = acmgData?.acmgPanel ?? [];
    return [...rows].sort(
      (a, b) =>
        (ACMG_STATE_ORDER[a.state] ?? 9) - (ACMG_STATE_ORDER[b.state] ?? 9) ||
        a.gene.localeCompare(b.gene),
    );
  }, [acmgData]);
  const acmgCarried = acmgPanel.filter((a) => a.state === 'CARRIED').length;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sigCounts: Record<string, number> = useMemo(() => {
    if (!counts) return Object.fromEntries(SIG_ORDER.map(s => [s, 0]));
    return {
      PATHOGENIC: counts.pathogenic,
      LIKELY_PATHOGENIC: counts.likelyPathogenic,
      UNCERTAIN: counts.uncertain,
      LIKELY_BENIGN: counts.likelyBenign,
      BENIGN: counts.benign,
    };
  }, [counts]);

  const chartData = useMemo(
    () =>
      SIG_ORDER.filter((sig) => sigCounts[sig] > 0).map((sig) => ({
        significance: SIG_LABELS[sig] ?? sig,
        count: sigCounts[sig],
        key: sig,
      })),
    [sigCounts],
  );

  return (
    <AiSummaryProvider vcfFileId={activeFile?.id} type="diseases" title="Analisi Rischio Malattie">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rischio Malattie</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      {/* Pannello varianti azionabili — verdetto certo per variante, inclusi i negativi rassicuranti */}
      {acmgPanel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pannello varianti azionabili</CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Verdetto certo su un set selezionato di varianti ad alto impatto clinico
              (tumori ereditari ACMG, ipercolesterolemia familiare, amiloidosi, trombofilia ereditaria, varianti mitocondriali patogeniche). Include i risultati
              <strong className="text-foreground"> negativi rassicuranti</strong> (&quot;non presente&quot;), normalmente invisibili.
              {acmgCarried === 0
                ? ' Nessuna di queste varianti risulta presente nel tuo genoma.'
                : ` ${acmgCarried} variante/i risulta/no presente/i — vedi dettaglio.`}{' '}
              Attenzione: ogni voce controlla <em>una</em> variante specifica; un esito negativo non esclude altre varianti patogeniche nello stesso gene.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {acmgPanel.map((a: any) => {
              const s = ACMG_STATE[a.state] ?? ACMG_STATE.NOT_COVERED;
              return (
                <div key={a.id} className="p-3 rounded-lg bg-secondary/40 border border-border/50 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {a.gene} <span className="font-mono text-xs text-muted-foreground">{a.variantName}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {a.confidence === 'LOW' && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/50">bassa conf.</Badge>
                      )}
                      <Badge variant="outline" className={`text-[11px] ${s.className}`}>{s.label}</Badge>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.condition}
                    {a.inheritance ? ` · ${a.inheritance}` : ''}
                    {a.state === 'CARRIED' && a.genotype ? ` · genotipo ${a.genotype}${a.zygosity ? ` (${a.zygosity === 'HOMOZYGOUS' ? 'omozigote' : 'eterozigote'})` : ''}` : ''}
                  </p>
                  {a.interpretation && (
                    <p className="text-xs text-muted-foreground/90 leading-relaxed">{a.interpretation}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Spiegazione */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Questa pagina mostra le varianti genetiche associate a condizioni cliniche note, classificate secondo la{' '}
            <strong className="text-foreground">significativita' clinica</strong> definita dalle linee guida{' '}
            <a href="https://pubmed.ncbi.nlm.nih.gov/25741868/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ACMG/AMP</a>{' '}
            e dal database{' '}
            <a href="https://www.ncbi.nlm.nih.gov/clinvar/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ClinVar</a>.
            Le categorie sono:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc">
            <li><strong className="text-foreground">Patogenico</strong> &mdash; variante con forte evidenza di causare malattia.</li>
            <li><strong className="text-foreground">Probabilmente patogenico</strong> &mdash; evidenza sufficiente ma non definitiva di patogenicita'.</li>
            <li><strong className="text-foreground">Significato incerto (VUS)</strong> &mdash; non ci sono dati sufficienti per classificare la variante come benigna o patogena.</li>
            <li><strong className="text-foreground">Probabilmente benigno</strong> &mdash; evidenza sufficiente ma non definitiva di benignita'.</li>
            <li><strong className="text-foreground">Benigno</strong> &mdash; variante con forte evidenza di non causare malattia.</li>
          </ul>
          <p className="text-xs text-muted-foreground italic">
            Attenzione: questa analisi ha scopo puramente informativo e non costituisce una diagnosi medica.
            Consulta sempre un medico genetista per l'interpretazione clinica dei risultati.
          </p>
        </CardContent>
      </Card>

      {/* Riepilogo statistiche */}
      {counts && counts.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{counts?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Totale rischi</p>
            </CardContent>
          </Card>
          {SIG_ORDER.map((sig) => (
            <Card key={sig}>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold" style={{ color: SIG_CHART_COLORS[sig] }}>
                  {sigCounts[sig]}
                </p>
                <Badge
                  variant={sigColor[sig] as any || 'secondary'}
                  className="mt-1 text-[10px]"
                  style={{
                    backgroundColor: `${SIG_CHART_COLORS[sig]}20`,
                    color: SIG_CHART_COLORS[sig],
                    borderColor: SIG_CHART_COLORS[sig],
                  }}
                >
                  {SIG_LABELS[sig]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Grafico distribuzione */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuzione per Significativita' Clinica</CardTitle>
            <p className="text-xs text-muted-foreground">
              Numero di varianti per ciascuna categoria di significativita' (basato su {counts?.total ?? 0} varianti analizzate).
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 140 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(0, 0%, 60%)' }} />
                <YAxis type="category" dataKey="significance" tick={{ fontSize: 12, fill: 'hsl(0, 0%, 75%)' }} width={140} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(0, 0%, 10%)', border: '1px solid hsl(0, 0%, 20%)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: any) => [`${value} varianti`, 'Conteggio']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={SIG_CHART_COLORS[entry.key] ?? 'hsl(220, 50%, 50%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabella dettagliata */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Dettaglio Varianti ({total})</CardTitle>
              <p className="text-xs text-muted-foreground">
                Clicca su una riga per espandere descrizione, prevalenza e link di approfondimento.
              </p>
            </div>
            <select
              value={sigFilter}
              onChange={(e) => { setSigFilter(e.target.value); setPage(0); }}
              className="text-sm bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground"
            >
              <option value="">Tutte le significativita'</option>
              {SIG_ORDER.map((sig) => (
                <option key={sig} value={sig}>{SIG_LABELS[sig]}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Malattia</TableHead>
                <TableHead>Gene</TableHead>
                <TableHead>Significativit&agrave;</TableHead>
                <TableHead>Zigosit&agrave;</TableHead>
                <TableHead title="Frequenza allelica gnomAD (popmax / EUR)">Freq. pop.</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Evidenza</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d: any) => {
                const meta: DiseaseMetadata | undefined =
                  typeof d.metadata === 'string'
                    ? JSON.parse(d.metadata)
                    : d.metadata;
                const hasMeta =
                  meta &&
                  (meta.description || meta.prevalence || (meta.links && Object.keys(meta.links).length > 0));
                const isExpanded = expanded.has(d.id);

                return (
                  <Fragment key={d.id}>
                    <TableRow
                      className={hasMeta ? 'cursor-pointer' : ''}
                      onClick={() => hasMeta && toggle(d.id)}
                    >
                      <TableCell className="font-medium max-w-[300px]">
                        <span className="flex items-center gap-1.5">
                          {hasMeta && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          )}
                          <span className="truncate" title={d.disease}>{d.disease}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        {d.variant?.gene ? (
                          <span className="font-mono text-xs">{d.variant.gene}</span>
                        ) : <span className="text-muted-foreground">&mdash;</span>}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant={
                              (sigColor[d.significance] as any) || 'secondary'
                            }
                          >
                            {d.significance}
                          </Badge>
                          {typeof (d.metadata as any)?.stars === 'number' && (
                            <ClinvarStars stars={(d.metadata as any).stars} />
                          )}
                          {d.variant?.lowConfidence && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-amber-600 border-amber-500/50"
                              title={`Chiamata a bassa confidenza${typeof d.variant.vaf === 'number' ? ` (VAF ${Math.round(d.variant.vaf * 100)}%)` : ''}: supporto in letture atipico, da confermare`}
                            >
                              bassa conf.
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {d.variant?.zygosity ? (
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${ZYG_CLASS[d.variant.zygosity] ?? ''}`}>
                              {ZYG_LABEL[d.variant.zygosity] ?? d.variant.zygosity}
                            </Badge>
                            {d.variant.genotype && (
                              <span className="font-mono text-xs text-muted-foreground">{d.variant.genotype}</span>
                            )}
                          </span>
                        ) : <span className="text-muted-foreground">&mdash;</span>}
                      </TableCell>
                      <TableCell><GnomadAf meta={meta} /></TableCell>
                      <TableCell>{d.source}</TableCell>
                      <TableCell className="whitespace-normal">{d.evidenceLevel || '\u2014'}</TableCell>
                      <TableCell><VariantLink variantId={d.variantId} /></TableCell>
                    </TableRow>
                    {hasMeta && isExpanded && (
                      <MetadataDetail metadata={meta} />
                    )}
                  </Fragment>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    Nessun dato disponibile.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-border mt-4">
            <p className="text-xs text-muted-foreground">
              {total > 0 ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} di ${total}` : 'Nessun risultato'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Precedente</Button>
              <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Successiva</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </AiSummaryProvider>
  );
}
