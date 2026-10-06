# Demography: Population page — specification

Date: 2026-10-04 (revised twice the same day: map-first, then reuse-first)
Status: Draft for owner review. Part of `2026-10-04-demography-section-design.md`, which this page inherits and which should be read first (serving path §4, choosing a place §3.1, the census break §5, anatomy §8). Implementation Plan 1.
Scope: `/explorer/demography/population` and `/en/explorer/demography/population`, plus what Plan 1 needs around it: the demography hub, the sidebar group, the methodology page and the serving path for the two families it reads.

The design rule for this page is reuse. Almost everything on it is a component the site already has; §9 lists what is reused as is, what gets a small optional addition, and the short list of new files.

## 1. Outcome and scope

The page answers: how many people live in Georgia, in each of its 11 regions and in each of its 64 municipalities, how that has moved since 2004, and where people live densely. The way in is a map you click.

Delivers:

- The hub `/explorer/demography`, with the Population card live and the other three `comingSoon`.
- A map block: the existing region map or the existing municipality map (a switch chooses), a `საქართველო` button, and a population/density switch (§4).
- The standard explorer workspace for population on 1 January: line/table, range, and the series list for comparing places (§5).
- Highlights for the first selected place (§6).
- An Excel download, the methodology page, Georgian and English, sitemap and metadata.

Excluded: age, sex, births, deaths, migration (later pages); any growth, decline, change or rank-movement figure; density as a chart measure; a year selector on the map; a ranked list, panel, breadcrumb or area picker of its own; a new map component; a page per place; a compare mode on the map; per-resident figures; projections; a log or indexed axis.

## 2. Data

| Series | Geographies | Years | Rows | Source |
| --- | --- | --- | ---: | --- |
| `demography.population_total` (persons, 1 January) | Georgia; 11 regions; 64 municipalities | Georgia 2004–2026; others 2015–2026 | 923 | `source.geostat_municipal_population` (table 01) |
| `demography.population_density` (persons per km²) | Georgia; 11 regions | Georgia 2014–2026; regions 2015–2026 | 145 | `source.geostat_demography_density` (table 03) |

- Values and locators are the reviewed CSVs `demography-population-annual.csv` and `demography-density-annual.csv`; this page changes none of them. Persons are whole numbers. Density is carried at the one decimal Geostat displays.
- Coverage is derived from the loaded rows. Before 2015 only Georgia has a value; a region or municipality selected over a range that includes 2004–2014 simply starts later, never at zero and never bridged.
- Basis by year: 2004–2014 re-estimated in 2018, 2015–2024 estimated before the 2024 census, 2025–2026 based on it (`populationEstimateBasis`). The census break (R1–R7) applies to both series. It is not a uniform shift: between 1 January 2024 and 2025 Khulo goes from 28,250 to 16,307 and Batumi from 183,181 to 236,845. A map for 2024 and one for 2025 are therefore not comparable, which is why the map shows the latest year only and the chart carries the history.
- Tbilisi appears as `region.tbilisi` and municipality `04` with identical values; the page treats it as one place `region.tbilisi` (foundation §4).
- Density areas come from `data/mappings/demography/density-rows.csv` (Georgia 57,178.6706 km², Tbilisi 504.2406 km², the 11 regions summing to Georgia). The existing `loadDensityRows` (`lib/data/demography/densityRows.ts`) reads these 12 reviewed rows at build time for the density note. They are areas Fiscal.ge derived from Geostat's own table, and the page says so.
- The shipped municipal budget map keeps `municipal-population-2025.csv`. The two populations agree to Geostat's one-decimal rounding; the page does not import or replace it.

Anchor values the tests assert from the CSVs: Georgia 3,694,608 (2024), 3,930,428 (2025), 3,941,103 (2026); Tbilisi 1,369,356 (2026), which is 34.7% of Georgia; Khulo 28,250 (2024) and 16,307 (2025); Batumi 183,181 (2024) and 236,845 (2025); the 11 regions and, separately, the 64 municipalities sum to Georgia in every year they cover; density 2024: Georgia 64.6, Tbilisi 2,495.9, Racha-Lechkhumi and Kvemo Svaneti 5.7.

## 3. Page anatomy

Top to bottom, inside `ExplorerPage`:

1. `PageHeader`: breadcrumb `მთავარი / მონაცემები / დემოგრაფია / მოსახლეობა`; coverage `{first}–{last} · 1 იანვრის მდგომარეობით`.
2. `ExplorerHeading` `მოსახლეობა`; unit line `ადამიანი, 1 იანვარს` (persons, on 1 January).
3. The map block (§4).
4. The workspace (§5): chart column with `ხაზი / ცხრილი`, chart or table, `RangeStrip`; the series aside.
5. The highlights (§6).
6. `SourceNote` and the methodology link.

## 4. The map block

The reference for layout and behaviour is the interactive sketch shown on 2026-10-04; its mini trend line, breadcrumb, availability list and click-again-to-reset are not carried over.

- **Toolbar.** A `საქართველო` pill (the existing `MeasurePill` style), pressed while the selection is exactly Georgia; `SegmentedTabs` `რეგიონები / მუნიციპალიტეტები` (the level); `SegmentedTabs` `მოსახლეობა / სიმჭიდროვე` (the measure). Density is published for Georgia and regions only, so it is disabled at the municipal level with an explanation, and switching to municipalities while it is active returns to population.
- **The maps are the existing ones.** Regions render with `RegionalEconomyMap`, municipalities with `MunicipalityMap`, each with its current outlines, the hatched occupied areas, keyboard movement, tooltip and legend. They show the latest loaded year, named in the legend, with a note that 2025 onward is based on the 2024 census. Colour is the equal-count bucket each map already applies, so Tbilisi's 2026 density of 2,715.7 persons per km², against 6.4 in Racha-Lechkhumi and Kvemo Svaneti, does not flatten the rest.
- **Selecting.** Clicking or pressing Enter on a region or municipality sets the page's selection to that place alone (Tbilisi at either level is `region.tbilisi`). The `საქართველო` pill sets it back to Georgia. Chosen places are outlined 2.4px in `ink`: every selected place, so ticks made in the series list show on the map too. The city dots keep the budget map's green; their value is in the tooltip.
- **Small optional additions** to the two components, each omitted by every existing caller (which therefore renders byte-for-byte as now):
  - `RegionalEconomyMap`: `onSelect` (a region becomes a focusable `role="button"` activated by click, Enter or Space instead of a link to a region page), `selectedIds`, and per-region `display` strings for the label and the tooltip plus legend strings, in place of its built-in GEL wording.
  - `MunicipalityMap`: `selectedCodes`, per-shape and per-marker `display` strings for the label and the tooltip, and `legendCaption` and `groupAria` strings, in place of its built-in per-resident budget wording. Its `onOpenMunicipality` already does the selecting.
  - In `lib/explorer/regionalEconomyMap.ts` and `municipalityMapData.ts`, a value-based builder beside each existing builder (which stay unchanged), reusing the projection, outline and equal-count bucket code already in the file. The plotted value goes in the existing numeric field, which the component does not print when `display` is present.
- **Notes.** In density mode, one line under the map: density is the 1 January population divided by one fixed March-2014 area with occupied territories excluded, and Tbilisi is 504.24 km² in Geostat's convention, not the 726 km² often cited.

## 5. The workspace

All of it is the standard explorer, as on the regional-economy and sector pages.

- **Mode and range.** `SegmentedTabs` line/table, default line; `RangeStrip` over the full loaded range (2004–2026 from facts), chips `5წ / 10წ / ყველა`, marker at 2025 (R3).
- **Series list** (`SeriesAside` with `SeriesSelector`, modelled on `RegionalEconomySeriesPanel`): places are the series. Grouping tabs precede search and are bound to the same `level` as the map switch: `რეგიონები` lists Georgia then the 11 regions, `მუნიციპალიტეტები` Georgia then the 64 municipalities (Tbilisi once, noted as also a region). Georgia is the applicable total: first, selected by default, selectable and removable. The row under the tabs carries `გასუფთავება` / `ყველას მონიშვნა` on the left (acting on the active tab, never on the search result) and `სერიები {selected} / {all}` on the right, with `supplementalSelected` for the other tab. Selection is unlimited. Rows after Georgia are ranked by end-year population, descending (ties by `sortOrder`, then code), each with swatch, name and persons in full; search matches the Georgian and English name and, for municipalities, the region. This list is also the ranked list of places and the way to choose a place by name, including on a phone. Colours: Georgia `ink`, the rest by the stable assignment in foundation §7; Tbilisi keeps its region colour in both tabs and draws one line.
- **Comparing.** Ticking more places here adds lines and changes the chart only. Choosing a place on the map replaces the selection.
- **Chart.** `EditorialLineChart` with `breaks=[{ year: 2025, label }]`. The y axis covers the selected series only, as in the other explorers, so a chosen municipality fills the chart. Axis unit is thousands (`ათ.` / `k`) with the decimals the gridline step needs; the tooltip prints full persons, lists the top 10 selected places with the existing hidden-count line, and names the basis of the hovered year in its header (for example `2025 · based on the 2024 census`); the census note itself is in the table caption and in the note under the chart, and the map block carries its own. Nothing here is a forecast, so no dashed styling.
- **Table.** `ExplorerTable` with Georgia as `totalRow` and `totalFirst` when selected, full persons, `showChangeColumn={false}` (R4), `rowLabelsLocalized`, `breakYears=[2025]`. Blank cells print `—`.
- **Empty states.** The existing empty-selection and empty-range `Callout`s.

## 6. Highlights

`ძირითადი ინდიკატორები` uses the hero and side-KPI anatomy the explorers already share (`HeroKpi` and `SideKpiList` from `kpi-blocks.tsx`, with `Sparkline`). It describes the **first selected place** in list order (Georgia if selected, otherwise the most populous selected place) for the end year of the active range, and its title names that place. **No figure states a change** (foundation §5 R4, §14.1).

| Chosen place | Hero | Side 1 | Side 2 | Side 3 |
| --- | --- | --- | --- | --- |
| Georgia | Population in full persons, basis sentence (R6) | Largest region: name, persons, share | Densest region: name, persons per km² | Smallest municipality: name, persons |
| A region | Population, share of Georgia | Rank among the 11 regions | Density and its rank | Number of municipalities |
| A municipality | Population, share of its region | Rank among the 64 | Share of Georgia | Its region |

Each side KPI that is a series carries a `Sparkline` of it over the active range with a `null` between 2024 and 2025 so it is two segments. If the end year is before 2015, the region and municipality cells print `—` and say regional data starts in 2015. Ties break by `sortOrder`.

## 7. State

URL-hash state, restored on load and kept across the language switch; loading never writes the URL and every change replaces the history entry (DESIGN.md §6.3), through the shared `useReplaceHash` as the inflation pages do: `sel` (place IDs; Tbilisi as `region.tbilisi`), `level` (`regions`|`municipalities`), `map` (`population`|`density`), `view` (`line`|`table`), `range=all` or `start`/`end`. Defaults: Georgia only, regions, population, line, full range. Unknown values are rejected, duplicates removed, ranges clamped; `map=density` with `level=municipalities` falls back to population; an absent `sel` means Georgia only and an explicit empty one stays empty. Search text is not persisted. Other pages link here with `#sel=`.

## 8. Numbers

- Persons are exact integers; density is read as published; shares print at one decimal with `formatShare`. Ranks use unrounded values.
- Missing data stays missing. A region selected for 2004–2014 has no value there, and the chart does not draw one.
- Formatting follows `lib/explorer/format.ts`: en-US grouping in both languages, `−` for minus, `—` for missing.

## 9. Components and files

Reused as they are: `ExplorerPage`, `ExplorerWorkspace`, `SeriesAside`, `SeriesSelector` and its rows, `RangeStrip`, `SegmentedTabs`, `MeasurePill`, `Callout`, `SourceNote`, `Sparkline`, `HeroKpi`, `SideKpiList`, `BudgetHub`, `PageHeader`, `ExcelDownloadButton`, the workbook model and writer, the hash hooks.

Existing files that get a small additive change (defaults keep today's output): `editorial-line-chart.tsx` (`breaks`), `explorer-table.tsx` (`breakYears`, `breakLabel`), `regional-economy-map.tsx` and `municipality-map.tsx` (§4), `regionalEconomyMap.ts` and `municipalityMapData.ts` (a value-based builder each), `lib/explorer/format.ts` (persons units), `data-sidebar.tsx`, `explorer-footer.tsx`, `lib/servedRows.ts`, `clientData.ts`, `servedData.ts`, `mirrorRows.ts`, `servedDataDb.ts`, `scripts/import-budget-facts.ts`, `lib/seo/sitemap.ts`, `lib/i18n/inventory.server.ts`, `lib/i18n/types.ts`, `common.json`, `public/llms.txt`, methodology `catalog.ts`, `types.ts`, `sourceInventory.ts`, `content/en/revisions.ts`, and the docs in foundation §13.

New files, all thin:

- `app/(ka)/explorer/demography/page.tsx`, `.../population/page.tsx` and the `app/(en)/en/...` mirrors; `lib/pages/demography.tsx` (hub), `lib/pages/demography-population.tsx`.
- `lib/explorer/demographyRoutes.ts`, `demographyHubCards.ts`, `demographyAreas.ts` (place list from the existing municipal registries, Tbilisi normalisation, labels), `demographyPopulation.ts` (model, hash, ranking, highlights), `demographyPopulationWorkbook.ts`.
- `components/demography/`: `population-explorer.tsx` (map block and workspace composed, as `regional-economy-explorer.tsx` composes its page), `population-series-panel.tsx`, `population-highlights.tsx`, `use-population-state.ts`.
- `lib/data/demography/importDemography.ts` (Tbilisi's area comes from the existing `loadDensityRows`, so no new area loader); `lib/i18n/messages/{ka,en}/demography.json`; `lib/methodology/content/demography.ts` and `content/en/demography.ts`; the Prisma model, migration and mirror loader.

## 10. Responsive and accessibility

The map block and the workspace stack below 1100px of column width, with the aside under the chart and a 2px ink top rule; the maps keep their own responsive behaviour. The chart keeps its 720px minimum and scrolls inside its frame with the standard hint. Long municipal names wrap in the aside and never cover values. Map targets, the series list, tabs and the range handles are keyboard and touch usable; focus is the 2px accent ring. The maps are named groups whose targets carry labels, and the series list carries every number the map draws. The chart is `role="img"` with a Georgian label and has the table as its text equivalent. Verified at 390, 768, 900, 1100 and 1440px in both languages, sidebar open and collapsed.

## 11. Tests and acceptance

Unit and component:

- Loader: 923 and 145 rows; every population row's basis equals `populationEstimateBasis(year)`; regions and, separately, municipalities sum to Georgia exactly in every year; the Tbilisi pair is identical; payload excludes `sourceLocator`, `lastReviewedAt` and `estimateBasis`.
- Mirror: CSV and disposable-database loaders give identical rows; an injected mismatch rolls the import back and leaves other tables' counts and digests unchanged.
- Model: defaults; choosing a place replaces the selection, list ticks add, the Georgia pill resets, level changes keep the selection; highlights for Georgia, a region, a municipality and Tbilisi, with end years 2026, 2025, 2024 and 2010; ranking and tie-breaks; hash round-trip and rejection; the density fallback; range clamping; empty states.
- The two maps: each existing test passes untouched; new tests for `onSelect`, `selectedIds` and `selectedCodes`, `display` strings, legend strings, and the value-based builders (bucket, rank, legend ends, Tbilisi as one place).
- Chart, table, range marker as in foundation §13; workbook model (sheets, columns, blank density for municipalities, English without Georgian); metadata, sitemap rows in both languages, hub card, sidebar activation and rail label, i18n parity, methodology page.

Browser (both languages): default Georgia highlights and chart; choosing Imereti, then switching to municipalities and choosing Chiatura, updates map outline, list, chart and highlights; Tbilisi chosen at either level draws one line; the density switch and the municipal level interact as specified; the chart gap and table rule at 2025; list ticks add comparison lines and the map outlines them; the pill resets; download opens with the expected sheets; widths 390–1440 with no horizontal page overflow.

Acceptance: the anchor values in §2 appear in map tooltip, list, highlights, chart, table and workbook; no figure anywhere spans the break; the budget municipality map, the regional-economy map and every other existing page are unchanged; `npm run check`, `npm run build` and the browser suite pass once at the end.

## 12. Open decisions (for review, defaults recommended)

1. **Choosing a place on the map replaces the selection.** Recommended: exploring is the common use, and the list covers comparison. Alternative: a compare mode on the map.
2. **Latest year only on the map.** Recommended, for the reason in §2. Alternative: a year selector (a small new control), at the cost of maps that invite 2024-versus-2025 reading.
3. **City dots stay green**, as on the budget map. Alternative: value colour, one more optional prop on `MunicipalityMap`.
4. **Density only on the map and in Excel, not the chart.** Recommended: a density trend is the population trend rescaled and a 440-fold spread is unreadable on one axis.
5. **No change figure anywhere.** Recommended (foundation §14.1).
6. **A page per place** (as the budget Municipalities section has) is a possible later plan, not part of this one.
