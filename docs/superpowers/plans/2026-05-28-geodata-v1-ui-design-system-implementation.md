# GeoData.ge V1 UI Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Budget Explorer UI to the approved Apple-like Light/Night design system from the confirmed HTML references while preserving existing data, CSV export, and source-label behavior.

**Architecture:** Keep the current Next.js page and explorer data builders. Add a small UI foundation for theme, controls, and surfaces, then convert the existing multi-year and single-year components in place. Browser tests define the public UI contract: Light/Night parity, Line/Table only, `% წილი` toggle, no legacy neon shell, Budget Radar instead of petals, and no side list beside Every 100 GEL.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts 3, Vitest, Playwright.

---

## Plan Review Summary

This plan replaces the previous draft because that draft was harder to execute than necessary.

Problems fixed:

- It was too long and mixed durable requirements with implementation commentary.
- Several steps were too broad to review cleanly.
- Some code snippets contained placeholder comments instead of complete intent.
- CSV placement was ambiguous.
- The `SingleYearSnapshot` year-pill prop flow was ambiguous.
- The plan allowed optional model naming even though the approved UI clearly replaces petals with Budget Radar.
- It over-specified JSX in places where the current component structure should guide the exact implementation.

The revised plan keeps the original intent but makes execution more linear:

1. Lock tests to the approved UI contract.
2. Add theme tokens and reusable primitives.
3. Convert shell and visible controls.
4. Convert multi-year surface.
5. Convert single-year model and UI.
6. Run full verification.

## Source Of Truth

Read before implementation:

- `AGENTS.md`
- `DESIGN.md`
- `docs/Design HTML files/multiyear-apple.html`
- `docs/Design HTML files/singleyear-apple.html`
- `docs/superpowers/specs/2026-05-28-geodata-v1-ui-design-system-implementation.md`

Visual priority:

1. `docs/Design HTML files/multiyear-apple.html`
2. `docs/Design HTML files/singleyear-apple.html`
3. `DESIGN.md`
4. Existing production app behavior and data contracts

If a visual disagreement appears, follow the HTML reference and update `DESIGN.md` in the same branch.

## Execution Rules

- Work from `apps/web` for all npm commands.
- Keep existing data loaders, CSV builder, fact model builders, and import scripts intact.
- Do not rewrite Georgian strings because PowerShell output looks mojibaked.
- Do not expose Bar, Stacked, Share of GDP, or a full measure dropdown in production UI.
- Keep old `ChartMode` model support only where removing it creates unnecessary churn; visible controls must show only Line and Table.
- Make one commit per task after tests for that task pass.
- If `npm` or Playwright fails with Windows `EPERM`, sandbox, browser-launch, or spawn errors, rerun the same command with escalation before treating it as a product failure.

## Target File Map

Create:

- `apps/web/components/ui/theme-toggle.tsx`
- `apps/web/components/ui/segmented-control.tsx`
- `apps/web/components/ui/view-switch.tsx`
- `apps/web/components/ui/surfaces.tsx`
- `apps/web/components/ui/year-pills.tsx`
- `apps/web/components/single-year/budget-radar.tsx`
- `apps/web/tests/explorer/themeTokens.test.ts`

Modify:

- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/components/main-explorer/main-explorer.tsx`
- `apps/web/components/main-explorer/explorer-controls.tsx`
- `apps/web/components/main-explorer/chart-frame.tsx`
- `apps/web/components/main-explorer/explorer-table.tsx`
- `apps/web/components/main-explorer/series-selector.tsx`
- `apps/web/components/main-explorer/period-summary.tsx`
- `apps/web/components/single-year/single-year-snapshot.tsx`
- `apps/web/components/single-year/snapshot-headline-cards.tsx`
- `apps/web/components/single-year/snapshot-treemap.tsx`
- `apps/web/components/single-year/every-100-gel.tsx`
- `apps/web/components/single-year/budget-field.tsx`
- `apps/web/components/single-year/single-year-ranking.tsx`
- `apps/web/lib/explorer/types.ts`
- `apps/web/lib/explorer/singleYear.ts`
- `apps/web/tests/browser/main-explorer.spec.ts`
- `apps/web/tests/explorer/singleYear.test.ts`

Do not modify:

- `apps/web/scripts/*`
- `apps/web/prisma/*`
- `data/*`
- `apps/web/lib/explorer/csvExport.ts`, unless a compile error proves the UI call site needs a narrow type adjustment.

## Task 1: Replace Browser Tests With The Approved UI Contract

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/tests/explorer/singleYear.test.ts`
- Create: `apps/web/tests/explorer/themeTokens.test.ts`

- [ ] **Step 1: Remove the obsolete stacked-mode browser test**

Delete the test named:

```ts
test("stacked composition mode renders real expenditure bars", async ({ page }) => {
```

Replace it with a test named:

```ts
test("multi-year production controls expose only line table and share toggle", async ({ page }) => {
```

The test must:

- Navigate to `http://localhost:3100`.
- Assert `chart-mode-line` is visible.
- Assert `chart-mode-table` is visible.
- Assert `measure-share-toggle` is visible.
- Assert buttons named `სვეტები` and `კომპოზიცია` have count `0`.
- Assert label `საზომი` has count `0`.
- Click `chart-mode-table` and assert `explorer-table` is visible.
- Click `chart-mode-line` and assert `chart-frame` is visible.
- Click `measure-share-toggle` and assert `chart-panel` has `data-measure="share_of_total"`.
- Assert no console warnings/errors were collected.

- [ ] **Step 2: Replace petals browser assertions with radar assertions**

In every browser test that currently expects:

```ts
await expect(page.getByTestId("spending-petals")).toBeVisible();
```

replace it with:

```ts
await expect(page.getByTestId("budget-radar")).toBeVisible();
await expect(page.getByTestId("spending-petals")).toHaveCount(0);
```

- [ ] **Step 3: Add Every 100 GEL production assertions**

In the single-year browser coverage, immediately after `every-100-gel` is visible, assert:

```ts
await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
await expect(page.getByTestId("every-100-gel").getByRole("list")).toHaveCount(0);
```

- [ ] **Step 4: Add Light/Night persistence coverage**

Add one browser test that:

- Calls `await page.goto("http://localhost:3100");`.
- Asserts body starts with `data-theme="light"`.
- Clicks `theme-night`.
- Asserts body has `data-theme="night"`.
- Reloads.
- Asserts body still has `data-theme="night"`.
- Compares `screen-card` width before and after the theme switch; widths should match after rounding.

Before navigating in this test, clear theme storage so the default assertion is stable:

```ts
await page.addInitScript(() => localStorage.removeItem("geodata-theme"));
```

- [ ] **Step 5: Add token contract test**

Create `apps/web/tests/explorer/themeTokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

describe("approved design system tokens", () => {
  it("defines required CSS variables", () => {
    for (const token of [
      "--primary",
      "--primary-active",
      "--teal",
      "--yellow",
      "--blue",
      "--orange",
      "--violet",
      "--slate",
      "--canvas",
      "--surface",
      "--soft",
      "--strong",
      "--chart",
      "--hairline",
      "--ink",
      "--body",
      "--mute",
      "--grid",
      "--shadow",
      "--on-primary",
    ]) {
      expect(globalsCss).toContain(token);
    }
  });

  it("defines light and night theme blocks", () => {
    expect(globalsCss).toContain('[data-theme="light"]');
    expect(globalsCss).toContain('[data-theme="night"]');
  });
});
```

- [ ] **Step 6: Run tests and confirm failures are meaningful**

Run from `apps/web`:

```powershell
npm run test -- tests/explorer/themeTokens.test.ts tests/explorer/singleYear.test.ts
npm run test:browser -- main-explorer.spec.ts
```

Expected before implementation:

- `themeTokens.test.ts` fails because `globals.css` still uses old tokens.
- Browser tests fail because the current UI still exposes legacy controls and `spending-petals`.

- [ ] **Step 7: Commit test contract**

```powershell
git add tests/browser/main-explorer.spec.ts tests/explorer/singleYear.test.ts tests/explorer/themeTokens.test.ts
git commit -m "test: lock approved v1 UI contract"
```

## Task 2: Add Theme Tokens And Theme Toggle

**Files:**

- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/components/ui/theme-toggle.tsx`

- [ ] **Step 1: Replace global neon base styles with approved tokens**

In `apps/web/app/globals.css`, keep `@import "tailwindcss";`, remove old dark/neon variables and body backgrounds, and define the tokens from `DESIGN.md` section 18.

Required token groups:

- `:root`: `--primary`, `--primary-active`, `--teal`, `--yellow`, `--blue`, `--orange`, `--violet`, `--slate`, `--font-ui`.
- `[data-theme="light"]`: `--canvas`, `--surface`, `--soft`, `--strong`, `--chart`, `--hairline`, `--hairline-soft`, `--ink`, `--body`, `--mute`, `--grid`, `--shadow`, `--on-primary`.
- `[data-theme="night"]`: same variable names with the approved night values.
- `@theme inline`: map Tailwind background/foreground/font to the CSS variables.

Base requirements:

- `html` and `body` use `background: var(--canvas)`.
- `body` uses `color: var(--ink)` and `font-family: var(--font-ui)`.
- Focus outlines use `var(--primary)`.
- Remove radial gradients, cyan/lime lines, monospace defaults, and old `--panel`/`--line-cyan` globals.

- [ ] **Step 2: Set the initial body theme**

In `apps/web/app/layout.tsx`, change the body tag to:

```tsx
<body data-theme="light" className="min-h-full flex flex-col">
  {children}
</body>
```

- [ ] **Step 3: Create `ThemeToggle`**

Create `apps/web/components/ui/theme-toggle.tsx`.

Requirements:

- `"use client";`
- Theme type is `"light" | "night"`.
- On mount, read `localStorage.getItem("geodata-theme")`.
- Treat any stored value other than `"night"` as `"light"`.
- Apply theme by setting `document.body.dataset.theme`.
- Persist with `localStorage.setItem("geodata-theme", theme)`.
- Render two buttons with test IDs `theme-light` and `theme-night`.
- Buttons expose `aria-pressed`.
- Wrapper uses the approved pill shape from `DESIGN.md`.

- [ ] **Step 4: Run focused tests**

Run from `apps/web`:

```powershell
npm run test -- tests/explorer/themeTokens.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit theme foundation**

```powershell
git add app/globals.css app/layout.tsx components/ui/theme-toggle.tsx tests/explorer/themeTokens.test.ts
git commit -m "feat: add approved theme tokens"
```

## Task 3: Add Small Reusable UI Primitives

**Files:**

- Create: `apps/web/components/ui/segmented-control.tsx`
- Create: `apps/web/components/ui/view-switch.tsx`
- Create: `apps/web/components/ui/surfaces.tsx`
- Create: `apps/web/components/ui/year-pills.tsx`

- [ ] **Step 1: Create `SegmentedControl`**

Create `apps/web/components/ui/segmented-control.tsx`.

Required API:

```ts
type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  testId?: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
};
```

Behavior:

- Render an `inline-flex` pill group.
- Use `aria-label={label}` on the group.
- Each button uses `aria-pressed`.
- Active state uses `var(--surface)` and `var(--ink)`.
- Inactive state uses `var(--mute)`.

- [ ] **Step 2: Create `ViewSwitch`**

Create `apps/web/components/ui/view-switch.tsx`.

Required API:

```ts
type ViewSwitchProps<T extends string> = {
  label: string;
  checked: boolean;
  checkedValue: T;
  uncheckedValue: T;
  onChange: (value: T) => void;
  testId?: string;
};
```

Behavior:

- Render label text plus a `51px x 31px` switch.
- Button uses `aria-pressed={checked}` and `data-testid={testId}`.
- Knob moves from left to right when checked.

- [ ] **Step 3: Create surface components**

Create `apps/web/components/ui/surfaces.tsx`.

Export:

- `ScreenCard({ children })`
- `ContentSection({ children, testId })`
- `ChartPanel({ children, mode, measure })`
- `TableSurface({ children, testId })`
- `StatusSurface({ children })`

Required test IDs:

- `ScreenCard` always renders `data-testid="screen-card"`.
- `ChartPanel` always renders `data-testid="chart-panel"` and optional `data-mode`/`data-measure`.
- `ContentSection` and `TableSurface` pass through their optional `testId`.

Styling:

- Use `var(--surface)`, `var(--canvas)`, `var(--hairline)`, `var(--shadow)`.
- Match `DESIGN.md` radii: `24px` for screen/content sections, `20px` for chart panels, `12px` for table wrappers.

- [ ] **Step 4: Create `YearPills`**

Create `apps/web/components/ui/year-pills.tsx`.

Required API:

```ts
type YearPillsProps = {
  years: number[];
  value: number;
  onChange: (year: number) => void;
};
```

Behavior:

- Render `data-testid="year-pills"`.
- Allow horizontal overflow for many years.
- Each year button uses `aria-pressed`.
- Active year uses the approved selected pill styling.

- [ ] **Step 5: Verify primitives compile**

Run from `apps/web`:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit primitives**

```powershell
git add components/ui/segmented-control.tsx components/ui/view-switch.tsx components/ui/surfaces.tsx components/ui/year-pills.tsx
git commit -m "feat: add approved UI primitives"
```

## Task 4: Convert Shell, View State, And Visible Controls

**Files:**

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`

- [ ] **Step 1: Replace visible control API**

In `explorer-controls.tsx`, make props match visible production controls:

```ts
type ExplorerControlsProps = {
  side: ExplorerSide;
  viewMode: ViewMode;
  chartMode: ChartMode;
  shareModeActive: boolean;
  years: number[];
  startYear: number;
  endYear: number;
  singleYear: number;
  onSideChange: (side: ExplorerSide) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onChartModeChange: (mode: ChartMode) => void;
  onShareModeChange: (active: boolean) => void;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
  onSingleYearChange: (year: number) => void;
};
```

Remove rendered controls for:

- `barYear`
- `onBarYearChange`
- full measure dropdown
- `percent_change`
- `share_of_gdp`
- `stacked`
- `bar`

- [ ] **Step 2: Render approved controls**

In `ExplorerControls`, use the new primitives:

- `SegmentedControl` for Expenditure/Revenue with test IDs `side-expenditure`, `side-revenue`.
- `ViewSwitch` for Multi-year/Single-year with test ID `view-switch`.
- `SegmentedControl` for chart mode with only:
  - `{ value: "line", label: "ხაზი", testId: "chart-mode-line" }`
  - `{ value: "table", label: "ცხრილი", testId: "chart-mode-table" }`
- A button with `data-testid="measure-share-toggle"` and label `% წილი`.

`measure-share-toggle` must:

- Use `aria-pressed={shareModeActive}`.
- Call `onShareModeChange(!shareModeActive)`.
- Use primary fill when active.

- [ ] **Step 3: Map visible share toggle to existing model measure**

In `main-explorer.tsx`, replace broad measure state with:

```ts
const [shareModeActive, setShareModeActive] = useState(false);
const measure: MeasureMode = shareModeActive ? "share_of_total" : "nominal";
```

Keep the existing `ChartMode` type if it reduces churn, but `handleChartModeChange` must only receive `"line"` or `"table"` from visible controls.

- [ ] **Step 4: Convert page shell**

In `main-explorer.tsx`:

- Import `ThemeToggle`, `ScreenCard`, and `ChartPanel`.
- Replace old full-screen dark/neon shell with centered page width `min(1200px, calc(100vw - 32px))`.
- Keep `data-testid="explorer-shell"`.
- Keep `data-testid="explorer-header"`.
- Keep `data-testid="explorer-controls"`.
- Keep `data-testid="active-total-card"`.
- Keep `data-testid="source-label"`.
- Wrap active chart/table/snapshot content inside `ScreenCard`.
- Wrap the chart/table area in `ChartPanel` with:
  - `mode={chartMode}`
  - `measure={measure}`

- [ ] **Step 5: Preserve CSV behavior**

Move CSV trigger to the multi-year series panel.

In `main-explorer.tsx`, pass:

```tsx
onDownloadCsv={downloadCsv}
```

to `SeriesSelector`.

In `series-selector.tsx`, add prop:

```ts
onDownloadCsv: () => void;
```

Render the CSV button at the bottom of the panel with the approved label:

```text
მონაცემების ჩამოტვირთვა CSV
```

The button must call `onDownloadCsv`.

- [ ] **Step 6: Run shell/control verification**

Run from `apps/web`:

```powershell
npm run lint
npm run test:browser -- main-explorer.spec.ts
```

Expected:

- Theme and visible-control tests pass.
- Single-year radar tests may still fail until Task 6.

- [ ] **Step 7: Commit shell and controls**

```powershell
git add components/main-explorer/main-explorer.tsx components/main-explorer/explorer-controls.tsx components/main-explorer/series-selector.tsx
git commit -m "feat: convert explorer shell controls"
```

## Task 5: Convert Multi-Year Chart, Table, Series Panel, And Summary

**Files:**

- Modify: `apps/web/components/main-explorer/chart-frame.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/series-selector.tsx`
- Modify: `apps/web/components/main-explorer/period-summary.tsx`

- [ ] **Step 1: Restyle `ChartFrame`**

In `chart-frame.tsx`:

- Replace cyan/black classes with approved variables.
- Outer chart frame keeps `data-testid="chart-frame"`.
- Plot frame uses `bg-[var(--canvas)]`, `rounded-[18px]`, and stable height.
- Grid uses `var(--grid)`.
- Axes use `var(--mute)`.
- Tooltip uses `var(--surface)`, `var(--hairline)`, `var(--ink)`.
- Dot fill uses `var(--chart)`.
- Planned dot/marker remains visually distinct.

Keep internal bar/stacked branches, but restyle their fallback surfaces and helper messages with approved variables. They remain unexposed.

- [ ] **Step 2: Restyle `ExplorerTable`**

In `explorer-table.tsx`:

- Wrap output in `TableSurface testId="explorer-table"`.
- Header background uses `var(--soft)`.
- Borders use `var(--hairline)`.
- Text uses `var(--ink)`, `var(--body)`, `var(--mute)`.
- Keep planned badge, restyled as a small rounded badge.
- Preserve columns and values from the current model.

- [ ] **Step 3: Restyle `SeriesSelector`**

In `series-selector.tsx`:

- Outer panel uses `rounded-[20px]`, `bg-[var(--surface)]`, and no neon border.
- Search input uses `var(--canvas)` and `var(--hairline)`.
- Rows use category color chips.
- Selected rows use `bg-[var(--canvas)]`.
- Latest values remain visible.
- Limit messages use `StatusSurface` or equivalent approved warning surface.
- CSV button is at the bottom and calls `onDownloadCsv`.

- [ ] **Step 4: Restyle `PeriodSummaryPanel`**

In `period-summary.tsx`:

- Wrap in `ContentSection testId="period-summary"`.
- Keep the existing summary calculations and props.
- Use four KPI cards first.
- Keep top/bottom movers and start/end comparison.
- Avoid text that calls positive lower growth a true loss.

- [ ] **Step 5: Verify multi-year behavior**

Run from `apps/web`:

```powershell
npm run lint
npm run test:browser -- main-explorer.spec.ts
```

Expected:

- Main explorer hydrates.
- Line chart renders.
- Table mode renders.
- Series panel renders.
- CSV button is visible.
- No page-level horizontal overflow.
- Single-year radar assertions may still fail until Task 6.

- [ ] **Step 6: Commit multi-year conversion**

```powershell
git add components/main-explorer/chart-frame.tsx components/main-explorer/explorer-table.tsx components/main-explorer/series-selector.tsx components/main-explorer/period-summary.tsx
git commit -m "feat: convert multi-year explorer UI"
```

## Task 6: Replace Petals Model With Radar Items

**Files:**

- Modify: `apps/web/lib/explorer/types.ts`
- Modify: `apps/web/lib/explorer/singleYear.ts`
- Modify: `apps/web/tests/explorer/singleYear.test.ts`

- [ ] **Step 1: Rename model field**

In `types.ts`, change `SingleYearSnapshotModel` field:

```ts
petals: SnapshotItem[];
```

to:

```ts
radarItems: SnapshotItem[];
```

- [ ] **Step 2: Rename helper and return field**

In `singleYear.ts`:

- Rename `buildPetals` to `buildRadarItems`.
- Keep the existing top-7-plus-other aggregation behavior.
- Change returned empty model from `petals: []` to `radarItems: []`.
- Change returned populated model from `petals: buildPetals(items)` to `radarItems: buildRadarItems(items)`.

Use `series.other` fallback color `#8e8e93` for the aggregated `snapshot.other` item.

- [ ] **Step 3: Update model tests**

In `singleYear.test.ts`:

- Replace `model.petals` with `model.radarItems`.
- In the first test, assert:

```ts
expect(model.radarItems.map((item) => item.itemId)).toEqual(["spending.health", "spending.education", "spending.defense"]);
```

- In the aggregation test, assert:

```ts
const other = model.radarItems.find((item) => item.itemId === "snapshot.other");
expect(model.radarItems).toHaveLength(8);
```

- [ ] **Step 4: Run model tests**

Run from `apps/web`:

```powershell
npm run test -- tests/explorer/singleYear.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit radar model rename**

```powershell
git add lib/explorer/types.ts lib/explorer/singleYear.ts tests/explorer/singleYear.test.ts
git commit -m "refactor: rename single-year radar items"
```

## Task 7: Convert Single-Year UI And Add Budget Radar

**Files:**

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`
- Modify: `apps/web/components/single-year/snapshot-headline-cards.tsx`
- Modify: `apps/web/components/single-year/snapshot-treemap.tsx`
- Modify: `apps/web/components/single-year/every-100-gel.tsx`
- Create: `apps/web/components/single-year/budget-radar.tsx`
- Modify: `apps/web/components/single-year/budget-field.tsx`
- Modify: `apps/web/components/single-year/single-year-ranking.tsx`

- [ ] **Step 1: Add `BudgetRadar` component**

Create `budget-radar.tsx`.

Requirements:

- Props: `{ items: SnapshotItem[] }`.
- `data-testid="budget-radar"`.
- SVG has `role="img"` and accessible label.
- Uses top-level `items`, not source rows or subprograms.
- Uses category colors from each item.
- Shows top categories plus `snapshot.other` from `radarItems`.
- Uses approved surface tokens.
- Does not render a side list.

- [ ] **Step 2: Add year pills to single-year snapshot**

Change `SingleYearSnapshotProps`:

```ts
type SingleYearSnapshotProps = {
  model: SingleYearSnapshotModel;
  years: number[];
  onYearChange: (year: number) => void;
};
```

Render at the top of the snapshot:

```tsx
<YearPills years={years} value={model.year} onChange={onYearChange} />
```

In `main-explorer.tsx`, call:

```tsx
<SingleYearSnapshot model={singleYearModel} years={allYears} onYearChange={setSingleYear} />
```

- [ ] **Step 3: Replace `SpendingPetals` with `BudgetRadar`**

In `single-year-snapshot.tsx`:

- Remove `SpendingPetals` import.
- Import `BudgetRadar`.
- Render `BudgetRadar` after `Every100Gel`.
- Pass `items={model.radarItems}`.
- Ensure `BudgetField` remains after `BudgetRadar`.
- Ensure `SingleYearRanking` remains last.

Approved order:

1. `YearPills`
2. `SnapshotHeadlineCards`
3. `SnapshotTreemap`
4. `Every100Gel`
5. `BudgetRadar`
6. `BudgetField`
7. `SingleYearRanking`

- [ ] **Step 4: Remove Every 100 GEL side list**

In `every-100-gel.tsx`:

- Keep `buildCells`.
- Keep exactly 100 rendered cells.
- Add `data-cell="gel"` to each cell.
- Remove the category list beside the grid.
- Center the grid.
- Use title tooltip with category label.
- Use approved title `ყოველი 100 ლარი`.

- [ ] **Step 5: Restyle remaining single-year sections**

Apply approved tokens to:

- `snapshot-headline-cards.tsx`
- `snapshot-treemap.tsx`
- `budget-field.tsx`
- `single-year-ranking.tsx`

Acceptance:

- Exactly four headline cards.
- Headline cards use the approved gradient/card treatment.
- Treemap section is full-width.
- Budget Field keeps horizontal scroll containment.
- Ranking remains sortable.
- No old cyan/lime/black neon utility classes remain in these files.

- [ ] **Step 6: Verify single-year behavior**

Run from `apps/web`:

```powershell
npm run lint
npm run test -- tests/explorer/singleYear.test.ts
npm run test:browser -- main-explorer.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit single-year conversion**

```powershell
git add components/main-explorer/main-explorer.tsx components/single-year lib/explorer/types.ts lib/explorer/singleYear.ts tests/explorer/singleYear.test.ts
git commit -m "feat: convert single-year snapshot UI"
```

## Task 8: Final Verification And Design QA

**Files:**

- Modify `DESIGN.md` only when implementation uncovers a mismatch with the confirmed HTML.
- Modify `docs/superpowers/specs/2026-05-28-geodata-v1-ui-design-system-implementation.md` only when implementation uncovers a spec ambiguity.

- [ ] **Step 1: Run full automated checks**

Run from `apps/web`:

```powershell
npm run lint
npm run test
npm run build
npm run test:browser
```

Expected: all pass.

- [ ] **Step 2: Run visual QA in browser**

Open `http://localhost:3100`.

Verify:

- Light theme is the default with empty theme storage.
- Night theme persists after reload.
- Light and Night keep the same layout.
- Multi-year default is Line and nominal GEL.
- Only `ხაზი` and `ცხრილი` are visible chart modes.
- `% წილი` switches chart panel to share mode.
- Series search and selection work.
- CSV downloads active filtered data.
- Source/update label is visible.
- Single-year order matches the approved order.
- Every 100 GEL has exactly 100 cells and no side list.
- Budget Radar appears before Budget Field.
- Revenue uses the same visual structure as expenditure.
- Mobile width has no page-level horizontal overflow.

- [ ] **Step 3: Capture or confirm screenshots**

Use Playwright screenshot output from `main-explorer.spec.ts`, or capture equivalent screenshots:

```text
apps/web/test-results/geodata-v1-final-desktop.png
apps/web/test-results/geodata-v1-final-mobile.png
```

Expected: screenshots show the approved Light/Night-compatible UI without the old neon shell.

- [ ] **Step 4: Check final git state**

Run from repository root:

```powershell
git status --short
```

Expected: only intentional implementation, test, and documentation files are modified.

- [ ] **Step 5: Commit documentation alignment when needed**

When `DESIGN.md` or the approved spec changed:

```powershell
git add DESIGN.md docs/superpowers/specs/2026-05-28-geodata-v1-ui-design-system-implementation.md
git commit -m "docs: align implemented UI contract"
```

When neither file changed, do not create a docs commit.

## Final Success Criteria

Implementation is complete only when:

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- `npm run test:browser` passes.
- Browser QA confirms Light/Night, desktop/mobile, multi-year/single-year, revenue/expenditure, CSV, source label, and no page overflow.
- No Bar, Stacked, measure dropdown, old neon shell, `SpendingPetals`, or Every 100 GEL side list is visible in production.
- Git status contains no unintended files.
