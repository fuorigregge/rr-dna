# rr-dna

Piattaforma di analisi genomica personale da file VCF. Monorepo pnpm + Turborepo.

## Cosa fa

Carica un file VCF (es. da 23andMe, WES, WGS) e ottieni:

- **Rischio Malattie** — varianti classificate per significatività clinica (ACMG/ClinVar)
- **Farmacogenomica** — interazioni farmaco-gene con stato metabolizzatore
- **Carrier Status** — stato di portatore per condizioni recessive/X-linked
- **Ancestry** — affinità ancestrale per 8+ popolazioni (gnomAD v4)
- **Tratti Fenotipici** — tratti metabolici, fisici e cognitivi
- **Riassunti AI** — analisi in linguaggio naturale generate da Claude

## Architettura

```
apps/
  web/        → Frontend React (TanStack Router, React Query, Recharts, Tailwind)
  server/     → Backend NestJS (Apollo GraphQL, Prisma, BullMQ)
  dna-worker/ → Worker Python (FastAPI, cyvcf2, BullMQ, psycopg)

packages/
  claude-ai/  → Wrapper per Claude CLI (askClaude via subscription)
  tsconfig/   → Configurazione TypeScript condivisa
  eslint-config/ → Configurazione ESLint condivisa
```

### Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 19, TanStack Router, React Query, Recharts, Tailwind CSS, Sonner |
| Backend | NestJS, Apollo GraphQL (code-first), Prisma ORM |
| Worker | Python 3.12, FastAPI, cyvcf2, BullMQ |
| Database | PostgreSQL 16 |
| Queue | Redis 7 + BullMQ |
| AI | Claude CLI (`claude -p`) via `@rr-dna/claude-ai` |

## Quick Start

### Prerequisiti

- Node.js >= 20
- pnpm 9+
- Python 3.12+
- Docker (per PostgreSQL e Redis)
- Claude CLI (`claude`) installato e autenticato

### Setup

```bash
# Clona e installa
git clone <repo-url> && cd rr-dna
pnpm install

# Avvia PostgreSQL e Redis
docker compose up -d

# Inizializza il database
cd apps/server && npx prisma db push

# Avvia tutti i servizi
pnpm dev
```

Il frontend sarà su `http://localhost:5173`.

### Worker Python (separato)

```bash
cd apps/dna-worker
pip install .
python -m src.main
```

Al primo avvio, il worker scarica e costruisce automaticamente il database ClinVar (~5 min).

## Flusso dati

```
Upload VCF → POST /api/vcf/upload (NestJS)
  → salva file, crea VcfFile, enqueue vcf:parse (BullMQ)

Worker Python processa il job:
  → parsing VCF con cyvcf2 → Variant + ChromosomeSummary
  → annotazione automatica da reference DB locale:
    - ClinVar → DiseaseRisk, CarrierStatus
    - PharmGKB → Pharmacogenomics
    - ClinVar/PharmGKB → PhenotypeTrait
    - gnomAD (opzionale) → AncestryMarker (8 popolazioni)

Frontend → GraphQL queries → pagine di analisi
  → Riassunti AI (opzionale) → Claude CLI → AiSummary
```

## Ancestry avanzata (gnomAD)

Durante l'upload del VCF puoi selezionare "Ancestry avanzata (gnomAD)":

- **Primo utilizzo**: scarica gnomAD v4 exome sites (~20 GB, elaborati per cromosoma, ~30-60 min)
- **Successivi**: usa la cache locale (`ancestry_gnomad_db.json.gz`, ~30-60 MB)
- **Popolazioni**: African, East Asian, South Asian, European (non-Finnish), Finnish, Ashkenazi Jewish, Latino/Admixed American, Middle Eastern

## Riassunti AI

Ogni pagina di analisi ha un bottone "Riassunto AI" che:

1. Chiede conferma
2. Raccoglie i dati della pagina
3. Chiama `claude -p` con un prompt specializzato
4. Salva il risultato (Markdown) nel database
5. Mostra un riassunto breve + drawer con analisi dettagliata

Richiede Claude CLI installato e autenticato (`claude login`).

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
pnpm dev                              # avvia tutto (turbo)
pnpm lint                             # lint tutti i pacchetti
docker compose up -d                  # postgres + redis

cd apps/server && npx prisma studio   # GUI database
cd apps/server && npx prisma db push  # sync schema

cd apps/dna-worker && pytest          # test worker Python
```
