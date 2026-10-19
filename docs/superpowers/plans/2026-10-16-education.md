# Education Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual Education hub (`/explorer/education` with Schools and Kindergartens index maps plus 75 place pages each, Universities, Vocational colleges and `/methodology/education`), serving about 9,500 reviewed Geostat education values.

**Architecture:** The data pipeline follows Business (merge `1f152091`; `git show 1f152091 --stat -m --first-parent` lists every shared file it touched): an immutable research package, a TypeScript prepare/check step writing one canonical CSV, a loader with CSV/DB parity and a private Prisma mirror table. The index maps and place pages follow Population (`lib/pages/demography-population*.tsx`, `lib/explorer/demographyPopulationIndex.ts`, `demographyPlaceRoutes.ts`) with its shared `MunicipalitiesIndex`, `EntityHeading`, `EntityWorkspaceShell` and `EntityMemberList`; inside the place shell sits a measure list like the Business area pages (`components/business/business-area-explorer.tsx`). Universities and Vocational follow the Business topic pages (`components/business/business-explorer.tsx`).

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, Python 3 stdlib (research package), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-16-education-design.md` (approved by Duru on 2026-10-16, 20:37 Tbilisi).

**Branch:** `claude/education-hub-ulwq3l`, from `origin/main` at `1f152091`; the spec is committed there.

## Global Constraints

- Under each page heading, only the one-line `LatestValueLine`. Nothing under the chart except one `SourceNote` line. No tab rows and no icon measure switches anywhere.
- Every series row is visible from the start under small `FlatSeriesPanel` headings; no caret-nested rows.
- Place pages chart one heading (measure) at a time; ticking a row under another heading replaces the selection. Universities and Vocational allow any mix.
- Defaults: Schools places `pupils` total (Georgia: `pupils_national.total`); Kindergartens places `kg_children.total`; Universities `he_students.total`; Vocational `vet_admitted.total`. The default stays first, selectable and removable; selection is unlimited; search never scopes the bulk action or the count.
- School years are stored as their start year and labelled `2025/26` everywhere (axis, tooltip, table, range strip, latest line, hub card, Excel). Vocational uses calendar years (`2025`). University graduates of calendar year Y are stored as school year Y−1.
- Missing means a gap, a dash or a blank Excel cell, never zero. Geostat's `…`, `...` and `-` cells produce no row. Vocational field zeros outside a field's active span produce no row.
- Fiscal.ge computes nothing: no shares, ratios, growth or sums. A region's value is Geostat's region row. Every row has `value_status = official`.
- Georgia's Schools figures (schools, pupils, teachers total/public/private) come from the national tables 01 and 06; the municipal table's GEORGIA row is a cross-check only, except teachers by sex (municipal table, 2016/17–). Georgia's pupils are in thousands to one decimal on every page.
- Abkhazia AR, Akhalgori, Eredvi, Tighva and Kurta are kept with ids `unit.abkhazia_ar`, `unit.akhalgori`, `unit.eredvi`, `unit.tighva`, `unit.kurta`; never drawn and no page. Municipal codes 05, 42, 43, 46 and 64 stay excluded.
- The 9 old vocational fields are kept in the CSV with `shown=false` and never reach a page, the client or Excel.
- Stable lowercase ASCII IDs `education.{measure}.{group}` plus a `geography_id`. Labels are display data.
- The canonical CSV is UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule). No MCP tools or central publications; the fact-query snapshot must not include education sources.
- Review before pushing: commit locally only. Screenshots, and on request a pushed-branch preview, go to Duru (Task 11). Full gates and the PR come only after Duru's OK (Task 13). Times told to Duru are in Tbilisi time (UTC+4).

## Review Focus

1. **Text-number and odd cells** (`'2 294'`, pupils `559.415`, `'...'` private teachers 2010/11, kindergarten `…` for Abkhazia): parsed exactly, published at the cell's displayed precision, `…` produces no row. Owner: Task 1 (`test_text_numbers`, `test_unavailable_cells`).
2. **A school-year label at every edge**: a range strip, table header, tooltip and Excel header for 2009 read `2009/10`, for 1999 never occur, and vocational years stay plain. Owner: Task 5 (`schoolYearLabel` tests) and Task 9 (browser).
3. **A saved link that mixes headings** (`#sel=education.pupils.total,education.teachers.women` on a region page): only the first row's heading survives and the years refit to teachers' 2016/17 start. Owner: Task 5.
4. **Graduates' year shift**: Geostat "2011 year" graduates appear under 2010/11 and 2025 under 2024/25; a Students-and-Graduates mix on Universities spans 2010/11–2025/26 with gaps, not zeros. Owner: Task 1 (`test_graduate_years`) and Task 5.
5. **Language switch, place picker and previous/next links** keep range, selection and chart/table mode on place and topic pages; Tbilisi from the map opens `region/tbilisi`. Owner: Task 9 (browser).

---

### Task 1: Research package

**Files:**
- Create: `docs/Raw Data/Education/geostat-education-annual/` with `official/`, `prepare.py`, `verify_independent.mjs`, `test_validation.py` and `README.md`, plus the generated `source-manifest.csv`, `source-manifest.json`, `education-annual.csv`, `education-series-breaks.csv`, `coverage.csv`, `validation-report.json` and `independent-validation.json`.
- Create: `data/mappings/education/units.csv` (`source_label,geography_id,mapping_note,reviewed_at`): every trimmed unit label of tables 11 and the kindergarten table, mapped to `country.georgia`, `region.<site id>`, a two-digit code from `data/imports/municipalities.csv` (TBILISI → `region.tbilisi`, never `04`) or a `unit.*` id.
- `official/` holds the six served workbooks of spec §9 and every other file in `/mnt/project-files/education-sources/` (archived only), plus captures of Geostat category pages 58, 59, 60 and 61 as HTML. Download each fresh from `/mnt/project-files/education-sources/source-urls.txt` with `curl -L`; retry once on a connection reset.

**Interfaces:**
- Produces: `education-annual.csv` with columns `year,period_label,indicator_id,geography_id,value,published_value,unit,basis,value_status,shown,source_id,source_sheet,source_cell`. `value` is the exact stored token (spaces removed from a text cell). `published_value` is the value at the cell's displayed precision (15 significant digits, then half-up to the cell format's decimals). `unit` is `persons`, `persons_thousand` or `institutions`. `shown` is `true` except the old vocational fields.
- Produces: `education-series-breaks.csv` with demography's header `break_id,applies_to,reference_date,reason,source_note`: `kindergarten_staff_2020` (`education.kg_staff.*`, `2020-09-01`, the widened header text quoted) and `he_levels_2015` (`education.he_*.level_bachelor` and `.level_master`, `2015-09-01`, Geostat's ISCED 2011 note quoted).
- Source IDs: `geostat_education_schools_national` (01), `geostat_education_teachers_national` (06), `geostat_education_municipal` (11), `geostat_education_kindergartens`, `geostat_education_higher`, `geostat_education_vocational`, plus archived-only IDs for the rest and the page captures.
- The cell map. `prepare.py` finds year columns by header text and rows by label, never by fixed position:

| Measure | Workbook / sheet | Geographies and groups | Years |
| --- | --- | --- | --- |
| `schools`, `pupils_national` (thousand), `teachers` | 01 and 06 sheet `1` | `country.georgia`: `total`, `public`, `private` | 2000/01– (teachers 2006/07–) |
| `schools`, `pupils` | 11 sheets `schools`, `pupils` | every mapped unit except `country.georgia`: `total` | 2005/06– |
| `teachers` | 11 sheet `teachers` (Total/Women/Men triples) | every mapped unit: `total` (not Georgia), `women`, `men` | 2016/17– |
| `kindergartens`, `kg_children`, `kg_staff` | kindergarten sheet `1` (triples per year) | every mapped unit incl. Georgia: `total` | 2017/18– |
| `he_students`, `he_admitted`, `he_graduates` | higher 01 sheets `Number`, `Admission`, `Graduates`: the "Public And Private" block's total row (Total plus three "of which" level columns), its 8 field rows, its "of which females"/"of which males" total cells, and the Public and Private blocks' total cells | `country.georgia`: `total`, `level_bachelor`, `level_master`, `level_professional`, `public`, `private`, `women`, `men`, `field_education`, `field_humanities_arts`, `field_social_business_law`, `field_science`, `field_engineering`, `field_agriculture`, `field_health_welfare`, `field_services` | 2011/12– (graduates stored 2010/11–2024/25) |
| `vet_admitted`, `vet_graduates` | vocational sheet `1`, Total/Women/Men triples per measure per year | `country.georgia`: `total`, `women`, `men`, current fields `field_agriculture_vet`, `field_arts_humanities`, `field_business_law`, `field_education`, `field_engineering`, `field_health_welfare`, `field_ict`, `field_services`, `field_social_journalism` (shown), old fields `old_agricultural_sciences`, `old_business_administration`, `old_engineering`, `old_natural_sciences`, `old_inter_directional`, `old_law`, `old_social_sciences`, `old_art`, `old_health` (`shown=false`) | 2013–2025 |

`period_label` is `2025/26` for school years and `2025` for vocational. A vocational field's active span runs from the first to the last year either measure is non-zero; cells outside it produce no row.

- [ ] **Step 1: Write `test_validation.py`** (stdlib `unittest`, modelled on Business's):
  - `test_counts`: per-indicator counts match `coverage.csv`; print the total (spec: about 9,500).
  - `test_altered_cell_fails`: patching one value makes `prepare.validate` raise.
  - `test_text_numbers`: table 01 2024/25 schools (`'2 294'`) parses to `2294`; 2012/13 pupils publishes `559.415` exactly as stored and `559.4` displayed.
  - `test_unavailable_cells`: no row for 06 private teachers 2010/11, for kindergarten Abkhazia, or for a vocational field before its span (`field_ict` 2018).
  - `test_unknown_label_stops`: a label missing from `units.csv` raises.
  - `test_parts_add_up`: public + private = total (Georgia schools, pupils_national within 0.15, teachers; each `he_*`); women + men = total (teachers by unit, `he_*`, `vet_*`); levels and fields each = total (`he_*`); old + current vocational fields = total every year and current alone from 2023; municipalities plus their `unit.*` rows = region row, and regions + `unit.abkhazia_ar` = Georgia for `schools`, `pupils`, `teachers`, `kindergartens`, `kg_children`, `kg_staff`, tolerance 0. Record any mismatch exactly in `validation-report.json` rather than adjusting a value; a mismatch stops only if not listed in a reviewed `data/mappings/education/known-differences.csv`.
  - `test_cross_checks`: table 11 GEORGIA pupils ÷ 1000 rounds to table 01 at one decimal every year; table 11 GEORGIA schools = table 01; table 11 GEORGIA teachers = table 06 from 2016/17.
  - `test_graduate_years`: `he_graduates.total` has stored years 2010–2024 and the 2024 row's cell is in the "2025 year" column with value `32494`.
  - `test_anchor_values`: 2025/26 (year 2025) `schools.total` Georgia `2292`, `schools.private` `206`, `pupils_national.total` `644.2`, `pupils.total` `region.tbilisi` `232134`, `teachers.total` Georgia `66328`, `kindergartens.total` Georgia `1717`, `kg_children.total` `130337`, `kg_staff.total` `19176`, `he_students.total` `195426`, `he_admitted.total` `58554`; `he_graduates.total` year 2024 `32494`; `vet_admitted.total` 2025 `19690`, `vet_graduates.total` 2025 `10537`.
- [ ] **Step 2: Run** `cd "docs/Raw Data/Education/geostat-education-annual" && python3 -m unittest test_validation -v`. Expected: FAIL (no `prepare` module).
- [ ] **Step 3: Implement `prepare.py`** with stdlib only (`zipfile`, `xml.etree`, `decimal`, `hashlib`, `csv`, `json`); if parsing cell XML by regex use `<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)`. It writes the manifest, the two CSVs, `coverage.csv` (indicator, geography, first year, last year, count, unavailable years) and `validation-report.json` (`status`, counts, `imputed_values: 0`, `calculated_values: 0`).
- [ ] **Step 4: Implement `verify_independent.mjs`**: re-reads each served workbook with the repo's `xlsx` package (`createRequire` from `apps/web`), recomputes every row and writes `independent-validation.json` with `status: "passed"`.
- [ ] **Step 5: Run** `python3 prepare.py && python3 -m unittest test_validation -v && node verify_independent.mjs`. Expected: all PASS, `"status": "passed"`.
- [ ] **Step 6: Write `README.md`**: files, URLs, retrieval date, cell map, checks, the Geostat notes (2010/11 "as at 5 April 2011", teachers counted per school, kindergartens "actually operating institutions", ISCED 2011 master note), the graduate year shift and the vocational field change. Commit `feat(data): archive reviewed Geostat education statistics`.

### Task 2: Canonical serving file

**Files:**
- Create: `apps/web/lib/data/education/types.ts`, `validation.ts`, `prepareEducation.ts`; `apps/web/scripts/prepare-education.ts`; `apps/web/tests/data/education/education.test.ts`.
- Generated: `data/imports/education-annual.csv`, `data/imports/education-series-breaks.csv`, `data/reports/education-validation.json`.
- Modify: `apps/web/package.json` (`data:prepare-education`, `data:check-education`), `apps/web/scripts/validate-all.ts` (`"data:check-education"` beside `"data:check-business"`).

**Interfaces:**
- Produces (`types.ts`): `EDUCATION_MEASURES` (the 13 measure ids of Task 1, as const) and `EducationMeasure`; `EDUCATION_HE_GROUPS`, `EDUCATION_VET_FIELDS`, `EDUCATION_VET_OLD_FIELDS`; `EducationIndicator` (template literal) and `educationIndicator(measure, group)`; `EDUCATION_SOURCES` (the 6 served) and `EDUCATION_PUBLIC_SOURCES`; `EducationFact = { year; periodLabel; indicatorId; geographyId; value: string; publishedValue: string; unit: "persons" | "persons_thousand" | "institutions"; basis: "actual"; valueStatus: "official"; shown: boolean; sourceId; sourceSheet; sourceCell; lastReviewedAt }`; `ClientEducationFact = Pick<EducationFact, "year" | "indicatorId" | "geographyId" | "sourceId"> & { value: number; unit: "persons" | "institutions"; decimals: 0 | 1 }`; `educationFactKey({ indicatorId, geographyId, year })`.
- Produces (`validation.ts`): `expectedEducationKeys()`, `educationDisplayDecimals(indicatorId): 0 | 1` (1 only for `pupils_national`), `validateEducationFacts(facts): void` (Business's identity, coverage, duplicate, source-contract and rounding checks plus Task 1's sums, cross-checks and anchors).
- Produces (`prepareEducation.ts`): `prepareEducationData(repositoryRoot, mode: "write" | "check")`, `EDUCATION_CSV_HEADERS`, `REVIEWED_AT = "2026-10-16"`.

- [ ] **Step 1: Write `tests/data/education/education.test.ts`** (modelled on `tests/data/business/business.test.ts`): `prepareEducationData(root, "check")` resolves and the row count equals the package total; `validateEducationFacts` rejects an altered `publishedValue`, a duplicate, a missing key, a 2004 `pupils` row for a municipality, a `vet_admitted.field_ict` 2018 row, a `calculated` status, a `shown=true` old field, and a region row that no longer equals its parts.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/education/education.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** by mirroring `lib/data/business/*` (verified package reads, cell re-reads, the research report gate, `assertGeneratedArtifactMatches("education", …)`), the script (a copy of `prepare-business.ts`), the package scripts and the `validate-all` entry.
- [ ] **Step 4: Run** `npm run data:prepare-education && npm run data:check-education && npx vitest run tests/data/education/education.test.ts`. Expected: `{"status":"passed","scope":"education_annual"}` and PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed annual education data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create: `apps/web/lib/data/education/importEducation.ts`, `apps/web/prisma/migrations/20261016220000_education/migration.sql`.
- Modify: `apps/web/prisma/schema.prisma` (`EducationFact`, `@@id([indicatorId, geographyId, year])`), `lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `scripts/import-budget-facts.ts`, `data/sources/source-documents.csv`, `docs/deployment.md` (`EducationFact` wherever `BusinessFact` appears).
- Test: extend `tests/data/education/education.test.ts`.

**Interfaces:**
- Consumes: Task 2.
- Produces: `loadEducationFacts()`, `assertEducationParity(csv, mirror)`, `loadServedEducationData(): Promise<{ facts: EducationFact[] }>` (shown and hidden rows), `toClientEducationFact(f): ClientEducationFact` (`persons_thousand` → `Number(publishedValue) × 1000`, unit `persons`, decimals 1; `institutions` and `persons` as published, decimals 0), `shownEducationFacts(facts)` (drops `shown=false`), `loadEducationFactsFromDb()` and the mirror mapper and import comparison named like Business's. The migration enables RLS and revokes public grants exactly as `20261015220000_business/migration.sql`.

- [ ] **Step 1: Add the tests**: parity passes on identical arrays and on `"644.2"` vs `"644.20"`, throws on a changed value or missing row; the loader throws on a fingerprint mismatch; `toClientEducationFact` gives `644200`, unit `persons`, decimals 1 for `pupils_national.total` 2025 and `2292`, `institutions`, decimals 0 for `schools.total`; `shownEducationFacts` contains no `old_` indicator.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement**, copying each Business addition in the same file. Run `npx prisma validate && npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/education/education.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed education data with exact parity`.

### Task 4: Shared additions (place routes by base path, one-group selection)

**Coordination:** the Housing thread's plan (`/mnt/project-files/plans/2026-10-16-housing.md`, Task 4) moves Business's one-unit helpers verbatim into `apps/web/lib/explorer/unitList.ts` (`keepOneUnit`, `unitListCoverage`, `parseUnitListHash`, `changeUnitListSelection`, generic over `UnitFact = { indicatorId; year; unit }`). Education uses that same file and API, so the two hubs share one copy. If Housing has merged, use its file and add only the optional parameter below; if not, create the file exactly as the Housing plan names it, and whichever hub merges second keeps one copy.

**Files:**
- Modify: `apps/web/lib/explorer/demographyPlaceRoutes.ts`; `apps/web/lib/explorer/unitList.ts` (create as above if absent); `apps/web/lib/explorer/business.ts` (one-line delegations, as Housing's plan states).
- Test: `tests/explorer/demographyPlaceRoutes.test.ts` (create if absent, else extend), `tests/explorer/unitList.test.ts` (extend or create); existing `tests/explorer/business.test.ts` and the demography tests must pass unchanged.

**Interfaces:**
- Produces (`demographyPlaceRoutes.ts`): `placePageHref(basePath: `/${string}`, placeId: string): string`, `placeHrefById(basePath, places): Record<string, string>` and `placePagePaths(basePath, regionIds): string[]`. `populationPlaceHref`, `populationHrefById` and `populationPlacePaths` become one-line calls with `POPULATION_PATH`; their output is unchanged.
- Produces (`unitList.ts`): Housing's four functions, each with one optional last parameter `groupOf?: (id: string) => string | undefined` that replaces "the fact's unit" as the grouping key. Omitted, behaviour is exactly Business's (and Housing's). Education passes the row's heading (its measure).

- [ ] **Step 1: Write the tests**: `placePageHref("/explorer/education/schools", "04")` is `/explorer/education/schools/region/tbilisi`, `"country.georgia"` gives `/georgia`, `"06"` gives `/batumi` (the Budget slug); `placePagePaths` returns 75 paths; `populationPlaceHref` results are unchanged for the same ids. `keepOneUnit` without `groupOf` reproduces the six expectations of `tests/explorer/business.test.ts:104-112`; with a `groupOf` that maps `pupils.*` and `teachers.*` to different groups, ticking `teachers.women` while `pupils.total` is selected returns `[teachers.women]` although both are `persons`.
- [ ] **Step 2: Run** them. Expected: FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/explorer/demographyPlaceRoutes.test.ts tests/explorer/unitList.test.ts tests/explorer/business.test.ts tests/explorer/demography*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor: share place routes and one-group selection for new hubs`.

### Task 5: Explorer models and state

**Files:**
- Create: `apps/web/lib/explorer/education.ts` (sections, labels, topic pages), `apps/web/lib/explorer/educationPlaces.ts` (index maps and place pages), `apps/web/tests/explorer/education.test.ts`.

**Interfaces:**
- Consumes: `ClientEducationFact`, `topicSeries` helpers, `unitList.ts` with `groupOf`, `refitRange`, `placeIndexRows`, `buildMunicipalityValueMapModel`, `buildDemographyPlaces`, `placePageHref`.
- Produces (`education.ts`):
  - `EDUCATION_HUB_PATH = "/explorer/education"`; `EDUCATION_SECTIONS`: `schools`, `kindergartens`, `universities`, `vocational`, hrefs `/explorer/education/<id>`, label keys `common.educationSchools|educationKindergartens|educationUniversities|educationVocational`; `EducationSectionId`; `EducationTopicId = "universities" | "vocational"`.
  - `schoolYearLabel(year: number): string` (`2025` → `2025/26`, `2009` → `2009/10`, `1999` → `1999/00`) and `educationPeriodLabel(section): (year: number) => string` (vocational → `String`).
  - `EducationSeriesDefinition = { id: string; reference: boolean; heading: EducationMeasure }`, `educationTopicSeries(section)`: universities lists `he_students`, `he_admitted`, `he_graduates`, each with the 16 groups in spec §6 order (48 rows); vocational lists `vet_admitted`, `vet_graduates`, each with `total`, `women`, `men` and the 9 current fields in spec §7 order (24 rows). Only the first measure's `total` is `reference`.
  - `educationDefaultSelection(section)`, `defaultEducationState`, `parseEducationHash`, `serializeEducationHash`, `buildEducationModel(section, facts, state)` (Business model shape), `educationSeriesColor` (totals ink, others `topicSeriesColor`).
- Produces (`educationPlaces.ts`):
  - `EducationPlaceSet = "schools" | "kindergartens"`, `educationPlaceBase(set)`, `educationPlaceSeries(set, placeId)`: Schools Georgia gives `pupils_national.total|public|private` (heading `pupils`), `teachers.total|public|private|women|men` (heading `teachers`), `schools.total|public|private` (heading `schools`); Schools elsewhere gives `pupils.total`, `teachers.total|women|men`, `schools.total`; Kindergartens gives `kg_children.total`, `kg_staff.total`, `kindergartens.total` for every place. The place's facts are filtered by `geographyId`.
  - `educationPlaceDefaultSelection(set, placeId)`, `parseEducationPlaceHash`, `changeEducationPlaceSelection` (via `changeUnitListSelection` with `groupOf` = the row's heading, years clamped with `collapseToAll: false`), `educationPlaceCoverage(set, placeId, facts, selectedIds)`, `buildEducationPlaceModel`.
  - `buildEducationIndexModel(set, facts, regions, municipalities)`: `{ year; map: MunicipalityMapModel; municipalities; regions; country }` from `placeIndexRows` on the latest year's `pupils.total` (Schools; Georgia row `pupils_national.total`) or `kg_children.total` (Kindergartens).

- [ ] **Step 1: Write `tests/explorer/education.test.ts`**:
  - `schoolYearLabel` cases above (Review Focus 2).
  - Defaults and coverage: Universities `["education.he_students.total"]`, 2011–2025; Vocational 2013–2025; Schools Georgia `pupils_national.total`, 2000–2025; Schools `region.guria` `pupils.total`, 2005–2025; Kindergartens `region.tbilisi` 2017–2025.
  - Rows: Universities 48 rows under 3 headings; Vocational 24; no `old_` id anywhere; Schools Georgia 11 rows, a municipality 5.
  - Hash (Review Focus 3): `#sel=education.pupils.total,education.teachers.women` on `region.guria` keeps `[pupils.total]`; ticking `teachers.women` with pupils selected replaces it and the range becomes 2016–2025 when it was all.
  - Model (Review Focus 4): Universities with students and graduates selected spans 2010–2025, students 2010 is `null`, graduates 2025 is `null`.
  - Index: Schools year 2025, Tbilisi (`04`/`region.tbilisi`) ranked first among regions, 63 municipalities plus Tbilisi in the map rows; Georgia row value `644200`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/education.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run.** Expected: PASS. **Step 5: Commit** `feat: model education pages, place pages and state`.

### Task 6: Excel workbooks and hub cards

**Files:**
- Create: `apps/web/lib/explorer/educationWorkbook.ts`, `apps/web/lib/explorer/educationHubCards.ts`. Test: extend `tests/explorer/education.test.ts`.

**Interfaces:**
- Produces: `buildEducationWorkbookExportModel({ section } | { set, placeId, scope }, facts, state, labels, sources, siteOrigin, title }, presentation): WorkbookExportModel`, mirroring `businessWorkbook.ts`; column headers use `educationPeriodLabel`; filenames `education-<section>-<start>-<end>` and `education-<set>-<scope>-<start>-<end>` with start/end as `2025-26` for school years. Number formats `"#,##0"` (persons, institutions) and `"#,##0.0"` (Georgia pupils in thousands, unit `education.unitThousandPupils`). Only the workbooks behind the exported series are listed as sources.
- Produces: `buildEducationHubCards(facts, presentation): HubCardModel[]`: four cards with sparklines of `pupils_national.total`, `kg_children.total` (Georgia), `he_students.total`, `vet_admitted.total`; English footers `"2025/26 · 644.2 thousand · 2000/01–2025/26"`, `"2025/26 · 130,337 · 2017/18–2025/26"`, `"2025/26 · 195,426 · 2011/12–2025/26"`, `"2025 · 19,690 · 2013–2025"`.

- [ ] **Step 1: Write the tests**: a Universities workbook 2010/11–2025/26 with students and graduates has header `2010/11` first and blank cells where a series has no value; a Guria Schools pupils workbook uses `"#,##0"` and lists only table 11; a Georgia pupils workbook uses `"#,##0.0"` with value `644.2`; the four hub footers.
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run.** PASS.
- [ ] **Step 5: Commit** `feat: export education data to Excel and build hub cards`.

### Task 7: Messages and i18n wiring

**Files:**
- Create: `lib/i18n/messages/ka/education.json`, `lib/i18n/messages/en/education.json`.
- Modify: `lib/i18n/messages/{ka,en}/common.json` (`education`, `dataEducation`, `educationSchools`, `educationKindergartens`, `educationUniversities`, `educationVocational`), `lib/i18n/types.ts`, `lib/i18n/messages.server.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json` (new routes).

Keys mirror `business.json`, plus `page.<section>.title|summary|metaTitle`, `place.headingLead.<set>` and `place.metaTitle|metaDescription`, `heading.<measure>` for every measure, `group.<group>` for every group, `unitPersons`, `unitThousandPupils`, `unitInstitutions`, `latest.<section>` and `latest.place.<set>`, `sourceNote.<section>`, `mapAria`, `mapLegend.<set>`.

Georgian proposals (for Duru's proofread): hub განათლება; pages სკოლები, საბავშვო ბაღები, უნივერსიტეტები, პროფესიული კოლეჯები; headings მოსწავლეები, მასწავლებლები, სკოლები, ბავშვები, აღმზრდელები, ბაღები, სტუდენტები, ჩარიცხულები, კურსდამთავრებულები; groups ყველა, საჯარო, კერძო, ქალები, კაცები, ბაკალავრიატი, მაგისტრატურა, პროფესიული პროგრამები; field names follow Geostat's Georgian tables (ganatleba section, categories 59 and 61 Georgian pages).

English latest lines: "2025/26: 644.2 thousand pupils in 2,292 schools"; "2025/26: 130,337 children in 1,717 public kindergartens"; "2025/26: 195,426 university students"; "2025: 19,690 admitted to vocational colleges"; place: "2025/26: 13,743 pupils · Guria".

- [ ] **Step 1: Add the files, run** `npm run i18n:check`. Expected: FAIL. **Step 2: Wire the namespace** as Business did. **Step 3: Run** `npm run i18n:check && npm run typecheck`. Expected: PASS. **Step 4: Commit** `feat: add Georgian and English education copy`.

### Task 8: Index and place pages

**Files:**
- Create: `components/education/education-place-explorer.tsx`; `lib/pages/education-places.tsx` (index, metadata, place render, static params for both sets); routes `app/(ka)/explorer/education/{schools,kindergartens}/{page,georgia/page,region/[id]/page,[slug]/page}.tsx` and the `app/(en)/en/explorer/education/…` mirrors (copy the Population route files' shape).

**Interfaces:**
- Consumes: Tasks 3–7, `MunicipalitiesIndex`, `EntityHeading`, `EntityWorkspaceShell`, `EntityMemberList`, `buildPickerCountry`, `pickerGroupsFromRows`, `placeNeighbours`.
- Produces: `EducationPlaceExplorer({ set, place, places, facts, labels, title, metaLine, navigation, pickerCountry, pickerGroups, pickerOverrides, sources, siteOrigin, workbookScope, lastReviewedAt, children })`: the Population place shell around the Business area workspace (Chart | Table, unit caption, `EditorialLineChart` with `formatPeriod`, `ExplorerTable` with `yearLabel`, `RangeStrip` with `formatPeriod`, `FlatSeriesPanel` rows with `heading`, `searchable={false}`, Excel). `renderEducationIndexPage(locale, set)`, `educationIndexMetadata`, `renderEducationPlacePage(route, locale, set)`, `educationPlaceMetadata`, `educationRegionParams`, `educationMunicipalityParams`. Test ids: `education-latest`, `education-excel-download`, `education-place-<set>`.
- Reuse check first: if `PopulationPlaceExplorer`'s shell part can be lifted into a shared component by props with Population's output unchanged, do that instead of re-composing; record the choice in the commit message.

- [ ] **Step 1: Implement** the component, page module and routes; the index passes `overrides.hrefById = placeHrefById(base, places)`, `valueFormat: "persons"`, `mapWording`, and an empty `kpis`; under the heading only the latest line.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npx vitest run tests/explorer/education.test.ts`. Expected: PASS.
- [ ] **Step 3: Commit** `feat: add education index maps and place pages`.

### Task 9: Hub, topic pages, navigation, SEO and browser tests

**Files:**
- Create: `components/education/education-explorer.tsx` (Universities and Vocational, mirroring `BusinessExplorer` with `formatPeriod`/`yearLabel` and `searchable` on), `lib/pages/education.tsx` (hub and topic pages), routes `app/(ka)/explorer/education/{page,universities/page,vocational/page}.tsx` and en mirrors, `tests/browser/education.spec.ts`.
- Modify: `lib/navigation/navTree.ts` (Education after Living standards, four sections), `components/shell/explorer-footer.tsx`, `lib/seo/sitemap.ts`, `lib/seo/datasetVocabulary.ts`, `public/llms.txt`, `tests/seo/routes.test.ts`, `tests/seo/agentFiles.test.ts`, `tests/navigation/navTree.test.ts`, `tests/site/datasetHubs.test.ts`, and the browser count assertions Business touched (`git show 1f152091 -m --first-parent -- apps/web/tests/browser/landing.spec.ts apps/web/tests/browser/mobile-repairs-nav.spec.ts apps/web/tests/browser/mobile-site-menu.spec.ts apps/web/tests/browser/seo.spec.ts`). A thirteenth hub may change the phone footer bound; re-measure as Business did.

- [ ] **Step 1: Write `tests/browser/education.spec.ts`**:
  - The hub shows four cards; the Schools card names `2025/26`.
  - `/explorer/education/schools` draws the municipality map, Georgia's row first; clicking Tbilisi opens `/explorer/education/schools/region/tbilisi` (Review Focus 5).
  - Guria's Schools page: latest line contains `13,743` and `2025/26`; headings Pupils, Teachers, Schools; ticking Teachers → Women replaces Pupils and the range strip starts at `2016/17`; the member list lists Guria's municipalities; the next link opens the next region.
  - Georgia's Schools page: table mode shows the `2000/01` column and Private pupils.
  - Kindergartens Tbilisi page starts at `2017/18`.
  - Universities: one selected row, latest contains `195,426`; search `ქალ` shows three Women rows and the count is unchanged; with Graduates ticked, table mode shows `—` for 2025/26 graduates (Review Focus 4).
  - Vocational: 24 rows, no `Law` row, axis labels plain years.
  - Switching to `/en` keeps the hash on Guria Schools and on Universities (Review Focus 5).
  - Excel download fires a `.xlsx` on a place page and on Universities.
  - At 390 px no horizontal scroll on the hub, both indexes, Guria Schools, Universities and Vocational.
- [ ] **Step 2: Implement** the component, pages, routes, nav, footer, sitemap and SEO. Extend `tests/seo/routes.test.ts` with every new route (3 + 2 × 76 per locale).
- [ ] **Step 3: Run** `npx vitest run tests/seo tests/navigation tests/site tests/explorer/education.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Run** `npx playwright test tests/browser/education.spec.ts tests/browser/demography.spec.ts tests/browser/business.spec.ts` against a built server (CLAUDE.md commands, `CI=1`). Record the build time against `main`'s. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add bilingual education hub and topic pages`.

### Task 10: Methodology page and source archive

**Files:**
- Create: `lib/methodology/content/education.ts`, `lib/methodology/content/en/education.ts`, `data/methodology/source-archives/education.csv`.
- Modify: everything Business's methodology step modified, with `education` for `business` (`git show 1f152091 -m --first-parent -- apps/web/lib/methodology apps/web/lib/pages/methodology-article.tsx data/localization/en/documents.json data/localization/en/sources.json data/methodology/decision-register.csv apps/web/lib/factQuery/buildSnapshot.ts`) and the matching tests (`tests/methodology/*`, `tests/i18n/methodologyCoverage.test.ts`, `tests/factQuery/buildSnapshot.test.ts`, `tests/browser/methodology.spec.ts`, `tests/browser/bilingual-methodology.spec.ts`).

The content covers spec §10 in plain words and says nothing Geostat did not publish.

- [ ] **Step 1: Update the catalogue, archive and snapshot tests** to expect `education`. **Step 2: Run.** FAIL. **Step 3: Implement**, then run `npm run data:check-methodology-archives` and the methodology tests. PASS, with no education source in the snapshot. **Step 4: Commit** `feat: publish education methodology and original sources`.

### Task 11: Preview for Duru (stop point)

- [ ] **Step 1:** Push nothing. Build and serve per CLAUDE.md on port 3100. Screenshot with Chromium (`executablePath` `/opt/pw-browsers/chromium-*/chrome-linux/chrome`) into `/mnt/project-files/screenshots/education/`: ka and en at 1440 for the hub, both indexes, Schools Georgia (chart and table), Schools Guria, a municipality, Kindergartens Tbilisi, Universities, Vocational and the methodology page; ka at 390 for the hub, Schools index, Guria and Universities.
- [ ] **Step 2:** Reply with the main screenshots and an `ask_decision` card: "Clickable preview" (push the branch without a PR), "Screenshots only", "Looks good, go ahead". **Wait.** Apply requested changes and repeat until Duru approves.

### Task 12: Scope and design documents

**Files:** Create `docs/data-methodology/education-annual.md` (package, IDs, checks, serving and export rules). Modify `Project_Definition.md` §2 (a new approved Education item after the last lettered item), `DESIGN.md` (a new Education surfaces section after the last numbered one, and §6.7's sidebar order).

- [ ] **Step 1:** Write the documents. **Step 2:** `npm run i18n:check`. **Step 3:** Commit `docs: record the education hub`.

### Task 13: Full gates and delivery (only after Duru's OK in Task 11)

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`, keeping both sides in shared files and renumbering the `DESIGN.md` section, `Project_Definition.md` item, migration timestamp and page counts if another hub merged first.
- [ ] **Step 2:** `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100` with `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`. Expected: all green.
- [ ] **Step 3:** `git push -u origin claude/education-hub-ulwq3l`. Open a draft PR with the attribution block, assign DuruMakh and request their review. Subscribe to PR activity and drive CI to green.
- [ ] **Step 4:** Reply with the PR link. Merging releases to production, so it waits for Duru.
