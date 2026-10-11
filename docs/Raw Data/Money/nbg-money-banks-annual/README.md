# Annual money, banks, interest rates and bank health (National Bank of Georgia)

Research package for the Fiscal.ge "Money and banks" hub. Approved design: `docs/superpowers/specs/2026-10-11-money-banks-design.md`. Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

All files were retrieved on 2026-10-11 (UTC, 05:38–05:39) from the National Bank of Georgia (NBG) statistics page, `https://nbg.gov.ge/en/statistics/statistics-data`. The page is rendered in the browser, so its HTML capture holds no file list; the list comes from NBG's own API, `GET https://nbg.gov.ge/gw/api/ct/statistics/categories/{id}/data`, which returns `[]` unless the request carries the header `Accept-Language: en`. The listings for categories 15 (monetary statistics), 16 (deposits), 17 (loans), 19 (financial markets) and 27 (archive) are kept as `official/api-category-<id>.json`. Files are served from `https://nbg.gov.ge/fm/%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A2%E1%83%98%E1%83%A1%E1%83%A2%E1%83%98%E1%83%99%E1%83%90/<path>` (the path segment is "statistika" in Georgian). Exact URLs, retrieval times, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`.

| Source ID | NBG code | Local file | Contents |
| --- | --- | --- | --- |
| `nbg_money_aggregates` | M2.1 | `official/money-aggregates-and-monetary-ratioseng.xlsx` | Monthly M0–M3 and monetary ratios, million GEL and percent, Oct 1995–Aug 2026 |
| `nbg_loans_l3_5` | L3.5 | `official/loans-to-the-economy-l3-5eng.xlsx` | Monthly loans granted by banks (excluding interbank loans, including overdue loans and accrued interest), total, in lari, in foreign currency, from Dec 2002 |
| `nbg_deposits_d3_17` | D3.17 | `official/depositsinterest-rates-d3-17eng.xlsx` | Monthly deposits by type, one sheet in lari (`NC`) and one in foreign currency (`FC`), from Jan 1996 |
| `nbg_deposits_individuals_d3_23` | D3.23 | `official/deposits-of-individuals-d3-23eng.xlsx` | Deposits of individuals, lari and foreign-currency sheets, from Jan 2002 |
| `nbg_deposits_legal_d3_27` | D3.27 | `official/deposits-of-legal-entities-d3-27eng.xlsx` | Deposits of legal entities, lari and foreign-currency sheets, from Nov 2015 |
| `nbg_policy_rate` | MPR | `official/mpireng.xlsx` | Every change of the policy rate since January 2008 (date of decision, date of enforcement, rate) |
| `nbg_loan_rates_lwir` | LWIR | `official/annual-weighted-loans-interest-rates-lwireng.xlsx` | Annual weighted average loan rates, total, lari, foreign currency, 1996–2025 |
| `nbg_deposit_rates_dwir` | DWIR | `official/annual-weighted-deposit-interest-rates-dwireng.xlsx` | Annual weighted average deposit rates, total, lari, foreign currency, 1996–2025 |
| `nbg_fsi_archive` | FSI (archive) | `official/fsieng-archive.xlsx` | Quarterly Financial Soundness Indicators 2001Q1–2023Q2 |
| `nbg_fsi` | FSI | `official/fsieng.xlsx` | Monthly Financial Soundness Indicators from January 2022 |
| `nbg_meth_monetary_statistics`, `nbg_meth_loans`, `nbg_meth_deposits`, `nbg_meth_interest_rates` | | `official/monetary-statistics-meth-eng.pdf`, `loans-meth-noteseng.pdf`, `deposits-meth-noteseng.pdf`, `interest-rates-methodology-eng.pdf` | NBG methodology notes for the four table families |
| `nbg_api_category_15`, `_16`, `_17`, `_19`, `_27` | | `official/api-category-<id>.json` | The file listings the workbook paths came from |
| `nbg_statistics_page` | | `official/nbg-statistics-page-2026-10-11.html` | The statistics page capture |

The spec's source table has 11 rows, but one is the calculation from L3.5 and D3.17 rather than a file, so 10 workbooks are needed and kept.

## Outputs

- `money-banks-annual.csv`: the 730 served observations, one row per indicator and year, with columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`. `value` is the exact decimal token stored in the cell. For calculated rows it is the exact decimal sum, or the ratio times 100 to 28 significant digits, computed with Python's `decimal`. `published_value` is `value` rounded half-up to one decimal, or two for `rates.policy`. The rounding uses the value as Excel displays it (15 significant digits), so 8.4499999999999993, shown as 8.45, publishes as 8.5. `basis` is always `actual`; `value_status` is `official` for transcribed cells and `calculated` for 119 rows. For a calculated row, `source_sheet` and `source_cell` list the input sheets and cells in the same order, joined with `+` for sums and `/` for shares (a parenthesis groups the deposit total in the deposit share).
- `money-banks-series-breaks.csv`: two rows, `fsi_method_2022` and `fsi_ifrs_2023` (see Notes), in the demography break format. A `reference_date` is the first day on the new basis, as in the census break.
- `coverage.csv`: the first and last year and the count for each indicator.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).
- `source-manifest.csv` and `source-manifest.json`.

## Cell map

`prepare.py` finds each column by its printed heading text and each row by the date or year in column A (or, for the policy rate and the current FSI file, by the enforcement date or the date heading), never by fixed position. Only December values are served, so no monthly or quarterly value enters the data.

| Indicator ID | Unit | Source, sheet and column heading | Years | Rows |
| --- | --- | --- | --- | --- |
| `money.m3`, `money.m2`, `money.m1`, `money.m0` | gel_million | M2.1 `Monetary Ratios-eng`, row 3: "Money Aggregates (M3)", "(M2)", "(M1)", "Money Outside Banks (M0)", December rows | 1995–2025 | 124 |
| `money.m3_to_gdp`, `money.m2_to_gdp` | percent | M2.1: "Monetization Coefficient (M3)" and "(M2)", the headings without a star | 1996–2025 | 60 |
| `loans.total`, `loans.gel`, `loans.fx` | gel_million | L3.5 `Eng`: the "Total" column under "Total Loans (including overdue Loans)", "… in national currency" and "… in foreign currency" | 2002–2025 | 72 |
| `deposits.gel`, `deposits.fx` | gel_million | D3.17 `NC Dep.volume&Int.rates-eng` and `FC Dep.volume&Int.rates-eng`: "Deposits, Total" under "Million GEL" | 1996–2025 | 60 |
| `deposits.total` | gel_million | calculated: `deposits.gel + deposits.fx` | 1996–2025 | 30 |
| `deposits.individuals` | gel_million | calculated: D3.23 `NC Dep.of Individuals-eng` + `FC Dep.of Individuals-eng`, "Deposits, total" under "Million GEL" | 2002–2025 | 24 |
| `deposits.legal_entities` | gel_million | calculated: D3.27 `NC` + `FC`, "Total Deposits" | 2015–2025 | 11 |
| `loans.fx_share`, `deposits.fx_share` | percent | calculated: `loans.fx / loans.total × 100`, `deposits.fx / deposits.total × 100` | 2002–2025, 1996–2025 | 54 |
| `rates.policy` | percent | MPR `MPIR-Eng`: the rate on the last row whose "Date of Enforcement" is on or before 31 December | 2008–2025 | 18 |
| `rates.loans_total`, `rates.loans_gel`, `rates.loans_fx` | percent | LWIR `loans % Annual`: the "total" column under "Total", "National currency" and "Foreign currency" | 1996–2025 | 90 |
| `rates.deposits_total`, `rates.deposits_gel`, `rates.deposits_fx` | percent | DWIR `Dep %-Annual`: the same three columns | 1996–2025 | 90 |
| `banks.npl_ratio` | percent | archive `FSI_Deposit_Takers_eng` "Nonperforming loans (by IMF's methodology) to total gross loans", `YYYYQ4` columns; current `FSD` "Nonperforming loans to total gross loans" with unit Percent, December columns | 2003–2021; 2022–2025 | 23 |
| `banks.roa`, `banks.roe` | percent | archive "Return on Assets" / "Return on Equity"; current "Return on assets" / "Return on equity" | 2001–2021; 2022–2025 | 50 |
| `banks.capital_ratio`, `banks.tier1_ratio` | percent | archive: the two rows under "Capital Adequacy (Basel III)"; current "Regulatory capital to risk-weighted assets" / "Tier 1 capital to risk-weighted assets" | 2014–2021; 2022–2025 | 24 |

Layout notes, observed in the files of 2026-10-11:

- Month-end dates in column A are Excel serial numbers. Money, loans and deposit workbooks run to August 2026, so 2026 is not served.
- In D3.17 and D3.23 the heading "Deposits, Total" appears twice, once under "Million GEL" and once under the interest-rate block. The package takes the one left of the interest-rate heading.
- In the archive FSI sheet the group heading is in column B and the indicator in column C. "Regulatory capital to risk-weighted assets" appears under both Basel I and Basel III, so the group heading decides. Placeholders `x`, `...` and `…` mark missing values; none falls inside a served range.
- In the current FSI sheet (`FSD`) the label is in column B, the unit in column C and the month-end date in row 3 from column D. Component rows repeat some labels (for example "Nonperforming loans" in million GEL); the package takes the single row whose unit is Percent.
- In L3.5 the "Total" sub-heading sits in row 4 (total and lari) or row 5 (foreign currency); the package checks it.
- Monetization coefficients are filled only at quarter ends, which includes December.

## Checks

`prepare.py` re-reads the original XML number token and rejects:

- a duplicate, missing or extra observation, or a year outside an indicator's coverage;
- a published value that is not the stored value rounded to its decimals;
- a percent outside 0–100 (return on assets and equity may be negative, as in 2008) or a negative amount;
- a calculated value that does not equal its inputs (deposit total, foreign-currency shares);
- lari plus foreign currency differing from total loans by more than 0.01 in any year (total deposits are that sum by construction);
- people plus companies differing from all deposits by more than 0.01 in any year from 2015;
- M0 ≤ M1 ≤ M2 ≤ M3 failing in any year;
- the 2022 overlap of the two FSI files not agreeing to one decimal for capital, Tier 1 and return on assets, or not differing for bad loans and return on equity;
- an anchor value not matching what NBG shows: M3 end-2025 57,680.2 million GEL; loans end-2025 72,453.0 million GEL; National Bank rate 8.00% at the end of 2025; bad loans 2.5% in 2025; foreign-currency share of deposits 48.6% and of loans 41.9% in 2025.

`verify_independent.mjs` re-reads the ten workbooks with SheetJS, not the Python XML reader. For every one of the 730 rows it checks the stored value, the rounding, the date in the row, and the printed column heading; for the 119 calculated rows it recomputes the sum or ratio from the cells named in `source_cell`. Its negative controls must detect an altered value, an altered calculated value, an omitted row, a shifted year, a neighbouring column, swapped sheets, a wrong quarter and a mis-rounded published value.

Run them with:

```
python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs
```

`python3 prepare.py` rebuilds the generated files. `node verify_independent.mjs` rewrites `independent-validation.json`.

## Notes

- **Policy instrument before 2008-08-20.** The MPR sheet's footnote reads: "Until the August 20, 2008 7-day CD (Certificate of Deposit) rate was used as a Monetary Policy Rate. Since then the 7-day Refinancing instrument was introduced for conducting monetary policy operations." The MPR file starts in January 2008, so `rates.policy` runs 2008–2025, and the 2008 value (8%, enforced 25 December 2008) belongs to the refinancing instrument while January–August 2008 rows belong to the CD rate. No earlier year is taken from another source.
- **Two breaks in the bank-health series.** Both are recorded in `money-banks-series-breaks.csv`; no change may be computed across either.
  - `fsi_method_2022` (from 2022-01-01; bad loans and return on equity). Values to 2021 come from the archive FSI file (quarterly, to 2023Q2, note "Calculated according to IMF methodology.") and values from 2022 from the current FSI file (note "Data is calculated according to the 2019 FSI Methodology."). For 2022 the two files give the same capital ratio (20.33%), Tier 1 ratio (17.12%) and return on assets (3.82%), but different bad loans (archive 2022Q4 1.66%, current December 2022 1.51%) and return on equity (30.21% against 24.79%). Neither file states why or on what date the basis changed; the package records only what the two files show.
  - `fsi_ifrs_2023` (from 2023-01-01; all five measures). The current file's note, in cell B121 of `FSD`, reads "Due to the implementation of the IFRS, data has been reviewed starting from 2023-01." In that file bad loans move from 1.51% in December 2022 to 3.10% in January 2023 (2.52% in December 2023), so the 2022 to 2023 step also falls across this break.
- **Bad loans.** Only the IMF-method series is used. The archive's NBG-method series ("Nonperforming loans (by NBG's methodology) to total gross loans") runs higher and is not served. Capital uses the Basel III rows (2014 onward); the Basel I rows are not served.
- **Monetization coefficients.** M2.1 has two pairs. "Monetization Coefficient * (M3)" and "* (M2)" carry a star, and the sheet's note says "* Average from the beginning of the year." They are year-to-date averages, not period-end ratios. The un-starred "Monetization Coefficient (M3)" and "(M2)" are the period-end ratios of money to GDP that this package serves, from December rows. They are NBG's own published values, not calculated here.
- **Dollarization.** M2.1 publishes "Dollarization Ratio of Deposits, Included in Broad Money, %" and "Dollarization Ratio of the Total Non-Bank Deposits,%". The second is defined in NBG's methodology as foreign-currency non-bank deposits over total non-bank deposits, a narrower set: 47.72% at December 2025, against 48.61% for foreign-currency deposits over all deposits in D3.17 (`deposits.fx_share`). The package serves the D3.17 calculation so the share always agrees with the deposit amounts shown next to it, and the methodology page says the NBG ratio runs about one point lower.
- **Foreign-currency amounts** are NBG's lari values at the end-of-month official rate. No exchange rate is served and no exchange-rate workbook is kept.
- **Coverage notes in the workbooks.** Data are compiled from monthly reports of all resident banks. The files state that they were "updated to include microbanks from January 2025"; this is a coverage change inside the series and is not adjusted. Since November 2015 the money aggregates come from the SebStat database.
- Loan and deposit rates are weighted averages of contractual annual rates on year-end stocks, with zero-rate items excluded (LWIR and DWIR "Calculations" notes).
- Everything excluded from the spec stays excluded: monthly and quarterly values, 2026, interest rates by maturity, sector and region splits, and exchange rates.
