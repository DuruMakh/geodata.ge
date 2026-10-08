# Demography: Age and sex page — specification

Date: 2026-10-04
Status: Draft for owner review. Part of `2026-10-04-demography-section-design.md` (read first: serving §4, census break §5, tokens §7, anatomy §8). Implementation Plan 2; it needs Plan 1 shipped, or the same branch.
Note 2026-10-07: this specification assumes Plan 1's click-to-select map block (`RegionalEconomyMap` with `onSelect` and `selectedIds`, the `საქართველო` pill, the places series list). Plan 1 now has an index and one page per place (`2026-10-04-demography-population-design.md` §3) and those map additions were removed. Re-check this page against that pattern, and decide with the owner where the census view sits, before its plan is written.
Scope: `/explorer/demography/age-sex` and `/en/explorer/demography/age-sex`. The page adds the section's first new chart forms: a population pyramid, a grid of mini-pyramids and an age-by-year heat map.

## 1. Outcome and scope

The page answers: how old are Georgia's people and how has that changed since 2004; how do regions differ, and cities from villages; and where do the age groups of the past sit today.

Delivers, as three views on one page: `დროში` (over time), `აღწერა 2024` (census 2024), `ასაკი წლების მიხედვით` (age by year). New components, because nothing existing draws them: `PopulationPyramid`, `PyramidGrid`, `AgeYearHeatMap`, a year-button row and a small table for the pyramid's figures. The region map, the line chart for the age bands, the tabs, the summary line and the age-by-year table (`MonthGridTable`) are the existing components.

Excluded: municipal pyramids and municipal age data (read and validated by the data stage, not served); single years of age; median age and dependency ratios (validation inputs only); projections; any figure computed across the 2025 break; auto-play or any animation through the years; sex split of the age bands over time; comparing two areas on one pyramid.

The sketch shown on 2026-10-04 marked the 65+ rows with lighter bars for the others. The specification replaces that with a labelled band behind the 65+ rows (§4), because a pale tint of the sex colours falls below the 3:1 floor on `paper`.

## 2. Data

| Series | Geographies | Date | Rows |
| --- | --- | --- | ---: |
| `demography.population_by_age_sex`: 19 age groups and an all-ages total × men, women, total | Georgia | 1 January 2004–2026 | 1,380 |
| `demography.population_age_band`: 0–14, 15–64, 65+ × three sexes | Georgia | 1 January 2004–2026 | 207 |
| `demography.census_population_by_age`: 18 age groups × three sexes × three settlement types | Georgia and the 11 regions | 14 November 2024 | 1,944 |
| `demography.census_population_by_settlement`: all ages × three sexes × three settlement types | Georgia, 11 regions, 64 municipalities | 14 November 2024 | 684 |

- **One set of 18 age groups everywhere.** The annual table prints age 0 and ages 1–4 separately; the census prints 0–4. The page computes `0–4 = age_0 + age_1_4` in whole persons, so the pyramids, the grid and the heat map all use `0–4, 5–9, … 80–84, 85+`. The group is disclosed as computed by Fiscal.ge, like the age bands.
- **Basis.** Annual values carry the lineage of foundation §5 R6 and are marked by the census break. The census counts are one date and are labelled "census count, 14 November 2024" (R7); they are never drawn on the annual timeline and the page says they are not annual estimates (the 1 January 2025 value is 847 persons above the census count).
- **Anchor values the tests assert.** Census: Georgia 3,929,581 people (1,881,004 men, 2,048,577 women), urban 2,455,444, rural 1,474,137; aged 0–14 770,823, 15–64 2,466,058, 65+ 692,700 (17.6%); 65+ share of Racha-Lechkhumi and Kvemo Svaneti 31.2%, Tbilisi 14.4%, Adjara 13.1%. Annual: the age groups add to the published total in every year; the 65+ share is 14.1% (2004), 16.2% (2024), 17.6% (2025), 18.1% (2026), and the 2024-to-2025 step is the re-base, not ageing.

## 3. Page anatomy

`ExplorerPage` → `PageHeader` (coverage `2004–2026` and the census date) → `ExplorerHeading` `ასაკი და სქესი` → a unit line that follows the view → three centred `TextTab`s (the GDP overview pattern) → the view → `SourceNote`. The view, year, compare year, measure, area and settlement persist in the hash (§9).

Each view has a chart/table switch in the pattern of the other explorers' line/table switch. Its labels are new (`დიაგრამა / ცხრილი`, draft), because the existing `ხაზი` ("Line") would be wrong for a pyramid or a heat map. The table is the text equivalent of the figure.

## 4. The pyramid component

`PopulationPyramid` draws 18 rows, youngest at the bottom, men to the left and women to the right of a centre gutter that carries the age labels.

- **Real pixels, not a scaled viewBox.** The pyramid measures its container (a small `useElementWidth` hook with `ResizeObserver`) and sets the SVG viewBox to the measured width, so the 11px labels never scale below the legibility floor. It does not use `ChartScrollFrame`: a pyramid is not intentionally wide, and scrolling to see one half would defeat it. It renders at 520px on the server and before measurement, then replaces that width after mount with no transition. Minimum usable width 320px.
- **Geometry.** Row pitch 22px, bar height 18px; gutter 44px with the age label in 11px mono centred in it; each half is `(width − gutter − 2 × 8) / 2`. A header row above the plot carries a `SwatchBar`, `მამაკაცები` and the mono total over the left half, and a `SwatchBar`, `ქალები` and its total over the right (text in ink, never the series colour; the design rules allow bar swatches only). Four vertical hairline-soft rules per side mark equal steps of a nice scale (`niceMax` from `lib/explorer/chartScale.ts`); tick labels are mono 11px under the plot (`4%`, `2%`, `0`, `2%`, `4%`, or `100 ათ.` and so on). There is no dot lattice: its pitch rule belongs to time axes.
- **Bars.** Flat fills, `sex.male` and `sex.female`, no stroke. Values are drawn from the gutter edge outwards.
- **Measure.** `% of residents` (default) draws each half as a percentage of the displayed population's total, so the two halves together are 100%; `persons` draws counts. The scale is shared by everything displayed together (the compare year; all tiles of the grid), so shapes are comparable.
- **65+ band.** A `tint` rectangle behind the five 65+ rows spans the plot, with the mono label `65+ · 18.1%` right-aligned on its top edge. The share is read from the displayed data.
- **Compare outline.** When a second pyramid is supplied, it is drawn as a stepped 1.5px `ink` outline along the outer ends of its bars on each side, no fill, over the filled bars. The legend row shows a filled swatch bar with `{year}` for the bars and an outlined bar with `{year}` for the outline.
- **Rows are the interactive unit.** The plot is a named group of 18 row images; each has an `aria-label` such as `25–29: მამაკაცები 123,456, ქალები 130,000, სულ 253,456 (7.3%)`. One row is the tab stop (roving tabindex); ↑/↓ move, Home/End jump. Hover or focus shows the existing `ChartTooltip` (age group in the header; men, women, total rows with swatches; the share), flipping side past 60% of the width, and a 2px accent ring on the row. With the outline on, the tooltip adds the compare year's values.
- **Compact mode** (the grid tiles): the same drawing without labels, ticks, header or tooltip, in a fixed 160px box, `role="img"` with one summary label.

## 5. View: over time

Controls: a year-button row over 2004–2026 (the single-year analysis pattern, foundation §6; it marks 2025 with a divider and the `აღწერა` tag); a `შედარება` toggle that reveals a second row; and the measure tabs `%` / `ადამიანი`.

- The figure is the pyramid for the selected year, centred, at most 640px wide. Under it a summary row prints the three age-band shares for that year, women per 100 men, and the basis text. Below that, `ასაკობრივი ჯგუფები დროში`: an `EditorialLineChart` of the three band shares (`ageband.*` colours, unit %, full 2004–2026 range) with `breaks=[2025]`. The chart shows the whole history regardless of the selected year.
- **Comparing across the break.** Two years may be chosen on either side of 2025. The page then shows the break note above the figure, forces the measure to `%` (persons would draw the re-base's level shift of about 6% as a bulge; the `ადამიანი` tab is disabled with an explanation), omits the summary row for the compare year, and computes no difference anywhere (R4, R5). Within one side no restriction applies.
- Table mode: for the selected year (and compare year), 18 rows plus a total row with men, women, total and share; the age-band table beside it for all years with the break rule (R2).

## 6. View: census 2024

The place is chosen on the map, as on the Population page (foundation §3.1): the existing region map (`RegionalEconomyMap`, extended in Plan 1) shaded by share aged 65+ of all residents, with the `საქართველო` pill; the census date replaces any year control, and the settlement filter below does not change this map. The 12 tiles of the grid further down are buttons too, so they are the keyboard and phone route; there is no separate list or picker. Under the map sit the settlement tabs `ყველა / ქალაქი / სოფელი` and the measure tabs. The census date is stated in the unit line and in a note (R7).

- The figure is the pyramid for the chosen place and settlement. Percentages are of that subset's own total, so an urban pyramid and a rural pyramid compare as shapes.
- **Grid.** Under it, `PyramidGrid`: 12 compact tiles, Georgia first then the 11 regions ordered by share aged 65+, descending (ties by `sortOrder`). Every tile uses the current settlement filter and one shared scale, rounded up so the widest tile fits. Each tile shows the pyramid, the area name, the people counted and `65+ {x}%`. A tile is a button; activating it sets the area above, and the chosen tile's name wears the accent underline. Columns: four from 1100px of column width, three from 768px, two below. Tiles are not cards: a top hairline and no background.
- Table mode: the selected pyramid's 18-row table, and the regional comparison table (area, people counted, 0–14, 15–64, 65+, urban share) in the grid's order.

## 7. View: age by year

`AgeYearHeatMap`: rows are the 18 age groups with 85+ at the top, columns are 2004–2026, and colour is **each age group's share of that year's population**. Shares, not persons, so the re-base's 6% level shift is not read as a change; the groups themselves were also re-estimated, which the next bullet addresses.

- **Break.** A 14px gap separates the 2024 and 2025 columns, a dashed rule runs through it, and the short label (R1) sits above. Cells on both sides are coloured as published; the gap tells the reader not to compare across. A caption states that the 2025 re-base moved some age groups' shares.
- **Colour.** The five tints the inflation month grid already uses (`GRID_TINTS`, with `binFor` and `legendLabels`), cool for the lowest share to the accent for the highest. The four bin edges are the 20th, 40th, 60th and 80th percentiles of all cells of the loaded matrix, printed to one decimal in the legend. Edges come from the data and are not typed.
- **Real pixels.** Cell width is `(width − labels − gap) / (number of loaded years)` with a 12px minimum, row pitch 18px; age labels at the left in 11px mono, years along the bottom every second year plus the last. It does not scroll on a 390px screen.
- **Interaction.** The cells form a named group with one tab stop; arrow keys move in two dimensions, Home/End go to the ends of a row, PageUp/PageDown move five columns. Hover or focus shows the tooltip: year, age group, persons, share, and "born about {year − upper age}–{year − lower age}" (for 85+, born before {year − 85}). The cohort cue is words, not drawn diagonals: a five-year group does not move along a straight line across annual columns.
- **Reading note.** One neutral sentence: diagonal bands are birth cohorts moving up the chart. No interpretation of any band is printed.
- Table mode: `MonthGridTable` as it is used for inflation, with years newest first as rows and the 18 age groups as columns of shares, tinted with the same bins and legend. It gains a column count that follows its labels and an optional break year that draws a 2px rule and label (foundation §6); there is no new table component.

## 8. Components and files

New: `app/(ka)/explorer/demography/age-sex/page.tsx` and the `(en)` mirror; `lib/pages/demography-age-sex.tsx`; `lib/explorer/demographyAgeSex.ts` (groups, derived values, shares, hash, summaries), `pyramidLayout.ts` (pure geometry: scale, nice ticks, rows, outline path), `ageYearMatrix.ts` (matrix, quantile bins, birth-year text), `demographyAgeSexWorkbook.ts`; `components/demography/`: `age-sex-explorer.tsx`, `population-pyramid.tsx`, `pyramid-grid.tsx`, `age-year-heat-map.tsx`, `age-table.tsx`, `use-element-width.ts`, `use-age-sex-state.ts`, and `components/ui/year-row.tsx` (the year-button row). The maps and their additions come from Plan 1. Additive changes to the Plan 1 files for routes, sidebar nested link, sitemap, `llms.txt`, messages, methodology content for the structure and census families, `servedData.ts`, mirror loaders and the import script (files `demography-structure-annual.csv` and `demography-census-2024-population.csv`).

Reuse: `TextTab`, `SegmentedTabs`, `MeasurePill`, `ChartTooltip`, `EditorialLineChart` (with `breaks`), `RegionalEconomyMap` (Plan 1), `MonthGridTable` and `GRID_TINTS`, a plain summary line under the pyramid, `Callout`, `SourceNote`, `ExplorerPage`, `niceMax`, `ExcelDownloadButton`.

Payload: the structure and census families are about 2,600 rows after projection. If the payload guard shows more than about 150 KB per locale, each key is sent as one packed number array instead of rows; the model unpacks it.

## 9. State

Hash keys: `tab` (`time|census|heat`), `year`, `compare` (absent means off), `measure` (`share|persons`), `place` (Georgia or a region; a municipality ID is rejected here because no municipal age data is served), `settlement` (`total|urban|rural`), `mode` (`chart|table`). Defaults: `time`, the latest year (derived), no compare, `share`, `country.georgia`, `total`, chart. Unknown values are rejected; a compare year equal to the year is dropped; a compare across the break forces `share`; years and the place are clamped to loaded facts. Language switch and history keep the state.

## 10. Numbers

- All persons are exact integers; `0–4` is an exact sum. Each half-percentage is `persons / displayed total × 100`; the age bands from the served rows must equal the sums of their groups (asserted).
- Women per 100 men is `women / men × 100` to one decimal. Shares print with `formatShare`, one decimal.
- A 65+ share, band share or sex ratio is shown for one date at a time. None is subtracted from another.
- Quantile bins, nice scales and the outline path are pure functions with unit tests.

## 11. Excel

One action per view, three sheets. Over time: readable sheet of 18 age rows with men, women, total and share for the selected year (and the compare year's columns when on); data sheet of year, sex, age group, persons, share, basis; sources the annual age-by-sex original. Census: the same shape for the selected area and settlement with the census date in the subtitle; sources the census original. Age by year: age groups as rows, years as columns, shares; data sheet year, age group, persons, share, basis. Georgian and English as elsewhere, no internal columns.

## 12. Accessibility and responsive

Every figure is `role="img"` or a named group and has its table. Focus is the 2px accent ring. Text inside figures is 11px mono at least and does not scale. Sex is carried by position, header labels and tooltips as well as colour. Pyramids fit 320px without scrolling; the grid reflows to two columns; the heat map keeps a 12px minimum cell and fits 390px. Nothing animates. Verified at 390, 768, 900, 1100 and 1440px in both languages.

## 13. Tests and acceptance

Unit: `0–4` sum; groups add to totals and bands; shares; sex ratio; layout geometry (symmetry, shared scale, tick values, outline path, row order); matrix bins and edge text; birth-year text; hash round-trip, rejection and the compare rules; workbook models; census anchors in §2; grid ordering; payload excludes internal fields.

Component and browser (both languages): default view; year selector and arrow keys; compare on within a side shows an outline and legend, across the break shows the note, forces `%` and shows no difference; tab switch; area and settlement change the pyramid and the grid together; tile activation sets the area; heat map gap, label, legend, keyboard movement and tooltip text; table twins; download; widths 390–1440 with no horizontal page overflow and no pyramid or heat map scrolling.

Acceptance: the §2 anchors agree across pyramid, table, summary, tooltip, workbook and heat map; no figure spans the break; existing pages unchanged; `npm run check`, `npm run build` and the browser suite pass once at the end.

## 14. Open decisions (for review, defaults recommended)

1. **Comparing years across the break.** Recommended: allowed with the note, forced `%`, no differences. Alternative: only same-side pairs.
2. **Default measure `%`.** Recommended: it stays comparable across regions and across the break.
3. **Heat map shows shares and uses words for cohorts.** Recommended. Alternative: persons, or drawn cohort staircases.
4. **No two-area overlay in the census view**; the grid covers comparison. Recommended for a first version.
5. **Grid order by share aged 65+**, Georgia first. Alternative: the fixed region order used elsewhere.
6. **No auto-play.** Recommended; the design rules allow no motion beyond fades.
7. **The census view chooses its region on the existing region map** shaded by share aged 65+ (the "ageing map"); the grid stays as the comparison and as the keyboard and phone route. Recommended, because the map exists after Plan 1 and shows the gap between Racha-Lechkhumi (31.2%) and Adjara (13.1%) at a glance. Alternative: the grid only.
