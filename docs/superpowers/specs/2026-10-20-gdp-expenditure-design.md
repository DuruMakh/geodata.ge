# GDP by expenditure page (Economy hub)

Date: 2026-10-20
Status: Draft for Duru's review. Duru picked option 1, "What the economy is spent on", from the more-data list on 2026-10-20 (project chat, "do 1.2.3.4 as a seperete threads"). This document covers the data foundation and the one new page.

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, what Georgia's GDP is spent on: how much households and the government consume, how much is invested, and how much is exported and imported. It is the standard "expenditure" view of GDP and sits next to the existing GDP overview, Sectors (what GDP is produced by) and Regional economies pages.

The page answers questions such as:

- How big is household spending? 72.3 billion GEL in 2025, 69% of GDP (104.6 billion GEL). It was 77% in 2010 and peaked at 80% in 2021.
- How much does the government consume? 14.5 billion GEL in 2025, 14% of GDP.
- How much is invested? 22.3 billion GEL in 2025 (21% of GDP), of which buildings and equipment 19.9 billion.
- How open is the economy? Exports 49.6 billion GEL (47% of GDP), imports 55.7 billion GEL (53% of GDP) in 2025.
- Which part grew fastest in real terms? In 2025 real GDP grew 7.5%; household and non-profit consumption 8.6%, government consumption 19.6%, investment fell 5.5%.

The page looks and works exactly like the live Sectors page: same chart, table, year range, three icon measure switches (₾ / share of GDP / real growth), right-hand series list and Excel download. No new chart type, library or visual direction is added.

## 2. Page and navigation

| Page | Georgian path | English path | Name (Georgian / English, proposal) |
| --- | --- | --- | --- |
| GDP by expenditure | `/explorer/economy/expenditure` | `/en/explorer/economy/expenditure` | დანახარჯები / Expenditure |
| Methodology | `/methodology/gdp-expenditure` | `/en/methodology/gdp-expenditure` | მშპ დანახარჯების მეთოდით / GDP by expenditure |

- The page heading is "მშპ დანახარჯების მიხედვით" / "GDP by expenditure", following Geostat's own Georgian title ("მშპ დანახარჯების მეთოდით").
- The sidebar lists it under Economy after Sectors: Economy overview, Sectors, Expenditure, Regional economies.
- The Economy hub gets a fourth card, after Sectors, with the same card anatomy as the other three: a sparkline of households' share of GDP 2010–2025 and the footer "2025 · Households 69.1% of GDP · 2010–2025 · preliminary".
- Breadcrumbs, language links, metadata, Dataset JSON-LD and the sitemap follow the Sectors page.

## 3. The page

Under the heading there is one short line (`LatestValueLine`), which follows the measure, as on Sectors:

- ₾: "GDP 2025: 104.6 billion ₾ · preliminary"
- Share of GDP: "Households 2025: 69.1%"
- Real growth: "GDP 2025: 7.5% · preliminary"

Nothing else sits under the heading. Under the chart there is one short source line, as on Sectors.

**Measures.** Three icon-only switches on the chart toolbar, the Sectors set (Duru's rule that share of GDP and real terms of the same series are icon toggles, not tabs):

- **₾** — current-price amounts, 2010–2025, Geostat table 08.
- **Share of GDP** — each amount divided by the same year's GDP, 2010–2025 (our calculation, as on Sectors).
- **Real growth** — change on the previous year in real terms, 2011–2025, Geostat table 09.

**Series list.** Every row is visible from the start, under small headings, nothing collapsible, no name prefixes. Fixed order, not ranked by size:

- **GDP** (pinned at the top)
- **Consumption**: Total consumption; Households; Non-profits serving households; Government; Government individual services (such as health and education); Government collective services (such as defence and public order)
- **Investment**: Total investment; Buildings and equipment; Change in inventories
- **Exports**: Total exports; Goods; Services
- **Imports**: Total imports; Goods; Services

On arrival the chart shows **GDP, Households, Government, Total investment, Total exports and Total imports** (₾, all years). This departs from the site's "only the total on arrival" rule because GDP alone is one line and says nothing about the split; Duru's approval of this design approves that default for this page, and `Project_Definition.md` records it. The rest of the selection behaviour is the Sectors behaviour: unlimited selection, GDP first and removable, Chart | Table, year range, Excel, all kept in the URL.

**Two honest gaps in real growth.** Geostat publishes real growth for households and non-profits only together, and none for change in inventories (it can be negative, so a growth rate means nothing). So in the real-growth view:

- Households and Non-profits are replaced by one row, "Households and non-profits", Geostat's own combined series. Switching measure carries a ticked Households or Non-profits row over to it, and back.
- Change in inventories is not listed.

We never add households and non-profits up ourselves, and never estimate a missing rate.

**Imports** are shown as positive amounts, as Geostat prints them. GDP equals consumption + investment + exports − imports; the methodology page says so in one sentence. Shares therefore do not add up to 100% and imports' share is positive (53% in 2025).

**Preliminary 2025.** Geostat marks 2025 as preliminary and will revise it on 13 November 2026. 2025 is marked preliminary in the chart, table, source line and Excel, as on Sectors.

**Formatting.** Amounts in billion ₾ with one decimal in the chart, list and lines (the Sectors unit rule); table and Excel as on Sectors. Shares and growth with one decimal. A missing value is a gap, a dash or an empty Excel cell, never zero. Change in inventories can be negative (2017, 2021) and is drawn as such.

## 4. Data foundation

- **Source:** Geostat, National Accounts › GDP (categories/23), release of 28 September 2026:
  - `08_GDP-by-use-categories.xlsx` (current prices, million GEL) — amounts;
  - `09_Real-GDP-growth-by-categories-of-use.xlsx` (previous year = 100) — real growth;
  - `10_GDP-by-categories-of-use-at-constant-prices.xlsx` (constant 2019 prices) — used only to check the growth figures, not shown.
  The three originals are archived with checksums under `docs/Raw Data/Economy/gdp-expenditure/` and published through the existing source archive (`data/methodology/source-archives/gdp-expenditure.csv`).
- **Years:** annual columns only, 2010–2025. Quarterly columns and 2026 are not read.
- **Canonical file:** `data/imports/gdp-expenditure-annual.csv`, same columns as `economic-sectors-annual.csv` (`series_id,year,measure,value,unit,valuation,price_basis,calculation,status,source_id,source_locator,last_reviewed_at`), UTF-8 with BOM, values in full GEL as exact decimals.
- **IDs:** `economy.gdp_total` for GDP (the Sectors id), and `gdp_use.{id}` for the rest: `consumption`, `households`, `npish`, `households_npish` (growth only), `government`, `government_individual`, `government_collective`, `investment`, `fixed_capital`, `inventories` (₾ and share only), `exports`, `exports_goods`, `exports_services`, `imports`, `imports_goods`, `imports_services`. Labels live in `data/taxonomy/gdp-expenditure.json`.
- **Calculations:** million GEL × 1,000,000 with decimal arithmetic; share = amount ÷ same-year GDP × 100; growth = index − 100. These reuse the Sectors calculation helpers unchanged.
- **Checks** (the preparation fails if any is off):
  - every original's checksum and size; sheet names, row labels and SNA codes, year headers and the `*` preliminary marker match the reviewed mapping;
  - each year: consumption + investment + exports − imports = GDP; households + non-profits + government = consumption; individual + collective = government; buildings and equipment + inventories = investment; goods + services = exports and imports, each within 0.01 GEL (all hold in the current release);
  - GDP in table 08 equals the site's existing GDP for every year 2010–2025 (the GDP overview and Sectors files), so the three Economy pages never disagree;
  - each growth figure matches the constant-price table's year-on-year change;
  - no missing, extra or duplicate cell; `…` (no data, "net acquisition of valuables") and `x` (not applicable) are never served as numbers.
- **Database:** a `GdpExpenditureFact` table in one versioned migration, RLS on and public grants revoked, filled by the transactional `data:import` with field-by-field parity, as every hub does. CSV and database modes serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 5. Excel and methodology

- Excel reuses the Sectors workbook (Summary, Data, Sources) in the reader's language: the selected rows, years and measure, preliminary marks and the validated Geostat links; no internal ids or cell references.
- `/methodology/gdp-expenditure` explains in plain words: what each part means (households, non-profits, government individual and collective, investment, inventories, exports, imports); that GDP = consumption + investment + exports − imports; that shares are our calculation; why households and non-profits are combined in real growth and inventories have none; that 2025 is preliminary until Geostat's 13 November 2026 revision; and that "net acquisition of valuables" has no published values.

## 6. Out of scope

Quarterly figures and 2026; GDP at basic prices, product taxes and subsidies (already behind the Sectors page); net exports or any other own sum; per-person or USD amounts; constant-price amounts as a fourth view; MCP tools and the central JSON/CSV publications (recent hubs stay outside them too); refreshing the other Economy pages to the September release (their GDP already matches). Each would need its own approval.

## 7. Verification

1. The canonical file reproduces every served value from the original cells; all checks in section 4 pass; CSV and database modes agree.
2. Unit tests cover preparation (including a changed cell, a missing row and a wrong checksum), the households ↔ households-and-non-profits switch, the inventories gap and the default selection.
3. Chart, table and Excel agree for the same settings; source links work.
4. Browser tests cover the page in both languages at desktop and 375px phone width (the heading line on one line), the hub card, the sidebar entry and the methodology page.
5. `npm run check`, `npm run build` and `npm run test:browser` pass before the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved item), `DESIGN.md` (sidebar order, hub card, the page), and add `docs/data-methodology/gdp-expenditure.md`.

## 8. Reuse

- **As is:** the explorer shell (`ExplorerHeading`, `ExplorerWorkspace`, `LatestValueLine`, `FlatSeriesPanel` with its `heading` rows, `ModeTabs`, `SegmentedTabs`, `RangeStrip`, `ChartSelectionAids`), `EditorialLineChart`, `ExplorerTable`, `ExcelDownloadButton` and the workbook writer, `useHashState`, the Sectors calculation helpers and observation types, hub cards, navigation tree, sitemap and SEO helpers, the methodology catalogue and source-archive pipeline, the served-data CSV/DB parity framework, `readVerifiedPackageFile`.
- **Small additions:** the Sectors explorer, its model, hash state and workbook builder get optional inputs (message namespace, fixed order with headings instead of ranking, rows that only exist in some measures, a default selection, no highlights strip) whose defaults leave the Sectors page and its tests unchanged. A new entry in each registry the recent hubs joined (navigation, Economy hub cards, messages, methodology catalogue, source inventory, sitemap, dataset vocabulary, mirror rows, import script, validate-all, Prisma schema, MCP exclusion list).
- **New:** the taxonomy file, the preparation script and its validation (Geostat's expenditure tables have a different layout from the sector tables, so the Sectors preparation cannot read them), the page route files, the messages and the methodology content.
