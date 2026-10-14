# Data Validation Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct every number Fiscal.ge shows wrongly or out of date, fix the labels and break markers that make correct
numbers read wrongly, and make the provenance and methodology pages tell the truth — as found by the October 2026 validation.

**Spec:** [Fiscal.ge data validation — October 2026](../specs/2026-10-12-data-validation.md). Finding ids (e.g. `EXPM-B1`) refer to
that spec and to the per-task reports in `.superpowers/data-validation-2026-10/`.

**Status:** Tasks 1–3 are implemented on branch `claude/youthful-mirzakhani-f0da3e` (commits a8779bdf, ccd40d49 and c079a4b0, plus one review follow-up commit); not pushed, no PR yet. Tasks 4–23 are not started.

**Delivery (owner preference):** one branch (`codex/data-validation-fixes`) with **one commit per task** and one PR. Split only
where a part must ship independently: tasks 1–5 (wrong numbers) may go out first as their own PR if the owner wants them live
before the rest. Every data task regenerates through the existing prepare scripts and the parity-checked `npm run data:import`;
never edit the database.

**Order (as requested):** wrong numbers shown publicly → extraction errors → outdated vintages / source updates →
display, rounding, labels → source swaps or additions → documentation.

## Global constraints

- AGENTS.md data rules stay: every official row preserved, uncertain rows in `spending.other_unclassified`, `basis` actual wins,
  municipal codes 05/42/43/46/64 excluded, Excel workbooks keep basis and source hyperlinks.
- Each data change updates its methodology doc under `docs/data-methodology/` **in the same commit** (CLAUDE.md definition of done 3).
- Query-service changes (`lib/factQuery/`, `lib/mcp/`) must keep `npx vitest run tests/factQuery/reference.test.ts` green; a
  disagreement is a stop condition, not a reason to edit the expectation.
- A data correction this spec predicts may change the expected values in `tests/factQuery/fixtures/referenceIntents.ts` in the
  same commit, recomputed from the corrected CSVs and listed old → new in the commit and the PR body (Task 2 did this for the
  per-resident ranking: its commit gives the corrected figures, and the PR body lists the fixture's five values old → new). A disagreement caused by a change under `lib/factQuery/`, `lib/mcp/` or `app/mcp/` stays a stop condition.
- Feedback while editing: run only the narrow test (`npx vitest run tests/<path>.test.ts`, `npm run typecheck`, the dataset's
  `data:check-*`). Done-check once at the end: `npm run check`, `npm run build`, `npm run test:browser` (UI tasks).

## Reuse

| Need | Reuse as is | Small addition | New |
|---|---|---|---|
| Break markers on charts/tables | `EditorialLineChart` `breaks` prop and `ExplorerTable` `breakYears` (already used by demography: `components/demography/national-vital-charts.tsx:101,117`) | pass them from GDP, budget % of GDP, current account, revenue, municipal, trade domestic, money, FDI, remittances, unemployment, wages pages | none |
| Preliminary marks | `hollowPreliminary` option used by other line charts | turn on in economic sectors (`economic-sectors-explorer.tsx:185`) and GDP | none |
| Signed Excel amounts | `applySignedAmountFormat` | call it from `lib/explorer/deficitWorkbook.ts` | none |
| Unavailable cells in Excel | workbook writer `not_available` basis | use it in `lib/explorer/foreignInvestmentWorkbook.ts:18` | none |
| Rounding | `lib/explorer/format.ts` | replace `toFixed` with one decimal-safe half-up helper used by `formatSignedFixed` and `inflationGrid.displayedValue` | one small helper function |
| Link check | registry CSVs `data/methodology/source-archives/*.csv` | a test that every `official_url_or_archive_url` and workbook source link is well-formed and listed (network check stays manual) | one test file |

No new component, page or library.

---

## Phase 1 — Wrong numbers shown publicly

### Task 1: Justice category excludes the High Council of Justice (W1)

- **Why:** `EXPM-B1` (confirmed): `apps/web/lib/data/adminSpending/categories.ts:181` matches the substring `იუსტიციის`, so
  "საქართველოს იუსტიციის უმაღლესი საბჭო" (code 10 00) lands in `admin_spending.justice`. 2024: 431,366,249 = MoJ 425,038,828
  + Council 6,327,421. Methodology §6.10 puts courts and independent bodies in `other_costs`.
- **Files:** `apps/web/lib/data/adminSpending/categories.ts` (exclude "უმაღლესი საბჭო" before the justice rule, route to
  `other_costs`); regenerate `data/imports/admin-spending-facts-2004-2025.csv` with `npm run data:generate-admin-spending`;
  test under `apps/web/tests/data/adminSpending/`.
- **Owner decision (2026-10-13):** move the misplaced bodies to *Other costs* (no new category, no per-institution view).
- **Scope after the deep dive (spec §1a):** four bodies, not one — High Council of Justice (10 00, every year 2004–2025, 59.9 M total),
  International Education Center (61 00 in 2015, 58 00 in 2016), Academy of Agricultural Sciences (38 00, 2004) and Lugar
  Public Health Research Center (48 00, 2012–2013). All four go to `admin_spending.other_costs`, consistent with courts, the
  Prosecutor's Office, the Academy of Sciences and the Intellectual Property Center. Also correct rows 11 and 39 of
  `data/mappings/review/admin-spending-institution-review-2004.csv`.
- **Steps:**
  - [x] Write failing tests: rows with institution "საქართველოს იუსტიციის უმაღლესი საბჭო", "სსიპ -განათლების საერთაშორისო ცენტრი", "საქართველოს სოფლის მეურნეობის მეცნიერებათა აკადემია" and "ა(ა)იპ – რიჩარდ გ. ლუგარის საზოგადოებრივი ჯანმრთელობის კვლევის ცენტრი" classify to `admin_spending.other_costs`; the Ministry of Justice, Education, Agriculture and Health rows keep their categories.
  - [x] Add one explicit exclusion list of independent bodies ahead of the keyword rules (not four ad-hoc checks); run the tests.
  - [x] Regenerate the admin facts; for each affected year the category drops by exactly the body's actual (table in spec §1a), Other costs rises by the same, totals unchanged (303 category-year facts, 0 other changes).
  - [x] Re-run the institution-by-category listing (`admin-audit.mts` approach) and confirm no other non-ministry body sits in a ministry category.
- **Verify:** `npx vitest run tests/data/adminSpending`; `npm run data:validate`; `/explorer/expenditure` ministries scope shows Justice 2024 = 425.0 mln and 2025 = 407.0 mln, Education 2015 = 824.7 mln; `query_ministries` and `ministries.json` agree.
- **Methodology:** `docs/data-methodology/ministries-expenditure-methodology.md` §6.10 (name the Council explicitly).

### Task 2: Municipal population at full precision (W2)

- **Why:** `MUNI-C1`, `MUNI-D2`, `DEMO-C1`, `REG-B3` (confirmed): `readMatrix` uses `raw: false`
  (`apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts:431`), so `data/imports/municipal-population-2025.csv` holds
  displayed 1-decimal thousands (Lentekhi 5.1 vs stored 5.145). 39/64 per-resident values off by 1–3 GEL; municipal and demography
  pages show different populations.
- **Files:** `prepareGeostatPackage.ts` (read stored values, as `lib/data/demography/readStoredSheet.ts:82` does);
  `scripts/prepare-municipal-population-2025.ts`; `data/imports/municipal-population-2025.csv`; the regional-GDP inputs read by the
  same helper; tests under `apps/web/tests/data/municipalIndicators/`.
- **Steps:**
  - [x] Failing test: Lentekhi 2025 = 5,145 persons; Tbilisi 1,335,671.
  - [x] Switch to stored values; regenerate with `npm run data:prepare-municipal-indicators` then `npm run data:prepare-municipal-population` (that order — see memory note in `data-validate-real-gates`).
  - [x] Confirm the 64 values equal the demography CSV's 2025 municipal populations and that the reconciliation residual becomes 0 (MUNI-C2).
- **Verify:** `npm run data:check-municipal-indicators && npm run data:check-municipal-population`; per-resident values change for exactly 39 municipalities (spec §1a: Lentekhi 3,307 → 3,278, Kazbegi 3,476 → 3,457, Oni 4,373 → 4,396 …), Racha-Lechkhumi region 3,209 → 3,214, Abasha/Terjola swap ranks 40/41; `query_municipal` agrees; Tbilisi population equals the demography page (1,335,671).
- **Methodology:** `docs/data-methodology/municipal-population-regional-gdp.md` (drop "published rounding" residual explanation).

### Task 3: Decimal-safe rounding in the shared formatter (W3)

- **Why:** `DEBT-D3`, `INF-D1` (confirmed): `lib/explorer/format.ts:91` and `lib/explorer/inflationGrid.ts:26` use `toFixed`;
  `(0.95).toFixed(1) = "0.9"`, `(1.45).toFixed(1) = "1.4"`, `(7.35).toFixed(1) = "7.3"`, but `(10.25).toFixed(1) = "10.3"`.
  Pages and Excel disagree (1.65 → 1.6% page, 1.7% Excel).
- **Files:** `apps/web/lib/explorer/format.ts` (`formatSignedFixed` behind `formatShare`/`formatPoints`), `apps/web/lib/explorer/inflationGrid.ts:26` (`displayedValue`), `lib/explorer/inflationCategoryLabels.ts:28,38`, `lib/explorer/inflationLabels.ts:21`, `components/inflation/inflation-category-indicators.tsx:82`, `components/demography/population-pyramid.tsx:93`, `components/main-explorer/editorial-line-chart.tsx:184`, `components/analysis/every-100.tsx:53`; tests in `tests/explorer/format.test.ts`.
- **Scope after the deep dive (spec §1a):** about 51 displayed values — inflation national/categories/cities 22, inflation products 28 (rate = index − 100), debt rate 1. The correct Intl path (`fixed()`) is the model: it already rounds 0.95 → 1.0.
- **Steps:**
  - [x] Failing tests: 0.95 → "1.0"; 1.45 → "1.5"; 7.35 → "7.4"; 1.65 → "1.7" (in both `formatShare` and `displayedValue`); 12.85 → "12.9"; −0.95 → "−1.0"; 10.25 → "10.3"; product index 99.05 → "−1.0%".
  - [x] Replace the `toFixed` rounding in every file above with the same rounding Intl uses (simplest: let `fixed()` do the rounding and derive the sign from its output); keep "−0.0 reads as 0.0".
  - [x] Re-run the tie scan (`tie-scan.mjs` approach) and the inflation, debt and product unit tests; `published_value`-fed pages must not change.
- **Owner decision (2026-10-13):** fix the rounding everywhere **and show interest rates with 2 decimals**, as the Ministry of Finance and NBG publish them. Inflation and all other percentages stay at 1 decimal (Geostat's releases use 1). Showing 2 decimals without the rounding fix would make things worse: measured on our data, inflation would go from 50 to ~600 mis-rounded cells, because most CPI values are stored with 3–4 decimals.
  - [x] **Debt rates — re-read before showing 2 decimals.** `debt.rate.total` 2015–2025 comes from chart labels in the July 2026 monthly debt report at 1 decimal (2022 = 3.9; MoF prints 3.97 elsewhere — `DEBT-A3`). Re-read every year from the MoF document that prints 2 decimals (debt-management strategy tables, Bulletin N26, Strategy 2027–2030; the latter also gives 2025 domestic 8.88 / external 2.71 — `DEBT-A1`). Domestic/external values printed as 8.3, 9.2, 3.4 must be checked against their source table for a second decimal. Where a publisher prints only one decimal, show that value as printed (never pad "3.1" to "3.10") and say so in the methodology. Regenerate with `npm run data:prepare-government-debt`; update `docs/data-methodology/government-debt-annual.md`.
    *Done 2026-10-13:* no reviewed document prints the General Government total to two decimals year by year (Bulletin N25's
    two-decimal series is Public Debt; 3.97 for 2022 is a preliminary estimate), so the totals stay at the one decimal printed
    and no debt data changed; component rates show their source's decimals. A two-decimal total waits for Task 13.
  - [x] **Debt display:** rates table, chart tooltips, latest-value line and the rates workbook (`components/debt/debt-explorer.tsx`, `lib/explorer/debtWorkbook.ts`) show the stored precision (2 decimals) instead of 1 — as shipped, each rate at its source's decimals (see the note above).
  - [x] **Bank rates:** `moneyBanksDisplayDecimals` (`apps/web/lib/data/moneyBanks/validation.ts:53`) returns 2 only for `rates.policy`; return 2 for every `rates.*` indicator (loan and deposit rates, GEL/FX/total), whose NBG sources print 2 decimals (`MONEY-C3`). FSI ratios and money aggregates stay at 1. Regenerate with `npm run data:prepare-money`; the money pages and workbook read `published_value`, so they pick up the new precision. Update `docs/data-methodology/money-banks-annual.md`.
  - [x] **DESIGN.md §(numbers):** amend "Percentages carry 1 decimal" with the exception "interest rates show 2 decimals, as the Ministry of Finance and NBG publish them".
- **Verify:** `npx vitest run tests/explorer`; inflation core ex-tobacco Nov 2014 shows 1.7 in the grid, label and Excel; product p0028 May 2024 shows −1.0%; debt external rate 2021 shows 0.95%; debt total 2022 shows the re-read MoF value (3.97 if confirmed); loan rate 2010 shows 18.56%; policy rate unchanged; browser specs for debt and money updated only where the precision is the change.
- **Methodology:** `docs/data-methodology/bilingual-presentation.md` (half-up rounding of displayed decimals; interest rates at 2 decimals), `government-debt-annual.md`, `money-banks-annual.md`.

### Task 4: Labels that make correct numbers read wrongly (W10–W13, W15, W16)

- **Why / files:**
  - `REV-C3`, `REV-A7`: `apps/web/lib/explorer/explorerData.ts:81-83` labels the revenue total "მთლიანი შემოსავლები" / "Total revenue"; use "შემოსულობები სულ" / "Total receipts" (as `lib/i18n/messages/en/landing.json:30` already does).
  - `EXPF-B1`: same file, "Total expenditure" → "Total payments" (ka "გადასახდელები სულ"), or keep the label and add a one-line note under the chart that it includes debt repayment and financial assets. **Owner decision O1.**
  - `TRADE-D1`: `lib/i18n/messages/{en,ka}/trade.json:9` `trade.services.total` is used for every measure; add measure-specific labels ("Total services exports/imports/balance") in `components/trade/trade-partners-series-panel.tsx`, `components/trade/trade-partners.tsx:36` and `lib/explorer/tradePartnersWorkbook.ts:38`.
  - `ENERGY-D1`: `lib/explorer/energyFoodHubCards.ts:8-10` uses wheat as the food card headline; label the card value "Wheat" (or pick another headline — owner decision O2).
  - `WAGE-D1`: `components/wages/wages-explorer.tsx:110,133,147` — lead line, row labels and caption follow the selected measure (median/average).
  - `LIV-C1`/`LIV-D1`: `lib/methodology/content/{en,ka}/household-income.ts:79` and `docs/data-methodology/household-income-spending-annual.md` — "steps down" → "steps up (Racha-Lechkhumi and Kvemo Svaneti separated)".
  - `ENERGY-B1` (confirmed: GNERC 2023 annual report "3.445 million kWh of electricity was transited"; our 2023 imports 4,234.3 / exports 4,912.9 GWh): `lib/methodology/content/{en,ka}/energyFood.ts:76` says imports and exports are "electricity bought and sold abroad" — state that Geostat's figures include transit through Georgia (≈3.4 TWh each way in 2022–23) and add the same note on `/explorer/energy-food/electricity`. Showing trade net of transit is owner decision O10.
- **Verify:** browser specs for revenue, trade services, wages and energy hub (update expected labels only where the label is the change); `npm run i18n:check`.
- **Methodology:** `revenue-methodology.md`, `treasury-functional-expenditure-methodology-2004-2025.md`, `trade-annual.md`, `energy-food-annual.md`, `wages-annual.md`, `household-income-spending-annual.md`.

### Task 5: One services figure across Trade and Current account (W7)

- **Why:** `CA-B1`, `TRADE-B2` (confirmed): 2024 services exports 7,706.3 M (trade, Geostat table 31.10.2025) vs 7,769.1 M (current account, NBG 30.09.2026).
- **Now:** add a one-line note on Trade → Services naming the vintage and the newer NBG figure; fix `docs/data-methodology/trade-annual.md:74` ("NBG agrees with Geostat").
- **When Geostat publishes its late-October services update:** refresh `data/imports/trade-services-annual.csv` (Task 9) and remove the note if the figures agree.
- **Verify:** both pages show the same 2024 services exports, or the note explains the difference.

## Phase 2 — Extraction and mapping errors

### Task 6: Municipal 2016–2019 function basis (W8)

- **Why:** `MUNI-A1`, `MUNI-A2` (confirmed by script: functions exceed totals in 61–63/64 municipalities, max 1.135), `MUNI-B2` (IMF 8.6–17.3% lower 2015–18), `MUNI-C3` (2020 switch moves series 7–11%), `MUNI-D1`.
- **Steps:**
  - [ ] Establish from the portal archive (`docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022/`) what the 2016–19 functional basis includes (gross of transfers? plan vs actual? capital?).
  - [ ] Report to the owner with numbers; then apply decision **O3**: (a) keep values, mark 2016–19 and the 2020 switch as breaks and compute shares against the functional sum, or (b) replace 2016–19 with a source on the total-payments basis if one exists, or (c) start the functional view in 2020.
  - [ ] Exclude break years from the "movers" board (`MUNI-D1`: −93.1%, +391.1%).
- **Methodology:** `municipal-functional-annual-2015-2025.md`.

### Task 7: Revenue grants 2008–2014 (W9)

- **Why:** `REV-B2` (confirmed: MoF 2010 annual report state-budget grants 471,422.9 thousand vs our 165,424,278), `REV-C2`.
- **Steps:**
  - [ ] Locate the missing 237.6 M (2009) / 306.7 M (2010) in the archived Form #1 PDFs (capital transfers? other revenue? financing rows?).
  - [ ] If they are in another Form #1 row, propose a mapping change (owner decision O4); otherwise add a series caveat for 2008–14 with the MoF figures.
  - [ ] Add a caveat for 2004 (annual report) vs 2005+ (Form #1) on grants, not only other_taxes and asset_decrease (`REV-C2`).
- **Methodology:** `revenue-methodology.md` §9.

### Task 8: Ministry mapping fixes

- **Why / what:** `EXPM-D2` roads program `admin_program.25_02` shown under Regional development 2006–08 while the money sits under Economy — attach the program to its actual parent for those years and fix the `/mcp` wording; `EXPM-C2` 2018 Emergency Management Service (86.2 M) outside internal affairs for one year — align with 2019+; `EXPM-C1` 2005 values from the Dec-2006 budget document — switch to the 2005 execution report if its tables are readable, else caveat (owner decision O5).
- **Files:** `apps/web/lib/data/adminSpending/`, `data/mappings/review/admin-spending-*.csv`.
- **Methodology:** `ministries-expenditure-methodology.md`, `ministries-drilldown-programs-methodology.md`, `2005-2014-ministries-expenditure-methodology.md`.

### Task 9: Small extraction housekeeping

- `REV-C5`: confirm the ~200 staging rows with 9–10 digit codes (2008–15) carry no amount that should reach a fact; add a test either way.
- `DEBT-C2`: 2022 domestic/external rates are MoF preliminary ("2022*") — mark `status` accordingly; `DEBT-A3`: 2022 total rate 3.97, not 3.9.
- `DEF-C1`: blank IMF cell must not become 0 (`prepareGeneralGovernmentBalance.ts:241`) — fail closed.
- `SECT-C2`: XML regex at `prepareEconomicSectors.ts:89` — handle self-closing cells.
- `FDI-C`: English label "Syrian" → "Syria" (`data/localization/en/labels.json:22526`).
- **Methodology:** the matching dataset doc for each.

## Phase 3 — Outdated vintages and source updates

### Task 10: Inflation September 2026 and a monthly routine (W4)
- `INF-A1` (confirmed: Geostat `yoy.xlsx` Georgia JP5 = 105.5683). Archive the September files, update `source-archives/inflation.csv`, regenerate with `npm run data:prepare-inflation` and `data:prepare-inflation-products`. Add a dated "check Geostat's CPI release (≈ 2nd–3rd working day)" line to `docs/data-methodology/inflation-cpi-national.md`.

### Task 11: IMF WEO October 2026 for the deficit (W5)
- `DEF-A1` (confirmed: IMF CR 26/133 line "Net lending / borrowing −3,627 −1,865 −1,885 −2,109 −1,526"). After 13 Oct 2026: archive the new WEO, regenerate with `npm run data:prepare-general-government-balance`, re-diff all 37 rows; if 2022 is still −1.602 bn in the WEO, show it with a note citing the June 2026 staff report (owner decision O6).
- **Methodology:** `general-government-balance.md`.

### Task 12: Revised 2025 Treasury revenue file (W6)
- `REV-A1` (confirmed: treasury.ge lists "იანვარ-დეკემბერი(დაზუსტებული)", id `45c302c8-5b3f-488a-9e15-910c2c8f46c7`). Archive it, update `source-archives/revenue.csv`, regenerate (`data:extract-revenue`, `data:generate-revenue-facts`, `data:compose-budget-facts`), update the pinned 2025 totals in `tests/data/pipelineIntegration.test.ts`. Add "check for a (დაზუსტებული) December file" to `revenue-methodology.md` §10; mark the newest year "pre-audit" (`REV-A6`).

### Task 13: Debt — Bulletin N26 and Strategy 2027–2030
- `DEBT-A1`, `DEBT-A2`: archive Bulletin N26 and the strategy; refresh the 2026–30 forecast and fill the 2025 component rates (8.88% / 2.71%). `DEBT-C1`: make `source_id` on 2013–22 service rows name every bulletin used.
- **Methodology:** `government-debt-annual.md`.

### Task 14: Geostat's new file addresses (cause C1)
- Replace dead `/media/<id>` links in `data/methodology/source-archives/{gdp,economic-sectors,inflation,…}.csv` and in `docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv` (its `retrieved_file_url` feeds every "% of GDP" workbook's Sources sheet through `apps/web/lib/methodology/workbookSources.ts:196`). Then regenerate the public manifests, `sources.json`, the fact-query snapshot and publications (`data:prepare-methodology-archives`, `data:prepare-fact-query-snapshot`, `data:prepare-fact-query-publications`). Add the link-format test from the Reuse table. Record "values unchanged" with the sha256 comparison (agents found annual values identical in the re-issued files). Known new ids: GDP current prices `media/82790`, real growth `82794`, constant prices `82792`; inflation's 16 monthly files: take the ids from Geostat's CPI page at refresh time.
- **Methodology:** `public-methodology-and-source-archives.md` (Geostat re-issues files; re-check links on every refresh).

### Task 15: Upcoming releases calendar (no code)
- Add to each dataset doc the next release and what to re-check: GDP revision 13 Nov 2026 (per-person base, `W14`); regional GDP 23 Dec 2026; demography revision of 2015–24 announced (`DEMO-A1`); trade services late Oct 2026; NBG BoP 30 Dec 2026; remittances 15 Oct; money 26 Oct; LFS/HIES re-weighting to the 2024 census (`UNEMP-A2`, `LIV-A1`).

## Phase 4 — Display, rounding, labels, markers

### Task 16: Series-break markers (cause C3)
- Pass the existing `breaks` / `breakYears` with a short label in: GDP (`components/gdp/gdp-overview.tsx:217`, 2010 SNA), budget and current-account % of GDP (2010 SNA), revenue (2008 social tax; also exclude income tax and other taxes across 2007/08 from "fastest growth"), municipal (2016, 2020), trade domestic exports (2019), money (2015 rates and aggregates, Dec 2017 capital rules, 2022/2023 bank health — `money-banks-explorer.tsx:127-128`), FDI (2009 BPM6), remittances (2010 microfinance; pre-2008 coverage), unemployment (2017 survey), wages (1995–97, 2006), inflation (5→6 cities 2016).
- **Verify:** one browser spec per affected page asserts the marker; `npm run test:browser`.
- **Methodology:** each dataset doc names its breaks (and `money-banks-annual.md` corrects "neither file explains" for the 2022 ROE break — NBG switched to after-tax income, `MONEY-A1`).

### Task 17: Preliminary and revisable marks (cause C8)
- GDP 2025 on hub footer (`economyHubCards.ts:55`), landing row (`landingDatasets.ts:48`) and workbooks (`gdpWorkbook.ts:62`); economic sectors `hollowPreliminary` (`economic-sectors-explorer.tsx:185`); a "latest years may be revised" line for FDI, current account and trade 2025; revenue 2025 "pre-audit".

### Task 18: "Updated" dates show the dataset's release (cause C5)
- `lib/pages/expenditure.tsx:42`, `lib/pages/revenue.tsx:40`, regional economies and current account: use the dataset's own source date, not the newest across all sources or our review date.

### Task 19: Workbook and table formatting
- Deficit small amounts "(0.0)" → `applySignedAmountFormat` (`DEF-D1`); FDI unpublished cells `not_available` (`FDI-D2`); debt table footing and whole-billion rounding (`DEBT-D1`, `debt-explorer.tsx:83-89`); regional and FDI units so small values are readable (`REG-D1`, `FDI-D1`); wages median "1,531.0" (`WAGE-D2`); inflation Excel "+0.0/−0.0" (`INF-D`); money headline 72.5 vs table 72.45 (`MONEY-D4`); debt rate workbook subtitle "Not available" (`DEBT-D2`).

### Task 20: Wording fixes
- Georgian "სახელმწიფო ვალი" and "central-government" → general-government wording for debt (`DEBT-D5`, `DEBT-B2`); wages regions index "Georgia" label (`WAGE-D3`); living-standards "current prices" and "consumption spending" on hub (`LIV-D2`, `LIV-D3`); "Money from abroad" label clash between external flows and living standards (`REM-B1`).

## Phase 5 — Source swaps or additions (all need owner decision)

See the owner-decision list below (O1–O9). No swap is scheduled without a decision.

## Phase 6 — Documentation and provenance

### Task 21: Honest source archive (cause C6)
- Label the 12 Openpyxl-generated expenditure workbooks as "Fiscal.ge extraction of <official PDF>" in the public manifest and methodology page; strip local paths from their `metadata` sheets (`C:\Users\…`, `C:\tmp\…`); add publisher URLs to `source-archives/expenditure.csv` and `revenue.csv` (Treasury ShowFiles ids are in the REV-A report); fix the 2004 MoF dead URL note; create a `deficit` registry and a `/methodology/deficit` page (or link deficit to an existing methodology page — owner decision O7).
- **Verify:** `npm run data:check-methodology-archives`; archive smoke test.

### Task 22: Bridge sentences for definitions (cause C9)
- One sentence each where readers compare with international figures: unemployment vs ILO/World Bank (subsistence farmers; 2020 gap = 447.3 k); debt vs IMF/World Bank general government; deficit IMF vs MoF national definition; household income/spending headline lines vs Geostat's "total inflows"/"total expenditure"; Gini vs World Bank; remittances vs World Bank/IMF personal remittances; regional GDP market vs basic prices and occupied territories; wages quarterly vs annual average; inflation core with vs without tobacco; inflation contributions approximate (`INF-B1`); money-transfer coverage by named systems (`REM-A3`); FDI 1996 single-country value.
- **Methodology:** the matching dataset docs and `lib/methodology/content/{en,ka}/*.ts`.

### Task 23: Validation evidence that proves what it claims (cause C7)
- Extend the dataset checks so each value's sheet header (year, group, label) is compared with the CSV row, not only the value at the cell (unemployment, wages, energy, trade, FDI, transfers); run the research-package `verify_independent.*` scripts in `data:validate` or record why not; commit or test-pin the expenditure/revenue reconciliation evidence instead of leaving it git-ignored (`REV-C4`, `EXPF-C3`); tighten the remittances sum-to-total tolerance from ~1 M USD to cents (`REM-C1`).
- **Methodology:** `database-import.md` (what `data:validate` proves).

---

## Decided by the owner

- 2026-10-13 — Ministry view: misplaced non-ministry bodies go to *Other costs* (Task 1).
- 2026-10-13 — Rounding: fix the rounding code everywhere; interest rates (debt, banks) show 2 decimals as published; everything else stays at 1 (Task 3).
- 2026-10-13 — Priority: the three wrong numbers (Tasks 1–3) first; the rest of this plan waits.

## Needs owner decision

| # | Decision | Options | Recommendation |
|---|---|---|---|
| O1 | Spending total label | "Total payments" vs keep "Total expenditure" + note vs add a "expenditure excl. financing" series | Rename to payments and add the note |
| O2 | Food hub card headline | wheat (relabelled) vs average of staples vs another product | Relabel as wheat |
| O3 | Municipal 2016–19 functions | mark breaks + functional-sum shares / replace source / start in 2020 | Mark breaks now; decide replacement after Task 6 findings |
| O4 | Revenue grants 2008–14 | remap if found in Form #1 / caveat only / switch to MoF statistics | Decide after Task 7 |
| O5 | 2005 ministry values | execution report vs 2006 budget document | Execution report if readable |
| O6 | Deficit 2022 if the Oct WEO still has −1.602 bn | keep WEO + note / use staff-report value | Keep WEO + note (one source per series) |
| O7 | Deficit methodology | new `/methodology/deficit` page vs section in debt methodology | New page |
| O8 | Pre-2015 NBG loan/deposit rates | keep NBG annual + break marker / serve Q4 for all years | Keep NBG annual + marker |
| O9 | Add a national (MoF) deficit series, an ILO-comparable unemployment note, Geostat headline household lines, chain-linked inflation contributions | each optional | Notes now; new series only on request |
| O10 | Electricity imports/exports | keep Geostat totals with a transit note / subtract GNERC transit (adds a second source) | Keep Geostat totals with the note |

## Not doing, and why

- **Switching any dataset to a "better" source:** no alternative was more complete or more primary than ours in any dataset;
  every international series checked (World Bank, IMF, UN, ILO, Comtrade) re-serves Geostat/NBG/MoF data or models it.
- **Re-extracting data that rebuilt exactly** (14 datasets complete, the rest sampled): no extraction error was found.
- **Chasing every low finding** (≈280): most are wording, unused fields (`published_value` shipped but unused in unemployment),
  or test-hygiene items; they stay in the per-task reports and can be picked up opportunistically.
- **Recomputing GDP per person on the census population ourselves (W14):** it would replace Geostat's published figure with our
  own; add the caveat now and take Geostat's revised series on 13 Nov 2026.
- **Back-casting municipal 2015 totals from the portal's `totals.zip`** until Task 6 settles the basis (one decision for 2015–19).
