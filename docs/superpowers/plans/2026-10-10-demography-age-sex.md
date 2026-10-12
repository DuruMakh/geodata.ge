# Demography Age and Sex — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `/explorer/demography/age-sex` (+ `/en`) — regions by share aged 65+, Georgia's population pyramid by year, the age groups over time, the age-by-year heat map — and add an "Age and sex" block (census 2024 pyramid) to the Georgia and 11 region Population pages.

**Architecture:** Two canonical files already in `data/imports/` join the served Demography set (mirror 5,525 → 9,740 rows). A pure model (`demographyAgeSex.ts`) turns served rows into pyramids, shares, bands, heat-map rows and hash state; a pure layout (`pyramidLayout.ts`) gives the pyramid's geometry. Only the pyramid is a new drawing: the region map and list are `RegionIndex` (Unemployment), the heat map is Unemployment's coloured table lifted into a shared `HeatmapTable`, the year buttons are Analysis's row lifted into a shared `YearButtonRow`, lines and tables are `EditorialLineChart`/`ExplorerTable`. Flipping `live` in `DEMOGRAPHY_PAGES` drives the hub card, sidebar, sitemap and i18n inventory, as for Births.

**Tech Stack:** Next.js 16 static prerender, React 19, strict TypeScript, Tailwind v4, vitest (`renderToStaticMarkup`), Playwright, exceljs.

**Spec:** `docs/superpowers/specs/2026-10-04-demography-age-sex-design.md` (rewritten 2026-10-10, owner-approved). Read it before any task. The Births plan (`docs/superpowers/plans/2026-10-09-demography-births-deaths.md`) and its code are the closest precedent: when a step says "as Births does", open that code.

## Global Constraints

- Branch `claude/demographics-remaining-3119f2` (this worktree). Local commits only: no push, pull request or merge. Delivery is the owner's decision after Task 10.
- Paths are relative to `apps/web` unless they start with `docs/`, `data/` or `public/` (`public/` = `apps/web/public`). Run commands from `apps/web`.
- Reuse First (`AGENTS.md`). The only shared-code changes allowed: lifting `YearButtonRow` out of `components/analysis/analysis-view.tsx` and `HeatmapTable` out of `components/unemployment/unemployment-age-heatmap.tsx` with byte-identical output for their current users (Task 3); exporting `ModeTabs` and `Download` from `components/demography/national-vital-charts.tsx`; the demography loader's served set; `DEMOGRAPHY_PAGES`' flag; `buildDemographyHubCards`. If a step seems to need more, stop and report.
- The 2025 census re-base: annual figures carry `breaks=[{ year: CENSUS_STEP.toYear, label: t("breakLabel") }]` / `breakYears`; nothing subtracts across 2024/2025; census counts (14 November 2024) are never drawn on the annual timeline.
- No sentence names a cause (no "emigration", "war", "low birth rate").
- English pages carry no Georgian in visible text, attributes, metadata or JSON-LD (place names embedded in client data follow the existing ruling: guards check visible text, attributes, metadata, JSON-LD). No Dataset JSON-LD, MCP tool or bulk download; `BreadcrumbList` only.
- Georgian is canonical; every Georgian string is a draft for the owner. Each task report lists every new key with its ka and en text.
- Windows traps: run `npm run data:prepare-fact-query-snapshot` once before plain `npx vitest run`; never run `next dev` (it rewrites tracked `apps/web/AGENTS.md`); verify UI on a production build with `next start`; kill any server on :3100 before rebuilding; repository files are LF; `data/methodology/source-archives/*.csv` keep the UTF-8 BOM.
- While editing run only the task's tests; the full gates run once, in Task 10.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Anchor values (from the CSVs, verified 2026-10-10)

| Fact | Value |
| --- | --- |
| Rows | structure file 1,587 (1,380 age-sex + 207 bands); census file 2,628 (1,944 by age + 684 by settlement); mirror 5,525 → 9,740; client annual rows (men and women, 19 groups, 23 years) 874; client census rows per place (men and women, 18 groups, 3 settlements) 108 |
| Georgia 1 Jan 2026 | men 1,887,646; women 2,053,457; total 3,941,103 (= published total); 0–4 men 106,170 (age 0 19,315 + 1–4 86,855), women 97,930; 65+ 18.1%; 0–14 19.0%; 15–64 62.9%; women per 100 men 108.8 |
| Georgia 1 Jan 2004 | total 3,937,716; 65+ 14.1%; women per 100 men 110.0 |
| 65+ share by year | 14.1 (2004), 16.2 (2024: 16.1504), 17.6 (2025), 18.1 (2026) |
| Heat map maximum | 8.232% (2004, 15–19) |
| Census Georgia | 3,929,581 (men 1,881,004, women 2,048,577); urban 2,455,444 (62.5%); rural 1,474,137; 0–4 211,270; 65+ 17.6%; women per 100 men 108.9 |
| Census 65+ by region, descending | Racha-Lechkhumi and Kvemo Svaneti 31.2, Guria 24.1, Samegrelo-Zemo Svaneti 22.6, Imereti 22.0, Kakheti 21.4, Mtskheta-Mtianeti 20.3, Samtskhe-Javakheti 19.1, Shida Kartli 18.9, Kvemo Kartli 16.2, Tbilisi 14.4, Adjara 13.1 |
| Census Imereti | counted 510,741 (men 245,599, women 265,142); urban 273,742 (53.6%); rural 236,999; 65+ 22.0% |
| Census Tbilisi / Adjara urban share | 96.6% / 66.8% |

## Reuse inventory

| Need | Existing piece | Change |
| --- | --- | --- |
| Mirror, loader, parity, import | `DemographyFact`, `importDemography.ts`, `scripts/import-budget-facts.ts` | two more files; `census_count` basis for the census family |
| Region map + ranked list + summary | `RegionIndex`, `RegionMap`, `regionalMapGeometry`, `quantileBucket` (as `buildUnemploymentRegionMapModel` uses them) | none |
| Year buttons | the row inside `AnalysisView` | lifted into `components/ui/year-button-row.tsx`, Analysis byte-identical |
| Heat map | `UnemploymentAgeHeatmap`'s table + legend, `unemploymentAgeHeatmapBin`, `MAP_RAMP` | table lifted into `components/main-explorer/heatmap-table.tsx` with optional `breakYear`, Unemployment byte-identical |
| Lines, year tables, tabs, key figures, notes | `EditorialLineChart`, `ExplorerTable`, `SegmentedTabs`, `TextTab`, `HeroKpi`, `SideKpiList`, `KPI_GRID_CLASS`, `SectionTitle`, `SourceNote`, `Callout`, `ChartTooltip`, `niceScale` | none |
| Mode tabs + Excel button | `ModeTabs`, `Download` in `national-vital-charts.tsx` | exported |
| Excel | `WorkbookExportModel` (`headerLabels`, `sourceYears`), `SHEET_NAMES`, `workbookFilename`, `withAbsoluteUrls`, `workbookMessage` | none |
| Place page | `renderPopulationPlacePage`, `VitalSection` pattern | one more sibling after `VitalSection` |
| Hub, sidebar, sitemap, inventory | `DEMOGRAPHY_PAGES`, `buildDemographyHubCards`, `LIVE_DEMOGRAPHY_PAGES` | flag; an age card figure |
| Hash state | `useReplaceHash`, the parse/serialize pattern of `demographyMigration.ts` | none |
| **New** | `lib/explorer/demographyAgeSex.ts`, `pyramidLayout.ts`, `demographyAgeSexRegions.ts`, `demographyAgeSexWorkbook.ts`; `components/demography/population-pyramid.tsx`, `age-sex-explorer.tsx`, `age-sex-regions.tsx`, `age-sex-section.tsx`; `lib/pages/demography-age-sex.tsx`; two route files | No component draws mirrored horizontal bars; the pyramid's table is age rows × (men, women, total, share), which `ExplorerTable` (year columns) cannot hold, so it is a plain semantic table with `ExplorerTable`'s anatomy, as `MonthGridTable` and `UnemploymentAgeHeatmap` are |

## Review Focus

1. **Comparison year across the break while `measure=persons` is in the hash** (`#year=2026&cmp=2004&measure=persons`): the page must show shares, the persons tab disabled, the note visible; never draw counts across the break. Test in Task 2 (`effectiveMeasure`) and Task 9 (browser).
2. **Hash with a year outside the data** (`#year=1999`, `#cmp=2030`, `#cmp=2026` equal to `year`): clamp to the latest year, drop the comparison. Test in Task 2.
3. **Region rows link to `#age-sex` on a page whose block renders below a long Births section**: the anchor must exist on all 12 Georgia/region pages and never on a municipality page. Test in Task 6.
4. **The pyramid on a 320–390px phone** with a comparison outline and Georgian header labels (`მამაკაცები 47.9%`): no sideways page scroll, no label overlap with the 65+ band label. Test in Task 9 (390px) and Task 4 (layout at 320).
5. **Lifting the two shared rows changes Analysis or Unemployment** (class order, `aria-pressed`, the planned tag, test ids the browser specs use): snapshots recorded before the lift must pass after it. Test in Task 3.

---

### Task 0: Baseline

**Files:** none edited.

- [ ] **Step 1:** `git log --oneline -1` shows `14a32b60` or later on `claude/demographics-remaining-3119f2`, with `e14cc0d7` (Births merge) in its history.
- [ ] **Step 2:** Compare mtimes of `node_modules/.package-lock.json` and `package-lock.json`; if the lockfile is newer or `node_modules` is missing, `npm ci`. Then `npm run data:prepare-fact-query-snapshot`.
- [ ] **Step 3:** `npx vitest run tests/data/demography tests/explorer/demographyHub.test.ts tests/explorer/populationPlacePages.test.tsx tests/explorer/vitalSection.test.tsx tests/explorer/unemploymentAge.test.tsx`: PASS. Record in the report `npm run i18n:check`'s public page-identity count and the sitemap count pinned in `tests/seo/routes.test.ts`; Task 7 moves them.

---

### Task 1: Serve the two files

**Files:**
- Modify: `lib/data/demography/importDemography.ts`, `lib/data/servedData.ts` (`SERVED_DATA_FILES`), `scripts/import-budget-facts.ts` (`loadDemographyFacts([...])` list)
- Test: `tests/data/demography/servingBoundary.test.ts`, `tests/data/demography/importDemography.test.ts`

**Interfaces:**
- Produces: `SERVED_DEMOGRAPHY_FILES` gains `"../../data/imports/demography-structure-annual.csv"` and `"../../data/imports/demography-census-2024-population.csv"` (in that order, last); `SERVED_DATA_FILES.demographyStructureFacts` and `.demographyCensusFacts` (same paths); `loadServedDemographyData()` returns 9,740 rows.

- [ ] **Step 1: Failing tests.** `servingBoundary.test.ts`: every `5_525` → `9_740`. `importDemography.test.ts`: add the two `SERVED_DATA_FILES` entries to "serves the files SERVED_DATA_FILES names"; in "every row's basis is the one its series and year require" add a `census` set from `FAMILIES.census`, exclude it from `lineage`, and assert

```ts
    expect(facts.filter((row) => census.has(row.seriesId)).every((row) => row.estimateBasis === "census_count")).toBe(true);
    expect(facts.filter((row) => census.has(row.seriesId))).toHaveLength(2_628);
    expect(facts.filter((row) => FAMILIES.structure.includes(row.seriesId as never))).toHaveLength(1_587);
```
  Add a test "the age groups add up": for every year, sex in (male, female, total), the 19 `population_by_age_sex` groups sum to that year's `total` row (2026 total 3,941,103); each band equals its groups' sum (`band_0_14` = `age_0`+`age_1_4`+`age_5_9`+`age_10_14`, `band_65_plus` = 65–69 … 85+); and for Georgia and each of the 11 regions the 18 census groups summed over men and women in settlement `total` equal the `census_population_by_settlement` row (sex `total`, settlement `total`) (Georgia 3,929,581, Imereti 510,741).
  Run both files: FAIL.
- [ ] **Step 2: Serve.** In `importDemography.ts` append the two paths, add `const CENSUS_SERIES = new Set<string>(FAMILIES.census);`, add `...FAMILIES.structure, ...CENSUS_SERIES` to `SERVED_SERIES`, and in `expectedBasis` return `"census_count"` for `CENSUS_SERIES` before the lineage fallback (structure follows `populationEstimateBasis(year)`: 2004–2014 retro_projection, 2015–2024 pre_census, 2025–2026 census_based, as the CSV carries). Update the comment above the sets to name the two files. Add the two `SERVED_DATA_FILES` keys after `demographyFertilityFacts` and the two entries to the import script list.
- [ ] **Step 3: Run.** Both files: PASS. `npx vitest run tests/explorer/demographyPages.test.tsx tests/explorer/populationPlacePages.test.tsx tests/explorer/demographyHub.test.ts tests/explorer/vitalSection.test.tsx`: PASS unchanged (pages filter by series). `npm run typecheck`: PASS. If `tests/data/demography/importIntegration.test.ts` lists per-family counts, add the two families in its pattern (it runs against a database only; not run here).
- [ ] **Step 4: Commit** `feat(demography): serve the age-structure and census files`.

---

### Task 2: The age model

**Files:**
- Modify: `lib/servedRows.ts` (type), `lib/explorer/clientData.ts` (projection)
- Create: `lib/explorer/demographyAgeSex.ts`
- Test: `tests/explorer/demographyAgeSex.test.ts`

**Interfaces:**
- Produces, in `lib/servedRows.ts`: `export type ClientAgeFact = { year: number; sex: "male" | "female"; ageGroup: string; settlement: "total" | "urban" | "rural"; value: number }`. In `clientData.ts`: `projectAgeObservation(fact: ServedDemographyObservation): ClientAgeFact` (settlement defaults to `"total"`).
- Produces, in `demographyAgeSex.ts`:
  - `AGE_SEX_GROUPS` — the 18 ids `age_0_4 … age_85_plus`, youngest first; `type AgeSexGroup`; `ageGroupLabel(id): string` → `"0–4"`, `"85+"` (en dash, language-neutral).
  - `type Pyramid = { rows: { group: AgeSexGroup; male: number; female: number }[]; male: number; female: number; total: number }` (rows youngest first).
  - `annualAgeFacts(served: readonly ServedDemographyObservation[]): ClientAgeFact[]` — Georgia `population_by_age_sex`, men and women, the 19 published groups (874 rows).
  - `censusAgeFactsForPlace(served, placeId: string): ClientAgeFact[]` — `census_population_by_age`, men and women, three settlements (108 rows; `[]` for a municipality).
  - `ageYears(facts): number[]` ascending.
  - `annualPyramid(facts, year): Pyramid` — `age_0_4 = age_0 + age_1_4`; throws if a group is missing.
  - `censusPyramid(facts, settlement): Pyramid`.
  - `shareOf(part, total): number` (percent); `bandShares(p: Pyramid): { young: number; working: number; old: number }` (percent, 0–14 / 15–64 / 65+); `womenPer100Men(p): number`; `urbanShare(facts): number` (percent of settlement total).
  - `bandSeries(facts, years): Record<"young" | "working" | "old", Record<number, number>>` (percent by year).
  - `heatmapRows(facts, years): { rows: { id: AgeSexGroup; label: string; values: number[] }[]; maximum: number }` — rows 85+ first (top), values = share of the year's total in percent.
  - `type AgeMeasure = "share" | "persons"`; `type AgeSexState = { year: number; compare: number | null; measure: AgeMeasure; pyramidMode: ChartMode; bandsMode: ChartMode }`.
  - `crossesBreak(a: number, b: number): boolean` — true when exactly one is `>= CENSUS_STEP.toYear`.
  - `effectiveMeasure(state): AgeMeasure` — `"share"` when `compare !== null && crossesBreak(year, compare)`, else `state.measure`.
  - `parseAgeSexHash(hash: string, years: readonly number[]): AgeSexState` and `serializeAgeSexHash(state: AgeSexState, years: readonly number[]): string` — keys `year` (omitted when latest), `cmp`, `measure=persons` (omitted when share), `pyramid=table`, `bands=table`.

- [ ] **Step 1: Failing tests** in `tests/explorer/demographyAgeSex.test.ts` (load facts once with `loadServedDemographyData()` in `beforeAll`):
  - `annualAgeFacts` has 874 rows and no `sourceId`/`estimateBasis` keys; `censusAgeFactsForPlace(served, "region.imereti")` has 108 rows; `censusAgeFactsForPlace(served, "06")` is `[]`.
  - `annualPyramid(f, 2026)`: `male` 1,887,646, `female` 2,053,457, `total` 3,941,103; `rows[0]` `{ group: "age_0_4", male: 106_170, female: 97_930 }`; 18 rows.
  - `bandShares(annualPyramid(f, y)).old.toFixed(1)` is `"14.1"`, `"16.2"`, `"17.6"`, `"18.1"` for 2004, 2024, 2025, 2026; 2026 young `"19.0"`, working `"62.9"`; `womenPer100Men(annualPyramid(f, 2026)).toFixed(1)` is `"108.8"`, 2004 `"110.0"`.
  - `bandSeries` equals the shares of the published `population_age_band` rows to 1e-9 in every year.
  - Census: Georgia `censusPyramid(…, "total").total` 3,929,581 and `rows[0]` sums to 211,270; `urbanShare` Georgia `"62.5"`, Imereti `"53.6"`, Tbilisi `"96.6"`; Imereti total 510,741; Imereti old share `"22.0"`; urban + rural pyramid totals equal the total pyramid's.
  - `heatmapRows(f, ageYears(f))`: 18 rows, first id `age_85_plus`, every year's column sums to 100 (±1e-9), `maximum.toFixed(3)` `"8.232"`.
  - Hash: `parseAgeSexHash("", years)` → `{ year: 2026, compare: null, measure: "share", pyramidMode: "line", bandsMode: "line" }`; `#year=1999&cmp=2030` → year 2026, compare null; `#year=2026&cmp=2026` → compare null; `#year=2010&cmp=2004&measure=persons` → kept, `effectiveMeasure` `"persons"`; `#year=2026&cmp=2004&measure=persons` → `effectiveMeasure` `"share"`; `#measure=bogus&pyramid=x` → defaults; `serializeAgeSexHash(parse(h))` round-trips `year=2010&cmp=2004&measure=persons&pyramid=table` and serializes the default state to `""`.
  Run: FAIL.
- [ ] **Step 2: Implement** the type, the projection and the module. Follow `demographyMigration.ts` for the `pick`-style parsing. `ChartMode` comes from `lib/explorer/types` (`"line" | "table"`).
- [ ] **Step 3: Run** the file: PASS. `npm run typecheck`: PASS.
- [ ] **Step 4: Commit** `feat(demography): the age and sex model`.

---

### Task 3: Lift the year row and the heat-map table

**Files:**
- Create: `components/ui/year-button-row.tsx`, `components/main-explorer/heatmap-table.tsx`
- Modify: `components/analysis/analysis-view.tsx`, `components/unemployment/unemployment-age-heatmap.tsx`
- Test: `tests/explorer/sharedRows.test.tsx` (new, with a snapshot file)

**Interfaces:**
- Produces: `YearButtonRow({ years, value, onChange, tagFor, testId }: { years: readonly number[]; value: number | null; onChange: (year: number) => void; tagFor?: (year: number) => string | null; testId: string })` — the exact `<div ref … data-testid … className="relative mt-4 flex …">` and buttons now in `AnalysisView`, including the `useLayoutEffect` that keeps the active year in view; `yearRowScrollLeft` moves with it and `analysis-view.tsx` re-exports it (`export { yearRowScrollLeft } from "../ui/year-button-row"`). `AnalysisView` passes `tagFor={(year) => plannedYears.has(year) ? message(messages, "analysis.planned") : null}` and `testId="analysis-year-selector"`.
- Produces: `HeatmapTable({ caption, rowHeader, years, rows, maximum, format, scaleLabel, breakYear, breakLabel }: { caption: string; rowHeader: string; years: readonly number[]; rows: { id: string; label: string; values: (number | null)[] }[]; maximum: number; format: (value: number | null) => string; scaleLabel: string; breakYear?: number; breakLabel?: string })` — the scroller `div` (`data-testid="age-heatmap-scroller"`, opens scrolled to the newest years), the table and the legend row now inside `UnemploymentAgeHeatmap`, with the same `data-heatmap-group`, `data-heatmap-cell`, `data-value`, `data-bin` attributes and `unemploymentAgeHeatmapBin(value, maximum, MAP_RAMP.length)`. With `breakYear`, that year's header and cells get `style={{ borderLeft: "2px solid var(--ink)" }}` and the header prints `breakLabel` as ExplorerTable's `breakMark` does (`<sup>` with `STATUS_MARK_CLASS`); without it, output is unchanged. `UnemploymentAgeHeatmap` keeps its `<section>`, title, caption and note and renders `HeatmapTable` for the rest.

- [ ] **Step 1: Snapshots of today's output, before any edit.** Create `tests/explorer/sharedRows.test.tsx` with two tests:
  - render `UnemploymentAgeHeatmap` exactly as `tests/explorer/unemploymentAge.test.tsx` does (same fixture, `en`), `expect(markup).toMatchSnapshot()`;
  - render `<AnalysisView model={{ emptyReason: "x", hasPlannedValues: false } as unknown as SingleYearSnapshotModel} years={[2023, 2024, 2025]} plannedYears={new Set([2025])} side="expenditure" grouping="fields" year={2024} lastUpdatedAt="2026-01-01" onSideChange={() => {}} onGroupingChange={() => {}} onYearChange={() => {}} />` inside `I18nProvider` (ka, scopes `analysis`, `common`, `controls`), `expect(markup).toMatchSnapshot()`. If the cast model throws while rendering, add the fewest fields it reads; record which in the report.
  Run `npx vitest run tests/explorer/sharedRows.test.tsx`: PASS and the snapshot file is written. Commit it alone (`test: record Analysis year row and Unemployment heat map markup`).
- [ ] **Step 2: Failing tests** for the new options, in the same file: `HeatmapTable` with `breakYear={2025}` and `breakLabel="Census"` over years `[2024, 2025]` puts `border-left:2px solid var(--ink)` on the 2025 header and cells and `Census` in the 2025 header; `YearButtonRow` with `tagFor={(y) => y === 2025 ? "Census" : null}` renders the tag only on 2025, and `aria-pressed="true"` only on `value`. Run: FAIL.
- [ ] **Step 3: Lift.** Move the code into the two new files; change the two current users to call them.
- [ ] **Step 4: Run** `npx vitest run tests/explorer/sharedRows.test.tsx tests/explorer/unemploymentAge.test.tsx` **without `-u`**: PASS (both snapshots unchanged). `npm run typecheck`, `npm run lint`: PASS.
- [ ] **Step 5: Commit** `refactor: share the year-button row and the heat-map table`.

---

### Task 4: The pyramid

**Files:**
- Create: `lib/explorer/pyramidLayout.ts`, `components/demography/population-pyramid.tsx`
- Modify: both `demography.json` message files
- Test: `tests/explorer/pyramidLayout.test.ts`, `tests/explorer/populationPyramid.test.tsx`

**Interfaces:**
- Consumes: `Pyramid`, `ageGroupLabel`, `shareOf`, `bandShares`, `AgeMeasure` (Task 2).
- Produces, `pyramidLayout.ts`:
  - `PYRAMID = { rowPitch: 22, bar: 18, gutter: 44, pad: 8, header: 26, axis: 22, minWidth: 320, serverWidth: 520 }`.
  - `pyramidLayout({ width, male, female, compare }: { width: number; male: number[]; female: number[]; compare?: { male: number[]; female: number[] } | null }): PyramidGeometry`. Value arrays are youngest first, already in the displayed measure (percent or persons).
  - `PyramidGeometry = { width: number; height: number; centreLeft: number; centreRight: number; scaleMax: number; rows: { index: number; y: number; maleX: number; maleWidth: number; femaleWidth: number }[]; ticks: { value: number; leftX: number; rightX: number }[]; outline: { left: string; right: string } | null; oldBandY: number; oldBandHeight: number }`.
  - Rules: `width = max(width, minWidth)`; each half `(width − gutter − 2·pad) / 2`; `scaleMax = niceScale(0, max of every displayed value incl. compare).max`; row 0 (0–4) at the bottom; ticks every `niceScale` step from 0 to `scaleMax` on both sides; the 65+ band covers the top five rows; the outline is a stepped path along each comparison row's outer end (`M…H…V…`), `null` without `compare`.
- Produces, `population-pyramid.tsx`:
  - `PopulationPyramid({ pyramid, compare, measure, ariaLabel, testId }: { pyramid: Pyramid; compare: { pyramid: Pyramid; year: number } | null; measure: AgeMeasure; ariaLabel: string; testId: string })` — measures its container with `ResizeObserver` (renders at `serverWidth` before measurement), draws header labels (`SwatchBar` + `t("sexMale")` + share or total, ink text), tinted 65+ band with `t("oldBand", { share })`, bars in `SERIES_COLORS["sex.male"]`/`["sex.female"]`, the 1.5px `INK` outline, tick labels (11px mono). The plot is `role="group"` named `ariaLabel`; each row is `role="img"` with `t("rowAria", …)`; one row has `tabIndex=0` (roving), ↑/↓/Home/End move focus; hover/focus shows `ChartTooltip` (header = age label; rows men, women, total; comparison year's rows when on) with the 2px accent focus ring. With `compare`, a legend line shows a filled swatch `{year}` and an outlined swatch `{compare.year}`.
  - `PyramidTable({ pyramid, compare, caption }: { pyramid: Pyramid; compare: { pyramid: Pyramid; year: number } | null; caption: string })` — `<table>` with `ExplorerTable`'s anatomy (2px ink header rule, hairline rows, right-aligned mono numbers, sticky first column, horizontal scroll frame): columns age, men, women, total, share; rows 85+ first, then a total row; with `compare`, the four number columns repeat under a `{compare.year}` group header.

Messages (en / ka draft) added in this task:

| Key | en | ka |
| --- | --- | --- |
| `demography.oldBand` | 65+ · {share} | 65+ · {share} |
| `demography.rowAria` | {age}: men {men}, women {women}, total {total} ({share}) | {age}: მამაკაცები {men}, ქალები {women}, სულ {total} ({share}) |
| `demography.ageHeader` | Age | ასაკი |
| `demography.totalHeader` | Total | სულ |
| `demography.shareHeader` | Share | წილი |

(`demography.sexMale` "Men"/`sexFemale` "Women" exist; reuse them.)

- [ ] **Step 1: Failing tests.** `pyramidLayout.test.ts`: for width 600 and the Georgia 2026 shares, `centreRight − centreLeft === 44`; for any row, `maleX + maleWidth === centreLeft` and the female bar starts at `centreRight`; equal values give equal widths on both sides; the widest bar is ≤ the half width; `rows[0].y > rows[17].y` (0–4 at the bottom); `scaleMax ≥ ` every value incl. compare and is the `niceScale` max; ticks start at 0, are symmetric, and their last value is `scaleMax`; width 200 lays out at 320; `outline` is `null` without `compare` and starts with `M` with it; `oldBandY === rows[17].y` within the row pitch and `oldBandHeight === 5 * rowPitch`. `populationPyramid.test.tsx` (en, Georgia 2026 shares): markup contains 18 `role="img"` rows, `aria-label="0–4: men 106,170, women 97,930, total 204,100 (5.2%)"`, `65+ · 18.1%`, exactly one `tabindex="0"`, no outline path without `compare`; with `compare` (2004) the legend shows `2026` and `2004`; `PyramidTable` prints `3,941,103` in the total row and the 0–4 row's share as `5.2%`. No Georgian in the en markup.
  Run: FAIL.
- [ ] **Step 2: Implement** both files and the messages.
- [ ] **Step 3: Run** both test files: PASS. `npm run typecheck`: PASS.
- [ ] **Step 4: Commit** `feat(demography): the population pyramid`.

---

### Task 5: The four workbooks

**Files:**
- Create: `lib/explorer/demographyAgeSexWorkbook.ts`
- Modify: both `demography.json`
- Test: `tests/explorer/demographyAgeSexWorkbook.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces (each returns `WorkbookExportModel`; `Input = { facts: readonly ClientAgeFact[]; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string }`):
  - `buildPyramidWorkbookExportModel(input & { year: number; compare: number | null }, presentation)` — readable rows = 18 groups (85+ first) + total; `headerLabels.columns` = men, women, total (and the same three for the comparison year, labelled `{label} {year}`); `sourceYears` = the year(s); data sheet `[year, sex, age, persons, share, basis]` for both sexes and the year(s), share `0.0`; source `SOURCE_ID.ageSex`; filename `demography-age-sex-georgia-{year}[-{compare}]`.
  - `buildBandsWorkbookExportModel(input, presentation)` — years as columns, three band rows in percent (`amountDecimals: 1`), break year header label as Births' `yearLabel` does; data sheet `[band, year, share, basis]`; filename `demography-age-groups-{first}-{last}`.
  - `buildAgeYearWorkbookExportModel(input, presentation)` — years as columns, 18 group rows (85+ first) in percent; data sheet `[year, age, persons, share, basis]`; filename `demography-age-by-year-{first}-{last}`.
  - `buildCensusPlaceWorkbookExportModel(input & { place: DemographyPlace; settlement: "total" | "urban" | "rural"; scope: string }, presentation)` — as the pyramid workbook for the census pyramid; subtitle names the settlement and `t("censusDate")`; `sourceYears: [2024]`; source `SOURCE_ID.censusAge`; filename `demography-age-sex-{scope}-census-2024-{settlement}`.
  - Basis text: annual rows print the lineage label of their year the way the Population workbook does; census rows print `t("censusBasis")`.

Messages: `demography.pyramidWorkbookTitle` "Population by age and sex, Georgia" / "მოსახლეობა ასაკისა და სქესის მიხედვით, საქართველო"; `bandsWorkbookTitle` "Age groups, Georgia" / "ასაკობრივი ჯგუფები, საქართველო"; `heatWorkbookTitle` "Share of each age group, Georgia" / "ასაკობრივი ჯგუფების წილი, საქართველო"; `censusWorkbookTitle` "Population by age and sex, {place}, census 2024" / "მოსახლეობა ასაკისა და სქესის მიხედვით, {place}, აღწერა 2024"; `censusDate` "14 November 2024" / "2024 წლის 14 ნოემბერი"; `censusBasis` "Census count" / "აღწერის მონაცემი"; `settlementAll` "All" / "ყველა"; `settlementUrban` "Cities" / "ქალაქი"; `settlementRural` "Villages" / "სოფელი"; `bandYoung` "Aged 0–14" / "0–14 წლის"; `bandWorking` "Aged 15–64" / "15–64 წლის"; `bandOld` "Aged 65 and over" / "65 წლის და უფროსი".

- [ ] **Step 1: Failing tests** (en and ka): pyramid 2026 — readable total row values `[1_887_646, 2_053_457, 3_941_103]`, 19 readable rows, data sheet 36 rows with share column format `0.0`, one source (`ageSex`), filename contains `2026`; with `compare: 2004` six columns; bands — 23 year columns, 2026 old value 18.079… (to 1e-6 of the shares), the 2025 header carries the break label; age-by-year — 18 rows, 2004 15–19 value 8.232 (3 dp); census Imereti total — total row `[245_599, 265_142, 510_741]`, one source (`censusAge`), subtitle contains the census date; no workbook has a column header containing `sourceLocator`, `estimateBasis` or `lastReviewedAt`.
  Run: FAIL.
- [ ] **Step 2: Implement**, following `demographyNationalWorkbook.ts`.
- [ ] **Step 3: Run**: PASS. **Step 4: Commit** `feat(demography): age and sex workbooks`.

---

### Task 6: The block on Georgia and region pages

**Files:**
- Create: `components/demography/age-sex-section.tsx`
- Modify: `lib/pages/demography-population-place.tsx`, both `demography.json`
- Test: `tests/explorer/ageSexSection.test.tsx`, `tests/explorer/populationPlacePages.test.tsx`

**Interfaces:**
- Consumes: Tasks 2, 4, 5; `ModeTabs`/`Download` exported from `national-vital-charts.tsx` (export them in this task); `HeroKpi`, `SideKpiList`, `KPI_GRID_CLASS`.
- Produces: `AgeSexSection({ place, facts, sources, siteOrigin, workbookScope, nationalHref }: { place: DemographyPlace; facts: ClientAgeFact[]; sources: (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; workbookScope: string; nationalHref: string })` — returns `null` when `facts` is empty. `<section id="age-sex" data-testid="age-sex-section" className="@container mt-16 border-t-2 border-[var(--ink)] pt-[22px]">`; `SectionTitle` `t("ageSexCensusHeading")`; settlement `TextTab`s (`age-sex-settlement-{total|urban|rural}`) and measure `SegmentedTabs` (`%` / `t("measurePersons")`, test ids `age-sex-measure-{share|persons}`) in `useState`; `ModeTabs` (`t("pyramidMode")` / table); `PopulationPyramid` or `PyramidTable` for the chosen settlement; `HeroKpi` = 65+ share of the whole place with `SideKpiList` = people counted, living in cities (both of the whole place, unchanged by the settlement tab); `SourceNote` `t("censusSource")`; `Download` of `buildCensusPlaceWorkbookExportModel`; link `t(place.id === GEORGIA_PLACE_ID ? "ageSexGeorgiaLink" : "ageSexNationalLink", { first })` to `nationalHref`, test id `age-sex-national-link`.
- In `renderPopulationPlacePage`: after `<VitalSection … />`, render `<AgeSexSection place={place} facts={censusAgeFactsForPlace(served.facts, place.id)} sources={sources.filter((s) => s.sourceId === SOURCE_ID.censusAge)} siteOrigin={resolveSiteUrl()} workbookScope={workbookScopeFor(route)} nationalHref={AGE_SEX_PATH} />`. Add `export const AGE_SEX_PATH = "/explorer/demography/age-sex"` to `demographyRoutes.ts` in this task and use it in the `age-sex` entry of `DEMOGRAPHY_PAGES` (the entry stays `live: false` until Task 7).

Messages (en / ka draft): `ageSexCensusHeading` "Age and sex · census, 14 November 2024" / "ასაკი და სქესი · აღწერა, 2024 წლის 14 ნოემბერი"; `measurePersons` "People" / "ადამიანი"; `pyramidMode` "Pyramid" / "პირამიდა"; `pyramidAria` "Population pyramid, {place}, {date}: men on the left, women on the right, ages 0–4 at the bottom to 85+ at the top" / "მოსახლეობის პირამიდა, {place}, {date}: მამაკაცები მარცხნივ, ქალები მარჯვნივ, ქვემოთ 0–4, ზემოთ 85+"; `pyramidTableCaption` "Population by age and sex, {place}, {date}" / "მოსახლეობა ასაკისა და სქესის მიხედვით, {place}, {date}"; `kpiOld` "Aged 65 and over" / "65 წლის და უფროსი"; `kpiCounted` "People counted" / "აღწერილი მოსახლეობა"; `kpiUrban` "Living in cities" / "ქალაქის მოსახლეობა"; `censusSource` "Source: Geostat, 2024 census, population by region, age, urban and rural settlement and sex, counted on 14 November 2024." / "წყარო: საქსტატი, 2024 წლის აღწერა, მოსახლეობა რეგიონების, ასაკის, ქალაქ-სოფლისა და სქესის მიხედვით, 2024 წლის 14 ნოემბრის მდგომარეობით."; `ageSexNationalLink` "Compare the regions and see Georgia’s pyramid for every year" / "რეგიონების შედარება და საქართველოს პირამიდა ყოველი წლისთვის"; `ageSexGeorgiaLink` "Georgia’s pyramid for every year since {first}" / "საქართველოს პირამიდა ყოველი წლისთვის, {first} წლიდან".

- [ ] **Step 1: Failing tests.** `ageSexSection.test.tsx` (render as `vitalSection.test.tsx` does): Georgia — `id="age-sex"`, `3,929,581`, `17.6%`, `62.5%`, link to `/en/explorer/demography/age-sex` with "since 2004"; Imereti — `510,741`, `22.0%`, `53.6%`, the regions link text; municipality `"06"` — empty string; en markup has no Georgian. `populationPlacePages.test.tsx`: Georgia, `region/imereti`, `region/tbilisi` pages contain `id="age-sex"` after `id="births-deaths"` (index comparison); `batumi` does not contain `age-sex`. Run: FAIL.
- [ ] **Step 2: Implement** the section, the exports and the page wiring.
- [ ] **Step 3: Run** the two files and `tests/explorer/vitalSection.test.tsx`: PASS. Typecheck: PASS.
- [ ] **Step 4: Commit** `feat(demography): age and sex block on Georgia and region pages`.

---

### Task 7: The national page, routes, hub card and discovery

**Files:**
- Create: `lib/explorer/demographyAgeSexRegions.ts`, `components/demography/age-sex-regions.tsx`, `components/demography/age-sex-explorer.tsx`, `lib/pages/demography-age-sex.tsx`, `app/(ka)/explorer/demography/age-sex/page.tsx`, `app/(en)/en/explorer/demography/age-sex/page.tsx`
- Modify: `lib/explorer/demographyRoutes.ts` (`live: true`), `lib/explorer/demographyHubCards.ts`, both `demography.json`, `data/localization/en/page-revisions.json`, `public/llms.txt`
- Test: `tests/explorer/demographyAgeSexRegions.test.ts`, `tests/explorer/demographyPages.test.tsx`, `tests/explorer/demographyHub.test.ts`, `tests/explorer/demographyDiscovery.test.ts`, `tests/explorer/demographySidebar.test.tsx`, `tests/seo/agentFiles.test.ts`, `tests/seo/routes.test.ts`, then every pin the two new URLs move.

**Interfaces:**
- Produces:
  - `buildAgeSexRegionModel(served: readonly ServedDemographyObservation[], regions: readonly MunicipalRegion[]): RegionMapModel` — 65+ share of the census total (settlement `total`, men + women) for the 11 regions, built like `buildUnemploymentRegionMapModel` (`regionalMapGeometry`, `quantileBucket`, sorted descending, ties by `sortOrder`, `firstYear = year = 2024`); throws on a missing region or geometry. Also `georgiaOldShare(served): number`.
  - `AgeSexRegions({ model, georgiaShare, sourceNote })` (client) — `RegionIndex` with `metric = { hrefForRegion: (id) => \`${populationPlaceHref(id)}#age-sex\`, formatValue: (v) => formatShare(v / 100), mapAria: t("regionMapAria"), entityAria: (name, value) => t("regionEntityAria", { name, share }), legend: t("regionLegend"), testId: "age-sex-region-map" }` and `summary` = Georgia 65+, oldest region (name + share), youngest region; heading `SectionTitle` `t("regionsTitle")`.
  - `AgeSexExplorer({ facts, sources, siteOrigin }: { facts: ClientAgeFact[]; … })` (client) — reads the hash after hydration, writes it with `useReplaceHash(serializeAgeSexHash(state, years), ready)`, calls `useAppReady()` (the only component on the page that does). Three `<section>`s (`data-testid` `age-sex-pyramid`, `age-sex-bands`, `age-sex-heatmap`), each with `SectionTitle`, `SourceNote` `t("annualSource", { first, last })` and a `Download`:
    - pyramid — `YearButtonRow` (`testId="age-sex-year-row"`, `tagFor` = break label on 2025; the spec's dashed divider before 2025 is not drawn — the tag carries it, so `YearButtonRow` needs no second option); `%`/persons `SegmentedTabs` with persons `disabled`-equivalent when crossing (render the persons option inert: clicking does nothing, `aria-disabled`, `title={t("personsDisabled")}`); a `შედარება` `TextTab` toggling `compare` (first year by default) that reveals a second `YearButtonRow` (`age-sex-compare-row`); a `Callout` `t("compareNote", …)` when crossing; `ModeTabs`; `PopulationPyramid` (max width 640, centred) or `PyramidTable`; the summary line `t("pyramidSummary", …)` for the selected year only.
    - bands — `ModeTabs`; `EditorialLineChart` with the 0–14 and 65+ series (colours `SERIES_COLORS["sex.male"]` and `ACCENT`; unit `UNIT_DENSITY` (one decimal) with `formatTooltipValue={(v) => formatShare(v / 100)}`; for the `%` on the axis follow an existing percent line chart (grep `share={true}` or a `%` unit) before choosing), `breaks`, `ariaLabel` `t("bandsAria", …)`; caption `t("bandsCaption", { share, year })`; table view `ExplorerTable` with all three bands and `breakYears`.
    - heat map — `HeatmapTable` with `heatmapRows`, `format = (v) => formatShare(v === null ? null : v / 100)`, `breakYear={CENSUS_STEP.toYear}`, `breakLabel`, `rowHeader={t("ageHeader")}`, caption `t("heatCaption", …)`, note `t("heatNote")`; no mode tabs.
  - `demographyAgeSexPageMetadata(locale)` and `renderDemographyAgeSexPage(locale)` in `lib/pages/demography-age-sex.tsx`, structured as `renderDemographyBirthsDeathsPage`: presentation scopes = `loadPopulationBasics`' plus `regionalEconomies`; `PageHeader` coverage `t("ageSexCoverage", { first, last })`; `ExplorerHeading` `ageSexTitle`; lead `t("ageSexLead", { first })`; `<AgeSexRegions>` then `<AgeSexExplorer facts={annualAgeFacts(served)} sources={sources filtered to SOURCE_ID.ageSex} …>`; `BreadcrumbJsonLd`; the page throws if `ageYears` does not end at the Population index's last year.
  - Route files exactly like Births' (`generateMetadata` + default `Page`).
  - Hub card: `if (page.id === "age-sex" && page.live)` → `series` = Georgia 65+ share by year (from `population_age_band`), `seriesColor: INK`, `footer: t("ageSexCardFooter", { year, share: formatShare(last / 100), first, last })`.

Messages (en / ka draft):

| Key | en | ka |
| --- | --- | --- |
| `ageSexMetaTitle` | Age and sex — Demography | ასაკი და სქესი — დემოგრაფია |
| `ageSexCoverage` | {first}–{last} · annual, and the 2024 census | {first}–{last} · წლიური და 2024 წლის აღწერა |
| `ageSexLead` | How old Georgia’s people are: the regions in the 2024 census, and Georgia’s age structure on 1 January of every year since {first}. | რამდენი წლისაა საქართველოს მოსახლეობა: რეგიონები 2024 წლის აღწერით და საქართველოს ასაკობრივი სტრუქტურა ყოველი წლის 1 იანვრისთვის, {first} წლიდან. |
| `regionsTitle` | Share aged 65 and over, by region | 65 წლის და უფროსი მოსახლეობის წილი რეგიონების მიხედვით |
| `regionMapAria` | Regions by share of residents aged 65 and over, census 2024 | რეგიონები 65 წლის და უფროსი მოსახლეობის წილის მიხედვით, აღწერა 2024 |
| `regionEntityAria` | {name}: {share} aged 65 and over, census 2024 | {name}: 65 წლის და უფროსი — {share}, აღწერა 2024 |
| `regionLegend` | Share aged 65+, census 2024 | 65+ წილი, აღწერა 2024 |
| `kpiGeorgiaOld` | Georgia, aged 65+ | საქართველო, 65+ |
| `kpiOldest` | Oldest region | ყველაზე ხანდაზმული რეგიონი |
| `kpiYoungest` | Youngest region | ყველაზე ახალგაზრდა რეგიონი |
| `regionsSource` | Source: Geostat, 2024 census, counted on 14 November 2024. | წყარო: საქსტატი, 2024 წლის აღწერა, 2024 წლის 14 ნოემბრის მდგომარეობით. |
| `pyramidTitle` | Georgia’s population pyramid | საქართველოს მოსახლეობის პირამიდა |
| `compareToggle` | Compare | შედარება |
| `compareNote` | {year} and {compare} are on either side of the 2025 census re-base: the pyramid shows shares only and no difference is computed. | {year} და {compare} 2025 წლის აღწერით გადათვლის სხვადასხვა მხარესაა: პირამიდა მხოლოდ წილებს აჩვენებს და სხვაობა არ ითვლება. |
| `personsDisabled` | Counts on either side of the re-base are not comparable | გადათვლის სხვადასხვა მხარეს რიცხვები არ შედარდება |
| `pyramidSummary` | 0–14: {young} · 15–64: {working} · 65+: {old} · {ratio} women per 100 men | 0–14: {young} · 15–64: {working} · 65+: {old} · 100 მამაკაცზე {ratio} ქალი |
| `bandsTitle` | Age groups over time | ასაკობრივი ჯგუფები დროში |
| `bandsAria` | Shares of residents aged 0–14 and 65 and over, Georgia, {first}–{last} | 0–14 და 65+ წლის მოსახლეობის წილი, საქართველო, {first}–{last} |
| `bandsCaption` | Aged 15–64 is not drawn: {share} in {year}. | 15–64 წლის ჯგუფი არ არის ნაჩვენები: {share} {year} წელს. |
| `heatTitle` | Age by year | ასაკი წლების მიხედვით |
| `heatCaption` | Share of the population · {first}–{last} | წილი მოსახლეობაში · {first}–{last} |
| `heatNote` | Each cell is the age group’s share of that year’s population. Diagonals running up and to the right are people born in the same years, growing older. The 2025 census re-base moved some groups’ shares. | თითოეული უჯრა ასაკობრივი ჯგუფის წილია იმ წლის მოსახლეობაში. მარჯვნივ და ზემოთ მიმავალი დიაგონალები ერთ წლებში დაბადებული ადამიანები არიან, რომლებიც ბერდებიან. 2025 წლის აღწერით გადათვლამ ზოგი ჯგუფის წილი შეცვალა. |
| `heatScale` | share of the population | წილი მოსახლეობაში |
| `annualSource` | Source: Geostat, population on 1 January by five-year age groups and sex, {first}–{last}. | წყარო: საქსტატი, მოსახლეობა 1 იანვრის მდგომარეობით 5-წლიანი ასაკობრივი ჯგუფებისა და სქესის მიხედვით, {first}–{last}. |
| `ageSexCardFooter` | {year}: {share} aged 65+ · {first}–{last} | {year}: 65+ — {share} · {first}–{last} |

- [ ] **Step 1: Failing tests.**
  - `demographyAgeSexRegions.test.ts`: 11 regions, order and one-decimal values exactly the anchor list, rank 1 Racha-Lechkhumi, `georgiaOldShare` `"17.6"`.
  - `demographyHub.test.ts`: all four pages live; hrefs all non-null; `comingSoon` all false; the age card's series has 23 values, first 14.07… and last 18.07… (to 0.01), footer `"2026: 18.1% aged 65+ · 2004–2026"`.
  - `demographyPages.test.tsx`: hub `aria-disabled="true"` count `1` → `0`; add a describe "age and sex page" asserting the en page contains `>Age and sex</h1>`, `2004–2026 · annual, and the 2024 census`, `href="/en/explorer/demography/population/region/racha_lechkhumi_kvemo_svaneti#age-sex"` (use the real slug from `populationPlaceHref`), `31.2%`, `13.1%`, `data-testid="age-sex-pyramid"`, `data-testid="age-sex-bands"`, `data-testid="age-sex-heatmap"`, `breadcrumb-json-ld`, no `"@type":"Dataset"`, and the Georgian-free check the Births describe uses; ka metadata canonical `https://fiscal.ge/explorer/demography/age-sex`, title `ასაკი და სქესი — დემოგრაფია | Fiscal.ge`.
  - `demographyDiscovery.test.ts`: add the path to `PAGES` and the dated list. `demographySidebar.test.tsx`: a case for `/en/explorer/demography/age-sex` expecting `data-testid="demography-age-sex-link" aria-current="page"`. `agentFiles.test.ts`: the URL after births-deaths.
  Run: FAIL.
- [ ] **Step 2: Messages** (table above), **Step 3: regions model and wrapper**, **Step 4: explorer**, **Step 5: page, routes, flag, hub card.**
- [ ] **Step 6: Revisions and llms.txt.** `page-revisions.json`: add `"/explorer/demography/age-sex": "<today>"`; set `"/explorer/demography"` and the Population Georgia/region routes (as the file lists them) to today. `public/llms.txt`: the Demography line names all four pages; add an Age and sex line after Births in the existing format.
- [ ] **Step 7: Recount every pin.** `npx vitest run tests/seo tests/i18n tests/explorer tests/methodology` and `npm run i18n:check`. Expected moves: sitemap +2 (`tests/seo/routes.test.ts`, and the same two numbers in `tests/browser/seo.spec.ts`), public identities +1 against Task 0, `tests/browser/bilingual-complete.spec.ts` path count +1, sidebar coming-soon badges −1 (to 0 for demography), hub coming-soon −1. Derive each number from what it counts; list file and old → new in the report.
- [ ] **Step 8: Run** the Step 1 files, `tests/seo`, typecheck, lint: PASS. **Commit** `feat(demography): publish the Age and sex page`.

---

### Task 8: Methodology page and the two originals

**Files:**
- Modify: `data/methodology/source-archives/demography.csv`, `lib/methodology/sourceInventory.ts`, `lib/methodology/content/en/demography.ts`, `lib/methodology/content/demography.ts`
- Test: `tests/explorer/demographyPages.test.tsx` (population sources), methodology tests

- [ ] **Step 1: Failing test.** In `demographyPages.test.tsx` "population sources": add `source.geostat_demography_population_age_sex` and `source.geostat_census2024_population_by_age_settlement` to `REVIEWED_SOURCE_IDS` (sorted) and change the length `12` → `14`. Run: FAIL.
- [ ] **Step 2: Archive rows.** Append two rows in the existing column order (BOM kept, LF), from `docs/Raw Data/Demography/geostat-demography/2026-10/source-manifest.csv`:
  - `source.geostat_demography_population_age_sex,demography,2004-2026,საქსტატი,მოსახლეობა 1 იანვრის მდგომარეობით 5-წლიანი ასაკობრივი ჯგუფებისა და სქესის მიხედვით,02-population-by-age-groups-and-sex.xlsx,https://geostat.ge/media/78359/02-population-by-age-groups-and-sex.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/02-population-by-age-groups-and-sex.xlsx,downloads/methodology/demography/files/02-population-by-age-groups-and-sex.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,30302,24090597005b62bcba6ec966a4cbf6726e97f1c8fb03245404f8edf94a5770f1,2026-10-01,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,Population on 1 January by five-year age group and sex for Georgia; the census re-base applies from 2025.`
  - `source.geostat_census2024_population_by_age_settlement,demography,2024,საქსტატი,"მოსახლეობა რეგიონების, თვითმმართველი ერთეულების, 5-წლიანი ასაკობრივი ჯგუფების, ქალაქ-სოფლისა და სქესის მიხედვით (2024 წლის 14 ნოემბრის მდგომარეობით)",1.1-population-by-region-unit-age-settlement-sex.xlsx,https://geostat.ge/media/80811/1.1-Population-by-regions%2C-self-governed-units%2C-5-year-age-groups%2C-urban-rural-settlements-and-sex.xlsx,docs/Raw Data/Demography/geostat-demography/2026-10/official/census-2024/1.1-population-by-region-unit-age-settlement-sex.xlsx,downloads/methodology/demography/files/1.1-population-by-region-unit-age-settlement-sex.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,111570,691329dbd890070a888234f2f182496e4132f67948879675a188584c5e34dec7,2026-10-03,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,2024 census counts by region and self-governed unit, age group, urban and rural settlement and sex; one date.`
  Byte sizes and hashes are the manifest's; `validateSourceManifest` re-checks them — if it disagrees, re-measure from the file and report. If the archive's other rows quote fields differently, follow them. The Georgian titles are drafts. If the English catalogue (`data/localization/en/documents.json`) lacks either id, add it with the manifest's English title.
- [ ] **Step 3: Inventory.** Add `"02-population-by-age-groups-and-sex.xlsx"` and `"1.1-population-by-region-unit-age-settlement-sex.xlsx"` to the demography `official` list in `sourceInventory.ts` (the census file is under `census-2024/`; if the include runs on a non-recursive listing, add a second entry rooted at `…/official/census-2024` instead).
- [ ] **Step 4: Methodology text** — every number identical in both languages. English (`content/en/demography.ts`):
  - `summary`: replace the ending with "…, registered births and deaths, 2014–2025, with Georgia’s fertility and life expectancy, and the population by age and sex: Georgia 2004–2026 and the 2024 census for Georgia and the 11 regions."
  - `reviewedAt`: today. `disclosure`: append " For age and sex Fiscal.ge adds the published ages 0 and 1–4 into one 0–4 group and computes shares, the share aged 65 and over and women per 100 men."
  - `scope`: append " Population by five-year age group and sex covers Georgia, 2004–2026; the 2024 census adds the 11 regions, with urban and rural settlements, on one date, 14 November 2024."
  - `sources`: add "Age and sex: Geostat, population on 1 January by five-year age group and sex, and the 2024 census population by region, self-governed unit, five-year age group, urban and rural settlement and sex. Census counts are one date and are never placed on the annual timeline; the 1 January 2025 estimate is not the census count."
  - `validation`: add "The age groups add up to the published total in every year and sex, the three broad age groups equal the sums of their five-year groups, and the census age groups add up to the census totals of Georgia and of each region."
  - `limitations` last paragraph: replace "Projections and the age-and-sex structure are not yet published." with "Projections, single years of age and municipal age structure are not published."
  - `archive`: "Fourteen untouched Geostat Excel files: …" (add "population on 1 January by age group and sex, the 2024 census population by age, settlement and sex," in the list).
  - Georgian (`content/demography.ts`): the same changes as drafts, mirroring the English sentences.
- [ ] **Step 5: Run** `npx vitest run tests/methodology tests/explorer/demographyPages.test.tsx` and `npm run data:validate`: PASS. If a methodology test pins the demography archive count (12), derive 14 and report it.
- [ ] **Step 6: Commit** `docs(demography): age and sex in the methodology page and archive`.

---

### Task 9: Browser tests

**Files:**
- Create: `tests/browser/demography-age-sex.spec.ts`
- Modify: `tests/browser/main-explorer.spec.ts` (payload-guard list), `tests/browser/pristine-urls.spec.ts`, coming-soon counts in `methodology.spec.ts` and `demography-population.spec.ts` (derive), any other spec Task 7's pins named

- [ ] **Step 1: Pins.** Add `/explorer/demography/age-sex` to the payload-guard list and to `pristine-urls.spec.ts` the way births-deaths is listed; derive the coming-soon counts (Age and sex was the last one).
- [ ] **Step 2: The spec**, with the helpers of `demography-births-deaths.spec.ts` (`TEST_BASE_URL`, `expectAppReady`, overflow helper, download helper):
  - national page (en): four parts render; year row has 23 buttons with 2026 pressed; pressing `ArrowUp` on the focused pyramid row moves focus to the next row; clicking 2010 sets `#year=2010` and the summary changes; turning compare on with 2004 shows the outline legend and no note; choosing year 2026 with compare 2004 shows the note and the persons tab is `aria-disabled`; loading `#year=2026&cmp=2004&measure=persons` shows shares (tick labels end in `%`); pyramid table toggles and shows `3,941,103`; bands chart shows the break label; heat map header 2025 carries the break label; the Racha-Lechkhumi row link lands on its region page with `#age-sex` and the block is in view.
  - place pages: Imereti block switches All → Cities → Villages (the total-row figure changes; `kpi` 510,741 does not); Batumi has no `#age-sex`; the block's download is an `.xlsx`.
  - Georgian national page renders; Analysis year row and Unemployment heat map still pass their own specs (run them in Step 3).
  - 390px: national page and Imereti have no sideways page scroll; the heat map scroller is scrollable and starts at the right.
- [ ] **Step 3: Run on a production build.** Kill any server on :3100; `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100` (background); `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/demography-age-sex.spec.ts tests/browser/demography-population.spec.ts tests/browser/demography-births-deaths.spec.ts tests/browser/bilingual-analysis.spec.ts tests/browser/unemployment-age.spec.ts tests/browser/mobile-repairs-polish.spec.ts tests/browser/seo.spec.ts tests/browser/methodology.spec.ts`: PASS. Stop the server.
- [ ] **Step 4: Commit** `test(demography): browser checks for age and sex`.

---

### Task 10: Documents and the completion gates

- [ ] **Step 1: DESIGN.md.** In the Population section add "Age and sex block" (anchor `#age-sex`, after Births and deaths, census pyramid with settlement and measure tabs, three key figures, own Excel, link to the national page); add the Age and sex national page (four parts, one scrolling page, hash keys, the pyramid's anatomy from spec §6, the heat map reusing `HeatmapTable` with a break rule, `YearButtonRow` shared with Analysis). Keep to the spec.
- [ ] **Step 2: Project_Definition.md** section 2: all four Demography pages live; the block on Georgia and region pages.
- [ ] **Step 3: Data docs.** `docs/data-methodology/demography.md`: the structure and census files served whole (4,215 rows), the census family's `census_count` basis, the computed 0–4 group, the two originals. `docs/data-methodology/database-import.md`: DemographyFact `5,525 → 9,740` wherever stated (log `csv=9740 db=9740`). `docs/deployment.md` "Demography release checks": `/explorer/demography/age-sex` (ka, en) shows Racha-Lechkhumi 31.2%; Imereti's page has `#age-sex` with 510,741 counted.
- [ ] **Step 4: Gates, once.** From `apps/web`: `npm run check` and `npm run build`: exit 0. Then the whole browser suite on a production build as `CLAUDE.md` describes: all pass (re-run a failing download/request spec alone first; report both runs).
- [ ] **Step 5: Commit and report** `docs(demography): design, scope, methodology and release checks for age and sex`. Report: gate results with counts, every pin moved (file, old → new), and the full list of new Georgian strings for the owner.
