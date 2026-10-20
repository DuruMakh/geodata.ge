# Farming Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth page, Farming (`/explorer/energy-food/farming`), to the Energy and food hub, serving 708 Geostat agriculture values.

**Architecture:** The farming values join the existing Energy and food pipeline end to end: research package (`docs/Raw Data/EnergyFood/geostat-energy-food-annual/`), canonical CSV `data/imports/energy-food-annual.csv`, the `EnergyFoodFact` table (unit is a free string, so no migration), and the Energy and food explorer. The explorer learns three optional things — a row heading, a per-series unit and a "group" for the one-unit rule (`unitList.ts`) — whose absence leaves the four existing pages unchanged.

**Tech Stack:** Python 3 stdlib (research package), Node + SheetJS (independent check), Next.js 16 / TypeScript / Vitest / Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-farming-design.md`

## Global Constraints

- Page path `/explorer/energy-food/farming`, English mirror `/en/explorer/energy-food/farming`; Georgian title `სოფლის მეურნეობა`, English `Farming`; fifth card and fifth sidebar row, after Food self-sufficiency.
- Under the heading only the latest line: `Farm output · 2025: 8,384.9 million ₾` (Georgian equivalent); must fit one line at 375px.
- No tabs, no icon switches. 41 rows, flat, every row under one of five headings; only `farming.output.total` selected first.
- One group on the chart at a time: group = `heading:unit`, except all prices are one group `price`.
- Every served value is Geostat's printed number; nothing derived. A farming dash (`-`) is "not available", never 0: a dash in a served farming cell is an error.
- Display decimals follow each cell's number format: `#,##0.0`, `0.0`, `#\ ##0.0` → 1; `0.00` → 2; `General` → stored value (prices must then have ≤ 2 decimals).
- Farming rows: `last_reviewed_at` and source `retrieved_at` = `2026-10-20`; energy rows keep `2026-10-11`.
- Output 2025 (header `2025*`) is `value_status = preliminary`; all other farming cells `published`.
- English for code and docs; Georgian labels from Geostat's Georgian files.
- No push, PR or full gates until Duru approves the preview.

## Indicators (exact IDs, in list order)

| Heading key | IDs | Unit | Years | Source ID, sheet, row label |
| --- | --- | --- | --- | --- |
| `output` | `farming.output.{total,crops,livestock,services}` | `million_gel` | 2010–2025 | `geostat_farming_general`, `AG. output`: `Output of agriculture, total`, `Plant growing`, `Animal husbandry`, `Agricultural services` |
| `harvests` | `farming.harvest.{wheat,barley,maize,beans,potatoes,vegetables,melons}` | `thousand_tonnes` | 2006–2025 | `geostat_farming_annual_crops`, `Production`: `Wheat, total`, `Barley, total`, `Maize`, `Haricot Beans`, `Potato`, `Vegetables, total`, `Melons` |
| `harvests` | `farming.harvest.{grapes,apples,peaches,tangerines,hazelnuts,walnuts}` | `thousand_tonnes` | 2006–2025 | `geostat_farming_permanent_crops`, `Permanent Crops production`: `Grapes`, `Apple`, `Peach, nectarine`, `Tangerine`, `Hazelnut`, `Walnut` |
| `livestock` | `farming.livestock.{cattle,dairy_cows,pigs,sheep_goats,poultry}` | `thousand_head` | 2006–2025 | `geostat_farming_livestock_numbers`, `Number of livestock`: `Bovine animals`, `Dairy cows and buffaloes`, `Pigs`, `Sheep and goats`, `Poultry, ths. heads` |
| `products` | `farming.products.{meat,beef,pork,sheep_goat_meat,poultry_meat}` | `thousand_tonnes` | 2006–2025 | `geostat_farming_livestock_products`, `Livestock products`: `Meat, total`, `Beef`, `Pork`, `Sheep and goat`, `Poultry` |
| `products` | `farming.products.milk` / `farming.products.eggs` | `million_litres` / `million_pieces` | 2006–2025 | same: `Milk (mill. litres)`, `Egg (mill. pieces)` |
| `prices` | `farming.price.{wheat,maize,potatoes,tomatoes,apples,grapes,hazelnuts,beef,pork,poultry_meat}` | `gel_per_kg` | 2014–2025 | `geostat_farming_prices`, `Prices`: `Wheat`, `Maize`, `Potato`, `Tomato`, `Apple`, `Grapes`, `Hazelnut`, `Beef`, `Pork`, `Poultry meat` |
| `prices` | `farming.price.milk` / `farming.price.eggs` | `gel_per_litre` / `gel_per_piece` | 2014–2025 | same: `Milk (1 litre)`, `Egg (1 piece)` |

The list order is the table order above (harvests: the seven annual crops, then the six permanent crops; products: the five meats, milk, eggs). Counts: 64 + 260 + 100 + 140 + 144 = **708** farming observations; the CSV grows from 681 to **1,389**.

Sources (English, all `https://geostat.ge/media/...`, page `https://www.geostat.ge/en/modules/categories/196`):

| Source ID | Local file | Media path |
| --- | --- | --- |
| `geostat_farming_general` | `official/farming-general.xlsx` | `80145/1.General_Agro_Sector_Statistics_ENG.xlsx` |
| `geostat_farming_annual_crops` | `official/farming-annual-crops.xlsx` | `80146/3.Production_of_Annual_Crops_ENG.XLSX` |
| `geostat_farming_permanent_crops` | `official/farming-permanent-crops.xlsx` | `80149/6.Production_of_Permanent_Crops_ENG.xlsx` |
| `geostat_farming_livestock_numbers` | `official/farming-livestock-numbers.xlsx` | `80150/8.Livestock_Numbers_%28Annual%29_ENG.xlsx` |
| `geostat_farming_livestock_products` | `official/farming-livestock-products.xlsx` | `82387/10.Livestock_Products_%28Annual%29_ENG.XLSX` |
| `geostat_farming_prices` | `official/farming-prices.xlsx` | `81972/17.Agricultural_Production_Prices_ENG.XLSX` |

Georgian label copies (`{id}_ka`, `official/ka/{file}-ka.xlsx`, page `https://www.geostat.ge/ka/modules/categories/196`): media `80131/1.soflis_meurneobis_seqtoris_zogadi_statistika_GEO.xlsx`, `80132/3.ertwliani_kulturebis_warmoeba_GEO.XLSX`, `80135/6.mravalwlovani_kulturebis_warmoeba_GEO.xlsx`, `80136/8.pirutyvis_suladoba_%28wliuri%29_GEO.xlsx`, `82386/10.mecxoveleobis_produqtebis_warmoeba_%28wliuri%29_GEO.XLSX`, `81971/17.sasoflo_sameurneo_produqtebis_fasebi_GEO.XLSX`. Page capture: `geostat_agriculture_page`, `official/agriculture-page.html`.

## Review Focus

1. **A farming dash read as zero.** Geostat's farming `-` means "no data (small sample)"; it must fail the build if it ever lands in a served cell, unlike the energy `-` (no flow → 0). Test in Task 1 and Task 2.
2. **Mixed-unit hash.** A shared URL like `#sel=farming.harvest.wheat,farming.price.wheat` must open with only the first row's group selected and years 2006–2025, not a mixed chart. Test in Task 3.
3. **Range kept across groups.** With prices selected (2014–2025) a reader who then ticks Farm output total must see 2010–2025 clipped to the kept range, never years with no data for every series. Test in Task 3.
4. **Existing pages unchanged.** Energy supply, Electricity, Energy use and Food self-sufficiency keep their order, colours, default, decimals and hash format. Existing tests pass untouched (except counts that genuinely change).
5. **"Updated" date of energy pages.** Adding farming rows reviewed 2026-10-20 must not change the energy pages' "updated" date (2026-10-11). Test in Task 4.

---

### Task 1: Research package reads the farming workbooks

**Files:**
- Create: `docs/Raw Data/EnergyFood/geostat-energy-food-annual/official/farming-*.xlsx` (6), `official/ka/farming-*-ka.xlsx` (6), `official/agriculture-page.html`
- Modify: `docs/Raw Data/EnergyFood/geostat-energy-food-annual/prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`
- Regenerated: `source-manifest.csv`, `source-manifest.json`, `energy-food-annual.csv`, `coverage.csv`, `validation-report.json`, `independent-validation.json`

**Interfaces:**
- Produces: research `energy-food-annual.csv` with 1,389 rows (same `FIELDS`); new `unit` values `million_gel`, `thousand_tonnes`, `thousand_head`, `million_litres`, `million_pieces`, `gel_per_kg`, `gel_per_litre`, `gel_per_piece`; new `value_status` `preliminary`.

- [ ] **Step 1: Download the 13 files** with `curl -sSL -A "Mozilla/5.0"` into a fresh directory, then copy to the local names above. Expected SHA-256 of the English files (identical to the copies in `/mnt/project-files/energy-farming-sources/farming/` on 2026-10-20): general `9c5eaa42…`, annual crops `aa3051cc…`, permanent `13742de3…`, livestock numbers `f04a2333…`, products `fa442e9b…`, prices `12d4c7e0…`.

- [ ] **Step 2: Write failing tests in `test_validation.py`**: `test_primary_count_is_1389`; `test_farming_spot_values` asserting published values `farming.output.total 2025 = 8384.9`, `2010 = 2777.4`, `farming.harvest.wheat 2025 = 145.3`, `farming.harvest.grapes 2025 = 348.9`, `farming.harvest.hazelnuts 2025 = 49.3`, `farming.livestock.cattle 2006 = 1080.3`, `2025 = 761.6`, `farming.products.milk 2025 = 556.2`, `farming.products.eggs 2025 = 692.9`, `farming.price.wheat 2025 = 0.57`, `farming.price.beef 2025 = 21.38`, `farming.price.milk 2025 = 1.63`; `test_farming_dash_fails` (a `-` substituted into a served farming cell raises); `test_output_sum_fails_when_violated`; `test_meat_and_milk_sums_fail_when_violated`; `test_dairy_cows_never_exceed_cattle`; `test_food_balance_production_matches` (and fails when a production value is shifted by 1); `test_only_output_2025_is_preliminary`.

- [ ] **Step 3: Run** `python3 test_validation.py` (from the package directory). Expected: the new tests FAIL.

- [ ] **Step 4: Extend `prepare.py`.**
  - Per-source `retrieved_at` (`2026-10-11` energy, `2026-10-20` farming) instead of the single `RETRIEVED_AT` in `manifest()`.
  - `FARMING_CELLS`: (indicator, source_id, sheet name, row label) from the table above; year columns from the row-2 headings, where `2025*` reads as year 2025 with status `preliminary`. Rows found by `norm()` label text; `Wheat, total` etc. must match exactly once.
  - `_unit()` returns the farming unit from `FARMING_UNITS`; `display()` takes decimals from the cell format per Global Constraints (`#\ ##0.0` included) and rejects any other format for farming.
  - `cell_value()` for a farming source raises on `-` or `…`.
  - Checks in `validate()`: output total = crops + livestock + services within 0.5; meat total = beef + pork + sheep and goat + poultry + `Other meet` (read for the check, not served) within 0.2; milk = `Dairy cow and buffalo milk` + `Sheep and goat milk` within 0.2; dairy cows ≤ cattle every year; food-balance `Domestic production` equals the farm table within 0.6 for wheat, maize, potato, vegetables, grapes, meat, beef, pork, sheep and goat meat, poultry meat, milk and eggs, every year 2014–2025, except grapes 2014 (165 against 172.6; Geostat gives no reason — record it in the report); prices with `General` format have ≤ 2 decimals.
  - Report: `scope` mentions farming 2006–2025; `observations_by_group` gains `farming`; `checks` lists the new checks; `preliminary_cells` lists the 4 output 2025 cells.

- [ ] **Step 5: Extend `verify_independent.mjs`** with separately written farming label tables (compacted labels), the expected count 1,389, a farming `shown()` by cell format (1 or 2 decimals, General as stored), unit and `preliminary` status; add negative controls `farming_value_altered_detected` (`farming.harvest.wheat` 2025 → 145.4) and `farming_status_altered_detected` (output 2024 marked preliminary).

- [ ] **Step 6: Regenerate and run.** `python3 prepare.py && node verify_independent.mjs --write && python3 test_validation.py && python3 prepare.py --check`. Expected: `{"status": "passed", "primary_observation_count": 1389}`, independent status `passed`, all tests OK.

- [ ] **Step 7: Update `README.md`**: farming sources table, cell map rows, new checks, counts (681 → 1,389), the grapes 2014 exception.

- [ ] **Step 8: Commit** `feat(farming): research package reads Geostat agriculture tables`.

### Task 2: Serving contract and canonical CSV

**Files:**
- Modify: `apps/web/lib/data/energyFood/types.ts`, `validation.ts`, `prepareEnergyFood.ts`, `importEnergyFood.ts`; `apps/web/scripts/import-budget-facts.ts` only if the source-document list does not already follow `ENERGY_FOOD_PUBLIC_SOURCES`
- Regenerated: `data/imports/energy-food-annual.csv`, `data/reports/energy-food-validation.json`
- Modify: `docs/data-methodology/energy-food-annual.md`, `docs/deployment.md` (row count 681 → 1,389, no migration)
- Test: `apps/web/tests/data/energyFood/energyFood.test.ts`

**Interfaces:**
- Consumes: research CSV from Task 1.
- Produces:
  - `ENERGY_FOOD_INDICATORS` gains the 41 IDs (Task 3 relies on the exact strings).
  - `EnergyFoodFact["unit"]` = `"ktoe" | "gwh" | "percent" | "million_gel" | "thousand_tonnes" | "thousand_head" | "million_litres" | "million_pieces" | "gel_per_kg" | "gel_per_litre" | "gel_per_piece"`; `valueStatus` adds `"preliminary"`.
  - `ENERGY_FOOD_UNIT_DECIMALS`: new units 1, `gel_per_*` 2.
  - `ClientEnergyFoodFact` adds `unit`.
  - `ENERGY_FOOD_SOURCES` adds the 6 farming IDs; `ENERGY_FOOD_PUBLIC_SOURCES` adds the 6 `_ka` IDs and `geostat_agriculture_page`.

- [ ] **Step 1: Write failing tests**: `serves all 1,389 reviewed values` (replaces the 681 test; 681 energy and food rows unchanged byte-for-byte except none); `farming rows are reviewed 2026-10-20 and energy rows 2026-10-11`; `only farm output 2025 is preliminary`; `energyFoodDisplayDecimals` table adds `["#\\ ##0.0", 1]`, `["0.00", 2]`; `a price published with three decimals is rejected`; `a farming no_flow row is rejected`; `client facts carry unit` (e.g. `farming.price.milk` → `gel_per_litre`, decimals 2).

- [ ] **Step 2: Run** `npx vitest run tests/data/energyFood/energyFood.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Coverage in `validation.ts`: output 2010–2025, prices 2014–2025, other farming 2006–2025; unit per indicator from one `FARMING_UNITS` record in `types.ts` (shared with Task 3 via `energyFoodIndicatorUnit(id)`); farming `no_flow` invalid; `preliminary` valid only for farming output 2025; expected source and sheet per farming prefix. `prepareEnergyFood.ts`: `lastReviewedAt` = `2026-10-20` for `farming.*`, else `REVIEWED_AT`; acceptance `reviewedAt` = the latest. `toClientEnergyFoodFact` passes `unit`.

- [ ] **Step 4: Regenerate** `cd apps/web && npm run data:prepare-energy-food && npm run data:check-energy-food`. Expected: `{"status":"passed","scope":"energy_food_annual"}`; CSV has 1,390 lines with header.

- [ ] **Step 5: Run** `npx vitest run tests/data/energyFood/energyFood.test.ts`. Expected: PASS.

- [ ] **Step 6: Docs** — `energy-food-annual.md`: farming sources, IDs, units, checks, dash rule, preliminary rule, counts; `deployment.md` count.

- [ ] **Step 7: Commit** `feat(farming): serve 708 farming values through the energy and food contract`.

### Task 3: Explorer model — farming section, headings, one group at a time

**Files:**
- Modify: `apps/web/lib/explorer/energyFood.ts`, `apps/web/lib/explorer/energyFoodHubCards.ts`
- Test: `apps/web/tests/explorer/energyFood.test.ts`

**Interfaces:**
- Consumes: `ClientEnergyFoodFact.unit`, `energyFoodIndicatorUnit(id)` and the IDs from Task 2; `keepOneUnit`, `parseUnitListHash`, `changeUnitListSelection`, `unitListCoverage` (with `groupOf`) from `lib/explorer/unitList.ts`.
- Produces:
  - `ENERGY_FOOD_SECTIONS` gains `{ id: "farming", href: `${ENERGY_FOOD_HUB_PATH}/farming`, labelKey: "common.farming" }` last.
  - `EnergyFoodSeriesDefinition` gains optional `heading?: "output" | "harvests" | "livestock" | "products" | "prices"`.
  - `energyFoodGroup(id: string): string` — `"price"` for `farming.price.*`, `${heading}:${unit}` for other farming rows, the unit otherwise.
  - `energyFoodCoverage(section, facts, selectedIds = [])` — the selection's group's years (all of the section's years when empty).
  - `parseEnergyFoodHash` uses `parseUnitListHash(..., groupOf)`; new `changeEnergyFoodSelection(state, section, next, facts): EnergyFoodState` wraps `changeUnitListSelection`.
  - `EnergyFoodModel` gains `unit: EnergyFoodUnit` (first selected series' unit, else the first series') and `unitKey: string` (`"price"` for a price group, else the unit) — Task 4 names units by `unitKey`. `energyFoodUnit(section)` is removed once nothing calls it.
  - Colour: the reference is ink; any other series takes `ENERGY_FOOD_PALETTE[i]`, `i` = its position among the non-reference series of its group (the existing pages, one group each, keep their colours).

- [ ] **Step 1: Write failing tests**:
  - `farming lists 41 rows under five headings in the spec's order, output total first and selected alone` (assert first and last IDs of each heading and `defaultEnergyFoodState("farming").selectedIds` = `["farming.output.total"]`).
  - `a shared hash that mixes groups keeps the first row's group` (`#sel=farming.harvest.wheat,farming.price.wheat` → `["farming.harvest.wheat"]`, years 2006–2025).
  - `ticking a price after the output total replaces the selection and clamps the years to 2014–2025`; then `ticking the output total again keeps 2014–2025` (not collapsed to all).
  - `harvests and meat are separate groups although both are thousand tonnes`.
  - `no colour repeats within any farming group, and the reference is ink`.
  - `the model's unit and unitKey follow the selection` (`farming.price.milk` → unit `gel_per_litre`, unitKey `price`, decimals 2).
  - `the hub has five cards; the farming card reads 2025 · 8,384.9 million ₾ · 2010–2025` (update the existing four-card test).
  - Existing tests for the four pages stay as they are.

- [ ] **Step 2: Run** `npx vitest run tests/explorer/energyFood.test.ts`. Expected: new tests FAIL, old PASS.

- [ ] **Step 3: Implement** in `energyFood.ts` and `energyFoodHubCards.ts` (the card formats its value with the reference fact's unit and `energyFood.unit.<unit>`).

- [ ] **Step 4: Run** `npx vitest run tests/explorer/energyFood.test.ts && npm run typecheck`. Expected: PASS (typecheck may flag callers of `energyFoodUnit`; fix them in Task 4's files only as far as needed to compile, Task 4 finishes them).

- [ ] **Step 5: Commit** `feat(farming): energy and food model lists headed rows one group at a time`.

### Task 4: Page, component, workbook, messages and methodology

**Files:**
- Create: `apps/web/app/(ka)/explorer/energy-food/farming/page.tsx`, `apps/web/app/(en)/en/explorer/energy-food/farming/page.tsx` (copies of the food-self-sufficiency routes with `"farming"`)
- Modify: `apps/web/components/energy-food/energy-food-explorer.tsx`, `apps/web/lib/explorer/energyFoodWorkbook.ts`, `apps/web/lib/pages/energy-food.tsx`, `apps/web/lib/i18n/messages/{ka,en}/energyFood.json`, `apps/web/lib/i18n/messages/{ka,en}/common.json`, `apps/web/lib/methodology/content/energyFood.ts`, `apps/web/lib/methodology/content/en/energyFood.ts`, `data/methodology/source-archives/energy-food.csv`, `data/localization/en/page-revisions.json`, `apps/web/public/llms.txt`
- Test: `apps/web/tests/explorer/energyFood.test.ts` (workbook), `apps/web/tests/seo/routes.test.ts`, `apps/web/tests/methodology/catalog.test.ts`, `apps/web/tests/browser/hubs.spec.ts`, `apps/web/tests/browser/energy-food.spec.ts`

**Interfaces:**
- Consumes: Task 3's model (`unit`, `unitKey`, `heading`, `changeEnergyFoodSelection`, `energyFoodCoverage(section, facts, selectedIds)`).
- Produces: the rendered page with test IDs `energy-food-farming`, `energy-food-latest`, `chart-panel` (`data-unit` = `unitKey`), `energy-food-excel-download`.

- [ ] **Step 1: Write failing tests**:
  - Workbook: `the farming price workbook formats values 0.00 and names the price unit`; `the output workbook marks 2025 preliminary in the status column`.
  - `routes.test.ts`: the energy-food page list includes `/farming`.
  - `catalog.test.ts`: energy-food `fileCount` and `maxYear` follow the archive (13 more archived files if all 13 are listed; `minYear` 2006).
  - Page module unit test (or in `energyFood.test.ts`): `each page's updated date comes from its own facts` (energy-supply → 2026-10-11, farming → 2026-10-20).
  - `hubs.spec.ts`: `ENERGY_FOOD_SECTIONS` gains `"farming"`.
  - `energy-food.spec.ts`: `farming defaults to farm output and states the 2025 value on one line at 375px`; `ticking a price replaces the output selection and the unit label reads ₾ per kg`; `the list shows five headings and every row from the start`.

- [ ] **Step 2: Run** the unit tests above with `npx vitest run <files>`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Component: unit label `t(`unit.${model.unitKey}Long`)`; latest-line suffix per unit (`%`, ` GWh`, ` million ₾` / ` მლნ ₾`, otherwise none); list rows pass `heading` (`t(`heading.${series.heading}`)`) and each row's value formatted with its own decimals; caption is the year only when the section has headings; selection goes through `changeEnergyFoodSelection`; range strip uses the selection's coverage.
  - Workbook: number format `0` for percent, `0.00` for `gel_per_*`, else `#,##0.0`; value header `t(`unit.${unitKey}`)`; status cell `t(`status.preliminary`)` for preliminary facts.
  - Page module: `lastReviewedAt` from the page's own facts.
  - Messages (ka/en): `common.farming`; `energyFood.page.farming.{title,summary,metaTitle}`; `energyFood.heading.{output,harvests,livestock,products,prices}` (headings name their unit, e.g. `Farm output, million ₾`, `Harvests, thousand tonnes`, `Livestock, thousand head`, `Meat, milk and eggs`, `Farm-gate prices, ₾ per kg`); 41 `energyFood.series.farming.*` names from Geostat's own wording in each language (milk and eggs rows carry their unit: `Milk, million litres`, `Eggs, million`; `Milk, per litre`, `Eggs, per piece`); `energyFood.unit.{million_gel,thousand_tonnes,thousand_head,million_litres,million_pieces,price}` and `…Long`; `energyFood.latest.farming`; `energyFood.sourceNote.farming`; `energyFood.status.preliminary`; updated `energyFood.hubSummary` and `metaDescription`.
  - Methodology (ka/en): a Farming section covering spec §5 rules 1–6 and the 708-value check; update the 681 count.
  - Source archive CSV: 13 rows for the new files (same columns as the existing rows, `retrieved_at` 2026-10-20, notes naming the served rows).
  - `page-revisions.json`: `"/explorer/energy-food/farming": "2026-10-20"`; `llms.txt`: one Farming line after Food self-sufficiency.

- [ ] **Step 4: Run** `npx vitest run tests/explorer/energyFood.test.ts tests/seo/routes.test.ts tests/methodology/catalog.test.ts && npm run typecheck && npm run i18n:check`. Expected: PASS.

- [ ] **Step 5: Build and run the two browser specs** against a built server (CLAUDE.md recipe, port 3100): `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/energy-food.spec.ts tests/browser/hubs.spec.ts`. Expected: PASS.

- [ ] **Step 6: Commit** `feat(farming): Farming page in the Energy and food hub`.

### Task 5: Scope and design records, then the preview

**Files:**
- Modify: `Project_Definition.md` (section 2, the Energy and food item: five cards, Farming added, the earlier exclusion lifted for this page), `DESIGN.md` (route list line, §33 Energy and food: the Farming page, headings and the one-group rule)

- [ ] **Step 1: Edit both documents** in the existing style; one paragraph each.
- [ ] **Step 2: Run** `npx vitest run tests/site/datasetHubs.test.ts tests/seo/agentFiles.test.ts`. Expected: PASS.
- [ ] **Step 3: Commit** `docs(farming): record the Farming page in scope and design`.
- [ ] **Step 4: Preview** — screenshots of the hub and the farming page (default, a price selection, table mode) at 390 and 1440 px in both languages into `/mnt/project-files/screenshots/farming/`; post them with the preview card. Push the branch only after Duru picks a clickable preview. Full gates (`npm run check`, `npm run build`, `npm run test:browser`) and the PR only after Duru's OK.
