# Series Selector Indeterminate State Design

**Date:** 2026-08-11  
**Status:** Approved design; implementation pending

## Goal

Make the shared series bulk control communicate partial selection correctly.
The current control looks empty unless every series is selected, which makes a
partially selected explorer appear to have no aggregate selection state.

## Scope

This is a presentation and accessibility change inside the existing shared
`SeriesSelector`. It applies automatically to the national, municipal, and
regional multi-year explorers.

The change does not alter selection data, search behavior, URL state, CSV
exports, row checkboxes, charts, tables, or dataset-specific adapters.

## Three States

The bulk control derives its state from `selectedCount` and `totalCount`:

1. **None selected** (`selectedCount === 0`)
   - empty square;
   - label: `ყველას მონიშვნა`;
   - accessibility state: `aria-checked="false"`;
   - click selects every selectable series.
2. **Partially selected** (`0 < selectedCount < totalCount`)
   - square containing a centered horizontal dash;
   - label: `გასუფთავება`;
   - accessibility state: `aria-checked="mixed"`;
   - click clears every selected series.
3. **All selected** (`selectedCount === totalCount`, with at least one
   selectable series)
   - ink-filled square containing the existing paper checkmark;
   - label: `გასუფთავება`;
   - accessibility state: `aria-checked="true"`;
   - click clears every selected series.

The partial-state dash uses the ink colour and remains visually distinct from
the checked state: the square stays paper/transparent rather than receiving the
full ink fill.

## Semantics and Interaction

The button exposes `role="checkbox"` and
`aria-checked="false" | "mixed" | "true"`. It remains a button so keyboard
activation and the existing clear/select-all callback do not change.

The visible action label remains the authoritative description of the click:
`ყველას მონიშვნა` when empty and `გასუფთავება` whenever one or more series are
selected. Search does not affect the state, denominator, or click scope.

## Shared Component Boundary

The shared component already receives `selectedCount`, `totalCount`,
`hasSelection`, and `allSelected`. The visual state is derived there; callers
do not gain a new state model or dataset-specific prop.

No second checkbox component or reusable state machine is introduced.

## Verification

Automated coverage must prove:

- none selected renders `aria-checked="false"`, an empty indicator, and
  `ყველას მონიშვნა`;
- partial selection renders `aria-checked="mixed"` and the dash, and clicking
  clears all selections;
- all selected renders `aria-checked="true"` and the checkmark, and clicking
  clears all selections;
- the same shared behavior is visible in national and municipal explorer
  browser coverage;
- search continues not to scope the bulk state or action.

Run the focused browser tests for the national and municipal explorers, then
the full non-browser gate and production build. Browser output that prints all
passes but hangs during Windows teardown must continue to be reported as
functionally green but not a clean command exit.

## Out of Scope

- changing the action-row layout or copy;
- changing row-level checkbox visuals;
- changing which series are selected by default;
- changing clear/select-all behavior;
- changing URL, CSV, chart, table, or data semantics.
