# Annual crime and justice data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Crime/geostat-crime-annual/`, collected on 2026-10-16 from Geostat's Criminal Justice Statistics page (`https://www.geostat.ge/en/modules/categories/132`, Georgian `https://www.geostat.ge/ka/modules/categories/132`). The research captures are immutable. The 1,262 primary counts are served on the Crime and justice pages (Recorded crimes, Convictions, Prisons, Victims and Road accidents) under the approved design `docs/superpowers/specs/2026-10-16-crime-design.md`; see [Serving on the Crime and justice pages](#serving-on-the-crime-and-justice-pages). Nothing is published through MCP or included in central machine-readable publications.

Annual data only. Recorded crimes run 2015–2025; convictions, prisons and road accidents 2001–2025; victims 2007–2011 and 2015–2025. Geostat's "I-II Q., 2026" and "I-II quarters, 2026" columns, monthly data, regional views and Geostat's other crime tables are excluded. The pages also show each count per 100,000 people, which Fiscal.ge calculates on the page and never stores (see [Per 100,000 people](#per-100000-people)).

## Sources and coverage

Geostat publishes the figures; each table names the agency that collects them. The source lines and notes Geostat prints, quoted verbatim (spaces collapsed) on the methodology page in each language:

| Page | Geostat workbook (source ID) | Agency, as printed |
| --- | --- | --- |
| Recorded crimes | `Number-of-Recorded-Crimes.xlsx` (`geostat_crime_recorded`) | "Note: Includes all investigative agencies of Georgia." / "Source: Ministry of Internal Affairs Of Georgia" |
| Convictions | `Number-of-Convicts-by-Types-of-Crime.xls`, `Composition-of-Convicts-by-Age-and-Sex.XLS`, `Number-of-Convicts-and-Penalties-Prescribed-by-Court.XLS` (`geostat_crime_convicts_types`, `_age_sex`, `_penalties`) | "Source: Supreme Court of Georgia." |
| Prisons | `Prison-Population.xls` (`geostat_crime_prison`) | "Source: 2001-2007 Ministry of Justice of Georgia, 2008-2017 Ministry of Corrections of Georgia, from 2018 Ministry of Justice of Georgia." |
| Victims | `Data-on-Victim-Statistics.xlsx` (`geostat_crime_victims`) | "Source: 2007-2011 Ministry of Internal Affairs of Georgia. From 2015 Prosecutor's Office of Georgia." |
| Road accidents | `Accidents.xlsx` (`geostat_crime_road`) | "Source: Ministry of Internal Affairs of Georgia." |

Twenty-two originals are preserved under `official/`: the ten English workbooks, their ten Georgian versions (the same numbers at the same cells, kept for the Georgian labels) and captures of the English and Georgian category pages. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the same originals are published through `data/methodology/source-archives/crime.csv`, where each workbook is dated by the years it prints (Geostat's half-year 2026 column is not counted) and a Georgian version by the years of its English original. Seven English workbooks supply values. The 2001–2011 recorded-crimes table (old groups that cannot be matched to the current types, and 2012–2014 missing), juvenile offenders by type of offence and human trafficking (about ten cases a year) are archived for provenance only; no value is read from them. The package README holds the cell map, every footnote Geostat prints under the served tables quoted verbatim, and Geostat's printed spellings.

The December 2025 *Unified Report on Criminal Justice Statistics* (`https://geostat.ge/media/76844/Unified-Report-on-Criminal-Justice-Statistics-%28Dec%2C-2025%29.pdf`) is linked from the methodology page and not archived; no value is read from it.

## Research package

The package holds, besides `official/`: `source-manifest.csv` and `.json`, `prepare.py` (finds every row by its printed English label and every column by its year heading, never by a fixed position, reads the old `.xls` workbooks with `xlrd` 2.0.1, and writes `crime-annual.csv`, `crime-series-breaks.csv` and `coverage.csv`), `verify_independent.mjs`, `test_validation.py`, `validation-report.json`, `independent-validation.json` and a README with the cell map. `coverage.csv` lists, for each indicator, the first and last year, the count and the years between them that carry no value (`crime.road.accidents_drunk`: 2002; sentenced and awaiting trial: 2001–2009; every victims series: 2012–2014).

## Recorded crimes

A recorded crime is a crime on which an investigation was started by any investigative agency of Georgia, not only the police ("Includes all investigative agencies of Georgia."). It counts crimes, not people, and it is not a measure of the crime that actually happened. The page serves all recorded crimes and Geostat's 11 types, which add up exactly to the total in every year 2015–2025. The 2001–2011 table is not served; its footnote on the May 2005 amendments to the Code of Criminal Procedure applies only to that table and is quoted on the methodology page, not drawn.

## The 2018 counting change

`registration_2018` (2018-01-01; all 12 `crime.recorded.*` IDs). Recorded crimes rose from 37,944 in 2017 to 58,412 in 2018, in every group but public security and order and drug crimes. The Ministry of Internal Affairs' explanation at the time (from 2018 it registers offences it previously left out, such as minor damage to property, and each suicide is registered as an investigation of incitement to suicide under article 115 of the Criminal Code) is named as the Ministry's: no official text of it was reachable (`police.ge` and `mia.gov.ge` refused the cloud workspace, and neither Geostat's pages nor its workbooks nor the Unified Report carry a note on 2018). The Unified Report's table 1-2 for 2025 is quoted as the one sign in Geostat's own publications: 1,119 of the 1,486 crimes against life are "Incitement to suicide article 115 *", and its note says the figures include "both the facts of suicide and cases of natural death, accidents, etc.". The values before and after 2018 are not comparable, and nothing on the pages says how much of the rise is real. Charts draw the break on every recorded-crime series and tables mark 2018.

## Convictions and sentences

Convictions are people convicted by the courts in the year, from the Supreme Court of Georgia. The three convictions workbooks print the same total in every year (the age-and-sex workbook twice), and the 11 crime types, five age bands, two sexes and seven sentences each add up exactly to it. Two sentence names differ from Geostat's English table: `sentence_suspended` is Geostat's "Suspended conviction" (პირობითი მსჯავრი: a sentence the person does not serve unless they break its conditions during a probation period), labelled "Suspended sentence"; `sentence_deferred` is Geostat's "Suspended sentence" (გადაედოთ განაჩენის აღსრულება: carrying out the sentence was postponed; 2 cases in 2025), labelled "Deferred sentence". `sentence_community_work` is Geostat's "Public work". Real zeros, such as corrective labour in most years, are served.

## Prisoners at the end of the year

Prisoners are counted at the end of each year, on 31 December, and include people awaiting trial. Women and men, and adults and juveniles, add up exactly to all prisoners in every year 2001–2025; sentenced and awaiting trial start in 2010 (Geostat prints `...` before) and add up to the total from then. Geostat's note on the 1 October 2010 Code on Imprisonment and its source line (Ministry of Justice 2001–2007, Ministry of Corrections 2008–2017, Ministry of Justice from 2018) are quoted on the methodology page; the change of agency is not drawn as a break because Geostat does not call it one. The split of women and men inside adults, juveniles, sentenced and awaiting trial stays in the workbook and is not served.

## Victims

Victims are counted by sex, age and citizenship, each with a not-stated group, and each breakdown adds up exactly to the total in every printed year. The Ministry of Internal Affairs supplied 2007–2011 and the Prosecutor's Office from 2015; Geostat prints no 2012–2014 columns, so those years are a gap on every series and no break is drawn. The age bands are Geostat's ("less then 17", "17-24", "25-44", "more then 44").

## Road accidents and drunk driving

Road accidents, accidents caused by drunk driving, people killed and people injured, 2001–2025. Geostat prints `…` for drunk-driving accidents in 2002, which is a gap. `drunk_driving_coverage_2025` (2025-01-01; `crime.road.accidents_drunk` only) quotes Geostat's footnote in full: until 2024 the figure covers only the Patrol Police Department's jurisdiction, from 2025 the whole territory, "Accordingly, the 2025 data is not comparable with data from previous years." The break is drawn on that series only.

## Per 100,000 people

The per 100,000 people view is the only figure Fiscal.ge calculates. Each count is divided by `demography.population_total` for `country.georgia` (Geostat's population on 1 January of the same year, served by the Demography pages and archived as `source.geostat_municipal_population`) and multiplied by 100,000; it is shown and exported to one decimal and marked as calculated. For prisons the end-of-year count is divided by the population on 1 January of that year. The population starts on 1 January 2004, so 2001–2003 have no rate and are gaps, never zero. The 1 January 2025 population is census-based (the existing `census_recalculation_2025` break), so every rate series shows that break whenever a series is selected. No other ratio is computed: no shares, solved rates, growth rates or interpolation. Rates are calculated in the explorer model from the served counts and the served population, as Money and banks calculates its shares of GDP; they are not stored in `crime-annual.csv` or the mirror.

## No map

Geostat publishes none of these tables by region. The monthly Unified Report splits prosecutions and convictions by prosecutor's districts, which do not match the 11 regions, so the pages show Georgia as a whole and have no map.

## Gaps, dashes and zeros

A missing value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…` and `...` cells produce no row. A published `0` is a count of zero and is served. Nothing is estimated, interpolated or filled in. Half-year 2026 values are never served.

## Indicators

Indicator IDs are stable lowercase ASCII `crime.{topic}.{item}`; Georgian and English labels are display data.

| Indicator IDs | Unit | Years |
| --- | --- | --- |
| `crime.recorded.total`, `crime.recorded.{life, health, rights, family, property, public_safety, drugs, transport, malfeasance, government, other}` | crimes | 2015–2025 |
| `crime.convicted.total`, `crime.convicted.type_*` (11), `age_*` (5), `sex_{women, men}`, `sentence_*` (7) | persons | 2001–2025 |
| `crime.prison.{total, women, men, adults, juveniles}` | persons | 2001–2025 |
| `crime.prison.{sentenced, pretrial}` | persons | 2010–2025 |
| `crime.victims.total`, `sex_*` (3), `age_*` (5), `citizenship_*` (5) | persons | 2007–2011, 2015–2025 |
| `crime.road.{accidents, accidents_drunk}` | accidents | 2001–2025; `accidents_drunk` has no 2002 |
| `crime.road.{killed, injured}` | persons | 2001–2025 |

All 1,262 rows (63 indicators) use `basis=actual` and `value_status=official`, and keep their source ID, sheet and cell.

## Validation and evidence

In the package, `python3 -I -B prepare.py --check && python3 -I -B test_validation.py -v && node verify_independent.mjs` rebuilds every output in memory and rejects a duplicate, missing or extra observation, a served year outside a table's coverage, any 2026 or part-year value, a `…`, `...` or `-` served as a value, a value that is not a whole non-negative count, and a row that differs from a fresh read of its cell, label and year heading. It also requires, for every year:

1. the 11 recorded-crime types to add up to all recorded crimes;
2. the convictions by type, age, sex and sentence each to add up to the total, and the three convictions workbooks to print the same total;
3. prison women and men, and adults and juveniles, to add up to all prisoners, and from 2010 sentenced and awaiting trial too;
4. victims by sex, age and citizenship each to add up to the total;
5. every footnote quoted in `crime-series-breaks.csv` to be printed on its workbook.

`node verify_independent.mjs` re-reads the seven served workbooks with SheetJS from separately written label tables, matches all 1,262 values, compares the ten Georgian workbooks with their English originals cell by cell, re-hashes every archived file and runs 12 negative controls. Anchor values: recorded crimes 2015 35,096, 2018 58,412, 2025 54,134; property crimes 2025 17,251; convicted 2001 8,897, 2025 22,767; prison sentences 2025 5,793; prisoners end of 2011 24,114, end of 2025 11,153; victims 2025 17,209; road accidents 2025 5,969, killed 469, injured 8,191.

`validateCrimeFacts` (`apps/web/lib/data/crime/validation.ts`) repeats the rules that do not need the workbooks whenever the CSV or the mirror is loaded: the coverage of `coverage.csv`, the source and unit contract of each indicator, whole counts with the published value equal to the stored one, no value in a gap year, the same sums, and the anchor values.

## Serving on the Crime and justice pages

`npm run data:prepare-crime` re-reads the package, requires its report and the independent verification to have passed, and writes `data/imports/crime-annual.csv` (UTF-8 with BOM), `data/imports/crime-series-breaks.csv` and `data/reports/crime-validation.json`. `npm run data:check-crime` (part of `data:validate`) rebuilds them in memory and fails on any difference. The canonical CSV has the columns `year, indicator_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell, last_reviewed_at`. The Prisma mirror table `CrimeFact` is created by migration `20261016200000_crime` with row-level security on and public grants revoked, and is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows (`assertCrimeParity`). The counting-change register is read from the CSV only.

Crime and justice is served by a static build only. It is not added to the `/mcp` snapshot or to the JSON publications, its sources are excluded from the fact-query snapshot, and no page makes a request-time database or file read.

The pages describe the figures and state no causes. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the active measure's selected series and years, explicit units, blank cells for missing values and validated links to the archived copies of the Geostat workbooks on fiscal.ge; a per-100,000 workbook also lists the archived population table and says in its Summary that the rates are calculated by fiscal.ge from Geostat's counts and Georgia's population on 1 January. Internal identifiers and cell references are not exported.

Original sources: [Criminal justice statistics (Geostat)](https://www.geostat.ge/en/modules/categories/132).
