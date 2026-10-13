# Fiscal.ge

Fiscal.ge is a Georgian-first explorer of reviewed Georgian public-finance and economy data, with an English mirror under `/en`, in eleven dataset hubs: budget (national expenditure and revenue, municipal budgets, government debt and the general-government balance), economy, inflation, money and banks, unemployment, wages, living standards, trade, external flows, energy and food, and demography. `Project_Definition.md` section 2 owns the authoritative list. Each explorer downloads as an Excel workbook; several datasets are also published as static data files under `/downloads/data/` (listed in its `catalogue.json`) and through a read-only MCP connection for AI clients at `/mcp`.

Read first:

- `AGENTS.md` (operating rules) and `CLAUDE.md` (commands and definition of done)
- `Project_Definition.md` (scope and coverage; section 2 is authoritative)
- `DESIGN.md` (for any UI work)
- the relevant file under `docs/data-methodology/` (for any data work)

## Development

The Next.js app lives in `apps/web`.

```powershell
cd apps/web
npm install
npm run dev
```

By default (`GEODATA_DATA_SOURCE` unset or `csv`) the app reads CSV data from `data/imports/` at build time; `npm run dev` and `npm run build` work with no `.env`.

The reviewed CSVs are the canonical source of truth. Supabase Postgres is the canonical serving store, populated from them by the idempotent, parity-checked import (`npm run data:import`). Production builds set `GEODATA_DATA_SOURCE=db` to render pages from the database at build time — the deployed site stays fully static. See `docs/data-methodology/database-import.md` for the full workflow, including the one-time Supabase setup. (Activation status: live in production since 2026-07-28 — production builds render from the Supabase mirror via the Actions deploy pipeline; CSV remains the break-glass fallback.)

Database commands (`npm run prisma:deploy`, `npm run data:import`, builds with `GEODATA_DATA_SOURCE=db`) need `apps/web/.env` with the Supabase connection strings — copy `apps/web/.env.example` and fill in the pooled (`DATABASE_URL`, port 6543) and session-pooler (`DIRECT_URL`, port 5432) URLs. New migrations are written by hand, not with `prisma migrate dev`: see [Creating a migration](docs/data-methodology/database-import.md#creating-a-migration-prisma-migrate-dev-does-not-work-here).

## Deployment

The site deploys to Vercel (project `geodata-ge`): production at https://fiscal.ge updates via the *Deploy production* GitHub Actions workflow after CI passes on `main` (direct pushes no longer auto-deploy); other branches get preview deployments. See `docs/deployment.md` for the pipeline, rollback, environment variables, and custom-domain steps.

## Data Foundation

Root data files live under `data/`.

- `data/taxonomy`: stable public category IDs.
- `data/glossary`: Georgian-first labels.
- `data/mappings`: reviewed mapping and review files the data generators read: `review/` (official expenditure rows to public spending fields, institutions and major programs), `demography/` and `inflation-products/`.
- `data/imports`: reviewed import files and sample imports.
- `data/sources`: source document metadata.
- `data/methodology`: the public methodology decision register and archived original source files.
- `data/geometry`: municipality map paths.
- `data/localization`: reviewed Georgian and English display text for the bilingual site.
- `data/staging`: intermediate extraction outputs staged for review before promotion into imports.
- `data/reports`: generated internal import validation reports; these are local generated artifacts and are ignored by git unless explicitly promoted.

Extraction methodology records for finalized years live in `docs/data-methodology/`.

## Encoding

All source files containing Georgian text must be UTF-8.

Before importing or exporting data, verify Georgian labels render correctly in:

- source files under `data/`
- import reports under `data/reports/`
- browser UI
- Excel workbooks opened in spreadsheet software
