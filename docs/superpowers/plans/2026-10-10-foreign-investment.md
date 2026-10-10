# Foreign Investment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bilingual Foreign investment page to the External flows hub. On it, readers compare Geostat's annual FDI inflow by country, sector or region, see the end-year ranking, and download their selection.

**Architecture:** The plan accepts only Geostat's annual total, country, sector and region inflow rows from the frozen external-flows research package into a small canonical serving package. It then follows Money from abroad end to end: the preparer, the static CSV/private mirror paths, the hash state, the model, the ranking, the workbook builder and the page components. One tab (country, sector or region) is active at a time and owns its own series list and years. The total is first on every tab.

**Tech Stack:** The existing locked stack (Next.js 16, React 19, strict TypeScript, Tailwind v4, Prisma 7/Postgres, decimal.js, csv-parse, ExcelJS, Vitest, Playwright). No new dependency.

**Spec:** [Foreign investment design](../specs/2026-10-10-foreign-investment-design.md), approved by Duru on 2026-10-10.

**Status:** Branch `claude/project-thread-u30vvm`. Pushing, a pull request, the live migration/import and deployment all wait for Duru's OK on screenshots.

## Global Constraints

- Page `/explorer/external/foreign-investment`, mirrored under `/en`. Name: Foreign investment / `უცხოური ინვესტიციები` (the existing `external.investment.*` messages). Hub card 02 becomes live; Current account stays `მალე`.
- Under the heading there is one short line only. No figures block, and only one source line under the chart.
- Tabs `country | sector | region`, initially `country`. They are centred `TextTab`s like Received | Sent.
- Years come from loaded facts: country 1996–2025, sector 2016–2025, region 2009–2025.
- The initial selection is `fdi.total` only. It is first, selectable and removable. Switching tabs resets the selection to the total and refits the range.
- Country list: total, the end year's top 10 countries by value, then `fdi.others` (total minus the top 10). Sector list: total plus 18 sections. Region list: total plus 11 regions.
- Geostat `-` (`not_applicable`) and blanks stay null and are never zero. Negative values are kept and drawn below zero. In the ranking they get an empty bar.
- Geostat only: no NBG BPM6 lines, components, positions, country groups, quarters or 2026.
- The frozen research files stay unchanged. No live database write, request-time fetch, MCP tool or bulk publication.
- Reuse first. Each new file mirrors the named Money from abroad file.

## Review Focus

1. A country with `-` in early years shows gaps, not zero, in the chart, table and Excel (Tasks 1, 3, 4).
2. A split region (for example Guria) is null for 2009–2015 and present from 2016. Its ranking is unaffected (Tasks 1, 3).
3. A negative end-year value (Imereti 2025, −64.2 million) gets an empty bar and a negative share in the ranking, and is never ranked above a positive one (Task 3).
4. A saved hash with tab `sector` and a year outside 2016–2025 refits to the sector years. An id from another tab is dropped (Task 3).
5. The top 10 plus Other countries add up to the total for every year in range (Task 3).

---

## Execution entry

- [ ] Confirm the branch and installed dependencies (compare `node_modules/.package-lock.json` with `package-lock.json`).
- [ ] Re-read the Money from abroad files this plan follows: `lib/data/externalFlows/*`, `lib/explorer/moneyTransfers*.ts`, `components/external/*` and `lib/pages/external.tsx`.

## Task 1: Reviewed serving package

**Files:**
- Modify: `apps/web/lib/data/externalFlows/types.ts`.
- Create: `apps/web/lib/data/externalFlows/foreignInvestmentValidation.ts`, `prepareForeignInvestment.ts`; `apps/web/scripts/prepare-foreign-investment.ts`.
- Create: `data/taxonomy/foreign-investment.json`, `data/imports/foreign-investment-annual.csv`, `data/reports/foreign-investment-validation.json`.
- Modify: `apps/web/package.json` (`data:prepare-foreign-investment`, `data:check-foreign-investment`, appended to `data:validate`), `apps/web/lib/i18n/inventory.server.ts`, `data/localization/en/labels.json`.
- Test: `apps/web/tests/data/externalFlows/prepareForeignInvestment.test.ts`, `foreignInvestmentValidation.test.ts`.

**Interfaces (Produces), in `types.ts`:**
- `ForeignInvestmentDimension = "country" | "sector" | "region"`, `FOREIGN_INVESTMENT_DIMENSIONS`.
- `ForeignInvestmentEntity = { id: string; dimension: ForeignInvestmentDimension | null; kind: "total" | "country" | "unallocated" | "remainder" | "sector" | "region"; labelKa: string }`. The total has `dimension: null`.
- `FOREIGN_INVESTMENT_TOTAL_ID = "fdi.total"`. `FOREIGN_INVESTMENT_SOURCES = { total, countries, sectors, regions }`, with the `source.geostat_fdi_*` ids.
- `ForeignInvestmentFact = { entityId; year; valueUsd: string | null; unit: "usd"; basis: "actual"; valueStatus: "numeric" | "not_applicable"; sourceId; sourceSheet; sourceCells; sourceUnit: "thousand_usd" | "million_usd"; vintage; lastReviewedAt }`, with key `entityId:year`.
- `ForeignInvestmentData`, `ForeignInvestmentAcceptance` (the same shape idea as the money-transfer report).
- `validateForeignInvestmentData(data)` and `foreignInvestmentEnglishLabels(entities, labels)`.

**Steps:**
- [ ] Write failing tests that pin these counts:
  - entity ids: `fdi.total`; 78 `fdi.country.m49_*` plus `fdi.country.unknown`, `fdi.country.international_organizations` and `fdi.country.other_remainder`; `fdi.sector.a`…`fdi.sector.s` (18, with no O or T); and the 11 `fdi.region.*` matching `municipal-regions.json`
  - years: total and countries 1996–2025, sectors 2016–2025, regions 2009–2025
  - the six split regions are `not_applicable` for 2009–2015

  The tests also reject:
  - a changed artifact hash
  - stale or failing independent verification
  - an omitted year
  - a `not_applicable` value turned into zero
  - a duplicate key
  - an unreviewed entity
- [ ] Implement `prepareForeignInvestmentData(root, mode)` following `prepareMoneyTransfers.ts`:
  - Read `fdi-flows-annual.csv` and `prepared-reconciliation.csv` through `readVerifiedPackageFile`.
  - Take `dimension = total` for `fdi.total` (`million_usd`). Take the `role` values `country | unallocated | remainder` from `country`, `component` rows from `sector`, and `region | region_part` from `region`, all `thousand_usd`.
  - Skip country groups, region groups, per-table totals, components and BPM6.
  - For every year and dimension, require the passing `fdi_flows.<dimension>.children` and `table_total_matches_annual_total` checks from the reconciliation file.
  - Write the CSV (BOM) and the report. `check` mode uses `assertGeneratedArtifactMatches`.
- [ ] Build the catalogue. Reuse the Georgian and English labels from `trade-partners.json` (by `sourceCode` = M49), `economic-sectors.json` (by letter) and `municipal-regions.json`. Add reviewed labels for Saint Kitts and Nevis (`სენტ-კიტსი და ნევისი`), Unknown (`უცნობი`), International organizations (`საერთაშორისო ორგანიზაციები`), Geostat's remainder (`სხვა ქვეყნები`) and the total (`პირდაპირი უცხოური ინვესტიციები, სულ`). Register English companions in `labels.json`.
- [ ] Run the focused tests, `npm run data:prepare-foreign-investment` twice (byte-identical output), then `npm run data:check-foreign-investment` and `npm run i18n:check`.
- [ ] Commit: `feat: prepare reviewed annual foreign direct investment`.

## Task 2: Static loading and private-mirror parity

**Files:**
- Create: `apps/web/lib/data/externalFlows/importForeignInvestment.ts`.
- Modify: `apps/web/lib/data/servedData.ts`, `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `apps/web/prisma/schema.prisma`, `data/sources/source-documents.csv`, `data/localization/en/sources.json`; add a new migration `<timestamp>_foreign_investment`.
- Test: `apps/web/tests/data/externalFlows/foreignInvestmentServing.test.ts`, `foreignInvestmentMirror.test.ts`, and extend `mirrorIntegration.test.ts`.

**Interfaces (Produces):**
- `loadForeignInvestmentData(): Promise<ForeignInvestmentData>` and `loadServedForeignInvestmentData()`.
- `assertForeignInvestmentParity(csv, mirror)`.
- `ClientForeignInvestmentData = { entities; facts: { entityId; year; valueUsd: number | null }[] }` and `toClientForeignInvestmentData(data)`.
- `loadForeignInvestmentDataFromDb()` in `servedDataDb.ts`.

**Steps:**
- [ ] Write failing tests for:
  - a stale fingerprint
  - a null amount becoming zero
  - an exact-decimal change
  - a missing record

  Also assert that the client projection keeps nulls and drops the source metadata.
- [ ] Implement by following `importMoneyTransfers.ts`, with the `ForeignInvestmentEntity` and `ForeignInvestmentFact` models (key `[entityId, year]`, nullable `Decimal(40,20)`). Copy RLS and the revoked grants from `20261010072819_money_transfers/migration.sql`, along with the deletion order and parity in the existing import transaction. Register the four Geostat workbooks as source documents.
- [ ] Generate the migration offline with `prisma migrate diff` (no disposable database here). Run the focused tests, `npm run typecheck` and `npx vitest run tests/factQuery/reference.test.ts`. A disagreement in the reference fixture is a stop condition.
- [ ] Commit: `feat: mirror reviewed foreign investment with exact parity`.

## Task 3: State, model and ranking

**Files:**
- Create: `apps/web/lib/explorer/foreignInvestmentState.ts`, `foreignInvestment.ts`.
- Test: `apps/web/tests/explorer/foreignInvestmentState.test.ts`, `foreignInvestment.test.ts`.

**Interfaces (Produces):**
- `ForeignInvestmentState = { mode: "line" | "table"; dimension: ForeignInvestmentDimension; range: PeriodRange; selectedIds: string[] }`.
- `foreignInvestmentCoverage(data, dimension)` returns `{ min, max, years }`. Its years are those where any entity of that dimension has a non-null value.
- `parseForeignInvestmentHash(hash, data)` and `serializeForeignInvestmentHash(state)`, with the keys `tab`, `view`, `sel` and the shared year keys.
- `FOREIGN_INVESTMENT_OTHERS_ID = "fdi.others"`.
- `buildForeignInvestmentModel(data, state, presentation): ForeignInvestmentModel`, with the same fields as `MoneyTransfersModel` minus `partialMonths`.
- `foreignInvestmentColor(id)`.

**Steps:**
- [ ] Write failing tests:
  - An empty hash gives `country`, line mode, the total only and 1996–2025.
  - `tab=sector&from=2000` refits to 2016–2025.
  - A `sel` holding a region id on the country tab is dropped.
  - For 2025, the country tab's top 10 starts United Kingdom (426.6 million), Azerbaijan, Türkiye, and `fdi.others` equals the total minus the top 10 in every year.
  - The sector tab lists the total plus 18 sectors.
  - In the region tab's 2025 ranking, Tbilisi is first. Imereti is last with a negative share and its value kept.
  - Guria is null for 2009–2015.
  - The ranking shares divide by the same year's `fdi.total`.
- [ ] Implement as pure functions, following `moneyTransfersState.ts` and `moneyTransfers.ts`:
  - Only the country tab folds into top 10 plus `fdi.others`.
  - Sector and region rankings list every item, sorted by value descending; nulls are omitted.
  - In the ranking, `rank` is set for every listed item except `fdi.others`.
- [ ] Commit: `feat: model foreign investment tabs and ranking`.

## Task 4: Excel export

**Files:** Create `apps/web/lib/explorer/foreignInvestmentWorkbook.ts`. Test: `apps/web/tests/explorer/foreignInvestmentWorkbook.test.ts`.

- [ ] Write failing tests that require:
  - only the selected series and years
  - the tab name in the summary
  - USD headings
  - blank cells for null
  - negative values kept
  - the Geostat source for the active tab plus the total table
  - no internal ids
- [ ] Implement through `buildWorkbookExportModel`, following `moneyTransfersWorkbook.ts`. The filename base is `foreign-investment`.
- [ ] Commit: `feat: export foreign investment to Excel`.

## Task 5: Page, hub, methodology and sources

**Files:**
- Create: `apps/web/components/external/foreign-investment.tsx`, `foreign-investment-series-panel.tsx`, `use-foreign-investment-state.ts`; the route wrappers `app/(ka)/explorer/external/foreign-investment/page.tsx` and `app/(en)/en/explorer/external/foreign-investment/page.tsx`.
- Modify:
  - `components/external/money-from-abroad-ranking.tsx`: generalize into `ExternalRanking` with props `{ title, rows, other, testId }`, clamp bars at zero and leave Money from abroad's output unchanged
  - `lib/pages/external.tsx`: add `foreignInvestmentMetadata` and `renderForeignInvestmentPage`, and let the hub load both datasets
  - `lib/explorer/externalHubCards.ts`
  - `components/shell/data-sidebar.tsx`
  - `lib/seo/sitemap.ts`
  - `lib/i18n/messages/{ka,en}/external.json`
  - `lib/methodology/content/external-flows.ts` and its English twin
  - `data/methodology/source-archives/external-flows.csv`
  - `data/localization/en/documents.json` and `page-revisions.json`
  - `Project_Definition.md` §2, `DESIGN.md`, `docs/data-methodology/external-flows-annual.md`
- Test: `apps/web/tests/explorer/foreignInvestmentRender.test.tsx`; extend `externalHubCards.test.ts`, `seo/routes.test.ts`, `methodology/catalog.test.ts` and `prepareArchives.test.ts` as their failures require; `apps/web/tests/browser/foreign-investment.spec.ts`.

**Steps:**
- [ ] Write failing render and browser tests for:
  - the defaults
  - tab switching (list, years, ranking and selection reset)
  - Clear and Select all under search
  - the empty state
  - a negative ranking row
  - URL, history and language preservation
  - 390 and 1440 pixel widths
- [ ] Build `ForeignInvestment` from `MoneyFromAbroad`:
  - the heading and one intro line
  - the centred tabs
  - the workspace, chart, table, range strip, series aside and Excel button
  - one `SourceNote` (Geostat) and the ranking

  It has no partial-month code.
- [ ] Hub card 02 goes live with the total sparkline and `1996–2025 · annual`. Add the sidebar entry after Money from abroad, along with the routes, metadata, Dataset JSON-LD and sitemap entry. Archive the four Geostat workbooks and `FDI_metadata_1002_090626_EN.pdf`. Add the methodology section described in spec §6.
- [ ] Run the focused tests and `npm run i18n:check`. Build, serve locally and run `npx playwright test tests/browser/foreign-investment.spec.ts tests/browser/money-from-abroad.spec.ts`.
- [ ] Commit: `feat: add bilingual foreign investment explorer`.

## Task 6: Screenshots, review and completion

- [ ] Take screenshots in Georgian and English at 1440 and 390 pixels (each tab once). Save them to `/mnt/project-files/screenshots/foreign-investment/` and send them to Duru. Wait for the OK.
- [ ] After the OK: run an independent whole-branch review against the spec and the Review Focus. Fix findings, writing a failing test first.
- [ ] Run `npm run check` and `npm run build` once, then the full browser suite against the served build, per `CLAUDE.md`.
- [ ] Push `claude/project-thread-u30vvm` and open a draft PR. The live migration, the import and the deployment wait for Duru's separate go-ahead.
