# Inflation: national CPI (overview, categories and cities)

Owner of: `data/imports/cpi-national-monthly.csv`, `data/imports/nbg-inflation-target.csv`, `data/imports/cpi-categories-monthly.csv`, `data/imports/cpi-basket-weights.csv`, `data/imports/cpi-cities-monthly.csv`, `docs/Raw Data/Inflation/`, `apps/web/lib/data/inflation/`, `npm run data:prepare-inflation` / `data:check-inflation` / `data:prepare-inflation-public` / `data:check-inflation-public`. Specs: `docs/superpowers/specs/2026-09-11-inflation-overview-design.md`, `docs/superpowers/specs/2026-09-12-inflation-categories-design.md`, `docs/superpowers/specs/2026-09-26-inflation-cities-design.md`.

## Sources and vintages

Six Geostat CPI workbooks (national sheet; the `yoy`, `mom` and `avg12` files also supply the six city sheets, see Cities), English canonical and Georgian for value parity, archived per vintage under `docs/Raw Data/Inflation/geostat-cpi/<YYYY-MM>/` (folder = last month covered) with `source-manifest.csv` (URL, date, bytes, SHA-256). The first vintage is `2026-08`, downloaded 2026-09-11 from `https://www.geostat.ge/en/modules/categories/26/cpi-inflation` and its Georgian twin. Geostat blocks Python's TLS client; download with `curl -A "Mozilla/5.0"`.

| Series · measure | Geostat file | Stored as | First month |
| --- | --- | --- | --- |
| headline · index_2010 | 2010 average = 100 | level | 2000-01 |
| headline · yoy_pct | same month of previous year = 100 | index − 100 | 2004-01 |
| headline · mom_pct | previous month = 100 | index − 100 | 2004-01 |
| headline · avg12_pct | 12-month average over previous 12-month average | index − 100 | 2002-01 |
| core, core ex tobacco · yoy_pct | core inflation, same month of previous year | as published | 2010-01 |
| core, core ex tobacco · mom_pct | core inflation, previous month | as published | 2010-01 |

Values keep the full cell precision Geostat stores (four decimals; the sheets display one). Subtracting 100 is exact decimal arithmetic on the published value (`decimal.js`). Nothing else is derived: no y/y for 2001–2003, no index level for core. Every CSV row keeps its cell locator (`Georgia!D5`, `Core Inflation!B5`).

## Definitions

Geostat's footnotes in the core files: core inflation "is calculated by excluding the following groups of goods and services from the consumer basket: food and non-alcoholic beverages, energy, regulated tariffs, transport (specific tariffs)"; core without tobacco also excludes tobacco. Geostat's methodology: `https://www.geostat.ge/media/20509/CPI-methodology_19.02.2019.pdf`. The December 12-month average is the calendar-year average inflation shown as the table's `წლის საშუალო`.

## Validation (`prepare-inflation`)

- manifest byte count and SHA-256 for all twelve files;
- content-located parsing (month header, year labels, `Total`/`სულ`, two core rows); English titles checked; layout changes throw, including a value after a gap;
- contiguous monthly series, unique periods, finite values, one common last month, and a vintage folder named after that month;
- at most six decimals (the mirror stores `DECIMAL(20,6)`) and rates below 50% in magnitude, so a core file switched to "=100" form cannot pass as a rate;
- headline y/y, m/m and 12-month average recomputed from the index, max error ≤ 0.2 pp (vintage 2026-08: 0.0002 / 0.0001 / 0.0001 pp; recorded in `data/reports/inflation-cpi-validation.json`);
- English and Georgian files identical, value by value;
- revision guard: any change to an already-published month (or a removed month) fails and lists the months;
- target rows contiguous, only the last open-ended, source IDs registered in `data/sources/source-documents.csv`.

## NBG target

5% (2015–2016), 4% (2017), 3% (from 2018), from the National Bank of Georgia's Monetary Policy Strategy (`nbg-inflation-target/official/monetary-policy-strategy-{en,ka}.pdf`, retrieved 2026-09-11 from `https://nbg.gov.ge/en/page/monetary-policy-strategy`). The English text reads "an inflation target of 5 percent for the years 2015-2016, for 2017 - 4 percent and from 2018 - 3 percent". The `inflation-target` page itself states only the current 3%, so it was not archived.

Pre-2015 status: not verified. Searched on 2026-09-11: `nbg.gov.ge/en/page/inflation-target`, `/en/page/inflation-targeting`, `/monetary-policy/main-directions` (only the 2024–2026 and later Main Directions documents are online), the Monetary Policy Strategy (starts at 2015), and web searches including matsne.gov.ge for the parliament-approved Main Directions resolutions. The only lead is an NBG presentation hosted by the Central Bank of the Republic of Türkiye whose chart shows 6% for 2010–2014; it is not a primary policy document and was not used. The target line therefore starts in 2015; the public page says an earlier target is unverified, never that none existed. Adding pre-2015 rows needs an archived primary document per year (Main Directions resolutions for 2009–2014).

## Categories (COICOP)

No new monthly download. The category tree is already inside the `yoy` and `mom`
workbooks the national series reads: on the `Georgia` / `საქართველო` sheet, column A
is the level, B the COICOP code and C the label, and the overview reader takes
only the `Total` row. `readGeostatCpiCategories` reads the rest, anchored on the
same month header plus the literal `Level` header cell; anything unexpected
throws. 12 divisions and 43 subgroups, 27,668 rows.

IDs are the COICOP code normalised: `cpi.cat.01` through `cpi.cat.12` for
divisions, `cpi.cat.01_1` through `cpi.cat.12_7` for subgroups. The padding is
not cosmetic. Geostat writes division 11 (Restaurants and hotels) and subgroup
11 (Food, under division 1) both as the bare code `11`, so only the level
separates them. Georgian and English labels are Geostat wording, taken from the
`ka` and `en` workbooks and matched by code.

**Gaps are permitted for categories and never for the national series.** A
category may start late, end early, or skip interior months;
`validateCategoryFacts` records each interior gap in
`data/reports/inflation-cpi-validation.json` rather than failing. In the 2026-08
vintage: 04.2 (imputed rentals) and 08.1 (postal services) end 2011-12; 08.2
starts 2011-01, 09.2 starts 2015-01, 09.6 starts 2020-01; 12.5 and 12.6 have one
interior gap each, after 2006-12 and 2009-12. The `Total` row keeps the strict
no-gap rule.

Category y/y starts 2005-01 and m/m 2004-01, a year apart because a
year-on-year change needs a prior year.

### Basket weights

`https://geostat.ge/media/76662/Consumer-basket-weights.xlsx` (English
canonical) and its Georgian twin at media id 76653. The Georgian URL keeps the
percent-encoded Georgian filename Geostat published; the same id with an English
filename returns 404. Archived under
`docs/Raw Data/Inflation/geostat-basket-weights/<year>/`, its own tree because it
refreshes once a year in January rather than monthly with the CPI. Same manifest
discipline (URL, date, bytes, SHA-256) and the same latest-only retention.

One `Weights` sheet, 2012 to 2026, 12 divisions and 41 subgroups: two fewer than
the CPI workbooks, exactly the two that ended in 2011, which is asserted rather
than assumed. Geostat publishes fractions of one; they are stored as percentages
with six decimals (`30.320378`), so each level yearly sum is checked against 100
within 0.001 pp rather than for equality. The measured worst sum error is
0.000003 pp.

### Contribution to inflation

Derived, never stored, following the `% of GDP` precedent in
`lib/explorer/debtExplorer.ts`. For category *i* in month *m* of year *y*:

```
contribution_i(m) = weight_pct_i(y) / 100 x published_change_i(m)
```

The weight is the one for the calendar year of the month being measured. The
chart, table and export also show `დანარჩენი` (the rest) =
`published headline - sum(selected contributions)`. That one definition does
three jobs: the stack closes exactly on the published headline, a partial
selection is a meaningful view rather than a broken one, and the approximation
below is absorbed visibly rather than hidden.

**Why it is an approximation.** The basket rebases every January, so a
year-on-year change spans two weight regimes and the parts do not re-add
exactly. Measured on the 2026-08 vintage over 164 months from 2013-01: mean
absolute error 0.080 pp, worst month 0.585 pp (2021-03). The monthly figures are
an order of magnitude better (0.01 to 0.06 pp mean), which is evidence the
method is sound, since over a single month there is only one weight regime. This
section derives contributions for the annual headline only.

**Contributions start 2013-01.** 2012 reconstructs the headline an order of
magnitude worse than every later year (0.82 pp mean, 1.83 pp worst) because its
weights are the first published and its comparison base predates them; a
residual of nearly 2 pp would be the largest thing on the chart. 2012 weights
still ship and still appear as context on selector rows.

`assertReconstruction` fails the build if any month absolute error over all
divisions exceeds 1.0 pp or the mean exceeds 0.2 pp. Both are monitoring
tripwires against a future Geostat change, not accuracy claims; the measured
figures are written to the validation report on every run.

### Annual weights refresh

Geostat republishes the weights file each January with one new year column.
1) Download both language files into `geostat-basket-weights/<new year>/` and
write the manifest and README. 2) Delete the previous year folder. 3) Update
`repository_source_path`, `byte_size`, `sha256` and `retrieved_at` in
`data/sources/source-documents.csv` and
`data/methodology/source-archives/inflation.csv`. 4) `npm run data:prepare-inflation`.
5) Review the diff: it must add exactly one year per category and change nothing
else. 6) Commit.

## Cities

Geostat collects prices in six cities — Tbilisi, Kutaisi, Batumi, Gori, Telavi and Zugdidi — chosen by the region's share of population expenditure and city size, with the same consumer basket in each (Geostat CPI metadata, `https://www.geostat.ge/media/76676/0601_030226_EN.PDF`, §3.7, §18.1). The `yoy`, `mom` and `avg12` workbooks carry one sheet per city in the national sheet's layout. `prepare-inflation` reads Total and the 12 COICOP divisions from each (Total only from `avg12`) into `data/imports/cpi-cities-monthly.csv`: `city_id` (`city.tbilisi` … `city.zugdidi`), `series_id` (`cpi.headline`, `cpi.cat.01`–`12`), `measure` (`yoy_pct`, `mom_pct`, `avg12_pct`), `period`, `value` (percentage change: the published index minus 100), status and provenance. 20,570 rows for the 2026-08 vintage. Georgia is not repeated: the page and the MCP take the national line from `cpi-national-monthly.csv` and `cpi-categories-monthly.csv`.

The site shows annual inflation only: a Georgia page comparing the six cities' totals with the national rate, and one page per city with its total and 12 divisions. Monthly city rates (`mom_pct`) stay in the CSV, the mirror, the MCP and the `inflation-cities` publications.

**Zugdidi's y/y cells carry float noise.** Every other city's Total and division cells are typed values with at most four decimals (the page displays one). Zugdidi's entire `yoy` sheet — Total and its divisions alike — is a formula result and stores double-precision noise past what it displays (a cell shown as 104.4 stores 104.44085283679487); `mom` and `avg12` are unaffected, as are all other cities. `prepareInflationCities` rounds only that named sheet (`CITY_FORMULA_SHEETS` in `prepareInflation.ts`, today just `city.zugdidi:yoy`) to four decimals — the precision every other city and national value already carries, not the mirror's wider `DECIMAL(20,6)` column or the six-decimal ceiling `validateCityFacts` enforces — before writing it; every other city and role keeps the value exactly as published, so an unexpected amount of excess precision anywhere else still fails validation instead of being silently truncated.

**Scope (owner decisions, 2026-09-26).** City data starts 2016-01, the first month Zugdidi is observed. Divisions only, no subgroups. No 2010 = 100 index for any city: Zugdidi has none, and each city's index is relative to its own 2010 prices, so it cannot show which city is dearer. Core inflation is published for Georgia only.

**Late starts.** Zugdidi's first priced month is 2015-12, so its annual change starts 2016-12 and its 12-month average 2017-12. These are late starts, never filled; any other late start fails validation.

**Same price everywhere.** Some prices — pharmaceuticals, new and used cars, fuel, train and air fares, mobile tariffs, banking fees, intercity call tariffs — are recorded once and extended to every city (metadata §18.3). City differences in those items are not measured differences; the page, workbook and MCP say so.

**City weights are not published.** Geostat derives city weights from regional expenditure shares and updates them annually (metadata §18.5) but does not publish them. Validation recovers implied weights: within each calendar year the national index's movement since December is fitted as a weighted sum of the city indices' movements (each index chained from published m/m). On the 2026-08 vintage the fit is exact to 0.0001 pp in every year from 2016 (2026: Tbilisi 0.555, Kutaisi 0.122, Batumi 0.108, Telavi 0.079, Zugdidi 0.077, Gori 0.060). These are price-updated effective weights, not Geostat's, and they are used only as a check — written to `data/reports/inflation-cpi-validation.json`, never to a CSV, page, workbook, publication or MCP answer.

**Validation.** Six city sheets per workbook matched by trimmed, case-insensitive name; Total plus exactly 12 divisions per city; English and Georgian values identical; no gap after a series starts; first months 2016-01 except Zugdidi's two late starts; each city's y/y and 12-month average agree with its own m/m chain within 0.01 pp (a column-shift tripwire; measured ≤ 0.0004 pp); the city reader agrees with the national reader on the national sheet; the implied-weights fit residual ≤ 0.01 pp with every weight in (0, 1) and the weights summing to 1 within 0.001 (a year with no more months than cities is skipped and listed); the revision guard over every published city value.

**Refresh.** Cities arrive in the same workbooks as the national series; `prepare-inflation` rewrites `cpi-cities-monthly.csv` in the same run. Review: exactly one new month per city series.

## Monthly refresh

Geostat publishes on the 2nd–5th. 1) Download the twelve files into a new vintage folder and write its `source-manifest.csv` and `README.md`. 2) Delete the previous vintage folder (retention below). 3) Update the six Geostat paths in `source-documents.csv` and, in the methodology archive CSV (`data/methodology/source-archives/inflation.csv`), each row's `repository_source_path`, `byte_size`, `sha256`, `retrieved_at` and note; `public_download_path` stays the same. 4) `npm run data:prepare-inflation`. 5) Review the diff: exactly one new month per series. 6) Commit; the standard pipeline imports and deploys. No automated fetching. Categories need no extra step: the same `yoy` and `mom` files carry them, so `prepare-inflation` rewrites `cpi-categories-monthly.csv` in the same run. The weights file is not part of the monthly refresh (see the annual refresh above).

A revision error is a stop-and-review event. Recover the previous vintage from git and compare the listed months with Geostat's release. If the revision is genuine, record each month with its old and new value under Known revisions below and in the commit message. Then delete `data/imports/cpi-national-monthly.csv` and rerun `npm run data:prepare-inflation`: with no committed CSV the guard has nothing to compare against. The CSV diff must show exactly the listed months plus the new one.

Retention (user decision, 2026-09-11): only the latest vintage stays in the working tree. Each Geostat upload repeats the full history, so older folders would add about 3.5 MB a month of duplicates, and the methodology archive would have to list every one of them (its inventory check covers every file under `docs/Raw Data/Inflation`). Earlier vintages remain byte for byte in git history. The public download paths carry no vintage, so each refresh replaces the files at the same URLs and source links in earlier workbooks keep working. The revision guard compares against the committed canonical CSV, not the old files, so it is unaffected; when it fires, recover the previous vintage from git to compare.

## Known revisions

None since the first vintage (2026-08).

## Known limitations

The national index is a weighted mean of city indices. Core has no published index level. The 2004 COICOP break is why category m/m starts 2004-01 and y/y 2005-01; it does not affect the national series. Contributions are an approximation of a published figure, not a published figure (see Contribution to inflation above), and exist only from 2013-01. City figures are the six observation cities, not their regions; a city's inflation is not its cost of living or price level.

## Serving

`InflationCpiFact`, `InflationTarget`, `InflationCategoryFact`, `InflationBasketWeight` and `InflationCityFact` mirror the five CSVs (including `cpi-cities-monthly.csv`) with exact parity in `npm run data:import` (`docs/data-methodology/database-import.md`). Serving code (`importInflation.ts`) never loads the workbook reader or `prepareInflation.ts` (`tests/data/inflation/servingBoundary.test.ts`). The processed-data download `/downloads/data/inflation-cpi-national.csv` is a copy of the canonical CSV made before the build and checked after it (`data:check-inflation-public` in `postbuild`).

The fact-query snapshot carries all five tables. `query_inflation`, `describe_coverage`, `get_sources`, `compare` and `rank` answer from it, and `inflation-national.json`, `inflation-categories.csv`, `inflation-categories.json`, `inflation-cities.csv` and `inflation-cities.json` are published beside the manifest. MCP contributions come from the same `buildContributionIndex` as the page, and each carries the severe `inflation_contribution_derived` caveat (`ai-grounding-and-caveats.md`). Design: `docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`.

The eight registered sources also appear in `sources.json` and MCP `get_sources`, and MCP serves the figures through `query_inflation`. Because each refresh edits `source-documents.csv`, it changes the fact-query snapshot's `dataVersion` (MCP clients passing `expectedDataVersion` see `data_version_changed` monthly) and the site-wide last-modified date used by the sitemap and the footer's "Last updated", including the inflation footer note.
