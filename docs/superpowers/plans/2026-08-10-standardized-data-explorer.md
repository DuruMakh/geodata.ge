# Standardized Data Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing national and municipal multi-year explorers use one compact shared series selector and default every scope to its total series only, while leaving CSV and dataset business models unchanged.

**Architecture:** Keep the existing national and municipal state/model layers and the already-shared chart, table, range, formatting, and editorial primitives. Add a small presentational `SeriesSelector`/`SeriesSelectorRow` boundary under `components/main-explorer/`; the national hierarchy adapter and municipal flat adapter prepare rows and callbacks for it. CSV remains rendered by each current caller after the shared selector.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind v4, Vitest, Playwright.

---

## File map

### New file

- `apps/web/components/main-explorer/series-selector.tsx` — shared selector shell, search/action/status anatomy, empty-search message, and shared row presentation.

### Application files to modify

- `apps/web/components/main-explorer/series-panel.tsx` — retain national hierarchy/search preparation; render the shared selector and rows.
- `apps/web/components/municipalities/municipal-explorer.tsx` — retain municipal flat-row preparation and CSV; replace duplicated selector markup with the shared selector and rows.
- `apps/web/lib/explorer/explorerData.ts` — simplify national default selection to the applicable total only.
- `apps/web/lib/explorer/municipalData.ts` — simplify municipal default selection to the official total only.

### Tests to modify

- `apps/web/tests/explorer/explorerData.test.ts` — national total-only defaults.
- `apps/web/tests/explorer/integration.test.ts` — real-data total-only defaults.
- `apps/web/tests/explorer/municipalData.test.ts` — municipal total-only default.
- `apps/web/tests/browser/main-explorer.spec.ts` — standardized national selector order, alignment, persistent swatches, two-line labels, and total-only first view.
- `apps/web/tests/browser/municipal-entity.spec.ts` — shared selector test IDs/anatomy, municipal total-only first view, global bulk action, and unchanged CSV behavior.

### Maintained documentation to modify

- `DESIGN.md` — selector anatomy, row treatment, total-only default, layout sequence, and QA checklist.
- `AGENTS.md` — durable total-only default and standardized selector rules.
- `docs/superpowers/specs/2026-08-09-explorer-total-series-and-unlimited-selection-design.md` — supersedure note pointing to the 2026-08-10 design for default and selector anatomy.
- `docs/superpowers/specs/2026-08-03-municipalities-ui-design.md` — supersedure note for the municipal default and selector implementation boundary.
- `docs/superpowers/plans/2026-08-09-explorer-total-series-and-unlimited-selection.md` — supersedure note so the completed historical plan is not read as the current default/layout contract.

### Files deliberately unchanged

- `apps/web/components/main-explorer/editorial-line-chart.tsx`
- `apps/web/components/main-explorer/explorer-table.tsx`
- `apps/web/components/main-explorer/range-strip.tsx`
- `apps/web/components/main-explorer/use-explorer-state.ts`
- `apps/web/components/municipalities/use-municipal-state.ts`
- `apps/web/lib/explorer/urlState.ts`
- `apps/web/lib/explorer/csvExport.ts`
- all reviewed facts, taxonomy files, Prisma files, routes, and database/import code.

---

### Task 1: Change every default selection to the total only

**Files:**
- Modify: `apps/web/tests/explorer/explorerData.test.ts:109-119`
- Modify: `apps/web/tests/explorer/integration.test.ts:22-68, 86-105, 238-247`
- Modify: `apps/web/tests/explorer/municipalData.test.ts:154-194`
- Modify: `apps/web/lib/explorer/explorerData.ts:20, 208-248`
- Modify: `apps/web/lib/explorer/municipalData.ts:272-287`

- [ ] **Step 1: Change the focused unit tests to require total-only defaults**

Replace the national default-selection test with:

```ts
it("defaults each populated scope to only its total", () => {
  expect(getDefaultSelection("expenditure", facts)).toEqual(["expenditure.total"]);
  expect(getDefaultSelection("revenue", facts)).toEqual(["revenue.total"]);
  expect(getDefaultSelection("expenditure", facts, "ministries", adminFacts)).toEqual([
    "admin_spending.total",
  ]);
  expect(getDefaultSelection("expenditure", facts, "ministries", [])).toEqual([]);
});
```

Replace the municipal default-selection describe block with:

```ts
describe("getDefaultMunicipalSelection", () => {
  it("defaults a populated municipal model to only its official total", () => {
    expect(getDefaultMunicipalSelection(build())).toEqual(["municipal.total"]);
  });
});
```

In `integration.test.ts`, replace length/cap assertions with exact totals:

```ts
expect(getDefaultSelection("expenditure", facts)).toEqual(["expenditure.total"]);
expect(getDefaultSelection("revenue", facts)).toEqual(["revenue.total"]);
expect(getDefaultSelection("expenditure", facts, "ministries", adminFacts)).toEqual([
  "admin_spending.total",
]);
```

Keep the subsequent model assertions; they prove a one-series selection still produces a non-empty chart/table model.

- [ ] **Step 2: Run the focused tests and verify the old defaults fail**

Run:

```powershell
npm.cmd --prefix apps/web run test -- tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts tests/explorer/municipalData.test.ts
```

Expected: FAIL with received arrays containing latest-year category/function IDs after the total.

- [ ] **Step 3: Simplify the national default helper**

Delete `DEFAULT_SELECTION_SIZE` and replace `getDefaultSelection` with:

```ts
// Every populated explorer starts with its reviewed total only. The total is
// still removable; this function decides the pristine fallback, not a required
// selection.
export function getDefaultSelection(
  side: ExplorerSide,
  facts: ServedBudgetFact[],
  expenditureGrouping: ExpenditureGrouping = "fields",
  adminFacts: ServedAdminFact[] = [],
): string[] {
  const totalId =
    side === "revenue"
      ? "revenue.total"
      : expenditureGrouping === "ministries"
        ? ADMIN_SPENDING_TOTAL_ID
        : "expenditure.total";

  const hasSelectableRows =
    side === "expenditure" && expenditureGrouping === "ministries"
      ? adminFacts.some((fact) => fact.level === "admin_category")
      : chooseActivePublicFacts(facts).some(
          (fact) => fact.side === side && !isDerivedTotalItemId(fact.itemId),
        );

  return hasSelectableRows ? [totalId] : [];
}
```

Do not change URL restore behavior in `use-explorer-state.ts`: an explicit empty selection stays empty, valid deep-linked selections stay valid, and an invalid selection still falls back through this helper.

- [ ] **Step 4: Simplify the municipal default helper**

Replace the current sort/slice implementation with:

```ts
/** The official total is the only pristine municipal selection. */
export function getDefaultMunicipalSelection(model: MunicipalEntityModel): string[] {
  return model.years.length === 0 ? [] : [model.totalRow.itemId];
}
```

Do not modify `useMunicipalState`; its explicit-empty and unknown-ID restoration semantics remain correct.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run:

```powershell
npm.cmd --prefix apps/web run test -- tests/explorer/explorerData.test.ts tests/explorer/integration.test.ts tests/explorer/municipalData.test.ts
```

Expected: PASS for all three files.

- [ ] **Step 6: Commit the default-selection change**

```powershell
git add apps/web/lib/explorer/explorerData.ts apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/explorerData.test.ts apps/web/tests/explorer/integration.test.ts apps/web/tests/explorer/municipalData.test.ts
git commit -m "fix(explorer): default to total series only"
```

---

### Task 2: Add the shared selector and migrate the national explorer

**Files:**
- Create: `apps/web/components/main-explorer/series-selector.tsx`
- Modify: `apps/web/components/main-explorer/series-panel.tsx:1-196`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts:50-102`
- Verify unchanged: `apps/web/tests/explorer/seriesSelector.test.ts`

- [ ] **Step 1: Add a failing browser contract for the standardized national selector**

Update the first-view assertions from six selected rows/comparison rows to one, then add:

```ts
test("national selector uses the standardized search, action, status, and row anatomy", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const sections = await panel.locator("[data-selector-section]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-selector-section")),
  );
  expect(sections).toEqual(["controls", "search", "actions", "list"]);

  await expect(panel.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ \d+/);
  await expect(panel.getByTestId("series-toggle-all")).toHaveText("გასუფთავება");

  const actionBox = await panel.getByTestId("series-toggle-all").boundingBox();
  const statusBox = await panel.getByTestId("series-status").boundingBox();
  expect(actionBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(actionBox!.x).toBeLessThan(statusBox!.x);

  const rows = panel.getByTestId("series-row");
  await expect(rows.first()).toContainText("მთლიანი ხარჯი");
  await expect(rows.locator("[data-testid='series-swatch']")).toHaveCount(await rows.count());
  expect(
    await rows
      .first()
      .getByTestId("series-label")
      .evaluate((node) => getComputedStyle(node).getPropertyValue("-webkit-line-clamp")),
  ).toBe("2");
});

test("standardized selector keeps its order when stacked below the chart", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const chartBox = await page.getByTestId("chart-panel").boundingBox();
  const selector = page.getByTestId("series-selector");
  const selectorBox = await selector.boundingBox();
  expect(chartBox).not.toBeNull();
  expect(selectorBox).not.toBeNull();
  expect(selectorBox!.y).toBeGreaterThan(chartBox!.y + chartBox!.height);

  const sections = await selector.locator("[data-selector-section]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-selector-section")),
  );
  expect(sections).toEqual(["controls", "search", "actions", "list"]);
});
```

Also change the existing first-view expectations to:

```ts
// Default: line mode, total-only selection, chart drawn on paper.
await expect(page.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ \d+/);
await expect(page.getByTestId("period-comparison").locator("tbody tr")).toHaveCount(1);
```

- [ ] **Step 2: Run the focused browser test and verify it fails**

Run:

```powershell
npm.cmd --prefix apps/web run test:browser -- tests/browser/main-explorer.spec.ts --grep "standardized|default expenditure view|stacked"
```

Expected: FAIL because `series-status`, `series-row`, selector sections, persistent swatches, and the new order do not exist yet.

- [ ] **Step 3: Create the shared presentational selector**

Create `apps/web/components/main-explorer/series-selector.tsx` with this public interface and markup:

```tsx
"use client";

import type { ReactNode } from "react";
import { SwatchBar } from "../ui/editorial";

type SeriesSelectorProps = {
  controls?: ReactNode;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  selectedCount: number;
  totalCount: number;
  hasSelection: boolean;
  allSelected: boolean;
  onToggleAll: () => void;
  hasVisibleMatches: boolean;
  children: ReactNode;
};

export function SeriesSelector({
  controls,
  query,
  onQueryChange,
  searchPlaceholder,
  selectedCount,
  totalCount,
  hasSelection,
  allSelected,
  onToggleAll,
  hasVisibleMatches,
  children,
}: SeriesSelectorProps) {
  return (
    <div data-testid="series-selector">
      {controls ? <div data-selector-section="controls">{controls}</div> : null}

      <input
        data-testid="series-search"
        data-selector-section="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label="ძებნა სერიებში"
        className={`${controls ? "mt-3.5" : ""} h-[34px] w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent px-0.5 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]`}
      />

      <div
        data-testid="series-actions"
        data-selector-section="actions"
        className="mt-3.5 flex items-center justify-between gap-4 pb-2.5"
      >
        <button
          type="button"
          data-testid="series-toggle-all"
          aria-pressed={allSelected}
          onClick={onToggleAll}
          className="grid shrink-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-1 pr-1 pl-0.5 text-left"
        >
          <span
            aria-hidden
            className="inline-flex size-3.5 items-center justify-center border-[1.5px] text-[9px] leading-none text-[var(--paper)]"
            style={{
              borderColor: allSelected ? "var(--ink)" : "var(--control)",
              backgroundColor: allSelected ? "var(--ink)" : "transparent",
            }}
          >
            {allSelected ? "✓" : ""}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
            {hasSelection ? "გასუფთავება" : "ყველას მონიშვნა"}
          </span>
        </button>

        <span
          data-testid="series-status"
          className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
        >
          სერიები{" "}
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] font-normal text-[var(--faint)]">
            {selectedCount} / {totalCount}
          </span>
        </span>
      </div>

      {!hasVisibleMatches ? (
        <p className="border-b border-[var(--row-border)] px-1 py-3 text-xs text-[var(--muted)]">
          0 შედეგი — შეცვალე საძიებო ტექსტი.
        </p>
      ) : null}

      <div
        data-testid="series-list"
        data-selector-section="list"
        className="flex max-h-[430px] flex-col overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}

type SeriesSelectorRowProps = {
  id: string;
  label: string;
  color: string;
  value: string;
  selected: boolean;
  level?: string;
  parentId?: string | null;
  showCaretColumn?: boolean;
  hasChildren?: boolean;
  expanded?: boolean;
  expansionLocked?: boolean;
  showRail?: boolean;
  isChild?: boolean;
  onToggle: () => void;
  onToggleExpanded?: () => void;
};

export function SeriesSelectorRow({
  id,
  label,
  color,
  value,
  selected,
  level,
  parentId,
  showCaretColumn = false,
  hasChildren = false,
  expanded = false,
  expansionLocked = false,
  showRail = false,
  isChild = false,
  onToggle,
  onToggleExpanded,
}: SeriesSelectorRowProps) {
  return (
    <div
      data-testid="series-row"
      data-series-id={id}
      data-level={level}
      data-parent-id={parentId ?? undefined}
      className={`relative flex items-stretch border-b border-[var(--row-border)] transition-colors duration-100 hover:bg-[var(--tint)] ${selected ? "bg-[var(--tint)]" : "bg-transparent"}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-px -bottom-px left-0 w-0.5"
        style={{ background: showRail ? "var(--accent)" : "transparent" }}
      />

      {showCaretColumn ? (
        <button
          type="button"
          onClick={() => {
            if (!expansionLocked) onToggleExpanded?.();
          }}
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label="ქვეპროგრამები"
          aria-disabled={expansionLocked || undefined}
          className={`flex w-[22px] flex-none items-center justify-center text-base leading-none ${expansionLocked ? "cursor-default" : "cursor-pointer"}`}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
          tabIndex={hasChildren && !expansionLocked ? 0 : -1}
        >
          <span style={{ color: expanded ? "var(--accent)" : "var(--ink)" }}>{expanded ? "▾" : "▸"}</span>
        </button>
      ) : null}

      <button
        type="button"
        data-testid="series-row-toggle"
        onClick={onToggle}
        aria-pressed={selected}
        title={label}
        className={`flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 py-[7px] pr-1.5 text-left ${isChild ? "pl-0.5" : "pl-1"}`}
      >
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-3.5 flex-none items-center justify-center border-[1.5px] text-[9.5px] leading-none text-[var(--paper)]"
          style={{ borderColor: selected ? color : "var(--control)", background: selected ? color : "transparent" }}
        >
          {selected ? "✓" : ""}
        </span>
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <span data-testid="series-swatch" className="mt-[7px] flex-none">
            <SwatchBar color={color} />
          </span>
          <span
            data-testid="series-label"
            className={`line-clamp-2 leading-[1.35] ${isChild ? "text-[11.5px] font-normal text-[var(--body)]" : "text-[12.5px] font-medium text-[var(--ink)]"}`}
          >
            {label}
          </span>
        </span>
        <span className="mt-0.5 flex-none font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">
          {value}
        </span>
      </button>
    </div>
  );
}
```

Keep this file presentation-only. Do not import explorer fact types, formatters, URL helpers, or CSV helpers.

- [ ] **Step 4: Refactor the national adapter to render the shared components**

In `series-panel.tsx`, remove the direct `SwatchBar` import and add:

```ts
import { SeriesSelector, SeriesSelectorRow } from "./series-selector";
```

Keep `buildSeriesPanelRows`, the local query, value lookup, and all hierarchy semantics. Add:

```ts
const hasVisibleMatches =
  query.trim() === "" || panelRows.some((row) => row.item.level !== "total");
const allSelected = selectableIds.every((itemId) => selectedIds.includes(itemId));
```

Replace the selector header/search/row JSX inside the existing `<aside>` with:

```tsx
<SeriesSelector
  controls={
    showGrouping ? (
      <div className="flex gap-[18px] border-b border-[var(--row-border)] pb-3">
        <TextTab
          label="სფეროები"
          active={grouping === "fields"}
          onClick={() => onGroupingChange("fields")}
          testId="grouping-fields"
        />
        <TextTab
          label="უწყებები"
          active={grouping === "ministries"}
          onClick={() => onGroupingChange("ministries")}
          testId="grouping-ministries"
        />
      </div>
    ) : undefined
  }
  query={query}
  onQueryChange={setQuery}
  searchPlaceholder={isMinistries ? "ძებნა — უწყება ან პროგრამა" : "ძებნა"}
  selectedCount={selectedIds.length}
  totalCount={selectableIds.length}
  hasSelection={hasSelection}
  allSelected={allSelected}
  onToggleAll={() => onSelectionChange(hasSelection ? [] : selectableIds)}
  hasVisibleMatches={hasVisibleMatches}
>
  {panelRows.map(({ item, isProgram, hasChildren, expanded, caretLocked }) => {
    const selected = selectedIds.includes(item.id);
    const latest = valuesByItem.get(item.id)?.valuesByYear[endYear] ?? null;

    return (
      <SeriesSelectorRow
        key={item.id}
        id={item.id}
        label={item.kaLabel}
        color={item.color}
        value={formatAmount(latest)}
        selected={selected}
        level={item.level}
        parentId={item.parentItemId}
        showCaretColumn={isMinistries}
        hasChildren={hasChildren}
        expanded={expanded}
        expansionLocked={caretLocked}
        showRail={isProgram || (hasChildren && expanded)}
        isChild={isProgram}
        onToggle={() => onToggle(item.id)}
        onToggleExpanded={() => onToggleExpanded(item.id)}
      />
    );
  })}
</SeriesSelector>
```

Keep the existing CSV button immediately after `</SeriesSelector>` and keep its callback/copy/classes unchanged. Keep the `<aside>` responsive/sticky classes unchanged. Remove the old 2px internal selector-header rule and the duplicated row markup.

- [ ] **Step 5: Run national selector tests**

Run:

```powershell
npm.cmd --prefix apps/web run test -- tests/explorer/seriesSelector.test.ts tests/explorer/explorerData.test.ts
npm.cmd --prefix apps/web run test:browser -- tests/browser/main-explorer.spec.ts
```

Expected: PASS. The hierarchy unit tests still prove total pinning and search expansion; Playwright proves the shared anatomy and total-only first view.

- [ ] **Step 6: Commit the shared selector and national migration**

```powershell
git add apps/web/components/main-explorer/series-selector.tsx apps/web/components/main-explorer/series-panel.tsx apps/web/tests/browser/main-explorer.spec.ts
git commit -m "refactor(explorer): share the standardized series selector"
```

---

### Task 3: Migrate municipality and region explorers to the shared selector

**Files:**
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx:1-16, 86-126, 289-377`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts:98-116, 325-397, 468-486`

- [ ] **Step 1: Change municipal browser tests to require the shared contract**

Apply this test-ID mapping throughout `municipal-entity.spec.ts`:

```text
municipal-series-row    -> series-row
municipal-series-all    -> series-toggle-all
municipal-series-header -> series-actions
municipal-series-search -> series-search
```

Change default-count assertions from six selected rows to one. Replace the bulk-action setup with:

```ts
const panel = page.getByTestId("series-selector");
const bulk = panel.getByTestId("series-toggle-all");
const status = panel.getByTestId("series-status");

await expect(status).toContainText("სერიები 1 / 11");
await expect(bulk).toHaveText("გასუფთავება");
```

Add the municipal structure assertion:

```ts
test("municipal selector uses the same standardized anatomy as the national explorer", async ({ page }) => {
  await page.goto(ENTITY_URL);
  await expectMunicipalAppReady(page);

  const panel = page.getByTestId("series-selector");
  const sections = await panel.locator("[data-selector-section]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-selector-section")),
  );
  expect(sections).toEqual(["search", "actions", "list"]);

  await expect(panel.getByTestId("series-row").first()).toContainText("მთლიანი ბიუჯეტი");
  await expect(panel.getByTitle("მთლიანი ბიუჯეტი")).toHaveAttribute("aria-pressed", "true");

  const actionBox = await panel.getByTestId("series-toggle-all").boundingBox();
  const statusBox = await panel.getByTestId("series-status").boundingBox();
  expect(actionBox!.x).toBeLessThan(statusBox!.x);
});
```

Keep the explicit large-selection tests, empty-selection tests, search-independent bulk tests, hover/selection tint tests, share semantics, and CSV download tests.

- [ ] **Step 2: Run the focused municipal browser tests and verify they fail**

Run:

```powershell
npm.cmd --prefix apps/web run test:browser -- tests/browser/municipal-entity.spec.ts --grep "selector|default selection|bulk actions"
```

Expected: FAIL because the municipal component still exposes the old municipal-only test IDs and old header-before-search markup.

- [ ] **Step 3: Replace the municipal selector markup with the shared components**

In `municipal-explorer.tsx`, remove `SwatchBar` from the editorial import and add:

```ts
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
```

Keep the existing `seriesQuery`, `visibleRows`, global selectable rows, and CSV function. Add:

```ts
const hasVisibleMatches = seriesQuery.trim() === "" || visibleRows.length > 1;
```

Inside the existing sticky aside, replace only the duplicated header/search/row markup with:

```tsx
<SeriesSelector
  query={seriesQuery}
  onQueryChange={setSeriesQuery}
  searchPlaceholder="ძებნა"
  selectedCount={state.selectedIds.length}
  totalCount={selectableRows.length}
  hasSelection={hasSelection}
  allSelected={allSelected}
  onToggleAll={toggleAll}
  hasVisibleMatches={hasVisibleMatches}
>
  {visibleRows.map((row) => (
    <SeriesSelectorRow
      key={row.itemId}
      id={row.itemId}
      label={row.kaLabel}
      color={row.color}
      value={formatAmount(row.valuesByYear[state.range.end] ?? null)}
      selected={state.selectedIds.includes(row.itemId)}
      level={row.itemId === model.totalRow.itemId ? "total" : "category"}
      onToggle={() => state.toggleSeries(row.itemId)}
    />
  ))}
</SeriesSelector>
```

Leave the existing `municipal-csv` button and `← ყველა მუნიციპალიტეტი` link immediately after the shared selector. Do not move CSV into `series-selector.tsx` and do not change export data, filename, or copy.

- [ ] **Step 4: Run municipal unit and browser tests**

Run:

```powershell
npm.cmd --prefix apps/web run test -- tests/explorer/municipalData.test.ts
npm.cmd --prefix apps/web run test:browser -- tests/browser/municipal-entity.spec.ts
```

Expected: PASS. Both municipality and region pages use `MunicipalExplorer`, so the shared component change covers both surface types.

- [ ] **Step 5: Run the two explorer browser suites together**

Run:

```powershell
npm.cmd --prefix apps/web run test:browser -- tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts
```

Expected: PASS, with the same shared selectors on both explorers and unchanged CSV tests.

- [ ] **Step 6: Commit the municipal adoption**

```powershell
git add apps/web/components/municipalities/municipal-explorer.tsx apps/web/tests/browser/municipal-entity.spec.ts
git commit -m "refactor(municipalities): use the shared series selector"
```

---

### Task 4: Synchronize maintained design and agent documentation

**Files:**
- Modify: `DESIGN.md:388-402, 463-476, 681`
- Modify: `AGENTS.md:164-172`
- Modify: `docs/superpowers/specs/2026-08-09-explorer-total-series-and-unlimited-selection-design.md:1-8`
- Modify: `docs/superpowers/specs/2026-08-03-municipalities-ui-design.md:1-8`
- Modify: `docs/superpowers/plans/2026-08-09-explorer-total-series-and-unlimited-selection.md:1-8`

- [ ] **Step 1: Update the canonical selector and default rules in `DESIGN.md`**

Make these requirements explicit:

```text
- The selected checkbox uses the row's series colour; swatches remain visible for selected and unselected rows.
- Labels may occupy up to two lines; latest values remain right-aligned in mono type.
- Optional grouping tabs appear first, followed by search, then an action/status row, then the list.
- The action/status row places გასუფთავება/ყველას მონიშვნა on the left and სერიები {selected} / {all} on the right.
- The pristine selection is the applicable total only for fields, ministries, revenue, municipalities, and regions.
- Search never scopes the count or bulk action; selection remains unlimited.
- CSV remains dataset-owned below the selector and is not part of the shared selector contract.
```

Update the Design QA checklist item to read:

```text
Explorer default: line mode, nominal GEL, full range, total-only selection, and unrestricted line rendering.
```

- [ ] **Step 2: Update the durable rule in `AGENTS.md`**

Replace the two current default/header bullets with:

```text
- Only the applicable total is selected by default; the total is first, ink-coloured, selectable, and removable.
- Series selection is unlimited. Optional grouping tabs precede search; the next row places `გასუფთავება` / `ყველას მონიშვნა` on the left and `სერიები {selected} / {all}` on the right. Search never scopes the bulk action or denominator.
```

- [ ] **Step 3: Add narrow supersedure notes to older approved/current workflow docs**

Add this note below the header of the 2026-08-09 design and implementation plan:

```md
> Superseded in part by `2026-08-10-standardized-data-explorer-design.md`:
> the current default is total-only, and the standardized selector places search
> above an action-left/status-right row. Its unlimited-selection and official-total
> decisions remain in force.
```

Add this note below the header of the 2026-08-03 municipalities UI design:

```md
> Selector update: `2026-08-10-standardized-data-explorer-design.md` supersedes
> the total-plus-five default and the municipality-specific selector markup.
> Municipal data semantics, routes, and the rest of this design remain in force.
```

Do not rewrite completed historical plan bodies. The notes make precedence explicit without pretending their original execution steps were different.

- [ ] **Step 4: Search for stale active requirements**

Run:

```powershell
rg -n -i "top 5|top-five|top five|total-plus-top-five|selector header" AGENTS.md DESIGN.md docs/superpowers/specs docs/superpowers/plans/2026-08-09-explorer-total-series-and-unlimited-selection.md
```

Expected: no active maintained rule still requires category preselection or the old count-left/action-right order. Matches may remain only in historical wording, explicit supersedure notes, and the 2026-08-10 design's description of the replaced behavior.

- [ ] **Step 5: Commit documentation synchronization**

```powershell
git add AGENTS.md DESIGN.md docs/superpowers/specs/2026-08-09-explorer-total-series-and-unlimited-selection-design.md docs/superpowers/specs/2026-08-03-municipalities-ui-design.md docs/superpowers/plans/2026-08-09-explorer-total-series-and-unlimited-selection.md
git commit -m "docs: standardize explorer selector rules"
```

---

### Task 5: Full verification and review

**Files:**
- Verify: all files changed in Tasks 1-4
- Verify unchanged: CSV/export files, data files, schema, routes, and URL parsers

- [ ] **Step 1: Run the full non-browser gate**

Run:

```powershell
npm.cmd --prefix apps/web run check
```

Expected: lint, typecheck, unit tests, and data validation all PASS.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm.cmd --prefix apps/web run build
```

Expected: PASS; all static explorer, municipality, and region routes build successfully.

- [ ] **Step 3: Run the complete browser suite**

Run:

```powershell
npm.cmd --prefix apps/web run test:browser
```

Expected: all Playwright tests PASS. If Windows prints all passes but hangs during teardown, record that distinction and use hosted CI as the eventual delivery gate; do not call the local command a clean success.

- [ ] **Step 4: Inspect the generated explorer screenshots**

Open these Playwright artifacts after the browser run:

```text
apps/web/test-results/geodata-editorial-desktop.png
apps/web/test-results/geodata-editorial-mobile.png
```

Verify visually:

- search is above the action/status row;
- the bulk action is left and the series count is right;
- national and municipal row anatomy matches;
- every row retains a visible swatch;
- long Georgian labels wrap to at most two lines;
- the stacked/mobile selector preserves the same order;
- the CSV button remains present but visually outside the shared selector.

- [ ] **Step 5: Audit scope and the final diff**

Run:

```powershell
git diff --check
git status --short
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- apps/web/lib/explorer/csvExport.ts apps/web/lib/data apps/web/prisma apps/web/app
```

Expected:

- `git diff --check` produces no output;
- only intended files are modified;
- the final command produces no application diff, proving CSV logic, facts, schema, and routes were not changed.

- [ ] **Step 6: Request code review before delivery**

Use `superpowers:requesting-code-review` against the complete branch range. Resolve any verified issues, rerun the affected focused tests, then rerun the full gate if code changed.

- [ ] **Step 7: Record the verified branch state**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -6
```

Expected: clean `codex/standardize-data-explorer` branch containing the design/plan commits and the four focused implementation commits. GitHub push/PR/merge/deployment begins only when the user authorizes delivery.
