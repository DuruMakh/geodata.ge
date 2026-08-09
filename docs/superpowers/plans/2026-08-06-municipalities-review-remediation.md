# Municipalities Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct every Important and Minor defect found in the full municipalities UI branch review without changing the served dataset or expanding v1 scope.

**Architecture:** Keep municipal calculations in `municipalData.ts`, reuse the national explorer's existing line-mode guard pattern, and keep route components responsible only for selecting the municipal facts they pass to the client. UI corrections remain inside the existing municipality components; no new component framework or data abstraction is introduced.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind v4, Vitest, Playwright.

---

### Task 1: Range-correct KPIs, source dates, labels, and movers

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts`
- Modify: `apps/web/tests/explorer/municipalData.test.ts`

- [ ] **Step 1: Write failing model tests**

Add tests that require:

```ts
expect(
  buildEntityKpis({
    model: build(2015, 2016),
    nationalTotalByYear: { 2016: 600, 2017: 740 },
    rank: 1,
    rankOutOf: 64,
  })[3]!.value,
).toBe("50.0%");

expect(build().rows.every((row) => row.enLabel === "")).toBe(true);

expect(
  latestReviewedAtForMunicipalFacts({
    sourceDocuments,
    functionFacts,
    totalFacts,
  }),
).toBe("2026-07-26");

expect(buildMovers(modelWithZeroStart).down.map((row) => row.kaLabel)).not.toContain("დაცვა");
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
npm.cmd test -- tests/explorer/municipalData.test.ts
```

Expected: FAIL because the range denominator is fixed, Georgian labels populate `enLabel`, the source-date helper does not exist, and null growth participates in ranking.

- [ ] **Step 3: Implement the minimal model changes**

Change the KPI input to a year-indexed denominator, leave municipal English labels blank, add a source-ID-filtered date helper, and filter null growth before ranking:

```ts
export type MunicipalEntityKpiInput = {
  model: MunicipalEntityModel;
  nationalTotalByYear: Record<number, number>;
  rank: number;
  rankOutOf: number;
};

const nationalTotal = endYear === undefined ? 0 : input.nationalTotalByYear[endYear] ?? 0;

enLabel: "",

const growth = model.rows
  .map(/* existing projection */)
  .filter((row): row is MunicipalMover & { growth: number } => row.growth !== null)
  .sort(/* existing order */);
```

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run the same Vitest command. Expected: PASS.

### Task 2: Route the year-indexed totals and municipal-only review date

**Files:**
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`

- [ ] **Step 1: Update the prop contract**

Replace `nationalTotalLatest` with:

```ts
nationalTotalByYear: Record<number, number>;
```

- [ ] **Step 2: Derive totals by year on each entity route**

```ts
const nationalTotalByYear = Object.fromEntries(
  years.map((year) => [
    year,
    totalFacts
      .filter((row) => row.year === year)
      .reduce((sum, row) => sum + row.publicTotalGel, 0),
  ]),
);
```

Use `latestReviewedAtForMunicipalFacts` with the facts actually in scope on all three municipal routes.

- [ ] **Step 3: Run typecheck**

Run `npm.cmd run typecheck`. Expected: PASS.

### Task 3: Excel-safe CSV output

**Files:**
- Modify: `apps/web/lib/explorer/csvExport.ts`
- Modify: `apps/web/tests/explorer/csvExport.test.ts`

- [ ] **Step 1: Write a byte-level failing test**

```ts
const bytes = new TextEncoder().encode(buildExplorerCsv(rows, [2025]));
expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
expect(new TextDecoder().decode(bytes.slice(3))).toMatch(/^year,category_id,/);
```

- [ ] **Step 2: Run the test and confirm RED**

Run `npm.cmd test -- tests/explorer/csvExport.test.ts`. Expected: first bytes are the CSV header, not `EF BB BF`.

- [ ] **Step 3: Prefix the shared public serializer**

```ts
return `\uFEFF${csvRows.join("\n")}`;
```

Update exact-string assertions to include the BOM.

- [ ] **Step 4: Run the test and confirm GREEN**

Run the focused test. Expected: PASS.

### Task 4: Unrestricted line rendering and no public reconciliation warning

**Files:**
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`

- [ ] **Step 1: Add failing browser regressions**

Cover an all-series shared hash, a deliberate empty `sel=`, and absence of a public reconciliation callout:

```ts
await page.goto(`${BASE}/explorer/municipalities/04#m=line&r=2015-2025&sel=${ALL_SERIES_IDS}`);
await expect(page.locator("[data-testid='editorial-line-chart'] path[data-series]")).toHaveCount(11);

await page.goto(`${BASE}/explorer/municipalities/04#m=line&r=2015-2025&sel=`);
await expect(page.getByTestId("no-selection-callout")).toBeVisible();
```

Assert no public reconciliation callout is rendered.

- [ ] **Step 2: Run focused Playwright tests and confirm RED**

Run `npm.cmd exec playwright test tests/browser/municipal-entity.spec.ts`. Expected: the new assertions fail.

- [ ] **Step 3: Mirror the existing explorer guards**

```ts
const noSelection = state.selectedIds.length === 0;
const chartSeries = series;
```

Render the existing Georgian no-selection callout only. Retain warning fields as internal reconciliation data; do not render them in the explorer.

- [ ] **Step 4: Rerun focused Playwright and confirm GREEN**

Expected: all municipal entity tests pass.

### Task 5: Responsive entity header

**Files:**
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/tests/browser/municipal-region.spec.ts`

- [ ] **Step 1: Add a failing 375px regression**

Open the longest region route at 375px and assert the H1 has positive width and the document has no horizontal overflow.

- [ ] **Step 2: Run the focused test and confirm RED**

Run `npm.cmd exec playwright test tests/browser/municipal-region.spec.ts`. Expected: the heading collapses.

- [ ] **Step 3: Stack and bound the navigation on mobile**

Use a column header below 768px, return to the baseline row at 768px, and give each previous/next link a bounded, truncating mobile width.

- [ ] **Step 4: Rerun the focused test and confirm GREEN**

Expected: heading remains readable with no page overflow.

### Task 6: Stable index scale and accessible anchored map tooltip

**Files:**
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/components/municipalities/region-map.tsx`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`

- [ ] **Step 1: Add failing browser regressions**

Require the ranked-row bar width to remain unchanged after filtering, the map SVG to expose a grouping role rather than atomic `img`, and an anchored tooltip to appear on hover and focus.

- [ ] **Step 2: Run focused Playwright and confirm RED**

Run `npm.cmd exec playwright test tests/browser/municipalities.spec.ts`. Expected: scale changes, role is `img`, and no tooltip exists.

- [ ] **Step 3: Implement the minimal UI corrections**

Compute the bar denominator from the unfiltered source. Change the SVG to `role="group"`. Track the focused/hovered path's bounds relative to the map host and render a token-compliant absolutely positioned tooltip containing region name and value.

- [ ] **Step 4: Rerun focused Playwright and confirm GREEN**

Expected: all municipalities index tests pass.

### Task 7: Correct the deployment-status methodology

**Files:**
- Modify: `docs/data-methodology/municipal-functional-annual-2015-2025.md`

- [ ] **Step 1: Verify current main/deployment state**

Check the current remote main SHA, live routes, and the documented DB production mode. Do not infer deployment from branch code.

- [ ] **Step 2: Replace the contradictory paragraph**

Write one dated statement that distinguishes the already-populated municipal database mirror from whether this UI branch is currently deployed.

### Task 8: Full verification

**Files:**
- Verify only; no new production files.

- [ ] **Step 1: Run unit and repository checks**

Run `npm.cmd run check` and `git diff --check`.

- [ ] **Step 2: Run production builds**

Run `npm.cmd run build`. Run the DB-mode build only when the required environment exists.

- [ ] **Step 3: Run browser coverage**

Run the three focused municipal specs, then the full `npm.cmd run test:browser` suite with enough time to distinguish test failures from Windows teardown friction.

- [ ] **Step 4: Review the final diff**

Confirm every changed line maps to one review finding and that `.claude/settings.local.json` remains untouched.
