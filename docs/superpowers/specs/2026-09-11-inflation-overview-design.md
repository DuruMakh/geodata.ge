# Inflation: overview section specification

Date: 2026-09-11
Status: Draft for user review. Design direction approved in conversation on 2026-09-11 from the published preview (`Fiscal.ge Inflation Preview`, Overview screen).

## 1. Outcome and scope

Add **Inflation** (`ინფლაცია`) as a peer dataset in the Data Explorer sidebar, with its own hub and one functional section: **Inflation overview** (`ინფლაციის მიმოხილვა`). The overview presents Georgia's national consumer price index through three centred indicator tabs over one shared chart/table workspace:

1. `წლიური ინფლაცია` — year-on-year change, %.
2. `თვიური ინფლაცია` — month-on-month change, %.
3. `ფასების ინდექსი` — price index level, 2010 average = 100.

This milestone includes: data collection and archiving, a deterministic prepare/check pipeline, reviewed canonical CSVs, database mirror and parity, the Inflation hub, the overview page, the monthly table, localized Excel download, methodology page and source archive, Georgian and English.

Out of scope for this milestone (each is a later, separately approved section): COICOP categories and groups, basket weights, city indices, product-level indices, the price calculator, and every non-CPI price index (producer, import, construction, property, agricultural). HICP is dropped entirely. No MCP query intents, public JSON publications or API changes.

User-approved decisions (2026-09-11):

- Reuse production components wherever possible; the HTML preview is a behaviour reference only. In any visual conflict, production components and `DESIGN.md` win.
- The section is named `ინფლაციის მიმოხილვა`, not `წლიური ინფლაცია`, because it also carries monthly change and the index.
- Indicator tabs follow the Economy / GDP overview pattern (`codex/gdp-overview`, `docs/superpowers/specs/2026-09-10-gdp-overview-design.md`): headline line and unit line under the heading, `TextTab` buttons centred above the chart panel.
- The movers board (`ყველაზე სწრაფად ძვირდება` / `ყველაზე ნელა ძვირდება`) is removed from this page.
- The table view (`ცხრილი`) — a year × month grid — is a valued feature and is specified in full (§6).

## 2. Scope amendment

`Project_Definition.md` §2 currently excludes "any data behind the four sidebar indicator markers" and "quarterly or monthly data". During implementation add a section **2C. Approved inflation extension** that lifts both exclusions for this dataset only: monthly national CPI headline and core series, the NBG inflation target reference, and the pages in this spec. All other exclusions stay, including monthly or quarterly data for any other dataset. Record the new surfaces in `DESIGN.md` (new §25 Inflation surfaces, plus the component extensions in §7–8).

## 3. Dependency on the Economy branch

`codex/gdp-overview` edits the same shared files this work needs: `components/shell/data-sidebar.tsx` (dataset peers below Budget), `lib/explorer/workbookModel.ts` (`published` basis, `showChangeColumn`, `numericFormats`) and `lib/explorer/workbookWriter.client.ts`. Inflation implementation starts from `main` **after** that branch merges, and builds on its sidebar and workbook extensions rather than re-inventing them. If it has not merged when implementation begins, stop and agree an order; do not implement parallel variants of the same shared change.

## 4. Data

### 4.1 Sources

Canonical source: National Statistics Office of Georgia (Geostat), consumer price index publications at `https://www.geostat.ge/en/modules/categories/26/cpi-inflation` and the Georgian equivalent. From the national (`Georgia` / `საქართველო`) sheet only:

| File (Geostat title) | Series used | Coverage in the 2026-09-10 files |
| --- | --- | --- |
| Consumer Price Index over the 2010 average | headline index, 2010 = 100 | 2000-01 – 2026-08 |
| Consumer Price Index over the same month of the previous year | headline y/y | 2004-01 – 2026-08 |
| Consumer Price Index over the previous month | headline m/m | 2004-01 – 2026-08 |
| Consumer Price Index, 12 month average over the previous 12 month average | headline 12-month average (KPI only) | 2002-01 – 2026-08 |
| Core Inflation (to the same month of the previous year) | core y/y, core excluding tobacco y/y | 2010-01 – 2026-08 |
| Core Inflation (to the previous month) | core m/m, core excluding tobacco m/m | 2010-01 – 2026-08 |

Geostat's metadata (certified 2026-02-03) states the total index exists from 1988 and is comparable from 2000; the served coverage is what the files contain, derived from loaded facts, never hardcoded. Core excludes food and non-alcoholic beverages, energy, regulated tariffs and specific transport tariffs; the second variant also excludes tobacco (Geostat's footnotes, quoted in the methodology).

Reference: National Bank of Georgia inflation target — 5% (2015–2016), 4% (2017), 3% (from 2018), per `https://nbg.gov.ge/en/page/inflation-target`. **Collection task:** establish from NBG monetary-policy documents whether numeric targets existed before 2015. Until verified, the reference starts in 2015 and no public text claims there was no earlier target.

### 4.2 Archive and provenance

Store the untouched files under `docs/Raw Data/Inflation/geostat-cpi/<vintage YYYY-MM>/` (English and Georgian XLSX) and the NBG target page snapshot under `docs/Raw Data/Inflation/nbg-inflation-target/`, each with a `source-manifest.csv` recording download URL, capture date, byte count and SHA-256, as the Deficit archive does. Geostat media URLs change with every monthly upload, so every vintage keeps its own URLs. The exploratory downloads in the gitignored `.tmp/inflation-exploration/` are research material only and are re-collected, not copied, into the archive.

### 4.3 Canonical CSVs

- `data/imports/cpi-national-monthly.csv`: one row per series, measure and month. Columns: `series_id` (`cpi.headline`, `cpi.core`, `cpi.core_ex_tobacco`), `measure` (`index_2010`, `yoy_pct`, `mom_pct`, `avg12_pct`), `period` (`YYYY-MM`), `value` (published precision), `status` (`published`), `source_id`, `last_reviewed_at`. Percent measures store percentage points as published (5.6 means 5.6%); index stores the index level.
- `data/imports/nbg-inflation-target.csv`: `effective_from` (`YYYY-MM`), `effective_to` (`YYYY-MM` or empty), `target_pct`, `source_id`, `last_reviewed_at`.

Store only published values. Do not derive y/y for 2001–2003 from the index, and do not derive index levels for core. Stable lowercase ASCII IDs; labels are display data.

### 4.4 Prepare and validation

A deterministic `scripts/prepare-inflation.ts --write | --check` (mirroring `prepare-general-government-balance.ts`) that:

- verifies every archived file's byte count and SHA-256 against its manifest;
- reads only the national sheet, locates rows by content (title row, year header row, month header row, `Total` / `სულ` row, core indicator rows), and refuses to guess if the layout changes;
- requires each series to be contiguous monthly from its first to its last month, with unique periods and finite values, and all six files to end in the same month;
- recomputes y/y and m/m from the index and requires agreement within 0.2 points (the 2026-09-10 files agree within 0.15 across 272 months — rounding only); recomputes the 12-month average from the index within the same tolerance. Validation only: the published values are the delivered series;
- requires the English and Georgian files to carry identical values;
- on refresh, compares every overlapping month with the current canonical CSV and fails on any change to history, listing the months. Geostat's policy is no planned revisions, so an unexpected revision is a stop-and-review event, never a silent overwrite.

`--check` joins `npm run data:validate`. Loaders validate coverage, uniqueness, IDs, units and the source IDs' presence in `data/sources/source-documents.csv`, as existing datasets do.

### 4.5 Serving and database mirror

Follow `docs/data-methodology/database-import.md`: new Prisma models for CPI facts and target rows, a hand-written migration per that document's migration section, inclusion in `npm run data:import` with exact parity (row counts and value sums per series and measure), and CSV mode as the build fallback. Pages remain fully static; no request-time data access.

### 4.6 Monthly refresh

Geostat publishes on the 2nd–5th of each month. Refreshing is a manual, reviewed step: download the new files into a new vintage folder, update the manifest, run `prepare-inflation --write`, review the diff (exactly one new month per series unless a revision is flagged), commit, and let the standard pipeline import and deploy. The methodology page and coverage label show the latest month and review date. No automated fetching.

## 5. Navigation, routes and hub

Routes (Georgian canonical, English under `/en`):

- `/explorer/inflation` — Inflation hub.
- `/explorer/inflation/overview` — Inflation overview.
- `/methodology/inflation` — methodology and original sources; the methodology hub's `ინფლაცია` marker becomes live.

Sidebar: `ინფლაცია` becomes a real dataset link in the peer list established by the Economy branch (Budget, Economy, Inflation), replacing the `inflation` teaser; its nested section list holds `ინფლაციის მიმოხილვა`, with the same active-row, collapse, keyboard and mobile behaviour as Budget and Economy. The collapsed rail's context line reads `მონაცემები · ინფლაცია` on inflation routes. Remaining teasers (`უმუშევრობა`, `დემოგრაფია`) are untouched.

Hub: reuse `BudgetHub` card anatomy exactly as the Economy hub does. H1 `ინფლაცია საქართველოში`, a short lead, then:

1. `ინფლაციის მიმოხილვა` — active card; ink sparkline of headline y/y; footer `{latest month} · {y/y}%`.
2. `კატეგორიები`, 3. `სამომხმარებლო კალათა`, 4. `ქალაქები`, 5. `პროდუქტები` — non-clickable coming-soon cards (Economy precedent), no routes.

The preview's "latest reading" KPI strip on the hub is not carried over: the Economy hub is cards only, and the same figures live on the overview page.

## 6. Overview page composition

```text
Home / Data / Inflation / Inflation overview        Jan 2000 – Aug 2026 · updated YYYY-MM-DD

ინფლაციის მიმოხილვა
აგვისტო 2026: წლიური ინფლაცია · 5.6%
პროცენტი · წინა წლის შესაბამის თვესთან შედარებით

        წლიური ინფლაცია   თვიური ინფლაცია   ფასების ინდექსი

ხაზი | ცხრილი                                   │  სერიები
chart or monthly table                           │  search, rows, count
monthly range strip                              │  ჩამოტვირთვა
source note + methodology link                   │

ძირითადი ინდიკატორები
hero: latest y/y vs target   │  core · monthly · 12-month average
```

- **Headline line:** last available month of the headline series within the active range, for the active tab (`{month year}: {tab label} · {value}`), as the GDP page does. **Unit line:** yoy `პროცენტი · წინა წლის შესაბამის თვესთან შედარებით`; mom `პროცენტი · წინა თვესთან შედარებით`; index `ინდექსი · 2010 წლის საშუალო = 100`. The chart toolbar carries no separate unit line.
- **Tabs:** production `TextTab` in a centred, horizontally scrollable row, focus kept in view. A tab switches chart, table, panel values, headline line, unit line, available range and download together.
- **Toolbar:** `SegmentedTabs` `ხაზი / ცხრილი` only; the mode persists across tabs.
- **Series panel (right):** a thin composition of the existing `SeriesSelector` and `SeriesSelectorRow`, as `DebtSeriesPanel` composes them. Rows: `საერთო ინფლაცია` (labelled `სამომხმარებლო ფასების ინდექსი` on the index tab), `საბაზო ინფლაცია`, `საბაზო, თამბაქოს გარეშე`, and a reference row `მიზნობრივი მაჩვენებელი`. Series without values for the active tab show `—` and are left out of the chart; the target applies to the y/y tab only. Default selection: headline plus the target reference (the target is a reference line, not a series, so the "total only by default" rule holds). Unlike GDP, the panel stays because this page compares several series against a reference.
- **Download:** the dataset-owned `ExcelDownloadButton` at the panel foot, as on Budget explorers.
- **Indicators:** `ძირითადი ინდიკატორები` shows the latest published month regardless of tab or range: hero `წლიური ინფლაცია` with the 62px value, a 3px gauge measuring the reading against the target in force that month, read from the target CSV (0–15% scale, dashed target mark), and one sentence; three side KPIs — core y/y, headline m/m, 12-month average — each with the existing `Sparkline` over the last 36 months. No movers board, no period comparison table.
- **Deltas and colour:** inflation values are not coloured good/bad. Month-to-month changes of a rate are stated in percentage points (`პპ`). Falling prices are described as `გაიაფდა`.

## 7. Component reuse and narrow extensions

Reuse unchanged: `DataSidebar` and `SectionNav` patterns (after the Economy merge), `PageHeader`, `BudgetHub` card anatomy, `TextTab`, `SegmentedTabs`, `SeriesSelector`, `SeriesSelectorRow`, `Sparkline`, `ExcelDownloadButton`, `SourceNote`, `HorizontalScrollHint`, the workbook writer, the i18n message and route system.

Narrow, backward-compatible extensions (existing Budget, Debt, Deficit and GDP behaviour must not change; their tests stay green unmodified):

- `EditorialLineChart`: accept a monthly period axis — an optional period formatter for axis labels and the tooltip header, and a periods-per-year hint so labels thin to years and the dot lattice places columns at half-year or year boundaries under the existing 12px minimum-pitch rule (`lib/explorer/dotLattice.ts`). Add `ChartSeries.dashed?: boolean` for the target reference line. Periods are encoded as integers (`year × 12 + month − 1`) so existing arithmetic holds.
- `RangeStrip`: the same period formatter and periods-per-year hint; quick chips `5წ / 10წ / ყველა` computed in periods, with no one-year chip (user decision, 2026-09-11); handles step one month with arrow keys and one year with PageUp/PageDown. Year-based callers see no change.
- `SeriesSelectorRow`: an optional dashed swatch for reference rows.
- `Indicators`: extract the hero block and side-KPI row into presentational components that the budget `Indicators` keeps using unchanged; the inflation page composes them with its own figures.
- Workbook model and writer: optional readable-sheet column labels (month names instead of numeric column keys), and source-sheet coverage taken from calendar years rather than readable columns.

New code owns: inflation data selection and state, URL hash, labels and units, the Inflation navigation and cards, and one new component, **`MonthGridTable`** (below). No copied chart, slider, tooltip or table markup; no new chart library or design tokens beyond the table tint scale.

### 7.1 `MonthGridTable` — the ცხრილი view

The monthly table follows `ExplorerTable`'s anatomy (§8.4: overline headers on a 2px ink rule, `hairline-soft` rows, mono right-aligned numerals, sticky first column, horizontal scroll with `HorizontalScrollHint`) but its grid is **years as rows (newest first) × 12 month columns**:

- One series at a time. When several are selected, a `TextTab` row above the grid picks which; the default is the first selected.
- Percentage tabs tint each cell on a five-step scale: y/y `< 0` (deflation), `0–3`, `3–6`, `6–10`, `≥ 10`; m/m `< 0`, `0–0.5`, `0.5–1`, `1–2`, `≥ 2`. The value is always printed in the cell and a legend sits below, so colour is never the only cue. The top step uses paper text; every text/tint pair must pass WCAG AA contrast, checked in tests. The index tab shows plain values without tint.
- y/y adds one summary column, `წლის საშუალო`: Geostat's published December 12-month average for complete years, empty for the current partial year.
- Months outside the active range, or not yet published, are empty; missing values print `—`.
- Accessible: a real `<table>` with caption stating series, tab and unit; cell titles carry month, year and value.

## 8. State and URL

Hash keys with stable ASCII values: `i=yoy|mom|index`, `m=line|table`, `r=YYYY-MM-YYYY-MM`, `sel=cpi,core,core_ex_tobacco,target`, `t=<series>` (table series). Validate and clamp as existing explorers do. Switching tabs keeps the intersection of a manual range with the destination's coverage, keeps "all" as "all", falls back to the destination's full range when there is no overlap, and announces the new period for assistive technology. Default: `yoy`, line, the full available range of the active tab (derived from loaded facts; 2004-01 onward in the current files), headline and target selected. Language switching keeps compatible state.

## 9. Excel

One `ჩამოტვირთვა` action exports the active tab, range, selection and language through the standard three-sheet workbook:

- `მარტივი ცხრილი`: the ცხრილი grid — one row per selected series and year (`საერთო ინფლაცია — 2025`), month columns labelled by name, no change column; y/y includes `წლის საშუალო`.
- `მონაცემები`: `წელი`, `თვე`, `სერია`, `მნიშვნელობა`, `ერთეული`, `სტატუსი`; percentages as fractions with Excel percentage format, index as a number.
- `წყაროები`: the relevant Geostat files and, when the target is selected, the NBG source, with readable archive links.

## 10. Localization, SEO and accessibility

Georgian and English through the existing message and route system, with reviewed English labels (`Inflation`, `Inflation overview`, `Annual inflation`, `Monthly inflation`, `Price index`, `Headline inflation`, `Core inflation`, `Core excluding tobacco`, `Inflation target`) and review dates so `npm run i18n:check` passes. Standard localized metadata, breadcrumbs, `BreadcrumbList`, sitemap and methodology discovery. Tabs and toggles expose selected state; the range strip keeps its slider semantics; no hardcoded language in tooltips or exports.

## 11. Methodology

`docs/data-methodology/inflation-cpi-national.md` (internal) and the public `/methodology/inflation` page: sources and vintages, definitions of y/y, m/m, index and 12-month average, core inflation definitions quoted from Geostat, the 2000 comparability start and the 2004 COICOP break (which matters for the later category section), the NBG target history and its verification status, Geostat's revision policy and this project's revision check, the monthly refresh procedure, and known limitations (the national index is a weighted mean of six cities; no index level is published for core).

## 12. Verification and acceptance

Data: hash and byte parity for every archived file; exact extraction parity against the files; coverage and contiguity; English/Georgian value parity; recomputation tolerances; revision guard exercised by a test with a modified fixture; database import parity; existing datasets and budget ratios unchanged.

Behaviour: each tab shows the right series, units, headline line and coverage; the index tab excludes core cleanly; the target appears only on y/y; table and chart agree; the grid's tint bins, summary column, empty and missing cells; range transitions across tabs, quick chips, single-month range, keyboard stepping; hash restore and language switch; workbooks match tab, range, selection and language.

Visual and browser: compare against the Budget and GDP explorers at desktop and mobile widths in both languages; no clipped axes, overflow or off-screen controls; the sidebar's three datasets behave identically; existing routes, charts and workbooks unchanged.

Gates per `CLAUDE.md`: targeted tests while working; `npm run check`, `npm run build` and `npm run test:browser` once, when finished. Publishing follows the branch → PR → CI → review → merge workflow when authorized.

## 13. Authority and next step

Approval of this document authorizes the bounded Inflation hub and overview described here and the scope amendment in §2 — not categories, cities, products, basket, the calculator or any other price index. After user review, write the implementation plan (data collection and archive, prepare/validation, serving and mirror, component extensions, page, table, workbook, i18n, methodology, verification) as separate, test-first steps.
