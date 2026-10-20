# Labour Force Survey detail tables (Geostat)

Research package for the Fiscal.ge Unemployment hub's four detail pages: jobs by industry, hours worked, informal work and young people not in work or school (NEET), with labour underutilization alongside. Approved design: `docs/superpowers/specs/2026-10-20-labour-detail-design.md` (sections 4 to 7, 9 and 10). Everything here is reproducible from the files in `official/`, which are never edited. This folder is separate from `../geostat-labour-force-annual/`, which holds the unemployment, labour-force, education and long-term-unemployment series already served.

## Sources

All were retrieved on 2026-10-20 from Geostat, the National Statistics Office of Georgia, and first saved in the project's source folder (`/mnt/project-files/labour-sources/`); `official/` holds byte-identical copies with the file names in lower case. The package does not fetch anything.

- **English category page** (`https://www.geostat.ge/en/modules/categories/683`, "Employment and Unemployment"): six workbooks, capture `official/labour-page.html` (`geostat_lfs_detail_page`).
- **Georgian category page** (`https://www.geostat.ge/ka/modules/categories/683`, `dasakmeba-umushevroba`): the six Georgian versions, capture `official/labour-page-ka.html` (`geostat_lfs_detail_page_ka`).

Each page links its files as `https://geostat.ge/media/<id>/<name>` (`retrieved_file_url` in the manifest); Geostat redirects that to `https://www.geostat.ge/media/<id>/<name>` (`resolved_file_url`). `prepare.py` fails if a workbook's retrieved URL is not linked from the capture of its language, which ties every file to a page that really lists it. The two pages also list workbooks 08 (employment by occupation) and 13 (labour force by education), which this package does not use.

`source-manifest.csv` and `source-manifest.json` give, for each of the 14 archived files, its source ID, title, page, retrieved and resolved URL, retrieval date, local file, SHA-256 and size.

| Source ID | English file (media ID) | Georgian version (media ID) | Served |
| --- | --- | --- | --- |
| `geostat_lfs_jobs_industry` | `07-Employment-by-branch-NACE_Eng.xlsx` (78741) | `07-dasaqmeba-Nace.xlsx` (78723) | jobs by industry, 3 groups, 60 series |
| `geostat_lfs_hours_sex` | `09-Hours-by-sex.xlsx` (78743) | `09-dasaqmeba-saatebi-sqesi.xlsx` (78725) | usual weekly hours, all persons, women, men |
| `geostat_lfs_hours_settlement` | `10-Hours-by-urban-rular-areas.xlsx` (78744) | `10-dasaqmeba-saatebi-qalaqi-sofeli.xlsx` (78726) | usual weekly hours, urban, rural |
| `geostat_lfs_informal` | `11-Informal-Employment.xlsx` (78745) | `11-araformaluri-dasaqmeba.xlsx` (78727) | 5 informal-employment shares |
| `geostat_lfs_underuse` | `12-Labour-underutilization.xlsx` (78746) | `12-arasrulad-gamoyenebuli-samushao-dzala.xlsx` (78728) | 4 underutilization rates |
| `geostat_lfs_neet` | `14-NEET_Eng.xlsx` (78748) | `14-NEET.xlsx` (78730) | 6 NEET shares |

Each Georgian file has the source ID of its English original plus `_ka` (for example `geostat_lfs_jobs_industry_ka`) and is archived only. The Georgian versions hold the same numbers at the same cell addresses as the English ones: `prepare.py` and `verify_independent.mjs` each compare 1,905 numeric cells in the six pairs and find no difference. The Georgian jobs workbook names its third sheet `NACE2 სქესი` instead of `NACE2 sex`, so sheets are paired by position. Georgian labels are display data for the later tasks; no value is read from the Georgian files.

The downloaded workbooks are untrusted data: run the scripts with `python3 -I` from this folder, and keep the scripts outside `official/`.

## Outputs

- `labour-annual.csv`: the 1,014 served observations, UTF-8 with a byte-order mark. Columns: `year, indicator_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell`.
  - `value` is the exact text Geostat's workbook stores for the cell (`<v>` in the sheet XML), for example `1389.6524984883797`, or `1.6567258500672373E-2` with its exponent, or `0`. It is never rounded.
  - `published_value` is `value` rounded to 15 significant digits (the precision Excel keeps) and then to one decimal, half up, written with one decimal (`1389.7`, `0.0`). It is what the later pages show.
  - `unit` is `thousand_persons` (jobs), `hours` (weekly hours) or `percent` (informal, underutilization and NEET); `basis` is `actual`; `value_status` is `survey_estimate`.
  - `source_sheet` is the sheet name (`NACE2`, `NACE2 sex`, or `1`) and `source_cell` the A1 address.
  - Rows are in indicator order (160 indicators, below), then year.
- `coverage.csv`: for each of the 160 indicators the first and last year, the count and the years between them that carry no served value. `labour.hours.men.sector_t` has no observations, so its years are blank and its `unavailable_years` is the six printed years, `2020-2025`.
- `source-manifest.csv`, `source-manifest.json`, `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).

Served rows by source: jobs 420 (all persons 180, women 120, men 120), hours by sex 300 (all 102, women 102, men 96), hours by settlement 204, informal 30, underutilization 24, NEET 36, in all 1,014.

## Indicators and cell map

`prepare.py` finds every row by its printed English label inside the block that follows its printed title, and every column by its year heading (the nearest heading row above the row, inside the block), never by fixed position. Labels are matched exactly after collapsing whitespace, so a stray space or line break does not matter but a different spelling does. The block titles are `Women` and `Men` (jobs sex sheet, hours table 09), `Urban` and `Rural` (hours table 10) and the two NEET titles; the first block of the jobs sheet `NACE2` and of each hours table has no title.

The industry rows are Geostat's NACE Rev. 2 aggregates, in print order. The ID suffix names the NACE sections (`sector_b_e` is "Industry", sections B to E). Only the English label is read from the workbook; the section letters are this package's reading of the labels.

| Item (ID suffix) | Printed row label |
| --- | --- |
| `total` | Total |
| `sector_a` | Agriculture, forestry and fishing |
| `sector_b_e` | Industry |
| `sector_f` | Construction |
| `sector_g` | Wholesale and retail trade; repair of motor vehicles and motorcycles |
| `sector_h` | Transportation and storage |
| `sector_i` | Accommodation and food service activities |
| `sector_j` | Information and communication |
| `sector_k` | Financial and insurance activities |
| `sector_l` | Real estate activities (jobs only) |
| `sector_m` | Professional, scientific and technical activities |
| `sector_n` | Administrative and support service activities |
| `sector_o` | Public administration and defence; compulsory social security |
| `sector_p` | Education |
| `sector_q` | Human health and social work activities |
| `sector_r` | Arts, entertainment and recreation |
| `sector_s` | Other service activities |
| `sector_t` | Activities of households as employers; Undifferentiated goods and services-producing activities of households for own use |
| `sector_u` | Activities of extra-territorial organisations and bodies (jobs only) |
| `not_identified` | Not identified (jobs only) |

| Indicator IDs | Workbook, sheet, block | Unit | Years | Rows |
| --- | --- | --- | --- | --- |
| `labour.jobs.all.{20 items}` | jobs, sheet `NACE2` (one block) | thousand persons | 2017-2025 | 180 |
| `labour.jobs.women.{20 items}`, `labour.jobs.men.{20 items}` | jobs, sheet `NACE2 sex`, blocks `Women` and `Men` | thousand persons | 2020-2025 | 240 |
| `labour.hours.all.{17 items}` | hours by sex, sheet `1`, first block (no title) | hours | 2020-2025 | 102 |
| `labour.hours.women.{17 items}`, `labour.hours.men.{17 items}` | hours by sex, sheet `1`, blocks `Women` and `Men` | hours | 2020-2025 | 102 and 96 |
| `labour.hours.urban.{17 items}`, `labour.hours.rural.{17 items}` | hours by settlement, sheet `1`, blocks `Urban` and `Rural` | hours | 2020-2025 | 204 |
| `labour.informal.{total, women, men, urban, rural}` | informal, sheet `1`: `Total`, `Women`, `Men`, `Urban`, `Rural` | percent | 2020-2025 | 30 |
| `labour.underuse.{unemployment_rate, time_related, potential, composite}` | underutilization, sheet `1`: `Unemployment rate`, `Combined rate of time-related underemployment* and unemployment`, `Combined rate of unemployed and potential labour force`, `Composite measure of labour underutilization` | percent | 2020-2025 | 24 |
| `labour.neet.age_15_24.{total, women, men}`, `labour.neet.age_15_29.{total, women, men}` | NEET, sheet `1`: `Total`, `Women`, `Men` under each of the two blocks titled `Percentage of youth age 15-24 years ...` and `... 15-29 years ...` | percent | 2020-2025 | 36 |

The hours tables have 17 rows (the total and 16 industries: no real estate, no extra-territorial bodies, no "not identified"), and the jobs tables 20. The hours all-persons block (`labour.hours.all.*`) comes from table 09 only. Table 10 prints its own all-persons block first; it is read and checked equal to table 09's and is not emitted. The two tables store the same hours with floating-point noise of about 2e-13 in the last digits (for example `42.090584267855462` against `42.090584267855448`), so the check allows 1e-9 and also requires equal published values.

**No observation:** men in "Activities of households as employers..." (`labour.hours.men.sector_t`, row 60 of table 09): `...` in 2020, 2021, 2022, 2024 and 2025 and a blank cell in 2023. The ID stays in the list of 160, with no rows. Nothing is imputed.

**Real zeros are values.** Several jobs cells hold a published `0` (`labour.jobs.all.not_identified` in 2018, 2020 and 2023, cell `C23`, `E23` and `H23`; the whole women `not_identified` row for 2020-2024). They are served, with `value` `0` and `published_value` `0.0`. A cell that is `...`, `…`, `-` or blank is never a value.

## Not served (archived only)

- Sheet `NACE1` of the jobs workbook (NACE Rev. 1.1 industries, 2017-2020, with `-` for "Not identified" in 2018 and 2020), and its Georgian counterpart.
- Sheet `2` of each hours workbook, 09 and 10: average **actual** weekly hours ("Hours actually worked ..."), same layout as sheet `1`. This package serves usual hours only.
- Workbooks 08 and 13 on the same category pages.
- The quarterly and other part-year tables of the survey are not in these six workbooks; every served year is 2017-2025.

## Footnotes Geostat prints under the served tables

Quoted as printed (spaces collapsed).

- **Jobs** (sheets `NACE2` cell `A25` and `NACE2 sex` cell `A48`): "*The data for 2017-2019 are recalculated according to the standards adopted by International Labour Organization (ILO) at the 19th and 20th International Conference of Labour Statisticians." Source line: "Source: Labour Force Survey."
- **Hours** (tables 09 and 10, sheet `1`, cells `A62` and `A63`): "*Hours usually worked means the hours which are most commonly worked per week by persons during a long period and it includes all usual overtime." Source line: "Source: Labour Force Survey." Titles: "Average number of usual weekly hours of work by kind of activity (Nace rev. 2) and sex in the main job*" and "... and urban-rural areas in the main job*".
- **Informal employment** (cell `A1`, `A9`): "Share of informal employment in non-agricultural employment (%)"; "Source: Labour Force Survey." The share is of non-agricultural employment, not of all employment.
- **Labour underutilization** (cell `A8`): "*Time-related underemployment includes employed persons who meet the following 3 criteria: 1. reported that worked part-time; 2. looked for additional or other paid work or tried to start own business during the last 4 weeks; 3. were available to work more hours within the next 2 weeks."
- **NEET** (cells `A1`, `A7`, `A13`): "Percentage of youth age 15-24 years not in employment, education or training (NEETs) (%)", the same for 15-29, and "Source: Labour Force Survey."

## Checks

`prepare.py` rejects:

- a duplicate, missing or extra observation, a served year outside a table's coverage (the numeric cells of each row must be exactly the served years), and any 2026 or part-year value;
- a `...`, `…` or `-` served as a value, any other text in a year column, any cell outside the year columns, and any heading that is not a whole-number year;
- a value that is not a non-negative number, a published value that differs from the rounding of the stored value, and a unit, basis, status, source or sheet that differs from the cell map;
- a row that differs from a fresh read of its source cell address, stored value, row label and year heading;
- the 19 industry rows of a jobs group not adding up to its total in any year (tolerance 0.000001; the largest difference found is 3e-13), or women plus men not adding up to all persons in 2020-2025 (largest difference 1e-12);
- hours table 10's all-persons block differing from table 09's, beyond the floating-point noise above or in a published value;
- a Georgian workbook holding a different number from its English original, and a workbook whose URL is not linked from the captured page of its language.

`test_validation.py` also checks the anchor values of the design spec (published values: jobs of all persons 2025 `1389.7`; agriculture 2017 `289.5` and 2025 `218.3`; construction 2017 `84.3` and 2025 `122.6`; usual weekly hours of all persons 2025 `41.0`; informal employment 2025 `28.3`; composite underutilization 2020 `39.5` and 2025 `27.8`; NEET 15-24 2025 `17.6` and 15-29 `23.4`), the 160 indicator IDs and their order, the source cells of the repeated labels in each block, that exponent values keep their stored text, and that an altered value, published value, cell, unit, status, year or an extra 2026 row is rejected.

`verify_independent.mjs` re-reads the six English workbooks with SheetJS (the web app's own `xlsx` dependency). It finds every cell again from label tables written separately from `prepare.py` (it counts every numeric cell in a row's year columns, so the served year ranges are derived rather than copied), recomputes each published value from the cell's number (SheetJS keeps a number as a double, not as its stored text, so stored values are compared as numbers there; `prepare.py` compares the text), and compares value, cell address, sheet, unit, published value, source ID, basis and status of every row. It repeats the jobs sum, women-plus-men and hours-block checks, compares the six Georgian workbooks with their English originals, re-hashes every archived file against the manifest, and runs 15 negative controls that must each be detected.

Run them from this folder:

```
python3 -I -B prepare.py --check && python3 -I -B test_validation.py -v && node verify_independent.mjs
```

`python3 -I -B prepare.py` rebuilds the generated files and `node verify_independent.mjs` rewrites `independent-validation.json` (`--no-write` only prints it). The verifier needs the `xlsx` package from `apps/web/node_modules`. `python3 -B -m unittest test_validation -v` also works; `python3 -I -m unittest test_validation` does not, because `-I` removes the current folder from the import path, so the tests are run as a script, which adds it itself.

## Rules and notes

- **Nothing is derived.** No shares, totals recomputed from parts, per-capita values or interpolation. `imputed_values` and `calculated_values` are 0. Published values are rounding of the stored value only.
- **A survey estimate, not a count.** Every value comes from Geostat's Labour Force Survey and carries `value_status` `survey_estimate`; jobs are thousands of employed persons, so the later pages must not call them registered jobs or payroll positions.
- **Series note.** Geostat's footnote says the 2017-2019 jobs data were recalculated to the standards adopted at the 19th and 20th International Conferences of Labour Statisticians (quoted above). The package adds no break flag of its own and draws no conclusion from the note; it is quoted so that the methodology page can cite it.
- **Hours** are usual weekly hours in the main job, an average over employed persons, not hours actually worked.
- **Informal employment** is a share of non-agricultural employment.
- **Years** are calendar years; no quarterly value is in these workbooks.
