# Environment and climate hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Environment and climate hub (`/explorer/environment`): seven pages, with nine city air-quality pages and Georgia/region pages for Waste and Forests, served from Geostat's environment tables.

**Architecture:** A research package transcribes every used Geostat cell. A TypeScript prepare step re-reads each cell and writes one canonical CSV, mirrored into an `EnvironmentFact` table with parity checks. That is the Crime pipeline. The pages reuse:
- Crime's topic page shell and Housing's one-unit series lists.
- Housing's map index and area pages for Waste and Forests.
- Inflation's per-city route shape for city air quality.

**Tech Stack:** Next.js 16 (static prerender), strict TypeScript, Tailwind v4, Prisma 7 / Supabase mirror, SheetJS (`xlsx`), Vitest, Playwright, Python 3 + openpyxl + xlrd (research package only).

**Spec:** `docs/superpowers/specs/2026-10-20-environment-design.md`

## Global Constraints

- One short line under each heading (`LatestValueLine`, "{measure} · {year}: {value}"). It fits on one line at 375px. No other text under the heading. One source line under the chart.
- No tabs and no icon switches. Measures are rows under `FlatSeriesPanel` headings, with the total first. Nothing is nested under a caret. Names carry no prefixes.
- One unit at a time (`lib/explorer/unitList.ts`). Ticking a row of another unit replaces the selection.
- Missing is a gap, a table dash and a blank Excel cell, never zero. `…`, `...` and an unavailable `-` are no value. `-` is zero only where the table's legend says "Magnitude nil" (`Illegal-logging.xls`).
- Values are the published cell, rounded to 12 significant digits (a change of more than one part in a billion fails): `-6.699999999999999` is served as `-6.7`.
- Yearly values only. Every served fact has `basis=actual` and `valueStatus=official`.
- Stable lowercase ASCII IDs `environment.{topic}.{measure}[.{place}]`. Labels are display data.
- No new production dependency, chart type or icon family. Environment is not added to `/mcp` or the JSON publications.
- Georgian names are Geostat's Georgian-table wording ("სათბურის გაზები", "გარემო და კლიმატი"). They go on Duru's proofread list.
- Sidebar: Environment and climate sits after Energy and food, before Population.
- Review before pushing: no push, PR or full gate until Duru has seen screenshots and said go (project instructions).

**Amended while planning (2026-10-20).** None of this changes what a reader sees:
- The place (station, city, region, Georgia) is part of the indicator ID, as on Housing (`environment.waste.collected.region_tbilisi`). So `EnvironmentFact` has the same columns as `CrimeFact`, plus `decimals`, and no area column. Spec §11's "area" is the ID's last segment.
- **Changed while executing (2026-10-20):** `decimals` is not stored. It is read from the published value (`toClientEnvironmentFact` gives `Decimal.decimalPlaces()`), so the canonical CSV has exactly Crime's columns and the database model has no `decimals` column. Values are 12 significant digits, not 15, wherever this plan says 15. The climate rows name their region ("Guria (warmest region)"): Geostat names the four regions in its block titles, and they are fixed. `loadServedEnvironmentData()` returns the facts array.
- Water keeps the three treatment levels (primary, secondary, tertiary; million persons) as served rows that no page lists. Septic tanks and self-supplied households stay in the research package only.

## Review Focus

1. **A measure a city never published.** Mestia has no NO₂ average, and Zestaponi has no PM rows. A heading with no facts must not appear, and a limit row must not appear without its station rows. Task 5 tests that `environmentCitySeries` drops every row that has no fact.
2. **A selection carried to another city.** The previous/next links and the picker carry the hash. Station IDs never exist in another city, so the selection must fall back to that city's default, not to an empty chart. Task 5 tests this.
3. **Tbilisi on the Forests map.** Tbilisi has no timber value in any year, and `latestCompleteRegionYear` requires every region. The map must still draw Tbilisi's shape (unranked, "no data") and must not throw. Task 6 tests this.
4. **Negative and decimal values everywhere.** Forests and land is −5.8. Temperature anomalies are decimals, and the coldest region's monthly minima are not served. Lists, tooltips, tables and Excel keep the sign and the published decimals. Tasks 4 and 7 test this.
5. **Years without data in the middle of the axis.** Climate has 1990 and 1995, then 2000–2024. City stations start in different years. The chart shows lone dots, and the table shows dashes for 1991–1994. The range strip only offers years that have a value. Task 4 tests this.

---

### Task 1: Research package

**Files:**
- Create: `docs/Raw Data/Environment/geostat-environment-annual/` containing `official/` (copies of the used English files and their `ka/` versions from `/mnt/project-files/environment-sources/`), `source-manifest.csv`, `source-manifest.json`, `prepare.py`, `environment-annual.csv`, `coverage.csv`, `validation-report.json`, `test_validation.py`, `verify_independent.mjs`, `independent-validation.json`, `README.md`.
- Also copy the archived-only files listed in spec §11 (G-1..G-4, A-3, F-2, F-4, D-1, visitors, protected areas, water quality, `Air-Pollution.xls`, violations, forest area, timber by purpose).

**Interfaces:**
- Produces: `environment-annual.csv` with Crime's headers plus `decimals`: `year,indicator_id,value,published_value,unit,decimals,basis,value_status,source_id,source_sheet,source_cell,last_reviewed_at`.
- Produces: `coverage.csv` with `indicator_id,first_year,last_year,observations,unavailable_years`, the same format as Crime.
- Produces: `validation-report.json` with keys `status`, `primary_observation_count`, `reconciliation_failed_count`, `imputed_values`, `calculated_values` and `placeholder_cells_in_served_values`, as Crime reads them.
- Produces: source IDs `geostat_env_ghg`, `geostat_env_air_emissions`, `geostat_env_air_quality`, `geostat_env_temperature`, `geostat_env_precipitation`, `geostat_env_water_household`, `geostat_env_water_supply`, `geostat_env_water_losses`, `geostat_env_wastewater`, `geostat_env_waste`, `geostat_env_timber`, `geostat_env_illegal_logging` and `geostat_env_fires`, plus `_ka` twins and archived-only IDs.

**Indicator IDs:**
- **Greenhouse gases** (unit `mt_co2e` unless noted):
  - `environment.ghg.total`, `environment.ghg.net`
  - `environment.ghg.sector_{energy,industry,agriculture,waste,land}`
  - `environment.ghg.energy_{stationary,transport,fugitive}`
  - `environment.ghg.gas_{co2,methane,nitrous_oxide}`
  - `environment.ghg.gas_{hfcs,sf6}` (`kt_co2e`)
  - `environment.ghg.per_person` (`t_co2e_per_person`)
- **Air emissions** (`thousand_tonnes`): `environment.air.{co,nox,so2,nh3,nmvoc,tsp,pm10,pm25}.{total,stationary,mobile}`.
- **City air quality** (`ug_m3`; days for `pm10_days`):
  - Stations: `environment.aq.{pm10_avg,pm25_avg,no2_avg,pm10_days}.{station}`.
  - Zestaponi only: `environment.aq.{tsp_avg,so2_avg,no2_avg,mno2_avg}.zestaponi_e1`.
  - Limits: `environment.aq.{pm10_limit,pm25_limit,no2_limit}.{city}`. A limit is served only in years where that city has a value for the measure.
  - Station IDs: `tbilisi_a1`…`tbilisi_a5`, `kutaisi_b1`, `kutaisi_b2`, `batumi_c1`, `batumi_c2`, `rustavi_d1`, `rustavi_d2`, `zestaponi_e1`, `zugdidi_f1`, `akhaltsikhe_g1`, `telavi_h1`, `mestia_i1`.
  - City IDs: `tbilisi`, `kutaisi`, `batumi`, `rustavi`, `zestaponi`, `zugdidi`, `akhaltsikhe`, `telavi`, `mestia`.
- **Climate:**
  - `environment.climate.{temperature,temperature_anomaly}.{georgia,tbilisi,warmest,coldest}` (`celsius`)
  - `environment.climate.precipitation.{georgia,tbilisi,wettest,driest}` (`mm`)
- **Water:**
  - `environment.water.{gross,lost,net,households}` (`million_m3`)
  - `environment.water.lost_share` (`percent`)
  - `environment.water.people_{piped,sewers,treatment}` (`million_persons`)
  - `environment.water.share_{piped,sewers,treatment}` (`percent`)
  - `environment.water.per_person` (`m3_per_person`)
  - `environment.water.treatment_{primary,secondary,tertiary}` (`million_persons`, not listed)
- **Waste:**
  - `environment.waste.collected.{georgia|region_*}` (`thousand_tonnes`; region IDs are `BUSINESS_REGIONS` from `apps/web/lib/data/business/types.ts`)
  - `environment.waste.per_person` (`kg_per_person`)
- **Forests:**
  - `environment.forest.{timber_cut,illegal_logging}.{georgia|region_*|protected_areas}` (`m3`)
  - `environment.forest.fires` (`fires`), `environment.forest.burnt_area` (`hectares`)

- [ ] **Step 1: Write `test_validation.py`.** It asserts:
  - every check in spec §11 "Validation checks", with the exact anchors from the spec: ghg total 2000 `11.4` and 2022 `20.1`; per person 2022 `5.4`; `environment.air.co.total` 2024 `86.4`; `environment.aq.pm10_avg.tbilisi_a1` 2025 `31`; `rustavi_d1` 2025 `51`; Georgia temperature 2024 `10.3`; water lost 2025 `559.9`; lost share `64.4`; waste Georgia 2024 `1184`; timber cut Georgia 2024 `376215`; illegal logging Georgia 2014 `45915`;
  - no served value comes from a `…`, `...` or unavailable `-` cell;
  - `-` in `Illegal-logging.xls` is `0`;
  - `published_value` is the cell's 15-significant-digit value with trailing zeros dropped (`-6.699999999999999` gives `-6.7`; `52954.01500000112` gives `52954.015`);
  - `decimals` is the number of decimals in `published_value`;
  - "46*" is served as `46` and listed in the README's footnote list.
- [ ] **Step 2:** Run `python3 -I test_validation.py`. Expected: FAIL, no CSV.
- [ ] **Step 3: Implement `prepare.py`.** It locates rows by their printed labels, not by fixed row numbers, so a moved row fails loudly. It writes every used cell with its sheet and cell reference, writes `coverage.csv` and `validation-report.json`, and stays offline. Air-quality station blocks are found by their "Monitoring Station X / name" line, and each pollutant row is located inside its block.
- [ ] **Step 4:** Run `python3 -I prepare.py && python3 -I test_validation.py`. Expected: PASS. The README states the observation count, about 2,100.
- [ ] **Step 5: Implement `verify_independent.mjs`.** It uses SheetJS and shares no code with `prepare.py`. It recomputes every CSV row from its cell and writes `independent-validation.json` with `status: "passed"`. Run `node verify_independent.mjs`. Expected: `passed`.
- [ ] **Step 6:** Commit with the message `data(environment): Geostat environment research package`.

### Task 2: Canonical data module

**Files:**
- Create: `apps/web/lib/data/environment/{types,validation,prepareEnvironment,importEnvironment}.ts` and `apps/web/scripts/prepare-environment.ts`.
- Modify: `apps/web/package.json` to add `data:prepare-environment`, which runs `--write`.
- Modify: `apps/web/scripts/validate-all.ts` to add the `--check` step.
- Create: `data/imports/environment-annual.csv` and `data/reports/environment-validation.json`.
- Test: `apps/web/tests/data/environment/environment.test.ts`

**Interfaces:**
- Produces in `types.ts`:
  - `ENVIRONMENT_INDICATORS: readonly string[]`, built from the station, city and region constants, in research-package order.
  - `type EnvironmentIndicator = string`, checked against that list.
  - `ENVIRONMENT_UNITS`, the 16 units in spec §11.
  - `ENVIRONMENT_SOURCES` and `ENVIRONMENT_PUBLIC_SOURCES`.
  - `ENVIRONMENT_RESEARCH_DIRECTORY = "docs/Raw Data/Environment/geostat-environment-annual"`.
  - `ENVIRONMENT_STATIONS: readonly { id: string; city: EnvironmentCity; code: string }[]`.
  - `ENVIRONMENT_CITIES`, the nine city IDs in Geostat order. `EnvironmentCity` is the type.
  - `type EnvironmentFact`: the `CrimeFact` fields plus `decimals: number`. `value` and `publishedValue` are decimal text.
  - `type ClientEnvironmentFact = Pick<…, "year" | "indicatorId" | "sourceId" | "unit" | "decimals"> & { value: number }`.
  - `environmentFactKey(fact)`, which returns `${indicatorId}:${year}`.
- Produces in other files:
  - `validateEnvironmentFacts(facts, repositoryRoot?)` (`validation.ts`).
  - `prepareEnvironmentData(root, "write" | "check")` (`prepareEnvironment.ts`).
  - `loadEnvironmentFacts(root?)`, `loadServedEnvironmentData(): Promise<{ facts: EnvironmentFact[] }>`, `assertEnvironmentParity(csv, mirror)` and `toClientEnvironmentFact(fact)` (`importEnvironment.ts`).

- [ ] **Step 1: Write the tests.** Follow `tests/data/crime/crime.test.ts`. The tests cover:
  - `prepareEnvironmentData(root, "check")` passes on the repository.
  - On a temporary copy, each of these is rejected: a changed value, a deleted row, a duplicate row, a value in a year outside coverage, a `0` written over a `…` cell, and a sector total that no longer adds up.
  - `toClientEnvironmentFact` keeps `-5.8` and `decimals: 1`.
  - `loadEnvironmentFacts` rejects a canonical-fingerprint mismatch.
- [ ] **Step 2:** Run `npx vitest run tests/data/environment/environment.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement the four modules and the script by copying Crime's structure.**
  - Write `cellValue(cell)`. It returns the 15-significant-digit text of a numeric cell, or of a text cell that is a number with an optional trailing `*`. It returns `undefined` for a placeholder, except `-` in `geostat_env_illegal_logging`, which returns `"0"`.
  - Validation repeats every sum check from spec §11 in decimals, with these tolerances:

    | Check | Tolerance |
    |---|---|
    | GHG sector sums | `0.15` |
    | Gas sum (HFCs and SF₆ ÷ 1,000) | `0.15` |
    | Stationary + mobile | `0.15` |
    | Water lost + net | `0.15` |
    | Waste regions | `0.15` |
    | Timber and logging regions + protected areas | `2` |

    The tolerance absorbs Geostat's published rounding. Every gap recorded in the report is exact.
  - Write `REVIEWED_AT = "2026-10-20"`.
- [ ] **Step 4:** Run `npm run data:prepare-environment`, then the test file. Expected: PASS. Then run `npx tsx scripts/prepare-environment.ts --check`. Expected: `{"status":"passed","scope":"environment_annual"}`.
- [ ] **Step 5:** Commit with the message `data(environment): canonical serving file and checks`.

### Task 3: Database mirror

**Files:**
- Modify: `apps/web/prisma/schema.prisma`. Add an `EnvironmentFact` model like `CrimeFact`, plus `decimals Int`, and the relation fields beside `crimeFacts`.
- Create: `apps/web/prisma/migrations/20261020090000_environment/migration.sql`. It enables RLS and revokes the public grants, copying the crime migration.
- Modify: `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts` (add `loadEnvironmentFactsFromDb`), `apps/web/scripts/import-budget-facts.ts` and `docs/data-methodology/database-import.md`.
- Test: extend `apps/web/tests/data/environment/environment.test.ts`.

**Interfaces:**
- Consumes: `EnvironmentFact` and `assertEnvironmentParity` from Task 2.
- Produces: `loadEnvironmentFactsFromDb(): Promise<EnvironmentFact[]>`.

- [ ] **Step 1: Write the tests.**
  - `assertEnvironmentParity` passes on CSV rows against the same rows with `value` written as `"-5.80"`. It fails when one value differs.
  - The mirror row mapper round-trips one fact of each unit.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement.** Follow Crime's mirror and import entries exactly. Parity normalises `Decimal.toFixed()` on both sides.
- [ ] **Step 4:** Run the test (PASS) and `npm run typecheck` (PASS).
- [ ] **Step 5:** Commit with the message `data(environment): database mirror and parity`.

### Task 4: National topic pages model

**Files:**
- Create: `apps/web/lib/explorer/environment.ts`
- Test: `apps/web/tests/explorer/environment.test.ts`

**Interfaces:**
- Consumes: `ClientEnvironmentFact`, and the `unitList.ts` and `topicSeries.ts` helpers.
- Produces:
  - `ENVIRONMENT_HUB_PATH = "/explorer/environment"`.
  - `ENVIRONMENT_SECTIONS`, seven `{ id, href, labelKey }` entries. The IDs are `greenhouse-gases`, `air-pollution`, `air-quality`, `climate`, `water`, `waste` and `forests`. The label keys are `common.environment{GreenhouseGases,AirPollution,AirQuality,Climate,Water,Waste,Forests}`.
  - `type EnvironmentTopicId = "greenhouse-gases" | "air-pollution" | "climate" | "water"`.
  - `type EnvironmentSeriesDefinition = { id: string; reference: boolean; heading: string; stroke?: "dashed" }`.
  - `environmentTopicSeries(section)`, with the rows and headings in exactly spec §4, §5, §7 and §8 order:
    - Heading keys are `totals`, `bySector`, `energyDetail`, `byGas`, `fluorinated`, `perPerson`.
    - Air pollution uses the pollutant keys `co`, `nox`, `so2`, `nh3`, `nmvoc`, `tsp`, `pm10`, `pm25`.
    - Climate uses `temperature`, `anomaly`, `precipitation`.
    - Water uses `water`, `lostShare`, `people`, `peopleShare`, `perPerson`.
  - `environmentDefaultSelection(section)`: the first row, except `air-pollution`, which selects the eight `.total` rows.
  - `type EnvironmentState = TopicState`.
  - `parseEnvironmentHash`, `serializeEnvironmentHash` and `changeEnvironmentSelection`, built on `unitList.ts`.
  - `type EnvironmentModel = { range; years; series; selected; unit }`.
  - `buildEnvironmentSeriesModel(definitions, facts, state, color?)`, generic over a definitions list and reused by Tasks 5 and 6. Rows without any fact are dropped.
  - `environmentValueUnit(unit, decimals): ValueUnit`.
  - `environmentUnitLabelKey(unit)`, which returns `environment.unit.{unit}`.

- [ ] **Step 1: Write the tests.**
  - The greenhouse-gases list starts `["environment.ghg.total", "environment.ghg.net", "environment.ghg.sector_energy", …]`, with headings in spec order.
  - Air pollution's default is eight IDs ending `.total`.
  - Ticking `environment.ghg.gas_hfcs` while `total` is selected leaves only `gas_hfcs`.
  - On the climate model the years run 1990–2024. 1991–1994 are null, and the range strip years are `[1990, 1995, 2000, …, 2024]`.
  - `sector_land` in 2022 is `-5.8` in the model.
  - A hash `sel=unknown` gives the default.
  - A hash `sel=` gives an empty selection.
- [ ] **Step 2:** Run `npx vitest run tests/explorer/environment.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The range strip receives `unitListCoverage(...).years`, the coverage years themselves.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat(environment): topic page series and model`.

### Task 5: City air quality model

**Files:**
- Create: `apps/web/lib/explorer/environmentCities.ts`
- Test: `apps/web/tests/explorer/environmentCities.test.ts`

**Interfaces:**
- Consumes: `ENVIRONMENT_CITIES`, `ENVIRONMENT_STATIONS` and `buildEnvironmentSeriesModel` from Task 4.
- Produces:
  - `AIR_QUALITY_PATH = "/explorer/environment/air-quality"`.
  - `environmentCityHref(city)`, which returns `${AIR_QUALITY_PATH}/${city}`.
  - `environmentCityForSlug(slug): EnvironmentCity | null`.
  - `neighbourEnvironmentCities(city)`, with wrap-around as in `inflationCityRoutes.ts`.
  - `environmentCitySeries(city, facts)`. Headings are `pm10`, `pm25`, `no2` and `pm10Days`. Zestaponi's are `tsp`, `so2`, `no2` and `mno2`. A heading lists its stations in Geostat order, then the limit row with `stroke: "dashed"`, `reference: false` and a grey colour. Rows and headings without facts are dropped.
  - `environmentCityDefaultSelection(city, facts)`: every `pm10_avg` station of the city plus `pm10_limit.{city}`. For Zestaponi it is `tsp_avg.zestaponi_e1`.
  - `parseEnvironmentCityHash` and `changeEnvironmentCitySelection`.
  - `environmentCityColor(definition, index)`. Limits use the shared grey `OTHER_COLOR`. Stations take the palette by their position in the city.

- [ ] **Step 1: Write the tests.**
  - Tbilisi's PM10 heading lists `tbilisi_a1..a5` and then `pm10_limit.tbilisi`, which is dashed.
  - Mestia's list has no `no2Avg` heading when its facts have no `no2_avg`.
  - Zestaponi has no limit rows and defaults to `tsp_avg`.
  - A Tbilisi selection parsed on the Kutaisi page falls back to Kutaisi's default.
  - The limit row for Kutaisi PM2.5 is 25 through 2019 and 20 from 2020, and only in years where Kutaisi has PM2.5 values.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement.** The city slug is the city ID.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat(environment): city air quality model`.

### Task 6: Waste and Forests areas and maps

**Files:**
- Create: `apps/web/lib/explorer/environmentAreas.ts` and `apps/web/lib/explorer/environmentRegionMap.ts`.
- Modify: `apps/web/lib/explorer/regionalEconomyMap.ts`. Add an optional `withoutValue?: readonly string[]` to `buildLatestValueRegionMapModel`. Those regions keep their path, get `value: null`, `rank: null` and no bucket, and sort last. Without the option, today's output is unchanged.
- Modify: `components/regional-economies/regional-economies-index.tsx`. Draw a `withoutValue` region with the map's empty fill and list it last with a dash. `RegionMapModel.regions[].value` becomes `number | null`, and existing callers are untouched.
- Test: `apps/web/tests/explorer/environmentAreas.test.ts`, plus one case in the existing region map test file.

**Interfaces:**
- Consumes: `areaRoutes`, `BUSINESS_REGIONS` and `buildEnvironmentSeriesModel`.
- Produces:
  - `type EnvironmentAreaTopic = "waste" | "forests"`.
  - `ENVIRONMENT_AREAS = ["georgia", ...BUSINESS_REGIONS]`.
  - `environmentAreaRoutes(topic)`, which returns `areaRoutes(...)` for `/explorer/environment/{topic}`.
  - `environmentAreaSeries(topic, area, facts)`, following spec §9 and §10. Georgia's Forests headings are `timber`, `protected`, `fires`, `burntArea`. Region pages have `timber`. Rows without facts are dropped, so Tbilisi gets illegal logging only.
  - `environmentAreaDefaultSelection(topic, area, facts)`: the first remaining row.
  - `parseEnvironmentAreaHash`, `changeEnvironmentAreaSelection` and `environmentAreaSelectionHash(topic, ids, area)`. The hash moves `…{measure}.{area}` to the target area.
  - `buildEnvironmentRegionMapModel(topic, facts): RegionMapModel`. Waste uses `collected.region_*`. Forests uses `timber_cut.region_*`, with `region.tbilisi` as `withoutValue`.

- [ ] **Step 1: Write the tests.**
  - The Forests map builds without throwing. It has 10 ranked regions plus Tbilisi with `value: null` and `rank: null`, year 2024.
  - The Waste map's year is 2024 and its first-ranked region is Tbilisi.
  - Tbilisi's forests page lists only `environment.forest.illegal_logging.region_tbilisi`.
  - Georgia's forests page lists 6 rows under 4 headings.
  - `environmentAreaSelectionHash("waste", ["environment.waste.collected.georgia"], "region_imereti")` is `""` (the default).
  - An existing Housing map test still passes unchanged.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the new tests and `npx vitest run tests/explorer` (the region map consumers). Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat(environment): waste and forests areas and maps`.

### Task 7: Hub cards, city cards and workbook

**Files:**
- Create: `apps/web/lib/explorer/environmentHubCards.ts` and `apps/web/lib/explorer/environmentWorkbook.ts`.
- Test: `apps/web/tests/explorer/environmentHubCards.test.ts` and `apps/web/tests/explorer/environmentWorkbook.test.ts`.

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces:
  - `buildEnvironmentHubCards(facts, presentation): HubCardModel[]`. There are seven cards in section order. Each sparkline is the page default's first series: GHG total, CO total, Rustavi D1 PM10, Georgia temperature, water gross, waste Georgia and timber Georgia. Gaps are `null`.
  - `buildEnvironmentCityCards(facts, presentation): HubCardModel[]`. There are nine cards. Each uses the first station's `pm10_avg` (Zestaponi: `tsp_avg`) and links to `environmentCityHref`.
  - `buildEnvironmentWorkbookExportModel(input, presentation)`. `input` has `{ facts, labels, sources, siteOrigin, title, state }` and one of `{ section }`, `{ city }` or `{ topic, area }`. It follows `crimeWorkbook.ts`, with Excel number formats built from `decimals` (`#,##0.0` and so on, `-` kept). The filename stem is `environment-{section|city|topic-area}`.

- [ ] **Step 1: Write the tests.**
  - The hub has seven cards.
  - The GHG footer reads `2022 · 20.1 · 2000–2022` in English.
  - There are nine city cards, and Zestaponi's links to `/explorer/environment/air-quality/zestaponi`.
  - A workbook for `sector_land` writes `-5.8` with format `#,##0.0`.
  - A blank year is `null` with status "unavailable".
  - Every source in the Sources sheet is a validated archive link.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat(environment): hub cards and workbook`.

### Task 8: Explorer components

**Files:**
- Create in `apps/web/components/environment/`:
  - `environment-explorer.tsx`: one client component for topic, city and area pages, following `crime-explorer.tsx` without the measure switch.
  - `environment-place-heading.tsx`: the heading with picker and previous/next links, following `housing-area-explorer.tsx` lines 76–90. It is used by city pages (picker of nine cities, index `AIR_QUALITY_PATH`) and by area pages (`RegionPicker`).
  - `environment-region-index.tsx`: follows `housing-index.tsx`.
  - `environment-city-index.tsx`: `ExplorerHeading`, `LatestValueLine` and `BudgetHub` cards (`components/hub/budget-hub.tsx`) with `testId="environment-city-cards"`.

**Interfaces:**
- `EnvironmentExplorer` props:
  - `{ scope: { kind: "topic"; section } | { kind: "city"; city } | { kind: "area"; topic; area } }`
  - `facts`, `labels`, `sources`, `lastReviewedAt`, `siteOrigin`
  - `heading?: ReactNode`, which replaces the plain `ExplorerHeading`
  - `latest: { measure: string; year: number; value: string; note?: string }`, computed on the server page
- Each list row's value is `listLatest` (`unitList.ts`). Dashed series pass `dashed: true` to `EditorialLineChart`.

- [ ] **Step 1: Write the tests.** Add a component test following an existing explorer component test (`tests/explorer/` or `tests/components/`). Rendering the GHG scope shows heading rows in spec order, and the `sector_land` row shows `−5.8`. Rendering Tbilisi's city scope draws the limit series with `dashed`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Reuse `FlatSeriesPanel`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `ChartSelectionAids`, `ExcelDownloadButton`, `RegionIndex`, `RegionPicker` and `EntityNeighbourLinks` as is.
- [ ] **Step 4:** Run the tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat(environment): explorer components`.

### Task 9: Pages, routes and messages

**Files:**
- Create the page modules in `apps/web/lib/pages/`:
  - `environment-shared.tsx`: `renderEnvironmentFrame`, metadata, sources and static params. It contains no explorer imports.
  - `environment.tsx`: topic pages.
  - `environment-air-quality.tsx`: index and city pages.
  - `environment-areas.tsx`: map index and area pages for both topics.
  - `hubs/environment.tsx`.
- Create the routes under `apps/web/app/(ka)/explorer/environment/` and `apps/web/app/(en)/en/explorer/environment/`: `page.tsx`, the four topic folders, `air-quality/page.tsx`, `air-quality/[city]/page.tsx`, `waste/page.tsx`, `waste/[id]/page.tsx`, `forests/page.tsx` and `forests/[id]/page.tsx`. Each `[…]` route sets `dynamicParams = false` and has `generateStaticParams`.
- Create `apps/web/lib/i18n/messages/{ka,en}/environment.json`. It holds:
  - the title, the meta texts and `hubSummary`;
  - page titles and summaries;
  - the `latest.*` lines from spec §4–§10;
  - headings, `unit.*` labels, every series label, and station and city names;
  - the source notes, the empty-selection text and the workbook strings.
- Modify: `apps/web/lib/i18n/messages/{ka,en}/common.json` (seven section keys plus `common.environment` and `common.dataEnvironment`), `apps/web/lib/i18n/types.ts` (`MESSAGE_SCOPES`), `apps/web/lib/i18n/messages.server.ts` and `apps/web/lib/i18n/inventory.server.ts` (all route paths, including city and area pages).
- Test: `apps/web/tests/i18n/presentation.test.tsx`. Extend it with environment message-key coverage for both locales.

**Interfaces:**
- Consumes: Tasks 2 and 4–8.
- Produces: `renderEnvironmentPage(locale, section)`, `renderEnvironmentAirQualityIndex(locale)`, `renderEnvironmentCityPage(locale, slug)`, `renderEnvironmentRegionIndex(locale, topic)`, `renderEnvironmentAreaPage(locale, topic, slug)`, `renderEnvironmentHub(locale)` and the matching `*Metadata` functions.

**Latest lines** (built on the server):

| Page | Line |
|---|---|
| Greenhouse gases | GHG total, latest year |
| Air pollution | CO total |
| City air quality index | The city whose first station has the highest PM10 average in the latest year |
| City page | The first station's PM10 (Zestaponi: TSP) |
| Climate | Georgia's temperature, with the anomaly as `note` |
| Water | Lost share |
| Waste map | Georgia, with the value in million tonnes to two decimals |
| Waste area page | That area's tonnes |
| Forests map and area pages | Timber cut; Tbilisi's page uses illegal logging |

- [ ] **Step 1: Write the tests.** Extend the i18n tests so every series ID and heading used by Tasks 4–6 has a `ka` and an `en` label. Add a test that `inventory.server.ts` lists 7 + 9 + 12 + 12 = 40 Environment route paths per locale, plus the hub.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the pages, routes and messages.
- [ ] **Step 4:** Run the i18n tests, `npm run typecheck` and `npm run i18n:check`. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat(environment): pages, routes and messages`.

### Task 10: Site wiring, methodology and docs

**Files:**
- Modify:
  - `apps/web/lib/navigation/navTree.ts` (after Energy and food, `spaced: true`)
  - `apps/web/lib/seo/sitemap.ts` (hub, sections, city and area URLs)
  - `apps/web/lib/seo/datasetVocabulary.ts`
  - `apps/web/public/llms.txt`
  - `apps/web/lib/methodology/{catalog,types,sourceInventory}.ts`
  - `apps/web/lib/methodology/content/en/revisions.ts`
  - `apps/web/lib/pages/methodology-article.tsx` (its five maps)
- Create: `apps/web/lib/methodology/content/environment.ts` and `apps/web/lib/methodology/content/en/environment.ts`, with the content of spec §12.
- Create or modify the data files:
  - `data/localization/en/{documents,sources,page-revisions}.json`
  - `data/sources/source-documents.csv`
  - `data/methodology/source-archives/environment.csv`
  - `data/methodology/decision-register.csv` (one entry per spec decision: unnamed warmest region, the 2019 wastewater re-sorting kept unlisted, limits only over measured years, Tbilisi unranked on the Forests map, the city cards exception)
- Docs:
  - Create `docs/data-methodology/environment-annual.md`.
  - Modify `DESIGN.md`: §6.6 (city cards exception), §6.7 order and sections, and the hub counts "sixteen" → "seventeen" at every mention.
  - Modify `Project_Definition.md` §2 (new hub), `docs/deployment.md` and `.gitignore` if Crime's change needed it.
- Tests: update the counts and lists in
  - `tests/seo/{routes,agentFiles}.test.ts`
  - `tests/site/datasetHubs.test.ts`
  - `tests/methodology/{catalog,sourceInventory,methodologyArticle,prepareArchives}.test.ts`
  - `tests/i18n/methodologyCoverage.test.ts`
  - `tests/factQuery/buildSnapshot.test.ts`
  - `tests/navigation/navTree.test.ts`

- [ ] **Step 1: Write the tests.** Update every listed test to expect the new hub, for example the hub list includes `/explorer/environment` after `/explorer/energy-food`. Run them. Expected: FAIL.
- [ ] **Step 2: Implement** the wiring, methodology content and docs.
- [ ] **Step 3:** Run `npx vitest run tests/seo tests/site tests/methodology tests/i18n tests/navigation tests/factQuery/buildSnapshot.test.ts`. Expected: PASS.
- [ ] **Step 4:** Commit with the message `feat(environment): navigation, SEO, methodology and docs`.

### Task 11: Browser tests and preview

**Files:**
- Create: `apps/web/tests/browser/environment.spec.ts`
- Modify the shared counts in `apps/web/tests/browser/`: `landing.spec.ts` (footer 19 → 20), `mobile-site-menu.spec.ts` (17 → 18), `mobile-repairs-nav.spec.ts`, `hubs.spec.ts`, `seo.spec.ts`, `methodology.spec.ts`, `bilingual-methodology.spec.ts` and `route-code-splitting.spec.ts`. Recount each against the current main before editing.

- [ ] **Step 1: Write `environment.spec.ts`.** It checks:
  - The hub shows 7 cards.
  - Each page's latest line matches spec §4–§10. For example, on Greenhouse gases it contains "2022" and "20.1".
  - Default selections: GHG has 1 row, Air pollution 8, Tbilisi 6.
  - Ticking HFCs replaces the selection.
  - The air-quality index shows 9 cards, and clicking Rustavi opens `/explorer/environment/air-quality/rustavi`.
  - On the Zestaponi page the TSP row is selected and there is no limit row.
  - On the Waste map, clicking Georgia opens `/waste/georgia`.
  - The Forests map shows Tbilisi unranked, and Tbilisi's page lists illegal logging only.
  - At 375px every latest line is a single line, with height ≤ one line box as in the Education spec, and there is no horizontal scroll.
  - Excel downloads on GHG.
  - The `/en` mirror of one page loads with English labels.
- [ ] **Step 2: Build and serve once**, as CLAUDE.md describes (`NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, `setsid` start on port 3100). Run `CI=1 … npx playwright test tests/browser/environment.spec.ts` and the shared specs touched. Expected: PASS. Stop the server group.
- [ ] **Step 3: Take preview screenshots** at desktop and 375px of the hub, all seven pages, Tbilisi, Zestaponi, Waste Georgia and Forests Tbilisi, into `/mnt/project-files/screenshots/environment/`. Use Chromium `executablePath`, as in the preview memory. Write `/mnt/project-files/environment-preview/notes-for-duru.md` with the proofread list and any Geostat sum differences found.
- [ ] **Step 4:** Commit with the message `test(environment): browser coverage`. Then post the screenshots with the preview card. Stop for Duru's choice before any push.

After Duru's go: merge `main`, redo the shared-file edits that conflict, then run `npm run check`, `npm run build` and `npm run test:browser` once. Then push, open the PR and drive CI to green.
