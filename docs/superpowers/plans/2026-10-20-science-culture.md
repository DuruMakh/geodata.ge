# Science and Culture Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual Science and culture hub (`/explorer/science-culture` with `/research`, `/patents`, `/museums`, `/museums/[id]` for Georgia and 11 regions, `/theatres`, and `/methodology/science-culture`), serving about 1,720 reviewed Geostat values.

**Architecture:** A copy of the Housing hub's shape as built (PR #191, merge `033e4c05`; `git diff 033e4c05^1 033e4c05 --stat` lists every shared file it touched; Education, merge `a8ac0083`, is the latest hub to have touched the browser page counts). The parts are an immutable research package, a TypeScript prepare/check step writing one canonical CSV plus a series-break CSV, a loader with CSV/DB parity, a private Prisma mirror table, models built on the shared `topicSeries`, `unitList` and `areaRoutes` helpers, and three thin client components (topic pages, Museums index, Museums area pages) composed from the shared explorer shell. The theatre audience break reuses Crime's break handling.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, SheetJS (`xlsx`, already a dependency), Python 3 with `xlrd` 2.0.x (research package only, not CI; `python3 -m pip install xlrd==2.0.1`), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-20-science-culture-design.md` (approved by Duru on 2026-10-20, 09:55 Tbilisi).

**Branch:** `claude/science-culture-hub-4wkqsn`, from `main` at `a8ac0083`; the spec is committed there.

## Global Constraints

- Yearly values only: Research 2019–2024; Patents 2016–2025; Museums 2005–2025 (staff 2020–2025); Theatres 2006–2025 (events 2021–2025, staff 2020–2025).
- Under each page heading, only the one-line `LatestValueLine` (fits one line at 375 px). Nothing under the chart except one `SourceNote` line.
- No tab rows and no icon switches anywhere (the Museums map has none). Rows sit under headings; the chart shows one unit at a time; ticking a row of another unit replaces the selection (`changeUnitListSelection`).
- Every row visible from the start under its heading; no nesting, no prefixes in series names; outside the list a row is named `Heading — Row`.
- Defaults: All researchers (Research); Invention applications — Georgian applicants (Patents); Visitors (every Museums area page); Audience (Theatres). Defaults stay first, selectable and removable, drawn in ink; selection unlimited; search (lists over 10 rows) never scopes the bulk action or the count.
- Display: counts whole numbers; visitors, group tours, audience and seats in thousands to one decimal; spending in million ₾ to one decimal. Latest lines: museums index in million to one decimal ("2025: 2.0 million museum visitors").
- Missing means a gap, a dash or a blank Excel cell, never zero. `…` and blank cells produce no row. `-` is stored as `0` in the researcher, R&D staff, patent and staff tables; the theatre events rows' `-` for 2006–2020 produce no row.
- Fiscal.ge computes nothing. Every row has `value_status = official`, `basis = actual`. Geostat's averages are not served.
- Regions use the site's 11 region IDs (`BUSINESS_REGIONS`). Stable lowercase ASCII IDs `science_culture.{measure}.{group}` (spec §9).
- The canonical CSV is UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule). No MCP tools, no central JSON/CSV publications; the fact-query snapshot must not include these sources.
- Review before pushing: commit locally only. Screenshots, and on request a pushed-branch preview, go to Duru (Task 9). Full gates and the PR only after Duru's OK (Task 11). Times to Duru in Tbilisi time.

## Review Focus

1. **Geostat's `-` read the wrong way:** a researcher field with `-` (Not identified 2022–2024) must chart 0 and keep fields adding up, while theatre events 2006–2020 must be gaps. Owner: Task 1 (`test_dash_cells`), Task 4 (model gap).
2. **A saved link mixing units** (`#sel=science_culture.researchers.total,science_culture.rd_spending.total`) keeps only the first row's unit; patents rows from all four headings can be selected together. Owner: Task 4.
3. **Area link from Georgia carrying a Georgia-only row** (a museum type or staff row) to a region falls back to that region's default; Visitors stays Visitors between any two areas. Owner: Task 4 (`museumAreaSelectionHash`), Task 7 (browser).
4. **Theatre audience break:** with Audience selected the chart draws the "new counting" rule at 2021 and the table marks 2021; with only Seats selected there is no rule; a range starting at 2021 shows none. Owner: Task 4, Task 7.
5. **Language switch** keeps selection, range and chart/table mode on topic and area pages. Owner: Task 7 (browser).

---

### Task 1: Research package

**Files:**
- Create: `docs/Raw Data/ScienceCulture/geostat-science-culture-annual/` with `official/`, `prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`, and generated `source-manifest.csv`, `source-manifest.json`, `science-culture-annual.csv`, `science-culture-series-breaks.csv`, `coverage.csv`, `validation-report.json`, `independent-validation.json`.
- `official/` holds every file in `/mnt/project-files/science-culture-sources/source-urls.txt` downloaded fresh (`curl -sSL`, retry once on reset), the Georgian `ka/` workbooks, and captures of Geostat category pages 194 and 615 (en) as HTML.

**Interfaces:**
- Produces `science-culture-annual.csv` with Housing's columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`. `value` is the cell's shortest round-trip number text with a trailing `.0` removed, or `0` for a `-` cell in a table where `-` means none. `published_value` is the value at its display precision (15 significant digits, then half-up): counts 0 decimals; thousands and million ₾ the cell's stored decimals.
- Units: `persons`, `persons_thousand`, `count`, `count_thousand` (group tours, seats), `gel_million`.
- Served source IDs: `geostat_science_researchers`, `geostat_science_rd_staff`, `geostat_science_institutions`, `geostat_science_patents`, `geostat_culture_museums`, `geostat_culture_museums_regions`, `geostat_culture_museums_count_regions`, `geostat_culture_museum_staff`, `geostat_culture_theatres`, `geostat_culture_theatre_events`, `geostat_culture_theatre_staff`. Archive-only IDs for the publications, exhibits, libraries (2), publishing, theatres-by-region (2) workbooks, the Georgian workbooks and the two page captures.
- The cell map (rows found by first-column label, columns by year header, the Total/Women/Men triple by the sub-header; never fixed positions):

| Measure IDs | Workbook / sheet | Groups | Years |
| --- | --- | --- | --- |
| `researchers.*` | Researchers.xlsx 1 | `total`, `women`, `men`, `degree_{doctoral,master,bachelor,short_cycle}` | 2019–2024 |
| `researchers.age_*` | sheet 2 (Total column) | `age_{under25,25_34,35_44,45_54,55_64,65_plus}` | 2019–2024 |
| `researchers.field_*` | sheet 3 (Total column) | `field_{natural,engineering,medical,agricultural,social,humanities,not_identified}` | 2019–2024 |
| `rd_staff.*` | R&D-Personal.xlsx | `total`, `women`, `men`, `technicians`, `support`, `not_specified` | 2019–2024 |
| `institutions.total`, `rd_spending.total` | Institutions.xlsx | — | 2019–2024 |
| `{invention,utility}_{applications,patents}.*` | Invention-Utility-Model.xlsx 1 (invention), 2 (utility) | `local`, `foreign`, `international` | 2016–2025 |
| `museums.total`, `museums.type_*` | Main-charasteristics-of-Museums.xls | `type_{memorial,history,art,reserve,literature,other}` | 2005–2025 |
| `museums.region_*` | Number-of-Museums-by-Regions.xls | 11 regions | 2005–2025 |
| `museum_{visitors,tours,exhibitions}.{total,region_*}` | Main-charasteristics-of-Museums-by-Regions.xls (three blocks) | Georgia + 11 | 2005–2025 |
| `museum_staff.*`, `theatre_staff.*` | Employed-Staff-in-{Museums,Theatres}.xls (Total block; Women/Men blocks' totals) | `total`, `women`, `men`, `permanent`, `contract`, `age_under25`, `age_25_54`, `age_55_plus` | 2020–2025 |
| `theatres.total`, `theatres.type_*`, `theatre_seats.total` | Main-Indicators-Of-Professional-Theatres.xls | `type_{drama,puppet,opera_ballet,youth}` | 2006–2025 |
| `theatre_audience.total`, `theatre_shows.{total,away,abroad}`, `theatre_events.{total,away,abroad}` | Events.xls | — | 2006–2025; events 2021–2025 |

Region labels map by exact text, including "Adjar AR", " Tbilisi", "Racha-Lechkhumi and Kvemo svaneti", "Samegrelo-Zemo Svaneti". An unmatched label or header fails the run. `science-culture-series-breaks.csv` (Crime's header `break_id,applies_to,reference_date,reason,source_note`) has one row: `theatre_audience_2021`, `science_culture.theatre_audience.total`, `2021-01-01`, Geostat's Events.xls footnote quoted.

- [ ] **Step 1: Write `test_validation.py`** (stdlib `unittest`, modelled on Housing's):
  - `test_counts`: per-indicator counts match `coverage.csv`; total printed (spec: about 1,720).
  - `test_altered_cell_fails`: patching one value makes `prepare.validate` raise.
  - `test_dash_cells` (Review Focus 1): `researchers.field_not_identified` 2022 is `0`; `researchers.degree_short_cycle` 2019 is `0`; `invention_patents.foreign` 2018 is `0`; no `theatre_events.*` row before 2021.
  - `test_parts_add_up`: women+men = total (researchers, R&D staff, both staff tables); degrees, fields, ages = all researchers; researchers+technicians+support+not specified = R&D staff; permanent+contract and the three age groups = staff; museum types = museums; theatre types = theatres; 11 regions = Georgia for museums, visitors, exhibitions exactly and tours within 0.2; national museum visitors (million) × 1000 = by-region Georgia within 0.1; Events.xls audience = by-region theatre workbook Georgia row. Patching one region by +10 raises.
  - `test_anchor_values`: researchers.total 2024 `14046`, women `7732`; rd_staff.total 2024 `16191`; institutions 2024 `66`; rd_spending 2024 `242.9`; invention_applications.local 2025 `79`, invention_patents.local 2025 `41`, invention_applications.international 2025 `85`; museums.total 2025 `261`; museum_visitors.total 2025 `1998.924`, region_samtskhe_javakheti `164.893`; theatres.total 2025 `53`; theatre_audience.total 2025 `620.322`.
- [ ] **Step 2: Run** `cd "docs/Raw Data/ScienceCulture/geostat-science-culture-annual" && python3 -m unittest test_validation -v`. Expected: FAIL (no `prepare` module).
- [ ] **Step 3: Implement `prepare.py`** (xlrd for `.xls`, stdlib `zipfile`/`xml.etree` for `.xlsx` with the self-closing-cell-safe regex, `decimal`, `hashlib`, `csv`, `json`). It writes the manifest, both CSVs, `coverage.csv` and `validation-report.json` (`status`, `primary_observation_count`, `reconciliation_failed_count: 0`, `imputed_values: 0`, `calculated_values: 0`).
- [ ] **Step 4: Implement `verify_independent.mjs`**: re-reads every workbook with SheetJS (`createRequire` from `apps/web`), recomputes every row and writes `independent-validation.json` with `status: "passed"` and `observations`.
- [ ] **Step 5: Run** `python3 prepare.py && python3 -m unittest test_validation -v && node verify_independent.mjs`. Expected: all PASS.
- [ ] **Step 6: Write `README.md`**: files, URLs, retrieval time, cell map, checks, Geostat's notes (2019 Geostat / from 2020 Ministry; Sakpatenti; seats include rented halls; 2006–2020 audience covers performances only; Abkhazia AR theatres operate elsewhere), the xlrd requirement. Commit `feat(data): archive reviewed Geostat science and culture data`.

### Task 2: Canonical serving file

**Files:**
- Create: `apps/web/lib/data/scienceCulture/types.ts`, `validation.ts`, `prepareScienceCulture.ts`; `apps/web/scripts/prepare-science-culture.ts`; `apps/web/tests/data/scienceCulture/scienceCulture.test.ts`.
- Generated: `data/imports/science-culture-annual.csv`, `data/imports/science-culture-series-breaks.csv`, `data/reports/science-culture-validation.json`.
- Modify: `apps/web/package.json` (`data:prepare-science-culture`, `data:check-science-culture`), `apps/web/scripts/validate-all.ts` (`"data:check-science-culture"` beside `"data:check-education"`).

**Interfaces:**
- Produces (`types.ts`): `SCIENCE_CULTURE_MEASURES` (the 19 in spec §9 order), `SCIENCE_CULTURE_REGIONS = BUSINESS_REGIONS`, `ScienceCultureIndicator` (template-literal type), `SCIENCE_CULTURE_INDICATORS` (Task 1 order), `scienceCultureIndicator(measure, group)`, `SCIENCE_CULTURE_SOURCES` (11 served), `SCIENCE_CULTURE_PUBLIC_SOURCES` (all); `ScienceCultureFact` (Housing's fact shape with `unit: "persons" | "persons_thousand" | "count" | "count_thousand" | "gel_million"`); `ClientScienceCultureFact = Pick<…,"year"|"indicatorId"|"sourceId"> & { value: number; unit: "persons" | "thousand" | "count" | "gel"; decimals: number }`; `ScienceCultureSeriesBreak = BreakRow`; `scienceCultureFactKey`, `ScienceCultureAcceptance`.
- Produces (`validation.ts`): `expectedScienceCultureKeys()`, `scienceCultureDisplayDecimals(id): 0 | 1` (thousands and million ₾ 1, else 0), `validateScienceCultureFacts(facts)` (Housing's identity, coverage, duplicate, source and rounding checks plus Task 1's sums and anchors).
- Produces (`prepareScienceCulture.ts`): `prepareScienceCultureData(root, mode)`, `REVIEWED_AT = "2026-10-20"`; re-reads cells with SheetJS as `prepareHousing.ts` does and copies the break CSV byte for byte.

- [ ] **Step 1: Write the test**: `prepareScienceCultureData(root, "check")` resolves and the row count equals the package total; `validateScienceCultureFacts` rejects an altered `publishedValue`, a duplicate, a missing key, a 2025 researchers row, a 2020 `theatre_events` row, a 2019 `museum_staff` row, regions not adding up, and a `calculated` status.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/scienceCulture/scienceCulture.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** by mirroring `lib/data/housing/*`.
- [ ] **Step 4: Run** `npm run data:prepare-science-culture && npm run data:check-science-culture && npx vitest run tests/data/scienceCulture/scienceCulture.test.ts`. Expected: `{"status":"passed","scope":"science_culture_annual"}` and PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed annual science and culture data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create: `apps/web/lib/data/scienceCulture/importScienceCulture.ts`, `apps/web/prisma/migrations/20261020090000_science_culture/migration.sql`.
- Modify: `prisma/schema.prisma` (`ScienceCultureFact`), `lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `scripts/import-budget-facts.ts`, `data/sources/source-documents.csv`, `docs/deployment.md`, `docs/data-methodology/database-import.md` (`ScienceCultureFact` wherever `HousingFact` appears). Test: extend the Task 2 test.

**Interfaces:**
- Produces `loadScienceCultureFacts()`, `loadScienceCultureBreaks()` (as `loadCrimeBreaks`), `assertScienceCultureParity(csv, mirror)`, `loadServedScienceCultureData(): Promise<{ facts: ScienceCultureFact[]; breaks: ScienceCultureSeriesBreak[] }>`, `loadScienceCultureFactsFromDb()`, `toClientScienceCultureFact(f)`: units `persons→persons`, `persons_thousand→thousand`, `count_thousand→thousand`, `count→count`, `gel_million→gel`; `value = Number(publishedValue)`; `decimals` from `scienceCultureDisplayDecimals`.
- Model: Housing's columns, `@@id([indicatorId, year])`; migration enables RLS and revokes public grants exactly as `20261016220000_education/migration.sql`.

- [ ] **Step 1: Tests**: parity passes on identical arrays and on `"261"` vs `"261.0"`, throws on a changed value or missing row; `toClientScienceCultureFact` gives `1998.924` unit `thousand` decimals 1 for `museum_visitors.total` 2025 and `242.9` unit `gel` for `rd_spending.total` 2024; `loadScienceCultureBreaks()` returns one break dated 2021.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement**, then `npx prisma validate && npx prisma generate`.
- [ ] **Step 4: Run** the test file and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed science and culture data with exact parity`.

### Task 4: Page models

**Files:**
- Create: `apps/web/lib/explorer/scienceCulture.ts`, `apps/web/lib/explorer/scienceCultureMuseums.ts`, `apps/web/tests/explorer/scienceCulture.test.ts`.

**Interfaces:**
- Consumes: `unitList.ts`, `topicSeries.ts`, `areaRoutes`, `buildLatestValueRegionMapModel`, `buildBreakRegister`-style filtering as in `lib/explorer/crime.ts:120-139`.
- Produces (`scienceCulture.ts`): `SCIENCE_CULTURE_HUB_PATH = "/explorer/science-culture"`; `SCIENCE_CULTURE_SECTIONS` ids `research`, `patents`, `museums`, `theatres`, hrefs `/explorer/science-culture/<id>`, label keys `common.scienceCultureResearch|…Patents|…Museums|…Theatres`; `ScienceCultureTopicId = "research" | "patents" | "theatres"`; `ScienceCultureHeading` = `researchers | degree | field | age | rdStaff | institutions | spending | inventionApplications | inventionPatents | utilityApplications | utilityPatents | audience | shows | events | theatres | seats | staff | visitors | tours | exhibitions | museums`; `ScienceCultureSeriesDefinition = { id; reference: boolean; heading }`; `scienceCultureTopicSeries(section)` (rows in spec §4/§5/§7 order; R&D staff rows `total, technicians, support, not_specified`); `scienceCultureDefaultSelection(section)`; `scienceCultureSeriesColor` (reference ink; patents `local|foreign|international` keep one colour under all four headings, keyed `science_culture.patents.<g>`; staff rows keyed `science_culture.staff.<g>` so museums and theatres match); `parseScienceCultureHash`, `serializeScienceCultureHash`, `changeScienceCultureSelection`, `scienceCultureCoverage`, `buildScienceCultureModel(section, facts, state, breaks): ScienceCultureModel` with `{ range; years; series; selected; unit; breaks: { year: number; label: "newCounting" }[] }` (breaks whose `applies_to` meets the selection and whose year is inside `(range.start, range.end]`).
- Produces (`scienceCultureMuseums.ts`): `MUSEUM_AREAS = ["georgia", ...SCIENCE_CULTURE_REGIONS]`, `MuseumArea`, `{ areaSlug: museumAreaSlug, areaHref: museumAreaHref, mapId: museumMapId, areaOfMapId: museumAreaOfMapId, regionHref: museumRegionHref } = areaRoutes<MuseumArea>("/explorer/science-culture/museums")`; `museumAreaSeries(area)` (visitors, tours, exhibitions, museums with `<g>` = `total` or the region; Georgia adds the six `museums.type_*` under `museums` and the eight `museum_staff.*` under `staff`); `museumAreaDefaultSelection(area)` (`museum_visitors.<g>`); `parseMuseumAreaHash`, `changeMuseumAreaSelection`, `museumAreaSelectionHash(selectedIds, area)` (moves `museum_{visitors,tours,exhibitions}` and `museums.{total|region}` to the target area; any row the target lacks drops; an empty result or the default gives `""`); `buildMuseumAreaModel`; `buildMuseumRegionMapModel(facts): RegionMapModel` (visitors, latest year with all 11 regions).

- [ ] **Step 1: Write `tests/explorer/scienceCulture.test.ts`**:
  - Defaults and coverage: research `["science_culture.researchers.total"]` 2019–2024; patents `["science_culture.invention_applications.local"]` 2016–2025; theatres `["science_culture.theatre_audience.total"]` 2006–2025; Guria `["science_culture.museum_visitors.region_guria"]` 2005–2025.
  - List shape: research 26 rows (3+4+7+6+4+1+1), patents 12, theatres 21 (1+3+3+5+1+8), Georgia 18 (1+1+1+7+8), Guria 4; headings in order.
  - Review Focus 2: `#sel=science_culture.researchers.total,science_culture.rd_spending.total` keeps researchers only; selecting `invention_applications.local` and `utility_patents.foreign` keeps both.
  - Review Focus 1: `buildScienceCultureModel("theatres")` with `theatre_events.total` selected has `null` for 2006–2020 and a value for 2021; research with `field_not_identified` has `0` in 2022.
  - Review Focus 4: audience selected over 2006–2025 gives `breaks: [{ year: 2021, label: "newCounting" }]`; seats only gives `[]`; audience over 2021–2025 gives `[]`.
  - Review Focus 3: `museumAreaSelectionHash(["science_culture.museum_staff.total"], "region_guria")` is `""`; `museumAreaSelectionHash(["science_culture.museum_tours.region_guria"], "georgia")` is `#sel=science_culture.museum_tours.total`; `museumAreaSelectionHash(["science_culture.museums.type_art","science_culture.museum_visitors.total"], "region_imereti")` is `""` (visitors alone is Imereti's default).
  - `buildMuseumRegionMapModel`: year 2025, Tbilisi rank 1, 11 regions.
  - Colour: `invention_patents.foreign` and `utility_applications.foreign` share a colour.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/scienceCulture.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files, mirroring `housing.ts` and `housingAreas.ts`.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat: model science and culture pages`.

### Task 5: Excel workbooks and hub cards

**Files:** Create `apps/web/lib/explorer/scienceCultureWorkbook.ts`, `apps/web/lib/explorer/scienceCultureHubCards.ts`; extend `tests/explorer/scienceCulture.test.ts`.

**Interfaces:**
- `buildScienceCultureWorkbookExportModel({ section | area, facts, state, labels, sources, siteOrigin, title }, presentation)`, mirroring `housingWorkbook.ts`. Filenames `science-culture-${section}-${start}-${end}` and `science-culture-museums-${area}-${start}-${end}`. Formats: persons and counts `"#,##0"`, thousands `"#,##0.0"` (stored exact), million ₾ `"#,##0.0"`. Sources only those behind the exported series.
- `buildScienceCultureHubCards(facts, presentation): HubCardModel[]`: four cards; sparklines of `researchers.total`, `invention_applications.local`, `museum_visitors.total`, `theatre_audience.total`; English footers `"2024 · 14,046 · 2019–2024"`, `"2025 · 79 · 2016–2025"`, `"2025 · 1,998.9 · 2005–2025"`, `"2025 · 620.3 · 2006–2025"`.

- [ ] **Step 1: Tests**: a theatres workbook 2006–2025 with Audience and Events has `620.322` in 2025 and blank 2006–2020 event cells; a Guria museums workbook lists only the by-region source; the four footers.
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run.** PASS.
- [ ] **Step 5: Commit** `feat: export science and culture data to Excel and build hub cards`.

### Task 6: Messages and i18n wiring

**Files:** Create `lib/i18n/messages/{ka,en}/scienceCulture.json`. Modify `lib/i18n/messages/{ka,en}/common.json` (`scienceCulture`, `dataScienceCulture`, `scienceCultureResearch|Patents|Museums|Theatres`), `lib/i18n/types.ts`, `lib/i18n/messages.server.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json`.

Keys mirror `housing.json`: `page.<section>.title|summary|metaTitle`, `page.area.*`, `heading.<ScienceCultureHeading>`, `series.<measure>.<group>` labels, unit labels, `latest.<section>`, `latest.museumsIndex`, `latest.area`, `sourceNote.<section>`, `sourceNoteMuseums`, `area.georgia`, `break.newCounting`, map and aria strings.

Georgian labels come from the archived `ka/` workbooks (e.g. მკვლევარები, დოქტორი ან მასთან გათანაბრებული, დამთვალიერებელთა რიცხოვნობა, ექსკურსიები, გამოფენები, მემორიალური მუზეუმი, თოჯინების თეატრი, ოპერისა და ბალეტის თეატრი, სასარგებლო მოდელი, ადგილობრივი, უცხოური, მაყურებელი, ადგილები დარბაზებში); hub მეცნიერება და კულტურა; pages კვლევები, პატენტები, მუზეუმები, თეატრები.

English latest lines (spec): "2024: 14,046 researchers"; "2025: 79 invention applications from Georgia"; "2025: 2.0 million museum visitors"; area "2025: 164.9 thousand visitors · Samtskhe-Javakheti"; "2025: 620.3 thousand theatre-goers". The Georgian ones must fit one line at 375 px (checked in Task 7).

- [ ] **Step 1:** Add the files; run `npm run i18n:check`. Expected: FAIL. **Step 2:** Wire the namespace as Housing did. **Step 3:** `npm run i18n:check && npm run typecheck`. PASS. **Step 4:** Commit `feat: add Georgian and English science and culture copy`.

### Task 7: Pages, components, navigation and SEO

**Files:**
- Create: `components/science-culture/science-culture-explorer.tsx`, `museums-index.tsx`, `museum-area-explorer.tsx`; `lib/pages/science-culture.tsx`, `lib/pages/science-culture-shared.tsx`, `lib/pages/science-culture-museums.tsx`, `lib/pages/hubs/science-culture.tsx`; routes `app/(ka)/explorer/science-culture/{page,research/page,patents/page,museums/page,museums/[id]/page,theatres/page}.tsx` and the `app/(en)/en/explorer/science-culture/…` mirrors; `tests/browser/science-culture.spec.ts`.
- Modify: `lib/navigation/navTree.ts` (after Education), `components/shell/explorer-footer.tsx`, `lib/seo/sitemap.ts`, `lib/seo/datasetVocabulary.ts`, `public/llms.txt`, `tests/seo/routes.test.ts`, `tests/seo/agentFiles.test.ts`, `tests/navigation/navTree.test.ts`, `tests/site/datasetHubs.test.ts`, and the browser counts Education touched (`git show a8ac0083 --stat -- apps/web/tests/browser`).

**Reuse decision (recorded in the commit message):** `HousingExplorer`, `HousingIndex` and `HousingAreaExplorer` are bound to `housing.*` messages and Housing models; these components compose the same shared parts (`ExplorerHeading`, `LatestValueLine`, `ExplorerWorkspace`, `FlatSeriesPanel` with `heading`, `ModeTabs`, `RangeStrip`, `EditorialLineChart` with `breaks`, `ExplorerTable` with `breakYears`, `ExcelDownloadButton`, `RegionIndex`, `RegionPicker`, `EntityNeighbourLinks`) the way Housing and Crime do, with no shared component changed.

**Interfaces:**
- `ScienceCultureExplorer({ section, facts, breaks, labels, sources, lastReviewedAt, siteOrigin })`: latest line `testId="science-culture-latest"`; root `data-testid="science-culture-<section>"`; searchable over 10 rows.
- `MuseumsIndex({ facts, regionMap })`: `RegionIndex` with the Georgia lead row, no `mapControls`; rows link to `museumRegionHref(id)`.
- `MuseumAreaExplorer({ area, facts, labels, areaLabels, sources, … })`: picker and neighbour links carrying `museumAreaSelectionHash`.
- `renderScienceCultureHub`, `scienceCultureHubMetadata`, `renderScienceCulturePage(locale, section)`, `renderMuseumsIndexPage`, `renderMuseumAreaPage(locale, area)`, `generateStaticParams` for 12 areas.

- [ ] **Step 1: Write `tests/browser/science-culture.spec.ts`**: hub shows four cards; Research has one selected row, latest line contains `14,046`, ticking Spending leaves one selected row; Patents ticking `Foreign` under granted keeps two rows; Theatres with Audience shows the "new counting" rule and table mark at 2021, and Events in table mode shows `—` in 2010 (Review Focus 1, 4); Museums index draws 11 map paths, Georgia lead row, Tbilisi first, clicking Guria opens `/explorer/science-culture/museums/guria`; on Georgia ticking Art then Next goes to Tbilisi with no hash, and from Guria with Group tours ticked Next carries Group tours (Review Focus 3); switching to `/en` keeps the hash on Research and Guria (Review Focus 5); Excel fires a `.xlsx`; no horizontal scroll and a one-line latest line at 375 px on the hub, four pages and Guria.
- [ ] **Step 2: Implement** components, pages, routes, nav, footer, SEO; extend `routes.test.ts` with 34 routes (hub, 4 sections, 12 areas, ka and en).
- [ ] **Step 3: Run** `npx vitest run tests/seo tests/navigation tests/site tests/explorer/scienceCulture.test.ts && npm run typecheck && npm run lint`. PASS.
- [ ] **Step 4: Run** `npx playwright test tests/browser/science-culture.spec.ts tests/browser/hubs.spec.ts tests/browser/housing.spec.ts` against a built server (CLAUDE.md, `CI=1`). PASS.
- [ ] **Step 5: Commit** `feat: add bilingual science and culture explorer`.

### Task 8: Methodology page and source archive

**Files:** Create `lib/methodology/content/science-culture.ts`, `lib/methodology/content/en/science-culture.ts`, `data/methodology/source-archives/science-culture.csv`. Modify everything Housing's methodology step modified with `"science-culture"` in place of `"housing"` (`git diff 033e4c05^1 033e4c05 -- apps/web/lib/methodology apps/web/lib/pages/methodology-article.tsx data/localization/en/documents.json data/localization/en/sources.json data/methodology/decision-register.csv apps/web/lib/factQuery/buildSnapshot.ts`) and the matching tests (`tests/methodology/*`, `tests/i18n/methodologyCoverage.test.ts`, `tests/factQuery/buildSnapshot.test.ts`, `tests/browser/methodology.spec.ts`, `tests/browser/bilingual-methodology.spec.ts`), one more methodology row than Education left.

Content covers spec §10 in plain words and says nothing Geostat did not publish.

- [ ] **Step 1:** Update the catalogue, archive and snapshot tests to expect `science-culture`. **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement; run `npm run data:check-methodology-archives` and the methodology tests. PASS, no science-culture source in the snapshot.
- [ ] **Step 4:** Commit `feat: publish science and culture methodology and original sources`.

### Task 9: Preview for Duru (stop point)

- [ ] **Step 1:** Push nothing. Build and serve per CLAUDE.md on port 3100. Screenshot with Chromium (`executablePath` `/opt/pw-browsers/chromium-*/chrome-linux/chrome`) into `/mnt/project-files/science-culture-preview/screens/`: ka and en at 1440 (hub, Research, Patents, Theatres with the break, one table view, Museums index, Georgia and Guria pages, methodology); ka at 390 (hub, Research, Museums index, Guria, Theatres).
- [ ] **Step 2:** Reply with the main screenshots attached and an `ask_decision` card: "Clickable preview" (push the branch without a PR for a Vercel preview), "Screenshots only", "Looks good, go ahead". **Wait.** Apply requested changes and repeat until Duru approves.

### Task 10: Scope and design documents

**Files:** Create `docs/data-methodology/science-culture-annual.md`. Modify `Project_Definition.md` §2 (a new approved Science and culture item after Education's), `DESIGN.md` (a Science and culture surfaces section and §6.7's sidebar order).

- [ ] **Step 1:** Write the documents. **Step 2:** `npm run i18n:check`. **Step 3:** Commit `docs: record the science and culture hub`.

### Task 11: Full gates and delivery (only after Duru's OK in Task 9)

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`; in shared files keep both sides and redo counts for every hub merged meanwhile (Transport, Internet, Environment, Social protection).
- [ ] **Step 2:** `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100` with `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`. All green.
- [ ] **Step 3:** `git push -u origin claude/science-culture-hub-4wkqsn`; open a draft PR with the attribution block, assign DuruMakh and request their review; subscribe to PR activity and drive CI green.
- [ ] **Step 4:** Reply with the PR link. Merging releases to production, so it waits for Duru.
