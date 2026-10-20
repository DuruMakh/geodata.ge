# Annual environment and climate data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Environment/geostat-environment-annual/`, collected on 2026-10-20 from three Geostat category pages: Environmental indicators (`https://www.geostat.ge/en/modules/categories/565`), Environment statistics (`https://www.geostat.ge/en/modules/categories/73`) and Forest resources (`https://www.geostat.ge/en/modules/categories/822`), each also captured in Georgian. The research captures are immutable. The 2,125 published values (195 series) are served on the seven Environment and climate pages (Greenhouse gases, Air pollution, City air quality with one page per city, Temperature and rain, Water, Waste and Forests, the last two with a map and one page per area) under the approved design `docs/superpowers/specs/2026-10-20-environment-design.md`; see [Serving on the Environment and climate pages](#serving-on-the-environment-and-climate-pages). Nothing is published through MCP or included in central machine-readable publications.

Annual data only. Greenhouse gases run 2000–2022; air pollution 2013–2024; city air quality 2005–2025 (16 stations in 9 cities); temperature and rain 1990, 1995 and 2000–2024; water 2015–2025; waste 2015–2024; timber cut and illegal logging 2010–2024; forest and field fires 2013–2024. Fiscal.ge calculates none of the served values.

## Sources and coverage

Geostat publishes every table; each names where its figures come from. The source lines, quoted verbatim on the methodology page in each language:

| Page | Geostat workbook (source ID) | Source, as printed |
| --- | --- | --- |
| Greenhouse gases | `B-3.-Greenhouse-gas-emissions-ENG.XLSX` (`geostat_env_ghg`) | "Source: Ministry of Environment Protection and Agriculture of Georgia." |
| Air pollution | `A-1.-Emissions-of-pollutants-into-the-atmospheric-air_ENG.XLSX` (`geostat_env_air_emissions`) | the same |
| City air quality | `A-2_Ambient_air_quality_in_urban_areas_ENG.XLSX` (`geostat_env_air_quality`) | the same |
| Temperature and rain | `B-1_Air-Temperature_ENG.XLSX`, `B-2_Atmospheric_precipitation_ENG.XLSX` (`geostat_env_temperature`, `_precipitation`) | "Source: The World Bank's Climate Change Knowledge Portal" |
| Water | `C-5.-Water-supply-industry-…_ENG.xlsx`, `C-4.-Household-water-use-per-capita_ENG.xlsx`, `C-7.-Water-losses_ENG.xlsx`, `C-14.-Population-connected-to-wastewater-treatment_ENG.XLSX` (`geostat_env_water_supply`, `_water_household`, `_water_losses`, `_wastewater`) | "Source: Survey of Water Supply Enterprises (Geostat)." |
| Waste | `Municipal_Waste_ENG.xlsx` (`geostat_env_waste`) | LTD Tbilservice Group, LTD Solid Waste Management Company of Georgia, LLC Sandasuftaveba, NNLE Kobuletis Sandasuftaveba, LTD Keda Komunalurservice, NNLE Khulo Municipal Service |
| Forests | `Volume-of-felled-timber.xls`, `Illegal-logging.xls`, `Forest-and-field-fires.xls` (`geostat_env_timber`, `_illegal_logging`, `_fires`) | the Ministry, with LEPL Forestry Agency of Adjara, LEPL Agency of Protected Areas and LEPL National Forestry Agency (Department of Environmental Supervision in its place for illegal logging) |

Forty-six originals are preserved under `official/`: the 13 served English workbooks, their 13 Georgian versions (kept for the Georgian labels; no value is read from them), 14 workbooks archived for reference only, and captures of the three category pages in English and Georgian. The reference-only workbooks are the energy tables G-1, G-2 and G-4 (the Energy and food pages cover energy), ozone-depleting substances (A-3), protected areas (D-1 and `Protected-Areas.xls`), visitors to protected areas, fertiliser (F-2) and pesticides (F-4), water quality, violations of environmental law, forest area, timber by cutting purpose and `Air-Pollution.xls`. Geostat's transport tables H-1 to H-4 are not part of this package. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the same originals are published through `data/methodology/source-archives/environment.csv`, where each workbook is dated by the years it prints, a Georgian version by the years of its English original, and a page capture by the years of the served tables it lists.

## Research package

The package holds, besides `official/`: `source-manifest.csv` and `.json`, `prepare.py` (finds every row by its printed English label and every column by its year heading, never by a fixed position, reads the old `.xls` workbooks with `xlrd`, and writes `environment-annual.csv` and `coverage.csv`), `verify_independent.mjs`, `test_validation.py`, `validation-report.json`, `independent-validation.json` and a README with the cell map. `coverage.csv` lists, for each indicator, the first and last year, the count and the printed years between them that carry no value.

## Values as Geostat prints them

Every row stores the cell's exact value and its published value, the figure the table prints: the stored value rounded half up to the decimals of the cell's number format (greenhouse gases 2018 are stored as 17.66 and printed 17.7). The pages and Excel show the published value; the sum checks use the stored value. Geostat's parts and totals sometimes differ by its own rounding; every non-zero difference is recorded in `validation-report.json` and the figures are left as published. The tolerance is 0.15 of the published unit for greenhouse gases, air pollutants, water and waste, and 2 m³ for timber cut and illegal logging (the largest difference, timber cut in 2019). Geostat's timber, illegal-logging and household-water tables carry the note "The discrepancy between the totals and the sum in some cases can be explained by using rounded data."

## Greenhouse gases

Table B-3 gives emissions in CO₂ equivalents. The page serves aggregated emissions without land use (`environment.ghg.total`), the four sectors, the three energy rows, five gases (CO₂, methane and nitrous oxide in Mt; HFCs and SF₆ in kt), the "Land use and forestry" sector row (`sector_land`, negative: −5.8 Mt in 2022), aggregated emissions including LULUCF (`net`, 14.3 Mt in 2022 against 20.1 Mt without) and emissions per person (5.4 t in 2022). Geostat's separate "Net emissions/removals by Land use, land use change, forestry (LULUCF)" row differs from the sector row in the second decimal; the sector row is served. "Solvent and Other Product use" and PFCs are `…` in every year and are not served. The area and GDP intensity rows and the population row are not served. The table points to the "Guidelines for National Greenhouse Gas Inventories (IPCC, 2006 year)".

## Air pollution

Table A-1 gives the eight main pollutants (CO, NOₓ, SO₂, NH₃, NMVOC, TSP, PM10, PM2.5) in thousand tonnes, each as a total and "from stationary sources" and "from mobile sources", which add up to the total within 0.15. The page lists carbon monoxide first (86.4 thousand tonnes in 2024, 46.2 of it from mobile sources). The percentage rows, hydrocarbons (`…` in every year), the other pollutants in t, kg or g per year, and the per-person, per-area and per-GDP rows are not served.

## City air quality and the yearly limits

Table A-2 gives the Ministry's 16 monitoring stations in 9 cities. Under each station block the served rows are "Annual average concentration" for PM10, PM2.5 and nitrogen dioxide, "Number of days with exceeded daily limit value" for PM10, and "Annual average limit value". A city's yearly limit rows are read from its first station block, and every other block of that city must print the same value in every year. A limit is served only in the years in which at least one of the city's stations has a yearly average for that pollutant, so it does not stretch back before the measurements, and every served station average has its city's limit. PM10 and NO₂ limits are 40 µg/m³; the PM2.5 limit is printed 25 µg/m³ until 2019 and 20 from 2020. Tbilisi A1–A3 have values from 2017, Kutaisi B1 and Batumi C1 from 2018, Rustavi D1 and Tbilisi A4 from 2019; A5, B2, C2, D2, F1, G1, H1 and I1 publish 2024 and 2025 only. Stations are named by street or place as Geostat names them.

Four cells carry a footnote mark and are served as the number: Tbilisi A4 (Agmashenebeli Avenue) 2019 PM10 `47*`, NO₂ `36*` and PM10 days `83*` ("* The station has been operational since May 2019 and data in the relevant cells reflect only May-December period in 2019."), and Kutaisi B1 2019 NO₂ `46*` ("* Measurements of nitrogen dioxide (NO2) concentrations were carried out in the period of August-December in 2019."). The highest daily and hourly values, ozone, carbon monoxide and sulphur dioxide at the automatic stations, exceedance counts other than PM10 days, the per-city summary blocks and the station coordinates are not served.

## Zestaponi

Zestaponi's station E1 (Chikashua street, "Urban (non-automatic)") is the one manual station. It serves yearly averages of TSP and NO₂ 2005–2025 and of SO₂ and MnO₂ 2005–2023. Geostat prints only one-time and daily limits for it, so Zestaponi has no limit rows and its page no limit line. Geostat's note is quoted on the methodology page: "**** Sampling methodology at Zestaponi non-automatic station can provide neigther daily avarage concentrations of the pollutants nor the number of exceedances of the relevant limit values." The page selects TSP on arrival.

## Temperature and rain

Tables B-1 and B-2 come from the World Bank's Climate Change Knowledge Portal and print 1990, 1995 and every year from 2000; 1991–1994 and 1996–1999 are not printed. Each has four blocks: Georgia, Tbilisi and two regions named in the block titles by their 1961–1990 averages, the same in every year: warmest Guria ("except for Tbilisi"), coldest Racha-Lechkhumi and Kvemo Svaneti, wettest Samegrelo-Zemo Svaneti, driest Kvemo Kartli. The served rows are the yearly average temperature and its difference from the 1961–1990 average (°C), and the yearly precipitation (mm). The 1961–1990 averages (8.4, 11.7, 11.1 and 4.5 °C; 1,068, 632, 1,493 and 672 mm) are quoted on the methodology page, not served as series; the Georgian workbook prints the temperature averages to one decimal. The precipitation deviation rows (a ratio) and the monthly maxima and minima are not served.

## Water and wastewater treatment

C-5 serves the gross volume, losses during transport and net volume (million m³) and the people and share with piped water; C-7 serves the share lost (64.4% in 2025, 559.9 of 869.1 million m³) and prints the same three volumes as C-5; C-4 serves water supplied to households and total household water use per capita including self supply; C-14 serves the people and share with sewers and with treatment. C-7's leakages, evaporation, burst mains and meter errors are `…` in every year.

C-14 also splits the people connected to treatment into primary/mechanical, secondary/biological and tertiary/advanced treatment. In 2019 primary fell from 1.15 million (2018) to 0.02 million and tertiary rose from 0.01 million to 1.15 million while the total went from 1.34 to 1.36 million, with no note in the table. The three levels (`environment.water.treatment_*`) stay in the CSV and the mirror but are not listed on the page; the total connected to treatment is listed.

## Waste

"Amount of municipal waste disposed in landfills from the regions" (thousand tonnes) for Georgia and the 11 regions, which add up exactly to Georgia in every year 2015–2024, and "Municipal waste generation per capita" (kg, Georgia only, using the population on 31 December): 319.6 kg in 2024, 207.8 kg in 2015.

## Forests and Tbilisi's timber

"Volume of felled timber" and "Illegal logging" (m³) for Georgia, the 11 regions and protected areas, which add up to Georgia within 2 m³; "Number of fire cases" and "Area covered by fire" (hectares) for Georgia, 2013–2024. Tbilisi has no timber figure (`...` in every year): the Forests map draws its shape with no value or rank, and Tbilisi's page lists and selects illegal logging only. Illegal logging is unavailable for Tbilisi in 2012–2018, and protected areas have no figure in either table for 2010–2012.

## The 11 regions

Waste and forests use the site's 11 regions, with the region IDs of the Business and Housing pages. Geostat's tables print the same 11 regions, so nothing is regrouped. Protected areas are a separate row, listed on the Georgia page and not mapped; the climate tables' named regions are rows of those tables and are not mapped either.

## Gaps, dashes and zeros

A missing value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. `…`, `...` and `-` produce no row. The one exception is `Illegal-logging.xls`, whose legend reads `"-" Magnitude nil.`: there `-` is served as `0` in six cells (Guria 2011, Imereti 2010, Mtskheta-Mtianeti 2010 and 2011, Racha-Lechkhumi and Kvemo Svaneti 2010 and 2011). A-2's English legend reads "- Data is not available." while its Georgian legend reads "- მოვლენა არ არსებობს."; the English legend is followed and `-` is a gap. A printed `0` is a value (HFCs 2001). A footnoted number such as `47*` is served as the number. Nothing is estimated, interpolated or filled in.

## Indicators

Indicator IDs are stable lowercase ASCII `environment.{topic}.{item}`, with the area as the last segment where there is one; Georgian and English labels are display data.

| Indicator IDs | Unit | Years |
| --- | --- | --- |
| `environment.ghg.{total, net, sector_*, energy_*, gas_co2, gas_methane, gas_nitrous_oxide}` | `mt_co2e` | 2000–2022 |
| `environment.ghg.{gas_hfcs, gas_sf6}` | `kt_co2e` | 2000–2022 |
| `environment.ghg.per_person` | `t_co2e_per_person` | 2000–2022 |
| `environment.air.{co, nox, so2, nh3, nmvoc, tsp, pm10, pm25}.{total, stationary, mobile}` | `thousand_tonnes` | 2013–2024 |
| `environment.aq.{pm10_avg, pm25_avg, no2_avg}.<station>`, `environment.aq.{pm10, pm25, no2}_limit.<city>` | `ug_m3` | 2017–2025, by station |
| `environment.aq.pm10_days.<station>` | `days` | 2017–2025, by station |
| `environment.aq.{tsp_avg, so2_avg, no2_avg, mno2_avg}.zestaponi_e1` | `ug_m3` | 2005–2025 (SO₂, MnO₂ to 2023) |
| `environment.climate.{temperature, temperature_anomaly}.{georgia, tbilisi, warmest, coldest}` | `celsius` | 1990, 1995, 2000–2024 |
| `environment.climate.precipitation.{georgia, tbilisi, wettest, driest}` | `mm` | 1990, 1995, 2000–2024 |
| `environment.water.{gross, lost, net, households}` | `million_m3` | 2015–2025 |
| `environment.water.{lost_share, share_piped, share_sewers, share_treatment}` | `percent` | 2015–2025 |
| `environment.water.{people_piped, people_sewers, people_treatment, treatment_primary, treatment_secondary, treatment_tertiary}` | `million_persons` | 2015–2025 |
| `environment.water.per_person` | `m3_per_person` | 2015–2025 |
| `environment.waste.collected.{georgia, region_*}`, `environment.waste.per_person` | `thousand_tonnes`, `kg_per_person` | 2015–2024 |
| `environment.forest.{timber_cut, illegal_logging}.{georgia, region_*, protected_areas}` | `m3` | 2010–2024 |
| `environment.forest.fires`, `environment.forest.burnt_area` | `fires`, `hectares` | 2013–2024 |

All 2,125 rows use `basis=actual` and `value_status=official`, and keep their source ID, sheet and cell. By family: greenhouse gases 357, air pollution 288, city air quality 475, climate 324, water 165, waste 130, forests 386.

## Validation and evidence

In the package, `python3 -I prepare.py --check && python3 -I test_validation.py && node verify_independent.mjs` rebuilds every output in memory and rejects a duplicate, missing or extra observation, a served year outside a table's coverage, a `…`, `...` or unavailable `-` served as a value, a wrong unit, source or sheet, and a row that differs from a fresh read of its cell, label, block heading and year heading. It also requires, for every year and within the tolerances of [Values as Geostat prints them](#values-as-geostat-prints-them):

1. the four sectors to add up to the greenhouse gas total, the three energy rows to energy, the gases (HFCs and SF₆ divided by 1,000) to the total, and the total plus land use to the net total;
2. stationary and mobile sources to add up to each pollutant's total;
3. losses and net volume to add up to the gross volume, the published loss share to match the volumes, and C-7 to print C-5's volumes;
4. the 11 regions to add up to Georgia's waste;
5. the regions and protected areas to add up to Georgia's timber cut and illegal logging;
6. every station block of a city to print the same yearly limits, and a limit to be served only in years with a station value.

`node verify_independent.mjs` shares no code or label table with `prepare.py`: it re-reads the 13 served workbooks with SheetJS, matches all 2,125 rows field by field, repeats the sum and city-limit checks, re-hashes every archived file, compares every served cell with the Georgian workbook (one served value differs: Rustavi D2 PM2.5 2025 is 21.7 in English and 22 in Georgian, and the English value is served) and runs negative controls. Anchor values: greenhouse gases 11.4 Mt in 2000 and 20.1 Mt in 2022, land use −5.8 Mt and 5.4 t per person in 2022; CO 86.4 thousand tonnes in 2024; PM10 2025 Tbilisi A1 (Varketili) 31 and Rustavi D1 51 µg/m³; Kutaisi B1 PM10 days 2025 67; Georgia's temperature 2024 10.3 °C; water lost 2025 559.9 million m³ and 64.4%; waste 2024 1,184 thousand tonnes; timber cut 2024 376,215 m³; illegal logging 2014 45,915 m³.

`validateEnvironmentFacts` (`apps/web/lib/data/environment/validation.ts`) repeats the rules that do not need the workbooks whenever the CSV or the mirror is loaded: the coverage of `coverage.csv`, the source and unit contract of each indicator, the published value equal to the stored value as printed, the same sums, the city limits and the anchor values.

## Serving on the Environment and climate pages

`npm run data:prepare-environment` re-reads the package, requires its report and the independent verification to have passed, and writes `data/imports/environment-annual.csv` (UTF-8 with BOM) and `data/reports/environment-validation.json`. `npm run data:check-environment` (part of `data:validate`) rebuilds them in memory and fails on any difference. The canonical CSV has the columns `year, indicator_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell, last_reviewed_at`. The Prisma mirror table `EnvironmentFact` is created by migration `20261020160000_environment` with row-level security on and public grants revoked, and is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows (`assertEnvironmentParity`).

Environment and climate is served by a static build only. It is not added to the `/mcp` snapshot or to the JSON publications, and no page makes a request-time database or file read.

The pages describe the figures and state no causes. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, explicit units, blank cells for missing values and validated links to the archived copies of the Geostat workbooks on fiscal.ge. Internal identifiers and cell references are not exported.

Original sources: [Environmental indicators](https://www.geostat.ge/en/modules/categories/565), [Environment statistics](https://www.geostat.ge/en/modules/categories/73) and [Forest resources](https://www.geostat.ge/en/modules/categories/822) (Geostat).
