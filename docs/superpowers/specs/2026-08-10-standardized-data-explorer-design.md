# Standardized Data Explorer Design

**Date:** 2026-08-10
**Status:** Approved for implementation planning

## 1. Goal

Standardize GeoData.ge's multi-year data-explorer experience so national
expenditure, national revenue, municipal budgets, and future time-series
datasets use the same visual and interaction pattern.

This is a synchronization of existing explorer components, not a new universal
framework. The current shared chart, table, range, formatting, and editorial
primitives remain the foundation. The implementation closes the remaining
duplication in the series selector and aligns the current explorers with one
approved default.

## 2. Decisions

1. Use the municipality selector as the visual starting point: compact rows,
   persistent series swatches, and category-coloured selected checkboxes.
2. Search moves above the series action/status row.
3. The action sits on the left; the series count sits on the right.
4. Every explorer defaults to its total series only. The former total-plus-top-
   five default is superseded.
5. Selection remains unlimited, and the total remains selectable and removable.
6. Grouping and measure controls are optional because they are not meaningful
   for every dataset.
7. CSV remains present and functional where it exists, but it is outside the
   standardized explorer component contract.
8. Do not introduce a generic configuration engine or a shared business-data
   model. Each dataset keeps its current state and model layer.

## 3. Scope

The implementation applies to these current time-series explorers:

- national expenditure by public field;
- national expenditure by ministry and major program;
- national revenue;
- municipality pages;
- municipal-region pages.

The same component contract is the preferred starting point for future
time-series explorers such as GDP, population, and unemployment.

The municipality index map/ranking and the single-year analysis page are not
part of this change. They are different surface types rather than instances of
the multi-year chart explorer.

## 4. Standard Explorer Contract

The standard multi-year explorer consists of:

1. chart/table mode control;
2. optional measure control, such as `% წილი`;
3. chart or table;
4. range strip;
5. source note with dataset-specific content;
6. series selector.

The current two-column workspace remains: visualization on the left and the
series selector on the right. Below the workspace breakpoint, the selector
moves beneath the visualization without changing its internal order.

Optional controls remain caller-owned:

- expenditure can provide `სფეროები / უწყებები` grouping;
- datasets with meaningful composition can provide `% წილი`;
- datasets choose their own unit and value formatter;
- datasets without those concepts omit the controls instead of showing a
  disabled or single-option control.

CSV is deliberately excluded. A dataset may continue rendering its existing
CSV button below the selector, but the shared selector neither renders nor owns
the export action, copy, or export semantics.

## 5. Series Selector Anatomy

The selector order is fixed:

1. optional grouping controls;
2. search input;
3. action/status row;
4. series rows;
5. any dataset-owned controls outside the shared selector.

### 5.1 Search

Search is the first permanent element in the selector. It remains a full-width,
34px-high, underline-only input using the editorial control border. A dataset
may provide contextual placeholder copy, such as
`ძებნა — უწყება ან პროგრამა`.

### 5.2 Action/status row

The row directly below search has:

- left: a compact checkbox-style `გასუფთავება` action when at least one series
  is selected, otherwise `ყველას მონიშვნა`;
- right: `სერიები {selected} / {all}` in the muted editorial treatment.

The denominator is the complete selectable series count, never the number of
visible search matches.

The selector does not use the national panel's current heavy 2px internal
header rule. Section-level rules around the workspace remain unchanged.

### 5.3 Series rows

Every row uses the same visual anatomy:

- 14px checkbox filled with the series colour when selected;
- 14×3px colour swatch shown persistently;
- Georgian label clamped to at most two lines;
- latest value aligned right in the numeric font;
- `tint` background for selected and hover states;
- `row-border` separator;
- total rendered first with the ink/black series token.

Hierarchy is an optional row capability, not a separate selector design.
Ministry rows can add a caret, expansion state, and indented program rows while
keeping the same checkbox, swatch, label, value, spacing, and selection states.

The list uses the existing maximum-height/scroll behavior where its content
exceeds the available panel height. Short flat lists do not acquire an
unnecessary visible scrollbar.

## 6. Selection and Search Behavior

- Initial selection is the total series only in every current explorer.
- The total is visually first, ink-coloured, selectable, and removable.
- There is no maximum selected-series count.
- `გასუფთავება` clears every selectable series.
- When no series is selected, `ყველას მონიშვნა` selects every selectable
  series.
- Search filters visible rows only. It never changes selection, the denominator,
  or the scope of either bulk action.
- Search remains transient local state and is not added to the URL.
- Search resets when the active dataset scope or grouping changes.
- Ministry/program search retains the existing hierarchy-aware behavior:
  matching program rows reveal their parent ministry, while expansion controls
  continue to work outside forced search expansion.
- Existing URL selection and range state remain compatible; only the default
  used when no valid selection is restored changes.

For a future dataset, "total" means its reviewed primary aggregate series. The
adapter must provide that series explicitly; the shared selector must not infer
or calculate it.

## 7. Minimal Component Boundary

Create one shared presentational selector and one shared series-row component,
or the smallest equivalent composition supported by the existing component
layer. They own markup, styling, accessibility, and the common interactions
described in this document.

The shared row input contains only presentation state:

- stable row ID;
- display label;
- colour;
- already formatted latest value;
- selected state;
- optional hierarchy depth and expansion state.

It does not receive budget facts, municipal facts, years, currency divisors,
taxonomy logic, or URL parsers.

The current dataset-specific layers remain responsible for preparing rows:

- the national explorer keeps its total/category/program hierarchy and
  hierarchy-aware search preparation;
- the municipal explorer keeps its flat total/function preparation;
- future explorers add a small adapter that produces the same presentation
  rows.

No existing business model is widened to accept unrelated datasets. In
particular, the national and municipal state/model modules remain separate.

## 8. Data Flow

```text
dataset model and state
        ↓
dataset-specific row adapter and formatter
        ↓
shared selector and shared row presentation
        ↓ selection / expansion callbacks
dataset state → chart, table, range and URL state
```

The chart and table continue reading the dataset's existing selected-series
model. The shared selector never becomes a second source of truth.

## 9. Empty and Error States

- No search matches: show `0 შედეგი — შეცვალე საძიებო ტექსტი.` inside the
  selector.
- No selected series: keep the existing chart-area callout instructing the user
  to select a series.
- Selected series with no points in the active range: keep the existing
  no-data-in-range callout.
- Data-load failures remain owned by the route/dataset layer; the selector does
  not add a second error system.

## 10. Responsive and Accessibility Contract

- At the existing workspace breakpoint, the full selector moves below the
  chart and receives the standard top rule.
- Search, action/status, and rows preserve their order at every width.
- Row labels can use two lines so Georgian names are not hidden unnecessarily.
- Selection buttons expose `aria-pressed`.
- The bulk action has an accessible label matching its visible state.
- Expansion uses a separate caret button with `aria-expanded`; selecting a
  ministry and expanding it remain distinct actions.
- Colour is never the only state signal: checkbox, swatch, label, and value are
  all present.
- Existing focus-ring and reduced-motion rules remain in force.

## 11. Compatibility and Documentation

This change requires no new route, database schema, imported fact, URL key, or
public API.

Implementation must update maintained documentation that currently requires
the total-plus-top-five default or the former selector order, including:

- `DESIGN.md` §§7.6–7.8 and §§8.1–8.2;
- `AGENTS.md` UX and visual guardrails;
- the approved total-series design dated 2026-08-09, with a supersedure note
  for its default-selection and selector-header rules;
- affected implementation plans and tests when they contain normative current
  behavior.

Historical documents remain historical unless they are currently treated as a
normative contract.

## 12. Verification

Automated tests and browser checks must prove:

1. expenditure, revenue, municipality, and region explorers use the same
   selector structure;
2. the initial selection is exactly one total series;
3. the total stays first and can be removed and selected again;
4. search appears above the action/status row;
5. `გასუფთავება` is left-aligned and `სერიები {selected} / {all}` is
   right-aligned;
6. clear/select-all operates on every series while search is active;
7. the displayed denominator is not search-scoped;
8. every selected series reaches the chart and table;
9. ministry/program hierarchy search and expansion still work;
10. flat municipal rows use the shared compact row treatment;
11. the selector preserves its order when stacked below the chart;
12. CSV behavior and output remain unchanged;
13. lint, type checking, unit tests, data validation, production build, and
    relevant Playwright suites pass.

## 13. Out of Scope

- A universal explorer configuration language.
- Merging national and municipal business-data models.
- Changing chart geometry, range behavior, data values, taxonomy, or units.
- Standardizing or redesigning CSV export.
- Redesigning the municipality index map/ranking.
- Redesigning the single-year analysis page.
- Adding GDP, population, unemployment, or another dataset in this change.

## 14. Definition of Done

The work is complete when all current multi-year explorers visibly behave as
one product, their duplicated selector presentation is replaced by the smallest
shared component boundary, their default selection is total-only, existing
dataset semantics remain intact, documentation is synchronized, and the full
verification suite is green.
