# Transport Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual Transport hub (`/explorer/transport` with `/vehicles`, `/vehicle-age`, `/passengers`, `/freight`, `/regions`, `/regions/[id]` for Georgia and 11 regions, and `/methodology/transport`), serving about 4,000 reviewed Geostat values.

**Architecture:** A copy of the Housing hub's architecture as built (PR #191, merge `033e4c05`; `git diff $(git merge-base 033e4c05^1 033e4c05^2) 033e4c05^2 --stat` lists every shared file it touched). An immutable research package, a TypeScript prepare/check step writing one canonical CSV, a loader with CSV/DB parity, a private Prisma mirror table, models built on `topicSeries` and `unitList`, and three thin client components (topic pages, Regions index, area pages) composed from the shared explorer shell. Each Housing file named below is the template: same structure, Transport ids, units and messages.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase, Vitest, Playwright, SheetJS (`xlsx`) for reading in TypeScript, Python 3 with the shared `.xlsx` reader and `xlrd` 2.0.x for the one `.xls` (research package only), Node (independent verifier).

**Spec:** `docs/superpowers/specs/2026-10-20-transport-design.md` (approved by Duru on 2026-10-20, 09:37 Tbilisi).

**Branch:** `claude/transport-cars-hub-i2nyr5`, from `origin/main` at `a8ac0083`; the spec is committed there.

## Global Constraints

- Yearly values only; no quarterly column and no 2026 value is ever served.
- Under each page heading only the one-line `LatestValueLine`, fitting one line at 375 px; under the chart only one `SourceNote`.
- No tab rows, no measure switches (the Regions map has none). Each unit's rows sit under a heading naming the unit; one unit charted at a time via `keepOneUnit`.
- Every row visible from the start under its heading; no nesting, no prefixes in names. Defaults: Passenger cars (Vehicles), Passenger cars · Over 10 years (Vehicle age), Passenger-km · All transport (Passengers), Tonne-km · All transport (Freight), All motor vehicles (area pages).
- Values at Geostat's published precision: thousand vehicles/passengers/tonnes, million pkm/tkm and road km to one decimal; km per person whole.
- Missing is a gap/dash/blank, never zero. `-` follows its table's legend: nil = 0 (H-1, H-3, H-4, railway, airport, sea port tables), "not available" = gap (H-2). Rows nil/0 in every published year are not served.
- Fiscal.ge computes nothing: no shares, per-person values, sums. Every row `value_status = official`, `basis = actual`.
- Regions use the site's 11 region IDs (`BUSINESS_REGIONS` order). Abkhazia and "region unknown" rows are served in the CSV (sum checks) but have no page or list row. IDs are `transport.{measure}.{group}`.
- Canonical CSV UTF-8 with BOM. The methodology bundle must not pull large data files (PR #170 rule).
- No MCP tools, no central JSON/CSV publications; the fact-query snapshot must not include transport sources.
- Review before pushing: commit locally only. Screenshots and on request a pushed-branch preview go to Duru (Task 8). Full gates and the PR only after Duru's OK (Task 9). Times to Duru in Tbilisi time.

## Indicator map

| Measure | Groups | Unit | Source / years |
| --- | --- | --- | --- |
| `fleet` | `cars`, `buses`, `trucks`, `special` | `thousand_units` | H-3 totals, 2000–2025 (2004–2005 gaps; special 2006 gap) |
| `fleet` | `cars_fuel_{petrol,petrol_gas,diesel,gas,electric,hybrid,hybrid_gas,unknown}`; `buses_fuel_{petrol,petrol_gas,diesel,gas,electric,unknown}`; `trucks_fuel_` same as buses; `special_fuel_{petrol,petrol_gas,diesel,electric,unknown}` | `thousand_units` | H-3, 2017–2025 (`hybrid_gas` 2022–2025) |
| `fleet` | `{type}_age_{up_to_2,up_to_5,up_to_10,over_10,unknown}` | `thousand_units` | H-4, 2017–2025 |
| `passenger_km` | `total`, `road`, `rail`, `metro`, `air`, `sea` | `million_passenger_km` | H-1, 2000–2025 |
| `passenger_km_per_person` | `total` | `passenger_km_per_person` | H-1, 2000–2025 |
| `passengers` | `rail`, `rail_domestic`, `rail_international` (2018–2025), `metro` (2012–), `airports` (2015–), `airlines` (2012–), `seaports` (2020–) | `thousand_passengers` | 0504EN030103, 030105 sheet `2012-2025 Y`, 030201, 030202, 030401 |
| `tonne_km` | `total`, `road`, `rail`, `air`, `sea` | `million_tonne_km` | H-2, 2000–2025 (sea gaps where `...`/`-`) |
| `freight_tonnes` | `rail`, `rail_domestic`, `rail_exports`, `rail_imports`, `rail_transit` (2018–), `seaports`, `seaports_liquid`, `seaports_general`, `seaports_dry` (2020–), `airports` (2015–), `airlines` (2012–) | `thousand_tonnes` | 030102 `Transportation` "Goods, total" rows, 030403, 030202 `Freight carried`, 030201 freight sheet |
| `registered` | `{area}`, `{area}_{cars,buses,trucks,special,type_unknown}`, `{area}_fuel_{gas,petrol,petrol_gas,diesel,diesel_gas,electric,hybrid,hybrid_gas,hybrid_diesel,unknown}`, `{area}_age_{0_2,2_5,5_10,over_10,unknown}`, `{area}_owner_{companies,individuals}` | `thousand_units` | Number-of-Registered-Vehicles, 2017–2025, where the year has the column |
| `road_km` | `{area}`, `{area}_{international,secondary,local}` | `km` | Length-of-road, 2011–2024 |

`{area}` is `total` (Georgia), `region_<id>` for the 11 regions, and for `registered` also `region_abkhazia` and `region_unknown` (road length: `region_abkhazia` only). The served list rows per page are the spec's sections 4–8; `type_unknown`, `fuel_diesel_gas`, `fuel_hybrid_diesel`, Abkhazia and region-unknown rows are served but not listed.

## Review Focus

1. **Regional header rows that repeat or mislabel years** (owner and age sheets print "2021" under 2022–2025; fuel columns appear in some years only; the age sheet's 2024–2025 "Unknown" is Georgian text `უცნობია`): every value lands in the right year and column. Owner: Task 1 (`test_regional_columns`).
2. **Cumulative age rows** (H-4): never added as bands; `up_to_10 + over_10 + unknown = total` within 0.1. Owner: Task 1 (`test_parts_add_up`), Task 2.
3. **A saved link mixing units** (`#sel=transport.passenger_km.total,transport.passengers.metro`) keeps only the first row's unit and years clamp to its coverage (2012–2025 for metro). Owner: Task 4.
4. **`-` cells**: H-1 sea 2020–2025 serve 0, H-2 sea 2009 `...` and 2013–2025 are gaps, buses' hybrid row is not served. Owner: Task 1 (`test_nil_cells`), Task 2.
5. **Area-page link to another area** carries the selection moved to that area; a road row survives a move between Georgia and a region. Owner: Task 4 (`transportAreaSelectionHash`), Task 7.

---

### Task 1: Research package

**Files:** Create `docs/Raw Data/Transport/geostat-transport-annual/` with `official/` (every file in `/mnt/project-files/transport-sources/source-urls.txt`, downloaded fresh with `curl -sSL`, plus the five Geostat category pages 565, 795, 796, 797, 802 as HTML), `prepare.py`, `verify_independent.mjs`, `test_validation.py`, `README.md`, and generated `source-manifest.csv`, `source-manifest.json`, `transport-annual.csv`, `coverage.csv`, `validation-report.json`, `independent-validation.json`.

**Interfaces:**
- Produces `transport-annual.csv` with Housing's columns `year,indicator_id,value,published_value,unit,basis,value_status,source_id,source_sheet,source_cell`; `value` is the cell's shortest round-trip number text (trailing `.0` removed; a nil `-` cell has value `0`); `published_value` rounds from 15 significant digits half-up to the cell format's decimals.
- Served source IDs: `geostat_transport_passenger_demand` (H-1), `geostat_transport_freight_demand` (H-2), `geostat_transport_fleet_fuel` (H-3), `geostat_transport_fleet_age` (H-4), `geostat_transport_rail_goods` (030102), `geostat_transport_rail_passengers` (030103), `geostat_transport_metro` (030105), `geostat_transport_airlines` (030201), `geostat_transport_airports` (030202), `geostat_transport_sea_passengers` (030401), `geostat_transport_sea_freight` (030403), `geostat_transport_registered` (Number-of-Registered-Vehicles), `geostat_transport_roads` (Length-of-road). Archived only: 030101, 030104, 030106, 030203, 030402, technical inspections, taxi licences, the five pages.
- Rows are found by their printed label, columns by their printed year heading (and, in the regional workbook, the sub-heading); a year block in the owner/age sheets starts at a column whose row-3 heading is the next year in sequence, and its width is fixed (owner 2, age 5). Region labels are matched after `strip()`.

- [ ] **Step 1: Write `test_validation.py`** (stdlib `unittest`, modelled on Housing):
  - `test_counts`: per-indicator counts match `coverage.csv`; print the total (about 4,000).
  - `test_altered_cell_fails`: patching one value makes `prepare.validate` raise.
  - `test_anchor_values`: `fleet.cars` 2025 `1650.0`→published `1650.0`; `fleet.cars` 2000 `244.8`; `fleet.cars_fuel_electric` 2025 `15.2`; `fleet.cars_age_over_10` 2025 `1318.9`; `passenger_km.total` 2025 `11262.1`; `passenger_km.air` 2025 `1862.6`; `tonne_km.rail` 2025 `3814.9`; `freight_tonnes.rail_transit` 2025 `7616.6`; `registered.region_tbilisi` 2025 `855.0`; `registered.total` 2025 `1914.9`; `registered.region_guria` 2025 `40.7`; `passengers.metro` 2025 `147641.4`.
  - `test_regional_columns` (Review Focus 1): `registered.total_owner_companies` 2025 is `191.1` and 2022 `163.2`; `registered.total_age_unknown` 2025 is `7.3`; `registered.total_fuel_hybrid_gas` has no 2017–2021 rows; `registered.total_fuel_diesel_gas` has no 2017–2019 or 2021 rows.
  - `test_nil_cells` (Review Focus 4): `passenger_km.sea` 2020 value `0`; `tonne_km.sea` has rows only 2000–2008, 2011, 2012; no `fleet.buses_fuel_hybrid` indicator; no `passenger_km.inland` indicator.
  - `test_parts_add_up` (Review Focus 2): within 0.1 thousand (0.2 for the regional workbook's 13 parts): fuels to each type's total; H-4 `up_to_10 + over_10 + unknown` to the total; modes to `passenger_km.total` and `tonne_km.total` (within 0.2); rail directions to `freight_tonnes.rail`; sea port types to `seaports`; 11 regions + Abkhazia + unknown to Georgia in every regional table; each area's types (+ `type_unknown`), fuels, age bands and owners to its total; road parts to each area's total, regions + Abkhazia to Georgia. Recorded differences beyond tolerance go in a `KNOWN_DIFFERENCES` dict with their exact value, as Housing does, and the test prints them.
- [ ] **Step 2: Run** `cd "docs/Raw Data/Transport/geostat-transport-annual" && python3 -m unittest test_validation -v`. Expected: FAIL (no `prepare`).
- [ ] **Step 3: Implement `prepare.py`**, reusing the unemployment package's `clean`, `csv_bytes` and `read_sheet` as Housing does, and `xlrd` for `Length-of-road-Eng-2024.xls`. Writes manifest, CSV, coverage (indicator, first year, last year, count, unavailable years) and `validation-report.json` (`status`, `primary_observation_count`, `reconciliation_failed_count: 0`, `imputed_values: 0`, `calculated_values: 0`).
- [ ] **Step 4: Implement `verify_independent.mjs`**: re-read every workbook with SheetJS (`createRequire` from `apps/web`), recompute every row, write `independent-validation.json` with `status: "passed"`, `observations` and negative controls (altered value, omitted row, shifted year, neighbouring column, wrong region row).
- [ ] **Step 5: Run** `python3 prepare.py && python3 -m unittest test_validation -v && node verify_independent.mjs && python3 prepare.py --check`. Expected: all PASS.
- [ ] **Step 6: Write `README.md`** (files, URLs, retrieval time, cell map, checks, Geostat's notes: road figures from 2005 are survey + expert estimates; special vehicles include farm machinery from 2008; age rows cumulative; Tbilisi roads only those the Roads Department manages; airports vs airlines overlap). Commit `feat(data): archive reviewed Geostat transport data`.

### Task 2: Canonical serving file

**Files:** Create `apps/web/lib/data/transport/{types,validation,prepareTransport}.ts`, `apps/web/scripts/prepare-transport.ts`, `apps/web/tests/data/transport/transport.test.ts`. Generated `data/imports/transport-annual.csv`, `data/reports/transport-validation.json`. Modify `apps/web/package.json` (`data:prepare-transport`, `data:check-transport`), `apps/web/scripts/validate-all.ts`.

**Interfaces:**
- `types.ts`: `TRANSPORT_MEASURES = ["fleet","passenger_km","passenger_km_per_person","passengers","tonne_km","freight_tonnes","registered","road_km"] as const`; `TRANSPORT_VEHICLE_TYPES = ["cars","buses","trucks","special"]`; `TRANSPORT_FLEET_FUELS: Record<type, readonly fuel[]>` (the Indicator map's lists); `TRANSPORT_FLEET_AGES = ["up_to_2","up_to_5","up_to_10","over_10","unknown"]`; `TRANSPORT_PASSENGER_MODES`, `TRANSPORT_PASSENGER_GROUPS`, `TRANSPORT_FREIGHT_MODES`, `TRANSPORT_FREIGHT_GROUPS`; `TRANSPORT_REGIONS = BUSINESS_REGIONS`; `TRANSPORT_REGISTER_AREAS = ["total", ...TRANSPORT_REGIONS, "region_abkhazia", "region_unknown"]`; `TRANSPORT_REGISTER_PARTS` (type, fuel, age, owner suffixes in the map's order); `TransportIndicator` (string template type `transport.${TransportMeasure}.${string}`), `TRANSPORT_INDICATORS` (generated in the map's order), `transportIndicator(measure, group)`; `TRANSPORT_SOURCES` (13 served), `TRANSPORT_PUBLIC_SOURCES` (all); `TransportFact` (Housing's shape, `unit: "thousand_units" | "million_passenger_km" | "passenger_km_per_person" | "thousand_passengers" | "million_tonne_km" | "thousand_tonnes" | "km"`); `ClientTransportFact = Pick<TransportFact,"year"|"indicatorId"|"sourceId"> & { value: number; unit: "vehicles" | "pkm" | "pkmPerPerson" | "passengers" | "tkm" | "tonnes" | "km"; decimals: number }`; `transportFactKey`, `TransportAcceptance`.
- `validation.ts`: `expectedTransportKeys()`, `transportDisplayDecimals(id): 0 | 1` (`passenger_km_per_person` 0, else 1), `validateTransportFacts(facts)` (Housing's identity, coverage, duplicate, source-contract and rounding checks, plus the Task 1 sums with the same tolerances and recorded differences, and the Task 1 anchors).
- `prepareTransport.ts`: `prepareTransportData(root, mode)`, `TRANSPORT_CSV_HEADERS = BUSINESS_CSV_HEADERS`, `REVIEWED_AT = "2026-10-20"`; re-reads each cell with SheetJS and compares it to the package's `value` (a nil `-` cell must read as the string `-` and have value `0`).

- [ ] **Step 1: Tests** in `tests/data/transport/transport.test.ts`: `prepareTransportData(root, "check")` resolves and the row count equals the package total; `validateTransportFacts` rejects an altered `publishedValue`, a duplicate, a missing key, a 2026 row, a 2016 `fleet.cars_fuel_petrol` row, a `fleet.buses_fuel_hybrid` row, a `tonne_km.sea` 2015 row, regions not adding up (Tbilisi +1), and a `calculated` status.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run tests/data/transport/transport.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** by mirroring `lib/data/housing/*` (no quarter checks).
- [ ] **Step 4: Run** `npm run data:prepare-transport && npm run data:check-transport && npx vitest run tests/data/transport/transport.test.ts`. Expected: `{"status":"passed","scope":"transport_annual"}` and PASS.
- [ ] **Step 5: Commit** `feat: prepare reviewed annual transport data`.

### Task 3: Loader, mirror table and parity

**Files:** Create `apps/web/lib/data/transport/importTransport.ts`, `apps/web/prisma/migrations/<timestamp later than every existing one>_transport/migration.sql`. Modify `prisma/schema.prisma` (`TransportFact`), `lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `scripts/import-budget-facts.ts`, `data/sources/source-documents.csv`, `docs/deployment.md` and `docs/data-methodology/database-import.md` (`TransportFact` wherever `HousingFact` appears). Test: extend `transport.test.ts`.

**Interfaces:** `loadTransportFacts()`, `assertTransportParity(csv, mirror)`, `loadServedTransportData(): Promise<{ facts: TransportFact[] }>`, `loadTransportFactsFromDb()`, `toClientTransportFact(f)` with units `thousand_units→vehicles`, `million_passenger_km→pkm`, `passenger_km_per_person→pkmPerPerson`, `thousand_passengers→passengers`, `million_tonne_km→tkm`, `thousand_tonnes→tonnes`, `km→km`; `value = Number(publishedValue)`. Migration mirrors `20261016200000_housing/migration.sql` (RLS on, public grants revoked).

- [ ] **Step 1: Tests**: parity passes on identical arrays and on `"1650"` vs `"1650.0"`, throws on a changed value or missing row; `toClientTransportFact` gives `1650` unit `vehicles` decimals 1 for `fleet.cars` 2025 and `2858` unit `pkmPerPerson` decimals 0 for `passenger_km_per_person.total` 2025.
- [ ] **Step 2: Run.** Expected FAIL. **Step 3: Implement**, then `npx prisma validate && npx prisma generate`.
- [ ] **Step 4: Run** `npx vitest run tests/data/transport/transport.test.ts && npm run typecheck`. Expected PASS.
- [ ] **Step 5: Commit** `feat: mirror reviewed transport data with exact parity`.

### Task 4: Transport models

**Files:** Create `apps/web/lib/explorer/{transport,transportAreas,transportRegionMap,transportHubCards,transportWorkbook}.ts`, `apps/web/tests/explorer/transport.test.ts`.

**Interfaces:**
- `transport.ts`: `TRANSPORT_HUB_PATH = "/explorer/transport"`; `TRANSPORT_SECTIONS` ids `vehicles`, `vehicle-age`, `passengers`, `freight`, `regions`, hrefs `/explorer/transport/<id>`, label keys `common.transportVehicles|transportVehicleAge|transportPassengers|transportFreight|transportRegions`; `TransportTopicId`; `TransportHeading` (`types`, `carsFuel`, `busesFuel`, `trucksFuel`, `specialFuel`, `carsAge`, `busesAge`, `trucksAge`, `specialAge`, `pkm`, `pkmPerPerson`, `passengers`, `tkm`, `tonnes`, `registered`, `fuel`, `age`, `owner`, `roads`); `TransportSeriesDefinition = { id; reference: boolean; heading }`; `transportTopicSeries(section)` (spec §4–7 order); `transportDefaultSelection(section)` (vehicle-age: `fleet.cars_age_over_10`); `transportSeriesColor(series, index)` (reference ink; a fuel keeps one colour under every fuel heading, keyed `transport.fuel.<f>`; an age row one colour per band, keyed `transport.age.<a>`; a vehicle type one colour, keyed `transport.type.<t>`; others by position); `parseTransportHash`, `serializeTransportHash`, `changeTransportSelection`, `transportCoverage`, `buildTransportSeriesModel(definitions, facts, state, color?)`, `buildTransportModel(section, facts, state)`; `transportValueUnit(unit)` (`{divisor: 1, decimals}` from the unit), `transportUnitLabel(unit, t)`, `transportValueLabel(value, unit, t)`, `transportSeriesLabel(series, labels, t)` (a fuel or age row carries its heading's text before the unit, as Housing's districts do; types, modes and groups keep their own name).
- `transportAreas.ts` (template `housingAreas.ts`): `TRANSPORT_AREAS = ["georgia", ...TRANSPORT_REGIONS]`, slug/href/map-id helpers via `areaRoutes`, `transportAreaSeries(area)` (spec §8: `registered` heading `<g>` reference, `<g>_cars`, `_buses`, `_trucks`, `_special`; `fuel` heading petrol, petrol_gas, diesel, gas, electric, hybrid, hybrid_gas, unknown; `age` heading 0_2, 2_5, 5_10, over_10, unknown; `owner` heading companies, individuals; `roads` heading `road_km.<g>` reference, international, secondary, local; `<g>` = `total` for Georgia), `transportAreaDefaultSelection`, `parseTransportAreaHash`, `changeTransportAreaSelection`, `transportAreaCoverage`, `transportAreaSelectionHash(selectedIds, area)` (replace the area part of each id), `buildTransportAreaModel`.
- `transportRegionMap.ts`: `buildTransportRegionMapModel(facts)` — `registered.<region>` in the latest year all 11 have, via `buildLatestValueRegionMapModel`.
- `transportHubCards.ts`: headline series `fleet.cars`, `fleet.cars_age_over_10`, `passenger_km.total`, `tonne_km.total`; Regions shows map years only.
- `transportWorkbook.ts`: template `housingWorkbook.ts`; number format `#,##0.0` (km per person `#,##0`).

- [ ] **Step 1: Tests** in `tests/explorer/transport.test.ts` (fixture: the canonical CSV through `toClientTransportFact`): each topic's default selection and first row; every listed id exists in `TRANSPORT_INDICATORS`; Vehicles lists 4 + 8 + 6 + 6 + 5 rows; `#sel=transport.passenger_km.total,transport.passengers.metro` parses to `["transport.passenger_km.total"]` and `#sel=transport.passengers.metro&from=2000` to range 2012–2025 (Review Focus 3); ticking `transport.passenger_km_per_person.total` while `passenger_km.total` is selected replaces it; `fleet.cars` 2004 is `null` in the model; `passenger_km.sea` 2021 is `0`; `transportAreaSelectionHash(["transport.road_km.region_guria_local"], "georgia")` is `#sel=transport.road_km.total_local` and the default selection gives `""` (Review Focus 5); the region map's year is 2025 and its first region is Tbilisi at 855; the four hub cards' footers end in 2025; the workbook of the default Passengers selection has one row with 2025 = 11262.1.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/transport.test.ts`. Expected FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** the test and `npm run typecheck`. Expected PASS.
- [ ] **Step 5: Commit** `feat: transport series, area and map models`.

### Task 5: Pages, messages and navigation

**Files:** Create `apps/web/components/transport/{transport-explorer,transport-index,transport-area-explorer}.tsx`, `apps/web/lib/pages/{transport,transport-shared,transport-regions,transport-area}.tsx`, `apps/web/lib/pages/hubs/transport.tsx`, routes under `app/(ka)/explorer/transport/` and `app/(en)/en/explorer/transport/` (hub, four topics, `regions`, `regions/[id]`), `apps/web/lib/i18n/messages/{ka,en}/transport.json`. Modify `lib/i18n/messages/{ka,en}/common.json` (hub and five page labels, rail labels `dataTransport`), `lib/i18n/messages.server.ts`, `lib/i18n/inventory.server.ts`, `lib/i18n/types.ts`, `lib/navigation/navTree.ts` (Transport after Energy and food, `TREE_SOURCE_NOTES` → `common.geostatSourceNote`), `lib/seo/sitemap.ts`, `lib/seo/datasetVocabulary.ts`, `public/llms.txt`. Tests: extend `tests/navigation/navTree.test.ts`, `tests/seo/routes.test.ts`, `tests/seo/agentFiles.test.ts`, `tests/site/datasetHubs.test.ts`, `tests/i18n/presentation.test.tsx` as Housing did.

**Interfaces:** components mirror Housing's three components with `transport` test ids (`transport-<section>`, `transport-latest`, `transport-excel-download`, `transport-region-map`, `transport-area-<area>`). Latest lines (`transport.latest.*`, short enough for 375 px): Vehicles "{value} million passenger cars" with period year (value `fleet.cars` / 1000, two decimals); Vehicle age "{value} million cars over 10 years old"; Passengers "{value} billion passenger-km" (one decimal); Freight "{value} billion tonne-km"; Regions "{region}: {value} thousand registered vehicles"; area "{value} thousand registered vehicles" with the area name as note. Georgian wording follows Geostat's Georgian tables where they exist (ავტოსატრანსპორტო საშუალებები, მგზავრთბრუნვა, ტვირთბრუნვა); the rest are proposals listed for Duru's proofread.

- [ ] **Step 1: Tests**: navTree places `/explorer/transport` right after Energy and food with five sections; sitemap and routes include the 2 × (6 + 12) pages; `npm run i18n:check` passes; `presentation.test.tsx` loads the `transport` namespace in both languages.
- [ ] **Step 2: Run** the touched test files. Expected FAIL. **Step 3: Implement.** **Step 4: Run** them, `npm run typecheck` and `npm run lint`. Expected PASS.
- [ ] **Step 5: Commit** `feat: Transport hub pages and navigation`.

### Task 6: Methodology, sources and documents

**Files:** Create `apps/web/lib/methodology/content/transport.ts`, `content/en/transport.ts`, `data/methodology/source-archives/transport.csv`, `docs/data-methodology/transport-annual.md`. Modify `lib/methodology/{catalog,sourceInventory,types}.ts`, `lib/methodology/content/en/revisions.ts`, `lib/pages/methodology-article.tsx`, `data/localization/en/{documents,sources,page-revisions}.json`, `data/methodology/decision-register.csv`, `lib/factQuery/buildSnapshot.ts` (exclude transport sources, as housing), `Project_Definition.md` §2, `DESIGN.md` (hub, five pages, area pages). Tests: extend `tests/methodology/{catalog,sourceInventory,methodologyArticle,prepareArchives}.test.ts`, `tests/i18n/methodologyCoverage.test.ts`, `tests/factQuery/buildSnapshot.test.ts` as Housing did.

**Interfaces:** methodology text covers every bullet of spec §10 in plain words; decision-register rows record the rulings (yearly only, cumulative age rows kept, nil rules, unlisted tiny columns, Abkhazia/unknown not paged).

- [ ] **Step 1: Tests** as listed. **Step 2: Run.** Expected FAIL. **Step 3: Implement**, then `npm run data:prepare-methodology-archives` (or the script Housing ran for its archive) and `npm run data:prepare-fact-query-snapshot`.
- [ ] **Step 4: Run** the touched tests and `npm run i18n:check`. Expected PASS. **Step 5: Commit** `docs: Transport methodology and sources`.

### Task 7: Browser tests

**Files:** Create `apps/web/tests/browser/transport.spec.ts` (template `housing.spec.ts`). Modify the shared specs Housing touched (`hubs`, `landing`, `methodology`, `bilingual-methodology`, `mobile-repairs-nav`, `mobile-site-menu`, `route-code-splitting`, `seo`) for the new hub's counts.

- [ ] **Step 1: Write `transport.spec.ts`**: each topic page loads with its default row ticked and the latest line on one line at 375 px; ticking `Metro` under Passengers carried replaces All transport and the range becomes 2012–2025; the table shows a dash for cars 2004; Excel downloads a file; the Regions map links Tbilisi to `/explorer/transport/regions/tbilisi`; an area page's picker link to Guria keeps a Roads selection; language switch keeps selection, range and mode; no horizontal overflow at 390 and 768 px.
- [ ] **Step 2: Build and run** (CLAUDE.md recipe): `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, start on port 3100 in its own process group, `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/transport.spec.ts tests/browser/hubs.spec.ts`. Expected PASS. Stop the server group.
- [ ] **Step 3: Commit** `test: Transport hub browser coverage`.

### Task 8: Review with Duru

- [ ] Screenshots (desktop 1440 and phone 390) of the hub, each topic page, the Regions index and two area pages into `/mnt/project-files/transport-preview/`, with Chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.
- [ ] Reply with the screenshots and a Georgian proofread list (`/mnt/project-files/transport-preview/notes-for-duru.md`), then an `ask_decision` card: "Clickable preview" / "Screenshots only" / "Looks good, go ahead". Push the branch (no PR) only after "Clickable preview"; find the Vercel URL through the public GitHub API (memory `preview-via-branch-push`).

### Task 9: Gates and PR (after Duru's OK)

- [ ] Merge `origin/main`, redo the shared-file edits another hub may have changed, regenerate generated files with the repo's scripts.
- [ ] Run once: `npm run check`, `npm run build`, `npm run test:browser` (CLAUDE.md recipe, four workers), the reference fixture `npx vitest run tests/factQuery/reference.test.ts`.
- [ ] Push, open the PR with the attribution block, assign and request review from DuruMakh, subscribe to PR activity, drive CI green. Merge only on Duru's word.
