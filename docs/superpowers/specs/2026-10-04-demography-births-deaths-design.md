# Demography: Births, deaths and fertility page — specification

Date: 2026-10-04 (revised twice the same day: map-first, then reuse-first)
Status: Draft for owner review. Part of `2026-10-04-demography-section-design.md` (read first: serving §4, choosing a place §3.1, census break §5, shared changes §6, anatomy §8). Implementation Plan 4. It needs Plan 1 (the map additions and the series-list pattern) and Plan 3 (the annual and mirrored column chart); Plan 2 is not required.
Scope: `/explorer/demography/births-deaths` and `/en/explorer/demography/births-deaths`. The largest page by content, but almost all of it is existing components: the two maps, the column chart extended in Plan 3, the line chart, the series list and the KPI blocks.

## 1. Outcome and scope

The page answers: how many babies were born and how many people died, in Georgia and in any region or municipality; where deaths now outnumber births; at what ages women have children and how that has shifted; and how long people live.

Delivers three tabs: `შობადობა და სიკვდილიანობა` (births and deaths), `ნაყოფიერება` (fertility), `სიცოცხლის ხანგრძლივობა` (life expectancy).

Excluded: crude birth and crude death rates as charts (the crude birth rate is an indicator and both are in the Georgia Excel data sheet); rates for regions and municipalities (the data holds them for Georgia only, and per-resident figures wait for the denominator policy); fertility by place; causes of death; marriages and divorces; natural-increase and net-migration rates; a year selector on the map; year chips; any change or growth figure across the census break.

## 2. Data

| Series | Geographies | Years | Rows |
| --- | --- | --- | ---: |
| `live_births`, `deaths`, `natural_increase` | Georgia; 11 regions; 64 municipalities | Georgia 2014–2025; others 2015–2025 | 837 each |
| `total_fertility_rate`, `crude_birth_rate`, `crude_death_rate`, `infant_mortality_rate`, `life_expectancy_total`, `_male`, `_female` | Georgia | 2014–2025 | 12 each |
| `age_specific_fertility_rate`: seven mother's-age groups | Georgia | 2014–2025 | 84 |

- Events are counted when registered in the reference year; Georgian citizens registered abroad are included. Vital events start in 2014 because Geostat moves from retro-projected to registered data there; earlier years are not served.
- **Census break.** Event counts and the infant mortality rate are unaffected and carry no marker. The crude rates, the total fertility rate, the age-specific rates and life expectancy use population denominators and are marked (R1–R7); the 2025 values use the census-based population.
- Tbilisi is `region.tbilisi` and municipality `04`; the page treats it as one place (foundation §4).
- **Anchor values the tests assert.** Georgia 2025: 37,867 births, 44,319 deaths, natural increase −6,452, total fertility rate 1.53; 2014: 60,635 births, natural increase +11,548, rate 2.31. Natural increase turned negative in 2020. Tbilisi 2025: 14,334 births and 12,743 deaths; Imereti 2025: 4,275 births and 7,197 deaths. Municipalities with more deaths than births: 53 of 64 in 2025 and 32 of 64 in 2015. Births per 100 deaths by municipality: median 100 in 2015 and 61 in 2025. Fertility per 1,000 women: 2014 under 20 51.5, 20–24 144.7, 25–29 131.3; 2025 under 20 12.4, 20–24 62.4, 25–29 95.9. Life expectancy 2025: total 76.0, men 71.4, women 80.6. Births minus deaths equals natural increase in every row; five times the sum of the seven rates equals the total fertility rate within 0.005 (the data stage's check, re-asserted).

## 3. Page anatomy

`ExplorerPage` → `PageHeader` (coverage from the loaded years) → `ExplorerHeading` `შობადობა და სიკვდილიანობა` → a unit line that follows the tab → three centred `TextTab`s → the tab → `SourceNote`. The tab persists in the hash.

## 4. Tab: births and deaths

The Population page's structure (its §4–§6), with one place at a time.

- **Map block.** The `საქართველო` pill, the regions/municipalities switch and the two existing maps, as on the Population page, coloured by **births per 100 deaths** (`100 × births / deaths`) of the latest year in five fixed bins: below 50, 50–75, 75–100, 100–125, 125 and above (§7). The ratio needs no population figure, so the denominator policy does not block it, and it does not let Tbilisi's size dominate. A place with zero deaths is drawn in the no-data hatch. The tooltip and label always carry the counts, because small municipalities have few events. Above the map, a sentence computed from the facts: "in {latest year}, more people died than were born in {n} of 64 municipalities". Choosing a place on the map sets the chart's place.
- **Place list.** The standard `SeriesAside` with `SeriesSelector`, used as a single-choice list (`allowSelectAll` off; choosing a row replaces the place, the check mark shows the current one): Georgia, then the places of the active level ranked by births per 100 deaths, lowest first, each with swatch and ratio, searchable by Georgian and English name and region. It is also the phone route.
- **Chart.** `StackedColumnChart` as extended in Plan 3: births above the zero line (`vital.births`), deaths mirrored below it (`vital.deaths`), an ink overlay line of natural increase labelled `ბუნებრივი მატება`, the direction words `დაბადებები` / `გარდაცვალებები` at the left edge. Toggle `სვეტები / ცხრილი`; `RangeStrip` with chips (Georgia from 2014, others from 2015). The tooltip lists births and deaths with the natural increase in its header.
- **Table.** `ExplorerTable` with rows births, deaths and natural increase, years as columns, full persons, no change column; a negative natural increase prints with `−`.
- **Highlights**, for the chosen place at the end year of the range (`HeroKpi` and `SideKpiList`): hero is the natural increase, signed and labelled `ბუნებრივი მატება` or, when negative, `ბუნებრივი კლება`, with the sentence "{births} births and {deaths} deaths in {year}"; side KPIs are births and deaths, each with a sparkline over the range, and births per 100 deaths (`—` if deaths are zero). No change figure.

## 5. Tab: fertility

- **Curve.** The existing `EditorialLineChart` with the seven mother's-age groups as its x positions (the chart already takes a label function) and one line per loaded year. The first and last years are coloured (`#3D5A98` and `#B3402A`, both at least 3:1) and every other year is the neutral `#94856D`, the "one series is the point, the rest is context" form, so no year picker is needed. The tooltip header is the age group and lists the years by value with the existing hidden-count line. A legend names the two coloured years and "other years". A footnote says the first and last groups are wider or narrower than the others (under 20 and 45–54), as Geostat publishes them. The first and last years lie on either side of the census break, so the break note (R5) always shows and nothing is subtracted.
- **Table.** Seven age rows by the loaded years, rates to one decimal.
- **Total fertility rate.** Below the curve, the standard workspace for one series: `EditorialLineChart` (ink line, children per woman, two decimals), `breaks=[2025]`, `RangeStrip` with the 2025 marker, `ხაზი / ცხრილი`.
- **Highlights**, for the end year: hero is the total fertility rate; side KPIs are the age group with the highest rate and its value, the under-20 rate, and the crude birth rate, each with a sparkline split at the break. No highlight compares a value before 2025 with one after.

## 6. Tab: life expectancy

- **Workspace.** `ExplorerWorkspace` with a three-row `SeriesAside`: total (`ink`, first, selected by default), men and women (`sex.*`, added in Plan 2). `EditorialLineChart` in years (one decimal), `breaks=[2025]`, `RangeStrip`, `ხაზი / ცხრილი`. Life expectancy is population-based, so it is marked.
- **Infant mortality.** Under it, a second line chart on the same range and mode, one series, deaths of infants per 1,000 live births. It is unaffected by the census and carries no marker.
- **Highlights**, for the end year: hero is life expectancy at birth, with the sentence that women live `{gap}` years longer than men (`women − men`, same year, same basis); side KPIs are men, women and the infant mortality rate, each with a sparkline split at the break where it applies.

## 7. Visual tokens

Added to `DESIGN.md` §4.2 and `colors.ts` by this plan; each clears 3:1 on `paper` except the pale steps of the ratio scale, which are map fills with a labelled legend and never the only carrier of meaning.

- `vital.births` `#1F6E56` (5.50:1) and `vital.deaths` `#8C5A32` (5.20:1).
- Births per 100 deaths, five steps: `#B3402A`, `#D19A80`, `#EBCDBB` below 100; `#A1BDAE`, `#1F6E56` above. The plan's token test fixes the exact values against the boundary-stroke rule and checks the steps are monotone in lightness.

## 8. State

Hash keys: `tab` (`births|fertility|life`), `place`, `level`, `view`, `start`, `end`, `sel` (life-expectancy series). Defaults: births, Georgia, regions, chart, full range, total only. Unknown values are rejected, duplicates removed, ranges clamped. Language switch and history keep the state.

## 9. Numbers

- Counts are exact; natural increase equals births minus deaths (asserted); the ratio, the 53-of-64 count and the gap are computed from loaded counts only. Rates print as published (two decimals for the total fertility rate, one elsewhere).
- Bins for the ratio use half-open intervals (`[50, 75)`). Ranks use unrounded ratios; ties by code.
- Missing stays missing. Nothing is interpolated across 2024 and 2025.

## 10. Excel

One download per tab for the chosen place, range and language. Births and deaths: readable sheet of births, deaths and natural increase by year; data sheet `ტერიტორია`, `წელი`, `დაბადებები`, `გარდაცვალებები`, `ბუნებრივი მატება`, and for Georgia also the crude birth and death rates and their basis; sources the births, deaths and natural-increase originals. Fertility: age groups as rows with the loaded years, plus the total fertility rate in the data sheet. Life expectancy: three series and infant mortality by year. No internal columns.

## 11. Components and files

Reused as they are: the two maps (extended in Plan 1), `StackedColumnChart` (extended in Plan 3), `EditorialLineChart` (with `breaks` from Plan 1), `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector`, `HeroKpi`, `SideKpiList`, `Sparkline`, `TextTab`, `SegmentedTabs`, `MeasurePill`, the workbook model.

Small additions: the two maps accept a fixed colour `ramp` and bin edges for the ratio scale; `colors.ts` and `DESIGN.md` tokens; the Plan 1 files for routes, sidebar nested link, sitemap, `llms.txt`, messages and methodology content; `servedData.ts`, mirror loaders and the import script (files `demography-vital-annual.csv` and `demography-fertility-age-annual.csv`).

New files, thin: `app/(ka)/explorer/demography/births-deaths/page.tsx` and the `(en)` mirror; `lib/pages/demography-births-deaths.tsx`; `lib/explorer/demographyBirths.ts` (model, ratio and bins, hash, highlights), `demographyFertility.ts`, `demographyLife.ts`, matching `…Workbook.ts` files; `components/demography/`: `births-explorer.tsx`, `fertility-explorer.tsx`, `life-explorer.tsx`, `use-births-state.ts`.

## 12. Accessibility and responsive

Every chart is a named `role="img"` with the table as its equivalent and the sr-only value list; map targets carry named labels with the counts. Colour is never the only carrier: bins are labelled in the legend, rows list the values, sex lines have swatches and tooltips. The map block and workspace stack as on the Population page; the chart frames keep their standard minimum width and scroll hint. Verified at 390, 768, 900, 1100 and 1440px in both languages.

## 13. Tests and acceptance

Unit: identities and anchors in §2; ratio, bins and the 53-of-64 and 32-of-64 counts for the years named; zero-deaths guard; the single-choice rule; highlights for Georgia, a region and a municipality; hash round-trip, rejection and fallbacks; workbook models; payload excludes internal fields. Chart: annual mirrored columns with the overlay; the fertility curve with 12 lines and two coloured; the break and unmarked series behaviour; existing chart and map tests untouched. Browser (both languages): default Georgia; choosing a region and a municipality on the map or in the list updates map outline, chart, table and highlights; Tbilisi as one place; legend and bins; the fertility break note; tabs; downloads; widths 390–1440.

Acceptance: anchors agree across map tooltip, list, chart, table, highlights and workbook; nothing computes a difference across the break; existing pages unchanged; `npm run check`, `npm run build` and the browser suite pass once at the end.

## 14. Open decisions (for review, defaults recommended)

1. **Births per 100 deaths for the map.** Recommended: it needs no population denominator and handles size differences. Alternative: the signed count of natural increase, dominated by Tbilisi.
2. **One place at a time on the births tab**, with births above and deaths below. Recommended: it is the clearest picture of "deaths overtook births". Alternative: the Population page's multi-place lines with a births / deaths / natural-increase measure switch, which reuses even more but cannot show births and deaths of one place in one chart.
3. **Life expectancy opens with the total only**, men and women one click away. Alternative: all three, a documented departure like the migration page.
4. **Crude rates are not charted**; the crude birth rate is a highlight and both are in Excel. Alternative: a fourth tab for the crude rates.
5. **List ranked lowest ratio first.** Recommended for a page about where deaths exceed births; the rest of the site ranks largest first.
6. **Fertility curve shows every year with the first and last coloured**, no year picker. Alternative: chips to choose years, a new control.
