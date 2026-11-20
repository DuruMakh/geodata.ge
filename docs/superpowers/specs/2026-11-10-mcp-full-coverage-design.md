# MCP full data coverage — design

Date: 2026-11-10. Owner decision so far: everything ships in **one release** (decision card, 2026-11-10 20:29 Tbilisi).
Builds on: `2026-08-28-fiscal-ai-query-core-design.md` (the query core), the 2026-10-29 MCP audit (fix 11:
"coverage 13 of 104 pages"), and `2026-11-03-ai-direct-answers-design.md`.

## 0. In plain words (for Duru)

Today an AI tool connected to fiscal.ge/mcp can get numbers for 11 datasets: budget, ministries, municipal
budgets, debt, deficit, GDP, sectors, regions and inflation. For the other ~90 chart pages (population,
schools, health, pensions, jobs, wages, trade, banks, housing, transport, environment, crime and more) it can
only learn that a page exists.

After this change, the AI tool can get **every number those chart pages show**, for every year and every place
the page lists, with the original Geostat / NBG / ministry document behind it. It can also compare two years and
rank places or items. The search ("what do you have about schools?") finds these topics, and the published data
files gain one download per page.

What does not change: the website itself (every page stays byte-for-byte the same), the 11 existing datasets
(their answers stay identical) and the rule that the service only answers from the reviewed files the site is
built from.

## 1. Goal and success criteria

Goal: an outside AI client can answer any question whose answer is a figure shown on a Fiscal.ge chart page,
from `/mcp`, with labels in Georgian and English, units, period, basis and source documents.

Success is observable:

1. Every chart page that `/mcp` does not serve today (the list in §3) is served: `describe_coverage` lists it as
   a dataset, and a query returns the figures the page shows.
2. Test case from 2026-11-09: "Rank Georgia's municipalities by the change in school pupils from 2015/16 to
   2025/26" is answered by one `rank` call, and its top five match the checked answer (Shuakhevi −52.8%,
   Khulo −47.3%, Lentekhi −27.0%, Tsalka −22.7%, Tsageri −19.6%).
3. For every new dataset, an automated parity test proves that each served cell equals the cell the page's own
   model (the one its Excel download and hidden crawl tables are built from) puts in the same row and year.
4. The 11 existing datasets answer exactly as before: `tests/factQuery/reference.test.ts` passes unchanged.
5. The static site output is unchanged: every HTML file in `out/` except the ones this spec names (§7.6) is byte
   identical to a build of `main`.
6. Operating limits hold: `tools/list` stays under its 115 KiB test bound, server instructions stay under 4,096
   characters, the snapshot and the `/mcp` function stay within the budgets in §8.

## 2. Principles

- **Serve what the page shows.** A dataset carries exactly the series, places and years its page lists: no
  series the page hides (`shown = false`, discontinued lines, the old vocational fields, HS4 product years the
  Products page does not show), and nothing the page does not show. The page is the reviewed public scope;
  the MCP mirrors it.
- **One shared format, one new tool.** The new topics share one storage shape and one query tool. The 11
  existing datasets keep their own tools, shapes and rules.
- **No new arithmetic.** Values are the reviewed values. Per-person, share-of-GDP and similar views a page
  calculates in the browser are not served (§4). Changes come only from `compare` and `rank`, which already
  carry the comparability rules.
- **Reuse first** (AGENTS.md). Labels, series lists and place lists come from each topic's existing code and
  messages, never from a second hand-written copy (§6).

## 3. Scope: the new datasets

One dataset per chart page. A page's place sub-pages (Georgia, region and municipality pages, region map pages,
city pages) are **entities of the same dataset**, not datasets of their own. Dataset ids are the page path after
`/explorer/` with `/` replaced by `-` (for example `education-schools`, `health-pensions`), so a reader can tell
the page from the id.

| Group | Datasets (page paths under `/explorer/`) |
|---|---|
| Budget | `expenditure-types`, `tax-breaks-refunds` |
| Economy | `economy/expenditure` (GDP by expenditure) |
| External | `external/current-account`, `external/foreign-debt`, `external/foreign-investment`, `external/money-from-abroad`, `external/reserves` |
| Trade | `trade/overview`, `trade/partners`, `trade/products`, `trade/services`, `trade/composition`, `trade/domestic-exports` |
| Population | `demography/population` (+ Georgia, regions, municipalities), `demography/migration`, `demography/births-deaths`, `demography/age-sex`, `demography/marriages-divorces` |
| Education | `education/schools` (+ places), `education/kindergartens` (+ places), `education/universities`, `education/vocational` |
| Health and social | `health/causes-of-death` (+ regions), `health/doctors-hospitals`, `health/illnesses`, `health/pensions` (+ places), `health/social-package`, `health/social-payments`, `health/subsistence-allowance` (+ places), `health/funded-pension` |
| Jobs | `unemployment/overview`, `/age`, `/gender`, `/hours`, `/industries`, `/informal`, `/regions` (+ regions), `/young-people`; `wages/overview`, `/industries`, `/regions` (+ regions); `business/firms`, `/investment-profit`, `/jobs`, `/regions` (+ regions), `/sales` |
| Living standards | `living-standards/income` (+ regions), `/inequality`, `/poverty`, `/spending` (+ regions); `housing/completed`, `/permits`, `/prices`, `/regions` (+ regions); `internet/devices`, `/homes` (+ regions), `/online`, `/users`; `transport/freight`, `/passengers`, `/regions` (+ regions), `/vehicle-age`, `/vehicles` |
| Money | `money/bank-health`, `/borrowers`, `/interest-rates`, `/loans-deposits`, `/regions` (+ regions), `/supply` |
| Society | `crime/convictions`, `/prisons`, `/recorded`, `/road-accidents`, `/victims`; `environment/air-pollution`, `/air-quality` (+ cities), `/climate`, `/forests` (+ regions), `/greenhouse-gases`, `/waste` (+ regions), `/water`; `science-culture/museums` (+ regions), `/patents`, `/research`, `/theatres`; `energy-food/electricity`, `/energy-supply`, `/energy-use`, `/farming`, `/food-self-sufficiency` |

91 datasets from about 20 topic families (one adapter each, §5.2). The list is generated from the navigation config (`lib/navigation/navTree.ts`),
not typed by hand: a test fails if a chart page in the navigation is neither one of the 11 existing datasets nor a
new dataset, so a page added later cannot silently stay unserved.

`/explorer/analysis` (the 2026 budget analysis) is not a dataset: its figures are the national budget datasets
already served.

## 4. Out of scope

- Browser-side views a page calculates from the served values: per person, per household (where not published),
  share of GDP (where not published), index and growth toggles. A value the reviewed CSV stores as its own
  published series (for example per-capita household income, rates per 1,000) **is** served.
- Monthly or quarterly data beyond what pages show. The one dated latest-amount point on Foreign debt and
  Reserves is served, with its date (§5.2).
- The years a page does not show (for example HS4 products before 2020).
- Any change to the 11 existing datasets, their tools, or their answers.
- Any change to what a website page shows.
- Synonym or alias lists for search (still an open owner item from the audit).

## 5. Design

### 5.1 The shared topic format (snapshot)

The snapshot (`lib/factQuery/generated/snapshot.json`) gains one section, `topics`, built at prebuild time by
`buildSnapshot.ts`:

- `datasets[]`: `datasetId`, `pagePath`, `urlKa`, `urlEn`, `titleKa`, `titleEn`, `groupId` (the navigation group),
  `periodKind` (`year` or `school_year`, which prints 2025 as `2025/26`), `firstYear`, `lastYear`.
- per dataset `series[]`: `seriesId` (the reviewed indicator id, plus a dimension suffix where one CSV row
  identity needs it), `labelKa`, `labelEn`, `headingKa`, `headingEn` (the list heading the page shows it under),
  `parentSeriesId`, `isTotal`, `unit`.
- per dataset `entities[]`: `entityId` (`country.georgia`, existing `region.*` ids, municipality codes, `city.*`),
  `entityType` (`country`, `region`, `municipality`, `city`), `labelKa`, `labelEn`, `parentEntityId`.
- per dataset `facts`: stored **column-wise** (parallel arrays of entity index, series index, year, value, basis
  code, status code, source index, optional `periodEnd`) to keep the file small (§8).
- `breaks[]`: the reviewed series-break rows (`*-series-breaks.csv`, the 2025 census re-base) with the series they
  apply to, their date and bilingual reason.
- `units`: the topic unit vocabulary (for example `persons`, `thousand_persons`, `gel_million`, `usd_million`,
  `percent`, `per_1000_population`) with Georgian and English labels taken from the site's own unit messages.

### 5.2 Topic adapters

One adapter per topic family under `lib/factQuery/topics/` (for example `education.ts`, `health.ts`). An adapter
is build-time only and returns the §5.1 records for its pages. It reads:

- **facts** through the topic's existing loader (`loadServedEducationData`, `loadServedHealthData`, ...), keeping
  that loader's own filters (`shownEducationFacts` and the like);
- **which series, headings and places a page lists** through the same functions the page uses
  (`educationTopicSeries`, the topic's place lists, region and municipality tables);
- **labels** from the site's messages through the same label functions the page uses
  (`educationSeriesLabel(messages, id)`), in Georgian and English;
- **sources** from the topic's reviewed source archive (`data/methodology/source-archives/<topic>.csv`) through
  the same resolver the page's Excel "Sources" sheet uses (`loadSourcedWorkbookSources`).

Where a page module computes its served series, places or labels inline inside a React render function, that
code moves into an exported function in a `.ts` module next to it, called by both the page and the adapter. The
page's output must not change (§7.6 proves it).

Per-topic facts an adapter must carry, not drop:

- basis (`actual`, `planned`, `preliminary`, `projection`, `published`) and value status (`official`,
  `survey_estimate`, `not_applicable`, partial-month and similar);
- missing stays missing; a true zero stays zero;
- school years (`period_label`), and the dated latest amount (`period_end`, for example 30 June 2026 on Foreign debt
  and Reserves);
- figures Fiscal.ge derived (trade turnover and balance, re-exports): served, marked as Fiscal.ge derivations with
  their inputs cited, as the existing products dataset does.

### 5.3 New tool: `query_indicators`

One new tool, title `თემატური მონაცემები / Topic data`. Input:

- `datasetId` (required): a topic dataset id from `describe_coverage`.
- `seriesIds` (required, 1–200).
- `entityIds` (optional; default: the dataset's country entity, or its only entity).
- `years` or `fromYear`/`toYear` (optional; default all years of the dataset).
- `expectedDataVersion` (as on every tool).

Output: the existing observation shape (`Observation`, spec 7.2 of the query core), with `measure: "value"`, the
series' own unit, `periodLabel` when the period is a school year, `periodEnd` when the value is not a year-end
or calendar-year value, and `caveatIds` for breaks, survey estimates and partial periods. The existing size
limits apply unchanged (500 cells, 512 KiB); a refusal points to the dataset's bulk file (§5.7).

The tool description is short (about 600 characters) and states no per-dataset detail: that lives in
`describe_coverage`.

### 5.4 `describe_coverage`

- Lists the 91 new datasets after the existing 11, each with title, page links, years and counts.
- With a `datasetId`, returns that dataset's series (with headings), entities and years, the same way it does
  for the existing datasets.
- Search (whole words, Georgian endings, as today) also looks through topic dataset titles, series labels,
  headings and place names. A search that matches a topic now returns its dataset and ids instead of a
  `websitePages` link.
- `websitePages` keeps working for pages that are still not data pages (methodology, about, hubs).

### 5.5 `compare` and `rank`

- `compare` gains the target `{ dataset: "topic", datasetId, seriesIds, entityIds? }` with `fromYear < toYear`.
  Comparability: `not_comparable` when a reviewed break (or the census re-base) falls between the two years or the
  unit differs; `limited` when either end is partial (for example a partial-month transfer year) or preliminary;
  otherwise `comparable`.
- `rank` accepts a topic `datasetId` with `dimension: "entities"` (one `seriesId`, an `entityType` such as
  `municipality` or `region`) or `dimension: "series"` (one entity, the series under one heading), and the existing
  metrics `value`, `absolute_change`, `percentage_change`. Places or series whose change crosses a break, or that
  miss a value, are excluded and named with the reason, as rankings already do. The existing rule stands: a
  ranking cites the documents of the rows it returns and lists the others by id.

### 5.6 `get_sources`

Topic source ids resolve to the archived originals from the topic's source archive CSV, with official and
archived URLs, as the existing datasets do. A derived figure cites its upstream documents with the derivation
stated.

### 5.7 Published files

Project_Definition V2 says each served dataset has one or more published files. Each new dataset gets one CSV
under `/downloads/data/topics/<datasetId>.csv` (UTF-8 with BOM, the same public columns rule as the existing topic
CSVs: no `source_sheet`, `source_cell`, `source_workbook` or `source_number_format`). `manifest.json` and
`catalogue.json` list them; `sources.json` gains the topic documents. The four existing topic CSVs (population,
wages, unemployment, social protection) stay where they are.

### 5.8 Text surfaces

- Server instructions: one paragraph replaces the coverage sentence ("Fiscal.ge serves reviewed data on ...")
  with the topic groups and a rule for school years and survey estimates. Total stays under 4,096 characters;
  the "websitePages" sentence shrinks to non-data pages.
- `llms.txt` (`lib/seo/llmsText.ts`): drops "Browse-only: no MCP tool and no bulk file" for the served topics and
  names `query_indicators` and the CSV. The parallel thread "Make AI tools answer municipality school questions"
  also edits this file: whichever merges second redoes its edits on top.
- `/connect` (Georgian and English): the coverage list names the new topics. This is the only page whose look
  changes; screenshots go to Duru before any push.
- Schema version 1.7.0 → 1.8.0 (a new tool and new datasets; nothing existing changes shape).
- Docs: `Project_Definition.md` (MCP scope line), the MCP methodology / deployment notes that list served
  datasets, and `docs/data-methodology/` notes for the topic CSV publications.

## 6. Reuse

| Kind | What |
|---|---|
| Reused as is | Observation shape, `buildResponseMeta`, `selectSources`, size limits and `boundedToolResult`, caveat structure, the search engine in `describeCoverage.ts`, each topic's loader and validation, each topic's series and label functions, `loadSourcedWorkbookSources`, source archive CSVs, series-break CSVs, `csvEscape`/BOM CSV writer, navigation config |
| Small additions | `DatasetId` widened with the topic ids; `Unit` widened with the topic unit vocabulary; `compareInput`/`rankInput` gain the topic target; `describeCoverage`, `compare`, `rank`, `getSources`, `publications` gain one topic branch each; `buildSnapshot` calls the adapters; `MCP_SERVED_PAGES` gains the new pages (generated from the topic registry) |
| Moved, not changed | Inline page-data code in `lib/pages/*.tsx` that the adapters need, moved into exported `.ts` functions |
| Genuinely new | `lib/factQuery/topics/` (registry + about 20 adapters + the column-wise store), `queryIndicators.ts`, the `query_indicators` tool entry, the topic CSV publication writer. None of the 11 existing per-dataset tools can take these topics without breaking their own rules, and a tool per topic would break the `tools/list` budget |

## 7. Verification

1. **Parity per dataset** (the main proof): for every new dataset, a test builds the page's own crawl/Excel models
   (`<topic>CrawlStates` + `build<Topic>WorkbookExportModel`, already used for the hidden tables) and checks that
   every row label, year and value equals what `query_indicators` returns for the same series and place.
2. **Coverage test**: every chart page in the navigation is served (existing or topic dataset).
3. **Reference fixture** (`tests/factQuery/reference.test.ts`) passes unchanged. A disagreement is a stop
   condition, reported, not edited.
4. **Rules**: tests for breaks (education kindergarten staff 2020, health staff 2012 and 2020, census re-base),
   partial periods, missing vs zero, school-year labels, the dated latest point, and derived trade figures.
5. **The school-pupils ranking** in §1.2 as an end-to-end MCP test over HTTP.
6. **Site unchanged**: build `main` and this branch with the same `NEXT_PUBLIC_SITE_URL`; every file in `out/`
   is byte identical except `llms.txt`, `/connect` (ka and en), `/downloads/data/*` and the new topic CSVs.
7. **Limits**: `tools/list` < 115 KiB, instructions < 4,096 characters, snapshot and memory budgets (§8),
   cold-start measured locally before and after.
8. A local live check: build, run `/mcp` locally (as in the audit), and ask a handful of real questions in both
   languages (schools by municipality, pensions in a region, exports to Turkey, mortgage rates, CO2 emissions).
9. Definition of done (CLAUDE.md): `npm run check`, `npm run build`, browser suite for `/connect`, methodology
   docs updated, CI green.

## 8. Size and performance budgets

- Snapshot today: 32.1 MB minified, ~185 MB resident, ~0.5 s cold parse. An estimated 150,000 new served cells (200,379 reviewed rows, minus what pages hide).
  Budget: snapshot ≤ 42 MB, cold parse ≤ 0.7 s, resident ≤ 260 MB, measured and recorded in the plan's last task.
  The column-wise store exists to hold this; if a budget is missed, the fix is a tighter store, not dropping data.
- `/mcp` function bundle stays far under Vercel's 250 MB (the snapshot is the only new weight).
- `tools/list` < 115 KiB: the new tool adds ~1.5 KiB (description + schema); existing descriptions trim the
  equivalent if the headroom (727 B) is not enough.
- Published topic CSVs: about 12 MB uncompressed in total, static files, no effect on page weight.

## 9. Risks and coordination

- **Shared files with the parallel thread** "Make AI tools answer municipality school questions": `llms.txt`
  generator, map index pages (this spec does not touch their output), possibly `lib/pages/education*.tsx`
  (moved code only). Release one PR at a time; whichever merges second rebases and redoes shared edits.
- **Moving page code** risks a page change: the §7.6 byte-identical check catches it.
- **Breadth**: about 20 adapters. Each is small and checked by the same parity test, so a mistake in one shows up as a
  failing test for that dataset, not as a wrong answer in production.
- **Georgian text**: new Georgian strings (tool title, instruction lines, `/connect` lines, error messages) go on a
  proofread list for Duru (`/mnt/project-files/mcp-full-coverage/notes-for-duru.md`).

## 10. Owner decisions

Decided: one release (2026-11-10). Proposed defaults in this spec, open for Duru to change on review:

1. Per-person / share-of-GDP views that pages calculate in the browser are **not** served (§4); published per-person
   and rate series are.
2. Each new dataset gets one downloadable CSV (§5.7).
3. Rankings are allowed on every topic, with the existing break and missing-value exclusions (§5.5).
