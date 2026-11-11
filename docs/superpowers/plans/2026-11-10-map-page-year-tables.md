# Every Year on the Map Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 22 map index pages carry, in hidden crawl tables, every year of their figures for every place they list.

**Architecture:** One shared module turns "places x years" into `CrawlTable`s, and one hook-free component writes them
as the existing hidden wrapper. Municipal pages build their histories on the server from the facts their renderers
already load. Region pages get a `history` on `RegionMapModel` and pass it to `RegionIndex` through a new `crawl` prop,
which formats cells with each page's own `formatValue`.

**Tech Stack:** Next.js 16 (static export), React server and client components, strict TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-map-page-year-tables-design.md`

## Global Constraints

- Nothing visible changes on any page (desktop and phone screenshots match `main`).
- Wrapper markup is exactly `<div hidden="" data-testid="crawl-tables">…</div>` holding only `<table>`s, as `crawlTablesHtml` writes them.
- No page holds more than 3,000 `<td>` cells in all its wrappers (`CRAWL_CELL_CAP`); tables here are never trimmed.
- Compressed size: at most +25% per touched page, at most +1% for the whole site (gzip level 6, as `crawl:check` measures).
- Columns: every year in which any listed place has a figure, labelled as the page labels years (school years `2015/16`); a missing figure prints `—` (`MISSING`).
- Rows: Georgia first, then places in the order the page's list shows them (ranked by the latest year).
- Municipal pages: two tables per figure, municipalities then regions, Georgia first in each. Tbilisi is list id `04` and fact id `region.tbilisi`.
- Captions: `title · figure · unit · first–last` (school-year labels in the period).
- Georgian keeps established text; any new message key is listed in `/mnt/project-files/ai-map-tables/notes-for-duru.md` for proofreading.
- The browser never builds these tables (DESIGN.md §8.4).

## Review Focus

1. English pages: row labels must be English names (`publicLabel("en", …)`), never Georgian or raw codes — test in Task 1 and the en spot checks in Task 7.
2. Places with no figure in an early year (Georgia from 2000/01 on Schools, regions starting in 2017/2019 on some region pages) print `—`, never `0` — test in Task 1.
3. Pages with a map measure switch (Business, Household income and spending) carry tables for every measure, not only the default shown on load — test in Task 5 and the spot check in Task 7.
4. Hydration: after the page opens in the browser, the wrapper still holds the server's tables (it is not emptied) — browser test in Task 7.
5. Marriages and Births pages stay under 3,000 cells together with their existing Georgia tables — `crawl:check` in Task 7.

---

### Task 1: Shared table builder and wrapper component

**Files:**
- Create: `apps/web/lib/explorer/indexCrawlTables.ts`
- Create: `apps/web/components/explorer-shell/index-crawl-tables.tsx`
- Test: `apps/web/tests/explorer/indexCrawlTables.test.ts`

**Interfaces:**
- Produces:
  - `type HistoryRow = { label: string; valuesByYear: Readonly<Record<number, number | null>> }`
  - `historyCrawlTable(input: { caption: string; years: readonly number[]; columns: readonly string[]; rows: readonly HistoryRow[]; format: (value: number) => string; category?: string }): CrawlTable` — cells are `format(value)` or `MISSING`.
  - `historyCaption(parts: readonly string[], columns: readonly string[]): string` — `parts` joined with ` · `, then `${columns[0]}–${columns.at(-1)}` (a single column: just it).
  - `municipalHistoryTables(input: { caption: (level: string) => string; levels: { municipalities: string; regions: string }; years: readonly number[]; columns: readonly string[]; country: HistoryRow; municipalities: readonly HistoryRow[]; regions: readonly HistoryRow[]; format: (value: number) => string }): CrawlTable[]` — exactly two tables: `[municipalities table, regions table]`, each with `country` as its first row; `caption(levels.municipalities)` / `caption(levels.regions)`.
  - `IndexCrawlTables({ tables, category }: { tables: readonly CrawlTable[]; category: string })` — no `"use client"`, no hooks; renders `<div hidden data-testid="crawl-tables" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: tables.length ? crawlTablesHtml(tables, category) : "" }} />`.

- [ ] **Step 1: Write the failing tests** in `tests/explorer/indexCrawlTables.test.ts`:
  - `historyCrawlTable prints every year and a dash for a missing one`: years `[2015, 2016]`, columns `["2015/16", "2016/17"]`, one row `{ label: "Khulo", valuesByYear: { 2015: 3936 } }`, format `v => v.toLocaleString("en-US")` → `rows[0].cells` equals `["3,936", "—"]`, `columns` equals `["2015/16", "2016/17"]`.
  - `historyCaption names the first and last column`: `historyCaption(["Schools", "Pupils"], ["2005/06", "2025/26"])` → `"Schools · Pupils · 2005/06–2025/26"`.
  - `municipalHistoryTables puts Georgia first in both tables`: two municipality rows and one region row → two tables; `tables[0].rows.map(r => r.label)` equals `["Georgia", "Khulo", "Shuakhevi"]`; `tables[1].rows[0].label` is `"Georgia"`; captions contain `"Municipalities"` and `"Regions"`.
  - `IndexCrawlTables writes the hidden wrapper`: `renderToStaticMarkup(<IndexCrawlTables tables={[table]} category="Place" />)` starts with `<div hidden="" data-testid="crawl-tables">` and contains `<td>3,936</td>`; with `tables={[]}` the wrapper is empty.

- [ ] **Step 2: Run to verify it fails** — `cd apps/web && npx vitest run tests/explorer/indexCrawlTables.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** the four exports in the two files. Reuse `CrawlTable`, `crawlTablesHtml` from `lib/explorer/crawlTables.ts` and `MISSING` from `lib/explorer/format.ts`.

- [ ] **Step 4: Run to verify it passes** — same command → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(crawl): shared every-year tables for map index pages"`

### Task 2: Schools, Kindergartens, Pensions, Subsistence allowance

**Files:**
- Modify: `apps/web/lib/explorer/educationIndex.ts`, `apps/web/lib/pages/education-places.tsx` (`renderEducationIndexPage`)
- Modify: `apps/web/lib/explorer/socialIndex.ts`, `apps/web/lib/pages/social-places.tsx` (`renderSocialIndexPage`)
- Test: `apps/web/tests/explorer/educationIndex.test.ts` (create), `apps/web/tests/explorer/socialIndex.test.ts` (create)

**Interfaces:**
- Consumes: Task 1 (`municipalHistoryTables`, `historyCaption`, `IndexCrawlTables`).
- Produces: `EducationIndexModel.history` and `SocialIndexModel.history`, each `{ years: number[]; figures: Array<{ id: string; valueAt: (listRowId: string, year: number) => number | null }> }`, where `listRowId` is a municipality code (`04` = Tbilisi), a region id, or `MUNICIPAL_COUNTRY_ID`. Education: one figure (`pupils` for schools, `children` for kindergartens; Georgia from `pupils_national.total` for schools, as the latest-year value already does). Social: two figures, the recipients count (`social.pension.recipients` / `social.subsistence.persons`) and the share per 100 residents (`INDEX_SHARE[set]`).

- [ ] **Step 1: Write the failing tests:**
  - `educationIndex history: Khulo pupils 3,936 in 2015/16 and 2,075 in 2025/26` — load facts with `loadServedEducationData()` + `shownEducationFacts` + `toClientEducationFact` and the registry with `loadServedMunicipalData()` (as `lib/pages/education-places.tsx` does), build the schools model; assert `history.figures[0].valueAt("11", 2015)` is 3936 and `("11", 2025)` is 2075 (Khulo), `valueAt("10", 2015)` is 2410 and `("10", 2025)` is 1137 (Shuakhevi), `valueAt("04", 2025)` is 232134 (Tbilisi through `region.tbilisi`), `history.years[0]` is 2000 (Georgia's national table) and `valueAt("11", 2000)` is `null`.
  - `socialIndex history carries the count and the share` — pensions model; `figures.length` is 2; the share for Georgia in the latest year equals the existing `country.valueGel`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/educationIndex.test.ts tests/explorer/socialIndex.test.ts` → FAIL.
- [ ] **Step 3: Add `history`** to both builders from the facts they already filter; the latest-year `year`, `map` and rows stay byte-identical.
- [ ] **Step 4: Render the tables** in both page renderers: after the index `<section>`, `<IndexCrawlTables category={workbookMessage(locale, "workbook.category")} tables={…} />` with `municipalHistoryTables` per figure; rows from the model's ranked `municipalities` / `regions` / `country` (labels: `nameKa` for ka, `publicLabel("en", id, nameKa, presentation.englishLabels)` for en); columns `years.map(period)` (`educationPeriodLabel(set)` for education, `String` for social); levels `municipal.municipalities` / `municipal.regions` (add the `municipal` namespace to the page's presentation if absent); caption parts: page title, the figure's existing heading message, unit. Formats: persons `#,##0` and share `0.0` through `formatCrawlCell(value, null, format, locale)`.
- [ ] **Step 5: Run** the two test files → PASS; `npm run typecheck` → no errors.
- [ ] **Step 6: Commit** — `feat(crawl): every year on the Schools, Kindergartens, Pensions and Allowance maps`

### Task 3: Population, Births and deaths, Marriages and divorces

**Files:**
- Modify: `apps/web/lib/explorer/demographyPopulationIndex.ts`, `demographyVitalIndex.ts`, `demographyMarriageIndex.ts`
- Modify: `apps/web/lib/pages/demography-population.tsx`, `demography-births-deaths.tsx`, `demography-marriages-divorces.tsx`
- Test: `apps/web/tests/explorer/demographyPopulationIndex.test.ts`, `demographyVitalIndex.test.ts` (extend), `demographyMarriage.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1; the `history` shape from Task 2.
- Produces: `history` on `PopulationIndexModel` (figure `population`, `SERIES.populationTotal`), `VitalIndexModel` (figures `births`, `deaths`, `birthsPer100Deaths`), `MarriageIndexModel` (figures `marriages`, `divorces` only; no rate).

- [ ] **Step 1: Write the failing tests:** each model's `history.years` spans the municipal series (population 2015–2026, vital 2015–2025, marriages 2009–2025); one spot value per model read from its CSV row in the test; vital `birthsPer100Deaths` for Georgia in the latest year equals the existing `country.valueGel`; marriages `figures.map(f => f.id)` equals `["marriages", "divorces"]`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/demographyPopulationIndex.test.ts tests/explorer/demographyVitalIndex.test.ts tests/explorer/demographyMarriage.test.ts` → FAIL.
- [ ] **Step 3: Add `history`** to the three builders (latest-year output unchanged).
- [ ] **Step 4: Render the tables** in the three page renderers as in Task 2, Step 4 (columns `String(year)`; counts `#,##0`, the ratio `0.0`). Place the wrapper after the places section, apart from the existing Georgia `CrawlTables`.
- [ ] **Step 5: Run** → PASS; `npm run typecheck` clean.
- [ ] **Step 6: Commit** — `feat(crawl): every year on the Population, Births and Marriages maps`

### Task 4: Municipal budgets index

**Files:**
- Modify: `apps/web/lib/pages/municipal-index.tsx` (`renderMunicipalIndex`)
- Test: `apps/web/tests/explorer/municipalData.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1; `buildMunicipalListRows` (`lib/explorer/municipalData.ts`), called once per year in `years`.
- Produces: two figures, total spending (`valueGel`) and spending per resident (`budgetPerResidentGel`, `null` where no population), for municipalities and regions; Georgia's total from `countryTotalFacts`, its per-resident figure from the same source the Georgia row uses.

- [ ] **Step 1: Write the failing test** `municipal index history matches the list in the comparison year`: for `MUNICIPAL_PER_RESIDENT_YEAR`, the history's totals and per-resident values equal the list rows' `valueGel` / `budgetPerResidentGel` for every municipality; every year in `years` has a total for every municipality.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/municipalData.test.ts` → FAIL.
- [ ] **Step 3: Extract** `municipalIndexHistory(data, years)` (in `lib/explorer/municipalData.ts`, beside `buildMunicipalListRows`) and render two figures' tables after the index, format `#,##0` (GEL) and `#,##0` (GEL per resident).
- [ ] **Step 4: Run** → PASS; typecheck clean.
- [ ] **Step 5: Commit** — `feat(crawl): every year on the Municipal budgets map`

### Task 5: Region map history and `RegionIndex` crawl prop

**Files:**
- Modify: `apps/web/lib/explorer/regionalEconomyMap.ts` (`RegionMapModel`, `latestCompleteRegionYear`, `buildLatestValueRegionMapModel`, `regionalEconomyMapData`)
- Modify: `apps/web/lib/explorer/householdRegionMap.ts`, `wagesRegionMap.ts`, `healthDeathRateMap.ts`
- Modify: `apps/web/components/regional-economies/regional-economies-index.tsx` (`RegionIndex`)
- Test: `apps/web/tests/explorer/regionMapHistory.test.ts` (create), `apps/web/tests/explorer/regionalEconomiesIndex.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1 (`historyCrawlTable`, `historyCaption`, `IndexCrawlTables`).
- Produces:
  - `RegionMapModel.history?: { years: number[]; byRegion: Readonly<Record<string, Readonly<Record<number, number>>>> }` (keys are the map's `region.<id>` ids).
  - `latestCompleteRegionYear(...)` also returns `history`; `buildLatestValueRegionMapModel({ …, history? })` copies it onto the model. Builders that compute `latest` themselves (wages, health deaths, household, `regionalEconomyMapData` for nominal regional GDP) fill `history` from the same filtered facts.
  - `RegionIndex` prop `crawl?: ReadonlyArray<{ model: RegionMapModel; metric: Pick<RegionMapMetric, "formatValue" | "legend">; lead?: HistoryRow }>`. When given, `RegionIndex` renders `<IndexCrawlTables>` as the last child of its root fragment, one table per entry: caption `historyCaption([title, metric.legend], columns)`, rows `lead` (if any) then `model.regions` in rank order plus `withoutValue` regions (all `—`), labels via `publicLabel(locale, regionId, nameKa, englishLabels)`. Tables are built only when `typeof window === "undefined"`; in the browser it passes `[]`.

- [ ] **Step 1: Write the failing tests:**
  - `latestCompleteRegionYear returns every year per region`: three regional facts in two years → `history.years` `[2023, 2024]`, `history.byRegion["region.guria"][2023]` equals the fact's value.
  - `buildLatestValueRegionMapModel keeps history`.
  - `RegionIndex with crawl writes one table per view on the server`: `renderToStaticMarkup` inside the test i18n provider with two `crawl` entries → two `<table>`s inside the wrapper; first row label is the lead label; a region without a figure in an early year prints `—`.
  - `RegionIndex without crawl writes no wrapper` (unchanged markup for current callers).
- [ ] **Step 2: Run** `npx vitest run tests/explorer/regionMapHistory.test.ts tests/explorer/regionalEconomiesIndex.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the model field, builder changes and the prop.
- [ ] **Step 4: Run** → PASS; `npx vitest run tests/explorer/regionIndexLinks.test.tsx` still passes; typecheck clean.
- [ ] **Step 5: Commit** — `feat(crawl): region maps keep every year; RegionIndex writes them on request`

### Task 6: Wire the region pages and City air quality

**Files:**
- Modify (each passes `crawl` to `RegionIndex`; Georgia `lead` from the page's own Georgia facts, all years, where it already shows a `leadRow`):
  `components/business/business-index.tsx` (both measures: `turnover`, `employed`),
  `components/regional-economies/regional-economies-index.tsx` (`RegionalEconomiesIndex`, nominal regional GDP),
  `components/housing/housing-index.tsx`, `components/money-banks/money-banks-index.tsx`, `components/transport/transport-index.tsx`,
  `components/wages/wages-regions-index.tsx`, `components/internet/internet-index.tsx`,
  `components/household/household-index.tsx` (both `HOUSEHOLD_MEASURES`, for income and spending),
  `components/science-culture/museums-index.tsx`, `components/environment/environment-region-index.tsx` (forests, waste),
  `components/health/health-deaths-index.tsx`.
  Not touched: `unemployment-regions-index.tsx` (already carries its tables) and `demography/age-sex-regions.tsx`.
- Modify: `apps/web/lib/pages/environment-air-quality.tsx` (`renderEnvironmentAirQualityIndex`): after the cards, `<IndexCrawlTables>` with one table, rows one per station (`${city} — ${station}`, the station each city card shows plus the city's other stations), values the station's yearly PM10 average (Zestaponi: dust TSP), format `#,##0`, columns `String(year)`.
- Test: `apps/web/tests/explorer/businessIndexCrawl.test.tsx` (create); every other page is covered by Task 7's `crawl:check` routes.

**Interfaces:**
- Consumes: Task 5 (`crawl` prop, `RegionMapModel.history`), Task 1.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test** in `tests/explorer/businessIndexCrawl.test.tsx` (create): `BusinessIndex renders tables for sales and jobs` — server markup holds two tables whose captions contain `business.map.turnover` and `business.map.employed` messages.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/businessIndexCrawl.test.tsx` → FAIL.
- [ ] **Step 3: Wire** every listed component (`metric` entries reuse the component's existing `valueLabel`/`formatValue` and legend for that measure) and the air-quality renderer.
- [ ] **Step 4: Run** the test → PASS; typecheck clean.
- [ ] **Step 5: Commit** — `feat(crawl): every year on the region maps and City air quality`

### Task 7: Guards, llms.txt and docs

**Files:**
- Modify: `apps/web/scripts/check-crawl-tables.ts` — add `MAP_INDEX_ROUTES` (the 22 routes) that must carry a wrapper with a table, in ka and en; spot checks: `education/schools` has a row `ხულო` / `Khulo` with `3,936` and `2,075` and a row `შუახევი` / `Shuakhevi` with `2,410` and `1,137`; `business/regions` has two tables; `health/pensions` has four tables.
- Modify: `apps/web/tests/explorer/crawlTableCoverage.test.ts` — a test that each of the 18 files touched in Tasks 2–6 (2 + 3 + 1 + 12) contains `<IndexCrawlTables` or `crawl={`.
- Modify: `apps/web/lib/seo/llmsText.ts` — replace "Map pages (such as Population, Pensions, Schools and the by-region pages) list the latest year, with the year-by-year table on each region's or Georgia's own page" with "Map pages (such as Population, Pensions, Schools and the by-region pages) have a year-by-year table of every place they list"; keep the 27,000-byte cap.
- Modify: `apps/web/tests/seo/agentFiles.test.ts` for the new sentence.
- Modify: `DESIGN.md` §8.4 — one sentence: map index pages carry every year of their figures for every listed place (`IndexCrawlTables`, never trimmed).
- Modify: `apps/web/tests/browser/crawl-table.spec.ts` — on `/explorer/education/schools` and `/en/explorer/education/schools`, after load the wrapper is hidden and still contains `Khulo`/`ხულო` with `3,936`.

- [ ] **Step 1: Write the failing tests** (coverage test, agentFiles sentence).
- [ ] **Step 2: Run** `npx vitest run tests/explorer/crawlTableCoverage.test.ts tests/seo/agentFiles.test.ts` → FAIL.
- [ ] **Step 3: Implement** the script, llms.txt and DESIGN.md changes.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `test(crawl): guard the map index tables; llms.txt and DESIGN say so`

### Task 8: Build, measure and preview (no push)

- [ ] **Step 1:** `cd apps/web && NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build` → exit 0.
- [ ] **Step 2:** `npm run crawl:check` → no failures; record per-page cells and gzip for the 44 pages and the total; compare with the `main` build scan (`/tmp/claude-0/-home-user/6b6026f5-1450-59bf-b247-ed7ca4a37722/scratchpad/scan.json`, or rebuild `main` in a worktree). Pass: each page ≤ +25%, site ≤ +1%.
- [ ] **Step 3:** Serve (`npm run start -- --port 3100`, own process group per CLAUDE.md) and take desktop and phone screenshots of the 22 Georgian pages on this branch and on `main`; pixel-compare; expected: identical.
- [ ] **Step 4:** Run the touched browser specs with `CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3100`: `crawl-table`, `education`, `social`, `demography-population`, `demography-births-deaths`, `demography-marriages-divorces`, `municipalities`, `regional-economies`, `unemployment-regions` → all pass.
- [ ] **Step 5:** Write `/mnt/project-files/ai-map-tables/notes-for-duru.md` (sizes, new Georgian text to proofread, what an AI now sees on Schools) and stop: show Duru before `npm run check`, push or PR.
