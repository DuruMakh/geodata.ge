# Audit Fixes Implementation Plan (PRs #153–#172)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding of the 2026-10-10 scored audit of PRs #153–#172 that is fixable on `main`: wrong output first, then page weight, missing phone behaviour, duplicated code, accessibility, docs and guards.

**Architecture:** Every fix is local to the code that owns it. Shared components get only small optional additions whose defaults leave current output unchanged (AGENTS.md "Reuse First"). Duplicated code is merged into an existing module where one fits, and otherwise into one new neutral module. Each task is one commit on one branch, delivered as a single PR (owner preference, [[release-batching-preference]]). Tasks run in order and later tasks build on earlier edits: Task 10 uses Task 1's tooltip signature, and Tasks 9–11 and 13 edit Trade and Money from abroad files that earlier tasks already changed.

**Revised 2026-10-11** after an independent plan review. Changes: the Task 6 "Other countries" change was withdrawn, Task 2 keeps blank rows marked Unavailable, and every expected test edit is now named.

**Tech Stack:** Next.js 16 (static export plus `/mcp`), strict TypeScript, Tailwind v4, Vitest 5, Playwright, ExcelJS. All commands run from `apps/web`.

**Spec:** the audit findings. A copy is kept in the lead's memory note `audit-2026-10-10`. The authorities for each area are `Project_Definition.md` §2C–§2G, `DESIGN.md` (§6.6 shadows, §7.14 return pill, §8.3 phone legend, §17 headings, §29–§31) and `AGENTS.md`.

## Global Constraints

- Reuse first: extend an existing helper with an optional parameter whose default changes nothing, and never fork or copy one. A new module needs one line naming the closest existing one and why it could not be extended.
- Georgian and English stay in step. Every new message key goes into both `lib/i18n/messages/ka/*.json` and `lib/i18n/messages/en/*.json`, and `npm run i18n:check` must pass. New Georgian text is a draft for the owner's review: list it in the task report.
- Derive years and coverage from the loaded facts. Never hardcode a year in page code or message text.
- Public Excel workbooks keep three sheets, a status column, and validated public-archive source links. Internal metadata columns stay out.
- No change to any number shown on a page, unless the task says so explicitly.
- Do not touch the in-progress branch `claude/demographics-remaining-3119f2` or files that only exist there.
- Feedback loop: run `npx vitest run <file>` and `npx playwright test <spec>` while working, and run the full gates once in the final task (CLAUDE.md "Test loop").
- Commits end with the attribution line from the session's system reminder. Publishing (push, PR, merge) only with the owner's authorization, following AGENTS.md "Workflow and Delivery".

## Review Focus

1. **Mixed precision in one view:** the Wages overview with Average and Median selected. The table, the tooltip and the phone legend must show the median in whole lari and the average with one decimal. The table and tooltip are tested in Task 1, the legend in Task 10.
2. **Rank boundaries in Georgian:** ranks 20, 21, 40, 41, 60 and 61, also on the Budget municipal pages, which use the same helper. Test in Task 4.
3. **English workbooks:** the Current account % of GDP Sources sheet in `en` must list the GDP source with its English title. Test in Task 3.
4. **Shared links after the hook merge:** a deep link with an explicitly empty selection (`sel=`) and Back/Forward must restore exactly the same state on all five pages. Test in Task 11.
5. **Phone legend edge cases:** one line or table mode shows no legend. The tap readout hides the legend, which only works if the legend sits right after the chart wrapper (`app/globals.css:126`). Test in Task 10.

---

## Before you start (lead only, needs the owner)

- [ ] **Op 1: get Current account live.** With the owner's yes, run `gh run rerun 38071599950 --failed`. That run failed on a Google Fonts fetch; it was the only font failure in the last 25 failed CI runs. Once Deploy production finishes, check `curl -s https://fiscal.ge/downloads/data/manifest.json` for `"releaseCommit"` = `12f2bfe1…`, and expect `/explorer/external/current-account` and `/en/…` to return 200.
- [ ] **Op 2: hand the Age-and-sex findings to their session** (with the owner's yes). See "Hand-off" at the end.
- [ ] **Op 3: get the owner's answers to Q1–Q6** (end of the document). Tasks 8, 16, 18 and 23, and the optional Q6 work, wait on them. The other tasks do not.
- [ ] **Op 4:** `git fetch origin && git switch -c claude/audit-fixes origin/main`, then `npm ci` (check `node_modules/.package-lock.json` against `package-lock.json`).

---

## Phase 1: Wrong output people can see

### Task 1: Wages: Excel number format, mixed precision, region filenames

**Files:**
- Modify: `lib/explorer/wagesWorkbook.ts:24,36`; `components/wages/wages-explorer.tsx:98-100,158-159`; `components/main-explorer/explorer-table.tsx` (props at :21, `cellValue` at :111); `components/main-explorer/editorial-line-chart.tsx:54,191`; `components/main-explorer/chart-frame.tsx:293,320,356`; `lib/data/wages/types.ts:32`; `lib/data/wages/importWages.ts:57`; `lib/i18n/messages/{ka,en}/wages.json:8,10,16` and the places those keys are rendered (grep the keys: page metadata in `lib/pages/wages*.tsx`, hub cards in `lib/explorer/wagesHubCards.ts`)
- Test: `tests/explorer/wages.test.ts`, `tests/data/wages/wages.test.ts:26-27`, `tests/browser/wages.spec.ts`

**Interfaces:**
- Produces: `ExplorerTable` prop `decimalsForRow?: (row: Row) => number`. `EditorialLineChart` prop `formatTooltipValue?: (value: number, seriesId: string) => string`. `ChartTooltip` prop `formatValue: (value: number, seriesId: string) => string`, called with `row.id`. Existing callers ignore the second argument. `buildWagesWorkbookExportModel` input gains `regionId?: string`. `ClientWagesFact` loses `decimals`.

- [ ] **Step 1: Write failing tests** in `tests/explorer/wages.test.ts`:
  - `"the Data sheet formats the amount column"`: build the overview workbook for `selectedIds: ["average"]`, years 2022–2022. Expect `model.analysis.numericFormats` to equal `{ 3: "#,##0.0" }`. Write the file and expect the Data sheet's `C2` to have `numFmt` `"#,##0.0"` and value `1543`.
  - `"a region workbook is named after its region"`: build the regions workbook with `regionId: "region.adjara"`, and again with `"region.guria"`. Expect the filenames to differ and to contain `adjara` and `guria`.
- [ ] **Step 2:** `npx vitest run tests/explorer/wages.test.ts`. Expected: both fail (current format key `2`; same filename).
- [ ] **Step 3: Implement.**
  - Set `numericFormats: { 3: numberFormat }`.
  - Add `regionId` to the filename: `wages-${section}-${regionId.replace(/^region\./, "")}-…` when it is given. Pass `regionId` from `WagesExplorer`.
  - Remove `decimals` from `ClientWagesFact` and `toClientWagesFact`. Nothing on a page reads it. Delete the two `decimals` assertions at `tests/data/wages/wages.test.ts:26-27`: they test the removed field.
- [ ] **Step 4: Add `decimalsForRow` and the tooltip `seriesId` argument** with the interfaces above.
  - In `WagesExplorer`, use `decimalsForRow={row => seriesById[row.itemId].decimals}`.
  - Format the tooltip with `(value, id) => …decimals of id…`.
  - Leave the Excel readable sheet with one format per column (values stay exact).
- [ ] **Step 5: Browser test** in `tests/browser/wages.spec.ts`: `"the median shows whole lari beside the average"`.
  - Open `/en/explorer/wages/overview#view=table&sel=average,median`.
  - Expect the median row's 2025 cell to have the text `1,531`, not `1,531.0`.
  - Expect the average 2025 cell to have the text `2,165.2`.
- [ ] **Step 6: Coverage words from the facts** (AGENTS.md: no hardcoded coverage).
  - `wages.page.overview.summary`, `wages.page.industries.summary` and `wages.regionSummary` hardcode 1995, 2018, 2014, 2010 and "19 economic activities".
  - Replace each with a placeholder (`{averageFrom}`, `{medianFrom}`, `{sectionsFrom}`, `{sectionCount}`, `{from}`) and fill it from `wagesCoverage` and the facts wherever the key is rendered. Use the same wording in ka and en.
  - Test `"wages summaries keep today's wording"`: expect the rendered en overview and industries summaries, and the Adjara region summary, to equal today's strings exactly.
- [ ] **Step 7: Run the tests.** Expected: PASS.
  - `npx vitest run tests/explorer/wages.test.ts tests/data/wages/wages.test.ts tests/explorer/explorerTableLayout.test.ts`
  - `npx playwright test tests/browser/wages.spec.ts`
  - `npm run i18n:check`
- [ ] **Step 8: Commit:** `fix(wages): format the Excel amount column, keep the median in whole lari, name region downloads, take coverage words from the data`

### Task 2: Trade Excel: missing values are "Unavailable", not "Actual"

**Files:**
- Modify: `lib/explorer/tradePartnersWorkbook.ts:26`, `lib/explorer/tradeProductsWorkbook.ts:27`
- Test: `tests/explorer/tradePartnersWorkbook.test.ts`, `tests/explorer/tradeProductsWorkbook.test.ts`, `tests/browser/trade-partners.spec.ts`, `tests/browser/trade-products.spec.ts`

Missing values keep their blank row. `tradePartnersWorkbook.test.ts:49-56` already requires a missing amount to stay a blank Data row, and Wages labels its unavailable cells the same way. Only the status text changes, so row counts and cell positions stay as they are, including `tradeProductsWorkbook.test.ts:35,48-50` and the Data row count at `trade-products.spec.ts:250`.

- [ ] **Step 1: Failing test** `"a missing partner value is Unavailable, not Actual"`, run for `en` and `ka`:
  - Select a country with a dash year (reuse the fixture behind `tradePartnersWorkbook.test.ts:49-56`).
  - Expect that year's Data row to have amount `null` and status `workbookMessage(locale, "workbook.unavailable")`.
  - Expect the readable row's `basisByYear` for that year to be `"not_available"`.
  - Add the same test for products, built from a fixture product with a blank year.
- [ ] **Step 2: Guard test** `"every selected kind contributes a source link"`:
  - Select one country and one group with `measure` `trade.exports`, then `trade.imports`.
  - Expect `model.sources.map(s => s.downloadHref.split("/").at(-1))` to include each expected original workbook filename.
  - Do the same for products. This passes today; it guards against a renamed archive silently dropping a link.
- [ ] **Step 3: Run** `npx vitest run tests/explorer/tradePartnersWorkbook.test.ts tests/explorer/tradeProductsWorkbook.test.ts`. Expected: the Unavailable tests FAIL, and the guard passes.
- [ ] **Step 4: Implement.** Write a missing point as `value === null ? { amountGel: null, basis: "not_available" as const } : { amountGel: value, basis: "actual" as const }`. Trade overview drops missing points instead; leave it, because its four national series have no gaps.
- [ ] **Step 5: Run.** Expected: PASS. If an existing assertion expects "Actual" on a missing row, change it to Unavailable and name it in the task report.
  - `npx vitest run tests/explorer/tradePartnersWorkbook.test.ts tests/explorer/tradeProductsWorkbook.test.ts`
  - `npx playwright test tests/browser/trade-partners.spec.ts tests/browser/trade-products.spec.ts`
- [ ] **Step 6: Commit:** `fix(trade): mark missing partner and product values Unavailable in Excel`

### Task 3: Current account % of GDP: GDP source in Excel and the source line

**Files:**
- Modify: `lib/pages/external.tsx:135-157` (`renderCurrentAccountPage`); `components/external/current-account.tsx` (props; source line at :63); `lib/explorer/currentAccountWorkbook.ts:12,23`; `lib/i18n/messages/{ka,en}/external.json`
- Test: `tests/explorer/currentAccountWorkbook.test.ts`, `tests/browser/current-account.spec.ts`

**Interfaces:**
- Consumes: `loadGdpWorkbookSources(locale): Promise<WorkbookPublicSource[]>` from `lib/methodology/workbookSources.ts:242`. Debt already uses it. It reads the same SNA 1993/2008 manifest the served `nominal_usd` GDP comes from.
- Produces: `buildCurrentAccountWorkbookModel` input gains `gdpSources?: readonly WorkbookPublicSource[]` (default `[]`), so the existing calls at `currentAccountWorkbook.test.ts:25,39,42,48` and `currentAccountRender.test.tsx:17` compile unchanged. `CurrentAccount` gains the optional prop `gdpSources`.
- Verified in review: the served `nominal_usd` GDP comes from SNA 1993 (1996–2009) and SNA 2008 (2010–2025), the two sources `loadGdpWorkbookSources` returns, and their English titles are already tested.

- [ ] **Step 1: Failing test** `"% of GDP lists the GDP source beside the balance of payments"`, run for `ka` and `en`:
  - With `unit: "gdp"`, expect `model.sources` to include a Geostat GDP entry whose `years` cover only the exported years.
  - With `unit: "usd"`, expect it not to.
- [ ] **Step 2:** `npx vitest run tests/explorer/currentAccountWorkbook.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Load `loadGdpWorkbookSources(locale)` in `renderCurrentAccountPage` and pass it through.
  - Concatenate `input.gdpSources` when `percent && ids.length > 0`. `buildWorkbookExportModel` already filters by years.
- [ ] **Step 4: Source line.**
  - Add the key `external.account.sourceNotePercent`:
    - en: `"Source: National Bank of Georgia · % of GDP ·"`
    - ka draft: `"წყარო: საქართველოს ეროვნული ბანკი · % მშპ-ში ·"`
  - In % of GDP mode, render it followed by the existing `main.gdpSource`.
  - USD mode is unchanged.
- [ ] **Step 5: Browser test** in `current-account.spec.ts`: switch to % of GDP and expect `source-label` to contain `GDP: Geostat` and not `nominal USD`.
- [ ] **Step 6: Run** the unit and browser tests. Expected: PASS.
- [ ] **Step 7: Commit:** `fix(external): cite the GDP source when Current account divides by GDP`

### Task 4: Georgian ordinals from 21 up

**Files:**
- Modify: `lib/explorer/municipalLabels.ts:31-33`
- Test: `tests/explorer/municipalLabels.test.ts`, `tests/explorer/municipalData.test.ts:1135`, `tests/browser/municipal-entity.spec.ts:851-852`

The helper is used by the Budget municipal pages and by the Population place pages (`lib/pages/demography-population-place.tsx:96`). The change also alters the Georgian SEO descriptions built in `lib/seo/municipalMetadata.ts:20`; that is intended, and the report should say so.

- [ ] **Step 1: Failing test** `"georgianOrdinal follows the vigesimal rule"`: `[[1,"პირველი"],[2,"მე-2"],[20,"მე-20"],[21,"21-ე"],[37,"37-ე"],[40,"მე-40"],[41,"41-ე"],[60,"მე-60"],[61,"61-ე"],[64,"64-ე"],[80,"მე-80"],[100,"მე-100"]]`, each `expect(georgianOrdinal(n)).toBe(s)`.
- [ ] **Step 2:** `npx vitest run tests/explorer/municipalLabels.test.ts`. Expected: FAIL at 21.
- [ ] **Step 3: Implement** `georgianOrdinal(rank: number): string`. Use `მე-N` when `rank` is 2–20 or a multiple of 20 up to 100. Use `N-ე` otherwise. Keep `პირველი` for 1.
- [ ] **Step 4: Fix the expectations** that encode the old form. Grep `tests/` with `მე-(2[1-9]|3\d|4[1-9]|5\d|6[1-9]|7\d|8[1-9]|9\d)`. Known hits: `municipalLabels.test.ts:28`, `municipalData.test.ts:1135`, and `municipal-entity.spec.ts:851-852` (`"მე-51 ადგილი 64-დან"` becomes `"51-ე ადგილი 64-დან"`, and `"მე-26"` becomes `"26-ე"`).
- [ ] **Step 5: Run.** Expected: PASS.
  - `npx vitest run tests/explorer/municipalLabels.test.ts tests/explorer/municipalData.test.ts tests/seo/municipalMetadata.test.ts tests/explorer/populationPlacePages.test.tsx`
  - `npx playwright test tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/demography-population.spec.ts`
- [ ] **Step 6: Commit:** `fix(i18n): write Georgian ordinals from 21 as N-ე`

### Task 5: Inflation: Contribution legend unit, product workbook headers

**Files:**
- Modify: `components/inflation/inflation-categories.tsx:258`; `lib/explorer/inflationProductWorkbook.ts:88`; `lib/i18n/messages/{ka,en}/inflation.json`
- Test: `tests/browser/mobile-series-picking.spec.ts`, `tests/explorer/inflationProductWorkbook.test.ts`

- [ ] **Step 1: Failing tests.**
  - Browser: in "the phone legend", add `"prints percentage points on the Contribution tab"`. Open `/en/explorer/inflation/categories` with the Contribution tab and two categories selected (build the hash from the page's spec), and expect every legend `li` to match `/pp$/`.
  - Unit: `"product workbook headers name their period"`. Expect `model.readable.headerLabels.columns[0]` to contain the latest period label and `columns[1]` to contain `${start}–`.
- [ ] **Step 2: Run both.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - On `state.tab === "contrib"`, pass `formatValue={value => `${formatContribution(value)} ${t("pp")}`}` to `ChartSelectionAids`.
  - Add the keys `inflation.productsWorkbookAnnualColumn` and `inflation.productsWorkbookCumulativeColumn`, restoring the texts removed in 39260052:
    - en: `"Latest 12-month change · {period}"` and `"Cumulative change · {start}–{end}"`
    - ka: `"ბოლო 12 თვის ცვლილება · {period}"` and `"დაგროვილი ცვლილება · {start}–{end}"`
  - Use the new keys in the workbook. The on-page table keeps the short labels.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit:** `fix(inflation): pp in the Contribution phone legend, periods in product workbook headers`

### Task 6: Money from abroad: distinct colours and the partial note

**Files:**
- Modify: `lib/explorer/colors.ts` (add helpers); `lib/explorer/foreignInvestment.ts:16-26`; `lib/explorer/moneyTransfers.ts:13-18,43-66`; `lib/explorer/tradePartners.ts:12`; `components/external/money-from-abroad.tsx:34,50,57`; `lib/i18n/messages/{ka,en}/external.json:26`
- Test: `tests/explorer/moneyTransfers.test.ts`, `tests/explorer/foreignInvestment.test.ts`, `tests/explorer/tradePartners.test.ts`

**Interfaces:**
- Produces, in `lib/explorer/colors.ts`:
  - `stableSeriesColor(id: string): string`: today's hash over the non-ink palette. `tradePartnerColor` and `moneyTransferColor` keep their names and call it; the total maps to ink.
  - `distinctSeriesColors(ids: readonly string[], colorOf: (id: string) => string): Record<string, string>`: Foreign investment's private `distinctColors`, moved here with the same behaviour.
- `MoneyTransfersModel` gains `colorById: Record<string, string>`.
- The palette is the set of `SERIES_COLORS` values minus `INK`. Adding a new hex value to `SERIES_COLORS` would recolour Trade and External lines, so this task adds none.

**Unchanged on purpose: the Other countries partial mark.** NBG's all-country total is itself the sum of the countries, with blank months counted as absent; see the 2019 rows of `docs/Raw Data/External/2026-10-10/prepared-reconciliation.csv`. So Other countries (the total minus the top 10) really carries the folded countries' blank months. Today's marking at `moneyTransfers.ts:52` is right, and `moneyTransfers.test.ts:50` stays as it is. The audit finding that said otherwise was wrong.

- [ ] **Step 1: Failing test** `"listed lines never share a colour"` in `moneyTransfers.test.ts`: with the real served data and `measure: "sent"`, for the end years 2022, 2024 and 2025, expect `new Set(model.series.map(s => model.colorById[s.id])).size === model.series.length`.
- [ ] **Step 2:** `npx vitest run tests/explorer/moneyTransfers.test.ts`. Expected: FAIL (Azerbaijan and the United States share #084D61).
- [ ] **Step 3: Implement.**
  - Add `stableSeriesColor` and `distinctSeriesColors`, and point `tradePartnerColor`, `moneyTransferColor` and Foreign investment at them (Foreign investment's and Trade's tests stay green unchanged).
  - In `buildMoneyTransfersModel`, set `colorById = distinctSeriesColors(ids, moneyTransferColor)`, and use it for `series`, `ranking` and `other`.
- [ ] **Step 4: Component.** Replace `moneyTransferColor(id)` at :34 and :50 with `model.colorById[id]`.
- [ ] **Step 5: Partial note.**
  - Change the messages to a placeholder:
    - en: `"Partial: some months of {years} are blank in NBG's source."`
    - ka draft: `"არასრ.: {years} წლის ზოგი თვე ეროვნული ბანკის წყაროში ცარიელია."`
  - Fill `years` from the partial years of the selected lines.
  - Add a render or browser assertion that the note still reads 2019 today.
- [ ] **Step 6: Run.** Expected: PASS.
  - `npx vitest run tests/explorer/moneyTransfers.test.ts tests/explorer/foreignInvestment.test.ts tests/explorer/moneyTransfersWorkbook.test.ts tests/explorer/tradePartners.test.ts`
  - `npx playwright test tests/browser/money-from-abroad.spec.ts`
- [ ] **Step 7: Commit:** `fix(external): distinct line colours on Money from abroad; partial-note years from the data`

### Task 7: Migration Excel gets a status column

**Files:**
- Modify: `lib/explorer/demographyMigrationWorkbook.ts:70-76`
- Test: `tests/explorer/demographyMigrationWorkbook.test.ts`

- [ ] **Step 1: Change the expectations, then add the null case.**
  - The two five-column `toEqual` checks at `demographyMigrationWorkbook.test.ts:42` (headers) and `:44` (a row) become six columns, with the status header and its cell.
  - New test `"a missing migration value is Unavailable"`: expect the row's last cell to be the unavailable label.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Append the header `workbookMessage(locale, "workbook.status")` and, per row, `workbookMessage(locale, value === null ? "workbook.unavailable" : "workbook.published")`, as `demographyVitalWorkbook.ts:68` does. That file has no `w` helper, so call `workbookMessage` directly. `numericFormats` stays `{ 5: "#,##0" }`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit:** `fix(demography): status column in the Migration workbook`

### Task 8: Births: say "every year on record" when the streak is the whole series (waits on Q4)

**Files:**
- Modify: `components/demography/vital-section.tsx:56-59`; `lib/i18n/messages/{ka,en}/demography.json`
- Test: `tests/explorer/vitalSection.test.tsx`

- [ ] **Step 1: Change the expectation.** Replace the assertion at `vitalSection.test.tsx:45` ("…since 2015.") with the Imereti (`wholeSeries: true`) sentence `"Deaths have outnumbered births in every year on record, 2015–2025."`. The Georgia case (since 2020) stays unchanged. Run it: FAIL.
- [ ] **Step 2: Implement.**
  - Add the key `demography.vitalDeathsWholeSeries`, with placeholders `{first}` and `{last}`:
    - en: as in Step 1
    - ka draft: `"{first}–{last} წლებში, მონაცემების მთელ პერიოდში, გარდაცვალებათა რიცხვი ყოველ წელს დაბადებათა რიცხვს აღემატება."`
  - Use it when `streak.wholeSeries`.
- [ ] **Step 3: Run.** Expected: PASS.
- [ ] **Step 4: Commit:** `fix(demography): don't present the first year on record as the start of a streak`

---

## Phase 2: Page weight

### Task 9: Compact payloads for Trading partners and Money from abroad

**Files:**
- Modify: `lib/data/tradePartners/importTradePartners.ts:13-14,57-59`; `lib/explorer/tradePartners.ts:25`; `lib/explorer/tradePartnersState.ts:12`; `components/trade/trade-partners*.tsx` (readers of `facts`); `lib/data/externalFlows/importMoneyTransfers.ts:58-61` and its client type
- Test: `tests/data/tradePartners/serving.test.ts`, `tests/explorer/tradePartners*.test.ts(x)`, `tests/explorer/moneyTransfers*.test.ts`

**Interfaces:**
- Produces:
  - `ClientTradePartnerFact = [entityIndex: number, year: number, measureIndex: 0 | 1 | 2 | 3, valueUsd: number | null]`. `measureIndex` indexes `TRADE_OVERVIEW_INDICATORS` (`turnover, exports, imports, balance`). This is the same tuple pattern as `ClientTradeProductFact`.
  - `ClientTradePartnersData` keeps `entities` and `nationalFacts`, and its `facts` becomes the tuple array.
  - The Money from abroad client fact drops `sourceId` and `vintage`.
- Turnover and balance stay shipped, not recomputed. They are reviewed exact derivations, and the Excel Data sheet prints them to 15 digits.

- [ ] **Step 1: Measure the baseline.** Run `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then record the bytes of `.next/server/app/explorer/trade/partners.html`, `partners.rsc`, `external/money-from-abroad.html` and the `/en` copies (about 6.5 MB / 5.5 MB / 2.3 MB).
- [ ] **Step 2: Failing test** `"the client partners payload carries only index, year, measure and value"`: expect `toClientTradePartnersData(data, national).facts[0]` to be an array of length 4, and `JSON.stringify(client).length` to be under 1_000_000.
- [ ] **Step 3: Implement the tuple and update every reader.**
  - `tradePartners.ts:25` builds `cells` from tuples.
  - `tradePartnersState.ts:12` derives years from `fact[1]`.
  - Every model output, ranking, table and workbook value must be unchanged, so model, ranking and workbook expectations stay as they are.
  - Test setup that builds variant data by spreading fact objects (`tradePartners.test.ts:37,49,51,59,61,63,70`, `tradePartnersWorkbook.test.ts:50,63`) is rewritten to build tuples.
  - `serving.test.ts:22-24` assert the object shape and are replaced with tuple-shape checks.
- [ ] **Step 4: Money from abroad.** Drop `sourceId` and `vintage` from the client fact, then run its tests.
- [ ] **Step 5: Rebuild and measure.** Expect partners HTML under 1.2 MB and money-from-abroad HTML under 1.6 MB; the review measured partner facts at 6.04 MB escaped against 0.56 MB as tuples, and money facts at 2.16 MB against 1.37 MB. Report before/after in the task report.
- [ ] **Step 6: Run** the tests and `npx playwright test tests/browser/trade-partners.spec.ts tests/browser/money-from-abroad.spec.ts`. Expected: PASS.
- [ ] **Step 7: Commit:** `perf(trade,external): ship compact facts to the Partners and Money from abroad pages`

---

## Phase 3: Phone behaviour the new pages are missing

### Task 10: Phone legend and return-to-chart pill on Trade, External flows and Wages

DESIGN §8.3 (phone legend) and §7.14 (return pill) apply to every multi-line chart. Seven pages built after #158 omit `ChartSelectionAids`: `components/trade/trade-overview.tsx`, `trade-partners.tsx`, `trade-products.tsx`, `components/external/money-from-abroad.tsx`, `foreign-investment.tsx`, `current-account.tsx` (In/Out tabs; the Balance tab is a stacked column, so no legend there) and `components/wages/wages-explorer.tsx`.

**Files:**
- Modify: the seven components above
- Test: `tests/browser/mobile-series-picking.spec.ts` ("the phone legend")

**Interfaces:**
- Consumes: `ChartSelectionAids({ series, chartShown, share, unit, formatValue })` from `components/explorer-shell/chart-selection-aids.tsx`, used as `components/demography/population-place-explorer.tsx:171` does. Give `formatValue` the same formatter as each page's tooltip. For Wages, use Task 1's per-series one: extend `ChartSelectionAids.formatValue` to `(value: number, seriesId: string) => string`, and have `legendValue` pass `line.id`.
- Depends on Task 1's per-series tooltip formatter.
- Placement: the element directly after the chart's own wrapper, inside the chart `<section>`. Both the CSS rule at `app/globals.css:126` and `chartInView`'s `previousElementSibling` rely on that position.
  - Usually that is just before `RangeStrip`.
  - On Products it is immediately after the `trade-products-plot` div (`components/trade/trade-products.tsx:65`), before the `trade-products-selection` chips (:69).
- Current account: `chartShown={state.mode === "line" && !balance}`. The Balance tab is a stacked column chart that also renders in "line" mode, and it gets no legend.
- Products allows up to 1,193 lines. Add an optional `legendCap?: number` to `ChartSelectionAids`: above the cap the legend is not drawn, but the return pill still works. Products passes `legendCap={10}`, the tooltip's row cap; the chips already name every selection.

- [ ] **Step 1: Failing browser tests.** Add one `"lists two lines on <page>"` test per page under "the phone legend".
  - Open the page with a two-series deep link taken from that page's own spec, and expect `legend.locator("li")` to have count 2.
  - Add one `"stays hidden for one line"` test on Trade overview's default view.
  - Add `"stays hidden on the Current account Balance tab"`, and `"stays hidden above ten products"` on Products with 11 selected.
  - Add `"keeps the median in whole lari"`: on `/en/explorer/wages/overview#view=line&sel=average,median`, expect the median item to match `/1,531 GEL$/` and the average item to match `/2,165\.2 GEL$/`.
- [ ] **Step 2:** `npx playwright test tests/browser/mobile-series-picking.spec.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Add `<ChartSelectionAids …/>` to each page**, with `chartShown={state.mode === "line"}`.
- [ ] **Step 4: Run** the spec plus the seven page specs. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(mobile): phone legend and return-to-chart pill on Trade, External flows and Wages`

---

## Phase 4: One copy of each thing (no behaviour change)

### Task 11: One URL-hash state hook

**Files:**
- Create: `components/explorer-shell/use-hash-state.ts`. Closest existing: `useHashState` in `components/external/use-money-from-abroad-state.ts:12`. It moves here under a neutral name, because it lives in a feature file today.
- Modify: `components/external/use-money-from-abroad-state.ts` (keep only `useMoneyFromAbroadState`, or inline it), `components/external/foreign-investment.tsx`, `current-account.tsx`, `components/trade/trade-overview.tsx:27-49`, `components/trade/use-trade-partners-state.ts`, `components/trade/use-trade-products-state.ts`, `components/wages/wages-explorer.tsx:35-54`
- Test: the existing state and browser tests for the five pages

**Interfaces:**
- Produces: `useHashState<D, S>(data: D, parse: (hash: string, data: D) => S, serialize: (state: S, data: D) => string, normalize?: (next: S, data: D) => S): { state: S; update: (change: (previous: S) => S, push?: boolean) => void }`.
  - `parse` and `serialize` must be stable references (module level, or `useCallback`).
  - Wages passes `data = useMemo(() => ({ section, facts }), [section, facts])`.
  - Products passes `normalize` with its refit and `selectionReset: false`, and reads `state.selectionReset`.
  - `normalize` runs inside `update` only, never on restore. If it ran on restore it would clear `selectionReset`, and Products' reset notice would never show.
- `useUnemploymentState` stays as it is: its signature differs and it is the original. `use-economic-sectors-state.ts` and `use-regional-economy-state.ts` also stay as they are: they are older explorers outside the five audited copies.
- This task edits components Task 10 just changed; keep Task 10's legend placement.

- [ ] **Step 1: Add a browser test** `"an explicitly empty selection and Back restore the same view"` to each of the five page specs: `trade-overview`, `trade-partners`, `trade-products`, `wages` and `money-from-abroad`. Open `#…&sel=`, expect `no-selection-callout`, select one series, `page.goBack()`, and expect the callout again. It passes before the refactor. Keep it as the guard.
- [ ] **Step 2: Create the shared hook.** Replace the five copies. Delete each copy's body, leaving no wrappers with duplicated logic.
- [ ] **Step 3: Run.** Expected: PASS, with no expectation edited.
  - `npx vitest run tests/explorer/trade*State.test.ts tests/explorer/wages.test.ts tests/explorer/moneyTransfersState.test.ts`
  - `npx playwright test tests/browser/{trade-overview,trade-partners,trade-products,wages,money-from-abroad,foreign-investment,current-account}.spec.ts`
- [ ] **Step 4: Commit:** `refactor: one URL-hash state hook for Trade, External flows and Wages`

### Task 12: One region-map builder and the shared dropdown style

**Files:**
- Modify: `lib/explorer/regionalEconomyMap.ts` (add builder); `lib/explorer/wagesRegionMap.ts`; `lib/explorer/unemploymentRegionMap.ts`; `components/wages/wages-explorer.tsx:33` and `components/unemployment/unemployment-explorer.tsx:40` (`selectClass`: export it once from `components/ui/editorial.tsx` as `SELECT_CLASS`, and import it in both)
- Test: `tests/explorer/unemploymentRegions.test.tsx` (it already calls `buildUnemploymentRegionMapModel`), `tests/explorer/wages.test.ts` (add a call to `buildWagesRegionMapModel`), `tests/explorer/regionalEconomyMap.test.ts`

**Interfaces:**
- Produces: `buildLatestValueRegionMapModel(input: { latest: ReadonlyMap<string, number>; year: number; firstYear: number }): RegionMapModel` in `regionalEconomyMap.ts`. It holds the shared geometry lookup, the missing-region throw, the unknown-region throw, the sort, the buckets and the legend.
- Each caller keeps its own filtering and validation (Unemployment's duplicate and 0–100 checks) and then delegates.

- [ ] **Step 1: Snapshot guard.** Before refactoring, record `createHash("sha256").update(JSON.stringify(build…(facts))).digest("hex")` for each builder, and assert it in the existing tests. The model includes SVG paths, so a full JSON fixture would be large. Run it green first.
- [ ] **Step 2: Refactor.** Run the two test files. Expected: PASS with fixtures unchanged.
- [ ] **Step 3: Commit:** `refactor: one latest-value region map builder for Unemployment and Wages`

### Task 13: Shared helpers in Trade and External flows

**Files:**
- Modify: `lib/explorer/colors.ts`; `lib/explorer/tradePartnersWorkbook.ts:32-39`; `lib/explorer/moneyTransfersWorkbook.ts`; `foreignInvestmentWorkbook.ts`; `currentAccountWorkbook.ts:27-32`; `lib/data/externalFlows/prepare*.ts` (3 files: the manifest and independent-evidence check); `lib/explorer/currentAccount.ts:10`
- Test: the existing workbook and prepare tests, plus `npm run data:validate` for the preparers

**Interfaces:**
- Produces:
  - `usdWorkbookNumberFormat(values: readonly number[], unit: ValueUnit): { amountDecimals: number; numberFormat: string; exactFormat: string }` in `lib/explorer/workbookModel.ts`.
  - `assertExternalPackageEvidence(...)` in `lib/data/externalFlows/`. Its exact signature is whatever the three copies share; name the shared parameters in the commit.
  - Current account colours become `SERIES_COLORS["ca.goods" | "ca.services" | "ca.primary_income" | "ca.secondary_income"]`, with the same hex values. All four hexes already exist in `SERIES_COLORS`, so the palette that hashed colours draw from is unchanged. The colour helpers themselves moved to Task 6.
- [ ] **Step 1: Refactor one helper at a time.** After each, run its tests:
  - `npx vitest run tests/explorer/{tradePartners,moneyTransfers,foreignInvestment,currentAccount}Workbook.test.ts`
  - `npx vitest run tests/data/externalFlows`
  - then `npm run data:validate`
  - Expected: PASS, with no expectation edited.
- [ ] **Step 2: Commit:** `refactor: share USD workbook formats, package checks and Current account colour tokens across Trade and External flows`

### Task 14: Demography index rows and colour token

**Files:**
- Modify: `lib/explorer/demographyVitalIndex.ts:70-101`; `lib/explorer/demographyPopulationIndex.ts:53-84`; `components/demography/national-vital-charts.tsx:22`
- Test: `tests/explorer/demographyVitalIndex.test.ts`, `tests/explorer/demographyPopulationIndex.test.ts`

**Interfaces:**
- Produces: `buildPlaceIndexRows(places, valueOf: (placeId: string) => number | null): IndexRow[]` exported from `demographyPopulationIndex.ts`. It covers the municipality, region and Georgia rows. Vital calls it with its own `valueOf`.
- Keep the Georgian literals (`საქართველო`, `N მუნიციპალიტეტი`) in `nameKa`/`subtitleKa` exactly as today, with no `presentation` parameter. `municipalities-index.tsx:58,156` already localizes those fields for English, and routing them through messages would change the English output.
- `FIRST_YEAR_COLOR` becomes the existing `sex.male` token in `colors.ts` (same hex).

- [ ] **Step 1: Refactor.** Run the two index test files and `npx playwright test tests/browser/demography-births-deaths.spec.ts tests/browser/demography-population.spec.ts`. Expected: PASS unchanged.
- [ ] **Step 2: Commit:** `refactor(demography): one place-row builder for the Population and Births indexes`

### Task 15: Data preparers share the workbook reader

**Files:**
- Modify: `lib/data/tradeOverview/prepareTradeOverview.ts:41`; `lib/data/wages/prepareWages.ts:39`
- Consumes: `readTradeSourceWorksheet` from `lib/data/parsing/tradeSourceWorkbook.ts`. It resolves the sheet by name, not by `sheet${i+1}.xml`.

- [ ] **Step 1: Replace both inline readers.** Run `npm run data:check-trade-overview` and `npm run data:check-wages`. Expected: byte-identical output, PASS.
- [ ] **Step 2: Commit:** `refactor(data): Trade overview and Wages preparers use the shared worksheet reader`

### Task 16: One list of dataset hubs (waits on Q3)

**Files:**
- Create: `lib/navigation/datasetHubs.ts`. Closest existing: the five inline lists, none of which is importable by the others.
- Modify: `components/site/site-header.tsx:15-21`; `components/site/site-footer-view.tsx:7-16`; `app/global-not-found.tsx:11-29`; `lib/landing/landingDatasets.ts` and `lib/pages/home.tsx:39` (only if Q3 adds hubs to the landing row)
- Leave as is: `components/shell/data-sidebar.tsx`. It carries every hub's sub-pages and active states. A test pins its top-level hub order to `DATASET_HUBS`.
- Test: `tests/landing/landingDatasets.test.ts`, `tests/browser/mobile-site-menu.spec.ts`, `tests/browser/mobile-repairs-nav.spec.ts`, `tests/browser/landing.spec.ts`, `tests/browser/seo.spec.ts`

**Interfaces:**
- Produces: `DATASET_HUBS: readonly { href: \`/explorer${string}\`; labelKey: string }[]` in sidebar order. `global-not-found.tsx` maps `labelKey` through a static import of `ka/common.json` and `en/common.json`.

- [ ] **Step 1: Test** `"header, footer, 404 and sidebar list the same hubs in the same order"`: read the header, footer and 404 lists and the sidebar's top-level hub links, and compare their hrefs with `DATASET_HUBS`.
- [ ] **Step 2: Implement.** Add the hubs Q3 approves. For each new landing entry, add its latest figure to `buildLandingDatasetLinks` from served facts, following the existing entries, with a unit test asserting the 2025 value.
- [ ] **Step 3: Run** the landing unit test and the four browser specs above. Expected: PASS.
- [ ] **Step 4: Commit:** `refactor(nav): one dataset-hub list for header, footer and 404`

---

## Phase 5: Accessibility and design rules

### Task 17: Source archive on phones, Products picker shadow, municipal amounts on desktop

**Files:**
- Modify: `components/methodology/source-archive.tsx:109-145`; `components/trade/trade-products-picker.tsx:59`; the three municipal comparison `<td>` cells that lost `whitespace-nowrap` in #158. `git show b0dd8339` prints nothing for a merge, so find them with `git diff 83fec8bd b0dd8339 -- apps/web/components/municipalities`.
- Test: `tests/browser/methodology.spec.ts`, `tests/browser/trade-products.spec.ts`, `tests/browser/municipal-entity.spec.ts`

The repo has no @testing-library, and Vitest runs in a `node` environment where CSS classes do not apply. So the archive check is a Playwright test.

- [ ] **Step 1: Failing browser test** `"the archive keeps its column headers and table role on a phone"` in `methodology.spec.ts`, at 390×844:
  - Expect `page.getByRole("columnheader")` to have the same count as at desktop width. It fails today, because `<thead>` is `display:none` below 760px.
  - Expect the archive `<table>` to carry the attribute `role="table"`.
- [ ] **Step 2: Implement.**
  - Replace `max-[759px]:hidden` on `<thead>` with the repo's `sr-only` equivalent below 760px.
  - Add explicit `role="table" | "rowgroup" | "row" | "columnheader" | "cell"`, because `display:block` drops native table roles in Chromium.
- [ ] **Step 3: Products picker.** Remove `shadow-xl`. DESIGN §6.6 allows only the tooltip, slider handles and the return pill to cast a shadow, and the backdrop already separates the dialog.
- [ ] **Step 4: Desktop check.**
  - At 1440×900, open a municipality comparison table and assert every amount cell's `getBoundingClientRect().height` equals the row's single-line height.
  - If any wraps, restore `whitespace-nowrap` from `min-[768px]:` only. Phones keep wrapping.
- [ ] **Step 5: Run.** Expected: PASS.
  - `npx playwright test tests/browser/methodology.spec.ts tests/browser/bilingual-methodology.spec.ts tests/browser/trade-products.spec.ts tests/browser/municipal-entity.spec.ts`
- [ ] **Step 6: Commit:** `fix(a11y): table roles for the stacked source archive, no picker shadow, unwrapped municipal amounts`

---

## Phase 6: Docs, guards and hygiene

### Task 18: Bring the docs in line with the code (parts wait on Q1)

**Files:**
- Modify:
  - `apps/web/public/llms.txt`: add Unemployment, Trade, External flows and Wages entries in the house style of the existing lines. Write coverage as each page states it, and do not invent figures.
  - `tests/seo/agentFiles.test.ts`, if it pins the entry list.
  - `AGENTS.md:44`: the route-family sentence gains unemployment, trade, external flows, wages and demography.
  - `docs/data-methodology/wages-annual.md:76`: the command becomes `npm run data:prepare-wages`.
  - `docs/superpowers/specs/2026-10-09-wages-explorer-design.md`: one line under the Status line, `Sections 2–3 predate the 2026-10-10 amendments; Project_Definition.md §2G is authoritative.`
  - `docs/data-methodology/external-flows-annual.md:3`: the intro names the three live pages (Money from abroad, Foreign investment, Current account) instead of "one subset".
  - `docs/data-methodology/trade-annual.md:79` and `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/README.md:16`: replace the machine-specific Python path with `python` and a one-line requirement (Python 3.12+ with openpyxl).
  - `Project_Definition.md:145`: "demography remains a marker" is out of date (Demography ships); say so.
  - `Project_Definition.md:141,147,149` and `docs/data-methodology/unemployment-annual.md:13`: state the defaults the code uses (Gender: Georgia + Men + Women; Age: 15–19 + 25–29). Check them against `lib/explorer/unemploymentState.ts` first.
  - `Project_Definition.md:176` against `DESIGN.md` §30: change the scope text to say the 2010 break is "explained in the methodology, not marked on the page" (Q1 = "keep as is"), or leave it and do Task 23 (Q1 = "add the marker").
  - `apps/web/vitest.config.ts:9` comment: "four workers" becomes "two workers".
- Create: `docs/superpowers/specs/2026-10-07-mobile-ux-decisions.md`. The lead writes it, from the owner's review artifact `https://claude.ai/artifact/FAyjWt6wqbXCFXVYGhhyfB` (read with the Artifact tool). It is one paragraph per decision D1–D11, giving the decision, the date and the files it touched, so that the 21 code comments citing "owner decision Dn" resolve to a repo document.

- [ ] **Step 1: Make the edits.** Run `npx vitest run tests/seo/agentFiles.test.ts` and `npm run i18n:check`. Expected: PASS.
- [ ] **Step 2: Commit:** `docs: bring llms.txt, AGENTS, scope and methodology docs in line with the shipped pages`

### Task 19: Guard against oversized server functions

**Files:**
- Create: `apps/web/scripts/check-function-size.ts`. Closest existing: `scripts/prepare-fact-query-publications.ts --check`, the other postbuild check. It checks a different thing, so this is a sibling script, not an extension.
- Modify: `apps/web/package.json` `postbuild` (append the script); `docs/deployment.md` (one paragraph: the #170 incident, the `outputFileTracingExcludes` rule, the guard and its limit)
- Test: `tests/scripts/checkFunctionSize.test.ts` (beside `auditDependencies.test.ts`)

**Interfaces:**
- Produces: `functionTraceBytes(nftJsonPath: string, shared?: readonly string[]): Promise<number>`, which sums the sizes of the union of the files a route's `.nft.json` lists and the files of the shared `.next/next-server.js.nft.json` (about 22.8 MB), each resolved relative to its own trace file. The CLI fails if any route under `.next/server/**/*.nft.json` exceeds `200 * 1024 * 1024` bytes, and prints the five largest.
- Verified in review: this repo's Turbopack build writes 114 `.nft.json` files, and `/mcp` traces to 91.0 MB.

- [ ] **Step 1: Failing unit test.** Write a fixture `.nft.json` listing two temp files of known size, and expect `functionTraceBytes` to return their sum. Call it on a fixture over the limit and expect the CLI's exported `checkFunctionSizes(dir, limit)` to reject.
- [ ] **Step 2: Implement.** Run `npm run build`. Expected: the postbuild prints the largest function (about 95 MB, `/mcp`) and passes.
- [ ] **Step 3: Commit:** `build: fail the build when a server function trace nears Vercel's 250 MB limit`

### Task 20: Unblock the dependency-update PR #165

**Files:**
- Modify: `apps/web/package.json` (`overrides`) and `package-lock.json`, only as far as the audit requires

- [ ] **Step 1: Find the unaccepted advisories.** In a scratch worktree of `origin/dependabot/npm_and_yarn/apps/web/minor-and-patch-5473bf5102`, run `npm ci && npx tsx scripts/audit-dependencies.ts`. Record which of `GHSA-hrr3-gc8f-f4qj` (fast-uri), `GHSA-hxh3-vqpv-xpqv`, `GHSA-w5hq-g745-h8pq` and others fail, and through which parent.
- [ ] **Step 2: Fix on this branch.**
  - Map each advisory ID to its package from the script's output. The IDs were read from the CI log; their packages and patched versions are unverified.
  - `fast-uri` is already pinned at `apps/web/package.json:178` (`"3.1.7"`). Raise that pin to the patched version rather than adding an override.
  - `uuid` 8.3.2 is a production dependency of exceljs (`^8.3.0`), which runs in the browser Excel download. Look for a patched 8.x first. If only 11.x is patched, stop and report: crossing a major version inside the Excel bundle, or accepting the risk, is the owner's decision.
  - For any other package, raise it with `overrides` to the patched version the advisory names.
  - Re-run `npx tsx scripts/audit-dependencies.ts` on this branch, then `npx vitest run tests/explorer/*Workbook.test.ts`, one browser download test (the Excel test in `tests/browser/wages.spec.ts`) and `npm run check`.
  - Do not extend any accepted-risk expiry.
- [ ] **Step 3: Note the deadline.** The braces / eslint-config-next accepted risk expires on **2026-11-02**. Add one line to the task report saying who re-checks it, and when.
- [ ] **Step 4: Commit:** `build(deps): override patched transitive packages so the dependency audit passes`

### Task 21: Remove the unreachable all-periods Products mode

**Files:**
- Modify: `lib/data/tradeProducts/importTradeProducts.ts:59-65` (make `sourceBlock` required); `lib/explorer/tradeProducts.ts:12-13` (drop `includeSourceBlock`); `components/trade/trade-products.tsx:73,80`; `lib/explorer/tradeProductsWorkbook.ts:27,34`; the seven test files that use the unscoped `productData()` fixture (switch to `productData("2020-2025")`, or the scoped equivalent); the now unused `trade.products.historicalNote` key in `lib/i18n/messages/{ka,en}/trade.json`

- [ ] **Step 1: Implement.** Run `npx vitest run tests/explorer/tradeProducts*.test.ts tests/explorer/tradeProducts*.test.tsx` and `npx playwright test tests/browser/trade-products.spec.ts`. Expected: PASS. Tests that only exercised the removed mode are deleted, and the report lists them.
- [ ] **Step 2: Commit:** `refactor(trade): drop the Products code path no page reaches`

### Task 22: Small hygiene

**Files:**
- Modify: `components/gdp/gdp-overview.tsx:79` (wrap `buildGdpOverviewModel` in `useMemo` keyed on its inputs); `tests/browser/mobile-series-picking.spec.ts:113,123` (replace `waitForTimeout(300)` with a wait for the condition: `await expect(page.locator('[data-series-id="…"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true")` before the negative assertion; the attribute sits on the toggle, `series-selector.tsx:229,268`); `tests/browser/wages.spec.ts:17` (assert that the element following the heading is `wages-latest`, instead of only that `wages-nominal-note` is absent)

- [ ] **Step 1: Make the edits.** Run `npx playwright test tests/browser/mobile-series-picking.spec.ts tests/browser/wages.spec.ts tests/browser/gdp-overview.spec.ts`. Expected: PASS.
- [ ] **Step 2: Commit:** `test: condition waits instead of fixed sleeps; memoize the GDP overview model`

### Task 23 (only if Q1 = "add the marker"): the January 2010 microfinance break on Money from abroad

**Files:**
- Modify: `components/external/money-from-abroad.tsx`; `lib/explorer/moneyTransfersWorkbook.ts`; `lib/i18n/messages/{ka,en}/external.json`; `DESIGN.md` §30 (remove "not marked on the page")
- Consumes: the existing `RangeStrip` `marker={{ year, label }}` prop and `ExplorerTable` `breakYears`/`breakLabel`, as Population uses them for the census.

- [ ] **Step 1: Failing browser test.** With 2008–2012 in range, expect the range strip marker and the table break label for 2010, and the readable sheet's subtitle to name the break.
- [ ] **Step 2: Implement.**
  - No constant exists yet; the year appears only in prose. Add `MONEY_TRANSFERS_MICROFINANCE_BREAK_YEAR = 2010` to `lib/data/externalFlows/types.ts`, with a comment pointing to `docs/data-methodology/external-flows-annual.md`.
  - Use `marker={{ year: MONEY_TRANSFERS_MICROFINANCE_BREAK_YEAR, label: t("money.microfinanceBreak") }}` when that year is inside the range.
- [ ] **Step 3: Run.** Expected: PASS.
- [ ] **Step 4: Commit:** `feat(external): mark the January 2010 microfinance break on Money from abroad`

### Task 24: Release gate (lead)

- [ ] **Step 1:** `npm run check`. Expected: PASS (lint, typecheck, about 3,670 tests, data, i18n).
- [ ] **Step 2:** Build and run the browser suite against the build:
  - `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100`
  - then `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`
  - Expected: all pass. Stop the server before any rebuild.
- [ ] **Step 3:** `npx vitest run tests/factQuery/reference.test.ts`. Expected: PASS (Task 13 touches no query code, so any change here is a stop condition).
- [ ] **Step 4:** Write the plain-language summary for the owner. It covers:
  - what changed on each page
  - before/after page sizes
  - every Georgian draft string for review
  - the 2026-11-02 audit deadline
- [ ] **Step 5:** With the owner's authorization, push, open a draft PR, wait for green CI, merge, then verify the deploy (`releaseCommit` and the touched URLs return 200).

---

## Owner decisions

- **Q1. Money from abroad, January 2010.** The scope document says the microfinance break "is marked", but the page and DESIGN say it is explained only in the methodology. Add a marker on the chart and in the table (Task 23), or correct the scope text (Task 18)?
- **Q2. Wages region pages.** Today only the region's line is selected at first, as on the Unemployment region pages. Should the Georgia average also be drawn at first? If yes, it is a one-line change to `defaultWagesState` plus its test, added to Task 1.
- **Q3. Site menu, footer, 404 and landing row.** They list Budget, Economy, Inflation, Unemployment and Trade. Should External flows, Wages and Demography be added? If so, all three or a subset, and in the landing row with a latest figure too? Also, on desktop the header's "Data" link still opens only the Budget hub, while phones get the dataset menu: should desktop get the same menu? (If yes, that is part of Task 16.)
- **Q4. Births wording.** Approve the Georgian draft in Task 8, or supply your own.
- **Q5. Trade research files.** 254 MB of the 434 MB research package is CSV that a script regenerates byte for byte. Removing it from the current tree would make CI checkouts lighter. It cannot shrink the history, and it changes what "the package" contains. Keep it as is (the default), or plan its removal separately?
- **Q6. Paragraphs under the headings on Trade and External flows.** DESIGN §17's one-line rule (2026-10-10) leaves older pages alone. Trade predates it. External flows merged the same day, after the rule, and still shows a summary paragraph under each heading. Remove them to match Wages? If yes, that is a small extra task: delete the paragraph, update each page's spec, and keep the text as the page's meta description.

## Deliberately not done, and why

- **Hard-coded counts in the research validators** (1995–2025, 217 partners, 4,768 products). They are deliberate tripwires that stop a new release until a person reviews it, and the pages already derive years from facts.
- **Unemployment's `…_FIRST_YEAR = 2020` constants.** These are methodology boundaries (age bands and employment status redefined in 2020), not coverage.
- **Unemployment's "from 2020 onward" texts.** These state a methodology boundary, not coverage. (The Wages coverage words are fixed in Task 1.)
- **The Other countries partial mark on Money from abroad.** The audit finding was wrong; see Task 6.
- **The Python research checks are not in CI.** The research packages change rarely, and adding Python to CI is an owner call. Ask if wanted.
- **The Wages Industries payload** (about 439 KB raw, 1,753 facts). Measured, and small once compressed, unlike Partners.
- **Self-hosting the Google fonts.** The fetch failed once in the last 25 failed CI runs, and a re-run is the fix (Op 1).
- **The sidebar toggle's desktop label before hydration on phones.** It lasts only until hydration, typically well under a second.
- **The teaser-row contrast.** `TEASERS` is empty, so nothing renders. Fix it when a teaser is added.
- **The 56,040 product facts and the history in the private mirror.** The owner approved this scope (§2E). It is watched through deploy import time, not changed.
- **`publishedNet` in Migration.** It backs the reconciliation test (computed net equals published net), so it is not dead code.
- **Line-ending churn in #171 and the scope creep in #153/#154/#158.** They are already merged and cause no defect.
- **Wages' nested series rows against `UnemploymentOverviewSeriesPanel`.** The two differ in data shape. A generic nested panel is a design of its own; revisit it when a third page needs one.
- **Products reusing `TradePartnersRanking` through a `tab: "products"` flag.** That is reuse working as intended. Renaming its `trade-partners-*` test ids would only be churn.
- **`UNIT_DENSITY` used as a general one-decimal unit,** and the three identical "Updated {date}" keys (`common`, `main`, `municipal`). Both are naming only. Merging the keys means loading `common` on every page.
- **The 52 personal-transfer rows imported but not shown.** §2F approved importing them.
- **The demography place pages' payload.** Measured live at about 40 KB compressed per page, which is fine.
- **The committed plan files, the `fitSubtitle` change #162 made to inflation, and `range-strip.tsx`'s `mt-7` beside a marker.** These are project convention, already merged, and behave as intended.
- **The globals.css rule that ties the legend to the readout by position.** It is documented in place, and Task 10 respects it.

## Hand-off to the Age-and-sex session (branch `claude/demographics-remaining-3119f2`)

Send these to that session (Op 2). It fixes them before its branch ships:

1. Commit 10b40db2 sets the page live before Task 8 registers `source.geostat_demography_population_age_sex` and `source.geostat_census2024_population_by_age_settlement` in `data/methodology/source-archives/demography.csv`, which leaves the Sources sheets empty. Register the sources first, and add a test using the real manifest.
2. `lib/explorer/demographyHubCards.ts:62` (branch): split the 65+ sparkline at the 2025 census break, as the Population card's `sparkValues` does.
3. The pyramid Excel export from a 2004-against-2026 comparison exports headcounts with no break flag. Flag every exported year at or after the break, as the page does.
4. `components/demography/age-sex-section.tsx:58` and `demographyAgeSexRegions.ts` use `COVERAGE.populationFrom` and `CENSUS_YEAR`. Derive them from the loaded facts.
5. `lib/pages/demography-age-sex.tsx:70`: the explanatory sentence under the heading breaks DESIGN §17, which reached main after the branch's base. Remove it when rebasing onto main.
6. The shared `HeatmapTable` still imports `unemploymentAgeHeatmapBin` and keeps the test id `age-heatmap-scroller`. Give both neutral names in the same refactor. If `ModeTabs` and `Download` are exported from the feature file `national-vital-charts.tsx` on the branch, move them to `components/ui/` too.
