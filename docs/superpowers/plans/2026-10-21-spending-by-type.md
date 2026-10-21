# Spending by Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/explorer/expenditure-types` (+ `/en`): the Ministry of Finance's general-government spending by economic type, 2002–2025, in ₾ and share of GDP, on the sectors explorer, with Excel, methodology, a Budget hub card and a DB mirror.

**Architecture:** A new canonical dataset `expenditure-types` (CSV with the sectors observation columns) prepared from one archived MoF workbook plus the site's national GDP file, mirrored to a new `ExpenditureTypeFact` table with CSV/DB parity. The page renders the existing `EconomicSectorsExplorer`, whose `SectorPageConfig` gains two optional fields (offered measures, pinned total id) whose defaults reproduce Sectors and GDP by expenditure exactly.

**Tech Stack:** Next.js 16, strict TypeScript, Vitest, Playwright, Prisma 7, decimal.js, xlsx/fflate (as in `prepareGdpExpenditure.ts`).

**Spec:** `docs/superpowers/specs/2026-10-21-spending-by-type-design.md`

## Global Constraints

- Source `general20022025.xlsx`, sheet `Sheet4`, million GEL, years 2002–2025 (columns C–Z), sha256 recorded in the manifest. Not the GFSM 2014 file. No balance (NLB), financing or revenue rows served.
- IDs `spending_type.{total,expense,compensation,goods_services,interest,subsidies,grants,social_benefits,other,investment}` = GFS `2M, 2, 21, 22, 24, 25, 26, 27, 28, 31`. Code 23 must be 0 every year and is not served.
- Measures `nominal` (GEL, `published`) and `share_of_gdp` (amount ÷ `national-gdp-annual-1996-2025.csv` `gdp_current_prices_gel` × 100; status `preliminary` when that GDP row's status is `preliminary`, else `published`). No `real_growth`.
- Identities per year within 0.05 m GEL: sum(21..28) = 2; 2 + 31 = 2M.
- Real zeros are served as `0`.
- Default selection: `spending_type.total, social_benefits, investment, compensation, subsidies, goods_services, interest`.
- Under the heading one `LatestValueLine` only ("ხარჯები 2025: 29.7 მლრდ ₾"); share headline = total's share; one source line under the chart; icon-only measure switches (₾, ChartPie); headings "მიმდინარე ხარჯები / Running costs" and "ინვესტიციები / Investment"; nothing collapsible; fixed registry order.
- Budget sidebar order: expenditure, expenditure-types, revenue, municipalities, analysis, debt, deficit.
- Outside MCP and the central JSON/CSV publications.
- Sectors and GDP by expenditure output and tests unchanged.

## Review Focus

1. A deep link `#measure=real_growth` must fall back to ₾, not an empty chart (Task 3 test).
2. Share view with only the total ticked must keep the total (28.4% in 2025), not swap to the five largest rows as Sectors does for GDP (Task 3 test).
3. Grants 2002–2004 and other costs 2002–2003 are 0 in chart, table and Excel, not gaps (Task 1 test on the CSV rows).
4. 2025 share values carry the preliminary mark; 2025 amounts do not (Task 1 test).
5. The Spending row in the sidebar is not marked current on the new page (Task 4 test on `SectionNav`).

---

### Task 1: Data foundation

**Files:**
- Create: `docs/Raw Data/Budget/expenditure-types/sources/general20022025.xlsx`, `docs/Raw Data/Budget/expenditure-types/source-manifest.json` (url, sha256, bytes, retrievedAt 2026-10-21, sheet, year columns, row map code→row/label)
- Create: `data/taxonomy/expenditure-types.json` (`SectorDefinition` rows with `classificationCode` = GFS code, headings on all rows but total)
- Create: `apps/web/lib/data/expenditureTypes/{types.ts,validation.ts,prepareExpenditureTypes.ts}`, `apps/web/scripts/prepare-expenditure-types.ts`
- Create: `data/imports/expenditure-types-annual.csv`, `data/reports/expenditure-types-validation.json`, `docs/data-methodology/expenditure-types.md`
- Modify: `apps/web/package.json` (`data:prepare-expenditure-types`, `data:check-expenditure-types`), `apps/web/scripts/validate-all.ts`
- Test: `apps/web/tests/data/expenditureTypes/prepareExpenditureTypes.test.ts`

**Interfaces:**
- Produces: `EXPENDITURE_TYPES_CSV_PATH`, `EXPENDITURE_TYPES_REGISTRY_PATH`, `EXPENDITURE_TYPES_TOTAL = "spending_type.total"`; `prepareExpenditureTypes(repositoryRoot: string, mode: "write" | "check"): Promise<void>`; `validateExpenditureTypeObservations(facts: SectorObservation[], registry: readonly SectorDefinition[], gdpByYear: ReadonlyMap<number, { value: string; status: SectorStatus }>): void`. Source ids `source.mof_gfs_general_government_2002_2025` (nominal) and the same id for shares (locator joins MoF cell and GDP CSV row).

- [ ] **Step 1: Tests** — `--check` passes on the committed CSV; 10 ids × 24 years × 2 measures = 480 rows; `compensation` 2025 nominal = `3599200000`, `total` 2025 = `29743800000`, total share 2025 ≈ 28.44 and `preliminary`, total nominal 2025 `published`; `grants` 2003 nominal = `0`; a tampered byte fails with the hash message; a changed label fails; an identity off by 0.1 m fails; a non-zero code 23 fails.
- [ ] **Step 2:** `npx vitest run tests/data/expenditureTypes` → FAIL.
- [ ] **Step 3: Implement** after `prepareGdpExpenditure.ts` (verified read, XML cell text, ×1,000,000 in 50-digit Decimal, `sharePercent`, BOM CSV ordered by registry order, measure, year; report with hash, counts and per-year identity differences).
- [ ] **Step 4:** tests + `npm run data:check-expenditure-types` → PASS.
- [ ] **Step 5:** commit `feat(data): spending by type canonical dataset`.

### Task 2: Serving loader and database mirror

**Files:**
- Create: `apps/web/lib/data/expenditureTypes/importExpenditureTypes.ts`, `apps/web/prisma/migrations/20261021120000_expenditure_types/migration.sql` (after `20261020100000_gdp_expenditure`)
- Modify: `apps/web/prisma/schema.prisma` (`ExpenditureTypeFact` = `GdpExpenditureFact` columns), `apps/web/lib/db/{mirrorRows.ts,servedDataDb.ts}`, `apps/web/scripts/import-budget-facts.ts`, `data/sources/source-documents.csv` (1 row), `docs/data-methodology/database-import.md`, `docs/deployment.md` (480 rows; anchor 29.7 bn)
- Test: `apps/web/tests/data/expenditureTypes/importExpenditureTypes.test.ts`

**Interfaces:**
- Produces: `EXPENDITURE_TYPES: SectorDefinition[]`; `loadExpenditureTypeFacts(): Promise<SectorObservation[]>`; `loadServedExpenditureTypesData(): Promise<{ facts: ServedSectorObservation[] }>`; `assertExpenditureTypesParity(csv, db)`; `expenditureTypesMirrorCreateRows(facts, importRunId)`; `loadExpenditureTypeFactsFromMirror(db)`; `loadExpenditureTypeFactsFromDb()`.

- [ ] **Step 1: Tests** — loader returns 480 facts; duplicate key / unknown id throws; mirror round trip equal; a changed value fails parity.
- [ ] **Step 2–4:** FAIL → implement after the GDP by expenditure equivalents, `npx prisma generate` → tests + `npm run typecheck` PASS.
- [ ] **Step 5:** commit `feat(data): serve and mirror spending by type`.

### Task 3: Sectors explorer config — measures and total

**Files:**
- Modify: `apps/web/lib/explorer/economicSectors.ts`, `apps/web/components/economic-sectors/{economic-sectors-explorer.tsx,sector-series-panel.tsx}`, `apps/web/lib/explorer/economicSectorsWorkbook.ts`, `apps/web/lib/explorer/colors.ts` (10 distinct `spending_type.*` colours, total = ink)
- Create: `apps/web/lib/explorer/expenditureTypes.ts` (`EXPENDITURE_TYPES_PAGE_CONFIG`)
- Test: `apps/web/tests/explorer/expenditureTypesModel.test.ts`; existing sectors and GDP by expenditure tests unchanged.

**Interfaces:**
- Produces: `SectorPageConfig` gains `scope: … | "expenditureTypes"`, optional `measures?: readonly SectorMeasure[]` (default all three) and `totalId?: string` (default `SECTOR_GDP`); helper `sectorTotalId(config)`. `parseSectorHash` maps a measure outside `config.measures` to `nominal`; `changeSectorMeasure`'s five-largest swap applies only when `totalId` is GDP; the model's headline, the panel's `totalId` and the workbook's `total` row use `sectorTotalId(config)`; the toolbar lists only `config.measures`.

- [ ] **Step 1: Tests** — default state selects the seven default ids; `#measure=real_growth` parses to `nominal`; share with only the total keeps `[spending_type.total]` and headline ≈ 28.44 for 2025; `₾` headline 2025 = 29,743,800,000; rows keep registry order; Sectors `DEFAULT_SECTOR_STATE` and its share swap unchanged.
- [ ] **Step 2–4:** FAIL → implement → new test + `tests/explorer/*ector*`, `tests/explorer/gdpExpenditure*` PASS.
- [ ] **Step 5:** commit `feat(explorer): sector explorer measures and total options`.

### Task 4: Page, Budget section, hub card, messages, SEO

**Files:**
- Create: `apps/web/lib/pages/expenditure-types.tsx`, `apps/web/app/(ka)/explorer/expenditure-types/page.tsx`, `apps/web/app/(en)/en/explorer/expenditure-types/page.tsx`, `apps/web/lib/i18n/messages/{ka,en}/expenditureTypes.json`
- Modify: `apps/web/lib/explorer/sections.ts` (`expenditureTypes` after `expenditure`), `apps/web/lib/explorer/hubCards.ts` + its page caller (card with total-spending sparkline), `messages/{ka,en}/common.json` (`common.expenditureTypes`: "ხარჯების სახეები" / "Spending by type"), `apps/web/lib/navigation/navTree.ts` (source-note map), `apps/web/lib/i18n/{types.ts,messages.server.ts,inventory.server.ts}`, `apps/web/lib/seo/{sitemap.ts,datasetVocabulary.ts}`, `apps/web/public/llms.txt`, `apps/web/lib/factQuery/buildSnapshot.ts` (exclude the new source id)
- Test: `apps/web/tests/explorer/expenditureTypesPage.test.tsx`; count updates in navigation, routes, hub and agent-file tests as they fail.

- [ ] **Step 1: Tests** — page renders heading "ხარჯები ეკონომიკური კლასიფიკაციით" / "Government spending by type", headline "29.7" for 2025, headings Running costs / Investment, no highlights strip, two measure buttons; Budget hub card links to `/explorer/expenditure-types` with a 2002–2025 sparkline; sidebar lists Spending by type after Spending and `/explorer/expenditure` is not current on it.
- [ ] **Step 2–4:** FAIL → implement after `lib/pages/gdp-expenditure.tsx` → touched tests, `npm run typecheck`, `npm run i18n:check` PASS.
- [ ] **Step 5:** commit `feat(budget): spending by type page`.

### Task 5: Methodology page and source archive

**Files:**
- Create: `apps/web/lib/methodology/content/expenditure-types.ts`, `.../content/en/expenditure-types.ts`, `data/methodology/source-archives/expenditure-types.csv`
- Modify: `apps/web/lib/methodology/{types.ts,catalog.ts,sourceInventory.ts}`, `content/en/revisions.ts`, `apps/web/lib/pages/methodology-article.tsx`, `data/localization/en/{sources.json,documents.json,page-revisions.json}`, `data/methodology/decision-register.csv` (source choice, no deficit line, default selection)
- Test: existing methodology/i18n tests updated for the new id.

- [ ] **Step 1:** add the id to expected lists → FAIL. **Step 2:** content per spec §6, plain words, both languages. **Step 3:** `npx vitest run tests/methodology tests/i18n` → PASS. **Step 4:** commit `feat(methodology): spending by type`.

### Task 6: Scope docs, browser test, preview

**Files:**
- Modify: `Project_Definition.md` §2, `DESIGN.md` (§6.7 Budget order, hub card, page)
- Create: `apps/web/tests/browser/expenditure-types.spec.ts`; update browser specs that count routes or Budget sections.

- [ ] **Step 1:** browser spec: ka + en load; seven default lines; share switch keeps the total; table mode; 375px heading line on one line; Excel download starts.
- [ ] **Step 2:** build with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, serve on 3100, run the new spec and the budget/hub specs with `CI=1` → PASS.
- [ ] **Step 3:** screenshots (desktop + phone, ka; both measures; hub; methodology) to `/mnt/project-files/screenshots/spending-by-type/`; ask Duru (preview card). Full gates, push and PR only after Duru's OK.
