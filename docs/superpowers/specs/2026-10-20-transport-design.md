# Transport hub

Date: 2026-10-20
Status: Draft for Duru's review. Duru picked "Transport and cars" as the next data on 2026-10-20 (project chat, "lets do both transport and cars and internet and digital file but in seperete thread"), and picked "Approve" on the card "Approve this five-page layout for the Transport hub?". This document covers both the data foundation and the pages.

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, how many vehicles Georgia has, what they run on and how old they are, how people and goods travel (road, rail, metro, air and sea), and where vehicles are registered.

The pages answer five questions:

- How many vehicles? 244.8 thousand passenger cars in 2000; 1,650.0 thousand in 2025, plus 54.9 thousand buses and minibuses, 129.1 thousand trucks and 80.7 thousand special vehicles.
- What do they run on? In 2025, 777.3 thousand cars ran on petrol, 188.9 thousand were hybrids and 15.2 thousand electric (4.9 thousand in 2023).
- How old are they? In 2025, 1,318.9 thousand cars were more than 10 years old.
- How do people and goods travel? 11,262.1 million passenger-km in 2025 (aviation 1,862.6, eight times 2000); 5,121.4 million tonne-km of freight, 3,814.9 of it by rail. Railways carried 13,257.6 thousand tonnes in 2025, of which 7,616.6 thousand in transit.
- Where? In 2025 Tbilisi had 855.0 thousand of Georgia's 1,914.9 thousand registered vehicles.

The pages keep the production editorial look and reuse the Housing hub as built (topic workspace, flat series list with unit headings, region map and area pages, table and Excel download). No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/transport` | `/en/explorer/transport` | ტრანსპორტი |
| Vehicles | `/explorer/transport/vehicles` | `/en/explorer/transport/vehicles` | ავტოპარკი |
| Vehicle age | `/explorer/transport/vehicle-age` | `/en/explorer/transport/vehicle-age` | ავტომობილების ასაკი |
| Passengers | `/explorer/transport/passengers` | `/en/explorer/transport/passengers` | მგზავრთა გადაყვანა |
| Freight | `/explorer/transport/freight` | `/en/explorer/transport/freight` | ტვირთის გადაზიდვა |
| Regions | `/explorer/transport/regions` | `/en/explorer/transport/regions` | რეგიონები |
| Area page (Georgia and 11 regions) | `/explorer/transport/regions/[id]` | `/en/explorer/transport/regions/[id]` | ტრანსპორტი — {area} |
| Methodology | `/methodology/transport` | `/en/methodology/transport` | ტრანსპორტი |

- The hub has five clickable cards in the order of the table, reusing the hub cards. Vehicles, Vehicle age, Passengers and Freight each show a sparkline of their default series, the latest figure and coverage from served facts. Regions shows only its coverage, as the Housing Regions card does.
- The sidebar places **Transport** after Energy and food and Environment and climate (which went live first), and its five pages show beneath it when the section is active.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- The Georgian names are proposals; final wording follows Geostat's Georgian tables.

## 3. Shared page rules

These rules apply to every Transport page, as on Housing:

- Under the heading there is one short line from `LatestValueLine` that fits one line on a phone. Nothing else sits under the heading, and the only text under the chart is one short source line.
- **No page has a tab row or a measure switch.** Each unit's rows sit under a heading that names the unit, and the chart shows one unit at a time: ticking a row of another unit replaces the selection with that row (`keepOneUnit` in `lib/explorer/unitList.ts`).
- Every row is visible from the start under its heading. Nothing is nested under a collapsible parent. Series names carry no prefixes.
- Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- Chart | Table, the year range and Excel work as on Housing. Range, selection (including an empty one) and chart/table mode live in the URL hash and survive a language change.
- Every series has a fixed, distinguishable colour. Each page's default series is drawn in ink.
- A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…`/`...` cells are unavailable values. A `-` cell follows its own table's legend: where the table says "magnitude nil" (H-1, H-4 and the railway, airport and sea port tables) it is served as 0; where it says "data not available" (H-2) it is a gap. A row that is nil or 0 in every year is not listed.
- **Yearly values only.** Geostat's quarterly columns and every 2026 value are not served.
- Values are shown at Geostat's own precision: thousand vehicles, thousand passengers and thousand tonnes to one decimal; million passenger-km and million tonne-km to one decimal; km per person and road km as printed.
- The source line reads like the others, for example: "Source: Geostat, Ministry of Internal Affairs · 2000–2025 · Methodology and sources".

## 4. Vehicles page

Line under the heading: "2025: 1.65 million passenger cars".

One list, unit thousand vehicles, under five headings:

- **Vehicles by type** (2000–2025): **Passenger cars** (selected), Buses and minibuses, Trucks, Special vehicles.
- **Passenger cars by fuel** (2017–2025): Petrol, Petrol and gas, Diesel, Gas, Electric, Hybrid, Hybrid and gas, Unknown.
- **Buses and minibuses by fuel** (2017–2025): Petrol, Petrol and gas, Diesel, Gas, Electric, Unknown.
- **Trucks by fuel** (2017–2025): Petrol, Petrol and gas, Diesel, Gas, Electric, Unknown.
- **Special vehicles by fuel** (2017–2025): Petrol, Petrol and gas, Diesel, Electric, Unknown.

All rows share one unit, so any of them can be charted together. A fuel keeps one colour under every heading. The rows Geostat prints as `-` or 0 in every year (diesel and gas, hybrid diesel; hybrids for buses, trucks and special vehicles; gas for special vehicles) are not listed. Geostat's 2004–2005 totals (and the 2006 special-vehicles total) are `…`, so those years are gaps. Geostat's percentage rows are not served; Fiscal.ge computes no shares.

## 5. Vehicle age page

Line under the heading: "2025: 1.32 million cars over 10 years old".

One list, unit thousand vehicles, 2017–2025, under four headings (Passenger cars, Buses and minibuses, Trucks, Special vehicles). Each heading lists Geostat's age rows with Geostat's own wording: Up to 2 years, Up to 5 years, Up to 10 years, Over 10 years, Unknown. **Passenger cars · Over 10 years** is selected.

Geostat's age rows are cumulative: "up to 5 years" includes cars up to 2 years old, and "up to 10 years" + "over 10 years" + "unknown" make the total. The page shows them as lines, never stacked, and the methodology page says so. Fiscal.ge does not convert them into separate bands.

## 6. Passengers page

Line under the heading: "2025: 11.3 billion passenger-km".

One list under three headings:

- **Passenger-km · million** (2000–2025): **All transport** (selected), Road, Rail, Metro, Air, Sea.
- **Passenger-km per person** (2000–2025): All transport.
- **Passengers carried · thousand**: Rail (2018–2025), Rail, domestic, Rail, international, Metro (2012–2025), Airports (2015–2025), Georgian airlines (2012–2025), Sea ports (2020–2025).

Road includes private cars and is Geostat's survey-and-expert estimate from 2005. Sea passenger-km is above zero only in 2010–2019; Geostat prints the other years as nil, so they show as 0. Inland waterways is `-` in every year and is not listed. Airports count passengers arriving and departing at Georgia's airports; Georgian airlines count passengers carried by airlines registered in Georgia, wherever they fly; the methodology says the two overlap and must not be added.

## 7. Freight page

Line under the heading: "2025: 5.1 billion tonne-km".

One list under two headings:

- **Tonne-km · million** (2000–2025): **All transport** (selected), Road, Rail, Air, Sea.
- **Goods carried · thousand tonnes**: Rail (2018–2025), Rail, domestic, Rail, exports, Rail, imports, Rail, transit; Sea ports (2020–2025), Sea ports, liquid bulk, Sea ports, general cargo, Sea ports, dry bulk; Airports, freight and mail (2015–2025); Georgian airlines (2012–2025).

Sea tonne-km is published 2000–2008 and in 2011–2012; the rest are `...` gaps. Rail's "outgoing" and "incoming" goods are labelled exports and imports, with Geostat's wording in the methodology.

## 8. Regions page and area pages

**Regions index** (`/explorer/transport/regions`), following the Housing Regions index:

- One latest-value line ("2025: Tbilisi 855.0 thousand registered vehicles"). Under it is the shared `RegionIndex` map and ranked list of the 11 regions, coloured by registered motor vehicles in the latest year, with the occupied-territory overlays. There is no map switch.
- Georgia is the list's first, unranked row. Georgia and every region, on the map or in the list, are links to their own area page.
- No chart workspace on the index. The one source line is the `RegionIndex` footer.

**Area pages** (`/explorer/transport/regions/[id]`, 12 pages: `georgia` and the 11 regions), following the Housing area pages:

- The heading is `ტრანსპორტი — [გურია ▾]` / `Transport — [Guria ▾]`, with the `RegionPicker` and previous/next links.
- One latest-value line, for example "2025: 40.7 thousand registered vehicles · Guria".
- One series list under these headings:
  - **Registered vehicles · thousand** (2017–2025): **All motor vehicles** (selected), Passenger cars, Buses and minibuses, Trucks, Special vehicles.
  - **By fuel · thousand** (2017–2025): Petrol, Petrol and gas, Diesel, Gas, Electric, Hybrid, Hybrid and gas (2022–2025), Unknown.
  - **By age · thousand** (2017–2025): Up to 2 years, 2 to 5 years, 5 to 10 years, Over 10 years, Unknown (this table's bands are separate, not cumulative).
  - **By owner · thousand** (2017–2025): Companies, Individuals.
  - **Roads · km** (2011–2024): All roads, International, Secondary, Local.
- Geostat's three tiny columns of this table (vehicle type unknown from 2022, diesel and gas, hybrid diesel; at most 0.2 thousand in Georgia, 0.0 in every region at Geostat's precision) are kept in the data file for the sum checks but not listed.
- The first four headings share one unit, so they can be charted together; Roads replaces the selection.
- Georgia's page uses the Georgia rows of the same regional tables, so its figures can differ from the Vehicles page by rounding. Georgia's total also includes vehicles registered under Abkhazia's authorities in exile and "region unknown", which have no area page; the methodology says so. Tbilisi's roads are only the 52 km the Roads Department manages, as Geostat notes.

## 9. Data foundation

### Sources

Downloaded directly from Geostat in the cloud workspace on 2026-10-20. Copies are in `/mnt/project-files/transport-sources/raw/` with `source-urls.txt`.

| Geostat file | Used for | Years |
| --- | --- | --- |
| `H-1-Passenger-transport-demand_ENG.XLSX` (categories/565) | Passenger-km by mode, per person | 2000–2025 |
| `H-2-Freight-transport-demand_ENG.XLSX` (565) | Tonne-km by mode | 2000–2025 |
| `H-3.-Composition-of-road-motor-vehicle-fleet-by-fuel-type_ENG.xlsx` (565) | Vehicles by type and fuel | 2000–2025 |
| `H-4.-Age-of-road-motor-vehicle-fleet_ENG.xlsx` (565) | Vehicles by type and age | 2017–2025 |
| `0504EN030102_Goods-Transported-by-Railway.xlsx` (795) | Rail tonnes by direction | 2018–2025 |
| `0504EN030103_Passengers-Transported-by-Railway.xlsx` (795) | Rail passengers | 2018–2025 |
| `0504EN030105_Passengers-transported-by-Metro.xlsx` (795), sheet `2012-2025 Y` | Metro passengers | 2012–2025 |
| `0504EN030201_Airlines-Registered-in-Georgia.xlsx` (796) | Georgian airlines passengers and freight | 2012–2025 |
| `0504EN030202_Airports-in-Georgia.xlsx` (796) | Airport passengers and freight | 2015–2025 |
| `0504EN030401_Passenger-carried-in-seaports-and-terminals.xlsx` (802) | Sea port passengers | 2020–2025 |
| `0504EN030403_Volume-of-carried-freight-in-seaports-and-terminals.xlsx` (802) | Sea port freight by type | 2020–2025 |
| `Number-of-Registered-Vehicles.xlsx` (797) | Registered vehicles by region: type, fuel, owner, age | 2017–2025 |
| `Length-of-road-Eng-2024.xls` (797) | Road length by region | 2011–2024 |

Archived for provenance but not served: rail freight tonne-km by direction and by goods, rail goods by goods type and country, goods by region of loading, railway track length, airport infrastructure and aircraft register, sea port ship calls, technical inspections, Tbilisi taxi licences, and the Geostat category pages.

Rough size: vehicles about 4 + 25 fuel rows (≈ 4 × 26 + 25 × 9), age 20 × 9, passengers and freight about 30 rows, regions 12 areas × (18 × 9 + 4 × 14). About 4,000 served values in all; the plan fixes the exact count.

### Research package

`docs/Raw Data/Transport/geostat-transport-annual/` follows the Housing package: originals under `official/` with a source manifest (URL, retrieval time, SHA-256, size), a `prepare.py` that transcribes every used cell with its sheet and cell reference, an independent verification script, a validation report and a coverage file. The originals are never edited.

### Canonical file and checks

- `npm run data:prepare-transport` writes `data/imports/transport-annual.csv` (UTF-8 with BOM) and `data/reports/transport-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value, its published value at the cell's displayed precision, the unit (`thousand_units`, `million_passenger_km`, `passenger_km_per_person`, `thousand_passengers`, `million_tonne_km`, `thousand_tonnes`, `km`), `basis=actual`, value status `official`, source ID, sheet and cell.
- Stable lowercase IDs follow `transport.{measure}.{group}`: `fleet` (type and type_fuel / type_age groups), `passenger_km`, `passenger_km_per_person`, `passengers`, `tonne_km`, `freight_tonnes`, `registered` (area, area_type, area_fuel, area_age, area_owner groups) and `road_km`. The plan lists every ID.
- Validation rejects a changed value, a missing, extra or duplicate observation, a year outside each table's coverage, and any 2026 or quarterly value. It also checks, within rounding:
  - vehicle fuel rows add up to each type's total, and H-4's "up to 10 years", "over 10 years" and "unknown" add up to it;
  - the modes add up to the passenger-km and tonne-km totals;
  - rail domestic + exports + imports + transit equals rail goods carried; sea port liquid + general + dry equals the total;
  - the 11 regions plus Abkhazia and "region unknown" add up to Georgia in each regional table, and each area's types, fuels, ages and owners add up to its total;
  - anchor values: cars 2025 1,650.0, electric cars 2025 15.2, passenger-km 2025 11,262.1, tonne-km 2025 5,121.4, rail transit tonnes 2025 7,616.6, Tbilisi registered vehicles 2025 855.0.
- Fiscal.ge derives nothing: no shares, per-person values, sums or interpolation.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Housing.
- The private Supabase mirror gets a `TransportFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 10. Sources, Excel and methodology

- The Geostat workbooks are published through the existing source archive (`data/methodology/source-archives/transport.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language: the selected series and years in the selection's unit, blank missing cells and validated source links, with no internal identifier or cell-reference columns.
- `/methodology/transport` explains in plain words:
  - that vehicle figures come from the Ministry of Internal Affairs register through Geostat, as of the end of each year, and that special vehicles include farm machinery from 2008;
  - that the age rows on the Vehicle age page are cumulative while the regional age bands are separate;
  - that road passenger-km and tonne-km from 2005 are Geostat's survey-and-expert estimates, and that the modes cover transport enterprises in Georgia;
  - what passenger-km and tonne-km mean (one passenger or tonne carried one kilometre);
  - that airport and airline figures overlap and are not to be added;
  - that rail transit is goods crossing Georgia by rail between other countries;
  - that Georgia's regional totals include Abkhazia's register and "region unknown", and that Tbilisi's road length is only the roads the Roads Department manages;
  - the rows not listed because they are nil in every year;
  - that the pages state no causes.

## 11. Out of scope

Quarterly values and 2026; shares, per-1,000-people rates or other computed values; rail goods by product or country; goods by region of loading; railway track length; airport infrastructure, aircraft and ship calls; technical inspections; taxi licences; road accidents (on the Crime pages); fuel prices; car imports (on the Trade pages); municipality rows; forecasts; causes; MCP tools; and the central JSON/CSV publications. Each would need its own approval.

## 12. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, headings, unit switching, gaps and URL state behave as in sections 3–8, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, and keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, merge main, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Transport item), `DESIGN.md` (the hub, five pages and area pages), and add `docs/data-methodology/transport-annual.md`.

## 13. Reuse

- **As is:** the explorer shell (`ExplorerHeading`, `ExplorerWorkspace`, `LatestValueLine`, `FlatSeriesPanel`, `ModeTabs`, `RangeStrip`), `EditorialLineChart`, `ExplorerTable`, `ExcelDownloadButton` and the workbook writer, `topicSeries`, `unitList` (`keepOneUnit` and the list hash helpers), `areaRoutes`, `RegionIndex`, `RegionPicker`, `buildLatestValueRegionMapModel` and the site's region ids, hub cards, navigation tree, sitemap and SEO helpers, the methodology catalogue and source-archive pipeline, the served-data CSV/DB parity framework.
- **Small additions:** a Transport entry in each registry the Housing hub joined (navigation, messages, methodology catalogue, source inventory, sitemap, dataset vocabulary, mirror rows, import script, validate-all, Prisma schema, browser page counts).
- **Genuinely new:** the Transport data module (types, prepare, validation, import), its prepare script, and the thin Transport page components and models that configure the shared shell, as every hub has. Housing's components are the starting point; anything that can be shared as is is imported, not copied.
