# Money and Banks Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual Money and banks hub (`/explorer/money`, `/supply`, `/loans-deposits`, `/interest-rates`, `/bank-health`, `/methodology/money`) serving about 730 reviewed National Bank of Georgia values.

**Architecture:** Follows the Poverty hub file by file (merged in PR #174, merge commit `b733c26`; `git diff b733c26^1 b733c26 -- <file>` shows exactly what Poverty added to any shared file). That means an immutable research package under `docs/Raw Data/Money/`, a TypeScript prepare/check step that writes the canonical CSV, a loader with CSV/DB parity, a private Prisma mirror table, and one client explorer component for all four pages built on the shared explorer shell.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, Python 3 stdlib (research package), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-11-money-banks-design.md` (copy of the approved `/mnt/project-files/specs/2026-10-11-money-banks-design.md`, committed in Task 1).

**Branch:** `claude/project-thread-2lywh9`, created from the latest `origin/main`.

## Global Constraints

- Yearly values only: December (year-end) values for amounts, ratios and bank health; NBG annual averages for loan and deposit rates; the rate in force on 31 December for the National Bank rate. Last year 2025.
- No exchange-rate series anywhere (Duru's decision). Foreign-currency amounts are NBG's lari values.
- Under each page heading, only the one-line `LatestValueLine`. No summary block, and no notes under the chart beyond one `SourceNote` line.
- Tabs are centred `TextTab`s. Supply: **Amount | Compared with GDP**. Loans and deposits: **Loans | Deposits | Share in foreign currency**. Bank health: **Bad loans | Profits | Capital**. Interest rates has no tabs.
- Only the first series of a tab is selected by default; it stays first, selectable and removable. Selection is unlimited; search never scopes the bulk action or the count.
- Each tab has one unit. Amounts are stored as million GEL and shown with the site's GEL formatting (`formatAmount`, `unitFor` with `unitsFor(locale)`). Percents show one decimal, except `rates.policy`, which shows two.
- Missing = gap / dash / blank Excel cell, never zero.
- Only these derived values exist: the three deposit totals (lari + foreign currency) and the two foreign-currency shares, all with `value_status = calculated`. Nothing else is interpolated, rebased or computed. No change is computed across the 2022 bank-health break.
- Stable lowercase ASCII IDs only (spec §8). Labels are display data.
- Canonical CSV is UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule).
- No MCP tools or central JSON/CSV publications. The fact-query snapshot must not include money sources.
- Review before pushing: commit locally only. A live preview goes to Duru (Task 9). Only after Duru's OK do the full gates, push and the draft PR run (Task 11).
- Times told to Duru are in Tbilisi time (UTC+4).

## Review Focus

1. **A saved link from another tab** (`#tab=capital&sel=banks.roe`): unknown or off-tab IDs are dropped, and an explicit empty `sel=` keeps an empty selection, as on Poverty. Owner: Task 4.
2. **A saved range that starts before a tab's coverage** (2005–2025 on Capital, which starts in 2014): the range clamps to 2014–2025, and switching back to Bad loans keeps 2014–2025. Owner: Task 4.
3. **Negative values** (return on assets and equity in 2008): the chart's axis goes below zero, and the table and Excel show `−2.5`. Owner: Task 4 (model) and Task 7 (browser).
4. **Gaps inside a tab:** companies' deposits before 2015 and the National Bank rate before 2008 are gaps, not zeros, in chart, table and Excel. Owner: Task 5 (workbook) and Task 7.
5. **Language switch** keeps tab, range, selection and chart/table mode on every page. Owner: Task 7 (browser).

---

### Task 1: Research package

**Files:**
- Create: `docs/superpowers/specs/2026-10-11-money-banks-design.md` (copy of the approved spec)
- Create: `docs/Raw Data/Money/nbg-money-banks-annual/` with `official/` (the 11 xlsx below, the 11 NBG API category listings as `api-category-<id>.json`, and the methodology PDFs for monetary statistics, loans, deposits and financial markets), `prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`, and the generated `source-manifest.csv`, `source-manifest.json`, `money-banks-annual.csv`, `money-banks-series-breaks.csv`, `coverage.csv`, `validation-report.json`, `independent-validation.json`

Download every file fresh. File URLs are `https://nbg.gov.ge/fm/%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A2%E1%83%98%E1%83%A1%E1%83%A2%E1%83%98%E1%83%99%E1%83%90/<path>`. Paths come from `GET https://nbg.gov.ge/gw/api/ct/statistics/categories/{15,16,17,19,27}/data` with header `Accept-Language: en` (without it the API returns `[]`).

**Interfaces:**
- Produces: `money-banks-annual.csv` with columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`. `value` is the exact `<v>` token (for calculated rows, the exact decimal sum or ratio computed with `decimal`). `published_value` is `value` rounded half-up to 1 decimal, or 2 for `rates.policy`. For calculated rows, `source_cell` joins the input cells with `+` (sums) or `/` (shares).
- Produces: `money-banks-series-breaks.csv` with demography's header `break_id,applies_to,reference_date,reason,source_note` and one row: `fsi_method_2022`, `banks.npl_ratio;banks.roe`, `2022-12-31`, the reason in spec §7.
- Source IDs: `nbg_money_aggregates` (M2.1), `nbg_loans_l3_5`, `nbg_deposits_d3_17`, `nbg_deposits_individuals_d3_23`, `nbg_deposits_legal_d3_27`, `nbg_policy_rate`, `nbg_loan_rates_lwir`, `nbg_deposit_rates_dwir`, `nbg_fsi_archive`, `nbg_fsi`, plus `nbg_statistics_page` and one ID per methodology PDF.
- The cell map. `prepare.py` finds columns by header label text and rows by the date or year in column A, never by fixed positions:

| Indicator ID | Unit | Source / sheet / column header | Years |
| --- | --- | --- | --- |
| `money.m3`, `money.m2`, `money.m1`, `money.m0` | gel_million | M2.1 `Monetary Ratios-eng`: "Money Aggregates (M3)", "(M2)", "(M1)", "Money Outside Banks (M0)", December rows | 1995–2025 |
| `money.m3_to_gdp`, `money.m2_to_gdp` | percent | M2.1: "Monetization Coefficient (M3)" / "(M2)" (the headers **without** `*`), December rows | 1996–2025 |
| `loans.total`, `loans.gel`, `loans.fx` | gel_million | L3.5 `Eng`: the "Total" column under "Total Loans (including overdue Loans)", "… in national currency" and "… in foreign currency" | 2002–2025 |
| `deposits.gel`, `deposits.fx` | gel_million | D3.17 `NC Dep.volume&Int.rates-eng` / `FC Dep.volume&Int.rates-eng`: "Deposits, Total" | 1996–2025 |
| `deposits.total` (calculated) | gel_million | `deposits.gel + deposits.fx` | 1996–2025 |
| `deposits.individuals` (calculated) | gel_million | D3.23 `NC Dep.of Individuals-eng` + `FC Dep.of Individuals-eng`: "Deposits, total" | 2002–2025 |
| `deposits.legal_entities` (calculated) | gel_million | D3.27 `NC` + `FC`: "Total Deposits" | 2015–2025 |
| `loans.fx_share`, `deposits.fx_share` (calculated) | percent | `loans.fx / loans.total × 100`; `deposits.fx / deposits.total × 100` | 2002–2025; 1996–2025 |
| `rates.policy` | percent | MPR `MPIR-Eng`: the last row whose "Date of Enforcement" is on or before 31 December | 2008–2025 |
| `rates.loans_total`, `rates.loans_gel`, `rates.loans_fx` | percent | LWIR `loans % Annual`: the first ("total") column under Total, National currency and Foreign currency | 1996–2025 |
| `rates.deposits_total`, `rates.deposits_gel`, `rates.deposits_fx` | percent | DWIR `Dep %-Annual`: same three columns | 1996–2025 |
| `banks.npl_ratio` | percent | FSI archive `FSI_Deposit_Takers_eng` "Nonperforming loans (by IMF's methodology) to total gross loans", `YYYYQ4` columns (2003–2021); FSI `FSD` "Nonperforming loans to total gross loans", December columns (2022–2025) | 2003–2025 |
| `banks.roa`, `banks.roe` | percent | archive "Return on Assets" / "Return on Equity" (2001–2021); FSI "Return on assets" / "Return on equity" (2022–2025) | 2001–2025 |
| `banks.capital_ratio`, `banks.tier1_ratio` | percent | archive: the two rows under "Capital Adequacy (Basel III)" (2014–2021); FSI "Regulatory capital to risk-weighted assets" / "Tier 1 capital to risk-weighted assets" (2022–2025) | 2014–2025 |

- [ ] **Step 1: Write `test_validation.py`.** Model it on the Poverty one, stdlib `unittest` only. Tests:
  - `test_counts`: per-indicator counts match the year ranges above, and the total equals their sum (730).
  - `test_altered_cell_fails`: patching one value makes `prepare.validate` raise.
  - `test_currency_parts_add_up`: `loans.gel + loans.fx` equals `loans.total` within 0.01 every year; patching `loans.gel` by +1 raises.
  - `test_people_plus_companies`: individuals + legal entities equals `deposits.total` within 0.01 for 2015–2025.
  - `test_money_order`: M0 ≤ M1 ≤ M2 ≤ M3 every year.
  - `test_ranges`: every percent lies in 0–100, except `banks.roa` and `banks.roe`; `banks.roa` 2008 is negative.
  - `test_fsi_overlap`: archive 2022Q4 and current December 2022 agree to one decimal for `banks.capital_ratio`, `banks.tier1_ratio` and `banks.roa`, and differ for `banks.npl_ratio` (1.7 / 1.5) and `banks.roe` (30.2 / 24.8). The break file has exactly the `fsi_method_2022` row.
  - `test_anchor_values`: published values `money.m3` 2025 `57680.2`, `loans.total` 2025 `72453.0`, `rates.policy` 2025 `8.00`, `banks.npl_ratio` 2025 `2.5`, `deposits.fx_share` 2025 `48.6`, `loans.fx_share` 2025 `41.9`.
  - `test_no_exchange_rates`: no indicator ID contains `exchange` or `fx_rate`, and no exchange-rate workbook is in `official/`.
- [ ] **Step 2: Run** `cd "docs/Raw Data/Money/nbg-money-banks-annual" && python3 -m unittest test_validation -v`. Expected: FAIL (no `prepare` module).
- [ ] **Step 3: Implement `prepare.py`** (stdlib: `zipfile`, `xml.etree`, `decimal`, `hashlib`, `csv`, `json`). It writes the manifest (URL, retrieval UTC, SHA-256, bytes), the two CSVs, `coverage.csv` (indicator, first year, last year, count) and `validation-report.json` (`status`, counts, `imputed_values: 0`, `calculated_values: 119`, per-source checks). `validate(rows)` enforces every check from Step 1 on exact `value`.
- [ ] **Step 4: Implement `verify_independent.mjs`.** It re-reads each xlsx with the repo's `xlsx` package (`createRequire` from `apps/web`), recomputes all 730 values including the calculated ones, and writes `independent-validation.json` with `status: "passed"`.
- [ ] **Step 5: Run** `python3 prepare.py && python3 -m unittest test_validation -v && node verify_independent.mjs`. Expected: all PASS, and `validation-report.json` reads `"status": "passed"` with `primary_observation_count: 730`.
- [ ] **Step 6: Write `README.md`.** Cover the files, URLs and API, the retrieval date, the cell map, the checks, the 2008 policy-instrument note from the MPR footnote, the 2022 FSI break, the monetization `*` footnote ("Average from the beginning of the year", the reason the un-starred columns are used), and NBG's narrower deposit dollarization ratio. Then commit `feat(data): archive reviewed NBG money and banking workbooks`.

### Task 2: Canonical serving file

**Files:**
- Create: `apps/web/lib/data/moneyBanks/types.ts`, `validation.ts`, `prepareMoneyBanks.ts`, `apps/web/scripts/prepare-money-banks.ts`, `apps/web/tests/data/moneyBanks/moneyBanks.test.ts`, generated `data/imports/money-banks-annual.csv`, `data/imports/money-banks-series-breaks.csv`, `data/reports/money-banks-validation.json`
- Modify: `apps/web/package.json` (scripts `data:prepare-money`, `data:check-money`; append `&& npm run data:check-money` to `data:validate`, as Poverty did)

**Interfaces:**
- Produces (in `types.ts`):
  - `MONEY_BANKS_INDICATORS` (the 28 IDs in the cell-map order), `MoneyBanksIndicator`, `MONEY_BANKS_SOURCES` (the 10 workbook IDs), `MONEY_BANKS_PUBLIC_SOURCES` (all)
  - `MoneyBanksFact = { year; indicatorId; value: string; publishedValue: string; unit: "gel_million" | "percent"; basis: "actual"; valueStatus: "official" | "calculated"; sourceId; sourceSheet; sourceCell; lastReviewedAt }`
  - `ClientMoneyBanksFact = Pick<MoneyBanksFact, "year" | "indicatorId" | "sourceId" | "valueStatus"> & { value: number; unit: "gel" | "percent"; decimals: number }`
  - `MoneyBanksAcceptance` (the Poverty shape), `moneyBanksFactKey(f) => \`${indicatorId}:${year}\``, `moneyBanksSourceDocumentId(id) => \`source.${id}\``
  - `MONEY_BANKS_SERIES_BREAKS` type for the break row, matching demography's break columns
- Produces (in `validation.ts`): `expectedMoneyBanksKeys(): Set<string>` from the cell map's years, `moneyBanksDisplayDecimals(indicatorId): 1 | 2`, and `validateMoneyBanksFacts(facts): void`. The latter applies Poverty's identity, coverage, duplicate, source-contract and published-rounding checks plus the Task 1 sum, order, range and anchor checks.
- Produces (in `prepareMoneyBanks.ts`): `prepareMoneyBanksData(repositoryRoot, mode: "write" | "check")`, `MONEY_BANKS_CSV_HEADERS = ["year","indicator_id","value","published_value","unit","basis","value_status","source_id","source_sheet","source_cell","last_reviewed_at"]`, `REVIEWED_AT = "2026-10-11"`.

- [ ] **Step 1: Write `tests/data/moneyBanks/moneyBanks.test.ts`.** Model it on `tests/data/poverty/poverty.test.ts`:
  - `prepareMoneyBanksData(root, "check")` resolves, and the canonical file has 730 rows.
  - `validateMoneyBanksFacts` rejects each of: an altered `publishedValue`, a duplicate, a missing key, a 2007 `rates.policy` row, a 2014 `deposits.legal_entities` row, `loans.gel + loans.fx ≠ loans.total`, `money.m1 > money.m2`, `deposits.fx_share` 101, a `calculated` status on `money.m3`, and an `official` status on `deposits.total`.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/moneyBanks/moneyBanks.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `types.ts`, `validation.ts` and `prepareMoneyBanks.ts`** by mirroring `lib/data/poverty/*`: verified package reads via `readVerifiedPackageFile`, cell re-reads via `fflate` + `XLSX`, the research report gate, and `assertGeneratedArtifactMatches("money-banks", …)` for both CSVs and the report. Add the script (a copy of `prepare-poverty.ts`) and the package scripts.
- [ ] **Step 4: Run** `npm run data:prepare-money && npm run data:check-money && npx vitest run tests/data/moneyBanks/moneyBanks.test.ts`. Expected: `{"status":"passed","scope":"money_banks_annual"}` and tests PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed annual money and banking data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create: `apps/web/lib/data/moneyBanks/importMoneyBanks.ts`, `apps/web/prisma/migrations/20261011090000_money_banks/migration.sql`
- Modify: `apps/web/prisma/schema.prisma` (`MoneyBanksFact`), `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `data/sources/source-documents.csv` (one row per public source, as Poverty added its 7)
- Test: extend `apps/web/tests/data/moneyBanks/moneyBanks.test.ts`

**Interfaces:**
- Consumes: Task 2 types and validation.
- Produces: `loadMoneyBanksFacts(): Promise<MoneyBanksFact[]>`, `assertMoneyBanksParity(csv, mirror): void`, `loadServedMoneyBanksData(): Promise<{ facts: MoneyBanksFact[] }>`, `toClientMoneyBanksFact(f): ClientMoneyBanksFact` (gel_million → `value = Number(publishedValue) × 1_000_000`, `unit: "gel"`; percent → `Number(publishedValue)`, `unit: "percent"`; `decimals` from `moneyBanksDisplayDecimals`), `loadMoneyBanksFactsFromDb()` in `servedDataDb.ts`, and the mirror-row mapper and import comparison named like the Poverty ones.
- `MoneyBanksFact` model: Poverty's columns minus `groupId` and `sourceNumberFormat`, with `valueStatus` a plain string, `@@id([indicatorId, year])`, and the same relations. The migration enables RLS and revokes public grants exactly as `20261010180000_poverty/migration.sql` does.

- [ ] **Step 1: Add the parity tests.**
  - `assertMoneyBanksParity` passes on identical arrays and on `"8.00"` vs `"8"`, and throws on a changed value or a missing row.
  - `loadMoneyBanksFacts` throws when the CSV fingerprint differs from the report (temp copy, as Poverty's test does).
  - `toClientMoneyBanksFact` gives `57680200000` and unit `gel` for `money.m3` 2025, `8` with `decimals` 2 for `rates.policy` 2025, and `decimals` 1 for `banks.roe`.
- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement `importMoneyBanks.ts`, the schema and migration, and the mirror/import additions**, copying each Poverty addition in the same file. Run `npx prisma validate && npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/moneyBanks/moneyBanks.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed money and banking data with exact parity`.

### Task 4: Explorer model and state

**Files:**
- Create: `apps/web/lib/explorer/moneyBanks.ts`, `apps/web/tests/explorer/moneyBanks.test.ts`

**Interfaces:**
- Consumes: `ClientMoneyBanksFact`.
- Produces:
  - `MONEY_BANKS_SECTIONS` with ids `supply`, `loans-deposits`, `interest-rates`, `bank-health`, hrefs `/explorer/money/<id>` and label keys `common.moneySupply`, `common.moneyLoansDeposits`, `common.moneyInterestRates`, `common.moneyBankHealth`; `MoneyBanksSectionId`
  - `MoneyBanksView = "amount" | "gdp" | "loans" | "deposits" | "fx_share" | "main" | "npl" | "profits" | "capital"` and `moneyBanksViews(section)`: supply → `["amount","gdp"]`, loans-deposits → `["loans","deposits","fx_share"]`, interest-rates → `["main"]`, bank-health → `["npl","profits","capital"]`
  - `MoneyBanksSeriesDefinition = { id: MoneyBanksIndicator; reference: boolean; parentId?: MoneyBanksIndicator }` and `moneyBanksViewSeries(section, view)`, in this order (reference first):
    - amount: m3, m2, m1, m0 · gdp: m3_to_gdp, m2_to_gdp
    - loans: loans.total, with gel and fx as children · deposits: deposits.total with gel and fx as children, then individuals and legal_entities top-level · fx_share: loans.fx_share, deposits.fx_share
    - main: rates.policy; rates.loans_total with loans_gel and loans_fx as children; rates.deposits_total with deposits_gel and deposits_fx as children
    - npl: banks.npl_ratio · profits: banks.roe, banks.roa · capital: banks.capital_ratio, banks.tier1_ratio
  - `moneyBanksCoverage(section, view, facts) => { min, max, years }`: union of the tab's series years
  - `MoneyBanksState = { mode: "line" | "table"; range: PeriodRange; view: MoneyBanksView; selectedIds: string[] }`, with `defaultMoneyBanksState`, `parseMoneyBanksHash`, `serializeMoneyBanksHash` (tab key `tab`, written only when the section has more than one view) and `changeMoneyBanksView`, all mirroring Poverty
  - `buildMoneyBanksModel(section, facts, state)`, which returns Poverty's model shape plus `unit: "gel" | "percent"` for the active tab, with per-series `decimals`
  - `moneyBanksSeriesColor` uses `INK` for the reference and `colorForItem(id, index)` otherwise

- [ ] **Step 1: Write the tests.**
  - Default supply state: view `amount`, selection `["money.m3"]`, coverage 1995–2025. Interest rates: `["rates.policy"]`, coverage 1996–2025. Bank health: `["banks.npl_ratio"]`, coverage 2003–2025.
  - Capital coverage is 2014–2025, and fx_share coverage is 1996–2025.
  - `changeMoneyBanksView` from npl with range 2005–2025 to capital gives 2014–2025 and selects only `banks.capital_ratio`. Changing back to npl keeps 2014–2025 (Review Focus 2).
  - Hash round-trip, including an explicit empty `sel=`, and `#tab=capital&sel=banks.roe` → selection `[]` (Review Focus 1). An unknown `tab` falls back to the section's first view, and the interest-rates hash never writes `tab`.
  - Nesting: loans has two children; deposits has two children and two more top-level rows; main has four children under two parents.
  - `buildMoneyBanksModel`: `money.m3` 2025 equals `57680200000` with unit `gel`; `banks.roa` 2008 is negative (Review Focus 3); `deposits.legal_entities` 2014 is `null` (Review Focus 4); `rates.policy` has decimals 2.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/moneyBanks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `moneyBanks.ts`.** Reuse `resolveRange`, `refitRange(…, { collapseToAll: true })`, `parseYearRangeKeys` and `writeYearRangeKeys`.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat: model money and banking tabs, nesting and state`.

### Task 5: Excel workbook and hub cards

**Files:**
- Create: `apps/web/lib/explorer/moneyBanksWorkbook.ts`, `apps/web/lib/explorer/moneyBanksHubCards.ts`
- Test: extend `apps/web/tests/explorer/moneyBanks.test.ts`

**Interfaces:**
- Produces:
  - `buildMoneyBanksWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title? }, presentation): WorkbookExportModel`, mirroring `povertyWorkbook.ts`. Filename `money-${section}${view === "main" ? "" : `-${view}`}-${start}-${end}`. Amount tabs export **million GEL** with `numberFormat` `"#,##0.0"` and unit label `moneyBanks.unitMlnGel`. Percent tabs use `"0.0"`, or `"0.00"` for `rates.policy`, with `moneyBanks.unitPercent`. Status is `moneyBanks.status.official` or `moneyBanks.status.calculated` per row.
  - `buildMoneyBanksHubCards(facts, presentation): HubCardModel[]`: four cards with sparklines of `money.m3`, `loans.total`, `rates.policy` and `banks.npl_ratio`. The footers read `"2025 · 57.7 bn GEL · 1995–2025"` (localized via `formatAmount`), `"2025 · 72.5 bn GEL · 2002–2025"`, `"2025 · 8.00% · 2008–2025"` and `"2025 · 2.5% · 2003–2025"`.

- [ ] **Step 1: Write the tests.**
  - A Deposits workbook for 2010–2025 with all five series selected has 5 rows × 16 years; `deposits.legal_entities` 2010–2014 cells are blank (Review Focus 4); amounts are in million GEL (2025 `deposits.total` = `68496.9`); calculated rows carry the calculated status; and the source list is D3.17, D3.23 and D3.27 only.
  - An interest-rates workbook uses `"0.00"` for the policy row and `"0.0"` for the others.
  - A Profits workbook shows 2008 `banks.roa` as a negative number.
  - The hub cards have the four footers above (English presentation).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: export money and banking data to Excel and build hub cards`.

### Task 6: Messages and i18n wiring

**Files:**
- Create: `apps/web/lib/i18n/messages/ka/moneyBanks.json`, `apps/web/lib/i18n/messages/en/moneyBanks.json`
- Modify: `lib/i18n/messages/{ka,en}/common.json` (`moneyBanks`, `dataMoneyBanks`, `moneySupply`, `moneyLoansDeposits`, `moneyInterestRates`, `moneyBankHealth`), `lib/i18n/types.ts`, `lib/i18n/messages.server.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json` (the new routes)

Keys in `moneyBanks.json` mirror `poverty.json`: `title`, `hubSummary`, `metaTitle`, `metaDescription`, `page.<section>.title|summary` for the four sections, `tabs`, `tab.<view>` for the eight tabbed views, `series.<indicatorId>` for all 28 IDs, `unitMlnGel`, `unitPercent`, `latest.<section>`, `sourceNote`, `methodology`, `search`, `series`, `amountHeader`, `status.official`, `status.calculated`, `emptySelection`, `nestedSelected`, `subcategoriesFor`, `annual`.

The Georgian proposals are as follows; final wording follows the catalogue conventions:
- hub: ფული და ბანკები
- pages: ფულის მასა, სესხები და დეპოზიტები, საპროცენტო განაკვეთები, ბანკების მდგრადობა
- tabs: მოცულობა | მშპ-სთან შეფარდებით · სესხები | დეპოზიტები | წილი უცხოურ ვალუტაში · უიმედო სესხები | მომგებიანობა | კაპიტალი
- series: ფართო ფული (M3), ფართო ფული ლარში (M2), ვიწრო ფული (M1), ნაღდი ფული ბანკებს გარეთ (M0); ყველა სესხი / დეპოზიტი, ლარში, უცხოურ ვალუტაში; ფიზიკური პირების დეპოზიტები, იურიდიული პირების დეპოზიტები; ეროვნული ბანკის განაკვეთი (მონეტარული პოლიტიკის განაკვეთი); უიმედო სესხების წილი; აქტივებზე / კაპიტალზე უკუგება; კაპიტალის ადეკვატურობა, პირველადი კაპიტალის ადეკვატურობა
- latest lines (English): "2025: broad money (M3) 57.7 bn GEL", "2025: bank loans 72.5 bn GEL", "2025: National Bank rate 8.00%", "2025: bad loans 2.5% of all loans"

- [ ] **Step 1: Add the files, then run** `npm run i18n:check`. Expected: FAIL (new namespace not inventoried).
- [ ] **Step 2: Wire the namespace** as Poverty did. **Step 3: Run** `npm run i18n:check && npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: add Georgian and English money and banking copy`.

### Task 7: Pages, component, navigation and SEO

**Files:**
- Create: `apps/web/components/money-banks/money-banks-explorer.tsx`, `apps/web/lib/pages/moneyBanks.tsx`, routes `app/(ka)/explorer/money/{page,supply/page,loans-deposits/page,interest-rates/page,bank-health/page}.tsx` and the `app/(en)/en/explorer/money/…` mirrors, `apps/web/tests/browser/money-banks.spec.ts`
- Modify: `components/shell/data-sidebar.tsx` (after Inflation; `moneyBanksActive` joins the `budgetActive` exclusions and the section-label chain), `components/shell/explorer-footer.tsx` (an NBG source note key, as External flows uses), `lib/seo/sitemap.ts`, `tests/seo/routes.test.ts`, and the browser page-count assertions Poverty touched (`git diff b733c26^1 b733c26 -- apps/web/tests/browser` lists them)

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:
  - `MoneyBanksExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin })`, which mirrors `PovertyExplorer`. Amount tabs format the axis, table and tooltip with `unitFor(values, unitsFor(locale).bn)` / `formatInUnit`; percent tabs use the per-series `decimals`.
  - A centred `TextTab` row (`data-testid="money-tab-${view}"`) on every section except `interest-rates`
  - `LatestValueLine testId="money-latest"` per section, from the reference series' 2025 value
  - `renderMoneyBanksHub`, `moneyBanksHubMetadata`, `renderMoneyBanksPage(locale, section)`, `moneyBanksPageMetadata`

- [ ] **Step 1: Write `tests/browser/money-banks.spec.ts`.**
  - The hub shows four cards.
  - `/explorer/money/supply` defaults to tab `amount` with one selected row, and the latest line contains `57.7`.
  - On `/explorer/money/loans-deposits`, clicking `money-tab-deposits` then ticking companies, in table mode, shows `—` for 2014.
  - `/explorer/money/interest-rates` has no tab row, and its latest line contains `8.00`.
  - On `/explorer/money/bank-health`, clicking `money-tab-capital` leaves a range slider starting at 2014. On `profits`, table mode shows `−` in the 2008 return on assets cell (Review Focus 3).
  - Searching `ლარ` on the Loans tab reveals the nested lari row while the count stays `1 / 1`.
  - The Excel download fires a `.xlsx`.
  - Switching to `/en` keeps the hash on supply and bank health (Review Focus 5).
  - At 390 px there is no horizontal scroll on any of the four pages.
- [ ] **Step 2: Implement** the component, pages, routes, sidebar, footer and sitemap. Extend `tests/seo/routes.test.ts` with the 10 new routes.
- [ ] **Step 3: Run** `npx vitest run tests/seo/routes.test.ts tests/explorer/moneyBanks.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Run** `npx playwright test tests/browser/money-banks.spec.ts` against `next dev`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add bilingual money and banks explorer`.

### Task 8: Methodology page and source archive

**Files:**
- Create: `apps/web/lib/methodology/content/moneyBanks.ts`, `apps/web/lib/methodology/content/en/moneyBanks.ts`, `data/methodology/source-archives/money.csv`
- Modify: everything Poverty's Task 8 modified, with `"money"` in place of `"poverty"`. That covers `lib/methodology/types.ts` (`LIVE_METHODOLOGY_IDS`), `catalog.ts`, `sourceInventory.ts`, `content/en/revisions.ts`, `lib/pages/methodology-article.tsx`, `data/localization/en/documents.json`, `data/methodology/decision-register.csv` and `lib/factQuery/buildSnapshot.ts` (keep money sources out), plus the tests `tests/methodology/catalog.test.ts`, `tests/methodology/prepareArchives.test.ts`, `tests/i18n/methodologyCoverage.test.ts`, `tests/factQuery/buildSnapshot.test.ts`, `tests/browser/methodology.spec.ts` and `tests/browser/bilingual-methodology.spec.ts`.

The content covers spec §9 in plain words: NBG's M0–M3 definitions (from the M2.1 Notes sheet), end of year and annual average, coverage (resident commercial banks), lari conversion at the end-of-month official rate, the foreign-currency share calculation and NBG's narrower ratio (47.7% against 48.6% in 2025), the 2008 policy-instrument change, each bank-health measure, the 2022 method change with the two overlap values, and no causes. It does not say anything NBG did not publish.

- [ ] **Step 1: Update the catalogue, archive and snapshot tests** to expect `money`. **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, then run `npm run data:check-methodology-archives` and the methodology tests. Expected: PASS, and `buildSnapshot.test.ts` passes with no money source in the snapshot.
- [ ] **Step 4: Commit** `feat: publish money and banking methodology and original sources`.

### Task 9: Live preview for Duru (stop point)

- [ ] **Step 1:** Push nothing. Run `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100`. Capture screenshots into `/mnt/project-files/screenshots/money-banks/`: ka and en at 1440 for the hub, each tab of each page, one table view and the methodology page, and ka at 390 for the four pages.
- [ ] **Step 2:** Duru prefers a live link they can click through. A Vercel preview needs a pushed branch, and pushing needs Duru's OK, so ask on a decision card: "Push the branch for a clickable preview link (no PR, no CI run, nothing goes live)", or "Screenshots only". Attach the screenshots in the same reply. **Wait.** Apply any requested changes, refresh the preview or screenshots, and ask again until Duru approves.

### Task 10: Scope and design documents

**Files:**
- Create: `docs/data-methodology/money-banks-annual.md` (package, IDs, checks, serving and export rules), `docs/superpowers/plans/2026-10-11-money-banks.md` (this plan)
- Modify: `Project_Definition.md` §2 (a new approved Money and banks item, worded like the Poverty one and stating that exchange rates are excluded), `DESIGN.md` (the hub and four pages, next to Poverty's entry), `docs/deployment.md` (add `MoneyBanksFact` wherever Poverty added `PovertyFact`)

- [ ] **Step 1:** Write the documents. **Step 2:** Run `npm run i18n:check` (page review dates). **Step 3:** Commit `docs: record the money and banks hub`.

### Task 11: Full gates and delivery (only after Duru's OK in Task 9)

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`, resolving any shared-file conflicts by keeping both sides.
- [ ] **Step 2:** Run `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100` with `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`. Expected: all green.
- [ ] **Step 3:** `git push -u origin claude/project-thread-2lywh9`. Open a draft PR with the attribution block, then assign DuruMakh and request their review. Subscribe to PR activity and drive CI to green.
- [ ] **Step 4:** Reply with the PR link. Merging releases to production (CI, then the live database migration and import, then the deploy), so it waits for Duru.
