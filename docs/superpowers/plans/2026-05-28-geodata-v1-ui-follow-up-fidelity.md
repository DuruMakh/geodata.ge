# GeoData V1 UI Follow-Up Fidelity Implementation Plan

> **Status:** Implemented in `codex/geodata-v1-ui-design-system-implementation`. Latest verification passed: `git diff --check`, `npm run lint`, `npm run test`, `npm run build`, and `npm run test:browser`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current GeoData.ge v1 UI implementation merge-ready by fixing the review gaps and adding visual-reference tests against the approved Apple HTML references.

**Architecture:** Keep the existing Next.js data loaders, explorer model builders, CSV builder, and Recharts usage. Move visual-only controls into the chart panel to match the reference, keep single-year year selection in `YearPills` only, add compact chart legend/range strip components, and use Playwright to capture paired reference/product screenshots plus structural assertions that fail on known design drift.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts 3, Vitest, Playwright.

---

## Source Of Truth

- `AGENTS.md`
- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`
- `DESIGN.md`
- `docs/Design HTML files/multiyear-apple.html`
- `docs/Design HTML files/singleyear-apple.html`
- Current implementation in `apps/web`
- Review findings from the completed UI/design-system pass

## Assumptions

- The approved HTML references define layout, controls, visual hierarchy, and section order.
- Whole-page pixel-perfect comparison between the static HTML references and the live product is too brittle because the reference uses prototype content while the app uses current product data.
- Visual testing therefore has two gates:
  - Paired screenshots of the reference and product are generated for human visual review.
  - Automated structural assertions fail when the app differs from the reference in known important ways: duplicate year controls, chart controls outside the chart panel, missing legend/range strip, missing CSV coverage, and missing Georgian-first copy.
- Product screenshot snapshots may be added after the UI is corrected, using Playwright `toHaveScreenshot` with stable viewport and disabled motion.

## Target File Map

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
  - Stop passing chart controls through the external controls block.
  - Render chart toolbar, legend, and range strip inside `ChartPanel`.
- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`
  - Keep only side switch and multi/single switch.
  - Remove the single-year `<select>`.
  - Remove the multi-year chart mode/share controls after they move into `ChartPanel`.
- Create: `apps/web/components/main-explorer/chart-panel-controls.tsx`
  - Render Line/Table and `% წილი` controls inside the plot frame.
- Create: `apps/web/components/main-explorer/chart-legend.tsx`
  - Render selected series colors and labels under the chart.
- Create: `apps/web/components/main-explorer/year-range-strip.tsx`
  - Render a reference-style range label and quick range strip without dropdowns.
- Modify: `apps/web/components/ui/surfaces.tsx`
  - Extend `ChartPanel` to accept toolbar, legend, and range-strip slots.
- Modify: `apps/web/components/ui/view-switch.tsx`
  - Add an explicit accessible name.
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`
  - Remove English eyebrow copy.
- Modify: `apps/web/components/single-year/budget-radar.tsx`
  - Replace numeric-only spoke labels with Georgian category labels or short Georgian labels.
- Modify: `apps/web/components/single-year/budget-field.tsx`
  - Replace English visible labels with Georgian-first labels.
- Modify: `apps/web/components/single-year/single-year-ranking.tsx`
  - Replace English visible labels with Georgian-first labels.
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
  - Add CSV download/content coverage.
  - Add assertions for no duplicate single-year select.
- Create: `apps/web/tests/browser/visual-reference.spec.ts`
  - Capture reference/product screenshots.
  - Assert key reference-aligned structure.
- Create: `apps/web/.env.example`
  - Document the env vars required when running `npm run build` from `apps/web`.
- Modify: `docs/superpowers/plans/2026-05-28-geodata-v1-ui-design-system-implementation.md`
  - Mark the previous checklist as superseded or update its status so it no longer reads like unfinished active work.

## Task 1: Hygiene And Build Readiness Baseline

**Files:**

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Create: `apps/web/.env.example`
- Modify: `docs/superpowers/plans/2026-05-28-geodata-v1-ui-design-system-implementation.md`

- [ ] **Step 1: Verify current hygiene failure**

Run from repo root:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' diff --check
```

Expected before this task: FAIL with trailing-whitespace reports starting in `apps/web/components/main-explorer/main-explorer.tsx`.

- [ ] **Step 2: Normalize `main-explorer.tsx` without behavior changes**

Edit `apps/web/components/main-explorer/main-explorer.tsx` only to remove trailing whitespace and line-ending churn. Keep the same imports, state, handlers, JSX, and test IDs.

Run:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' diff --check -- apps/web/components/main-explorer/main-explorer.tsx
```

Expected: no output and exit code `0`.

- [ ] **Step 3: Add app-local env example**

Create `apps/web/.env.example` with:

```dotenv
# Required by Prisma when commands are run from apps/web.
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/postgres

# Optional public Supabase client values for future read-only client features.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Mark the previous plan as superseded**

At the top of `docs/superpowers/plans/2026-05-28-geodata-v1-ui-design-system-implementation.md`, directly under the title, add:

```markdown
> **Status:** Superseded for follow-up by `docs/superpowers/plans/2026-05-28-geodata-v1-ui-follow-up-fidelity.md`. The implementation was completed but review found remaining fidelity, accessibility, CSV-test, and hygiene gaps.
```

Do not rewrite the old plan body.

- [ ] **Step 5: Verify baseline commands**

Run from `apps/web`:

```powershell
npm run lint
npm run test
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/geodata'
$env:DIRECT_URL='postgresql://user:pass@localhost:5432/geodata'
npm run build
```

Expected:

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes with env vars set.

## Task 2: Remove Duplicate Single-Year Year Controls

**Files:**

- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add failing browser assertion**

In `apps/web/tests/browser/main-explorer.spec.ts`, inside the single-year test after clicking `view-single_year`, add:

```ts
await expect(page.getByTestId("year-pills")).toBeVisible();
await expect(page.locator("select")).toHaveCount(0);
```

Run from `apps/web`:

```powershell
npm run test:browser -- main-explorer.spec.ts
```

Expected before implementation: FAIL because the external single-year `<select>` still renders.

- [ ] **Step 2: Simplify `ExplorerControls` props**

In `apps/web/components/main-explorer/explorer-controls.tsx`, remove these props:

```ts
chartMode: ChartMode;
shareModeActive: boolean;
years: number[];
startYear: number;
endYear: number;
singleYear: number;
onChartModeChange: (mode: ChartMode) => void;
onShareModeChange: (active: boolean) => void;
onStartYearChange: (year: number) => void;
onEndYearChange: (year: number) => void;
onSingleYearChange: (year: number) => void;
```

The final prop type should be:

```ts
type ExplorerControlsProps = {
  side: ExplorerSide;
  viewMode: ViewMode;
  onSideChange: (side: ExplorerSide) => void;
  onViewModeChange: (mode: ViewMode) => void;
};
```

- [ ] **Step 3: Keep only side and view switch in `ExplorerControls`**

Replace the component body with:

```tsx
export function ExplorerControls({
  side,
  viewMode,
  onSideChange,
  onViewModeChange,
}: ExplorerControlsProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <SegmentedControl
        label="Budget side"
        value={side}
        onChange={onSideChange}
        options={[
          { value: "expenditure", label: sideLabels.expenditure, testId: "side-expenditure" },
          { value: "revenue", label: sideLabels.revenue, testId: "side-revenue" },
        ]}
      />
      <div data-testid="view-switch">
        <ViewSwitch
          label={viewMode === "single_year" ? viewModeLabels.multi_year : viewModeLabels.single_year}
          checked={viewMode === "single_year"}
          checkedValue="single_year"
          uncheckedValue="multi_year"
          onChange={onViewModeChange}
          testId={viewMode === "single_year" ? "view-multi_year" : "view-single_year"}
          ariaLabel={viewMode === "single_year" ? "Switch to multi-year view" : "Switch to single-year view"}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `MainExplorer` call site**

In `apps/web/components/main-explorer/main-explorer.tsx`, change the `ExplorerControls` call to:

```tsx
<ExplorerControls
  side={side}
  viewMode={viewMode}
  onSideChange={handleSideChange}
  onViewModeChange={setViewMode}
/>
```

- [ ] **Step 5: Verify**

Run from `apps/web`:

```powershell
npm run lint
npm run test:browser -- main-explorer.spec.ts
```

Expected: PASS.

## Task 3: Move Multi-Year Chart Controls Into The Chart Panel

**Files:**

- Create: `apps/web/components/main-explorer/chart-panel-controls.tsx`
- Create: `apps/web/components/main-explorer/chart-legend.tsx`
- Create: `apps/web/components/main-explorer/year-range-strip.tsx`
- Modify: `apps/web/components/ui/surfaces.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add failing browser assertions**

In `apps/web/tests/browser/main-explorer.spec.ts`, in the `multi-year production controls expose only line table and share toggle` test, replace the top-level control assertions with scoped assertions:

```ts
const chartPanel = page.getByTestId("chart-panel");
await expect(chartPanel.getByTestId("chart-mode-line")).toBeVisible();
await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
await expect(chartPanel.getByTestId("measure-share-toggle")).toBeVisible();
await expect(chartPanel.getByTestId("chart-legend")).toBeVisible();
await expect(chartPanel.getByTestId("year-range-strip")).toBeVisible();
```

Run:

```powershell
npm run test:browser -- main-explorer.spec.ts
```

Expected before implementation: FAIL because the controls, legend, and range strip are not inside `chart-panel`.

- [ ] **Step 2: Create `ChartPanelControls`**

Create `apps/web/components/main-explorer/chart-panel-controls.tsx`:

```tsx
import type { ChartMode } from "../../lib/explorer/types";

type ChartPanelControlsProps = {
  chartMode: ChartMode;
  shareModeActive: boolean;
  onChartModeChange: (mode: ChartMode) => void;
  onShareModeChange: (active: boolean) => void;
};

const chartModeLabels: Record<"line" | "table", string> = {
  line: "ხაზი",
  table: "ცხრილი",
};

export function ChartPanelControls({
  chartMode,
  shareModeActive,
  onChartModeChange,
  onShareModeChange,
}: ChartPanelControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full bg-[var(--strong)] p-[2px]" aria-label="Chart mode">
        {(["line", "table"] as const).map((mode) => {
          const active = (chartMode === "table" ? "table" : "line") === mode;

          return (
            <button
              key={mode}
              type="button"
              data-testid={`chart-mode-${mode}`}
              aria-pressed={active}
              onClick={() => onChartModeChange(mode)}
              className={[
                "h-8 min-w-20 rounded-full px-4 text-[13px] font-semibold transition",
                active ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--mute)] hover:text-[var(--body)]",
              ].join(" ")}
            >
              {chartModeLabels[mode]}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        data-testid="measure-share-toggle"
        aria-label="Show percent share"
        aria-pressed={shareModeActive}
        onClick={() => onShareModeChange(!shareModeActive)}
        className={[
          "h-8 rounded-full px-4 text-[13px] font-semibold transition",
          shareModeActive
            ? "bg-[var(--primary)] text-[var(--on-primary)]"
            : "border border-[var(--hairline)] bg-[var(--surface)] text-[var(--body)]",
        ].join(" ")}
      >
        % წილი
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `ChartLegend`**

Create `apps/web/components/main-explorer/chart-legend.tsx`:

```tsx
import type { ExplorerItem } from "../../lib/explorer/types";

type ChartLegendProps = {
  items: ExplorerItem[];
};

export function ChartLegend({ items }: ChartLegendProps) {
  if (items.length === 0) return null;

  return (
    <div data-testid="chart-legend" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-[var(--body)]">
      {items.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.kaLabel}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `YearRangeStrip`**

Create `apps/web/components/main-explorer/year-range-strip.tsx`:

```tsx
type YearRangeStripProps = {
  years: number[];
  startYear: number;
  endYear: number;
  onStartYearChange: (year: number) => void;
  onEndYearChange: (year: number) => void;
};

export function YearRangeStrip({
  years,
  startYear,
  endYear,
  onStartYearChange,
  onEndYearChange,
}: YearRangeStripProps) {
  const minYear = years[0] ?? startYear;
  const maxYear = years.at(-1) ?? endYear;

  function setAll() {
    onStartYearChange(minYear);
    onEndYearChange(maxYear);
  }

  function setLatestOnly() {
    onStartYearChange(maxYear);
    onEndYearChange(maxYear);
  }

  return (
    <div data-testid="year-range-strip" className="rounded-[16px] bg-[var(--soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-[var(--body)]">
          პერიოდი: <strong className="text-[var(--ink)]">{startYear} - {endYear}</strong>
        </div>
        <div className="flex gap-2" aria-label="Quick range">
          <button type="button" onClick={setLatestOnly} className="rounded-full px-3 py-1 text-xs font-semibold text-[var(--body)]">
            1Y
          </button>
          <button type="button" onClick={setAll} className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--ink)] shadow-sm">
            ALL
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2" aria-label="Year range">
        {years.map((year) => {
          const active = year >= startYear && year <= endYear;

          return (
            <button
              key={year}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (year <= endYear) onStartYearChange(year);
                if (year > endYear) onEndYearChange(year);
              }}
              className={[
                "h-2 flex-1 rounded-full transition",
                active ? "bg-[var(--primary)]" : "bg-[var(--strong)]",
              ].join(" ")}
            >
              <span className="sr-only">{year}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Extend `ChartPanel` slots**

In `apps/web/components/ui/surfaces.tsx`, change `ChartPanelProps` to:

```ts
type ChartPanelProps = ChildrenProps & {
  mode?: string;
  measure?: string;
  toolbar?: ReactNode;
  legend?: ReactNode;
  rangeStrip?: ReactNode;
};
```

Change `ChartPanel` to:

```tsx
export function ChartPanel({ children, mode, measure, toolbar, legend, rangeStrip }: ChartPanelProps) {
  return (
    <section
      data-testid="chart-panel"
      data-mode={mode}
      data-measure={measure}
      className="min-w-0 rounded-[20px] bg-[var(--chart)] p-3"
    >
      {toolbar ? <div className="mb-3">{toolbar}</div> : null}
      {children}
      {mode !== "table" && legend ? <div className="mt-3">{legend}</div> : null}
      {mode !== "table" && rangeStrip ? <div className="mt-4">{rangeStrip}</div> : null}
    </section>
  );
}
```

- [ ] **Step 6: Wire chart panel slots in `MainExplorer`**

Import the new components:

```ts
import { ChartLegend } from "./chart-legend";
import { ChartPanelControls } from "./chart-panel-controls";
import { YearRangeStrip } from "./year-range-strip";
```

Before `return`, add:

```tsx
const chartToolbar = (
  <ChartPanelControls
    chartMode={chartMode}
    shareModeActive={shareModeActive}
    onChartModeChange={handleChartModeChange}
    onShareModeChange={setShareModeActive}
  />
);

const chartLegend = <ChartLegend items={model.selectedItems} />;

const rangeStrip = (
  <YearRangeStrip
    years={allYears}
    startYear={startYear}
    endYear={endYear}
    onStartYearChange={handleStartYearChange}
    onEndYearChange={handleEndYearChange}
  />
);
```

Pass these props to both multi-year `ChartPanel` branches:

```tsx
<ChartPanel mode={chartMode} measure={measure} toolbar={chartToolbar} legend={chartLegend} rangeStrip={rangeStrip}>
```

- [ ] **Step 7: Verify**

Run from `apps/web`:

```powershell
npm run lint
npm run test:browser -- main-explorer.spec.ts
```

Expected: PASS.

## Task 4: Georgian-First Copy, Radar Readability, And Accessible Switches

**Files:**

- Modify: `apps/web/components/ui/view-switch.tsx`
- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`
- Modify: `apps/web/components/single-year/budget-radar.tsx`
- Modify: `apps/web/components/single-year/budget-field.tsx`
- Modify: `apps/web/components/single-year/single-year-ranking.tsx`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add copy/accessibility assertions**

In `apps/web/tests/browser/main-explorer.spec.ts`, after entering single-year mode, add:

```ts
await expect(page.getByText("Single-year snapshot")).toHaveCount(0);
await expect(page.getByText("Budget Radar")).toHaveCount(0);
await expect(page.getByText("Budget Field")).toHaveCount(0);
await expect(page.getByRole("button", { name: "Switch to multi-year view" })).toBeVisible();
await expect(page.getByTestId("budget-radar").locator("text")).not.toHaveCount(0);
```

Run:

```powershell
npm run test:browser -- main-explorer.spec.ts
```

Expected before implementation: FAIL on English strings and/or switch accessible name.

- [ ] **Step 2: Add `ariaLabel` to `ViewSwitch`**

In `apps/web/components/ui/view-switch.tsx`, update props:

```ts
type ViewSwitchProps<T extends string> = {
  label: string;
  checked: boolean;
  checkedValue: T;
  uncheckedValue: T;
  onChange: (value: T) => void;
  testId?: string;
  ariaLabel: string;
};
```

Add `aria-label={ariaLabel}` to the `<button>`.

- [ ] **Step 3: Replace English single-year copy**

Use these replacements:

- `Single-year snapshot` -> `ერთწლიანი სურათი`
- `Budget Radar` -> `ბიუჯეტის რადარი`
- `Budget Field` -> `ბიუჯეტის ველი`
- `Share` -> `წილი`
- `Growth` -> `ზრდა`
- `Rank` -> `#`

- [ ] **Step 4: Make radar labels visible**

In `apps/web/components/single-year/budget-radar.tsx`, replace the `{index + 1}` text with a short Georgian label:

```tsx
{item.kaLabel.length > 14 ? `${item.kaLabel.slice(0, 13)}…` : item.kaLabel}
```

Keep the `<title>` tooltip on dots with the full Georgian label and values.

- [ ] **Step 5: Verify**

Run from `apps/web`:

```powershell
npm run lint
npm run test
npm run test:browser -- main-explorer.spec.ts
```

Expected: PASS.

## Task 5: CSV Download Coverage

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add CSV test**

Add this test to `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("CSV download uses the active filtered table data", async ({ page }) => {
  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /CSV/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local CSV download path");

  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(path, "utf8");

  expect(download.suggestedFilename()).toContain("geodata-budget-expenditure-");
  expect(csv.split("\n")[0]).toBe("year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at");
  expect(csv).toContain("expenditure.total");
  expect(csv).toContain("actual");
});
```

- [ ] **Step 2: Verify**

Run:

```powershell
npm run test:browser -- main-explorer.spec.ts
```

Expected: PASS.

## Task 6: Visual Reference Comparison Harness

**Files:**

- Create: `apps/web/tests/browser/visual-reference.spec.ts`
- Modify: `apps/web/playwright.config.ts` only if snapshot settings need a stable default.

- [ ] **Step 1: Create visual-reference test file**

Create `apps/web/tests/browser/visual-reference.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifactDir = join(process.cwd(), "test-results", "visual-reference");
const referenceDir = join(process.cwd(), "..", "..", "docs", "Design HTML files");

async function waitForApp(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function capture(page: Page, name: string) {
  await mkdir(artifactDir, { recursive: true });
  await page.screenshot({
    path: join(artifactDir, `${name}.png`),
    fullPage: true,
    caret: "hide",
  });
}

test("multi-year app matches approved reference structure", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  await page.goto(pathToFileURL(join(referenceDir, "multiyear-apple.html")).href);
  await capture(page, "multiyear-reference");

  await page.goto("http://localhost:3100");
  await waitForApp(page);
  await capture(page, "multiyear-product");

  const chartPanel = page.getByTestId("chart-panel");
  await expect(chartPanel.getByTestId("chart-mode-line")).toBeVisible();
  await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
  await expect(chartPanel.getByTestId("measure-share-toggle")).toBeVisible();
  await expect(chartPanel.getByTestId("chart-legend")).toBeVisible();
  await expect(chartPanel.getByTestId("year-range-strip")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
});

test("single-year app matches approved reference structure", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pathToFileURL(join(referenceDir, "singleyear-apple.html")).href);
  await capture(page, "singleyear-reference-mobile");

  await page.goto("http://localhost:3100");
  await waitForApp(page);
  await page.getByTestId("view-single_year").click();
  await capture(page, "singleyear-product-mobile");

  await expect(page.getByTestId("year-pills")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
  await expect(page.getByText("Single-year snapshot")).toHaveCount(0);
  await expect(page.getByText("Budget Radar")).toHaveCount(0);
  await expect(page.getByText("Budget Field")).toHaveCount(0);
});
```

- [ ] **Step 2: Run visual reference test and inspect output**

Run:

```powershell
npm run test:browser -- visual-reference.spec.ts
```

Expected after Tasks 2-4: PASS and screenshots saved under:

```text
apps/web/test-results/visual-reference/multiyear-reference.png
apps/web/test-results/visual-reference/multiyear-product.png
apps/web/test-results/visual-reference/singleyear-reference-mobile.png
apps/web/test-results/visual-reference/singleyear-product-mobile.png
```

- [ ] **Step 3: Add product screenshot baselines after visual match**

After the paired screenshots look acceptably aligned with the HTML references, add product snapshot assertions:

```ts
await expect(page).toHaveScreenshot("multiyear-product.png", {
  fullPage: true,
  maxDiffPixelRatio: 0.02,
});
```

and:

```ts
await expect(page).toHaveScreenshot("singleyear-product-mobile.png", {
  fullPage: true,
  maxDiffPixelRatio: 0.02,
});
```

Generate the initial baselines only after the UI has been corrected:

```powershell
npm run test:browser -- visual-reference.spec.ts --update-snapshots
```

Expected: baseline images are created by Playwright and future runs fail on product visual regressions.

## Task 7: Final Verification And Readiness Review

**Files:**

- No new files unless a previous task requires a surgical fix.

- [ ] **Step 1: Run full automated checks**

Run from `apps/web`:

```powershell
npm run lint
npm run test
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/geodata'
$env:DIRECT_URL='postgresql://user:pass@localhost:5432/geodata'
npm run build
npm run test:browser
```

Expected: all pass.

- [ ] **Step 2: Run repository hygiene check**

Run from repo root:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' diff --check
& 'C:\Program Files\Git\cmd\git.exe' status --short
```

Expected:

- `git diff --check` passes.
- `git status --short` contains only intentional implementation, test, and plan changes.

- [ ] **Step 3: Visual review gate**

Open the screenshot pairs:

```text
apps/web/test-results/visual-reference/multiyear-reference.png
apps/web/test-results/visual-reference/multiyear-product.png
apps/web/test-results/visual-reference/singleyear-reference-mobile.png
apps/web/test-results/visual-reference/singleyear-product-mobile.png
```

Required visual match:

- Single-year shows one year control surface only: `YearPills`.
- Multi-year Line/Table and `% წილი` are inside the chart panel.
- Multi-year includes legend and range strip under the chart.
- Every 100 GEL has exactly 100 cells and no side list.
- Budget Radar uses visible Georgian labels.
- Light/Night layout stays structurally identical.
- Georgian labels are readable on desktop and mobile.

## Final Success Criteria

Implementation is complete only when:

- `git diff --check` passes.
- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes with documented env vars.
- `npm run test:browser` passes.
- CSV download is tested by clicking the button and inspecting CSV headers/content.
- Visual-reference screenshots are generated for approved HTML references and product screens.
- Product UI no longer has duplicate single-year year controls.
- Multi-year chart controls, legend, and range strip match the accepted Apple reference structure.
- English-only production labels identified in review are replaced with Georgian-first labels.
- The previous implementation plan no longer looks like the active unfinished checklist.

## Self-Review

- Spec coverage: This plan covers the review findings for duplicate year controls, chart control placement, range strip, legend, CSV test coverage, plan-file confusion, build env documentation, Georgian-first copy, radar readability, accessible switch naming, and visual-reference testing.
- Placeholder scan: No `TBD`, `TODO`, or unresolved implementation placeholders remain.
- Type consistency: `ChartMode`, `ExplorerItem`, `ChartPanel`, `ViewSwitch`, and existing test IDs match the current codebase names.
