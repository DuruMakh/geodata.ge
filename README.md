# GeoData.ge

GeoData.ge v1 is a Georgian-first Georgia Budget Explorer.

Read first:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `DESIGN.md` (for any UI work)

V1 focuses on annual national budget data: expenditure for 2004-2025 and revenue for 2005-2025, reviewed data ingestion, public spending-field taxonomy, revenue categories, ministry-level expenditure series, CSV export, and clear budget visualizations.

Current loaded coverage: revenue is complete for 2005-2025; expenditure has detailed public-field and ministry-category data for 2004-2025. The served 2004 expenditure total is the full state-budget execution-annex total of GEL 1,930,210,300; the separate Treasury E11 PDF is central-budget scoped and not served.

## Development

The Next.js app lives in `apps/web`.

```powershell
cd apps/web
npm install
npm run dev
```

By default (`GEODATA_DATA_SOURCE` unset or `csv`) the app reads CSV data from `data/imports/` at build time; `npm run dev` and `npm run build` work with no `.env`.

The reviewed CSVs are the canonical source of truth. Supabase Postgres is the canonical serving store, populated from them by the idempotent, parity-checked import (`npm run data:import`). Production builds set `GEODATA_DATA_SOURCE=db` to render pages from the database at build time — the deployed site stays fully static. See `docs/data-methodology/database-import.md` for the full workflow, including the one-time Supabase setup. (Activation status: live in production since 2026-07-28 — production builds render from the Supabase mirror via the Actions deploy pipeline; CSV remains the break-glass fallback.)

Database commands (`npm run prisma:migrate`, `npm run data:import`, builds with `GEODATA_DATA_SOURCE=db`) need `apps/web/.env` with the Supabase connection strings — copy `apps/web/.env.example` and fill in the pooled (`DATABASE_URL`, port 6543) and session-pooler (`DIRECT_URL`, port 5432) URLs.

## Deployment

The site deploys to Vercel (project `geodata-ge`): production at https://geodata-ge.vercel.app updates via the *Deploy production* GitHub Actions workflow after CI passes on `main` (direct pushes no longer auto-deploy); other branches get preview deployments. See `docs/deployment.md` for the pipeline, rollback, environment variables, and custom-domain steps.

## Data Foundation

Root data files live under `data/`.

- `data/taxonomy`: stable public category IDs.
- `data/glossary`: Georgian-first labels.
- `data/mappings`: reviewed mappings from official rows to public spending fields.
- `data/imports`: reviewed import files and sample imports.
- `data/sources`: source document metadata.
- `data/staging`: intermediate extraction outputs staged for review before promotion into imports.
- `data/reports`: generated internal import validation reports; these are local generated artifacts and are ignored by git unless explicitly promoted.

Extraction methodology records for finalized years live in `docs/data-methodology/`.

## Encoding

All source files containing Georgian text must be UTF-8.

Before importing or exporting data, verify Georgian labels render correctly in:

- source files under `data/`
- import reports under `data/reports/`
- browser UI
- CSV exports opened in spreadsheet software
