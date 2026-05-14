# GeoData.ge Stacked Composition Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the v1 stacked composition chart mode in the existing multi-year explorer without changing data ingestion, CSV semantics, or the single-year snapshot.

**Architecture:** Keep all explorer state in `MainExplorer`, keep chart rendering in `ChartFrame`, and keep selection defaults in `lib/explorer/explorerData.ts`. Stacked mode uses existing top-level public category rows, excludes derived total rows, and forces `share_of_total` so the chart answers one clear question: how the composition changes by year.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts 3, Vitest, Playwright.

---

## Scope

Included:

- Add `stacked` as a real `ChartMode`.
- Enable the currently disabled composition control.
- When switching to stacked mode, auto-select up to 8 visible non-total top-level categories for the active side.
- Prevent derived total rows such as `expenditure.total` and `revenue.total` from being selected in stacked mode.
- Force `share_of_total` in stacked mode to avoid misleading stacked percent-change bars.
- Render one stacked bar per year using Recharts `BarChart` with multiple `Bar` components sharing one `stackId`.
- Keep existing line, bar, table, CSV export, single-year snapshot, and source-label behavior unchanged.
- Add unit, integration, and browser coverage for stacked mode.

Excluded:

- No new expenditure or revenue ingestion.
- No Plan 5 revenue pipeline changes.
- No data expansion outside the 2023-2025 v1 window.
- No GDP data or Share of GDP implementation.
- No Supabase/database read path.
- No single-year component redesign.
- No official institution/program stacking in this pass.

## Assumptions

- Plan 6 runs from `C:\Users\Mylaptop\Desktop\Projects\Geodata.ge\.worktrees\plan6` on branch `codex/plan6`.
- Current real app facts are 2023-2025 expenditure rows in `data/imports/budget-facts-2023-2025.csv`.
- If Plan 5 revenue lands later, stacked mode should work automatically for whatever top-level revenue rows are active, but Plan 6 must not depend on that branch.
- Stacked mode is top-level-only for v1. It stacks current public categories like `spending.health` and `spending.education`, not official program/subprogram rows.

## Source Documents

Read before executing:

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `docs/superpowers/plans/2026-05-11-geodata-main-explorer-ui.md`
- `docs/superpowers/plans/2026-05-13-geodata-single-year-snapshot.md`

## Recharts Note

Context7 documentation for Recharts confirms stacked bars are built by rendering multiple `<Bar>` components inside one `<BarChart>` and giving those bars the same `stackId`. Plan 6 should follow the existing local `ChartFrame` pattern: `ResponsiveContainer`, `BarChart`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, fixed `CHART_HEIGHT`, and `INITIAL_CHART_DIMENSION`.

## File Structure

Modify:

```text
apps/web/lib/explorer/types.ts
apps/web/lib/explorer/explorerData.ts
apps/web/components/main-explorer/explorer-controls.tsx
apps/web/components/main-explorer/main-explorer.tsx
apps/web/components/main-explorer/series-selector.tsx
apps/web/components/main-explorer/chart-frame.tsx
apps/web/tests/explorer/explorerData.test.ts
apps/web/tests/explorer/integration.test.ts
apps/web/tests/browser/main-explorer.spec.ts
```

Do not modify:

```text
data/imports/budget-facts-2023-2025.csv
data/mappings/review/spending-field-mapping-review-2023-2025.csv
apps/web/lib/data/realExpenditure/*
apps/web/lib/data/realRevenue/*
apps/web/components/single-year/*
```

---

### Task 1: Add Stacked Mode Types and Selection Helpers

**Files:**

- Modify: `apps/web/lib/explorer/types.ts`
- Modify: `apps/web/lib/explorer/explorerData.ts`
- Modify: `apps/web/tests/explorer/explorerData.test.ts`

- [ ] **Step 1: Add failing tests for stacked defaults**

In `apps/web/tests/explorer/explorerData.test.ts`, change the import:

```ts
import { buildExplorerModel, getDefaultSelection, getDefaultStackedSelection, isDerivedTotalItemId } from "../../lib/explorer/explorerData";
```

Add these tests after `returns side-specific default selections`:

```ts
  it("returns up to eight non-total default rows for stacked mode", () => {
    expect(getDefaultStackedSelection("expenditure", facts)).toEqual(["spending.education", "spending.health"]);
    expect(getDefaultStackedSelection("revenue", facts)).toEqual(["revenue.vat"]);
  });

  it("detects derived total rows that should not be stacked", () => {
    expect(isDerivedTotalItemId("expenditure.total")).toBe(true);
    expect(isDerivedTotalItemId("revenue.total")).toBe(true);
    expect(isDerivedTotalItemId("spending.health")).toBe(false);
    expect(isDerivedTotalItemId("revenue.vat")).toBe(false);
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run from `apps/web`:

```powershell
npm run test -- tests/explorer/explorerData.test.ts
```

Expected:

```text
FAIL tests/explorer/explorerData.test.ts
```

The failure should mention missing exports or missing stacked helper behavior.

- [ ] **Step 3: Add `stacked` to chart mode types**

In `apps/web/lib/explorer/types.ts`, replace:

```ts
export const CHART_MODES = ["line", "bar", "table"] as const;
```

with:

```ts
export const CHART_MODES = ["line", "bar", "stacked", "table"] as const;
```

- [ ] **Step 4: Add stacked selection helpers**

In `apps/web/lib/explorer/explorerData.ts`, add this helper after `totalIdFor`:

```ts
export function isDerivedTotalItemId(itemId: string): boolean {
  return itemId === "expenditure.total" || itemId === "revenue.total";
}
```

Then add this helper after `getDefaultSelection`:

```ts
export function getDefaultStackedSelection(side: ExplorerSide, facts: BudgetFactImportRow[]): string[] {
  return Array.from(
    new Set(
      chooseActivePublicFacts(facts)
        .filter((fact) => fact.side === side)
        .map((fact) => fact.itemId),
    ),
  )
    .filter((itemId) => !isDerivedTotalItemId(itemId))
    .sort()
    .slice(0, MAX_CHART_SERIES);
}
```

Also add this value import above the existing type import from `./types`:

```ts
import { MAX_CHART_SERIES } from "./types";
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
npm run test -- tests/explorer/explorerData.test.ts
```

Expected:

```text
PASS tests/explorer/explorerData.test.ts
```

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add apps/web/lib/explorer/types.ts apps/web/lib/explorer/explorerData.ts apps/web/tests/explorer/explorerData.test.ts
git commit -m "feat: add stacked explorer selection helpers"
```

### Task 2: Enable Composition Controls and State Behavior

**Files:**

- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/main-explorer/series-selector.tsx`

- [ ] **Step 1: Add the stacked control label**

In `apps/web/components/main-explorer/explorer-controls.tsx`, replace `chartModeLabels` with:

```ts
const chartModeLabels: Record<ChartMode, string> = {
  line: "ხაზი",
  bar: "სვეტები",
  stacked: "კომპოზიცია",
  table: "ცხრილი",
};
```

- [ ] **Step 2: Replace the disabled composition button with an active chart mode**

In `ExplorerControls`, replace the chart mode button block:

```tsx
{(["line", "bar", "table"] as const).map((mode) => (
```

with:

```tsx
{(["line", "bar", "stacked", "table"] as const).map((mode) => (
```

Then delete the disabled composition `<button>` that currently follows that map.

- [ ] **Step 3: Restrict measures while stacked mode is active**

In `ExplorerControls`, add this constant before `return`:

```ts
  const availableMeasures: MeasureMode[] = chartMode === "stacked" ? ["share_of_total"] : ["nominal", "percent_change", "share_of_total", "share_of_gdp"];
```

Then replace the measure options map:

```tsx
{(["nominal", "percent_change", "share_of_total", "share_of_gdp"] as const).map((nextMeasure) => (
```

with:

```tsx
{availableMeasures.map((nextMeasure) => (
```

- [ ] **Step 4: Import stacked helpers in `MainExplorer`**

In `apps/web/components/main-explorer/main-explorer.tsx`, replace:

```ts
import { buildExplorerModel, getDefaultSelection } from "../../lib/explorer/explorerData";
```

with:

```ts
import { buildExplorerModel, getDefaultSelection, getDefaultStackedSelection, isDerivedTotalItemId } from "../../lib/explorer/explorerData";
```

- [ ] **Step 5: Update chart mode switching**

In `MainExplorer`, add this side-change handler above `handleStartYearChange`:

```ts
  function handleSideChange(nextSide: ExplorerSide) {
    setSide(nextSide);
    setLimitMessage(null);
    if (chartMode === "stacked") {
      setMeasure("share_of_total");
      setSelections((current) => ({
        ...current,
        [nextSide]: getDefaultStackedSelection(nextSide, facts),
      }));
    }
  }
```

Then replace `handleChartModeChange` with:

```ts
  function handleChartModeChange(mode: ChartMode) {
    setChartMode(mode);
    setLimitMessage(null);
    if (mode === "bar") setBarYear(endYear);
    if (mode === "stacked") {
      setMeasure("share_of_total");
      setSelections((current) => ({
        ...current,
        [side]: getDefaultStackedSelection(side, facts),
      }));
    }
  }
```

Finally, replace the control prop:

```tsx
                onSideChange={setSide}
```

with:

```tsx
                onSideChange={handleSideChange}
```

- [ ] **Step 6: Prevent total rows in stacked mode**

In `MainExplorer`, add this block near the top of `handleToggle`, after `setLimitMessage(null);`:

```ts
    if (chartMode === "stacked" && isDerivedTotalItemId(itemId)) {
      setLimitMessage("კომპოზიციის რეჟიმში ჯამის სერია არ ირჩევა. აირჩიე ცალკეული კატეგორიები.");
      return;
    }
```

Keep the existing chart-series limit condition unchanged. Stacked mode is a chart mode, so it should keep the same `MAX_CHART_SERIES` limit as line and bar modes.

- [ ] **Step 7: Disable total row checkboxes in stacked mode**

In `apps/web/components/main-explorer/series-selector.tsx`, add the helper import:

```ts
import { isDerivedTotalItemId } from "../../lib/explorer/explorerData";
```

Inside the `filteredItems.map` callback, add:

```ts
          const disabled = chartMode === "stacked" && isDerivedTotalItemId(item.id);
```

Replace the `<label className=...>` expression with:

```tsx
              className={`flex items-start gap-3 border p-3 transition ${
                disabled
                  ? "cursor-not-allowed border-zinc-900 bg-zinc-950/40 opacity-50"
                  : selected
                    ? "cursor-pointer border-cyan-300/70 bg-cyan-300/10"
                    : "cursor-pointer border-zinc-800 bg-zinc-950/70 hover:border-zinc-600"
              }`}
```

Replace the checkbox with:

```tsx
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggle(item.id)}
                className="mt-1 size-4 accent-cyan-300"
              />
```

- [ ] **Step 8: Run focused TypeScript-facing tests**

Run:

```powershell
npm run test -- tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts
```

Expected:

```text
PASS tests/explorer/explorerData.test.ts
PASS tests/explorer/integration.test.ts
```

- [ ] **Step 9: Commit Task 2**

Run:

```powershell
git add apps/web/components/main-explorer/explorer-controls.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/components/main-explorer/series-selector.tsx
git commit -m "feat: enable stacked composition controls"
```

### Task 3: Render Stacked Composition Bars

**Files:**

- Modify: `apps/web/components/main-explorer/chart-frame.tsx`

- [ ] **Step 1: Let `ChartFrameProps` accept stacked mode**

In `apps/web/components/main-explorer/chart-frame.tsx`, keep:

```ts
  mode: Exclude<ChartMode, "table">;
```

This already allows `line`, `bar`, and `stacked` after Task 1.

- [ ] **Step 2: Build stacked rows from selected item points**

Add this helper after `renderPointDot`:

```tsx
function buildYearRows(years: number[], points: ExplorerPoint[]): ChartDatum[] {
  const rows: ChartDatum[] = years.map((year) => ({ year }));

  for (const point of points) {
    const row = rows.find((entry) => entry.year === point.year);
    if (!row) continue;
    const key = chartKey(point.itemId);
    row[key] = point.value;
    row[`${key}Basis`] = point.basis;
  }

  return rows;
}
```

- [ ] **Step 3: Add the stacked chart branch**

In `ChartFrame`, add this branch after the existing `if (mode === "bar")` block and before the line-chart rows are built:

```tsx
  if (mode === "stacked") {
    const rows = buildYearRows(years, points);
    const stackItems = selectedItems.filter((item) => !item.id.endsWith(".total"));

    if (stackItems.length === 0) {
      return (
        <div className="flex h-[420px] items-center justify-center border border-cyan-400/20 bg-black/40 p-6 text-sm text-zinc-400">
          კომპოზიციისთვის აირჩიე ცალკეული კატეგორიები, არა ჯამის სერია.
        </div>
      );
    }

    return (
      <div className="h-[420px] border border-cyan-400/20 bg-black/40 p-3">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
          <BarChart data={rows} margin={{ top: 20, right: 16, bottom: 28, left: 18 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <YAxis stroke="#a1a1aa" tickFormatter={(value) => formatMeasureValue(Number(value), measure)} width={88} />
            <Tooltip
              contentStyle={{ background: "#05070b", border: "1px solid rgba(34, 211, 238, 0.35)", color: "#f4f4f5" }}
              formatter={(value) => formatMeasureValue(Number(value), measure)}
            />
            {stackItems.map((item) => {
              const key = chartKey(item.id);

              return <Bar key={item.id} dataKey={key} name={item.kaLabel} stackId="composition" fill={item.color} />;
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
```

- [ ] **Step 4: Reuse `buildYearRows` for line mode**

Replace the line-mode row building block:

```ts
  const rows: ChartDatum[] = years.map((year) => ({ year }));

  for (const point of points) {
    const row = rows.find((entry) => entry.year === point.year);
    if (!row) continue;
    const key = chartKey(point.itemId);
    row[key] = point.value;
    row[`${key}Basis`] = point.basis;
  }
```

with:

```ts
  const rows = buildYearRows(years, points);
```

- [ ] **Step 5: Run focused tests and build**

Run:

```powershell
npm run test -- tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts
npm run build
```

Expected:

```text
PASS tests/explorer/explorerData.test.ts
PASS tests/explorer/integration.test.ts
✓ Compiled successfully
```

- [ ] **Step 6: Commit Task 3**

Run:

```powershell
git add apps/web/components/main-explorer/chart-frame.tsx
git commit -m "feat: render stacked composition chart"
```

### Task 4: Add Integration and Browser Coverage

**Files:**

- Modify: `apps/web/tests/explorer/integration.test.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add real-data stacked selection integration coverage**

In `apps/web/tests/explorer/integration.test.ts`, change the import:

```ts
import { buildExplorerModel, getDefaultSelection, getDefaultStackedSelection } from "../../lib/explorer/explorerData";
```

Add this test before the single-year snapshot test:

```ts
  it("builds a stacked expenditure composition model from real facts", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);
    const selectedItemIds = getDefaultStackedSelection("expenditure", facts);

    expect(selectedItemIds.length).toBeGreaterThan(1);
    expect(selectedItemIds).not.toContain("expenditure.total");

    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds,
      startYear: years[0],
      endYear: years[years.length - 1],
      measure: "share_of_total",
    });

    expect(model.points.length).toBeGreaterThan(selectedItemIds.length);
    expect(model.points.every((point) => point.value === null || (point.value >= 0 && point.value <= 1))).toBe(true);
  });
```

- [ ] **Step 2: Run integration tests and verify they pass**

Run:

```powershell
npm run test -- tests/explorer/integration.test.ts
```

Expected:

```text
PASS tests/explorer/integration.test.ts
```

- [ ] **Step 3: Add browser coverage for stacked mode**

In `apps/web/tests/browser/main-explorer.spec.ts`, add this test after the existing `main explorer hydrates...` loop:

```ts
test("stacked composition mode renders real expenditure bars", async ({ page }) => {
  const consoleProblems: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("http://localhost:3100");
  await page.getByRole("button", { name: "კომპოზიცია" }).click();

  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle")).not.toHaveCount(0);
  await expect(page.getByText("კომპოზიციისთვის აირჩიე ცალკეული კატეგორიები, არა ჯამის სერია.")).toHaveCount(0);
  await expect(page.getByText("წილი ჯამში")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 4: Run browser tests**

Run:

```powershell
npm run test:browser
```

Expected:

```text
4 passed
```

If this fails with a Windows sandbox `spawn EPERM` or report-write permission error, rerun the same command with Codex escalation before changing product code.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add apps/web/tests/explorer/integration.test.ts apps/web/tests/browser/main-explorer.spec.ts
git commit -m "test: cover stacked composition mode"
```

### Task 5: Final Verification

**Files:**

- No planned source edits.

- [ ] **Step 1: Validate data files**

Run from `apps/web`:

```powershell
npm run data:validate
```

Expected:

```text
Validated fact rows: 39
```

- [ ] **Step 2: Run unit and integration tests**

Run:

```powershell
npm run test
```

Expected:

```text
PASS
```

- [ ] **Step 3: Build the app**

Run:

```powershell
npm run build
```

Expected:

```text
✓ Compiled successfully
```

- [ ] **Step 4: Run browser tests**

Run:

```powershell
npm run test:browser
```

Expected:

```text
4 passed
```

- [ ] **Step 5: Inspect git status**

Run from the plan6 worktree root:

```powershell
git status --short
```

Expected:

```text
```

No uncommitted files should remain after the task commits.

## Self-Review

Spec coverage:

- Stacked composition mode is the direct v1 gap closed by this plan.
- The plan keeps `Share of GDP` unavailable, matching the current data boundary.
- CSV export remains unchanged because the visible table model remains the CSV source.
- Planned markers remain unchanged because stacked mode reuses existing point `basis`.

Placeholder scan:

- No `TBD`, `TODO`, or future-fill instructions remain.
- Every changed file has a concrete step and a verification command.

Risk check:

- Biggest UX risk: switching to stacked mode changes the active selection. This is intentional because the default total series cannot produce a composition chart.
- Biggest technical risk: browser tests depending on Recharts DOM class names. This repo already uses `.recharts-wrapper`; if `.recharts-bar-rectangle` is brittle, replace it with a stable visible text/state assertion plus screenshot review during implementation.

Plan complete and saved to `docs/superpowers/plans/2026-05-14-geodata-stacked-composition-mode.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
