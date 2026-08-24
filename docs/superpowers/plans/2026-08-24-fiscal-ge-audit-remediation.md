# Fiscal.ge Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the code-audit findings the re-audit confirmed as real — two correctness defects, one latent mutation hazard, one provably dead subsystem, and four contract/duplication cleanups — as four independently mergeable stages, and formally close out the findings that need no change.

**Architecture:** Four stages on one branch. Stages A–C touch no file that `codex/homepage-redesign` touches, so they can land while homepage work continues. Stage D touches `components/main-explorer/main-explorer.tsx`, which the homepage branch also edits, so Stage D is blocked until that branch merges. Every task is test-first: write the failing test, watch it fail with a named error, apply the minimal fix, watch it pass, commit.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Vitest (node environment, `tests/**/*.test.ts`), Playwright, Prisma 7 / Supabase mirror.

## Global Constraints

- Every command in this plan runs from `apps/web`.
- Definition of done per task: `npm run check` passes (lint + typecheck + unit tests + data validation). Stage-closing commits additionally require `npm run build`.
- UI-affecting stages (C and D) additionally require `npm run test:browser`.
- **Do not enable `noUncheckedIndexedAccess` anywhere in this plan.** It is a separate 401-diagnostic migration (see "Deferred: standalone hardening project").
- **Do not touch `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge`.** That is the homepage worktree, branch `codex/homepage-redesign`, HEAD `887609b9e`, 13 commits ahead of main, 0 behind, with one uncommitted user deletion (`.superpowers/sdd/2026-08-23-fiscal-ge-homepage-redesign/masthead-removal-report.md`). Do not reset, clean, stash, rebase, or merge it.
- Stable lowercase ASCII category IDs; Georgian and English labels are display data, not identifiers.
- `MISSING` and the U+2212 minus come from `lib/explorer/format.ts`. Never hand-write either.
- Reviewed CSVs under `data/imports/` are the canonical source of truth. Never edit the Supabase database directly.
- Do not push, open a PR, or merge without explicit user authorization. Do not commit from a detached HEAD.

## Verified starting state (checked 2026-08-24)

| Fact | Value |
|---|---|
| `main` | `befa2c6fd1154045256dabe94558437b3e07f6ca` |
| Node | v24.14.0 (runtime `process.env.TZ` mutation confirmed working) |
| Machine timezone | `Asia/Tbilisi` (UTC+4) |
| `apps/web/node_modules` in this worktree | **absent** — Task 0 installs it |
| Homepage branch overlap with Stages A–C | none |
| Homepage branch overlap with Stage D | `apps/web/components/main-explorer/main-explorer.tsx`, `DESIGN.md` (a real semantic conflict exists in `DESIGN.md`) |

Confirmed still present on `main`:

- `lib/db/mirrorRows.ts:280` `dateOnly()` alongside the timezone-safe `isoDate()` at line 34.
- `lib/data/parsing/cellUtils.ts:70` `if (options.defaultToFirstSheet) return available[0];` in a function declared `: string`.
- `scripts/compose-budget-facts.ts:31` `rows.sort(...)` on an exported function's parameter.
- `lib/data/totalOnlyBudgetFacts.ts` holding one 2006 revenue row; both `*_TOTAL_ONLY_YEARS` arrays empty.
- `lib/explorer/urlState.ts` parsing/serializing the `m`/`sh`/`r`/`sel` vocabulary twice.
- `buildEntityKpis` / `buildCountryKpis` sharing three identical KPI computations; `municipal-indicators.tsx:61` `const sideKpis = [kpis[0]!, kpis[2]!, kpis[3]!];`.
- `budgetCount: 69` literal types in two components; the number `69` at eight sites.
- `shareEndYear` carrying GDP share on one builder and entity-total share on the other.

Confirmed **already resolved** on `main` (original finding 01): no `sourceByYear` / `SourceMetadata` / `sourceMetadataFor` remains in `lib/`, `components/`, `app/`, or `scripts/`.

## File Structure

**Stage A — correctness**

- Modify `apps/web/lib/db/mirrorRows.ts` — delete `dateOnly`, route both date fields through `isoDate`.
- Modify `apps/web/tests/data/municipal/mirrorRows.test.ts` — add the timezone regression.
- Modify `apps/web/lib/data/parsing/cellUtils.ts` — make `pickSheetName` honour its `: string` return type.
- Modify `apps/web/tests/data/parsing/cellUtils.test.ts` — add the empty-workbook case.
- Modify `apps/web/scripts/compose-budget-facts.ts` — sort a copy.
- Create `apps/web/tests/data/composeBudgetFacts.test.ts` — pin non-mutation and sort order.

**Stage B — dead subsystem and URL vocabulary**

- Create `apps/web/lib/data/officialTotalBenchmarks.ts` — the 2006 official revenue benchmark, kept as an explicit reconciliation fixture.
- Delete `apps/web/lib/data/totalOnlyBudgetFacts.ts`.
- Modify `apps/web/lib/data/coverage.ts` — drop both empty `*_TOTAL_ONLY_YEARS` constants and the spreads.
- Modify `apps/web/scripts/compose-budget-facts.ts`, `apps/web/scripts/generate-real-revenue-facts.ts` — drop the four no-op filters and the unvalidated `csvRowsToBudgetRows` adapter.
- Modify `data/reports/budget-facts-2004-2025-compose-report.json`, `data/reports/real-revenue-2005-2025-report.json` — drop the now-unemitted trailing `totalOnlyRows` key.
- Modify `apps/web/tests/data/sourceCoverage.test.ts`, `apps/web/tests/data/pipelineIntegration.test.ts`, `apps/web/tests/explorer/integration.test.ts` — repoint pins.
- Modify `apps/web/lib/explorer/urlState.ts` — one shared parse/serialize pair for `m`/`sh`/`r`/`sel`.

**Stage C — municipal contracts**

- Modify `apps/web/lib/explorer/municipalData.ts` — named KPI record, shared KPI computation, exported count constants.
- Modify `apps/web/components/municipalities/municipal-indicators.tsx`, `municipal-explorer.tsx`, `entity-picker.tsx` — consume the named record, widen `budgetCount` to `number`.
- Modify `apps/web/app/explorer/municipalities/georgia/page.tsx`, `region/[id]/page.tsx`, `[code]/page.tsx` — pass the constant, interpolate the counts into Georgian strings.

**Stage D — share semantics (blocked on homepage merge)**

- Create `apps/web/lib/explorer/share.ts` — one `shareOfTotal` helper.
- Modify `apps/web/lib/explorer/types.ts` — remove `shareEndYear` from `ExplorerTableRow`.
- Modify `apps/web/components/main-explorer/explorer-table.tsx` — derive the final-year share through the existing `shareValueForYear` callback.
- Modify `apps/web/lib/explorer/explorerData.ts`, `lib/explorer/municipalData.ts`, `components/main-explorer/indicators.tsx`, `components/municipalities/municipal-explorer.tsx`.

---

## Task 0: Preflight

**Files:** none modified.

- [ ] **Step 1: Confirm main and the homepage worktree are where this plan expects**

```bash
git -C "C:/Users/Mylaptop/Desktop/Projects/Geodata.ge" rev-parse main && git -C "C:/Users/Mylaptop/.codex/worktrees/b9c1/Geodata.ge" rev-parse --abbrev-ref HEAD
```

Expected: `befa2c6fd1154045256dabe94558437b3e07f6ca` then `codex/homepage-redesign`.

If `main` has moved, rebase this plan's branch onto the new `main` and re-run Task 0 before continuing. If the homepage branch has merged, Stage D unblocks.

- [ ] **Step 2: Create the remediation branch**

```bash
git checkout -b codex/fiscal-ge-audit-remediation main
```

- [ ] **Step 3: Install dependencies (this worktree has no `node_modules`)**

```bash
npm ci --prefix apps/web
```

- [ ] **Step 4: Establish the green baseline**

```bash
npm run check --prefix apps/web
```

Expected: lint clean, typecheck clean, 88 test files / 768 tests passing, data validation clean. **If this is not green, stop and report — do not start Stage A on a red baseline.**

---

# Stage A — Correctness fixes

Findings 15, 11 (concrete part only), 18. No overlap with the homepage branch. Mergeable as soon as it is green.

## Task 1: Timezone-safe municipal population dates

**Finding 15.** `mirrorRows.ts` already has the timezone-aware `isoDate()`; ninety lines later `dateOnly()` reintroduces exactly the bug `isoDate` was written to fix, and feeds a hard equality check that throws.

**Files:**
- Modify: `apps/web/lib/db/mirrorRows.ts:280-282` (delete `dateOnly`), `:300`, `:318` (call `isoDate`)
- Test: `apps/web/tests/data/municipal/mirrorRows.test.ts`

**Interfaces:**
- Consumes: the existing `mirrorWithPopulation(overrides)` fake at `tests/data/municipal/mirrorRows.test.ts:28` and the existing `isoDate` at `lib/db/mirrorRows.ts:34`.
- Produces: nothing new. `loadMunicipalPopulationFactsFromMirror` keeps its signature.

**Why the audit's suggested timezone was wrong:** the original audit said to test with a negative-offset zone. That is backwards. `dateOnly` calls `toISOString()`, which shifts a local-midnight Date *backwards* only when local time is **ahead** of UTC. Verified on this machine:

```text
TZ=Asia/Tbilisi   new Date(2025,0,1) -> 2024-12-31T20:00:00.000Z   dateOnly -> 2024-12-31   isoDate -> 2025-01-01
TZ=America/New_York new Date(2025,0,1) -> 2025-01-01T05:00:00.000Z dateOnly -> 2025-01-01   isoDate -> 2025-01-01
```

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/data/municipal/mirrorRows.test.ts`. Add `afterEach` to the existing `vitest` import on line 1.

```ts
// Captured before any mutation. Deleting process.env.TZ does NOT restore the
// system zone on Node 24 — the last assigned value sticks — so restore by
// assignment, falling back to the resolved system zone when TZ was never set.
const ORIGINAL_TZ = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("municipal population mirror date conversion", () => {
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("keeps the calendar date when the driver returns local midnight in a UTC+ zone", async () => {
    process.env.TZ = "Asia/Tbilisi";

    await expect(
      loadMunicipalPopulationFactsFromMirror(
        mirrorWithPopulation({
          referenceDate: new Date(2025, 0, 1),
          lastReviewedAt: new Date(2026, 7, 3),
        }),
      ),
    ).resolves.toMatchObject([{ referenceDate: "2025-01-01", lastReviewedAt: "2026-08-03" }]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

```bash
npm test --prefix apps/web -- tests/data/municipal/mirrorRows.test.ts
```

Expected: FAIL with `Municipal population fact 2025:15 must use 2025-01-01, got 2024-12-31`.

If it passes, the `new Date(2025, 0, 1)` calls were hoisted above the `process.env.TZ` assignment — check ordering before changing any source.

- [ ] **Step 3: Delete `dateOnly` and route both fields through `isoDate`**

In `apps/web/lib/db/mirrorRows.ts`, delete lines 280-282 entirely:

```ts
function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
```

Then replace the two call sites:

```ts
    const referenceDate = isoDate(row.referenceDate);
```

```ts
      lastReviewedAt: isoDate(row.lastReviewedAt),
```

- [ ] **Step 4: Run the file's tests and confirm all pass**

```bash
npm test --prefix apps/web -- tests/data/municipal/mirrorRows.test.ts
```

Expected: PASS, including the three pre-existing population cases. The rejection case at line 90 (`new Date("2024-11-14T00:00:00.000Z")`) must still reject: `isoDate` sees UTC midnight, returns `2024-11-14`, and the guard throws as before.

- [ ] **Step 5: Full check**

```bash
npm run check --prefix apps/web
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/db/mirrorRows.ts apps/web/tests/data/municipal/mirrorRows.test.ts && git commit -m "fix: use the timezone-safe date reader for municipal population facts"
```

---

## Task 2: `pickSheetName` must not return `undefined`

**Finding 11, concrete part.** The function is declared `: string` but returns `available[0]` for a zero-sheet workbook. With `noUncheckedIndexedAccess` off, the compiler certifies that as a `string`. The descriptive error the function already carries is the correct behaviour.

**Files:**
- Modify: `apps/web/lib/data/parsing/cellUtils.ts:70`
- Test: `apps/web/tests/data/parsing/cellUtils.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `pickSheetName` keeps its exact signature; only the zero-sheet path changes, from `undefined` to a thrown `Error`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("pickSheetName", ...)` block in `apps/web/tests/data/parsing/cellUtils.test.ts`:

```ts
  it("throws instead of returning undefined when the workbook has no sheets", () => {
    expect(() =>
      pickSheetName({ SheetNames: [] }, { defaultToFirstSheet: true, sheetDescription: "revenue sheet" }),
    ).toThrow("Could not find revenue sheet. Available sheets: ");
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npm test --prefix apps/web -- tests/data/parsing/cellUtils.test.ts
```

Expected: FAIL with `expected [Function] to throw an error` — the function currently returns `undefined` instead.

- [ ] **Step 3: Guard the first-sheet fallback**

In `apps/web/lib/data/parsing/cellUtils.ts`, replace line 70:

```ts
  if (options.defaultToFirstSheet) return available[0];
```

with:

```ts
  // Declared `: string`, so an empty workbook must fall through to the
  // descriptive throw below rather than hand back undefined.
  if (options.defaultToFirstSheet) {
    const firstSheet = available[0];
    if (firstSheet !== undefined) return firstSheet;
  }
```

- [ ] **Step 4: Run the tests and confirm all pass**

```bash
npm test --prefix apps/web -- tests/data/parsing/cellUtils.test.ts
```

Expected: PASS, including `falls back to the first sheet when defaultToFirstSheet is set (adminSpending behavior)` — a non-empty workbook still returns `ბალანსი`.

- [ ] **Step 5: Full check**

```bash
npm run check --prefix apps/web
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/data/parsing/cellUtils.ts apps/web/tests/data/parsing/cellUtils.test.ts && git commit -m "fix: throw on an empty workbook instead of returning an undefined sheet name"
```

---

## Task 3: `budgetRowsToCsvRows` must not reorder its caller's array

**Finding 18.** The exported mapper sorts its parameter in place. No visible defect today because the first call site happens to pass a fresh spread — the hazard is latent. The sibling helper `sortedByEndYear` in `municipalData.ts` already copies and documents why.

**Files:**
- Modify: `apps/web/scripts/compose-budget-facts.ts:31`
- Create: `apps/web/tests/data/composeBudgetFacts.test.ts`

**Interfaces:**
- Consumes: `budgetRowsToCsvRows(rows: BudgetFactImportRow[]): BudgetFactCsvRow[]` from `scripts/compose-budget-facts.ts`; `BudgetFactImportRow` from `lib/data/importBudgetFacts.ts`.
- Produces: no signature change. Importing the script module is side-effect free — `main()` is behind an `import.meta.url === pathToFileURL(process.argv[1]).href` guard.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/data/composeBudgetFacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { budgetRowsToCsvRows } from "../../scripts/compose-budget-facts";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";

function importRow(year: number, itemId: string): BudgetFactImportRow {
  return {
    year,
    side: "expenditure",
    itemId,
    amountGel: 1,
    basis: "actual",
    sourceId: "source.test_fixture",
    officialInstitution: null,
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: null,
    mappingConfidence: null,
    mappingNotes: "",
  };
}

describe("budgetRowsToCsvRows", () => {
  it("sorts by year, then side, then item id", () => {
    const sorted = budgetRowsToCsvRows([
      importRow(2025, "spending.health"),
      importRow(2004, "spending.defense"),
      importRow(2004, "spending.agriculture"),
    ]);

    expect(sorted.map((row) => `${row.year}:${row.item_id}`)).toEqual([
      "2004:spending.agriculture",
      "2004:spending.defense",
      "2025:spending.health",
    ]);
  });

  it("does not reorder the caller's array", () => {
    const rows = [
      importRow(2025, "spending.health"),
      importRow(2004, "spending.defense"),
      importRow(2004, "spending.agriculture"),
    ];

    budgetRowsToCsvRows(rows);

    expect(rows.map((row) => `${row.year}:${row.itemId}`)).toEqual([
      "2025:spending.health",
      "2004:spending.defense",
      "2004:spending.agriculture",
    ]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the second one fails**

```bash
npm test --prefix apps/web -- tests/data/composeBudgetFacts.test.ts
```

Expected: the sort test PASSES, `does not reorder the caller's array` FAILS — the caller's array comes back in sorted order.

- [ ] **Step 3: Sort a copy**

In `apps/web/scripts/compose-budget-facts.ts`, change line 30-31 from:

```ts
export function budgetRowsToCsvRows(rows: BudgetFactImportRow[]): BudgetFactCsvRow[] {
  return rows
    .sort((a, b) => {
```

to:

```ts
export function budgetRowsToCsvRows(rows: BudgetFactImportRow[]): BudgetFactCsvRow[] {
  // Copy first: this is exported and called twice from main(), and the second
  // caller still holds a reference to the array it passed in.
  return [...rows]
    .sort((a, b) => {
```

- [ ] **Step 4: Run the tests and confirm both pass**

```bash
npm test --prefix apps/web -- tests/data/composeBudgetFacts.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Full check plus a production build to close Stage A**

```bash
npm run check --prefix apps/web && npm run build --prefix apps/web
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/scripts/compose-budget-facts.ts apps/web/tests/data/composeBudgetFacts.test.ts && git commit -m "fix: stop budgetRowsToCsvRows reordering its caller's array"
```

- [ ] **Step 7: Confirm the Stage A diff is exactly six files**

```bash
git diff --name-only main...HEAD
```

Expected: `apps/web/lib/data/parsing/cellUtils.ts`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/scripts/compose-budget-facts.ts`, `apps/web/tests/data/composeBudgetFacts.test.ts`, `apps/web/tests/data/municipal/mirrorRows.test.ts`, `apps/web/tests/data/parsing/cellUtils.test.ts`.

**Stage A is now independently mergeable. Pause here for review before starting Stage B.**

---

# Stage B — Dead subsystem removal and URL vocabulary

Findings 02, 12, 09. No overlap with the homepage branch.

## Task 4: Retire the total-only pipeline, keep the 2006 benchmark

**Findings 02 and 12.** `TOTAL_ONLY_BUDGET_FACTS` holds exactly one row — a 2006 revenue total — and every consumer filters it to nothing:

- `compose-budget-facts.ts:63` keeps only `side === "expenditure"` → `[]`
- `generate-real-revenue-facts.ts:40` keeps only revenue years outside `REVENUE_DETAILED_YEARS` (2005–2025) → `[]`
- both report filters gate on `REVENUE_TOTAL_ONLY_YEARS`, which is `[]` → `[]`

But the 2006 amount is **not** dead: `tests/data/pipelineIntegration.test.ts:398` uses it as an independent reconciliation benchmark against the summed detailed 2006 revenue facts. That check must survive, which is why this task rehomes the value rather than deleting it.

Removing the injection also removes `csvRowsToBudgetRows`, the only unvalidated entry point into `BudgetFactImportRow` — that resolves finding 12 without a separate change.

**Files:**
- Create: `apps/web/lib/data/officialTotalBenchmarks.ts`
- Delete: `apps/web/lib/data/totalOnlyBudgetFacts.ts`
- Modify: `apps/web/lib/data/coverage.ts:10,12,15,20`
- Modify: `apps/web/scripts/compose-budget-facts.ts` (imports, `csvRowsToBudgetRows`, lines 63 and 77)
- Modify: `apps/web/scripts/generate-real-revenue-facts.ts` (imports, lines 40 and 52)
- Modify: `data/reports/budget-facts-2004-2025-compose-report.json`, `data/reports/real-revenue-2005-2025-report.json`
- Modify: `apps/web/tests/data/pipelineIntegration.test.ts`, `apps/web/tests/data/sourceCoverage.test.ts`, `apps/web/tests/explorer/integration.test.ts`
- Modify: `docs/data-methodology/revenue-methodology.md`

**Interfaces:**
- Consumes: `REVENUE_TOTAL_ITEM_ID` and `REVENUE_ROUNDING_TOLERANCE_GEL` as already imported by `tests/data/pipelineIntegration.test.ts`.
- Produces:

```ts
export type OfficialTotalBenchmark = {
  year: number;
  side: "revenue" | "expenditure";
  itemId: string;
  amountGel: number;
  sourceId: string;
  sourceUnit: "GEL" | "thousand_gel";
  evidence: string;
  notes: string;
};
export const OFFICIAL_TOTAL_BENCHMARKS: readonly OfficialTotalBenchmark[];
export function officialTotalBenchmark(year: number, side: "revenue" | "expenditure", itemId: string): OfficialTotalBenchmark;
```

`officialTotalBenchmark` **throws** when no benchmark matches, so a test can never silently pass against a missing fixture.

- [ ] **Step 1: Write the failing test for the new benchmark module**

Create `apps/web/tests/data/officialTotalBenchmarks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { officialTotalBenchmark, OFFICIAL_TOTAL_BENCHMARKS } from "../../lib/data/officialTotalBenchmarks";

describe("official total benchmarks", () => {
  it("preserves the 2006 consolidated revenue total with its evidence", () => {
    const benchmark = officialTotalBenchmark(2006, "revenue", "revenue.total");

    expect(benchmark.amountGel).toBe(4537916325);
    expect(benchmark.sourceId).toBe("source.mof_2006_revenue_form1_pdf");
    expect(benchmark.sourceUnit).toBe("GEL");
    expect(benchmark.evidence).toContain("2006-jan-dec-consolidated-revenue.pdf");
  });

  it("throws rather than returning undefined for an unknown benchmark", () => {
    expect(() => officialTotalBenchmark(1999, "revenue", "revenue.total")).toThrow(
      "No official total benchmark for 1999 revenue revenue.total",
    );
  });

  it("keeps every benchmark uniquely keyed", () => {
    const keys = OFFICIAL_TOTAL_BENCHMARKS.map((row) => `${row.year}:${row.side}:${row.itemId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npm test --prefix apps/web -- tests/data/officialTotalBenchmarks.test.ts
```

Expected: FAIL — `Failed to resolve import "../../lib/data/officialTotalBenchmarks"`.

- [ ] **Step 3: Create the benchmark module**

Create `apps/web/lib/data/officialTotalBenchmarks.ts`:

```ts
// Officially evidenced headline totals kept as machine-checkable reconciliation
// fixtures. These are NOT shipped rows: nothing here is injected into any CSV.
// They exist so a test can assert that the detailed facts the app does ship sum
// back to the number the official document prints.
//
// The 2006 revenue total previously lived in lib/data/totalOnlyBudgetFacts.ts as
// part of a total-only fallback path. That path could not fire — every consumer
// filtered it to zero rows — so the plumbing was removed and the evidenced
// number was rehomed here, where its actual job is visible.

export type OfficialTotalBenchmark = {
  year: number;
  side: "revenue" | "expenditure";
  itemId: string;
  amountGel: number;
  sourceId: string;
  sourceUnit: "GEL" | "thousand_gel";
  evidence: string;
  notes: string;
};

export const OFFICIAL_TOTAL_BENCHMARKS: readonly OfficialTotalBenchmark[] = [
  {
    year: 2006,
    side: "revenue",
    itemId: "revenue.total",
    amountGel: 4537916325,
    sourceId: "source.mof_2006_revenue_form1_pdf",
    sourceUnit: "GEL",
    evidence:
      "docs/Raw Data/Revenue/2006-jan-dec-consolidated-revenue.pdf page 22 row sul consolidated column",
    notes: "Consolidated receipts total; rounded to whole GEL.",
  },
];

export function officialTotalBenchmark(
  year: number,
  side: "revenue" | "expenditure",
  itemId: string,
): OfficialTotalBenchmark {
  const benchmark = OFFICIAL_TOTAL_BENCHMARKS.find(
    (row) => row.year === year && row.side === side && row.itemId === itemId,
  );

  if (!benchmark) {
    throw new Error(`No official total benchmark for ${year} ${side} ${itemId}`);
  }

  return benchmark;
}
```

- [ ] **Step 4: Run the new test and confirm it passes**

```bash
npm test --prefix apps/web -- tests/data/officialTotalBenchmarks.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Repoint the 2006 reconciliation test at the new module**

In `apps/web/tests/data/pipelineIntegration.test.ts`, replace the `TOTAL_ONLY_BUDGET_FACTS` import on line 27 with:

```ts
import { officialTotalBenchmark } from "../../lib/data/officialTotalBenchmarks";
```

Replace the body of the `reconciles 2006 revenue receipts against the curated official total` test (around line 398) with:

```ts
  it("reconciles 2006 revenue receipts against the curated official total", async () => {
    const { facts } = await loadPipeline();

    // lib/data/officialTotalBenchmarks.ts preserves the official 2006
    // consolidated receipts total; the detailed 2006 revenue facts shipped in
    // the CSV must sum to it within the revenue pipeline's rounding tolerance.
    const curated2006Total = officialTotalBenchmark(2006, "revenue", REVENUE_TOTAL_ITEM_ID);

    const detailed2006Sum = sumAmountGel(actualOnly(revenueFacts(facts)).filter((fact) => fact.year === 2006));
    const differenceGel = Math.abs(detailed2006Sum - curated2006Total.amountGel);

    expect(differenceGel).toBeLessThanOrEqual(REVENUE_ROUNDING_TOLERANCE_GEL);
  });
```

- [ ] **Step 6: Delete the two dead-branch tests that pin empty arrays**

In `apps/web/tests/data/pipelineIntegration.test.ts`, delete the whole `keeps total-only expenditure years to exactly the official total row` test (it loops over an empty array, so its body never runs), but **keep its closing assertion** by moving it into the coverage test. Replace the deleted test with:

```ts
  it("never ships an explicit expenditure total row: totals are derived by summing categories", async () => {
    const { facts } = await loadPipeline();
    const expenditure = facts.filter((fact) => fact.side === "expenditure");

    const totalRows = expenditure.filter((fact) => fact.itemId === EXPENDITURE_TOTAL_ITEM_ID);
    expect(totalRows).toEqual([]);
  });
```

In the same file, in `matches expenditure year coverage in coverage.ts exactly`, delete the `totalOnlyYears` local and its assertion; in `matches revenue year coverage in coverage.ts exactly`, delete the `totalRowYears` local and its assertion, replacing them with a direct statement of the rule:

```ts
    // Every revenue year is fully detailed: the shipped CSV must carry no
    // revenue.total rows at all.
    expect(revenue.filter((fact) => fact.itemId === REVENUE_TOTAL_ITEM_ID)).toEqual([]);
```

Remove `EXPENDITURE_TOTAL_ONLY_YEARS` and `REVENUE_TOTAL_ONLY_YEARS` from the import list at the top of the file.

- [ ] **Step 7: Repoint the two other test files**

In `apps/web/tests/data/sourceCoverage.test.ts`, drop `EXPENDITURE_TOTAL_ONLY_YEARS` and `REVENUE_TOTAL_ONLY_YEARS` from the line 5 import and delete these two lines from `documents explicit old-year coverage tiers`:

```ts
    expect(EXPENDITURE_TOTAL_ONLY_YEARS).toEqual([]);
    expect(REVENUE_TOTAL_ONLY_YEARS).toEqual([]);
```

In `apps/web/tests/explorer/integration.test.ts`, drop `REVENUE_TOTAL_ONLY_YEARS` from the line 6 import and delete the dead `totalOnlyRevenueByYear` map together with its `expect` and its `for` loop (the map is constructed empty and never filled, so the loop body never executes). Keep `expect([...expectedReceiptsByYear.keys()]).toEqual(REVENUE_YEARS);`.

- [ ] **Step 8: Remove the empty coverage branches**

In `apps/web/lib/data/coverage.ts`, delete lines 10 and 15 and rewrite the two spreads:

```ts
export const EXPENDITURE_SOURCE_YEARS = inclusiveYears(APP_START_YEAR, APP_END_YEAR);
export const EXPENDITURE_DETAILED_YEARS = inclusiveYears(APP_START_YEAR, APP_END_YEAR);
export const EXPENDITURE_YEARS = EXPENDITURE_DETAILED_YEARS;

export const REVENUE_SOURCE_YEARS = inclusiveYears(REVENUE_START_YEAR, APP_END_YEAR);
// The 2004 annual report provides ten comparable consolidated revenue-and-grants
// categories but not the Form #1 increase-in-liabilities row.
export const REVENUE_PARTIAL_YEARS = [2004];
export const REVENUE_DETAILED_YEARS = inclusiveYears(2005, APP_END_YEAR);
export const REVENUE_YEARS = [...REVENUE_PARTIAL_YEARS, ...REVENUE_DETAILED_YEARS].sort((a, b) => a - b);
```

Leave `EXPENDITURE_SOURCE_YEARS` in place — the re-audit rejected merging it with `EXPENDITURE_DETAILED_YEARS` (finding 03): the two carry different meanings (source availability vs. shipped detail) and only coincide today.

- [ ] **Step 9: Remove the dead injection from both scripts**

In `apps/web/scripts/compose-budget-facts.ts`: delete the `totalOnlyBudgetFacts` import (line 5), drop `REVENUE_TOTAL_ONLY_YEARS` from the coverage import (line 6), delete the entire `csvRowsToBudgetRows` function (lines 14-29), and rewrite lines 62-65 and the report:

```ts
  const expenditureRows = expenditureRowsByYear.flat();
```

```ts
  const report = {
    importLabel: "budget-facts-2004-2025",
    expenditureYears,
    detailedExpenditureYears,
    revenueYears,
    expenditureRows: expenditureRows.length,
    revenueRows: revenueRows.length,
    totalRows: rows.length,
  };
```

Also delete the now-unused `BudgetFactCsvRow` type import if `budgetFactsToCsv` no longer needs it — check with the typecheck in Step 11 and remove only what the compiler reports as unused.

In `apps/web/scripts/generate-real-revenue-facts.ts`: delete the `totalOnlyBudgetFacts` import (line 5), delete the `TOTAL_ONLY_BUDGET_FACTS.filter(...)` spread from the `facts` array, and delete the `totalOnlyRows` key from the report object.

- [ ] **Step 10: Delete the dead module and sync the two committed report artifacts**

```bash
git rm apps/web/lib/data/totalOnlyBudgetFacts.ts
```

Both report JSONs carry `totalOnlyRows` as their **last** key, so the scripts' new output differs from the committed files by exactly that trailing entry. Remove it by hand from `data/reports/budget-facts-2004-2025-compose-report.json` and `data/reports/real-revenue-2005-2025-report.json` (delete the `"totalOnlyRows": []` line and the trailing comma on the line above it). Do **not** re-run `npm run data:compose-budget-facts` — a full regeneration also rewrites the CSVs and would pull in the known `source_id` drift in the committed 2025 expenditure files, which is out of scope here.

Confirm both files still parse:

```bash
node -e "['budget-facts-2004-2025-compose-report','real-revenue-2005-2025-report'].forEach(n=>{const f=require('./data/reports/'+n+'.json');console.log(n,'ok, totalOnlyRows present:', 'totalOnlyRows' in f)})"
```

Expected: both `ok, totalOnlyRows present: false`.

- [ ] **Step 11: Full check**

```bash
npm run check --prefix apps/web
```

Expected: PASS. Typecheck will name any import left dangling by Step 9 — remove exactly those.

- [ ] **Step 12: Update the methodology doc**

In `docs/data-methodology/revenue-methodology.md`, replace any description of a total-only fallback tier with a sentence recording the decision:

```markdown
There is no total-only coverage tier. Every shipped revenue year is detailed
(2005–2025) or explicitly partial (2004). The official 2006 consolidated
receipts total is retained in `apps/web/lib/data/officialTotalBenchmarks.ts` as
a reconciliation benchmark: the detailed 2006 facts must sum back to it within
the revenue rounding tolerance, asserted in
`apps/web/tests/data/pipelineIntegration.test.ts`.
```

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "refactor: retire the unreachable total-only pipeline, keep the 2006 benchmark"
```

---

## Task 5: One shared URL hash vocabulary

**Finding 09.** `urlState.ts:122` states the intent in a comment — the municipalities section reuses `m`/`sh`/`r`/`sel` "so there is one vocabulary in the URL spec" — and then implements that vocabulary twice. A stated single vocabulary enforced by copy-paste is the case most likely to drift silently.

**Files:**
- Modify: `apps/web/lib/explorer/urlState.ts`
- Test: `apps/web/tests/explorer/urlState.test.ts`

**Interfaces:**
- Consumes: the existing `ChartMode` type and `selectionIds` helper.
- Produces (module-private, not exported):

```ts
type SharedHashState = { chartMode?: ChartMode; share?: boolean; range?: { start: number; end: number }; selection?: string[] };
function parseSharedHashKeys(params: URLSearchParams): SharedHashState;
function writeSharedHashKeys(params: URLSearchParams, input: { chartMode: ChartMode; share: boolean; rangeStart: number; rangeEnd: number; selectedIds: string[] }): void;
```

All four public functions — `parseExplorerHash`, `serializeExplorerHash`, `parseMunicipalHash`, `serializeMunicipalHash` — keep their exact current signatures and return shapes.

- [ ] **Step 1: Write the failing cross-section equivalence test**

Append to `apps/web/tests/explorer/urlState.test.ts`:

```ts
describe("shared hash vocabulary", () => {
  it("reads m, sh, r and sel identically on both sections", () => {
    const hash = "#g=fields&m=table&sh=1&r=2010-2020&sel=a,b,a";

    const explorer = parseExplorerHash(hash, "expenditure");
    const municipal = parseMunicipalHash(hash);

    expect(municipal.chartMode).toBe(explorer.chartMode);
    expect(municipal.share).toBe(explorer.share);
    expect(municipal.range?.start).toBe(explorer.range?.start);
    expect(municipal.range?.end).toBe(explorer.range?.end);
    expect(municipal.selection).toEqual(explorer.selection?.ids);
  });

  it("writes m, sh, r and sel identically on both sections", () => {
    const shared = { chartMode: "line" as const, share: false, rangeStart: 2015, rangeEnd: 2025, selectedIds: ["x", "y"] };

    const explorer = new URLSearchParams(
      serializeExplorerHash({
        nav: "revenue",
        grouping: "fields",
        analysisSide: "expenditure",
        analysisGrouping: "fields",
        analysisYear: null,
        ...shared,
      }),
    );
    const municipal = new URLSearchParams(serializeMunicipalHash(shared));

    for (const key of ["m", "sh", "r", "sel"]) {
      expect(municipal.get(key)).toBe(explorer.get(key));
    }
  });
});
```

- [ ] **Step 2: Run it**

```bash
npm test --prefix apps/web -- tests/explorer/urlState.test.ts
```

Expected: PASS. **This is a characterisation test, not a red-first test** — the two copies agree today; the test is what stops them drifting once the shared helper lands. Confirm it passes now so a later failure is unambiguously a regression. Add `parseMunicipalHash` and `serializeMunicipalHash` to the file's imports if they are not already there.

- [ ] **Step 3: Extract the shared helpers**

In `apps/web/lib/explorer/urlState.ts`, add below `selectionIds` (line 26):

```ts
// The budget explorer and the municipalities section share four hash keys —
// m mode, sh share, r range, sel selection — so there is one vocabulary in the
// URL spec (DESIGN.md §6.3). Both sections read and write them through these
// two helpers; each section adds only its own keys on top.
type SharedHashState = {
  chartMode?: ChartMode;
  share?: boolean;
  range?: { start: number; end: number };
  selection?: string[];
};

function parseSharedHashKeys(params: URLSearchParams): SharedHashState {
  const state: SharedHashState = {};

  const mode = params.get("m");
  if (mode === "line" || mode === "table") state.chartMode = mode;

  if (params.get("sh") === "1") state.share = true;

  const range = params.get("r");
  if (range && /^\d{4}-\d{4}$/.test(range)) {
    const [start = 0, end = 0] = range.split("-").map(Number);
    state.range = { start, end };
  }

  const selection = params.get("sel");
  if (selection !== null) state.selection = selectionIds(selection);

  return state;
}

function writeSharedHashKeys(
  params: URLSearchParams,
  input: { chartMode: ChartMode; share: boolean; rangeStart: number; rangeEnd: number; selectedIds: string[] },
): void {
  params.set("m", input.chartMode);
  if (input.share) params.set("sh", "1");
  params.set("r", `${input.rangeStart}-${input.rangeEnd}`);
  params.set("sel", input.selectedIds.join(","));
}
```

- [ ] **Step 4: Rewrite the four public functions to use them**

`parseExplorerHash` — replace the `m`, `sh`, `r`, `sel` blocks (lines 37-40 and 54-61) with, after the scope is computed:

```ts
    const shared = parseSharedHashKeys(params);
    if (shared.chartMode !== undefined) state.chartMode = shared.chartMode;
    if (shared.share !== undefined) state.share = shared.share;
    if (shared.range) state.range = { scope, start: shared.range.start, end: shared.range.end };
    if (shared.selection) state.selection = { scope, ids: shared.selection };
```

Note the ordering change: `scope` depends on `state.grouping`, which is read from `g` before this block, so keep the `g`/`as`/`ag`/`ay` reads and the `scope` computation exactly where they are and place the shared block after them.

`serializeExplorerHash` — replace lines 93-96 with:

```ts
  writeSharedHashKeys(params, input);
  return params.toString();
```

(the `if (input.nav === "expenditure") params.set("g", input.grouping);` line stays above it, so `g` still comes first).

`parseMunicipalHash` — the whole `try` body becomes:

```ts
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    return parseSharedHashKeys(params);
```

`serializeMunicipalHash` — the body becomes:

```ts
  const params = new URLSearchParams();
  writeSharedHashKeys(params, input);
  return params.toString();
```

`MunicipalUrlState` is now structurally identical to `SharedHashState`; keep the exported alias so callers do not change:

```ts
export type MunicipalUrlState = SharedHashState;
```

- [ ] **Step 5: Run the URL tests and confirm all pass**

```bash
npm test --prefix apps/web -- tests/explorer/urlState.test.ts
```

Expected: PASS, including every pre-existing round-trip case.

- [ ] **Step 6: Full check and build to close Stage B**

```bash
npm run check --prefix apps/web && npm run build --prefix apps/web
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/explorer/urlState.ts apps/web/tests/explorer/urlState.test.ts && git commit -m "refactor: share the m/sh/r/sel hash vocabulary between both sections"
```

**Stage B complete. Pause for review.**

---

# Stage C — Municipal KPI and count contracts

Findings 06, 13, 17, 21. Touches components and routes, so this stage requires `npm run test:browser`. No overlap with the homepage branch.

## Task 6: Named KPI record instead of a positional array

**Findings 06 and 21.** `buildEntityKpis` and `buildCountryKpis` compute the same three KPIs with identical expressions and differ only in the fourth card; the copy direction is visible because `buildCountryKpis` carries the same code with the explanatory comment stripped. Downstream, `municipal-indicators.tsx:61` does `const sideKpis = [kpis[0]!, kpis[2]!, kpis[3]!]` and pairs it positionally with `sideSeries[index]!` at line 136 — so adding or reordering a KPI silently pairs the wrong sparkline with the wrong card.

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts:479-602`
- Modify: `apps/web/components/municipalities/municipal-indicators.tsx:37-61,121-136`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx:140-143`
- Test: `apps/web/tests/explorer/municipalData.test.ts`

**Interfaces:**
- Consumes: `MunicipalEntityModel`, `MunicipalKpi`, `MunicipalEntityKpiInput`, `sortedByEndYear`, `changeBetween`, `formatAmountParts`, `formatAmount`, `formatShare`, `georgianOrdinal`, `MISSING` — all already in `municipalData.ts`.
- Produces:

```ts
export type MunicipalKpiSet = {
  official: MunicipalKpi;   // headline: official budget, end year
  growth: MunicipalKpi;     // start -> end growth (the hero card)
  largestField: MunicipalKpi;
  standing: MunicipalKpi;   // rank on entity pages, budget count on the country page
};
export function buildEntityKpis(input: MunicipalEntityKpiInput): MunicipalKpiSet;
export function buildCountryKpis(model: MunicipalEntityModel, budgetCount: number): MunicipalKpiSet;
```

`MunicipalIndicators` takes `kpis: MunicipalKpiSet` instead of `kpis: MunicipalKpi[]`, and pairs each side card with its series by name rather than by index.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/municipalData.test.ts`. It reuses the file's existing `build(startYear = 2015, endYear = 2017)` model helper (line 125) — do not add a new fixture.

```ts
describe("municipal KPI sets", () => {
  const nationalTotalByYear = { 2016: 740, 2017: 740 };
  const rankByYear = { 2015: 1, 2016: 1, 2017: 1 };

  it("names every card so consumers never index positionally", () => {
    const entity = buildEntityKpis({ model: build(), nationalTotalByYear, rankByYear, rankOutOf: 64 });
    const country = buildCountryKpis(build(), 69);

    expect(Object.keys(entity)).toEqual(["official", "growth", "largestField", "standing"]);
    expect(Object.keys(country)).toEqual(["official", "growth", "largestField", "standing"]);
  });

  it("computes the three shared cards identically for entity and country views", () => {
    const model = build();
    const entity = buildEntityKpis({ model, nationalTotalByYear, rankByYear, rankOutOf: 64 });
    const country = buildCountryKpis(model, 69);

    expect(country.official).toEqual(entity.official);
    expect(country.growth).toEqual(entity.growth);
    expect(country.largestField).toEqual(entity.largestField);
  });

  it("differs only in the standing card", () => {
    const country = buildCountryKpis(build(), 69);

    expect(country.standing.label).toBe("მუნიციპალური ბიუჯეტები");
    expect(country.standing.value).toBe("69");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npm test --prefix apps/web -- tests/explorer/municipalData.test.ts
```

Expected: FAIL — `Object.keys` on an array returns `["0","1","2","3"]`.

- [ ] **Step 3: Extract the shared three cards and return a named record**

In `apps/web/lib/explorer/municipalData.ts`, add above `buildEntityKpis`:

```ts
export type MunicipalKpiSet = {
  official: MunicipalKpi;
  growth: MunicipalKpi;
  largestField: MunicipalKpi;
  standing: MunicipalKpi;
};

/**
 * The three cards every municipal view shares. Only the fourth — standing —
 * differs: entity pages show rank, the country page shows the budget count.
 */
function buildSharedMunicipalKpis(model: MunicipalEntityModel): Omit<MunicipalKpiSet, "standing"> {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);
  const officialStart = startYear === undefined ? null : model.totalRow.valuesByYear[startYear] ?? null;
  const officialEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const officialEndParts = formatAmountParts(officialEnd);
  const growth = changeBetween(officialStart, officialEnd);
  const largest = sortedByEndYear(model.rows, endYear)[0];
  const largestValue = largest && endYear !== undefined ? largest.valuesByYear[endYear] ?? 0 : 0;

  return {
    official: {
      label: "ოფიციალური ბიუჯეტი",
      value: officialEndParts.num,
      unit: officialEndParts.unit,
      detail: `${endYear ?? ""} · ფინანსთა სამინისტროს ჯამი`,
    },
    growth: {
      label: `ზრდა ${startYear ?? ""}-დან`,
      // MISSING and the U+2212 minus come from format.ts — never hand-write
      // either (Global Constraints). formatShare's third argument is the
      // decimal count, so a 0-decimal signed percent does not have to build its
      // own sign. Zero growth renders "0%", not "+0%".
      value: growth === null ? MISSING : formatShare(growth, true, 0),
      detail: `${formatAmount(officialStart)} → ${formatAmount(officialEnd)}`,
    },
    largestField: {
      label: "უმსხვილესი სფერო",
      value: officialEnd ? formatShare(largestValue / officialEnd) : MISSING,
      detail: largest?.kaLabel ?? "",
    },
  };
}
```

Replace the two builders' bodies:

```ts
/** The four entity KPIs, for both municipality and region pages. */
export function buildEntityKpis(input: MunicipalEntityKpiInput): MunicipalKpiSet {
  const { model, nationalTotalByYear } = input;
  const endYear = model.years.at(-1);
  const officialEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const nationalEnd = endYear === undefined ? 0 : nationalTotalByYear[endYear] ?? 0;
  const rank = endYear === undefined ? 0 : input.rankByYear[endYear] ?? 0;

  return {
    ...buildSharedMunicipalKpis(model),
    standing: {
      label: "წილი მუნიციპალურ ხარჯებში",
      value: nationalEnd > 0 && officialEnd !== null ? formatShare(officialEnd / nationalEnd) : MISSING,
      // `detail` is this municipality's ordinal rank for the selected period.
      // The index has a separate fixed-2025 per-resident comparison, so this
      // selected-range KPI remains rank rather than implying population
      // coverage across every year in the range.
      detail: `${georgianOrdinal(rank)} ადგილი ${input.rankOutOf}-დან`,
    },
  };
}

/** The country view has no rank because it is the aggregate denominator itself. */
export function buildCountryKpis(model: MunicipalEntityModel, budgetCount: number): MunicipalKpiSet {
  return {
    ...buildSharedMunicipalKpis(model),
    standing: {
      label: "მუნიციპალური ბიუჯეტები",
      value: String(budgetCount),
      detail: `${MUNICIPAL_PUBLIC_PAGE_COUNT} საჯარო გვერდი · ${MUNICIPAL_AGGREGATE_ONLY_COUNT} მხოლოდ საქართველოს ჯამში`,
    },
  };
}
```

`MUNICIPAL_PUBLIC_PAGE_COUNT` and `MUNICIPAL_AGGREGATE_ONLY_COUNT` are introduced in Task 7 — until then, keep the literal string `"64 საჯარო გვერდი · 5 მხოლოდ საქართველოს ჯამში"` here and swap it in Task 7 Step 3. Do not leave a reference to a constant that does not exist yet.

- [ ] **Step 4: Update the two consumers**

In `apps/web/components/municipalities/municipal-indicators.tsx`, change the props type and the side-card rendering. Replace `kpis: MunicipalKpi[]` with `kpis: MunicipalKpiSet` in `MunicipalIndicatorsProps`, update the `MunicipalKpi` import to also bring in `MunicipalKpiSet`, and replace line 61:

```ts
  const sideKpis = [kpis.official, kpis.largestField, kpis.standing];
```

The hero keeps using `kpis.growth`. `sideSeries[index]!` at line 136 stays index-paired with `sideKpis`, which is now built from named fields in a fixed order — read the surrounding block and confirm the three series still line up with official / largestField / standing before moving on.

In `apps/web/components/municipalities/municipal-explorer.tsx`, no call-site change is needed — `buildCountryKpis(model, metrics.budgetCount)` and `buildEntityKpis({ model, ...metrics })` keep their argument shapes. The typecheck will flag any place that still treats `kpis` as an array.

- [ ] **Step 5: Convert the existing tests' positional reads to named fields**

`tests/explorer/municipalData.test.ts` reads these builders by index in twelve places. Mechanical substitution, no assertion values change:

| Old | New |
|---|---|
| `[0]!` | `.official` |
| `[1]!` | `.growth` |
| `[2]!` | `.largestField` |
| `[3]!` / `[3]` | `.standing` |

Named sites: line 728 `countryKpis[3]`, line 737 `buildCountryKpis(build(), 69)[0]!`, line 987 `divergent[3]!`, and the `[0]!` / `[3]!` reads throughout the `describe("buildEntityKpis")` block (lines 991–1140). Find them all with:

```bash
grep -n "buildEntityKpis\|buildCountryKpis\|kpis\[\|divergent\[\|missing\[\|clipped\[\|fifth\[\|historical\[" apps/web/tests/explorer/municipalData.test.ts
```

The line 728 assertion asserts `detail: "64 საჯარო გვერდი · 5 მხოლოდ საქართველოს ჯამში"` — Task 7 interpolates that string from constants but produces the identical text, so the assertion stays as it is.

- [ ] **Step 6: Run the tests and confirm all pass**

```bash
npm test --prefix apps/web -- tests/explorer/municipalData.test.ts && npm run typecheck --prefix apps/web
```

Expected: PASS, and typecheck clean.

- [ ] **Step 7: Full check plus browser tests**

```bash
npm run check --prefix apps/web && npm run build --prefix apps/web && npm run test:browser --prefix apps/web
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/explorer/municipalData.ts apps/web/components/municipalities apps/web/tests/explorer/municipalData.test.ts && git commit -m "refactor: name the municipal KPI cards and share their common calculations"
```

---

## Task 7: One source of truth for 64 / 5 / 69

**Findings 13 and 17.** `MUNICIPAL_COUNTRY_BUDGET_COUNT = 69` is declared at `municipalData.ts:27` and the same fact is re-encoded seven more ways: a raw literal in a Georgian subtitle at line 283, `"64 საჯარო გვერდი · 5 მხოლოდ საქართველოს ჯამში"` at line 560, a literal **type** `budgetCount: 69` in two components, and hardcoded `69` in three route files. The literal type is why the routes hardcode: `MUNICIPAL_COUNTRY_BUDGET_COUNT` is typed `number` and will not flow into a `69` slot.

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts:27,283,560`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx:41`
- Modify: `apps/web/components/municipalities/entity-picker.tsx:34`
- Modify: `apps/web/app/explorer/municipalities/georgia/page.tsx:23,75,79,89,92`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx:161`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx:131`
- Test: `apps/web/tests/explorer/municipalData.test.ts`

**Interfaces:**
- Produces, from `lib/explorer/municipalData.ts`:

```ts
export const MUNICIPAL_PUBLIC_PAGE_COUNT: number;      // 64 — municipalities with a public page
export const MUNICIPAL_AGGREGATE_ONLY_COUNT: number;   // 5  — occupied-territory bodies, country total only
export const MUNICIPAL_COUNTRY_BUDGET_COUNT: number;   // 69 — the two above, summed
```

- Consumes: `MUNICIPAL_COUNTRY_BUDGET_COUNT` is already imported by `lib/explorer/hubCards.ts:2` and `app/explorer/municipalities/page.tsx:11` — those call sites are already correct and need no change.

**Scope note:** the re-audit's "derive from the registry" option is deliberately not taken. The served municipality list is loaded asynchronously per route, while these counts are needed in static metadata and in a literal type position. Three exported constants with a test asserting the arithmetic gives the single-source-of-truth benefit without threading async data into `generateMetadata`. The excluded-code set (`"05"`, `"42"`, `"43"`, `"46"`, `"64"`) already lives in `lib/data/municipal/generateMunicipalFacts.ts:31`; the test below pins the two against each other.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/municipalData.test.ts`:

```ts
describe("municipal budget counts", () => {
  it("keeps the public, aggregate-only and total counts arithmetically consistent", () => {
    expect(MUNICIPAL_PUBLIC_PAGE_COUNT + MUNICIPAL_AGGREGATE_ONLY_COUNT).toBe(MUNICIPAL_COUNTRY_BUDGET_COUNT);
    expect(MUNICIPAL_COUNTRY_BUDGET_COUNT).toBe(69);
  });

  it("matches the excluded municipal codes the fact generator drops", () => {
    // Municipal codes 05, 42, 43, 46 and 64 are budgets that are not
    // territorially attributable spending inside those municipalities, so they
    // have no public page and appear only inside the Georgia total.
    expect(MUNICIPAL_AGGREGATE_ONLY_COUNT).toBe(5);
  });
});
```

Add the three constants to the file's import from `../../lib/explorer/municipalData`.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npm test --prefix apps/web -- tests/explorer/municipalData.test.ts
```

Expected: FAIL — `MUNICIPAL_PUBLIC_PAGE_COUNT` is not exported.

- [ ] **Step 3: Export the three constants and interpolate them**

In `apps/web/lib/explorer/municipalData.ts`, replace line 27:

```ts
// Municipal budget-unit counts. 64 municipalities get a public page; five
// occupied-territory bodies (codes 05, 42, 43, 46, 64 — see
// lib/data/municipal/generateMunicipalFacts.ts) are excluded from the public
// list because their budgets are not territorially attributable spending, and
// appear only inside the Georgia total. Every Georgian string that states one
// of these numbers interpolates it from here.
export const MUNICIPAL_PUBLIC_PAGE_COUNT = 64;
export const MUNICIPAL_AGGREGATE_ONLY_COUNT = 5;
export const MUNICIPAL_COUNTRY_BUDGET_COUNT = MUNICIPAL_PUBLIC_PAGE_COUNT + MUNICIPAL_AGGREGATE_ONLY_COUNT;
```

Line 283:

```ts
    subtitleKa: `${MUNICIPAL_COUNTRY_BUDGET_COUNT} მუნიციპალური ბიუჯეტი`,
```

And in `buildCountryKpis` (Task 6 Step 3), swap the placeholder literal for:

```ts
      detail: `${MUNICIPAL_PUBLIC_PAGE_COUNT} საჯარო გვერდი · ${MUNICIPAL_AGGREGATE_ONLY_COUNT} მხოლოდ საქართველოს ჯამში`,
```

- [ ] **Step 4: Widen the two literal types**

`apps/web/components/municipalities/municipal-explorer.tsx:41`:

```ts
  | { kind: "country"; budgetCount: number };
```

`apps/web/components/municipalities/entity-picker.tsx:34`:

```ts
  budgetCount: number;
```

- [ ] **Step 5: Replace the route literals with the constant**

In each of `app/explorer/municipalities/georgia/page.tsx`, `region/[id]/page.tsx` and `[code]/page.tsx`, import `MUNICIPAL_COUNTRY_BUDGET_COUNT` from `../../../../lib/explorer/municipalData` (adjust the depth per file — `georgia/page.tsx` is four levels up, `region/[id]/page.tsx` is five) and replace every `budgetCount: 69` with `budgetCount: MUNICIPAL_COUNTRY_BUDGET_COUNT`.

In `georgia/page.tsx`, also interpolate the four Georgian strings that spell the number — lines 23, 75, 92 — for example:

```ts
    description: `საქართველოს ${MUNICIPAL_COUNTRY_BUDGET_COUNT} მუნიციპალური საბიუჯეტო ერთეულის და აჭარის ა.რ. გაერთიანებული გადასახდელები, შიდა ტრანსფერების გამოკლებით, ${firstYear}–${lastYear}.`,
```

```ts
          metaLine={`${MUNICIPAL_COUNTRY_BUDGET_COUNT} მუნიციპალური საბიუჯეტო ერთეული + აჭარის ა.რ. · ${firstYear}–${latestYear}`}
```

For the long `sourceNote` on line 92, replace the two numerals in place: `69 ოფიციალურ` → `${MUNICIPAL_COUNTRY_BUDGET_COUNT} ოფიციალურ`, and `ხუთი ოკუპირებულ` → `${MUNICIPAL_AGGREGATE_ONLY_COUNT} ოკუპირებულ`. **Read the sentence before editing** — `ხუთი` is the Georgian word "five", not a numeral, so confirm with the user whether the numeral reads acceptably there before changing it; if not, leave that one word alone and note it.

- [ ] **Step 6: Confirm no bare 69 survives in municipal code**

```bash
grep -rn "69" apps/web/lib/explorer/municipalData.ts apps/web/components/municipalities apps/web/app/explorer/municipalities
```

Expected: only the arithmetic in the constant block, if anything.

- [ ] **Step 7: Full check, build, browser tests**

```bash
npm run check --prefix apps/web && npm run build --prefix apps/web && npm run test:browser --prefix apps/web
```

Browser tests matter here: `tests/browser/municipalities.spec.ts` asserts on rendered Georgian strings that this task rewrites.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib apps/web/components/municipalities apps/web/app/explorer/municipalities apps/web/tests && git commit -m "refactor: derive the 64/5/69 municipal counts from one place"
```

**Stage C complete. Pause for review.**

---

# Stage D — Share semantics (BLOCKED)

Findings 14, 10, and the targeted part of 23.

> **Do not start Stage D until `codex/homepage-redesign` has merged into `main` or has been deliberately synchronised.** Stage D edits `apps/web/components/main-explorer/main-explorer.tsx`, which that branch also edits, and the branches additionally carry a real semantic conflict in `DESIGN.md`. Re-run Task 0 Step 1 to check.

**Correction to the original audit, carried forward from the re-audit:** the original finding 10 claimed the chart, table, and workbook currently disagree about the same cell. They do not — the three intentionally use different boundary units (percent for the chart, fraction for the table and for Excel, because Excel percentage formatting expects fractions), and the browser tests already pin the workbook values. The real problem is the one finding 14 names: `shareEndYear` carries **share of GDP** when `explorerData.ts` fills it and **share of the entity's own total** when `municipalData.ts` fills it, on the same `ExplorerTableRow` type, with correctness resting entirely on each caller passing a matching `shareColumnLabel` prop. This stage removes the ambiguous field rather than renaming around it.

## Task 8: Remove `shareEndYear`; derive the final-year share through the existing callback

**Files:**
- Create: `apps/web/lib/explorer/share.ts`
- Create: `apps/web/tests/explorer/share.test.ts`
- Modify: `apps/web/lib/explorer/types.ts:53`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx:109,130`
- Modify: `apps/web/lib/explorer/explorerData.ts:441`
- Modify: `apps/web/lib/explorer/municipalData.ts:122,146`
- Modify: `apps/web/components/main-explorer/indicators.tsx:128`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx:159,~200,~366`

**Interfaces:**
- Produces:

```ts
/** Fraction of a total. Null when the total is missing, zero, or non-finite. */
export function shareOfTotal(amount: number | null | undefined, total: number | null | undefined): number | null;
```

`ExplorerTable` keeps its `shareValueForYear: (row, year) => number | null` prop and uses it for the end-year column too; `shareColumnLabel` stays, because the label is genuinely caller-owned copy ("წილი მშპ-ში" vs "წილი") — what changes is that the *value* now comes from the same callback that fills every other share cell, so label and value can no longer disagree.

- [ ] **Step 1: Write the failing test for the helper**

Create `apps/web/tests/explorer/share.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shareOfTotal } from "../../lib/explorer/share";

describe("shareOfTotal", () => {
  it("returns the fraction for ordinary values", () => {
    expect(shareOfTotal(25, 100)).toBe(0.25);
  });

  it("returns null when either side is missing", () => {
    expect(shareOfTotal(null, 100)).toBeNull();
    expect(shareOfTotal(undefined, 100)).toBeNull();
    expect(shareOfTotal(25, null)).toBeNull();
    expect(shareOfTotal(25, undefined)).toBeNull();
  });

  it("returns null for a zero, negative, or non-finite total", () => {
    expect(shareOfTotal(25, 0)).toBeNull();
    expect(shareOfTotal(25, -100)).toBeNull();
    expect(shareOfTotal(25, Number.NaN)).toBeNull();
    expect(shareOfTotal(25, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("keeps a zero numerator as zero, not null", () => {
    expect(shareOfTotal(0, 100)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npm test --prefix apps/web -- tests/explorer/share.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

Create `apps/web/lib/explorer/share.ts`:

```ts
/**
 * One share formula for the whole explorer. Returns a FRACTION, never a
 * percent: the chart multiplies by 100 at its own boundary, and the table and
 * the Excel workbook both consume fractions directly (Excel percentage
 * formatting expects a fraction).
 *
 * A total that is missing, zero, negative or non-finite yields null rather than
 * Infinity, NaN or a sign-flipped share, so the chart, the table and the
 * downloaded workbook cannot disagree about the same cell.
 */
export function shareOfTotal(
  amount: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (amount === null || amount === undefined) return null;
  if (total === null || total === undefined) return null;
  if (!Number.isFinite(total) || total <= 0) return null;
  return amount / total;
}
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
npm test --prefix apps/web -- tests/explorer/share.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit the helper before touching the model**

```bash
git add apps/web/lib/explorer/share.ts apps/web/tests/explorer/share.test.ts && git commit -m "feat: add one shared share-of-total helper"
```

- [ ] **Step 6: Remove `shareEndYear` from the row type and both builders**

`apps/web/lib/explorer/types.ts` — delete line 53 (`shareEndYear: number | null;`).

`apps/web/lib/explorer/explorerData.ts` — delete line 441 (`shareEndYear: ...`). The `shareByYear` map it read from stays; it is what `shareValueForYear` already consults.

`apps/web/lib/explorer/municipalData.ts` — delete lines 122 and 146.

The typecheck now names every consumer. Work them in Step 7.

- [ ] **Step 7: Point the table's end-year column at the callback**

In `apps/web/components/main-explorer/explorer-table.tsx`, replace line 109:

```tsx
                {endYear === undefined ? MISSING : formatShare(shareValueForYear(row, endYear))}
```

and line 130:

```tsx
                {endYear === undefined ? MISSING : formatShare(shareValueForYear(totalRow, endYear))}
```

`endYear` is already in scope (`const endYear = years.at(-1);` on line 32, typed `number | undefined`, which is why the guard is needed) and `MISSING` is already imported on line 2.

In `apps/web/components/main-explorer/indicators.tsx:128`, the row's GDP share is already on the row as the optional `shareByYear` map — read it directly rather than threading a new prop:

```ts
      value: largestShare ? formatShare(largestShare.shareByYear?.[endYear] ?? null) : MISSING,
```

`endYear` is narrowed to `number` by the `if (startYear === undefined || endYear === undefined) return null;` guard on line 65, so no extra check is needed here.

In `apps/web/components/municipalities/municipal-explorer.tsx`, replace all three hand-written share formulas with `shareOfTotal`. Exact sites:

Line 155, the chart series — the only one that multiplies, because the chart's boundary unit is percent:

```ts
        if (!state.share) return value;
        const fraction = shareOfTotal(value, total);
        return fraction === null ? null : fraction * 100;
```

(`value` and `total` are already declared as locals on the two lines above; the callback already has a block body, so this replaces only its `return` statement).

**Deliberate behaviour change, flag it in review:** all three sites currently guard only `total === 0` or falsy-`total`, so a **negative** total would produce a sign-flipped share. `shareOfTotal` returns `null` there instead. Municipal amount validation already rejects negative public totals, so no valid data reaches that branch — this closes the gap rather than changing any rendered number. If `test:browser` shows a changed value, stop: it means the assumption is wrong.

Lines 196-199, the workbook export — Excel percentage formatting expects a fraction, so no multiply:

```ts
              measureValue: state.share ? shareOfTotal(amountGel, total) : undefined,
```

Line 364, the table cell — also a fraction:

```ts
                return shareOfTotal(amount, total);
```

- [ ] **Step 8: Full check, build, browser tests**

```bash
npm run check --prefix apps/web && npm run build --prefix apps/web && npm run test:browser --prefix apps/web
```

The browser suite is the real gate here: `tests/browser/main-explorer.spec.ts` and `tests/browser/municipalities.spec.ts` pin the rendered share column and the downloaded workbook values. **Any change in those numbers is a regression, not an improvement** — the pre-existing values are correct.

- [ ] **Step 9: Commit**

```bash
git add apps/web && git commit -m "refactor: remove the dual-meaning shareEndYear field and unify the share formula"
```

---

## Task 9: Extract the duplicated indicator presentation (optional, last)

**Finding 05.** `components/main-explorer/indicators.tsx` (323 lines) and `components/municipalities/municipal-indicators.tsx` (223 lines) render the same section with byte-identical Tailwind strings — down to `grid-cols-[24px_minmax(0,1fr)_96px_72px]` in both `MoverRow` components. They have already drifted: the budget version colours the change cell via an inline ternary, the municipal version calls `growthColor()`.

This is real maintenance debt but **not** a correctness defect, and the re-audit downgraded it from High to "Medium/later". Do it only if the reviewer wants it in this branch; otherwise it is a clean follow-up.

**Approach if taken:** extract only the genuinely shared presentational pieces into `components/ui/` — `MoverRow`, `SideKpiColumn`, `PeriodGauge`, `PeriodComparisonTable` — each taking plain data props (label, value, unit, detail, spark, colour) and knowing nothing about either model. Do **not** build one abstraction that mixes national and municipal business rules. `SeriesSelector` is the precedent: it is already shared between the two explorers exactly this way.

Gate: `npm run check`, `npm run build`, `npm run test:browser` must all pass, and no rendered pixel may change. If `test:browser` shows any visual diff, the extraction is wrong.

---

# Closed with no change

These findings were audited and deliberately need no code change. Recording them here so they are not re-raised.

| # | Finding | Decision |
|---|---|---|
| 01 | Dead `SourceMetadata` pipeline | **Already resolved** on `main`. Verified: no `sourceByYear`, `SourceMetadata`, or `sourceMetadataFor` in `lib/`, `components/`, `app/`, `scripts/`. |
| 03 | `EXPENDITURE_SOURCE_YEARS` duplicates `EXPENDITURE_DETAILED_YEARS` | No change. Same values today, different concepts: source availability vs. shipped detailed coverage. |
| 04 | Unused `@/*` alias, 71 deep relative imports | No change. A 71-file import rewrite is noise that would collide with every open branch. Revisit when the tree is quiet. |
| 07 | Duplicated helpers | Mostly stale. The `sourceMetadataFor` copies are gone with finding 01. `changeBetween`'s divergence cannot fire: municipal amount validation rejects negative public totals. Remaining `totalIdFor` / `clampYear` duplication is two lines each. |
| 08 | Duplicated mirror row mappings | Optional. The audit's risk claim was wrong: import parity compares each returned database object field-by-field against its reviewed CSV, so a one-sided omission **would** be caught. |
| 16 | Hardcoded coverage constants | Mostly no change. `MUNICIPAL_PER_RESIDENT_YEAR = 2025` is an approved population-data contract. `SERIES_ORDER_BASE_YEAR = 2025` is pinned by tests — **decide deliberately before 2026 data lands** whether series ordering should stay stable or follow the latest year. Do not change it as cleanup. |
| 19 | `buildExplorerModel` size | Partly stale; `main` already reduced it to 471 lines total for the file. A small helper unifying its two total computations is worthwhile if that code is opened for another reason. |
| 20 | Hero scene effect and broad `try` | **Rejected.** The audit misread the control flow: the animation updater has its own frame-level try/catch, and the outer catch covers synchronous scene initialisation. A Three.js rewrite is high-risk and not justified by this audit. |
| 22 | Import-time geometry read | Optional. Tests intentionally validate the real production artifact. Split only if portability becomes a real requirement. |
| 23 | Blanket "add `tests/**/*.test.tsx`" | **Rejected as stated.** Adding the glob creates no rendering environment — Vitest still runs in Node with no jsdom and no component testing library. The targeted extractions in Tasks 6 and 8 are the part worth doing. |
| 24 | 825 recomputed municipal rankings | No change. Benchmarked at ~24 ms total, ~0.03 ms per call. Memoisation would cost more complexity than it buys. |

# Deferred: standalone hardening project

**Finding 11, global part — `noUncheckedIndexedAccess`.** A clean experiment at `main` produced **401 new diagnostics**: 200 in tests, 175 in library/data code, 22 in components, 4 in scripts. These are not 401 bugs; most are valid array invariants TypeScript cannot prove.

Do not fold this into a feature, into the homepage work, or into this remediation branch. It needs its own plan: classify the diagnostics first, fix the runtime and data-parsing paths first, express proven invariants explicitly rather than sprinkling fallback values, and enable the flag only once the full gate is green. The one concrete defect the flag would have caught is already fixed in Task 2.

---

## Merge order and gating

1. Stage A — mergeable immediately. Six files, zero homepage overlap.
2. Stage B — mergeable after A. Touches data scripts, coverage constants, committed report artifacts, and `urlState.ts`.
3. Stage C — mergeable after B. Requires `npm run test:browser`.
4. Stage D — **blocked** until `codex/homepage-redesign` merges or is deliberately synchronised. Re-check Task 0 Step 1 before starting.

Each stage ends green on `npm run check` + `npm run build` (Stages C and D also on `npm run test:browser`), and CI must be green before any merge. Do not push or open a PR without explicit authorization.
