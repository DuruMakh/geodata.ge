# Demography section: structure and shared foundation — specification

Date: 2026-10-04
Status: Draft for owner review. The structure, the chart set, the plan order and the clickable-map approach were approved in conversation on 2026-10-04 (§2). Every default marked "for review" in §14 is open.
Scope: how the reviewed demography data (`2026-10-01-demography-data-design.md`, methodology `docs/data-methodology/demography.md`) becomes a public section of Fiscal.ge. This document owns what the pages share. Each page has its own specification and its own implementation plan:

| Page | Route | Specification | Plan |
| --- | --- | --- | --- |
| Population | `/explorer/demography/population` | `2026-10-04-demography-population-design.md` | 1 (with this foundation) |
| Age and sex | `/explorer/demography/age-sex` | `2026-10-04-demography-age-sex-design.md` | 2 |
| Migration | `/explorer/demography/migration` | `2026-10-04-demography-migration-design.md` | 3 |
| Births, deaths and fertility | `/explorer/demography/births-deaths` | `2026-10-04-demography-births-deaths-design.md` | 4 |

`Project_Definition.md` section 2, `DESIGN.md` v4.1 and `AGENTS.md` remain authoritative. This section extends them; where a statement here and one of them differ, the authority wins until the plan that ships the change amends it (§13).

## 1. Outcome and scope

Readers can open `დემოგრაფია` in the sidebar and answer, from reviewed Geostat data: how many people live where, how old they are, how many are born and die, and who arrives and leaves. The section is a hub with four pages, in Georgian and under `/en`.

The data stage is finished and merged (PR #144). This work adds no new source and changes no canonical value. It adds the serving path from the reviewed CSVs to the pages, the pages, their charts, Excel downloads and the methodology page.

Out of all four plans:

- The read-only MCP tool, fact-query publications and bulk JSON/CSV downloads. Each needs its own approval and specification; the inflation products precedent (explorer first, MCP later) applies.
- Per-resident budget indicators and the denominator policy. The shipped municipal budget map keeps its one-decimal population file unchanged.
- Municipal density (no official municipal areas) and municipal age pyramids (read and validated, not served).
- Projections, marriages and divorces, causes of death, census detail beyond age, sex and urban/rural settlement, sub-annual releases, anything read from a PDF.
- A new dependency or charting library. Every chart is hand-drawn SVG in the existing editorial layer.

## 2. Decisions

Owner decisions, 2026-10-04:

1. The section is a hub and four pages, as in the table above. Each page has a table behind every chart, one Excel download, a source note and a methodology link.
2. The new visuals are: a population pyramid with a year selector and a compare outline; census 2024 pyramids by region and by urban/rural settlement with a grid of 12 mini-pyramids; fertility by age of mother; and an age-by-year heat map. The heat map was recommended for a later release and chosen for this one; it ships in Plan 2 with the census gap drawn on it.
3. Development is split into four plans in the order above. Each plan ends in a shippable state and never regresses an earlier page.
4. The way into places is a map you click (decided later the same day after an interactive sketch, then narrowed to reuse): the page opens with the maps the site already has, a regions/municipalities switch and a Georgia button, and clicking a place selects it (§3.1). Both levels are in Plan 1, and no new map, list or panel component is built. A separate page for every place stays a possible later plan.

Decisions inherited from the data stage and unchanged: the 2025 census break is shown as Geostat published it and marked; nothing is rescaled, spliced or re-estimated; no growth or rate is computed across it. Density is regions only. Citizenship names five countries and one computed remainder.

## 3. Section structure and navigation

Routes exist in both languages (`/en` mirrors every path through `pageHref`). Georgian page names are drafts for owner review.

| Route | Title (ka draft / en) | Shown as live when |
| --- | --- | --- |
| `/explorer/demography` | დემოგრაფია / Demography | Plan 1 ships |
| `/explorer/demography/population` | მოსახლეობა / Population | Plan 1 |
| `/explorer/demography/age-sex` | ასაკი და სქესი / Age and sex | Plan 2 |
| `/explorer/demography/migration` | მიგრაცია / Migration | Plan 3 |
| `/explorer/demography/births-deaths` | შობადობა და სიკვდილიანობა / Births, deaths and fertility | Plan 4 |

- **One list decides what is live.** `lib/explorer/demographyRoutes.ts` exports the four pages with a `live` flag. The hub, sidebar, sitemap, `public/llms.txt` and the inventory read it; each plan flips one flag. This is the existing rule that a name stays a `მალე` marker until its data, page and methodology exist together. A page that is not live has no route file, no sitemap row and no link.
- **Hub** (`/explorer/demography`): serif H1 `დემოგრაფია`, a plain lead paragraph, and four `BudgetHub` cards (`HubCardModel`, testId `demography-hub`) numbered 01–04. A live card links; the others render as `comingSoon` cards, non-clickable, as the Economy hub does. The Population card carries a 200×34 `Sparkline` of Georgia's population with a `null` inserted at the census gap so the line is two segments, and the footer `{year}: {persons} · {first}–{last}`, both derived from loaded facts. No hub card states a figure that is not read from facts.
- **Sidebar** (`components/shell/data-sidebar.tsx`): `demography` leaves `TEASERS` and becomes a fourth dataset group after Inflation, with the same active-row, nested-link, rail and mobile-sheet behaviour. The group link goes to the hub; nested links appear only for live pages and use the existing nested-row markup. The collapsed rail reads `მონაცემები / დემოგრაფია` through a new `common.dataDemography`. `unemployment` stays a teaser. The existing groups are not refactored.
- **Breadcrumb** `მთავარი / მონაცემები / დემოგრაფია / <page>`; coverage label on the right derived from the page's loaded years.
- **Footer** (`components/shell/explorer-footer.tsx`): every `/explorer/demography` path uses the existing `common.geostatSourceNote`.

### 3.1 Choosing a place on the map

Where the data has places, the page opens with the maps the site already has: the 11-region map of the regional economies and the 64-municipality map of the budget section. A switch chooses the level, a `საქართველო` pill is the starting state and the way back, and clicking or pressing Enter on a place selects it. Population (Plan 1), the census view of Age and sex (Plan 2) and Births, deaths and fertility (Plan 4) work this way; Migration is national and has no places.

- **Reuse, not a new map.** `RegionalEconomyMap` and `MunicipalityMap` each gain a few optional props (§6) and render exactly as before when they are omitted. No map component, geometry module, ranked list, side panel or area picker is built. The places list is the series list the page already has (Population) or a single-choice list of the same component (Births), and it is also the way to choose on a phone.
- **State.** The page's own hash state; choosing on the map and choosing in the list are the same action. A map shows the latest year only: a map for 2024 and one for 2025 are not comparable (the re-base moved Khulo from 28,250 to 16,307 and Batumi from 183,181 to 236,845), so the maps carry no year selector and the chart carries the history.
- **Highlights follow the first selected place**, in the hero and side-KPI layout the explorers already use, so a clicked place gets its numbers without a new panel.
- **No availability list.** A page shows only what it has. Statistics that exist for Georgia only (migration, fertility, life expectancy, age over time) live on their own pages, and a highlight that a level lacks prints `—` with a reason (density for a municipality, for example).

## 4. Serving foundation

```text
canonical reviewed CSVs (data/imports/demography-*.csv)
→ transactional, parity-checked import (npm run data:import)
→ one flat mirror table, DemographyFact
→ typed loaders, csv mode or db mode, identical output
→ build-time static page data
```

- **One flat observation table.** `DemographyFact` holds every demography file in the shape the data stage already uses: `seriesId`, `geographyId`, `year`, `sex`, `ageGroup`, `citizenshipId`, `settlement` (empty string when a file has no such column, so the key stays non-null), `value` as `Decimal(40,20)`, `unit`, `estimateBasis`, `status`, `sourceLocator`, `sourceDocumentId` (foreign key to `SourceDocument`), `lastReviewedAt`, `importRunId`. Primary key: the seven dimensions. One migration in Plan 1 (`<timestamp>_demography`, row-level security enabled and `anon`/`authenticated` revoked, exactly as `20260913000000_regional_economies` does); later plans add rows and no schema change. The regional-economies flat-observation model is the precedent.
- **Files join the served list per plan.** `SERVED_DATA_FILES` in `lib/data/servedData.ts` gains the files the site serves, so the import mirrors exactly them: Plan 1 `demography-population-annual.csv` (923 rows) and `demography-density-annual.csv` (145); Plan 2 `demography-structure-annual.csv` (1,587) and `demography-census-2024-population.csv` (2,628); Plan 3 `demography-migration-annual.csv` (1,778); Plan 4 `demography-vital-annual.csv` (2,595) and `demography-fertility-age-annual.csv` (84). The break register is code (`buildBreakRegister`); `demography-series-breaks.csv` is its committed output. Pages use the code, and nothing mirrors that CSV.
- **Loaders.** `lib/data/demography/importDemography.ts` (new, in the pattern of `importRegionalEconomies.ts`) loads each family from the CSV, validates it against the existing registries, and in db mode loads the mirror and fails the build on any difference (`assertSameServedRows`). Loaders are memoised per process with a reset for tests. Rows keep `value` as the exact decimal string; the numeric projection is separate, as for regional economies.
- **Import.** `scripts/import-budget-facts.ts` validates source IDs, replaces `DemographyFact` before source parents, recreates the rows, reads them back through the db-mode mapper, compares every field and exact decimal before commit, and adds the table to the parity report. A missing row, changed value or source mismatch rolls the whole import back. Existing table counts and digests must not change.
- **Pure imports only.** Pages and explorer models import series IDs, coverage constants and the break register from `lib/data/demography/series.ts`, `breaks.ts` and `types.ts`, never from the XLSX readers, so no Node-only code reaches a client bundle. They reuse `SERIES`, `SOURCE_ID`, `COVERAGE`, `AGE_GROUPS`, `CENSUS_AGE_GROUPS`, `populationEstimateBasis` and `UNAFFECTED_BY_CENSUS` instead of retyping them.
- **Basis is derived, not shipped.** For the population-based series `estimate_basis` is a function of the year (`populationEstimateBasis`). The loader asserts every row agrees; the client receives `{ geographyId, seriesId, year, value }` and derives the basis from the year. Source IDs are hoisted into one small map per page for the workbook, as `2026-09-17-served-data-loading-and-payload-design.md` requires. `sourceLocator`, `lastReviewedAt` per row and `estimateBasis` must not appear in the page payload; the payload guard test gains each new route.
- **Derived values are computed in explorer models, never stored.** Each is exact in whole persons and named in the page specification with its formula: the five-year group `0–4` (`age_0 + age_1_4`), shares, sex ratios, citizenship totals such as foreign citizens, births per 100 deaths. A derived value is disclosed as "computed by Fiscal.ge" in the source note and the methodology.
- **Areas.** `country.georgia`, the 11 `region.*` IDs and the 64 municipality codes of `data/imports/municipalities.csv`. Tbilisi is both a region and municipality `04`, with identical values and locators; the interface treats it as one area with the ID `region.tbilisi`, so selecting it under either grouping draws one line. Georgian labels come from `municipal-regions.json` and `display_name_ka`; English labels from `data/localization/en/labels.json`, which already covers all 75. Codes `05`, `42`, `43`, `46`, `64` never appear.
- **Coverage and defaults are derived from loaded facts**, never hard-coded: first and last year per family, the default end year, the legend ranges. A refresh that adds 2027 changes no code.
- **Ordinary builds fetch nothing.** CSV mode is the default fallback. A CSV build and a disposable-database build must produce identical values and static routes.

## 5. The census break in the interface

One rule, applied everywhere a population-based value is drawn. Source of truth: `UNAFFECTED_BY_CENSUS` and the break register (`census_recalculation_2025`). A series is marked unless it is on that list (event counts, infant mortality, migration counts and the census counts themselves are not).

| Rule | Behaviour |
| --- | --- |
| R1 Charts | A marked series is drawn in two segments, 2024 and 2025 never joined. A dashed vertical rule sits between the two year positions with the short label. The dot lattice continues. |
| R2 Tables | A 2px rule between the 2024 and 2025 columns; the 2025 header carries the short label and the table caption the full note. |
| R3 Range strip | The existing `marker` prop marks 2025 with the short label. |
| R4 Derived figures | No growth, change, rate of change, rank movement or difference is computed from a value before the break and one after it. A figure that would span it is omitted and a `Callout` says why. Inside one side it is allowed and labelled with its basis. |
| R5 Comparisons | Two-year comparisons (pyramid outline, fertility curves) may pair years across the break. They then show the break note, show no computed difference, and a count-based comparison switches to shares. |
| R6 Lineage | The basis is printed in plain language in tooltips, tables and Excel: 1 January 2004–2014 "re-estimated in 2018", 2015–2024 "estimated before the 2024 census", 2025 onward "based on the 2024 census". The step between the first two is a change of lineage, never drawn as a break. |
| R7 Snapshot | The census counts (14 November 2024) are labelled "census count, 14 November 2024" and never placed on a 1 January timeline. |

Copy (Georgian draft, owner review): short label `აღწერით გადათვლა` / "Census re-base". Note: on 1 January 2025 Geostat re-based the population to the 2024 census, adding about `{count}` people; figures before and after are on different bases and are not compared. `{count}` is read from `CENSUS_STEP.residual` and rounded for display, never typed into the message.

## 6. Shared chart and component changes

Reuse first. Every change below is an optional addition to a component that exists; with it omitted, every existing page renders as before and its tests are untouched. New components appear only where nothing fits, and they are listed last.

| Existing component | Optional addition | Plan |
| --- | --- | --- |
| `EditorialLineChart` | `breaks` (R1): segments split at a break exactly where they already split at a data gap; `data-testid="chart-break"`; the tooltip names the basis after a break | 1 |
| `ExplorerTable` | `breakYears`, `breakLabel` (R2) | 1 |
| `RangeStrip` | none; its `marker` prop is the R3 marker | |
| `RegionalEconomyMap`, `MunicipalityMap` | selecting and wording: `onSelect` (region map; the municipal map already has `onOpenMunicipality`), `selectedIds` / `selectedCodes`, per-place `display` strings for the label and tooltip, legend strings | 1 |
| `regionalEconomyMap.ts`, `municipalityMapData.ts` | a value-based model builder beside each existing builder, reusing the projection, outlines and equal-count buckets already there | 1 |
| `format.ts` | persons units: thousands on chart axes, full persons in tables, tooltips and Excel | 1 |
| `MonthGridTable` | a column count that follows its labels and an optional break year, so the age-by-year table reuses it | 2 |
| `StackedColumnChart` | `periodsPerYear` (default 12, so the inflation categories page is unchanged), mirrored segments (magnitudes drawn below zero), direction labels | 3 |
| the two maps | a fixed `ramp` and bin edges for the births-per-100-deaths scale | 4 |

New components, only where nothing fits: the population pyramid, its grid of mini-pyramids, the age-by-year heat map and the small age tables (Plan 2), and a year-button row for the pyramid (Plan 2; the single-year analysis pattern, extracted from `analysis-view.tsx` as a pure move or copied in about 30 lines). Nothing else.

## 7. Visual tokens

Each plan adds the tokens it first uses to `DESIGN.md` §4.2 and `lib/explorer/colors.ts`; Plan 1 adds none. Every value reuses an existing palette hex and clears the 3:1 non-text floor on `paper` (measured with the repository's contrast method), and the test that pins the paper tokens gains them.

| Token | Hex | On paper | Plan |
| --- | --- | --- | --- |
| `sex.male` | `#3D5A98` | 6.05:1 | 2 |
| `sex.female` | `#C26E4C` | 3.35:1 | 2 |
| `ageband.0_14` | `#1F6E56` | 5.50:1 | 2 |
| `ageband.15_64` | `#4E5D74` | 5.99:1 | 2 |
| `ageband.65_plus` | `#7A4E8C` | 5.71:1 | 2 |
| `citizenship.georgia` | `#3D5A98` | 6.05:1 | 3 |
| `citizenship.russian_federation` | `#C26E4C` | 3.35:1 | 3 |
| `citizenship.turkey` | `#1F6E56` | 5.50:1 | 3 |
| `citizenship.azerbaijan` | `#A5822B` | 3.23:1 | 3 |
| `citizenship.ukraine` | `#7A4E8C` | 5.71:1 | 3 |
| `citizenship.all_other_computed` | `#94856D` (`OTHER_COLOR`) | 3.23:1 | 3 |

The births-page tokens (births, deaths, the births-per-100-deaths scale) are in its specification (Plan 4). Georgia as a whole is `ink`. Regions take `EDITORIAL_PALETTE` by their `sortOrder` and municipalities by their sort ID, cycling, so a place keeps its colour on every page. Maps and the heat map reuse the existing ramps. Urban and rural settlement is a filter, not a colour. Colour is never the only carrier of meaning: sex is also left/right and labelled, a group is also a labelled swatch and row.

## 8. Shared page anatomy

Every page is `ExplorerPage` → `PageHeader` → `ExplorerHeading` → one unit/basis line → content → `SourceNote`, inside `I18nProvider`, with metadata from `fiscalMetadata`. Time-series pages use `ExplorerWorkspace` (chart column plus the 292px `SeriesAside` from 1100px of column width); the rest of each page's content follows its own specification. URL-hash state follows `useReplaceHash` and `useAppReady`: unknown values are rejected, duplicates removed, ranges clamped to loaded facts, an absent selection means the default and an explicit empty one stays empty. Nothing animates on load or on interaction; `prefers-reduced-motion` needs no special case because there is no motion. Every SVG is `role="img"` or a named group with a Georgian label, and every number it draws also exists in a table, tooltip or summary.

The source note on every page names Geostat as publisher, the basis of the figures shown, and that shares, sums and groups are computed by Fiscal.ge.

## 9. Language and labels

Georgian first, English complete. A new message scope `demography` (`lib/i18n/messages/{ka,en}/demography.json`, added to `MESSAGE_SCOPES`) holds page copy, sex, age-group, settlement, citizenship-group and series labels as reviewed messages, so `npm run i18n:check` governs parity. New keys also go in `common.json` (navigation, rail label, hub). The Georgian text is drafted by the agent and listed in each plan's review table; the owner reviews it before that plan merges, and the six Georgian source descriptions for density and the census in `data/localization/ka/service-messages.json` are reviewed in Plan 1. New routes are added to `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json`, `tests/i18n/routes.test.ts` and, once live, `public/llms.txt` and `tests/seo/agentFiles.test.ts`. An English page carries no Georgian anywhere, including JSON-LD.

## 10. SEO and structured data

Each live page has metadata (title, description, canonical, reciprocal hreflang), `BreadcrumbList` JSON-LD and sitemap rows in both languages with `lastModified` from the family's latest review date. **No Dataset JSON-LD and no download links in this release.** Dataset markup is keyed by the fact-query `DatasetId` and points at bulk files, both of which belong to the MCP and publications follow-up; the inflation hub, overview, categories and cities pages already emit breadcrumbs only. Nothing may advertise a route or download whose artifact does not exist; a test asserts no demography page emits a `downloadPath`.

## 11. Methodology and sources

`/methodology/demography` and `/en/methodology/demography` ship with Plan 1 through the existing system: `demography` joins `LIVE_METHODOLOGY_IDS`, `METHODOLOGY_CONTENT` (Georgian) and the English content with its reviewed-at date, the hub card, and `sourceInventory.ts` entries for the canonical Geostat originals under `docs/Raw Data/Demography/geostat-demography/2026-10/official/` so they download individually and as an archive. The page content is written from `docs/data-methodology/demography.md` and covers only what is live: Plan 1 covers population and density, the census break, definitions, stored versus displayed values, validation and limitations; each later plan adds its family in the same change that flips its page live. `coverageSource` is `archive`.

## 12. Excel

One download per page, `ExcelDownloadButton` and the shared workbook model, three sheets in the standard order: readable table, data, sources. Cells are numeric; missing stays blank, true zero stays zero. The data sheet carries a plain-language basis column (R6) and flags the break year. Search never narrows an export. Each page specification fixes its rows. Sources link the validated public-archive originals with compressed year ranges; no internal columns (locators, hashes, estimate-basis codes) are exposed.

## 13. Quality gates and documents

During editing run only what the change can break (`npx vitest run <file>`, `npm run typecheck`, one Playwright spec). Each plan runs `npm run check`, `npm run build` and, for UI, the browser suite once at the end, per `CLAUDE.md`. Section-level evidence each plan must show:

- Break tests: a marked series never joins 2024 to 2025 in chart, table or range strip; an unmarked series does; no cross-break figure is produced anywhere (R4).
- CSV mode and disposable-database mode give identical values and routes; the import rolls back on an injected mismatch and leaves other tables unchanged.
- Georgian and English pages at 390, 768, 900, 1100 and 1440px with the sidebar open and collapsed, no horizontal page overflow, keyboard operable, focus visible.
- Payload guard and metadata tests pass; the existing Budget, Municipality, Economy and Inflation pages are unchanged except for the added navigation entry.

Canonical owners updated in the same plan that makes the change true:

| Document | Change | Plan |
| --- | --- | --- |
| `Project_Definition.md` §2 | Replace the "data foundation, not served" statements with the bounded demography section; remove `დემოგრაფია` from the marker and excluded lists once Plan 1 ships; add each page as it ships | each |
| `DESIGN.md` | New "Demography surfaces" section: hub, page anatomy, the break rules, tokens (§7), each new chart form and its interaction | each |
| `docs/data-methodology/demography.md` | Replace the "Delivery boundary" paragraph; link the pages | each |
| `docs/data-methodology/database-import.md` | Add `DemographyFact` and its parity rule | 1 |
| `AGENTS.md` | One line in V1 and Data Non-Negotiables: no growth or rate is computed across the 2025 census break. Needs owner approval | 1 |

## 14. Open decisions (for review, defaults recommended)

1. **No period-change figure on the Population page.** Recommended: none. The break makes any range-crossing figure misleading and pre-census trends are provisional. Alternative: a labelled within-block change.
2. **Dataset markup and downloads wait for the MCP follow-up** (§10). Recommended.
3. **The `AGENTS.md` non-negotiable line** (§13). Recommended; it is your call because that file is the always-loaded rule set.
4. **Georgian copy** is drafted by the agent and reviewed by you per plan (§9). Alternative: a single review at the end, which delays Georgian-visible pages.
5. **One merge or several.** Each merge to `main` deploys. Your earlier preference is one branch and one PR per body of work; Plan 1 can ship alone, or all four can wait for one release. Decide when Plan 1 is ready.
6. **Order of Plans 3 and 4.** Migration before Births follows your message; Births is the largest page and has the most new chart work, so it also benefits from going last.
7. **Choosing a place on the map replaces the selection**; comparing places is done by ticking more in the series list. Recommended (Population §12.1). Alternative: a compare mode on the map.
8. **A page per place** (like the budget Municipalities section) is a possible later plan; it is not part of these four.
9. **Maps show the latest year only**, with no year selector, because maps for 2024 and 2025 are not comparable (Population §12.2). Recommended.
