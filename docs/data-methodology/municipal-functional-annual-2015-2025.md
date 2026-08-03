# Municipal annual expenditure, 2015-2025

## Status and scope

This methodology covers the prepared annual municipality-level research files under:

`docs/Raw Data/Municipalities/combined-annual-2015-2025/`

### Serving status (2026-08-02)

The ten main functional categories are served, on the same terms as expenditure and revenue:
reviewed, mapped to stable `municipal.*` category IDs, and shipped as
`data/imports/municipal-function-facts-2015-2025.csv` (7,590 rows),
`data/imports/municipal-total-facts-2015-2025.csv` (759 rows), and a new municipality registry
`data/imports/municipalities.csv` (69 rows). These are read by the CSV serving path
(`GEODATA_DATA_SOURCE=csv`, the default) the same way expenditure and revenue are. Prisma
models, a migration, and a database-mode reader also exist for this dataset (see
`docs/data-methodology/database-import.md`), but as of this date the migration has not been
applied to the Supabase database and `npm run data:import` has not loaded municipal rows into
it — the mirror holds no municipal data yet. Both happen automatically, with no manual approval
step, on the next CI-green push to `main`: `.github/workflows/deploy-production.yml` runs
`npm run prisma:deploy` and then `npm run data:import` unconditionally, so merging this branch is
the decision point. The operation is safe by construction — one transaction, parity verified
before commit, rollback on any mismatch — and production keeps serving the previous build if the
workflow goes red.

No page or route reads this data. `apps/web/lib/explorer/sections.ts` keeps
`municipalities: { href: null }`, and the sidebar/hub keep the `მალე` marker (`DESIGN.md`
§6.7); that stays until a future UI spec ships the route.

The six selected-detail rows (`7.1.1`, `7.4.5.1`, `7.5.1`, `7.8.1`, `7.8.2`, `7.9.1`; 4,554 rows
in the prepared package below) are deliberately not imported — not an oversight. Dropping them
removes any non-additivity hazard: the ten main functions are mutually exclusive and sum
exactly to `functional_sum_gel`. They remain in the raw package only, unimported.

### Function mapping

`functional_code` maps to a semantic `category_id` at the import boundary
(`apps/web/lib/data/municipal/functionMapping.ts`). The raw package itself is never rewritten,
so its recorded SHA-256 hashes and `PASS` validation report below stay valid.

| Code | `category_id` | Georgian label |
| --- | --- | --- |
| 7.1 | `municipal.general_public_services` | საერთო დანიშნულების სახელმწიფო მომსახურება |
| 7.2 | `municipal.defence` | თავდაცვა |
| 7.3 | `municipal.public_order_safety` | საზოგადოებრივი წესრიგი და უსაფრთხოება |
| 7.4 | `municipal.economic_affairs` | ეკონომიკური საქმიანობა |
| 7.5 | `municipal.environment` | გარემოს დაცვა |
| 7.6 | `municipal.housing_communal` | საბინაო-კომუნალური მეურნეობა |
| 7.7 | `municipal.health` | ჯანმრთელობის დაცვა |
| 7.8 | `municipal.recreation_culture` | დასვენება, კულტურა და რელიგია |
| 7.9 | `municipal.education` | განათლება |
| 7.10 | `municipal.social_protection` | სოციალური დაცვა |

### Region mapping

A new reviewed registry, one row per municipality (`data/imports/municipalities.csv`), assigns
each of the 69 municipalities to one of twelve semantic regions: `region.tbilisi`,
`region.abkhazia`, `region.adjara`, `region.imereti`, `region.kvemo_kartli`,
`region.samegrelo_zemo_svaneti`, `region.shida_kartli`, `region.guria`, `region.kakheti`,
`region.mtskheta_mtianeti`, `region.samtskhe_javakheti`, `region.racha_lechkhumi_kvemo_svaneti`.
No region column exists in any source file; this mapping is new, assigned once against the
official administrative division and reviewed.

Municipality counts: Tbilisi 1, Abkhazia 1, Adjara 6, Kakheti 8, Imereti 12, Samegrelo-Zemo
Svaneti 9, Shida Kartli 7, Kvemo Kartli 7, Guria 3, Samtskhe-Javakheti 6, Mtskheta-Mtianeti 5,
Racha-Lechkhumi and Kvemo Svaneti 4 — 69 in total.

**Autonomous-republic caveat.** `05 აჟარის` is **Abkhazia, not Adjara**: Azhara / Upper Abkhazia
(ზემო აფხაზეთი) is a municipality of the Abkhaz autonomous republic that merely sits inside the
Adjara sort block in the official ordering, so `region.abkhazia` is a one-municipality region
and Adjara AR has exactly six municipalities (codes 06-11). A region roll-up is the sum of that
region's municipal budgets only — for აჭარა that total does **not** include the Adjara
autonomous republic's own budget, and the same holds for აფხაზეთი; those autonomous-republic
budgets are outside this package entirely. Five municipalities that administer territory
Georgia does not control (`05 აჟარის`, `42 ერედვის`, `43 ქურთის`, `46 თიღვის`, `64 ახალგორის`)
carry real official rows and are registered and served on identical terms to every other
municipality.

The map-shape join (matching each municipality to a map boundary) is deferred to the future UI
spec and is not part of what is served here; see
`docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md` §4.3.

### Population — not imported

The archived MoF portal export carries a `Population` column for all 69 municipalities,
2015-2021 (Tbilisi 1,115,689 → 1,202,731, consistent with Geostat); it is empty from 2022 on.
It is not imported: the column stops four years short of 2025, so it cannot support a
latest-year per-capita measure, and its provenance is unreviewed (Georgia's
registered-population and Geostat resident-population figures diverge substantially, and the
package author explicitly recorded that no population adjustment is applied). Sourcing
municipal population 2015-2025 from Geostat, reviewing it, and adding a per-capita measure is a
separate, future candidate dataset (see
`docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md` §8).

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
