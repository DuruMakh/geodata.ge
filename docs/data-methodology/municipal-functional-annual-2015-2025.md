# Municipal annual expenditure, 2015-2025

## Status and scope

This methodology covers the prepared annual municipality-level research files under:

`docs/Raw Data/Municipalities/combined-annual-2015-2025/`

The package is not imported into the GeoData.ge application or serving database.

- Period: 2015-2025, inclusive.
- Geography: 69 Georgian municipalities.
- Frequency: annual only.
- Currency: nominal GEL.
- Basis: actual, except that no planned value is substituted when an official actual total is unavailable.
- Functional coverage: ten main functions and six selected details that are consistently identifiable across the period.

The two autonomous republic budgets are excluded.

## Prepared outputs

| File | Rows | Use |
| --- | ---: | --- |
| `municipal-total-payments-annual-2015-2025.csv` | 759 | One annual public headline per municipality and year, with reconciliation and warning metadata. |
| `municipal-functional-main-annual-2015-2025.csv` | 7,590 | Ten comparable main functions. |
| `municipal-functional-selected-detail-annual-2015-2025.csv` | 4,554 | Six consistently comparable selected details. |
| `municipal-functional-annual-2015-2025.csv` | 12,144 | Convenience union of the main and selected-detail files. |
| `municipal-functional-annual-2015-2025.xlsx` | - | Human-review workbook containing `Read me`, `Main functions`, `Selected details`, and `Total payments` sheets. |
| `source-manifest.csv` | 11 | Source inventory with local paths, URLs, hashes, sizes, years, and roles. |
| `validation-report.json` | - | Machine-readable coverage, reconciliation, warning, encoding, and output-hash checks. |

The classification levels are not additive. Selected details are already included in their parent main functions. Total payments must also not be added to functional rows.

## Official source families

### Functional data

| Years | Source | Transformation |
| --- | --- | --- |
| 2015-2019 | Archived Municipalities Analytical Portal open-data exports | Sum monthly `ActualAmount` by year, municipality, and function. |
| 2020-2025 | MoF annual functional-classification workbooks | Select comparable annual rows and multiply thousand GEL by 1,000. |

The portal has all 12 months for every retained 2015-2019 year. The archived portal also contains 2020, but the current MoF annual workbook is used from 2020 onward to keep one consistent current publication series. The portal's incomplete 2021-2022 records are not used.

### Public total data

| Years | Public measure | Source |
| --- | --- | --- |
| 2015 | Functional total fallback | Archived portal. A current MoF total-payment history column is not available for 2015. |
| 2016-2025 | Total payments | The current official MoF municipality budget-history workbook for each municipality. |
| Khulo, 2024 | Functional total fallback | The current Khulo workbook labels the 2024 column as plan and does not provide a 2024 actual total. The official 2024 functional actual total is used instead; the planned value is not substituted. |

The 69 current municipality history workbooks are retained unchanged under:

`docs/Raw Data/Municipalities/mof-municipality-budget-history-2016-2025/`

Their exact official URLs, SHA-256 hashes, byte sizes, sheet names, and available actual-year columns are recorded in that folder's `source-manifest.csv`.

## What the two totals mean

`functional_sum_gel` is the sum of the ten main functional rows in the prepared functional dataset.

`total_payments_gel` is the official MoF headline total from the municipality history workbook. The workbook decomposes total payments into:

1. expenses;
2. growth of nonfinancial assets;
3. growth of financial assets, excluding the balance item; and
4. decrease in liabilities.

Functional classification primarily allocates expenses and nonfinancial-asset operations by purpose. Financial-asset growth and liability decrease may therefore appear in total payments without being distributed across the historical functional rows.

No functional category is changed or inflated to force a reconciliation. The public headline and functional rows are kept as separate measures.

## Public-display rule

The public interface should display only `public_total_gel` as the municipality's annual headline:

- use `total_payments_gel` for 2016-2025 when the official actual value exists;
- use the explicitly labelled fallback for 2015 and Khulo 2024;
- keep all functional categories unchanged;
- do not display a second competing total by default.

## Warning rule

A public warning marker is set only when both an official total-payment value and a functional subtotal exist and:

`absolute(total_payments_gel - functional_sum_gel) > GEL 1,000,000`

The comparison is strict: exactly GEL 1,000,000 does not trigger the marker.

Public wording must follow `warning_type`:

- `source_version_difference`, 2016-2019: "The official total-payments figure differs by GEL {warning_amount_gel} from the displayed functional subtotal. The figures come from different MoF publication vintages, so the difference is not assigned to a specific financing component."
- `financing_outside_functional`, 2020-2024: "Total payments include GEL {warning_amount_gel} that is not distributed across the displayed functional categories. The difference primarily reflects financial-asset growth and/or liability repayment." This wording is used only when the difference is positive and reconciles to financial-asset growth plus liability decrease within GEL 50,000. The tolerance accommodates small cross-workbook rounding or publication-vintage residuals; it does not change any published amount.
- `reconciliation_review_required`: "The official total-payments figure differs by GEL {warning_amount_gel} from the displayed functional subtotal. The difference could not be fully reconciled and requires source review."

`source_actual_missing` does not trigger the GEL 1 million marker because no official actual total-payment value is available for comparison.

The finalized package has:

- 24 `source_version_difference` rows;
- 21 `financing_outside_functional` rows;
- no unresolved material reconciliation rows;
- one non-warning `source_actual_missing` row for Khulo 2024.

In 2025, the official functional workbook already reconciles to total payments for all 69 municipalities. No amount is added again and no warning is shown.

## Total-payment output fields

| Field | Meaning |
| --- | --- |
| `public_total_gel` | Single annual value intended for the public headline. |
| `public_total_measure` | `total_payments` or an explicit fallback measure. |
| `total_payments_gel` | Official actual headline total when available. |
| `expenses_gel` | Official total-payment component. |
| `nonfinancial_asset_growth_gel` | Official total-payment component. |
| `financial_asset_growth_gel` | Official total-payment component, excluding the balance item. |
| `liability_decrease_gel` | Official total-payment component. |
| `functional_sum_gel` | Sum of the ten prepared main functional rows. |
| `reconciliation_difference_gel` | Total payments minus functional subtotal. |
| `financing_components_gel` | Financial-asset growth plus liability decrease. |
| `financing_reconciliation_difference_gel` | Reconciliation difference minus financing components. |
| `warning_amount_gel` | Absolute material difference shown in the public note. |
| `show_warning` | `true` only under the GEL 1 million rule. |
| `warning_type` | Explanation category used by the public note and review workflow. |

## Functional output fields

The functional CSVs retain stable lowercase ASCII category identifiers, official functional codes, Georgian display labels, source labels, classification level, annual nominal GEL amount, source provenance, transformation, and review date.

`municipality_code` is stored as text so that leading zeros are preserved. `functional_code` is also stored as text so that values such as `7.10` are not converted by Excel.

## Encoding

All Excel-facing CSV outputs are UTF-8 with the three-byte BOM prefix `EF BB BF`. This prevents Windows Excel from guessing a legacy encoding and displaying Georgian text as mojibake.

The native XLSX workbook is the preferred human-review artifact. Georgian text and identifier columns are stored as typed workbook values.

## Validation

The generated `validation-report.json` has status `PASS` and records:

- 759 total-payment/public-total rows: 11 years times 69 municipalities;
- 7,590 main-function rows and 4,554 selected-detail rows;
- no duplicate functional keys;
- no null, non-numeric, or negative functional amounts;
- exact portal reconciliation to `AllDetailsAmount` for 2015-2019;
- exact annual workbook reconciliation to function code `7` for 2020-2025;
- component reconciliation for every available 2016-2025 official total-payment row;
- the single missing official actual row and its fallback;
- warning counts and year summaries;
- UTF-8 BOM checks;
- SHA-256 hashes and file sizes for raw sources and prepared outputs;
- no spreadsheet formula errors.

## Limitations

- The dataset is annual and intentionally excludes monthly values.
- Full detail is not consistently comparable across 2015-2025; only the ten main functions and six selected details are included in the cross-period prepared series.
- Amounts are nominal GEL. No inflation, population, or per-capita adjustment is applied.
- The 2020 functional-source transition and the 2016-2019 publication-vintage differences should be considered in trend interpretation.
- MoF may revise or replace published workbooks. Use the manifests and hashes to identify future source changes.
- Khulo 2024 is not an official total-payment actual because the current municipality history workbook omits that measure. It is explicitly a functional actual fallback.
