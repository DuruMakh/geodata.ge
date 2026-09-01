# Government Debt annual research package

## What this package contains

This is a source-backed preparation package for a future Fiscal.ge Government Debt section. It uses the Ministry of Finance of Georgia's Government Debt rows, not the broader Public/State Debt total.

- Stock: 2013-2025 — year-end total, domestic and external Government Debt (39 rows).
- Actual service: 2013-2025 — principal and interest paid for total, domestic and external Government Debt (39 rows).
- Interest rates: 2015-2025 — an annual three-scope review grid with 22 published values and 11 documented gaps (33 rows).
- Forecast service: 2026-2030 — principal and interest for the existing portfolio as of 2025-12-31 (15 rows).

Government Debt total is always the exact sum of its domestic and external components. Broader Public Debt rows, National Bank debt, guaranteed-debt subtotals, on-lending service, PPP commitments and the control-only central-government-liabilities workbook are not substituted for Government Debt values.

No estimates were created. The package changes no served Fiscal.ge data.

No UI, route, database, or public-data import was added. The existing `spending.debt_service` expenditure series remains unchanged.

## Files

| File | Purpose |
| --- | --- |
| `government-debt-stock-annual-2013-2025.csv` | Canonical annual Government Debt stock. |
| `government-debt-service-actual-annual-2013-2025.csv` | Canonical annual principal and interest paid. |
| `government-debt-interest-rates-annual-2015-2025.csv` | Published weighted-average rates plus explicit blanks. |
| `government-debt-service-forecast-2026-2030.csv` | Existing-portfolio payment schedule from the 2025-12-31 snapshot. |
| `government-debt-review.xlsx` | Seven-sheet internal review workbook with CSV parity, GDP review formulas, controls and sources. |
| `validation-report.json` | Row counts, hashes, 39 stock and 13 actual-service overlap comparisons, 33 exact rate checks, 30 forecast checks, rate gaps, GDP-ratio checks and 2019/2022 controls. |
| `source-manifest.csv` | Official URLs, local files, source roles, dates, hashes, sizes and period bounds. |
| `methodology-notes.csv` | The two short comparability notes used by the normalized rows. |
| `official/` | Ten immutable source captures: four bulletins, one monthly report, four debt strategies and one control workbook. |

All six CSV files use UTF-8 with BOM. Every available value retains a source ID, table, original row label and transformation. Generic rate-gap rows intentionally leave the single-source fields blank and keep the complete reviewed-source set in `validation-report.json`.

## Source evidence

All ten official files were retrieved on 2026-09-01. Monetary stock and actual-service values are normalized in million GEL; rates are `% p.a.`; forecast external inputs remain in million USD before the published exchange-rate conversion. Full titles, page URLs, document dates, byte sizes and period bounds are pinned in `source-manifest.csv`.

| Source | Used evidence | Official file | SHA-256 |
| --- | --- | --- | --- |
| N7 | Page 32: 2013-2016 external service and domestic overlap controls. | [PDF](https://mof.ge/files/download/PublicSectorDebtN7ENGMay2017.pdf/d8812ef3-d563-4447-b35e-8a0a0b812056) | `0FC59178E8910028A7773EE03E55EAE97AF4AC1E425F928544D87B0522CC66DA` |
| N13 | Page 31: 2013-2014 stock; page 32: 2017-2019 service and controls. | [PDF](https://mof.ge/files/download/N13ENG.pdf/78e85ff9-d592-4359-936a-b4874d3ebd1a) | `BB27879C4EDD5D24D8246E2EC05F1E1DBE7F8374FE09BC673397184060E19CC2` |
| N19 | Page 34: 2015-2022 stock overlaps; page 35: 2020-2022 service and controls. | [PDF](https://mof.ge/files/download/N19ENG.pdf/87b685f6-5e38-41ec-b777-b9e499ab6eca) | `07BF09C8B3CFEC8FEBD9FDE89CC8BD40E7F2876B836A2B8459692CABC4A9D8BF` |
| N25 | Pages 7/17/20/22/24/26/27/28: stock, service, forecast, exchange rate and GDP ratios. | [PDF](https://mof.ge/files/download/N25ENGUpdate.pdf/a8e288fa-cb9e-4028-9ae1-32f2dde1ace2) | `F4C3B267C0A351A09D723037CF666C949694FCF1764E0C3366B2EBC393AF35F0` |
| July 2026 monthly report | Page 3: total Government Debt weighted-average rates, 2015-2025. | [PDF](https://mof.ge/files/download/Monthly%20Debt%20Report%20%20July.pdf/91fdb650-1e68-46a5-899f-a752f9811742) | `EF71062CE4BF01042AEA5F5B9B86B783E6CF15E8D3A4A619FEE69415947FFF08` |
| Strategy 2019-2021 | Page 14: 2018 domestic rate and non-comparable external evidence. | [PDF](https://mof.ge/files/download/DMSENG19213May2019Web.pdf/924681c3-c2cd-4455-8043-531d6ded8b5e) | `140D7D9BA29747773603829533060D27E7F729E0AC575319C0385E25EC489399` |
| Strategy 2022-2025 | Page 23: 2019-2020 domestic rates and explicit Eurobond exclusion. | [PDF](https://mof.ge/files/download/General%20Government%20Debt%20Management%20Strategy%20for%2020222025.pdf/7ebce43c-ea3f-42d8-bd79-4538e5290afe) | `3CBB9CB715DBBC7D7F5FA7324F78B2C72801AF296533194BE7CD2911C093572C` |
| Strategy 2023-2026 | Page 24: 2021-2022 domestic and external rates. | [PDF](https://mof.ge/files/download/Government%20Debt%20Management%20Strategy%2020232026.pdf/b27d2e53-de14-417e-aa90-6c99794ad573) | `4E1FD16FB2C63289E572B38D44CAE867FF07E6100F8871E1DC9A38429F926EBB` |
| Strategy 2025-2029 | Page 28: 2023-2024 domestic and external rates. | [PDF](https://mof.ge/files/download/DMS%2020252029%20ENG.pdf/43e57bc8-01e2-4b71-bf3f-57f3516115f1) | `FEDC578DA24DD7A49219216A1369FBD7F237F23B89866C036B0F6B69F83D133A` |
| Central-government-liabilities control | `Sheet2!AX6/AX9/AX15` and `BJ6/BJ9/BJ15`; control only. | [XLSX](https://www.mof.ge/files/download/centraluri%20xelisuflebis%20valebi%20da%20valdebulebebi.xls%20%20eng%20IIQ.xlsx/dc8cf5f0-82df-4b13-812e-25b53821df8b) | `F326A4ECA0ECBA67CEFDE22A07FF6AD47E2FDD19B31B93FEF686332A585D0EDC` |

## Two short comparability notes

- 2019: domestic Government Debt additionally includes loan debt owed by budgetary organizations.
- 2022: from December, domestic Government Debt also includes loan debt of state-owned enterprises classified inside general government.

These notes identify the only boundary changes needed to read the delivered 2013-2025 series. The source note for the future 2026 stock-accounting change is preserved in metadata and will be applied only when a 2026 stock observation is added.

## Actual-service overlap controls

The annual domestic service history from N25 page 20 remains canonical. The flow tables in N7/N13/N19/N25 supply 13 independent domestic controls. Integer controls from N7/N13 use a 0.5 million GEL source-precision tolerance; one-decimal N19/N25 controls use 0.1 million GEL because the canonical series adds separately rounded budgetary-organization components. All 13 comparisons are exact or within their declared source precision; any larger difference stops generation.

## Interest-rate gaps

The total Government Debt rate is complete for 2015-2025. Exact comparable component rates are available for domestic debt in 2018-2024 and external debt in 2021-2024. The 11 documented gaps are:

- domestic: 2015, 2016, 2017 and 2025;
- external: 2015, 2016, 2017, 2018, 2019, 2020 and 2025.

The 2018 strategy table reports External Debt and the Eurobond separately; the 2019-2020 external rows explicitly exclude the Eurobond. Those figures are therefore not used as full External Government Debt portfolio rates. Missing values remain blank; they are never set to zero or estimated.

For a gap established by one explicit non-comparable table, that strategy remains the row's `source_id`. For gaps found only after reviewing the full source set, the normalized row leaves `source_id`, `source_table` and `source_row_label` blank; `validation-report.json` records all five reviewed rate-source IDs instead of attaching an unrelated total-rate row.

## GDP reuse and controls

The package reuses the existing national GDP dataset at `data/imports/national-gdp-annual-1996-2025.csv`. It does not copy GDP or debt-to-GDP fields into the normalized debt CSV. The `Stock` sheet of the review workbook displays the existing same-year GDP denominator and calculates `Debt / GDP` with Excel formulas solely for review. All 13 calculated total-debt ratios round within 0.1 percentage point of the published Ministry ratios.

The separate central-government-liabilities workbook is used only for a one-time check of 2019 and 2022. Its totals differ because its statistical scope is not the canonical Government Debt domestic/external split; no value from it populates a normalized output.

## Forecast boundary

The forecast is one internally consistent snapshot, not a rolling monthly splice. External rows cover the published External Government Debt schedule. Domestic rows cover the published Treasury-securities schedule. Domestic `total_service_million_gel` preserves the published total; derived domestic interest retains the source chart's one-decimal precision. Total-scope service therefore sums the domestic and external `total_service_million_gel` fields directly. The package excludes future borrowing, refinancing, exchange-rate changes, variable-rate changes and unscheduled domestic loan debt. Replace the whole snapshot when a later complete official year-end schedule becomes available.

## Reproduce and check

From `apps/web`:

```powershell
npm run data:prepare-government-debt
npm run data:check-government-debt
npm test -- tests/data/governmentDebt/parseDebtSources.test.ts
npm test -- tests/data/governmentDebt/governmentDebtPackage.test.ts
```

The prepare command writes only the four normalized CSVs and `validation-report.json`. Check mode rebuilds those five artifacts in memory and fails if any committed byte differs. Source captures, the manifest, notes, README and review workbook are never rewritten by that command.

The durable source/page rules and validation details are in `docs/data-methodology/government-debt-annual.md`.
