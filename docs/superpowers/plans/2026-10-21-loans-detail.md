# Loans in detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two Money and banks pages, Who borrows and Loans by region (an index map plus 12 area pages per language), served from three more NBG loan workbooks.

**Architecture:** The existing Money and banks research package, canonical CSV and `MoneyBanksFact` table each grow by 817 rows; there is no new table and no migration. Who borrows is one more section of the existing `MoneyBanksExplorer`, with headed rows and search. Loans by region copies the Business Regions index and area pages file by file, reading money-and-banks facts.

**Tech Stack:** Python 3 standard library (research package), Node `xlsx` (independent check), Next.js 16 / React / strict TypeScript, Vitest, Playwright.

**Rebased 2026-10-24 onto main `f4b7a209`.** Since the plan was written, main gained a shared regions-page frame, `apps/web/lib/pages/region-area-frame.tsx`, used by Housing, Transport and Internet (#214). The Internet hub is now the pattern for Loans by region, not Business; Tasks 5 and 6 follow it. Main also derives the browser hub and page counts from their registries (`1328dc62`), and shows every `rates.*` value to two decimals. New loan series stay at one decimal.

**Spec:** `docs/superpowers/specs/2026-10-21-loans-detail-design.md` (approved by Duru 2026-10-21 23:26 Tbilisi). Read it together with `docs/superpowers/specs/2026-10-11-money-banks-design.md` and `DESIGN.md` §34–§35.

## Global Constraints

- Yearly values only. Every amount is the December value of an NBG month-end stock. The last year is 2025.
- Units: stored as `gel_million`. Who borrows shows billion GEL (as the other money pages do). The Regions index shows billion GEL to one decimal. Area pages show million GEL to one decimal. Excel always uses million GEL.
- New indicator ids are exactly the spec's §8 list. Region ids come from `BUSINESS_REGIONS` (`region_tbilisi`, …), and area slugs are `businessAreaSlug`'s (`georgia`, `tbilisi`, `adjara`, …).
- Coverage:
  - `borrowers.total`, `borrowers.businesses`, `borrowers.people` and the 11 `borrowers.industry.*`: 2003–2025.
  - `borrowers.households` and `borrowers.individual_entrepreneurs`: 2015–2025.
  - The 7 `households.purpose.*` and all `loans_region.*`: 2015–2025.
- Value status `calculated` applies only to the 7 purpose series and the 12 `loans_region.*.total` series. Everything else new is `official`.
- Row counts: 730 existing + 344 + 77 + 396 = **1,547** served values.
- Anchors (published, one decimal): `borrowers.total` 2025 = `69035.7`; `borrowers.households` 2025 = `37355.4`; `loans_region.georgia.total` 2025 = `71780.2`; `loans_region.region_tbilisi.total` 2025 = `52420.1`.
- New breaks, appended in this order after the two existing ones: `loans_activity_2014`, `loans_overdue_2015`, `loans_sector_2022`, `loans_microbanks_2025`. `applies_to` and the reasons are as in spec §7. Breaks are never drawn as a gap.
- Page rules (DESIGN §17, §34): only one latest-value line under the H1, fitting on one line at 375px; no tab row; no collapsible parents (every row is visible under its heading); no "Loans:"-style prefixes; only the applicable total is selected first; gaps show as `—`, never 0.
- Latest-value lines (en; Georgian in messages):
  - Who borrows: `2025: all loans 69.0 billion GEL`.
  - Regions index: `2025: Tbilisi 52.4 billion GEL`.
  - Area page: `2025: all loans 4.0 billion GEL · Imereti`.
- Regions source line must say that loans are counted where the lending bank branch is, not where the borrower lives.
- Sidebar and hub order: Money supply, Loans and deposits, Who borrows, Loans by region, Interest rates, Bank health.
- The new sources join `MONEY_BANKS_PUBLIC_SOURCES`, so they stay outside `/mcp` and the publications.
- No push, PR or full gate before Duru approves the preview (project rule).

## Review Focus

1. **A pasted link that selects Households (or a purpose) with the years 2003–2010.** Those years have no values. Expect an empty chart with the years kept, dashes in the table and no crash. Test in Task 3.
2. **A small region's foreign-currency amount** (Racha-Lechkhumi 2025: 0.311 million). On the area page it must read `0.3`, not `0` or `—`. Test in Task 6.
3. **An unknown area slug** (`/explorer/money/regions/abkhazeti`). Expect 404, with no page generated for Abkhazeti AR. Test in Task 6.
4. **Searching the 23-row Who borrows list.** A heading with no visible row disappears. The `სერიები {selected} / {all}` count and "select all" still cover the whole list. Test in Task 4.
5. **Switching language on an area page with a selection in the hash.** Expect the selection and years to survive the switch. Browser test in Task 7.

---

### Task 1: Research package: read the three loan workbooks

**Files:**
- Add: `docs/Raw Data/Money/nbg-money-banks-annual/official/loans-structure-l3-10-1eng.xlsx`, `official/loans-by-lopeng.xlsx`, `official/loans-by-regions-lregeng.xlsx` (downloaded with `curl -g "https://nbg.gov.ge/fm/სტატისტიკა/loans/eng/<file>"`; copies from 2026-10-21 are in `/tmp/claude-0/nbg/` if the session is the same).
- Modify: `docs/Raw Data/Money/nbg-money-banks-annual/prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`.
- Regenerated: `money-banks-annual.csv`, `money-banks-series-breaks.csv`, `coverage.csv`, `source-manifest.{csv,json}`, `validation-report.json`, `independent-validation.json`.

**Interfaces:**
- Produces three new `SOURCES` entries: `nbg_loans_structure_l3_10_1` (sheet `Total`), `nbg_loans_purpose_lop` (sheet `HH`) and `nbg_loans_regions_lreg` (sheets `NC`, `FC`). Each records its real download time, in UTC.
- Produces package rows in the existing CSV format.
  - Purpose rows: `source_sheet` is `HH` and `source_cell` is `<lari cell>+<fx cell>`.
  - Region totals: `source_sheet` is `NC+FC` and `source_cell` is `<NC cell>+<FC cell>` (same column letter, matching rows).

- [ ] **Step 1: Write the failing tests in `test_validation.py`.** Each one runs `prepare.extract()` and `prepare.validate()` the way the existing tests do.
  - `test_row_count` expects 1547.
  - `test_loan_anchors` expects published values `('borrowers.total',2025)=='69035.7'`, `('borrowers.households',2025)=='37355.4'`, `('loans_region.georgia.total',2025)=='71780.2'` and `('loans_region.region_tbilisi.total',2025)=='52420.1'`.
  - `test_households_start_2015` expects no `borrowers.households` or `borrowers.individual_entrepreneurs` row before 2015.
  - `test_no_abkhazeti` expects no indicator containing `abkhaz`.
  - `test_people_plus_businesses_until_2014` expects `abs(people + businesses - total) <= 0.5` for 2003–2014.
  - `test_validate_rejects_broken_industry_sum` copies the rows, adds 1 to one `borrowers.industry.trade` 2020 value and expects `validate` to raise.
- [ ] **Step 2: Run them and confirm they fail.** Run: `cd "docs/Raw Data/Money/nbg-money-banks-annual" && python3 -m unittest test_validation -v`. Expected: the new tests FAIL (1547 against 730, missing keys).
- [ ] **Step 3: Implement the extraction in `prepare.py`.**
  - Add `december_columns(sheet_rows, row) -> dict[int, str]`: the 31 December column of each year in a header row of dates. It is used by the two transposed sheets (`HH`, `NC`/`FC`, whose date row is the one holding datetimes).
  - Add `row_by_label(sheet_rows, label, after=None) -> int`: the one row whose column-A text equals `label`. `after` searches only below a marker row, which is needed because `HH` repeats the purpose labels under "In National Currency" and then under "In Foreign Currency".
  - Add `extract_loans_detail()`:
    - **L3.10.1 `Total`:** locate the columns by their printed headings. Row 3 holds `Total` and `Households`. Row 4 holds `total` (businesses), the 11 industry labels in spec order, `Individuals` and `Individual entrepreneur`.
      - Industry labels map to ids: `Agriculture, Forestry, Fishing`→agriculture, `Industry`→industry, `Construction`→construction, `Trade`→trade, `Hotels and Restaurants`→hotels_restaurants, `Transport and Communications`→transport_communications, `Financial Intermediation`→financial, `Transactions in Real Estates, Researches`→real_estate (startswith match), `Education`→education, `Health Care and Social Services`→health_social, `Other Services`→other_services. `Individuals`→people.
      - Use the existing `december_rows` for the rows.
    - **LPR `HH`:** take each purpose's lari cell (under `In National Currency`) plus its foreign-currency cell (under `In Foreign Currency`), using `add_pair`.
      - Labels map to ids: `Consumer Loans`→consumer, `Mortgage loans for real estate purchase and repair`→home, `Business loans for SME`→sme, `Business loans for large enterprises`→large_business, `Auto loans`→car, `Lombard Loans`→pawn, `Other Loans`→other.
    - **LREG `NC`/`FC`:** read `Total`→georgia and the 11 region rows by label (`Adjara, Autonomous Republic of` in `NC` but `Adjara` in `FC`, so match by prefix). Skip the Abkhazeti row. Each area's `gel` and `fx` are official; its `total` comes from `add_pair`.
  - Extend `COVERAGE`, `CALCULATED`, `ANCHORS` and `BREAKS`, using the exact reasons and source notes quoted from each workbook's footer.
  - Extend `validate()` with the spec §8 checks, within `Decimal('0.5')`:
    - Businesses + People = Total for ≤2014, and Businesses + Households = Total from 2015;
    - People + Individual entrepreneurs = Households;
    - the 11 industries add up to Businesses;
    - for each area, gel + fx = total;
    - the 11 regions add up to Georgia, for gel and for fx;
    - every amount is ≥ 0 (already covered).
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `python3 -m unittest test_validation -v && python3 prepare.py`. Expected: all tests PASS, and `{"status": "passed", "primary_observation_count": 1547}`.
- [ ] **Step 5: Extend the independent check.** In `verify_independent.mjs`, add the three files to `FILES` and the new `RANGES`, written from the spec. Add leaf rules that locate each cell by its own date-row or date-column logic, and its printed row and column label. Set `EXPECTED_TOTAL = 1547`. Run: `node verify_independent.mjs`. Expected: `independent-validation.json` has status `passed` and 1547 checked values.
- [ ] **Step 6: Check, then commit.** Run `python3 prepare.py --check` (expected: no "stale" error). Update `README.md`'s source table and counts. Commit: `git commit -m "data: add NBG loans by activity, purpose and region to the money research package"`.

### Task 2: Serving package: types, validation, canonical files

**Files:**
- Modify: `apps/web/lib/data/moneyBanks/types.ts`, `validation.ts`, `prepareMoneyBanks.ts`.
- Modify: `apps/web/tests/data/moneyBanks/moneyBanks.test.ts`.
- Regenerated: `data/imports/money-banks-annual.csv`, `data/imports/money-banks-series-breaks.csv`, `data/reports/money-banks-validation.json`, `data/methodology/source-archives/money.csv` (with `npm run data:prepare-money` and `npm run data:prepare-methodology-archives`).

**Interfaces:**
- Consumes the Task 1 package files.
- Produces:
  - `MONEY_BANKS_INDICATORS`, with the 50 new ids appended in spec §8 order: total, businesses, households, people, individual_entrepreneurs, the 11 industries, the 7 purposes, then `loans_region.<area>.{total,gel,fx}` for `georgia` and then `BUSINESS_REGIONS` order;
  - `MONEY_BANKS_LOAN_INDUSTRIES` and `MONEY_BANKS_LOAN_PURPOSES` (`as const` id-suffix arrays);
  - `MONEY_BANKS_LOAN_AREAS = ["georgia", ...BUSINESS_REGIONS] as const`;
  - `loansRegionIndicator(area, part: "total" | "gel" | "fx")`;
  - three ids added to `MONEY_BANKS_SOURCES`.

- [ ] **Step 1: Write the failing tests in `moneyBanks.test.ts`.**
  - Change the 730 expectations to 1547.
  - Add `test("the loan detail series and their years")`. It asserts:
    - the year span of `borrowers.total` is 2003–2025 and of `borrowers.households` is 2015–2025;
    - `loans_region.region_racha_lechkhumi_kvemo_svaneti.fx` 2025 has publishedValue `0.3`;
    - the four anchors;
    - the `valueStatus` of `households.purpose.home` 2025 is `calculated`, and of `borrowers.businesses` is `official`.
  - Add `test("validation rejects regions that do not add up to Georgia")`. It mutates the loaded facts (Tbilisi gel 2020 + 10) and expects `validateMoneyBanksFacts` to throw `/regions differ from Georgia/`.
  - Add `test("the break register lists the four loan breaks")`, expecting the break ids in order `fsi_method_2022, fsi_ifrs_2023, loans_activity_2014, loans_overdue_2015, loans_sector_2022, loans_microbanks_2025`.
- [ ] **Step 2: Confirm they fail.** Run: `npx vitest run tests/data/moneyBanks/moneyBanks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - In `types.ts`, add the arrays and the helper. Update the doc comment ("78 served indicators").
  - In `validation.ts`:
    - extend `YEARS`, `CALCULATED`, `sourceFor` (the `borrowers.` prefix → `nbg_loans_structure_l3_10_1`, `households.purpose.` → `nbg_loans_purpose_lop`, `loans_region.` → `nbg_loans_regions_lreg`) and `unitFor` (every new id is `gel_million`);
    - add the Task 1 sum checks with tolerance `0.5`, with the error texts `borrowers do not add up to all loans`, `industries do not add up to businesses`, `regions differ from Georgia` and `area lari plus foreign currency differs from its total`;
    - add the 2025 anchors.
  - In `prepareMoneyBanks.ts`:
    - the 730 becomes 1547;
    - `BREAK_IDS` gets the four new ids;
    - the break check accepts `appliesTo` ids with the prefix `banks.`, `borrowers.`, `households.` or `loans_region.`, as long as each is a served id;
    - the docstring count changes too.
- [ ] **Step 4: Regenerate and confirm it passes.** Run: `npm run data:prepare-money && npm run data:prepare-methodology-archives && npx vitest run tests/data/moneyBanks/moneyBanks.test.ts`. Expected: PASS. `git diff --stat` shows the CSV growing by 817 rows.
- [ ] **Step 5: Commit.** Run: `git commit -m "data: serve the loan detail series in the money and banks package"`.

### Task 3: Who borrows: model, colours, Excel break marks

**Files:**
- Modify: `apps/web/lib/explorer/moneyBanks.ts`, `apps/web/lib/explorer/moneyBanksWorkbook.ts`.
- Test: `apps/web/tests/explorer/moneyBanks.test.ts`.

**Interfaces:**
- Consumes Task 2's ids and arrays.
- Produces:
  - `MONEY_BANKS_SECTIONS`, which gains `{ id: "borrowers", href: "/explorer/money/borrowers", labelKey: "common.moneyBorrowers" }` after `loans-deposits`, and `{ id: "regions", href: "/explorer/money/regions", labelKey: "common.moneyRegions" }` after that;
  - `export type MoneyBanksTopicId = Exclude<MoneyBanksSectionId, "regions">`, which every existing function taking a section now uses;
  - a `VIEWS` entry `borrowers: ["main"]`;
  - `MoneyBanksSeriesDefinition`, which gains an optional `heading?: "borrowers" | "industry" | "purpose"`;
  - `moneyBanksSeriesColor(series, index)` (now exported);
  - `MONEY_BANKS_LOAN_BREAKS: readonly { breakId: string; year: number; appliesTo: readonly string[] }[]`, mirroring the four new break rows.

- [ ] **Step 1: Write the failing tests.**
  - `test("who borrows lists all loans, then three headed groups")` checks that `moneyBanksViewSeries("borrowers","main")`:
    - has the ids `[borrowers.total, borrowers.businesses, borrowers.households, borrowers.people, borrowers.individual_entrepreneurs, ...11 industries, ...7 purposes]`;
    - has headings `undefined`, then `"borrowers"`×4, `"industry"`×11 and `"purpose"`×7;
    - has no `parentId` on any row;
    - has a default selection of `["borrowers.total"]`.
  - `test("who borrows colours are all different")`: the 23 colours from `buildMoneyBanksModel("borrowers", facts, defaultMoneyBanksState("borrowers"))` are pairwise distinct, `borrowers.total` is `INK`, and `borrowers.industry.construction` is `colorForItem("sector.f", 0)`. The industry → sector-key map is: agriculture a, industry c, construction f, trade g, hotels_restaurants i, transport_communications h, financial k, real_estate l, education p, health_social q, other_services s. The four "who borrows" rows and seven purposes take fixed existing palette hexes that are no sector colour, as Business's `SIZE_COLORS` do.
  - `test("households before 2015 are gaps, not zeros")`: with `parseMoneyBanksHash("#view=line&sel=borrowers.households&from=2003&to=2010", "borrowers", facts)`, the model's range is 2003–2010, every `valuesByYear` is `null`, and nothing throws.
  - `test("the loan breaks mirror the register")`: `MONEY_BANKS_LOAN_BREAKS` matches the rows of `data/imports/money-banks-series-breaks.csv` with ids `loans_*` (the year is the reference date's year).
  - `test("who borrows Excel marks a break year in the status column")`: build the workbook model for `borrowers.industry.trade` over 2013–2015. The Data-sheet status for 2014 ends with the `moneyBanks.status.break` text, and the status for 2013 does not.
- [ ] **Step 2: Confirm they fail.** Run: `npx vitest run tests/explorer/moneyBanks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the `"borrowers"` case to `moneyBanksViewSeries` (rows with `heading`, no nesting). Use `moneyBanksHasTotalRow("borrowers") = false`.
  - In `moneyBanksSeriesColor`, look up the industry sector key or the fixed hex, and otherwise fall back to `topicSeriesColor`.
  - In `buildMoneyBanksWorkbookExportModel`, when `section === "borrowers"`, append `` ` · ${t("status.break")}` `` to a cell's status if a `MONEY_BANKS_LOAN_BREAKS` entry has `year === year` and `appliesTo` includes the id.
  - Make `buildMoneyBanksHubCards` skip `regions` the way Business does (`series: null`, footer `${first}–${last}` from `loans_region.georgia.total`), and add `borrowers: "borrowers.total"` to `HEADLINE`.
- [ ] **Step 4: Confirm they pass.** Run: `npx vitest run tests/explorer/moneyBanks.test.ts && npm run typecheck`. Expected: PASS and no type errors. The existing four-section assertions are updated to six sections.
- [ ] **Step 5: Commit.** Run: `git commit -m "feat: who borrows series model for money and banks"`.

### Task 4: Who borrows: page, messages, navigation

**Files:**
- Modify:
  - `apps/web/components/money-banks/money-banks-explorer.tsx`;
  - `apps/web/lib/pages/moneyBanks.tsx`;
  - `apps/web/lib/i18n/messages/{ka,en}/moneyBanks.json`;
  - the `common` messages that hold `common.moneyLoansDeposits` (add `common.moneyBorrowers` and `common.moneyRegions`);
  - `apps/web/lib/navigation/navTree.ts` (only if `sectionRows` does not already follow `MONEY_BANKS_SECTIONS`);
  - `apps/web/lib/seo/sitemap.ts`.
- Create: `apps/web/app/(ka)/explorer/money/borrowers/page.tsx`, `apps/web/app/(en)/en/explorer/money/borrowers/page.tsx` (copies of the loans-deposits routes with `"borrowers"`).
- Test: `apps/web/tests/explorer/moneyBanks.test.ts` (render test).

**Interfaces:**
- Consumes Task 3.
- Message keys:
  - `moneyBanks.page.borrowers.{title,metaTitle,summary}` and `moneyBanks.latest.borrowers`;
  - `moneyBanks.heading.{borrowers,industry,purpose}`;
  - `moneyBanks.series.<each new borrowers/purpose id>`;
  - `moneyBanks.status.break`, `moneyBanks.search`.
- Georgian proposals:
  - title `ვინ იღებს სესხს`;
  - headings `ვინ იღებს სესხს`, `ბიზნესი დარგების მიხედვით` and `რისთვის იღებენ სესხს შინამეურნეობები`;
  - latest line `2025: ყველა სესხი 69.0 მლრდ ₾`.

  Every new Georgian label also goes into `/mnt/project-files/loans-detail-preview/notes-for-duru.md` for proofreading.

- [ ] **Step 1: Write the failing render test.** `test("who borrows renders headed rows, search and the 2025 line")` uses `renderPageMarkup(renderMoneyBanksPage("en","borrowers"))`. The markup:
  - contains `2025: all loans 69.0 billion GEL` (read the value from the CSV helper);
  - contains three `data-testid="series-heading"` elements, with the texts in order `Who borrows`, `Businesses by industry` and `What households borrow for`;
  - contains a search input;
  - contains no `aria-expanded` caret button.

  Also assert that `moneyBanksPageMetadata("ka","borrowers")` has the title from the messages.
- [ ] **Step 2: Confirm it fails.** Run: `npx vitest run tests/explorer/moneyBanks.test.ts -t "who borrows renders"`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The explorer passes `heading: series.heading && t(`heading.${series.heading}`)` on each row. It enables `searchable` when `model.series.length > SEARCHABLE_MIN_ROWS`, with `query` state as `business-explorer.tsx` does, and `searchPlaceholder={t("search")}`.
  - Add the two routes and the messages.
  - The sitemap lists `/explorer/money/borrowers` in both languages with `moneyBanksModified`.
  - Run `npm run i18n:check`.
- [ ] **Step 4: Confirm it passes.** Run: `npx vitest run tests/explorer/moneyBanks.test.ts tests/seo && npm run typecheck && npm run i18n:check`. Expected: PASS. Update the sitemap or nav expectations that count pages, and only those.
- [ ] **Step 5: Commit.** Run: `git commit -m "feat: who borrows page in money and banks"`.

### Task 5: Loans by region: area model and region map

**Files:**
- Create: `apps/web/lib/explorer/moneyBanksAreas.ts`, `apps/web/lib/explorer/moneyBanksRegionMap.ts`.
- Test: `apps/web/tests/explorer/moneyBanksAreas.test.ts`.

**Interfaces:**
- Consumes `MONEY_BANKS_LOAN_AREAS` and `loansRegionIndicator` (Task 2), `areaRoutes` and `buildLatestValueRegionMapModel` / `latestCompleteRegionYear` (unchanged).
- Produces, mirroring the `internetAreas.ts` names (and `internetRegionMap.ts` for the map):
  - `type MoneyBanksArea`, `MONEY_BANKS_REGIONS_HREF = "/explorer/money/regions"`;
  - `{ areaSlug: moneyBanksAreaSlug, areaHref: moneyBanksAreaHref, mapId: moneyBanksMapId, areaOfMapId: moneyBanksAreaOfMapId, regionHref: moneyBanksRegionHref }`;
  - `moneyBanksAreaSeries(area): MoneyBanksSeriesDefinition[]`: `[total (reference), gel, fx]`, with no headings and no nesting;
  - `moneyBanksAreaDefaultSelection(area) = [loansRegionIndicator(area,"total")]`;
  - `parseMoneyBanksAreaHash(hash, area, facts): TopicState` and `moneyBanksAreaSelectionHash(selectedIds, area): string` (moves ids to the other area; empty for the default);
  - `buildMoneyBanksAreaModel(area, facts, state): MoneyBanksModel`;
  - `buildMoneyBanksRegionMapModel(facts): RegionMapModel` (all loans, regions keyed `region.<id>`).

- [ ] **Step 1: Write the failing tests.**
  - `test("twelve areas with slugs and map ids")`: the slugs are `["georgia","tbilisi","adjara","guria","imereti","kakheti","mtskheta_mtianeti","racha_lechkhumi_kvemo_svaneti","samegrelo_zemo_svaneti","samtskhe_javakheti","kvemo_kartli","shida_kartli"]`, or exactly `businessAreaSlug` of each Business area; `moneyBanksMapId("region_imereti") === "region.imereti"`; and `moneyBanksRegionHref("region.imereti") === "/explorer/money/regions/imereti"`.
  - `test("the map ranks 2025 all loans, Tbilisi first")`: `buildMoneyBanksRegionMapModel(facts)` has `year` 2025, `firstYear` 2015 and 11 regions, with `regions[0].regionId === "region.tbilisi"` and value ≈ 52,420.1 million (to 0.05).
  - `test("an area page lists all loans, lari and foreign currency")`: for `region_imereti`, the series ids are `[loans_region.region_imereti.total, .gel, .fx]` and the default selection is the total.
  - `test("a selection moves to another area")`: `moneyBanksAreaSelectionHash(["loans_region.region_imereti.fx"], "region_guria") === "#sel=loans_region.region_guria.fx"`, and the default selection moves to `""`.
  - `test("an unknown id in the hash is ignored")`: `parseMoneyBanksAreaHash("#sel=loans_region.region_abkhazeti.total", "georgia", facts).selectedIds` is `[]`.
- [ ] **Step 2: Confirm they fail.** Run: `npx vitest run tests/explorer/moneyBanksAreas.test.ts`. Expected: FAIL (the module is missing).
- [ ] **Step 3: Implement both modules,** following `internetAreas.ts` and `internetRegionMap.ts` (`businessAreas.ts` is the older copy of the same shape). Use the money-banks topic helpers (`parseTopicHash`, `buildTopicModel`), not the unit-list helpers, because one unit means no unit switching.
- [ ] **Step 4: Confirm they pass.** Run: `npx vitest run tests/explorer/moneyBanksAreas.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** Run: `git commit -m "feat: loans by region area model and map"`.

### Task 6: Loans by region: index and area pages

**Files:**
- Create:
  - `apps/web/components/money-banks/money-banks-index.tsx` (as `components/internet/internet-index.tsx`);
  - `apps/web/components/money-banks/money-banks-area-explorer.tsx` (as `components/internet/internet-area-explorer.tsx`, one unit: million GEL);
  - `apps/web/lib/pages/money-banks-regions-shared.tsx`, `money-banks-regions.tsx` and `money-banks-area.tsx` (as `internet-shared.tsx`, `internet-homes.tsx` and `internet-area.tsx`). The shared module calls `regionAreaFrame` with `hub: "moneyBanks"`, `indexKey: "regions"`, `sourceIds: ["nbg_loans_regions_lreg"]`;
  - the routes `apps/web/app/(ka)/explorer/money/regions/page.tsx`, `.../regions/[id]/page.tsx` and their `(en)/en/...` copies (with `dynamicParams = false` and `generateStaticParams = moneyBanksAreaStaticParams`).
- Modify: `lib/pages/region-area-frame.tsx` (the only change: add `"moneyBanks"` to the `hub` union, so the frame reads `moneyBanks.title`, `moneyBanks.heading.<id>`, `moneyBanks.mapLabel` and `moneyBanks.area.georgia`), `lib/i18n/messages/{ka,en}/moneyBanks.json`, `lib/explorer/moneyBanksWorkbook.ts` (area file name), `lib/seo/sitemap.ts`.
- Test: `apps/web/tests/explorer/moneyBanksAreas.test.ts` (render tests).

**Interfaces:**
- Consumes Task 5.
- Produces the page functions `moneyBanksRegionsPageMetadata(locale)`, `renderMoneyBanksRegionsPage(locale)`, `moneyBanksAreaStaticParams()`, `moneyBanksAreaPageMetadata(slug, locale)` and `renderMoneyBanksAreaPage(locale, slug)`, with the same export layout as `internet-shared.tsx`. Each area page has one heading id, `area`, with the message `moneyBanks.heading.area` ("Loans" / "სესხები"), for the frame's Dataset measures.
- The workbook takes an optional `area?: { slug: string }`. With it, the filename stem is `money-loans-region-${slug}-${start}-${end}`.
- Message keys:
  - `moneyBanks.page.regions.{title,metaTitle,summary}` and `moneyBanks.page.area.{regionTitle,regionSummary}`;
  - `moneyBanks.latest.regions` (`{region}`) and `moneyBanks.latest.area` (`{region}`);
  - `moneyBanks.sourceNoteRegions` (with the branch-location sentence);
  - `moneyBanks.area.georgia`, `moneyBanks.map.loans`, `moneyBanks.regionMapAria`, `moneyBanks.regionMapEntityAria`;
  - `moneyBanks.series.loans_region.{total,gel,fx}` (names without the area).
- Georgian proposals: `სესხები რეგიონებში` and `სესხები — {region}`.

- [ ] **Step 1: Write the failing render tests.**
  - `test("the regions index shows Tbilisi's 2025 line, Georgia first and the branch caveat")`: the markup of `renderMoneyBanksRegionsPage("en")`:
    - contains `2025: Tbilisi 52.4 billion GEL`;
    - lists Georgia before Tbilisi;
    - has 11 region links to `/en/explorer/money/regions/<slug>`;
    - contains the words `bank branch`.
  - `test("an area page reads million GEL, small values included")`: `renderMoneyBanksAreaPage("en","racha_lechkhumi_kvemo_svaneti")` shows a list value of `0.3` for In foreign currency and the latest line `2025: all loans 60.5 million GEL · Racha-Lechkhumi and Kvemo Svaneti`. Use `formatAmount`, so below a billion the line reads million.
  - `test("an unknown area is a 404")`: `renderMoneyBanksAreaPage("en","abkhazeti")` rejects with Next's not-found error, and `moneyBanksAreaStaticParams()` has 12 ids.
  - `test("the area workbook names the area")`: the export filename for Imereti 2015–2025 in en is `fiscal-money-loans-region-imereti-2015-2025-en.xlsx`.
- [ ] **Step 2: Confirm they fail.** Run: `npx vitest run tests/explorer/moneyBanksAreas.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the components, page module, routes and messages.**
  - The index footer source line is `${t("sourceNoteRegions")} · ${unitLabel} · ${map.year}.`.
  - The area explorer keeps the `RegionPicker` with Georgia first and the all-regions entry, plus `EntityNeighbourLinks`.
  - The sitemap lists the index and the 12 area pages in both languages.
  - Run `npm run i18n:check`.
- [ ] **Step 4: Confirm they pass.** Run: `npx vitest run tests/explorer/moneyBanksAreas.test.ts tests/explorer/moneyBanks.test.ts tests/seo && npm run typecheck && npm run lint`. Expected: PASS. Update the hub-card test for six cards, with the regions footer `2015–2025`.
- [ ] **Step 5: Commit.** Run: `git commit -m "feat: loans by region index and area pages"`.

### Task 7: Documentation, methodology and browser tests

**Files:**
- Modify:
  - `apps/web/lib/methodology/content/moneyBanks.ts` and `content/en/moneyBanks.ts`: a "Loans in detail" section covering the three tables and their totals, branch location, purpose definitions, the four breaks and the fiscal.ge sums, and the 730 count updated to 1,547;
  - `docs/data-methodology/money-banks-annual.md`;
  - `Project_Definition.md` §2J (six pages and their paths);
  - `DESIGN.md` §34 (the six-card hub, Who borrows, the Regions index and area pages), the route list and §6.7's section list;
  - `apps/web/tests/browser/money-banks.spec.ts`, plus any browser spec that counts hub pages or sitemap URLs (search for `loans-deposits` and the money page count).
- Create: `/mnt/project-files/loans-detail-preview/notes-for-duru.md` (the Georgian labels to proofread).

- [ ] **Step 1: Write the browser tests in `money-banks.spec.ts`.**
  - `who borrows shows all loans alone, three headings and search` checks:
    - the latest line `money-latest` text matches `/^2025: all loans 69\.0 billion GEL$/`;
    - there are 3 `series-heading` elements;
    - typing `trade` leaves the count text `Series 1 / 23`.
  - `households before 2015 are dashes in the table`: `#view=table&sel=borrowers.households&from=2013&to=2016` shows `—` for 2013 and 2014.
  - `the regions map opens Imereti and the language switch keeps the selection`: click Imereti on the list; tick In foreign currency; switch to ka; expect the URL hash to contain `sel=` with `loans_region.region_imereti` and the fx row to be checked.
  - `latest lines fit one line at 375px`: on `/explorer/money/borrowers`, `/explorer/money/regions` and `/explorer/money/regions/racha_lechkhumi_kvemo_svaneti` (ka and en), `money-latest` has one line box. Use the existing one-line helper the other specs use.
- [ ] **Step 2: Run against a built server and confirm they fail first, then pass after the docs edits.** Build and serve as `CLAUDE.md` says (`NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, `setsid … npm run start -- --port 3100`). Then run `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/money-banks.spec.ts tests/browser/hubs.spec.ts tests/browser/seo.spec.ts`. Expected: PASS.
- [ ] **Step 3: Write the docs listed under Files.** Run `npx vitest run tests/methodology` (expected: PASS).
- [ ] **Step 4: Commit.** Run: `git commit -m "docs: methodology, scope and design for loans in detail"`.

### Task 8: Preview for Duru, then the gates and the PR (only after Duru's OK)

- [ ] **Step 1:** Take screenshots of Who borrows, the Regions index, Georgia and Imereti, in ka and en, at 375 and 1440 pixels, against the built server. Save them in `/mnt/project-files/loans-detail-preview/`. Post them with the proofread notes and a card with three options: Clickable preview, Screenshots only, Looks good. Push the branch (no PR) only if Duru asks for a clickable preview.
- [ ] **Step 2:** After Duru's OK, merge the latest `main` into the branch. Then run `npm run check` and `npm run build`, then the full browser suite once against a built server. Expected: all pass. Report any failure with its output.
- [ ] **Step 3:** Push `claude/project-thread-zip3g1`. Open the PR using the attribution block. Assign and request review from DuruMakh, subscribe to PR activity, and merge only on Duru's go ("push merge sync").
