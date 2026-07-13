# Database import: CSV → Supabase workflow

Status: active since 2026-07 (database activation PR).

## Principle

The reviewed CSVs under `data/imports/` (plus `data/taxonomy/`, `data/glossary/`,
`data/sources/`, `data/mappings/`) are the canonical, human-reviewed source of
truth. The Supabase Postgres database is a **mirror** of them, used as the
canonical serving store: it is populated only by `npm run data:import`, which is
idempotent (wipe-and-reload in a single transaction) and proves exact parity on
every run. The database is never edited directly and never becomes a second
editing surface — if the database and the CSVs ever disagree, the CSVs win and
the import is re-run.

## What the import loads

| Table | Source file(s) |
| --- | --- |
| `BudgetItem` | `data/taxonomy/revenue-categories.json` + `spending-fields.json`, merged with `data/glossary/category-glossary.csv` (IDs are 1:1) |
| `AdminSpendingCategory` | `data/taxonomy/admin-spending-categories.json` |
| `SourceDocument` | `data/sources/source-documents.csv` |
| `BudgetMapping` | `data/mappings/spending-field-mapping.csv` |
| `BudgetFact` | `data/imports/budget-facts-2005-2025.csv` |
| `AdminSpendingFact` | `data/imports/admin-spending-facts-2005-2025.csv` (admin categories + major-program drill-down rows) |
| `ImportRun` | one audit row per import run, including the full parity report |

The import reuses the same validated loaders the site uses, then cross-checks
referential integrity (fact item IDs against taxonomy, source IDs against
source documents, admin parents against admin categories, natural-key
uniqueness) before touching the database.

## Parity report

Every run prints and stores (in `ImportRun.reportJson` and
`data/reports/db-import-parity.json`):

- row counts per table, database vs CSV;
- budget-fact GEL totals per year/side, database vs CSV;
- admin-spending GEL totals per year/level, database vs CSV.

All comparisons are exact (decimal arithmetic, no floating-point tolerance).
The parity check runs **inside** the import transaction: any mismatch rolls
the whole transaction back — the previous database state stays untouched —
and the run exits non-zero.

## One-time setup

1. Owner creates the Supabase project (paid tier recommended if free-tier
   pausing becomes annoying for rebuilds; visitors are never affected either way).
2. Copy `apps/web/.env.example` to `apps/web/.env` and fill in:
   - `DATABASE_URL` — pooled connection, port 6543, `?pgbouncer=true`;
   - `DIRECT_URL` — direct connection, port 5432.
   Never commit `.env`.
3. From `apps/web`: `npm run prisma:migrate` — creates/applies migrations over
   the direct connection (Prisma 7 CLI reads `DIRECT_URL` via `prisma.config.ts`).
4. From `apps/web`: `npm run data:import` — loads everything and prints the
   parity report.
5. Recommended hardening in Supabase: enable row level security (with no
   policies) on all imported tables, or disable the public Data API — nothing
   in this project reads via PostgREST, and Prisma connects as the table owner,
   so this does not affect the import or builds.

## Serving

- `GEODATA_DATA_SOURCE=db` — pages are rendered at build time from the
  database (`apps/web/lib/data/servedData.ts` → `apps/web/lib/db/servedDataDb.ts`).
  The build additionally verifies the database **row by row** against the
  reviewed CSVs in the same checkout and fails loudly on any difference — a
  stale mirror (CSVs updated without re-running the import), a direct database
  edit, or an import bug can never reach visitors. Production (Vercel) sets
  this plus `DATABASE_URL` as build-time environment variables. No
  `NEXT_PUBLIC_` database variables exist; credentials never reach the client.
- `GEODATA_DATA_SOURCE=csv` or unset — pages are rendered from the CSVs
  directly (dev, CI, and the documented fallback if the database is
  unreachable). Both sources are guaranteed identical by the parity check.

The deployed site is fully static in both modes; database downtime can only
ever delay a rebuild, never take the site down.

## Re-running for a new data year

1. Land the reviewed CSVs as usual (extraction → staging → review → promotion
   into `data/imports/`, with the matching methodology doc).
2. If the data introduced new columns or datasets, reconcile
   `apps/web/prisma/schema.prisma` and create a migration (`npm run
   prisma:migrate`); for data-only updates this step is a no-op.
3. From `apps/web`: `npm run data:import`. Re-running is always safe — the
   import replaces the mirror wholesale inside one transaction.
4. Check the parity report says `Parity status: PASSED`.
5. Redeploy the site (rebuild) so the static pages pick up the new data.

## Failure modes

- Import fails validation or parity → the transaction rolls back; fix the
  data or the schema, re-run. The previous database state (and the live site)
  are unaffected.
- Mirror out of date or edited (CSVs changed without re-running the import,
  or a direct database edit) → the next db-mode build fails its row-level
  verification with a message pointing at `npm run data:import`.
- Database unreachable at build time → the build fails loudly; either resume
  the Supabase project and rebuild, or build with `GEODATA_DATA_SOURCE=csv`.
- Database empty (import never run) → the db-mode build fails with a clear
  message pointing at `npm run data:import`.
