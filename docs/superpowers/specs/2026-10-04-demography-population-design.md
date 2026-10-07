# Demography: Population — specification

Date: 2026-10-04, revised 2026-10-07 (the owner asked for the Budget → Municipalities layout: an index and one page per place; the first build, a one-page workspace with a button row, is replaced)
Status: Structure approved in conversation on 2026-10-07 (§12). Georgian copy is a draft for owner review. Part of `2026-10-04-demography-section-design.md`, which this page inherits and which should be read first (serving path §4, the census break §5, anatomy §8). Implementation Plan 1, in two parts: the first build (data, serving, chart, workbook, methodology) is done; `docs/superpowers/plans/2026-10-07-demography-population-places.md` rebuilds the page.
Scope: the index `/explorer/demography/population`, one page per place under it, their `/en` mirrors, and what they need around them: the demography hub, the sidebar group, the methodology page and the serving path for the two families they read.

The design rule is reuse, and since 2026-10-07 it covers the page pattern as well as the components. The reference is the Budget → Municipalities page set (`/explorer/municipalities`, `/georgia`, `/region/<id>`, `/<slug>`). §9 lists what is reused as it is, what gets a small optional addition, and the short list of new files, with the reason none of the existing components can be extended instead.

## 1. Outcome and scope

The pages answer: how many people live in Georgia, in each of its 11 regions and in each of its 64 municipalities, how that has moved since 2004, and where people live densely. The way in is the index: a map and a ranked list. Every region and municipality opens its own page.

Delivers, in Georgian and English:

- The hub `/explorer/demography`, with the Population card live and the other three `comingSoon`.
- The index (§3.2): the municipality map, four key figures, and a list with `მუნიციპალიტეტები / რეგიონები` tabs and search. No buttons above the map.
- One page per place (§3.3): Georgia, the 11 regions and 63 municipalities (Tbilisi is its region's page). Each has the Budget place-page layout: place picker with previous/next, line/table, range, a tick-list, an Excel download and key indicators.
- The methodology page, sitemap rows, metadata and the Excel workbook.

Excluded: age, sex, births, deaths, migration (later pages); any growth, decline, change or rank-movement figure; density as a chart measure, a map or a toggle; a year selector on the map; a region map on the index; a "% share" toggle; a new map component; a compare mode on the map; per-resident figures; projections; a log or indexed axis; Dataset JSON-LD and downloads.

## 2. Data

| Series | Geographies | Years | Rows | Source |
| --- | --- | --- | ---: | --- |
| `demography.population_total` (persons, 1 January) | Georgia; 11 regions; 64 municipalities | Georgia 2004–2026; others 2015–2026 | 923 | `source.geostat_municipal_population` (table 01) |
| `demography.population_density` (persons per km²) | Georgia; 11 regions | Georgia 2014–2026; regions 2015–2026 | 145 | `source.geostat_demography_density` (table 03) |

- Values and locators are the reviewed CSVs `demography-population-annual.csv` and `demography-density-annual.csv`; this page changes none of them. Persons are whole numbers. Density is carried at the one decimal Geostat displays.
- Coverage is derived from the loaded rows. Before 2015 only Georgia has a value; a region or municipality shown over a range that includes 2004–2014 simply starts later, never at zero and never bridged.
- Basis by year: 2004–2014 re-estimated in 2018, 2015–2024 estimated before the 2024 census, 2025–2026 based on it (`populationEstimateBasis`). The census break (R1–R7) applies to both series. It is not a uniform shift: between 1 January 2024 and 2025 Khulo goes from 28,250 to 16,307 and Batumi from 183,181 to 236,845. A map for 2024 and one for 2025 are therefore not comparable, which is why the map shows the latest year only and the chart carries the history.
- Tbilisi appears as `region.tbilisi` and municipality `04` with identical values; the pages treat it as one place `region.tbilisi` (§3.5).
- Density areas come from `data/mappings/demography/density-rows.csv` (Georgia 57,178.6706 km², Tbilisi 504.2406 km², the 11 regions summing to Georgia). The existing `loadDensityRows` (`lib/data/demography/densityRows.ts`) reads these 12 reviewed rows at build time for the density note. They are areas Fiscal.ge derived from Geostat's own table, and the pages say so.
- The shipped municipal budget map keeps `municipal-population-2025.csv`. The two populations agree to Geostat's one-decimal rounding; these pages do not import or replace it.

Anchor values the tests assert from the CSVs: Georgia 3,694,608 (2024), 3,930,428 (2025), 3,941,103 (2026); Tbilisi 1,369,356 (2026), which is 34.7% of Georgia; Adjara 413,214 (2026, fourth of 11) and its six municipalities 246,267 (Batumi, second of 64), 73,897, 51,286, 16,098 (Khulo), 14,636, 11,030 summing to it; Racha-Lechkhumi and Kvemo Svaneti 29,481 (eleventh) and its four municipalities 10,564, 8,215, 5,646, 5,056 (Lentekhi, the smallest of the 64); Khulo 28,250 (2024) and 16,307 (2025); Batumi 183,181 (2024) and 236,845 (2025); the 11 regions and, separately, the 64 municipalities sum to Georgia in every year they cover; density 2026: Tbilisi 2,715.7, Adjara 142.5; density 2024: Georgia 64.6, Tbilisi 2,495.9, Racha-Lechkhumi and Kvemo Svaneti 5.7.

## 3. Pages

### 3.1 The reference

Each part below follows the Budget page that has it: `lib/pages/municipal-index.tsx` and `components/municipalities/municipalities-index.tsx` for the index; `lib/pages/municipality.tsx`, `municipal-region.tsx`, `municipal-country.tsx` and `components/municipalities/municipal-explorer.tsx`, `entity-picker.tsx` for a place page. The regional-economy and unemployment region pages use the same parts and are not copied again.

### 3.2 The index — `/explorer/demography/population`

Top to bottom, inside `ExplorerPage`:

1. `PageHeader`: breadcrumb `მთავარი / მონაცემები / დემოგრაფია / მოსახლეობა`; coverage `{first}–{last} · 1 იანვრის მდგომარეობით`.
2. `ExplorerHeading` `მოსახლეობა`; unit line `ადამიანი, 1 იანვარს` (persons, on 1 January).
3. The Budget index layout: on the left the municipality map with its legend, the notes under it, and `ძირითადი ინდიკატორები` (four figures); on the right the list. From 1100px of column width they sit side by side; below it the list stacks under the map.
4. `SourceNote`: the Geostat source, the methodology link, and the map-boundary attribution the Budget index already prints.

- **The map** is `MunicipalityMap` exactly as the Budget index uses it: clicking or pressing Enter on a municipality opens its page; hovering or focusing highlights its list row and the reverse; the green city dots and the hatched occupied areas are unchanged. It is not a selector and has no outline. It always draws the 64 municipalities, whichever list tab is open. It shows the latest loaded year, named in the legend (`ადამიანი, 1 იანვარი 2026`), coloured by the equal-count bucket the map already applies. Two notes sit under it: the census note (from 2025 the figures are based on the 2024 census, so the map shows the latest year only) and the density note (density is the 1 January population divided by one fixed March-2014 area with occupied territories excluded; Tbilisi is 504.24 km² in Geostat's convention, not the 726 km² often cited).
- **Key figures** (`MunicipalKpi`): Georgia's population with the basis sentence (R6); the largest region with its share; the densest region (persons per km²); the smallest municipality. They are the Georgia key indicators of §6, so one builder serves both.
- **The list.** Tabs `მუნიციპალიტეტები` (default) and `რეგიონები`, with `ადამიანი` in the position where Budget prints `₾`, a search box and a count. Municipalities: 64 rows ranked by persons in the latest year; each shows rank, name, its region, a bar and the persons. Regions: Georgia first (no rank; its line says `64 მუნიციპალიტეტი`), then the 11 regions ranked, each with the number of municipalities, its persons, and under the persons its density (`2,715.7/კმ²`). Every row is a link to that place's page. Search matches the Georgian and English name and, for municipalities, the region. The tab is restored from `#lvl=region`, as on the Budget index.

### 3.3 A place page

`/explorer/demography/population/georgia`, `/region/{id}` and `/{slug}`, inside `ExplorerPage`:

1. `PageHeader`: `მთავარი / მონაცემები / დემოგრაფია / მოსახლეობა /` then, for a municipality, its region, then the place. Coverage from the place's own years.
2. Heading `მოსახლეობა — [place ▾]`: the place name is the button that opens the picker, as on the Budget pages. A meta line follows (Georgia: `11 რეგიონი · 64 მუნიციპალიტეტი · {first}–{last}`; a region: `{n} მუნიციპალიტეტი · {rank} ადგილი 11-დან · 1 იანვარი {year}`; a municipality: `{region} · {rank} ადგილი 64-დან · 1 იანვარი {year}`, rank by persons in the end year of the period). Regions and municipalities have previous/next links to their neighbours in registry order, wrapping round; Georgia has none. Tbilisi has no municipality page, so the municipality ring skips it.
3. The workspace, in the Budget place-page shell: on the left `ხაზი / ცხრილი`, a caption naming the unit, the chart or table, the `RangeStrip` over the place's years with the 2025 marker (R3), the source note with the methodology link, and the census note; on the right the tick-list, `ჩამოტვირთვა`, and `← მოსახლეობა` back to the index.
4. For a region with municipalities, `რეგიონის მუნიციპალიტეტები`: its municipalities ranked by persons, each a link, as on the Budget region page. Georgia and municipalities have none.
5. `ძირითადი ინდიკატორები` (§6).

**The tick-list** (`SeriesSelector`) holds the place and its parts, and only the place is ticked at first (the applicable total: first, selectable, removable). Georgia's parts are the 11 regions; a region's parts are its municipalities; a municipality has none, and Tbilisi, a region with one municipality that is itself, has none. Parts follow the place, ranked by persons in the end year (ties by registry order); each row has swatch, name and persons in full. Ticking a part adds its line; select all and clear act on the whole list, never on the search result. Selection is unlimited and is in the address.

### 3.4 Routes

| Route | Page | Count |
| --- | --- | ---: |
| `/explorer/demography/population` | index | 1 |
| `/explorer/demography/population/georgia` | Georgia | 1 |
| `/explorer/demography/population/region/{id}`, `{id}` one of `tbilisi`, `adjara`, `imereti`, `kvemo_kartli`, `samegrelo_zemo_svaneti`, `kakheti`, `shida_kartli`, `samtskhe_javakheti`, `mtskheta_mtianeti`, `guria`, `racha_lechkhumi_kvemo_svaneti` | region | 11 |
| `/explorer/demography/population/{slug}`, the 64 `MUNICIPALITY_ROUTES` slugs except `tbilisi` | municipality | 63 |

The set is closed (`dynamicParams = false`): an unknown id or slug is a 404. Each route exists under `/en`. The 75 pages below the index are 150 new URLs in the sitemap, the i18n inventory and `page-revisions.json`.

### 3.5 Tbilisi

Tbilisi is one place, `region.tbilisi`, with one page at `/region/tbilisi`. Its municipality row, the map's Tbilisi polygon and city dot, and the picker's Tbilisi municipality row all open that page. The region list and the municipality list both show it at rank 1.

## 4. The map

The existing municipality map, unchanged in behaviour (§3.2). The only additions are the two the first build made and keeps: per-place `display` text for the accessible name and `wording` for the group label and legend caption, both replacing the budget per-resident wording when given. The value builder `buildMunicipalityValueMapModel` puts population in the existing numeric field. The first build's choosing mode (`selectedCodes`, the 2.4px outline, button semantics) and the whole region-map change (`onSelect`, `selectedIds`, `display`, the value builder) are removed: nothing selects any more.

## 5. The workspace on a place page

- **Mode and range.** The shared municipal hash state (`useMunicipalState`): `line | table`, default line; the range defaults to the full years of the place (Georgia 2004–2026, others 2015–2026), chips `5წ / 10წ / ყველა`, marker at 2025.
- **Chart.** `EditorialLineChart` with `breaks=[{ year: 2025, label }]`. The y axis covers the ticked series only. Axis unit is thousands (`ათ.` / `k`); the tooltip prints full persons and names the basis of the hovered year in its header (for example `2025 · based on the 2024 census`). Nothing here is a forecast, so no dashed styling beyond the break.
- **Table.** `ExplorerTable` with the place as `totalRow` and `totalFirst`, full persons, `showChangeColumn={false}` (R4), `rowLabelsLocalized`, `breakYears=[2025]`. Blank cells print `—`.
- **Empty states.** The existing empty-selection and empty-range `Callout`s.
- **Excel.** `ExcelDownloadButton` with the first build's workbook model, now taking the ticked places and the range: the same three sheets, the re-base marker in the header and the data sheet, density blank for municipalities.

## 6. Key indicators

`ძირითადი ინდიკატორები` uses the hero and side-KPI anatomy the explorers already share (`HeroKpi`, `SideKpiList`, `Sparkline`). It describes **the place of the page** for the end year of the active range, and its title names it. **No figure states a change** (foundation §5 R4, §14.1).

| Page | Hero | Side 1 | Side 2 | Side 3 |
| --- | --- | --- | --- | --- |
| Georgia | Population in full persons, basis sentence (R6) | Largest region: name, persons, share | Densest region: name, persons per km² | Smallest municipality: name, persons |
| A region | Population, share of Georgia | Rank among the 11 regions | Density and its rank | Number of municipalities |
| A municipality | Population, share of its region | Rank among the 64 | Share of Georgia | Its region |

Each side KPI that is a series carries a `Sparkline` of it over the active range with a `null` between 2024 and 2025 so it is two segments. If the end year is before 2015, the region and municipality cells print `—` and say regional data starts in 2015. Ties break by registry order.

## 7. State

URL-hash state follows DESIGN.md §6.3: restored on load, loading never writes the URL, every change replaces the history entry. A place page uses the municipal vocabulary through the existing `useMunicipalState`: `m` (mode), `r` (range) and `sel` (ticked place ids; Tbilisi as `region.tbilisi`); `sh` is never written. Unknown values are rejected, duplicates removed, ranges clamped; an absent `sel` means the place alone and an explicit empty one stays empty. The index uses `lvl=region` for the Regions tab. Search text is not persisted. Other pages may link to a place's page.

## 8. Numbers

- Persons are exact integers; density is read as published; shares print at one decimal with `formatShare`. Ranks use unrounded values.
- Missing data stays missing. A region shown for 2004–2014 has no value there, and the chart does not draw one.
- Formatting follows `lib/explorer/format.ts`: en-US grouping in both languages, `−` for minus, `—` for missing.

## 9. Components and files

**Reused as they are:** `ExplorerPage`, `PageHeader`, `ExplorerHeading`, `BreadcrumbJsonLd`, `MunicipalityMap`, `SeriesSelector` and its rows, `RangeStrip`, `EditorialLineChart`, `ExplorerTable`, `SegmentedTabs`, `TextTab`, `Callout`, `SourceNote`, `HeroKpi`, `SideKpiList`, `Sparkline`, `ExcelDownloadButton`, the workbook model and writer, `useMunicipalState`, `useReplaceHash`, `useAppReady`, `MUNICIPALITY_ROUTES` and its helpers, `municipalRankLabel`, `BudgetHub`, and the labels of the `municipal` message scope (tabs, search, empty, indicators, boundaries, members, picker).

**Small optional additions** (every existing caller omits them and renders byte-for-byte as now):

- `MunicipalitiesIndex`: one optional `overrides` object of plain data (a server page cannot hand functions to a client component) — an address for each row and map shape by id, the number format (`amount` by default, or `persons`), a second line under a row's figure by id, the Georgia row's line, the unit label, the map wording, a note under the map — and `sourceNote` widened from `string` to `ReactNode`.
- `EntityPicker`: one optional `overrides` object of plain data — an address by id, the number format, the country row's detail text.
- `MunicipalityMap`: the `display` and `wording` additions already built stay; `selectedCodes` goes.

**A pure move.** `MunicipalExplorer`'s heading block (title, picker trigger, picker, meta line, previous/next, the ⌘K shortcut) and its two-column workspace shell become `EntityHeading` and `EntityWorkspaceShell` in `components/municipalities/`, and the Budget region page's list of its municipalities becomes `EntityMemberList` beside them. The Budget pages use the new parts and the Population place page uses them too. Before and after, the Budget pages render identical markup, which the plan proves by comparing the rendered pages, with one exception: the list-header row of `MunicipalitiesIndex`, which the Budget and Population indexes share, gained `flex-wrap`, `gap-x-2.5 gap-y-1` and, on its unit label, `ml-auto`, so that a long Georgian unit label wraps under the tabs instead of pushing the page sideways. It changes nothing where the content already fitted; at 320px the Budget index's currency sign, which stuck out of the header, now fits.

**Already built and kept:** chart `breaks`, table `breakYears`/`breakLabel`, `RangeStrip` marker with `labelSide`, `format.ts` persons units, the serving path, the workbook model, the hub card, sidebar group, methodology page, `buildMunicipalityValueMapModel`, `rankByEndValue`.

**Removed, made unnecessary:** the `RegionalEconomyMap` and `regionalEconomyMap.ts` additions (back to the merge-base), `population-explorer.tsx`, `population-series-panel.tsx`, `use-population-state.ts`, and the state, hash and level functions of `demographyPopulation.ts`.

**New files, all thin:**

- `lib/explorer/demographyPlaceRoutes.ts` (addresses, route parameters, neighbours), `demographyPopulationIndex.ts` (index rows, density by place, picker groups, map model) and `demographyPopulationKpis.ts` (the key indicators, moved out of the highlights component so the index and the place pages share one builder).
- `lib/pages/demography-population.tsx` (the index, rewritten, and the loaders both page kinds share) and `lib/pages/demography-population-place.tsx` (place pages, metadata, parameters).
- `components/demography/population-place-explorer.tsx` (the place page body); `components/municipalities/entity-heading.tsx`, `entity-workspace-shell.tsx` and `entity-member-list.tsx` (the moves).
- Six route files: `app/(ka)/explorer/demography/population/georgia/page.tsx`, `region/[id]/page.tsx`, `[slug]/page.tsx` and the `app/(en)/en/...` mirrors.

**Why the place page body is new.** `MunicipalExplorer` is built around spending functions, budget shares, movers and a period comparison; making population fit would turn most of its props optional. The Regional economies and Unemployment pages built their own bodies from the same shared parts for the same reason. The index needs no new component: `MunicipalitiesIndex` takes the plain-data overrides above.

## 10. Responsive and accessibility

The Budget layouts are inherited: the index and the place pages stack below 1100px of column width, with the list or the tick-list under the map or chart and a 2px ink top rule. The chart keeps its 720px minimum and scrolls inside its frame with the standard hint. Long municipal names wrap in the list and never cover values. Map targets, list rows, tabs, the picker and the range handles are keyboard and touch usable; focus is the 2px accent ring. The map is a named group whose targets carry labels, and the list carries every number the map draws. The chart is `role="img"` with a Georgian label and has the table as its text equivalent. Verified at 320, 390, 768, 900, 1100 and 1440px in both languages, sidebar open and collapsed, with no horizontal page overflow.

## 11. Tests and acceptance

Unit and component:

- Loader: 923 and 145 rows; every population row's basis equals `populationEstimateBasis(year)`; regions and, separately, municipalities sum to Georgia exactly in every year; the Tbilisi pair is identical; payload excludes `sourceLocator`, `lastReviewedAt` and `estimateBasis`.
- Mirror: CSV and disposable-database loaders give identical rows; an injected mismatch rolls the import back and leaves other tables' counts and digests unchanged.
- Routes: every place has exactly one address; Tbilisi has the region address only; 75 route parameters; no slug or id collides; neighbours wrap; parts of Georgia (11), of Adjara (6), of Racha-Lechkhumi and Kvemo Svaneti (4), of Tbilisi (0), of a municipality (0).
- Model: ranks and tie-breaks; key indicators for Georgia, a region, a municipality and Tbilisi, with end years 2026, 2025, 2024 and 2010; range clamping; empty states.
- Index: 64 and 12 rows in the two tabs, ranks, regional density lines, four key figures, every row's address, search by Georgian and English name; the Budget index and picker render exactly as before without `overrides`.
- Place page: first render for Georgia, a region, a municipality and Tbilisi; the tick-list contents; ticking adds a line; the census break in chart, table and range strip; no change figure; Excel enabled.
- Pages: metadata for each kind in both languages; breadcrumbs only (no Dataset JSON-LD, no `downloadPath`); sitemap rows, inventory and revisions for the 150 URLs.
- The map: the existing tests pass untouched; the value builder and the `display`/`wording` options keep theirs.

Browser (both languages): the index opens on municipalities; clicking a map municipality opens its page; a list row opens its page; the Regions tab lists Georgia and the 11 regions and a region row opens its page; Tbilisi from the map and from both lists opens one page; on a place page the picker, previous/next and `← მოსახლეობა` work; ticking a part adds a line and `sel` appears in the address; line/table, range and the 2025 marker; the census note; the download opens with the expected sheets; deep links restore the state; loading never writes the address on any of the four route kinds; widths 320–1440 with no horizontal overflow.

Acceptance: the anchor values in §2 appear in the map label, list, key indicators, chart, table and workbook; no figure anywhere spans the break; the Budget municipality pages, the regional-economy pages and every other existing page are unchanged; `npm run check`, `npm run build` and the browser suite pass once at the end.

## 12. Decisions

Owner, 2026-10-07: the Population pages use the Budget → Municipalities layout, with no buttons above the map; clicking a municipality or region opens its own page; the map does not change when the tab changes; the tick-list holds the place and its parts; built with helpers and reviews. Owner, 2026-10-04 and unchanged: no change figure; latest year only on the map; density is regions only.

Defaults taken in this specification, open for review:

1. **Density** is not a map or a toggle. It prints under each region's persons in the list and is a key figure on the Georgia and region pages (§3.2, §6).
2. **Tbilisi is one place** with one page (§3.5).
3. **No "% share" toggle** on the chart. The Budget pages have one; here the parts' shares would sit beside a series that is not comparable across the break.
4. **The census note** is shown on the index (under the map), on place pages (under the chart) and in the table caption.
5. **Georgian copy** is drafted by the agent and reviewed by the owner before merge; the new strings are listed in the plan's review table.
