# Budget Field Solid Bubbles Design

Date: 2026-08-18
Status: Approved by the user from visual direction A2

## Goal

Make the single-year `ბიუჯეტის ველი` chart easier to read by replacing large translucent bubbles with smaller fully opaque circles and by using consistent 10-percentage-point Y-axis intervals.

## Approved visual behavior

- Preserve the chart's existing meanings: X position is share of total, Y position is growth from the previous year, and circle size is budget amount.
- Calculate circle radius as `6 + sqrt(value / maximum value) × 16`, producing a 22px maximum radius and retaining visible differences between amounts.
- Fill every circle with its solid category color. Keep the 2px paper-colored separation stroke so overlapping opaque circles remain distinguishable.
- Round the Y-axis minimum and maximum outward to multiples of 10. Render ordinary ranges in 10-percentage-point increments, including zero; for unusually wide historical ranges, use a readable larger `1/2/5 × 10ⁿ` interval that remains a multiple of 10 and targets about eight intervals.
- Preserve the zero line, grid hierarchy, labels, overlap avoidance, tooltips, scrolling behavior, empty state, and data filtering.

## Scope

Only the Budget Field chart and its canonical design documentation change. No data model, chart position calculation, other analysis visualization, or page layout changes.

## Verification

- Rendering tests must prove that the largest circle is 22px, a quarter-size amount renders at 14px, fills are solid category colors, ordinary Y-axis labels advance in 10-point intervals, and the real extreme-growth shape produces a bounded readable tick set.
- Run the repository check, production build, and browser suite required for UI changes.
