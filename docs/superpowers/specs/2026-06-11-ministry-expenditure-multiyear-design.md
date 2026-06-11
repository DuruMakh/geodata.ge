# Ministry Expenditure Multi-Year View Design

Date: 2026-06-11
Status: Approved for user review before implementation planning

## Goal

Add a ministry-based expenditure view to the existing multi-year explorer.

The current expenditure view answers: what public spending field did money go to?
The new view answers: which administrative ministry or owner spent it, and which large programs under that owner drove the amount?

This is a multi-year explorer feature only. It does not add single-year snapshot changes or drilldown pages.

## Scope

Included:

- Add an expenditure grouping switch in multi-year mode: `Fields | Ministries`.
- Keep `Fields` as the default expenditure grouping.
- In `Ministries`, show all ministry/admin category rows.
- In `Ministries`, show program rows nested under their ministry/admin category.
- Include program rows only when the program reaches at least `100,000,000 GEL` in any year from 2017 through 2025.
- Keep the existing multi-year chart, table, year-range, measure, series limit, and CSV export behaviors.
- Preserve source metadata and validation for administrative spending data.

Excluded:

- No single-year snapshot changes.
- No clickable drilldown or detail pages.
- No all-program view below the `100,000,000 GEL` threshold.
- No merging of public spending fields and administrative rows in one selector.
- No new broad data catalog surface.

## Product Behavior

The multi-year explorer keeps the current high-level mode switch: `Expenditure | Revenue`.

When the user is in expenditure multi-year mode, a second grouping control appears:

```text
Fields | Ministries
```

`Fields` uses the current public spending-field facts and remains the default.

`Ministries` swaps the model to administrative expenditure facts:

- A derived total row represents total administrative expenditure.
- Ministry/admin category rows are selectable.
- Program rows are selectable and visually nested under their parent ministry/admin category.
- Program rows are limited to programs that reach at least `100,000,000 GEL` in any year in the full 2017-2025 dataset.

The switch should not appear in revenue mode because revenue does not have ministry ownership semantics in v1.

## Data Semantics

Administrative spending is a separate classification from public spending fields.

Public spending fields answer functional or citizen-readable categories such as health, education, and social protection.

Administrative spending answers ownership categories such as ministries, debt service, and other state-wide payments.

The two systems should stay separate in the app model and UI. A ministry is not a child of a public spending field.

Administrative facts use:

- `admin_category` rows for ministry/admin totals.
- `major_program` rows for visible program series.
- `parent_item_id` to connect visible programs to their ministry/admin category.
- official program labels and official codes for program identity.

The program threshold is dataset-wide:

```text
include program if max(amount_gel across 2017-2025) >= 100,000,000
```

If the selected UI range is narrower, the program still remains eligible as long as it passed the full-dataset threshold.

## Data Pipeline

The admin spending generator should use a `100,000,000 GEL` major-program threshold.

Generation should produce:

- `data/imports/admin-spending-facts-2017-2025.csv`
- `data/taxonomy/admin-spending-categories.json`
- `data/reports/admin-spending-2017-2025-report.json`
- `data/mappings/review/admin-spending-major-program-review-2017-2025.csv`

Validation should preserve these checks:

- Ministry/admin category totals reconcile to official source totals by year within the existing tolerance.
- Admin category IDs are stable lowercase ASCII IDs.
- Program rows have a parent ministry/admin category.
- Program rows below the `100,000,000 GEL` dataset-wide threshold are not exposed.
- Source IDs resolve to registered source documents.

The review CSV can remain internal, but visible program rows should not be presented as a manually curated public taxonomy. They are official program rows filtered by size and grouped by administrative owner.

## UI Details

The selector should support hierarchy in `Ministries` view:

- Ministry/admin category row at the parent level.
- Program rows indented beneath the parent.
- Parent and child rows are independently selectable.
- Search should match ministry labels, program labels, English labels when available, official codes, and IDs.
- Search results should preserve enough parent context that a matching program is not shown without its ministry context.

Labels:

- Ministry/admin category labels come from the admin spending taxonomy.
- Program labels come from the official source label.
- Program labels may include official code as secondary metadata where needed to distinguish similar names.

Default selection:

- `Fields` default remains total expenditure.
- `Ministries` default should be the derived administrative total.

Chart and table behavior:

- Use existing line/table rendering.
- Use existing `Nominal GEL` and `Share of total` measure semantics.
- Share of total in `Ministries` is share of administrative total for that year.
- The chart series limit still applies in line mode.
- Table mode has no chart-series limit, matching current behavior.

CSV export:

- Export the currently active grouping.
- Include enough metadata to distinguish `Fields` rows from `Ministries` rows.
- For `Ministries`, include parent item ID, level, official code, official label, and official institution label when available.

## Implementation Boundaries

Prefer extending the existing explorer model with an explicit expenditure grouping input rather than adding a separate page.

The implementation should avoid mixing `spending.*` and `admin_spending.*` rows in the same item list. The grouping switch decides which fact set feeds the model.

The implementation should keep the single-year model untouched unless a type or shared helper must change for compilation.

## Verification

Verification should cover:

- The admin spending generator uses `100,000,000 GEL`.
- Programs below the threshold do not appear in the generated visible program set.
- Admin category totals still reconcile to source totals by year.
- The multi-year explorer defaults to `Fields`.
- Switching to `Ministries` shows the derived total, ministry rows, and nested eligible programs.
- Program rows remain nested under the correct parent after search.
- Chart/table values and share-of-total values are computed from the active grouping.
- CSV export reflects the active grouping and includes administrative metadata.

