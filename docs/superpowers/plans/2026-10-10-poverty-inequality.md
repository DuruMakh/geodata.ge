# Poverty and Inequality Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual Poverty and inequality hub (`/explorer/poverty`, `/rates`, `/inequality`, `/methodology/poverty`) serving 491 reviewed Geostat values.

**Architecture:** Follows the Wages hub file by file (merged in PR #166, commit `3c9ad0eb`). That means an immutable research package under `docs/Raw Data/Poverty/`, a TypeScript prepare/check step that writes the canonical CSV, a loader with CSV/DB parity, a private Prisma mirror table, and one client explorer component for both pages built on the shared explorer shell. Every shared-file integration point copies the Wages addition in the same file. `git show 3c9ad0eb^2 -- <file>` or `git diff ab6045b1 3c9ad0eb -- <file>` shows what Wages added.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, Python 3 stdlib (research package), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-10-poverty-inequality-design.md`

## Global Constraints

- Yearly data only. No derived figures: no percentage-point changes, no counts of poor people, no estimates or interpolation.
- Under each page heading, only the one-line `LatestValueLine` (AGENTS.md UI contract; DESIGN.md §17). No summary block, no notes under the chart beyond one `SourceNote` line.
- Tabs are centred `TextTab`s: **Poverty line | Relative poverty | International lines**.
- Only the applicable first series is selected by default; it stays first, selectable and removable. Selection is unlimited; search never scopes the bulk action or the count.
- Percent values show one decimal; Gini shows two decimals on a 0–1 scale.
- Missing = gap / dash / blank Excel cell, never zero.
- Stable lowercase ASCII IDs only (spec §6). Labels are display data.
- Canonical CSV is UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule).
- No MCP tools or central JSON/CSV publications. The fact-query snapshot must not include poverty sources.
- Review before pushing: commit locally only. Screenshots go to Duru (Task 9), and only after Duru's OK do the full gates, push and the draft PR run (Task 11).
- Times told to Duru are in Tbilisi time (UTC+4).

## Review Focus

1. **A saved link from another tab** (`#tab=international&sel=settlement.rural`): unknown IDs are dropped, and an explicit empty `sel=` keeps an empty selection (Callout shown, download disabled), as on Wages. Owner: Task 4.
2. **A saved range ending 2025 on the International lines tab**, whose data ends in 2024: the range clamps to 2004–2024, and switching back to Poverty line keeps 2004–2024 rather than jumping. Owner: Task 4.
3. **Search for "village" / "სოფ"** reveals the nested Villages rows under both relative parents and keeps the bulk count at the top-level rows. Owner: Task 7 (browser).
4. **Gini formatting** in tooltip, table and Excel: two decimals, no "%" sign, Excel format `0.00`. Owner: Task 5 (workbook) and Task 7.
5. **Language switch** keeps tab, range, selection and chart/table mode. Owner: Task 7 (browser).

---

### Task 1: Research package

**Files:**
- Create: `docs/Raw Data/Poverty/geostat-poverty-annual/` with `official/` (the 4 xlsx, page capture `poverty-page-2026-10-10.html`, `0702_250526_EN.PDF` → `poverty-metadata-2026.pdf`, `0701_250526_EN.PDF` → `hies-metadata-2026.pdf`), `prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`, and generated `source-manifest.csv`, `source-manifest.json`, `poverty-annual.csv`, `coverage.csv`, `validation-report.json`, `independent-validation.json`

The originals are already downloaded in `/mnt/project-files/poverty-sources/`. Re-download each from its `retrieved_file_url` and confirm the SHA-256 matches before copying it in. The URLs are `https://www.geostat.ge/media/79296/302_Absolute-Poverty.xlsx`, `…/79294/301_Relative-Poverty.xlsx`, `…/76130/304_Poverty_Int_ENG_2021PPP.xlsx`, `…/79298/303_Gini-Coefficients.xlsx`, `…/79322/0702_250526_EN.PDF`, `…/79320/0701_250526_EN.PDF` and page `https://www.geostat.ge/en/modules/categories/192/living-conditions`. All were retrieved on 2026-10-10.

**Interfaces:**
- Produces: `poverty-annual.csv` with columns `year,indicator_id,group_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell,source_label,source_number_format`. Here `value` is the exact `<v>` token of the cell and `published_value` is that value rounded half-up to the decimals of `source_number_format`.
- Source IDs: `geostat_poverty_absolute`, `geostat_poverty_relative`, `geostat_poverty_international`, `geostat_gini`, `geostat_poverty_source_page`, `geostat_poverty_metadata_2026`, `geostat_hies_metadata_2026`.
- The cell map (sheet `1` in every workbook; `prepare.py` locates rows by label text, never by fixed row numbers):

| Indicator ID | Group IDs (unit) | Workbook / rows | Years |
| --- | --- | --- | --- |
| `poverty.absolute` | `settlement.urban`, `settlement.rural`, `age.0_17`, `age.18_64`, `age.65_plus`, `sex.female`, `sex.male`, `georgia` (percent) | 302: rows of year labels, columns B–I in that order (`'2015*'` → 2015) | 2004–2025 |
| `poverty.relative_60` / `poverty.relative_40` | `settlement.urban`, `settlement.rural`, `georgia` (percent) | 301: the Urban/Rural/Georgia rows under each "Share of population under 60/40 percent" header | 2004–2025 |
| `poverty.international_300/420/830` | `georgia` (percent) | 304: the three "Poverty headcount ratio" rows | 2004–2024 |
| `gini.total_income`, `gini.cash_inflows`, `gini.total_inflows`, `gini.consumption_expenditure`, `gini.cash_expenditure`, `gini.total_expenditure` | `georgia` (index) | 303: columns B–G in that order | 2006–2025 |

- [ ] **Step 1: Write `test_validation.py`.** Model it on the Wages one, stdlib `unittest` only. Tests:
  - `test_primary_count_is_491` checks counts 176/132/63/120.
  - `test_altered_cell_fails` patches one value and expects `prepare.validate` to raise.
  - `test_georgia_between_groups_fails_when_violated`.
  - `test_relative_40_above_60_fails`.
  - `test_international_order_fails`.
  - `test_page_values_match`: Georgia `poverty.absolute` 2016–2025 published values equal `["22.0","21.9","20.1","19.5","21.3","17.5","15.6","11.8","9.4","7.1"]`, and `gini.total_income` 2025 rounds to `0.34`.
  - `test_2015_footnote_kept`: the 2015 rows carry `source_label` containing `2015*`, and the README records the footnote "Base year of calculating poverty line."
  - `test_lari_lines_not_primary`: the 63 lari cells from 304 are absent from `poverty-annual.csv`.
- [ ] **Step 2: Run** `cd "docs/Raw Data/Poverty/geostat-poverty-annual" && python3 -m unittest test_validation -v`. Expected: FAIL (no `prepare` module).
- [ ] **Step 3: Implement `prepare.py`** (stdlib: `zipfile`, `xml.etree`, `decimal`, `hashlib`, `csv`, `json`). It parses sheet XML for exact tokens and the styles for number formats (`#,##0.0`, `0.0`, `0.00`), writes the manifest with SHA-256 and bytes, `poverty-annual.csv`, `coverage.csv` (indicator, group, first year, last year, count) and `validation-report.json` (`status`, counts, `imputed_values: 0`, `reconciliation_failed_count: 0`, per-source checks). `validate(rows)` enforces the spec §6 checks: 0–100 and 0–1 ranges; Georgia between urban/rural, female/male and min/max of the ages (absolute) and between urban/rural (both relative measures); 40 ≤ 60; $3.00 ≤ $4.20 ≤ $8.30; the page values. Every check runs on exact `value`.
- [ ] **Step 4: Implement `verify_independent.mjs`.** It re-reads each xlsx with the repo's `xlsx` package (`createRequire` from `apps/web`), compares all 491 values and the counts, and writes `independent-validation.json` with `status: "passed"`.
- [ ] **Step 5: Run** `python3 prepare.py && python3 -m unittest test_validation -v && node verify_independent.mjs`. Expected: all PASS, and `validation-report.json` reads `"status": "passed"` with `primary_observation_count: 491`.
- [ ] **Step 6: Write `README.md`.** Cover the files, URLs, retrieval date, cell map, checks, the 2015 footnote, Gini-from-2006 vs metadata-from-1997, and the World Bank attribution on 304. Then commit `feat(data): archive reviewed Geostat poverty and Gini workbooks`.

### Task 2: Canonical serving file

**Files:**
- Create: `apps/web/lib/data/poverty/types.ts`, `validation.ts`, `preparePoverty.ts`, `apps/web/scripts/prepare-poverty.ts`, `apps/web/tests/data/poverty/poverty.test.ts`, generated `data/imports/poverty-annual.csv`, `data/reports/poverty-validation.json`
- Modify: `apps/web/package.json` (scripts `data:prepare-poverty`, `data:check-poverty`; append `&& npm run data:check-poverty` to `data:validate`)

**Interfaces:**
- Produces (in `types.ts`):
  - `POVERTY_INDICATORS` (the 12 IDs above, in spec order), `PovertyIndicator`, `POVERTY_GROUPS` (8 IDs), `PovertyGroup`, `POVERTY_SOURCES` (the 4 workbook IDs), `POVERTY_PUBLIC_SOURCES` (all 7)
  - `PovertyFact = { year; indicatorId; groupId; value: string; publishedValue: string; unit: "percent" | "index"; basis: "actual"; valueStatus: "survey_estimate"; sourceId; sourceSheet; sourceCell; sourceNumberFormat: string; lastReviewedAt }`
  - `ClientPovertyFact = Pick<…, "year" | "indicatorId" | "groupId" | "sourceId"> & { value: number; decimals: number }`
  - `PovertyAcceptance` (Wages shape without `unavailableObservations`), `povertyFactKey(f) => \`${indicatorId}:${groupId}:${year}\``, `povertySourceDocumentId(id) => \`source.${id}\``
- Produces (in `validation.ts`): `expectedPovertyKeys(): Set<string>` from the cell map's years, `povertyDisplayDecimals(format: string): number`, and `validatePovertyFacts(facts): void`. The latter applies the Wages identity/coverage/duplicate/source-contract/published-rounding checks plus the spec §6 range and ordering checks.
- Produces (in `preparePoverty.ts`): `preparePovertyData(repositoryRoot, mode: "write" | "check")` and `POVERTY_CSV_HEADERS = ["year","indicator_id","group_id","value","published_value","unit","basis","value_status","source_id","source_sheet","source_cell","source_number_format","last_reviewed_at"]`. `REVIEWED_AT = "2026-10-10"`.

- [ ] **Step 1: Write `tests/data/poverty/poverty.test.ts`.** Model it on `tests/data/wages/wages.test.ts`:
  - `preparePovertyData(root, "check")` resolves.
  - The canonical file has 491 rows.
  - `validatePovertyFacts` rejects each of: an altered `publishedValue`, a duplicate, a missing key, a 2025 `poverty.international_300` row, a 2005 Gini row, `value` 101 percent, Gini `1.2`, Georgia outside urban/rural, `relative_40 > relative_60`, `international_420 < international_300`.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/poverty/poverty.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `types.ts`, `validation.ts` and `preparePoverty.ts`** by mirroring `lib/data/wages/*`: verified package reads via `readVerifiedPackageFile`, cell re-reads via `fflate` + `XLSX`, a research report gate, and `assertGeneratedArtifactMatches("poverty", …)`. Add `scripts/prepare-poverty.ts` (copy of `prepare-wages.ts`) and the package scripts.
- [ ] **Step 4: Run** `npm run data:prepare-poverty && npm run data:check-poverty && npx vitest run tests/data/poverty/poverty.test.ts`. Expected: `{"status":"passed","scope":"poverty_annual"}` and tests PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed annual poverty and Gini data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create: `apps/web/lib/data/poverty/importPoverty.ts`, `apps/web/prisma/migrations/20261010180000_poverty/migration.sql`
- Modify: `apps/web/prisma/schema.prisma` (`PovertyFact`), `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `data/sources/source-documents.csv` (7 rows, as Wages added its 12)
- Test: extend `apps/web/tests/data/poverty/poverty.test.ts`

**Interfaces:**
- Consumes: Task 2 types and validation.
- Produces: `loadPovertyFacts(): Promise<PovertyFact[]>`, `assertPovertyParity(csv, mirror): void`, `loadServedPovertyData(): Promise<{ facts: PovertyFact[] }>`, `toClientPovertyFact(f): ClientPovertyFact` (value = `Number(publishedValue)`), `loadPovertyFactsFromDb()` in `servedDataDb.ts`, and the mirror-row mapper and import comparison named like the Wages ones.
- `PovertyFact` model: Wages columns minus `dimension`/`sectorId`, `value`/`publishedValue` non-null `Decimal @db.Decimal(30, 20)`, `@@id([indicatorId, groupId, year])`, the `sourceDocument` and `importRun` relations. The migration enables RLS and revokes public grants exactly as `20261010060000_wages/migration.sql` does.

- [ ] **Step 1: Add the parity tests.**
  - `assertPovertyParity` passes on identical arrays and on `"7.10"` vs `"7.1"`, and throws on a changed value or a missing row.
  - `loadPovertyFacts` throws when the CSV fingerprint differs from the report (use a temp copy, as the Wages test does).
  - `toClientPovertyFact` gives `decimals` 1 for percent rows and 2 for Gini.
- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement `importPoverty.ts`, the schema and migration, and the mirror/import additions**, copying each Wages addition in the same file. Run `npx prisma validate` and `npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/poverty/poverty.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed poverty data with exact parity`.

### Task 4: Explorer model and state

**Files:**
- Create: `apps/web/lib/explorer/poverty.ts`, `apps/web/tests/explorer/poverty.test.ts`

**Interfaces:**
- Consumes: `ClientPovertyFact`.
- Produces:
  - `POVERTY_SECTIONS = [{ id: "rates", href: "/explorer/poverty/rates", labelKey: "common.povertyRates" }, { id: "inequality", href: "/explorer/poverty/inequality", labelKey: "common.povertyInequality" }] as const` and `PovertySectionId`
  - `PovertyView = "absolute" | "relative" | "international" | "main"` and `povertyViews(section)`, which returns the three rate views or `["main"]`
  - `PovertySeriesDefinition = { id: string; indicatorId; groupId; reference: boolean; parentId?: string }`
  - `povertyViewSeries(section, view)` with series IDs `\`${indicatorId}|${groupId}\``:
    - absolute: Georgia (reference), then 7 children with `parentId` set to Georgia's ID, in the order urban, rural, 0_17, 18_64, 65_plus, female, male
    - relative: 60 Georgia (reference) with urban and rural children, then 40 Georgia (top-level, not reference) with urban and rural children
    - international: 300 (reference), 420, 830
    - main: `gini.total_income` (reference), then the other five in spec order
  - `povertyCoverage(section, view, facts) => { min, max, years }`
  - `PovertyState = { mode: "line" | "table"; range: PeriodRange; view: PovertyView; selectedIds: string[] }`, with `defaultPovertyState`, `parsePovertyHash`, `serializePovertyHash` (tab key `tab`, only when the section has more than one view) and `changePovertyView`, all mirroring Wages
  - `PovertySeriesModel`, `PovertyModel`, and `buildPovertyModel(section, facts, state)`, where `decimals` is 2 for `main` and 1 otherwise
  - `povertySeriesColor` uses `INK` for the reference and `colorForItem(id, index)` otherwise

- [ ] **Step 1: Write the tests.**
  - Default rates state: view `absolute`, selection `["poverty.absolute|georgia"]`, coverage 2004–2025.
  - International coverage is 2004–2024, and Gini coverage is 2006–2025.
  - `changePovertyView` to `international` from range 2010–2025 gives 2010–2024 and selects only `$3.00`. Changing back to `absolute` keeps 2010–2024 (Review Focus 2).
  - Hash round-trip, including an explicit empty `sel=`, and `#tab=international&sel=poverty.relative_60|settlement.rural` → selection `[]` (Review Focus 1).
  - An unknown `tab` falls back to `absolute`, and the inequality hash never writes `tab`.
  - Relative nesting: four children, two top-level parents.
  - `buildPovertyModel` end value for Georgia absolute 2025 is `7.1`, Gini total income 2025 is `0.34`, and `decimals` is 2 on inequality.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/poverty.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `poverty.ts`.** Reuse `resolveRange`, `refitRange(…, { collapseToAll: true })`, `parseYearRangeKeys` and `writeYearRangeKeys`.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat: model poverty tabs, nesting and state`.

### Task 5: Excel workbook and hub cards

**Files:**
- Create: `apps/web/lib/explorer/povertyWorkbook.ts`, `apps/web/lib/explorer/povertyHubCards.ts`
- Test: extend `apps/web/tests/explorer/poverty.test.ts`

**Interfaces:**
- Produces:
  - `buildPovertyWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title? }, presentation): WorkbookExportModel`, mirroring `wagesWorkbook.ts`. Filename `poverty-${section}${view === "main" ? "" : `-${view}`}-${start}-${end}`. The unit label is `poverty.unitPercent` or `poverty.unitIndex`. `numberFormat` is `"0.0"` for percent and `"0.00"` for Gini. Status is `poverty.status.survey_estimate`.
  - `buildPovertyHubCards(facts, presentation): HubCardModel[]` gives two cards with sparklines: Georgia `poverty.absolute` and `gini.total_income`. The footer reads `"2025 · 7.1% · 2004–2025"` and `"2025 · 0.34 · 2006–2025"`.

- [ ] **Step 1: Write the tests.**
  - A workbook for the International tab, 2020–2024, with all three selected has 3 readable rows × 5 years, the source list is only `geostat_poverty_international`, and numberFormat is `0.0`.
  - An inequality workbook uses `0.00` and its values have 2 decimals (Review Focus 4).
  - The hub cards have the two footers above.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: export poverty to Excel and build hub cards`.

### Task 6: Messages and i18n wiring

**Files:**
- Create: `apps/web/lib/i18n/messages/ka/poverty.json`, `apps/web/lib/i18n/messages/en/poverty.json`
- Modify: `lib/i18n/messages/{ka,en}/common.json` (`poverty`, `povertyRates`, `povertyInequality`), `lib/i18n/types.ts`, `lib/i18n/messages.server.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json` (new routes)

Keys in `poverty.json` (mirror `wages.json`): `title`, `hubSummary`, `metaTitle`, `metaDescription`, `page.rates.title|summary`, `page.inequality.title|summary`, `tabs`, `tab.absolute|relative|international`, `series.<indicator>|<group>` for every series ID, `unitPercent` ("%"), `unitIndex`, `latest.rates`, `latest.inequality`, `sourceNote`, `sourceNoteInternational`, `methodology`, `search`, `series`, `amountHeader`, `status.survey_estimate`, `emptySelection`, `nestedSelected`, `subcategoriesFor`, `annual`.

The Georgian proposals are as follows; final wording follows the catalogue conventions:
- hub: სიღარიბე და უთანასწორობა
- pages: სიღარიბე, უთანასწორობა
- tabs: სიღარიბის ზღვარი | ფარდობითი სიღარიბე | საერთაშორისო ზღვრები
- groups: საქართველო, ქალაქი, სოფელი, 0–17 წლის, 18–64 წლის, 65 წლის და უფროსი, ქალები, კაცები

- [ ] **Step 1: Run** `npm run i18n:check`. Expected: FAIL (new namespace not inventoried) after adding the files.
- [ ] **Step 2: Wire the namespace** as Wages did. **Step 3: Run** `npm run i18n:check && npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: add Georgian and English poverty copy`.

### Task 7: Pages, component, navigation and SEO

**Files:**
- Create: `apps/web/components/poverty/poverty-explorer.tsx`, `apps/web/lib/pages/poverty.tsx`, routes `app/(ka)/explorer/poverty/{page,rates/page,inequality/page}.tsx` and the `app/(en)/en/explorer/poverty/…` mirrors, `apps/web/tests/browser/poverty.spec.ts`
- Modify: `components/shell/data-sidebar.tsx` (after Wages; `povertyActive` joins the `budgetActive` exclusions), `components/shell/explorer-footer.tsx`, `lib/seo/sitemap.ts`, `tests/seo/routes.test.ts`, the browser page-count assertions Wages touched (`bilingual-complete.spec.ts`, `seo.spec.ts`)

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:
  - `PovertyExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin })`, which mirrors `WagesExplorer` minus the region and heatmap branches
  - centred `TextTab` row (`data-testid="poverty-tab-${view}"`), shown only on `rates`
  - `LatestValueLine testId="poverty-latest"`: Georgia absolute on rates, Gini total income on inequality
  - `SourceNote` naming the World Bank on the international tab
  - `renderPovertyHub`, `povertyHubMetadata`, `renderPovertyPage(locale, section)`, `povertyPageMetadata`

- [ ] **Step 1: Write `tests/browser/poverty.spec.ts`.**
  - The hub shows two cards.
  - On `/explorer/poverty/rates` the default is tab `absolute` with one selected row, and the latest line contains `7.1`.
  - Clicking `poverty-tab-international` leaves a range slider ending at 2024.
  - Table mode shows Georgia first.
  - Searching `სოფ` shows two Villages rows on the Relative tab while the series count stays `1 / 2` (Review Focus 3).
  - `/explorer/poverty/inequality` shows `0.34` and no tabs.
  - The Excel download fires a `.xlsx`.
  - Switching to `/en` keeps the hash (Review Focus 5).
  - At 390 px there is no horizontal scroll.
- [ ] **Step 2: Implement** the component, pages, routes, sidebar, footer and sitemap. Extend `tests/seo/routes.test.ts` with the 6 new routes.
- [ ] **Step 3: Run** `npx vitest run tests/seo/routes.test.ts tests/explorer/poverty.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Run** `npx playwright test tests/browser/poverty.spec.ts` against `next dev`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add bilingual poverty and inequality explorer`.

### Task 8: Methodology page and source archive

**Files:**
- Create: `apps/web/lib/methodology/content/poverty.ts`, `apps/web/lib/methodology/content/en/poverty.ts`, `data/methodology/source-archives/poverty.csv`
- Modify: `lib/methodology/types.ts` (`"poverty"` in `LIVE_METHODOLOGY_IDS`), `lib/methodology/catalog.ts`, `lib/methodology/sourceInventory.ts`, `lib/methodology/content/en/revisions.ts`, `lib/pages/methodology-article.tsx`, `data/localization/en/documents.json`, `data/methodology/decision-register.csv`, `lib/factQuery/buildSnapshot.ts` (keep poverty sources out, as Wages did), and the tests Wages touched: `tests/methodology/catalog.test.ts`, `tests/methodology/prepareArchives.test.ts`, `tests/i18n/methodologyCoverage.test.ts`, `tests/factQuery/buildSnapshot.test.ts`, `tests/browser/methodology.spec.ts`, `tests/browser/bilingual-methodology.spec.ts`

The content covers spec §5 rules 1–7 and §7 in plain words. It describes the absolute poverty line only in Geostat's published words. It includes the 2025 confidence interval 6.3–7.9, the 2017 survey change, the six Gini footnote definitions, the World Bank attribution and Gini-from-2006.

- [ ] **Step 1: Update the catalogue, archive and snapshot tests** to expect `poverty`. **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, then run `npm run data:check-methodology-archives` and the methodology tests. Expected: PASS. Confirm `buildSnapshot.test.ts` passes, with no poverty source in the snapshot.
- [ ] **Step 4: Commit** `feat: publish poverty methodology and original sources`.

### Task 9: Screenshots for Duru (stop point)

- [ ] **Step 1:** Run `npm run build && npm run start -- --port 3100` with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`. Capture these into `/mnt/project-files/screenshots/poverty/`:
  - ka and en at 1440: hub, rates on each of the three tabs, rates in table mode, inequality, methodology
  - ka at 390: rates and inequality
- [ ] **Step 2:** Reply to Duru with the screenshots attached and ask a yes/no question. **Wait.** Apply any requested changes, re-capture, and ask again.

### Task 10: Scope and design documents

**Files:**
- Create: `docs/data-methodology/poverty-annual.md` (package, IDs, checks, serving and export rules)
- Modify: `Project_Definition.md` §2 (a new approved Poverty and inequality item, worded like the Wages one), `DESIGN.md` (hub and two pages), `docs/deployment.md` (if the Wages edit there lists mirror tables, add `PovertyFact`)

- [ ] **Step 1:** Write the documents. **Step 2:** Run `npm run i18n:check` (page review dates). **Step 3:** Commit `docs: record the poverty and inequality hub`.

### Task 11: Full gates and delivery (only after Duru's OK in Task 9)

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`. If Current account (#172) has merged, resolve the sidebar, sitemap, methodology catalogue, mirror and page-count conflicts by keeping both sides.
- [ ] **Step 2:** Run `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100` with `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`. Expected: all green.
- [ ] **Step 3:** `git push -u origin claude/project-thread-36ddf7`. Open a draft PR with the attribution block and assign and request review from DuruMakh. Subscribe to PR activity and drive CI to green.
- [ ] **Step 4:** Reply with the PR link. Merging releases to production, so that waits for Duru.
