# Platform Review Fixes Implementation Plan (review of 2026-10-12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the verified findings of the 2026-10-12 platform review of fiscal.ge, in this order: security, broken behaviour and accessibility, page weight, duplicated code, test-suite cleanup, polish.

**Architecture:** Every fix lands at its shared cause when there is one (one component, helper or config), not page by page. Shared components get small optional additions whose defaults keep today's output (AGENTS.md "Reuse First"). One branch, one commit per task, tasks in the order written; a task marked **[parallel-safe]** touches no file another task in the same phase touches, so it can run beside its neighbours.

**Tech Stack:** Next.js 16 (static prerender plus `/mcp`), strict TypeScript, Tailwind v4, Vitest, Playwright, ExcelJS. Commands run from `apps/web`.

**Spec:** `docs/superpowers/specs/2026-10-12-platform-review.md`. Finding ids (`U03-05`, `X1-02` …) refer to the reports in `.superpowers/platform-review-2026-10/pages/` (`U03-05` is `U03-expenditure-05` in `pages/U03-expenditure.md`). Proposed test removals are `D001`–`D283` in `.superpowers/platform-review-2026-10/test-drop-verify/result-{A,B,C}.md`.

## Global Constraints

- Reuse first. Extend an existing helper with an optional parameter whose default changes nothing; never fork or copy one. A new module needs one line naming the closest existing one and why it could not be extended.
- Georgian and English stay in step. Every new message key goes into `lib/i18n/messages/ka/*.json` and `lib/i18n/messages/en/*.json`; `npm run i18n:check` passes. New or changed Georgian text is a draft: list it in the task's commit body for the owner's review.
- Owner design decisions are not findings: one short line under each page heading (DESIGN.md §17), no "% of GDP" or currency tabs (icon toggles), regional data through the map with each region and Georgia on its own page, no "Imports:"/"By type:" prefixes, hubs show yearly data (inflation monthly is the exception), "ფარდობითი სიღარიბე", no tourism or exchange-rate pages.
- Derive years and coverage from loaded facts; never hardcode a year in code or message text.
- No change to any number a page shows unless the task says so. Public workbooks keep their three sheets, status column and source links, and no internal metadata columns.
- Query-service files (`lib/factQuery/`, `lib/mcp/`, `app/mcp/`): `npx vitest run tests/factQuery/reference.test.ts` must pass; a disagreement is a stop condition (CLAUDE.md "Definition of done" 4).
- Data or archive changes update the matching doc under `docs/data-methodology/` in the same commit.
- Feedback loop while working: one test file (`npx vitest run <file>`, `npx playwright test <spec>` against a built server, see CLAUDE.md "Test loop"). The full gates run once, in Task 50.
- Show the owner a preview and wait for their go before any push that opens a PR or triggers CI (project rule). Merging to `main` is a production release.
- Commits end with the attribution lines from the session's system reminder.

## Review Focus

1. **Phone legend on every multi-line chart, including pages added later.** Task 7 adds a route list test; it must fail when a new line-chart page forgets the legend, not just pass on today's pages.
2. **Keyboard reading of a chart with gaps and forecasts.** Arrow keys on a chart with missing years (household regions from 2019, debt forecast years) must skip or announce the gap, never read "0". Test in Task 12.
3. **Deep links after the hash-hook move.** Debt, deficit and inflation city links with an explicitly empty `sel=` and Back/Forward must restore exactly the same view. Test in Task 17.
4. **Rounded trade values in Excel.** After Task 26 the workbook totals must still equal the sum of their rows at the precision shown. Test in Task 26.
5. **Skip link with no JavaScript and in English.** The skip link must work on a prerendered page with JavaScript off and carry the English text on `/en`. Test in Task 11.

---

## Before you start (lead only)

- [ ] **Op 1: get the owner's answers to Q1–Q10** (end of this document). Tasks marked "waits on Qn" use the recommended default if no answer has come by the time they start, and say so in the commit body.
- [ ] **Op 2: decide the order with the component-reuse branch.** The owner's local branch has component-reuse Tasks 0–10 done and not merged. Tasks 33, 34 and 36 below touch the same explorers. Merge that branch first, or rebase this plan's Phase 4 onto it. The other phases do not depend on it.
- [ ] **Op 3: deadline outside this plan.** audit-fixes Task 20 (dependency audit) is still open. `scripts/audit-dependencies.ts:7` lets the braces advisory pass only until **2026-11-02 04:00 Tbilisi**; from then CI fails on every PR and nothing can be released. Do that task before 2026-11-02, whatever happens to this plan.
- [ ] **Op 4:** `git fetch origin && git switch -c claude/platform-review-fixes origin/main && cd apps/web && npm ci` (compare `node_modules/.package-lock.json` with `package-lock.json`).

---

## Phase 1: Security and safety

### Task 1: Archived source pages can never run scripts on fiscal.ge

Why: X2-01 (high). `/downloads/methodology/unemployment/files/employment-unemployment-en.html` is served as `text/html` (checked on production 2026-10-12). Its 7 `<script>` tags, including Geostat's Google Analytics and reCAPTCHA, run on the fiscal.ge origin. The other 21 archived web pages are already served as `.html.txt`.

**Files:**
- Rename: `public/downloads/methodology/unemployment/files/employment-unemployment-en.html` → `employment-unemployment-en.html.txt`
- Modify: `data/methodology/source-archives/unemployment.csv:8`, `public/downloads/methodology/unemployment/manifest.csv:10` (regenerated by `scripts/prepare-methodology-archives.ts`, not by hand); `next.config.ts:35-38`; `scripts/prepare-methodology-archives.ts` (validator); `docs/data-methodology/public-methodology-and-source-archives.md` (one sentence: every archived web page is published as `.html.txt` and every archived original is served sandboxed)
- Test: `tests/seo/nextConfig.test.ts`, the archive script's existing test file (find it with `grep -rl prepare-methodology-archives tests`)

Reuse: the existing `/downloads/methodology/:dataset/files/:path*` header rule and the `.html.txt` convention the other 21 files already follow. The two Trade-only CSP rules (`next.config.ts:39-46`) become redundant; delete them.

- [ ] **Step 1: Failing tests.** In `nextConfig.test.ts`: `"every archived original is served sandboxed"`, expect the rule for `/downloads/methodology/:dataset/files/:path*` to include `Content-Security-Policy: sandbox; default-src 'none'` and `X-Robots-Tag: noindex, follow`. In the archive test: `"rejects a text/html archive row whose public path does not end in .txt"`, a fixture row with media type `text/html` and path `x.html` throws a message naming the row id.
- [ ] **Step 2:** Run both files. Expected: FAIL.
- [ ] **Step 3: Implement** the rename, the CSV row, the header and the validator rule; rerun the archive preparation so the manifest updates.
- [ ] **Step 4:** Run both files, then `npm run data:validate`. Expected: PASS. Against a built server: `curl -sI localhost:3100/downloads/methodology/unemployment/files/employment-unemployment-en.html.txt` shows `content-type: text/plain` and the sandbox CSP; the old `.html` path returns 404.
- [ ] **Step 5: Commit** `fix(security): serve every archived source page as sandboxed text`

Effort S. Risk low: the methodology page links come from the manifest, so they follow the rename; old external links to the `.html` address break, which is the point.

### Task 2: Internal notes stay out of page HTML [parallel-safe]

Why: U05-02, U04-07, X2-03 (internal reviewer notes such as "Confirm against source before production" in the HTML of `/explorer/expenditure`, `/revenue`, `/analysis`, both languages); U09-01, U08-06 (municipal reconciliation and source-registry fields in every municipal page's data).

**Files:**
- Modify: `lib/data/glossary.ts` (add `publicGlossaryEntry`), `lib/pages/expenditure.tsx:74`, `lib/pages/revenue.tsx:72`, `lib/pages/analysis.tsx:55`, the `glossaryEntries` prop type in `components/main-explorer/main-explorer.tsx`; `lib/pages/municipality.tsx`, `lib/pages/municipal-region.tsx`, `lib/pages/municipal-country.tsx` (project facts before passing props), the fact prop types in `components/municipalities/*`
- Test: `tests/seo/revenueScope.test.tsx` (or the nearest page-render test for each route), `tests/explorer/municipal*.test.tsx`

**Interfaces:**
- Produces: `publicGlossaryEntry(entry: GlossaryEntry): { id: string; kaLabel: string; enLabel: string }`.

Reuse: the projection pattern of `projectBudgetFact` (`lib/explorer/clientData.ts:46`).

- [ ] **Step 1: Failing tests.** `"budget pages ship no glossary notes"`: render each of the three pages (ka and en) and expect the HTML not to contain `"Confirm against source"`, `"Temporary source aggregate"` or `"by user decision"`. `"municipal pages ship only public fact fields"`: render `/explorer/municipalities/tbilisi` and its region page; expect no `reconciliationDifferenceGel`, `warningType` or `sourceId` in the HTML.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** the two projections; narrow the prop types so the compiler rejects the old shapes.
- [ ] **Step 4:** Run the tests, `npm run typecheck`, and the municipal and main-explorer browser specs. Expected: PASS, no visible change.
- [ ] **Step 5: Commit** `fix(privacy): keep glossary notes and reconciliation fields out of page HTML`

Effort S. Risk low.

### Task 3: One /mcp client cannot use up everyone's daily allowance (waits on Q2)

Why: X2-02. A single key can take the whole 10,000-a-day global allowance in 167 minutes at the 60-a-minute limit, and refused requests still spend the monthly Upstash quota. `docs/deployment.md:406-407` says the opposite.

**Files:**
- Modify: `lib/mcp/limits.ts:9-10` (add `perKeyDaily`), `lib/mcp/upstashCounter.ts` and `app/mcp/route.ts:39` (check the per-key daily window before the global one), `docs/deployment.md:400-421`
- Test: `tests/mcp/limits.test.ts`, `tests/mcp/rateLimitOrder.test.ts`, `tests/mcp/route.test.ts`

- [ ] **Step 1: Failing tests.** `"one key is refused after its daily cap while another key still passes"` (memory counter, cap 1,000: request 1,001 from key A gets 429 with `retry-after`, key B gets 200). `"the per-key daily check runs before the global one"` in `rateLimitOrder.test.ts`. Update the spec-pinning test in `limits.test.ts` (D275 is kept on purpose) to the new limit.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Default cap 1,000 per key per UTC day (Q2). Correct the deployment.md sentence: per-key refusals do not touch the app's daily counter, but every refusal still costs Upstash commands.
- [ ] **Step 4:** Run the three files and `npx vitest run tests/factQuery/reference.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(mcp): a per-client daily cap so one client cannot exhaust the shared allowance`

Effort S–M. Risk medium: a real claude.ai connector may share a few source addresses (U30-04); Q2 asks the owner to measure one before raising limits. A Vercel Firewall rule (X2-02) is a dashboard setting, listed under Q2.

### Task 4: CI and deploy workflows ask for the least access [parallel-safe]

Why: X2-05 (`ci.yml` has no `permissions:` block), X2-06 (deploy can be dispatched from any branch with production database credentials).

**Files:**
- Modify: `.github/workflows/ci.yml:1-16` (top-level `permissions: contents: read`), `.github/workflows/deploy-production.yml:23,44` (`github.ref == 'refs/heads/main'` on the dispatch branch of the job `if`; `environment: production` only after Q9 is answered yes and the owner has created the environment)
- Test: none in the repo; verified in Task 50 by the CI run itself.

- [ ] **Step 1: Implement** the two edits.
- [ ] **Step 2:** `npx --yes @action-validator/cli .github/workflows/ci.yml` if it is available offline; otherwise read the diff against GitHub's workflow syntax docs.
- [ ] **Step 3: Commit** `ci: read-only token for CI; production deploys only from main`

Effort S. Risk low; a wrong permission shows on the first CI run, before merge.

### Task 5: First-read docs no longer point at a database-resetting command [parallel-safe]

Why: X4-05 (high). `README.md:26` and `apps/web/README.md:34` list `prisma:migrate`, which `docs/data-methodology/database-import.md:124-127` forbids and which may offer to reset the database. X2-07: `.env.example` files miss `NEXT_PUBLIC_SITE_URL`, `MCP_ENABLED` and `MCP_RATE_LIMITER`.

**Files:**
- Modify: `README.md:26`, `apps/web/README.md:34` (`prisma:deploy`, link the "Creating a migration" section); `.env.example`, `apps/web/.env.example` (commented local-only entries `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, `MCP_ENABLED=true`, `MCP_RATE_LIMITER=memory`, and a pointer to the deployment.md table)

- [ ] **Step 1:** Edit. `grep -rn "prisma:migrate" README.md apps/web/README.md` returns nothing.
- [ ] **Step 2: Commit** `docs: safe migration command and local env entries in the READMEs`

Effort S. Risk none.

### Task 6: A site-wide content security policy, report-only first

Why: X2-04. No `Content-Security-Policy` anywhere except the archive rule, and no `frame-ancestors`. No current injection hole was found; this is a second line of defence.

**Files:**
- Modify: `next.config.ts:47-55`; `docs/deployment.md` (one paragraph: the policy, why report-only, how to switch to enforcing)
- Test: `tests/seo/nextConfig.test.ts`

- [ ] **Step 1: Failing test** `"every page sends a report-only CSP that allows only the site, Google Analytics and Clarity"`: the `/(.*)` rule has `Content-Security-Policy-Report-Only` containing `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, and the GA and Clarity hosts used by `components/site/site-analytics.tsx:19,32`.
- [ ] **Step 2:** Run. FAIL. **Step 3:** Implement. **Step 4:** Run; then open `/`, `/explorer/trade/partners` and `/methodology/expenditure` on the built server with the browser console open: no CSP report for the site's own scripts, styles, fonts or images.
- [ ] **Step 5: Commit** `security: report-only content security policy for every page`

Effort M. Risk low while report-only. Switching to enforcing is a later, separate decision.

---

## Phase 2: Broken behaviour and accessibility

### Task 7: Every multi-line chart has its phone legend and return pill

Why: X1-01 (high; merges U19-01, U24-01, U25-01, U27-01, U21-02, U14-07). Living standards income and spending, all four Money and banks pages, all four Energy and food pages, and the national life-expectancy chart have no phone legend and no "↑ chart" pill (DESIGN.md §8.3, owner decision D4). Trade partners can list 218 legend rows (5,420 px) and inflation products 40, because `legendCap` defaults to unlimited. Tests U19-10 and U25-03 are missing.

Also: U27-02 (the national fertility and life charts have no browser test; this task's life-chart case is the first), X1-22 (the phone-legend guard is a hand-kept route list; this task replaces it).

**Files:**
- Modify: `components/explorer-shell/chart-selection-aids.tsx:51-68` (`legendCap` defaults to 10); `components/household/household-explorer.tsx` (after the chart, ~l.158), `components/money-banks/money-banks-explorer.tsx` (~l.127), `components/energy-food/energy-food-explorer.tsx` (~l.93, hoist `lineSeries`), `components/demography/national-vital-charts.tsx:189`; remove the now-redundant `legendCap={10}` at `components/trade/trade-products.tsx:73`
- Test: `tests/browser/mobile-series-picking.spec.ts:169-190` (turn the hand-kept list into a list built from the sitemap's line-chart routes, or at least add the four families), `tests/explorer/chartSelectionAids.test.ts` (new `legendCap` unit test, so D195 can be dropped later)

Reuse: `ChartSelectionAids` as Poverty uses it (`components/poverty/poverty-explorer.tsx:98`). Considered and not chosen: rendering the aids inside `EditorialLineChart` (X1's suggestion). It removes the opt-in, but it changes 20 callers and the legend's position rule (`app/globals.css:126`); the route-list test gives the same protection for less change.

- [ ] **Step 1: Failing tests.** In `mobile-series-picking.spec.ts`, for each of Household income (`/en/explorer/living-standards/income/regions/georgia#view=line&sel=income.total,settlement.urban`), Money and banks loans and deposits (default view), Energy supply (`#view=line&sel=energy.supply.total,energy.production.total`) and births and deaths (life chart): at 390 px, `chart-phone-legend` is visible and has as many items as lines. Trade partners with 11 countries selected: no legend. Unit: `"hides the legend above ten lines by default"`.
- [ ] **Step 2:** Run. Expected: FAIL on the four families and the cap.
- [ ] **Step 3: Implement** the mounts (same props as Poverty: `series`, `chartShown={state.mode === "line"}`, `share`, `unit`, `formatValue`) and the default.
- [ ] **Step 4:** Run the spec and `npx playwright test tests/browser/{household,money-banks,energy-food,demography-births-deaths}.spec.ts`. Expected: PASS.
- [ ] **Step 4b (Q4, X1-21):** if the owner says yes (the default), change `@min-[768px]:hidden` at `chart-selection-aids.tsx:107` to `@min-[1100px]:hidden` and add a 1024 px case to the legend test.
- [ ] **Step 5: Commit** `fix(mobile): phone legend and return pill on every multi-line chart; legend capped at ten`

Effort M. Risk low.

### Task 8: Stacked charts name their colours [parallel-safe]

Why: U26-01 (births/deaths chart on 150 place pages has no key; colour is the only cue, WCAG 1.4.1), U27-04 (migration's six citizenship colours are named only below the fold on phones).

**Files:**
- Modify: `components/main-explorer/stacked-column-chart.tsx` (optional `legend?: { id: string; label: string; color: string }[]` rendered as a swatch row above the plot; absent = today's output), `components/demography/vital-section.tsx`, `components/demography/demography-migration.tsx`
- Test: `tests/explorer/stackedColumnChart.test.tsx` (or the nearest existing render test), `tests/browser/demography-population.spec.ts`

- [ ] **Step 1: Failing tests.** Unit: `"renders a swatch row when legend is given and nothing when it is not"`. Browser: on `/explorer/demography/population/region/imereti` the births/deaths chart shows three named swatches (Births, Deaths, Natural increase) at 390 and 1440 px.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `fix(a11y): stacked charts show a named colour key`

Effort S. Risk low.

### Task 9: Long country lists scroll inside their panel [parallel-safe]

Why: U21-01 (high): the 218-country list on Trade partners flows with the page, so the ranking, source note and Excel button sit about 7,000 px below the chart on phones and laptops (measured page height 9,894 px at 375 px). U21-04 (every row server-rendered), U21-05 (about 215 Tab presses to reach Excel).

Also: U14-05 (305 inflation products cost 308 Tab presses; give the product list the same scroll layout and a "skip the list" link).

**Files:**
- Modify: `components/main-explorer/series-selector.tsx:34,168` (new `listLayout: "scroll"`: a capped inner scroller, `max-h-[min(430px,60svh)] overflow-y-auto`, at every width); `components/trade/trade-partners-series-panel.tsx` and the domestic exports countries view (pass `listLayout="scroll"`); move the Excel button above the list in the partners panel
- Test: `tests/browser/trade-partners.spec.ts`, `tests/browser/mobile-series-picking.spec.ts:19` (the "flows with the page" loop must exclude scroll-layout pages)

Reuse: the existing aside scroller class at `series-selector.tsx:168`. DESIGN.md D4 ("lists flow with the page on phones") was written for short lists; record the exception for lists over 30 rows in DESIGN.md §7.7 in the same commit.

- [ ] **Step 1: Failing test** `"the country list scrolls inside its panel and the ranking is within two screens of the chart"`: at 375 px, `document.scrollingElement.scrollHeight < 4000` and the list element's `scrollHeight > clientHeight`.
- [ ] **Step 2–4:** FAIL, implement, PASS (also `trade-domestic.spec.ts`).
- [ ] **Step 5: Commit** `fix(trade): long country lists scroll inside their panel`

Effort S–M. Risk low.

### Task 10: Methodology articles fit a phone [parallel-safe]

Why: U29-01 (high): the Georgian H1 of `/methodology/municipalities` and `/methodology/household-income` is wider than the screen (page `scrollWidth` 430 and 391 at 375 px). The H1 is 38px on phones (`components/methodology/methodology-article.tsx:51`); the methodology hub uses 30px (DESIGN.md §5.2).

**Files:**
- Modify: `components/methodology/methodology-article.tsx:51` (30px below 768px, `[overflow-wrap:anywhere]`)
- Test: `tests/browser/methodology.spec.ts` (U29-05)

- [ ] **Step 1: Failing test** `"no methodology article scrolls sideways on a 360px phone"`: loop over `LIVE_METHODOLOGY_IDS` × {ka, en}, expect `scrollWidth === clientWidth`.
- [ ] **Step 2–4:** FAIL (two articles), implement, PASS.
- [ ] **Step 5: Commit** `fix(mobile): methodology headings wrap on phones`

Effort S. Risk none.

### Task 11: A skip link and correct landmarks

Why: X1-03, merging U01-02, U02-08, U03-01, U04-08, U05-10, U07-03, U08-05, U09-09, U13-10, U16-03, U18-04, U28-15, U30-15 (WCAG 2.4.1: keyboard users cross 20–24 sidebar stops on every explorer page). U01-01: on the landing page the header and footer sit inside `<main>`, so there is no banner or footer landmark. U01-22 is the missing test.

**Files:**
- Modify: `components/site/root-document.tsx:47` (visually hidden link, first child of `<body>`, visible on focus, text from `common.skipToContent`: ka draft "მთავარ შინაარსზე გადასვლა", en "Skip to content"); `lib/pages/explorer-layout.tsx:15` (`id="content" tabIndex={-1}` on the content wrapper); the site-page `<main>`s in `components/landing/landing-page.tsx`, `lib/pages/about.tsx`, `lib/pages/connect.tsx`, `components/methodology/*` (`id="content"`); `components/landing/landing-page.tsx:58-61,232` (header and footer become siblings of `<main>`); `lib/i18n/messages/{ka,en}/common.json`
- Test: `tests/browser/bilingual-navigation.spec.ts` (or a new `tests/browser/landmarks.spec.ts` if no spec fits)

- [ ] **Step 1: Failing tests.** `"the first Tab reaches a skip link that moves focus to the content"` on `/explorer/debt` and `/en/explorer/debt`, with JavaScript on and off. `"the landing page has one banner, one main and one footer"` on `/` and `/en` (`getByRole("banner")`, `"main"`, `"contentinfo"` each count 1).
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** `fix(a11y): skip-to-content link on every page; landing landmarks`

Effort S. Risk low.

### Task 12: Line charts tell keyboard and screen-reader users what they show

Why: X1-02, merging U03-02, U04-01, U06-01, U06-02, U07-04, U08-04, U09-07, U10-02, U10-03, U11-02, U12-10, U13-02, U15-05, U16-02, U17-03, U18-08, U19-06, U20-08, U21-11, U22-10, U23-11, U24-07, U25-02, U26-06 (every line chart is a tab stop that does nothing from the keyboard; 24 of 27 charts are announced only as "Multi-year trend").

**Files:**
- Modify: `components/main-explorer/editorial-line-chart.tsx:285-288` (default accessible name built from the drawn series: "{first series}, {n} lines, {first year}–{last year}", and the latest value of each line in an sr-only figcaption linked by `aria-describedby`; `onKeyDown` with Arrow/Home/End stepping the same hover index the pointer uses); `components/main-explorer/chart-frame.tsx:146-151` (keeps `tabIndex={0}` because the chart now answers keys); `lib/i18n/messages/{ka,en}/controls.json` (`chartSummary` with `{series}`, `{count}`, `{start}`, `{end}`)
- Test: `tests/explorer/editorialLineChart.test.tsx` (or the nearest render test), `tests/browser/main-explorer.spec.ts`

Reuse: the keyboard pattern already in `components/main-explorer/stacked-column-chart.tsx:296-331,451` and `stepPeriodIndex` in `lib/explorer/chartNavigation.ts` (already unit-tested). Callers that pass `ariaLabel` keep it.

- [ ] **Step 1: Failing tests.** Unit: `"names the chart from its series and years when no label is passed"`; `"the figcaption lists each line's latest value"`; `"a missing year is read as not available, never as zero"` (Review Focus 2). Browser: on `/explorer/expenditure`, Tab to the chart, press ArrowLeft, expect the readout to show the previous year; Home shows the first year.
- [ ] **Step 2–4:** FAIL, implement, PASS. Also run `mobile-fit-charts.spec.ts` (the chart's size must not change).
- [ ] **Step 5: Commit** `fix(a11y): line charts have a real name and arrow-key reading`

Effort M. Risk medium: one shared component; snapshot tests that capture the SVG will need their `aria-label` updated (list them in the commit body).

### Task 13: Series lists work for screen readers and fingers

Why: X1-06 (caret 22px wide, axe WCAG 2.2 target-size failure; merges U20-01, U16-14, U17-05, U18-07, U25-06), X1-07 (13 ministry carets all called "ქვეპროგრამები", 12 inflation carets all "Subgroups"; U03-03, U13-09), X1-16 (tab rows announced as stray toggles on some pages; U03-11, U05-09, U08-11, U10-05), U03-12 ("Clear" checkbox announces mixed state).

**Files:**
- Modify: `components/main-explorer/series-selector.tsx:252,259` (`w-6`; shrink the `before:` horizontal extension to match, keep the 12px downward extension; default caret label `message("controls.subitemsFor", { label })`); `components/ui/editorial.tsx` (new `TextTabGroup({ ariaLabel, children })`, as `SegmentedTabs` does at l.111-113), the callers listed in X1-16 that render a bare tab row; the bulk checkbox's name; `lib/i18n/messages/{ka,en}/controls.json`
- Test: `tests/explorer/seriesSelector.test.ts`, `tests/explorer/editorial.test.tsx` (or nearest)

- [ ] **Step 1: Failing tests.** `"a caret is at least 24px wide and named after its row"`; `"a tab row is a labelled group"`; `"the select-all checkbox keeps one name and reports state through aria-checked"`.
- [ ] **Step 2–4:** FAIL, implement, PASS; run `debt.spec.ts`, `main-explorer.spec.ts`, `poverty.spec.ts`.
- [ ] **Step 5: Commit** `fix(a11y): named, full-size carets and labelled tab groups in series lists`

Effort S. Risk low.

### Task 14: Data tables and breadcrumbs announce correctly [parallel-safe]

Why: X1-14 (columns layout of `ExplorerTable` has no `scope` and uses `<td>` for row labels; WCAG 1.3.1; U03-04, U19-07), X1-15 (English "Breadcrumb" landmark name on Georgian pages; U03-13, U04-09, U05-10, U06-11, U09-08, U16-13, U30-16).

**Files:**
- Modify: `components/main-explorer/explorer-table.tsx:305-330`; `components/shell/page-header.tsx:35,58`, `components/seo/breadcrumb-json-ld.tsx:24`; `lib/i18n/messages/{ka,en}/common.json` (`breadcrumb`: ka draft "ნავიგაციის ბილიკი", en "Breadcrumb")
- Test: `tests/explorer/explorerTable.test.tsx` (or nearest), `tests/browser/main-explorer.spec.ts:1382` (update the pinned English name to the localized one)

- [ ] **Step 1–4:** Failing tests `"column headers carry scope=col and row labels are th scope=row"` and `"the breadcrumb landmark is named in the page language"`; implement; PASS.
- [ ] **Step 5: Commit** `fix(a11y): table header scopes and a localized breadcrumb name`

Effort S. Risk low.

### Task 15: Series names are never cut in the middle of a word [parallel-safe]

Why: X1-05 (U03-05, U04-03, U04-12, U05-04, U05-05, U05-07). Names are cut in JavaScript (`components/main-explorer/explorer-view.tsx:102`, `components/main-explorer/indicators.tsx:38-40`, `components/analysis/ranking.tsx:19-26` and `compactLabel` at l.73-74), so the phone legend, tooltip, movers and ranking show "Health, labour and social aff…" and screen readers read the cut text. DESIGN.md §8.4.

**Files:**
- Modify: the three files above (delete the cuts; keep the CSS clamps that already exist: `chart-frame.tsx:318`, `chart-selection-aids.tsx:111`; add `line-clamp-2` + `title` where a row has no clamp)
- Test: `tests/explorer/explorerView.test.tsx` / `tests/explorer/indicators.test.tsx` (or nearest)

- [ ] **Step 1–4:** Failing test `"long names reach the DOM in full"`; implement; PASS; run `mobile-fit-charts.spec.ts` and `bilingual-analysis.spec.ts` (labels must still fit).
- [ ] **Step 5: Commit** `fix(ui): full series names in legend, tooltip and rankings`

Effort S. Risk low.

### Task 16: Forecast years are marked as forecasts [parallel-safe]

Why: U06-03 (debt shows a projection as the plain "latest value"), U07-01 (deficit tooltip reads a projection year exactly like an actual year). U07-16 is the missing test.

**Files:**
- Modify: `components/debt/debt-explorer.tsx`, `components/deficit/deficit-explorer.tsx` (pass the existing `preliminary` flags and `preliminaryLabel` props); `components/explorer-shell/chart-selection-aids.tsx` (`legendValue` uses the last non-forecast value, with its year)
- Test: `tests/explorer/chartSelectionAids.test.ts`, `tests/browser/deficit.spec.ts`, `tests/browser/debt.spec.ts`

- [ ] **Step 1–4:** Failing tests `"hovering a projection year shows the forecast label"` (deficit and debt) and `"the phone legend shows the last published value"`; implement; PASS.
- [ ] **Step 5: Commit** `fix(debt,deficit): mark forecast years in tooltip and legend`

Effort S. Risk low.

### Task 17: Debt, deficit and inflation pages follow address-bar changes

Why: U06-04, U07-02 (debt and deficit read the `#hash` once and ignore later changes), U15-08 (inflation cities), U13-12 (four hand-written hash blocks in the inflation pages). The shared hook already handles this for Trade, External flows, Wages and Poverty (audit-fixes Task 11). Component-reuse Task 4 moves Unemployment, Sectors, Regional economies, Money and banks and Energy and food, so they are not repeated here.

**Files:**
- Modify: `components/debt/use-debt-explorer-state.ts`, the deficit state hook in `components/deficit/`, the four inflation explorers' hash blocks; consumers of `useHashState` (`components/explorer-shell/use-hash-state.ts`, moved there by component-reuse Task 4; if that has not merged, import it from `components/external/`)
- Test: `tests/browser/debt.spec.ts`, `tests/browser/deficit.spec.ts`, `tests/browser/inflation-cities.spec.ts` (U06-18)

Reuse: `useHashState` with the existing parse/serialize pairs (`lib/explorer/debtUrlState.ts`, `parseDeficitHash`/`serializeDeficitHash`, the inflation state modules).

- [ ] **Step 1: Failing tests.** For each of the three pages: `"editing the hash in the address bar updates the view"` and `"an explicitly empty sel= survives Back and Forward"` (Review Focus 3).
- [ ] **Step 2–4:** FAIL, implement, PASS (all inflation specs too).
- [ ] **Step 5: Commit** `fix: debt, deficit and inflation pages follow hash changes through the shared hook`

Effort M. Risk medium (four pages' state wiring); the existing deep-link tests guard it.

### Task 18: One short line under each heading, and it describes what is shown

Why: DESIGN.md §17 (owner rule) breaks on U02-01 (explorer hub has two sentences), U10-06 (GDP has two lines), U22-05 (Trade services keeps a paragraph; confirmed at `components/trade/trade-services.tsx:35`), U28-07 (Wages, Trade, Energy and food hub leads wrap to 5 lines on phones), U14-13 (inflation products three-line lead), U27-03 (age-sex and births leads 150–160 characters). The lead describes something else: U20-02 (Poverty lead stays on the national rate on the Relative and International tabs), U13-01 (inflation categories header coverage uses the monthly tab's span on the default tab; `components/inflation/inflation-categories.tsx:101`).

**Files:**
- Modify: `lib/i18n/messages/{ka,en}/{hub,gdp,trade,wages,energyFood,inflation,demography}.json` (shortened leads, drafts in the commit body for owner review); `components/trade/trade-services.tsx:35` (delete the `<p>`) and `tests/explorer/tradeServicesRender.test.tsx` (D194: drop the assertion pinning it); `components/gdp/gdp-overview.tsx` (unit into the latest-value note); `components/poverty/poverty-explorer.tsx` (lead follows the tab); `components/inflation/inflation-categories.tsx:101` (`categoryCoverage(index, state.tab)`)
- Test: the "nothing but the heading above the controls" loop (D188 merges the seven per-page copies into one loop; do that loop here), `tests/browser/poverty.spec.ts`, `tests/browser/inflation-categories.spec.ts`

- [ ] **Step 1: Failing tests.** One loop over every explorer and hub route at 375 px: the element after the H1 is a single line (height ≤ 1.6 × its line height). `"the poverty lead names the series of the active tab"`. `"the categories header states the active tab's months"`.
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** `fix(design): one short lead line under every heading, matching the view (§17)`

Effort M. Risk low; wording is the owner's call (see "Georgian text for owner review").

### Task 19: llms.txt lists every dataset, and a test keeps it that way [parallel-safe]

Why: X4-01 (high): `public/llms.txt:7` says there are "no datasets beyond those listed here", but Money and banks, Energy and food and Trade services are absent, so AI clients tell users the site has no such data. X4-02 (nothing fails when a hub ships without an entry; the same gap was fixed once on 2026-10-11 and came back). X4-03 (a wrong description of the English budget hub).

**Files:**
- Modify: `public/llms.txt` (entries for the three families, each page, "Browse-only: no MCP tool and no bulk file" where true; fix line 3 and the Trade entry at :42 and the X4-03 sentence)
- Test: `tests/seo/agentFiles.test.ts`

- [ ] **Step 1: Failing test** `"llms.txt names every hub, section and methodology route in the sitemap"` (sitemap routes under `/explorer` at depth ≤ 3 plus every `/methodology/*`).
- [ ] **Step 2–4:** FAIL (lists the missing routes), edit llms.txt, PASS.
- [ ] **Step 5: Commit** `docs(llms): list Money and banks, Energy and food and Trade services; guard against gaps`

Effort S. Risk none.

### Task 20: The sidebar closes and marks the current page correctly [parallel-safe]

Why: U02-06 (tapping the current page leaves the phone menu covering the page), U02-07 (Budget link lacks `aria-current` on the hub), U18-06 (Wages region pages lose `aria-current`; `data-sidebar.tsx:359` uses `endsWith`).

**Files:**
- Modify: `components/shell/data-sidebar.tsx` (one `onNavigate` on the `<nav>`; the two active rules)
- Test: `tests/browser/mobile-site-menu.spec.ts`, `tests/browser/wages.spec.ts`

- [ ] **Step 1–4:** Failing tests `"tapping the current page closes the menu"`, `"Budget is current on /explorer"`, `"Regions stays current on a wages region page"`; implement; PASS.
- [ ] **Step 5: Commit** `fix(nav): sidebar closes on any link and marks the current section`

Effort S. Risk low. Task 34 later rebuilds the sidebar from config; these tests guard that rebuild.

### Task 21: Inflation pages: distinct colours, honest counts, a phone table picker [parallel-safe]

Why: U14-06 (two selected products can get the same colour; `lib/explorer/inflationProducts.ts:151-155` uses palette modulo 14), U13-04 (the inflation-target row counts as selected on tabs where it draws nothing), U15-01 (city table mode on phones stacks 13 text links and pushes the table 1,085 px down; Categories already fixed this).

**Files:**
- Modify: `lib/explorer/inflationProducts.ts:151-155` (reuse the shade rule of `colorForProgram`/`PROGRAM_SHADES` in `lib/explorer/colors.ts`), `components/inflation/inflation-overview*.tsx` (target row disabled and not counted off the annual tab), `components/inflation/inflation-cities*.tsx` (reuse the hidden-tabs + native select pair from `components/inflation/inflation-category-table.tsx:70-98`; extract it as `TableSeriesPicker` beside it only if both then import it)
- Test: `tests/explorer/inflationProducts.test.ts`, `tests/explorer/inflationOverview.test.ts`, `tests/browser/inflation-cities.spec.ts`

- [ ] **Step 1–4:** Failing tests `"fifteen selected products get fifteen distinct colours"`, `"the target row is not counted on the monthly tab"`, `"a city table on a phone picks its line from a select"`; implement; PASS.
- [ ] **Step 5: Commit** `fix(inflation): distinct product colours, honest counts, a phone table picker`

Effort M. Risk low.

### Task 22: Search boxes appear where they help and say what they found [parallel-safe]

Why: U23-03 and U21-09 (search shown over 3–5 rows, against DESIGN.md §7.7 "only when the list has more than ten rows"), U24-04, U06-06, U07-07 (dead search code where the box never shows), U08-03 (municipal index search gives screen readers no result count; DESIGN.md §20), U21-06 (English "Turkey", "USA" find nothing on Trade partners; search one language only).

**Files:**
- Modify: `components/external/money-from-abroad-series-panel.tsx:22`, the trade overview panel (`searchable={rows > SEARCHABLE_MIN_ROWS}`); delete the dead `query` branches in `components/money-banks/money-banks-explorer.tsx`, `components/debt/debt-series-panel.tsx`, `components/deficit/*` and the unused `moneyBanks.search` key; `components/municipalities/municipalities-index*.tsx` (`role="status"` count, reusing the picker's markup); `lib/i18n/search.ts` (`matchesLabelQuery` searches both languages and folds diacritics) plus a short alias list in the trade partners data (Turkey, USA, UK, Russia)
- Test: `tests/i18n/search.test.ts` (or nearest), `tests/browser/money-from-abroad.spec.ts` (U23-17), `tests/browser/municipalities.spec.ts`, `tests/browser/trade-partners.spec.ts`

- [ ] **Step 1–4:** Failing tests `"no search box on lists of ten rows or fewer"`, `"the index announces how many places match"`, `"Turkey finds Türkiye in English and Georgian"`; implement; PASS.
- [ ] **Step 5: Commit** `fix(search): search only on long lists, announced results, both languages`

Effort S–M. Risk low.

### Task 23: Map markers, bubbles and landing links are big enough to tap [parallel-safe]

Why: U08-02 (small city markers on the municipal map shrink below a usable disk; `lib/explorer/mapTouchTargets.ts` assumes a 350 px map where the real one is 335 px), U05-03 (analysis bubbles cannot be tapped or hovered), U01-03 (the landing hero CTA drops below the 44 px rule from 768 px; DESIGN.md §19), U01-04 (a Georgian dataset row crosses the gutter at 768–899 px).

**Files:**
- Modify: `lib/explorer/mapTouchTargets.ts` (24 px minimum disk; measured width), `components/analysis/*` budget field (nearest circle to the pointer on `pointerdown`), `components/landing/landing-page.tsx` and the dataset row component
- Test: `tests/explorer/mapTouchTargets.test.ts`, `tests/browser/bilingual-analysis.spec.ts`, `tests/browser/landing.spec.ts` (extend the narrow-viewport loop to 768 and 820, U01-23), `tests/browser/mobile-repairs-nav.spec.ts:115` (add a ≥ 768 px case)

- [ ] **Step 1–4:** Failing tests per finding; implement; PASS.
- [ ] **Step 5: Commit** `fix(touch): usable map markers, tappable bubbles, landing targets at tablet widths`

Effort M. Risk low.

### Task 24: Labels that say what a number is [parallel-safe]

Why: U10-01 (GDP currency toggle is named "GEL"/"USD" in English on the Georgian page; `components/gdp/gdp-overview.tsx:207-210`), U28-08 (Energy and food hub cards show bare numbers; `lib/explorer/energyFoodHubCards.ts`), U19-04 (household region page titles say "Spending — Tbilisi", which reads as municipal budget spending), U29-02 (methodology source table year chips outnumber the rows), U29-04 (the Georgian debt JSON link says "სახელმწიფო ვალი" (state debt), English says "Government debt"; Georgian text, see the owner list).

**Files:**
- Modify: `components/gdp/gdp-overview.tsx:207-210` (`t("gel")`/`t("usd")` + `aria-hidden` symbols) and the gdp-overview spec selectors that look for "GEL"; `lib/explorer/energyFoodHubCards.ts` (`energyFoodUnit(section.id)`); household page metadata in `lib/pages/household.tsx`; `components/methodology/source-archive.tsx` (hide the year row when there are ≤ 12 rows); `lib/i18n/messages/ka/methodology.json` (`jsonDebt`)
- Test: `tests/browser/gdp-overview.spec.ts`, `tests/explorer/energyFood.test.ts`, `tests/explorer/household.test.ts`, `tests/explorer/methodologyArticle.test.tsx`

- [ ] **Step 1–4:** Failing test per item; implement; PASS.
- [ ] **Step 5: Commit** `fix(ui): localized currency toggle, units on hub cards, clearer household titles`

Effort S. Risk low.

---

## Phase 3: Page weight and speed

### Task 25: Stop downloading the whole site in the background

Why: X1-04, merging U01-08, U08-01, U12-07, U16-01. No sidebar, footer, landing-row or municipal-index `<Link>` sets `prefetch`, so Next prefetches every static route that enters the viewport: 32–36 background fetches and 1.16–1.47 MB decoded on each explorer page load; one scroll of the municipal index on a phone pulls about 1 MB gzip.

**Files:**
- Modify: `components/shell/data-sidebar.tsx:212-523`, `components/site/site-footer-view.tsx`, the landing ledger and dataset-row links in `components/landing/*`, the row links in `components/municipalities/municipalities-index*.tsx` (`prefetch={false}`; keep the hero CTA prefetching)
- Test: `tests/browser/pristine-urls.spec.ts` or a new assertion in `main-explorer.spec.ts`: `"opening an explorer page fetches no other page's data"` (count `?_rsc=` requests during load and idle: 0)

- [ ] **Step 1–4:** Failing test (counts 30+); implement; PASS. Check a sidebar click still navigates without a full reload.
- [ ] **Step 5: Commit** `perf: no background prefetch of every route from the sidebar, footer and lists`

Effort S. Risk low: a first click on a sidebar link waits for its own page data (static, small).

### Task 26: Trade data at the precision the site shows (waits on Q1)

Why: U22-01 (high): Trade products ships 264 KB gzip per visit, 58% of it 17-digit numbers; charts show millions with one decimal. U21-03: the same on Partners (1.05 MB HTML, 215 KB gzip).

**Files:**
- Modify: `lib/data/tradeProducts/importTradeProducts.ts:64` (`toClientTradeProductsData`), `lib/data/tradePartners/importTradePartners.ts` (`packTradePartnerFacts`), the domestic exports packer; tests that pin 5–7 decimals (`tests/browser/trade-partners.spec.ts` "exact selected figures", the domestic Excel test)
- Test: `tests/data/tradeProducts/*.test.ts`, `tests/data/tradePartners/serving.test.ts`

- [ ] **Step 1: Failing tests.** `"client trade values are whole dollars"`; `"a workbook total equals the sum of its rows"` (Review Focus 4).
- [ ] **Step 2–4:** FAIL, round to whole US dollars (Q1 default), update the pinned figures, PASS. Measure `curl -s -H 'Accept-Encoding: gzip' localhost:3100/explorer/trade/products | wc -c` before and after; record both in the commit body.
- [ ] **Step 5: Commit** `perf(trade): ship values in whole dollars`

Effort S. Risk medium: Excel figures change in the last decimals; this is why Q1 asks the owner.

### Task 27: Pages ship only the fields the browser reads [parallel-safe]

Why: fields the client never reads: U22-02 and U23-02 (English names shipped on Georgian pages, about 25 KB gzip on trade products), U17-01 (the unemployment regions map index ships the whole comparison dataset), U17-02, U21-15, U20-11, U25-09, U06-17, U05-06, U29-14 (constant or unused fields per fact).

Also (low): U01-11 (footer logo preloaded ahead of the header logo), U22-03 (empty alias arrays and repeated source block), U24-08 (Money and banks ships every source on every page).

**Files:**
- Modify: `lib/i18n/presentation.server.ts:11` (`englishLabels` only when `locale === "en"`), `lib/pages/unemployment-regions.tsx` (index gets the map model only), the page loaders named in each finding
- Test: one render test per page in the existing `tests/explorer/*Render.test.tsx` files: `"the Georgian page carries no English series names"`, `"the regions index carries no comparison facts"`

- [ ] **Step 1–4:** Failing tests; implement each projection; PASS; record HTML gzip size before and after for trade products, money from abroad and the unemployment regions index.
- [ ] **Step 5: Commit** `perf: ship only the fields each page reads`

Effort M. Risk low.

### Task 28: Compact data on the heaviest topic pages

Why: U23-01 (Money from abroad still sends verbose fact objects, 1.55 MB HTML, although audit-fixes Task 9 trimmed two fields), U18-01 (Wages industries 647 KB HTML), U19-03 (household Georgia pages twice the size of region pages), U12-08 (regional economy pages: 99 KB of 110 KB is repeated keys), U11-03 (sectors: 42% of HTML is repeated keys), U27-08 (age facts), U26-03 (each population place page ships every place's rows), U03-07 (expenditure ships the whole ministries history with names repeated per year).

**Files:**
- Modify: the client-data builders for each page (`lib/data/externalFlows/importMoneyTransfers.ts`, `lib/pages/wages.tsx`, `lib/pages/household.tsx`, `lib/pages/regional-economy.tsx`, `lib/pages/economic-sectors.tsx`, `lib/pages/demography-age-sex.tsx`, `lib/pages/demography-population*.tsx`, `lib/pages/expenditure.tsx`) and the matching model builders in `lib/explorer/*` that unpack them
- Test: the existing model tests for each page must pass unchanged (they prove the unpacked model is identical); add one size assertion per page in its render test (`html.length` below the measured value minus 30%)

Reuse: the tuple shape and `packTradePartnerFacts` pattern from `lib/data/tradePartners/importTradePartners.ts` (audit-fixes Task 9). Extract a generic `packFacts`/`unpackFacts` pair beside it only when the second page needs it.

- [ ] **Step 1–4:** One page at a time: add the size assertion (FAIL), pack, run that page's model tests and browser spec (PASS).
- [ ] **Step 5: Commit** `perf: compact fact tuples on the heaviest topic pages`

Effort L. Risk medium: each page's model builder changes input shape; the unchanged model tests are the guard.

### Task 29: Inflation pages load faster [parallel-safe]

Why: U14-01 (610 product index runs, 680 KB inline in every products page view, never cached), U14-02 (all 305 selector rows server-rendered and hydrated), U14-03 (ranking rebuilt three times per click; 94–180 ms per selection), U14-04 (all runs unpacked eagerly), U13-03 (categories ships `mom_pct` rows the default tab never reads; the duplicated SVG part of that finding is intended, DESIGN.md §8.3), U13-05 (overview does not use the run-length packer the categories page has).

**Files:**
- Modify: `lib/pages/inflation.tsx` (products runs published once as a static content-hashed JSON file and fetched on mount; the build already writes static publications), `components/inflation/inflation-products*.tsx`, `lib/explorer/inflationProducts.ts` (rank once in `buildProductIndex`, lazy unpack), `lib/explorer/inflationCategories.ts:75` (reuse the packer for overview facts; split `mom_pct` runs)
- Test: `tests/explorer/inflationProducts*.test.ts`, `tests/browser/inflation-products.spec.ts`, `tests/browser/inflation-overview.spec.ts`

- [ ] **Step 1–4:** Failing size and timing assertions (products HTML gzip below 120 KB; a click re-ranks zero times, by spy); implement; PASS.
- [ ] **Step 5: Commit** `perf(inflation): products data as a cached file, one ranking, lighter overview`

Effort L. Risk medium: a fetched file adds a loading state (needs the empty and error states of DESIGN.md §20).

### Task 30: Each page downloads only its own code

Why: X1-13: `lib/pages/inflation.tsx:4-7` imports all four inflation explorers, so every inflation route, including the hub, loads about 45 KB gzip for three other pages; `components/main-explorer/main-explorer.tsx:31` imports `AnalysisView`, about 18 KB gzip on expenditure and revenue (U03-06, U04-06, U04-13, U05-01). U28-01, U18-02, U19-02: hubs and map indexes import explorer chart code they never render (+22 to +70 KB gzip).

**Files:**
- Modify: split `lib/pages/inflation.tsx` into one module per route (hub module imports no explorer); `components/main-explorer/main-explorer.tsx` (analysis gets its own client entry used by `lib/pages/analysis.tsx`; drop the `isAnalysis` branches from `use-explorer-state.ts`); move each `render*Hub` into a module that imports no explorer (`lib/pages/hubs/<topic>.tsx`, as `economy.tsx` already does); `components/wages/wages-explorer.tsx` → `WagesRegionsIndex` in its own file; `components/household/household-explorer.tsx` → `HouseholdIndex` in its own file
- Test: a build-output check in `tests/scripts/` or a Playwright request count: `"the inflation hub loads no explorer chunk"`; existing route specs pass

- [ ] **Step 1–4:** Measure first-load JS (modern chunks only; skip the `noModule` polyfill) for the inflation hub, expenditure and the wages regions index; implement; re-measure; record both in the commit body.
- [ ] **Step 5: Commit** `perf: route-level code splitting for inflation, budget analysis and hubs`

Effort M–L. Risk medium: moves imports in many page modules; `npm run build` must be run once for this task.

### Task 31: Pages send only the messages they use

Why: X1-12, merging U01-12, U02-15, U07-09, U09-02, U10-12, U13-06, U14-19, U15-07, U17-15, U22-02, U26-04, U27-07, U28-02. The `common` namespace is sent again by 39 of 51 page presentations; several components are client components only to read the locale.

**Files:**
- Modify: `lib/i18n/presentation.server.ts` (`getPresentation` drops namespaces the layout already provides), the 39 call sites that list `common`; `components/shell/page-header.tsx`, `components/ui/coming-soon-badge.tsx`, `components/main-explorer/month-grid-table.tsx` become server components taking `locale`/labels as props where they have no state
- Test: `tests/i18n/presentation.test.ts` (or nearest): `"a page presentation never repeats the layout's namespaces"`

- [ ] **Step 1–4:** Failing test; implement; PASS; `npm run i18n:check`.
- [ ] **Step 5: Commit** `perf(i18n): send each page only the messages it uses`

Effort M. Risk low.

### Task 32: /mcp answers trivial requests without rebuilding everything

Why: U30-01 (every request, even `ping`, rebuilds coverage, facts and instructions and re-registers 14 tools; 63 ms for a ping), U30-02 (the bundled snapshot is 46 MB because `prepare-fact-query-snapshot.ts:29` pretty-prints it; 0.6 s and 220 MB per cold start), U30-03 (`tools/list` is 119–134 KB of repeated schema), U30-08 (an id search returns the whole 17 KB catalogue).

Also (low, same files): U30-05 (pass the request id into rate-limit errors), U30-06 (log bad-argument errors as such), U30-07 (cap echoed id strings at about 80 characters), U30-12 ("ka / en" titles on every tool), U30-13 (point a browser visitor to /connect from the 405 answer), U30-14 (one line on /connect about fair-use limits), U30-09, U30-10, U30-11 (stale hardcoded coverage, a duplicated derivation, misleading names).

**Files:**
- Modify: `lib/mcp/*` (module-level cache of `datasetCoverage`, `facts`, `serverInstructions` keyed by the snapshot object), `scripts/prepare-fact-query-snapshot.ts:29` (minified JSON), the shared output schema (`$defs`/`$ref`), the catalogue tool's `search` filter; the stale numbers in `lib/factQuery/snapshot.ts` and `docs/deployment.md`
- Test: `tests/mcp/tools.test.ts`, `tests/mcp/outputSchema.test.ts`, `tests/mcp/snapshot.test.ts`, `tests/factQuery/reference.test.ts` (stop condition)

- [ ] **Step 1–4:** Failing tests `"the second request reuses the cached coverage"` (spy), `"the packaged snapshot has no indentation"`, `"tools/list is under 60 KB"`, `"a search returns only matching entries"`; implement; PASS including the reference fixture.
- [ ] **Step 5: Commit** `perf(mcp): cache per snapshot, minified snapshot, smaller tool list`

Effort M. Risk medium: tool schema shape changes for clients; the protocol-compatibility tests must pass.

---

## Phase 4: Duplicated code

Do this phase after the component-reuse branch has merged (Op 2).

### Task 33: One explorer kit for the five topic explorers

Why: X1-09 (poverty, household, wages, money-banks and energy-food are near-identical copies: row renderer, counts, toggles, and five model modules in `lib/explorer/{poverty,household,moneyBanks,energyFood,wages}.ts` repeating `*SeriesColor`, `*State`, `parse*Hash`, `build*Model`); U18-05, U20-03, U24-03 (nested picker logic copied), U20-04 (source-years block copied), U24-05 (workbook source mapping copied).

**Files:**
- Create: `components/explorer-shell/nested-series-list.tsx` (closest existing: `SeriesSelectorRow` in `components/main-explorer/series-selector.tsx`; it renders one row and cannot own the count and toggle rules), `lib/explorer/topicSeries.ts` (shared colour, coverage and source-years helpers)
- Modify: the five explorers and five model modules; `lib/explorer/*Workbook.ts` (one `loadSourcedWorkbookSources`)
- Test: the existing unit and browser tests of the five pages pass unchanged; add `tests/explorer/nestedSeriesList.test.tsx`

- [ ] **Step 1–4:** Write the shared unit test (FAIL); extract; move one explorer at a time, running its tests after each; PASS.
- [ ] **Step 5: Commit** `refactor: one nested series list and model helpers for the five topic explorers`

Effort L. Risk medium. Depends on component-reuse Task 8 (`FlatSeriesPanel`); do not duplicate it.

### Task 34: The sidebar comes from one navigation config

Why: X1-08 (`components/shell/data-sidebar.tsx` is one 502-line function with 25 hand-written active flags and a different active rule per topic), U02-05, U02-09, U02-11 (route knowledge in three places). X4-20 (six of eleven hubs are missing from the header menu, footer and 404 page) waits on Q3.

**Files:**
- Create: `lib/navigation/navTree.ts` (closest existing: `lib/navigation/datasetHubs.ts`, which lists hubs only; extend it with children and match rules if that reads better, and say which in the commit)
- Modify: `components/shell/data-sidebar.tsx`, `lib/navigation/datasetHubs.ts`, the hub note table from U02-11
- Test: `tests/navigation/navTree.test.ts` (every sitemap explorer route has exactly one active entry); the Task 20 browser tests

- [ ] **Step 1–4:** Failing unit test; implement; PASS; run `mobile-site-menu.spec.ts`, `bilingual-navigation.spec.ts`.
- [ ] **Step 5: Commit** `refactor(nav): sidebar driven by one navigation tree`

Effort M. Risk medium.

### Task 35: Dataset structured data through one builder [parallel-safe]

Why: hand-written Dataset JSON-LD that is thinner than the shared builder (`lib/seo/structuredData.ts:234` `explorerDatasetJsonLd`): U22-06, U28-14, U29-03, U24-06, U17-09, U18-09, U23-09, U21-13, U14-14, U13-07, U15-06, U16-18, U21-14, U12-13. The same `@id` in Georgian and English with different names: U06-13, U07-14, U20-07, U25-08.

Also: U20-14 (Poverty metadata and JSON-LD have no test; this task's sitemap-wide test covers it), U08-07 (one description repeated 76 times in `hasPart`), U09-13 (a measure claimed that the page does not carry).

**Files:**
- Modify: `lib/seo/datasetVocabulary.ts` (add trade, money, unemployment, wages, external, energy-food, household, inflation ids), `lib/seo/structuredData.ts` (`@id` from `pageHref(href, locale)`; optional "no CSV" mode for methodology), each page loader named in the findings
- Test: `tests/seo/structuredData.test.ts`: `"every explorer page's Dataset has license, creator and a per-language @id"` over the sitemap

- [ ] **Step 1–4:** FAIL, implement, PASS; `npx playwright test tests/browser/seo.spec.ts`.
- [ ] **Step 5: Commit** `refactor(seo): every Dataset node from the shared builder, one @id per language`

Effort M. Risk low.

### Task 36: Small shared pieces used everywhere [parallel-safe]

Why: X1-10 (the Line/Table switch is copied in 19 files; `ModeTabs` already exists at `components/demography/national-vital-charts.tsx:24`), X1-11 (the "updated" date rule re-implemented in 17 places; DESIGN.md §6 says one formatter), X1-19 (`firstServedYear` dead; 15 needless exports), X1-17 (`planned` required but all-false at 22 call sites), U26-02 and U27-10 (demography helpers in an unrelated chart file), U16-07, U17-14, U18-12 (a generic heatmap named after unemployment age).

**Files:**
- Move: `ModeTabs` to `components/explorer-shell/mode-tabs.tsx`; the demography `Download`/`ModeTabs`/`signedPersons` helpers to one demography helper file; the heatmap wrapper to a neutral name
- Modify: the 19 Line/Table call sites; `lib/explorer/coverageLabel.ts` (export `updatedDate(d, locale)`) and its 17 re-implementations; `components/main-explorer/editorial-line-chart.tsx:37` (`planned` optional); delete `lib/explorer/coverage.ts:6` `firstServedYear`
- Test: existing tests pass; `tests/explorer/coverageLabel.test.ts` adds `updatedDate` cases

- [ ] **Step 1–4:** One concern per sub-step, running the affected specs after each.
- [ ] **Step 5: Commit** `refactor: shared Line/Table switch, one updated-date formatter, neutral heatmap name`

Effort M. Risk low.

### Task 37: Page-local cleanups that remove drift [parallel-safe]

Why: U12-05 (regional economy coverage years and counts hardcoded in copy and metadata; AGENTS.md "derive from loaded facts"), U10-08 (GDP source mapping fans one row into duplicate ids), U03-08 (the budget workbook input builder has no unit test), U01-14 (landing GDP figure has a second source), U06-07, U07-08, U06-15 (two copies of Georgian metadata).

Also (low, dead code and small duplicates, fixed while in these files): U01-15, U01-16, U01-17, U01-18, U02-02, U02-10, U03-09, U03-10, U05-08, U06-16, U07-06, U08-08, U09-05, U09-06, U10-09, U10-10, U10-11, U11-04, U11-05, U12-03, U12-04, U12-14, U13-13, U14-16, U14-17, U14-18, U15-04, U16-08, U16-09, U16-19, U17-08, U18-13, U19-08, U19-09, U20-12, U21-12, U21-20, U22-07, U22-08, U22-09, U23-07, U23-08, U23-15, U25-05, U26-15, U27-11, U28-17, U28-18, U29-12, U29-15.

**Files:**
- Modify: `lib/i18n/messages/{ka,en}/regional-economies.json` and `lib/pages/regional-economies.tsx` (params), `lib/pages/gdp.tsx` source mapping, move the budget workbook builder to `lib/explorer/budgetWorkbook.ts`, `lib/landing/*`, the debt and deficit metadata
- Test: `tests/seo/regionalEconomiesMetadata.test.tsx`, a new `tests/explorer/budgetWorkbook.test.ts` beside `workbookModel.test.ts`, `tests/explorer/gdpSources.test.ts`

- [ ] **Step 1–4:** Failing tests per item; implement; PASS.
- [ ] **Step 5: Commit** `refactor: derive coverage in copy, one source mapping, tested budget workbook input`

Effort M. Risk low.

---

## Phase 5: Test suite cleanup

The page reviews proposed 283 test removals or merges. Three verification agents checked each one against the test it supposedly duplicates (`test-drop-verify/result-{A,B,C}.md`): **107 confirmed, 149 partial (merge, keeping named assertions), 27 rejected** (the test proves something unique), 0 missing. Only confirmed and partial rows are applied, exactly as their "final action" column says.

**Baseline (CI run 448, PR #181, 2026-10-12):** the checks job took 11 min 29 s, of which `npm test` was 7 min 48 s, `data:validate` 48 s and `npm run build` 1 min 32 s. The browser job took 15 min 21 s, of which `npm run test:browser` was 13 min 56 s (its own second build plus 1,403 tests at one worker). CI wall clock: about 16 min. Locally (CLAUDE.md, 14 cores) `npm test` was 58 s on 2026-09-06; the unit suite has since grown to 485 files and 4,048 tests (X3).

**Expected saving after Tasks 38–43:**

| Suite | Today | After | Where it comes from |
|---|---|---|---|
| `npm test` on CI | 7 min 48 s | about 4.5–5 min | shared snapshot fixture (about 180 s of summed file time), trade preparation tests on parsed rows (about 250 s), sitemap built once (about 100 s), duplicate `--check` runs (about 20 s), verified page drops (about 85 s); about 40% of summed file time |
| `npm test` locally (14 cores) | about 58 s (2026-09-06 figure) | about 35–40 s | same |
| Browser suite, test time at one worker | about 12.4 min on CI | about 8 min | verified page drops and merges (about 420 s measured on a loaded machine, about 280 s idle) plus X3's suite-level merges (about 200–350 s) |
| Browser job on CI | 15 min 21 s | about 4–6 min | the above, no second build (about 1.5 min), cached browsers (about 40 s), and 2–4 workers once measured on the runner |
| CI wall clock | about 16 min | about 9–10 min | the checks job becomes the longest job |

The test files these tasks change are the only expectations this plan edits on purpose. The component-reuse plan relies on `tests/explorer/municipalOverrides.test.tsx`, `tests/explorer/shellClasses.test.tsx` and the wages and unemployment-region fingerprint tests as its refactor guard; leave those until it has merged (X3 note; D076 and D094 are rejected anyway).

### Task 38: One shared snapshot for the unit tests

Why: X3-04. The full fact-query snapshot is built about 5 times per `check` + `build` and again in 48 unit files (215.8 s of summed file time); `tests/factQuery/buildSnapshot.test.ts` builds the identical snapshot 21 times (67.2 s). `scripts/prepare-fact-query-publications.ts:23` rebuilds the snapshot that the previous prebuild step has just written.

**Files:**
- Create: `tests/helpers/factQuerySnapshot.ts` exporting `testSnapshot(overrides?: Partial<BuildSnapshotOptions>)` (closest existing: `lib/factQuery/snapshot.ts` `loadPackagedSnapshot`, which serves the route and has no test overrides). It reads `lib/factQuery/generated/snapshot.json` (written by `pretest`), or builds once in a vitest `globalSetup` and `provide()`s the path; it replaces `releaseCommit` and `generatedAt` (the only fields of `BuildSnapshotOptions`, `lib/factQuery/buildSnapshot.ts:41`).
- Modify: `vitest.config.ts` (globalSetup), the 45 files from `grep -l 'buildFactQuerySnapshot(' tests` that build with options only, `tests/factQuery/buildSnapshot.test.ts` (one `beforeAll` for the 19 read-only tests; keep the two real builds of the determinism test at :89-90), `scripts/prepare-fact-query-publications.ts:23` (load the generated file; fail if it is missing)

- [ ] **Step 1:** Record `npx vitest run tests/factQuery tests/mcp --reporter=json` duration.
- [ ] **Step 2:** Implement the fixture; move files over in batches of about 10, running each batch.
- [ ] **Step 3:** `npx vitest run tests/factQuery/reference.test.ts` (stop condition) and the batch files: PASS. Re-measure; record both numbers in the commit body.
- [ ] **Step 4: Commit** `test: one shared fact-query snapshot instead of 70 rebuilds`

Effort M. Risk low; the reference fixture is the guard.

### Task 39: The slowest unit files do less repeated work

Why: X3-09 (the three trade preparation files take 359 s, 24% of summed file time; each negative case copies the workbooks and re-runs the whole preparation; `vitest.config.ts:10-29` `HEAVY_TESTS` misses the two slowest), X3-10 (five unit tests re-run the real-repo `--check` that `data:validate` already runs), X3-11 (eight files build the whole sitemap to assert a few URLs each; 127.5 s), X3-18 (`vitest.config.ts` loaded as CommonJS prints a warning on every run).

**Files:**
- Modify: `tests/data/trade{Services,Products,Partners}/prepare*.test.ts` (parse once in `beforeAll`, feed mutated parsed rows to the validators, keep one end-to-end write/check round trip per package); `vitest.config.ts:10-29` (add the two files to `HEAVY_TESTS`), rename to `vitest.config.mts` and update `package.json` `test`; delete the `prepare…Data(root, "check")` lines in `tests/data/{moneyBanks/moneyBanks,household/household,energyFood/energyFood,poverty/poverty}.test.ts` and the last line of `tests/data/unemployment/preparation.test.ts:28`; move the URL assertions of `unemploymentPage.test.tsx`, `demographyDiscovery.test.ts`, `inflationProductsDiscovery.test.ts`, `agentFiles.test.ts` (and the other sitemap builders X3-11 names) into `tests/seo/routes.test.ts`, which builds the sitemap once
- Test: the files themselves; every rejection a negative case proved must still be proved (list them before and after in the commit body)

- [ ] **Step 1:** List the assertions each changed file makes today (`grep -n "expect\|toThrow"`), save the list.
- [ ] **Step 2:** Implement, one file at a time, running it after each change.
- [ ] **Step 3:** Compare the assertion list; nothing lost. `npm run data:validate` still runs every removed `--check`.
- [ ] **Step 4: Commit** `test: trade preparation negatives on parsed rows; one sitemap build; no duplicate data checks`

Effort M. Risk low.

### Task 40: The browser suite checks each page once per concern

Why: X3-12 (`bilingual-seo.spec.ts:24` is 291 tests, 21% of the suite, and already covers `bilingual-complete.spec.ts:5` and most of `seo.spec.ts:104`), X3-14 and D188 (the §17 heading check is copied in 8 specs, the axis-label check in 7, a `scrollWidth` check in 52 of 64 files), X3-15 (behaviour flows repeated at 3 widths × 2 languages; 768 px itself stays, it is the main breakpoint), X3-13 and D001 (at least 16 ids asserted absent that exist nowhere in the code, so the assertions cannot fail), X3-07, X3-08, U22-15, D184, D207 (50 screenshots that nothing compares, 14.5 s of sleeps that only feed them, and `trade-services.spec.ts` rewriting 12 tracked PNGs).

**Files:**
- Modify: delete `tests/browser/bilingual-complete.spec.ts:5`; add og:url and twitter:card to `bilingual-seo.spec.ts` and drop `seo.spec.ts:104-118`; the Georgian half of `bilingual-seo.spec.ts` uses `request.get` and a DOM parser instead of a browser page; extend `tests/browser/mobile-fit-charts.spec.ts:80-110` into the one route-list layout spec (§17, axis labels inside the chart, no sideways scroll; widths 390, 768, 1440 on one page load) and delete the copies; delete the dead-id absences; delete the unasserted `page.screenshot` calls and `landing.spec.ts:62` `capture()` sleeps, replace `landing.spec.ts:583` with a poll; `trade-services.spec.ts` writes to `info.outputPath()`
- Test: the suite itself

- [ ] **Step 1:** `npx playwright test --list | tail -1` and a timed run of the affected specs against a built server; save both.
- [ ] **Step 2:** Implement one concern at a time, running the affected specs after each.
- [ ] **Step 3:** `git status --porcelain` is empty after running `trade-services.spec.ts`. Re-run the list and the timing; record in the commit body.
- [ ] **Step 4: Commit** `test(browser): one layout pass per page, no duplicate SEO walks, no unasserted screenshots`

Effort M–L. Risk low; each removed check names where it is still covered.

### Task 41: Apply the verified test removals from the page reviews

Why: the 256 confirmed or partial rows of `test-drop-verify/result-{A,B,C}.md` (107 confirmed, 149 partial). Rows that overlap Tasks 38–40 are done there; skip them here (the verification files mark the pairs: D188/D253/D205, D212/D249, D192/D202, D033/D022, D035/D025, D037/D019). The 27 rejected rows stay untouched.

**Files:** the spec and test files named in the rows. Work file by file inside the task; it is still one commit.

- [ ] **Step 1:** For each file, apply the "final action" column exactly: drop, merge into the named test, or rewrite as described. A PARTIAL row moves its listed assertions before deleting anything.
- [ ] **Step 2:** Run each changed file; PASS.
- [ ] **Step 3:** `git diff --stat tests/` and the before/after `--list` count go in the commit body, with the row ids applied.
- [ ] **Step 4: Commit** `test: apply the verified duplicate-test removals from the 2026-10-12 review`

Effort L (many small edits). Risk low.

### Task 42: Tests follow the data, and the missing page tests exist [parallel-safe]

Why: U01-25 (landing figures pinned as literals), U24-11 (about 8 Money and banks tests pin NBG values and implementation counts such as `[31, 24, 18, 23]`), D070 (a pinned review date). Each data refresh fails these for reasons unrelated to the page.

Also, the missing page tests the reviews named: U01-24, U03-15, U04-15, U05-15, U08-12, U20-13, U20-16, U22-18, U23-16, U24-10, U27-15, U29-21, U30-19 (each report's finding says what to assert). U04-16 is a drop, handled in Task 41.

**Files:** `tests/browser/landing.spec.ts`, `tests/browser/money-banks.spec.ts`, `tests/explorer/moneyBanks*.test.ts`: read expected values from `data/imports/*.csv` (as the % of GDP unit test already does) or assert structure (a number with its unit, three history items, year equals the table header).

- [ ] **Step 1–3:** Rewrite; run; PASS. Then edit one value in the CSV in a throwaway working copy, rerun, and confirm the test still passes because it reads the new value; revert the edit.
- [ ] **Step 4: Commit** `test: landing and Money and banks tests follow the data instead of pinning it`

Effort S. Risk none.

### Task 43: CI builds once, caches, and runs the browser suite in parallel

Why: X3-01 (every CI run builds the site twice; about 1.5 min on the runner), X3-02 (1,403 browser tests at one worker, about 12.4 min), X3-03 (no cache for `.next/cache` or the Playwright browsers; Chromium and its system packages are installed every run, 39 s), X3-05 (four postbuild re-checks of files prebuild wrote seconds earlier; the 120 MB of archive originals hashed twice), X3-06 (TypeScript runs twice per build, and the standalone `typecheck` misses route types on a fresh checkout), X3-16 (known flakes fixed by manual re-runs; one is an app race), X3-17 (`data:validate` starts 30 processes, about 30 s of start-up), X3-19 (no job timeouts), X3-07 (the "no writes into the repository" guard does not cover the browser job). X4-04 and X4-21: CLAUDE.md's test-loop numbers are five times out of date and do not say how to run the browser suite on a Linux cloud session.

**Files:**
- Modify: `.github/workflows/ci.yml` (upload `.next` and `public/downloads` from the checks job as an artifact; the browser job downloads it, runs `npm run start -- --port 3100 &` and `PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run test:browser`; cache `apps/web/.next/cache` and `~/.cache/ms-playwright`; `timeout-minutes: 30`/`45`; the porcelain guard in both jobs); `playwright.config.ts:10-21` (`retries: process.env.CI ? 1 : 0`; pin `PW_WORKERS` after measuring 2 and 4 on the runner); `package.json` (`"typecheck": "next typegen && tsc --noEmit"`; drop the four postbuild re-checks once each `--write` verifies what it wrote; one `scripts/validate-all.ts` running the 30 checks in one process, keeping the npm aliases); `CLAUDE.md` "Test loop" and `playwright.config.ts:10-11` comments (new measured numbers with a date; the Linux/cloud command with `CI=1` and `PLAYWRIGHT_BASE_URL`); `docs/deployment.md` (a short known-flakes list)
- Test: the CI run itself, on the PR (owner go first)

- [ ] **Step 1:** Make the workflow and config changes. Run `npm run check` and `npm run build` locally once; compare the build time with the 4 min 22 s baseline.
- [ ] **Step 2:** On the PR's first CI run, read both jobs' step times (GitHub Actions job view) and record them against the baseline table above. Try `PW_WORKERS=2` and `4` on two runs; pin the faster one that has no new failures.
- [ ] **Step 3:** Update CLAUDE.md with the measured numbers and the date.
- [ ] **Step 4: Commit** `ci: one build per run, caches, parallel browser tests; current test-loop numbers`

Effort M. Risk medium: CI configuration is only proven by a CI run, which needs the owner's go (project rule).


---

## Phase 6: Polish

### Task 44: Docs match the shipped site [parallel-safe]

Why: X4-06, X4-07, X4-08 (AGENTS.md: stale route inventory, a UI-contract default that contradicts approved scopes, a `codex/*` branch rule that conflicts with harness branch names), X4-09 to X4-12 and X4-19 (DESIGN.md §2, §6.2, §6.7, §17/§18, dead paths), X4-13, X4-14 (Project_Definition.md sidebar statements), X4-15 (READMEs list 3 of 11 hubs), X4-16 (database-import.md table), X4-17, X4-18 (deployment runbook), X4-22 (Noto Serif Georgian licence file), U21-19 (DESIGN §28.1/§28.4 vs §17).

Also: X4-10 and X4-11 by id (DESIGN.md §17/§18 hub-card exception; the `% მშპ-ში` sentence).

**Files:** the documents named. AGENTS.md: change only the Project Snapshot route sentence (point to Project_Definition.md §2), the UI-contract default sentence and the branch rule; do not touch "Engineering Behavior". Branch rule wording waits on Q10.

- [ ] **Step 1:** Edit. `npm run check` is not needed for docs; run `npx vitest run tests/seo/agentFiles.test.ts`.
- [ ] **Step 2: Commit** `docs: AGENTS, DESIGN, scope, READMEs and runbooks match the shipped hubs`

Effort M. Risk none.

### Task 45: Search snippets and share cards describe each page [parallel-safe]

Why: U01-13 (site description says budget only), U10-16, U13-08 (economy and inflation pages call their share image budget data), U26-11, U27-13, U28-11, U28-12, U29-09, U23-10, U11-08, U10-15 (thin or wrong titles, descriptions and Dataset names; ka and en sitemap `lastmod` differ for the same page), U01-21 (footer year hardcoded).

Also (low): U05-12, U09-12, U21-18, U27-14, U28-13 (titles that overstate or differ between languages; hub `lastmod`).

**Files:** `lib/seo/*`, `lib/i18n/messages/{ka,en}/*.json` metadata keys, `app/sitemap.ts`, `components/site/site-footer-view.tsx`.

- [ ] **Step 1–4:** Failing assertions in `tests/seo/metadata.test.ts` (no description over 160 characters; every hub title ends with the brand; one `lastmod` per page pair); implement; PASS.
- [ ] **Step 5: Commit** `seo: page-specific titles, descriptions and image text`

Effort M. Risk low; new Georgian copy goes to the owner list.

### Task 46: Touch targets meet the site's own sizes [parallel-safe]

Why: X1-20 and U16-05 (Q5: 12 px native dropdowns make iPhones zoom; `components/ui/editorial.tsx:35` `SELECT_CLASS`, phones only, and DESIGN.md §7 updated to match). Targets under 44 px where DESIGN.md asks for 44 px, or under 24 px (WCAG 2.5.8): U06-10, U09-15, U13-11, U21-16, U22-13, U23-12, U23-13, U29-06, U30-17, U12-12, U17-04, U02-14, U26-09.

Also (low): U22-12 (the share column header on trade rankings is illegible on phones), U09-14 (picker list height and English placeholder).

**Files:** the components named in each finding (mostly `min-h-11` on phones).
- [ ] **Step 1–4:** Extend `tests/browser/mobile-repairs-polish.spec.ts` with a target-size check on each page named; implement; PASS.
- [ ] **Step 5: Commit** `fix(mobile): touch targets at the site's sizes`

Effort S. Risk low.

### Task 47: Small accessibility polish [parallel-safe]

Why: U10-04, U12-11, U19-05, U17-12, U17-13, U15-03, U26-10, U27-12, U29-07, U29-08, U29-20, U14-08, U14-09, U07-05, U02-12, U02-13, U01-19, U06-12, U16-12, U22-11, U28-16.

Also (low): U01-20, U11-07, U26-08, U29-19.

**Files:** the components named in each finding.
- [ ] **Step 1–4:** Add an axe check (`@axe-core/playwright` is not installed; use the existing `tests/browser/color-contrast.ts` helper pattern, or ask the owner before adding a dev dependency) on one page per template for the rules touched; implement; PASS.
- [ ] **Step 5: Commit** `fix(a11y): picker popups, group names, live counts and heading levels`

Effort M. Risk low.

### Task 48: Consistent numbers, sentences and spacing [parallel-safe]

Why: U11-01 (Q6: the flat 100% share-of-GDP view on Sectors), U06-08 (Q7: debt change colours). One number at two precisions or one sentence twice on a screen, missing separators, small layout nits: U07-13, U10-14, U13-14, U09-16, U18-10, U12-06, U26-12, U26-13, U02-03, U02-04, U04-04, U04-05, U04-10, U04-11, U21-08, U21-10, U22-17, U28-05, U28-06, U23-04, U23-05, U14-10, U14-11, U14-12, U27-05, U27-06, U20-10, U26-16, U26-05, U07-10, U07-11, U01-05, U01-06, U01-07, U09-10, U09-11, U17-11, U16-06, U16-16, U29-16, U29-17, U29-18, U29-10, U29-13.

Also (low): U03-14, U05-14, U06-05, U06-09, U07-12, U08-09, U08-10, U09-17, U10-13, U17-06, U18-11, U20-09, U21-17, U22-14, U22-16, U24-09, U25-07, U28-09, U28-10, U28-19 (deep links that first paint the default view, repeated sentences, small layout and wording items). U05-14, U07-12, U18-11 and U20-09 change wording or remove a block: show the owner first.

**Files:** the components and message files named in each finding. Wording changes go to the owner list.
- [ ] **Step 1–4:** For each item, the nearest existing test gets one assertion; implement; PASS.
- [ ] **Step 5: Commit** `fix(ui): one precision per number, no repeated sentences, small layout fixes`

Effort M. Risk low.

### Task 49: Excel files are tidy and consistent [parallel-safe]

Why: U18-03 (Wages: with Average and Median selected the workbook shows the median as 1,531.0 while the page shows 1,531; this is the remaining part of the known Wages/Poverty Excel item, the rest was fixed in PR #176), U20-05 (a legacy column-4 number format lands on the text Status column, `lib/explorer/workbookWriter.client.ts:259`), U16-17, U17-10 (raw ids such as `labour_force` in file names), U26-14 (raw floating-point shares with no unit), U07-15 (a Group column equal to Category), U20-06 (waits on Q8).

Also: U20-15 (assert in a real download that the value column, not the name column, carries the number format).

**Files:** `lib/explorer/wagesWorkbook.ts` (per-row formats via `rowNumberFormats`, `lib/explorer/workbookModel.ts:92`), `lib/explorer/workbookWriter.client.ts:259`, the unemployment and demography workbook builders.
- [ ] **Step 1–4:** Failing tests in `tests/explorer/wages.test.ts` (`"median stays whole when shown beside the average"`), `tests/explorer/workbookWriter.test.ts` (`"the status column has no number format"`), and the filename tests; implement; PASS.
- [ ] **Step 5: Commit** `fix(excel): per-row precision, no format on text columns, readable file names`

Effort S–M. Risk low.

### Task 50: Done-check (lead)

- [ ] `npm run check`, `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the browser suite against the built server (CLAUDE.md "Test loop"). Record the new `npm test` and browser-suite times next to the baseline in the spec.
- [ ] `npx vitest run tests/factQuery/reference.test.ts`.
- [ ] Show the owner a preview (branch push without a PR gives a Vercel preview) and wait for their go before opening the PR.

---

## Needs owner decision

| # | Question | Recommended default | Used by |
|---|---|---|---|
| Q1 | May trade values be rounded to whole US dollars in the page data and in Excel? Pages already show millions with one decimal. | Yes. Cuts Trade products by about a third and Partners by a similar share. | Task 26 |
| Q2 | How generous should /mcp be per client? | 1,000 requests per client per day now. Before promoting /mcp, connect it once from claude.ai and check whether those users share one address (U30-04); turn on a Vercel Firewall rate rule for `/mcp` if the plan includes it. | Task 3 |
| Q3 | Should the header menu, footer and 404 page list all 11 data hubs (today 5)? | Yes. | Task 34 |
| Q4 | On laptops and tablets (768–1099 px column width) a multi-line chart has no legend and its key is a screen below. Show the phone legend up to 1100 px? | Yes (one class change). | Task 7 |
| Q5 | iPhones zoom the page when the 12 px dropdowns on Wages and Unemployment are tapped. Make those dropdowns 16 px on phones only? | Yes, phones only. | Task 46 |
| Q6 | On Sectors, switching to "share of GDP" with only Total selected shows a flat 100% line. What should it show? | Select the five largest sectors automatically when switching to share. | Task 48 |
| Q7 | Debt colours: rising debt is green and a falling rate is red, which reads as good/bad. Use neutral ink for changes? | Yes. | Task 48 |
| Q8 | In Excel, nested series (e.g. "60% line" under "Georgia") lose their parent's name. Add the parent to the row name in the workbook? | Yes. | Task 49 |
| Q9 | Create a protected "production" environment in GitHub and move the three deploy secrets into it? This is a GitHub settings step only the owner can do. | Yes. | Task 4 |
| Q10 | AGENTS.md says branches must be `codex/*`; Claude sessions use `claude/*`. Allow any non-`main` feature branch? | Yes. | Task 44 |

## Georgian text for owner review

The full list (182 rows from every report, including U25-10) is `.superpowers/platform-review-2026-10/georgian-wording.md`. The ones this plan touches, with drafts:

| Where | Today | Issue | Draft |
|---|---|---|---|
| Methodology, debt JSON link (Task 24) | სახელმწიფო ვალი | Says "state debt"; the data is government debt, and English says "Government debt" | მთავრობის ვალი |
| Skip link (Task 11, new) | (none) | New text | მთავარ შინაარსზე გადასვლა |
| Breadcrumb landmark (Task 14, new) | "Breadcrumb" in English | New text | ნავიგაციის ბილიკი |
| Revenue page and menu (U04-14) | შემოსულობები and შემოსავლები both used | Two terms for one thing; people search for შემოსავლები | Pick one term for title, menu and series |
| Analysis "field" (U05-11) | ბიუჯეტის ველი vs სფეროები | One word for two things on one screen | Rename the bubble chart, e.g. "წილი და ზრდა" |
| Empty-result messages (U14-10, U21-07) | აირჩიე … (informal) | The rest of the site uses the formal plural | აირჩიეთ … / "შედეგი ვერ მოიძებნა — შეცვალეთ საძიებო ტექსტი" |
| Search placeholders (U23-04) | ძიება | The rest of the site uses ძებნა | ძებნა |
| Landing section headings (U01) | "რამდენია საქართველოს მთავრობის ვალი" | Question without a question mark (English has one) | add "?" |
| Explorer hub lead and the shortened hub/page leads (Task 18) | two sentences / 150+ characters | §17 one short line | drafts in the Task 18 commit body |

## Not doing, and why

| Finding | Why not |
|---|---|
| U08-13, U16-11, the duplicated-SVG part of U13-03 | Both chart drawings are in the HTML on purpose (DESIGN.md §8.3), so the phone and desktop views render before the browser measures. |
| U10-17, U06-14 (source ids in public CSVs) | Documented lineage columns of the processed-data downloads (e.g. `docs/data-methodology/inflation-products.md:47`); the "no internal columns" rule is for Excel workbooks. |
| U29-11 (`repository_source_path` in manifests) | It points at the public GitHub repository; not a leak. |
| U01-09, U01-10 (three.js hero cost) | The owner chose the hero (DESIGN.md §19), and it loads only on desktop after the page has loaded. |
| U22-04, U29-22, U30-18 (shared JS floor) | Framework floor; the page totals in those findings also counted a 39.5 KB polyfill modern browsers never download. |
| U09-19 (per-place share images), U09-18, U05-13, U10-07, U11-06, U16-15, U23-14 | Low value or already the owner's spec. |
| U12-09, U16-10 (small duplicated payloads), U26-07 (a jump link in long member lists) | The report itself judged them acceptable or optional. |
| X1-18 (a shared chart shell for the two chart components) | Task 12 copies the keyboard pattern instead; a full extraction is a larger refactor than any finding needs. |
| U04-02, U19-11 (legend between 768 and 1099 px) | Owner decision Q4. |
| U14-15 (layout shift on inflation pages on phones) | Root cause not isolated; needs a separate investigation before a fix can be planned. |
| 27 rejected test removals (`result-*.md`, verdict REJECTED) | Each proves something no other test does. |

## Already planned elsewhere (left out of this plan)

- **Component-reuse plan** (`.superpowers/platform-review-2026-10/reference/2026-10-11-component-reuse.md`; Tasks 0–10 done on the owner's local branch, not on `main`; 11–14 pending): U09-03, U12-01, U12-02, U15-02, U17-07 (Tasks 5/6), U16-04, U24-02, U25-04 (Task 4), U28-03, U28-04 (Task 7), U09-04 (Task 11), U23-06 (Task 12), U27-09 (Task 13).
- **audit-fixes plan** (`docs/superpowers/plans/2026-10-11-audit-fixes.md`): Task 20 (dependency audit, deadline 2026-11-02, see Op 3) and Task 21 (remove the unreachable all-periods Products mode) are still open on `main`.
