# GeoData.ge V1 Pre-Design Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the non-design v1 product behavior, interaction states, copy checks, CSV flow, and browser QA before starting a separate visual design exploration.

**Architecture:** Keep the current real data, explorer model, and visual system intact. This plan adds product-contract tests first, then makes small targeted changes in the existing explorer components so the current v1 is functionally complete and ready for design exploration without changing the data pipeline or deployment setup.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Recharts, Vitest, Playwright.

---

## Scope Boundary

This plan assumes the current data is acceptable for now.

In scope:

- Complete the current v1 user flows for multi-year and single-year modes.
- Add missing stable browser hooks where tests need them.
- Verify Revenue and Expenditure behavior across chart, table, stacked, and single-year modes.
- Verify CSV download behavior from the browser, including filename and metadata columns.
- Tighten non-design UI states: no-results search, no-series chart state, Share of GDP unavailable state, table-mode selection behavior, source label, and planned badge hooks.
- Add a static copy-sanity test to catch mojibake, replacement characters, accidental placeholder text, and obvious debug strings in user-facing component files.
- Run local verification.

Out of scope:

- Production publishing or deployment readiness.
- Vercel, Supabase, domain, hosting, analytics, or production environment work.
- Data remapping or reducing `Other / unclassified`.
- New datasets, years, municipal transfers, debt, capital projects, public API, admin UI, or drilldown pages.
- New visual identity, new design direction, new chart library, or design exploration.
- Large refactors or a translation framework.

## Current Baseline

Existing files already cover the main v1 app:

- `apps/web/components/main-explorer/main-explorer.tsx`
- `apps/web/components/main-explorer/explorer-controls.tsx`
- `apps/web/components/main-explorer/series-selector.tsx`
- `apps/web/components/main-explorer/chart-frame.tsx`
- `apps/web/components/main-explorer/explorer-table.tsx`
- `apps/web/components/main-explorer/period-summary.tsx`
- `apps/web/components/single-year/*`
- `apps/web/lib/explorer/*`
- `apps/web/tests/explorer/*`
- `apps/web/tests/browser/main-explorer.spec.ts`

Data is not the work item here. Keep `data/imports/budget-facts-2023-2025.csv` unchanged unless a test exposes a real import-contract bug.

## File Structure

Modify:

- `apps/web/components/main-explorer/explorer-controls.tsx`  
  Add stable test IDs and `aria-pressed` for mode buttons. No visual redesign.

- `apps/web/components/main-explorer/main-explorer.tsx`  
  Add stable test IDs for CSV download and unavailable state. Keep current layout and styling.

- `apps/web/components/main-explorer/series-selector.tsx`  
  Add a no-results search state and stable hooks for selected count and search input.

- `apps/web/components/main-explorer/explorer-table.tsx`  
  Add a table frame test ID.

- `apps/web/components/main-explorer/period-summary.tsx`  
  Add a period summary test ID and empty movement-list state.

- `apps/web/tests/browser/main-explorer.spec.ts`  
  Add browser coverage for table-mode selection limit, Share of GDP unavailable state, CSV download, selector search empty state, and side-selection memory.

- `apps/web/tests/explorer/integration.test.ts`  
  Add focused model-level contract tests for default selections and active real facts.

Create:

- `apps/web/tests/v1/copySanity.test.ts`  
  Static scan of user-facing source files for encoding and debug/copy mistakes.

Do not modify:

- `apps/web/lib/data/realRevenue/*`
- `apps/web/lib/data/realExpenditure/*`
- `apps/web/scripts/*`
- `data/imports/*`
- `data/staging/*`
- `data/mappings/*`
- `data/reports/*`
- Production or deployment config.

---

### Task 1: Lock The Pre-Design Product Contract With Failing Browser Tests

**Files:**

- Modify: `apps/web/tests/browser/main-explorer.spec.ts`

- [ ] **Step 1: Add stable helper functions for control lookup and downloads**

Add these helpers near the existing helper functions:

```ts
async function selectChartMode(page: Page, mode: "line" | "bar" | "stacked" | "table") {
  await page.getByTestId(`chart-mode-${mode}`).click();
}

async function expectCsvDownload(page: Page, action: () => Promise<void>) {
  const download = await Promise.all([page.waitForEvent("download"), action()]).then(([file]) => file);
  const filename = download.suggestedFilename();
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Expected CSV download stream");

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return {
    filename,
    text: Buffer.concat(chunks).toString("utf8"),
  };
}
```

- [ ] **Step 2: Add a browser test for table mode having no 8-series chart limit**

Append this test before the screenshot test:

```ts
test("table mode allows selecting more than the chart series limit", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await selectChartMode(page, "table");
  await expect(page.getByTestId("explorer-table")).toBeVisible();

  const checkboxes = page.getByTestId("series-selector").locator('input[type="checkbox"]:not(:checked)');
  const count = await checkboxes.count();
  expect(count).toBeGreaterThanOrEqual(8);

  for (let index = 0; index < 8; index += 1) {
    await checkboxes.nth(index).check();
  }

  await expect(page.getByTestId("series-limit-message")).toHaveCount(0);
  await expect(page.getByTestId("selected-series-count")).toContainText("9");
  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 3: Add a browser test for Share of GDP unavailable state**

Append:

```ts
test("share of GDP shows a clear unavailable state instead of a chart", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await page.getByTestId("measure-select").selectOption("share_of_gdp");

  await expect(page.getByTestId("unavailable-state")).toBeVisible();
  await expect(page.getByTestId("chart-frame")).toHaveCount(0);
  await expect(page.getByTestId("source-label")).toBeVisible();
  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 4: Add a browser test for CSV download metadata**

Append:

```ts
test("CSV download uses the active side, years, and metadata columns", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await page.getByTestId("side-revenue").click();

  const result = await expectCsvDownload(page, async () => {
    await page.getByTestId("csv-download").click();
  });

  expect(result.filename).toBe("geodata-budget-revenue-2023-2025.csv");
  expect(result.text.split("\n")[0]).toBe(
    "year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
  );
  expect(result.text).toContain("revenue.vat");
  expect(result.text).toContain("actual");
  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 5: Add a browser test for selector search empty state**

Append:

```ts
test("series selector search shows a no-results state", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await page.getByTestId("series-search").fill("no-such-budget-series-999");

  await expect(page.getByTestId("series-no-results")).toBeVisible();
  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 6: Add a browser test for side-selection memory in normal chart mode**

Append:

```ts
test("expenditure and revenue remember separate selections in line mode", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expect(page.getByTestId("selected-series-count")).toContainText("1");

  const firstUncheckedExpenditure = page.getByTestId("series-selector").locator('input[type="checkbox"]:not(:checked)').first();
  await firstUncheckedExpenditure.check();
  await expect(page.getByTestId("selected-series-count")).toContainText("2");

  await page.getByTestId("side-revenue").click();
  await expect(page.getByTestId("selected-series-count")).toContainText("1");

  await page.getByTestId("side-expenditure").click();
  await expect(page.getByTestId("selected-series-count")).toContainText("2");
  expect(consoleProblems).toEqual([]);
});
```

- [ ] **Step 7: Run browser tests to verify the new tests fail for missing hooks**

Run:

```bash
npm run test:browser
```

Expected: FAIL because `chart-mode-*`, `measure-select`, `csv-download`, `series-search`, `series-no-results`, `selected-series-count`, `series-limit-message`, `unavailable-state`, or `explorer-table` hooks do not all exist yet.

---

### Task 2: Add Stable Hooks And Small Missing States

**Files:**

- Modify: `apps/web/components/main-explorer/explorer-controls.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/main-explorer/series-selector.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/period-summary.tsx`

- [ ] **Step 1: Add chart-mode, measure, and pressed-state hooks**

In `apps/web/components/main-explorer/explorer-controls.tsx`, update chart mode buttons:

```tsx
<button
  key={mode}
  type="button"
  data-testid={`chart-mode-${mode}`}
  aria-pressed={chartMode === mode}
  onClick={() => onChartModeChange(mode)}
  className={`h-9 whitespace-nowrap border px-3 text-sm transition ${
    chartMode === mode
      ? "border-lime-300 bg-lime-300 text-black"
      : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-lime-300/70"
  }`}
>
  {chartModeLabels[mode]}
</button>
```

Also update the side and view buttons with `aria-pressed`:

```tsx
aria-pressed={side === nextSide}
```

```tsx
aria-pressed={viewMode === mode}
```

Add a test ID to the measure select:

```tsx
<select
  data-testid="measure-select"
  value={measure}
  onChange={(event) => onMeasureChange(event.target.value as MeasureMode)}
  className="h-10 min-w-0 border border-zinc-700 bg-black px-3 text-sm text-zinc-100"
>
```

- [ ] **Step 2: Add CSV and unavailable-state hooks**

In `apps/web/components/main-explorer/main-explorer.tsx`, update the CSV button:

```tsx
<button
  type="button"
  data-testid="csv-download"
  onClick={downloadCsv}
  className="h-10 border border-cyan-300 px-4 font-mono text-xs uppercase text-cyan-100 transition hover:bg-cyan-300 hover:text-black"
>
  CSV ჩამოტვირთვა
</button>
```

Update the unavailable-state branch:

```tsx
<div data-testid="unavailable-state" className="border border-amber-300/30 bg-amber-300/10 p-6 text-sm text-amber-100">
  {model.unavailableReason}
</div>
```

- [ ] **Step 3: Add selector search, selected count, limit message, and no-results hooks**

In `apps/web/components/main-explorer/series-selector.tsx`, update the selected count span:

```tsx
<span data-testid="selected-series-count" className="font-mono text-xs text-cyan-200">
  {selectedIds.length}
</span>
```

Update the search input:

```tsx
<input
  data-testid="series-search"
  value={query}
  onChange={(event) => setQuery(event.target.value)}
  className="mt-4 h-10 w-full border border-zinc-700 bg-black px-3 text-sm text-zinc-100 placeholder:text-zinc-600"
  placeholder="ძებნა"
/>
```

Update the limit message:

```tsx
{limitMessage ? (
  <p data-testid="series-limit-message" className="mt-3 border border-amber-300/30 bg-amber-300/10 p-2 text-xs text-amber-100">
    {limitMessage}
  </p>
) : null}
```

Inside the scroll container, before `filteredItems.map(...)`, add:

```tsx
{filteredItems.length === 0 ? (
  <div data-testid="series-no-results" className="border border-zinc-800 bg-zinc-950/75 p-3 text-sm text-zinc-400">
    ამ ძებნით სერია ვერ მოიძებნა.
  </div>
) : null}
```

- [ ] **Step 4: Add a table frame hook**

In `apps/web/components/main-explorer/explorer-table.tsx`, update the non-empty wrapper:

```tsx
<div data-testid="explorer-table" className="overflow-x-auto border border-cyan-400/20 bg-black/45">
```

Also update the empty wrapper:

```tsx
<div data-testid="explorer-table" className="overflow-x-auto border border-cyan-400/20 bg-black/45">
```

- [ ] **Step 5: Add a period summary hook and empty movement-list state**

In `apps/web/components/main-explorer/period-summary.tsx`, update the outer section:

```tsx
<section data-testid="period-summary" className="grid gap-4 lg:grid-cols-4">
```

In `MovementList`, replace the body with:

```tsx
<div className="mt-3 flex flex-col gap-2">
  {rows.length === 0 ? (
    <p className="text-sm text-zinc-400">საკმარისი შედარებითი მონაცემი არ არის.</p>
  ) : (
    rows.map((row, index) => (
      <div key={row.itemId} className="flex items-center justify-between gap-4 text-sm">
        <span className="text-zinc-300">
          {index + 1}. {row.kaLabel}
        </span>
        <span className="font-mono text-zinc-100">{formatSignedPercent(row.change)}</span>
      </div>
    ))
  )}
</div>
```

- [ ] **Step 6: Run browser tests**

Run:

```bash
npm run test:browser
```

Expected: PASS for the hook/state tests added in Task 1.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/main-explorer/explorer-controls.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/components/main-explorer/series-selector.tsx apps/web/components/main-explorer/explorer-table.tsx apps/web/components/main-explorer/period-summary.tsx apps/web/tests/browser/main-explorer.spec.ts
git commit -m "test: lock v1 pre-design interaction states"
```

---

### Task 3: Add Model-Level V1 Completion Tests

**Files:**

- Modify: `apps/web/tests/explorer/integration.test.ts`

- [ ] **Step 1: Add default-selection and active-facts tests**

In `apps/web/tests/explorer/integration.test.ts`, append these tests inside the existing `describe("explorer integration with real CSV data", () => { ... })` block:

```ts
  it("keeps v1 default state anchored to expenditure total over 2023-2025", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);

    expect(years).toEqual([2023, 2024, 2025]);
    expect(getDefaultSelection("expenditure", facts)).toEqual(["expenditure.total"]);

    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: getDefaultSelection("expenditure", facts),
      startYear: 2023,
      endYear: 2025,
      measure: "nominal",
    });

    expect(model.years).toEqual([2023, 2024, 2025]);
    expect(model.selectedItems.map((item) => item.id)).toEqual(["expenditure.total"]);
    expect(model.totalRow?.valuesByYear[2025]).toBeGreaterThan(0);
    expect(model.unavailableReason).toBeNull();
  });

  it("keeps active public facts actual-only for the current v1 dataset", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");

    expect(facts).toHaveLength(66);
    expect(facts.every((fact) => fact.basis === "actual")).toBe(true);
    expect(facts.some((fact) => fact.side === "revenue" && fact.itemId === "revenue.vat")).toBe(true);
    expect(facts.some((fact) => fact.side === "expenditure" && fact.itemId === "spending.health")).toBe(true);
  });

  it("returns a missing-data state for share of GDP until trusted GDP data exists", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");

    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: getDefaultSelection("expenditure", facts),
      startYear: 2023,
      endYear: 2025,
      measure: "share_of_gdp",
    });

    expect(model.unavailableReason).toBeTruthy();
    expect(model.points.every((point) => point.value === null)).toBe(true);
  });
```

- [ ] **Step 2: Run the explorer integration tests**

Run:

```bash
npm run test -- tests/explorer/integration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/explorer/integration.test.ts
git commit -m "test: lock v1 explorer data contracts"
```

---

### Task 4: Add Static Copy Sanity Coverage

**Files:**

- Create: `apps/web/tests/v1/copySanity.test.ts`

- [ ] **Step 1: Create the copy sanity test file**

Create `apps/web/tests/v1/copySanity.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../..");

const userFacingFiles = [
  "apps/web/components/main-explorer/main-explorer.tsx",
  "apps/web/components/main-explorer/explorer-controls.tsx",
  "apps/web/components/main-explorer/series-selector.tsx",
  "apps/web/components/main-explorer/chart-frame.tsx",
  "apps/web/components/main-explorer/explorer-table.tsx",
  "apps/web/components/main-explorer/period-summary.tsx",
  "apps/web/components/single-year/single-year-snapshot.tsx",
  "apps/web/components/single-year/snapshot-headline-cards.tsx",
  "apps/web/components/single-year/snapshot-treemap.tsx",
  "apps/web/components/single-year/every-100-gel.tsx",
  "apps/web/components/single-year/spending-petals.tsx",
  "apps/web/components/single-year/budget-field.tsx",
  "apps/web/components/single-year/single-year-ranking.tsx",
];

const forbiddenFragments = [
  "\uFFFD",
  "Ã",
  "Â",
  "TO" + "DO",
  "FIX" + "ME",
  "Lorem",
  "lorem",
  "undefined",
  "[object Object]",
  "console.log",
];

describe("v1 user-facing copy sanity", () => {
  it("does not contain common encoding, placeholder, or debug fragments", () => {
    const failures: string[] = [];

    for (const relativeFile of userFacingFiles) {
      const absoluteFile = path.join(repoRoot, relativeFile);
      const text = readFileSync(absoluteFile, "utf8");

      for (const fragment of forbiddenFragments) {
        if (text.includes(fragment)) {
          failures.push(`${relativeFile} contains ${JSON.stringify(fragment)}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the copy sanity test**

Run:

```bash
npm run test -- tests/v1/copySanity.test.ts
```

Expected: PASS. If it fails on a real copy issue, fix only the flagged user-facing string. If it fails because a technical string is legitimately needed, narrow the scanned file list instead of weakening the forbidden fragments globally.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/v1/copySanity.test.ts
git commit -m "test: add v1 copy sanity coverage"
```

---

### Task 5: Final Pre-Design Verification

**Files:**

- No planned code changes.
- Generated browser screenshots may update under `apps/web/test-results/`.

- [ ] **Step 1: Run data validation**

Run:

```bash
npm run data:validate
```

Expected:

```text
Validated taxonomy rows: 26
Validated glossary rows: 26
Validated source rows: 10
Validated mapping rows: 3
Validated fact rows: 66
Report written: ...
```

If this fails with Windows `EPERM` while writing a report under `data/reports`, rerun the same command with Codex escalation. Treat the rerun result as the real validation signal.

- [ ] **Step 2: Run unit and integration tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
$env:DATABASE_URL="postgresql://user:password@localhost:5432/geodata"; $env:DIRECT_URL="postgresql://user:password@localhost:5432/geodata"; npm run build
```

Expected: PASS.

- [ ] **Step 5: Run browser tests**

Run:

```bash
npm run test:browser
```

Expected: PASS, including:

- main explorer hydration on `localhost` and `127.0.0.1`
- stacked composition
- single-year expenditure and revenue
- mobile overflow checks
- CSV download
- Share of GDP unavailable state
- table-mode selection behavior
- selector no-results state
- final smoke screenshots

- [ ] **Step 6: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 7: Record the final pre-design status**

Create no new release document yet. In the final implementation response, report:

- verification commands run
- whether every command passed
- whether browser screenshots were regenerated
- that data cleanup and production readiness were intentionally out of scope
- that the app is ready for design exploration only after these checks pass

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/main-explorer/explorer-controls.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/components/main-explorer/series-selector.tsx apps/web/components/main-explorer/explorer-table.tsx apps/web/components/main-explorer/period-summary.tsx apps/web/tests/browser/main-explorer.spec.ts apps/web/tests/explorer/integration.test.ts apps/web/tests/v1/copySanity.test.ts
git commit -m "test: finish v1 pre-design completion checks"
```

---

## Success Criteria

This plan is complete when:

- Current data files remain unchanged except validation report timestamps if the validation script rewrites them.
- No production/deployment work is introduced.
- No visual redesign or design-system exploration is introduced.
- Browser tests cover the remaining v1 interaction contracts.
- CSV download is verified from the browser.
- Share of GDP shows a missing-data state instead of guessed values.
- Table mode can select more than 8 rows without triggering the chart limit.
- Selector search has a clear no-results state.
- Expenditure and revenue keep separate selections in line mode.
- Static copy sanity catches common encoding, debug, and placeholder mistakes.
- `npm run data:validate`, `npm run test`, `npm run lint`, `npm run build`, `npm run test:browser`, and `git diff --check` pass.

## Self-Review

Spec coverage:

- V1 explorer-first IA: covered by browser tests.
- Revenue and expenditure modes: covered by browser and integration tests.
- Multi-year line/table/stacked behavior: covered by browser tests.
- Single-year mode: covered by existing browser tests.
- CSV metadata: covered by browser download test and existing CSV unit tests.
- Source label: preserved and checked by browser tests.
- Planned values: existing hooks remain; current dataset is actual-only and locked by integration test.
- Share of GDP missing data: covered by integration and browser tests.
- Production readiness: intentionally excluded by user request.
- Data cleanup: intentionally excluded by user request.
- Design exploration: intentionally excluded until this plan passes.

Placeholder scan:

- No placeholder implementation steps are used as work items.
- All code-changing steps include exact target files and code snippets.

Type consistency:

- Browser hooks use `data-testid` values that match the component snippets.
- `selectChartMode` accepts the existing `ChartMode` values except `table` is included as a browser button mode.
- `expectCsvDownload` uses Playwright's `download` event and Node `Buffer`, which is already available in the Playwright test runtime.
