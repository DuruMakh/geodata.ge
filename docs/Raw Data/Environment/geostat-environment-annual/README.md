# Annual environment and climate statistics (Geostat)

This is the research package for the Fiscal.ge Environment and climate hub. The approved design is `docs/superpowers/specs/2026-10-20-environment-design.md` (sections 4 to 11). Everything here can be rebuilt from the files in `official/`, which are never edited.

## Sources

All files were retrieved on 2026-10-20 from Geostat, the National Statistics Office of Georgia, with `curl -L` from the cloud workspace. The Georgian forest and air-quality workbooks were fetched a second time; each matched the first copy byte for byte. Every `geostat.ge` link redirects to `www.geostat.ge` with the same path; the manifest's `resolved_file_url` records the target.

Three Geostat category pages list the files. Each page is captured in English and Georgian (`official/page-<id>-<en|ka>.html`):

| Page | Category |
| --- | --- |
| Environmental indicators | `https://www.geostat.ge/en/modules/categories/565` |
| Environment statistics | `https://www.geostat.ge/en/modules/categories/73` |
| Forest resources | `https://www.geostat.ge/en/modules/categories/822` |

`source-manifest.csv` and `source-manifest.json` list all 46 archived files. For each file they give the source ID, title, page, retrieved and resolved URL, retrieval date, local file, SHA-256 and size.

### Served workbooks

Thirteen English workbooks are served. Each Georgian version (source ID `<id>_ka`) is archived for its labels.

| Source ID | English file (media ID) | Served |
| --- | --- | --- |
| `geostat_env_ghg` | `B-3.-Greenhouse-gas-emissions-ENG.XLSX` (72854) | 16 greenhouse gas series, 2000-2022 |
| `geostat_env_air_emissions` | `A-1.-Emissions-of-pollutants-into-the-atmospheric-air_ENG.XLSX` (81576) | 8 pollutants × total, stationary, mobile, 2013-2024 |
| `geostat_env_air_quality` | `A-2_Ambient_air_quality_in_urban_areas_ENG.XLSX` (81814) | 16 monitoring stations in 9 cities, 2005-2025 |
| `geostat_env_temperature` | `B-1_Air-Temperature_ENG.XLSX` (74967) | 8 temperature series, 1990, 1995, 2000-2024 |
| `geostat_env_precipitation` | `B-2_Atmospheric_precipitation_ENG.XLSX` (74969) | 4 precipitation series, same years |
| `geostat_env_water_supply` | `C-5.-Water-supply-industry-…_ENG.xlsx` (80743) | gross, lost and net volume; people and share with piped water |
| `geostat_env_water_household` | `C-4.-Household-water-use-per-capita_ENG.xlsx` (80741) | water supplied to households; use per person |
| `geostat_env_water_losses` | `C-7.-Water-losses_ENG.xlsx` (80745) | share of water lost |
| `geostat_env_wastewater` | `C-14.-Population-connected-to-wastewater-treatment_ENG.XLSX` (83030) | people and share with sewers and with treatment; three treatment levels |
| `geostat_env_waste` | `Municipal_Waste_ENG.xlsx` (79501) | waste taken to landfills, Georgia and 11 regions; kg per person, 2015-2024 |
| `geostat_env_timber` | `Volume-of-felled-timber.xls` (77539) | timber cut, Georgia, regions and protected areas, 2010-2024 |
| `geostat_env_illegal_logging` | `Illegal-logging.xls` (77535) | illegal logging found, same areas |
| `geostat_env_fires` | `Forest-and-field-fires.xls` (77533) | forest and field fires and area burnt, 2013-2024 |

Some Georgian files have Georgian names on Geostat's page. They are stored under ASCII names, and the manifest keeps the published name in the URL:

- `A-2-air-quality-GEO.xlsx` (81813)
- `felled-timber-GEO.xls` (77538)
- `illegal-logging-GEO.xls` (77534)
- `forest-fires-GEO.xls` (77532)

### Archived only

No cell of these files is served:

- **Energy tables G-1, G-2 and G-4.** The Energy and food hub covers energy.
- **Other tables:** ozone-depleting substances (A-3), protected areas (D-1 and `Protected-Areas.xls`), visitors to protected areas, fertiliser (F-2) and pesticides (F-4), water quality, violations of environmental law, forest area, and timber by cutting purpose.
- **`Air-Pollution.xls`**: factory emissions, 2010-2024, and a one-year regional split.

Transport tables H-1 to H-4 belong to the Transport hub and are not downloaded here.

### How the files are read

`xlrd` reads the old `.xls` workbooks. It is a dependency of this research package only, not of the application: `python3 -m pip install xlrd==2.0.1` (version 2.0.2 was used and reads them identically). The standard library reads the `.xlsx` files. The TypeScript prepare step and `verify_independent.mjs` read both formats with the repository's `xlsx` (SheetJS 0.20.3).

## Outputs

### `environment-annual.csv`

The 2,125 served observations (195 indicators). Columns: `year, indicator_id, value, published_value, unit, decimals, basis, value_status, source_id, source_sheet, source_cell`.

- **`value`** is the published number rounded to 12 significant digits. This only ever drops the floating noise that Geostat's formulas leave behind:
  - `3.8000000000000003` is `3.8`.
  - `52954.01500000112` is `52954.015`.
  - `prepare.py` fails if the rounding would move a value by more than one part in a billion.
  - Trailing zeros are dropped (`876749.0` is `876749`).
- **`published_value`** equals `value`.
- **`decimals`** is the number of decimals in `value`. The pages use it to print the value as published.
- **`basis`** is `actual` and **`value_status`** is `official` in every row.
- **`source_cell`** is the A1 address; **`source_sheet`** is the sheet name. Only A-2 has several sheets, one per city plus "Other Cities".

Rows are in page order. The indicators, with their units:

- **Greenhouse gases.**
  - `environment.ghg.total`: Geostat's "aggregated emissions", without land use.
  - `environment.ghg.net`: including land use and forestry.
  - `environment.ghg.sector_{energy, industry, agriculture, waste, land}`
  - `environment.ghg.energy_{stationary, transport, fugitive}`
  - `environment.ghg.gas_{co2, methane, nitrous_oxide}`
  - Units: `mt_co2e` (million tonnes of CO₂ equivalent) for all of the above; `environment.ghg.gas_{hfcs, sf6}` are `kt_co2e`; `environment.ghg.per_person` is `t_co2e_per_person`.
- **Air pollutants.** `environment.air.{co, nox, so2, nh3, nmvoc, tsp, pm10, pm25}.{total, stationary, mobile}` (`thousand_tonnes`).
- **City air quality.**
  - Stations: `environment.aq.{pm10_avg, pm25_avg, no2_avg}.<station>` (`ug_m3`) and `environment.aq.pm10_days.<station>` (`days`).
  - City limits: `environment.aq.{pm10_limit, pm25_limit, no2_limit}.<city>` (`ug_m3`).
  - Zestaponi's manual station: `environment.aq.{tsp_avg, so2_avg, no2_avg, mno2_avg}.zestaponi_e1`.
  - Station IDs are `<city>_<code>`, for example `tbilisi_a1` (Varketili) or `rustavi_d1` (Batumi str N19).
  - A measure a station never published has no rows. For example, the four "other cities" stations publish only 2024-2025.
- **Climate.**
  - `environment.climate.{temperature, temperature_anomaly}.{georgia, tbilisi, warmest, coldest}` (`celsius`).
  - `environment.climate.precipitation.{georgia, tbilisi, wettest, driest}` (`mm`).
  - Geostat names the regions in the block titles: warmest Guria (excluding Tbilisi), coldest Racha-Lechkhumi and Kvemo Svaneti, wettest Samegrelo-Zemo Svaneti, driest Kvemo Kartli. They are the regions with the highest and lowest 1961-1990 averages, so they stay the same every year.
- **Water.**
  - `environment.water.{gross, lost, net, households}` (`million_m3`)
  - `environment.water.lost_share` (`percent`)
  - `environment.water.{people_piped, people_sewers, people_treatment}` (`million_persons`)
  - `environment.water.{share_piped, share_sewers, share_treatment}` (`percent`)
  - `environment.water.per_person` (`m3_per_person`)
  - `environment.water.treatment_{primary, secondary, tertiary}` (`million_persons`; served but not listed on the page)
- **Waste.** `environment.waste.collected.{georgia, region_*}` (`thousand_tonnes`) and `environment.waste.per_person` (`kg_per_person`). Region IDs are those of the Business and Housing hubs.
- **Forests.** `environment.forest.{timber_cut, illegal_logging}.{georgia, region_*, protected_areas}` (`m3`), `environment.forest.fires` (`fires`) and `environment.forest.burnt_area` (`hectares`).

Served rows by family:

| Family | Rows |
| --- | --- |
| ghg | 357 |
| air | 288 |
| aq | 475 |
| climate | 324 |
| water | 165 |
| waste | 130 |
| forest | 386 |
| **All** | **2,125** |

### Other outputs

- **`coverage.csv`** gives, for each indicator, the first and last year, the number of values, and the printed years between them that carry no value (for example `environment.aq.pm10_avg.tbilisi_a4`: `2024`).
- **`validation-report.json`** comes from `prepare.py`. It lists the four footnoted number cells, the six "magnitude nil" cells, and every published rounding difference of the sum checks.
- **`independent-validation.json`** comes from `verify_independent.mjs`.

## Cell map

`prepare.py` finds every row by its printed English label (whitespace collapsed, otherwise exactly as printed) and every column by the year heading above it, never by fixed position.

- **Repeated labels.** Where a label repeats, the row is the first one below the block title, station line or pollutant heading that precedes it. It must also come before the next heading. So a station that does not print a row fails rather than borrowing the next block's row.
- **Units.** The printed unit in column B is checked wherever the table prints one.
- **Air quality stations.** On A-2, each station block opens with `Monitoring Station <code> / <name>` and has one heading per pollutant (`PM 10`, `PM 2.5`, `NO2 - nitrogen dioxide`). The served rows under each heading are:
  - `Annual average concentration`
  - `Annual average limit value`
  - under PM10, `Number of days with exceeded daily limit value`

  Zestaponi's headings are `TSP`, `SO2 - Sulphur Dioxide`, `NO2 - Nitrogen Dioxide`, and `MnO2 - მანგანუმის დიოქსიდი***`, which is printed in Georgian in the English file.
- **Year headings.** A year heading is a row of whole, increasing years: at least three, or two beside a printed `Unit`. The "other cities" stations print only 2024 and 2025.
- **Matching Geostat's spelling.** Labels are matched as Geostat spells them, mistakes included: "Nitrous oxide (S2O)", "Patriculate matters (PM10)", "Publc School".

### City limits

A city's yearly limit rows are read from its first station block. Every other block of the city must print the same value in every year.

A limit is served only in the years when at least one of the city's stations has a yearly average for that pollutant, so it does not stretch back to 1990. The PM2.5 limit is printed as 25 µg/m³ until 2019 and as 20 from 2020.

Zestaponi's manual station prints no yearly limits, only one-time and daily ones, so it has none.

## Placeholders, footnotes and zeros

- `…`, `...` and `-` are "data is not available" and never become a value. The one exception is `Illegal-logging.xls`, whose legend says `"-" Magnitude nil`. There, `-` is served as `0` in six cells (listed in the report), while `…` and `...` in the same table stay unavailable (Tbilisi 2012-2018, protected areas 2010-2012).
- A printed zero is a value, for example HFCs in 2001.
- Four air-quality cells carry a footnote mark and are served as the number:
  - Tbilisi A4 (Agmashenebeli Avenue), 2019: PM10 average `47*`, NO2 average `36*` and PM10 days `83*`. Geostat's footnote: "The station has been operational since May 2019 and data in the relevant cells reflect only May-December period in 2019."
  - Kutaisi B1, 2019: NO2 average `46*`. Geostat's footnote: "Measurements of nitrogen dioxide (NO2) concentrations were carried out in the period of August-December in 2019."

## Checks

`prepare.py` checks the following. `test_validation.py` tests the anchors and negative cases.

- **Observations.** No duplicate observation, no year outside the published tables, and no extra or missing observation compared with a fresh extraction.
- **Units and sources.** Every row's unit, source and sheet are the expected ones.
- **Re-reading.** Every row equals a fresh read of its source cell.
- **Greenhouse gases.**
  - Energy, industry, agriculture and waste add up to the total.
  - The three energy rows add up to energy.
  - CO₂, methane, nitrous oxide, and HFCs and SF₆ (in thousand tonnes, divided by 1,000) add up to the total.
  - The total plus land use equals the net total.
  - The tolerance is 0.15, the published rounding. The two land-use rows Geostat prints (the "LULUCF" row and the "Land use and forestry" sector row) differ in the second decimal; the sector row is served.
- **Air pollutants.** Stationary and mobile sources add up to the total (tolerance 0.15).
- **Water.**
  - Losses and net volume add up to the gross volume.
  - The published loss share matches the volumes.
  - C-7 prints the same three volumes as C-5.
- **Waste.** The eleven regions add up to Georgia. They match exactly every year.
- **Forests.** Regions and protected areas add up to Georgia for timber cut and illegal logging, within 2 m³. Geostat's note says its own rounding causes the differences.
- **Recorded differences.** Every non-zero difference is recorded exactly in `published_rounding_differences`. The largest is 2 m³, in timber cut 2019.
- **City air quality.** The limit checks described in [City limits](#city-limits).
- **Anchors.** The anchor values of design section 11, for example greenhouse gases 11.4 in 2000 and 20.1 in 2022, CO 86.4 in 2024, Rustavi D1 PM10 51 in 2025, timber cut 376,215 m³ in 2024, and illegal logging 45,915 m³ in 2014.

`verify_independent.mjs` uses SheetJS and shares no code or label table with `prepare.py`.

- **Finding the cells again.** It finds every cell its own way and compares all 2,125 rows field by field. For plain tables it searches for the labels; for A-2 it walks each station block line by line.
- **Repeating the checks.** It repeats the sum checks and the city-limit check, and checks the manifest's hashes.
- **Georgian versions.** It compares every served cell with the same cell of the Georgian workbook.
  - One served value differs: Rustavi D2 PM2.5, 2025, is 21.7 in English and 22 in Georgian. The English value is served.
  - The other differences are in cells that are not served: highest daily values in Rustavi, a unit cell in Zestaponi, and the 1961-1990 averages in B-1, rounded to one decimal in Georgian.
- **Negative controls.** Its negative controls confirm that it notices an altered value, a missing row, a shifted year, a wrong cell, a wrong unit, a zero written over a `…` cell, and broken sums.

## Rebuilding

Run from this folder:

```
python3 -I prepare.py           # rebuild the generated files
python3 -I prepare.py --check   # fail if a generated file is stale
python3 -I test_validation.py
node verify_independent.mjs     # rewrite independent-validation.json
```
