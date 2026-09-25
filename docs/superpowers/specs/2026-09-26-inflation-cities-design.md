# Inflation: cities section specification

Date: 2026-09-26
Status: Draft for user review. Data scope, page shape, defaults, indicators, MCP inclusion and every decision in §1.1 were approved in conversation on 2026-09-26.

## 1. Outcome and scope

Add **ქალაქები** (Cities) as the third live section of the Inflation dataset, at `/explorer/inflation/cities`. The section compares consumer-price inflation in the six cities where Geostat collects prices — Tbilisi, Kutaisi, Batumi, Gori, Telavi and Zugdidi — against each other and against Georgia. It answers one question the national pages cannot: *is inflation higher in one city than another, overall and within a category of goods*.

This milestone includes: city extraction from the already-archived Geostat workbooks, a canonical CSV, database mirror and parity, the cities page with its category picker and seven-line comparison chart, the monthly table, localized Excel download, methodology, Georgian and English, and read-only MCP access and bulk publications for the city data.

Out of scope: a per-city deep-dive page, a map, city subgroups, a city price index, city basket weights or contributions, core inflation by city, product-level indices, the price calculator, every non-CPI price index and HICP.

### 1.1 User-approved decisions (2026-09-26)

- **Comparison, not deep dive.** One page whose lines are the cities, not one page per city. Without published city weights a per-city page cannot show contributions, and would mostly repeat the national Categories page six times.
- **Data starts 2016-01**, the first month Zugdidi is observed, so every city shares one window.
- **Total and the 12 COICOP divisions only.** No subgroups.
- **No 2010 = 100 index for any city.** Zugdidi has none, and each city's index is relative to its own 2010 prices, so it cannot say which city is dearer and invites that misreading.
- **Implied city weights are an internal validation check only**, never published (§3.5).
- **All six cities and Georgia are selected by default** (§6).
- **Indicators follow the picked category** (§6).
- **MCP and bulk publications ship in the same delivery**, as its final task, following the 2026-09-14 rule that the MCP serves everything the site shows.
- **No map.** Six points carry no more than a ranked list of six numbers.
- **Two tabs, as on the overview.** `წლიური ინფლაცია` and `თვიური ინფლაცია`. The 12-month average is not a tab; it supplies the table's `წლის საშუალო` column exactly as on the national table.

## 2. Scope amendment

In `Project_Definition.md` §2C, add an item for the cities section naming this spec, and extend the MCP item to cover city data and the new publications. Replace "city indices" in the still-excluded list with "city subgroups, city price indices (2010 = 100), city weights and contributions, and core inflation by city". Product-level indices, the price calculator, a standalone basket section, every other price index, HICP and monthly or quarterly data for any other dataset remain excluded.

`DESIGN.md` §25 gains the Cities surface: the category picker, the seven-line default with Georgia in ink, and the six city colours.

## 3. Data

### 3.1 Source

**No new download.** The city sheets are inside the archived, hash-verified workbooks the overview already reads: `docs/Raw Data/Inflation/geostat-cpi/<vintage>/{en,ka}/cpi-yoy.xlsx`, `cpi-mom.xlsx` and `cpi-avg12.xlsx`. Each carries one sheet per city after the national sheet, in the same layout as the national sheet: `Tbilisi`/`თბილისი`, `Kutaisi`/`ქუთაისი`, `Batumi`/`ბათუმი`, `Gori`/`გორი`, `Telavi`/`თელავი`, `Zugdidi`/`ზუგდიდი`. Sheet names carry trailing spaces and inconsistent case in some files (`BaTumi ` in the index file, which this section does not read); sheets are matched on trimmed, case-folded names.

Geostat's metadata (`https://www.geostat.ge/media/76676/0601_030226_EN.PDF`, §3.7, §15.1, §18.1, §18.3, §18.5) confirms the six cities, an identical basket in every city, a national index that is the weighted arithmetic mean of the city indices, city weights derived from regional expenditure shares and updated annually — and does not publish those weights. Geostat's PC-Axis database carries the same city tables with the 12 divisions only.

### 3.2 Coverage (2026-08 vintage, audited 2026-09-26)

| Measure | Series | Cities | First month | Gaps |
| --- | --- | --- | --- | --- |
| `yoy_pct` | Total + 12 divisions | five cities | 2016-01 | none |
| `yoy_pct` | Total + 12 divisions | Zugdidi | 2016-12 | none |
| `mom_pct` | Total + 12 divisions | all six | 2016-01 | none |
| `avg12_pct` | Total | five cities | 2016-01 | none |
| `avg12_pct` | Total | Zugdidi | 2017-12 | none |

Zugdidi's price observations begin in December 2015, so its first year-on-year comparison is December 2016 and its first 12-month average December 2017. These are late starts, shown as such, never filled. 20,570 values in total. The two known cell-level oddities in the source — Kutaisi 09.6 m/m 2019-01 is blank, and Zugdidi has no 04.2 or 08.1 rows — are both subgroups before or outside the window and are not read.

Audit results the pipeline re-asserts on every run (§4.3): English and Georgian values are identical in every city cell; each city's y/y, m/m and 12-month average agree with its own index to within 0.0002 pp; the national sheet is identical to the values already in `cpi-national-monthly.csv` and `cpi-categories-monthly.csv`.

### 3.3 Identity

City IDs are `city.tbilisi`, `city.kutaisi`, `city.batumi`, `city.gori`, `city.telavi`, `city.zugdidi`. They deliberately do not reuse `region.*`: Geostat observes prices in the city, and the city of Batumi is not the Adjara region. Series IDs reuse the existing `cpi.headline` and `cpi.cat.01` … `cpi.cat.12`; category labels are the existing reviewed labels. City labels are reviewed i18n messages with review dates (`თბილისი` / `Tbilisi`, …), so `npm run i18n:check` governs them; sheet names are used only to locate the sheets.

### 3.4 Canonical CSV

`data/imports/cpi-cities-monthly.csv`, UTF-8 with BOM like the other inflation CSVs, one row per city, series, measure and month:

`city_id`, `series_id`, `measure` (`yoy_pct` | `mom_pct` | `avg12_pct`), `period` (`YYYY-MM`), `value`, `status` (`published`), `source_id`, `source_locator`, `last_reviewed_at`.

`avg12_pct` exists for `cpi.headline` only. Values are published precision, stored as percentage change (published index minus 100), as the national rows are. `source_locator` names the city sheet and cell (`Batumi!D7`). **Georgia is not repeated**: the page and MCP take the national line from the existing national and category CSVs, so national figures have one home. The existing inflation CSVs are not touched.

### 3.5 Implied city weights (internal only)

Geostat does not publish city weights, but they are recoverable: for each calendar year, the national index's movement since the previous December is fitted as a weighted sum of the city indices' movements, constrained to sum to one. On the 2026-08 vintage the fit is exact to 0.0001 pp in every year from 2016 (for example 2026: Tbilisi 0.555, Kutaisi 0.122, Batumi 0.108, Telavi 0.079, Zugdidi 0.077, Gori 0.060).

These weights are a **validation check, never a figure**: they are written to the validation report, not to any CSV, page, workbook, publication or MCP answer. They are not Geostat's published weights (they are price-updated effective weights) and must never be presented as such.

## 4. Pipeline

### 4.1 Reader

`lib/data/inflation/readGeostatCpi.ts` gains a city mode for the `yoy`, `mom` and `avg12` roles, taking a city sheet name. It reuses the existing anchors — the I–XII header, the `Total`/`სულ` row, the `Level`/`Code` columns — and the existing discipline: anything unexpected throws. It keeps the Total row and the 12 level-2 rows and drops months before 2016-01. The national reading paths are untouched, so the overview's and categories' extraction cannot change.

### 4.2 Prepare

`scripts/prepare-inflation.ts --write | --check` writes `cpi-cities-monthly.csv` alongside the existing CSVs, with its refresh, review and revision-guard behaviour unchanged. Cities refresh with the monthly CPI vintage and need no extra step.

### 4.3 Validation

Added to `npm run data:validate` through the existing `data:check-inflation`:

- exactly six city sheets in each of the three workbooks, in both languages, matched by trimmed name;
- every city has Total plus exactly 12 divisions with the same COICOP codes as the national sheet;
- English and Georgian city values identical;
- no gap after a series' first month; first months as in §3.2, with Zugdidi's late starts enumerated as expected, and any other late start failing;
- each city's y/y and 12-month average consistent with its m/m chain within 0.01 pp — a tripwire for a shifted column, not an accuracy claim. This check and the weights fit below read the full workbook before the 2016 trim, since a 2016 comparison needs 2015 months;
- the national sheet equal to the existing national and category values;
- **the implied-weights fit** of §3.5: fails if any year's maximum monthly residual exceeds 0.01 pp or any weight falls outside (0, 1); the weights and residuals are written to `data/reports/inflation-cpi-validation.json`;
- the revision guard, unchanged: any change to an already-published city value fails.

### 4.4 Serving and mirror

One Prisma model mirroring the CSV, one hand-written migration per `docs/data-methodology/database-import.md`, included in `npm run data:import` with row-count and value-sum parity per city, series and measure. CSV mode stays the build fallback; pages stay static. The build-time selection is memoized once per build, as for categories.

## 5. Navigation and routes

- `/explorer/inflation/cities` — Georgian canonical; `/en/explorer/inflation/cities` — English.
- The sidebar's inflation section list gains `ქალაქები` below `კატეგორიები`, with the active-row, collapse, keyboard and mobile behaviour of every other section.
- Hub card 04 becomes active: title `ქალაქები`, an ink sparkline of the gap between the highest and lowest city's annual inflation over the last 36 months, footer `{latest month} · {highest city} {rate}%`, both on the Total annual rate. Cards `სამომხმარებლო კალათა` and `პროდუქტები` stay coming-soon.
- `/methodology/inflation` gains the city section (§10).

## 6. Page composition

```text
Home / Data / Inflation / Cities          Jan 2016 – Aug 2026 · updated YYYY-MM-DD

ქალაქები
პროცენტი · წინა წლის შესაბამის თვესთან შედარებით

          წლიური ინფლაცია   თვიური ინფლაცია

კატეგორია: [სულ ▾]          ხაზი | ცხრილი     │  სერიები 7 / 7
line chart: Georgia (ink) + 6 cities          │  ☑ საქართველო
legend                                        │  ☑ თბილისი … ☑ ზუგდიდი
monthly range strip                           │  ჩამოტვირთვა
source note + methodology link                │

ძირითადი ინდიკატორები
hero: highest city │ lowest city │ gap between cities │ cities above national
```

- **No headline value line.** The unit line alone sits under the H1, per `DESIGN.md` §25: y/y `პროცენტი · წინა წლის შესაბამის თვესთან შედარებით`, m/m `პროცენტი · წინა თვესთან შედარებით` — the existing overview strings.
- **Tabs.** Production `TextTab`, centred, ordered as on the overview; the landing tab is `წლიური ინფლაცია`. A tab switches chart, table, unit line, available range and download together. The two tabs have different coverage only through Zugdidi, and the overview's range-transition rule applies unchanged.
- **Category picker.** A single-choice control in the toolbar, `კატეგორია: სულ` by default, listing `სულ` then the 12 divisions with the existing reviewed labels. It applies to both tabs and persists across them. Its visual treatment follows existing select controls in the editorial layer; `DESIGN.md` records it.
- **Toolbar.** `SegmentedTabs` `ხაზი | ცხრილი`; the mode persists across tabs.
- **Series panel.** Seven rows: `საქართველო` first, then the six cities in Geostat's order. **All seven are selected by default** — a deliberate, user-approved departure from the "only the total is selected by default" rule, of the same kind the Categories page made: a Cities page that opened on the national line alone would show nothing city-specific. Georgia remains first, selectable and removable. Below the header, `გასუფთავება` / `ყველას მონიშვნა` sit on the left and `სერიები {selected} / 7` on the right. No search.
- **Colours.** Georgia is drawn in ink (`INK`) as the benchmark. The six cities take six distinct entries from `EDITORIAL_PALETTE`, fixed per city across every surface and added to `SERIES_COLORS` under the city IDs; the assignment is chosen in the plan and must pass WCAG AA against the paper ground and against each adjacent city.
- **Chart.** The existing `EditorialLineChart` with its monthly axis. Zugdidi's line starts at its first month; no line is extended or interpolated.
- **Table.** The overview's year × month grid, one series at a time through its existing series switcher. With `სულ` picked on the y/y tab, the grid carries the `წლის საშუალო` column from each series' December 12-month average, exactly as the national table does; with a division picked, or on the m/m tab, the column is absent because Geostat publishes no category or monthly-basis average. Empty cells show `—`.
- **Indicators.** `ძირითადი ინდიკატორები` reports the latest published month, **year-on-year, for the picked category**, regardless of tab or range. Cities only; Georgia is the benchmark, never a ranked entry.
  - Hero: the city with the highest annual rate — its value at 62px, and its distance from Georgia in `პპ` (`+1.3 პპ საქართველოზე მეტი`).
  - `ყველაზე დაბალი` — the city with the lowest annual rate, with its distance from Georgia. When no city's prices actually fell, the wording never claims a fall; negative values read `გაიაფდა` and are never coloured good or bad.
  - `ქალაქებს შორის სხვაობა` — highest minus lowest city, in `პპ`, with a 36-month sparkline.
  - `ეროვნულზე მაღალი` — how many cities are above Georgia's rate, as `{n} / 6`, with a 36-month sparkline of that count.
  - Ties name every tied city.
- **Caveat.** The source note carries one standing sentence: some prices — fuel, medicines, cars, mobile tariffs, flights and train fares — are recorded once and applied to every city, so city differences in those items are not measured differences. No per-category warnings.

## 7. Components

Reused unchanged: `PageHeader`, `TextTab`, `SegmentedTabs`, `SeriesSelector`, `SeriesSelectorRow`, `EditorialLineChart`, `Sparkline`, `RangeStrip`, `ExcelDownloadButton`, `SourceNote`, `HorizontalScrollHint`, `BudgetHub`, the workbook writer, the i18n and route systems.

Narrow extensions, existing behaviour and tests unchanged:

- The overview's month-grid table accepts a city series and keeps its `წლის საშუალო` column rule.
- The inflation hub cards: card 04 live.

New:

- **`lib/explorer/inflationCities.ts`** — state, hash, selection, category resolution and the indicator calculations.
- **The category picker**, as a small component in the inflation component family.
- Six city colours in `SERIES_COLORS`.

## 8. State and URL

Hash keys with stable ASCII values: `i=yoy|mom`, `m=chart|table`, `r=YYYY-MM-YYYY-MM`, `c=total|01…12` for the category, `sel=georgia,tbilisi,…` for the selected lines, `t=<line>` for the table's active series. Validated and clamped as the overview does; unknown values are dropped rather than failing. Default: `yoy`, chart, the full range, `total`, all seven lines. Language switching preserves compatible state.

## 9. Excel

One `ჩამოტვირთვა` exports the active tab, category, range, selection and language through the standard three-sheet workbook:

- `მარტივი ცხრილი` — one row per selected line and year, month columns labelled by name, and `წლის საშუალო` under the same rule as the table.
- `მონაცემები` — `წელი`, `თვე`, `ქალაქი`, `კატეგორია`, `COICOP კოდი`, `მნიშვნელობა`, `ერთეული`, `სტატუსი`.
- `წყაროები` — the Geostat CPI files with readable archive links.

The workbook carries the same-price-everywhere note. Internal metadata columns and the implied weights are not exposed.

## 10. Methodology

`docs/data-methodology/inflation-cpi-national.md` gains a cities section: the six cities and Geostat's reason for choosing them; the 2016 start and Zugdidi's late starts; the 12-division scope; why the 2010 = 100 index is not shown for cities; the same-price-everywhere caveat with Geostat's list; that Geostat does not publish city weights, how the pipeline recovers implied weights, the measured fit, and that they are used only as a check; the reader anchors and validations. The public `/methodology/inflation` page gains a plain-language summary of the same, without the weights' values.

## 11. MCP and bulk publications

Additive changes to the service defined in `docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`:

- **Entities.** `city.tbilisi` … `city.zugdidi`, `entityType: "city"`, with reviewed Georgian and English labels, alongside `country.georgia`.
- **`query_inflation`** gains optional `entityIds`. Omitted, it answers exactly as today for `country.georgia`, so every existing call and fixture stays valid. For a city, series are `cpi.headline` and `cpi.cat.01` … `cpi.cat.12`; measures `yoy_pct` and `mom_pct`, and `avg12_pct` for `cpi.headline`. Any other series or measure for a city — subgroups, core, the index, weights, contributions, the target — is rejected with `unsupported_measure` or `unknown_series` and valid choices, never answered empty. The 500-cell limit counts entities × series × months.
- **Missing values.** Months before a city's first month return `availability: "missing"` with a bilingual reason (city data starts 2016-01; Zugdidi y/y 2016-12 and 12-month average 2017-12), never zero.
- **`rank`** gains `dimension: "entity"` for inflation: the six cities ranked for one series, measure and month (`value`) or change between two months (`percentage_point_change`). Georgia is returned as the benchmark, never ranked.
- **`compare`** accepts a city entity, paired on `period` through `queryInflation` as today.
- **`describe_coverage`** lists the city entities with coverage derived from the loaded facts; **`get_sources`** is unchanged in shape.
- **Caveat.** `inflation_city_central_prices`, severity `note`, comparison effect `none`, on any city cell for a division: "Some prices — fuel, medicines, cars, mobile tariffs, flights and train fares — are recorded once and applied to every city, so city differences in those items are not measured differences." Georgian counterpart written in the plan.
- **Instructions.** The INFLATION section adds: city figures cover six cities from 2016; Geostat does not publish city weights and this service does not supply them; the national rate is a weighted mean, not the plain average of the cities; a city's inflation is not that city's cost of living or price level. WHAT IS NOT SERVED drops "city price indices" and keeps city subgroups, the city index, city weights and core by city.
- **Publications.** `inflation-cities.csv` and `inflation-cities.json` (metadata), following the categories pattern, listed in the bulk manifest, `llms.txt` and `/connect`.
- **Schema.** `SCHEMA_VERSION` `1.2.0` → `1.3.0`; the change is additive.
- **Reference fixture.** `tests/factQuery/fixtures/referenceIntents.ts` gains three intents, Georgian and English prompts, values read by hand from `cpi-cities-monthly.csv`: one city's y/y for a fixed past month; the six cities ranked by one division's y/y in one month; Zugdidi y/y before 2016-12 returned missing.

## 12. Verification and acceptance

Data: extraction parity against the workbooks for every city; en/ka parity; the national-sheet equality; the internal consistency tripwire; the implied-weights fit within bounds and written to the report; Zugdidi's late starts and no other; the revision guard exercised with a modified fixture; import parity; every existing inflation CSV and every other dataset unchanged.

Behaviour: both tabs' series, unit line and coverage, with no headline value line; the category picker on both tabs and in the hash; the seven-line default with Georgia first and in ink; the bulk actions and count; Zugdidi's late start in chart and table; the `წლის საშუალო` column present only for `სულ` on y/y; indicators following the picked category, ties, and the no-fall wording; hash restore and language switch; workbooks matching tab, category, range, selection and language.

Visual and browser: the page against the overview at desktop and mobile widths in both languages; city colours passing WCAG AA against the ground and each other; no clipped labels or horizontal overflow; a new `tests/browser/inflation-cities.spec.ts`; every existing inflation spec green **unmodified**.

MCP: `npx vitest run tests/factQuery/reference.test.ts` passes with the three new intents and all existing intents unchanged; a disagreement is a stop condition, reported rather than edited. Publications match the snapshot (`data:check-fact-query-publications`).

Gates per `CLAUDE.md`: targeted tests while working; `npm run check`, `npm run build` and `npm run test:browser` once, when finished.

## 13. Authority and next step

Approval of this document authorizes the cities section, its MCP and publication additions, and the §2 scope amendment — nothing in the §1 out-of-scope list. After user review, write the implementation plan as separate, test-first steps: reader, prepare and validation (including the implied-weights check), serving and mirror, page state and indicators, page and panel, table, workbook, i18n, methodology, MCP and publications, verification.
