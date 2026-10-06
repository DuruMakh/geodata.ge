# Demography: Migration page — specification

Date: 2026-10-04
Status: Draft for owner review. Part of `2026-10-04-demography-section-design.md` (read first: serving §4, tokens §7, anatomy §8). Implementation Plan 3; it needs Plan 1 shipped, or the same branch.
Scope: `/explorer/demography/migration` and `/en/explorer/demography/migration`. This page reuses the existing up-and-down column chart almost unchanged; it is the section's cheapest page and the first to need the chart's annual and mirrored extensions.

## 1. Outcome and scope

The page answers: how many people arrived in and left Georgia each year since 2012, how the balance moved, and which citizenships make up the flows.

Delivers: a stacked column chart with arrivals above a zero line and departures below, split by citizenship group, with a net-migration line over it; a table; a range strip; a series panel of the six citizenship groups; a men/women filter; four indicators; Excel; the migration section of the methodology page.

Excluded: origin and destination flows between countries (Geostat publishes flows to and from Georgia only, so a Sankey or chord diagram would imply data that does not exist); the 22 individual citizenship rows and Geostat's own `Other` row (not comparable across years, kept in the file as published); countries beyond the five named; age of migrants; regional migration; a map; net migration per 1,000 residents; any statement of cause.

## 2. Data

| Series | Detail | Years | Rows |
| --- | --- | --- | ---: |
| `demography.immigrants_by_citizenship_group` | 6 groups × men, women, total | 2012–2025 | 252 |
| `demography.emigrants_by_citizenship_group` | 6 groups × men, women, total | 2012–2025 | 252 |
| `demography.net_migration` | total only | 2012–2025 | 14 |

The page serves the whole `demography-migration-annual.csv` (1,778 rows) because the import mirrors the file as it is, but it reads only these series.

- **Groups.** Georgia, Russia, Turkey, Azerbaijan, Ukraine, and `citizenship.all_other_computed`: every other listed citizenship, Stateless, Not stated and Geostat's own `Other`, summed by Fiscal.ge so the group means the same in every year. It is 13–31% of arrivals and 9–23% of departures. The page labels it as computed and never as a country. Armenia, India, the United States, China and Iran are inside it.
- **Terms.** Arrivals are immigrants and departures emigrants. Geostat counts a person recorded at the border who accumulates at least 183 days of residence within the following twelve months and was not a usual resident before (arrivals), and the mirror case (departures). Data are from the Ministry of Internal Affairs border records, annual from 2012. Citizenship is not country of residence or origin.
- **Census.** Migration counts do not break at the 1 January 2025 census re-base; this page carries no break marker (foundation §5, `UNAFFECTED_BY_CENSUS`).
- **Anchor values the tests assert** (all sexes): arrivals / departures / net: 2012 69,063 / 90,584 / −21,521; 2022 179,778 / 125,269 / +54,509; 2023 205,857 / 245,064 / −39,207; 2025 131,501 / 114,374 / +17,127. 2022 arrivals of Russian citizens 62,304 and of Ukrainian citizens 20,716. In every year and sex the six groups add to Geostat's total, arrivals minus departures equal the published net, and each group's men and women add to its total.
- **Derived.** Net migration for any sex and any set of groups is arrivals minus departures of that set, in whole persons. Foreign citizens are the total minus the Georgia group (equal to the sum of the other five, asserted).

## 3. Page anatomy

`ExplorerPage` → `PageHeader` (coverage `2012–2025`) → `ExplorerHeading` `მიგრაცია` → unit line `ადამიანი წელიწადში` (persons per year) → `ExplorerWorkspace` → `ძირითადი ინდიკატორები` → `SourceNote`.

## 4. Workspace

- **Toolbar.** The chart/table switch on the left, labelled `სვეტები / ცხრილი` ("Columns / Table"), the wording the inflation categories page already uses for its stacked columns (`inflation.chartMode.columns`; a demography copy of the key goes in the `demography` scope); on the right a joined `SegmentedTabs` `ყველა / მამაკაცები / ქალები`. The filter applies to the chart, table, indicators and export.
- **Chart.** `StackedColumnChart` with annual periods. Arrivals are segments above zero, one per selected group, in the `citizenship.*` colours; departures are the same groups, in the same colours, mirrored below zero (values are magnitudes, drawn downward and printed as magnitudes). The overlay is the net migration of the selected groups and sex, an ink line with an end dot; with all six groups selected it equals Geostat's published net, and its label then reads `წმინდა მიგრაცია` (otherwise `წმინდა მიგრაცია (არჩეული ჯგუფები)`). Direction is also named in the chart: the words `შემოსვლა` above and `გასვლა` below the zero line at the left edge. The tooltip is the existing bounded readout (top 10 by magnitude, the rest as `+n`), with segment labels `შემოსვლა · რუსეთი` and `გასვლა · რუსეთი`; the overlay value is in the header. The screen-reader caption lists the last value of every series. The axis covers the selected series only, so the 2023 departures of 245,064 set the scale when everything is selected.
- **Series aside.** Six rows for the groups, Georgia first, then Russia, Turkey, Azerbaijan, Ukraine and the computed remainder in that fixed order. Each row: swatch, name, end-year arrivals as the value and end-year departures as the meta. `გასუფთავება` / `ყველას მონიშვნა` and `სერიები {selected} / 6`. Search matches Georgian and English names. **Default: all six selected.** This departs from the rule that only the applicable total starts selected, because the point of the chart is that the parts add to the whole; the inflation categories page (`DESIGN.md` §25.1) and the cities page already record the same documented departure (§11.1). Any group can be removed; with none selected the existing empty-selection `Callout` shows.
- **Table.** `ExplorerTable` for one direction at a time, chosen with `SegmentedTabs` `შემოსვლა / გასვლა / წმინდა`: rows are the selected groups plus a total row (`ჯამი` when all six are selected, `არჩეულთა ჯამი` otherwise), years as columns. The net tab shows one row per selected group (arrivals minus departures) and the net total.
- **Range.** `RangeStrip` over 2012–2025, full range by default, chips `5წ / 10წ / ყველა`. No marker.

## 5. Key indicators

For the end year of the active range and the active sex filter; not affected by the group selection.

| Block | Content |
| --- | --- |
| Hero | Net migration of the end year, signed, with a neutral sentence ("more people arrived than left" or "more left than arrived") and, in the same sentence, the cumulative net migration over the active range: the sum of the yearly nets |
| Side 1 | Arrivals in the end year, with a sparkline over the range |
| Side 2 | Departures in the end year, with a sparkline |
| Side 3 | Foreign citizens as a share of arrivals in the end year (one decimal), with a sparkline of that share |

The cumulative figure is a sum of unaffected counts, not a comparison across the census break. No sentence names a cause or an event. Ties and empty cases follow the other pages.

## 6. State

Hash keys: `view` (`chart|table`), `start`, `end`, `sel` (group IDs; absent means all six, explicit empty stays empty), `sex` (`total|male|female`), `dir` (`arrivals|departures|net`). Unknown values are rejected, duplicates removed, ranges clamped. Language switch and history keep the state.

## 7. Excel

One download for the active range, groups and sex filter. Readable sheet: rows grouped under `შემოსვლა` and `გასვლა` (the workbook model's parent label) with a total row each, then a `წმინდა მიგრაცია` row; years as columns. Data sheet: `წელი`, `მიმართულება`, `მოქალაქეობის ჯგუფი`, `სქესი`, `ადამიანი`. Sources sheet: the migration-by-citizenship and net-migration originals with compressed year ranges, and one line stating how the computed group is built. Search never narrows an export.

## 8. Component changes (backwards compatible)

`StackedColumnChart` gains: `periodsPerYear` (default 12, so the inflation categories page keeps its monthly axis and every existing test passes untouched); `mirrored` on a segment (values are magnitudes, drawn below zero, printed and ranked as magnitudes); and an optional `directionLabels` pair drawn at the left edge. New files: `app/(ka)/explorer/demography/migration/page.tsx` and the `(en)` mirror, `lib/pages/demography-migration.tsx`, `lib/explorer/demographyMigration.ts` (model, hash, indicators), `demographyMigrationWorkbook.ts`, `components/demography/migration-explorer.tsx`, `migration-series-panel.tsx`, `migration-indicators.tsx`, `use-migration-state.ts`. Additive changes to the Plan 1 files for routes, sidebar nested link, sitemap, `llms.txt`, messages, methodology content, `servedData.ts`, mirror loaders and the import script (file `demography-migration-annual.csv`).

## 9. Accessibility and responsive

The chart is a named `role="img"` with the existing figcaption of values and the table as its equivalent; groups carry swatch, name and values, so colour is never the only carrier; direction is above/below the zero line and labelled. The chart keeps the frame's 720px minimum and scrolls inside it with the standard hint on narrow screens. The workspace stacks below 1100px of column width. Verified at 390, 768, 900, 1100 and 1440px in both languages.

## 10. Tests and acceptance

Unit: group and total identities in every year and sex; net equals published net with all groups selected; subset net; foreign-citizen share; cumulative sum; the §2 anchors; hash round-trip and rejection; workbook model; payload excludes internal fields. Chart: annual labels with `periodsPerYear=1`; the monthly default unchanged; a mirrored segment draws below zero and tooltips and the caption print magnitudes; direction labels; the categories page's existing tests untouched. Browser (both languages): default six groups and the overlay; removing Russia changes bars and the net label; sex tabs; table directions; range chips; download; widths 390–1440 with no page overflow.

Acceptance: the anchors agree across chart tooltip, caption, table, indicators and workbook; no demography figure here spans the census break and none claims a cause; existing pages unchanged; `npm run check`, `npm run build` and the browser suite pass once at the end.

## 11. Open decisions (for review, defaults recommended)

1. **All six groups selected by default**, an exception to "only the total starts selected", with Georgia's own citizens as a group. Recommended: the parts-to-whole chart needs it. Alternative: total only, groups added by hand.
2. **The net line follows the selected groups.** Recommended: it always matches the bars on screen. Alternative: always the published total.
3. **Foreign citizens' share of arrivals** as the third side indicator. Recommended; it uses the exact "total minus Georgia" the data stage left to this stage.
4. **Five named countries only**, as decided on 2026-10-03; the remainder stays one computed group.
