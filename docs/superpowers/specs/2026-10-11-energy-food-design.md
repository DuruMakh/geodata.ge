# Energy and food hub

Date: 2026-10-11
Status: Draft for Duru's review. Duru asked for energy and food, chose **one "Energy and food" hub** with **four pages**, and approved the page layout on 2026-10-11 (decision cards in the "Energy and farming data" thread). This document covers both the data foundation and the pages, as the Poverty design did. Together the four pages serve about 680 Geostat values.

## 1. Intended result

Fiscal.ge readers should be able to see how much of its energy and food Georgia produces itself and how much it imports, every year Geostat publishes.

The pages answer five questions:

- How much energy does Georgia use, and how much of it is imported? In 2024 the country's energy supply was 5,915 thousand tonnes of oil equivalent, and imports were 5,099.
- Which fuels does it rely on? Natural gas and oil products are almost entirely imported. Hydro is the largest domestic source.
- Where does electricity come from, and does Georgia buy or sell it abroad? 14,234 GWh were produced in 2024, 11,344 of them by hydro plants.
- Who uses the energy: households, transport, industry or businesses?
- How much of each main food does Georgia produce itself? In 2025 it produced 19% of the wheat it used, 30% of the poultry, 68% of the milk and 158% of the grapes.

The pages keep the production editorial look and reuse the Poverty and Wages workspace, series list, tabs, table and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/energy-food` | `/en/explorer/energy-food` | ენერგეტიკა და სურსათი |
| Energy supply | `/explorer/energy-food/energy-supply` | `/en/explorer/energy-food/energy-supply` | ენერგიის მიწოდება |
| Electricity | `/explorer/energy-food/electricity` | `/en/explorer/energy-food/electricity` | ელექტროენერგია |
| Energy use | `/explorer/energy-food/energy-use` | `/en/explorer/energy-food/energy-use` | ენერგიის მოხმარება |
| Food self-sufficiency | `/explorer/energy-food/food-self-sufficiency` | `/en/explorer/energy-food/food-self-sufficiency` | სურსათით თვითუზრუნველყოფა |
| Methodology | `/methodology/energy-food` | `/en/methodology/energy-food` | ენერგეტიკა და სურსათი |

- The hub has four clickable cards with coverage years and a small chart built from served values: total energy supply, total electricity production, total final energy use, and wheat self-sufficiency. They reuse the Poverty hub cards.
- The sidebar places **Energy and food** directly after External flows. Its four pages show beneath it when the section is active, as Poverty's pages do.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing patterns.
- Georgian names are proposals. Labels follow Geostat's Georgian files where they exist: for example `შიდა მიწოდება` (domestic supply), `საბოლოო მოხმარება` (final consumption), `შინამეურნეობები` (households) and `თვითუზრუნველყოფის კოეფიციენტი` (self-sufficiency ratio). The unit is `ათასი ტონა ნავთობის ეკვივალენტი` (thousand tonnes of oil equivalent).

## 3. Rules shared by all four pages

- Under the heading there is one short line from `LatestValueLine` with the latest published values. Nothing else sits under the heading: no headline-number block or ranking. The only text under the chart is one short source line.
- Tabs are centred text tabs, styled like the Poverty tabs. Each tab has its own series list. Switching tabs selects that tab's first series alone and keeps the year range, clamped to the new tab's years.
- On each tab, only the applicable total is selected first. It stays first, selectable and removable. Where a tab has no total, its first series is selected.
- Nested rows, counts, Select all and search work as on Poverty and Wages.
- Chart | Table, the year range and Excel work as on Poverty. The tab, range, selection and chart/table mode live in the URL and survive a language change.
- Every series has a fixed, distinguishable colour, and labels identify every series without colour.
- Every value is Geostat's own published number. No shares, differences, sums, per-person figures or other calculations of our own are served.

## 4. Energy supply page

Line under the heading: "2024: energy supply 5,915, imports 5,099 (thousand tonnes of oil equivalent)".

**Overview | Supply by fuel | Imports by fuel**

| Tab | Series (selected first in bold) | Years |
| --- | --- | --- |
| Overview | **Domestic supply**, Production, Imports, Exports (the balance's Total column) | 2013–2024 |
| Supply by fuel | **Total**, with natural gas, oil products, hydro, biofuel and waste, coal, crude oil, wind/solar/geothermal and electricity nested under it | 2013–2024 |
| Imports by fuel | **Total**, with natural gas, oil products, coal, crude oil and electricity nested under it | 2013–2024 |

- Unit: thousand tonnes of oil equivalent (the balance's KTOE sheet). The methodology explains the unit in plain words: one tonne of oil equivalent is the energy in one tonne of crude oil, so different fuels can be added together.
- Electricity's domestic supply is imports minus exports as Geostat publishes it, so it is small and can be negative (2023). The chart draws it as published.

## 5. Electricity page

Line under the heading: "2024: 14,234 GWh produced, 2,302 imported, 2,122 exported".

**Production | Imports and exports | Use**

| Tab | Series (selected first in bold) | Years |
| --- | --- | --- |
| Production | **Total production**, with hydro plants, thermal plants and wind plants nested under it | 2013–2024 (wind from 2016) |
| Imports and exports | **Imports**, Exports | 2013–2024 |
| Use | **Final consumption**, with households, commercial and public services, industry, transport, agriculture/forestry/fishing and other (not specified) nested under it; then Network losses | 2013–2024 |

- Unit: GWh (the balance's electricity sheet).
- Wind has no value before 2016 because Geostat's balance has no wind column before then. It is a gap, not zero.
- "Other (not specified)" is large: 1,605 GWh in 2013 and 2,553 in 2024. The methodology says Geostat does not break it down and offers no explanation of our own.

## 6. Energy use page

Line under the heading: "2024: final energy use 5,457 thousand tonnes of oil equivalent".

**By user | By fuel**

| Tab | Series (selected first in bold) | Years |
| --- | --- | --- |
| By user | **Final consumption**, with households, transport, industry, commercial and public services, agriculture/forestry/fishing, other (not specified) and non-energy use nested under it | 2013–2024 |
| By fuel | **Final consumption**, with natural gas, oil products, electricity, biofuel and waste, coal and wind/solar/geothermal nested under it | 2013–2024 |

- Unit: thousand tonnes of oil equivalent.
- "Non-energy use" means fuel used as a raw material, for example gas for fertiliser, not burned for energy. The methodology says so.

## 7. Food self-sufficiency page

Line under the heading: "2025: Georgia produced 19% of the wheat it used".

No tabs. One line chart of the self-sufficiency ratio for 12 foods in Geostat's order: **Wheat** (selected first), maize, potatoes, vegetables, grapes, meat (with beef, pork, sheep and goat meat, and poultry nested under it), milk and milk products, and eggs.

- Unit: percent. Values show as Geostat publishes them: whole numbers to 2023, one decimal for 2024 and 2025.
- Years 2014–2025 for all 12 foods. No value is missing.
- The methodology explains the ratio in plain words. 100% means Georgia produces as much as it uses. Below 100% means it imports the rest. Above 100% means it produces more than it uses and the rest is exported or stored. It quotes Geostat's definition: domestic production divided by production plus imports minus exports. Wheat counts flour and other wheat products converted into wheat, and grapes count wine converted into grapes, as Geostat's footnotes say.
- Sheep and goat meat reached 345% in 2018. The chart shows it as published.

## 8. Data rules readers see

These are stated where they matter, mostly on the methodology page:

1. **Official balances.** Energy figures come from Geostat's annual Energy Balance of Georgia, one publication per year from 2013 to 2024. The 2025 balance is not yet published, so energy pages end in 2024.
2. **No monthly data.** Geostat also publishes monthly electricity and fuel figures from 2018. They are not used, because the pages show yearly data only, and adding up months ourselves would be our own calculation.
3. **Dashes.** In the balances, Geostat writes "-" where a flow did not occur. Those cells are served as 0 and listed in the validation report. Cells marked "…" (not published) are gaps. No served series is expected to contain one, and validation fails if one does.
4. **Food data.** Food figures come from Geostat's Food Balance Sheets (2014–2025). The ratios are Geostat's published numbers, not recalculated.
5. **Energy prices** are not shown, because Geostat publishes them every half year.
6. **No causes stated.** The pages and methodology describe the figures without explaining why they changed.

## 9. Data foundation

### Sources

Retrieved from Geostat on 2026-10-11 (English files, with Georgian files kept for labels):

| Source | Contents | Served values |
| --- | --- | --- |
| Energy Balance of Georgia 2013 … 2024 (12 pages under `https://www.geostat.ge/en/modules/categories/328`), file 1 "Aggregated Energy Balance" (KTOE sheet) | Supply, imports, exports and final consumption by fuel and by user | 4×12 + 8×12 + 5×12 (supply page) + 8×12 + 6×12 (use page) = 372 |
| Same pages, file 2 "Electricity and heat" (GWh sheet) | Electricity production by plant type, imports, exports, final consumption by user, losses | 45 + 24 + 96 = 165 |
| Food Security page (`https://www.geostat.ge/en/modules/categories/297`), `1.Food_Balance_Sheets_ENG.xlsx` | Self-sufficiency ratio for 12 foods | 12×12 = 144 |

The energy efficiency workbook (`Energy-efficiency_ENG.XLS`, 2013–2024) is kept only to cross-check total energy supply and final consumption. It is not served.

### Research packages

Two packages follow the Poverty package: originals under `official/`, a source manifest (URL, retrieval date, SHA-256 and size), a `prepare.py` that transcribes every served cell with its file, sheet and cell reference, an independent verification script, a validation report and a coverage file. The originals are never edited.

- `docs/Raw Data/Energy/geostat-energy-balance-annual/` (24 workbooks plus the efficiency workbook)
- `docs/Raw Data/Food/geostat-food-balance-annual/` (1 workbook)

### Canonical files and checks

- `npm run data:prepare-energy` writes `data/imports/energy-annual.csv`. `npm run data:prepare-food-self-sufficiency` writes `data/imports/food-self-sufficiency-annual.csv`. Each also writes a validation report under `data/reports/`. `--check` reproduces each byte for byte and runs in `data:validate`. Files are UTF-8 with BOM.
- Each row keeps the exact workbook value, the value as Geostat displays it, unit (`ktoe`, `gwh` or `percent`), `basis=actual`, source ID, file, sheet and cell.
- Stable lowercase IDs, for example `energy.supply.total`, `energy.supply.natural_gas`, `energy.imports.oil_products`, `energy.use.households`, `electricity.production.hydro`, `electricity.use.losses` and `food.self_sufficiency.wheat`.
- Validation rejects a changed value, a missing, extra or duplicate observation, a year outside coverage, an unexpected "…" cell and a changed row or column label. It also checks:
  - for each year and fuel, production + imports − exports − bunkers + stock changes equals domestic supply within 0.2 (rounding);
  - for each year, the Total column equals the sum of the fuel columns within 0.5, for supply, imports and final consumption;
  - final consumption equals industry + transport + other sectors + non-energy use within 0.5;
  - total electricity production equals thermal + hydro + wind within 0.5 GWh;
  - total energy supply and final consumption match the energy efficiency workbook for all 12 years;
  - for each food and year, the published ratio is within 10 percentage points of production ÷ (production + imports − exports) × 100 from the same sheet. Geostat's stock changes explain the small differences, for example sheep and goat meat 299 against 291 in 2017;
  - spot values: 2024 energy supply 5,914.5, 2024 imports 5,099.0, 2024 electricity production 14,234.1 GWh, 2025 wheat 19%.
- No estimates, interpolation or derived figures are served.

### Serving

- All pages stay prerendered. CSV loaders and numeric client projections follow Poverty.
- The private Supabase mirror gets `EnergyFact` and `FoodSelfSufficiencyFact` tables in one versioned migration, with RLS on and public grants revoked. They are compared field by field in the transactional `data:import`, like `PovertyFact`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 10. Sources, Excel and methodology

- The workbooks are published through the existing source archive (`data/methodology/source-archives/energy-food.csv`). The methodology bundle must not pull in large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language. It contains the active tab's selected series and years, explicit units and validated source links, with no internal identifier or cell-reference columns.
- `/methodology/energy-food` explains in plain words what an energy balance is, the oil-equivalent unit, domestic supply, final consumption and non-energy use, what the electricity rows mean, the food self-sufficiency ratio and its footnotes, and rules 1–6 from section 8.

## 11. Out of scope

Energy prices, monthly energy data, 2025 energy figures before Geostat publishes the balance, the 2022 household energy survey, crop and livestock production, farm prices, food per-person consumption, regional breakdowns, MCP tools and the central JSON/CSV publications. Each would need its own approval.

## 12. Verification

1. The canonical files reproduce all served values from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, tabs, nesting, tab switching, the wind gap before 2016 and URL state behave as in sections 3–7. The latest-value lines read the numbers in this document.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, with keyboard use and language switching keeping the settings.
5. A live preview goes to Duru first. After Duru approves it, run `npm run check`, `npm run build` and `npm run test:browser` once, then push and open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Energy and food item), `DESIGN.md` (the hub and four pages) and new `docs/data-methodology/energy-annual.md` and `docs/data-methodology/food-self-sufficiency-annual.md`.

## 13. Reuse

- **Used as is:**
  - `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector` and `SeriesSelectorRow` (with nested rows), `SegmentedTabs`, `SourceNote`
  - the three-sheet Excel writer and `ExcelDownloadButton`
  - the source archive and methodology components
  - the generated-artifact check and the served-rows parity check
- **Small additions:**
  - the sidebar, sitemap, methodology catalogue and source inventory get the new section
  - the import script and mirror read and compare the new tables
- **New** (each mirrors its Poverty counterpart; first check whether the Poverty explorer can take the energy and food series as configuration instead of a copy, and prefer that if it needs only small optional additions):
  - the two research packages and prepare scripts
  - the Prisma models and migration
  - the explorer state and model, workbook and hub-card modules, the page module, routes and messages
  - the methodology content and the two `docs/data-methodology/` files

## 14. Coordination

This branch starts from `main` after the Poverty merge (PR #174). The Money and banks hub and the Household income and spending hub are being built in other threads and touch the same shared files: sidebar, sitemap, methodology catalogue, mirror files and browser-test page counts. Whichever merges first, the others merge `main` in and resolve those files.

## 15. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request, deployment or live database changes. A live preview comes first.
