# Figure Accuracy Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every figure a reader sees on the debt, deficit, economy and inflation-categories surfaces, on the page or in a downloaded workbook, means what its label says.

**Architecture:** The fixes are small and local:

- The debt headline logic moves into a pure, tested `buildDebtDeck` function next to the existing debt model.
- The shared workbook builder gains one optional input (`showChangeColumn`).
- The workbook writer treats `forecast` like `planned` for its cell marker.
- The remaining fixes are single-expression changes in their components, each with a test.

No data file, pipeline, MCP response or publication changes.

**Tech Stack:** Next.js 16 / React 19, strict TypeScript, Vitest 4, Playwright, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-09-17-figure-accuracy-fixes-design.md`

## Global Constraints

- **Branch:** work on `codex/figure-accuracy-fixes`, created from `main` (`c7451ceaf` or later). Never commit to `main`.
- **Where to run commands:** every command in this plan runs from `apps/web`.
- **Scope:** no change to any CSV under `data/`, to any pipeline under `lib/data/`, or to `lib/factQuery/`, `lib/mcp/` or `app/mcp/`.
- **Number formatting:**
  - The minus sign is `−` (U+2212).
  - Missing values render as `—`.
  - Percentages use one decimal.
- **Locales:** Georgian strings are copied exactly as written in this plan. English message values must not contain Georgian script (`npm run i18n:check` enforces this).
- **Colours:** the deck delta keeps the site-wide colouring: a rise uses `POSITIVE`, a fall uses `NEGATIVE` (DESIGN.md:323).
- **Test loop:** while editing, run only the targeted command given in each task. The full gates (`npm run check`, `npm run build`, `npm run test:browser`) run once, in Task 9.
- **Browser tests:** a single spec runs with `npx playwright test tests/browser/<name>.spec.ts`. If `playwright.config.ts` does not start a server for you, follow the CLAUDE.md recipe (build, start on port 3100, set `PLAYWRIGHT_BASE_URL`). Always set `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.

---

### Task 1: Pure debt deck and percentage-point formatter

**Files:**
- Modify: `apps/web/lib/explorer/format.ts` (add after `formatShare`, which ends at line 86)
- Modify: `apps/web/lib/explorer/debtExplorer.ts` (add after `debtRangeForFamily`, which ends at line 116)
- Test: `apps/web/tests/explorer/format.test.ts`
- Test: `apps/web/tests/explorer/debtExplorer.test.ts`

**Interfaces:**
- Consumes: `ServedGovernmentDebtFact`, `DebtFamily` from `lib/servedRows.ts`; the private `SERIES_BY_FAMILY` constant already in `debtExplorer.ts` (line 8).
- Produces:
  - `formatPoints(points: number | null | undefined, signed?: boolean, decimals?: number): string`
  - `type DebtDeckChange = { kind: "relative"; value: number } | { kind: "points"; value: number }`
  - `type DebtDeck = { year: number; value: number; change: DebtDeckChange | null }`
  - `buildDebtDeck(facts: readonly ServedGovernmentDebtFact[], family: DebtFamily): DebtDeck | null`

- [ ] **Step 1: Write the failing formatter test**

In `apps/web/tests/explorer/format.test.ts`, add `formatPoints` to the import on line 2:

```ts
import { formatAmount, formatAmountParts, formatBn, formatInUnit, formatPerResidentGel, formatPoints, formatShare, formatSignedAmount, UNIT_BN, UNIT_MLN } from "../../lib/explorer/format";
```

Then add this block inside `describe("editorial formatters", …)`, directly after the `it` block that contains the `formatShare` assertions (lines 77–80):

```ts
  it("formats percentage-point differences like shares, without a percent sign", () => {
    expect(formatPoints(4.7 - 4.9, true)).toBe("−0.2");
    expect(formatPoints(5 - 3.9, true)).toBe("+1.1");
    expect(formatPoints(0.3)).toBe("0.3");
    expect(formatPoints(null)).toBe("—");
    expect(formatPoints(Number.NaN)).toBe("—");
  });
```

- [ ] **Step 2: Write the failing deck test**

In `apps/web/tests/explorer/debtExplorer.test.ts`, replace lines 2–7 (the two imports) with:

```ts
import {
  buildDebtDeck,
  buildDebtExplorerModel,
  getDefaultDebtSelection,
  selectDebtSeries,
} from "../../lib/explorer/debtExplorer";
import type {
  DebtFamily,
  DebtSeriesId,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../../lib/servedRows";
```

Append at the end of the file:

```ts
describe("debt deck", () => {
  function deckFact(
    year: number,
    family: DebtFamily,
    seriesId: DebtSeriesId,
    value: number | null,
    status: ServedGovernmentDebtFact["status"] = "actual",
  ): ServedGovernmentDebtFact {
    return {
      year,
      family,
      seriesId,
      value,
      valueKind: family === "rate" ? "percent" : "amount_gel",
      status,
      sourceId: null,
      snapshotDate: status === "projection_existing_portfolio" ? "2025-12-31" : null,
      lastReviewedAt: "2026-09-01",
    };
  }

  // Values copied from data/imports/government-debt-facts-2013-2030.csv.
  const deckFacts: ServedGovernmentDebtFact[] = [
    deckFact(2024, "stock", "debt.stock.total", 33_169_300_000),
    deckFact(2025, "stock", "debt.stock.total", 35_934_400_000),
    deckFact(2025, "stock", "debt.stock.domestic", 12_000_000_000),
    deckFact(2024, "service", "debt.service.total", 4_810_480_000),
    deckFact(2025, "service", "debt.service.total", 4_369_500_000),
    deckFact(2029, "service", "debt.service.total", 3_879_110_512, "projection_existing_portfolio"),
    deckFact(2030, "service", "debt.service.total", 3_720_016_442, "projection_existing_portfolio"),
    deckFact(2024, "rate", "debt.rate.total", 4.9),
    deckFact(2025, "rate", "debt.rate.total", 4.7),
  ];

  it("leads the stock family with its latest actual total and relative change", () => {
    expect(buildDebtDeck(deckFacts, "stock")).toEqual({
      year: 2025,
      value: 35_934_400_000,
      change: { kind: "relative", value: expect.closeTo(35_934_400_000 / 33_169_300_000 - 1, 12) },
    });
  });

  it("never leads debt service with an existing-portfolio projection", () => {
    expect(buildDebtDeck(deckFacts, "service")).toEqual({
      year: 2025,
      value: 4_369_500_000,
      change: { kind: "relative", value: expect.closeTo(4_369_500_000 / 4_810_480_000 - 1, 12) },
    });
  });

  it("reports an interest-rate change in percentage points", () => {
    const deck = buildDebtDeck(deckFacts, "rate");
    expect(deck?.year).toBe(2025);
    expect(deck?.value).toBe(4.7);
    expect(deck?.change?.kind).toBe("points");
    expect(deck?.change?.value).toBeCloseTo(-0.2, 10);
  });

  it("shows no change when the previous year is missing or not actual", () => {
    expect(buildDebtDeck([deckFact(2025, "stock", "debt.stock.total", 1)], "stock")?.change).toBeNull();
    expect(buildDebtDeck([
      deckFact(2024, "rate", "debt.rate.total", null, "not_available"),
      deckFact(2025, "rate", "debt.rate.total", 4.7),
    ], "rate")?.change).toBeNull();
  });

  it("returns null when the family has no actual total", () => {
    expect(buildDebtDeck([
      deckFact(2026, "service", "debt.service.total", 5, "projection_existing_portfolio"),
    ], "service")).toBeNull();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/explorer/format.test.ts tests/explorer/debtExplorer.test.ts`
Expected: FAIL with `TypeError: formatPoints is not a function` and `TypeError: buildDebtDeck is not a function`. Every previously passing test still passes.

- [ ] **Step 4: Implement `formatPoints`**

In `apps/web/lib/explorer/format.ts`, insert directly after `formatShare` (after line 86):

```ts
/** Percentage-point difference, `decimals` digits (default 1); "−" minus; optional "+" for positives. */
export function formatPoints(points: number | null | undefined, signed = false, decimals = 1): string {
  if (points === null || points === undefined || !Number.isFinite(points)) return MISSING;
  const prefix = signed && points > 0 ? "+" : "";
  return (prefix + points.toFixed(decimals)).replace("-", "−");
}
```

- [ ] **Step 5: Implement `buildDebtDeck`**

In `apps/web/lib/explorer/debtExplorer.ts`, insert directly after `debtRangeForFamily` (after line 116):

```ts
export type DebtDeckChange =
  | { kind: "relative"; value: number }
  | { kind: "points"; value: number };

export type DebtDeck = { year: number; value: number; change: DebtDeckChange | null };

/**
 * The deck line under the page title: the family total's latest actual year and
 * its change against the previous actual year. A projection never leads the page,
 * and an interest rate moves in percentage points rather than as a relative change
 * of a rate — the rule lib/factQuery/compare.ts applies to rate_percent.
 */
export function buildDebtDeck(facts: readonly ServedGovernmentDebtFact[], family: DebtFamily): DebtDeck | null {
  const totalId = SERIES_BY_FAMILY[family][0]!;
  const actual = facts
    .filter((fact): fact is ServedGovernmentDebtFact & { value: number } =>
      fact.seriesId === totalId && fact.status === "actual" && fact.value !== null)
    .sort((left, right) => left.year - right.year);
  const latest = actual.at(-1);
  if (!latest) return null;
  const previous = actual.find((fact) => fact.year === latest.year - 1);
  let change: DebtDeckChange | null = null;
  if (previous) {
    if (family === "rate") change = { kind: "points", value: latest.value - previous.value };
    else if (previous.value !== 0) change = { kind: "relative", value: (latest.value - previous.value) / previous.value };
  }
  return { year: latest.year, value: latest.value, change };
}
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `npx vitest run tests/explorer/format.test.ts tests/explorer/debtExplorer.test.ts`
Expected: PASS, with no failures.

- [ ] **Step 7: Commit**

```bash
git add lib/explorer/format.ts lib/explorer/debtExplorer.ts tests/explorer/format.test.ts tests/explorer/debtExplorer.test.ts
git commit -m "fix(debt): compute the deck from the latest actual year with rate changes in points"
```

---

### Task 2: Render the debt deck from `buildDebtDeck`

**Files:**
- Modify: `apps/web/components/debt/debt-explorer.tsx`: imports at lines 12 and 14, deck computation at lines 99–120, deck markup at lines 151–169
- Modify: `apps/web/lib/i18n/messages/en/debt.json` and `apps/web/lib/i18n/messages/ka/debt.json`: add `debt.pp`
- Modify: `DESIGN.md` §8.5, line 596
- Modify: `docs/superpowers/specs/2026-09-02-government-debt-explorer-design.md` (append an amendment)
- Test: `apps/web/tests/explorer/debtRoute.test.tsx`: replace the test at lines 157–182 and add one test
- Test: `apps/web/tests/browser/debt.spec.ts`: replace the test at lines 175–188

**Interfaces:**
- Consumes: `buildDebtDeck` and `DebtDeck` (Task 1); `formatPoints` (Task 1).
- Produces: the message key `debt.pp` (ka `პპ`, en `pp`).

- [ ] **Step 1: Write the failing route tests**

In `apps/web/tests/explorer/debtRoute.test.tsx`, add this helper directly after the existing `selectedSeries` helper (it starts at line 80):

```tsx
function deckText(markup: string): string {
  const match = markup.match(/<p data-testid="debt-deck"[^>]*>([\s\S]*?)<\/p>/);
  return (match?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
```

Replace the whole test `it("labels a latest projected family total in the deck", …)` (lines 157–182) with these two tests:

```tsx
  it("leads the service deck with the latest actual total, never a projection", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "service",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2025, min: 2013, max: 2026 },
      selectedIds: ["debt.service.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));
    const deck = deckText(markup);

    // The fixture has no 2024 service total, so no change is shown.
    expect(deck).toBe("2025: ვალის გადახდა · 4.3 მლრდ ₾");
  });

  it("reports the interest-rate deck change in percentage points", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "rate",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2015, end: 2025, min: 2015, max: 2025 },
      selectedIds: ["debt.rate.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));

    // Fixture: 2024 = 5.0%, 2025 = 4.7%.
    expect(deckText(markup)).toBe("2025: საპროცენტო განაკვეთი · 4.7% −0.3 პპ წინა წელთან");
  });
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npx vitest run tests/explorer/debtRoute.test.tsx`
Expected: both new tests FAIL.
- The service deck still reads `2026: ვალის გადახდა · 5.1 მლრდ ₾ პროგნოზი +18.6% წინა წელთან`.
- The rate deck reads `… 4.7% −6.0% წინა წელთან`.

The existing stock deck test (line 153) still passes.

- [ ] **Step 3: Add the `debt.pp` message**

In `apps/web/lib/i18n/messages/en/debt.json`, add a line after `"debt.forecast": "Forecast",` (line 6):

```json
  "debt.pp": "pp",
```

In `apps/web/lib/i18n/messages/ka/debt.json`, add a line after `"debt.forecast": "პროგნოზი",` (line 6):

```json
  "debt.pp": "პპ",
```

- [ ] **Step 4: Replace the deck computation**

In `apps/web/components/debt/debt-explorer.tsx`:

Line 12 becomes:

```tsx
import { buildDebtDeck, buildDebtExplorerModel } from "../../lib/explorer/debtExplorer";
```

Line 14 becomes:

```tsx
import { formatAmount, formatPoints, formatShare, unitFor, unitsFor, formatDisplayDate } from "../../lib/explorer/format";
```

Replace lines 99–120, from `const totalItemId = …` through the end of the `deckYoy` expression, with:

```tsx
  const deck = buildDebtDeck(props.facts, props.family);
  const deckValue = deck === null
    ? "—"
    : props.family === "rate"
      ? formatShare(deck.value / 100)
      : formatAmount(deck.value, locale);
  const deckChange = deck?.change ?? null;
```

- [ ] **Step 5: Replace the deck markup**

Replace the `<p data-testid="debt-deck" …>…</p>` element (lines 151–169) with:

```tsx
        <p data-testid="debt-deck" className="mb-[30px] flex min-h-[18px] flex-wrap items-baseline gap-2 text-[13px] text-[var(--body)]">
          <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--ink)]">
            {deck?.year}: {message(messages, FAMILY_LABEL[props.family])} · {deckValue}
          </span>
          {deckChange !== null ? (
            <>
              <span
                className="font-[family-name:var(--font-numeric)] text-[13px]"
                style={{ color: deckChange.value < 0 ? NEGATIVE : POSITIVE }}
              >
                {deckChange.kind === "points"
                  ? `${formatPoints(deckChange.value, true)} ${message(messages, "debt.pp")}`
                  : formatShare(deckChange.value, true)}
              </span>
              <span>{message(messages, "main.previousYear")}</span>
            </>
          ) : null}
        </p>
```

The forecast chip is gone. `debt.forecast` is still used by the range marker and forecast note.

- [ ] **Step 6: Run the route test and typecheck to verify they pass**

Run: `npx vitest run tests/explorer/debtRoute.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit 0. A leftover reference to `latestTotalFact`, `previousTotalFact`, `deckYoy` or `totalItemId` would fail here; delete any such reference.

- [ ] **Step 7: Update the browser test**

In `apps/web/tests/browser/debt.spec.ts`, replace the test `"keeps the deck on latest coverage and identifies projected service totals"` (lines 175–188) with:

```ts
  test("keeps the deck on the latest actual year for every family", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/debt#f=stock&m=line&r=2013-2024&sel=debt.stock.total`);
    await expectAppReady(page);

    await expect(page.getByTestId("debt-deck")).toContainText("2025: მთავრობის ვალი");
    await expect(page.getByTestId("debt-deck")).toContainText("+8.3%");
    await expect(page.getByTestId("debt-deck")).toContainText("წინა წელთან");

    await page.goto(`${TEST_BASE_URL}/explorer/debt?case=service-deck#f=service&m=line&r=2013-2025&sel=debt.service.total`);
    await expectAppReady(page);
    await expect(page.getByTestId("debt-deck")).toContainText("2025: ვალის გადახდა · 4.4 მლრდ ₾");
    await expect(page.getByTestId("debt-deck")).toContainText("−9.2%");
    await expect(page.getByTestId("debt-deck")).not.toContainText("პროგნოზი");

    await page.goto(`${TEST_BASE_URL}/explorer/debt?case=rate-deck#f=rate&m=line&r=2015-2025&sel=debt.rate.total`);
    await expectAppReady(page);
    await expect(page.getByTestId("debt-deck")).toContainText("2025: საპროცენტო განაკვეთი · 4.7%");
    await expect(page.getByTestId("debt-deck")).toContainText("−0.2 პპ");
  });
```

- [ ] **Step 8: Run the browser spec**

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/debt.spec.ts`
Expected: PASS for every test in the file.

- [ ] **Step 9: Record the rule in DESIGN.md and amend the debt spec**

In `DESIGN.md` §8.5, find the sentence that ends line 596, `forecast service rows use status \`პროგნოზი\`.`, and insert this new paragraph after that paragraph:

```markdown
The deck line reports the latest **actual** observation of the active family's total — never a projection — and its change against the previous actual year: a relative change for stock and service, and a change in percentage points (`პპ`) for rates.
```

Append to the end of `docs/superpowers/specs/2026-09-02-government-debt-explorer-design.md`:

```markdown

## Amendment — 2026-09-17

The deck line reports the latest actual year for every family, and the rate change is shown in percentage points. This supersedes the earlier 2030 service headline. See `2026-09-17-figure-accuracy-fixes-design.md` §2.
```

- [ ] **Step 10: Commit**

```bash
git add components/debt/debt-explorer.tsx lib/i18n/messages/en/debt.json lib/i18n/messages/ka/debt.json tests/explorer/debtRoute.test.tsx tests/browser/debt.spec.ts ../../DESIGN.md ../../docs/superpowers/specs/2026-09-02-government-debt-explorer-design.md
git commit -m "fix(debt): lead the deck with the latest actual year and show rate changes in points"
```

---

### Task 3: Preliminary-GDP notice on the debt stock page

**Files:**
- Modify: `apps/web/components/debt/debt-explorer.tsx` (derived value after the Task 2 deck code; source note at line 270)
- Test: `apps/web/tests/explorer/debtRoute.test.tsx`

**Interfaces:**
- Consumes: `model.years` (active-family years in range) and `props.gdpFacts: ServedNationalGdpFact[]`, both already in `DebtExplorerSurface`. It also consumes the existing message `main.preliminaryGdp`: ka `"{years} წლის მშპ წინასწარია."`, en `"GDP for {years} is preliminary."`.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Write the failing test**

Append inside the `describe` block of `apps/web/tests/explorer/debtRoute.test.tsx`, before its closing `});`:

```tsx
  it("names preliminary GDP years in the stock source note only when they are in range", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const render = (end: number) => renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "stock",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end, min: 2013, max: 2025 },
      selectedIds: ["debt.stock.total"],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));

    // Fixture: GDP 2025 is preliminary, 2013 is final; stock facts exist for 2013, 2024, 2025.
    expect(render(2025)).toContain("2025 წლის მშპ წინასწარია.");
    expect(render(2024)).not.toContain("მშპ წინასწარია");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/debtRoute.test.tsx`
Expected: the new test FAILS; `render(2025)` does not contain `2025 წლის მშპ წინასწარია.`.

- [ ] **Step 3: Implement**

In `apps/web/components/debt/debt-explorer.tsx`, directly after the line `const deckChange = deck?.change ?? null;` (from Task 2), add:

```tsx
  const preliminaryGdpYears = props.family === "stock"
    ? model.years.filter((year) => props.gdpFacts.some((fact) => fact.year === year && fact.status === "preliminary"))
    : [];
```

In the `SourceNote`, directly after the line `{props.family === "stock" ? " " + message(messages, "main.gdpSource") : null}`, add:

```tsx
                {preliminaryGdpYears.length > 0 ? " " + message(messages, "main.preliminaryGdp", { years: preliminaryGdpYears.join(", ") }) : null}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/explorer/debtRoute.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/debt/debt-explorer.tsx tests/explorer/debtRoute.test.tsx
git commit -m "fix(debt): disclose preliminary GDP years in the stock source note"
```

---

### Task 4: No relative change column in percentage workbooks

**Files:**
- Modify: `apps/web/lib/explorer/workbookModel.ts`: `WorkbookExportInput` at lines 32–44; returned `readable` at lines 188–194
- Modify: `apps/web/lib/explorer/debtWorkbook.ts:152`
- Modify: `apps/web/lib/explorer/deficitWorkbook.ts:39`
- Test: `apps/web/tests/explorer/debtWorkbook.test.ts`
- Test: `apps/web/tests/explorer/deficitWorkbook.test.ts`

**Interfaces:**
- Consumes: `WorkbookExportModel.readable.showChangeColumn?: boolean` (already declared at `workbookModel.ts:69`), which the writer already honours (`workbookWriter.client.ts:117`, `:138`, `:147`).
- Produces: `WorkbookExportInput.showChangeColumn?: boolean`. It is copied onto `readable.showChangeColumn` only when defined, so every other caller's model stays deep-equal.

- [ ] **Step 1: Write the failing tests**

Append inside `describe("Debt workbook adapter", …)` in `apps/web/tests/explorer/debtWorkbook.test.ts`, before its closing `});` at line 330:

```ts
  it("drops the relative change column from percentage exports only", () => {
    const base = { facts, gdpFacts, sources: debtSources, gdpSources, siteOrigin: "https://fiscal.ge" };
    const rate = buildDebtWorkbookExportModel({ ...base, family: "rate", selectedIds: ["debt.rate.total"], range: { start: 2019, end: 2021 }, shareOfGdp: false });
    const stockShare = buildDebtWorkbookExportModel({ ...base, family: "stock", selectedIds: ["debt.stock.total"], range: { start: 2013, end: 2014 }, shareOfGdp: true });
    const stockGel = buildDebtWorkbookExportModel({ ...base, family: "stock", selectedIds: ["debt.stock.total"], range: { start: 2013, end: 2014 }, shareOfGdp: false });

    expect(rate.readable.showChangeColumn).toBe(false);
    expect(stockShare.readable.showChangeColumn).toBe(false);
    expect(stockGel.readable.showChangeColumn).toBeUndefined();
  });
```

Append inside `describe("general-government deficit workbook", …)` in `apps/web/tests/explorer/deficitWorkbook.test.ts`, before its closing `});` at line 55:

```ts
  it("drops the relative change column from the percentage export only", () => {
    const input = { facts, range: { start: 2025, end: 2026 }, sources: [], siteOrigin: "https://fiscal.ge" };
    expect(buildDeficitWorkbookExportModel({ ...input, percentage: true }).readable.showChangeColumn).toBe(false);
    expect(buildDeficitWorkbookExportModel({ ...input, percentage: false }).readable.showChangeColumn).toBeUndefined();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/explorer/debtWorkbook.test.ts tests/explorer/deficitWorkbook.test.ts`
Expected: the two new tests FAIL (`expected undefined to be false`); all other tests pass.

- [ ] **Step 3: Implement the shared input**

In `apps/web/lib/explorer/workbookModel.ts`, add a field to `WorkbookExportInput` after `includeTotalsInAnalysis?: boolean;` (line 41):

```ts
  /** false drops the readable sheet's relative change column (percentage measures). */
  showChangeColumn?: boolean;
```

In the returned `readable` object (lines 188–194), add one line after `unitLabel: input.measure.unitLabel,`:

```ts
      ...(input.showChangeColumn === undefined ? {} : { showChangeColumn: input.showChangeColumn }),
```

- [ ] **Step 4: Pass it from the debt and deficit builders**

In `apps/web/lib/explorer/debtWorkbook.ts`, add after `includeTotalsInAnalysis: input.family === "rate",` (line 152):

```ts
    ...(percentage ? { showChangeColumn: false } : {}),
```

In `apps/web/lib/explorer/deficitWorkbook.ts`, add after `includeTotalsInAnalysis: true,` (line 39):

```ts
    ...(input.percentage ? { showChangeColumn: false } : {}),
```

- [ ] **Step 5: Run the workbook tests to verify they pass**

Run: `npx vitest run tests/explorer/debtWorkbook.test.ts tests/explorer/deficitWorkbook.test.ts tests/explorer/workbookWriter.test.ts`
Expected: PASS, with no other failures.

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/workbookModel.ts lib/explorer/debtWorkbook.ts lib/explorer/deficitWorkbook.ts tests/explorer/debtWorkbook.test.ts tests/explorer/deficitWorkbook.test.ts
git commit -m "fix(workbook): drop the relative change column from debt and deficit percentage exports"
```

---

### Task 5: Deficit series panel follows the active measure

**Files:**
- Modify: `apps/web/components/deficit/deficit-explorer.tsx:270`
- Test: `apps/web/tests/browser/deficit.spec.ts`, test at lines 31–41

**Interfaces:**
- Consumes: the existing `headlineValue` constant (`deficit-explorer.tsx:73-77`), which already switches on `percentage`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing browser assertions**

In `apps/web/tests/browser/deficit.spec.ts`, replace the test `"switches between GDP percentage, nominal GEL and the forecast-labelled table"` (lines 31–41) with:

```ts
  test("switches between GDP percentage, nominal GEL and the forecast-labelled table", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("series-row")).toContainText("−1.5%");

    await page.getByTestId("measure-share-toggle").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "amount");
    await expect(page.getByTestId("deficit-measure-label")).toHaveText("მლრდ ₾");
    await expect(page.getByTestId("series-row")).toContainText("−1.5 მლრდ ₾");
    await expect(page.getByTestId("series-row")).not.toContainText("−1.5%");
    await page.getByTestId("chart-mode-table").click();
    await expect(page.getByTestId("explorer-table")).toBeVisible();
    await expect(page.getByTestId("explorer-table").getByText("პროგნოზი", { exact: true })).toHaveCount(6);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/deficit.spec.ts`
Expected: this test FAILS at `toContainText("−1.5 მლრდ ₾")`, because the panel still shows `−1.5%`.

- [ ] **Step 3: Implement**

In `apps/web/components/deficit/deficit-explorer.tsx`, replace line 270:

```tsx
                  value={latestActual ? formatShare(latestActual.generalGovernmentBalancePctGdp / 100) : "—"}
```

with:

```tsx
                  value={headlineValue}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/deficit.spec.ts`
Expected: PASS for every test in the file.

- [ ] **Step 5: Commit**

```bash
git add components/deficit/deficit-explorer.tsx tests/browser/deficit.spec.ts
git commit -m "fix(deficit): show the series panel value in the active measure"
```

---

### Task 6: Forecast marker in the readable workbook sheet

**Files:**
- Modify: `apps/web/lib/explorer/workbookWriter.client.ts`: `readableNumberFormat` at lines 27–34; `writeReadableRow` at lines 84–85
- Modify: `DESIGN.md` §8.5 (the paragraph added in Task 2) and §8.6 (line 600)
- Test: `apps/web/tests/explorer/workbookWriter.test.ts`
- Test: `apps/web/tests/browser/debt.spec.ts`, the download test at lines 190–226

**Interfaces:**
- Consumes: `WorkbookBasis` includes `"forecast"` (`workbookModel.ts:4`). The message `workbook.forecast` exists: ka `პროგნოზი`, en `Forecast`.
- Produces: `readableNumberFormat(isPercentage: boolean, markerKey: "workbook.planned" | "workbook.forecast" | null, locale: Locale, amountDecimals: number): string`. This is module-private, and its only caller is in the same file.

- [ ] **Step 1: Write the failing writer test**

Append inside `describe("createWorkbookBuffer", …)` in `apps/web/tests/explorer/workbookWriter.test.ts`, before its closing `});` at line 312:

```ts
  it("marks forecast cells in every section of the readable number format", async () => {
    const workbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: {
        ...approvedModelFixture.readable,
        unitLabel: "% მშპ-ში",
        rows: [{
          ...readableRows[0]!,
          valuesByYear: { 2020: -0.012, 2021: -0.02, 2022: 0.01 },
          basisByYear: { 2020: "actual", 2021: "forecast", 2022: "forecast" },
        }],
      },
    });
    const summary = workbook.getWorksheet("მარტივი ცხრილი")!;

    expect(summary.getCell("B4").numFmt).not.toContain("პროგნოზი");
    expect(summary.getCell("C4").numFmt).toBe('0.0% "პროგნოზი";[Red](0.0%) "პროგნოზი";0.0% "პროგნოზი"');
    expect(summary.getCell("D4").value).toBe(0.01);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/workbookWriter.test.ts`
Expected: the new test FAILS; `C4.numFmt` is `0.0%;[Red](0.0%);–`.

- [ ] **Step 3: Implement**

In `apps/web/lib/explorer/workbookWriter.client.ts`, replace `readableNumberFormat` (lines 27–34) with:

```ts
function readableNumberFormat(
  isPercentage: boolean,
  markerKey: "workbook.planned" | "workbook.forecast" | null,
  locale: Locale,
  amountDecimals: number,
): string {
  const amount = `#,##0${amountDecimals ? `.${"0".repeat(amountDecimals)}` : ""}`;
  if (markerKey) {
    const marker = workbookMessage(locale, markerKey);
    return isPercentage ? `0.0% "${marker}";[Red](0.0%) "${marker}";0.0% "${marker}"` : `${amount} "${marker}";[Red](${amount}) "${marker}";${amount.replace("#,##", "")} "${marker}"`;
  }
  return isPercentage ? PERCENTAGE_NUMBER_FORMAT : `${amount};[Red](${amount});–`;
}
```

In `writeReadableRow`, replace lines 84–85:

```ts
      const isPlanned = row.basisByYear[year] === "planned";
      cell.numFmt = numberFormat ?? readableNumberFormat(isPercentage, isPlanned, locale, amountDecimals);
```

with:

```ts
      const basis = row.basisByYear[year];
      const isPlanned = basis === "planned";
      const markerKey = isPlanned ? "workbook.planned" : basis === "forecast" ? "workbook.forecast" : null;
      cell.numFmt = numberFormat ?? readableNumberFormat(isPercentage, markerKey, locale, amountDecimals);
```

Leave the preliminary override and the planned fill (lines 86–90) unchanged.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/explorer/workbookWriter.test.ts tests/explorer/debtWorkbook.test.ts tests/explorer/deficitWorkbook.test.ts`
Expected: PASS, including the existing planned-format assertions (`workbookWriter.test.ts:117`, `:196`, `:308`, `:310`).

- [ ] **Step 5: Extend the debt download browser test**

In `apps/web/tests/browser/debt.spec.ts`, inside `"marks the service forecast and downloads its active actual and forecast rows"`, add after the `expect(dataRows.map(...)).toEqual([...]);` assertion (ending at line 225):

```ts
    // Range 2024–2026: column B = 2024, C = 2025, D = 2026.
    const summary = workbook.getWorksheet("მარტივი ცხრილი")!;
    expect(summary.getCell("C4").numFmt).not.toContain("პროგნოზი");
    expect(summary.getCell("D4").numFmt).toContain("პროგნოზი");
```

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/debt.spec.ts`
Expected: PASS.

- [ ] **Step 6: Record the rule in DESIGN.md**

In `DESIGN.md` §8.5, append this sentence to the end of the deck paragraph added in Task 2:

```markdown
 In the readable workbook sheet, cells in forecast years carry the `პროგნოზი` marker.
```

In `DESIGN.md` §8.6, line 600 ends with `…consolidated-budget revenue datasets.`. Append after that sentence:

```markdown
 In the readable workbook sheet, cells in projection years carry the `პროგნოზი` marker.
```

- [ ] **Step 7: Commit**

```bash
git add lib/explorer/workbookWriter.client.ts tests/explorer/workbookWriter.test.ts tests/browser/debt.spec.ts ../../DESIGN.md
git commit -m "fix(workbook): mark forecast cells in the readable sheet"
```

---

### Task 7: Inflation categories workbook weights, status and formula

**Files:**
- Modify: `apps/web/lib/explorer/inflationCategoryWorkbook.ts`: import at line 8, weight at line 94, status at line 105
- Modify: `apps/web/lib/i18n/messages/en/inflation.json`: new key after line 44; note at line 126
- Modify: `apps/web/lib/i18n/messages/ka/inflation.json`: new key after line 44; note at line 126
- Test: `apps/web/tests/explorer/inflationCategoryWorkbook.test.ts`

**Interfaces:**
- Consumes: `CategoryIndex.weights: Map<string, Map<number, number>>` (`lib/explorer/inflationCategories.ts:45`); `buildCategoryIndex(facts, weights)` (`:98`); `periodYear(period)` (`lib/data/inflation/periods`).
- Produces: the message key `inflation.calculated` (ka `გამოთვლილი`, en `Calculated`).

Note: `inflation.categoryContributionNote` is also rendered on the page (`components/inflation/inflation-categories.tsx:266`), so the formula appears there too. That is intended; no test pins the note text.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/explorer/inflationCategoryWorkbook.test.ts`, replace lines 1–7 (the imports) with:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../../lib/data/inflation/types";
import { buildCategoryIndex } from "../../lib/explorer/inflationCategories";
import { buildInflationCategoryWorkbookExportModel } from "../../lib/explorer/inflationCategoryWorkbook";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { fixtureFacts, fixtureHeadline, fixtureIndex, fixtureState, fixtureWeights } from "./fixtures/inflationCategories";
```

In the existing test `"says on the sheet that contributions are a Fiscal.ge calculation"` (lines 81–84), add after `expect(model.readable.subtitle).toContain("Fiscal.ge");`:

```ts
    expect(model.readable.subtitle).toContain("÷ 100 ×");
```

Append inside `describe("buildInflationCategoryWorkbookExportModel", …)`, before its closing `});`:

```ts
  it("writes each row's own year weight, the weight its contribution used", () => {
    const earlier = makePeriod(2025, 8);
    const transportYoy = fixtureFacts.find((fact) => fact.categoryId === "cpi.cat.07" && fact.measure === "yoy_pct")!;
    const facts: ServedCpiCategoryFact[] = [...fixtureFacts, { ...transportYoy, period: "2025-08", value: 3 }];
    const weights: ServedBasketWeightRow[] = [
      ...fixtureWeights,
      { categoryId: "cpi.cat.07", year: 2025, weightPct: 10.2, sourceId: "source.geostat_basket_weights", lastReviewedAt: "2026-09-12" },
    ];
    const model = buildInflationCategoryWorkbookExportModel({
      ...contribInput,
      index: buildCategoryIndex(facts, weights),
      range: { min: earlier, max: period, start: earlier, end: period },
      headline: new Map([...fixtureHeadline, [earlier, 3.1]]),
    });

    const transport = model.analysis.rows.filter((row) => row[3] === "07");
    expect(transport.map((row) => [row[0], row[1], row[5]])).toEqual([
      [2025, 8, expect.closeTo(0.102, 6)],
      [2026, 8, expect.closeTo(0.114, 6)],
    ]);
  });

  it("labels contributions as calculated and published rates as published", () => {
    const contrib = buildInflationCategoryWorkbookExportModel(contribInput);
    const rates = buildInflationCategoryWorkbookExportModel({
      ...contribInput,
      state: { ...contribInput.state, tab: "yoy" },
    });

    expect([...new Set(contrib.analysis.rows.map((row) => row[8]))]).toEqual(["გამოთვლილი"]);
    expect([...new Set(rates.analysis.rows.map((row) => row[8]))]).toEqual(["გამოქვეყნებული"]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/explorer/inflationCategoryWorkbook.test.ts`
Expected, three failures:
- The weight test: 2025 transport weight is `0.114`, not `0.102`.
- The status test: contribution rows read `გამოქვეყნებული`.
- The subtitle test: no `÷ 100 ×`.

- [ ] **Step 3: Add the messages**

In `apps/web/lib/i18n/messages/en/inflation.json`, add after line 44 (`"inflation.published": "Published",`):

```json
  "inflation.calculated": "Calculated",
```

Replace line 126 with:

```json
  "inflation.categoryContributionNote": "Contributions are calculated by Fiscal.ge from Geostat published price changes and consumer basket weights. Contribution = basket weight for the month’s year ÷ 100 × annual price change (pp).",
```

In `apps/web/lib/i18n/messages/ka/inflation.json`, add after line 44 (`"inflation.published": "გამოქვეყნებული",`):

```json
  "inflation.calculated": "გამოთვლილი",
```

Replace line 126 with:

```json
  "inflation.categoryContributionNote": "წვლილი გამოთვლილია Fiscal.ge-ის მიერ საქსტატის გამოქვეყნებული ფასების ცვლილებისა და სამომხმარებლო კალათის წონების საფუძველზე. წვლილი = თვის წლის კალათის წონა ÷ 100 × წლიური ფასის ცვლილება (პპ).",
```

If the key after line 126 is not the last entry, keep the trailing comma. Match what the original line had.

- [ ] **Step 4: Implement the builder changes**

In `apps/web/lib/explorer/inflationCategoryWorkbook.ts`:

Delete line 8, `  latestWeight,`, from the import. It becomes unused.

Replace line 94:

```ts
      const weight = isResidual ? null : latestWeight(index, entry.id);
```

with:

```ts
      // The weight of the month's own calendar year: the one its contribution used (spec §4.6).
      const weight = isResidual ? null : index.weights.get(entry.id)?.get(periodYear(period)) ?? null;
```

Replace line 105:

```ts
          t("published"),
```

with:

```ts
          contribution ? t("calculated") : t("published"),
```

- [ ] **Step 5: Run tests and the localisation check**

Run: `npx vitest run tests/explorer/inflationCategoryWorkbook.test.ts tests/explorer/inflationCategories.test.ts`
Expected: PASS.

Run: `npm run i18n:check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/inflationCategoryWorkbook.ts lib/i18n/messages/en/inflation.json lib/i18n/messages/ka/inflation.json tests/explorer/inflationCategoryWorkbook.test.ts
git commit -m "fix(inflation): export each row's own basket weight, mark contributions calculated and state the formula"
```

---

### Task 8: Constant-price label on the economy hub GDP card

**Files:**
- Modify: `apps/web/lib/explorer/economyHubCards.ts:27`
- Test: `apps/web/tests/explorer/economyHub.test.tsx`

**Interfaces:**
- Consumes: the existing messages `gdp.bn` (en `bn`) and `gdp.constant` (en `Constant 2015 USD`, ka `2015 წლის მუდმივი ფასებით, აშშ დოლარი`).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/explorer/economyHub.test.tsx`, add after line 20 (`expect(cards[0].footer).toContain("27.1");`):

```tsx
  expect(cards[0].footer).toContain("2025: 27.1 bn (Constant 2015 USD)");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/economyHub.test.tsx`
Expected: FAIL; the footer reads `2025: 27.1 bn USD · …`.

- [ ] **Step 3: Implement**

In `apps/web/lib/explorer/economyHubCards.ts`, replace line 27 with:

```ts
      footer: `${real.at(-1)!.year}: ${(real.at(-1)!.value / 1e9).toFixed(1)} ${t("bn")} (${t("constant")}) · ${t("real")}: ${real[0].year}–${real.at(-1)!.year} · ${t("nominal")}: ${nominal[0].year}–${nominal.at(-1)!.year}`,
```

- [ ] **Step 4: Check for an orphaned message key**

Run: `grep -rn "gdp.usd\|t(\"usd\")\|gdp\.\${" components lib --include=*.ts --include=*.tsx`
- If nothing can still resolve to `gdp.usd` (no literal `gdp.usd`, no `t("usd")`, and no template such as `` `gdp.${currency}` ``), delete the `"gdp.usd"` line from both `lib/i18n/messages/en/gdp.json` and `lib/i18n/messages/ka/gdp.json`.
- Otherwise leave both files unchanged.

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/explorer/economyHub.test.tsx`
Expected: PASS.

Run: `npm run i18n:check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/economyHubCards.ts tests/explorer/economyHub.test.tsx lib/i18n/messages/en/gdp.json lib/i18n/messages/ka/gdp.json
git commit -m "fix(economy): label the hub GDP amount as constant 2015 USD"
```

---

### Task 9: Done-check and acceptance

**Files:** none (verification only).

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: exit 0 (lint, typecheck, unit tests, data validation).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Run the browser suite against the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass. If `municipal-entity.spec.ts` "sourced percentage workbook" times out under load, re-run that file alone before treating it as a regression; it is a known load flake.

- [ ] **Step 4: Walk the spec's acceptance table**

On the production server (`http://localhost:3100`), confirm each row of spec §1 in both locales (`/…` and `/en/…`):

1. **Debt deck, every family:** `/explorer/debt#f=service…` shows `2025` and no `პროგნოზი` / `Forecast` in the deck.
2. **Debt deck, rates:** `/explorer/debt#f=rate…` shows `−0.2 პპ` / `−0.2 pp`.
3. **Debt Excel, percentage measure:** a rate workbook or a stock % of GDP workbook has no change column on the readable sheet.
4. **Deficit panel:** `/explorer/deficit`, after the measure toggle, shows `−1.5 მლრდ ₾` in the series panel.
5. **Debt stock source note:** it ends with `2025 წლის მშპ წინასწარია.` / `GDP for 2025 is preliminary.`.
6. **Inflation categories contribution workbook:** row weights differ by year, the status is `გამოთვლილი` / `Calculated`, and the subtitle contains the formula.
7. **Economy hub card:** `/explorer/economy` reads `27.1 bn (Constant 2015 USD)`.
8. **Debt service workbook:** 2026–2030 readable cells show `პროგნოზი`.

- [ ] **Step 5: Hand off**

Push `codex/figure-accuracy-fixes` and open a draft PR. Include the spec path and a checklist of the eight acceptance rows. Merge only after CI is green, per AGENTS.md.
