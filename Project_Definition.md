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
- No `მალე` dataset marker remains in the sidebar: inflation, economic growth, the approved annual unemployment explorer, the trade overview and demography all ship (see the Economy items below, 2C, 2D, 2E and the Demography section below).
- Reviewed demography **data foundation** from Geostat: population on 1 January (Georgia from 2004, the 11 regions and 64 municipalities from 2015), population by sex and age, registered births, deaths and natural increase with the crude birth and death rates, total fertility rate, infant mortality rate and life expectancy (from 2014), international migration by sex and citizenship (from 2012) with fixed citizenship groups (five named countries and one computed remainder), population density for Georgia (from 2014) and the 11 regions (from 2015), the age-specific fertility rates by age of mother (from 2014), and the 2024 census counted on 14 November 2024 by age, sex and urban or rural settlement (ages for Georgia and the 11 regions, the settlement split for all 76 units), with an explicit lineage flag on every value, one registered census break at 1 January 2025, archived source tables and validation evidence. Annual data only. Approved 2026-10-01 and extended on 2026-10-03 with density, the citizenship groups and the census snapshot (`docs/superpowers/specs/2026-10-01-demography-data-design.md` §10; methodology `docs/data-methodology/demography.md`). The Population and Migration pages below are served (population on 1 January, density, and international migration by citizenship, through the serving mirror); every other family is stored and not yet served, and each still requires its page to ship.
- Demography section at `/explorer/demography`: a hub of four pages, of which **Population** (`/explorer/demography/population`) and **Migration** (`/explorer/demography/migration`) ship. Population on 1 January is an index plus a page for Georgia (2004–2026), for each of the 11 regions and for each of the 63 municipalities other than Tbilisi (2015–2026), 75 pages in all, laid out like the Budget municipalities pages; Tbilisi is one place and has its region's page only. The index has the existing municipality map (clicking a municipality opens its page; nothing selects and no buttons sit above it), four key figures and a ranked list with municipality and region tabs and search. A place page has the standard line and table workspace, a tick-list of the place and its parts (Georgia's regions, a region's municipalities), key indicators for the place and one Excel workbook of the ticked places, with the 1 January 2025 census re-base marked and never bridged (no growth, change or rank-movement figure for any pair of years that spans it). Density for Georgia and the regions is shown only as a second line under their persons on the index, one of the index's four key figures (the densest region's), a key figure on each region's page (Georgia's page shows the densest region's) and a column in the workbook: there is no density map, chart measure or toggle, and every page that shows a density carries the note that names the area it uses (Tbilisi's 504.24 km², not the 726 km² often cited). The methodology page is `/methodology/demography`. **Migration** is one page with no place pages: arrivals and departures of Georgia by citizenship (Georgia, Russia, Turkey, Azerbaijan, Ukraine and one computed remainder group) for 2012–2025, with an all/men/women filter, all six groups selected by default, a net-migration line that follows the selection, the foreign citizens' share of arrivals as a key figure, and no causes stated; it has no census marker because migration counts do not break at the 2025 re-base. Spec: `docs/superpowers/specs/2026-10-04-demography-migration-design.md`, approved 2026-10-09. The other two pages (`ასაკი და სქესი`, `შობადობა და სიკვდილიანობა`) stay `მალე` cards on the hub until their data, page and methodology exist together. The section has no MCP tool, bulk file or Dataset markup yet. Specs: `docs/superpowers/specs/2026-10-04-demography-section-design.md` and `docs/superpowers/specs/2026-10-04-demography-population-design.md`; methodology `docs/data-methodology/demography.md`.
- Excel workbook export. Each explorer has one `ჩამოტვირთვა` action for the active range, selected series, grouping, and measure; it downloads a Fiscal.ge `.xlsx` file with `მარტივი ცხრილი`, `მონაცემები`, and `წყაროები` sheets. The readable table starts on row 3 with right-aligned years, while the analysis sheet uses the Georgian headers `წელი`, `მთავარი ჯგუფი`, `კატეგორია`, `თანხა (₾)`, and `სტატუსი`. Relevant validated public-archive originals live only on `წყაროები`, with compressed year ranges and clean clickable file labels rather than raw URLs. There is no public explorer CSV action. National multi-year workbooks always retain the full GEL amount, add `მშპ-ის წილი (%)` and link the validated GDP source workbook only for the active `% მშპ-ში` measure; the Debt-rate exception leaves the GEL amount blank and adds `საპროცენტო განაკვეთი (%)`. Workbooks do not expose denominator, accounting-standard, publication-status, or source-metadata columns. Methodology manifest CSVs remain unchanged.
- Annual trade **research foundation**, approved 2026-10-07: national merchandise exports/imports, partners, HS4 products and published country groups (1995-2025); HS6, SITC sections and BEC categories (2000-2025); domestic exports with selected products and Other commodities (2014-2025); registered-address regional trade including Unknown (2022-2025); and twelve service types, countries and type-country source tables (2020-2024). Original files, source-cell provenance, historical identity limits, reproducible research CSVs and independent verification stay in `docs/Raw Data/Trade/`. Source conflicts remain explicit acceptance holds. No trade page, route, navigation change, public download, MCP publication or serving-mirror import is approved by this foundation. Specification: `docs/superpowers/specs/2026-10-07-trade-data-design.md`; methodology: `docs/data-methodology/trade-annual.md`.
- Georgian-first UI.
- Minimal public source label.
- Internal source/provenance metadata.
- Public methodology and original-source centre: a `/methodology` hub plus live pages for expenditure, revenue, municipalities, Government Debt, GDP, national economic sectors, regional economies, inflation, unemployment, trade, and demography; complete public decision records for the budget and municipal datasets; concise dataset-specific pages elsewhere; and untouched upstream files available individually and as category archives. Future dataset names remain non-clickable `მალე` markers until their data, methodology, validation, and sources are ready together. Approved design: `docs/superpowers/specs/2026-08-11-methodology-portal-design.md`.

- Economy hub at `/explorer/economy` and annual GDP overview at `/explorer/economy/gdp`: four centered Real GDP, Nominal GDP, GDP growth and nominal GDP-per-capita tabs, existing chart/table/range/download components, GEL/USD for nominal measures only. Scope and source boundaries: `docs/superpowers/specs/2026-09-10-gdp-overview-design.md`. GDP methodology is live with the feature; the six GDP series are also exposed through read-only MCP and central bulk downloads. Population integration remains deferred.
- National economic sectors at `/explorer/economy/sectors`: 20 NACE activities and a separately published total GDP reference, with nominal GEL and GDP share for 2010–2025 and real growth for 2011–2025. One workspace reuses the existing chart, table, unlimited selector, year range and Excel components, with a joined three-way measure switch and no top indicator tabs. Sector values are GVA at basic prices; GDP-share denominators are national GDP at market prices. Source-supported growth is never replaced by nominal growth. Both languages, source originals, methodology, read-only MCP and central bulk downloads are included. Regional sectors remain a separate dataset and route family. See `docs/data-methodology/economic-sectors.md`.
- Regional economies at `/explorer/economy/regions`: an All Regions index with an 11-region map and GDP-ranked list, plus 11 selectable detail pages. Each detail page contains Total regional GDP and 20 NACE Rev. 2 activities for 2010–2024, with exactly two measures: current-price GEL and each activity's share of that same region's complete market-price GDP. Activity values are GVA at basic prices; total regional GDP is at market prices, so activity shares need not sum to 100%. The feature includes bilingual pages, Excel, methodology and original sources, the read-only `query_regional_economies` tool, and complete JSON/CSV publications. It does not include 2025, real growth, per-capita values, a region's share of Georgia's GDP, forecasts, USD, sector or detail-page rankings, or multi-region charts. See `docs/data-methodology/regional-economies.md`.

The approved national-sector page also includes four point-in-time highlights: largest sector and GDP share, highest annual real growth, largest annual decline (or slowest growth), and combined GDP share of the three largest sectors. These use all national activities in the selected final year, independently of chart selection and measure; unavailable growth stays missing. No regional or additional indicator scope is implied.

### Excluded From V1

- Broad public data catalog.
- Historical municipal per-capita series, detail-page per-capita measures, and per-capita exports. V1 includes only the bounded 2025 index map, supporting list values, and median KPI described above.
- The six selected-detail municipal categories. Only the ten main functions are served.
- Any public use of demography data beyond the Population page's population and density and the Migration page's migration by citizenship (the rest of the reviewed foundation is stored and not yet served). Unemployment is bounded by the approved extension in 2D.
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

Approved 2026-09-11 (`docs/superpowers/specs/2026-09-11-inflation-overview-design.md`) and extended 2026-09-12 (`docs/superpowers/specs/2026-09-12-inflation-categories-design.md`) and extended 2026-09-26 (`docs/superpowers/specs/2026-09-26-inflation-cities-design.md`), amended 2026-09-30 (`docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md`). For this dataset only, the "data behind the sidebar indicator markers" and "quarterly or monthly data" exclusions are lifted:

- Inflation hub at `/explorer/inflation` and Inflation overview at `/explorer/inflation/overview`: monthly national CPI from Geostat — headline index (2010 = 100), annual and monthly inflation, the 12-month average, core inflation and core excluding tobacco — with the National Bank of Georgia inflation target as a reference line; year × month table; Excel download; Georgian and English.
- Inflation categories at `/explorer/inflation/categories`: the national CPI decomposed into its 12 COICOP divisions and 43 subgroups — annual and monthly price change per group, the annual consumer-basket weights, and a contribution-to-inflation measure derived by Fiscal.ge from those two published series with a visible residual that closes the stack on the published headline; stacked column chart, year × month table, Excel download; Georgian and English.
- Inflation cities at `/explorer/inflation/cities` and one page per city at `/explorer/inflation/cities/{city}`: annual inflation in Geostat's six price-collection cities (Tbilisi, Kutaisi, Batumi, Gori, Telavi, Zugdidi) from 2016-01. The Georgia page compares the six cities' totals with Georgia's national rate; each city page shows that city's total and 12 COICOP divisions. The 12-month average feeds the table's annual-average column; line chart, year × month table, Excel download; Georgian and English. Monthly city rates are served through the MCP and the bulk publications only. Implied city weights are a validation check only and are never published.
- Methodology page `/methodology/inflation` with the archived Geostat and NBG source files.
- Read-only MCP access and bulk publications for the inflation data above: `query_inflation`; inflation in `describe_coverage`, `get_sources`, `compare` and `rank`; and `inflation-national.json`, `inflation-categories.csv` and `inflation-categories.json`. Approved 2026-09-14 (`docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`) and, approved 2026-09-26, city data through `query_inflation` `entityIds`, city rankings in `rank`, city comparisons in `compare`, and `inflation-cities.csv` / `inflation-cities.json`.
- Reviewed individual-product inflation **data foundation** from 2015 for every item in the latest Geostat basket: archived bilingual original workbooks, explicit identity decisions, a current-product catalogue, published monthly and annual product indices, and validation evidence. Approved 2026-09-26 (`docs/superpowers/specs/2026-09-26-inflation-products-data-design.md`).
- Individual-product explorer at `/explorer/inflation/products`: default annual product-inflation chart with searchable multi-selection and a year range, one icon-only cumulative switch, four indicators, an illustrated complete list of current products ranked by selected-years cumulative change, and a three-sheet Excel workbook. The right-side selector remains ranked by latest annual change. The cumulative figure is derived from Geostat's published monthly product indices. Georgian and English routes, source/methodology disclosure and the parity-checked serving mirror are included. Approved in `docs/superpowers/specs/2026-09-27-inflation-products-explorer-design.md`.
- Approved bounded MCP extension for reviewed current-basket products: dataset `inflation-products`, `query_inflation_products` for published annual changes and cumulative changes calculated from complete monthly inputs, bilingual catalogue/source discovery, annual-rate comparisons in percentage points, annual/cumulative value rankings, and compact `inflation-products.csv` / `inflation-products.json` publications. Stable product IDs, reviewed identity limits and explicit missingness remain authoritative; retired products, city products, product weights/contributions, GEL retail prices and a price calculator remain excluded. This later approval extends the earlier product-explorer scope; it does not rewrite that historical approval. See `docs/superpowers/specs/2026-10-01-mcp-inflation-products-design.md`, the approved unified implementation plan and `docs/data-methodology/inflation-products.md`.

Still excluded: city subgroups, city price indices (2010 = 100), city weights and contributions, core inflation by city, the price calculator, a standalone basket-composition section, every other price index (producer, import, construction, property, agricultural), HICP, and monthly or quarterly data for any other dataset. Each needs its own approved spec.

## 2D. Approved annual unemployment extension

Age-page amendment approved on 2026-10-07: show only the source-published age groups from 2020 onward, with no Georgia reference. Keep the current eight indicators in a native dropdown, grouped into percentages and people counts, with its original compact underlined appearance. Below the existing chart/table workspace, add an age-by-year heatmap for the same indicator and active years. It always shows all eleven age groups in age order, independently of the chart selection, with labelled one-decimal values, a common colour scale and dashes for missing observations. The youngest available age group is selected initially. Old shared settings normalize to this scope; Excel exports contain the selected modern ages and active years. This amendment changes no canonical observations and adds no source recapture or new chart library.

Regional amendment approved on 2026-10-06: `/explorer/unemployment/regions` reuses Economy's eleven-region map and ranked searchable list, showing the latest published unemployment rates. Each modern region opens a static `/explorer/unemployment/regions/[id]` page, mirrored under `/en`. Its nine available overview indicators are checkboxes, with hired and self-employed counts beneath Employed for 2020–2025; employment rate is omitted, and percentages and people counts are mutually exclusive. Only that region's unemployment rate is selected by default; its own published coverage sets the range. Selecting Employed with its children retains the parent's longer history and unavailable child values before 2020. Region pages reuse the region picker and three-sheet Excel export. Historical combined regions and former comparison links remain accessible through the index's comparison view, using the same checkbox/unit rules. No municipality boundaries, markers or municipal unemployment data are added. This amendment supersedes the earlier regional-page controls and individual-region route exclusion below.

Approved on 2026-10-04, navigation amended on 2026-10-05 and overview selection amended on 2026-10-06: the unemployment hub at `/explorer/unemployment` has four cards, in order: Unemployment overview (`/overview`), Regions (`/regions`), Age groups (`/age`) and Gender (`/gender`). Each opens its own static data page under that hub, mirrored in English under `/en`. Urban/rural, education and long-term unemployment are supporting tabs within the unemployment overview, alongside its Overview tab; they have no separate cards or routes. The existing methodology pages remain. The pages reuse the editorial line chart, table, annual range controls, unlimited searchable series selection and three-sheet Excel export. The sidebar lists the same four sections; demography remains a marker. Existing shared links to the former single explorer open the appropriate new page with their settings preserved.

The reviewed Geostat Labour Force Survey dataset has 3,370 annual survey-estimate observations, including 96 hired/self-employed counts for national and urban/rural series in 2010–2025 and 132 for eleven regions in 2020–2025, promoted from the preserved sources. National, sex, urban/rural, age and regional data retain unemployment, employment and participation rates, unemployed/employed counts, labour force, people outside the labour force and survey population aged 15+. Education retains its three published source rates, separately for total, women and men. The overview UI omits employment rate, and its Education tab displays unemployment rate only. The national overview lists indicators as checkboxes, with employment subcategories; settlement parents select unemployment rate and expand to other indicators; long-term indicator rows select Georgia and expand only to Men/Women. Selecting a percentage clears people counts and vice versa, while multiple series of one unit are allowed. Bulk selection stays within the active unit and ignores search. Long-term unemployment retains count, rate relative to labour force and share of all unemployed people. A national stacked-column chart shows employed, unemployed and outside-labour-force counts in thousand persons. The Gender amendment requested on 2026-10-07 moves its eight existing indicators into expandable Men/Women groups, replacing the indicator dropdown with the same unit-safe checkbox pattern as Urban/rural. Only the national unemployment-rate reference is initially selected. Age page controls retain their existing scope.

Overview and Gender retain their national unemployment-rate default; regional pages use their own reference, and Age groups starts with the youngest published age group. Available years come from the loaded facts. Education retains its Total/Women/Men choices and matching reference; long-term defaults to its published rate. The national population-composition chart appears only on the national overview's Overview tab. Core coverage currently starts in 2010; education and long-term begin in 2020. Historical age bands and combined regions keep their own identities and gaps. No missing value is estimated. Rates and counts display to one decimal; exact values and original provenance remain available for validation and serving parity. Excel headers use percent or thousand-person units, with actual status and validated source links.

This extension adds the private Prisma serving mirror and transactional import support, seven original workbooks, source-page capture and survey metadata. The navigation amendment changes no reviewed data or database structure. It adds no unemployment MCP tools, central machine-readable dataset publications, quarterly data, forecasts, NEET, municipal unemployment, age-group detail routes, new chart library or advanced visualization beyond the approved age heatmap. Publishing and live database migration/import remain separate delivery operations. Authority: `docs/superpowers/specs/2026-10-04-unemployment-reuse-explorer-design.md`; methodology: `docs/data-methodology/unemployment-annual.md`.

## 2E. Approved Trade hub and national goods Overview

Approved on 2026-10-08: a Trade hub at `/explorer/trade` with one working Overview card at `/explorer/trade/overview`, mirrored under `/en`. Trade follows Unemployment in the sidebar; Demography remains a marker. The research foundation above remains separate from this bounded serving extension.

The Overview serves annual national goods totals for 1995–2025: Total trade (exports + imports), Exports, Imports and Trade balance (exports − imports), all in nominal USD. Only Total trade is initially selected and remains removable. Any checkbox combination is valid. Reuse the existing line chart, table, annual range controls, searchable selector and three-sheet Excel export. URL state and language changes preserve years, mode and explicitly empty selections.

Four summary figures use the active end year independently of checkbox selection. A single signed balance bar chart uses the active years and remains visible in table mode and with an empty main selection. Missing observations remain missing; no percentage-growth, GDP-share, inflation adjustment or currency conversion is added.

Promote only the 62 national export/import observations and 62 reviewed turnover/balance derivations into canonical CSVs and the private parity-checked database mirror. Preserve exact source decimals, FOB exports, CIF imports and unspecified publication status. Total exports include re-exports; separate re-export, services, country, product, regional, partial-2026 and forecast comparisons are outside this page. The wider research package's two services acceptance holds remain unresolved. Publish only the original national goods workbook and the two approved methodology/metadata captures through the existing source archive. No Trade MCP tool, central bulk dataset publication or new public API is included.

Scope: `docs/superpowers/specs/2026-10-07-trade-overview-design.md`. Data rules: `docs/data-methodology/trade-annual.md`. Publishing and live database migration/import remain separate authorized operations.

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
