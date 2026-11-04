# AI Tools Give the Number First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every chart page's HTML carries every series it offers (hidden), llms.txt leads with answer-first rules and each page's latest figure, and the MCP instructions say "figure first".

**Architecture:** A new pure module turns the explorers' existing Excel workbook models (`WorkbookExportModel.readable`) into capped, formatted tables; one new client component renders them in a `hidden` div at the end of each explorer, fed by each explorer's own workbook builder run once per view with every series selected. The old selected-rows crawl copy inside `ExplorerTable` is removed. llms.txt becomes a force-static route assembled from authored text plus the group-page card figures.

**Tech Stack:** Next.js 16 (app router, force-static route handlers), React 19 client components, strict TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-ai-direct-answers-design.md`

All paths below are relative to `apps/web/` unless they start with `docs/` or `data/`.

## Global Constraints

- Nothing a visitor sees changes: same layout, visible tables, tab order; no new focus stops; crawl tables sit inside one element with the `hidden` attribute (spec S3).
- A page's crawl tables hold at most `3,000` cells; monthly views keep the last `36` months (spec §3.4).
- Total gzip size of all prerendered HTML may grow at most 15% over the baseline: **54,378,250 bytes across 1,556 HTML files** (gzip level 6, `.next/server/app/**/*.html` minus `_not-found` and `_global-error`, `main` at 6ebf6686). Ceiling: **62,535,000 bytes** (spec S6).
- Crawl-table markup is minimal: no `class`, `style` or `data-*` attributes below the wrapper; numbers formatted with the site's `en-US` grouping in both locales (`lib/explorer/format.ts`); missing values are `MISSING` (`—`), never 0.
- llms.txt: English only, `text/plain; charset=utf-8`, at most 27,000 bytes, every page/methodology/file link it has today kept (spec S5).
- MCP server instructions stay under 4,096 characters (`tests/mcp/route.test.ts`, `tests/mcp/tools.test.ts`); `npx vitest run tests/factQuery/reference.test.ts` passes unchanged — a disagreement is a stop condition, report it.
- New Georgian strings go in `lib/i18n/messages/ka/*.json` with English twins; list each in the Duru proofread notes (`/mnt/project-files/ai-direct-answers/notes-for-duru.md`).
- Do not push, open a PR or run the full gates until Duru has seen the preview and said OK (project rule).
- Feedback loop per `CLAUDE.md`: run single test files while editing; `npm run check` + build + browser suite once, at the end.

## Review Focus

1. **A view with no data or an empty list** (a region page whose series start later than the range, a place with no facts for one tab) — builders were written for a click with a selection; the crawl must skip that view, not throw at build time. Test: Task 1 `crawlTables([])` returns `[]`, and each batch task's state test includes one place page whose some view is empty.
2. **Negative and signed values** (deficit balance, trade balance, current account, securities gains, `+0.0;−0.0;0.0` contributions) — must print with a minus sign (`−1.2`) or plus where the format says so. Test in Task 1.
3. **Planned / forecast / preliminary marks** (2026 budget plan, IMF projection years, preliminary GDP) — the crawl cell must keep the mark as the visible table does. Test in Task 1, and Task 3 asserts the expenditure page's 2026 cell reads `30.9 (planned)` in English.
4. **Georgian pages** — captions, labels and status words in Georgian on `/` routes, English on `/en`; digits identical. Task 9's built-HTML check reads one ka and one en page per spot check.
5. **Hydration** — the crawl tables must render identically on server and client (no time, random or window-size input), or React re-renders the explorer. Task 9 browser check: no hydration error in the console on four pages.

---

### Task 1: Crawl-table model (pure)

**Files:**
- Create: `lib/explorer/crawlTables.ts`
- Test: `tests/explorer/crawlTables.test.ts`

**Interfaces:**
- Consumes: `WorkbookExportModel`, `WorkbookBasis` (`lib/explorer/workbookModel.ts`); `MISSING` (`lib/explorer/format.ts`); `workbookMessage` (`lib/i18n/workbook`) for the status words `workbook.planned | preliminary | forecast`; `message` for the cap note.
- Produces:
  ```ts
  export const CRAWL_CELL_CAP = 3000;
  export const CRAWL_MONTH_COLUMNS = 36;
  export type CrawlTable = { caption: string; columns: string[]; rows: { label: string; cells: string[] }[] };
  export function crawlTables(models: readonly WorkbookExportModel[], messages: Messages): CrawlTable[];
  export function formatCrawlCell(value: number | null, basis: WorkbookBasis | null, numberFormat: string, locale: Locale): string;
  ```

- [ ] **Step 1: Write the failing tests** (`tests/explorer/crawlTables.test.ts`), with a small `model()` factory building a `WorkbookExportModel` whose only meaningful part is `readable`:
  - `formatCrawlCell(1234.56, "actual", "#,##0.0", "en")` → `"1,234.6"`; `(0.139, "actual", "0.0%", "en")` → `"13.9%"`; `(-1.25, "actual", "#,##0.00;[Red](#,##0.00);–", "en")` → `"−1.25"`; `(0.4, "actual", "+0.0;−0.0;0.0", "en")` → `"+0.4"`; `(0.5, "actual", "0.0#", "en")` → `"0.5"`; `(null, null, "0.0", "en")` → `"—"`; `(30.9, "planned", "#,##0.0", "en")` → `"30.9 (planned)"` with the word from `workbookMessage(locale, "workbook.planned")` lower-cased; same for `preliminary` and `forecast`; `not_available` → `"—"`.
  - The format used per cell is `row.numberFormatByYear?.[year] ?? row.numberFormat ?? readable.numberFormat ?? default`, where default is `0.0%` when `readable.unitLabel` contains `%`, else `#,##0` plus `readable.amountDecimals ?? 1` decimals — test one row overriding the sheet format.
  - Caption is `` `${readable.title} · ${readable.subtitle}` ``; columns are `readable.headerLabels?.columns ?? readable.years.map(String)`; values are read from `row.valuesByYear[year]` for `readable.years[i]` (column i).
  - Empty input `[]` → `[]`; a model with zero rows → no table.
  - Cap: one model with 1 total row + 300 item rows × 20 years → kept rows × 20 ≤ 3,000; the total row is kept and first; the kept items are the largest by absolute value in the last column with a value; kept rows keep their original order; the caption ends with the cap note `message(messages, "controls.crawlTop", { kept, of })` where `of` counts item rows before the cut.
  - Two models over the cap share it: each gets `floor(remaining / tablesLeft)` cells, in model order.
  - Months: a model with `headerLabels` and 60 columns keeps the last 36 columns (headers and cells); one with 30 columns keeps all.

- [ ] **Step 2: Run** `npx vitest run tests/explorer/crawlTables.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement `lib/explorer/crawlTables.ts`.** Excel format handling stays minimal: take the first `;` section for non-negative values and the second (if any) for negative ones, drop quoted text and `[Red]`/parentheses, count `0`/`#` after `.` (`#` = optional digit, trailing zeros trimmed down to the `0` count), `%` multiplies by 100, a leading `+` prints a plus, a negative prints `−` (U+2212); numbers via `Intl.NumberFormat("en-US")`. Add the message key `controls.crawlTop` to `lib/i18n/messages/en/controls.json` (`"top {kept} of {of}; all of them in the Excel download"`) and `ka/controls.json` (`"პირველი {kept} {of}-დან; ყველა — Excel-ის ფაილში"`, proofread item).

- [ ] **Step 4: Run** the test file and `npm run i18n:check` — expect PASS.

- [ ] **Step 5: Commit** `feat(seo): crawl-table model from workbook summaries`.

### Task 2: `CrawlTables` component

**Files:**
- Create: `components/explorer-shell/crawl-tables.tsx`
- Test: `tests/explorer/crawlTablesComponent.test.tsx` (render with `renderToStaticMarkup` inside the existing i18n test provider used by other component tests — find it with `grep -rl "I18nProvider" tests | head`)

**Interfaces:**
- Consumes: `crawlTables` (Task 1); `useI18n()` for `messages`.
- Produces: `export function CrawlTables({ models }: { models: readonly WorkbookExportModel[] }): JSX.Element | null`

- [ ] **Step 1: Failing test:** markup for one 2×2 model is exactly `<div hidden="" data-testid="crawl-tables"><table><caption>…</caption><thead><tr><th>…</th><th>2024</th><th>2025</th></tr></thead><tbody><tr><th>Total</th><td>1.0</td><td>2.0</td></tr>…</tbody></table></div>` (first header cell is `workbookMessage(locale, "workbook.category")`); no `class`/`style` inside the wrapper; `models=[]` renders `null`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** (no hooks besides `useI18n`; no `useMemo` here — callers memoise models).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(seo): CrawlTables hidden table component`.

### Tasks 3–8: Wire every explorer

**The same pattern in every file** (each task's tests and reviewer check it):

1. Add a pure function beside the explorer's model code (the `lib/explorer/<topic>*.ts` file whose `build…Model` the explorer already calls):
   `export function <topic>CrawlStates(<the same inputs the builder takes, minus state>): <TopicState>[]` — one state per **view × unit** the page offers: start from the state the page opens with for that view (reuse the explorer's own `change…View`/`initial…State` helpers), select every series id that view's list offers (what "ყველას მონიშვნა" selects), widest range, `mode: "line"`. A unit the list cannot mix (rates vs people, amount vs share when the share is not just a re-expression) gets its own state. Map tabs, share-of-GDP and per-person toggles that only re-express the base numbers do not.
2. In the explorer: `const crawlModels = useMemo(() => <topic>CrawlStates(…).map(s => build…WorkbookExportModel(…, s, …)), [<data props only>]);` — dependencies are props, never `state`, so clicks do not rebuild it.
3. Render `<CrawlTables models={crawlModels} />` as the **last child of the explorer's root element**, after the workspace (so the sibling rule `[data-placement="panel"] + * [data-testid="chart-phone-legend"]` in `app/globals.css` is untouched).
4. Replace `<ExplorerTable … crawlCopy={X === "line"} />` with rendering the table only in table mode (`X === "table" ? <ExplorerTable … /> : null`) and the chart only in line mode, as before PR #226; drop the `crawlCopy` prop.
5. A view whose builder throws or returns zero rows on an empty list is filtered out before `build…` (guard in `<topic>CrawlStates`, not a try/catch).
6. Test file per task `tests/explorer/crawlStates.<batch>.test.ts`: for each explorer in the batch, using the fixtures the existing tests of that explorer already load, assert (a) the union of selected ids across the returned states equals every series id the list offers in each view, (b) every returned state builds a workbook model with ≥ 1 row, (c) for place explorers, one place whose some view has no data returns no state for that view.

Batches (files are `components/…`; "+ pages" means the same component serves several routes):

- **Task 3 — Budget:** `main-explorer/main-explorer.tsx` and `main-explorer/explorer-view.tsx` (expenditure, revenue, ministries, spending by type — find which builder `explorer-view` receives through props), `municipalities/municipal-explorer.tsx`, `debt/debt-explorer.tsx`, `deficit/deficit-explorer.tsx`, `tax-breaks-refunds/tax-breaks-refunds-explorer.tsx`. Extra assertion: expenditure's 2026 total cell `30.9 (planned)` (from the reviewed CSVs, via the builder).
- **Task 4 — Economy and business:** `gdp/gdp-overview.tsx`, `economic-sectors/economic-sectors-explorer.tsx`, `regional-economies/regional-economy-explorer.tsx`, `business/business-explorer.tsx`, `business/business-area-explorer.tsx`, `housing/housing-explorer.tsx`, `housing/housing-area-explorer.tsx`, and the GDP-by-expenditure page's component if it has a workbook (`grep -rl "WorkbookExportModel(\|WorkbookModel(" components`).
- **Task 5 — Prices and money:** `inflation/inflation-overview.tsx`, `inflation/inflation-categories.tsx`, `inflation/inflation-cities.tsx`, `inflation/inflation-products.tsx` (these have no `ExplorerTable`; only steps 1–3 and 5–6 apply), `money-banks/money-banks-explorer.tsx`, `money-banks/money-banks-area-explorer.tsx`.
- **Task 6 — Labour, living, health:** `unemployment/unemployment-explorer.tsx`, `unemployment/labour-explorer.tsx`, `wages/wages-explorer.tsx`, `household/household-explorer.tsx`, `poverty/poverty-explorer.tsx`, `health/health-explorer.tsx`, `health/health-deaths-explorer.tsx`, `social/social-explorer.tsx`, `social/social-place-explorer.tsx`. Extra assertion (spec S2): the Samegrelo-Zemo Svaneti unemployment region states produce a people table whose employed row reads `118.9` in 2015 and `118.5` in 2025.
- **Task 7 — External sector:** `trade/trade-overview.tsx`, `trade/trade-partners.tsx`, `trade/trade-products.tsx`, any other trade page component with a workbook (domestic exports, services, composition), `external/current-account.tsx`, `external/foreign-investment.tsx`, `external/money-from-abroad.tsx`, `external/external-position.tsx`. These use `build…WorkbookModel` names; same pattern.
- **Task 8 — Demography and society:** `demography/demography-migration.tsx`, `demography/marriage-explorer.tsx`, `demography/marriage-section.tsx`, `demography/national-vital-charts.tsx` (3 tables: one `CrawlTables` with all its models), `demography/population-place-explorer.tsx`, `demography/vital-section.tsx`, `demography/age-sex-explorer.tsx`, `demography/age-sex-section.tsx`, `education/education-explorer.tsx`, `education/education-place-explorer.tsx`, `science-culture/science-culture-explorer.tsx`, `science-culture/museum-area-explorer.tsx`, `crime/crime-explorer.tsx`, `internet/internet-explorer.tsx`, `internet/internet-area-explorer.tsx`, `energy-food/energy-food-explorer.tsx`, `environment/environment-explorer.tsx`, `transport/transport-explorer.tsx`, `transport/transport-area-explorer.tsx`.

Each batch task: Step 1 write the batch test → Step 2 run, FAIL → Step 3 wire the files → Step 4 run the batch test, the existing tests of those explorers (`npx vitest run tests/<topic>`), and `npm run typecheck` → Step 5 commit `feat(seo): full crawl tables — <batch>`.

### Task 9: Retire the old crawl copy, guard, docs and measurement

**Files:**
- Modify: `components/main-explorer/explorer-table.tsx` (remove the `crawlCopy` prop, its `hidden` branch and the two effect dependencies that exist only for it)
- Rewrite: `tests/explorer/crawlTableCoverage.test.ts`
- Modify: `DESIGN.md` §8.4 "Table Mode" paragraph on the crawl copy
- Create: `scripts/check-crawl-tables.ts` and the npm script `crawl:check` (manual, not in `check` — it needs a build)

**Interfaces:** Consumes everything from Tasks 1–8.

- [ ] **Step 1: Rewrite the guard test.** Rule: every file under `components/` that calls a function matching `/build\w*Workbook\w*Model\(/` (except `explorer-shell/crawl-tables.tsx`) renders exactly one `<CrawlTables` and no `crawlCopy=`; `ExplorerTable`'s props have no `crawlCopy`. Keep the "at least 47 files" floor, now counted over workbook files. Run — FAIL until Step 2.
- [ ] **Step 2: Remove `crawlCopy`** from `ExplorerTable`. Run the guard test and `npm run typecheck` — PASS.
- [ ] **Step 3: DESIGN.md §8.4:** replace the crawl-copy sentence block with: chart pages carry `CrawlTables` — every series of every view, from the workbook builders, capped at 3,000 cells and 36 months, last child of the explorer root, `hidden`; the visible table renders only in Table mode; guard `tests/explorer/crawlTableCoverage.test.ts`.
- [ ] **Step 4: `scripts/check-crawl-tables.ts`** (run with `npx tsx`, after `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`): reads `.next/server/app/**/*.html` (same exclusions as the baseline) and fails unless: every page whose HTML has a `chart-panel` test id has a `crawl-tables` wrapper; no page has more than 3,000 `<td>` inside it; total gzip (level 6) ≤ 62,535,000 bytes; and these spot checks find their text inside the wrapper, on the ka and en page each: Samegrelo-Zemo Svaneti unemployment region page — `118.9` and `118.5` in the employed row; expenditure — `30.9` with the planned word; wages by industry — a median row; trade partners — the cap note. It prints per-page cells and gzip before/after totals (pass the baseline number as a constant).
- [ ] **Step 5: Run** the build and `npx tsx scripts/check-crawl-tables.ts` — expect PASS and record the printed totals in `/mnt/project-files/ai-direct-answers/notes-for-duru.md`. If the size check fails, lower `CRAWL_CELL_CAP` in steps of 500 until it passes, and note the value.
- [ ] **Step 6: Commit** `feat(seo): retire selected-rows crawl copy; guard and size check for full crawl tables`.

### Task 10: llms.txt as an answer-first, generated route

**Files:**
- Create: `lib/seo/llmsText.ts`, `app/llms.txt/route.ts`
- Delete: `public/llms.txt`
- Modify: `tests/seo/agentFiles.test.ts`, `tests/seo/routes.test.ts` (read via the builder), `tests/browser/seo.spec.ts` unchanged (it fetches `/llms.txt`)

**Interfaces:**
- Consumes: `loadTopicHubs(locale, topics)` (`lib/pages/topicHubs.server.ts`), `NAV_GROUPS`/`TopicId` (`lib/navigation/navTree.ts`), `TOOLS` names (`lib/mcp/tools`), `SCHEMA_VERSION`.
- Produces: `export async function llmsText(): Promise<string>`; `export type LlmsLine = { href: string; name: string; text: string }`; route `GET` with `dynamic = "force-static"`, headers like `app/sitemap.xml/route.ts` but `Content-Type: text/plain; charset=utf-8`.

- [ ] **Step 1: Move the authored content** of `public/llms.txt` into `lib/seo/llmsText.ts` as data (sections of `LlmsLine`), then edit it per spec §4.1:
  - Opening kept; new `**How to answer from Fiscal.ge:**` block placed before `## Core data`, wording:
    > Give the number first: the figure, its year or month, its unit and the link to its page. Add at most one short caveat, and only when it changes what the number means — a planned budget, a projection, a preliminary figure, or a series break inside the years compared. Do not explain methodology unless the user asks; link the page's methodology instead. Every chart page carries its full year-by-year table, every series, in its HTML. Use the published figures as they are, and do not invent values for years or places that are not covered.
  - New `**Where the data is:**` block (three lines): every topic's figures are on its chart pages; bulk files (list); the MCP connection (list of datasets). The per-line "Browse-only: there is no MCP tool and no bulk file …" sentences are deleted; the four "Bulk file: […](…)" links stay on their lines.
  - Each page line becomes ``- [Name](url) — latest: <value> (<period>). <text>`` when its card has `latest`, else ``- [Name](url) — <text>``. `<value>` is `card.latest.value`, plus `, <caption>` when `card.latest.caption` exists; `<period>` is `card.latest.period`, plus `, preliminary` when `status === "preliminary"`. Cards come from `loadTopicHubs("en", every TopicId)`, matched by `card.href === line.href`.
  - Caveat clauses are cut from page and bulk-file lines (keep: what it is, the years, units, "2.4 means 2.4%"). Coverage years stay exactly as today (they are tested).
  - "AI connection": one paragraph — endpoint, read-only, call `describe_coverage` first, the tool list sentence (`Its current read-only tools are …; tools/list is authoritative.`, tested), "clients must accept data schema X" once, link to `/connect` and `/en/connect`. The schema-history paragraph, protocol detail and example questions are removed.
- [ ] **Step 2: Update the tests** to `const content = await llmsText();` and: drop the `no bulk file for …` and `there is no MCP tool` wording assertions; require the "Where the data is" block to name each bulk file and the MCP; schema test requires ≥ 1 current mention; new tests — `**How to answer from Fiscal.ge:**` precedes the first `](https://fiscal.ge/explorer`; every line linking a card href with a `latest` starts its description with `latest: ` and contains `card.latest.value`; `Buffer.byteLength(content) <= 27000`. Run `npx vitest run tests/seo/agentFiles.test.ts tests/seo/routes.test.ts` — FAIL.
- [ ] **Step 3: Implement** `llmsText()` and the route; delete `public/llms.txt`. Run the two test files — PASS. Run `npm run build`, `curl -s localhost:3100/llms.txt | head -40` against `npm run start -- --port 3100`, check content type and that a line reads e.g. `- [Unemployment overview](https://fiscal.ge/explorer/unemployment/overview) — latest: 13.9% (2025).`
- [ ] **Step 4: Commit** `feat(seo): answer-first llms.txt with each page's latest figure`.

### Task 11: MCP instructions lead with the figure

**Files:** Modify `lib/mcp/instructions.ts`; tests `tests/mcp/route.test.ts`, `tests/mcp/tools.test.ts`, `tests/factQuery/reference.test.ts` (run only).

- [ ] **Step 1:** Replace the ANSWERING bullet `Show every severe caveat in full, next to its figure, in its own words (messageKa/messageEn), never by code.` with `Lead with the figure, its period and unit; then each severe caveat, briefly, in its own words (messageKa/messageEn), never by code.` If the total exceeds 4,095 characters, shorten other ANSWERING wording without dropping a rule.
- [ ] **Step 2: Run** `npx vitest run tests/mcp/route.test.ts tests/mcp/tools.test.ts tests/factQuery/reference.test.ts` — PASS (reference fixture unchanged; a failure there is a stop condition).
- [ ] **Step 3: Commit** `feat(mcp): instructions lead with the figure`.

### Task 12: Preview for Duru, then the done-check

- [ ] **Step 1:** Build, serve on :3100, and save to `/mnt/project-files/ai-direct-answers/preview/`: the text a no-JS reader sees (the totext extraction used in the diagnosis) for the Samegrelo-Zemo Svaneti unemployment page (ka) before and after, the new `/llms.txt` head, and two screenshots proving the visible page is unchanged (Imereti unemployment page, desktop and phone).
- [ ] **Step 2:** Write `/mnt/project-files/ai-direct-answers/notes-for-duru.md`: size before/after, any page that hit the cap, the Georgian strings to proofread.
- [ ] **Step 3:** Stop. Show Duru; wait for OK.
- [ ] **Step 4 (after OK):** `npm run check`, `npm run build`, full browser suite against the built server (`CI=1`, per `CLAUDE.md`); fix failures; then push and open the draft PR per AGENTS.md.
