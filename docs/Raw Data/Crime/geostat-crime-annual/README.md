# Annual crime and justice statistics (Geostat)

Research package for the Fiscal.ge Crime and justice hub. Approved design: `docs/superpowers/specs/2026-10-16-crime-design.md` (sections 6, 9 and 10). Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

All were retrieved on 2026-10-16 from Geostat, the National Statistics Office of Georgia, with `curl -L` from the cloud workspace (the first request for the Georgian `registrirebuli-danaSaulis-raodenoba.xlsx` was reset and succeeded on the retry). Each of the ten English workbooks was fetched again from its `geostat.ge/media` link and matched byte for byte the copy first saved in the project's source folder (`/mnt/project-files/crime-sources/`, downloaded the same day); so did the Georgian recorded-crimes workbook. Every `geostat.ge` link redirects to `www.geostat.ge` with the same path (`resolved_file_url` in the manifest).

- **English category page** (`https://www.geostat.ge/en/modules/categories/132`, "Criminal justice statistics"): ten workbooks in `official/`, capture `official/crime-page.html` (`geostat_crime_page`).
- **Georgian category page** (`https://www.geostat.ge/ka/modules/categories/132`, `siskhlis-samartlis-statistika`): the ten Georgian versions of the same workbooks, linked as `https://geostat.ge/media/<id>/<name>`, capture `official/crime-page-ka.html` (`geostat_crime_page_ka`).

`source-manifest.csv` and `source-manifest.json` give, for each of the 22 archived files, its source ID, title, page, retrieved and resolved URL, retrieval date, local file, SHA-256 and size.

Every workbook has one sheet, named `1`. Seven English workbooks are served; the other three are archived for provenance and no value is read from them.

| Source ID | English file (media ID) | Georgian version (media ID) | Served |
| --- | --- | --- | --- |
| `geostat_crime_recorded` | `Number-of-Recorded-Crimes.xlsx` (81890) | `registrirebuli-danaSaulis-raodenoba.xlsx` (81889) | 12 recorded-crime series, 2015-2025 |
| `geostat_crime_convicts_types` | `Number-of-Convicts-by-Types-of-Crime.xls` (81980) | `msjavrdebulTa-ricxovnoba-danaSaulis-saxeebis-mixedviT.XLS` (81979) | total convicted and 11 crime types |
| `geostat_crime_convicts_age_sex` | `Composition-of-Convicts-by-Age-and-Sex.XLS` (81982) | `msjavrdebulTa-ricxovnoba-asakisa-da-skesis-mixedviT.XLS` (81981) | 5 age bands, 2 sexes |
| `geostat_crime_convicts_penalties` | `Number-of-Convicts-and-Penalties-Prescribed-by-Court.XLS` (81984) | `msjavrdebulTa-ricxovnoba-sasjelis-RonisZiebebis-mixedviT.XLS` (81983) | 7 sentences |
| `geostat_crime_prison` | `Prison-Population.xls` (81046) | `patimarta-ricxovnoba.xls` (81045) | 7 prison series, end of year |
| `geostat_crime_victims` | `Data-on-Victim-Statistics.xlsx` (81892) | `dazaralebulta-raodenoba.xlsx` (81891) | 14 victim series |
| `geostat_crime_road` | `Accidents.xlsx` (81914) | `avtosagzao-SemTxvevebi.xlsx` (81913) | 4 road-accident series |
| `geostat_crime_recorded_2001_2011` | `Number-of-Recorded-Crimes_2011.xls` (31827) | `registrirebuli-danaSauli_2011.xls` (31826) | archived only (old classification) |
| `geostat_crime_juvenile` | `Juvenile-Offenders-Convicted-by-Type-of-Offence.XLS` (81986) | `arasrulwlovani-msjavrdebulebis-raodenoba-Cadenili-danaSaulis-saxeebis-mi....xls` (81985) | archived only |
| `geostat_crime_trafficking` | `Trafficking.xlsx` (81894) | `trefikingi.xlsx` (81893) | archived only (about ten cases a year) |

Each Georgian file has the source ID `geostat_crime_<file stem in lower case, non-alphanumerics as _>_ka`, for example `geostat_crime_registrirebuli_danasaulis_raodenoba_ka`. The last Georgian file name really ends in `mi....xls` on Geostat's page. The Georgian versions hold the same numbers at the same cell addresses as the English ones (`verify_independent.mjs` compares 2,922 numeric cells in the ten pairs and finds no difference); where an English cell holds a number as text with a space, the Georgian cell holds a plain number.

**Not archived:** the December 2025 *Unified Report on Criminal Justice Statistics* (monthly PDFs, category 679), 182 pages, 5.3 MB, `https://geostat.ge/media/76844/Unified-Report-on-Criminal-Justice-Statistics-%28Dec%2C-2025%29.pdf`. It is linked, not stored here, and no value is read from it. Its first page, table 1-2 ("Statistics of Registered Crime", 2025, all investigative agencies of Georgia), prints 54,134 registered crimes in total; row 2 is "Crime against human beings (article 108-116)" with 1,486 crimes, and row 12 (its tenth article) is "Incitement to suicide article 115 *" with 1,119 crimes (0.98% solved). The table's own note: "* Data includes full details of the investigation initiated under Art. 115 and 116 of the Criminal Code (both the facts of suicide and cases of natural death, accidents, etc.);". SHA-256 of the file retrieved on 2026-10-16: `4D49C4929D5455575D4D10898E6D732F6BD68633447E31C394FC5262DF05BF11`.

`xlrd` reads the old `.xls` workbooks. It is a research-package dependency only, not an application one: `python3 -m pip install xlrd==2.0.1` (version 2.0.1 was used). `.xlsx` files are read with the standard library only. The TypeScript prepare step and `verify_independent.mjs` read both formats with the repository's `xlsx` (SheetJS 0.20.3).

## Outputs

- `crime-annual.csv`: the 1,262 served observations. Columns: `year, indicator_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell`.
  - `value` is the exact cell content as a number: a float cell such as `8897.0` becomes `8897`, and a text cell such as `'49 976'` becomes `49976`. Every served cell is a whole count, so a cell with a fraction fails.
  - `published_value` equals `value`.
  - `unit` is `crimes` (recorded crimes), `accidents` (road accidents and the drunk-driving ones) or `persons`; `basis` is `actual`; `value_status` is `official`.
  - `source_cell` is the A1 address. For `.xls` files xlrd gives a 0-based row and column, so the address is computed from them (row 2, column 25 is `Z3`).
  - Rows are in indicator order (the order of the table below), then year.
- `crime-series-breaks.csv`: the two counting changes of design section 9, in the demography format (`break_id, applies_to, reference_date, reason, source_note`).
- `coverage.csv`: for each indicator the first and last year, the count and the years between them that carry no served value (`crime.road.accidents_drunk`: `2002`; the prison sentenced and awaiting-trial series: `2001-2009`; every victims series: `2012-2014`).
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).

Served rows by family: recorded 132, convicted 650, prison 157, victims 224, road 99, in all 1,262 (63 indicators). The design spec's "about 1,270" was a rough count.

## Cell map

`prepare.py` finds every row by its printed English label and every column by its year heading, never by fixed position. Labels are matched exactly after collapsing whitespace, so a stray space or non-breaking space does not matter but a different spelling does. A workbook with several blocks has several heading rows; a row takes the nearest one above it. The year columns are the heading row's year cells (an integer or float year); the column headed `I-II Q., 2026` or `I-II quarters, 2026` is skipped, and any other heading that is not a whole-number year fails. Where a label repeats, the row is the first one after the block title or total row that precedes it (the `after` labels below).

| Indicator IDs | Workbook, row | Unit | Years | Rows |
| --- | --- | --- | --- | --- |
| `crime.recorded.total`; `crime.recorded.{life, health, rights, family, property, public_safety, drugs, transport, malfeasance, government, other}` | recorded: `Total crimes recorded` and the 11 rows after `of which:` in that order | crimes | 2015-2025 | 132 |
| `crime.convicted.total`; `crime.convicted.type_{murder, aggravated_murder, injury, rape, larceny, robbery, theft, drugs, hooliganism, traffic, other}` | convicts types: `Total number of convicts` and the 11 rows after `Type of crimes:` | persons | 2001-2025 | 300 |
| `crime.convicted.age_{14_17, 18_24, 25_29, 30_49, 50_plus}` | age-sex: the 5 rows after the age block's `Of which:` | persons | 2001-2025 | 125 |
| `crime.convicted.sex_{women, men}` | age-sex: `Women`, `Men` after the `Sex Composition of Convicts` title and its `Of which:` | persons | 2001-2025 | 50 |
| `crime.convicted.sentence_{prison, corrective_labour, suspended, fine, deferred, community_work, other}` | penalties after `Sentenced to:`: `Imprisonment`, `Corrective labour`, `Suspended conviction`, `Fine`, `Suspended sentence`, `Public work`, `Other penalties` | persons | 2001-2025 | 175 |
| `crime.prison.total`, `crime.prison.{women, men}` | prison, first block: `Total number of inmates` and the first `women` and `men` after its `among them:` | persons | 2001-2025 | 75 |
| `crime.prison.{adults, juveniles}` | prison, first block: `Number of adult inmates`, `Number of juvenile inmates` | persons | 2001-2025 | 50 |
| `crime.prison.{sentenced, pretrial}` | prison: `Total number of Convicted`, `Total number of defendants` | persons | 2010-2025 | 32 |
| `crime.victims.total`; `crime.victims.sex_{men, women, unknown}`; `crime.victims.age_{under_17, 17_24, 25_44, 45_plus, unknown}`; `crime.victims.citizenship_{georgia, foreign, dual, stateless, unknown}` | victims: `Total number of victims`, then each block's rows in order: sex after `of which:` (`Men`, `Women`, `Non specified`); age after `Number of victims by age` (`less then 17`, `17-24`, `25-44`, `more then 44`, `Nonspecified`); citizenship after `Number of victims by citizenship` (`Citizens of Georgia`, `Foreigners`, `Dual citizenship`, `Stateless`, `Nonspecified`) | persons | 2007-2011, 2015-2025 | 224 |
| `crime.road.{accidents, accidents_drunk, injured, killed}` | road: `Total number of road traffic accidents`, `of which were caused by alcohol intoxication*`, `Persons injured`, `Persons killed` | accidents, accidents, persons, persons | 2001-2025; `accidents_drunk` has no 2002 | 99 |

**Geostat's spelling and labels, matched as printed:** `less then 17`, `more then 44`, `Non specified` (sex) against `Nonspecified` (age and citizenship, the same word without the space), `Other Crimes`, `Crimes against the family and minor`, `Total number of Convicted` (trailing space in the cell) and `Total number of victims ` (trailing space). The prison workbook repeats `women` and `men` nine times each (under all inmates, adults and juveniles, in each of its three blocks); only the first pair, directly under `Total number of inmates`, is served. The victims workbook repeats `Nonspecified` under age and citizenship, each taken from inside its own block. The age-sex workbook prints `Total number of convicts` twice and `Of which:` twice.

**Not served** (spec section 6): prison's split of women and men within adults, juveniles, convicted and defendants; the juvenile-offenders table; trafficking; the 2001-2011 recorded-crimes table; every `I-II Q., 2026` or `I-II quarters, 2026` value (recorded crimes 29,915, victims 8,385, road accidents 1,268, convicts 13,921).

## Series breaks

- `registration_2018` (2018-01-01; all 12 `crime.recorded.*` IDs): recorded crimes rose from 37,944 in 2017 to 58,412 in 2018 in almost every group (all but public security and order, which fell from 1,575 to 1,570, and drug-related offences, which fell from 4,762 to 4,239). The reason says that counts from 2018 are not comparable with those for 2015-2017, that no change is calculated across 2018, and that Fiscal.ge does not say how much of the rise is a real increase in crime. It attributes no explanation to anyone, because none was found in an official text (below).
- `drunk_driving_coverage_2025` (2025-01-01; `crime.road.accidents_drunk`): the reason quotes Geostat's footnote in full (below). `prepare.py` fails if the quoted footnote is not printed in the workbook, or if the 2017 and 2018 totals in the 2018 reason are not the served ones.

**Search for an official statement on the 2018 change.** The design spec attributed an explanation of the change to the Interior Ministry. I could not find or quote an official text of it, so it is not used anywhere (the break reason, the methodology page and `docs/data-methodology/crime-annual.md` give no explanation):

- Geostat's two category pages (captured in `official/`) list only the workbooks and the Unified Report; they carry no methodology note on crime registration.
- No Geostat workbook or footnote mentions 2018 for recorded crimes. The one 2018 reference in the served workbooks is the prison table's source line ("from 2018 Ministry of Justice of Georgia"), which concerns the prison source, not crime registration.
- `police.ge` returns an "Access Denied" page and `mia.gov.ge` resets the connection when asked from this cloud workspace, so the Ministry's own site could not be searched.
- The December 2025 Unified Report has no note on 2018 either.

As context only, the methodology page states two facts from Geostat's data and publications, without drawing a cause from them: crimes against life rose from 1,013 in 2017 to 2,154 in 2018 in the served data, and the Unified Report's table 1-2 for 2025 (below) lists 1,119 of the 1,486 crimes against life as "Incitement to suicide article 115 *", with its note quoted.

## Footnotes Geostat prints under the served tables

Quoted as printed (spelling and all, spaces collapsed).

- **Recorded crimes** (title "Number of Recorded Crimes (unit)"), cells `A16` and `A17`:
  - "Note: Includes all investigative agencies of Georgia."
  - "Source: Ministry of Internal Affairs Of Georgia"
- **Convicts by types of crime** ("Number of Convicts by Types of Crime (persons)"), **by age and sex** ("Age Composition of Convicts (persons)" and "Sex Composition of Convicts (persons)") and **by penalties** ("Number of Convicts by Penalties Prescribed by Court (persons)"): each prints only "Source: Supreme Court of Georgia."
- **Prison population** ("Prison Population (end of year, persons)", with the blocks "Convicted Population" and "Defendants Population"), cells `A45` and `A46`:
  - "Note: According to the new „Code on Imprisonment” (which entered into force on 1st October, 2010), all persons incarcerated in penitentiary establishements are referred as „Pre-trial and Convicted Inmates”. The same category can also be referred with a general term „Inmates”."
  - "Source: 2001-2007 Ministry of Justice of Georgia, 2008-2017 Ministry of Corrections of Georgia, from 2018 Ministry of Justice of Georgia."
- **Victims** ("Number of Victims (persons)"), cell `A20`: "Source: 2007-2011 Ministry of Internal Affairs of Georgia. From 2015 Prosecutor's Office of Georgia."
- **Road traffic accidents** ("Data on Road Traffic Accidents (unit)"), cells `A7` and `A8`:
  - "*Data on road traffic accidents caused by drunk driving from 2001 to 2024 covers only the jurisdiction of the Patrol Police Department of the Ministry of Internal Affairs. However, starting from 2025, the data on road traffic accidents fully covers the entire territory of Georgia. Accordingly, the 2025 data is not comparable with data from previous years."
  - "Source: Ministry of Internal Affairs of Georgia."

## Checks

`prepare.py` rejects:

- a duplicate, missing or extra observation, a served year outside a table's coverage (the numeric cells of each row must be exactly the served years), and any 2026 or part-year value;
- a `...`, `…` or `-` served as a value, and any other text in a year column except a whole number printed with a space for thousands (such as `49 976` or `7 310`). The placeholders in the workbooks are in unserved cells: `…` for drunk-driving accidents in 2002 (`C4`), and `...` in the prison workbook for the convicted and defendants blocks before 2010 and for their sexes before 2012. No zero is written for them;
- a value that is not a whole non-negative count, a published value that differs from the stored value, and a unit, basis, status or source that differs from the cell map;
- a row that differs from a fresh read of its source cell address, stored value, row label and year heading;
- the 11 recorded crime groups not adding up to all recorded crimes in any year 2015-2025 (tolerance 0);
- convicts by crime type, by age, by sex and by sentence not each adding up to the total in any year 2001-2025 (tolerance 0);
- the three convictions workbooks printing different totals in any year (the age-sex workbook prints its total twice, once above the age block and once above the sex block);
- prison women and men, or adults and juveniles, not adding up to all inmates in any year, or (from 2010) convicted plus defendants not adding up;
- victims by sex, by age and by citizenship not each adding up to the total in any printed year (2007-2011 and 2015-2025);
- a quoted footnote that its workbook does not print.

Where a breakdown misses its total, the difference would be recorded exactly and never filled; none does.

`test_validation.py` also checks the anchor values of the design spec (recorded crimes 2015 35,096, 2018 58,412 and 2025 54,134; property crimes 2025 17,251; convicted 2001 8,897 and 2025 22,767; prison sentences 2025 5,793; prisoners end of 2011 24,114 and end of 2025 11,153; victims 2025 17,209; road accidents 2025 5,969, killed 469 and injured 8,191), that the two text-number cells are read exactly (recorded crimes 2024 `49 976` and road accidents 2023 `5 594`), that there are no victims rows for 2012-2014, that a change of +1 to any total or part is caught in the first and the last served year, and the source cells of the repeated labels.

`verify_independent.mjs` re-reads the seven served workbooks with SheetJS (the web app's own `xlsx` dependency). It finds every cell again from its label tables, written separately from `prepare.py` (it counts every whole-count cell in a row's year columns, so the served year ranges are derived rather than copied), and compares value, cell address, sheet, unit, published value, source ID, basis and status of every row. It repeats the breakdown and total checks, compares the ten Georgian workbooks with their English originals, re-hashes every archived file against the manifest, and runs 12 negative controls that must each be detected.

Run them from this folder (the downloaded workbooks are untrusted data, so `-I` keeps Python from importing anything near them):

```
python3 -I -B prepare.py --check && python3 -I -B test_validation.py -v && node verify_independent.mjs
```

`python3 -I -B prepare.py` rebuilds the generated files and `node verify_independent.mjs` rewrites `independent-validation.json` (`--no-write` only prints it). The verifier needs the `xlsx` package from `apps/web/node_modules`. `python3 -B -m unittest test_validation -v` works too.

## Rules and notes

- **Nothing is derived.** No shares, per-capita rates, sums of series or interpolation. `imputed_values` and `calculated_values` are 0. The per-100,000 rates of the design spec are computed later, in the TypeScript prepare step.
- **Real zeros are values.** Several cells hold `0` (for example corrective labour in 12 of the 25 years 2001-2025 and women among juvenile inmates in 2001); they are published zeros, not placeholders.
- **Text numbers.** Twelve served cells are whole numbers printed as text with a space: ten recorded-crime cells for 2024 (`K3`, `K5`-`K7`, `K9`-`K12`, `K14`, `K15`) and two road cells for 2023 (`X3`, `X5`). `validation-report.json` lists them with the printed text.
- **Sources and gaps.** Convictions come from the Supreme Court; prison figures are end-of-year counts, from the Ministry of Justice (2001-2007), the Ministry of Corrections (2008-2017) and the Ministry of Justice again (from 2018); victims come from the Ministry of Internal Affairs (2007-2011) and the Prosecutor's Office (from 2015), and Geostat prints no 2012-2014 columns. Geostat's May 2005 procedure change applies only to the unserved 2001-2011 recorded-crimes table.
- **Recorded crimes** cover all investigative agencies of Georgia, from the Ministry of Internal Affairs.
