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
| `validation-report.json` | Row counts, source/hash status, 39 stock overlap comparisons, rate gaps, GDP-ratio checks and 2019/2022 controls. |
| `source-manifest.csv` | Official URLs, local files, source roles, dates, hashes, sizes and period bounds. |
| `methodology-notes.csv` | The two short comparability notes used by the normalized rows. |
| `official/` | Ten immutable source captures: four bulletins, one monthly report, four debt strategies and one control workbook. |

All six CSV files use UTF-8 with BOM. The four normalized outputs retain a source ID, table, original row label and transformation for every row.

## Two short comparability notes

- 2019: domestic Government Debt additionally includes loan debt owed by budgetary organizations.
- 2022: from December, domestic Government Debt also includes loan debt of state-owned enterprises classified inside general government.

These notes identify the only boundary changes needed to read the delivered 2013-2025 series. The source note for the future 2026 stock-accounting change is preserved in metadata and will be applied only when a 2026 stock observation is added.

## Interest-rate gaps

The total Government Debt rate is complete for 2015-2025. Exact comparable component rates are available for domestic debt in 2018-2024 and external debt in 2021-2024. The 11 documented gaps are:

- domestic: 2015, 2016, 2017 and 2025;
- external: 2015, 2016, 2017, 2018, 2019, 2020 and 2025.

The 2018-2020 external figures found in older strategy tables exclude the Eurobond, so they are not used as full External Government Debt portfolio rates. Missing values remain blank; they are never set to zero or estimated.

## GDP reuse and controls

The package reuses the existing national GDP dataset at `data/imports/national-gdp-annual-1996-2025.csv`. It does not copy GDP or debt-to-GDP fields into the normalized debt CSV. The `Stock` sheet of the review workbook displays the existing same-year GDP denominator and calculates `Debt / GDP` with Excel formulas solely for review. All 13 calculated total-debt ratios round within 0.1 percentage point of the published Ministry ratios.

The separate central-government-liabilities workbook is used only for a one-time check of 2019 and 2022. Its totals differ because its statistical scope is not the canonical Government Debt domestic/external split; no value from it populates a normalized output.

## Forecast boundary

The forecast is one internally consistent snapshot, not a rolling monthly splice. External rows cover the published External Government Debt schedule. Domestic rows cover the published Treasury-securities schedule. The package excludes future borrowing, refinancing, exchange-rate changes, variable-rate changes and unscheduled domestic loan debt. Replace the whole snapshot when a later complete official year-end schedule becomes available.

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
