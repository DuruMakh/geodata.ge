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

The complete replacement and its parity checks share a five-minute transaction
limit; opening that transaction has a separate 30-second wait limit. Exceeding
either limit fails the import. Validation and exact row parity remain inside the
same all-or-nothing transaction, and a failure preserves the previous mirror.

## What the import loads

Unemployment uses the existing single import transaction. Source IDs retain their original research identity in each observation; the source-register relation adds the required `source.` prefix. The importer validates all observations and registered references before opening the transaction, deletes unemployment children before source parents, creates rows with the active run ID and reloads them through the serving mapper. Exact field/value parity must pass before commit. Both numeric fields use Decimal(40,20), and displayed values preserve one-decimal precision. The private table has row-level security enabled and grants no access to `anon` or `authenticated`. Local verification covers schema generation, mapping and rejection of missing/mismatched rows; applying the migration and importing a live mirror requires delivery authorization.

| Table | Source file(s) |
| --- | --- |
| `BudgetItem` | `data/taxonomy/revenue-categories.json` + `spending-fields.json`, merged with `data/glossary/category-glossary.csv` (IDs are 1:1) |
| `AdminSpendingCategory` | `data/taxonomy/admin-spending-categories.json` |
| `SourceDocument` | `data/sources/source-documents.csv` |
| `BudgetFact` | `data/imports/budget-facts-2004-2025.csv` (expenditure and revenue 2004–2025; 2004 revenue omits unavailable liabilities) |
| `AdminSpendingFact` | `data/imports/admin-spending-facts-2004-2025.csv` (admin categories + major-program drill-down rows) |
| `GdpOverviewFact` | `data/imports/gdp-overview-annual.csv` (251 reviewed GDP observations; decimal values and complete provenance) |
| `EconomicSectorFact` | `data/imports/economic-sectors-annual.csv` (national A–T activities and GDP reference; exact decimals, measure and provenance; migration `20260912000000_economic_sectors`) |
| `UnemploymentFact` | `data/imports/unemployment-annual.csv`, `unemployment-education-annual.csv`, `unemployment-long-term-annual.csv` and `unemployment-employment-status-annual.csv` (3,370 annual survey observations; see `unemployment-annual.md`; exact values and published precision; migration `20261004102845_unemployment`) |
| `RegionalEconomyFact` | `data/imports/regional-economies-annual.csv` (11 regions, total GDP plus A–T activities, nominal GEL and regional-GDP share; 6,930 exact-decimal rows; migration `20260913000000_regional_economies`) |
| `DemographyFact` | `data/imports/demography-population-annual.csv`, `data/imports/demography-density-annual.csv`, `data/imports/demography-migration-annual.csv`, `data/imports/demography-vital-annual.csv` and `data/imports/demography-fertility-age-annual.csv`, `data/imports/demography-structure-annual.csv` and `data/imports/demography-census-2024-population.csv` (1 January population: Georgia 2004–2026, 11 regions and 64 municipalities 2015–2026, 923 rows; density: Georgia 2014–2026 and the regions 2015–2026, 145 rows; migration: Georgia 2012–2025 by citizenship, sex and net, 1,778 rows, all `border_police`, mirrored whole, of which the Migration page reads 518; vital events: births, deaths and natural increase for Georgia, the 11 regions and 64 municipalities by year, plus Georgia-only total fertility rate, life expectancy, crude birth and death rates and infant mortality, 2,595 rows, and age-specific fertility rates: Georgia 2014–2025 by age of mother, 84 rows, both mirrored whole with basis `registered`; population by age and sex: Georgia 1 January 2004–2026, 1,587 rows (1,380 by age and sex, 207 age bands), and the 2024 census: Georgia, the 11 regions and 64 municipalities counted on 14 November 2024, 2,628 rows (1,944 by age, 684 by settlement) with basis `census_count`, both mirrored whole; 9,740 rows in all; exact decimals; a dimension a file lacks is stored as an empty string; migration `20261008100000_demography`) |
| `InflationCpiFact` | `data/imports/cpi-national-monthly.csv` (Geostat national CPI: headline index, y/y, m/m, 12-month average; core and core excluding tobacco y/y and m/m; generated by `npm run data:prepare-inflation`; migration `20260912000000_inflation_cpi`) |
| `InflationTarget` | `data/imports/nbg-inflation-target.csv` (hand-reviewed NBG inflation target path; migration `20260912000000_inflation_cpi`) |
| `InflationCategoryFact` | `data/imports/cpi-categories-monthly.csv` (COICOP divisions and subgroups, y/y and m/m; 27,668 rows, the largest table here; generated by `npm run data:prepare-inflation`; migration `20260913000000_inflation_categories`) |
| `InflationBasketWeight` | `data/imports/cpi-basket-weights.csv` (annual Geostat consumer-basket weights per category, 2012 onward; migration `20260913000000_inflation_categories`) |
| `InflationCityFact` | `data/imports/cpi-cities-monthly.csv` (six Geostat price-collection cities from 2016-01: Total and 12 COICOP divisions y/y and m/m, Total 12-month average; 20,570 rows; generated by `npm run data:prepare-inflation`; migration `20261001000000_inflation_cities`) |
| `InflationProduct` | `data/imports/cpi-products.csv` (the product catalogue; see `inflation-products.md`) |
| `InflationProductFact` | `data/imports/cpi-products-monthly.csv` (monthly product price indices; see `inflation-products.md`) |
| `MoneyBanksFact` | `data/imports/money-banks-annual.csv` (see `money-banks-annual.md`) |
| `WagesFact` | `data/imports/wages-annual.csv` (see `wages-annual.md`) |
| `HouseholdIncomeSpendingFact` | `data/imports/household-income-spending-annual.csv` (see `household-income-spending-annual.md`) |
| `PovertyFact` | `data/imports/poverty-annual.csv` (see `poverty-annual.md`) |
| `TradeOverviewFact` | `data/imports/trade-overview-annual.csv` (see `trade-annual.md`) |
| `TradePartnerEntity` | `data/taxonomy/trade-partners.json`, English names from `data/localization/en/labels.json` (see `trade-annual.md`) |
| `TradePartnerFact` | `data/imports/trade-partners-annual.csv` (see `trade-annual.md`) |
| `TradeProductEntity` | `data/imports/trade-products-catalogue.csv` (see `trade-annual.md`) |
| `TradeProductFact` | `data/imports/trade-products-annual.csv` (see `trade-annual.md`) |
| `TradeDomesticEntity` | `data/taxonomy/trade-domestic.json` (see `trade-annual.md`) |
| `TradeDomesticFact` | `data/imports/trade-domestic-annual.csv` (see `trade-annual.md` and the Domestic exports mirror below) |
| `TradeServiceEntity` | `data/taxonomy/trade-services.json`, English names from `data/localization/en/labels.json` (see `trade-annual.md`) |
| `TradeServiceFact` | `data/imports/trade-services-annual.csv` (see `trade-annual.md`) |
| `MoneyTransferEntity` | `data/taxonomy/money-transfer-countries.json`, English names from `data/localization/en/labels.json` (see `external-flows-annual.md`) |
| `MoneyTransferFact` | `data/imports/money-transfers-annual.csv` (see `external-flows-annual.md`) |
| `ForeignInvestmentEntity` | `data/taxonomy/foreign-investment.json`, English names from `data/localization/en/labels.json` (see `external-flows-annual.md`) |
| `ForeignInvestmentFact` | `data/imports/foreign-investment-annual.csv` (see `external-flows-annual.md`) |
| `CurrentAccountFact` | `data/imports/current-account-annual.csv` (see `external-flows-annual.md`) |
| `EnergyFoodFact` | `data/imports/energy-food-annual.csv` (see `energy-food-annual.md`) |
| `NationalGdpFact` | `data/imports/national-gdp-annual-1996-2025.csv` (one reviewed nominal-GDP denominator per year) |
| `GovernmentDebtFact` | `data/imports/government-debt-facts-2013-2030.csv` (nine public Government Debt series; generated from the approved normalized debt package) |
| `GeneralGovernmentBalanceFact` | `data/imports/general-government-balance-annual-1995-2031.csv` (IMF general-government balance as percent of GDP and nominal GEL, with actual/projection status) |
| `MunicipalFunctionCategory` | `data/taxonomy/municipal-functions.json` |
| `MunicipalRegion` | `data/taxonomy/municipal-regions.json` |
| `Municipality` | `data/imports/municipalities.csv` |
| `MunicipalFunctionFact` | `data/imports/municipal-function-facts-2015-2025.csv` |
| `MunicipalTotalFact` | `data/imports/municipal-total-facts-2015-2025.csv` |
| `MunicipalPopulationFact` | `data/imports/municipal-population-2025.csv` (exactly one reviewed 2025 denominator for each of 64 public municipalities) |
| `MunicipalCountryFunctionFact` | `data/imports/municipal-georgia-function-facts-2015-2025.csv` (the Georgia aggregate's function rows; see `municipal-functional-annual-2015-2025.md`) |
| `MunicipalCountryTotalFact` | `data/imports/municipal-georgia-total-facts-2015-2025.csv` (the Georgia aggregate's totals; see `municipal-functional-annual-2015-2025.md`) |
| `MunicipalAdjaraBudgetAdjustment` | `data/imports/municipal-adjara-budget-adjustments-2015-2025.csv` (Adjara republican payments net of transfers; see `municipal-functional-annual-2015-2025.md`) |
| `ImportRun` | one audit row per import run, including the full parity report |
| `TradeCompositionEntity` | `data/taxonomy/trade-composition.json` (17 accepted SITC/BEC category identities) |
| `TradeCompositionFact` | `data/imports/trade-composition-annual.csv` (884 original exports/imports observations, 2000–2025; exact decimals and complete provenance) |

The sector and inflation migrations retain their separate directory names despite
sharing the `20260912000000` timestamp. Both are required. Their datasets keep
independent loaders and row-count and field-by-field parity checks inside the
same import transaction.

The regional economy mirror follows the same rule. The importer validates all 6,930 canonical rows and their registered source IDs before opening the transaction, replaces `RegionalEconomyFact` before source parents, recreates the rows with the active import-run ID, reads them back through the db-mode serving mapper and compares every field and exact decimal before commit. A missing row, changed value, source mismatch or mapping defect rolls back the complete import; regional tax/subsidy reconciliation rows remain validation evidence and are not stored as public facts.

The demography mirror follows the same rule. The importer validates all 9,740 served rows and their registered source IDs before opening the transaction, replaces `DemographyFact` before source parents, recreates the rows with the active import-run ID, reads them back through the db-mode serving mapper and compares every field and exact decimal before commit. Later demography pages add their canonical files to the served list and rows to this table; the schema does not change.

### Municipal tables

The municipal taxonomy, registry, budget-fact, Georgia-aggregate and population tables (migrations `20260802194939_municipal_dataset`, `20260814000000_municipal_country_aggregate` and `20260818000000_municipal_population_2025`) are mirrored by the same transactional import. The municipal pages shipped in 2026-08 (PR #38); they read these tables through `loadServedMunicipalData()`, so a db-mode build runs `assertMunicipalParity`. See `docs/data-methodology/municipal-functional-annual-2015-2025.md`.

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

Beyond counts and totals, including the `NationalGdpFact`, `GovernmentDebtFact`, `GeneralGovernmentBalanceFact`, and `MunicipalPopulationFact` row counts, the import re-reads every inserted row **through the
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

### How often a dataset loads

`resolveServedDataSource()` in `apps/web/lib/data/servedDataSource.ts` is the
only reader of `GEODATA_DATA_SOURCE`. It accepts `csv` (the default) and `db`
and throws `GEODATA_DATA_SOURCE must be "db" or "csv", got "<raw>"` on anything
else. It lives in its own module so the loaders `servedData.ts` re-exports can
read the mode without closing an import cycle.

Every served loader is memoised per process — `loadServedGovernmentDebtData`,
`loadServedGeneralGovernmentBalanceData`, `loadServedGdpOverviewData`,
`loadServedEconomicSectorsData`, `loadServedRegionalEconomyData` and
`loadServedInflationData`. Each builds once and hands the same promise to later
callers, so a build parses each dataset once and, in db mode, runs each parity
check once, instead of once per route. A rejection is cached too: the first
parity failure is the build failure.

Two consequences for anyone editing this area:

- A test that switches `GEODATA_DATA_SOURCE` between cases must call
  `resetServedDataCacheForTests()` (or the loader's own
  `reset…CacheForTests`) first, or the mode the first load resolved decides
  every later one.
- The snapshot `/mcp` answers from takes GDP, economic sector and regional
  economy facts through `loadServed…Rows()`, the accessor that returns rows
  before the numeric projection. Those rows keep `value` as the exact decimal
  string, because most of these values do not survive a float64 round-trip:
  6,446 of the 8,168 values across those three datasets come back different.
  The snapshot stores inflation as projected numbers instead, and that is
  safe rather than inconsistent — every CPI value round-trips exactly, and the
  only basket weights that change are 80 trailing zeros. Measure before
  assuming a new dataset is in one camp or the other.

Adding a seventh dataset means four things: call `resolveServedDataSource()`
rather than reading the environment variable; memoise the served loader;
register its reset in `resetServedDataCacheForTests()` in `servedData.ts`; and,
if the snapshot serialises its values, expose a `loadServed…Rows()` accessor
and read the snapshot from that.

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
  - **`GovernmentDebtFact` and `GeneralGovernmentBalanceFact`** — read by their public explorer routes and verified field by field at import and whenever those routes build in db mode.
  - **`InflationCpiFact` and `InflationTarget`** — read by `loadServedInflationData` on the inflation routes and verified field by field at import and whenever those routes build in db mode.
  - **`EconomicSectorFact`** — read by `loadServedEconomicSectorsData` on the sector routes and verified field by field at import and whenever those routes build in db mode.
  - **`RegionalEconomyFact`** — read by `loadServedRegionalEconomyData` on the regional economy routes and verified field by field at import and whenever those routes build in db mode.
  - **`DemographyFact`** — read by `loadServedDemographyData` on the demography routes and verified field by field at import and whenever those routes build in db mode.
  - **`InflationCpiFact`, `InflationTarget`, `InflationCategoryFact` and `InflationBasketWeight`** — read by `loadServedInflationData` on the inflation routes and verified field by field at import and whenever those routes build in db mode.
  - **The municipal tables, including `MunicipalPopulationFact`** — verified field by field at import, and
    at build time in db mode, because the municipal index, municipality and
    region routes read them through `loadServedMunicipalData`.
  Every mirror table now falls into one of the tiers above. `BudgetMapping`
  used to sit below all of them — no reader anywhere under `app/`,
  `components/` or `lib/`, and only a row-count check at import — and it was
  dropped in migration `20260822000000_drop_budget_mapping`. Its source file
  (`data/mappings/spending-field-mapping.csv`) never held more than three rows
  labelled "Sample row for foundation validation". The reviewed
  institution→field decisions it was standing in for live in
  `data/mappings/review/*.csv`, are consumed by the fact generators, and reach
  the mirror as `BudgetFact.publicSpendingFieldId` / `mappingConfidence` /
  `mappingNotes` — which are verified field by field like the rest of the
  first tier.
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
folder by hand, and for every new table add both
`ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY;` and
`REVOKE ALL ON TABLE "<Table>" FROM anon, authenticated;` — the generator emits
neither, and every mirror table here carries both. Give each migration folder a
unique timestamp: `20260912000000_economic_sectors` and
`20260912000000_inflation_cpi` share one and stay as applied, since renaming an
applied migration breaks `_prisma_migrations`.

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

## Domestic exports mirror

The domestic-export extension adds `TradeDomesticEntity` (287 rows) and `TradeDomesticFact` (5,076 rows) from the accepted domestic catalogue and CSV. Migration `20261010120000_trade_domestic_exports` adds only these tables, their entity/source/import relations, RLS and revoked public-role grants. It was generated offline by comparing the previous and current Prisma schemas; it does not assume live-database state. The existing import transaction clears the new facts before entities and source documents, imports facts in 1,000-row batches, and compares every field before committing. The serving reader repeats CSV/database parity checks. No live import or migration is part of local page implementation; an authorized release applies them through the existing Actions pipeline.

## Trade composition mirror

The composition extension mirrors 17 accepted category identities and 884 original observations (520 SITC, 364 BEC). Its 104 classification totals remain validation controls, outside the selectable catalogue and fact table. The accepted CSV, catalogue, acceptance report and English labels are hashed and validated before serving or import; raw workbooks and preparation code are never part of serving. The compact client projections keep SITC and BEC separate, with only exports/imports and national references for each classification's available years.

Migration `20261014120000_trade_composition` is generated offline from the previous/current Prisma schema files. It adds only the two composition tables, exact nullable `Decimal(40,20)` values, entity/source/import relations and indexes. Both tables enable RLS, have no public policies and revoke all access from `PUBLIC`, `anon` and `authenticated`. There is no new public database access.

The importer binds the four original source IDs to registered document identities by replacing hyphens with underscores and adding `source.`. It verifies those identities before opening the existing transaction, deletes composition facts before entities and source parents, inserts rows with the active import-run ID in the existing 1,000-row batches, then reloads and compares every entity/fact field and normalized exact decimal before commit. Counts for both tables appear in the parity report. The five-minute transaction and 30-second wait limits remain unchanged. DB-mode serving repeats full parity; CSV mode remains the static fallback. Local implementation does not apply migrations or run imports against a live database. Integration verification requires an explicitly configured disposable local test database; an authorized release uses the existing Actions pipeline.
