# GeoData.ge - Project Definition

## 1. Project Overview

### Project Name

GeoData.ge

### One-Line Description

A Georgian-first public budget explorer for understanding Georgia's national budget through clear data, strong visualizations, and downloadable structured datasets.

### Current Product Focus

GeoData.ge is a long-term public data platform idea, but v1 is intentionally narrow: Georgia Budget Explorer.

The first version focuses on annual national budget data for 2005-2025, including revenue, tax revenue, and expenditure by public spending fields. Both sides start in 2005: the project does not have reviewed 2004 sources in the served datasets (the available 2004 treasury expenditure source is central-budget scoped). The product should help users understand where public money comes from, where it goes, and how the structure changes over time.

This v1 scope is deliberate. A narrow, high-quality budget explorer is more valuable than a broad but shallow data catalog.

## 2. V1 Scope

### Included

- Annual budget data for 2005-2025 for both expenditure and revenue.
- Revenue overview and major tax revenue categories.
- Expenditure overview using public-friendly spending fields such as health, education, social protection, defence, infrastructure, and similar categories.
- Multi-year explorer with line and table views.
- Multi-year expenditure grouping by public spending fields or by ministries/major programs (ministries data exists for 2005-2025, with major-program drill-down rows partial from 2012 and contiguous 2017-2025); this is series selection, not drilldown.
- Single-year snapshot with headline cards, treemap, Every 100 GEL, Budget Radar, Budget Field, and full ranking.
- Municipal annual expenditure data for 2015-2025: ten main functional categories across 64 publicly served municipalities, plus the official total-payments headline. Five municipal bodies associated with occupied territories (`05`, `42`, `43`, `46`, `64`) are intentionally excluded because their budgets are not territorially attributable spending inside those municipalities. Served at `/explorer/municipalities`: an index with a municipality-grain map and ranked list, 64 municipality pages, and 11 region roll-up pages. Methodology: `docs/data-methodology/municipal-functional-annual-2015-2025.md`.
- `მალე` markers for named future datasets (`უმუშევრობა`, `ინფლაცია`, `ეკონომიკური ზრდა`, `დემოგრაფია` in the sidebar). Labels only: no routes, not clickable, no data.
- CSV export.
- Georgian-first UI.
- Minimal public source label.
- Internal source/provenance metadata.

### Excluded From V1

- Broad public data catalog.
- Municipal per-capita measures. No reviewed population dataset exists; see the population section of `docs/data-methodology/municipal-functional-annual-2015-2025.md`.
- The six selected-detail municipal categories. Only the ten main functions are served.
- Any data behind the four sidebar indicator markers (`უმუშევრობა`, `ინფლაცია`, `ეკონომიკური ზრდა`, `დემოგრაფია`).
- Capital projects explorer.
- Debt explorer.
- Admin UI.
- Public API.
- User uploads.
- Quarterly or monthly data.
- Automated production extraction from DOCX/PDF.
- Clickable drilldown/detail pages into programs, subprograms, or revenue subcategories.

## 3. Target Users

Primary users:

- Journalists.
- Policy analysts.
- Researchers.
- Economists.
- Students.
- Civic organizations.
- Public-sector observers.

Secondary users:

- General citizens interested in the budget.
- International organizations.
- Investors or businesses needing a high-level view of public finances.

The first release should primarily serve people who currently need to read official budget documents, extract tables manually, and copy figures into Excel.

## 4. Value Proposition

GeoData.ge v1 makes Georgia's national budget easier to understand and reuse.

The product solves these problems:

- Budget data is fragmented across official documents and files.
- Official documents are difficult to compare across years.
- Manual Excel work is slow and error-prone.
- Public-facing budget visualizations are limited.
- It is hard to quickly understand how revenue and expenditure change over time.

GeoData.ge improves this by:

- Normalizing reviewed budget data.
- Showing multi-year trends.
- Providing single-year visual explanations.
- Allowing CSV download.
- Keeping planned/actual status and source metadata in the data layer.

## 5. Data Direction

V1 uses reviewed annual data, not automated document extraction.

Pipeline:

1. Collect official budget source documents.
2. Review and normalize data into XLSX/CSV.
3. Validate totals, years, categories, planned/actual basis, and mappings.
4. Import clean data into the database.
5. Serve dashboards from validated facts.

The data model should preserve official source structure while also supporting a public-facing taxonomy.

Every import should produce an internal validation report showing rows imported, totals loaded, planned/actual counts, unclassified amounts, reconciliation status, and warnings. This is not a public v1 feature, but it is required to prevent data mistakes from reaching public charts.

For expenditure, the single-year UI should prefer public spending fields such as social protection, health, education, defence, public order and safety, infrastructure and regional development, economic affairs, agriculture and environment, culture, sport, general public services, debt service, and other/unclassified. A reviewed mapping layer connects official institution/program rows to those public fields. The original official hierarchy remains stored and can appear as selectable series in the multi-year explorer where data exists. This is selection, not clickable drilldown. If a row cannot be confidently mapped, it must be explicitly assigned to `Other / unclassified`; no official row should disappear silently from public totals. The mapping should store confidence and notes.

For revenue, the UI should show top-level tax categories directly instead of hiding them under one `Tax revenue` category. V1 revenue categories are VAT, income tax, profit tax, excise tax, import tax, property tax, other taxes, grants, other revenue, decrease in non-financial assets, decrease in financial assets, and increase in liabilities. Georgian labels for the last three budget-classification categories should be confirmed from source documents before implementation.

Category IDs must be stable and label-independent. Use lowercase ASCII IDs such as `revenue.vat`, `revenue.income_tax`, `spending.health`, and `spending.social_protection`. Georgian and English labels are display properties, not identifiers.

Renames should not break multi-year charts. If a category is renamed but its meaning is the same, keep the same stable ID and update the display label. If the meaning changes materially, create a new ID and document the transition.

Public labels should come from a Georgian-first terminology glossary, not from hard-coded chart text. The glossary should include stable ID, Georgian label, English label, description, and notes.

## 6. Trust Policy

V1 should not overload the UI with provenance panels, but it must not hide trust completely.

Public UI should include a small source label, such as:

```text
Data: reviewed official budget documents. Last updated: YYYY-MM-DD.
```

CSV exports should include source/basis metadata. Planned years should be visibly marked with a subtle badge or chart marker.

CSV metadata should be exported as columns, including year, category ID, Georgian label, English label, GEL amount, basis, source name, source file or URL, and last reviewed date.

When actual data arrives for a planned year, actual data becomes the active public value. If planned and actual values both exist internally for the same item/year, actual wins in public charts, tables, and CSV.

## 7. Visual Direction

The production visual direction follows `DESIGN.md` and the confirmed references in `docs/Design HTML files/`.

This is a product decision.

Guardrails:

- The interface is the warm editorial statistical annual defined in `DESIGN.md` v4.1: single paper theme, ink rules, serif display with mono numerals, one terracotta accent, no theme toggle.
- The previous Apple-like Light/Night system and older dark, neon, and terminal-like prototype styling are superseded for production unless a new design change is explicitly approved.
- Georgian text must remain readable.
- Charts must stay clear and accessible.
- Decorative effects must not reduce data comprehension.

## 8. Product Stack

Frontend and backend:

- Next.js with TypeScript.
- Vercel.

Data serving (current):

- Reviewed CSV files under `data/imports/` remain the canonical human-reviewed source of truth.
- Supabase Postgres (via Prisma 7) is the canonical serving store, populated from those CSVs by an idempotent import (`npm run data:import`) that proves exact parity (row counts and GEL totals) on every run.
- Pages are still rendered at build time (`GEODATA_DATA_SOURCE=db` reads the database during the build); the deployed app stays fully static, so database downtime never affects visitors.
- `GEODATA_DATA_SOURCE=csv` (the default when unset) builds directly from the CSVs — the documented fallback, guaranteed identical by the import parity check. See `docs/data-methodology/database-import.md`.

UI:

- Tailwind.
- A disciplined custom component layer (no shadcn).

## 9. Durable V1 Principle

Build the data foundation first. Visual ambition is important, but the platform only becomes valuable if the budget taxonomy, validation, planned/actual handling, and data export are trustworthy.

Avoid short-term UI-only hacks. The product should be architected so future versions can add more datasets, drilldown, bilingual UI, source pages, and additional budget modules without rebuilding the foundation.

Implementation should follow this order: data foundation, real sample data, main explorer core with line/table modes and CSV, single-year core, and production UI polish against `DESIGN.md`. Bar mode, stacked mode, Share of GDP, and broader advanced chart controls are not part of the current production v1 scope unless explicitly re-approved. Do not start with visual richness before the data model and import validation are working.
