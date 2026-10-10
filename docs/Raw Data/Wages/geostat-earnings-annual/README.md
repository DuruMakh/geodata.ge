# Geostat annual earnings research package

Collected on **9 October 2026**, the day Geostat published the 2025 annual figures. The user approved annual figures only, with the national, economic-activity, sex, public/non-public, business/non-business, regional and median breakdowns. Quarterly figures, real (inflation-adjusted) wages, occupation, labour-cost and gender-pay-gap tables are outside this collection. Nothing here is served by the explorer yet.

This package preserves seven official Geostat workbooks, the Wages source page, the two 2025 news releases and two current metadata documents. It is the data foundation for a later wages explorer.

## What is ready

The primary dataset has **1,917 annual values** in lari:

| Breakdown | Totals | By economic activity (NACE Rev.2) |
| --- | --- | --- |
| Georgia | 1995–2025 | 19 sections, 2014–2025 |
| Women and men | 1999–2025 | 19 sections each, 2014–2025 |
| Public and non-public sector | 2000–2025 | 18 sections each, 2014–2025; public mining is never published |
| Business and non-business sector | 2006–2025 | 17 business and 8 non-business sections, 2014–2025 |
| 11 regions | 2010–2025 | Not published by region |
| Median earnings, Georgia | 2018–2025 | 19 sections, 2018–2025 |

**2025 national figures:**
- Average monthly earnings were **2,165.2 GEL**, up 9.9% (194.5 GEL) on 2024.
- Women earned 1,743.4 GEL and men 2,586.5 GEL.
- The public sector averaged 1,895.4 GEL and the non-public sector 2,301.0 GEL.
- The median was **1,531 GEL**, 29.3% below the average.

## What the numbers mean

- **Average monthly nominal earnings** are gross earnings, before income tax, of paid employees. They include wages, bonuses, allowances, paid leave and payments in kind. Geostat divides the year's total earnings by the average number of paid employees, counting part-time staff as full-time equivalents, and then by 12. Self-employed people are not included. The figures come from Geostat's enterprise surveys.
- **Median earnings** are the middle value of employees' gross earnings, calculated by Geostat from **Revenue Service records**, not from the survey. The metadata names the employee as the statistical unit and covers employees with earnings accrued during the year. It does not say how part-time work or several jobs are treated, so do not assume the same full-time basis as the average. Values are published in whole lari. Geostat compares the median with the average in its release, but small differences between the two should not be over-interpreted.
- **Nominal** means not adjusted for inflation. Real wages are deferred by the user's decision.

## Files to review

| File | Purpose |
| --- | --- |
| `earnings-summary.csv` | Easy-to-read primary values at Geostat's published precision, one per year, breakdown and activity. |
| `earnings-annual.csv` | The 1,917 primary values with stored precision, units, roles and exact Excel cells. |
| `coverage.csv` | Available years for every breakdown and activity, including the one series Geostat lists but never fills (public-sector mining, `year_count` 0). A missing year is unavailable, not zero. |
| `source-observations.csv` | All 3,941 numeric cells: 1,917 primary, 232 repeated totals used as controls, and 1,792 legacy values (see below). |
| `unavailable-cells.csv` | All 151 cells Geostat marks `…` or `...`. None is filled or estimated. |
| `release-transcriptions.csv` | 53 figures typed from the two 2025 news releases and the earnings metadata, with printed page numbers (each PDF has an unnumbered cover page first), recomputed from the workbooks. |
| `nace-sections-transcription.csv` | The 19 NACE Rev.2 section letters and titles printed in the 2025 earnings release (page 8), used to check the activity mapping. |
| `reconciliation.csv` | All 686 numeric comparisons and their results. |
| `validation-report.json` | Counts, source fingerprints, source footnotes, coverage, failures and limitations. |
| `independent-validation.json` | Separate cell-by-cell comparison using a different Excel reader. |
| `source-manifest.csv` / `source-manifest.json` | Source URLs, retrieval date, local files, byte sizes and SHA-256 fingerprints. |
| `official/` | The original Geostat files, unedited. |
| `prepare.py` | Rebuilds every generated file from `official/`; standard-library Python, no network. It loads the worksheet reader, CSV writer and HTML table parser from `../../Unemployment/geostat-labour-force-annual/prepare.py`, so changes there affect this package; `--check` would reveal any changed output. |
| `test_validation.py` | Sixteen regression tests (listed below). |
| `verify_independent.mjs` | Re-reads all workbooks with SheetJS, the web app's own Excel library. |

Every CSV uses UTF-8 with BOM so it opens correctly in Excel.

## Comparisons that require care

1. **Industry classification changed in 2014.** Activity tables use NACE Rev.2 from 2014. Geostat's older NACE Rev.1.1 tables, 1998–2019, are kept as `legacy` rows with their own `nace1.*` IDs. Their sections are defined differently, so the two must not be joined into one series. Totals are unaffected: the overall, sex, ownership and business-sector totals are identical in both classifications.
2. **The national series starts in 1995, with the lari.** The user decided on 2026-10-09 to include every official lari value. Geostat's headline workbook publishes 13.5, 29.0 and 42.5 GEL for 1995–1997. It also lists 1970–1994 in roubles (before 1993), coupons (1993) and thousand coupons (1994). These 13 earlier values are kept as `legacy` rows and must not be joined to the lari series. Caveat: the preserved survey metadata covers the non-business survey, which covered all establishments until 2006, and documents coverage "From 1998 onwards". So 1995–1997 rest on the headline workbook alone, and the activity breakdowns begin only in 1998.
3. **The survey design changed in 2006.** Since then, the business sector and the non-business plus financial sector have been surveyed separately. That is why the business/non-business split starts in 2006. Geostat flags a 2006 drop in financial-intermediation earnings caused by a coverage change.
4. **Regional values follow head offices.** Geostat notes that some enterprises are represented by their head office location. Regional figures can therefore describe where employers are registered rather than exactly where people work, which is likely to affect Tbilisi most.
5. **Some sections belong entirely to one sector.** Public administration (section O) is wholly public and non-business. Financial and insurance activities (section K) are wholly in the non-business and financial survey. That is why some sections appear in only one group.
6. **One-off events move individual sections.** NACE Rev.1.1 footnotes describe five events:
   - a 2007 mining merger
   - a 2009 temporary fishing closure
   - a 2009 change in an enterprise's main profile (trade)
   - the 2009 closure of a large, high-paying mining enterprise
   - a 2010 ownership change in hotels and restaurants

   They are preserved verbatim in `validation-report.json` under `source_footnotes`.
7. **Survey uncertainty is small but present.** The metadata reports a 2023 non-business-sector average of 1,649.6 GEL, with a 95% interval of 1,644.7–1,654.8 GEL.

## Validation results

`prepare.py` stops the build on any of these:
- a source fingerprint or size mismatch
- a missing or duplicated capture
- a worksheet not listed in its inventory
- an unrecognised label or group heading
- a blank cell
- a non-numeric value other than the unavailable marker
- a non-positive value
- an unexpected number format
- any number outside a mapped data cell

It then validates:

- **Activity mapping:** the mapping equals Geostat's own NACE Rev.2 section list.
- **Labels match IDs:** every one of the 4,092 extracted cells has a section and group ID that match the row label and group heading printed beside it.
- **Inventory:** every published cell is accounted for against an independent inventory of each sheet's groups, sections and years (3,941 numeric cells plus 151 unavailable cells). There is exactly one primary value per statistical key, and zero imputed values.
- **232 repeated totals** in the breakdown workbooks equal the headline workbook at published precision.
- **84 single-sector checks:** section O is identical nationally, in the public sector and in the non-business sector, and section K is identical nationally and in the non-business sector, in both classifications. Each identity must produce at least one comparison.
- **313 range checks:** every total lies between the lowest and highest of its published parts (sexes, ownership types, business sectors, regions or activities). This is an expectation for averages and medians whose published parts make up the whole. Public-sector mining is suppressed but sits inside its group.
- **The 4 annual values on the official source page** (2022–2025) match exactly.
- **All 53 transcribed figures match:**
  - levels, and changes in lari and percent
  - the public/non-public gap
  - the median's distance below the average
  - the published rankings (rankings need at least two peers)
  - the median being below the average in every 2025 section
  - the metadata's 2023 non-business average

The independent SheetJS reader (`node verify_independent.mjs`):
- matches all 3,941 stored values
- renders every cell's own number format to our published value
- matches all 151 unavailable markers in both directions, so no marker in a workbook is left unlisted
- for each of the 4,092 cells, matches the year heading, the printed row label, the group heading, and the section, region or sex ID, using its own separately written lookup tables

Its nine negative controls detect an altered value, an omitted row, an omitted year-like value, a moved cell, a shifted year, swapped sections, swapped regions, swapped sexes and an unlisted unavailable marker.

The sixteen regression tests prove the build rejects:
- omitted cells, sections, years or workbooks
- a lost or duplicated unavailable marker
- a changed repeated total
- a broken single-sector identity
- swaps involving a section absent from a table, and swaps within one table (sections, regions, sexes)
- an activity mapping that disagrees with the section list
- a duplicate primary value or orphaned control
- a changed source-page value
- a total outside its parts
- wrong release figures
- an altered or missing capture
- an unmapped label
- an unexpected number format, a stray number beside a data row, and an uninventoried worksheet

Cross-workbook comparisons use Geostat's published precision (0.1 GEL; whole lari for the median) with zero tolerance. Some workbooks store the same total rounded and others unrounded. No value is altered to force a match.

## Reproduce or verify

From this directory:

```text
python prepare.py
python prepare.py --check
python -B -m unittest discover -s . -p "test_*.py"
node verify_independent.mjs
```

The first command regenerates the derived files; the second checks them without writing. Both fail on any validation error. `-B` keeps Python from leaving a `__pycache__` folder. `verify_independent.mjs` needs `npm ci` in `apps/web` and writes nothing unless given `--write`. Original captures, the manifest and the two transcription files are never modified. Preserve any later Geostat revision as a separate capture and review it before replacing this one.

## Official sources

Geostat's [Wages page](https://www.geostat.ge/en/modules/categories/39/wages) supplies the workbooks:

- [Average monthly nominal earnings of employees](https://geostat.ge/media/83304/01_Earnings_annual.xlsx)
- [By economic activity](https://geostat.ge/media/83305/02_Earnings-by-activity_annual.xlsx)
- [By economic activity and sex](https://geostat.ge/media/83306/03_Earnings-by-sex_annual.xlsx)
- [By business and non-business sector](https://geostat.ge/media/83307/06_Earnings-by-Business-Non-business--sectors_annual.xlsx)
- [By public and non-public sector](https://geostat.ge/media/83308/10-Earnings-ownership_(annual).xlsx)
- [By region](https://geostat.ge/media/83309/13_Earnings-by-regions_annual.xlsx)
- [Median earnings](https://geostat.ge/media/83297/Median-Monthly-Earnings.xlsx)

Definitions follow two metadata documents:
- [Average Monthly Earnings of Employees in Non-Business Sector, certified 16 June 2026](https://geostat.ge/media/80166/0709_160626_EN.PDF), sections 3.1–3.8 and 13.2. This is the only earnings-survey metadata Geostat lists on its Wages page. It also describes the shared definitions and the business-sector survey.
- [Median Earnings, certified 9 October 2026](https://geostat.ge/media/83311/0721_091026_EN.PDF).

The release figures come from [Average Monthly Nominal Earnings of Employees – 2025](https://www.geostat.ge/media/83275/Average-Monthly-Nominal-Earnings-of-Employees---2025.pdf) and [Median Earnings by Economic Activities – 2025](https://geostat.ge/media/83279/Median-Earnings-by-Economic-Activities---2025.pdf).
