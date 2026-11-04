# AI tools give the number first — design

Date: 2026-11-03. Owner: Duru. Thread: "Make AI tools give direct answers".
Status: approved direction ("Both: full hidden tables + llms.txt", 2026-11-03 17:39 Tbilisi); this written spec awaits review.

## 1. Problem

Duru asked ChatGPT (normal web search, in Georgian) which regions created no jobs in the last ten years, "according to Fiscal.ge".
ChatGPT answered with a methodology caveat about merged regions and said it could not get the employed-people table.

The data is on the site. From 2015 to 2025 employment in Samegrelo-Zemo Svaneti stayed flat (118.9 → 118.5 thousand) and
Kvemo Kartli fell (169.7 → 142.9 thousand) — `data/imports/unemployment-annual.csv`.

Causes, checked on a local build of `main` (6ebf6686) by reading each page as a reader that does not run page code:

1. **The hidden yearly table holds only the ticked series.** Release 1 of the SEO fixes (PR #226, DESIGN.md §8.4) puts a
   hidden copy of the Table tab in every chart page, with "the same rows as the Table tab". The Table tab shows only the
   selected series, and almost every page selects only its total by default. On `/explorer/unemployment/regions/imereti`
   the HTML carries the unemployment rate for 2019–2025 and nothing else; employed and unemployed people, the labour force
   and participation never reach a crawler. The same holds on nearly every chart page and on every tab other than the first.
2. **What a reader does find is the note.** With no counts to read, ChatGPT repeated the page's merged-regions note and
   applied it to every region.
3. **llms.txt pushes towards caveats.** 54 KB, no figures, "read [each file's caveats] before citing a figure" in the
   opening, most page lines ending in a warning, "Browse-only: there is no MCP tool and no bulk file" about 25 times
   (it reads as "this data is not available"), and a developer paragraph on data-schema versions that /connect already carries.
4. **The MCP instructions** (`lib/mcp/instructions.ts`) ask for "every severe caveat in full, next to its figure" but say
   nothing about leading with the figure.

Not causes: chart pages already lead with the latest value (`LatestValueLine`); robots.txt allows every crawler; there is no
Vercel firewall configuration.

## 2. Goal and success criteria

An AI tool that reads one Fiscal.ge page can answer a factual question about any series that page offers, for any year,
and is told to give the number first.

- S1. Every chart page's delivered HTML contains, in a hidden table, every series the page's series list offers in each of
  its views (tabs), every year — not only the ticked ones — subject to the size cap in §3.4.
- S2. On `/explorer/unemployment/regions/samegrelo_zemo_svaneti` the delivered HTML contains employed people for 2015 (118.9)
  and 2025 (118.5); on the Georgian page as well.
- S3. Nothing a visitor sees changes: same layout, same visible tables, same tab order, no new focus stops, no new
  screen-reader text (hidden tables stay `hidden`, as today).
- S4. llms.txt opens with answer-first rules, every chart page's line starts with that page's latest figure taken from the
  same data as its group-page card, and the figures update with each data release without anyone editing the file.
- S5. llms.txt keeps every page and methodology link it has today (existing sitemap tests stay green) and is at most half
  its current size.
- S6. The total compressed HTML of all prerendered pages grows by no more than 15%, measured before and after (it is
  billed as Vercel ISR reads on the Hobby plan, in 8 KB compressed units).

## 3. Part A — the full hidden table

### 3.1 What it contains

For each chart page, one hidden table per **view × unit**:

- **View** = each tab or breakdown the page offers (for example Unemployment overview: Overview, Urban / rural, Education,
  Long-term). Map views and icon toggles that only re-express the same numbers (share of GDP, per person) are not separate
  views: the table carries the page's base unit only. A per-person or share-of-GDP view whose numbers exist nowhere else on
  the page is a view.
- **Unit** = a group of series the page's list cannot show together (Unemployment: rates vs people counts → two tables).
- **Rows** = every series in that view's list, total first, under the same headings as the list; **columns** = every year
  (or month) the view covers.
- **Caption** = page title · view · unit · first–last period, e.g. `Unemployment — Imereti · people · thousand · 2019–2025`.
- Cells use the page's own number format and status marks (planned, preliminary, forecast, break), as the visible table does.
  A missing value is a dash, never 0.

### 3.2 How it is built (reuse first)

- **Reused as is:** each explorer's existing `build…WorkbookExportModel` builder (41 workbook files under `lib/explorer/`).
  Its `readable` part already holds the title, unit, years and one row per series with values and status — the Excel
  "Summary" sheet. The crawl table is the Summary sheet as HTML.
- **Small addition per explorer:** a state with every series of a view selected — the same state the list's
  "ყველას მონიშვნა / Select all" produces — passed to that builder once per view × unit.
- **Genuinely new:** one small component that renders a `WorkbookExportModel["readable"]` as a hidden `<table>`
  (the only new component; `ExplorerTable` is not reused for it because it renders one live selection with interactive
  layout logic, while this is a static, all-series copy). It lives in the client explorer, as today's crawl copy does, so its
  data travels once in the page's existing props rather than a second time in the server payload.
- **Replaced:** today's `ExplorerTable crawlCopy` hidden copy, which the full table makes redundant. `ExplorerTable` goes
  back to rendering only in Table mode; the `crawlCopy` prop and its `useLayoutEffect` dependency go. The guard test
  `tests/explorer/crawlTableCoverage.test.ts` is rewritten to require the new component on every chart page instead.

### 3.3 Where

All 48 components that render an `ExplorerTable` today, plus any chart page that has a workbook but no table. Pages
without a chart (methodology, group pages, All data, home) are out of scope; group pages already print their headline figures.

### 3.4 Size cap

A page's hidden tables hold at most **3,000 cells**. Over that, each table keeps its total and its largest series by the
latest value until the cap, and the caption says so: `top 90 of 217 partners and groups; all of them in the Excel download`.
Monthly views (inflation) carry the last 36 months. The plan measures every page; pages expected to hit the cap are trade
partners, trade products, domestic exports, inflation categories and inflation products.

### 3.5 Verification

- Unit tests: the renderer (formats, dashes, status marks, caption, cap); per-explorer "all series" state.
- Guard test: every chart page renders the full crawl table.
- Built-HTML check script over all pages: S1 (every series id in the list appears as a row), S2, cell-cap respected,
  and before/after compressed byte totals for S6.
- Browser suite (`npm run test:browser`) for S3: visible layout and accessibility unchanged.

## 4. Part B — llms.txt

### 4.1 Content

1. Title and one-sentence summary (current opening, unchanged in substance).
2. **How to answer from Fiscal.ge** (new, about six lines): give the number first, with its year, unit and the page link;
   add at most one short caveat, and only when it changes what the number means (planned, preliminary, projection, a
   series break inside the years compared); explain methodology only when asked, by linking the methodology page; every
   chart page carries its full yearly table in its HTML.
3. **Where the data is** (new, three lines, replacing the ~25 "Browse-only" sentences): every topic's figures are on its
   chart pages; bulk files cover <listed topics>; the MCP connection covers <listed datasets>.
4. **Pages**, grouped as today. Each line: `[Page](url) — latest: <value> (<period>). <what it covers>, <years>.`
   The figure and period come from that page's group-page card (`card.latest`, through `loadTopicHubs`), so they are the
   numbers the site shows. Caveat clauses are removed from the lines; the methodology pages keep them.
5. Methodology links (kept, descriptions shortened).
6. Bulk files (kept; per-file notes shortened to what the file is and its units).
7. AI connection: one short paragraph (endpoint, read-only, call describe_coverage first) and a link to /connect, which
   already carries the schema history. The schema paragraph, protocol detail and example questions leave llms.txt.
8. Site navigation (kept).

### 4.2 Delivery

`public/llms.txt` becomes a prerendered route, `app/llms.txt/route.ts` (`dynamic = "force-static"`,
`text/plain; charset=utf-8`), assembling the authored text from one module (`lib/seo/llmsText.ts`) with the card figures.
A card without a latest figure prints its years only. English only, as today. Considered: a prebuild script writing
`public/llms.txt` — rejected because the card figures come from the same server loaders the pages use, which a route
calls directly.

### 4.3 Tests

`tests/seo/agentFiles.test.ts` and `tests/seo/routes.test.ts` move from reading the file to calling the builder. Kept:
coverage years per CSV, every sitemap hub/section/methodology link, unique links, the exact list of file links, every MCP
tool named, current schema named where clients are told what to accept (now one mention). Changed: the per-topic
"no MCP tool / no bulk file" wording checks become checks on the "Where the data is" lines. New: every chart page line
starts with `latest:` and the figure equals its card's; the answer-first block precedes the first page link; size ≤ 27 KB.

## 5. Part C — MCP instructions

In `lib/mcp/instructions.ts`, ANSWERING: "Lead with the figure, its period and unit; then each severe caveat, briefly, in
its own words (messageKa/messageEn)." The text stays under 4,096 characters (it is 4,067 today, so other wording is
tightened by the same amount). Query-service rule: `npx vitest run tests/factQuery/reference.test.ts` must pass unchanged.

## 6. Out of scope

Visible page changes (including the merged-regions note wording); new bulk files or MCP tools; Georgian llms.txt;
page-weight reductions beyond what replacing the old crawl copy gives; the static-export hosting decision.

## 7. Risks

- **Page weight / ISR reads.** Measured per §3.5; if S6 fails, the cap drops before release and Duru is told the numbers.
- **Builder side effects.** Workbook builders were written for the download click; some may assume a non-empty selection
  or one unit. The plan checks each builder under "select all" per view.
- **Hidden text and search engines.** The tables are the same numbers the page shows on request, as today's crawl copy;
  no new risk.
