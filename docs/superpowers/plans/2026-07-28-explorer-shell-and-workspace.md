# Explorer Shell and Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/explorer` into a data-platform shell — sidebar with a collapsible rail, a budget hub, and one route per section — and apply three workspace changes: a dot lattice behind the chart, a segmented mode control, and sparklines under all three side KPIs.

**Architecture:** `nav` stops being React state and becomes the route; everything else in the URL hash is untouched. A flex shell (`app/explorer/layout.tsx`) puts a client sidebar beside the page content, so the sidebar's own width change reflows content with no shared state. All new geometry (sparkline paths, dot lattice pitch, hub card models) lives in pure functions under `lib/explorer/` and is unit-tested there; components stay thin and are covered by Playwright.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, custom editorial component layer, Vitest (node environment, `tests/**/*.test.ts` only), Playwright.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-explorer-shell-and-workspace-design.md`. Read it before starting.
- **Vitest runs in `environment: "node"` and only collects `tests/**/*.test.ts`.** There is no React testing library. Never write a `.test.tsx`. Component behaviour is verified in Playwright; all testable logic must be extracted to a pure function first.
- Run all commands from `apps/web`.
- Georgian copy is exact — copy strings verbatim from this plan, never transliterate or paraphrase.
- SVG presentation attributes use literal hex, matching the existing chart code. Do not use `var(--token)` inside SVG attributes.
- Border radius 0–3px everywhere. The only exceptions already in the system are the `% წილი` measure pill and the range slider handles.
- No new dependencies.
- Follow existing file style: named exports, `type` aliases over interfaces, comments only where they explain a non-obvious decision.
- Definition of done for the whole plan: `npm run check`, `npm run build`, and `npm run test:browser` all pass.

---

### Task 1: Sparkline geometry and component

**Files:**
- Create: `apps/web/lib/explorer/sparkline.ts`
- Create: `apps/web/components/ui/sparkline.tsx`
- Test: `apps/web/tests/explorer/sparkline.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildSparklinePath(values: (number | null)[], width?: number, height?: number, inset?: number): string[]` — one SVG path `d` string per contiguous run.
  - `Sparkline({ values, color, width?, height? }: { values: (number | null)[]; color: string; width?: number; height?: number })` — renders `null` when there is nothing to draw.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/sparkline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSparklinePath } from "../../lib/explorer/sparkline";

describe("buildSparklinePath", () => {
  it("draws a single segment across a complete series", () => {
    const segments = buildSparklinePath([0, 1, 2], 64, 16);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toBe("M1.0 15.0 L32.0 8.0 L63.0 1.0");
  });

  it("centres a flat series instead of pinning it to an edge", () => {
    const segments = buildSparklinePath([5, 5, 5], 64, 16);

    expect(segments).toEqual(["M1.0 8.0 L32.0 8.0 L63.0 8.0"]);
  });

  it("splits on gaps rather than bridging them", () => {
    const segments = buildSparklinePath([1, 2, null, 8, 9], 64, 16);

    expect(segments).toHaveLength(2);
    expect(segments[0].startsWith("M1.0")).toBe(true);
    expect(segments[1].startsWith("M47.5")).toBe(true);
  });

  it("drops runs too short to draw", () => {
    expect(buildSparklinePath([1, null, 3], 64, 16)).toEqual([]);
    expect(buildSparklinePath([null, null], 64, 16)).toEqual([]);
    expect(buildSparklinePath([7], 64, 16)).toEqual([]);
  });

  it("ignores non-finite values", () => {
    expect(buildSparklinePath([1, Number.NaN, 3, 4], 64, 16)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/explorer/sparkline.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/explorer/sparkline"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/explorer/sparkline.ts`:

```ts
// Sparkline path geometry (DESIGN.md §7.11). Kept pure so it can be unit-tested
// in the node environment — the component around it is a thin SVG wrapper.

type Point = { value: number; index: number };

export function buildSparklinePath(
  values: (number | null)[],
  width = 64,
  height = 16,
  inset = 1,
): string[] {
  const present: Point[] = [];
  for (const [index, value] of values.entries()) {
    if (value !== null && Number.isFinite(value)) present.push({ value, index });
  }
  if (present.length < 2) return [];

  const count = values.length;
  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const span = max - min;

  const x = (index: number) => inset + (count <= 1 ? 0 : (index * (width - inset * 2)) / (count - 1));
  // A flat series has no span to scale against; centring it is honest, pinning it
  // to the top or bottom edge would imply a trend that is not there.
  const y = (value: number) => (span === 0 ? height / 2 : inset + ((max - value) / span) * (height - inset * 2));

  const segments: string[] = [];
  let run: string[] = [];

  const flush = () => {
    // A one-point run has no line to draw; at 64px a lone dot reads as noise.
    if (run.length > 1) segments.push(run.join(" "));
    run = [];
  };

  for (const [index, value] of values.entries()) {
    if (value === null || !Number.isFinite(value)) {
      flush();
      continue;
    }
    run.push(`${run.length === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`);
  }
  flush();

  return segments;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/explorer/sparkline.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the component**

Create `apps/web/components/ui/sparkline.tsx`:

```tsx
import { buildSparklinePath } from "../../lib/explorer/sparkline";

// 64×16 trend mark under a side KPI (DESIGN.md §7.11). Decorative: the KPI value
// and detail line already carry the meaning, so it is hidden from assistive tech.

type SparklineProps = {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
};

export function Sparkline({ values, color, width = 64, height = 16 }: SparklineProps) {
  const segments = buildSparklinePath(values, width, height);
  if (segments.length === 0) return null;

  return (
    <svg aria-hidden viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="mt-1.5 block">
      {segments.map((path, index) => (
        <path
          key={index}
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 6: Verify types and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass with no output errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/explorer/sparkline.ts apps/web/components/ui/sparkline.tsx apps/web/tests/explorer/sparkline.test.ts
git commit -m "feat(ui): add sparkline geometry and component"
```

---

### Task 2: Side-KPI sparklines

**Files:**
- Modify: `apps/web/lib/explorer/colors.ts` (add `ACCENT`)
- Modify: `apps/web/components/main-explorer/indicators.tsx:94-199`
- Test: `apps/web/tests/explorer/indicators.test.ts` (create)

**Interfaces:**
- Consumes: `Sparkline` from Task 1.
- Produces: `buildKpiShareSeries(row, totalRow, years): (number | null)[]` exported from `apps/web/lib/explorer/sparkline.ts`.

The first two KPIs plot their row's values; the third plots share of total, because the KPI states a percentage. Share is computed here — no data-layer change.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/indicators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildKpiShareSeries } from "../../lib/explorer/sparkline";
import type { ExplorerTableRow } from "../../lib/explorer/types";

function row(valuesByYear: Record<number, number | null>): ExplorerTableRow {
  return {
    itemId: "revenue.vat",
    parentItemId: null,
    level: "public_field",
    detailLabel: null,
    kaLabel: "დღგ",
    enLabel: "VAT",
    color: "#B3402A",
    basisByYear: {},
    sourceByYear: {},
    valuesByYear,
    change: null,
    shareEndYear: null,
  };
}

describe("buildKpiShareSeries", () => {
  it("divides the row by the total for each year", () => {
    const series = buildKpiShareSeries(row({ 2020: 25, 2021: 50 }), row({ 2020: 100, 2021: 200 }), [2020, 2021]);

    expect(series).toEqual([0.25, 0.25]);
  });

  it("yields null where either side is missing", () => {
    const series = buildKpiShareSeries(row({ 2020: 25 }), row({ 2020: 100, 2021: 200 }), [2020, 2021]);

    expect(series).toEqual([0.25, null]);
  });

  it("yields null rather than dividing by a zero total", () => {
    const series = buildKpiShareSeries(row({ 2020: 25 }), row({ 2020: 0 }), [2020]);

    expect(series).toEqual([null]);
  });

  it("returns an all-null series when there is no total row", () => {
    expect(buildKpiShareSeries(row({ 2020: 25 }), null, [2020])).toEqual([null]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/explorer/indicators.test.ts`
Expected: FAIL — `buildKpiShareSeries is not exported`.

- [ ] **Step 3: Add the share helper**

Append to `apps/web/lib/explorer/sparkline.ts`:

```ts
import type { ExplorerTableRow } from "./types";

// The "ყველაზე დიდი წილი" KPI states a percentage, so its sparkline traces that
// percentage rather than the level — which is also why it reads jagged.
export function buildKpiShareSeries(
  row: ExplorerTableRow | null,
  totalRow: ExplorerTableRow | null,
  years: number[],
): (number | null)[] {
  if (row === null || totalRow === null) return years.map(() => null);

  return years.map((year) => {
    const value = row.valuesByYear[year];
    const total = totalRow.valuesByYear[year];
    if (value === null || value === undefined) return null;
    if (total === null || total === undefined || total === 0) return null;
    return value / total;
  });
}
```

Move the `import type` line to the top of the file with the other imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/explorer/indicators.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the accent constant**

In `apps/web/lib/explorer/colors.ts`, after the `NEGATIVE` export:

```ts
export const ACCENT = "#B3402A";
```

- [ ] **Step 6: Wire sparklines into the three side KPIs**

In `apps/web/components/main-explorer/indicators.tsx`:

Add to the imports:

```tsx
import { ACCENT, NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { buildKpiShareSeries } from "../../lib/explorer/sparkline";
import { Sparkline } from "../ui/sparkline";
```

(The existing `colors` import line is replaced by the one above.)

Before the `sideKpis` array, add the level-series helper:

```tsx
  const seriesValues = (source: ExplorerTableRow | null) =>
    source === null ? null : years.map((year) => source.valuesByYear[year] ?? null);
```

Then give each `sideKpis` entry a `spark` field. The three entries become:

```tsx
  const sideKpis = [
    {
      label: "ყველაზე დიდი ზრდა",
      value: biggestParts.num,
      unit: biggestParts.unit,
      color: "var(--ink)",
      detail: biggestIncrease ? truncate(biggestIncrease.row.kaLabel, 46) : MISSING,
      spark: biggestIncrease ? { values: seriesValues(biggestIncrease.row), color: biggestIncrease.row.color } : null,
    },
    {
      label: "ყველაზე ნელი ზრდა",
      value: slowest ? formatShare(slowest.change, true) : MISSING,
      unit: "",
      color: slowest && (slowest.change ?? 0) < 0 ? NEGATIVE : "var(--ink)",
      detail: slowest ? truncate(slowest.kaLabel, 46) : MISSING,
      spark: slowest ? { values: seriesValues(slowest), color: slowest.color } : null,
    },
    {
      label: "ყველაზე დიდი წილი",
      value: largestShare ? formatShare(largestShare.shareEndYear) : MISSING,
      unit: "",
      color: "var(--ink)",
      detail: largestShare ? `${truncate(largestShare.kaLabel, 40)}, ${endYear}` : MISSING,
      spark: largestShare ? { values: buildKpiShareSeries(largestShare, totalRow, years), color: ACCENT } : null,
    },
  ];
```

In the `sideKpis.map` body, after the closing `</div>` of the value/detail row and before the closing `</div>` of the KPI block, add:

```tsx
              {kpi.spark ? <Sparkline values={kpi.spark.values} color={kpi.spark.color} /> : null}
```

Add `data-testid="side-kpi"` to the KPI block's outer `<div>` in the same map so Playwright can count them.

- [ ] **Step 7: Add browser coverage**

Append to `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("every side KPI carries a sparkline", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer");
  await expectAppReady(page);

  const kpis = page.getByTestId("side-kpi");
  await expect(kpis).toHaveCount(3);

  // One sparkline each. Path count is deliberately not asserted — a series with
  // an interior gap legitimately draws more than one segment.
  for (let index = 0; index < 3; index += 1) {
    await expect(kpis.nth(index).locator("svg")).toHaveCount(1);
  }
});
```

- [ ] **Step 8: Verify the suite still passes**

Run: `npm run typecheck && npm run test && npm run test:browser`
Expected: typecheck clean; all vitest suites pass; the new browser test passes.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/explorer/sparkline.ts apps/web/lib/explorer/colors.ts apps/web/components/main-explorer/indicators.tsx apps/web/tests/explorer/indicators.test.ts
git commit -m "feat(indicators): add sparklines under all three side KPIs"
```

---

### Task 3: Dot lattice behind the chart

**Files:**
- Create: `apps/web/lib/explorer/dotLattice.ts`
- Modify: `apps/web/components/main-explorer/editorial-line-chart.tsx:104-125`
- Test: `apps/web/tests/explorer/dotLattice.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildDotLattice({ plotWidth, plotHeight, yearCount, gridStepCount }): { colPitch: number; rowPitch: number } | null`.

The lattice replaces the horizontal gridlines. Two columns per year interval and three rows per gridline step, so every third row lands exactly on a labelled value.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/dotLattice.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDotLattice } from "../../lib/explorer/dotLattice";

describe("buildDotLattice", () => {
  it("puts two columns per year and three rows per gridline step", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 4 });

    expect(lattice).not.toBeNull();
    expect(lattice?.colPitch).toBeCloseTo(20.4, 5);
    expect(lattice?.rowPitch).toBeCloseTo(278 / 12, 5);
  });

  it("lands every third row on a labelled gridline", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 4 });
    const stepHeight = 278 / 4;

    expect((lattice?.rowPitch ?? 0) * 3).toBeCloseTo(stepHeight, 5);
  });

  it("halves the density rather than smearing when a pitch falls below the floor", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 60, gridStepCount: 12 });

    // 816/59/2 = 6.9 → below the 12px floor, so one column per year.
    expect(lattice?.colPitch).toBeCloseTo(816 / 59, 5);
    // 278/12/3 = 7.7 → below the floor, so one row per gridline step.
    expect(lattice?.rowPitch).toBeCloseTo(278 / 12, 5);
  });

  it("draws no lattice when there is no interval to divide", () => {
    expect(buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 1, gridStepCount: 4 })).toBeNull();
    expect(buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 0 })).toBeNull();
    expect(buildDotLattice({ plotWidth: 0, plotHeight: 278, yearCount: 21, gridStepCount: 4 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/explorer/dotLattice.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/explorer/dotLattice"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/explorer/dotLattice.ts`:

```ts
// Dot lattice pitch for the line chart (DESIGN.md §8.3). The field IS the grid:
// pitch is derived from the active scale so every third row sits on a labelled
// value and every second column on a year.

export type DotLattice = { colPitch: number; rowPitch: number };

const MIN_PITCH = 12;
const COLS_PER_YEAR = 2;
const ROWS_PER_STEP = 3;

export function buildDotLattice(input: {
  plotWidth: number;
  plotHeight: number;
  yearCount: number;
  gridStepCount: number;
}): DotLattice | null {
  const { plotWidth, plotHeight, yearCount, gridStepCount } = input;
  if (plotWidth <= 0 || plotHeight <= 0 || yearCount <= 1 || gridStepCount <= 0) return null;

  const yearPitch = plotWidth / (yearCount - 1);
  const stepPitch = plotHeight / gridStepCount;

  // A dense domain (many gridline steps, or a long year axis) would turn the
  // subdivided lattice into a flat tone — fall back to one dot per interval.
  const colPitch = yearPitch / COLS_PER_YEAR >= MIN_PITCH ? yearPitch / COLS_PER_YEAR : yearPitch;
  const rowPitch = stepPitch / ROWS_PER_STEP >= MIN_PITCH ? stepPitch / ROWS_PER_STEP : stepPitch;

  return { colPitch, rowPitch };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/explorer/dotLattice.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Render the lattice and drop the gridlines**

In `apps/web/components/main-explorer/editorial-line-chart.tsx`:

Add to the imports:

```tsx
import { buildDotLattice } from "../../lib/explorer/dotLattice";
```

After the `gridLines` and `labelStep` declarations (around line 91), add:

```tsx
  const lattice = buildDotLattice({
    plotWidth: W - PAD_L - PAD_R,
    plotHeight: H - PAD_T - PAD_B,
    yearCount: n,
    gridStepCount: Math.round(span / step),
  });
```

Replace the `gridLines.map(...)` block (lines 117-124) with the lattice plus label-only axis:

```tsx
        {lattice ? (
          <>
            <defs>
              <pattern
                id="chart-dot-lattice"
                patternUnits="userSpaceOnUse"
                x={PAD_L - lattice.colPitch / 2}
                y={PAD_T - lattice.rowPitch / 2}
                width={lattice.colPitch}
                height={lattice.rowPitch}
              >
                <circle cx={lattice.colPitch / 2} cy={lattice.rowPitch / 2} r={0.7} fill="#C9BEA9" />
              </pattern>
            </defs>
            <rect
              data-testid="chart-dot-lattice"
              x={PAD_L}
              y={PAD_T}
              width={W - PAD_L - PAD_R}
              height={H - PAD_T - PAD_B}
              fill="url(#chart-dot-lattice)"
              opacity={0.6}
            />
          </>
        ) : null}
        {gridLines.map((value, index) => (
          <g key={`grid-${index}`}>
            {/* The lattice carries the grid; only zero keeps a drawn rule, because a
                negative domain is unreadable without it. */}
            {value === 0 ? (
              <line x1={PAD_L} x2={W - PAD_R} y1={y(value)} y2={y(value)} stroke="#1E1B16" strokeWidth={1} />
            ) : null}
            <text x={PAD_L - 10} y={y(value) + 3} fontSize={11} fill="#6A6050" textAnchor="end" style={{ fontFamily: "var(--font-numeric)" }}>
              {formatAxis(value)}
            </text>
          </g>
        ))}
```

The pattern origin is offset back by half a pitch so the tile-centred dot lands exactly on `PAD_L + i·colPitch` / `PAD_T + j·rowPitch` without clipping at the plot edges.

- [ ] **Step 6: Add browser coverage**

Append to `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("chart draws a dot lattice instead of horizontal gridlines", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer");
  await expectAppReady(page);

  const chart = page.getByTestId("chart-frame");
  await expect(chart.getByTestId("chart-dot-lattice")).toBeVisible();

  // Only the zero rule survives; the hairline-soft gridlines are gone.
  const strokes = await chart.locator("svg line").evaluateAll((lines) =>
    lines.map((line) => line.getAttribute("stroke")),
  );
  expect(strokes).not.toContain("#E7DECF");
  expect(strokes).toContain("#1E1B16");
});
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm run test && npm run test:browser`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/explorer/dotLattice.ts apps/web/components/main-explorer/editorial-line-chart.tsx apps/web/tests/explorer/dotLattice.test.ts apps/web/tests/browser/main-explorer.spec.ts
git commit -m "feat(chart): replace gridlines with a scale-aligned dot lattice"
```

---

### Task 4: Segmented mode control

**Files:**
- Modify: `apps/web/components/ui/editorial.tsx` (add `SegmentedTabs`)
- Modify: `apps/web/components/main-explorer/explorer-view.tsx:109-113`

**Interfaces:**
- Consumes: nothing.
- Produces: `SegmentedTabs<T extends string>({ options, value, onChange, ariaLabel }: { options: Array<{ value: T; label: string; testId?: string }>; value: T; onChange: (next: T) => void; ariaLabel: string })`.

Only the mode tabs become segmented. The grouping tabs in the series aside and the analysis view's tabs keep `TextTab` — a segmented box is the affordance for an either/or view switch, not for a filter.

- [ ] **Step 1: Add the component**

Append to `apps/web/components/ui/editorial.tsx`:

```tsx
type SegmentedTabsProps<T extends string> = {
  options: Array<{ value: T; label: string; testId?: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
};

// Segmented control for either/or view switches (DESIGN.md §7.2a). Filters keep
// TextTab — boxing every tab group turns the page into a control panel.
export function SegmentedTabs<T extends string>({ options, value, onChange, ariaLabel }: SegmentedTabsProps<T>) {
  return (
    <span role="group" aria-label={ariaLabel} className="inline-flex items-stretch overflow-hidden rounded-[2px] border border-[var(--control)]">
      {options.map((option, index) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            data-testid={option.testId}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer px-[13px] py-1.5 font-[family-name:var(--font-numeric)] text-[10.5px] tracking-[0.04em] transition-colors duration-150 ${
              index > 0 ? "border-l border-[var(--control)]" : ""
            } ${active ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-transparent text-[var(--muted)] hover:bg-[var(--tint)] hover:text-[var(--ink)]"}`}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}
```

- [ ] **Step 2: Use it for the mode tabs**

In `apps/web/components/main-explorer/explorer-view.tsx`, change the editorial import to:

```tsx
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
```

Replace the mode-tab wrapper (lines 110-113) with:

```tsx
              <SegmentedTabs<ChartMode>
                ariaLabel="ხედის რეჟიმი"
                value={chartMode}
                onChange={onChartModeChange}
                options={[
                  { value: "line", label: "ხაზი", testId: "chart-mode-line" },
                  { value: "table", label: "ცხრილი", testId: "chart-mode-table" },
                ]}
              />
```

`TextTab` is no longer imported here. Leave the export in `editorial.tsx` — the series panel and analysis view still use it.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass. The `chart-mode-line` / `chart-mode-table` test ids and `aria-pressed` are preserved, so no existing test changes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/editorial.tsx apps/web/components/main-explorer/explorer-view.tsx
git commit -m "feat(explorer): make the line/table switch a segmented control"
```

---

### Task 5: `nav` leaves the URL hash

**Files:**
- Modify: `apps/web/lib/explorer/urlState.ts`
- Test: `apps/web/tests/explorer/urlState.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseExplorerHash(hash: string, nav: ExplorerNav): ExplorerUrlState` — `nav` now comes from the route and scopes the range/selection.
  - `readLegacyNav(hash: string): ExplorerNav | null` — for the hub's one-time redirect.
  - `stripNavFromHash(hash: string): string` — the rest of a legacy hash, `nav` removed.
  - `serializeExplorerHash` keeps its `nav` field for branching but no longer emits it.

The route owns `nav`, so the parser can no longer read it from the hash to decide scope — it must be told. That is why the signature gains a parameter rather than simply dropping the field.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/urlState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseExplorerHash, readLegacyNav, serializeExplorerHash, stripNavFromHash } from "../../lib/explorer/urlState";

describe("serializeExplorerHash", () => {
  it("never emits nav — the route owns it", () => {
    const hash = serializeExplorerHash({
      nav: "revenue",
      grouping: "fields",
      chartMode: "table",
      share: true,
      rangeStart: 2010,
      rangeEnd: 2020,
      selectedIds: ["revenue.vat"],
      analysisSide: "expenditure",
      analysisGrouping: "fields",
      analysisYear: null,
    });

    expect(hash).not.toContain("nav=");
    expect(hash).toContain("m=table");
    expect(hash).toContain("sh=1");
    expect(hash).toContain("r=2010-2020");
    expect(hash).toContain("sel=revenue.vat");
  });
});

describe("parseExplorerHash", () => {
  it("scopes the range and selection by the nav it is given", () => {
    const state = parseExplorerHash("#m=table&r=2010-2020&sel=revenue.vat", "revenue");

    expect(state.range).toEqual({ scope: "revenue", start: 2010, end: 2020 });
    expect(state.selection).toEqual({ scope: "revenue", ids: ["revenue.vat"] });
  });

  it("uses the ministries scope when the hash carries that grouping", () => {
    const state = parseExplorerHash("#g=ministries&sel=admin_spending.defence", "expenditure");

    expect(state.selection?.scope).toBe("ministries");
  });

  it("ignores a nav left over in the hash", () => {
    const state = parseExplorerHash("#nav=revenue&sel=spending.health", "expenditure");

    expect(state.selection?.scope).toBe("fields");
  });
});

describe("readLegacyNav", () => {
  it("reads a legacy nav for the redirect", () => {
    expect(readLegacyNav("#nav=analysis&ay=2024")).toBe("analysis");
    expect(readLegacyNav("#nav=revenue")).toBe("revenue");
  });

  it("returns null when there is nothing to redirect to", () => {
    expect(readLegacyNav("#m=table")).toBeNull();
    expect(readLegacyNav("")).toBeNull();
    expect(readLegacyNav("#nav=bogus")).toBeNull();
  });
});

describe("stripNavFromHash", () => {
  it("keeps the rest of the state intact", () => {
    expect(stripNavFromHash("#nav=revenue&m=table&sel=revenue.vat")).toBe("m=table&sel=revenue.vat");
  });

  it("returns an empty string when nav was all there was", () => {
    expect(stripNavFromHash("#nav=analysis")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/explorer/urlState.test.ts`
Expected: FAIL — `readLegacyNav is not exported`.

- [ ] **Step 3: Update `urlState.ts`**

Change the header comment to:

```ts
// Shareable screen state, serialized into the URL hash (DESIGN.md §6.3). The
// section lives in the route, not the hash:
//   /explorer/expenditure#g=fields&m=line&sh=1&r=2005-2025&sel=id1,id2
//   /explorer/analysis#as=expenditure&ag=ministries&ay=2024
```

Remove `nav?: ExplorerNav;` from `ExplorerUrlState`.

Change the parser signature and its nav handling:

```ts
export function parseExplorerHash(hash: string, nav: ExplorerNav): ExplorerUrlState {
  const state: ExplorerUrlState = {};

  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));

    const grouping = params.get("g");
    if (grouping === "fields" || grouping === "ministries") state.grouping = grouping;
```

…leaving the `m`, `sh`, `as`, `ag`, `ay` blocks unchanged, and replacing the scope derivation with:

```ts
    const explorerNav = nav === "revenue" ? "revenue" : "expenditure";
    const scope = scopeFor(explorerNav, state.grouping ?? "fields");
```

Add the two new helpers at the end of the file:

```ts
// Old links carried the section in the hash (#nav=analysis). The hub reads it
// once and redirects, so those links keep working.
export function readLegacyNav(hash: string): ExplorerNav | null {
  try {
    const nav = new URLSearchParams(hash.replace(/^#/, "")).get("nav");
    return nav === "expenditure" || nav === "revenue" || nav === "analysis" ? nav : null;
  } catch {
    return null;
  }
}

export function stripNavFromHash(hash: string): string {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    params.delete("nav");
    return params.toString();
  } catch {
    return "";
  }
}
```

In `serializeExplorerHash`, delete the line `params.set("nav", input.nav);`. Keep `nav` in `SerializeExplorerInput` — the analysis branch still switches on it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/explorer/urlState.test.ts`
Expected: PASS, 8 tests. `npm run typecheck` will now fail in `use-explorer-state.ts` — Task 6 fixes it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/explorer/urlState.ts apps/web/tests/explorer/urlState.test.ts
git commit -m "refactor(url): move the section out of the hash and into the route"
```

---

### Task 6: Routes, layout, page header, and `nav` as a prop

**Files:**
- Create: `apps/web/app/explorer/layout.tsx`
- Create: `apps/web/app/explorer/expenditure/page.tsx`
- Create: `apps/web/app/explorer/revenue/page.tsx`
- Create: `apps/web/app/explorer/analysis/page.tsx`
- Create: `apps/web/components/shell/page-header.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/main-explorer/use-explorer-state.ts:60,127-130,145-151,213-239`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/tests/browser/visual-reference.spec.ts`

**Interfaces:**
- Consumes: `parseExplorerHash(hash, nav)` from Task 5.
- Produces:
  - `PageHeader({ crumbs, coverage }: { crumbs: Crumb[]; coverage: string })` where `type Crumb = { label: string; href?: string }`.
  - `MainExplorer` gains a required `nav: ExplorerNav` prop.
  - `useExplorerState({ facts, adminFacts, nav })`.

The sidebar arrives in Task 7; this task leaves the layout rendering only the content column so the suite stays green in between.

**Note on where the header renders:** the spec's §3.1 says each page renders its own breadcrumb. For section routes that happens *through* `MainExplorer`, because the coverage label tracks live grouping state (fields vs ministries have different year ranges) and a server page cannot see it. The hub renders `PageHeader` directly in Task 9.

- [ ] **Step 1: Create the page header**

Create `apps/web/components/shell/page-header.tsx`:

```tsx
import Link from "next/link";

// Breadcrumb row above every explorer surface (DESIGN.md §6.7). The right-hand
// label is dataset COVERAGE, not the user's selection — the range strip owns that.

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  crumbs: Crumb[];
  coverage: string;
};

export function PageHeader({ crumbs, coverage }: PageHeaderProps) {
  return (
    <header
      data-testid="explorer-header"
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b-2 border-[var(--ink)] pt-[18px] pb-3"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {crumbs.map((crumb, index) => (
          <span key={crumb.label}>
            {index > 0 ? <span className="mx-1.5 text-[var(--accent)]">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="text-[var(--muted)] no-underline hover:text-[var(--ink)] hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className={index === crumbs.length - 1 ? "text-[var(--ink)]" : undefined}>{crumb.label}</span>
            )}
          </span>
        ))}
      </p>
      <p className="font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">{coverage}</p>
    </header>
  );
}
```

- [ ] **Step 2: Make `nav` an input to the state hook**

In `apps/web/components/main-explorer/use-explorer-state.ts`:

Change the input type:

```ts
type UseExplorerStateInput = {
  facts: BudgetFactImportRow[];
  adminFacts: AdminSpendingFact[];
  nav: ExplorerNav;
};
```

Change the signature to `export function useExplorerState({ facts, adminFacts, nav }: UseExplorerStateInput) {` and delete the `const [nav, setNav] = useState<ExplorerNav>("expenditure");` line (line 60).

Delete `handleNavChange` (lines 127-130) and remove `setNav(parsed.nav)` plus its `eslint-disable-next-line react-hooks/set-state-in-effect` comment from the hash effect. Change the parse call to:

```ts
    const parsed = parseExplorerHash(window.location.hash, nav);
```

Remove `nav` and `handleNavChange` from the returned object; keep `explorerSide` and everything else.

- [ ] **Step 3: Rewrite `MainExplorer` around the prop**

In `apps/web/components/main-explorer/main-explorer.tsx`:

- Add `nav: ExplorerNav;` to `MainExplorerProps` and accept it in the destructured parameter list.
- Delete the `NAV_ITEMS` constant and the `Link` import.
- Pass `nav` into `useExplorerState({ facts, adminFacts, nav })` and stop destructuring `nav` / `handleNavChange` from the result.
- Add the `PageHeader` import: `import { PageHeader } from "../shell/page-header";`
- Add the crumb and coverage values above the `return`:

```tsx
  const sectionLabel = isAnalysis ? "ანალიზი" : nav === "revenue" ? "შემოსავლები" : "ხარჯები";
  const coverageYears = isAnalysis ? analysisYears : scopeYears;
  const coverage = [
    coverageYears.length > 0 ? `${coverageYears[0]} — ${coverageYears.at(-1)}` : "",
    lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
```

- Replace the entire `<header data-testid="explorer-header">…</header>` block (lines 194-224) with:

```tsx
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: sectionLabel },
          ]}
          coverage={coverage}
        />
```

- Delete the now-unused `contextLabel` constant.

- [ ] **Step 4: Create the layout**

Create `apps/web/app/explorer/layout.tsx`:

```tsx
import type { ReactNode } from "react";

// Explorer shell (DESIGN.md §6.7). A flex row rather than a fixed grid: the
// sidebar owns its own width, so collapsing it reflows the content with no
// shared state between the two.
export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)] min-[900px]:flex-row">
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Create the three section routes**

Create `apps/web/app/explorer/expenditure/page.tsx`:

```tsx
import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData } from "../../../lib/data/servedData";

export const metadata: Metadata = {
  title: "ხარჯები — GeoData",
  description: "საქართველოს ბიუჯეტის ხარჯები სფეროებისა და უწყებების ჭრილში, 2005 წლიდან დღემდე.",
  alternates: { canonical: "/explorer/expenditure" },
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
    url: "/explorer/expenditure",
    title: "ხარჯები — GeoData",
    description: "საქართველოს ბიუჯეტის ხარჯები სფეროებისა და უწყებების ჭრილში, 2005 წლიდან დღემდე.",
  },
};

export default async function ExpenditurePage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      nav="expenditure"
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
```

Create `apps/web/app/explorer/revenue/page.tsx`:

```tsx
import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData } from "../../../lib/data/servedData";

const DESCRIPTION = "საქართველოს ბიუჯეტის შემოსავლები — გადასახადები, გრანტები და სხვა შემოსულობები, 2005 წლიდან დღემდე.";

export const metadata: Metadata = {
  title: "შემოსავლები — GeoData",
  description: DESCRIPTION,
  alternates: { canonical: "/explorer/revenue" },
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
    url: "/explorer/revenue",
    title: "შემოსავლები — GeoData",
    description: DESCRIPTION,
  },
};

export default async function RevenuePage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      nav="revenue"
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
```

Create `apps/web/app/explorer/analysis/page.tsx`:

```tsx
import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData } from "../../../lib/data/servedData";

const DESCRIPTION = "ერთი წლის ბიუჯეტის სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾.";

export const metadata: Metadata = {
  title: "ანალიზი — GeoData",
  description: DESCRIPTION,
  alternates: { canonical: "/explorer/analysis" },
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
    url: "/explorer/analysis",
    title: "ანალიზი — GeoData",
    description: DESCRIPTION,
  },
};

export default async function AnalysisPage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      nav="analysis"
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
```

- [ ] **Step 6: Point the old route at the expenditure section for now**

Replace the body of `apps/web/app/explorer/page.tsx` with a redirect so nothing 404s before Task 9 builds the hub:

```tsx
import { redirect } from "next/navigation";

export default function ExplorerPage() {
  redirect("/explorer/expenditure");
}
```

Delete the `metadata` export and the data-loading imports from that file; Task 9 replaces this wholesale.

- [ ] **Step 7: Add the routes to the sitemap**

In `apps/web/app/sitemap.ts`, replace the returned array with:

```ts
  return [
    { url: `${siteUrl}/`, lastModified },
    { url: `${siteUrl}/explorer`, lastModified },
    { url: `${siteUrl}/explorer/expenditure`, lastModified },
    { url: `${siteUrl}/explorer/revenue`, lastModified },
    { url: `${siteUrl}/explorer/analysis`, lastModified },
  ];
```

- [ ] **Step 8: Update the browser tests to navigate by route**

In `apps/web/tests/browser/main-explorer.spec.ts`:

- Replace every `page.goto("http://localhost:3100/explorer")` with `page.goto("http://localhost:3100/explorer/expenditure")`.
- In the first test, delete the three `nav-*` assertions (lines 52-55) and the `// Three-tab nav.` comment.
- In `"revenue nav reuses the identical system without a grouping switch"`, replace the `await page.getByTestId("nav-revenue").click();` line with `await page.goto("http://localhost:3100/explorer/revenue");` followed by `await expectAppReady(page);`.
- In `"URL hash round-trips explorer state"`, change the second `goto` to `http://localhost:3100/explorer/revenue#m=table&sh=1&r=2010-2020&sel=revenue.vat`.
- In the large shared-selection test, change the `goto` to `` `http://localhost:3100/explorer/expenditure#m=line&sel=${sel}` `` and assert every selected series renders with no limit message.
- In `"analysis view renders the fixed single-year section order"`, replace the `nav-analysis` click with `await page.goto("http://localhost:3100/explorer/analysis");` and `await expectAppReady(page);`.
- In `"mobile explorer and analysis layouts have no page overflow"` and `"captures editorial desktop and mobile screenshots"`, do the same for the `nav-analysis` clicks.

In `apps/web/tests/browser/visual-reference.spec.ts`:

- Change both `goto("http://localhost:3100/explorer")` calls to `/explorer/expenditure`.
- Delete the three `nav-*` assertions (lines 34-36).
- Replace the `nav-analysis` click in the second test with `await page.goto("http://localhost:3100/explorer/analysis");` and `await waitForApp(page);`.

- [ ] **Step 9: Verify**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: all pass; the build output lists `/explorer/expenditure`, `/explorer/revenue`, `/explorer/analysis`.

Run: `npm run test:browser`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/explorer apps/web/app/sitemap.ts apps/web/components/shell apps/web/components/main-explorer apps/web/tests/browser
git commit -m "feat(explorer): split sections into routes with a shared page header"
```

---

### Task 7: Sidebar and section navigation

**Files:**
- Create: `apps/web/components/shell/section-nav.tsx`
- Create: `apps/web/components/shell/data-sidebar.tsx`
- Modify: `apps/web/components/ui/editorial.tsx` (add `ComingSoonBadge`)
- Modify: `apps/web/app/explorer/layout.tsx`
- Modify: `apps/web/app/globals.css` (two ink-surface tokens)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ComingSoonBadge()` — the `მალე` marker, shared by the sidebar and the section list.
  - `SectionNav()` — the deletable switcher. Nothing but `DataSidebar` imports it.
  - `DataSidebar()` — the full sidebar, expanded state only. Task 8 adds collapse.

`ComingSoonBadge` lives in `editorial.tsx`, not in `section-nav.tsx`, so that deleting the switcher later cannot take the sidebar's teaser badges down with it.

- [ ] **Step 1: Add the ink-surface tokens**

In `apps/web/app/globals.css`, after `--faint`:

```css
  --ink-fg-muted: #8F8676;
  --ink-fg-faint: #7A7060;
```

- [ ] **Step 1b: Add the badge to the editorial layer**

Append to `apps/web/components/ui/editorial.tsx`:

```tsx
// Marks a dataset or section that has no data yet (DESIGN.md §6.7). Rendering a
// coming-soon surface as if it were live is the failure this guards against.
export function ComingSoonBadge() {
  return (
    <span className="flex-none rounded-[2px] border border-[#3A362E] px-1.5 py-px font-[family-name:var(--font-numeric)] text-[9px] text-[var(--ink-fg-faint)]">
      მალე
    </span>
  );
}
```

- [ ] **Step 2: Create the section switcher**

Create `apps/web/components/shell/section-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComingSoonBadge } from "../ui/editorial";

// Budget sections, nested under ბიუჯეტი in the sidebar (DESIGN.md §6.7).
// Deleting this component and its single usage in data-sidebar.tsx reverts
// navigation to hub-and-breadcrumb only. Nothing else imports it.

const SECTIONS = [
  { href: "/explorer/expenditure", label: "ხარჯები" },
  { href: "/explorer/revenue", label: "შემოსავლები" },
  { href: null, label: "მუნიციპალიტეტები" },
  { href: "/explorer/analysis", label: "ანალიზი" },
] as const;

export function SectionNav() {
  const pathname = usePathname();

  return (
    <ul className="mt-0.5 flex list-none flex-col gap-px pl-[18px]">
      {SECTIONS.map((section) => {
        if (section.href === null) {
          return (
            <li
              key={section.label}
              aria-disabled="true"
              className="flex items-baseline gap-2 py-[5px] pr-2 text-[12px] text-[var(--ink-fg-muted)]"
            >
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
              <ComingSoonBadge />
            </li>
          );
        }

        const active = pathname === section.href;

        return (
          <li key={section.label}>
            <Link
              href={section.href}
              data-testid={`section-link-${section.href.split("/").at(-1)}`}
              aria-current={active ? "page" : undefined}
              className={`flex items-baseline gap-2 py-[5px] pr-2 pl-2 text-[12px] no-underline transition-colors duration-150 ${
                active
                  ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]"
                  : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"
              }`}
            >
              <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${active ? "text-[var(--accent)]" : "text-transparent"}`}>
                ▸
              </span>
              {section.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: Create the sidebar**

Create `apps/web/components/shell/data-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ComingSoonBadge } from "../ui/editorial";
import { SectionNav } from "./section-nav";

// Platform sidebar (DESIGN.md §6.7). GeoData is a data platform whose first
// dataset is the budget; the teaser rows are markers only — no data, no routes.

const TEASERS = ["უმუშევრობა", "ინფლაცია", "ეკონომიკური ზრდა", "დემოგრაფია"];

export function DataSidebar() {
  return (
    <aside
      data-testid="data-sidebar"
      className="flex w-[232px] flex-none flex-col bg-[var(--ink)] px-4 pt-[18px] pb-4 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen"
    >
      <Link href="/" className="flex flex-col gap-0.5 no-underline">
        <span className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--paper)]">GeoData</span>
        <span className="font-[family-name:var(--font-numeric)] text-[8.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]">
          ღია მონაცემები
        </span>
      </Link>

      <div aria-hidden className="mt-4 mb-3.5 h-px bg-[rgba(247,242,233,0.12)]" />

      <p className="mb-3 font-[family-name:var(--font-numeric)] text-[9.5px] tracking-[0.12em] text-[var(--ink-fg-faint)]">
        მონაცემები /
      </p>

      <nav aria-label="მონაცემთა ნაკრებები" className="flex flex-col gap-0.5">
        <p className="flex items-baseline gap-2 border-l-2 border-[var(--accent)] bg-[rgba(247,242,233,0.07)] px-2.5 py-2 text-[12.5px] font-semibold text-[var(--paper)]">
          ბიუჯეტი
        </p>
        <SectionNav />

        <ul className="mt-2 flex list-none flex-col gap-0.5">
          {TEASERS.map((label) => (
            <li
              key={label}
              aria-disabled="true"
              className="flex items-baseline gap-2 border-l-2 border-transparent px-2.5 py-2 text-[12.5px] font-medium text-[var(--ink-fg-muted)]"
            >
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <ComingSoonBadge />
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto border-t border-[rgba(247,242,233,0.12)] pt-3">
        <Link href="/" className="text-[11.5px] font-medium text-[var(--faint)] no-underline hover:text-[var(--paper)]">
          ← მთავარი
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Mount it in the layout**

In `apps/web/app/explorer/layout.tsx`, add the import and render the sidebar before the content column:

```tsx
import type { ReactNode } from "react";
import { DataSidebar } from "../../components/shell/data-sidebar";

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)] min-[900px]:flex-row">
      <DataSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Drop the duplicated page chrome**

`MainExplorer`'s `<main>` wrapper still carries the old page padding and max-width. Change its className to:

```tsx
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px] min-[768px]:pb-16"
```

(The top padding now comes from `PageHeader`.) Keep `data-testid="explorer-shell"`. Change the inner wrapper from `mx-auto max-w-[1240px]` to `max-w-[1180px]`.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass.

Run: `npm run test:browser`
Expected: all pass. `landing.spec.ts`'s "wordmark → back to landing" step still works because the sidebar brand is a link named `GeoData`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/shell apps/web/app/explorer/layout.tsx apps/web/app/globals.css apps/web/components/main-explorer/main-explorer.tsx
git commit -m "feat(shell): add the platform sidebar with nested budget sections"
```

---

### Task 8: Collapsed rail and mobile sheet

**Files:**
- Modify: `apps/web/components/shell/data-sidebar.tsx`
- Modify: `apps/web/app/globals.css` (reduced-motion guard)

**Interfaces:**
- Consumes: `SectionNav`, `ComingSoonBadge` from Task 7.
- Produces: nothing new for other tasks.

Two states on desktop — 232px expanded, 52px collapsed — and a top bar with a sheet below 900px. Collapse is a desktop-only preference; below 900px the sheet is always the full nav.

- [ ] **Step 1: Add the reduced-motion guard**

In `apps/web/app/globals.css`, at the end of the file:

```css
@media (prefers-reduced-motion: reduce) {
  [data-testid="data-sidebar"] {
    transition: none;
  }
}
```

- [ ] **Step 2: Rewrite the sidebar with both desktop states**

Replace `apps/web/components/shell/data-sidebar.tsx` entirely:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ComingSoonBadge } from "../ui/editorial";
import { SectionNav } from "./section-nav";

// Platform sidebar (DESIGN.md §6.7). Two desktop states — 232px expanded and a
// 52px reading rail — plus a top bar with a sheet below 900px. GeoData is a data
// platform whose first dataset is the budget; teaser rows are markers only.

const TEASERS = ["უმუშევრობა", "ინფლაცია", "ეკონომიკური ზრდა", "დემოგრაფია"];
const STORAGE_KEY = "geodata:sidebar-collapsed";
const DESKTOP_MIN_WIDTH = 900;

export function DataSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Read after mount: the server render cannot see localStorage, and guessing
  // would flash the wrong width on every load.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Collapse is a desktop posture. A preference set on a laptop must not follow
  // the user to a phone, where it would render as a mystery-narrow rail.
  const railed = collapsed && isDesktop;

  function handleToggle() {
    // One control, two jobs: collapse on desktop, close the sheet on mobile.
    if (!isDesktop) {
      setSheetOpen((open) => !open);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Private-mode storage denials must not break the toggle itself.
      }
      return next;
    });
  }

  return (
    <aside
      data-testid="data-sidebar"
      data-collapsed={railed ? "true" : "false"}
      className={`flex w-full flex-none flex-col bg-[var(--ink)] px-4 pt-[18px] pb-4 transition-[width] duration-150 ease-in-out min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-screen ${
        railed ? "min-[900px]:w-[52px] min-[900px]:px-3" : "min-[900px]:w-[232px]"
      }`}
    >
      <div className="flex items-center justify-between gap-2.5">
        {railed ? null : (
          <Link href="/" className="flex flex-col gap-0.5 no-underline">
            <span className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--paper)]">GeoData</span>
            <span className="font-[family-name:var(--font-numeric)] text-[8.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]">
              ღია მონაცემები
            </span>
          </Link>
        )}
        <button
          type="button"
          data-testid="sidebar-toggle"
          aria-expanded={!railed}
          aria-label={railed ? "პანელის გაშლა" : "პანელის ჩაკეცვა"}
          onClick={handleToggle}
          className="size-[26px] flex-none cursor-pointer rounded-[3px] border border-[rgba(247,242,233,0.18)] font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)] hover:text-[var(--paper)]"
        >
          {railed ? "»" : "«"}
        </button>
      </div>

      {railed ? (
        <>
          <p
            className="mt-6 flex-1 font-[family-name:var(--font-numeric)] text-[9.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            მონაცემები · ბიუჯეტი
          </p>
          <Link
            href="/"
            aria-label="მთავარი"
            title="მთავარი"
            className="mt-auto flex size-[26px] items-center justify-center self-center no-underline"
          >
            <span aria-hidden className="size-2 bg-[var(--accent)]" />
          </Link>
        </>
      ) : (
        <div className={sheetOpen ? "flex flex-1 flex-col" : "hidden flex-1 min-[900px]:flex min-[900px]:flex-col"}>
          <div aria-hidden className="mt-4 mb-3.5 h-px bg-[rgba(247,242,233,0.12)]" />
          <p className="mb-3 font-[family-name:var(--font-numeric)] text-[9.5px] tracking-[0.12em] text-[var(--ink-fg-faint)]">
            მონაცემები /
          </p>
          <nav aria-label="მონაცემთა ნაკრებები" className="flex flex-col gap-0.5">
            <p className="flex items-baseline gap-2 border-l-2 border-[var(--accent)] bg-[rgba(247,242,233,0.07)] px-2.5 py-2 text-[12.5px] font-semibold text-[var(--paper)]">
              ბიუჯეტი
            </p>
            <SectionNav />
            <ul className="mt-2 flex list-none flex-col gap-0.5">
              {TEASERS.map((label) => (
                <li
                  key={label}
                  aria-disabled="true"
                  className="flex items-baseline gap-2 border-l-2 border-transparent px-2.5 py-2 text-[12.5px] font-medium text-[var(--ink-fg-muted)]"
                >
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <ComingSoonBadge />
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto border-t border-[rgba(247,242,233,0.12)] pt-3">
            <Link href="/" className="text-[11.5px] font-medium text-[var(--faint)] no-underline hover:text-[var(--paper)]">
              ← მთავარი
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
```

The toggle carries `aria-expanded` but no `aria-controls`: the nav element does not exist while railed, and a dangling `aria-controls` reference is worse than none.


- [ ] **Step 3: Add browser coverage**

Append to `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("sidebar collapses to a rail and remembers the choice", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const sidebar = page.getByTestId("data-sidebar");
  const toggle = page.getByTestId("sidebar-toggle");

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect((await sidebar.boundingBox())?.width).toBeCloseTo(232, 0);
  await expect(page.getByTestId("section-link-revenue")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect((await sidebar.boundingBox())?.width).toBeCloseTo(52, 0);
  await expect(page.getByTestId("section-link-revenue")).toHaveCount(0);

  await page.reload();
  await expectAppReady(page);
  await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
  expect((await page.getByTestId("data-sidebar").boundingBox())?.width).toBeCloseTo(52, 0);
});
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build && npm run test:browser`
Expected: all pass, including the new collapse test and the existing mobile-overflow tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/shell/data-sidebar.tsx apps/web/app/globals.css apps/web/tests/browser/main-explorer.spec.ts
git commit -m "feat(shell): add the collapsed sidebar rail and mobile sheet"
```

---

### Task 9: Budget hub

**Files:**
- Create: `apps/web/lib/explorer/hubCards.ts`
- Create: `apps/web/components/hub/budget-hub.tsx`
- Create: `apps/web/components/shell/legacy-hash-redirect.tsx`
- Modify: `apps/web/app/explorer/page.tsx`
- Test: `apps/web/tests/explorer/hubCards.test.ts`

**Interfaces:**
- Consumes: `Sparkline` (Task 1), `PageHeader` (Task 6), `readLegacyNav` / `stripNavFromHash` (Task 5).
- Produces:
  - `buildHubCards(facts: BudgetFactImportRow[]): HubCardModel[]`
  - `type HubCardModel = { index: string; title: string; description: string; href: string | null; comingSoon: boolean; series: (number | null)[] | null; seriesColor: string | null; footer: string | null }`

Every figure comes from the served facts, so the hub cannot drift from the pages behind it.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/hubCards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildHubCards } from "../../lib/explorer/hubCards";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";

function fact(side: "expenditure" | "revenue", itemId: string, year: number, amountGel: number): BudgetFactImportRow {
  return {
    year,
    side,
    itemId,
    amountGel,
    basis: "actual",
    sourceId: "test-source",
    officialInstitution: null,
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: null,
    mappingConfidence: null,
    mappingNotes: "",
  };
}

const FACTS = [
  fact("expenditure", "spending.health", 2024, 1_000_000_000),
  fact("expenditure", "spending.health", 2025, 2_000_000_000),
  fact("revenue", "revenue.vat", 2024, 3_000_000_000),
  fact("revenue", "revenue.vat", 2025, 4_000_000_000),
];

describe("buildHubCards", () => {
  it("orders expenditure, revenue, municipalities, analysis", () => {
    const cards = buildHubCards(FACTS);

    expect(cards.map((card) => card.title)).toEqual(["ხარჯები", "შემოსავლები", "მუნიციპალიტეტები", "ანალიზი"]);
    expect(cards.map((card) => card.index)).toEqual(["01", "02", "03", "04"]);
  });

  it("derives each live card's footer from the latest year", () => {
    const cards = buildHubCards(FACTS);

    expect(cards[0].footer).toContain("2025");
    expect(cards[0].footer).toContain("2.00");
    expect(cards[1].footer).toContain("4.00");
  });

  it("gives live cards a real series to draw", () => {
    const cards = buildHubCards(FACTS);

    expect(cards[0].series).toEqual([1_000_000_000, 2_000_000_000]);
    expect(cards[1].series).toEqual([3_000_000_000, 4_000_000_000]);
  });

  it("ships municipalities as a coming-soon card with nothing invented", () => {
    const card = buildHubCards(FACTS)[2];

    expect(card.comingSoon).toBe(true);
    expect(card.href).toBeNull();
    expect(card.footer).toBeNull();
    expect(card.series).toBeNull();
  });

  it("points the analysis card at the route it actually opens", () => {
    const card = buildHubCards(FACTS)[3];

    expect(card.href).toBe("/explorer/analysis");
    expect(card.comingSoon).toBe(false);
    expect(card.footer).toContain("2025");
    expect(card.footer).toContain("კატეგორია");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/explorer/hubCards.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/explorer/hubCards"`.

- [ ] **Step 3: Write the builder**

Create `apps/web/lib/explorer/hubCards.ts`:

```ts
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "./explorerData";
import { formatAmount } from "./format";
import { ACCENT, INK } from "./colors";

// Budget hub cards (DESIGN.md §6.7). Every figure is derived from the served
// facts at build time, so the hub can never drift from the pages behind it.

export type HubCardModel = {
  index: string;
  title: string;
  description: string;
  href: string | null;
  comingSoon: boolean;
  series: (number | null)[] | null;
  seriesColor: string | null;
  footer: string | null;
};

function totalsByYear(facts: BudgetFactImportRow[], side: "expenditure" | "revenue"): Map<number, number> {
  const totals = new Map<number, number>();
  for (const fact of chooseActivePublicFacts(facts)) {
    if (fact.side !== side) continue;
    if (isDerivedTotalItemId(fact.itemId)) continue;
    totals.set(fact.year, (totals.get(fact.year) ?? 0) + fact.amountGel);
  }
  return totals;
}

function categoryCount(facts: BudgetFactImportRow[], side: "expenditure" | "revenue", year: number): number {
  const ids = new Set<string>();
  for (const fact of chooseActivePublicFacts(facts)) {
    if (fact.side !== side || fact.year !== year) continue;
    if (isDerivedTotalItemId(fact.itemId)) continue;
    ids.add(fact.itemId);
  }
  return ids.size;
}

export function buildHubCards(facts: BudgetFactImportRow[]): HubCardModel[] {
  const expenditure = totalsByYear(facts, "expenditure");
  const revenue = totalsByYear(facts, "revenue");

  const build = (totals: Map<number, number>) => {
    const years = Array.from(totals.keys()).sort((a, b) => a - b);
    const latest = years.at(-1) ?? null;
    return {
      series: years.length > 0 ? years.map((year) => totals.get(year) ?? null) : null,
      footer: latest === null ? null : `${latest} · ${formatAmount(totals.get(latest) ?? 0)}`,
      latest,
    };
  };

  const spend = build(expenditure);
  const revenues = build(revenue);
  const analysisYear = spend.latest;

  return [
    {
      index: "01",
      title: "ხარჯები",
      description: "ფუნქციონალური და უწყებრივი ჭრილი — რაში იხარჯება ბიუჯეტი.",
      href: "/explorer/expenditure",
      comingSoon: false,
      series: spend.series,
      seriesColor: ACCENT,
      footer: spend.footer,
    },
    {
      index: "02",
      title: "შემოსავლები",
      description: "გადასახადები, გრანტები და სხვა შემოსულობები წლების მიხედვით.",
      href: "/explorer/revenue",
      comingSoon: false,
      series: revenues.series,
      seriesColor: INK,
      footer: revenues.footer,
    },
    {
      index: "03",
      title: "მუნიციპალიტეტები",
      description: "მუნიციპალური ბიუჯეტების ჭრილი — მონაცემები მზადდება.",
      href: null,
      comingSoon: true,
      series: null,
      seriesColor: null,
      footer: null,
    },
    {
      index: "04",
      title: "ანალიზი",
      description: "ერთი წლის სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾.",
      href: "/explorer/analysis",
      comingSoon: false,
      series: null,
      seriesColor: null,
      footer:
        analysisYear === null
          ? null
          : `${analysisYear} · ${categoryCount(facts, "expenditure", analysisYear)} კატეგორია`,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/explorer/hubCards.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Create the legacy redirect**

Create `apps/web/components/shell/legacy-hash-redirect.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readLegacyNav, stripNavFromHash } from "../../lib/explorer/urlState";

// Links shared before the route split carried the section in the hash
// (/explorer#nav=analysis). Honour them once, then get out of the way.
// Also flags the hub as hydrated for the browser tests, which wait on it.
export function LegacyHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    document.body.dataset.appReady = "true";

    const nav = readLegacyNav(window.location.hash);
    if (nav === null) return;

    const rest = stripNavFromHash(window.location.hash);
    router.replace(`/explorer/${nav}${rest ? `#${rest}` : ""}`);
  }, [router]);

  return null;
}
```

- [ ] **Step 6: Create the hub component**

Create `apps/web/components/hub/budget-hub.tsx`:

```tsx
import Link from "next/link";
import type { HubCardModel } from "../../lib/explorer/hubCards";
import { Sparkline } from "../ui/sparkline";

// Hub cards are the one card-framed block in the system (DESIGN.md §6.6):
// four peer destinations with no natural reading order need containment.

function CardBody({ card }: { card: HubCardModel }) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--accent)]">{card.index}</span>
        {card.comingSoon ? (
          <span className="rounded-[2px] border border-[var(--control)] px-1.5 py-px font-[family-name:var(--font-numeric)] text-[9px] text-[var(--muted)]">
            მალე
          </span>
        ) : (
          <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
            →
          </span>
        )}
      </div>
      <p
        className={`font-[family-name:var(--font-display)] text-[18px] font-semibold ${
          card.comingSoon ? "text-[var(--muted)]" : "text-[var(--ink)]"
        }`}
      >
        {card.title}
      </p>
      <p className="text-[11.5px] leading-normal text-[var(--muted)]">{card.description}</p>
      {card.series && card.seriesColor ? (
        <Sparkline values={card.series} color={card.seriesColor} width={200} height={34} />
      ) : null}
      {card.footer ? (
        <p className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{card.footer}</p>
      ) : null}
    </>
  );
}

export function BudgetHub({ cards }: { cards: HubCardModel[] }) {
  return (
    <div data-testid="budget-hub" className="grid max-w-[860px] gap-4 min-[768px]:grid-cols-2">
      {cards.map((card) =>
        card.href === null ? (
          <div
            key={card.index}
            data-testid="hub-card"
            aria-disabled="true"
            className="flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--tile)] px-[18px] pt-[18px] pb-[15px]"
          >
            <CardBody card={card} />
          </div>
        ) : (
          <Link
            key={card.index}
            href={card.href}
            data-testid="hub-card"
            className="flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--tile)] px-[18px] pt-[18px] pb-[15px] no-underline transition-colors duration-150 hover:bg-[var(--tint)]"
          >
            <CardBody card={card} />
          </Link>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 7: Replace the hub route**

Replace `apps/web/app/explorer/page.tsx` entirely:

```tsx
import type { Metadata } from "next";
import { BudgetHub } from "../../components/hub/budget-hub";
import { LegacyHashRedirect } from "../../components/shell/legacy-hash-redirect";
import { PageHeader } from "../../components/shell/page-header";
import { SourceNote } from "../../components/ui/editorial";
import { buildHubCards } from "../../lib/explorer/hubCards";
import { loadServedLandingData } from "../../lib/data/servedData";

export const metadata: Metadata = {
  title: "ბიუჯეტი — GeoData",
  description: "საქართველოს ბიუჯეტის მონაცემები: შემოსავლები, ხარჯები და ერთი წლის ანალიზი.",
  alternates: { canonical: "/explorer" },
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
    url: "/explorer",
    title: "ბიუჯეტი — GeoData",
    description: "საქართველოს ბიუჯეტის მონაცემები: შემოსავლები, ხარჯები და ერთი წლის ანალიზი.",
  },
};

export default async function ExplorerHubPage() {
  const { facts, sourceDocuments } = await loadServedLandingData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const cards = buildHubCards(facts);
  const years = Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b);
  const coverage = [
    years.length > 0 ? `${years[0]} — ${years.at(-1)}` : "",
    lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      data-testid="explorer-shell"
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]"
    >
      <div className="max-w-[1180px]">
        <LegacyHashRedirect />
        <PageHeader
          crumbs={[{ label: "მთავარი", href: "/" }, { label: "მონაცემები" }, { label: "ბიუჯეტი" }]}
          coverage={coverage}
        />
        <h1 className="mt-[22px] mb-2 font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.15] tracking-[-0.01em]">
          საქართველოს ბიუჯეტი
        </h1>
        <p className="mb-[26px] max-w-[560px] text-[13.5px] leading-relaxed text-[var(--body)]">
          აირჩიეთ განყოფილება — შემოსავლები, ხარჯები, მუნიციპალიტეტების ბიუჯეტები ან ანალიტიკური მასალები.
        </p>
        <BudgetHub cards={cards} />
        <div className="mt-[26px] max-w-[860px]">
          <SourceNote>
            მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო).
            {lastUpdatedAt ? (
              <>
                {" "}ბოლო განახლება: <span className="font-[family-name:var(--font-numeric)]">{lastUpdatedAt}</span>.
              </>
            ) : null}
          </SourceNote>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Add browser coverage**

Append to `apps/web/tests/browser/main-explorer.spec.ts`:

```ts
test("hub lists four cards and keeps municipalities inert", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer");
  await expectAppReady(page);

  await expect(page.getByTestId("hub-card")).toHaveCount(4);
  // Scoped to the hub: the sidebar carries a ხარჯები link too, and an unscoped
  // role query would trip Playwright's strict mode.
  await expect(page.getByTestId("budget-hub").getByRole("link", { name: /ხარჯები/ })).toHaveAttribute(
    "href",
    "/explorer/expenditure",
  );

  const municipalities = page.getByTestId("hub-card").nth(2);
  await expect(municipalities).toContainText("მუნიციპალიტეტები");
  await expect(municipalities).toContainText("მალე");
  await expect(municipalities).toHaveAttribute("aria-disabled", "true");
  expect(await municipalities.evaluate((node) => node.tagName)).toBe("DIV");

  // No invented article count or unit total anywhere on the hub.
  await expect(page.getByTestId("budget-hub")).not.toContainText("სტატია");
  await expect(page.getByTestId("budget-hub")).not.toContainText("64 ერთეული");

  expect(consoleProblems).toEqual([]);
});

test("legacy nav hashes redirect to their route", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer#nav=analysis&ay=2024");
  await expect(page).toHaveURL(/\/explorer\/analysis/);
  await expect(page).toHaveURL(/ay=2024/);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();

  await page.goto("http://localhost:3100/explorer#nav=revenue&m=table");
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-table")).toBeVisible();
});
```

- [ ] **Step 9: Verify**

Run: `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:browser`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/lib/explorer/hubCards.ts apps/web/components/hub apps/web/components/shell/legacy-hash-redirect.tsx apps/web/app/explorer/page.tsx apps/web/tests/explorer/hubCards.test.ts apps/web/tests/browser/main-explorer.spec.ts
git commit -m "feat(hub): add the budget hub with build-time figures"
```

---

### Task 10: Landing page links

**Files:**
- Modify: `apps/web/components/landing/landing-page.tsx:17`
- Modify: `apps/web/tests/browser/landing.spec.ts:64`

**Interfaces:**
- Consumes: the routes from Task 6.
- Produces: nothing.

Only links change — the landing page keeps its design.

- [ ] **Step 1: Repoint the analysis deep link**

In `apps/web/components/landing/landing-page.tsx`, change line 17:

```tsx
const ANALYSIS_HREF = "/explorer/analysis";
```

Leave every `/explorer` link as-is: they now land on the hub, which is the intended entry point.

- [ ] **Step 2: Update the landing test**

In `apps/web/tests/browser/landing.spec.ts`, change line 64:

```ts
  await expect(page).toHaveURL(/\/explorer\/analysis/);
```

- [ ] **Step 3: Verify**

Run: `npm run test:browser -- landing`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/landing-page.tsx apps/web/tests/browser/landing.spec.ts
git commit -m "fix(landing): point the analysis deep link at its route"
```

---

### Task 11: Documentation

**Files:**
- Modify: `DESIGN.md` (§4.1, §6.2, §6.3, §6.6, new §6.7, §7.2, §7.11, §8.3, §14)
- Modify: `Project_Definition.md` §2
- Modify: `AGENTS.md` "Current Project State"

**Interfaces:**
- Consumes: everything built above.
- Produces: nothing.

Docs are part of the definition of done, not a follow-up.

- [ ] **Step 1: Update `DESIGN.md`**

- **§4.1 Role Tokens** — add `--ink-fg-muted: #8F8676` (inactive labels on ink) and `--ink-fg-faint: #7A7060` (overlines, badges, tertiary text on ink).
- **§6.2 Information Architecture** — replace the three-tab description with: hub at `/explorer`, sections at `/explorer/expenditure`, `/explorer/revenue`, `/explorer/analysis`; navigation via the sidebar's nested section list; breadcrumb `მთავარი / მონაცემები / ბიუჯეტი / <section>`.
- **§6.3 URL State** — the section now lives in the route, not the hash. Document the remaining hash keys (`g`, `m`, `sh`, `r`, `sel`, `as`, `ag`, `ay`) and the one-time `#nav=` redirect on the hub.
- **§6.6 Shape and Elevation Policy** — add: "Exception: budget hub cards (`tile` bg, 1px `hairline` border, radius 0). Four peer destinations with no natural reading order are the one place containment beats rules. Cards remain forbidden everywhere else."
- **New §6.7 Shell and Sidebar** — 232px expanded / 52px collapsed, `--ink` surface, sticky full height; nested section list; `მალე` badge for unbuilt datasets; collapsed rail contents (toggle, vertical `მონაცემები · ბიუჯეტი`, accent home mark); sections unreachable while collapsed; top bar + sheet below 900px; `localStorage` persistence, desktop-only.
- **§7.2** — split into **§7.2a Mode Control** (segmented: 1px `control` border, 2px radius, mono 10.5px/0.04em, active `ink` bg + `paper` text; used only for `ხაზი / ცხრილი`) and **§7.2b Grouping Tabs** (the existing text-underline spec, unchanged, for the series aside and the analysis view).
- **§7.11 KPI Block** — add the sparkline: 64×16, 1.2px stroke, no axis or end dot, gaps unbridged, hidden from assistive tech; first two side KPIs plot level in the series colour, the third plots share of total in accent; the hero KPI keeps its gauge and gets none.
- **§8.3 Line Chart** — replace "grid lines `hairline-soft`" with the dot lattice: `#C9BEA9` at 0.6 opacity, r=0.7, two columns per year interval, three rows per gridline step, both halving below a 12px pitch floor, none when there is no interval; the 1px ink zero line stays.
- **§14 Motion** — add `width` to the transitionable properties, scoped to the sidebar rail and gated on `prefers-reduced-motion: reduce`.

- [ ] **Step 2: Update `Project_Definition.md`**

In §2, remove "Municipal transfers explorer" from **Excluded From V1**, and add to **Included** (marked as not yet built):

```markdown
- Municipal budgets section — in scope as a named future section; the hub lists it with a `მალე` marker and no data ships in v1.
```

- [ ] **Step 3: Update `AGENTS.md`**

In "Current Project State", replace the "three-tab IA" phrase with the hub-and-routes description, and note that the sidebar shell carries coming-soon markers for datasets that do not exist yet.

- [ ] **Step 4: Verify no doc contradicts the code**

Run: `npm run check`
Expected: PASS.

Manually confirm `DESIGN.md` no longer says the explorer has three nav tabs and no longer forbids cards without qualification.

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md Project_Definition.md AGENTS.md
git commit -m "docs: record the shell IA, hub-card exception, and workspace changes"
```

---

## Final verification

- [ ] Run `npm run check` from `apps/web` — lint, typecheck, unit tests, data validation all pass.
- [ ] Run `npm run build` — succeeds and lists `/explorer`, `/explorer/expenditure`, `/explorer/revenue`, `/explorer/analysis`.
- [ ] Run `npm run test:browser` — all specs pass.
- [ ] Open `/explorer` and confirm: four cards, municipalities inert, figures match the section pages.
- [ ] Collapse the sidebar, reload, confirm it stays collapsed; resize below 900px and confirm the top bar and sheet.
- [ ] Confirm the chart shows the dot lattice with no horizontal gridlines and the zero line intact, and that all three side KPIs show a sparkline.
