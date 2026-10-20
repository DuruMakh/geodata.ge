# Marriages and Divorces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth Demography page, Marriages and divorces, with Georgia 1994–2025 (counts, per 1,000 residents, average ages, marriage length), a 2025 municipality map, and a marriages-and-divorces section on every Population place page.

**Architecture:** Geostat's marriage, divorce and mid-year population tables join the existing demography pipeline (archived package → `prepareDemography` → two new canonical CSVs → `DemographyFact` mirror). Rates per 1,000 are calculated at page stage from the served counts and Geostat's mid-year population, as Crime and justice does per 100,000; validation proves the method reproduces every rate Geostat publishes for Georgia and the regions. The national page reuses the Births and deaths layout (`MunicipalitiesIndex`) plus a Crime-style list explorer on `topicSeries`/`unitList`; place pages get a section like `VitalSection`.

**Tech Stack:** Next.js 16 static pages, strict TypeScript, Vitest, Playwright, xlsx (SheetJS) readers in `lib/data/demography`.

**Spec:** `docs/superpowers/specs/2026-10-20-marriages-divorces-design.md` (approved by Duru 2026-10-20 "Build it"; places start 2009, decision 3 as amended).

## Global Constraints

- Georgia: 1994–2025 for every series. Regions and municipalities: 2009–2025 (counts and mid-year population). Nothing before 2009 for a place.
- Served series ids: `demography.marriages`, `demography.divorces` (unit `marriages`, `divorces`, basis `registered`), `demography.mid_year_population` (unit `persons`, may end in `.5`, basis `populationEstimateBasis(year)`), `demography.mean_age_at_marriage`, `demography.mean_age_at_first_marriage`, `demography.mean_age_at_divorce` (sex `male`/`female`, unit `years`, one decimal, basis `registered`), `demography.mean_marriage_duration` (unit `years`, one decimal, basis `registered`).
- Rates per 1,000 = count × 1000 ÷ mid-year population of the same place and year, shown with one decimal, marked calculated; the 2025 value carries the census "new counting" marker. Counts, ages and duration carry no marker.
- Values are read as stored; one-decimal values use `sheet.published(ref, 1)`. Geostat's 2018 divorce total (10,288) is 86 above its regions (10,202): a reviewed `unallocated` row, never filled or spread.
- Page: one line under the heading only ("2025: 22,285 ქორწინება, 13,173 განქორწინება"), fits one line at 375px. No KPI tiles, no tabs, icons Lucide only, series names without prefixes.
- Georgian is the default locale; every new string exists in `ka` and `en` (`npm run i18n:check`).
- Do not push, open a PR or run the full gates before Duru reviews screenshots and the preview (project rule).

## Review Focus

1. A municipality with very few marriages (Kazbegi, Lentekhi) — the map and list still show one decimal and never "0.0" for a non-zero count; the list's secondary line shows counts.
2. Hash links from another page (`#sel=...` with unknown ids) — the explorer falls back to the default selection, as Crime does.
3. Switching to per 1,000 with only age rows ticked — the chart is unchanged (ages have no rate) and the unit label stays "years".
4. Divorces 2018 for Georgia (10,288) shows while the regions add to 10,202 — no page sums regions to get Georgia.
5. Tbilisi is one municipality and one region — its place page shows one marriages section, and the map list ranks it once.

Tests for 1–5 are listed in Tasks 5 and 7.

---

### Task 1: Archive the Geostat files

**Files:**
- Add: `docs/Raw Data/Demography/geostat-demography/2026-10/official/` — the 17 English XLSX of categories 323 and 324 (names as Geostat serves them) and metadata `0905_270326_EN.PDF`, `0906_270326_EN.PDF` under `official/metadata/`
- Modify: `docs/Raw Data/Demography/geostat-demography/2026-10/source-manifest.csv` (19 new rows; row of `source.geostat_demography_population_mid_year` becomes `canonical_input`, served 1994–2025)
- Modify: `data/sources/source-documents.csv` (register every served source: marriages, divorces, mid-year, mean age of spouses, mean age of divorced people, average duration)
- Modify: `docs/Raw Data/Demography/geostat-demography/2026-10/source-review.md` (a short "Marriages and divorces (added 2026-10-20)" section: tables, retrieval date, the two identity findings)

**Interfaces:** Produces source ids, added to `SOURCE_ID` in Task 2:
`marriages` = `source.geostat_demography_marriages` (34, canonical), `divorces` = `source.geostat_demography_divorces` (41, canonical), `meanAgeSpouses` (40, canonical), `meanAgeDivorced` (48, canonical), `marriageDuration` (47, canonical), `crudeMarriageRate` (39), `crudeMarriageRateRegions` (39-1), `crudeDivorceRate` (46), `crudeDivorceRateRegions` (46-1), `marriagesPreviousStatus` (35), `divorcesByDuration` (43) — validation_only; tables 36, 37, 38, 42, 44, 45 `archived_not_served`; the two PDFs `definitions`.

- [ ] Copy the files from the scratchpad capture, compute SHA-256 and bytes, write the manifest rows (retrieved_at 2026-10-20, page URLs categories/323 and /324).
- [ ] Run `npx vitest run tests/data/demography/prepareDemography.test.ts` — Expected: PASS (the loader verifies every hash; nothing reads the new files yet).
- [ ] Commit `data(demography): archive Geostat marriage and divorce tables`.

### Task 2: Read marriages, divorces, mid-year population, ages and duration

**Files:**
- Modify: `apps/web/lib/data/demography/series.ts` (SERIES, SOURCE_ID, `COVERAGE.marriageFrom = 1994`, `COVERAGE.marriageUnitsFrom = 2009`, `FAMILIES.midYear`, `FAMILIES.marriage`)
- Modify: `apps/web/lib/data/demography/readStoredSheet.ts` (add `halfPersons(ref)`: thousands to the half person, `whole(ref, 2000) / 2`)
- Modify: `apps/web/lib/data/demography/readUnitTable.ts` (scale `"half_thousands"` uses `halfPersons`)
- Modify: `apps/web/lib/data/demography/anomalies.ts` and `data/mappings/demography/source-anomalies.csv` (decision `ignore | unallocated`; `unallocated(sourceId, cell): number` returns the reviewed amount or 0; one row: divorces, Georgia 2018 cell, 86, with the note)
- Create: `apps/web/lib/data/demography/readMarriage.ts`
- Modify: `apps/web/lib/data/demography/prepareDemography.ts` (two FILES entries: `demography-mid-year-annual.csv` no dimensions; `demography-marriage-annual.csv` dimension `sex`)
- Modify: `apps/web/lib/data/demography/breaks.ts` (marriage family series are unaffected by the census; mid-year is affected)
- Test: `apps/web/tests/data/demography/readMarriage.test.ts`

**Interfaces:**
- Produces: `readMarriage(sources: DemographySources, geography: DemographyGeography): DemographyObservation[]` — counts via `readUnitTable(sheet, geography, { scope: "events", scale: "count", countryFrom: 1994, unitsFrom: 2009 })`, mid-year with `scale: "half_thousands"` and the same years and scope (its city rows are 2014–2016 and it spells units as the population table, which the events scope accepts); ages from table 40 columns B/C (total M/F) and D/E (first marriage M/F), 48 B/C, 47 B, one decimal, Georgia only, headers checked with `expectLabel`.

- [ ] **Write the failing test** `readMarriage.test.ts` against the real archive: Georgia marriages 1994 = 21908, 2025 = 22285; divorces 2018 = 10288; Tbilisi (`04`) marriages 2025 = 6553 and region Tbilisi equals it; Telavi (`15`) 2015 equals municipality cell + `C. Telavi*` cell with two refs in the locator; mid-year Georgia 2025 = "3935765.5"; first-marriage age female 2025 = "30.1", male "32.4"; duration 2025 = "10.9"; no row for a region or municipality before 2009; 76 geographies for each count; ages have `sex` and no other dimension.
- [ ] Run `npx vitest run tests/data/demography/readMarriage.test.ts` — Expected: FAIL (module missing).
- [ ] Implement the series, sheet, unit-table, anomaly and reader changes above.
- [ ] Run the test — Expected: PASS.
- [ ] Commit `feat(demography): read marriages, divorces and mid-year population`.

### Task 3: Validate and write the canonical files

**Files:**
- Modify: `apps/web/lib/data/demography/validation.ts` (per-family unit start: `marriageUnitsFrom` for the marriage and mid-year families in `checkCoverage` and `checkWholes`; the new count and mid-year series join the all-unit series; `checkWholes` adds the reviewed `unallocated` amount to the parts; `unitTableInventory` for tables 34, 41, 04; report lists them)
- Modify: `apps/web/lib/data/demography/crossChecks.ts` (`checkMarriageRates`: Georgia 1994–2025 against 39 and 46, regions 2009–2025 against 39-1 and 46-1, recomputed as count × 1000 ÷ mid-year, tolerance 0.05, reported as `crude_marriage_rate` and `crude_divorce_rate`; Georgia's row of 39-1 equals 39; `checkMarriageTotals`: table 35 male total = Georgia marriages and table 43 total = Georgia divorces, every year)
- Generate: `data/imports/demography-marriage-annual.csv`, `data/imports/demography-mid-year-annual.csv`, `data/reports/demography-validation.json`
- Test: `apps/web/tests/data/demography/prepareDemography.test.ts`

- [ ] **Write the failing tests**: the report's rate checks include `crude_marriage_rate` and `crude_divorce_rate` with max difference < 0.05; a copy of the divorce sheet with Georgia 2018 changed to 10289 stops with `identity_failed`; removing the reviewed anomaly row stops with `identity_failed`; row counts: marriage file 2,838 rows (2×(32 + 75×17) counts + 6×32 ages + 32 duration), mid-year file 1,307 rows (32 + 75×17).
- [ ] Run them — Expected: FAIL.
- [ ] Implement, then `npm run data:prepare-demography` (writes files) and `npm run data:check-demography`.
- [ ] Run `npx vitest run tests/data/demography` — Expected: PASS.
- [ ] Commit `data(demography): validated marriage, divorce and mid-year files`.

### Task 4: Serve the new files

**Files:**
- Modify: `apps/web/lib/data/demography/importDemography.ts` (two files in `SERVED_DEMOGRAPHY_FILES`; marriage family in the registered set; mid-year served with population lineage)
- Modify: `apps/web/lib/data/servedData.ts` (`SERVED_DATA_FILES.demographyMarriageFacts`, `.demographyMidYearFacts`)
- Modify: `apps/web/scripts/import-budget-facts.ts` (load both into `demographyFacts`)
- Test: `apps/web/tests/data/demography/importDemography.test.ts`

- [ ] **Failing test**: loaded facts include `demography.marriages` with basis `registered` and `demography.mid_year_population` 2024 `pre_census`, 2025 `census_based`, 2008 `retro_projection`; the served-file lists stay equal.
- [ ] Implement; run the test — Expected: PASS. Run `npm run typecheck`.
- [ ] Commit `feat(demography): serve marriages and mid-year population`.

### Task 5: Page models

**Files:**
- Create: `apps/web/lib/explorer/demographyMarriage.ts`
- Test: `apps/web/tests/explorer/demographyMarriage.test.ts`

**Interfaces (produced):**
- `MARRIAGE_SERIES: { id: MarriageSeriesId; heading: "number" | "ageMarriage" | "ageDivorce" | "duration"; group: "count" | "years" }[]` in list order: `marriages`, `divorces`; `age_marriage_male`, `age_marriage_female`, `age_first_marriage_male`, `age_first_marriage_female`; `age_divorce_male`, `age_divorce_female`; `duration`.
- `type MarriageMeasure = "count" | "per1000"`; `type MarriageState = TopicState & { measure: MarriageMeasure }`.
- `type ClientMarriageFact = { indicatorId: MarriageSeriesId; year: number; value: number; unit: "count" | "years" }`, built by `marriageFactsForPlace(facts: readonly ServedDemographyObservation[], placeId: string): { facts: ClientMarriageFact[]; midYear: { year: number; persons: number }[] }` (a place gets only the two counts).
- `perThousand(count: number, persons: number): number` — `Number((count * 1000 / persons).toPrecision(15))`.
- `buildMarriageModel(facts, midYear, state)`: like `buildCrimeModel`; in `per1000` the two count rows show rates (decimals 1, calculated) and age rows are unchanged; `breaks` holds 2025 only when `per1000` and a count row is selected; `unitKey` is `demography.marriageUnitCount | marriageUnitPer1000 | marriageUnitYears`.
- `parseMarriageHash` / `serializeMarriageHash` / default selection `["marriages", "divorces"]` (keepOneUnit with `groupOf` = the definition's `group`).
- `buildMarriageIndexModel({ facts, regions, municipalities })`: as `buildVitalIndexModel`, value = marriages per 1,000 in the latest municipal year, `countsById` = `{ marriages, divorces }`.

- [ ] **Failing tests**: Georgia 2025 per 1,000 rounds to 5.7 marriages and 3.3 divorces; Kazbegi (find its code in `municipalities.csv`) 2025 is > 9.5; the index ranks 64 municipalities and Tbilisi once; `parseMarriageHash("#sel=nope")` gives the default; ticking an age row after the counts keeps only age rows; per 1,000 with only ages selected has no breaks and unit key `marriageUnitYears`; per 1,000 with marriages selected has a break at 2025; `marriageFactsForPlace(facts, "region.tbilisi")` has 2009–2025 only.
- [ ] Run — FAIL; implement; run — PASS.
- [ ] Commit `feat(demography): marriages and divorces page models`.

### Task 6: Excel workbooks

**Files:**
- Create: `apps/web/lib/explorer/demographyMarriageWorkbook.ts` (`buildMarriageWorkbookExportModel(input, presentation)` following `crimeWorkbook.ts`: a rate cites the mid-year source for its years, status published or calculated, number format `#,##0` / `#,##0.0`)
- Test: `apps/web/tests/explorer/demographyMarriageWorkbook.test.ts`

- [ ] **Failing tests**: count view cites only the marriages/divorces source; per-1,000 view also cites `source.geostat_demography_population_mid_year` and marks cells calculated; age view cites table 40; filename stem `marriages-divorces-<scope>-<first>-<last>` with `-per-1000` for rates.
- [ ] Run — FAIL; implement; run — PASS. Commit.

### Task 7: Page, place section, routes and words

**Files:**
- Create: `apps/web/components/demography/marriage-explorer.tsx` (as `CrimeExplorer`: heading, `LatestValueLine`, chart/table, `SegmentedTabs` with Lucide `Hash` / `Users` icons, `FlatSeriesPanel` with the four headings, `RangeStrip`, source note, Excel)
- Create: `apps/web/components/demography/marriage-section.tsx` (`MarriageSection({ place, facts, midYear, sources, siteOrigin, workbookScope, nationalHref })`, `id="marriages-divorces"`, two lines, count / per-1,000 icons, table view, Excel)
- Create: `apps/web/lib/pages/demography-marriages-divorces.tsx`; `app/(ka)/explorer/demography/marriages-divorces/page.tsx`; `app/(en)/en/explorer/demography/marriages-divorces/page.tsx`
- Modify: `apps/web/lib/pages/demography-population-place.tsx` (render `MarriageSection` after `VitalSection`)
- Modify: `apps/web/lib/explorer/demographyRoutes.ts` (`MARRIAGES_DIVORCES_PATH`, fifth `DEMOGRAPHY_PAGES` row, `common.demographyMarriages`)
- Modify: `apps/web/lib/explorer/demographyHubCards.ts` (card spark of Georgia marriages, footer "2025: 22,285 ქორწინება")
- Modify: `apps/web/lib/i18n/messages/{ka,en}/demography.json`, `{ka,en}/common.json`, `apps/web/public/llms.txt`, `data/localization/en/page-revisions.json`
- Tests: `tests/explorer/demographyPages.test.tsx`, `demographyHub.test.ts`, `demographySidebar.test.tsx`, `demographyDiscovery.test.ts`, `tests/seo/routes.test.ts`, `tests/seo/agentFiles.test.ts`, new `tests/browser/demography-marriages-divorces.spec.ts`, counts in `bilingual-complete`, `methodology`, `seo` specs

- [ ] **Failing tests** (unit): the hub lists five live pages in order Population, Age and sex, Migration, Births and deaths, Marriages and divorces; the page renders one latest line and no paragraph under the heading; the map list links Georgia to `/explorer/demography/population/georgia#marriages-divorces`; the Tbilisi place page renders one `marriages-divorces` section.
- [ ] **Browser spec**: page loads in ka and en; default chart shows two lines; per-1,000 switch shows the 2025 marker; ticking an age row clears the counts; a Kazbegi list row shows one decimal; the latest line fits one line at 375px; clicking a municipality opens its place page at the section.
- [ ] Implement; run the unit tests and `npm run typecheck`, then build and run the new browser spec against `next start` (CLAUDE.md recipe, `CI=1`).
- [ ] Commit `feat(demography): publish the Marriages and divorces page`.

### Task 8: Documentation

**Files:**
- Modify: `docs/data-methodology/demography.md` (owner list, coverage table rows, a "Marriages and divorces" section: sources, years, places from 2009 and why, the 2018 divorce gap, rates calculated and checked, under-18 rule since 2017, foreign couples not counted, 2025 census marker on rates only)
- Modify: `Project_Definition.md` section 2 (demography foundation and section bullets: five pages, the new page and section)
- Add: `docs/superpowers/specs/2026-10-20-marriages-divorces-design.md` (the approved spec, decision 3 amended)

- [ ] Write; run `npm run i18n:check` and `npx vitest run tests/methodology` if the methodology page lists sections.
- [ ] Commit `docs(demography): marriages and divorces methodology and scope`.

### Task 9: Review with Duru

- [ ] Build (`NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`), start on port 3100, take desktop and phone screenshots of the page, Georgia's and Kazbegi's place sections into `/mnt/project-files/screenshots/marriages-divorces/`.
- [ ] Post them with the preview card (clickable preview / screenshots only / looks good); push the branch only after "Clickable preview"; full gates and PR only after Duru's go.
