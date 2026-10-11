# Living Standards Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual Living standards hub (`/explorer/living-standards`) with new Income and Spending pages from Geostat's household survey tables. It also moves the existing Poverty and Inequality pages into the hub, with redirects from their old addresses.

**Architecture:** The new Income and Spending data follows the Poverty hub file by file. Poverty was merged in PR #174; `git diff b733c26^1 b733c26 -- <file>` shows exactly what Poverty added to each shared file. That gives:
- an immutable research package;
- a TypeScript prepare/check step that writes the canonical CSV;
- a loader with CSV/DB parity and a private Prisma mirror table;
- one client explorer component serving both new pages.

The Poverty code keeps its IDs and behaviour. Only its addresses, breadcrumb and hub move.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, Python 3 stdlib (research package), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-11-living-standards-design.md`

## Global Constraints

- Yearly data only. Each value is Geostat's printed average month of a year. No derived figures: no shares, inflation adjustment, interpolation or values we compute.
- Under each page heading, only the one-line `LatestValueLine`. The hub heading gets one short line. There is no summary block and no note under the chart beyond one `SourceNote` line.
- Tabs are centred `TextTab`s: Income **Where it comes from | Compare areas**; Spending **What it's spent on | Compare areas**.
- Only the first series is selected by default. It stays first, selectable and removable. Selection is unlimited, and search never scopes the bulk action or the count.
- Values are ₾ a month with one decimal. Missing values are a gap, a dash or a blank Excel cell, never zero.
- Use stable lowercase ASCII IDs only (spec §6). Labels are display data.
- The canonical CSV is UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule).
- No MCP tools or central publications. The fact-query snapshot must exclude every `source.geostat_household_*` source.
- Poverty and Inequality pages keep their content and behaviour exactly; only their address and breadcrumb change.
- Review before pushing: commit locally only. A live preview goes to Duru (Task 9). Only after Duru's OK do the full gates, push and draft PR run (Task 11).
- Times told to Duru are in Tbilisi time (UTC+4).

## Review Focus

1. **An old bookmarked link** (`/en/explorer/poverty/rates#tab=relative&sel=…`) lands on `/en/explorer/living-standards/poverty` with the same tab and selection. Owner: Task 7 (browser, against `next start`).
2. **A region with no data in the chosen years**: Guria on "Where it comes from" with a saved range of 2011–2016. The range refits to Guria's 2019–2025 rather than drawing an empty chart. Switching back to Georgia keeps 2019–2025. Owner: Task 4.
3. **Switching area or per household / per person keeps the ticked lines**, and switching tab resets to the first series. Owner: Task 4.
4. **Imereti 2011–2018 and the four 2019-start regions** in the Compare areas table: dashes before 2019 for the four, numbers for Imereti, and nothing for "Other regions". Owner: Task 7 (browser).
5. **Language switch** keeps tab, area, per household / per person, range, selection and mode. Owner: Task 7 (browser).

---

### Task 1: Research package

**Files:**
- Create `docs/Raw Data/Households/geostat-household-income-spending-annual/` containing:
  - `official/`: the 18 English workbooks, renamed lowercase with hyphens (for example `104-income-per-household.xlsx`); the Georgian `104–109` and `204–209` under `official/ka/`; page captures `income-page-2026-10-11.html` and `spending-page-2026-10-11.html`; and `hies-metadata-2026.pdf` (copied from the Poverty package)
  - `prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`
  - generated `source-manifest.csv`/`.json`, `household-income-spending-annual.csv`, `coverage.csv`, `validation-report.json`, `independent-validation.json`

The English workbooks are already in `/mnt/project-files/household-sources/`. Re-download each from `https://geostat.ge/media/<id>/<name>`:
- 101–109 are media 79260–79268, in that order.
- 201–209 are media 79278–79286.
- The Georgian files are listed on `https://www.geostat.ge/ka/modules/categories/50` and `/51`.
- The pages are `https://www.geostat.ge/en/modules/categories/50` and `/51`.

Confirm the SHA-256 of each re-download matches the shared copy. Retrieved 2026-10-11.

**Interfaces:**
- Source IDs follow the pattern `geostat_household_<income|spending>_<household|capita|population>_<national|settlement|region>`, 18 in all; for example 104 = `geostat_household_income_household_national`. The other IDs are `geostat_household_income_page`, `geostat_household_spending_page` and `geostat_household_hies_metadata_2026`. The Georgian files are kept in the package but are not manifest sources.
- `household-income-spending-annual.csv` columns: `year,indicator_id,area_id,measure,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell,source_label,source_number_format`. `value` is the exact `<v>` token, and `published_value` is that value rounded half-up to the cell format (`#,##0.0` or `0.0`, giving one decimal).
- Served rows come only from 104–109 and 204–209 (spec §6 table: 10,638 rows).
- Row labels map to IDs by exact text:

| Workbook row label | ID |
| --- | --- |
| `1. Income, total (2+3)` | `income.total` |
| `Wages and salaries` | `income.wages` |
| `From self-employment` | `income.self_employment` |
| `From selling agricultural production` | `income.agriculture_sales` |
| `Property income (leasing, interest on deposit…` (prefix) | `income.property` |
| `Pensions, scholarships, assistances` | `income.pensions_assistance` |
| `Remittances from abroad` | `income.remittances` |
| `Money received as gift` | `income.gifts` |
| `3. Non-cash income` | `income.non_cash` |
| `4. Other cash inflows` | `income.other_inflows` |
| `Borrowing and dissaving` | `income.borrowing_dissaving` |
| `Property disposal` | `income.property_disposal` |
| `1. Consumption expenditure, total (2+3)` | `spending.consumption` |
| `On food, beverages, tobacco` | `spending.food` |
| `On clothes and footwear` | `spending.clothing` |
| `On household goods` | `spending.household_goods` |
| `On healthcare` | `spending.health` |
| `Housing, water, electricity, gas and other fuels` | `spending.housing_utilities` |
| `On transport` | `spending.transport` |
| `On education` | `spending.education` |
| `Other consumption expenditure` | `spending.other_consumption` |
| `3. Non-cash expenditure` | `spending.non_cash` |
| `4. Cash non-consumption expenditure` | `spending.non_consumption` |
| `On agriculture` | `spending.agriculture` |
| `On transfers` | `spending.transfers` |
| `On saving and lending` | `spending.saving_lending` |
| `On property acquirement` | `spending.property` |

  The check-only lines are `2. Cash income and transfers`, `5. Cash inflows, total (2+4)`, `6. Cash and non-cash inflows, total (3+5)`, `2. Cash consumption expenditure`, `5. Cash expenditure, total (2+4)` and `6. Expenditure, total (3+5)`.
- Area columns:
  - National files: `georgia`, years from the header row.
  - Settlement files: blocks headed `Urban` / `Rural` → `settlement.urban` / `settlement.rural`.
  - Regional files: year blocks with region columns. `Kakheti` → `region.kakheti`, `Tbilisi` → `region.tbilisi`, `Shida Kartli` → `region.shida_kartli`, `Kvemo Kartli` → `region.kvemo_kartli`, `Samtskhe-Javakheti` → `region.samtskhe_javakheti`, `Adjara A.R.` → `region.adjara`, `Guria` → `region.guria`, `Samegrelo-Zemo Svaneti` → `region.samegrelo_zemo_svaneti`, `Imereti*` → `region.imereti`, `Mtskheta-Mtianeti` → `region.mtskheta_mtianeti`, `Racha-Lechkhumi and Kvemo Svaneti` → `region.racha_lechkhumi_kvemo_svaneti`.
  - `Other regions**` and the regional `Georgia` column are read for checks only.
- `measure` is `per_household` for 104–106 and 204–206, and `per_capita` for 107–109 and 207–209. `unit` is always `gel_month`.

- [ ] **Step 1: Write `test_validation.py`** (stdlib `unittest`, modelled on the Poverty one):
  - `test_primary_count_is_10638`: counts are 4,728 income and 5,910 spending.
  - `test_altered_cell_fails`
  - `test_parts_sum_to_totals_fails_when_violated`: tolerance `1e-6` on exact values (measured max error is 6e-8).
  - `test_georgia_between_urban_and_rural_fails_when_violated`
  - `test_regional_georgia_column_equals_national_fails_when_violated`
  - `test_placeholder_cells_not_served`: no row for the four regions before 2019 and no `Other regions` row.
  - `test_page_values_match`: 2025 Georgia per household `income.total` publishes `2025.8` and `spending.consumption` publishes `1438.7`.
  - `test_footnotes_kept`: the Imereti and "…" footnotes appear in `validation-report.json`.
- [ ] **Step 2: Run** `cd "docs/Raw Data/Households/geostat-household-income-spending-annual" && python3 -B -m unittest test_validation -v`. Expected: FAIL (no `prepare` module).
- [ ] **Step 3: Implement `prepare.py`.** Load the unemployment package's `read_sheet`, `clean` and `csv_bytes` as the Poverty `prepare.py` does. Locate rows by label text and blocks by their header text, never by fixed row numbers. `validate(rows, checks)` enforces spec §6 rules 1–6:
  - Sum checks: total = the 7 cash sources + `non_cash`, `other_inflows` = its 2 parts, the cash subtotal and the unserved 5 and 6 lines; for spending, the 8 categories + `non_cash` and `non_consumption` = its 4 parts.
  - Georgia between urban and rural for every line, measure and year.
  - Georgia within min–max of the regional columns, including `Other regions` before 2019.
  - The regional `Georgia` column equals the national value within `1e-9`.
  - No negatives.
  - The 2025 page values.

  Write the manifest, the CSV, `coverage.csv` (indicator, area, measure, first year, last year, count) and `validation-report.json` with `status`, counts, `imputed_values: 0`, `reconciliation_failed_count: 0` and `footnotes`. Support `--check` as Poverty does.
- [ ] **Step 4: Implement `verify_independent.mjs`.** It re-reads the 12 served workbooks with the repo `xlsx` package using its own label tables. It matches all 10,638 values and requires every numeric cell in the served rows of those workbooks to be extracted or listed as check-only. Negative controls cover an altered value, a dropped row, swapped areas and a shifted year. It writes `independent-validation.json` `status: "passed"`.
- [ ] **Step 5: Run** `python3 -B prepare.py && python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs`. Expected: all PASS, with `validation-report.json` reading `"status": "passed"` and `primary_observation_count: 10638`.
- [ ] **Step 6: Write `README.md`** covering files, URLs, the retrieval date, the label map, the checks, the two footnotes, why 101–103/201–203 and the sum lines are archived but not served, and the 2017 survey change. Commit `feat(data): archive reviewed Geostat household income and spending workbooks`.

### Task 2: Canonical serving file

**Files:**
- Create: `apps/web/lib/data/household/types.ts`, `validation.ts`, `prepareHousehold.ts`; `apps/web/scripts/prepare-household-income.ts`; `apps/web/tests/data/household/household.test.ts`; generated `data/imports/household-income-spending-annual.csv` and `data/reports/household-income-spending-validation.json`
- Modify: `apps/web/package.json`: add scripts `data:prepare-household-income` and `data:check-household-income`, and append `&& npm run data:check-household-income` to `data:validate`

**Interfaces:**
- Produces in `types.ts`:
  - `HOUSEHOLD_INCOME_INDICATORS` (12, spec order) and `HOUSEHOLD_SPENDING_INDICATORS` (15); `HOUSEHOLD_INDICATORS` is both and `HouseholdIndicator` is its type.
  - `HOUSEHOLD_AREAS = ["georgia", "settlement.urban", "settlement.rural", ...WAGES_REGIONS] as const` (import `WAGES_REGIONS` from `../wages/types`, reuse not copy) and `HouseholdArea`.
  - `HOUSEHOLD_MEASURES = ["per_household", "per_capita"] as const` and `HouseholdMeasure`.
  - `HOUSEHOLD_SOURCES` (12 served IDs) and `HOUSEHOLD_PUBLIC_SOURCES` (all 21).
  - `HouseholdFact = { year; indicatorId: HouseholdIndicator; areaId: HouseholdArea; measure: HouseholdMeasure; value: string; publishedValue: string; unit: "gel_month"; basis: "actual"; valueStatus: "survey_estimate"; sourceId; sourceSheet; sourceCell; sourceNumberFormat; lastReviewedAt }`.
  - `ClientHouseholdFact = Pick<HouseholdFact, "year" | "indicatorId" | "areaId" | "measure"> & { value: number }`. No `sourceId`, because it is derivable and keeps the page payload small.
  - `householdFactKey(f) => \`${indicatorId}:${areaId}:${measure}:${year}\``.
  - `householdSourceId(indicatorId, areaId, measure): string`, which derives the served source ID.
  - `HouseholdAcceptance` (Poverty shape).
- Produces in `validation.ts`: `expectedHouseholdKeys(): Set<string>` (Georgia 2002–2025, settlements 2006–2025, regions 2011–2025 except the four 2019-start regions) and `validateHouseholdFacts(facts): void`. The latter applies the Poverty identity, coverage, duplicate, source-contract and published-rounding checks plus spec §6 rules 2, 3, 5 and 6 on served rows: parts sum to the served totals within `1e-6`, Georgia lies between urban and rural, there are no negatives, and the 2025 values match.
- Produces in `prepareHousehold.ts`: `prepareHouseholdData(repositoryRoot, mode: "write" | "check")` and `HOUSEHOLD_CSV_HEADERS = ["year","indicator_id","area_id","measure","value","published_value","unit","basis","value_status","source_id","source_sheet","source_cell","source_number_format","last_reviewed_at"]`, with `REVIEWED_AT = "2026-10-11"`. It mirrors `preparePoverty.ts` line for line, and the generated-artifact label is `"household-income"`.

- [ ] **Step 1: Write `tests/data/household/household.test.ts`** (model: `tests/data/poverty/poverty.test.ts`):
  - `prepareHouseholdData(root, "check")` resolves, and the canonical file has 10,638 rows.
  - `validateHouseholdFacts` rejects each of these: an altered `publishedValue`, a duplicate, a missing key, a `region.guria` 2018 row, a 2001 row, a negative value, `income.wages` raised by 1 (breaking the sum), Georgia above both urban and rural, and a 2025 `income.total` of `2025.9`.
  - `householdSourceId("spending.food", "region.tbilisi", "per_capita")` is `"geostat_household_spending_capita_region"`.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/household/household.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules, the script (copy `scripts/prepare-poverty.ts`) and the package scripts.
- [ ] **Step 4: Run** `npm run data:prepare-household-income -- --write && npm run data:check-household-income && npx vitest run tests/data/household/household.test.ts`. Expected: `{"status":"passed",…}` and PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed household income and spending data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create: `apps/web/lib/data/household/importHousehold.ts`, `apps/web/prisma/migrations/20261011090000_household_income_spending/migration.sql`
- Modify: `apps/web/prisma/schema.prisma`, `lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `scripts/import-budget-facts.ts`, `data/sources/source-documents.csv` (21 rows). In each, copy the Poverty addition (`git diff b733c26^1 b733c26 -- <file>`).
- Test: extend `tests/data/household/household.test.ts`

**Interfaces:**
- Consumes: Task 2 types and validation.
- Produces:
  - `loadHouseholdFacts(): Promise<HouseholdFact[]>`
  - `assertHouseholdParity(csv, mirror): void`
  - `loadServedHouseholdData(): Promise<{ facts: HouseholdFact[] }>`
  - `toClientHouseholdFact(f): ClientHouseholdFact`, with `value = Number(publishedValue)`
  - `loadHouseholdFactsFromDb()` and the mirror-row mapper and import comparison, named like the Poverty ones
- Model `HouseholdIncomeSpendingFact`: the Poverty columns with `groupId` replaced by `areaId` plus `measure String`, and `@@id([indicatorId, areaId, measure, year])`. The migration copies `20261010180000_poverty/migration.sql` including RLS and the revoked grants.

- [ ] **Step 1: Add parity tests.** Identical arrays pass, `"2025.80"` vs `"2025.8"` passes, and a changed value or a missing row throws. `loadHouseholdFacts` throws on a fingerprint mismatch (temp copy, as in the Poverty test).
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement.** Run `npx prisma validate && npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/household/household.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed household data with exact parity`.

### Task 4: Explorer model and state

**Files:**
- Create: `apps/web/lib/explorer/household.ts`, `apps/web/lib/explorer/livingStandards.ts`, `apps/web/tests/explorer/household.test.ts`
- Modify: `apps/web/lib/explorer/poverty.ts` (`POVERTY_SECTIONS` hrefs → `/explorer/living-standards/poverty` and `/explorer/living-standards/inequality`; section IDs stay `rates` and `inequality`), `apps/web/tests/explorer/poverty.test.ts` (expected hrefs)

**Interfaces:**
- Produces in `livingStandards.ts`:
  - `LIVING_STANDARDS_HUB_PATH = "/explorer/living-standards"`
  - `LIVING_STANDARDS_SECTIONS = [...HOUSEHOLD_SECTIONS, ...POVERTY_SECTIONS]` (4 entries, each `{ id, href, labelKey }`)
- Produces in `household.ts`:
  - `HOUSEHOLD_SECTIONS = [{ id: "income", href: "/explorer/living-standards/income", labelKey: "common.householdIncome" }, { id: "spending", href: "/explorer/living-standards/spending", labelKey: "common.householdSpending" }] as const`, plus `HouseholdSectionId`
  - `HouseholdView = "parts" | "areas"`
  - `HouseholdSeriesDefinition = { id: string; indicatorId: HouseholdIndicator; areaId: HouseholdArea; reference: boolean; parentId?: string }`
  - `householdViewSeries(section, view, area)`:
    - `parts`: series ID = indicator ID. Income has `income.total` (reference) with 8 children in spec order, then `income.other_inflows` (top-level) with `borrowing_dissaving` and `property_disposal`. Spending has `spending.consumption` (reference) with 9 children, then `spending.non_consumption` with `saving_lending`, `agriculture`, `transfers` and `property`. Every series carries `areaId: area`.
    - `areas`: series ID = area ID, with `georgia` (reference) then the other 13 in `HOUSEHOLD_AREAS` order, all flat. The indicator is the section total.
  - `householdCoverage(section, view, area, measure, facts) => { min, max, years }`
  - `HouseholdState = { mode: "line" | "table"; range: PeriodRange; view: HouseholdView; area: HouseholdArea; measure: HouseholdMeasure; selectedIds: string[] }`
  - `defaultHouseholdState(section)`
  - `parseHouseholdHash(hash, section, facts)` and `serializeHouseholdHash(state)`. Keys are `tab` (`parts`/`areas`), `area` (written only on `parts` and only when not `georgia`), `per` (`household`/`person`), `view`, `sel` and the year keys. An unknown area or tab falls back to the default.
  - `changeHouseholdView(state, section, view, facts)`: selects the first series alone and refits the range with `collapseToAll: false`.
  - `changeHouseholdArea(state, section, area, facts)` and `changeHouseholdMeasure(state, section, measure, facts)`: keep `selectedIds` and refit the range with `collapseToAll: false`.
  - `HouseholdSeriesModel` and `HouseholdModel = { range; years; series; selected }`, with `buildHouseholdModel(section, facts, state)`. Colours: `INK` for the reference, `colorForItem(id, index)` otherwise.

- [ ] **Step 1: Write the tests** with the real canonical facts via `loadServedHouseholdData` and `toClientHouseholdFact`, as the Poverty explorer test does:
  - The income default is `parts`, `georgia`, `per_household`, selection `["income.total"]`, coverage 2002–2025.
  - `areas` coverage is 2002–2025, and `parts` with `region.tbilisi` is 2011–2025.
  - Review Focus 2: a range of 2011–2016 → `changeHouseholdArea` to `region.guria` gives 2019–2025, and back to `georgia` keeps 2019–2025.
  - Review Focus 3: with `["income.total", "income.wages"]` selected, changing area or measure keeps both. `changeHouseholdView` to `areas` gives `["georgia"]`.
  - Hash round-trip, including `area=region.adjara&per=person`, explicit empty `sel=`, and unknown `area=region.mars` → `georgia`.
  - `buildHouseholdModel` end value for income total, Georgia per household 2025 is `2025.8`, and for per person it is `630.7`. Spending consumption is `1438.7`.
  - In the areas model, `region.guria` 2018 is `null`.
  - The income parts children (8) all have `parentId` `income.total`.
  - In `poverty.test.ts`, the hrefs are the new addresses.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/household.test.ts tests/explorer/poverty.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, reusing `resolveRange`, `refitRange`, `parseYearRangeKeys`, `writeYearRangeKeys` and `colorForItem` as `poverty.ts` does.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: model household income and spending tabs, areas and state`.

### Task 5: Excel workbook and hub cards

**Files:**
- Create: `apps/web/lib/explorer/householdWorkbook.ts`, `apps/web/lib/explorer/householdHubCards.ts`
- Test: extend `tests/explorer/household.test.ts`

**Interfaces:**
- `buildHouseholdWorkbookExportModel({ section, facts, state, labels, areaLabel, sources, siteOrigin, title? }, presentation): WorkbookExportModel` mirrors `povertyWorkbook.ts`:
  - Filename `household-${section}-${view}-${area slug or "all"}-${measure}-${start}-${end}`.
  - Title: page title · tab label · area label (on `parts`) · per household/person label.
  - `numberFormat "0.0"`, unit label `household.unitGel`, and status `household.status.survey_estimate`.
  - Sources are found by `householdSourceId` for each selected cell.
- `buildHouseholdHubCards(facts, presentation): HubCardModel[]` gives two cards (Income, Spending). Sparklines are Georgia per household `income.total` / `spending.consumption`. Footers read `"2025 · 2,025.8 ₾ · 2002–2025"` and `"2025 · 1,438.7 ₾ · 2002–2025"`.

- [ ] **Step 1: Write the tests.**
  - An income `areas` workbook for 2019–2025 with `georgia`, `region.guria` and `region.tbilisi` has 3 rows × 7 years, sources `geostat_household_income_household_national` and `…_region` only, and format `0.0`.
  - A spending `parts` workbook for `settlement.rural` per capita lists only `geostat_household_spending_capita_settlement`.
  - The hub card footers match the values above.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: export household data to Excel and build hub cards`.

### Task 6: Messages and i18n wiring

**Files:**
- Create: `apps/web/lib/i18n/messages/{ka,en}/household.json`
- Modify: `lib/i18n/messages/{ka,en}/common.json`, `lib/i18n/messages/{ka,en}/poverty.json`, `lib/i18n/types.ts`, `lib/i18n/messages.server.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json`

Changes to `common.json`:
- Add `livingStandards` ("ცხოვრების დონე" / "Living standards"), `householdIncome` ("შემოსავლები" / "Income"), `householdSpending` ("ხარჯები" / "Spending") and `dataLivingStandards`.
- Remove `poverty` and `dataPoverty` once nothing uses them. `povertyRates` and `povertyInequality` stay.

Keys in `household.json`:
- Hub: `hub.title`, `hub.summary` (one short line), `hub.metaTitle`, `hub.metaDescription`.
- Pages: `page.{income,spending}.{title,summary,metaTitle}`; `tabs`; `tab.parts.{income,spending}` ("Where it comes from" / "What it's spent on"); `tab.areas` ("Compare areas").
- `areaLabel`; `area.georgia|settlement.urban|settlement.rural` ("Georgia" / "Towns" / "Villages"). Region labels come from `REGIONAL_ECONOMY_REGIONS` with `publicLabel`, as at `lib/pages/wages.tsx:63`.
- `measure.per_household|per_capita` ("Per household" / "Per person"); `series.<indicatorId>` for all 27 IDs (plain-language English from spec §3–4, Georgian from the `official/ka/` workbook rows).
- `unitGel` ("₾"), `unitLong.per_household|per_capita` ("₾ a month per household" / "₾ a month per person"), `latest.{income,spending}`.
- `sourceNote`, `methodology`, `search`, `series`, `amountHeader`, `status.survey_estimate`, `emptySelection`, `nestedSelected`, `subcategoriesFor`.

Poverty messages: remove `poverty.title`, `hubSummary`, `metaTitle` and `metaDescription`, which were used only by the removed Poverty hub. The Poverty breadcrumb uses `household.hub.title` instead.

Page revisions: replace the three `/explorer/poverty*` entries with the five `/explorer/living-standards*` entries, dated `2026-10-11`.

- [ ] **Step 1:** Add the files and keys, then run `npm run i18n:check`. Expected: FAIL until the namespace is wired.
- [ ] **Step 2:** Wire `household` as Poverty did. In `inventory.server.ts`, the route list uses `LIVING_STANDARDS_HUB_PATH` and `LIVING_STANDARDS_SECTIONS` in place of the Poverty entries.
- [ ] **Step 3:** Run `npm run i18n:check && npm run typecheck`. Expected: PASS.
- [ ] **Step 4:** Commit `feat: add Georgian and English living standards copy`.

### Task 7: Pages, component, navigation, redirects and SEO

**Files:**
- Create:
  - `apps/web/components/household/household-explorer.tsx`
  - `apps/web/lib/pages/household.tsx`, `apps/web/lib/pages/living-standards.tsx`
  - routes `app/(ka)/explorer/living-standards/{page,income/page,spending/page,poverty/page,inequality/page}.tsx` and the `app/(en)/en/explorer/living-standards/…` mirrors
  - `apps/web/tests/browser/household.spec.ts`
- Delete: `app/(ka)/explorer/poverty/` and `app/(en)/en/explorer/poverty/` (all three routes each)
- Modify:
  - `lib/pages/poverty.tsx`: remove `renderPovertyHub` and `povertyHubMetadata`; the breadcrumb and JSON-LD hub entry use `household.hub.title` and `LIVING_STANDARDS_HUB_PATH`
  - `components/shell/data-sidebar.tsx`: the Poverty entry becomes Living standards with `LIVING_STANDARDS_SECTIONS`, `livingStandardsActive = pathname.includes("/explorer/living-standards")` and test IDs `living-standards-link` / `living-standards-${id}-link`
  - `components/shell/explorer-footer.tsx`, `lib/seo/sitemap.ts` (the hub plus 4 sections; drop the Poverty hub URL)
  - `next.config.ts`: three redirects with `/en` twins, `permanent: true`, appended to the existing list
  - `tests/seo/routes.test.ts`, `tests/browser/poverty.spec.ts` (new addresses), and the page-count assertions Poverty touched in `bilingual-complete.spec.ts` and `seo.spec.ts` (+2 pages per language)

**Interfaces:**
- Consumes: Tasks 3–6.
- `HouseholdExplorer({ section, facts, labels, areaLabels, sources, lastReviewedAt, siteOrigin })` mirrors `PovertyExplorer`, with these additions:
  - an area `<select data-testid="household-area">` shown only on `parts`, copying the Wages Industries group select and its `selectClass`
  - a second `SegmentedTabs` for per household / per person, with test IDs `household-measure-per_household` and `household-measure-per_capita`
  - tab test IDs `household-tab-${view}`, `LatestValueLine testId="household-latest"` (always Georgia per household) and Excel test ID `household-excel-download`
- `renderHouseholdPage(locale, section)` / `householdPageMetadata(locale, section)` pass only that section's facts.
- `renderLivingStandardsHub(locale)` / `livingStandardsHubMetadata(locale)` render `BudgetHub` with `[...buildHouseholdHubCards(...), ...buildPovertyHubCards(...)]`, re-indexed `01`–`04` in the page, under one `household.hub.summary` line. The hub test ID is `living-standards-hub`.

- [ ] **Step 1: Write `tests/browser/household.spec.ts`:**
  - The hub shows 4 cards in the order Income, Spending, Poverty, Inequality.
  - `/explorer/living-standards/income` defaults to one selected row, and the latest line contains `2,025.8`.
  - Choosing area `region.guria` gives a range starting 2019.
  - Per person keeps the selection, and the latest line still reads `2,025.8`.
  - The Compare areas table shows `—` for Guria 2018 and no "Other regions" row (Review Focus 4).
  - Spending latest reads `1,438.7`.
  - The Excel download fires a `.xlsx`.
  - Switching to `/en` keeps `tab`, `area`, `per` and `sel` (Review Focus 5).
  - At 390 px there is no horizontal scroll.
  - `/en/explorer/poverty/rates#tab=relative` ends on `/en/explorer/living-standards/poverty#tab=relative` with the Relative tab active (Review Focus 1). Mark this test to run only when `PLAYWRIGHT_BASE_URL` is set, because redirects need `next start`.
- [ ] **Step 2: Implement** the component, pages, routes, sidebar, footer, sitemap, redirects, and the test updates listed above.
- [ ] **Step 3: Run** `npx vitest run tests/seo/routes.test.ts tests/explorer && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Run** `npx playwright test tests/browser/household.spec.ts tests/browser/poverty.spec.ts` against `next dev`. Expected: PASS, except the redirect test, which is skipped there.
- [ ] **Step 5: Commit** `feat: add living standards hub with income and spending pages`.

### Task 8: Methodology page and source archive

**Files:**
- Create: `apps/web/lib/methodology/content/household-income.ts`, `apps/web/lib/methodology/content/en/household-income.ts`, `data/methodology/source-archives/household-income.csv` (21 rows, Poverty columns)
- Modify: `lib/methodology/types.ts` (`"household-income"` after `"poverty"` in `LIVE_METHODOLOGY_IDS`), `catalog.ts`, `sourceInventory.ts` (root `docs/Raw Data/Households/geostat-household-income-spending-annual/official`, excluding `official/ka/`), `content/en/revisions.ts`, `lib/pages/methodology-article.tsx` (the four maps and the dataset JSON-LD condition, as for `poverty`), `data/localization/en/documents.json`, `data/localization/en/sources.json`, `data/methodology/decision-register.csv`, `lib/factQuery/buildSnapshot.ts` (exclude `source.geostat_household_` prefix), and the tests Poverty touched (`git diff b733c26^1 b733c26 --stat` lists them)

The content covers spec §7 rules 1–6 and §8 in plain words: what the survey covers, each income source and spending category in Geostat's metadata words (`0701_250526_EN.PDF` sections on incomes and expenditures), per household versus per person, the Imereti and 2019 region notes, and why borrowing sits apart from income.

- [ ] **Step 1:** Update the catalogue, archive, coverage and snapshot tests to expect `household-income`, then run them. Expected: FAIL.
- [ ] **Step 2:** Implement, then run `npm run data:check-methodology-archives` and the methodology tests. Expected: PASS, with `buildSnapshot.test.ts` showing no household source in the snapshot.
- [ ] **Step 3:** Commit `feat: publish household income and spending methodology and sources`.

### Task 9: Live preview for Duru (stop point)

- [ ] **Step 1:** Run `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100`. Publish a live preview Duru can click through. Use a Vercel preview through the connected Vercel tools if possible; otherwise a tunnel. Also save screenshots to `/mnt/project-files/screenshots/living-standards/`:
  - ka and en at 1440: hub, income on both tabs, income per person with a region chosen, spending on both tabs, the table, methodology
  - ka at 390: income and spending
- [ ] **Step 2:** Reply with the preview link and screenshots and ask one yes/no question. **Wait.** Apply changes, refresh, and ask again.

### Task 10: Scope and design documents

**Files:**
- Create: `docs/data-methodology/household-income-spending-annual.md`
- Modify:
  - `Project_Definition.md` §2H, rewritten as the Living standards hub with four pages and the spec reference, and line 44 (methodology list)
  - `DESIGN.md`: §32 renamed Living standards surfaces, plus the route table (lines ~362–364), the sidebar list (~459–460, 470) and §2 (line 31)
  - `docs/data-methodology/poverty-annual.md`: page addresses
  - `docs/deployment.md`: mirror table list, as Poverty did

- [ ] **Step 1:** Write the documents. **Step 2:** Run `npm run i18n:check`. **Step 3:** Commit `docs: record the living standards hub`.

### Task 11: Full gates and delivery (only after Duru's OK in Task 9)

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`. If Money and banks has merged, keep both sides in the sidebar, sitemap, methodology catalogue, mirror, snapshot exclusions and page counts.
- [ ] **Step 2:** Run `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100` with `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`. Expected: all green, including the redirect test.
- [ ] **Step 3:** `git push -u origin claude/project-thread-bfv991`. Open a draft PR with the attribution block, assign DuruMakh and request their review. Subscribe to PR activity and drive CI to green.
- [ ] **Step 4:** Reply with the PR link. Merging releases to production, so that waits for Duru.
