# Municipal Indicators Visual Parity

Date: 2026-08-18
Status: Approved

## Goal

Make the sections below the municipal data explorer visually match the equivalent expenditure and revenue sections, without changing municipal calculations, metric meanings, table contents, or data coverage.

The municipalities index page will also stop showing its long bottom source and map-attribution note.

## Scope

### Municipal indicators header and headline

- Use the same shared editorial section-title treatment as expenditure and revenue.
- Keep the selected-period label in the existing top-right position.
- Present the main growth figure with the national explorer's label, spacing, type treatment, change gauge, start/end values, and short period-change sentence.
- Continue calculating the municipal headline from the official municipal total for the selected range.

### Municipal side indicators

- Preserve the existing municipality-, region-, and Georgia-specific metric meanings.
- Match expenditure and revenue for row spacing, dividers, label hierarchy, value/unit typography, supporting detail, and small trend lines.
- Build trend lines only from the same reviewed annual municipal data already used by the explorer. A metric without a changing historical series may use a flat line; no new estimates or data sources will be introduced.

### Movers

- Match expenditure and revenue for the `ყველაზე მზარდი` and `ყველაზე ნელი ზრდა` heading size, weight, color, and casing.
- Match their row spacing, dividers, labels, ranks, bars, and percentage typography while preserving the current municipal rankings and values.

### Period comparison

- Match the expenditure and revenue heading and table presentation: column proportions, header typography, cell spacing, number typography, swatches, total-row emphasis, row rules, and hover treatment.
- Preserve the municipal table's GEL amount formatting and all current comparison rows.
- Remove the explanatory subtitle beneath `პერიოდის შედარება` from expenditure and revenue.
- Do not add that subtitle to municipalities.
- Remove the small municipal year-range label beside the comparison heading.

### Municipalities index note

- Remove the entire bottom source note from `/explorer/municipalities`, including the OpenStreetMap attribution shown in the supplied screenshot.
- Keep data/source notes on individual municipality, region, and Georgia explorer pages unchanged.
- Keep source and licensing documentation elsewhere in the product and repository unchanged.

## Implementation approach

Make surgical changes in the existing municipal and national indicator components. Reuse the existing editorial primitives and sparkline component instead of creating a new design system or broad component refactor. Extend the municipal indicator input only as needed to render the already-available annual series.

## Responsive behavior

Preserve the existing breakpoints: the headline and side indicators stack on narrower screens, mover columns collapse to one column, and the comparison table remains readable without overflowing the page.

## Verification

- Add browser regression coverage for the removed municipalities-index note.
- Add browser regression coverage for the shared heading typography, removed comparison helper text/range label, headline gauge, and municipal side trend lines.
- Preserve existing data tests for municipal KPI meanings and comparison values.
- Run the repository's required checks from `apps/web`, followed by a production build and focused browser tests for the affected national and municipal routes.

## Out of scope

- Changing municipal metric definitions or values.
- Adding population, per-capita, or other new municipal indicators.
- Changing the main chart, series selector, range controls, CSV export, or source data.
- Removing source notes from municipality, region, or Georgia detail explorers.
- Publishing, merging, or deploying this change unless separately authorized.
