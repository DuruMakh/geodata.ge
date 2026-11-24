# AI-readable data tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every chart page and map page shows its full data as an ordinary visible table block that AI readers keep, with the rest of a large page folded below it.

**Architecture:** `CrawlTables` / `IndexCrawlTables` stop writing a `hidden` wrapper and write one server-built block (heading, scrolling region, window tables, a closed `<details>` with the rest). `crawlTables()` gains a second tier for the series and periods the 3,000-cell window cuts. `useCrawlModels` builds in the browser only for a page that was not server-rendered into the document.

**Tech Stack:** Next.js 16 static export, React 19.3, strict TypeScript, Tailwind v4 with unlayered rules in `app/globals.css`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-ai-readable-data-tables-design.md`

## Global Constraints

- All commands run in `apps/web`. While editing run only the named test file; the full gates run once, in Task 8.
- The `<table>` markup `crawlTablesHtml` writes does not change, and nothing inside the wrapper carries a class or style.
- `CRAWL_CELL_CAP` stays 3,000 (the window). `CRAWL_PAGE_CELL_CAP` = 30,000 (window plus rest); Task 9 raises it to 40,000.
- Words, exactly: `controls.crawlHeading` "Data table" / "მონაცემთა ცხრილი"; `controls.crawlRest` "The rest of the data" / "დანარჩენი მონაცემები"; `controls.crawlTopMore` "top {kept} of {of}; the others follow below" / "უდიდესი {kept} {of}-დან; დანარჩენი — ქვემოთ"; `controls.crawlOthers` "the other {count}" / "დანარჩენი {count}".
- No new component, no new dependency, no gradients, cards or shadows (DESIGN.md §17).
- Hydration never rebuilds the tables.

## Review Focus

1. A page reached by a link inside the site: the block must appear with that page's figures, not the previous page's and not empty.
2. A section with nothing to show (empty models): no heading, no rule, no gap.
3. A 390px phone: the block scrolls inside itself; the page never scrolls sideways.
4. Keyboard and screen reader: the scrolling region is a named tab stop with a visible focus ring; axe finds nothing.
5. Browser specs that assumed the only visible `<table>` is the page's own: they must scope to their table, not be skipped.

---

### Task 1: Two tiers and the block's HTML

**Files:** Modify `lib/explorer/crawlTables.ts`, `lib/i18n/messages/{en,ka}/controls.json`. Test `tests/explorer/crawlTables.test.ts`.

**Interfaces — produces:**
- `export const CRAWL_PAGE_CELL_CAP = 30_000`
- `CrawlTable` gains `rest?: true`
- `crawlTables(models, messages, earlier: readonly WorkbookExportModel[] = []): CrawlTable[]` — window tables first (unchanged for uncut input), then rest tables flagged `rest: true`
- `crawlBlockHtml(tables: readonly CrawlTable[], labels: { category: string; heading: string; rest: string }): string` — `""` for no tables

- [ ] Tests first, in `describe("crawlTables")` and a new `describe("crawlBlockHtml")`:
  - a cut table is followed by a rest table holding exactly the dropped rows in workbook order, caption `<caption> · the other 7`; the window caption ends `top 3 of 10; the others follow below`
  - `earlier` models come last, whole, flagged `rest`, and take no share of the window
  - past `CRAWL_PAGE_CELL_CAP` the rest is cut from the end and the window caption keeps `controls.crawlTop`
  - `crawlBlockHtml([])` is `""`; one window table gives `<p>Data table</p><div role="region" aria-label="Data table: {caption}" tabindex="0"><table>…</table></div>`; a rest table adds `<details><summary>The rest of the data</summary><table>…</table></details>` before `</div>`; heading text is escaped
- [ ] Run `npx vitest run tests/explorer/crawlTables.test.ts` — the new tests fail.
- [ ] Implement. The window pass is today's loop, recording each cut table's dropped rows; the rest pass spends `CRAWL_PAGE_CELL_CAP` minus the window's cells in order (cut tables, then `earlier`).
- [ ] Run the file — passes. Commit.

### Task 2: The visible wrapper and the browser build

**Files:** Modify `components/explorer-shell/crawl-tables.tsx`, `components/explorer-shell/index-crawl-tables.tsx`, `components/regional-economies/regional-economies-index.tsx`. Test `tests/explorer/crawlTablesComponent.test.tsx` (and the index tests that pin the wrapper string).

**Interfaces — produces:**
- `type CrawlModels = { models: readonly WorkbookExportModel[]; earlier: readonly WorkbookExportModel[] }`
- `useCrawlModels(build, buildEarlier?): CrawlModels` — server: both built; hydration: empty forever; browser mount: empty, then built when idle
- `<CrawlTables models={CrawlModels} />` renders `<div data-testid="crawl-tables" class="crawl-tables">` + `crawlBlockHtml`
- `<IndexCrawlTables tables category />` writes the same block on server and browser

- [ ] Update the component test: the exact wrapper string without `hidden`; "carries no class or style inside the wrapper" still holds; the empty wrapper is `<div data-testid="crawl-tables" class="crawl-tables"></div>`; with `window` stubbed the first render is empty and `build` is not called during render.
- [ ] Run it — fails. Implement (hydration is told apart with `useSyncExternalStore(subscribe, () => false, () => true)` captured in `useState`; the browser build runs from an effect through `requestIdleCallback` with a `setTimeout` fallback). Run — passes.
- [ ] `RegionIndex`: build `tables` on both sides (drop the `typeof window` guard). Run `npx vitest run tests/explorer/regionalEconomiesIndex.test.tsx tests/explorer/indexCrawlTables.test.ts` and fix the pinned wrapper strings.
- [ ] `npm run typecheck`. Commit.

### Task 3: The look

**Files:** Modify `app/globals.css`, `DESIGN.md` §8.4.

- [ ] Add one `.crawl-tables` block per spec §5.1 (`:empty` → `display: none`; rhythm; overline label; region `max-height: 26rem; overflow: auto`, focus ring as the other scroll regions use; sticky `thead th` and first column on `var(--paper)`; `content-visibility: auto`; first column `max-width: 40%` below 768px).
- [ ] Rewrite the §8.4 paragraph: visible block, two tiers, page cap, browser build.
- [ ] `npx vitest run tests/explorer/themeTokens.test.ts`. Start `npm run dev -- --port 3100`, screenshot `/explorer/expenditure`, `/en/explorer/trade/partners`, `/explorer/education/schools` at 1366×900 and 390×844; adjust until the block reads as part of the page. Commit.

### Task 4: Earlier months on the inflation pages

**Files:** Modify `lib/explorer/periodRange.ts`, `lib/explorer/inflationOverview.ts`, `inflationCategories.ts`, `inflationCities.ts`, and the three `components/inflation/*.tsx` explorers. Test `tests/explorer/crawlStates.prices.test.ts`, `tests/explorer/crawlTables.test.ts`.

**Interfaces — produces:**
- `earlierPeriodsRange(coverage: PeriodCoverage, count: number): PeriodRange | null` — coverage start to the month before `lastPeriodsRange`'s start; `null` when the window already covers everything
- `crawlPeriodsRange(coverage, count, months: "latest" | "earlier")`, and a `months` argument (default `"latest"`) on `inflationCrawlStates`, `categoryCrawlStates` and `cityCrawlStates` — the same views and selections over that range

- [ ] Tests: the earlier range ends the month before the window starts and is `null` for a short series; each crawl-state function called with `"earlier"` returns one state per window state with the same tab and selection.
- [ ] Implement; each explorer passes its earlier builder as `useCrawlModels`'s second argument. Run the two test files. Commit.

### Task 5: The years the map pages cut

**Files:** Modify `lib/explorer/indexCrawlTables.ts`, `lib/pages/demography-births-deaths.tsx`, `lib/pages/demography-marriages-divorces.tsx`. Test `tests/explorer/indexCrawlTables.test.ts`.

- [ ] Test: with `maxCells` that cuts the earliest years, `indexHistoryTables` returns the window tables unchanged and, after them, tables flagged `rest: true` holding exactly the cut years.
- [ ] Implement; `IndexCrawlTables` already folds `rest` tables. Run the file. Commit.

### Task 6: The build check

**Files:** Modify `scripts/check-crawl-tables.ts`.

- [ ] `WRAPPER` becomes `<div data-testid="crawl-tables" class="crawl-tables">`; a wrapper ends at its region's closing `</div></div>`; cells are counted separately for the window (before `<details>`) and the whole block.
- [ ] Failures: a wrapper or any ancestor with `hidden`, `aria-hidden="true"`, `inert` or inline `display:none`; window over `CRAWL_CELL_CAP`; block over `CRAWL_PAGE_CELL_CAP`; the old `hidden=""` wrapper anywhere.
- [ ] Report: per page, the reader-text length through the end of the window tables (scripts, styles, svg and `hidden` subtrees dropped; cells joined with ` | `), and the pages over 40,000.
- [ ] New spot checks: Trade partners holds a partner outside the window's top rows; Inflation by category holds a 2015 row. Commit.

### Task 7: Browser specs

**Files:** Modify `tests/browser/crawl-table.spec.ts`; fix other specs only where a visible table breaks a locator.

- [ ] Rewrite `crawl-table.spec.ts`: raw HTML carries the visible wrapper with figures; after hydration each wrapper is visible, holds the server's table count and no error is logged; the region is focusable and named; `expect.poll` on `document.documentElement.scrollWidth <= clientWidth` at 390×844; axe (`tests/browser/axe.ts`) on `/explorer/expenditure` and `/en/explorer/trade/partners`.
- [ ] Client navigation: open `/en/explorer/wages/regions`, follow a region link, expect a `crawl-tables` caption naming that region; follow a second region, expect its name and not the first.
- [ ] Build and serve once (CLAUDE.md), run the whole browser suite once, and fix each failing locator by scoping it to its own table. Re-run only the failed files. Commit.

### Task 8: Proof

- [ ] `npm run check`, `npm run build`, `npm run crawl:check`; the browser suite result from Task 7 stands if no input changed.
- [ ] Reader replay over every built page (40,000-character window) saved under `/mnt/project-files/ai-readable-tables/`; fresh agents answer the spec §7.3 questions from that text alone; fix what they miss and repeat for the affected pages.
- [ ] Screenshots, desktop and phone, Georgian and English, for Duru; `llms.txt` and `docs/` wording that still says "hidden" corrected.
- [ ] After release: the same questions through Claude's fetch and Gemini `url_context` on the live pages.

### Task 9: The monthly change on Inflation by category (added after Task 8; spec §5.4)

**Files:** Modify `lib/explorer/inflationCategories.ts`, `components/inflation/inflation-categories.tsx`, `lib/pages/inflation-categories.tsx`, `lib/pages/inflationPageData.ts`, `scripts/prepare-inflation.ts`, `lib/explorer/crawlTables.ts`, `scripts/check-crawl-tables.ts`, `lib/seo/llmsText.ts`. Test `tests/explorer/crawlStates.prices.test.ts`, `tests/explorer/inflationCategoriesRender.test.tsx`, `tests/explorer/inflationCategories.test.ts`, `tests/explorer/crawlTables.test.ts`, `tests/browser/inflation-categories.spec.ts`.

- [ ] Test: `categoryCrawlStates(index, "earlier")` returns the tabs `["mom", "contrib", "yoy", "mom"]`: the monthly change of every category over the window, then each view from its first month to the December before its window; with both builders `crawlTables` cuts no table and prints one cell per `mom_pct` fact of `cpi-categories-monthly.csv`.
- [ ] Implement `categoryCrawlStates`; `CRAWL_PAGE_CELL_CAP = 40_000` (the page holds about 30,300 cells); the page-cap test builds its page from the constant.
- [ ] The page passes every category fact inline (`packCategoryFacts(categories.map(categoryFactInput))`); `monthlyUrl`, `usePageData`, the pending state, `categoryTabLoaded` and the `inflation-category-mom` page-data file go. Product inflation keeps its fetched file.
- [ ] `crawl:check` spot check: the folded rest of Inflation by category holds a monthly-change row for 2004 with twelve figures. `llms.txt` names Product inflation as the one page whose data loads after it opens.
- [ ] Browser spec: the monthly tab draws without a `/page-data/` request, the fold holds two monthly-change tables and the first tables none; the page's compressed size stays under its new limit. Build, serve, run the specs that open the page, then `npm run check` once. Commit.

### Task 10: Off screen for visitors (added 2026-11-23; spec §10)

**Files:** Modify `lib/explorer/crawlTables.ts` (`crawlBlockHtml`), `app/globals.css`, `lib/seo/llmsText.ts`, `scripts/check-crawl-tables.ts` (wording only), `components/explorer-shell/crawl-tables.tsx` and `index-crawl-tables.tsx` (comments), `DESIGN.md` §8.4 and its §17 line. Test `tests/explorer/crawlTables.test.ts`, `tests/explorer/indexCrawlTables.test.ts`, `tests/explorer/crawlTablesComponent.test.tsx`, `tests/scripts/checkCrawlTables.test.ts`, `tests/seo/agentFiles.test.ts`, `tests/browser/crawl-table.spec.ts`.

- [ ] Unit tests first, red: `crawlBlockHtml` writes `<div role="region" aria-label="…">` with no `tabindex` and `<details><summary tabindex="-1">`. Then `crawlBlockHtml` to green; nothing else in the block's HTML changes.
- [ ] Browser spec first, red on the old build: per wrapper `[width, height, position, overflow, clip-path]` is `[1, 1, "absolute", "hidden", "inset(50%)"]` and its region has a name; at 390 and 1366px no element inside a block has `tabIndex >= 0`, axe is clean, and `[scrollWidth, scrollHeight]` of the page is the same after the blocks are removed.
- [ ] `globals.css`: one rule replaces every `.crawl-tables` rule: `position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap`. No `hidden`, `aria-hidden`, `inert` or `display: none` anywhere, and no `sr-only` class in the HTML.
- [ ] Found by the test of the first build: under `content-visibility: auto` the page's `innerText` holds none of the tables. Browser spec first, red: each block's `innerText` contains its first caption and the page's figure, and its computed `content-visibility` is `visible`. Then the property goes.
- [ ] Found by the test of the second build, which kept the property under `@media (pointer: coarse)`: a clipped 1px box is never near the viewport, so a touch device never lays the tables out. Browser spec first, red: with `hasTouch` and `isMobile` the block's `content-visibility` is `visible` and its `innerText` holds the page's figure. Then the media rule goes; measure what the layout costs a phone (spec §10.3).
- [ ] `llms.txt`, test first: 'Each chart page carries a "Data table" in its HTML, not drawn on screen: …'; the 27,000-byte cap holds.
- [ ] Build, serve, the spec to green; `npm run crawl:check`; replay every built page as the reader's text and compare it with the replay of 2026-11-21; screenshots of sampled pages with the blocks and with them removed, and against a build of `main`, compared pixel for pixel.
- [ ] Fresh agents on the new build's replayed text; `npm run check`; the whole browser suite once. Commit.
- [ ] Push, pull request; the real Claude reader on the Vercel preview if a share link admits it; after release the real reader and Gemini on live pages.

### Task 11: The release's date in the sitemap (added 2026-11-25; spec §11)

**Files:** Modify `lib/seo/sitemap.ts`, `app/sitemap.xml/route.ts`, `docs/deployment.md` (SEO and headers). Test `tests/seo/sitemapDataTablesRelease.test.ts` (new).

**Interfaces:** `export const DATA_TABLES_LIVE_AT: Date` (`2026-11-23T16:20:00Z`) and `export function withDataTablesRelease(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap`, both in `lib/seo/sitemap.ts`.

- [ ] Unit tests first, red: `withDataTablesRelease` gives `/explorer/education/schools` and its `/en` twin, both reviewed 2026-10-16, `DATA_TABLES_LIVE_AT`; returns an entry reviewed 2027-02-01 as it is; returns unchanged the home page, About, Connect, All data, every `NAV_GROUPS` page, Analysis, Product inflation, Methodology and one of its articles, in both languages; keeps an entry's `url` and `alternates`.
- [ ] The published file, red: the XML of `GET()` in `app/sitemap.xml/route.ts` is `serializeSitemapXml(withDataTablesRelease(await sitemap()))`; in it Schools and its `/en` twin are not older than the release, and the Budget group page and the Debt methodology article carry `sitemap()`'s date.
- [ ] Implement the constant and the function, and call it in the route. `sitemap()` and its tests do not change. Run the new file, the four sitemap test files and `npm run typecheck`.
- [ ] `docs/deployment.md`: the rule, and when the date moves.
- [ ] Write the published XML from the route and compare it with the live sitemap: the same URLs in the same order with the same language links, 1,466 dates at the release, 90 unchanged.
- [ ] After Duru's go: sync with `main`, `npm run check` and `npm run build` once, push, pull request, merge when CI is green and no other release is on its way; then `https://fiscal.ge/sitemap.xml`.
