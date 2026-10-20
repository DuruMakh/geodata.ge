# Environment and climate hub

Date: 2026-10-20
Status: Written for Duru's review. Duru asked for an Environment and climate thread on 2026-10-20 ("lets do environment and cilmate too in diff thread"). On the "Choose which pages the Environment and climate hub gets" card, Duru picked "Seven pages". On the "Approve this layout for the seven environment pages?" card, Duru picked "Approve" for the layout in `/mnt/project-files/environment-preview/layout-proposal.md`. This document covers the data foundation and the pages.

## 1. Intended result

Readers of fiscal.ge should be able to see, year by year, how much greenhouse gas and air pollution Georgia produces and from where, how clean the air is in its cities, how its temperature and rainfall are changing, how much of its piped water is lost, how much rubbish it collects, and how much timber is cut from its forests.

The pages answer seven questions:

- **Greenhouse gases.** Georgia emitted 11.4 million tonnes of CO₂ equivalent in 2000 and 20.1 million in 2022, or 5.4 tonnes per person. Energy made 13.2 million tonnes of that, transport 4.5 million of it. Forests and land absorbed 5.8 million tonnes.
- **Air pollution.** In 2024, 86.4 thousand tonnes of carbon monoxide were released, 53.5% of it from vehicles (21.1% in 2013).
- **City air.** Rustavi's main station averaged 51 µg/m³ of fine dust (PM10) in 2025, over the yearly limit of 40. Kutaisi's Asatiani Street station broke the daily limit on 67 days.
- **Temperature and rain.** Georgia averaged 10.3°C in 2024, 1.9°C above its 1961–1990 average.
- **Water.** Of 869 million m³ of water put into the pipes in 2025, 560 million (64.4%) was lost on the way. 72.8% of people had piped water.
- **Waste.** 1.18 million tonnes of municipal waste were collected in 2024, 320 kg per person (208 kg in 2015).
- **Forests.** 376,215 m³ of timber were cut in 2024 (876,749 in 2010). Illegal logging found fell from 45,915 m³ in 2014 to 4,218 m³ in 2024.

The pages keep the production editorial look. They reuse the Crime, Housing and Inflation workspace pieces: the series list with headings, one unit at a time, the table, the Excel download, the regional map with area pages and the per-city page routes. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | Georgian name (proposal) |
| --- | --- | --- |
| Hub | `/explorer/environment` | გარემო და კლიმატი |
| Greenhouse gases | `/explorer/environment/greenhouse-gases` | სათბურის გაზები |
| Air pollution | `/explorer/environment/air-pollution` | ჰაერის დაბინძურება |
| City air quality (index) | `/explorer/environment/air-quality` | ჰაერის ხარისხი ქალაქებში |
| A city's air quality | `/explorer/environment/air-quality/{city}` | {ქალაქი} |
| Temperature and rain | `/explorer/environment/climate` | ტემპერატურა და ნალექი |
| Water | `/explorer/environment/water` | წყალი |
| Waste (map) | `/explorer/environment/waste` | ნარჩენები |
| Waste of Georgia or a region | `/explorer/environment/waste/{area}` | — |
| Forests (map) | `/explorer/environment/forests` | ტყეები |
| Forests of Georgia or a region | `/explorer/environment/forests/{area}` | — |
| Methodology | `/methodology/environment` | გარემო და კლიმატი |

- Every path is mirrored under `/en`. The English hub name is "Environment and climate".
- City slugs: `tbilisi`, `kutaisi`, `batumi`, `rustavi`, `zestaponi`, `zugdidi`, `akhaltsikhe`, `telavi`, `mestia`. Area slugs follow `areaRoutes` (`georgia` and the region slugs Housing uses).
- The hub has seven clickable cards in the order of the table (the area and city pages have no card). Each shows a sparkline of its default series, the latest figure and the coverage, all from served facts.
- In the sidebar, **Environment and climate** sits directly after Energy and food and before Population. Its seven pages show beneath it when the section is open.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD, the sitemap (city and area pages included) and llms.txt follow the existing pattern.
- Geostat's Georgian file uses "სათბურის გაზები" for greenhouse gases; that is the proposal. All Georgian names are taken from Geostat's Georgian tables and go on Duru's proofread list.

## 3. Shared page rules

These apply to every page, as on Crime and Housing:

- **Text under the heading.** One short line from `LatestValueLine` in the "{measure} · {year}: {value}" form, worded per page below, and it fits on one line on a 375px phone. Nothing else sits under the heading. The only text under the chart is one short source line.
- **No tabs and no icon switches.** Different measures sit as rows in the right-hand list under small headings (`FlatSeriesPanel` `heading`), with the total first. Nothing is tucked under a caret. Series names carry no prefixes.
- **One unit at a time.** Each heading holds rows of one unit and names the unit when the page mixes units. The chart shows one unit at a time; ticking a row of another unit replaces the selection with that row (`unitList.ts`, as on Business, Health and Housing).
- **Default selection.** The page's total is selected on arrival, stays first and is removable. Two pages have no single total and name their default below: Air pollution (the eight pollutant totals) and a city page (PM10 at every station plus the PM10 limit). Selection is unlimited.
- **Controls and URL.** Chart | Table, the year range and Excel work as on Crime. The selection (including an empty one), range and chart/table mode live in the URL hash and survive a language change.
- **Colours.** Every series has a fixed, distinguishable colour. The total is drawn in ink. Limit lines (city pages) are grey and dashed (`EditorialLineChart` `dashed`).
- **Missing values.** A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…`, `...` and `-` cells are unavailable values, except where a table's legend says `-` means "magnitude nil" (Illegal logging, Violations) — those are kept as zero. A year with a value between two gaps shows as a dot.
- **Negative values.** Forests and land absorb CO₂, so that row is below zero; the chart's zero rule is drawn as usual.
- **Yearly values only.** Every table is yearly already.
- **Source line.** For example "Source: Geostat, Ministry of Environmental Protection and Agriculture · million tonnes CO₂ eq. · 2000–2022 · Methodology and sources". It names the agency Geostat credits for that table.

## 4. Greenhouse gases page (Geostat table B-3, 2000–2022)

Line: "Greenhouse gases · 2022: 20.1 million tonnes".

Unit: million tonnes of CO₂ equivalent unless the heading says otherwise.

- **Total** (selected): Geostat's "aggregated emissions", without land use.
- **Total after forests absorb**: Geostat's aggregated emissions including land use and forestry (14.3 in 2022).
- *By sector*: Energy; Industry; Agriculture; Waste; Forests and land (negative). Geostat's "solvent and other product use" row is `…` in every year and is not listed.
- *Energy in detail*: Burning fuel in power plants, industry and homes (stationary combustion); Transport (mobile combustion); Leaks from gas and coal (fugitive emissions).
- *By gas*: Carbon dioxide; Methane; Nitrous oxide.
- *Fluorinated gases (thousand tonnes)*: HFCs; SF₆. PFCs are `…` in every year and are not listed.
- *Per person (tonnes)*: Per person (Geostat's published figure).

Geostat's area and GDP intensity rows and the population row are not served (the population is already on the Population pages; the GDP row is World Bank data).

## 5. Air pollution page (Geostat table A-1, 2013–2024)

Line: "Carbon monoxide · 2024: 86.4 thousand tonnes".

Unit: thousand tonnes. One heading per pollutant, in Geostat's order, each with three rows: **Total**, From factories, power plants and homes (Geostat's "stationary sources"), From vehicles ("mobile sources"):

carbon monoxide (CO), nitrogen oxides (NOₓ), sulphur dioxide (SO₂), ammonia (NH₃), volatile organic compounds (NMVOC), all dust (total suspended particulates), fine dust PM10, fine dust PM2.5.

Geostat's order puts SO₂ first; the page puts carbon monoxide first because it is the largest and drives the line under the heading. The rest keep Geostat's order.

All eight totals are selected on arrival. Geostat's percentage rows are not served (they equal the source rows ÷ total). Hydrocarbons (`...` in every year), PAH (tonnes) and PCB (kilograms) are not listed. The older `Air-Pollution.xls` (factory emissions only, 2010–2024, and a one-year regional split) is archived but not served.

## 6. City air quality

Source: Geostat table A-2, the Ministry's monitoring stations. Station data starts in 2017 for most automatic stations; the second stations in Kutaisi, Batumi and Rustavi start in 2024, and the four "other cities" stations publish 2024–2025 only. Zestaponi's manual station runs from 2005.

### Index page

Line: "{city with the highest PM10 yearly average} · {year}: {value} µg/m³ fine dust (PM10)" — computed from served facts, for example "Rustavi · 2025: 51 µg/m³ fine dust (PM10)".

Nine city cards in Geostat's order (Tbilisi, Kutaisi, Batumi, Rustavi, Zestaponi, Zugdidi, Akhaltsikhe, Telavi, Mestia), using the hub card component (`BudgetHub` with `HubCardModel`). Each card shows the PM10 yearly average at the city's first station as a sparkline with its latest value; Zestaponi's shows its dust (TSP) average. Clicking a card opens the city's page. DESIGN.md §6.6 is amended in the same change to name this index as the one other place the hub cards appear (Duru approved the layout).

### City page

Line: "{first station} · {year}: {value} µg/m³ fine dust (PM10)", for example "Varketili · 2025: 31 µg/m³ fine dust (PM10)".

The page has the city picker and previous/next city links (`inflationCityRoutes.ts` pattern). The list has one heading per measure; the rows are the city's stations, named by street or place as Geostat names them (for example Tbilisi: Varketili, Kazbegi Avenue, Tsereteli Avenue, Agmashenebeli Avenue, Gelovani Avenue):

- *Fine dust PM10, yearly average (µg/m³)*: each station, then **Yearly limit**.
- *Fine dust PM2.5, yearly average (µg/m³)*: each station, then **Yearly limit** (25 to 2019, 20 from 2020, as Geostat prints).
- *Nitrogen dioxide, yearly average (µg/m³)*: each station, then **Yearly limit** (40).
- *Days over the daily PM10 limit (days)*: each station.

Selected on arrival: PM10 at every station of the city, plus the PM10 limit. The three averages share one unit, so they can be compared on one chart; days are a separate unit.

A limit row is taken once per city from Geostat's printed limit rows; validation checks that every station block of that city prints the same limit each year. It is shown only over the years the city has a station value for that measure, so it does not stretch back to 1990.

**Zestaponi** has a manual station that measures other things. Its list: *All dust (TSP), yearly average*; *Sulphur dioxide, yearly average*; *Nitrogen dioxide, yearly average*; *Manganese dioxide, yearly average* (all µg/m³), 2005–2025 where published. Geostat prints no yearly limit for these (only daily and one-time limits), so Zestaponi has no limit rows. Selected on arrival: dust.

Not served: highest daily and hourly values, ozone and carbon monoxide rows, exceedance counts other than PM10 days, Geostat's per-city summary blocks (they repeat the station rows) and station coordinates. Cells printed with an asterisk (for example Kutaisi NO₂ 2019 "46*") are served as the number, and the methodology page quotes Geostat's footnote.

## 7. Temperature and rain page (Geostat tables B-1 and B-2)

Line: "Georgia · 2024: 10.3°C, 1.9°C above the 1961–1990 average".

Years: 1990, 1995, then 2000–2024, as Geostat publishes. 1990 and 1995 show as dots.

- *Yearly average temperature (°C)*: **Georgia** (selected); Tbilisi; Warmest region; Coldest region.
- *Difference from the 1961–1990 average (°C)*: the same four.
- *Rain and snow in the year (mm)*: the same four.

"Warmest region" and "coldest region" are Geostat's "region with the maximum / minimum average annual temperature"; Geostat does not name them, and neither does the page. The precipitation table uses "region with the maximum / minimum average precipitation"; those rows are labelled Wettest region and Driest region. The 1961–1990 averages are served as one-value rows only in the methodology text, not as chart series. Monthly maxima and minima and the precipitation ratio rows are not served. The source is the World Bank's Climate Change Knowledge Portal, published by Geostat.

## 8. Water page (Geostat tables C-4, C-5, C-7 and C-14, 2015–2025)

Line: "Water lost in pipes · 2025: 64.4%".

- *Water (million m³)*: **Put into the pipes** (gross volume, selected); Lost on the way; Reached users (net volume); Supplied to households.
- *Water lost (%)*: Share lost on the way (Geostat's published percentage).
- *People (million)*: With piped water; With sewers; With wastewater treatment.
- *Share of people (%)*: the same three (Geostat's published percentages).
- *Per person (m³)*: Household water use per person.

The treatment split (primary, secondary, tertiary) is kept in the data file but not listed: Geostat moved most of it from primary to tertiary in 2019, which reads as a jump that did not happen on the ground. Leakage, evaporation, burst mains and meter errors are `…` in every year. Septic tanks and self-supplied households are kept in the data file but not listed.

## 9. Waste page (Geostat `Municipal_Waste_ENG.xlsx`, 2015–2024)

- **Map page:** the shared regional map (`RegionIndex` with a Georgia `leadRow`), coloured by municipal waste collected in the latest year; the list has Georgia at the top, then the regions ranked. Clicking a region or Georgia opens its page. Line: "Waste collected · 2024: 1.18 million tonnes".
- **Georgia page:** *Waste collected (thousand tonnes)*: **Waste collected** (selected). *Per person (kg)*: Per person. Line: "Waste collected · 2024: 1,184 thousand tonnes".
- **Region page:** *Waste collected (thousand tonnes)*: the region's row, selected. Line likewise.
- Region and area pages have the region picker and previous/next links, as on Housing.
- The source credits Tbilservice Group, the Solid Waste Management Company and local cleaning services; Geostat's file names them and the methodology lists them. Abkhazia and Tskhinvali are not in the table; they are blank on the map.

## 10. Forests page (Geostat forest tables, Ministry and forestry agencies)

- **Map page:** regions coloured by timber cut in the latest year (2024); the list has Georgia at the top, then the regions ranked. Tbilisi has no timber figure (`...`) and is unranked. Line: "Timber cut · 2024: 376,215 m³".
- **Georgia page**, 2010–2024:
  - *Timber (m³)*: **Timber cut** (selected); Illegal logging found.
  - *In protected areas (m³)*: Timber cut; Illegal logging found (from 2013).
  - *Fires (number)*: Forest and field fires, 2013–2024.
  - *Area burnt (hectares)*: Area burnt, 2013–2024.
- **Region page:** *Timber (m³)*: Timber cut (selected); Illegal logging found. Tbilisi's page shows illegal logging only and selects it.
- Line on area pages: "Timber cut · 2024: {value} m³".
- Not served: forest area (one undated snapshot), timber by purpose (2018–2022 only), and violations of environmental law (one undated year).

## 11. Data foundation

### Sources

Downloaded from Geostat in the cloud workspace on 2026-10-20: categories/565 (environmental indicators), 73 (environment statistics) and 822 (forest resources), English and Georgian versions. Copies are in `/mnt/project-files/environment-sources/` with URLs in `source-urls.txt`.

| Geostat file | Used for | Years | Agency Geostat credits |
| --- | --- | --- | --- |
| `B-3.-Greenhouse-gas-emissions-ENG.XLSX` | Greenhouse gases | 2000–2022 | Ministry of Environmental Protection and Agriculture |
| `A-1.-Emissions-of-pollutants-into-the-atmospheric-air_ENG.XLSX` | Air pollution | 2013–2024 | Ministry of Environmental Protection and Agriculture |
| `A-2_Ambient_air_quality_in_urban_areas_ENG.XLSX` | City air quality | 2005–2025 | Ministry of Environmental Protection and Agriculture |
| `B-1_Air-Temperature_ENG.XLSX`, `B-2_Atmospheric_precipitation_ENG.XLSX` | Temperature and rain | 1990, 1995, 2000–2024 | World Bank Climate Change Knowledge Portal |
| `C-4`, `C-5`, `C-7`, `C-14` | Water | 2015–2025 | Geostat, survey of water supply enterprises |
| `Municipal_Waste_ENG.xlsx` | Waste | 2015–2024 | Waste management companies |
| `forest/Volume-of-felled-timber.xls`, `forest/Illegal-logging.xls`, `forest/Forest-and-field-fires.xls` | Forests | 2010–2024 | Ministry, National Forestry Agency, Adjara Forestry Agency, Agency of Protected Areas |
| `ka/*` | Georgian labels only | — | — |

Archived but not served: energy tables G-1 to G-4 (the Energy and food hub covers energy), ozone-depleting substances, fertiliser and pesticides, protected areas and visitors, water quality, `Air-Pollution.xls`, violations of law, forest area and timber by purpose. Transport tables H-1 to H-4 belong to the Transport thread and are not downloaded here.

Every value comes from the published cell. Values are rounded from the 15-significant-digit display value, so Geostat's floating noise (`-6.699999999999999`) is served as `-6.7`, never as the raw double.

Rough size: greenhouse gases about 380 values, air pollution 288, city air quality about 450, climate about 330, water about 160, waste 110, forests about 400. About 2,100 values in all; the plan fixes the exact count.

### Research package

`docs/Raw Data/Environment/geostat-environment-annual/` follows the Crime package: the originals under `official/` with a source manifest (URL, retrieval time, SHA-256, size), a `prepare.py` that transcribes every used cell with its sheet and cell reference, an independent verification script, a validation report and a coverage file. The originals are never edited. The `.xls` forest files are read with `xlrd` in the Python transcription and with the repository's SheetJS (`xlsx`) in the TypeScript prepare step and the verifier; no production dependency is added.

### Canonical file and checks

- **Prepare script.** `npm run data:prepare-environment` writes `data/imports/environment-annual.csv` (UTF-8 with BOM) and `data/reports/environment-validation.json`. With `--check` it reproduces both byte for byte, and it runs inside `data:validate`.
- **Row contents.** Each row keeps the indicator ID, the area (`country.georgia`, a region ID, or a station ID), the year, the exact value, the unit (`mt_co2e`, `kt_co2e`, `t_co2e_per_person`, `thousand_tonnes`, `ug_m3`, `days`, `celsius`, `mm`, `million_m3`, `million_persons`, `percent`, `m3_per_person`, `kg_per_person`, `m3`, `fires`, `hectares`), `basis=actual`, value status `official`, and the source ID, sheet and cell.
- **Stable IDs** follow `environment.{topic}.{item}`, for example `environment.ghg.total`, `environment.ghg.net`, `environment.ghg.sector_energy`, `environment.ghg.energy_transport`, `environment.ghg.gas_methane`, `environment.ghg.per_person`, `environment.air.co.total`, `environment.air.co.mobile`, `environment.aq.pm10_avg` (area: station), `environment.aq.pm10_limit` (area: city), `environment.aq.pm10_days`, `environment.climate.temperature` (area: `country.georgia`, `city.tbilisi`, `climate.warmest_region`, `climate.coldest_region`, `climate.wettest_region`, `climate.driest_region`), `environment.water.gross`, `environment.water.lost_share`, `environment.waste.collected` (area: Georgia or region), `environment.waste.per_person`, `environment.forest.timber_cut` (area: Georgia, region or `forest.protected_areas`), `environment.forest.illegal_logging`, `environment.forest.fires`, `environment.forest.burnt_area`.
- **Station IDs** are lowercase Geostat codes with the city: `station.tbilisi_a1`, …, `station.mestia_i1`. Station names and types (traffic, urban, background) are display data.
- **Validation rejects:** a changed value; a missing, extra or duplicate observation; a year outside each table's coverage; and a zero written where Geostat printed `…`, `...` or an unavailable `-`.
- **Validation checks, within rounding:**
  - greenhouse gases: the four sectors (energy, industry, agriculture, waste) add up to the total; the three energy rows add up to energy; CO₂ + methane + nitrous oxide + HFCs/1,000 + SF₆/1,000 add up to the total; the total plus forests and land equals the net total;
  - air pollution: stationary + mobile = total for each pollutant;
  - water: lost + reached users = put into the pipes; the published shares match their ratios;
  - waste: the eleven regions add up to Georgia every year;
  - forests: the regions plus protected areas add up to Georgia every year (Geostat's own rounding differences of up to 2 m³ are recorded exactly, never filled);
  - city air: each city's station blocks print the same limit values;
  - anchor values: greenhouse gases 2000 11.4 and 2022 20.1; per person 2022 5.4; CO 2024 86.4; Varketili PM10 2025 31; Rustavi D1 PM10 2025 51; Georgia temperature 2024 10.3; water lost 2025 559.9 and 64.4%; waste 2024 1,184; timber cut 2024 376,215; illegal logging 2014 45,915.

### Serving

- All pages stay prerendered. The CSV loader and the numeric client projection follow Crime.
- The private Supabase mirror gets an `EnvironmentFact` table in one versioned migration, with RLS on and public grants revoked. The transactional `data:import` compares it field by field, and CSV and database modes must serve identical values. The live migration and import happen only when Duru merges, through the existing release pipeline.
- Like Crime and Housing, Environment is not added to the `/mcp` fact-query snapshot or the JSON publications.
- Excel workbooks follow Crime: one sheet of the selected series with basis status and the validated source hyperlink, no internal metadata columns.

### Amended while planning (2026-10-20)

None of these changes what a reader sees.

- The area is part of the indicator ID, as on Housing, for example `environment.aq.pm10_avg.tbilisi_a1` and `environment.waste.collected.region_tbilisi`. The row has no separate area column; "area" above means the ID's last segment.
- Tbilisi has no timber value, so the Forests map draws Tbilisi's shape without a value or rank ("no data") instead of leaving it out. This uses a small optional addition to the shared map builder, which leaves every existing map unchanged.

## 12. Methodology page

`/methodology/environment` (and `/en`) follows Crime: sources and agencies, what each page shows, what is left out and why, the units, CO₂ equivalent in one sentence, what the limit lines are (Georgian air-quality standards as Geostat prints them, with the PM2.5 change in 2020), the unnamed warmest/coldest regions, the 2019 wastewater re-sorting, Geostat's asterisk footnotes, and the downloadable originals. A decision-register entry records the choices in this document.

## 13. Reuse

- **As is:** `FlatSeriesPanel`, `EditorialLineChart` (`dashed`, single-point dots, negative values), `ExplorerTable`, `RangeStrip`, `LatestValueLine`, `ExcelDownloadButton`, `TopicHub` and `BudgetHub` cards, `RegionIndex` with `leadRow`, `RegionPicker`, `EntityNeighbourLinks`, `areaRoutes`, `buildLatestValueRegionMapModel`, `topicSeries.ts`, `unitList.ts`, the methodology article, sitemap and SEO helpers, the import and parity machinery.
- **Small additions:** the navigation tree, sitemap, llms.txt, i18n scopes, methodology catalog, Prisma schema and import script entries every hub adds; DESIGN.md §6.6/§6.7 and the hub counts.
- **New:** the environment data module, prepare script and research package; `lib/explorer/environment*.ts` (series lists, area and city routes on the Housing and Inflation models); the environment explorer component; page modules and routes. The city routes copy the shape of `inflationCityRoutes.ts` because `areaRoutes` is built for regions; the plan checks whether a small generic helper can serve both and reuses it if so.

## 14. Testing

- Unit tests for the prepare step (every check above, including a self-closing empty cell between filled ones and a `-6.699999999999999` cell), the series lists, defaults, unit switching, area and city routes, hub cards and workbook.
- Browser tests for the hub, each page's default selection and line under the heading, a city page and the Zestaponi page, a waste and a forests area page, phone layout at 375px, and the shared counts (footer, menu, methodology lists).
- `npm run check`, `npm run build` and the browser suite before the PR, after Duru reviews the preview.
