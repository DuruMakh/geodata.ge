# Government Debt annual methodology

## Purpose and boundary

This methodology governs the research package at `docs/Raw Data/Debt/government-debt-annual/` and its narrow public serving projection at `data/imports/government-debt-facts-2013-2030.csv`. The serving CSV is generated deterministically from the four normalized package CSVs; it does not parse PDFs, fetch the network, or duplicate GDP.

The normalized concept is Government Debt: domestic Government Debt plus external Government Debt. The broader Public/State Debt total can also contain National Bank obligations and is not used as a replacement. Guaranteed-debt subtotals, on-lending service, PPP commitments and the separate central-government-liabilities workbook are also outside the normalized boundary.

No estimates were created. The package changes no pre-existing Fiscal.ge budget, GDP, or `spending.debt_service` data.

The projection serves exactly nine annual series: stock total/domestic/external (2013–2025), service total/principal/interest (actual 2013–2025 plus the 2026–2030 existing-portfolio snapshot), and rate total/domestic/external (2015–2025). It is mirrored by the transactional `GovernmentDebtFact` database import and checked row-for-row against the CSV before that import commits. The existing GDP file and the existing `spending.debt_service` expenditure data are unchanged.

## Observed coverage

| Dataset | Coverage | Rows | Availability |
| --- | --- | ---: | --- |
| Stock: 2013-2025 | Annual year-end | 39 | Total, domestic and external complete. |
| Actual service: 2013-2025 | Annual principal and interest paid | 39 | Total, domestic and external complete. |
| Interest rates: 2015-2025 | Annual year-end review grid | 33 | 22 published values and 11 documented gaps. |
| Forecast service: 2026-2030 | Existing portfolio as of 2025-12-31 | 15 | Total, domestic and external complete within the stated forecast boundary. |

Every panel is ordered by year and then `total`, `domestic`, `external`. Stock and actual-service totals are exact sums of the same-year components rather than copies of a rounded Public Debt total.

## Preserved official sources

The Ministry of Finance of Georgia is the publisher of all ten preserved files. `source-manifest.csv` is the machine-readable authority for titles, roles, official URLs, dates, hashes, byte sizes, full/used period bounds and source-use notes. The validator pins every one of these fields exactly and mutation-tests every manifest column.

| Source ID | Local capture | Canonical use | SHA-256 |
| --- | --- | --- | --- |
| `mof_public_debt_bulletin_n7` | `official/public-debt-bulletin-n7.pdf` | External actual service and domestic service overlap controls, 2013-2016; page 32. | `0FC59178E8910028A7773EE03E55EAE97AF4AC1E425F928544D87B0522CC66DA` |
| `mof_public_debt_bulletin_n13` | `official/public-debt-bulletin-n13.pdf` | Stock, 2013-2014, page 31; external actual service and domestic service overlap controls, 2017-2019, page 32. | `BB27879C4EDD5D24D8246E2EC05F1E1DBE7F8374FE09BC673397184060E19CC2` |
| `mof_public_debt_bulletin_n19` | `official/public-debt-bulletin-n19.pdf` | Stock overlap controls, 2015-2022, page 34; external actual service and domestic service overlap controls, 2020-2022, page 35. | `07BF09C8B3CFEC8FEBD9FDE89CC8BD40E7F2876B836A2B8459692CABC4A9D8BF` |
| `mof_public_debt_bulletin_n25` | `official/public-debt-bulletin-n25.pdf` | Stock, domestic/external actual service, domestic service overlap controls and forecast; pages 7, 17, 20, 22, 24, 26, 27 and 28. | `F4C3B267C0A351A09D723037CF666C949694FCF1764E0C3366B2EBC393AF35F0` |
| `mof_monthly_debt_report_2026_07` | `official/monthly-debt-report-2026-07.pdf` | Total weighted-average rate history, 2015-2025; page 3. | `EF71062CE4BF01042AEA5F5B9B86B783E6CF15E8D3A4A619FEE69415947FFF08` |
| `mof_debt_strategy_2019_2021` | `official/debt-management-strategy-2019-2021.pdf` | Domestic rate for 2018; page 14. | `140D7D9BA29747773603829533060D27E7F729E0AC575319C0385E25EC489399` |
| `mof_debt_strategy_2022_2025` | `official/debt-management-strategy-2022-2025.pdf` | Domestic rates for 2019-2020; page 23. | `3CBB9CB715DBBC7D7F5FA7324F78B2C72801AF296533194BE7CD2911C093572C` |
| `mof_debt_strategy_2023_2026` | `official/debt-management-strategy-2023-2026.pdf` | Domestic and external rates for 2021-2022; page 24. | `4E1FD16FB2C63289E572B38D44CAE867FF07E6100F8871E1DC9A38429F926EBB` |
| `mof_debt_strategy_2025_2029` | `official/debt-management-strategy-2025-2029.pdf` | Domestic and external rates for 2023-2024; page 28. | `FEDC578DA24DD7A49219216A1369FBD7F237F23B89866C036B0F6B69F83D133A` |
| `mof_central_government_liabilities_control` | `official/central-government-debt-liabilities-control.xlsx` | One-time 2019/2022 control only. | `F326A4ECA0ECBA67CEFDE22A07FF6AD47E2FDD19B31B93FEF686332A585D0EDC` |

The `official/` files are immutable captures. A future source update must be preserved separately with its observed URL, date, size and hash before it replaces any canonical input.

The package and its manifest keep bare document ids (`mof_public_debt_bulletin_n25`). Served facts, the mirror and the public `government-debt.csv` cite the source registry's form (`source.mof_public_debt_bulletin_n25`), the same ids `data/sources/source-documents.csv` registers; the mirror enforces them with a foreign key and the import rejects an unregistered id. Which documents a fact rests on — its own table, the external-service bulletin for actual service years, and every reviewed strategy for an unpublished rate — is defined once in `apps/web/lib/data/governmentDebt/sourceLineage.ts`.

## Stock normalization

Bulletin N13 page 31, table `16. PUBLIC DEBT STOCK`, supplies the published GEL domestic and external components for 2013-2014. Bulletin N25 page 26, table `17. Public Debt Stock`, supplies the components for 2015-2025. Source precision is retained in million GEL, and `amount_gel` is the rounded mechanical conversion `amount_million_gel * 1,000,000`.

Representative exact controls are:

| Year | Total | Domestic | External |
| ---: | ---: | ---: | ---: |
| 2013 | 8,433.0 | 1,337.8 | 7,095.2 |
| 2019 | 19,915.7 | 4,166.0 | 15,749.7 |
| 2022 | 28,587.3 | 7,195.3 | 21,392.0 |
| 2025 | 35,934.4 | 11,703.1 | 24,231.3 |

Published total rows can be rounded to whole millions. The normalized total is instead the exact sum of the published domestic and external components.

The validation report also records 39 stock overlap comparisons: all three scopes for N13 versus N25 in 2015-2019, and all three scopes for N19 versus N25 in 2015-2022. Every observed comparison is an exact source-precision match with a `0` million GEL difference. N25 remains canonical; if a future capture revises an overlap, the exact control value, canonical value and difference are reported as `revision` rather than silently replacing either source.

Each total is the exact sum of the published domestic and external components. The table's own "Total Government Debt" row, published in whole million GEL, is its control: generation fails if a component sum differs from it by more than 0.5 million GEL, and the comparisons are recorded in `validation-report.json` under `stock.totalControls`.

## Actual principal and interest paid

Domestic values come from Bulletin N25 page 20, `12. Debt Service`. For 2013-2018, the published principal and interest rows are used directly. For 2019-2025, the separately published principal and interest for `Loans of Budgetary Organizations` are added to those domestic rows. This addition is source aggregation, not estimation.

External values come from the `o/w Government External Debt` or `o/w External Government Debt` row in the consecutive `Net Flows & Net Transfers on Public Debt` tables: N7 page 32 for 2013-2016, N13 page 32 for 2017-2019, N19 page 35 for 2020-2022 and N25 page 27 for 2023-2025. These rows already publish the GEL conversion at transaction dates. National Bank and on-lending rows are excluded.

Representative total principal/interest values in million GEL are 692.2/232.9 for 2013, 2,296.75/604.9 for 2019, 2,504.39/753.3 for 2022 and 2,736.5/1,633.0 for 2025.

The domestic rows in the annual flow tables are retained as 13 independent overlap controls. N7/N13 publish whole-million controls, so their declared tolerance is 0.5 million GEL. N19/N25 publish one decimal, while the canonical page-20 series adds separately rounded budgetary-organization components, so their declared tolerance is 0.1 million GEL. `validation-report.json` records canonical/control principal and interest, both differences, source table/row, tolerance and status for every year. All current comparisons are `exact_match` or `within_source_precision`; any `unexplained_difference` stops generation.

## Weighted-average interest rates

The rate measure is the published year-end weighted-average annual portfolio rate. It is not calculated as interest paid divided by debt stock, and total is not an arithmetic average of domestic and external rates.

- Total 2015-2025 comes from the historical Government Debt chart in the July 2026 monthly report: `3.1, 3.3, 3.2, 3.3, 3.2, 2.8, 2.5, 3.9, 5.0, 4.9, 4.7` percent.
- Domestic values are 2018 `8.30`, 2019 `8.21`, 2020 `8.59`, 2021 `8.83`, 2022 `9.20`, 2023 `9.06` and 2024 `8.84` percent.
- External values are 2021 `0.95`, 2022 `2.23`, 2023 `3.40` and 2024 `3.12` percent.

The 11 documented gaps remain blank:

- domestic 2015-2017 and 2025;
- external 2015-2020 and 2025.

The 2018 strategy table reports External Debt and the Eurobond separately, while the 2019-2020 external rows explicitly exclude the Eurobond. Those values are not comparable with the full External Government Debt portfolio. No exact year-end 2025 component rate was found in the reviewed sources. Nothing is inferred from chart geometry, another rate or cash flows.

Rows with one explicit non-comparable table retain that strategy source. A gap found only after reviewing the complete source set leaves the row's single-source ID/table/label blank; the validation gap instead records the five reviewed rate-source IDs. The validator compares all 33 year/scope coordinates with an exact expected value/null, availability status and source ID and emits one deterministic pass/fail record per coordinate.

## Forecast normalization

The forecast is an existing-portfolio snapshot as of 2025-12-31:

- Bulletin N25 page 17 supplies External Government Debt principal and interest for 2026-2030 in million USD.
- N25 page 24 supplies domestic Treasury-security principal by redemption year.
- N25 page 22 supplies total domestic Treasury-security service; domestic interest is `total service - principal`, rounded to the source chart's one-decimal precision.
- N25 page 7 supplies `1 GEL = 0.3710 USD`. The calculation retains the reciprocal `1 USD = 2.6954177897574123 GEL` before multiplying external principal and interest.

| Payment year | External principal USDm | External interest USDm | Domestic principal GELm | Domestic interest GELm | Domestic total GELm |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2026 | 1,010.9 | 237.6 | 822.211 | 973.4 | 1,795.6 |
| 2027 | 512.6 | 218.3 | 1,539.249 | 879.1 | 2,418.3 |
| 2028 | 526.5 | 207.0 | 2,833.611 | 669.4 | 3,503.0 |
| 2029 | 521.3 | 194.4 | 1,413.474 | 536.5 | 1,950.0 |
| 2030 | 508.9 | 181.5 | 1,516.849 | 342.3 | 1,859.1 |

Domestic `total_service_million_gel` preserves the published chart total. Domestic interest is derived from that total and the more precise principal amount, then rounded to the chart's one-decimal precision; consequently, unrounded principal plus rounded interest can differ from published domestic total service by less than 0.05 million GEL. Total-scope principal and interest each sum their same-named domestic and external components, while total-scope `total_service_million_gel` separately sums the two component total-service fields. This preserves both the published domestic total and exact scope reconciliation.

The schedule excludes future borrowing, refinancing, FX changes, variable-rate changes and unscheduled domestic loan debt. A newer monthly stock report is not spliced into this schedule; replace the complete snapshot when a later full official year-end principal-and-interest schedule is available.

## Concise methodology changes

`methodology-notes.csv` carries only two notes:

- `government-domestic-2019-budget-organizations`: from 2019, domestic Government Debt additionally includes loan debt owed by budgetary organizations.
- `government-domestic-2022-general-government-soes`: from December 2022, domestic Government Debt also includes loan debt of state-owned enterprises classified in general government.

## Public methodology surface

The live public methodology stays deliberately concise. It identifies the series as Government Debt rather than the broader Public/State Debt total; discloses only the 2019 budgetary-organization and December 2022 general-government SOE boundary changes; and leaves the exact unpublished rate gaps empty (domestic 2015–2017 and 2025, external 2015–2020 and 2025). The 2026–2030 service values are labelled as the portfolio outstanding on 2025-12-31 and not as a full future-budget forecast. Its source archive publishes the ten reviewed official originals individually and in the standard validated archive; normalized CSVs, working notes and review outputs are not presented as originals.

The Ministry note that stock accounting moves to nominal value including accrued interest from 2026 is preserved in source metadata. It does not change this 2013-2025 stock output. A future 2026 stock row must carry an explicit comparability note.

## Existing GDP reuse

Debt-to-GDP review uses the existing national GDP dataset at `data/imports/national-gdp-annual-1996-2025.csv`. For each year:

```text
calculated share = total Government Debt (million GEL) / same-year GDP (million GEL) * 100
```

The normalized stock CSV does not duplicate GDP or a GDP-share column. `validation-report.json` stores the full-precision comparison, and the `Stock` worksheet displays review-only GDP inputs and formula results. Every 2013-2025 calculated total share is within 0.1 percentage point of the Ministry's published one-decimal Government-Debt-to-GDP ratio. A larger future difference must be reported as a possible GDP-vintage difference; neither source is silently changed.

## 2019 and 2022 control workbook

The central-government-liabilities workbook is a scope check only. The exact compared cells and normalized values are:

| Year | Scope | Canonical Government Debt | Control workbook | Cell |
| ---: | --- | ---: | ---: | --- |
| 2019 | Total | 19,915.7 | 20,569.7 | `Sheet2!AX6` |
| 2019 | Domestic | 4,166.0 | 4,827.0 | `Sheet2!AX9` |
| 2019 | External | 15,749.7 | 15,742.7 | `Sheet2!AX15` |
| 2022 | Total | 28,587.3 | 28,493.8 | `Sheet2!BJ6` |
| 2022 | Domestic | 7,195.3 | 7,105.1 | `Sheet2!BJ9` |
| 2022 | External | 21,392.0 | 21,388.7 | `Sheet2!BJ15` |

Equality is not expected because the control workbook organizes broader central-government liabilities by statistical residence/instrument concepts. It never supplies a normalized value and is not required for future annual updates.

## Validation and outputs

Generation fails if an approved source file is missing or any pinned manifest field differs, if a required PDF page marker or source row disappears, if a year/scope key is missing or duplicated, if an available value is negative/non-numeric, or if totals do not equal their components. The interest-rate validator checks the exact 33-coordinate value/null, availability and source map. The forecast validator checks every approved 2026-2030 external principal/interest input, domestic principal/interest/service input, the `0.3710` exchange rate, all source identities, nonnegative finite values and three-scope arithmetic.

The four normalized CSVs use fixed headers, UTF-8 with BOM, source-precision numbers and final newlines. `validation-report.json` records 39 stock rows, 39 stock overlap comparisons, 39 actual-service rows, 13 domestic-service overlap comparisons, 33 interest-rate rows/checks, 15 forecast rows, 30 forecast source checks, 10 verified source IDs, 13 GDP-share checks, both control years, `estimates_created: 0`, `source_hashes_match: true`, and the check-derived `normalized_values_reconcile: true`. Every exact rate/forecast check stores expected, observed, difference, tolerance, source reference and status. The package status is `complete_with_documented_rate_gaps`.

The seven-sheet `government-debt-review.xlsx` mirrors every normalized CSV field and type. Its two Stock review columns reuse existing GDP and calculate the ratio with `=IFERROR(Cn/Nn,"")`. The workbook is an internal review aid, not the future public Excel download.

External government service has no published total of its own — the bulletins' TOTAL rows combine public-debt service including NBG and on-lending — so `actualService.externalTotalControl` records `not_published` rather than implying a check.

## Reproducible rerun

From `apps/web`:

```powershell
npm run data:prepare-government-debt
npm run data:check-government-debt
npm test -- tests/data/governmentDebt/parseDebtSources.test.ts
npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts
npm run data:validate
```

`data:prepare-government-debt` reads only the preserved local captures, the approved manifest/notes and the existing national GDP CSV. It rewrites the four normalized CSVs, `validation-report.json`, and the 126-row serving projection at `data/imports/government-debt-facts-2013-2030.csv`. `data:check-government-debt` performs the same build in memory and fails on any byte-level difference in those outputs, including the serving CSV; it is part of the repository-wide `data:validate` gate. Neither command performs a network request, edits GDP, imports a database, changes UI, or rewrites the review workbook.
