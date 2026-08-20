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
| `BudgetFact` | `data/imports/budget-facts-2004-2025.csv` (expenditure 2004–2025; revenue 2005–2025) |
| `AdminSpendingFact` | `data/imports/admin-spending-facts-2004-2025.csv` (admin categories + major-program drill-down rows) |
| `NationalGdpFact` | `data/imports/national-gdp-annual-1996-2025.csv` (one reviewed nominal-GDP denominator per year) |
| `MunicipalFunctionCategory` | `data/taxonomy/municipal-functions.json` |
| `MunicipalRegion` | `data/taxonomy/municipal-regions.json` |
| `Municipality` | `data/imports/municipalities.csv` |
| `MunicipalFunctionFact` | `data/imports/municipal-function-facts-2015-2025.csv` |
| `MunicipalTotalFact` | `data/imports/municipal-total-facts-2015-2025.csv` |
| `MunicipalPopulationFact` | `data/imports/municipal-population-2025.csv` (exactly one reviewed 2025 denominator for each of 64 public municipalities) |
| `ImportRun` | one audit row per import run, including the full parity report |

### Municipal activation status (2026-08-06)

The municipal taxonomy, registry, budget-fact, and population tables, migrations `20260802194939_municipal_dataset` and `20260818000000_municipal_population_2025`,
transactional mirror import, and field-by-field import parity checks shipped in
the earlier data-only rollout; migration and import are not pending. The
Actions-owned production workflow continues to run `npm run prisma:deploy`
and then `npm run data:import` unconditionally on every CI-gated workflow run,
reconverging the mirror to the reviewed CSVs before it triggers Vercel. Manual
Vercel dashboard or CLI deployments do not run those Actions steps; see
`docs/deployment.md`.

That earlier rollout had no municipal UI route, so its db-mode build never
called `loadServedMunicipalData()` and did not exercise build-time municipal
row parity. The current branch implements the municipal index, 64 municipality
routes, and 11 region routes, all through `loadServedMunicipalData()`; a db-mode
build of this code therefore queries the municipal tables and runs
`assertMunicipalParity`. This is a statement about the branch code, not proof
that the UI is deployed: direct production route checks returned HTTP 404 on
2026-08-06, while hosted GitHub/remote-main metadata and the live database
contents could not be freshly authenticated from this workspace. See
`docs/data-methodology/municipal-functional-annual-2015-2025.md`.

The import reuses the same validated loaders the site uses, then cross-checks
referential integrity (fact item IDs against taxonomy, source IDs against
source documents, admin parents against admin categories, natural-key
uniqueness) before touching the database.

Inside the same transaction, population rows are deleted before their municipality and source parents, then recreated only after those parents exist. Every row carries the active `ImportRun` ID. The importer reads all 64 rows back through the db-mode loader and requires exact natural-key and field parity with the reviewed CSV before commit. A population count, value, provenance, or date mismatch therefore rolls back the entire import together with the other mirrored datasets; the previous mirror remains intact.

## Parity report

Every run prints and stores (in `ImportRun.reportJson` and
`data/reports/db-import-parity.json`):

- row counts per table, database vs CSV;
- budget-fact GEL totals per year/side, database vs CSV;
- admin-spending GEL totals per year/level, database vs CSV.

Beyond counts and totals, including the `NationalGdpFact` and `MunicipalPopulationFact` row counts, the import re-reads every inserted row **through the
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
   `prisma.config.ts`). Always use `prisma:deploy` against the live database.
   Never point `prisma:migrate` (`prisma migrate dev`) at it: it is an
   authoring command that may offer to RESET a database whose state drifts
   from the migration history — and on this project it does not work at all
   (P3006; see "Creating a migration" below).
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
   `apps/web/prisma/schema.prisma` and author the migration; commit it with
   the data change. **Do not use `npm run prisma:migrate`** — `prisma migrate
   dev` fails on this project with P3006. See "Creating a migration" below
   for why and for the read-only command to use instead.
3. Merge to `main`. Nothing else is manual: after CI passes,
   `.github/workflows/deploy-production.yml` applies any new migrations
   (`npm run prisma:deploy`), re-runs `npm run data:import` (every
   Actions-owned production workflow run converges the mirror to the checkout,
   unconditionally), and triggers the Vercel production build, which
   re-verifies the mirror row-by-row for every table a route reads — see the
   three tiers under "Failure modes". The parity report is in the workflow
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
  or a direct database edit) → the next db-mode build fails its row-level
  verification with a message pointing at `npm run data:import` — but only
  for the tables a route actually reads. Three tiers, and the tier is decided
  by whether a page loads the data, not by how important the table looks:
  - **`BudgetFact`, `BudgetItem`, `SourceDocument`, `AdminSpendingFact`,
    `AdminSpendingCategory`** — read by `loadServedLandingData` /
    `loadServedExplorerData`, which every route calls. Verified field by field
    at import *and* on every db-mode build. This is the tier the sentence
    above describes.
  - **`NationalGdpFact`** — read by `loadServedExplorerData` and verified field by field at import and whenever the national explorer routes build in db mode.
  - **The municipal tables, including `MunicipalPopulationFact`** — verified field by field at import. The
    earlier data-only deployment had no route that called
    `loadServedMunicipalData`, so its db-mode build did not run
    `assertMunicipalParity`. The current branch's municipal index,
    municipality, and region routes do call that loader, so db-mode builds of
    this code verify the municipal rows at build time as well.
  - **`BudgetMapping`** — the weakest tier, and it predates the municipal
    work. No reader anywhere under `app/`, `components/` or `lib/`, and the
    import checks only its **row count** (`tx.budgetMapping.count()`), never
    its field values. A corrupted mapping row would pass both the import and
    every build. Low impact today — it is an audit table, and served
    `BudgetFact` rows already carry their resolved `publicSpendingFieldId`
    from the CSV pipeline, so nothing a visitor sees depends on it — but do
    not read the first tier as covering it.
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
