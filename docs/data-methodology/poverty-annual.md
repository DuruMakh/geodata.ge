# Annual poverty and Gini data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Poverty/geostat-poverty-annual/`, collected on 2026-10-10 from Geostat's "Poverty and Gini Coefficients" page. The research captures are immutable. The 491 primary values are served on the Poverty and Inequality pages of the Living standards hub (`/explorer/living-standards/poverty` and `/explorer/living-standards/inequality`; the earlier `/explorer/poverty` addresses redirect there) under the approved designs `docs/superpowers/specs/2026-10-10-poverty-inequality-design.md` and `docs/superpowers/specs/2026-10-11-living-standards-design.md`; see [Serving on the Poverty and inequality pages](#serving-on-the-poverty-and-inequality-pages). Nothing is published through MCP or included in central machine-readable publications.

The user approved annual data only: absolute, relative and international poverty rates and Gini coefficients. Household income and expenditure (a separate dataset: `household-income-spending-annual.md`), poverty by region, the subsistence minimum, the lari value of the international lines and quarterly data are excluded.

Geostat is the sole publisher. Four workbooks, the English source page and two current metadata documents (25 May 2026) are preserved under `official/`. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`.

## Indicators and definitions

| Indicator ID | Meaning | Groups | Coverage |
| --- | --- | --- | --- |
| `poverty.absolute` | Share of population under the absolute poverty line, % | `georgia`, `settlement.urban`, `settlement.rural`, `age.0_17`, `age.18_64`, `age.65_plus`, `sex.female`, `sex.male` | 2004–2025 |
| `poverty.relative_60`, `poverty.relative_40` | Share of population under 60% or 40% of the median consumption, % | `georgia`, `settlement.urban`, `settlement.rural` | 2004–2025 |
| `poverty.international_300`, `_420`, `_830` | Share of population below $3.0, $4.2 and $8.3 a day (2021 PPP), %; the workbook says "Source: World Bank." | `georgia` | 2004–2024 |
| `gini.total_income`, `gini.cash_inflows`, `gini.total_inflows`, `gini.consumption_expenditure`, `gini.cash_expenditure`, `gini.total_expenditure` | Gini coefficients by six income and expenditure measures, 0–1 | `georgia` | 2006–2025 |

The six Gini measures follow the workbook's numbered footnotes: total incomes includes transfers, cash and non-cash incomes; total cash inflows includes transfers, cash incomes and other cash inflows; total inflows includes cash inflows and non-cash incomes; total consumption expenditures includes cash and non-cash consumption expenditures; total cash expenditures includes cash consumption and cash non-consumption expenditures; total expenditures includes cash and non-cash expenditures.

The absolute poverty line is described only in Geostat's published words: the poverty level is the share of the poor in the total population, and the absolute workbook marks `2015*` with "Base year of calculating poverty line." Any further definition needs a citable Geostat source first. Relative lines are 60% and 40% of the median of the population distribution by total consumption.

All rows use `basis=actual` and `value_status=survey_estimate`. The package creates no estimates, interpolation, rebasing or derived figures.

## Survey and time boundaries

| Boundary | Handling |
| --- | --- |
| Survey change in 2017 | The Integrated Household Survey before 2017 and the Households Incomes and Expenditures Survey from 2017, with a sampling frame based on the 2014 census instead of the 2002 census. Geostat's metadata (section 15.2) states "Data is comparable over time", so no break is drawn. |
| Gini before 2006 | Geostat's metadata says Gini coefficients are available from 1997, but the published workbook starts in 2006. Only 2006–2025 is extracted; no earlier year is taken from another source. |
| International lines in 2025 | Geostat's file ends in 2024. 2025 is a gap, never zero. |
| Lari values of the international lines | The 63 cells stay in the package and are not extracted. |
| Coverage | All private households, excluding the occupied territories (Abkhazian Autonomous Republic and Tskhinvali region). In 2025, 13,341 households were interviewed. |

## Extraction and provenance

`prepare.py` reads worksheet XML with Python's standard library, reusing the unemployment package's reader, and locates every row and column by its printed label. It preserves stored decimal tokens. Each observation records its source ID, sheet, cell, printed label and number format. `value` keeps the stored precision; `published_value` rounds half-up to the cell's format: `#,##0.0` and `0.0` give one decimal, `0.00` gives two.

## Validation and evidence

`python3 -B prepare.py --check` rebuilds every output in memory, compares the bytes with the saved files, and rejects:

1. a duplicate, missing or extra observation, or a year outside each workbook's coverage;
2. a published value that is not the stored value rounded to its format;
3. a percent outside 0–100 or a Gini coefficient outside 0–1;
4. a Georgia rate outside its urban and rural rates, or (absolute poverty) outside its female and male rates or the range of its three age groups;
5. under 40% above under 60% for any group and year, and international lines out of order ($3.0 ≤ $4.2 ≤ $8.3);
6. Georgia's absolute poverty for 2016–2025 not rounding to the page capture (22.0, 21.9, 20.1, 19.5, 21.3, 17.5, 15.6, 11.8, 9.4, 7.1), and the 2025 Gini by total incomes not rounding to 0.34.

Ten regression tests (`python3 -B -m unittest test_validation -v`) prove these rejections and that the `2015*` footnote is kept. `node verify_independent.mjs` re-reads the workbooks with SheetJS and separately written label tables. It matches all 491 stored values, each format rendering, year heading and printed label, and requires every formatted numeric cell except the 63 lari values to be extracted. Its negative controls detect an altered value, an omitted row, a shifted year, swapped groups and swapped relative lines.

## Serving on the Poverty and inequality pages

`npm run data:prepare-poverty -- --write` re-reads the package's four workbooks and `poverty-annual.csv`, requires both the research report and the independent verification to have passed, and writes `data/imports/poverty-annual.csv` (UTF-8 with BOM) and `data/reports/poverty-validation.json`. `npm run data:check-poverty` (part of `data:validate`) rebuilds both in memory and fails on any difference. The loader re-applies every rule above. The Prisma mirror table `PovertyFact` is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

The pages show the published value: one decimal for percents and two for Gini coefficients. Missing years are gaps and dashes, never zero. The pages describe the figures and state no causes.

- **Poverty** has three tabs: the poverty line (Georgia with its seven groups nested under it), relative poverty (60% and 40% lines, each with towns and villages nested under it) and the international lines.
- **Inequality** shows the six Gini coefficients, with total income first.

Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, the survey-estimate status, empty cells for missing values and validated links to the archived Geostat workbooks. Internal cell references are not exported.

## Statistical limitations and future use

Every value is a survey estimate. Geostat gives a 95% confidence interval of 6.3–7.9% for the 2025 absolute poverty rate of 7.1% (metadata section 13.2); small changes and close differences between groups should not be presented as significant. Later integration must preserve annual frequency, the 2006 start of the Gini series, the 2024 end of the international lines and the survey-estimate status. Counts of poor people, changes in percentage points or regional poverty would each be a separately reviewed addition.

Original sources: [Geostat Poverty and Gini Coefficients](https://www.geostat.ge/en/modules/categories/192/living-conditions), the four workbooks linked in the package README, the [poverty metadata](https://www.geostat.ge/media/79322/0702_250526_EN.PDF) and the [household survey metadata](https://www.geostat.ge/media/79320/0701_250526_EN.PDF).
