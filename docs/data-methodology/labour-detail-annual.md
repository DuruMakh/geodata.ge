# Annual labour detail data: jobs by industry, hours, informal work and young people

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Unemployment/geostat-labour-force-detail/`, collected on 2026-10-20 from Geostat's Employment and Unemployment page (`https://www.geostat.ge/en/modules/categories/683`, Georgian `https://www.geostat.ge/ka/modules/categories/683`). The research captures are immutable. The 1,014 primary observations are served on four pages of the Unemployment hub, under the approved design `docs/superpowers/specs/2026-10-20-labour-detail-design.md`:

| Page | Geostat table | Unit | Years |
| --- | --- | --- | --- |
| Jobs by industry (`/explorer/unemployment/industries`) | 07, sheets `NACE2` and `NACE2 sex` | thousand persons | 2017–2025; women and men 2020–2025 |
| Hours worked (`/explorer/unemployment/hours`) | 09 and 10, sheet `1` | hours per week | 2020–2025 |
| Informal jobs (`/explorer/unemployment/informal`) | 11 and 12 | percent | 2020–2025 |
| Young people not in work or study (`/explorer/unemployment/young-people`) | 14 | percent | 2020–2025 |

All four are national and annual. Nothing is published through MCP or included in the central machine-readable publications. The existing annual Labour Force Survey series (unemployment, labour force, education, long-term unemployment) are described in `unemployment-annual.md` and are not changed.

## Sources and coverage

Every value comes from Geostat's household Labour Force Survey, so every value is a survey estimate (`value_status=survey_estimate`) and `basis=actual`. The six English workbooks supply the values; their Georgian versions hold the same numbers at the same cells and are archived for the Georgian labels only.

| Source ID | English workbook (media ID) | Georgian version (media ID) | Served |
| --- | --- | --- | --- |
| `geostat_lfs_jobs_industry` | `07-Employment-by-branch-NACE_Eng.xlsx` (78741) | `07-dasaqmeba-Nace.xlsx` (78723) | 420 values: employed persons by 18 industries, "Not identified" and the total, for everyone, women and men |
| `geostat_lfs_hours_sex` | `09-Hours-by-sex.xlsx` (78743) | `09-dasaqmeba-saatebi-sqesi.xlsx` (78725) | 300 values: usual weekly hours, everyone, women, men |
| `geostat_lfs_hours_settlement` | `10-Hours-by-urban-rular-areas.xlsx` (78744) | `10-dasaqmeba-saatebi-qalaqi-sofeli.xlsx` (78726) | 204 values: usual weekly hours, towns and villages |
| `geostat_lfs_informal` | `11-Informal-Employment.xlsx` (78745) | `11-araformaluri-dasaqmeba.xlsx` (78727) | 30 values: five informal-employment shares |
| `geostat_lfs_underuse` | `12-Labour-underutilization.xlsx` (78746) | `12-arasrulad-gamoyenebuli-samushao-dzala.xlsx` (78728) | 24 values: four underutilization rates |
| `geostat_lfs_neet` | `14-NEET_Eng.xlsx` (78748) | `14-NEET.xlsx` (78730) | 36 values: six NEET shares |

Each Georgian version has its English source ID plus `_ka`. The two captures of the category pages are `geostat_lfs_detail_page` and `geostat_lfs_detail_page_ka`. The package holds 14 originals under `official/`. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`. The same 14 files are published, byte for byte, through `data/methodology/source-archives/unemployment.csv` (which now has 23 rows with the nine annual originals), and the source inventory in `apps/web/lib/methodology/sourceInventory.ts` has a second `unemployment` rule rooted at the new `official/` folder. The page captures download as `.html.txt`. Together the 14 files are about 570 KB, so the methodology bundle stays small and `docs/Raw Data` stays outside the methodology function bundle.

Archived and not served:

- sheet `NACE1` of table 07 (the older NACE rev. 1.1 industries, 2017–2020);
- sheet `2` of tables 09 and 10 (hours actually worked in the last 7 days);
- the all-persons block of table 10, which repeats table 09;
- the six Georgian workbooks and the two page captures.

Workbooks 08 and 13, listed on the same Geostat pages, are not used. The new folder sits beside `geostat-labour-force-annual`, which is untouched because its prepare step requires its exact source list.

## Research package

The package holds, besides `official/`: `source-manifest.csv` and `.json`; `prepare.py` (finds every row by its printed English label inside the block that follows its printed title and every column by its year heading, never by a fixed position, and writes `labour-annual.csv` and `coverage.csv`); `verify_independent.mjs`; `test_validation.py`; `validation-report.json`; `independent-validation.json`; and a README with the cell map and Geostat's footnotes quoted as printed. Only the English label is read from a workbook. The NACE section letters in the indicator IDs are this package's reading of Geostat's labels.

## Indicators

Indicator IDs are stable lowercase ASCII `labour.{topic}.{group}.{item}`; Georgian and English labels are display data.

| Indicator IDs | Unit | Years | Values |
| --- | --- | --- | --- |
| `labour.jobs.all.{total, sector_a, sector_b_e, sector_f … sector_u, not_identified}` (20) | thousand persons | 2017–2025 | 180 |
| `labour.jobs.women.*`, `labour.jobs.men.*` (20 each) | thousand persons | 2020–2025 | 240 |
| `labour.hours.{all, women, men, urban, rural}.{total, sector_a … sector_t}` (17 each) | hours | 2020–2025 | 504 |
| `labour.informal.{total, women, men, urban, rural}` | percent | 2020–2025 | 30 |
| `labour.underuse.{unemployment_rate, time_related, potential, composite}` | percent | 2020–2025 | 24 |
| `labour.neet.{age_15_24, age_15_29}.{total, women, men}` | percent | 2020–2025 | 36 |

That is 160 indicators and 1,014 values (420 + 504 + 30 + 24 + 36). Industry items follow the NACE sections: `sector_b_e` is Geostat's single "Industry" row (sections B to E), and `sector_l` (real estate), `sector_u` (extra-territorial organisations) and `not_identified` exist for jobs only, because the hours tables leave them out. All values use `basis=actual` and `value_status=survey_estimate` and keep their source ID, sheet and cell.

## Meaning of the figures

- **Jobs.** Employed persons counted in the household survey, including farmers, the self-employed and informal workers. This is a different measure from the Business hub's Jobs page, which counts people working in firms. Geostat footnotes that the 2017–2019 data were recalculated to the standards of the 19th and 20th International Conferences of Labour Statisticians; the package adds no break flag of its own.
- **Industry.** Geostat publishes NACE B–E as one row, "Industry". Fiscal.ge does not split it.
- **Hours.** Average usual weekly hours in the main job, an average over employed persons ("hours most commonly worked per week during a long period, including usual overtime"). Hours actually worked are archived but not shown.
- **Informal employment.** A share of non-agricultural employment, not of all jobs.
- **Unused labour.** Four Geostat measures with different bases, so their percentages are not interchangeable: the unemployment rate (listed as "Unemployment rate"); the combined rate of time-related underemployment and unemployment ("Unemployed and part-time workers who want more hours"); the combined rate of the unemployed and the potential labour force ("Unemployed and potential labour force"); and the composite measure of labour underutilization ("All unused labour"). Geostat's tables (workbook 12 in either language and the page captures) do not print the bases. Only the unemployment rate over the labour force was confirmed, by recomputing it from the served counts (13.9% in 2025). For the other three, the standard International Labour Organization definitions are applied: the first two are shares of the labour force and the last two are shares of the extended labour force (the labour force plus the potential labour force); this is the ILO definition, not a statement Geostat prints. Informal shares are of non-farm jobs (printed by Geostat), so the informal and unused-labour percentages have different bases.
- **NEET.** Young people aged 15–24 or 15–29 who are not in employment, education or training. The 15–24 total is the page reference, because the UN Sustainable Development Goal indicator 8.6.1 is defined for ages 15–24; that is the UN definition, not a claim Geostat makes.
- **No map.** Geostat publishes none of these tables by region.

The pages state no causes.

## Rounding

`value` is the exact text Geostat's workbook stores for the cell (`<v>` in the sheet XML), such as `1389.6524984883797` or `1.6567258500672373E-2` with its exponent. It is never rounded. `published_value` is `value` rounded to 15 significant digits (the precision Excel keeps), then to one decimal, half up, written with one decimal; so 8.4499999999999993 becomes 8.5. The pages and workbooks show the published value. No share, total, rate or interpolation is calculated: `imputed_values` and `calculated_values` are 0.

## Zero versus not available

- A numeric `0` is a published zero and is served as 0.0 (`value` `0`, `published_value` `0.0`), including where Geostat's number format displays it as a dash: the cell stores the number zero. Examples: `labour.jobs.all.not_identified` in 2018, 2020 and 2023, and the whole women "Not identified" row for 2020–2024.
- A text placeholder (`...`, `…` or `-` stored as text) or an empty cell is not a value and produces no row. The one such series is men in "Activities of households as employers; Undifferentiated goods and services-producing activities of households for own use" (`labour.hours.men.sector_t`): `...` in 2020, 2021, 2022, 2024 and 2025 and a blank cell in 2023. The indicator stays in the list of 160 with no rows.
- A missing value is a gap in the chart, a dash in the table and a blank Excel cell, never zero.

## Validation and reconciliation

In the package, `python3 -I -B prepare.py --check && python3 -I -B test_validation.py -v && node verify_independent.mjs` rebuilds every output in memory and rejects:

- a duplicate, missing or extra observation, a served year outside a table's coverage, and any 2026 or part-year value;
- a text placeholder (`...`, `…` or `-` stored as text) served as a value, and a zero written where Geostat stored no number;
- a value that is not a non-negative number, a published value that differs from the rounding of the stored value, and a unit, basis, status, source or sheet that differs from the cell map;
- a row that differs from a fresh read of its source cell, stored value, row label and year heading;
- a Georgian workbook holding a different number from its English original (1,905 numeric cells compared in six pairs, no difference), and a workbook whose URL is not linked from the captured page of its language.

It also requires, for every year:

1. the 19 industry rows of each jobs group to add up to that group's total (tolerance 0.000001; the largest difference found is 3e-13);
2. the jobs of women plus men to equal the jobs of all persons, for every industry row, 2020–2025 (largest difference 1e-12);
3. the all-persons block of table 10 to equal the one in table 09 (tolerance 1e-9 and equal published values), so that block is served once, from table 09.

`node verify_independent.mjs` re-reads the six English workbooks with SheetJS from separately written label tables, matches all 1,014 values (cell, sheet, stored and published value, unit, source, basis and status), re-hashes the 14 archived files against the manifest and runs 15 negative controls. Anchor values (published): jobs of all persons 2025 1,389.7 thousand; agriculture 2017 289.5 and 2025 218.3; construction 2017 84.3 and 2025 122.6; usual weekly hours of all persons 2025 41.0; informal employment 2025 28.3%; composite unused labour 2020 39.5% and 2025 27.8%; NEET 15–24 2025 17.6% and 15–29 2025 23.4%.

Reconciliation with the pages the site already serves (`npm run data:prepare-labour` fails if any differs): the total jobs of everyone, women and men for 2020–2025 equal `employed` in `unemployment-annual.csv` (1,389.7, 619.5 and 770.2 thousand in 2025), and the unemployment rate in table 12 equals the served national unemployment rate (13.9% in 2025).

`validateLabourFacts` (`apps/web/lib/data/labour/validation.ts`) repeats the rules that do not need the workbooks whenever the CSV or the mirror is loaded: the coverage of `coverage.csv`, the source and unit contract of each indicator, the value format, the published value against the stored one, no value in a gap year, the same sums and the anchor values.

## Serving on the Unemployment pages

`npm run data:prepare-labour` re-reads the package, requires its report and the independent verification to have passed, re-reads every served cell as text from its archived workbook, and writes `data/imports/labour-annual.csv` (UTF-8 with BOM) and `data/reports/labour-validation.json`. `npm run data:check-labour` (part of `data:validate`) rebuilds both in memory and fails on any difference. The canonical CSV has the columns `year, indicator_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell, last_reviewed_at`.

The Prisma mirror table `LabourFact` is created by migration `20261020090000_labour` with row-level security on and public grants revoked, and is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows (`assertLabourParity`). The live migration and import happen only when the branch is merged, through the release pipeline.

The Unemployment pages are served by a static build only. These facts are not added to the `/mcp` snapshot or to the JSON publications; the `source.geostat_lfs_` prefix is kept out of the snapshot, and no page makes a request-time database or file read. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected rows named with their headings and the selected years, explicit units, blank cells for missing values and validated links to the archived Geostat workbooks on fiscal.ge. Internal identifiers and cell references are not exported.

## How to rerun

From `apps/web`:

```
npm run data:prepare-labour          # rebuild data/imports/labour-annual.csv and data/reports/labour-validation.json
npm run data:check-labour            # verify both byte for byte (also runs in data:validate)
npm run data:prepare-methodology-archives   # republish the 23 unemployment originals and refresh the archive report
npx vitest run tests/data/labour tests/methodology/unemployment.test.ts
```

From `docs/Raw Data/Unemployment/geostat-labour-force-detail/`: `python3 -I -B prepare.py --check && python3 -I -B test_validation.py -v && node verify_independent.mjs`. Run the scripts with `python3 -I` because the downloaded workbooks are untrusted data, and keep them outside `official/`.

Original sources: [Employment and unemployment (Geostat)](https://www.geostat.ge/en/modules/categories/683).
