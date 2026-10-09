# Demography: Births, deaths and fertility — specification

Date: 2026-10-04; rewritten 2026-10-09 against the live Population section (owner choices recorded in §12).
Status: Approved in conversation 2026-10-09, part by part; this file is the written form for the owner's review. Part of `2026-10-04-demography-section-design.md` (serving §4, census break §5). Implementation Plan 4.
Depends on: the Migration page (branch `claude/demographic-data-next-steps-ec11b1`) being merged to `main` first. This work reuses its chart additions and edits the same loader, so its branch starts from `main` after that merge.
Scope: a births-and-deaths section on every Population place page (`/explorer/demography/population/...`, 75 places × 2 languages), and one national page, `/explorer/demography/births-deaths` and `/en/explorer/demography/births-deaths`.

The 4 October version of this file designed one page with three tabs and a click-to-select map. That design assumed the Population page's choosing-mode map, which the owner replaced on 2026-10-07 with an index and one page per place. This version follows that pattern instead: each place's births and deaths live on that place's page, and the national page holds the comparison between places and the figures Geostat publishes for Georgia only.

## 1. Outcome and scope

A reader can see, for Georgia, any region or any municipality, how many babies were born and how many people died each year, and whether deaths now outnumber births there. One national page compares all places on that question and shows fertility (including the mother's age) and life expectancy, which exist for Georgia only.

Delivers:

- **Place pages:** a new section "Births and deaths" on all 75 Population place pages (§3).
- **National page:** titled by the existing hub message `demography.birthsDeathsTitle` (ka `შობადობა და სიკვდილიანობა`, en "Births, deaths and fertility") (§4): a places block reusing the Population index, then Fertility, then Life expectancy, one scrolling page, no tabs.
- The hub card and the sidebar entry `births-deaths` become live.

Excluded: infant mortality and the crude birth and death rates (they stay in the data files, unserved); rates for regions and municipalities (Geostat publishes them for Georgia only, and per-resident figures wait for the denominator policy); fertility by place; causes of death; marriages and divorces; a year selector on the map; a range slider in the place section; MCP answers, JSON publications and bulk downloads (as for Population); any change figure across the census break.

## 2. Data

| Series | Geographies | Years | Rows served |
| --- | --- | --- | ---: |
| `live_births`, `deaths`, `natural_increase` | Georgia; 11 regions; 64 municipalities | Georgia 2014–2025; others 2015–2025 | 837 each |
| `total_fertility_rate` | Georgia | 2014–2025 | 12 |
| `age_specific_fertility_rate`: seven mother's-age groups | Georgia | 2014–2025 | 84 |
| `life_expectancy_total`, `_male`, `_female` | Georgia | 2014–2025 | 12 each |

Total newly served: 2,643 rows, read from the reviewed files `data/imports/demography-vital-annual.csv` and `demography-fertility-age-annual.csv`. Nothing new is fetched from Geostat; no source is added.

- Events are counted when registered in the reference year; Georgian citizens registered abroad are included. Every row has `estimate_basis = registered`. Vital events start in 2014, where Geostat moves from retro-projected to registered data.
- **Census break.** Birth and death counts and natural increase are unaffected and carry no marker. The total fertility rate, the age-specific rates and life expectancy use population denominators: they are marked at 2025 like the Population chart.
- **Tbilisi** is `region.tbilisi` and municipality `04` with identical values; as on Population, it is one place with a region page only.
- **Births per 100 deaths** = `100 × births / deaths` for one place and year, computed from the served counts, shown as a whole number. No served place has zero deaths; the model still returns no value rather than dividing by zero.
- **"Since" figure.** The streak is the unbroken run of years, ending at the latest year, in which deaths exceeded births (equal counts end it). If the latest year is not in a streak, births led that year.

**Anchor values the tests assert.**

- Georgia 2025: 37,867 births, 44,319 deaths, natural increase −6,452, 85 births per 100 deaths; deaths have exceeded births every year since 2020. 2014: 60,635 births, natural increase +11,548.
- Tbilisi 2025: 14,334 births, 12,743 deaths, 112 per 100. Imereti 2025: 4,275 births, 7,197 deaths, 59 per 100, deaths ahead every year since 2015. Racha-Lechkhumi and Kvemo Svaneti 2025: 33 per 100. Adjara 2025: 128 per 100.
- Municipalities (the 64, Tbilisi as `04`): deaths exceeded births in 53 in 2025 and in 32 in 2015; in 30, deaths exceeded births in every year 2015–2025.
- Total fertility rate: 2.31 (2014), 1.53 (2025). Per 1,000 women: 2014 under 20 51.5, 20–24 144.7, 25–29 131.3; 2025 under 20 12.4, 20–24 62.4, 25–29 95.9.
- Life expectancy 2025: total 76.0, men 71.4, women 80.6.
- Identities: births − deaths = natural increase in every row; five times the sum of the seven age rates equals the total fertility rate within 0.005 in every year.

## 3. The place-page section

On every Population place page, below the population part's key figures and above the region pages' member list (`EntityMemberList`). The population part is unchanged.

- **Anchor and heading.** A section with `id="births-deaths"`, a `SectionTitle` `დაბადებები და გარდაცვალებები` (draft; distinct from the national page title), and one line: "Births and deaths registered in {place}, {first}–{last}".
- **Chart.** `StackedColumnChart` as the Migration page uses it: annual columns, births above zero, deaths below (signed in the chart only), natural increase as the ink overlay line, the readout listing births then deaths with the net in its header. Colours: births `vital.births`, deaths `vital.deaths` (§6). All loaded years always (11, or 12 for Georgia): no `RangeStrip`.
- **Table.** The chart/table `SegmentedTabs` switch as on Migration. `ExplorerTable`: rows births, deaths, natural increase; years as columns; whole persons; a negative natural increase prints with `−`.
- **Key figures**, latest year, the Migration page's `HeroKpi` + `SideKpiList` layout: hero natural increase (signed, `NEGATIVE` colour when below zero), side figures births, deaths, births per 100 deaths, and the streak sentence ("Deaths have outnumbered births every year since {year}", or "…every year since 2015" when the streak covers the whole series, or "Births outnumbered deaths in {year}").
- **No census-break marker** (counts are unaffected).
- **Excel.** Its own `ExcelDownloadButton` and workbook, separate from the population workbook (the shared writer has a fixed Summary / Data / Sources layout): Summary rows births, deaths, natural increase by year; Data sheet place, level, year, births, deaths, natural increase, basis, status; Sources the births and deaths originals. Filename `demography-births-deaths-{scope}-{first}-{last}`, with the same scope slugs as the population workbook.
- **Link** to the national page at the end of the section: "Compare all places, and see fertility and life expectancy →".
- **Payload.** A place page receives only its own place's vital rows, not the 2,511 vital rows of every place. The existing payload guard test covers it.

## 4. The national page

`ExplorerPage` → `PageHeader` (coverage 2014–2025 from the loaded years) → `ExplorerHeading` from `demography.birthsDeathsTitle` → three blocks in order. No tabs, no hash state.

### 4.1 Places

The Population index's `MunicipalitiesIndex`, with data-only overrides:

- **Map** (regions and municipalities as on Population) coloured by births per 100 deaths in the latest year, on the existing scale of that map; legend caption names the measure and year. A map note: under 100 means more deaths than births.
- **Key figures** for the latest year: births (37,867), deaths (44,319), births per 100 deaths for Georgia (85), and municipalities where deaths outnumbered births (53 of 64).
- **List** with the Municipalities | Regions tabs and search: value = births per 100 deaths; second line "{births} births · {deaths} deaths". Ranked highest first, the site-wide order. Each row links to its place page at `#births-deaths`; Tbilisi links to its region page.
- No Excel on this block (as on the Population index); each place downloads from its own page.

### 4.2 Fertility

A `SectionTitle` `ნაყოფიერება`, then:

- **Total fertility rate**, children per woman, 2014–2025: `EditorialLineChart`, one ink line, two decimals, `breaks=[2025]` with the census marker.
- **By mother's age**: `EditorialLineChart` with the seven age groups as x positions (its period-label function supplies the group names) and one line per year; the first and last years coloured (`#3D5A98` and `#B3402A`), every other year `OTHER_COLOR` `#94856D`; a legend naming the two coloured years and "other years"; a footnote that the first and last groups (under 20, 45–54) are as Geostat publishes them. The first and last years lie on either side of the break, so the break note always shows.
- A chart/table switch for each; an Excel download covering both (Summary: total fertility rate and the seven age rows by year, with the unit in each row label; Data: series, age group, year, value, unit, basis, status; Sources: the fertility originals).

### 4.3 Life expectancy

A `SectionTitle` `სიცოცხლის ხანგრძლივობა`, then `EditorialLineChart` with three lines, total (ink), men and women, all shown with no selector, years to one decimal, `breaks=[2025]`; a chart/table switch; an Excel download of the three series by year with the life-tables original.

## 5. Behind the pages

- **Serving.** The importer's served set (`SERVED_SERIES` in `importDemography.ts`) and `servedData.ts` gain the two files' served series; `DemographyFact` grows by 2,643 rows (Migration's total plus 2,643; the import log must show equal `csv` and `db` counts). No schema change, so no database migration. Any served-row validation that assumes a basis per family accepts `registered` for these series.
- **Loaders.** Each page filters the served rows to what it shows, following Migration's filter in `loadPopulationBasics`: the population part keeps population and density; the place section takes one place's vital rows; the national page takes the national series and the latest year's counts for every place.
- **Reuse, as is:** `StackedColumnChart` with Migration's readout props, `EditorialLineChart`, `ExplorerTable`, `SegmentedTabs`, `HeroKpi`, `SideKpiList`, `SectionTitle`, `SourceNote`, `ExcelDownloadButton`, the workbook model and writer, `MunicipalitiesIndex` and both maps, `EntityMemberList`, the place routes and slugs.
- **Small additions:** `MunicipalitiesIndex` / `EntityPicker` `valueFormat` gains a plain whole-number option for the ratio; the index model builder (`buildPopulationIndexModel`) takes the value per place as an optional input, defaulting to population so the Population index is unchanged; `colors.ts` gains `vital.births` and `vital.deaths`.
- **Genuinely new, thin:** the place section component, the national page and its route files (`app/(ka)/...` and `(en)` mirror), and models and workbooks for vital events, fertility and life expectancy under `lib/explorer/`. No new chart.
- **Discovery and docs, updated in the same change:** `DEMOGRAPHY_PAGES` `births-deaths` → `live: true` (hub card with a sparkline of births, sidebar), sitemap and `bilingual-complete` counts (+2 routes), `llms.txt`, methodology page and `docs/data-methodology/demography.md` (served series and originals), `DESIGN.md` (the place section, the national page, the two tokens), `Project_Definition.md` section 2.
- **Georgian text** is drafted by the assistant and listed for the owner's review before merge, as for Population and Migration.

## 6. Visual tokens

Added to `DESIGN.md` §4.2 and `colors.ts`; both clear 3:1 on `paper`:

- `vital.births` `#1F6E56` (5.50:1)
- `vital.deaths` `#8C5A32` (5.20:1)

The map keeps the Population map's scale; no new ramp.

## 7. Numbers

Counts are exact. Rates print as published: two decimals for the total fertility rate, one elsewhere. The ratio and the 53-of-64 count are computed from served counts only and ranked on unrounded values, ties broken by code. Missing stays missing; nothing is interpolated or subtracted across 2024 and 2025.

## 8. Accessibility and responsive

Each chart is a named `role="img"` whose table is its text equivalent. Births and deaths are told apart by direction and label as well as colour; the coloured years of the fertility curve are named in the legend. Map targets keep their named labels. Phone widths: no sideways scroll at 390px, as Population and Migration are checked.

## 9. Tests and acceptance

- **Unit:** the anchors and identities in §2; ratio and streak for Georgia, a region (Imereti), a municipality, and a place where births lead (Tbilisi, Adjara); the 53/32/30 counts; zero-deaths guard; the place section's payload holds only one place; workbook models; the index builder's default leaves the Population index output identical.
- **Browser, both languages:** the section on Georgia's, a region's and a municipality's page; chart/table switch; a national list row opens the place page at `#births-deaths`; the national page's three blocks and the fertility break note; downloads; 390px without sideways scroll.
- **Pinned counts** that move: sitemap, `bilingual-complete`, sidebar coming-soon badges, `llms.txt` target list, methodology lists, payload-guard routes.
- **Acceptance:** anchors agree across the place section, the national list, key figures and workbooks; existing pages unchanged apart from the new section; `npm run check`, `npm run build` and the full browser suite on a production build pass once at the end; one PR.

## 10. Release

One branch and one PR for the place sections and the national page together. The first production deploy after merge is the first database import of these rows; verify the live manifest's `releaseCommit` and the routes in `docs/deployment.md` "Demography release checks", extended with the national page and one place page's section.

## 11. Open for later

Infant mortality and crude rates on the national page; fertility or life expectancy by region if Geostat publishes them; a reversed "lowest first" list order (needs a new option on a shared list).

## 12. Owner decisions, 2026-10-09

1. Births and deaths go on the existing place pages, with a separate national page for national-only figures (option B, then A).
2. On a place page it is a separate section below the population part, not a switch on the population chart.
3. The national page scrolls top to bottom with no tabs: places, fertility, life expectancy.
4. The place section has its own Excel download (the shared writer's three-sheet layout is unchanged).
5. The places list ranks highest first, as the rest of the site.
6. Life expectancy shows total, men and women together, with no selector.
