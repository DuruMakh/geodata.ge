# Every page's data readable by AI (design)

Date: 2026-11-21 · Owner: Duru · Branch: `claude/project-thread-fywkfr`

## 1. Why

Duru asked claude.ai for Georgia's education spending as a share of GDP. Claude opened the fiscal.ge Expenditure page,
saw one small table, and answered from the World Bank instead. The audit of all 1,556 live pages (2026-11-21, report
"Can AI read fiscal.ge's numbers?") found the cause: 1,426 chart pages do carry every series and every year as tables
(PR #231), but inside `<div hidden data-testid="crawl-tables">`, and Claude's web reader drops every element that
carries the `hidden` attribute. Google's Gemini reads them; ChatGPT and Perplexity could not be tested.

Duru's decision (2026-11-21, 17:13 Tbilisi): no CSV link. **Every figure the site has must be plainly readable on the
page itself when an AI visits**, "like on the regions pages". The only exceptions allowed for now are Product inflation
and individual-product import/export data, because there are too many of them. Build it and test it with fresh agents.

## 2. What readers keep (measured on production, 2026-11-21)

| Markup | Claude web fetch | Gemini `url_context` |
| --- | --- | --- |
| Ordinary visible `<table>` | kept, as a text table | kept |
| Content of a closed `<details>` | kept (methodology pages) | kept |
| Class-only hiding (`sr-only`) | kept | kept |
| Any subtree with the `hidden` attribute | **dropped** | kept |
| `<script>` (JSON-LD, page data) | dropped | not relied on |

Claude's fetch in this environment also passes on only about the first 40,000 characters of a page word for word (a
sitemap came back 39,956 of 81,512; a CSV 39,935 of 67,699). Replaying that on the 1,426 pages with their tables
unhidden: all but six had their first 3,000 cells inside it (the six are Trade products, Services trade and Trade
partners, in both languages, whose long labels make 3,000 cells run past it). The first tables are therefore held to a
count of characters as well as of cells (§5.2); what follows them on a page reaches only readers with a longer window.
Whether claude.ai's own fetch stops at the same point could not be measured from here.

Readers that render the page first (in-browser assistants, screenshot agents) only see what a visitor sees.

## 3. Goals, non-goals, anti-goals

Goals
1. On every chart page and map page, the tables are ordinary visible content that every kind of reader keeps.
2. Nothing the page charts is left out of its HTML: series now cut by the cap and months now cut by the 36-month
   window follow in the same block.
3. The first 3,000 cells stay the most useful ones, so a short-window reader loses the least.
4. A visitor who reaches a page by a link inside the site sees the same block as one who loads it directly.

Non-goals: Product inflation and the category monthly change (their data loads after the page opens and is not in the
HTML), a CSV or download link, new pages, changes to `/mcp` or `llms.txt` beyond wording that becomes untrue.

Anti-goals: a block that makes chart pages feel heavier or longer to people, a second copy of the numbers in the page
payload, a parallel table component beside `CrawlTables`.

## 4. Approaches

| | A. Visible block | B. Closed `<details>` only | C. Visually hidden (`sr-only`) |
| --- | --- | --- | --- |
| Claude, Gemini, raw-HTML readers | read it | read it | read it today |
| Readers that render the page | read it | miss it until opened | miss it |
| Search engines | ordinary content | may count for less | risks reading as hidden text |
| People | one compact scrolling table per chart | one line to open | nothing; screen readers get an unannounced wall |

**Chosen: A for the first 3,000 cells, B for what follows them.** A is the only option every kind of reader keeps, and
it is what Duru described. The rest of a large page (the other trade partners, earlier inflation months) goes in a
closed `<details>` inside the same block: it costs a visitor no rendering until opened, and the readers measured in §2
keep it. C is rejected: it hides content from people on purpose, which is the pattern that just failed in another form.

## 5. Design

### 5.1 The block

`CrawlTables` and `IndexCrawlTables` keep their place (last child of the explorer root or section) and their
`data-testid="crawl-tables"`. The `hidden` attribute goes; the wrapper gets the class `crawl-tables`. Its inner HTML,
still one server-built string, becomes:

```html
<p>Data table</p>
<div role="region" aria-label="Data table: {first caption}" tabindex="0">
  <table>…</table> …                                    <!-- the first 3,000 cells, as today -->
  <details><summary>The rest of the data</summary>     <!-- only when something follows -->
    <table>…</table> …
  </details>
</div>
```

The `<table>` markup itself does not change. Nothing inside carries a class: `globals.css` styles the block through
`.crawl-tables` descendant selectors, and `.crawl-tables:empty` takes no space (a section with nothing to show). The
label is a paragraph, not a heading, so a page with several blocks keeps its heading outline, and the region's name
carries its first caption so two blocks on one page do not share a name (both decided while building).

Look (DESIGN.md v4.1, no cards, shadows or gradients): the period-comparison rhythm (`36px` above, a hairline rule,
`24px` padding), an overline label (11px, 600, muted), then one scrolling region at most `26rem` tall that scrolls
both ways and is a keyboard stop with a visible focus ring. Tables follow `ExplorerTable`'s anatomy: caption as a
13px/600 ink line, header row with a 2px ink rule that stays in view, hairline-soft row rules, numerals in the numeric
face, right-aligned, and a first column that stays in view on the paper background, narrower on phones. The tables open
at their earliest period.
`content-visibility: auto` keeps the block from costing layout until it nears the viewport.

### 5.2 Two tiers

`crawlTables()` returns the window tables exactly as today (3,000 cells split across the views; a table over its share
keeps its totals and largest series), then **rest tables**: for each table that was cut, its other series in workbook
order, and after those the page's **earlier-period models** in full. A page holds at most `CRAWL_PAGE_CELL_CAP` =
30,000 cells; past it the rest is cut from the end and its caption says so. A cut window table's caption changes from
"all of them in the Excel download" to "the others follow below" when its rest table is complete. The note counts
the series that have a figure, so "top 23 of 185" and the rest table's "the other 162" add up; a table that leaves out
only series without any figure is complete and gets no note.

The first tables are also held to 30,000 characters of text as a reader prints them (`CRAWL_WINDOW_CHARS`,
`crawlReaderChars`): the 40,000-character window of §2 less the 10,000 a page spends above its tables. Where the cell
cap alone would run past that (the trade pages, with their long labels), the tables' share of cells shrinks until
their text fits, and the series that no longer fit move to the rest tables.

Monthly pages (Inflation overview, by category, by city, each city): `useCrawlModels` takes a second, optional builder
for the earlier periods. Their crawl-state functions take a `months` argument (`"latest"` or `"earlier"`): the same
views over everything before the 36-month window. The window tables do not change.

Map pages: `indexHistoryTables` keeps its `maxCells` trim for the window and returns the years it cut as rest tables.

### 5.3 A page opened by a link inside the site

The server writes the block; hydration keeps it without rebuilding (unchanged, it saved the heaviest pages over half a
second). A page mounted in the browser has no server HTML, so `useCrawlModels` builds the models once the browser is
idle, and only then. It tells the two cases apart with `useSyncExternalStore`'s server snapshot. `IndexCrawlTables`
receives its tables as props, so it writes the same string on both sides; `RegionIndex` stops guarding its tables with
`typeof window`.

### 5.4 Words (Georgian for Duru's proofread)

| Key | English | Georgian |
| --- | --- | --- |
| `controls.crawlHeading` | Data table | მონაცემთა ცხრილი |
| `controls.crawlRest` | The rest of the data | დანარჩენი მონაცემები |
| `controls.crawlTopMore` | top {kept} of {of}; the others follow below | უდიდესი {kept} {of}-დან; დანარჩენი — ქვემოთ |
| `controls.crawlOthers` | the other {count} | დანარჩენი {count} |

## 6. Reuse

- As is: every explorer's workbook builders and crawl states, `crawlCaption`, `formatCrawlCell`, `crawlTablesHtml`,
  `indexCrawlTables.ts` builders, the 56 `useCrawlModels` call sites, `npm run crawl:check`.
- Small additions: `CrawlTables` / `IndexCrawlTables` (visible wrapper, block HTML), `useCrawlModels` (browser build,
  optional earlier builder), `crawlTables` (rest tables), the three inflation crawl-state functions (earlier ranges),
  `indexHistoryTables` (rest years), `check-crawl-tables.ts` (visible wrapper, page cap, reader-window report).
- New: one CSS block in `globals.css`; four messages per language. No new component.

Considered and not built: a new `DataTable` component (`CrawlTables` already owns this markup and its hydration
contract); rendering the tables with `ExplorerTable` (it is a client table for the selected series, with sorting state,
and would rebuild 3,000 cells during hydration).

## 7. Success criteria (on a production build)

1. No crawl-tables wrapper, and no ancestor of one, carries `hidden`, `aria-hidden`, `inert` or `display:none`
   (`crawl:check` fails otherwise). Every page that had tables still has them, cell for cell, in the window.
2. A replay of the measured reader (drop `hidden`, 40,000 characters) over every built page shows the first tables
   whole on every page; `crawl:check` prints the count and names any page that fails it.
3. Fresh agents given only that replayed text answer the test questions: education spending as % of GDP by year,
   Khulo's pupils 2015/16 and 2025/26, a trade partner outside the old top 23, a 2015 inflation month.
4. In a browser: the block is visible, keyboard reachable, passes axe, fits a 390px phone with no page-level sideways
   scroll, and appears after a client-side navigation with the new page's figures.
5. `npm run check`, `npm run build`, the browser suite and `crawl:check` pass. Site gzip stays under its ceiling.
6. After release: Claude's fetch and Gemini answer the same questions from the live pages.

## 8. Left out, said plainly

- **Product inflation** (the page loads its data after opening) and the **monthly change by category**: Duru's named
  exception and the one similar case; both need the data in the page first.
- Trade products and domestic exports by product are included as far as the 30,000-cell page cap allows; the cap note
  names any remainder.
- **A reader with a short window, on the five largest pages** (ten with both languages). Their folded rest runs past
  40,000 characters, so such a reader gets the first tables and stops: Trading partners (the 23 largest partners of
  each measure, every year; 185 to 210 partners have figures), Services trade (the 79 or 80 largest of 104 to 146
  countries), Inflation by category (January 2024 onward; the months back to 2005 follow), Trade products and Domestic
  exports (individual products, Duru's exception). A reader that takes the whole page gets all of it. Only more pages
  would close this for the partner countries (one page per country, as the regions have); that is a new page type and
  needs Duru's approval, so it is not in this change.
- **Page weight.** The folded rest is paid for in HTML size on the pages that have one (compressed, live then built,
  Georgian pages): Inflation by category 135 to 168 KB, Trading partners 173 to 203 KB, Trade products 194 to 258 KB,
  Inflation overview 42 to 45 KB. The whole site grows 1.0%. The two inflation size limits in the browser specs rise
  to match.

## 9. Results (2026-11-21, production build of this branch)

- `npm run crawl:check`: 1,466 pages carry a data table, none hidden or out of view; 294,734 cells in the first
  tables and 417,410 in all; site gzip 54,904,051 bytes (1.0% over the build without the block, ceiling 62,535,000).
- Replay of the measured reader over all 1,556 built pages: the first tables end inside the 40,000-character window on
  1,466 of 1,466 pages, and 1,456 pages fit whole.
- Fresh agents given only the replayed text of 24 pages (Georgian and English, heavy and light): the smallest model
  found 104 of 104 figures named by caption, row and column, and answered "not in the text" for the five that lie past
  the cut. Two models answered 19 ordinary questions (38 of 38), among them education spending in 2017 (1,177.8 million
  GEL, 2.8% of GDP), Khulo's pupils (3,936 and 2,075), annual inflation in June 2015 (4.5%) and Kvareli's population in
  2020 (30,318); both said exports to Japan in 2019 are not printed in the cut text and derived them from total trade
  less imports. On the final build three more answered 12 of 12, two of them reading whole pages of 190,000 and
  250,000 characters (exports to Japan in 2019: 0.012 billion USD, in the folded rest; transport inflation in March
  2010: 13.2%).
- The real reader on today's live site keeps a visible table inside a `role="region"` scroller as a text table and
  prints its `<caption>` as a line above it. The block itself can only be fetched once it is live (criterion 6).
- What the agents found hard, and what was done: the two notes of a cut table did not add up ("top 79 of 153" beside
  "the other 25"), fixed in §5.2; tables of 31 to 37 year columns need the columns counted, and sibling tables differ
  by one word of their caption (left as is: every answer was right).
- Found on the screenshots, now that people see the tables too: the rule that keeps a small amount from printing as
  zero also gave rates a false precision (annual inflation of 0.0037% in January 2024, where the chart says 0.0%).
  It now applies to amounts only; a percentage or a signed change keeps its format's decimals (DESIGN.md §8.4).
