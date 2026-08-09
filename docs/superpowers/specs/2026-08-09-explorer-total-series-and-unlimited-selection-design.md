# Explorer Total Series and Unlimited Selection Design

**Date:** 2026-08-09
**Status:** Approved for implementation planning

## 1. Goal

Make totals visible and selectable in every multi-year budget explorer, simplify the series-selection controls, and remove the fixed chart-line limit everywhere.

For municipalities, the visible total must use the official Ministry of Finance total rather than the sum of the ten functional categories. The explorer must not add a balancing category or show reconciliation warnings.

## 2. Scope

This design applies to the time-series selectors and visualizations for:

- national expenditure by functional field;
- national expenditure by ministry and program;
- national revenue;
- municipality and regional municipal-budget explorers.

It also updates the municipal methodology and all repository-owned product specifications, instructions, copy, and tests that describe or enforce the former fixed-series limit or the former public reconciliation-warning behavior.

The municipality index map and ranked-list experience are unchanged.

## 3. Total-series behavior

### 3.1 Shared behavior

Every applicable series selector exposes its dataset total as the first row.

The total series:

- is selected by default alongside the existing latest-year top-five category selection;
- stays visually first in the selector even when search or other selections change;
- uses the neutral ink/black chart treatment instead of a category color;
- participates in the chart, table, URL state, clear-all action, and select-all action;
- can be unchecked and removed like any other series.

“Pinned” in this design refers only to the total row's position and visual treatment. It does not mean that the series is mandatory.

### 3.2 Georgian labels

- Expenditure by functional field: `მთლიანი ხარჯი`
- Expenditure by ministry/program: `მთლიანი ხარჯი`
- Revenue: `მთლიანი შემოსავლები`
- Municipalities and municipal regions: `მთლიანი ბიუჯეტი`

Existing stable total identifiers should be reused. No duplicate total records or synthetic balancing series should be introduced.

## 4. Series-selector controls

The selector header follows the approved compact pattern:

- left side: `სერიები {selected} / {all}`;
- right side when one or more series are selected: `გასუფთავება`;
- right side when no series are selected: `ყველას მონიშვნა`.

`გასუფთავება` clears every selected series. `ყველას მონიშვნა` selects every selectable series.

Search filters only the visible list. It does not change the scope of either bulk action, and the denominator remains the total number of selectable series rather than the number of search matches.

## 5. Remove the chart-series limit

There is no maximum number of selected line-series.

Implementation removes everything that exists only to support the former fixed-series cap, including:

- the shared maximum-series constant;
- selection blocking and limit messages;
- chart-data slicing or overflow behavior;
- cap-specific callouts and accessibility copy;
- cap-specific test expectations;
- statements of the limit in repository-owned specifications, plans, instructions, and maintained design documentation.

Selecting all series must actually render all selected series in the chart and table. The default remains the total plus the existing top five so the first view stays legible; unlimited selection is user-driven.

## 6. Municipal total and percentage semantics

### 6.1 Visible total

`მთლიანი ბიუჯეტი` uses the official Ministry of Finance total-payments value (`public_total_gel`) for every municipality, region roll-up, and year.

The official total is the common value used by the municipal:

- total series;
- total table row;
- headline/KPI values;
- comparison calculations;
- percentage denominator;
- existing numeric CSV export total row.

The ten functional-category values remain unchanged.

### 6.2 Percentage view

In `% წილი` mode:

- `მთლიანი ბიუჯეტი` is exactly 100%;
- each functional category is `category amount / official MoF total`;
- functional-category percentages are allowed to sum to less than or more than 100%.

No normalization to the functional sum is performed.

### 6.3 No balancing series or explorer warning

Do not add `Other`, `Other costs`, a residual, or another balancing category for Tbilisi, Batumi, or any other municipality.

Do not show divergence warnings, warning markers, or dual-total explanations anywhere inside the explorer. Remove existing public warning callouts and source-note wording that describes two competing totals.

Internal reconciliation fields and validation remain available to the data pipeline for quality control. Removing public warnings does not remove internal validation.

## 7. Municipal methodology

Update the municipal methodology to explain why the official total may not equal the sum of functional categories:

- for 2016–2019, the official total and functional categories can come from different archived source versions;
- for later years, the official total can include financing operations that are not allocated across the ten functions;
- therefore the functional shares may total above or below 100%, while the official total itself remains 100%.

The methodology is the canonical public explanation. The explorer remains visually clean and does not repeat the warning.

A future municipal CSV enhancement should carry an explanatory methodology note or metadata so downloaded data explains why the rows may not add up. That disclosure enhancement is explicitly deferred and is not part of this implementation. The existing numeric export should nevertheless use the official total row consistently.

## 8. State and compatibility

- Existing deep-link/hash behavior remains intact.
- Total-series selections serialize through the same mechanism as other series.
- Previously valid selections remain valid.
- A URL may now contain any number of selected series.
- No new route, database schema, imported fact, or public API is required.

## 9. Implementation approach

Use the existing total items and official municipal total facts, changing the model and presentation at their current boundaries.

Avoid a broad selector rewrite. Share behavior only where the repository already has a suitable shared boundary; otherwise make small parallel changes to the national and municipal selectors.

For municipalities, make the model's public total row official-total based so charts, tables, KPIs, comparisons, and exports cannot silently disagree. Keep functional reconciliation data separate for internal validation.

## 10. Verification criteria

Implementation is complete when automated tests and browser checks demonstrate that:

1. Each applicable explorer shows the correctly labelled total first and selects it by default with the existing top five.
2. The total can be unchecked, cleared, selected again, and restored through URL state.
3. `გასუფთავება` and `ყველას მონიშვნა` operate on all series even while search is active.
4. At least seven series can be selected and every selected series reaches the chart and table.
5. No former limit message, truncation, selection blocker, or normative fixed-cap statement remains in the repository.
6. Municipal totals match official MoF total facts in amount mode.
7. The municipal total is 100% in share mode, while functional shares use the official total denominator and may sum above or below 100%.
8. No municipal residual/Other series or public reconciliation warning is rendered.
9. Municipal methodology contains the source-version and financing explanation and records the deferred CSV-disclosure decision.
10. Existing lint, type checking, unit/data tests, build, and relevant Playwright suites pass.

## 11. Out of scope

- Adding new budget facts or changing the reviewed functional-category amounts.
- Inventing or allocating residual municipal spending.
- Implementing the deferred explanatory metadata in CSV downloads.
- Redesigning charts, tables, routes, or the municipality index beyond the controls described here.
- Changing single-year analysis navigation or adding drill-down pages.
