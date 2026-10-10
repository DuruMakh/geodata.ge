# Money from Abroad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an External flows hub and a bilingual Money from abroad page where readers compare annual money transfers received and sent, by country, with NBG's personal-transfer estimate, see the end-year country ranking and download their selection.

**Architecture:** Accept only the money-transfer rows and the BoP personal-transfer rows from the frozen external-flows research package into a small canonical serving package. Follow Trading partners end to end: its preparer, static CSV/private mirror paths, shared-selection state, ranking, workbook builder and page components. One measure (Received or Sent) applies to every line; Georgia and Countries tabs organize one shared selection.

**Tech Stack:** The existing locked stack (Next.js 16, React 19, strict TypeScript, Tailwind v4, Prisma 7/Postgres, decimal.js, csv-parse, ExcelJS, Vitest, Playwright). No new product dependency.

**Spec:** [Money from abroad design](../specs/2026-10-10-money-from-abroad-design.md), approved on 2026-10-10.

**Status:** Draft plan for Duru's review. Branch `claude/project-thread-zvd7b6`. Publishing, a pull request, live migration/import and deployment are outside this plan.

## Global Constraints

- Hub `/explorer/external`, page `/explorer/external/money-from-abroad`, methodology `/methodology/external-flows`, each mirrored under `/en`. The hub follows Trade in the sidebar; Demography follows it. Foreign investment and Current account are `მალე` cards only.
- Annual values only, 2000–2025, derived from loaded facts. No monthly data, 2026 values or transfer systems.
- Measure `received | sent`, initial `received`. Tabs `georgia | countries`. Initial selection: the all-country transfer total only; first, selectable and removable. Unlimited selection; search never scopes bulk actions or counts.
- Missing stays missing; a blank never becomes zero. Partial-month values (2019) keep `monthsReported` and are marked in chart, table and Excel. The January 2010 microfinance coverage break is marked, not adjusted.
- Transfers and the BoP estimate are never subtracted, summed or reconciled on the page.
- Frozen research files stay unchanged. No live database write, request-time fetch, MCP tool, bulk publication, country page or map.
- Reuse first. Every new file below mirrors a named Trading partners file; nothing in Trade is refactored.

## Review Focus

1. A country listed only from 2008 shows gaps for 2000–2007, never zero; the two "Other countries" remainders stay separate series (Tasks 1, 3).
2. A 2019 partial-month value is marked identically in chart hover, table and Excel (Tasks 3–5).
3. Switching Received/Sent switches the official estimate between BoP credit and debit, and the ranking, figures and Excel follow (Tasks 3–5).
4. The share-of-GDP figure uses the served nominal GDP for the same year and matches the research package's `shares-of-gdp-annual.csv` (Tasks 1, 3).
5. A saved mixed, table or empty view survives reload, history, language switch and sidebar clicks (Task 5).

---

## Execution entry

- [ ] Confirm branch, clean worktree and installed dependencies (compare `node_modules/.package-lock.json` with `package-lock.json`). Read the Next.js bundled guides for routes and metadata before product code.
- [ ] Read the spec, `DESIGN.md`, `CLAUDE.md`, `docs/data-methodology/external-flows-annual.md` and the Trading partners plan and code this plan follows.

## Task 1: Reviewed serving package

**Files:**
- Create: `apps/web/lib/data/externalFlows/types.ts`, `validation.ts`, `prepareMoneyTransfers.ts`; `apps/web/scripts/prepare-money-transfers.ts`.
- Create: `data/taxonomy/money-transfer-countries.json`, `data/imports/money-transfers-annual.csv`, `data/reports/money-transfers-validation.json`.
- Modify: `apps/web/package.json` (`data:prepare-money-transfers`, `data:check-money-transfers`, appended to `data:validate`), `apps/web/lib/i18n/inventory.server.ts`, `data/localization/en/labels.json`.
- Test: `apps/web/tests/data/externalFlows/fixtures.ts`, `prepareMoneyTransfers.test.ts`, `validation.test.ts`.

Steps:
- [ ] Write failing tests that pin the accepted counts: 252 countries and remainders plus the total, 9,312 transfer observations (14 blank, 140 partial-month), 52 BoP personal-transfer observations, years 2000–2025. Reject a changed research-artifact hash, a failing or stale `independent-verification.json`, an omitted year, an extra indicator, a duplicate key, an invented zero and a partial-month value without its count.
- [ ] Implement the preparer by following `prepareTradePartners.ts`, but read the research package's prepared CSVs through `readVerifiedPackageFile` against `artifact-manifest.csv`, rather than re-reading the workbooks. The research package already proved the cells; this step proves the copy. Keep exact decimals, status, months reported, vintage and source references.
- [ ] Add reviewed Georgian country labels and English companions; register them in the translation inventory. Run the focused tests, both data commands and `npm run i18n:check`; require byte-reproducible output.
- [ ] Commit: `feat: prepare reviewed annual money transfers`.

## Task 2: Static loading and private-mirror parity

**Files:**
- Create: `apps/web/lib/data/externalFlows/importMoneyTransfers.ts`.
- Modify: `apps/web/lib/data/servedData.ts`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `apps/web/prisma/schema.prisma`, `data/sources/source-documents.csv`, `data/localization/en/sources.json`; a new timestamped Prisma migration `_money_transfers`.
- Test: `apps/web/tests/data/externalFlows/serving.test.ts`, `mirror.test.ts`, `mirrorIntegration.test.ts`.

Steps:
- [ ] Write failing tests for stale fingerprints, a null amount becoming zero, an exact-decimal change and a missing record; assert the thin client projection keeps nulls and `monthsReported` and drops source-cell metadata.
- [ ] Implement by following `importTradePartners.ts`: CSV/db switch, `MoneyTransferEntity` and `MoneyTransferFact` tables (key `[entityId, measure, year]`, nullable `Decimal(40,20)`), RLS on and public grants revoked, deletion order and parity in the existing import transaction. Register NBG's REMC and BOP-6 workbooks as source documents.
- [ ] Generate the migration offline with `prisma migrate diff` unless a disposable database is available; record which. Run focused tests, `npm run typecheck` and `npx vitest run tests/factQuery/reference.test.ts` (the shared source registry changes). A disagreement in the reference fixture is a stop condition.
- [ ] Commit: `feat: mirror reviewed money transfers with exact parity`.

## Task 3: Selection, values, figures and ranking

**Files:**
- Create: `apps/web/lib/explorer/moneyTransfersState.ts`, `moneyTransfers.ts`.
- Test: `apps/web/tests/explorer/moneyTransfersState.test.ts`, `moneyTransfers.test.ts`.

Steps:
- [ ] Write failing tests: the empty hash gives `received`, `georgia`, line mode, total only; a mixed saved hash round-trips; an explicit empty selection stays empty; tabs keep the selection. The official estimate maps to BoP credit for Received and debit for Sent. Countries absent before 2008 are null, not zero. Shares in the ranking divide by that year's all-country total; remainders are listed last and unranked. The four figures use the range's end year; the GDP share for 2025 equals 9.5663% to the research file's precision.
- [ ] Implement as pure functions following `tradePartnersState.ts` and `tradePartners.ts`, using the existing `resolveRange`, `unitFor`, `formatInUnit`, `publicLabel` and stable colour helpers. The GDP share reads `loadGdpOverviewFacts`.
- [ ] Commit: `feat: model money transfer comparisons and ranking`.

## Task 4: Excel export

**Files:** Create `apps/web/lib/explorer/moneyTransfersWorkbook.ts`; test `apps/web/tests/explorer/moneyTransfersWorkbook.test.ts`.

Steps:
- [ ] Write failing tests: selected series, years and measure only; USD headings; blank missing cells; the partial-month and 2010 notes when affected rows are present; the REMC source when any transfer series is exported and BOP-6 when the estimate is; no internal IDs or cell references.
- [ ] Implement through `buildWorkbookExportModel`, following `tradePartnersWorkbook.ts`; filename base `money-from-abroad`. Reopen a real file in both languages.
- [ ] Commit: `feat: export money transfer comparisons to Excel`.

## Task 5: Hub, page, methodology and sources

**Files:**
- Create: `apps/web/components/external/money-from-abroad.tsx`, `money-from-abroad-series-panel.tsx`, `money-from-abroad-ranking.tsx`, `use-money-from-abroad-state.ts`; `apps/web/lib/pages/external.tsx`; `apps/web/lib/explorer/externalHubCards.ts`; route wrappers under `app/(ka)/explorer/external/` and `app/(en)/en/explorer/external/` for the hub and the page; `apps/web/lib/i18n/messages/{ka,en}/external.json`; `apps/web/lib/methodology/content/external-flows.ts` and its English twin; `data/methodology/source-archives/external-flows.csv`.
- Modify: `apps/web/components/shell/data-sidebar.tsx`, `apps/web/lib/seo/sitemap.ts`, `apps/web/lib/i18n/inventory.server.ts`, common messages, `data/localization/en/page-revisions.json`, `data/localization/en/documents.json`; `Project_Definition.md` §2, `DESIGN.md`, `docs/data-methodology/external-flows-annual.md`.
- Test: render, hub-card, i18n, SEO-route, methodology-archive tests following their Trade counterparts; `apps/web/tests/browser/money-from-abroad.spec.ts`.

Steps:
- [ ] Write failing render and browser tests for the defaults, Received/Sent switching, mixed selections across tabs, Clear/Select all under search, empty state, partial-month and 2010 markers, ranking expansion, the four figures, URL/history/language/sidebar preservation and the three screen widths.
- [ ] Build the components from the Trading partners components with the existing workspace, chart, table, range strip, selector, segmented tabs and Excel button. If the line chart lacks a hollow point or break marker, add it as an optional prop whose default leaves every existing chart unchanged.
- [ ] Add the hub with one live card and two `მალე` cards, the sidebar entry, routes, metadata and sitemap. Publish REMC, BOP-6 and NBG's two methodology notes through the source archive. Write the methodology page from the methodology doc: transfers are not remittances, country meaning, coverage limits, vintages and revisions.
- [ ] Run the focused tests, `npm run i18n:check`, then a production build served locally and `npx playwright test tests/browser/money-from-abroad.spec.ts`. Check both languages at 390, 768 and 1440 pixels.
- [ ] Commit: `feat: add bilingual money from abroad explorer`.

## Task 6: Review and completion

- [ ] Independent whole-branch review against the spec and the Review Focus list; fix findings with a failing test first.
- [ ] Run `npm run check` and `npm run build` once on final inputs, then the full browser suite against the served build, per `CLAUDE.md`.
- [ ] Push to `claude/project-thread-zvd7b6` and report results. A pull request, live database import and deployment wait for Duru's separate go-ahead.

## Known environment limit

The cloud workspace cannot download the spreadsheet library from `cdn.sheetjs.com`. Local checks substitute the registry release without changing repository files; the browser suite and Excel reopen tests should be confirmed in CI or on Duru's computer before release.
