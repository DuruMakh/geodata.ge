# Mobile Responsiveness Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the audited mobile layout failures, improve touch accessibility and horizontal-scroll discoverability, and prevent regressions at 320–430 px widths without redesigning healthy pages.

**Architecture:** Keep every fix inside the existing shared components so one change repairs all routes that reuse it. Preserve the intentionally wide chart and table canvases; only their containers may scroll horizontally, while the document itself must never overflow. Add Playwright regression coverage before each implementation change and keep the existing editorial design system.

**Tech Stack:** Next.js 16, React 19, strict TypeScript, Tailwind CSS v4, Playwright 1.60, Vitest 4.

**Spec:** `DESIGN.md` §§6.7, 12, and 13, plus the current audit artifact at `C:/Users/Mylaptop/.codex/visualizations/2026/08/19/01a01a9f-f33c-7b43-891c-10666c312a9b/mobile-audit/mobile-responsiveness-audit.md`.

## Global Constraints

- Scope is limited to the analysis selector, municipal chart controls, shared range handles, mobile sidebar toggle, and scroll affordances identified by the audit.
- Preserve the warm editorial system in `DESIGN.md` v4.1; do not introduce new component libraries, cards, shadows, rounded-panel treatments, or icons.
- Preserve the chart's 720 px phone minimum and the table's calculated minimum width; these remain contained horizontal-scrolling surfaces.
- At mobile widths, controls must be at least 30 px tall and should be 36 px where the surrounding layout allows it.
- The full document must have no horizontal overflow at 320, 375, 390, or 430 px.
- Keep desktop layout and behavior unchanged unless a task explicitly says otherwise.
- Do not change data, calculations, routing, Georgian labels, URL hashes, chart modes, or export behavior.

## File map

- Modify `apps/web/components/analysis/analysis-view.tsx` — make analysis tabs wrap as groups and make the year strip usable and self-positioning.
- Modify `apps/web/components/municipalities/municipal-explorer.tsx` — make chart controls stack or wrap on narrow screens.
- Modify `apps/web/components/main-explorer/range-strip.tsx` — enlarge the interactive slider targets while retaining the 15 px visual handles.
- Modify `apps/web/components/shell/data-sidebar.tsx` — enlarge the phone toggle and expose its mobile panel relationship.
- Create `apps/web/components/ui/horizontal-scroll-hint.tsx` — one shared, typographic mobile instruction for intentionally wide chart and table regions.
- Modify `apps/web/components/main-explorer/editorial-line-chart.tsx` — label the horizontal region and add the shared hint.
- Modify `apps/web/components/main-explorer/explorer-table.tsx` — label the horizontal region and add the shared hint.
- Modify `apps/web/tests/browser/main-explorer.spec.ts` — analysis, slider, sidebar, chart, table, and page-overflow regressions.
- Modify `apps/web/tests/browser/municipal-entity.spec.ts` — municipality, region, and Georgia chart-control regressions.
- Modify `DESIGN.md` — record the resolved mobile sidebar relationship, touch-target rule, and scroll hint.

---

### Task 1: Repair the analysis tabs and year selector

**Files:**
- Modify: `apps/web/tests/browser/main-explorer.spec.ts:573-593`
- Modify: `apps/web/components/analysis/analysis-view.tsx:1-89`

**Interfaces:**
- Consumes: existing `year`, `years`, and `onYearChange` props.
- Produces: `analysis-tab-groups`, `analysis-year-selector`, and the existing year buttons with non-overlapping geometry; no public prop changes.

- [ ] **Step 1: Add a failing narrow-phone regression test**

Extend the existing mobile overflow test with this loop after the analysis route is ready:

```ts
for (const width of [320, 390]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("http://localhost:3100/explorer/analysis");
  await expectAppReady(page);

  const selector = page.getByTestId("analysis-year-selector");
  const yearButtons = selector.locator("button");
  const activeYear = selector.locator("button[aria-pressed='true']");

  const metrics = await selector.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

  const boxes = await yearButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    }),
  );
  expect(boxes.every((box) => box.width >= 36)).toBe(true);
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index]!.left).toBeGreaterThanOrEqual(boxes[index - 1]!.right);
  }

  const activeBox = await activeYear.boundingBox();
  const selectorBox = await selector.boundingBox();
  expect(activeBox).not.toBeNull();
  expect(selectorBox).not.toBeNull();
  expect(activeBox!.x).toBeGreaterThanOrEqual(selectorBox!.x);
  expect(activeBox!.x + activeBox!.width).toBeLessThanOrEqual(selectorBox!.x + selectorBox!.width);

  const tabGroups = page.getByTestId("analysis-tab-groups");
  expect(await tabGroups.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expectNoPageOverflow(page);
}
```

- [ ] **Step 2: Run the focused test and confirm the audited failure**

Run from `apps/web`:

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "mobile explorer and analysis layouts"
```

Expected: FAIL because the year buttons shrink below 36 px, overlap visually, and the active latest year is outside the initial visible area.

- [ ] **Step 3: Group the analysis tabs so they wrap cleanly**

Replace the current single mixed tab row with two non-breaking groups inside the existing header row:

```tsx
<div data-testid="analysis-tab-groups" className="flex min-w-0 flex-wrap items-center gap-x-[18px] gap-y-3">
  <span className="flex items-center gap-[18px]">
    <TextTab label="ხარჯები" active={side === "expenditure"} onClick={() => onSideChange("expenditure")} testId="analysis-side-expenditure" />
    <TextTab label="შემოსავლები" active={side === "revenue"} onClick={() => onSideChange("revenue")} testId="analysis-side-revenue" />
  </span>
  {side === "expenditure" ? (
    <span className="flex items-center gap-[18px]">
      <span className="hidden min-[480px]:inline"><TabDivider /></span>
      <TextTab label="სფეროები" active={grouping === "fields"} onClick={() => onGroupingChange("fields")} testId="analysis-grouping-fields" />
      <TextTab label="უწყებები" active={grouping === "ministries"} onClick={() => onGroupingChange("ministries")} testId="analysis-grouping-ministries" />
    </span>
  ) : null}
</div>
```

Keep the data-status text beneath or beside these groups through the existing wrapping parent; do not shorten the Georgian copy.

- [ ] **Step 4: Make years non-shrinking and bring the active year into view**

Add React refs and an effect:

```tsx
import { useEffect, useRef } from "react";

const yearStripRef = useRef<HTMLDivElement>(null);
const activeYearRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  const strip = yearStripRef.current;
  const active = activeYearRef.current;
  if (!strip || !active) return;

  const left = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior: "auto" });
}, [grouping, side, year]);
```

Attach `ref={yearStripRef}` to `analysis-year-selector`, attach `ref={active ? activeYearRef : undefined}` to each year button, and change the button classes to:

```tsx
className={`min-h-9 shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-[3px] pt-1.5 pb-[7px] font-[family-name:var(--font-numeric)] text-xs ${
  active ? "border-[var(--accent)] font-semibold text-[var(--ink)]" : "border-transparent font-normal text-[var(--muted)] hover:text-[var(--ink)]"
}`}
```

- [ ] **Step 5: Run the focused analysis test**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "mobile explorer and analysis layouts"
```

Expected: PASS at both widths; every year remains readable, the active year is visible, the tabs wrap by group, and the document does not overflow.

- [ ] **Step 6: Commit the analysis repair**

```powershell
git add apps/web/components/analysis/analysis-view.tsx apps/web/tests/browser/main-explorer.spec.ts
git commit -m "fix: repair mobile analysis controls"
```

---

### Task 2: Reflow municipality chart controls across every entity type

**Files:**
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx:252-285`

**Interfaces:**
- Consumes: existing shared municipal explorer state and route renderers.
- Produces: `municipal-chart-controls` test hook and one responsive control layout shared by municipality, region, and Georgia pages.

- [ ] **Step 1: Add failing route-matrix coverage**

Add this test near the existing narrow-viewport comparison test:

```ts
test("keeps municipal chart controls readable on narrow phones", async ({ page }) => {
  for (const path of [
    "/explorer/municipalities/04",
    "/explorer/municipalities/region/kakheti",
    "/explorer/municipalities/georgia",
  ]) {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`http://localhost:3100${path}`);
      await expectMunicipalAppReady(page);

      const controls = page.getByTestId("municipal-chart-controls");
      const shareToggle = page.getByTestId("municipal-share-toggle");
      await expect(controls).toBeVisible();
      await expect(shareToggle).toHaveText("% წილი");

      const geometry = await controls.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          viewport: document.documentElement.clientWidth,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.pageWidth).toBe(geometry.viewport);

      const toggleBox = await shareToggle.boundingBox();
      expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(36);
      await expect(shareToggle).toHaveCSS("white-space", "nowrap");
    }
  }
});
```

- [ ] **Step 2: Run the municipal regression and confirm the failure**

```powershell
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts --grep "keeps municipal chart controls"
```

Expected: FAIL because the current row remains a single inflexible line, the share toggle is 27 px high, and the narrow route can widen the document.

- [ ] **Step 3: Stack the shared controls below 520 px**

Add `data-testid="municipal-chart-controls"` and use this layout:

```tsx
<div
  data-testid="municipal-chart-controls"
  className="mb-[18px] flex flex-col items-start gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between min-[520px]:gap-5"
>
  <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
    <SegmentedTabs<ChartMode>
      ariaLabel="ხედის რეჟიმი"
      value={state.chartMode}
      onChange={state.setChartMode}
      options={[
        { value: "line", label: "ხაზი", testId: "municipal-mode-line" },
        { value: "table", label: "ცხრილი", testId: "municipal-mode-table" },
      ]}
    />
    <span className="min-w-0 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
      {state.share ? "წილი მთლიან ბიუჯეტში, %" : "მთლიანი ბიუჯეტი · მლნ ₾"}
    </span>
  </span>
  <button
    type="button"
    data-testid="municipal-share-toggle"
    aria-pressed={state.share}
    onClick={() => state.setShare(!state.share)}
    className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border px-3 text-[11.5px] ${
      state.share
        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
        : "border-[var(--control)] text-[var(--muted)]"
    }`}
  >
    % წილი
  </button>
</div>
```

- [ ] **Step 4: Run the municipal route matrix**

```powershell
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts --grep "keeps municipal chart controls"
```

Expected: PASS for all six route-width combinations with no clipped label and no document overflow.

- [ ] **Step 5: Run the complete municipal browser coverage**

```powershell
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/municipal-georgia.spec.ts
```

Expected: PASS; entity navigation, chart/table switching, percentage mode, comparisons, and URL state remain unchanged.

- [ ] **Step 6: Commit the municipal repair**

```powershell
git add apps/web/components/municipalities/municipal-explorer.tsx apps/web/tests/browser/municipal-entity.spec.ts
git commit -m "fix: reflow municipal chart controls on phones"
```

---

### Task 3: Enlarge touch targets and connect the mobile navigation panel

**Files:**
- Modify: `apps/web/tests/browser/main-explorer.spec.ts:332-366,715-769`
- Modify: `apps/web/components/main-explorer/range-strip.tsx:123-200`
- Modify: `apps/web/components/shell/data-sidebar.tsx:11-12,116-147`
- Modify: `DESIGN.md:343-348,590-603`

**Interfaces:**
- Consumes: existing pointer and keyboard slider behavior, `sheetOpen`, `isDesktop`, and `navVisible`.
- Produces: 30 × 30 px slider hit areas, a 36 × 36 px phone sidebar toggle, and `aria-controls="data-sidebar-navigation"` on mobile.

- [ ] **Step 1: Add failing touch-target assertions**

In the range-strip browser test, set the phone viewport and assert both handles:

```ts
await page.setViewportSize({ width: 390, height: 844 });
for (const testId of ["range-start-handle", "range-end-handle"]) {
  const box = await strip.getByTestId(testId).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(30);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(30);
}
```

In the mobile sidebar test, add:

```ts
const toggleBox = await toggle.boundingBox();
expect(toggleBox?.width ?? 0).toBeGreaterThanOrEqual(36);
expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(36);
await expect(toggle).toHaveAttribute("aria-controls", "data-sidebar-navigation");
await expect(page.locator("#data-sidebar-navigation")).toHaveCount(1);
```

- [ ] **Step 2: Run the two focused tests and confirm the failures**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "range strip supports|sidebar is a full-width"
```

Expected: FAIL because slider handles are 15 px, the sidebar toggle is 26 px, and `aria-controls` is absent.

- [ ] **Step 3: Separate slider hit area from its visual dot**

Replace `handleClass` with a 30 px transparent button that draws the existing 15 px handle through a pseudo-element:

```tsx
const handleClass =
  "absolute -top-1 size-[30px] -translate-x-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0 before:absolute before:top-1/2 before:left-1/2 before:size-[15px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-[var(--accent)] before:bg-[var(--paper)] before:shadow-[0_1px_3px_rgba(30,27,22,0.15)] before:content-['']";
```

Do not alter the pointer-capture or keyboard logic. The button's center remains the value position, so existing dragging calculations continue to work.

- [ ] **Step 4: Enlarge only the phone sidebar toggle and connect its panel**

Add a stable id:

```tsx
const MOBILE_NAV_ID = "data-sidebar-navigation";
```

Update the button attributes and classes:

```tsx
aria-controls={!isDesktop ? MOBILE_NAV_ID : undefined}
className="size-9 flex-none cursor-pointer rounded-[3px] border border-[rgba(247,242,233,0.18)] font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink-fg-muted)] hover:text-[var(--paper)] min-[900px]:size-[26px]"
```

Add `id={MOBILE_NAV_ID}` to the existing navigation panel `<div>`. Keep the conditional `aria-controls` because the collapsed desktop rail currently unmounts that panel; the mobile panel remains mounted and is only hidden.

- [ ] **Step 5: Update the canonical design contract**

In `DESIGN.md`:

- Replace the recorded mobile `aria-controls` gap with the implemented rule: the mobile toggle points to `data-sidebar-navigation`; the desktop collapsed rail omits `aria-controls` while the panel is unmounted.
- Add: “Slider handles keep the 15 px visual dot but expose a 30 × 30 px interactive target.”
- Keep the existing “controls ≥30 px tall (prefer 36 px+)” requirement unchanged.

- [ ] **Step 6: Run the focused touch and navigation tests**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "range strip supports|sidebar is a full-width"
```

Expected: PASS; slider dragging and keyboard arrows still work, the mobile toggle remains behaviorally identical, and Escape still returns focus.

- [ ] **Step 7: Commit the accessibility improvements**

```powershell
git add DESIGN.md apps/web/components/main-explorer/range-strip.tsx apps/web/components/shell/data-sidebar.tsx apps/web/tests/browser/main-explorer.spec.ts
git commit -m "fix: improve mobile control accessibility"
```

---

### Task 4: Make intentional horizontal scrolling discoverable

**Files:**
- Create: `apps/web/components/ui/horizontal-scroll-hint.tsx`
- Modify: `apps/web/components/main-explorer/editorial-line-chart.tsx:116-126`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx:42-45`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `DESIGN.md:588-598`

**Interfaces:**
- Consumes: intentionally wide chart and table containers.
- Produces: `HorizontalScrollHint({ testId }: { testId: string })`, keyboard-focusable labeled scroll regions, and visible phone-only guidance.

- [ ] **Step 1: Add failing scroll-discoverability coverage**

Add a new browser test:

```ts
test("mobile chart and table explain their contained horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const chart = page.getByTestId("chart-frame");
  await expect(page.getByTestId("chart-scroll-hint")).toBeVisible();
  await expect(chart).toHaveAttribute("tabindex", "0");
  await expect(chart).toHaveAttribute("aria-label", "მრავალწლიანი გრაფიკი — ჰორიზონტალურად გადაადგილებადი");
  expect(await chart.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  await expect(page.getByTestId("table-scroll-hint")).toBeVisible();
  await expect(table).toHaveAttribute("tabindex", "0");
  await expect(table).toHaveAttribute("aria-label", "მრავალწლიანი ცხრილი — ჰორიზონტალურად გადაადგილებადი");
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await expectNoPageOverflow(page);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing affordance**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "explain their contained horizontal scroll"
```

Expected: FAIL because the hint elements, region labels, and keyboard focus are absent.

- [ ] **Step 3: Create the shared typographic hint**

Create `horizontal-scroll-hint.tsx`:

```tsx
type HorizontalScrollHintProps = {
  testId: string;
};

export function HorizontalScrollHint({ testId }: HorizontalScrollHintProps) {
  return (
    <p
      data-testid={testId}
      className="mb-2 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)] min-[768px]:hidden"
    >
      მეტი მონაცემისთვის გადაასრიალე ჰორიზონტალურად
    </p>
  );
}
```

The instruction is text-only and uses existing typography and color tokens.

- [ ] **Step 4: Apply the hint and accessible region semantics**

In `editorial-line-chart.tsx`, render `<HorizontalScrollHint testId="chart-scroll-hint" />` immediately before the chart frame and update the frame:

```tsx
<div
  data-testid="chart-frame"
  role="region"
  tabIndex={0}
  aria-label="მრავალწლიანი გრაფიკი — ჰორიზონტალურად გადაადგილებადი"
  className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
>
```

In `explorer-table.tsx`, wrap the existing table region in `<div className="mt-[18px]">`, render `<HorizontalScrollHint testId="table-scroll-hint" />` inside that wrapper immediately before the table container, remove `mt-[18px]` from the table container, and update it:

```tsx
<div
  data-testid="explorer-table"
  role="region"
  tabIndex={0}
  aria-label="მრავალწლიანი ცხრილი — ჰორიზონტალურად გადაადგილებადი"
  className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
>
```

Import the shared component into both files. Do not change the chart or table minimum widths.

- [ ] **Step 5: Record the scroll-affordance rule in `DESIGN.md`**

Add to §12: intentionally wide phone charts and tables show the mono instruction `მეტი მონაცემისთვის გადაასრიალე ჰორიზონტალურად`; their scrolling container is keyboard-focusable, visibly focused, and accessibly named.

- [ ] **Step 6: Run focused and shared explorer browser coverage**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts tests/browser/visual-reference.spec.ts
```

Expected: PASS; mobile hints are visible, desktop structure remains intact, and the contained scroll regions do not widen the page.

- [ ] **Step 7: Commit the scroll affordance**

```powershell
git add DESIGN.md apps/web/components/ui/horizontal-scroll-hint.tsx apps/web/components/main-explorer/editorial-line-chart.tsx apps/web/components/main-explorer/explorer-table.tsx apps/web/tests/browser/main-explorer.spec.ts
git commit -m "fix: clarify mobile horizontal scrolling"
```

---

### Task 5: Run the complete mobile acceptance matrix

**Files:**
- Modify only if a regression is found in a file already named by Tasks 1–4.
- Evidence: `apps/web/test-results/` screenshots and Playwright output.

**Interfaces:**
- Consumes: all four completed implementation tasks.
- Produces: verified mobile behavior with repository-wide checks; no new runtime interface.

- [ ] **Step 1: Run lint, type checking, unit tests, and data validation**

From `apps/web`:

```powershell
npm.cmd run check
```

Expected: PASS with zero lint warnings, zero TypeScript errors, all Vitest tests passing, and all data-validation checks passing.

- [ ] **Step 2: Run the full browser suite**

```powershell
npm.cmd run test:browser
```

Expected: PASS. Pay special attention to existing sidebar persistence, slider dragging, chart/table switching, URL restoration, and municipality route coverage.

- [ ] **Step 3: Run the production build**

```powershell
npm.cmd run build
```

Expected: PASS with the static application generated successfully.

- [ ] **Step 4: Capture the local acceptance screenshots**

At 390 × 844, capture:

1. `/explorer/analysis` with the selected year visible.
2. `/explorer/municipalities/04` with the chart controls visible.
3. `/explorer/municipalities/region/kakheti` with the chart controls visible.
4. `/explorer/municipalities/georgia` with the chart controls visible.
5. `/explorer/expenditure` in line mode with the scroll hint and slider visible.
6. `/explorer/expenditure` in table mode with the scroll hint visible.
7. `/explorer/expenditure` with the mobile navigation open.

Repeat the first two screenshots at 320 × 844. For every capture, confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth` and no browser-console errors.

- [ ] **Step 5: Complete manual accessibility checks**

- Keyboard: tab to both range handles, move each with arrow keys, and confirm Home/End behavior.
- Keyboard: open the mobile navigation, press Escape from a link, and confirm focus returns to the toggle.
- Keyboard: focus chart and table scroll regions and confirm horizontal arrow-key scrolling.
- Zoom/reflow: test analysis and Tbilisi at 200% and 400% browser zoom without document-level horizontal scrolling, excluding the intentionally contained chart/table regions.
- Touch emulation: operate the year selector, percentage toggle, sidebar toggle, and both range handles without activating adjacent controls.
- Contrast: measure the mobile hint, chart axes, map legend, breadcrumbs, and focus outlines against their backgrounds; retain existing tokens unless a measured failure requires a separately reviewed token change.

- [ ] **Step 6: Review the original audit route set**

Recheck the 11 audited major pages at 390 × 844. Confirm that landing, hub, municipalities index, methodology hub, methodology article, and series selector remain visually unchanged except for shared controls explicitly covered by this plan.

- [ ] **Step 7: Commit any test-only evidence updates, if tracked**

If the repository tracks updated visual evidence, commit only those expected files:

```powershell
git add apps/web/test-results
git commit -m "test: record mobile responsiveness evidence"
```

If `apps/web/test-results` is ignored or untracked by policy, do not add it and do not create an empty commit.

## Completion criteria

- The analysis year labels never overlap at 320–430 px and the active year is visible on load and after selection.
- Analysis tab groups wrap cleanly with no isolated divider and no document overflow.
- Municipality, region, and Georgia aggregate chart controls remain readable, un-clipped, and operable at 320–430 px.
- Range-slider controls expose at least 30 × 30 px interactive targets while retaining their existing 15 px visual dots.
- The mobile sidebar toggle is 36 × 36 px, exposes `aria-controls`, and preserves Escape/focus behavior.
- Wide charts and tables remain horizontally scrollable inside their containers, include a visible phone instruction, are keyboard-focusable, and never widen the document.
- `npm.cmd run check`, `npm.cmd run test:browser`, and `npm.cmd run build` pass from `apps/web`.
- Fresh screenshots confirm the repaired states and show no regressions on the healthy audited pages.
