# Government Debt Data Preparation Design

**Date:** 2026-09-01
**Status:** Design approved in chat; written specification awaiting review
**Scope:** Official-data collection and preparation only; no database, route, UI, or public export work

## 1. Goal

Prepare an auditable annual Government Debt data package for a future Fiscal.ge debt module. The package must contain:

1. total, domestic, and external Government Debt stock for 2013-2025;
2. actual principal and interest paid on Government Debt for 2013-2025;
3. year-end weighted-average interest rates for total, domestic, and external Government Debt for the exact official coverage available within 2015-2025; and
4. projected principal and interest payments for 2026-2030 based on the debt portfolio outstanding on 31 December 2025.

The package preserves every official source used, records the exact source row or table behind each value, creates review-friendly CSV/XLSX outputs, and fails closed instead of estimating missing data.

This phase prepares data for future use. It does not activate a Debt explorer or change the current application.

## 2. Approved Coverage

| Dataset | Period | Frequency | Required scopes |
| --- | --- | --- | --- |
| Government Debt stock | 2013-2025 | Annual, year-end | Total, domestic, external |
| Actual Government Debt service | 2013-2025 | Annual | Total, domestic, external |
| Weighted-average interest rate | 2015-2025 target window | Annual, year-end | Total, domestic, external |
| Projected Government Debt service | 2026-2030 | Annual forecast from one snapshot | Total, domestic, external |

The stock and actual-service series deliberately start in 2013 so the first delivery has one clear historical starting point. The rate series starts in 2015 because that is the agreed practical window for comparable official rate data.

## 3. Debt Boundary

The public-facing concept prepared by this task is **Government Debt** (`მთავრობის ვალი`), not the broader **Public/State Debt** (`სახელმწიფო ვალი`) total.

The normalized scopes are:

- `total`: Total Government Debt;
- `domestic`: Domestic Government Debt; and
- `external`: External Government Debt.

The following rules prevent scope mixing:

- Total Government Debt always equals Domestic Government Debt plus External Government Debt.
- External Government Debt excludes National Bank of Georgia obligations that appear in broader public-debt totals.
- From 2019, Domestic Government Debt additionally includes debt owed by budgetary organizations.
- From December 2022, it also includes loan debt of state-owned enterprises classified within the general-government sector.
- Public-debt totals, National Bank debt, guaranteed-debt subtotals, on-lending service, PPP commitments, and the broader central-government-liabilities Excel total are not substituted for Government Debt.

Only the 2019 and 2022 boundary changes are carried into the concise methodology presented with this package. Legal text and unrelated debt definitions are not reproduced.

The Ministry of Finance note that stock accounting changes from 2026 to nominal value including accrued interest is preserved in source metadata. It does not alter the 2013-2025 stock series in this delivery. Adding a 2026 stock observation later will require an explicit comparability note.

## 4. Existing Fiscal.ge Data That Remains Unchanged

The task reuses, but does not duplicate or edit, the existing nominal GDP dataset:

`data/imports/national-gdp-annual-1996-2025.csv`

Future `% მშპ-ში` values will be calculated as same-year Government Debt divided by the existing same-year GDP value. The normalized debt-stock CSV therefore does not store a second GDP series or a duplicated GDP-share field. The review workbook may display the calculated share for checking.

The existing expenditure category `spending.debt_service` and all values currently shown as `ვალის მომსახურება` remain unchanged. This debt package is a separate future dataset and does not replace or reinterpret that expenditure category.

## 5. Official Sources and Source Roles

The Ministry of Finance of Georgia is the official publisher for all debt values in this package.

Primary discovery pages:

- Reports and publications: `https://mof.ge/en/page/reports-and-publications`
- Statistical bulletin archive: `https://mof.ge/en/fl/sakartvelos_sakhelmtsifo_valis_statistikuri_biuleteni`
- Current public-debt statistics: `https://mof.ge/en/page/public-debt-statistics`
- Central-government-debt-liabilities Excel page: `https://www.mof.ge/en/fl/sakhelmtsifo_finansebis_statistika__tsentraluri_khelisuflebis_valebi`

Every preserved file receives one or more of these roles in the source manifest:

- `canonical_stock`
- `canonical_actual_service`
- `canonical_interest_rate`
- `canonical_forecast`
- `control_only`

### 5.1 Stock

Use the latest year-end statistical bulletin containing each observation:

- Bulletin N13 for 2013-2014;
- Bulletin N25 for 2015-2025.

Bulletins N13 and N19 are also retained for overlap reconciliation and the 2019/2022 methodology checks. When an older bulletin and N25 disagree for an overlapping year, N25 is the canonical value and the exact difference is reported.

The manifest records the exact official archive page and file URL used for each preserved bulletin. If an older Ministry file URL no longer resolves, the package records it as a legacy retrieval URL, keeps the verified local source hash, and does not invent a replacement link. N25's currently published file is also linked from the Ministry's live bulletin archive.

### 5.2 Actual principal and interest paid

Use the `Net Flows & Net Transfers on Public Debt` tables from consecutive year-end bulletins:

- N7 for 2013-2016;
- N13 for 2017-2019;
- N19 for 2020-2022;
- N25 for 2023-2025.

The normalized Government Debt total is calculated from the Government external and Government domestic components. It is never copied from the `TOTAL PUBLIC DEBT` row. For years where the official table uses the earlier `Domestic Public Debt` label, it may be mapped to domestic Government Debt only when the bulletin's definition confirms the two scopes are equivalent for that year. The original row label remains in provenance metadata.

### 5.3 Weighted-average interest rates

Use official year-end Government Debt Management Annual Reports, year-end Government Debt Portfolio files, and statistical bulletins only when the table or figure clearly identifies the same Government Debt portfolio and rate definition.

Rules:

- the measure is the published year-end weighted-average annual interest rate, not cash interest paid divided by debt stock;
- total, domestic, and external values must each be exact source-backed values;
- total is not an arithmetic average of domestic and external rates;
- chart positions are not digitized or estimated;
- a `Public Debt` rate is not silently relabeled as a `Government Debt` rate; and
- if an exact Government Debt value cannot be found for a year/scope after reviewing the official reports, the value remains blank and the gap is documented.

The target review grid is all 33 combinations of 2015-2025 and the three scopes. A package with unresolved source-backed gaps is marked `complete_with_documented_rate_gaps`, never fully complete.

### 5.4 Projected principal and interest

Use Bulletin N25's year-end schedule for the portfolio outstanding on 31 December 2025:

- external Government Debt principal and interest schedule in million USD;
- domestic Treasury securities service profile and maturity table in million GEL; and
- the N25 year-end exchange-rate table for the auditable GEL conversion.

The external source schedule is:

| Payment year | Principal, million USD | Interest, million USD |
| --- | ---: | ---: |
| 2026 | 1,010.9 | 237.6 |
| 2027 | 512.6 | 218.3 |
| 2028 | 526.5 | 207.0 |
| 2029 | 521.3 | 194.4 |
| 2030 | 508.9 | 181.5 |

The domestic source controls are:

| Payment year | Total service, million GEL | Principal, million GEL | Derived interest, million GEL |
| --- | ---: | ---: | ---: |
| 2026 | 1,795.6 | 822.211 | 973.4 |
| 2027 | 2,418.3 | 1,539.249 | 879.1 |
| 2028 | 3,503.0 | 2,833.611 | 669.4 |
| 2029 | 1,950.0 | 1,413.474 | 536.5 |
| 2030 | 1,859.1 | 1,516.849 | 342.3 |

Domestic interest is the published total service less published principal, rounded to the one-decimal precision of the service chart. The package must not imply greater precision.

N25 publishes the year-end rate as GEL 1 = USD 0.3710. The original rate and its date are retained; the reciprocal GEL-per-USD rate used for conversion is explicitly derived. External USD values are never discarded after conversion.

The forecast is labeled `existing portfolio as of 2025-12-31`. Its external component covers External Government Debt; its domestic component covers the Treasury-securities schedule published by N25. It does not silently claim coverage of domestic budgetary-organization or state-owned-enterprise loan payments when N25 does not schedule them in the same table. It also excludes future borrowing, refinancing, exchange-rate changes, and changes in variable interest rates. A newer monthly report is not spliced into this schedule when it lacks the matching full interest forecast. The whole snapshot is replaced when a later full official year-end schedule becomes available.

### 5.5 Control-only Excel

Preserve the Ministry of Finance workbook titled `Central Government Debt Liabilities by Maturity, Residency, and Instrument with reference to GFSM 2001` as `control_only`.

It is used once to compare 2019 and 2022, confirming that its residency/instrument-based central-government-liabilities totals are not the same series as the legal Government Debt domestic/external split. Differences are reported; the workbook is not used to populate any normalized debt value and is not required for future annual updates.

The two control comparisons are:

| Year | Series | Total, million GEL | Domestic, million GEL | External/foreign, million GEL |
| --- | --- | ---: | ---: | ---: |
| 2019 | Canonical Government Debt | 19,915.7 | 4,166.0 | 15,749.7 |
| 2019 | Control Excel, GFSM liabilities | 20,569.7 | 4,827.0 | 15,742.7 |
| 2022 | Canonical Government Debt | 28,587.3 | 7,195.3 | 21,392.0 |
| 2022 | Control Excel, GFSM liabilities | 28,493.8 | 7,105.1 | 21,388.7 |

The control workbook values are its fourth-quarter observations (`AX6`, `AX9`, and `AX15` for 2019; `BJ6`, `BJ9`, and `BJ15` for 2022). The differences are expected because the workbook uses a different statistical boundary. They must be explained, not reconciled by changing either series.

Published Government Debt total rows may show whole-million values such as 19,916 and 28,587. The normalized one-decimal total is the exact sum of the published domestic and external component values; the rounded official total remains a validation control.

## 6. Package Layout

Create the research package under:

`docs/Raw Data/Debt/government-debt-annual/`

```text
government-debt-annual/
  README.md
  source-manifest.csv
  methodology-notes.csv
  government-debt-stock-annual-2013-2025.csv
  government-debt-interest-rates-annual-2015-2025.csv
  government-debt-service-actual-annual-2013-2025.csv
  government-debt-service-forecast-2026-2030.csv
  government-debt-review.xlsx
  validation-report.json
  official/
    public-debt-bulletin-n7.pdf
    public-debt-bulletin-n13.pdf
    public-debt-bulletin-n19.pdf
    public-debt-bulletin-n25.pdf
    interest-rate-sources/
    central-government-debt-liabilities-control.xlsx
```

`interest-rate-sources/` contains descriptively named official annual reports or portfolio files, with every exact filename listed in the manifest. Only reports actually used for a normalized value are retained as `canonical_interest_rate`; unused discovery downloads do not enter the final package.

Files under `official/` are immutable source captures. Regeneration reads those local captures and must not silently redownload or overwrite them. A source may be replaced only through an explicit update that records a new hash, retrieval date, and review result.

Human-facing CSVs use UTF-8 with BOM so Georgian text opens correctly in Microsoft Excel.

## 7. Source Manifest

`source-manifest.csv` contains one row per preserved official file:

```text
source_id
dataset_title
publisher
roles
document_date
source_page_url
retrieved_file_url
retrieved_at
local_file
sha256
bytes
source_period_min
source_period_max
used_period_min
used_period_max
notes
```

Rules:

- `publisher` is `Ministry of Finance of Georgia`.
- `roles` uses only the approved roles in section 5; multiple roles are stored once in a stable pipe-separated order.
- `retrieved_at` is an ISO date in Asia/Tbilisi.
- hashes are SHA-256 uppercase hexadecimal.
- URLs are the exact public page and final retrieved file URL.
- one source ID represents one preserved file, even when that file has multiple explicit roles.

## 8. Normalized Stock Dataset

`government-debt-stock-annual-2013-2025.csv` schema:

```text
year
debt_scope
amount_million_gel
amount_gel
observation_date
status
source_id
source_table
source_row_label
source_unit
transformation
methodology_note_id
last_reviewed_at
```

Rules:

- exactly 39 rows: 13 years times 3 scopes;
- `observation_date` is `YYYY-12-31`;
- `status` is `actual`;
- `amount_million_gel` preserves the published precision;
- `amount_gel` is the exact mechanical conversion `amount_million_gel * 1,000,000`;
- `total` is the exact sum of the published domestic and external component values; when the bulletin's displayed total is rounded to whole millions, it is retained as a control rather than substituted for the component sum;
- 2019 links to the budgetary-organization note and 2022 links to the general-government-SOE note; and
- no GDP value or ratio is duplicated into this CSV.

## 9. Normalized Interest-Rate Dataset

`government-debt-interest-rates-annual-2015-2025.csv` schema:

```text
year
debt_scope
weighted_average_interest_rate_percent
observation_date
portfolio_scope
rate_definition
availability_status
source_id
source_table
source_row_label
source_unit
transformation
last_reviewed_at
```

Rules:

- the review grid contains exactly 33 year/scope rows;
- `observation_date` is `YYYY-12-31`;
- `portfolio_scope` must identify Government Debt, not Public Debt;
- `availability_status` is `available`, `not_published_in_reviewed_source`, or `not_found_in_reviewed_sources`;
- a missing value stays blank and carries a non-available status;
- source precision is preserved; and
- no rate is inferred from another rate, cash-flow series, or chart geometry.

## 10. Normalized Actual-Service Dataset

`government-debt-service-actual-annual-2013-2025.csv` schema:

```text
year
debt_scope
principal_paid_million_gel
interest_paid_million_gel
principal_paid_gel
interest_paid_gel
status
source_id
source_table
source_row_label
source_unit
transformation
methodology_note_id
last_reviewed_at
```

Rules:

- exactly 39 rows: 13 years times 3 scopes;
- `status` is `actual`;
- external flow values use the transaction-date GEL conversion already published by the Ministry of Finance;
- total principal equals domestic principal plus external principal;
- total interest equals domestic interest plus external interest;
- on-lending service and National Bank service are not added; and
- GEL columns are exact mechanical conversions of the million-GEL fields.

## 11. Normalized Forecast Dataset

`government-debt-service-forecast-2026-2030.csv` schema:

```text
snapshot_date
payment_year
debt_scope
principal_source_amount
interest_source_amount
source_currency
published_exchange_rate
published_exchange_rate_definition
source_exchange_rate_to_gel
principal_million_gel
interest_million_gel
total_service_million_gel
status
coverage_note
source_id
source_table
source_row_label
transformation
last_reviewed_at
```

Rules:

- exactly 15 rows: 5 payment years times 3 scopes;
- `snapshot_date` is `2025-12-31`;
- `status` is `projection_existing_portfolio`;
- external rows preserve USD source amounts, the published `GEL 1 = USD 0.3710` rate and direction, and the derived GEL-per-USD conversion rate;
- domestic rows preserve GEL source amounts and the documented interest derivation;
- total rows equal the GEL-normalized domestic plus external rows; and
- `coverage_note` states that the domestic component is the published Treasury-securities schedule and that future borrowing, refinancing, FX changes, variable-rate changes, and unscheduled domestic loan debt are excluded.

## 12. Concise Methodology Notes

`methodology-notes.csv` contains only the notes needed to interpret the series:

```text
methodology_note_id
effective_date
affected_dataset
affected_scope
note_ka
note_en
source_id
```

Required notes:

- `government-domestic-2019-budget-organizations`
- `government-domestic-2022-general-government-soes`

The 2026 stock-accounting change remains in README/source metadata until a 2026 stock value is added. The package does not become a general legal or debt-methodology guide.

## 13. Excel Review Workbook

`government-debt-review.xlsx` contains:

1. `Read me`
2. `Stock`
3. `Interest rates`
4. `Actual service`
5. `Forecast service`
6. `2019-2022 controls`
7. `Sources`

The workbook mirrors the normalized CSV rows. `Stock` additionally displays a review-only GDP-share calculation using the existing canonical GDP CSV. `2019-2022 controls` shows the canonical Government Debt values beside the control-only central-government-liabilities Excel values and explains why equality is not expected.

This is an internal review workbook, not the future public Fiscal.ge download. Public workbook behavior remains outside this phase.

## 14. Validation

`validation-report.json` records each check, observed result, source reference, and failure. Preparation stops on an unexplained mismatch.

### 14.1 Source checks

- Every manifest file exists.
- Hash and byte size match the manifest.
- Every normalized value points to an existing source ID, table, and original row label.
- Canonical outputs never cite a `control_only` file as their value source.

### 14.2 Stock checks

- Exact year sequence 2013-2025.
- Exact scope set `total`, `domestic`, `external` for every year.
- Unique `(year, debt_scope)` keys and exactly 39 rows.
- Values are numeric and nonnegative.
- Total equals domestic plus external at source precision.
- 2019 equals GEL 19,915.7m total, GEL 4,166.0m domestic, and GEL 15,749.7m external.
- 2022 equals GEL 28,587.3m total, GEL 7,195.3m domestic, and GEL 21,392.0m external.
- Overlapping N13/N19/N25 values are compared and any revision is reported; N25 remains canonical for 2015-2025.
- Review-only GDP shares are recalculated from the existing GDP CSV. Published Government-Debt-to-GDP ratios are a secondary comparison: a difference within 0.1 percentage point is a rounding match, while a larger difference is reported as a possible GDP-vintage difference and never resolved by changing either the debt value or Fiscal.ge's existing GDP value.

### 14.3 Interest-rate checks

- Exact 2015-2025 by three-scope review grid and unique keys.
- Every available value is numeric and nonnegative.
- Every available row explicitly says Government Debt in its source scope.
- No `Public Debt` rate, cash-flow-derived rate, or chart-estimated rate is accepted.
- Every blank value has a documented non-available status.

### 14.4 Actual-service checks

- Exact year sequence 2013-2025, exact scope set, unique keys, and exactly 39 rows.
- Principal and interest values are numeric and nonnegative.
- Total principal and interest each equal their domestic plus external components.
- Source mappings exclude National Bank service and on-lending service.
- Source-unit-to-GEL conversions are exact and documented.

### 14.5 Forecast checks

- Exact payment-year sequence 2026-2030, exact scope set, unique keys, and exactly 15 rows.
- N25 external USD principal and interest match the control table in section 5.4.
- Domestic total service and principal match section 5.4; derived interest reconciles at one-decimal precision.
- The external GEL conversion uses the recorded 2025-12-31 rate.
- Total rows equal domestic plus external after GEL normalization.
- Every row carries the same snapshot date and the existing-portfolio limitation.

### 14.6 Package checks

- CSV headers exactly match the approved schemas.
- Human-facing CSVs begin with a UTF-8 BOM and Georgian text round-trips unchanged.
- XLSX sheet names and row counts agree with the CSVs.
- README coverage, gaps, sources, and validation status agree with the machine-readable files.
- Regeneration is deterministic; check mode reports no byte-level differences.

## 15. Documentation and Gaps

`README.md` is the short human-readable handoff. It contains:

- the four datasets and exact observed coverage;
- the Government Debt boundary in plain language;
- only the 2019 and 2022 methodology changes;
- source links, retrieval dates, hashes, units, and table references;
- the use of the existing GDP data without duplication;
- the difference between actual payments and the 2025-12-31 forecast snapshot;
- the two control-year results;
- all missing rate cells, if any; and
- a statement that no value was estimated and no application behavior changed.

Stock, actual service, and the five-year forecast are mandatory complete outputs. Missing official values in those datasets block completion. Interest-rate gaps may be delivered only as explicit blank cells with package status `complete_with_documented_rate_gaps`.

## 16. Repository Boundaries

This task may change only:

- this design and the later implementation plan;
- `docs/Raw Data/Debt/government-debt-annual/`;
- a matching methodology document at `docs/data-methodology/government-debt-annual.md`; and
- focused preparation/validation scripts and tests required to generate and verify the package.

This phase does not change:

- `Project_Definition.md` or the current v1 scope;
- `DESIGN.md`;
- `data/imports` or any serving loader;
- Prisma, Supabase, or database contents;
- routes, navigation, components, charts, tables, or public Excel exports;
- the existing GDP dataset;
- the existing `spending.debt_service` expenditure data;
- deficit functionality;
- monthly or quarterly public series;
- average maturity, fixed/floating-rate shares, or currency composition; or
- automated production extraction or recurring scraping.

Promotion into `data/imports` and the future line/table, `₾`/`% მშპ-ში`, and public Excel experience require a later separately approved implementation scope.

## 17. Definition of Done

- All official files used for values are preserved with exact URLs, dates, hashes, sizes, roles, and table references.
- Stock contains complete total/domestic/external Government Debt for 2013-2025.
- Actual service contains complete principal/interest and total/domestic/external Government Debt for 2013-2025.
- Rates contain every exact official Government Debt value found for the 2015-2025 target grid, with no scope mixing or estimates and with every gap explicit.
- Forecast service contains principal/interest and total/domestic/external rows for 2026-2030 from the 2025-12-31 snapshot, with the external-Government-Debt and domestic-Treasury-securities boundaries explicit.
- The existing GDP file drives review-only GDP-share checks and is unchanged.
- The 2019 and 2022 control checks pass and the control Excel is not used as a canonical source.
- CSV, XLSX, README, methodology notes, and validation JSON agree.
- Focused tests, `npm run check`, and `npm run build` pass.
- No route, UI, serving dataset, database schema, database content, deficit feature, or existing debt-service expense value changes.
