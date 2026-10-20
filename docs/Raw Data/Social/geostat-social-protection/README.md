# Geostat social protection research package

Collected on **17 October 2026** from Geostat's Social protection page (<https://www.geostat.ge/en/modules/categories/55/social-protection>, Georgian: <https://www.geostat.ge/ka/modules/categories/55/sotsialuri-datsva>). Nothing here is served by the explorer. It complements the Social Service Agency package in `../ssa-statistics/`: Geostat republishes SSA's December recipient counts as yearly series and adds a few tables SSA does not publish (funded pensions, nursing homes, child care homes, disability health services, and pre-2012 household allowance).

## What is ready

`geostat-social-protection.csv` holds every published value of the 15 tables, **8,481 cells**, with the English and Georgian labels side by side:

| Table (`source_id`) | What it counts | Years | Breakdown |
| --- | --- | --- | --- |
| `pension-social-package` | People receiving the state pension and the social package, by eligibility group | 2007–2025 | National |
| `pension-social-package-regions-sex` | The same two groups by region and sex | 2012–2025 | 11 regions, women/men |
| `pension-municipalities` | State pension recipients | 2012–2025 | Municipality |
| `social-package-municipalities` | Social package recipients | 2012–2025 | Municipality |
| `subsistence-families-municipalities` | Families registered in the targeted-assistance database; families receiving the subsistence allowance; families kept on through the employment programme | 2012–2025 (the last from 2022) | Municipality |
| `subsistence-beneficiaries` | Yearly average number of subsistence-allowance recipients and their share of the population | 2007–2025 | National |
| `accumulative-pension` | The funded (accumulative) pension scheme: participants, fund value, returns | 2020–2025 | National |
| `nursing-homes` | Homes for elderly and disabled people: homes, beds, residents | 2004–2025 | National |
| `child-care-institutions` | Children's homes and the children living in them | 2009–2023 | National |
| `uhc-disabled-patients`, `oncology-drugs-disabled`, `outpatient-disabled` | People with disabilities using universal health care, cancer drugs and planned outpatient care | 2021–2025 | Disability status, sex, age or region |
| `pensioners-registered-1995-2006` | Pensioners registered with social security authorities, by category | 1995–2006 | National |
| `household-allowance-recipients`, `household-allowance-amount` | The household (family) allowance that preceded the subsistence allowance | 2002–2011, 2002–2009 | Household category |

`coverage.csv` gives the years, rows and published or unavailable values of each table.

## Files

| File | Purpose |
| --- | --- |
| `geostat-social-protection.csv` | One row per published cell: table, sheet, row label (English and Georgian), column heading (English and Georgian), year, value, and the Georgian file's value with `versions_agree`. `status` is `unavailable` where Geostat prints `…`. |
| `coverage.csv` | Years, rows and value counts per table. |
| `ssa-cross-check.csv` | 46 comparisons with SSA's December national recipient figures, refreshed on 18 October 2026; all match. Covers pension, social package, and subsistence-allowance families including the employment-programme group. It does not compare every Geostat cell against SSA. |
| `source-findings.csv` | Cells where the English and Georgian files disagree, or exist in only one of them. |
| `validation-report.json` | Counts, failures and the pass flag. |
| `source-manifest.csv` / `.json` | URL, retrieval date, local file, size and SHA-256 of all 30 workbooks and the two page captures. |
| `official/` | The original files, unedited, renamed `<table>.<en|ka>.<ext>`; the manifest keeps each published file name. |
| `prepare.mjs` | Rebuilds every generated file from `official/`. `node prepare.mjs --check` fails if a committed file is out of date. |

## How it was read

Most files are the old binary `.xls` format, which Python's standard library cannot read, so this package uses Node and SheetJS, the Excel library the web app already depends on (the energy and food package reads its one `.xls` file the same way). Year columns are found from their printed year headings (footnote marks such as `2025*` or `20071)` are kept in `year_mark`), merged Women/Men/Total headings are spread across the columns they cover, and rows are found by their printed label.

Every English file was read alongside its Georgian twin. Rows are paired by their figures, because the two versions sometimes list municipalities in a different order. Both values are kept, and `versions_agree` marks the 30 cells where they differ.

## Things to know

1. **Geostat's English and Georgian files disagree in three tables.** In `subsistence-families-municipalities` the English file has a row "Akhaltsikhe City" repeating Akhaltsikhe's figures and no row for Akhalkalaki Municipality; the Georgian file is correct (it has Akhalkalaki). A few cells of `oncology-drugs-disabled` (2021–2022) and one 2025 cell of `pension-social-package` also differ. Use `value_ka` where `versions_agree` is `no` and the Georgian row label is the one you need.
2. **Annual recipient counts and annual averages must stay distinct.** The pension, social package and municipal subsistence-allowance counts are intended to be checked against SSA's December figures. That check was run on 18 October 2026: `ssa-cross-check.csv` holds 46 comparisons, all matching, and `validation-report.json` records them (`ssa_cross_checks: 46`). `subsistence-beneficiaries` is explicitly labelled "annual average" by Geostat and must not be compared as a December count.
3. **Municipal tables use today's municipalities plus Tbilisi's districts and some former cities.** Labels are printed in English and Georgian; they are not yet mapped to the codes in `data/imports/municipalities.csv`.
4. **Old series do not join new ones.** The household allowance (2002–2011) was replaced by the subsistence allowance, and the 1995–2006 pensioner categories differ from SSA's post-2012 ones.
