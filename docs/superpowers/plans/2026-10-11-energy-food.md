# Energy and Food Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual Energy and food hub (`/explorer/energy-food` with `/energy-supply`, `/electricity`, `/energy-use`, `/food-self-sufficiency`, and `/methodology/energy-food`). It serves 681 reviewed Geostat values.

**Architecture:** Follows the Poverty hub file by file (merged in PR #174, merge commit `b733c26`). That means an immutable research package, a TypeScript prepare/check step that writes one canonical CSV, a loader with CSV/DB parity, one private Prisma mirror table, and one client explorer component for all four pages built on the shared explorer shell. `git diff 0cc6eba b733c26 -- <file>` shows exactly what Poverty added to each shared file; copy that addition. **Do not edit any `poverty` file**: the Living standards thread is moving them.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, Python 3 stdlib (research package), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-11-energy-food-design.md`

## Global Constraints

- Yearly data only. Every served value is a Geostat cell. No shares, differences, sums, per-person figures, estimates or interpolation.
- Under each page heading, only the one-line `LatestValueLine` (value plus optional `note`). Nothing else sits under the heading, and the only text under the chart is one `SourceNote` line.
- Tabs are centred `TextTab`s. Energy supply: **Overview | Supply by fuel | Imports by fuel**. Electricity: **Production | Imports and exports | Use**. Energy use: **By user | By fuel**. Food has no tabs.
- On each tab only the first series is selected by default; it stays first, selectable and removable. Selection is unlimited, and search never scopes the bulk action or the count.
- Values show at Geostat's published precision: one decimal for ktoe and GWh, and whole numbers for food (every food cell is formatted to whole numbers).
- A Geostat "-" in a served balance cell is served as 0 with `value_status=no_flow`. A cell with no column (wind before 2016) is a gap, a dash in the table and a blank Excel cell. A "…" cell in any served position fails validation.
- Stable lowercase ASCII IDs only (the ID table in Task 1). Labels are display data.
- The canonical CSV is UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule).
- No MCP tools or central JSON/CSV publications. The fact-query snapshot must not include energy-food sources.
- Workbook reading: find each sheet's XML through `xl/_rels/workbook.xml.rels`, never as `sheet${i + 1}.xml` (the electricity and food workbooks store sheets out of order). Match cells with `/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g`, which handles self-closing cells (the files have up to 86 per sheet). Round `published_value` from the 15-significant-digit value, half-up.
- Excel `numericFormats` keys are 1-based column numbers of the value columns.
- Review before pushing: commit locally only. A live preview goes to Duru (Task 9). Only after Duru's OK do the full gates, push and the draft PR run (Task 11).
- Times told to Duru are in Tbilisi time (UTC+4).

## Review Focus

1. **A self-closing blank cell before a value** (`<c r="C5" s="3"/><c r="D5"><v>12</v></c>`) must read C5 as blank and D5 as 12. Owner: Task 1 (`test_self_closing_cell`) and Task 2 (a unit test on the cell reader).
2. **Sheets stored out of order** (`GWh&TJ` is `sheet2.xml` in the 2013 electricity workbook, and the sheet name is `GWH&TJ` in other years): rows come from the sheet named in the manifest, matched case-insensitively through the workbook rels. Owner: Tasks 1 and 2.
3. **Negative electricity supply** (`energy.supply.electricity`, 2023) draws below zero in chart, table and Excel, and is not clipped or shown as a gap. Owner: Task 4 (model) and Task 7 (browser).
4. **A saved link with a wind series and a range before 2016** (`#tab=production&from=2013&to=2015&sel=electricity.production.wind`): the wind series stays selected and shows as a gap, never 0. The empty-chart callout appears only when nothing is selected. Owner: Task 4.
5. **Language switch and tab switch** keep range, selection rules and chart/table mode. A range picked on a 2013–2024 energy tab stays the same on another energy tab. Owner: Task 4 and Task 7.

---

### Task 1: Research package

**Files:**
- Create: `docs/Raw Data/EnergyFood/geostat-energy-food-annual/` with `official/`, `prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`, and generated `source-manifest.csv`, `source-manifest.json`, `energy-food-annual.csv`, `coverage.csv`, `validation-report.json`, `independent-validation.json`.

The originals are already downloaded in `/mnt/project-files/energy-farming-sources/`. Re-download each from Geostat, confirm the bytes match, then copy it in under lowercase hyphenated names:
- `energy-balance-{year}-aggregated.xlsx` and `energy-balance-{year}-electricity.xlsx` for 2013–2024. The file 1 and file 2 links are on category pages 82, 83, 84, 85, 86, 631, 681, 719, 786, 821, 864 and 891.
- `energy-efficiency.xls` (`https://geostat.ge/media/75778/Energy-efficiency_ENG.XLS`)
- `food-balance-sheets.xlsx` (`https://geostat.ge/media/80160/1.Food_Balance_Sheets_ENG.xlsx`)
- Georgian label references `ka/food-balance-sheets-ka.xlsx` and `ka/energy-balance-2024-aggregated-ka.xlsx`
- Page captures `energy-balance-page-{year}.html` (12), `energy-balance-index-page.html` (category 328) and `food-security-page.html` (category 297)

All are dated 2026-10-11.

**Interfaces:**
- Produces: `energy-food-annual.csv` with columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell,source_label,source_number_format`.
  - `value` is the cell's exact `<v>` token, or `0` for a "-" cell.
  - `value_status` is `published` or `no_flow`.
  - `unit` is `ktoe`, `gwh` or `percent`.
- Source IDs:
  - `geostat_energy_balance_{year}_aggregated` and `geostat_energy_balance_{year}_electricity` (24)
  - `geostat_energy_efficiency`, `geostat_food_balance_sheets`
  - `geostat_energy_balance_page_{year}` (12), `geostat_energy_balance_index_page`, `geostat_food_security_page`
- The cell map. `prepare.py` locates every row by its normalised label text (collapse whitespace, case-insensitive, drop footnote digits such as `quarrying1`) and every column by its header text, never by fixed positions.

| Indicator IDs | Sheet / row / column | Years |
| --- | --- | --- |
| `energy.supply.{total,coal,crude_oil,oil_products,natural_gas,hydro,wind_solar_geothermal,biofuel_waste,electricity}` | aggregated `KTOE`; row `DOMESTIC SUPPLY`; columns Total, Coal, Crude oil, Oil products, Natural Gas, Hydro, Geothermal/wind/solar, Biofuel & Waste, Electricity | 2013–2024 |
| `energy.production.total`, `energy.exports.total` | `KTOE`; rows `Production`, `Exports`; column Total | 2013–2024 |
| `energy.imports.{total,coal,crude_oil,oil_products,natural_gas,electricity}` | `KTOE`; row `Imports` | 2013–2024 |
| `energy.final.{total,industry,transport,commercial_public,households,agriculture,other_unspecified,non_energy}` | `KTOE`; column Total; rows `FINAL CONSUMPTION`, `Industry`, `Transport`, then the first `Commercial and public services`, `Residential`, `Agriculture/forestry/fishing`, `Not elsewhere specified (Other)` after FINAL CONSUMPTION, and `Non-energy use` | 2013–2024 |
| `energy.final_fuel.{coal,oil_products,natural_gas,wind_solar_geothermal,biofuel_waste,electricity}` | `KTOE`; row `FINAL CONSUMPTION`; fuel columns | 2013–2024 |
| `electricity.production.total`, `electricity.imports`, `electricity.exports`, `electricity.losses` | electricity sheet `GWh&TJ` (any case); column `Electricity (GWh)`; rows `Production`, `Imports`, `Exports`, `Losses` | 2013–2024 |
| `electricity.production.{thermal,hydro,wind}` | same column; the `MA Thermal Electricity Plants`, `MA Hydro Electricity Plants` and `Wind Electricity Plants` rows inside the `Transformation Sector-Production` block | wind 2016–2024, others 2013–2024 |
| `electricity.final.{total,industry,transport,commercial_public,households,agriculture,other_unspecified}` | same column; `FINAL CONSUMPTION`, `Industry`, `Transport`, `Commercial and public services`, `Residential`, `Agriculture/forestry/fishing`, `Not elsewhere specified (Other)` | 2013–2024 |
| `food.self_sufficiency.{wheat,maize,potato,vegetables,grapes,meat,beef,pork,sheep_goat_meat,poultry_meat,milk,eggs}` | the 12 sheets of `food-balance-sheets.xlsx`, in that order; row `Self-sufficiency ratio, %` (with or without a space before `%`); year columns | 2014–2025 |

- [ ] **Step 1: Write `test_validation.py`** (stdlib `unittest`, modelled on the Poverty one):
  - `test_primary_count_is_681` checks the counts 204, 168, 165 and 144 by page group.
  - `test_altered_cell_fails`
  - `test_balance_identity_fails_when_violated`: production + imports − exports − marine bunkers − aviation bunkers + stock changes must equal domestic supply within 0.2, for each fuel and year.
  - `test_total_column_fails_when_violated`: the Total column equals the sum of the fuel columns within 0.5, for supply, imports and final consumption.
  - `test_final_sum_fails_when_violated`: industry + transport + other sectors + non-energy use = final within 0.5 (ktoe), and industry + transport + other sectors = final within 0.5 GWh.
  - `test_electricity_production_sum`: thermal + hydro + wind (missing as 0 only inside this check) = total within 0.5 GWh.
  - `test_food_ratio_plausible`: for every food and year, the published ratio is within 10 points of production ÷ (production + import − export) × 100 from the same sheet.
  - `test_spot_values`: `energy.supply.total` 2024 = `5914.5`, `energy.imports.total` 2024 = `5099`, `electricity.production.total` 2024 = `14234.1`, `food.self_sufficiency.wheat` 2025 = `19`, `food.self_sufficiency.sheep_goat_meat` 2018 = `345`.
  - `test_wind_starts_2016`: no wind row before 2016.
  - `test_dash_is_no_flow` and `test_ellipsis_fails`.
  - `test_self_closing_cell` and `test_sheet_order_from_rels` (Review Focus 1 and 2), each on a small in-memory xlsx.
- [ ] **Step 2: Run** `cd "docs/Raw Data/EnergyFood/geostat-energy-food-annual" && python3 -m unittest test_validation -v`. Expected: FAIL (no `prepare` module).
- [ ] **Step 3: Implement `prepare.py`** (stdlib: `zipfile`, `xml.etree`, `decimal`, `hashlib`, `csv`, `json`). It writes the manifest (SHA-256 and bytes), `energy-food-annual.csv`, `coverage.csv` (indicator, first year, last year, count) and `validation-report.json` (`status`, counts, `no_flow_count` with the list of those cells, `imputed_values: 0`, `reconciliation_failed_count: 0`). Supports `--check`. `prepare.py` cannot read `.xls`, so the efficiency cross-check lives only in Step 4.
- [ ] **Step 4: Implement `verify_independent.mjs`.** It re-reads every workbook with the repo's `xlsx` package (`createRequire` from `apps/web`; it also reads the `.xls`), compares all 681 values and the counts, checks that `energy.supply.total` and `energy.final.total` equal the efficiency workbook's "Total primary energy supply" and "Final energy consumption" ktoe rows for all 12 years within 0.05, and writes `independent-validation.json` with `status: "passed"`.
- [ ] **Step 5: Run** `python3 prepare.py && python3 -m unittest test_validation -v && node verify_independent.mjs`. Expected: all PASS, and `validation-report.json` reads `"status": "passed"` with `primary_observation_count: 681`.
- [ ] **Step 6: Write `README.md`.** Cover the files, URLs, retrieval date, cell map, checks, the dash and "…" rules, the wind-from-2016 gap and the footnotes (wheat products converted into wheat; wine converted into grapes). Commit `feat(data): archive reviewed Geostat energy and food balance workbooks`.

### Task 2: Canonical serving file

**Files:**
- Create: `apps/web/lib/data/energyFood/types.ts`, `validation.ts`, `prepareEnergyFood.ts`, `apps/web/scripts/prepare-energy-food.ts`, `apps/web/tests/data/energyFood/energyFood.test.ts`, generated `data/imports/energy-food-annual.csv` and `data/reports/energy-food-validation.json`
- Modify: `apps/web/package.json` (scripts `data:prepare-energy-food`, `data:check-energy-food`; append `&& npm run data:check-energy-food` to `data:validate`)

**Interfaces:**
- Produces (in `types.ts`):
  - `ENERGY_FOOD_INDICATORS` (the 57 IDs from Task 1, in table order) and `EnergyFoodIndicator`
  - `ENERGY_FOOD_SOURCES` (the 26 workbook IDs) and `ENERGY_FOOD_PUBLIC_SOURCES` (all 40)
  - `EnergyFoodFact = { year; indicatorId; value: string; publishedValue: string; unit: "ktoe" | "gwh" | "percent"; basis: "actual"; valueStatus: "published" | "no_flow"; sourceId; sourceSheet; sourceCell; sourceNumberFormat: string; lastReviewedAt }`
  - `ClientEnergyFoodFact = Pick<…, "year" | "indicatorId" | "sourceId"> & { value: number; decimals: number }`
  - `EnergyFoodAcceptance` (the Poverty shape), `energyFoodFactKey(f) => \`${indicatorId}:${year}\``, and `energyFoodSourceDocumentId(id) => \`source.${id}\``
- Produces (in `validation.ts`): `expectedEnergyFoodKeys(): Set<string>`, `energyFoodDisplayDecimals(format: string): number`, and `validateEnergyFoodFacts(facts): void`. The latter applies the Poverty identity, coverage, duplicate, source-contract and published-rounding checks. It also checks that `ktoe` and `gwh` values are never negative except `energy.supply.electricity`, that percent values are positive, and that `no_flow` rows have value `0`.
- Produces (in `prepareEnergyFood.ts`):
  - `prepareEnergyFoodData(repositoryRoot, mode: "write" | "check")`
  - `ENERGY_FOOD_CSV_HEADERS = ["year","indicator_id","value","published_value","unit","basis","value_status","source_id","source_sheet","source_cell","source_number_format","last_reviewed_at"]`, with `REVIEWED_AT = "2026-10-11"`
  - an exported helper `readWorkbookCells(bytes: Uint8Array): Map<string, { token?: string; text?: string }>`, keyed `${sheetName}:${address}`, which uses the rels lookup and the self-closing-safe regex from Global Constraints

- [ ] **Step 1: Write `tests/data/energyFood/energyFood.test.ts`** (model: `tests/data/poverty/poverty.test.ts`):
  - `prepareEnergyFoodData(root, "check")` resolves, and the canonical file has 681 rows.
  - `readWorkbookCells` reads a fixture whose sheet 1 is stored as `sheet2.xml` with a self-closing `C5`: C5 is blank and D5 is `12`.
  - `validateEnergyFoodFacts` rejects each of these: an altered `publishedValue`, a duplicate, a missing key, a 2015 wind row, a 2025 energy row, a 2013 food row, a negative `energy.final.households`, and a `no_flow` row with value `5`.
  - It accepts the real negative 2023 `energy.supply.electricity` row.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/energyFood/energyFood.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules, mirroring `lib/data/poverty/*`, with the reader from Global Constraints in place of Poverty's lines 29–37. A `no_flow` row is checked against a cell whose shared-string text is `-`. Add `scripts/prepare-energy-food.ts` (copy `prepare-poverty.ts`) and the package scripts.
- [ ] **Step 4: Run** `npm run data:prepare-energy-food && npm run data:check-energy-food && npx vitest run tests/data/energyFood/energyFood.test.ts`. Expected: `{"status":"passed","scope":"energy_food_annual"}` and the tests PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed annual energy and food data`.

### Task 3: Loader, mirror table and parity

**Files:**
- Create: `apps/web/lib/data/energyFood/importEnergyFood.ts`, `apps/web/prisma/migrations/20261011120000_energy_food/migration.sql`
- Modify: `apps/web/prisma/schema.prisma` (`EnergyFoodFact`), `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts`, `data/sources/source-documents.csv` (40 rows)
- Test: extend `apps/web/tests/data/energyFood/energyFood.test.ts`

**Interfaces:**
- Consumes: the Task 2 types and validation.
- Produces:
  - `loadEnergyFoodFacts(): Promise<EnergyFoodFact[]>` and `assertEnergyFoodParity(csv, mirror): void`
  - `loadServedEnergyFoodData(): Promise<{ facts: EnergyFoodFact[] }>`
  - `toClientEnergyFoodFact(f): ClientEnergyFoodFact` (value = `Number(publishedValue)`)
  - `loadEnergyFoodFactsFromDb()` in `servedDataDb.ts`, and the mirror-row mapper and import comparison named like the Poverty ones
- `EnergyFoodFact` model: the Poverty columns without `groupId`, with `@@id([indicatorId, year])`. The migration copies `20261010180000_poverty/migration.sql`, including RLS and the revoked grants.

- [ ] **Step 1: Add parity tests.**
  - `assertEnergyFoodParity` passes on identical arrays and on `"5914.50"` vs `"5914.5"`, and throws on a changed value or a missing row.
  - `loadEnergyFoodFacts` throws on a fingerprint mismatch (temp copy).
  - `toClientEnergyFoodFact` gives `decimals` 1 for ktoe rows and 0 for food rows (2023 and 2025).
- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement** by copying each Poverty addition in the same file. Run `npx prisma validate` and `npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/energyFood/energyFood.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed energy and food data with exact parity`.

### Task 4: Explorer model and state

**Files:**
- Create: `apps/web/lib/explorer/energyFood.ts`, `apps/web/tests/explorer/energyFood.test.ts`

**Interfaces:**
- Consumes: `ClientEnergyFoodFact`.
- Produces:
  - `ENERGY_FOOD_HUB_PATH = "/explorer/energy-food"`
  - `ENERGY_FOOD_SECTIONS`, four entries `{ id, href, labelKey }`: `energy-supply`, `electricity`, `energy-use` and `food-self-sufficiency`. Each href is `/explorer/energy-food/${id}`. The labelKeys are `common.energySupply`, `common.electricity`, `common.energyUse` and `common.foodSelfSufficiency`.
  - `EnergyFoodSectionId`
  - `EnergyFoodView = "overview" | "supply_fuel" | "imports_fuel" | "production" | "trade" | "use" | "by_user" | "by_fuel" | "main"` and `energyFoodViews(section)`
  - `EnergyFoodSeriesDefinition = { id: EnergyFoodIndicator; reference: boolean; parentId?: string }`. The series ID is the indicator ID.
  - `energyFoodViewSeries(section, view)`:
    - overview: supply.total (reference), production.total, imports.total, exports.total
    - supply_fuel: supply.total (reference) with natural_gas, oil_products, hydro, biofuel_waste, coal, crude_oil, wind_solar_geothermal and electricity as children
    - imports_fuel: imports.total (reference) with natural_gas, oil_products, coal, crude_oil and electricity as children
    - production: electricity.production.total (reference) with hydro, thermal and wind as children
    - trade: electricity.imports (reference), electricity.exports
    - use (electricity): electricity.final.total (reference) with households, commercial_public, industry, transport, agriculture and other_unspecified as children; then electricity.losses top-level
    - by_user: energy.final.total (reference) with households, transport, industry, commercial_public, agriculture, other_unspecified and non_energy as children
    - by_fuel: energy.final.total (reference) with natural_gas, oil_products, electricity, biofuel_waste, coal and wind_solar_geothermal as children (final_fuel IDs)
    - main (food): wheat (reference), maize, potato, vegetables, grapes, meat with beef, pork, sheep_goat_meat and poultry_meat as children, milk, eggs
  - `energyFoodUnit(section): "ktoe" | "gwh" | "percent"`
  - `energyFoodCoverage(section, view, facts)`
  - `EnergyFoodState`, `defaultEnergyFoodState`, `parseEnergyFoodHash`, `serializeEnergyFoodHash`, `changeEnergyFoodView`, `EnergyFoodModel`, `buildEnergyFoodModel` and `energyFoodSeriesColor`, all with the Poverty semantics and signatures (section instead of Poverty's section)

- [ ] **Step 1: Write the tests.**
  - Default states: supply → view `overview`, selection `["energy.supply.total"]`, coverage 2013–2024. Food → `["food.self_sufficiency.wheat"]`, 2014–2025.
  - `#tab=production&from=2013&to=2015&sel=electricity.production.wind` keeps wind selected, and its `valuesByYear` are all `null` (Review Focus 4).
  - `changeEnergyFoodView` from `overview` with range 2015–2020 to `imports_fuel` keeps 2015–2020 and selects only `energy.imports.total` (Review Focus 5).
  - Hash round-trip, including an explicit empty `sel=`. Unknown IDs are dropped, and an unknown `tab` falls back to the first view. The food hash never writes `tab`.
  - `buildEnergyFoodModel` on `supply_fuel` 2023 gives a negative `energy.supply.electricity` end value (Review Focus 3).
  - End values: `energy.supply.total` 2024 is `5914.5`, `electricity.production.total` 2024 is `14234.1`, `food.self_sufficiency.wheat` 2025 is `19`.
  - Nesting: food has one parent (meat) with 4 children, and electricity `use` has 2 top-level rows.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/energyFood.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, reusing `resolveRange`, `refitRange(…, { collapseToAll: true })`, `parseYearRangeKeys`, `writeYearRangeKeys` and `colorForItem` as `poverty.ts` does. Model `decimals` is the maximum fact decimals among selected rows.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat: model energy and food tabs, nesting and state`.

### Task 5: Excel workbook and hub cards

**Files:**
- Create: `apps/web/lib/explorer/energyFoodWorkbook.ts`, `apps/web/lib/explorer/energyFoodHubCards.ts`
- Test: extend `apps/web/tests/explorer/energyFood.test.ts`

**Interfaces:**
- Produces:
  - `buildEnergyFoodWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title? }, presentation): WorkbookExportModel`, mirroring `povertyWorkbook.ts`:
    - filename `energy-food-${section}${view === "main" ? "" : `-${view}`}-${start}-${end}`
    - unit labels `energyFood.unit.ktoe|gwh|percent`
    - `numberFormat` `"#,##0.0"` for ktoe and gwh, `"0"` for food; `numericFormats` keyed by 1-based value-column numbers
    - status `energyFood.status.published|no_flow`
  - `buildEnergyFoodHubCards(facts, presentation): HubCardModel[]` returns four cards with sparklines: `energy.supply.total`, `electricity.production.total`, `energy.final.total` and `food.self_sufficiency.wheat`. The footers read `"2024 · 5,914.5 · 2013–2024"`, `"2024 · 14,234.1 · 2013–2024"`, `"2024 · 5,456.7 · 2013–2024"` and `"2025 · 19% · 2014–2025"`.

- [ ] **Step 1: Write the tests.**
  - A workbook for `imports_fuel` 2020–2024 with total and gas selected has 2 rows × 5 years. Its sources are only the five aggregated-balance IDs for 2020–2024, and the value-column formats are `#,##0.0`.
  - A food workbook keeps blank cells blank and uses `0` for 2023 and 2025.
  - The hub cards show the four footers above.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: export energy and food to Excel and build hub cards`.

### Task 6: Messages and i18n wiring

**Files:**
- Create: `apps/web/lib/i18n/messages/{ka,en}/energyFood.json`
- Modify: `lib/i18n/messages/{ka,en}/common.json` (`energyFood` for the hub, plus `energySupply`, `electricity`, `energyUse` and `foodSelfSufficiency`), `lib/i18n/types.ts`, `lib/i18n/messages.server.ts`, `lib/i18n/inventory.server.ts`, `data/localization/en/page-revisions.json` (5 new routes)

Keys in `energyFood.json` mirror `poverty.json`: `title`, `hubSummary`, `metaTitle`, `metaDescription`, `page.<section>.title|summary`, `tabs`, `tab.<view>`, `series.<indicatorId>` for all 57 IDs, `unit.ktoe|gwh|percent` with long forms, `latest.<section>`, `latestNote.energy-supply` ("imports {value}"), `latestNote.electricity` ("imports {imports} · exports {exports}"), `sourceNote.energy` / `sourceNote.food`, `methodology`, `search`, `series`, `status.published|no_flow`, `emptySelection`, `nestedSelected` and `subcategoriesFor`.

Georgian names come from spec §2. Series labels come from Geostat's Georgian files in the research package:
- ბუნებრივი გაზი, ნავთობპროდუქტები, ჰიდრო, ბიოსაწვავი და ნარჩენები, ქვანახშირი, ნედლი ნავთობი, ქარი, მზე და გეოთერმული, ელექტროენერგია
- შინამეურნეობები, ტრანსპორტი, მრეწველობა, კერძო და სახელმწიფო მომსახურება, სოფლის, სატყეო და თევზის მეურნეობა, სხვა (დაუზუსტებელი), არაენერგეტიკული მიზნებისათვის
- ხორბალი, სიმინდი, კარტოფილი, ბოსტნეული, ყურძენი, ხორცი, საქონლის ხორცი (Geostat's abbreviation „მრპ-ს ხორცი“ is written out), ღორის ხორცი, ცხვრის და თხის ხორცი, ფრინველის ხორცი, რძე და რძის პროდუქტები, კვერცხი

- [ ] **Step 1: Add the files** and run `npm run i18n:check`. Expected: FAIL (namespace not inventoried).
- [ ] **Step 2: Wire the namespace** as Poverty did. **Step 3: Run** `npm run i18n:check && npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit** `feat: add Georgian and English energy and food copy`.

### Task 7: Pages, component, navigation and SEO

**Files:**
- Create:
  - `apps/web/components/energy-food/energy-food-explorer.tsx` and `apps/web/lib/pages/energy-food.tsx`
  - routes `app/(ka)/explorer/energy-food/{page,energy-supply/page,electricity/page,energy-use/page,food-self-sufficiency/page}.tsx` and the `app/(en)/en/explorer/energy-food/…` mirrors
  - `apps/web/tests/browser/energy-food.spec.ts`
- Modify: `components/shell/data-sidebar.tsx` (after External flows; `energyFoodActive` joins the `budgetActive` exclusions), `components/shell/explorer-footer.tsx`, `lib/seo/sitemap.ts`, `tests/seo/routes.test.ts`, and the page-count assertions Poverty touched in `bilingual-complete.spec.ts` and `seo.spec.ts` (+5 pages per language)

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:
  - `EnergyFoodExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin })`, mirroring `PovertyExplorer`. `share` is true only on food. Test IDs use the prefix `energy-food`, for example `energy-food-tab-${view}`, `energy-food-latest` and `energy-food-excel-download`.
  - `LatestValueLine`, with `note` for the import and export values on supply and electricity
  - `renderEnergyFoodHub`, `energyFoodHubMetadata`, `renderEnergyFoodPage(locale, section)` and `energyFoodPageMetadata`

- [ ] **Step 1: Write `tests/browser/energy-food.spec.ts`.**
  - The hub shows four cards.
  - Energy supply defaults to Overview with one selected row, and the latest line contains `5,914.5` and `5,099.0`.
  - On Supply by fuel, ticking Electricity and choosing 2022–2024 shows a negative 2023 value in table mode (Review Focus 3).
  - Electricity Production with wind ticked and range 2013–2015 shows the chart, not the empty callout (Review Focus 4).
  - Food shows no tabs and `19%`, and the Meat row expands to four children.
  - Excel fires a `.xlsx`.
  - `/en` keeps the hash (Review Focus 5).
  - At 390 px there is no horizontal scroll.
- [ ] **Step 2: Implement** the component, pages, routes, sidebar, footer and sitemap. Extend `tests/seo/routes.test.ts` with the 10 new routes.
- [ ] **Step 3: Run** `npx vitest run tests/seo/routes.test.ts tests/explorer/energyFood.test.ts && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Run** `npx playwright test tests/browser/energy-food.spec.ts` against `next dev`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add bilingual energy and food explorer`.

### Task 8: Methodology page and source archive

**Files:**
- Create: `apps/web/lib/methodology/content/energyFood.ts`, `apps/web/lib/methodology/content/en/energyFood.ts`, `data/methodology/source-archives/energy-food.csv`
- Modify: `lib/methodology/types.ts` (`"energy-food"` in `LIVE_METHODOLOGY_IDS`), `lib/methodology/catalog.ts`, `lib/methodology/sourceInventory.ts`, `lib/methodology/content/en/revisions.ts`, `lib/pages/methodology-article.tsx`, `data/localization/en/documents.json`, `data/methodology/decision-register.csv`, `lib/factQuery/buildSnapshot.ts` (exclude the energy-food sources, as Poverty did), and the tests Poverty touched in `tests/methodology/`, `tests/i18n/methodologyCoverage.test.ts`, `tests/factQuery/buildSnapshot.test.ts`, `tests/browser/methodology.spec.ts` and `tests/browser/bilingual-methodology.spec.ts`

The content covers spec §8 rules 1–6 and §10 in plain words:
- the energy balance and the oil-equivalent unit
- domestic supply, final consumption and non-energy use
- electricity losses and the undivided "other" row
- the self-sufficiency ratio with Geostat's formula and footnotes

It states no causes.

- [ ] **Step 1: Update the catalogue, archive and snapshot tests** to expect `energy-food`. **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, then run `npm run data:check-methodology-archives` and the methodology tests. Expected: PASS, with no energy-food source in the snapshot.
- [ ] **Step 4: Commit** `feat: publish energy and food methodology and original sources`.

### Task 9: Live preview for Duru (stop point)

- [ ] **Step 1:** Build and serve with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100`. Capture ka and en screenshots at 1440 and 390 of the hub, each page on each tab, and the methodology page, into `/mnt/project-files/screenshots/energy-food/`.
- [ ] **Step 2:** Ask Duru on a card how to review: a clickable preview, which pushes the branch so Vercel makes a private preview link (no PR, no tests, nothing live), or screenshots only. **Wait.** Apply any requested changes and show them again.

### Task 10: Scope and design documents

**Files:**
- Create: `docs/data-methodology/energy-food-annual.md` (the package, IDs, checks, serving and export rules)
- Modify: `Project_Definition.md` §2 (a new approved Energy and food item, worded like the Poverty one), `DESIGN.md` (the hub and four pages), and `docs/deployment.md` (add `EnergyFoodFact` where Poverty added `PovertyFact`)

- [ ] **Step 1:** Write the documents. **Step 2:** Run `npm run i18n:check`. **Step 3:** Commit `docs: record the energy and food hub`.

### Task 11: Full gates and delivery (only after Duru's OK in Task 9)

- [ ] **Step 1:** `git fetch origin main && git merge origin/main`. If Money and banks or Living standards has merged, resolve the sidebar, sitemap, methodology catalogue, mirror and page-count conflicts by keeping both sides.
- [ ] **Step 2:** Run `npm run check`, then `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then the full browser suite against `npm run start -- --port 3100` with `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test`. Expected: all green.
- [ ] **Step 3:** `git push -u origin claude/project-thread-0yo9lo`. Open a draft PR with the attribution block, assign DuruMakh and request their review, subscribe to PR activity and drive CI to green.
- [ ] **Step 4:** Reply with the PR link. Merging releases to production, so that waits for Duru.
