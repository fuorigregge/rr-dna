import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutationWithToast } from '@/lib/use-mutation-with-toast';
import { gqlClient } from '@/lib/graphql-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';
import { ClinvarStars } from '@/components/clinvar-stars';
import { GnomadAf } from '@/components/gnomad-af';

export const Route = createFileRoute('/variants/$id')({ component: VariantDetailPage });

const QUERY = `query($id: ID!) {
  variant(id: $id) {
    id vcfFileId chromosome position rsId ref alt quality filter genotype zygosity depth vaf lowConfidence notes
    annotations { id source gene consequence impact data }
    diseases { id disease significance source evidenceLevel metadata }
    pharma { id drug effect metabolizerStatus source evidenceLevel metadata }
    carrier { id condition inheritancePattern carrierType source metadata }
    ancestry { id haplogroup population frequency metadata }
    traits { id trait effect category source metadata }
  }
}`;
const ENRICH = `mutation($variantId: ID!) { enrichVariant(variantId: $variantId) }`;
const ENRICH_TRAITS = `mutation($variantId: ID!) { enrichTraits(variantId: $variantId) }`;
const UPDATE_NOTES = `mutation($id: ID!, $notes: String) { updateVariantNotes(id: $id, notes: $notes) { id notes } }`;

function NotesCard({ variantId, initialNotes }: { variantId: string; initialNotes: string | null }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(initialNotes ?? '');
  useEffect(() => { setValue(initialNotes ?? ''); }, [initialNotes]);
  const dirty = value.trim() !== (initialNotes ?? '').trim();
  const save = useMutationWithToast({
    mutationFn: () => gqlClient.request<any>(UPDATE_NOTES, { id: variantId, notes: value.trim() || null }),
    toast: { loading: 'Salvataggio note...', success: 'Note salvate', error: 'Errore nel salvataggio' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variant', variantId] }),
  });
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Note personali</CardTitle>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-500">modifiche non salvate</span>}
            <Button
              size="sm"
              variant={dirty ? 'default' : 'outline'}
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending}
            >
              {save.isPending ? 'Salvataggio...' : 'Salva'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Appunti, link, valutazioni personali su questa variante. Non vengono mai sovrascritti
          dalle annotazioni automatiche.
        </p>
      </CardHeader>
      <CardContent>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Aggiungi note, link a paper, valutazioni personali…"
          rows={5}
          className="w-full text-sm bg-background border border-border rounded-md px-3 py-2 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
        />
      </CardContent>
    </Card>
  );
}

const sigColor: Record<string, string> = {
  PATHOGENIC: 'destructive', LIKELY_PATHOGENIC: 'destructive',
  UNCERTAIN: 'secondary', LIKELY_BENIGN: 'default', BENIGN: 'default',
};

function ExternalLinks({ links }: { links?: Record<string, string> }) {
  if (!links || Object.keys(links).length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {Object.entries(links).map(([label, url]) => (
        <a key={label} href={url as string} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          {label} ↗
        </a>
      ))}
    </div>
  );
}

function MetaDescription({ metadata }: { metadata?: any }) {
  if (!metadata) return null;
  const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  return (
    <div className="mt-2 space-y-1">
      {meta.description && <p className="text-sm text-muted-foreground">{meta.description}</p>}
      {meta.prevalence && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Prevalenza:</span> {meta.prevalence}</p>}
      {meta.reproductive_risk && <p className="text-xs text-orange-400"><span className="font-medium">Rischio riproduttivo:</span> {meta.reproductive_risk}</p>}
      <ExternalLinks links={meta.links} />
    </div>
  );
}

function VariantDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['variant', id], queryFn: () => gqlClient.request<any>(QUERY, { id }) });
  const enrich = useMutationWithToast({
    mutationFn: () => gqlClient.request<any>(ENRICH, { variantId: id }),
    toast: { loading: 'Arricchimento in corso...', success: 'Dati arricchiti con successo', error: "Errore durante l'arricchimento" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variant', id] }),
  });
  const enrichTraits = useMutationWithToast({
    mutationFn: () => gqlClient.request<any>(ENRICH_TRAITS, { variantId: id }),
    toast: { loading: 'Ricerca tratti SNPedia...', success: 'Tratti aggiornati da SNPedia', error: 'Errore nella ricerca tratti' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variant', id] }),
  });

  const variant = data?.variant;
  if (!variant) return <div className="p-6">Caricamento...</div>;

  const annotations = variant.annotations ?? [];
  const diseases = variant.diseases ?? [];
  const pharma = variant.pharma ?? [];
  const carrier = variant.carrier ?? [];
  const ancestry = variant.ancestry ?? [];
  const traits = variant.traits ?? [];
  const geneAnnotation = annotations.find((a: any) => a.gene);
  const geneFunction = geneAnnotation?.data?.gene_function;

  return (
    <AiSummaryProvider vcfFileId={variant.vcfFileId} type={`variant-${id}`} title={`Analisi Variante ${variant.rsId || `${variant.chromosome}:${variant.position}`}`}>
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{variant.rsId || `${variant.chromosome}:${variant.position}`}</h1>
          {geneAnnotation?.gene && <p className="text-muted-foreground text-sm">Gene: <span className="font-mono font-medium text-foreground">{geneAnnotation.gene}</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <AiSummaryButton />
          {variant.rsId && (
            <a href={`https://www.ncbi.nlm.nih.gov/snp/${variant.rsId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">dbSNP ↗</Button>
            </a>
          )}
          <Button variant="outline" onClick={() => enrich.mutate()} disabled={enrich.isPending}>
            {enrich.isPending ? 'Arricchimento...' : 'Arricchisci dati'}
          </Button>
          {variant.rsId && (
            <Button variant="outline" onClick={() => enrichTraits.mutate()} disabled={enrichTraits.isPending}>
              {enrichTraits.isPending ? 'Cercando...' : 'Cerca tratti SNPedia'}
            </Button>
          )}
        </div>
      </div>

      <AiSummaryCard />

      {/* Dettagli Variante */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dettagli Variante</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Cromosoma:</span> {variant.chromosome}</div>
            <div><span className="text-muted-foreground">Posizione:</span> {variant.position.toLocaleString()}</div>
            <div><span className="text-muted-foreground">Ref / Alt:</span> <code>{variant.ref}</code> → <code>{variant.alt}</code></div>
            <div><span className="text-muted-foreground">Genotipo:</span> {variant.genotype || '—'}</div>
            <div>
              <span className="text-muted-foreground">Zigosità:</span>{' '}
              <Badge variant="secondary">
                {variant.zygosity === 'HOMOZYGOUS' ? 'Omozigote' : variant.zygosity === 'HETEROZYGOUS' ? 'Eterozigote' : (variant.zygosity || '—')}
              </Badge>
            </div>
            <div><span className="text-muted-foreground">Qualità:</span> {variant.quality ?? '—'}</div>
            <div><span className="text-muted-foreground">Profondità:</span> {variant.depth ?? '—'}</div>
            <div>
              <span className="text-muted-foreground">VAF:</span>{' '}
              {typeof variant.vaf === 'number' ? `${Math.round(variant.vaf * 100)}%` : '—'}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Affidabilità della chiamata:</span>{' '}
              {variant.lowConfidence ? (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/50" title="Supporto in letture atipico (allele balance o profondità) — da confermare con test mirato">
                  bassa confidenza
                </Badge>
              ) : (
                <span>standard</span>
              )}
            </div>
          </div>
          {geneFunction && (
            <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-3">
              <span className="font-medium text-foreground">Funzione del gene:</span> {geneFunction}
            </p>
          )}
        </CardContent>
      </Card>

      <NotesCard variantId={variant.id} initialNotes={variant.notes ?? null} />

      {/* Rischio Malattie */}
      {diseases.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Rischio Malattie ({diseases.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {diseases.map((d: any) => {
              const meta = typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata;
              const stars = meta?.stars;
              const bs1 = meta?.bs1_level;
              return (
                <div key={d.id} className="p-3 rounded-lg bg-secondary">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                    <span className="font-medium text-sm">{d.disease}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={(sigColor[d.significance] as any) || 'secondary'}>{d.significance}</Badge>
                      {typeof stars === 'number' && <ClinvarStars stars={stars} />}
                      <span className="text-xs text-muted-foreground">{d.source}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="text-muted-foreground">Frequenza popolazione:</span>
                    <GnomadAf meta={meta} />
                  </div>
                  {bs1 === 'common' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 leading-snug">
                      ⚠ Variante comune in popolazione: troppo frequente per causare una malattia rara (ACMG BS1) &mdash; probabile polimorfismo, non un rischio reale nonostante l&apos;etichetta ClinVar.
                    </p>
                  )}
                  {d.evidenceLevel && (
                    <p className="text-xs text-muted-foreground italic mt-1">Review status: {d.evidenceLevel}</p>
                  )}
                  <MetaDescription metadata={d.metadata} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Farmacogenomica */}
      {pharma.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Farmacogenomica ({pharma.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pharma.map((p: any) => (
              <div key={p.id} className="p-3 rounded-lg bg-secondary">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-medium text-sm">{p.drug}</span>
                  <div className="flex items-center gap-2">
                    {p.metabolizerStatus && <Badge variant="secondary">{p.metabolizerStatus}</Badge>}
                    <span className="text-xs text-muted-foreground">{p.source}</span>
                  </div>
                </div>
                {p.effect && <p className="text-sm text-muted-foreground mt-1">{p.effect}</p>}
                <MetaDescription metadata={p.metadata} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Carrier Status */}
      {carrier.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Carrier Status ({carrier.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {carrier.map((c: any) => (
              <div key={c.id} className="p-3 rounded-lg bg-secondary">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-medium text-sm">{c.condition}</span>
                  <div className="flex items-center gap-2">
                    {c.inheritancePattern && <Badge variant="secondary">{c.inheritancePattern}</Badge>}
                    <span className="text-xs text-muted-foreground">{c.carrierType}</span>
                  </div>
                </div>
                <MetaDescription metadata={c.metadata} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ancestry */}
      {ancestry.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Frequenza Popolazioni ({ancestry.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ancestry.map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg bg-secondary">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{a.population || '—'}</span>
                  <Badge variant="secondary">{a.frequency != null ? `${(a.frequency * 100).toFixed(1)}%` : '—'}</Badge>
                </div>
                <MetaDescription metadata={a.metadata} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tratti Fenotipici */}
      {traits.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tratti Fenotipici ({traits.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {traits.map((t: any) => (
              <div key={t.id} className="p-3 rounded-lg bg-secondary">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-medium text-sm">{t.trait}</span>
                  <div className="flex items-center gap-2">
                    {t.category && <Badge variant="secondary">{t.category}</Badge>}
                    <span className="text-xs text-muted-foreground">{t.source}</span>
                  </div>
                </div>
                {t.effect && <p className="text-sm text-muted-foreground mt-1">{t.effect}</p>}
                <MetaDescription metadata={t.metadata} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Annotazioni Raw */}
      {annotations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Annotazioni ({annotations.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {annotations.map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg bg-secondary">
                <div className="flex items-center gap-2 mb-1">
                  <Badge>{a.source}</Badge>
                  {a.gene && <span className="font-mono text-sm">{a.gene}</span>}
                  {a.impact && <Badge variant="secondary">{a.impact}</Badge>}
                </div>
                {a.consequence && <p className="text-sm text-muted-foreground">{a.consequence}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
    </AiSummaryProvider>
  );
}
