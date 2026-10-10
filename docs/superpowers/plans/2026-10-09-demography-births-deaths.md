# Demography Births, Deaths and Fertility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Births and deaths" section to all 75 Population place pages, and publish `/explorer/demography/births-deaths` (+ `/en`): a places block (map and list by births per 100 deaths), Fertility, and Life expectancy, with Excel downloads, the methodology update, and the hub card, sidebar, sitemap and `llms.txt` switched on.

**Architecture:** The Demography serving layer (`DemographyFact` mirror, `importDemography.ts`) gains two whole files, `demography-vital-annual.csv` and `demography-fertility-age-annual.csv`, with basis `registered`. Pure models turn served rows into one place's yearly births/deaths (`demographyVital.ts`), a ranked index of all places (`demographyVitalIndex.ts`) and the national fertility and life-expectancy series (`demographyNational.ts`). Two client components draw them from existing parts only: `VitalSection` (appended to each place page) and `NationalVitalCharts` (the national page's lower two blocks); the national page's top block is the existing `MunicipalitiesIndex`. Flipping `live` in `DEMOGRAPHY_PAGES` drives the hub card, sidebar, sitemap and i18n inventory.

**Tech Stack:** Next.js 16 static prerender, React 19, strict TypeScript, Tailwind v4, vitest (`renderToStaticMarkup`), Playwright, exceljs.

**Spec:** `docs/superpowers/specs/2026-10-04-demography-births-deaths-design.md` (rewritten and owner-approved 2026-10-09). Read it before any task. The Migration plan (`docs/superpowers/plans/2026-10-09-demography-migration.md`, on `main` once PR #162 merges) is the closest precedent: when a step says "as Migration does", open that file's code.

## Global Constraints

- **Start only after PR #162 (Migration) is merged to `main`.** Branch `claude/demographics-next-steps-f80ec2` (worktree `.claude/worktrees/demographics-next-steps-f80ec2`) holds the spec and this plan; Task 0 brings `main` into it. Local commits only: do not push, open a pull request or merge. Delivery is a separate owner decision after Task 10.
- All paths are relative to `apps/web` unless they start with `docs/`, `data/` or `public/` (`public/` is `apps/web/public`). Run commands from `apps/web`.
- Reuse First (`AGENTS.md`): no change to `StackedColumnChart`, `EditorialLineChart`, `ExplorerTable`, `SegmentedTabs`, `kpi-blocks`, `MunicipalitiesIndex`, the maps or the workbook writer. The only shared-code changes allowed are: exporting `ranked` from `lib/explorer/demographyPopulationIndex.ts`, four colour tokens in `lib/explorer/colors.ts`, and the importer's served set. If a step seems to need more, stop and report.
- Birth and death counts and natural increase carry **no** census-break marker. Total fertility rate, age-specific rates and life expectancy carry the 2025 break (`breaks=[{ year: CENSUS_STEP.toYear, label: t("breakLabel") }]`). Nothing computes a change across 2024/2025.
- No sentence names a cause (no "war", "COVID", "emigration of young people").
- No range slider, no hash state, no year picker in the new UI.
- English pages carry no Georgian in visible text, attributes, metadata or JSON-LD. No Dataset JSON-LD, no MCP tool, no bulk download for demography; `BreadcrumbList` JSON-LD only.
- Georgian is canonical. Every Georgian string added is a draft for the owner: list each new key and its text in the task report.
- Windows traps: plain `npx vitest run` skips `pretest`, so run `npm run data:prepare-fact-query-snapshot` once first; never run `next dev` (it rewrites the tracked `apps/web/AGENTS.md`), verify UI on a production build with `next start`; kill any server on :3100 before rebuilding; repository files are LF; `data/methodology/source-archives/*.csv` are UTF-8 with BOM.
- While editing run only the task's tests. The full gates run once, in Task 10.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Anchor values (from the CSVs, verified 2026-10-09)

| Fact | Value |
| --- | --- |
| Georgia 2025 births / deaths / natural increase | 37,867 / 44,319 / −6,452; ratio 85.44 → "85"; deaths ahead every year since 2020 |
| Georgia 2014 births / natural increase | 60,635 / +11,548 |
| Tbilisi (`region.tbilisi`, also `04`) 2025 | 14,334 / 12,743; ratio "112"; births ahead |
| Imereti 2025 | 4,275 / 7,197; ratio "59"; deaths ahead every year since 2015 (whole series) |
| Adjara 2025 ratio; Racha-Lechkhumi 2025 ratio | "128"; "33" |
| Batumi (`06`, slug `batumi`) 2025 | 2,630 / 1,779; ratio "148"; births ahead |
| Sagarejo (`17`, slug `sagarejo`) 2025 | 564 / 564; ratio "100"; equal |
| Municipalities (64, Tbilisi as `04`) with deaths > births | 53 in 2025, 32 in 2015, 30 in every year 2015–2025 |
| Total fertility rate | 2.31 (2014), 1.53 (2025) |
| Age-specific, per 1,000 women | 2014: under 20 51.5, 20–24 144.7, 25–29 131.3; 2025: 12.4, 62.4, 95.9 |
| Life expectancy 2025 | 76.0 total, 71.4 men, 80.6 women |
| Row counts | vital file 2,595 (837 × 3 + 12 × 7); fertility file 84; mirror before 2,846, after 5,525 |

## Reuse inventory

| Need | Existing piece | Change |
| --- | --- | --- |
| Serving mirror, loader, parity, import transaction | `DemographyFact`, `importDemography.ts`, `scripts/import-budget-facts.ts` | two more files; `registered` basis rule |
| Client rows | `ClientDemographyObservation`, `projectDemographyObservation` | one more type + projection for age-specific rows |
| Place page | `renderPopulationPlacePage`, `PopulationPlaceExplorer` | one sibling element after the explorer; the explorer is untouched |
| Columns up/down with a net line | `StackedColumnChart` (Migration's `marker`, `readoutOrder`, `formatOverlayValue`) | none |
| Line charts, table, tabs, key figures | `EditorialLineChart`, `ExplorerTable`, `SegmentedTabs`, `HeroKpi`, `SideKpiList`, `KPI_GRID_CLASS`, `SectionTitle`, `SourceNote` | none |
| National places block | `MunicipalitiesIndex` with `overrides`, `buildMunicipalityValueMapModel`, `populationHrefById`, `ranked` | export `ranked` |
| Excel | `WorkbookExportModel`, `SHEET_NAMES`, `workbookFilename`, `withAbsoluteUrls`, `workbookMessage`, `ExcelDownloadButton`, `downloadWorkbook` | none |
| Sources | `loadPopulationSources` (whole demography archive manifest) | archive gains 8 rows |
| Hub, sidebar, sitemap, inventory | `DEMOGRAPHY_PAGES` `live` flag, `buildDemographyHubCards` | flag; a births card figure |
| New | `demographyVital.ts`, `demographyVitalWorkbook.ts`, `demographyVitalIndex.ts`, `demographyNational.ts`, `demographyNationalWorkbook.ts`, `components/demography/vital-section.tsx`, `components/demography/national-vital-charts.tsx`, `lib/pages/demography-births-deaths.tsx`, two route files | The Migration and Population bodies are built around their own series; these are assembled from the same parts |

---

### Task 0: Bring Migration into the branch

**Files:** none edited by hand.

- [ ] **Step 1:** Confirm PR #162 is merged: `git fetch origin && git log --oneline origin/main | head -5` shows the Migration merge, and `git show origin/main:apps/web/lib/explorer/demographyRoutes.ts | grep MIGRATION_PATH` prints a line. If not, stop and report.
- [ ] **Step 2:** Merge `main` into this branch with the ccd_host `sync_with_base_branch` tool (not `git merge`). The branch only adds two docs files, so no conflict is expected.
- [ ] **Step 3:** `npm ci` (main's lockfile changed), then `npm run data:prepare-fact-query-snapshot`.
- [ ] **Step 4:** Baseline: `npx vitest run tests/data/demography tests/explorer/demographyHub.test.ts tests/explorer/populationPlacePages.test.tsx`: PASS. Record `npm run i18n:check`'s page-identity count and the sitemap count pinned in `tests/seo/routes.test.ts` in the report; Task 7 moves them.

---

### Task 1: Serve the two files

**Files:**
- Modify: `lib/data/demography/importDemography.ts`, `lib/data/servedData.ts` (`SERVED_DATA_FILES`), `scripts/import-budget-facts.ts` (the `loadDemographyFacts([...])` list)
- Test: `tests/data/demography/servingBoundary.test.ts`, `tests/data/demography/importDemography.test.ts`

**Interfaces:**
- Produces: `SERVED_DEMOGRAPHY_FILES` gains `"../../data/imports/demography-vital-annual.csv"` and `"../../data/imports/demography-fertility-age-annual.csv"` (in that order, after migration); `SERVED_DATA_FILES.demographyVitalFacts` and `.demographyFertilityFacts` (same paths); `loadServedDemographyData()` returns 5,525 rows. Population and Migration pages already filter by series, so their output does not change.

- [ ] **Step 1: Failing tests.** In `tests/data/demography/servingBoundary.test.ts` change both `2_846` to `5_525`. In `tests/data/demography/importDemography.test.ts`:
  - add `SERVED_DATA_FILES.demographyVitalFacts, SERVED_DATA_FILES.demographyFertilityFacts,` to the expected list in "serves the files SERVED_DATA_FILES names";
  - replace the body of "every row's basis is the one its series and year require" with

```ts
    const migration = new Set<string>(FAMILIES.migration);
    const registered = new Set<string>([...FAMILIES.vital, ...FAMILIES.fertility]);
    const lineage = facts.filter((row) => !migration.has(row.seriesId) && !registered.has(row.seriesId));
    expect(lineage.every((row) => row.estimateBasis === populationEstimateBasis(row.year))).toBe(true);
    expect(facts.filter((row) => migration.has(row.seriesId)).every((row) => row.estimateBasis === "border_police")).toBe(true);
    expect(facts.filter((row) => migration.has(row.seriesId))).toHaveLength(1_778);
    expect(facts.filter((row) => registered.has(row.seriesId)).every((row) => row.estimateBasis === "registered")).toBe(true);
    expect(facts.filter((row) => FAMILIES.vital.includes(row.seriesId as never))).toHaveLength(2_595);
    expect(facts.filter((row) => row.seriesId === SERIES.ageSpecificFertilityRate)).toHaveLength(84);
```
  - add a test:

```ts
  test("births minus deaths equal natural increase in every row, and the age rates add up to the total fertility rate", () => {
    const keyed = (seriesId: string) => new Map(facts.filter((row) => row.seriesId === seriesId).map((row) => [`${row.geographyId}|${row.year}`, Number(row.value)]));
    const births = keyed(SERIES.liveBirths);
    const deaths = keyed(SERIES.deaths);
    const natural = keyed(SERIES.naturalIncrease);
    expect(births.size).toBe(837);
    for (const [key, value] of births) expect(value - deaths.get(key)!, key).toBe(natural.get(key));
    for (const year of [2014, 2020, 2025]) {
      const rates = facts.filter((row) => row.seriesId === SERIES.ageSpecificFertilityRate && row.year === year);
      expect(rates).toHaveLength(7);
      const tfr = Number(valueOf("country.georgia", year, SERIES.totalFertilityRate));
      expect(Math.abs((5 * rates.reduce((sum, row) => sum + Number(row.value), 0)) / 1000 - tfr)).toBeLessThan(0.005);
    }
  });
```
  (Geostat's rates are per 1,000 women, so five times their sum is divided by 1,000 to give children per woman. Checked on the CSVs: 2014 2.3140 vs 2.31, 2020 1.9670 vs 1.97, 2025 1.5265 vs 1.53.)

  Run `npx vitest run tests/data/demography/servingBoundary.test.ts tests/data/demography/importDemography.test.ts`: FAIL (counts, file list).

- [ ] **Step 2: Serve the files.** In `lib/data/demography/importDemography.ts`:

```ts
export const SERVED_DEMOGRAPHY_FILES = [
  "../../data/imports/demography-population-annual.csv",
  "../../data/imports/demography-density-annual.csv",
  "../../data/imports/demography-migration-annual.csv",
  "../../data/imports/demography-vital-annual.csv",
  "../../data/imports/demography-fertility-age-annual.csv",
] as const;

// The migration, vital-events and fertility files are mirrored whole, as the import mirrors files as they are.
// Pages read only the series they show; the infant mortality rate and the crude rates are mirrored, not shown.
const MIGRATION_SERIES = new Set<string>(FAMILIES.migration);
const REGISTERED_SERIES = new Set<string>([...FAMILIES.vital, ...FAMILIES.fertility]);
const SERVED_SERIES = new Set<string>([SERIES.populationTotal, SERIES.populationDensity, ...MIGRATION_SERIES, ...REGISTERED_SERIES]);

/** Population and density follow the lineage of their year; migration is border-police data and vital events are registered events in every year. */
function expectedBasis(fact: DemographyObservation): EstimateBasis {
  if (MIGRATION_SERIES.has(fact.seriesId)) return "border_police";
  if (REGISTERED_SERIES.has(fact.seriesId)) return "registered";
  return populationEstimateBasis(fact.year);
}
```
  If `EstimateBasis` (in `lib/data/demography/types.ts`) does not include `"registered"`, stop and report: the CSVs carry it, so the type should already.
  In `lib/data/servedData.ts` add after `demographyMigrationFacts`:

```ts
  demographyVitalFacts: "../../data/imports/demography-vital-annual.csv",
  demographyFertilityFacts: "../../data/imports/demography-fertility-age-annual.csv",
```
  In `scripts/import-budget-facts.ts` add `SERVED_DATA_FILES.demographyVitalFacts, SERVED_DATA_FILES.demographyFertilityFacts,` to the `loadDemographyFacts([...])` list after the migration file.

- [ ] **Step 3: Run.** The two test files: PASS. Then `npx vitest run tests/explorer/demographyPages.test.tsx tests/explorer/populationPlacePages.test.tsx tests/explorer/demographyHub.test.ts`: PASS unchanged (pages filter by series). `npm run typecheck`: PASS. If `tests/data/demography/importIntegration.test.ts` lists per-series counts, add `{ seriesId: "demography.live_births", n: 837 }` style rows only if the file's pattern lists every served series; it runs against a database only, so it is not run here.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "feat(demography): serve the vital-events and fertility files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 2: One place's births and deaths (model)

**Files:**
- Create: `lib/explorer/demographyVital.ts`
- Test: `tests/explorer/demographyVital.test.ts`

**Interfaces:**
- Consumes: `SERIES` (`lib/data/demography/series.ts`), `projectDemographyObservation` (`lib/explorer/clientData.ts`), `ClientDemographyObservation` (`lib/servedRows.ts`).
- Produces:

```ts
export const VITAL_PLACE_SERIES: readonly string[]; // live_births, deaths, natural_increase
export type VitalStreak =
  | { kind: "deaths-ahead"; since: number; wholeSeries: boolean }
  | { kind: "births-ahead"; year: number }
  | { kind: "even"; year: number };
export type VitalPlaceModel = {
  placeId: string;
  years: number[];
  births: Record<number, number | null>;
  deaths: Record<number, number | null>;
  natural: Record<number, number | null>;
  latest: { year: number; births: number; deaths: number; natural: number; ratio: number | null };
  streak: VitalStreak;
};
export function birthsPer100Deaths(births: number, deaths: number): number | null;
export function vitalFactsForPlace(facts: readonly ServedDemographyObservation[], placeId: string): ClientDemographyObservation[];
export function vitalStreak(years: readonly number[], births: Record<number, number | null>, deaths: Record<number, number | null>): VitalStreak;
export function buildVitalPlaceModel(facts: readonly ClientDemographyObservation[], placeId: string): VitalPlaceModel | null;
```

- [ ] **Step 1: Failing test.** Create `tests/explorer/demographyVital.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import { birthsPer100Deaths, buildVitalPlaceModel, vitalFactsForPlace, vitalStreak } from "../../lib/explorer/demographyVital";

let served: ServedDemographyObservation[];
beforeAll(async () => {
  served = (await loadServedDemographyData()).facts;
});
const model = (placeId: string) => buildVitalPlaceModel(vitalFactsForPlace(served, placeId), placeId)!;

describe("vital facts for one place", () => {
  it("hand the browser only that place's three series, without provenance", () => {
    const rows = vitalFactsForPlace(served, "06");
    expect(rows).toHaveLength(33);
    expect(new Set(rows.map((row) => row.geographyId))).toEqual(new Set(["06"]));
    expect(Object.keys(rows[0]!).sort()).toEqual(["geographyId", "seriesId", "value", "year"]);
    expect(vitalFactsForPlace(served, "country.georgia")).toHaveLength(36);
  });
});

describe("the place model", () => {
  it("Georgia 2014–2025, deaths ahead since 2020", () => {
    const georgia = model("country.georgia");
    expect(georgia.years).toEqual([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(georgia.births[2014]).toBe(60_635);
    expect(georgia.natural[2014]).toBe(11_548);
    expect(georgia.latest).toEqual({ year: 2025, births: 37_867, deaths: 44_319, natural: -6_452, ratio: expect.closeTo(85.44, 2) });
    expect(georgia.streak).toEqual({ kind: "deaths-ahead", since: 2020, wholeSeries: false });
  });

  it("Imereti: deaths ahead in every year of the series", () => {
    const imereti = model("region.imereti");
    expect(imereti.years[0]).toBe(2015);
    expect(imereti.latest.births).toBe(4_275);
    expect(imereti.latest.deaths).toBe(7_197);
    expect(Math.round(imereti.latest.ratio!)).toBe(59);
    expect(imereti.streak).toEqual({ kind: "deaths-ahead", since: 2015, wholeSeries: true });
  });

  it("Tbilisi and Batumi: births ahead; Sagarejo: equal", () => {
    expect(model("region.tbilisi").streak).toEqual({ kind: "births-ahead", year: 2025 });
    expect(Math.round(model("region.tbilisi").latest.ratio!)).toBe(112);
    expect(Math.round(model("06").latest.ratio!)).toBe(148);
    expect(model("17").streak).toEqual({ kind: "even", year: 2025 });
    expect(model("17").latest.ratio).toBe(100);
  });

  it("returns null for a place without rows", () => {
    expect(buildVitalPlaceModel([], "99")).toBeNull();
  });
});

describe("helpers", () => {
  it("births per 100 deaths has no value without deaths", () => {
    expect(birthsPer100Deaths(10, 0)).toBeNull();
    expect(birthsPer100Deaths(50, 200)).toBe(25);
  });

  it("the streak ends at an equal year and at a missing year", () => {
    const years = [2020, 2021, 2022];
    expect(vitalStreak(years, { 2020: 1, 2021: 5, 2022: 1 }, { 2020: 2, 2021: 5, 2022: 2 })).toEqual({ kind: "deaths-ahead", since: 2022, wholeSeries: false });
    expect(vitalStreak(years, { 2020: 1, 2021: null, 2022: 1 }, { 2020: 2, 2021: 3, 2022: 2 })).toEqual({ kind: "deaths-ahead", since: 2022, wholeSeries: false });
  });
});
```
  Run `npx vitest run tests/explorer/demographyVital.test.ts`: FAIL (module missing).

- [ ] **Step 2: Implement.** Create `lib/explorer/demographyVital.ts`:

```ts
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { ClientDemographyObservation } from "../servedRows";
import { projectDemographyObservation } from "./clientData";

/** The three series a place page's births-and-deaths section reads. Counts only: none of them breaks at the census re-base. */
export const VITAL_PLACE_SERIES: readonly string[] = [SERIES.liveBirths, SERIES.deaths, SERIES.naturalIncrease];

export type VitalStreak =
  | { kind: "deaths-ahead"; since: number; wholeSeries: boolean }
  | { kind: "births-ahead"; year: number }
  | { kind: "even"; year: number };

export type VitalPlaceModel = {
  placeId: string;
  years: number[];
  births: Record<number, number | null>;
  deaths: Record<number, number | null>;
  natural: Record<number, number | null>;
  latest: { year: number; births: number; deaths: number; natural: number; ratio: number | null };
  streak: VitalStreak;
};

/** 100 × births / deaths, unrounded; no value when there were no deaths. */
export function birthsPer100Deaths(births: number, deaths: number): number | null {
  return deaths > 0 ? (100 * births) / deaths : null;
}

/** One place's births, deaths and natural increase, as the browser receives them: never every place's 2,511 rows. */
export function vitalFactsForPlace(facts: readonly ServedDemographyObservation[], placeId: string): ClientDemographyObservation[] {
  return facts.filter((fact) => fact.geographyId === placeId && VITAL_PLACE_SERIES.includes(fact.seriesId)).map(projectDemographyObservation);
}

/** The unbroken run of years, ending at the last year, in which deaths exceeded births. An equal or missing year ends it. */
export function vitalStreak(
  years: readonly number[],
  births: Record<number, number | null>,
  deaths: Record<number, number | null>,
): VitalStreak {
  let since: number | null = null;
  for (let index = years.length - 1; index >= 0; index -= 1) {
    const year = years[index]!;
    const [born, died] = [births[year], deaths[year]];
    if (born === null || born === undefined || died === null || died === undefined || died <= born) break;
    since = year;
  }
  const last = years.at(-1)!;
  if (since !== null) return { kind: "deaths-ahead", since, wholeSeries: since === years[0] };
  return births[last] === deaths[last] ? { kind: "even", year: last } : { kind: "births-ahead", year: last };
}

export function buildVitalPlaceModel(facts: readonly ClientDemographyObservation[], placeId: string): VitalPlaceModel | null {
  const own = facts.filter((fact) => fact.geographyId === placeId);
  const years = [...new Set(own.map((fact) => fact.year))].sort((left, right) => left - right);
  if (years.length === 0) return null;
  const series = (seriesId: string): Record<number, number | null> =>
    Object.fromEntries(years.map((year) => [year, own.find((fact) => fact.seriesId === seriesId && fact.year === year)?.value ?? null]));
  const births = series(SERIES.liveBirths);
  const deaths = series(SERIES.deaths);
  const natural = series(SERIES.naturalIncrease);
  const year = years.at(-1)!;
  const [born, died, net] = [births[year], deaths[year], natural[year]];
  if (born === null || died === null || net === null) throw new Error(`No ${year} births, deaths or natural increase for ${placeId}`);
  return {
    placeId,
    years,
    births,
    deaths,
    natural,
    latest: { year, births: born, deaths: died, natural: net, ratio: birthsPer100Deaths(born, died) },
    streak: vitalStreak(years, births, deaths),
  };
}
```
- [ ] **Step 3: Run.** The test: PASS. `npm run typecheck`: PASS.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "feat(demography): births and deaths model for one place" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 3: The place section's Excel workbook

**Files:**
- Create: `lib/explorer/demographyVitalWorkbook.ts`
- Modify: `lib/i18n/messages/en/demography.json`, `lib/i18n/messages/ka/demography.json` (workbook keys below)
- Test: `tests/explorer/demographyVitalWorkbook.test.ts`

**Interfaces:**
- Consumes: `buildVitalPlaceModel`, `VitalPlaceModel` (Task 2); `DemographyPlace`, `placeLabel` (`lib/explorer/demographyAreas.ts`); `SOURCE_ID` (`births`, `deaths`, `naturalIncrease`).
- Produces: `buildVitalWorkbookExportModel(input: { facts: readonly ClientDemographyObservation[]; place: DemographyPlace; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; scope: string }, presentation: Presentation): WorkbookExportModel`.

Messages added in this task (en / ka draft):

| Key | en | ka |
| --- | --- | --- |
| `demography.vitalBirths` | Births | დაბადებები |
| `demography.vitalDeaths` | Deaths | გარდაცვალებები |
| `demography.vitalNatural` | Natural increase | ბუნებრივი მატება |
| `demography.vitalWorkbookTitle` | Births and deaths | დაბადებები და გარდაცვალებები |
| `demography.vitalBasis` | Registered events | რეგისტრირებული მოვლენები |

- [ ] **Step 1: Failing test.** Create `tests/explorer/demographyVitalWorkbook.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SOURCE_ID } from "../../lib/data/demography/series";
import { buildVitalWorkbookExportModel } from "../../lib/explorer/demographyVitalWorkbook";
import { vitalFactsForPlace } from "../../lib/explorer/demographyVital";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { loadPopulationBasics, loadPopulationSources } from "../../lib/pages/demography-population";

let input: Parameters<typeof buildVitalWorkbookExportModel>[0];
let presentation: Awaited<ReturnType<typeof getPresentation>>;
beforeAll(async () => {
  const [{ facts }, sources, basics] = await Promise.all([loadServedDemographyData(), loadPopulationSources("en"), loadPopulationBasics("en")]);
  presentation = await getPresentation("en", ["demography", "workbook"], []);
  const place = basics.places.find((candidate) => candidate.id === "06")!;
  input = { facts: vitalFactsForPlace(facts, "06"), place, sources, siteOrigin: "https://fiscal.ge", scope: "batumi" };
});

describe("births and deaths workbook", () => {
  it("names the place and its years, and lists births, deaths and natural increase", () => {
    const model = buildVitalWorkbookExportModel(input, presentation);
    expect(model.filename).toContain("demography-births-deaths-batumi-2015-2025");
    expect(model.readable.years).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(model.readable.rows.map((row) => [row.kind, row.label])).toEqual([["item", "Births"], ["item", "Deaths"], ["total", "Natural increase"]]);
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(2_630);
    expect(model.readable.rows[2]!.valuesByYear[2025]).toBe(851);
  });

  it("has one data row per year and cites only the three originals", () => {
    const model = buildVitalWorkbookExportModel(input, presentation);
    expect(model.analysis.rows).toHaveLength(11);
    expect(model.analysis.rows.at(-1)!.slice(2, 6)).toEqual([2025, 2_630, 1_779, 851]);
    const cited = input.sources.filter((source) => [SOURCE_ID.births, SOURCE_ID.deaths, SOURCE_ID.naturalIncrease].includes(source.sourceId as never));
    expect(model.sources).toHaveLength(cited.length);
    expect(model.sources.every((source) => source.downloadHref.startsWith("https://fiscal.ge/"))).toBe(true);
  });
});
```
  Note: until Task 8 adds the archive rows, `cited.length` is 0, so the second test passes with no sources; Task 8 re-runs this file and expects 3. Run: FAIL (module missing).

- [ ] **Step 2: Messages.** Add the five keys above to both `demography.json` files, keeping each file's existing order style (append near the other workbook keys).
- [ ] **Step 3: Implement.** Create `lib/explorer/demographyVitalWorkbook.ts`:

```ts
import { SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientDemographyObservation } from "../servedRows";
import { placeLabel, type DemographyPlace } from "./demographyAreas";
import { buildVitalPlaceModel } from "./demographyVital";
import { SHEET_NAMES, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

const LEVEL_KEYS = { country: "levelCountry", region: "levelRegion", municipality: "levelMunicipality" } as const;
const ORIGINALS = new Set<string>([SOURCE_ID.births, SOURCE_ID.deaths, SOURCE_ID.naturalIncrease]);

export function buildVitalWorkbookExportModel(
  input: {
    facts: readonly ClientDemographyObservation[];
    place: DemographyPlace;
    sources: readonly (WorkbookPublicSource & { sourceId: string })[];
    siteOrigin: string;
    /** The place named in the file name, as the population workbook names it (`batumi`, `region-adjara`, `georgia`). */
    scope: string;
  },
  presentation: Presentation,
): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const w = (key: string) => workbookMessage(locale, key);
  const model = buildVitalPlaceModel(input.facts, input.place.id);
  if (!model) throw new Error(`No births and deaths for ${input.place.id}`);
  const [first, last] = [model.years[0]!, model.years.at(-1)!];
  const row = (kind: WorkbookReadableRow["kind"], label: string, values: Record<number, number | null>): WorkbookReadableRow => ({
    kind,
    parentLabel: null,
    label,
    change: null,
    valuesByYear: Object.fromEntries(model.years.map((year) => [year, values[year] ?? null])),
    basisByYear: Object.fromEntries(model.years.map((year) => [year, values[year] === null ? null : ("published" as const)])),
  });
  const originals = input.sources
    .filter((source) => ORIGINALS.has(source.sourceId))
    .map(({ sourceId: _sourceId, ...source }) => ({ ...source, years: source.years.filter((year) => model.years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  const unitLabel = t("personsHeader");
  const name = placeLabel(input.place, locale);
  return {
    locale,
    filename: workbookFilename(`demography-births-deaths-${input.scope}-${first}-${last}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${t("vitalWorkbookTitle")} · ${name}`,
      subtitle: `${first}–${last} · ${unitLabel}`,
      unitLabel,
      amountDecimals: 0,
      showChangeColumn: false,
      years: model.years,
      // Natural increase is signed; its sign is neither good nor bad, so it is not shown in red.
      numberFormat: "#,##0;−#,##0",
      rows: [row("item", t("vitalBirths"), model.births), row("item", t("vitalDeaths"), model.deaths), row("total", t("vitalNatural"), model.natural)],
    },
    analysis: {
      headers: [t("placeHeader"), t("levelHeader"), w("workbook.year"), t("vitalBirths"), t("vitalDeaths"), t("vitalNatural"), t("basisHeader"), w("workbook.status")],
      rows: model.years.map((year) => [
        name,
        t(LEVEL_KEYS[input.place.level]),
        year,
        model.births[year] ?? null,
        model.deaths[year] ?? null,
        model.natural[year] ?? null,
        t("vitalBasis"),
        w(model.births[year] === null ? "workbook.unavailable" : "workbook.published"),
      ]),
      // Column numbers, counted from 1: Births, Deaths, Natural increase.
      numericFormats: { 4: "#,##0", 5: "#,##0", 6: "#,##0;−#,##0" },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
```
  If `workbookMessage` is called differently in `demographyMigrationWorkbook.ts` (for example with the key without the `workbook.` prefix), follow that file.
- [ ] **Step 4: Run.** The test: PASS. `npm run typecheck` and `npm run i18n:check`: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(demography): births and deaths workbook for one place" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 4: The section on every place page

**Files:**
- Create: `components/demography/vital-section.tsx`
- Modify: `lib/explorer/colors.ts` (four tokens), `lib/pages/demography-population-place.tsx`, both `demography.json` files
- Test: `tests/explorer/vitalSection.test.tsx`, `tests/explorer/populationPlacePages.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 and 3; `loadServedDemographyData`.
- Produces: `VitalSection({ place, facts, sources, siteOrigin, workbookScope, nationalHref })` rendering `<section id="births-deaths" data-testid="vital-section">`; `SERIES_COLORS["vital.births"]`, `["vital.deaths"]`, `["sex.male"]`, `["sex.female"]`.

Messages added in this task (en / ka draft):

| Key | en | ka |
| --- | --- | --- |
| `demography.vitalTitle` | Births and deaths | დაბადებები და გარდაცვალებები |
| `demography.vitalLead` | Births and deaths registered in {place}, {first}–{last}. | {place}: რეგისტრირებული დაბადებები და გარდაცვალებები, {first}–{last}. |
| `demography.vitalChartAria` | Births above and deaths below the zero line, with natural increase, {place}, {first}–{last} | დაბადებები ნულოვანი ხაზის ზემოთ, გარდაცვალებები ქვემოთ და ბუნებრივი მატება, {place}, {first}–{last} |
| `demography.vitalTableCaption` | Births, deaths and natural increase, {place}, {first}–{last} | დაბადებები, გარდაცვალებები და ბუნებრივი მატება, {place}, {first}–{last} |
| `demography.vitalHeroLabel` | Natural increase, {year} | ბუნებრივი მატება, {year} |
| `demography.vitalRatio` | Births per 100 deaths | დაბადება 100 გარდაცვალებაზე |
| `demography.vitalDeathsSince` | Deaths have outnumbered births every year since {year}. | {year} წლიდან ყოველ წელს გარდაცვალებათა რიცხვი დაბადებათა რიცხვს აღემატება. |
| `demography.vitalBirthsAhead` | Births outnumbered deaths in {year}. | {year} წელს დაბადებათა რიცხვი გარდაცვალებათა რიცხვს აღემატებოდა. |
| `demography.vitalEven` | Births and deaths were equal in {year}. | {year} წელს დაბადებათა და გარდაცვალებათა რიცხვი თანაბარი იყო. |
| `demography.vitalSource` | Source: Geostat, live births and deaths by region and self-governed unit, {first}–{last}. Counts are registered events and do not change at the census re-base. | წყარო: საქსტატი, ცოცხლად დაბადებულთა და გარდაცვლილთა რაოდენობა რეგიონებისა და თვითმმართველი ერთეულების მიხედვით, {first}–{last}. რიცხვები რეგისტრირებულ მოვლენებს ასახავს და აღწერით გადათვლისას არ იცვლება. |
| `demography.vitalCompare` | Compare all places, and see fertility and life expectancy → | ყველა ადგილის შედარება, ნაყოფიერება და სიცოცხლის ხანგრძლივობა → |

- [ ] **Step 1: Colour tokens.** In `lib/explorer/colors.ts`, inside `SERIES_COLORS` after the citizenship block:

```ts
  // Vital events (births-deaths spec §6) and the sexes (section spec §7, reserved for Age and sex, first used by life expectancy).
  "vital.births": "#1F6E56",
  "vital.deaths": "#8C5A32",
  "sex.male": "#3D5A98",
  "sex.female": "#C26E4C",
```
  If a test enumerates `SERIES_COLORS` contrast or uniqueness, run it (`npx vitest run tests/explorer/colors*`); `#1F6E56` and `#3D5A98` already appear under other keys, which existing entries also do (`citizenship.turkey`), so a uniqueness test, if any, is per family — report rather than change it.

- [ ] **Step 2: Failing component test.** Create `tests/explorer/vitalSection.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { VitalSection } from "../../components/demography/vital-section";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { vitalFactsForPlace } from "../../lib/explorer/demographyVital";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { loadPopulationBasics } from "../../lib/pages/demography-population";

const GEORGIAN = /\p{Script=Georgian}/u;
let render: (placeId: string, locale?: "ka" | "en") => Promise<string>;
beforeAll(async () => {
  const { facts } = await loadServedDemographyData();
  render = async (placeId, locale = "en") => {
    const [{ places }, presentation] = await Promise.all([
      loadPopulationBasics(locale),
      getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook", "municipal"], []),
    ]);
    const place = places.find((candidate) => candidate.id === placeId)!;
    return renderToStaticMarkup(
      <I18nProvider {...presentation}>
        <VitalSection place={place} facts={vitalFactsForPlace(facts, placeId)} sources={[]} siteOrigin="https://fiscal.ge" workbookScope="x" nationalHref="/explorer/demography/births-deaths" />
      </I18nProvider>,
    );
  };
});

describe("births and deaths section", () => {
  it("Georgia: anchor, heading, lead, chart, key figures and the national link", async () => {
    const html = await render("country.georgia");
    expect(html).toContain('id="births-deaths"');
    expect(html).toContain("Births and deaths registered in Georgia, 2014–2025.");
    expect(html).toContain('data-testid="vital-chart-panel"');
    expect(html).toContain("−6,452");
    expect(html).toContain("37,867");
    expect(html).toContain("44,319");
    expect(html).toMatch(/Births per 100 deaths[\s\S]{0,600}>85</); // the ratio's label, then its value; widen the gap if the KPI markup is longer
    expect(html).toContain("Deaths have outnumbered births every year since 2020.");
    expect(html).toContain('href="/en/explorer/demography/births-deaths"');
    expect(html).not.toContain("Census re-base");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a region, a municipality where births lead, and one where they are equal", async () => {
    expect(await render("region.imereti")).toContain("Deaths have outnumbered births every year since 2015.");
    expect(await render("06")).toContain("Births outnumbered deaths in 2025.");
    expect(await render("17")).toContain("Births and deaths were equal in 2025.");
  });

  it("renders in Georgian", async () => {
    const html = await render("country.georgia", "ka");
    expect(html).toContain("დაბადებები და გარდაცვალებები");
    expect(html).toContain('href="/explorer/demography/births-deaths"');
  });
});
```
  If `I18nProvider` needs more props than `getPresentation` returns, copy how `tests/explorer/demographyMigrationExplorer.test.tsx` renders `MigrationExplorer`. If `formatInUnit` prints a negative with `-` (hyphen) rather than `−`, assert what the shared formatter prints and say so in the report: the spec does not ask this section to format differently from the rest of the site. Run: FAIL (module missing).

- [ ] **Step 3: Messages.** Add the eleven keys in the table above to both files.

- [ ] **Step 4: The component.** Create `components/demography/vital-section.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INK, NEGATIVE, SERIES_COLORS } from "../../lib/explorer/colors";
import { placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildVitalPlaceModel } from "../../lib/explorer/demographyVital";
import { buildVitalWorkbookExportModel } from "../../lib/explorer/demographyVitalWorkbook";
import { formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { SectionTitle, SegmentedTabs, SourceNote } from "../ui/editorial";

const BIRTHS = SERIES_COLORS["vital.births"]!;
const DEATHS = SERIES_COLORS["vital.deaths"]!;
const persons = (value: number | null | undefined) => formatInUnit(value, UNIT_PERSONS);
const signedPersons = (value: number | null | undefined) =>
  value === null || value === undefined ? persons(value) : `${value > 0 ? "+" : ""}${persons(value)}`;

/** One place's registered births and deaths: the section every Population place page ends with. Counts only, so no census-break marker. */
export function VitalSection({
  place,
  facts,
  sources,
  siteOrigin,
  workbookScope,
  nationalHref,
}: {
  place: DemographyPlace;
  /** This place's rows only (`vitalFactsForPlace`). */
  facts: ClientDemographyObservation[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  workbookScope: string;
  nationalHref: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [mode, setMode] = useState<ChartMode>("line");
  const model = useMemo(() => buildVitalPlaceModel(facts, place.id), [facts, place.id]);
  if (!model) return null;
  const name = placeLabel(place, locale);
  const [first, last] = [model.years[0]!, model.years.at(-1)!];
  const { latest, streak } = model;
  const values = (record: Record<number, number | null>, sign: 1 | -1) => model.years.map((year) => (record[year] === null ? null : sign * record[year]!));
  const streakSentence =
    streak.kind === "deaths-ahead"
      ? t("vitalDeathsSince", { year: streak.since })
      : t(streak.kind === "even" ? "vitalEven" : "vitalBirthsAhead", { year: streak.year });

  return (
    <section id="births-deaths" data-testid="vital-section" className="mt-16 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{t("vitalTitle")}</SectionTitle>
      <p className="mt-2 mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("vitalLead", { place: name, first, last })}</p>
      <div data-testid="vital-chart-panel" data-mode={mode}>
        <SegmentedTabs<ChartMode>
          ariaLabel={message(messages, "controls.viewMode")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "line", label: t("columns"), testId: "vital-mode-line" },
            { value: "table", label: message(messages, "controls.table"), testId: "vital-mode-table" },
          ]}
        />
        <div className="mt-5">
          {mode === "line" ? (
            <StackedColumnChart
              periods={model.years}
              periodsPerYear={1}
              segments={[
                { id: "births", label: t("vitalBirths"), color: BIRTHS, marker: "up", values: values(model.births, 1) },
                { id: "deaths", label: t("vitalDeaths"), color: DEATHS, marker: "down", values: values(model.deaths, -1) },
              ]}
              overlay={{ label: t("vitalNatural"), values: values(model.natural, 1) }}
              formatPeriod={String}
              formatValue={(value) => persons(Math.abs(value))}
              formatOverlayValue={(value) => signedPersons(value)}
              readoutOrder="sign-then-magnitude"
              ariaLabel={t("vitalChartAria", { place: name, first, last })}
            />
          ) : (
            <ExplorerTable
              caption={t("vitalTableCaption", { place: name, first, last })}
              rows={[
                { itemId: "vital.births", kaLabel: t("vitalBirths"), color: BIRTHS, valuesByYear: model.births },
                { itemId: "vital.deaths", kaLabel: t("vitalDeaths"), color: DEATHS, valuesByYear: model.deaths },
              ]}
              totalRow={{ itemId: "vital.natural", kaLabel: t("vitalNatural"), color: INK, valuesByYear: model.natural }}
              showTotal
              wrapRowLabels
              rowLabelsLocalized
              years={model.years}
              firstColumnLabel={t("placeHeader")}
              unit={UNIT_PERSONS}
              share={false}
              showChangeColumn={false}
              shareValueForYear={() => null}
            />
          )}
        </div>
      </div>
      <div className="mt-[18px] flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[640px]"><SourceNote testId="vital-source-note">{t("vitalSource", { first, last })}</SourceNote></div>
        <div className="w-full max-w-[260px]">
          <ExcelDownloadButton
            testId="vital-excel-download"
            onDownload={async () => {
              const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
              await downloadWorkbook(buildVitalWorkbookExportModel({ facts, place, sources, siteOrigin, scope: workbookScope }, presentation));
            }}
          />
        </div>
      </div>
      <div className={`mt-8 ${KPI_GRID_CLASS}`} data-testid="vital-highlights" data-end-year={latest.year}>
        <HeroKpi label={t("vitalHeroLabel", { year: latest.year })} value={signedPersons(latest.natural)} valueColor={latest.natural < 0 ? NEGATIVE : "var(--ink)"}>
          <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{streakSentence}</p>
        </HeroKpi>
        <SideKpiList
          kpis={[
            { label: t("vitalBirths"), value: persons(latest.births), unit: "", color: BIRTHS, detail: `${first}: ${persons(model.births[first])}`, spark: { values: values(model.births, 1), color: BIRTHS } },
            { label: t("vitalDeaths"), value: persons(latest.deaths), unit: "", color: DEATHS, detail: `${first}: ${persons(model.deaths[first])}`, spark: { values: values(model.deaths, 1), color: DEATHS } },
            { label: t("vitalRatio"), value: latest.ratio === null ? persons(null) : persons(Math.round(latest.ratio)), unit: "", color: INK, detail: String(latest.year) },
          ]}
        />
      </div>
      <Link
        href={pageHref(nationalHref, locale)}
        data-testid="vital-national-link"
        className="mt-6 flex min-h-11 items-center text-[13px] text-[var(--ink)] underline underline-offset-2"
      >
        {t("vitalCompare")}
      </Link>
    </section>
  );
}
```
  Prop names and shapes for `SideKpiList` items, `ExcelDownloadButton`, `ExplorerTable` and `SegmentedTabs` are copied from `components/demography/demography-migration.tsx`; if any differs on `main`, follow that file and report it. Hooks run before the early return only through `useMemo`/`useState` above it, as written; keep them there.

- [ ] **Step 5: Wire it into the place page.** In `lib/pages/demography-population-place.tsx`:
  - import `VitalSection` from `../../components/demography/vital-section`, `loadServedDemographyData` from `../data/demography/importDemography`, `vitalFactsForPlace` from `../explorer/demographyVital`, and `BIRTHS_DEATHS_PATH` from `../explorer/demographyRoutes` (Task 7 adds it; in this task add it now: `export const BIRTHS_DEATHS_PATH = "/explorer/demography/births-deaths";` in `lib/explorer/demographyRoutes.ts`, and use it for the `births-deaths` entry's `path` in `DEMOGRAPHY_PAGES`, leaving `live: false`);
  - add `loadServedDemographyData()` to the `Promise.all` in `renderPopulationPlacePage` (it is memoised, so this is not a second read);
  - after the existing `populationSources` filter add

```ts
  // The section's three originals; the population part keeps its own two.
  const vitalSources = sources.filter((source) =>
    source.sourceId === SOURCE_ID.births || source.sourceId === SOURCE_ID.deaths || source.sourceId === SOURCE_ID.naturalIncrease);
  // Only this place's births, deaths and natural increase go to the browser.
  const vitalFacts = vitalFactsForPlace(served, place.id);
```
  - render, inside `<ExplorerPage>` directly after the closing `</PopulationPlaceExplorer>`:

```tsx
        <VitalSection
          place={place}
          facts={vitalFacts}
          sources={vitalSources}
          siteOrigin={resolveSiteUrl()}
          workbookScope={workbookScopeFor(route)}
          nationalHref={BIRTHS_DEATHS_PATH}
        />
```
  The link to the national page is a 404 until Task 7 publishes it; Task 7's tests and Task 9's browser run cover it.

- [ ] **Step 6: Place-page tests.** In `tests/explorer/populationPlacePages.test.tsx` add to the "place pages" describe:

```tsx
  it("ends every place page with its own births and deaths section", async () => {
    for (const route of [{ kind: "country" } as const, { kind: "region", id: "imereti" } as const, { kind: "municipality", slug: "batumi" } as const]) {
      const html = await page(route);
      expect(count(html, /id="births-deaths"/g)).toBe(1);
      expect(html.indexOf('data-testid="population-highlights"')).toBeLessThan(html.indexOf('id="births-deaths"'));
    }
    const batumi = await page({ kind: "municipality", slug: "batumi" });
    expect(batumi).toContain("Births and deaths registered in Batumi, 2015–2025.");
    expect(batumi).not.toContain("Births and deaths registered in Georgia");
  });
```
  Existing assertions in this file may now fail because the page grew (for example a count of `data-testid="series-row"`, or `not.toMatch(GEORGIAN)` if a Georgian key is missing in English). Fix only real regressions in the new section; a count that legitimately includes the new section is recounted and reported.

- [ ] **Step 7: Run.** `npx vitest run tests/explorer/vitalSection.test.tsx tests/explorer/populationPlacePages.test.tsx tests/explorer/populationPlaceExplorer.test.tsx tests/explorer/demographyVital.test.ts`, `npm run typecheck`, `npm run lint`, `npm run i18n:check`: PASS.
- [ ] **Step 8: Commit.** `git add -A && git commit -m "feat(demography): births and deaths section on every Population place page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 5: The national places index (model)

**Files:**
- Create: `lib/explorer/demographyVitalIndex.ts`
- Modify: `lib/explorer/demographyPopulationIndex.ts` (export `ranked`, nothing else)
- Test: `tests/explorer/demographyVitalIndex.test.ts`

**Interfaces:**
- Consumes: `buildMunicipalityValueMapModel` (`lib/explorer/municipalityMapData.ts`), `ranked`, `birthsPer100Deaths` (Task 2), `MUNICIPAL_COUNTRY_ID`, `MunicipalListRow`.
- Produces:

```ts
export type VitalIndexModel = {
  year: number;
  map: MunicipalityMapModel;
  municipalities: MunicipalListRow[]; // value = births per 100 deaths (unrounded), ranked highest first
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  /** Births and deaths of the latest year, by list row id (municipality code, region id, `country.georgia`). */
  countsById: Readonly<Record<string, { births: number; deaths: number }>>;
  /** Municipalities (Tbilisi as 04) whose deaths exceeded births in the latest year. */
  deathsAhead: number;
  municipalityCount: number;
};
export function buildVitalIndexModel(input: { facts: readonly ServedDemographyObservation[]; regions: readonly MunicipalRegion[]; municipalities: Municipality[] }): VitalIndexModel;
export function deathsAheadCount(facts: readonly ServedDemographyObservation[], year: number): number;
```

- [ ] **Step 1: Failing test.** Create `tests/explorer/demographyVitalIndex.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildVitalIndexModel, deathsAheadCount, type VitalIndexModel } from "../../lib/explorer/demographyVitalIndex";

let index: VitalIndexModel;
let facts: Awaited<ReturnType<typeof loadServedDemographyData>>["facts"];
beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  index = buildVitalIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
});

describe("births per 100 deaths index", () => {
  it("uses the latest year and ranks highest first", () => {
    expect(index.year).toBe(2025);
    expect(index.municipalities).toHaveLength(64);
    expect(index.regions).toHaveLength(11);
    expect(index.regions[0]!.id).toBe("region.adjara");
    expect(index.regions.at(-1)!.id).toBe("region.racha_lechkhumi_kvemo_svaneti");
    expect(index.regions.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(Math.round(index.country.valueGel)).toBe(85);
  });

  it("keeps the counts behind each ratio", () => {
    expect(index.countsById["country.georgia"]).toEqual({ births: 37_867, deaths: 44_319 });
    expect(index.countsById["region.imereti"]).toEqual({ births: 4_275, deaths: 7_197 });
    expect(index.countsById["06"]).toEqual({ births: 2_630, deaths: 1_779 });
    expect(Math.round(index.municipalities.find((row) => row.id === "17")!.valueGel)).toBe(100);
  });

  it("counts municipalities where deaths exceeded births", () => {
    expect(index.deathsAhead).toBe(53);
    expect(index.municipalityCount).toBe(64);
    expect(deathsAheadCount(facts, 2015)).toBe(32);
  });

  it("draws every municipality on the map", () => {
    expect(index.map.shapes.length).toBeGreaterThan(0);
  });
});
```
  Run: FAIL.

- [ ] **Step 2: Export `ranked`.** In `lib/explorer/demographyPopulationIndex.ts` change `const ranked =` to `export const ranked =` and add a one-line comment above it: `/** Rows ranked highest first, numbered from 1; equal values keep their input order. Shared with the births index. */`. No other change.

- [ ] **Step 3: Implement.** Create `lib/explorer/demographyVitalIndex.ts`:

```ts
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import { MUNICIPAL_COUNTRY_ID, type Municipality, type MunicipalRegion } from "../data/municipal/types";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { ranked } from "./demographyPopulationIndex";
import { birthsPer100Deaths } from "./demographyVital";
import { formatInUnit, UNIT_PERSONS } from "./format";
import type { MunicipalListRow } from "./municipalData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";

export type VitalIndexModel = {
  year: number;
  map: MunicipalityMapModel;
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  countsById: Readonly<Record<string, { births: number; deaths: number }>>;
  deathsAhead: number;
  municipalityCount: number;
};

const isMunicipality = (id: string) => /^\d{2}$/.test(id);

function countsFor(facts: readonly ServedDemographyObservation[], year: number): Map<string, { births: number; deaths: number }> {
  const counts = new Map<string, { births: number; deaths: number }>();
  for (const fact of facts) {
    if (fact.year !== year || (fact.seriesId !== SERIES.liveBirths && fact.seriesId !== SERIES.deaths)) continue;
    const entry = counts.get(fact.geographyId) ?? { births: Number.NaN, deaths: Number.NaN };
    if (fact.seriesId === SERIES.liveBirths) entry.births = fact.value;
    else entry.deaths = fact.value;
    counts.set(fact.geographyId, entry);
  }
  return counts;
}

/** Municipalities (Tbilisi as 04) whose registered deaths exceeded births in the year; an equal year does not count. */
export function deathsAheadCount(facts: readonly ServedDemographyObservation[], year: number): number {
  return [...countsFor(facts, year)].filter(([id, { births, deaths }]) => isMunicipality(id) && deaths > births).length;
}

/**
 * The national page's places block: the Budget index rows with births per 100 deaths in the money-named `valueGel`, the
 * convention the Population index already uses for persons. The ratio needs no population figure, so the census re-base
 * does not touch it.
 */
export function buildVitalIndexModel({
  facts,
  regions,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
}): VitalIndexModel {
  const municipalYears = facts.filter((fact) => fact.seriesId === SERIES.liveBirths && isMunicipality(fact.geographyId)).map((fact) => fact.year);
  if (municipalYears.length === 0) throw new Error("No municipal births for the index");
  const year = Math.max(...municipalYears);
  const counts = countsFor(facts, year);
  const ratio = (id: string): number => {
    const entry = counts.get(id);
    const value = entry ? birthsPer100Deaths(entry.births, entry.deaths) : null;
    if (value === null || !Number.isFinite(value)) throw new Error(`No ${year} births per 100 deaths for ${id}`);
    return value;
  };
  const values = new Map(municipalities.map((municipality) => [municipality.code, ratio(municipality.code)]));
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const municipalityRows = ranked(
    municipalities.map((municipality) => ({
      id: municipality.code,
      kind: "municipality" as const,
      nameKa: municipality.displayNameKa,
      subtitleKa: regionLabels.get(municipality.regionId) ?? "",
      regionId: municipality.regionId,
      valueGel: values.get(municipality.code)!,
      budgetPerResidentGel: null,
    })),
  );
  const regionRows = ranked(
    regions.map((region) => ({
      id: region.id,
      kind: "region" as const,
      nameKa: region.kaLabel,
      subtitleKa: `${municipalities.filter((municipality) => municipality.regionId === region.id).length} მუნიციპალიტეტი`,
      regionId: region.id,
      valueGel: ratio(region.id),
      budgetPerResidentGel: null,
    })),
  );
  const country: MunicipalListRow = {
    id: MUNICIPAL_COUNTRY_ID,
    kind: "country",
    nameKa: "საქართველო",
    subtitleKa: `${municipalities.length} მუნიციპალიტეტი`,
    regionId: null,
    valueGel: ratio(GEORGIA_PLACE_ID),
    budgetPerResidentGel: null,
    rank: null,
  };
  const countsById = Object.fromEntries(
    [...municipalities.map((municipality) => municipality.code), ...regions.map((region) => region.id), GEORGIA_PLACE_ID].map((id) => [id, counts.get(id)!]),
  );
  return {
    year,
    map: buildMunicipalityValueMapModel({ municipalities, values, display: (_code, value) => formatInUnit(value, UNIT_PERSONS) }),
    municipalities: municipalityRows,
    regions: regionRows,
    country,
    countsById,
    deathsAhead: deathsAheadCount(facts, year),
    municipalityCount: municipalities.length,
  };
}
```
  `MUNICIPAL_COUNTRY_ID` and `GEORGIA_PLACE_ID` are both `"country.georgia"`. If `Municipality`'s Georgian name field is not `displayNameKa`, copy the field `buildPopulationIndexModel` uses.
- [ ] **Step 4: Run.** The new test and `npx vitest run tests/explorer/demographyPopulationIndex*` (whatever the Population index tests are called): PASS. `npm run typecheck`: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(demography): births per 100 deaths index for every place" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 6: Fertility and life expectancy (models and workbooks)

**Files:**
- Create: `lib/explorer/demographyNational.ts`, `lib/explorer/demographyNationalWorkbook.ts`
- Modify: `lib/servedRows.ts`, `lib/explorer/clientData.ts`, both `demography.json` files
- Test: `tests/explorer/demographyNational.test.ts`

**Interfaces:**
- Produces:

```ts
// lib/servedRows.ts
/** A national rate as the browser receives it: the fertility and life-expectancy series, with the mother's age group where it has one ("" otherwise). */
export type ClientNationalFact = { seriesId: string; year: number; ageGroup: string; value: number };
// lib/explorer/clientData.ts
export function projectNationalObservation(fact: ServedDemographyObservation): ClientNationalFact;
// lib/explorer/demographyNational.ts
export const NATIONAL_SERIES: readonly string[]; // total_fertility_rate, age_specific_fertility_rate, life_expectancy_total/_male/_female
export const AGE_GROUPS: readonly ["mother_under_20", "mother_20_24", "mother_25_29", "mother_30_34", "mother_35_39", "mother_40_44", "mother_45_54"];
export type AgeGroup = (typeof AGE_GROUPS)[number];
export const UNIT_RATE_2: ValueUnit; // { divisor: 1, label: "", decimals: 2 }
export function nationalYears(facts: readonly ClientNationalFact[]): number[];
export function seriesByYear(facts: readonly ClientNationalFact[], seriesId: string, ageGroup?: string): Record<number, number | null>;
export function ageCurves(facts: readonly ClientNationalFact[]): { years: number[]; byYear: Record<number, Record<AgeGroup, number | null>> };
export const LIFE_SERIES: readonly { seriesId: string; key: "lifeTotal" | "lifeMale" | "lifeFemale"; colorKey: string | null }[];
// lib/explorer/demographyNationalWorkbook.ts
export function buildFertilityWorkbookExportModel(input: { facts: readonly ClientNationalFact[]; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel;
export function buildLifeWorkbookExportModel(input: { facts: readonly ClientNationalFact[]; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string }, presentation: Presentation): WorkbookExportModel;
```

Messages added in this task (en / ka draft):

| Key | en | ka |
| --- | --- | --- |
| `demography.fertilityTitle` | Fertility | ნაყოფიერება |
| `demography.tfrLabel` | Total fertility rate | შობადობის ჯამობრივი კოეფიციენტი |
| `demography.tfrUnit` | children per woman | ბავშვი ერთ ქალზე |
| `demography.asfrLabel` | Births per 1,000 women, by mother's age | დაბადებები 1,000 ქალზე, დედის ასაკის მიხედვით |
| `demography.asfrUnit` | births per 1,000 women | დაბადება 1,000 ქალზე |
| `demography.ageGroup.mother_under_20` | Under 20 | 20-მდე |
| `demography.ageGroup.mother_20_24` | 20–24 | 20–24 |
| `demography.ageGroup.mother_25_29` | 25–29 | 25–29 |
| `demography.ageGroup.mother_30_34` | 30–34 | 30–34 |
| `demography.ageGroup.mother_35_39` | 35–39 | 35–39 |
| `demography.ageGroup.mother_40_44` | 40–44 | 40–44 |
| `demography.ageGroup.mother_45_54` | 45–54 | 45–54 |
| `demography.ageHeader` | Mother's age | დედის ასაკი |
| `demography.otherYears` | Other years | სხვა წლები |
| `demography.asfrNote` | The youngest and oldest groups (under 20, 45–54) are as Geostat publishes them. Rates use the population of women as the denominator, so from 2025 they rest on the 2024 census. | ყველაზე ახალგაზრდა და ყველაზე ასაკოვანი ჯგუფები (20-მდე, 45–54) საქსტატის მიერ გამოქვეყნებულის შესაბამისია. კოეფიციენტები ქალთა რიცხოვნობას ეფუძნება, ამიტომ 2025 წლიდან 2024 წლის აღწერას ეყრდნობა. |
| `demography.lifeTitle` | Life expectancy at birth | სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას |
| `demography.lifeTotal` | Total | სულ |
| `demography.lifeMale` | Men | მამაკაცები |
| `demography.lifeFemale` | Women | ქალები |
| `demography.lifeUnit` | years | წელი |
| `demography.seriesHeader` | Indicator | მაჩვენებელი |
| `demography.unitHeader` | Unit | ერთეული |
| `demography.valueHeader` | Value | მნიშვნელობა |
| `demography.fertilityWorkbookTitle` | Fertility, Georgia | ნაყოფიერება, საქართველო |
| `demography.lifeWorkbookTitle` | Life expectancy at birth, Georgia | სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას, საქართველო |

- [ ] **Step 1: Failing test.** Create `tests/explorer/demographyNational.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { projectNationalObservation } from "../../lib/explorer/clientData";
import { AGE_GROUPS, ageCurves, NATIONAL_SERIES, nationalYears, seriesByYear } from "../../lib/explorer/demographyNational";
import { buildFertilityWorkbookExportModel, buildLifeWorkbookExportModel } from "../../lib/explorer/demographyNationalWorkbook";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { ClientNationalFact } from "../../lib/servedRows";

let facts: ClientNationalFact[];
beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => NATIONAL_SERIES.includes(fact.seriesId)).map(projectNationalObservation);
});

describe("national series", () => {
  it("hold only the five national series, 2014–2025, without provenance", () => {
    expect(facts).toHaveLength(12 * 4 + 84);
    expect(Object.keys(facts[0]!).sort()).toEqual(["ageGroup", "seriesId", "value", "year"]);
    expect(nationalYears(facts)).toEqual([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it("read the total fertility rate and life expectancy", () => {
    expect(seriesByYear(facts, SERIES.totalFertilityRate)[2014]).toBe(2.31);
    expect(seriesByYear(facts, SERIES.totalFertilityRate)[2025]).toBe(1.53);
    expect(seriesByYear(facts, SERIES.lifeExpectancyTotal)[2025]).toBe(76);
    expect(seriesByYear(facts, SERIES.lifeExpectancyMale)[2025]).toBe(71.4);
    expect(seriesByYear(facts, SERIES.lifeExpectancyFemale)[2025]).toBe(80.6);
  });

  it("build one age curve per year in the published group order", () => {
    const curves = ageCurves(facts);
    expect(curves.years).toHaveLength(12);
    expect(AGE_GROUPS.map((group) => curves.byYear[2014]![group]).slice(0, 3)).toEqual([51.5, 144.7, 131.3]);
    expect(AGE_GROUPS.map((group) => curves.byYear[2025]![group]).slice(0, 3)).toEqual([12.4, 62.4, 95.9]);
  });
});

describe("national workbooks", () => {
  it("fertility: the total rate and the seven age rows, by year", async () => {
    const presentation = await getPresentation("en", ["demography", "workbook"], []);
    const model = buildFertilityWorkbookExportModel({ facts, sources: [], siteOrigin: "https://fiscal.ge" }, presentation);
    expect(model.filename).toContain("demography-fertility-2014-2025");
    expect(model.readable.rows).toHaveLength(8);
    expect(model.readable.rows[0]!.label).toBe("Total fertility rate (children per woman)");
    expect(model.readable.rows[1]!.label).toBe("Under 20 (births per 1,000 women)");
    expect(model.analysis.rows).toHaveLength(12 * 8);
  });

  it("life expectancy: three rows by year", async () => {
    const presentation = await getPresentation("en", ["demography", "workbook"], []);
    const model = buildLifeWorkbookExportModel({ facts, sources: [], siteOrigin: "https://fiscal.ge" }, presentation);
    expect(model.readable.rows.map((row) => row.label)).toEqual(["Total", "Men", "Women"]);
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(76);
    expect(model.analysis.rows).toHaveLength(36);
  });
});
```
  Run: FAIL.

- [ ] **Step 2: Client type and projection.** In `lib/servedRows.ts` add after `ClientMigrationFact`:

```ts
/** A national rate as the browser receives it: the fertility and life-expectancy series, with the mother's age group where it has one ("" otherwise). */
export type ClientNationalFact = { seriesId: string; year: number; ageGroup: string; value: number };
```
  In `lib/explorer/clientData.ts` import `ClientNationalFact` with the other client types and add after `projectMigrationObservation`:

```ts
export function projectNationalObservation(fact: ServedDemographyObservation): ClientNationalFact {
  return { seriesId: fact.seriesId, year: fact.year, ageGroup: fact.ageGroup ?? "", value: fact.value };
}
```

- [ ] **Step 3: Messages.** Add the 25 keys in the table above to both files.

- [ ] **Step 4: Models.** Create `lib/explorer/demographyNational.ts`:

```ts
import { SERIES } from "../data/demography/series";
import type { ClientNationalFact } from "../servedRows";
import type { ValueUnit } from "./format";

/** The five national series the births-deaths page shows. The crude rates and infant mortality are mirrored, not shown. */
export const NATIONAL_SERIES: readonly string[] = [
  SERIES.totalFertilityRate,
  SERIES.ageSpecificFertilityRate,
  SERIES.lifeExpectancyTotal,
  SERIES.lifeExpectancyMale,
  SERIES.lifeExpectancyFemale,
];

/** Geostat's seven mother's-age groups, youngest first; the first and last are wider than the rest, as published. */
export const AGE_GROUPS = ["mother_under_20", "mother_20_24", "mother_25_29", "mother_30_34", "mother_35_39", "mother_40_44", "mother_45_54"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** The total fertility rate prints to two decimals, as Geostat publishes it. */
export const UNIT_RATE_2: ValueUnit = { divisor: 1, label: "", decimals: 2 };

export const LIFE_SERIES = [
  { seriesId: SERIES.lifeExpectancyTotal, key: "lifeTotal", colorKey: null },
  { seriesId: SERIES.lifeExpectancyMale, key: "lifeMale", colorKey: "sex.male" },
  { seriesId: SERIES.lifeExpectancyFemale, key: "lifeFemale", colorKey: "sex.female" },
] as const;

export function nationalYears(facts: readonly ClientNationalFact[]): number[] {
  return [...new Set(facts.map((fact) => fact.year))].sort((left, right) => left - right);
}

export function seriesByYear(facts: readonly ClientNationalFact[], seriesId: string, ageGroup = ""): Record<number, number | null> {
  return Object.fromEntries(
    nationalYears(facts).map((year) => [year, facts.find((fact) => fact.seriesId === seriesId && fact.year === year && fact.ageGroup === ageGroup)?.value ?? null]),
  );
}

/** Each year's rates across the seven age groups: one line per year on the fertility curve. */
export function ageCurves(facts: readonly ClientNationalFact[]): { years: number[]; byYear: Record<number, Record<AgeGroup, number | null>> } {
  const rates = facts.filter((fact) => fact.seriesId === SERIES.ageSpecificFertilityRate);
  const years = nationalYears(rates);
  return {
    years,
    byYear: Object.fromEntries(
      years.map((year) => [
        year,
        Object.fromEntries(AGE_GROUPS.map((group) => [group, rates.find((fact) => fact.year === year && fact.ageGroup === group)?.value ?? null])) as Record<AgeGroup, number | null>,
      ]),
    ),
  };
}
```

- [ ] **Step 5: Workbooks.** Create `lib/explorer/demographyNationalWorkbook.ts`:

```ts
import { CENSUS_STEP, SERIES, SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientNationalFact } from "../servedRows";
import { AGE_GROUPS, LIFE_SERIES, nationalYears, seriesByYear } from "./demographyNational";
import { SHEET_NAMES, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

type Input = { facts: readonly ClientNationalFact[]; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string };
type Line = { label: string; unit: string; values: Record<number, number | null> };

function nationalWorkbook(input: Input, presentation: Presentation, spec: { slug: string; titleKey: string; sourceId: string; lines: Line[]; decimals: number }): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const w = (key: string) => workbookMessage(locale, key);
  const years = nationalYears(input.facts);
  const [first, last] = [years[0]!, years.at(-1)!];
  const yearLabel = (year: number) => (year === CENSUS_STEP.toYear ? `${year} · ${t("breakLabel")}` : String(year));
  const row = (line: Line): WorkbookReadableRow => ({
    kind: "item",
    parentLabel: null,
    label: line.label,
    change: null,
    valuesByYear: Object.fromEntries(years.map((year) => [year, line.values[year] ?? null])),
    basisByYear: Object.fromEntries(years.map((year) => [year, line.values[year] === null ? null : ("published" as const)])),
  });
  const originals = input.sources
    .filter((source) => source.sourceId === spec.sourceId)
    .map(({ sourceId: _sourceId, ...source }) => ({ ...source, years: source.years.filter((year) => years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  return {
    locale,
    filename: workbookFilename(`demography-${spec.slug}-${first}-${last}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t(spec.titleKey),
      subtitle: `${first}–${last}`,
      unitLabel: "",
      amountDecimals: spec.decimals,
      showChangeColumn: false,
      years,
      // The re-base year says so in its column header: these rates use population denominators.
      headerLabels: { category: t("seriesHeader"), columns: years.map(yearLabel), wrap: true },
      rows: spec.lines.map(row),
    },
    analysis: {
      headers: [t("seriesHeader"), w("workbook.year"), t("valueHeader"), t("unitHeader"), t("basisHeader"), w("workbook.status")],
      rows: spec.lines.flatMap((line) =>
        years.map((year) => [line.label, year, line.values[year] ?? null, line.unit, t("vitalBasis"), w(line.values[year] === null ? "workbook.unavailable" : "workbook.published")]),
      ),
      numericFormats: { 3: spec.decimals === 2 ? "0.00" : "0.0" },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}

export function buildFertilityWorkbookExportModel(input: Input, presentation: Presentation): WorkbookExportModel {
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  const [tfrUnit, asfrUnit] = [t("tfrUnit"), t("asfrUnit")];
  return nationalWorkbook(input, presentation, {
    slug: "fertility",
    titleKey: "fertilityWorkbookTitle",
    sourceId: SOURCE_ID.fertility,
    decimals: 2,
    lines: [
      { label: `${t("tfrLabel")} (${tfrUnit})`, unit: tfrUnit, values: seriesByYear(input.facts, SERIES.totalFertilityRate) },
      ...AGE_GROUPS.map((group) => ({
        label: `${t(`ageGroup.${group}`)} (${asfrUnit})`,
        unit: asfrUnit,
        values: seriesByYear(input.facts, SERIES.ageSpecificFertilityRate, group),
      })),
    ],
  });
}

export function buildLifeWorkbookExportModel(input: Input, presentation: Presentation): WorkbookExportModel {
  const t = (key: string) => message(presentation.messages, `demography.${key}`);
  return nationalWorkbook(input, presentation, {
    slug: "life-expectancy",
    titleKey: "lifeWorkbookTitle",
    sourceId: SOURCE_ID.lifeExpectancy,
    decimals: 1,
    lines: LIFE_SERIES.map((line) => ({ label: t(line.key), unit: t("lifeUnit"), values: seriesByYear(input.facts, line.seriesId) })),
  });
}
```
  If `headerLabels` or `amountDecimals` are typed differently than in `demographyPopulationWorkbook.ts`, follow that file. The Summary sheet mixes the fertility rate (two decimals) with age rates (one decimal) under one `amountDecimals: 2`; this is accepted (the age rates then print `51.50`). If the reviewer objects, the alternative is two decimals for the rate row only, which the shared writer does not support: report, do not change the writer.
- [ ] **Step 6: Run.** The test: PASS. `npm run typecheck`, `npm run i18n:check`: PASS.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(demography): fertility and life expectancy models and workbooks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 7: The national page, its routes, the hub card and discovery

**Files:**
- Create: `components/demography/national-vital-charts.tsx`, `lib/pages/demography-births-deaths.tsx`, `app/(ka)/explorer/demography/births-deaths/page.tsx`, `app/(en)/en/explorer/demography/births-deaths/page.tsx`
- Modify: `lib/explorer/demographyRoutes.ts` (`live: true`), `lib/explorer/demographyHubCards.ts`, both `demography.json` files, `data/localization/en/page-revisions.json`, `public/llms.txt`
- Test: `tests/explorer/demographyHub.test.ts`, `tests/explorer/demographyPages.test.tsx`, `tests/explorer/demographyDiscovery.test.ts`, `tests/explorer/demographySidebar.test.tsx`, `tests/seo/agentFiles.test.ts`, `tests/seo/routes.test.ts`, then every pin the two new URLs move.

**Interfaces:**
- Consumes: Tasks 2–6; `MunicipalitiesIndex`; `populationHrefById`; `loadPopulationBasics`, `loadPopulationSources`.
- Produces: `demographyBirthsDeathsPageMetadata(locale)`, `renderDemographyBirthsDeathsPage(locale)`; `NationalVitalCharts({ facts, sources, siteOrigin })`.

Messages added in this task (en / ka draft):

| Key | en | ka |
| --- | --- | --- |
| `demography.birthsMetaTitle` | Births, deaths and fertility — Demography | შობადობა და სიკვდილიანობა — დემოგრაფია |
| `demography.birthsCoverage` | {first}–{last} · annual | {first}–{last} · წლიური |
| `demography.birthsLead` | Registered births and deaths for Georgia, its regions and municipalities, and Georgia's fertility and life expectancy. | რეგისტრირებული დაბადებები და გარდაცვალებები საქართველოს, მისი რეგიონებისა და მუნიციპალიტეტების მიხედვით, ასევე საქართველოს ნაყოფიერება და სიცოცხლის ხანგრძლივობა. |
| `demography.ratioUnit` | births per 100 deaths | დაბადება 100 გარდაცვალებაზე |
| `demography.ratioMapAria` | Municipalities by births per 100 deaths, {year} | მუნიციპალიტეტები დაბადებების მიხედვით 100 გარდაცვალებაზე, {year} |
| `demography.ratioLegend` | Births per 100 deaths, {year} | დაბადება 100 გარდაცვალებაზე, {year} |
| `demography.ratioMapNote` | Under 100: more people died than were born. The ratio uses registered counts and does not change at the census re-base. | 100-ზე ნაკლები: გარდაიცვალა მეტი, ვიდრე დაიბადა. შეფარდება რეგისტრირებულ რიცხვებს ეფუძნება და აღწერით გადათვლისას არ იცვლება. |
| `demography.ratioCounts` | {births} births · {deaths} deaths | {births} დაბადება · {deaths} გარდაცვალება |
| `demography.kpiBirths` | Births, {year} | დაბადებები, {year} |
| `demography.kpiDeaths` | Deaths, {year} | გარდაცვალებები, {year} |
| `demography.kpiRatio` | Births per 100 deaths, Georgia | დაბადება 100 გარდაცვალებაზე, საქართველო |
| `demography.kpiDeathsAhead` | Municipalities with more deaths than births | მუნიციპალიტეტები, სადაც გარდაცვალება დაბადებას აღემატება |
| `demography.kpiOf` | {count} of {total} | {count} / {total} |
| `demography.kpiDetailYear` | {year} | {year} |
| `demography.birthsSource` | Source: Geostat, live births and deaths by region and self-governed unit, {first}–{last}. | წყარო: საქსტატი, ცოცხლად დაბადებულთა და გარდაცვლილთა რაოდენობა რეგიონებისა და თვითმმართველი ერთეულების მიხედვით, {first}–{last}. |
| `demography.nationalSource` | Source: Geostat, fertility rates and life expectancy at birth, Georgia, {first}–{last}. | წყარო: საქსტატი, ნაყოფიერების კოეფიციენტები და სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას, საქართველო, {first}–{last}. |
| `demography.tfrChartAria` | Total fertility rate, Georgia, {first}–{last} | შობადობის ჯამობრივი კოეფიციენტი, საქართველო, {first}–{last} |
| `demography.asfrChartAria` | Births per 1,000 women by mother's age, one line per year, {first} and {last} in colour | დაბადებები 1,000 ქალზე დედის ასაკის მიხედვით, თითო ხაზი თითო წელზე, {first} და {last} ფერადად |
| `demography.lifeChartAria` | Life expectancy at birth, total, men and women, Georgia, {first}–{last} | სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას, სულ, მამაკაცები და ქალები, საქართველო, {first}–{last} |
| `demography.birthsCardFooter` | {year}: {births} births · {first}–{last} | {year}: {births} დაბადება · {first}–{last} |

- [ ] **Step 1: Failing tests.**
  - `tests/explorer/demographyHub.test.ts`: live pages `["population", "migration", "births-deaths"]`; hrefs `["/explorer/demography/population", null, "/explorer/demography/migration", "/explorer/demography/births-deaths"]`; `comingSoon` `[false, true, false, false]`; rename the first describe's title to say three pages are live; add

```ts
  it("draws the births card from Georgia's registered births", async () => {
    const { facts } = await loadServedDemographyData();
    const presentation = await getPresentation("en", ["demography"], []);
    const card = buildDemographyHubCards(facts, presentation)[3]!;
    expect(card.series).toHaveLength(12);
    expect(card.series![0]).toBe(60_635);
    expect(card.footer).toBe("2025: 37,867 births · 2014–2025");
  });
```
  - `tests/explorer/demographyPages.test.tsx`: the hub's `aria-disabled="true"` count `2` → `1`; add `expect(html).toContain('href="/en/explorer/demography/births-deaths"');` beside the migration link assertion; add

```tsx
describe("births and deaths page", () => {
  it("renders the places block, fertility and life expectancy, with no dataset markup", async () => {
    const html = renderToStaticMarkup(await renderDemographyBirthsDeathsPage("en"));
    expect(html).toContain(">Births, deaths and fertility</h1>");
    expect(html).toContain("2014–2025 · annual");
    expect(html).toContain("Births per 100 deaths, 2025");
    expect(html).toContain("53 of 64");
    expect(html).toContain('href="/en/explorer/demography/population/batumi#births-deaths"');
    expect(html).toContain('href="/en/explorer/demography/population/region/tbilisi#births-deaths"');
    expect(html).toContain('data-testid="fertility-section"');
    expect(html).toContain('data-testid="life-section"');
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('"@type":"Dataset"');
    expect(html).not.toMatch(/\p{Script=Georgian}/u);
  });

  it("has its own canonical address and title", async () => {
    const metadata = await demographyBirthsDeathsPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/births-deaths");
    expect(String(metadata.title)).toBe("შობადობა და სიკვდილიანობა — დემოგრაფია | Fiscal.ge");
  });
});
```
  (import both from `../../lib/pages/demography-births-deaths`; stub `NEXT_PUBLIC_SITE_URL` as the migration describe does; mock the map sprite the way `populationPlacePages.test.tsx` does if the page test file does not already.) If the English page carries Georgian in embedded data (place names in the list's data), the existing ruling applies: guards check visible text, attributes, metadata and JSON-LD; copy the assertion the Population index test uses instead of `not.toMatch` on the whole HTML.
  - `tests/explorer/demographyDiscovery.test.ts`: add `"/explorer/demography/births-deaths"` to `PAGES` and to the dated-pages list.
  - `tests/explorer/demographySidebar.test.tsx`: add a case for `/en/explorer/demography/births-deaths` expecting `'data-testid="demography-births-deaths-link" aria-current="page"'`.
  - `tests/seo/agentFiles.test.ts`: add `"https://fiscal.ge/explorer/demography/births-deaths",` after the migration URL.
  Run them: FAIL.

- [ ] **Step 2: Messages.** Add the 20 keys above to both files.

- [ ] **Step 3: The lower two blocks.** Create `components/demography/national-vital-charts.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CENSUS_STEP, SERIES } from "../../lib/data/demography/series";
import { ACCENT, INK, OTHER_COLOR, SERIES_COLORS } from "../../lib/explorer/colors";
import { AGE_GROUPS, ageCurves, LIFE_SERIES, nationalYears, seriesByYear, UNIT_RATE_2 } from "../../lib/explorer/demographyNational";
import { buildFertilityWorkbookExportModel, buildLifeWorkbookExportModel } from "../../lib/explorer/demographyNationalWorkbook";
import { formatInUnit, UNIT_DENSITY } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookExportModel, WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientNationalFact } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { SectionTitle, SegmentedTabs, SourceNote } from "../ui/editorial";

/** The first year of the fertility curve; the last is ACCENT. Distinct from the grey of the years between. */
const FIRST_YEAR_COLOR = "#3D5A98";

function ModeTabs({ value, onChange, testId }: { value: ChartMode; onChange: (mode: ChartMode) => void; testId: string }) {
  const { messages } = useI18n();
  return (
    <SegmentedTabs<ChartMode>
      ariaLabel={message(messages, "controls.viewMode")}
      value={value}
      onChange={onChange}
      options={[
        { value: "line", label: message(messages, "municipal.line"), testId: `${testId}-mode-line` },
        { value: "table", label: message(messages, "controls.table"), testId: `${testId}-mode-table` },
      ]}
    />
  );
}

function Download({ testId, build }: { testId: string; build: () => WorkbookExportModel }) {
  return (
    <div className="mt-4 w-full max-w-[260px]">
      <ExcelDownloadButton
        testId={testId}
        onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(build());
        }}
      />
    </div>
  );
}

export function NationalVitalCharts({
  facts,
  sources,
  siteOrigin,
}: {
  facts: ClientNationalFact[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
}) {
  const presentation = useI18n();
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  useAppReady();
  const [tfrMode, setTfrMode] = useState<ChartMode>("line");
  const [ageMode, setAgeMode] = useState<ChartMode>("line");
  const [lifeMode, setLifeMode] = useState<ChartMode>("line");
  const years = nationalYears(facts);
  const [first, last] = [years[0]!, years.at(-1)!];
  const breaks = [{ year: CENSUS_STEP.toYear, label: t("breakLabel") }];
  const flat = (record: Record<number, number | null>) => years.map((year) => record[year] ?? null);
  const none = years.map(() => false);
  const tfr = seriesByYear(facts, SERIES.totalFertilityRate);
  const curves = ageCurves(facts);
  // x positions 1..7 stand for the seven age groups; the period label prints the group's name.
  const positions = AGE_GROUPS.map((_, index) => index + 1);
  const ageLabel = (position: number) => t(`ageGroup.${AGE_GROUPS[position - 1]}`);
  const ageColor = (year: number) => (year === curves.years[0] ? FIRST_YEAR_COLOR : year === curves.years.at(-1) ? ACCENT : OTHER_COLOR);
  // Grey years first, so the two coloured lines are drawn on top.
  const ageOrder = [...curves.years.slice(1, -1), curves.years[0]!, curves.years.at(-1)!];
  const lifeColor = (colorKey: string | null) => (colorKey === null ? INK : SERIES_COLORS[colorKey]!);
  const rate1 = (value: number) => formatInUnit(value, UNIT_DENSITY);

  return (
    <>
      <section data-testid="fertility-section" className="mt-16 border-t-2 border-[var(--ink)] pt-[22px]">
        <SectionTitle>{t("fertilityTitle")}</SectionTitle>
        <h3 className="mt-6 mb-3 text-[15px] text-[var(--ink)]">{`${t("tfrLabel")} (${t("tfrUnit")})`}</h3>
        <ModeTabs value={tfrMode} onChange={setTfrMode} testId="tfr" />
        <div className="mt-5">
          {tfrMode === "line" ? (
            <EditorialLineChart
              years={years}
              series={[{ id: SERIES.totalFertilityRate, label: t("tfrLabel"), color: INK, vals: flat(tfr), planned: none }]}
              share={false}
              unit={UNIT_RATE_2}
              shareLabel=""
              formatTooltipValue={(value) => formatInUnit(value, UNIT_RATE_2)}
              breaks={breaks}
            />
          ) : (
            <ExplorerTable
              caption={t("tfrChartAria", { first, last })}
              rows={[{ itemId: SERIES.totalFertilityRate, kaLabel: t("tfrLabel"), color: INK, valuesByYear: tfr }]}
              totalRow={null}
              showTotal={false}
              wrapRowLabels
              rowLabelsLocalized
              years={years}
              firstColumnLabel={t("seriesHeader")}
              unit={UNIT_RATE_2}
              share={false}
              showChangeColumn={false}
              breakYears={[CENSUS_STEP.toYear]}
              breakLabel={t("breakLabel")}
              shareValueForYear={() => null}
            />
          )}
        </div>
        <h3 className="mt-10 mb-3 text-[15px] text-[var(--ink)]">{t("asfrLabel")}</h3>
        <ModeTabs value={ageMode} onChange={setAgeMode} testId="asfr" />
        <div className="mt-5" data-testid="asfr-panel">
          {ageMode === "line" ? (
            <>
              <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[var(--body)]" data-testid="asfr-legend">
                {[
                  { label: String(curves.years[0]), color: FIRST_YEAR_COLOR },
                  { label: String(curves.years.at(-1)), color: ACCENT },
                  { label: t("otherYears"), color: OTHER_COLOR },
                ].map((item) => (
                  <li key={item.label} className="inline-flex items-center gap-2">
                    <span aria-hidden className="inline-block h-[3px] w-4" style={{ background: item.color }} />
                    {item.label}
                  </li>
                ))}
              </ul>
              <EditorialLineChart
                years={positions}
                series={ageOrder.map((year) => ({
                  id: String(year),
                  label: String(year),
                  color: ageColor(year),
                  vals: AGE_GROUPS.map((group) => curves.byYear[year]![group]),
                  planned: AGE_GROUPS.map(() => false),
                }))}
                share={false}
                unit={UNIT_DENSITY}
                shareLabel=""
                formatTooltipValue={rate1}
                formatPeriod={(position) => ageLabel(position)}
              />
            </>
          ) : (
            <ExplorerTable
              caption={t("asfrChartAria", { first: curves.years[0]!, last: curves.years.at(-1)! })}
              rows={AGE_GROUPS.map((group) => ({
                itemId: group,
                kaLabel: t(`ageGroup.${group}`),
                color: OTHER_COLOR,
                valuesByYear: seriesByYear(facts, SERIES.ageSpecificFertilityRate, group),
              }))}
              totalRow={null}
              showTotal={false}
              wrapRowLabels
              rowLabelsLocalized
              years={curves.years}
              firstColumnLabel={t("ageHeader")}
              unit={UNIT_DENSITY}
              share={false}
              showChangeColumn={false}
              breakYears={[CENSUS_STEP.toYear]}
              breakLabel={t("breakLabel")}
              shareValueForYear={() => null}
            />
          )}
        </div>
        <div className="mt-[18px] max-w-[740px]"><SourceNote testId="asfr-note">{t("asfrNote")}</SourceNote></div>
        <Download testId="fertility-excel-download" build={() => buildFertilityWorkbookExportModel({ facts, sources, siteOrigin }, presentation)} />
      </section>
      <section data-testid="life-section" className="mt-16 border-t-2 border-[var(--ink)] pt-[22px]">
        <SectionTitle>{t("lifeTitle")}</SectionTitle>
        <div className="mt-5"><ModeTabs value={lifeMode} onChange={setLifeMode} testId="life" /></div>
        <div className="mt-5">
          {lifeMode === "line" ? (
            <EditorialLineChart
              years={years}
              series={LIFE_SERIES.map((line) => ({ id: line.seriesId, label: t(line.key), color: lifeColor(line.colorKey), vals: flat(seriesByYear(facts, line.seriesId)), planned: none }))}
              share={false}
              unit={UNIT_DENSITY}
              shareLabel=""
              formatTooltipValue={rate1}
              breaks={breaks}
            />
          ) : (
            <ExplorerTable
              caption={t("lifeChartAria", { first, last })}
              rows={LIFE_SERIES.map((line) => ({ itemId: line.seriesId, kaLabel: t(line.key), color: lifeColor(line.colorKey), valuesByYear: seriesByYear(facts, line.seriesId) }))}
              totalRow={null}
              showTotal={false}
              wrapRowLabels
              rowLabelsLocalized
              years={years}
              firstColumnLabel={t("seriesHeader")}
              unit={UNIT_DENSITY}
              share={false}
              showChangeColumn={false}
              breakYears={[CENSUS_STEP.toYear]}
              breakLabel={t("breakLabel")}
              shareValueForYear={() => null}
            />
          )}
        </div>
        <div className="mt-[18px] max-w-[740px]"><SourceNote testId="national-source-note">{t("nationalSource", { first, last })}</SourceNote></div>
        <Download testId="life-excel-download" build={() => buildLifeWorkbookExportModel({ facts, sources, siteOrigin }, presentation)} />
      </section>
    </>
  );
}
```
  Checks: (a) `EditorialLineChart` has no `ariaLabel` prop; if it accepts one on `main`, pass the `*ChartAria` messages; otherwise they serve only as table captions, which is what the existing charts do. (b) Render the age curve once in a quick vitest (`renderToStaticMarkup` inside `I18nProvider`) and confirm all seven age labels appear on the axis; if the chart skips labels because it treats positions 1–7 as years, report it rather than changing the chart. (c) If `totalRow` must be non-null or `ExplorerTable` requires props not shown, follow `population-place-explorer.tsx`.

- [ ] **Step 4: The page module.** Create `lib/pages/demography-births-deaths.tsx`:

```tsx
import Link from "next/link";
import { NationalVitalCharts } from "../../components/demography/national-vital-charts";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES, SOURCE_ID } from "../data/demography/series";
import { projectNationalObservation } from "../explorer/clientData";
import { populationHrefById } from "../explorer/demographyPlaceRoutes";
import { BIRTHS_DEATHS_PATH, DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { NATIONAL_SERIES, nationalYears } from "../explorer/demographyNational";
import { buildVitalIndexModel } from "../explorer/demographyVitalIndex";
import { formatInUnit, UNIT_PERSONS } from "../explorer/format";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationBasics, loadPopulationSources } from "./demography-population";

export async function demographyBirthsDeathsPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: BIRTHS_DEATHS_PATH,
    title: `${message(p.messages, "demography.birthsMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.birthsDeathsDescription"),
  });
}

const ANCHOR = "#births-deaths";

export async function renderDemographyBirthsDeathsPage(locale: Locale) {
  // The population basics bring the place list, the municipal registry and a presentation that already loads `municipal` (the map's words).
  const [{ facts: served }, { municipal, presentation, places }, sources] = await Promise.all([
    loadServedDemographyData(),
    loadPopulationBasics(locale),
    loadPopulationSources(locale),
  ]);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const index = buildVitalIndexModel({ facts: served, regions: municipal.regions, municipalities: municipal.municipalities });
  // Only the national series go to the browser (132 rows); the places block is drawn from server-built rows.
  const nationalFacts = served.filter((fact) => NATIONAL_SERIES.includes(fact.seriesId)).map(projectNationalObservation);
  const nationalSources = sources.filter((source) => source.sourceId === SOURCE_ID.fertility || source.sourceId === SOURCE_ID.lifeExpectancy);
  const birthYears = served.filter((fact) => fact.seriesId === SERIES.liveBirths).map((fact) => fact.year);
  const [first, last] = [Math.min(...birthYears), Math.max(...birthYears)];
  const national = nationalYears(nationalFacts);
  // The header's coverage is the births span; the national series must cover the same years or the header would mislead.
  if (national[0] !== first || national.at(-1) !== last) throw new Error(`National series cover ${national[0]}–${national.at(-1)}, births ${first}–${last}`);
  const georgia = index.countsById["country.georgia"]!;
  const hrefById = Object.fromEntries(Object.entries(populationHrefById(places)).map(([id, href]) => [id, `${href}${ANCHOR}`]));
  const title = message(messages, "demography.birthsDeathsTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  const methodology = (
    <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
      {message(messages, "common.methodology")}
    </Link>
  );
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(BIRTHS_DEATHS_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("birthsCoverage", { first, last })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("birthsLead")}</p>
        <MunicipalitiesIndex
          viewBox={index.map.viewBox}
          shapes={index.map.shapes}
          markers={index.map.markers}
          occupiedAreas={index.map.occupiedAreas}
          touchTargets={index.map.touchTargets}
          legendMin={formatInUnit(index.map.legendMinPerResidentGel, UNIT_PERSONS)}
          legendMax={formatInUnit(index.map.legendMaxPerResidentGel, UNIT_PERSONS)}
          municipalities={index.municipalities}
          regions={index.regions}
          country={index.country}
          kpis={[
            { label: t("kpiBirths", { year: index.year }), value: formatInUnit(georgia.births, UNIT_PERSONS), detail: "" },
            { label: t("kpiDeaths", { year: index.year }), value: formatInUnit(georgia.deaths, UNIT_PERSONS), detail: "" },
            { label: t("kpiRatio"), value: formatInUnit(index.country.valueGel, UNIT_PERSONS), detail: t("kpiDetailYear", { year: index.year }) },
            { label: t("kpiDeathsAhead"), value: t("kpiOf", { count: index.deathsAhead, total: index.municipalityCount }), detail: t("kpiDetailYear", { year: index.year }) },
          ]}
          sourceNote={<>{t("birthsSource", { first, last })} {methodology}.</>}
          overrides={{
            hrefById,
            valueFormat: "persons",
            secondaryById: Object.fromEntries(
              Object.entries(index.countsById).map(([id, counts]) => [
                id,
                t("ratioCounts", { births: formatInUnit(counts.births, UNIT_PERSONS), deaths: formatInUnit(counts.deaths, UNIT_PERSONS) }),
              ]),
            ),
            countrySubtitle: message(messages, "municipal.members", { count: index.municipalityCount }),
            unitLabel: t("ratioUnit"),
            mapWording: { groupAria: t("ratioMapAria", { year: index.year }), legendCaption: t("ratioLegend", { year: index.year }) },
            mapNote: <p data-testid="ratio-map-note" className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("ratioMapNote")}</p>,
          }}
        />
        <NationalVitalCharts facts={nationalFacts} sources={nationalSources} siteOrigin={resolveSiteUrl()} />
      </ExplorerPage>
    </I18nProvider>
  );
}
```
  If `MunicipalitiesIndex` renders the map's municipality touch preview with `hrefForCode` (Population index note in DESIGN.md §29), the `hrefById` above already covers it. If `loadPopulationBasics`'s presentation lacks a namespace the page needs (`workbook`, `controls`), add it there (it is the shared loader for all Population pages; adding a namespace does not change their output) and say so in the report.

- [ ] **Step 5: Routes.** Create `app/(ka)/explorer/demography/births-deaths/page.tsx`:

```tsx
import { demographyBirthsDeathsPageMetadata, renderDemographyBirthsDeathsPage } from "../../../../../lib/pages/demography-births-deaths";

export function generateMetadata() {
  return demographyBirthsDeathsPageMetadata("ka");
}

export default function Page() {
  return renderDemographyBirthsDeathsPage("ka");
}
```
  and `app/(en)/en/explorer/demography/births-deaths/page.tsx` with one more `../` in the import and `"en"` in both calls.

- [ ] **Step 6: Live flag and hub card.** In `lib/explorer/demographyRoutes.ts` set the `births-deaths` entry's `live: true`. In `lib/explorer/demographyHubCards.ts`, above the `map`:

```ts
  const births = facts
    .filter((fact) => fact.seriesId === SERIES.liveBirths && fact.geographyId === GEORGIA_PLACE_ID)
    .sort((left, right) => left.year - right.year);
```
  and inside the `map`, next to the migration branch:

```ts
    if (page.id === "births-deaths" && page.live && births.length) {
      const [firstBirths, lastBirths] = [births[0]!, births.at(-1)!];
      return {
        ...card,
        series: births.map((fact) => fact.value),
        seriesColor: INK,
        footer: t("birthsCardFooter", { year: lastBirths.year, births: formatInUnit(lastBirths.value, UNIT_PERSONS), first: firstBirths.year, last: lastBirths.year }),
      };
    }
```
  (Counts have no census break, so no gap is inserted.)

- [ ] **Step 7: Revisions and llms.txt.** In `data/localization/en/page-revisions.json` add `"/explorer/demography/births-deaths": "<today>"` after the migration entry, and set `"/explorer/demography"` to today (the hub card changes). If the file lists Population place routes individually, set them to today too (their page gained a section); if it lists only the index, set the index. In `public/llms.txt` update the Demography line's "published so far" wording to name Population, Migration and Births, deaths and fertility, and add after the Migration line:

```text
- [Births, deaths and fertility](https://fiscal.ge/explorer/demography/births-deaths) — registered live births and deaths for Georgia (2014–2025), its 11 regions and 64 municipalities (2015–2025), with births per 100 deaths; Georgia's total fertility rate, fertility by mother's age and life expectancy at birth. Each Population place page also carries that place's births and deaths. Browse-only: there is no MCP tool and no bulk file for demography.
```
  If `tests/seo/agentFiles.test.ts` pins line order or a link count, update it by the derived amount.

- [ ] **Step 8: Recount every pin.** Run `npx vitest run tests/seo tests/i18n tests/explorer tests/methodology` and `npm run i18n:check`. Expected moves from two new URLs (ka + en): the sitemap count in `tests/seo/routes.test.ts` +2 (and the same two numbers in `tests/browser/seo.spec.ts`), public page identities +1 against Task 0's baseline, `tests/browser/bilingual-complete.spec.ts` path count +1, sidebar coming-soon badges −1, the hub's coming-soon count −1. For each failure, read what the number counts, derive the new value, change it and any comment that explains it; never set a number you did not derive. List every file and number in the report.
- [ ] **Step 9: Run and commit.** The Step 1 files, `tests/seo`, `npm run typecheck`, `npm run lint`: PASS. `git add -A && git commit -m "feat(demography): publish the Births, deaths and fertility page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 8: The methodology page and the eight originals

**Files:**
- Modify: `data/methodology/source-archives/demography.csv`, `lib/methodology/sourceInventory.ts` (demography rule), `lib/methodology/content/demography.ts`, `lib/methodology/content/en/demography.ts`
- Test: `tests/explorer/demographyPages.test.tsx` (`population sources`), `tests/explorer/demographyVitalWorkbook.test.ts`, `tests/methodology/*`

**Interfaces:**
- Produces: `loadPopulationSources(locale)` returns 12 rows (adds the eight below), so the three workbooks cite their originals.

- [ ] **Step 1: Failing tests.** In `tests/explorer/demographyPages.test.tsx` `population sources`: add the eight ids to `REVIEWED_SOURCE_IDS` (sorted) and change the length to `12`. In `tests/explorer/demographyVitalWorkbook.test.ts` add `expect(model.sources).toHaveLength(3);` to the second test. Run both: FAIL.

- [ ] **Step 2: Archive rows.** Append to `data/methodology/source-archives/demography.csv` (keep the BOM on line 1; LF):

```csv
source.geostat_demography_births,demography,2014-2025,საქსტატი,ცოცხლად დაბადებულთა რაოდენობა რეგიონებისა და თვითმმართველი ერთეულების მიხედვით,09-number-of-live-births-by-self-governed-units.xlsx,https://geostat.ge/media/77847/09-number-of-live-births-by-self-governed-units.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/09-number-of-live-births-by-self-governed-units.xlsx,downloads/methodology/demography/files/09-number-of-live-births-by-self-governed-units.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,26206,b8b2b0c352aa1e787925e896773b40aa7181d7b2c83bb05c9a1646c7f798a58d,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Registered live births for Georgia and its regions and self-governed units.
source.geostat_demography_deaths,demography,2014-2025,საქსტატი,გარდაცვლილთა რაოდენობა რეგიონებისა და თვითმმართველი ერთეულების მიხედვით,19-number-of-deaths-by-self-governed-units.xlsx,https://geostat.ge/media/77865/19-number-of-deaths-by-self-governed-units.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/19-number-of-deaths-by-self-governed-units.xlsx,downloads/methodology/demography/files/19-number-of-deaths-by-self-governed-units.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,25857,e3f63ef59c1dc81973d38077b062ddc7d63fb4c77650358f7a5295ebeb911a5f,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Registered deaths for Georgia and its regions and self-governed units.
source.geostat_demography_natural_increase,demography,2014-2025,საქსტატი,ბუნებრივი მატება რეგიონებისა და თვითმმართველი ერთეულების მიხედვით,29-Natural-increase-by-regions-and-self-governed-units.xlsx,https://geostat.ge/media/77876/29-Natural-increase-by-regions-and-self-governed-units.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/29-Natural-increase-by-regions-and-self-governed-units.xlsx,downloads/methodology/demography/files/29-Natural-increase-by-regions-and-self-governed-units.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,26528,db4c2d808f17936de45cf5b8be6eb2f7c267c9b09ce7a182f873c3fd4591417e,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Published natural increase; births minus deaths equal it in every row.
source.geostat_demography_fertility,demography,2014-2025,საქსტატი,შობადობის ასაკობრივი და ჯამობრივი კოეფიციენტები,16-age-specific-fertility-rates-and-total-fertility-rate.xlsx,https://geostat.ge/media/78374/16-age-specific-fertility-rates-and-total-fertility-rate.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/16-age-specific-fertility-rates-and-total-fertility-rate.xlsx,downloads/methodology/demography/files/16-age-specific-fertility-rates-and-total-fertility-rate.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,12201,86bf7dc84062e4356cd62626dcda9bbf0e9bb56a74e063e08b1dfa04413a75aa,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Age-specific fertility rates per 1000 women and the total fertility rate for Georgia; population-based so the census re-base applies.
source.geostat_demography_life_expectancy,demography,2014-2025,საქსტატი,სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას სქესის მიხედვით,28-life-expectancy-at-births-by-sex.xlsx,https://geostat.ge/media/78384/28-life-expectancy-at-births-by-sex.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/28-life-expectancy-at-births-by-sex.xlsx,downloads/methodology/demography/files/28-life-expectancy-at-births-by-sex.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,11040,fc679c041fe6190848056081977afa8d0e17db103667176a5c02e918d70fb6d6,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Life expectancy at birth for Georgia by sex; population-based so the census re-base applies.
source.geostat_demography_crude_birth_rate,demography,2014-2025,საქსტატი,შობადობის ზოგადი კოეფიციენტი,15-crude-birth-rate.xlsx,https://geostat.ge/media/78372/15-crude-birth-rate.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/15-crude-birth-rate.xlsx,downloads/methodology/demography/files/15-crude-birth-rate.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,10365,9a22452c6363f3b55f43487811fbf9169e6d94b01432a0f8ad393f39d63c55db,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Crude birth rate for Georgia; mirrored with the vital-events file and not shown on a page.
source.geostat_demography_crude_death_rate,demography,2014-2025,საქსტატი,მოკვდაობის ზოგადი კოეფიციენტი,24-crude-death-rate.xlsx,https://geostat.ge/media/78381/24-crude-death-rate.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/24-crude-death-rate.xlsx,downloads/methodology/demography/files/24-crude-death-rate.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,10249,76c2f5d4a152d7e0241c0a7582efbc59c7b2a12d41243fee1a5fed9e3cfce07e,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Crude death rate for Georgia; mirrored with the vital-events file and not shown on a page.
source.geostat_demography_infant_mortality,demography,2014-2025,საქსტატი,ჩვილ ბავშვთა მოკვდაობის კოეფიციენტი სქესის მიხედვით,25-infant-mortality-rate-by-sex.xlsx,https://geostat.ge/media/77870/25-infant-mortality-rate-by-sex.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/25-infant-mortality-rate-by-sex.xlsx,downloads/methodology/demography/files/25-infant-mortality-rate-by-sex.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,11517,ca9e127b04eeef4be4af0038ffc4605ed11fddddb14b38f7b432e5a6753160d1,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Infant mortality rate for Georgia; mirrored with the vital-events file and not shown on a page.
```
  Byte sizes and SHA-256 were measured from the archived files on 2026-10-09; `validateSourceManifest` re-checks them. The Georgian titles are drafts for the owner. Check each `source_id` against the `source_id` column of `data/imports/demography-vital-annual.csv` and `demography-fertility-age-annual.csv` (they match `SOURCE_ID` in `series.ts`).

- [ ] **Step 3: Inventory rule.** In `lib/methodology/sourceInventory.ts`, extend the demography `official` list:

```ts
["03-density-by-regions.xlsx", "09-number-of-live-births-by-self-governed-units.xlsx", "15-crude-birth-rate.xlsx", "16-age-specific-fertility-rates-and-total-fertility-rate.xlsx", "19-number-of-deaths-by-self-governed-units.xlsx", "24-crude-death-rate.xlsx", "25-infant-mortality-rate-by-sex.xlsx", "28-life-expectancy-at-births-by-sex.xlsx", "29-Natural-increase-by-regions-and-self-governed-units.xlsx", "31-net-migration.xlsx", "33-number-of-immigrants-and-emigrants-by-sex-and-citizenship.xlsx"]
```

- [ ] **Step 4: Methodology text.** Every number must be identical in the two languages (separators ignored). In `lib/methodology/content/en/demography.ts`:
  - `summary`: `"Population on 1 January for Georgia, its 11 regions and 64 municipalities, 2004–2026, density by region, international migration by citizenship, 2012–2025, and registered births and deaths, 2014–2025, with Georgia’s fertility and life expectancy."`
  - `reviewedAt`: today.
  - `disclosure`: append `" For births and deaths Fiscal.ge computes births per 100 deaths and the count of municipalities where deaths exceeded births."`
  - keyFacts `Unit`: `"persons / persons per km² / persons per year / children per woman / years"`.
  - `scope`: append `" Births, deaths and natural increase cover Georgia from 2014 and the regions and municipalities from 2015, to 2025. The total fertility rate, fertility by mother’s age and life expectancy at birth cover Georgia only, 2014–2025."`
  - `sources`: add `"Births and deaths: Geostat, live births, deaths and natural increase by region and self-governed unit, and, for Georgia, age-specific and total fertility rates and life expectancy at birth by sex. Events are counted when registered in the reference year; Georgian citizens registered abroad are included. From 2014 Geostat publishes registered data rather than retro-projections. The crude birth and death rates and the infant mortality rate come in the same release and are kept in the archive but not shown."`
  - `validation`: add `"Births minus deaths equal the published natural increase for every place and year, the 11 regions and the 64 municipalities each add up to Georgia, and five times the sum of the seven age-specific rates, per 1,000 women, equals the total fertility rate to within 0.005."`
  - `limitations` last paragraph: `"Migration counts and the counts of births and deaths do not change at the census re-base; the fertility rates and life expectancy use the population and do. Citizenship is not country of birth or of residence, and the pages state no causes. Projections and the age-and-sex structure are not yet published."`
  - `archive`: `"Twelve untouched Geostat Excel files: population on 1 January by region and self-governed unit, density by region, immigrants and emigrants by sex and citizenship, net migration, live births, deaths and natural increase by self-governed unit, fertility rates, life expectancy at birth by sex, and the crude birth, crude death and infant mortality rates."`

  In `lib/methodology/content/demography.ts` the same in Georgian (drafts for the owner):
  - `summary`: `"საქართველოს, მისი 11 რეგიონისა და 64 მუნიციპალიტეტის მოსახლეობა 1 იანვრის მდგომარეობით, 2004–2026, სიმჭიდროვე რეგიონების მიხედვით, საერთაშორისო მიგრაცია მოქალაქეობის მიხედვით, 2012–2025, და რეგისტრირებული დაბადებები და გარდაცვალებები, 2014–2025, საქართველოს ნაყოფიერებითა და სიცოცხლის ხანგრძლივობით."`
  - `disclosure`: append `" დაბადებებისა და გარდაცვალებებისთვის Fiscal.ge ითვლის დაბადებათა რიცხვს 100 გარდაცვალებაზე და იმ მუნიციპალიტეტების რაოდენობას, სადაც გარდაცვალება დაბადებას აღემატებოდა."`
  - keyFacts `ერთეული`: `"ადამიანი / ადამიანი კმ²-ზე / ადამიანი წელიწადში / ბავშვი ერთ ქალზე / წელი"`.
  - `scope`: append `" დაბადებები, გარდაცვალებები და ბუნებრივი მატება საქართველოსთვის 2014 წლიდან, რეგიონებისა და მუნიციპალიტეტებისთვის 2015 წლიდან 2025 წლამდეა. შობადობის ჯამობრივი კოეფიციენტი, ნაყოფიერება დედის ასაკის მიხედვით და სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას მხოლოდ საქართველოს მოიცავს, 2014–2025."`
  - `sources`: add `"დაბადებები და გარდაცვალებები: საქსტატი, ცოცხლად დაბადებულები, გარდაცვლილები და ბუნებრივი მატება რეგიონებისა და თვითმმართველი ერთეულების მიხედვით, ხოლო საქართველოსთვის — შობადობის ასაკობრივი და ჯამობრივი კოეფიციენტები და სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას სქესის მიხედვით. მოვლენები საანგარიშო წელს რეგისტრაციის მიხედვით აღირიცხება; საზღვარგარეთ რეგისტრირებული საქართველოს მოქალაქეები გათვალისწინებულია. 2014 წლიდან საქსტატი რეტროსპექტული შეფასების ნაცვლად რეგისტრირებულ მონაცემებს აქვეყნებს. შობადობისა და მოკვდაობის ზოგადი კოეფიციენტები და ჩვილ ბავშვთა მოკვდაობის კოეფიციენტი იმავე გამოცემიდანაა, არქივში ინახება, მაგრამ გვერდზე არ ჩანს."`
  - `validation`: add `"დაბადებებს გამოკლებული გარდაცვალებები ყველა ადგილისა და წლისთვის გამოქვეყნებულ ბუნებრივ მატებას უდრის, 11 რეგიონისა და 64 მუნიციპალიტეტის ჯამი ცალ-ცალკე საქართველოს უდრის, ხოლო შვიდი ასაკობრივი კოეფიციენტის (1,000 ქალზე) ჯამის ხუთმაგი შობადობის ჯამობრივ კოეფიციენტს 0.005-ის სიზუსტით უდრის."`
  - `limitations` last paragraph: `"მიგრაციისა და დაბადება-გარდაცვალების რიცხვები აღწერით გადათვლისას არ იცვლება; ნაყოფიერების კოეფიციენტები და სიცოცხლის ხანგრძლივობა მოსახლეობას ეფუძნება და იცვლება. მოქალაქეობა არ არის დაბადების ან საცხოვრებელი ქვეყანა და გვერდები მიზეზებს არ ასახელებს. პროგნოზი და ასაკობრივ-სქესობრივი სტრუქტურა ჯერ არ ქვეყნდება."`
  - `archive`: `"საქსტატის თორმეტი უცვლელი Excel ფაილი: მოსახლეობა 1 იანვრის მდგომარეობით რეგიონებისა და თვითმმართველი ერთეულების მიხედვით, სიმჭიდროვე რეგიონების მიხედვით, იმიგრანტები და ემიგრანტები სქესისა და მოქალაქეობის მიხედვით, მიგრაციის სალდო, ცოცხლად დაბადებულები, გარდაცვლილები და ბუნებრივი მატება თვითმმართველი ერთეულების მიხედვით, შობადობის კოეფიციენტები, სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას სქესის მიხედვით და შობადობის, მოკვდაობისა და ჩვილ ბავშვთა მოკვდაობის კოეფიციენტები."`
  If `validateMethodologyTranslation` reports a number mismatch, the texts differ in a number: fix the text, not the validator. (Watch "1,000" / "0.005" / "11" / "64" / "2014" / "2015" / "2025".)

- [ ] **Step 5: Run.** `npx vitest run tests/methodology tests/explorer/demographyPages.test.tsx tests/explorer/demographyVitalWorkbook.test.ts tests/explorer/demographyNational.test.ts` and `npm run data:validate`: PASS. The Population and Migration workbooks must still cite only their own originals (they filter by source id). If a methodology test pins the demography archive count (4), update it to 12 and report it.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "docs(demography): births, deaths, fertility and life expectancy in the methodology page and archive" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 9: Browser tests

**Files:**
- Create: `tests/browser/demography-births-deaths.spec.ts`
- Modify: `tests/browser/main-explorer.spec.ts` (payload-guard route list), `tests/browser/methodology.spec.ts` (coming-soon badges), `tests/browser/pristine-urls.spec.ts`, `tests/browser/demography-population.spec.ts` (hub test), and `seo.spec.ts` / `bilingual-complete.spec.ts` if Task 7 did not already

- [ ] **Step 1: Pins.** Add `"/explorer/demography/births-deaths"` to the payload-guard list in `tests/browser/main-explorer.spec.ts` (after the population place routes). Add the URL to `pristine-urls.spec.ts` the way the migration URL is listed. In `methodology.spec.ts` and `demography-population.spec.ts` change the coming-soon counts by −1 (derive them; Age and sex stays coming soon).

- [ ] **Step 2: The spec.** Create `tests/browser/demography-births-deaths.spec.ts`, following the helpers and imports at the top of `tests/browser/demography-migration.spec.ts` (`TEST_BASE_URL`, `expectAppReady`, the horizontal-overflow helper, the download helper):

```ts
// Imports and helpers: copy from demography-migration.spec.ts.

test.describe("births and deaths on a place page", () => {
  for (const [path, lead] of [
    ["/en/explorer/demography/population/georgia", "Births and deaths registered in Georgia, 2014–2025."],
    ["/en/explorer/demography/population/region/imereti", "Births and deaths registered in Imereti, 2015–2025."],
    ["/en/explorer/demography/population/batumi", "Births and deaths registered in Batumi, 2015–2025."],
  ] as const) {
    test(`${path} ends with its section`, async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}${path}`);
      await expectAppReady(page);
      const section = page.getByTestId("vital-section");
      await expect(section).toContainText(lead);
      await section.getByTestId("vital-mode-table").click();
      await expect(section.getByRole("table")).toContainText("Natural increase");
    });
  }

  test("the section downloads its workbook", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en/explorer/demography/population/batumi`);
    await expectAppReady(page);
    const download = await Promise.all([page.waitForEvent("download"), page.getByTestId("vital-excel-download").click()]).then(([d]) => d);
    expect(download.suggestedFilename()).toMatch(/demography-births-deaths-batumi-2015-2025/);
  });
});

test.describe("births, deaths and fertility page", () => {
  test("lists places, opens a place at its section, and shows fertility and life expectancy", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/en/explorer/demography/births-deaths`);
    await expectAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Births, deaths and fertility");
    await expect(page.getByText("53 of 64")).toBeVisible();
    await expect(page.getByTestId("fertility-section")).toContainText("Census re-base");
    await expect(page.getByTestId("asfr-legend")).toContainText("2014");
    await expect(page.getByTestId("life-section")).toBeVisible();
    await page.locator('a[href="/en/explorer/demography/population/batumi#births-deaths"]').first().click();
    await expect(page).toHaveURL(/\/population\/batumi#births-deaths$/);
    await expect(page.getByTestId("vital-section")).toBeInViewport();
  });

  test("Georgian page renders", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/demography/births-deaths`);
    await expectAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("შობადობა და სიკვდილიანობა");
  });

  for (const path of ["/en/explorer/demography/births-deaths", "/explorer/demography/population/batumi"]) {
    test(`${path} has no sideways scroll at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${TEST_BASE_URL}${path}`);
      await expectAppReady(page);
      // Use the overflow assertion demography-migration.spec.ts uses.
    });
  }
});
```
  Replace the comment in the last test with the overflow assertion from the Migration spec. If the batumi link is inside a list that only renders the active tab, click the Municipalities tab first.

- [ ] **Step 3: Run on a production build.** Kill any server on :3100, then from `apps/web`:

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100
```
  (run the server in the background) and

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/demography-births-deaths.spec.ts tests/browser/demography-population.spec.ts tests/browser/demography-migration.spec.ts tests/browser/methodology.spec.ts tests/browser/pristine-urls.spec.ts tests/browser/main-explorer.spec.ts tests/browser/seo.spec.ts tests/browser/bilingual-complete.spec.ts
```
  PASS. Take one screenshot each of `/en/explorer/demography/population/georgia#births-deaths` and `/en/explorer/demography/births-deaths` at 1440px and 390px (`npx playwright screenshot --channel msedge --viewport-size 1440,900 URL file.png` into the scratchpad) and check by eye: the column chart's axis labels for Georgia (tens of thousands) are not clipped, the seven age labels show under the fertility curve, the two coloured years stand out. Report what you saw; fix only clipping caused by this plan's code (not by shared charts — report those).
- [ ] **Step 4: Commit.** Stop the server. `git add -A && git commit -m "test(demography): browser checks for births and deaths" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 10: Documents and the completion gates

**Files:**
- Modify: `DESIGN.md` (Population section §29 and §4.2 tokens), `Project_Definition.md` section 2, `docs/data-methodology/demography.md`, `docs/data-methodology/database-import.md` (row counts), `docs/deployment.md` ("Demography release checks")

- [ ] **Step 1: DESIGN.md.** In §4.2 add the four tokens (`vital.births #1F6E56`, `vital.deaths #8C5A32`, `sex.male #3D5A98`, `sex.female #C26E4C`) in the format of the citizenship rows Migration added. In the Population section (§29 on main after Trade; find it by heading) add a short subsection "Births and deaths section" (anchor `#births-deaths`, after the key figures, one place only, columns up/down with natural increase, chart/table switch, no range strip, no break marker, its own Excel, link to the national page) and a subsection or new section for the national page (places block = Population index with births per 100 deaths, then Fertility with the first/last-year curve and Life expectancy with three lines; one scrolling page, no tabs, no hash state). Keep it to what the spec says.
- [ ] **Step 2: Project_Definition.md.** In section 2's Demography entry, list the Births, deaths and fertility page and the place-page section as live, Age and sex as the one remaining coming-soon page.
- [ ] **Step 3: Data docs.** `docs/data-methodology/demography.md`: in the serving/inventory part, the vital-events and fertility files are served whole (2,679 rows; infant mortality and crude rates mirrored, not shown) with basis `registered`; the eight originals. `docs/data-methodology/database-import.md`: DemographyFact `2,846 → 5,525` wherever the count is stated (log line `csv=5525 db=5525`). `docs/deployment.md` "Demography release checks": add `/explorer/demography/births-deaths` (ka and en) and one place page's `#births-deaths` section (for example Imereti shows 4,275 births and 7,197 deaths for 2025).
- [ ] **Step 4: Gates, once.** From `apps/web`: `npm run check` (lint, typecheck, unit tests, `data:validate`, `i18n:check`) and `npm run build`: both exit 0. Then the whole browser suite on a production build, as `CLAUDE.md` describes (build with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, `next start --port 3100`, `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`): all pass. A failing download or request spec under load is re-run alone first (known flake); report both runs.
- [ ] **Step 5: Commit and report.** `git add -A && git commit -m "docs(demography): design, scope, methodology and release checks for births and deaths" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Report: the gate results with counts, every pin moved (file, old → new), and the full list of new Georgian strings (key → text) for the owner's review.
