# MCP Full Data Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve every figure of the 91 chart pages `/mcp` does not serve today, through one shared topic store and one new tool, without changing any website page or any existing answer.

**Architecture:** Build-time adapters (one per topic family, `lib/factQuery/topics/<family>.ts`) turn each family's reviewed facts, page series lists and page labels into one shared shape, stored column-wise in a new `topics` section of the snapshot. A new tool `query_indicators` reads it; `describe_coverage`, `compare`, `rank`, `get_sources` and the publications each gain one topic branch. A parity test per family proves the served cells equal the cells of the page's own Excel/crawl models.

**Tech Stack:** Next.js 16 static export, strict TypeScript, Zod, `@modelcontextprotocol/server`, Vitest, tsx scripts. All commands run in `apps/web`.

**Spec:** `docs/superpowers/specs/2026-11-10-mcp-full-coverage-design.md` (approved by Duru 2026-11-11 13:03 Tbilisi).

## Global Constraints

- Serve what the page shows: exactly the series, places and years the page lists; never `shown = false` rows, discontinued lines, old vocational fields, or years a page does not show (HS4 products before 2020).
- One new tool only: `query_indicators`, title `თემატური მონაცემები / Topic data`. The 11 existing tools keep their names, inputs and outputs.
- No new arithmetic: browser-calculated per-person / share-of-GDP / index views are not served. Change comes only from `compare` and `rank`.
- Dataset id = page path after `/explorer/` with `/` → `-` (e.g. `education-schools`). Place sub-pages are entities of their page's dataset.
- Entity ids reuse `country.georgia`, `region.*`, municipality codes, `city.*`. Entity types: `country | region | municipality | city`.
- Missing stays missing (`value: null`, `availability: "missing"`); zero is a value.
- `SCHEMA_VERSION` 1.7.0 → 1.8.0.
- `tests/factQuery/reference.test.ts` passes unchanged; a disagreement is a stop condition, reported, never edited.
- `tools/list` < 115 KiB (`tests/mcp/tools.test.ts:503`); `serverInstructions()` < 4,096 characters.
- Snapshot ≤ 42 MB minified, cold read+parse ≤ 0.7 s, resident ≤ 260 MB (today 32.1 MB, ~0.5 s, ~185 MB).
- Topic CSVs at `/downloads/data/topics/<datasetId>.csv`, UTF-8 with BOM, without `source_sheet`, `source_cell`, `source_workbook`, `source_number_format`.
- `lib/factQuery/` stays pure (no `fs`; `tests/factQuery/purity.test.ts`); only `buildSnapshot.ts` and the adapters (build-time, under `lib/factQuery/topics/`, added to the purity test's allow-list) read files.
- The snapshot build never imports `lib/pages/*.tsx` (they pull in `server-only` and React): page-data code it needs moves into `.ts` modules, as `lib/explorer/allDataMessages.ts` already did.
- Every `out/` file except `llms.txt`, `/connect` (ka, en), `/downloads/data/*` is byte-identical to a `main` build.
- New Georgian strings go to `/mnt/project-files/mcp-full-coverage/notes-for-duru.md` for proofreading.
- No push, PR, CI run, `npm run check`, full build or full browser suite until Duru has seen the result (project rule). Narrow tests and local commits only.

## Review Focus

1. **A place with gaps** (Eredvi/Tighva/Kurta units, merged municipalities, places a series has no value for): served as missing cells with a reason, never zero, and `EDUCATION_UNITS`-style units the page never draws are not entities. Test in Task 2.
2. **A series asked for a place the page does not list** (universities for a municipality): `unknown_entity` error with the dataset's valid entity ids, not an empty success. Test in Task 4.
3. **School years in answers**: observations, compare and rank sentences say `2015/16`, not `2015`. Tests in Tasks 4, 6, 7.
4. **Census re-base and other breaks**: population change 2024→2025 and kindergarten staff 2019→2020 are `not_comparable` in compare and excluded with reason in rank. Tests in Tasks 6, 7, 9.
5. **Very large datasets** (trade products ≈1,192 series): `describe_coverage` with that `datasetId` stays within the catalogue size limit (series list narrowed by `search`, with a note when truncated), and a whole-history query is refused with the dataset's CSV link. Tests in Tasks 5, 15.

---

## File map

| File | Responsibility |
|---|---|
| `lib/factQuery/topics/types.ts` (new) | Topic types (build and stored shapes) |
| `lib/factQuery/topics/pages.ts` (new) | `TOPIC_PAGES`: the 91 pages, dataset ids, families, period kind |
| `lib/factQuery/topics/store.ts` (new) | Column-wise pack/unpack and cell lookup |
| `lib/factQuery/topics/registry.ts` (new) | `TOPIC_ADAPTERS` and `buildTopicsSnapshot()` |
| `lib/factQuery/topics/<family>.ts` (new, ~20) | One adapter per family |
| `lib/factQuery/topics/breaks.ts` (new) | Reading `*-series-breaks.csv` into `TopicBreak[]`; `breakBetween()` |
| `lib/factQuery/queryIndicators.ts` (new) | The query function |
| `lib/factQuery/types.ts`, `schemas.ts`, `describeCoverage.ts`, `compare.ts`, `rank.ts`, `getSources.ts`, `publications.ts`, `servedPages.ts`, `buildSnapshot.ts` | One topic branch each |
| `lib/mcp/tools.ts`, `outputSchema.ts`, `result.ts`, `instructions.ts` | Tool entry, output schema, size kind, text |
| `lib/pages/*.tsx` → `lib/explorer/<topic>PageData.ts` (moved code) | Shared page-data functions where a page assembles series/labels/places inline |
| `tests/factQuery/topics/*.test.ts` (new) | Parity, rules, coverage |
| `tests/factQuery/topics/parity.ts` (new) | Shared parity harness |

## Family inventory (for the adapter tasks)

| Family | Loader (`lib/data/...`) | Pages (`lib/pages/`) | Crawl states / workbook builder (`lib/explorer/`) | Breaks file |
|---|---|---|---|---|
| education | `loadServedEducationData` | `education.tsx`, `education-places.tsx` | `educationCrawlStates`, `educationPlaceCrawlStates` / `buildEducationWorkbookExportModel` | `education-series-breaks.csv` |
| demography | `loadServedDemographyData` | `demography-*.tsx` | `ageSexCrawlStates`, `marriageCrawlStates`, `migrationCrawlStates` / population, vital, migration, marriage, pyramid, ageYear, fertility, life, censusPlace builders | `demography-series-breaks.csv` |
| health | `loadServedHealthData` | `health*.tsx` | `healthCrawlStates` / `buildHealthWorkbookExportModel` | `health-series-breaks.csv` |
| social | `loadServedSocialData` | `social.tsx`, `social-places.tsx` | `socialCrawlStates`, `socialPlaceCrawlStates` / `buildSocialWorkbookExportModel` | `social-protection-series-breaks.csv` |
| unemployment, labour | `loadServedUnemploymentData`, `loadServedLabourData` | `unemployment*.tsx`, `labour*.tsx` | `unemploymentCrawlStates` / `buildUnemploymentWorkbookExportModel`, `buildLabourWorkbookExportModel` | `methodology_epoch` column |
| wages | `loadServedWagesData` | `wages*.tsx` | `wagesCrawlStates` / `buildWagesWorkbookExportModel` | — |
| business | `loadServedBusinessData` | `business*.tsx` | `unitListCrawlStates` / `buildBusinessWorkbookExportModel` | `business-series-breaks.csv` |
| money-banks | `loadServedMoneyBanksData` | `moneyBanks.tsx`, `money-banks-*.tsx` | `moneyBanksCrawlStates` / `buildMoneyBanksWorkbookExportModel` | `money-banks-series-breaks.csv` |
| household, poverty | `loadServedHouseholdData`, `loadServedPovertyData` | `household*.tsx`, `poverty.tsx` | `householdCrawlStates`, `povertyCrawlStates` / matching builders | — |
| housing, internet, transport | `loadServedHousingData`, `loadServedInternetData`, `loadServedTransportData` | `housing*.tsx`, `internet*.tsx`, `transport*.tsx` | `unitListCrawlStates` / matching builders | — |
| trade (6) | `loadServedTrade{Overview,Partners,Products,Services,Composition,Domestic}Data` | `trade.tsx` | `tradeOverviewCrawlStates`, `tradePartnersCrawlStates`, `tradeProductsCrawlStates` / `buildTradeOverviewWorkbookExportModel` and the trade components' builders | — |
| external | `loadServedExternalPositionData`, `loadServedCurrentAccountFacts`, `loadServedForeignInvestmentData`, `loadServedMoneyTransfersData` | `external.tsx` | `externalPositionCrawlStates`, `currentAccountCrawlStates`, `foreignInvestmentCrawlStates`, `moneyTransfersCrawlStates` | — (partial months: `months_reported`) |
| budget/economy extras | `loadServedExpenditureTypesData`, `loadServedTaxBreaksRefundsData`, `loadServedGdpExpenditureData` | `expenditure-types.tsx`, `tax-breaks-refunds.tsx`, `gdp-expenditure.tsx` | `sectorCrawlStates`, `taxBreaksRefundsCrawlStates` / matching builders | — |
| crime, science-culture | `loadServedCrimeData`, `loadServedScienceCultureData` | `crime*.tsx`, `science-culture*.tsx` | `crimeCrawlStates`, `unitListCrawlStates` / matching builders | `crime-`, `science-culture-series-breaks.csv` |
| environment, energy-food | `loadServedEnvironmentData`, `loadServedEnergyFoodData` | `environment*.tsx`, `energy-food.tsx` | `unitListCrawlStates`, `energyFoodCrawlStates` / matching builders | — |

The component that renders each page names the exact crawl states and builder it calls in its `useCrawlModels(...)` line; that line is the parity reference.

---

### Task 1: Topic types, page list and coverage test

**Files:**
- Create: `lib/factQuery/topics/types.ts`, `lib/factQuery/topics/pages.ts`, `lib/factQuery/topics/store.ts`
- Test: `tests/factQuery/topics/pages.test.ts`, `tests/factQuery/topics/store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TopicFamilyId = "education" | "demography" | "health" | "social" | "unemployment" | "wages" | "business" | "money-banks" | "living-standards" | "housing" | "internet" | "transport" | "trade" | "external" | "budget-extras" | "crime" | "science-culture" | "environment" | "energy-food";
  export type TopicPage = { datasetId: string; pagePath: `/explorer/${string}`; family: TopicFamilyId; periodKind: "year" | "school_year" };
  export type TopicSeries = { seriesId: string; labelKa: string; labelEn: string; headingKa: string | null; headingEn: string | null; parentSeriesId: string | null; isTotal: boolean; unit: string };
  export type TopicEntity = { entityId: string; entityType: "country" | "region" | "municipality" | "city"; labelKa: string; labelEn: string; parentEntityId: string | null };
  export type TopicValueStatus = "official" | "survey_estimate" | "derived" | "partial";
  export type TopicFact = { entityId: string; seriesId: string; year: number; value: number | null; basis: Basis; status: TopicValueStatus; sourceIds: string[]; periodEnd?: string; monthsReported?: number };
  export type TopicBreak = { breakId: string; seriesIds: string[]; referenceDate: string; reasonEn: string };
  export type TopicDatasetBuild = { page: TopicPage; titleKa: string; titleEn: string; series: TopicSeries[]; entities: TopicEntity[]; facts: TopicFact[]; breaks: TopicBreak[] };
  export type TopicAdapter = { family: TopicFamilyId; sourceArchive: MethodologyDatasetId[]; build(): Promise<TopicDatasetBuild[]> };
  export type TopicColumns = { entity: number[]; series: number[]; year: number[]; value: (number | null)[]; basis: number[]; status: number[]; sources: number[][]; periodEnd: Record<number, string>; monthsReported: Record<number, number> };
  export type TopicDataset = Omit<TopicDatasetBuild, "facts"> & { urlKa: string; urlEn: string; groupId: string; firstYear: number; lastYear: number; columns: TopicColumns };
  export type TopicsSnapshot = { datasets: TopicDataset[]; sourceIds: string[]; basisCodes: Basis[]; statusCodes: TopicValueStatus[]; units: Record<string, { labelKa: string; labelEn: string }> };
  export const TOPIC_PAGES: readonly TopicPage[];           // pages.ts, the 91 rows of spec §3
  export function topicDatasetId(pagePath: string): string; // "/explorer/education/schools" -> "education-schools"
  export function packTopicFacts(build: TopicDatasetBuild, sourceIndex: Map<string, number>, basisCodes: Basis[], statusCodes: TopicValueStatus[]): TopicColumns;
  export function unpackTopicFacts(dataset: TopicDataset, topics: TopicsSnapshot): TopicFact[];
  export function topicCell(dataset: TopicDataset, entityId: string, seriesId: string, year: number, topics: TopicsSnapshot): TopicFact | undefined;
  ```

- [ ] **Step 1: Write the failing tests.**
  `pages.test.ts`: `TOPIC_PAGES.length === 91`; ids unique and equal `topicDatasetId(pagePath)`; `school_year` only for the four education pages; no `pagePath` is a key of `MCP_SERVED_PAGES`; and *every chart page in navigation is served*: `buildSearchPages([], ka, en)` (via `allDataMessages`) chart pages (exclude hub/group pages and `/explorer/analysis`) equal `Object.keys(MCP_SERVED_PAGES) ∪ TOPIC_PAGES.map(p => p.pagePath)`.
  `store.test.ts`: `unpackTopicFacts(packTopicFacts(x))` deep-equals the facts of a 3-entity × 2-series × 3-year fixture including a `null` value, a `periodEnd` and a `monthsReported`; `topicCell` finds and misses correctly.
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics` — expected FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules. `topicCell` builds a `Map` key `entity:series:year` per dataset once (WeakMap cache keyed by dataset).
- [ ] **Step 4: Run** the same command — expected PASS.
- [ ] **Step 5: Commit** `feat(mcp): topic types, page list and column store`.

### Task 2: Adapter contract, parity harness and the education adapter

**Files:**
- Create: `lib/factQuery/topics/breaks.ts`, `lib/factQuery/topics/education.ts`, `lib/factQuery/topics/registry.ts`, `tests/factQuery/topics/parity.ts`, `tests/factQuery/topics/education.test.ts`
- Create (moved code): `lib/explorer/educationPageData.ts`
- Modify: `lib/pages/education.tsx`, `lib/pages/education-places.tsx` (call the moved functions; no output change)

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  ```ts
  export async function loadTopicBreaks(file: string): Promise<TopicBreak[]>;            // breaks.ts, reads data/imports/<file>
  export function breakBetween(breaks: readonly TopicBreak[], seriesId: string, fromYear: number, toYear: number, periodKind: TopicPage["periodKind"]): TopicBreak | null;
  export const TOPIC_ADAPTERS: readonly TopicAdapter[];                                   // registry.ts; grows one entry per adapter task
  export function expectWorkbookParity(build: TopicDatasetBuild, models: readonly WorkbookExportModel[], match: (row: WorkbookReadableRow, model: WorkbookExportModel) => { entityId: string; seriesId: string } | null): void; // parity.ts
  export const educationTopicAdapter: TopicAdapter;
  ```
  `breakBetween`: a break dated `referenceDate` separates years `a < b` when the period that starts it lies in `(a, b]` (`school_year` year Y starts on Y-09-01, calendar year Y on Y-01-01).
  `expectWorkbookParity`: every readable row of every model maps (via `match`) to served cells whose values equal `valuesByYear` (relative tolerance 1e-9) and whose `null` matches missing; it fails on any unmatched row and on any served series with no row in any model.

- [ ] **Step 1: Write the failing tests** in `education.test.ts`:
  - four datasets: `education-schools`, `education-kindergartens`, `education-universities`, `education-vocational`;
  - schools and kindergartens entities = Georgia + 11 regions + 63 municipalities (75); universities and vocational = Georgia only;
  - vocational never contains an `old_*` series; no fact has `shown = false`;
  - Shuakhevi's `education.pupils.total` 2015 and 2025 values equal the reviewed CSV rows (read the CSV in the test);
  - a place/year the CSV has no row for is a fact with `value: null` (Review Focus 1); `unit.*` ids are not entities;
  - `breakBetween(breaks, "education.kg_staff.total", 2019, 2020, "school_year")` returns `kindergarten_staff_2020`; `(2020, 2021)` returns `null`;
  - parity: for Georgia and for one region and one municipality, `expectWorkbookParity(dataset, models, match)` where `models` come from the same calls `education-explorer.tsx` and `education-place-explorer.tsx` make in `useCrawlModels`, fed by the moved page-data functions, in `ka` and `en`.
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics/education.test.ts` — expected FAIL.
- [ ] **Step 3: Move** the page-data assembly of `renderEducationTopicPage` and `loadEducationPlaceBasics` (series, shown facts, labels, heading labels, places) into `lib/explorer/educationPageData.ts` as `educationTopicPageData(locale, section)` and `educationPlacePageData(locale)`; the pages call them. Run `npx vitest run tests/explorer/education.test.ts` — PASS, unchanged.
- [ ] **Step 4: Implement** `educationTopicAdapter` from those functions, `loadTopicBreaks("education-series-breaks.csv")` and `sourceArchive: ["education"]`; add it to `TOPIC_ADAPTERS`. Labels come from the same label functions in both locales; `headingKa/En` from `education.heading.<measure>`.
- [ ] **Step 5: Run** the test — expected PASS. Commit `feat(mcp): education topic adapter with page parity`.

### Task 3: Snapshot integration

**Files:**
- Modify: `lib/factQuery/types.ts` (`SCHEMA_VERSION = "1.8.0"`, `FactQuerySnapshot.topics: TopicsSnapshot`), `lib/factQuery/buildSnapshot.ts`, `tests/factQuery/purity.test.ts` (allow-list `lib/factQuery/topics/*` except `store.ts`), `lib/factQuery/servedPages.ts`
- Test: `tests/factQuery/topics/snapshot.test.ts`

**Interfaces:**
- Consumes: `TOPIC_ADAPTERS`, `packTopicFacts`.
- Produces: `export async function buildTopicsSnapshot(): Promise<{ topics: TopicsSnapshot; sources: RawResolvedSource[] }>` in `registry.ts`; `snapshot.topics`; topic sources merged into `snapshot.sources` (through `enrichSourceTranslations`, Ka/En names from `data/localization/en/sources.json` / `documents.json`, documents from each adapter's `sourceArchive` via `loadReviewedSourceManifest`, official URL kept only when `isCleanHttpsUrl`); `MCP_SERVED_PAGES` gains `[page.pagePath]: [page.datasetId]` for every topic page (so `website.pages` drops them); `DatasetId` widened to `CoreDatasetId | TopicDatasetId` where `TopicDatasetId = (typeof TOPIC_PAGES)[number]["datasetId"]` (make `TOPIC_PAGES` `as const`).

- [ ] **Step 1: Write the failing test:** the built snapshot has `schemaVersion "1.8.0"`; `topics.datasets` contains `education-schools`; every `sourceIds` index of every topic fact resolves to a `snapshot.sources` entry with ≥1 document; every unit used by a series has `units[unit]` with non-empty Ka and En labels (labels from the site's format messages); `website.pages` no longer lists `/explorer/education/schools`; existing snapshot keys unchanged (`national`, `ministries`, … deep-equal a build with `TOPIC_ADAPTERS = []`).
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics/snapshot.test.ts tests/factQuery/buildSnapshot.test.ts` — expected FAIL.
- [ ] **Step 3: Implement.** Build fails loudly (throws) on: an unresolved source id, a unit with no labels, a series with no fact, a duplicate cell.
- [ ] **Step 4: Run** the step-2 command plus `npx vitest run tests/factQuery/reference.test.ts` — PASS (reference unchanged).
- [ ] **Step 5: Commit** `feat(mcp): topics section in the fact-query snapshot (schema 1.8.0)`.

### Task 4: `query_indicators`

**Files:**
- Create: `lib/factQuery/queryIndicators.ts`
- Modify: `lib/factQuery/schemas.ts`, `lib/factQuery/observations.ts` (optional `periodLabel?: string`, `periodEnd?: string` on `Observation`; `Unit` widened with `TopicUnit = string & {}` for topic datasets only), `lib/mcp/tools.ts`, `lib/mcp/outputSchema.ts`, `lib/mcp/result.ts` (text table prints `periodLabel` when present), `data/localization/{ka,en}/service-messages.json` (new keys)
- Test: `tests/factQuery/queryIndicators.test.ts`, `tests/mcp/tools.test.ts` (extend)

**Interfaces:**
- Consumes: `snapshot.topics`, `topicCell`, `buildObservationId`, `buildResponseMeta`, `selectSources`.
- Produces:
  ```ts
  export const queryIndicatorsInput: z.ZodType<{ datasetId: string; seriesIds: string[]; entityIds?: string[]; years?: number[]; fromYear?: number; toYear?: number; expectedDataVersion?: string }>;
  export function queryIndicators(snapshot: FactQuerySnapshot, input: unknown): FactQueryResponse;  // kind "observations"
  export function indicatorCellCount(snapshot: FactQuerySnapshot, input: unknown): number;           // used by the tool's pre-check
  ```
  Observation fields: `measure "value"`, `budgetScope "topic"`, `level` = `"total"` when `isTotal` else `"series"`, `valueDefinitionId` = `${datasetId}:${seriesId}:${unit}`, caveats: `survey_estimate` (note), `derived` (note, names derivation), `partial` (severe, with months), `preliminary`/`planned`/`projection` basis (existing wording). Errors: `unknown_dataset`, `unknown_series`, `unknown_entity` (with `validChoices` = dataset's ids, capped at 50), `year_out_of_range`, `data_version_changed`.

- [ ] **Step 1: Write the failing tests:** Shuakhevi pupils 2015 and 2025 equal the CSV; `periodLabel` `"2015/16"`; default entity is `country.georgia`; `education-universities` with a municipality code → `unknown_entity` with `validChoices` `["country.georgia"]` (Review Focus 2); a missing cell → `status "partial"` and a `missingCells` entry; 600 cells → tool returns `result_too_large` naming `https://fiscal.ge/downloads/data/topics/education-schools.csv`; `tools/list` contains `query_indicators` with `readOnlyHint: true`, the whole response < 115 KiB, and the description ≤ 700 characters.
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/queryIndicators.test.ts tests/mcp/tools.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Tool description (exact copy): `Annual figures from every other Fiscal.ge chart page: population, education, health and pensions, jobs and wages, business, living standards, housing, internet, transport, money and banks, trade, external accounts, crime, environment, science and culture, energy and farming. Take datasetId, seriesIds and entityIds from describe_coverage; never guess. Values are as the page shows them, in each series' own unit; school years print as 2025/26. Missing is not zero. Use compare and rank for changes.` Add `query_indicators` to the handler's pre-count (`indicatorCellCount`). If the 115 KiB test fails, trim the longest existing descriptions' repeated phrases until it passes; record the before/after bytes in the commit message.
- [ ] **Step 4: Run** step 2 plus `npx vitest run tests/mcp tests/factQuery/reference.test.ts` — PASS.
- [ ] **Step 5: Commit** `feat(mcp): query_indicators over the topic datasets`.

### Task 5: `describe_coverage` for topics

**Files:**
- Modify: `lib/factQuery/describeCoverage.ts`, `lib/factQuery/publications.ts` (its `DATASET_IDS` list only if catalogue tests require; full publications are Task 8)
- Test: `tests/factQuery/topics/describeCoverage.test.ts`, `tests/factQuery/searchQuality.test.ts` (extend `fixtures/searchQueries.ts`)

**Interfaces:**
- Consumes: `snapshot.topics`.
- Produces: catalogue entries for topic datasets: `{ datasetId, labelKa, labelEn, pageUrlKa, pageUrlEn, years: [first, last], periodKind, seriesCount, entityCount }` without `datasetId`; with `datasetId`: `series` (with `headingKa/En`, `unit`, `years`), `entities`, `breaks` (id, date, affected series, `reasonEn`), `bulkUrl`. Search matches dataset titles, series labels, headings and place names through the existing `searchCatalogue`.

- [ ] **Step 1: Write the failing tests:** search `სკოლა` and `schools` → `education-schools` first with `education.pupils.total`; search `პენსია` → `health-pensions`; search `Shuakhevi` → municipality entity in schools, kindergartens and population datasets; search `ბათუმის` still finds Batumi; an empty-match search still returns `websitePages` only for non-data pages; `describe_coverage({ datasetId: "trade-products" })` stays within the catalogue result limit and says how many series it omitted, and `{ datasetId: "trade-products", search: "wine" }` returns the wine HS4 series (Review Focus 5); the no-argument catalogue still fits its limit with all 102 datasets.
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics/describeCoverage.test.ts tests/factQuery/describeCoverage.test.ts tests/factQuery/searchQuality.test.ts` — FAIL.
- [ ] **Step 3: Implement** one `topic` branch in `buildDatasetSummary`, `baseSeriesForDataset`, `entitiesForDataset`; series lists over 300 entries return the totals and headings plus a `seriesOmitted` count and the instruction to narrow with `search`.
- [ ] **Step 4: Run** step 2 — PASS; existing describeCoverage tests unchanged except the expected dataset count and `websitePages` fixtures that named now-served pages (update those fixtures, list each in the commit message).
- [ ] **Step 5: Commit** `feat(mcp): topic datasets in describe_coverage and search`.

### Task 6: `compare` for topics

**Files:**
- Modify: `lib/factQuery/schemas.ts` (`compareInput` union gains `{ dataset: "topic", datasetId, seriesIds, entityIds? }`), `lib/factQuery/compare.ts`
- Test: `tests/factQuery/topics/compare.test.ts`

**Interfaces:**
- Consumes: `queryIndicators`, `breakBetween`.
- Produces: comparisons in the existing `Comparison` shape; `comparability`: `not_comparable` when `breakBetween` returns a break (reason = break) or units differ; `limited` when either endpoint is `partial` or `preliminary`; else `comparable`. Endpoint labels use `periodLabel`.

- [ ] **Step 1: Write the failing tests:** Georgia schools pupils 2015→2025 comparable with the CSV-derived absolute and percentage change; kindergarten staff 2019→2020 `not_comparable` with `kindergarten_staff_2020` (Review Focus 4); a partial money-transfer year → `limited` (enable in Task 16; mark `it.todo` here with the exact assertion); endpoint text `2015/16 → 2025/26` (Review Focus 3).
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics/compare.test.ts tests/factQuery/compare.test.ts` — FAIL.
- [ ] **Step 3: Implement** the branch.
- [ ] **Step 4: Run** step 2 — PASS. Commit `feat(mcp): compare topic series between two years`.

### Task 7: `rank` for topics and the school-pupils end-to-end test

**Files:**
- Modify: `lib/factQuery/schemas.ts` (`rankInput.datasetId` becomes the existing enum or a topic dataset id, checked against `TOPIC_PAGES`; `measure` gains `"value"`, legal only for topic datasets and required there), `lib/factQuery/rank.ts`
- Test: `tests/factQuery/topics/rank.test.ts`, `tests/mcp/topicsEndToEnd.test.ts` (over `tests/mcp/httpBridge.ts`)

**Interfaces:**
- Consumes: `queryIndicators`, `breakBetween`, existing rank helpers (`groupByReason`, `splitDocuments`, `narrowAffects`).
- Produces: rankings for `dimension: "entities"` (`entityType` required, the existing singular `seriesId`, optional `withinRegionId` for municipalities) and `dimension: "series"` (one entity; candidates = series sharing one `headingKa`, or `parentSeriesId` when given); metrics `value`, `absolute_change`, `percentage_change`; exclusions with reasons for missing endpoints, breaks between the years, and `percentage_change` from zero.

- [ ] **Step 1: Write the failing tests:** `rank({ datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value", metric: "percentage_change", fromYear: 2015, toYear: 2025, order: "ascending", limit: 5 })` returns Shuakhevi −52.8, Khulo −47.3, Lentekhi −27.0, Tsalka −22.7, Tsageri −19.6 (one decimal) with labels and `2015/16`/`2025/26`; `absolute_change` ascending top two Khulo −1,861, Shuakhevi −1,273; `withinRegionId: "region.adjara"` ranks only Adjara's six municipalities; `measure: "value"` on `municipal-expenditure` is rejected; a population ranking 2024→2025 excludes every place with the census re-base reason (enable in Task 9; `it.todo` here); the same school ranking through the HTTP bridge (`tools/call rank`) returns the same five in `structuredContent`.
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics/rank.test.ts tests/mcp/topicsEndToEnd.test.ts tests/factQuery/rank.test.ts` — FAIL.
- [ ] **Step 3: Implement** the branch.
- [ ] **Step 4: Run** step 2 — PASS. Commit `feat(mcp): rank places and series in topic datasets`.

### Task 8: Sources and published topic files

**Files:**
- Modify: `lib/factQuery/getSources.ts` (accept topic `datasetId` filter), `lib/factQuery/publications.ts`, `scripts/prepare-fact-query-publications.ts`, `lib/data/publicDatasetExports.ts` (`MANIFEST_SIDE_FILE_NAMES` untouched), `lib/mcp/result.ts` (`bulkUrl` per topic dataset in `tooLargeResponse`)
- Test: `tests/factQuery/topics/publications.test.ts`, `tests/factQuery/getSources.test.ts` (extend)

**Interfaces:**
- Produces: `export function buildTopicCsvFiles(snapshot: FactQuerySnapshot): PublicationArtifact[]` — one `topics/<datasetId>.csv` per dataset, columns `year,period_label,entity_id,entity_label_ka,entity_label_en,series_id,series_label_ka,series_label_en,heading_ka,heading_en,value,unit,basis,value_status,period_end,months_reported,source_ids`; manifest and catalogue entries; `sources.json` includes topic documents; `get_sources({ datasetId: "education-schools" })` returns the Geostat workbooks with `officialUrl` `https://www.geostat.ge/media/...`.

- [ ] **Step 1: Write the failing tests:** the CSV starts with the BOM, has the header above, one row per served cell, no forbidden column names; `npm run data:check-fact-query-publications` logic (call its function) passes after a write; get_sources returns the education workbook list.
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics/publications.test.ts tests/factQuery/publications.test.ts tests/factQuery/getSources.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** step 2 — PASS. Commit `feat(mcp): topic sources and one CSV per topic dataset`.

### Tasks 9–18: The remaining adapters

Each task follows Task 2 exactly: move inline page-data code into `lib/explorer/<topic>PageData.ts` (pages call it; that topic's existing explorer tests pass unchanged), write the adapter, register it, and write `tests/factQuery/topics/<family>.test.ts` with: dataset ids and entity counts, one fact checked against its CSV row, hidden rows absent, parity (`expectWorkbookParity`) for every page of the family on its country entity and on one region/municipality/city where the page has places, in `ka` and `en`, and the family-specific rules below. Run `npx vitest run tests/factQuery/topics/<family>.test.ts` (FAIL, then PASS), then commit `feat(mcp): <family> topic adapter with page parity`.

| Task | Families (pages) | Family-specific rules to test |
|---|---|---|
| 9 | demography (5 + population places) | census re-base from `demography-series-breaks.csv` makes 2024→2025 `not_comparable`; enable the Task 7 `it.todo`; age/sex groups are series under headings |
| 10 | health (3), social (5, + places) | health staff breaks 2012 and 2020; ICD-10 2006 groups; pensions/subsistence place entities = Georgia + regions + municipalities; funded pension figures from the Pension Fund documents |
| 11 | unemployment (8, + regions), labour, wages (3, + regions) | `methodology_epoch` change becomes a `TopicBreak` per series (`breakId` `lfs_<epoch>`); survey estimates carry the note caveat |
| 12 | business (5, + regions), money-banks (6, + regions) | business and money-banks breaks files |
| 13 | living-standards: household (income, spending, + regions), poverty (poverty, inequality); housing (4, + regions) | published per-capita household series are served; Gini is a unitless index (`unit: "index"`) |
| 14 | internet (4, + regions), transport (5, + regions) | — |
| 15 | trade (6) | products: 2020–2025 only and ≈1,192 series; partners keep country groups as series; derived turnover/balance/re-exports have `status: "derived"`; whole-history products query refused with the CSV link (Review Focus 5) |
| 16 | external (current-account, foreign-debt, reserves, foreign-investment, money-from-abroad) | dated latest point 2026 carries `periodEnd: "2026-06-30"`; partial-month transfer years `status: "partial"` with `monthsReported`; enable the Task 6 `it.todo` |
| 17 | budget-extras (expenditure-types, tax-breaks-refunds), economy-expenditure | only measures the CSV publishes (GEL; share of GDP where stored as a published row) |
| 18 | crime (5), science-culture (4, + regions), environment (7, + cities/regions), energy-food (5) | crime and science-culture breaks; air-quality city entities use `city.*` ids |

### Task 19: Completeness and text surfaces

**Files:**
- Modify: `tests/factQuery/topics/pages.test.ts` (every `TOPIC_PAGES` dataset is built by some adapter), `lib/mcp/instructions.ts`, `lib/seo/llmsText.ts`, the `/connect` page copy (`lib/pages/connect.tsx` and its messages), `Project_Definition.md` (MCP line), the MCP sections of `docs/deployment.md` and the methodology notes that list served datasets, `docs/data-methodology/` (new note `mcp-topic-publications.md`), `tests/seo/agentFiles.test.ts` and `tests/seo/routes.test.ts` wording fixtures
- Create: `/mnt/project-files/mcp-full-coverage/notes-for-duru.md` (Georgian strings to proofread)

- [ ] **Step 1: Write the failing tests:** completeness (91 datasets built); `serverInstructions().length < 4096`; instructions name `query_indicators` and say school years print as `2025/26` and survey figures are estimates; `llms.txt` no longer says "Browse-only" for any served page and names `/downloads/data/topics/`; `/connect` lists the topic groups in both languages.
- [ ] **Step 2: Run** `npx vitest run tests/factQuery/topics tests/mcp tests/seo` — FAIL.
- [ ] **Step 3: Implement.** Replace the instructions' coverage sentence with: `Fiscal.ge serves reviewed data on Georgia's state and municipal budgets, government debt, the general government balance, GDP and economic sectors (annual), consumer-price and product inflation (monthly), and, through query_indicators, every other chart page on the site (annual; school years print as 2025/26; survey figures are estimates).` Shorten the websitePages sentence to non-data pages. Keep under 4,096 characters.
- [ ] **Step 4: Run** step 2 — PASS. Commit `docs(mcp): instructions, llms.txt, /connect and scope for topic coverage`.

### Task 20: Verification and review package for Duru

- [ ] **Step 1: Site unchanged.** Build `main` in a separate worktree and this branch, both with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`; `diff -rq` the two `out/` trees. Expected: differences only in `llms.txt`, `connect` and `en/connect` HTML, `downloads/data/*`. Any other difference is a defect to fix before going on.
- [ ] **Step 2: Budgets.** Record snapshot bytes, cold read+parse time and resident memory (`node --expose-gc` script loading `loadPackagedSnapshot()`), before (main) and after; `tools/list` bytes; instruction characters. Expected within the Global Constraints.
- [ ] **Step 3: Local live check.** Run the built server with `MCP_ENABLED=true MCP_RATE_LIMITER=memory VERCEL_ENV=preview VERCEL_URL=localhost:3100` and ask over HTTP, in Georgian and English: schools by municipality (the ranking), pensioners in Imereti, exports to Turkey 2025, average mortgage rate, CO2 emissions trend, recorded crimes 2015 vs 2025. Save the transcripts to `/mnt/project-files/mcp-full-coverage/live-check/`.
- [ ] **Step 4: Screenshots** of `/connect` (ka and en, desktop and phone) to `/mnt/project-files/mcp-full-coverage/preview/`.
- [ ] **Step 5:** Stop. Show Duru the results; push, PR, CI and the full gates (`npm run check`, `npm run build`, `npm run test:browser`) run only after Duru's OK, then the release follows the one-PR-at-a-time order the coordinator gives.
