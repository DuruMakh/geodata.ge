# Municipal Indicators Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every section below the municipal explorer visually match expenditure and revenue while preserving municipal metric meanings, and remove the municipalities-index bottom note.

**Architecture:** Keep the existing `MunicipalIndicators` and national `Indicators` components. Add a small municipal presentation-model builder for the headline and side trend series, then render those values through the existing editorial primitives and `Sparkline`; make only direct markup/class changes for movers and comparison tables.

**Tech Stack:** Next.js 16, React 19, strict TypeScript, Tailwind CSS v4, Vitest, Playwright.

## Global Constraints

- Preserve all municipal calculations, metric meanings, comparison rows, GEL formatting, and selected-range behavior.
- Use only reviewed annual data already loaded by the municipal explorer; add no estimates or sources.
- Keep source notes on municipality, region, and Georgia detail explorers unchanged.
- Do not change the chart, selector, range controls, CSV export, or source data.
- Reuse existing editorial primitives and `Sparkline`; do not add dependencies or introduce a broad refactor.
- Preserve existing responsive breakpoints and readable narrow-screen tables.

---

### Task 1: Remove the requested helper and source text

**Files:**
- Modify: `apps/web/tests/browser/municipalities.spec.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/components/main-explorer/indicators.tsx`

**Interfaces:**
- Consumes: existing `municipal-source-note` and `period-comparison` test IDs.
- Produces: municipalities index without the bottom note; national comparison blocks without the explanatory subtitle.

- [ ] **Step 1: Write failing browser assertions**

Add assertions that `/explorer/municipalities` has no `municipal-source-note`, and that expenditure/revenue `period-comparison` does not contain `საწყისი მნიშვნელობა, ცვლილება და საბოლოო მნიშვნელობა (მლრდ ₾)`.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm.cmd run test:browser -- municipalities.spec.ts main-explorer.spec.ts`

Expected: the new absence assertions fail because both text surfaces still render.

- [ ] **Step 3: Remove only the requested markup**

Delete the `SourceNote` block from `MunicipalitiesIndex` and remove its now-unused import. Delete the comparison subtitle paragraph from national `Indicators`; keep all detail-page `SourceNote` usage intact.

- [ ] **Step 4: Re-run focused tests**

Run: `npm.cmd run test:browser -- municipalities.spec.ts main-explorer.spec.ts`

Expected: the new absence assertions pass.

### Task 2: Add municipal headline and side-trend presentation data

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts`
- Modify: `apps/web/tests/explorer/municipalData.test.ts`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/components/municipalities/municipal-indicators.tsx`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`

**Interfaces:**
- Produces: `buildMunicipalIndicatorPresentation(model, metrics)` returning `headline` with start/end/change/CAGR values and `sideSeries: Array<Array<number | null>>` aligned to existing side KPIs `[kpis[0], kpis[2], kpis[3]]`.
- Consumes: `MunicipalEntityModel`, the existing ranked/country metric context, and the selected-range model.

- [ ] **Step 1: Write failing unit tests for presentation series**

Cover the official-total headline, the end-year-largest function's share series, ranked entity share against `nationalTotalByYear`, and a flat country budget-count series. Assert missing values remain `null` and no estimate is generated.

- [ ] **Step 2: Run the unit test and verify failure**

Run: `npm.cmd test -- tests/explorer/municipalData.test.ts`

Expected: FAIL because `buildMunicipalIndicatorPresentation` does not exist.

- [ ] **Step 3: Implement the minimal presentation builder**

Calculate only from `model.years`, `model.totalRow.valuesByYear`, existing function rows, and the supplied ranked/country context. Return raw numeric series so formatting remains a component concern.

- [ ] **Step 4: Re-run the unit test**

Run: `npm.cmd test -- tests/explorer/municipalData.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing browser assertions for the municipal KPI layout**

Assert that a municipal detail page renders a `municipal-change-gauge`, start/end value labels, a period-change sentence, three `side-kpi` rows, and one sparkline inside each row.

- [ ] **Step 6: Run the focused municipal browser test and verify failure**

Run: `npm.cmd run test:browser -- municipal-entity.spec.ts`

Expected: FAIL because the municipal gauge and side sparklines do not yet render.

- [ ] **Step 7: Render the national visual pattern with municipal data**

Pass the new presentation model through `MunicipalExplorer`. In `MunicipalIndicators`, use `SectionTitle`, `Overline`, and `Sparkline`; render `პერიოდის ცვლილება`, the large signed change, gauge, start/end labels, explanatory sentence, and side trend lines using the existing national spacing and dividers. Preserve municipal KPI labels and details.

- [ ] **Step 8: Re-run municipal unit and browser tests**

Run: `npm.cmd test -- tests/explorer/municipalData.test.ts`

Run: `npm.cmd run test:browser -- municipal-entity.spec.ts`

Expected: PASS.

### Task 3: Align municipal movers and comparison table

**Files:**
- Modify: `apps/web/components/municipalities/municipal-indicators.tsx`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`

**Interfaces:**
- Consumes: existing municipal movers/comparison values and the national component's established Tailwind classes.
- Produces: municipal mover and comparison markup with the same typography, spacing, rules, column proportions, hover treatment, and responsive behavior as national pages.

- [ ] **Step 1: Write failing visual-style assertions**

For a municipal detail page, assert both mover headings and the comparison heading compute to `13px` and weight `600`; assert the comparison block has no subtitle or separate `startYear → endYear` label; assert the table uses four fixed columns and rows expose the same hover transition class as national rows.

- [ ] **Step 2: Run the focused browser test and verify failure**

Run: `npm.cmd run test:browser -- municipal-entity.spec.ts`

Expected: FAIL on the current 11px uppercase mover headings, 22px comparison heading, year-range label, and differing table markup.

- [ ] **Step 3: Apply the national presentation classes**

Use semantic `h3` headings, 13px/600 ink styling, matching mover row gaps/borders/type, and the national table's fixed 44% first column, 11px headers, 12.5px numeric cells, row padding, swatch alignment, rules, and hover transition. Retain `formatAmount` for municipal GEL amounts and retain the current tinted total row.

- [ ] **Step 4: Re-run focused browser tests**

Run: `npm.cmd run test:browser -- municipal-entity.spec.ts main-explorer.spec.ts municipalities.spec.ts`

Expected: PASS.

### Task 4: Final verification

**Files:**
- Verify only; no planned production changes.

**Interfaces:**
- Consumes: all completed changes.
- Produces: evidence that code quality, data validation, static build, and affected routes remain healthy.

- [ ] **Step 1: Run required repository checks**

Run from `apps/web`: `npm.cmd run check`

Expected: lint, strict TypeScript, Vitest, and data validation all pass.

- [ ] **Step 2: Run a production build**

Run from `apps/web`: `npm.cmd run build`

Expected: Next.js static production build passes.

- [ ] **Step 3: Run focused browser coverage**

Run from `apps/web`: `npm.cmd run test:browser -- municipal-entity.spec.ts municipalities.spec.ts main-explorer.spec.ts`

Expected: all selected Playwright tests pass without runtime or console errors.

- [ ] **Step 4: Check the final diff**

Run: `git diff --check`

Expected: no whitespace errors. Review `git status --short` and confirm only the specification, plan, tests, and requested implementation files changed.
