# Annual money, banks, interest rates and bank health data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Money/nbg-money-banks-annual/`, collected on 2026-10-11 from the National Bank of Georgia (NBG) statistics page. The research captures are immutable. The 730 served values (611 official, 119 calculated) appear on the Money and banks pages under the approved design `docs/superpowers/specs/2026-10-11-money-banks-design.md`; see [Serving on the Money and banks pages](#serving-on-the-money-and-banks-pages). Nothing is published through MCP or included in central machine-readable publications.

The user approved annual data only: money aggregates, bank loans and deposits, interest rates and bank-health measures. Exchange-rate statistics are excluded at the owner's request, as are monthly and quarterly values, 2026, and breakdowns by sector, region, purpose or maturity. Foreign-currency amounts are NBG's lari values.

NBG is the sole publisher. Ten workbooks, four NBG methodology PDFs, five file listings from NBG's statistics API and the statistics page capture are preserved under `official/`. Exact URLs, retrieval times, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the package README holds the full cell map.

## Indicators and definitions

| Indicator IDs | Meaning | Source | Coverage |
| --- | --- | --- | --- |
| `money.m3`, `money.m2`, `money.m1`, `money.m0` | Broad money, broad money in lari, narrow money, cash outside banks; million GEL, December | M2.1 | 1995–2025 |
| `money.m3_to_gdp`, `money.m2_to_gdp` | NBG's monetization coefficients (the un-starred, period-end series), %, December | M2.1 | 1996–2025 |
| `loans.total`, `loans.gel`, `loans.fx` | Loans granted by banks, excluding interbank loans, including overdue loans and accrued interest; million GEL, December | L3.5 | 2002–2025 |
| `deposits.gel`, `deposits.fx` | All deposits in lari and in foreign currency; million GEL, December | D3.17 | 1996–2025 |
| `deposits.total`, `deposits.individuals`, `deposits.legal_entities` | Lari plus foreign currency, calculated from D3.17, D3.23 and D3.27 | D3.17, D3.23, D3.27 | 1996–2025, 2002–2025, 2015–2025 |
| `loans.fx_share`, `deposits.fx_share` | Foreign-currency amount ÷ total × 100, calculated | L3.5, D3.17 | 2002–2025, 1996–2025 |
| `rates.policy` | Monetary policy rate in force on 31 December, % | MPR | 2008–2025 |
| `rates.loans_total`, `_gel`, `_fx`; `rates.deposits_total`, `_gel`, `_fx` | NBG's annual weighted average interest rates: the contractual yearly rate of each loan or deposit, weighted by its amount, for the amounts outstanding at the end of the year; zero-rate and interbank items excluded, % | LWIR, DWIR | 1996–2025 |
| `banks.npl_ratio` | Non-performing loans to total gross loans (IMF methodology), % | FSI archive (Q4), FSI current (December) | 2003–2025 |
| `banks.roa`, `banks.roe` | Return on assets and on equity, % (may be negative) | FSI archive, FSI current | 2001–2025 |
| `banks.capital_ratio`, `banks.tier1_ratio` | Regulatory and Tier 1 capital to risk-weighted assets (Basel III), % | FSI archive, FSI current | 2014–2025 |

Each year holds one value: the December figure for amounts, ratios and bank health (the fourth-quarter value in the archive FSI file, 2001–2021), and for `rates.policy` the rate in force on 31 December. Amounts are stored in million GEL (`gel_million`) and ratios in percent (`percent`).

M0–M3 follow the definitions on the M2.1 `Notes` sheet: M0 is currency in circulation excluding cash in commercial banks' vaults; M1 adds lari transferable deposits of the resident non-financial sector and households; M2 adds lari term and savings deposits of the resident non-financial sector, other financial corporations and households; M3 adds their foreign-currency deposits. Deposit amounts include accrued interest, and NBG converts foreign-currency amounts into lari at the official month-end exchange rate.

All rows use `basis=actual`. `value_status` is `official` for transcribed cells and `calculated` for the 119 rows of the three deposit totals and the two foreign-currency shares. No other value is interpolated, rebased or derived.

## Identifiers

Indicator IDs are stable lowercase ASCII names in the form `group.name`, with the groups `money`, `loans`, `deposits`, `rates` and `banks`; the table above lists all 28. Source IDs are `nbg_*` (ten workbooks, four methodology PDFs, five API listings and the page capture) and series-break IDs are `fsi_method_2022` and `fsi_ifrs_2023`. Georgian and English labels are display data, never identifiers. `data/imports/money-banks-annual.csv` has one row per indicator and year, with the columns `year`, `indicator_id`, `value`, `published_value`, `unit`, `basis`, `value_status`, `source_id`, `source_sheet`, `source_cell` and `last_reviewed_at`. `value` keeps the stored precision and `published_value` rounds half-up to the printed format, using the value as Excel displays it (15 significant digits).

## Series boundaries

| Boundary | Handling |
| --- | --- |
| Policy instrument in 2008 | The MPR footnote says the 7-day certificate-of-deposit rate was the policy rate until 20 August 2008 and the 7-day refinancing instrument since then. The file starts in January 2008, so `rates.policy` starts in 2008; no earlier year is taken from another source. |
| Bank-health file change (`fsi_method_2022`, from 2022-01-01; bad loans and return on equity) | Values to 2021 come from the archive FSI file ("Calculated according to IMF methodology."), values from 2022 from the current file ("Data is calculated according to the 2019 FSI Methodology."). For 2022 the files agree on capital (20.3%), Tier 1 (17.1%) and return on assets (3.8%) but differ on bad loans (1.7% against 1.5%) and return on equity (30.2% against 24.8%). Neither file states why. |
| IFRS review (`fsi_ifrs_2023`, from 2023-01-01; all five bank-health measures) | The current file's note (FSD!B121) reads "Due to the implementation of the IFRS, data has been reviewed starting from 2023-01." Bad loans move from 1.51% in December 2022 to 3.10% in January 2023. |
| NBG's own deposit dollarization ratio | M2.1's "Dollarization Ratio of the Total Non-Bank Deposits" covers non-bank deposits only: 47.72% at December 2025 against 48.61% for `deposits.fx_share` from D3.17. The served share uses D3.17 so it agrees with the deposit amounts. |
| Microbanks | NBG's files state that the data were updated to include microbanks from January 2025. The series are not adjusted. |
| Missing years | Companies' deposits before 2015, the policy rate before 2008, bad loans before 2003 and capital before 2014 are gaps, never zero. |

Both bank-health breaks are recorded in `data/imports/money-banks-series-breaks.csv` in the demography break format. No change is computed across either break.

## Extraction and validation

`prepare.py` locates every column by its printed heading and every row by its date or year, takes only December (or Q4) values, and keeps each observation's source ID, sheet and cell. `python3 -B prepare.py --check` rebuilds every output and rejects a duplicate, missing or extra observation, a year outside an indicator's coverage, a published value that is not the stored value, as Excel displays it (15 significant digits), rounded half-up, a percent outside 0–100 (except return on assets and equity) or a negative amount, a calculated value that does not equal its inputs, loans in lari plus foreign currency differing from total loans by more than 0.01 (total deposits are that sum by construction), people plus companies differing from all deposits by more than 0.01 from 2015, M0 ≤ M1 ≤ M2 ≤ M3 failing, a 2022 FSI overlap that does not agree or differ as recorded, and an anchor value differing from NBG: M3 end-2025 57,680.2 million GEL, loans end-2025 72,453.0 million GEL, policy rate 8.00%, bad loans 2.5%, foreign-currency share of deposits 48.6% and of loans 41.9%. `node verify_independent.mjs` re-reads the ten workbooks with SheetJS and checks all 730 rows, with negative controls.

## Serving on the Money and banks pages

`npm run data:prepare-money` writes `data/imports/money-banks-annual.csv` (UTF-8 with BOM) and `data/reports/money-banks-validation.json`; `npm run data:check-money` (part of `data:validate`) rebuilds both in memory and fails on any difference. The Prisma mirror table `MoneyBanksFact` is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

The pages show the published value: one decimal for percents, two for the National Bank rate, and amounts in billion GEL with the site's GEL formatting; Excel keeps amounts in million GEL. Missing years are gaps, dashes and blank Excel cells, never zero. The pages describe the figures and state no causes.

Routes are `/explorer/money` with `/supply`, `/loans-deposits`, `/interest-rates` and `/bank-health`, plus `/methodology/money`, each mirrored under `/en`. The sidebar entry sits after Inflation.

- **Money supply**: M3, M2, M1 and M0, with a % of GDP icon switch that shows the same four series as a percentage of GDP: each December amount ÷ Fiscal.ge's national GDP at current prices (`data/imports/national-gdp-annual-1996-2025.csv`, the GDP of the budget and debt pages) × 100, calculated on the page with the debt page's share-of-GDP function and marked calculated. The source line names the GDP source and any preliminary GDP year (2025). NBG's `money.m3_to_gdp` and `money.m2_to_gdp` stay in the CSV and mirror but are not shown: NBG divides by an earlier GDP estimate, so they match the page's values to 2009 and differ by 0.4–1.1 points for M3 from 2010 (2025: 56.0% against 55.1%; M2 33.9% against 33.4%).
- **Loans and deposits**: Amount (loans and deposits together: totals with lari and foreign currency nested under them; deposits of people and of companies and organisations), with a share-in-foreign-currency icon switch.
- **Interest rates**: the National Bank rate and the loan and deposit rates.
- **Bank health**: bad loans, return on assets and on equity, and the two capital ratios in one list.

The two series breaks are explained on `/methodology/money` and no change is computed across either. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, the calculated status of the five derived series and of the % of GDP values, empty cells for missing values and validated links to the archived NBG workbooks (`data/methodology/source-archives/money.csv`); on % of GDP the Sources sheet also lists Geostat's GDP files, as on the debt page. Internal cell references are not exported. `/methodology/money` publishes all twenty originals; the HTML capture downloads as a `.txt` file.

## Statistical limitations and future use

Later integration must preserve annual frequency, the two bank-health breaks and the calculated status of the five derived series. Monthly or quarterly values, exchange rates, 2026 before December 2026 is published, and loans or rates by sector, region or maturity would each be a separately reviewed addition.

Original sources: the [NBG statistics page](https://nbg.gov.ge/en/statistics/statistics-data) and the files linked in the package README.
