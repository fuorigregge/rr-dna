# rr-dna

Piattaforma di analisi genomica personale da file VCF. Monorepo pnpm + Turborepo.

Carichi un VCF (WGS/WES, o anche array tipo 23andMe) e ottieni un'analisi clinica
completa — rischio malattie, farmacogenomica, stato di portatore, predisposizione
poligenica, ancestry e tratti — con particolare cura nel **distinguere i reperti
solidi dai falsi positivi**, più riassunti AI e un referto PDF.

> ⚠️ Strumento informativo/educativo, **non** un dispositivo medico. Non sostituisce
> una consulenza genetica professionale. I dati genomici sono sensibili: vedi
> [Privacy](#privacy).

## Cosa fa

- **Rischio Malattie** — varianti classificate per significatività clinica (ClinVar),
  con verdetto di attendibilità: i probabili **falsi positivi** sono separati e
  motivati (vedi [Rigore scientifico](#rigore-scientifico)).
- **Pannello varianti azionabili (ACMG SF)** — verdetto certo (portata / non portata)
  per i geni ad alto impatto (BRCA1/2, TP53, LDLR, trombofilia, varianti mitocondriali…).
- **Farmacogenomica** — diplotipi star-allele (modello CPIC) con fenotipo metabolizzatore.
- **Stato di portatore** — pannello di screening curato (CFTR, HBB, Gaucher…) **più**
  i portatori di malattie recessive derivati dai reperti ClinVar, classificati per
  ereditarietà (un eterozigote patogenico in un gene recessivo = portatore sano).
- **Predisposizione poligenica (PRS)** — score dal PGS Catalog, **calibrati
  empiricamente** sui 503 europei del 1000 Genomes (non Hardy-Weinberg).
- **Ancestry** — best-fit a verosimiglianza per 8 popolazioni (gnomAD v4) +
  **aplogruppi diretti** materno (mtDNA) e paterno (cromosoma Y) con cenni di storia.
- **Tratti Fenotipici** — tratti metabolici, fisici e cognitivi; pannello con verdetto
  esplicito anche sui genotipi standard.
- **Referto PDF** — documento unico per area, con i falsi positivi segnalati, le note
  metodologiche e i riassunti AI.
- **Riassunti AI** — analisi in linguaggio naturale generate da Claude, ancorate ai dati.
- **Note personali** — campo libero per annotazioni/link sulla singola variante.

## Rigore scientifico

Il valore del progetto è soprattutto nel ridurre i falsi allarmi tipici delle
annotazioni cliniche grezze:

- **Filtro frequenza (ACMG BS1)** — una variante "patogenica" troppo comune nella
  popolazione (frequenza gnomAD elevata) non può causare una malattia rara: viene
  declassata a probabile polimorfismo, con la frequenza mostrata. La logica distingue
  i polimorfismi comuni dai veri patogenici comuni a penetranza ridotta (HFE, Factor V).
- **Confidenza della chiamata** — VAF e profondità per ogni variante: un eterozigote
  con VAF molto diversa dal ~50% atteso è segnalato come chiamata dubbia (artefatto o
  mosaicismo), indipendentemente dal rating ClinVar.
- **Review status ClinVar (stelle)** — le annotazioni 0★ (nessun criterio di
  assertione) sono trattate come possibili falsi allarmi, non come diagnosi.
- **Calibrazione PRS empirica** — media e SD di riferimento ricavate scoreando i 503
  sample EUR del 1000 Genomes, così i percentili catturano il linkage disequilibrium
  reale (che il modello Hardy-Weinberg ignora). Direzione corretta anche per i tratti
  "protettivi" (es. densità ossea, dove il valore basso è quello sfavorevole).

## Architettura

```
apps/
  web/        → Frontend React (TanStack Router, React Query, Recharts, Tailwind)
  server/     → Backend NestJS (Apollo GraphQL, Prisma, BullMQ)
  dna-worker/ → Worker Python (FastAPI, cyvcf2, BullMQ, psycopg)

packages/
  claude-ai/     → Wrapper per Claude CLI (askClaude)
  tsconfig/      → Configurazione TypeScript condivisa
  eslint-config/ → Configurazione ESLint condivisa
```

### Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 19, TanStack Router, React Query, Recharts, Tailwind CSS, Sonner |
| Backend | NestJS, Apollo GraphQL (code-first), Prisma ORM |
| Worker | Python ≥3.12 (gestito con `uv`), FastAPI, cyvcf2, BullMQ |
| Database | PostgreSQL 16 |
| Queue | Redis 7 + BullMQ |
| AI | Claude CLI (`claude -p`) via `@rr-dna/claude-ai` |

## Quick Start

### Prerequisiti

- Node.js ≥ 20 e pnpm 9+
- Python ≥ 3.12 e [`uv`](https://docs.astral.sh/uv/)
- Docker (per PostgreSQL e Redis)
- Claude CLI (`claude`) installato e autenticato (per i riassunti AI; opzionale)
- `bcftools` (per i subset gnomAD/1000G, se usi le feature di calibrazione/ancestry avanzata)

### Setup

```bash
# Clona e installa
git clone https://github.com/fuorigregge/rr-dna && cd rr-dna
pnpm install

# Avvia PostgreSQL e Redis
docker compose up -d

# Inizializza il database
cd apps/server && npx prisma db push && cd ../..

# Avvia tutti i servizi (web + server)
pnpm dev
```

Il frontend sarà su `http://localhost:5173`.

### Worker Python

Il worker gira separato e usa `uv`:

```bash
cd apps/dna-worker
uv sync                 # crea il venv e installa le dipendenze
uv run python -m src.main
```

Al primo avvio scarica e costruisce automaticamente il database di riferimento
(ClinVar, ~5 min) e gli artefatti dei pannelli.

## Flusso dati

```
Upload VCF → POST /api/vcf/upload (NestJS)
  → salva file, crea VcfFile, enqueue vcf:parse (BullMQ)

Worker Python processa il job:
  → parsing VCF con cyvcf2 → Variant + ChromosomeSummary
  → confidenza della chiamata (VAF/profondità) per ogni variante
  → annotazione dal reference DB locale:
    - ClinVar → DiseaseRisk (+ frequenza gnomAD per il test BS1), CarrierStatus
    - PharmGKB → Pharmacogenomics
    - ClinVar/PharmGKB → PhenotypeTrait
    - gnomAD (opzionale) → AncestryMarker (8 popolazioni)
  → pannelli curati (ACMG, carrier, tratti, farmaco) + PRS (PGS Catalog)
  → aplogruppi mtDNA/Y (HaploGrep / yhaplo)

Frontend → GraphQL queries → pagine di analisi + referto PDF
  → Riassunti AI (opzionale) → Claude CLI → AiSummary
```

## Dati di riferimento (scaricati, non nel repo)

Alcune feature richiedono dataset pubblici che il worker scarica al bisogno (sono
gitignorati; nel repo c'è solo `pgs_reference.json`, le distribuzioni di popolazione):

- **ClinVar** — annotazione clinica (build automatica al primo avvio).
- **gnomAD v4 exomes** — frequenze allelica per il filtro ACMG BS1 (slim per cromosoma).
- **1000 Genomes EUR** — calibrazione empirica dei PRS.
- **GRCh38 FASTA** + **PGS Catalog** — risoluzione ref-block e scoring poligenico.

## Porte

| Servizio | Porta |
|----------|-------|
| Frontend | 5173 |
| Server | 3060 |
| Worker API | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Comandi utili

```bash
pnpm dev                              # avvia web + server (turbo)
pnpm lint                             # lint di tutti i pacchetti
docker compose up -d                  # postgres + redis

cd apps/server && npx prisma studio   # GUI database
cd apps/server && npx prisma db push  # sync schema
cd apps/server && npx vitest run      # test server

cd apps/dna-worker && uv run pytest   # test worker Python
```

## Privacy

I dati genomici personali **non** vanno nel repo e sono gitignorati: i VCF caricati
(`apps/server/uploads/`), i dataset di riferimento scaricati (`apps/dna-worker/src/data/{genome,gnomad}`)
e il volume PostgreSQL (`pgdata/`). L'analisi vive solo nel database locale. Solo dati
di popolazione pubblici (es. `pgs_reference.json`, frequenze gnomAD/pharmGKB) sono versionati.

## Licenza

Vedi `LICENSE` (se presente). Strumento a scopo informativo ed educativo, non clinico.
