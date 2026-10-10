# Annual poverty and Gini coefficients (Geostat)

Research package for the Fiscal.ge Poverty and inequality hub. Approved design: `docs/superpowers/specs/2026-10-10-poverty-inequality-design.md`. Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

All were retrieved on 2026-10-10 from Geostat's "Poverty and Gini Coefficients" page, `https://www.geostat.ge/en/modules/categories/192/living-conditions`. Exact URLs, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`.

| Source ID | Local file | Contents |
| --- | --- | --- |
| `geostat_poverty_absolute` | `official/302-absolute-poverty.xlsx` | Share of population under the absolute poverty line, %, 2004–2025: urban, rural, ages 0–17, 18–64 and 65+, female, male, Georgia |
| `geostat_poverty_relative` | `official/301-relative-poverty.xlsx` | Share of population under 60% and under 40% of the median consumption, %, 2004–2025: urban, rural, Georgia |
| `geostat_poverty_international` | `official/304-international-poverty-2021ppp.xlsx` | Share of population below $3.0, $4.2 and $8.3 a day (2021 PPP), %, 2004–2024, and each line's lari value. The workbook says "Source: World Bank." |
| `geostat_gini` | `official/303-gini-coefficients.xlsx` | Gini coefficients by six income and expenditure measures, 2006–2025, with six definition footnotes |
| `geostat_poverty_source_page` | `official/poverty-page-2026-10-10.html` | The page capture; its table gives Georgia's absolute poverty for 2016–2025 |
| `geostat_poverty_metadata_2026` | `official/poverty-metadata-2026.pdf` | Geostat metadata for absolute and relative poverty indicators and Gini coefficients (25 May 2026) |
| `geostat_hies_metadata_2026` | `official/hies-metadata-2026.pdf` | Geostat metadata for the Households Incomes and Expenditures Survey (25 May 2026) |

## Outputs

- `poverty-annual.csv`: the 491 primary observations, one row per indicator, group and year. `value` is the cell's exact stored decimal, and `published_value` is that value rounded half-up to the cell's number format: `#,##0.0` and `0.0` give one decimal, `0.00` gives two. Every row also carries its source sheet, cell, printed label and number format.
- `coverage.csv`: the first and last year and the count for each indicator and group.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).

| Indicator ID | Groups | Years | Rows |
| --- | --- | --- | --- |
| `poverty.absolute` | `georgia`, `settlement.urban`, `settlement.rural`, `age.0_17`, `age.18_64`, `age.65_plus`, `sex.female`, `sex.male` | 2004–2025 | 176 |
| `poverty.relative_60`, `poverty.relative_40` | `georgia`, `settlement.urban`, `settlement.rural` | 2004–2025 | 132 |
| `poverty.international_300`, `_420`, `_830` | `georgia` | 2004–2024 | 63 |
| `gini.total_income`, `gini.cash_inflows`, `gini.total_inflows`, `gini.consumption_expenditure`, `gini.cash_expenditure`, `gini.total_expenditure` | `georgia` | 2006–2025 | 120 |

The six Gini IDs follow the workbook's numbered footnotes, quoted here:

1. Total incomes includes transfers, cash and non-cash incomes.
2. Total cash inflows includes transfers, cash incomes and other cash inflows.
3. Total inflows includes cash inflows and non-cash incomes.
4. Total consumption expenditures includes cash and non-cash consumption expenditures.
5. Total cash expenditures includes cash consumption and cash non-consumption expenditures.
6. Total expenditures includes cash and non-cash expenditures.

## Checks

`prepare.py` locates every row and column by its printed label, re-reads the original XML number token and rejects:

- a duplicate, missing or extra observation;
- a published value that is not the stored value rounded to its format;
- a percent outside 0–100 or a Gini outside 0–1;
- a Georgia rate outside its urban and rural rates, or (absolute poverty) outside its female and male rates or the range of its three age groups;
- under 40% above under 60% for any group and year;
- international lines out of order ($3.0 ≤ $4.2 ≤ $8.3);
- Georgia's absolute poverty for 2016–2025 not rounding to the page capture (22.0, 21.9, 20.1, 19.5, 21.3, 17.5, 15.6, 11.8, 9.4, 7.1);
- Gini by total incomes for 2025 not rounding to 0.34, the figure in Geostat's 2025 release.

`verify_independent.mjs` re-reads the workbooks with SheetJS. It matches every row's value, its format rendering, its year heading and its printed label, and it requires every formatted numeric cell except the lari lines to be extracted. Its negative controls must detect an altered value, an omitted row, a shifted year, swapped groups and swapped relative lines.

Run them with:

```
python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs
```

## Notes

- The absolute workbook labels 2015 as `2015*`, with the footnote "* Base year of calculating poverty line." The year is read as 2015, and the label is kept in `source_label`.
- Geostat's metadata says Gini coefficients are available from 1997, but the published workbook starts in 2006. Only 2006–2025 is extracted, and no earlier year is taken from another source.
- The survey was the Integrated Household Survey before 2017 and the Households Incomes and Expenditures Survey from 2017, with a sampling frame based on the 2014 census. Geostat's metadata (section 15.2) states "Data is comparable over time."
- In 2025, Geostat gives a 95% confidence interval of 6.3–7.9% for absolute poverty (metadata section 13.2).
- The 63 lari values of the international lines are not extracted. Household income and expenditure, regional data and the subsistence minimum are outside this package.
