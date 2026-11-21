# AI-readable data tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every chart page and map page shows its full data as an ordinary visible table block that AI readers keep, with the rest of a large page folded below it.

**Architecture:** `CrawlTables` / `IndexCrawlTables` stop writing a `hidden` wrapper and write one server-built block (heading, scrolling region, window tables, a closed `<details>` with the rest). `crawlTables()` gains a second tier for the series and periods the 3,000-cell window cuts. `useCrawlModels` builds in the browser only for a page that was not server-rendered into the document.

**Tech Stack:** Next.js 16 static export, React 19.3, strict TypeScript, Tailwind v4 with unlayered rules in `app/globals.css`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-ai-readable-data-tables-design.md`

## Global Constraints

- All commands run in `apps/web`. While editing run only the named test file; the full gates run once, in Task 8.
- The `<table>` markup `crawlTablesHtml` writes does not change, and nothing inside the wrapper carries a class or style.
- `CRAWL_CELL_CAP` stays 3,000 (the window). `CRAWL_PAGE_CELL_CAP` = 30,000 (window plus rest).
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
