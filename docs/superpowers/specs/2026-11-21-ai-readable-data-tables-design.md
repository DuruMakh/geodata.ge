# Every page's data readable by AI (design)

Date: 2026-11-21, revised 2026-11-23 (§10: the block is off screen for visitors) · Owner: Duru · Branch: `claude/project-thread-fywkfr`

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
   (Revised by §10: in the page's HTML and accessibility tree, and off screen for a visitor.)
2. Nothing the page charts is left out of its HTML: series now cut by the cap and months now cut by the 36-month
   window follow in the same block.
3. The first 3,000 cells stay the most useful ones, so a short-window reader loses the least.
4. A visitor who reaches a page by a link inside the site sees the same block as one who loads it directly.

Non-goals: Product inflation (Duru's named exception: its data loads after the page opens and is not in the HTML), a
CSV or download link, new pages, changes to `/mcp` or `llms.txt` beyond wording that becomes untrue.

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

Revised 2026-11-23: Duru saw A, had not expected the pages to change, and chose C for how the block looks. §10 has the
decision, what was measured before building it, and what it gives up. The two tiers (§5.2) and everything about what
the block holds stand.

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

(The look below was built, shown to Duru and then replaced: §10. The block now has no visible styling.)

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
40,000 cells (30,000 until §5.5 put the largest page at about 30,300); past it the rest is cut from the end and its
caption says so. A cut window table's caption changes from
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

### 5.4 The monthly change on Inflation by category

The one dataset outside Duru's exceptions that was not in any page's HTML: every category's change on the previous
month (55 categories, monthly since 2004, 14,229 values). The page fetched it from a file when its monthly tab opened
(platform review item U13-03: the default tab never read it). A table needs the figures at build time, and a figure in
the page's HTML is a figure that travels with the page, so the premise of U13-03 no longer holds: the runs go back
into the page's own data, the fetch and its loading and error states go, and the monthly tab opens at once.

Its tables go to the fold, not to the first tables: three views of 36 months would pass the first tables' cap and cut
the annual rates. The fold opens with the monthly change over the same last 36 months, then the earlier months of the
contributions, the annual rates and the monthly change. `categoryCrawlStates(index, "earlier")` returns those four.

Considered and not built: keeping the fetch and writing the monthly tables from a server component (its HTML would
sit in the page twice, once as markup and once in the framework's payload, more than the runs themselves); reading the
file inside the client component during the build (works around the framework, and a silent break would only show as a
missing table).

### 5.5 Words (Georgian for Duru's proofread)

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
   scroll, and appears after a client-side navigation with the new page's figures. (Replaced by §10.4.)
5. `npm run check`, `npm run build`, the browser suite and `crawl:check` pass. Site gzip stays under its ceiling.
6. After release: Claude's fetch and Gemini answer the same questions from the live pages.

## 8. Left out, said plainly

- **Product inflation**: Duru's named exception, and now the only data the site charts that no page prints. The page
  loads its 610 product runs after opening (about 250 KB compressed), so none are in the HTML.
- Trade products and domestic exports by product, the other named exception, are on their pages whole: 1,079 export
  and 1,185 import products for 2020 to 2025, most of them in the folded rest.
- **A reader with a short window, on the five largest pages** (ten with both languages). Their folded rest runs past
  40,000 characters, so such a reader gets the first tables and stops: Trading partners (the 23 largest partners of
  each measure, every year; 185 to 210 partners have figures), Services trade (the 79 or 80 largest of 104 to 146
  countries), Inflation by category (contributions and annual rates from January 2024 and the first divisions' monthly
  change; the other monthly changes and the months back to 2004 follow), Trade products and Domestic exports
  (individual products, Duru's exception). A reader that takes the whole page gets all of it. Only more pages
  would close this for the partner countries (one page per country, as the regions have); that is a new page type and
  needs Duru's approval, so it is not in this change.
- **Page weight.** The folded rest is paid for in HTML size on the pages that have one (compressed, live then built,
  Georgian pages): Inflation by category 135 to 231 KB (167 before the monthly change joined it; of the last 64 KB,
  36 are the monthly runs that used to load when their tab opened), Trading partners 173 to 203 KB, Trade products
  194 to 258 KB, Inflation overview 42 to 45 KB. The whole site grows 1.2%. The two inflation size limits in the
  browser specs rise to match.

## 9. Results (2026-11-21, production build of this branch)

- `npm run crawl:check`: 1,466 pages carry a data table, none hidden or out of view; 294,734 cells in the first
  tables and 446,186 in all; site gzip 55,037,916 bytes (1.2% over the build without the block, ceiling 62,535,000).
- Replay of the measured reader over all 1,556 built pages: the first tables end inside the 40,000-character window on
  1,466 of 1,466 pages, and 1,456 pages fit whole.
- Fresh agents given only the replayed text of 24 pages (Georgian and English, heavy and light): the smallest model
  found 104 of 104 figures named by caption, row and column, and answered "not in the text" for the five that lie past
  the cut. Two models answered 19 ordinary questions (38 of 38), among them education spending in 2017 (1,177.8 million
  GEL, 2.8% of GDP), Khulo's pupils (3,936 and 2,075), annual inflation in June 2015 (4.5%) and Kvareli's population in
  2020 (30,318); both said exports to Japan in 2019 are not printed in the cut text and derived them from total trade
  less imports. On the final build three more answered 12 of 12, two of them reading whole pages of 190,000 and
  250,000 characters (exports to Japan in 2019: 0.012 billion USD, in the folded rest; transport inflation in March
  2010: 13.2%). After §5.4, three more read Inflation by category (the whole English and Georgian pages, 330,000 and
  350,000 characters, and the cut English text) and answered 11 of 11: the change on the previous month for transport
  in March 2010 (−0.3%), education in September 2004 (2.0%) and food in May 2025 (1.6%, which the cut text also
  holds), and "not in the text" for March 2010 in the cut text.
- The real reader on today's live site keeps a visible table inside a `role="region"` scroller as a text table and
  prints its `<caption>` as a line above it. The block itself can only be fetched once it is live (criterion 6).
- What the agents found hard, and what was done: the two notes of a cut table did not add up ("top 79 of 153" beside
  "the other 25"), fixed in §5.2; tables of 31 to 37 year columns need the columns counted, and sibling tables differ
  by one word of their caption (left as is: every answer was right).
- Found on the screenshots, now that people see the tables too: the rule that keeps a small amount from printing as
  zero also gave rates a false precision (annual inflation of 0.0037% in January 2024, where the chart says 0.0%).
  It now applies to amounts only; a percentage or a signed change keeps its format's decimals (DESIGN.md §8.4).

## 10. Off screen for visitors (owner decision, 2026-11-23)

Duru saw the visible block and had not expected the pages to change ("So UI is changing?", 2026-11-22). One card
offered three looks: keep it visible; one closed line that a visitor opens; hidden from visitors by styling. On
2026-11-23 16:41 Tbilisi Duru chose the third: "That styling option but please test that it's working". The card said
what it costs: pages do not change, Claude and Gemini read the tables, an AI that looks at the screen does not, and
screen readers read out every table.

### 10.1 Measured before building

The real Claude reader (web fetch) on the live Expenditure page, 2026-11-23: text that a stylesheet class hides came
back (the chart's `sr-only` figcaption "Total expenditure, 2026: 30.9 bn (Planned)", the `sr-only` caption of the
period comparison, the skip link), and the tables under the `hidden` attribute did not (1,177.8 and 2,626.5 absent).
Hiding by stylesheet is safe for that reader; hiding by attribute is not (§2).

### 10.2 Approaches

| | 1. The `sr-only` class on the wrapper | 2. The same declarations on the block's own class | 3. `display: none` from the stylesheet |
| --- | --- | --- | --- |
| The HTML | gains a class that names the hiding | what was tested on 2026-11-21, but for two `tabindex` attributes | unchanged |
| Readers of the HTML | keep it (measured), unless one drops known hiding class names | keep it | keep it |
| Accessibility tree and the page's text in a browser (`innerText`) | kept | kept | dropped |
| A visitor | sees nothing | sees nothing | sees nothing |

**Chosen: 2.** The HTML the readers were tested on stays as it was, nothing in it says "hidden", and the tables stay in
the accessibility tree and in the page's text, so a screen reader and an assistant that reads either of those still
get them. 3 takes them away from both.

### 10.3 Design

- `globals.css`: the block's visible styling goes (151 lines). One rule on `.crawl-tables` carries the declarations of
  Tailwind's `sr-only` (`position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap`). A page is laid out as if its blocks were not there.
- The tables are laid out, only clipped, on every device. The first build of this section kept the visible version's
  `content-visibility: auto` on the block, and the test of 2026-11-23 found what that costs: the browser's own text of
  the page (`document.body.innerText`) holds none of its tables (0 of 1,190 first cells on Expenditure; all 1,190
  without it). An assistant built into a browser reads that text, so the property went. The second build kept it for
  touch devices (`@media (pointer: coarse)`) to spare a phone the layout, on the belief that the tables are laid out
  once the block nears the viewport. They are not: a clipped 1px box never counts as near, and after scrolling to the
  block the page's text still held none of them (0 of 1,416 first cells on Trading partners). So the property is gone
  on every device, and a phone's browser gives an assistant the same text as a computer's.
- What laying the tables out costs a phone (phone viewport, touch, CPU slowed 4x, median of five loads, against a
  block under `display: none`): main-thread work while the page loads +0.50 s on Inflation by category, +0.32 s on
  Trading partners, +0.51 s on Marriages and divorces, +0.25 s on Expenditure, and under 0.1 s on a region page and on
  Government debt; of that, time blocked by long tasks +0.06, +0.13, +0.14 and +0.06 s on the four heavy pages; first
  paint unchanged. 20 pages hold 2,000 cells or more in their first tables, 40 hold 1,000 or more, and the median page
  holds 186. A tap on a series afterwards costs the same either way (same phone, median of 12 taps, tap to second
  frame: 242 and 257 ms laid out against 250 and 266 ms under `display: none` on Trading partners, 130 and 148 against
  130 and 141 ms on Expenditure).
- `crawlBlockHtml`: the region loses `tabindex="0"` (nobody scrolls it now) and the summary of the fold gets
  `tabindex="-1"`, so no keyboard stop sits where a sighted visitor sees nothing. A screen reader still reads the
  region, its tables, and opens the rest.
- `llms.txt` says the "Data table" is in the page's HTML and not drawn on screen.
- Everything else stands: the two tiers and their caps, the words, the block a page builds when it is opened by a link
  inside the site, `crawl:check`'s failures (an attribute that hides the block or an ancestor).

### 10.4 Success criteria (4 is replaced; 1 to 3, 5 and 6 stand)

4. In a browser, every block is a clipped 1px box out of the page's flow; removing the blocks changes neither the
   width nor the height of a page; nothing inside a block takes the Tab key; axe passes; each block's tables are in
   the page's `innerText`, on a touch device too; a page opened by a link inside the site carries
   the block the server writes for it.
7. Sampled pages look the same, pixel for pixel, with the blocks and with them removed, and against a build of `main`.
8. The reader's text of every built page is what it was on the build of 2026-11-21 (only `llms.txt` and the two
   `tabindex` attributes changed), and fresh agents answer from it again.
9. The real Claude reader on the Vercel preview, if a share link lets it in; after release, the real reader and Gemini
   on live pages (criterion 6).

### 10.5 What it gives up, said plainly

- **An AI that reads the screen** (screenshots, computer use) sees no table. An assistant that takes the page's text
  or its accessibility tree from a browser, on a computer or a phone, still gets the first tables, and the folded rest
  only if it opens it.
- **A slow phone** does 0.25 to 0.5 s more work while one of the 20 heaviest pages loads (§10.3). What it paints
  first does not change.
- **Screen reader users** meet a "Data table" region with every table on each chart page. It is a named region, so it
  can be skipped, and it holds the chart's own data.
- **Search engines.** Text kept for assistive technology is allowed, and these tables repeat what the chart draws. If
  it were ever read as hidden text, the fallback is approach B of §4: one closed line that opens.

### 10.6 Results (2026-11-23, production build of this branch)

- **A visitor's page against `main`.** A full-page screenshot of each of the 1,466 pages with a block, at a phone
  viewport with touch and at a computer viewport (2,932 page views), on this build and on a build of `main`: 2,929
  pairs are byte-identical. The other three are computer views of pages with the wide heat map (Wages by industry in
  both languages, the Georgian Age and sex), and the capture makes the difference, not the page: a full-page
  screenshot in headless Chromium at times shrinks the window to 1x1 and back, and the heat map, which opens at its
  newest years, then stands a few columns to the left (14 and 15 of 24 captures on this build, 0 and 1 of 24 on
  `main`, 0 of 24 with the blocks removed). With a viewport as tall as the page and an ordinary screenshot, the six
  heat-map pages equal `main` in 18 of 18 computer captures and 16 of 18 phone captures, and `main` against itself
  differs as often on a phone (5 of 12). After a visitor's own resize (a narrower and a wider window, a phone turned
  and back) the heat map stands at the same place on both builds.
- **With the blocks and with them removed**, on the build before the last fix: 2,929 of 2,932 full-page screenshot
  pairs identical at the first pass. One of the three was the tool (its second capture did not wait for a phone's
  series list; identical in 3 of 3 runs once it did); two differ in one pixel by 1/255 of one colour channel, as two
  captures of the unchanged page also do (7 of 12 on the English Wages by industry).
- **Every block in a browser** (the same 2,932 page views): each of the 3,588 blocks is a clipped 1px box out of the
  page's flow, no ancestor hides it, nothing inside takes the Tab key, its `content-visibility` is `visible`, and the
  page's `innerText` holds its tables, on 1,466 of 1,466 phone views and 1,466 of 1,466 computer views.
- **Readers of the HTML.** `npm run crawl:check` passes: 1,466 pages, 294,734 cells in the first tables and 446,186
  in all, site gzip 55,031,659 bytes. The replayed reader text of all 1,557 built pages, whole and cut at 40,000
  characters, is byte for byte that of the final build of 2026-11-21, so §9 stands for this build.
- **Other kinds of reader, 20 pages** (10,689 distinct cells in their first tables, 2,469 in the folded rest). Two
  HTML-to-text converters keep every cell of both. The browser's page text and its accessibility tree, on a computer
  and on a touch phone, keep every first cell on 20 of 20 pages; of the folded rest they hold only what the page
  prints elsewhere too (36%), because a closed `<details>` is in neither until it is opened. Find-in-page finds a
  table's figure on 19 of 19 pages. Article extraction (Mozilla Readability) keeps every first cell on 18 of 20.
- **Fresh agents, 8 readers and 190 answers, none wrong.** On the build before the last fix: the smallest model with
  the cut reader text (23 of 23 figures named by caption, row and column), two with the browser's page text (31 of 31
  and 29 of 29), one with the accessibility tree (33 of 33), and a larger model answering ordinary questions from the
  page text (11 of 11). On this build, from a touch phone's page text: two of the smallest model (25 of 25 each, among
  them "not in the text" for two figures that lie in the fold) and a larger one on ordinary questions (13 of 13: VAT
  in 2019 was 5,239.0 million GEL and 10.5% of GDP, Batumi had 169,095 people at the start of 2020 and 2,952 births
  in 2022, unemployment at 20 to 24 was 41.0% in 2021, exports to Azerbaijan in 2023 were 0.862 billion USD). With
  §9, 24 readers and 355 answers.
- **Gates.** `npm run check` passes (8,152 unit tests, 46 data checks, the translation check) and so does the build.
  The whole browser suite against this build in a cloud session: 2,630 of 2,633 pass. Two fail there on `main` as well
  and pass in CI (`mobile-fit-charts.spec.ts:345` on the English Kindergartens page, `seo.spec.ts:460`, the styled
  sitemap view). One passed on its retry: `debt.spec.ts:326`, Back and Forward on the debt page. Its code path
  (`use-hash-state.ts`) is `main`'s byte for byte, and repeated alone it passes 200 of 200 on this build and 200 of
  200 on `main`, half of each with the machine kept busy.
- **What the tests found, both fixed before release** (§10.3): `content-visibility: auto` on the block took its tables
  out of the page's text, first everywhere and then, kept for touch devices only, on phones and tablets.
- **Found, not fixed.** Article extraction keeps every first-table cell on 1,324 of the 1,386 chart pages measured and
  almost none on 62, where it takes another part of the page for the article (the region pages of the regional
  economy, Causes of death, Trading partners and a dozen others). It does the same with the block visible, so it is
  not a cost of this section, and nothing in the page's HTML is missing for it.

## 11. The release's date in the page list (owner decision, 2026-11-25)

A day after the release Gemini's page tool still answered for some pages from a copy saved before it: Schools came
back with the latest year only and Khashuri as the old page, while Trading partners, Expenditure and Debt came back
current (2026-11-24). The tool reads Google's saved copy of a page before it fetches the live one (its documentation:
it "first attempts to fetch the content from an internal index cache"). The sitemap is how a site tells Google that a
page has changed, and its `lastmod` was each page's data review date (`docs/deployment.md`, SEO and headers). The
release changed 1,466 pages and no figure, so no date moved. One card asked Duru whether the changed pages should
carry the release's date, and on 2026-11-25 00:46 Tbilisi the answer was "Okay do it". What the card promised: the
page list gets the 23 November date for the changed pages, visitors see no difference, one small release.

### 11.1 Measured before building

The live site on 2026-11-24 against the copy of it saved on 2026-11-20:

- The sitemap lists 1,556 URLs, one for each HTML page. Its newest `lastmod` is 2026-10-24: every date in it is older
  than the release.
- 1,466 pages carry the block, and the text of every one differs from its copy of 2026-11-20. The other 90 are word
  for word the same, with the same title, description, structured data and links: the home page, About, Connect,
  All data, the eight group pages, Analysis, Product inflation, Methodology and its 31 articles, in both languages.
- "Under `/explorer/`, but not a group page, Analysis or Product inflation" names exactly the 1,466: the rule and the
  HTML agree on 1,556 of 1,556 URLs.
- The release's production deployment became ready on 2026-11-23 at 16:19:19 UTC (Vercel).
- Google's rule for `lastmod` (Search Central, "Build and submit a sitemap"): it uses the value when it is
  consistently and verifiably accurate, the value is the date and time of the last significant update to the page,
  and a change to the main content is one. It ignores `changefreq` and `priority`.

### 11.2 Approaches

| | 1. The release's moment on the pages it changed | 2. The build's date on every URL | 3. Each page's date from a stored hash of its HTML |
| --- | --- | --- | --- |
| What a search engine is told | 1,466 pages changed on 23 November; a later review of a page's data overtakes it | every page changes at every release | the pages whose HTML changed, at every release |
| True | yes | no: most releases change a few pages, and Google sets aside a `lastmod` it finds unreliable | yes |
| Cost | one date and one rule, moved by hand when a release again rewrites every chart page | none | a committed file of 1,556 hashes that every data import and every layout change rewrites, and a build step that keeps it |

**Chosen: 1**, the card's option. 3 is the general answer to a question that has come up once.

Not built: asking Google page by page in Search Console, which is done by hand, a few pages a day.

### 11.3 Design

- `lib/seo/sitemap.ts` gains `DATA_TABLES_LIVE_AT`, 2026-11-23 16:20 UTC: the minute after the deployment was
  ready, so a copy fetched before it is older than the page. It also gains `withDataTablesRelease(entries)`: an entry
  whose page carries the data tables gets the later of its own `lastModified` and that moment, and every other entry
  passes through untouched. The page's Georgian address decides (`splitLanguagePath`), so a language pair keeps one
  date.
- `app/sitemap.xml/route.ts` publishes `withDataTablesRelease(await sitemap())`.
- `sitemap()` does not change. It still dates each URL by the data the page shows, and the tests that pin those dates
  (each municipality, each region, each topic, each group page) stay as they are. Applied inside `sitemap()`, the
  release date would make every one of those tests read the same date until the data is next reviewed.
- Nothing on a page changes. The "Updated" date in a page's header and its `dateModified` keep saying when the
  figures were last reviewed: that is the dataset's date, and the sitemap's is the page's.
- The date fades by itself: a page whose data is reviewed after the release carries that review's date again.

### 11.4 Reuse

As is: `sitemap()`, `serializeSitemapXml`, `splitLanguagePath`, `NAV_GROUPS`. Small addition: one constant and one
function in `sitemap.ts`, one call in the route. New: nothing.

### 11.5 Success criteria

1. The published sitemap gives each of the 1,466 pages `2026-11-23T16:20:00.000Z` and leaves the other 90 on the
   dates they have today. Both languages of a page carry one date. The URLs, their order and their language links do
   not change.
2. A page whose data is reviewed after the release keeps that later date.
3. No page's HTML changes.
4. `npm run check` and `npm run build` pass.
5. After release `https://fiscal.ge/sitemap.xml` shows the dates, and the one check already set for 2026-12-01 asks
   Gemini for Schools by its ordinary address.

### 11.6 What it does not do

- It does not make Google read anything. `lastmod` is a hint: Google fetches the sitemap, and then the pages, when it
  chooses to.
- It changes nothing for a reader that fetches the live page each time, as Claude's does.
- It does not move the point, about 50,000 characters into a page, at which Gemini stops reading (§8).

### 11.7 Results (2026-11-25, before release)

- **The file the route writes against the live sitemap.** 1,556 URLs in both, in the same order, and everything but
  the dates is identical, language links included. 1,466 dates read `2026-11-23T16:20:00.000Z` and 90 are unchanged:
  the 45 addresses of §11.1 in both languages. No date is earlier than before, and each English URL carries its
  Georgian twin's date. The group pages now carry an older date than the pages they list, which is true of them: the
  release did not change a group page.
- **Tests.** Six new ones in `tests/seo/sitemapDataTablesRelease.test.ts`, one of them on the XML the route returns.
  Each of four deliberate breaks of the rule fails at least one: the date on every page, the date over a later
  review, an English address not recognised, the group pages not excepted. The 31 tests of the four existing
  sitemap files pass unchanged.
- **Pages.** `lib/seo/sitemap.ts` is imported by the sitemap route and by tests only, so no page is built from it.
- **Gates (2026-11-26).** `npm run check` passes (8,158 unit tests, 46 data checks, the translation check) and so
  does the build. Its `out/sitemap.xml` is byte for byte the file compared above, and `npm run crawl:check` passes on
  it.
