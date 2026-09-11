# Inflation: national CPI (overview)

Owner of: `data/imports/cpi-national-monthly.csv`, `data/imports/nbg-inflation-target.csv`, `docs/Raw Data/Inflation/`, `apps/web/lib/data/inflation/`, `npm run data:prepare-inflation` / `data:check-inflation` / `data:prepare-inflation-public` / `data:check-inflation-public`. Spec: `docs/superpowers/specs/2026-09-11-inflation-overview-design.md`.

## Sources and vintages

Six Geostat CPI workbooks (national sheet only), English canonical and Georgian for value parity, archived per vintage under `docs/Raw Data/Inflation/geostat-cpi/<YYYY-MM>/` (folder = last month covered) with `source-manifest.csv` (URL, date, bytes, SHA-256). The first vintage is `2026-08`, downloaded 2026-09-11 from `https://www.geostat.ge/en/modules/categories/26/cpi-inflation` and its Georgian twin. Geostat blocks Python's TLS client; download with `curl -A "Mozilla/5.0"`.

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

## Monthly refresh

Geostat publishes on the 2nd–5th. 1) Download the twelve files into a new vintage folder and write its `source-manifest.csv` and `README.md`. 2) Delete the previous vintage folder (retention below). 3) Update the six Geostat paths in `source-documents.csv` and, in the methodology archive CSV (`data/methodology/source-archives/inflation.csv`), each row's `repository_source_path`, `byte_size`, `sha256`, `retrieved_at` and note; `public_download_path` stays the same. 4) `npm run data:prepare-inflation`. 5) Review the diff: exactly one new month per series. 6) Commit; the standard pipeline imports and deploys. No automated fetching.

A revision error is a stop-and-review event. Recover the previous vintage from git and compare the listed months with Geostat's release. If the revision is genuine, record each month with its old and new value under Known revisions below and in the commit message. Then delete `data/imports/cpi-national-monthly.csv` and rerun `npm run data:prepare-inflation`: with no committed CSV the guard has nothing to compare against. The CSV diff must show exactly the listed months plus the new one.

Retention (user decision, 2026-09-11): only the latest vintage stays in the working tree. Each Geostat upload repeats the full history, so older folders would add about 3.5 MB a month of duplicates, and the methodology archive would have to list every one of them (its inventory check covers every file under `docs/Raw Data/Inflation`). Earlier vintages remain byte for byte in git history. The public download paths carry no vintage, so each refresh replaces the files at the same URLs and source links in earlier workbooks keep working. The revision guard compares against the committed canonical CSV, not the old files, so it is unaffected; when it fires, recover the previous vintage from git to compare.

## Known revisions

None since the first vintage (2026-08).

## Known limitations

The national index is a weighted mean of city indices. Core has no published index level. The 2004 COICOP break matters for a later category section, not for the national series.

## Serving

`InflationCpiFact` and `InflationTarget` mirror the two CSVs with exact parity in `npm run data:import` (`docs/data-methodology/database-import.md`). Serving code (`importInflation.ts`) never loads the workbook reader or `prepareInflation.ts` (`tests/data/inflation/servingBoundary.test.ts`). The processed-data download `/downloads/data/inflation-cpi-national.csv` is a copy of the canonical CSV made before the build and checked after it (`data:check-inflation-public` in `postbuild`).

The seven registered sources also appear in `sources.json` and MCP `get_sources`, although MCP serves no inflation figures. Because each refresh edits `source-documents.csv`, it changes the fact-query snapshot's `dataVersion` (MCP clients passing `expectedDataVersion` see `data_version_changed` monthly) and the site-wide last-modified date used by the sitemap and the footer's "Last updated", including the inflation footer note.
