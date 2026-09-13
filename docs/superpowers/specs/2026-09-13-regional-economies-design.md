# Regional economies — implementation specification

Date: 2026-09-13
Status: Product and visual direction approved; implementation planning pending
Scope: Annual regional GDP and economic activities for Georgia's 11 published regions, 2010–2024

## 1. Product decision and design authority

Build Regional economies as the third live destination in the existing Economy hub. Readers should be able to scan all regions, choose one region, and explore its total GDP and complete economic-sector structure over time.

Confirmed user decisions:

- Follow the existing Municipality navigation model: an All Regions index plus one page per selected region.
- Show one region at a time. Do not overlay several regions in the detailed chart.
- Include total regional GDP and all 20 published NACE Rev. 2 activities.
- Use one shared line/table workspace with only two measures: nominal GEL and share of the selected region's GDP.
- Reuse the national Sectors measure switch: literal `₾` and Lucide `ChartPie`, including the existing tooltip, touch, focus and accessibility behaviour.
- Do not add a "share of Georgia" measure to region pages.
- Sector share means sector GVA divided by the selected region's market-price GDP. The sectors are not forced to sum to 100%; net product taxes explain the difference.
- The user approved design-shotgun direction A, the Municipality mirror, on 2026-09-13. The disposable reference is `design-shotgun/regional-economy-2026-09-13/variant-a.html`.

`Project_Definition.md` section 2 and `DESIGN.md` v4.1 remain authoritative. The approved HTML is a structural reference only. Production must reuse the existing components, typography, spacing, map geometry and interaction rules rather than copying the preview's standalone CSS, schematic map, English-only copy or illustrative chart lines.

## 2. Included scope and boundaries

Deliver:

- `/explorer/economy/regions` and `/en/explorer/economy/regions`.
- Eleven static region pages at `/explorer/economy/regions/[id]` and their `/en` companions, using the existing region IDs without the `region.` prefix.
- An All Regions index using the existing verified Georgia geometry, latest-year regional GDP colouring, a ranked searchable region list, and concise summary values.
- A selected-region page with total regional GDP, 20 sectors, GEL/share switching, line/table modes, range controls, searchable unlimited selection, approved highlights and Excel download.
- Reviewed source preservation, deterministic preparation, validation reports, canonical CSV/database parity and fully static page generation.
- Georgian and English presentation, source notes, methodology, original-source downloads, sitemap/metadata, read-only fact querying and central JSON/CSV publications.

Excluded:

- More than one selected region in the detailed chart.
- A region's share of national GDP or national-sector share as a region-page measure.
- Regional real growth, constant-price levels or nominal change labelled as economic growth.
- Regional GDP per person, population integration or any population estimate.
- 2025 estimates, forecasts, quarterly data or automatic upstream refresh.
- Municipal GDP or an allocation of regional GDP to municipalities.
- Sector detail/drilldown pages, employment, wages, productivity, investment, exports, turnover, growth contributions, bar/stacked modes or custom chart types.
- Homepage changes, new dependencies, a public API or runtime budget-data requests.

The Geostat source currently ends in 2024. The application must state that boundary plainly and must not carry national 2025 data into regional pages.

## 3. Source evidence and observed coverage

The earlier reviewed package contains these source files:

| Source | Role | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| `regional-GDP-ENG.xlsx` | Published regional GDP totals | `dd2042dff5e2c44b98b4bb140163b5736cf5a71f4683b9e6a359373907d59c35` | 13,871 |
| `regional-GDP-by-activities-ENG.xlsx` | Published regional activity values and reconciliation rows | `88e337bd82a5232ea5260f011b11cb2d82c2cec5115fddbe92d14d1ff3945337` | 99,089 |
| `geostat_nominal_current.xlsx` | Same-vintage national validation reference | `21a576c9c20434a87bcb32047cd143eef2b8d3f3ff360442b420c76b0da27d34` | 50,098 |

The regional-total workbook is already preserved at `docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/regional-GDP-ENG.xlsx`. Verify its bytes against the reviewed package and reuse that registered original rather than committing a duplicate. The national validation workbook is already preserved by GDP overview. Add the missing activity workbook under the Economy regional source archive with its observed source URL, retrieval date, hash, size, titles, sheets, release note and metadata link.

Observed source contract:

- Geostat is the authoritative publisher.
- Annual coverage is 2010–2024 inclusive.
- There are 11 region sheets and geographical units, including Tbilisi and Adjara A.R.
- Each region sheet contains the same 20 NACE Rev. 2 activities A–T, GDP at basic prices, product taxes, product subsidies and GDP at market prices.
- Activity values are gross value added at basic prices in million GEL, not turnover.
- Total regional GDP is at market prices in million GEL.
- The source states last update 23 December 2025 and does not designate individual 2024 observations as preliminary. Preserve them as final as published; do not invent a statistical revision claim.

The reviewed package established 165 regional totals and 3,300 region-sector values, with no missing values or duplicate keys. It also retained 495 tax/subsidy reconciliation rows. The implementation must independently regenerate and verify these facts from the hash-checked originals instead of copying the research CSVs blindly.

## 4. Identities, geography and accounting meaning

Reuse `data/taxonomy/municipal-regions.json` as the only region identity set:

- `region.tbilisi`
- `region.adjara`
- `region.guria`
- `region.imereti`
- `region.kakheti`
- `region.mtskheta_mtianeti`
- `region.racha_lechkhumi_kvemo_svaneti`
- `region.samegrelo_zemo_svaneti`
- `region.samtskhe_javakheti`
- `region.kvemo_kartli`
- `region.shida_kartli`

Use the existing IDs and ordering for URLs, map groups, labels and queries. A reviewed source-label crosswalk must handle `Adjara A.R.` and shortened workbook sheet names such as `Racha`, `Samegrelo` and `Samtskhe`; fuzzy or positional matching is not allowed. Reuse the existing bilingual region labels and add missing English display data through the established localization catalogue rather than creating a second region registry.

Reuse `data/taxonomy/economic-sectors.json` for `sector.a` through `sector.t`. Regional and national pages must share sector identity, display names and colours. The same sector ID does not imply that values from the national and regional publications can be substituted for one another.

For each region and year:

```text
sum of 20 sector GVA values = GDP at basic prices
regional GDP at market prices = GDP at basic prices + taxes on products − subsidies on products
sector share of region GDP = sector GVA / regional GDP at market prices × 100
```

Product taxes and subsidies are validation inputs, not economic sectors. Do not allocate them across the 20 activities or add a synthetic "other" sector.

Seven national-sector allocation differences occur in the separate national publication during 2020–2022. Regional sector values and shares must remain internally source-consistent: any regional/national-sector comparison uses the sum of the 11 regions from the regional publication, never a mixed denominator. The selected region pages do not expose national-sector share, but validation must preserve this known difference so a future feature cannot silently mix publications.

## 5. Measures, state and numerical rules

The selected-region workspace has two measures:

| Control | Stable value | Meaning |
| --- | --- | --- |
| `₾` | `nominal` | Published regional GDP at market prices or sector GVA at basic prices, converted from million GEL to full GEL |
| Lucide `ChartPie` | `share_of_region_gdp` | Sector GVA divided by the same region/year's market-price GDP; total regional GDP is 100% |

Use the existing national-sector `SegmentedTabs` presentation, 36×36 icon targets and `ControlTooltip`. Keep localized accessible names and the active measure explanation. Do not show a disabled third segment or the national real-growth icon.

Defaults are nominal GEL, line mode, full loaded range and only Total regional GDP selected. Total remains first, selectable and removable. All 20 sectors are individually selectable without a limit. Search matches both languages and NACE code but never changes the selection denominator, bulk action or Excel export.

Switching measure preserves region, selected series, range, chart/table mode and colours. URL-hash state persists measure, range, view and selection through reload, language switch and browser history. Unknown values are rejected, duplicates removed and manual ranges clamped to loaded facts. An absent selection parameter means the total-only default; an explicitly empty selection remains empty.

The share denominator is the complete regional GDP value for that year and is independent of visible or selected sectors. Canonical machine values use percentage points (`9.9` means `9.9%`). Convert once to fractions where the existing table/Excel interfaces require them. Preserve exact source decimals through extraction and calculation; round only for public display.

Zero is a real value. Missing data must remain missing, never zero or interpolated. Reject missing, nonfinite or nonpositive GDP denominators. Do not calculate or display nominal year-over-year change as real economic growth.

## 6. All Regions index

The index follows the current Municipality page's map/list relationship, using regional GDP rather than municipal budget:

- Heading and concise scope: regional economies, current prices, 2010–2024.
- Map uses the repository's verified municipality geometry grouped by the existing 11 region IDs. Do not ship the schematic preview polygons or fetch geometry in the browser.
- Colour regions by latest available total regional GDP, derived from loaded facts. Default/latest is 2024 because the source ends in 2024; do not hardcode the year independently of the data.
- Map legend names the measure and unit. The colour scale and tooltip use the same unrounded regional values as the ranked list.
- The right panel lists all 11 regions ranked by latest-year total GDP, with search and values. A row and its map region share hover/focus state. Both navigate to the same static region page.
- Summary values show region count, latest-year largest regional economy and loaded period. They are derived from facts, not copied text.
- The index does not add a year selector, region comparison chart or national-share column in this release.
- Keyboard, touch, focus, narrow-screen and reduced-motion behaviour follow the existing Municipality map/list implementation.

The existing Municipality index and its budget-per-resident map must remain unchanged. Generalize a shared boundary only where reuse is genuinely smaller and clearer than copying; do not force regional GDP concepts into municipal data types.

## 7. Selected-region page

The selected-region page mirrors Municipality detail navigation and the national Sectors workspace:

1. Economy/Regional economies breadcrumb and data-derived 2010–2024 coverage.
2. Region-specific H1 and entity picker containing all 11 regions plus a clear route back to All Regions. Previous/next behaviour follows existing entity-picker conventions.
3. Headline total regional GDP at the active range's final year, independent of selected sectors.
4. Standard chart/table workspace with Line/Table on the left and the `₾`/`ChartPie` measure switch on the right.
5. Existing `EditorialLineChart` or `ExplorerTable`, then `RangeStrip` and a concise Geostat source note.
6. Standard 292px series aside on wide layouts: search, clear/select-all behaviour, selected/all count, end-year values and Excel action. It stacks below the chart at the existing breakpoint.
7. Approved Budget-style hero plus three side highlights, calculated for the active range's final year from all 20 sectors regardless of chart selection:
   - Hero: largest sector by nominal GVA, its GEL amount and share of regional GDP.
   - Side 1: total regional GDP.
   - Side 2: combined regional-GDP share of the three largest nominal sectors.
   - Side 3: 20 published sectors.
8. Accounting note: sector shares do not sum to 100% because market-price GDP includes net product taxes.

Rank sector rows by the active measure's end-year value, descending. Keep Total regional GDP first and stable NACE order for ties. Use existing stable sector colours across national and regional pages. Full names must remain readable and accessible on mobile through the national Sectors table's opt-in wrapping behaviour.

The headline and highlights change with the active range's final year, not with selected chart rows. There are no fastest-growth, decline or period-change claims because the dataset contains current-price values only.

## 8. Component reuse and responsive behaviour

Use these existing production patterns directly or through narrow backwards-compatible extensions:

| Responsibility | Existing pattern |
| --- | --- |
| Map, map/list coordination and geometry | `MunicipalityMap`, `MunicipalitiesIndex`, municipality geometry and region taxonomy |
| Region selection | `EntityPicker` and municipal-region route/picker construction |
| Workspace, chart, table and range | `EconomicSectorsExplorer`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip` |
| Two-measure icon control | `SegmentedTabs`, `ControlTooltip`, national Sectors icon implementation |
| Series search and unlimited selection | `SeriesSelector`, `SeriesSelectorRow` and national sector panel |
| Highlights | National sector/Budget hero-plus-side-KPI layout, `Sparkline` only where a truthful trend is shown |
| Excel | `ExcelDownloadButton`, shared workbook model/writer and national Sectors adapter |
| Shell and localization | Existing Economy routes, `DataSidebar`, `PageHeader`, `pageHref` and message catalogues |

Do not clone the Municipality explorer or national Sectors component wholesale. Put regional calculations and state in regional modules; extend shared primitives only when existing callers retain their current defaults and tests.

Verify Georgian and English at 390, 768, 900, 1100 and 1440px, including the sidebar transition. The map/list stacks without document overflow; map regions, list rows, picker, measure buttons, chart and table remain keyboard/touch usable. Long region and sector names must not cover values. Nothing animates on initial load.

## 9. Data preparation, validation and database mirror

Follow the established architecture:

```text
immutable reviewed XLSX originals
→ deterministic offline extraction and validation
→ canonical reviewed CSV and reconciliation report
→ transactional Prisma/Supabase mirror with exact read-back parity
→ build-time static page data and fact-query snapshot
```

Ordinary builds must not fetch Geostat or read from unbundled runtime source documents. Reviewed CSVs remain canonical; the database is a parity-checked serving mirror and is never edited directly.

Use a flat observation model identifying region, total/sector series, year, measure, exact value, unit, valuation, price basis, status, source ID, source locator and review date. Reuse the region and sector registries. Keep taxes, subsidies, basic-price totals, national reconciliation and cross-publication differences in staging/report evidence rather than publishing them as selectable rows.

Validation must fail closed unless it proves:

- Expected hashes, byte sizes, source titles, sheet names, release note and annual headers.
- Exact mapping of 11 source sheets to canonical region IDs.
- Exact A–T codes and official activity labels on every sheet.
- Coverage of 11 × 15 = 165 regional totals and 11 × 20 × 15 = 3,300 sector amounts, with no gaps or duplicate keys.
- Every sector sum/basic-price identity and market-price tax/subsidy reconciliation within a fixed predeclared decimal tolerance.
- Every annual sum of 11 published regional totals against the same regional publication's national total.
- Correct sector-share calculation using each region's full market-price GDP.
- Explicit retention of the seven known 2020–2022 national-versus-regional activity-allocation differences.
- Stable deterministic bytes, UTF-8 BOM where required, exact decimal capacity and CSV/database parity.
- A second preparation run produces no changes.

Verify migration, double import, parity and rollback with a disposable database. Never use production for fault injection. Existing GDP, national-sector, budget, inflation and municipality table counts/digests must remain unchanged when an injected regional mismatch causes rollback.

## 10. Excel, methodology and public machine-readable data

One Excel action exports the selected region, active measure, selected rows, range and language. Search does not narrow the export.

- `მარტივი ცხრილი` / readable sheet: selected series as rows, years as columns and a clear active unit.
- `მონაცემები` / analysis sheet: region, year, series, value and status. Nominal mode retains full GEL; share mode contains the percentage and its nominal GEL numerator.
- `წყაროები` / sources sheet: validated original regional workbook links and concise accounting/coverage definitions.

Use numeric Excel cells and existing formats. Preserve true zeros and missing cells distinctly. Internal source cells, hashes and processing fields remain in internal reports rather than public workbook columns.

Add `/methodology/regional-economies` and `/en/methodology/regional-economies` through the existing methodology system. Cover geographical units, period, GVA versus GDP, basic versus market prices, share denominator, taxes/subsidies, source vintage, no regional 2025, no real-growth claim, the seven publication differences, validation and original files.

Add a dedicated bounded read-only query contract, not new region parameters inside `query_gdp` or `query_economic_sectors`. It may return regional totals and sector facts for requested canonical region IDs, years, measures and series within existing row/size limits. Machine responses must identify region, sector, unit, valuation, current-price meaning, source and the share denominator in both languages.

Generate central regional-economy JSON/CSV publications from the same snapshot used by MCP. Register hashes, data version, catalogue entries, capability discovery and bilingual definitions through existing publication tooling. Add localized sitemap rows, reciprocal hreflang/canonical metadata, breadcrumbs and Dataset JSON-LD for the index, 11 region pages and methodology. Do not advertise routes or downloads before their artifacts exist.

## 11. Implementation sequence and acceptance

1. Preserve and validate the missing regional-activity original; prove exact geography, activity, coverage and accounting identities.
2. Build deterministic canonical preparation, reports and the transactional database mirror.
3. Build the All Regions index by reusing verified geometry and Municipality map/list behaviour.
4. Build the selected-region workspace from the national Sectors components, with the two approved measures and highlights.
5. Complete Excel, methodology, source archive, localization, SEO, MCP and central publications.
6. Run focused checks while editing, then the repository's final gates once: `npm run check`, `npm run build` and the full browser suite. Query changes also require the unchanged 20-intent reference fixture.
7. Perform independent review and resolve confirmed findings. Publishing remains a separate authorization and follows `codex/* → commit → push → draft PR → green required CI → review/resolved conversations → merge → deployment → live verification → synchronization and cleanup`.

Required acceptance evidence:

- The source counts, mappings, hashes and all reconciliation rules above pass from a clean checkout.
- CSV and disposable-database builds produce identical regional values and static routes.
- The Economy hub and sidebar activate Regional economies only when data, pages and methodology are ready together.
- All Regions map/list values, ranking, colours, hover/focus and destinations agree for 2024 derived from loaded facts.
- Every region page defaults to total-only nominal GEL and offers exactly `₾` and `ChartPie` measures.
- Chart, table, selector, headline, highlights, Excel, central files and MCP agree for representative large and small regions, true-zero activity values and both measures.
- Selection, search, empty/all states, range, hash persistence, language switching and back/forward work as specified.
- Mobile and desktop screenshots match the approved structure while using production components and the real verified map, not preview CSS or schematic geometry.
- Existing Budget, Municipality, GDP, national Sectors and Inflation behaviour remains unchanged except for intentional additive navigation/discovery.
- No homepage, population, per-capita, 2025 estimate, USD, real-growth or multi-region comparison scope enters the implementation.

During implementation, update `Project_Definition.md` section 2 for the approved Regional economies feature and add only the bounded regional extension to `DESIGN.md`. Add a dedicated regional methodology document and update the database-import documentation where the new mirror requires it. Keep execution logs out of durable design authorities; record run evidence in the implementation plan.
