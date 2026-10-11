# Money and banks hub

Date: 2026-10-11
Status: Approved by Duru on 2026-10-11 (decision card "Approve the Money and banks design document?"). Duru picked banking and money-supply statistics from the National Bank of Georgia (NBG) on 2026-10-11, ruled out exchange-rate statistics, chose four pages including bank health ("Add bank health" card), and approved the page layout ("Approve this layout" card). This document covers both the data foundation and the pages.

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, how much money circulates in Georgia, how much banks lend and hold in deposits, how much of it is in foreign currency, what borrowing and saving cost, and how healthy the banks are.

The pages answer five questions:

- How much money is there, and how large is it compared with the economy? (Broad money M3: 179 million GEL at the end of 1995, 57.7 billion at the end of 2025.)
- How fast have bank loans and deposits grown? (Loans: 0.6 billion GEL in 2002, 72.5 billion in 2025.)
- How much of it is in foreign currency? (Loans: 84% in 2002, 42% in 2025. Deposits: 79% in 2000, 49% in 2025.)
- What are the National Bank's rate and the rates banks charge and pay? (National Bank rate 8.00% at the end of 2025.)
- Are banks healthy? (Bad loans 2.5% of loans, return on equity 22.9% and capital ratio 22.2% in 2025.)

The pages keep the production editorial look and reuse the Poverty and Wages workspace, tabs, series list, table and Excel download. No new chart type, chart library or visual direction is added. No exchange-rate series is served.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/money` | `/en/explorer/money` | ფული და ბანკები |
| Money supply | `/explorer/money/supply` | `/en/explorer/money/supply` | ფულის მასა |
| Loans and deposits | `/explorer/money/loans-deposits` | `/en/explorer/money/loans-deposits` | სესხები და დეპოზიტები |
| Interest rates | `/explorer/money/interest-rates` | `/en/explorer/money/interest-rates` | საპროცენტო განაკვეთები |
| Bank health | `/explorer/money/bank-health` | `/en/explorer/money/bank-health` | ბანკების მდგრადობა |
| Methodology | `/methodology/money` | `/en/methodology/money` | ფული და ბანკები |

- The hub has four clickable cards with coverage years and a small chart of each page's first series, reusing the Poverty hub cards.
- The sidebar places **Money and banks** directly after Inflation. Its four pages show beneath it when the section is active, as Poverty's pages do.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- The Georgian names are proposals; final wording follows the bilingual catalogue conventions.

## 3. Shared page rules

These apply to all four pages, exactly as on Poverty:

- Under the heading there is one short line from `LatestValueLine` (wording in each page section). Nothing else sits under the heading, and the only text under the chart is one short source line.
- Tabs are centred text tabs. Each tab has its own series list. Switching tabs selects that tab's first series alone and keeps the year range, clamped to the new tab's years.
  > Changed after preview review (Duru, 2026-10-11): no page has a tab row. Money supply and Loans and deposits switch measures with an icon-only control in the chart toolbar (DESIGN.md §7.2a), carrying matching series across; Interest rates and Bank health have one list each.
- The first series of the first tab is selected on arrival and stays first, selectable and removable. Selection is unlimited.
- Chart | Table, the year range and Excel work as on Poverty. Tab, range, selection and chart/table mode live in the URL and survive a language change.
- Every series has a fixed, distinguishable colour, and labels identify every series without colour.
- A year without a value (for example companies' deposits before 2015) is a gap in the chart, a dash in the table and a blank Excel cell, never zero.
- Every tab mixes only one unit, so any combination of ticks shares one axis.
- **Yearly values only.** Amounts and ratios are the December (year-end) value; interest rates on loans and deposits are NBG's annual weighted average interest rates (the contractual yearly rate, weighted by the amounts outstanding at the end of the year); the National Bank rate is the rate in force on 31 December. The last year shown is 2025. 2026 is added once December 2026 is published.
- The source line reads like the others, for example: "Source: National Bank of Georgia · million GEL, end of year · 1995–2025 · Methodology and sources".

## 4. Money supply page

Line under the heading: "2025: broad money (M3) 57.7 billion GEL".

**Amount | Compared with GDP**

| Tab | Series (selected first in bold) | Years | Unit |
| --- | --- | --- | --- |
| Amount | **Broad money (M3)**, Broad money in lari (M2), Narrow money (M1), Cash outside banks (M0) | 1995–2025 | million GEL |
| Compared with GDP | **Broad money (M3) to GDP**, Broad money in lari (M2) to GDP | 1996–2025 | % |

The GDP ratios are NBG's own published "monetization coefficients" at period end, not calculated by fiscal.ge.

> Changed after preview review (Duru, 2026-10-11): no tab row; an icon-only switch on the chart toolbar (`₾` / `ChartPie`) switches between the amounts and the two ratios, carrying M3 and M2 across.

> Changed after preview review (Duru, 2026-10-11): % of GDP shows all four series, M3, M2, M1 and M0, with the same ids as the amounts, so the selection stays when switching. Each value is the December amount ÷ Fiscal.ge's national GDP at current prices × 100, using the debt page's GDP facts and share-of-GDP calculation; it is marked calculated (Excel status), the source line names the GDP source and preliminary GDP years, and Excel's Sources sheet adds Geostat's GDP files. The latest-value line on % of GDP reads M3's value (2025: 55.1%). NBG's own ratios (`money.m3_to_gdp`, `money.m2_to_gdp`) stay in the dataset, CSV and mirror but are no longer shown; they use an earlier GDP estimate, so they match before 2010 and differ by 0.4–1.1 points from 2010 (56.0% against 55.1% for M3 in 2025). This supersedes the table row and the sentence above for Compared with GDP.

## 5. Loans and deposits page

Line under the heading: "2025: bank loans 72.5 billion GEL".

**Loans | Deposits | Share in foreign currency**

| Tab | Series (selected first in bold) | Years | Unit |
| --- | --- | --- | --- |
| Loans | **All loans**, with In lari and In foreign currency nested under it | 2002–2025 | million GEL |
| Deposits | **All deposits**, with In lari and In foreign currency nested under it; then Deposits of people (2002–2025) and Deposits of companies and organisations (2015–2025) | 1996–2025 | million GEL |
| Share in foreign currency | **Loans**, Deposits | Loans 2002–2025, deposits 1996–2025 | % |

> Changed after preview review (Duru, 2026-10-11): two tabs: Amount (loans then deposits, with **All loans** and **All deposits** both selected) and Share in foreign currency.

> Changed after preview review (Duru, 2026-10-11): no tabs; an icon-only measure switch on the chart toolbar (`₾` Amount, `CircleDollarSign` Share in foreign currency, as % of GDP became a `ChartPie` icon on Money supply) carries any loan to the loans share and any deposit to the deposits share, and each share back to its total.

- Loans are NBG table L3.5 (loans granted by banks, excluding interbank loans, including overdue loans and accrued interest). Deposits are NBG table D3.17 (all deposits in banks). People are table D3.23 and companies and organisations ("legal entities") table D3.27; the two add up exactly to D3.17's total from 2015. NBG publishes each deposit table as a lari sheet and a foreign-currency sheet, so the three deposit totals (all, people, companies) are lari + foreign currency added up by fiscal.ge and marked as calculated.
- The foreign-currency share is foreign-currency amount ÷ total amount from those same tables, calculated by fiscal.ge, so the Share tab always agrees with the Loans and Deposits tabs. NBG's own dollarization ratio counts non-bank deposits only, and table D3.17 also includes banks' deposits, so the two differ (47.7% against 48.6% at the end of 2025); the methodology page says so.
- Foreign-currency amounts are NBG's lari values at the end-of-month official rate. No exchange rate is served.

## 6. Interest rates page

Line under the heading: "2025: National Bank rate 8.00%". The National Bank rate shows two decimals (it moves in steps of 0.25); every other percent on the four pages shows one decimal, and amounts use the site's usual billion/million GEL formatting.

No tabs. One chart, all in percent per year:

- **National Bank rate** (2008–2025): the rate in force on 31 December.
- Loans: Average rate on loans, with In lari and In foreign currency nested under it (1996–2025).
- Deposits: Average rate on deposits, with In lari and In foreign currency nested under it (1996–2025).

The loan and deposit rates are what NBG publishes as annual weighted average interest rates (tables LWIR and DWIR): each loan's or deposit's contractual yearly rate, weighted by its amount, for the amounts outstanding at the end of the year, excluding zero-rate items and interbank loans and deposits. The methodology notes that before 20 August 2008 NBG used the 7-day certificate-of-deposit rate as its policy rate, and the refinancing rate after; the chart starts in 2008 because the NBG file starts in January 2008.

## 7. Bank health page

Line under the heading: "2025: bad loans 2.5% of all loans".

**Bad loans | Profits | Capital**

| Tab | Series (selected first in bold) | Years |
| --- | --- | --- |
| Bad loans | **Bad loans, share of all loans** | 2003–2025 |
| Profits | **Return on equity**, Return on assets | 2001–2025 |
| Capital | **Capital to risk-weighted assets**, Tier 1 capital to risk-weighted assets | 2014–2025 |

> Changed after preview review (Duru, 2026-10-11): no tabs; one list of **bad loans**, return on assets, return on equity, capital and Tier 1 (2001–2025, capital a gap before 2014).

All values are percent. They are NBG's Financial Soundness Indicators, which follow the IMF method: Q4 values from the archive file for 2001–2021 and December values from the current file for 2022–2025. "Bad loans" is NBG's "non-performing loans to total gross loans" by the IMF method (the archive's NBG-method series, which runs higher, is not served). Capital uses the Basel III series, which starts in 2014; the older Basel I series is not served.

**Two changes in the bank-health files.** Values to 2021 come from NBG's archive file and values from 2022 from the current file, which follows the 2019 IMF FSI methodology. For 2022 the two files agree on capital and return on assets, but give different values for bad loans (1.7% archive against 1.5% current) and return on equity (30.2% against 24.8%). Separately, the current file says its data were reviewed from January 2023 because of IFRS implementation; bad loans moved from 1.5% in December 2022 to 3.1% in January 2023. The page draws one line per measure. The data records both breaks in `data/imports/money-banks-series-breaks.csv` (`fsi_method_2022` for bad loans and return on equity from 2022, `fsi_ifrs_2023` for all five measures from 2023), as the demography data does for the 2025 census, and the methodology page explains them. No change across a break is computed anywhere.

## 8. Data foundation

### Sources

All files come from NBG's statistics page (`https://nbg.gov.ge/en/statistics/statistics-data`), whose file list comes from `GET https://nbg.gov.ge/gw/api/ct/statistics/categories/{id}/data` with `Accept-Language: en`. Checked from the cloud workspace on 2026-10-11; all downloaded directly.

| NBG code | File | Used for | Served values |
| --- | --- | --- | --- |
| M2.1 | `money-aggregates-and-monetary-ratioseng.xlsx` | M3, M2, M1, M0 (Dec 1995–2025); M3 and M2 to GDP (Dec 1996–2025) | 4 × 31 + 2 × 30 = 184 |
| L3.5 | `loans-to-the-economy-l3-5eng.xlsx` | All loans, in lari, in foreign currency (Dec 2002–2025) | 3 × 24 = 72 |
| D3.17 | `depositsinterest-rates-d3-17eng.xlsx` | All deposits, in lari, in foreign currency (Dec 1996–2025) | 3 × 30 = 90 |
| D3.23 | `deposits-of-individuals-d3-23eng.xlsx` | Deposits of people (Dec 2002–2025) | 24 |
| D3.27 | `deposits-of-legal-entities-d3-27eng.xlsx` | Deposits of companies and organisations (Dec 2015–2025) | 11 |
| — | calculated from L3.5 and D3.17 | Foreign-currency share of loans and deposits | 24 + 30 = 54 |
| MPR | `mpireng.xlsx` | National Bank rate in force on 31 Dec (2008–2025) | 18 |
| LWIR | `annual-weighted-loans-interest-rates-lwireng.xlsx` | Loan rates: total, lari, foreign currency (1996–2025) | 90 |
| DWIR | `annual-weighted-deposit-interest-rates-dwireng.xlsx` | Deposit rates: total, lari, foreign currency (1996–2025) | 90 |
| FSI (archive) | `fsieng-archive.xlsx` | Bank health, Q4 2001–2021 | 77 |
| FSI | `fsieng.xlsx` | Bank health, Dec 2022–2025 | 20 |

About 730 served values in total. The research package also keeps the API listings and the NBG methodology PDFs for these tables.

### Research package

`docs/Raw Data/Money/nbg-money-banks-annual/` follows the Poverty package: original files under `official/`, a source manifest (URL, retrieval time, SHA-256, size), a `prepare.py` that transcribes every used cell with its sheet and cell reference, an independent verification script, a validation report and a coverage file. The originals are never edited.

### Canonical file and checks

- `npm run data:prepare-money` writes `data/imports/money-banks-annual.csv` (UTF-8 with BOM) and `data/reports/money-banks-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value, unit (`gel_million` or `percent`), `basis=actual`, value status (`official`, or `calculated` for the three deposit totals and the two foreign-currency shares), source ID, sheet and cell. The bank-health breaks are recorded in `data/imports/money-banks-series-breaks.csv` in demography's break format.
- Stable lowercase IDs, for example `money.m3`, `money.m2`, `money.m1`, `money.m0`, `money.m3_to_gdp`, `money.m2_to_gdp`, `loans.total`, `loans.gel`, `loans.fx`, `loans.fx_share`, `deposits.total`, `deposits.gel`, `deposits.fx`, `deposits.individuals`, `deposits.legal_entities`, `deposits.fx_share`, `rates.policy`, `rates.loans_total`, `rates.loans_gel`, `rates.loans_fx`, `rates.deposits_total`, `rates.deposits_gel`, `rates.deposits_fx`, `banks.npl_ratio`, `banks.roa`, `banks.roe`, `banks.capital_ratio`, `banks.tier1_ratio`.
- Validation rejects a changed value, a missing, extra or duplicate observation, and a year outside each table's coverage. It also checks:
  - lari + foreign currency equals the total, within rounding, for loans and deposits every year;
  - people + companies equals all deposits, within rounding, every year from 2015;
  - M0 ≤ M1 ≤ M2 ≤ M3 every year;
  - every percent lies within 0–100, except return on assets and equity, which may be negative (they were in 2008);
  - capital and return on assets for 2022 agree between the archive and current FSI files, and the recorded 2022 breaks exist for bad loans and return on equity;
  - a few anchor values match what NBG shows: M3 end-2025 57,680.2 million GEL; loans end-2025 72,453.0 million GEL; National Bank rate 8.00% at the end of 2025; bad loans 2.5% in 2025.
- No interpolation, rebasing or other derived figures beyond the three deposit totals and the two foreign-currency shares. The % of GDP values (§4, changed after preview review) are calculated on the page from the served GDP, not stored.

### Serving

- All pages stay prerendered. The CSV loader and a numeric client projection follow Poverty.
- The private Supabase mirror gets a `MoneyBanksFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`, like Poverty. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 9. Sources, Excel and methodology

- The NBG workbooks and methodology PDFs are published through the existing source archive (`data/methodology/source-archives/money.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language: the active tab's selected series and years, explicit units, blank missing cells, the "calculated by fiscal.ge" status on the deposit totals and the two shares, and validated source links. It has no internal identifier or cell-reference columns.
- `/methodology/money` explains in plain words: what M0–M3 are (NBG's definitions), what "end of year" and NBG's "annual weighted average interest rate" mean here, which banks the tables cover, how foreign-currency amounts are turned into lari, how the foreign-currency share is calculated and how it differs from NBG's ratio, the 2008 change of policy instrument, what each bank-health measure means, the two bank-health breaks (2022 file change, 2023 IFRS review), and that the pages state no causes.

## 10. Out of scope

Exchange rates (Duru's decision), monthly or quarterly values, 2026 before its year is complete, loans by sector, region or purpose, interest rates by maturity, microfinance organisations, treasury securities, external debt and reserves, payment cards, forecasts, causes, MCP tools and the central JSON/CSV publications. Each would need its own approval.

## 11. Verification

1. The canonical file reproduces every served value from the original cells; the independent verification passes; CSV and database modes agree.
2. Defaults, tabs, nesting, tab switching, gaps (companies' deposits before 2015, the National Bank rate before 2008, capital before 2014) and URL state behave as in sections 3–7, with the 2025 values given there.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, with keyboard use and language switching keeping the settings.
5. A live preview goes to Duru first. After Duru approves it, run `npm run check`, `npm run build` and `npm run test:browser` once, then push and open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Money and banks item), `DESIGN.md` (the hub and four pages) and a new `docs/data-methodology/money-banks-annual.md`.

## 12. Reuse

- **Used as is:** `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector` and `SeriesSelectorRow` (with nested rows), `SegmentedTabs`, `SourceNote`; the three-sheet Excel writer and `ExcelDownloadButton`; the source-archive and methodology components; the generated-artifact and served-rows parity checks; the series-break record format used by demography.
- **Small additions:** the sidebar, footer source note, sitemap, methodology catalogue and source inventory get the new section; the import script and mirror read and compare the new table.
- **New** (each mirrors its Poverty counterpart file by file; Poverty's model is tied to its own indicators, groups and survey status, so it cannot simply be pointed at this data): the research package and `prepare-money` script; the Prisma model and migration; `lib/data/moneyBanks/*`; `lib/explorer/moneyBanks.ts`, `moneyBanksWorkbook.ts`, `moneyBanksHubCards.ts`; `components/money-banks/money-banks-explorer.tsx`; `lib/pages/moneyBanks.tsx`, the routes and messages; the methodology content and `docs/data-methodology/money-banks-annual.md`.

## 13. Coordination

No other hub thread is running. The branch starts from the latest `main` (Poverty, PR #174, merged).

## 14. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request, deployment or live database changes; a live preview comes first.
