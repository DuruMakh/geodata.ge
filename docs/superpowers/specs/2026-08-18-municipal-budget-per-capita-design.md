# Municipal Budget per Capita Design

**Date:** 2026-08-18
**Status:** Approved design; awaiting written-spec review
**Scope:** Add a 2025 budget-per-resident comparison to the municipalities index without changing the municipal history explorers.

## 1. Goal

Make the municipality map comparable across differently sized populations. The map's existing terracotta colors will represent each municipality's 2025 budget per resident instead of its total budget.

The adjacent lists will preserve their current purpose: total budget remains the primary amount and the basis for ranking, sorting, and row bars. Budget per resident will be smaller supporting information for municipality and region rows.

## 2. Approved Product Decisions

1. The feature uses only 2025 budget and population data.
2. Municipality budget per resident is `2025 public_total_gel / 2025 population_persons`.
3. The map retains its existing six-step terracotta quantile ramp, but its buckets, legend, tooltip emphasis, and accessible descriptions use budget per resident.
4. The map heading remains compact and identifies the measure and year. It does not add a separate population-date label.
5. The map tooltip shows budget per resident as the primary value and total budget as supporting context.
6. Municipality list rows remain ranked and sorted by total budget. Their bar widths and primary amounts remain total-budget based. Budget per resident appears as smaller supporting information.
7. Region list rows retain the same total-budget ranking, sorting, bars, and primary amounts. Each region also receives a smaller budget-per-resident figure.
8. The Georgia country row does not receive a per-resident figure. Its numerator includes aggregate-only budgets that are not territorially assigned to the 64 public municipalities, so it is not directly comparable with municipality and region rows.
9. The index KPI section adds the median 2025 municipal budget per resident across the 64 public municipalities. It does not use a misleading simple or population-weighted “average municipality” label.
10. Municipality, region, and Georgia detail pages remain unchanged. No historical per-capita series or measure toggle is introduced.

## 3. Data Source and Boundary

Use the project's reviewed Geostat population package and its normalized 2025 rows:

- exactly 64 public municipalities;
- `year = 2025`;
- `reference_date = 2025-01-01`;
- `population_persons` as the denominator;
- no estimates and no gap filling.

The attached census workbook is supporting source context, but it is dated 14 November 2024. It is not the selected denominator because the user chose the latest 2025 population measure.

The implementation promotes only the reviewed 2025 population slice into the application data-serving contract. It must preserve the existing source file, manifest, mapping, transformation, and validation evidence. It must not silently copy values into component code or introduce population data for other years.

## 4. Calculations

### 4.1 Municipalities

For each of the 64 public municipalities:

```text
budget_per_resident_gel = public_total_gel (2025) / population_persons (2025)
```

Keep full numeric precision for bucketing, sorting internal calculation results, tests, and exportable domain values. Round only for display to the nearest whole GEL.

A zero, negative, missing, duplicate, or non-finite population denominator is a validation error. A missing or duplicate 2025 municipal total is also an error. The application must not display zero or omit a municipality as a fallback.

### 4.2 Regions

For each of the 11 region rows:

```text
region_budget_per_resident_gel = displayed_region_total_gel (2025)
                               / sum(member_population_persons (2025))
```

The numerator is the same region total already shown in the list. This means Adjara uses its existing consolidated 2025 total, including the approved Adjara republican-budget adjustment, divided by the summed population of its six public municipalities. Other regions use their existing summed municipal totals.

Region per-resident values are supporting context only. Region ranking, sorting, row bars, and primary amounts remain based on total budget.

### 4.3 Median KPI

Calculate the median of the 64 municipality-level per-resident values. With an even population of 64 observations, the median is the mean of the 32nd and 33rd values after ascending numeric sort. The current reviewed data produces approximately `1,335 GEL`, but the interface must calculate this from served facts rather than hardcode it.

## 5. Application Data Flow

### 5.1 Canonical application data

Add a narrowly scoped canonical population import containing the 64 reviewed 2025 municipality rows and the provenance fields required by the existing municipal data standards. Generation or composition must be deterministic and traceable to the preserved Geostat package.

The CSV serving path and the Prisma/Supabase mirror path must expose the same rows and values. The transactional database import must validate and reconcile population rows together with the rest of the served municipal dataset; no direct database editing is allowed.

### 5.2 Server composition

The municipalities index server page joins 2025 population to the existing 2025 public municipal totals by canonical municipality code. A pure calculation layer returns:

- municipality total budget and budget per resident;
- region total budget and budget per resident;
- map-ready per-resident values and quantile buckets;
- the 64-municipality median.

The client receives display-ready values. It does not load spreadsheets, parse source files, or calculate source joins.

### 5.3 Map contract

Rename generic map value fields where necessary so their meaning is explicit. The map model must not continue to call a per-resident value `valueGel` if that can be confused with total budget. Shapes and markers carry both:

- `budgetPerResidentGel`, which controls the bucket and primary tooltip value;
- `totalBudgetGel`, which appears as supporting tooltip context.

Legend endpoints are the minimum and maximum municipality per-resident values. Quantile bucketing continues to use the polygon-value population already established by the map contract so marker-only city handling remains unchanged.

## 6. Interface Design

### 6.1 Map heading and legend

The map heading identifies `budget per resident` and `2025` in Georgian. It does not add a separate visible population-date or census label.

The legend uses whole-GEL per-resident values rather than million-GEL total-budget formatting. Its copy makes the unit understandable without adding a new card, control, or explanatory panel.

### 6.2 Tooltip and accessibility

Pointer and keyboard tooltips contain:

1. municipality name;
2. 2025 budget per resident, visually primary;
3. 2025 total budget, visually secondary;
4. the existing navigation arrow.

Accessible names include the municipality name, per-resident figure, total-budget figure, and municipality-opening action. Existing keyboard activation, focus treatment, containment, list synchronization, and direct navigation behavior remain unchanged.

### 6.3 Municipality and region lists

The list hierarchy remains total-budget first:

- rank: total-budget rank;
- order: descending total budget;
- bar: total budget relative to the largest row in the active list;
- primary numeric value: formatted total budget;
- supporting value: formatted whole-GEL budget per resident.

Municipality rows retain their region subtitle. Region rows retain their member-count subtitle. The new supporting value must fit the existing narrow list column at desktop and mobile widths without truncating the primary amount or making the rows look like two competing rankings.

The Georgia row remains unchanged and shows no per-resident supporting amount.

### 6.4 KPI

Add or replace one index KPI with:

- label: median municipal budget per resident;
- value: whole GEL;
- detail: `2025 · 64 municipalities`.

The exact Georgian copy will follow the editorial voice and canonical terminology in `DESIGN.md`.

## 7. Source Visibility

Do not place a separate population-date label beside the map. Add concise Geostat population attribution to the existing municipal source note and document the denominator, date, transformation, and limitations on the municipality methodology page.

This keeps the analytical surface compact without hiding provenance. Downloadable or internal source records continue to carry the precise source and reference-date fields.

## 8. Validation and Error Handling

Build or data validation must fail when:

- the 2025 population set is not exactly the 64 canonical public municipality codes;
- an excluded code appears in the public population slice;
- a municipality has a missing, duplicate, zero, negative, or non-finite population;
- a municipality lacks exactly one 2025 total-budget fact;
- a region does not reconcile to the exact sum of its member populations;
- CSV and database population rows differ;
- the promoted 2025 data no longer reconciles with the preserved reviewed package;
- source hashes, provenance, or deterministic generated output are stale.

No runtime “no data” color is permitted for a member of the complete 64-municipality panel. Existing occupied-area overlays remain the only hatched, non-data geometry.

## 9. Verification

### 9.1 Unit and data tests

- Exactly 64 joined municipality calculations for 2025.
- Exact canonical-code equality across population, total-budget facts, registry, and map targets.
- Representative municipal calculations checked from source numerator and denominator.
- All 11 regional population sums and per-resident calculations checked, including consolidated Adjara.
- Median calculation checked for the even 64-value set.
- Six map buckets computed from per-resident values, not total budgets.
- Legend endpoints equal the per-resident minimum and maximum.
- Municipality and region ranks, order, bars, and primary amounts remain total-budget based.
- Georgia row has no per-resident value.
- CSV/database parity and preserved-package reconciliation pass.

### 9.2 Browser and visual tests

- Map color, legend, visible tooltip, and accessible name use the correct 2025 per-resident values.
- Tooltip still contains the correct total budget as secondary context.
- Map/list hover and focus synchronization remains exact.
- Municipality list remains total-budget ranked while showing per-resident support.
- Region list remains total-budget ranked while showing correctly aggregated per-resident support.
- Georgia row remains visually unchanged.
- Median KPI matches the served calculation.
- Desktop and narrow-screen rows remain legible with no clipping or horizontal page overflow.
- Existing map keyboard, occupied-area, navigation, and tooltip-containment behavior remains intact.

Run the repository's required data validation, focused unit tests, full check, lint, production build, browser suite, and `git diff --check`. Publishing additionally requires the CI-gated PR, merge, deployment, and live-route verification workflow.

## 10. Documentation Updates During Implementation

Update the durable documents that currently exclude or describe municipal per-capita data:

- `Project_Definition.md`: move this bounded 2025 measure into v1 scope and remove the outdated “no reviewed population dataset” exclusion;
- `DESIGN.md` section 20: change map bucketing from total budget to per resident and document the total-first list hierarchy;
- municipal data methodology: document the 2025 denominator, region aggregation, median, provenance, validation, and country-row exclusion;
- database import methodology and schema documentation where the population mirror is introduced.

## 11. Non-goals

- No population values or budget-per-resident calculations for years other than 2025.
- No historical per-capita chart, table column, CSV measure mode, or year selector.
- No per-capita toggle.
- No change to total-budget ranking, ordering, row bars, or primary list values.
- No per-capita value for the Georgia aggregate row.
- No per-capita addition to municipality, region, or Georgia detail pages.
- No change to municipal budget definitions, functional categories, excluded-code treatment, map geometry, occupied-area behavior, or routes.
- No separate population-date label or new explanatory panel beside the map.

## 12. Completion Criteria

The feature is complete when the 2025 municipality map uses validated budget-per-resident quantiles; map tooltips and legend show the correct per-resident measure; municipality and region lists keep total budgets primary while adding correct supporting per-resident figures; the median KPI is derived from all 64 municipalities; the country row remains excluded; all source, parity, calculation, accessibility, browser, and visual checks pass; and the required production workflow is completed when publishing is authorized.
