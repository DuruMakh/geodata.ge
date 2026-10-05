# Demography Plan 1 (Foundation and Population) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Demography hub and the Population page (Georgian and `/en`): a clickable map of the 11 regions and 64 municipalities, the standard line/table workspace with the 2025 census re-base marked, highlights for the first selected place, an Excel download and a methodology page, all served from the reviewed CSVs through the Supabase mirror.

**Architecture:** reviewed CSVs → a demography loader (CSV mode, or the mirror table checked row by row against the CSVs) → a narrow client projection → thin pages → the components the site already has, each with a few optional props (line chart `breaks`, table `breakYears`, the two maps' selecting and wording props plus a value-based model builder each). New code is limited to the serving path, the place and population model, a places list panel, highlights and the page composition.

**Tech Stack:** Next.js 16 (static prerender), strict TypeScript, Tailwind v4, Prisma 7 with Postgres, vitest (`renderToStaticMarkup` component tests), Playwright, zod, decimal.js. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-04-demography-section-design.md` (shared foundation) and `docs/superpowers/specs/2026-10-04-demography-population-design.md` (this page). Read both first; section numbers below (§) refer to them.

## Global Constraints

- Reuse first (`AGENTS.md`). Every change to an existing component or module is an optional addition whose default leaves current output and tests unchanged. Existing tests stay untouched except where a task says a list must grow. Nothing is copied or forked.
- Commands run from `apps/web`. While editing, run only what the change can break (`npx vitest run <file>`, `npm run typecheck`). `npm run check`, `npm run build` and the browser suite run once, in Task 16.
- Every commit message ends with a second `-m` holding the `Co-Authored-By` trailer your own session's instructions specify. The commands below show the one in force when this plan was reviewed (`Claude Opus 5.5`).
- Georgian is the default language; `/en` mirrors every path through `pageHref`. An English page carries no Georgian text anywhere, including JSON-LD.
- The 2025-01-01 census re-base (foundation §5): a marked series is never joined across 2024 and 2025 in a chart, a table or the range strip; no growth, change, rate, rank movement or difference is computed from a value before the break and one after it (R4).
- Basis wording (R6), exact: 2004–2014 "re-estimated in 2018"; 2015–2024 "estimated before the 2024 census"; 2025 onward "based on the 2024 census". Short break label `აღწერით გადათვლა` / "Census re-base".
- Maps show the latest loaded year only (no year selector). Tbilisi is one place, `region.tbilisi`; municipality `04` is normalised to it. Codes `05`, `42`, `43`, `46`, `64` never appear.
- Persons are exact integers; shares print at one decimal with `formatShare`; a missing value prints `—` and is never bridged or zero-filled. Coverage and defaults come from loaded facts, never constants.
- No Dataset JSON-LD, no download link, no MCP or publication entry for demography (§10). A test asserts no demography page emits a `downloadPath`.
- The page payload carries `{ geographyId, seriesId, year, value }` only: never `sourceLocator`, `lastReviewedAt` or `estimateBasis`.
- Plan 1 adds no colour token and nothing animates. Georgia is `ink`; other places use the stable palette assignment in Task 8.
- URL-hash keys: `sel`, `level` (`regions`|`municipalities`), `map` (`population`|`density`), `view` (`line`|`table`, as on the sector and regional pages), `range=all` or `start`/`end`. Loading the page never writes the URL, and every change replaces the history entry (DESIGN.md §6.3) through the shared `useReplaceHash`.
- `apps/web/AGENTS.md` says this is not the Next.js of older versions: every route file in this plan copies an existing route file exactly, and anything else Next-specific must be checked in `node_modules/next/dist/docs/` first.
- Georgian strings in this plan are drafts for the owner's review (foundation §9); Task 16 lists them.

## Reuse map (AGENTS.md "Reuse First")

**Reused as they are:** `ExplorerPage`, `ExplorerHeading`, `PageHeader`, `ExplorerWorkspace` (the two-column workspace), `useReplaceHash`, `loadDensityRows` (Tbilisi's reviewed area), `SeriesAside`, `SeriesSelector`, `SeriesSelectorRow`, `RangeStrip`, `Callout`, `SourceNote`, `Sparkline`, `HeroKpi`, `SideKpiList`, `BudgetHub`, `ExcelDownloadButton`, the workbook writer and `workbookModel`, `useAppReady`, `parseYearRangeKeys` / `writeYearRangeKeys`, `resolveRange` / `rangeFromPatch`, `matchesLabelQuery`, the outlines, hatched occupied areas, keyboard movement and legend of `MunicipalityMap` and `RegionalEconomyMap`, `MethodologyArticle`, the methodology archive machinery, `fiscalMetadata`, `BreadcrumbJsonLd`.

**Small additions (defaults keep today's output):** `EditorialLineChart` (`breaks`), `ExplorerTable` (`breakYears`, `breakLabel`), `RegionalEconomyMap` (`onSelect`, `selectedIds`, `wording`, per-region `display`), `MunicipalityMap` (`selectedCodes`, `wording`, per-place `display`), `regionalEconomyMap.ts` and `municipalityMapData.ts` (one value-based builder each, sharing the existing assembly code), `SegmentedTabs` (an option can be `disabled`), `MeasurePill` (`testId`), `format.ts` (persons units), `servedData.ts`, `servedDataParity.ts`, `mirrorRows.ts`, `servedDataDb.ts`, `import-budget-facts.ts`, `prepareDemography.ts` (its canonical reader moves out, behaviour unchanged), `clientData.ts`, `servedRows.ts`, `data-sidebar.tsx`, `explorer-footer.tsx`, the methodology registry (`types.ts`, `sourceInventory.ts`, `catalog.ts`, `revisions.ts`), `methodology-article.tsx` and `MethodologyArticle` (a dataset may have no download), `methodology-hub.tsx` (the population marker leaves the "coming next" list), `lib/pages/methodology.tsx` (the data catalog lists only datasets that carry Dataset markup), the i18n registries, the sitemap, the route inventory, `llms.txt`.

**New (nothing existing can be extended):** the `DemographyFact` table, its migration and its mirror reader; `canonicalRows.ts` (the canonical-file reader, moved out of the data-stage preparation so serving never loads the workbook readers) and `importDemography.ts` (the loader, in the pattern of `importRegionalEconomies.ts`); `demographyAreas.ts`, `demographyPopulation.ts` (the model); `demographyPopulationMaps.ts` (builds the three map models on the server, where the outline files can be read); `demographyPopulationWorkbook.ts` (the workbook builder, as each explorer has one); `demographyRoutes.ts` and `demographyHubCards.ts` (as `inflationHubCards.ts` and `economyHubCards.ts`); `population-series-panel.tsx` (the places list: `RegionalEconomySeriesPanel` is bound to sectors and `SeriesPanel` to budget items, so the shared `SeriesSelector` is composed directly); `population-highlights.tsx` (composes `HeroKpi` and `SideKpiList`); `population-explorer.tsx` and `use-population-state.ts` (composition and hash state, as `regional-economy-explorer.tsx` and `inflation-cities.tsx` do); the `demography` message files; two page modules and four thin route files; the methodology content and its archive manifest.

---

### Task 1: Mirror table and its reader

**Files:**
- Modify: `apps/web/prisma/schema.prisma` (new model; one relation field on `SourceDocument` and on `ImportRun`)
- Create: `apps/web/prisma/migrations/20261004000000_demography/migration.sql`
- Modify: `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`
- Test: `apps/web/tests/data/demography/mirrorRows.test.ts`, `apps/web/tests/data/demography/mirrorIntegration.test.ts`

**Interfaces:**
- Produces: `loadDemographyFactsFromMirror(db: MirrorClient): Promise<DemographyObservation[]>` in `mirrorRows.ts`, rows sorted by the seven key columns, a dimension column that holds the empty string omitted from the object (so it equals what the CSV loader returns); `loadDemographyFactsFromDb(): Promise<DemographyObservation[]>` in `servedDataDb.ts`.

- [ ] **Step 1: Install dependencies once per worktree**

Run: `cd apps/web && npm ci`
Expected: finishes with `Generated Prisma Client`. (A worktree without `node_modules` fails typecheck with errors that look like real breakage.)

- [ ] **Step 2: Write the failing tests**

`apps/web/tests/data/demography/mirrorRows.test.ts`:

```ts
import { expect, test, vi } from "vitest";
import { loadDemographyFactsFromMirror } from "../../../lib/db/mirrorRows";

const mirrorRow = (patch: Record<string, unknown> = {}) => ({
  seriesId: "demography.population_total",
  geographyId: "country.georgia",
  year: 2004,
  sex: "",
  ageGroup: "",
  citizenshipId: "",
  settlement: "",
  value: { toFixed: () => "3937716" },
  unit: "persons",
  estimateBasis: "retro_projection",
  status: "published",
  sourceLocator: "1!L5 [2004-01-01]",
  sourceDocumentId: "source.geostat_municipal_population",
  lastReviewedAt: new Date("2026-10-01T00:00:00.000Z"),
  ...patch,
});

test("demography mirror rows use the key ordering and drop empty dimensions", async () => {
  const findMany = vi.fn().mockResolvedValue([mirrorRow()]);

  const rows = await loadDemographyFactsFromMirror({ demographyFact: { findMany } } as never);

  expect(findMany).toHaveBeenCalledWith({
    orderBy: [
      { seriesId: "asc" },
      { geographyId: "asc" },
      { year: "asc" },
      { sex: "asc" },
      { ageGroup: "asc" },
      { citizenshipId: "asc" },
      { settlement: "asc" },
    ],
  });
  expect(rows).toEqual([{
    seriesId: "demography.population_total",
    geographyId: "country.georgia",
    year: 2004,
    value: "3937716",
    unit: "persons",
    estimateBasis: "retro_projection",
    status: "published",
    sourceId: "source.geostat_municipal_population",
    sourceLocator: "1!L5 [2004-01-01]",
    lastReviewedAt: "2026-10-01",
  }]);
});

test("demography mirror rows keep the dimensions a row has", async () => {
  const findMany = vi.fn().mockResolvedValue([
    mirrorRow({ sex: "female", ageGroup: "age_5_9", citizenshipId: "citizenship.turkey", settlement: "rural" }),
  ]);

  const [row] = await loadDemographyFactsFromMirror({ demographyFact: { findMany } } as never);

  expect(row).toMatchObject({ sex: "female", ageGroup: "age_5_9", citizenshipId: "citizenship.turkey", settlement: "rural" });
});
```

`apps/web/tests/data/demography/mirrorIntegration.test.ts`:

```ts
import fs from "node:fs/promises";
import { expect, test } from "vitest";

test("demography schema keeps exact decimals, a seven-part key and private access", async () => {
  const schema = await fs.readFile("prisma/schema.prisma", "utf8");
  expect(schema).toContain("model DemographyFact");
  expect(schema).toMatch(/@@id\(\[seriesId, geographyId, year, sex, ageGroup, citizenshipId, settlement\]\)/);

  const migration = await fs.readFile("prisma/migrations/20261004000000_demography/migration.sql", "utf8");
  expect(migration).toContain('ALTER TABLE "DemographyFact" ENABLE ROW LEVEL SECURITY');
  expect(migration).toContain('REVOKE ALL ON TABLE "DemographyFact" FROM anon, authenticated');
  expect(migration).toContain("DECIMAL(40,20)");
  expect(migration).toContain('PRIMARY KEY ("seriesId", "geographyId", "year", "sex", "ageGroup", "citizenshipId", "settlement")');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/data/demography/mirrorRows.test.ts tests/data/demography/mirrorIntegration.test.ts`
Expected: FAIL (`loadDemographyFactsFromMirror is not a function`; `ENOENT ... 20261004000000_demography`).

- [ ] **Step 4: Add the Prisma model**

In `apps/web/prisma/schema.prisma`, add `  demographyFacts   DemographyFact[]` on the line after `  regionalEconomyFacts RegionalEconomyFact[]` in **both** `model SourceDocument` and `model ImportRun` (the line occurs twice). Then add this model directly before `model InflationCpiFact {`:

```prisma
// Mirror of the served data/imports/demography-*.csv files: one flat observation table in the
// shape the data stage already uses. A dimension a file does not have is the empty string, so
// every part of the key is non-null.
model DemographyFact {
  seriesId         String
  geographyId      String
  year             Int
  sex              String
  ageGroup         String
  citizenshipId    String
  settlement       String
  value            Decimal        @db.Decimal(40, 20)
  unit             String
  estimateBasis    String
  status           String
  sourceLocator    String
  sourceDocumentId String
  sourceDocument   SourceDocument @relation(fields: [sourceDocumentId], references: [id])
  lastReviewedAt   DateTime       @db.Date
  importRunId      String?
  importRun        ImportRun?     @relation(fields: [importRunId], references: [id])

  @@id([seriesId, geographyId, year, sex, ageGroup, citizenshipId, settlement])
}
```

- [ ] **Step 5: Add the migration**

`apps/web/prisma/migrations/20261004000000_demography/migration.sql` (equal to what `prisma migrate diff --from-schema <old> --to-schema <new> --script` prints, in the layout of `20260913000000_regional_economies`):

```sql
CREATE TABLE "DemographyFact" (
  "seriesId" TEXT NOT NULL,
  "geographyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "sex" TEXT NOT NULL,
  "ageGroup" TEXT NOT NULL,
  "citizenshipId" TEXT NOT NULL,
  "settlement" TEXT NOT NULL,
  "value" DECIMAL(40,20) NOT NULL,
  "unit" TEXT NOT NULL,
  "estimateBasis" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "DemographyFact_pkey" PRIMARY KEY ("seriesId", "geographyId", "year", "sex", "ageGroup", "citizenshipId", "settlement"),
  CONSTRAINT "DemographyFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DemographyFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "DemographyFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemographyFact" FROM anon, authenticated;
```

- [ ] **Step 6: Regenerate the Prisma client and add the reader**

Run: `npm run prisma:generate`
Expected: `Generated Prisma Client`.

In `apps/web/lib/db/mirrorRows.ts`, add to the type imports (beside `RegionalEconomyObservation`):

```ts
import type { DemographyObservation, Sex, Settlement } from "../data/demography/types";
```

and add after `loadRegionalEconomyFactsFromMirror`:

```ts
export async function loadDemographyFactsFromMirror(
  db: MirrorClient,
): Promise<DemographyObservation[]> {
  const rows = await db.demographyFact.findMany({
    orderBy: [
      { seriesId: "asc" },
      { geographyId: "asc" },
      { year: "asc" },
      { sex: "asc" },
      { ageGroup: "asc" },
      { citizenshipId: "asc" },
      { settlement: "asc" },
    ],
  });
  return rows.map((row) => ({
    seriesId: row.seriesId,
    geographyId: row.geographyId,
    year: row.year,
    value: row.value.toFixed(),
    unit: row.unit,
    estimateBasis: row.estimateBasis as DemographyObservation["estimateBasis"],
    status: row.status as DemographyObservation["status"],
    sourceId: row.sourceDocumentId,
    sourceLocator: row.sourceLocator,
    lastReviewedAt: isoDate(row.lastReviewedAt),
    ...(row.sex ? { sex: row.sex as Sex } : {}),
    ...(row.ageGroup ? { ageGroup: row.ageGroup } : {}),
    ...(row.citizenshipId ? { citizenshipId: row.citizenshipId } : {}),
    ...(row.settlement ? { settlement: row.settlement as Settlement } : {}),
  }));
}
```

In `apps/web/lib/db/servedDataDb.ts`, add `loadDemographyFactsFromMirror,` to the import list from `./mirrorRows` (after `loadRegionalEconomyFactsFromMirror,`) and add after `loadRegionalEconomyFactsFromDb`:

```ts
export async function loadDemographyFactsFromDb() {
  return loadDemographyFactsFromMirror(prisma);
}
```

- [ ] **Step 7: Run the tests and the typecheck**

Run: `npx vitest run tests/data/demography/mirrorRows.test.ts tests/data/demography/mirrorIntegration.test.ts && npm run typecheck`
Expected: 3 tests pass; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add prisma lib/db tests/data/demography/mirrorRows.test.ts tests/data/demography/mirrorIntegration.test.ts
git commit -m "feat(demography): mirror table and reader for the served demography files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Demography loader (CSV and mirror modes)

**Files:**
- Create: `apps/web/lib/data/demography/canonicalRows.ts`, `apps/web/lib/data/demography/importDemography.ts`
- Modify: `apps/web/lib/data/demography/prepareDemography.ts` (its canonical reader moves out; behaviour unchanged), `apps/web/lib/data/demography/types.ts`, `apps/web/lib/data/servedDataParity.ts`, `apps/web/lib/data/servedData.ts`, `apps/web/tests/data/servedLoaders.test.ts`
- Test: `apps/web/tests/data/demography/importDemography.test.ts`, `apps/web/tests/data/demography/servingBoundary.test.ts`

**Interfaces:**
- Consumes: `loadDemographyFactsFromDb` (Task 1); `populationEstimateBasis`, `SERIES` from `lib/data/demography/series.ts`; `DemographyObservation` from `types.ts`.
- Produces (all exported from `importDemography.ts` unless noted):
  - `parseCanonicalDemographyRows(text: string, file: string): DemographyObservation[]` (`canonicalRows.ts`)
  - `demographyFactParityKey(row): string` (`servedDataParity.ts`)
  - `SERVED_DEMOGRAPHY_FILES: readonly string[]` (population then density CSV), equal to `SERVED_DATA_FILES.demographyPopulationFacts` and `.demographyDensityFacts`
  - `ServedDemographyObservation = Omit<DemographyObservation, "value"> & { value: number }` (in `types.ts`, so client-facing modules can import it without touching the loader)
  - `loadDemographyFacts(relativePaths?: readonly string[]): Promise<DemographyObservation[]>` (value text normalised with `new Decimal(v).toFixed()`, so `65.0` and the mirror's `65` agree)
  - `assertDemographyParity(csv: DemographyObservation[], db: DemographyObservation[]): void`
  - `loadServedDemographyRows(): Promise<{ facts: DemographyObservation[] }>`, `loadServedDemographyData(): Promise<{ facts: ServedDemographyObservation[] }>`, `resetDemographyCacheForTests(): void`

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/data/demography/importDemography.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { parseCanonicalDemographyRows } from "../../../lib/data/demography/canonicalRows";
import {
  assertDemographyParity,
  loadDemographyFacts,
  SERVED_DEMOGRAPHY_FILES,
} from "../../../lib/data/demography/importDemography";
import { populationEstimateBasis, SERIES } from "../../../lib/data/demography/series";
import type { DemographyObservation } from "../../../lib/data/demography/types";
import { SERVED_DATA_FILES } from "../../../lib/data/servedData";
import { loadSourceDocuments } from "../../../lib/data/sources";

let facts: DemographyObservation[];
const population = () => facts.filter((row) => row.seriesId === SERIES.populationTotal);
const valueOf = (geographyId: string, year: number, seriesId: string = SERIES.populationTotal) =>
  facts.find((row) => row.seriesId === seriesId && row.geographyId === geographyId && row.year === year)?.value;

beforeAll(async () => {
  facts = await loadDemographyFacts();
});

describe("demography loader", () => {
  test("serves the two files SERVED_DATA_FILES names", () => {
    expect([...SERVED_DEMOGRAPHY_FILES]).toEqual([
      SERVED_DATA_FILES.demographyPopulationFacts,
      SERVED_DATA_FILES.demographyDensityFacts,
    ]);
  });

  test("loads every canonical row of both files", () => {
    expect(population()).toHaveLength(923);
    expect(facts.filter((row) => row.seriesId === SERIES.populationDensity)).toHaveLength(145);
  });

  test("reads the anchor values from the CSVs", () => {
    expect(valueOf("country.georgia", 2024)).toBe("3694608");
    expect(valueOf("country.georgia", 2025)).toBe("3930428");
    expect(valueOf("country.georgia", 2026)).toBe("3941103");
    expect(valueOf("region.tbilisi", 2026)).toBe("1369356");
    expect(valueOf("11", 2024)).toBe("28250"); // Khulo before the re-base
    expect(valueOf("11", 2025)).toBe("16307");
    expect(valueOf("06", 2024)).toBe("183181"); // Batumi
    expect(valueOf("06", 2025)).toBe("236845");
    expect(valueOf("country.georgia", 2024, SERIES.populationDensity)).toBe("64.6");
    expect(valueOf("region.tbilisi", 2024, SERIES.populationDensity)).toBe("2495.9");
    expect(valueOf("region.racha_lechkhumi_kvemo_svaneti", 2024, SERIES.populationDensity)).toBe("5.7");
  });

  test("normalises decimal text so the mirror can match it", () => {
    expect(valueOf("country.georgia", 2014, SERIES.populationDensity)).toBe("65");
  });

  test("every row's basis is the lineage of its year", () => {
    expect(facts.every((row) => row.estimateBasis === populationEstimateBasis(row.year))).toBe(true);
  });

  test("the 11 regions and, separately, the 64 municipalities sum to Georgia in every year they cover", () => {
    const rows = population();
    const years = [...new Set(rows.map((row) => row.year))];
    for (const year of years) {
      const georgia = Number(valueOf("country.georgia", year));
      for (const part of [/^region\./, /^\d{2}$/]) {
        const members = rows.filter((row) => row.year === year && part.test(row.geographyId));
        if (members.length === 0) continue;
        expect(members.reduce((sum, row) => sum + Number(row.value), 0), `${year} ${part}`).toBe(georgia);
      }
    }
    expect(rows.filter((row) => /^\d{2}$/.test(row.geographyId) && row.year === 2026)).toHaveLength(64);
    expect(rows.filter((row) => /^region\./.test(row.geographyId) && row.year === 2026)).toHaveLength(11);
  });

  test("Tbilisi is the same number as a region and as municipality 04", () => {
    for (const year of [2015, 2024, 2025, 2026]) {
      expect(valueOf("04", year)).toBe(valueOf("region.tbilisi", year));
    }
  });

  test("registers every source id the rows cite", async () => {
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const registered = new Set(sources.map((source) => source.sourceId));
    expect([...new Set(facts.map((row) => row.sourceId))].sort()).toEqual([
      "source.geostat_demography_density",
      "source.geostat_municipal_population",
    ]);
    expect(facts.every((row) => registered.has(row.sourceId))).toBe(true);
  });

  test("an invalid canonical row names its file and line", () => {
    const header = "series_id,geography_id,year,value,unit,estimate_basis,status,source_id,source_locator,last_reviewed_at";
    const text = `${header}\nx,country.georgia,2004,1,persons,pre_census,draft,s,l,2026-10-01\n`;
    expect(() => parseCanonicalDemographyRows(text, "demo.csv")).toThrow(/demo\.csv row 2 is invalid/);
  });
});

describe("demography parity", () => {
  test("ignores row order but preserves exact decimal text", () => {
    expect(() => assertDemographyParity(facts, [...facts].reverse())).not.toThrow();
    const changed = structuredClone(facts);
    changed[0].value = `${changed[0].value}1`;
    expect(() => assertDemographyParity(facts, changed)).toThrow(/Demography parity failed/);
  });

  test.each([
    { unit: "thousands" },
    { sourceLocator: "wrong" },
    { sourceId: "source.unknown" },
    { lastReviewedAt: "2026-09-01" },
    { status: "draft" },
  ])("rejects a changed mirror field %j", (patch) => {
    const changed = structuredClone(facts);
    changed[0] = { ...changed[0], ...patch } as DemographyObservation;
    expect(() => assertDemographyParity(facts, changed)).toThrow();
  });

  test("rejects a basis that disagrees with the year, a missing row and a duplicate row", () => {
    const wrongBasis = structuredClone(facts);
    wrongBasis[0] = { ...wrongBasis[0], estimateBasis: "census_based" };
    expect(() => assertDemographyParity(facts, wrongBasis)).toThrow(/lineage/);
    expect(() => assertDemographyParity(facts, facts.slice(1))).toThrow(/Demography parity failed/);
    expect(() => assertDemographyParity(facts, [...facts, facts[0]])).toThrow();
  });
});
```

`apps/web/tests/data/demography/servingBoundary.test.ts`:

```ts
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("../../../lib/data/demography/prepareDemography", () => {
  throw new Error("Serving demography must not load workbook preparation");
});

import {
  loadDemographyFacts,
  loadServedDemographyData,
  resetDemographyCacheForTests,
} from "../../../lib/data/demography/importDemography";

// The loader memoises its promise, so a case that stubs the data source has to start from an
// empty memo or it asserts against the mode the previous one resolved.
beforeEach(resetDemographyCacheForTests);

test("serving reads the reviewed CSVs without the Geostat workbook readers", async () => {
  expect(await loadDemographyFacts()).toHaveLength(1_068);
});

test("serving projects exact decimals to numbers only after validation", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "csv");
  try {
    const served = await loadServedDemographyData();
    expect(served.facts).toHaveLength(1_068);
    expect(served.facts.every((row) => typeof row.value === "number")).toBe(true);
  } finally {
    vi.unstubAllEnvs();
  }
});

test("serving rejects an unknown data source before reading facts", async () => {
  vi.stubEnv("GEODATA_DATA_SOURCE", "unknown");
  try {
    await expect(loadServedDemographyData()).rejects.toThrow('GEODATA_DATA_SOURCE must be "db" or "csv", got "unknown"');
  } finally {
    vi.unstubAllEnvs();
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/data/demography/importDemography.test.ts tests/data/demography/servingBoundary.test.ts`
Expected: FAIL (cannot resolve `canonicalRows` / `importDemography`).

- [ ] **Step 3: Move the canonical reader out of `prepareDemography.ts`**

Create `apps/web/lib/data/demography/canonicalRows.ts` (the schema and mapping that `loadPreviousObservations` holds today, unchanged):

```ts
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { ESTIMATE_BASES } from "./types";
import type { DemographyObservation } from "./types";

const rowSchema = z.object({
  series_id: z.string().min(1),
  geography_id: z.string().min(1),
  year: z.coerce.number().int(),
  value: z.string().min(1),
  unit: z.string().min(1),
  estimate_basis: z.enum(ESTIMATE_BASES),
  status: z.literal("published"),
  source_id: z.string().min(1),
  source_locator: z.string().min(1),
  last_reviewed_at: z.string().min(1),
  sex: z.enum(["total", "male", "female"]).optional(),
  age_group: z.string().optional(),
  citizenship_id: z.string().optional(),
  settlement: z.enum(["total", "urban", "rural"]).optional(),
});

/** Parses the text of one committed canonical demography file. `file` only names the file in an error. */
export function parseCanonicalDemographyRows(text: string, file: string): DemographyObservation[] {
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return records.map((record, index) => {
    const result = rowSchema.safeParse(record);
    if (!result.success) throw new Error(`${file} row ${index + 2} is invalid: ${result.error.message}`);
    const row = result.data;
    return {
      seriesId: row.series_id,
      geographyId: row.geography_id,
      year: row.year,
      value: row.value,
      unit: row.unit,
      estimateBasis: row.estimate_basis,
      status: row.status,
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
      ...(row.sex ? { sex: row.sex } : {}),
      ...(row.age_group ? { ageGroup: row.age_group } : {}),
      ...(row.citizenship_id ? { citizenshipId: row.citizenship_id } : {}),
      ...(row.settlement ? { settlement: row.settlement } : {}),
    };
  });
}
```

In `apps/web/lib/data/demography/prepareDemography.ts`: add `import { parseCanonicalDemographyRows } from "./canonicalRows";` beside the other local imports; delete the `import { z } from "zod";` line, the `ESTIMATE_BASES` named import (keep `import type { DemographyObservation } from "./types";`), and the whole `const rowSchema = z.object({ ... });`; then replace the body of `loadPreviousObservations` with:

```ts
async function loadPreviousObservations(repositoryRoot: string): Promise<DemographyObservation[] | undefined> {
  const rows: DemographyObservation[] = [];
  let found = false;
  for (const { file } of FILES) {
    let text: string;
    try {
      text = await fs.readFile(path.join(repositoryRoot, file), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    found = true;
    rows.push(...parseCanonicalDemographyRows(text, file));
  }
  return found ? rows : undefined;
}
```

(`parse` from `csv-parse/sync` stays imported: `checkSourcesRegistered` still uses it.)

- [ ] **Step 4: Prove the move changed nothing**

Run: `npx vitest run tests/data/demography/prepareDemography.test.ts tests/data/demography/validation.test.ts`
Expected: PASS, same counts as before the move.

- [ ] **Step 5: Add the served type and the parity key**

Append to `apps/web/lib/data/demography/types.ts`:

```ts
/** A served observation as server code receives it: the exact decimal text projected to a number. */
export type ServedDemographyObservation = Omit<DemographyObservation, "value"> & { value: number };
```

Append to `apps/web/lib/data/servedDataParity.ts`, after `adjaraBudgetAdjustmentParityKey`:

```ts
export function demographyFactParityKey(row: {
  seriesId: string;
  geographyId: string;
  year: number;
  sex?: string;
  ageGroup?: string;
  citizenshipId?: string;
  settlement?: string;
}): string {
  return [
    row.seriesId,
    row.geographyId,
    row.year,
    row.sex ?? "",
    row.ageGroup ?? "",
    row.citizenshipId ?? "",
    row.settlement ?? "",
  ].join(":");
}
```

- [ ] **Step 6: Write the loader**

`apps/web/lib/data/demography/importDemography.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { assertSameServedRows, demographyFactParityKey } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { parseCanonicalDemographyRows } from "./canonicalRows";
import { populationEstimateBasis, SERIES } from "./series";
import type { DemographyObservation, ServedDemographyObservation } from "./types";

// The files this release serves. SERVED_DATA_FILES names the same paths (a test keeps the two
// equal); they are spelled here too because servedData.ts imports this module, and importing it
// back would close a cycle. Later demography pages add their files here and to SERVED_DATA_FILES.
export const SERVED_DEMOGRAPHY_FILES = [
  "../../data/imports/demography-population-annual.csv",
  "../../data/imports/demography-density-annual.csv",
] as const;

const SERVED_SERIES = new Set<string>([SERIES.populationTotal, SERIES.populationDensity]);

// Everything the loader can check without the Geostat workbooks: the series are served ones, no
// key repeats, and every row's basis is the lineage of its year (foundation section 4).
function validateServedDemography(facts: readonly DemographyObservation[]): void {
  if (facts.length === 0) throw new Error("Demography facts are empty");
  const keys = new Set<string>();
  for (const fact of facts) {
    if (!SERVED_SERIES.has(fact.seriesId)) throw new Error(`Demography series is not served: ${fact.seriesId}`);
    if (fact.estimateBasis !== populationEstimateBasis(fact.year)) {
      throw new Error(
        `Demography basis ${fact.estimateBasis} disagrees with the lineage of ${fact.year} for ${fact.seriesId}|${fact.geographyId}`,
      );
    }
    const key = demographyFactParityKey(fact);
    if (keys.has(key)) throw new Error(`Duplicate demography row ${key}`);
    keys.add(key);
  }
}

export function assertDemographyParity(csv: DemographyObservation[], db: DemographyObservation[]) {
  try {
    validateServedDemography(csv);
    validateServedDemography(db);
    assertSameServedRows("Demography", csv, db, demographyFactParityKey);
  } catch (error) {
    throw new Error(`Demography parity failed: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

export async function loadDemographyFacts(
  relativePaths: readonly string[] = SERVED_DEMOGRAPHY_FILES,
): Promise<DemographyObservation[]> {
  const facts: DemographyObservation[] = [];
  for (const relativePath of relativePaths) {
    const filePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
    const text = await readFile(filePath, "utf8");
    // The mirror stores a Decimal and hands back its shortest text, so "65.0" must read as "65"
    // here or db mode would reject a faithful import.
    for (const fact of parseCanonicalDemographyRows(text, relativePath)) {
      facts.push({ ...fact, value: new Decimal(fact.value).toFixed() });
    }
  }
  validateServedDemography(facts);
  return facts;
}

// Build-time memo, for the reasons servedData.ts documents: one load per process, concurrent
// callers collapsed onto it, and a cached rejection so the first parity failure is the build failure.
let servedDemographyPromise: Promise<{ facts: DemographyObservation[] }> | null = null;
let servedDemographyNumbersPromise: Promise<{ facts: ServedDemographyObservation[] }> | null = null;

export function loadServedDemographyRows(): Promise<{ facts: DemographyObservation[] }> {
  servedDemographyPromise ??= loadServedDemographyRowsUncached();
  return servedDemographyPromise;
}

export function loadServedDemographyData(): Promise<{ facts: ServedDemographyObservation[] }> {
  servedDemographyNumbersPromise ??= loadServedDemographyRows().then(({ facts }) => ({
    facts: facts.map((fact) => ({ ...fact, value: Number(fact.value) })),
  }));
  return servedDemographyNumbersPromise;
}

export function resetDemographyCacheForTests(): void {
  servedDemographyPromise = null;
  servedDemographyNumbersPromise = null;
}

async function loadServedDemographyRowsUncached(): Promise<{ facts: DemographyObservation[] }> {
  const mode = resolveServedDataSource();
  let facts = await loadDemographyFacts();
  if (mode === "db") {
    const { loadDemographyFactsFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadDemographyFactsFromDb();
    assertDemographyParity(facts, mirror);
    facts = mirror;
  }
  return { facts };
}
```

- [ ] **Step 7: Register the files and the reset in `servedData.ts`**

In `apps/web/lib/data/servedData.ts`:

1. Add after the `resetRegionalEconomyCacheForTests` import line:
   `import { resetDemographyCacheForTests } from "./demography/importDemography";`
2. In `SERVED_DATA_FILES`, after `regionalEconomyFacts: "../../data/imports/regional-economies-annual.csv",` add:
   ```ts
     demographyPopulationFacts: "../../data/imports/demography-population-annual.csv",
     demographyDensityFacts: "../../data/imports/demography-density-annual.csv",
   ```
3. In `resetServedDataCacheForTests`, after `resetRegionalEconomyCacheForTests();` add `resetDemographyCacheForTests();`
4. After `export { loadServedRegionalEconomyData } from "./regionalEconomies/importRegionalEconomies";` add
   `export { loadServedDemographyData } from "./demography/importDemography";`

In `apps/web/tests/data/servedLoaders.test.ts` add the import `import { loadServedDemographyData, loadServedDemographyRows } from "../../lib/data/demography/importDemography";` and two entries to `loaders`: `demography: loadServedDemographyData,` after `regional:` and `demographyRows: loadServedDemographyRows,` after `regionalRows:`.

- [ ] **Step 8: Run the tests and the typecheck**

Run: `npx vitest run tests/data/demography tests/data/servedLoaders.test.ts tests/data/servedDataParityCoverage.test.ts && npm run typecheck`
Expected: all pass (the existing demography data-stage tests included); typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add lib/data tests/data
git commit -m "feat(demography): serve the population and density CSVs through a parity-checked loader" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The import mirrors demography

**Files:**
- Modify: `apps/web/scripts/import-budget-facts.ts`, `docs/data-methodology/database-import.md`
- Test: `apps/web/tests/data/demography/importIntegration.test.ts`

**Interfaces:**
- Consumes: `loadDemographyFacts`, `assertDemographyParity` (Task 2); `loadDemographyFactsFromMirror` (Task 1); `SERVED_DATA_FILES.demographyPopulationFacts` / `.demographyDensityFacts`.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/data/demography/importIntegration.test.ts`:

```ts
import fs from "node:fs/promises";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from "vitest";

test("demography import verifies its serving mapper before committing", async () => {
  const code = await fs.readFile("scripts/import-budget-facts.ts", "utf8");
  expect(code).toContain("loadDemographyFactsFromMirror(tx)");
  expect(code).toContain("assertDemographyParity(demographyFacts, mirrorDemographyFacts)");
  expect(code.indexOf("tx.demographyFact.deleteMany()")).toBeLessThan(code.indexOf("tx.sourceDocument.deleteMany()"));
  expect(code).toContain('table: "DemographyFact"');
  expect(code).toContain('assertSubset("Demography source IDs"');
});

// Run only against a disposable local database after migrations and data:import.
const connectionString = process.env.GEODATA_TEST_DATABASE_URL;
if (connectionString && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(connectionString).hostname)) {
  throw new Error("Demography migration tests require a disposable local PostgreSQL database");
}

describe.skipIf(!connectionString)("demography mirror integrity", () => {
  let client: Client;
  beforeAll(async () => { client = new Client({ connectionString }); await client.connect(); });
  afterAll(async () => { await client.end(); });
  beforeEach(async () => { await client.query("BEGIN"); });
  afterEach(async () => { await client.query("ROLLBACK"); });

  it("mirrors both served files", async () => {
    const { rows } = await client.query('SELECT "seriesId", count(*)::int AS n FROM "DemographyFact" GROUP BY 1 ORDER BY 1');
    expect(rows).toEqual([
      { seriesId: "demography.population_density", n: 145 },
      { seriesId: "demography.population_total", n: 923 },
    ]);
  });

  it("rejects a source outside the registry", async () => {
    await expect(client.query('UPDATE "DemographyFact" SET "sourceDocumentId" = $1 WHERE "geographyId" = $2 AND year = 2024', ["source.unknown", "country.georgia"]))
      .rejects.toMatchObject({ code: "23503", constraint: "DemographyFact_sourceDocumentId_fkey" });
  });

  it("keeps the table private from both API roles", async () => {
    const relation = 'public."DemographyFact"';
    const grants = await client.query("SELECT role_name, has_table_privilege(role_name, $1, 'SELECT') AS allowed FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name) ORDER BY role_name", [relation]);
    expect(grants.rows).toEqual([{ role_name: "anon", allowed: false }, { role_name: "authenticated", allowed: false }]);
    const rls = await client.query("SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass", [relation]);
    expect(rls.rows).toEqual([{ relrowsecurity: true }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/data/demography/importIntegration.test.ts`
Expected: FAIL on the first test (the script has no demography code); the database block is skipped without `GEODATA_TEST_DATABASE_URL`.

- [ ] **Step 3: Extend the import script**

In `apps/web/scripts/import-budget-facts.ts`:

1. Add to the imports (after the `importRegionalEconomies` import block):
   ```ts
   import {
     assertDemographyParity,
     loadDemographyFacts,
   } from "../lib/data/demography/importDemography";
   ```
   and add `loadDemographyFactsFromMirror,` to the import list from `"../lib/db/mirrorRows"` (after `loadRegionalEconomyFactsFromMirror,`).
2. After the two lines that load and check `regionalEconomyFacts` (`const regionalEconomyFacts = ...` and its `assertSubset`), add:
   ```ts
   const demographyFacts = await loadDemographyFacts([
     SERVED_DATA_FILES.demographyPopulationFacts,
     SERVED_DATA_FILES.demographyDensityFacts,
   ]);
   assertSubset("Demography source IDs", demographyFacts.map((fact) => fact.sourceId), sourceIds);
   ```
3. In the delete block, after `await tx.regionalEconomyFact.deleteMany();` add `await tx.demographyFact.deleteMany();`
4. After `assertRegionalEconomyParity(regionalEconomyFacts, mirrorRegionalEconomyFacts);` add:
   ```ts
        await tx.demographyFact.createMany({
          data: demographyFacts.map(({ sourceId, lastReviewedAt, sex, ageGroup, citizenshipId, settlement, ...fact }) => ({
            ...fact,
            sex: sex ?? "",
            ageGroup: ageGroup ?? "",
            citizenshipId: citizenshipId ?? "",
            settlement: settlement ?? "",
            sourceDocumentId: sourceId,
            lastReviewedAt: new Date(`${lastReviewedAt}T00:00:00.000Z`),
            importRunId: run.id,
          })),
        });
        const mirrorDemographyFacts = await loadDemographyFactsFromMirror(tx);
        assertDemographyParity(demographyFacts, mirrorDemographyFacts);
   ```
5. In the parity report `counts`, after the `RegionalEconomyFact` line add:
   `{ table: "DemographyFact", csvRows: demographyFacts.length, dbRows: mirrorDemographyFacts.length },`

- [ ] **Step 4: Update the import document**

In `docs/data-methodology/database-import.md`:

1. After the `RegionalEconomyFact` table row add:
   ```
   | `DemographyFact` | `data/imports/demography-population-annual.csv` and `data/imports/demography-density-annual.csv` (1 January population 2004–2026 for Georgia, 11 regions and 64 municipalities, 923 rows; density for Georgia and the regions, 145 rows; exact decimals; a dimension a file lacks is stored as an empty string; migration `20261004000000_demography`) |
   ```
2. After the paragraph that begins "The regional economy mirror follows the same rule." add a paragraph: "The demography mirror follows the same rule. The importer validates all 1,068 served rows and their registered source IDs before opening the transaction, replaces `DemographyFact` before source parents, recreates the rows with the active import-run ID, reads them back through the db-mode serving mapper and compares every field and exact decimal before commit. Later demography pages add their canonical files to the served list and rows to this table; the schema does not change."
3. After the bullet for `RegionalEconomyFact` in the list of db-mode readers add: "  - **`DemographyFact`** — read by `loadServedDemographyData` on the demography routes and verified field by field at import and whenever those routes build in db mode."

- [ ] **Step 5: Run the test, the typecheck and lint on the script**

Run: `npx vitest run tests/data/demography/importIntegration.test.ts && npm run typecheck && npx eslint scripts/import-budget-facts.ts lib/data/demography lib/db`
Expected: the text test passes, the database block is skipped, typecheck and lint clean.

- [ ] **Step 6: Prove it against a disposable database, or say it was not run**

If a disposable local Postgres is available (`apps/web/.env` with its `DATABASE_URL`, and `GEODATA_TEST_DATABASE_URL` pointing at the same local server): run `npx prisma migrate deploy`, `npm run data:import`, then `npx vitest run tests/data/demography/importIntegration.test.ts` and `GEODATA_DATA_SOURCE=db npx vitest run tests/data/demography/importDemography.test.ts`. Expected: import report shows `DemographyFact` 1,068 / 1,068 and the database block passes. If none is available, state in the final report that the database path was verified by code, text tests and the typed mapper only, and that the first deploy-time import is its live proof (see `docs/deployment.md`).

- [ ] **Step 7: Commit**

```bash
git add scripts/import-budget-facts.ts ../../docs/data-methodology/database-import.md tests/data/demography/importIntegration.test.ts
git commit -m "feat(demography): import mirrors the served demography rows with parity checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Client rows and persons formats

**Files:**
- Modify: `apps/web/lib/servedRows.ts`, `apps/web/lib/explorer/clientData.ts`, `apps/web/lib/explorer/format.ts`, `apps/web/lib/i18n/messages/ka/format.json`, `apps/web/lib/i18n/messages/en/format.json`
- Test: `apps/web/tests/explorer/demographyClientData.test.ts`

**Interfaces:**
- Produces: `ClientDemographyObservation = { geographyId: string; seriesId: string; year: number; value: number }` (`servedRows.ts`); `projectDemographyObservation(fact: ServedDemographyObservation): ClientDemographyObservation` (`clientData.ts`); `UNIT_PERSONS`, `UNIT_DENSITY: ValueUnit`; `thousandsUnit(locale: Locale): ValueUnit` (`format.ts`).

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/demographyClientData.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { formatInUnit, thousandsUnit, UNIT_DENSITY, UNIT_PERSONS } from "../../lib/explorer/format";

describe("demography client rows", () => {
  it("keeps only the fields the browser reads", async () => {
    const { facts } = await loadServedDemographyData();
    expect(Object.keys(projectDemographyObservation(facts[0]!)).sort()).toEqual([
      "geographyId", "seriesId", "value", "year",
    ]);
  });
});

describe("persons formats", () => {
  it("prints whole persons in full and density at one decimal", () => {
    expect(formatInUnit(3_694_608, UNIT_PERSONS)).toBe("3,694,608");
    expect(formatInUnit(2495.9, UNIT_DENSITY)).toBe("2,495.9");
    expect(formatInUnit(5.7, UNIT_DENSITY)).toBe("5.7");
    expect(formatInUnit(65, UNIT_DENSITY)).toBe("65.0");
    expect(formatInUnit(null, UNIT_PERSONS)).toBe("—");
  });

  it("labels the thousands axis unit in both languages", () => {
    expect(thousandsUnit("ka")).toEqual({ divisor: 1000, decimals: 1, label: "ათ." });
    expect(thousandsUnit("en")).toEqual({ divisor: 1000, decimals: 1, label: "k" });
    expect(formatInUnit(3_694_608, thousandsUnit("en"))).toBe("3,694.6");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/demographyClientData.test.ts`
Expected: FAIL (`projectDemographyObservation` and `thousandsUnit` are not exported).

- [ ] **Step 3: Add the client type and the projection**

Append to `apps/web/lib/servedRows.ts`:

```ts
/** A demography observation as the browser receives it: no locator, review date or basis code. */
export type ClientDemographyObservation = {
  geographyId: string;
  seriesId: string;
  year: number;
  value: number;
};
```

In `apps/web/lib/explorer/clientData.ts` add `ClientDemographyObservation,` to the first `import type { ... } from "../servedRows"` list (alphabetically before `ClientGdpObservation`), add `import type { ServedDemographyObservation } from "../data/demography/types";` below the `ServedRegionalEconomyObservation` import, and add after `projectRegionalObservation`:

```ts
export function projectDemographyObservation(
  fact: ServedDemographyObservation,
): ClientDemographyObservation {
  return {
    geographyId: fact.geographyId,
    seriesId: fact.seriesId,
    year: fact.year,
    value: fact.value,
  };
}
```

- [ ] **Step 4: Add the persons units**

In `apps/web/lib/explorer/format.ts`, after `export const UNIT_MLN ...` add:

```ts
/** Population: whole persons in cells, tooltips and Excel; density at the one decimal Geostat publishes. */
export const UNIT_PERSONS: ValueUnit = { divisor: 1, label: "", decimals: 0 };
export const UNIT_DENSITY: ValueUnit = { divisor: 1, label: "", decimals: 1 };

/**
 * The chart-axis unit for persons: thousands, labelled in the page language. One decimal keeps the
 * axis quantum at 100 persons, so a small municipality still gets round gridlines.
 */
export function thousandsUnit(locale: Locale): ValueUnit {
  return { divisor: 1_000, label: formatMessages[locale]["format.thousands"], decimals: 1 };
}
```

(`unitsFor` is left alone: `tests/i18n/format.test.ts` pins its exact shape.)

Add `"format.thousands": "ათ."` to `apps/web/lib/i18n/messages/ka/format.json` and `"format.thousands": "k"` to `apps/web/lib/i18n/messages/en/format.json`, after the `format.mln` line in each.

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npx vitest run tests/explorer/demographyClientData.test.ts tests/i18n/format.test.ts tests/data/demography/importDemography.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib tests/explorer/demographyClientData.test.ts
git commit -m "feat(demography): client row projection and persons units" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The census re-base on the line chart and the table

**Files:**
- Modify: `apps/web/components/main-explorer/editorial-line-chart.tsx`, `apps/web/components/main-explorer/explorer-table.tsx`
- Test: `apps/web/tests/explorer/censusBreak.test.ts`

**Interfaces:**
- Produces: `EditorialLineChart` prop `breaks?: ReadonlyArray<{ year: number; label: string }>`; `ExplorerTable` props `breakYears?: number[]` and `breakLabel?: string`. Both default to today's output. The line chart splits a line at a break year exactly where it already splits at a data gap, and draws `data-testid="chart-break"`; the table draws a 2px ink rule left of each break year's column and prints `breakLabel` on that year's header.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/explorer/censusBreak.test.ts`:

```ts
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { EditorialLineChart } from "../../components/main-explorer/editorial-line-chart";
import { ExplorerTable } from "../../components/main-explorer/explorer-table";
import { UNIT_PERSONS } from "../../lib/explorer/format";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const COLOR = "#B3402A";
const chart = (years: number[], vals: (number | null)[], breaks?: Array<{ year: number; label: string }>) =>
  renderGeorgianMarkup(createElement(EditorialLineChart, {
    years,
    series: [{ id: "s", label: "S", color: COLOR, vals, planned: vals.map(() => false) }],
    share: false,
    unit: { divisor: 1_000, label: "k", decimals: 0 },
    shareLabel: "%",
    ...(breaks ? { breaks } : {}),
  }));
const pathOf = (html: string) => new RegExp(`<path d="([^"]+)" fill="none" stroke="${COLOR}"`).exec(html)![1]!;
const count = (text: string, token: RegExp) => (text.match(token) ?? []).length;

describe("EditorialLineChart break", () => {
  const years = [2023, 2024, 2025, 2026];
  const vals = [100, 200, 500, 600];

  it("joins every year when no break is given", () => {
    const html = chart(years, vals);
    expect(count(pathOf(html), /M/g)).toBe(1);
    expect(html).not.toContain('data-testid="chart-break"');
  });

  it("never joins the year before a break to the break year", () => {
    const html = chart(years, vals, [{ year: 2025, label: "Census re-base" }]);
    expect(count(pathOf(html), /M/g)).toBe(2);
    expect(count(pathOf(html), /L/g)).toBe(2);
  });

  it("marks the gap with one labelled dashed rule", () => {
    const html = chart(years, vals, [{ year: 2025, label: "Census re-base" }]);
    expect(count(html, /data-testid="chart-break"/g)).toBe(1);
    expect(html).toContain("Census re-base");
    expect(html).toMatch(/data-testid="chart-break"[^]*?stroke-dasharray="4 3"/);
  });

  it("draws nothing for a break the range does not separate", () => {
    for (const range of [[2025, 2026], [2023, 2024]]) {
      const html = chart(range, [1, 2], [{ year: 2025, label: "Census re-base" }]);
      expect(html).not.toContain('data-testid="chart-break"');
      expect(count(pathOf(html), /M/g)).toBe(1);
    }
  });

  it("leaves a series with a gap at the break to the existing gap rule", () => {
    const html = chart(years, [100, 200, null, 600], [{ year: 2025, label: "Census re-base" }]);
    expect(count(pathOf(html), /M/g)).toBe(1);
  });
});

describe("ExplorerTable break", () => {
  const row = { itemId: "country.georgia", kaLabel: "Georgia", color: "#1E1B16", valuesByYear: { 2024: 3_694_608, 2025: 3_930_428 } };
  const table = (extra: { breakYears?: number[]; breakLabel?: string } = {}) =>
    renderGeorgianMarkup(createElement(ExplorerTable, {
      caption: "Population",
      rows: [],
      totalRow: row,
      showTotal: true,
      totalFirst: true,
      years: [2024, 2025],
      firstColumnLabel: "Place",
      unit: UNIT_PERSONS,
      share: false,
      showChangeColumn: false,
      rowLabelsLocalized: true,
      shareValueForYear: () => null,
      ...extra,
    }));

  it("is unchanged when no break year is given", () => {
    expect(table()).not.toContain("border-left");
    expect(table()).toContain("3,694,608");
  });

  it("draws a 2px rule left of the break year on the header and the cells, and labels the header", () => {
    const html = table({ breakYears: [2025], breakLabel: "Census re-base" });
    expect(count(html, /border-left:2px solid var\(--ink\)/g)).toBe(2);
    expect(count(html, /Census re-base/g)).toBe(1);
  });

  it("ignores a break year that is the first column", () => {
    expect(table({ breakYears: [2024], breakLabel: "Census re-base" })).not.toContain("border-left");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/explorer/censusBreak.test.ts`
Expected: FAIL (the break cases find one `M`, no `chart-break`, no `border-left`).

- [ ] **Step 3: Add `breaks` to the line chart**

In `apps/web/components/main-explorer/editorial-line-chart.tsx`:

1. Add to `EditorialLineChartProps` (after `formatPeriod`):
   ```ts
     /** Annual charts only. No line joins the year before one of these years to it; a dashed rule and the short label mark the gap. */
     breaks?: ReadonlyArray<{ year: number; label: string }>;
   ```
2. Add `breaks,` to the destructured parameters (after `formatTooltipValue,`).
3. After `const labelIndices = new Set(periodLabelIndices(years, periodsPerYear));` add:
   ```ts
     // A break needs the year before it on the axis too; a range that starts at the break year has nothing to separate.
     const breakMarks = (breaks ?? [])
       .map((entry) => ({ ...entry, index: years.indexOf(entry.year) }))
       .filter((entry) => entry.index > 0);
     const breakIndices = new Set(breakMarks.map((entry) => entry.index));
   ```
4. In the segment loop, replace
   ```ts
               } else {
                 run.push([x(index), y(value), index]);
               }
   ```
   with
   ```ts
               } else {
                 if (breakIndices.has(index) && run.length > 0) {
                   segments.push(run);
                   run = [];
                 }
                 run.push([x(index), y(value), index]);
               }
   ```
5. Directly before `{series.map((line) => {` add the mark (series paint over it):
   ```tsx
           {breakMarks.map((entry) => {
             const bx = (x(entry.index - 1) + x(entry.index)) / 2;
             const toTheLeft = bx > W / 2;
             return (
               <g key={`break-${entry.year}`} data-testid="chart-break">
                 <line x1={bx} x2={bx} y1={PAD_T} y2={H - PAD_B} stroke={CHART_AXIS_LABEL} strokeWidth={1} strokeDasharray="4 3" />
                 <text x={toTheLeft ? bx - 5 : bx + 5} y={PAD_T + 10} fontSize={11} fill={CHART_AXIS_LABEL} textAnchor={toTheLeft ? "end" : "start"} style={{ fontFamily: "var(--font-numeric)" }}>
                   {entry.label}
                 </text>
               </g>
             );
           })}
   ```

- [ ] **Step 4: Add `breakYears` to the table**

In `apps/web/components/main-explorer/explorer-table.tsx`:

1. Add to `ExplorerTableProps` (after `preliminaryLabel?: string;`):
   ```ts
     /** Years re-based by the publisher: a 2px rule is drawn left of the column and `breakLabel` is printed on its header. */
     breakYears?: number[];
     breakLabel?: string;
   ```
2. Add `breakYears,` and `breakLabel,` to the destructured parameters (after `preliminaryLabel,`).
3. After `const lastIndex = years.length - 1;` add:
   ```ts
     const breakSet = new Set((breakYears ?? []).filter((year) => years.indexOf(year) > 0));
     const breakStyle = (year: number) => (breakSet.has(year) ? { borderLeft: "2px solid var(--ink)" } : undefined);
   ```
4. Header: change the year header cell to
   ```tsx
               <th key={year} style={breakStyle(year)} className={`${headCellClass} font-[family-name:var(--font-numeric)] tracking-[0.04em]`}>
                 {year}
                 {breakLabel && breakSet.has(year) ? <sup className="ml-1 text-[9px] font-medium normal-case tracking-normal text-[var(--faint)]">{breakLabel}</sup> : null}
               </th>
   ```
5. Total-row year cells: change `style={cellPad}` to `style={{ ...cellPad, ...breakStyle(year) }}` on the `<td key={year} className={`${numericCellClass} font-semibold text-[var(--ink)]`}` cell.
6. Body year cells: in the `style={{ ...cellPad, fontWeight: ..., color: ... }}` object add `...breakStyle(year),` after `...cellPad,`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/explorer/censusBreak.test.ts tests/explorer/editorialLineChart.test.ts tests/explorer/debtTable.test.ts tests/explorer/sectorTooltip.test.tsx`
Expected: all pass; the existing chart and table tests are untouched and green.

- [ ] **Step 6: Commit**

```bash
git add components/main-explorer tests/explorer/censusBreak.test.ts
git commit -m "feat(explorer): optional census re-base break on the line chart and table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: The region map can choose and can plot any value

**Files:**
- Modify: `apps/web/lib/explorer/regionalEconomyMap.ts`, `apps/web/components/regional-economies/regional-economy-map.tsx`
- Test: `apps/web/tests/explorer/regionValueMap.test.tsx` (the existing `regionalEconomyMap.test.ts` and `regionalEconomiesIndex.test.tsx` stay untouched and must stay green)

**Interfaces:**
- Produces: `buildRegionValueMapModel({ values: ReadonlyMap<string, number>; regions: readonly MunicipalRegion[]; year: number; display: (regionId: string, value: number) => string }): RegionalEconomyMapModel` (the plotted value is in each region's existing `totalGdpGel` field, its printed text in the new optional `display`); `RegionalEconomyMap` props `onSelect?: (regionId: string) => void`, `selectedIds?: readonly string[]`, `wording?: { groupAria: string; legendMin: string; legendMax: string; legendCaption: string }`. With all three omitted the component renders exactly as before.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/explorer/regionValueMap.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import { RegionalEconomyMap } from "../../components/regional-economies/regional-economy-map";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildRegionValueMapModel, type RegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";

let regions: MunicipalRegion[];
let values: Map<string, number>;
let model: RegionalEconomyMapModel;
let presentation: Presentation;
const display = (_regionId: string, value: number) => `${value} persons`;

beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  regions = municipal.regions;
  values = new Map(
    facts
      .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.year === 2026 && fact.geographyId.startsWith("region."))
      .map((fact) => [fact.geographyId, fact.value]),
  );
  model = buildRegionValueMapModel({ values, regions, year: 2026, display });
  presentation = await getPresentation("en", ["regionalEconomies"], regions.map((region) => region.id));
});

describe("buildRegionValueMapModel", () => {
  test("ranks the eleven regions by the plotted value and keeps the page's own text", () => {
    expect(model.year).toBe(2026);
    expect(model.regions).toHaveLength(11);
    expect(model.regions[0]).toMatchObject({ regionId: "region.tbilisi", totalGdpGel: 1_369_356, rank: 1, display: "1369356 persons" });
    expect(model.regions.every((region) => region.pathD.length > 0 && region.bucket >= 0 && region.bucket <= 5)).toBe(true);
    expect(model.occupiedAreas).toHaveLength(2);
    expect(model.legendMinGel).toBe(Math.min(...values.values()));
    expect(model.legendMaxGel).toBe(Math.max(...values.values()));
  });

  test("rejects a missing, unknown or non-positive value", () => {
    const without = new Map([...values].filter(([id]) => id !== "region.guria"));
    expect(() => buildRegionValueMapModel({ values: without, regions, year: 2026, display })).toThrow(/Missing map value for region\.guria/);
    expect(() => buildRegionValueMapModel({ values: new Map([...values, ["region.mars", 5]]), regions, year: 2026, display })).toThrow(/unknown region region\.mars/);
    expect(() => buildRegionValueMapModel({ values: new Map([...values, ["region.guria", 0]]), regions, year: 2026, display })).toThrow(/Invalid map value for region\.guria/);
  });
});

describe("RegionalEconomyMap choosing mode", () => {
  const render = (props: Partial<Parameters<typeof RegionalEconomyMap>[0]> = {}) =>
    renderToStaticMarkup(
      <I18nProvider {...presentation}>
        <RegionalEconomyMap model={model} activeRegionId={null} onActiveRegionChange={() => {}} {...props} />
      </I18nProvider>,
    );
  const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;

  test("makes every region a button, outlines the chosen ones and uses the page's wording", () => {
    const html = render({
      onSelect: () => {},
      selectedIds: ["region.imereti"],
      wording: { groupAria: "Population map", legendMin: "min text", legendMax: "max text", legendCaption: "persons, 1 January 2026" },
    });
    expect(count(html, /data-region-map-target=""/g)).toBe(11);
    expect(count(html, /role="button"/g)).toBe(11);
    expect(html).not.toContain("/explorer/economy/regions/");
    expect(count(html, /aria-pressed="true"/g)).toBe(1);
    expect(count(html, /data-testid="regional-map-chosen"/g)).toBe(1);
    expect(html).toContain('aria-label="Population map"');
    expect(html).toContain("min text");
    expect(html).toContain("max text");
    expect(html).toContain("persons, 1 January 2026");
    expect(html).toContain('aria-label="Imereti, ');
    expect(html).not.toContain("Regional GDP");
  });

  test("without the new props it is still eleven links to the region pages", () => {
    const html = render();
    expect(count(html, /href="\/en\/explorer\/economy\/regions\//g)).toBe(11);
    expect(html).toContain('href="/en/explorer/economy/regions/imereti"');
    expect(count(html, /role="button"/g)).toBe(0);
    expect(count(html, /aria-pressed/g)).toBe(0);
    expect(count(html, /data-testid="regional-map-chosen"/g)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/explorer/regionValueMap.test.tsx`
Expected: FAIL (`buildRegionValueMapModel` is not exported).

- [ ] **Step 3: Share the map assembly and add the value builder**

In `apps/web/lib/explorer/regionalEconomyMap.ts`, keep everything above `export type RegionalEconomyMapRegion` unchanged and replace everything from that line to the end of the file with:

```ts
export type RegionalEconomyMapRegion = {
  regionId: string;
  nameKa: string;
  slug: string;
  totalGdpGel: number;
  rank: number;
  bucket: number;
  pathD: string;
  /** What a page that plots something other than GDP prints for this region in the label and tooltip. */
  display?: string;
};

export type RegionalEconomyMapModel = {
  viewBox: string;
  firstYear: number;
  year: number;
  regions: RegionalEconomyMapRegion[];
  occupiedAreas: Array<{ key: "abkhazia" | "tskhinvali"; pathD: string }>;
  legendMinGel: number;
  legendMaxGel: number;
};

function quantileBucket(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const breaks = [1, 2, 3, 4, 5].map((index) => sorted[Math.floor((index / 6) * sorted.length)]!);
  return (value: number) => {
    let bucket = 0;
    while (bucket < breaks.length && value >= breaks[bucket]!) bucket += 1;
    return bucket;
  };
}

/** Joins one value per region to its outline, rank and equal-count bucket; every region map is built here. */
function assembleRegionMapModel({
  latestByRegion,
  regions,
  firstYear,
  year,
  displayFor,
}: {
  latestByRegion: ReadonlyMap<string, number>;
  regions: readonly MunicipalRegion[];
  firstYear: number;
  year: number;
  displayFor?: (regionId: string, value: number) => string;
}): RegionalEconomyMapModel {
  const project = createProjection();
  const pathByRegion = new Map<string, string>();
  for (const geoRegion of GEORGIA_GEO.regions) {
    const regionId = GEO_ISO_TO_REGION_ID[geoRegion.iso as keyof typeof GEO_ISO_TO_REGION_ID];
    if (regionId) pathByRegion.set(regionId, ringPath(geoRegion.ring, project));
  }

  const regionRows = regions.map((region) => {
    const totalGdpGel = latestByRegion.get(region.id);
    if (totalGdpGel === undefined) throw new Error(`Missing latest Regional GDP for ${region.id}`);
    return {
      regionId: region.id,
      nameKa: region.kaLabel,
      slug: region.id.slice("region.".length),
      totalGdpGel,
      sortOrder: region.sortOrder,
    };
  });
  if (latestByRegion.size !== regions.length) throw new Error("Regional GDP contains an unknown latest-year region");
  const bucketOf = quantileBucket(regionRows.map((region) => region.totalGdpGel));
  const ranked = [...regionRows]
    .sort((left, right) => right.totalGdpGel - left.totalGdpGel || left.sortOrder - right.sortOrder)
    .map((region, index): RegionalEconomyMapRegion => {
      const pathD = pathByRegion.get(region.regionId);
      if (!pathD) throw new Error(`Missing regional map geometry for ${region.regionId}`);
      return {
        regionId: region.regionId,
        nameKa: region.nameKa,
        slug: region.slug,
        totalGdpGel: region.totalGdpGel,
        rank: index + 1,
        bucket: bucketOf(region.totalGdpGel),
        pathD,
        ...(displayFor ? { display: displayFor(region.regionId, region.totalGdpGel) } : {}),
      };
    });
  if (pathByRegion.size !== regions.length) throw new Error("Regional map geometry contains an unknown region");

  return {
    viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
    firstYear,
    year,
    regions: ranked,
    occupiedAreas: occupiedFeatures.map((feature) => ({
      key: feature.properties.key,
      pathD: occupiedPath(feature, project),
    })),
    legendMinGel: Math.min(...regionRows.map((region) => region.totalGdpGel)),
    legendMaxGel: Math.max(...regionRows.map((region) => region.totalGdpGel)),
  };
}

export function buildRegionalEconomyMapModel({
  facts,
  regions,
}: {
  facts: readonly ClientRegionalEconomyObservation[];
  regions: readonly MunicipalRegion[];
}): RegionalEconomyMapModel {
  const totalFacts = facts.filter((fact) => fact.seriesId === REGIONAL_GDP_TOTAL && fact.measure === "nominal");
  if (totalFacts.length === 0) throw new Error("Regional GDP totals are missing");
  const firstYear = Math.min(...totalFacts.map((fact) => fact.year));
  const year = Math.max(...totalFacts.map((fact) => fact.year));
  const latest = totalFacts.filter((fact) => fact.year === year);
  const latestByRegion = new Map<string, number>();
  for (const fact of latest) {
    if (latestByRegion.has(fact.regionId)) throw new Error(`Duplicate latest Regional GDP for ${fact.regionId}`);
    if (!Number.isFinite(fact.value) || fact.value <= 0) throw new Error(`Invalid latest Regional GDP for ${fact.regionId}`);
    latestByRegion.set(fact.regionId, fact.value);
  }
  return assembleRegionMapModel({ latestByRegion, regions, firstYear, year });
}

/**
 * A region map of any one positive value per region (population, density). The number goes in the
 * existing numeric field and `display` is the text the page prints in the label and tooltip.
 */
export function buildRegionValueMapModel({
  values,
  regions,
  year,
  display,
}: {
  values: ReadonlyMap<string, number>;
  regions: readonly MunicipalRegion[];
  year: number;
  display: (regionId: string, value: number) => string;
}): RegionalEconomyMapModel {
  for (const [regionId, value] of values) {
    if (!regions.some((region) => region.id === regionId)) throw new Error(`Map values contain an unknown region ${regionId}`);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid map value for ${regionId}`);
  }
  for (const region of regions) {
    if (!values.has(region.id)) throw new Error(`Missing map value for ${region.id}`);
  }
  return assembleRegionMapModel({ latestByRegion: values, regions, firstYear: year, year, displayFor: display });
}
```

- [ ] **Step 4: Let the component choose and use the page's wording**

Replace `apps/web/components/regional-economies/regional-economy-map.tsx` with (the changes are `onSelect`, `selectedIds`, `wording`, `display`, the chosen outline layer and the keys; every default path renders as before):

```tsx
"use client";

import { useMemo, useState } from "react";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import type { RegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";
import { regionalEconomyHref } from "../../lib/explorer/regionalEconomyRoutes";
import { formatAmount } from "../../lib/explorer/format";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { pageHref } from "../../lib/i18n/routes";

const HATCH_ID = "regional-economy-map-no-data-hatch";

type Props = {
  model: RegionalEconomyMapModel;
  activeRegionId: string | null;
  onActiveRegionChange: (regionId: string | null) => void;
  /** Choosing mode, for pages that pick regions: each region becomes a button that calls this instead of a link to its page. */
  onSelect?: (regionId: string) => void;
  /** Regions outlined as chosen (choosing mode). */
  selectedIds?: readonly string[];
  /** Replaces the built-in GEL wording; each region's own value text is `display` on the model. */
  wording?: { groupAria: string; legendMin: string; legendMax: string; legendCaption: string };
};

export function RegionalEconomyMap({ model, activeRegionId, onActiveRegionChange, onSelect, selectedIds, wording }: Props) {
  const { locale, messages, englishLabels } = useI18n();
  const [rovingIndex, setRovingIndex] = useState(0);
  const byRegion = useMemo(() => new Map(model.regions.map((region) => [region.regionId, region])), [model.regions]);
  const chosen = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const active = activeRegionId ? byRegion.get(activeRegionId) ?? null : null;
  const move = (index: number, key: string) => {
    if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % model.regions.length;
    if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + model.regions.length) % model.regions.length;
    if (key === "Home") return 0;
    if (key === "End") return model.regions.length - 1;
    return null;
  };

  return (
    <div data-testid="regional-economy-map">
      <svg
        viewBox={model.viewBox}
        role="group"
        aria-label={wording?.groupAria ?? message(messages, "regionalEconomies.mapAria", { year: model.year })}
        className="block h-auto w-full"
      >
        <defs>
          <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
            <rect width="7" height="7" fill={MAP_NO_DATA_FILL} />
            <path d="M 0 0 V 7" stroke={MAP_NO_DATA_STROKE} strokeWidth="1.2" />
          </pattern>
        </defs>
        {model.regions.map((region, index) => {
          const selected = region.regionId === activeRegionId;
          const name = publicLabel(locale, region.regionId, region.nameKa, englishLabels);
          return (
            <a
              key={region.regionId}
              {...(onSelect
                ? { role: "button", "aria-pressed": chosen.has(region.regionId) }
                : { href: pageHref(regionalEconomyHref(region.regionId), locale) })}
              data-region-map-target=""
              data-region-id={region.regionId}
              data-active={selected ? "true" : undefined}
              tabIndex={index === rovingIndex ? 0 : -1}
              aria-label={
                region.display !== undefined
                  ? `${name}, ${region.display}`
                  : message(messages, "regionalEconomies.mapEntityAria", {
                      name,
                      amount: formatAmount(region.totalGdpGel, locale),
                      year: model.year,
                    })
              }
              onClick={onSelect ? () => onSelect(region.regionId) : undefined}
              onMouseEnter={() => onActiveRegionChange(region.regionId)}
              onMouseLeave={() => onActiveRegionChange(null)}
              onFocus={() => { setRovingIndex(index); onActiveRegionChange(region.regionId); }}
              onBlur={() => onActiveRegionChange(null)}
              onKeyDown={(event) => {
                if (onSelect && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelect(region.regionId);
                  return;
                }
                const next = move(index, event.key);
                if (next === null) return;
                event.preventDefault();
                setRovingIndex(next);
                event.currentTarget.parentElement
                  ?.querySelectorAll<SVGAElement>("[data-region-map-target]")[next]?.focus();
              }}
            >
              <path
                data-testid="regional-map-path"
                d={region.pathD}
                fill={MAP_RAMP[region.bucket]}
                fillRule="evenodd"
                clipRule="evenodd"
                stroke={selected ? "var(--ink)" : "var(--hairline-soft)"}
                strokeWidth={selected ? 2.2 : 0.7}
                strokeLinejoin="round"
              />
            </a>
          );
        })}
        {onSelect
          ? model.regions.filter((region) => chosen.has(region.regionId)).map((region) => (
              <path
                key={`chosen-${region.regionId}`}
                data-testid="regional-map-chosen"
                d={region.pathD}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={2.4}
                strokeLinejoin="round"
                pointerEvents="none"
                aria-hidden="true"
              />
            ))
          : null}
        {model.occupiedAreas.map((area) => (
          <path
            key={area.key}
            data-occupied-overlay=""
            d={area.pathD}
            fill={`url(#${HATCH_ID})`}
            fillRule="evenodd"
            clipRule="evenodd"
            stroke={MAP_NO_DATA_STROKE}
            strokeWidth="1.5"
            strokeDasharray="5 4"
            strokeLinejoin="round"
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}
      </svg>
      {active ? (
        <div role="tooltip" data-testid="regional-map-tooltip" className="mt-2 flex items-baseline justify-between gap-3 border border-[var(--hairline)] bg-[var(--tile)] px-3 py-2 text-[12px]">
          <span>{publicLabel(locale, active.regionId, active.nameKa, englishLabels)}</span>
          <span className="font-[family-name:var(--font-numeric)]">{active.display ?? <>{formatAmount(active.totalGdpGel, locale)} · {model.year}</>}</span>
        </div>
      ) : null}
      <div data-testid="regional-map-legend" className="mt-2 flex flex-wrap items-center gap-3.5 border-t border-[var(--hairline-soft)] pt-2.5">
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{wording?.legendMin ?? formatAmount(model.legendMinGel, locale)}</span>
        <span className="flex flex-none">{MAP_RAMP.map((fill) => <span key={fill} aria-hidden className="h-[9px] w-8" style={{ backgroundColor: fill }} />)}</span>
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{wording?.legendMax ?? formatAmount(model.legendMaxGel, locale)}</span>
        <span className="text-[10px] text-[var(--faint)]">{wording?.legendCaption ?? message(messages, "regionalEconomies.legend")}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npx vitest run tests/explorer/regionValueMap.test.tsx tests/explorer/regionalEconomyMap.test.ts tests/explorer/regionalEconomiesIndex.test.tsx tests/explorer/regionalEconomyPicker.test.tsx && npm run typecheck`
Expected: all pass; the existing region map tests pass unmodified.

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/regionalEconomyMap.ts components/regional-economies/regional-economy-map.tsx tests/explorer/regionValueMap.test.tsx
git commit -m "feat(explorer): region map can choose regions and plot any value" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The municipality map can choose and can plot any value

**Files:**
- Modify: `apps/web/lib/explorer/municipalityMapData.ts`, `apps/web/components/municipalities/municipality-map.tsx`
- Test: `apps/web/tests/explorer/municipalityValueMap.test.tsx` (the existing `municipalityMapData.test.ts` stays untouched and green)

**Interfaces:**
- Produces: `buildMunicipalityValueMapModel({ municipalities: Municipality[]; values: ReadonlyMap<string, number>; display: (code: string, value: number) => string }): MunicipalityMapModel` (the plotted value is in the existing `budgetPerResidentGel` and `totalBudgetGel` fields; `display` is the new optional printed text on every shape and marker); `MunicipalityMap` props `selectedCodes?: readonly string[]` and `wording?: { groupAria: string; legendCaption: string }`. With both omitted the component renders as before. In choosing mode every target is `role="button"` with `aria-pressed`, chosen shapes get an outline layer and chosen markers a thicker ink ring; the existing `onOpenMunicipality` is the select callback.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/explorer/municipalityValueMap.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));

import { MunicipalityMap } from "../../components/municipalities/municipality-map";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import type { Municipality } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "../../lib/explorer/municipalityMapData";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";

let municipalities: Municipality[];
let values: Map<string, number>;
let model: MunicipalityMapModel;
let presentation: Presentation;
const display = (_code: string, value: number) => `${value} persons`;
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;

beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  municipalities = municipal.municipalities;
  values = new Map(
    facts
      .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.year === 2026 && /^\d{2}$/.test(fact.geographyId))
      .map((fact) => [fact.geographyId, fact.value]),
  );
  model = buildMunicipalityValueMapModel({ municipalities, values, display });
  presentation = await getPresentation("en", ["municipal"], municipalities.map((municipality) => municipality.code));
});

describe("buildMunicipalityValueMapModel", () => {
  test("joins every polygon and marker to its value and text", () => {
    expect(model.shapes).toHaveLength(60);
    expect(model.markers).toHaveLength(5);
    // 2026 values: Khulo is 16,098 on 1 January 2026 (16,307 is its 2025 figure).
    expect(model.shapes.find((shape) => shape.code === "11")).toMatchObject({ budgetPerResidentGel: 16_098, display: "16098 persons" });
    expect(model.markers.find((marker) => marker.code === "04")).toMatchObject({ budgetPerResidentGel: 1_369_356, display: "1369356 persons" });
    expect(model.shapes.every((shape) => shape.bucket >= 0 && shape.bucket <= 5 && shape.display !== undefined)).toBe(true);
    const polygonValues = model.shapes.map((shape) => shape.budgetPerResidentGel);
    expect(model.legendMinPerResidentGel).toBe(Math.min(...polygonValues));
    expect(model.legendMaxPerResidentGel).toBe(Math.max(...polygonValues));
  });

  test("rejects a missing, unknown or non-positive value", () => {
    const without = new Map([...values].filter(([code]) => code !== "33"));
    expect(() => buildMunicipalityValueMapModel({ municipalities, values: without, display })).toThrow(/Missing map value for municipality 33/);
    expect(() => buildMunicipalityValueMapModel({ municipalities, values: new Map([...values, ["99", 5]]), display })).toThrow(/Unknown municipality value code 99/);
    expect(() => buildMunicipalityValueMapModel({ municipalities, values: new Map([...values, ["33", 0]]), display })).toThrow(/Invalid map value for municipality 33/);
  });
});

describe("MunicipalityMap choosing mode", () => {
  const render = (props: Partial<Parameters<typeof MunicipalityMap>[0]> = {}, withText = true) =>
    renderToStaticMarkup(
      <I18nProvider {...presentation}>
        <MunicipalityMap
          viewBox={model.viewBox}
          shapes={withText ? model.shapes : model.shapes.map(({ display: _display, ...shape }) => shape)}
          markers={withText ? model.markers : model.markers.map(({ display: _display, ...marker }) => marker)}
          occupiedAreas={model.occupiedAreas}
          legendMin="min text"
          legendMax="max text"
          activeCode={null}
          onActiveCodeChange={() => {}}
          onOpenMunicipality={() => {}}
          {...props}
        />
      </I18nProvider>,
    );

  test("makes all 64 targets buttons, outlines the chosen places and uses the page's wording", () => {
    const html = render({ selectedCodes: ["04", "11"], wording: { groupAria: "Population map", legendCaption: "persons, 1 January 2026" } });
    expect(count(html, /data-municipality-map-target=""/g)).toBe(64);
    expect(count(html, /role="button"/g)).toBe(64);
    expect(count(html, /role="link"/g)).toBe(0);
    expect(count(html, /aria-pressed="true"/g)).toBe(2);
    expect(html).toContain('data-testid="municipality-chosen-04"');
    expect(html).toContain('data-testid="municipality-chosen-11"');
    expect(html).toContain('aria-label="Population map"');
    expect(html).toContain("persons, 1 January 2026");
    expect(html).toContain("Khulo, 16098 persons");
    expect(html).not.toContain("per resident");
  });

  test("without the new props it is the budget map's links and wording", () => {
    const html = render({}, false);
    expect(count(html, /role="link"/g)).toBe(64);
    expect(count(html, /role="button"/g)).toBe(0);
    expect(count(html, /aria-pressed/g)).toBe(0);
    expect(count(html, /municipality-chosen-/g)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/explorer/municipalityValueMap.test.tsx`
Expected: FAIL (`buildMunicipalityValueMapModel` is not exported).

- [ ] **Step 3: Share the assembly and add the value builder**

In `apps/web/lib/explorer/municipalityMapData.ts`:

1. Add `display?: string;` (with the comment `/** What a page that plots something other than the budget prints for this place in the label and tooltip. */`) as the last field of both `MunicipalityMapShape` and `MunicipalityMapMarker`.
2. Keep everything through `quantileBucket` unchanged, and replace everything from `export function buildMunicipalityMapModel({` to the end of the file with:

```ts
type MapValue = { totalBudgetGel: number; budgetPerResidentGel: number; display?: string };

function registryNames(municipalities: readonly Municipality[]): Map<string, string> {
  const namesByCode = new Map<string, string>();
  for (const municipality of municipalities) {
    if (namesByCode.has(municipality.code)) throw new Error(`Duplicate municipality registry code ${municipality.code}`);
    namesByCode.set(municipality.code, municipality.displayNameKa);
  }
  return namesByCode;
}

const displayOf = (value: MapValue) => (value.display === undefined ? {} : { display: value.display });

/** Joins one value per municipality to its shape or marker and equal-count bucket; every municipality map is built here. */
function assembleMunicipalityMapModel(
  namesByCode: ReadonlyMap<string, string>,
  valuesByCode: ReadonlyMap<string, MapValue>,
): MunicipalityMapModel {
  const mapCodes = new Set([
    ...MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) => shape.code),
    ...MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => marker.code),
  ]);
  for (const code of namesByCode.keys()) {
    if (!mapCodes.has(code)) throw new Error(`Municipality registry code ${code} has no map geometry`);
    if (!valuesByCode.has(code)) throw new Error(`Missing latest-year official total for municipality ${code}`);
  }

  const valueFor = (code: string): MapValue => {
    const value = valuesByCode.get(code);
    if (value === undefined) throw new Error(`Missing latest-year official total for municipality ${code}`);
    return value;
  };
  const nameFor = (code: string): string => {
    const name = namesByCode.get(code);
    if (name === undefined) throw new Error(`Municipality map code ${code} is not in the registry`);
    return name;
  };

  const polygonValues = MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map(
    (shape) => valueFor(shape.code).budgetPerResidentGel,
  );
  const bucketOf = quantileBucket(polygonValues);

  return {
    viewBox: MUNICIPALITY_MAP_ARTIFACT.viewBox,
    shapes: MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) => ({
      code: shape.code,
      nameKa: nameFor(shape.code),
      totalBudgetGel: valueFor(shape.code).totalBudgetGel,
      budgetPerResidentGel: valueFor(shape.code).budgetPerResidentGel,
      bucket: bucketOf(valueFor(shape.code).budgetPerResidentGel),
      ...displayOf(valueFor(shape.code)),
    })),
    markers: MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => ({
      code: marker.code,
      nameKa: nameFor(marker.code),
      x: marker.x,
      y: marker.y,
      totalBudgetGel: valueFor(marker.code).totalBudgetGel,
      budgetPerResidentGel: valueFor(marker.code).budgetPerResidentGel,
      ...displayOf(valueFor(marker.code)),
    })),
    occupiedAreas: MUNICIPALITY_MAP_ARTIFACT.occupiedAreas.map((area) => ({ key: area.key })),
    legendMinPerResidentGel: Math.min(...polygonValues),
    legendMaxPerResidentGel: Math.max(...polygonValues),
  };
}

export function buildMunicipalityMapModel({
  municipalities,
  municipalityRows,
}: {
  municipalities: Municipality[];
  municipalityRows: MunicipalListRow[];
}): MunicipalityMapModel {
  const namesByCode = registryNames(municipalities);

  const valuesByCode = new Map<string, MapValue>();
  for (const row of municipalityRows) {
    if (row.kind !== "municipality") throw new Error(`Expected municipality row for ${row.id}`);
    if (!namesByCode.has(row.id)) throw new Error(`Unknown municipality row code ${row.id}`);
    if (valuesByCode.has(row.id)) throw new Error(`Duplicate municipality row code ${row.id}`);
    if (!Number.isFinite(row.valueGel) || row.valueGel <= 0) {
      throw new Error(`Invalid total budget for municipality ${row.id}`);
    }
    if (
      row.budgetPerResidentGel === null ||
      !Number.isFinite(row.budgetPerResidentGel) ||
      row.budgetPerResidentGel <= 0
    ) {
      throw new Error(`Invalid budget per resident for municipality ${row.id}`);
    }
    valuesByCode.set(row.id, {
      totalBudgetGel: row.valueGel,
      budgetPerResidentGel: row.budgetPerResidentGel,
    });
  }

  return assembleMunicipalityMapModel(namesByCode, valuesByCode);
}

/**
 * A municipality map of any one positive value per municipality (population). The number goes in the
 * existing numeric fields and `display` is the text the page prints in the label and tooltip.
 */
export function buildMunicipalityValueMapModel({
  municipalities,
  values,
  display,
}: {
  municipalities: Municipality[];
  values: ReadonlyMap<string, number>;
  display: (code: string, value: number) => string;
}): MunicipalityMapModel {
  const namesByCode = registryNames(municipalities);
  const valuesByCode = new Map<string, MapValue>();
  for (const [code, value] of values) {
    if (!namesByCode.has(code)) throw new Error(`Unknown municipality value code ${code}`);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid map value for municipality ${code}`);
    valuesByCode.set(code, { totalBudgetGel: value, budgetPerResidentGel: value, display: display(code, value) });
  }
  for (const code of namesByCode.keys()) {
    if (!valuesByCode.has(code)) throw new Error(`Missing map value for municipality ${code}`);
  }
  return assembleMunicipalityMapModel(namesByCode, valuesByCode);
}
```

- [ ] **Step 4: Let the component choose and use the page's wording**

In `apps/web/components/municipalities/municipality-map.tsx` make exactly these edits (everything else, including the outlines, hatching, tooltip placement and keyboard movement, stays):

1. `MunicipalityMapProps`: after `onOpenMunicipality: (code: string) => void;` add
   ```ts
     /** Choosing mode, for pages that pick places rather than open them: these codes are outlined and every target is a button. */
     selectedCodes?: readonly string[];
     /** Replaces the per-resident budget wording; each place's own value text is `display` on the model. */
     wording?: { groupAria: string; legendCaption: string };
   ```
2. `InteractionTarget`: add `display?: string;` after `totalBudgetGel: number;`.
3. Destructure `selectedCodes,` and `wording,` after `onOpenMunicipality,` in the component's parameters.
4. Replace the one-line `accessibleName` (line starting `const accessibleName = (code: string, nameKa: string, budgetPerResidentGel: number, totalBudgetGel: number) =>`) with:
   ```ts
     const accessibleName = (code: string, nameKa: string, budgetPerResidentGel: number, totalBudgetGel: number, display?: string) =>
       display !== undefined
         ? `${publicLabel(locale, code, nameKa, englishLabels)}, ${display}`
         : message(messages, "municipal.mapEntityAria", { name: publicLabel(locale, code, nameKa, englishLabels), perResident: formatPerResidentGel(budgetPerResidentGel, locale), total: formatAmount(totalBudgetGel, locale) });
   ```
5. After the `const describedTarget = ...;` statement add:
   ```ts
     const choosing = selectedCodes !== undefined;
     const chosen = useMemo(() => new Set(selectedCodes ?? []), [selectedCodes]);
   ```
6. Replace every `totalBudgetGel: shape.totalBudgetGel,` with `totalBudgetGel: shape.totalBudgetGel,` followed by a new line `display: shape.display,` (3 places, inside the `activatePointerTarget` and `activateFocusTarget` object literals), and every `totalBudgetGel: marker.totalBudgetGel,` likewise with `display: marker.display,` (2 places).
7. The two `aria-label={accessibleName(...)}` calls: append `, shape.display` to the shape one and `, marker.display` to the marker one (the last argument).
8. Shape target: replace `role="link"` with `role={choosing ? "button" : "link"}` and add the next line `aria-pressed={choosing ? chosen.has(shape.code) : undefined}`. Marker: the same with `marker.code`.
9. Marker visuals: replace `r={active ? 9.5 : 7.5}` with `r={active || chosen.has(marker.code) ? 9.5 : 7.5}`, `stroke="var(--tile)"` with `stroke={chosen.has(marker.code) ? "var(--ink)" : "var(--tile)"}` and `strokeWidth={active ? 2.2 : 1.2}` with `strokeWidth={chosen.has(marker.code) ? 2.4 : active ? 2.2 : 1.2}`.
10. Directly before `{occupiedAreas.map((area) => (` add the outline layer (drawn above the neighbours, never interactive):
    ```tsx
              {choosing
                ? shapes.filter((shape) => chosen.has(shape.code)).map((shape) => (
                    <use
                      key={`chosen:${shape.code}`}
                      data-testid={`municipality-chosen-${shape.code}`}
                      href={`${municipalityMapDefinitions.src}#municipality-shape-${shape.code}`}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      pointerEvents="none"
                      aria-hidden
                    />
                  ))
                : null}
    ```
11. Group label: replace `aria-label={message(messages, "municipal.mapAria", { year: MUNICIPAL_PER_RESIDENT_YEAR })}` with `aria-label={wording?.groupAria ?? message(messages, "municipal.mapAria", { year: MUNICIPAL_PER_RESIDENT_YEAR })}`.
12. Tooltip body: replace the three children of the tooltip `<div>` after the name line (the per-resident `<div>`, the total `<div>` and the `→` `<span>`) with
    ```tsx
                {describedTarget.display !== undefined ? (
                  <div data-testid="municipality-map-tooltip-value" className="mt-0.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
                    {describedTarget.display}
                  </div>
                ) : (
                  <>
                    <div data-testid="municipality-map-tooltip-per-resident" className="mt-0.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
                      {formatPerResidentGel(describedTarget.budgetPerResidentGel, locale)} {message(messages, "municipal.perResident")}
                    </div>
                    <div data-testid="municipality-map-tooltip-total" className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
                      {message(messages, "municipal.mapTotal", { amount: formatAmount(describedTarget.totalBudgetGel, locale) })}
                    </div>
                    <span aria-hidden className="absolute top-2 right-2.5 text-[12px] text-[var(--muted)]">→</span>
                  </>
                )}
    ```
13. Legend caption: replace `{message(messages, "municipal.perResident")}` in the legend row (the `<span className="text-[10px] text-[var(--faint)]">` after `legendMax`) with `{wording?.legendCaption ?? message(messages, "municipal.perResident")}`.

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npx vitest run tests/explorer/municipalityValueMap.test.tsx tests/explorer/municipalityMapData.test.ts tests/explorer/municipalityRoutes.test.ts && npm run typecheck`
Expected: all pass; the existing municipality map data tests pass unmodified.

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/municipalityMapData.ts components/municipalities/municipality-map.tsx tests/explorer/municipalityValueMap.test.tsx
git commit -m "feat(explorer): municipality map can choose places and plot any value" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Places and the population model

**Files:**
- Create: `apps/web/lib/explorer/demographyAreas.ts`, `apps/web/lib/explorer/demographyPopulation.ts`
- Test: `apps/web/tests/explorer/demographyPopulation.test.ts`

**Interfaces:**
- Consumes: `loadServedDemographyData`, `projectDemographyObservation`, `ClientDemographyObservation` (Tasks 2 and 4); `resolveRange`, `PeriodRange` from `periodRange.ts`; `parseYearRangeKeys`, `writeYearRangeKeys` from `urlState.ts`; `CENSUS_STEP`, `SERIES`, `populationEstimateBasis` from `lib/data/demography/series.ts`.
- Produces (`demographyAreas.ts`): `GEORGIA_PLACE_ID`, `TBILISI_PLACE_ID`; `DemographyPlace = { id; level: "country" | "region" | "municipality"; nameKa; nameEn; regionId: string | null; sortOrder: number; municipalityCount: number }`; `buildDemographyPlaces({ regions, municipalities, englishLabels, georgiaNameKa }): DemographyPlace[]` (75 places: Georgia, 11 regions, 63 municipalities; municipality `04` is not a place); `placeIdForMunicipalityCode(code)`, `municipalityCodeForPlaceId(id)`; `placesAtLevel(places, "regions" | "municipalities")`; `placeColor(place)`; `placeLabel(place, locale)`.
- Produces (`demographyPopulation.ts`): `PopulationState`, `DEFAULT_POPULATION_STATE`, `parsePopulationHash(hash, validIds)`, `serializePopulationHash(state)`; transitions `chooseOnMap`, `chooseGeorgia`, `changeLevel`, `changeMeasure`, `toggleSelected`, `setTabSelection`; `rankPlaces(places, endValues)`; `buildPopulationModel({ facts, places, state, locale })` returning `{ range, years, availableYears, ranked, listed, selected, rows, series, endValues, valueAt, firstSelected, hasData }`; `sparkValues(years, valueAt)`; `buildPopulationHighlights(model, facts, places): PopulationHighlights | null` (a union on `kind`: `country`, `region`, `municipality`); `populationBasisKey(year)`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/demographyPopulation.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  buildDemographyPlaces,
  municipalityCodeForPlaceId,
  placeColor,
  placeIdForMunicipalityCode,
  placesAtLevel,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import {
  DEFAULT_POPULATION_STATE,
  buildPopulationHighlights,
  buildPopulationModel,
  changeLevel,
  changeMeasure,
  chooseGeorgia,
  chooseOnMap,
  parsePopulationHash,
  populationBasisKey,
  rankPlaces,
  serializePopulationHash,
  setTabSelection,
  sparkValues,
  toggleSelected,
  type PopulationState,
} from "../../lib/explorer/demographyPopulation";
import { INK } from "../../lib/explorer/colors";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { getPresentation } from "../../lib/i18n/presentation.server";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];
let validIds: string[];

const state = (patch: Partial<PopulationState> = {}): PopulationState => ({ ...DEFAULT_POPULATION_STATE, ...patch });
const model = (patch: Partial<PopulationState> = {}, locale: "ka" | "en" = "en") =>
  buildPopulationModel({ facts, places, state: state(patch), locale });
const population = (id: string, year: number) =>
  facts.find((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === id && fact.year === year)?.value ?? null;

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const presentation = await getPresentation("en", [], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: "საქართველო",
  });
  validIds = places.map((place) => place.id);
});

describe("places", () => {
  test("Georgia, 11 regions and 63 municipalities; Tbilisi is only a region", () => {
    expect(places).toHaveLength(75);
    expect(places.filter((place) => place.level === "country")).toHaveLength(1);
    expect(places.filter((place) => place.level === "region")).toHaveLength(11);
    expect(places.filter((place) => place.level === "municipality")).toHaveLength(63);
    expect(places.some((place) => place.id === "04")).toBe(false);
    expect(places.find((place) => place.id === TBILISI_PLACE_ID)?.municipalityCount).toBe(1);
    expect(places.find((place) => place.id === GEORGIA_PLACE_ID)?.municipalityCount).toBe(64);
    expect(places.find((place) => place.id === "11")).toMatchObject({ nameEn: "Khulo", regionId: "region.adjara" });
  });

  test("each level lists Georgia first and Tbilisi once; both lists hold the same Tbilisi", () => {
    const regions = placesAtLevel(places, "regions");
    const municipalities = placesAtLevel(places, "municipalities");
    expect(regions).toHaveLength(12);
    expect(municipalities).toHaveLength(65);
    expect(regions.filter((place) => place.id === TBILISI_PLACE_ID)).toHaveLength(1);
    expect(municipalities.filter((place) => place.id === TBILISI_PLACE_ID)).toHaveLength(1);
  });

  test("Tbilisi and municipality 04 are one place with one colour; Georgia is ink", () => {
    expect(placeIdForMunicipalityCode("04")).toBe(TBILISI_PLACE_ID);
    expect(municipalityCodeForPlaceId(TBILISI_PLACE_ID)).toBe("04");
    expect(placeIdForMunicipalityCode("11")).toBe("11");
    expect(placeColor(places.find((place) => place.id === GEORGIA_PLACE_ID)!)).toBe(INK);
    const colours = places.map(placeColor);
    expect(colours.every((colour) => /^#[0-9A-F]{6}$/i.test(colour))).toBe(true);
  });
});

describe("hash state", () => {
  test("defaults to Georgia only, regions, population, line, full range", () => {
    expect(parsePopulationHash("", validIds)).toEqual(DEFAULT_POPULATION_STATE);
  });

  test("round-trips a full state", () => {
    const original = state({
      selectedIds: ["region.imereti", "11", GEORGIA_PLACE_ID],
      level: "municipalities",
      mode: "table",
      range: { kind: "manual", start: 2015, end: 2024 },
    });
    expect(parsePopulationHash(`#${serializePopulationHash(original)}`, validIds)).toEqual(original);
    expect(parsePopulationHash(`#${serializePopulationHash(state({ map: "density" }))}`, validIds)).toEqual(state({ map: "density" }));
  });

  test("rejects unknown ids, removes duplicates, reads 04 as Tbilisi and keeps an explicit empty selection", () => {
    expect(parsePopulationHash("#sel=region.guria,nonsense,region.guria,04", validIds).selectedIds).toEqual(["region.guria", TBILISI_PLACE_ID]);
    expect(parsePopulationHash("#sel=", validIds).selectedIds).toEqual([]);
    expect(parsePopulationHash("#sel=nonsense", validIds).selectedIds).toEqual([]);
  });

  test("unknown level, map and view fall back, and density needs the regions level", () => {
    expect(parsePopulationHash("#level=x&map=x&view=x", validIds)).toEqual(DEFAULT_POPULATION_STATE);
    expect(parsePopulationHash("#level=municipalities&map=density", validIds)).toMatchObject({ level: "municipalities", map: "population" });
    expect(parsePopulationHash("#level=regions&map=density", validIds)).toMatchObject({ level: "regions", map: "density" });
  });

  test("reads manual and open ranges", () => {
    expect(parsePopulationHash("#start=2010&end=2020", validIds).range).toEqual({ kind: "manual", start: 2010, end: 2020 });
    expect(parsePopulationHash("#range=all&start=2010&end=2020", validIds).range).toEqual({ kind: "all" });
  });
});

describe("state changes", () => {
  test("choosing on the map replaces the selection; list ticks add; the Georgia pill resets", () => {
    const picked = chooseOnMap(state({ selectedIds: [GEORGIA_PLACE_ID, "region.guria"] }), "region.imereti");
    expect(picked.selectedIds).toEqual(["region.imereti"]);
    expect(toggleSelected(picked, "region.guria").selectedIds).toEqual(["region.imereti", "region.guria"]);
    expect(toggleSelected(picked, "region.imereti").selectedIds).toEqual([]);
    expect(chooseGeorgia(picked).selectedIds).toEqual([GEORGIA_PLACE_ID]);
  });

  test("changing the level keeps the selection; municipalities turn density back into population", () => {
    const density = state({ map: "density", selectedIds: ["region.imereti"] });
    expect(changeLevel(density, "municipalities")).toMatchObject({ level: "municipalities", map: "population", selectedIds: ["region.imereti"] });
    expect(changeLevel(density, "regions").map).toBe("density");
    expect(changeMeasure(state({ level: "municipalities" }), "density").map).toBe("population");
    expect(changeMeasure(state(), "density").map).toBe("density");
  });

  test("select all and clear act on the active tab only", () => {
    const regionIds = placesAtLevel(places, "regions").map((place) => place.id);
    const mixed = state({ selectedIds: ["11"] });
    const all = setTabSelection(mixed, regionIds, true);
    expect(all.selectedIds).toEqual(["11", ...regionIds]);
    expect(setTabSelection(all, regionIds, false).selectedIds).toEqual(["11"]);
  });
});

describe("population model", () => {
  test("the default is Georgia over every loaded year", () => {
    const result = model();
    expect(result.years[0]).toBe(2004);
    expect(result.years.at(-1)).toBe(2026);
    expect(result.years).toHaveLength(23);
    expect(result.series.map((line) => line.id)).toEqual([GEORGIA_PLACE_ID]);
    expect(result.series[0]!.vals.at(-1)).toBe(3_941_103);
    expect(result.rows[0]).toMatchObject({ itemId: GEORGIA_PLACE_ID, kaLabel: "Georgia" });
    expect(result.rows[0]!.valuesByYear[2024]).toBe(3_694_608);
    expect(result.hasData).toBe(true);
    expect(result.listed).toHaveLength(12);
  });

  test("Georgia first, then selected places by their end-year value", () => {
    const result = model({ selectedIds: ["region.imereti", "11", TBILISI_PLACE_ID, GEORGIA_PLACE_ID, "06"] });
    expect(result.selected.map((place) => place.id)).toEqual([GEORGIA_PLACE_ID, TBILISI_PLACE_ID, "region.imereti", "06", "11"]);
  });

  test("a place has no value before its first year and the line does not bridge or zero-fill it", () => {
    const result = model({ selectedIds: ["region.imereti"] });
    expect(result.series[0]!.vals[0]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2014)]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2015)]).toBe(population("region.imereti", 2015));
    expect(result.rows[0]!.valuesByYear[2010]).toBeNull();
  });

  test("labels follow the language", () => {
    expect(model({ selectedIds: ["11"] }, "ka").series[0]!.label).toBe(places.find((place) => place.id === "11")!.nameKa);
    expect(model({ selectedIds: ["11"] }, "en").series[0]!.label).toBe("Khulo");
  });

  test("a manual range is used and one outside the data shows everything", () => {
    expect(model({ range: { kind: "manual", start: 2015, end: 2024 } }).years).toHaveLength(10);
    expect(model({ range: { kind: "manual", start: 2000, end: 2030 } }).years).toHaveLength(23);
    expect(model({ range: { kind: "manual", start: 1990, end: 1995 } }).years).toHaveLength(23);
  });

  test("an empty selection has no highlights and no data", () => {
    const result = model({ selectedIds: [] });
    expect(result.firstSelected).toBeNull();
    expect(result.hasData).toBe(false);
    expect(buildPopulationHighlights(result, facts, places)).toBeNull();
  });

  test("a selection with no value in the range has no data", () => {
    expect(model({ selectedIds: ["region.imereti"], range: { kind: "manual", start: 2004, end: 2010 } }).hasData).toBe(false);
  });

  test("the lineage of a year in plain words", () => {
    expect([2004, 2014, 2015, 2024, 2025, 2026].map(populationBasisKey)).toEqual([
      "demography.basisRetro",
      "demography.basisRetro",
      "demography.basisPre",
      "demography.basisPre",
      "demography.basisCensus",
      "demography.basisCensus",
    ]);
  });
});

describe("ranking", () => {
  const fake = (id: string, sortOrder: number): DemographyPlace => ({
    id, level: "region", nameKa: id, nameEn: id, regionId: null, sortOrder, municipalityCount: 0,
  });

  test("ties break by registry order, missing values go last and Georgia stays first", () => {
    const list = [fake("b", 2), fake("a", 1), fake("c", 3), places.find((place) => place.id === GEORGIA_PLACE_ID)!];
    expect(rankPlaces(list, { a: 5, b: 5, c: null, [GEORGIA_PLACE_ID]: 1 }).map((place) => place.id)).toEqual([GEORGIA_PLACE_ID, "a", "b", "c"]);
  });
});

describe("highlights", () => {
  const smallest = (year: number) => {
    const entries = places
      .filter((place) => place.level === "municipality" || place.id === TBILISI_PLACE_ID)
      .map((place) => ({ place, value: population(place.id, year)! }))
      .sort((left, right) => left.value - right.value || left.place.sortOrder - right.place.sortOrder);
    return entries[0]!;
  };

  test("Georgia in 2026: the largest region, the densest region and the smallest municipality", () => {
    const result = buildPopulationHighlights(model(), facts, places);
    expect(result).toMatchObject({ kind: "country", year: 2026, persons: 3_941_103 });
    if (result?.kind !== "country") throw new Error("expected the country highlights");
    expect(result.largestRegion).toMatchObject({ value: 1_369_356 });
    expect(result.largestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.densestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.smallestMunicipality?.place.id).toBe(smallest(2026).place.id);
    expect(result.smallestMunicipality?.value).toBe(smallest(2026).value);
    expect(result.regionalFrom).toBe(2015);
  });

  test("Tbilisi in 2026 is a region with 34.7% of Georgia", () => {
    const result = buildPopulationHighlights(model({ selectedIds: [TBILISI_PLACE_ID] }), facts, places);
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    expect(result.persons).toBe(1_369_356);
    expect((result.shareOfGeorgia! * 100).toFixed(1)).toBe("34.7");
    expect(result.rank).toBe(1);
    expect(result.ofRegions).toBe(11);
    expect(result.municipalityCount).toBe(1);
    expect(result.density).not.toBeNull();
    expect(result.densityRank).toBe(1);
  });

  test("a region at the end of a 2025 range", () => {
    const result = buildPopulationHighlights(
      model({ selectedIds: ["region.imereti"], range: { kind: "manual", start: 2015, end: 2025 } }),
      facts,
      places,
    );
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    const regionIds = places.filter((place) => place.level === "region").map((place) => place.id);
    const expectedRank = [...regionIds].sort((left, right) => population(right, 2025)! - population(left, 2025)!).indexOf("region.imereti") + 1;
    expect(result.year).toBe(2025);
    expect(result.persons).toBe(population("region.imereti", 2025));
    expect(result.rank).toBe(expectedRank);
    expect(result.municipalityCount).toBe(places.filter((place) => place.regionId === "region.imereti").length);
  });

  test("a municipality at the end of a 2024 range, before the re-base", () => {
    const result = buildPopulationHighlights(
      model({ selectedIds: ["11"], range: { kind: "manual", start: 2015, end: 2024 } }),
      facts,
      places,
    );
    if (result?.kind !== "municipality") throw new Error("expected the municipality highlights");
    expect(result.persons).toBe(28_250);
    expect(result.shareOfRegion).toBeCloseTo(28_250 / population("region.adjara", 2024)!, 10);
    expect(result.regionPersons).toBe(population("region.adjara", 2024));
    expect(result.shareOfGeorgia).toBeCloseTo(28_250 / 3_694_608, 10);
    expect(result.ofMunicipalities).toBe(64);
    expect(result.region?.id).toBe("region.adjara");
  });

  test("a range that ends before 2015 has Georgia but no regional figure", () => {
    const range = { kind: "manual" as const, start: 2004, end: 2010 };
    const country = buildPopulationHighlights(model({ range }), facts, places);
    if (country?.kind !== "country") throw new Error("expected the country highlights");
    expect(country.persons).toBe(population(GEORGIA_PLACE_ID, 2010));
    expect(country.largestRegion).toBeNull();
    expect(country.smallestMunicipality).toBeNull();
    const region = buildPopulationHighlights(model({ selectedIds: ["region.imereti"], range }), facts, places);
    if (region?.kind !== "region") throw new Error("expected the region highlights");
    expect(region.persons).toBeNull();
    expect(region.rank).toBeNull();
    expect(region.regionalFrom).toBe(2015);
  });

  test("the first selected place is Georgia when it is chosen, otherwise the most populous place", () => {
    expect(buildPopulationHighlights(model({ selectedIds: ["11", "region.imereti", GEORGIA_PLACE_ID] }), facts, places)?.place.id).toBe(GEORGIA_PLACE_ID);
    expect(buildPopulationHighlights(model({ selectedIds: ["11", "region.imereti"] }), facts, places)?.place.id).toBe("region.imereti");
  });

  test("a trend is two segments across the re-base and one without it", () => {
    const across = buildPopulationHighlights(model({ range: { kind: "manual", start: 2015, end: 2026 } }), facts, places)!;
    expect(across.trend).toHaveLength(13);
    expect(across.trend[9]).toBe(3_694_608);
    expect(across.trend[10]).toBeNull();
    expect(across.trend[11]).toBe(3_930_428);
    const after = buildPopulationHighlights(model({ range: { kind: "manual", start: 2025, end: 2026 } }), facts, places)!;
    expect(after.trend).toEqual([3_930_428, 3_941_103]);
    expect(sparkValues([2023, 2024], (year) => year)).toEqual([2023, 2024]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/explorer/demographyPopulation.test.ts`
Expected: FAIL (cannot resolve `demographyAreas` / `demographyPopulation`).

- [ ] **Step 3: Write the places module**

`apps/web/lib/explorer/demographyAreas.ts`:

```ts
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { publicLabel } from "../i18n/labels";
import type { Locale } from "../i18n/types";
import { EDITORIAL_PALETTE, INK } from "./colors";

export const GEORGIA_PLACE_ID = MUNICIPAL_COUNTRY_ID;
export const TBILISI_PLACE_ID = "region.tbilisi";
// Municipality 04 is the same place, with the same numbers, as the region of Tbilisi. The page
// keeps one place for it, so choosing it under either grouping draws one line.
const TBILISI_MUNICIPALITY_CODE = "04";

export type DemographyPlaceLevel = "country" | "region" | "municipality";

export type DemographyPlace = {
  /** `country.georgia`, a `region.*` id, or a two-digit municipality code; Tbilisi is always `region.tbilisi`. */
  id: string;
  level: DemographyPlaceLevel;
  nameKa: string;
  nameEn: string;
  /** Municipalities: the id of their region. */
  regionId: string | null;
  /** Georgia 0, regions by their registry order, municipalities by their sort id. */
  sortOrder: number;
  /** Regions and Georgia: how many municipalities they hold. */
  municipalityCount: number;
};

export function buildDemographyPlaces({
  regions,
  municipalities,
  englishLabels,
  georgiaNameKa,
}: {
  regions: readonly MunicipalRegion[];
  municipalities: readonly Municipality[];
  englishLabels: Readonly<Record<string, string>>;
  georgiaNameKa: string;
}): DemographyPlace[] {
  const english = (id: string, nameKa: string) => publicLabel("en", id, nameKa, englishLabels);
  const countByRegion = new Map<string, number>();
  for (const municipality of municipalities) {
    countByRegion.set(municipality.regionId, (countByRegion.get(municipality.regionId) ?? 0) + 1);
  }
  return [
    {
      id: GEORGIA_PLACE_ID,
      level: "country",
      nameKa: georgiaNameKa,
      nameEn: english(GEORGIA_PLACE_ID, georgiaNameKa),
      regionId: null,
      sortOrder: 0,
      municipalityCount: municipalities.length,
    },
    ...regions.map((region): DemographyPlace => ({
      id: region.id,
      level: "region",
      nameKa: region.kaLabel,
      nameEn: english(region.id, region.kaLabel),
      regionId: null,
      sortOrder: region.sortOrder,
      municipalityCount: countByRegion.get(region.id) ?? 0,
    })),
    ...municipalities
      .filter((municipality) => municipality.code !== TBILISI_MUNICIPALITY_CODE)
      .map((municipality): DemographyPlace => ({
        id: municipality.code,
        level: "municipality",
        nameKa: municipality.displayNameKa,
        nameEn: english(municipality.code, municipality.displayNameKa),
        regionId: municipality.regionId,
        sortOrder: municipality.sortId,
        municipalityCount: 0,
      })),
  ];
}

/** Rows keyed by municipality code (the facts, the municipal map) name Tbilisi `04`; the page names it `region.tbilisi`. */
export function placeIdForMunicipalityCode(code: string): string {
  return code === TBILISI_MUNICIPALITY_CODE ? TBILISI_PLACE_ID : code;
}

export function municipalityCodeForPlaceId(id: string): string {
  return id === TBILISI_PLACE_ID ? TBILISI_MUNICIPALITY_CODE : id;
}

/** Georgia, then the places of one level. Tbilisi is in both lists because it is both a region and a municipality. */
export function placesAtLevel(places: readonly DemographyPlace[], level: "regions" | "municipalities"): DemographyPlace[] {
  return places.filter(
    (place) =>
      place.id === GEORGIA_PLACE_ID ||
      (level === "regions" ? place.level === "region" : place.level === "municipality" || place.id === TBILISI_PLACE_ID),
  );
}

/** Georgia is ink; regions and municipalities cycle the editorial palette by their registry order, so a place keeps its colour on every page. */
export function placeColor(place: DemographyPlace): string {
  if (place.level === "country") return INK;
  const index = place.level === "region" ? place.sortOrder - 1 : place.sortOrder;
  return EDITORIAL_PALETTE[index % EDITORIAL_PALETTE.length]!;
}

export function placeLabel(place: DemographyPlace, locale: Locale): string {
  return locale === "en" ? place.nameEn : place.nameKa;
}
```

- [ ] **Step 4: Write the population model**

`apps/web/lib/explorer/demographyPopulation.ts`:

```ts
import { CENSUS_STEP, SERIES, populationEstimateBasis } from "../data/demography/series";
import type { Locale } from "../i18n/types";
import type { ClientDemographyObservation } from "../servedRows";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  placeColor,
  placeIdForMunicipalityCode,
  placeLabel,
  placesAtLevel,
  type DemographyPlace,
} from "./demographyAreas";
import { resolveRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export type PopulationLevel = "regions" | "municipalities";
export type PopulationMapMeasure = "population" | "density";

export type PopulationState = {
  /** Place ids; Tbilisi is `region.tbilisi`. */
  selectedIds: string[];
  level: PopulationLevel;
  map: PopulationMapMeasure;
  mode: "line" | "table";
  range: PeriodRange;
};

export const DEFAULT_POPULATION_STATE: PopulationState = {
  selectedIds: [GEORGIA_PLACE_ID],
  level: "regions",
  map: "population",
  mode: "line",
  range: { kind: "all" },
};

/** Unknown values are rejected, duplicates removed; an absent `sel` means Georgia only and an explicit empty one stays empty. */
export function parsePopulationHash(hash: string, validIds: readonly string[]): PopulationState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const level: PopulationLevel = params.get("level") === "municipalities" ? "municipalities" : "regions";
  return {
    selectedIds: params.has("sel")
      ? [...new Set(params.get("sel")!.split(",").map(placeIdForMunicipalityCode))].filter((id) => validIds.includes(id))
      : [GEORGIA_PLACE_ID],
    level,
    // Density is published for Georgia and the regions only.
    map: level === "regions" && params.get("map") === "density" ? "density" : "population",
    mode: params.get("view") === "table" ? "table" : "line",
    range: parseYearRangeKeys(params),
  };
}

export function serializePopulationHash(state: PopulationState): string {
  const params = new URLSearchParams({
    sel: state.selectedIds.join(","),
    level: state.level,
    map: state.map,
    view: state.mode,
  });
  writeYearRangeKeys(params, state.range);
  return params.toString();
}

/** Choosing a place on a map replaces the selection with that place alone. */
export function chooseOnMap(state: PopulationState, id: string): PopulationState {
  return { ...state, selectedIds: [id] };
}

export function chooseGeorgia(state: PopulationState): PopulationState {
  return { ...state, selectedIds: [GEORGIA_PLACE_ID] };
}

/** The selection survives a level change; density does not exist below the regions, so the map falls back to population. */
export function changeLevel(state: PopulationState, level: PopulationLevel): PopulationState {
  return { ...state, level, map: level === "municipalities" ? "population" : state.map };
}

export function changeMeasure(state: PopulationState, map: PopulationMapMeasure): PopulationState {
  return state.level === "municipalities" ? state : { ...state, map };
}

/** Ticking a place in the list adds it to, or removes it from, the selection. */
export function toggleSelected(state: PopulationState, id: string): PopulationState {
  return {
    ...state,
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter((selected) => selected !== id)
      : [...state.selectedIds, id],
  };
}

/** Select all or clear for the places of the active tab; places chosen under the other tab are left as they are. */
export function setTabSelection(state: PopulationState, tabIds: readonly string[], selected: boolean): PopulationState {
  const tab = new Set(tabIds);
  return {
    ...state,
    selectedIds: selected
      ? [...state.selectedIds, ...tabIds.filter((id) => !state.selectedIds.includes(id))]
      : state.selectedIds.filter((id) => !tab.has(id)),
  };
}

/** Georgia first, then by the value at the end of the range (descending, missing last), ties by registry order. */
export function rankPlaces(
  places: readonly DemographyPlace[],
  endValues: Readonly<Record<string, number | null>>,
): DemographyPlace[] {
  return [...places].sort((left, right) => {
    if (left.id === GEORGIA_PLACE_ID) return -1;
    if (right.id === GEORGIA_PLACE_ID) return 1;
    const leftValue = endValues[left.id] ?? null;
    const rightValue = endValues[right.id] ?? null;
    if (leftValue === null && rightValue !== null) return 1;
    if (rightValue === null && leftValue !== null) return -1;
    return (
      (leftValue !== null && rightValue !== null ? rightValue - leftValue : 0) ||
      left.sortOrder - right.sortOrder ||
      left.id.localeCompare(right.id)
    );
  });
}

export function buildPopulationModel({
  facts,
  places,
  state,
  locale,
}: {
  facts: readonly ClientDemographyObservation[];
  places: readonly DemographyPlace[];
  state: PopulationState;
  locale: Locale;
}) {
  const byCell = new Map<string, number>();
  const yearSet = new Set<number>();
  for (const fact of facts) {
    if (fact.seriesId !== SERIES.populationTotal) continue;
    // Municipality 04 and the region of Tbilisi carry the same number; both land on one cell.
    byCell.set(`${placeIdForMunicipalityCode(fact.geographyId)}:${fact.year}`, fact.value);
    yearSet.add(fact.year);
  }
  const availableYears = [...yearSet].sort((left, right) => left - right);
  if (availableYears.length === 0) throw new Error("No population years are available");
  const range = {
    availableYears,
    ...resolveRange(state.range, { min: availableYears[0]!, max: availableYears.at(-1)! }),
  };
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const valueAt = (id: string, year: number): number | null => byCell.get(`${id}:${year}`) ?? null;
  const endValues = Object.fromEntries(places.map((place) => [place.id, valueAt(place.id, range.end)]));
  const ranked = rankPlaces(places, endValues);
  const listed = placesAtLevel(ranked, state.level);
  const selected = ranked.filter((place) => state.selectedIds.includes(place.id));
  const rows = selected.map((place) => ({
    itemId: place.id,
    kaLabel: placeLabel(place, locale),
    color: placeColor(place),
    valuesByYear: Object.fromEntries(years.map((year) => [year, valueAt(place.id, year)])),
  }));
  const series = selected.map((place) => ({
    id: place.id,
    label: placeLabel(place, locale),
    color: placeColor(place),
    vals: years.map((year) => valueAt(place.id, year)),
    planned: years.map(() => false),
  }));
  return {
    range,
    years,
    availableYears,
    ranked,
    listed,
    selected,
    rows,
    series,
    endValues,
    valueAt,
    firstSelected: selected[0] ?? null,
    hasData: selected.some((place) => years.some((year) => valueAt(place.id, year) !== null)),
  };
}

export type PopulationModel = ReturnType<typeof buildPopulationModel>;

/** The message key for the plain-language lineage of a 1 January population (foundation section 5, R6). */
export function populationBasisKey(year: number) {
  const basis = populationEstimateBasis(year);
  if (basis === "retro_projection") return "demography.basisRetro";
  return basis === "census_based" ? "demography.basisCensus" : "demography.basisPre";
}

/**
 * One series over the range for a sparkline, with a null where the census re-base falls between two of
 * its years so the line is drawn in two segments (foundation section 5, R1).
 */
export function sparkValues(
  years: readonly number[],
  valueAt: (year: number) => number | null,
): Array<number | null> {
  const values: Array<number | null> = [];
  for (const year of years) {
    if (year === CENSUS_STEP.toYear && years.includes(CENSUS_STEP.fromYear)) values.push(null);
    values.push(valueAt(year));
  }
  return values;
}

type Figure = { place: DemographyPlace; value: number; trend: Array<number | null> };

type HighlightBase = {
  place: DemographyPlace;
  year: number;
  persons: number | null;
  trend: Array<number | null>;
  /** The first year a region or municipality has a value: what the page says when the range ends before it. */
  regionalFrom: number | null;
};

export type PopulationHighlights =
  | (HighlightBase & {
      kind: "country";
      largestRegion: Figure | null;
      densestRegion: Figure | null;
      smallestMunicipality: Figure | null;
    })
  | (HighlightBase & {
      kind: "region";
      shareOfGeorgia: number | null;
      rank: number | null;
      ofRegions: number;
      density: number | null;
      densityRank: number | null;
      densityTrend: Array<number | null>;
      municipalityCount: number;
    })
  | (HighlightBase & {
      kind: "municipality";
      shareOfRegion: number | null;
      regionPersons: number | null;
      rank: number | null;
      ofMunicipalities: number;
      shareOfGeorgia: number | null;
      region: DemographyPlace | null;
    });

function extreme(
  group: readonly DemographyPlace[],
  valueOf: (id: string) => number | null,
  pick: "max" | "min",
): { place: DemographyPlace; value: number } | null {
  let best: { place: DemographyPlace; value: number } | null = null;
  for (const place of group) {
    const value = valueOf(place.id);
    if (value === null) continue;
    const better =
      best === null ||
      (pick === "max" ? value > best.value : value < best.value) ||
      (value === best.value && place.sortOrder < best.place.sortOrder);
    if (better) best = { place, value };
  }
  return best;
}

function rankOf(group: readonly DemographyPlace[], id: string, valueOf: (id: string) => number | null): number | null {
  const ranked = group
    .map((place) => ({ place, value: valueOf(place.id) }))
    .filter((entry): entry is { place: DemographyPlace; value: number } => entry.value !== null)
    .sort((left, right) => right.value - left.value || left.place.sortOrder - right.place.sortOrder);
  const index = ranked.findIndex((entry) => entry.place.id === id);
  return index === -1 ? null : index + 1;
}

const fraction = (part: number | null, whole: number | null) =>
  part === null || whole === null || whole === 0 ? null : part / whole;

/**
 * The highlights describe the first selected place for the end year of the range. Nothing here is a
 * change over time, so nothing spans the census re-base (foundation section 5, R4).
 */
export function buildPopulationHighlights(
  model: PopulationModel,
  facts: readonly ClientDemographyObservation[],
  places: readonly DemographyPlace[],
): PopulationHighlights | null {
  const place = model.firstSelected;
  if (!place) return null;
  const { years, valueAt } = model;
  const year = model.range.end;
  const densityByCell = new Map<string, number>();
  const regionalYears: number[] = [];
  for (const fact of facts) {
    if (fact.seriesId === SERIES.populationDensity) densityByCell.set(`${fact.geographyId}:${fact.year}`, fact.value);
    if (fact.seriesId === SERIES.populationTotal && fact.geographyId.startsWith("region.")) regionalYears.push(fact.year);
  }
  const densityAt = (id: string, atYear: number) => densityByCell.get(`${id}:${atYear}`) ?? null;
  const personsOf = (id: string) => valueAt(id, year);
  const densityOf = (id: string) => densityAt(id, year);
  const trendOf = (id: string) => sparkValues(years, (atYear) => valueAt(id, atYear));
  const densityTrendOf = (id: string) => sparkValues(years, (atYear) => densityAt(id, atYear));
  const regions = places.filter((candidate) => candidate.level === "region");
  const municipalities = places.filter(
    (candidate) => candidate.level === "municipality" || candidate.id === TBILISI_PLACE_ID,
  );
  const base: HighlightBase = {
    place,
    year,
    persons: personsOf(place.id),
    trend: trendOf(place.id),
    regionalFrom: regionalYears.length > 0 ? Math.min(...regionalYears) : null,
  };

  if (place.level === "country") {
    const figure = (found: { place: DemographyPlace; value: number } | null, trend: (id: string) => Array<number | null>): Figure | null =>
      found && { ...found, trend: trend(found.place.id) };
    return {
      ...base,
      kind: "country",
      largestRegion: figure(extreme(regions, personsOf, "max"), trendOf),
      densestRegion: figure(extreme(regions, densityOf, "max"), densityTrendOf),
      smallestMunicipality: figure(extreme(municipalities, personsOf, "min"), trendOf),
    };
  }

  const georgia = personsOf(GEORGIA_PLACE_ID);
  if (place.level === "region") {
    return {
      ...base,
      kind: "region",
      shareOfGeorgia: fraction(base.persons, georgia),
      rank: rankOf(regions, place.id, personsOf),
      ofRegions: regions.length,
      density: densityOf(place.id),
      densityRank: rankOf(regions, place.id, densityOf),
      densityTrend: densityTrendOf(place.id),
      municipalityCount: place.municipalityCount,
    };
  }

  const regionPersons = place.regionId === null ? null : personsOf(place.regionId);
  return {
    ...base,
    kind: "municipality",
    shareOfRegion: fraction(base.persons, regionPersons),
    regionPersons,
    rank: rankOf(municipalities, place.id, personsOf),
    ofMunicipalities: municipalities.length,
    shareOfGeorgia: fraction(base.persons, georgia),
    region: places.find((candidate) => candidate.id === place.regionId) ?? null,
  };
}
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npx vitest run tests/explorer/demographyPopulation.test.ts && npm run typecheck`
Expected: 27 tests pass against the real CSVs; typecheck clean. (The model and 26 of these tests were run once against the real data before this plan was written and all passed; the 27th test, `populationBasisKey`, and the `regionPersons` field with its one assertion were added afterwards and have not been run.)

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/demographyAreas.ts lib/explorer/demographyPopulation.ts tests/explorer/demographyPopulation.test.ts
git commit -m "feat(demography): places and the population model with hash state and highlights" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Map models for the page (server side)

**Files:**
- Create: `apps/web/lib/explorer/demographyPopulationMaps.ts`
- Test: `apps/web/tests/explorer/demographyPopulationMaps.test.ts`

**Interfaces:**
- Consumes: `buildRegionValueMapModel` (Task 6), `buildMunicipalityValueMapModel` (Task 7), `formatInUnit`, `UNIT_PERSONS`, `UNIT_DENSITY` (Task 4), `ServedDemographyObservation` (Task 2).
- Produces: `PopulationMapModels = { populationYear: number; densityYear: number; regionsPopulation: RegionalEconomyMapModel; regionsDensity: RegionalEconomyMapModel; municipalitiesPopulation: MunicipalityMapModel }` and `buildPopulationMapModels({ facts, regions, municipalities, densityUnit }): PopulationMapModels`. Server only: the builders read the outline files with `node:fs`, so the page builds all three models once and hands the client the one it needs. (The second region model repeats about 18 kB of outlines in the page data; accepted to keep the existing builders untouched.)

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/demographyPopulationMaps.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationMapModels, type PopulationMapModels } from "../../lib/explorer/demographyPopulationMaps";

let facts: ServedDemographyObservation[];
let regions: MunicipalRegion[];
let municipalities: Municipality[];
let maps: PopulationMapModels;

beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  regions = municipal.regions;
  municipalities = municipal.municipalities;
  maps = buildPopulationMapModels({ facts, regions, municipalities, densityUnit: "/km²" });
});

describe("population map models", () => {
  test("every map shows the latest loaded year", () => {
    expect(maps.populationYear).toBe(2026);
    expect(maps.densityYear).toBe(2026);
    expect(maps.regionsPopulation.year).toBe(2026);
    expect(maps.regionsDensity.year).toBe(2026);
  });

  test("the region maps draw eleven regions, largest and densest first", () => {
    expect(maps.regionsPopulation.regions).toHaveLength(11);
    expect(maps.regionsPopulation.regions[0]).toMatchObject({ regionId: "region.tbilisi", totalGdpGel: 1_369_356, display: "1,369,356" });
    expect(maps.regionsPopulation.regions.at(-1)).toMatchObject({ regionId: "region.racha_lechkhumi_kvemo_svaneti", totalGdpGel: 29_481 });
    expect(maps.regionsDensity.regions[0]).toMatchObject({ regionId: "region.tbilisi", totalGdpGel: 2715.7, display: "2,715.7 /km²" });
    expect(maps.regionsDensity.regions.at(-1)).toMatchObject({ regionId: "region.racha_lechkhumi_kvemo_svaneti", display: "6.4 /km²" });
  });

  test("the municipality map draws 60 shapes and 5 city markers with Tbilisi as one place", () => {
    expect(maps.municipalitiesPopulation.shapes).toHaveLength(60);
    expect(maps.municipalitiesPopulation.markers).toHaveLength(5);
    expect(maps.municipalitiesPopulation.markers.find((marker) => marker.code === "04")).toMatchObject({ budgetPerResidentGel: 1_369_356, display: "1,369,356" });
    expect(maps.municipalitiesPopulation.shapes.find((shape) => shape.code === "11")).toMatchObject({ budgetPerResidentGel: 16_098, display: "16,098" });
  });

  test("refuses maps whose levels end in different years", () => {
    const older = facts.filter((fact) => !(/^\d{2}$/.test(fact.geographyId) && fact.year === 2026));
    expect(() => buildPopulationMapModels({ facts: older, regions, municipalities, densityUnit: "/km²" }))
      .toThrow(/Regions end in 2026 but municipalities in 2025/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/explorer/demographyPopulationMaps.test.ts`
Expected: FAIL (cannot resolve `demographyPopulationMaps`).

- [ ] **Step 3: Write the builder**

`apps/web/lib/explorer/demographyPopulationMaps.ts`:

```ts
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { formatInUnit, UNIT_DENSITY, UNIT_PERSONS } from "./format";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";
import { buildRegionValueMapModel, type RegionalEconomyMapModel } from "./regionalEconomyMap";

export type PopulationMapModels = {
  populationYear: number;
  densityYear: number;
  regionsPopulation: RegionalEconomyMapModel;
  regionsDensity: RegionalEconomyMapModel;
  municipalitiesPopulation: MunicipalityMapModel;
};

const isRegion = (id: string) => id.startsWith("region.");
const isMunicipality = (id: string) => /^\d{2}$/.test(id);

/** The values of one series for the places a map draws, in the latest year the series has them for those places. */
function latestValues(
  facts: readonly ServedDemographyObservation[],
  seriesId: string,
  isPlace: (id: string) => boolean,
) {
  const rows = facts.filter((fact) => fact.seriesId === seriesId && isPlace(fact.geographyId));
  if (rows.length === 0) throw new Error(`No ${seriesId} values for the map`);
  const year = Math.max(...rows.map((fact) => fact.year));
  return {
    year,
    values: new Map(rows.filter((fact) => fact.year === year).map((fact) => [fact.geographyId, fact.value])),
  };
}

export function buildPopulationMapModels({
  facts,
  regions,
  municipalities,
  densityUnit,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
  densityUnit: string;
}): PopulationMapModels {
  const regionPopulation = latestValues(facts, SERIES.populationTotal, isRegion);
  const municipalityPopulation = latestValues(facts, SERIES.populationTotal, isMunicipality);
  const regionDensity = latestValues(facts, SERIES.populationDensity, isRegion);
  if (municipalityPopulation.year !== regionPopulation.year) {
    throw new Error(`Regions end in ${regionPopulation.year} but municipalities in ${municipalityPopulation.year}`);
  }
  const persons = (_id: string, value: number) => formatInUnit(value, UNIT_PERSONS);
  const density = (_id: string, value: number) => `${formatInUnit(value, UNIT_DENSITY)} ${densityUnit}`;
  return {
    populationYear: regionPopulation.year,
    densityYear: regionDensity.year,
    regionsPopulation: buildRegionValueMapModel({
      values: regionPopulation.values,
      regions,
      year: regionPopulation.year,
      display: persons,
    }),
    regionsDensity: buildRegionValueMapModel({
      values: regionDensity.values,
      regions,
      year: regionDensity.year,
      display: density,
    }),
    municipalitiesPopulation: buildMunicipalityValueMapModel({
      municipalities,
      values: municipalityPopulation.values,
      display: persons,
    }),
  };
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/explorer/demographyPopulationMaps.test.ts && npm run typecheck`
Expected: 4 tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/explorer/demographyPopulationMaps.ts tests/explorer/demographyPopulationMaps.test.ts
git commit -m "feat(demography): server-built population and density map models" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Population Excel workbook

**Files:**
- Create: `apps/web/lib/explorer/demographyPopulationWorkbook.ts`
- Test: `apps/web/tests/explorer/demographyPopulationWorkbook.test.ts`

**Interfaces:**
- Consumes: `buildPopulationModel`, `populationBasisKey`, `PopulationState` (Task 8); `WorkbookExportModel`, `WorkbookPublicSource`, `SHEET_NAMES`, `withAbsoluteUrls`, `workbookFilename` from `workbookModel.ts`; message keys `demography.workbookTitle`, `.placeHeader`, `.levelHeader`, `.levelCountry`, `.levelRegion`, `.levelMunicipality`, `.populationHeader`, `.densityHeader`, `.basisHeader`, `.basisRetro`, `.basisPre`, `.basisCensus`, `.breakLabel`, `.unitPersons` (defined in Task 11).
- Produces: `buildPopulationWorkbookExportModel(facts, places, state, presentation, sources, siteOrigin): WorkbookExportModel`. Three sheets in the standard order. Readable sheet: selected places with whole persons and no change column. Data sheet: one row per year and selected place with columns Place, Level, Year, Population, Density (blank for municipalities and for years before 2014), Basis in plain words (the 2025 row also carries the short re-base label), Status. `numericFormats` keys are 1-based column numbers (`{ 4: "#,##0", 5: "#,##0.0" }`). The Sources sheet lists the population workbook, and the density workbook only when a Georgia or region row can carry density, each with the years inside the range.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/demographyPopulationWorkbook.test.ts`:

```ts
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { DEFAULT_POPULATION_STATE, type PopulationState } from "../../lib/explorer/demographyPopulation";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { ClientDemographyObservation } from "../../lib/servedRows";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];

const presentation = {
  locale: "en" as const,
  englishLabels: {},
  messages: {
    "demography.workbookTitle": "Population on 1 January",
    "demography.placeHeader": "Place",
    "demography.levelHeader": "Level",
    "demography.levelCountry": "Country",
    "demography.levelRegion": "Region",
    "demography.levelMunicipality": "Municipality",
    "demography.populationHeader": "Population (persons)",
    "demography.densityHeader": "Density (persons per km²)",
    "demography.basisHeader": "Basis",
    "demography.basisRetro": "re-estimated in 2018",
    "demography.basisPre": "estimated before the 2024 census",
    "demography.basisCensus": "based on the 2024 census",
    "demography.breakLabel": "Census re-base",
    "demography.unitPersons": "persons, 1 January",
  },
};
const sources = [
  { sourceId: "source.geostat_municipal_population", years: Array.from({ length: 23 }, (_, i) => 2004 + i), title: "Population by self-governed unit", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/population.xlsx" as const, retrievedAt: "2026-10-01" },
  { sourceId: "source.geostat_demography_density", years: Array.from({ length: 13 }, (_, i) => 2014 + i), title: "Density by regions", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/density.xlsx" as const, retrievedAt: "2026-10-03" },
  { sourceId: "unrelated", years: [2020], title: "Unrelated", organization: "Other", downloadHref: "/downloads/methodology/demography/files/unrelated.xlsx" as const, retrievedAt: "2026-10-03" },
];

const build = (patch: Partial<PopulationState> = {}, extra: Partial<typeof presentation> = {}) =>
  buildPopulationWorkbookExportModel(facts, places, { ...DEFAULT_POPULATION_STATE, ...patch }, { ...presentation, ...extra }, sources, "https://fiscal.ge");

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const labels = await getPresentation("en", [], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: labels.englishLabels,
    georgiaNameKa: "საქართველო",
  });
});

describe("population workbook", () => {
  test("Georgia over every year: sheets, columns, plain-language basis and the re-base flag", () => {
    const model = build();
    expect(model.filename).toBe("fiscal-demography-population-2004-2026-en.xlsx");
    expect(model.sheetNames).toEqual(["Summary", "Data", "Sources"]);
    expect(model.analysis.headers).toEqual(["Place", "Level", "Year", "Population (persons)", "Density (persons per km²)", "Basis", "Status"]);
    expect(model.analysis.rows[0]).toEqual(["Georgia", "Country", 2004, 3_937_716, null, "re-estimated in 2018", "Published"]);
    expect(model.analysis.rows.find((row) => row[2] === 2014)).toEqual(["Georgia", "Country", 2014, expect.any(Number), 65, "re-estimated in 2018", "Published"]);
    expect(model.analysis.rows.find((row) => row[2] === 2024)![5]).toBe("estimated before the 2024 census");
    expect(model.analysis.rows.find((row) => row[2] === 2025)![5]).toBe("based on the 2024 census · Census re-base");
    expect(model.analysis.rows.find((row) => row[2] === 2026)![5]).toBe("based on the 2024 census");
    expect(model.analysis.numericFormats).toEqual({ 4: "#,##0", 5: "#,##0.0" });
    expect(model.readable.rows[0]).toMatchObject({ kind: "total", label: "Georgia", change: null });
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(3_930_428);
    expect(model.readable.showChangeColumn).toBe(false);
    expect(model.readable.amountDecimals).toBe(0);
  });

  test("a municipality has no density; a region has it from 2015; a missing year is blank and says so", () => {
    const model = build({ selectedIds: ["11", "region.imereti"], range: { kind: "manual", start: 2014, end: 2016 } });
    const khulo = model.analysis.rows.filter((row) => row[0] === "Khulo");
    expect(khulo.every((row) => row[4] === null && row[1] === "Municipality")).toBe(true);
    const imereti = model.analysis.rows.filter((row) => row[0] === "Imereti");
    expect(imereti.find((row) => row[2] === 2014)).toEqual(["Imereti", "Region", 2014, null, null, "re-estimated in 2018", "Not available"]);
    expect(imereti.find((row) => row[2] === 2016)![4]).toEqual(expect.any(Number));
  });

  test("the English workbook carries no Georgian text", () => {
    const text = JSON.stringify(build({ selectedIds: [GEORGIA_PLACE_ID, "region.imereti", "11"] }));
    expect(text).not.toMatch(/[Ⴀ-ჿ]/);
  });

  test("sources: population always, density only when a Georgia or region row can carry it, years inside the range", () => {
    const georgia = build();
    expect(georgia.sources.map((source) => [source.title, source.years[0], source.years.at(-1)])).toEqual([
      ["Population by self-governed unit", 2004, 2026],
      ["Density by regions", 2014, 2026],
    ]);
    expect(georgia.sources[0]!.absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/demography/files/population.xlsx");
    expect(build({ selectedIds: ["11"] }).sources.map((source) => source.title)).toEqual(["Population by self-governed unit"]);
    expect(build({ range: { kind: "manual", start: 2004, end: 2010 } }).sources.map((source) => source.title)).toEqual(["Population by self-governed unit"]);
  });

  test("an empty selection exports no rows or sources", () => {
    const model = build({ selectedIds: [] });
    expect(model.readable.rows).toEqual([]);
    expect(model.analysis.rows).toEqual([]);
    expect(model.sources).toEqual([]);
  });

  test("the Georgian file name has no language suffix", () => {
    expect(build({}, { locale: "ka" as never }).filename).toBe("fiscal-demography-population-2004-2026.xlsx");
  });

  test("the written file has three sheets and numeric, formatted cells", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(build()));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    const data = workbook.getWorksheet("Data")!;
    expect(data.getCell("D2").value).toBe(3_937_716);
    expect(data.getCell("D2").numFmt).toBe("#,##0");
    expect(data.getCell("E2").value).toBeNull();
    expect(data.getCell("E12").numFmt).toBe("#,##0.0");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/explorer/demographyPopulationWorkbook.test.ts`
Expected: FAIL (cannot resolve `demographyPopulationWorkbook`).

- [ ] **Step 3: Write the workbook builder**

`apps/web/lib/explorer/demographyPopulationWorkbook.ts`:

```ts
import { CENSUS_STEP, SERIES } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientDemographyObservation } from "../servedRows";
import { placeLabel, type DemographyPlace } from "./demographyAreas";
import { buildPopulationModel, populationBasisKey, type PopulationState } from "./demographyPopulation";
import {
  SHEET_NAMES,
  withAbsoluteUrls,
  workbookFilename,
  type WorkbookExportModel,
  type WorkbookPublicSource,
} from "./workbookModel";

const POPULATION_SOURCE = "source.geostat_municipal_population";
const DENSITY_SOURCE = "source.geostat_demography_density";
const LEVEL_KEYS = { country: "levelCountry", region: "levelRegion", municipality: "levelMunicipality" } as const;

export function buildPopulationWorkbookExportModel(
  facts: readonly ClientDemographyObservation[],
  places: readonly DemographyPlace[],
  state: PopulationState,
  presentation: Presentation,
  sources: readonly (WorkbookPublicSource & { sourceId: string })[],
  siteOrigin: string,
): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const w = (key: Parameters<typeof workbookMessage>[1]) => workbookMessage(locale, key);
  const model = buildPopulationModel({ facts, places, state, locale });
  const densityByCell = new Map<string, number>();
  for (const fact of facts) {
    if (fact.seriesId === SERIES.populationDensity) densityByCell.set(`${fact.geographyId}:${fact.year}`, fact.value);
  }
  // Density is published for Georgia and the regions only.
  const densityAt = (place: DemographyPlace, year: number): number | null =>
    place.level === "municipality" ? null : (densityByCell.get(`${place.id}:${year}`) ?? null);

  const needed = new Set<string>();
  if (model.selected.length > 0) needed.add(POPULATION_SOURCE);
  if (model.selected.some((place) => model.years.some((year) => densityAt(place, year) !== null))) needed.add(DENSITY_SOURCE);
  const originals = sources
    .filter((source) => needed.has(source.sourceId))
    .map((source) => ({ ...source, years: source.years.filter((year) => model.years.includes(year)) }))
    .filter((source) => source.years.length > 0);

  const unitLabel = t("unitPersons");
  return {
    locale,
    filename: workbookFilename(`demography-population-${model.range.start}-${model.range.end}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t("workbookTitle"),
      subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel,
      amountDecimals: 0,
      showChangeColumn: false,
      years: model.years,
      rows: model.selected.map((place) => ({
        kind: place.level === "country" ? "total" : "item",
        parentLabel: null,
        label: placeLabel(place, locale),
        change: null,
        valuesByYear: Object.fromEntries(model.years.map((year) => [year, model.valueAt(place.id, year)])),
        basisByYear: Object.fromEntries(
          model.years.map((year) => [year, model.valueAt(place.id, year) === null ? null : ("published" as const)]),
        ),
      })),
    },
    analysis: {
      headers: [
        t("placeHeader"),
        t("levelHeader"),
        w("workbook.year"),
        t("populationHeader"),
        t("densityHeader"),
        t("basisHeader"),
        w("workbook.status"),
      ],
      rows: model.years.flatMap((year) =>
        model.selected.map((place) => {
          const persons = model.valueAt(place.id, year);
          const basis = message(messages, populationBasisKey(year));
          return [
            placeLabel(place, locale),
            t(LEVEL_KEYS[place.level]),
            year,
            persons,
            densityAt(place, year),
            // The re-base year is flagged in words, so a reader of the data sheet alone is warned.
            year === CENSUS_STEP.toYear ? `${basis} · ${t("breakLabel")}` : basis,
            w(persons === null ? "workbook.unavailable" : "workbook.published"),
          ];
        }),
      ),
      // Column numbers, counted from 1: Population and Density.
      numericFormats: { 4: "#,##0", 5: "#,##0.0" },
    },
    sources: withAbsoluteUrls(originals.map(({ sourceId: _sourceId, ...source }) => source), siteOrigin),
  };
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run tests/explorer/demographyPopulationWorkbook.test.ts && npm run typecheck`
Expected: 7 tests pass; typecheck clean. If `tsc` rejects the `basisByYear` or `kind` literal types, add `as const` to the offending literal; do not loosen the model types.

- [ ] **Step 5: Commit**

```bash
git add lib/explorer/demographyPopulationWorkbook.ts tests/explorer/demographyPopulationWorkbook.test.ts
git commit -m "feat(demography): population Excel workbook" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Messages and message scope

**Files:**
- Create: `apps/web/lib/i18n/messages/ka/demography.json`, `apps/web/lib/i18n/messages/en/demography.json`
- Modify: `apps/web/lib/i18n/types.ts` (`MESSAGE_SCOPES`), `apps/web/lib/i18n/messages.server.ts` (both dictionaries), `apps/web/lib/i18n/messages/ka/common.json`, `apps/web/lib/i18n/messages/en/common.json`
- Test: `apps/web/tests/i18n/demographyMessages.test.ts`

**Interfaces:**
- Produces: message scope `demography` (all keys `demography.*`), loaded with `getPresentation(locale, ["demography", ...], ids)`; `common.dataDemography` (sidebar rail label) and `common.demographyPopulation` (nested sidebar link). `common.demography` already exists. Every Georgian string below is a draft for the owner's review (foundation §9).

- [ ] **Step 1: Write the failing test**

`apps/web/tests/i18n/demographyMessages.test.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import { validateMessages } from "../../lib/i18n/validation";

// Keys chosen through a lookup table rather than a literal call (the workbook's level names).
const LOOKUP_KEYS = ["levelCountry", "levelRegion", "levelMunicipality"];

async function sourceFiles(): Promise<string[]> {
  const found: string[] = [];
  for (const dir of ["components/demography", "lib/explorer", "lib/pages"]) {
    let names: string[] = [];
    try {
      names = await readdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const name of names) {
      if (/\.tsx?$/.test(name) && (dir === "components/demography" || /demography/.test(path.basename(name)))) found.push(path.join(dir, name));
    }
  }
  return found;
}

describe("demography messages", () => {
  test("Georgian and English hold the same keys and parameters, and only demography keys", async () => {
    const [ka, en] = await Promise.all([getMessages("ka", ["demography"]), getMessages("en", ["demography"])]);
    expect(validateMessages(ka, en)).toEqual([]);
    expect(Object.keys(ka).every((key) => key.startsWith("demography."))).toBe(true);
  });

  test("every key the demography code asks for exists", async () => {
    const en = await getMessages("en", ["demography"]);
    const used = new Set<string>(LOOKUP_KEYS);
    for (const file of await sourceFiles()) {
      const code = await readFile(file, "utf8");
      for (const match of code.matchAll(/\bt\(\s*"([A-Za-z0-9]+)"/g)) used.add(match[1]!);
      for (const match of code.matchAll(/"demography\.([A-Za-z0-9]+)"/g)) used.add(match[1]!);
    }
    expect([...used].filter((key) => !Object.hasOwn(en, `demography.${key}`))).toEqual([]);
  });

  test("the sidebar labels exist in both languages", async () => {
    for (const locale of ["ka", "en"] as const) {
      const common = await getMessages(locale, ["common"]);
      expect(common["common.dataDemography"]?.trim()).toBeTruthy();
      expect(common["common.demographyPopulation"]?.trim()).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/i18n/demographyMessages.test.ts`
Expected: FAIL (`dictionaries[locale][scope] is not a function` for `demography`).

- [ ] **Step 3: Add the message files**

`apps/web/lib/i18n/messages/ka/demography.json`:

```json
{
  "demography.title": "დემოგრაფია",
  "demography.hubDescription": "საქართველოს მოსახლეობა, მისი ასაკი და სქესი, შობადობა, სიკვდილიანობა და მიგრაცია — საქსტატის ოფიციალური მონაცემები.",
  "demography.georgia": "საქართველო",
  "demography.georgiaPill": "საქართველო",
  "demography.populationTitle": "მოსახლეობა",
  "demography.populationDescription": "მოსახლეობა 1 იანვრის მდგომარეობით საქართველოში, 11 რეგიონსა და 64 მუნიციპალიტეტში; სიმჭიდროვე რუკაზე.",
  "demography.populationMetaTitle": "მოსახლეობა — დემოგრაფია",
  "demography.ageSexTitle": "ასაკი და სქესი",
  "demography.ageSexDescription": "მოსახლეობის ასაკობრივი და სქესობრივი შემადგენლობა.",
  "demography.migrationTitle": "მიგრაცია",
  "demography.migrationDescription": "შემოსული და გასული მიგრანტები მოქალაქეობის მიხედვით.",
  "demography.birthsDeathsTitle": "შობადობა და სიკვდილიანობა",
  "demography.birthsDeathsDescription": "დაბადებები, გარდაცვალებები, შობადობის კოეფიციენტი და სიცოცხლის ხანგრძლივობა.",
  "demography.cardFooter": "{year}: {persons} ადამიანი · {first}–{last}",
  "demography.unitLine": "ადამიანი, 1 იანვარს",
  "demography.coverage": "{first}–{last} · 1 იანვრის მდგომარეობით",
  "demography.tabRegions": "რეგიონები",
  "demography.tabMunicipalities": "მუნიციპალიტეტები",
  "demography.levelAria": "რუკის დონე",
  "demography.measureAria": "რუკის მაჩვენებელი",
  "demography.measurePopulation": "მოსახლეობა",
  "demography.measureDensity": "სიმჭიდროვე",
  "demography.densityRegionsOnly": "სიმჭიდროვე მხოლოდ საქართველოსა და რეგიონებისთვის ქვეყნდება.",
  "demography.mapAria": "{measure}, 1 იანვარი {year}",
  "demography.mapLegendPopulation": "ადამიანი, 1 იანვარი {year}",
  "demography.mapLegendDensity": "ადამიანი კმ²-ზე, 1 იანვარი {year}",
  "demography.densityUnit": "/კმ²",
  "demography.mapCensusNote": "2025 წლიდან მონაცემები 2024 წლის აღწერას ეყრდნობა და 2024 და 2025 წლის რუკები ერთმანეთს არ შეედრება, ამიტომ რუკები მხოლოდ უახლეს წელს აჩვენებს.",
  "demography.densityNote": "სიმჭიდროვე არის მოსახლეობა 1 იანვარს გაყოფილი ერთ ფიქსირებულ ფართობზე (2014 წლის მარტი, ოკუპირებული ტერიტორიების გარეშე). თბილისის ფართობი საქსტატის მეთოდით {area} კმ²-ია და არა ხშირად დასახელებული 726 კმ².",
  "demography.rowYear": "მოსახლეობა 1 იანვარს, {year}",
  "demography.placeHeader": "ადგილი",
  "demography.alsoRegion": "ასევე რეგიონია",
  "demography.rangeChanged": "პერიოდი {start}–{end}",
  "demography.breakLabel": "აღწერით გადათვლა",
  "demography.censusNote": "2025 წლის 1 იანვარს საქსტატმა მოსახლეობა 2024 წლის აღწერაზე დააფუძნა და დაახლოებით {count} ადამიანი დაამატა. ამ თარიღამდე და მის შემდეგ მონაცემები სხვადასხვა საფუძველზეა და ერთმანეთს არ შედარდება.",
  "demography.basisRetro": "2018 წელს ხელახლა შეფასებული",
  "demography.basisPre": "2024 წლის აღწერამდე შეფასებული",
  "demography.basisCensus": "2024 წლის აღწერაზე დაფუძნებული",
  "demography.tableCaption": "მოსახლეობა 1 იანვარს",
  "demography.source": "წყარო: საქსტატი — მოსახლეობა 1 იანვრის მდგომარეობით და სიმჭიდროვე რეგიონების მიხედვით, {start}–{end}. წილები და ადგილები გამოთვლილია Fiscal.ge-ის მიერ.",
  "demography.highlights": "ძირითადი ინდიკატორები",
  "demography.heroLabel": "მოსახლეობა · {place}",
  "demography.heroBasis": "1 იანვარი {year} · {basis}",
  "demography.shareOfGeorgia": "{share} საქართველოს მოსახლეობიდან",
  "demography.shareOfRegion": "{share} რეგიონის მოსახლეობიდან ({region})",
  "demography.regionalFrom": "რეგიონული მონაცემები {year} წლიდან ქვეყნდება",
  "demography.sideLargestRegion": "უდიდესი რეგიონი",
  "demography.sideDensestRegion": "ყველაზე მჭიდროდ დასახლებული რეგიონი",
  "demography.sideSmallestMunicipality": "უმცირესი მუნიციპალიტეტი",
  "demography.sideRank": "ადგილი რეგიონებს შორის",
  "demography.sideRankMunicipalities": "ადგილი მუნიციპალიტეტებს შორის",
  "demography.sideDensity": "სიმჭიდროვე",
  "demography.densityRank": "ადგილი {rank} / {of}",
  "demography.sideMunicipalities": "მუნიციპალიტეტები",
  "demography.sideShareOfGeorgia": "წილი საქართველოში",
  "demography.sideRegion": "რეგიონი",
  "demography.byPopulation": "მოსახლეობით",
  "demography.highlightsNote": "ინდიკატორები არჩეული პირველი ადგილის მონაცემებს აჩვენებს პერიოდის ბოლო წლისთვის. ცვლილება არ ითვლება: 2025 წლიდან მონაცემები 2024 წლის აღწერას ეყრდნობა.",
  "demography.workbookTitle": "მოსახლეობა 1 იანვრის მდგომარეობით",
  "demography.levelHeader": "დონე",
  "demography.levelCountry": "ქვეყანა",
  "demography.levelRegion": "რეგიონი",
  "demography.levelMunicipality": "მუნიციპალიტეტი",
  "demography.populationHeader": "მოსახლეობა (ადამიანი)",
  "demography.densityHeader": "სიმჭიდროვე (ადამიანი კმ²-ზე)",
  "demography.basisHeader": "შეფასების საფუძველი",
  "demography.unitPersons": "ადამიანი, 1 იანვარს"
}
```

`apps/web/lib/i18n/messages/en/demography.json`:

```json
{
  "demography.title": "Demography",
  "demography.hubDescription": "Georgia's population, its age and sex, births, deaths and migration — official Geostat data.",
  "demography.georgia": "Georgia",
  "demography.georgiaPill": "Georgia",
  "demography.populationTitle": "Population",
  "demography.populationDescription": "Population on 1 January for Georgia, its 11 regions and 64 municipalities, with density on the map.",
  "demography.populationMetaTitle": "Population — Demography",
  "demography.ageSexTitle": "Age and sex",
  "demography.ageSexDescription": "The age and sex structure of the population.",
  "demography.migrationTitle": "Migration",
  "demography.migrationDescription": "Immigrants and emigrants by citizenship.",
  "demography.birthsDeathsTitle": "Births, deaths and fertility",
  "demography.birthsDeathsDescription": "Births, deaths, the birth rate and life expectancy.",
  "demography.cardFooter": "{year}: {persons} people · {first}–{last}",
  "demography.unitLine": "persons, on 1 January",
  "demography.coverage": "{first}–{last} · as of 1 January",
  "demography.tabRegions": "Regions",
  "demography.tabMunicipalities": "Municipalities",
  "demography.levelAria": "Map level",
  "demography.measureAria": "Map measure",
  "demography.measurePopulation": "Population",
  "demography.measureDensity": "Density",
  "demography.densityRegionsOnly": "Density is published for Georgia and the regions only.",
  "demography.mapAria": "{measure}, 1 January {year}",
  "demography.mapLegendPopulation": "persons, 1 January {year}",
  "demography.mapLegendDensity": "persons per km², 1 January {year}",
  "demography.densityUnit": "/km²",
  "demography.mapCensusNote": "From 2025 the figures are based on the 2024 census, and maps for 2024 and 2025 are not comparable, so the maps show the latest year only.",
  "demography.densityNote": "Density is the 1 January population divided by one fixed area as of March 2014, occupied territories excluded. Tbilisi is {area} km² in Geostat's convention, not the 726 km² often cited.",
  "demography.rowYear": "Population on 1 January {year}",
  "demography.placeHeader": "Place",
  "demography.alsoRegion": "also a region",
  "demography.rangeChanged": "Period {start}–{end}",
  "demography.breakLabel": "Census re-base",
  "demography.censusNote": "On 1 January 2025 Geostat re-based the population to the 2024 census, adding about {count} people. Figures before and after are on different bases and are not compared.",
  "demography.basisRetro": "re-estimated in 2018",
  "demography.basisPre": "estimated before the 2024 census",
  "demography.basisCensus": "based on the 2024 census",
  "demography.tableCaption": "Population on 1 January",
  "demography.source": "Source: Geostat — population on 1 January and density by region, {start}–{end}. Shares and ranks are computed by Fiscal.ge.",
  "demography.highlights": "Key indicators",
  "demography.heroLabel": "Population · {place}",
  "demography.heroBasis": "1 January {year} · {basis}",
  "demography.shareOfGeorgia": "{share} of Georgia's population",
  "demography.shareOfRegion": "{share} of the region's population ({region})",
  "demography.regionalFrom": "Regional figures start in {year}",
  "demography.sideLargestRegion": "Largest region",
  "demography.sideDensestRegion": "Densest region",
  "demography.sideSmallestMunicipality": "Smallest municipality",
  "demography.sideRank": "Rank among regions",
  "demography.sideRankMunicipalities": "Rank among municipalities",
  "demography.sideDensity": "Density",
  "demography.densityRank": "rank {rank} of {of}",
  "demography.sideMunicipalities": "Municipalities",
  "demography.sideShareOfGeorgia": "Share of Georgia",
  "demography.sideRegion": "Region",
  "demography.byPopulation": "by population",
  "demography.highlightsNote": "The indicators describe the first selected place for the last year of the period. No change is computed: from 2025 the figures are based on the 2024 census.",
  "demography.workbookTitle": "Population on 1 January",
  "demography.levelHeader": "Level",
  "demography.levelCountry": "Country",
  "demography.levelRegion": "Region",
  "demography.levelMunicipality": "Municipality",
  "demography.populationHeader": "Population (persons)",
  "demography.densityHeader": "Density (persons per km²)",
  "demography.basisHeader": "Basis",
  "demography.unitPersons": "persons, 1 January"
}
```

- [ ] **Step 4: Register the scope and the sidebar labels**

In `apps/web/lib/i18n/types.ts` add `"demography"` as the last entry of `MESSAGE_SCOPES` (after `"inflation"`). In `apps/web/lib/i18n/messages.server.ts` add `demography: () => import("./messages/ka/demography.json"),` after the `inflation:` line of the `ka` dictionary and `demography: () => import("./messages/en/demography.json"),` after the `inflation:` line of the `en` dictionary.

In `apps/web/lib/i18n/messages/ka/common.json` add a comma after the last entry (`"common.inflationCities": "ქალაქები"`) and append:

```json
  "common.dataDemography": "მონაცემები · დემოგრაფია",
  "common.demographyPopulation": "მოსახლეობა"
```

In `apps/web/lib/i18n/messages/en/common.json` the same after `"common.inflationCities": "Cities"`:

```json
  "common.dataDemography": "Data · Demography",
  "common.demographyPopulation": "Population"
```

- [ ] **Step 5: Run the tests, the localisation check and the typecheck**

Run: `npx vitest run tests/i18n/demographyMessages.test.ts tests/i18n && npm run i18n:check && npm run typecheck`
Expected: PASS (the code-scan test finds no demography code yet, so it checks only the lookup keys); `i18n:check` prints `Translation catalogue and registered messages valid`.

- [ ] **Step 6: Commit**

```bash
git add lib/i18n tests/i18n/demographyMessages.test.ts
git commit -m "feat(demography): message scope with Georgian drafts and English" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: The Population explorer (map block, workspace, highlights)

**Files:**
- Modify: `apps/web/components/explorer-shell/measure-pill.tsx` (optional `testId`), `apps/web/components/ui/editorial.tsx` (`SegmentedTabs` option `disabled`)
- Create: `apps/web/components/demography/use-population-state.ts`, `population-series-panel.tsx`, `population-highlights.tsx`, `population-explorer.tsx`
- Test: `apps/web/tests/explorer/controlAdditions.test.tsx`, `apps/web/tests/explorer/populationExplorer.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4–11. `PopulationExplorer` props: `{ facts: ClientDemographyObservation[]; places: DemographyPlace[]; maps: PopulationMapModels; tbilisiArea: string; sources: (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string }`; it must be rendered inside `I18nProvider` with the scopes `demography`, `common`, `controls`, `main`, `format`, `workbook` and `municipal` (`MunicipalityMap` always prints `municipal.cities` under its legend, and `message()` throws on a key that is not loaded).
- Produces: `PopulationExplorer` (named export of `population-explorer.tsx`), `usePopulationState(validIds)` returning `{ state, update }`, `PopulationSeriesPanel`, `PopulationHighlightsSection`. Test ids: `population-explorer`, `population-map-block`, `population-georgia-pill`, `population-level-regions`, `population-level-municipalities`, `population-measure-population`, `population-measure-density`, `population-density-note`, `population-chart-panel`, `population-mode-line`, `population-mode-table`, `population-excel-download`, `population-highlights`, `population-tab-regions`, `population-tab-municipalities`. `validIds` passed to the hook must be referentially stable (the explorer memoises it).

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/explorer/controlAdditions.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MeasurePill } from "../../components/explorer-shell/measure-pill";
import { SegmentedTabs } from "../../components/ui/editorial";

const options = [
  { value: "a", label: "A", testId: "tab-a" },
  { value: "b", label: "B", testId: "tab-b" },
];

describe("optional control additions", () => {
  test("an option can be disabled and every other option renders as before", () => {
    const plain = renderToStaticMarkup(<SegmentedTabs ariaLabel="x" value="a" onChange={() => {}} options={options} />);
    const withDisabled = renderToStaticMarkup(
      <SegmentedTabs ariaLabel="x" value="a" onChange={() => {}} options={[options[0]!, { ...options[1]!, disabled: true }]} />,
    );
    expect(plain).not.toContain("disabled");
    expect(plain).toContain("cursor-pointer");
    expect(withDisabled.match(/disabled=""/g)).toHaveLength(1);
    expect(withDisabled).toMatch(/data-testid="tab-b"[^>]*disabled=""|disabled=""[^>]*data-testid="tab-b"/);
    expect(withDisabled).toContain("cursor-not-allowed");
  });

  test("the pill keeps its test id unless it is given another", () => {
    expect(renderToStaticMarkup(<MeasurePill label="x" pressed onChange={() => {}} />)).toContain('data-testid="measure-share-toggle"');
    expect(renderToStaticMarkup(<MeasurePill label="x" pressed onChange={() => {}} testId="georgia-pill" />)).toContain('data-testid="georgia-pill"');
  });
});
```

`apps/web/tests/explorer/populationExplorer.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));

import { PopulationExplorer } from "../../components/demography/population-explorer";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces } from "../../lib/explorer/demographyAreas";
import { buildPopulationMapModels } from "../../lib/explorer/demographyPopulationMaps";
import { message } from "../../lib/i18n/messages";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";

let html: string;
const count = (token: RegExp) => (html.match(token) ?? []).length;

beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const presentation = await getPresentation("en", ["demography", "common", "controls", "main", "format", "workbook", "municipal"], ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: message(presentation.messages, "demography.georgia"),
  });
  const maps = buildPopulationMapModels({
    facts,
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    densityUnit: message(presentation.messages, "demography.densityUnit"),
  });
  html = renderToStaticMarkup(
    <I18nProvider {...presentation}>
      <PopulationExplorer facts={facts.map(projectDemographyObservation)} places={places} maps={maps} tbilisiArea="504.24" sources={[]} siteOrigin="https://fiscal.ge" />
    </I18nProvider>,
  );
});

describe("Population explorer, first render", () => {
  test("opens on the region map with the Georgia pill pressed and density available", () => {
    expect(count(/data-region-map-target=""/g)).toBe(11);
    expect(html).not.toContain("/explorer/economy/regions/");
    expect(html).toMatch(/data-testid="population-georgia-pill"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-testid="population-georgia-pill"/);
    expect(html).toContain('data-testid="population-level-municipalities"');
    expect(html).not.toMatch(/data-testid="population-measure-density"[^>]*disabled=""/);
    expect(html).not.toContain('data-testid="population-density-note"');
    expect(html).toContain("persons, 1 January 2026");
  });

  test("lists Georgia and the 11 regions with full persons and Georgia selected", () => {
    expect(count(/data-testid="series-row"/g)).toBe(12);
    expect(html).toContain("3,941,103");
    expect(html).toMatch(/1\s*\/\s*12/);
    expect(html).toContain('data-testid="population-tab-municipalities"');
  });

  test("draws the chart with the labelled census gap and notes the re-base in words", () => {
    expect(html).toContain('role="img"');
    expect(count(/data-testid="chart-break"/g)).toBe(1);
    expect(html).toContain("Census re-base");
    expect(html).toContain("226,000");
    expect(html).toContain("Geostat re-based the population to the 2024 census");
  });

  test("highlights Georgia in 2026 without any change figure", () => {
    expect(html).toContain('data-testid="population-highlights"');
    expect(html).toContain("1 January 2026 · based on the 2024 census");
    expect(html).toContain("Largest region");
    expect(html).toContain("Densest region");
    expect(html).toContain("Smallest municipality");
    expect(html).toContain("1,369,356");
    expect(html).not.toMatch(/[+−]\d+(\.\d+)?%/);
  });

  test("offers the Excel download and states the source", () => {
    expect(html).toContain('data-testid="population-excel-download"');
    expect(html).not.toMatch(/data-testid="population-excel-download"[^>]*disabled=""/);
    expect(html).toContain("Source: Geostat");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/explorer/controlAdditions.test.tsx tests/explorer/populationExplorer.test.tsx`
Expected: FAIL (`testId` and `disabled` are ignored; `population-explorer` does not exist).

- [ ] **Step 3: Two optional control additions**

In `apps/web/components/explorer-shell/measure-pill.tsx` replace the whole component with:

```tsx
/** The pill that switches the chart between GEL and a share of GDP (or, with another label, any either/or). */
export function MeasurePill({ label, pressed, onChange, testId = "measure-share-toggle" }: { label: string; pressed: boolean; onChange: (next: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={`h-[27px] flex-none cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors duration-150 ${
        pressed
          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
          : "border-[var(--control)] bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}
```

In `apps/web/components/ui/editorial.tsx`, in `SegmentedTabsProps` change the `options` element type to `{ value: T; label: string; icon?: ReactNode; testId?: string; ariaLabel?: string; disabled?: boolean }`; in the option `<button>` add `disabled={option.disabled}` after `aria-pressed={active}`; at the start of its template-literal `className` replace `cursor-pointer ` with `${option.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"} `; and replace the inactive branch string `"bg-transparent text-[var(--muted)] hover:bg-[var(--tint)] hover:text-[var(--ink)]"` with `option.disabled ? "bg-transparent text-[var(--muted)]" : "bg-transparent text-[var(--muted)] hover:bg-[var(--tint)] hover:text-[var(--ink)]"`. An enabled option's markup is byte-for-byte what it was.

- [ ] **Step 4: The hash-state hook**

`apps/web/components/demography/use-population-state.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_POPULATION_STATE,
  parsePopulationHash,
  serializePopulationHash,
  type PopulationState,
} from "../../lib/explorer/demographyPopulation";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";

/**
 * URL-hash state as DESIGN.md §6.3 sets it (the `inflation-cities.tsx` pattern): the server renders
 * the default, the hash is read once after hydration, loading never writes the URL, and every later
 * change replaces the history entry through the shared `useReplaceHash`.
 */
export function usePopulationState(validIds: readonly string[]) {
  const [state, setState] = useState<PopulationState>(DEFAULT_POPULATION_STATE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(parsePopulationHash(window.location.hash, validIds));
    setReady(true);
  }, [validIds]);
  useAppReady();
  useReplaceHash(serializePopulationHash(state), ready);
  const update = useCallback((change: (previous: PopulationState) => PopulationState) => setState(change), []);
  return { state, update };
}
```

- [ ] **Step 5: The places list**

`apps/web/components/demography/population-series-panel.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  placeColor,
  placeLabel,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import type { PopulationLevel } from "../../lib/explorer/demographyPopulation";
import { formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { TemplateValues } from "../../lib/i18n/types";
import { SeriesAside } from "../explorer-shell/series-aside";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { TextTab } from "../ui/editorial";

/**
 * The places list: the standard series panel with the two levels as grouping tabs. Ticking a place
 * adds a line to the chart; choosing on a map replaces the selection (the explorer owns that rule).
 * Select all and clear act on the active tab only, never on the search result.
 */
export function PopulationSeriesPanel({
  places,
  listed,
  level,
  selectedIds,
  endYear,
  endValues,
  onLevelChange,
  onToggle,
  onSetTabSelection,
  downloadAction,
}: {
  places: readonly DemographyPlace[];
  listed: readonly DemographyPlace[];
  level: PopulationLevel;
  selectedIds: readonly string[];
  endYear: number;
  endValues: Readonly<Record<string, number | null>>;
  onLevelChange: (level: PopulationLevel) => void;
  onToggle: (id: string) => void;
  onSetTabSelection: (selected: boolean) => void;
  downloadAction: ReactNode;
}) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [query, setQuery] = useState("");
  const byId = new Map(places.map((place) => [place.id, place]));
  const matches = (place: DemographyPlace) => {
    const region = place.regionId === null ? undefined : byId.get(place.regionId);
    return matchesLabelQuery(query, [place.nameKa, place.nameEn, region?.nameKa ?? "", region?.nameEn ?? ""]);
  };
  const visible = listed.filter((place) => place.id === GEORGIA_PLACE_ID || matches(place));
  const selectedHere = listed.filter((place) => selectedIds.includes(place.id)).length;
  const hasSelection = selectedHere > 0;

  return (
    <SeriesAside label={message(messages, "controls.series")}>
      <p className="mb-3 text-[11px] text-[var(--muted)]">{t("rowYear", { year: endYear })}</p>
      <SeriesSelector
        controls={
          <div className="flex gap-[18px] border-b border-[var(--row-border)] pb-3">
            <TextTab label={t("tabRegions")} active={level === "regions"} onClick={() => onLevelChange("regions")} testId="population-tab-regions" />
            <TextTab label={t("tabMunicipalities")} active={level === "municipalities"} onClick={() => onLevelChange("municipalities")} testId="population-tab-municipalities" />
          </div>
        }
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={selectedHere}
        totalCount={listed.length}
        supplementalSelected={{
          label: t(level === "regions" ? "tabMunicipalities" : "tabRegions"),
          count: selectedIds.length - selectedHere,
        }}
        hasSelection={hasSelection}
        allSelected={listed.every((place) => selectedIds.includes(place.id))}
        onToggleAll={() => onSetTabSelection(!hasSelection)}
        hasVisibleMatches={listed.some(matches)}
      >
        {visible.map((place) => {
          const label = placeLabel(place, locale);
          return (
            <SeriesSelectorRow
              key={place.id}
              id={place.id}
              label={place.id === TBILISI_PLACE_ID && level === "municipalities" ? `${label} · ${t("alsoRegion")}` : label}
              color={placeColor(place)}
              value={formatInUnit(endValues[place.id] ?? null, UNIT_PERSONS)}
              selected={selectedIds.includes(place.id)}
              level={place.id === GEORGIA_PLACE_ID ? "total" : "item"}
              wrapLabel
              onToggle={() => onToggle(place.id)}
            />
          );
        })}
      </SeriesSelector>
      {downloadAction}
    </SeriesAside>
  );
}
```

- [ ] **Step 6: The highlights**

`apps/web/components/demography/population-highlights.tsx`:

```tsx
"use client";

import { placeColor, placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { populationBasisKey, type PopulationHighlights } from "../../lib/explorer/demographyPopulation";
import { formatInUnit, formatShare, MISSING, UNIT_DENSITY, UNIT_PERSONS } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";

type Figure = { place: DemographyPlace; value: number; trend: Array<number | null> };

/** The hero and side KPIs the explorers share, describing the first selected place; nothing here is a change over time. */
export function PopulationHighlightsSection({ highlights }: { highlights: PopulationHighlights }) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const ink = "var(--ink)";
  const persons = (value: number | null) => formatInUnit(value, UNIT_PERSONS);
  const name = (place: DemographyPlace) => placeLabel(place, locale);
  const regionalFromNote = highlights.regionalFrom === null ? "" : t("regionalFrom", { year: highlights.regionalFrom });

  const figureKpi = (
    label: string,
    figure: Figure | null,
    value: (figure: Figure) => string,
    unit: string,
    detail: (figure: Figure) => string,
  ): SideKpi => ({
    label,
    value: figure ? value(figure) : MISSING,
    unit: figure ? unit : "",
    color: ink,
    detail: figure ? detail(figure) : regionalFromNote,
    wrapDetail: true,
    spark: figure ? { values: figure.trend, color: placeColor(figure.place) } : null,
  });

  let side: SideKpi[];
  let shareLine = "";
  if (highlights.kind === "country") {
    const georgia = highlights.persons;
    side = [
      figureKpi(t("sideLargestRegion"), highlights.largestRegion, (f) => persons(f.value), "", (f) =>
        georgia === null ? name(f.place) : `${name(f.place)} · ${formatShare(f.value / georgia)}`),
      figureKpi(t("sideDensestRegion"), highlights.densestRegion, (f) => formatInUnit(f.value, UNIT_DENSITY), t("densityUnit"), (f) => name(f.place)),
      figureKpi(t("sideSmallestMunicipality"), highlights.smallestMunicipality, (f) => persons(f.value), "", (f) => name(f.place)),
    ];
  } else if (highlights.kind === "region") {
    if (highlights.shareOfGeorgia !== null) shareLine = t("shareOfGeorgia", { share: formatShare(highlights.shareOfGeorgia) });
    side = [
      {
        label: t("sideRank"),
        value: highlights.rank === null ? MISSING : String(highlights.rank),
        unit: highlights.rank === null ? "" : `/ ${highlights.ofRegions}`,
        color: ink,
        detail: highlights.rank === null ? regionalFromNote : t("byPopulation"),
        spark: null,
      },
      {
        label: t("sideDensity"),
        value: highlights.density === null ? MISSING : formatInUnit(highlights.density, UNIT_DENSITY),
        unit: highlights.density === null ? "" : t("densityUnit"),
        color: ink,
        detail: highlights.densityRank === null ? regionalFromNote : t("densityRank", { rank: highlights.densityRank, of: highlights.ofRegions }),
        spark: { values: highlights.densityTrend, color: placeColor(highlights.place) },
      },
      { label: t("sideMunicipalities"), value: String(highlights.municipalityCount), unit: "", color: ink, detail: "", spark: null },
    ];
  } else {
    if (highlights.shareOfRegion !== null && highlights.region) {
      shareLine = t("shareOfRegion", { share: formatShare(highlights.shareOfRegion), region: name(highlights.region) });
    }
    side = [
      {
        label: t("sideRankMunicipalities"),
        value: highlights.rank === null ? MISSING : String(highlights.rank),
        unit: highlights.rank === null ? "" : `/ ${highlights.ofMunicipalities}`,
        color: ink,
        detail: highlights.rank === null ? regionalFromNote : t("byPopulation"),
        spark: null,
      },
      { label: t("sideShareOfGeorgia"), value: formatShare(highlights.shareOfGeorgia), unit: "", color: ink, detail: "", spark: null },
      {
        label: t("sideRegion"),
        value: persons(highlights.regionPersons),
        unit: "",
        color: ink,
        detail: highlights.region ? name(highlights.region) : "",
        wrapDetail: true,
        spark: null,
      },
    ];
  }

  const unavailable = highlights.persons === null && highlights.kind !== "country" ? regionalFromNote : "";
  return (
    <section data-testid="population-highlights" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <p className="text-[12.5px] text-[var(--muted)]">{t("rowYear", { year: highlights.year })}</p>
      </div>
      <div className={KPI_GRID_CLASS}>
        <HeroKpi label={t("heroLabel", { place: name(highlights.place) })} value={persons(highlights.persons)}>
          <p className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--muted)]">
            {t("heroBasis", { year: highlights.year, basis: message(messages, populationBasisKey(highlights.year)) })}
          </p>
          {shareLine ? <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">{shareLine}</p> : null}
          {unavailable ? <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">{unavailable}</p> : null}
          <Sparkline values={highlights.trend} color={placeColor(highlights.place)} />
        </HeroKpi>
        <SideKpiList kpis={side} />
      </div>
      <div className="mt-5"><SourceNote>{t("highlightsNote")}</SourceNote></div>
    </section>
  );
}
```

- [ ] **Step 7: The explorer**

`apps/web/components/demography/population-explorer.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CENSUS_STEP } from "../../lib/data/demography/series";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  municipalityCodeForPlaceId,
  placeIdForMunicipalityCode,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import {
  buildPopulationHighlights,
  buildPopulationModel,
  changeLevel,
  changeMeasure,
  chooseGeorgia,
  chooseOnMap,
  populationBasisKey,
  setTabSelection,
  toggleSelected,
} from "../../lib/explorer/demographyPopulation";
import type { PopulationMapModels } from "../../lib/explorer/demographyPopulationMaps";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { formatInUnit, thousandsUnit, UNIT_DENSITY, UNIT_PERSONS } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { MeasurePill } from "../explorer-shell/measure-pill";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { MunicipalityMap } from "../municipalities/municipality-map";
import { RegionalEconomyMap } from "../regional-economies/regional-economy-map";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { PopulationHighlightsSection } from "./population-highlights";
import { PopulationSeriesPanel } from "./population-series-panel";
import { usePopulationState } from "./use-population-state";

export function PopulationExplorer({
  facts,
  places,
  maps,
  tbilisiArea,
  sources,
  siteOrigin,
}: {
  facts: ClientDemographyObservation[];
  places: DemographyPlace[];
  maps: PopulationMapModels;
  /** Tbilisi's area in km² as the reviewed density mapping records it, already formatted (the page reads it, the note prints it). */
  tbilisiArea: string;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const validIds = useMemo(() => places.map((place) => place.id), [places]);
  const { state, update } = usePopulationState(validIds);
  const model = useMemo(() => buildPopulationModel({ facts, places, state, locale }), [facts, places, state, locale]);
  const highlights = useMemo(() => buildPopulationHighlights(model, facts, places), [model, facts, places]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const regions = state.level === "regions";
  const density = regions && state.map === "density";
  const mapYear = density ? maps.densityYear : maps.populationYear;
  const mapUnit = density ? UNIT_DENSITY : UNIT_PERSONS;
  const mapCaption = t(density ? "mapLegendDensity" : "mapLegendPopulation", { year: mapYear });
  const mapAria = t("mapAria", { measure: t(density ? "measureDensity" : "measurePopulation"), year: mapYear });
  const regionModel = density ? maps.regionsDensity : maps.regionsPopulation;
  const municipalityModel = maps.municipalitiesPopulation;
  const selectedRegionIds = state.selectedIds.filter((id) => id.startsWith("region."));
  const selectedCodes = state.selectedIds
    .filter((id) => id === TBILISI_PLACE_ID || places.find((place) => place.id === id)?.level === "municipality")
    .map(municipalityCodeForPlaceId);
  const onlyGeorgia = state.selectedIds.length === 1 && state.selectedIds[0] === GEORGIA_PLACE_ID;
  const breakLabel = t("breakLabel");
  const georgiaRow = model.rows.find((row) => row.itemId === GEORGIA_PLACE_ID) ?? null;
  const rebase = formatInUnit(Math.round(CENSUS_STEP.residual / 1000) * 1000, UNIT_PERSONS);

  return (
    <div data-testid="population-explorer" className="@container">
      <section data-testid="population-map-block" className="mb-10 max-w-[820px]">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <MeasurePill
            testId="population-georgia-pill"
            label={t("georgiaPill")}
            pressed={onlyGeorgia}
            onChange={() => update(chooseGeorgia)}
          />
          <SegmentedTabs
            ariaLabel={t("levelAria")}
            value={state.level}
            onChange={(level) => update((previous) => changeLevel(previous, level))}
            options={[
              { value: "regions", label: t("tabRegions"), testId: "population-level-regions" },
              { value: "municipalities", label: t("tabMunicipalities"), testId: "population-level-municipalities" },
            ]}
          />
          <SegmentedTabs
            ariaLabel={t("measureAria")}
            value={state.map}
            onChange={(map) => update((previous) => changeMeasure(previous, map))}
            options={[
              { value: "population", label: t("measurePopulation"), testId: "population-measure-population" },
              { value: "density", label: t("measureDensity"), testId: "population-measure-density", disabled: !regions },
            ]}
          />
        </div>
        {!regions ? (
          <p data-testid="population-density-note" className="mb-2 text-[12px] text-[var(--muted)]">{t("densityRegionsOnly")}</p>
        ) : null}
        {regions ? (
          <RegionalEconomyMap
            model={regionModel}
            activeRegionId={activeRegionId}
            onActiveRegionChange={setActiveRegionId}
            onSelect={(regionId) => update((previous) => chooseOnMap(previous, regionId))}
            selectedIds={selectedRegionIds}
            wording={{
              groupAria: mapAria,
              legendMin: formatInUnit(regionModel.legendMinGel, mapUnit),
              legendMax: formatInUnit(regionModel.legendMaxGel, mapUnit),
              legendCaption: mapCaption,
            }}
          />
        ) : (
          <MunicipalityMap
            viewBox={municipalityModel.viewBox}
            shapes={municipalityModel.shapes}
            markers={municipalityModel.markers}
            occupiedAreas={municipalityModel.occupiedAreas}
            legendMin={formatInUnit(municipalityModel.legendMinPerResidentGel, UNIT_PERSONS)}
            legendMax={formatInUnit(municipalityModel.legendMaxPerResidentGel, UNIT_PERSONS)}
            activeCode={activeCode}
            onActiveCodeChange={setActiveCode}
            onOpenMunicipality={(code) => update((previous) => chooseOnMap(previous, placeIdForMunicipalityCode(code)))}
            selectedCodes={selectedCodes}
            wording={{ groupAria: mapAria, legendCaption: mapCaption }}
          />
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("mapCensusNote")}</p>
        {density ? <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{t("densityNote", { area: tbilisiArea })}</p> : null}
      </section>

      <p role="status" className="sr-only">{t("rangeChanged", { start: model.range.start, end: model.range.end })}</p>
      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="population-chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedTabs
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => update((previous) => ({ ...previous, mode }))}
                options={[
                  { value: "line", label: message(messages, "controls.chart"), testId: "population-mode-line" },
                  { value: "table", label: message(messages, "controls.table"), testId: "population-mode-table" },
                ]}
              />
            </div>
            {!state.selectedIds.length ? (
              <div className="mt-5"><Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout></div>
            ) : !model.hasData ? (
              <div className="mt-5"><Callout testId="no-range-data-callout">{message(messages, "main.noRangeData")}</Callout></div>
            ) : state.mode === "line" ? (
              <div className="mt-5">
                <EditorialLineChart
                  years={model.years}
                  series={model.series}
                  share={false}
                  unit={thousandsUnit(locale)}
                  shareLabel=""
                  formatTooltipValue={(value) => formatInUnit(value, UNIT_PERSONS)}
                  formatPeriod={(period, kind) =>
                    kind === "axis" ? String(period) : `${period} · ${message(messages, populationBasisKey(period))}`}
                  breaks={[{ year: CENSUS_STEP.toYear, label: breakLabel }]}
                />
              </div>
            ) : (
              <ExplorerTable
                caption={`${t("tableCaption")} · ${model.range.start}–${model.range.end} · ${t("censusNote", { count: rebase })}`}
                rows={model.rows.filter((row) => row.itemId !== GEORGIA_PLACE_ID)}
                totalRow={georgiaRow}
                showTotal={Boolean(georgiaRow)}
                totalFirst
                wrapRowLabels
                years={model.years}
                firstColumnLabel={t("placeHeader")}
                unit={UNIT_PERSONS}
                share={false}
                showChangeColumn={false}
                rowLabelsLocalized
                breakYears={[CENSUS_STEP.toYear]}
                breakLabel={breakLabel}
                shareValueForYear={() => null}
              />
            )}
            <RangeStrip
              years={model.availableYears}
              range={model.range}
              marker={{ year: CENSUS_STEP.toYear, label: breakLabel }}
              onChange={(patch) => update((previous) => ({ ...previous, range: rangeFromPatch(model.range, patch) }))}
            />
          </section>
          <div className="mt-[18px]">
            <SourceNote testId="population-source-note">
              {t("source", { start: model.range.start, end: model.range.end })}{" "}
              <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
                {message(messages, "common.methodology")}
              </Link>
            </SourceNote>
          </div>
          <div className="mt-3 border-l-2 border-[var(--accent)] bg-[var(--tint)] px-3.5 py-3">
            <SourceNote testId="population-census-note">{t("censusNote", { count: rebase })}</SourceNote>
          </div>
        </div>
        <PopulationSeriesPanel
          places={places}
          listed={model.listed}
          level={state.level}
          selectedIds={state.selectedIds}
          endYear={model.range.end}
          endValues={model.endValues}
          onLevelChange={(level) => update((previous) => changeLevel(previous, level))}
          onToggle={(id) => update((previous) => toggleSelected(previous, id))}
          onSetTabSelection={(selected) =>
            update((previous) => setTabSelection(previous, model.listed.map((place) => place.id), selected))}
          downloadAction={
            <ExcelDownloadButton
              testId="population-excel-download"
              disabled={!state.selectedIds.length || !model.hasData}
              onDownload={async () => {
                const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
                await downloadWorkbook(buildPopulationWorkbookExportModel(facts, places, state, presentation, sources, siteOrigin));
              }}
            />
          }
        />
      </ExplorerWorkspace>
      {highlights ? <PopulationHighlightsSection highlights={highlights} /> : null}
    </div>
  );
}
```

- [ ] **Step 8: Run the tests, the typecheck and lint**

Run: `npx vitest run tests/explorer/controlAdditions.test.tsx tests/explorer/populationExplorer.test.tsx tests/i18n/demographyMessages.test.ts && npm run typecheck && npx eslint components/demography components/ui/editorial.tsx components/explorer-shell/measure-pill.tsx`
Expected: PASS; the message-scan test now reads the new components and finds every `t("…")` key in the JSON; typecheck and lint clean. If lint flags `react-hooks` rules in the new hook or explorer, fix the code to satisfy the rule rather than disabling it; the one disable comment in the hook is copied from `components/inflation/inflation-cities.tsx`, which restores its hash the same way.

- [ ] **Step 9: Commit**

```bash
git add components tests/explorer/controlAdditions.test.tsx tests/explorer/populationExplorer.test.tsx
git commit -m "feat(demography): population explorer with clickable map, places list and highlights" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Methodology page and archived originals

**Files:**
- Create: `data/methodology/source-archives/demography.csv`, `apps/web/lib/methodology/content/demography.ts`, `apps/web/lib/methodology/content/en/demography.ts`
- Modify: `apps/web/lib/methodology/types.ts`, `sourceInventory.ts`, `catalog.ts`, `content/en/revisions.ts`; `apps/web/lib/pages/methodology-article.tsx`, `apps/web/lib/pages/methodology.tsx`; `apps/web/components/methodology/methodology-article.tsx`, `methodology-hub.tsx`; `apps/web/lib/i18n/messages/{ka,en}/methodology.json`; `data/localization/en/documents.json`, `data/localization/en/page-revisions.json`
- Test: create `apps/web/tests/methodology/demographyMethodology.test.ts`; update `tests/methodology/catalog.test.ts`, `tests/methodology/prepareArchives.test.ts`, `tests/methodology/methodologyArticle.test.tsx`, `tests/i18n/methodologyCoverage.test.ts`, `tests/seo/routes.test.ts`, `tests/browser/methodology.spec.ts`, `tests/browser/bilingual-methodology.spec.ts`

**Interfaces:**
- Produces: methodology id `demography` (last in `LIVE_METHODOLOGY_IDS`), page `/methodology/demography` and `/en/methodology/demography` through the existing article route, whose "processed data" download block, Dataset JSON-LD and `/downloads/data` links are skipped for a dataset that has none (spec §10). `MethodologyArticle`'s `processedDataHref` becomes optional. The manifest names exactly two originals: `source.geostat_municipal_population` (2004–2026) and `source.geostat_demography_density` (2014–2026); each later plan adds its originals to the inventory rule and the manifest in the change that flips its page live. The "population" future marker leaves the methodology hub (it is no longer in the future).

- [ ] **Step 1: Write the new test and update the existing ones that enumerate the live datasets**

`apps/web/tests/methodology/demographyMethodology.test.ts`:

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { validateMethodologyTranslation } from "../../lib/i18n/methodology";
import { getMethodologyContent, LIVE_METHODOLOGY_IDS } from "../../lib/methodology/catalog";
import { METHODOLOGY_TRANSLATION_REVIEWED_AT } from "../../lib/methodology/content/en/revisions";
import { projectPublicSources } from "../../lib/methodology/publicSources";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";

const root = path.resolve(process.cwd(), "../..");

describe("demography methodology", () => {
  it("is a live dataset with a valid Georgian-to-English translation", () => {
    expect(LIVE_METHODOLOGY_IDS.at(-1)).toBe("demography");
    expect(validateMethodologyTranslation(
      getMethodologyContent("demography", "ka"),
      getMethodologyContent("demography", "en"),
      METHODOLOGY_TRANSLATION_REVIEWED_AT.demography,
    )).toEqual([]);
  });

  it("states its scope, the census re-base and the area convention in plain words, in both languages", () => {
    for (const locale of ["ka", "en"] as const) {
      const content = getMethodologyContent("demography", locale);
      const prose = [content.summary, content.disclosure, ...content.sections.flatMap((section) => section.paragraphs)].join(" ");
      expect(prose).toContain("2004–2026");
      expect(prose).toContain("504.24");
      expect(prose).toMatch(locale === "en" ? /re-based the population to the 2024 census/ : /2024 წლის აღწერაზე დააფუძნა/);
      expect(prose).toMatch(locale === "en" ? /not compared/ : /არ შედარდება/);
      expect(prose).toMatch(locale === "en" ? /occupied territories/i : /ოკუპირებული ტერიტორიები/);
    }
  });

  it("archives exactly the two Geostat originals it serves, with their recorded hashes", async () => {
    const rows = await loadReviewedSourceManifest(root, "demography");
    expect(rows.map((row) => [row.source_id, row.byte_size, row.sha256])).toEqual([
      ["source.geostat_demography_density", 13_917, "77d29d84cb7530f4fb6294f17a768e220f02636d77debfc438509b5c17ac28b8"],
      ["source.geostat_municipal_population", 34_994, "8bd7a1b56e756e8d6bc92192095795b204b23fd18274aaff39b78c0b0a487a57"],
    ]);
    expect(rows.every((row) => row.downloadHref.startsWith("/downloads/methodology/demography/files/"))).toBe(true);
    expect(rows.map((row) => [row.years[0], row.years.at(-1)])).toEqual([[2014, 2026], [2004, 2026]]);
  });

  it("has an English title for each archived source", async () => {
    const [catalogue, rows] = await Promise.all([loadEnglishCatalogue(root), loadReviewedSourceManifest(root, "demography")]);
    expect(projectPublicSources(rows, "en", catalogue.documents).map((row) => row.title)).toEqual([
      "Density by regions (number of population per 1 sq.km)",
      "Population as of 1 January by regions and self-governed units",
    ]);
  });
});
```

Add this case to `apps/web/tests/methodology/methodologyArticle.test.tsx`, as a new `describe` at the end of the file, and add `["demography", "Geostat"]` as a fifth row of the `it.each` table in "methodology footer attribution":

```tsx
describe("methodology without bulk files", () => {
  it("renders the demography article with its breadcrumb and archived originals but no download or Dataset markup", async () => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "demography" }) }));
    expect(markup).not.toContain("processed-dataset-download");
    expect(markup).not.toContain('data-testid="dataset-json-ld"');
    expect(markup).not.toContain("/downloads/data/");
    expect(markup).toContain('data-testid="breadcrumb-json-ld"');
    expect(markup).toContain("/downloads/methodology/demography/files/");
  });

  it("lists demography on the hub but keeps it out of the data catalog, which names only Dataset nodes", async () => {
    const { renderMethodologyPage } = await import("../../lib/pages/methodology");
    const markup = renderToStaticMarkup(await renderMethodologyPage("en"));
    const catalog = markup.match(/<script data-testid="catalog-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!;
    expect(catalog).toContain('/methodology/inflation"');
    expect(catalog).not.toContain("/methodology/demography");
    expect(markup).toContain('href="/en/methodology/demography"');
  });
});
```

Update the existing tests so their lists grow by `demography` (do not loosen any assertion):

- `tests/methodology/catalog.test.ts`: the `LIVE_METHODOLOGY_IDS` expectation becomes `["expenditure", "revenue", "municipalities", "debt", "gdp", "economic-sectors", "regional-economies", "inflation", "demography"]`; in both `archives` objects add `demography: { fileCount: 2, totalBytes: 100, latestRetrievedAt: "2026-10-03", validated: true, minYear: 2004, maxYear: 2026 },`; in the expected hub rows, after the `inflation` row add `{ id: "demography", title: METHODOLOGY_CONTENT.demography.title, summary: METHODOLOGY_CONTENT.demography.summary, href: "/methodology/demography", coverage: { firstYear: 2004, lastYear: 2026 }, originalFileCount: 2, reviewedAt: METHODOLOGY_CONTENT.demography.reviewedAt },`.
- `tests/methodology/prepareArchives.test.ts`: in `createFixtureRepository`, after the `regional-economies` fixture add
  ```ts
      demography: [
        await writeReviewedSource(repositoryRoot, "demography", "2004-2026", "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx", "downloads/methodology/demography/files/01-population-by-self-governed-unit.xlsx", "demography-population"),
        await writeReviewedSource(repositoryRoot, "demography", "2014-2026", "docs/Raw Data/Demography/geostat-demography/2026-10/official/03-density-by-regions.xlsx", "downloads/methodology/demography/files/03-density-by-regions.xlsx", "demography-density"),
      ],
  ```
- `tests/i18n/methodologyCoverage.test.ts`: `expect(LIVE_METHODOLOGY_IDS).toHaveLength(8)` becomes `toHaveLength(9)`.
- `tests/seo/routes.test.ts`: `expect(urls).toHaveLength(242)` becomes `244` (the demography methodology adds one bilingual pair), and the comment above it gains "the demography methodology adds one more".
- `tests/browser/methodology.spec.ts`: the future-row badge count `toHaveCount(2)` on line 11 becomes `toHaveCount(1)`; the live rows `toHaveCount(8)` becomes `toHaveCount(9)` and the future rows `toHaveCount(2)` becomes `toHaveCount(1)` in "methodology hub separates live datasets from future markers"; in the test that checks the future rows' labels (`futureRows` … `toHaveCount(2)`), the label loop becomes `for (const label of ["უმუშევრობა"] as const)` and the count `toHaveCount(1)`; in "sitemap publishes exactly the live methodology routes" add `"/methodology/demography",` after `"/methodology/inflation",` in the expected list. (The sidebar badge count on line 21 changes in Task 14.)
- `tests/browser/bilingual-methodology.spec.ts`: `await expect(rows).toHaveCount(8)` becomes `9`, the expected id list gains `"demography"` at the end, and the "Coming soon" future-row count `toHaveCount(2)` becomes `toHaveCount(1)`.

- [ ] **Step 2: Run to verify the failures**

Run: `npx vitest run tests/methodology tests/i18n/methodologyCoverage.test.ts`
Expected: FAIL (`demography` is not a methodology id; no manifest).

- [ ] **Step 3: Register the dataset**

`apps/web/lib/methodology/types.ts`: change the id list to `["expenditure", "revenue", "municipalities", "debt", "gdp", "economic-sectors", "regional-economies", "inflation", "demography"] as const`.

`apps/web/lib/methodology/sourceInventory.ts`: in `inventoryRules`, after the `"regional-economies"` entry add:

```ts
  demography: [
    { root: "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official", include: (candidatePath: string) => path.posix.basename(candidatePath) === "01-population-by-self-governed-unit.xlsx" },
    { root: "docs/Raw Data/Demography/geostat-demography/2026-10/official", include: (candidatePath: string) => path.posix.basename(candidatePath) === "03-density-by-regions.xlsx" },
  ],
```

`apps/web/lib/methodology/content/en/revisions.ts`: add `demography: "2026-10-04",` after `inflation`.

`apps/web/lib/methodology/catalog.ts`: add the imports
```ts
import { DEMOGRAPHY_METHODOLOGY } from "./content/demography";
import { DEMOGRAPHY_METHODOLOGY as EN_DEMOGRAPHY } from "./content/en/demography";
```
and the entries `demography: DEMOGRAPHY_METHODOLOGY,` as the last entry of `METHODOLOGY_CONTENT` (after `inflation`; the object's key order must equal the id order) and `demography: EN_DEMOGRAPHY,` in `ENGLISH_METHODOLOGY_CONTENT`.

`data/methodology/source-archives/demography.csv`:

```csv
source_id,dataset_id,year,source_organization,display_title_ka,official_filename,official_url_or_archive_url,repository_source_path,public_download_path,media_type,byte_size,sha256,retrieved_at,retrieved_at_basis,license_id,attribution_text,redistribution_status,notes
source.geostat_municipal_population,demography,2004-2026,საქსტატი,მოსახლეობა 1 იანვრის მდგომარეობით რეგიონებისა და თვითმმართველი ერთეულების მიხედვით,01-population-by-self-governed-unit.xlsx,https://www.geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx,docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx,downloads/methodology/demography/files/01-population-by-self-governed-unit.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,34994,8bd7a1b56e756e8d6bc92192095795b204b23fd18274aaff39b78c0b0a487a57,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Published 1 January population for Georgia and its regions and self-governed units; 2025 onward is based on the 2024 census.
source.geostat_demography_density,demography,2014-2026,საქსტატი,მოსახლეობის სიმჭიდროვე რეგიონების მიხედვით,03-density-by-regions.xlsx,https://geostat.ge/media/78361/03-density-by-regions.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/03-density-by-regions.xlsx,downloads/methodology/demography/files/03-density-by-regions.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,13917,77d29d84cb7530f4fb6294f17a768e220f02636d77debfc438509b5c17ac28b8,2026-10-03,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Published density for Georgia and the regions; a fixed March 2014 area with the occupied territories excluded.
```

- [ ] **Step 4: The content, in both languages**

`apps/web/lib/methodology/content/demography.ts`:

```ts
import type { MethodologyContent } from "../types";

export const DEMOGRAPHY_METHODOLOGY: MethodologyContent = {
  id: "demography",
  slug: "demography",
  title: "დემოგრაფია",
  summary: "საქართველოს, მისი 11 რეგიონისა და 64 მუნიციპალიტეტის მოსახლეობა 1 იანვრის მდგომარეობით, 2004–2026, და სიმჭიდროვე რეგიონების მიხედვით.",
  reviewedAt: "2026-10-04",
  archiveManifestId: "demography",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/demography.md"],
  disclosure: "საქსტატის ოფიციალური წლიური მონაცემები. წილებსა და ადგილებს Fiscal.ge ითვლის; 2025 წლის აღწერით გადათვლის გამო ცვლილება არ ითვლება.",
  keyFacts: [
    { label: "მოცვა", valueKind: "coverage" },
    { label: "სიხშირე", valueKind: "frequency", value: "წლიური, 1 იანვარი" },
    { label: "ერთეული", valueKind: "unit", value: "ადამიანი / ადამიანი კმ²-ზე" },
  ],
  sections: [
    { id: "scope", kind: "scope", title: "მოცვა", paragraphs: ["გვერდი მოიცავს საქართველოს, 11 რეგიონსა და 64 მუნიციპალიტეტს. საქართველოს მოსახლეობა ხელმისაწვდომია 2004–2026 წლებისთვის, რეგიონებისა და მუნიციპალიტეტების — 2015–2026 წლებისთვის; სიმჭიდროვე ქვეყნდება საქართველოსა და რეგიონებისთვის. ოკუპირებული ტერიტორიები გამორიცხულია. თბილისი ერთადერთი ადგილია, რომელიც ერთდროულად რეგიონიცაა და მუნიციპალიტეტიც, და ორივე დონეზე ერთსა და იმავე მონაცემს იღებს."] },
    { id: "sources", kind: "sources", title: "წყაროები და საფუძველი", paragraphs: [
      "წყარო არის საქსტატი: მოსახლეობა 1 იანვრის მდგომარეობით რეგიონებისა და თვითმმართველი ერთეულების მიხედვით და სიმჭიდროვე რეგიონების მიხედვით. მოსახლეობა ინახება ადამიანის სიზუსტით, საქსტატის ცხრილში კი ათასებში ჩანს.",
      "სიმჭიდროვე არის მოსახლეობა 1 იანვარს გაყოფილი ერთ ფიქსირებულ ფართობზე (2014 წლის მარტი, ოკუპირებული ტერიტორიების გარეშე). თბილისისთვის ფართობია 504.24 კმ² და არა ხშირად დასახელებული 726 კმ². მუნიციპალიტეტებს ოფიციალური ფართობი არ აქვთ, ამიტომ მუნიციპალური სიმჭიდროვე არ ქვეყნდება.",
      "მონაცემების საფუძველი წლის მიხედვით ჩანს: 2004–2014 წლები 2018 წელს ხელახლა შეფასდა, 2015–2024 წლები შეფასებულია 2024 წლის აღწერამდე, 2025 წლიდან კი მონაცემები 2024 წლის აღწერას ეყრდნობა.",
    ] },
    { id: "validation", kind: "validation", title: "შემოწმება", paragraphs: [
      "ორიგინალი Excel ფაილების ჰეში და ზომა ფიქსირებულია. 11 რეგიონის ჯამი და, ცალკე, 64 მუნიციპალიტეტის ჯამი ყოველ წელს საქართველოს მაჩვენებელს უდრის, თბილისი კი რეგიონადაც და მუნიციპალიტეტადაც ერთსა და იმავე რიცხვს იღებს.",
    ] },
    { id: "limitations", kind: "limitations", title: "შეზღუდვები", paragraphs: [
      "2025 წლის 1 იანვარს საქსტატმა მოსახლეობა 2024 წლის აღწერაზე დააფუძნა. ეს გადათვლა ყველა ადგილზე ერთნაირი არ არის: ზოგ მუნიციპალიტეტში მოსახლეობა შემცირდა, ზოგში — გაიზარდა. ამიტომ 2024 და 2025 წლების მონაცემები ერთმანეთს არ შედარდება და გვერდზე ზრდა, ცვლილება ან ადგილის ცვლილება არ ითვლება. რუკები მხოლოდ უახლეს წელს აჩვენებს.",
      "პროგნოზი, ასაკი და სქესი, შობადობა, გარდაცვალება და მიგრაცია ამ გვერდის ფარგლებს არ ეკუთვნის.",
    ] },
    { id: "archive", kind: "archive", title: "ორიგინალი წყაროები", paragraphs: ["საქსტატის ორი უცვლელი Excel ფაილი: მოსახლეობა 1 იანვრის მდგომარეობით რეგიონებისა და თვითმმართველი ერთეულების მიხედვით და სიმჭიდროვე რეგიონების მიხედვით."] },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};
```

`apps/web/lib/methodology/content/en/demography.ts`:

```ts
import type { MethodologyContent } from "../../types";

export const DEMOGRAPHY_METHODOLOGY: MethodologyContent = {
  id: "demography",
  slug: "demography",
  title: "Demography",
  summary: "Population on 1 January for Georgia, its 11 regions and 64 municipalities, 2004–2026, and density by region.",
  reviewedAt: "2026-10-04",
  archiveManifestId: "demography",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/demography.md"],
  disclosure: "Official annual Geostat observations. Fiscal.ge computes the shares and ranks; because of the 2025 census re-base no change is computed.",
  keyFacts: [
    { label: "Coverage", valueKind: "coverage" },
    { label: "Frequency", valueKind: "frequency", value: "Annual, 1 January" },
    { label: "Unit", valueKind: "unit", value: "persons / persons per km²" },
  ],
  sections: [
    { id: "scope", kind: "scope", title: "Coverage", paragraphs: ["The page covers Georgia, its 11 regions and 64 municipalities. Georgia’s population is available for 2004–2026 and the regions’ and municipalities’ for 2015–2026; density is published for Georgia and the regions. Occupied territories are excluded. Tbilisi is the one place that is both a region and a municipality, and it carries the same figures at both levels."] },
    { id: "sources", kind: "sources", title: "Sources and basis", paragraphs: [
      "Source: Geostat, population on 1 January by region and self-governed unit, and density by region. Population is stored to the person; Geostat’s table displays it in thousands.",
      "Density is the 1 January population divided by one fixed area as of March 2014, occupied territories excluded. For Tbilisi the area is 504.24 km², not the 726 km² often cited. Municipalities have no official area, so municipal density is not published.",
      "The basis follows the year: 2004–2014 were re-estimated in 2018, 2015–2024 were estimated before the 2024 census, and from 2025 the figures are based on the 2024 census.",
    ] },
    { id: "validation", kind: "validation", title: "Validation", paragraphs: [
      "Original Excel hashes and byte sizes are fixed. The 11 regions, and separately the 64 municipalities, sum to Georgia’s figure in every year, and Tbilisi carries the same number as a region and as a municipality.",
    ] },
    { id: "limitations", kind: "limitations", title: "Limitations", paragraphs: [
      "On 1 January 2025 Geostat re-based the population to the 2024 census. The re-base is not the same everywhere: some municipalities lose population and others gain it. Figures for 2024 and 2025 are therefore not compared, and the page computes no growth, change or change in rank. Maps show the latest year only.",
      "Projections, age and sex, births, deaths and migration are outside this page’s scope.",
    ] },
    { id: "archive", kind: "archive", title: "Original sources", paragraphs: ["Two untouched Geostat Excel files: population on 1 January by region and self-governed unit, and density by region."] },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};
```

(Both files were run through `validateMethodologyTranslation` before this plan was written and returned no errors.)

- [ ] **Step 5: English document title, page revision and the hub marker**

In `data/localization/en/documents.json` add this entry directly before the `"source.geostat_demography_density": {` entry:

```json
  "source.geostat_municipal_population": {
    "title": {
      "text": "Population as of 1 January by regions and self-governed units",
      "reviewedAt": "2026-10-04"
    },
    "publisher": {
      "text": "National Statistics Office of Georgia (Geostat)",
      "reviewedAt": "2026-10-04"
    },
    "attribution": null,
    "documentLanguage": "en"
  },
```

In `data/localization/en/page-revisions.json` replace the last line `"/explorer/inflation/cities/zugdidi": "2026-09-30"` with
```json
  "/explorer/inflation/cities/zugdidi": "2026-09-30",
  "/methodology/demography": "2026-10-04"
```
(Task 15 adds the two explorer pages here too.)

In `apps/web/components/methodology/methodology-hub.tsx` change `["population", "unemployment"]` to `["unemployment"]`; delete the now unused `"methodology.population"` line from both `lib/i18n/messages/ka/methodology.json` and `en/methodology.json`.

- [ ] **Step 6: Let the article page skip downloads it does not have**

In `apps/web/components/methodology/methodology-article.tsx` make `processedDataHref?: \`/downloads/data/${string}.csv\`;` optional in the props type, and wrap the download block: replace the opening `<div className="border-b border-[var(--ink)] py-6">` of the block that contains `data-testid="processed-dataset-download"` with `{processedDataHref === undefined ? null : (<div className="border-b border-[var(--ink)] py-6">` and its closing `</div>` (the line before the blank line and `<aside`) with `</div>)}`.

In `apps/web/lib/pages/methodology-article.tsx`:

1. Add `demography: "common.geostatSourceNote",` to `DATASET_SOURCE_NOTES`.
2. Inside `renderMethodologyArticle`, after `const publicRows = ...;` add
   ```ts
     // Demography has no bulk files, no Dataset markup and no MCP entry yet (spec section 10): it keeps the
     // breadcrumb and the archived originals, and nothing that points at a file that does not exist.
     const downloadable = dataset === "demography" ? null : dataset;
   ```
3. Wrap the existing `<JsonLd data={...} testId="dataset-json-ld" />` element in `{downloadable === null ? null : ( … )}` and inside it replace every `dataset` used to index `DATASET_SCHEMA_IDS`, `DATASET_DOWNLOADS`, `DATASET_JSON_DISTRIBUTIONS` and the `dataset === "inflation"` test with `downloadable` (the inflation branch and the `datasetJsonLd` call are otherwise unchanged).
4. In `<MethodologyArticle … />` replace `processedDataHref={DATASET_DOWNLOADS[dataset]}` with `processedDataHref={downloadable === null ? undefined : DATASET_DOWNLOADS[downloadable]}` and `processedDataJsonLinks={DATASET_JSON_DOWNLOADS[dataset].map(…)}` with `processedDataJsonLinks={downloadable === null ? [] : DATASET_JSON_DOWNLOADS[downloadable].map(…)}`.

In `apps/web/lib/pages/methodology.tsx` the hub's `DataCatalog` JSON-LD names every live methodology page as a Dataset `@id`. Demography has no Dataset node (spec §10), so the catalog must not point at one. Replace `liveEntries.map(entry => entry.href)` in the `dataCatalogJsonLd(…)` call with:

```ts
// Demography has no Dataset markup yet (spec section 10); the catalog names only pages that carry it.
liveEntries.filter((entry) => entry.id !== "demography").map((entry) => entry.href)
```

The hub's visible rows still list demography; only the structured data leaves it out.

- [ ] **Step 7: Generate and check the archive, run the tests and the typecheck**

Run: `npm run data:prepare-methodology-archives && npm run data:check-methodology-archives && npx vitest run tests/methodology tests/i18n tests/seo && npm run typecheck && npm run i18n:check`
Expected: the archive prepare/check commands print their PASS lines (the generated `public/downloads/methodology/demography/` and `data/reports/methodology-archive-validation.json` are git-ignored); all methodology, i18n and SEO tests pass; typecheck and `i18n:check` clean. If the typechecker names another `Record<MethodologyDatasetId, …>` or `satisfies` that now lacks `demography`, add the key there (the compiler is the authority on the list). If a `tests/seo` case loops over every live methodology id and expects Dataset markup or a `/downloads/data` link, add the documented demography exception (spec §10) to that case instead of loosening it for the others.

- [ ] **Step 8: Commit**

```bash
git add ../../data/methodology/source-archives/demography.csv ../../data/localization/en/documents.json ../../data/localization/en/page-revisions.json lib components tests
git commit -m "feat(demography): methodology page and archived Geostat originals" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Hub, Population page, routes, sidebar and footer

**Files:**
- Create: `apps/web/lib/explorer/demographyRoutes.ts`, `apps/web/lib/explorer/demographyHubCards.ts`, `apps/web/lib/pages/demography.tsx`, `apps/web/lib/pages/demography-population.tsx`, `apps/web/app/(ka)/explorer/demography/page.tsx`, `apps/web/app/(ka)/explorer/demography/population/page.tsx`, `apps/web/app/(en)/en/explorer/demography/page.tsx`, `apps/web/app/(en)/en/explorer/demography/population/page.tsx`
- Modify: `apps/web/components/shell/data-sidebar.tsx`, `apps/web/components/shell/explorer-footer.tsx`
- Test: create `apps/web/tests/explorer/demographyHub.test.ts`, `tests/explorer/demographyPages.test.tsx`, `tests/explorer/demographySidebar.test.tsx`; update `tests/seo/footerAttribution.test.tsx`, `tests/browser/methodology.spec.ts`, `tests/browser/bilingual-controls.spec.ts`, `tests/browser/inflation-overview.spec.ts`

**Interfaces:**
- Produces: `DEMOGRAPHY_HUB_PATH = "/explorer/demography"`; `DEMOGRAPHY_PAGES` (the four pages in hub order: `{ id, path, live, titleKey, descriptionKey, labelKey }`) and `LIVE_DEMOGRAPHY_PAGES`, the one list that decides what is live (the hub, the sidebar, the sitemap and the route inventory read it; each later plan flips one `live` flag and adds its `common.demography…` label); `buildDemographyHubCards(facts: ServedDemographyObservation[], presentation: Presentation): HubCardModel[]`; `demographyPageMetadata(locale)`, `renderDemographyPage(locale)`, `demographyPopulationPageMetadata(locale)`, `renderDemographyPopulationPage(locale)`.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/explorer/demographyHub.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { INK } from "../../lib/explorer/colors";
import { buildDemographyHubCards } from "../../lib/explorer/demographyHubCards";
import { DEMOGRAPHY_PAGES, LIVE_DEMOGRAPHY_PAGES } from "../../lib/explorer/demographyRoutes";
import { getMessages } from "../../lib/i18n/messages.server";
import { getPresentation } from "../../lib/i18n/presentation.server";

describe("demography routes", () => {
  it("name the four pages in hub order and only the population page is live", () => {
    expect(DEMOGRAPHY_PAGES.map((page) => page.id)).toEqual(["population", "age-sex", "migration", "births-deaths"]);
    expect(DEMOGRAPHY_PAGES.map((page) => page.path)).toEqual([
      "/explorer/demography/population",
      "/explorer/demography/age-sex",
      "/explorer/demography/migration",
      "/explorer/demography/births-deaths",
    ]);
    expect(LIVE_DEMOGRAPHY_PAGES.map((page) => page.id)).toEqual(["population"]);
  });

  it("have a sidebar label in both languages for every live page", async () => {
    for (const locale of ["ka", "en"] as const) {
      const common = await getMessages(locale, ["common"]);
      for (const page of LIVE_DEMOGRAPHY_PAGES) expect(common[page.labelKey]?.trim()).toBeTruthy();
    }
  });
});

describe("demography hub cards", () => {
  it("link only the live page and show the other three as coming soon", async () => {
    const [{ facts }, presentation] = await Promise.all([loadServedDemographyData(), getPresentation("en", ["demography", "common"], [])]);
    const cards = buildDemographyHubCards(facts, presentation);
    expect(cards.map((card) => card.index)).toEqual(["01", "02", "03", "04"]);
    expect(cards.map((card) => card.title)).toEqual(["Population", "Age and sex", "Migration", "Births, deaths and fertility"]);
    expect(cards.map((card) => card.href)).toEqual(["/explorer/demography/population", null, null, null]);
    expect(cards.map((card) => card.comingSoon)).toEqual([false, true, true, true]);
  });

  it("draw the population card from Georgia's series with the census gap as a break in the line", async () => {
    const [{ facts }, presentation] = await Promise.all([loadServedDemographyData(), getPresentation("en", ["demography", "common"], [])]);
    const georgia = facts
      .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === "country.georgia")
      .sort((left, right) => left.year - right.year);
    const card = buildDemographyHubCards(facts, presentation)[0]!;
    expect(card.series).toHaveLength(georgia.length + 1);
    expect(card.series!.filter((value) => value === null)).toHaveLength(1);
    expect(card.series![0]).toBe(georgia[0]!.value);
    expect(card.series!.at(-1)).toBe(georgia.at(-1)!.value);
    expect(card.seriesColor).toBe(INK);
    expect(card.footer).toBe("2026: 3,941,103 people · 2004–2026");
  });
});
```

`apps/web/tests/explorer/demographyPages.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));

import {
  demographyPageMetadata,
  renderDemographyPage,
} from "../../lib/pages/demography";
import {
  demographyPopulationPageMetadata,
  renderDemographyPopulationPage,
} from "../../lib/pages/demography-population";

const GEORGIAN = /[Ⴀ-ჿ]/;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

describe("demography hub page", () => {
  it("renders the four cards with a breadcrumb and no Georgian text in English", async () => {
    const html = renderToStaticMarkup(await renderDemographyPage("en"));
    expect(html).toContain('data-testid="demography-hub"');
    expect((html.match(/data-testid="hub-card"/g) ?? []).length).toBe(4);
    expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(3);
    expect(html).toContain('href="/en/explorer/demography/population"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("has metadata that is canonical to its own language and reciprocal", async () => {
    const metadata = await demographyPageMetadata("en");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/demography");
    expect(metadata.alternates?.languages).toMatchObject({ ka: "https://fiscal.ge/explorer/demography", en: "https://fiscal.ge/en/explorer/demography" });
  });
});

describe("population page", () => {
  it("renders the heading, coverage, explorer and breadcrumb, with no download and no Georgian text in English", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain('data-testid="population-explorer"');
    expect(html).toContain("2004–2026 · as of 1 January");
    expect(html).toContain("persons, on 1 January");
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).toContain('href="/en/methodology/demography"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("renders in Georgian with the same structure", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("ka"));
    expect(html).toContain('data-testid="population-explorer"');
    expect(html).toContain("2004–2026 · 1 იანვრის მდგომარეობით");
    expect(html).toContain('href="/methodology/demography"');
  });

  it("has metadata with the page's own canonical address", async () => {
    const metadata = await demographyPopulationPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/population");
    expect(String(metadata.title)).toContain("მოსახლეობა");
  });
});
```

`apps/web/tests/explorer/demographySidebar.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderExplorerLayout } from "../../lib/pages/explorer-layout";

const route = vi.hoisted(() => ({ pathname: "/en/explorer/demography/population" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const render = async (pathname: string, locale: "ka" | "en" = "en") => {
  route.pathname = pathname;
  return renderToStaticMarkup(await renderExplorerLayout(locale, null));
};

describe("sidebar demography group", () => {
  it("opens with the live pages nested and the current page marked", async () => {
    const markup = await render("/en/explorer/demography/population");
    expect(markup).toContain('data-testid="demography-link"');
    expect(markup).toContain('data-testid="demography-population-link" aria-current="page"');
    expect(markup).not.toContain('data-testid="demography-age-sex-link"');
    expect(markup).toContain("Unemployment");
    expect((markup.match(/Coming soon/g) ?? []).length).toBe(1);
  });

  it("marks the hub link current on the hub and nests the live pages", async () => {
    const markup = await render("/en/explorer/demography");
    expect(markup).toContain('data-testid="demography-link" aria-current="page"');
    expect(markup).toContain('data-testid="demography-population-link"');
  });

  it("stays closed on other sections and keeps the budget group out of demography", async () => {
    const markup = await render("/en/explorer/economy");
    expect(markup).toContain('data-testid="demography-link"');
    expect(markup).not.toContain('data-testid="demography-population-link"');
    const onDemography = await render("/en/explorer/demography/population");
    expect(onDemography).not.toContain('data-testid="section-link-expenditure"');
  });
});
```

Update `tests/seo/footerAttribution.test.tsx`: add to the `it.each` table `["/en/explorer/demography", "Geostat", "World Bank"]` and `["/en/explorer/demography/population", "Geostat", "Ministry of Finance"]`.

Update the three browser specs (their sidebar teaser count falls from two to one because `დემოგრაფია` is no longer a teaser): `tests/browser/methodology.spec.ts` the `inkBadges` `toHaveCount(2)` becomes `toHaveCount(1)`; `tests/browser/bilingual-controls.spec.ts` the sidebar `Coming soon` `toHaveCount(2)` becomes `toHaveCount(1)`; `tests/browser/inflation-overview.spec.ts` the sidebar `მალე` `toHaveCount(2)` becomes `toHaveCount(1)`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/explorer/demographyHub.test.ts tests/explorer/demographyPages.test.tsx tests/explorer/demographySidebar.test.tsx tests/seo/footerAttribution.test.tsx`
Expected: FAIL (modules and sidebar group do not exist).

- [ ] **Step 3: The route list and the hub cards**

`apps/web/lib/explorer/demographyRoutes.ts`:

```ts
export const DEMOGRAPHY_HUB_PATH = "/explorer/demography";

/**
 * The four Demography pages in hub order, and the one place that decides which are live. A name stays a
 * coming-soon marker until its data, page, methodology and tests exist together; flipping `live` is the
 * last step of the plan that ships the page. `labelKey` is its sidebar label (a `common` message).
 */
export const DEMOGRAPHY_PAGES = [
  { id: "population", path: "/explorer/demography/population", live: true, titleKey: "populationTitle", descriptionKey: "populationDescription", labelKey: "common.demographyPopulation" },
  { id: "age-sex", path: "/explorer/demography/age-sex", live: false, titleKey: "ageSexTitle", descriptionKey: "ageSexDescription", labelKey: "common.demographyAgeSex" },
  { id: "migration", path: "/explorer/demography/migration", live: false, titleKey: "migrationTitle", descriptionKey: "migrationDescription", labelKey: "common.demographyMigration" },
  { id: "births-deaths", path: "/explorer/demography/births-deaths", live: false, titleKey: "birthsDeathsTitle", descriptionKey: "birthsDeathsDescription", labelKey: "common.demographyBirthsDeaths" },
] as const;

export const LIVE_DEMOGRAPHY_PAGES = DEMOGRAPHY_PAGES.filter((page) => page.live);
```

`apps/web/lib/explorer/demographyHubCards.ts`:

```ts
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { sparkValues } from "./demographyPopulation";
import { DEMOGRAPHY_PAGES } from "./demographyRoutes";
import { formatInUnit, UNIT_PERSONS } from "./format";
import type { HubCardModel } from "./hubCards";

// Every figure is read from the served facts at build time, so the hub can never drift from the pages
// behind it (DESIGN.md section 6.7).
export function buildDemographyHubCards(
  facts: readonly ServedDemographyObservation[],
  presentation: Presentation,
): HubCardModel[] {
  const t = (key: string, values?: Record<string, string | number>) => message(presentation.messages, `demography.${key}`, values);
  const georgia = facts
    .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === GEORGIA_PLACE_ID)
    .sort((left, right) => left.year - right.year);
  const first = georgia[0];
  const last = georgia.at(-1);
  const span = first && last ? Array.from({ length: last.year - first.year + 1 }, (_, index) => first.year + index) : [];
  const trend = sparkValues(span, (year) => georgia.find((fact) => fact.year === year)?.value ?? null);
  return DEMOGRAPHY_PAGES.map((page, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"),
      title: t(page.titleKey),
      description: t(page.descriptionKey),
      href: page.live ? page.path : null,
      comingSoon: !page.live,
    };
    if (page.id !== "population" || !first || !last) return { ...card, series: null, seriesColor: null, footer: null };
    return {
      ...card,
      series: trend,
      seriesColor: INK,
      footer: t("cardFooter", { year: last.year, persons: formatInUnit(last.value, UNIT_PERSONS), first: first.year, last: last.year }),
    };
  });
}
```

- [ ] **Step 4: The two pages**

`apps/web/lib/pages/demography.tsx`:

```tsx
import { BudgetHub } from "../../components/hub/budget-hub";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { buildDemographyHubCards } from "../explorer/demographyHubCards";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";

export async function demographyPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: DEMOGRAPHY_HUB_PATH,
    title: `${message(p.messages, "demography.title")} | Fiscal.ge`,
    description: message(p.messages, "demography.hubDescription"),
  });
}

export async function renderDemographyPage(locale: Locale) {
  const [{ facts }, p] = await Promise.all([
    loadServedDemographyData(),
    getPresentation(locale, ["demography", "common"], []),
  ]);
  const title = message(p.messages, "demography.title");
  const crumbs = [
    { label: message(p.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(p.messages, "common.data") },
    { label: title },
  ];
  return (
    <I18nProvider {...p}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: title, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
      ]} />
      <main className="px-5 pb-16 min-[768px]:px-[34px]">
        <div className="mx-auto max-w-[1180px]">
          <PageHeader crumbs={crumbs} coverage="" />
          <ExplorerHeading>{title}</ExplorerHeading>
          <p className="mb-[30px] text-[13px] text-[var(--body)]">{message(p.messages, "demography.hubDescription")}</p>
          <BudgetHub cards={buildDemographyHubCards(facts, p)} locale={locale} testId="demography-hub" />
        </div>
      </main>
    </I18nProvider>
  );
}
```

`apps/web/lib/pages/demography-population.tsx`:

```tsx
import path from "node:path";
import { PopulationExplorer } from "../../components/demography/population-explorer";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadDensityRows } from "../data/demography/densityRows";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES } from "../data/demography/series";
import { loadServedMunicipalData } from "../data/servedData";
import { projectDemographyObservation } from "../explorer/clientData";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, buildDemographyPlaces } from "../explorer/demographyAreas";
import { buildPopulationMapModels } from "../explorer/demographyPopulationMaps";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";

const POPULATION_PATH = "/explorer/demography/population";

export async function demographyPopulationPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: POPULATION_PATH,
    title: `${message(p.messages, "demography.populationMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.populationDescription"),
  });
}

export async function renderDemographyPopulationPage(locale: Locale) {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [{ facts }, municipal, manifest, catalogue, georgian] = await Promise.all([
    loadServedDemographyData(),
    loadServedMunicipalData(),
    loadReviewedSourceManifest(repositoryRoot, "demography"),
    loadEnglishCatalogue(repositoryRoot),
    getMessages("ka", ["demography"]),
  ]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  // `municipal` is for the municipality map's own legend line (`municipal.cities`).
  const presentation = await getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook", "municipal"], ids);
  const t = (key: string, values?: TemplateValues) => message(presentation.messages, `demography.${key}`, values);
  const places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: message(georgian, "demography.georgia"),
  });
  const maps = buildPopulationMapModels({
    facts,
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    densityUnit: t("densityUnit"),
  });
  // The density note names Tbilisi's area as the reviewed mapping records it, not as a typed number.
  const densityRows = await loadDensityRows(repositoryRoot, municipal.regions.map((region) => region.id));
  const tbilisiArea = densityRows.areaOf(TBILISI_PLACE_ID).toFixed(2);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  const sources = manifest.map((source) => {
    const translated = publicSources.find((candidate) => candidate.source_id === source.source_id)!;
    return {
      sourceId: source.source_id,
      years: source.years,
      title: translated.title,
      organization: translated.publisher,
      downloadHref: source.downloadHref,
      retrievedAt: source.retrieved_at,
    };
  });
  const years = facts.filter((fact) => fact.seriesId === SERIES.populationTotal).map((fact) => fact.year);
  const title = t("populationTitle");
  const crumbs = [
    { label: message(presentation.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(presentation.messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
        { name: title, path: pageHref(POPULATION_PATH, locale) },
      ]} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("coverage", { first: Math.min(...years), last: Math.max(...years) })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] text-[13px] text-[var(--body)]">{t("unitLine")}</p>
        <PopulationExplorer
          facts={facts.map(projectDemographyObservation)}
          places={places}
          maps={maps}
          tbilisiArea={tbilisiArea}
          sources={sources}
          siteOrigin={resolveSiteUrl()}
        />
      </ExplorerPage>
    </I18nProvider>
  );
}
```

The four route files, each a copy of the existing route files (`app/(ka)/explorer/economy/page.tsx`, `app/(ka)/explorer/inflation/cities/page.tsx`) with the new names:

`apps/web/app/(ka)/explorer/demography/page.tsx`:
```tsx
import { demographyPageMetadata, renderDemographyPage } from "../../../../lib/pages/demography";

export function generateMetadata() {
  return demographyPageMetadata("ka");
}
export default function Page() {
  return renderDemographyPage("ka");
}
```
`apps/web/app/(en)/en/explorer/demography/page.tsx`: the same with `"../../../../../lib/pages/demography"` and `"en"`.
`apps/web/app/(ka)/explorer/demography/population/page.tsx`:
```tsx
import { demographyPopulationPageMetadata, renderDemographyPopulationPage } from "../../../../../lib/pages/demography-population";

export function generateMetadata() {
  return demographyPopulationPageMetadata("ka");
}

export default function Page() {
  return renderDemographyPopulationPage("ka");
}
```
`apps/web/app/(en)/en/explorer/demography/population/page.tsx`: the same with `"../../../../../../lib/pages/demography-population"` and `"en"`.

- [ ] **Step 5: The sidebar and the footer**

In `apps/web/components/shell/data-sidebar.tsx`:

1. Add the import `import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../../lib/explorer/demographyRoutes";`.
2. `const TEASERS = ["unemployment"];` (demography is no longer a teaser).
3. After `const inflationActive = ...;` add `const demographyActive = pathname.includes("/explorer/demography");` and change `const budgetActive = !economyActive && !inflationActive;` to `const budgetActive = !economyActive && !inflationActive && !demographyActive;`.
4. Rail label: replace `message(messages, inflationActive ? "common.dataInflation" : economyActive ? "common.dataEconomy" : "common.dataBudget")` with `message(messages, demographyActive ? "common.dataDemography" : inflationActive ? "common.dataInflation" : economyActive ? "common.dataEconomy" : "common.dataBudget")`.
5. After the last `{inflationActive ? (<Link … inflation-cities-link …/>) : null}` block and before the `{/* No aria-disabled … */}` comment, add:

```tsx
            <Link
              href={pageHref(DEMOGRAPHY_HUB_PATH, locale)}
              data-testid="demography-link"
              aria-current={pathname.endsWith(DEMOGRAPHY_HUB_PATH) ? "page" : undefined}
              className={`flex items-baseline gap-2 border-l-2 px-2.5 py-2 text-[12.5px] font-semibold no-underline ${demographyActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}
            >
              {message(messages, "common.demography")}
            </Link>
            {demographyActive
              ? LIVE_DEMOGRAPHY_PAGES.map((page) => {
                  const active = pathname.endsWith(page.path);
                  return (
                    <Link
                      key={page.id}
                      href={pageHref(page.path, locale)}
                      data-testid={`demography-${page.id}-link`}
                      aria-current={active ? "page" : undefined}
                      className={`ml-[18px] flex items-baseline gap-2 py-[5px] pr-2 pl-2 text-[12px] no-underline transition-colors duration-150 ${active ? "bg-[rgba(247,242,233,0.07)] font-semibold text-[var(--paper)]" : "font-medium text-[var(--ink-fg-muted)] hover:text-[var(--paper)]"}`}
                    >
                      <span aria-hidden className={`font-[family-name:var(--font-numeric)] text-[9px] ${active ? "text-[var(--accent)]" : "text-transparent"}`}>▸</span>
                      {message(messages, page.labelKey)}
                    </Link>
                  );
                })
              : null}
```

In `apps/web/components/shell/explorer-footer.tsx` add after the `inflation` constant `const demography=pathname==='/explorer/demography'||pathname.startsWith('/explorer/demography/');` and, in the `if/else` chain, directly after the `else if (inflation) noteKey='common.inflationSourceNote';` branch add `else if (demography) noteKey='common.geostatSourceNote';`.

- [ ] **Step 6: Run the tests, lint and the typecheck**

Run: `npx vitest run tests/explorer/demographyHub.test.ts tests/explorer/demographyPages.test.tsx tests/explorer/demographySidebar.test.tsx tests/seo/footerAttribution.test.tsx tests/i18n/demographyMessages.test.ts && npm run typecheck && npx eslint lib/pages lib/explorer components/shell`
Expected: PASS (the message-scan test now also covers `demography.tsx`/`demography-population.tsx`); typecheck and lint clean.

- [ ] **Step 7: Commit**

```bash
git add app lib components tests
git commit -m "feat(demography): hub, population page, routes, sidebar group and footer attribution" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Discovery (sitemap, route inventory, English page dates, agent guide)

**Files:**
- Modify: `apps/web/lib/seo/sitemap.ts`, `apps/web/lib/i18n/inventory.server.ts`, `apps/web/public/llms.txt`, `data/localization/en/page-revisions.json`
- Test: create `apps/web/tests/explorer/demographyDiscovery.test.ts`; update `tests/seo/routes.test.ts`, `tests/seo/agentFiles.test.ts`, `tests/browser/bilingual-complete.spec.ts`, `tests/browser/seo.spec.ts`

**Interfaces:**
- Consumes: `DEMOGRAPHY_HUB_PATH`, `LIVE_DEMOGRAPHY_PAGES` (Task 14); `/methodology/demography` is already in the inventory and the sitemap through `LIVE_METHODOLOGY_IDS` (Task 13).
- Produces: sitemap rows (both languages, reciprocal alternates, `lastModified` from the latest review date of the served demography rows) and route-inventory entries for the hub and every live page; `llms.txt` links for the hub, the Population page and the methodology page, with the plain statement that demography is browse-only for now.

- [ ] **Step 1: Write the failing test and update the pinned counts**

`apps/web/tests/explorer/demographyDiscovery.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { loadPageRevisions } from "../../lib/i18n/page-revisions.server";
import sitemap from "../../lib/seo/sitemap";

const PAGES = ["/explorer/demography", "/explorer/demography/population", "/methodology/demography"] as const;

describe("demography discovery", () => {
  it("indexes the hub, the live page and the methodology in both languages with real English dates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, revisions, entries] = await Promise.all([listPublicPagePaths(), loadPageRevisions(), sitemap()]);
      for (const path of PAGES) {
        expect(paths).toContain(path);
        expect(revisions[path]).toMatch(/^2026-\d{2}-\d{2}$/);
        const ka = entries.find((entry) => entry.url === `https://fiscal.ge${path}`);
        const en = entries.find((entry) => entry.url === `https://fiscal.ge/en${path}`);
        expect(ka?.alternates?.languages).toEqual({
          ka: `https://fiscal.ge${path}`,
          en: `https://fiscal.ge/en${path}`,
          "x-default": `https://fiscal.ge${path}`,
        });
        expect(en?.alternates).toEqual(ka?.alternates);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("lists no page that is not live", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, entries] = await Promise.all([listPublicPagePaths(), sitemap()]);
      const notLive = /\/explorer\/demography\/(age-sex|migration|births-deaths)/;
      expect(paths.some((path) => notLive.test(path))).toBe(false);
      expect(entries.some((entry) => notLive.test(entry.url))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("dates the Georgian pages by the latest review of the figures they show", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const entries = await sitemap();
      for (const path of ["/explorer/demography", "/explorer/demography/population"]) {
        const entry = entries.find((candidate) => candidate.url === `https://fiscal.ge${path}`);
        expect(new Date(entry!.lastModified!).toISOString().slice(0, 10)).toBe("2026-10-03");
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
```

Update the pinned lists and counts:

- `tests/seo/routes.test.ts`: `expect(urls).toHaveLength(244)` becomes `248`; extend the comment above it with "the demography hub and Population page add two more bilingual pairs".
- `tests/seo/agentFiles.test.ts`: in `requiredTargets` insert `"https://fiscal.ge/explorer/demography",` and `"https://fiscal.ge/explorer/demography/population",` directly after `"https://fiscal.ge/explorer/inflation/products",`, and `"https://fiscal.ge/methodology/demography",` directly after `"https://fiscal.ge/methodology/inflation",`; change `expect(targets).toHaveLength(50)` to `53`.
- `tests/browser/bilingual-complete.spec.ts`: `expect(paths).toHaveLength(121)` becomes `124` (hub, Population page and demography methodology).
- `tests/browser/seo.spec.ts`, test "sitemap keeps its XML contract and offers a readable browser view": both sitemap counts become 248, `toHaveLength(242)` on the `<loc>` matches and `toHaveCount(242)` on `.sitemap-row` (the methodology page from Task 13 and the two pages here, in both languages).

- [ ] **Step 2: Run to verify the failures**

Run: `npx vitest run tests/explorer/demographyDiscovery.test.ts tests/seo/routes.test.ts tests/seo/agentFiles.test.ts tests/i18n/inventory.test.ts tests/i18n/pageRevisions.test.ts`
Expected: FAIL (the explorer pages are not in the inventory, the sitemap or the revisions; `llms.txt` lacks the links).

- [ ] **Step 3: Sitemap, inventory and English page dates**

In `apps/web/lib/seo/sitemap.ts`:

1. Add the imports `import { loadServedDemographyData } from "../data/demography/importDemography";` (beside the other data loaders) and `import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../explorer/demographyRoutes";` (beside `CITY_PAGE_PATHS`).
2. In the destructuring pattern of the big `Promise.all` add `, { facts: demographyFacts }` after `{ facts: sectorFacts }`, and add `loadServedDemographyData(),` after `loadServedEconomicSectorsData(),` in the array.
3. After `const economyModified = ...;` add `const demographyModified = new Date(demographyFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);`
4. In the `georgian` array, after the `...CITY_PAGE_PATHS.map(...)` line add:
   ```ts
       { url: `${siteUrl}${DEMOGRAPHY_HUB_PATH}`, lastModified: demographyModified },
       ...LIVE_DEMOGRAPHY_PAGES.map((page) => ({ url: `${siteUrl}${page.path}`, lastModified: demographyModified })),
   ```

In `apps/web/lib/i18n/inventory.server.ts` add `import { DEMOGRAPHY_HUB_PATH, LIVE_DEMOGRAPHY_PAGES } from "../explorer/demographyRoutes";` and, in `listPublicPagePaths`, after the `...CITY_PAGE_PATHS,` line add `DEMOGRAPHY_HUB_PATH, ...LIVE_DEMOGRAPHY_PAGES.map((page) => page.path),`.

In `data/localization/en/page-revisions.json` replace the last line `"/methodology/demography": "2026-10-04"` with
```json
  "/methodology/demography": "2026-10-04",
  "/explorer/demography": "2026-10-04",
  "/explorer/demography/population": "2026-10-04"
```
(the date the English text is committed; use that day's date if the plan runs later).

- [ ] **Step 4: The agent guide**

In `apps/web/public/llms.txt`:

1. In the opening quote (line 3) change "…national economic sectors and regional economies, and to Geostat's monthly consumer-price inflation." to "…national economic sectors, regional economies and population, and to Geostat's monthly consumer-price inflation."
2. After the `[Inflation by product]` bullet add:
   ```
   - [Demography](https://fiscal.ge/explorer/demography) — the demography section; only Population is published so far.
   - [Population](https://fiscal.ge/explorer/demography/population) — population on 1 January for Georgia (2004–2026), its 11 regions and 64 municipalities (2015–2026) with a clickable map, and density for Georgia and the regions. Figures from 2025 are based on the 2024 census and are not comparable with earlier years, so no growth or change is computed. Browse-only for now: there is no MCP tool and no bulk file for demography.
   ```
3. After the `[Inflation methodology]` bullet add:
   ```
   - [Demography methodology](https://fiscal.ge/methodology/demography) — Geostat population and density, the 2025 census re-base, definitions and original files.
   ```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/explorer/demographyDiscovery.test.ts tests/seo tests/i18n && npm run i18n:check && npm run typecheck`
Expected: PASS, including the inventory-versus-sitemap equality test and the page-revision test; `i18n:check` clean.

- [ ] **Step 6: Commit**

```bash
git add lib public ../../data/localization/en/page-revisions.json tests
git commit -m "feat(demography): sitemap, route inventory, English page dates and agent guide" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Documents, browser tests and the done-check

**Files:**
- Modify: `Project_Definition.md`, `DESIGN.md`, `docs/data-methodology/demography.md`, `apps/web/tests/browser/main-explorer.spec.ts` (the payload guard, Step 2)
- Create: `apps/web/tests/browser/demography-population.spec.ts`

- [ ] **Step 1: Update the canonical documents**

`Project_Definition.md` (section 2):

1. Replace the bullet that begins "`მალე` markers for named future datasets (`უმუშევრობა` and `დემოგრაფია` in the sidebar)." with: "`მალე` marker for the one named future dataset (`უმუშევრობა` in the sidebar). Label only: no route, not clickable, no served data. Inflation, economic growth and demography are no longer markers — all three ship (see the Economy items below, 2C and the Demography section below)."
2. In the bullet "Reviewed demography **data foundation** from Geostat…", replace its last sentence ("The `დემოგრაფია` marker stays a non-clickable label: no page, route, download, MCP data or serving-mirror import is approved, and each still requires a separately approved page design.") with: "Only the Population page below is served (population on 1 January and density, through the serving mirror); every other family is stored and not yet served, and each still requires its page to ship."
3. After that bullet add:
   > - Demography section at `/explorer/demography`: a hub of four pages, of which **Population** (`/explorer/demography/population`) ships first. Population on 1 January for Georgia (2004–2026), the 11 regions and the 64 municipalities (2015–2026) is drawn on the existing region and municipality maps, which become clickable (choosing a place replaces the selection; the series list ticks places onto the chart), with the standard line and table workspace, the 1 January 2025 census re-base marked and never bridged (no growth, change or rank-movement figure for any pair of years that spans it), density for Georgia and the regions as a map measure and in Excel, highlights for the first selected place, one Excel workbook and the methodology page `/methodology/demography`. The other three pages (`ასაკი და სქესი`, `მიგრაცია`, `შობადობა და სიკვდილიანობა`) stay `მალე` cards on the hub until their data, page and methodology exist together. The section has no MCP tool, bulk file or Dataset markup yet. Specs: `docs/superpowers/specs/2026-10-04-demography-section-design.md` and `docs/superpowers/specs/2026-10-04-demography-population-design.md`; methodology `docs/data-methodology/demography.md`.
4. In the excluded list replace "Any public use of the data behind the remaining sidebar indicator markers (`უმუშევრობა`, `დემოგრაფია`). The reviewed demography data foundation is stored in the repository and not served." with: "Any public use of the data behind the remaining sidebar indicator marker (`უმუშევრობა`), and any public use of demography data beyond the Population page's population and density (the rest of the reviewed foundation is stored and not yet served)."

`DESIGN.md`:

1. Header: `Last updated: 2026-10-04`; in the `Scope:` line change "(budget, economy and inflation)" to "(budget, economy, inflation and demography)".
2. §6.7: "Three dataset links, in order: …" becomes "Four dataset links, in order: `ბიუჯეტი` → `/explorer`, `ეკონომიკა` → `/explorer/economy`, `ინფლაცია` → `/explorer/inflation`, `დემოგრაფია` → `/explorer/demography`." (keep the rest of that sentence); in "Only the active dataset's sections nest beneath it: …" append ", or Demography's published pages (Population)"; replace "- `უმუშევრობა`, `დემოგრაფია` — `ink-fg-muted` labels with a `მალე` badge" with "- `უმუშევრობა` — an `ink-fg-muted` label with a `მალე` badge".
3. §6.3, in the keys table after the `Inflation cities` row, add: `| Demography population | \`sel\`, \`level\`, \`map\`, \`view\`, \`range=all\` or \`start\`/\`end\` | \`sel\` holds place ids, Tbilisi as \`region.tbilisi\` at either level; \`map=density\` needs \`level=regions\`. |` (the write rule above it already applies: every change replaces the history entry).
4. Append a new section at the end of the file:

> ## 27. Demography surfaces
>
> The sidebar's fourth dataset link, `დემოგრაფია`, opens a hub at `/explorer/demography`: the shared hub cards numbered 01–04, where a page that is not yet published is a non-clickable `მალე` card. The Population card carries Georgia's series as a sparkline broken at the census re-base.
>
> **Population page** (`/explorer/demography/population`): header, serif H1 and a one-line unit statement, then the map block, the standard workspace and the highlights. The map block opens with one row of three controls: a pill `საქართველო` (the Measure Pill style, pressed while Georgia alone is selected), a joined control `რეგიონები / მუნიციპალიტეტები` and a joined control `მოსახლეობა / სიმჭიდროვე`; density is disabled below the regions, with its reason as visible text. The maps are the regional-economy map and the budget municipalities map, unchanged in outline, hatching, legend and keyboard movement; a place is a button, choosing it replaces the selection, and every selected place is outlined 2.4px in `ink` above its neighbours (a city dot takes an ink ring and the hover size). Maps show the latest loaded year only and carry the census note. The places list is the standard series panel with the two levels as grouping tabs; ticking a place adds a line to the chart and an outline on the map.
>
> **The census re-base** applies wherever a population-based value is drawn: a marked series is drawn in two segments, never joined across 1 January 2025; a dashed vertical rule (`4 3`) sits between the 2024 and 2025 positions with the short label `აღწერით გადათვლა` (11px mono, on the side with room); tables carry a 2px ink rule left of the 2025 column with the label on its header; the range strip marks 2025; tooltips and workbooks name each year's basis in plain words. No growth, change or rank movement is shown for any pair of years that spans the re-base. This page adds no colour token: Georgia is `ink`, and regions and municipalities cycle the editorial palette by their registry order so a place keeps its colour on every page. Bounded decisions: `docs/superpowers/specs/2026-10-04-demography-section-design.md` and `docs/superpowers/specs/2026-10-04-demography-population-design.md`.

`docs/data-methodology/demography.md`: replace the first sentence block of "## Delivery boundary" (the text up to "…belong to the page stage.") with: "The Population page ships first. `/explorer/demography/population` serves the 1 January population (`demography-population-annual.csv`) and density (`demography-density-annual.csv`) through the serving mirror (`DemographyFact`, migration `20261004000000_demography`), the hub `/explorer/demography` links it, and `/methodology/demography` archives the two Geostat originals it serves. Every other canonical file stays stored and unserved: each later page adds its files to the served list, flips its `live` flag and extends the methodology page in the same change. No MCP tool, bulk download, Dataset markup or per-resident indicator is approved." Keep the rest of the paragraph (from "The thirteen canonical inputs…") unchanged.

- [ ] **Step 2: Write the browser spec**

`apps/web/tests/browser/demography-population.spec.ts`:

```ts
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

for (const [locale, prefix, heading, coverage] of [
  ["ka", "", "მოსახლეობა", "2004–2026 · 1 იანვრის მდგომარეობით"],
  ["en", "/en", "Population", "2004–2026 · as of 1 January"],
] as const) {
  test(`${locale}: the Population page opens on Georgia with the map, chart, list and highlights`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography/population`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toContainText(coverage);
    await expect(page.locator("[data-region-map-target]")).toHaveCount(11);
    await expect(page.getByTestId("population-georgia-pill")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-break")).toHaveCount(1);
    await expect(page.getByTestId("series-row")).toHaveCount(12);
    await expect(page.getByTestId("population-highlights")).toContainText("3,941,103");
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);
    await expect(page.getByTestId("population-excel-download")).toBeEnabled();
  });

  test(`${locale}: the hub lists four pages and links the live one`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography`);
    await expect(page.getByTestId("demography-hub").getByTestId("hub-card")).toHaveCount(4);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveCount(1);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveAttribute("href", `${prefix}/explorer/demography/population`);
    await expect(page.getByTestId("demography-link")).toHaveAttribute("aria-current", "page");
  });
}

test("choosing a region replaces the selection, ticking adds a line and the Georgia pill resets", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.locator('[data-region-id="region.imereti"]').click();
  await expect(page).toHaveURL(/sel=region\.imereti(&|$)/);
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(1);
  await expect(page.getByTestId("population-highlights")).toContainText("Imereti");
  await expect(page.getByTestId("population-georgia-pill")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("series-row").filter({ hasText: "Kakheti" }).getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(2);
  await page.getByTestId("population-mode-table").click();
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(2);

  await page.getByTestId("population-georgia-pill").click();
  await expect(page.getByTestId("population-georgia-pill")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(0);
});

test("a region is a keyboard button", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.locator('[data-region-id="region.adjara"]').focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/sel=region\.adjara(&|$)/);
});

test("municipalities: density is disabled with a reason, a municipality can be chosen and Tbilisi is one place", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("population-measure-density").click();
  await expect(page.getByTestId("population-measure-density")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("regional-map-legend")).toContainText("persons per km²");
  await expect(page.getByTestId("population-map-block")).toContainText("504.24");

  await page.getByTestId("population-level-municipalities").click();
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await expect(page.getByTestId("population-measure-density")).toBeDisabled();
  await expect(page.getByTestId("population-density-note")).toBeVisible();
  await expect(page).toHaveURL(/level=municipalities/);
  await expect(page).toHaveURL(/map=population/);

  await page.getByTestId("municipality-shape-11").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("population-highlights")).toContainText("Khulo");
  await expect(page.getByTestId("municipality-chosen-11")).toHaveCount(1);

  await page.getByTestId("municipality-marker-04").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/sel=region\.tbilisi(&|$)/);
  await page.getByTestId("population-mode-table").click();
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(1);
  await page.getByTestId("population-level-regions").click();
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(1);
});

test("the census re-base is a gap in the chart and a rule in the table", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await expect(page.getByTestId("chart-break")).toContainText("Census re-base");
  await page.getByTestId("population-mode-table").click();
  const header = page.getByTestId("explorer-table").locator("thead th", { hasText: "2025" });
  await expect(header).toContainText("Census re-base");
  expect(await header.evaluate((cell) => getComputedStyle(cell).borderLeftWidth)).toBe("2px");
  await expect(page.getByTestId("population-census-note")).toContainText("re-based the population to the 2024 census");
});

test("the Excel download has three sheets and numeric population", async ({ page }, testInfo) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  const pending = page.waitForEvent("download");
  await page.getByTestId("population-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-demography-population-2004-2026-en.xlsx");
  const file = testInfo.outputPath("population.xlsx");
  await download.saveAs(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(book.getWorksheet("Data")!.getCell("A2").value).toBe("Georgia");
  expect(book.getWorksheet("Data")!.getCell("D2").value).toBe(3_937_716);
});

test("the sidebar shows the demography group with the page current", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/demography/population");
  await ready(page);
  await expect(page.getByTestId("demography-population-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("data-sidebar").getByText("მალე", { exact: true })).toHaveCount(1);
});

for (const width of [390, 768, 900, 1100, 1440]) {
  test(`the hub and the Population page have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/explorer/demography", "/explorer/demography/population", "/en/explorer/demography/population"]) {
      await page.goto(path);
      if (path.endsWith("/population")) await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at ${width}px`).toBe(true);
    }
  });
}
```

Add the payload guard for the two new routes in `apps/web/tests/browser/main-explorer.spec.ts`, test "ships no unread provenance columns on the dataset routes": append `"/explorer/demography",` and `"/explorer/demography/population",` to its route list, and change the app-ready exemption `["/explorer/economy", "/explorer/economy/regions"]` to `["/explorer/economy", "/explorer/economy/regions", "/explorer/demography"]` (the hub is a link map with no client explorer). The guard then proves the Population page ships no `sourceLocator`, `valuation`, `priceBasis`, `calculation` or `snapshotDate`, as foundation §4 requires.

- [ ] **Step 3: The done-check, run once** (CLAUDE.md: the gates are not progress checks)

Run from `apps/web`, in this order, and keep the output:

```bash
npm run check
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build
```
then, for the browser suite, serve the production build once and run all tests against it (four workers, 116 s against 264 s; stop the server before rebuilding):

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```
Expected: `npm run check` (lint, typecheck, unit tests, data validation, `i18n:check`) passes; the build passes and its `postbuild` publication checks pass; the whole Playwright suite passes. A failure that is not in a file this plan touched is first re-run alone (`xlsx-download` and request specs flake under load, per `CLAUDE.md`), and reported with its output if it persists.

- [ ] **Step 4: Prove the page in a browser before claiming it**

With the production server running, open `/explorer/demography/population` and `/en/explorer/demography/population` and capture: the default view; Imereti chosen on the map; the municipality level with Khulo chosen; the density map; the table view at the 2025 rule; and the page at 390, 768, 900, 1100 and 1440px with the sidebar open and collapsed. Read the console and network for errors. If a disposable database is available, also run `GEODATA_DATA_SOURCE=db npm run build` and report that the CSV and database builds produced the same routes; otherwise say the database path is proved by the first deploy-time import only.

- [ ] **Step 5: Report to the owner in plain language, then commit**

The report lists: what shipped (hub, Population, methodology, Excel), the evidence (gate outputs, screenshots), the Georgian strings for review (every key in `lib/i18n/messages/ka/demography.json`, the two `common` labels, the methodology text in `lib/methodology/content/demography.ts`, the Georgian titles of the two originals in `data/methodology/source-archives/demography.csv`, and the six Georgian source descriptions for density and the census in `data/localization/ka/service-messages.json` that foundation §9 schedules for this plan), the choices that are theirs (one merge or several; the `AGENTS.md` census-break line and its route-family snapshot sentence, both deliberately left alone), and what is not done (Plans 2–4, a page per place, MCP and downloads).

```bash
git add ../../Project_Definition.md ../../DESIGN.md ../../docs/data-methodology/demography.md tests/browser/demography-population.spec.ts tests/browser/main-explorer.spec.ts
git commit -m "docs(demography): record the Population stage, add browser coverage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Foundation §4 serving path: table, loader, import, parity, payload | 1, 2, 3, 4 |
| Foundation §5 census re-base R1 (chart), R2 (table), R3 (range strip), R4 (no cross-break figure), R6 (plain-language basis) | 5, 8, 10, 12 (R5 and R7 belong to later pages) |
| Foundation §6 shared component changes | 4, 5, 6, 7 (two small control additions in 12) |
| Foundation §3, §3.1: hub, sidebar, breadcrumb, footer, choosing a place on the map | 6, 7, 12, 14 |
| Foundation §9 language; §10 SEO; §11 methodology; §12 Excel | 11 and 14; 14 and 15; 13; 10 and 12 |
| Foundation §13 gates and canonical documents | 3 (import document), 16 |
| Population §2 data, anchors, Tbilisi as one place | 2, 8, 9 |
| Population §4 map block; §5 workspace; §6 highlights; §7 state | 6, 7, 9, 12; 5, 8, 12; 8, 12; 8, 12 |
| Population §11 tests and acceptance | in each task; browser in 16; the disposable-database proof is Task 3 step 6 |

## What this plan leaves to the owner

- Whether Plan 1 merges alone or waits for Plans 2–4 (each merge to `main` deploys), and whether the specs and this plan are committed to the branch first (they are untracked today).
- The `AGENTS.md` census-break non-negotiable and the route-family sentence in its Project Snapshot: deliberately not touched here.
- The Georgian drafts (Task 11, Task 13 and the six density and census source descriptions in `data/localization/ka/service-messages.json`) and the six open decisions at the end of the Population spec (choosing a place replaces the selection; latest-year maps; green city dots; density only on the map and in Excel; no change figure; a page per place later).

## Verification status of this plan

Run before this plan was written: the place and population model with 26 of its tests, against the real CSVs (all passed), which also exercised the loader code in Task 2; Prisma's own `migrate diff` output, which matches the migration in Task 1; the anchor values, row counts, regional and municipal sums and trailing-zero decimals in the two CSVs; the SHA-256 and sizes in the methodology manifest; and the methodology content through the repository's real translation validator (no errors). Everything else here is written from reading the code and has not been executed: expect small compile or lint corrections while each task's failing test is turned green, and report any that change a design decision instead of patching around them.

Reviewed against the repository on 2026-10-05. Every file anchor, prop, signature, message key and pinned test count this plan edits was checked in the current code, and the code blocks for the model, loader and canonical reader are identical to the copies that were run. The review corrected: Khulo's 2026 value in the map tests (16,098; 16,307 is 2025); the missing `municipal` message scope, without which the municipality map's legend throws; three browser-test pins the plan had missed (the two sitemap counts in `seo.spec.ts` and the methodology sitemap list in `methodology.spec.ts`); URL history, which now replaces the entry as DESIGN.md §6.3 requires instead of pushing one per click; the `/methodology` data catalog, which no longer names demography as a Dataset; the workspace grid, which now reuses `ExplorerWorkspace`; the reuse map's list of new files; the population route files' style; and the hash-key and owner-review wording.

