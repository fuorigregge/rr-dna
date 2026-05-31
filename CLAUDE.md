# rr-dna

Piattaforma di analisi genomica VCF. Monorepo pnpm + Turborepo.

## Architettura

```
apps/
  web/        → Frontend React (TanStack Router, React Query, Recharts, Tailwind, Sonner)
  server/     → Backend NestJS (Apollo GraphQL, Prisma, BullMQ)
  dna-worker/ → Worker Python (FastAPI, cyvcf2, BullMQ, psycopg)
```

- **DB**: PostgreSQL 16 (Prisma ORM lato server, psycopg raw SQL lato worker)
- **Queue**: Redis 7 + BullMQ (coda `vcf`)
- **Docker**: `docker-compose.yml` per postgres, redis, dna-worker

## Comandi

```bash
# Dev
pnpm install              # installa dipendenze
pnpm dev                  # avvia tutti i servizi (turbo)
docker compose up -d      # avvia postgres, redis, dna-worker

# Database
cd apps/server && npx prisma db push    # sync schema → DB
cd apps/server && npx prisma generate   # genera client
cd apps/server && npx prisma studio     # GUI DB

# Worker
docker compose build dna-worker         # rebuild dopo modifiche
docker compose logs dna-worker -f       # log worker

# Test
cd apps/dna-worker && pytest            # test worker Python
```

## Flusso dati

1. Upload VCF → `POST /api/vcf/upload` (NestJS) → salva file, crea `VcfFile`, enqueue `vcf:parse`
2. Worker processa job → parsing con cyvcf2 → insert `Variant` + `ChromosomeSummary`
3. Annotazione automatica → reference DB locale → popola `DiseaseRisk`, `Pharmacogenomics`, `CarrierStatus`, `AncestryMarker`, `PhenotypeTrait`
4. Frontend query via GraphQL → pagine analisi

## Convenzioni

- **Lingua UI**: italiano
- **Mutation feedback**: usare `useMutationWithToast` da `@/lib/use-mutation-with-toast` (mai mutation silenziose)
- **GraphQL types**: i resolver NestJS usano mix di `ID` e `String` per `vcfFileId`:
  - `dashboard`, `chromosomes`: `{ type: () => ID }` → frontend usa `$vcfFileId: ID!`
  - tutti gli altri (diseases, pharma, carrier, ecc.): default → frontend usa `$vcfFileId: String!`
- **Grafici**: usare recharts (installato)
- **Toast**: Sonner con `theme="dark"` e `position="bottom-right"`

## Porte

| Servizio    | Porta |
|-------------|-------|
| Frontend    | 5173  |
| Server      | 3060  |
| Worker API  | 8000  |
| PostgreSQL  | 5432  |
| Redis       | 6379  |

## Variabili ambiente

- `DATABASE_URL`: connection string PostgreSQL (server `.env` e worker Docker env)
- `REDIS_URL`: connection string Redis (worker Docker env)
- `UPLOAD_DIR`: directory upload file (default `./uploads` relativo al server)
