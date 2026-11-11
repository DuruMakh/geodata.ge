# Every year on the map pages, for AI tools (design)

Date: 2026-11-10 · Owner: Duru · Branch: `claude/project-thread-2m1cy3`

## 1. Why

On 2026-11-09 ChatGPT (ordinary web search, Georgian) could not rank the municipalities by the drop in school pupils from
2015/16 to 2025/26. It found the Schools page, but the page text carries only 2025/26. The 2015/16 figures sit on 64
separate municipality pages and in the Excel file, which a text-only AI cannot open. `llms.txt` itself says map pages
"list the latest year".

A scan of a local build (2026-11-10, 1,558 HTML files) found 1,426 explorer pages already carrying every charted number
as hidden crawl tables (DESIGN.md §8.4). The gap is the map index pages: 20 carry no crawl table at all, and two
(Births and deaths, Marriages and divorces) carry only Georgia's tables, not their municipalities'.

Duru's decision (2026-11-10, 20:30 Tbilisi): **map pages only**. The trade caps, CSV files per topic and MCP coverage
are out of scope here (MCP has its own thread).

## 2. Success criteria (observable on a production build)

1. Each of the 22 pages in §3, Georgian and English (44 HTML files), carries a hidden crawl table with every year for
   every place its map and list show.
2. `/explorer/education/schools` HTML contains Khulo with 3,936 in 2015/16 and 2,075 in 2025/26, and Shuakhevi with
   2,410 and 1,137. The English page contains the same numbers under "Khulo" and "Shuakhevi".
3. No page goes over the existing 3,000-cell limit, and no place is cut from a table.
4. Nothing visible changes: screenshots of the 22 pages match `main` (desktop and phone).
5. Size: the 44 pages' compressed size grows by at most 25% each; the whole site by at most 1% (gzip, as
   `npm run crawl:check` measures it; brotli reported beside it).
6. `llms.txt` no longer says map pages list only the latest year.

## 3. Pages and what their tables carry

Columns are the years in which any listed place has a figure, labelled as the page labels them (school years as
`2015/16`). A missing figure prints `—`. Rows are Georgia first, then the places in the order the page's list shows
them. Municipal pages get two tables per figure, one for municipalities and one for regions, matching the list's two tabs.

Each table carries the published figures the index is built from, plus the map's own figure when that is a ratio the
site works out (per 100 residents, per resident).

| Page | Places | Figures |
|---|---|---|
| Schools | Georgia, 11 regions, 64 municipalities | Pupils |
| Kindergartens | same | Children |
| Population | same | Population on 1 January |
| Pensions | same | Pensioners; pensioners per 100 residents |
| Subsistence allowance | same | People in receiving families; per 100 residents |
| Municipal budgets | same | Total spending; spending per resident |
| Births and deaths | same | Births; deaths; births per 100 deaths |
| Marriages and divorces | same | Marriages; divorces (the per-1,000 rate is left out: with it the page would pass 3,000 cells; the counts and the Population page give it) |
| Business by region | 11 regions | Sales; persons employed (both map views) |
| Regional economies | 11 regions | Each measure the map can switch to |
| Housing by region | 11 regions | Permitted floor area |
| Loans by region | 11 regions | Loans |
| Transport by region | 11 regions | Registered vehicles |
| Wages by region | 11 regions | Average wage |
| Internet at home | 11 regions | Homes with internet, % |
| Household income | 11 regions | Income, each measure the map can switch to (per household, per person) |
| Household spending | 11 regions | Spending, same measures |
| Museums | 11 regions | Museum visitors |
| Forests | 11 regions | The map's timber figure |
| Waste | 11 regions | The map's waste figure |
| City air quality | 16 stations | Each station's mapped pollutant |
| Causes of death | 11 regions | Deaths per 1,000 people |

The "Georgia" row appears only where the page already shows Georgia beside the places (all municipal pages, and the
region pages whose list has a Georgia row).

Numbers print as the page prints them (whole persons with thousands separators, GEL to the page's decimals, percent to
one decimal). Captions follow §8.4: title · figure · unit · first–last period · basis.

## 4. How it is built

**Reused as is**
- The crawl-table markup and number formatting: `crawlTablesHtml`, `formatCrawlCell`, `CrawlTable`, `MISSING`
  (`lib/explorer/crawlTables.ts`, `lib/explorer/format.ts`), and the 3,000-cell page limit `CRAWL_CELL_CAP`, enforced
  by `npm run crawl:check`. Tables here are never trimmed: every place stays.
- Each index's own model builder and the facts its page already loads on the server; the region map builders through
  `latestCompleteRegionYear` / `buildLatestValueRegionMapModel`.
- Place names and list order: the index models' ranked rows (`placeIndexRows`, the region map models), and each region
  page's existing value formatter and legend (`RegionMapMetric.formatValue`, `.legend`), so cells print as the list does.
- The list tab names `municipal.municipalities` / `municipal.regions` and the label-column heading `workbook.category`.

**Small additions**
- `RegionMapModel` gains an optional `history` (every year's value for each region), filled by the shared region map
  builders from the facts they already read. The latest-year map and list stay as they are.
- `RegionIndex` gains an optional `crawl` prop: the views whose every-year tables it writes (one per map measure), with
  Georgia's values for the lead row where the list has one. Pages that pass nothing are unchanged.

**Genuinely new**
- `lib/explorer/indexCrawlTables.ts`: turns a history (places x years) into `CrawlTable`s; one helper for municipal pages
  (two tables per figure, municipalities and regions, Georgia first in each) and one for region pages.
- `components/explorer-shell/index-crawl-tables.tsx`: writes those tables as the same hidden wrapper markup
  (`<div hidden data-testid="crawl-tables">`). It has no hooks, so municipal page renderers use it on the server and
  `RegionIndex` uses it in the browser tree, where it builds nothing (the server HTML is kept, as `CrawlTables` does).
  The existing `CrawlTables` takes whole workbook models; handing those from a server page would ship them to the
  browser. Measured on Schools: +3.8 KB brotli, +6.0 KB gzip for the table and its copy in the page data.

Each of the 22 page renderers places the wrapper as the last child of its explorer section, as §8.4 asks.

## 5. Testing

- Unit tests for the history of each index builder (years, Tbilisi as `region.tbilisi` / `04`, the excluded codes 05,
  42, 43, 46, 64 absent) and for the shared row helper.
- `tests/explorer/crawlTableCoverage.test.ts`: every map index renderer places the wrapper.
- `npm run crawl:check`: the 22 routes are required to carry the wrapper; spot checks for Khulo and Shuakhevi
  (§2.2) and one region page; cell cap; size report.
- `tests/seo/agentFiles.test.ts`: the new `llms.txt` sentence.
- Before/after screenshots of the 22 pages (desktop and phone) to show nothing visible moved; browser specs for the
  touched pages.

## 6. Docs

- DESIGN.md §8.4: map index pages carry every year of their figures for every listed place.
- `llms.txt` (`lib/seo/llmsText.ts`): "Map pages carry every year for every place they list."
- No data or methodology change; `Project_Definition.md` unchanged.

## 7. Risks

- Size grows on 44 pages (about +15% on the largest, Schools), about +0.3% for the whole site; measured before review.
- Hidden text gets less weight in search; the figures equal what the place pages already show, so there is no
  cloaking risk.
- An AI may still read only part of a long page or miscalculate; this removes the missing-data obstacle only.
- The MCP thread may also edit `llms.txt`; whichever merges second redoes that edit.
