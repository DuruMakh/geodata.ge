# Stacked Chart and Sector Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The inflation categories page's default contribution chart follows the DESIGN.md §8.3 chart contract. The 20 economic sectors get explicit, distinguishable colours that never borrow another concept's colour. DESIGN.md's statement about `var()` in SVG attributes matches browser behaviour.

**Architecture:** The pieces the stacked chart needs are extracted from `EditorialLineChart` into small shared modules:
- scale helpers in `lib/explorer/chartScale.ts`
- pointer and keyboard navigation in `lib/explorer/chartNavigation.ts`
- chart hex tokens in `lib/explorer/colors.ts`
- the scroll frame and tooltip in `components/main-explorer/chart-frame.tsx`

`EditorialLineChart` adopts them with no visual change; `StackedColumnChart` is rebuilt on them. Sector colours become explicit `SERIES_COLORS` entries, guarded by a test that checks concept reuse, CIEDE2000 distance and contrast.

**Tech Stack:** React 19, strict TypeScript, Tailwind v4, Vitest 4 (Node environment, markup via `renderToStaticMarkup`), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-stacked-chart-and-sector-colours-design.md`

## Global Constraints

- **Branch:** work on `codex/stacked-chart-and-sector-colours`, created from `main`. Never commit to `main`. Every command runs from `apps/web`.
- **No colour hex in components.** Chart hexes live in `lib/explorer/colors.ts`, the codebase's token module (see its comment at lines 112–116).
- **Chart house style:** literal hexes and `style={{ fontFamily: "var(--font-numeric)" }}` for SVG text. Never reference a CSS custom property that `app/globals.css` does not define: `--rule`, `--ink-soft` and `--font-mono` are not defined there.
- **Line chart unchanged:** `EditorialLineChart` must render identically after extraction. Its test IDs stay `chart-frame`, `chart-scroll-hint` and `chart-tooltip`. The stacked chart uses `stack-chart-frame`, `stack-chart-scroll-hint` and `stack-chart-tooltip`, so existing assertions on `chart-frame` never match it.
- **Tests run in Node.** Vitest runs with `environment: "node"`, so interaction behaviour is covered by pure-function unit tests plus Playwright. Markup tests use `renderGeorgianMarkup` from `tests/helpers/render-localized.tsx`.
- **Sector colours** (spec §3.2):
  - No sector uses `ACCENT`, `OTHER_COLOR` or `INK`; Total GDP is `INK`.
  - Only the allowlisted sectors reuse a concept colour.
  - Every pair of the 21 series is at least CIEDE2000 10 apart.
  - Every sector colour has at least 3:1 contrast against paper `#F7F2E9` and tint `#F1EADC` (the `app/globals.css` tokens that `tests/explorer/colors.test.ts:42` checks).
  - The owner approves a screenshot before merge.
- **Test loop:** targeted tests while editing; the full gates run once, in Task 6. Browser specs need `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` and `CI=1`: with `CI=1`, `playwright.config.ts` builds and serves production on port 3100; without it the config starts `next dev`, where hydration-dependent interactions are unreliable.

---

### Task 1: Chart scale helpers and chart colour tokens

**Files:**
- Create: `apps/web/lib/explorer/chartScale.ts`
- Create: `apps/web/tests/explorer/chartScale.test.ts`
- Modify: `apps/web/lib/explorer/colors.ts` (add tokens after `export const ACCENT = "#B3402A";`, line 107)
- Modify: `apps/web/components/main-explorer/editorial-line-chart.tsx` (delete lines 77–93; replace the hexes at lines 216, 250, 263, 269)
- Modify: `apps/web/components/main-explorer/stacked-column-chart.tsx` (delete lines 40–54)

**Interfaces:**
- Produces:
  - `niceMax(rawMax: number): number`
  - `decimalsFor(step: number, max: number): number`
  - `CHART_LATTICE = "#C9BEA9"`
  - `CHART_AXIS_LABEL = "#6A6050"`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/chartScale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decimalsFor, niceMax } from "../../lib/explorer/chartScale";

describe("chart scale helpers", () => {
  it("pads the maximum by 12% and snaps it to a 1, 2, 2.5, 5 or 10 multiple", () => {
    expect(niceMax(0.8)).toBe(1);
    expect(niceMax(1.5)).toBe(2);
    expect(niceMax(2.1)).toBe(2.5);
    expect(niceMax(4)).toBe(5);
    expect(niceMax(6)).toBe(10);
    expect(niceMax(800)).toBe(1000);
  });

  it("uses the fewest decimals that print the gridline step exactly", () => {
    expect(decimalsFor(2, 2)).toBe(0);
    expect(decimalsFor(0.5, 2)).toBe(1);
    expect(decimalsFor(0.25, 2)).toBe(2);
    expect(decimalsFor(0.125, 2)).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/chartScale.test.ts`
Expected: FAIL, because the module `../../lib/explorer/chartScale` cannot be resolved.

- [ ] **Step 3: Create the module**

Create `apps/web/lib/explorer/chartScale.ts`:

```ts
// Shared y-axis scale helpers for the bespoke SVG charts (DESIGN.md §8.3).

/** The rounded top of a domain: the raw maximum plus 12% headroom, snapped to 1, 2, 2.5, 5 or 10 × 10ⁿ. */
export function niceMax(rawMax: number): number {
  const raw = rawMax * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Smallest decimal count (up to max) that renders the gridline step exactly,
 * so axis labels are never rounded into duplicates ("0.3" for a 0.25 step).
 */
export function decimalsFor(step: number, max: number): number {
  for (let digits = 0; digits <= max; digits += 1) {
    const scaled = step * 10 ** digits;
    if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return digits;
  }
  return max;
}
```

- [ ] **Step 4: Add the chart tokens**

In `apps/web/lib/explorer/colors.ts`, insert after `export const ACCENT = "#B3402A";` (line 107):

```ts

// Chart-local literals shared by the SVG charts (DESIGN.md §8.3). The lattice
// hex doubles as the hover guide; axis labels are muted mono.
export const CHART_LATTICE = "#C9BEA9";
export const CHART_AXIS_LABEL = "#6A6050";
```

- [ ] **Step 5: Use them in both charts**

In `apps/web/components/main-explorer/editorial-line-chart.tsx`:
1. Delete the local `niceMax` and `decimalsFor` functions, including the comment above `decimalsFor` (lines 77–93).
2. Add these imports after line 8:
   ```tsx
   import { decimalsFor, niceMax } from "../../lib/explorer/chartScale";
   import { CHART_AXIS_LABEL, CHART_LATTICE } from "../../lib/explorer/colors";
   ```
3. Line 216: `fill="#C9BEA9"` becomes `fill={CHART_LATTICE}`.
4. Lines 250 and 263: `fill="#6A6050"` becomes `fill={CHART_AXIS_LABEL}`.
5. Line 269: `stroke="#C9BEA9"` becomes `stroke={CHART_LATTICE}`.

In `apps/web/components/main-explorer/stacked-column-chart.tsx`:
1. Delete the local `niceMax` and `decimalsFor` functions (lines 40–54).
2. Add after line 5:
   ```tsx
   import { decimalsFor, niceMax } from "../../lib/explorer/chartScale";
   ```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/explorer/chartScale.test.ts tests/explorer/editorialLineChart.test.ts tests/explorer/stackedColumnChart.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/explorer/chartScale.ts lib/explorer/colors.ts components/main-explorer/editorial-line-chart.tsx components/main-explorer/stacked-column-chart.tsx tests/explorer/chartScale.test.ts
git commit -m "refactor(charts): share scale helpers and chart colour tokens"
```

---

### Task 2: Shared scroll frame, tooltip and pointer navigation

**Files:**
- Create: `apps/web/components/main-explorer/chart-frame.tsx`
- Create: `apps/web/lib/explorer/chartNavigation.ts`
- Create: `apps/web/tests/explorer/chartFrame.test.tsx`
- Create: `apps/web/tests/explorer/chartNavigation.test.ts`
- Modify: `apps/web/components/main-explorer/editorial-line-chart.tsx` (imports at lines 9–10; `handlePointerMove` at lines 167–173; returned JSX at lines 178–398)

**Interfaces:**
- Consumes: `TooltipRow` (type, `editorial-line-chart.tsx:52`); `HorizontalScrollHint({ testId })` (`components/ui/horizontal-scroll-hint.tsx`); `SwatchBar` (`components/ui/editorial`); messages `controls.chartScrollable` and `controls.other`.
- Produces:
  - `ChartScrollFrame({ children, testId?: string = "chart-frame", hintTestId?: string = "chart-scroll-hint" })`
  - `ChartTooltip({ leftPercent: number, header: string, headerRight?: string | null, rows: TooltipRow[], hidden: number, formatValue: (value: number) => string, preliminaryLabel?: string, testId?: string = "chart-tooltip" })`
  - `nearestPeriodIndex(pointerFraction: number, count: number, width: number, padLeft: number, padRight: number): number`
  - `stepPeriodIndex(key: string, current: number | null, count: number): number | null | undefined`: a number moves the active period, `null` clears it, `undefined` means the key does not navigate.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/explorer/chartNavigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nearestPeriodIndex, stepPeriodIndex } from "../../lib/explorer/chartNavigation";

describe("chart navigation", () => {
  // viewBox 920 wide, 74 left and 30 right padding: a 816-unit plot; 5 periods sit 204 apart.
  it("maps a pointer to the nearest period across the whole plot, with no gaps", () => {
    expect(nearestPeriodIndex(0, 5, 920, 74, 30)).toBe(0);
    expect(nearestPeriodIndex((74 + 101) / 920, 5, 920, 74, 30)).toBe(0);
    expect(nearestPeriodIndex((74 + 103) / 920, 5, 920, 74, 30)).toBe(1);
    expect(nearestPeriodIndex(1, 5, 920, 74, 30)).toBe(4);
    expect(nearestPeriodIndex(0.5, 1, 920, 74, 30)).toBe(0);
  });

  it("steps, jumps and clears the active period by key", () => {
    expect(stepPeriodIndex("ArrowRight", null, 12)).toBe(0);
    expect(stepPeriodIndex("ArrowRight", 11, 12)).toBe(11);
    expect(stepPeriodIndex("ArrowLeft", null, 12)).toBe(11);
    expect(stepPeriodIndex("ArrowLeft", 0, 12)).toBe(0);
    expect(stepPeriodIndex("Home", 5, 12)).toBe(0);
    expect(stepPeriodIndex("End", 5, 12)).toBe(11);
    expect(stepPeriodIndex("Escape", 5, 12)).toBeNull();
    expect(stepPeriodIndex("a", 5, 12)).toBeUndefined();
    expect(stepPeriodIndex("ArrowRight", null, 0)).toBeUndefined();
  });
});
```

Create `apps/web/tests/explorer/chartFrame.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { ChartScrollFrame, ChartTooltip } from "../../components/main-explorer/chart-frame";
import { renderGeorgianMarkup } from "../helpers/render-localized";

describe("shared chart frame", () => {
  it("wraps a chart in the scroll hint and a focusable scrolling region", () => {
    const markup = renderGeorgianMarkup(
      <ChartScrollFrame testId="stack-chart-frame" hintTestId="stack-chart-scroll-hint">
        <svg />
      </ChartScrollFrame>,
    );
    expect(markup).toContain('data-testid="stack-chart-scroll-hint"');
    expect(markup).toContain('data-testid="stack-chart-frame"');
    expect(markup).toContain('role="region"');
    expect(markup).toContain("min-w-[720px]");
  });

  it("defaults to the line chart's test ids", () => {
    const markup = renderGeorgianMarkup(<ChartScrollFrame><svg /></ChartScrollFrame>);
    expect(markup).toContain('data-testid="chart-frame"');
    expect(markup).toContain('data-testid="chart-scroll-hint"');
  });

  it("lists rows, the header pair and the hidden remainder, flipping past 60%", () => {
    const markup = renderGeorgianMarkup(
      <ChartTooltip
        leftPercent={70}
        header="2026-08"
        headerRight="Headline 5.6"
        rows={[{ id: "a", label: "Food", color: "#B3402A", value: 1.2 }]}
        hidden={3}
        formatValue={(value) => value.toFixed(1)}
      />,
    );
    expect(markup).toContain('data-testid="chart-tooltip"');
    expect(markup).toContain("Food");
    expect(markup).toContain("1.2");
    expect(markup).toContain("Headline 5.6");
    expect(markup).toContain("+3");
    expect(markup).toContain("translateX(calc(-100% - 12px))");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/explorer/chartNavigation.test.ts tests/explorer/chartFrame.test.tsx`
Expected: FAIL; neither module can be resolved.

- [ ] **Step 3: Create the navigation helpers**

Create `apps/web/lib/explorer/chartNavigation.ts`:

```ts
// Pointer and keyboard navigation for the period axis of the SVG charts.

/**
 * The period nearest a pointer, from its x position as a fraction of the SVG's
 * rendered width. Every x maps to a period, so hover never drops between columns.
 */
export function nearestPeriodIndex(
  pointerFraction: number,
  count: number,
  width: number,
  padLeft: number,
  padRight: number,
): number {
  if (count <= 1) return 0;
  const x = pointerFraction * width;
  const pitch = (width - padLeft - padRight) / (count - 1);
  return Math.min(count - 1, Math.max(0, Math.round((x - padLeft) / pitch)));
}

/** The active period after a key press: a number moves it, null clears it, undefined ignores the key. */
export function stepPeriodIndex(key: string, current: number | null, count: number): number | null | undefined {
  if (count === 0) return undefined;
  switch (key) {
    case "ArrowRight":
      return current === null ? 0 : Math.min(count - 1, current + 1);
    case "ArrowLeft":
      return current === null ? count - 1 : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "Escape":
      return null;
    default:
      return undefined;
  }
}
```

- [ ] **Step 4: Create the frame and tooltip**

Create `apps/web/components/main-explorer/chart-frame.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SwatchBar } from "../ui/editorial";
import { HorizontalScrollHint } from "../ui/horizontal-scroll-hint";
import type { TooltipRow } from "./editorial-line-chart";

/**
 * Scroll instead of shrink on narrow screens: an unbounded w-full SVG scales its
 * text below the DESIGN.md §13 legibility floor on phones.
 *
 * Exception, 900–1019px: the shell's sidebar leaves the column under 720px, so the
 * floor would put a scrollbar under a desktop-width chart. There the chart shrinks
 * to fit instead — an approved trade of label size for a whole chart (DESIGN.md
 * §12). Below 900px the sidebar is a top bar and the column is wide again, so
 * phones keep the scroll. The inner box is `relative` so a tooltip can position.
 */
export function ChartScrollFrame({
  children,
  testId = "chart-frame",
  hintTestId = "chart-scroll-hint",
}: {
  children: ReactNode;
  testId?: string;
  hintTestId?: string;
}) {
  const { messages } = useI18n();
  return (
    <>
      <HorizontalScrollHint testId={hintTestId} />
      <div
        data-testid={testId}
        role="region"
        tabIndex={0}
        aria-label={message(messages, "controls.chartScrollable")}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <div className="relative min-w-[720px] min-[900px]:max-[1020px]:min-w-0">{children}</div>
      </div>
    </>
  );
}

/** The bounded hover readout (DESIGN.md §8.3): absolutely positioned, so it never moves the page. */
export function ChartTooltip({
  leftPercent,
  header,
  headerRight = null,
  rows,
  hidden,
  formatValue,
  preliminaryLabel,
  testId = "chart-tooltip",
}: {
  leftPercent: number;
  header: string;
  headerRight?: string | null;
  rows: TooltipRow[];
  hidden: number;
  formatValue: (value: number) => string;
  preliminaryLabel?: string;
  testId?: string;
}) {
  const { messages } = useI18n();
  return (
    <div
      data-testid={testId}
      className="pointer-events-none absolute top-0 z-[2] flex max-h-full min-w-[200px] flex-col gap-1 overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
      style={{
        left: `${leftPercent}%`,
        transform: leftPercent > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
      }}
    >
      <div className="mb-0.5 flex justify-between gap-3 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">
        <span>{header}</span>
        {headerRight ? <span>{headerRight}</span> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--body)]">
            <SwatchBar color={row.color} className="!w-3" />
            <span className="max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap">{row.label}</span>
          </span>
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
            {formatValue(row.value)}
            {row.preliminary && preliminaryLabel ? <sup className="ml-1 text-[9px]">{preliminaryLabel}</sup> : null}
          </span>
        </div>
      ))}
      {hidden > 0 ? (
        <div className="pt-0.5 text-[10.5px] text-[var(--muted)]">+{hidden} {message(messages, "controls.other")}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx vitest run tests/explorer/chartNavigation.test.ts tests/explorer/chartFrame.test.tsx`
Expected: PASS.

- [ ] **Step 6: Move `EditorialLineChart` onto the shared pieces**

In `apps/web/components/main-explorer/editorial-line-chart.tsx`:

1. Replace the two imports on lines 9–10 (`SwatchBar`, `HorizontalScrollHint`) with:
   ```tsx
   import { nearestPeriodIndex } from "../../lib/explorer/chartNavigation";
   import { ChartScrollFrame, ChartTooltip } from "./chart-frame";
   ```
2. Replace the body of `handlePointerMove` (lines 167–173) with:
   ```tsx
   function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
     const rect = event.currentTarget.getBoundingClientRect();
     const index = nearestPeriodIndex((event.clientX - rect.left) / rect.width, n, W, axisLeftPadding, PAD_R);
     if (index !== hoverRaw) setHover(index);
   }
   ```
3. In the returned JSX, delete the comment block (lines 179–186) and the wrapper elements:
   - `<HorizontalScrollHint …/>`
   - the `chart-frame` `<div>`
   - its inner `relative min-w-[720px]` `<div>`
   - the matching closing `</div></div>` at lines 395–396
   - the outer fragment

   Wrap the `<svg>` and the tooltip in `<ChartScrollFrame>` instead.
4. Replace the inline tooltip block (lines 365–394) with:
   ```tsx
   {hover !== null && hoverX !== null && tooltip !== null ? (
     <ChartTooltip
       leftPercent={hoverX}
       header={formatPeriod ? formatPeriod(years[hover]!, "tooltip") : String(years[hover])}
       headerRight={share ? shareLabel : null}
       rows={tooltip.rows}
       hidden={tooltip.hidden}
       formatValue={formatValue}
       preliminaryLabel={preliminaryLabel}
     />
   ) : null}
   ```

The returned JSX now reads:

```tsx
  return (
    <ChartScrollFrame>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={message(messages, "controls.chartTrend")}
        className="block h-auto w-full"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* …the existing svg children, unchanged… */}
      </svg>
      {hover !== null && hoverX !== null && tooltip !== null ? (
        <ChartTooltip
          leftPercent={hoverX}
          header={formatPeriod ? formatPeriod(years[hover]!, "tooltip") : String(years[hover])}
          headerRight={share ? shareLabel : null}
          rows={tooltip.rows}
          hidden={tooltip.hidden}
          formatValue={formatValue}
          preliminaryLabel={preliminaryLabel}
        />
      ) : null}
    </ChartScrollFrame>
  );
```

`message` and `useI18n` stay imported: the svg's `controls.chartTrend` label still uses them.

- [ ] **Step 7: Verify the line chart is unchanged**

Run: `npx vitest run tests/explorer/editorialLineChart.test.ts tests/explorer/chartFrame.test.tsx tests/explorer/chartNavigation.test.ts`
Expected: PASS.

Run: `npm run typecheck && npm run lint`
Expected: exit 0. An unused `HorizontalScrollHint` or `SwatchBar` import would fail lint; remove it.

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/main-explorer.spec.ts tests/browser/bilingual-controls.spec.ts --reporter=list`
Expected: PASS. These specs assert `chart-frame`, `chart-scroll-hint` and hover behaviour on the budget explorer.

- [ ] **Step 8: Commit**

```bash
git add components/main-explorer/chart-frame.tsx components/main-explorer/editorial-line-chart.tsx lib/explorer/chartNavigation.ts tests/explorer/chartFrame.test.tsx tests/explorer/chartNavigation.test.ts
git commit -m "refactor(charts): extract the scroll frame, tooltip and pointer navigation"
```

---

### Task 3: Rebuild the stacked column chart on the chart contract

**Files:**
- Modify: `apps/web/components/main-explorer/stacked-column-chart.tsx` (replace the whole file)
- Modify: `apps/web/components/main-explorer/series-selector.tsx:240`
- Test: `apps/web/tests/explorer/stackedColumnChart.test.tsx`
- Test: `apps/web/tests/browser/inflation-categories.spec.ts`

**Interfaces:**
- Consumes (Tasks 1–2): `niceMax`, `decimalsFor`, `CHART_LATTICE`, `CHART_AXIS_LABEL`, `INK`, `ChartScrollFrame`, `ChartTooltip`, `nearestPeriodIndex`, `stepPeriodIndex`; plus `buildTooltipRows` from `editorial-line-chart.tsx:61`.
- Produces: the unchanged exports `StackedColumnChart`, `StackSegment` and `StackedColumnChartProps`. The page at `components/inflation/inflation-categories.tsx:211-233` needs no change.

- [ ] **Step 1: Write the failing markup tests**

Append inside `describe("StackedColumnChart", …)` in `apps/web/tests/explorer/stackedColumnChart.test.tsx`, before its closing `});`:

```tsx
  it("uses the chart tokens, not undefined custom properties", () => {
    expect(markup).not.toContain("var(--rule)");
    expect(markup).not.toContain("ink-soft");
    expect(markup).not.toContain("font-mono");
    expect(markup).toContain('fill="#6A6050"');
    expect(markup).toContain("var(--font-numeric)");
  });

  it("sits in the shared scroll frame and is keyboard focusable", () => {
    expect(markup).toContain('data-testid="stack-chart-frame"');
    expect(markup).toContain('data-testid="stack-chart-scroll-hint"');
    expect(markup).toMatch(/<svg[^>]*tabindex="0"/);
    expect(markup).toMatch(/<svg[^>]*aria-describedby="[^"]+"/);
  });

  it("ends the headline overlay in a dot", () => {
    expect(markup).toContain("data-overlay-end");
  });

  it("has no per-bar hover rectangles and no in-flow readout", () => {
    expect(markup).not.toContain('fill="transparent"');
    expect(markup).not.toContain("mt-2 font-mono");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/explorer/stackedColumnChart.test.tsx`
Expected: the four new tests FAIL, because the markup still contains `var(--rule)`, `font-mono` and `fill="transparent"`, and has no frame or end dot.

- [ ] **Step 3: Replace the component**

Replace the entire contents of `apps/web/components/main-explorer/stacked-column-chart.tsx` with:

```tsx
"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { nearestPeriodIndex, stepPeriodIndex } from "../../lib/explorer/chartNavigation";
import { decimalsFor, niceMax } from "../../lib/explorer/chartScale";
import { CHART_AXIS_LABEL, CHART_LATTICE, INK } from "../../lib/explorer/colors";
import { buildDotLattice } from "../../lib/explorer/dotLattice";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";
import { ChartScrollFrame, ChartTooltip } from "./chart-frame";
import { buildTooltipRows } from "./editorial-line-chart";

// Bespoke SVG stacked column chart per DESIGN.md §8.3, the only form in which
// "the parts add up to the published whole" is visible. Positive segments stack
// up from a drawn zero line, negative segments down, and the published headline
// runs over the stack as an ink line ending in a dot. No chart library.

export type StackSegment = { id: string; label: string; color: string; values: Array<number | null> };
export type StackedColumnChartProps = {
  periods: number[];
  segments: StackSegment[];
  overlay: { label: string; values: Array<number | null> } | null;
  formatPeriod: (period: number) => string;
  formatValue: (value: number) => string;
  ariaLabel: string;
};

const W = 920;
const H = 320;
const PAD_L = 74;
const PAD_R = 30;
const PAD_T = 16;
const PAD_B = 26;
const DOT_R = 0.7;
// EditorialLineChart owns "chart-dot-lattice"; both charts render on the
// categories page, so this one needs its own id to avoid a defs collision.
const LATTICE_ID = "stack-dot-lattice";

/**
 * SVG coordinates at full double precision cost ~40 characters a rect and buy
 * nothing: the viewBox is 1000 units wide, so a hundredth is far below a pixel.
 */
const px = (value: number) => Number(value.toFixed(2));
const MAX_BAR_WIDTH = 28;

export function StackedColumnChart({
  periods,
  segments,
  overlay,
  formatPeriod,
  formatValue,
  ariaLabel,
}: StackedColumnChartProps) {
  const captionId = useId();
  const [hoverRaw, setHover] = useState<number | null>(null);
  const count = periods.length;
  const hover = hoverRaw !== null && hoverRaw < count ? hoverRaw : null;

  // The domain covers the tallest positive stack and the deepest negative one, so
  // zero always sits on a gridline and the two halves share one step.
  let maxStack = 0;
  let minStack = 0;
  for (let position = 0; position < count; position += 1) {
    let positive = 0;
    let negative = 0;
    for (const segment of segments) {
      const value = segment.values[position];
      if (value === null || value === undefined) continue;
      if (value > 0) positive += value;
      else negative += value;
    }
    for (const value of [overlay?.values[position] ?? null]) {
      if (value === null) continue;
      if (value > positive) positive = value;
      if (value < negative) negative = value;
    }
    if (positive > maxStack) maxStack = positive;
    if (negative < minStack) minStack = negative;
  }
  if (maxStack <= 0 && minStack >= 0) maxStack = 1;
  const posSpan = maxStack > 0 ? niceMax(maxStack) : 0;
  const negSpan = minStack < 0 ? niceMax(-minStack) : 0;
  const step = Math.max(posSpan, negSpan) / 4 || 1;
  const top = posSpan > 0 ? Math.ceil(posSpan / step - 1e-9) * step : 0;
  const bottom = negSpan > 0 ? -Math.ceil(negSpan / step - 1e-9) * step : 0;
  const span = top - bottom || 1;

  const plotWidth = W - PAD_L - PAD_R;
  const plotHeight = H - PAD_T - PAD_B;
  const x = (index: number) => PAD_L + (count <= 1 ? plotWidth / 2 : (index * plotWidth) / (count - 1));
  const y = (value: number) => PAD_T + ((top - value) / span) * plotHeight;
  const zeroY = y(0);
  const barWidth = count === 0 ? 0 : Math.min(MAX_BAR_WIDTH, Math.max(1, (plotWidth / Math.max(count, 1)) * 0.7));

  const gridSteps = Math.round(span / step);
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, index) => bottom + step * index);
  const axisDigits = decimalsFor(step, 2);
  const formatAxis = (value: number) => value.toFixed(axisDigits).replace("-", "−");
  const lattice = buildDotLattice({
    plotWidth,
    plotHeight,
    yearCount: count,
    gridStepCount: gridSteps,
    periodsPerYear: 12,
    firstPeriod: periods[0],
  });
  const labelIndices = new Set(periodLabelIndices(periods, 12));

  // The move-to goes on the first point that exists, not on index 0: an overlay
  // starting later than the columns would otherwise open the path with "L".
  const overlayFirst = overlay === null ? -1 : overlay.values.findIndex((value) => value !== null);
  const overlayPath =
    overlay === null
      ? null
      : overlay.values
          .map((value, index) => (value === null ? null : `${index === overlayFirst ? "M" : "L"}${px(x(index))},${px(y(value))}`))
          .filter((entry): entry is string => entry !== null)
          .join(" ");
  const overlayLast = overlay === null ? -1 : overlay.values.reduce<number>((last, value, index) => (value === null ? last : index), -1);
  const overlayLastValue = overlay === null || overlayLast < 0 ? null : overlay.values[overlayLast] ?? null;

  // The same bounded readout as the line chart: rows ranked by value, capped, remainder named.
  const tooltip =
    hover === null
      ? null
      : buildTooltipRows(
          segments.map((segment) => ({ id: segment.id, label: segment.label, color: segment.color, vals: segment.values, planned: [] })),
          hover,
        );
  const overlayAtHover = hover === null || overlay === null ? null : overlay.values[hover] ?? null;

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (count === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const index = nearestPeriodIndex((event.clientX - rect.left) / rect.width, count, W, PAD_L, PAD_R);
    if (index !== hoverRaw) setHover(index);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const next = stepPeriodIndex(event.key, hover, count);
    if (next === undefined) return;
    event.preventDefault();
    setHover(next);
  }

  return (
    // role="img" belongs on the svg, not the figure: it is children-presentational,
    // so on the figure it would hide the sr-only figcaption that carries the numbers.
    <figure className="m-0">
      <ChartScrollFrame testId="stack-chart-frame" hintTestId="stack-chart-scroll-hint">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          role="img"
          aria-label={ariaLabel}
          aria-describedby={captionId}
          tabIndex={0}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={handleKeyDown}
          onBlur={() => setHover(null)}
        >
          {lattice !== null && (
            <>
              <defs>
                <pattern
                  id={LATTICE_ID}
                  patternUnits="userSpaceOnUse"
                  x={PAD_L + lattice.colOffset - lattice.colPitch / 2}
                  y={PAD_T - lattice.rowPitch / 2}
                  width={lattice.colPitch}
                  height={lattice.rowPitch}
                >
                  <circle cx={lattice.colPitch / 2} cy={lattice.rowPitch / 2} r={DOT_R} fill={CHART_LATTICE} />
                </pattern>
              </defs>
              {/* Grown by one dot radius on every side: a pattern fill clips to the
                  shape it fills, so without this the border dots draw as halves. */}
              <rect
                data-testid="stack-dot-lattice"
                x={PAD_L - DOT_R}
                y={PAD_T - DOT_R}
                width={plotWidth + DOT_R * 2}
                height={plotHeight + DOT_R * 2}
                fill={`url(#${LATTICE_ID})`}
                opacity={0.6}
              />
            </>
          )}

          {gridLines.map((value) => (
            <text
              key={`axis-${value}`}
              x={PAD_L - 10}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={11}
              fill={CHART_AXIS_LABEL}
              style={{ fontFamily: "var(--font-numeric)" }}
            >
              {formatAxis(value)}
            </text>
          ))}

          {segments.map((segment) =>
            segment.values.map((value, index) => {
              if (value === null || value === undefined || value === 0) return null;
              // Each column stacks in `segments` order: positives climb from zero,
              // negatives hang below it, so the two never overlap.
              let base = 0;
              for (const earlier of segments) {
                if (earlier === segment) break;
                const other = earlier.values[index];
                if (other === null || other === undefined) continue;
                if (value > 0 && other > 0) base += other;
                if (value < 0 && other < 0) base += other;
              }
              const start = value > 0 ? base + value : base;
              const height = Math.abs(y(0) - y(Math.abs(value)));
              return (
                <rect
                  key={`${segment.id}-${index}`}
                  data-segment={segment.id}
                  x={px(x(index) - barWidth / 2)}
                  y={px(value > 0 ? y(start) : y(base))}
                  width={px(barWidth)}
                  height={px(height)}
                  fill={segment.color}
                />
              );
            }),
          )}

          <line data-zero x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke={INK} strokeWidth={1} />

          {hover !== null ? (
            <line data-hover-guide x1={x(hover)} x2={x(hover)} y1={PAD_T - 6} y2={H - PAD_B} stroke={CHART_LATTICE} strokeWidth={1} />
          ) : null}

          {overlayPath !== null && overlayPath !== "" && (
            <path data-overlay d={overlayPath} fill="none" stroke={INK} strokeWidth={1.5} />
          )}
          {overlayLastValue !== null ? (
            <circle data-overlay-end cx={px(x(overlayLast))} cy={px(y(overlayLastValue))} r={3.5} fill={INK} />
          ) : null}

          {periods.map((period, index) =>
            labelIndices.has(index) ? (
              <text
                key={`label-${period}`}
                x={x(index)}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill={CHART_AXIS_LABEL}
                style={{ fontFamily: "var(--font-numeric)" }}
              >
                {formatPeriod(period)}
              </text>
            ) : null,
          )}
        </svg>

        {hover !== null && tooltip !== null && tooltip.rows.length > 0 ? (
          <ChartTooltip
            testId="stack-chart-tooltip"
            leftPercent={(x(hover) / W) * 100}
            header={formatPeriod(periods[hover]!)}
            headerRight={overlay !== null && overlayAtHover !== null ? `${overlay.label} ${formatValue(overlayAtHover)}` : null}
            rows={tooltip.rows}
            hidden={tooltip.hidden}
            formatValue={formatValue}
          />
        ) : null}
      </ChartScrollFrame>

      {/* The chart is never colour-only: the same numbers read as text. */}
      <figcaption id={captionId} className="sr-only">
        <ul>
          {segments.map((segment) => {
            const last = [...segment.values].reverse().find((value) => value !== null && value !== undefined);
            return (
              <li key={segment.id}>
                {segment.label}: {last === null || last === undefined ? "—" : formatValue(last)}
              </li>
            );
          })}
          {overlay !== null && (
            <li>
              {overlay.label}:{" "}
              {(() => {
                const last = [...overlay.values].reverse().find((value) => value !== null && value !== undefined);
                return last === null || last === undefined ? "—" : formatValue(last);
              })()}
            </li>
          )}
        </ul>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Fix the selector's off-system font token**

In `apps/web/components/main-explorer/series-selector.tsx`, line 240 changes `font-[family-name:var(--font-mono)]` to `font-[family-name:var(--font-numeric)]`.

Run: `grep -rn "var(--font-mono)\|var(--rule)\|var(--ink-soft)" components lib`
Expected: no output.

- [ ] **Step 5: Run the markup tests to verify they pass**

Run: `npx vitest run tests/explorer/stackedColumnChart.test.tsx tests/explorer/chartFrame.test.tsx`
Expected: PASS, including the five original stacked-chart tests.

- [ ] **Step 6: Write the browser test**

Append to `apps/web/tests/browser/inflation-categories.spec.ts`:

```ts
test("the contribution chart scrolls on phones, hovers without moving the page and answers the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  const frame = page.getByTestId("stack-chart-frame");
  expect(await frame.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  const svg = frame.locator("svg");
  const box = (await svg.boundingBox())!;
  const strip = page.getByTestId("year-range-strip");
  const before = (await strip.boundingBox())!.y;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByTestId("stack-chart-tooltip")).toBeVisible();
  await page.mouse.move(box.x + box.width * 0.5 + 3, box.y + box.height * 0.5);
  await expect(page.getByTestId("stack-chart-tooltip")).toBeVisible();
  expect((await strip.boundingBox())!.y).toBe(before);

  const lattice = await page.evaluate(() => {
    const circle = document.querySelector("#stack-dot-lattice circle");
    const rect = document.querySelector('[data-testid="stack-dot-lattice"]');
    return { fill: circle ? getComputedStyle(circle).fill : null, opacity: rect ? getComputedStyle(rect).opacity : null };
  });
  expect(lattice).toEqual({ fill: "rgb(201, 190, 169)", opacity: "0.6" });

  await page.mouse.move(0, 0);
  await svg.focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("stack-chart-tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("stack-chart-tooltip")).toHaveCount(0);
});
```

- [ ] **Step 7: Run the browser spec**

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/inflation-categories.spec.ts --reporter=list`
Expected: PASS for every test, including the existing 390px and 1440px layout tests, which require `rect[data-segment="cpi.cat.residual"]` and one `path[data-overlay]`.

- [ ] **Step 8: Commit**

```bash
git add components/main-explorer/stacked-column-chart.tsx components/main-explorer/series-selector.tsx tests/explorer/stackedColumnChart.test.tsx tests/browser/inflation-categories.spec.ts
git commit -m "fix(inflation): put the contribution chart on the shared chart contract"
```

---

### Task 4: Explicit, distinguishable economic-sector colours

**Files:**
- Modify: `apps/web/lib/explorer/colors.ts` (add entries before the closing `};` of `SERIES_COLORS`, line 82)
- Modify: `apps/web/lib/explorer/economicSectors.ts` (import at line 1; `sectorColor` at lines 26–30)
- Modify: `DESIGN.md` (append to the section `## National economic sectors extension`, which starts at line 945)
- Test: `apps/web/tests/explorer/economicSectors.test.ts` (replace the test at lines 51–55)
- Test: `apps/web/tests/explorer/economicSectorsPresentation.test.tsx:260,263`: it locates sector A's point and path by the old palette colour `#B3402A` (the accent). Change both to its registry colour `#2F4B3A`.

**Interfaces:**
- Consumes: `SERIES_COLORS`, `INK`, `ACCENT`, `OTHER_COLOR` (`lib/explorer/colors.ts`); `contrastRatio(foreground: string, background: string): number` (`lib/explorer/inflationGrid.ts:51`).
- Produces: `sectorColor(id: string): string`, which returns `SERIES_COLORS[id]` and throws for an ID without an entry.

The 14 new hexes were chosen by a read-only search on 2026-09-17:
- the 7 fixed series are held (Total GDP and the six allowlisted concept colours)
- 14 colours are picked from CIELCh candidates with L\* 30–58, C\* ≤ 40 and at least 3.05:1 contrast on both paper and tint, excluding every existing concept hex
- selection maximises the minimum CIEDE2000 distance

The minimum over all 21 series is 13.04, between the two fixed greens (agriculture `#2F4B3A` and health `#1F6E56`).

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/explorer/economicSectors.test.ts`, add these imports after line 4:

```ts
import { ACCENT, INK, OTHER_COLOR, SERIES_COLORS } from "../../lib/explorer/colors";
import { contrastRatio } from "../../lib/explorer/inflationGrid";
```

Replace the test `"all sector colors are distinct and stable, with an ink GDP reference"` (lines 51–55) with:

```ts
function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005). */
function ciede2000(left: string, right: string): number {
  const [L1, a1, b1] = hexToLab(left);
  const [L2, a2, b2] = hexToLab(right);
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) * deg + 360) % 360);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

test("every sector has an explicit, concept-safe, distinguishable colour", () => {
  const PAPER = "#F7F2E9";
  const TINT = "#F1EADC";
  // A sector may wear a site concept's colour only when it is that concept (spec §3.2).
  const conceptReuse: Record<string, string> = {
    "sector.a": SERIES_COLORS["spending.agriculture_environment"]!,
    "sector.h": SERIES_COLORS["cpi.cat.07"]!, // transport
    "sector.o": SERIES_COLORS["spending.defence"]!,
    "sector.p": SERIES_COLORS["spending.education"]!,
    "sector.q": SERIES_COLORS["spending.health"]!,
    "sector.r": SERIES_COLORS["spending.culture"]!,
  };
  const conceptHexes = new Set(
    Object.entries(SERIES_COLORS)
      .filter(([id]) => !id.startsWith("sector.") && id !== "economy.gdp_total")
      .map(([, hex]) => hex),
  );
  const colours = ids.map((id) => [id, sectorColor(id)] as const);

  expect(sectorColor("economy.gdp_total")).toBe(INK);
  for (const [id, hex] of colours) {
    expect(SERIES_COLORS[id], id).toBe(hex);
    if (id === "economy.gdp_total") continue;
    expect([ACCENT, OTHER_COLOR, INK], id).not.toContain(hex);
    if (conceptReuse[id]) expect(hex, id).toBe(conceptReuse[id]);
    else expect(conceptHexes.has(hex), `${id} reuses a concept colour`).toBe(false);
    expect(contrastRatio(hex, PAPER), `${id} on paper`).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex, TINT), `${id} on tint`).toBeGreaterThanOrEqual(3);
  }
  for (let i = 0; i < colours.length; i += 1) {
    for (let j = i + 1; j < colours.length; j += 1) {
      expect(ciede2000(colours[i]![1], colours[j]![1]), `${colours[i]![0]} vs ${colours[j]![0]}`).toBeGreaterThanOrEqual(10);
    }
  }
  expect(ids.map(sectorColor).reverse()).toEqual([...ids].reverse().map(sectorColor));
  expect(() => sectorColor("sector.z")).toThrow("No colour for economic sector sector.z");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/economicSectors.test.ts`
Expected: FAIL. `SERIES_COLORS["sector.a"]` is `undefined` (the first assertion in the loop), and `sectorColor("sector.z")` does not throw.

- [ ] **Step 3: Add the registry entries**

In `apps/web/lib/explorer/colors.ts`, insert before the closing `};` of `SERIES_COLORS` (line 82), after the `"municipal.general_public_services"` entry:

```ts

  // National economic sectors (NACE Rev.2 sections). A sector wears a site concept
  // colour only when it is that concept (DESIGN.md §4.2): agriculture, transport,
  // defence, education, health and culture. Every other sector has its own hex;
  // tests/explorer/economicSectors.test.ts holds all 21 series at CIEDE2000 ≥ 10
  // apart and ≥ 3:1 against paper and tint. Total GDP is the ink reference line.
  "economy.gdp_total": INK,
  "sector.a": "#2F4B3A",
  "sector.b": "#663E08",
  "sector.c": "#76819F",
  "sector.d": "#9F7B3E",
  "sector.e": "#41757E",
  "sector.f": "#816150",
  "sector.g": "#792F26",
  "sector.h": "#C26E4C",
  "sector.i": "#C16671",
  "sector.j": "#0D89C2",
  "sector.k": "#084D61",
  "sector.l": "#987793",
  "sector.m": "#6D6F50",
  "sector.n": "#474A02",
  "sector.o": "#7A4E8C",
  "sector.p": "#3D5A98",
  "sector.q": "#1F6E56",
  "sector.r": "#9C3D5E",
  "sector.s": "#588E54",
  "sector.t": "#26958A",
```

- [ ] **Step 4: Read colours from the registry**

In `apps/web/lib/explorer/economicSectors.ts`, replace line 1:

```ts
import { EDITORIAL_PALETTE, INK, colorForProgram } from "./colors";
```

with:

```ts
import { SERIES_COLORS } from "./colors";
```

Replace `sectorColor` (lines 26–30) with:

```ts
export function sectorColor(id: string): string {
  const color = SERIES_COLORS[id];
  if (!color) throw new Error(`No colour for economic sector ${id}`);
  return color;
}
```

If `INK` is still referenced elsewhere in `economicSectors.ts`, keep it in the import (`import { INK, SERIES_COLORS } from "./colors";`). `npm run lint` reports whichever import is unused.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/explorer/economicSectors.test.ts tests/explorer/colors.test.ts`
Expected: PASS.

Run: `npm run typecheck && npm run lint`
Expected: exit 0.

- [ ] **Step 6: Record the palette in DESIGN.md**

Append at the end of the `## National economic sectors extension` section of `DESIGN.md` (before the next `## ` heading):

```markdown

**Sector colours.** Each of the 21 series has an explicit `SERIES_COLORS` entry. A sector wears a site concept colour only when it is that concept; every other sector has its own hex. All 21 are at least CIEDE2000 10 apart and at least 3:1 against paper and tint, enforced by `tests/explorer/economicSectors.test.ts`.

| ID | Sector | Colour | Shared with |
|---|---|---|---|
| `economy.gdp_total` | Total GDP | `#1E1B16` | ink reference |
| `sector.a` | Agriculture, forestry and fishing | `#2F4B3A` | agriculture and environment |
| `sector.b` | Mining and quarrying | `#663E08` | — |
| `sector.c` | Manufacturing | `#76819F` | — |
| `sector.d` | Electricity, gas, steam and air conditioning supply | `#9F7B3E` | — |
| `sector.e` | Water supply; sewerage, waste management and remediation | `#41757E` | — |
| `sector.f` | Construction | `#816150` | — |
| `sector.g` | Wholesale and retail trade; repair of motor vehicles | `#792F26` | — |
| `sector.h` | Transportation and storage | `#C26E4C` | transport |
| `sector.i` | Accommodation and food service activities | `#C16671` | — |
| `sector.j` | Information and communication | `#0D89C2` | — |
| `sector.k` | Financial and insurance activities | `#084D61` | — |
| `sector.l` | Real estate activities | `#987793` | — |
| `sector.m` | Professional, scientific and technical activities | `#6D6F50` | — |
| `sector.n` | Administrative and support service activities | `#474A02` | — |
| `sector.o` | Public administration and defence; compulsory social security | `#7A4E8C` | defence |
| `sector.p` | Education | `#3D5A98` | education |
| `sector.q` | Human health and social work activities | `#1F6E56` | health |
| `sector.r` | Arts, entertainment and recreation | `#9C3D5E` | culture |
| `sector.s` | Other service activities | `#588E54` | — |
| `sector.t` | Activities of households as employers | `#26958A` | — |
```

- [ ] **Step 7: Capture the approval screenshot**

1. Build and start the production server (`npm run build`, then `npm run start -- --port 3100`).
2. Open `http://localhost:3100/en/explorer/economy/sectors#measure=nominal&view=line&range=all&sel=economy.gdp_total,sector.a,sector.b,sector.c,sector.d,sector.e,sector.f,sector.g,sector.h,sector.i,sector.j,sector.k,sector.l,sector.m,sector.n,sector.o,sector.p,sector.q,sector.r,sector.s,sector.t` in a 1440×1000 browser window.
3. Save a full-page screenshot as `sectors-palette-2026-09-17.png` outside the repository (the scratchpad or the PR description upload). It is attached to the PR for owner approval and is not committed.

- [ ] **Step 8: Commit**

```bash
git add lib/explorer/colors.ts lib/explorer/economicSectors.ts tests/explorer/economicSectors.test.ts tests/explorer/economicSectorsPresentation.test.tsx ../../DESIGN.md
git commit -m "fix(economy): give the 20 sectors explicit, distinguishable, concept-safe colours"
```

Merge gate: the owner approves the screenshot on the PR before merge. If the owner rejects a colour, replace it with a hex that keeps the Step 1 test green, then update the DESIGN.md table in the same commit.

---

### Task 5: Correct DESIGN.md's SVG `var()` statement

**Files:**
- Create (temporary, never committed): `apps/web/.tmp-svg-var-probe.mjs`
- Modify: `DESIGN.md` §8.3, line 571 (sentence 1) and line 575 (sentence 2)

**Interfaces:** none. Documentation only.

- [ ] **Step 1: Check which engines can be probed**

Run: `ls "$LOCALAPPDATA/ms-playwright"`
Expected on this machine: `chromium-*` folders only.

Result when executed (2026-09-18): the folder also holds `firefox-1522` and `webkit-2287` (an earlier `ls | head` hid them), so all three engines were probed without a download. All three resolve `var()`, so Case A's full wording applies.

WebKit and Firefox need `npx playwright install webkit firefox`, a download of several hundred megabytes. Ask the user before running it. If they decline, continue with Chromium only.

- [ ] **Step 2: Write and run the probe**

Create `apps/web/.tmp-svg-var-probe.mjs`:

```js
import { chromium, firefox, webkit } from "@playwright/test";

const html = `<style>:root{--ink:#1E1B16;--num:monospace}</style>
<svg width="300" height="100">
  <rect id="a" width="40" height="40" fill="var(--ink)"/>
  <line id="b" x1="0" y1="80" x2="300" y2="80" stroke="var(--ink)" stroke-width="4"/>
  <circle id="c" cx="100" cy="20" r="10" fill="var(--rule)"/>
  <text id="d" x="140" y="30" font-family="var(--num)">12</text>
</svg>`;

for (const [name, engine] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]]) {
  try {
    const browser = await engine.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const result = await page.evaluate(() => ({
      fillVar: getComputedStyle(document.getElementById("a")).fill,
      strokeVar: getComputedStyle(document.getElementById("b")).stroke,
      undefinedVar: getComputedStyle(document.getElementById("c")).fill,
      fontFamilyVar: getComputedStyle(document.getElementById("d")).fontFamily,
    }));
    console.log(name, JSON.stringify(result));
    await browser.close();
  } catch (error) {
    console.log(name, "not available:", String(error.message).split("\n")[0]);
  }
}
```

Run: `node .tmp-svg-var-probe.mjs`
Expected for Chromium (measured 2026-09-17 in Chromium 152):

```
chromium {"fillVar":"rgb(30, 27, 22)","strokeVar":"rgb(30, 27, 22)","undefinedVar":"rgb(0, 0, 0)","fontFamilyVar":"monospace"}
```

An engine resolves `var()` when `fillVar` and `strokeVar` are `rgb(30, 27, 22)` and `fontFamilyVar` is `monospace`.

- [ ] **Step 3: Delete the probe**

Run: `rm .tmp-svg-var-probe.mjs && git status --short`
Expected: the probe does not appear in `git status`.

- [ ] **Step 4: Reword DESIGN.md**

Apply the case that matches Step 2.

**Case A: every probed engine resolves `var()`, or only Chromium could be probed.**

In `DESIGN.md` line 571, replace the sentence

```
 SVG text sets fonts via `style` (the `font-family` presentation attribute does not resolve `var()`).
```

with

```
 SVG text sets fonts via `style`, as house style for chart code.
```

In line 575, replace

```
Literal hex, matching the rest of this chart: `var()` does not resolve in SVG presentation attributes.
```

with, when WebKit and Firefox were probed and both resolve:

```
Literal hex from `lib/explorer/colors.ts`, matching the rest of this chart. An undefined custom property renders black, so chart code never references a token `app/globals.css` does not define.
```

or, when only Chromium was probed:

```
Literal hex from `lib/explorer/colors.ts`, matching the rest of this chart. `var()` resolves in SVG presentation attributes in Chromium (checked 2026-09-17; WebKit and Firefox unchecked), but literal hexes stay house style, and an undefined custom property renders black, so chart code never references a token `app/globals.css` does not define.
```

**Case B: WebKit or Firefox does not resolve `var()`.** Keep both sentences and name the engine. Line 571 becomes

```
 SVG text sets fonts via `style` (the `font-family` presentation attribute does not resolve `var()` in <engine>).
```

and in line 575, `does not resolve in SVG presentation attributes` becomes `does not resolve in SVG presentation attributes in <engine>`. Replace `<engine>` with the engine name printed by the probe.

- [ ] **Step 5: Commit**

```bash
git add ../../DESIGN.md
git commit -m "docs(design): state what SVG presentation attributes actually resolve"
```

---

### Task 6: Done-check and acceptance

**Files:** none (verification only).

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Browser suite on the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass. If `municipal-entity.spec.ts` "sourced percentage workbook" times out under load, re-run that file alone before calling it a regression.

- [ ] **Step 4: Acceptance walk**

On `http://localhost:3100/explorer/inflation/categories` and `/en/explorer/inflation/categories`, default tab:

1. The lattice dots compute to `rgb(201, 190, 169)` at opacity 0.6, and the axis labels use the numeric font.
2. At 390px the chart scrolls inside its frame.
3. Hovering across the plot never moves the year strip.
4. The tooltip lists at most 10 rows plus a "+N" line.
5. Tab reaches the chart, and Arrow keys, Home, End and Escape work.
6. The headline line ends in a dot.

On `/explorer/economy/sectors`, all 20 sectors are distinguishable in the Task 4 screenshot, and the owner has approved it.

- [ ] **Step 5: Hand off**

Push `codex/stacked-chart-and-sector-colours` and open a draft PR. Attach the palette screenshot and state the approval gate. Merge only after CI is green and the owner approves the palette.
