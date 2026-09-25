# Fiscal.ge - Project Definition

## 1. Project Overview

### Project Name

Fiscal.ge

### One-Line Description

A Georgian-first public budget explorer for understanding Georgia's national budget through clear data, strong visualizations, and downloadable structured datasets.

### Current Product Focus

Fiscal.ge is a long-term public data platform idea, but v1 is intentionally narrow: Georgia Budget Explorer.

The first version focuses on annual national budget data: expenditure by public spending fields and ministries and revenue both cover 2004-2025. The 2004 expenditure series uses the reviewed full state-budget execution annex; the separate Treasury E11 PDF is central-budget scoped and is not served. The 2004 revenue panel uses the annual report's consolidated revenue-and-grants table and intentionally omits the unavailable comparable increase-in-liabilities amount. The product should help users understand where public money comes from, where it goes, and how the structure changes over time.

This v1 scope is deliberate. A narrow, high-quality budget explorer is more valuable than a broad but shallow data catalog.

## 2. V1 Scope

### Included

- Annual expenditure and revenue data for 2004-2025. The 2004 revenue total covers revenue and grants; increase in liabilities starts in 2005 and is neither estimated nor treated as zero for 2004.
- Revenue overview and major tax revenue categories.
- Expenditure overview using public-friendly spending fields such as health, education, social protection, defence, infrastructure, and similar categories.
- Multi-year explorer with line and table views.
- National revenue and expenditure multi-year explorers can show each series as a share of same-year nominal GDP at current prices. The reviewed annual denominator covers 1996-2025; the canonical handoff uses SNA 1993 through 2009 and SNA 2008 from 2010. This supports `% მშპ-ში` inside the budget explorers only; the GDP overview below is a separately approved item. Municipal shares and single-year composition shares remain shares of their applicable budget total.
- Annual general-government deficit explorer at `/explorer/deficit`, using reviewed IMF WEO data for 1995-2031: signed net lending/borrowing as percent of GDP and nominal GEL, with 1995-2025 marked actual and 2026-2031 marked projection. The page adds no fiscal statistic beyond those two measures and never derives a deficit by subtracting the differently scoped revenue and expenditure datasets.
- Multi-year expenditure grouping by public spending fields or by ministries/major programs (ministries data exists for 2004-2025; 2004 has no major-program rows, while later drill-down rows are partial from 2012 and contiguous 2017-2025); this is series selection, not drilldown.
- Single-year snapshot with headline cards, treemap, Every 100 GEL, Budget Radar, Budget Field, and full ranking.
- Municipal annual expenditure data for 2015-2025: ten main functional categories plus the public total headline. The public entity set remains 64 municipality pages and 11 region roll-up pages under `/explorer/municipalities`. The 2025 index map uses the reviewed 1 January 2025 Geostat population denominator to color municipalities by budget per resident; municipality and region lists remain ranked by total budget and show per-resident values only as supporting context, and one KPI reports the 64-municipality median. Adjara's regional total consolidates its six municipalities with Adjara Autonomous Republic actual payments and removes transfers from the republic to territorial budgets. The explicit `/explorer/municipalities/georgia` page starts from all 69 reviewed municipal-budget series and adds the same net Adjara republican amount once. Codes `05`, `42`, `43`, `46`, and `64` remain country-aggregate-only because their budgets are not territorially attributable spending inside the named municipalities. The Georgia row has no per-resident value. The ten functional series remain municipal-only because no reviewed comparable Adjara republican function crosswalk exists; no residual or proportional allocation is invented. Municipality and region ranks remain out of 64 and 11 respectively. Methodology: `docs/data-methodology/municipal-functional-annual-2015-2025.md` and `docs/data-methodology/municipal-population-regional-gdp.md`.
- Annual Government Debt explorer at `/explorer/debt`: stock for 2013–2025, actual debt service for 2013–2025 with the optional 2026–2030 existing-portfolio snapshot, and weighted-average rates for 2015–2025. Stock can be shown in GEL or as a share of same-year GDP; exact unpublished rate gaps remain empty. This does not change the existing `spending.debt_service` expenditure series. Methodology: `docs/data-methodology/government-debt-annual.md`.
- `მალე` markers for named future datasets (`უმუშევრობა` and `დემოგრაფია` in the sidebar). Labels only: no routes, not clickable, no data. Inflation and economic growth are no longer markers — both ship (see the Economy items below and 2C).
- Excel workbook export. Each explorer has one `ჩამოტვირთვა` action for the active range, selected series, grouping, and measure; it downloads a Fiscal.ge `.xlsx` file with `მარტივი ცხრილი`, `მონაცემები`, and `წყაროები` sheets. The readable table starts on row 3 with right-aligned years, while the analysis sheet uses the Georgian headers `წელი`, `მთავარი ჯგუფი`, `კატეგორია`, `თანხა (₾)`, and `სტატუსი`. Relevant validated public-archive originals live only on `წყაროები`, with compressed year ranges and clean clickable file labels rather than raw URLs. There is no public explorer CSV action. National multi-year workbooks always retain the full GEL amount, add `მშპ-ის წილი (%)` and link the validated GDP source workbook only for the active `% მშპ-ში` measure; the Debt-rate exception leaves the GEL amount blank and adds `საპროცენტო განაკვეთი (%)`. Workbooks do not expose denominator, accounting-standard, publication-status, or source-metadata columns. Methodology manifest CSVs remain unchanged.
- Georgian-first UI.
- Minimal public source label.
- Internal source/provenance metadata.
- Public methodology and original-source centre: a `/methodology` hub plus live pages for expenditure, revenue, municipalities, Government Debt, GDP, national economic sectors, regional economies, and inflation; complete public decision records for the budget and municipal datasets; concise dataset-specific pages elsewhere; and untouched upstream files available individually and as category archives. Future dataset names remain non-clickable `მალე` markers until their data, methodology, validation, and sources are ready together. Approved design: `docs/superpowers/specs/2026-08-11-methodology-portal-design.md`.

- Economy hub at `/explorer/economy` and annual GDP overview at `/explorer/economy/gdp`: four centered Real GDP, Nominal GDP, GDP growth and nominal GDP-per-capita tabs, existing chart/table/range/download components, GEL/USD for nominal measures only. Scope and source boundaries: `docs/superpowers/specs/2026-09-10-gdp-overview-design.md`. GDP methodology is live with the feature; the six GDP series are also exposed through read-only MCP and central bulk downloads. Population integration remains deferred.
- National economic sectors at `/explorer/economy/sectors`: 20 NACE activities and a separately published total GDP reference, with nominal GEL and GDP share for 2010–2025 and real growth for 2011–2025. One workspace reuses the existing chart, table, unlimited selector, year range and Excel components, with a joined three-way measure switch and no top indicator tabs. Sector values are GVA at basic prices; GDP-share denominators are national GDP at market prices. Source-supported growth is never replaced by nominal growth. Both languages, source originals, methodology, read-only MCP and central bulk downloads are included. Regional sectors remain a separate dataset and route family. See `docs/data-methodology/economic-sectors.md`.
- Regional economies at `/explorer/economy/regions`: an All Regions index with an 11-region map and GDP-ranked list, plus 11 selectable detail pages. Each detail page contains Total regional GDP and 20 NACE Rev. 2 activities for 2010–2024, with exactly two measures: current-price GEL and each activity's share of that same region's complete market-price GDP. Activity values are GVA at basic prices; total regional GDP is at market prices, so activity shares need not sum to 100%. The feature includes bilingual pages, Excel, methodology and original sources, the read-only `query_regional_economies` tool, and complete JSON/CSV publications. It does not include 2025, real growth, per-capita values, a region's share of Georgia's GDP, forecasts, USD, sector or detail-page rankings, or multi-region charts. See `docs/data-methodology/regional-economies.md`.

The approved national-sector page also includes four point-in-time highlights: largest sector and GDP share, highest annual real growth, largest annual decline (or slowest growth), and combined GDP share of the three largest sectors. These use all national activities in the selected final year, independently of chart selection and measure; unavailable growth stays missing. No regional or additional indicator scope is implied.

### Excluded From V1

- Broad public data catalog.
- Historical municipal per-capita series, detail-page per-capita measures, and per-capita exports. V1 includes only the bounded 2025 index map, supporting list values, and median KPI described above.
- The six selected-detail municipal categories. Only the ten main functions are served.
- Any data behind the remaining sidebar indicator markers (`უმუშევრობა`, `დემოგრაფია`).
- Capital projects explorer.
- Admin UI.
- Public API.
- User uploads.
- Quarterly or monthly data (inflation: see 2C).
- Automated production extraction from DOCX/PDF.
- Clickable drilldown/detail pages into programs, subprograms, or revenue subcategories.

## 2A. V2 Scope

V1's scope above is the record of a shipped release and is not edited. This
section states what V2 adds, and what stays excluded.

### Included in V2

- A **read-only MCP connection** at `/mcp`, so an outside AI client can ask a
  budget question and receive the same reviewed figures the site shows, with
  their sources and limitations attached. Unauthenticated and free, bounded by
  documented operating limits.
- **Static data publications** under `/downloads/data/`: a manifest, the
  capability catalogue, the source resolution, and one or more files per served
  dataset (four at launch; the manifest lists the current set). These are
  published files, not a query service.
- A Georgian **connection page** at `/connect` describing the service, its exact
  coverage, and how to connect — the one human-facing surface for the above.

V2 lifts the V1 "Public API" exclusion **only** for these. Nothing else about
V1's scope changes.

### Still excluded in V2

- A REST query API of any kind.
- Write access, user accounts, authentication, and uploads.
- Any dataset V1 does not already serve, including quarterly and monthly data (inflation: see 2C),
  capital projects, and procurement.
- An on-site AI assistant. The query service contains no model or inference
  code; an assistant is a later, separately scoped decision.

### Revenue and expenditure are distinct concepts

V2 exposes both nationally, and they are **not** two sides of one budget.
Revenue is consolidated budget receipts; expenditure is state-budget
expenditure. They are different accounting boundaries, so subtracting one total
from the other does not produce a deficit or any other fiscal balance. Every
published surface must carry that distinction rather than assume the reader
knows it.

## 2B. Approved bilingual extension

The existing Fiscal.ge website is available in Georgian at its established URLs
and in English under `/en`. This is a presentation extension to the currently
approved expenditure, receipts, ministries, analysis, municipal, government-debt
and general-government-balance surfaces; it adds no dataset or query API. The
shipped V1 record above remains intact.

Both languages share reviewed facts, stable ASCII identities, calculations,
source documents and the editorial design. Human pages, controls, methodology,
Excel workbooks, metadata and social previews are translated. The shared `/mcp`
endpoint and ten existing JSON publications expose the additive bilingual schema
1.1.0. Original document bytes, URLs and mandatory attribution are preserved.
Translations are reviewed build inputs; no request-time translation service,
automatic language detection, language cookie or language redirect is introduced.
Future additions must provide reviewed language companions and page review dates
before passing `npm run i18n:check`. The bounded decisions are in
`docs/superpowers/specs/2026-09-05-fiscal-bilingual-design.md`.

## 2C. Approved inflation extension

Approved 2026-09-11 (`docs/superpowers/specs/2026-09-11-inflation-overview-design.md`) and extended 2026-09-12 (`docs/superpowers/specs/2026-09-12-inflation-categories-design.md`). For this dataset only, the "data behind the sidebar indicator markers" and "quarterly or monthly data" exclusions are lifted:

- Inflation hub at `/explorer/inflation` and Inflation overview at `/explorer/inflation/overview`: monthly national CPI from Geostat — headline index (2010 = 100), annual and monthly inflation, the 12-month average, core inflation and core excluding tobacco — with the National Bank of Georgia inflation target as a reference line; year × month table; Excel download; Georgian and English.
- Inflation categories at `/explorer/inflation/categories`: the national CPI decomposed into its 12 COICOP divisions and 43 subgroups — annual and monthly price change per group, the annual consumer-basket weights, and a contribution-to-inflation measure derived by Fiscal.ge from those two published series with a visible residual that closes the stack on the published headline; stacked column chart, year × month table, Excel download; Georgian and English.
- Methodology page `/methodology/inflation` with the archived Geostat and NBG source files.
- Read-only MCP access and bulk publications for the inflation data above: `query_inflation`; inflation in `describe_coverage`, `get_sources`, `compare` and `rank`; and `inflation-national.json`, `inflation-categories.csv` and `inflation-categories.json`. Approved 2026-09-14 (`docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`).

Still excluded: city indices, product-level indices, the price calculator, a standalone basket-composition section, every other price index (producer, import, construction, property, agricultural), HICP, and monthly or quarterly data for any other dataset. Each needs its own approved spec.

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

Fiscal.ge v1 makes Georgia's national budget easier to understand and reuse.

The product solves these problems:

- Budget data is fragmented across official documents and files.
- Official documents are difficult to compare across years.
- Manual Excel work is slow and error-prone.
- Public-facing budget visualizations are limited.
- It is hard to quickly understand how revenue and expenditure change over time.

Fiscal.ge improves this by:

- Normalizing reviewed budget data.
- Showing multi-year trends.
- Providing single-year visual explanations.
- Allowing readable Excel workbook download.
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

Analytical views should not be overloaded with provenance panels or repeated introductory copy. They retain a concise source label; the footer and dedicated `/methodology` surfaces provide access to the applicable public methodology and original-source archive. Budget and municipal pages retain their complete public decision records; the Debt page intentionally stays limited to its concise scope, sources, known limitations, and archive.

Public UI should include a small source label, such as:

```text
Data: reviewed official budget documents. Last updated: YYYY-MM-DD.
```

Excel workbooks should link relevant validated public-archive sources and preserve basis information. Planned years should be visibly marked with a subtle badge, chart marker, or workbook marker.

The workbook's `მონაცემები` sheet should use readable Georgian columns for year, grouping, category, GEL amount, and status; it must not expose internal identifiers, repository paths, or review metadata.

When actual data arrives for a planned year, actual data becomes the active public value. If planned and actual values both exist internally for the same item/year, actual wins in public charts, tables, and Excel workbooks.

## 7. Visual Direction

The production visual direction follows the canonical `DESIGN.md` v4.1 contract. Retained files under `docs/Design HTML files/` are contextual inputs only unless a current product spec explicitly promotes them.

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

Avoid short-term UI-only hacks. The product should be architected so future versions can add more datasets, drilldown, bilingual UI, and additional budget modules without rebuilding the foundation.

Implementation should follow this order: data foundation, real sample data, main explorer core with line/table modes and Excel workbook export, single-year core, and production UI polish against `DESIGN.md`. The bounded national `% მშპ-ში` measure described in section 2 is approved, as are the GDP overview (section 2) and the inflation-categories stacked chart (2C); bar mode, stacked mode elsewhere, and broader advanced chart controls remain outside the current production scope unless explicitly re-approved. Do not start with visual richness before the data model and import validation are working.
