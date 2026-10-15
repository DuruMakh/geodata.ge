# Foreign Debt and Reserves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two bilingual External flows pages, `/explorer/external/foreign-debt` and `/explorer/external/reserves` (plus `/en` mirrors and hub cards 04–05), serving about 254 reviewed National Bank of Georgia values in USD, each with a marked latest 2026 point.

**Architecture:** This follows the Money and banks hub file by file (PR #177, merge commit `1eaab3f6`; `git diff 1eaab3f6^1 1eaab3f6 -- <file>` shows what it added to any shared file). The pieces are an immutable research package, a TypeScript prepare/check step that writes the canonical CSV, a loader with CSV/DB parity, a private Prisma mirror table, and one thin client explorer for both pages built on `topicSeries.ts` and the shared explorer shell. The pages sit in the External flows hub next to Current account, whose USD GDP share they reuse.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, Python 3 stdlib (research package), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-15-foreign-debt-reserves-design.md` (approved by Duru 2026-10-15 13:40 Tbilisi).

**Branch:** `claude/project-thread-w3823d` (already holds the spec commit), cut from `origin/main` at `b0bc5194`.

## Global Constraints

- Values are on 31 December each year, plus exactly **one** latest 2026 point per indicator: 2026-06-30 for every `ext_debt.*` series and 2026-09-30 for every `reserves.*` series. The 2026 point is the published amount on that date, never a sum or average of months.
- Coverage: `ext_debt.*` 2006–2026, `reserves.*` 1995–2026. Do not use `edbpm5-eng.xlsx` (older method, 1999–2005).
- Units: stored as `usd_million`; the chart shows billion USD with the site's formatting (`unitFor` / `formatInUnit`); Excel shows million USD. No exchange-rate series anywhere (Duru's rule), and no conversion to GEL.
- % of GDP = value ÷ the served nominal GDP in USD for the same year (the series Current account uses, `loadServedGdpOverviewData`, id `nominal_usd`), × 100, one decimal. A year without GDP (1995, and 2026) has no value. Preliminary GDP years are named in the source line as on Current account.
- Under each heading, only the `LatestValueLine`. No tabs, and no note under the chart beyond one `SourceNote`. The measure switch is the icon-only `SegmentedTabs` (`$` text glyph for amounts, Lucide `ChartPie` for % of GDP), with names as tooltip and accessible name.
- Only the total is selected by default. It stays first, selectable and removable. Parts nest under it. No search box (lists of four and six rows).
- Missing = gap / dash / blank Excel cell. Gold before 2024 is a published zero and shows as `0`.
- Stable lowercase IDs: `ext_debt.total`, `ext_debt.government`, `ext_debt.banks`, `ext_debt.companies`, `ext_debt.intercompany`, `ext_debt.central_bank`, `reserves.total`, `reserves.fx`, `reserves.gold`, `reserves.sdr`.
- Canonical CSV is UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule). No MCP tools or central JSON/CSV publications, and the fact-query snapshot must not include these sources.
- Review before pushing: commit locally only until Duru approves the preview (Task 8). Times told to Duru are in Tbilisi time (UTC+4).
- The Business hub is being built in parallel on another branch. Do not touch that branch. Shared files are merged at delivery (Task 10).

## Review Focus

1. **A saved link with a year range that ends in 2026, switched to % of GDP** (`#tab=gdp&from=2015&to=2026`): the range clamps to 2015–2025, and switching back to amounts keeps 2015–2025 (`refitRange` with `collapseToAll: false`, as on Money and banks). Owner: Task 4.
2. **The 2026 point in every output:** the chart point is hollow, the table column header and the hover carry the month mark, Excel's 2026 column is labelled with its month, and the latest-value line names the month. It must never read as a full year. Owner: Tasks 4, 5 and 7.
3. **Reserves on % of GDP for 1995** (no GDP): a gap, never `0` or `Infinity`, and the % of GDP range starts in 1996. Owner: Task 4.
4. **Gold 1995–2023 is a published 0**, not missing: the table shows `0.0`, not `—`, and the line sits on the baseline. Owner: Task 4 (model) and Task 5 (workbook).
5. **Language switch and reload** keep the measure, range, selection (including an explicit empty `sel=`) and chart/table mode on both pages. Owner: Task 7 (browser).

---

### Task 1: Research package

**Files:**
- Create `docs/Raw Data/External/nbg-external-position/` containing:
  - `official/`: `edbpm6eng.xlsx`, `templatesection-ieng.xlsx` and `api-category-24.json`
  - `prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`
  - the generated `source-manifest.csv`, `source-manifest.json`, `external-position-annual.csv`, `coverage.csv`, `validation-report.json` and `independent-validation.json`

Download fresh (copies from 2026-10-15 are in `/mnt/project-files/reserves-sources/` for comparison only). The listing comes from `GET https://nbg.gov.ge/gw/api/ct/statistics/categories/24/data` with the header `Accept-Language: en`. Files are at `https://nbg.gov.ge/fm/%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A2%E1%83%98%E1%83%A1%E1%83%A2%E1%83%98%E1%83%99%E1%83%90/external_sector/eng/<file>`; retry once on a connection reset.

**Interfaces:**
- Produces `external-position-annual.csv` with the columns `year,indicator_id,value,published_value,unit,period_end,basis,value_status,source_id,source_sheet,source_cell`.
  - `value`: the exact decimal in million USD. For debt it's the `<v>` token. For reserves it's the token ÷ 1000, computed exactly with `decimal`.
  - `published_value`: `value` rounded half-up to 1 decimal, from the 15-significant-digit display value (see memory `xlsx-parsing-pitfalls`).
  - `unit`: always `usd_million`. `basis`: always `actual`. `value_status`: always `official`.
- Source IDs: `nbg_gross_external_debt_bpm6`, `nbg_official_reserve_assets`, `nbg_api_category_24`.
- The cell map. `prepare.py` finds rows by the exact label text in column A and columns by the date in the header row, never by fixed positions:

| Indicator ID | Source / sheet | Row label (column A, first match above "Memorandum Items") | Columns |
| --- | --- | --- | --- |
| `ext_debt.total` | ED-6 `ED-GEO-Tb1` (million USD, header row 3) | `Gross External Debt Position` | every 31 Dec from 2006, plus the last column (2026-06-30) |
| `ext_debt.government` | same | `General Government` | same |
| `ext_debt.central_bank` | same | `Central Bank` | same |
| `ext_debt.banks` | same | `Deposit-Taking Corporations, except the Central Bank` | same |
| `ext_debt.companies` | same | `Other Sectors` | same |
| `ext_debt.intercompany` | same | `Direct Investment: Intercompany Lending` | same |
| `reserves.total` | OIR `GIR (eng) ` (thousand USD; dates in column A from row 5) | column B "Official Reserve Assets" | every 31 Dec from 1995, plus the last dated row (2026-09-30) |
| `reserves.fx` | same | column C "Foreign Currency Reserves" | same |
| `reserves.sdr` | same | column D "SDRs" | same |
| `reserves.gold` | same | column F "Gold" (found by the header text in row 4) | same |

- [ ] **Step 1: Write `test_validation.py`** (stdlib `unittest`, modelled on the Money and banks one):
  - `test_counts`: 6 × 21 debt rows and 4 × 32 reserves rows, 254 in total.
  - `test_period_end`: every row is dated `YYYY-12-31`, except one row per indicator in 2026: `2026-06-30` for debt and `2026-09-30` for reserves.
  - `test_debt_parts_add_up`: government + central bank + banks + companies + intercompany equals total within 0.05 every year; patching `ext_debt.banks` by +1 makes `validate` raise.
  - `test_reserves_residual`: total − (fx + gold + sdr) lies in −30 to +30 (million USD) every year; patching `reserves.fx` by −100 raises.
  - `test_gold_zero_before_2024`: `reserves.gold` is `0` for 1995–2023 and above 0 from 2024.
  - `test_altered_cell_fails`: patching one value raises.
  - `test_anchor_values`: published values `ext_debt.total` 2025 `27046.9`, `ext_debt.government` 2025 `9203.2`, `reserves.total` 2025 `6159.3`, `reserves.total` 1995 `196.2`, `reserves.total` 2026 `8166.9`, `ext_debt.total` 2026 `28166.0` (check the exact decimals against the file in Step 5, and fix the test only if the file disagrees with these roundings).
  - `test_no_exchange_rates`: no indicator ID contains `exchange` or `fx_rate`.
- [ ] **Step 2: Run** `cd "docs/Raw Data/External/nbg-external-position" && python3 -m unittest test_validation -v`. Expected: FAIL (no `prepare` module).
- [ ] **Step 3: Implement `prepare.py`** using only the stdlib (`zipfile`, `xml.etree`, `decimal`, `hashlib`, `csv`, `json`). It writes:
  - the source manifest (URL, retrieval UTC, SHA-256, bytes)
  - the CSV
  - `coverage.csv` (indicator, first year, last year, count, latest period end)
  - `validation-report.json` (`status`, `primary_observation_count: 254`, `imputed_values: 0`, `calculated_values: 0`, per-source checks)
  Use the self-closing-cell-safe cell regex from memory `xlsx-parsing-pitfalls`.
- [ ] **Step 4: Implement `verify_independent.mjs`.** It re-reads both workbooks with the repo's `xlsx` package (`createRequire` from `apps/web`), recomputes all 254 values and writes `independent-validation.json` with `status: "passed"`.
- [ ] **Step 5: Run** `python3 prepare.py && python3 -m unittest test_validation -v && node verify_independent.mjs`. Expected: all PASS.
- [ ] **Step 6: Write `README.md`** covering the files, the URLs and API, the retrieval date, the cell map, the checks, the BPM6-only choice, what "Other Sectors" and "Intercompany lending" contain, the two tiny reserve parts that are left out, and the 2026 latest-point rule. Then commit `feat(data): archive reviewed NBG external debt and reserves workbooks`.

### Task 2: Canonical serving file

**Files:**
- Create:
  - `apps/web/lib/data/externalPosition/types.ts`, `validation.ts` and `prepareExternalPosition.ts`
  - `apps/web/scripts/prepare-external-position.ts`
  - `apps/web/tests/data/externalPosition/externalPosition.test.ts`
  - the generated `data/imports/external-position-annual.csv` and `data/reports/external-position-validation.json`
- Modify:
  - `apps/web/package.json`: add the scripts `data:prepare-external-position` and `data:check-external-position`
  - `apps/web/scripts/validate-all.ts`: add `"data:check-external-position"` after `"data:check-current-account"`

**Interfaces:**
- Produces (in `types.ts`):
  - `EXTERNAL_POSITION_INDICATORS` (the 10 IDs in cell-map order), `ExternalPositionIndicator`, `EXTERNAL_POSITION_SOURCES = ["nbg_gross_external_debt_bpm6", "nbg_official_reserve_assets"]` and `EXTERNAL_POSITION_PUBLIC_SOURCES` (those two plus `nbg_api_category_24`)
  - `ExternalPositionFact = { year: number; indicatorId; value: string; publishedValue: string; unit: "usd_million"; periodEnd: string; basis: "actual"; valueStatus: "official"; sourceId; sourceSheet; sourceCell; lastReviewedAt }`
  - `ClientExternalPositionFact = { year: number; indicatorId: ExternalPositionIndicator; value: number /* USD */; latestPeriod: boolean; periodEnd: string; sourceId: string }`
  - `ExternalPositionAcceptance` (the Money and banks shape), `externalPositionFactKey`, `externalPositionSourceDocumentId(id) => \`source.${id}\``
- Produces (in `validation.ts`): `expectedExternalPositionKeys(): Set<string>` and `validateExternalPositionFacts(facts): void`. The validator applies the Money and banks identity, coverage, duplicate, source-contract and rounding checks, plus the Task 1 period-end, sum, residual, gold and anchor checks.
- Produces (in `prepareExternalPosition.ts`):
  - `prepareExternalPositionData(repositoryRoot, mode: "write" | "check")`
  - `EXTERNAL_POSITION_CSV_HEADERS = ["year","indicator_id","value","published_value","unit","period_end","basis","value_status","source_id","source_sheet","source_cell","last_reviewed_at"]`
  - `REVIEWED_AT = "2026-10-15"`

- [ ] **Step 1: Write the test** (modelled on `tests/data/moneyBanks/moneyBanks.test.ts`):
  - `prepareExternalPositionData(root, "check")` resolves, and the file has 254 rows.
  - `validateExternalPositionFacts` rejects each of these:
    - an altered `publishedValue`
    - a duplicate row
    - a missing key
    - a 2005 `ext_debt.total` row
    - a second non-December row
    - a 2025 row dated `2025-09-30`
    - debt parts that don't add up
    - a reserves residual of 31 million USD
    - a `unit` other than `usd_million`
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/externalPosition/externalPosition.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** by mirroring `lib/data/moneyBanks/*`: `readVerifiedPackageFile`, cell re-reads via `fflate` + `XLSX`, the research-report gate, and `assertGeneratedArtifactMatches("external-position", …)`. There are no calculated rows, so drop `recompute`. Add the script (a copy of `prepare-money-banks.ts`) and the package scripts.
- [ ] **Step 4: Run** `npm run data:prepare-external-position && npm run data:check-external-position && npx vitest run tests/data/externalPosition/externalPosition.test.ts`. Expected: `{"status":"passed",…}` and the tests PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed external debt and reserves data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create:
  - `apps/web/lib/data/externalPosition/importExternalPosition.ts`
  - `apps/web/prisma/migrations/20261015120000_external_position/migration.sql`. If the Business migration has merged by then, keep this one's timestamp later than it.
- Modify:
  - `apps/web/prisma/schema.prisma` (new `ExternalPositionFact` model)
  - `apps/web/lib/db/mirrorRows.ts`
  - `apps/web/lib/db/servedDataDb.ts`
  - `apps/web/scripts/import-budget-facts.ts`
  - `data/sources/source-documents.csv` (three rows)
  - `docs/deployment.md` (add `ExternalPositionFact` wherever `MoneyBanksFact` appears)
- Test: extend `externalPosition.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `loadExternalPositionFacts(): Promise<ExternalPositionFact[]>`
  - `assertExternalPositionParity(csv, mirror): void`
  - `loadServedExternalPositionData(): Promise<{ facts: ExternalPositionFact[] }>`
  - `toClientExternalPositionFact(f): ClientExternalPositionFact`, where `value = Number(publishedValue) × 1_000_000` and `latestPeriod = !periodEnd.endsWith("-12-31")`
  - `loadExternalPositionFactsFromDb()`
  - `externalPositionMirrorCreateRows` and `loadExternalPositionFactsFromMirror`, named like the Money and banks ones
- The `ExternalPositionFact` model has the `MoneyBanksFact` columns plus `periodEnd String`, with `@@id([indicatorId, year])` and the same relations. The migration enables RLS and revokes public grants exactly as `20261011130000_money_banks/migration.sql` does.

- [ ] **Step 1: Add tests.**
  - Parity passes on identical arrays and on `"27046.9"` vs `"27046.90"`, and throws on a changed value, a changed `periodEnd` or a missing row.
  - The loader throws when the CSV fingerprint differs from the report.
  - `toClientExternalPositionFact` turns `reserves.total` 2026 into `8166900000` with `latestPeriod: true`, and 2025 into `latestPeriod: false`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, copying each Money and banks addition into the same file. Then run `npx prisma validate && npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/externalPosition/externalPosition.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed external debt and reserves data with exact parity`.

### Task 4: Explorer model and state

**Files:**
- Create: `apps/web/lib/explorer/externalPosition.ts` and `apps/web/tests/explorer/externalPosition.test.ts`

**Interfaces:**
- Consumes: `ClientExternalPositionFact`, and `CurrentAccountGdp` (`{ year; valueUsd; preliminary }`, from `lib/explorer/currentAccount.ts`).
- Produces:
  - `EXTERNAL_POSITION_SECTIONS`: `{ id: "foreign-debt", href: "/explorer/external/foreign-debt", labelKey: "common.foreignDebt" }` and `{ id: "reserves", href: "/explorer/external/reserves", labelKey: "common.reserves" }`, plus the type `ExternalPositionSectionId`
  - `ExternalPositionView = "amount" | "gdp"`; both sections have both views
  - `externalPositionSeries(section)`. Foreign debt: `ext_debt.total`, then children government, banks, companies, intercompany and central_bank (`parentId: "ext_debt.total"`). Reserves: `reserves.total`, then children fx, gold and sdr.
  - `externalPositionViewFacts(view, facts, gdp)`:
    - `amount` returns the facts as they are.
    - `gdp` returns `value / gdp.valueUsd × 100` for years with GDP. It drops years without GDP, which removes 1995 and 2026.
  - `externalPositionCoverage(section, view, facts, gdp)`, built on `topicCoverage`
  - `ExternalPositionState = TopicState & { view: ExternalPositionView }`, with `defaultExternalPositionState`, `parseExternalPositionHash`, `serializeExternalPositionHash` (always writes `tab`) and `changeExternalPositionView`, all mirroring the Money and banks functions. The selection keeps the same IDs across views.
  - `buildExternalPositionModel(section, facts, state, gdp)`. It returns the `buildTopicModel` result plus:
    - `unit: "usd" | "percent"`
    - `latestYears: number[]` (years in range whose value is a latest-period point; empty on `gdp`)
    - `latest: { year: number; periodEnd: string; value: number; latestPeriod: boolean }` (the reference series' last value in the view)

- [ ] **Step 1: Write the tests.**
  - Defaults: foreign debt starts on view `amount`, selection `["ext_debt.total"]`, coverage 2006–2026. Reserves starts the same way, coverage 1995–2026.
  - On % of GDP, reserves coverage is 1996–2025, and the 1995 value is absent, not 0 (Review Focus 3). The 2025 % of GDP for `ext_debt.total` uses the fixture GDP.
  - `changeExternalPositionView` from amounts with 2015–2026 to `gdp` gives 2015–2025, and back to amounts it keeps 2015–2025 (Review Focus 1).
  - The hash round-trips, including an explicit empty `sel=`. Unknown IDs are dropped. An unknown `tab` falls back to `amount`.
  - Nesting: debt has 5 children and reserves has 3.
  - Model checks:
    - `latestYears` is `[2026]` on amounts and `[]` on `gdp`.
    - `latest.periodEnd` is `2026-09-30` for reserves.
    - `reserves.gold` 2010 is `0`, not `null` (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run tests/explorer/externalPosition.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** on `topicSeries.ts` helpers (`buildTopicModel`, `parseTopicHash`, `serializeTopicHash`, `topicHashView`, `topicSeriesColor`) and `refitRange`.
- [ ] **Step 4: Run.** Expected: PASS. **Step 5: Commit** `feat: model foreign debt and reserves views and state`.

### Task 5: Excel workbook and hub cards

**Files:**
- Create: `apps/web/lib/explorer/externalPositionWorkbook.ts`
- Modify: `apps/web/lib/explorer/externalHubCards.ts` and `apps/web/lib/pages/external.tsx` (the hub loads the new facts)
- Test: extend `tests/explorer/externalPosition.test.ts`, plus the existing hub-card test if there is one (`rg -l buildExternalHubCards apps/web/tests`)

**Interfaces:**
- Produces `buildExternalPositionWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title, gdp, gdpSources, latestLabel }, presentation): WorkbookExportModel`, mirroring `moneyBanksWorkbook.ts`:
  - Amounts are in million USD with `numberFormat` `"#,##0.0"` and the unit label `external.position.unitMlnUsd`. % of GDP uses `"0.0"`.
  - The 2026 column header carries `latestLabel` (for example `2026 (სექტ.)`).
  - On `gdp`, the Sources sheet adds `gdpSources`.
  - The filename is `${section}${view === "gdp" ? "-gdp" : ""}-${start}-${end}`.
- `buildExternalHubCards(money, investment, account, position, presentation)` gains a fourth argument, `position: readonly ClientExternalPositionFact[]`. It appends:
  - `card("04", "debt", "/explorer/external/foreign-debt", …)` with the `ext_debt.total` sparkline
  - `card("05", "reserves", "/explorer/external/reserves", …)` with the `reserves.total` sparkline
  The footers for those two read `${min}–${max} (${month}) · ${annual}`, where `month` is a localized short month of the latest point.

- [ ] **Step 1: Write the tests.**
  - A Reserves workbook for 2020–2026 with all four series selected:
    - has 4 rows × 7 years;
    - shows 2025 `reserves.total` as `6159.3`;
    - has a 2026 header that contains the month label;
    - shows 2020 gold as `0`.
  - A Foreign debt `gdp` workbook has no 2026 column and cites the GDP sources.
  - The hub cards number five, and cards 04 and 05 have the footers above (English).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: export foreign debt and reserves to Excel and add hub cards`.

### Task 6: Messages

**Files:**
- Modify:
  - `apps/web/lib/i18n/messages/{ka,en}/external.json` (new `external.debt.*`, `external.reserves.*` and `external.position.*` keys)
  - `{ka,en}/common.json` (`common.foreignDebt`, `common.reserves`)
  - `data/localization/en/page-revisions.json` (the four new routes)
- Keys:
  - `external.debt.title|summary|metaTitle|heading|latest` and the same five under `external.reserves.*`
  - `external.debt.series.<id>` for the six debt IDs and `external.reserves.series.<id>` for the four reserves IDs
  - `external.position.` keys:
    - `unitMlnUsd`, `unitBnUsd`, `unitPercent`, `measure`
    - `tab.amount`, `tab.gdp`
    - `latestMonth.06` and `latestMonth.09` (short month labels such as `ივნ.` / `Jun` and `სექტ.` / `Sep`)
    - `latestMark` (the hover/table mark)
    - `sourceNote`, `methodology`, `series`, `emptySelection`, `nestedSelected`, `subcategoriesFor`
- Georgian proposals (they go into the proofread):
  - pages: `საგარეო ვალი` / `საერთაშორისო რეზერვები`
  - headings: `რამდენი ვალი აქვს საქართველოს საზღვარგარეთ` / `რამდენი სარეზერვო ვალუტა აქვს ეროვნულ ბანკს`
  - debt series: `მთლიანი საგარეო ვალი`, `მთავრობა`, `ბანკები`, `კომპანიები`, `სესხები დაკავშირებულ კომპანიებს შორის`, `ეროვნული ბანკი`
  - reserves series: `საერთაშორისო რეზერვები`, `უცხოური ვალუტა`, `ოქრო`, `სესხის სპეციალური უფლებები (SDR)`
  - measure names: `მოცულობა` / `მშპ-სთან შეფარდებით`
- English: Foreign debt / Reserves; the headings "How much Georgia owes abroad" / "How much foreign currency the National Bank holds".

- [ ] **Step 1: Add the keys, then run** `npm run i18n:check && npm run typecheck`. Expected: PASS. If the check reports uninventoried keys, add the routes to the inventory as Current account did (`git log -S"current-account" --oneline -- apps/web/lib/i18n/inventory.server.ts`).
- [ ] **Step 2: Commit** `feat: add Georgian and English foreign debt and reserves copy`.

### Task 7: Page component, routes, navigation and SEO

**Files:**
- Create:
  - `apps/web/components/external/external-position.tsx`
  - the routes `app/(ka)/explorer/external/{foreign-debt,reserves}/page.tsx` and their `app/(en)/en/explorer/external/…` mirrors
  - `apps/web/tests/browser/external-position.spec.ts`
- Modify:
  - `apps/web/lib/pages/external.tsx` (`renderExternalPositionPage(locale, section)` and `externalPositionMetadata(locale, section)`)
  - `apps/web/lib/navigation/navTree.ts` (two rows after Current account, test IDs `foreign-debt-link` and `reserves-link`; the footer source-note map gets both paths, like `/explorer/external/current-account`)
  - `lib/seo/sitemap.ts` and `tests/seo/routes.test.ts`
  - the browser page-count assertions that Current account touched (`git log -S"current-account" --oneline -- apps/web/tests/browser` lists them)

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces `ExternalPositionExplorer({ section, facts, labels, sources, gdp, gdpSources, lastReviewedAt, siteOrigin })`, laid out exactly like `MoneyBanksExplorer`, with these differences:
  - test IDs use the `position-` prefix (`position-latest`, `position-measure-amount|gdp`, `position-excel-download`, `position-unit-label`)
  - the amount icon is the text glyph `$`
  - `EditorialLineChart` series get `preliminary: years.map(y => model.latestYears.includes(y))`, `hollowPreliminary: true` and `preliminaryLabel` = the month mark
  - `ExplorerTable` gets `preliminaryYears={model.latestYears}` and `preliminaryLabel`
  - `LatestValueLine` gets `period` = `2026 (სექტ.)` when `latest.latestPeriod`, otherwise the year
  - the source line links `/methodology/external-flows` and, on `gdp`, adds the GDP source and preliminary years as Current account does

- [ ] **Step 1: Write the browser spec:**
  - The hub shows five cards.
  - `/explorer/external/reserves` defaults to one selected row. The latest line contains `8.17` and the month. The chart has one hollow point.
  - Table mode on Reserves:
    - the 2026 header shows the month mark;
    - gold 2010 reads `0.0`, not `—`.
  - `position-measure-gdp` on Foreign debt removes the 2026 column, and the latest line shows a % value for 2025.
  - Ticking banks then clearing works, and an empty selection shows the callout.
  - The Excel download fires a `.xlsx`.
  - `/en` keeps the hash on both pages (Review Focus 5).
  - At 390 px there is no horizontal scroll on either page.
- [ ] **Step 2: Implement** the component, page functions, routes, nav and sitemap, and extend `tests/seo/routes.test.ts` with the four routes.
- [ ] **Step 3: Run** `npx vitest run tests/seo/routes.test.ts tests/explorer/externalPosition.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Run** `npx playwright test tests/browser/external-position.spec.ts` against a built server (CLAUDE.md "Test loop", with `CI=1`). Expected: PASS.
- [ ] **Step 5: Commit** `feat: add bilingual foreign debt and reserves pages`.

### Task 8: Methodology, sources and preview (stop point)

**Files:**
- Modify:
  - `apps/web/lib/methodology/content/external-flows.ts` and `content/en/external-flows.ts`: two sections, Foreign debt and Reserves, per spec §7
  - `data/methodology/source-archives/external-flows.csv`: rows for the two workbooks and the API listing, with `notes` naming the pages and the 2026 point
  - `data/localization/en/documents.json` and `sources.json`, and `lib/methodology/content/en/revisions.ts`, as Current account did
  - the archive and snapshot tests that fail (`buildSnapshot.test.ts` must still show no external-position source)

- [ ] **Step 1:** Write the content. It must say:
  - what gross external debt is and what each group means;
  - the government-line difference from the Debt page (Ministry of Finance, GEL, 24.2 bn GEL abroad, against NBG's 9.2 bn USD at the end of 2025, with slightly different rules);
  - what reserves and SDRs are;
  - that the National Bank has held gold since 2024;
  - that the two parts left out are under 0.03 bn USD;
  - that the 2026 value is the latest amount on a date, not a full year.
  It states nothing NBG did not publish and no causes.
- [ ] **Step 2: Run** `npm run data:check-methodology-archives` and `npx vitest run tests/methodology tests/factQuery/buildSnapshot.test.ts`. Expected: PASS. Commit `feat: document foreign debt and reserves and archive their sources`.
- [ ] **Step 3 (stop point):** Push nothing. Build and serve as in CLAUDE.md and save screenshots to `/mnt/project-files/screenshots/foreign-debt-reserves/`:
  - ka and en at 1440: the hub, both pages on amounts and on % of GDP, one table view and the methodology section;
  - ka at 390: both pages.
  Reply with them and an `ask_decision` card with the options "Clickable preview" (push the branch only, no PR), "Screenshots only" and "Looks good, go ahead" (memory `preview-via-branch-push`). **Wait.** Apply any changes and ask again until Duru approves.

### Task 9: Scope and design documents

**Files:**
- Modify:
  - `Project_Definition.md` §2: extend the External flows item with the two pages and the latest-2026-point exception
  - `DESIGN.md` §30: add a §30.3 Foreign debt and a §30.4 Reserves next to §30.2, plus the one-line exception to annual-only in §17 if it lists that rule
  - `docs/data-methodology/external-flows-annual.md`: a "Foreign debt and reserves serving package" section (package, IDs, checks, serving and export rules)

- [ ] **Step 1:** Write them. **Step 2:** Run `npm run i18n:check` (page review dates). **Step 3:** Commit `docs: record the foreign debt and reserves pages`.

### Task 10: Full gates and delivery (only after Duru's OK in Task 8)

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`. Resolve the shared files: Business's nav, Prisma, migrations, import, validate-all and page counts. Keep both sides, and regenerate generated files with their scripts.
- [ ] **Step 2:** Run `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100` with `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`. Expected: all green.
- [ ] **Step 3:** Run `git push -u origin claude/project-thread-w3823d`. Open a draft PR with the attribution block, assign DuruMakh and request their review, then subscribe to PR activity and drive CI to green.
- [ ] **Step 4:** Reply with the PR link. Merging releases to production (migration, import and deploy), so it waits for Duru.
