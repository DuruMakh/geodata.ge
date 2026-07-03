# GeoData.ge

GeoData.ge v1 is a Georgian-first Georgia Budget Explorer.

Read first:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `DESIGN.md` (for any UI work)

V1 focuses on annual national budget data for 2004-2025 (expenditure from 2004, revenue from 2005), reviewed data ingestion, public spending-field taxonomy, revenue categories, ministry-level expenditure series, CSV export, and clear budget visualizations.

Current loaded coverage: revenue is complete for 2005-2025; expenditure has detailed public-field data for 2017-2025 plus total-only values for 2004-2005, with 2006-2016 expenditure still being rolled out.

## Development

The Next.js app lives in `apps/web`.

```powershell
cd apps/web
npm install
npm run dev
```

The app reads CSV data from `data/imports/` at build time and does not require a database; `npm run dev` and `npm run build` work with no `.env`.

Prisma is kept as the planned path for a future database-backed version. Only when running Prisma commands (`npm run prisma:generate`, `npm run prisma:migrate`) create `apps/web/.env` from the root `.env.example` shape:

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/geodata"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/geodata"
```

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
