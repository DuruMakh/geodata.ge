# Municipal annual expenditure, 2015-2025

## Status and scope

This methodology covers the prepared annual municipality-level research files under:

`docs/Raw Data/Municipalities/combined-annual-2015-2025/`

### Serving status (2026-08-07)

The ten main functional categories are served, on the same terms as expenditure and revenue:
reviewed, mapped to stable `municipal.*` category IDs, and shipped as
`data/imports/municipal-function-facts-2015-2025.csv` (7,040 rows),
`data/imports/municipal-total-facts-2015-2025.csv` (704 rows), and a municipality registry
`data/imports/municipalities.csv` (64 rows). These are read by the CSV serving path
(`GEODATA_DATA_SOURCE=csv`, the default) the same way expenditure and revenue are. Prisma
models, migration `20260802194939_municipal_dataset`, the transactional Supabase mirror import,
and field-by-field import parity checks shipped in the earlier data-only rollout (see
`docs/data-methodology/database-import.md`). Migration and import are therefore not pending.
Every CI-gated production run owned by `.github/workflows/deploy-production.yml` runs
`npm run prisma:deploy` and `npm run data:import` unconditionally, reconverging the mirror to
the reviewed CSVs before Vercel is triggered. Manual Vercel dashboard or CLI deployments do not
run those Actions steps; see `docs/deployment.md`.

The base municipal UI shipped through PR #38 (merge `0f4a287`) with
`/explorer/municipalities`, 64 municipality pages, and 11 region roll-up pages. Post-deployment
checks on 2026-08-06 returned HTTP 200 for the index, municipality `04`, and the Tbilisi region
route. Those routes call `loadServedMunicipalData()`, so a db-mode build verifies the municipal
mirror row by row.

This map-upgrade branch retains those routes and replaces only the index map with the
municipality-grain geometry described in "Municipality geometry join" below. Its production
status remains separate from the base municipal UI: do not describe the municipality-grain map
as live until PR #40 is merged, the production deployment is ready, and the map routes and
interactions pass post-deployment smoke checks.

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

A reviewed public registry, one row per served municipality (`data/imports/municipalities.csv`),
assigns each of the 64 municipalities to one of eleven data-bearing semantic regions:
`region.tbilisi`, `region.adjara`, `region.imereti`, `region.kvemo_kartli`,
`region.samegrelo_zemo_svaneti`, `region.shida_kartli`, `region.guria`, `region.kakheti`,
`region.mtskheta_mtianeti`, `region.samtskhe_javakheti`, `region.racha_lechkhumi_kvemo_svaneti`.
No region column exists in any source file; this mapping is new, assigned once against the
official administrative division and reviewed.

Municipality counts: Tbilisi 1, Adjara 6, Kakheti 8, Imereti 12, Samegrelo-Zemo
Svaneti 9, Shida Kartli 4, Kvemo Kartli 7, Guria 3, Samtskhe-Javakheti 6, Mtskheta-Mtianeti 4,
Racha-Lechkhumi and Kvemo Svaneti 4 — 64 in total.

**Public exclusion decision (2026-08-03).** The raw official package contains five real budget
series under codes `05` (Azhara / Upper Abkhazia), `42` (Eredvi), `43` (Kurta), `46` (Tighvi),
and `64` (Akhalgori). Source review established that these are budgets of Georgian municipal
bodies operating outside the occupied territories and serving displaced communities, not
territorially attributable expenditure delivered inside those occupied municipalities. By
user decision, all five codes are excluded from the public registry, both served fact files,
regional aggregates, rankings, and the municipalities UI. The raw research package,
official workbooks, manifests, hashes, and validation report remain unchanged for provenance.

With code `05` excluded, `region.abkhazia` has no served municipality and is omitted from the
municipal data taxonomy. The map's reviewed occupied-area geometry is a non-interactive visual
overlay without public copy (see "Municipality geometry join" below). The Adjara regional
roll-up continues to exclude the autonomous republic's own budget, which is outside this package
entirely.

### Municipality geometry join

The municipalities UI (`/explorer/municipalities`) joins latest-year official totals to a
reviewed municipality-grain geometry snapshot. Its immutable raw inputs are:

- `docs/Raw Data/Municipalities/municipality-map-geometry/municipalities-osm.geojson` — 60 reviewed OpenStreetMap municipality polygons and their relation IDs;
- `docs/Raw Data/Municipalities/municipality-map-geometry/occupied-areas-natural-earth.geojson` — two reviewed Natural Earth occupied-area overlays;
- `docs/Raw Data/Municipalities/municipality-map-geometry/city-markers.json` — the five approved city marker coordinates.

The preparation command writes the compact application artifact to
`data/geometry/municipality-map-paths.json` and the source hashes, output hash, code crosswalk,
licences, byte counts, and feature counts to
`docs/Raw Data/Municipalities/municipality-map-geometry/source-manifest.json`. The source
contract is exactly 60 unique polygon codes and five markers: Tbilisi `04` is the sole
polygon-plus-marker duplicate, while Batumi `06`, Kutaisi `20`, Poti `32`, and Rustavi `48` are
marker-only. Their union is exactly the 64 codes in `data/imports/municipalities.csv`. Zugdidi
code `33` is pinned to the reviewed corrected OpenStreetMap relation `2016161`.

Codes `05`, `42`, `43`, `46`, and `64` remain absent from both the served registry union and all
interactive geometry. As documented in the public exclusion decision above, their budgets are
for Georgian municipal bodies operating outside those territories and serving displaced
communities, not territorially attributable spending inside the named municipalities. They
remain only in the immutable raw budget research package for provenance.

OpenStreetMap municipality boundaries are licensed under ODbL 1.0. The public source note links
`© OpenStreetMap contributors` to `https://www.openstreetmap.org/copyright` and states `ODbL`.
Natural Earth vector data is public domain, so its provenance is retained in the source package
and manifest without requiring a public attribution line. The two occupied-area overlays render
above municipality fills but expose no public label, tooltip, link, keyboard focus, map text, or
legend entry.

Geometry preparation uses zero simplification tolerance and one-decimal projected coordinates.
The combined generated municipality and overlay SVG path payload must remain at or below 350 KB
uncompressed. From `apps/web`, regenerate or verify the deterministic fixed point with:

```powershell
npm.cmd run data:prepare-municipality-geometry
npm.cmd run data:check-municipality-geometry
```

`npm.cmd run data:validate` independently loads the raw geometry, validates it against the live
64-code registry, and checks the committed artifact and manifest fixed point. The landing page's
shared ADM0/ADM1 geometry in `apps/web/lib/landing/georgiaGeo.ts` and its fetch script remain a
separate input and are not part of the municipality join.

### Population — not imported

The archived MoF portal export in the raw package carries a `Population` column for all 69 municipalities,
2015-2021 (Tbilisi 1,115,689 → 1,202,731, consistent with Geostat); it is empty from 2022 on.
It is not imported: the column stops four years short of 2025, so it cannot support a
latest-year per-capita measure, and its provenance is unreviewed (Georgia's
registered-population and Geostat resident-population figures diverge substantially, and the
package author explicitly recorded that no population adjustment is applied). Sourcing
municipal population 2015-2025 from Geostat, reviewing it, and adding a per-capita measure is a
separate, future candidate dataset (see
`docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md` §8).

- Period: 2015-2025, inclusive.
- Geography: 64 publicly served municipalities; the raw research package retains 69 official rows.
- Frequency: annual only.
- Currency: nominal GEL.
- Basis: actual, except that no planned value is substituted when an official actual total is unavailable.
- Functional coverage: ten main functions and six selected details that are consistently identifiable across the period.

The two autonomous republic budgets are excluded.

## Prepared raw outputs

These source-review artifacts retain all 69 official municipal rows. The smaller public files
under `data/imports/` are generated from them using the five-code exclusion above.

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

The 69 current raw municipality history workbooks are retained unchanged under:

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

## Public-display and percentage rule

The public interface uses `public_total_gel` as `მთლიანი ბიუჯეტი` for every year and entity. That row is 100% in share mode. Each of the ten unchanged functional rows is divided by `public_total_gel`, so the functional percentages are not normalized and may sum below or above 100%.

For 2016-2019, the official total and functional rows may come from different archived MoF publication versions. For later years, total payments may include financial-asset growth and liability decrease that are not distributed across the ten functions. No category is adjusted and no residual series is created.

Reconciliation fields and warning types remain internal quality-control data. The explorer does not render a warning. A future municipal CSV enhancement should carry this explanation as metadata; that narrative CSV enhancement is deferred.

The finalized package has the following internal validation classifications:

- 24 `source_version_difference` rows;
- 21 `financing_outside_functional` rows;
- no unresolved material reconciliation rows;
- one non-warning `source_actual_missing` row for Khulo 2024.

In 2025, the raw official functional workbook already reconciles to total payments for all 69 municipalities. No amount is added again.

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
| `warning_amount_gel` | Absolute material reconciliation difference retained for internal validation and review. |
| `show_warning` | Internal validation flag under the GEL 1 million review rule; never a public UI instruction. |
| `warning_type` | Internal reconciliation classification used by validation and source review only. |

## Functional output fields

The functional CSVs retain stable lowercase ASCII category identifiers, official functional codes, Georgian display labels, source labels, classification level, annual nominal GEL amount, source provenance, transformation, and review date.

`municipality_code` is stored as text so that leading zeros are preserved. `functional_code` is also stored as text so that values such as `7.10` are not converted by Excel.

## Encoding

All Excel-facing CSV outputs are UTF-8 with the three-byte BOM prefix `EF BB BF`. This prevents Windows Excel from guessing a legacy encoding and displaying Georgian text as mojibake.

The native XLSX workbook is the preferred human-review artifact. Georgian text and identifier columns are stored as typed workbook values.

## Validation

The raw package's generated `validation-report.json` has status `PASS` and records:

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
