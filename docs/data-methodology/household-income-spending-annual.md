# Annual household income and spending data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Households/geostat-household-income-spending-annual/`, collected on 2026-10-11 from Geostat's "Households Incomes" and "Households Expenditures" pages. The research captures are immutable. The 10,638 primary values are served on the Income and Spending pages of the Living standards hub under the approved design `docs/superpowers/specs/2026-10-11-living-standards-design.md`; see [Serving on the Living standards pages](#serving-on-the-living-standards-pages). Nothing is published through `/mcp` or the central JSON and CSV files.

The approved scope is annual data only: the average monthly household income lines (12) and spending lines (15) in GEL, per household and per person, for Georgia, towns and villages, and the regions. The whole-country totals in million GEL, the printed subtotal and grand-total lines, the "Other regions" column, shares, inflation adjustment, splits by household type and quarterly data are excluded.

Geostat is the sole publisher. Eighteen workbooks, two page captures and the household survey metadata (25 May 2026) are preserved under `official/`; the Georgian-language copies of the served workbooks under `official/ka/` are kept only for their labels and are not sources. Exact URLs, retrieval dates, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the public archive is `data/methodology/source-archives/household-income.csv`.

## Indicators and definitions

| Indicator IDs | Meaning | Coverage |
| --- | --- | --- |
| `income.total` | Total income: cash income and transfers plus non-cash income | 2002–2025 |
| `income.wages`, `income.self_employment`, `income.agriculture_sales`, `income.property`, `income.pensions_assistance`, `income.remittances`, `income.gifts` | The seven cash sources, which with `income.non_cash` add up to `income.total` | 2002–2025 |
| `income.non_cash` | Non-cash income: goods produced for self-consumption or received free of charge, valued at average prices of the reference period | 2002–2025 |
| `income.other_inflows`, `income.borrowing_dissaving`, `income.property_disposal` | Other cash inflows: borrowing or dissaving and property disposal. They are not part of `income.total` | 2002–2025 |
| `spending.consumption` | Consumption expenditure, total: cash consumption expenditure plus non-cash expenditure | 2002–2025 |
| `spending.food`, `spending.clothing`, `spending.household_goods`, `spending.health`, `spending.housing_utilities`, `spending.transport`, `spending.education`, `spending.other_consumption` | The eight cash consumption categories, which with `spending.non_cash` add up to `spending.consumption` | 2002–2025 |
| `spending.non_cash` | Non-cash expenditure: self-produced goods and goods received free of charge, valued at average prices of the reference period | 2002–2025 |
| `spending.non_consumption`, `spending.agriculture`, `spending.transfers`, `spending.saving_lending`, `spending.property` | Cash non-consumption expenditure and its four parts. They are not part of `spending.consumption` | 2002–2025 |

Areas are `georgia` (2002–2025), `settlement.urban` and `settlement.rural` (2006–2025) and eleven regions (2011–2025, four of them from 2019 only). `measure` is `per_household` or `per_capita`. Every line is the average month of the year, in current GEL.

Each income source and spending category is described on the public page in the words of Geostat's metadata (sections 3.4 of `hies-metadata-2026.pdf`). Geostat's metadata does not define "other consumption expenditure" further. All rows use `basis=actual` and `value_status=survey_estimate`. The package creates no estimates, interpolation, rebasing or derived figures.

## Survey and time boundaries

| Boundary | Handling |
| --- | --- |
| Survey change in 2017 | The Integrated Household Survey before 2017 and the Households Incomes and Expenditures Survey from 2017, with a sampling frame based on the 2014 census instead of the 2002 census. Geostat's metadata (section 15.2) states "Data is comparable over time", so one series is shown and no break is drawn. |
| Coverage | All private households, excluding the occupied territories (Abkhazian Autonomous Republic and Tskhinvali region). In 2025, 17,280 households were sampled and 13,341 interviewed, a response rate of 77.2%. |
| Reference period | Each value is the average month of the year, in current lari, not adjusted for inflation. |
| Towns and villages | Published from 2006. |

## Regional boundaries

- `Imereti*`: Geostat's footnote says the data of 2011–2018 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti. So `region.imereti` covers a wider area before 2019 and its line steps down in 2019 for that reason. The page states this and the chart draws no marker.
- `region.racha_lechkhumi_kvemo_svaneti` starts in 2019.
- Guria, Mtskheta-Mtianeti and Samtskhe-Javakheti hold `…` until 2018 (Geostat: "The data is not available due to small sample size of the survey. Survey sample size has been increased since 2019"). No row is served for these regions before 2019, and nothing is estimated or filled in.
- `Other regions**` (Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti together) is numeric for 2011–2018 and `x` from 2019. It is read only for the Georgia range check and is never shown.

## Borrowing and property sales

Geostat's workbook prints "Income, total" as cash income and transfers plus non-cash income. Borrowing or dissaving and property disposal are cash inflows that sit in a separate line, "Other cash inflows", outside total income, because they move existing wealth or debt and are not earnings. The pages keep them as their own series and never add them to total income. Spending mirrors this: saving and lending, agriculture, transfers and property acquirement are cash non-consumption expenditure, outside consumption expenditure.

## Extraction and provenance

`prepare.py` reads worksheet XML with Python's standard library and locates every row and block by its printed label, never by row number. It keeps each stored decimal token. Each observation records its source ID, sheet, cell, printed label and number format. `value` keeps the stored precision; `published_value` rounds the 15-significant-digit token half-up to the cell's format, so one decimal.

## Validation and evidence

`prepare.py` rejects a changed value, a missing, extra or duplicate observation, a year outside a workbook's coverage, a lost footnote, a served `…` or `x`, an unrecognised label, a negative value, and parts that do not add up to their printed total within 1e-6 (5,280 sums, measured maximum error 5.5e-8). It also requires Georgia to lie within its urban and rural values and within the minimum and maximum of the regions. `verify_independent.mjs` re-reads the 12 served workbooks with SheetJS and matches all 10,638 values. Georgia's 2025 per-household figures must publish 2025.8 for total income and 1438.7 for consumption spending.

## Serving on the Living standards pages

`npm run data:prepare-household-income -- --write` re-reads the package and writes `data/imports/household-income-spending-annual.csv` and `data/reports/household-income-spending-validation.json`. `npm run data:check-household-income` (part of `data:validate`) rebuilds both in memory and fails on any difference. The Prisma mirror table `HouseholdIncomeSpendingFact` is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

Each page shows the published value: one decimal, in lari a month. Missing years are gaps in the chart, dashes in the table and blank Excel cells, never zero. The pages describe the figures and state no causes. Fiscal.ge computes nothing: every value is Geostat's published average, per household or per person.

Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, the area, per household or per person, the survey-estimate status, empty cells for missing values and validated links to the archived Geostat workbooks the values came from. The Sources sheet is built from the 12 served workbooks of the archive. Internal cell references are not exported.

The methodology page `/methodology/household-income` publishes the archive of 21 originals: the 18 workbooks, the two page captures (downloaded as text files) and the metadata. They are served from `public/downloads/methodology/household-income/files/` and are excluded from the function bundle with the other methodology downloads (`outputFileTracingExcludes` in `next.config.ts`).

## Statistical limitations and future use

Every value is a survey estimate. Geostat's metadata gives a 95% confidence interval of 1981.7–2069.9 GEL for 2025 income per household, total (standard error 22.5 GEL); small changes and close differences between regions or years should not be presented as meaningful. Later integration must preserve the annual frequency, the average-month meaning, current prices and the survey-estimate status. Shares of spending, inflation-adjusted amounts, splits by household type and the whole-country totals would each be a separately reviewed addition.

Original sources: [Geostat Households Incomes](https://www.geostat.ge/en/modules/categories/50/households-income), [Households Expenditures](https://www.geostat.ge/en/modules/categories/51/households-expenditures), the 18 workbooks linked in the package README and the [household survey metadata](https://www.geostat.ge/media/79320/0701_250526_EN.PDF).
