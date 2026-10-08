# Demography Migration Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/explorer/demography/migration` and `/en/explorer/demography/migration`: arrivals above and departures below a zero line by six citizenship groups with a net-migration line, a table, a range strip, an all/men/women filter, four key figures, Excel, a methodology section, and the hub card, sidebar, sitemap and `llms.txt` switched on.

**Architecture:** The Demography serving layer (`DemographyFact` mirror, `importDemography.ts`) already exists for Population; it gains one file, `demography-migration-annual.csv`, and a per-series basis rule. A pure model (`lib/explorer/demographyMigration.ts`) turns the served rows into per-group, per-direction yearly values plus hash state and key figures. One client component draws it with existing parts only: `StackedColumnChart` (unchanged; departures are passed as negative values), `ExplorerTable`, `RangeStrip`, `SeriesSelector`, `SegmentedTabs`, `HeroKpi`/`SideKpiList`, `ExcelDownloadButton`. Flipping the page's `live` flag in `DEMOGRAPHY_PAGES` drives the hub card, sidebar link, sitemap and i18n inventory.

**Tech Stack:** Next.js 16 static prerender, React 19, strict TypeScript, Tailwind v4, vitest (`renderToStaticMarkup`), Playwright, exceljs.

**Spec:** `docs/superpowers/specs/2026-10-04-demography-migration-design.md` (revised and owner-approved 2026-10-09). Read it, and `docs/superpowers/specs/2026-10-04-demography-section-design.md` §7 (colours) and §9 (labels), before any task.

## Global Constraints

- Branch `claude/demographic-data-next-steps-ec11b1` (worktree `.claude/worktrees/demographic-data-next-steps-ec11b1`), based on `main` at `a7b24bd8`. Local commits only: do not push, open a pull request or merge. Delivery is a separate owner decision after Task 8.
- All paths are relative to `apps/web` unless they start with `docs/`, `data/` or `public/` (those are repository-root paths; `public/` is `apps/web/public`). Run commands from `apps/web`.
- Reuse First (`AGENTS.md`): no new shared component, no change to `StackedColumnChart`, `ExplorerTable`, `RangeStrip`, `SeriesSelector`, `kpi-blocks` or the workbook writer. If a step seems to need one, stop and report.
- Migration counts do not break at the 1 January 2025 census re-base: no break marker, no `breaks`, no `breakYears` on this page.
- No sentence names a cause or an event (no "war", "2022 influx", etc.).
- The group `citizenship.all_other_computed` is always labelled as computed and never as a country.
- Default view: all six groups selected; the net line follows the selection; foreign citizens' share of arrivals is the third side figure (owner, 2026-10-09).
- Departures are negative values in the chart (and printed with "−" there); in the table, key figures and Excel they are positive counts under a departures heading.
- URL state follows DESIGN.md §6.3: restored after load, loading never writes the URL, every change replaces the history entry (`useReplaceHash`).
- English pages carry no Georgian in visible text, attributes, metadata or JSON-LD. No Dataset JSON-LD, no MCP tool, no bulk download for demography; `BreadcrumbList` JSON-LD only.
- Georgian is canonical. Every Georgian string you add is a draft for the owner: list each new key and its text in your task report.
- Windows traps: plain `npx vitest run` skips `pretest`, so first run `npm run data:prepare-fact-query-snapshot` once; never run `next dev` (it rewrites the tracked `apps/web/AGENTS.md`), verify UI on a production build with `next start`; kill any server on :3100 before rebuilding; repository files are LF.
- While editing run only the task's tests. The full gates run once, in Task 8.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Reuse inventory

| Need | Existing piece | Change |
| --- | --- | --- |
| Serving mirror, loader, parity, import transaction | `DemographyFact`, `importDemography.ts`, `scripts/import-budget-facts.ts` | one more file; basis rule per series |
| Client projection | `lib/explorer/clientData.ts`, `lib/servedRows.ts` | one projection + one type |
| Page shell, heading, breadcrumbs | `ExplorerPage`, `PageHeader`, `ExplorerHeading`, `BreadcrumbJsonLd` | none |
| Workspace, aside, chart, table, range, tick-list, tabs | `ExplorerWorkspace`, `SeriesAside`, `StackedColumnChart`, `ExplorerTable`, `RangeStrip`, `SeriesSelector`/`SeriesSelectorRow`, `SegmentedTabs`, `Callout`, `SourceNote` | none |
| Key figures | `HeroKpi`, `SideKpiList`, `KPI_GRID_CLASS`, `Sparkline` | none |
| URL state | `useReplaceHash`, `parseYearRangeKeys`/`writeYearRangeKeys`, `refitRange`/`resolveRange`/`rangeFromPatch` | none |
| Excel | `WorkbookExportModel`, `workbookFilename`, `SHEET_NAMES`, `withAbsoluteUrls`, `ExcelDownloadButton`, `downloadWorkbook` | none |
| Sources | `loadPopulationSources` (loads the whole demography archive manifest) | none |
| Hub, sidebar, sitemap, inventory | `DEMOGRAPHY_PAGES` `live` flag, `buildDemographyHubCards` | flag; a migration card figure |
| New | `demographyMigration.ts`, `demographyMigrationWorkbook.ts`, `components/demography/demography-migration.tsx`, `lib/pages/demography-migration.tsx`, two route files | Trade's and Population's bodies are built around their own indicators and places; Unemployment's composition chart is the same pattern, so this page is assembled from the same parts |

---

### Task 1: Serve the migration file

**Files:**
- Modify: `lib/data/demography/importDemography.ts`, `lib/data/servedData.ts:67-68`, `scripts/import-budget-facts.ts:271-274`, `lib/pages/demography-population.tsx` (`loadPopulationBasics`)
- Test: `tests/data/demography/servingBoundary.test.ts`, `tests/data/demography/importDemography.test.ts`, `tests/explorer/demographyPages.test.tsx`

**Interfaces:**
- Produces: `SERVED_DEMOGRAPHY_FILES` gains `"../../data/imports/demography-migration-annual.csv"`; `SERVED_DATA_FILES.demographyMigrationFacts` (same path); `loadServedDemographyData()` now returns 2,846 rows (923 population, 145 density, 1,778 migration); `loadPopulationBasics(locale)` still returns only population and density rows (1,068).

- [ ] **Step 1: Failing tests.** In `tests/data/demography/servingBoundary.test.ts` change both `1_068` to `2_846`. In `tests/data/demography/importDemography.test.ts`: add the migration path to the expected `SERVED_DEMOGRAPHY_FILES` list (third entry); change the basis assertion near line 54 to

```ts
    const migration = new Set<string>(FAMILIES.migration);
    expect(facts.filter((row) => !migration.has(row.seriesId)).every((row) => row.estimateBasis === populationEstimateBasis(row.year))).toBe(true);
    expect(facts.filter((row) => migration.has(row.seriesId)).every((row) => row.estimateBasis === "border_police")).toBe(true);
    expect(facts.filter((row) => migration.has(row.seriesId))).toHaveLength(1_778);
```
(import `FAMILIES` from `../../../lib/data/demography/series`); add `"source.geostat_demography_migration_citizenship"` and `"source.geostat_demography_net_migration"` to the sorted source-id list near line 81 in sorted position; and add a case

```ts
  test("a migration row with a population basis is rejected", () => {
    const row = facts.find((fact) => fact.seriesId === SERIES.netMigration)!;
    expect(() => assertDemographyParity(facts, facts.map((fact) => (fact === row ? { ...fact, estimateBasis: "pre_census" as const } : fact)))).toThrow(/basis/);
  });
```
In `tests/explorer/demographyPages.test.tsx` add to the `population index page` describe:

```ts
  it("hands the Population pages only population and density rows", async () => {
    const { facts, clientFacts } = await loadPopulationBasics("en");
    expect(facts).toHaveLength(1_068);
    expect(new Set(clientFacts.map((fact) => fact.seriesId))).toEqual(new Set([SERIES.populationTotal, SERIES.populationDensity]));
  });
```
(import `loadPopulationBasics` from `../../lib/pages/demography-population` and `SERIES` if not already imported). Run `npx vitest run tests/data/demography/servingBoundary.test.ts tests/data/demography/importDemography.test.ts tests/explorer/demographyPages.test.tsx`: the new and changed cases FAIL.

- [ ] **Step 2: Implement the loader.** In `lib/data/demography/importDemography.ts`:

```ts
import { FAMILIES, populationEstimateBasis, SERIES } from "./series";
import type { DemographyObservation, EstimateBasis, ServedDemographyObservation } from "./types";

export const SERVED_DEMOGRAPHY_FILES = [
  "../../data/imports/demography-population-annual.csv",
  "../../data/imports/demography-density-annual.csv",
  "../../data/imports/demography-migration-annual.csv",
] as const;

// The migration file is mirrored whole (all five migration series), as the import mirrors files as they are.
const MIGRATION_SERIES = new Set<string>(FAMILIES.migration);
const SERVED_SERIES = new Set<string>([SERIES.populationTotal, SERIES.populationDensity, ...MIGRATION_SERIES]);

/** Population and density follow the lineage of their year; migration is border-police data in every year. */
function expectedBasis(fact: DemographyObservation): EstimateBasis {
  return MIGRATION_SERIES.has(fact.seriesId) ? "border_police" : populationEstimateBasis(fact.year);
}
```
and in `validateServedDemography` replace the basis check with

```ts
    const expected = expectedBasis(fact);
    if (fact.estimateBasis !== expected) {
      throw new Error(`Demography basis ${fact.estimateBasis} is not ${expected} in ${fact.year} for ${fact.seriesId}|${fact.geographyId}`);
    }
```
Update the comment above `validateServedDemography` to say "every row's basis is the one its series and year require". (The old message said "lineage"; the existing test at line 118 matches `/lineage/` — change that expectation to `/basis/`.)

- [ ] **Step 3: Served-data list and import script.** In `lib/data/servedData.ts` add after `demographyDensityFacts`:

```ts
  demographyMigrationFacts: "../../data/imports/demography-migration-annual.csv",
```
In `scripts/import-budget-facts.ts` add `SERVED_DATA_FILES.demographyMigrationFacts,` as the third path passed to `loadDemographyFacts([...])`. Nothing else in the script changes: the `createMany` already maps `sex` and `citizenshipId`, and the parity check and the `{ table: "DemographyFact", ... }` report count whatever was loaded.

- [ ] **Step 4: Keep Population's payload unchanged.** In `lib/pages/demography-population.tsx` `loadPopulationBasics`, filter before anything else uses the rows:

```ts
  const [{ facts: served }, municipal, georgian] = await Promise.all([
    loadServedDemographyData(),
    loadServedMunicipalData(),
    getMessages("ka", ["demography"]),
  ]);
  // The served rows include other demography pages' series; the Population pages carry only their own two.
  const facts = served.filter((fact) => fact.seriesId === SERIES.populationTotal || fact.seriesId === SERIES.populationDensity);
```
(`SERIES` is already imported in that file.)

- [ ] **Step 5: Run.** `npx vitest run tests/data/demography tests/explorer/demographyPages.test.tsx tests/explorer/demographyHub.test.ts tests/explorer/populationPlaceExplorer.test.tsx tests/explorer/populationPlacePages.test.tsx` and `npm run typecheck`: PASS. If any other test pins 1,068 or the served-file list (search `grep -rn "1_068\|1068\|SERVED_DEMOGRAPHY_FILES" tests`), update it with the derived value and say so in the report.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(demography): serve the migration file through the demography mirror

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The migration model, state and key figures

**Files:**
- Create: `lib/explorer/demographyMigration.ts`
- Modify: `lib/servedRows.ts` (type), `lib/explorer/clientData.ts` (projection), `lib/explorer/demographyRoutes.ts` (path constant)
- Test: `tests/explorer/demographyMigration.test.ts`

**Interfaces:**
- Consumes: `loadServedDemographyData()` (Task 1).
- Produces:
  - `lib/servedRows.ts`: `export type ClientMigrationFact = { seriesId: string; year: number; sex: "total" | "male" | "female"; citizenshipId: string; value: number }`
  - `lib/explorer/clientData.ts`: `projectMigrationObservation(fact: ServedDemographyObservation): ClientMigrationFact`
  - `lib/explorer/demographyRoutes.ts`: `export const MIGRATION_PATH = "/explorer/demography/migration"` (used by `DEMOGRAPHY_PAGES`)
  - `lib/explorer/demographyMigration.ts`: `MIGRATION_SERIES`, `MIGRATION_GROUPS`, `type MigrationGroup`, `MIGRATION_COLORS`, `MIGRATION_SEXES`, `MIGRATION_DIRECTIONS`, `type MigrationDirection`, `type MigrationState`, `DEFAULT_MIGRATION_STATE`, `migrationCoverage(facts)`, `parseMigrationHash(hash, facts)`, `serializeMigrationHash(state)`, `type MigrationModel`, `buildMigrationModel(facts, state)`, `type MigrationIndicators`, `buildMigrationIndicators(facts, state)`.

- [ ] **Step 1: Failing test.** Create `tests/explorer/demographyMigration.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectMigrationObservation } from "../../lib/explorer/clientData";
import {
  buildMigrationIndicators,
  buildMigrationModel,
  DEFAULT_MIGRATION_STATE,
  MIGRATION_GROUPS,
  MIGRATION_SERIES,
  migrationCoverage,
  parseMigrationHash,
  serializeMigrationHash,
  type MigrationState,
} from "../../lib/explorer/demographyMigration";
import type { ClientMigrationFact } from "../../lib/servedRows";

let facts: ClientMigrationFact[];
beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
});

const state = (patch: Partial<MigrationState> = {}): MigrationState => ({ ...DEFAULT_MIGRATION_STATE, ...patch });

describe("migration rows", () => {
  it("serves only the two group series and the net, 2012–2025", () => {
    expect(facts).toHaveLength(518);
    expect(migrationCoverage(facts)).toEqual({ min: 2012, max: 2025, years: Array.from({ length: 14 }, (_, i) => 2012 + i) });
    expect(Object.keys(facts[0]!).sort()).toEqual(["citizenshipId", "seriesId", "sex", "value", "year"]);
  });
});

describe("buildMigrationModel", () => {
  it("holds the published anchors with all six groups", () => {
    const model = buildMigrationModel(facts, state());
    expect(model.allSelected).toBe(true);
    expect([model.totals.arrivals[2012], model.totals.departures[2012], model.totals.net[2012]]).toEqual([69_063, 90_584, -21_521]);
    expect([model.totals.arrivals[2022], model.totals.departures[2022], model.totals.net[2022]]).toEqual([179_778, 125_269, 54_509]);
    expect([model.totals.arrivals[2023], model.totals.departures[2023], model.totals.net[2023]]).toEqual([205_857, 245_064, -39_207]);
    expect([model.totals.arrivals[2025], model.totals.departures[2025], model.totals.net[2025]]).toEqual([131_501, 114_374, 17_127]);
    expect(model.byDirection.arrivals["citizenship.russian_federation"][2022]).toBe(62_304);
    expect(model.byDirection.arrivals["citizenship.ukraine"][2022]).toBe(20_716);
  });

  it("equals Geostat's published net in every year when all groups are selected", () => {
    const model = buildMigrationModel(facts, state());
    for (const year of model.years) expect(model.totals.net[year], String(year)).toBe(model.publishedNet[year]);
  });

  it("adds men and women to both sexes for every group, year and direction", () => {
    const [total, male, female] = (["total", "male", "female"] as const).map((sex) => buildMigrationModel(facts, state({ sex })));
    for (const direction of ["arrivals", "departures"] as const) {
      for (const group of MIGRATION_GROUPS) {
        for (const year of total!.years) {
          expect(male!.byDirection[direction][group][year]! + female!.byDirection[direction][group][year]!, `${direction} ${group} ${year}`).toBe(
            total!.byDirection[direction][group][year],
          );
        }
      }
    }
    expect([male!.totals.net[2025], female!.totals.net[2025]]).toEqual([9_611, 7_516]);
  });

  it("nets the selected groups only, and empty selection gives no totals", () => {
    const withoutRussia = buildMigrationModel(facts, state({ selectedIds: MIGRATION_GROUPS.filter((id) => id !== "citizenship.russian_federation") }));
    expect(withoutRussia.allSelected).toBe(false);
    expect(withoutRussia.totals.net[2023]).toBe(-56_490);
    const none = buildMigrationModel(facts, state({ selectedIds: [] }));
    expect(none.totals.arrivals[2023]).toBeNull();
  });

  it("limits years to the range", () => {
    const model = buildMigrationModel(facts, state({ range: { kind: "manual", start: 2021, end: 2025 } }));
    expect(model.years).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(model.range).toMatchObject({ start: 2021, end: 2025, min: 2012, max: 2025 });
  });
});

describe("buildMigrationIndicators", () => {
  it("describes the range's end year for the chosen sex and all groups, whatever is selected", () => {
    const all = buildMigrationIndicators(facts, state({ selectedIds: ["citizenship.turkey"] }));
    expect(all).toMatchObject({ year: 2025, net: 17_127, cumulativeNet: -26_795, arrivals: 131_501, departures: 114_374 });
    expect(all.foreignShare).toBeCloseTo(0.52797, 4);
    expect(all.sparks.arrivals).toHaveLength(14);
    const range = buildMigrationIndicators(facts, state({ range: { kind: "manual", start: 2021, end: 2023 } }));
    expect(range).toMatchObject({ year: 2023, net: -39_207 });
    expect(range.foreignShare).toBeCloseTo(0.55359, 4);
    expect(buildMigrationIndicators(facts, state({ sex: "female" })).net).toBe(7_516);
  });
});

describe("migration hash", () => {
  it("round-trips and keeps the default address short", () => {
    expect(serializeMigrationHash(DEFAULT_MIGRATION_STATE)).toBe("view=line&range=all");
    const changed = state({ mode: "table", sex: "male", direction: "net", selectedIds: ["citizenship.georgia", "citizenship.ukraine"], range: { kind: "manual", start: 2015, end: 2020 } });
    expect(parseMigrationHash(`#${serializeMigrationHash(changed)}`, facts)).toEqual(changed);
  });

  it("rejects unknown values, removes duplicates, keeps an explicit empty selection and clamps the range", () => {
    expect(parseMigrationHash("#sex=child&dir=sideways&view=pie", facts)).toEqual(DEFAULT_MIGRATION_STATE);
    expect(parseMigrationHash("#sel=citizenship.ukraine,citizenship.ukraine,citizenship.mars", facts).selectedIds).toEqual(["citizenship.ukraine"]);
    expect(parseMigrationHash("#sel=", facts).selectedIds).toEqual([]);
    expect(parseMigrationHash("#start=1990&end=2018", facts).range).toEqual({ kind: "manual", start: 2012, end: 2018 });
  });
});
```
Run `npx vitest run tests/explorer/demographyMigration.test.ts`: FAIL ("Cannot find module").

- [ ] **Step 2: Client type and projection.** In `lib/servedRows.ts`, after `ClientDemographyObservation`:

```ts
/** A migration row as the Migration page receives it: one direction, sex and citizenship group in one year, in persons. */
export type ClientMigrationFact = {
  seriesId: string;
  year: number;
  sex: "total" | "male" | "female";
  citizenshipId: string;
  value: number;
};
```
In `lib/explorer/clientData.ts`, after `projectDemographyObservation` (add `ClientMigrationFact` to its `servedRows` import):

```ts
export function projectMigrationObservation(fact: ServedDemographyObservation): ClientMigrationFact {
  return {
    seriesId: fact.seriesId,
    year: fact.year,
    sex: fact.sex ?? "total",
    citizenshipId: fact.citizenshipId ?? "citizenship.total",
    value: fact.value,
  };
}
```
In `lib/explorer/demographyRoutes.ts` add `export const MIGRATION_PATH = "/explorer/demography/migration";` under `POPULATION_PATH` and use `path: MIGRATION_PATH` in the `migration` entry of `DEMOGRAPHY_PAGES` (`live` stays `false` until Task 5).

- [ ] **Step 3: The model.** Create `lib/explorer/demographyMigration.ts`:

```ts
import { SERIES } from "../data/demography/series";
import type { ClientMigrationFact } from "../servedRows";
import { OTHER_COLOR } from "./colors";
import { refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

/** The three series the page reads; the mirror holds the whole migration file. */
export const MIGRATION_SERIES: readonly string[] = [
  SERIES.immigrantsByCitizenshipGroup,
  SERIES.emigrantsByCitizenshipGroup,
  SERIES.netMigration,
];

/** The reviewed groups in their fixed page order: Georgia, the four named countries, then the computed remainder. */
export const MIGRATION_GROUPS = [
  "citizenship.georgia",
  "citizenship.russian_federation",
  "citizenship.turkey",
  "citizenship.azerbaijan",
  "citizenship.ukraine",
  "citizenship.all_other_computed",
] as const;
export type MigrationGroup = (typeof MIGRATION_GROUPS)[number];

/** Section spec §7: one stable colour per group, the computed remainder in the shared "other" colour. */
export const MIGRATION_COLORS: Record<MigrationGroup, string> = {
  "citizenship.georgia": "#3D5A98",
  "citizenship.russian_federation": "#C26E4C",
  "citizenship.turkey": "#1F6E56",
  "citizenship.azerbaijan": "#A5822B",
  "citizenship.ukraine": "#7A4E8C",
  "citizenship.all_other_computed": OTHER_COLOR,
};

export const MIGRATION_SEXES = ["total", "male", "female"] as const;
export type MigrationSex = (typeof MIGRATION_SEXES)[number];
export const MIGRATION_DIRECTIONS = ["arrivals", "departures", "net"] as const;
export type MigrationDirection = (typeof MIGRATION_DIRECTIONS)[number];

export type MigrationState = {
  mode: "line" | "table";
  range: PeriodRange;
  selectedIds: MigrationGroup[];
  sex: MigrationSex;
  /** The table's direction tab; the chart always shows both directions. */
  direction: MigrationDirection;
};

export const DEFAULT_MIGRATION_STATE: MigrationState = {
  mode: "line",
  range: { kind: "all" },
  selectedIds: [...MIGRATION_GROUPS],
  sex: "total",
  direction: "arrivals",
};

export function migrationCoverage(facts: readonly ClientMigrationFact[]) {
  const years = [...new Set(facts.filter((fact) => fact.seriesId === SERIES.immigrantsByCitizenshipGroup).map((fact) => fact.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error("No migration years");
  return { min: years[0]!, max: years.at(-1)!, years };
}

function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** An absent `sel` means all six groups; an explicit empty `sel=` stays empty. Unknown values fall back to the default. */
export function parseMigrationHash(hash: string, facts: readonly ClientMigrationFact[]): MigrationState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const requested = params.has("sel") ? params.get("sel")!.split(",") : [...MIGRATION_GROUPS];
  return {
    mode: params.get("view") === "table" ? "table" : "line",
    range: refitRange(parseYearRangeKeys(params), migrationCoverage(facts), { collapseToAll: true }),
    selectedIds: MIGRATION_GROUPS.filter((id) => requested.includes(id)),
    sex: pick(MIGRATION_SEXES, params.get("sex"), "total"),
    direction: pick(MIGRATION_DIRECTIONS, params.get("dir"), "arrivals"),
  };
}

export function serializeMigrationHash(state: MigrationState): string {
  const params = new URLSearchParams({ view: state.mode });
  if (state.selectedIds.length !== MIGRATION_GROUPS.length) params.set("sel", state.selectedIds.join(","));
  if (state.sex !== "total") params.set("sex", state.sex);
  if (state.direction !== "arrivals") params.set("dir", state.direction);
  writeYearRangeKeys(params, state.range);
  return params.toString();
}

type ByYear = Record<number, number | null>;

export type MigrationModel = {
  range: ResolvedPeriodRange;
  years: number[];
  selectedIds: MigrationGroup[];
  allSelected: boolean;
  /** Every group in the chosen sex, whatever is selected. Departures are positive counts here. */
  byDirection: Record<MigrationDirection, Record<MigrationGroup, ByYear>>;
  /** The sum over the selected groups; null when nothing is selected or a value is missing. */
  totals: Record<MigrationDirection, ByYear>;
  /** Geostat's published net for both sexes, for the identity check. */
  publishedNet: ByYear;
};

function sum(values: readonly (number | null)[]): number | null {
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + value!, 0);
}

export function buildMigrationModel(facts: readonly ClientMigrationFact[], state: MigrationState): MigrationModel {
  const coverage = migrationCoverage(facts);
  const range = resolveRange(state.range, coverage);
  const years = coverage.years.filter((year) => year >= range.start && year <= range.end);
  const cell = new Map<string, number>();
  for (const fact of facts) cell.set(`${fact.seriesId}|${fact.sex}|${fact.citizenshipId}|${fact.year}`, fact.value);
  const seriesOf = (seriesId: string, group: MigrationGroup): ByYear =>
    Object.fromEntries(years.map((year) => [year, cell.get(`${seriesId}|${state.sex}|${group}|${year}`) ?? null]));
  const arrivals = Object.fromEntries(MIGRATION_GROUPS.map((group) => [group, seriesOf(SERIES.immigrantsByCitizenshipGroup, group)])) as Record<MigrationGroup, ByYear>;
  const departures = Object.fromEntries(MIGRATION_GROUPS.map((group) => [group, seriesOf(SERIES.emigrantsByCitizenshipGroup, group)])) as Record<MigrationGroup, ByYear>;
  const net = Object.fromEntries(
    MIGRATION_GROUPS.map((group) => [
      group,
      Object.fromEntries(years.map((year) => {
        const [inflow, outflow] = [arrivals[group][year], departures[group][year]];
        return [year, inflow === null || outflow === null ? null : inflow - outflow];
      })),
    ]),
  ) as Record<MigrationGroup, ByYear>;
  const byDirection = { arrivals, departures, net };
  const selectedIds = MIGRATION_GROUPS.filter((id) => state.selectedIds.includes(id));
  const totalOf = (direction: MigrationDirection): ByYear =>
    Object.fromEntries(years.map((year) => [year, sum(selectedIds.map((group) => byDirection[direction][group][year]))]));
  return {
    range,
    years,
    selectedIds,
    allSelected: selectedIds.length === MIGRATION_GROUPS.length,
    byDirection,
    totals: { arrivals: totalOf("arrivals"), departures: totalOf("departures"), net: totalOf("net") },
    publishedNet: Object.fromEntries(years.map((year) => [year, cell.get(`${SERIES.netMigration}|total|citizenship.total|${year}`) ?? null])),
  };
}

export type MigrationIndicators = {
  year: number;
  net: number | null;
  /** The sum of the yearly nets over the active range. */
  cumulativeNet: number | null;
  arrivals: number | null;
  departures: number | null;
  /** Arrivals who are not Georgian citizens, as a fraction of all arrivals. */
  foreignShare: number | null;
  sparks: { arrivals: (number | null)[]; departures: (number | null)[]; foreignShare: (number | null)[] };
};

/** The key figures: the range's end year, the chosen sex, all six groups whatever the selection. */
export function buildMigrationIndicators(facts: readonly ClientMigrationFact[], state: MigrationState): MigrationIndicators {
  const all = buildMigrationModel(facts, { ...state, selectedIds: [...MIGRATION_GROUPS] });
  const year = all.range.end;
  const share = (at: number): number | null => {
    const total = all.totals.arrivals[at] ?? null;
    const georgia = all.byDirection.arrivals["citizenship.georgia"][at] ?? null;
    return total === null || georgia === null || total === 0 ? null : (total - georgia) / total;
  };
  return {
    year,
    net: all.totals.net[year] ?? null,
    cumulativeNet: sum(all.years.map((at) => all.totals.net[at] ?? null)),
    arrivals: all.totals.arrivals[year] ?? null,
    departures: all.totals.departures[year] ?? null,
    foreignShare: share(year),
    sparks: {
      arrivals: all.years.map((at) => all.totals.arrivals[at] ?? null),
      departures: all.years.map((at) => all.totals.departures[at] ?? null),
      foreignShare: all.years.map(share),
    },
  };
}
```

- [ ] **Step 4: Run.** `npx vitest run tests/explorer/demographyMigration.test.ts tests/explorer/demographyHub.test.ts` and `npm run typecheck`: PASS. If `serializeMigrationHash(DEFAULT_MIGRATION_STATE)` differs from `"view=line&range=all"` only because `writeYearRangeKeys` writes a different key, read `lib/explorer/urlState.ts` and fix the test's expected string to what it writes (report it); do not change `urlState.ts`.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(demography): the migration model, address state and key figures" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 3: The Excel workbook

**Files:**
- Create: `lib/explorer/demographyMigrationWorkbook.ts`
- Modify: `lib/i18n/messages/ka/demography.json`, `lib/i18n/messages/en/demography.json` (workbook keys only)
- Test: `tests/explorer/demographyMigrationWorkbook.test.ts`

**Interfaces:**
- Consumes: `buildMigrationModel`, `MIGRATION_GROUPS`, `MigrationState`, `ClientMigrationFact` (Task 2); `loadPopulationSources(locale)` from `lib/pages/demography-population.tsx` returns `(WorkbookPublicSource & { sourceId: string })[]` for every row of the demography archive manifest (Task 6 adds the two migration rows).
- Produces: `buildMigrationWorkbookExportModel(input: { facts; state; sources; siteOrigin }, presentation: Presentation): WorkbookExportModel`.

- [ ] **Step 1: Messages.** Add to `lib/i18n/messages/ka/demography.json` and `en/demography.json` (same keys, both files; keep the files' existing order and append at the end):

| key | ka | en |
| --- | --- | --- |
| `demography.migrationWorkbookTitle` | `მიგრაცია მოქალაქეობის მიხედვით` | `Migration by citizenship` |
| `demography.migrationGroupsNote` | `„სხვა მოქალაქეობები“ — ყველა დანარჩენი მოქალაქეობა, მოქალაქეობის არმქონე პირები, მოქალაქეობა მითითებული არ არის და საქსტატის „სხვა“, შეჯამებული Fiscal.ge-ის მიერ` | `"All other citizenships" is every other citizenship, stateless persons, not stated and Geostat's own Other, added up by Fiscal.ge` |
| `demography.directionHeader` | `მიმართულება` | `Direction` |
| `demography.citizenshipHeader` | `მოქალაქეობა` | `Citizenship` |
| `demography.sexHeader` | `სქესი` | `Sex` |
| `demography.personsHeader` | `ადამიანი` | `Persons` |
| `demography.dirArrivals` | `შემოსვლა` | `Arrivals` |
| `demography.dirDepartures` | `გასვლა` | `Departures` |
| `demography.dirNet` | `წმინდა` | `Net` |
| `demography.netLabel` | `წმინდა მიგრაცია` | `Net migration` |
| `demography.netSelectedLabel` | `წმინდა მიგრაცია (არჩეული ჯგუფები)` | `Net migration (selected groups)` |
| `demography.sexTotal` | `ყველა` | `All` |
| `demography.sexMale` | `მამაკაცები` | `Men` |
| `demography.sexFemale` | `ქალები` | `Women` |
| `demography.group.citizenship.georgia` | `საქართველო` | `Georgia` |
| `demography.group.citizenship.russian_federation` | `რუსეთი` | `Russia` |
| `demography.group.citizenship.turkey` | `თურქეთი` | `Turkey` |
| `demography.group.citizenship.azerbaijan` | `აზერბაიჯანი` | `Azerbaijan` |
| `demography.group.citizenship.ukraine` | `უკრაინა` | `Ukraine` |
| `demography.group.citizenship.all_other_computed` | `სხვა მოქალაქეობები (გამოთვლილი)` | `All other citizenships (computed)` |

- [ ] **Step 2: Failing test.** Create `tests/explorer/demographyMigrationWorkbook.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectMigrationObservation } from "../../lib/explorer/clientData";
import { DEFAULT_MIGRATION_STATE, MIGRATION_SERIES } from "../../lib/explorer/demographyMigration";
import { buildMigrationWorkbookExportModel } from "../../lib/explorer/demographyMigrationWorkbook";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientMigrationFact } from "../../lib/servedRows";

const GEORGIAN = /\p{Script=Georgian}/u;
let facts: ClientMigrationFact[];
const presentations = {} as Record<Locale, Presentation>;
const sources = [
  { sourceId: "source.geostat_demography_migration_citizenship", years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], title: "Immigrants and emigrants", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/33.xlsx" as const, retrievedAt: "2026-10-01" },
  { sourceId: "source.geostat_municipal_population", years: [2025], title: "Population", organization: "Geostat", downloadHref: "/downloads/methodology/demography/files/01.xlsx" as const, retrievedAt: "2026-10-01" },
];

beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
  for (const locale of ["ka", "en"] as const) presentations[locale] = await getPresentation(locale, ["demography", "workbook"], []);
});

describe("migration workbook", () => {
  it("groups arrivals and departures with their totals and ends with the net, for the active range, groups and sex", () => {
    const state = { ...DEFAULT_MIGRATION_STATE, range: { kind: "manual" as const, start: 2022, end: 2023 } };
    const model = buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin: "https://fiscal.ge" }, presentations.en);
    expect(model.filename).toBe("fiscal-demography-migration-2022-2023-en.xlsx");
    expect(model.readable.years).toEqual([2022, 2023]);
    const labels = model.readable.rows.map((row) => `${row.kind}:${row.parentLabel ?? ""}:${row.label}`);
    expect(labels[0]).toBe("group::Arrivals");
    expect(labels[7]).toBe("group::Departures");
    expect(labels.at(-1)).toBe("total::Net migration");
    expect(model.readable.rows).toHaveLength(15);
    expect(model.readable.rows[0]!.valuesByYear).toEqual({ 2022: 179_778, 2023: 205_857 });
    expect(model.readable.rows[7]!.valuesByYear).toEqual({ 2022: 125_269, 2023: 245_064 });
    expect(model.readable.rows.at(-1)!.valuesByYear).toEqual({ 2022: 54_509, 2023: -39_207 });
    expect(model.readable.subtitle).toContain("All other citizenships");
    expect(model.analysis.headers).toEqual(["Year", "Direction", "Citizenship", "Sex", "Persons"]);
    expect(model.analysis.rows).toHaveLength(2 * 2 * 6);
    expect(model.analysis.rows[0]).toEqual([2022, "Arrivals", "Georgia", "All", expect.any(Number)]);
    expect(model.sources.map((source) => source.title)).toEqual(["Immigrants and emigrants"]);
    expect(model.sources[0]!.years).toEqual([2022, 2023]);
    expect(JSON.stringify(model)).not.toMatch(GEORGIAN);
  });

  it("follows the sex filter and the selection, and labels the net as the selected groups' net", () => {
    const state = { ...DEFAULT_MIGRATION_STATE, sex: "female" as const, selectedIds: ["citizenship.georgia" as const], range: { kind: "manual" as const, start: 2025, end: 2025 } };
    const model = buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin: "https://fiscal.ge" }, presentations.ka);
    expect(model.filename).toBe("fiscal-demography-migration-2025-2025.xlsx");
    expect(model.readable.rows).toHaveLength(5);
    expect(model.readable.rows.at(-1)!.label).toBe("წმინდა მიგრაცია (არჩეული ჯგუფები)");
    expect(model.analysis.rows.every((row) => row[3] === "ქალები")).toBe(true);
  });
});
```
Run it: FAIL ("Cannot find module").

- [ ] **Step 3: Implement.** Create `lib/explorer/demographyMigrationWorkbook.ts`:

```ts
import { SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientMigrationFact } from "../servedRows";
import { buildMigrationModel, type MigrationDirection, type MigrationGroup, type MigrationState } from "./demographyMigration";
import {
  SHEET_NAMES,
  withAbsoluteUrls,
  workbookFilename,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  type WorkbookReadableRow,
} from "./workbookModel";

const SEX_KEYS = { total: "sexTotal", male: "sexMale", female: "sexFemale" } as const;
const DIRECTION_KEYS = { arrivals: "dirArrivals", departures: "dirDepartures", net: "dirNet" } as const;

export function buildMigrationWorkbookExportModel(
  input: {
    facts: readonly ClientMigrationFact[];
    state: MigrationState;
    sources: readonly (WorkbookPublicSource & { sourceId: string })[];
    siteOrigin: string;
  },
  presentation: Presentation,
): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const model = buildMigrationModel(input.facts, input.state);
  const groupLabel = (group: MigrationGroup) => t(`group.${group}`);
  const published = (values: Record<number, number | null>) =>
    Object.fromEntries(model.years.map((year) => [year, values[year] === null || values[year] === undefined ? null : ("published" as const)]));
  const row = (kind: WorkbookReadableRow["kind"], parentLabel: string | null, label: string, values: Record<number, number | null>): WorkbookReadableRow => ({
    kind, parentLabel, label, change: null, valuesByYear: Object.fromEntries(model.years.map((year) => [year, values[year] ?? null])), basisByYear: published(values),
  });
  const block = (direction: Exclude<MigrationDirection, "net">) => {
    const heading = t(DIRECTION_KEYS[direction]);
    return [
      row("group", null, heading, model.totals[direction]),
      ...model.selectedIds.map((group) => row("item", heading, groupLabel(group), model.byDirection[direction][group])),
    ];
  };
  const rows = model.selectedIds.length
    ? [...block("arrivals"), ...block("departures"), row("total", null, t(model.allSelected ? "netLabel" : "netSelectedLabel"), model.totals.net)]
    : [];
  const originals = input.sources
    .filter((source) => model.selectedIds.length > 0 && (source.sourceId === SOURCE_ID.migrationCitizenship || source.sourceId === SOURCE_ID.netMigration))
    .map(({ sourceId: _sourceId, ...source }) => ({ ...source, years: source.years.filter((year) => model.years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  const unitLabel = t("personsHeader");
  return {
    locale,
    filename: workbookFilename(`demography-migration-${model.range.start}-${model.range.end}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t("migrationWorkbookTitle"),
      subtitle: `${model.range.start}–${model.range.end} · ${t(SEX_KEYS[input.state.sex])} · ${unitLabel} · ${t("migrationGroupsNote")}`,
      unitLabel,
      amountDecimals: 0,
      showChangeColumn: false,
      years: model.years,
      // Net migration is signed; its sign is neither good nor bad, so it is not shown in red.
      numberFormat: "#,##0;−#,##0",
      rows,
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("directionHeader"), t("citizenshipHeader"), t("sexHeader"), unitLabel],
      rows: model.years.flatMap((year) =>
        (["arrivals", "departures"] as const).flatMap((direction) =>
          model.selectedIds.map((group) => [year, t(DIRECTION_KEYS[direction]), groupLabel(group), t(SEX_KEYS[input.state.sex]), model.byDirection[direction][group][year] ?? null]),
        ),
      ),
      numericFormats: { 5: "#,##0" },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
```
Both originals are cited (spec §7): the citizenship table the rows come from and the net-migration table the net agrees with. The computed group's definition sits in the Summary subtitle, because the Sources sheet has no free-text line (a small, recorded departure from spec §7's wording).

- [ ] **Step 4: Run.** `npx vitest run tests/explorer/demographyMigrationWorkbook.test.ts tests/explorer/demographyMigration.test.ts`, `npm run typecheck`, `npm run i18n:check`: PASS. If `i18n:check` reports a key used in one language only, you edited one file; fix the other.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(demography): the migration Excel workbook" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 4: The migration explorer component

**Files:**
- Create: `components/demography/demography-migration.tsx`
- Modify: `lib/i18n/messages/{ka,en}/demography.json` (page keys)
- Test: `tests/explorer/demographyMigrationExplorer.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces: `export function MigrationExplorer(props: { facts: ClientMigrationFact[]; sources: (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; sourceNote: ReactNode }): JSX.Element` — the workspace, the aside and the key-figures section (the page module renders the heading and unit line above it).

- [ ] **Step 1: Messages.** Add to both demography message files:

| key | ka | en |
| --- | --- | --- |
| `demography.migrationMetaTitle` | `მიგრაცია — დემოგრაფია` | `Migration — Demography` |
| `demography.migrationUnitLine` | `ადამიანი წელიწადში` | `persons per year` |
| `demography.migrationCoverage` | `{first}–{last} · წლიური` | `{first}–{last} · annual` |
| `demography.columns` | `სვეტები` | `Columns` |
| `demography.sexAria` | `სქესი` | `Sex` |
| `demography.directionAria` | `მიმართულება` | `Direction` |
| `demography.segment` | `{direction} · {group}` | `{direction} · {group}` |
| `demography.chartUnit` | `ათასი ადამიანი` | `thousand persons` |
| `demography.chartAria` | `შემოსული და გასული მიგრანტები მოქალაქეობის მიხედვით, {start}–{end}` | `Immigrants and emigrants by citizenship, {start}–{end}` |
| `demography.migrationTableCaption` | `{direction} · ადამიანი · {start}–{end}` | `{direction} · persons · {start}–{end}` |
| `demography.totalAll` | `ჯამი` | `Total` |
| `demography.totalSelected` | `არჩეულთა ჯამი` | `Total of selected` |
| `demography.migrationSearch` | `მოქალაქეობის ძიება` | `Search citizenships` |
| `demography.migrationEmpty` | `აირჩიეთ ერთი მოქალაქეობა მაინც.` | `Select at least one citizenship.` |
| `demography.asideCaption` | `{year} · შემოსვლა / გასვლა` | `{year} · arrivals / departures` |
| `demography.heroNetLabel` | `წმინდა მიგრაცია · {year}` | `Net migration · {year}` |
| `demography.heroMoreArrived` | `შემოვიდა მეტი ადამიანი, ვიდრე გავიდა.` | `More people arrived than left.` |
| `demography.heroMoreLeft` | `გავიდა მეტი ადამიანი, ვიდრე შემოვიდა.` | `More people left than arrived.` |
| `demography.heroBalanced` | `შემოვიდა იმდენივე ადამიანი, რამდენიც გავიდა.` | `As many people arrived as left.` |
| `demography.heroCumulative` | `{start}–{end} ჯამში: {value}` | `{start}–{end} in total: {value}` |
| `demography.sideArrivals` | `შემოსული` | `Arrivals` |
| `demography.sideDepartures` | `გასული` | `Departures` |
| `demography.sideForeignShare` | `უცხო მოქალაქეების წილი შემოსულებში` | `Foreign citizens' share of arrivals` |
| `demography.migrationIndicatorsNote` | `ინდიკატორები აჩვენებს პერიოდის ბოლო წელს, არჩეული სქესისთვის და ყველა მოქალაქეობისთვის. უცხო მოქალაქეები = ყველა შემოსული, საქართველოს მოქალაქეების გარდა.` | `The indicators describe the last year of the period for the chosen sex and all citizenships. Foreign citizens are all arrivals except citizens of Georgia.` |
| `demography.migrationSource` | `წყარო: საქსტატი — იმიგრანტები და ემიგრანტები სქესისა და მოქალაქეობის მიხედვით და მიგრაციის სალდო, {start}–{end} (შსს-ის სასაზღვრო მონაცემები). „სხვა მოქალაქეობები“, არჩეული ჯგუფების წმინდა მიგრაცია და უცხო მოქალაქეების წილი გამოთვლილია Fiscal.ge-ის მიერ.` | `Source: Geostat — immigrants and emigrants by sex and citizenship, and net migration, {start}–{end} (Ministry of Internal Affairs border records). "All other citizenships", the net migration of selected groups and the foreign citizens' share are computed by Fiscal.ge.` |

- [ ] **Step 2: Failing test.** Create `tests/explorer/demographyMigrationExplorer.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { MigrationExplorer } from "../../components/demography/demography-migration";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectMigrationObservation } from "../../lib/explorer/clientData";
import { MIGRATION_SERIES } from "../../lib/explorer/demographyMigration";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientMigrationFact } from "../../lib/servedRows";

const GEORGIAN = /\p{Script=Georgian}/u;
let facts: ClientMigrationFact[];
const presentations = {} as Record<Locale, Presentation>;

beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
  for (const locale of ["ka", "en"] as const) {
    presentations[locale] = await getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook"], []);
  }
});

const render = (locale: Locale) =>
  renderToStaticMarkup(
    <I18nProvider {...presentations[locale]}>
      <MigrationExplorer facts={facts} sources={[]} siteOrigin="https://fiscal.ge" sourceNote="Source." />
    </I18nProvider>,
  );

describe("MigrationExplorer", () => {
  it("opens on columns with all six groups, both directions and the net line", () => {
    const html = render("en");
    expect(html).toContain('data-testid="migration-explorer"');
    expect((html.match(/data-testid="series-row"/g) ?? []).length).toBe(6);
    expect(html).toContain("Arrivals · Russia");
    expect(html).toContain("Departures · Russia");
    expect(html).toContain("All other citizenships (computed)");
    expect(html).toContain("Net migration:");
    expect(html).not.toContain("Net migration (selected groups)");
    expect(html).toContain('data-testid="migration-sex-total"');
  });

  it("shows the four key figures for 2025", () => {
    const html = render("en");
    expect(html).toContain("Net migration · 2025");
    expect(html).toContain("+17,127");
    expect(html).toContain("More people arrived than left.");
    expect(html).toContain("2012–2025 in total: −26,795");
    expect(html).toContain("131,501");
    expect(html).toContain("114,374");
    expect(html).toContain("52.8%");
    expect((html.match(/data-testid="side-kpi"/g) ?? []).length).toBe(3);
  });

  it("has no Georgian in the English render and no cause words", () => {
    const html = render("en");
    expect(html.replace(/<script[\s\S]*?<\/script>/g, "")).not.toMatch(GEORGIAN);
    expect(html).not.toMatch(/\bwar\b|invasion|because/i);
  });

  it("renders in Georgian", () => {
    const html = render("ka");
    expect(html).toContain("შემოსვლა · რუსეთი");
    expect(html).toContain("წმინდა მიგრაცია · 2025");
  });
});
```
Run it: FAIL ("Cannot find module").

- [ ] **Step 3: Implement.** Create `components/demography/demography-migration.tsx`:

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  buildMigrationIndicators,
  buildMigrationModel,
  DEFAULT_MIGRATION_STATE,
  MIGRATION_COLORS,
  MIGRATION_DIRECTIONS,
  MIGRATION_GROUPS,
  MIGRATION_SEXES,
  migrationCoverage,
  parseMigrationHash,
  serializeMigrationHash,
  type MigrationDirection,
  type MigrationGroup,
  type MigrationSex,
  type MigrationState,
} from "../../lib/explorer/demographyMigration";
import { buildMigrationWorkbookExportModel } from "../../lib/explorer/demographyMigrationWorkbook";
import { INK } from "../../lib/explorer/colors";
import { formatInUnit, formatShare, UNIT_PERSONS } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientMigrationFact } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { Callout, SectionTitle, SegmentedTabs, SourceNote } from "../ui/editorial";

const SEX_KEYS = { total: "sexTotal", male: "sexMale", female: "sexFemale" } as const;
const DIRECTION_KEYS = { arrivals: "dirArrivals", departures: "dirDepartures", net: "dirNet" } as const;
/** The chart draws thousands, so its axis stays short; every printed value is converted back to whole persons. */
const CHART_SCALE = 1_000;

const persons = (value: number | null | undefined) => formatInUnit(value, UNIT_PERSONS);
const signedPersons = (value: number | null | undefined) =>
  value === null || value === undefined ? persons(value) : `${value > 0 ? "+" : ""}${persons(value)}`;

export function MigrationExplorer({
  facts,
  sources,
  siteOrigin,
  sourceNote,
}: {
  facts: ClientMigrationFact[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  /** Inline content only: it renders inside the source note's paragraph. */
  sourceNote: ReactNode;
}) {
  const presentation = useI18n();
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [state, setState] = useState<MigrationState>(DEFAULT_MIGRATION_STATE);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(parseMigrationHash(window.location.hash, facts));
    setReady(true);
  }, [facts]);
  useAppReady();
  useReplaceHash(serializeMigrationHash(state), ready);

  const update = (change: (previous: MigrationState) => MigrationState) => setState(change);
  const model = buildMigrationModel(facts, state);
  const indicators = buildMigrationIndicators(facts, state);
  const groupLabel = (group: MigrationGroup) => t(`group.${group}`);
  const direction = (id: MigrationDirection) => t(DIRECTION_KEYS[id]);
  const matches = (group: MigrationGroup) => matchesLabelQuery(query, [groupLabel(group)]);
  const netLabel = t(model.allSelected ? "netLabel" : "netSelectedLabel");
  const scaled = (values: Record<number, number | null>, sign: 1 | -1) =>
    model.years.map((year) => (values[year] === null || values[year] === undefined ? null : (sign * values[year]!) / CHART_SCALE));

  const segments = (["arrivals", "departures"] as const).flatMap((id) =>
    model.selectedIds.map((group) => ({
      id: `${id}:${group}`,
      label: t("segment", { direction: direction(id), group: groupLabel(group) }),
      color: MIGRATION_COLORS[group],
      values: scaled(model.byDirection[id][group], id === "arrivals" ? 1 : -1),
    })),
  );
  const tableRows = model.selectedIds.map((group) => ({
    itemId: group,
    kaLabel: groupLabel(group),
    color: MIGRATION_COLORS[group],
    valuesByYear: model.byDirection[state.direction][group],
  }));
  const totalRow = model.selectedIds.length
    ? { itemId: "migration.total", kaLabel: t(model.allSelected ? "totalAll" : "totalSelected"), color: INK, valuesByYear: model.totals[state.direction] }
    : null;
  const end = model.range.end;
  const net = indicators.net;
  const heroSentence = net === null ? null : t(net > 0 ? "heroMoreArrived" : net < 0 ? "heroMoreLeft" : "heroBalanced");

  return (
    <div data-testid="migration-explorer" className="@container">
      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SegmentedTabs
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => update((s) => ({ ...s, mode }))}
                options={[
                  { value: "line", label: t("columns"), testId: "chart-mode-line" },
                  { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                ]}
              />
              <SegmentedTabs
                ariaLabel={t("sexAria")}
                value={state.sex}
                onChange={(sex: MigrationSex) => update((s) => ({ ...s, sex }))}
                options={MIGRATION_SEXES.map((sex) => ({ value: sex, label: t(SEX_KEYS[sex]), testId: `migration-sex-${sex}` }))}
              />
            </div>
            {!model.selectedIds.length ? (
              <div className="mt-5"><Callout testId="no-selection-callout">{t("migrationEmpty")}</Callout></div>
            ) : state.mode === "line" ? (
              <div className="mt-5">
                <p className="mb-2 text-[11px] text-[var(--muted)]">{t("chartUnit")}</p>
                <StackedColumnChart
                  periods={model.years}
                  periodsPerYear={1}
                  segments={segments}
                  overlay={{ label: netLabel, values: scaled(model.totals.net, 1) }}
                  formatPeriod={String}
                  formatValue={(value) => signedPersons(Math.round(value * CHART_SCALE))}
                  ariaLabel={t("chartAria", { start: model.range.start, end })}
                />
              </div>
            ) : (
              <div className="mt-5">
                <SegmentedTabs
                  ariaLabel={t("directionAria")}
                  value={state.direction}
                  onChange={(id: MigrationDirection) => update((s) => ({ ...s, direction: id }))}
                  options={MIGRATION_DIRECTIONS.map((id) => ({ value: id, label: direction(id), testId: `migration-direction-${id}` }))}
                />
                <div className="mt-4">
                  <ExplorerTable
                    caption={t("migrationTableCaption", { direction: direction(state.direction), start: model.range.start, end })}
                    rows={tableRows}
                    totalRow={totalRow}
                    showTotal={totalRow !== null}
                    wrapRowLabels
                    rowLabelsLocalized
                    years={model.years}
                    firstColumnLabel={t("citizenshipHeader")}
                    unit={UNIT_PERSONS}
                    share={false}
                    showChangeColumn={false}
                    shareValueForYear={() => null}
                  />
                </div>
              </div>
            )}
            <RangeStrip
              years={migrationCoverage(facts).years}
              range={model.range}
              onChange={(patch) => update((s) => ({ ...s, range: rangeFromPatch(buildMigrationModel(facts, s).range, patch) }))}
            />
          </section>
          <div className="mt-[18px]"><SourceNote testId="source-label">{sourceNote}</SourceNote></div>
        </div>
        <SeriesAside label={message(messages, "controls.series")}>
          <p className="mb-3 text-[11px] text-[var(--muted)]">{t("asideCaption", { year: end })}</p>
          <SeriesSelector
            query={query}
            onQueryChange={setQuery}
            searchPlaceholder={t("migrationSearch")}
            selectedCount={model.selectedIds.length}
            totalCount={MIGRATION_GROUPS.length}
            hasSelection={model.selectedIds.length > 0}
            allSelected={model.allSelected}
            onToggleAll={() => update((s) => ({ ...s, selectedIds: s.selectedIds.length ? [] : [...MIGRATION_GROUPS] }))}
            hasVisibleMatches={MIGRATION_GROUPS.some(matches)}
          >
            {MIGRATION_GROUPS.filter(matches).map((group) => (
              <SeriesSelectorRow
                key={group}
                id={group}
                label={groupLabel(group)}
                color={MIGRATION_COLORS[group]}
                value={persons(model.byDirection.arrivals[group][end])}
                meta={persons(model.byDirection.departures[group][end])}
                selected={model.selectedIds.includes(group)}
                level="item"
                wrapLabel
                onToggle={() =>
                  update((s) => ({
                    ...s,
                    selectedIds: s.selectedIds.includes(group) ? s.selectedIds.filter((id) => id !== group) : [...s.selectedIds, group],
                  }))
                }
              />
            ))}
          </SeriesSelector>
          <ExcelDownloadButton
            testId="migration-excel-download"
            disabled={!model.selectedIds.length}
            onDownload={async () => {
              const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
              await downloadWorkbook(buildMigrationWorkbookExportModel({ facts, state, sources, siteOrigin }, presentation));
            }}
          />
        </SeriesAside>
      </ExplorerWorkspace>
      <section data-testid="migration-highlights" data-end-year={indicators.year} className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <div className={KPI_GRID_CLASS}>
          <HeroKpi label={t("heroNetLabel", { year: indicators.year })} value={signedPersons(net)}>
            {heroSentence ? <p className="text-[0.78125rem] leading-relaxed text-[var(--body)]">{heroSentence}</p> : null}
            <p className="mt-2 font-[family-name:var(--font-numeric)] text-[0.75rem] text-[var(--muted)]">
              {t("heroCumulative", { start: model.range.start, end, value: signedPersons(indicators.cumulativeNet) })}
            </p>
          </HeroKpi>
          <SideKpiList
            kpis={[
              { label: t("sideArrivals"), value: persons(indicators.arrivals), unit: "", color: INK, detail: String(indicators.year), spark: { values: indicators.sparks.arrivals, color: INK } },
              { label: t("sideDepartures"), value: persons(indicators.departures), unit: "", color: INK, detail: String(indicators.year), spark: { values: indicators.sparks.departures, color: INK } },
              { label: t("sideForeignShare"), value: formatShare(indicators.foreignShare), unit: "", color: INK, detail: String(indicators.year), spark: { values: indicators.sparks.foreignShare, color: INK } },
            ]}
          />
        </div>
        <div className="mt-5"><SourceNote>{t("migrationIndicatorsNote")}</SourceNote></div>
      </section>
    </div>
  );
}
```
Notes for the implementer: if `SeriesSelectorRow` needs `metaLabel` to show `meta` (read `components/main-explorer/series-selector.tsx`), pass `metaLabel={t("sideDepartures")}`. If `ExplorerTable`'s `totalRow` type rejects the plain object, give it the same shape as `tableRows`' elements (it is the same shape). Do not change any shared component.

- [ ] **Step 4: Run.** `npx vitest run tests/explorer/demographyMigrationExplorer.test.tsx`, `npm run typecheck`, `npx eslint components/demography/demography-migration.tsx`, `npm run i18n:check`: PASS. If a test value fails because of formatting (for example the share prints `52.8 %`), read the formatter, confirm the rendered value is right, and align the assertion; report it.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(demography): the migration explorer: columns, table, groups, sex filter and key figures" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 5: The page, its routes, the hub card and discovery

**Files:**
- Create: `lib/pages/demography-migration.tsx`, `app/(ka)/explorer/demography/migration/page.tsx`, `app/(en)/en/explorer/demography/migration/page.tsx`
- Modify: `lib/explorer/demographyRoutes.ts` (`live: true`), `lib/explorer/demographyHubCards.ts`, `lib/i18n/messages/{ka,en}/demography.json` (card footer), `data/localization/en/page-revisions.json`, `public/llms.txt`
- Test: `tests/explorer/demographyHub.test.ts`, `tests/explorer/demographyPages.test.tsx`, `tests/explorer/demographyDiscovery.test.ts`, `tests/explorer/demographySidebar.test.tsx`, `tests/seo/agentFiles.test.ts`, `tests/seo/routes.test.ts`, then every pin the two new URLs move.

**Interfaces:**
- Consumes: `MigrationExplorer` (Task 4), `projectMigrationObservation`, `MIGRATION_SERIES`, `migrationCoverage` (Task 2), `loadPopulationSources` and `loadServedDemographyData`.
- Produces: `demographyMigrationPageMetadata(locale)`, `renderDemographyMigrationPage(locale)`.

- [ ] **Step 1: Failing tests.**
  - `tests/explorer/demographyHub.test.ts`: live pages become `["population", "migration"]`; card hrefs `["/explorer/demography/population", null, "/explorer/demography/migration", null]`; `comingSoon` `[false, true, false, true]`; add

```ts
  it("draws the migration card from Geostat's published net", async () => {
    const { facts } = await loadServedDemographyData();
    const presentation = await getPresentation("en", ["demography"], []);
    const card = buildDemographyHubCards(facts, presentation)[2]!;
    expect(card.series).toHaveLength(14);
    expect(card.footer).toBe("2025: net migration +17,127 · 2012–2025");
  });
```
  (reuse the file's existing imports; add `getPresentation` from `../../lib/i18n/presentation.server` if missing).
  - `tests/explorer/demographyPages.test.tsx`: the hub's `aria-disabled="true"` count `3` → `2`, and add `expect(html).toContain('href="/en/explorer/demography/migration"');` next to the population link assertion. Add a describe:

```tsx
describe("migration page", () => {
  it("renders the heading, coverage, breadcrumb and the explorer, with no dataset markup", async () => {
    const html = renderToStaticMarkup(await renderDemographyMigrationPage("en"));
    expect(html).toContain(">Migration</h1>");
    expect(html).toContain("2012–2025 · annual");
    expect(html).toContain("persons per year");
    expect(html).toContain('data-testid="migration-explorer"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).toContain('href="/en/methodology/demography"');
  });

  it("has its own canonical address and title", async () => {
    const metadata = await demographyMigrationPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/migration");
    expect(String(metadata.title)).toBe("მიგრაცია — დემოგრაფია | Fiscal.ge");
  });
});
```
  (import both functions from `../../lib/pages/demography-migration`; if the existing canonical test stubs `NEXT_PUBLIC_SITE_URL`, do the same here.)
  - `tests/explorer/demographyDiscovery.test.ts`: add `"/explorer/demography/migration"` to `PAGES` and to the dated-pages list.
  - `tests/explorer/demographySidebar.test.tsx`: add a case rendering `/en/explorer/demography/migration` that expects `'data-testid="demography-migration-link" aria-current="page"'` and that the population link is present without `aria-current`.
  - `tests/seo/agentFiles.test.ts`: add `"https://fiscal.ge/explorer/demography/migration",` after the population URL.
  Run `npx vitest run tests/explorer/demographyHub.test.ts tests/explorer/demographyPages.test.tsx tests/explorer/demographyDiscovery.test.ts tests/explorer/demographySidebar.test.tsx tests/seo/agentFiles.test.ts`: FAIL.

- [ ] **Step 2: The page module.** Create `lib/pages/demography-migration.tsx`:

```tsx
import Link from "next/link";
import { MigrationExplorer } from "../../components/demography/demography-migration";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { projectMigrationObservation } from "../explorer/clientData";
import { MIGRATION_SERIES, migrationCoverage } from "../explorer/demographyMigration";
import { DEMOGRAPHY_HUB_PATH, MIGRATION_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationSources } from "./demography-population";

export async function demographyMigrationPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: MIGRATION_PATH,
    title: `${message(p.messages, "demography.migrationMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.migrationDescription"),
  });
}

export async function renderDemographyMigrationPage(locale: Locale) {
  const [{ facts: served }, sources, presentation] = await Promise.all([
    loadServedDemographyData(),
    loadPopulationSources(locale),
    getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook"], []),
  ]);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  // Only the three series the page reads go to the browser (518 rows), never the whole mirrored file.
  const facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
  const { min: first, max: last } = migrationCoverage(facts);
  const title = t("migrationTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  const sourceNote = (
    <>
      {t("migrationSource", { start: first, end: last })}{" "}
      <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
        {message(messages, "common.methodology")}
      </Link>.
    </>
  );
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(MIGRATION_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("migrationCoverage", { first, last })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] text-[13px] text-[var(--body)]">{t("migrationUnitLine")}</p>
        <MigrationExplorer facts={facts} sources={sources} siteOrigin={resolveSiteUrl()} sourceNote={sourceNote} />
      </ExplorerPage>
    </I18nProvider>
  );
}
```
Check how `lib/pages/demography-population-place.tsx` obtains `siteOrigin` (it imports `resolveSiteUrl` from `../siteUrl`) and use the same call; if its signature differs, follow that file.

- [ ] **Step 3: Routes.** Create `app/(ka)/explorer/demography/migration/page.tsx`:

```tsx
import { demographyMigrationPageMetadata, renderDemographyMigrationPage } from "../../../../../lib/pages/demography-migration";

export function generateMetadata() {
  return demographyMigrationPageMetadata("ka");
}

export default function Page() {
  return renderDemographyMigrationPage("ka");
}
```
and `app/(en)/en/explorer/demography/migration/page.tsx` with one more `../` in the import and `"en"` in both calls.

- [ ] **Step 4: Live flag and hub card.** In `lib/explorer/demographyRoutes.ts` set the migration entry's `live: true`. In both demography message files add `demography.migrationCardFooter`: ka `{year}: წმინდა მიგრაცია {net} · {first}–{last}`, en `{year}: net migration {net} · {first}–{last}`. In `lib/explorer/demographyHubCards.ts`, compute Georgia's published net once above the `map` and give the migration card its figure:

```ts
  const net = facts.filter((fact) => fact.seriesId === SERIES.netMigration).sort((left, right) => left.year - right.year);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${formatInUnit(value, UNIT_PERSONS)}`;
```
and inside the `map`, before the population branch:

```ts
    if (page.id === "migration" && page.live && net.length) {
      const [firstNet, lastNet] = [net[0]!, net.at(-1)!];
      return {
        ...card,
        series: net.map((fact) => fact.value),
        seriesColor: INK,
        footer: t("migrationCardFooter", { year: lastNet.year, net: signed(lastNet.value), first: firstNet.year, last: lastNet.year }),
      };
    }
```
(Net migration has no census break, so no gap is inserted, unlike the population card.)

- [ ] **Step 5: Revisions and llms.txt.** In `data/localization/en/page-revisions.json` add `"/explorer/demography/migration": "2026-10-09",` directly after the `"/explorer/demography/population"` entry and set `"/explorer/demography"` to `"2026-10-09"` (the hub's card changes). In `public/llms.txt` change the Demography line's "only Population is published so far" to "Population and Migration are published so far", and add after the Population line:

```text
- [Migration](https://fiscal.ge/explorer/demography/migration) — immigrants and emigrants for Georgia, 2012–2025, by sex and six citizenship groups (Georgia, Russia, Turkey, Azerbaijan, Ukraine, and all other citizenships added up by Fiscal.ge), with net migration. Border-crossing records: citizenship is not country of birth or residence. Browse-only: there is no MCP tool and no bulk file for demography.
```
If `tests/seo/agentFiles.test.ts` pins `llms.txt` line order or a link count, update it by the derived amount.

- [ ] **Step 6: Recount every pin.** Run `npx vitest run tests/seo tests/i18n tests/explorer tests/methodology` and `npm run i18n:check`. Expected moves from two new URLs (ka + en): sitemap `438 → 440` (`tests/seo/routes.test.ts:58`; the browser pins `tests/browser/seo.spec.ts:440,457` change the same way), public page identities `+1` (whatever `i18n:check` reported before, plus one), `tests/browser/bilingual-complete.spec.ts:8` `219 → 220`. For each failure, read what the number counts, derive the new value, change it and any comment that explains it; never set a number you did not derive. List every file and number in the report.

- [ ] **Step 7: Run and commit.** `npx vitest run tests/explorer/demographyHub.test.ts tests/explorer/demographyPages.test.tsx tests/explorer/demographyDiscovery.test.ts tests/explorer/demographySidebar.test.tsx tests/seo`, `npm run typecheck`: PASS. `git add -A && git commit -m "feat(demography): publish the Migration page in the hub, sidebar, sitemap and llms.txt" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 6: The methodology page

**Files:**
- Modify: `data/methodology/source-archives/demography.csv`, `lib/methodology/content/demography.ts`, `lib/methodology/content/en/demography.ts`
- Test: `tests/explorer/demographyPages.test.tsx` (`population sources`), `tests/methodology/*` (run), the methodology archive tests

**Interfaces:**
- Produces: `loadPopulationSources(locale)` returns four rows (adds `source.geostat_demography_migration_citizenship` and `source.geostat_demography_net_migration`), so the migration workbook cites its original.

- [ ] **Step 1: Failing test.** In `tests/explorer/demographyPages.test.tsx`, `population sources`: add the two migration ids to `REVIEWED_SOURCE_IDS` (sorted) and change `toHaveLength(2)` to `toHaveLength(4)`. Run it: FAIL.

- [ ] **Step 2: Archive rows.** Append to `data/methodology/source-archives/demography.csv` (UTF-8 with BOM, LF; keep the BOM on line 1):

```csv
source.geostat_demography_migration_citizenship,demography,2012-2025,საქსტატი,იმიგრანტებისა და ემიგრანტების რაოდენობა სქესისა და მოქალაქეობის მიხედვით,33-number-of-immigrants-and-emigrants-by-sex-and-citizenship.xlsx,https://geostat.ge/media/78458/33-number-of-immigrants-and-emigrants-by-sex-and-citizenship.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/33-number-of-immigrants-and-emigrants-by-sex-and-citizenship.xlsx,downloads/methodology/demography/files/33-number-of-immigrants-and-emigrants-by-sex-and-citizenship.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,25694,6b7fc1d8714e3acacaa5167b8e7c424a3ddb2a13f9c60a95cbd700cd83bb20a0,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Immigrants and emigrants by sex and citizenship from Ministry of Internal Affairs border records; Fiscal.ge adds the citizenships other than five named countries into one group.
source.geostat_demography_net_migration,demography,2012-2025,საქსტატი,მიგრაციის სალდო (რაოდენობა და კოეფიციენტი),31-net-migration.xlsx,https://geostat.ge/media/78399/31-net-migration.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/31-net-migration.xlsx,downloads/methodology/demography/files/31-net-migration.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,11440,05aedd93e72ba63ab12b13feec8c46d6ce8870dadef3ece94fc7b87f65fa2196,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Published net migration; the page checks that arrivals minus departures equal it in every year.
```
(Byte sizes and SHA-256 were measured from the archived files on 2026-10-09; `validateSourceManifest` re-checks them.)

- [ ] **Step 3: Methodology text.** Every number must be identical in the two languages (separators ignored). In `lib/methodology/content/en/demography.ts`:
  - `summary`: `"Population on 1 January for Georgia, its 11 regions and 64 municipalities, 2004–2026, density by region, and international migration by citizenship, 2012–2025."`
  - `reviewedAt`: `"2026-10-09"`.
  - `disclosure`: append `" Fiscal.ge also adds up the citizenships other than five named countries into one group and computes net migration for selected groups and the foreign citizens' share."`
  - keyFacts `Frequency` value `"Annual"`; `Unit` value `"persons / persons per km² / persons per year"`.
  - `scope` paragraph: append `" Migration covers Georgia only, 2012–2025: immigrants and emigrants by sex and by six citizenship groups, and net migration."`
  - `sources`: add a fourth paragraph `"Migration: Geostat, immigrants and emigrants by sex and citizenship, and net migration, from Ministry of Internal Affairs border records. An immigrant is recorded at the border, stays at least 183 days within the following 12 months and was not a usual resident before; an emigrant is the mirror case. Georgia, Russia, Turkey, Azerbaijan and Ukraine are shown on their own; every other citizenship, stateless persons, not stated and Geostat’s own Other are added up by Fiscal.ge into one group, so it means the same in every year."`
  - `validation`: add `"The six citizenship groups add up to Geostat’s total in every year, direction and sex, men and women add up to both sexes, and arrivals minus departures equal the published net migration."`
  - `limitations`: replace the last paragraph with `"Migration counts do not change at the census re-base. Citizenship is not country of birth or of residence, and the page states no causes. Projections, age and sex, births and deaths are not yet published."`
  - `archive`: `"Four untouched Geostat Excel files: population on 1 January by region and self-governed unit, density by region, immigrants and emigrants by sex and citizenship, and net migration."`

  In `lib/methodology/content/demography.ts` the same changes in Georgian:
  - `summary`: `"საქართველოს, მისი 11 რეგიონისა და 64 მუნიციპალიტეტის მოსახლეობა 1 იანვრის მდგომარეობით, 2004–2026, სიმჭიდროვე რეგიონების მიხედვით და საერთაშორისო მიგრაცია მოქალაქეობის მიხედვით, 2012–2025."`
  - `reviewedAt`: `"2026-10-09"`.
  - `disclosure`: append `" Fiscal.ge ასევე აჯამებს ხუთი დასახელებული ქვეყნის გარდა დანარჩენ მოქალაქეობებს ერთ ჯგუფად და ითვლის არჩეული ჯგუფების წმინდა მიგრაციასა და უცხო მოქალაქეების წილს."`
  - keyFacts `სიხშირე` value `"წლიური"`; `ერთეული` value `"ადამიანი / ადამიანი კმ²-ზე / ადამიანი წელიწადში"`.
  - `scope`: append `" მიგრაცია მოიცავს მხოლოდ საქართველოს, 2012–2025: იმიგრანტები და ემიგრანტები სქესისა და მოქალაქეობის ექვსი ჯგუფის მიხედვით და წმინდა მიგრაცია."`
  - `sources` fourth paragraph: `"მიგრაცია: საქსტატი, იმიგრანტები და ემიგრანტები სქესისა და მოქალაქეობის მიხედვით და მიგრაციის სალდო, შინაგან საქმეთა სამინისტროს სასაზღვრო მონაცემებით. იმიგრანტი საზღვარზე აღირიცხება, მომდევნო 12 თვის განმავლობაში საქართველოში სულ მცირე 183 დღე რჩება და მანამდე მუდმივი მცხოვრები არ იყო; ემიგრანტი — პირიქით. საქართველო, რუსეთი, თურქეთი, აზერბაიჯანი და უკრაინა ცალ-ცალკე ჩანს; ყველა დანარჩენ მოქალაქეობას, მოქალაქეობის არმქონე პირებს, მოქალაქეობამიუთითებლებს და საქსტატის „სხვას“ Fiscal.ge ერთ ჯგუფად აჯამებს, ამიტომ ჯგუფი ყოველ წელს ერთსა და იმავეს ნიშნავს."`
  - `validation`: `"მოქალაქეობის ექვსი ჯგუფის ჯამი ყოველ წელს, ორივე მიმართულებით და ყველა სქესისთვის საქსტატის ჯამს უდრის, მამაკაცებისა და ქალების ჯამი — ორივე სქესის მაჩვენებელს, ხოლო შემოსულებს გამოკლებული გასულები — გამოქვეყნებულ წმინდა მიგრაციას."`
  - `limitations` last paragraph: `"მიგრაციის მონაცემები აღწერით გადათვლისას არ იცვლება. მოქალაქეობა არ არის დაბადების ან საცხოვრებელი ქვეყანა და გვერდი მიზეზებს არ ასახელებს. პროგნოზი, ასაკი და სქესი, შობადობა და გარდაცვალება ჯერ არ ქვეყნდება."`
  - `archive`: `"საქსტატის ოთხი უცვლელი Excel ფაილი: მოსახლეობა 1 იანვრის მდგომარეობით რეგიონებისა და თვითმმართველი ერთეულების მიხედვით, სიმჭიდროვე რეგიონების მიხედვით, იმიგრანტები და ემიგრანტები სქესისა და მოქალაქეობის მიხედვით და მიგრაციის სალდო."`

- [ ] **Step 4: Run.** `npx vitest run tests/methodology tests/explorer/demographyPages.test.tsx tests/explorer/demographyPopulationWorkbook.test.ts` (if that file name differs, run the population workbook test that exists) and `npm run data:validate`: PASS. The population workbook must still cite only its two originals (it filters by the sources it needs). If a methodology archive test pins the demography file count (2) or a category-archive listing, update it by the derived amount (4) and report it. If `validateMethodologyTranslation` reports a number mismatch, the two texts differ in a number: fix the text, not the validator.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "docs(demography): migration in the methodology page and its two Geostat originals" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 7: Browser tests

**Files:**
- Create: `tests/browser/demography-migration.spec.ts`
- Modify: `tests/browser/demography-population.spec.ts` (hub test), `tests/browser/methodology.spec.ts:14` (`3` → `2` coming-soon badges), `tests/browser/pristine-urls.spec.ts` (add the migration URL), `tests/browser/seo.spec.ts` and `tests/browser/bilingual-complete.spec.ts` if Task 5 did not already
- Run against a production build (see Global Constraints).

- [ ] **Step 1: Update existing specs.** In `demography-population.spec.ts`, the test "the hub lists four pages and links the live one" becomes "links the two live ones": the hub has `2` links, the first `href` is `${prefix}/explorer/demography/population` and the second `${prefix}/explorer/demography/migration`. In `methodology.spec.ts:14` the Demography hub's `მალე` badges are `2`. Add `` `${prefix}/explorer/demography/migration`, `` to the list in `pristine-urls.spec.ts`.

- [ ] **Step 2: New spec.** Create `tests/browser/demography-migration.spec.ts`:

```ts
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const PATH = "/explorer/demography/migration";

for (const [locale, prefix, heading, coverage, net] of [
  ["ka", "", "მიგრაცია", "2012–2025 · წლიური", "წმინდა მიგრაცია"],
  ["en", "/en", "Migration", "2012–2025 · annual", "Net migration"],
] as const) {
  test(`${locale}: opens on all six groups with both directions and the net line`, async ({ page }) => {
    await page.goto(`${prefix}${PATH}`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toContainText(coverage);
    await expect(page.getByTestId("series-row")).toHaveCount(6);
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(6);
    await expect(page.getByTestId("chart-panel").locator("[data-overlay]").first()).toBeAttached();
    await expect(page.getByTestId("chart-panel")).toContainText(net);
    await expect(page.getByTestId("migration-highlights")).toContainText("+17,127");
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("");
  });
}

test("removing Russia relabels the net line and writes the selection to the address", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  const russia = page.locator('[data-testid="series-row"][data-series-id="citizenship.russian_federation"] [data-testid="series-row-toggle"]');
  await russia.click();
  await expect(russia).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toContainText("Net migration (selected groups)");
  await expect(page).toHaveURL(/sel=citizenship\.georgia%2Ccitizenship\.turkey/);
});

test("the sex tabs change the chart, the table and the key figures", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  await page.getByTestId("migration-sex-female").click();
  await expect(page.getByTestId("migration-highlights")).toContainText("+7,516");
  await expect(page).toHaveURL(/sex=female/);
});

test("the table shows arrivals, departures and net with a total row", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByRole("table")).toContainText("205,857");
  await page.getByTestId("migration-direction-departures").click();
  await expect(page.getByRole("table")).toContainText("245,064");
  await page.getByTestId("migration-direction-net").click();
  await expect(page.getByRole("table")).toContainText("−39,207");
  await expect(page).toHaveURL(/dir=net/);
});

test("a shared link restores the view and the address stays as shared", async ({ page }) => {
  const shared = `/en${PATH}#view=table&sex=male&dir=departures&start=2020&end=2023`;
  await page.goto(shared);
  await ready(page);
  await expect(page.getByTestId("migration-sex-male")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("migration-highlights")).toHaveAttribute("data-end-year", "2023");
  expect(page.url()).toContain("#view=table&sex=male&dir=departures&start=2020&end=2023");
});

test("the Excel download has three sheets and numeric persons", async ({ page }, testInfo) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("migration-excel-download").click()]);
  expect(download.suggestedFilename()).toBe("fiscal-demography-migration-2012-2025-en.xlsx");
  const file = testInfo.outputPath("migration.xlsx");
  await download.saveAs(file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  const data = workbook.getWorksheet("Data")!;
  expect(typeof data.getRow(2).getCell(5).value).toBe("number");
});

test("the hub card and the sidebar link the Migration page", async ({ page }) => {
  await page.goto("/en/explorer/demography");
  await expect(page.getByTestId("demography-hub").locator(`a[href="/en${PATH}"]`)).toHaveCount(1);
  await page.goto(`/en${PATH}`);
  await ready(page);
  await expect(page.getByTestId("demography-migration-link")).toHaveAttribute("aria-current", "page");
});

test("English page has no Georgian text", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  expect(await page.locator("main").innerText()).not.toMatch(/\p{Script=Georgian}/u);
});

for (const width of [390, 768, 1100, 1440]) {
  test(`no horizontal page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [PATH, `/en${PATH}`]) {
      await page.goto(path);
      await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} @${width}`).toBe(true);
    }
  });
}
```
Markup these selectors rely on (checked 2026-10-09): a series row's button is `data-testid="series-row-toggle"` with `aria-pressed`; `SegmentedTabs` options carry their `testId` and `aria-pressed`; the chart's net line is `path[data-overlay]`; `ExplorerTable` renders a real `<table>`. If `getByRole("table")` finds two tables (the table renders a rows layout and a columns layout), scope it with `page.getByTestId("explorer-table")`; adjust the selector, never the behaviour.

- [ ] **Step 3: Run on a production build.** From `apps/web`: stop any server on :3100; `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`; `npm run start -- --port 3100` in the background; then `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/demography-migration.spec.ts tests/browser/demography-population.spec.ts tests/browser/methodology.spec.ts tests/browser/pristine-urls.spec.ts`: PASS. Stop the server.

- [ ] **Step 4: Commit.** `git add -A && git commit -m "test(demography): browser checks for the Migration page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 8: Documents and the completion gates

**Files:**
- Modify: `DESIGN.md` (§29), `docs/data-methodology/demography.md` (page-stage paragraph, line ~100), `Project_Definition.md` (§2 demography bullets, lines ~36–37 and ~56), `docs/deployment.md` ("Demography release checks"), `docs/superpowers/specs/2026-10-04-demography-migration-design.md` (status line)

- [ ] **Step 1: DESIGN.md.** Under `## 29. Demography surfaces` add a subsection `### 29.x Migration` (number it after the last existing 29.x) stating: one page `/explorer/demography/migration`; `StackedColumnChart` with `periodsPerYear={1}`, arrivals as positive and departures as negative segments per citizenship group in the §7 colours, values drawn in thousands with whole persons in every printed value; overlay = net of the selected groups, labelled `წმინდა მიგრაცია` with all six selected and `წმინდა მიგრაცია (არჩეული ჯგუფები)` otherwise; toolbar `სვეტები / ცხრილი` left and `ყველა / მამაკაცები / ქალები` right; aside of six fixed-order rows, all selected by default (the documented departure from "only the total starts selected", as on the inflation categories page); table with `შემოსვლა / გასვლა / წმინდა` tabs; hero net with the cumulative net over the range, three side figures (arrivals, departures, foreign citizens' share of arrivals); no census marker; no cause wording.

- [ ] **Step 2: Methodology doc.** In `docs/data-methodology/demography.md`, in the page-stage paragraph (it begins "The Population pages ship first"), add after the Population description: "The Migration page `/explorer/demography/migration` serves `demography-migration-annual.csv` through the same mirror (the whole file, 1,778 rows, all `border_police`; the page reads the two citizenship-group series and the net, 518 rows). It shows Georgia 2012–2025 by sex and the six citizenship groups, computes net migration for any selection and the foreign citizens' share of arrivals (the total minus the Georgia group), and archives tables 31 and 33 on `/methodology/demography`." Change "Every other canonical file stays stored and unserved" to name the files still unserved (structure, vital, census, fertility).

- [ ] **Step 3: Project_Definition.md.** In §2: in the data-foundation bullet change "Only the Population page below is served (population on 1 January and density, through the serving mirror)" to "The Population and Migration pages below are served (population on 1 January, density, and international migration by citizenship, through the serving mirror)"; in the Demography section bullet add one sentence for Migration (the page, its route, six groups, sex filter, all selected by default, net line follows the selection, foreign citizens' share, no causes) and change "The other three pages … stay `მალე` cards" to the two remaining pages; in the exclusions line (~56) change "beyond the Population page's population and density" to "beyond the Population page's population and density and the Migration page's migration by citizenship". This is a scope record of an owner-approved change (spec approved 2026-10-09); say so in the commit message.

- [ ] **Step 4: deployment.md.** In "Demography release checks" add a short paragraph for this release: no new migration; the import replaces `DemographyFact` with 2,846 rows (923 population, 145 density, 1,778 migration) and the log must show `[OK ] DemographyFact: csv=2846 db=2846`; after Vercel is READY open `/explorer/demography/migration` and `/en/explorer/demography/migration`, check the hub links two pages, download the workbook in each language, and open the two new originals on `/methodology/demography`.

- [ ] **Step 5: Spec status.** In the migration spec's `Status:` line add "Implemented on `claude/demographic-data-next-steps-ec11b1` (plan `docs/superpowers/plans/2026-10-09-demography-migration.md`)".

- [ ] **Step 6: Commit the documents.** `git add -A && git commit -m "docs(demography): the Migration page in DESIGN, scope, methodology and the release runbook" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

- [ ] **Step 7: Completion gates (once).** From `apps/web`: `npm run check` (exit 0). Then stop any server on :3100, `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build` (exit 0), `npm run start -- --port 3100` in the background, `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test` (all pass), stop the server. A failure in a file this plan did not touch: run that file alone first (known load flakes: XLSX download specs, `opengraphImage.test.ts` font download, the 2004 PDF hook timeout); if it passes alone, report it and do not re-run the whole gate. Report the exact counts (test files, tests, static pages, Playwright tests).

- [ ] **Step 8: Report for the owner.** List every Georgian string added (key and text) for review, the numbers on the page that a reader can check against Geostat (2023: 205,857 / 245,064 / −39,207; 2025 net +17,127), and that delivery (push, draft PR, CI, merge) awaits the owner's go.
