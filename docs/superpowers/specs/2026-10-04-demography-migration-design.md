# Demography: Migration page — specification

Date: 2026-10-04, revised 2026-10-09 against the live Population section (PR #159, release `a7b24bd8`).
Status: Owner-approved design (2026-10-09). Part of `2026-10-04-demography-section-design.md` (read first: serving §4, tokens §7, labels §9). Implementation Plan 3, built before Plan 2 by the owner's choice; Plan 1 (Population) is live, so this page builds on main. Implemented on `claude/demographic-data-next-steps-ec11b1` (plan `docs/superpowers/plans/2026-10-09-demography-migration.md`).
Scope: `/explorer/demography/migration` and `/en/explorer/demography/migration`.

## 0. What changed in the 2026-10-09 revision

- **One page, no place pages.** Every migration row is `country.georgia`; the index-plus-place-pages pattern of Population (section spec §3.1) does not apply.
- **No chart changes.** `StackedColumnChart` gained `periodsPerYear` (Trade) and negative stacks drawn below a zero line (Trade, Unemployment) since this spec was written. Departures are passed as negative values; the planned `mirrored` segment flag and `directionLabels` are dropped.
- **No schema change.** `DemographyFact` already carries `sex` and `citizenshipId`. The importer and served-data loader add one file.
- **Signed departures.** The chart has one `formatValue` for segments and the overlay, so departures print with a minus sign (`გასვლა · რუსეთი −12,345`), consistent with the bars below zero, and the net keeps its sign. Table, indicators and Excel print departures as positive counts under a `გასვლა` heading.
- **State follows Population and Trade:** `replaceState` for ordinary changes, as `DESIGN.md` §6.3 requires; hash `view` values are `line|table` like the other pages.
- Open decisions §11 settled by the owner on 2026-10-09: all six groups selected by default; the net line follows the selection; foreign citizens' share of arrivals is the third side indicator.

## 1. Outcome and scope

The page answers: how many people arrived in and left Georgia each year since 2012, how the balance moved, and which citizenships make up the flows.

Delivers: a stacked column chart with arrivals above a zero line and departures below, split by citizenship group, with a net-migration line over it; a table; a range strip; a series panel of the six citizenship groups; an all/men/women filter; four indicators; Excel; a migration section in the demography methodology page; the hub card, sidebar link, sitemap and `llms.txt` entries switched on.

Excluded: origin and destination flows between countries (Geostat publishes flows to and from Georgia only, so a Sankey or chord diagram would imply data that does not exist); the 22 individual citizenship rows and Geostat's own `Other` row (not comparable across years, kept in the file as published); countries beyond the five named; age of migrants; regional migration; a map; net migration per 1,000 residents; any statement of cause; MCP and bulk publications (section spec exclusion).

## 2. Data

| Series | Detail | Years | Rows |
| --- | --- | --- | ---: |
| `demography.immigrants_by_citizenship_group` | 6 groups × men, women, total | 2012–2025 | 252 |
| `demography.emigrants_by_citizenship_group` | 6 groups × men, women, total | 2012–2025 | 252 |
| `demography.net_migration` | total only | 2012–2025 | 14 |

The mirror holds the whole `demography-migration-annual.csv` (1,778 rows, all `country.georgia`) because the import mirrors the file as it is; the page reads only these series.

- **Groups.** Georgia, Russia, Turkey, Azerbaijan, Ukraine, and `citizenship.all_other_computed`: every other listed citizenship, Stateless, Not stated and Geostat's own `Other`, summed by Fiscal.ge so the group means the same in every year. It is 13–31% of arrivals and 9–23% of departures. The page labels it `სხვა ქვეყნები` / "Other countries" (owner decision 14); the source note, the methodology and the workbook say it is computed by Fiscal.ge. Armenia, India, the United States, China and Iran are inside it.
- **Terms.** Arrivals are immigrants and departures emigrants. Geostat counts a person recorded at the border who accumulates at least 183 days of residence within the following twelve months and was not a usual resident before (arrivals), and the mirror case (departures). Data are from the Ministry of Internal Affairs border records, annual from 2012. Citizenship is not country of residence or origin.
- **Census.** Migration counts do not break at the 1 January 2025 census re-base; this page carries no break marker.
- **Anchor values the tests assert** (all sexes): arrivals / departures / net: 2012 69,063 / 90,584 / −21,521; 2022 179,778 / 125,269 / +54,509; 2023 205,857 / 245,064 / −39,207; 2025 131,501 / 114,374 / +17,127. 2022 arrivals of Russian citizens 62,304 and of Ukrainian citizens 20,716. In every year and sex the six groups add to Geostat's total, arrivals minus departures equal the published net, and each group's men and women add to its total.
- **Derived.** Net migration for any sex and any set of groups is arrivals minus departures of that set, in whole persons. Foreign citizens are the total minus the Georgia group (equal to the sum of the other five, asserted). Both are disclosed as computed by Fiscal.ge.

## 3. Page anatomy

The Trade / Unemployment page shell: `ExplorerPage` → `PageHeader` (coverage `2012–2025`, derived from the facts) → `ExplorerHeading` `მიგრაცია` → a lead sentence in Trade's summary style, `რამდენი ადამიანი შემოვიდა საქართველოში და გავიდა ქვეყნიდან ყოველ წელს, მოქალაქეობის მიხედვით.` ("How many people moved to and left Georgia each year, by citizenship."; the chart's own `ათასი ადამიანი` label stays) → `ExplorerWorkspace` → `ძირითადი ინდიკატორები` → `SourceNote`. No buttons above the workspace.

## 4. Workspace

- **Toolbar.** The chart/table switch on the left, labelled `სვეტები / ცხრილი` ("Columns / Table") as on the inflation categories page; on the right a joined `SegmentedTabs` of three icons (Lucide `Users`, `Mars`, `Venus`, the economic-sectors pattern) whose accessible names and tooltips are `ყველა / მამაკაცები / ქალები`. The filter applies to the chart, table, indicators and export.
- **Chart.** `StackedColumnChart` with `periodsPerYear={1}`, unchanged. Arrivals are positive segments, one per selected group, in the `citizenship.*` colours (section spec §7); departures are the same groups and colours as negative segments, so they stack below zero. Segment labels `შემოსვლა · რუსეთი` and `გასვლა · რუსეთი` stay in the caption and for screen readers. The hover readout lists every row (twelve at most, no hidden count) as a coloured arrow (up for arrivals, down for departures), the group name and the number without a sign: all arrivals by size, then all departures by size. This needs only optional additions to the shared chart (segment `readoutLabel` / `marker`, `readoutOrder`, `readoutRowCap`, `formatOverlayValue`, and a row `marker` / `srLabel` in the tooltip), with defaults that leave other pages unchanged. The overlay is the net migration of the selected groups and sex, the existing ink line with an end dot; with all six groups selected it equals Geostat's published net and is labelled `წმინდა მიგრაცია`, otherwise `წმინდა მიგრაცია (არჩეული ჯგუფები)`. The caption and axis are the chart's existing ones; the axis covers the selected series only.
- **Series aside.** The existing series selector with six rows in fixed order: Georgia, Russia, Turkey, Azerbaijan, Ukraine, the computed remainder. Each row: swatch, name, end-year departures as the value and end-year arrivals as the labelled meta (the shared row renders meta first, so the row reads "arrivals / departures"). `გასუფთავება` / `ყველას მონიშვნა` and `სერიები {selected} / 6`. Search matches Georgian and English names. **Default: all six selected**, a documented departure from "only the total starts selected" like the inflation categories and cities pages (the chart shows parts of a whole). With none selected the existing empty-selection `Callout` shows.
- **Table.** `ExplorerTable` for one direction at a time, chosen with `SegmentedTabs` `შემოსვლა / გასვლა / წმინდა`: rows are the selected groups plus a total row (`ჯამი` when all six are selected, `არჩეულთა ჯამი` otherwise), years as columns, departures as positive counts. The net tab shows one row per selected group and the net total; the shared table formatting prints negatives with `−` and positives unsigned (the hero and the chart readout carry an explicit `+`).
- **Range.** `RangeStrip` over 2012–2025, full range by default, the usual chips. No marker.

## 5. Key indicators

For the end year of the active range and the active sex filter; not affected by the group selection. The layout follows the budget indicators: the title left and `არჩეული პერიოდი: {start}–{end}` right; the hero carries a 3px two-part bar of arrivals and departures with the two figures under it (up and down arrows); each side figure's detail is `{start}: {value at the range start}`, empty when start equals end.

| Block | Content |
| --- | --- |
| Hero | Net migration of the end year, signed (red when negative), with the arrivals / departures bar and, in one paragraph, a neutral sentence ("more people arrived than left" or "more left than arrived") and the cumulative net migration over the active range (the sum of the yearly nets) |
| Side 1 | Arrivals in the end year, with a sparkline over the range |
| Side 2 | Departures in the end year, with a sparkline |
| Side 3 | Foreign citizens as a share of arrivals in the end year (one decimal), with a sparkline of that share |

No sentence names a cause or an event. A net of exactly zero reads "as many arrived as left".

## 6. State

Hash keys: `view` (`line|table`), `start`, `end` (the shared year-range keys; the default address also carries `range=all`), `sel` (group IDs; absent means all six, explicit empty stays empty), `sex` (`total|male|female`), `dir` (`arrivals|departures|net`). Unknown values are rejected, duplicates removed, ranges clamped. Ordinary changes replace the history entry; language switch keeps the state.

## 7. Excel

One download for the active range, groups and sex filter, built with the existing workbook model. Readable sheet: rows grouped under `შემოსვლა` and `გასვლა` with a total row each, then a `წმინდა მიგრაცია` row; years as columns. Data sheet: `წელი`, `მიმართულება`, `მოქალაქეობა`, `სქესი`, `ადამიანი`. Sources sheet: the migration-by-citizenship and net-migration originals with compressed year ranges, and, because the Sources sheet has no free-text line, the definition of the computed group in the Summary subtitle, whose row is fitted to the text so a short range does not cut it off. Search never narrows an export.

## 8. What is reused, extended and new

- **Reused as is:** `ExplorerTable`, `RangeStrip`, `SegmentedTabs`, the series selector, `HeroKpi` / `SideKpiList` with sparklines, `ExplorerWorkspace`, `SourceNote`, `Callout`, `ExcelDownloadButton` and the workbook model, the Trade/Population hash-state pattern, `DemographyFact` and its migration.
- **Small additions:** optional readout props on `StackedColumnChart` and `ChartTooltip` (arrow marker, screen-reader name, row order and cap, overlay formatter); `importDemography.ts` and `servedData.ts` add `demography-migration-annual.csv`; the hub card, sidebar link, sitemap, `llms.txt`, i18n inventory and page revisions add the route; the `demography` message scope gains the migration keys; the demography methodology page gains a migration section and its two source originals; `DESIGN.md` gains the page's section.
- **New:** the two route files, `lib/pages/demography-migration.tsx`, `lib/explorer/demographyMigration.ts` (model, hash, indicators), `demographyMigrationWorkbook.ts`, and one client component `components/demography/demography-migration.tsx`. No new shared component.

## 9. Accessibility and responsive

The chart is the existing named `role="img"` with its caption of values and the table as its equivalent; groups carry swatch, name and values, so colour is never the only carrier; direction is above/below the zero line and in every segment label. Phone behaviour is whatever the shared chart and workspace already do. Verified at 390, 768, 1100 and 1440px in both languages with no page overflow.

## 10. Tests and acceptance

Unit: group and total identities in every year and sex; net equals published net with all groups selected; subset net; foreign-citizen share; cumulative sum; the §2 anchors; hash round-trip and rejection; workbook model; payload excludes internal fields; CSV and db loaders agree. Browser (both languages): default six groups and the overlay; removing Russia changes bars and the net label; sex tabs; table directions; range chips; download; widths with no page overflow; the hub card is live and the sidebar shows Migration.

Acceptance: the anchors agree across chart caption, table, indicators and workbook; nothing claims a cause; existing pages unchanged; `npm run check`, `npm run build` and the browser suite pass once at the end. The Georgian drafts are listed for the owner's review before merge.

## 11. Decisions

1. All six groups selected by default — owner, 2026-10-09.
2. The net line follows the selected groups — owner, 2026-10-09.
3. Foreign citizens' share of arrivals is the third side indicator — owner, 2026-10-09.
4. Five named countries only; the remainder stays one computed group — owner, 2026-10-03.
5. Departures signed in the chart only — assistant default, 2026-10-09 (plain counts would need an optional overlay formatter on the chart).
6. Series search matches the group names in both languages (`migrationSearchLabels`), as Population, Debt and Deficit do — assistant ruling, 2026-10-09.
7. Each aside row shows end-year arrivals as the labelled meta and departures as the value, because the shared row renders meta before value — assistant ruling, 2026-10-09.
8. The Net tab prints negatives with `−` and positives unsigned (shared `ExplorerTable` formatting, which may not change); the hero and chart readout carry `+` — assistant ruling, 2026-10-09.
9. The workbook cites both originals (tables 31 and 33) and the computed group's definition sits in the Summary subtitle — assistant ruling, 2026-10-09.
10. `lib/methodology/sourceInventory.ts` accepts the exact basenames of tables 31 and 33 in the 2026-10 folder so the methodology archive can hold the two originals — assistant ruling, 2026-10-09.
11. The methodology key fact Frequency reads "Annual" (population is 1 January, migration full-year) — assistant ruling, 2026-10-09.
12. A sidebar label `common.demographyMigration` (`მიგრაცია` / `Migration`) was added — assistant ruling, 2026-10-09.
13. Readout as arrows, sex filter as three icons, a lead sentence instead of the unit line, and the budget-style key-figure layout — owner, 2026-10-09 (approved from a mockup). This replaces decision 5's signed departures in the readout; only the overlay keeps its sign.
14. The remainder group is labelled `სხვა ქვეყნები` / "Other countries", without "(computed)"; it also holds stateless persons and "not stated" (at most about 275 a year), which the methodology states — owner, 2026-10-09 (replaces the 2026-10-04 rule "labelled as computed, never as a country").
