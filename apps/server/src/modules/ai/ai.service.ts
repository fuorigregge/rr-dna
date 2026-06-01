import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AncestryService } from '../ancestry/ancestry.service';
import { CarrierService } from '../carrier/carrier.service';
import { askClaude } from '@rr-dna/claude-ai';

// Steers the Claude CLI (an agent biased toward coding tasks) to emit ONLY the
// requested report — no meta-preamble like "Procedo..." or "Non c'è un task di
// sviluppo", which would otherwise leak into the first paragraph (the summary).
const NO_PREAMBLE_SYSTEM_PROMPT =
  "Stai redigendo un referto divulgativo in italiano, NON svolgendo un task di programmazione. " +
  "Produci ESCLUSIVAMENTE il contenuto richiesto nel prompt, in Markdown. " +
  "NON scrivere alcun preambolo, meta-commento, ragionamento sul compito o frase di conferma " +
  "(es. 'Procedo', 'Non c'è un task di sviluppo', 'mi è chiesto di...'). " +
  "La PRIMA frase della risposta deve già essere il contenuto del riassunto.";

// Strict rules on which external links the AI may emit. The model can otherwise
// confidently fabricate PMID/DOI URLs that look real but 404.
const LINK_GUIDANCE = `LINK A FONTI — vincoli rigorosi (i link inventati sono il rischio principale):
- ✅ USA per primi i link presenti nei "links" del dato (ClinVar/dbSNP/OMIM/PharmGKB/GeneReviews) per ancorare le citazioni
- ✅ Per approfondimenti puoi proporre ricerche PubMed con URL nella forma https://pubmed.ncbi.nlm.nih.gov/?term=parole+chiave (sostituisci con termini sensati) — questi URL sono sempre validi
- ✅ Pagine stabili per identificativo: https://www.ncbi.nlm.nih.gov/snp/<rsID>, https://gnomad.broadinstitute.org/variant/<rsID>, https://www.pharmgkb.org/chemical/<nome-farmaco>
- ❌ NON inventare PMID specifici, DOI, o URL di singoli paper: rischio altissimo di link inesistenti
- Distingui i link curati (fonti del dato) dai link suggeriti come "approfondimenti"`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ancestryService: AncestryService,
    private readonly carrierService: CarrierService,
  ) {}

  async findSummary(vcfFileId: string, type: string) {
    return this.prisma.aiSummary.findUnique({
      where: { vcfFileId_type: { vcfFileId, type } },
    });
  }

  async generateSummary(vcfFileId: string, type: string) {
    this.logger.log(`[AI] Generazione riassunto: vcfFileId=${vcfFileId}, type=${type}`);
    const start = Date.now();

    const prompt = await this.buildPrompt(vcfFileId, type);
    this.logger.log(`[AI] Prompt costruito (${prompt.length} chars), invocazione Claude CLI...`);

    const response = await askClaude(prompt, {
      timeoutMs: 300_000,
      appendSystemPrompt: NO_PREAMBLE_SYSTEM_PROMPT,
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (response.is_error) {
      this.logger.error(`[AI] Claude ha restituito errore dopo ${elapsed}s: ${response.result.slice(0, 200)}`);
      throw new Error(`Claude error: ${response.result}`);
    }

    this.logger.log(`[AI] Risposta ricevuta in ${elapsed}s — ${response.result.length} chars, costo: $${response.cost_usd.toFixed(4)}`);

    // Split response: first paragraph = summary, rest = detail
    const { summary, detail } = this.splitResponse(response.result);
    this.logger.log(`[AI] Summary: ${summary.length} chars, Detail: ${detail.length} chars`);

    const saved = await this.prisma.aiSummary.upsert({
      where: { vcfFileId_type: { vcfFileId, type } },
      update: { summary, detail, updatedAt: new Date() },
      create: { vcfFileId, type, summary, detail },
    });

    this.logger.log(`[AI] Salvato in DB: id=${saved.id}`);
    return saved;
  }

  private splitResponse(text: string): { summary: string; detail: string } {
    const lines = text.split('\n');
    const summaryLines: string[] = [];
    const detailLines: string[] = [];
    let inDetail = false;

    for (const line of lines) {
      if (!inDetail && line.trim() === '' && summaryLines.length > 0) {
        inDetail = true;
      }
      if (inDetail) {
        detailLines.push(line);
      } else {
        summaryLines.push(line);
      }
    }

    return {
      summary: summaryLines.join('\n').trim(),
      detail: detailLines.join('\n').trim() || summaryLines.join('\n').trim(),
    };
  }

  private async buildPrompt(vcfFileId: string, type: string): Promise<string> {
    switch (type) {
      case 'diseases':
        return this.buildDiseasesPrompt(vcfFileId);
      case 'pharma':
        return this.buildPharmaPrompt(vcfFileId);
      case 'carrier':
        return this.buildCarrierPrompt(vcfFileId);
      case 'traits':
        return this.buildTraitsPrompt(vcfFileId);
      case 'prs':
        return this.buildPrsPrompt(vcfFileId);
      case 'ancestry':
        return this.buildAncestryPrompt(vcfFileId);
      case 'salute':
        return this.buildSalutePrompt(vcfFileId);
      case 'overview':
        return this.buildOverviewPrompt(vcfFileId);
      default:
        if (type.startsWith('variant-')) {
          return this.buildVariantPrompt(type.replace('variant-', ''));
        }
        throw new Error(`Unsupported AI summary type: ${type}`);
    }
  }

  private async buildDiseasesPrompt(vcfFileId: string): Promise<string> {
    // True distinct counts per significance (same dedup as the /diseases page),
    // computed on the FULL set — not on a truncated slice.
    const groups = await this.prisma.diseaseRisk.groupBy({
      by: ['disease', 'significance'],
      where: { variant: { vcfFileId } },
    });
    const counts = { total: groups.length, pathogenic: 0, likelyPathogenic: 0, uncertain: 0, likelyBenign: 0, benign: 0 };
    for (const g of groups) {
      switch (g.significance) {
        case 'PATHOGENIC': counts.pathogenic++; break;
        case 'LIKELY_PATHOGENIC': counts.likelyPathogenic++; break;
        case 'UNCERTAIN': counts.uncertain++; break;
        case 'LIKELY_BENIGN': counts.likelyBenign++; break;
        case 'BENIGN': counts.benign++; break;
      }
    }

    // Send EVERY distinct clinically-relevant entry (pathogenic/likely/uncertain),
    // ordered by severity (enum order). Benign/likely-benign are omitted as
    // background noise (their counts are still reported above).
    const diseases = await this.prisma.diseaseRisk.findMany({
      where: { variant: { vcfFileId }, significance: { in: ['PATHOGENIC', 'LIKELY_PATHOGENIC', 'UNCERTAIN'] } },
      include: { variant: { select: { rsId: true, chromosome: true, position: true, genotype: true, zygosity: true, depth: true, vaf: true, lowConfidence: true } } },
      distinct: ['disease', 'significance'],
      orderBy: { significance: 'asc' },
    });
    const dataJson = diseases.map(d => {
      const m = (d.metadata as any) ?? {};
      return {
        disease: d.disease,
        significance: d.significance,
        source: d.source,
        evidenceLevel: d.evidenceLevel,
        stars: m.stars,
        rsId: d.variant?.rsId,
        chr: d.variant?.chromosome,
        pos: d.variant?.position,
        genotype: d.variant?.genotype,
        zygosity: d.variant?.zygosity,
        depth: d.variant?.depth,
        vaf: d.variant?.vaf,
        lowConfidence: d.variant?.lowConfidence,
        // Frequenza gnomAD popmax (e EUR) per il test ACMG BS1.
        gnomad_af_popmax: typeof m.gnomad_af_grpmax === 'number' ? +m.gnomad_af_grpmax.toFixed(5) : null,
        gnomad_af_eur: typeof m.gnomad_af_nfe === 'number' ? +m.gnomad_af_nfe.toFixed(5) : null,
        bs1: m.bs1_level ?? null,
      };
    });

    // Curated ACMG actionable-variant panel: definitive per-variant verdict
    // (incl. reassuring negatives), the authoritative source for these high-impact genes.
    const acmg = await this.prisma.acmgResult.findMany({
      where: { vcfFileId },
      orderBy: [{ state: 'asc' }, { gene: 'asc' }],
    });
    const acmgJson = acmg.map(a => ({
      gene: a.gene, variante: a.variantName, condizione: a.condition,
      ereditarieta: a.inheritance, stato: a.state, genotype: a.genotype,
      zygosity: a.zygosity, confidence: a.confidence, interpretation: a.interpretation,
    }));

    return `Sei un consulente genetico che spiega risultati a un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: un riassunto breve (2-3 frasi) del quadro generale, senza titolo e senza heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Varianti patogeniche, ## Varianti a significato incerto, ecc.)

Analizza questi dati di rischio malattie genetiche.

**Riepilogo** (combinazioni malattia+significato DISTINTE, sull'intero set): ${counts.total} totali — ${counts.pathogenic} patogeniche, ${counts.likelyPathogenic} probabilmente patogeniche, ${counts.uncertain} significato incerto, ${counts.likelyBenign} probabilmente benigne, ${counts.benign} benigne.

I Dati sotto contengono TUTTE le distinte patogeniche/likely-patogeniche/incerte (${dataJson.length}). Le ${counts.benign} benigne e ${counts.likelyBenign} likely-benigne NON sono incluse nell'elenco: sono polimorfismi comuni in geni-malattia (rumore di fondo, non un rischio). NON affermare che "non ci sono varianti benigne" — esistono, sono solo omesse perche' non informative.

Il campo "stars" e' la confidenza ClinVar (0-4, dal ReviewStatus): una variante PATHOGENIC con stars=0 ('no assertion criteria provided') va trattata come possibile FALSO ALLARME, non come diagnosi. Incrocia SEMPRE significance con stars/evidenceLevel.

FREQUENZA DI POPOLAZIONE (ACMG BS1) — criterio decisivo contro i falsi positivi: "gnomad_af_popmax" e' la frequenza dell'allele nella popolazione a frequenza massima (gnomAD v4), "gnomad_af_eur" quella europea, "bs1" e' il livello ('common' >=5%, 'frequent' >=1%). Una variante "patogenica" COMUNE non puo' causare una malattia rara: se bs1='common' (es. rs1042522/TP53 al ~75%, lipodistrofia ~85%, COVID ~81%) trattala come PROBABILE FALSO POSITIVO / polimorfismo benigno, NON come rischio, anche se le stelle sono alte (al massimo, con >=2 stelle e frequenza 5-25%, segnala l'incoerenza). Cita la frequenza quando spieghi perche' un reperto e' un falso allarme. NB: alcune varianti realmente patogeniche di condizioni COMUNI a penetranza ridotta (es. HFE C282Y ~6%, Factor V Leiden ~2-3%) fanno eccezione e stanno nel pannello azionabile: non confonderle con i polimorfismi comuni.

CONFIDENZA DELLA CHIAMATA: il campo "lowConfidence"=true segnala che il supporto in letture e' atipico (vedi "vaf" = frazione allelica, e "depth" = profondita'). Una eterozigote dovrebbe avere vaf ~0.5; una vaf molto bassa (es. ~0.17) o una profondita' bassa indicano una chiamata dubbia: possibile falso positivo (errore/allineamento da paraloghi) o evento mosaico. Per una variante PATHOGENIC con lowConfidence=true, NON presentarla come dato solido: segnala esplicitamente che la chiamata e' a bassa confidenza e va confermata con un test mirato/ortogonale, indipendentemente dalle stelle ClinVar.

PANNELLO VARIANTI AZIONABILI — FONTE AUTOREVOLE per queste varianti specifiche ad alto impatto clinico (include varianti ACMG SF, ipercolesterolemia familiare, amiloidosi, trombofilia ereditaria, varianti mitocondriali patogeniche). Per le mitocondriali (inheritance="Mitocondriale (eredita' materna)") ricorda che la manifestazione clinica dipende dall'eteroplasmia (% copie mtDNA mutate, non leggibile direttamente dalla chiamata), tipicamente >60-80%. Per ciascuna il verdetto e' CERTO: CARRIED = porti la variante patogenica (usa genotype/zygosity); NOT_CARRIED = NON la porti (genotipo di riferimento al sito — risultato VALIDO e rassicurante, NON un dato mancante); NOT_COVERED = sito non valutabile; confidence=LOW = chiamata indel poco affidabile (founder BRCA), un negativo va confermato con test mirato. ATTENZIONE: il pannello controlla UNA variante specifica per gene — un NOT_CARRIED non esclude altre varianti patogeniche nello stesso gene. Dedica una sezione (## Pannello varianti azionabili) a questo, elencando sia i positivi sia i negativi rassicuranti:
${JSON.stringify(acmgJson, null, 2)}

**Dati** (annotazione ClinVar completa):
${JSON.stringify(dataJson, null, 2)}

Concentrati su:
- PANNELLO AZIONABILE: commenta OGNI variante (CARRIED e NOT_CARRIED). I negativi su BRCA1/BRCA2/TP53/APOB ecc. sono informazione rassicurante da riportare esplicitamente, non da omettere. Per i CARRIED spiega l'implicazione clinica e indica conferma + consulenza genetica
- Varianti PATHOGENIC e LIKELY_PATHOGENIC: spiega cosa significano per la salute (tecnico ma chiaro), pesando la confidenza — distingui i segnali solidi (>=2 stelle) dai possibili falsi allarmi (0 stelle)
- Varianti UNCERTAIN di particolare interesse
- Usa terminologia medica ma spiega i termini tecnici tra parentesi
- Segnala se ci sono pattern o cluster di varianti nella stessa area/gene
- Non dare consigli medici diretti, ma indica cosa approfondire con un genetista
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti`;
  }

  private async buildPharmaPrompt(vcfFileId: string): Promise<string> {
    const totalRows = await this.prisma.pharmacogenomics.count({ where: { variant: { vcfFileId } } });
    // One entry per drug (highest-evidence kept), instead of an arbitrary slice.
    const pharma = await this.prisma.pharmacogenomics.findMany({
      where: { variant: { vcfFileId } },
      include: { variant: { select: { rsId: true, genotype: true, zygosity: true } } },
      distinct: ['drug'],
      orderBy: { evidenceLevel: 'asc' },
    });

    const dataJson = pharma.map(p => ({
      drug: p.drug,
      effect: p.effect,
      metabolizerStatus: p.metabolizerStatus,
      source: p.source,
      evidenceLevel: p.evidenceLevel,
      rsId: p.variant?.rsId,
      genotype: p.variant?.genotype,
      zygosity: p.variant?.zygosity,
    }));

    // Star-allele panel: the subject's ACTUAL diplotype/phenotype per pharmacogene
    // (CPIC-style) — direction-aware, unlike the rsID-keyed associations above.
    const panel = await this.prisma.pharmacoResult.findMany({ where: { vcfFileId }, orderBy: { gene: 'asc' } });
    const panelJson = panel.map(p => ({ gene: p.gene, diplotype: p.diplotype, fenotipo: p.phenotype, farmaci: p.drugs }));

    return `Sei un consulente farmacogenetico che spiega risultati a un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: un riassunto breve (2-3 frasi) del quadro farmacogenomico, senza titolo e senza heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Farmaci ad alto rischio, ## Metabolismo alterato, ecc.)

PANNELLO FARMACOGENI (star-allele) — FONTE PRIMARIA E AUTOREVOLE. È il diplotipo/fenotipo REALE del soggetto per gene (modello CPIC), tiene conto della direzione dell'allele. Usa QUESTO per il fenotipo metabolizzatore, non le associazioni generiche sotto:
${JSON.stringify(panelJson, null, 2)}

Le associazioni qui sotto sono per rsID (PharmGKB), direzione-cieche: usale per ampliare la lista di farmaci, ma per il FENOTIPO fidati del pannello. ${pharma.length} farmaci DISTINTI (da ${totalRows} associazioni totali; una voce per farmaco, evidenza più alta):

${JSON.stringify(dataJson, null, 2)}

Concentrati su:
- PANNELLO: per ogni gene spiega il diplotipo e cosa implica il fenotipo per i farmaci elencati (dosaggio, rischio). Es. metabolizzatore lento/intermedio, non-espressore CYP3A5, funzione ridotta SLCO1B1 (miopatia statine)
- Farmaci controindicati o con sensibilità aumentata: spiega il rischio concreto
- Status metabolizzatore (lento/intermedio/normale/rapido/ultrarapido): cosa significa in pratica per il dosaggio
- Raggruppa per farmaco o per gene quando ha senso
- Segnala interazioni farmaco-farmaco note se emergono dai dati
- Usa terminologia medica ma spiega i termini tra parentesi
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti`;
  }

  private async buildSalutePrompt(vcfFileId: string): Promise<string> {
    // Sintesi azionabile: pannello farmacogeni (attenzioni) + tratti dieta/nutriente/
    // stile di vita sorvegliati dalla sezione Salute. Stesso ethos onesto della pagina.
    const SALUTE_RS = [
      'rs4988235', 'rs1800562', 'rs2282679', 'rs10741657', 'rs12785878', 'rs1801133',
      'rs174537', 'rs762551', 'rs601338', 'rs16969968', 'rs1229984', 'rs671',
      'rs17883901', 'rs1050450', 'rs1695',
    ];
    const pharma = await this.prisma.pharmacoResult.findMany({ where: { vcfFileId }, orderBy: { gene: 'asc' } });
    const pharmaJson = pharma.map(p => ({ gene: p.gene, diplotipo: p.diplotype, fenotipo: p.phenotype, farmaci: p.drugs }));

    const traits = await this.prisma.traitPanelResult.findMany({
      where: { vcfFileId, rsId: { in: SALUTE_RS } },
      orderBy: { gene: 'asc' },
    });
    const traitsJson = traits.map(t => ({
      gene: t.gene, rsId: t.rsId, tratto: t.trait, stato: t.state,
      genotipo: t.genotype, interpretazione: t.interpretation,
    }));

    return `Sei un consulente che sintetizza, per un programmatore (non medico), cosa il SUO DNA e la ricerca suggeriscono su farmaci, integratori, alimenti e stile di vita. Rispondi in italiano e in Markdown.

ETHOS OBBLIGATORIO — onestà sopra l'hype:
- NON sono prescrizioni. Non dire mai "prendi X". Sono considerazioni da portare a un medico o nutrizionista.
- La farmacogenomica indica COME usare un farmaco eventualmente prescritto, NON quali farmaci assumere per stare bene.
- Per gli integratori l'evidenza guidata dal genotipo è quasi sempre debole: nessuno "stack" è dimostrato. Dillo.
- Distingui esplicitamente AZIONABILE (linee guida/evidenza forte) da PLAUSIBILE (meccanicistico, non provato).
- Sono varianti comuni a piccolo effetto: niente allarmismi né promesse.

FORMATO:
1. PRIMO PARAGRAFO: riassunto breve (2-3 frasi), senza heading.
2. Dopo una riga vuota, DETTAGLIO con heading markdown: ## Farmaci (attenzioni), ## Alimenti, ## Integratori, ## Stile di vita. Ometti una sezione se non ci sono dati rilevanti.

PANNELLO FARMACOGENI (fenotipo reale per gene). I geni con fenotipo NON normale sono le attenzioni da segnalare al medico se quei farmaci vengono prescritti:
${JSON.stringify(pharmaJson, null, 2)}

TRATTI dieta / nutrienti / stile di vita (lo stato è il genotipo reale del soggetto):
${JSON.stringify(traitsJson, null, 2)}

Concentrati su:
- Farmaci: solo le attenzioni reali (fenotipo non normale), inquadrate come "se prescritto X…".
- Alimenti: indicazioni concrete dove l'evidenza regge (lattosio, ferro/HFE, alcol) — cosa preferire/limitare, senza diete miracolose.
- Integratori: dove ha senso MISURARE prima (es. vitamina D, B12, omocisteina per MTHFR); ribadisci che il genotipo non prescrive integratori.
- Stile di vita: nicotina/alcol — messaggi netti e onesti.
- Invecchiamento/healthspan: se pertinente, una sezione "## Invecchiamento" che dica chiaro che il DNA non offre scorciatoie antiaging — i fattori veri sono universali (non fumare, attività fisica, sonno, dieta mediterranea, salute cardiometabolica) — e che il genotipo li RAFFINA (es. CHRNA5 → non fumare; MTHFR → omocisteina; vitamina D). Smonta l'hype non supportato dal genotipo (NMN, resveratrolo, metformina nei sani, rapamicina). NON proporre integratori longevità.
- Chiudi NON con un elenco di acquisti, ma con "cosa misurare / cosa discutere col medico".
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti.`;
  }

  private async buildCarrierPrompt(vcfFileId: string): Promise<string> {
    const totalRows = await this.prisma.carrierStatus.count({ where: { variant: { vcfFileId } } });
    // One entry per condition (robust if a genome has many carrier rows).
    const carriers = await this.prisma.carrierStatus.findMany({
      where: { variant: { vcfFileId } },
      include: { variant: { select: { rsId: true, genotype: true, zygosity: true } } },
      distinct: ['condition'],
      orderBy: { condition: 'asc' },
    });

    const dataJson = carriers.map(c => ({
      condition: c.condition,
      inheritancePattern: c.inheritancePattern,
      carrierType: c.carrierType,
      source: c.source,
      rsId: c.variant?.rsId,
      genotype: c.variant?.genotype,
      zygosity: c.variant?.zygosity,
    }));

    // Curated carrier-screening panel: definitive per-variant verdict
    // (incl. reassuring CLEAR negatives), the authoritative source for these genes.
    const panel = await this.prisma.carrierPanelResult.findMany({
      where: { vcfFileId },
      orderBy: [{ state: 'asc' }, { gene: 'asc' }],
    });
    const panelJson = panel.map(p => ({
      gene: p.gene, variante: p.variantName, condizione: p.condition,
      ereditarieta: p.inheritance, stato: p.state, genotype: p.genotype,
      zygosity: p.zygosity, confidence: p.confidence, interpretation: p.interpretation,
    }));

    // Portatori di malattie recessive derivati dai reperti patogenici eterozigoti
    // ClinVar (es. ATM, DNAI1): NON sono nel pannello curato ma sono carrier veri.
    const derived = await this.carrierService.findDerivedCarriers(vcfFileId);
    const derivedJson = derived.map(d => ({
      gene: d.gene, condizione: d.condition, ereditarieta: d.inheritance,
      stato: d.state, genotype: d.genotype, zygosity: d.zygosity, stars: d.stars, nota: d.note,
    }));

    return `Sei un consulente genetico specializzato in genetica riproduttiva che spiega risultati a un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: un riassunto breve (2-3 frasi) dello stato di portatore, senza titolo e senza heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Pannello screening portatore, ## Altre condizioni, ecc.)

PANNELLO SCREENING PORTATORE — FONTE AUTOREVOLE per queste varianti specifiche. Per ciascuna il verdetto e' CERTO: CLEAR = NON sei portatore (genotipo di riferimento al sito — risultato VALIDO e rassicurante, NON un dato mancante); CARRIER = portatore sano eterozigote (rischio riproduttivo); AFFECTED = due copie / emizigote X maschile (compatibile con malattia, non solo portatore); NOT_COVERED = sito non valutabile; confidence=LOW = chiamata indel poco affidabile (CFTR F508del, GJB2 35delG), un negativo va confermato. ATTENZIONE: il pannello controlla UNA variante per gene — un CLEAR non esclude altre varianti patogeniche nello stesso gene. Dedica una sezione (## Pannello screening portatore) elencando SIA i positivi SIA i CLEAR rassicuranti:
${JSON.stringify(panelJson, null, 2)}

PORTATORE DI MALATTIE RECESSIVE (da ClinVar, oltre il pannello curato) — varianti PATOGENICHE ETEROZIGOTI in geni a ereditarieta' recessiva (autosomica recessiva o X-linked), che il pannello fisso sopra NON copre. Sei PORTATORE SANO (una sola copia, non malato): rilevanza riproduttiva (utile lo screening del partner). Dedica una sezione (## Portatore di malattie recessive) elencandoli. Segui il campo "nota" quando presente (es. ATM: i portatori hanno un rischio oncologico moderatamente aumentato, oltre al ruolo riproduttivo). Distingui SEMPRE "portatore" (eterozigote recessivo, sano) da una diagnosi:
${JSON.stringify(derivedJson, null, 2)}

NOTA da riportare: alcune condizioni recessive frequenti NON sono rilevabili da dati SNP/indel (atrofia muscolare spinale/SMN1 da numero di copie; X-fragile/FMR1 da espansione triplette) e non sono nel pannello — la loro assenza qui non e' un risultato negativo.

Annotazione ClinVar carrier (additiva, ${carriers.length} condizioni distinte da ${totalRows} righe):
${JSON.stringify(dataJson, null, 2)}

Concentrati su:
- PANNELLO: commenta OGNI variante (CLEAR e CARRIER/AFFECTED). I CLEAR su CFTR/HBB/GBA1 ecc. sono informazione rassicurante da riportare esplicitamente
- Condizioni autosomiche recessive: spiega il rischio riproduttivo (1/4 se entrambi i partner sono portatori)
- Condizioni X-linked: spiega la trasmissione legata al sesso (es. G6PD)
- Zigosità (eterozigote vs omozigote/emizigote): differenza tra portatore sano e affetto
- Indica quando è utile il test del partner
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti`;
  }

  private async buildTraitsPrompt(vcfFileId: string): Promise<string> {
    const traits = await this.prisma.phenotypeTrait.findMany({
      where: { variant: { vcfFileId } },
      include: { variant: { select: { rsId: true, genotype: true, zygosity: true } } },
      orderBy: { category: 'asc' },
    });

    // Deduplicate by trait name so the model sees every distinct trait once.
    // Previously `take: 200` sent an arbitrary slice of the (often >1500) rows,
    // silently dropping key markers (CYP1A2/ADH1B/ACTN3) and reporting them absent.
    const seen = new Set<string>();
    const distinct = traits.filter(t => {
      if (seen.has(t.trait)) return false;
      seen.add(t.trait);
      return true;
    });

    const dataJson = distinct.map(t => ({
      trait: t.trait,
      effect: t.effect,
      category: t.category,
      source: t.source,
      rsId: t.variant?.rsId,
      genotype: t.variant?.genotype,
      zygosity: t.variant?.zygosity,
    }));

    const categories = {
      metabolism: distinct.filter(t => t.category === 'METABOLISM').length,
      physical: distinct.filter(t => t.category === 'PHYSICAL').length,
      cognitive: distinct.filter(t => t.category === 'COGNITIVE').length,
    };

    // Curated panel: authoritative verdict (incl. standard 0/0 genotypes) for known SNPs.
    const panel = await this.prisma.traitPanelResult.findMany({
      where: { vcfFileId },
      orderBy: [{ category: 'asc' }, { gene: 'asc' }],
    });
    const panelJson = panel.map(p => ({
      rsId: p.rsId, gene: p.gene, trait: p.trait, state: p.state,
      genotype: p.genotype, zygosity: p.zygosity, confidence: p.confidence,
      interpretation: p.interpretation,
    }));

    return `Sei un genetista che spiega tratti fenotipici a un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: un riassunto breve (2-3 frasi) dei tratti principali, senza titolo e senza heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Metabolismo, ## Tratti fisici, ## Tratti cognitivi)

Analizza questi ${distinct.length} tratti DISTINTI (da ${traits.length} associazioni totali — ${categories.metabolism} metabolismo, ${categories.physical} fisici, ${categories.cognitive} cognitivi distinti):

${JSON.stringify(dataJson, null, 2)}

PANNELLO TRATTI NOTI (verdetto AUTOREVOLE per SNP selezionati — caffeina, lattosio, alcol, atletici, folati). Usa QUESTO come fonte primaria per questi marcatori:
${JSON.stringify(panelJson, null, 2)}

Per il pannello lo stato è certo: CARRIED = porti la variante (usa genotype/zygosity per la dose); REFERENCE = hai il GENOTIPO DI RIFERIMENTO/STANDARD a quel sito (è un risultato valido, NON un dato mancante — riportalo come "standard"); NOT_COVERED = sito non valutabile; confidence=LOW = chiamata poco affidabile (es. inserzioni grandi come ACE). Segui il campo "interpretation" per la direzione dell'allele.

NOTA IMPORTANTE: l'elenco tratti sopra è già completo dei tratti distinti rilevati. Se un marcatore non compare né tra i tratti né nel pannello, significa genotipo di riferimento o sito non coperto — NON un dato mancante dal sequenziamento. Non affermare mai che un marcatore "non è presente nel file/dataset".

Concentrati su:
- Metabolismo: caffeina, lattosio, alcol, farmaci — spiega come influenzano la vita quotidiana
- Tratti fisici: predisposizioni atletiche, risposta all'allenamento, recupero muscolare
- Tratti cognitivi: predisposizioni note (memoria, attenzione, risposta allo stress)
- Spiega la differenza tra predisposizione genetica e manifestazione effettiva
- Sii pratico: suggerisci implicazioni concrete per lo stile di vita
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti`;
  }

  private async buildPrsPrompt(vcfFileId: string): Promise<string> {
    // Tutti i PRS calcolati su questo genoma, ordinati per |z| (i piu' rilevanti
    // prima), i non calibrati in coda. Stessi dati della pagina /prs.
    const rows = await this.prisma.prsResult.findMany({
      where: { vcfFileId },
      orderBy: [{ traitKey: 'asc' }],
    });
    if (rows.length === 0) {
      throw new Error('Nessun PRS disponibile per questo file.');
    }

    const sorted = [...rows].sort((a, b) => {
      const az = a.zScore != null ? Math.abs(a.zScore) : -Infinity;
      const bz = b.zScore != null ? Math.abs(b.zScore) : -Infinity;
      if (bz !== az) return bz - az;
      return Math.abs(b.rawScore) - Math.abs(a.rawScore);
    });

    const dataJson = sorted.map((p) => ({
      tratto: p.trait,
      pgs_id: p.pgsId,
      z: p.zScore != null ? +p.zScore.toFixed(2) : null,
      percentile: p.percentile != null ? Math.round(p.percentile) : null,
      raw: +p.rawScore.toFixed(3),
      calibrazione: p.calibrationSource ?? (p.zScore != null ? 'hardy_weinberg' : null),
      marcatori: `${p.markersUsed}/${p.markersTotal}`,
      interpretation: p.interpretation,
    }));

    const calibrated = sorted.filter((p) => p.zScore != null);
    const high = calibrated.filter((p) => (p.zScore ?? 0) >= 1);
    const low = calibrated.filter((p) => (p.zScore ?? 0) <= -1);

    return `Sei un consulente genetico che spiega i Polygenic Risk Score (PRS) a un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: un riassunto breve (2-3 frasi) del quadro poligenico generale, senza titolo e senza heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Predisposizioni elevate, ## Predisposizioni ridotte, ## Nella media, ecc.)

COSA SONO: un PRS somma l'effetto di molti SNP (da poche decine a milioni) per stimare una predisposizione RELATIVA rispetto alla popolazione europea. Lo z-score e il percentile dicono quanto il soggetto si discosta dalla media: z=+1 ~84° percentile, z=-1 ~16°. NON sono diagnosi: predicono rischio relativo medio, non l'esito individuale. Stile di vita, ambiente, screening e altri fattori restano determinanti.

CALIBRAZIONE: "empirical_1000G_EUR" = media/SD ricavate empiricamente sui 503 sample europei del 1000 Genomes (affidabile per il centro della distribuzione ±2 percentili, meno per le code estreme top/bottom 2%). "hardy_weinberg" = approssimazione teorica (meno accurata perche' ignora il linkage disequilibrium). Pesane l'affidabilita': per code estreme con pochi marcatori sii piu' cauto.

RILEVANZA CLINICA: ${rows.length} PRS totali, ${calibrated.length} calibrati. Sopra la media (z>=+1): ${high.length}${high.length ? ' (' + high.map((p) => p.trait).join(', ') + ')' : ''}. Sotto la media (z<=-1): ${low.length}${low.length ? ' (' + low.map((p) => p.trait).join(', ') + ')' : ''}.

ATTENZIONE — APPLICABILITA' PER SESSO: alcuni PRS riguardano condizioni sesso-specifiche (tumore al seno, ovarico, prostata). Se compaiono, segnala che il punteggio e' calcolato ma l'applicabilita' clinica dipende dal sesso del soggetto; non allarmare su tratti non pertinenti.

**Dati** (PRS ordinati per |z| decrescente, i piu' rilevanti per primi):
${JSON.stringify(dataJson, null, 2)}

Concentrati su:
- Le predisposizioni che si discostano davvero (|z|>=1): spiega cosa significano in pratica e quali sono azionabili (prevenzione, screening, stile di vita)
- Distingui sempre i calibrati empiricamente (piu' affidabili) dalle approssimazioni HW
- Per i tratti sesso-specifici, contestualizza l'applicabilita'
- Tono equilibrato e non allarmistico; ribadisci che e' rischio relativo, non destino
- NON elencare meccanicamente tutti i ${rows.length}: raggruppa, dai priorita' ai segnali, accorpa "nella media" senza dettagliarli uno per uno
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti`;
  }

  private async buildAncestryPrompt(vcfFileId: string): Promise<string> {
    // Same likelihood-based best-fit shown on the /ancestry page (not the old
    // average-frequency heuristic) so the AI analysis matches what the user sees.
    const affinityRaw = await this.ancestryService.affinity(vcfFileId);
    const affinity = affinityRaw.map((a) => ({
      population: a.population,
      relativeScore: +a.relativeScore.toFixed(4),
      markerCount: a.markerCount,
    }));
    const totalMarkers = affinity[0]?.markerCount ?? 0;

    // Direct lineages (maternal mtDNA + paternal Y), computed via HaploGrep/yhaplo.
    const haplogroups = await this.prisma.haplogroup.findMany({
      where: { vcfFileId },
      orderBy: { lineage: 'asc' },
    });
    const haploJson = haplogroups.map(h => ({
      linea: h.lineage === 'MT' ? 'materna (mtDNA)' : 'paterna (cromosoma Y)',
      haplogroup: h.haplogroup,
      detail: h.detail,
      quality: h.quality,
      source: h.source,
    }));

    // Eredità neandertaliana (pannello tag-SNP introgressi Vernot 2016, EUR).
    const nean = await this.prisma.neanderthalResult.findUnique({ where: { vcfFileId } });
    const neanBlock = nean
      ? `\n\nEREDITÀ NEANDERTALIANA — stima ~${nean.estPercent.toFixed(2)}% del genoma (carico relativo ${nean.relativeLoad.toFixed(2)}× la media europea, ${((nean.relativeLoad - 1) * 100).toFixed(0)}% ${nean.relativeLoad >= 1 ? 'sopra' : 'sotto'} la media; ${nean.archaicAlleles} alleli arcaici su ${nean.coveredSites} tag-SNP introgressi). Gli europei stanno tipicamente ~1,5–2,2%. Dedica un breve cenno in una sezione "## Eredità neandertaliana": è una stima su marcatori validati (S* + outgroup), non una deconvoluzione genome-wide. Tono curioso, non clinico.`
      : '';

    return `Sei un genetista delle popolazioni che spiega risultati di ancestry a un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: un riassunto breve (2-3 frasi) dell'affinità ancestrale, senza titolo e senza heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Affinità principali, ## Interpretazione, ecc.)

Analizza questi dati di affinità ancestrale (${totalMarkers} marcatori valutati, ${affinity.length} popolazioni). Il punteggio e' un adattamento RELATIVO a verosimiglianza (modello Hardy-Weinberg sui tuoi alleli): 1.0 = miglior adattamento, gli altri sono proporzioni rispetto al migliore:

${JSON.stringify(affinity, null, 2)}

APLOGRUPPI DIRETTI (le due linee dirette del soggetto). APPROFONDISCI questi in una sezione dedicata:
${JSON.stringify(haploJson, null, 2)}${neanBlock}

Concentrati su:
- Popolazioni col punteggio relativo più alto (miglior adattamento): cosa significa in termini di origini ancestrali
- Differenze tra le popolazioni: cosa indicano i rapporti tra i punteggi relativi (es. il distacco dal secondo)
- APLOGRUPPI (sezione approfondita, ## Aplogruppi): per OGNI lignaggio (materno mtDNA e paterno Y) spiega origine geografica e temporale del ramo, migrazioni/eventi associati (es. espansioni neolitiche, paleolitiche), frequenza nelle popolazioni attuali, e cosa racconta della linea diretta. Sottolinea che ciascun aplogruppo è UNA sola linea (materna O paterna), distinta dall'ancestralità complessiva (l'affinità di popolazione sopra)
- Limiti dell'analisi: numero di marcatori, differenza tra ancestry genetica e etnicità/nazionalità
- Contesto storico delle migrazioni se rilevante
- Chiarisci che non si tratta di un test di ancestralità certificato
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti`;
  }

  private async buildOverviewPrompt(vcfFileId: string): Promise<string> {
    // Meta-summary built from the per-section AI summaries as-is (not reprocessed),
    // grounded by the aggregate counts. Reuses the existing generateAiSummary path.
    const LABELS: Record<string, string> = {
      diseases: 'Rischio malattie',
      prs: 'Predisposizione poligenica',
      pharma: 'Farmacogenomica',
      carrier: 'Stato di portatore',
      traits: 'Tratti fenotipici',
      ancestry: 'Ancestralità',
    };
    const order = ['diseases', 'prs', 'pharma', 'carrier', 'traits', 'ancestry'];

    const sections = await this.prisma.aiSummary.findMany({
      where: { vcfFileId, type: { in: order } },
    });
    const byType = new Map(sections.map((s) => [s.type, s]));
    const present = order.filter((t) => byType.has(t));
    const missing = order.filter((t) => !byType.has(t));

    if (present.length === 0) {
      throw new Error(
        'Nessun riassunto di sezione disponibile: genera prima i riassunti AI delle singole sezioni.',
      );
    }

    const blocks = present
      .map((t) => {
        const s = byType.get(t)!;
        return `## ${LABELS[t]}\n${s.detail || s.summary}`;
      })
      .join('\n\n');

    const vcf = await this.prisma.vcfFile.findUnique({ where: { id: vcfFileId } });
    const stats = vcf
      ? `Varianti totali: ${vcf.totalVariants.toLocaleString('it-IT')} (SNP ${vcf.snpCount.toLocaleString('it-IT')}, indel ${vcf.indelCount.toLocaleString('it-IT')}).`
      : '';

    const missingNote = missing.length
      ? `\n\nNOTA: mancano i riassunti di queste sezioni (non ancora generati): ${missing.map((t) => LABELS[t]).join(', ')}. Non inventarne il contenuto; eventualmente segnala brevemente che non sono inclusi.`
      : '';

    // Polygenic risk scores: ground the overview when present so the meta-summary
    // can name actual predispositions, percentiles and the calibration caveats.
    const prsRows = await this.prisma.prsResult.findMany({
      where: { vcfFileId },
      orderBy: [{ source: 'asc' }, { traitKey: 'asc' }],
    });
    const prsJson = prsRows.map((p) => ({
      tratto: p.trait,
      label: p.label,
      fonte: p.source,
      pgs_id: p.pgsId,
      raw: p.rawScore,
      z: p.zScore,
      percentile: p.percentile,
      calibrato: p.zScore != null,
      marcatori: `${p.markersUsed}/${p.markersTotal}`,
      interpretation: p.interpretation,
    }));
    // Se esiste gia' il riassunto AI dei PRS (sezione 'prs'), e' incluso sopra tra
    // i blocchi: non ri-passare i dati grezzi per evitare duplicazione. Altrimenti
    // li forniamo come grounding cosi' il sommario puo' comunque citarli.
    const prsBlock = prsRows.length && !present.includes('prs')
      ? `\n\nPRS (Polygenic Risk Scores) calcolati su questo genoma — fai un cenno breve nel sommario se ci sono segnali rilevanti (z >= +1 o <= -1 sui calibrati; raw score >0 con coverage > 90% sui non-calibrati). NON presentarli come diagnosi: sono rischi RELATIVI medi rispetto alla popolazione. Distingui sempre i calibrati (con percentile) dai raw-only (senza, quando il file PGS manca di frequenza allelica):\n${JSON.stringify(prsJson, null, 2)}`
      : '';

    return `Sei un consulente genetico che redige il SOMMARIO GENERALE finale di un referto genomico divulgativo per un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: una sintesi complessiva breve (3-4 frasi) del quadro genomico generale, senza titolo e senza heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Punti chiave, ## Cosa approfondire, ecc.).

Devi SINTETIZZARE i riassunti delle singole sezioni qui sotto (già prodotti, NON rielaborarli nel merito né contraddirli): estrai il quadro d'insieme, i fili conduttori tra sezioni, e ciò che merita attenzione/approfondimento. NON introdurre conclusioni cliniche nuove non supportate dalle sezioni. ${stats}

RIASSUNTI DELLE SEZIONI:
${blocks}${missingNote}${prsBlock}

Concentrati su:
- Una visione d'insieme che colleghi le sezioni (es. una variante a bassa confidenza da confermare, predisposizioni rilevanti, profilo farmacogenetico azionabile, esiti rassicuranti dei pannelli)
- I 3-5 punti più importanti da ricordare o approfondire con un genetista
- Tono equilibrato e non allarmistico; ribadisci che è un referto informativo, non una diagnosi
- IMPORTANTE: usa le lettere accentate italiane (à, è, ì, ò, ù), MAI apostrofi al posto degli accenti`;
  }

  private async buildVariantPrompt(variantId: string): Promise<string> {
    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: {
        diseases: true,
        pharma: true,
        carrier: true,
        ancestry: true,
        traits: true,
        annotations: true,
      },
    });

    if (!variant) throw new Error(`Variant ${variantId} not found`);

    const gene = variant.annotations.find((a) => a.gene)?.gene;
    const carriedAlleles = describeCarriedAlleles(variant.genotype, variant.ref, variant.alt, variant.zygosity);

    // Surface the per-association ClinVar stars + evidence so the AI can weigh
    // 0★ junk against 2-4★ solid evidence, exactly as the diseases prompt does.
    const diseases = variant.diseases.map((d) => ({
      disease: d.disease,
      significance: d.significance,
      source: d.source,
      evidenceLevel: d.evidenceLevel,
      stars: (d.metadata as any)?.stars,
      links: (d.metadata as any)?.links,
    }));
    const pharma = variant.pharma.map((p) => ({
      drug: p.drug,
      effect: p.effect,
      metabolizerStatus: p.metabolizerStatus,
      evidenceLevel: p.evidenceLevel,
    }));
    const carrier = variant.carrier.map((c) => ({
      condition: c.condition,
      inheritancePattern: c.inheritancePattern,
      carrierType: c.carrierType,
      stars: (c.metadata as any)?.stars,
      links: (c.metadata as any)?.links,
    }));
    const populationFrequencies = variant.ancestry.map((a) => ({
      population: a.population,
      // ALT allele frequency in that population (gnomAD)
      altFrequency: a.frequency,
    }));
    const traits = variant.traits.map((t) => ({
      trait: t.trait,
      effect: t.effect,
      category: t.category,
    }));
    // A common variant (>1%) can't be the cause of a rare severe Mendelian disease.
    const maxAltFreq = populationFrequencies.reduce((m, p) => (p.altFrequency != null && p.altFrequency > m ? p.altFrequency : m), 0);
    const commonInPopulation = maxAltFreq >= 0.01;

    const data = {
      gene,
      rsId: variant.rsId,
      coord: `chr${variant.chromosome}:${variant.position}`,
      ref: variant.ref,
      alt: variant.alt,
      sampleGenotype: variant.genotype,
      sampleZygosity: variant.zygosity,
      sampleCarriedAlleles: carriedAlleles,
      callQuality: {
        depth: variant.depth,
        vafAlt: variant.vaf,
        lowConfidence: variant.lowConfidence,
        qual: variant.quality,
      },
      diseases,
      pharma,
      carrier,
      populationFrequencies,
      maxAltFrequencyAnyPopulation: maxAltFreq || null,
      commonInPopulation,
      traits,
    };

    return `Sei un consulente genetico che spiega UNA specifica variante a un programmatore (non medico). Rispondi in italiano e in formato Markdown.

IMPORTANTE: Il tuo output deve essere strutturato così:
1. PRIMO PARAGRAFO: 2-3 frasi su cosa significa LO SPECIFICO genotipo del soggetto a questo sito, senza titolo né heading markdown.
2. Dopo una riga vuota, il DETTAGLIO con heading markdown (## Significato clinico, ## Affidabilità del dato, ecc.).

REGOLA NUMERO 1 — Sii ALLELE-SPECIFICO, non generico:
- Il soggetto porta esattamente: ${carriedAlleles}
- REF=${variant.ref} (allele di riferimento alla coordinata), ALT=${variant.alt} (l'allele a cui le associazioni cliniche di solito si riferiscono)
- Non scrivere "la variante è patogenica": scrivi "carrying ${carriedAlleles} a questo sito significa X".
- Per malattie RECESSIVE conta avere DUE copie dell'allele patogenico; in eterozigote sei portatore sano. Per malattie DOMINANTI o codominanti basta UNA copia. Usa questa logica esplicitamente.

REGOLA NUMERO 2 — Pesa la QUALITÀ del dato, non fidarti dell'etichetta:
- ClinVar stars: 4★ practice guideline (oro), 2-3★ solido, 1★ single submitter (limitato), **0★ no assertion criteria** = singolo collaboratore senza fornire criteri, spesso JUNK. Una PATHOGENIC 0★ va trattata come probabile falso allarme, non come diagnosi.
- callQuality: lowConfidence=${variant.lowConfidence ? 'TRUE — supporto in letture atipico' : 'standard'}, VAF=${variant.vaf != null ? Math.round(variant.vaf * 100) + '%' : 'N/A'}, depth=${variant.depth ?? 'N/A'}. Una VAF molto lontana dalla teorica (50% het, 100% hom) o profondità bassa rende la chiamata stessa dubbia.
- Frequenza popolazione: una variante COMUNE (>1%) NON può essere causale di una malattia mendeliana rara grave — sarebbe epidemiologicamente impossibile. Se commonInPopulation=true e l'etichetta è PATHOGENIC per una rare disease, SEGNALA l'incongruenza.

**Variante**: ${variant.rsId ?? `chr${variant.chromosome}:${variant.position}`} (${variant.ref} → ${variant.alt})
**Gene**: ${gene ?? 'Non annotato'}
**Il soggetto porta**: ${carriedAlleles}
**Qualità chiamata**: depth=${variant.depth ?? 'N/A'}, VAF=${variant.vaf != null ? Math.round(variant.vaf * 100) + '%' : 'N/A'}, lowConfidence=${variant.lowConfidence}

**Dati associati**:
${JSON.stringify(data, null, 2)}

Concentrati su:
- Cosa significa per la salute portare ESATTAMENTE questi alleli in questa zigosità (non generico)
- Per le malattie: incrocia significato + stelle + frequenza + zigosità → distingui segnali solidi, portatori sani, falsi allarmi
- Per la farmacogenomica: come l'allele specifico cambia la risposta ai farmaci elencati
- Per i tratti: l'effetto fenotipico per il dosaggio (1 copia vs 2 copie)
- Quando rilevante segnala discordanze (es. "PATHOGENIC ma 0★ + comune in popolazione → probabile rumore ClinVar")
- IMPORTANTE: usa accenti italiani (à, è, ì, ò, ù), MAI apostrofi

${LINK_GUIDANCE}`;
  }
}

// Render the sample's actual alleles in human terms, given the genotype string
// and the variant's ref/alt — so the AI prompt can talk about "G/G — 2 copie
// dell'alt G" instead of an opaque "1/1".
function describeCarriedAlleles(
  genotype: string | null,
  ref: string,
  alt: string,
  zygosity: string | null,
): string {
  if (!genotype) return 'sconosciuto';
  const parts = genotype.split('/');
  if (parts.length === 1) {
    // chrX in a male, chrY, mtDNA — haploid
    if (parts[0] === '1') return `${alt} (emizigote — 1 copia dell'alt ${alt})`;
    if (parts[0] === '0') return `${ref} (emizigote — 1 copia di riferimento)`;
    return `${parts[0]} (emizigote)`;
  }
  const altCount = parts.filter((p) => p === '1').length;
  const refCount = parts.filter((p) => p === '0').length;
  if (altCount === 2) return `${alt}/${alt} — 2 copie dell'allele ALT ${alt} (omozigote per la variante)`;
  if (refCount === 2) return `${ref}/${ref} — 2 copie di riferimento (genotipo standard)`;
  if (altCount === 1 && refCount === 1) return `${ref}/${alt} — 1 copia di riferimento + 1 copia ALT ${alt} (eterozigote)`;
  // multiallelic fallback (e.g., 1/2)
  return `${genotype} (multi-allelico)` + (zygosity ? ` · ${zygosity}` : '');
}
