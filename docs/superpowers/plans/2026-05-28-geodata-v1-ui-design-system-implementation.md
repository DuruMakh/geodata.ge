# GeoData.ge V1 UI Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Budget Explorer UI to the approved Apple-like Light/Night design system from the confirmed HTML references while preserving the existing data and export behavior.

**Architecture:** Keep the current Next.js page/data flow and explorer model builders. Add a lean presentation foundation for theme tokens and reusable UI surfaces, then convert the multi-year and single-year screens against that foundation. Browser tests become the contract for the approved visible UI: Line/Table only, `% წილი` toggle, Light/Night parity, Budget Radar, no legacy neon shell, and no old petals section.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind 4, Recharts 3, Vitest, Playwright.

---

## Source Documents

Read before execution:

- `AGENTS.md`
- `DESIGN.md`
- `docs/Design HTML files/multiyear-apple.html`
- `docs/Design HTML files/singleyear-apple.html`
- `docs/superpowers/specs/2026-05-28-geodata-v1-ui-design-system-implementation.md`

Visual source-of-truth priority:

1. `docs/Design HTML files/multiyear-apple.html`
2. `docs/Design HTML files/singleyear-apple.html`
3. `DESIGN.md`
4. Existing app behavior and data contracts

If the HTML references and `DESIGN.md` disagree visually, follow the HTML and update `DESIGN.md` in the same task.

## Scope

Included:

- Light/Night theme tokens and theme persistence.
- Approved page shell, screen card, top bar, controls, chart panel, series panel, content sections, and tables.
- Multi-year production UI with only Line and Table visible.
- `% წილი` toggle instead of the current measure dropdown.
- CSV and source/update context preservation.
- Single-year section order: year pills, four headline cards, treemap, Every 100 GEL, Budget Radar, Budget Field, full ranking.
- Revenue reuses the same visual system as expenditure.
- Browser verification for desktop, mobile, Light, Night, multi-year, single-year, revenue, and CSV.

Excluded:

- New data ingestion.
- New taxonomy/glossary work.
- Bar or stacked chart production UI.
- Share-of-GDP UI.
- Marketing homepage.
- Clickable drilldown pages.
- Broad component library work beyond the listed practical components.

## File Structure

Create:

- `apps/web/components/ui/theme-toggle.tsx`  
  Theme switch control and `localStorage` persistence hook.

- `apps/web/components/ui/segmented-control.tsx`  
  Small generic segmented button control for side, chart mode, and compact sort controls.

- `apps/web/components/ui/view-switch.tsx`  
  iOS-style Multi-year/Single-year switch.

- `apps/web/components/ui/surfaces.tsx`  
  `ScreenCard`, `ContentSection`, `ChartPanel`, `TableSurface`, and `StatusSurface`.

- `apps/web/components/ui/year-pills.tsx`  
  Horizontal year selector used by single-year mode.

- `apps/web/components/single-year/budget-radar.tsx`  
  Budget Radar replacement for `SpendingPetals`.

- `apps/web/tests/explorer/themeTokens.test.ts`  
  Token contract test for required CSS variables.

Modify:

- `apps/web/app/globals.css`  
  Replace the old neon globals with approved CSS custom properties and theme-aware base styles.

- `apps/web/app/layout.tsx`  
  Keep `lang="ka"` and font variables; set the initial body theme attribute to `data-theme="light"`.

- `apps/web/components/main-explorer/main-explorer.tsx`  
  Rebuild the high-level shell around `ScreenCard`, Light/Night theme, confirmed top bar, multi-year/single-year switching, source label, CSV placement, and state restrictions.

- `apps/web/components/main-explorer/explorer-controls.tsx`  
  Convert to approved controls: Expenditure/Revenue segmented switch, iOS-style view switch, Line/Table tabs, `% წილი` toggle, and remove visible bar/stacked/full measure dropdown controls.

- `apps/web/components/main-explorer/chart-frame.tsx`  
  Restyle Recharts line view to the approved plot frame and support nominal/share modes. Keep the existing bar/stacked branches as unexposed internal code for this pass, and restyle their fallback surfaces so they do not retain neon classes.

- `apps/web/components/main-explorer/explorer-table.tsx`  
  Restyle table to approved `TableSurface` and confirmed columns.

- `apps/web/components/main-explorer/series-selector.tsx`  
  Restyle to approved series panel with search, chips, selected rows, latest values, and the CSV button at the bottom of the panel.

- `apps/web/components/main-explorer/period-summary.tsx`  
  Restyle below-chart KPI cards, movers board, and start/end analysis.

- `apps/web/components/single-year/single-year-snapshot.tsx`  
  Apply approved section order, year pills, and replace `SpendingPetals` with `BudgetRadar`.

- `apps/web/components/single-year/snapshot-headline-cards.tsx`  
  Apply approved four gradient cards.

- `apps/web/components/single-year/snapshot-treemap.tsx`  
  Restyle to approved structure section and keep labels contained.

- `apps/web/components/single-year/every-100-gel.tsx`  
  Remove side list and render the approved centered 100-cell visual.

- `apps/web/components/single-year/budget-field.tsx`  
  Restyle to approved Budget Field surface and theme tokens.

- `apps/web/components/single-year/single-year-ranking.tsx`  
  Restyle to approved ranking table.

- `apps/web/lib/explorer/singleYear.ts`  
  Rename model field `petals` to `radarItems`. The visible component must be `BudgetRadar`.

- `apps/web/tests/browser/main-explorer.spec.ts`  
  Replace legacy dark/neon, stacked, dropdown, and petals assertions with approved design contract assertions.

- `apps/web/tests/explorer/singleYear.test.ts`  
  Add model assertions for `radarItems` aggregation.

Do not modify:

- Data import scripts.
- Prisma schema.
- CSV export logic except for UI-trigger integration.
- Source documents or normalized data files.

## Task 1: Lock Browser and Model Tests to the Approved UI Contract

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/tests/explorer/singleYear.test.ts`
- Create: `apps/web/tests/explorer/themeTokens.test.ts`

- [ ] **Step 1: Replace the stacked-mode browser test with a negative visible-mode test**

In `apps/web/tests/browser/main-explorer.spec.ts`, delete the test named `stacked composition mode renders real expenditure bars` and add this test in its place:

```ts
test("multi-year production controls expose only confirmed line/table and share toggle", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");

  await expect(page.getByTestId("chart-mode-line")).toBeVisible();
  await expect(page.getByTestId("chart-mode-table")).toBeVisible();
  await expect(page.getByTestId("measure-share-toggle")).toBeVisible();
  await expect(page.getByRole("button", { name: "სვეტები" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "კომპოზიცია" })).toHaveCount(0);
  await expect(page.getByLabel("საზომი")).toHaveCount(0);

  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toBeVisible();

  await page.getByTestId("chart-mode-line").click();
  await expect(page.getByTestId("chart-frame")).toBeVisible();

  await page.getByTestId("measure-share-toggle").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "share_of_total");

  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 2: Update single-year browser assertions from petals to radar**

In `apps/web/tests/browser/main-explorer.spec.ts`, replace both occurrences of:

```ts
await expect(page.getByTestId("spending-petals")).toBeVisible();
```

with:

```ts
await expect(page.getByTestId("budget-radar")).toBeVisible();
await expect(page.getByTestId("spending-petals")).toHaveCount(0);
```

- [ ] **Step 3: Add Light/Night browser coverage**

Add this test to `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("light and night themes share the same product layout", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("theme-light")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("theme-night")).toHaveAttribute("aria-pressed", "false");

  const lightLayout = await page.getByTestId("screen-card").boundingBox();

  await page.getByTestId("theme-night").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "night");
  await expect(page.getByTestId("theme-night")).toHaveAttribute("aria-pressed", "true");

  const nightLayout = await page.getByTestId("screen-card").boundingBox();
  expect(Math.round(nightLayout?.width ?? 0)).toBe(Math.round(lightLayout?.width ?? 0));

  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "night");

  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 4: Add Every 100 GEL no-list browser assertions**

In the single-year browser test, after `await expect(page.getByTestId("every-100-gel")).toBeVisible();`, add:

```ts
await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
await expect(page.getByTestId("every-100-gel").getByRole("list")).toHaveCount(0);
```

- [ ] **Step 5: Add CSS token contract test**

Create `apps/web/tests/explorer/themeTokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

describe("approved design system tokens", () => {
  it("defines the required core and theme CSS variables", () => {
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

  it("keeps light and night theme attribute blocks", () => {
    expect(globalsCss).toContain('[data-theme="light"]');
    expect(globalsCss).toContain('[data-theme="night"]');
  });
});
```

- [ ] **Step 6: Run the focused failing tests**

Run:

```powershell
npm run test -- tests/explorer/themeTokens.test.ts tests/explorer/singleYear.test.ts
```

Expected before implementation: `themeTokens.test.ts` fails because approved tokens are not yet in `globals.css`; `singleYear.test.ts` still passes because radar model naming changes happen in Task 6.

Run:

```powershell
npm run test:browser -- main-explorer.spec.ts
```

Expected before implementation: browser tests fail because the UI still exposes legacy controls and `spending-petals`.

- [ ] **Step 7: Commit failing test contract**

```powershell
git add apps/web/tests/browser/main-explorer.spec.ts apps/web/tests/explorer/singleYear.test.ts apps/web/tests/explorer/themeTokens.test.ts
git commit -m "test: lock approved v1 UI contract"
```

## Task 2: Implement Theme Tokens and Theme Toggle Foundation

**Files:**

- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/components/ui/theme-toggle.tsx`

- [ ] **Step 1: Replace global neon CSS with approved tokens**

In `apps/web/app/globals.css`, keep `@import "tailwindcss";` and replace the old `:root`, `@theme inline`, and `body` rules with:

```css
@import "tailwindcss";

:root {
  --primary: #0071e3;
  --primary-active: #0077ed;
  --teal: #30d5c8;
  --yellow: #ffd60a;
  --blue: #0a84ff;
  --orange: #ff9f0a;
  --violet: #bf5af2;
  --slate: #8e8e93;
  --font-ui: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Noto Sans Georgian", sans-serif;
}

[data-theme="light"] {
  --canvas: #f5f5f7;
  --surface: #ffffff;
  --soft: #fafafa;
  --strong: #e8e8ed;
  --chart: #ffffff;
  --hairline: #e8e8ed;
  --hairline-soft: #f5f5f7;
  --ink: #1d1d1f;
  --body: #515154;
  --mute: #86868b;
  --grid: #f5f5f7;
  --shadow: rgba(0, 0, 0, 0.04);
  --on-primary: #ffffff;
}

[data-theme="night"] {
  --canvas: #000000;
  --surface: #1d1d1f;
  --soft: #161617;
  --strong: #323236;
  --chart: #1d1d1f;
  --hairline: #323236;
  --hairline-soft: #2d2d2f;
  --ink: #f5f5f7;
  --body: #a1a1a6;
  --mute: #86868b;
  --grid: #161617;
  --shadow: rgba(0, 0, 0, 0.6);
  --on-primary: #ffffff;
}

@theme inline {
  --color-background: var(--canvas);
  --color-foreground: var(--ink);
  --font-sans: var(--font-ui);
}

* {
  box-sizing: border-box;
}

html {
  background: var(--canvas);
}

body {
  min-width: 320px;
  overflow-x: hidden;
  background: var(--canvas);
  color: var(--ink);
  font-family: var(--font-ui);
}

button,
input {
  font: inherit;
  min-width: 0;
}

button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

::selection {
  background: color-mix(in srgb, var(--primary) 24%, transparent);
  color: var(--ink);
}
```

- [ ] **Step 2: Default the server-rendered body to light**

In `apps/web/app/layout.tsx`, change the body element to:

```tsx
<body data-theme="light" className="min-h-full flex flex-col">
  {children}
</body>
```

- [ ] **Step 3: Create the theme toggle component**

Create `apps/web/components/ui/theme-toggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "night";

const themes: Theme[] = ["light", "night"];

function applyTheme(theme: Theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("geodata-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("geodata-theme");
    const initialTheme: Theme = stored === "night" ? "night" : "light";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function selectTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="inline-flex rounded-full bg-[var(--strong)] p-[3px]" aria-label="Theme">
      {themes.map((nextTheme) => {
        const active = theme === nextTheme;

        return (
          <button
            key={nextTheme}
            type="button"
            data-testid={`theme-${nextTheme}`}
            aria-pressed={active}
            onClick={() => selectTheme(nextTheme)}
            className={[
              "h-[30px] w-20 rounded-full border-0 text-[13px] font-semibold transition",
              active
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_3px_var(--shadow)]"
                : "bg-transparent text-[var(--mute)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            {nextTheme === "light" ? "Light" : "Night"}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run token tests**

Run:

```powershell
npm run test -- tests/explorer/themeTokens.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit theme foundation**

```powershell
git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/components/ui/theme-toggle.tsx apps/web/tests/explorer/themeTokens.test.ts
git commit -m "feat: add approved theme tokens"
```

## Task 3: Add Lean UI Surface and Control Components

**Files:**

- Create: `apps/web/components/ui/segmented-control.tsx`
- Create: `apps/web/components/ui/view-switch.tsx`
- Create: `apps/web/components/ui/surfaces.tsx`
- Create: `apps/web/components/ui/year-pills.tsx`

- [ ] **Step 1: Create segmented control**

Create `apps/web/components/ui/segmented-control.tsx`:

```tsx
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

export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-full bg-[var(--canvas)] p-1" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            data-testid={option.testId}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={[
              "h-8 rounded-full px-4 text-[13px] font-semibold transition",
              active
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_3px_var(--shadow)]"
                : "text-[var(--mute)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create view switch**

Create `apps/web/components/ui/view-switch.tsx`:

```tsx
type ViewSwitchProps<T extends string> = {
  label: string;
  checked: boolean;
  checkedValue: T;
  uncheckedValue: T;
  onChange: (value: T) => void;
  testId?: string;
};

export function ViewSwitch<T extends string>({
  label,
  checked,
  checkedValue,
  uncheckedValue,
  onChange,
  testId,
}: ViewSwitchProps<T>) {
  return (
    <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--body)]">
      <span>{label}</span>
      <button
        type="button"
        data-testid={testId}
        aria-pressed={checked}
        aria-label={label}
        onClick={() => onChange(checked ? uncheckedValue : checkedValue)}
        className="relative h-[31px] w-[51px] rounded-full bg-[var(--strong)] transition"
      >
        <i
          className={[
            "absolute top-0.5 h-[27px] w-[27px] rounded-full bg-[var(--surface)] shadow-[0_2px_5px_var(--shadow)] transition",
            checked ? "left-[22px]" : "left-0.5",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create surface components**

Create `apps/web/components/ui/surfaces.tsx`:

```tsx
import type { ReactNode } from "react";

export function ScreenCard({ children }: { children: ReactNode }) {
  return (
    <section
      data-testid="screen-card"
      className="mb-6 rounded-[24px] bg-[var(--surface)] p-6 shadow-[0_20px_40px_var(--shadow)]"
    >
      {children}
    </section>
  );
}

export function ContentSection({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <section
      data-testid={testId}
      className="mt-6 rounded-[24px] bg-[var(--surface)] p-6 shadow-[0_20px_40px_var(--shadow)]"
    >
      {children}
    </section>
  );
}

export function ChartPanel({ children, mode, measure }: { children: ReactNode; mode?: string; measure?: string }) {
  return (
    <section
      data-testid="chart-panel"
      data-mode={mode}
      data-measure={measure}
      className="rounded-[20px] bg-[var(--surface)]"
    >
      {children}
    </section>
  );
}

export function TableSurface({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="max-w-full overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--surface)]">
      {children}
    </div>
  );
}

export function StatusSurface({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--hairline)] bg-[var(--soft)] p-6 text-sm text-[var(--body)]">
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Create year pills**

Create `apps/web/components/ui/year-pills.tsx`:

```tsx
type YearPillsProps = {
  years: number[];
  value: number;
  onChange: (year: number) => void;
};

export function YearPills({ years, value, onChange }: YearPillsProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto" data-testid="year-pills">
      <b className="shrink-0 text-xs font-semibold text-[var(--mute)]">წელი:</b>
      <div className="inline-flex rounded-full bg-[var(--canvas)] p-1" aria-label="Year">
        {years.map((year) => {
          const active = value === year;

          return (
            <button
              key={year}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(year)}
              className={[
                "h-8 min-w-[62px] rounded-full px-3 text-[13px] font-semibold transition",
                active
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_3px_var(--shadow)]"
                  : "text-[var(--mute)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run TypeScript/lint check**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit UI foundation**

```powershell
git add apps/web/components/ui/segmented-control.tsx apps/web/components/ui/view-switch.tsx apps/web/components/ui/surfaces.tsx apps/web/components/ui/year-pills.tsx
git commit -m "feat: add approved UI primitives"
```

## Task 4: Convert Main Explorer Shell and Controls

**Files:**

- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`

- [ ] **Step 1: Narrow visible multi-year modes**

In `apps/web/components/main-explorer/explorer-controls.tsx`, replace the visible chart mode list with:

```ts
const visibleChartModes: ChartMode[] = ["line", "table"];
```

Do not render `bar` or `stacked` buttons.

- [ ] **Step 2: Replace full measure dropdown with share toggle prop**

Change `ExplorerControlsProps` by removing `measure`, `onMeasureChange`, `barYear`, and `onBarYearChange` from the rendered UI contract. Add:

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

- [ ] **Step 3: Render approved controls**

Use `SegmentedControl` and `ViewSwitch` in `ExplorerControls`:

```tsx
<SegmentedControl
  label="Budget side"
  value={side}
  onChange={onSideChange}
  options={[
    { value: "expenditure", label: "ხარჯები", testId: "side-expenditure" },
    { value: "revenue", label: "შემოსავლები", testId: "side-revenue" },
  ]}
/>

<ViewSwitch
  label="მრავალწლიანი"
  checked={viewMode === "single_year"}
  checkedValue="single_year"
  uncheckedValue="multi_year"
  onChange={onViewModeChange}
  testId="view-switch"
/>
```

For multi-year mode, render:

```tsx
<SegmentedControl
  label="Chart mode"
  value={chartMode}
  onChange={onChartModeChange}
  options={[
    { value: "line", label: "ხაზი", testId: "chart-mode-line" },
    { value: "table", label: "ცხრილი", testId: "chart-mode-table" },
  ]}
/>

<button
  type="button"
  data-testid="measure-share-toggle"
  aria-pressed={shareModeActive}
  onClick={() => onShareModeChange(!shareModeActive)}
  className={[
    "h-8 rounded-full px-4 text-[13px] font-semibold transition",
    shareModeActive ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--strong)] text-[var(--ink)]",
  ].join(" ")}
>
  % წილი
</button>
```

- [ ] **Step 4: Update `MainExplorer` measure state mapping**

In `main-explorer.tsx`, keep existing model support but map visible share toggle to the existing model measure:

```ts
const [shareModeActive, setShareModeActive] = useState(false);
const measure: MeasureMode = shareModeActive ? "share_of_total" : "nominal";
```

Remove visible code paths that switch to `bar`, `stacked`, `percent_change`, or `share_of_gdp`.

- [ ] **Step 5: Rebuild page shell with theme toggle and screen card**

In `main-explorer.tsx`, wrap the page in:

```tsx
<main data-testid="explorer-shell" className="min-h-screen bg-[var(--canvas)] px-4 py-10 text-[var(--ink)]">
  <div className="mx-auto w-[min(1200px,calc(100vw-32px))]">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-bold leading-tight">GeoData.ge Budget Explorer</h1>
        <p className="mt-2 text-[15px] leading-6 text-[var(--body)]">საქართველოს ბიუჯეტის მრავალწლიანი და ერთწლიანი ანალიზი</p>
      </div>
      <ThemeToggle />
    </div>
    <ScreenCard>
      <header data-testid="explorer-header" className="mb-6 border-b border-[var(--hairline)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--mute)]">GeoData.ge / Budget Explorer</p>
            <h2 className="mt-2 text-[22px] font-bold text-[var(--ink)]">საქართველოს ბიუჯეტის ანალიტიკა</h2>
          </div>
          <div data-testid="active-total-card" className="rounded-[16px] bg-[var(--canvas)] px-4 py-3 text-right">
            <p className="text-xs font-semibold text-[var(--mute)]">{headerYear ?? "n/a"}</p>
            <p className="mt-1 text-lg font-bold text-[var(--ink)]">{formatGel(headerTotal)}</p>
          </div>
        </div>
      </header>
      <div data-testid="explorer-controls" className="mb-6">
        <ExplorerControls
          side={side}
          viewMode={viewMode}
          chartMode={chartMode}
          shareModeActive={shareModeActive}
          years={allYears}
          startYear={startYear}
          endYear={endYear}
          singleYear={singleYear}
          onSideChange={handleSideChange}
          onViewModeChange={setViewMode}
          onChartModeChange={handleChartModeChange}
          onShareModeChange={setShareModeActive}
          onStartYearChange={handleStartYearChange}
          onEndYearChange={handleEndYearChange}
          onSingleYearChange={setSingleYear}
        />
      </div>
      {viewMode === "single_year" ? (
        <SingleYearSnapshot model={singleYearModel} years={allYears} onYearChange={setSingleYear} />
      ) : chartMode === "table" ? (
        <ExplorerTable rows={model.tableRows} years={model.years} />
      ) : (
        <ChartFrame mode="line" measure={measure} years={model.years} points={model.points} selectedItems={model.selectedItems} />
      )}
    </ScreenCard>
    <p data-testid="source-label" className="text-xs leading-5 text-[var(--body)]">
      მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები. ბოლო განახლება: {lastUpdatedAt}.
    </p>
  </div>
</main>
```

Keep existing `data-testid` values: `explorer-shell`, `explorer-header`, `explorer-controls`, `active-total-card`, `source-label`, and `series-selector`.

- [ ] **Step 6: Run browser contract tests**

Run:

```powershell
npm run test:browser -- main-explorer.spec.ts
```

Expected at this point: tests related to controls and theme should pass; single-year radar tests may still fail until Task 7.

- [ ] **Step 7: Commit shell and controls**

```powershell
git add apps/web/components/main-explorer/main-explorer.tsx apps/web/components/main-explorer/explorer-controls.tsx apps/web/lib/explorer/types.ts
git commit -m "feat: convert explorer shell controls"
```

## Task 5: Convert Multi-Year Chart, Table, Series Panel, and Summary

**Files:**

- Modify: `apps/web/components/main-explorer/chart-frame.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/series-selector.tsx`
- Modify: `apps/web/components/main-explorer/period-summary.tsx`

- [ ] **Step 1: Add approved chart panel structure**

In `chart-frame.tsx`, wrap line chart output with:

```tsx
<div data-testid="chart-frame" className="overflow-x-auto rounded-[18px] bg-[var(--canvas)] p-6">
  <div className="h-[420px] min-w-[680px]">
    <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={1} minHeight={CHART_HEIGHT} initialDimension={INITIAL_CHART_DIMENSION}>
      <LineChart data={rows} margin={{ top: 18, right: 24, bottom: 12, left: 18 }}>
        <CartesianGrid stroke="var(--grid)" />
        <XAxis dataKey="year" stroke="var(--mute)" tick={{ fontSize: 12, fill: "var(--mute)", fontWeight: 600 }} />
        <YAxis stroke="var(--mute)" tickFormatter={(value) => formatMeasureValue(Number(value), measure)} width={88} />
        <Tooltip />
        {selectedItems.map((item) => (
          <Line key={item.id} type="monotone" dataKey={chartKey(item.id)} name={item.kaLabel} stroke={item.color} strokeWidth={2} dot={(props) => renderPointDot(props, chartKey(item.id))} activeDot={{ r: 5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
</div>
```

Use token colors:

```tsx
<CartesianGrid stroke="var(--grid)" />
<XAxis dataKey="year" stroke="var(--mute)" tick={{ fontSize: 12, fill: "var(--mute)", fontWeight: 600 }} />
<YAxis stroke="var(--mute)" tickFormatter={(value) => formatMeasureValue(Number(value), measure)} width={88} />
```

Tooltip style:

```tsx
contentStyle={{
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
  color: "var(--ink)",
}}
```

- [ ] **Step 2: Keep hidden internal bar/stacked branches visually harmless**

Keep the existing `bar` and `stacked` branches in `ChartFrame` for this pass. Restyle their fallback surfaces with `var(--surface)`, `var(--canvas)`, and `var(--hairline)`. Do not add browser-visible controls for those modes.

- [ ] **Step 3: Restyle explorer table**

In `explorer-table.tsx`, wrap with:

```tsx
<TableSurface testId="explorer-table">
  <table className="min-w-[760px] w-full border-collapse text-sm">
```

Use approved header/body classes:

```tsx
<thead className="bg-[var(--soft)] text-xs text-[var(--mute)]">
<tr className="border-b border-[var(--hairline)]">
<td className="px-[18px] py-3 text-[var(--ink)]">
```

Keep planned badges, but restyle them:

```tsx
<span className="ml-2 rounded-full border border-[var(--hairline)] bg-[var(--soft)] px-2 py-0.5 text-[10px] text-[var(--body)]">
  გეგმა
</span>
```

- [ ] **Step 4: Restyle series selector**

In `series-selector.tsx`, change the outer `aside` to:

```tsx
<aside data-testid="series-selector" className="rounded-[20px] bg-[var(--surface)] p-5 lg:sticky lg:top-6">
```

Change search input to approved style:

```tsx
className="mt-4 h-9 w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--canvas)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--mute)]"
```

Change selected row surface to:

```tsx
selected
  ? "border-[var(--hairline)] bg-[var(--canvas)]"
  : "border-transparent bg-transparent hover:bg-[var(--soft)]"
```

- [ ] **Step 5: Restyle period summary**

In `period-summary.tsx`, use `ContentSection` for the wrapper and convert summary cells to rounded approved surfaces:

```tsx
<ContentSection testId="period-summary">
  <div className="grid gap-4 lg:grid-cols-4">
    <SummaryCell title="ჯამური ცვლილება" value={formatSignedPercent(summary.totalChange)} />
    <SummaryCell title="ყველაზე დიდი GEL მატება" value={summary.largestGelIncrease?.kaLabel ?? "მონაცემი არ არის"} detail={summary.largestGelIncrease ? `${startYear}-${endYear}` : undefined} />
    <SummaryCell title="ყველაზე სწრაფი ზრდა" value={summary.fastestGrowth?.kaLabel ?? "მონაცემი არ არის"} detail={formatSignedPercent(summary.fastestGrowth?.change ?? null)} />
    <SummaryCell title="ყველაზე დაბალი ზრდა" value={summary.lowestGrowth?.kaLabel ?? "მონაცემი არ არის"} detail={formatSignedPercent(summary.lowestGrowth?.change ?? null)} />
  </div>
</ContentSection>
```

Use `var(--canvas)`, `var(--hairline)`, `var(--ink)`, `var(--body)`, and category swatches. Keep the existing data calculations.

- [ ] **Step 6: Run focused browser tests**

Run:

```powershell
npm run test:browser -- main-explorer.spec.ts
```

Expected: multi-year chart/table/series tests pass; single-year tests may still fail until Task 7.

- [ ] **Step 7: Commit multi-year conversion**

```powershell
git add apps/web/components/main-explorer/chart-frame.tsx apps/web/components/main-explorer/explorer-table.tsx apps/web/components/main-explorer/series-selector.tsx apps/web/components/main-explorer/period-summary.tsx
git commit -m "feat: convert multi-year explorer UI"
```

## Task 6: Add Budget Radar Model Naming and Tests

**Files:**

- Modify: `apps/web/lib/explorer/types.ts`
- Modify: `apps/web/lib/explorer/singleYear.ts`
- Modify: `apps/web/tests/explorer/singleYear.test.ts`

- [ ] **Step 1: Rename `petals` model field to `radarItems`**

In `apps/web/lib/explorer/types.ts`, change:

```ts
petals: SnapshotItem[];
```

to:

```ts
radarItems: SnapshotItem[];
```

- [ ] **Step 2: Rename builder helper**

In `apps/web/lib/explorer/singleYear.ts`, rename `buildPetals` to:

```ts
function buildRadarItems(items: SnapshotItem[]): SnapshotItem[] {
  if (items.length <= 8) return items;

  const visible = items.slice(0, 7);
  const omitted = items.slice(7);
  const amountGel = omitted.reduce((sum, item) => sum + item.amountGel, 0);
  const previousAmounts = omitted.map((item) => item.previousAmountGel);
  const previousAmountGel = previousAmounts.every((amount): amount is number => amount !== null)
    ? previousAmounts.reduce((sum, amount) => sum + amount, 0)
    : null;

  return [
    ...visible,
    {
      itemId: "snapshot.other",
      kaLabel: "სხვა",
      enLabel: "Other",
      color: palette[7] ?? "#8e8e93",
      amountGel,
      shareOfTotal: omitted.reduce((sum, item) => sum + item.shareOfTotal, 0),
      previousAmountGel,
      changeFromPreviousYear: changeFromPrevious(amountGel, previousAmountGel),
      amountChangeFromPreviousYear: previousAmountGel === null ? null : amountGel - previousAmountGel,
      basis: omitted.some((item) => item.basis === "planned") ? "planned" : "actual",
      source: sourceMetadataFromItems(omitted),
    },
  ];
}
```

Return `radarItems: buildRadarItems(items)` in both empty and non-empty model returns.

- [ ] **Step 3: Update single-year tests**

In `apps/web/tests/explorer/singleYear.test.ts`, replace:

```ts
const other = model.petals.find((item) => item.itemId === "snapshot.other");
expect(model.petals).toHaveLength(8);
```

with:

```ts
const other = model.radarItems.find((item) => item.itemId === "snapshot.other");
expect(model.radarItems).toHaveLength(8);
```

Add this assertion to the first test:

```ts
expect(model.radarItems.map((item) => item.itemId)).toEqual(["spending.health", "spending.education", "spending.defense"]);
```

- [ ] **Step 4: Run model tests**

Run:

```powershell
npm run test -- tests/explorer/singleYear.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit radar model rename**

```powershell
git add apps/web/lib/explorer/types.ts apps/web/lib/explorer/singleYear.ts apps/web/tests/explorer/singleYear.test.ts
git commit -m "refactor: rename single-year radar items"
```

## Task 7: Convert Single-Year Snapshot and Add Budget Radar

**Files:**

- Modify: `apps/web/components/single-year/single-year-snapshot.tsx`
- Modify: `apps/web/components/single-year/snapshot-headline-cards.tsx`
- Modify: `apps/web/components/single-year/snapshot-treemap.tsx`
- Modify: `apps/web/components/single-year/every-100-gel.tsx`
- Create: `apps/web/components/single-year/budget-radar.tsx`
- Modify: `apps/web/components/single-year/budget-field.tsx`
- Modify: `apps/web/components/single-year/single-year-ranking.tsx`

- [ ] **Step 1: Create Budget Radar**

Create `apps/web/components/single-year/budget-radar.tsx`:

```tsx
import { formatGel, formatPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type BudgetRadarProps = {
  items: SnapshotItem[];
};

const CENTER = 210;
const AXIS_LENGTH = 138;

function pointFor(index: number, count: number, radius: number) {
  const angle = (Math.PI * 2 * index) / Math.max(count, 1) - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

export function BudgetRadar({ items }: BudgetRadarProps) {
  const maxShare = Math.max(...items.map((item) => item.shareOfTotal), 0);
  const points = items.map((item, index) => {
    const normalized = maxShare === 0 ? 0 : item.shareOfTotal / maxShare;
    return pointFor(index, items.length, 34 + normalized * AXIS_LENGTH);
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section data-testid="budget-radar" className="rounded-[24px] bg-[var(--surface)] p-6 shadow-[0_20px_40px_var(--shadow)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-[var(--ink)]">ბიუჯეტის რადარი</h3>
          <p className="mt-1 text-sm text-[var(--body)]">ტოპ კატეგორიების ვიზუალური პროფილი</p>
        </div>
        <span className="rounded-full bg-[var(--canvas)] px-3 py-1 text-xs font-semibold text-[var(--body)]">რადარი</span>
      </div>
      <div className="flex justify-center overflow-x-auto">
        <svg className="h-[380px] min-w-[560px] max-w-[620px]" viewBox="0 0 420 420" role="img" aria-label="Budget composition radar">
          {[46, 92, 138].map((radius) => {
            const ring = items.map((_, index) => {
              const point = pointFor(index, items.length, radius);
              return `${point.x},${point.y}`;
            }).join(" ");
            return <polygon key={radius} points={ring} fill="none" stroke="var(--strong)" strokeWidth={1.5} />;
          })}
          {items.map((item, index) => {
            const end = pointFor(index, items.length, AXIS_LENGTH + 34);
            const labelPoint = pointFor(index, items.length, AXIS_LENGTH + 58);
            return (
              <g key={item.itemId}>
                <line x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} stroke="var(--strong)" strokeWidth={1.2} />
                <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" fill="var(--body)" fontSize={11} fontWeight={600}>
                  {item.kaLabel.length > 16 ? `${item.kaLabel.slice(0, 14)}...` : item.kaLabel}
                </text>
              </g>
            );
          })}
          <polygon points={polygon} fill="color-mix(in srgb, var(--primary) 20%, transparent)" stroke="var(--primary)" strokeWidth={3} />
          {points.map((point, index) => {
            const item = items[index];
            if (!item) return null;
            return (
              <circle key={item.itemId} cx={point.x} cy={point.y} r={5} fill={item.color}>
                <title>{`${item.kaLabel}: ${formatGel(item.amountGel)} / ${formatPercent(item.shareOfTotal)}`}</title>
              </circle>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update single-year snapshot order**

In `single-year-snapshot.tsx`, replace `SpendingPetals` import with:

```tsx
import { BudgetRadar } from "./budget-radar";
```

Use approved order:

```tsx
<YearPills years={years} value={model.year} onChange={onYearChange} />
<SnapshotHeadlineCards cards={model.headlineCards} />
<SnapshotTreemap items={model.items} />
<Every100Gel items={model.every100} side={model.side} />
<BudgetRadar items={model.radarItems} />
<div data-testid="budget-field-scroll" className="min-w-0 max-w-full overflow-x-auto">
  <BudgetField items={model.items} hasGrowthData={model.hasGrowthData} />
</div>
<SingleYearRanking rows={model.rankingRows} />
```

Update `SingleYearSnapshotProps` to receive `years: number[]` and `onYearChange: (year: number) => void`, then pass `model={singleYearModel}`, `years={allYears}`, and `onYearChange={setSingleYear}` from `MainExplorer`.

- [ ] **Step 3: Remove side list from Every 100 GEL**

In `every-100-gel.tsx`, render only the grid:

```tsx
<section data-testid="every-100-gel" className="rounded-[24px] bg-[var(--surface)] p-6 shadow-[0_20px_40px_var(--shadow)]">
  <h3 className="mb-5 text-xl font-bold text-[var(--ink)]">ყოველი 100 ლარი</h3>
  <div className="flex justify-center">
    <div
      data-testid="every-100-grid"
      className="grid w-[min(100%,560px)] gap-1.5"
      role="img"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}
    >
      {cells.map((item, index) => (
        <span
          key={`${item?.itemId ?? "empty"}-${index}`}
          data-cell="gel"
          className="aspect-square rounded-[5px]"
          title={item?.kaLabel}
          style={{ backgroundColor: item?.color ?? "var(--strong)" }}
        />
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 4: Restyle the remaining single-year components**

Apply `var(--surface)`, `var(--canvas)`, `var(--hairline)`, `var(--ink)`, `var(--body)`, `var(--mute)`, and the headline gradient tokens from `DESIGN.md`. Preserve existing calculations and tooltips.

- [ ] **Step 5: Run single-year tests**

Run:

```powershell
npm run test -- tests/explorer/singleYear.test.ts
npm run test:browser -- main-explorer.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit single-year conversion**

```powershell
git add apps/web/components/single-year apps/web/components/main-explorer/main-explorer.tsx
git commit -m "feat: convert single-year snapshot UI"
```

## Task 8: Final Verification, Design QA, and Documentation Alignment

**Files:**

- Optional modify: `DESIGN.md` when implementation reveals a mismatch with confirmed HTML.
- Optional modify: `docs/superpowers/specs/2026-05-28-geodata-v1-ui-design-system-implementation.md` when a spec ambiguity is discovered during execution.

- [ ] **Step 1: Run all automated checks**

Run from `apps/web`:

```powershell
npm run lint
npm run test
npm run build
npm run test:browser
```

Expected: all pass. If any command fails with Windows permission or spawn errors, rerun the same command with escalation before diagnosing product code.

- [ ] **Step 2: Run browser visual QA**

Open the local app through the in-app browser at `http://localhost:3100` after the Playwright dev server or a manual `npm run dev -- --hostname 0.0.0.0 --port 3100`.

Verify:

- Light theme default.
- Night theme persists after reload.
- Same layout in Light and Night.
- Multi-year default is Line and nominal GEL.
- Only `ხაზი` and `ცხრილი` are visible chart modes.
- `% წილი` changes the chart to share mode.
- Series panel search and selection work.
- CSV downloads the active filtered data.
- Source/update label is visible.
- Single-year uses the approved section order.
- Every 100 GEL has exactly 100 cells and no side list.
- Budget Radar appears before Budget Field.
- Revenue uses the same visual structure.
- Mobile width has no page-level horizontal overflow.

- [ ] **Step 3: Capture final screenshots**

Use Playwright output from `main-explorer.spec.ts`, or manually capture these if the test paths change:

```text
apps/web/test-results/geodata-v1-final-desktop.png
apps/web/test-results/geodata-v1-final-mobile.png
```

Expected: screenshots show the approved Light/Night-compatible UI without old neon/terminal shell.

- [ ] **Step 4: Check git status**

Run:

```powershell
git status --short
```

Expected: only intentional implementation, test, and documentation files are modified.

- [ ] **Step 5: Commit final verification/docs adjustments**

When `DESIGN.md` or spec clarifications changed:

```powershell
git add DESIGN.md docs/superpowers/specs/2026-05-28-geodata-v1-ui-design-system-implementation.md
git commit -m "docs: align implemented UI contract"
```

When no docs changed, do not create an empty commit.

## Final Success Criteria

Implementation is complete only when:

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- `npm run test:browser` passes.
- Browser QA confirms Light/Night, desktop/mobile, multi-year/single-year, revenue/expenditure, CSV, source label, and no page overflow.
- No Bar, Stacked, measure dropdown, old neon shell, `SpendingPetals`, or Every 100 GEL side list is visible in production.
- Git status contains no unintended files.
