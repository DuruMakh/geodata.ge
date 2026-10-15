# Annual healthcare and causes-of-death data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Health/geostat-health-annual/`, collected on 2026-10-15 from Geostat's Healthcare page (`https://www.geostat.ge/en/modules/categories/54`) and Deaths page (`https://www.geostat.ge/en/modules/categories/320`). The research captures are immutable. The 4,204 primary values are served on the Health pages (Doctors and hospitals, Illnesses, Causes of death and its 12 area pages) under the approved design `docs/superpowers/specs/2026-10-15-health-design.md`; see [Serving on the Health pages](#serving-on-the-health-pages). Nothing is published through MCP or included in central machine-readable publications.

Annual data only. Staff, facilities, visits and illnesses run 2002–2025 (diabetes and anaemia 2016–2025); deaths by cause and the death rate run 2014–2025 for Georgia and the 11 regions. Abkhazia, the 1994–2013 death rates, monthly data and Geostat's other health tables are excluded.

## Sources and coverage

Geostat publishes the figures. Its nine served healthcare tables carry the line "Source: Ministry of Internally Displaced Persons From The Occupied Territories, Labour, Health and Social Affairs of Georgia, National Center for Disease Control and Public Health."; the deaths-by-cause table (23-2) names the same ministry and the Levan Sakvarelidze National Center for Disease Control and Public Health as its source, and the death-rate table (24-1) names none. Thirty-six originals are preserved under `official/`: 21 workbooks from the Healthcare page, 13 from the Deaths page (`official/deaths/`) and captures of both pages. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the same originals are published through `data/methodology/source-archives/health.csv`, where each workbook that supplies served values is dated by its served years and each archived-only workbook by the years it prints inside 2002–2025 (the earlier columns of the infectious-disease, deaths-by-sex and suicide-rate tables are named in the row's note). Every workbook has one sheet named `1`, except the archived-only 23-4 and 23-5, which have one sheet per year, 2014 to 2025.

| Page | Workbooks | Served values |
| --- | --- | --- |
| Doctors and hospitals | physicians by occupation, nurses by speciality, main characteristics of public health | 568 |
| Illnesses | disease groups, tuberculosis, HIV/AIDS, diabetes, anaemia, syphilis and gonorrhoea | 540 |
| Causes of death | 23-2 deaths by ICD-10 chapter and region, 24-1 crude death rate by region | 3,096 |

Eleven workbooks supply values. The other 23 (abortions, emergency care, children's illnesses, infectious diseases by type, circulatory and respiratory systems from 2020, medicines and disability programmes, cancer screening, and deaths by sex, urban and rural, age, cause, maternal, infant, under-5 and suicide tables) are archived for provenance only; no value is read from them. The package README holds the cell map, every footnote Geostat prints under the served tables quoted verbatim, and Geostat's printed spellings.

## Research package

The package holds, besides `official/`: `source-manifest.csv` and `.json`, `prepare.py` (finds every row by its printed label and every column by its year heading, never by a fixed position, and writes `health-annual.csv`, `health-series-breaks.csv` and `coverage.csv`), `verify_independent.mjs`, `test_validation.py`, `validation-report.json`, `independent-validation.json` and a README with the cell map. `coverage.csv` lists, for each indicator and area, the first and last year, the count and the years the table's own year headings cover but no value is served for. The README also quotes every footnote Geostat prints under the served tables.

## Staff, hospitals and visits

Doctors are Geostat's "Number of physicians by occupations (Main staff)": `Physicians, total` and its 14 specialities, which add up to the total in every year. Nurses are Geostat's "Number of nurses by basic specialities": the total, midwives and medical nurses for 2002–2025, and doctors' assistants, laboratory assistants, X-ray assistants and other nursing staff for 2002–2011 (Geostat prints "…" for them from 2012). Hospitals, out-patient clinics, beds and out-patient visits (including preventive visits) come from "Main characteristics of public health (end of year)"; beds and visits are stored in thousands, as published. Geostat's 2020 note on the physicians table: "Physicians staff numbers are estimated values by position and are calculated based on the percentage distribution of aggregated statistical reporting data obtained from medical institutions."

## Counting changes

`data/imports/health-series-breaks.csv` records four counting changes in the demography break format (`break_id, applies_to, reference_date, reason, source_note`), each reason quoting Geostat's footnote:

| Break | Applies to | Year | Drawn |
| --- | --- | --- | --- |
| `staff_definitions_2012` | doctors, specialities, nurses and nurse groups | 2012 | yes |
| `staff_register_2020` | doctors, specialities, nurses and nurse groups | 2020 | yes |
| `icd10_groups_2006` | the combined nervous system and sense organs group and the three groups that replace it | 2006 | no: one series ends and three start |
| `new_cases_electronic_2020` | the disease groups (not the combined group, which ends in 2005) and diabetes | 2020 | yes |

Drawn breaks appear as a gap and a dashed "new counting" rule on the chart (`EditorialLineChart` `breaks`) and as a marked year in the table (`ExplorerTable` `breakYears`) whenever a selected series is in the break's `applies_to`. No growth is computed across a break.

## New cases of illness

Illness values are new cases recorded by clinics in the year, not the number of people who are ill. The 19 disease groups are in thousands; the six single diseases (tuberculosis, HIV/AIDS, diabetes, anaemia, syphilis, gonorrhoea) are in persons from their own tables. Geostat's notes quoted on the methodology page: the 2020 electronic recording of new cases in out-patient facilities, diabetes "From 2020 - According to personalized data.", the 2006 ICD-10 split of the nervous system group into three, the electronic registry for pregnant women and newborns from 2018, and the 2008–2009 HIV/AIDS surveillance change after which the data were "retrospectively revised". The 2018 and 2008–2009 notes are not drawn.

## No total of all illnesses

Geostat's disease-group table has no total row and the single diseases come from separate tables. Fiscal.ge computes no total of new cases, so none is shown; the groups are compared side by side.

## Causes of death

Deaths are registered deaths from table 23-2, by ICD-10 chapter: all deaths, chapters I–XIX and chapter XXII (COVID-19, from 2020; its 2014–2019 cells are empty and are gaps). Chapter XVIII "Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified" is served as `ill_defined` and labelled "Ill-defined causes"; chapter XIX is `external`. Chapters XX and XXI do not appear in the table. Geostat's note "The revision of causes of death for 2015-2017 is based on the information (Verbal Autopsy, Cancer Registry and Stationary Electronic System) from the National Center for Disease Control and Public Health" is quoted on the methodology page. Cell `J20` (Georgia, pregnancy and childbirth, 2021) is printed as `34***`; it is served as 34 and the methodology page quotes the sheet's footnote, "In 2021, 24 cases of maternal deaths are related to COVID-19".

## Death rate

The death rate is Geostat's crude death rate per 1,000 population (table 24-1) for Georgia and the 11 regions, published to one decimal and not recalculated. Geostat's note says 1995–2013 are retro-projections and registered data start in 2014, so the rate is served from 2014. The Abkhazia row (a dash, "Occupied territories") is never served. All deaths equal `demography.deaths` in `data/imports/demography-vital-annual.csv` for Georgia in 2014–2025 and for each region in 2015–2025, the years the Demography pages serve for regions.

## Gaps, dashes and zeros

A missing value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…` and `...` cells produce no row; the death-rate `-` cells belong only to the unserved Abkhazia row. A `0` in the deaths table (for example COVID-19 for Georgia in 2025, or eye and ear diseases in several areas and years) is a published count and is served. Nothing is estimated, interpolated or derived.

## Indicators

Indicator IDs are stable lowercase ASCII `health.{topic}.{item}`; Georgian and English labels are display data. Area IDs are `georgia` and the existing `region.*` IDs.

| Indicator IDs | Unit | Areas | Years |
| --- | --- | --- | --- |
| `health.staff.doctors` and 14 `health.staff.doctors_*` specialities | persons | georgia | 2002–2025 |
| `health.staff.nurses`, `health.staff.nurses_midwives`, `health.staff.nurses_medical` | persons | georgia | 2002–2025 |
| `health.staff.nurses_{doctor_assistants, lab_assistants, xray_assistants, other}` | persons | georgia | 2002–2011 |
| `health.facilities.hospitals`, `health.facilities.outpatient_clinics` | units | georgia | 2002–2025 |
| `health.facilities.beds` | units_thousand | georgia | 2002–2025 |
| `health.visits.outpatient` | visits_thousand | georgia | 2002–2025 |
| `health.illness.*` disease groups (19) | persons_thousand | georgia | 2002–2025; `nervous_sense_organs` 2002–2005; `nervous`, `eye`, `ear` 2006–2025 |
| `health.illness.{tuberculosis, hiv, syphilis, gonorrhoea}` | persons | georgia | 2002–2025 |
| `health.illness.{diabetes, anaemia}` | persons | georgia | 2016–2025 |
| `health.deaths.total` and 20 `health.deaths.*` causes | persons | georgia and 11 regions | 2014–2025; `covid19` 2020–2025 |
| `health.death_rate.total` | per_1000_population | georgia and 11 regions | 2014–2025 |

All rows use `basis=actual` and `value_status=published`. Each keeps its source ID, sheet, cell and number format.

## Validation and evidence

In the package, `python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs` rebuilds every output in memory and rejects a duplicate, missing or extra observation, a served year outside a table's coverage, a `…`, `...` or `-` served as a value, a published value that is not the stored value at Geostat's precision, and a row that differs from a fresh read of its cell. It also requires, for every year:

1. doctors and nurses to equal the main characteristics table's thousands × 1,000, rounded to whole persons;
2. the 14 specialities to add up to doctors exactly;
3. the causes of death to add up to all deaths for Georgia and each region exactly;
4. the 11 regions to add up to Georgia for all deaths and for each cause exactly;
5. all deaths to equal the Demography pages' registered deaths;
6. every footnote quoted in `health-series-breaks.csv` to be printed on the named workbook.

The serving code repeats the rules that do not need the workbooks. `validateHealthFacts` (`apps/web/lib/data/health/validation.ts`) runs whenever the CSV or the mirror is loaded and rejects a row outside `coverage.csv`, a duplicate, a missing observation, a unit, basis, value status or source that does not match the indicator, a non-numeric or negative value, and a published value that is not what the package's display rule gives for the stored value, unit and number format. It also requires the doctor specialities to add up to doctors in every year, the causes to add up to all deaths for Georgia and each region (COVID-19 counts as 0 before 2020 inside this check only), the 11 regions to add up to Georgia for all deaths and for each cause, and 13 anchor values to keep their published text.

`node verify_independent.mjs` re-reads the 11 served workbooks with SheetJS and separately written label tables and matches all 4,204 values. Spot values: doctors 2025 22,491; nurses 2025 21,262; hospitals 2025 232; deaths 2025 44,319; Racha-Lechkhumi and Kvemo Svaneti death rate 2025 19.7.

## Serving on the Health pages

`npm run data:prepare-health` re-reads the package, requires its report and the independent verification to have passed, and writes `data/imports/health-annual.csv` (UTF-8 with BOM), `data/imports/health-series-breaks.csv` and `data/reports/health-validation.json`. `npm run data:check-health` (part of `data:validate`) rebuilds them in memory and fails on any difference. The canonical CSV has the columns `year, indicator_id, area_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell, source_number_format, last_reviewed_at`. The Prisma mirror table `HealthFact` is created by migration `20261015150000_health` with row-level security on and public grants revoked, and is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows. Before it serves from the mirror, the build validates both sets and compares them field by field (`assertHealthParity`); any difference stops the build. The counting-change register is read from the CSV only; the database holds no copy of it.

Health is served by a static build only. It is not added to the `/mcp` snapshot or to the JSON publications, and no page makes a request-time database or file read.

The pages show values as precisely as Geostat publishes them. Display units change only by an exact power of ten: beds as a count, visits in millions, single diseases in thousands next to the disease groups. The pages describe the figures and state no causes. The health sources are registered sources of a human explorer only and are excluded from the fact-query snapshot.

Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, blank cells for missing values and validated links to the archived copies of the Geostat workbooks on fiscal.ge. The values are the published ones in the unit Geostat stores them in (beds and visits in thousands, single diseases in persons), with no display conversion, and each sheet names its unit. Every Data sheet cell has the number format of its own fact (`#,##0` or `#,##0.0` to `#,##0.000`, by the decimals that year is published with); a Summary row uses the format of its most precise year. The status column reads "Published", or "Not available" for a year with no value. Only the sources of the years and series in the file are listed. Internal cell references are not exported.

Original sources: [Healthcare (Geostat)](https://www.geostat.ge/en/modules/categories/54) and [Deaths (Geostat)](https://www.geostat.ge/en/modules/categories/320).
