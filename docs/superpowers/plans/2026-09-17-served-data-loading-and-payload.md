# Served Data Loading and Client Payload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each new dataset loads once per build process in both modes, the snapshot serves every dataset through the same loaders, and explorer routes ship only the fields the browser reads.

**Architecture:** Three independent strands, in order:
1. **Loading** — one mode resolver in `lib/data/servedDataSource.ts`, module-level promise memos on the four new loaders (the pattern `lib/data/servedData.ts:448-490` already documents), the snapshot taking GDP and sectors from those loaders, and methodology articles loading debt only for the debt article.
2. **Payload** — client row types in `lib/servedRows.ts`, projections in `lib/explorer/clientData.ts`, one hoisted source-id map per page, and a browser guard extended to nine routes.
3. **Two small fixes** — the GDP mirror reader's date helper and the explorer footer's server-catalogue import.

**Tech Stack:** TypeScript, Next.js 16 App Router, Vitest 4, Playwright, Prisma 7.

**Spec:** `docs/superpowers/specs/2026-09-17-served-data-loading-and-payload-design.md`

## Global Constraints

- **Branch and paths:** work on `codex/served-loading-and-payload`, created from `main`. Never commit to `main`. Commands run from `apps/web`; repository paths are written `../../…`.
- **No visible change.** No figure, chart, table, workbook or rendered string moves. The snapshot must stay byte-identical in CSV mode (Task 3 verifies this).
- **Memo scope is one process** (spec §1.2). `next build` prerenders in worker processes, so "once per build" means once per process; the acceptance counts per process.
- **Source ids stay on the client**, hoisted into one small map per page, because the workbook builders read them (spec §1.2).
- **`lib/servedRows.ts` keeps zero imports.** Its header comment explains why; adding one would let a CSV parser reach the browser bundle.
- **Sequencing:** if `2026-09-17-figure-accuracy-fixes.md` lands first, the basket-weight client row must keep `year` (spec §Series note), which the projection in Task 8 already does.
- **Test loop:** targeted tests while editing; the full gates run once, in Task 10.

---

### Task 1: One mode resolver for all five loaders

**Files:**
- Create: `apps/web/lib/data/servedDataSource.ts`
- Modify: `apps/web/lib/data/servedData.ts` (move `resolveServedDataSource`, lines 137–149; re-export it)
- Modify: `apps/web/lib/data/governmentDebt/importGovernmentDebtFacts.ts:252-256`
- Modify: `apps/web/lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts:111-119`
- Modify: `apps/web/lib/data/gdpOverview/importGdpOverview.ts:53-55`
- Modify: `apps/web/lib/data/economicSectors/importEconomicSectors.ts:36-37`
- Modify: `apps/web/lib/data/inflation/importInflation.ts:145-146`
- Test: `apps/web/tests/data/economicSectors/servingBoundary.test.ts`

**Interfaces:**
- Produces: `resolveServedDataSource(): "csv" | "db"` and `type ServedDataSource = "csv" | "db"` in `lib/data/servedDataSource.ts`. Invalid values throw `GEODATA_DATA_SOURCE must be "db" or "csv", got "<raw>"` — the message `servedData.ts:148` already uses, so the budget tests keep passing.
- `servedData.ts` re-exports both, so its existing importers do not change.

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/data/economicSectors/servingBoundary.test.ts`, change the invalid-mode expectation to the shared message:

```ts
  it("rejects an invalid data source with the shared message", async () => {
    process.env.GEODATA_DATA_SOURCE = "postgres";
    await expect(loadServedEconomicSectorsData()).rejects.toThrow(
      'GEODATA_DATA_SOURCE must be "db" or "csv", got "postgres"',
    );
  });
```

Keep the file's existing setup and teardown of `process.env.GEODATA_DATA_SOURCE`.

Run: `npx vitest run tests/data/economicSectors/servingBoundary.test.ts`
Expected: FAIL — the sectors loader still throws `Invalid GEODATA_DATA_SOURCE`.

- [ ] **Step 2: Extract the resolver**

Create `apps/web/lib/data/servedDataSource.ts`:

```ts
// The one place that reads GEODATA_DATA_SOURCE.
//
// It lives in its own module, not in servedData.ts, because servedData.ts
// re-exports the debt and deficit loaders (:83-84); importing it from those
// loaders would close an import cycle.
export type ServedDataSource = "csv" | "db";

export function resolveServedDataSource(): ServedDataSource {
  const raw = (process.env.GEODATA_DATA_SOURCE ?? "").trim().toLowerCase();
  if (raw === "" || raw === "csv") return "csv";
  if (raw === "db") return "db";
  throw new Error(`GEODATA_DATA_SOURCE must be "db" or "csv", got "${raw}"`);
}
```

In `apps/web/lib/data/servedData.ts`, delete the function body at lines 137–149 and the `ServedDataSource` type declaration if it is local, and re-export instead:

```ts
export { resolveServedDataSource, type ServedDataSource } from "./servedDataSource";
```

- [ ] **Step 3: Use it in the five loaders**

In each loader, replace the local parse with the resolver.

`importGovernmentDebtFacts.ts`:

```ts
export async function loadServedGovernmentDebtData(): Promise<{ facts: ServedGovernmentDebtFact[] }> {
  if (resolveServedDataSource() === "csv") return { facts: await loadGovernmentDebtFacts() };

  const { loadGovernmentDebtFactsFromDb } = await import("../../db/servedDataDb");
```

`importGeneralGovernmentBalance.ts`:

```ts
  if (resolveServedDataSource() === "csv") return { facts: await csvFacts() };

  const { loadGeneralGovernmentBalanceFactsFromDb } = await import("../../db/servedDataDb");
```

`importGdpOverview.ts`:

```ts
  const mode = resolveServedDataSource();
  let facts = await loadGdpOverviewFacts();
  if (mode === "db") {
```

`importEconomicSectors.ts`:

```ts
  const mode = resolveServedDataSource();
  let facts = await loadEconomicSectorFacts();
  if (mode === "db") {
```

`importInflation.ts`:

```ts
  const mode = resolveServedDataSource();
  let facts = await loadCpiFacts();
```

Add `import { resolveServedDataSource } from "../servedDataSource";` to each (`"./servedDataSource"` from `lib/data/inflation/…` is `"../servedDataSource"`; adjust per directory depth).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/data tests/i18n/servingParity.test.ts`
Expected: PASS. Any other test that asserted `Invalid GEODATA_DATA_SOURCE` now expects the shared message; update it the same way.

Run: `npm run typecheck`
Expected: exit 0, with no import cycle warning.

- [ ] **Step 5: Commit**

```bash
git add lib/data/servedDataSource.ts lib/data/servedData.ts lib/data/governmentDebt/importGovernmentDebtFacts.ts lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts lib/data/gdpOverview/importGdpOverview.ts lib/data/economicSectors/importEconomicSectors.ts lib/data/inflation/importInflation.ts tests/data/economicSectors/servingBoundary.test.ts
git commit -m "refactor(data): one resolver for GEODATA_DATA_SOURCE"
```

---

### Task 2: Memoise the four new loaders

**Files:**
- Modify: `apps/web/lib/data/governmentDebt/importGovernmentDebtFacts.ts`, `…/generalGovernmentBalance/importGeneralGovernmentBalance.ts`, `…/gdpOverview/importGdpOverview.ts`, `…/economicSectors/importEconomicSectors.ts`
- Modify: `apps/web/lib/data/inflation/importInflation.ts` (expose its reset)
- Modify: `apps/web/lib/data/servedData.ts` (`resetServedDataCacheForTests`, lines 456–460)
- Create: `apps/web/tests/data/servedLoaders.test.ts`

**Interfaces:**
- Each loader keeps its exported name and return type and gains a sibling `reset…CacheForTests(): void`:
  `resetGovernmentDebtCacheForTests`, `resetGeneralGovernmentBalanceCacheForTests`, `resetGdpOverviewCacheForTests`, `resetEconomicSectorsCacheForTests`, `resetInflationCacheForTests`.
- `resetServedDataCacheForTests()` calls all five in addition to its own three.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/data/servedLoaders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadServedGovernmentDebtData } from "../../lib/data/governmentDebt/importGovernmentDebtFacts";
import { loadServedGeneralGovernmentBalanceData } from "../../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";
import { loadServedGdpOverviewData } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { resetServedDataCacheForTests } from "../../lib/data/servedData";

// A build prerenders ~25 routes that each need debt data, and generateMetadata
// loads again beside its own page. Without a memo every one of those re-parses
// the CSVs and, in db mode, re-runs the full row-by-row parity check.
const loaders = {
  debt: loadServedGovernmentDebtData,
  deficit: loadServedGeneralGovernmentBalanceData,
  gdp: loadServedGdpOverviewData,
  sectors: loadServedEconomicSectorsData,
  inflation: loadServedInflationData,
} as const;

describe("served loaders", () => {
  it("returns the same promise to concurrent and later callers", () => {
    for (const [name, load] of Object.entries(loaders)) {
      expect(load(), name).toBe(load());
    }
  });

  it("returns identical data to repeated callers", async () => {
    for (const [name, load] of Object.entries(loaders)) {
      const [first, second] = await Promise.all([load(), load()]);
      expect(first, name).toBe(second);
    }
  });

  it("resetServedDataCacheForTests clears every loader", async () => {
    const before = await Promise.all(Object.values(loaders).map((load) => load()));
    resetServedDataCacheForTests();
    const after = await Promise.all(Object.values(loaders).map((load) => load()));
    after.forEach((value, index) => expect(value).not.toBe(before[index]));
  });
});
```

Run: `npx vitest run tests/data/servedLoaders.test.ts`
Expected: FAIL — each call builds a new promise.

- [ ] **Step 2: Memoise each loader**

In each of the four files, rename the existing exported function to `…Uncached`, and add the memo below it. For the debt loader:

```ts
// Build-time memo, for the reasons servedData.ts:427-447 documents: one load per
// process, concurrent callers collapsed onto it, and a cached rejection so the
// first parity failure is the build failure.
let servedDebtPromise: Promise<{ facts: ServedGovernmentDebtFact[] }> | null = null;

export function loadServedGovernmentDebtData(): Promise<{ facts: ServedGovernmentDebtFact[] }> {
  servedDebtPromise ??= loadServedGovernmentDebtDataUncached();
  return servedDebtPromise;
}

export function resetGovernmentDebtCacheForTests(): void {
  servedDebtPromise = null;
}
```

Repeat for deficit (`servedDeficitPromise`), GDP (`servedGdpOverviewPromise`) and sectors (`servedEconomicSectorsPromise`), keeping each loader's own return type. Note that the memoised function is no longer `async`: it returns the promise rather than awaiting it, which is what makes two callers share one.

In `importInflation.ts`, export the reset for the memo it already has:

```ts
export function resetInflationCacheForTests(): void {
  servedInflationPromise = null;
}
```

using the existing promise variable's name.

- [ ] **Step 3: Register the resets**

In `apps/web/lib/data/servedData.ts`, extend `resetServedDataCacheForTests`:

```ts
export function resetServedDataCacheForTests(): void {
  landingDataPromise = null;
  explorerDataPromise = null;
  municipalDataPromise = null;
  resetGovernmentDebtCacheForTests();
  resetGeneralGovernmentBalanceCacheForTests();
  resetGdpOverviewCacheForTests();
  resetEconomicSectorsCacheForTests();
  resetInflationCacheForTests();
}
```

with the five imports. `servedData.ts` already re-exports the debt and deficit loaders, so no new cycle appears; if TypeScript reports one, import the resets from the loader modules directly rather than through a barrel.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/data/servedLoaders.test.ts tests/data tests/i18n/servingParity.test.ts`
Expected: PASS. A test that switches `GEODATA_DATA_SOURCE` between cases must call `resetServedDataCacheForTests()` in its `beforeEach`; add it where a failure shows one is missing.

- [ ] **Step 5: Commit**

```bash
git add lib/data/governmentDebt/importGovernmentDebtFacts.ts lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts lib/data/gdpOverview/importGdpOverview.ts lib/data/economicSectors/importEconomicSectors.ts lib/data/inflation/importInflation.ts lib/data/servedData.ts tests/data/servedLoaders.test.ts
git commit -m "perf(data): memoise the debt, deficit, GDP and sector loaders per process"
```

---

### Task 3: The snapshot serves GDP and sectors through the same loaders

**Files:**
- Modify: `apps/web/lib/factQuery/buildSnapshot.ts` (lines 479–489, 670–671)
- Modify: `apps/web/tests/i18n/servingParity.test.ts`

**Interfaces:**
- Consumes: `loadServedGdpOverviewData()` and `loadServedEconomicSectorsData()` from Task 2, both memoised.
- The snapshot's `gdpOverview.facts` and `economicSectors.facts` keep their current element types. The served loaders return `value: number`; the snapshot's readers use `Number(f.value)` today, so confirm the shape at the two call sites and convert once where needed — no rounding or reordering may change.

- [ ] **Step 1: Capture the baseline**

Run:

```bash
npm run data:prepare-fact-query-snapshot && cp lib/factQuery/generated/snapshot.json "$TMPDIR/snapshot-before.json"
```

On Windows Git Bash, use a path under the scratchpad directory instead of `$TMPDIR` if it is unset.

- [ ] **Step 2: Name every result and drop the direct CSV reads**

In `apps/web/lib/factQuery/buildSnapshot.ts`, change the destructuring (line 479) to name the tenth result and add the sectors loader:

```ts
  const [explorer, municipal, taxonomy, manifestDocuments, debt, deficit, catalogue, serviceKa, serviceEn, gdpOverview, economicSectors] =
    await Promise.all([
      loadServedExplorerData(),
      loadServedMunicipalData(),
      loadTaxonomyFiles("../../data/taxonomy"),
      loadManifestDocuments(),
      loadServedGovernmentDebtData(),
      loadServedGeneralGovernmentBalanceData(),
      loadEnglishCatalogue(repositoryRoot),
      readFile(path.join(repositoryRoot, "data/localization/ka/service-messages.json"), "utf8").then(text => serviceMessagesSchema.parse(JSON.parse(text))),
      readFile(path.join(repositoryRoot, "data/localization/en/service-messages.json"), "utf8").then(text => serviceMessagesSchema.parse(JSON.parse(text))),
      loadServedGdpOverviewData(),
      loadServedEconomicSectorsData(),
    ]);
```

Replace the two direct CSV reads (lines 670–671):

```ts
    gdpOverview: { facts: sortedBy(gdpOverview.facts, f => f.seriesId, f => f.year), series: GDP_QUERY_SERIES },
    economicSectors: { facts: sortedBy(economicSectors.facts, f => f.seriesId, f => f.measure, f => f.year), registry: ECONOMIC_SECTORS, definitions: SECTOR_DEFINITIONS },
```

Remove the now-unused `loadGdpOverviewFacts` and `loadEconomicSectorFacts` imports if nothing else in the file uses them.

- [ ] **Step 3: Prove the snapshot is byte-identical**

Run:

```bash
npm run data:prepare-fact-query-snapshot && git diff --stat lib/factQuery/generated/snapshot.json
```

Expected: no diff. If the file changed, the cause is the `value: number` vs `value: string` shape at those two keys — align the conversion so the serialised JSON matches, and do not accept a "harmless" formatting difference.

- [ ] **Step 4: Assert the mirror is used in database mode**

In `apps/web/tests/i18n/servingParity.test.ts`, add `loadEconomicSectorFactsFromDb` to the mirror mock beside the existing mocked readers, and add:

```ts
  it("builds the snapshot from the mirror for every dataset in db mode", async () => {
    process.env.GEODATA_DATA_SOURCE = "db";
    resetServedDataCacheForTests();
    await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" });

    for (const reader of [loadGdpOverviewFactsFromDb, loadEconomicSectorFactsFromDb, loadGovernmentDebtFactsFromDb]) {
      expect(reader).toHaveBeenCalledTimes(1);
    }
  });
```

Match the file's existing mocking style and its env cleanup.

Run: `npx vitest run tests/i18n/servingParity.test.ts tests/factQuery/buildSnapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/factQuery/buildSnapshot.ts tests/i18n/servingParity.test.ts
git commit -m "fix(mcp): build the snapshot's GDP and sector facts from the served loaders"
```

---

### Task 4: Methodology articles load debt data only for the debt article

**Files:**
- Modify: `apps/web/lib/pages/methodology-article.tsx:120-127`
- Test: `apps/web/tests/methodology/catalog.test.ts` (or the existing methodology route test)

**Interfaces:**
- `deriveMethodologyCoverage(dataset, budgetFacts, municipalTotals, debtFacts, archiveSummary)` keeps its signature; only the debt article passes a non-empty array. Confirm the function's debt branch is reached only for `dataset === "government-debt"` before changing the call.

- [ ] **Step 1: Write the failing test**

Append to the methodology route test:

```tsx
  it("loads debt facts only for the debt article", async () => {
    const debtModule = await import("../../lib/data/governmentDebt/importGovernmentDebtFacts");
    const spy = vi.spyOn(debtModule, "loadServedGovernmentDebtData");

    await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "revenue" }) });
    expect(spy).not.toHaveBeenCalled();

    await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "government-debt" }) });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
```

Use the dataset slugs the route actually validates; read them from `validatedDataset` if the two above are not exact.

Run: `npx vitest run tests/methodology`
Expected: FAIL — every article loads debt data.

- [ ] **Step 2: Load it conditionally**

In `apps/web/lib/pages/methodology-article.tsx`, replace the debt entry in the `Promise.all` with a conditional load:

```tsx
  const [landingData, municipalData, debtData, archiveSummaries, rows, catalogue] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    // Only the debt article's coverage line reads these facts, and a build
    // renders seven articles in two languages.
    dataset === "government-debt" ? loadServedGovernmentDebtData() : Promise.resolve({ facts: [] }),
    loadGeneratedArchiveSummaries(repositoryRoot),
    loadReviewedSourceManifest(repositoryRoot, content.archiveManifestId),
    loadEnglishCatalogue(repositoryRoot),
  ]);
```

Use the dataset identifier the file already has in scope (`dataset`, from `validatedDataset`).

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/methodology`
Expected: PASS.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/methodology.spec.ts`
Expected: PASS — every article's coverage line is unchanged, including the debt one.

- [ ] **Step 4: Commit**

```bash
git add lib/pages/methodology-article.tsx tests/methodology
git commit -m "perf(methodology): load debt facts only for the debt article"
```

---

### Task 5: The GDP mirror reader uses the timezone-safe date helper

**Files:**
- Modify: `apps/web/lib/db/mirrorRows.ts:461`
- Test: the existing timezone-pinned `isoDate` test (added by `38d2f9b97`)

- [ ] **Step 1: Write the failing test**

Extend the existing timezone test file with the GDP reader. Follow its pattern for pinning `process.env.TZ` and building a fake Prisma client; the assertion is:

```ts
  it("keeps the calendar date for GDP overview rows east of UTC", async () => {
    const db = { gdpOverviewFact: { findMany: async () => [{
      seriesId: "nominal_gel", year: 2025, value: new Prisma.Decimal("1"), unit: "gel",
      status: "preliminary", accountingStandard: "sna_2008", sourceDocumentId: "source.x",
      sourceLocator: "Sheet1!A1", lastReviewedAt: new Date("2026-09-11T20:00:00.000Z"),
    }] } };

    const [fact] = await loadGdpOverviewFactsFromMirror(db as never);
    expect(fact!.lastReviewedAt).toBe("2026-09-12");
  });
```

with `process.env.TZ = "Asia/Tbilisi"` set the way the existing municipal-population case sets it.

Run: `npx vitest run tests/db`
Expected: FAIL — `toISOString().slice(0, 10)` returns `2026-09-11`.

- [ ] **Step 2: Use `isoDate`**

In `apps/web/lib/db/mirrorRows.ts`, inside `loadGdpOverviewFactsFromMirror`, replace `lastReviewedAt:row.lastReviewedAt.toISOString().slice(0,10)` with `lastReviewedAt:isoDate(row.lastReviewedAt)`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/db`
Expected: PASS.

Run: `grep -n "toISOString().slice(0, *10)" lib/db/mirrorRows.ts`
Expected: no matches left in this file; every date goes through `isoDate`.

- [ ] **Step 4: Commit**

```bash
git add lib/db/mirrorRows.ts tests/db
git commit -m "fix(db): read the GDP mirror review date with the timezone-safe helper"
```

---

### Task 6: The explorer footer stops bundling server catalogues

**Files:**
- Modify: `apps/web/components/shell/explorer-footer.tsx`
- Modify: `apps/web/lib/i18n/common.server.ts` (add `import "server-only";`)
- Test: `apps/web/tests/browser/main-explorer.spec.ts` (the footer test that already exists)

**Interfaces:**
- `ExplorerFooter({ updatedAt, locale })` keeps its props; `locale` still goes to `SiteFooter`. Messages come from `useI18n()`, which the explorer layouts already provide (`lib/pages/explorer-layout.tsx:12-16`).

- [ ] **Step 1: Check the provider covers it**

Run: `grep -rn "I18nProvider" lib/pages/explorer-layout.tsx lib/pages/inflation.tsx lib/pages/gdp.tsx lib/pages/economic-sectors.tsx lib/pages/debt.tsx lib/pages/deficit.tsx`
Expected: every route family that renders `ExplorerFooter` sits inside an `I18nProvider` whose namespaces include `common`. If one does not, add `common` to that page's `getPresentation` call in this step — the footer cannot read what the provider was not given.

- [ ] **Step 2: Read messages from the provider**

Replace `apps/web/components/shell/explorer-footer.tsx`:

```tsx
"use client";
import { usePathname } from "next/navigation";
import { SiteFooter } from "../site/site-footer";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { splitLanguagePath } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

export function ExplorerFooter({updatedAt,locale}:{updatedAt:string;locale:Locale}) {
  // The messages come from the layout's provider. Importing common.server.ts
  // here bundled BOTH locales' common catalogue into every explorer route.
  const {messages}=useI18n();
  const {pathname}=splitLanguagePath(usePathname());
  const economy=pathname==='/explorer/economy'||pathname.startsWith('/explorer/economy/');
  const inflation=pathname==='/explorer/inflation'||pathname.startsWith('/explorer/inflation/');
  const noteKey=inflation?'common.inflationSourceNote':economy?(pathname==='/explorer/economy/sectors'?'common.sectorsSourceNote':'common.economySourceNote'):null;
  return <SiteFooter updatedAt={updatedAt} locale={locale} sourceNote={noteKey?message(messages,noteKey,{updatedAt:'{updatedAt}'}):undefined}/>;
}
```

The literal `{updatedAt}` placeholder is deliberate: `components/site/site-footer.tsx:11` splits on it.

In `apps/web/lib/i18n/common.server.ts`, add as the first line:

```ts
import "server-only";
```

- [ ] **Step 3: Verify the text and the bundle**

Run: `npx vitest run tests/i18n tests/explorer`
Expected: PASS.

Run: `npm run build`
Expected: exit 0. A client import of `common.server.ts` would now fail the build; if it does, the named file is the one to fix, not the guard.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/main-explorer.spec.ts -g "footer"`
Expected: PASS — the footer text and the source note are unchanged on every route family, in both locales.

- [ ] **Step 4: Commit**

```bash
git add components/shell/explorer-footer.tsx lib/i18n/common.server.ts
git commit -m "perf(shell): read footer messages from the provider, not the server catalogue"
```

---

### Task 7: Client rows for GDP and sectors

**Files:**
- Modify: `apps/web/lib/servedRows.ts` (new client types; header comment)
- Modify: `apps/web/lib/explorer/clientData.ts` (projections)
- Modify: `apps/web/lib/pages/gdp.tsx`, `apps/web/components/gdp/gdp-overview.tsx`, `apps/web/lib/explorer/gdpOverview.ts`
- Modify: `apps/web/lib/pages/economic-sectors.tsx`, `apps/web/components/economic-sectors/*`, `apps/web/lib/explorer/economicSectorsWorkbook.ts`

**Interfaces:**
- Produces, in `lib/servedRows.ts`:
  ```ts
  export type ClientGdpObservation = { seriesId: string; year: number; value: number; status: "published" | "preliminary" };
  export type ClientSectorObservation = { seriesId: string; year: number; measure: "nominal" | "share_of_gdp" | "real_growth"; value: number; status: "published" | "preliminary" };
  ```
- Produces, in `lib/explorer/clientData.ts`: `projectGdpObservation`, `projectSectorObservation`, and `sourceIdBySeries(facts)` / `sourceIdByMeasure(facts)` builders returning `Record<string, string>`.
- `buildGdpOverviewModel(facts, state, sourceIdBySeries)` gains a third parameter; it returns the same `sourceIds` array as before.
- `buildEconomicSectorsWorkbookExportModel` reads source ids from the page's `sourceIdByMeasure` map instead of `fact.sourceId`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/clientProjections.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadGdpOverviewFacts } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadEconomicSectorFacts } from "../../lib/data/economicSectors/importEconomicSectors";
import {
  projectGdpObservation,
  projectSectorObservation,
  sourceIdByMeasure,
  sourceIdBySeries,
} from "../../lib/explorer/clientData";

describe("client projections", () => {
  it("keeps only the fields the browser reads", async () => {
    const gdp = (await loadGdpOverviewFacts()).map((fact) => ({ ...fact, value: Number(fact.value) }));
    const sectors = (await loadEconomicSectorFacts()).map((fact) => ({ ...fact, value: Number(fact.value) }));

    expect(Object.keys(projectGdpObservation(gdp[0]!)).sort()).toEqual(["seriesId", "status", "value", "year"]);
    expect(Object.keys(projectSectorObservation(sectors[0]!)).sort()).toEqual([
      "measure", "seriesId", "status", "value", "year",
    ]);
  });

  it("hoists one source id per series and per measure", async () => {
    const gdp = (await loadGdpOverviewFacts()).map((fact) => ({ ...fact, value: Number(fact.value) }));
    const sectors = (await loadEconomicSectorFacts()).map((fact) => ({ ...fact, value: Number(fact.value) }));

    const bySeries = sourceIdBySeries(gdp);
    for (const fact of gdp) expect(bySeries[fact.seriesId]).toBe(fact.sourceId);

    const byMeasure = sourceIdByMeasure(sectors);
    for (const fact of sectors) expect(byMeasure[fact.measure]).toBe(fact.sourceId);
  });
});
```

Run: `npx vitest run tests/explorer/clientProjections.test.ts`
Expected: FAIL — the projections do not exist. If the second case fails on real data, the map key is wrong for that dataset; fix the map, not the assertion, and say so in the PR.

- [ ] **Step 2: Add the types and projections**

In `apps/web/lib/servedRows.ts`, append the two types above, with a comment tying them to the header's contract:

```ts
// Explorer pages send these to the browser instead of the served rows. The
// unread provenance columns (sourceLocator, unit, valuation, priceBasis,
// accountingStandard, per-row lastReviewedAt) stay on the server; each page
// hoists the source ids its workbook builder needs into one small map.
```

In `apps/web/lib/explorer/clientData.ts`, add:

```ts
export function projectGdpObservation(fact: ServedGdpObservation): ClientGdpObservation {
  return { seriesId: fact.seriesId, year: fact.year, value: fact.value, status: fact.status };
}

export function projectSectorObservation(fact: ServedSectorObservation): ClientSectorObservation {
  return { seriesId: fact.seriesId, year: fact.year, measure: fact.measure, value: fact.value, status: fact.status };
}

/** One source id per series (GDP) or per measure (sectors): every row in a group shares it. */
export function sourceIdBySeries(facts: readonly { seriesId: string; sourceId: string }[]): Record<string, string> {
  return Object.fromEntries(facts.map((fact) => [fact.seriesId, fact.sourceId]));
}

export function sourceIdByMeasure(facts: readonly { measure: string; sourceId: string }[]): Record<string, string> {
  return Object.fromEntries(facts.map((fact) => [fact.measure, fact.sourceId]));
}
```

Import the served types with `import type { … }` only, so the file keeps its build-time-free shape.

- [ ] **Step 3: Project on the GDP page**

In `apps/web/lib/pages/gdp.tsx`, compute the server-side values before projecting and pass the map:

```tsx
  const lastReviewedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1)!;

      <GdpOverview
        facts={facts.map(projectGdpObservation)}
        sourceIdBySeries={sourceIdBySeries(facts)}
        lastReviewedAt={lastReviewedAt}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
```

In `apps/web/components/gdp/gdp-overview.tsx`, change the props type to `ClientGdpObservation[]` plus `sourceIdBySeries: Record<string, string>` and `lastReviewedAt: string`, pass the map into `buildGdpOverviewModel`, and use the `lastReviewedAt` prop where the component previously read it from a row (lines 112–115).

In `apps/web/lib/explorer/gdpOverview.ts`, change `buildGdpOverviewModel(facts, state)` to take the map and replace the `sourceIds` line:

```ts
    sourceIds: [...new Set(selected.map((f) => sourceIdBySeries[f.seriesId]!))],
```

- [ ] **Step 4: Project on the sectors page**

In `apps/web/lib/pages/economic-sectors.tsx`, keep `firstYear`, `lastYear` and `dateModified` computed from the served facts (they already are, line 35), then pass projected rows:

```tsx
    <EconomicSectorsExplorer facts={facts.map(projectSectorObservation)} sourceIdByMeasure={sourceIdByMeasure(facts)} registry={ECONOMIC_SECTORS} sources={sources} siteOrigin={resolveSiteUrl()}/>
```

Thread `sourceIdByMeasure` through the explorer component to `buildEconomicSectorsWorkbookExportModel`, and in `apps/web/lib/explorer/economicSectorsWorkbook.ts` replace the `neededYears` loop (lines 55–60):

```ts
  const neededYears = new Map<string, Set<number>>();
  for (const f of active) {
    const sourceId = sourceIdByMeasure[f.measure]!;
    const years = neededYears.get(sourceId) ?? new Set<number>();
    years.add(f.year);
    neededYears.set(sourceId, years);
  }
```

The `f.calculation === "year_over_year"` branch goes with it: no fact carries that value — every real-growth row is `index_to_growth` — so the branch was dead (spec §3.2). Remove any other read of `fact.sourceId` or `fact.calculation` in this builder the same way.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/explorer tests/data/economicSectors tests/data/gdpOverview`
Expected: PASS, with identical workbook models for fixed inputs. `npm run typecheck` names any component still reading a dropped field.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/gdp.spec.ts tests/browser/economic-sectors.spec.ts`
Expected: PASS — charts, tables and downloads unchanged.

- [ ] **Step 6: Commit**

```bash
git add lib/servedRows.ts lib/explorer/clientData.ts lib/explorer/gdpOverview.ts lib/explorer/economicSectorsWorkbook.ts lib/pages/gdp.tsx lib/pages/economic-sectors.tsx components/gdp components/economic-sectors tests/explorer/clientProjections.test.ts
git commit -m "perf(explorer): send the browser only the GDP and sector fields it reads"
```

---

### Task 8: Client rows for inflation and debt

**Files:**
- Modify: `apps/web/lib/servedRows.ts`, `apps/web/lib/explorer/clientData.ts`
- Modify: `apps/web/lib/pages/inflation.tsx` (lines 98, 151), `apps/web/lib/explorer/inflationOverview.ts:46-56`, the inflation components
- Modify: `apps/web/lib/pages/debt.tsx:67`, `apps/web/components/debt/debt-explorer.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type ClientCpiFact = { seriesId: string; measure: string; period: string; value: number };
  export type ClientBasketWeightRow = { categoryId: string; year: number; weightPct: number };
  export type ClientGovernmentDebtFact = Omit<ServedGovernmentDebtFact, "snapshotDate" | "lastReviewedAt">;
  ```
- `indexInflationFacts(facts, sourceIdBySeriesMeasure)` takes the hoisted map and returns the same `InflationIndex`.
- `sourceIdBySeriesMeasure(facts): Record<string, string>` keys on `` `${seriesId}:${measure}` ``, the same key `indexInflationFacts` builds today.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/clientProjections.test.ts`:

```ts
  it("projects inflation and debt rows", async () => {
    const { loadServedInflationData } = await import("../../lib/data/inflation/importInflation");
    const { loadServedGovernmentDebtData } = await import("../../lib/data/governmentDebt/importGovernmentDebtFacts");
    const { projectCpiFact, projectBasketWeight, projectDebtFact, sourceIdBySeriesMeasure } = await import("../../lib/explorer/clientData");
    const inflation = await loadServedInflationData();
    const debt = await loadServedGovernmentDebtData();

    expect(Object.keys(projectCpiFact(inflation.facts[0]!)).sort()).toEqual(["measure", "period", "seriesId", "value"]);
    expect(Object.keys(projectBasketWeight(inflation.weights[0]!)).sort()).toEqual(["categoryId", "weightPct", "year"]);
    expect(projectDebtFact(debt.facts[0]!)).not.toHaveProperty("snapshotDate");
    expect(projectDebtFact(debt.facts[0]!)).not.toHaveProperty("lastReviewedAt");

    const map = sourceIdBySeriesMeasure(inflation.facts);
    for (const fact of inflation.facts) expect(map[`${fact.seriesId}:${fact.measure}`]).toBe(fact.sourceId);
  });
```

Run: `npx vitest run tests/explorer/clientProjections.test.ts`
Expected: FAIL — the three projections do not exist.

- [ ] **Step 2: Add the types and projections**

Append the three types to `lib/servedRows.ts` and to `lib/explorer/clientData.ts`:

```ts
export function projectCpiFact(fact: ServedCpiFact): ClientCpiFact {
  return { seriesId: fact.seriesId, measure: fact.measure, period: fact.period, value: fact.value };
}

export function projectBasketWeight(row: ServedBasketWeightRow): ClientBasketWeightRow {
  return { categoryId: row.categoryId, year: row.year, weightPct: row.weightPct };
}

export function projectDebtFact(fact: ServedGovernmentDebtFact): ClientGovernmentDebtFact {
  const { snapshotDate: _snapshotDate, lastReviewedAt: _lastReviewedAt, ...rest } = fact;
  return rest;
}

export function sourceIdBySeriesMeasure(
  facts: readonly { seriesId: string; measure: string; sourceId: string }[],
): Record<string, string> {
  return Object.fromEntries(facts.map((fact) => [`${fact.seriesId}:${fact.measure}`, fact.sourceId]));
}
```

Use the exact field names of `ServedBasketWeightRow` (`weightPct` or whatever the type declares) — read it before writing this.

- [ ] **Step 3: Project on the inflation pages**

In `apps/web/lib/pages/inflation.tsx`, compute `lastReviewedAt` (the maximum) from the served rows before projecting, then pass projected rows plus the hoisted map at line 98 (CPI facts) and line 151 (basket weights).

In `apps/web/lib/explorer/inflationOverview.ts`, change `indexInflationFacts` to take the map:

```ts
export function indexInflationFacts(
  facts: ClientCpiFact[],
  sourceIdBySeriesMeasure: Record<string, string>,
): InflationIndex {
  const values = new Map<string, Map<number, number>>();
  const sourceIds = new Map<string, string>();
  for (const fact of facts) {
    const group = `${fact.seriesId}:${fact.measure}`;
    if (!values.has(group)) values.set(group, new Map());
    values.get(group)!.set(periodFromKey(fact.period), fact.value);
    sourceIds.set(group, sourceIdBySeriesMeasure[group]!);
  }
  return { values, sourceIds };
}
```

Thread the map from the page through the inflation components to every `indexInflationFacts` call site.

- [ ] **Step 4: Project on the debt page**

In `apps/web/lib/pages/debt.tsx:67`, pass `facts={facts.map(projectDebtFact)}`. The page already passes `lastUpdatedAt` separately (line 72), so nothing else moves. In `components/debt/debt-explorer.tsx`, change the prop type to `ClientGovernmentDebtFact[]`; `npm run typecheck` names any reader of the two dropped fields.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/explorer tests/data/inflation`
Expected: PASS, with identical workbook models.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/inflation.spec.ts tests/browser/debt.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/servedRows.ts lib/explorer/clientData.ts lib/explorer/inflationOverview.ts lib/pages/inflation.tsx lib/pages/debt.tsx components/inflation components/debt tests/explorer/clientProjections.test.ts
git commit -m "perf(explorer): send the browser only the inflation and debt fields it reads"
```

---

### Task 9: Guard nine routes, and record the contract

**Files:**
- Modify: `apps/web/tests/browser/main-explorer.spec.ts:1188-1211`
- Modify: `docs/data-methodology/database-import.md`

- [ ] **Step 1: Extend the guard**

Replace the payload test body so the three budget routes keep their exact zero assertions and the six new routes get their own:

```ts
test("ships no server-only provenance fields in explorer payloads", async ({ page }) => {
  const readPayload = async () =>
    page.evaluate(() => {
      const payload = [...document.querySelectorAll("script")].map((script) => script.textContent ?? "").join("\n");
      const count = (needle: string) => payload.split(needle).length - 1;
      return {
        sourceRegistry: count("sourceUrlOrFile"),
        sourceIds: count("sourceId"),
        officialInstitutionLabels: count("officialInstitutionLabelKa"),
        sourceLocators: count("sourceLocator"),
        snapshotDates: count("snapshotDate"),
        valuations: count("valuation"),
        priceBases: count("priceBasis"),
        accountingStandards: count("accountingStandard"),
      };
    });

  for (const route of ["/explorer/expenditure", "/explorer/revenue", "/explorer/analysis"]) {
    await page.goto(`${TEST_BASE_URL}${route}`);
    await expectAppReady(page);
    const occurrences = await readPayload();
    expect(
      {
        sourceRegistry: occurrences.sourceRegistry,
        sourceIds: occurrences.sourceIds,
        officialInstitutionLabels: occurrences.officialInstitutionLabels,
      },
      route,
    ).toEqual({ sourceRegistry: 0, sourceIds: 0, officialInstitutionLabels: 0 });
  }

  // The dataset routes hoist their source ids into one small map per page, so
  // `sourceId` appears a handful of times instead of once per row; the unread
  // provenance columns must not appear at all.
  for (const route of [
    "/explorer/debt",
    "/explorer/deficit",
    "/explorer/economy/gdp",
    "/explorer/economy/sectors",
    "/explorer/inflation/overview",
    "/explorer/inflation/categories",
  ]) {
    await page.goto(`${TEST_BASE_URL}${route}`);
    await expectAppReady(page);
    const occurrences = await readPayload();
    expect(
      {
        sourceLocators: occurrences.sourceLocators,
        snapshotDates: occurrences.snapshotDates,
        valuations: occurrences.valuations,
        priceBases: occurrences.priceBases,
        accountingStandards: occurrences.accountingStandards,
      },
      route,
    ).toEqual({ sourceLocators: 0, snapshotDates: 0, valuations: 0, priceBases: 0, accountingStandards: 0 });
    expect(occurrences.sourceIds, `${route} sourceId occurrences`).toBeLessThanOrEqual(20);
  }
});
```

Use the route paths the app actually serves; if a Georgian route differs from the list, take it from `pageHref`.

Run: `npm run build && npm run start -- --port 3100` in one terminal, and in another:

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/main-explorer.spec.ts -g "provenance"
```

Expected: PASS on all nine routes.

- [ ] **Step 2: Measure the payload**

With the same server running:

```bash
for route in /explorer/debt /explorer/deficit /explorer/economy/gdp /explorer/economy/sectors /explorer/inflation/overview /explorer/inflation/categories; do
  for prefix in "" /en; do
    printf "%s%s %s\n" "$prefix" "$route" "$(curl -s "http://localhost:3100${prefix}${route}" | wc -c)"
  done
done
```

Record the numbers. Run the same command on a build of `main` to get the before figures, and put both tables in the PR description (spec §3.3).

- [ ] **Step 3: Record the loading contract**

In `docs/data-methodology/database-import.md`, add to the serving section:

```markdown
The served loaders are memoised per process: `loadServedGovernmentDebtData`, `loadServedGeneralGovernmentBalanceData`, `loadServedGdpOverviewData`, `loadServedEconomicSectorsData` and `loadServedInflationData` each build once and hand the same promise to later callers, so a build runs each dataset's parity check once rather than once per route. Tests that switch `GEODATA_DATA_SOURCE` between cases must call `resetServedDataCacheForTests()`, which clears all of them.

`resolveServedDataSource()` in `lib/data/servedDataSource.ts` is the only reader of `GEODATA_DATA_SOURCE`; it accepts `csv` (the default) and `db` and throws on anything else.
```

- [ ] **Step 4: Commit**

```bash
git add tests/browser/main-explorer.spec.ts ../../docs/data-methodology/database-import.md
git commit -m "test(browser): guard the payload contract on all nine explorer routes"
```

---

### Task 10: Done-check and acceptance

**Files:** none (verification only).

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 2: Build and count the loads**

Run: `npm run build`
Expected: exit 0, and `lib/factQuery/generated/snapshot.json` unchanged (`git status` clean).

To count loads per process, temporarily add `console.count("debt load")` inside `loadServedGovernmentDebtDataUncached`, run `npm run build`, and confirm each worker prints it once. Remove the counter afterwards and confirm `git diff` is empty.

- [ ] **Step 3: Browser suite on the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass.

- [ ] **Step 4: Database mode, if credentials exist**

Run: `GEODATA_DATA_SOURCE=db npm run build`
Expected: exit 0, with GDP and sectors served from the mirror. If `apps/web/.env` has no mirror credentials, say so in the PR; the weekly `db-health` workflow covers it after merge.

- [ ] **Step 5: Acceptance walk**

1. One load per dataset per process (Step 2).
2. The snapshot is byte-identical in CSV mode.
3. In database mode the snapshot's GDP and sector facts come from the mirror (`tests/i18n/servingParity.test.ts`).
4. The payload guard passes on nine routes, and the PR carries before/after sizes.
5. `lib/db/mirrorRows.ts` has no remaining `toISOString().slice(0, 10)`.
6. `lib/i18n/common.server.ts` is `server-only` and the build passes.
7. No visible or workbook change: the chart, table and workbook tests pass untouched.

- [ ] **Step 6: Hand off**

Push `codex/served-loading-and-payload` and open a draft PR with the payload measurements and whether db-mode was verified. Merge only after CI is green.
