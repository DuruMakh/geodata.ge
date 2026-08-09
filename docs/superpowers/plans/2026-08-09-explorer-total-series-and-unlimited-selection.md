# Explorer Total Series and Unlimited Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a selectable official total in every multi-year explorer, add global clear/select-all controls, remove the fixed chart-line cap, and make municipal amounts and shares consistently use the official MoF total.

**Architecture:** Reuse the existing national total items and municipal `publicTotalGel` facts instead of creating balancing records. Keep each explorer's existing state/model boundary, add a direct whole-selection setter for bulk actions, and separate table-total visibility from the total row used as the percentage denominator. Municipal reconciliation fields remain in the data-serving layer, while public explorer warning state and copy are removed.

**Tech Stack:** Next.js 16, React 19, TypeScript strict mode, Vitest, Playwright, Tailwind v4, reviewed CSV-backed municipal facts.

## Global Constraints

- Default selection is the applicable total followed by the existing latest-year top five categories.
- Total labels are exactly `მთლიანი ხარჯი`, `მთლიანი შემოსავლები`, and `მთლიანი ბიუჯეტი` as assigned by scope.
- The total is visually first and ink/black, but can be unchecked like any other series.
- `გასუფთავება` clears the entire selection; when the selection is empty, `ყველას მონიშვნა` selects every series.
- Search filters displayed category rows only; it never scopes either bulk action or the `{selected} / {all}` denominator.
- Every selected series reaches line charts and tables; there is no fixed selection or rendering cap.
- Municipal `მთლიანი ბიუჯეტი` is `publicTotalGel`; every municipal function share uses that official amount as its denominator.
- Municipal functional shares may sum below or above 100%; the official total itself is always 100% in share mode.
- Do not add an Other/residual series and do not render municipal reconciliation warnings or dual-total explanations in an explorer.
- Keep internal municipal reconciliation fields and validation unchanged.
- Record, but do not implement, future explanatory metadata for municipal CSV downloads.
- Do not add routes, facts, schema changes, dependencies, drill-down pages, or unrelated visual refactors.

---

## File Structure

### National explorer model and selector

- `apps/web/lib/explorer/explorerData.ts` — total labels, default total-plus-top-five selection, existing total-series model.
- `apps/web/components/main-explorer/series-panel.tsx` — pinned total row, counter, search behavior, and bulk control.
- `apps/web/components/main-explorer/use-explorer-state.ts` — unrestricted toggles and whole-selection updates.
- `apps/web/components/main-explorer/main-explorer.tsx` — state wiring and selected-series CSV behavior.
- `apps/web/components/main-explorer/explorer-view.tsx` — unrestricted chart rendering and selected table rows.
- `apps/web/components/main-explorer/explorer-table.tsx` — separate total-row visibility from percentage denominator and render the scope-specific total label.
- `apps/web/lib/explorer/types.ts` — remove the obsolete fixed-cap export.

### Municipal model and selector

- `apps/web/lib/explorer/municipalData.ts` — official total row, official share denominator, total-plus-top-five default, official KPI/comparison semantics, no public warning model.
- `apps/web/components/municipalities/use-municipal-state.ts` — unrestricted municipal selection state.
- `apps/web/components/municipalities/municipal-explorer.tsx` — total series, global bulk action, selected table rows, all chart lines, and no warning callout.
- `apps/web/app/explorer/municipalities/page.tsx` — remove dual-total index copy.
- `apps/web/app/explorer/municipalities/[code]/page.tsx` — remove warning prop and dual-total entity copy.
- `apps/web/app/explorer/municipalities/region/[id]/page.tsx` — remove warning prop/comments and dual-total region copy while retaining roll-up caveats.

### Tests and documentation

- `apps/web/tests/explorer/explorerData.test.ts` — national labels/defaults and total points.
- `apps/web/tests/explorer/seriesSelector.test.ts` — pinned total under search.
- `apps/web/tests/explorer/municipalData.test.ts` — official municipal total, source, percentages, defaults, KPIs, and comparisons.
- `apps/web/tests/browser/main-explorer.spec.ts` — national bulk controls, total selection, URL state, CSV, and seven-plus line rendering.
- `apps/web/tests/browser/municipal-entity.spec.ts` — municipal total, percentage behavior, bulk controls, unlimited lines, CSV, and warning absence.
- `apps/web/tests/browser/municipal-region.spec.ts` — generic source note and warning absence on roll-ups.
- `AGENTS.md`, `DESIGN.md` — update durable defaults and visual/interaction contract.
- `docs/data-methodology/municipal-functional-annual-2015-2025.md` — canonical explanation of official totals and non-reconciling function shares.
- `docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md`, `docs/superpowers/specs/2026-08-03-municipalities-ui-design.md` — remove superseded downstream UI rules.
- `docs/superpowers/plans/2026-08-03-municipalities-ui.md`, `docs/superpowers/plans/2026-08-06-municipalities-review-remediation.md` — remove obsolete cap/warning instructions and examples.

---

### Task 1: National total labels, defaults, and pinned panel row

**Files:**
- Modify: `apps/web/lib/explorer/explorerData.ts:19-242`
- Modify: `apps/web/components/main-explorer/series-panel.tsx:14-64`
- Test: `apps/web/tests/explorer/explorerData.test.ts:109-178`
- Test: `apps/web/tests/explorer/seriesSelector.test.ts`
- Test: `apps/web/tests/explorer/integration.test.ts:22-102,228-258`

**Interfaces:**
- Consumes: existing total IDs `expenditure.total`, `revenue.total`, and `admin_spending.total`.
- Produces: `getDefaultSelection(...): string[]` returning total first, and `buildSeriesPanelRows(...): SeriesPanelRow[]` returning the total first even while search is active.

- [ ] **Step 1: Change unit tests to require the approved labels and total-plus-top-five defaults**

Replace the old default-selection and label expectations with:

```ts
it("prepends the total to the latest-year top categories", () => {
  expect(getDefaultSelection("expenditure", facts)).toEqual([
    "expenditure.total",
    "spending.education",
    "spending.health",
  ]);
  expect(getDefaultSelection("revenue", facts)).toEqual(["revenue.total", "revenue.vat"]);
  expect(getDefaultSelection("expenditure", facts, "ministries", adminFacts)).toEqual([
    "admin_spending.total",
    "admin_spending.health_social_affairs",
    "admin_spending.education_science_youth",
  ]);
  expect(getDefaultSelection("expenditure", facts, "ministries", [])).toEqual([]);
});

expect(expenditureModel.items.find((item) => item.id === "expenditure.total")?.kaLabel).toBe("მთლიანი ხარჯი");
expect(revenueModel.items.find((item) => item.id === "revenue.total")?.kaLabel).toBe("მთლიანი შემოსავლები");
expect(ministryModel.items.find((item) => item.id === "admin_spending.total")?.kaLabel).toBe("მთლიანი ხარჯი");
```

Update the series-row tests so the total is permanently first:

```ts
it("pins the total before categories and collapsed programs", () => {
  const rows = buildSeriesPanelRows(items, "", []);
  expect(rows.map((row) => row.item.id)).toEqual([
    "admin_spending.total",
    "admin_spending.education",
    "admin_spending.health",
  ]);
  expect(rows[0]).toEqual(expect.objectContaining({ isProgram: false, hasChildren: false }));
});

it("keeps the total first while search filters categories", () => {
  expect(buildSeriesPanelRows(items, "health", []).map((row) => row.item.id)).toEqual([
    "admin_spending.total",
    "admin_spending.health",
  ]);
  expect(buildSeriesPanelRows(items, "does-not-exist", []).map((row) => row.item.id)).toEqual([
    "admin_spending.total",
  ]);
});
```

Update real-data integration expectations so expenditure, revenue, and ministries each have six defaults when five categories exist, with the relevant total at index 0:

```ts
expect(selectedItemIds).toHaveLength(6);
expect(selectedItemIds[0]).toBe("revenue.total");

// In the separate ministries test, use that test's existing selectedItemIds variable:
expect(selectedItemIds).toHaveLength(6);
expect(selectedItemIds[0]).toBe("admin_spending.total");
```

For smaller sample fixtures, assert `selectedItemIds.length <= 6` and the applicable total at index 0 instead of excluding it. Also assert each total item's color is `#1E1B16`.

- [ ] **Step 2: Run the focused tests and verify the old behavior fails**

Run from `apps/web`:

```powershell
npm.cmd test -- tests/explorer/explorerData.test.ts tests/explorer/seriesSelector.test.ts tests/explorer/integration.test.ts
```

Expected: FAIL because defaults omit totals, labels use the old `... სულ` copy, and search filters the total out.

- [ ] **Step 3: Implement labels and default selection in the national model**

Use the existing IDs and preserve the five-category ranking:

```ts
function labelsFor(id: string, side: ExplorerSide, glossary: Map<string, GlossaryEntry>) {
  if (id === totalIdFor(side)) {
    return side === "revenue"
      ? { kaLabel: "მთლიანი შემოსავლები", enLabel: "Total revenue" }
      : { kaLabel: "მთლიანი ხარჯი", enLabel: "Total expenditure" };
  }
  // existing glossary fallback stays unchanged
}

const totalId =
  side === "revenue"
    ? "revenue.total"
    : expenditureGrouping === "ministries"
      ? ADMIN_SPENDING_TOTAL_ID
      : "expenditure.total";

const categories = Array.from(amountsByItem.entries())
  .filter(([, entry]) => entry.year === latestYear)
  .sort((a, b) => b[1].amountGel - a[1].amountGel)
  .slice(0, DEFAULT_SELECTION_SIZE)
  .map(([itemId]) => itemId);

return categories.length === 0 ? [] : [totalId, ...categories];
```

- [ ] **Step 4: Keep the total outside category search filtering**

Build the total row before the existing category/program loop:

```ts
const total = items.find((item) => item.level === "total");
const selectable = items.filter((item) => item.level !== "total");
const categories = selectable.filter((item) => item.level !== "major_program");
const rows: SeriesPanelRow[] = total
  ? [{ item: total, isProgram: false, hasChildren: false, expanded: false, caretLocked: false }]
  : [];
```

Remove the derived-total filter import from `series-panel.tsx`; keep the existing ministry hierarchy and search logic for non-total rows.

- [ ] **Step 5: Run the focused tests and commit**

```powershell
npm.cmd test -- tests/explorer/explorerData.test.ts tests/explorer/seriesSelector.test.ts tests/explorer/integration.test.ts
git add lib/explorer/explorerData.ts components/main-explorer/series-panel.tsx tests/explorer/explorerData.test.ts tests/explorer/seriesSelector.test.ts tests/explorer/integration.test.ts
git commit -m "feat(explorer): restore selectable total defaults"
```

Expected: PASS.

---

### Task 2: National selector counter and global bulk actions

**Files:**
- Modify: `apps/web/components/main-explorer/use-explorer-state.ts`
- Modify: `apps/web/components/main-explorer/series-panel.tsx:66-145`
- Modify: `apps/web/components/main-explorer/explorer-view.tsx:17-81,197-213`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx:45-70,240-270`
- Test: `apps/web/tests/browser/main-explorer.spec.ts:45-105`

**Interfaces:**
- Consumes: the total-first `model.items` and default selection from Task 1.
- Produces: `setSelectedSeries(nextSelectedIds: string[]): void` from `useExplorerState`, passed to `SeriesPanel` as `onSelectionChange`.

- [ ] **Step 1: Add a browser test for the counter and search-independent bulk action**

Add:

```ts
test("series header clears and selects every series independently of search", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const bulk = panel.getByTestId("series-toggle-all");
  const seriesButtons = panel.locator("button[title]");

  await expect(panel.locator('[data-level="total"]').first()).toContainText("მთლიანი ხარჯი");
  await expect(panel).toContainText(/სერიები\s*6 \/ \d+/);
  await expect(bulk).toHaveText("გასუფთავება");

  await bulk.click();
  await expect(panel.locator('button[title][aria-pressed="true"]')).toHaveCount(0);
  await expect(bulk).toHaveText("ყველას მონიშვნა");

  await panel.getByTestId("series-search").fill("ჯანმრთელობა");
  await bulk.click();
  await panel.getByTestId("series-search").fill("");

  const allCount = await seriesButtons.count();
  await expect(panel.locator('button[title][aria-pressed="true"]')).toHaveCount(allCount);
});
```

- [ ] **Step 2: Run the test and verify the bulk control is missing**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "series header clears"
```

Expected: FAIL because `series-toggle-all` does not exist.

- [ ] **Step 3: Replace limit state with an unrestricted whole-selection setter**

In `use-explorer-state.ts`, remove the fixed-cap import, message state, blocking branch, and message resets. Keep functional state updates:

```ts
function toggleSeries(itemId: string) {
  setSelections((existing) => {
    const fresh = existing[scope] ?? defaultSelections[scope];
    return {
      ...existing,
      [scope]: fresh.includes(itemId) ? fresh.filter((id) => id !== itemId) : [...fresh, itemId],
    };
  });
}

function setSelectedSeries(nextSelectedIds: string[]) {
  setSelections((existing) => ({ ...existing, [scope]: nextSelectedIds }));
}
```

Return `setSelectedSeries`; remove `limitMessage` from the returned object.

- [ ] **Step 4: Add the selector header action**

Remove `chartMode` and `limitMessage` from `SeriesPanelProps`. Add:

```ts
onSelectionChange: (itemIds: string[]) => void;
```

Then render the approved header:

```tsx
const selectableIds = items.map((item) => item.id);
const hasSelection = selectedIds.length > 0;

<div className="flex items-baseline justify-between gap-3 border-b-2 border-[var(--ink)] pb-2.5">
  <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink)]">
    სერიები{" "}
    <span className="font-[family-name:var(--font-numeric)] font-medium text-[var(--muted)]">
      {selectedIds.length} / {selectableIds.length}
    </span>
  </h2>
  <button
    type="button"
    data-testid="series-toggle-all"
    onClick={() => onSelectionChange(hasSelection ? [] : selectableIds)}
    className="cursor-pointer text-[11px] font-medium text-[var(--accent)] underline underline-offset-4"
  >
    {hasSelection ? "გასუფთავება" : "ყველას მონიშვნა"}
  </button>
</div>
```

Delete the old count span, limit callout, and related `Callout` import only if no longer used in this component.

- [ ] **Step 5: Wire whole-selection updates through the parent components**

Destructure `setSelectedSeries` in `main-explorer.tsx`, add `onSelectionChange` to `ExplorerViewProps`, and pass it unchanged to `SeriesPanel`:

```tsx
<SeriesPanel
  items={model.items}
  rows={model.totalRow ? [model.totalRow, ...model.comparisonRows] : model.comparisonRows}
  selectedIds={selectedIds}
  onSelectionChange={onSelectionChange}
  // existing grouping, expansion, toggle, and CSV props remain
/>
```

- [ ] **Step 6: Run the browser test and commit**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "series header clears"
git add components/main-explorer/use-explorer-state.ts components/main-explorer/series-panel.tsx components/main-explorer/explorer-view.tsx components/main-explorer/main-explorer.tsx tests/browser/main-explorer.spec.ts
git commit -m "feat(explorer): add global series bulk controls"
```

Expected: PASS; selecting all while search is active selects the full unfiltered item list.

---

### Task 3: Unlimited national lines and selection-aware total table row

**Files:**
- Modify: `apps/web/lib/explorer/types.ts:1-20`
- Modify: `apps/web/components/main-explorer/explorer-view.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Test: `apps/web/tests/browser/main-explorer.spec.ts:77-105,234-319`

**Interfaces:**
- Consumes: unrestricted selection state from Task 2.
- Produces: `ExplorerTable` prop `showTotal: boolean`, while `totalRow` remains the denominator even when hidden.

- [ ] **Step 1: Replace the cap browser test with unrestricted rendering and selected-total behavior**

Use the existing eight known expenditure IDs:

```ts
test("line mode renders every series from a large shared selection", async ({ page }) => {
  const ids = [
    "spending.social_protection",
    "spending.health",
    "spending.education",
    "spending.defence",
    "spending.public_order_safety",
    "spending.economic_affairs",
    "spending.culture",
    "spending.sport",
  ];

  await page.goto(`http://localhost:3100/explorer/expenditure#m=line&sel=${ids.join(",")}`);
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByTestId("series-overflow-callout")).toHaveCount(0);
  await expect(page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']")).toHaveCount(ids.length);
});

test("unchecking the total hides its table row without breaking share denominators", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/revenue");
  await expectAppReady(page);
  await page.getByTestId("chart-mode-table").click();
  await page.getByTestId("measure-share-toggle").click();

  const totalButton = page.getByTestId("series-selector").getByTitle("მთლიანი შემოსავლები");
  await totalButton.click();

  await expect(page.getByTestId("explorer-table")).not.toContainText("მთლიანი შემოსავლები");
  await expect(page.getByTestId("explorer-table").locator("tbody tr").first()).toContainText("%");
});
```

Update the existing URL round-trip fixture to load `sel=revenue.total,revenue.vat`, then assert the `მთლიანი შემოსავლები` button is pressed after reload. Update the default/table/CSV assertions to expect `მთლიანი ხარჯი` and an exported `expenditure.total` row when the default total remains selected.

- [ ] **Step 2: Run the focused browser tests and verify truncation and permanent table total fail**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "large shared selection|unchecking the total|CSV download"
```

Expected: FAIL because the chart truncates, the overflow callout appears, and the table always appends its total row.

- [ ] **Step 3: Separate table denominator from total-row visibility**

Add a required prop and use the row's own label:

```ts
type ExplorerTableProps = {
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow | null;
  showTotal: boolean;
  years: number[];
  firstColumnLabel: string;
  unit: ValueUnit;
  share: boolean;
};
```

Keep `totalsByYear` based on `totalRow`, but gate only the rendered footer row:

```tsx
{showTotal && totalRow ? (
  <tr className="border-t-2 border-[var(--ink)]">
    <td /* existing classes */>{totalRow.kaLabel}</td>
    {/* existing year, change, and 100% cells */}
  </tr>
) : null}
```

- [ ] **Step 4: Render the entire national selection**

Delete the fixed-cap export from `types.ts`. In `explorer-view.tsx`, remove slicing, overflow state, and overflow callout. Pass all `series` directly:

```tsx
<EditorialLineChart years={model.years} series={series} share={share} unit={UNIT_BN} />
```

For table mode, avoid duplicating the selected total and keep the denominator available:

```tsx
<ExplorerTable
  rows={model.tableRows.filter((row) => row.level !== "total")}
  totalRow={model.totalRow}
  showTotal={Boolean(model.totalRow && selectedIds.includes(model.totalRow.itemId))}
  years={model.years}
  firstColumnLabel={FIRST_COL_LABEL[scope]}
  unit={UNIT_BN}
  share={share}
/>
```

Remove all cap-only props/imports and stale comments from the national component chain.

- [ ] **Step 5: Run national unit/browser tests and commit**

```powershell
npm.cmd test -- tests/explorer/explorerData.test.ts tests/explorer/seriesSelector.test.ts tests/explorer/integration.test.ts
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts
git add lib/explorer/types.ts components/main-explorer/explorer-view.tsx components/main-explorer/explorer-table.tsx components/main-explorer/main-explorer.tsx tests/browser/main-explorer.spec.ts
git commit -m "feat(explorer): render unlimited selected series"
```

Expected: PASS with every shared series rendered, no overflow callout, and a removable total table row.

---

### Task 4: Official municipal total model and percentage denominator

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts:1-314,404-560`
- Test: `apps/web/tests/explorer/municipalData.test.ts:94-235,630-840`

**Interfaces:**
- Consumes: `MunicipalTotalFact.publicTotalGel` and its `sourceId`.
- Produces: `MunicipalEntityModel = { years, rows, totalRow }`, with `totalRow` official and function `shareEndYear` values divided by that row.

- [ ] **Step 1: Rewrite municipal model tests around the official total**

Replace the dual-public-total and warning-model expectations with:

```ts
it("uses the official MoF total as the public total row", () => {
  const model = build();
  expect(model.totalRow.itemId).toBe("municipal.total");
  expect(model.totalRow.kaLabel).toBe("მთლიანი ბიუჯეტი");
  expect(model.totalRow.valuesByYear[2016]).toBe(300);
  expect(model.totalRow.shareEndYear).toBe(1);
});

it("keeps function values unchanged and divides their shares by the official total", () => {
  const model = build(2016, 2016);
  const economic = model.rows.find((row) => row.itemId === "municipal.economic_affairs")!;
  const shareSum = model.rows.reduce((sum, row) => sum + (row.shareEndYear ?? 0), 0);

  expect(economic.valuesByYear[2016]).toBe(200);
  expect(economic.shareEndYear).toBeCloseTo(200 / 300, 6);
  expect(shareSum).toBeCloseTo(265 / 300, 6);
  expect(shareSum).not.toBeCloseTo(1, 6);
});

it("defaults to the total followed by latest-year functions", () => {
  expect(getDefaultMunicipalSelection(build())).toEqual([
    "municipal.total",
    "municipal.economic_affairs",
    "municipal.education",
    "municipal.health",
  ]);
});
```

Change source attribution to require the official-total source in 2016/2017. Change entity KPI expectations to official growth `+88%` for 160→300 and largest-function share `66.7%` for 200/300. Add an index KPI fixture whose largest function is 200 against an official total of 300 and expect `66.7%`, not normalization to the function sum.

- [ ] **Step 2: Run the municipal model test and verify the functional-total behavior fails**

```powershell
npm.cmd test -- tests/explorer/municipalData.test.ts
```

Expected: FAIL because `totalRow` is 265 in 2016, warning fields remain public model state, and function/KPI shares normalize to the functional sum.

- [ ] **Step 3: Build the official municipal total row**

Remove `MunicipalWarning` and warning collection from `MunicipalEntityModel`; do not alter warning fields in imported data types or validation.

Within `buildMunicipalEntityModel`, aggregate official totals and their sources:

```ts
const officialTotalByYear: Record<number, number> = {};
const officialSourceIdByYear = new Map<number, string>();

for (const row of totalFacts) {
  if (!inRange.has(row.year)) continue;
  officialTotalByYear[row.year] = (officialTotalByYear[row.year] ?? 0) + row.publicTotalGel;
  const currentSourceId = officialSourceIdByYear.get(row.year);
  officialSourceIdByYear.set(
    row.year,
    currentSourceId === undefined ? row.sourceId : agreeOrMixed(currentSourceId, row.sourceId, MIXED_SOURCE_ID),
  );
}
```

Use `officialTotalByYear[lastYear]` for every function's `shareEndYear`. Populate `totalValuesByYear` from `officialTotalByYear`, source it from `officialSourceIdByYear`, label it `მთლიანი ბიუჯეტი`, and return only `{ years, rows, totalRow }`.

- [ ] **Step 4: Make defaults and KPIs consistently official**

Default selection:

```ts
return [
  model.totalRow.itemId,
  ...model.rows
    .slice()
    .sort((left, right) => (right.valuesByYear[lastYear] ?? 0) - (left.valuesByYear[lastYear] ?? 0))
    .slice(0, 5)
    .map((row) => row.itemId),
];
```

Entity KPIs:

```ts
const officialStart = startYear === undefined ? null : model.totalRow.valuesByYear[startYear] ?? null;
const officialEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
const growth = changeBetween(officialStart, officialEnd);

// KPI 0 value: formatAmount(officialEnd)
// KPI 1 detail: `${formatAmount(officialStart)} → ${formatAmount(officialEnd)}`
// largest-function share: officialEnd ? formatShare(largestValue / officialEnd) : MISSING
```

In `buildIndexKpis`, divide the top function by `latestTotal`, not by the sum of functions. Keep the function values unchanged.

- [ ] **Step 5: Run the municipal model tests and commit**

```powershell
npm.cmd test -- tests/explorer/municipalData.test.ts
git add lib/explorer/municipalData.ts tests/explorer/municipalData.test.ts
git commit -m "fix(municipalities): use official totals throughout explorer model"
```

Expected: PASS; the divergent fixture proves function shares need not sum to 100%.

---

### Task 5: Municipal total series, global bulk controls, unlimited lines, and clean copy

**Files:**
- Modify: `apps/web/components/municipalities/use-municipal-state.ts`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Test: `apps/web/tests/browser/municipal-entity.spec.ts`
- Test: `apps/web/tests/browser/municipal-region.spec.ts`

**Interfaces:**
- Consumes: official `model.totalRow` and total-inclusive defaults from Task 4; `ExplorerTable.showTotal` from Task 3.
- Produces: a total-first 11-row selector, unrestricted chart/table selection, and explorer pages with generic source notes only.

- [ ] **Step 1: Replace municipal cap/warning browser coverage with the approved public behavior**

Use `municipal.total` plus the existing `ALL_FUNCTIONS` list:

```ts
test("renders the official total and every selected municipal line", async ({ page }) => {
  const selection = `municipal.total,${ALL_FUNCTIONS}`;
  await page.goto(`${ENTITY_URL}#m=line&sel=${selection}`);
  await page.reload();
  await expectMunicipalAppReady(page);

  await expect(page.getByTestId("municipal-series-row").first()).toContainText("მთლიანი ბიუჯეტი");
  await expect(page.locator("[data-testid='municipal-series-row'][aria-pressed='true']")).toHaveCount(11);
  await expect(page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']")).toHaveCount(11);
  await expect(page.getByTestId("series-overflow-callout")).toHaveCount(0);
});

test("bulk actions ignore the active municipal search", async ({ page }) => {
  await page.goto(ENTITY_URL);
  await expectMunicipalAppReady(page);
  const bulk = page.getByTestId("municipal-series-all");

  await expect(page.getByTestId("municipal-workspace")).toContainText("სერიები 6 / 11");
  await expect(bulk).toHaveText("გასუფთავება");
  await bulk.click();
  await expect(bulk).toHaveText("ყველას მონიშვნა");

  await page.getByTestId("municipal-series-search").fill("განათლება");
  await expect(page.getByTestId("municipal-series-row")).toHaveCount(2); // pinned total + matching function
  await bulk.click();
  await page.getByTestId("municipal-series-search").fill("");
  await expect(page.locator("[data-testid='municipal-series-row'][aria-pressed='true']")).toHaveCount(11);
});
```

Add an official amount/share test for Tbilisi 2016 and 2024:

```ts
test("uses the official municipal total as 100% without normalizing functions", async ({ page }) => {
  const selection = `municipal.total,${ALL_FUNCTIONS}`;
  await page.goto(`${ENTITY_URL}#m=table&sh=1&r=2024-2024&sel=${selection}`);
  await page.reload();
  await expectMunicipalAppReady(page);

  const rows = page.getByTestId("explorer-table").locator("tbody tr");
  await expect(rows.last()).toContainText("მთლიანი ბიუჯეტი");
  await expect(rows.last()).toContainText("100.0%");

  const shares = await rows.locator("td:last-child").allTextContents();
  const functionalSum = shares
    .slice(0, -1)
    .reduce((sum, value) => sum + Number.parseFloat(value.replace("%", "")), 0);
  expect(functionalSum).not.toBeCloseTo(100, 1);
});
```

Replace the warning-presence test with assertions that Tbilisi and a region have no `divergence-callout`, and that source notes do not contain `ორი განსხვავებული საზომია`. Change the empty table-selection expectation to zero body rows. Extend the CSV download test to decode the file and assert its 2016 `municipal.total` row contains the official Tbilisi amount `832409547.15`, not the functional sum `848041009.16`; do not add narrative metadata.

- [ ] **Step 2: Run focused browser tests and verify the old selector/warning behavior fails**

```powershell
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts
```

Expected: FAIL because the total is absent from selection, lines truncate, search scopes the old select-all behavior, the table always shows all functions, and Tbilisi renders a warning.

- [ ] **Step 3: Remove cap state from the municipal hook**

Keep URL parsing, range normalization, and unrestricted toggles:

```ts
function toggleSeries(itemId: string) {
  setSelectedIds((current) =>
    current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
  );
}

return {
  chartMode,
  setChartMode,
  share,
  setShare,
  range: { start, end, min, max },
  setRange,
  selectedIds,
  toggleSeries,
  setSelectedIds,
};
```

Remove only state and imports that supported the old cap; preserve hash semantics.

- [ ] **Step 4: Make the municipal total a first-class selectable row**

In `municipal-explorer.tsx`:

```ts
const knownIds = useMemo(
  () => new Set([fullModel.totalRow.itemId, ...fullModel.rows.map((row) => row.itemId)]),
  [fullModel],
);

const selectableRows = useMemo(() => [model.totalRow, ...model.rows], [model]);
const series = selectableRows
  .filter((row) => state.selectedIds.includes(row.itemId))
  .map((row) => ({
    id: row.itemId,
    label: row.kaLabel,
    color: row.color,
    vals: years.map((year) => {
      const value = row.valuesByYear[year] ?? null;
      const total = model.totalRow.valuesByYear[year] ?? null;
      return !state.share ? value : value === null || !total ? null : (value / total) * 100;
    }),
    planned: years.map(() => false),
  }));
```

Pass `series` directly to `EditorialLineChart`.

- [ ] **Step 5: Scope the municipal table and bulk controls to the whole selection**

Table call:

```tsx
<ExplorerTable
  rows={model.rows.filter((row) => state.selectedIds.includes(row.itemId))}
  totalRow={model.totalRow}
  showTotal={state.selectedIds.includes(model.totalRow.itemId)}
  years={years}
  firstColumnLabel="ფუნქცია"
  unit={UNIT_MLN}
  share={state.share}
/>
```

Pinned search row and global bulk action:

```ts
const visibleRows = useMemo(() => {
  const needle = seriesQuery.trim();
  const functions = needle === "" ? model.rows : model.rows.filter((row) => row.kaLabel.includes(needle));
  return [model.totalRow, ...functions];
}, [model.rows, model.totalRow, seriesQuery]);

const allSelected = selectableRows.every((row) => state.selectedIds.includes(row.itemId));
const hasSelection = state.selectedIds.length > 0;

function toggleAll() {
  state.setSelectedIds(hasSelection ? [] : selectableRows.map((row) => row.itemId));
}
```

Render `სერიები {selected} / {selectableRows.length}` and label the button from `hasSelection`, not chart mode or filtered rows. Keep `aria-pressed={allSelected}`.

- [ ] **Step 6: Remove public warning state and dual-total explorer copy**

Delete `WARNING_TEXT`, `MunicipalWarning`, `showWarnings`, warning grouping, and the divergence callout from `municipal-explorer.tsx`. Use this unit note:

```tsx
{state.share ? "წილი მთლიან ბიუჯეტში, %" : "მთლიანი ბიუჯეტი · მლნ ₾"}
```

Remove `showWarnings` from both page call sites. Keep only generic MoF source/update copy on municipality and index pages. On region pages, retain the existing autonomous-republic and occupied-territory roll-up caveats, but remove the two-total sentence and warning-suppression comments.

- [ ] **Step 7: Run municipal tests and commit**

```powershell
npm.cmd test -- tests/explorer/municipalData.test.ts
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts
git add components/municipalities/use-municipal-state.ts components/municipalities/municipal-explorer.tsx app/explorer/municipalities/page.tsx 'app/explorer/municipalities/[code]/page.tsx' 'app/explorer/municipalities/region/[id]/page.tsx' tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts
git commit -m "feat(municipalities): show official total as selectable series"
```

Expected: PASS with 11 selectable municipal rows, all 11 chart lines, official total percentages, and no public reconciliation callout.

---

### Task 6: Canonical methodology and removal of superseded product rules

**Files:**
- Modify: `AGENTS.md:165-172`
- Modify: `DESIGN.md:465-486,565-579,683-700,717-727`
- Modify: `docs/data-methodology/municipal-functional-annual-2015-2025.md:194-241`
- Modify: `docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md:172-189`
- Modify: `docs/superpowers/specs/2026-08-03-municipalities-ui-design.md:301-320,405-439,571-579`
- Modify: `docs/superpowers/plans/2026-08-03-municipalities-ui.md`
- Modify: `docs/superpowers/plans/2026-08-06-municipalities-review-remediation.md`

**Interfaces:**
- Consumes: the implemented behavior from Tasks 1-5 and the approved design spec.
- Produces: one maintained product contract with no obsolete fixed-cap, nonselectable-total, functional-public-total, or explorer-warning instruction.

- [ ] **Step 1: Capture the stale-rule search before editing**

From the repository root, run a targeted search for the old exported cap symbol, numeric cap copy, nonselectable-total rules, warning callouts, and the two-measures source sentence. The command must report the currently known matches in `AGENTS.md`, `DESIGN.md`, the two older municipal specs/plans, the remediation plan, and public explorer code/tests.

- [ ] **Step 2: Update durable UX documentation**

Replace the explorer default in `AGENTS.md` and `DESIGN.md` with:

```markdown
- Total plus the top 5 categories by latest-year value selected; the total is first, ink-coloured, selectable, and removable.
- Series selection is unlimited. The header shows `სერიები {selected} / {all}` and switches between `გასუფთავება` and `ყველას მონიშვნა`; search never scopes the bulk action.
```

Update the design QA checklist to require total-plus-top-five defaults and unrestricted line rendering. Remove fixed-cap error copy.

Replace the municipal-surface rule with:

```markdown
**One public total.** `მთლიანი ბიუჯეტი` uses `public_total_gel` in the selector, chart, table, KPIs, comparisons, percentage denominator, and numeric CSV total row. The ten functions remain unchanged; their shares can sum below or above 100%. No residual category or reconciliation warning appears in the explorer. The methodology document explains the source-version and financing differences.
```

- [ ] **Step 3: Rewrite the municipal methodology public-display section**

Keep the source inventory and internal reconciliation fields, then state:

```markdown
## Public-display and percentage rule

The public interface uses `public_total_gel` as `მთლიანი ბიუჯეტი` for every year and entity. That row is 100% in share mode. Each of the ten unchanged functional rows is divided by `public_total_gel`, so the functional percentages are not normalized and may sum below or above 100%.

For 2016-2019, the official total and functional rows may come from different archived MoF publication versions. For later years, total payments may include financial-asset growth and liability decrease that are not distributed across the ten functions. No category is adjusted and no residual series is created.

Reconciliation fields and warning types remain internal quality-control data. The explorer does not render a warning. A future municipal CSV enhancement should carry this explanation as metadata; that narrative CSV enhancement is deferred.
```

Retain the counts of internal warning classifications as validation evidence, clearly labelled internal rather than public UI behavior.

- [ ] **Step 4: Remove superseded instructions from older specs and plans**

In the 2026-08-02 serving spec, keep the two stored fields but state that downstream UI totals use `public_total_gel` and functional sums remain reconciliation data.

In the 2026-08-03 UI spec and plan:

- replace the old selector default with total plus top five;
- replace all cap imports/checks/slices/callouts/tests with unrestricted selection/rendering;
- replace functional public total/table/CSV instructions with official-total instructions;
- remove `showWarnings`, divergence-callout examples, and standing dual-total source-note requirements;
- preserve internal warning fields and region roll-up caveats.

In the 2026-08-06 remediation plan, replace the sliced chart example with `const chartSeries = series;` and remove overflow-callout instructions.

- [ ] **Step 5: Verify no obsolete normative rule remains and commit**

Run repository searches excluding raw source archives and static visual-reference HTML. Expected results:

- no old fixed-cap export or numeric cap copy;
- no instruction that totals are nonselectable;
- no `showWarnings` or old warning-callout test-ID usage in application code or tests, and no spec/plan instructs an explorer to render that warning;
- no instruction that the public municipal chart/table/CSV total is `functional_sum_gel`;
- dual-total/source-version/financing explanations remain only in the methodology and the approved 2026-08-09 design/specification context, not explorer copy.

Then run:

```powershell
git diff --check
git add AGENTS.md DESIGN.md docs/data-methodology/municipal-functional-annual-2015-2025.md docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md docs/superpowers/specs/2026-08-03-municipalities-ui-design.md docs/superpowers/plans/2026-08-03-municipalities-ui.md docs/superpowers/plans/2026-08-06-municipalities-review-remediation.md
git commit -m "docs: align explorer totals and selection methodology"
```

Expected: clean diff check and no stale normative matches.

---

### Task 7: Full verification and implementation review

**Files:**
- Review: every file changed in Tasks 1-6

**Interfaces:**
- Consumes: all completed implementation tasks.
- Produces: verified feature branch ready for code review and, if authorized, GitHub delivery.

- [ ] **Step 1: Run focused unit tests together**

```powershell
cd apps/web
npm.cmd test -- tests/explorer/explorerData.test.ts tests/explorer/seriesSelector.test.ts tests/explorer/integration.test.ts tests/explorer/municipalData.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the required non-browser gate**

```powershell
npm.cmd run check
```

Expected: lint, strict typecheck, unit tests, and data validation all PASS.

- [ ] **Step 3: Run the production build**

```powershell
npm.cmd run build
```

Expected: static production build PASS in CSV fallback mode.

- [ ] **Step 4: Run all browser tests**

```powershell
npm.cmd run test:browser
```

Expected: all Playwright tests PASS. If Windows prints all passes but hangs during teardown, record it as functionally green but not a clean command exit and rely on hosted CI as the release gate.

- [ ] **Step 5: Perform a surgical diff review**

```powershell
cd ../..
git diff --check
git status --short
git diff origin/main...HEAD --stat
```

Confirm:

- every changed line maps to the approved spec;
- no new facts, schema, dependency, route, residual series, or CSV narrative metadata was added;
- total rows remain first and removable;
- percentage denominators remain available when total rows are hidden;
- internal municipal reconciliation data was not deleted;
- no cap-only or warning-only production code remains.

- [ ] **Step 6: Request code review before delivery**

Use `superpowers:requesting-code-review` against `origin/main...HEAD`, address findings with the required review workflow, rerun affected verification, and commit only verified corrections. Do not push or open a PR unless GitHub delivery is authorized.
