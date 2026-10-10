# Current Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bilingual Current account page to the External flows hub showing Georgia's yearly current-account balance and its four parts (goods, services, primary income, secondary income), as money in, money out and net, in USD or % of GDP, 2000–2025.

**Architecture:** Promote the 390 current-account rows of the frozen research package (`bop-annual.csv`) into a small reviewed serving package, following the Money from abroad preparer, loader, mirror, state, model, workbook and page files one for one. The Balance tab draws the four net parts with the existing `StackedColumnChart` and the balance as its overlay line; the Money in and Money out tabs reuse the line chart and series selector. % of GDP divides by the served `nominal_usd` GDP series.

**Tech Stack:** The existing stack (Next.js 16, React 19, strict TypeScript, Tailwind v4, Prisma 7/Postgres, decimal.js, csv-parse, ExcelJS, Vitest, Playwright). No new dependency.

**Spec:** [Current account design](../specs/2026-10-10-current-account-design.md), approved by Duru on 2026-10-10.

**Status:** Branch `claude/project-thread-w2pthf`. Pushing, a pull request, live migration/import and deployment wait for Duru's approval of screenshots.

## Global Constraints

- Page `/explorer/external/current-account`, mirrored under `/en`. Name **Current account** / `მიმდინარე ანგარიში`. Hub card 03 becomes live; sidebar entry after Foreign investment (or after Money from abroad if Foreign investment has not merged).
- Under the heading exactly one line: "Georgia's annual balance with the rest of the world, in nominal US dollars." No headline block, ranking or notes under the chart; one source line only: "Source: National Bank of Georgia · nominal USD · {years} · {date} · Methodology and sources", plus the preliminary-GDP clause when % of GDP is on and a preliminary year is in range.
- Tabs `balance | in | out` (labels Balance / Money in / Money out), centred `TextTab`s. Initial state: `balance`, chart, `usd`, all years.
- Series ids, in this order: `ca.balance`, `ca.goods`, `ca.services`, `ca.primary_income`, `ca.secondary_income`. Research `item_id` map: `current_account`, `goods`, `services`, `primary_income`, `secondary_income`. Flows `credit | debit | net`; `in` reads credit, `out` reads debit, `balance` reads net.
- Years 2000–2025 derived from loaded facts. Annual only; no 2026, quarters, services split, capital or financial account.
- Negative values are kept and drawn below zero; nothing becomes zero.
- Frozen research files stay unchanged. No live database write, MCP tool or bulk publication. The methodology route must not bundle data files (PR #170 rule).
- Reuse first; new files mirror the named Money from abroad file. Shared files the Foreign investment thread also edits (`externalHubCards.ts`, `data-sidebar.tsx`, `external.json`, methodology content, `schema.prisma`, `mirrorRows.ts`, `import-budget-facts.ts`, `package.json` `data:validate`, sitemap) get additive edits only, so merges stay mechanical.

## Review Focus

1. % of GDP for a year whose GDP is missing shows a gap/dash, not zero or infinity; 2025 is named as preliminary GDP (Task 3).
2. In each year the stacked net parts sum to the `ca.balance` line within the research tolerance, in USD and in % of GDP (Tasks 1, 3).
3. A saved hash with an unknown tab, unit or series id falls back to defaults without throwing; the Balance tab ignores `sel` (Task 3).
4. Switching tabs keeps range and unit; Money in and Money out share one selection; an empty selection shows the existing empty callout (Tasks 3, 5).
5. The Excel file matches the visible tab, unit, years and series, with negative numbers formatted with a minus sign (Task 4).

---

## Execution entry

- [ ] Confirm branch and clean tree. Compare mtimes of `node_modules/.package-lock.json` and `package-lock.json`; run `npm ci` in `apps/web` if stale. Fetch `origin/main`; if the Foreign investment PR has merged, merge `main` first.
- [ ] Read the spec, `DESIGN.md`, `CLAUDE.md`, `docs/data-methodology/external-flows-annual.md` and the Money from abroad files named below.

## Task 1: Reviewed serving package

**Files:**
- Create: `apps/web/lib/data/externalFlows/currentAccountTypes.ts`, `currentAccountValidation.ts`, `prepareCurrentAccount.ts`; `apps/web/scripts/prepare-current-account.ts`; generated `data/imports/current-account-annual.csv`, `data/reports/current-account-validation.json`.
- Modify: `apps/web/package.json` (`data:prepare-current-account`, `data:check-current-account`, appended to `data:validate`).
- Test: `apps/web/tests/data/externalFlows/prepareCurrentAccount.test.ts`, `currentAccountValidation.test.ts`.

**Interfaces (produces):**
- `CURRENT_ACCOUNT_SERIES = ["ca.balance","ca.goods","ca.services","ca.primary_income","ca.secondary_income"] as const`; `type CurrentAccountSeriesId`; `CURRENT_ACCOUNT_FLOWS = ["credit","debit","net"] as const`; `type CurrentAccountFlow`; `CURRENT_ACCOUNT_SOURCE = "source.nbg_balance_of_payments_bpm6"`; `CURRENT_ACCOUNT_YEARS = { first: 2000, last: 2025 }`.
- `type CurrentAccountFact = { seriesId; year; flow; valueUsd: string; unit: "usd"; basis: "actual"; sourceId; sourceSheet; sourceCells; sourceUnit: "million_usd"; vintage; lastReviewedAt }`; `currentAccountFactKey(fact) => "${seriesId}:${flow}:${year}"`.
- `type CurrentAccountAcceptance = { status: "passed"; scope: "annual_current_account"; years: number[]; observations: 390; inputSha256; canonicalSha256; reviewedAt }`.
- `validateCurrentAccountFacts(facts: readonly CurrentAccountFact[]): void`.
- `prepareCurrentAccountData(repositoryRoot: string, mode: "write" | "check"): Promise<void>`.

Steps:
- [ ] Write failing tests: the real package yields exactly 390 facts, 26 years × 5 series × 3 flows; 2025 `ca.balance` net is `-1123241112.31000…` (the research `value_usd`), goods net 2025 matches the research row. Validation rejects a missing year, an extra series, a duplicate key, a null value, `net ≠ credit − debit` beyond the row's recorded tolerance, and a year whose four parts' credit, debit or net do not sum to `ca.balance` beyond tolerance. The preparer rejects a changed research hash and stale or failing independent verification.
- [ ] Implement `prepareCurrentAccount.ts` by following `prepareMoneyTransfers.ts`: verify `bop-annual.csv`, `prepared-validation.json`, `prepared-reconciliation.csv` against `artifact-manifest.csv` via `readVerifiedPackageFile`; require `independent-verification.json` current and passing; require every `bop.net_is_credit_minus_debit` and `bop.current_account_parts` reconciliation row for the five items and 26 years to be `pass`; copy exact decimals, sheet, cells, vintage; `REVIEWED_AT = "2026-10-10"`; write with `serializeBomCsvRows`; `check` mode uses `assertGeneratedArtifactMatches`.
- [ ] Run `npx vitest run tests/data/externalFlows/prepareCurrentAccount.test.ts tests/data/externalFlows/currentAccountValidation.test.ts`, then `npm run data:prepare-current-account` and `npm run data:check-current-account` twice; output must be byte-identical.
- [ ] Commit: `feat: prepare reviewed annual current account`.

## Task 2: Static loading and private-mirror parity

**Files:**
- Create: `apps/web/lib/data/externalFlows/importCurrentAccount.ts`; Prisma migration `prisma/migrations/<timestamp>_current_account/migration.sql`.
- Modify: `apps/web/lib/data/servedData.ts`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `apps/web/prisma/schema.prisma`.
- Test: `apps/web/tests/data/externalFlows/currentAccountServing.test.ts`, `currentAccountMirror.test.ts`.

**Interfaces (produces):**
- `loadCurrentAccountFacts(): Promise<CurrentAccountFact[]>` (checks the acceptance report fingerprint), `assertCurrentAccountParity(csv, mirror): void`, `loadServedCurrentAccountFacts(): Promise<CurrentAccountFact[]>` (CSV or db switch, as `loadServedMoneyTransfersData`).
- `type ClientCurrentAccountFact = { seriesId; year; flow; valueUsd: number }`; `toClientCurrentAccountFacts(facts): ClientCurrentAccountFact[]`.
- Mirror: `currentAccountFactMirrorCreateRows(facts, importRunId)`, `loadCurrentAccountFactsFromMirror(db)`, `loadCurrentAccountFactsFromDb()`.
- Prisma `CurrentAccountFact` model: fields as `CurrentAccountFact` plus `sourceDocumentId`, `importRunId`; `valueUsd Decimal @db.Decimal(40,20)`; `@@id([seriesId, flow, year])`; back-relations on `SourceDocument` and `ImportRun`.

Steps:
- [ ] Write failing tests: a stale canonical fingerprint throws; parity throws on a changed decimal or missing row and passes on equal sets in any order; the client projection keeps only the four fields and numeric values.
- [ ] Implement following `importMoneyTransfers.ts` and the money-transfer mirror functions. Migration enables RLS and revokes public grants exactly like `20261010072819_money_transfers/migration.sql`; generate it offline with `npx prisma migrate diff`. Import script: delete before entities it references, create, reload and assert parity inside the existing transaction; assert `CURRENT_ACCOUNT_SOURCE` is a known source id.
- [ ] Run the two test files, `npm run typecheck`, and `npx vitest run tests/factQuery/reference.test.ts` (stop and report if it disagrees).
- [ ] Commit: `feat: mirror reviewed current account with exact parity`.

## Task 3: State and model

**Files:**
- Create: `apps/web/lib/explorer/currentAccountState.ts`, `apps/web/lib/explorer/currentAccount.ts`.
- Test: `apps/web/tests/explorer/currentAccountState.test.ts`, `currentAccount.test.ts`.

**Interfaces (produces):**
- `type CurrentAccountTab = "balance" | "in" | "out"`; `type CurrentAccountState = { tab; unit: "usd" | "gdp"; mode: "line" | "table"; range: PeriodRange; selectedIds: CurrentAccountSeriesId[] }`; `DEFAULT_CURRENT_ACCOUNT_STATE` = balance, usd, line, all, `["ca.balance"]`.
- `currentAccountCoverage(facts)`, `parseCurrentAccountHash(hash, facts)`, `serializeCurrentAccountHash(state)`; hash keys `tab`, `unit`, `view`, `sel` plus the shared year-range keys.
- `type CurrentAccountGdp = { year: number; valueUsd: number; preliminary: boolean }`.
- `CURRENT_ACCOUNT_COLORS: Record<CurrentAccountSeriesId, string>` — `ca.balance` = `INK`; the four parts four distinct, fixed `SERIES_COLORS` values.
- `buildCurrentAccountModel(facts, gdp, state, presentation) => { years; range; unit: ValueUnit; series: {id,label,color}[]; valuesById: Record<id, Record<year, number|null>>; endValues: Record<id, number|null>; selectedIds; preliminaryGdpYears: number[] }`. Labels come from `external.account.series.<id>` messages.

Steps:
- [ ] Write failing tests: empty hash → defaults; a round trip of `{tab:"out", unit:"gdp", mode:"table", years 2010–2020, sel goods+services}`; unknown tab/unit/ids fall back; explicit empty `sel=` stays empty; `in` reads credit and `out` debit; 2025 balance in % of GDP is −2.944769 within 1e-6 (the `shares-of-gdp-annual.csv` value); a year with no GDP gives `null`; `preliminaryGdpYears` is `[2025]` only when 2025 is in range and unit is gdp; each year's four net parts sum to the balance within 1e-6 of the unit.
- [ ] Implement following `moneyTransfersState.ts` and `tradeOverview.ts`, using `refitRange`, `resolveRange`, `unitFor` (USD million/billion with `external.unit.*`) and, for gdp, a percent unit `{ divisor: 1, decimals: 1, label: main.percentGdp }`.
- [ ] Run both test files.
- [ ] Commit: `feat: model current account balance and parts`.

## Task 4: Excel export

**Files:** Create `apps/web/lib/explorer/currentAccountWorkbook.ts`; test `apps/web/tests/explorer/currentAccountWorkbook.test.ts`.

**Interfaces:** `buildCurrentAccountWorkbookModel({ facts, gdp, state, sources, siteOrigin }, presentation): WorkbookExportModel`, filename base `current-account`.

Steps:
- [ ] Write failing tests: Balance tab exports all five series; in/out export only the selected ones; years and unit follow state; % of GDP uses a percent measure; negative values keep the minus format; only the BOP-6 source is listed; no internal ids or cell references.
- [ ] Implement through `buildWorkbookExportModel`, following `moneyTransfersWorkbook.ts` (without the months column).
- [ ] Run the test file.
- [ ] Commit: `feat: export current account to Excel`.

## Task 5: Page, hub card, navigation, methodology and docs

**Files:**
- Create: `apps/web/components/external/current-account.tsx`, `use-current-account-state.ts`; routes `app/(ka)/explorer/external/current-account/page.tsx` and `app/(en)/en/explorer/external/current-account/page.tsx`; `apps/web/tests/explorer/currentAccountRender.test.tsx`; `apps/web/tests/browser/current-account.spec.ts`.
- Modify: `lib/pages/external.tsx` (`currentAccountMetadata`, `renderCurrentAccountPage`; hub loads current-account facts), `lib/explorer/externalHubCards.ts` (card 03 live, series = `ca.balance` net, footer `2000–2025 · annual`), `components/shell/data-sidebar.tsx`, `lib/seo/sitemap.ts`, `lib/i18n/messages/{ka,en}/external.json` and `common.json`, `lib/methodology/content/external-flows.ts` and its English twin, `data/methodology/source-archives/external-flows.csv` (BOP-6 and methodology-note notes mention the Current account page), `data/localization/en/page-revisions.json` if required by `i18n:check`; `Project_Definition.md` §2, `DESIGN.md`, `docs/data-methodology/external-flows-annual.md`.
- Test: update `tests/explorer/externalHubCards.test.ts`, `tests/seo/routes.test.ts`, methodology catalog/coverage tests and sitemap counts as they fail.

Steps:
- [ ] Write failing render and browser tests: default Balance tab renders the stacked chart with five key rows and no checkboxes; the heading has exactly one line under it; switching to Money in shows only "Current account" selected; % of GDP rescales and the source line names 2025 as preliminary; table mode lists the balance first; hash state survives reload, history and language switch; hub card 03 links to the page; 390/768/1440 layouts have no horizontal page scroll.
- [ ] Build `current-account.tsx` from `money-from-abroad.tsx`: `ExplorerHeading`, the one intro line, centred `TextTab`s, `ExplorerWorkspace` with `SegmentedTabs` (Chart/Table), `MeasurePill` (% of GDP), `StackedColumnChart` (segments = four parts' net, overlay = `ca.balance`, `periodsPerYear={1}`) or `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SourceNote`; `SeriesAside` holds a read-only key on Balance and `SeriesSelector` on in/out, then `ExcelDownloadButton`.
- [ ] Methodology: add a Current account section (four parts; goods vs Trade hub with the 2025 figures from the spec and NBG's crossing-the-border vs change-of-ownership and CIF/FOB wording; personal transfers inside secondary income; 30 September revisions). Confirm the methodology route still excludes download files from its bundle.
- [ ] Run focused tests, `npm run typecheck`, `npm run i18n:check`, then build, serve on port 3100 with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, and run `npx playwright test tests/browser/current-account.spec.ts`.
- [ ] Take screenshots (ka and en; 1440 and 390; Balance, Money in, % of GDP, table) into `/mnt/project-files/screenshots/current-account/`.
- [ ] Commit: `feat: add bilingual current account page`.

## Task 6: Review, Duru's approval, completion

- [ ] Independent whole-branch review against the spec and Review Focus; fix findings test-first.
- [ ] Send Duru the screenshots and wait for approval. No push, PR, CI or full gate before it.
- [ ] After approval: merge latest `main`, run `npm run check`, `npm run build` and the full browser suite once against the served build, push, open a draft PR, subscribe to its activity and drive CI green.
