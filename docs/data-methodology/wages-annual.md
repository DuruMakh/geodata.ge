# Annual earnings data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Wages/geostat-earnings-annual/`, collected on 2026-10-09, the publication day of Geostat's 2025 annual earnings. The research captures are immutable. Nothing is promoted to `data/imports/`, served by the explorer, published through MCP or included in central machine-readable publications; those steps need a separately approved design.

The user approved annual data only, with these breakdowns: Georgia, economic activity, sex, public/non-public ownership, business/non-business sector, region and median earnings. Quarterly earnings, real (inflation-adjusted) wages, and the occupation, labour-cost and adjusted gender-pay-gap tables are excluded. Real wages are deferred by the user's decision. They would be a derived calculation against the CPI dataset and need their own review.

Geostat is the sole publisher. Seven annual workbooks, the English Wages page, the two 2025 news releases and two current metadata documents are preserved under `official/`. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.json`.

## Indicators and definitions

| Indicator ID | Meaning | Source | Unit |
| --- | --- | --- | --- |
| `average_monthly_nominal_earnings` | Gross earnings accrued to paid employees in the year, divided by the average number of paid employees (part-time as full-time equivalents) and by 12 | Geostat enterprise surveys | GEL, one decimal |
| `median_monthly_earnings` | The middle value of individual employees' gross earnings | Geostat, from Revenue Service administrative records | GEL, whole lari |

Gross earnings are measured before personal income tax. They include direct wages and salaries, allowances, bonuses and incentives, pay for time not worked, and payments in kind. The surveys cover NACE Rev.2 sections A–S, excluding households as employers (T) and extra-territorial organisations (U), across Georgia except the occupied territories. Self-employed people are not employees and are not covered.

The two indicators differ in source and statistical unit. The average counts full-time equivalents from aggregated enterprise returns. The median metadata names the employee as the statistical unit and covers employees with earnings accrued during the year; it does not state how part-time work or multiple jobs are treated, so no full-time basis may be assumed. Geostat compares them directly in its median release; public text must state that the median comes from tax records. Both are nominal and must not be described as purchasing power.

All rows use `frequency=annual` and `basis=actual`. Averages use `value_status=survey_estimate`; the median uses `value_status=administrative`. The package creates no estimates, interpolation, imputation or gap filling.

## Breakdowns, IDs and time boundaries

| Dimension | Group IDs | Primary coverage |
| --- | --- | --- |
| `national` | `georgia` | Total 1995–2025; activities 2014–2025; median 2018–2025 |
| `sex` | `women`, `men` | Total 1999–2025; activities 2014–2025 |
| `ownership` | `public`, `non_public` | Total 2000–2025; activities 2014–2025 |
| `business_sector` | `business`, `non_business` | Total 2006–2025; activities 2014–2025 |
| `region` | the existing `region.*` IDs used by economy and unemployment | Total only, 2010–2025 |

Activity IDs reuse the economic-sectors IDs `sector.a` to `sector.s` for NACE Rev.2 sections; `total` denotes all activities. Not every section is published in every group. Business-sector tables omit K and O; non-business tables publish A, K, M, O, P, Q, R and S; public-sector tables omit K; non-public tables omit O. Public-sector mining (B) is marked unavailable in every year. Unavailable cells (`…` or `...` in the source) are listed in `unavailable-cells.csv` and never filled.

The non-business group is labelled "Non-business and financial sector". Since 2006 Geostat surveys state institutions, local government, public-law entities, non-commercial entities and all financial establishments separately from the business-sector enterprise survey. Public administration (O) therefore belongs wholly to the public and non-business groups, and financial activities (K) wholly to the non-business group. Validation relies on these identities.

| Source boundary | Handling |
| --- | --- |
| Headline years 1970–1994 | Retained as `role=legacy`. Before 1993 the unit is roubles, in 1993 coupons and in 1994 thousand coupons. The primary series starts in 1995 with the lari, by the user's 2026-10-09 decision to include every official lari value. The only preserved survey metadata (non-business sector, which covered all establishments until 2006) documents coverage from 1998, so 1995–1997 rest on the headline workbook alone. |
| NACE Rev.1.1 activity tables, 1998–2019 | Retained as `role=legacy` with `nace1.a`–`nace1.o` IDs and `classification=nace_rev1_1`. They are never joined to NACE Rev.2 sections. |
| Totals repeated in breakdown workbooks | Retained as `role=control` and compared with the headline workbook; excluded from the primary file. |
| 2006 | Survey split into business and non-business/financial surveys. The source flags a 2006 coverage drop in financial-intermediation earnings. |
| Regional values | Geostat notes that some enterprises are represented by their head-office location; regional values can describe registration location rather than exactly where work happens. |

NACE Rev.1.1 footnotes on single-enterprise effects (2007 mining merger, 2009 temporary fishing closure, 2009 trade-enterprise profile change, 2009 closure of a large mining enterprise, 2010 ownership change in hotels and restaurants) are retained verbatim in `validation-report.json`.

## Extraction and provenance

`prepare.py` reads worksheet XML with Python's standard library, reusing the unemployment package's reader. It preserves stored decimal tokens without binary floating-point conversion. Each observation records its source ID, sheet, cell, original group and row labels, and number format. `value` keeps the stored precision; `published_value` rounds half-up to the cell's display precision. Some workbooks store totals already rounded and others unrounded; this extra precision is reconciliation evidence, not statistical accuracy.

Mappings are explicit: exact NACE Rev.2 and Rev.1.1 labels, group headings and region names. Footnote stars on row labels and year headings are stripped for mapping and preserved in the source label or report. An unknown label, blank cell, non-numeric value other than the unavailable marker, unexpected number format or stray numeric cell stops the build. All CSVs use UTF-8 with BOM.

## Validation and evidence

`python prepare.py --check` rebuilds every output in memory, compares the bytes with the saved files, and validates:

1. Exactly one manifest entry for each of the twelve required captures, each capture's SHA-256 fingerprint and byte size, and each workbook's worksheet list against the inventory.
2. The NACE Rev.2 mapping equals the 19 section letters and titles printed in the 2025 release (`nace-sections-transcription.csv`), and each of the 4,092 extracted cells carries the section and group IDs that its printed row label and group heading map to.
3. An independent inventory of each sheet's years, groups and sections. Every expected cell must be either a numeric observation or an unavailable marker, exactly once.
4. One primary value per indicator, breakdown, group, activity and year.
5. 232 repeated totals equal the headline workbook at published precision.
6. 84 single-sector identities: national section O equals the public and non-business values, and national K equals the non-business value, in both classifications. Each identity must yield at least one comparison.
7. 313 range checks: each total lies between the lowest and highest values of its published parts. This is a property of any positively weighted average or median whose parts make up the whole; suppressed public-sector mining is the only published-group cell not represented.
8. The four annual headline values (2022–2025) on the preserved Wages page; its quarterly columns are excluded.
9. 53 figures in `release-transcriptions.csv` (printed page numbers; each PDF has an unnumbered cover page) from the two 2025 releases and the earnings metadata: levels, lari and percentage changes from unrounded values, the public/non-public gap, the median's distance below the average, rankings (requiring at least two peers), the median below the average in every 2025 section, and the 2023 non-business average.

Extraction itself stops on a blank cell, unknown label or heading, non-numeric value other than the unavailable marker, non-positive value, unexpected number format, uninventoried worksheet, or any number outside a mapped data cell. Cross-workbook comparisons use zero tolerance at published precision. The result is 686 passing numeric comparisons, zero duplicates, zero imputed values and 151 inventoried unavailable cells.

Sixteen regression tests (`python -B -m unittest discover -s . -p "test_*.py"`) prove rejection of: omitted cells, sections, years or workbooks; a lost or duplicated unavailable marker; a changed repeated total; a broken single-sector identity; swaps involving a section absent from a table and swaps within one table (sections, regions, sexes); an activity mapping that disagrees with the published section letters; a duplicate primary or orphaned control; a changed source-page value; a total outside its parts; wrong release figures; an altered or missing capture; an unmapped label; and an unexpected number format, stray number or uninventoried worksheet.

`node verify_independent.mjs` re-reads every workbook with SheetJS and its own separately written section, region and group tables. It matches all 3,941 stored values, SheetJS's rendering of each cell's number format against `published_value`, all 151 unavailable markers in both directions, and, for all 4,092 cells, the year heading, printed labels and derived IDs. Nine negative controls confirm it detects an altered value, an omitted row, an omitted year-like value, a moved cell, a shifted year, swapped sections, regions or sexes, and an unlisted unavailable marker. Its recorded run is `independent-validation.json`.

## Statistical limitations and future use

The non-business survey metadata reports a 2023 average of 1,649.6 GEL with a standard error of 2.6 GEL; the business-sector survey has its own sampling error, which is not published in the preserved documents. Small changes and close rankings should not be presented as significant.

Later integration must preserve annual frequency, nominal units, the 2014 classification boundary, the 1995 lari start of the primary series and its pre-1998 documentation caveat, the separate median source, the head-office caveat for regions and every unavailable cell. Combining NACE Rev.1.1 and Rev.2 sections, converting pre-1995 currencies, or deflating to real wages would each be a separately reviewed derived calculation; none is created here.

Original sources: [Geostat Wages](https://www.geostat.ge/en/modules/categories/39/wages), the seven workbooks linked in the package README, the [earnings survey metadata of 16 June 2026](https://geostat.ge/media/80166/0709_160626_EN.PDF) and the [median earnings metadata of 9 October 2026](https://geostat.ge/media/83311/0721_091026_EN.PDF).
