# GeoData.ge Final V1 UI Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Budget Explorer into the final v1 UI: a Georgian-first dark analytical dashboard with finished desktop/mobile layouts, consistent visual language, clear controls, trustworthy source/planned states, and production-grade browser verification.

**Architecture:** Keep the existing data and explorer state architecture. Implement the final design through scoped UI files: global visual tokens in `globals.css`, high-level layout in `MainExplorer`, control/selector/chart/table refinements in existing main-explorer components, and final single-year composition in existing `components/single-year/*`. Browser tests lock the final v1 layout instead of relying on fragile visual guesses.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts 3, Playwright, Vitest.

---

## Product Boundary

Plan 7 is the final v1 **UI design** plan, not a data plan.

Included:

- Final visual direction for v1.
- Final desktop layout for multi-year explorer.
- Final desktop layout for single-year snapshot.
- Final mobile layout for both views.
- Final component styling for shell, controls, chart area, selector, table, summaries, source label, planned badge, empty states, and single-year sections.
- Browser coverage for desktop, mobile, multi-year, single-year, revenue, expenditure, and no page-level overflow.
- Screenshot smoke artifacts for visual review.

Excluded:

- Data ingestion changes.
- Taxonomy/glossary edits.
- Supabase/Prisma work.
- New chart modes.
- Stacked mode implementation.
- Light mode.
- Public provenance panels.
- New routes or a marketing homepage.
- Clickable drilldown/detail pages.

## Final V1 UI Target

The final v1 interface is a **budget intelligence cockpit**, not a civic landing page and not a generic chart demo.

### First View

The first viewport must show the real product immediately:

- Header with `GeoData.ge / Budget Explorer`.
- Georgian product title.
- Current active side, view mode, selected year/range, and active total.
- Controls for expenditure/revenue, multi-year/single-year, chart/table modes where applicable, measure, and years.
- Primary chart/table/snapshot surface.
- Selector panel in multi-year desktop layout.
- Minimal public source label.

There is no marketing hero. The app opens directly into the explorer.

### Visual Identity

The finished design should feel:

- Dark.
- Analytical.
- High-contrast.
- Neon/terminal-like.
- Data-first.
- Georgian-readable.

It should avoid:

- Decorative gradients that compete with charts.
- Large marketing copy blocks.
- Soft civic-report beige/blue styling.
- One-note purple or dark-slate sameness.
- Card-heavy layouts where every block floats separately.
- Any effect that reduces chart or table legibility.

### Layout

Desktop multi-year:

- Full-page dark shell.
- Left main work area: header, controls, chart/table, source label.
- Right selector rail: sticky on desktop, scrollable internally.
- Below-scroll period summary remains full-width below the first viewport.

Desktop single-year:

- Same shell and controls.
- One-column snapshot layout.
- No empty sidebar.
- Sections appear in this order: headline cards, treemap, Every 100 GEL, spending petals, Budget Field, ranking.

Mobile:

- No page-level horizontal overflow.
- Header stacks cleanly.
- Controls wrap without text clipping.
- Chart/table/Budget Field may scroll inside their own fixed-format containers.
- Selector appears below chart in multi-year mode.
- Single-year sections stack with consistent spacing.

### Trust States

V1 public trust UI is minimal but visible:

- Source label always appears near the active data surface.
- Planned values show a subtle planned badge or planned note.
- Empty states are Georgian-first and visually distinct without feeling like errors.
- CSV export remains visible only for multi-year mode.

## Source Documents

Read before executing:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `docs/superpowers/plans/2026-05-10-geodata-budget-v1-foundation.md`
- `docs/superpowers/plans/2026-05-11-geodata-main-explorer-ui.md`
- `docs/superpowers/plans/2026-05-13-geodata-single-year-snapshot.md`

Optional if present:

- `docs/superpowers/plans/2026-05-13-geodata-real-revenue-data.md`

Do not block Plan 7 execution if the optional revenue plan is missing. Plan 7 should work against whatever validated `budget-facts-2023-2025.csv` currently provides.

## Current Baseline

Current app ownership:

- `apps/web/app/page.tsx` loads app data and passes it to `MainExplorer`.
- `apps/web/components/main-explorer/main-explorer.tsx` owns side, view mode, chart mode, measure, years, selections, CSV export, source label, and high-level layout.
- `apps/web/components/main-explorer/explorer-controls.tsx` renders all controls.
- `apps/web/components/main-explorer/chart-frame.tsx` renders line and bar charts.
- `apps/web/components/main-explorer/explorer-table.tsx` renders table mode.
- `apps/web/components/main-explorer/series-selector.tsx` renders the multi-year selector rail.
- `apps/web/components/main-explorer/period-summary.tsx` renders below-scroll summaries.
- `apps/web/components/single-year/*` renders the single-year snapshot.
- `apps/web/app/globals.css` owns the global surface.
- `apps/web/tests/browser/main-explorer.spec.ts` owns browser-level layout coverage.

Known constraints:

- There may be unrelated dirty files from Plan 5 revenue work. Do not stage or modify them unless this plan explicitly names them.
- Some terminal output may show mojibake for Georgian text on Windows. Do not rewrite Georgian strings just because terminal output looks broken.
- If `npm run build`, `npm run test`, `npm run data:validate`, or `npm run test:browser` fails with Windows `spawn EPERM`, rerun the same command with Codex escalation before treating it as a product failure.

## File Structure

Modify:

```text
apps/web/app/globals.css
apps/web/components/main-explorer/main-explorer.tsx
apps/web/components/main-explorer/explorer-controls.tsx
apps/web/components/main-explorer/chart-frame.tsx
apps/web/components/main-explorer/explorer-table.tsx
apps/web/components/main-explorer/series-selector.tsx
apps/web/components/main-explorer/period-summary.tsx
apps/web/components/single-year/single-year-snapshot.tsx
apps/web/components/single-year/snapshot-headline-cards.tsx
apps/web/components/single-year/snapshot-treemap.tsx
apps/web/components/single-year/every-100-gel.tsx
apps/web/components/single-year/spending-petals.tsx
apps/web/components/single-year/budget-field.tsx
apps/web/components/single-year/single-year-ranking.tsx
apps/web/tests/browser/main-explorer.spec.ts
```

Do not modify:

```text
apps/web/lib/data/*
apps/web/lib/explorer/*
apps/web/scripts/*
data/*
prisma/*
```

## Task 1: Add Final UI Browser Criteria

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

This task intentionally starts with browser tests that fail until Tasks 3-6 add the matching final UI hooks and containment. Do not commit this task by itself. Keep the test edits in the working tree and commit them in Task 7 after the UI implementation passes.

- [ ] **Step 1: Add Playwright `Page` import**

Change the import to:

```ts
import { expect, test, type Page } from "@playwright/test";
```

- [ ] **Step 2: Add console and overflow helpers**

After `previewHosts`, add:

```ts
function collectConsoleProblems(page: Page) {
  const consoleProblems: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  return consoleProblems;
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));

  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);
}
```

Replace the repeated inline console listener setup in existing tests with:

```ts
const consoleProblems = collectConsoleProblems(page);
```

- [ ] **Step 3: Add final desktop shell assertions**

In the existing desktop explorer test, after the initial chart assertion, add:

```ts
await expect(page.getByTestId("explorer-shell")).toBeVisible();
await expect(page.getByTestId("explorer-header")).toBeVisible();
await expect(page.getByTestId("explorer-controls")).toBeVisible();
await expect(page.getByTestId("active-total-card")).toBeVisible();
await expect(page.getByTestId("source-label")).toBeVisible();
await expect(page.getByTestId("series-selector")).toBeVisible();
await expectNoPageOverflow(page);
```

- [ ] **Step 4: Add final mobile explorer test**

Append:

```ts
test("final mobile explorer layout has no page overflow", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100");

  await expect(page.getByTestId("explorer-header")).toBeVisible();
  await expect(page.getByTestId("explorer-controls")).toBeVisible();
  await expect(page.getByTestId("chart-frame")).toBeVisible();
  await expect(page.getByTestId("source-label")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expectNoPageOverflow(page);

  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 5: Add final mobile single-year test**

Append:

```ts
test("final mobile single-year layout keeps fixed visuals contained", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100");
  await page.getByTestId("view-single_year").click();

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("spending-petals")).toBeVisible();
  await expect(page.getByTestId("budget-field-scroll")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
  await expectNoPageOverflow(page);

  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 6: Verify the tests fail for the intended reason**

Run from `apps/web`:

```powershell
npm run test:browser
```

Expected:

```text
FAIL
```

The failure should be from missing final UI `data-testid` hooks or overflow, not from app crashes.

Do not commit the failing state. Continue to Task 2 with these browser-test edits still unstaged.

## Task 2: Define Final V1 Visual Tokens

**Files:**

- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add final surface tokens**

Replace the `:root` block with:

```css
:root {
  --background: #05070b;
  --foreground: #f4f4f5;
  --panel: rgba(9, 12, 20, 0.84);
  --panel-strong: rgba(0, 0, 0, 0.62);
  --line-cyan: rgba(34, 211, 238, 0.24);
  --line-lime: rgba(163, 230, 53, 0.28);
  --muted: #a1a1aa;
}
```

- [ ] **Step 2: Replace the body surface**

Replace the `body` rule with:

```css
body {
  min-width: 320px;
  overflow-x: hidden;
  background:
    linear-gradient(180deg, rgba(34, 211, 238, 0.1), transparent 360px),
    radial-gradient(circle at 82% 0%, rgba(163, 230, 53, 0.09), transparent 320px),
    linear-gradient(135deg, rgba(39, 39, 42, 0.34) 0 1px, transparent 1px 18px),
    var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 3: Add final interaction states**

Below the existing `button, select, input` rule, add:

```css
button,
select,
input {
  min-width: 0;
}

button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid #a3e635;
  outline-offset: 2px;
}

::selection {
  background: rgba(163, 230, 53, 0.35);
  color: #ffffff;
}
```

- [ ] **Step 4: Run lint**

Run from `apps/web`:

```powershell
npm run lint
```

Expected:

```text
No lint errors
```

- [ ] **Step 5: Commit**

Run from repo root:

```powershell
git add apps/web/app/globals.css
git commit -m "style: define final v1 visual surface"
```

## Task 3: Implement Final Explorer Shell

**Files:**

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`

- [ ] **Step 1: Add shell test ID and final page padding**

Change the top-level `<main>` to:

```tsx
<main data-testid="explorer-shell" className="min-h-screen bg-background px-3 py-3 text-foreground sm:px-5 sm:py-5 lg:px-8">
```

Change the first section to:

```tsx
<section
  className={`grid min-h-[calc(100vh-1.5rem)] gap-4 sm:gap-5 ${
    viewMode === "multi_year" ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""
  }`}
>
```

- [ ] **Step 2: Make the header the final product command header**

Change the header opening tag to:

```tsx
<header data-testid="explorer-header" className="border border-cyan-400/25 bg-black/60 p-4 shadow-[0_0_36px_rgba(34,211,238,0.08)] sm:p-5">
```

Keep current product title and Georgian copy. Do not add marketing text.

- [ ] **Step 3: Make the active total card final**

Add `data-testid="active-total-card"` to the active total wrapper and use:

```tsx
className="min-w-[180px] border border-lime-300/25 bg-lime-300/10 px-4 py-3 text-left shadow-[0_0_24px_rgba(163,230,53,0.08)] sm:text-right"
```

Acceptance criteria:

- It shows active year.
- It shows `formatGel(headerTotal)`.
- Planned note still appears when applicable.

- [ ] **Step 4: Make controls panel final**

Add `data-testid="explorer-controls"` to the controls wrapper and use:

```tsx
className="border border-cyan-400/20 bg-zinc-950/85 p-4 shadow-[0_0_28px_rgba(8,145,178,0.08)]"
```

- [ ] **Step 5: Make source label final without rewriting Georgian copy**

Keep the existing source-label text exactly as it is in `main-explorer.tsx`. Only add `data-testid` and replace the wrapper class.

Change only the opening `<p>` tag to:

```tsx
<p
  data-testid="source-label"
  className="border border-zinc-800 bg-black/35 px-3 py-2 text-xs leading-5 text-zinc-400"
>
```

Reason: Windows terminal output can render Georgian as mojibake. Do not use terminal mojibake as replacement source text.

- [ ] **Step 6: Run build**

Run from `apps/web`:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 7: Commit**

Run from repo root:

```powershell
git add apps/web/components/main-explorer/main-explorer.tsx
git commit -m "style: implement final explorer shell"
```

## Task 4: Implement Final Control Deck and Selector Rail

**Files:**

- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`
- Modify: `apps/web/components/main-explorer/series-selector.tsx`

- [ ] **Step 1: Make controls width-safe**

In `ExplorerControls`, change the root wrapper to:

```tsx
<div className="flex min-w-0 flex-col gap-4">
```

For side, view, and chart mode buttons, add `whitespace-nowrap`.

For each `<select>`, add `min-w-0`.

- [ ] **Step 2: Preserve final control behavior**

Verify in code:

```text
Expenditure/revenue switch remains first.
Multi-year/single-year switch remains visible in both views.
Chart mode and measure controls show only in multi-year mode.
Single-year mode shows only one year selector.
CSV export remains outside controls and only in multi-year mode.
```

- [ ] **Step 3: Add final selector test ID**

In `SeriesSelector`, change the `<aside>` opening tag to:

```tsx
<aside data-testid="series-selector" className="border border-cyan-400/20 bg-black/45 p-4 lg:sticky lg:top-5">
```

- [ ] **Step 4: Make selector rows final**

Change each option label class to:

```tsx
className={`flex cursor-pointer items-start gap-3 border p-3 transition ${
  selected ? "border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_18px_rgba(34,211,238,0.08)]" : "border-zinc-800 bg-zinc-950/75 hover:border-zinc-600"
}`}
```

Do not change selection logic or the 8-series rule.

- [ ] **Step 5: Run checks**

Run from `apps/web`:

```powershell
npm run lint
npm run build
```

Expected:

```text
No lint errors
Compiled successfully
```

- [ ] **Step 6: Commit**

Run from repo root:

```powershell
git add apps/web/components/main-explorer/explorer-controls.tsx apps/web/components/main-explorer/series-selector.tsx
git commit -m "style: implement final control deck"
```

## Task 5: Implement Final Chart, Table, and Summary Surfaces

**Files:**

- Modify: `apps/web/components/main-explorer/chart-frame.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/period-summary.tsx`

- [ ] **Step 1: Add final chart frame containment**

In `ChartFrame`, wrap the empty state, bar chart, and line chart containers with this opening wrapper:

```tsx
<div data-testid="chart-frame" className="overflow-x-auto">
  <div className="h-[420px] min-w-[680px] border border-cyan-400/20 bg-black/45 p-3">
```

Then close both wrapper `<div>` elements after the existing empty-state content, `<BarChart>`, or `<LineChart>` content. Use `data-testid="chart-frame"` once per rendered return path.

- [ ] **Step 2: Slightly improve chart grid contrast**

Change Recharts grid stroke from:

```tsx
stroke="#1f2937"
```

to:

```tsx
stroke="rgba(34, 211, 238, 0.16)"
```

- [ ] **Step 3: Keep chart behavior unchanged**

Verify:

```text
Line mode still renders selected series.
Bar mode still sorts visible values descending.
Planned dots still render.
Tooltip values still use existing formatters.
No data transformation logic changes.
```

- [ ] **Step 4: Make table final and contained**

In `ExplorerTable`, ensure the outer wrapper uses:

```tsx
className="overflow-x-auto border border-cyan-400/20 bg-black/45"
```

Ensure the `<table>` uses:

```tsx
className="min-w-[760px] w-full border-collapse text-sm"
```

Do not change columns or table data.

- [ ] **Step 5: Make period summary visually consistent**

In `PeriodSummaryPanel`, update panel/background classes to use:

```text
border border-cyan-400/20 bg-black/45
```

Acceptance criteria:

- Summary card order is unchanged.
- Top/bottom growth lists are unchanged.
- Start/end comparison remains visible below the first viewport.

- [ ] **Step 6: Run checks**

Run from `apps/web`:

```powershell
npm run test -- tests/explorer
npm run build
```

Expected:

```text
Explorer tests pass
Compiled successfully
```

- [ ] **Step 7: Commit**

Run from repo root:

```powershell
git add apps/web/components/main-explorer/chart-frame.tsx apps/web/components/main-explorer/explorer-table.tsx apps/web/components/main-explorer/period-summary.tsx
git commit -m "style: implement final data surfaces"
```

## Task 6: Implement Final Single-Year Design

**Files:**

- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`
- Modify: `apps/web/components/single-year/snapshot-headline-cards.tsx`
- Modify: `apps/web/components/single-year/snapshot-treemap.tsx`
- Modify: `apps/web/components/single-year/every-100-gel.tsx`
- Modify: `apps/web/components/single-year/spending-petals.tsx`
- Modify: `apps/web/components/single-year/budget-field.tsx`
- Modify: `apps/web/components/single-year/single-year-ranking.tsx`

- [ ] **Step 1: Make snapshot shell final**

In `SingleYearSnapshot`, change the root section class to:

```tsx
className="border border-cyan-400/20 bg-zinc-950/85 p-4 shadow-[0_0_32px_rgba(34,211,238,0.07)] sm:p-5"
```

Keep existing title, subtitle, and planned badge behavior.

- [ ] **Step 2: Lock final section order with spacing**

In `SingleYearSnapshot`, replace the direct section list after `<SnapshotHeadlineCards cards={model.headlineCards} />` with:

```tsx
<div className="mt-4 grid gap-4">
  <SnapshotTreemap items={model.items} />
  <Every100Gel items={model.every100} side={model.side} />
  <SpendingPetals items={model.petals} />
  <div data-testid="budget-field-scroll" className="overflow-x-auto">
    <BudgetField items={model.items} hasGrowthData={model.hasGrowthData} />
  </div>
  <SingleYearRanking rows={model.rankingRows} />
</div>
```

Remove the old direct calls so each section appears exactly once.

- [ ] **Step 3: Make headline cards final**

In `SnapshotHeadlineCards`, make each card use:

```tsx
className="border border-cyan-400/20 bg-black/45 p-3 shadow-[0_0_18px_rgba(34,211,238,0.06)]"
```

Do not change card content.

- [ ] **Step 4: Make every single-year section share one final surface language**

Do not remove existing `data-testid` attributes, chart sizing, grid layout classes, sorting controls, or table wrappers.

Apply the final surface language this way:

- `SnapshotTreemap`: change the outer section from `className="mt-4"` to `className="border border-cyan-400/20 bg-black/45 p-4"`, then remove the border/background/padding from the inner chart wrapper so it keeps only height and chart spacing.
- `Every100Gel`: change the outer section from `className="mt-4"` to `className="border border-cyan-400/20 bg-black/45 p-4"`, then keep the inner grid layout but remove its border/background/padding classes.
- `SpendingPetals`: change the outer section from `className="mt-4"` to `className="border border-cyan-400/20 bg-black/45 p-4"`, then keep the inner `lg:grid-cols-[360px_1fr]` layout but remove its border/background/padding classes.
- `BudgetField`: change the section from `className="mt-4 min-w-[760px]"` to:

```tsx
className="min-w-[760px] border border-cyan-400/20 bg-black/45 p-4"
```

- `SingleYearRanking`: change the outer section from `className="mt-4"` to `className="border border-cyan-400/20 bg-black/45 p-4"`, and keep the existing inner table overflow wrapper.

This avoids nested panel styling while preserving each component's existing behavior.

- [ ] **Step 5: Preserve final single-year product rules**

Verify in code:

```text
No drilldown links.
No source-heavy provenance panels.
Every 100 GEL still renders exactly 100 cells.
Petals render `model.petals` without slicing again.
Budget Field renders growth unavailable state for earliest year.
Ranking still defaults to amount descending and supports sorting.
```

- [ ] **Step 6: Run checks**

Run from `apps/web`:

```powershell
npm run test -- tests/explorer/singleYear.test.ts tests/explorer/integration.test.ts
npm run build
```

Expected:

```text
Single-year tests pass
Compiled successfully
```

- [ ] **Step 7: Commit**

Run from repo root:

```powershell
git add apps/web/components/single-year
git commit -m "style: implement final single year design"
```

## Task 7: Final Browser QA and Screenshots

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

This is where the browser-test edits from Task 1 are committed. Do not stage unrelated dirty Plan 5 files.

- [ ] **Step 1: Run final browser layout tests**

Run from `apps/web`:

```powershell
npm run test:browser
```

Expected:

```text
All browser tests pass
```

If a selector fails because it is broad, tighten it to the relevant `data-testid`. Do not remove overflow assertions.

If the existing single-year test still contains `page.getByRole("application")` and that role is not stable after final layout work, replace it with `await expect(page.getByTestId("explorer-shell")).toBeVisible();`.

- [ ] **Step 2: Add final screenshot smoke test**

Append:

```ts
test("captures final v1 desktop and mobile smoke screenshots", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expect(page.getByTestId("explorer-shell")).toBeVisible();
  await page.screenshot({ path: "test-results/geodata-v1-final-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100");
  await page.getByTestId("view-single_year").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await page.screenshot({ path: "test-results/geodata-v1-final-mobile.png", fullPage: true });

  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 3: Run browser tests again**

Run from `apps/web`:

```powershell
npm run test:browser
```

Expected:

```text
All browser tests pass
```

- [ ] **Step 4: Commit**

Run from repo root:

```powershell
git add apps/web/tests/browser/main-explorer.spec.ts
git commit -m "test: verify final v1 UI layouts"
```

## Final Verification

Run from `apps/web`:

```powershell
npm run lint
npm run test
npm run data:validate
$env:DATABASE_URL="postgresql://user:password@localhost:5432/geodata"; $env:DIRECT_URL="postgresql://user:password@localhost:5432/geodata"; npm run build
npm run test:browser
```

Expected:

```text
No lint errors
Vitest suite passes
Data validation passes
Compiled successfully
Playwright tests pass
```

Manual final UI acceptance at `http://localhost:3100`:

- The first screen is the Budget Explorer itself, not a marketing page.
- Desktop multi-year mode shows header, active total, controls, chart/table, selector, CSV button, and source label.
- Desktop single-year mode removes the selector rail and presents the final snapshot in one column.
- Mobile has no page-level horizontal overflow.
- Chart/table/Budget Field scroll only inside their own containers.
- Georgian text is readable and does not overlap.
- Revenue and expenditure modes both remain usable.
- Planned badge and source label are visible when applicable.
- CSV export remains available only in multi-year mode.
- Browser console has no errors or warnings.

## Self-Review

Spec coverage:

- Covered: final v1 visual target, direct explorer-first IA, dark terminal identity, desktop/multi-year layout, desktop/single-year layout, mobile behavior, source label, planned state, chart/table/selector/snapshot surfaces, browser verification.
- Deferred by scope: light mode, stacked mode, public provenance panels, new data ingestion, taxonomy edits, route restructuring, drilldown pages.

Placeholder scan:

- No placeholder implementation tasks are left.
- All changed files are named exactly.
- Every task includes verification commands and expected outcomes.

Risk controls:

- The plan does not touch data files or data transformation code.
- Browser assertions use stable test IDs and page-overflow checks instead of raw SVG internals.
- The final design is implemented by scoped changes to existing components, not by replacing the app architecture.
