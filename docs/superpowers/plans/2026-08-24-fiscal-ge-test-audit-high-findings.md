# Test Audit High Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** COMPLETE. All four tasks shipped 2026-08-25 on `claude/admiring-cohen-6f2357`:
Task 1 `8cd0cbd0c` + `8c8caeb89`, Task 2 `6027c5460`, Task 3 `f488c1419`, Task 4 `62dbed292` +
`abacfe96b`. Verified: 814 unit tests, 193/193 browser with no spec edited, build 93/93 routes.
Task 5 (F18) was optional and remains open. Two items stayed open by design: the contravariance
hole in `ParityCheck.keyOf` (a check wired to the wrong key function still typechecks), and the
hardcoded 30s hook timeout in `tests/data/realExpenditurePdf/year2004StateBudget.test.ts`.

**Goal:** Close the four high-severity findings from the 2026-08-24 testing audit — the places where a wrong fiscal figure can reach a reader with every existing gate green.

**Architecture:** Three of the four findings share one root cause: `lib/explorer/` holds correct, tested arithmetic helpers that the rendering code bypasses with inline copies. Tasks 1 and 4 move that arithmetic back into `lib/` and delete the copies, so the existing tests start covering the real code paths. Tasks 2 and 3 close the two gaps the CSV↔database parity check is structurally blind to: row *order* (parity matches by key, order-insensitive) and dataset *coverage* (parity only protects the datasets it is called on). Both are fixed structurally — a shared ordering function and a mapped type that makes an unchecked dataset a typecheck error — rather than by adding a test that could itself be deleted.

**Tech Stack:** TypeScript 5 (strict), Next.js 16 App Router, React 19, Vitest 4 (node environment, no DOM), Playwright, Prisma 7 / Supabase Postgres.

## Global Constraints

- All commands run from `apps/web`.
- Definition of done per `CLAUDE.md`: `npm run check` and `npm run build` pass; UI-affecting changes also require `npm run test:browser`.
- `npm run check` = `lint` + `typecheck` + `test` + `data:validate`. Lint runs with `--max-warnings 0`.
- Do not push implementation commits directly to `main`. Work stays on `claude/admiring-cohen-6f2357`.
- Per `AGENTS.md` §3 Surgical Changes: touch only what each task requires. Do not reformat, rename, or "improve" adjacent code. Remove only the orphans your own change creates.
- Per `AGENTS.md` §2 Simplicity First: no speculative abstraction. Every helper introduced here replaces two or more existing copies — none is single-use.
- Stable lowercase ASCII IDs; Georgian and English labels are display data, never identifiers.
- Georgian user-facing copy must not change in this plan. Tasks 1 and 4 are behaviour-preserving refactors; the browser suite passing unchanged is the proof.
- Commit messages use Conventional Commits and end with the trailer:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## Prerequisites

- [ ] **Install dependencies.** This worktree has no `node_modules`.

```bash
cd apps/web && npm ci
```

- [ ] **Confirm the baseline is green before changing anything.**

```bash
cd apps/web && npm run check
```

Expected: lint, typecheck, 705 passing tests, and `data:validate` printing its `Validated …` counts, exit 0.

- [ ] **Note for every browser-test step in this plan.** Local Playwright runs need the site URL that CI sets as a job env var, or roughly ten URL assertions in `tests/browser/seo.spec.ts` fail for environmental reasons that look like real regressions:

```bash
cd apps/web && NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run test:browser
```

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lib/explorer/municipalData.ts` | Gains `municipalShareValueForYear` — the one definition of "this municipal row's share of the official total". Later imports the shared CAGR. | 1, 4 |
| `components/municipalities/municipal-explorer.tsx` | Loses three parallel share computations; calls the helper at all three sites. | 1 |
| `app/explorer/municipalities/[code]/page.tsx` | Prose share routed through the canonical `shareOfTotal`. | 1 |
| `app/explorer/municipalities/region/[id]/page.tsx` | Same. | 1 |
| `tests/explorer/municipalData.test.ts` | Stops hand-copying the production callback; imports it. | 1 |
| `lib/data/servedData.ts` | Gains two ordering functions used by *both* the CSV and db paths, and two parity tables whose mapped types make an unchecked dataset a typecheck error. | 2, 3 |
| `tests/data/servedDataOrdering.test.ts` | **New.** Proves the ordering contract holds on shuffled input. | 2 |
| `tests/data/servedDataParityCoverage.test.ts` | **New.** Proves every served dataset field is parity-checked at runtime, including any future non-array field the mapped type cannot see. | 3 |
| `lib/explorer/indicators.ts` | **New.** `compoundAnnualGrowth` (one definition, national + municipal) and `rankPeriodDeltas`. | 4 |
| `components/main-explorer/indicators.tsx` | Loses its inline CAGR and delta ranking; calls the helpers. | 4 |
| `tests/explorer/indicators.test.ts` | Gains coverage for both new helpers alongside the existing `buildKpiShareSeries` cases. | 4 |

---

## Task 1: One municipal share definition

Closes **F06**. `lib/explorer/share.ts` exports a tested `shareOfTotal`, and it is used in exactly one production location. `municipal-explorer.tsx` — 42 commits since June, the most-churned file in the audit — computes the same thing three different ways, and `municipalData.test.ts` hand-copies one of them, so ~20 share assertions currently test a copy rather than the shipped code.

**Files:**
- Modify: `lib/explorer/municipalData.ts` (add export near `getDefaultMunicipalSelection`, line ~159)
- Modify: `components/municipalities/municipal-explorer.tsx:157`, `:201`, `:364`
- Modify: `app/explorer/municipalities/[code]/page.tsx:99`
- Modify: `app/explorer/municipalities/region/[id]/page.tsx:116`
- Test: `tests/explorer/municipalData.test.ts:140-143` and new cases

**Interfaces:**
- Consumes: `shareOfTotal(value, total)` from `lib/explorer/share.ts`; `MunicipalEntityModel = { years: number[]; rows: ExplorerTableRow[]; totalRow: ExplorerTableRow }`; `ExplorerTableRow.valuesByYear: Record<number, number | null>`.
- Produces: `municipalShareValueForYear(model: MunicipalEntityModel, row: ExplorerTableRow, year: number): number | null` — returns a **fraction**, not a percentage. Task 4 does not use it.

- [ ] **Step 1: Write the failing test**

In `tests/explorer/municipalData.test.ts`, replace the hand-copied helper at lines 140-143:

```ts
// Mirrors the shareValueForYear callback municipal-explorer.tsx supplies.
const shareFor = (model: MunicipalEntityModel, row: ExplorerTableRow, year: number) =>
  shareOfTotal(row.valuesByYear[year], model.totalRow.valuesByYear[year]);
```

with an import of the real thing. Add `municipalShareValueForYear` to the existing import block from `../../lib/explorer/municipalData`, delete the `shareOfTotal` import if it becomes unused, and put this in place of the removed helper:

```ts
// The production callback itself, not a copy: municipal-explorer.tsx and the
// two municipality routes all render shares through this function.
const shareFor = municipalShareValueForYear;
```

Then append these cases at the end of the file:

```ts
describe("municipalShareValueForYear", () => {
  it("divides the row's value by the official total for that year", () => {
    const model = build(2016, 2016);
    const economic = model.rows.find((row) => row.itemId === "municipal.economic_affairs")!;

    expect(municipalShareValueForYear(model, economic, 2016)).toBeCloseTo(200 / 300, 12);
  });

  it("has no share for a year the row does not cover", () => {
    const model = build(2015, 2017);
    const economic = model.rows.find((row) => row.itemId === "municipal.economic_affairs")!;

    expect(municipalShareValueForYear(model, economic, 1999)).toBeNull();
  });

  it("gives the total row a share of exactly 1", () => {
    const model = build(2016, 2016);

    expect(municipalShareValueForYear(model, model.totalRow, 2016)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run tests/explorer/municipalData.test.ts
```

Expected: FAIL. TypeScript/Vitest reports that `municipalShareValueForYear` is not exported from `../../lib/explorer/municipalData`.

- [ ] **Step 3: Add the helper**

In `lib/explorer/municipalData.ts`, add the import if `shareOfTotal` is not already imported:

```ts
import { shareOfTotal } from "./share";
```

and add the export immediately after `getDefaultMunicipalSelection` (around line 161):

```ts
/**
 * A municipal row's share of the official MoF total for that year.
 *
 * One definition for every municipal surface that renders a share — the table
 * column, the chart series, the Excel workbook, and the two route summaries.
 * Returns a fraction; the chart multiplies by 100 at its own call site because
 * its axis is in percentage points.
 *
 * The functions do not cover the whole official total, so these shares
 * deliberately do not sum to 1 — the uncovered gap is real and stays visible.
 */
export function municipalShareValueForYear(
  model: MunicipalEntityModel,
  row: ExplorerTableRow,
  year: number,
): number | null {
  return shareOfTotal(row.valuesByYear[year], model.totalRow.valuesByYear[year]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run tests/explorer/municipalData.test.ts
```

Expected: PASS, including the ~20 pre-existing share assertions that now exercise the production function.

- [ ] **Step 5: Route the three `municipal-explorer.tsx` call sites through it**

Add `municipalShareValueForYear` to the existing import from `../../lib/explorer/municipalData`, and remove the now-unused `import { shareOfTotal } from "../../lib/explorer/share";`.

At line ~157, the chart series:

```ts
      vals: years.map((year) => {
        const value = row.valuesByYear[year] ?? null;
        if (!state.share) return value;
        // The chart axis is in percentage points, not fractions.
        const share = municipalShareValueForYear(model, row, year);
        return share === null ? null : share * 100;
      }),
```

At line ~201, the workbook point:

```ts
        pointsByYear[year] = amountGel === null || amountGel === undefined || basis === undefined
          ? null
          : {
              amountGel,
              measureValue: state.share ? municipalShareValueForYear(model, row, year) : undefined,
              basis,
            };
```

The `const total = model.totalRow.valuesByYear[year];` line directly above becomes unused — delete it.

At line ~364, the table callback:

```ts
              shareValueForYear={(row, year) => municipalShareValueForYear(model, row, year)}
```

- [ ] **Step 6: Route the two route summaries through `shareOfTotal`**

These operate on raw facts rather than model rows, so they use the base helper, not the model-aware one.

In `app/explorer/municipalities/[code]/page.tsx`, add `import { shareOfTotal } from "../../../../lib/explorer/share";` and change line ~99:

```ts
    `${formatShare(shareOfTotal(largestFunctionFact.amountGel, latestTotal.publicTotalGel))}-ს შეადგენს.`;
```

In `app/explorer/municipalities/region/[id]/page.tsx`, add `import { shareOfTotal } from "../../../../../lib/explorer/share";` and change the non-Adjara branch at line ~116 so the interpolation reads:

```ts
${formatShare(shareOfTotal(largestFunctionFact.amountGel, latestTotal.publicTotalGel))}-ს შეადგენს.
```

Verify the relative import depth by counting directories from each file to `apps/web/lib/`; `[code]/page.tsx` is four levels deep, `region/[id]/page.tsx` is five.

- [ ] **Step 7: Verify the refactor changed no behaviour**

```bash
cd apps/web && npm run check
```

Expected: PASS. Lint reports no unused imports (the `shareOfTotal` import removed in Step 5 and the `total` const removed with it).

```bash
cd apps/web && NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run test:browser
```

Expected: PASS with no changes to the spec files. This is the proof — `municipal-entity.spec.ts` asserts rendered share values and downloaded workbook contents, so an unchanged pass means the three call sites still compute what they computed before.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/explorer/municipalData.ts apps/web/components/municipalities/municipal-explorer.tsx "apps/web/app/explorer/municipalities/[code]/page.tsx" "apps/web/app/explorer/municipalities/region/[id]/page.tsx" apps/web/tests/explorer/municipalData.test.ts
git commit -m "$(cat <<'EOF'
refactor(explorer): give municipal shares one definition

municipal-explorer.tsx computed a row's share of the official total three
different ways — (value/total)*100 for the chart, amountGel/total for the
workbook, and shareOfTotal for the table — and the two municipality routes
each carried a fourth inline copy for their Georgian summary sentence.

municipalData.test.ts hand-copied the table callback rather than importing
it, so roughly twenty share assertions were testing a copy: changing the
component's denominator would have left every one of them green.

Export municipalShareValueForYear and route all six sites through it.
Behaviour is unchanged; the browser suite passes untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Make the year-ascending contract hold on both serving paths

Closes **F03**. `explorerData.ts` keeps the *last* fact per `itemId` so each series carries its most recent official name — the comment there records that this exists to stop legacy-join points from titling a series by its 2006 organizational name. That requires year-ascending input. The CSV path guarantees it with `byYearAscending()`; the db path applies nothing and relies entirely on `ORDER BY` inside `lib/db/mirrorRows.ts`. `assertSameServedRows` matches rows by natural key and is explicitly order-insensitive — its own test asserts it "accepts identical rows regardless of order" — so a lost `ORDER BY` passes all three parity runs and mislabels ministry series in production with every gate green.

**Files:**
- Modify: `lib/data/servedData.ts` (the `byYearAscending` block at line ~148, `loadExplorerDataFromCsv` ~199, `loadMunicipalDataFromCsv` ~226, and the two db branches at ~276 and ~340)
- Test: `tests/data/servedDataOrdering.test.ts` (new)

**Interfaces:**
- Consumes: `LoadedExplorerData`, `MunicipalData` from `lib/data/servedData.ts`; existing module-private `byYearAscending<T extends { year: number }>(rows: T[]): T[]`.
- Produces: `orderExplorerDataForServing(data: LoadedExplorerData): LoadedExplorerData` and `orderMunicipalDataForServing(data: MunicipalData): MunicipalData`, both exported. Task 3 modifies the same two db branches — apply Task 2 first.

- [ ] **Step 1: Write the failing test**

Create `tests/data/servedDataOrdering.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  orderExplorerDataForServing,
  orderMunicipalDataForServing,
  type LoadedExplorerData,
  type MunicipalData,
} from "../../lib/data/servedData";

// Only `year` matters to the ordering contract; the rest of each row shape is
// irrelevant here, so these fixtures stay deliberately thin.
function yearsOf(rows: Array<{ year: number }>): number[] {
  return rows.map((row) => row.year);
}

function explorerDataWithYears(years: number[]): LoadedExplorerData {
  return {
    facts: [],
    glossary: new Map(),
    sourceDocuments: [],
    adminFacts: years.map((year) => ({ year })),
    adminCategories: [],
    gdpFacts: years.map((year) => ({ year })),
  } as unknown as LoadedExplorerData;
}

function municipalDataWithYears(years: number[]): MunicipalData {
  const rows = years.map((year) => ({ year }));
  return {
    functions: [],
    regions: [],
    municipalities: [],
    functionFacts: [...rows],
    totalFacts: [...rows],
    countryFunctionFacts: [...rows],
    countryTotalFacts: [...rows],
    adjaraBudgetAdjustments: [...rows],
    populationFacts: [...rows],
  } as unknown as MunicipalData;
}

describe("served data ordering contract", () => {
  // The explorer model keeps the LAST fact per item so each series carries its
  // most recent official name (lib/explorer/explorerData.ts). Parity compares by
  // key and is order-insensitive, so nothing else would catch a lost ORDER BY.
  it("sorts admin and GDP facts year-ascending regardless of input order", () => {
    const ordered = orderExplorerDataForServing(explorerDataWithYears([2020, 2004, 2025, 2012]));

    expect(yearsOf(ordered.adminFacts)).toEqual([2004, 2012, 2020, 2025]);
    expect(yearsOf(ordered.gdpFacts)).toEqual([2004, 2012, 2020, 2025]);
  });

  it("sorts every year-bearing municipal dataset", () => {
    const ordered = orderMunicipalDataForServing(municipalDataWithYears([2025, 2015, 2019]));

    for (const rows of [
      ordered.functionFacts,
      ordered.totalFacts,
      ordered.countryFunctionFacts,
      ordered.countryTotalFacts,
      ordered.adjaraBudgetAdjustments,
      ordered.populationFacts,
    ]) {
      expect(yearsOf(rows)).toEqual([2015, 2019, 2025]);
    }
  });

  it("does not mutate the caller's arrays", () => {
    const input = explorerDataWithYears([2025, 2004]);
    const originalOrder = yearsOf(input.adminFacts);

    orderExplorerDataForServing(input);

    expect(yearsOf(input.adminFacts)).toEqual(originalOrder);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run tests/data/servedDataOrdering.test.ts
```

Expected: FAIL — `orderExplorerDataForServing` and `orderMunicipalDataForServing` are not exported from `lib/data/servedData`.

- [ ] **Step 3: Add the two ordering functions**

In `lib/data/servedData.ts`, immediately after the existing `byYearAscending` function (around line 150), add:

```ts
// The ordering contract, applied on BOTH serving paths.
//
// The csv path used to apply byYearAscending inline in its loaders and the db
// path applied nothing, leaving the db path's guarantee to the ORDER BY inside
// lib/db/mirrorRows.ts. Parity compares by key and is order-insensitive
// (servedDataParity.ts), so a dropped ORDER BY would reach production with
// every gate green and mislabel each joined ministry series. Routing both
// paths through one function makes the contract hold regardless of the query.
export function orderExplorerDataForServing(data: LoadedExplorerData): LoadedExplorerData {
  return {
    ...data,
    adminFacts: byYearAscending(data.adminFacts),
    gdpFacts: byYearAscending(data.gdpFacts),
  };
}

export function orderMunicipalDataForServing(data: MunicipalData): MunicipalData {
  return {
    ...data,
    functionFacts: byYearAscending(data.functionFacts),
    totalFacts: byYearAscending(data.totalFacts),
    countryFunctionFacts: byYearAscending(data.countryFunctionFacts),
    countryTotalFacts: byYearAscending(data.countryTotalFacts),
    adjaraBudgetAdjustments: byYearAscending(data.adjaraBudgetAdjustments),
    populationFacts: byYearAscending(data.populationFacts),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run tests/data/servedDataOrdering.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Route both loaders through the new functions**

In `loadExplorerDataFromCsv` (around line 199), replace the inline sorts:

```ts
  return orderExplorerDataForServing({ ...landing, adminFacts, adminCategories, gdpFacts });
```

In `loadMunicipalDataFromCsv` (around line 226), replace the six inline sorts:

```ts
  return orderMunicipalDataForServing({
    functions,
    regions,
    municipalities,
    functionFacts,
    totalFacts,
    countryFunctionFacts,
    countryTotalFacts,
    adjaraBudgetAdjustments,
    populationFacts,
  });
```

In `loadServedExplorerDataUncached`, change the db branch's `return db;` to:

```ts
    return orderExplorerDataForServing(db);
```

In `loadServedMunicipalDataUncached`, change the db branch's `return db;` to:

```ts
    return orderMunicipalDataForServing(db);
```

Leave the parity calls exactly where they are — they run before the return and are order-insensitive either way.

- [ ] **Step 6: Verify**

```bash
cd apps/web && npm run check
```

Expected: PASS. `tests/data/servedData.test.ts` and `tests/data/municipal/servedMunicipalData.test.ts` load the real CSVs through these loaders and must be unaffected.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/data/servedData.ts apps/web/tests/data/servedDataOrdering.test.ts
git commit -m "$(cat <<'EOF'
fix(data): apply the year-ascending contract on the db serving path too

The explorer model keeps the last fact per item so each series carries its
most recent official name. The csv path guaranteed that with byYearAscending;
the db path returned mirror rows as-is and leaned entirely on the ORDER BY in
lib/db/mirrorRows.ts.

assertSameServedRows matches by natural key and is order-insensitive, so a
dropped ORDER BY passes the import's in-transaction check, the deploy build
and the Vercel build alike, and ships ministry series labelled by their 2006
organizational names.

Route both paths through orderExplorerDataForServing and
orderMunicipalDataForServing so the contract holds regardless of the query.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Make an unchecked dataset a typecheck error

Closes **F02**. Parity protects the fifteen datasets it is *called on*. A sixteenth added to `MunicipalData` or `LoadedExplorerData` without a matching `assertSameServedRows` call compiles, typechecks, passes all 705 tests, and ships unverified rows to production — through all three parity runs, because none of them look at it. Discipline has held (`53b987e77`, `e1064a270` each landed their assert in the same commit), but that is convention, not enforcement.

The fix is a mapped type: a table keyed by dataset field, where `{ [K in keyof MunicipalData]: … }` makes a missing entry a compile error. A runtime test backs it up for any future field the mapped type cannot express.

**Files:**
- Modify: `lib/data/servedData.ts` (`assertLandingParity` ~256, the explorer db branch ~283, `assertMunicipalParity` ~299)
- Test: `tests/data/servedDataParityCoverage.test.ts` (new)

**Interfaces:**
- Consumes: `assertSameServedRows` and the seven `*ParityKey` functions from `lib/data/servedDataParity.ts`, all already imported by `servedData.ts`.
- Produces: `MUNICIPAL_PARITY_CHECKS` and `EXPLORER_ROW_PARITY_CHECKS`, both exported for the coverage test. `ParityCheck<TRow> = { label: string; keyOf: (row: TRow) => string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/data/servedDataParityCoverage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  EXPLORER_ROW_PARITY_CHECKS,
  MUNICIPAL_PARITY_CHECKS,
  loadServedMunicipalData,
  resetServedDataCacheForTests,
} from "../../lib/data/servedData";

// glossary is a Map, not a row array, so it is parity-checked by hand inside
// assertLandingParity rather than through the table. Any OTHER field that is
// neither in the table nor listed here is unverified data reaching production.
const HANDLED_OUTSIDE_THE_TABLES = new Set(["glossary"]);

describe("served data parity coverage", () => {
  it("checks every municipal dataset the site serves", async () => {
    resetServedDataCacheForTests();
    const municipal = await loadServedMunicipalData();

    const unchecked = Object.keys(municipal).filter(
      (field) => !(field in MUNICIPAL_PARITY_CHECKS) && !HANDLED_OUTSIDE_THE_TABLES.has(field),
    );

    expect(unchecked).toEqual([]);
  });

  it("gives every municipal check a distinct label so a failure names its dataset", () => {
    const labels = Object.values(MUNICIPAL_PARITY_CHECKS).map((check) => check.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("gives every explorer check a distinct label", () => {
    const labels = Object.values(EXPLORER_ROW_PARITY_CHECKS).map((check) => check.label);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run tests/data/servedDataParityCoverage.test.ts
```

Expected: FAIL — `MUNICIPAL_PARITY_CHECKS` and `EXPLORER_ROW_PARITY_CHECKS` are not exported from `lib/data/servedData`.

- [ ] **Step 3: Replace the hand-listed parity calls with the tables**

In `lib/data/servedData.ts`, replace `assertLandingParity` and `assertMunicipalParity` (and the three inline explorer asserts) with this. Keep every `label` string byte-identical to the current ones so error messages and `docs/data-methodology/database-import.md` stay accurate.

```ts
// One parity check per served dataset. The mapped types are the guard: adding a
// field to MunicipalData or LoadedExplorerData without adding its entry here is
// a typecheck error, not a silent hole. Before this, an unchecked dataset
// compiled, passed every test, and reached production unverified — parity only
// protects the datasets it is called on.
type ParityCheck<TRow> = { label: string; keyOf: (row: TRow) => string };

export const MUNICIPAL_PARITY_CHECKS: {
  [K in keyof MunicipalData]: ParityCheck<MunicipalData[K][number]>;
} = {
  functions: { label: "municipal functions", keyOf: (row) => row.id },
  regions: { label: "municipal regions", keyOf: (row) => row.id },
  municipalities: { label: "municipalities", keyOf: (row) => row.code },
  functionFacts: { label: "municipal function facts", keyOf: municipalFunctionFactParityKey },
  totalFacts: { label: "municipal total facts", keyOf: municipalTotalFactParityKey },
  countryFunctionFacts: {
    label: "Georgia municipal function facts",
    keyOf: municipalFunctionFactParityKey,
  },
  countryTotalFacts: {
    label: "Georgia municipal total facts",
    keyOf: municipalTotalFactParityKey,
  },
  adjaraBudgetAdjustments: {
    label: "Adjara budget adjustments",
    keyOf: adjaraBudgetAdjustmentParityKey,
  },
  populationFacts: {
    label: "municipal population facts",
    keyOf: municipalPopulationFactParityKey,
  },
};

// glossary is a Map rather than a row array, so it cannot sit in a mapped type
// over row arrays; assertLandingParity checks it by hand below and
// tests/data/servedDataParityCoverage.test.ts asserts that hand-check is the
// only exception.
type ExplorerRowFields = Omit<LoadedExplorerData, "glossary">;

export const EXPLORER_ROW_PARITY_CHECKS: {
  [K in keyof ExplorerRowFields]: ParityCheck<ExplorerRowFields[K][number]>;
} = {
  facts: { label: "budget facts", keyOf: budgetFactParityKey },
  sourceDocuments: { label: "source documents", keyOf: (row) => row.sourceId },
  adminFacts: { label: "admin spending facts", keyOf: adminFactParityKey },
  adminCategories: { label: "admin spending categories", keyOf: (row) => row.id },
  gdpFacts: { label: "national GDP facts", keyOf: nationalGdpFactParityKey },
};

// The database is only served after proving it still matches the reviewed
// CSVs in this checkout, row by row. This catches a stale mirror (CSVs merged
// without re-running `npm run data:import`), any direct database edit, and
// any import mapping bug — the build fails loudly instead of serving drifted
// data.
function assertLandingParity(db: LoadedLandingData, csv: LoadedLandingData): void {
  assertSameServedRows("budget facts", csv.facts, db.facts, budgetFactParityKey);
  assertSameServedRows(
    "glossary entries",
    [...csv.glossary.values()],
    [...db.glossary.values()],
    (row) => row.id,
  );
  assertSameServedRows("source documents", csv.sourceDocuments, db.sourceDocuments, (row) => row.sourceId);
}

// The loops below cannot correlate the key type across iterations, so each row
// array is widened to object[] at the call site. The two declarations above are
// where the type safety lives; these are just the walks. Two small explicit
// loops rather than one generic helper — the shared version needed a
// ParityCheck<never> parameter and a Record<string, unknown> cast on the data,
// which cost more comprehension than it saved.
function assertExplorerParity(db: LoadedExplorerData, csv: LoadedExplorerData): void {
  assertSameServedRows(
    "glossary entries",
    [...csv.glossary.values()],
    [...db.glossary.values()],
    (row) => row.id,
  );

  for (const [field, check] of Object.entries(EXPLORER_ROW_PARITY_CHECKS)) {
    const rowCheck = check as ParityCheck<object>;
    const key = field as keyof ExplorerRowFields;
    assertSameServedRows(rowCheck.label, csv[key] as object[], db[key] as object[], rowCheck.keyOf);
  }
}

function assertMunicipalParity(db: MunicipalData, csv: MunicipalData): void {
  for (const [field, check] of Object.entries(MUNICIPAL_PARITY_CHECKS)) {
    const rowCheck = check as ParityCheck<object>;
    const key = field as keyof MunicipalData;
    assertSameServedRows(rowCheck.label, csv[key] as object[], db[key] as object[], rowCheck.keyOf);
  }
}
```

Then in `loadServedExplorerDataUncached`, replace the `assertLandingParity(db, csv)` call and the three `assertSameServedRows` calls beneath it with a single:

```ts
    assertExplorerParity(db, csv);
```

`assertLandingParity` stays — `loadServedLandingDataUncached` still uses it.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run tests/data/servedDataParityCoverage.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the guard actually bites**

Temporarily add a tenth field to `MunicipalData` in `lib/data/servedData.ts`:

```ts
export type MunicipalData = {
  // …existing fields…
  scratchProbe: MunicipalTotalFact[];
};
```

```bash
cd apps/web && npm run typecheck
```

Expected: FAIL — `Property 'scratchProbe' is missing in type` on the `MUNICIPAL_PARITY_CHECKS` declaration. That error is the whole point of this task.

Now remove the probe by **deleting the `scratchProbe` line by hand**. Do not run `git checkout -- apps/web/lib/data/servedData.ts` — Step 3's work is uncommitted and that would discard all of it. Confirm the probe is gone:

```bash
cd apps/web && grep -c scratchProbe lib/data/servedData.ts; npm run typecheck
```

Expected: `0` from grep, then typecheck PASS.

- [ ] **Step 6: Verify**

```bash
cd apps/web && npm run check
```

Expected: PASS. Every parity label is unchanged, so `tests/data/servedDataParity.test.ts` and the db-mode error messages behave exactly as before.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/data/servedData.ts apps/web/tests/data/servedDataParityCoverage.test.ts
git commit -m "$(cat <<'EOF'
fix(data): make an unverified served dataset a typecheck error

Parity protects the datasets it is called on. A new field on MunicipalData or
LoadedExplorerData without a matching assertSameServedRows call compiled,
typechecked, passed every test, and shipped unverified rows through all three
parity runs — the import's in-transaction check, the deploy build and the
Vercel build — because none of them looked at it.

Replace the hand-listed calls with tables whose mapped types enumerate every
field, so omitting one fails typecheck. glossary is a Map and stays checked by
hand; a runtime test asserts it is the only exception.

Labels are byte-identical, so db-mode failure messages are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: One compound annual growth, in `lib/`

Closes **F25**. `components/main-explorer/indicators.tsx:79` computes a CAGR for national expenditure and revenue and renders it as a Georgian prose claim — *"…საშუალო წლიური ზრდა Y%"* — on the two busiest routes. It has no test at any level; the browser suite asserts only that three KPI cards each contain one `<svg>`. The identical formula for the municipal side already lives at `lib/explorer/municipalData.ts:477` **with a passing test**. The project has decided where this belongs; the national copy never moved. `indicators.tsx` has 11 commits since June.

**Files:**
- Create: `lib/explorer/indicators.ts`
- Modify: `components/main-explorer/indicators.tsx:76-100`
- Modify: `lib/explorer/municipalData.ts:477`
- Test: `tests/explorer/indicators.test.ts`

**Interfaces:**
- Consumes: `ExplorerTableRow` from `lib/explorer/types.ts`.
- Produces:
  - `compoundAnnualGrowth(start: number | null, end: number | null, startYear: number | undefined, endYear: number | undefined): number | null`
  - `type PeriodDelta = { row: ExplorerTableRow; delta: number }`
  - `rankPeriodDeltas(rows: ExplorerTableRow[], startYear: number, endYear: number): PeriodDelta[]` — descending by delta.

- [ ] **Step 1: Write the failing test**

Append to `tests/explorer/indicators.test.ts`. Add the import at the top:

```ts
import { compoundAnnualGrowth, rankPeriodDeltas } from "../../lib/explorer/indicators";
```

The file's existing `row()` helper builds an `ExplorerTableRow` with empty `valuesByYear`; add a second builder beside it rather than changing the first, so the `buildKpiShareSeries` cases are untouched:

```ts
function valuedRow(itemId: string, valuesByYear: Record<number, number | null>): ExplorerTableRow {
  return {
    itemId,
    parentItemId: null,
    level: "public_field",
    kaLabel: itemId,
    enLabel: itemId,
    color: "#B3402A",
    basisByYear: {},
    valuesByYear,
    shareByYear: {},
    change: null,
  };
}
```

Then append:

```ts
describe("compoundAnnualGrowth", () => {
  it("returns the annual rate that compounds start into end over the period", () => {
    // 160 → 370 across 2023→2025 is two compounding intervals, not three years.
    expect(compoundAnnualGrowth(160, 370, 2023, 2025)).toBeCloseTo((370 / 160) ** (1 / 2) - 1, 12);
  });

  it("returns zero for a flat series", () => {
    expect(compoundAnnualGrowth(500, 500, 2020, 2025)).toBeCloseTo(0, 12);
  });

  it("returns a negative rate for a shrinking series", () => {
    const rate = compoundAnnualGrowth(400, 100, 2020, 2022);

    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
    expect(rate!).toBeCloseTo(0.5 - 1, 12);
  });

  it("has no rate without a period to compound over", () => {
    expect(compoundAnnualGrowth(100, 200, 2025, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, 200, 2025, 2024)).toBeNull();
  });

  // Growth from or to a non-positive value is not meaningful for display — the
  // same rule explorerData.ts and singleYear.ts apply to period change.
  it("has no rate from a non-positive base or to a non-positive end", () => {
    expect(compoundAnnualGrowth(0, 200, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(-50, 200, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(200, 0, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(200, -50, 2020, 2025)).toBeNull();
  });

  it("has no rate when an endpoint or a year is missing", () => {
    expect(compoundAnnualGrowth(null, 200, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, null, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, 200, undefined, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, 200, 2020, undefined)).toBeNull();
  });
});

describe("rankPeriodDeltas", () => {
  it("orders rows by absolute period increase, biggest first", () => {
    const ranked = rankPeriodDeltas(
      [
        valuedRow("small", { 2020: 100, 2025: 150 }),
        valuedRow("big", { 2020: 100, 2025: 900 }),
        valuedRow("middle", { 2020: 100, 2025: 400 }),
      ],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["big", "middle", "small"]);
    expect(ranked[0].delta).toBe(800);
  });

  // A delta measured against a non-positive start is mostly the unwind of a
  // correction (revenue.other_taxes 2020→2021), not a real increase.
  it("excludes rows whose start is zero or negative", () => {
    const ranked = rankPeriodDeltas(
      [
        valuedRow("fromZero", { 2020: 0, 2025: 900 }),
        valuedRow("fromNegative", { 2020: -200, 2025: 900 }),
        valuedRow("real", { 2020: 100, 2025: 400 }),
      ],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["real"]);
  });

  it("excludes rows missing either endpoint rather than treating a gap as zero", () => {
    const ranked = rankPeriodDeltas(
      [
        valuedRow("noEnd", { 2020: 100 }),
        valuedRow("noStart", { 2025: 400 }),
        valuedRow("nullEnd", { 2020: 100, 2025: null }),
        valuedRow("real", { 2020: 100, 2025: 400 }),
      ],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["real"]);
  });

  it("keeps a shrinking row, ranked last, rather than dropping it", () => {
    const ranked = rankPeriodDeltas(
      [valuedRow("shrank", { 2020: 400, 2025: 100 }), valuedRow("grew", { 2020: 100, 2025: 400 })],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["grew", "shrank"]);
    expect(ranked[1].delta).toBe(-300);
  });

  it("does not mutate the caller's array", () => {
    const rows = [valuedRow("a", { 2020: 100, 2025: 150 }), valuedRow("b", { 2020: 100, 2025: 900 })];

    rankPeriodDeltas(rows, 2020, 2025);

    expect(rows.map((row) => row.itemId)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run tests/explorer/indicators.test.ts
```

Expected: FAIL — cannot resolve `../../lib/explorer/indicators`.

- [ ] **Step 3: Create `lib/explorer/indicators.ts`**

```ts
import type { ExplorerTableRow } from "./types";

// Derived statistics for the "ძირითადი ინდიკატორები" panels (DESIGN.md §8.5).
// These lived inline in components/main-explorer/indicators.tsx, where no unit
// test could reach them — while the municipal side computed the same CAGR in
// lib/explorer/municipalData.ts with a passing test. One definition now.

/**
 * The annual rate that compounds `start` into `end` across the period.
 *
 * The exponent is the number of compounding INTERVALS (endYear - startYear),
 * not the number of years the range spans.
 *
 * Returns null rather than a misleading figure when either endpoint is missing
 * or non-positive, or when there is no period to compound over — the same rule
 * explorerData.ts and singleYear.ts apply to plain period change.
 */
export function compoundAnnualGrowth(
  start: number | null,
  end: number | null,
  startYear: number | undefined,
  endYear: number | undefined,
): number | null {
  if (start === null || end === null || startYear === undefined || endYear === undefined) return null;
  if (start <= 0 || end <= 0 || endYear <= startYear) return null;
  return (end / start) ** (1 / (endYear - startYear)) - 1;
}

export type PeriodDelta = { row: ExplorerTableRow; delta: number };

/**
 * Rows with a meaningful start-to-end increase, biggest first.
 *
 * Rows missing either endpoint have no meaningful period delta, and a delta
 * measured against a non-positive start is mostly the unwind of a correction
 * (e.g. revenue.other_taxes 2020→2021) — both are excluded. A shrinking row
 * keeps its place at the bottom; it is a real, smaller delta.
 */
export function rankPeriodDeltas(
  rows: ExplorerTableRow[],
  startYear: number,
  endYear: number,
): PeriodDelta[] {
  return rows
    .flatMap((row) => {
      const startValue = row.valuesByYear[startYear];
      const endValue = row.valuesByYear[endYear];
      if (
        startValue === undefined ||
        startValue === null ||
        startValue <= 0 ||
        endValue === undefined ||
        endValue === null
      ) {
        return [];
      }
      return [{ row, delta: endValue - startValue }];
    })
    .sort((left, right) => right.delta - left.delta);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run tests/explorer/indicators.test.ts
```

Expected: PASS — the 3 pre-existing `buildKpiShareSeries` cases plus 11 new ones.

- [ ] **Step 5: Call the helpers from the national component**

In `components/main-explorer/indicators.tsx`, add to the imports:

```ts
import { compoundAnnualGrowth, rankPeriodDeltas } from "../../lib/explorer/indicators";
```

Replace the `cagr` assignment at lines 79-80:

```ts
  const cagr = compoundAnnualGrowth(totalStart, totalEnd, startYear, endYear);
```

Replace the `withDelta` / `biggestIncrease` block at lines ~92-97 — delete the `withDelta` const and its comment entirely (the rationale now lives on `rankPeriodDeltas`) and replace with:

```ts
  const biggestIncrease = rankPeriodDeltas(scopeRows, startYear, endYear)[0] ?? null;
```

Leave `slowest`, `largestShare`, `gaugeBase`, `grew`, `deltaParts` and `showSentence` exactly as they are — they are outside this task's scope.

- [ ] **Step 6: Point the municipal CAGR at the same function**

In `lib/explorer/municipalData.ts`, add:

```ts
import { compoundAnnualGrowth } from "./indicators";
```

and replace the inline `cagr` expression inside `buildMunicipalIndicatorPresentation` (line ~477) with:

```ts
      cagr: compoundAnnualGrowth(start, end, startYear, endYear),
```

- [ ] **Step 7: Verify — the existing municipal test is the regression proof**

```bash
cd apps/web && npx vitest run tests/explorer/municipalData.test.ts tests/explorer/indicators.test.ts
```

Expected: PASS. `municipalData.test.ts:1162` asserts `presentation.headline.cagr` equals `(370 / 160) ** (1 / 2) - 1` — an unchanged pass proves the shared function reproduces the municipal behaviour exactly.

```bash
cd apps/web && npm run check
```

Expected: PASS.

```bash
cd apps/web && NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run test:browser
```

Expected: PASS with no spec changes. `main-explorer.spec.ts` renders the indicators panel on every explorer route; an unchanged pass means the Georgian sentence and the KPI cards still read the same.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/explorer/indicators.ts apps/web/components/main-explorer/indicators.tsx apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/indicators.test.ts
git commit -m "$(cat <<'EOF'
refactor(explorer): move the national growth statistics into lib and test them

indicators.tsx computed a compound annual growth rate for national
expenditure and revenue and rendered it as a Georgian prose claim on the two
busiest routes, with no test at any level — the browser suite asserts only
that three KPI cards each carry a sparkline.

The identical formula already sat in lib/explorer/municipalData.ts with a
passing test. Extract compoundAnnualGrowth and rankPeriodDeltas into
lib/explorer/indicators.ts and have both sides call them, so there is one
definition and one set of endpoint tests: flat, shrinking, single-year,
non-positive endpoints, and missing endpoints.

The municipal CAGR assertion passing unchanged is the regression proof.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 (optional): Coverage instrumentation

**This task is separable — drop it without affecting Tasks 1-4.** It is finding F18, rated Medium, not one of the four highs. It is included because it is diagnostic for exactly the class of gap this plan closes by hand: F02, F03 and F25 were all "a module or branch no test imports", which a coverage report surfaces in seconds. Skip it if the goal is strictly the four highs.

**Files:**
- Modify: `apps/web/package.json`, `apps/web/vitest.config.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing from Tasks 1-4.
- Produces: `npm run test:coverage`.

- [ ] **Step 1: Add the coverage provider**

```bash
cd apps/web && npm install --save-dev @vitest/coverage-v8
```

- [ ] **Step 2: Configure thresholds per directory, not globally**

Replace `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Only the directories where a wrong number matters. A global percentage
      // gate rewards testing trivia; these floors are set just under today's
      // real figures so the gate ratchets rather than blocks.
      include: ["lib/explorer/**", "lib/data/**", "lib/db/**"],
      thresholds: {
        "lib/explorer/**": { statements: 70, branches: 65 },
        "lib/data/**": { statements: 70, branches: 65 },
        "lib/db/**": { statements: 40, branches: 35 },
      },
    },
  },
});
```

- [ ] **Step 3: Add the script**

In `apps/web/package.json`, after the `"test"` entry:

```json
    "test:coverage": "vitest run --configLoader native --pool=forks --maxWorkers=1 --coverage",
```

- [ ] **Step 4: Run it and calibrate**

```bash
cd apps/web && npm run test:coverage
```

Read the printed summary. If any directory reports *below* its threshold, lower that threshold to five points under the reported figure and re-run — the floors must pass on today's code, or the gate blocks unrelated work on day one. Record the actual figures in the commit message.

- [ ] **Step 5: Report coverage in CI without gating on it yet**

In `.github/workflows/ci.yml`, in the `checks` job, replace `- run: npm test` with:

```yaml
      # Coverage floors are per-directory (vitest.config.ts) and cover only the
      # code where a wrong figure matters. A global percentage gate would reward
      # testing trivia.
      - run: npm run test:coverage
```

Note: `coverage/` must not be committed. Confirm it is ignored:

```bash
cd "$(git rev-parse --show-toplevel)" && git check-ignore -v apps/web/coverage 2>/dev/null || echo "NOT IGNORED — add apps/web/coverage/ to .gitignore in this task"
```

If it is not ignored, add `apps/web/coverage/` to the root `.gitignore` — CI's "Fail if the job wrote into the repository" guard will otherwise turn red.

- [ ] **Step 6: Verify**

```bash
cd apps/web && npm run check && npm run test:coverage
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/vitest.config.ts .github/workflows/ci.yml .gitignore
git commit -m "$(cat <<'EOF'
ci: measure coverage on the directories where a wrong figure matters

Nothing measured which branches the 705 tests reach, so gaps like an
unparity-checked dataset or an untested mirror loader were findable only by
hand audit.

Floors are per-directory on lib/explorer, lib/data and lib/db, set under
today's real figures so the gate ratchets rather than blocks. No global
percentage gate — that rewards testing trivia.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

- [ ] **Full gate, from a clean state**

```bash
cd apps/web && npm run check && npm run build
```

Expected: both PASS.

- [ ] **Browser suite**

```bash
cd apps/web && NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run test:browser
```

Expected: PASS, with no changes to any file under `tests/browser/`. Tasks 1 and 4 are behaviour-preserving refactors; a spec edit would mean behaviour moved.

- [ ] **Confirm the working tree is clean**

```bash
cd "$(git rev-parse --show-toplevel)" && git status --porcelain
```

Expected: empty. CI enforces this with its "Fail if the job wrote into the repository" step.

- [ ] **Update the audit record**

Add a line to this plan's header noting completion date and which tasks shipped, matching the convention in `docs/superpowers/plans/2026-08-24-fiscal-ge-audit-remediation.md`.

## Out of scope

Deliberately excluded, with the audit's reasoning:

- **F01, the 837-line import script.** Its guards duplicate defences that already hold — over-precision is caught by parity after Postgres rounds, duplicate keys by the deterministic primary-id constraint, unknown references by foreign keys — and the import runs its full parity check inside `prisma.$transaction` before committing, so a bad import rolls back. Building database test infrastructure to prove what three mechanisms already prove is not warranted. Task 3 is what keeps that judgement safe.
- **F09, the four divergent growth guards.** Verified latent: municipal function facts contain zero negatives, and the only two negative national rows hit the implementations that are already guarded and tested. Consolidate opportunistically, next time one is touched.
- **F04, F07, F08, F20, F19** — two-line additions, better folded into the next PR that touches each area than scheduled here.
- **F05, F10-F17, F21-F24** — see the audit's Deferred and Opportunistic waves.
