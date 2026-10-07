# Demography Population: Index and One Page per Place — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-page Population workspace (a button row, a map that selects, a places list) with the Budget → Municipalities layout: an index (map, key figures, ranked list) and one page per place (Georgia, 11 regions, 63 municipalities), in Georgian and English.

**Architecture:** Everything under the page stays from the first build (data, serving, chart `breaks`, table `breakYears`, range marker, workbook, methodology, hub, sidebar). The index is the existing `MunicipalitiesIndex` given a plain-data `overrides` object. A place page is a new body, `PopulationPlaceExplorer`, inside the Budget place-page shell (`EntityHeading` and `EntityWorkspaceShell`, moved out of `MunicipalExplorer` unchanged), with the existing `useMunicipalState` for URL state. Routes mirror `/explorer/municipalities`. The first build's map choosing mode, region-map additions and state machinery are removed first so nothing dead remains.

**Tech Stack:** Next.js 16 static prerender, React 19, strict TypeScript, Tailwind v4, vitest (`renderToStaticMarkup`), Playwright, exceljs.

**Spec:** `docs/superpowers/specs/2026-10-04-demography-population-design.md` (revised 2026-10-07) and `docs/superpowers/specs/2026-10-04-demography-section-design.md` §2.4, §3.1, §6. Read both before any task. This plan supersedes Tasks 6–9 and 12–16 of `2026-10-04-demography-population.md` where they describe the page; the data, serving, chart, workbook and methodology tasks of that plan are done and stay.

## Global Constraints

- Do not push, open a pull request or merge to `main`. All work is local commits on `claude/demographic-data-viz-b0dd86`. Task 10 merges `main` into the branch, which is the only merge.
- Reuse First (`AGENTS.md`): use an existing component as it is; if it almost fits, make a small additive change whose default leaves current output and tests unchanged; never copy or write a sibling. Duplicating existing code is a defect. Name the existing component considered if you add a new file.
- Georgian is the canonical language; English pages carry no Georgian in visible text, attributes, metadata or JSON-LD. Data handed to client components may carry Georgian place names.
- No growth, change or rate figure is computed or shown across the 1 January 2025 census re-base. The label is `აღწერით გადათვლა` / "Census re-base". The chart, table and range strip never join 2024 to 2025.
- URL state follows DESIGN.md §6.3: restored after load, loading never writes the URL, every change replaces the history entry.
- No Dataset JSON-LD and no download links on any demography page; `BreadcrumbList` JSON-LD only.
- Routes: `/explorer/demography/population` (index), `/georgia`, `/region/{id}`, `/{slug}`; Tbilisi is the region page only; the set is closed (`dynamicParams = false`); `/en` mirrors every path.
- A server component cannot pass functions to a client component: the overrides given to `MunicipalitiesIndex`, `EntityPicker` and `EntityHeading` are plain data (strings, records, flags, React nodes).
- Windows traps (run in `apps/web`): paths are long (260-character limit); plain `npx vitest run` skips `pretest`, so build the git-ignored snapshot first with `npm run data:prepare-fact-query-snapshot`; `next dev` rewrites the tracked `apps/web/AGENTS.md`, so verify UI with a production build and `next start` and kill any server on :3100 before rebuilding. While editing run only the task's tests; the full gates run once, in Task 10.
- Georgian copy you write is a draft for owner review: list every new or changed Georgian string in your report.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Reuse inventory

| Need | Existing piece | Change |
| --- | --- | --- |
| Index layout, tabs, list, KPI grid, map + list hover link | `MunicipalitiesIndex` | optional `overrides` (plain data), `sourceNote: ReactNode` |
| Place picker | `EntityPicker` | optional `overrides` (plain data) |
| Place heading, previous/next, ⌘K | the heading block of `MunicipalExplorer` | pure move to `EntityHeading` |
| Two-column workspace shell | the shell of `MunicipalExplorer` | pure move to `EntityWorkspaceShell` |
| Region's municipality rows | inline JSX in `municipal-region.tsx` | pure move to `EntityMemberList` |
| Map | `MunicipalityMap` | keeps `display` and `wording`; `selectedCodes` removed |
| Chart, table, range, tick-list, Excel, KPI blocks | `EditorialLineChart` (`breaks`), `ExplorerTable` (`breakYears`), `RangeStrip` (marker), `SeriesSelector`, `ExcelDownloadButton`, `HeroKpi`, `SideKpiList` | none |
| URL state | `useMunicipalState` | none |
| Addresses | `MUNICIPALITY_ROUTES` | none |
| New | `demographyPlaceRoutes.ts`, `demographyPopulationIndex.ts`, `demographyPopulationKpis.ts`, `PopulationPlaceExplorer`, `demography-population-place.tsx`, 6 route files | the Budget place body is built around spending functions and period change, so it cannot be extended; Regional economies and Unemployment built their own bodies from the same parts |

## File map

Create: `apps/web/lib/explorer/demographyPlaceRoutes.ts`, `demographyPopulationIndex.ts`, `demographyPopulationKpis.ts`; `apps/web/components/demography/population-place-explorer.tsx`; `apps/web/components/municipalities/entity-heading.tsx`, `entity-workspace-shell.tsx`, `entity-member-list.tsx`; `apps/web/lib/pages/demography-population-place.tsx`; six route files under `apps/web/app/(ka)/explorer/demography/population/` and `apps/web/app/(en)/en/explorer/demography/population/`.

Modify: `components/municipalities/{municipalities-index,entity-picker,municipal-explorer,municipality-map}.tsx`, `lib/pages/municipal-region.tsx`, `lib/explorer/{demographyAreas,demographyPopulation,demographyPopulationMaps,demographyPopulationWorkbook}.ts`, `components/demography/population-highlights.tsx`, `lib/pages/demography-population.tsx`, `lib/i18n/messages/{ka,en}/demography.json`, `lib/seo/sitemap.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json`, tests listed per task, docs in Task 9.

Delete: `components/demography/{population-explorer,population-series-panel,use-population-state}.tsx|ts`, `tests/explorer/{populationExplorer,regionValueMap}.test.tsx`, `tests/browser/demography-population.spec.ts` (rewritten in Task 8). Restore to merge-base `a89c5eca`: `components/regional-economies/regional-economy-map.tsx`, `lib/explorer/regionalEconomyMap.ts`.

All paths below are relative to `apps/web` unless they start with `docs/`, `data/` or `.superpowers/`.

---

### Task 1: Retire the one-page build and reshape the population model

**Files:**
- Delete: the six files listed above (`git rm`).
- Restore: `components/regional-economies/regional-economy-map.tsx`, `lib/explorer/regionalEconomyMap.ts` (`git checkout a89c5eca --`).
- Modify: `components/municipalities/municipality-map.tsx`, `lib/explorer/demographyAreas.ts`, `demographyPopulation.ts`, `demographyPopulationMaps.ts`, `demographyPopulationWorkbook.ts`, `lib/pages/demography-population.tsx`, `lib/i18n/messages/{ka,en}/demography.json`.
- Test: `tests/explorer/demographyPopulation.test.ts`, `demographyPopulationMaps.test.ts`, `demographyPopulationWorkbook.test.ts`, `municipalityValueMap.test.tsx`, `demographyPages.test.tsx`.

**Interfaces:**
- Produces (used by Tasks 3–6):
  - `type PopulationQuery = { selectedIds: readonly string[]; range: PeriodRange }`
  - `buildPopulationModel({ facts, places, query, locale })` → `{ range, years, availableYears, ranked, selected, rows, series, endValues, valueAt, hasData }` (no `listed`, no `firstSelected`)
  - `buildPopulationHighlights(model, facts, places, placeId): PopulationHighlights | null`
  - `partsOf(place, places): DemographyPlace[]` (Georgia → its regions, a region → its municipalities, a municipality or Tbilisi → none)
  - `buildPopulationMunicipalityMap({ facts, municipalities }): { year: number; model: MunicipalityMapModel; values: ReadonlyMap<string, number> }`
  - `buildPopulationWorkbookExportModel(facts, places, query, presentation, sources, siteOrigin, scope?)`
- Removes: `PopulationState`, `PopulationLevel`, `PopulationMapMeasure`, `DEFAULT_POPULATION_STATE`, `parsePopulationHash`, `serializePopulationHash`, `chooseOnMap`, `chooseGeorgia`, `changeLevel`, `changeMeasure`, `toggleSelected`, `setTabSelection`, `placesAtLevel`, `buildPopulationMapModels`.

- [ ] **Step 1: Baseline.** Run, from `apps/web`:

```bash
npm run data:prepare-fact-query-snapshot
npx vitest run tests/explorer/demographyPopulation.test.ts tests/explorer/demographyPopulationMaps.test.ts tests/explorer/demographyPopulationWorkbook.test.ts tests/explorer/municipalityValueMap.test.tsx tests/explorer/demographyPages.test.tsx
```
Expected: all pass. This is the state you are changing from.

- [ ] **Step 2: Delete and restore.**

```bash
git rm components/demography/population-explorer.tsx components/demography/population-series-panel.tsx components/demography/use-population-state.ts tests/explorer/populationExplorer.test.tsx tests/explorer/regionValueMap.test.tsx tests/browser/demography-population.spec.ts
git checkout a89c5eca -- components/regional-economies/regional-economy-map.tsx lib/explorer/regionalEconomyMap.ts
git diff a89c5eca --stat -- components/regional-economies lib/explorer/regionalEconomyMap.ts
```
Expected: the last command prints nothing. Keep `rankByEndValue` in `lib/explorer/regionalEconomies.ts` (the shared ranker `rankPlaces` uses) and keep `parseYearRangeKeys`/`writeYearRangeKeys` in `urlState.ts` (the regional, GDP and sector explorers use them).

- [ ] **Step 3: Trim the municipality map to what Population still needs.** In `components/municipalities/municipality-map.tsx` the branch's diff against `a89c5eca` must end up containing only the `display` and `wording` additions. Remove, and nothing else: the `selectedCodes` prop and its comment; `const choosing` and `const chosen` (and the `useMemo` import if nothing else uses it); the `role={choosing ? "button" : "link"}` and `aria-pressed={choosing ? ... : undefined}` lines on both the polygons and the city markers (each goes back to `role="link"` with no `aria-pressed`); on the city marker, `r={active || chosen.has(marker.code) ? 9.5 : 7.5}` goes back to `r={active ? 9.5 : 7.5}`, `stroke={chosen.has(marker.code) ? "var(--ink)" : "var(--tile)"}` to `stroke="var(--tile)"` and `strokeWidth={chosen.has(marker.code) ? 2.4 : active ? 2.2 : 1.2}` to `strokeWidth={active ? 2.2 : 1.2}`; and the whole `{choosing ? shapes.filter(...).map(<use data-testid={`municipality-chosen-...`} .../>) : null}` block. Check with `git diff a89c5eca -- components/municipalities/municipality-map.tsx`: only `wording`, `display` (accessible name, interaction target, tooltip variant) and the legend caption remain.

- [ ] **Step 4: Replace the map test.** In `tests/explorer/municipalityValueMap.test.tsx` replace the whole `describe("MunicipalityMap choosing mode", ...)` block with:

```tsx
describe("MunicipalityMap population wording", () => {
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

  test("keeps all 64 targets links and uses the page's wording", () => {
    const html = render({ wording: { groupAria: "Population map", legendCaption: "persons, 1 January 2026" } });
    expect(count(html, /data-municipality-map-target=""/g)).toBe(64);
    expect(count(html, /role="link"/g)).toBe(64);
    expect(count(html, /role="button"/g)).toBe(0);
    expect(count(html, /aria-pressed/g)).toBe(0);
    expect(count(html, /municipality-chosen-/g)).toBe(0);
    expect(html).toContain('aria-label="Population map"');
    expect(html).toContain("persons, 1 January 2026");
    expect(html).toContain("Khulo, 16098 persons");
    expect(html).not.toContain("per resident");
  });

  test("without the new props it is the budget map's wording", () => {
    const html = render({}, false);
    expect(count(html, /role="link"/g)).toBe(64);
    expect(html).toContain("per resident");
  });
});
```
Run `npx vitest run tests/explorer/municipalityValueMap.test.tsx` and expect PASS. (If the last assertion's budget text differs, read the English `municipal.perResident` message and use its real text.)

- [ ] **Step 5: Areas.** In `lib/explorer/demographyAreas.ts` delete `placesAtLevel` and add:

```ts
/** What a place is made of, for the tick-list: Georgia has its regions, a region its municipalities, a municipality nothing. Tbilisi is a region whose one municipality is itself, so it has none. */
export function partsOf(place: DemographyPlace, places: readonly DemographyPlace[]): DemographyPlace[] {
  if (place.level === "country") return places.filter((candidate) => candidate.level === "region");
  if (place.level === "region") {
    return places.filter((candidate) => candidate.level === "municipality" && candidate.regionId === place.id);
  }
  return [];
}
```

- [ ] **Step 6: Model.** Replace `lib/explorer/demographyPopulation.ts` with the file below (the second half, from `PopulationHighlights` to the end, is unchanged except the first lines of `buildPopulationHighlights`; keep it as it is in the repository and change only what is marked).

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
  type DemographyPlace,
} from "./demographyAreas";
import { resolveRange, type PeriodRange } from "./periodRange";
import { rankByEndValue } from "./regionalEconomies";

/** What a place page asks the model for: the places drawn and the period. */
export type PopulationQuery = {
  /** Place ids; Tbilisi is `region.tbilisi`. */
  selectedIds: readonly string[];
  range: PeriodRange;
};

/** Georgia first, then by the value at the end of the range (descending, missing last), ties by registry order. */
export function rankPlaces(
  places: readonly DemographyPlace[],
  endValues: Readonly<Record<string, number | null>>,
): DemographyPlace[] {
  return rankByEndValue(places, endValues, GEORGIA_PLACE_ID);
}

export function buildPopulationModel({
  facts,
  places,
  query,
  locale,
}: {
  facts: readonly ClientDemographyObservation[];
  places: readonly DemographyPlace[];
  query: PopulationQuery;
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
    ...resolveRange(query.range, { min: availableYears[0]!, max: availableYears.at(-1)! }),
  };
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const valueAt = (id: string, year: number): number | null => byCell.get(`${id}:${year}`) ?? null;
  const endValues = Object.fromEntries(places.map((place) => [place.id, valueAt(place.id, range.end)]));
  const ranked = rankPlaces(places, endValues);
  const selected = ranked.filter((place) => query.selectedIds.includes(place.id));
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
    selected,
    rows,
    series,
    endValues,
    valueAt,
    hasData: selected.some((place) => years.some((year) => valueAt(place.id, year) !== null)),
  };
}

export type PopulationModel = ReturnType<typeof buildPopulationModel>;
```
After `PopulationModel` keep, unchanged: `populationBasisKey`, `sparkValues`, the `Figure` and `HighlightBase` types, `PopulationHighlights`, `extreme`, `rankOf`, `fraction`. Change `buildPopulationHighlights` to take the place explicitly:

```ts
/**
 * The highlights describe one place, for the end year of the range. Nothing here is a change over time,
 * so nothing spans the census re-base (foundation section 5, R4).
 */
export function buildPopulationHighlights(
  model: PopulationModel,
  facts: readonly ClientDemographyObservation[],
  places: readonly DemographyPlace[],
  placeId: string,
): PopulationHighlights | null {
  const place = places.find((candidate) => candidate.id === placeId);
  if (!place) return null;
  const { years, valueAt } = model;
  // ...the rest of the function is unchanged
```
(delete the old `const place = model.firstSelected; if (!place) return null;` lines). The `PopulationState` type, the level and measure types, `DEFAULT_POPULATION_STATE`, `parsePopulationHash`, `serializePopulationHash`, `chooseOnMap`, `chooseGeorgia`, `changeLevel`, `changeMeasure`, `toggleSelected`, `setTabSelection` and the `parseYearRangeKeys`/`writeYearRangeKeys` import are gone.

- [ ] **Step 7: Map builder.** Replace `lib/explorer/demographyPopulationMaps.ts` with:

```ts
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { Municipality } from "../data/municipal/types";
import { formatInUnit, UNIT_PERSONS } from "./format";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";

const isMunicipality = (id: string) => /^\d{2}$/.test(id);

/**
 * The municipality map for the latest year the municipalities have a population for. The number goes in the
 * model's existing numeric field and `display` is the text the map prints for each place.
 */
export function buildPopulationMunicipalityMap({
  facts,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  municipalities: Municipality[];
}): { year: number; model: MunicipalityMapModel; values: ReadonlyMap<string, number> } {
  const rows = facts.filter((fact) => fact.seriesId === SERIES.populationTotal && isMunicipality(fact.geographyId));
  if (rows.length === 0) throw new Error("No population values for the map");
  const year = Math.max(...rows.map((fact) => fact.year));
  const values = new Map(rows.filter((fact) => fact.year === year).map((fact) => [fact.geographyId, fact.value]));
  return {
    year,
    values,
    model: buildMunicipalityValueMapModel({
      municipalities,
      values,
      display: (_code, value) => formatInUnit(value, UNIT_PERSONS),
    }),
  };
}
```
Replace `tests/explorer/demographyPopulationMaps.test.ts` with:

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { Municipality } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationMunicipalityMap } from "../../lib/explorer/demographyPopulationMaps";

let facts: ServedDemographyObservation[];
let municipalities: Municipality[];

beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  municipalities = municipal.municipalities;
});

describe("population municipality map", () => {
  test("shows the latest loaded year with 60 shapes and 5 city markers, Tbilisi once", () => {
    const { year, model, values } = buildPopulationMunicipalityMap({ facts, municipalities });
    expect(year).toBe(2026);
    expect(values.size).toBe(64);
    expect(model.shapes).toHaveLength(60);
    expect(model.markers).toHaveLength(5);
    expect(model.markers.find((marker) => marker.code === "04")).toMatchObject({ budgetPerResidentGel: 1_369_356, display: "1,369,356" });
    expect(model.shapes.find((shape) => shape.code === "11")).toMatchObject({ budgetPerResidentGel: 16_098, display: "16,098" });
  });

  test("follows the newest year the municipalities have", () => {
    const withoutNewest = facts.filter((fact) => !(/^\d{2}$/.test(fact.geographyId) && fact.year === 2026));
    expect(buildPopulationMunicipalityMap({ facts: withoutNewest, municipalities }).year).toBe(2025);
  });

  test("refuses a map with a municipality missing", () => {
    const without = facts.filter((fact) => !(fact.geographyId === "33" && fact.year === 2026));
    expect(() => buildPopulationMunicipalityMap({ facts: without, municipalities })).toThrow(/Missing map value for municipality 33/);
  });
});
```

- [ ] **Step 8: Workbook.** In `lib/explorer/demographyPopulationWorkbook.ts` change the signature and the model call, and add the optional scope to the file name:

```ts
import { buildPopulationModel, populationBasisKey, type PopulationQuery } from "./demographyPopulation";
// ...
export function buildPopulationWorkbookExportModel(
  facts: readonly ClientDemographyObservation[],
  places: readonly DemographyPlace[],
  query: PopulationQuery,
  presentation: Presentation,
  sources: readonly (WorkbookPublicSource & { sourceId: string })[],
  siteOrigin: string,
  /** The place the page is about, named in the file (`batumi`, `region-adjara`, `georgia`); omitted gives the plain name. */
  scope?: string,
): WorkbookExportModel {
  // ...
  const model = buildPopulationModel({ facts, places, query, locale });
  // ...
    filename: workbookFilename(`demography-population-${scope ? `${scope}-` : ""}${model.range.start}-${model.range.end}`, locale),
```
In `tests/explorer/demographyPopulationWorkbook.test.ts`: replace the `DEFAULT_POPULATION_STATE`/`PopulationState` import with `type PopulationQuery` and define `const DEFAULT_QUERY: PopulationQuery = { selectedIds: [GEORGIA_PLACE_ID], range: { kind: "all" } };`; make `build` take `Partial<PopulationQuery>` and pass `{ ...DEFAULT_QUERY, ...patch }`; change the two direct calls to `{ ...DEFAULT_QUERY, selectedIds }` and `DEFAULT_QUERY`; and add:

```ts
  test("a place page names the place and the range in the file", () => {
    const all = buildPopulationWorkbookExportModel(facts, places, { selectedIds: ["06"], range: { kind: "all" } }, presentation, sources, "https://fiscal.ge", "batumi");
    expect(all.filename).toBe("fiscal-demography-population-batumi-2004-2026-en.xlsx");
    const manual = buildPopulationWorkbookExportModel(facts, places, { selectedIds: ["06"], range: { kind: "manual", start: 2015, end: 2026 } }, presentation, sources, "https://fiscal.ge", "batumi");
    expect(manual.filename).toBe("fiscal-demography-population-batumi-2015-2026-en.xlsx");
  });
```
The file name carries the range, not the place's own years: a place page passes its own years as a manual range, so its files read `2015-2026`.

- [ ] **Step 9: Model tests.** Replace `tests/explorer/demographyPopulation.test.ts` with the file below. It keeps the places tests (minus `placesAtLevel`, plus `partsOf`), drops the hash-state and state-change blocks, and moves the model and highlights tests onto `query` and `placeId`.

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { INK } from "../../lib/explorer/colors";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  buildDemographyPlaces,
  municipalityCodeForPlaceId,
  partsOf,
  placeColor,
  placeIdForMunicipalityCode,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import {
  buildPopulationHighlights,
  buildPopulationModel,
  populationBasisKey,
  rankPlaces,
  sparkValues,
  type PopulationQuery,
} from "../../lib/explorer/demographyPopulation";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { ClientDemographyObservation } from "../../lib/servedRows";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];

const query = (patch: Partial<PopulationQuery> = {}): PopulationQuery => ({ selectedIds: [GEORGIA_PLACE_ID], range: { kind: "all" }, ...patch });
const model = (patch: Partial<PopulationQuery> = {}, locale: "ka" | "en" = "en") =>
  buildPopulationModel({ facts, places, query: query(patch), locale });
const highlights = (placeId: string, patch: Partial<PopulationQuery> = {}) =>
  buildPopulationHighlights(model({ selectedIds: [placeId], ...patch }), facts, places, placeId);
const population = (id: string, year: number) =>
  facts.find((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === id && fact.year === year)?.value ?? null;
const place = (id: string) => places.find((candidate) => candidate.id === id)!;

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
});

describe("places", () => {
  test("Georgia, 11 regions and 63 municipalities; Tbilisi is only a region", () => {
    expect(places).toHaveLength(75);
    expect(places.filter((p) => p.level === "country")).toHaveLength(1);
    expect(places.filter((p) => p.level === "region")).toHaveLength(11);
    expect(places.filter((p) => p.level === "municipality")).toHaveLength(63);
    expect(places.some((p) => p.id === "04")).toBe(false);
    expect(place(TBILISI_PLACE_ID).municipalityCount).toBe(1);
    expect(place(GEORGIA_PLACE_ID).municipalityCount).toBe(64);
    expect(place("11")).toMatchObject({ nameEn: "Khulo", regionId: "region.adjara" });
  });

  test("the parts a place is ticked with", () => {
    const ids = (id: string) => partsOf(place(id), places).map((part) => part.id).sort();
    expect(ids(GEORGIA_PLACE_ID)).toHaveLength(11);
    expect(ids(GEORGIA_PLACE_ID).every((id) => id.startsWith("region."))).toBe(true);
    expect(ids("region.adjara")).toEqual(["06", "07", "08", "09", "10", "11"]);
    expect(ids("region.racha_lechkhumi_kvemo_svaneti")).toEqual(["69", "70", "71", "72"]);
    expect(ids(TBILISI_PLACE_ID)).toEqual([]);
    expect(ids("11")).toEqual([]);
  });

  test("Tbilisi and municipality 04 are one place with one colour; Georgia is ink", () => {
    expect(placeIdForMunicipalityCode("04")).toBe(TBILISI_PLACE_ID);
    expect(municipalityCodeForPlaceId(TBILISI_PLACE_ID)).toBe("04");
    expect(placeIdForMunicipalityCode("11")).toBe("11");
    expect(placeColor(place(GEORGIA_PLACE_ID))).toBe(INK);
    expect(places.map(placeColor).every((colour) => /^#[0-9A-F]{6}$/i.test(colour))).toBe(true);
  });

  test("the 11 regions have pairwise distinct colours and none is the ink that Georgia wears", () => {
    const regionColours = places.filter((p) => p.level === "region").map((p) => placeColor(p).toUpperCase());
    expect(new Set(regionColours).size).toBe(11);
    expect(regionColours).not.toContain(INK.toUpperCase());
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
  });

  test("Georgia first, then selected places by their end-year value", () => {
    const result = model({ selectedIds: ["region.imereti", "11", TBILISI_PLACE_ID, GEORGIA_PLACE_ID, "06"] });
    expect(result.selected.map((p) => p.id)).toEqual([GEORGIA_PLACE_ID, TBILISI_PLACE_ID, "region.imereti", "06", "11"]);
  });

  test("a place has no value before its first year and the line does not bridge or zero-fill it", () => {
    const result = model({ selectedIds: ["region.imereti"] });
    expect(result.series[0]!.vals[0]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2014)]).toBeNull();
    expect(result.series[0]!.vals[result.years.indexOf(2015)]).toBe(population("region.imereti", 2015));
    expect(result.rows[0]!.valuesByYear[2010]).toBeNull();
  });

  test("labels follow the language", () => {
    expect(model({ selectedIds: ["11"] }, "ka").series[0]!.label).toBe(place("11").nameKa);
    expect(model({ selectedIds: ["11"] }, "en").series[0]!.label).toBe("Khulo");
  });

  test("a manual range is used and one outside the data shows everything", () => {
    expect(model({ range: { kind: "manual", start: 2015, end: 2024 } }).years).toHaveLength(10);
    expect(model({ range: { kind: "manual", start: 2000, end: 2030 } }).years).toHaveLength(23);
    expect(model({ range: { kind: "manual", start: 1990, end: 1995 } }).years).toHaveLength(23);
  });

  test("an empty selection has no data and no highlights for an unknown place", () => {
    const result = model({ selectedIds: [] });
    expect(result.selected).toEqual([]);
    expect(result.hasData).toBe(false);
    expect(buildPopulationHighlights(result, facts, places, "nonsense")).toBeNull();
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
    const list = [fake("b", 2), fake("a", 1), fake("c", 3), place(GEORGIA_PLACE_ID)];
    expect(rankPlaces(list, { a: 5, b: 5, c: null, [GEORGIA_PLACE_ID]: 1 }).map((p) => p.id)).toEqual([GEORGIA_PLACE_ID, "a", "b", "c"]);
  });
});

describe("highlights", () => {
  const smallest = (year: number) => {
    const entries = places
      .filter((p) => p.level === "municipality" || p.id === TBILISI_PLACE_ID)
      .map((p) => ({ place: p, value: population(p.id, year)! }))
      .sort((left, right) => left.value - right.value || left.place.sortOrder - right.place.sortOrder);
    return entries[0]!;
  };

  test("Georgia in 2026: the largest region, the densest region and the smallest municipality", () => {
    const result = highlights(GEORGIA_PLACE_ID);
    expect(result).toMatchObject({ kind: "country", year: 2026, persons: 3_941_103 });
    if (result?.kind !== "country") throw new Error("expected the country highlights");
    expect(result.largestRegion).toMatchObject({ value: 1_369_356 });
    expect(result.largestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.densestRegion?.place.id).toBe(TBILISI_PLACE_ID);
    expect(result.smallestMunicipality?.place.id).toBe(smallest(2026).place.id);
    expect(result.smallestMunicipality?.value).toBe(5_056);
    expect(result.regionalFrom).toBe(2015);
  });

  test("Tbilisi in 2026 is a region with 34.7% of Georgia", () => {
    const result = highlights(TBILISI_PLACE_ID);
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    expect(result.persons).toBe(1_369_356);
    expect((result.shareOfGeorgia! * 100).toFixed(1)).toBe("34.7");
    expect(result.rank).toBe(1);
    expect(result.ofRegions).toBe(11);
    expect(result.municipalityCount).toBe(1);
    expect(result.density).toBe(2715.7);
    expect(result.densityRank).toBe(1);
  });

  test("Adjara in 2026 is fourth of 11 with six municipalities", () => {
    const result = highlights("region.adjara");
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    expect(result.persons).toBe(413_214);
    expect(result.rank).toBe(4);
    expect(result.municipalityCount).toBe(6);
    expect(result.density).toBe(142.5);
  });

  test("a region at the end of a 2025 range", () => {
    const result = highlights("region.imereti", { range: { kind: "manual", start: 2015, end: 2025 } });
    if (result?.kind !== "region") throw new Error("expected the region highlights");
    const regionIds = places.filter((p) => p.level === "region").map((p) => p.id);
    const expectedRank = [...regionIds].sort((left, right) => population(right, 2025)! - population(left, 2025)!).indexOf("region.imereti") + 1;
    expect(result.year).toBe(2025);
    expect(result.persons).toBe(population("region.imereti", 2025));
    expect(result.rank).toBe(expectedRank);
    expect(result.municipalityCount).toBe(places.filter((p) => p.regionId === "region.imereti").length);
  });

  test("Batumi in 2026 is second of 64 and Khulo at the end of 2024 is before the re-base", () => {
    const batumi = highlights("06");
    if (batumi?.kind !== "municipality") throw new Error("expected the municipality highlights");
    expect(batumi.persons).toBe(246_267);
    expect(batumi.rank).toBe(2);
    expect(batumi.ofMunicipalities).toBe(64);

    const result = highlights("11", { range: { kind: "manual", start: 2015, end: 2024 } });
    if (result?.kind !== "municipality") throw new Error("expected the municipality highlights");
    expect(result.persons).toBe(28_250);
    expect(result.shareOfRegion).toBeCloseTo(28_250 / population("region.adjara", 2024)!, 10);
    expect(result.regionPersons).toBe(population("region.adjara", 2024));
    expect(result.shareOfGeorgia).toBeCloseTo(28_250 / 3_694_608, 10);
    expect(result.region?.id).toBe("region.adjara");
  });

  test("a range that ends before 2015 has Georgia but no regional figure", () => {
    const range = { kind: "manual" as const, start: 2004, end: 2010 };
    const country = highlights(GEORGIA_PLACE_ID, { range });
    if (country?.kind !== "country") throw new Error("expected the country highlights");
    expect(country.persons).toBe(population(GEORGIA_PLACE_ID, 2010));
    expect(country.largestRegion).toBeNull();
    expect(country.smallestMunicipality).toBeNull();
    const region = highlights("region.imereti", { range });
    if (region?.kind !== "region") throw new Error("expected the region highlights");
    expect(region.persons).toBeNull();
    expect(region.rank).toBeNull();
    expect(region.regionalFrom).toBe(2015);
  });

  test("the highlights describe the place asked for, whatever else is ticked", () => {
    const wide = model({ selectedIds: [GEORGIA_PLACE_ID, "region.imereti", "11"] });
    expect(buildPopulationHighlights(wide, facts, places, "region.imereti")?.place.id).toBe("region.imereti");
    expect(buildPopulationHighlights(wide, facts, places, "11")?.place.id).toBe("11");
  });

  test("a trend is two segments across the re-base and one without it", () => {
    const across = highlights(GEORGIA_PLACE_ID, { range: { kind: "manual", start: 2015, end: 2026 } })!;
    expect(across.trend).toHaveLength(13);
    expect(across.trend[9]).toBe(3_694_608);
    expect(across.trend[10]).toBeNull();
    expect(across.trend[11]).toBe(3_930_428);
    const after = highlights(GEORGIA_PLACE_ID, { range: { kind: "manual", start: 2025, end: 2026 } })!;
    expect(after.trend).toEqual([3_930_428, 3_941_103]);
    expect(sparkValues([2023, 2024], (year) => year)).toEqual([2023, 2024]);
  });
});

describe("order independence", () => {
  // A CSV build serves the facts in file order; a database build (production) serves them in Postgres's
  // text-collation order. Nothing the model or the highlights return may depend on which one it is.
  test("the model and the highlights are the same for facts in reverse order", () => {
    const reversed = [...facts].reverse();
    expect(reversed[0]).toBe(facts.at(-1));
    const cases: Array<[string, string, Partial<PopulationQuery>]> = [
      ["the default query", GEORGIA_PLACE_ID, {}],
      ["Georgia, Imereti and Khulo", "region.imereti", { selectedIds: [GEORGIA_PLACE_ID, "region.imereti", "11"] }],
      ["Imereti and Khulo to 2025", "11", { selectedIds: ["region.imereti", "11"], range: { kind: "manual", start: 2015, end: 2025 } }],
      ["Tbilisi alone", TBILISI_PLACE_ID, { selectedIds: [TBILISI_PLACE_ID] }],
    ];
    for (const [name, placeId, patch] of cases) {
      const forward = buildPopulationModel({ facts, places, query: query(patch), locale: "en" });
      const backward = buildPopulationModel({ facts: reversed, places, query: query(patch), locale: "en" });
      // `valueAt` is a closure over each build's own cells, so two builds never compare equal as functions:
      // compare what it answers for every place and year instead.
      const { valueAt: forwardAt, ...forwardRest } = forward;
      const { valueAt: backwardAt, ...backwardRest } = backward;
      expect(backwardRest, `model: ${name}`).toEqual(forwardRest);
      const cells = (at: typeof forwardAt) => places.map((p) => forward.availableYears.map((year) => at(p.id, year)));
      expect(cells(backwardAt), `valueAt: ${name}`).toEqual(cells(forwardAt));
      expect(buildPopulationHighlights(backward, reversed, places, placeId), `highlights: ${name}`).toEqual(
        buildPopulationHighlights(forward, facts, places, placeId),
      );
    }
  });
});
```

- [ ] **Step 10: Placeholder page.** Rewrite `renderDemographyPopulationPage` in `lib/pages/demography-population.tsx` so the route still renders while Tasks 2–4 build the real index. Keep `demographyPopulationPageMetadata` as it is. The body becomes:

```tsx
export async function renderDemographyPopulationPage(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([
    loadServedDemographyData(),
    getPresentation(locale, ["demography", "common"], []),
  ]);
  const t = (key: string, values?: TemplateValues) => message(presentation.messages, `demography.${key}`, values);
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
      </ExplorerPage>
    </I18nProvider>
  );
}
```
and delete every import this leaves unused (the explorer, the municipal and density loaders, `buildDemographyPlaces`, the map builder, `getMessages`, the manifest and catalogue loaders, `projectDemographyObservation`, `resolveSiteUrl`, `path`). In `tests/explorer/demographyPages.test.tsx` change the two population-page tests: `data-testid="population-explorer"` becomes `data-testid="explorer-shell"`, and remove the `href="/en/methodology/demography"` and `href="/methodology/demography"` assertions (Task 4 restores them with the real page).

- [ ] **Step 11: Messages.** In `lib/i18n/messages/ka/demography.json` and `en/demography.json` delete the keys `demography.georgiaPill`, `tabRegions`, `tabMunicipalities`, `levelAria`, `measureAria`, `measureDensity`, `densityRegionsOnly`, `mapLegendDensity`, `alsoRegion`, and change two texts:

| Key | ka | en |
| --- | --- | --- |
| `demography.populationDescription` | `მოსახლეობა 1 იანვრის მდგომარეობით საქართველოში, 11 რეგიონსა და 64 მუნიციპალიტეტში; სიმჭიდროვე რეგიონების მიხედვით.` | `Population on 1 January for Georgia, its 11 regions and 64 municipalities, with density by region.` |
| `demography.highlightsNote` | `ინდიკატორები ამ ადგილის მონაცემებს აჩვენებს პერიოდის ბოლო წლისთვის. ცვლილება არ ითვლება: 2025 წლიდან მონაცემები 2024 წლის აღწერას ეყრდნობა.` | `The indicators describe this place for the last year of the period. No change is computed: from 2025 the figures are based on the 2024 census.` |

Search `tests/` for the old description text (`density on the map`, `სიმჭიდროვე რუკაზე`) and update any hub test that pins it.

- [ ] **Step 12: Run and commit.**

```bash
npm run typecheck
npx vitest run tests/explorer/demographyPopulation.test.ts tests/explorer/demographyPopulationMaps.test.ts tests/explorer/demographyPopulationWorkbook.test.ts tests/explorer/municipalityValueMap.test.tsx tests/explorer/demographyPages.test.tsx tests/explorer/demographyHub.test.ts tests/i18n/demographyMessages.test.ts
npx vitest run regionalEconom
```
Expected: typecheck clean, all pass. Also run `rg -n "populationExplorer|PopulationExplorer|usePopulationState|PopulationSeriesPanel|buildRegionValueMapModel|placesAtLevel|buildPopulationMapModels" .` (excluding `node_modules` and `.next`) and expect no hits. Then:

```bash
git add -A
git commit -m "refactor(demography): retire the one-page Population workspace, the map choosing mode and the region-map additions"
```

---

### Task 2: Make the Budget index, picker and place-page shell reusable

**Files:**
- Modify: `components/municipalities/entity-picker.tsx`, `municipalities-index.tsx`, `municipal-explorer.tsx`; `lib/pages/municipal-region.tsx`.
- Create: `components/municipalities/entity-heading.tsx`, `entity-workspace-shell.tsx`, `entity-member-list.tsx`.
- Test: `tests/explorer/municipalOverrides.test.tsx` (new). Throwaway: `tests/explorer/zzBaseline.test.tsx` (deleted before the commit).

**Interfaces:**
- Produces (used by Tasks 4–6):
  - `type EntityPickerOverrides = { hrefById?: Readonly<Record<string, string>>; valueFormat?: "amount" | "persons"; countryDetail?: string }`
  - `type MunicipalitiesIndexOverrides = { hrefById?; valueFormat?: "amount" | "persons"; secondaryById?: Readonly<Record<string, string>>; countrySubtitle?: string; unitLabel?: string; mapWording?: { groupAria: string; legendCaption: string }; mapNote?: ReactNode }`; `MunicipalitiesIndex` gains `overrides?: MunicipalitiesIndexOverrides` and `sourceNote: ReactNode`.
  - `EntityHeading({ title, triggerLabel, metaLine, entityId, navigation?, pickerCountry, pickerGroups, pickerOverrides? })`, `type EntityNavigation = { prev: { label: string; href: string }; next: { label: string; href: string } }`.
  - `EntityWorkspaceShell({ testId, main, aside })`.
  - `EntityMemberList({ heading, rows })`, `rows: Array<{ id: string; href: string; rank: number; label: string; value: string }>`.
- Defaults: with every new prop omitted, the Budget pages render byte-identical markup.

- [ ] **Step 1: Capture the baseline markup (before any edit).** Create `tests/explorer/zzBaseline.test.tsx`:

```tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { renderMunicipalCountry, renderMunicipalIndex, renderMunicipalRegion, renderMunicipality } from "../../lib/pages/municipal";

const dir = path.resolve(process.cwd(), "../../.superpowers/sdd/2026-10-07-demography-population-places/baseline");
const mode = process.env.BASELINE_MODE ?? "write";
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

describe("the Budget municipal pages' markup", () => {
  for (const locale of ["ka", "en"] as const) {
    const pages = {
      index: () => renderMunicipalIndex(locale),
      georgia: () => renderMunicipalCountry(locale),
      region: () => renderMunicipalRegion("imereti", locale),
      municipality: () => renderMunicipality("batumi", locale),
    };
    for (const [name, render] of Object.entries(pages)) {
      it(`${locale} ${name}`, async () => {
        const html = renderToStaticMarkup(await render());
        const file = path.join(dir, `${locale}-${name}.html`);
        if (mode === "write") {
          mkdirSync(dir, { recursive: true });
          writeFileSync(file, html);
        } else {
          expect(html).toBe(readFileSync(file, "utf8"));
        }
      });
    }
  }
});
```
Run `BASELINE_MODE=write npx vitest run tests/explorer/zzBaseline.test.tsx` (Bash syntax). Expected: 8 pass and 8 `.html` files in the baseline folder (git-ignored). If rendering a page needs a mock this file lacks, add it; do not skip a page.

- [ ] **Step 2: Write the failing override tests.** Create `tests/explorer/municipalOverrides.test.tsx`:

```tsx
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { EntityHeading } from "../../components/municipalities/entity-heading";
import { EntityMemberList } from "../../components/municipalities/entity-member-list";
import { EntityPicker } from "../../components/municipalities/entity-picker";
import { EntityWorkspaceShell } from "../../components/municipalities/entity-workspace-shell";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { MUNICIPAL_COUNTRY_ID } from "../../lib/data/municipal/types";
import type { Municipality } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationMunicipalityMap } from "../../lib/explorer/demographyPopulationMaps";
import type { MunicipalListRow } from "../../lib/explorer/municipalData";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";

let municipalities: Municipality[];
let map: ReturnType<typeof buildPopulationMunicipalityMap>["model"];
let presentation: Presentation;

const rows: MunicipalListRow[] = [
  { id: "04", kind: "municipality", nameKa: "თბილისი", subtitleKa: "თბილისი", regionId: "region.tbilisi", valueGel: 1_369_356, budgetPerResidentGel: null, rank: 1 },
  { id: "06", kind: "municipality", nameKa: "ბათუმი", subtitleKa: "აჭარა", regionId: "region.adjara", valueGel: 246_267, budgetPerResidentGel: null, rank: 2 },
];
const regionRows: MunicipalListRow[] = [
  { id: "region.adjara", kind: "region", nameKa: "აჭარა", subtitleKa: "6 მუნიციპალიტეტი", regionId: "region.adjara", valueGel: 413_214, budgetPerResidentGel: null, rank: 1 },
];
const country: MunicipalListRow = { id: MUNICIPAL_COUNTRY_ID, kind: "country", nameKa: "საქართველო", subtitleKa: "64 მუნიციპალიტეტი", regionId: null, valueGel: 3_941_103, budgetPerResidentGel: null, rank: null };
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;

beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  municipalities = municipal.municipalities;
  map = buildPopulationMunicipalityMap({ facts, municipalities }).model;
  const ids = [MUNICIPAL_COUNTRY_ID, ...municipal.regions.map((region) => region.id), ...municipalities.map((m) => m.code)];
  presentation = await getPresentation("en", ["municipal", "common", "controls", "format", "main"], ids);
});

const wrap = (node: ReactNode) => renderToStaticMarkup(<I18nProvider {...presentation}>{node}</I18nProvider>);
const index = (overrides?: Parameters<typeof MunicipalitiesIndex>[0]["overrides"]) =>
  wrap(
    <MunicipalitiesIndex
      viewBox={map.viewBox}
      shapes={map.shapes}
      markers={map.markers}
      occupiedAreas={map.occupiedAreas}
      legendMin="min"
      legendMax="max"
      municipalities={rows}
      regions={regionRows}
      country={country}
      kpis={[]}
      sourceNote="Source"
      overrides={overrides}
    />,
  );

describe("MunicipalitiesIndex overrides", () => {
  test("without them it is the budget index: budget links and amounts", () => {
    const html = index();
    expect(html).toContain('href="/en/explorer/municipalities/batumi"');
    expect(html).toContain('href="/en/explorer/municipalities/region/adjara"');
    expect(html).toContain('href="/en/explorer/municipalities/georgia"');
    expect(html).toContain("GEL");
    expect(html).not.toContain("persons");
  });

  test("with them it links to the given pages and prints persons, a second line, the unit and the notes", () => {
    const html = index({
      hrefById: {
        "04": "/explorer/demography/population/region/tbilisi",
        "06": "/explorer/demography/population/batumi",
        "region.adjara": "/explorer/demography/population/region/adjara",
        [MUNICIPAL_COUNTRY_ID]: "/explorer/demography/population/georgia",
      },
      valueFormat: "persons",
      secondaryById: { "region.adjara": "142.5/km²" },
      countrySubtitle: "64 municipalities",
      unitLabel: "persons",
      mapWording: { groupAria: "Population map", legendCaption: "persons, 1 January 2026" },
      mapNote: <p data-testid="map-note">A note</p>,
    });
    expect(html).toContain('href="/en/explorer/demography/population/batumi"');
    expect(html).toContain('href="/en/explorer/demography/population/region/tbilisi"');
    expect(html).toContain('href="/en/explorer/demography/population/georgia"');
    expect(html).not.toContain("/explorer/municipalities/");
    expect(html).toContain("246,267");
    expect(html).toContain("3,941,103");
    expect(html).not.toContain("GEL");
    expect(html).toContain("142.5/km²");
    expect(html).toContain("64 municipalities");
    expect(html).toContain('aria-label="Population map"');
    expect(html).toContain("persons, 1 January 2026");
    expect(count(html, /data-testid="map-note"/g)).toBe(1);
  });
});

describe("EntityPicker overrides", () => {
  const groups = [{ regionId: "region.adjara", nameKa: "აჭარა", valueGel: 413_214, members: [{ code: "06", nameKa: "ბათუმი", valueGel: 246_267 }] }];
  const picker = (overrides?: Parameters<typeof EntityPicker>[0]["overrides"]) =>
    wrap(
      <EntityPicker
        open
        onClose={() => {}}
        country={{ id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო", valueGel: 3_941_103, budgetCount: 64 }}
        groups={groups}
        activeId="06"
        overrides={overrides}
      />,
    );

  test("without them it links to the budget pages", () => {
    const html = picker();
    expect(html).toContain('href="/en/explorer/municipalities/batumi"');
    expect(html).toContain("municipal budgets");
  });

  test("with them it links to the given pages and prints persons and the given country text", () => {
    const html = picker({
      hrefById: { "06": "/explorer/demography/population/batumi", "region.adjara": "/explorer/demography/population/region/adjara", [MUNICIPAL_COUNTRY_ID]: "/explorer/demography/population/georgia" },
      valueFormat: "persons",
      countryDetail: "3,941,103 · 64 municipalities",
    });
    expect(html).toContain('href="/en/explorer/demography/population/batumi"');
    expect(html).toContain("246,267");
    expect(html).toContain("3,941,103 · 64 municipalities");
    expect(html).not.toContain("municipal budgets");
  });
});

describe("the place-page shell pieces", () => {
  test("EntityHeading renders the title, the picker trigger, the meta line and previous/next only when given", () => {
    const props = {
      title: "Population —",
      triggerLabel: "Batumi",
      metaLine: "Adjara · Rank 2 of 64",
      entityId: "06",
      pickerCountry: { id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო" as const, valueGel: 1, budgetCount: 64 },
      pickerGroups: [],
    };
    const bare = wrap(<EntityHeading {...props} />);
    expect(bare).toContain('data-testid="entity-picker-trigger"');
    expect(bare).toContain("Population —");
    expect(bare).toContain("Adjara · Rank 2 of 64");
    expect(bare).not.toContain('data-testid="municipal-entity-navigation"');
    const withNav = wrap(<EntityHeading {...props} navigation={{ prev: { label: "Kobuleti", href: "/a" }, next: { label: "Keda", href: "/b" } }} />);
    expect(withNav).toContain('data-testid="municipal-entity-navigation"');
    expect(withNav).toContain("← Kobuleti");
    expect(withNav).toContain("Keda →");
  });

  test("EntityWorkspaceShell puts the main column and the sticky aside side by side with its test id", () => {
    const html = wrap(<EntityWorkspaceShell testId="x-workspace" main={<p>main</p>} aside={<p>aside</p>} />);
    expect(html).toContain('data-testid="x-workspace"');
    expect(html).toContain("main");
    expect(html).toContain("sticky top-5");
    expect(html).toContain("340px");
  });

  test("EntityMemberList renders one linked row per member", () => {
    const html = wrap(<EntityMemberList heading="Municipalities in this region" rows={[{ id: "06", href: "/en/x/batumi", rank: 1, label: "Batumi", value: "246,267" }]} />);
    expect(html).toContain("Municipalities in this region");
    expect(count(html, /data-testid="region-member-row"/g)).toBe(1);
    expect(html).toContain('href="/en/x/batumi"');
    expect(html).toContain("01");
  });
});
```
Run `npx vitest run tests/explorer/municipalOverrides.test.tsx`. Expected: FAIL (missing exports/props).

- [ ] **Step 3: `EntityPicker` overrides.** In `components/municipalities/entity-picker.tsx`: add

```tsx
import { municipalEntityHref } from "../../lib/seo/internalLinks";
import { formatAmount, formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";

/** Plain data, so a server page can hand it over. Every field is omitted by the Budget pages. */
export type EntityPickerOverrides = {
  /** Where each option opens, by id (country id, region id, municipality code). Ids not listed open the Budget page. */
  hrefById?: Readonly<Record<string, string>>;
  /** How a figure prints: the budget amount (default) or a whole number of persons. */
  valueFormat?: "amount" | "persons";
  /** The country row's right-hand text; the budget amount and count by default. */
  countryDetail?: string;
};
```
add `overrides?: EntityPickerOverrides` to `EntityPickerProps` and the destructuring, and inside the component:

```tsx
  const hrefFor = (kind: "country" | "region" | "municipality", id: string) => overrides?.hrefById?.[id] ?? municipalEntityHref(kind, id);
  const formatValue = (value: number) => (overrides?.valueFormat === "persons" ? formatInUnit(value, UNIT_PERSONS) : formatAmount(value, locale));
```
Replace the three `municipalEntityHref(...)` calls in `selectOption`, the three in the JSX (`href={pageHref(municipalEntityHref("country", country.id), locale)}` and the region and municipality ones) with `hrefFor(...)`, replace the three `formatAmount(<value>, locale)` calls (country text uses the message below, the region row, the member row) with `formatValue(<value>)`, and make the country detail `{overrides?.countryDetail ?? message(messages, "municipal.pickerCountry", { amount: formatValue(country.valueGel), count: country.budgetCount })}`. (With the defaults `formatValue` is exactly the old `formatAmount(value, locale)`, so the text is unchanged.) Keep the `import { formatAmount } ...` only as the combined import above.

- [ ] **Step 4: `MunicipalitiesIndex` overrides.** In `components/municipalities/municipalities-index.tsx`: add the imports `type ReactNode` from `react`, `formatInUnit`, `UNIT_PERSONS` from `../../lib/explorer/format` (alongside `formatAmount`), `type MunicipalEntityKind` from `../../lib/seo/internalLinks`; add

```tsx
/** Plain data, so a server page can hand it over. Every field is omitted by the Budget index. */
export type MunicipalitiesIndexOverrides = {
  /** Where each row and each map shape opens, by id (country id, region id, municipality code). Ids not listed open the Budget page. */
  hrefById?: Readonly<Record<string, string>>;
  /** How a row's figure prints: the budget amount (default) or a whole number of persons. */
  valueFormat?: "amount" | "persons";
  /** A second line under a row's figure, by row id; rows not listed keep the per-resident budget line, if they have one. */
  secondaryById?: Readonly<Record<string, string>>;
  /** The Georgia row's line under its name; the municipal-budget count by default. */
  countrySubtitle?: string;
  /** What sits where the Budget index prints the currency; the currency by default. */
  unitLabel?: string;
  /** The map's group label and legend caption, in place of the per-resident budget wording. */
  mapWording?: { groupAria: string; legendCaption: string };
  /** A note under the map. */
  mapNote?: ReactNode;
};
```
make `sourceNote: ReactNode` and add `overrides?: MunicipalitiesIndexOverrides` to the props. Inside: 

```tsx
  const { overrides } = props;
  const hrefFor = (kind: MunicipalEntityKind, id: string) => overrides?.hrefById?.[id] ?? municipalEntityHref(kind, id);
  const formatValue = (value: number) => (overrides?.valueFormat === "persons" ? formatInUnit(value, UNIT_PERSONS) : formatAmount(value, locale));
```
Then: `openMunicipality` uses `router.push(pageHref(hrefFor("municipality", code), locale))` (it equals `municipalityHrefForCode(code)` by default; drop the now-unused `municipalityHrefForCode` import); the row `Link` href uses `pageHref(hrefFor(row.kind, row.id), locale)`; `subtitleFor`'s country branch returns `overrides?.countrySubtitle ?? message(messages, "municipal.budgets", { count: MUNICIPAL_COUNTRY_BUDGET_COUNT })`; the amount span prints `formatValue(row.valueGel)`; the per-resident block becomes

```tsx
              {overrides?.secondaryById?.[row.id] !== undefined ? (
                <span data-testid="municipal-row-secondary" className="mt-0.5 block text-[10px] leading-[1.25] text-[var(--muted)]">
                  {overrides.secondaryById[row.id]}
                </span>
              ) : row.budgetPerResidentGel !== null ? (
                ...the existing per-resident span, unchanged
              ) : null}
```
the unit label span prints `{overrides?.unitLabel ?? message(messages, "municipal.gel")}`; `<MunicipalityMap ... wording={overrides?.mapWording} />`; and `{overrides?.mapNote}` is rendered right after the map's wrapping `<div>`, inside the left column. Do not change any class name or test id that already exists.

- [ ] **Step 5: Extract the shell pieces.** Create `components/municipalities/entity-heading.tsx` (`"use client"`) holding, moved verbatim from `municipal-explorer.tsx`: the `pickerOpen` state, the ⌘K `useEffect`, and the heading block (the outer `div.mt-[22px]` with the `h1`, the trigger button, `<EntityPicker ... />`, the meta line and the previous/next `span`). Its props are `title`, `triggerLabel`, `metaLine`, `entityId`, `navigation?: EntityNavigation`, `pickerCountry`, `pickerGroups`, `pickerOverrides?: EntityPickerOverrides` (passed to `EntityPicker` as `overrides`). Export `type EntityNavigation`. Create `components/municipalities/entity-workspace-shell.tsx`:

```tsx
import type { ReactNode } from "react";

/** The Budget place page's two columns: the chart column and a sticky 340px aside from 1100px of column width. */
export function EntityWorkspaceShell({ testId, main, aside }: { testId: string; main: ReactNode; aside: ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="mt-7 grid items-start gap-10 border-t border-[var(--ink)] pt-5 @min-[1100px]:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="min-w-0">{main}</div>
      <aside className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]">
        <div className="sticky top-5">{aside}</div>
      </aside>
    </div>
  );
}
```
Create `components/municipalities/entity-member-list.tsx` (no `"use client"`; it is plain markup) moving the region page's member block from `lib/pages/municipal-region.tsx`:

```tsx
export function EntityMemberList({
  heading,
  rows,
}: {
  heading: string;
  rows: Array<{ id: string; href: string; rank: number; label: string; value: string }>;
}) {
  return (
    <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
      <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[22px] font-semibold">{heading}</h2>
      {rows.map((row) => (
        <a
          key={row.id}
          href={row.href}
          data-testid="region-member-row"
          className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2 text-[var(--ink)] no-underline hover:bg-[var(--tint)]"
        >
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">{String(row.rank).padStart(2, "0")}</span>
          <span className="truncate text-[12.5px]">{row.label}</span>
          <span className="font-[family-name:var(--font-numeric)] text-[11.5px]">{row.value}</span>
        </a>
      ))}
    </div>
  );
}
```
In `municipal-explorer.tsx` replace the heading block with `<EntityHeading title={props.title} triggerLabel={props.triggerLabel} metaLine={props.metaLine} entityId={props.entityId} navigation={navigation} pickerCountry={props.pickerCountry} pickerGroups={props.pickerGroups} />` and delete `pickerOpen`, the ⌘K effect and any import that leaves unused (`useEffect`, `EntityPicker`); replace the `data-testid="municipal-workspace"` grid and its `<aside>` wrapper with `<EntityWorkspaceShell testId="municipal-workspace" main={...} aside={...} />` where `main` is the exact content of the old left column `div` and `aside` the exact content of the old sticky `div`. In `municipal-region.tsx` replace the member block with `<EntityMemberList heading={message(messages, "municipal.regionMembers")} rows={memberRows.map((member) => ({ id: member.id, href: pageHref(municipalityHrefForCode(member.id), locale), rank: member.rank, label: publicLabel(locale, member.id, member.nameKa, englishLabels), value: formatAmount(member.valueGel, locale) }))} />`.

- [ ] **Step 6: Verify.** Run:

```bash
npx vitest run tests/explorer/municipalOverrides.test.tsx
BASELINE_MODE=compare npx vitest run tests/explorer/zzBaseline.test.tsx
npm run typecheck
```
Expected: the override tests pass; the comparison passes for all 8 pages (byte-identical markup); typecheck is clean (it includes `tests/explorer/municipal-explorer-props.typecheck.ts`). If the comparison fails, fix the extraction, not the baseline.

- [ ] **Step 7: Commit.** Delete `tests/explorer/zzBaseline.test.tsx`, then:

```bash
git add -A
git commit -m "refactor(municipalities): plain-data overrides for the index and picker; heading, shell and member list as shared parts"
```

---

### Task 3: Place routes, the index model and the key indicators

**Files:**
- Create: `lib/explorer/demographyPlaceRoutes.ts`, `lib/explorer/demographyPopulationIndex.ts`, `lib/explorer/demographyPopulationKpis.ts`.
- Modify: `components/demography/population-highlights.tsx`.
- Test: `tests/explorer/demographyPlaceRoutes.test.ts`, `demographyPopulationIndex.test.ts`, `demographyPopulationKpis.test.ts` (new).

**Interfaces:**
- Produces (used by Tasks 4–7):
  - `POPULATION_PATH`, `populationPlaceHref(placeId)`, `populationMunicipalitySlugs()`, `populationMunicipalityCodeForSlug(slug)`, `populationHrefById(places)`, `placeNeighbours(place, places)`, `populationPlacePaths(regionIds)`.
  - `PopulationIndexModel = { year, map: MunicipalityMapModel, municipalities: MunicipalListRow[], regions: MunicipalListRow[], country: MunicipalListRow, densityByPlace: Record<string, number>, densityYear: number }`; `buildPopulationIndexModel({ facts, regions, municipalities })`; `buildPopulationPickerGroups(index)`.
  - `PopulationKpis = { heroLabel, heroValue, heroBasis, shareLine, unavailable, side: SideKpi[] }`; `buildPopulationKpis(highlights, messages, locale)`; `populationIndexKpis(kpis, unitInDetail): MunicipalKpi[]`.
- Consumes: Task 1's `partsOf`, `buildPopulationHighlights`, `buildPopulationMunicipalityMap`.

- [ ] **Step 1: Failing route tests.** Create `tests/explorer/demographyPlaceRoutes.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import {
  POPULATION_PATH,
  placeNeighbours,
  populationHrefById,
  populationMunicipalityCodeForSlug,
  populationMunicipalitySlugs,
  populationPlaceHref,
  populationPlacePaths,
} from "../../lib/explorer/demographyPlaceRoutes";
import { getPresentation } from "../../lib/i18n/presentation.server";

let places: DemographyPlace[];
let regionIds: string[];
const place = (id: string) => places.find((candidate) => candidate.id === id)!;

beforeAll(async () => {
  const municipal = await loadServedMunicipalData();
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const presentation = await getPresentation("en", [], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: "საქართველო",
  });
  regionIds = municipal.regions.map((region) => region.id);
});

describe("place addresses", () => {
  test("Georgia, a region and a municipality each have their own address", () => {
    expect(populationPlaceHref(GEORGIA_PLACE_ID)).toBe("/explorer/demography/population/georgia");
    expect(populationPlaceHref("region.adjara")).toBe("/explorer/demography/population/region/adjara");
    expect(populationPlaceHref("06")).toBe("/explorer/demography/population/batumi");
    expect(populationPlaceHref("11")).toBe("/explorer/demography/population/khulo");
  });

  test("Tbilisi has the region address, whether it arrives as the region or as municipality 04", () => {
    expect(populationPlaceHref(TBILISI_PLACE_ID)).toBe("/explorer/demography/population/region/tbilisi");
    expect(populationPlaceHref("04")).toBe("/explorer/demography/population/region/tbilisi");
  });

  test("an unknown place has no address", () => {
    expect(() => populationPlaceHref("99")).toThrow(/No population page/);
  });

  test("75 pages: every place has one distinct address and every address is a route", () => {
    const hrefs = places.map((p) => populationPlaceHref(p.id));
    expect(hrefs).toHaveLength(75);
    expect(new Set(hrefs).size).toBe(75);
    const paths = populationPlacePaths(regionIds);
    expect(paths).toHaveLength(75);
    expect(new Set(paths)).toEqual(new Set(hrefs));
    expect(hrefs.every((href) => href.startsWith(`${POPULATION_PATH}/`))).toBe(true);
  });

  test("the municipality slugs are the Budget ones without Tbilisi, and Tbilisi's slug is not a route", () => {
    const slugs = populationMunicipalitySlugs();
    expect(slugs).toHaveLength(63);
    expect(slugs).not.toContain("tbilisi");
    expect(slugs.some((slug) => slug === "georgia" || slug === "region")).toBe(false);
    expect(populationMunicipalityCodeForSlug("batumi")).toBe("06");
    expect(populationMunicipalityCodeForSlug("tbilisi")).toBeNull();
    expect(populationMunicipalityCodeForSlug("nonsense")).toBeNull();
  });

  test("the address table covers every place and municipality 04", () => {
    const table = populationHrefById(places);
    expect(Object.keys(table)).toHaveLength(76);
    expect(table["04"]).toBe(table[TBILISI_PLACE_ID]);
    expect(table[GEORGIA_PLACE_ID]).toBe("/explorer/demography/population/georgia");
  });
});

describe("neighbours", () => {
  test("Georgia has none; regions and municipalities wrap round their own ring in registry order", () => {
    expect(placeNeighbours(place(GEORGIA_PLACE_ID), places)).toBeNull();
    const regions = places.filter((p) => p.level === "region").sort((a, b) => a.sortOrder - b.sortOrder);
    expect(placeNeighbours(regions[0]!, places)).toMatchObject({ prev: { id: regions.at(-1)!.id }, next: { id: regions[1]!.id } });
    expect(placeNeighbours(regions.at(-1)!, places)?.next.id).toBe(regions[0]!.id);
    const municipalities = places.filter((p) => p.level === "municipality").sort((a, b) => a.sortOrder - b.sortOrder);
    expect(municipalities).toHaveLength(63);
    expect(placeNeighbours(municipalities[0]!, places)?.prev.id).toBe(municipalities.at(-1)!.id);
    expect(municipalities.some((p) => p.id === TBILISI_PLACE_ID)).toBe(false);
  });
});
```
Run it: FAIL (module missing).

- [ ] **Step 2: Implement the routes.** Create `lib/explorer/demographyPlaceRoutes.ts`:

```ts
import { GEORGIA_PLACE_ID, placeIdForMunicipalityCode, type DemographyPlace } from "./demographyAreas";
import { MUNICIPALITY_ROUTES, municipalityCodeForSlug, municipalitySlugForCode } from "./municipalityRoutes";

export const POPULATION_PATH = "/explorer/demography/population";

/** Tbilisi has a municipality slug on the Budget pages; here it is a region and has the region page only. */
const TBILISI_SLUG = "tbilisi";

/** The address of a place's own page: Georgia, a region, or one of the 63 municipalities. Municipality 04 is Tbilisi, a region. */
export function populationPlaceHref(placeId: string): string {
  const id = placeIdForMunicipalityCode(placeId);
  if (id === GEORGIA_PLACE_ID) return `${POPULATION_PATH}/georgia`;
  if (id.startsWith("region.")) return `${POPULATION_PATH}/region/${id.slice("region.".length)}`;
  const slug = municipalitySlugForCode(id);
  if (slug === null) throw new Error(`No population page for ${placeId}`);
  return `${POPULATION_PATH}/${slug}`;
}

/** The 63 municipality slugs: every Budget slug except Tbilisi's. */
export function populationMunicipalitySlugs(): string[] {
  return MUNICIPALITY_ROUTES.filter((route) => route.slug !== TBILISI_SLUG).map((route) => route.slug);
}

/** The municipality code behind a municipality page's slug, or null for an unknown slug and for Tbilisi. */
export function populationMunicipalityCodeForSlug(slug: string): string | null {
  return slug === TBILISI_SLUG ? null : municipalityCodeForSlug(slug);
}

/** Every address by place id, plus municipality 04 (the map and the municipal lists name Tbilisi by it). Plain data, so a server page can hand it to a client component. */
export function populationHrefById(places: readonly DemographyPlace[]): Record<string, string> {
  const hrefs: Record<string, string> = {};
  for (const place of places) hrefs[place.id] = populationPlaceHref(place.id);
  hrefs["04"] = populationPlaceHref("04");
  return hrefs;
}

/** The addresses of all 75 place pages, for the sitemap and the inventory. */
export function populationPlacePaths(regionIds: readonly string[]): string[] {
  return [
    `${POPULATION_PATH}/georgia`,
    ...regionIds.map((id) => `${POPULATION_PATH}/region/${id.slice("region.".length)}`),
    ...populationMunicipalitySlugs().map((slug) => `${POPULATION_PATH}/${slug}`),
  ];
}

/** The neighbours of a place in registry order within its own level, wrapping round. Georgia has none. */
export function placeNeighbours(
  place: DemographyPlace,
  places: readonly DemographyPlace[],
): { prev: DemographyPlace; next: DemographyPlace } | null {
  if (place.level === "country") return null;
  const ring = places.filter((candidate) => candidate.level === place.level).sort((left, right) => left.sortOrder - right.sortOrder);
  const index = ring.findIndex((candidate) => candidate.id === place.id);
  if (index === -1 || ring.length < 2) return null;
  return { prev: ring[(index - 1 + ring.length) % ring.length]!, next: ring[(index + 1) % ring.length]! };
}
```
Run the route tests: PASS.

- [ ] **Step 3: Failing index and KPI tests.** Create `tests/explorer/demographyPopulationIndex.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationIndexModel, buildPopulationPickerGroups, type PopulationIndexModel } from "../../lib/explorer/demographyPopulationIndex";

let facts: ServedDemographyObservation[];
let regions: MunicipalRegion[];
let municipalities: Municipality[];
let index: PopulationIndexModel;

beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  regions = municipal.regions;
  municipalities = municipal.municipalities;
  index = buildPopulationIndexModel({ facts, regions, municipalities });
});

describe("population index model", () => {
  test("the latest year, Georgia and the map", () => {
    expect(index.year).toBe(2026);
    expect(index.country).toMatchObject({ id: "country.georgia", kind: "country", valueGel: 3_941_103, rank: null });
    expect(index.map.shapes).toHaveLength(60);
    expect(index.map.markers).toHaveLength(5);
  });

  test("64 municipalities ranked by persons: Tbilisi, Batumi, Kutaisi, Rustavi first and Lentekhi last", () => {
    expect(index.municipalities).toHaveLength(64);
    expect(index.municipalities.slice(0, 4).map((row) => [row.id, row.rank, row.valueGel])).toEqual([
      ["04", 1, 1_369_356],
      ["06", 2, 246_267],
      ["20", 3, 153_799],
      ["48", 4, 130_174],
    ]);
    expect(index.municipalities.at(-1)).toMatchObject({ id: "70", rank: 64, valueGel: 5_056 });
    expect(index.municipalities.find((row) => row.id === "11")).toMatchObject({ kind: "municipality", regionId: "region.adjara", valueGel: 16_098 });
    expect(index.municipalities.every((row) => row.budgetPerResidentGel === null)).toBe(true);
  });

  test("11 regions ranked by persons, with their municipality counts", () => {
    expect(index.regions).toHaveLength(11);
    expect(index.regions.map((row) => row.id)).toEqual([
      "region.tbilisi", "region.imereti", "region.kvemo_kartli", "region.adjara", "region.kakheti", "region.samegrelo_zemo_svaneti",
      "region.shida_kartli", "region.samtskhe_javakheti", "region.guria", "region.mtskheta_mtianeti", "region.racha_lechkhumi_kvemo_svaneti",
    ]);
    expect(index.regions[3]).toMatchObject({ id: "region.adjara", rank: 4, valueGel: 413_214 });
    expect(index.regions[3]!.subtitleKa).toContain("6");
  });

  test("the parts add up: the regions and the municipalities each sum to Georgia, Adjara to its six", () => {
    const sum = (rows: { valueGel: number }[]) => rows.reduce((total, row) => total + row.valueGel, 0);
    expect(sum(index.regions)).toBe(index.country.valueGel);
    expect(sum(index.municipalities)).toBe(index.country.valueGel);
    expect(sum(index.municipalities.filter((row) => row.regionId === "region.adjara"))).toBe(413_214);
  });

  test("density by place in the latest density year: Georgia and the regions only", () => {
    expect(index.densityYear).toBe(2026);
    expect(Object.keys(index.densityByPlace)).toHaveLength(12);
    expect(index.densityByPlace["region.tbilisi"]).toBe(2715.7);
    expect(index.densityByPlace["region.adjara"]).toBe(142.5);
    expect(index.densityByPlace["06"]).toBeUndefined();
  });

  test("picker groups: 11 regions in value order, each with its municipalities in value order; Tbilisi lists itself", () => {
    const groups = buildPopulationPickerGroups(index);
    expect(groups).toHaveLength(11);
    expect(groups[0]).toMatchObject({ regionId: "region.tbilisi", valueGel: 1_369_356, members: [{ code: "04", valueGel: 1_369_356 }] });
    const adjara = groups.find((group) => group.regionId === "region.adjara")!;
    expect(adjara.members.map((member) => member.code)).toEqual(["06", "07", "08", "11", "09", "10"]);
    expect(groups.reduce((total, group) => total + group.members.length, 0)).toBe(64);
  });

  test("a missing municipality value is refused", () => {
    const without = facts.filter((fact) => !(fact.geographyId === "33" && fact.year === 2026));
    expect(() => buildPopulationIndexModel({ facts: without, regions, municipalities })).toThrow(/33/);
  });
});
```
(Adjara's members by 2026 value: Batumi 246,267; Kobuleti 73,897; Khelvachauri 51,286; Khulo 16,098; Keda 14,636; Shuakhevi 11,030 — so `["06","07","08","11","09","10"]`.)

Create `tests/explorer/demographyPopulationKpis.test.ts`:

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildPopulationHighlights, buildPopulationModel } from "../../lib/explorer/demographyPopulation";
import { buildPopulationKpis, populationIndexKpis } from "../../lib/explorer/demographyPopulationKpis";
import { formatShare } from "../../lib/explorer/format";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";

let facts: ClientDemographyObservation[];
let places: DemographyPlace[];
const presentations = {} as Record<Locale, Presentation>;

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  for (const locale of ["en", "ka"] as const) presentations[locale] = await getPresentation(locale, ["demography"], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentations.en.englishLabels,
    georgiaNameKa: "საქართველო",
  });
});

const kpis = (placeId: string, locale: Locale = "en") => {
  const model = buildPopulationModel({ facts, places, query: { selectedIds: [placeId], range: { kind: "all" } }, locale });
  return buildPopulationKpis(buildPopulationHighlights(model, facts, places, placeId)!, presentations[locale].messages, locale);
};

describe("population key indicators", () => {
  test("Georgia: the hero and the three side figures", () => {
    const result = kpis(GEORGIA_PLACE_ID);
    expect(result).toMatchObject({ heroLabel: "Population · Georgia", heroValue: "3,941,103", heroBasis: "1 January 2026 · based on the 2024 census" });
    expect(result.side.map((kpi) => [kpi.label, kpi.value, kpi.unit, kpi.detail])).toEqual([
      ["Largest region", "1,369,356", "", `Tbilisi · ${formatShare(1_369_356 / 3_941_103)}`],
      ["Densest region", "2,715.7", "/km²", "Tbilisi"],
      ["Smallest municipality", "5,056", "", "Lentekhi"],
    ]);
  });

  test("the four index tiles carry the density unit in the detail line", () => {
    const tiles = populationIndexKpis(kpis(GEORGIA_PLACE_ID), "persons per km²");
    expect(tiles).toEqual([
      { label: "Population · Georgia", value: "3,941,103", detail: "1 January 2026 · based on the 2024 census" },
      { label: "Largest region", value: "1,369,356", detail: `Tbilisi · ${formatShare(1_369_356 / 3_941_103)}` },
      { label: "Densest region", value: "2,715.7", detail: "Tbilisi · persons per km²" },
      { label: "Smallest municipality", value: "5,056", detail: "Lentekhi" },
    ]);
  });

  test("a region: share of Georgia, rank, density and municipality count", () => {
    const result = kpis("region.adjara");
    expect(result.heroValue).toBe("413,214");
    expect(result.shareLine).toContain(formatShare(413_214 / 3_941_103));
    expect(result.side.map((kpi) => [kpi.label, kpi.value, kpi.unit])).toEqual([
      ["Rank among regions", "4", "/ 11"],
      ["Density", "142.5", "/km²"],
      ["Municipalities", "6", ""],
    ]);
  });

  test("a municipality: share of its region, rank among 64, share of Georgia and its region", () => {
    const result = kpis("06");
    expect(result.heroValue).toBe("246,267");
    expect(result.shareLine).toContain(formatShare(246_267 / 413_214));
    expect(result.side.map((kpi) => [kpi.label, kpi.value, kpi.unit])).toEqual([
      ["Rank among municipalities", "2", "/ 64"],
      ["Share of Georgia", formatShare(246_267 / 3_941_103), ""],
      ["Region", "413,214", ""],
    ]);
    expect(result.side[2]!.detail).toBe("Adjara");
  });

  test("Georgian wording", () => {
    expect(kpis(GEORGIA_PLACE_ID, "ka").heroLabel).toBe("მოსახლეობა · საქართველო");
  });
});
```
Run both: FAIL.

- [ ] **Step 4: Implement the index model.** Create `lib/explorer/demographyPopulationIndex.ts`:

```ts
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import { MUNICIPAL_COUNTRY_ID, type Municipality, type MunicipalRegion } from "../data/municipal/types";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { buildPopulationMunicipalityMap } from "./demographyPopulationMaps";
import type { EntityPickerGroupModel, MunicipalListRow } from "./municipalData";
import type { MunicipalityMapModel } from "./municipalityMapData";

/**
 * What the index lists and draws. The rows are the Budget index's `MunicipalListRow`: its money-named
 * `valueGel` carries persons here, the convention `buildMunicipalityValueMapModel` already uses for the map.
 */
export type PopulationIndexModel = {
  /** The latest year the municipalities have a population for; the map, the rows and the key figures use it. */
  year: number;
  map: MunicipalityMapModel;
  /** The 64 municipalities ranked by persons; Tbilisi is code `04`. */
  municipalities: MunicipalListRow[];
  /** The 11 regions ranked by persons. */
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  /** Persons per km² in the latest density year, for Georgia and the regions only. */
  densityByPlace: Readonly<Record<string, number>>;
  densityYear: number;
};

const ranked = (rows: Array<Omit<MunicipalListRow, "rank">>): MunicipalListRow[] =>
  rows
    .slice()
    .sort((left, right) => right.valueGel - left.valueGel)
    .map((row, index) => ({ ...row, rank: index + 1 }));

export function buildPopulationIndexModel({
  facts,
  regions,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
}): PopulationIndexModel {
  const { year, model: map, values } = buildPopulationMunicipalityMap({ facts, municipalities });
  const population = (id: string): number => {
    const fact = facts.find(
      (candidate) => candidate.seriesId === SERIES.populationTotal && candidate.geographyId === id && candidate.year === year,
    );
    if (!fact) throw new Error(`No ${year} population for ${id}`);
    return fact.value;
  };
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
      valueGel: population(region.id),
      budgetPerResidentGel: null,
    })),
  );
  const country: MunicipalListRow = {
    id: MUNICIPAL_COUNTRY_ID,
    kind: "country",
    nameKa: "საქართველო",
    subtitleKa: `${municipalities.length} მუნიციპალიტეტი`,
    regionId: null,
    valueGel: population(GEORGIA_PLACE_ID),
    budgetPerResidentGel: null,
    rank: null,
  };

  const density = facts.filter((fact) => fact.seriesId === SERIES.populationDensity);
  if (density.length === 0) throw new Error("No density values for the index");
  const densityYear = Math.max(...density.map((fact) => fact.year));
  const densityByPlace = Object.fromEntries(
    density.filter((fact) => fact.year === densityYear).map((fact) => [fact.geographyId, fact.value]),
  );

  return { year, map, municipalities: municipalityRows, regions: regionRows, country, densityByPlace, densityYear };
}

/** The picker's groups: regions in value order, each with its municipalities in value order. Tbilisi lists itself. */
export function buildPopulationPickerGroups(index: Pick<PopulationIndexModel, "municipalities" | "regions">): EntityPickerGroupModel[] {
  return index.regions.map((region) => ({
    regionId: region.id,
    nameKa: region.nameKa,
    valueGel: region.valueGel,
    members: index.municipalities
      .filter((municipality) => municipality.regionId === region.id)
      .map((municipality) => ({ code: municipality.id, nameKa: municipality.nameKa, valueGel: municipality.valueGel })),
  }));
}
```

- [ ] **Step 5: Implement the KPI builder and use it.** Create `lib/explorer/demographyPopulationKpis.ts` by moving the figure-building code out of `population-highlights.tsx`: every label, value, unit, detail and spark computation, unchanged, but returned as data instead of rendered.

```ts
import type { SideKpi } from "../../components/main-explorer/kpi-blocks";
import { message } from "../i18n/messages";
import type { Locale, Messages, TemplateValues } from "../i18n/types";
import { placeColor, placeLabel, type DemographyPlace } from "./demographyAreas";
import { populationBasisKey, type PopulationHighlights } from "./demographyPopulation";
import { formatInUnit, formatShare, MISSING, UNIT_DENSITY, UNIT_PERSONS } from "./format";
import type { MunicipalKpi } from "./municipalData";

type Figure = { place: DemographyPlace; value: number; trend: Array<number | null> };

export type PopulationKpis = {
  heroLabel: string;
  heroValue: string;
  /** `1 January 2026 · based on the 2024 census`. */
  heroBasis: string;
  /** One sentence under the hero: the place's share of Georgia or of its region; empty when there is none. */
  shareLine: string;
  /** Why a figure is missing (a range that ends before regional data starts); empty otherwise. */
  unavailable: string;
  side: SideKpi[];
};

/** The hero and side figures that describe one place for the end year of the range. Nothing here is a change over time. */
export function buildPopulationKpis(highlights: PopulationHighlights, messages: Messages, locale: Locale): PopulationKpis {
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
  return {
    heroLabel: t("heroLabel", { place: name(highlights.place) }),
    heroValue: persons(highlights.persons),
    heroBasis: t("heroBasis", { year: highlights.year, basis: message(messages, populationBasisKey(highlights.year)) }),
    shareLine,
    unavailable: highlights.persons === null && highlights.kind !== "country" ? regionalFromNote : "",
    side,
  };
}

/** The four tiles of the index: Georgia's hero and its three side figures. A unit the tile cannot carry moves into its detail line. */
export function populationIndexKpis(kpis: PopulationKpis, unitInDetail: string): MunicipalKpi[] {
  return [
    { label: kpis.heroLabel, value: kpis.heroValue, detail: kpis.heroBasis },
    ...kpis.side.map((kpi) => ({ label: kpi.label, value: kpi.value, detail: kpi.unit ? `${kpi.detail} · ${unitInDetail}` : kpi.detail })),
  ];
}
```
Declare `let side: SideKpi[]; let shareLine = "";` before the pasted chain as it is in the component today. Then reduce `components/demography/population-highlights.tsx` to the rendering only:

```tsx
"use client";

import { placeColor } from "../../lib/explorer/demographyAreas";
import type { PopulationHighlights } from "../../lib/explorer/demographyPopulation";
import { buildPopulationKpis } from "../../lib/explorer/demographyPopulationKpis";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";

/** The hero and side KPIs the explorers share, describing one place; nothing here is a change over time. */
export function PopulationHighlightsSection({ highlights }: { highlights: PopulationHighlights }) {
  const { locale, messages } = useI18n();
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const kpis = buildPopulationKpis(highlights, messages, locale);
  return (
    <section data-testid="population-highlights" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <SectionTitle>{t("highlights")}</SectionTitle>
        <p className="text-[12.5px] text-[var(--muted)]">{t("rowYear", { year: highlights.year })}</p>
      </div>
      <div className={KPI_GRID_CLASS}>
        <HeroKpi label={kpis.heroLabel} value={kpis.heroValue}>
          <p className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--muted)]">{kpis.heroBasis}</p>
          {kpis.shareLine ? <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">{kpis.shareLine}</p> : null}
          {kpis.unavailable ? <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">{kpis.unavailable}</p> : null}
          <Sparkline values={highlights.trend} color={placeColor(highlights.place)} />
        </HeroKpi>
        <SideKpiList kpis={kpis.side} />
      </div>
      <div className="mt-5"><SourceNote>{t("highlightsNote")}</SourceNote></div>
    </section>
  );
}
```

- [ ] **Step 6: Run and commit.**

```bash
npm run typecheck
npx vitest run tests/explorer/demographyPlaceRoutes.test.ts tests/explorer/demographyPopulationIndex.test.ts tests/explorer/demographyPopulationKpis.test.ts tests/i18n/demographyMessages.test.ts
git add -A
git commit -m "feat(demography): place routes, the index model and key indicators as shared builders"
```
Expected: all pass. If `formatShare` prints differently from the strings you derived, the tests compute it with `formatShare` already; if a label differs from the English message file, the message file wins and the test is corrected.

---

### Task 4: The index page

**Files:**
- Modify: `lib/pages/demography-population.tsx`, `lib/i18n/messages/{ka,en}/demography.json`.
- Test: `tests/explorer/demographyPages.test.tsx`.

**Interfaces:**
- Produces (used by Task 6): `loadPopulationBasics(locale)` → `{ facts: ServedDemographyObservation[]; clientFacts: ClientDemographyObservation[]; municipal; presentation: Presentation; places: DemographyPlace[] }`; `loadPopulationSources(locale)` → `(WorkbookPublicSource & { sourceId: string })[]`; `demographyPopulationPageMetadata(locale)`, `renderDemographyPopulationPage(locale)`.
- Consumes: Tasks 2 and 3.

- [ ] **Step 1: Messages.** Add to both message files:

| Key | ka | en |
| --- | --- | --- |
| `demography.unitShort` | `ადამიანი` | `persons` |
| `demography.densityUnitLong` | `ადამიანი კმ²-ზე` | `persons per km²` |

- [ ] **Step 2: Failing page test.** In `tests/explorer/demographyPages.test.tsx` add at the top, after the existing `vi.mock` of the map definitions: `vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));`, and replace the `describe("population page", ...)` block with:

```tsx
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;

describe("population index page", () => {
  it("is the Budget index layout with population: map, four key figures, 64 and 12 rows, links to place pages, no button row", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain('data-testid="municipal-index-workspace"');
    expect(html).toContain('data-testid="municipality-map"');
    expect(count(html, /data-testid="index-kpi"/g)).toBe(4);
    expect(count(html, /data-testid="municipal-list-row"/g)).toBe(64);
    expect(html).toContain("2004–2026 · as of 1 January");
    expect(html).toContain("persons, on 1 January");
    for (const text of ["3,941,103", "1,369,356", "2,715.7", "5,056", "Lentekhi", "Tbilisi · persons per km²"]) expect(html).toContain(text);
    expect(html).not.toMatch(/₾|GEL|per resident|Regional GDP/);
    expect(html).not.toContain("population-georgia-pill");
    expect(html).not.toContain("population-level-");
    expect(html).not.toContain("population-measure-");
  });

  it("links every row and the map to its own page, Tbilisi to the region page", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    for (const href of [
      "/en/explorer/demography/population/batumi",
      "/en/explorer/demography/population/khulo",
      "/en/explorer/demography/population/region/tbilisi",
      "/en/explorer/demography/population/region/adjara",
      "/en/explorer/demography/population/georgia",
    ]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("/explorer/municipalities/");
    expect(html).not.toContain('href="/en/explorer/demography/population/tbilisi"');
  });

  it("shows density under the region rows and the two notes under the map", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain("2,715.7/km²");
    expect(html).toContain("142.5/km²");
    expect(html).toContain("the maps show the latest year only");
    expect(html).toContain("504.24");
    expect(html).toContain("persons, 1 January 2026");
  });

  it("has a breadcrumb, the methodology link and no dataset markup, download or Georgian text in English", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("en"));
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
    expect(html).not.toContain("/downloads/data/");
    expect(html).toContain('href="/en/methodology/demography"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("renders in Georgian with the same structure", async () => {
    const html = renderToStaticMarkup(await renderDemographyPopulationPage("ka"));
    expect(html).toContain('data-testid="municipal-index-workspace"');
    expect(html).toContain("2004–2026 · 1 იანვრის მდგომარეობით");
    expect(html).toContain('href="/explorer/demography/population/batumi"');
    expect(html).toContain('href="/methodology/demography"');
    expect(html).not.toMatch(/₾|მშპ|ერთ მოსახლეზე/);
  });

  it("has metadata with the page's own canonical address", async () => {
    const metadata = await demographyPopulationPageMetadata("ka");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/population");
    expect(String(metadata.title)).toContain("მოსახლეობა");
  });
});
```
Run: FAIL (the page is still the placeholder).

- [ ] **Step 3: Rewrite the page module.** Replace the body of `lib/pages/demography-population.tsx` (keep `demographyPopulationPageMetadata`) with the shared loaders and the index. Use this structure:

```tsx
import path from "node:path";
import Link from "next/link";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
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
import { POPULATION_PATH, populationHrefById } from "../explorer/demographyPlaceRoutes";
import { buildPopulationHighlights, buildPopulationModel } from "../explorer/demographyPopulation";
import { buildPopulationIndexModel } from "../explorer/demographyPopulationIndex";
import { buildPopulationKpis, populationIndexKpis } from "../explorer/demographyPopulationKpis";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { formatInUnit, UNIT_DENSITY, UNIT_PERSONS } from "../explorer/format";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
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

/** Everything the index and the place pages share: the served facts, the registries, the language and the place list. */
export async function loadPopulationBasics(locale: Locale) {
  const [{ facts }, municipal, georgian] = await Promise.all([
    loadServedDemographyData(),
    loadServedMunicipalData(),
    getMessages("ka", ["demography"]),
  ]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  // `municipal` is loaded for the map's legend text and the list's labels (tabs, search, boundaries).
  const presentation = await getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook", "municipal"], ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: message(georgian, "demography.georgia"),
  });
  return { facts, clientFacts: facts.map(projectDemographyObservation), municipal, presentation, places };
}

/** The reviewed originals the workbook and the source note name, in the page's language. */
export async function loadPopulationSources(locale: Locale): Promise<(WorkbookPublicSource & { sourceId: string })[]> {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(repositoryRoot, "demography"), loadEnglishCatalogue(repositoryRoot)]);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  return manifest.map((source) => {
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
}
```
Delete the file's local `const POPULATION_PATH = ...` (the metadata function now uses the one imported from `demographyPlaceRoutes`), then add the renderer:

```tsx
export async function renderDemographyPopulationPage(locale: Locale) {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const { facts, clientFacts, municipal, presentation, places } = await loadPopulationBasics(locale);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const index = buildPopulationIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
  const georgiaModel = buildPopulationModel({
    facts: clientFacts,
    places,
    query: { selectedIds: [GEORGIA_PLACE_ID], range: { kind: "all" } },
    locale,
  });
  const kpis = populationIndexKpis(
    buildPopulationKpis(buildPopulationHighlights(georgiaModel, clientFacts, places, GEORGIA_PLACE_ID)!, messages, locale),
    t("densityUnitLong"),
  );
  // The density note names Tbilisi's area as the reviewed mapping records it, not as a typed number.
  const densityRows = await loadDensityRows(repositoryRoot, municipal.regions.map((region) => region.id));
  const tbilisiArea = densityRows.areaOf(TBILISI_PLACE_ID).toFixed(2);
  const years = facts.filter((fact) => fact.seriesId === SERIES.populationTotal).map((fact) => fact.year);
  const [start, end] = [Math.min(...years), Math.max(...years)];
  const georgia = places.find((place) => place.id === GEORGIA_PLACE_ID)!;
  const title = t("populationTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(POPULATION_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("coverage", { first: start, last: end })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] text-[13px] text-[var(--body)]">{t("unitLine")}</p>
        <MunicipalitiesIndex
          viewBox={index.map.viewBox}
          shapes={index.map.shapes}
          markers={index.map.markers}
          occupiedAreas={index.map.occupiedAreas}
          legendMin={formatInUnit(index.map.legendMinPerResidentGel, UNIT_PERSONS)}
          legendMax={formatInUnit(index.map.legendMaxPerResidentGel, UNIT_PERSONS)}
          municipalities={index.municipalities}
          regions={index.regions}
          country={index.country}
          kpis={kpis}
          sourceNote={
            <>
              {t("source", { start, end })}{" "}
              <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
                {message(messages, "common.methodology")}
              </Link>
            </>
          }
          overrides={{
            hrefById: populationHrefById(places),
            valueFormat: "persons",
            secondaryById: Object.fromEntries(
              Object.entries(index.densityByPlace).map(([id, value]) => [id, `${formatInUnit(value, UNIT_DENSITY)}${t("densityUnit")}`]),
            ),
            countrySubtitle: message(messages, "municipal.members", { count: georgia.municipalityCount }),
            unitLabel: t("unitShort"),
            mapWording: {
              groupAria: t("mapAria", { measure: t("measurePopulation"), year: index.year }),
              legendCaption: t("mapLegendPopulation", { year: index.year }),
            },
            mapNote: (
              <div className="mt-2 space-y-1">
                <p data-testid="population-map-note" className="text-[11px] leading-relaxed text-[var(--muted)]">{t("mapCensusNote")}</p>
                <p data-testid="population-density-note" className="text-[11px] leading-relaxed text-[var(--muted)]">{t("densityNote", { area: tbilisiArea })}</p>
              </div>
            ),
          }}
        />
      </ExplorerPage>
    </I18nProvider>
  );
}
```
The map-boundary attribution is already inside `MunicipalitiesIndex`'s source note, so the page adds only the Geostat source and the methodology link.

- [ ] **Step 4: Run and commit.**

```bash
npm run typecheck
npx vitest run tests/explorer/demographyPages.test.tsx tests/i18n/demographyMessages.test.ts tests/explorer/demographyHub.test.ts
git add -A
git commit -m "feat(demography): the Population index in the Budget municipalities layout"
```
Expected: all pass. If the English-without-Georgian assertion fails, find the Georgian string in the markup (print the matching element) and fix its source; do not weaken the test.

---

### Task 5: The place page body

**Files:**
- Create: `components/demography/population-place-explorer.tsx`.
- Modify: `lib/i18n/messages/{ka,en}/demography.json`.
- Test: `tests/explorer/populationPlaceExplorer.test.tsx` (new).

**Interfaces:**
- Produces (used by Task 6): `PopulationPlaceExplorer` with props
  `{ place: DemographyPlace; places: DemographyPlace[]; facts: ClientDemographyObservation[]; title: string; metaLine: string; navigation?: EntityNavigation; pickerCountry: EntityPickerCountry; pickerGroups: EntityPickerGroup[]; pickerOverrides?: EntityPickerOverrides; sourceNote: ReactNode; sources: (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; workbookScope: string; backHref: string; children?: ReactNode }`.
- Test ids: `population-place-workspace` (the shell), `population-chart-panel` (with `data-mode`), `population-mode-line`, `population-mode-table`, `population-source-note`, `population-census-note`, `population-excel-download`, `population-highlights`, `population-back-link`; the tick-list uses the standard `series-row` ids.
- Consumes: Tasks 1–3.

- [ ] **Step 1: Messages.** Add to both message files:

| Key | ka | en |
| --- | --- | --- |
| `demography.placeHeading` | `მოსახლეობა —` | `Population —` |
| `demography.backToIndex` | `← მოსახლეობა` | `← Population` |

- [ ] **Step 2: Failing component tests.** Create `tests/explorer/populationPlaceExplorer.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { PopulationPlaceExplorer } from "../../components/demography/population-place-explorer";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { MUNICIPAL_COUNTRY_ID } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { projectDemographyObservation } from "../../lib/explorer/clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { populationHrefById } from "../../lib/explorer/demographyPlaceRoutes";
import { buildPopulationIndexModel, buildPopulationPickerGroups } from "../../lib/explorer/demographyPopulationIndex";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";

const GEORGIAN = /\p{Script=Georgian}/u;
let facts: ClientDemographyObservation[];
const presentations = {} as Record<Locale, Presentation>;
const placesBy = {} as Record<Locale, DemographyPlace[]>;
let index: ReturnType<typeof buildPopulationIndexModel>;

beforeAll(async () => {
  const [{ facts: served }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.map(projectDemographyObservation);
  index = buildPopulationIndexModel({ facts: served, regions: municipal.regions, municipalities: municipal.municipalities });
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((r) => r.id), ...municipal.municipalities.map((m) => m.code)];
  for (const locale of ["en", "ka"] as const) {
    presentations[locale] = await getPresentation(locale, ["demography", "common", "controls", "main", "format", "workbook", "municipal"], ids);
    placesBy[locale] = buildDemographyPlaces({
      regions: municipal.regions,
      municipalities: municipal.municipalities,
      englishLabels: presentations[locale].englishLabels,
      georgiaNameKa: "საქართველო",
    });
  }
});

function render(placeId: string, locale: Locale = "en", withNavigation = false): string {
  const places = placesBy[locale];
  const place = places.find((candidate) => candidate.id === placeId)!;
  return renderToStaticMarkup(
    <I18nProvider {...presentations[locale]}>
      <PopulationPlaceExplorer
        place={place}
        places={places}
        facts={facts}
        title="Population —"
        metaLine="the meta line"
        navigation={withNavigation ? { prev: { label: "Before", href: "/a" }, next: { label: "After", href: "/b" } } : undefined}
        pickerCountry={{ id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო", valueGel: index.country.valueGel, budgetCount: 64 }}
        pickerGroups={buildPopulationPickerGroups(index)}
        pickerOverrides={{ hrefById: populationHrefById(places), valueFormat: "persons", countryDetail: "64 municipalities" }}
        sourceNote="Source: Geostat"
        sources={[]}
        siteOrigin="https://fiscal.ge"
        workbookScope="test"
        backHref="/explorer/demography/population"
      />
    </I18nProvider>,
  );
}
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;
const tagOf = (html: string, testId: string) => html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? "";

describe("place page body: Georgia", () => {
  const html = () => render(GEORGIA_PLACE_ID);

  test("the heading, the shell and the tick-list of Georgia and its 11 regions with Georgia ticked", () => {
    expect(html()).toContain('data-testid="entity-picker-trigger"');
    expect(html()).toContain("Population —");
    expect(html()).toContain('data-testid="population-place-workspace"');
    expect(count(html(), /data-testid="series-row"/g)).toBe(12);
    expect(html()).toMatch(/>1\s*\/\s*12</);
    expect(html()).toContain("3,941,103");
    expect(html()).toContain("1,369,356");
  });

  test("the chart draws the labelled census gap, the range strip marks it and the note says why", () => {
    expect(html()).toContain('role="img"');
    expect(tagOf(html(), "population-mode-line")).toContain('aria-pressed="true"');
    expect(count(html(), /data-testid="chart-break"/g)).toBe(1);
    expect(count(html(), /Census re-base/g)).toBeGreaterThanOrEqual(2);
    expect(html()).toContain("226,000");
    expect(html()).toContain("Geostat re-based the population to the 2024 census");
  });

  test("key indicators for Georgia, no change figure, an enabled download, the source and the way back", () => {
    expect(html()).toContain('data-testid="population-highlights"');
    expect(html()).toContain("Largest region");
    expect(html()).toContain("Densest region");
    expect(html()).toContain("Smallest municipality");
    expect(html()).not.toMatch(/[+−]\d+(\.\d+)?%/);
    expect(html()).toContain('data-testid="population-excel-download"');
    expect(html()).not.toMatch(/data-testid="population-excel-download"[^>]*disabled=""/);
    expect(html()).toContain("Source: Geostat");
    expect(html()).toContain('href="/en/explorer/demography/population"');
    expect(html()).toContain("← Population");
  });

  test("previous/next only when given", () => {
    expect(html()).not.toContain('data-testid="municipal-entity-navigation"');
    expect(render(GEORGIA_PLACE_ID, "en", true)).toContain('data-testid="municipal-entity-navigation"');
  });

  test("English carries no Georgian text", () => {
    expect(html()).not.toMatch(GEORGIAN);
  });
});

describe("place page body: a region, a municipality and Tbilisi", () => {
  test("Adjara: the tick-list is Adjara and its six municipalities, Adjara ticked", () => {
    const html = render("region.adjara");
    expect(count(html, /data-testid="series-row"/g)).toBe(7);
    expect(html).toMatch(/>1\s*\/\s*7</);
    for (const text of ["413,214", "246,267", "73,897", "16,098", "Batumi", "Khulo"]) expect(html).toContain(text);
    expect(html).toContain("Rank among regions");
    expect(html).toContain("Density");
  });

  test("Batumi: only itself in the tick-list, with its rank among 64 and its share of Adjara", () => {
    const html = render("06");
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
    expect(html).toMatch(/>1\s*\/\s*1</);
    expect(html).toContain("Rank among municipalities");
    expect(html).toContain("/ 64");
    expect(html).toContain("246,267");
  });

  test("Tbilisi is a region with no parts", () => {
    const html = render("region.tbilisi");
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
    expect(html).toContain("1,369,356");
    expect(html).toContain("Rank among regions");
  });

  test("the Georgian page uses the Georgian wording", () => {
    const html = render("06", "ka");
    expect(html).toContain("აღწერით გადათვლა");
    expect(html).toContain("ბათუმი");
  });
});
```
Run: FAIL (component missing).

- [ ] **Step 3: Implement the component.** Create `components/demography/population-place-explorer.tsx`. It is the Budget place page's workspace written over population, using the shared shell pieces and `useMunicipalState`. The complete file:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CENSUS_STEP, SERIES } from "../../lib/data/demography/series";
import { partsOf, placeColor, placeIdForMunicipalityCode, placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildPopulationHighlights, buildPopulationModel, populationBasisKey } from "../../lib/explorer/demographyPopulation";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { formatInUnit, thousandsUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { EntityHeading, type EntityNavigation } from "../municipalities/entity-heading";
import type { EntityPickerCountry, EntityPickerGroup, EntityPickerOverrides } from "../municipalities/entity-picker";
import { EntityWorkspaceShell } from "../municipalities/entity-workspace-shell";
import { useMunicipalState } from "../municipalities/use-municipal-state";
import { Callout, SegmentedTabs } from "../ui/editorial";
import { PopulationHighlightsSection } from "./population-highlights";

export function PopulationPlaceExplorer({
  place,
  places,
  facts,
  title,
  metaLine,
  navigation,
  pickerCountry,
  pickerGroups,
  pickerOverrides,
  sourceNote,
  sources,
  siteOrigin,
  workbookScope,
  backHref,
  children,
}: {
  place: DemographyPlace;
  places: DemographyPlace[];
  facts: ClientDemographyObservation[];
  title: string;
  metaLine: string;
  navigation?: EntityNavigation;
  pickerCountry: EntityPickerCountry;
  pickerGroups: EntityPickerGroup[];
  pickerOverrides?: EntityPickerOverrides;
  sourceNote: ReactNode;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  /** The place named in the Excel file (`batumi`, `region-adjara`, `georgia`). */
  workbookScope: string;
  backHref: string;
  children?: ReactNode;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  useAppReady();

  const parts = useMemo(() => partsOf(place, places), [place, places]);
  const listedIds = useMemo(() => new Set([place.id, ...parts.map((part) => part.id)]), [place, parts]);
  // The years of the place itself: Georgia 2004–2026, everything else 2015–2026. Its parts never reach further.
  const allYears = useMemo(
    () =>
      [...new Set(facts
        .filter((fact) => fact.seriesId === SERIES.populationTotal && placeIdForMunicipalityCode(fact.geographyId) === place.id)
        .map((fact) => fact.year))].sort((left, right) => left - right),
    [facts, place],
  );
  const state = useMunicipalState(allYears, [place.id], listedIds);
  const model = useMemo(
    () =>
      buildPopulationModel({
        facts,
        places,
        query: { selectedIds: state.selectedIds, range: { kind: "manual", start: state.range.start, end: state.range.end } },
        locale,
      }),
    [facts, places, state.selectedIds, state.range.start, state.range.end, locale],
  );
  const highlights = useMemo(() => buildPopulationHighlights(model, facts, places, place.id), [model, facts, places, place.id]);
  // The tick-list: the place first, then its parts, all in the order the model ranks them.
  const listed = useMemo(() => model.ranked.filter((candidate) => listedIds.has(candidate.id)), [model, listedIds]);

  const [seriesQuery, setSeriesQuery] = useState("");
  const regionOf = (candidate: DemographyPlace) => (candidate.regionId === null ? undefined : places.find((other) => other.id === candidate.regionId));
  const matches = (candidate: DemographyPlace) =>
    matchesLabelQuery(seriesQuery, [candidate.nameKa, candidate.nameEn, regionOf(candidate)?.nameKa ?? "", regionOf(candidate)?.nameEn ?? ""]);
  const visible = listed.filter((candidate) => candidate.id === place.id || matches(candidate));
  const hasSelection = state.selectedIds.length > 0;
  const breakLabel = t("breakLabel");
  const rebase = formatInUnit(Math.round(CENSUS_STEP.residual / 1000) * 1000, UNIT_PERSONS);
  const placeRow = model.rows.find((row) => row.itemId === place.id) ?? null;

  return (
    <>
      <EntityHeading
        title={title}
        triggerLabel={placeLabel(place, locale)}
        metaLine={metaLine}
        entityId={place.id}
        navigation={navigation}
        pickerCountry={pickerCountry}
        pickerGroups={pickerGroups}
        pickerOverrides={pickerOverrides}
      />
      <p role="status" className="sr-only">{t("rangeChanged", { start: model.range.start, end: model.range.end })}</p>
      <EntityWorkspaceShell
        testId="population-place-workspace"
        main={
          <>
            <section data-testid="population-chart-panel" data-mode={state.chartMode}>
              <div className="mb-[18px] flex flex-col items-start gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-5">
                <SegmentedTabs<ChartMode>
                  ariaLabel={message(messages, "municipal.viewMode")}
                  value={state.chartMode}
                  onChange={state.setChartMode}
                  options={[
                    { value: "line", label: message(messages, "municipal.line"), testId: "population-mode-line" },
                    { value: "table", label: message(messages, "municipal.table"), testId: "population-mode-table" },
                  ]}
                />
                <span className="min-w-0 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">{t("unitLine")}</span>
              </div>
              {!hasSelection ? (
                <div className="mt-5"><Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout></div>
              ) : !model.hasData ? (
                <div className="mt-5"><Callout testId="no-range-data-callout">{message(messages, "main.noRangeData")}</Callout></div>
              ) : state.chartMode === "line" ? (
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
              ) : (
                <ExplorerTable
                  caption={`${t("tableCaption")} · ${model.range.start}–${model.range.end} · ${t("censusNote", { count: rebase })}`}
                  rows={model.rows.filter((row) => row.itemId !== place.id)}
                  totalRow={placeRow}
                  showTotal={placeRow !== null}
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
              <div className="mt-6 border-t border-[var(--hairline-soft)] pt-4">
                <RangeStrip
                  years={allYears}
                  range={state.range}
                  marker={{ year: CENSUS_STEP.toYear, label: breakLabel, labelSide: "auto" }}
                  onChange={state.setRange}
                />
              </div>
            </section>
            <div data-testid="population-source-note" className="mt-5 max-w-[640px] text-[11.5px] leading-relaxed text-[var(--muted)]">{sourceNote}</div>
            <p
              data-testid="population-census-note"
              className="mt-5 max-w-[740px] border-l-2 border-[var(--accent)] bg-[var(--tint)] px-4 py-3 text-[13px] leading-[1.65] text-[var(--body)]"
            >
              {t("censusNote", { count: rebase })}
            </p>
            {children}
          </>
        }
        aside={
          <>
            <SeriesSelector
              query={seriesQuery}
              onQueryChange={setSeriesQuery}
              searchPlaceholder={message(messages, "municipal.search")}
              selectedCount={state.selectedIds.length}
              totalCount={listed.length}
              hasSelection={hasSelection}
              allSelected={listed.every((candidate) => state.selectedIds.includes(candidate.id))}
              onToggleAll={() => state.setSelectedIds(hasSelection ? [] : listed.map((candidate) => candidate.id))}
              hasVisibleMatches={listed.some(matches)}
            >
              {visible.map((candidate) => (
                <SeriesSelectorRow
                  key={candidate.id}
                  id={candidate.id}
                  label={placeLabel(candidate, locale)}
                  color={placeColor(candidate)}
                  value={formatInUnit(model.endValues[candidate.id] ?? null, UNIT_PERSONS)}
                  selected={state.selectedIds.includes(candidate.id)}
                  level={candidate.id === place.id ? "total" : "category"}
                  wrapLabel
                  onToggle={() => state.toggleSeries(candidate.id)}
                />
              ))}
            </SeriesSelector>
            <ExcelDownloadButton
              testId="population-excel-download"
              disabled={!hasSelection || !model.hasData}
              onDownload={async () => {
                const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
                await downloadWorkbook(
                  buildPopulationWorkbookExportModel(
                    facts,
                    places,
                    { selectedIds: state.selectedIds, range: { kind: "manual", start: state.range.start, end: state.range.end } },
                    presentation,
                    sources,
                    siteOrigin,
                    workbookScope,
                  ),
                );
              }}
            />
            <Link
              href={pageHref(backHref, locale)}
              data-testid="population-back-link"
              className="mt-3.5 block text-[12px] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
            >
              {t("backToIndex")}
            </Link>
          </>
        }
      />
      {highlights ? <PopulationHighlightsSection highlights={highlights} /> : null}
    </>
  );
}
```
Notes for the implementer: (a) `useMunicipalState` returns `chartMode`, `setChartMode`, `range`, `setRange`, `selectedIds`, `setSelectedIds`, `toggleSeries`; `share` is never set by this page. (b) The census note is the paragraph, so `population-census-note` is that element; the table caption keeps its own copy. (c) If `ExplorerTable`'s `caption` is rendered visibly, keep it as in the first build. (d) If the Budget `SeriesSelector` shows the search box even for one row, keep it; do not special-case.

- [ ] **Step 4: Run and commit.**

```bash
npm run typecheck
npx vitest run tests/explorer/populationPlaceExplorer.test.tsx tests/i18n/demographyMessages.test.ts
git add -A
git commit -m "feat(demography): the place page body in the Budget place-page shell"
```
Expected: all pass. The i18n test scans this file for `t("key")` and `"demography.key"`, so every key it asks for must exist in both message files.

---

### Task 6: The place pages and their routes

**Files:**
- Create: `lib/pages/demography-population-place.tsx`; `app/(ka)/explorer/demography/population/georgia/page.tsx`, `region/[id]/page.tsx`, `[slug]/page.tsx`; `app/(en)/en/explorer/demography/population/georgia/page.tsx`, `region/[id]/page.tsx`, `[slug]/page.tsx`.
- Modify: `lib/i18n/messages/{ka,en}/demography.json`.
- Test: `tests/explorer/populationPlacePages.test.tsx` (new).

**Interfaces:**
- Produces (used by Tasks 7–8): `type PopulationPlaceRoute = { kind: "country" } | { kind: "region"; id: string } | { kind: "municipality"; slug: string }`; `populationPlaceMetadata(route, locale)`, `renderPopulationPlacePage(route, locale)`, `populationRegionParams()`, `populationMunicipalityParams()`.
- Consumes: Tasks 3–5 (`loadPopulationBasics`, `loadPopulationSources`, the place routes, the index model, `PopulationPlaceExplorer`, `EntityMemberList`).

- [ ] **Step 1: Messages.** Add to both message files (`metaRegionOne` has the same Georgian text as `metaRegion`; English needs the singular):

| Key | ka | en |
| --- | --- | --- |
| `demography.metaCountry` | `{regions} რეგიონი · {municipalities} მუნიციპალიტეტი · {first}–{last}` | `{regions} regions · {municipalities} municipalities · {first}–{last}` |
| `demography.metaRegion` | `{members} მუნიციპალიტეტი · {rank} ადგილი {count}-დან · 1 იანვარი {year}` | `{members} municipalities · Rank {rank} of {count} · 1 January {year}` |
| `demography.metaRegionOne` | `{members} მუნიციპალიტეტი · {rank} ადგილი {count}-დან · 1 იანვარი {year}` | `{members} municipality · Rank {rank} of {count} · 1 January {year}` |
| `demography.metaMunicipality` | `{region} · {rank} ადგილი {count}-დან · 1 იანვარი {year}` | `{region} · Rank {rank} of {count} · 1 January {year}` |
| `demography.placeMetaTitle` | `{name} — მოსახლეობა` | `{name} — Population` |
| `demography.placeMetaDescription` | `{name}: მოსახლეობა 1 იანვრის მდგომარეობით, {first}–{last}, საქსტატის მონაცემებით.` | `{name}: population on 1 January, {first}–{last}, from Geostat data.` |

- [ ] **Step 2: Failing page tests.** Create `tests/explorer/populationPlacePages.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
// notFound() stays real so an unknown place really is "not found"; only the router hooks are stubbed.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push() {} }),
  usePathname: () => "/",
}));

import {
  populationMunicipalityParams,
  populationPlaceMetadata,
  populationRegionParams,
  renderPopulationPlacePage,
} from "../../lib/pages/demography-population-place";

const GEORGIAN = /\p{Script=Georgian}/u;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;
const page = async (route: Parameters<typeof renderPopulationPlacePage>[0], locale: "ka" | "en" = "en") =>
  renderToStaticMarkup(await renderPopulationPlacePage(route, locale));

describe("route parameters", () => {
  it("are the 11 regions and the 63 municipalities, closed sets", async () => {
    const regions = (await populationRegionParams()).map((param) => param.id).sort();
    expect(regions).toEqual([
      "adjara", "guria", "imereti", "kakheti", "kvemo_kartli", "mtskheta_mtianeti",
      "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti", "shida_kartli", "tbilisi",
    ]);
    const slugs = populationMunicipalityParams().map((param) => param.slug);
    expect(slugs).toHaveLength(63);
    expect(slugs).not.toContain("tbilisi");
  });
});

describe("place pages", () => {
  it("Georgia: no neighbours, 12 tick-list rows, the 64-municipality meta line and a breadcrumb", async () => {
    const html = await page({ kind: "country" });
    expect(html).toContain('data-testid="population-place-workspace"');
    expect(html).not.toContain('data-testid="municipal-entity-navigation"');
    expect(count(html, /data-testid="series-row"/g)).toBe(12);
    expect(html).toContain("11 regions · 64 municipalities · 2004–2026");
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).not.toContain("region-member-row");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a region: Adjara has neighbours, its six municipalities as links and its rank", async () => {
    const html = await page({ kind: "region", id: "adjara" });
    expect(count(html, /data-testid="series-row"/g)).toBe(7);
    expect(count(html, /data-testid="region-member-row"/g)).toBe(6);
    expect(html).toContain("Municipalities in this region");
    expect(html).toContain('href="/en/explorer/demography/population/batumi"');
    expect(html).toContain("6 municipalities · Rank 4 of 11 · 1 January 2026");
    expect(html).toContain('data-testid="municipal-entity-navigation"');
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a municipality: Batumi's meta line names its region, the crumbs link to the region page and nothing is below it", async () => {
    const html = await page({ kind: "municipality", slug: "batumi" });
    expect(html).toContain("Adjara · Rank 2 of 64 · 1 January 2026");
    expect(html).toContain('href="/en/explorer/demography/population/region/adjara"');
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
    expect(html).not.toContain("region-member-row");
    expect(html).toContain('data-testid="municipal-entity-navigation"');
  });

  it("Tbilisi is a region page with the singular count and no member rows", async () => {
    const html = await page({ kind: "region", id: "tbilisi" });
    expect(html).toContain("1 municipality · Rank 1 of 11 · 1 January 2026");
    expect(html).not.toContain("region-member-row");
    expect(count(html, /data-testid="series-row"/g)).toBe(1);
  });

  it("renders in Georgian with the Georgian ordinal", async () => {
    const html = await page({ kind: "municipality", slug: "batumi" }, "ka");
    expect(html).toContain("მე-2 ადგილი 64-დან · 1 იანვარი 2026");
    expect(html).toContain('href="/explorer/demography/population/region/adjara"');
  });

  it("carries no dataset markup and no download link", async () => {
    for (const route of [{ kind: "country" }, { kind: "region", id: "imereti" }, { kind: "municipality", slug: "khulo" }] as const) {
      const html = await page(route);
      expect(html).not.toContain('data-testid="explorer-dataset-json-ld"');
      expect(html).not.toContain("/downloads/data/");
      expect(html).toContain('href="/en/methodology/demography"');
    }
  });

  it("an unknown region, an unknown slug and Tbilisi's municipality slug are not found", async () => {
    await expect(renderPopulationPlacePage({ kind: "region", id: "nowhere" }, "en")).rejects.toThrow();
    await expect(renderPopulationPlacePage({ kind: "municipality", slug: "nowhere" }, "en")).rejects.toThrow();
    await expect(renderPopulationPlacePage({ kind: "municipality", slug: "tbilisi" }, "en")).rejects.toThrow();
  });
});

describe("place metadata", () => {
  it("has the page's own canonical address and reciprocal alternates in both languages", async () => {
    const en = await populationPlaceMetadata({ kind: "municipality", slug: "batumi" }, "en");
    expect(en.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/demography/population/batumi");
    expect(en.alternates?.languages).toMatchObject({
      ka: "https://fiscal.ge/explorer/demography/population/batumi",
      en: "https://fiscal.ge/en/explorer/demography/population/batumi",
    });
    expect(String(en.title)).toContain("Batumi");
    const ka = await populationPlaceMetadata({ kind: "region", id: "adjara" }, "ka");
    expect(ka.alternates?.canonical).toBe("https://fiscal.ge/explorer/demography/population/region/adjara");
    expect(String(ka.title)).toContain("მოსახლეობა");
    const georgia = await populationPlaceMetadata({ kind: "country" }, "en");
    expect(georgia.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/demography/population/georgia");
  });
});
```
Run: FAIL (module missing).

- [ ] **Step 3: Implement the page module.** Create `lib/pages/demography-population-place.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { PopulationPlaceExplorer } from "../../components/demography/population-place-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { EntityMemberList } from "../../components/municipalities/entity-member-list";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { SERIES } from "../data/demography/series";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { loadServedMunicipalData } from "../data/servedData";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, placeIdForMunicipalityCode, placeLabel, type DemographyPlace } from "../explorer/demographyAreas";
import {
  POPULATION_PATH,
  placeNeighbours,
  populationHrefById,
  populationMunicipalityCodeForSlug,
  populationMunicipalitySlugs,
  populationPlaceHref,
} from "../explorer/demographyPlaceRoutes";
import { buildPopulationHighlights, buildPopulationModel } from "../explorer/demographyPopulation";
import { buildPopulationIndexModel, buildPopulationPickerGroups } from "../explorer/demographyPopulationIndex";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { formatInUnit, UNIT_PERSONS } from "../explorer/format";
import { municipalRankLabel } from "../explorer/municipalLabels";
import { message } from "../i18n/messages";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationBasics, loadPopulationSources } from "./demography-population";

export type PopulationPlaceRoute = { kind: "country" } | { kind: "region"; id: string } | { kind: "municipality"; slug: string };

export async function populationRegionParams() {
  const { regions } = await loadServedMunicipalData();
  return regions.map((region) => ({ id: region.id.replace("region.", "") }));
}

export function populationMunicipalityParams() {
  return populationMunicipalitySlugs().map((slug) => ({ slug }));
}

/** The place a route names, or null: Georgia, `region.{id}`, or the municipality behind a slug (never Tbilisi's). */
function placeIdFor(route: PopulationPlaceRoute): string | null {
  if (route.kind === "country") return GEORGIA_PLACE_ID;
  if (route.kind === "region") return `region.${route.id}`;
  return populationMunicipalityCodeForSlug(route.slug);
}

function workbookScopeFor(route: PopulationPlaceRoute): string {
  if (route.kind === "country") return "georgia";
  return route.kind === "region" ? `region-${route.id}` : route.slug;
}

const yearsOf = (facts: readonly { seriesId: string; geographyId: string; year: number }[], place: DemographyPlace) =>
  [...new Set(facts
    .filter((fact) => fact.seriesId === SERIES.populationTotal && placeIdForMunicipalityCode(fact.geographyId) === place.id)
    .map((fact) => fact.year))].sort((left, right) => left - right);

export async function populationPlaceMetadata(route: PopulationPlaceRoute, locale: Locale) {
  const { clientFacts, presentation, places } = await loadPopulationBasics(locale);
  const place = places.find((candidate) => candidate.id === placeIdFor(route));
  if (!place) notFound();
  const years = yearsOf(clientFacts, place);
  const t = (key: string, values?: TemplateValues) => message(presentation.messages, `demography.${key}`, values);
  const name = placeLabel(place, locale);
  return fiscalMetadata({
    locale,
    path: populationPlaceHref(place.id),
    title: `${t("placeMetaTitle", { name })} | Fiscal.ge`,
    description: t("placeMetaDescription", { name, first: years[0]!, last: years.at(-1)! }),
  });
}

export async function renderPopulationPlacePage(route: PopulationPlaceRoute, locale: Locale) {
  const [{ facts, clientFacts, municipal, presentation, places }, sources] = await Promise.all([
    loadPopulationBasics(locale),
    loadPopulationSources(locale),
  ]);
  const place = places.find((candidate) => candidate.id === placeIdFor(route));
  if (!place) notFound();
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const years = yearsOf(clientFacts, place);
  const [first, last] = [years[0]!, years.at(-1)!];
  const index = buildPopulationIndexModel({ facts, regions: municipal.regions, municipalities: municipal.municipalities });
  const model = buildPopulationModel({ facts: clientFacts, places, query: { selectedIds: [place.id], range: { kind: "all" } }, locale });
  const highlights = buildPopulationHighlights(model, clientFacts, places, place.id)!;
  const rank = (value: number | null) => municipalRankLabel(value ?? 0, locale);

  let metaLine: string;
  if (highlights.kind === "country") {
    metaLine = t("metaCountry", { regions: places.filter((candidate) => candidate.level === "region").length, municipalities: place.municipalityCount, first, last });
  } else if (highlights.kind === "region") {
    metaLine = t(place.municipalityCount === 1 ? "metaRegionOne" : "metaRegion", {
      members: place.municipalityCount, rank: rank(highlights.rank), count: highlights.ofRegions, year: highlights.year,
    });
  } else {
    metaLine = t("metaMunicipality", {
      region: highlights.region ? placeLabel(highlights.region, locale) : "", rank: rank(highlights.rank), count: highlights.ofMunicipalities, year: highlights.year,
    });
  }

  const populationTitle = t("populationTitle");
  const region = highlights.kind === "municipality" ? highlights.region : null;
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: populationTitle, href: pageHref(POPULATION_PATH, locale) },
    ...(region ? [{ label: placeLabel(region, locale), href: pageHref(populationPlaceHref(region.id), locale) }] : []),
    { label: placeLabel(place, locale) },
  ];
  const neighbours = placeNeighbours(place, places);
  const navigation = neighbours
    ? {
        prev: { label: placeLabel(neighbours.prev, locale), href: pageHref(populationPlaceHref(neighbours.prev.id), locale) },
        next: { label: placeLabel(neighbours.next, locale), href: pageHref(populationPlaceHref(neighbours.next.id), locale) },
      }
    : undefined;
  const georgia = places.find((candidate) => candidate.id === GEORGIA_PLACE_ID)!;
  const memberRows =
    place.level === "region" && place.id !== TBILISI_PLACE_ID
      ? index.municipalities
          .filter((row) => row.regionId === place.id)
          .map((row, position) => ({
            id: row.id,
            href: pageHref(populationPlaceHref(row.id), locale),
            rank: position + 1,
            label: placeLabel(places.find((candidate) => candidate.id === row.id)!, locale),
            value: formatInUnit(row.valueGel, UNIT_PERSONS),
          }))
      : [];

  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: populationTitle, path: pageHref(POPULATION_PATH, locale) },
          ...(region ? [{ name: placeLabel(region, locale), path: pageHref(populationPlaceHref(region.id), locale) }] : []),
          { name: placeLabel(place, locale), path: pageHref(populationPlaceHref(place.id), locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("coverage", { first, last })} />
        <PopulationPlaceExplorer
          place={place}
          places={places}
          facts={clientFacts}
          title={t("placeHeading")}
          metaLine={metaLine}
          navigation={navigation}
          pickerCountry={{ id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო", valueGel: index.country.valueGel, budgetCount: georgia.municipalityCount }}
          pickerGroups={buildPopulationPickerGroups(index)}
          pickerOverrides={{
            hrefById: populationHrefById(places),
            valueFormat: "persons",
            countryDetail: `${formatInUnit(index.country.valueGel, UNIT_PERSONS)} · ${message(messages, "municipal.members", { count: georgia.municipalityCount })}`,
          }}
          sourceNote={
            <>
              {t("source", { start: first, end: last })}{" "}
              <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
                {message(messages, "common.methodology")}
              </Link>
            </>
          }
          sources={sources}
          siteOrigin={resolveSiteUrl()}
          workbookScope={workbookScopeFor(route)}
          backHref={POPULATION_PATH}
        >
          {memberRows.length > 0 ? <EntityMemberList heading={message(messages, "municipal.regionMembers")} rows={memberRows} /> : null}
        </PopulationPlaceExplorer>
      </ExplorerPage>
    </I18nProvider>
  );
}
```

- [ ] **Step 4: Route files.** Georgian (each import path counts the directory levels from the file up to `apps/web`):

`app/(ka)/explorer/demography/population/georgia/page.tsx`
```tsx
import { populationPlaceMetadata, renderPopulationPlacePage } from "../../../../../../lib/pages/demography-population-place";

export function generateMetadata() {
  return populationPlaceMetadata({ kind: "country" }, "ka");
}

export default function Page() {
  return renderPopulationPlacePage({ kind: "country" }, "ka");
}
```
`app/(ka)/explorer/demography/population/region/[id]/page.tsx`
```tsx
import { populationPlaceMetadata, populationRegionParams, renderPopulationPlacePage } from "../../../../../../../lib/pages/demography-population-place";

type Props = { params: Promise<{ id: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return populationRegionParams(); }
export async function generateMetadata({ params }: Props) { return populationPlaceMetadata({ kind: "region", id: (await params).id }, "ka"); }
export default async function Page({ params }: Props) { return renderPopulationPlacePage({ kind: "region", id: (await params).id }, "ka"); }
```
`app/(ka)/explorer/demography/population/[slug]/page.tsx`
```tsx
import { populationMunicipalityParams, populationPlaceMetadata, renderPopulationPlacePage } from "../../../../../../lib/pages/demography-population-place";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return populationMunicipalityParams(); }
export async function generateMetadata({ params }: Props) { return populationPlaceMetadata({ kind: "municipality", slug: (await params).slug }, "ka"); }
export default async function Page({ params }: Props) { return renderPopulationPlacePage({ kind: "municipality", slug: (await params).slug }, "ka"); }
```
The English files, under `app/(en)/en/explorer/demography/population/` (one more `../` in each import than the Georgian ones):

`georgia/page.tsx`
```tsx
import { populationPlaceMetadata, renderPopulationPlacePage } from "../../../../../../../lib/pages/demography-population-place";

export function generateMetadata() {
  return populationPlaceMetadata({ kind: "country" }, "en");
}

export default function Page() {
  return renderPopulationPlacePage({ kind: "country" }, "en");
}
```
`region/[id]/page.tsx`
```tsx
import { populationPlaceMetadata, populationRegionParams, renderPopulationPlacePage } from "../../../../../../../../lib/pages/demography-population-place";

type Props = { params: Promise<{ id: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return populationRegionParams(); }
export async function generateMetadata({ params }: Props) { return populationPlaceMetadata({ kind: "region", id: (await params).id }, "en"); }
export default async function Page({ params }: Props) { return renderPopulationPlacePage({ kind: "region", id: (await params).id }, "en"); }
```
`[slug]/page.tsx`
```tsx
import { populationMunicipalityParams, populationPlaceMetadata, renderPopulationPlacePage } from "../../../../../../../lib/pages/demography-population-place";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return populationMunicipalityParams(); }
export async function generateMetadata({ params }: Props) { return populationPlaceMetadata({ kind: "municipality", slug: (await params).slug }, "en"); }
export default async function Page({ params }: Props) { return renderPopulationPlacePage({ kind: "municipality", slug: (await params).slug }, "en"); }
```

- [ ] **Step 5: Run and commit.**

```bash
npm run typecheck
npx vitest run tests/explorer/populationPlacePages.test.tsx tests/i18n/demographyMessages.test.ts tests/explorer/populationPlaceExplorer.test.tsx
git add -A
git commit -m "feat(demography): one Population page for Georgia, each region and each municipality"
```
Expected: pass. If `npm run typecheck` reports stale `.next/dev/types` route errors, delete `apps/web/.next/dev` and re-run (known trap), not the code.

---

### Task 7: Discovery: sitemap, inventory and revisions

**Files:**
- Modify: `lib/seo/sitemap.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json`.
- Test: `tests/explorer/demographyDiscovery.test.ts`; then every pinned count the new URLs move.

- [ ] **Step 1: Failing test.** In `tests/explorer/demographyDiscovery.test.ts` add the imports `loadServedMunicipalData` from `../../lib/data/servedData` and `populationPlacePaths` from `../../lib/explorer/demographyPlaceRoutes`, add `"/explorer/demography/population/batumi"` to the list in the `"dates the Georgian pages ..."` test, and add:

```ts
  it("indexes all 75 place pages in both languages with real English dates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [{ regions }, paths, revisions, entries] = await Promise.all([loadServedMunicipalData(), listPublicPagePaths(), loadPageRevisions(), sitemap()]);
      const placePaths = populationPlacePaths(regions.map((region) => region.id));
      expect(placePaths).toHaveLength(75);
      for (const path of placePaths) {
        expect(paths, path).toContain(path);
        expect(revisions[path], path).toMatch(/^2026-\d{2}-\d{2}$/);
        const ka = entries.find((entry) => entry.url === `https://fiscal.ge${path}`);
        const en = entries.find((entry) => entry.url === `https://fiscal.ge/en${path}`);
        expect(ka?.alternates?.languages, path).toEqual({ ka: `https://fiscal.ge${path}`, en: `https://fiscal.ge/en${path}`, "x-default": `https://fiscal.ge${path}` });
        expect(en?.alternates, path).toEqual(ka?.alternates);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
```
Run `npx vitest run tests/explorer/demographyDiscovery.test.ts`: FAIL.

- [ ] **Step 2: Implement.** In `lib/seo/sitemap.ts`, import `populationPlacePaths` from `../explorer/demographyPlaceRoutes` and add, directly after the `...LIVE_DEMOGRAPHY_PAGES.map(...)` row:

```ts
    ...populationPlacePaths(regions.map((region) => region.id)).map((path) => ({ url: `${siteUrl}${path}`, lastModified: demographyModified })),
```
(`regions` is already in scope from `loadServedMunicipalData()` there; if the destructuring does not name it, add it.) In `lib/i18n/inventory.server.ts` import the same function and add `...populationPlacePaths(regions.map(({ id }) => id)),` after `DEMOGRAPHY_HUB_PATH, ...LIVE_DEMOGRAPHY_PAGES.map((page) => page.path),`. Add the 75 revisions with a one-off script (run it from `apps/web`, from a file in the scratchpad, not the repo):

```ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadServedMunicipalData } from "./lib/data/servedData";
import { populationPlacePaths } from "./lib/explorer/demographyPlaceRoutes";

const file = path.resolve(process.cwd(), "../../data/localization/en/page-revisions.json");
const revisions = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
const { regions } = await loadServedMunicipalData();
for (const place of populationPlacePaths(regions.map((region) => region.id))) revisions[place] = "2026-10-07";
writeFileSync(file, `${JSON.stringify(revisions, null, 2)}\n`);
```
Save it as `add-place-revisions.mts` next to `package.json` (the `.mts` extension makes the top-level `await` legal and lets the relative imports resolve), run it with `npx tsx add-place-revisions.mts`, and delete it afterwards. Then `git diff --stat data/localization/en/page-revisions.json` must show additions only (75 lines), keeping the file's existing order and LF endings. (The repository is LF; if the write produced CRLF, convert back.)

- [ ] **Step 3: Recount every pin.** Run `npx vitest run tests/seo tests/i18n tests/explorer tests/methodology`. The only failures should be counts that the 150 new URLs move (sitemap rows 248 → 398, public page identities 124 → 199, and tests that list them). For each, read what the number counts, compute it from the code, and change the number and any comment that explains it; never edit an assertion to a number you did not derive. Also run `npm run i18n:check` (it must report 199 public page identities and no missing page-body entries; if it asks for more data for the new pages, follow what the Budget municipality pages do). List every file you changed in your report.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "feat(demography): the 75 place pages in the sitemap, the inventory and the English revisions"
```

---

### Task 8: Browser tests

**Files:**
- Create: `tests/browser/demography-population.spec.ts`.
- Modify: `tests/browser/pristine-urls.spec.ts`, `tests/browser/main-explorer.spec.ts` (the payload guard).

- [ ] **Step 1: Write the spec.** Create `tests/browser/demography-population.spec.ts`:

```ts
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

// Two frames and a short timer flush the effects that follow a render, so a URL write made on load would have happened by now.
const settled = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)))),
  );

for (const [locale, prefix, heading, coverage] of [
  ["ka", "", "მოსახლეობა", "2004–2026 · 1 იანვრის მდგომარეობით"],
  ["en", "/en", "Population", "2004–2026 · as of 1 January"],
] as const) {
  test(`${locale}: the index opens on the municipalities with the map, four key figures and no button row`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography/population`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toContainText(coverage);
    await expect(page.getByTestId("municipality-map")).toBeVisible();
    await expect(page.getByTestId("index-kpi")).toHaveCount(4);
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
    await expect(page.locator('[data-testid^="population-level-"], [data-testid^="population-measure-"], [data-testid="population-georgia-pill"]')).toHaveCount(0);
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);
  });

  test(`${locale}: the hub lists four pages and links the live one`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography`);
    await expect(page.getByTestId("demography-hub").getByTestId("hub-card")).toHaveCount(4);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveCount(1);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveAttribute("href", `${prefix}/explorer/demography/population`);
    await expect(page.getByTestId("demography-link")).toHaveAttribute("aria-current", "page");
  });
}

test("clicking a municipality on the map opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipality-shape-11").click();
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population\/khulo$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Khulo");
  await expect(page.getByTestId("explorer-header")).toContainText("Adjara");
  await expect(page.getByTestId("population-highlights")).toContainText("16,098");
});

test("a list row opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipal-list-row").filter({ hasText: "Batumi" }).click();
  await expect(page).toHaveURL(/\/population\/batumi$/);
  await expect(page.getByTestId("population-highlights")).toContainText("246,267");
});

test("the Regions tab lists Georgia and the 11 regions, with density, and a region row opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("level-region").click();
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  await expect(page.getByTestId("municipal-list-region")).toContainText("2,715.7/km²");
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await page.getByTestId("municipal-list-row").filter({ hasText: "Imereti" }).click();
  await expect(page).toHaveURL(/\/population\/region\/imereti$/);
  await expect(page.getByTestId("series-row")).toHaveCount(13);
  await expect(page.getByTestId("region-member-row")).toHaveCount(12);
});

test("Georgia's page ticks the 11 regions and has no previous or next", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/georgia");
  await ready(page);
  await expect(page.getByTestId("series-row")).toHaveCount(12);
  await expect(page.getByTestId("municipal-entity-navigation")).toHaveCount(0);
  await expect(page.getByTestId("population-highlights")).toContainText("3,941,103");
});

test("Tbilisi opens one page from the map's city dot and from the lists", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipality-marker-04").click();
  await expect(page).toHaveURL(/\/population\/region\/tbilisi$/);
  await expect(page.getByTestId("series-row")).toHaveCount(1);

  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipal-list-row").first().click();
  await expect(page).toHaveURL(/\/population\/region\/tbilisi$/);
  await expect(page.getByTestId("region-member-row")).toHaveCount(0);
});

test("on a place page the picker, previous/next and the way back work", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/batumi");
  await ready(page);
  await expect(page.getByTestId("municipal-entity-navigation")).toBeVisible();
  await page.getByTestId("entity-picker-trigger").click();
  await page.getByTestId("picker-municipality").filter({ hasText: "Khulo" }).click();
  await expect(page).toHaveURL(/\/population\/khulo$/);
  await page.getByTestId("municipal-entity-navigation").getByRole("link").last().click();
  await expect(page).not.toHaveURL(/khulo$/);
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population\/[a-z_-]+$/);
  await page.getByTestId("population-back-link").click();
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population$/);
});

test("ticking a part adds a line, puts it in the address and survives a reload", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/region/adjara");
  await ready(page);
  await expect(page.getByTestId("series-row")).toHaveCount(7);
  await page.getByTestId("series-row").filter({ hasText: "Batumi" }).getByTestId("series-row-toggle").click();
  await expect(page).toHaveURL(/sel=region\.adjara(,|%2C)06/);
  await page.getByTestId("population-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
  await expect(page.getByTestId("explorer-table")).toContainText("Adjara");
  await page.reload();
  await ready(page);
  await expect(page.getByTestId("population-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
});

test("the census re-base is a gap in the chart and a rule in the table", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/georgia");
  await ready(page);
  await expect(page.getByTestId("chart-break")).toContainText("Census re-base");
  await page.getByTestId("population-mode-table").click();
  const header = page.getByTestId("explorer-table").locator("thead th", { hasText: "2025" });
  await expect(header).toContainText("Census re-base");
  expect(await header.evaluate((cell) => getComputedStyle(cell).borderLeftWidth)).toBe("2px");
  await expect(page.getByTestId("population-census-note")).toContainText("re-based the population to the 2024 census");
});

test("the Excel download of a place page has three sheets and numeric population", async ({ page }, testInfo) => {
  await page.goto("/en/explorer/demography/population/batumi");
  await ready(page);
  const pending = page.waitForEvent("download");
  await page.getByTestId("population-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-demography-population-batumi-2015-2026-en.xlsx");
  const file = testInfo.outputPath("population.xlsx");
  await download.saveAs(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(book.getWorksheet("Data")!.getCell("A2").value).toBe("Batumi");
  expect(book.getWorksheet("Data")!.getCell("D2").value).toBe(155_163);
});

test("the sidebar keeps Population current on a place page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/demography/population/batumi");
  await ready(page);
  await expect(page.getByTestId("demography-population-link")).toHaveAttribute("aria-current", "page");
});

test("English pages have no Georgian text on the index or on a place page", async ({ page }) => {
  for (const path of ["/en/explorer/demography/population", "/en/explorer/demography/population/region/adjara", "/en/explorer/demography/population/batumi"]) {
    await page.goto(path);
    await ready(page);
    expect(await page.locator("main").innerText(), path).not.toMatch(/[Ⴀ-ჿ]/);
  }
});

// URL state: loading never writes the URL (DESIGN.md section 6.3; pristine-urls.spec.ts covers a clean load); only a later change does.
test("a shared link restores a place page's view and the address stays exactly as shared", async ({ page }) => {
  const hash = "#m=table&r=2018-2024&sel=region.adjara%2C06";
  await page.goto(`/en/explorer/demography/population/region/adjara${hash}`);
  await ready(page);
  await expect(page.getByTestId("population-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
  await settled(page);
  expect(new URL(page.url()).hash).toBe(hash);
});

test("a shared link restores the index's Regions tab and the address stays as shared", async ({ page }) => {
  await page.goto("/en/explorer/demography/population#lvl=region");
  await ready(page);
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  await settled(page);
  expect(new URL(page.url()).hash).toBe("#lvl=region");
});

for (const width of [320, 390, 768, 900, 1100, 1440]) {
  test(`the hub, the index and the place pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/explorer/demography",
      "/explorer/demography/population",
      "/en/explorer/demography/population",
      "/en/explorer/demography/population/georgia",
      "/explorer/demography/population/region/adjara",
      "/en/explorer/demography/population/batumi",
    ]) {
      await page.goto(path);
      if (path.endsWith("/population") || path.includes("/population/")) await ready(page);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at ${width}px`).toBe(true);
    }
  });
}
```

- [ ] **Step 2: The other two specs.** In `tests/browser/pristine-urls.spec.ts` add, wherever the demography Population route is listed, the three place routes (`/explorer/demography/population/georgia`, `/region/adjara`, `/batumi`) in the same way and in both languages if the file does so for the index. In `tests/browser/main-explorer.spec.ts` extend the payload guard that names the Population route to the same three place routes, so the same forbidden fields (`sourceLocator`, `lastReviewedAt`, `estimateBasis`) are checked on them.

- [ ] **Step 3: Run against a production build.** From `apps/web`, with nothing listening on :3100:

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build
```
Then start the server in the background (`NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run start -- --port 3100`), wait until it answers, and run

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/demography-population.spec.ts tests/browser/pristine-urls.spec.ts tests/browser/main-explorer.spec.ts
```
Expected: all pass. A download spec that fails once under load must be re-run alone before you call it a failure. Stop the server by its PID afterwards. If a test fails because of a real defect, fix the component and say so in the report; do not weaken the assertion.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "test(demography): browser tests for the index and the place pages in both languages"
```

---

### Task 9: Documents

**Files:**
- Modify: `DESIGN.md` (§27 "Demography surfaces" and its mentions in §6.3 and §6.7), `Project_Definition.md` (the demography route line and its bounded-scope text), `docs/data-methodology/demography.md` ("Delivery boundary"), `docs/superpowers/plans/2026-10-04-demography-population.md` (a header note).

- [ ] **Step 1: Find what is now untrue.** From the repository root:

```bash
rg -n -i "pill|choosing|click.{0,30}select|selects|selected place|button row|map block|series list|one page|georgia button|regions/municipalities switch|first selected|a page per place|page-per-place" DESIGN.md Project_Definition.md docs/data-methodology/demography.md docs/deployment.md public/llms.txt
```
Read each hit in context; change only the statements the redesign makes false.

- [ ] **Step 2: DESIGN.md §27.** Rewrite it to describe, in the file's existing voice and level of detail: the hub; the index (the Budget index layout with population, no buttons above the map, the map opens a page, the two notes, the four figures, the list tabs and the density line under the region rows); the place page (heading with the picker and neighbours, the Budget shell, line/table, the 2025 marker and break rules R1–R7 as they apply, the tick-list of the place and its parts, the key indicators, the members list on a region page); Tbilisi as one place; the closed route set; the hash vocabulary (`m`, `r`, `sel`; `lvl` on the index); and that no density chart, map or toggle exists. Keep the census-break rules and the "no change figure" rule exactly as they are. Update the header date to the day you finish.

- [ ] **Step 2b: Project_Definition.md and the methodology doc.** In `Project_Definition.md` make the Demography entry say it is an index plus a page for Georgia, each region and each municipality (not a one-page explorer) and keep the exclusions (no change figure, no density map). In `docs/data-methodology/demography.md` change "Delivery boundary" to name the index and the place pages.

- [ ] **Step 3: The old plan.** At the top of `docs/superpowers/plans/2026-10-04-demography-population.md` add one paragraph: Tasks 6–9 and 12–16 of this plan, where they describe the page (the map selectors, the one-page explorer, the single-page browser spec), are replaced by `2026-10-07-demography-population-places.md`; the data, serving, chart, workbook and methodology tasks stand.

- [ ] **Step 4: Run and commit.** `npx vitest run tests/docs` if such a folder exists, and any docs-consistency test the repository has (`rg -l "DESIGN.md" tests`); then:

```bash
git add -A
git commit -m "docs(demography): DESIGN, Project_Definition and the methodology note for the index and place pages"
```

---

### Task 10: Bring the branch up to date with `main` and run the gates

**Files:** whatever the merge touches; no new feature code.

- [ ] **Step 1: Merge.** The tree must be clean. From the repository root:

```bash
git fetch origin
git merge origin/main
```
Expect conflicts in roughly 20 files (a trial merge listed: `DESIGN.md`, `Project_Definition.md`, `components/methodology/{methodology-article,methodology-hub}.tsx`, `components/municipalities/municipality-map.tsx`, `components/regional-economies/regional-economy-map.tsx`, `components/shell/data-sidebar.tsx`, `lib/explorer/regionalEconomyMap.ts`, `lib/i18n/types.ts`, `lib/methodology/{catalog,types}.ts`, `lib/methodology/content/en/revisions.ts`, `lib/pages/{methodology,methodology-article}.tsx`, `lib/seo/sitemap.ts`, five browser/unit specs, `data/localization/en/page-revisions.json`). Resolve with these rules and do not abort the merge:

| Files | Rule |
| --- | --- |
| `DESIGN.md`, `Project_Definition.md` | Keep both sides' sections. If numbers collide, renumber ours after main's and fix the cross-references. |
| `lib/methodology/*`, `components/methodology/*`, `lib/pages/methodology*.tsx` | Union: both datasets (unemployment and demography) are listed. Main introduced its own way to say a dataset has downloads (find it, probably `DATASET_DOWNLOADS`); express demography's "no downloads" through it and delete our parallel mechanism. Keep both datasets' tests. |
| `components/shell/data-sidebar.tsx` | Union. Unemployment is live on main, so our "demography leaves the teasers" change meets main's; keep main's structure and make the `მალე` count tests agree with the result. |
| `lib/seo/sitemap.ts`, `lib/i18n/types.ts`, `data/localization/en/page-revisions.json` | Union (both pages and scopes). |
| `components/municipalities/municipality-map.tsx` | Take main's version (tooltips are gone there), then re-apply only our `display` text for the accessible name and the `wording` prop (group label, legend caption). |
| `components/regional-economies/regional-economy-map.tsx`, `lib/explorer/regionalEconomyMap.ts` | This branch no longer changes them: take main's. |
| specs with pinned counts | Recompute from the merged code. Never average two numbers or pick one side's. |

Main changed `package.json` and the lockfile: run `npm ci` afterwards. Commit the merge with the default message.

- [ ] **Step 2: Recount and run the gate.** From `apps/web`:

```bash
npm run data:prepare-fact-query-snapshot
npm run check
```
Fix every failure that comes from the merge or from a pinned count (sitemap rows, public page identities, sidebar badge counts, methodology hub rows, `llms.txt` targets). A disagreement in `tests/factQuery/reference.test.ts` is a stop condition: report it, do not edit the expectation.

- [ ] **Step 3: Build and run the whole browser suite once.** Nothing may be listening on :3100.

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build
```
Start `npm run start -- --port 3100` in the background, wait for it, then:

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```
Expected: all pass (the previous full run had 659 tests; the number will differ). Re-run any download spec that fails once under load before calling it a failure.

- [ ] **Step 4: Screenshots for the owner.** With the server still up, save 1440px and 390px screenshots, Georgian and English, of the index, Georgia's page, Adjara's page, Batumi's page and Tbilisi's page into `.superpowers/sdd/2026-10-07-demography-population-places/screens/` using `npx playwright screenshot --channel msedge --viewport-size "1440,900" --wait-for-timeout 3000 <url> <file>`. Look at each one and report anything that looks wrong. Stop the server by its PID.

- [ ] **Step 5: Final state.** Do not push, open a pull request or delete the workspace. Report: HEAD, the gate results, the browser result, the list of Georgian strings added or changed in this plan for the owner's review, and anything left open.

