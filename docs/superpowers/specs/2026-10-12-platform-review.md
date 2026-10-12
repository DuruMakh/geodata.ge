# Fiscal.ge platform review (2026-10-12)

**What this is:** a read-only review of every page of fiscal.ge, in Georgian and English, for code quality, speed, design, phones, accessibility, bilingual parity, search metadata, security and tests. Checking whether the numbers are correct was out of scope (separate future tasks). No code was changed. The fixes are planned in `docs/superpowers/plans/2026-10-12-platform-review-fixes.md`.

**Base:** `origin/main` at `9177f036` (after PR #181 Trade services), built with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build` (589 static pages, 4 min 22 s on the review machine) and served at `localhost:3100`. A few security checks were repeated against production (fiscal.ge), read-only.

**Working files:** `.superpowers/platform-review-2026-10/` holds the inventory, the agent briefs, all 34 reports (`pages/`), the test-removal verification (`test-drop-verify/`) and the full Georgian wording list (`georgian-wording.md`).

## 1. How the review was run

1. **Inventory.** The 144 page routes (72 Georgian, 72 English mirrors) plus `/mcp` were grouped into 30 review units, ranked by importance. Each unit covers both languages. Large page families (municipalities, population places, regions, methodology articles) were reviewed as templates with spot checks of the smallest and largest page. See `inventory.md`.
2. **Page reviews.** One review agent per unit, three at a time, each with the same brief (`agent-brief.md`): nine areas, evidence required (file:line, URL or a measured number), the owner's design decisions listed as "not findings".
3. **Cross-cutting reviews.** Four more agents after the page waves: shared components (X1), security and configuration (X2), build, CI and tests (X3), docs and agent context (X4).
4. **Verification.** Every high finding was reproduced by the lead; 13 medium findings were re-checked by hand (all confirmed) and most shared mediums were re-confirmed at their shared cause by X1 and X2. Every one of the 283 proposed test removals was checked by one of three verification agents against the test it supposedly duplicates, with measured runtimes (spot-checked by the lead).

## 2. Inventory summary

| Group | Units | Pages built (ka + en) |
|---|---|---|
| Landing, explorer hub, ten topic hubs | U01, U02, U28 | 24 |
| Budget: expenditure, revenue, analysis, debt, deficit | U03–U07 | 10 |
| Municipal budgets (index, Georgia, regions, places) | U08, U09 | about 156 |
| Economy: GDP, sectors, regions | U10–U12 | about 28 |
| Inflation: overview, categories, products, cities | U13–U15 | about 24 |
| Labour: unemployment, wages | U16–U18 | about 50 |
| Living standards: income, spending, poverty, inequality | U19, U20 | about 40 |
| Trade, external flows, money and banks, energy and food | U21–U25 | 32 |
| Demography: population places, age-sex, births and deaths, migration | U26, U27 | about 160 |
| Methodology, about | U29 | 38 |
| `/mcp` and `/connect` | U30 | 1 endpoint + 2 |

The sitemap lists 580 URLs. The 404 page, `robots`, the share-image route and the static downloads were covered only through the units that link to them.

## 3. Results in numbers

| | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| Page units U01–U30 | 0 | 7 | 122 | 344 | 473 |
| X1 shared components | 0 | 1 | 9 | 12 | 22 |
| X2 security and configuration | 0 | 1 | 2 | 4 | 7 |
| X3 build, CI and tests | 0 | 2 | 10 | 7 | 19 |
| X4 docs and agent context | 0 | 3 | 12 | 7 | 22 |
| **All reports** | **0** | **14** | **155** | **374** | **543** |

**Verification outcome**

- **High findings:** all 14 were reproduced. Two were downgraded to medium: U21-02 (no legend cap on Trade partners; the 5,100 px legend appears only after "select all") and X3-01 (CI builds the site twice; the real cost is about 1.5 min per run on GitHub's runner, not the 4–5 min estimated on the loaded review machine). Three were merged: X1-01 is the shared cause of U19-01, U24-01 and U25-01. That leaves **9 distinct high problems**. Seven are in section 5; the other two are errors in the developer docs (X4-04: CLAUDE.md's test-loop numbers are five times out of date; X4-05: both READMEs point at a database command that can offer to reset the database).
- **CI timings corrected with real data:** X3 estimated the browser job at about 30 min; the latest PR run (CI run 448, PR #181) took 15 min 21 s for the browser job and 11 min 29 s for the checks job, of which `npm test` was 7 min 48 s.
- **Withdrawn (5):** U10-17 and U06-14 (source ids in the public CSV downloads are documented lineage columns, not leaked metadata), U29-11 (the repository path in manifests points at the public GitHub repository), U08-13 and U16-11 (the chart drawn twice in the HTML is intended by DESIGN.md §8.3). U13-03 was narrowed to its unused-data part for the same reason.
- **Corrected:** U13-01 and U22-05 point at a different line than reported (`inflation-categories.tsx:101`, `trade-services.tsx:35`); the problems are real. The page JavaScript totals in U01-08, U22-04, U28-01 and U30-18 counted a 39.5 KB polyfill modern browsers never download.
- **Turned into owner questions (7):** U04-02/U19-11 (legend between 768 and 1099 px, a gap in decision D4 as written), U16-05 (12 px dropdowns zoom iPhones; DESIGN.md sets the size), U11-01, U06-08, U20-06, U30-04.
- **Already planned elsewhere (13):** covered by the component-reuse plan (Tasks 4–7, 11–13) or still-open audit-fixes tasks; listed at the end of the plan.
- **Proposed test removals (283):** 107 confirmed, 149 partial (merge, keeping named assertions), 27 rejected (the test proves something unique), 0 pointing at tests that do not exist.

## 4. Scorecard (1–10, from each unit's report)

| Unit | Code | Speed | Design | Phone | Access. | Bilingual | SEO | Security | Tests |
|---|---|---|---|---|---|---|---|---|---|
| U01 Landing | 6 | 6 | 7 | 8 | 5 | 8 | 8 | 10 | 6 |
| U02 Explorer hub | 5 | 7 | 6 | 7 | 5 | 9 | 9 | 10 | 6 |
| U03 Expenditure | 6 | 6 | 8 | 8 | 5 | 8 | 9 | 9 | 6 |
| U04 Revenue | 6 | 7 | 7 | 8 | 6 | 8 | 8 | 9 | 6 |
| U05 Analysis | 6 | 5 | 8 | 7 | 6 | 9 | 8 | 7 | 7 |
| U06 Debt | 7 | 8 | 8 | 8 | 6 | 8 | 8 | 9 | 7 |
| U07 Deficit | 6 | 7 | 7 | 8 | 5 | 9 | 8 | 9 | 7 |
| U08 Municipal index | 7 | 6 | 8 | 7 | 6 | 9 | 9 | 9 | 7 |
| U09 Municipal places | 6 | 7 | 8 | 8 | 6 | 8 | 8 | 8 | 7 |
| U10 GDP | 6 | 7 | 7 | 8 | 7 | 8 | 9 | 10 | 6 |
| U11 Sectors | 7 | 7 | 7 | 8 | 7 | 9 | 9 | 10 | 6 |
| U12 Economy regions | 6 | 6 | 8 | 8 | 7 | 8 | 9 | 9 | 7 |
| U13 Inflation overview | 7 | 5 | 7 | 8 | 6 | 8 | 8 | 10 | 7 |
| U14 Inflation products | 6 | 4 | 7 | 8 | 6 | 9 | 8 | 9 | 7 |
| U15 Inflation cities | 6 | 6 | 7 | 6 | 7 | 9 | 8 | 10 | 7 |
| U16 Unemployment | 6 | 6 | 8 | 8 | 6 | 8 | 8 | 9 | 7 |
| U17 Unemployment regions | 6 | 6 | 8 | 8 | 7 | 8 | 8 | 9 | 7 |
| U18 Wages | 6 | 5 | 8 | 7 | 6 | 9 | 8 | 9 | 7 |
| U19 Income and spending | 7 | 6 | 7 | 5 | 7 | 8 | 8 | 9 | 7 |
| U20 Poverty | 6 | 7 | 7 | 8 | 7 | 8 | 8 | 9 | 6 |
| U21 Trade overview/partners | 6 | 5 | 6 | 5 | 6 | 7 | 8 | 9 | 6 |
| U22 Trade products/services | 6 | 5 | 7 | 7 | 6 | 8 | 7 | 9 | 6 |
| U23 External flows | 6 | 6 | 8 | 8 | 7 | 8 | 7 | 10 | 7 |
| U24 Money and banks | 6 | 8 | 7 | 6 | 7 | 9 | 7 | 10 | 7 |
| U25 Energy and food | 7 | 8 | 6 | 5 | 6 | 9 | 8 | 9 | 7 |
| U26 Population places | 6 | 7 | 7 | 8 | 6 | 8 | 7 | 9 | 6 |
| U27 Demography topics | 7 | 7 | 6 | 7 | 7 | 7 | 8 | 9 | 6 |
| U28 Topic hubs | 5 | 5 | 6 | 8 | 7 | 7 | 5 | 9 | 6 |
| U29 Methodology, about | 6 | 7 | 6 | 4 | 7 | 8 | 7 | 8 | 6 |
| U30 /mcp, /connect | 7 | 5 | 8 | 8 | 7 | 8 | 9 | 8 | 6 |
| **Median** | **6** | **6** | **7** | **8** | **6** | **8** | **8** | **9** | **7** |

Cross-cutting scores: X2 security: /mcp 9, headers/CSP 5, environment 8, dependencies 7, GitHub Actions 7, secrets 10, user input 10, downloads 6. X4 docs: llms.txt 4, scope document 8, DESIGN.md 5, AGENTS/CLAUDE 5, other docs 6, READMEs 4, methodology registry 9. X3 build and tests: build 5, CI 4, unit suite 5, browser suite 4, redundancy 4, flakiness 6, gate composition 5.

**Reading the scorecard:** security and search metadata are strong everywhere. Accessibility is the weakest area across the board, almost entirely because of shared parts (no skip link, charts with no keyboard reading). Speed and code quality are middling, again mostly for shared reasons: the sidebar prefetches the whole site, a few pages ship far more data than they show, and five topic explorers are copies of each other.

## 5. Top 10 problems, in plain language

1. **One archived Geostat web page runs Google's scripts on fiscal.ge.** A copy of a Geostat page kept as a source is served as a live web page, so Geostat's Google Analytics and reCAPTCHA run as if they were part of fiscal.ge. The other 21 archived pages are safely served as text. (X2-01; plan Task 1)
2. **On phones, some charts with several lines cannot be read.** Living standards income and spending, all Money and banks pages, all Energy and food pages and the life-expectancy chart have no colour key under the chart, so a reader cannot tell the lines apart. Other pages got this in October; these were added later and missed it. (X1-01, U19-01, U24-01, U25-01; Task 7)
3. **The Trade partners page is 10,000 pixels tall on a phone.** The list of 218 countries is laid out in full, so the ranking table and the Excel button sit about 7,000 pixels below the chart. (U21-01; Task 9)
4. **Keyboard and screen-reader users have a hard time on every explorer page.** There is no "skip to content" link, so keyboard users press Tab 20–24 times before reaching the chart; the chart then does nothing from the keyboard and is announced only as "multi-year trend". (X1-02, X1-03 and 37 page findings; Tasks 11–12)
5. **Every page downloads most of the site in the background.** The sidebar links tell the browser to fetch every page they point to as soon as they are visible: 1.2–1.5 MB extra per explorer page load, and about 1 MB on one scroll of the municipalities list on a phone. (X1-04; Task 25)
6. **A few pages are much heavier than they need to be.** Trade products sends 264 KB (compressed) of data, more than half of it 17-digit numbers for values shown to one decimal; Money from abroad is 1.5 MB, inflation products 1.46 MB. (U22-01, U23-01, U14-01; Tasks 26–29)
7. **AI assistants are told three data families do not exist.** The `llms.txt` file that guides AI tools says "no datasets beyond those listed here" but leaves out Money and banks, Energy and food and Trade services. (X4-01; Task 19)
8. **Internal review notes are visible in the page source.** Notes such as "Confirm against source before production" ship in the HTML of the budget pages; municipal pages ship internal reconciliation fields. They are not shown on screen, but anyone viewing the source sees them. (U05-02, X2-03, U09-01; Task 2)
9. **Two methodology pages scroll sideways on phones.** The Georgian heading of the municipalities and household-income methodology pages is wider than the screen. (U29-01; Task 10)
10. **The automatic checks take about 16 minutes per pull request, and most of that is repetition.** The browser tests have grown five-fold to 1,403 and run one at a time; the site is built twice per run; the unit tests rebuild the same data snapshot about 70 times. Every fix and every hub waits on this. (X3-02, X3-01, X3-04; Tasks 38–43)

**A deadline outside this review:** the CI check that allows one known, low-risk dependency warning expires on **2026-11-02 at 04:00 Tbilisi**. From then on every pull request fails and nothing can be released until audit-fixes Task 20 is done.

## 6. Test suite

**Size today:** 485 unit-test files with 4,048 tests, and 1,403 browser tests in 64 files (CLAUDE.md still says 281 browser tests and about 150 unit files). On GitHub's runner (CI run 448, 2026-10-12): `npm test` 7 min 48 s, `data:validate` 48 s, build 1 min 32 s, browser job 15 min 21 s (a second build plus all browser tests at one worker). CI wall clock is about 16 minutes.

**Where the time goes (X3):** the same fact-query snapshot is rebuilt about 5 times per check-and-build and about 70 times inside unit tests; three trade data-preparation test files take 24% of all unit-test time because every negative case re-runs the whole preparation; eight files build the full sitemap; one browser file (`bilingual-seo.spec.ts`, 291 tests, 21% of the suite) walks the same 290 routes that two other files also walk; 50 screenshots are taken that nothing compares, with 14.5 s of waiting to feed them; a page-layout check is copied into 52 of 64 browser files.

**Proposed removals, checked one by one:** the page reviews proposed 283 test removals or merges. Each was checked against the test it supposedly duplicates: 107 confirmed, 149 partial (merge but keep named assertions), 27 rejected (they prove something no other test does: for example the only test of the deficit's forecast marker derived from data, the only real-browser build of the 305-product workbook, and the only check that archived HTML aliases cannot run on the site). Reviewers' most common mistakes: citing a "duplicate" that only checks the chart frame and not the whole page, proposing to merge tests that are already one parametrised test, and citing a twin test that does not exist.

**Expected saving** (plan Tasks 38–43): `npm test` on CI from 7 min 48 s to about 4.5–5 min (locally from about 58 s to about 35–40 s); browser test time at one worker from about 12.4 min to about 8 min; the browser job from 15 min 21 s to about 4–6 min once it reuses the checks job's build and runs 2–4 workers; CI wall clock from about 16 to about 9–10 minutes. Infrastructure (one build, caching, workers) saves more than pruning tests does.

## 7. What was not checked

- Whether any number on the site is correct (out of scope).
- Live rate limiting on production `/mcp` (would spend the production quota); it was tested in-process. The local build answers `/mcp` with 503 because `MCP_ENABLED` is unset there, by design.
- Vercel firewall settings and the GitHub repository's default token permissions (not visible from the repository).
- The 404 page and the share-image route (only through the site header and footer).
- Real devices: phone checks used Chromium at 320–412 px, not Safari on an iPhone; the iPhone zoom finding (U16-05) is from the known Safari rule, not observed.
- Page reviews U01–U03 estimated some browser-test runtimes before the test browser was set up; the test-removal verification re-measured them.
