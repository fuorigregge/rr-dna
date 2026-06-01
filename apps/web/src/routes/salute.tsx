import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { gqlClient } from '@/lib/graphql-client';
import { useActiveVcf } from '@/lib/use-active-vcf';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AiSummaryProvider, AiSummaryButton, AiSummaryCard } from '@/components/ai-summary';

export const Route = createFileRoute('/salute')({ component: SalutePage });

const TRAIT_QUERY = `query($vcfFileId: String!) { traitPanel(vcfFileId: $vcfFileId) { rsId gene trait state genotype interpretation } }`;
const PHARMA_QUERY = `query($vcfFileId: String!) { pharmacoPanel(vcfFileId: $vcfFileId) { gene diplotype phenotype drugs } }`;

type Tier = 'strong' | 'plausible';
type Tag = 'farmaco' | 'integratore' | 'alimento' | 'stile';
type TraitState = 'REFERENCE' | 'CARRIED' | 'NOT_COVERED';

const TAG_META: Record<Tag, { label: string; cls: string }> = {
  farmaco: { label: 'Farmaco', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  integratore: { label: 'Integratore', cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-400' },
  alimento: { label: 'Alimento', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  stile: { label: 'Stile di vita', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
};

// Contenuto curato (scienza, NON dati personali): lo stato del soggetto arriva
// dalle API a runtime. Ogni voce è agganciata a un rsID del pannello tratti.
interface DietInsight {
  rsId: string;
  title: string;
  tags: Tag[];
  tier: Tier;
  evidence: string;
  links: { label: string; url: string }[];
  consider: Partial<Record<TraitState, string>>;
}

const DIET: DietInsight[] = [
  {
    rsId: 'rs4988235', title: 'Lattosio (persistenza lattasi)', tags: ['alimento'], tier: 'strong',
    evidence: 'Fisiologia consolidata (LCT/MCM6)',
    links: [{ label: 'MedlinePlus', url: 'https://medlineplus.gov/genetics/condition/lactose-intolerance/' }],
    consider: {
      REFERENCE: 'Tendenza alla non-persistenza della lattasi: latte fresco può dare gonfiore/disturbi. Meglio tollerati yogurt, formaggi stagionati e prodotti senza lattosio. Cura calcio e vitamina D da altre fonti.',
      CARRIED: 'Persistenza della lattasi: digerisci il lattosio anche da adulto, nessuna restrizione genetica sui latticini.',
    },
  },
  {
    rsId: 'rs1800562', title: 'Ferro / emocromatosi (HFE C282Y)', tags: ['alimento', 'integratore'], tier: 'strong',
    evidence: 'Linee guida (emocromatosi ereditaria)',
    links: [{ label: 'GeneReviews', url: 'https://www.ncbi.nlm.nih.gov/books/NBK1440/' }],
    consider: {
      REFERENCE: 'Nessuna variante HFE di sovraccarico di ferro: gestione del ferro nella norma. Non serve evitare il ferro alimentare; come per tutti, evita integratori di ferro non prescritti.',
      CARRIED: 'Variante HFE presente: in omozigosi/compound può associarsi a sovraccarico di ferro. Evita integratori di ferro e vitamina C ad alte dosi ai pasti ricchi di ferro; chiedi al medico un controllo di ferritina/transferrina.',
    },
  },
  {
    rsId: 'rs2282679', title: 'Vitamina D', tags: ['integratore'], tier: 'strong',
    evidence: 'GWAS principali della 25(OH)D (GC, CYP2R1)',
    links: [{ label: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/20418485/' }],
    consider: {
      CARRIED: 'Loci (GC/CYP2R1) che spingono verso una 25(OH)D circolante più bassa. Considerazione: misura la vitamina D; se bassa, sole e/o supplementazione su indicazione medica — comune alle latitudini italiane in inverno.',
      REFERENCE: 'Nessuna spinta genetica marcata verso una vitamina D bassa su questo locus.',
    },
  },
  {
    rsId: 'rs1801133', title: 'Folati / omocisteina (MTHFR C677T)', tags: ['alimento', 'integratore'], tier: 'plausible',
    evidence: 'Osservazionale; azionabilità dibattuta',
    links: [{ label: 'MedlinePlus', url: 'https://medlineplus.gov/genetics/gene/mthfr/' }],
    consider: {
      CARRIED: 'Minore attività MTHFR → conversione dei folati ridotta (marcata se TT). Ragionevole: folati da dieta (verdure a foglia, legumi). La forma metilfolato è preferita da alcuni ma il beneficio clinico nella popolazione generale NON è dimostrato. Rilevante soprattutto se l’omocisteina è alta — misurabile.',
      REFERENCE: 'Attività MTHFR normale su questo polimorfismo.',
    },
  },
  {
    rsId: 'rs174537', title: 'Omega-3 (conversione PUFA, FADS1)', tags: ['alimento'], tier: 'plausible',
    evidence: 'GWAS metabolismo PUFA',
    links: [{ label: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/21829377/' }],
    consider: {
      REFERENCE: 'Converti bene i precursori vegetali (ALA) in EPA/DHA: dipendi meno da pesce/olio di pesce dei "convertitori lenti". Buone fonti vegetali di omega-3 sono probabilmente sufficienti.',
      CARRIED: 'Conversione dei precursori vegetali in EPA/DHA meno efficiente: fonti dirette (pesce grasso) o supplementazione possono contare di più.',
    },
  },
  {
    rsId: 'rs762551', title: 'Caffeina (CYP1A2)', tags: ['alimento'], tier: 'plausible',
    evidence: 'Farmacocinetica / GWAS',
    links: [{ label: 'SNPedia', url: 'https://www.snpedia.com/index.php/Rs762551' }],
    consider: {
      CARRIED: 'Metabolizzatore rapido: smaltisci la caffeina in fretta, tendenzialmente la tolleri meglio. "Rapido" non significa "illimitato"; il timing serale incide meno che nei metabolizzatori lenti.',
      REFERENCE: 'Metabolizzatore più lento: la caffeina permane più a lungo — attenzione a dosi alte e al consumo serale.',
    },
  },
  {
    rsId: 'rs601338', title: 'Vitamina B12 / status secretore (FUT2)', tags: ['integratore'], tier: 'plausible',
    evidence: 'GWAS B12; osservazionale',
    links: [{ label: 'SNPedia', url: 'https://www.snpedia.com/index.php/Rs601338' }],
    consider: {
      CARRIED: 'Non-secretore (in omozigosi): B12 sierica tendenzialmente più alta e microbiota intestinale diverso (con resistenza ad alcuni norovirus). Per lo più informativo; nessuna azione specifica.',
      REFERENCE: 'Secretore: profilo B12/microbiota di riferimento.',
    },
  },
  {
    rsId: 'rs16969968', title: 'Nicotina / dipendenza (CHRNA5)', tags: ['stile'], tier: 'strong',
    evidence: 'GWAS replicato (dipendenza nicotinica)',
    links: [{ label: 'SNPedia', url: 'https://www.snpedia.com/index.php/Rs16969968' }],
    consider: {
      CARRIED: 'Variante associata a maggiore dipendenza da nicotina e consumo più alto nei fumatori. Azionabile e netto: un motivo in più per non iniziare a fumare o per smettere (con supporto). Non cambia nulla per chi non fuma.',
      REFERENCE: 'Nessuna spinta genetica marcata alla dipendenza da nicotina su questo locus — il fumo resta comunque dannoso per tutti.',
    },
  },
  {
    rsId: 'rs1229984', title: 'Alcol (ADH1B)', tags: ['stile', 'alimento'], tier: 'plausible',
    evidence: 'GWAS / farmacogenetica dell\'alcol',
    links: [{ label: 'SNPedia', url: 'https://www.snpedia.com/index.php/Rs1229984' }],
    consider: {
      CARRIED: 'Metabolismo dell\'alcol nella norma per questo locus (variante comune europea); con ALDH2 normale, nessun "flush". La genetica qui non dà né lasciapassare né allarme: valgono le raccomandazioni generali di moderazione.',
      REFERENCE: 'Metabolismo dell\'alcol standard su questo locus; valgono le raccomandazioni generali di moderazione.',
    },
  },
  {
    rsId: 'rs17883901', title: 'Glutatione / NAC (GCLC, GPX1, GSTP1)', tags: ['integratore'], tier: 'plausible',
    evidence: 'Meccanicistico; non dimostrato clinicamente',
    links: [{ label: 'GlyNAC (PubMed)', url: 'https://pubmed.ncbi.nlm.nih.gov/35975308/' }],
    consider: {
      CARRIED: 'Porti varianti eterozigoti che abbassano un po\' gli enzimi della via del glutatione (qui GCLC, il passo limitante della sintesi; vedi anche GPX1/GSTP1 in Tratti). La NAC rifornisce il substrato (cisteina) di questa via: razionale plausibile ma NON provato. L\'angolo "longevità" riguarda semmai GlyNAC (glicina+NAC), evidenza preliminare. Non è un\'indicazione a integrare.',
      REFERENCE: 'Sintesi del glutatione di riferimento su questo locus: nessuna spinta particolare a supplementare la via.',
    },
  },
];

const STATE_BADGE: Record<TraitState, { label: string; cls: string }> = {
  CARRIED: { label: 'variante portata', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  REFERENCE: { label: 'riferimento', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  NOT_COVERED: { label: 'non valutabile', cls: 'bg-secondary text-muted-foreground' },
};

const TIER_META: Record<Tier, { label: string; desc: string }> = {
  strong: { label: 'Azionabile', desc: 'Evidenza forte / linee guida — da discutere con medico o nutrizionista.' },
  plausible: { label: 'Plausibile', desc: 'Collegamento biologicamente sensato ma non dimostrato — interessante, non una raccomandazione.' },
};

function isPharmaNormal(phenotype?: string): boolean {
  return !!phenotype && /normal/i.test(phenotype);
}

function SalutePage() {
  const { activeFile } = useActiveVcf();
  const [tagFilter, setTagFilter] = useState<Tag | 'all'>('all');

  const { data: traitData } = useQuery({
    queryKey: ['traitPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(TRAIT_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile, staleTime: 30_000,
  });
  const { data: pharmaData } = useQuery({
    queryKey: ['pharmacoPanel', activeFile?.id],
    queryFn: () => gqlClient.request<any>(PHARMA_QUERY, { vcfFileId: activeFile?.id }),
    enabled: !!activeFile, staleTime: 30_000,
  });

  const traitByRs: Record<string, any> = useMemo(() => {
    const m: Record<string, any> = {};
    for (const t of traitData?.traitPanel ?? []) m[t.rsId] = t;
    return m;
  }, [traitData]);

  const pharma = pharmaData?.pharmacoPanel ?? [];
  const pharmaAttn = pharma.filter((p: any) => !isPharmaNormal(p.phenotype));
  const pharmaNormal = pharma.filter((p: any) => isPharmaNormal(p.phenotype));

  // Voci dieta/nutriente risolte contro lo stato reale del soggetto
  type Resolved = { ins: DietInsight; item: any; state: TraitState; text: string };
  const resolved: Resolved[] = useMemo(() => {
    const out: Resolved[] = [];
    for (const ins of DIET) {
      const item = traitByRs[ins.rsId];
      if (!item) continue;
      const state = (item.state ?? 'NOT_COVERED') as TraitState;
      const text = ins.consider[state];
      if (!text) continue;
      out.push({ ins, item, state, text });
    }
    return out;
  }, [traitByRs]);

  const visible = (tags: Tag[]) => tagFilter === 'all' || tags.includes(tagFilter);

  const strongDiet = resolved.filter((r) => r.ins.tier === 'strong' && visible(r.ins.tags));
  const plausibleDiet = resolved.filter((r) => r.ins.tier === 'plausible' && visible(r.ins.tags));
  const showFarmaco = tagFilter === 'all' || tagFilter === 'farmaco';

  if (!activeFile) {
    return <div className="text-center text-muted-foreground py-12">Carica un file VCF per la sezione salute.</div>;
  }

  return (
    <AiSummaryProvider vcfFileId={activeFile.id} type="salute" title="Sintesi Salute personalizzata">
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Salute personalizzata</h1>
        <AiSummaryButton />
      </div>

      <AiSummaryCard />

      {/* Disclaimer in evidenza */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Considerazioni, non prescrizioni.</p>
          <p>
            Questa sezione mette insieme ciò che il <strong>tuo DNA</strong> e la <strong>ricerca</strong> suggeriscono
            su farmaci, integratori e alimenti. Non dice "prendi questo": sono spunti da portare a un medico o
            nutrizionista. La farmacogenomica indica <em>come</em> usare farmaci eventualmente prescritti, non quali
            assumere. Per gli integratori l’evidenza guidata dal genotipo è spesso debole: nessuno "stack" è dimostrato.
          </p>
        </CardContent>
      </Card>

      {/* Invecchiamento / healthspan — sintesi onesta */}
      <Card>
        <CardContent className="pt-4 space-y-2 text-sm">
          <p className="font-medium text-foreground">Invecchiamento &amp; healthspan 🕰️</p>
          <p className="text-muted-foreground leading-snug">
            Il DNA non offre scorciatoie antiaging. I fattori con evidenza vera sono <strong>universali</strong> e
            battono qualsiasi integratore: non fumare, attività fisica (forza + aerobica), sonno, dieta mediterranea,
            salute cardiometabolica (pressione/glicemia/lipidi), alcol moderato, protezione solare, legami sociali.
          </p>
          <div className="text-muted-foreground leading-snug">
            <span className="text-foreground font-medium">Dove il tuo DNA raffina:</span>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li><strong>Non fumare conta doppio</strong> — una componente genetica (CHRNA5) puo' rendere la nicotina più tenace (vedi “Nicotina”).</li>
              <li><strong>Misura l’omocisteina</strong> — MTHFR (variante): se alta, folati/B12 la abbassano (rischio cardio/cognitivo).</li>
              <li><strong>Mantieni la vitamina D</strong> — alcuni profili tendono a valori bassi (vedi “Vitamina D”).</li>
              <li><strong>Via glutatione/NAC</strong> — razionale plausibile, non provato (vedi card dedicata).</li>
            </ul>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 leading-snug">
            Hype che il tuo DNA <strong>non</strong> supporta: NMN/NR, resveratrolo, metformina nei sani, rapamicina —
            nessuna prova di beneficio guidato dal genotipo. Lo score “Longevità (centenari)” spiega &lt;1% ed è
            autosomico: il sesso pesa molto di più.
          </p>
        </CardContent>
      </Card>

      {/* Filtri per tag */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'farmaco', 'integratore', 'alimento', 'stile'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTagFilter(t)}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              tagFilter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'all' ? 'Tutto' : TAG_META[t].label}
          </button>
        ))}
      </div>

      {/* AZIONABILE */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">🟢 {TIER_META.strong.label}</h2>
          <p className="text-xs text-muted-foreground">{TIER_META.strong.desc}</p>
        </div>

        {/* Farmaci PGx con attenzione */}
        {showFarmaco && pharmaAttn.map((p: any) => (
          <InsightCard
            key={`ph-${p.gene}`}
            tags={['farmaco']} tier="strong"
            title={`${p.gene} ${p.diplotype ?? ''} — attenzione farmacologica`}
            stateBadge={{ label: p.phenotype, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' }}
            status={`Se ti vengono prescritti: ${p.drugs}`}
            consideration="Segnala questo dato al medico prima della prescrizione: può richiedere dose diversa o farmaco alternativo (modello CPIC)."
            evidence="CPIC — linea guida farmacogenomica"
            links={[{ label: 'CPIC', url: 'https://cpicpgx.org/guidelines/' }]}
          />
        ))}

        {/* Dieta/nutrienti azionabili */}
        {strongDiet.map(({ ins, item, state, text }) => (
          <InsightCard
            key={ins.rsId}
            tags={ins.tags} tier="strong" title={ins.title}
            stateBadge={STATE_BADGE[state]}
            status={item.interpretation}
            statusMeta={`${ins.rsId}${item.genotype ? ` · ${item.genotype}` : ''}`}
            consideration={text}
            evidence={ins.evidence}
            links={ins.links}
          />
        ))}

        {/* Farmaci normali: riepilogo compatto */}
        {showFarmaco && pharmaNormal.length > 0 && (
          <Card>
            <CardContent className="pt-3 pb-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Nessuna attenzione particolare</span> su{' '}
              {pharmaNormal.map((p: any) => p.gene).join(', ')} (metabolismo/funzione nella norma).
            </CardContent>
          </Card>
        )}
      </section>

      {/* PLAUSIBILE */}
      {plausibleDiet.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">🟡 {TIER_META.plausible.label}</h2>
            <p className="text-xs text-muted-foreground">{TIER_META.plausible.desc}</p>
          </div>
          {plausibleDiet.map(({ ins, item, state, text }) => (
            <InsightCard
              key={ins.rsId}
              tags={ins.tags} tier="plausible" title={ins.title}
              stateBadge={STATE_BADGE[state]}
              status={item.interpretation}
              statusMeta={`${ins.rsId}${item.genotype ? ` · ${item.genotype}` : ''}`}
              consideration={text}
              evidence={ins.evidence}
              links={ins.links}
            />
          ))}
        </section>
      )}

      <p className="text-xs text-muted-foreground/80 border-t pt-3">
        Le voci si basano sui tuoi pannelli Tratti e Farmaci. Le decisioni terapeutiche e dietetiche vanno prese
        con un professionista sanitario.
      </p>
    </div>
    </AiSummaryProvider>
  );
}

function InsightCard(props: {
  tags: Tag[]; tier: Tier; title: string;
  stateBadge: { label: string; cls: string };
  status?: string; statusMeta?: string;
  consideration: string; evidence: string;
  links: { label: string; url: string }[];
}) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="font-medium text-sm">{props.title}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {props.tags.map((t) => (
              <Badge key={t} className={`text-[10px] ${TAG_META[t].cls}`}>{TAG_META[t].label}</Badge>
            ))}
            <Badge className={`text-[10px] ${props.stateBadge.cls}`}>{props.stateBadge.label}</Badge>
          </div>
        </div>
        {props.statusMeta && <p className="text-[11px] font-mono text-muted-foreground">{props.statusMeta}</p>}
        {props.status && <p className="text-xs text-muted-foreground">{props.status}</p>}
        <p className="text-sm text-foreground/90 leading-snug">{props.consideration}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <span className="text-[11px] text-muted-foreground">Evidenza: {props.evidence}</span>
          {props.links.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline">{l.label} ↗</a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
