# Municipal Indicator Layout and Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make municipality and region indicator sections span the page below the CSV panel, and make national expenditure and revenue comparisons include every category for the active period.

**Architecture:** The municipality explorer already builds all comparison rows from the range-aware model. Move only the `MunicipalIndicators` render out of the two-column workspace, matching the national explorer's layout. The national model already supplies all category rows as `comparisonRows`; use those rather than selection-limited `tableRows` for the period comparison.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Playwright.

## Global Constraints

- Preserve the warm editorial design and responsive behavior.
- Keep the selected-series state limited to the chart/table and CSV export; period comparisons show the total plus every applicable category.
- Build period comparisons from the active date range.
- Do not change municipal data, labels, or selector behavior.

---

### Task 1: Add browser regressions for municipal layout and national comparisons

**Files:**
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

**Interfaces:**
- Consumes: the existing workspace, CSV, selector, comparison, and indicator test IDs.
- Produces: tests that fail when municipal indicators do not span below the workspace or when national comparisons follow selected series or include nested programs.

- [ ] **Step 1: Write the failing tests**

```ts
await expect(page.getByTestId("municipal-workspace").locator("[data-testid='period-indicators']")).toHaveCount(0);
await expect(page.getByTestId("period-comparison").locator("tbody tr")).toHaveCount(
  await page.getByTestId("series-selector").getByTestId("series-row").count(),
);
```

- [ ] **Step 2: Run the focused browser test to verify it fails**

Run: `npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/main-explorer.spec.ts --grep "(renders municipality indicators across the page below the CSV panel|explorer hydrates with the editorial shell and default expenditure view|period comparison keeps every revenue category when the selected series change)"`

Expected: FAIL because `MunicipalIndicators` is inside `municipal-workspace` and national comparison rows are selection-scoped.

### Task 2: Move municipal indicators below the workspace and use complete national comparisons

**Files:**
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/components/main-explorer/indicators.tsx`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: `model`, `state.range`, and the existing `buildEntityKpis`, `buildMovers`, and `buildComparisonRows` helpers.
- Produces: `<MunicipalIndicators>` as a sibling after the two-column workspace and a national comparison sourced from all top-level `comparisonRows`; its props and range calculations remain unchanged.

- [ ] **Step 1: Make the minimum layout change**

```tsx
</div>
<MunicipalIndicators
  kpis={buildEntityKpis({ model, nationalTotalByYear: props.nationalTotalByYear, rankByYear: props.rankByYear, rankOutOf: props.rankOutOf })}
  movers={buildMovers(model)}
  comparison={buildComparisonRows(model)}
  startYear={state.range.start}
  endYear={state.range.end}
/>
```

```tsx
const comparisonSorted = comparisonRows
  .filter((row) => row.level !== "major_program")
  .sort((a, b) => (b.valuesByYear[endYear] ?? 0) - (a.valuesByYear[endYear] ?? 0));
```

- [ ] **Step 2: Run the focused browser test to verify it passes**

Run: `npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/main-explorer.spec.ts --grep "(renders municipality indicators across the page below the CSV panel|explorer hydrates with the editorial shell and default expenditure view|period comparison keeps every revenue category when the selected series change|ministries period comparison keeps every top-level ministry and excludes major programs)"`

Expected: PASS; the municipal indicator section spans the workspace width below CSV, and national comparisons keep the total plus every top-level category independently of selection.

### Task 3: Verify the targeted UI behavior

**Files:**
- Modify: none.

- [ ] **Step 1: Run municipal browser coverage**

Run: `npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts`

Expected: PASS with no browser console errors.

- [ ] **Step 2: Run the required checks**

Run: `npm.cmd run check && npm.cmd run build && npm.cmd run test:browser`

Expected: all checks pass.
