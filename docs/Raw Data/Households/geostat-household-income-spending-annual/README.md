# Annual household income and spending (Geostat)

Research package for the Fiscal.ge Living standards hub. Approved design: `docs/superpowers/specs/2026-10-11-living-standards-design.md`. Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

All were retrieved on 2026-10-11 from Geostat's "Households Incomes" page, `https://www.geostat.ge/en/modules/categories/50` (resolves to `…/50/households-income`), and "Households Expenditures" page, `…/categories/51` (resolves to `…/51/households-expenditures`). Each workbook's URL is `https://geostat.ge/media/<id>/<name>`, which redirects to `www.geostat.ge`. Exact URLs, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`. Each file was downloaded again from Geostat and matched byte for byte (by SHA-256) to the copy first shared with the project.

Workbooks 101–109 (income, media 79260–79268) and 201–209 (spending, media 79278–79286) each come in three groups: the total population, per household and per capita (per person), and each of those for Georgia, towns and villages (urban and rural) and regions. Every workbook has one sheet named `1`, and the lines are in GEL a month.

| Source ID pattern | Local file | Served |
| --- | --- | --- |
| `geostat_household_income_{household,capita}_{national,settlement,region}` | `official/104-…109-*.xlsx` | yes |
| `geostat_household_spending_{household,capita}_{national,settlement,region}` | `official/204-…209-*.xlsx` | yes |
| `geostat_household_{income,spending}_population_{national,settlement,region}` | `official/101-…103-*.xlsx`, `official/201-…203-*.xlsx` | no, archived |
| `geostat_household_income_page`, `geostat_household_spending_page` | `official/income-page-2026-10-11.html`, `official/spending-page-2026-10-11.html` | no, page captures |
| `geostat_household_hies_metadata_2026` | `official/hies-metadata-2026.pdf` | no, copied unchanged from the Poverty package |

Filenames are Geostat's names, lowercased and shortened: `104-income-per-household.xlsx`, `105-income-per-household-settlement.xlsx`, `106-income-per-household-region.xlsx`, and so on. The Georgian-language versions of 104–109 and 204–209 are kept under `official/ka/` for their labels. They are not manifest sources. Every numeric cell in them equals the English cell to within 1.1e-12, in the 16th or 17th significant digit, so no value is taken from them.

The source pages are captured as they resolved on 2026-10-11. The metadata PDF is the Households Incomes and Expenditures Survey metadata of 25 May 2026 (`0701_250526_EN.PDF`), retrieved on 2026-10-10 for the Poverty package.

## Outputs

- `household-income-spending-annual.csv`: the 10,638 primary observations, one row per indicator, area, measure and year. Columns are `year, indicator_id, area_id, measure, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell, source_label, source_number_format`.
  - `value` is the positional decimal expansion of the cell's `<v>` token (numerically identical to the token, without exponent notation; the checks compare it numerically).
  - `published_value` is the number Excel displays: the token is first rounded to 15 significant digits, then half-up to the cell's format (`#,##0.0` or `0.0`, so one decimal). A stored `8.4499999999999993` shows as 8.45 and publishes as 8.5, not 8.4.
  - `unit` is `gel_month`, `basis` is `actual` and `value_status` is `survey_estimate` on every row.
  - `source_label` is the printed row label, followed by ` | ` and the Urban, Rural or region heading in the settlement and regional workbooks.
- `coverage.csv`: the first and last year and the count for each indicator, area and measure.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs --write`).

| | Income | Spending |
| --- | --- | --- |
| Lines | 12 | 15 |
| Georgia | 2002–2025 | 2002–2025 |
| `settlement.urban`, `settlement.rural` | 2006–2025 | 2006–2025 |
| Regions | 2011–2025; four regions only from 2019 | same |
| Rows | 4,728 | 5,910 |

`measure` is `per_household` for 104–106 and 204–206, and `per_capita` for 107–109 and 207–209. Georgia has 24 years, towns and villages 2 × 20 and regions 133 region-years (seven regions for 2011–2018, eleven for 2019–2025), which is 197 area-years for each line and measure.

## Label map

Rows are located by their printed label, exact text except for the property line, never by row number. Blocks are located by their heading: the year header row, the `Urban` and `Rural` headings (one year header under `Urban` serves both blocks) and the lone year label that opens each regional block.

| Workbook row label | ID |
| --- | --- |
| `1. Income, total (2+3)` | `income.total` |
| `Wages and salaries` | `income.wages` |
| `From self-employment` | `income.self_employment` |
| `From selling agricultural production` | `income.agriculture_sales` |
| `Property income (leasing, interest on deposit…` (prefix) | `income.property` |
| `Pensions, scholarships, assistances` | `income.pensions_assistance` |
| `Remittances from abroad` | `income.remittances` |
| `Money received as gift` | `income.gifts` |
| `3. Non-cash income` | `income.non_cash` |
| `4. Other cash inflows` | `income.other_inflows` |
| `Borrowing and dissaving` | `income.borrowing_dissaving` |
| `Property disposal` | `income.property_disposal` |
| `1. Consumption expenditure, total (2+3)` | `spending.consumption` |
| `On food, beverages, tobacco` | `spending.food` |
| `On clothes and footwear` | `spending.clothing` |
| `On household goods` | `spending.household_goods` |
| `On healthcare` | `spending.health` |
| `Housing, water, electricity, gas and other fuels` | `spending.housing_utilities` |
| `On transport` | `spending.transport` |
| `On education` | `spending.education` |
| `Other consumption expenditure` | `spending.other_consumption` |
| `3. Non-cash expenditure` | `spending.non_cash` |
| `4. Cash non-consumption expenditure` | `spending.non_consumption` |
| `On agriculture` | `spending.agriculture` |
| `On transfers` | `spending.transfers` |
| `On saving and lending` | `spending.saving_lending` |
| `On property acquirement` | `spending.property` |

Areas: `georgia`; `settlement.urban` and `settlement.rural`; and `region.kakheti`, `region.tbilisi`, `region.shida_kartli`, `region.kvemo_kartli`, `region.samtskhe_javakheti`, `region.adjara`, `region.guria`, `region.samegrelo_zemo_svaneti`, `region.imereti` (the `Imereti*` column), `region.mtskheta_mtianeti` and `region.racha_lechkhumi_kvemo_svaneti`.

Six printed lines are read only to check the others and are not served: `2. Cash income and transfers`, `5. Cash inflows, total (2+4)`, `6. Cash and non-cash inflows, total (3+5)`, `2. Cash consumption expenditure`, `5. Cash expenditure, total (2+4)` and `6. Expenditure, total (3+5)`. The regional workbooks' `Other regions**` column and `Georgia` column are also read only for checks.

## Checks

`prepare.py` re-reads every original XML number token and rejects:

1. a changed value (a published value that is not the displayed value of the stored one), a missing, extra or duplicate observation, a year outside a workbook's coverage, a lost footnote, a row served where Geostat printed `…` or `x`, or any unrecognised row label or non-numeric cell;
2. parts that do not add up to their printed total, for every area, year and measure, within `1e-6` on the exact values (the measured maximum error is 5.5e-8, over 5,280 sums):
   - total income = the seven cash sources + non-cash income, and = cash income and transfers (line 2) + non-cash income; line 2 = the seven cash sources;
   - other cash inflows = property disposal + borrowing and dissaving;
   - cash inflows (line 5) = line 2 + other cash inflows, and all inflows (line 6) = non-cash income + line 5;
   - consumption = the eight consumption categories + non-cash expenditure, and = cash consumption (line 2) + non-cash expenditure; line 2 = the eight categories;
   - cash non-consumption expenditure = agriculture + transfers + saving and lending + property acquirement;
   - cash expenditure (line 5) = cash consumption + cash non-consumption, and total expenditure (line 6) = non-cash expenditure + line 5;
3. a Georgia value outside its urban and rural values, for every line (served or check-only), measure and year; and a Georgia value outside the minimum and maximum of the regional columns, including `Other regions**` before 2019;
4. the regional workbooks' `Georgia` column differing from the national workbook by more than `1e-9`;
5. a negative value;
6. Georgia's 2025 per-household income not publishing 2025.8 and consumption spending not publishing 1438.7 (the design's figures), and the four 2025 headline figures in the page captures not publishing (all-inflows line 6 for income, total expenditure line 6 for spending): per household 2131.5 and 1936.3, per capita 663.6 and 602.9. The captured headline table shows those two sum lines, so the design's 2025.8 and 1438.7 are not printed on the pages but are the workbooks' own total-income and consumption-spending lines.

`verify_independent.mjs` re-reads the 12 served workbooks with SheetJS (not a regular expression over the sheet XML, so the many self-closing empty cells, as in `<c r="B5" s="3"/>`, cannot swallow the next cell), using its own label tables. It matches all 10,638 stored values, displayed values (15 significant digits, then half-up, and SheetJS's own rendering), year headings, area headings and printed labels, and it requires every formatted numeric cell (14,520) to be either extracted or one of the 3,882 check-only cells. It confirms that none of the 2,574 `…` or `x` cells is served and that the three footnotes are present in each regional workbook. Its negative controls must detect an altered value, an omitted row, a shifted year, swapped regions and swapped urban and rural areas, and it pins the displayed-digits rule (8.4499999999999993 shows as 8.5, 2025.7499999999999 as 2025.8).

Run them with:

```
python3 -B prepare.py && python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs
```

`node verify_independent.mjs --write` also rewrites `independent-validation.json`.

## Notes

- Footnotes of the regional workbooks (kept in `validation-report.json`):
  - `* The data of 2011-2018 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions.` So `Imereti*` covers a wider area in 2011–2018 than from 2019, and `region.racha_lechkhumi_kvemo_svaneti` starts only in 2019.
  - `** Includes Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti regions.` The `Other regions**` column covers them. It is numeric for 2011–2018 and printed `x` from 2019. It is read for the Georgia range check only.
  - `… The data is not available due to small sample size of the survey. Survey sample size has been increased since 2019.` Until 2018 the cells for Guria, Mtskheta-Mtianeti, Racha-Lechkhumi and Kvemo Svaneti, and Samtskhe-Javakheti hold `…`. No row is served for those four regions before 2019, and nothing is estimated or filled in.
- The survey was the Integrated Household Survey from 2002 to 2016 and the Households Incomes and Expenditures Survey from 2017 (each workbook's own `Source:` line says so). The 2017 change of survey is a break to flag wherever these series are shown across it.
- Workbooks 101–103 and 201–203 (the total-population groups, in million GEL) are archived as sources but not served: the product serves per-household and per-person values only.
- The sum lines (`2.`, `5.` and `6.`) are archived but not served: they only reconcile the others and add no line of their own.
- No estimates, interpolation, inflation adjustment, shares or other derived figures are produced here.
