# Housing and construction hub

Date: 2026-10-16
Status: Draft for Duru's review. Duru asked for a Housing and construction hub on 2026-10-16 (project chat, "three threads for education, housing and crime"). Duru picked "Fourth quarter" on the card "How should the home prices appear, given the site shows yearly figures only?" and "Approve" on the card "Approve this four-page layout for the Housing and construction hub?". This document covers both the data foundation and the pages.

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, how much Georgia builds, where it builds and what homes cost. They should be able to see how many building permits are issued and how many buildings are completed, as counts and as floor area, split by building type and by region, and how home prices have moved.

The pages answer four questions:

- How much building is permitted? 2,725 permits for 3.2 million m² in 2006; 11,578 permits for 11.4 million m² in 2025, of which homes 8,167 permits and 8.8 million m².
- How much is finished? 663 buildings and 0.2 million m² in 2006; 3,393 buildings and 3.5 million m² in 2025.
- Where? In 2025 Tbilisi had 5,345 permits for 6.4 million m², 56% of Georgia's permitted floor area.
- What do homes cost? Geostat's home price index stood at 159.4 in the fourth quarter of 2025 (2020 average = 100). New flats in Vake were offered at about 5,900 GEL per m² in late 2025, in Gldani at about 3,700.

The pages keep the production editorial look and reuse the Business workspace, flat series list, region map and area pages, table and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/housing` | `/en/explorer/housing` | საცხოვრებელი და მშენებლობა |
| Building permits | `/explorer/housing/permits` | `/en/explorer/housing/permits` | მშენებლობის ნებართვები |
| Completed buildings | `/explorer/housing/completed` | `/en/explorer/housing/completed` | ექსპლუატაციაში მიღებული შენობები |
| Home prices | `/explorer/housing/prices` | `/en/explorer/housing/prices` | საცხოვრებლის ფასები |
| Regions | `/explorer/housing/regions` | `/en/explorer/housing/regions` | რეგიონები |
| Area page (Georgia and 11 regions) | `/explorer/housing/regions/[id]` | `/en/explorer/housing/regions/[id]` | საცხოვრებელი და მშენებლობა — {area} |
| Methodology | `/methodology/housing` | `/en/methodology/housing` | საცხოვრებელი და მშენებლობა |

- The hub has four clickable cards in the order of the table, reusing the hub cards. Permits, Completed buildings and Home prices each show a sparkline of their default series (permits count, completed count, the home price index), the latest figure and coverage from served facts. Regions shows only its coverage, as the Business Regions card does.
- The sidebar places **Housing and construction** directly after Business, and its four pages show beneath it when the section is active.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- The Georgian names are proposals. Final wording follows Geostat's Georgian metadata (for example its term for completed objects) and the bilingual catalogue conventions.

## 3. Shared page rules

These rules apply to every Housing page, as on Business:

- Under the heading there is one short line from `LatestValueLine`. The wording for each page is in its own section below. Nothing else sits under the heading, and the only text under the chart is one short source line.
- **No page has a tab row or a measure switch.** Each unit's rows sit under a heading that names the unit, and the chart shows one unit at a time: ticking a row of another unit replaces the selection with that row, and the chart, table, years and Excel follow the selection's unit (the Business rule, `keepOneBusinessUnit`).
- Every row is visible from the start under its heading. Nothing is nested under a collapsible parent. Series names carry no prefixes.
- Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- Chart | Table, the year range and Excel work as on Business. Range, selection (including an empty one) and chart/table mode live in the URL hash and survive a language change.
- Every series has a fixed, distinguishable colour. Each page's default series is drawn in ink.
- A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…` cells are unavailable values.
- **Yearly values only.** Permits and completed buildings end in 2025; Geostat's "2026 January–June" column and its quarterly workbooks are not served. Home prices show each year's fourth quarter (section 6).
- Counts are whole numbers. Floor area is stored in m² as Geostat prints it and shown in thousand m² to one decimal in charts, tables and lists (million m² to one decimal in the latest-value lines and hub cards). The price index has one decimal; prices per m² are whole GEL.
- The source line reads like the others, for example: "Source: Geostat, construction permits · 2006–2025 · Methodology and sources".

## 4. Building permits page

Line under the heading: "2025: 11,578 permits for 11.4 million m²".

One list, 2006–2025, under two headings:

- **Number of permits**: **All buildings** (selected), then the building types.
- **Floor area · thousand m²**: All buildings, then the same building types.

The building types are Geostat's columns, in this order: Homes (residential buildings), Shops and trade, Offices and administrative, Hotels, Cafes and restaurants, Industrial buildings, Farm buildings, Fuel stations, Car parks, Schools and education, Kindergartens, Health, Sports, Culture, Pharmacies, Children's holiday camps, Other.

Geostat's column order changes between years, so columns are matched by name, never by position. A type missing from a year's sheet (kindergartens in some years; children's holiday camps exist only in 2022–2023 on the permits side) is a gap in that year, not zero.

## 5. Completed buildings page

Line under the heading: "2025: 3,393 buildings completed, 3.5 million m²".

The same layout as permits (Number selected by default; Floor area), 2006–2025, from Geostat's completed-objects tables. Completed buildings have no children's holiday camps column, so that row is not listed here.

## 6. Home prices page

Line under the heading: "2025, 4th quarter: home price index 159.4 (2020 = 100)".

One list under three headings:

- **Price index · 2020 = 100** (2020–2025): **All homes** (selected), Flats, Detached houses.
- **Tbilisi new flats · GEL per m²** (2021–2025): Gldani, Didube, Vake, Isani, Krtsanisi, Mtatsminda, Nadzaladevi, Saburtalo, Samgori, Chughureti.
- **Tbilisi new houses · GEL per m²** (2021–2025): the same ten districts.

Each year's value is Geostat's own fourth-quarter figure (Duru's ruling), copied exactly. Nothing is averaged or calculated. A year appears only once its fourth quarter is published, so 2026 is not shown until Geostat publishes 2026 Q4. The two GEL-per-m² headings share a unit, so flats and houses can be charted together; the index cannot be charted with them.

The methodology page says, in plain words:
- the index is based on the 2020 average, so the 2020 fourth quarter reads 107.2, not 100;
- the district figures are Geostat's medians of **asking prices of newly built** flats and houses collected from property websites, not sale prices, and they do not cover older homes;
- each year shows the fourth quarter only, and the full quarterly series is on Geostat's site.

## 7. Regions page and area pages

**Regions index** (`/explorer/housing/regions`), following the Business Regions index:

- One latest-value line ("2025: floor area permitted in Tbilisi 6.4 million m²"). Under it is the shared `RegionIndex` map and ranked list of the 11 regions, coloured by each region's permitted floor area in the latest year, with the occupied-territory overlays. There is no map switch.
- Georgia is the list's first, unranked row. Georgia and every region, on the map or in the list, are links to their own area page.
- There is no chart workspace on the index. The one source line is the `RegionIndex` footer, naming the source, unit and map year with the geoBoundaries credit.

**Area pages** (`/explorer/housing/regions/[id]`, 12 pages: `georgia` and the 11 regions), following the Business area pages:

- The heading is `საცხოვრებელი და მშენებლობა — [გურია ▾]` / `Housing and construction — [Guria ▾]`, with the `RegionPicker` (Georgia first, and an all-regions entry that returns to the index) and previous/next links in the order Georgia then the regions.
- One latest-value line: the area's permits, for example "2025: 150 permits for 92.6 thousand m² · Guria".
- One series list, 2006–2025, under two headings that name their units:
  - **Number**: Permits — all buildings (selected), Permits — homes, Completed — all buildings, Completed — homes.
  - **Floor area · thousand m²**: the same four rows.
- Ticking a row of the other heading replaces the selection with it.
- Region totals come from Geostat's regional tables; homes come from the residential column of the building-type tables. Georgia's page uses the same national totals as the topic pages.

## 8. Data foundation

### Sources

Downloaded directly from Geostat in the cloud workspace on 2026-10-16. Copies are in `/mnt/project-files/housing-sources/`.

| Geostat file | Used for | Years |
| --- | --- | --- |
| `0503EN020101_Permissions.xls` (categories/621) | Permits by region, number and m² | 2006–2025 |
| `0503EN020103_Completed-objects.xls` (621) | Completed buildings by region | 2006–2025 |
| `Permissions_ENG.zip` → `0503EN020102c_Permissions by type_ 2006-2025 ENG.xls` | Permits by building type, nationally and by region (one sheet per year) | 2006–2025 |
| `Completed_ENG.zip` → `0503EN020104b_Completed by type_ 2006-2025 ENG.xls` | Completed by building type, nationally and by region | 2006–2025 |
| `RPPI-compared-to-2020-average.xlsx` (698) | Home price index, fourth quarters | 2020–2025 |
| `Residential-property-prices-in-Tbilisi-by-district.xlsx` (698) | District prices per m², sheets Flats and Detached houses, fourth quarters | 2021–2025 |

Archived for provenance but not served: the municipality workbook (`0503EN020102a`), the quarterly by-type workbooks (`0503EN020102b`, `0503EN020104a`), the other two RPPI files (changes on the previous quarter and year), the construction cost index (categories/655, monthly from 2022) and the regional construction-sector workbook (already covered by the Business pages).

Rough size: permits and completed about 2 × 2 × 17 × 20 ≈ 1,300 national values, regions about 2 × 2 × 2 × 11 × 20 ≈ 1,800, prices about 18 + 100. About 3,200 served values in all; the plan fixes the exact count.

### Research package

`docs/Raw Data/Housing/geostat-housing-annual/` follows the Business package. Original files go under `official/` with a source manifest (URL, retrieval time, SHA-256, size). A `prepare.py` transcribes every used cell with its sheet and cell reference, and an independent verification script, a validation report and a coverage file sit alongside. The originals are never edited.

### Canonical file and checks

- `npm run data:prepare-housing` writes `data/imports/housing-annual.csv` (UTF-8 with BOM) and `data/reports/housing-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value, the unit (`count`, `square_metres`, `index_2020` or `gel_per_square_metre`), `basis=actual`, value status `official`, source ID, sheet and cell (for prices, the fourth-quarter cell).
- Stable lowercase IDs follow `housing.{measure}.{group}`. The measure is `permits_count`, `permits_area`, `completed_count`, `completed_area`, `price_index`, `price_flat` or `price_house`. The group is `total`, `type_<id>` (`type_residential`, `type_trade`, …, `type_other`), `region_<existing region id>`, `region_<id>_residential` for the area pages' homes rows, `dwelling_flats` / `dwelling_houses` for the index, or `district_<id>` (`district_vake` and so on).
- Validation rejects a changed value, a missing, extra or duplicate observation, a year outside each table's coverage, and any 2026 or non-fourth-quarter value. It also checks, within rounding:
  - building types add up to the total each year where every type is published;
  - the 11 regions add up to Georgia each year;
  - the regional totals in the regional workbook equal the region totals in the building-type workbook;
  - a few anchor values match Geostat: permits 2025 11,578 and 11,397,190 m²; completed 2025 3,393 and 3,509,126 m²; Tbilisi permits 2025 6,423,329 m²; home price index 2025 Q4 159.4; Vake flats 2025 Q4.
- Fiscal.ge derives nothing: no averages, shares, growth rates or interpolation.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Business.
- The private Supabase mirror gets a `HousingFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 9. Sources, Excel and methodology

- The Geostat workbooks are published through the existing source archive (`data/methodology/source-archives/housing.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language: the selected series and years in the selection's unit, blank missing cells and validated source links, with no internal identifier or cell-reference columns.
- `/methodology/housing` explains in plain words:
  - that permits and completed buildings are Geostat's "declared data" from the bodies that issue permits, as Geostat's metadata describes them, and that permits for buildings of special significance are issued by the Technical and Construction Supervision Agency (69 in 2025, per Geostat's note);
  - that "homes" are Geostat's residential buildings, which include multifunctional residential complexes and individual houses;
  - what counts as a permit and a completed building, and that floor area is the total area in the permit;
  - that a permit in one year may be built over several years, so permits and completions are not comparable year for year;
  - the building types and the gaps where Geostat published no column;
  - the three home price notes in section 6;
  - that the pages state no causes.

## 10. Out of scope

Municipality pages or rows; the construction cost index; construction-sector business figures (on the Business pages); quarterly values and 2026; averages of quarters; prices for older homes or outside Tbilisi (Geostat publishes none); rents; mortgages (Money and banks covers loans); forecasts; causes; MCP tools; and the central JSON/CSV publications. Each would need its own approval.

## 11. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, headings, unit switching, gaps, fourth-quarter prices and URL state behave as in sections 3–7, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, and keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, merge main, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Housing and construction item), `DESIGN.md` (the hub, four pages and area pages), and add `docs/data-methodology/housing-annual.md`.

## 12. Reuse

- **As is:** the explorer shell (`ExplorerHeading`, `ExplorerWorkspace`, `LatestValueLine`, `FlatSeriesPanel`, `ModeTabs`, `RangeStrip`), `EditorialLineChart`, `ExplorerTable`, `ExcelDownloadButton` and the workbook writer, `topicSeries` (model, hash, coverage), `RegionIndex`, `RegionPicker`, `buildLatestValueRegionMapModel` and the site's region ids, hub cards, navigation tree, sitemap and SEO helpers, the methodology catalogue and source-archive pipeline, the served-data CSV/DB parity framework.
- **Small additions:** a Housing entry in each registry the Business hub joined (navigation, messages, methodology catalogue, source inventory, sitemap, dataset vocabulary, mirror rows, import script, validate-all, Prisma schema).
- **Genuinely new:** the Housing data module (types, prepare, validation, import), its prepare script, and the thin Housing page components and models that configure the shared shell, as every hub has. The one-unit-at-a-time rule is taken from Business's `keepOneBusinessUnit` rather than written again; if it cannot be imported as is, the plan moves it to `topicSeries` with Business's behaviour unchanged.
