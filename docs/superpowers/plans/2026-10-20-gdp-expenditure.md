# GDP by Expenditure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/explorer/economy/expenditure` (+ `/en`): Geostat's GDP by expenditure 2010–2025 in ₾ / share of GDP / real growth, on the Sectors page's explorer, with Excel, methodology and a DB mirror.

**Architecture:** A new canonical dataset `gdp-expenditure` (CSV with the Sectors observation columns) prepared from three archived Geostat workbooks, mirrored to a new `GdpExpenditureFact` table with CSV/DB parity. The page renders the existing `EconomicSectorsExplorer`, extended with an optional `config` whose default reproduces Sectors exactly.

**Tech Stack:** Next.js 16, strict TypeScript, Vitest, Playwright, Prisma 7, decimal.js, xlsx/fflate (as in `prepareEconomicSectors.ts`).

**Spec:** `docs/superpowers/specs/2026-10-20-gdp-expenditure-design.md`

## Global Constraints

- Years 2010–2025 (₾, share); growth 2011–2025; annual columns only; 2025 `preliminary` (Geostat `2025*`).
- IDs: `economy.gdp_total` and `gdp_use.{consumption,households,npish,households_npish,government,government_individual,government_collective,investment,fixed_capital,inventories,exports,exports_goods,exports_services,imports,imports_goods,imports_services}`.
- `households`, `npish`: nominal + share only. `households_npish`: real_growth only. `inventories`: nominal + share only. Every other id: all three measures.
- Never sum households + npish; never estimate a missing rate; `…` and `x` are never numbers.
- Imports stored positive. Inventories may be negative.
- Under the heading one `LatestValueLine` only; one source line under the chart; icon-only measure switches; headings in the series list, no prefixes, nothing collapsible.
- Default selection: `economy.gdp_total, gdp_use.households, gdp_use.government, gdp_use.investment, gdp_use.exports, gdp_use.imports`.
- Outside MCP and the central JSON/CSV publications.
- Sectors page output and tests unchanged.

## Review Focus

1. A deep link `#measure=real_growth&sel=gdp_use.households` must show the households-and-non-profits line, not an empty chart (Task 3 test).
2. Switching growth → ₾ with `households_npish` ticked must tick Households, not leave nothing selected (Task 3 test).
3. Negative inventories (2017, 2021) must reach chart, table and Excel as negatives, not gaps (Task 1 + Task 4 tests).
4. The share-view series count and list must not offer `inventories`' growth or `households` in growth (Task 3 test on visible rows).
5. GDP in the new CSV must equal `economic-sectors-annual.csv`'s `economy.gdp_total` nominal for every year (Task 1 check).

---

### Task 1: Data foundation (sources, taxonomy, preparation, canonical CSV)

**Files:**
- Create: `docs/Raw Data/Economy/gdp-expenditure/sources/{08_GDP-by-use-categories.xlsx,09_Real-GDP-growth-by-categories-of-use.xlsx,10_GDP-by-categories-of-use-at-constant-prices.xlsx}` (downloaded 2026-10-20 from media/83012, 83016, 83014; full sha256 and bytes recorded in the manifest)
- Create: `docs/Raw Data/Economy/gdp-expenditure/source-manifest.json` (roles `nominal`/`growth`/`growth_validation`, sheet, annual columns, row numbers, units, `releasedAt: "2026-09-28"`, `preliminaryYears: [2025]`)
- Create: `data/taxonomy/gdp-expenditure.json` (`SectorDefinition` rows + optional `headingKa`/`headingEn`; `classificationCode` = SNA code: P.3, P.31, P.32, P.5, P.51, P.52, P.6, P.61, P.62, P.7, P.71, P.72, null for GDP)
- Create: `apps/web/lib/data/gdpExpenditure/{prepareGdpExpenditure.ts,validation.ts}`, `apps/web/scripts/prepare-gdp-expenditure.ts`
- Create: `data/imports/gdp-expenditure-annual.csv`, `data/reports/gdp-expenditure-validation.json`
- Modify: `apps/web/lib/data/economicSectors/types.ts` (optional `headingKa?: string; headingEn?: string` on `SectorDefinition`), `apps/web/package.json` (`data:prepare-gdp-expenditure`, `data:check-gdp-expenditure`), `apps/web/scripts/validate-all.ts`
- Create: `docs/data-methodology/gdp-expenditure.md`
- Test: `apps/web/tests/data/gdpExpenditure/prepareGdpExpenditure.test.ts`

**Interfaces:**
- Produces: `prepareGdpExpenditure(repositoryRoot: string, mode: "write" | "check"): Promise<void>`; `validateGdpExpenditureObservations(facts: SectorObservation[], registry: readonly SectorDefinition[]): void`; `GDP_EXPENDITURE_REGISTRY_PATH = "data/taxonomy/gdp-expenditure.json"`. Observations use `SectorObservation` with `valuation: "market_prices"`, sourceIds `source.geostat_gdp_use_current`, `source.geostat_gdp_use_growth` (validation-only `source.geostat_gdp_use_volume`).

- [ ] **Step 1: Tests** — `prepareGdpExpenditure.test.ts`: (a) `--check` passes on the committed CSV; (b) row count: nominal 16 years × 16 ids (all but `households_npish`) = 256, share 256, growth 15 × 14 ids (all but households, npish, inventories) = 210 → 722 rows; (c) `gdp_use.households` 2025 nominal = `72267497536.51864…` from the cell text, share ≈ 69.09; `households_npish` 2025 growth ≈ 8.625; `inventories` 2017 nominal < 0; (d) `economy.gdp_total` nominal equals the Sectors CSV value for every year; (e) a tampered byte fails with the hash message; a changed row label fails; an identity off by 1 GEL fails.
- [ ] **Step 2:** run `npx vitest run tests/data/gdpExpenditure` → FAIL (module missing).
- [ ] **Step 3: Implement** following `prepareEconomicSectors.ts`: `readVerifiedPackageFile` first, exact cell text via the workbook XML (self-closing cell regex from `xlsx-parsing` memory), ×1,000,000 with 50-digit Decimal, `sharePercent`, `indexToGrowthPercent`; identities within 0.01 GEL (section 4 of the spec); growth vs constant-price ratio within `0.0000000001` pp (households_npish from table 10 row 4); write BOM CSV ordered by series id, measure (nominal, share_of_gdp, real_growth), year; report with hashes, counts and per-year identity differences.
- [ ] **Step 4:** run the tests and `npm run data:check-gdp-expenditure` → PASS.
- [ ] **Step 5:** commit `feat(data): GDP by expenditure canonical dataset`.

### Task 2: Serving loader and database mirror

**Files:**
- Create: `apps/web/lib/data/gdpExpenditure/importGdpExpenditure.ts`, `apps/web/prisma/migrations/20261020100000_gdp_expenditure/migration.sql`
- Modify: `apps/web/prisma/schema.prisma` (model `GdpExpenditureFact` = `EconomicSectorFact`'s columns; relations on `SourceDocument`/`ImportRun`), `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts` (load, subset, delete, create, parity, summary row), `data/sources/source-documents.csv` (3 rows), `docs/data-methodology/database-import.md`, `docs/deployment.md` (release checks: 722 rows, anchors 104.6 bn / households 72.3 bn)
- Test: `apps/web/tests/data/gdpExpenditure/importGdpExpenditure.test.ts`

**Interfaces:**
- Consumes: Task 1 CSV and validation.
- Produces: `GDP_EXPENDITURE: SectorDefinition[]`; `loadGdpExpenditureFacts(): Promise<SectorObservation[]>`; `loadServedGdpExpenditureData(): Promise<{ facts: ServedSectorObservation[] }>`; `assertGdpExpenditureParity(csv, db)`; `gdpExpenditureMirrorCreateRows(facts, importRunId)`; `loadGdpExpenditureFactsFromMirror(db)`; `loadGdpExpenditureFactsFromDb()`.

- [ ] **Step 1: Tests** — loader returns 722 facts; a CSV with a duplicate key or an unknown id throws; mirror create-rows → load-from-mirror round trip (fake client) is equal and `assertGdpExpenditureParity` passes; a changed value fails parity.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement after `importEconomicSectors.ts`, mirror functions after the economic-sector ones; `npx prisma generate`. **Step 4:** run tests + `npm run typecheck` → PASS. **Step 5:** commit `feat(data): serve and mirror GDP by expenditure`.

### Task 3: Sectors explorer accepts a page config

**Files:**
- Modify: `apps/web/lib/explorer/economicSectors.ts`, `apps/web/components/economic-sectors/{economic-sectors-explorer.tsx,sector-series-panel.tsx,use-economic-sectors-state.ts}`, `apps/web/lib/explorer/economicSectorsWorkbook.ts`, `apps/web/lib/explorer/colors.ts` (16 `gdp_use.*` colours, distinct, GDP stays ink)
- Test: `apps/web/tests/explorer/gdpExpenditureModel.test.ts`; existing `tests/explorer/economicSectors*.test.ts` must pass unchanged.

**Interfaces:**
- Produces:
  ```ts
  export type SectorPageConfig = {
    scope: "sectors" | "gdpExpenditure";          // message prefix
    defaultSelectedIds: string[];                  // Sectors: [SECTOR_GDP]
    measureStandIns: Record<string, string>;       // Sectors: {}; GDP use: households→households_npish, npish→households_npish, households_npish→households
    shareHeadlineId: string | null;                // Sectors: null (largest); GDP use: "gdp_use.households"
    ranked: boolean;                               // Sectors: true; GDP use: false (registry order + headings)
    highlights: boolean;                           // Sectors: true
  };
  export const SECTORS_PAGE_CONFIG: SectorPageConfig;
  ```
  `parseSectorHash(hash, validIds, config = SECTORS_PAGE_CONFIG)`, `changeSectorMeasure(state, measure, facts, config = SECTORS_PAGE_CONFIG)` (applies stand-ins, then drops ids with no fact in the new measure), `buildEconomicSectorsModel(facts, registry, state, sourceIdByMeasure, config = SECTORS_PAGE_CONFIG)` (adds `visibleIds`: registry ids with any fact in the measure), `EconomicSectorsExplorer` prop `config?: SectorPageConfig`, workbook builder last param `config = SECTORS_PAGE_CONFIG`.

- [ ] **Step 1: Tests** (GDP use registry + facts from Task 2): default state selects the six default ids; `changeSectorMeasure` to `real_growth` maps `households` → `households_npish` and drops nothing else; back to `nominal` maps it to `households`; parsing `#measure=real_growth&sel=gdp_use.households` yields `gdp_use.households_npish`; `visibleIds` in growth excludes households, npish, inventories; share headline = households 2025 ≈ 69.09; unranked rows keep registry order; Sectors defaults unchanged (`DEFAULT_SECTOR_STATE`, ranked order).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement; the panel passes `heading` (locale label) when `!config.ranked`, lists only `visibleIds`, `totalCount = visibleIds.length`; `t()` uses `config.scope`; `SectorHighlights` only when `config.highlights`. **Step 4:** run the new test and every `tests/explorer/*ector*` and `economicSectors*` test → PASS. **Step 5:** commit `feat(explorer): sector explorer page config`.

### Task 4: The page, navigation, hub card, messages, SEO

**Files:**
- Create: `apps/web/lib/pages/gdp-expenditure.tsx`, `apps/web/app/(ka)/explorer/economy/expenditure/page.tsx`, `apps/web/app/(en)/en/explorer/economy/expenditure/page.tsx`, `apps/web/lib/i18n/messages/{ka,en}/gdpExpenditure.json`
- Modify: `apps/web/lib/i18n/{types.ts,messages.server.ts,inventory.server.ts}`, `messages/{ka,en}/common.json` (`common.gdpExpenditure`: "დანახარჯები" / "Expenditure"), `messages/{ka,en}/gdp.json` (card title/description), `apps/web/lib/navigation/navTree.ts` (after sectors), `apps/web/lib/explorer/economyHubCards.ts` + `apps/web/lib/pages/economy.tsx` (card 03, regions becomes 04), `apps/web/lib/seo/{sitemap.ts,datasetVocabulary.ts}`, `apps/web/public/llms.txt`, `apps/web/lib/factQuery/buildSnapshot.ts` (exclude `source.geostat_gdp_use_*`), `navTree` source-note map (`common.geostatSourceNote`)
- Test: `apps/web/tests/explorer/gdpExpenditurePage.test.tsx`, plus count updates in `tests/navigation/navTree.test.ts`, `tests/seo/routes.test.ts`, `tests/explorer/economyHub.test.tsx`, `tests/site/datasetHubs.test.ts`, `tests/seo/agentFiles.test.ts` as they fail.

- [ ] **Step 1: Tests** — page renders heading "მშპ დანახარჯების მიხედვით" / "GDP by expenditure", headline "104.6" for 2025, the series list shows headings Consumption/Investment/Exports/Imports in ka and en, no highlights strip; hub card 03 footer contains "69.1%" and links to `/explorer/economy/expenditure`; nav lists Expenditure between Sectors and Regional economies; the workbook for ₾ 2017 has a negative inventories cell.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement after `lib/pages/economic-sectors.tsx` with `config={GDP_EXPENDITURE_PAGE_CONFIG}`; source-manifest reader dataset id `gdp-expenditure`. **Step 4:** run the new and touched tests, `npm run typecheck`, `npm run i18n:check` → PASS. **Step 5:** commit `feat(economy): GDP by expenditure page`.

### Task 5: Methodology page and source archive

**Files:**
- Create: `apps/web/lib/methodology/content/gdp-expenditure.ts`, `.../content/en/gdp-expenditure.ts`, `data/methodology/source-archives/gdp-expenditure.csv`
- Modify: `apps/web/lib/methodology/{types.ts,catalog.ts,sourceInventory.ts}`, `content/en/revisions.ts`, `apps/web/lib/pages/methodology-article.tsx` (four maps; downloads null/[]), `data/localization/en/{sources.json,documents.json,page-revisions.json}`, `data/methodology/decision-register.csv` (default selection, combined households growth, imports positive)
- Test: existing methodology tests (`tests/methodology/*`, `tests/i18n/methodologyCoverage.test.ts`) updated for the new id.

- [ ] **Step 1:** add the id to the tests' expected lists → FAIL. **Step 2:** write the content (spec section 5 points, plain words, both languages). **Step 3:** run `npx vitest run tests/methodology tests/i18n` → PASS. **Step 4:** commit `feat(methodology): GDP by expenditure`.

### Task 6: Scope docs, browser test, preview

**Files:**
- Modify: `Project_Definition.md` §2 (new item incl. the default-selection departure), `DESIGN.md` (§6.7 sidebar order, Economy hub cards paragraph, page entry, URL-state table row)
- Create: `apps/web/tests/browser/gdp-expenditure.spec.ts`; update browser page-count specs that list routes.

- [ ] **Step 1:** browser spec: ka + en load; six default lines; growth switch shows "Households and non-profits"; table mode; 375px heading line on one line; Excel download starts.
- [ ] **Step 2:** `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, serve on 3100, run the new spec and `main-explorer`/economy specs with `CI=1` → PASS.
- [ ] **Step 3:** screenshots (desktop + phone, ka; three measures; hub; methodology) to `/mnt/project-files/screenshots/gdp-expenditure/`; ask Duru (preview card). Full gates, push and PR only after Duru's OK.
