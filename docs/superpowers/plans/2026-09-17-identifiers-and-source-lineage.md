# Identifiers and Source Lineage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- The deficit series has one stable ID everywhere.
- Debt facts cite source-registry IDs, with lineage owned by the data layer and enforced by a foreign key and an import check.
- The stock total is checked against the published total.
- The debt and deficit mirror tables revoke public access like every later table.

**Architecture:**
- **Deficit ID:** the explorer adopts the query service's `DEFICIT_SERIES_ID` and keeps a parse-only alias for old links.
- **Debt lineage:** a new `lib/data/governmentDebt/sourceLineage.ts` owns which documents a debt fact rests on. The explorer workbook matches archive rows by registry `sourceId` instead of filename substrings.
- **Order of change:**
  1. A golden test pins today's debt workbook source sheet.
  2. Lineage moves.
  3. The canonical CSV switches to `source.*` IDs, and the query service drops its translations.
  4. The mirror gains the foreign key and the import gains its check.
- **Stock totals:** the debt package parser reads the published "Total Government Debt" row, and prepare fails if a component sum strays more than half a published unit.
- Two migrations close the mirror work.

**Tech Stack:** TypeScript, Vitest 4, Playwright, Prisma 7 (PostgreSQL), zod, Decimal.js.

**Spec:** `docs/superpowers/specs/2026-09-17-identifiers-and-source-lineage-design.md`

## Execution amendments (2026-09-19)

- Task 1 follows the spec's removal of the fallback English label: the model requires the presentation already passed by every production caller. Its test checks the rendered model label against the reviewed catalogue. Old links are retained as parser-only aliases.
- Task 1's browser acceptance is grouped with Task 8 on the final production build. Its unit, reference, translation and type checks passed before the implementation commit.
- Task 4 attaches the foreign key to the existing nullable `sourceId`, avoiding a duplicate source column. The migration normalizes existing rows first. Opt-in tests in `tests/data/governmentDebt/mirrorIntegration.test.ts` exercise a disposable local PostgreSQL database through `GEODATA_TEST_DATABASE_URL`.
- Task 5 adds real rejection tests: raised and lowered published totals, and an altered external component, must stop preparation with the affected year in the error. A passing unmodified package alone does not verify this failure path.
- The two migrations have been applied to a populated disposable PostgreSQL 17.10 database. Source constraints and both API-role revocations passed their failure-then-success checks. Production has not been modified.

## Global Constraints

- **Branch and paths:** work on `codex/identifiers-and-source-lineage`, created from `main`. Never commit to `main`. Commands run from `apps/web`; repository-root paths are written `../../…`.
- **Surviving deficit ID:** `deficit.general_government.balance`, as published by `/mcp` and the JSON publications. Old explorer links with `deficit.general_government_balance` keep selecting the series.
- **Reference fixture:** `npx vitest run tests/factQuery/reference.test.ts` must pass **unchanged**. A disagreement is a stop condition (CLAUDE.md, definition of done, item 4).
- **Values are untouched.** No debt or deficit value, status, year or coverage changes. The regenerated `data/imports/government-debt-facts-2013-2030.csv` may differ only in its `source_id` column. The debt package CSVs under `docs/Raw Data/Debt/government-debt-annual/` keep their bare manifest IDs (for example `mof_public_debt_bulletin_n25`).
- **Migrations:** never rename an applied migration. New migrations are hand-written SQL that matches `prisma/schema.prisma`, per `docs/data-methodology/database-import.md`.
- **Methodology docs:** data changes update their methodology document in the same change (CLAUDE.md, definition of done, item 3).
- **Test loop:** targeted tests while editing; the full gates run once, in Task 8.

---

### Task 1: One deficit series ID

**Files:**
- Modify: `apps/web/lib/explorer/deficitExplorer.ts` (lines 1–14)
- Modify: `apps/web/lib/explorer/deficitUrlState.ts` (import at line 1; the selection check at lines 26–30)
- Modify: `apps/web/lib/pages/deficit.tsx:36`
- Modify: `apps/web/lib/i18n/inventory.server.ts` (import at line 5; label list at line 49)
- Modify: `../../data/localization/en/labels.json` (delete lines 826–829)
- Test: `apps/web/tests/explorer/deficitExplorer.test.ts:24`
- Test: `apps/web/tests/explorer/deficitUrlState.test.ts:12`
- Test: `apps/web/tests/explorer/deficitRoute.test.tsx:11`, `:47`
- Test: `apps/web/tests/explorer/deficitWorkbook.test.ts:15`
- Test: `apps/web/tests/browser/deficit.spec.ts:20-21`

**Interfaces:**
- Consumes: `DEFICIT_SERIES_ID = "deficit.general_government.balance"` from `lib/factQuery/types.ts:293` (that module has type-only imports, so it is safe for client bundles).
- Produces: `lib/explorer/deficitExplorer.ts` re-exports that constant and defines none of its own. `DEFICIT_ITEM.id === DEFICIT_SERIES_ID`.

- [x] **Step 1: Write the failing tests**

In `apps/web/tests/explorer/deficitExplorer.test.ts`, line 24 becomes:

```ts
    expect(DEFICIT_SERIES_ID).toBe("deficit.general_government.balance");
```

Append inside the `describe` block:

```ts
  it("keeps the fallback English label identical to the reviewed catalogue", async () => {
    const { DEFICIT_ITEM } = await import("../../lib/explorer/deficitExplorer");
    const labels = (await import("../../../../data/localization/en/labels.json")).default as Record<string, { text: string }>;
    expect(DEFICIT_ITEM.id).toBe(DEFICIT_SERIES_ID);
    expect(labels[DEFICIT_SERIES_ID]?.text).toBe(DEFICIT_ITEM.enLabel);
    expect(labels["deficit.general_government_balance"]).toBeUndefined();
  });
```

In `apps/web/tests/explorer/deficitUrlState.test.ts`, line 12 becomes:

```ts
    })).toBe("m=table&sh=0&r=2001-2026&sel=deficit.general_government.balance");
```

Append inside the `describe` block:

```ts
  it("still selects the series from links shared with the old explorer id", () => {
    expect(parseDeficitHash("#sel=deficit.general_government_balance").selected).toBe(true);
    expect(parseDeficitHash("#sel=deficit.general_government.balance").selected).toBe(true);
  });
```

- [x] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/explorer/deficitExplorer.test.ts tests/explorer/deficitUrlState.test.ts`
Expected: FAIL. The constant is still `deficit.general_government_balance`, the serialized hash uses it, and `labels.json` still has the old key.

- [x] **Step 3: Adopt the query-service constant**

In `apps/web/lib/explorer/deficitExplorer.ts`, replace lines 1–14 with:

```ts
import type { ServedGeneralGovernmentBalanceFact } from "../servedRows";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { DEFICIT_SERIES_ID } from "../factQuery/types";
import { INK } from "./colors";
import type { ExplorerTableRow } from "./types";

// One id for the explorer, /mcp and the JSON publications (spec 2026-09-04 §41).
export { DEFICIT_SERIES_ID };

export const DEFICIT_ITEM = {
  id: DEFICIT_SERIES_ID,
  kaLabel: "ზოგადი მთავრობის ბალანსი",
  // Only used when no presentation is passed; a test holds it equal to labels.json.
  enLabel: "General government balance",
  color: INK,
} as const;
```

- [x] **Step 4: Accept the old id in links**

In `apps/web/lib/explorer/deficitUrlState.ts`, replace line 1 with:

```ts
import { DEFICIT_SERIES_ID } from "./deficitExplorer";

// The explorer's id before 2026-09-17. Parsed so shared links keep working; never written.
const LEGACY_DEFICIT_SERIES_ID = "deficit.general_government_balance";
```

Replace lines 26–30 with:

```ts
    if (params.has("sel")) {
      const selection = params.get("sel") ?? "";
      if (selection === "") state.selected = false;
      if (selection.split(",").some((id) => id === DEFICIT_SERIES_ID || id === LEGACY_DEFICIT_SERIES_ID)) state.selected = true;
    }
```

- [x] **Step 5: Use the constant on the page and in the inventory; delete the duplicate label**

In `apps/web/lib/pages/deficit.tsx`, add `import { DEFICIT_SERIES_ID } from "../factQuery/types";` beside the other imports. In line 36, replace `["deficit.general_government_balance"]` with `[DEFICIT_SERIES_ID]`.

In `apps/web/lib/i18n/inventory.server.ts`, delete line 5 (`import { DEFICIT_ITEM } from "../explorer/deficitExplorer";`). In line 49, delete `DEFICIT_ITEM.id, ` so the line ends with `DEFICIT_SERIES_ID,`.

In `../../data/localization/en/labels.json`, delete the four lines of the `"deficit.general_government_balance"` entry (lines 826–829).

- [x] **Step 6: Update the remaining tests to the surviving id**

- `apps/web/tests/explorer/deficitRoute.test.tsx:11`: `["deficit.general_government_balance"]` becomes `["deficit.general_government.balance"]`.
- `apps/web/tests/explorer/deficitRoute.test.tsx:47`: `'data-series-id="deficit.general_government_balance"'` becomes `'data-series-id="deficit.general_government.balance"'`.
- `apps/web/tests/explorer/deficitWorkbook.test.ts:15`: `["deficit.general_government_balance"]` becomes `["deficit.general_government.balance"]`.
- `apps/web/tests/browser/deficit.spec.ts:20-21`: `chart-series-deficit.general_government_balance-actual` becomes `chart-series-deficit.general_government.balance-actual`, and `…_balance-forecast` becomes `…government.balance-forecast`.

Leave `deficit.spec.ts:44` and `tests/browser/bilingual-debt-deficit.spec.ts:41-42` and `:129` unchanged. They open links with the old id, which now exercises the alias.

- [x] **Step 7: Run the tests**

Run: `npx vitest run tests/explorer/deficitExplorer.test.ts tests/explorer/deficitUrlState.test.ts tests/explorer/deficitRoute.test.tsx tests/explorer/deficitWorkbook.test.ts tests/factQuery/reference.test.ts`
Expected: PASS, with the reference fixture unchanged.

Run: `npm run i18n:check && npm run typecheck`
Expected: exit 0.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/deficit.spec.ts tests/browser/bilingual-debt-deficit.spec.ts`
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add lib/explorer/deficitExplorer.ts lib/explorer/deficitUrlState.ts lib/pages/deficit.tsx lib/i18n/inventory.server.ts ../../data/localization/en/labels.json tests/explorer/deficitExplorer.test.ts tests/explorer/deficitUrlState.test.ts tests/explorer/deficitRoute.test.tsx tests/explorer/deficitWorkbook.test.ts tests/browser/deficit.spec.ts
git commit -m "fix(deficit): use the published series id in the explorer and accept the old one in links"
```

---

### Task 2: Pin the debt workbook sources, then move lineage into the data layer

**Files:**
- Create: `apps/web/tests/explorer/debtWorkbookSources.test.ts` (plus its generated `__snapshots__/debtWorkbookSources.test.ts.snap`)
- Create: `apps/web/lib/data/governmentDebt/sourceLineage.ts`
- Create: `apps/web/tests/data/governmentDebt/sourceLineage.test.ts`
- Modify: `apps/web/lib/methodology/workbookSources.ts` (add a debt loader after `loadWorkbookSources`, which ends at line 220)
- Modify: `apps/web/lib/explorer/debtWorkbook.ts` (lines 1–86)
- Modify: `apps/web/lib/pages/debt.tsx` (lines 16 and 27–32)
- Modify: `apps/web/components/debt/debt-explorer.tsx` (props type, lines 33–40)
- Test: `apps/web/tests/explorer/debtWorkbook.test.ts` (fixtures, lines 11–58)

**Interfaces:**
- Produces:
  - `registryDebtSourceId(id: string): string`, which is idempotent: `mof_x` → `source.mof_x`, and `source.mof_x` stays unchanged.
  - `sourcesForDebtFact(fact: ServedGovernmentDebtFact): string[]` (registry IDs, de-duplicated, in citation order).
  - `type SourcedWorkbookPublicSource = WorkbookPublicSource & { sourceId: string }`.
  - `loadDebtWorkbookSources(locale?: Locale): Promise<SourcedWorkbookPublicSource[]>`.
  - `DebtWorkbookInput.sources: readonly SourcedWorkbookPublicSource[]`.

- [x] **Step 1: Record today's source sheet as a golden snapshot**

Create `apps/web/tests/explorer/debtWorkbookSources.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { loadGovernmentDebtFacts } from "../../lib/data/governmentDebt/importGovernmentDebtFacts";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import { loadWorkbookSources, resetWorkbookSourceCacheForTests } from "../../lib/methodology/workbookSources";
import type { DebtFamily, DebtSeriesId } from "../../lib/servedRows";

// A golden test: the debt workbook's Sources sheet must list the same documents
// and years before and after lineage moves out of the UI (spec §3.3).
const cases: Array<{ name: string; family: DebtFamily; selectedIds: DebtSeriesId[]; range: { start: number; end: number } }> = [
  { name: "stock, full coverage", family: "stock", selectedIds: ["debt.stock.total", "debt.stock.domestic", "debt.stock.external"], range: { start: 2013, end: 2025 } },
  { name: "service, full coverage", family: "service", selectedIds: ["debt.service.total", "debt.service.principal", "debt.service.interest"], range: { start: 2013, end: 2030 } },
  { name: "rate, full coverage", family: "rate", selectedIds: ["debt.rate.total", "debt.rate.domestic", "debt.rate.external"], range: { start: 2015, end: 2025 } },
  { name: "service total, 2017–2021", family: "service", selectedIds: ["debt.service.total"], range: { start: 2017, end: 2021 } },
];

describe("debt workbook sources (golden)", () => {
  beforeEach(() => resetWorkbookSourceCacheForTests());

  it.each(cases)("lists the same documents and years: $name", async ({ family, selectedIds, range }) => {
    const [facts, sources] = await Promise.all([loadGovernmentDebtFacts(), loadWorkbookSources("debt")]);
    const model = buildDebtWorkbookExportModel({
      facts,
      gdpFacts: [],
      family,
      selectedIds,
      range,
      shareOfGdp: false,
      sources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });
    expect(model.sources.map(({ title, years, downloadHref }) => ({ title, years, downloadHref }))).toMatchSnapshot();
  });
});
```

Run: `npx vitest run tests/explorer/debtWorkbookSources.test.ts`
Expected: PASS, writing `tests/explorer/__snapshots__/debtWorkbookSources.test.ts.snap` with four non-empty source lists.

Open the `.snap` file and confirm each case lists at least one document; a case with an empty list means the fixture choice is wrong. Commit the snapshot now:

```bash
git add tests/explorer/debtWorkbookSources.test.ts tests/explorer/__snapshots__/debtWorkbookSources.test.ts.snap
git commit -m "test(debt): pin the workbook source sheet before moving lineage"
```

- [x] **Step 2: Write the failing lineage test**

Create `apps/web/tests/data/governmentDebt/sourceLineage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { registryDebtSourceId, sourcesForDebtFact } from "../../../lib/data/governmentDebt/sourceLineage";
import type { ServedGovernmentDebtFact } from "../../../lib/servedRows";

describe("debt source lineage", () => {
  it("turns bare manifest ids into registry ids and leaves registry ids alone", () => {
    expect(registryDebtSourceId("mof_public_debt_bulletin_n25")).toBe("source.mof_public_debt_bulletin_n25");
    expect(registryDebtSourceId("source.mof_public_debt_bulletin_n25")).toBe("source.mof_public_debt_bulletin_n25");
  });

  it("adds the external-service bulletin to actual service", () => {
    const fact: ServedGovernmentDebtFact = {
      year: 2017, family: "service", seriesId: "debt.service.total", value: 1, valueKind: "amount_gel",
      status: "actual", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: null, lastReviewedAt: "2026-09-01",
    };
    expect(sourcesForDebtFact(fact)).toEqual(["source.mof_public_debt_bulletin_n25", "source.mof_public_debt_bulletin_n13"]);
  });

  it("adds nothing to a projected service year", () => {
    const fact: ServedGovernmentDebtFact = {
      year: 2027, family: "service", seriesId: "debt.service.total", value: 1, valueKind: "amount_gel",
      status: "projection_existing_portfolio", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: "2025-12-31", lastReviewedAt: "2026-09-01",
    };
    expect(sourcesForDebtFact(fact)).toEqual(["source.mof_public_debt_bulletin_n25"]);
  });

  it("cites every reviewed rate source for an unpublished rate", () => {
    const fact: ServedGovernmentDebtFact = {
      year: 2016, family: "rate", seriesId: "debt.rate.domestic", value: null, valueKind: "percent",
      status: "not_available", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01",
    };
    expect(sourcesForDebtFact(fact)).toEqual([
      "source.mof_monthly_debt_report_2026_07",
      "source.mof_debt_strategy_2019_2021",
      "source.mof_debt_strategy_2022_2025",
      "source.mof_debt_strategy_2023_2026",
      "source.mof_debt_strategy_2025_2029",
    ]);
  });
});
```

Run: `npx vitest run tests/data/governmentDebt/sourceLineage.test.ts`
Expected: FAIL, because the module cannot be resolved.

- [x] **Step 3: Create the lineage module**

Create `apps/web/lib/data/governmentDebt/sourceLineage.ts`:

```ts
import type { ServedGovernmentDebtFact } from "../../servedRows";
import { GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS } from "./types";

/**
 * The source registry's form of a debt document id. The debt package keeps its
 * manifest's bare ids (mof_…); data/sources/source-documents.csv registers the same
 * documents as source.mof_…. Idempotent, so it is safe on either form.
 */
export function registryDebtSourceId(id: string): string {
  return id.startsWith("source.") ? id : `source.${id}`;
}

// Actual external service is read from the public debt bulletins, one bulletin
// per window of years, while the fact's own source is the domestic table.
function externalServiceSourceId(year: number): string | null {
  if (year >= 2013 && year <= 2016) return "source.mof_public_debt_bulletin_n7";
  if (year <= 2019) return "source.mof_public_debt_bulletin_n13";
  if (year <= 2022) return "source.mof_public_debt_bulletin_n19";
  if (year <= 2025) return "source.mof_public_debt_bulletin_n25";
  return null;
}

/** Every registry source a debt fact rests on, de-duplicated, in citation order. */
export function sourcesForDebtFact(fact: ServedGovernmentDebtFact): string[] {
  const ids: string[] = fact.sourceId ? [registryDebtSourceId(fact.sourceId)] : [];
  // An unpublished rate cites every document that was checked for it.
  if (fact.family === "rate" && fact.status === "not_available" && !fact.sourceId) {
    ids.push(...GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS.map(registryDebtSourceId));
  }
  if (fact.family === "service" && fact.status === "actual") {
    const external = externalServiceSourceId(fact.year);
    if (external) ids.push(external);
  }
  return [...new Set(ids)];
}
```

Run: `npx vitest run tests/data/governmentDebt/sourceLineage.test.ts`
Expected: PASS.

- [x] **Step 4: Load debt workbook sources with their registry ids**

In `apps/web/lib/methodology/workbookSources.ts`, add after `loadWorkbookSources` (after line 220):

```ts
export type SourcedWorkbookPublicSource = WorkbookPublicSource & { sourceId: string };

/**
 * Debt workbook sources keyed by registry source id, so the explorer matches a
 * fact's documents exactly instead of by filename substring. The join key is the
 * archive row's download path, which is unique per archived document.
 */
export async function loadDebtWorkbookSources(locale: Locale = "ka"): Promise<SourcedWorkbookPublicSource[]> {
  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const [rows, projected] = await Promise.all([
    loadReviewedSourceManifest(repositoryRoot, "debt"),
    loadWorkbookSources("debt", undefined, locale),
  ]);
  return projected.flatMap((source) => {
    const row = rows.find((candidate) => candidate.downloadHref === source.downloadHref);
    return row ? [{ ...source, sourceId: registryDebtSourceId(row.source_id) }] : [];
  });
}
```

Add the import at the top of the file:

```ts
import { registryDebtSourceId } from "../data/governmentDebt/sourceLineage";
```

- [x] **Step 5: Match workbook sources by registry id**

In `apps/web/lib/explorer/debtWorkbook.ts`:

1. Replace the import on line 7 with:
   ```ts
   import { sourcesForDebtFact } from "../data/governmentDebt/sourceLineage";
   import type { SourcedWorkbookPublicSource } from "../methodology/workbookSources";
   ```
2. In `DebtWorkbookInput`, `sources: readonly WorkbookPublicSource[];` becomes `sources: readonly SourcedWorkbookPublicSource[];`.
3. Delete `SOURCE_FILENAME_BY_ID` and `externalServiceSourceId` (lines 33–51).
4. Replace `debtSourcesFor` (lines 53–86) with:
   ```ts
   function debtSourcesFor(input: DebtWorkbookInput): WorkbookPublicSource[] {
     const selected = new Set(input.selectedIds);
     const yearsBySourceId = new Map<string, Set<number>>();

     for (const fact of input.facts) {
       if (
         fact.family !== input.family ||
         !selected.has(fact.seriesId) ||
         fact.year < input.range.start ||
         fact.year > input.range.end
       ) continue;
       for (const sourceId of sourcesForDebtFact(fact)) {
         const years = yearsBySourceId.get(sourceId) ?? new Set<number>();
         years.add(fact.year);
         yearsBySourceId.set(sourceId, years);
       }
     }

     return [...yearsBySourceId].flatMap(([sourceId, years]) => {
       const source = input.sources.find((candidate) => candidate.sourceId === sourceId);
       return source
         ? [{
             years: [...years].sort((left, right) => left - right),
             title: source.title,
             organization: source.organization,
             downloadHref: source.downloadHref,
             retrievedAt: source.retrievedAt,
           }]
         : [];
     });
   }
   ```

Keep the `WorkbookPublicSource` type import from `./workbookModel` for the return type and `gdpSources`.

- [x] **Step 6: Pass sourced rows from the page and type the explorer prop**

In `apps/web/lib/pages/debt.tsx`, change line 16 to:

```ts
import { loadDebtWorkbookSources, loadGdpWorkbookSources } from "../methodology/workbookSources";
```

In lines 27–32, replace `loadWorkbookSources("debt", undefined, locale),` with `loadDebtWorkbookSources(locale),`.

In `apps/web/components/debt/debt-explorer.tsx`, add the import

```tsx
import type { SourcedWorkbookPublicSource } from "../../lib/methodology/workbookSources";
```

and in `DebtExplorerProps` (line 36) change `workbookSources: WorkbookPublicSource[];` to `workbookSources: SourcedWorkbookPublicSource[];`. Leave the `WorkbookPublicSource` import, which `gdpWorkbookSources` still uses.

- [x] **Step 7: Update the existing debt workbook test fixtures**

In `apps/web/tests/explorer/debtWorkbook.test.ts`:
1. Add `import type { SourcedWorkbookPublicSource } from "../../lib/methodology/workbookSources";`.
2. Change `const debtSources: WorkbookPublicSource[] = [` (line 28) to `const debtSources: SourcedWorkbookPublicSource[] = [`.
3. Add a `sourceId` to its three entries, in order:
   - `sourceId: "source.mof_public_debt_bulletin_n13",` (the N13 bulletin)
   - `sourceId: "source.mof_public_debt_bulletin_n25",` (the N25 bulletin)
   - `sourceId: "source.mof_monthly_debt_report_2026_07",` (the monthly report)

Anywhere else in the file that passes a hand-built `sources` array to `buildDebtWorkbookExportModel`, give each entry its matching `sourceId` the same way.

In the golden test (`tests/explorer/debtWorkbookSources.test.ts`), replace `loadWorkbookSources` with `loadDebtWorkbookSources` in both the import and the call:

```ts
import { loadDebtWorkbookSources, resetWorkbookSourceCacheForTests } from "../../lib/methodology/workbookSources";
```

```ts
    const [facts, sources] = await Promise.all([loadGovernmentDebtFacts(), loadDebtWorkbookSources()]);
```

Append this test to the same `describe`:

```ts
  it("gives every archived debt document a registry source id", async () => {
    const sources = await loadDebtWorkbookSources();
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.sourceId.startsWith("source.mof_"))).toBe(true);
  });
```

- [x] **Step 8: Run the tests; the golden snapshot must not change**

Run: `npx vitest run tests/explorer/debtWorkbookSources.test.ts tests/explorer/debtWorkbook.test.ts tests/data/governmentDebt/sourceLineage.test.ts tests/explorer/debtRoute.test.tsx`
Expected: PASS, with the snapshot unchanged. Never pass `-u`. A snapshot failure means lineage changed; fix the code, not the snapshot.

Run: `npm run typecheck && npm run lint`
Expected: exit 0.

- [x] **Step 9: Commit**

```bash
git add lib/data/governmentDebt/sourceLineage.ts lib/methodology/workbookSources.ts lib/explorer/debtWorkbook.ts lib/pages/debt.tsx components/debt/debt-explorer.tsx tests/data/governmentDebt/sourceLineage.test.ts tests/explorer/debtWorkbook.test.ts tests/explorer/debtWorkbookSources.test.ts
git commit -m "refactor(debt): own source lineage in the data layer and match workbook sources by registry id"
```

---

### Task 3: Debt facts cite registry source ids; the query service stops translating

**Files:**
- Modify: `apps/web/lib/data/governmentDebt/importGovernmentDebtFacts.ts:127`
- Modify: `../../data/imports/government-debt-facts-2013-2030.csv` (regenerated)
- Modify: `apps/web/lib/factQuery/queryDebt.ts` (delete lines 81–90; line 201)
- Modify: `apps/web/lib/factQuery/getSources.ts:192`
- Test: `apps/web/tests/data/governmentDebt/servedGovernmentDebt.test.ts`

**Interfaces:**
- Consumes: `registryDebtSourceId` (Task 2).
- Produces: `ServedGovernmentDebtFact.sourceId` is `"source.mof_…"` or `null`. `registrySourceId` is removed from `lib/factQuery/queryDebt.ts`.

- [x] **Step 1: Write the failing test**

Append to `apps/web/tests/data/governmentDebt/servedGovernmentDebt.test.ts`, inside its top-level `describe` or at the end of the file with the file's existing `vitest` imports:

```ts
it("cites source-registry ids on every sourced debt fact", async () => {
  const { loadGovernmentDebtFacts } = await import("../../../lib/data/governmentDebt/importGovernmentDebtFacts");
  const facts = await loadGovernmentDebtFacts();
  const sourced = facts.filter((fact) => fact.sourceId !== null);
  expect(sourced.length).toBeGreaterThan(0);
  expect(sourced.every((fact) => fact.sourceId!.startsWith("source.mof_"))).toBe(true);
});
```

Run: `npx vitest run tests/data/governmentDebt/servedGovernmentDebt.test.ts`
Expected: FAIL; the CSV holds bare `mof_…` ids.

- [x] **Step 2: Emit registry ids when building facts from the package**

In `apps/web/lib/data/governmentDebt/importGovernmentDebtFacts.ts`, add the import

```ts
import { registryDebtSourceId } from "./sourceLineage";
```

and change line 127 from

```ts
    sourceId: row.source_id || null,
```

to

```ts
    // The package keeps its manifest's bare ids; served facts cite the source registry.
    sourceId: row.source_id ? registryDebtSourceId(row.source_id) : null,
```

- [x] **Step 3: Regenerate the canonical CSV and prove only `source_id` changed**

Run: `npm run data:prepare-government-debt`
Expected: `Prepared the government debt research package.`, then `Serving facts: 126`.

Run:

```bash
node -e 'const {execSync}=require("child_process");const fs=require("fs");const rel="data/imports/government-debt-facts-2013-2030.csv";const before=execSync(`git show HEAD:${rel}`,{cwd:"../.."}).toString().split("\n");const after=fs.readFileSync(`../../${rel}`,"utf8").split("\n");const strip=(line)=>{const cells=line.split(",");if(cells.length>6)cells[6]=cells[6].replace(/^source\./,"");return cells.join(",")};const changed=after.filter((line,i)=>strip(line)!==strip(before[i]??""));console.log(before.length===after.length&&changed.length===0?"only source_id changed":JSON.stringify(changed.slice(0,3)))'
```

Expected: `only source_id changed`.

- [x] **Step 4: Remove the query-service translations**

In `apps/web/lib/factQuery/queryDebt.ts`, delete the comment and the `registrySourceId` function (lines 81–90). Line 201 changes from

```ts
            : splitSourceIds(fact.sourceId).map(registrySourceId);
```

to

```ts
            : splitSourceIds(fact.sourceId);
```

In `apps/web/lib/factQuery/getSources.ts`, line 192 changes from

```ts
      ? snapshot.debt.facts.flatMap((f) => f.sourceId ? [f.sourceId.startsWith("source.") ? f.sourceId : `source.${f.sourceId}`] : [])
```

to

```ts
      ? snapshot.debt.facts.flatMap((f) => (f.sourceId ? [f.sourceId] : []))
```

- [x] **Step 5: Run the tests, including the reference fixture unchanged**

Run: `npx vitest run tests/data/governmentDebt tests/factQuery/queryDebt.test.ts tests/factQuery/getSources.test.ts tests/factQuery/reference.test.ts tests/explorer/debtWorkbookSources.test.ts tests/explorer/debtWorkbook.test.ts`
Expected: PASS. The golden snapshot and the reference fixture pass with no edits.

Run: `npm run data:check-government-debt && npm run typecheck`
Expected: exit 0.

- [x] **Step 6: Commit**

```bash
git add lib/data/governmentDebt/importGovernmentDebtFacts.ts ../../data/imports/government-debt-facts-2013-2030.csv lib/factQuery/queryDebt.ts lib/factQuery/getSources.ts tests/data/governmentDebt/servedGovernmentDebt.test.ts
git commit -m "fix(debt): cite source-registry ids in debt facts and drop the query-service translations"
```

---

### Task 4: Foreign key and import check for debt sources

**Files:**
- Modify: `apps/web/prisma/schema.prisma` (the `SourceDocument` model at lines 72–87; the `GovernmentDebtFact` model at lines 197–212)
- Create: `apps/web/prisma/migrations/20260917000000_government_debt_source_document/migration.sql`
- Modify: `apps/web/scripts/import-budget-facts.ts` (after line 290)

**Interfaces:**
- Consumes: registry ids in debt facts (Task 3); the `sourceIds` set built at `scripts/import-budget-facts.ts:239`.
- Produces: the relation `GovernmentDebtFact.sourceId → SourceDocument.id` (nullable, `onDelete: Restrict`).

- [x] **Step 1: Declare the relation in the schema**

In `apps/web/prisma/schema.prisma`, add this line to `model SourceDocument` after `generalGovernmentBalanceFacts GeneralGovernmentBalanceFact[]` (line 80):

```prisma
  governmentDebtFacts GovernmentDebtFact[]
```

In `model GovernmentDebtFact`, replace `  sourceId       String?` (line 204) with:

```prisma
  sourceId       String?
  sourceDocument SourceDocument? @relation(fields: [sourceId], references: [id], onDelete: Restrict)
```

and add `  @@index([sourceId])` after `  @@index([family, year])` (line 211).

Run: `npx prisma validate && npx prisma generate`
Expected: `The schema at prisma/schema.prisma is valid`, then a generated client.

- [x] **Step 2: Write the migration**

Create `apps/web/prisma/migrations/20260917000000_government_debt_source_document/migration.sql`:

```sql
-- Debt facts cite the source registry's ids (source.mof_…) from 2026-09-17.
-- Rewrite rows already in the mirror before the constraint checks them.
UPDATE "GovernmentDebtFact"
SET "sourceId" = 'source.' || "sourceId"
WHERE "sourceId" IS NOT NULL AND "sourceId" NOT LIKE 'source.%';

-- CreateIndex
CREATE INDEX "GovernmentDebtFact_sourceId_idx" ON "GovernmentDebtFact"("sourceId");

-- AddForeignKey
ALTER TABLE "GovernmentDebtFact" ADD CONSTRAINT "GovernmentDebtFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [x] **Step 3: Check debt source ids at import**

In `apps/web/scripts/import-budget-facts.ts`, add directly after line 290 (`assertUnique("Government Debt fact natural key", …);`):

```ts
  assertSubset(
    "Government Debt fact source IDs",
    governmentDebtFacts.flatMap((fact) => (fact.sourceId === null ? [] : [fact.sourceId])),
    sourceIds,
  );
```

- [x] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: exit 0.

Run: `npx vitest run tests/data`
Expected: PASS.

The migration and the import are exercised against a disposable database in Task 8.

- [x] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260917000000_government_debt_source_document/migration.sql scripts/import-budget-facts.ts
git commit -m "fix(db): enforce debt fact sources with a foreign key and an import check"
```

---

### Task 5: Check stock totals against the published total

**Files:**
- Modify: `apps/web/lib/data/governmentDebt/types.ts` (new types; the report type at lines 252–288)
- Modify: `apps/web/lib/data/governmentDebt/parseDebtSources.ts` (new export after `parseGovernmentDebtStock`, which ends at line 179)
- Modify: `apps/web/lib/data/governmentDebt/prepareGovernmentDebtPackage.ts` (new comparison function after `stockOverlapComparisons`, which ends at line 846; the report assembly at lines 1022–1044)
- Modify: `../../docs/Raw Data/Debt/government-debt-annual/validation-report.json` (regenerated)
- Test: `apps/web/tests/data/governmentDebt/parseDebtSources.test.ts`
- Test: `apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts`

**Interfaces:**
- Produces:
  - `parseGovernmentDebtStockTotalControls(sources: { n13Page31: string; n25Page26: string }): GovernmentDebtStockTotalControl[]`
  - `type GovernmentDebtStockTotalControl = { year: number; source_id: "mof_public_debt_bulletin_n13" | "mof_public_debt_bulletin_n25"; published_total_million_gel: number }`
  - `type GovernmentDebtStockTotalComparison = { year; source_id; canonical_total_million_gel; published_total_million_gel; difference_million_gel; tolerance_million_gel: 0.5 }`
  - `GovernmentDebtValidationReport.stock.totalControls: GovernmentDebtStockTotalComparison[]`
  - `GovernmentDebtValidationReport.actualService.externalTotalControl: "not_published"`

The bulletin tables publish "Total Government Debt" in whole million GEL beside components with one decimal. For example, N25 page 26 shows 2015 as 12,443, while the component sum is 12,442.6. The allowed difference is therefore half a published unit, 0.5 million GEL. The external-service tables publish only combined public-debt totals (they include NBG and on-lending), so external service has no matching control. The report records that explicitly.

- [x] **Step 1: Write the failing parser test**

Append inside `describe("government debt source parsers", …)` in `apps/web/tests/data/governmentDebt/parseDebtSources.test.ts`:

```ts
  it("reads the published Total Government Debt row as the stock total control", async () => {
    const { readPdfPages } = await import(pathToFileURL(pdfTextModulePath).href);
    const parserModule = await import(pathToFileURL(parserModulePath).href);
    expect(parserModule.parseGovernmentDebtStockTotalControls).toBeTypeOf("function");

    const n13Pages = await readPdfPages(path.join(sourceDir, "public-debt-bulletin-n13.pdf"), [31]);
    const n25Pages = await readPdfPages(path.join(sourceDir, "public-debt-bulletin-n25.pdf"), [26]);
    const controls = parserModule.parseGovernmentDebtStockTotalControls({
      n13Page31: n13Pages.get(31)!,
      n25Page26: n25Pages.get(26)!,
    });
    const control = (year: number) => controls.find((row: { year: number }) => row.year === year);

    expect(controls).toHaveLength(13);
    expect(control(2013)).toEqual({ year: 2013, source_id: "mof_public_debt_bulletin_n13", published_total_million_gel: 8433 });
    expect(control(2015)).toEqual({ year: 2015, source_id: "mof_public_debt_bulletin_n25", published_total_million_gel: 12443 });
    expect(control(2019)?.published_total_million_gel).toBe(19916);
  });
```

Run: `npx vitest run tests/data/governmentDebt/parseDebtSources.test.ts`
Expected: FAIL; `parseGovernmentDebtStockTotalControls` is not a function.

- [x] **Step 2: Add the types**

In `apps/web/lib/data/governmentDebt/types.ts`, add before `export type GovernmentDebtValidationReport`:

```ts
export type GovernmentDebtStockTotalControl = {
  year: number;
  source_id: "mof_public_debt_bulletin_n13" | "mof_public_debt_bulletin_n25";
  published_total_million_gel: number;
};

export type GovernmentDebtStockTotalComparison = {
  year: number;
  source_id: GovernmentDebtStockTotalControl["source_id"];
  canonical_total_million_gel: number;
  published_total_million_gel: number;
  difference_million_gel: number;
  tolerance_million_gel: 0.5;
};
```

In `GovernmentDebtValidationReport`, change the `stock` member to:

```ts
  stock: {
    rowCount: number;
    observedYears: number[];
    overlapComparisons: GovernmentDebtStockOverlapComparison[];
    totalControls: GovernmentDebtStockTotalComparison[];
  };
```

and the `actualService` member to:

```ts
  actualService: {
    rowCount: number;
    observedYears: number[];
    overlapComparisons: GovernmentDebtActualServiceOverlapComparison[];
    /** The bulletins publish only combined public-debt service totals, never external government service alone. */
    externalTotalControl: "not_published";
  };
```

- [x] **Step 3: Implement the parser**

In `apps/web/lib/data/governmentDebt/parseDebtSources.ts`, add `GovernmentDebtStockTotalControl` to the existing type import from `./types`. Insert after `parseGovernmentDebtStock` (after line 179):

```ts
/**
 * The rounded "Total Government Debt" row each stock table publishes beside its
 * components. Canonical totals are exact component sums; this row is their control.
 */
export function parseGovernmentDebtStockTotalControls(sources: {
  n13Page31: string;
  n25Page26: string;
}): GovernmentDebtStockTotalControl[] {
  const n13Years = [2013, 2014, 2015, 2016, 2017, 2018, 2019];
  const n13Totals = gelValues(sources.n13Page31, "Total Government Debt", n13Years.length, legacyNumberTokens);
  const n25Years = Array.from({ length: 11 }, (_, index) => 2015 + index);
  const n25Totals = gelValues(sources.n25Page26, "Total Government Debt", n25Years.length, englishNumberTokens);

  return [
    ...n13Years.slice(0, 2).map((year, index) => ({
      year,
      source_id: "mof_public_debt_bulletin_n13" as const,
      published_total_million_gel: n13Totals[index]!,
    })),
    ...n25Years.map((year, index) => ({
      year,
      source_id: "mof_public_debt_bulletin_n25" as const,
      published_total_million_gel: n25Totals[index]!,
    })),
  ];
}
```

Run: `npx vitest run tests/data/governmentDebt/parseDebtSources.test.ts`
Expected: PASS.

- [x] **Step 4: Write the failing package test**

In `apps/web/tests/data/governmentDebt/governmentDebtPackage.test.ts`, inside `it("builds the complete normalized package with only documented rate gaps", …)`, add after the `overlapComparisons` assertions (after line 272):

```ts
    const totalControls = result.validation.stock.totalControls;
    expect(totalControls).toHaveLength(13);
    expect(totalControls.every((control) => Math.abs(control.difference_million_gel) <= 0.5)).toBe(true);
    expect(totalControls.find((control) => control.year === 2015)).toMatchObject({
      canonical_total_million_gel: 12442.6,
      published_total_million_gel: 12443,
      difference_million_gel: 0.4,
    });
    expect(result.validation.actualService.externalTotalControl).toBe("not_published");
```

Run: `npx vitest run tests/data/governmentDebt/governmentDebtPackage.test.ts`
Expected: FAIL, because `totalControls` is undefined.

- [x] **Step 5: Compare and fail loudly in prepare**

In `apps/web/lib/data/governmentDebt/prepareGovernmentDebtPackage.ts`:

1. Add `parseGovernmentDebtStockTotalControls` to the import from `./parseDebtSources`.
2. Add `GovernmentDebtStockTotalComparison` and `GovernmentDebtStockTotalControl` to the type import from `./types`.
3. Insert after `stockOverlapComparisons` (after line 846):
   ```ts
   const STOCK_TOTAL_TOLERANCE_MILLION_GEL = 0.5;

   // Each canonical total is the exact sum of its published components; the table's
   // own rounded total (whole million GEL) must agree within half a published unit.
   function stockTotalComparisons(
     stockRows: GovernmentDebtStockRow[],
     controls: GovernmentDebtStockTotalControl[],
   ): GovernmentDebtStockTotalComparison[] {
     const totals = new Map(
       stockRows.filter((row) => row.debt_scope === "total").map((row) => [row.year, row]),
     );
     return controls
       .filter((control) => totals.get(control.year)?.source_id === control.source_id)
       .map((control) => {
         const row = totals.get(control.year)!;
         const difference = Number((control.published_total_million_gel - row.amount_million_gel).toFixed(10));
         if (Math.abs(difference) > STOCK_TOTAL_TOLERANCE_MILLION_GEL) {
           throw new Error(
             `Stock total control failed for ${control.year}: published ${control.published_total_million_gel} vs component sum ${row.amount_million_gel} million GEL`,
           );
         }
         return {
           year: control.year,
           source_id: control.source_id,
           canonical_total_million_gel: row.amount_million_gel,
           published_total_million_gel: control.published_total_million_gel,
           difference_million_gel: difference,
           tolerance_million_gel: STOCK_TOTAL_TOLERANCE_MILLION_GEL,
         };
       });
   }
   ```
4. After `const stockOverlaps = stockOverlapComparisons(…);` (lines 1022–1025), add:
   ```ts
     const stockTotals = stockTotalComparisons(
       stockRows,
       parseGovernmentDebtStockTotalControls({ n13Page31: pages.n13Page31, n25Page26: pages.n25Page26 }),
     );
   ```
5. In the report object, the `stock` member (lines 1036–1040) becomes:
   ```ts
       stock: {
         rowCount: stockRows.length,
         observedYears: Array.from({ length: 13 }, (_, index) => 2013 + index),
         overlapComparisons: stockOverlaps,
         totalControls: stockTotals,
       },
   ```
   and the `actualService` member (lines 1041–1045) becomes:
   ```ts
       actualService: {
         rowCount: actualServiceRows.length,
         observedYears: Array.from({ length: 13 }, (_, index) => 2013 + index),
         overlapComparisons: serviceOverlaps,
         externalTotalControl: "not_published",
       },
   ```

- [x] **Step 6: Add a synthetic parser test**

Append inside the same `describe` in `governmentDebtPackage.test.ts`:

```ts
  it("parses the published total row from synthetic bulletin text", async () => {
    const parser = await import("../../../lib/data/governmentDebt/parseDebtSources");
    const text = (label: string, pairs: string) => `${label} ${pairs}`;
    const n13 = [
      text("Total Government Debt", "4 857 8 433 5 164 9 623 5 195 12 443 5 454 14 436 6 196 16 063 6 482 17 349 6 945 19 916"),
    ].join("\n");
    const n25 = [
      text("Total Government Debt", Array.from({ length: 11 }, () => "1,000 2,000").join(" ")),
    ].join("\n");
    const controls = parser.parseGovernmentDebtStockTotalControls({ n13Page31: n13, n25Page26: n25 });
    expect(controls.find((control) => control.year === 2015)?.published_total_million_gel).toBe(2000);
  });
```

This checks the parser against synthetic text. The execution also tests raised and lowered published totals and an altered component by changing the extracted PDF text in memory. Each must abort `buildGovernmentDebtPackage` with the affected year in the error; the unmodified real package must still pass.

- [x] **Step 7: Regenerate the package report and run the debt tests**

Run: `npm run data:prepare-government-debt`
Expected: `Prepared the government debt research package.`, with no `Stock total control failed` error.

Run: `npx vitest run tests/data/governmentDebt`
Expected: PASS.

Run: `npm run data:check-government-debt`
Expected: exit 0.

Run: `git diff --stat -- "../../docs/Raw Data/Debt/government-debt-annual"`
Expected: only `validation-report.json` changed. If the review workbook test reports a mismatch, regenerate it with the same command and include it; do not edit it by hand.

- [x] **Step 8: Commit**

```bash
git add lib/data/governmentDebt/types.ts lib/data/governmentDebt/parseDebtSources.ts lib/data/governmentDebt/prepareGovernmentDebtPackage.ts tests/data/governmentDebt/parseDebtSources.test.ts tests/data/governmentDebt/governmentDebtPackage.test.ts "../../docs/Raw Data/Debt/government-debt-annual/validation-report.json"
git commit -m "fix(debt): check stock totals against the published total"
```

---

### Task 6: Revoke public access on the debt and deficit mirror tables

**Files:**
- Create: `apps/web/prisma/migrations/20260917000100_revoke_debt_deficit_mirror_access/migration.sql`
- Modify: `../../docs/data-methodology/database-import.md:244-247`

**Interfaces:** none.

- [x] **Step 1: Write the migration**

Create `apps/web/prisma/migrations/20260917000100_revoke_debt_deficit_mirror_access/migration.sql`:

```sql
-- Every later mirror table revokes these grants; RLS without policies already denies
-- both roles, so this is defence in depth for the two tables that predate the rule.
REVOKE ALL ON TABLE "GovernmentDebtFact" FROM anon, authenticated;
REVOKE ALL ON TABLE "GeneralGovernmentBalanceFact" FROM anon, authenticated;
```

- [x] **Step 2: Make the runbook state the rule**

In `../../docs/data-methodology/database-import.md`, replace lines 244–247:

```markdown
Then place the SQL in a `prisma/migrations/<timestamp>_<name>/migration.sql`
folder by hand, and add `ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY;` for
every new table — the generator does not emit RLS, and every mirror table here
carries it.
```

with:

```markdown
Then place the SQL in a `prisma/migrations/<timestamp>_<name>/migration.sql`
folder by hand, and for every new table add both
`ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY;` and
`REVOKE ALL ON TABLE "<Table>" FROM anon, authenticated;` — the generator emits
neither, and every mirror table here carries both. Give each migration folder a
unique timestamp: `20260912000000_economic_sectors` and
`20260912000000_inflation_cpi` share one and stay as applied, since renaming an
applied migration breaks `_prisma_migrations`.
```

- [x] **Step 3: Commit**

```bash
git add prisma/migrations/20260917000100_revoke_debt_deficit_mirror_access/migration.sql ../../docs/data-methodology/database-import.md
git commit -m "fix(db): revoke public grants on the debt and deficit mirror tables"
```

---

### Task 7: Methodology documents

**Files:**
- Modify: `../../docs/data-methodology/government-debt-annual.md` (sections `## Preserved official sources`, `## Stock normalization` and `## Validation and outputs`)
- Modify: `../../docs/data-methodology/general-government-balance.md` (section `## Public meaning`)

**Interfaces:** none. Documentation only.

- [x] **Step 1: Debt methodology**

Append at the end of `## Preserved official sources`:

```markdown
The package and its manifest keep bare document ids (`mof_public_debt_bulletin_n25`). Served facts, the mirror and the public `government-debt.csv` cite the source registry's form (`source.mof_public_debt_bulletin_n25`), the same ids `data/sources/source-documents.csv` registers; the mirror enforces them with a foreign key and the import rejects an unregistered id. Which documents a fact rests on — its own table, the external-service bulletin for actual service years, and every reviewed strategy for an unpublished rate — is defined once in `apps/web/lib/data/governmentDebt/sourceLineage.ts`.
```

Append at the end of `## Stock normalization`:

```markdown
Each total is the exact sum of the published domestic and external components. The table's own "Total Government Debt" row, published in whole million GEL, is its control: generation fails if a component sum differs from it by more than 0.5 million GEL, and the comparisons are recorded in `validation-report.json` under `stock.totalControls`.
```

Append at the end of `## Validation and outputs`:

```markdown
External government service has no published total of its own — the bulletins' TOTAL rows combine public-debt service including NBG and on-lending — so `actualService.externalTotalControl` records `not_published` rather than implying a check.
```

- [x] **Step 2: Deficit methodology**

Append at the end of `## Public meaning`:

```markdown
The series id is `deficit.general_government.balance` everywhere: the explorer, `/mcp`, the JSON publications and the English label catalogue. Explorer links created before 2026-09-17 with `deficit.general_government_balance` still select the series.
```

- [x] **Step 3: Commit**

```bash
git add ../../docs/data-methodology/government-debt-annual.md ../../docs/data-methodology/general-government-balance.md
git commit -m "docs(methodology): record registry source ids, the stock total control and the deficit id"
```

---

### Task 8: Done-check, database rehearsal and acceptance

**Files:** none (verification only).

- [x] **Step 1: Full check**

Run: `npm run check`
Expected: exit 0, including `data:validate` and `data:check-government-debt`.

- [x] **Step 2: Reference fixture**

Run: `npx vitest run tests/factQuery/reference.test.ts`
Expected: PASS with no expectation edits.

- [x] **Step 3: Build**

Run: `npm run build`
Expected: exit 0.

- [x] **Step 4: Browser suite on the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass.

- [x] **Step 5: Rehearse the migrations and import on a disposable database**

Use a throwaway PostgreSQL database, never production:

1. Point `DATABASE_URL` and `DIRECT_URL` at it in a local, uncommitted `.env`.
2. Apply the committed migrations from `main` with `npx prisma migrate deploy`.
3. Run `npm run data:import` from `main` to load bare-id debt rows.
4. Check out this branch and run `npx prisma migrate deploy`.

Expected: both new migrations apply, and the `UPDATE` rewrites the debt `sourceId` values before the foreign key is added.

Then run `npm run data:import`.
Expected: the import succeeds, and a deliberately broken copy of the CSV (one `source_id` changed to `source.mof_unknown`) is rejected with `Government Debt fact source IDs`. Restore the CSV afterwards.

If no disposable database is available, report that the rehearsal was not run. Do not skip it silently.

- [x] **Step 6: Acceptance walk**

1. `/explorer/deficit#sel=deficit.general_government_balance` selects the series, and after any change the URL carries `sel=deficit.general_government.balance`.
2. `data/localization/en/labels.json` has one deficit entry.
3. The debt CSV differs from `main` only in `source_id` (Task 3 Step 3 printed `only source_id changed`).
4. The debt workbook source sheet matches the golden snapshot.
5. The mirror enforces the debt foreign key, and the import rejects an unregistered debt source id (Step 5).
6. `npm run data:prepare-government-debt` fails if a stock component is altered by more than 0.5 million GEL.
7. Both older mirror tables have their public grants revoked.

- [x] **Step 7: Hand off**

Push `codex/identifiers-and-source-lineage` and open a draft PR. List the two migrations, the public CSV `source_id` change and the rehearsal result. Merge only after CI is green. Production applies the migrations through the pipeline in `docs/deployment.md` before the next import.

## Verification result (2026-09-19)

- Implementation and local acceptance complete. Delivery: [draft PR #122](https://github.com/DuruMakh/geodata.ge/pull/122); GitHub records subsequent CI and merge state.
- Lint, typecheck, data validation and translation checks passed. All 2,184 unit tests passed across the full run and the unchanged seven-test 2004 PDF retry after a setup timeout.
- All 540 browser cases passed across the full run (530 passed) and isolated unchanged retries (10 passed in 32.1 seconds). Initial failures were connection resets and timing limits. Desktop and 390px mobile screenshots were inspected; old deficit links restore and serialize the canonical ID after interaction.
- A production build against disposable PostgreSQL 17.10 passed, including all 17 publication integrity checks. Main migrations and the old bare-ID CSV were loaded before applying both new migrations. The subsequent branch import reported exact CSV/database parity.
- Six real-database integrity/privacy tests passed after demonstrating the relevant failures beforehand. The importer rejects a deliberately unknown source before connecting; the temporary CSV change was restored. The disposable database was stopped after verification.
- All 126 canonical debt rows retain their other fields and order; exactly 118 non-empty source IDs gain the registry prefix. Four workbook-source snapshots and the query-reference fixture are unchanged. The report contains 13 published-total controls; it accepts the 0.5-million-GEL boundary and rejects altered totals/components.
- Independent whole-branch review found no Critical, Important or Minor issues. Additional MCP citation membership remains excluded by the spec and needs separate scope.
- Production was not changed by this implementation. The two migrations must run through the established release pipeline after an authorized merge.
