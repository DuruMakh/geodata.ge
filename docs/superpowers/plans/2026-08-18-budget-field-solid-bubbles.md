# Budget Field Solid Bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved smaller opaque Budget Field circles and consistent 10-percentage-point Y-axis ticks.

**Architecture:** Keep the existing SVG component and data flow intact. Change only its radius, fill, and Y-axis interval calculations, protect those visible behaviors with a server-rendered component test, and update the canonical design contract.

**Tech Stack:** Next.js 16, React 19, strict TypeScript, SVG, Vitest.

## Global Constraints

- Preserve X position as share of total, Y position as growth from the previous year, and circle size as budget amount.
- Use radius `6 + sqrt(value / maximum value) × 16` and solid category-color fills.
- Use 10-point Y-axis ticks for ordinary ranges and readable larger multiples of 10 for unusually wide historical ranges.
- Do not change data, labels, tooltips, empty-state behavior, or other charts.

---

### Task 1: Protect the approved chart behavior

**Files:**
- Create: `apps/web/tests/explorer/budgetField.test.ts`

**Interfaces:**
- Consumes: `BudgetField({ items }: { items: SnapshotItem[] })` from `components/analysis/budget-field.tsx`.
- Produces: Regression coverage over the component's rendered SVG markup.

- [ ] **Step 1: Write the failing rendering tests**

Render three real `SnapshotItem` values with amounts `100`, `25`, and `6.25`, growth rates `40%`, `0%`, and `−20%`, and literal category colors. Assert that rendered circle radii are `22`, `14`, and `10`; fills equal the literal hex colors; and Y-axis tick labels are `−30%` through `+50%` in 10-point steps.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/explorer/budgetField.test.ts` from `apps/web`.

Expected: FAIL because the current circles use translucent RGBA fills, the largest radius is 47px, and the current 80-point Y span uses 20-point tick spacing.

- [ ] **Step 3: Keep the test fixtures literal and independent**

Do not import chart constants or reproduce the production radius/tick helpers in the test. The expected radii, colors, and tick labels remain hand-derived literals.

### Task 2: Implement the approved chart geometry

**Files:**
- Modify: `apps/web/components/analysis/budget-field.tsx`
- Modify: `DESIGN.md` section 9.6

**Interfaces:**
- Consumes: Existing `SnapshotItem` values and category color tokens.
- Produces: The same accessible SVG and tooltips with revised visual geometry.

- [ ] **Step 1: Implement the minimum production change**

Set Y bounds with division by `10`. Use a 10-point step for ordinary spans and a `1/2/5 × 10ⁿ` step targeting about eight intervals for unusually wide spans. Calculate radius with `6 + Math.sqrt(item.amountGel / maxAmount) * 16`, use `fill={item.color}`, and use a 2px paper-colored circle stroke. Remove the now-unused RGBA helper.

- [ ] **Step 2: Update the canonical visual contract**

Change `DESIGN.md` section 9.6 to record the new radius formula, solid fill, 2px paper separation stroke, ordinary 10-point Y-axis intervals, and the readable extreme-range fallback.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run: `npm.cmd test -- tests/explorer/budgetField.test.ts` from `apps/web`.

Expected: PASS with both rendering assertions green.

### Task 3: Verify the complete UI change

**Files:**
- Verify only; no additional files expected.

**Interfaces:**
- Consumes: The completed component and test changes.
- Produces: Repository-level evidence that the visual change introduced no regression.

- [ ] **Step 1: Run the required repository check**

Run: `npm.cmd run check` from `apps/web`.

Expected: lint, typecheck, unit tests, and data validation all pass.

- [ ] **Step 2: Run the production build**

Run: `npm.cmd run build` from `apps/web`.

Expected: the static production build completes successfully.

- [ ] **Step 3: Run browser verification**

Run: `npm.cmd run test:browser` from `apps/web`.

Expected: the complete Playwright browser suite passes, including the single-year analysis route.

- [ ] **Step 4: Review the final diff**

Confirm that every production change traces to the approved chart treatment and that no unrelated files changed.
