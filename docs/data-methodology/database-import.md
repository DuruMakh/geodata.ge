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
| `MunicipalFunctionCategory` | `data/taxonomy/municipal-functions.json` |
| `MunicipalRegion` | `data/taxonomy/municipal-regions.json` |
| `Municipality` | `data/imports/municipalities.csv` |
| `MunicipalFunctionFact` | `data/imports/municipal-function-facts-2015-2025.csv` |
| `MunicipalTotalFact` | `data/imports/municipal-total-facts-2015-2025.csv` |
| `ImportRun` | one audit row per import run, including the full parity report |

The five municipal tables are wired into the import but **the mirror does not
hold municipal rows yet**: migration `20260802194939_municipal_dataset` has not
been applied and no import has run since the wiring landed. Neither step is a
manual approval gate: `.github/workflows/deploy-production.yml` runs
`npm run prisma:deploy` and then `npm run data:import` unconditionally on every
push-triggered CI-green run on `main`, so merging this work is the decision
point, not a separate sign-off. The operation is safe by construction — one
transaction, parity verified before commit, rollback on any mismatch — and
production keeps serving the previous build if the workflow goes red. Until
that deploy runs, municipal data serves only from the CSVs
(`GEODATA_DATA_SOURCE=csv`, the default). A `GEODATA_DATA_SOURCE=db` build does
**not** fail on the missing tables, because it never queries them: no route
under `app/`, `components/`, or `lib/` calls `loadServedMunicipalData` yet (its
only caller is a test file), so a db-mode build succeeds whether or not the
migration has been applied. Until a route reads it, the in-transaction check
inside `npm run data:import` is the **sole** parity gate for the municipal
tables. See `docs/data-methodology/municipal-functional-annual-2015-2025.md`.

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

Beyond counts and totals, the import re-reads every inserted row **through the
same code path db-mode builds use** and compares it field by field against the
CSV loader output — a mapping bug in any column (labels, notes, dates) fails
the import, not a later build.

All comparisons are exact (decimal arithmetic, no floating-point tolerance).
Both checks run **inside** the import transaction: any mismatch rolls the
whole transaction back — the previous database state stays untouched — and
the run exits non-zero. A run that fails for any reason leaves no report file
behind (the previous run's report is removed at start), so a present
`db-import-parity.json` always describes the current mirror.

## One-time setup

1. Owner creates the Supabase project (paid tier recommended if free-tier
   pausing becomes annoying for rebuilds; visitors are never affected either way).
2. Copy `apps/web/.env.example` to `apps/web/.env` and fill in:
   - `DATABASE_URL` — pooled connection, port 6543, `?pgbouncer=true`;
   - `DIRECT_URL` — session pooler connection, port 5432 (used for
     migrations and the import; see "CI credentials" below).
   Never commit `.env`.
3. From `apps/web`: `npm run prisma:deploy` — applies the committed migrations
   over the direct connection (Prisma 7 CLI reads `DIRECT_URL` via
   `prisma.config.ts`). Always use `prisma:deploy` against the live database;
   `prisma:migrate` (`prisma migrate dev`) is a development command for
   authoring new migrations and may offer to RESET a database whose state
   drifts from the migration history.
4. From `apps/web`: `npm run data:import` — loads everything and prints the
   parity report.
5. Hardening ships as migrations (applied automatically by step 3): row level
   security with no policies on every mirror table and on Prisma's
   `_prisma_migrations` table, so Supabase's public Data API (PostgREST)
   exposes nothing. Prisma connects as the table owner and is unaffected.
   Disabling the Data API entirely in the Supabase dashboard is a fine extra
   step — nothing in this project uses it.

### CI credentials (GitHub Actions)

The deploy pipeline runs the same commands in CI. GitHub-hosted runners are
IPv4-only and Supabase's true direct host (`db.<ref>.supabase.co`) is
IPv6-only, so the `DIRECT_URL` **repository secret** holds the Supabase
**session pooler** string (port 5432, user `postgres.<project-ref>`)
instead — it behaves like a direct connection for migrations and the
import. The local `.env` uses the same session pooler string (the true
direct host is IPv6-only and unused in this project). Secret table:
`docs/deployment.md`.

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
- Row *order* is the one deliberate difference: db mode returns rows in a
  deterministic canonical order that may differ from CSV file order. All UI
  ordering is derived (amounts, sort tokens, years), never file-order-dependent.

The deployed site is fully static in both modes; database downtime can only
ever delay a rebuild, never take the site down.

## Re-running for a new data year

1. Land the reviewed CSVs as usual (extraction → staging → review →
   promotion into `data/imports/`, with the matching methodology doc).
2. If the data introduced new columns or datasets, reconcile
   `apps/web/prisma/schema.prisma` and author the migration in development
   (`npm run prisma:migrate`); commit it with the data change.
3. Merge to `main`. Nothing else is manual: after CI passes,
   `.github/workflows/deploy-production.yml` applies any new migrations
   (`npm run prisma:deploy`), re-runs `npm run data:import` (every
   production deploy converges the mirror to the checkout,
   unconditionally), and triggers the Vercel production build, which
   re-verifies the mirror row-by-row. The parity report is in the workflow
   log.

### Manual fallback (Actions outage or local work)

From `apps/web`, with `.env` configured:

1. `npm run prisma:deploy` (only if there are new migrations).
2. `npm run data:import`; check the report says `Parity status: PASSED`.
3. Redeploy the site (`vercel deploy --prod` from the repo root, or rerun
   the *Deploy production* workflow once Actions is back).

## Failure modes

- Import fails inside the deploy pipeline → the *Deploy production* workflow
  goes red and no deploy is triggered; production keeps serving the
  previous build. Fix and rerun from the Actions tab.
- Import fails validation or parity → the transaction rolls back; fix the
  data or the schema, re-run. The previous database state (and the live site)
  are unaffected.
- Mirror out of date or edited (CSVs changed without re-running the import,
  or a direct database edit) → for budget and admin-spending data, the next
  db-mode build fails its row-level verification with a message pointing at
  `npm run data:import`. Municipal data is the exception:
  `assertMunicipalParity` is reachable only from `loadServedMunicipalData`,
  which no route calls yet, so a db-mode build never runs it —
  `npm run data:import`'s in-transaction check is the only parity gate for
  the municipal tables until a route reads them.
- Database unreachable at build time → the build fails loudly; either resume
  the Supabase project and rebuild, or build with `GEODATA_DATA_SOURCE=csv`.
- Database empty (import never run) → the db-mode build fails with a clear
  message pointing at `npm run data:import`.

## Creating a migration: `prisma migrate dev` does not work here

`prisma migrate dev` — including `--create-only` — fails on this project with
**P3006**. It is not a sign the database is broken.

Cause: migration `20260714010000_enable_rls_on_prisma_migrations` puts row
level security on the `_prisma_migrations` table. `migrate dev` bootstraps a
shadow database by replaying every migration into it, and that replay breaks
against the Supabase pooler once RLS covers the bookkeeping table. Any future
`migrate dev` on this project will hit it.

Create new migrations with Prisma's documented patching pattern instead, which
is read-only:

```bash
npx prisma migrate diff --from-config-datasource --to-schema-datamodel prisma/schema.prisma --script > migration.sql
```

Then place the SQL in a `prisma/migrations/<timestamp>_<name>/migration.sql`
folder by hand, and add `ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY;` for
every new table — the generator does not emit RLS, and every mirror table here
carries it.

**Verifying that workaround — `migrate status` is not enough.** `--from-config-datasource`
diffs against the *live database*, not against migration history, so live drift
would be silently baked into the generated SQL. `prisma migrate status` does
not rule that out: it compares migration-table bookkeeping only. Structural
drift detection is a `migrate dev` feature — the very thing that fails here.
Verify instead by either:

- confirming the generated SQL contains **zero statements referencing any
  pre-existing table or enum** (a clean delta touches only the new objects); or
- running `prisma db pull` into a scratch schema file and diffing it against
  the committed models.

Production is unaffected by all of this: deploys run `prisma migrate deploy`,
which never uses a shadow database, so P3006 is not in the production path.
