# Annual money, banks, interest rates and bank health data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Money/nbg-money-banks-annual/`, collected on 2026-10-11 from the National Bank of Georgia (NBG) statistics page. The research captures are immutable. The 1,547 served values from 87 indicators (1,219 official, 328 calculated) appear on the Money and banks pages under the approved designs `docs/superpowers/specs/2026-10-11-money-banks-design.md` and, for loans by borrower, purpose and region, `docs/superpowers/specs/2026-10-21-loans-detail-design.md`; see [Serving on the Money and banks pages](#serving-on-the-money-and-banks-pages). Nothing is published through MCP or included in central machine-readable publications.

The user approved annual data only: money aggregates, bank loans and deposits, interest rates and bank-health measures. Exchange-rate statistics are excluded at the owner's request, as are monthly and quarterly values, 2026, and breakdowns by maturity. Loans by borrower, industry, household purpose and region were added on 2026-10-21 (see [Loans in detail](#loans-in-detail)). Foreign-currency amounts are NBG's lari values.

NBG is the sole publisher. Thirteen workbooks (the ten of 2026-10-11 and the three loan workbooks of [Loans in detail](#loans-in-detail)), four NBG methodology PDFs, five file listings from NBG's statistics API and the statistics page capture are preserved under `official/`. Exact URLs, retrieval times, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the package README holds the full cell map.

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

All rows use `basis=actual`. `value_status` is `official` for transcribed cells and `calculated` for 328 rows: the 119 rows of the three deposit totals and the two foreign-currency shares, the 77 household-purpose totals and the 132 regional all-loans totals. No other value is interpolated, rebased or derived.

## Identifiers

Indicator IDs are stable lowercase ASCII names in the form `group.name`, with the groups `money`, `loans`, `deposits`, `rates` and `banks`; the table above lists the 28 of the original package, and [Loans in detail](#loans-in-detail) the 59 added for loans by borrower, purpose and region. Source IDs are `nbg_*` (thirteen workbooks, four methodology PDFs, five API listings and the page capture) and series-break IDs are `fsi_method_2022`, `fsi_ifrs_2023`, `loans_activity_2014`, `loans_overdue_2015`, `loans_sector_2022` and `loans_microbanks_2025`. Georgian and English labels are display data, never identifiers. `data/imports/money-banks-annual.csv` has one row per indicator and year, with the columns `year`, `indicator_id`, `value`, `published_value`, `unit`, `basis`, `value_status`, `source_id`, `source_sheet`, `source_cell` and `last_reviewed_at`. `value` keeps the stored precision and `published_value` rounds half-up to the printed format, using the value as Excel displays it (15 significant digits).

## Series boundaries

| Boundary | Handling |
| --- | --- |
| Policy instrument in 2008 | The MPR footnote says the 7-day certificate-of-deposit rate was the policy rate until 20 August 2008 and the 7-day refinancing instrument since then. The file starts in January 2008, so `rates.policy` starts in 2008; no earlier year is taken from another source. |
| Bank-health file change (`fsi_method_2022`, from 2022-01-01; bad loans and return on equity) | Values to 2021 come from the archive FSI file ("Calculated according to IMF methodology."), values from 2022 from the current file ("Data is calculated according to the 2019 FSI Methodology."). For 2022 the files agree on capital (20.3%), Tier 1 (17.1%) and return on assets (3.8%) but differ on bad loans (1.7% against 1.5%) and return on equity (30.2% against 24.8%). Neither file states why. |
| IFRS review (`fsi_ifrs_2023`, from 2023-01-01; all five bank-health measures) | The current file's note (FSD!B121) reads "Due to the implementation of the IFRS, data has been reviewed starting from 2023-01." Bad loans move from 1.51% in December 2022 to 3.10% in January 2023. |
| NBG's own deposit dollarization ratio | M2.1's "Dollarization Ratio of the Total Non-Bank Deposits" covers non-bank deposits only: 47.72% at December 2025 against 48.61% for `deposits.fx_share` from D3.17. The served share uses D3.17 so it agrees with the deposit amounts. |
| Microbanks | NBG's files state that the data were updated to include microbanks from January 2025. The series are not adjusted. |
| Missing years | Companies' deposits before 2015, the policy rate before 2008, bad loans before 2003 and capital before 2014 are gaps, never zero. |

The two bank-health breaks and the four loan breaks of [Loans in detail](#loans-in-detail) are recorded in `data/imports/money-banks-series-breaks.csv` (six rows) in the demography break format. No change is computed across any of them.

## Loans in detail

Approved on 2026-10-21 (`docs/superpowers/specs/2026-10-21-loans-detail-design.md`). Three further NBG loan workbooks were downloaded on 2026-10-21 for the design and again on 2026-10-24 (byte for byte the same files) and join the package, which then holds thirteen workbooks. They add 59 indicators and 817 observations, 1,547 in all, to the canonical CSV and the mirror, and two pages, Who borrows (`/explorer/money/borrowers`) and Loans by region (`/explorer/money/regions`). Each series is a December outstanding amount in million GEL, annual only.

| Source ID | NBG table | What it counts | Served |
| --- | --- | --- | --- |
| `nbg_loans_structure_l3_10_1` | L3.10.1, sheet `Total` | Loans to the national economy, principal only, to resident sectors: all loans, businesses and their eleven industries (NACE Rev.2, by the borrower's main activity), households, individuals and individual entrepreneurs | `borrowers.*`, 2003–2025 (households and individual entrepreneurs from 2015) |
| `nbg_loans_purpose_lop` | LOP, sheet `HH` | Loans of households (individuals and individual entrepreneurs) by purpose, in lari and in foreign currency, principal only; the table also counts loans to non-residents | `households.purpose.*`, 2015–2025 |
| `nbg_loans_regions_lreg` | LREG, sheets `NC` and `FC` | Bank loans by region in lari and in foreign currency, to all sectors and non-residents, including counterpart banks and the government | `loans_region.*`, 2015–2025 |

**Three different loan totals.** L3.10.1 counts principal only: 69,035.7 million GEL at end-2025. L3.5 (`loans.total`, the Loans and deposits page) also counts accrued interest: 72,453.0. LREG covers loans to non-residents and counterpart banks as well: 71,780.2 (41,698.7 in lari and 30,081.5 in foreign currency). Each table's parts add up to its own total, so the three totals are not compared with each other, and each page uses the total of its own table. LOP's seven household purposes also include non-residents, so they add up to a little more than L3.10.1's Households figure (38.2 billion GEL against 37.4 in 2025); they are a split by purpose, not parts of Households.

**Indicators.**

- `borrowers.total`, `.businesses`, `.households`, `.people` and `.individual_entrepreneurs`, and `borrowers.industry.<agriculture, industry, construction, trade, hotels_restaurants, transport_communications, financial, real_estate, education, health_social, other_services>`: L3.10.1 `Total`. NBG publishes Households, and its split into people and individual entrepreneurs, only from December 2015; before that People plus Businesses equals all loans. Households and individual entrepreneurs therefore start in 2015, and nothing is filled in for earlier years.
- `households.purpose.<consumer, home, sme, large_business, car, pawn, other>`: calculated as LOP `HH`, the purpose's lari row plus its foreign-currency row (77 values). NBG's definitions: mortgage loans are for the purchase, construction or renovation of property; auto loans for the purchase of motor vehicles, typically secured by the vehicle; Lombard (pawn) loans against the pledge of easily realizable movable property; consumer loans are granted to households for various needs; business loans for large enterprises and for SMEs finance commercial and business activities of such enterprises, sized by employees, turnover or total assets; other loans are those outside these categories, including credit cards, overdrafts, instalments and loans with unidentified purposes.
- `loans_region.<georgia, region_<id>>.gel` and `.fx`: LREG `NC` and `FC`, the `Total` row (Georgia) or the region's row, for the eleven regions of the site; `.total` is calculated (132 values) as `NC` plus `FC`. NBG's Abkhazeti row is present with no values and is not served. A region is where the lending bank's branch or service centre is, not where the borrower lives or works (LREG `Notes`).

**Four breaks.** Each is recorded in `data/imports/money-banks-series-breaks.csv` with NBG's footer sentence and its cell; the pages draw no gap at a break, no change is computed across one, and Excel marks a break year in the status column.

| Break | From | Series | What NBG changed |
| --- | --- | --- | --- |
| `loans_activity_2014` | 2014-06-01 | the eleven industries | Banks updated their clients' economic-activity data, which moved existing loans between industries (L3.10.1 `Total`!B283) |
| `loans_overdue_2015` | 2015-12-01 | everything on Who borrows | Overdue loans are included from 1 December 2015; Households and individual entrepreneurs are published separately from then (L3.10.1 B284, LOP `HH`!A27, LREG A20) |
| `loans_sector_2022` | 2022-09-01 | businesses, households, people, individual entrepreneurs, the industries, and the SME and large-enterprise purposes | A unified register of legal entities, NACE Rev.2 and the Eurostat size method changed how borrowers are sorted into sectors and sized; NBG says the legal entities' total portfolio was not affected (L3.10.1 B285, LOP `HH`!A28). LOP's footer names business loans and SME loans as determined by the new method, so those two purposes carry this break although the design's table named only the sector series |
| `loans_microbanks_2025` | 2025-01-01 | all loan-detail series | The data were updated to include microbanks from January 2025 (L3.10.1 B286, LOP A29, LREG A21) |

**Sums and checks.** The preparation script rejects, in any year, businesses plus people differing from all loans by more than 0.5 million GEL up to 2014 (businesses plus households from 2015), people plus individual entrepreneurs differing from households from 2015, the eleven industries differing from businesses, an area's lari plus foreign currency differing from its total, and the eleven regions differing from Georgia's lari or foreign-currency amount. The loan tables print whole thousands of lari in million GEL, so parts add up within rounding. Anchors for 2025: all loans 69,035.7 and households 37,355.4 (L3.10.1), Georgia 71,780.2 and Tbilisi 52,420.1 (LREG).

**Pages.** Who borrows (2003–2025) has one list of 23 rows under three headings (Who borrows, Businesses by industry, What households borrow for), with all loans selected, and shows the 2025 line "all loans 69.0 billion GEL". Loans by region is a map and ranked list of the eleven regions' all loans in the latest year all eleven have (2025, Tbilisi 52.4 billion GEL), with Georgia as a first, unranked row; each opens an area page (Georgia and the eleven regions, 2015–2025) with all loans, loans in lari and loans in foreign currency in million GEL. Both are outside `/mcp` and the JSON publications, like the rest of Money and banks. Excel follows the three-sheet pattern; on area pages the area is in the file name (`fiscal-money-loans-region-imereti-2015-2025-en.xlsx`).

## Extraction and validation

`prepare.py` locates every column by its printed heading and every row by its date or year, takes only December (or Q4) values, and keeps each observation's source ID, sheet and cell. `python3 -B prepare.py --check` rebuilds every output and rejects a duplicate, missing or extra observation, a year outside an indicator's coverage, a published value that is not the stored value, as Excel displays it (15 significant digits), rounded half-up, a percent outside 0–100 (except return on assets and equity) or a negative amount, a calculated value that does not equal its inputs, loans in lari plus foreign currency differing from total loans by more than 0.01 (total deposits are that sum by construction), people plus companies differing from all deposits by more than 0.01 from 2015, M0 ≤ M1 ≤ M2 ≤ M3 failing, a 2022 FSI overlap that does not agree or differ as recorded, and an anchor value differing from NBG: M3 end-2025 57,680.2 million GEL, loans end-2025 72,453.0 million GEL, policy rate 8.00%, bad loans 2.5%, foreign-currency share of deposits 48.6% and of loans 41.9%. `node verify_independent.mjs` re-reads the thirteen workbooks with SheetJS and checks all 1,547 rows, with negative controls.

## Serving on the Money and banks pages

`npm run data:prepare-money` writes `data/imports/money-banks-annual.csv` (UTF-8 with BOM) and `data/reports/money-banks-validation.json`; `npm run data:check-money` (part of `data:validate`) rebuilds both in memory and fails on any difference. The Prisma mirror table `MoneyBanksFact` is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

The pages show the published value: one decimal for percents, two for every interest rate, and amounts in billion GEL with the site's GEL formatting; Excel keeps amounts in million GEL. NBG prints all interest rates to two decimals (every loan and deposit rate cell in the LWIR and DWIR workbooks is formatted `0.00`, as is the policy rate). Until 2026-10-13 only the National Bank rate was published with two; the 180 loan and deposit rate values now are too (2010 loans, all currencies: 18.6% → 18.56%). Missing years are gaps, dashes and blank Excel cells, never zero. The pages describe the figures and state no causes.

Routes are `/explorer/money` with `/supply`, `/loans-deposits`, `/borrowers`, `/regions` (the index of twelve area pages, `/regions/<slug>` for Georgia and the eleven regions), `/interest-rates` and `/bank-health`, plus `/methodology/money`, each mirrored under `/en`. The sidebar entry sits after Inflation and lists the six pages in that order.

- **Money supply**: M3, M2, M1 and M0, with a % of GDP icon switch that shows the same four series as a percentage of GDP: each December amount ÷ Fiscal.ge's national GDP at current prices (`data/imports/national-gdp-annual-1996-2025.csv`, the GDP of the budget and debt pages) × 100, calculated on the page with the debt page's share-of-GDP function and marked calculated. The source line names the GDP source and any preliminary GDP year (2025). NBG's `money.m3_to_gdp` and `money.m2_to_gdp` stay in the CSV and mirror but are not shown: NBG divides by an earlier GDP estimate, so they match the page's values to 2009 and differ by 0.4–1.1 points for M3 from 2010 (2025: 56.0% against 55.1%; M2 33.9% against 33.4%).
- **Loans and deposits**: Amount (loans and deposits together: totals with lari and foreign currency nested under them; deposits of people and of companies and organisations), with a share-in-foreign-currency icon switch.
- **Who borrows** and **Loans by region**: described under [Loans in detail](#loans-in-detail).
- **Interest rates**: the National Bank rate and the loan and deposit rates.
- **Bank health**: bad loans, return on assets and on equity, and the two capital ratios in one list.

The two series breaks are explained on `/methodology/money` and no change is computed across either. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, the calculated status of the five derived series and of the % of GDP values, empty cells for missing values and validated links to the archived NBG workbooks (`data/methodology/source-archives/money.csv`); on % of GDP the Sources sheet also lists Geostat's GDP files, as on the debt page. Internal cell references are not exported. `/methodology/money` publishes all twenty-three originals; the HTML capture downloads as a `.txt` file.

## Statistical limitations and future use

Later integration must preserve annual frequency, the six recorded breaks and the calculated status of every derived series. Monthly or quarterly values, exchange rates, 2026 before December 2026 is published, interest rates by maturity, sector or region, loans by currency within an industry or purpose, loans to legal entities by purpose (LOP sheet `LE`) and flows such as new lending during the year would each be a separately reviewed addition.

Original sources: the [NBG statistics page](https://nbg.gov.ge/en/statistics/statistics-data) and the files linked in the package README.
