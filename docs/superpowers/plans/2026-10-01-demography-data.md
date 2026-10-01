# Demography Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reviewed, reproducible annual demography data from Geostat (population on 1 January, age structure, vital events, international migration) with explicit lineage flags, one registered census break and a validation report, without changing any existing public figure.

**Architecture:** Follow the regional-economies pipeline. A hash-verified source package is read through `readVerifiedPackageFile`. Stored-value sheet readers feed typed observations. Reviewed alias and component maps bridge Geostat's naming. One `prepareDemography` validates the observations against the audit's identities and writes the canonical CSVs and the validation report in `--write` and `--check` modes.

**Tech Stack:** TypeScript, SheetJS `xlsx` already in `apps/web`, `decimal.js`, `csv-parse`, Vitest, existing static data pipeline.

**Spec:** `docs/superpowers/specs/2026-10-01-demography-data-design.md`

**Evidence:** `docs/Raw Data/Demography/geostat-demography/2026-10/source-review.md` and `source-manifest.csv` (26 rows, already archived and verified).

## Global Constraints

- Coverage, from the spec: population and age structure for Georgia from 1 January 2004 through 2026, with `estimate_basis` `retro_projection` through 2014, `pre_census` for 2015–2024 and `census_based` from 2025; regions and municipalities from 2015. Vital events for Georgia 2014–2025, regions and municipalities 2015–2025. Migration for Georgia 2012–2025. Carry nothing earlier, although the archived tables hold it.
- Served series: population by Georgia, region and municipality; population by sex and 5-year age group with derived 0–14, 15–64 and 65+; live births, deaths, natural increase; crude birth rate, crude death rate, total fertility rate, infant mortality rate, life expectancy at birth by sex; immigrants, emigrants and net migration, with immigrants and emigrants by citizenship. Everything else in the archive is validation only. Single years of age (table 02-1) stay in the archive and out of the dataset.
- Read stored cell values, never displayed text: no `raw: false`. Convert thousands to integer persons by rounding after asserting each value is within 1e-6 persons of a whole number, then compare in integers.
- The census recalculation is the only break in the served data. The break register has that one entry and no growth or rate may be computed across it. Event counts and border-police migration counts do not break at the census; the population stock, age structure and every rate with a population denominator do.
- The balancing residual (change in 1 January population minus births, plus deaths, minus net migration) is 0 in every transition except 2024→2025, where it must equal +225,922. Any other residual stops preparation.
- A label difference is bridged only by a reviewed alias; row position never joins tables. A country missing from a year's citizenship list produces no row, never a zero.
- Annual data only; no extraction from PDF; no 2024 census detail.
- Leave `data/imports/municipal-population-2025.csv` and `docs/data-methodology/municipal-population-regional-gdp.md` unchanged.
- This plan adds no route, serving-mirror import, MCP data, publication, workbook or sidebar change. The database import and the `lib/methodology/sourceInventory.ts` entry belong to the page stage.
- Registering fact sources changes the fact-query snapshot's source count (precedent: the product-index data stage). Update the counts in `tests/factQuery/sources.test.ts` and `tests/factQuery/buildSnapshot.test.ts` (both 132 today) and run `npx vitest run tests/factQuery/reference.test.ts`; a disagreement there is a stop condition (`CLAUDE.md`).
- Work in `apps/web` for commands. A fresh checkout has no `node_modules`; run `npm ci` once. Use targeted tests while working, then `npm run check` and `npm run build` once at the end.

## Review Focus

1. A display-rounded value must never enter. Task 2 reads Tbilisi 2025 as 1,335,671 persons, not 1,335,700.
2. The census step is the only unexplained residual. Task 6 tests that +225,922 passes and that any other residual stops.
3. Spelling variants and starred cities. Task 3 tests that an unreviewed label stops, that city components are added only for their published years (events 2014–2016, population 2015–2017), and that the stray zero (table 29, `C. Gori*`, 2020, cell `AB85`) is ignored at that cell only.
4. Start years. Tasks 4 and 5 test that no vital-event row before 2014, no migration row before 2012 and no regional row before 2015 exists in the canonical files.
5. Citizenship. Task 5 tests that a country absent from a year's list produces no row, that `Other` is kept as published, and that an unreviewed label stops.
6. A future capture that rewrites 2015–2024 or moves the census residual cannot silently replace the canonical files. Task 6 tests both.

## File Map

| Responsibility | Files |
| --- | --- |
| Source package (archived) | `docs/Raw Data/Demography/geostat-demography/2026-10/{source-manifest.csv,source-review.md,official/}` |
| Package and sheet readers | `apps/web/lib/data/demography/sourceFiles.ts`, `readStoredSheet.ts`, `types.ts` |
| Shared constants and stop conditions | `apps/web/lib/data/demography/{series,stops}.ts` |
| Reviewed identity maps | `data/mappings/demography/{geography-aliases,excluded-units,event-city-components,source-anomalies,citizenship}.csv`; `apps/web/lib/data/demography/{geography,citizenship,anomalies}.ts` |
| Family readers | `apps/web/lib/data/demography/{readUnitTable,readPopulation,readVital,readMigration}.ts` |
| Calculations and validation | `apps/web/lib/data/demography/{calculations,validation,crossChecks,breaks}.ts` |
| Preparation and canonical output | `apps/web/lib/data/demography/prepareDemography.ts`, `apps/web/scripts/prepare-demography.ts`, `data/imports/demography-{population,structure,vital,migration}-annual.csv`, `data/imports/demography-series-breaks.csv`, `data/reports/demography-validation.json` |
| Registration and methods | `data/sources/source-documents.csv`, `data/localization/en/{documents,sources}.json`, `data/localization/{en,ka}/service-messages.json`, `docs/data-methodology/demography.md`, `Project_Definition.md`, `apps/web/package.json` |
| Tests | `apps/web/tests/data/demography/*.test.ts`, plus the two fact-query count updates |

---

### Task 1: Verify the source package

**Files:** Create `apps/web/lib/data/demography/sourceFiles.ts`, `types.ts`; test in `apps/web/tests/data/demography/sourceFiles.test.ts`.

**Interfaces:** `loadDemographySources(repositoryRoot: string): Promise<DemographySources>`; `DemographySources.get(sourceId: string): { bytes: Buffer; row: ManifestRow }`. The manifest is the BOM-prefixed `source-manifest.csv`, with upper-case SHA-256.

- [ ] **Step 1: Install the locked dependencies if absent.** Run `npm ci` in `apps/web`.
- [ ] **Step 2: Write failing tests.** Assert 26 manifest rows with the expected columns and the roles 12 canonical, 9 validation, 1 archived, 4 definitions; every file matches its bytes and SHA-256; table 01 resolves through the municipal package and equals the 2026-08-03 bytes (`8BD7A1B56E756E8D6BC92192095795B204B23FD18274AAFF39B78C0B0A487A57`, 34,994 bytes); a tampered byte, a duplicate source ID, a missing file and a path escape each throw.
- [ ] **Step 3: Run `npx vitest run tests/data/demography/sourceFiles.test.ts`.** Expected: fails, because the reader does not exist.
- [ ] **Step 4: Implement the reader on `readVerifiedPackageFile`** (containment and symlink checks). A `local_file` that starts with `docs/` resolves against the repository root, the rest against the package folder.
- [ ] **Step 5: Run the targeted test.** Expected: pass. Commit the reader and test only.

### Task 2: Stored-value sheet reader

**Files:** Create `readStoredSheet.ts`; test in `tests/data/demography/readStoredSheet.test.ts`.

**Interfaces:** `readStoredSheet(bytes: Buffer, expectedSheet?: string): StoredSheet`; `StoredSheet.text(ref): string | null`; `StoredSheet.persons(ref): number | null`, which converts thousands to integer persons and throws `NotWholePersonError` past 1e-6 persons; `findYearColumns(sheet, headerRow)` for tables with three columns per year (02, 02-1); `findYearBlocks(sheet)` for tables stacked by year (32, 33).

- [ ] **Step 1: Write failing tests on the archived files.** Table 01 `AG5` is 3,930,428 persons; `AG6` (Tbilisi 2025) is 1,335,671 persons although the workbook displays 1,335.7; in table 02 each year's 19 age rows sum to its total in integer persons; a synthetic cell 0.0001 persons off a whole number throws; a missing sheet or moved header row throws.
- [ ] **Step 2: Run the test.** Expected: fails.
- [ ] **Step 3: Implement with `XLSX.read(bytes, { type: "buffer" })` and `sheet[ref].v`.** Never call `sheet_to_json` with `raw: false`, which returns displayed text.
- [ ] **Step 4: Run the test; commit.**

### Task 3: Reviewed identity maps

**Files:** Create five mapping CSVs under `data/mappings/demography/`, `geography.ts`, `citizenship.ts`, `anomalies.ts`; tests in `tests/data/demography/geography.test.ts` and `citizenship.test.ts`.

**Content:** `geography-aliases.csv` holds the reviewed spelling bridges, each scoped to the table family it was seen in: `Dedoplistskaro`/`Dedoplistsqaro`, `Tetritskaro`/`Tetritsqaro`, `Tkibuli`/`Tqibuli`, `Tskaltubo`/`Tsqaltubo` for the event tables and the census table, plus the census table's `Sighnaghi` and its five `C. Name` city labels. `excluded-units.csv` lists the six units outside the 64 (`Abkhazia A.R.`, `Ajara Municipality`, `Akhalgori`, `Eredvi`, `Tighva`, `Kurta`). `event-city-components.csv` lists the seven starred cities for 2014–2016; the population component years (2015–2017) come from the existing `population-component-map.csv`, which is reused, not copied. `source-anomalies.csv` records the one reviewed stray cell (table 29, `AB85`, value 0). `citizenship.csv` maps every label seen in table 33 (22 labels: 18 countries plus `Total`, `Other`, `Stateless`, `Not stated`) to a stable lowercase ASCII ID. The existing `geography-map.csv` and `data/imports/municipalities.csv` stay the municipality and region authority, and identifiers follow the query layer: `country.georgia`, `region.*` and two-digit municipality codes.

**Interfaces:** `loadDemographyGeography(root): Promise<DemographyGeography>` with `resolve(label, scope: "population" | "events" | "census"): ResolvedUnit` (kinds `country`, `region`, `municipality`, `city_component` with its years, `excluded`) and `readUnitRows(sheet)`; `loadCitizenships(root).resolve(label): string`; `loadReviewedAnomalies(root).accepts(sourceId, cell, value): boolean`. All throw on an unreviewed label, and each loader refuses a conflicting or malformed reviewed file.

- [x] **Step 1: Write failing tests.** Every label in tables 01, 09, 19 and 29 resolves (1 country, 10 regions, 64 municipalities, 7 city components, 6 excluded); an invented spelling throws, as does a variant used outside its reviewed scope; component years are enforced; the `AB85` zero is the only accepted stray cell and only with value 0; all 22 citizenship labels resolve with unique ids and an unseen label throws.
- [x] **Step 2: Run the tests.** Expected: fail.
- [x] **Step 3: Implement the resolvers and add the reviewed rows with a `mapping_note` for each.**
- [x] **Step 4: Run the tests; commit the maps and resolvers.**

### Task 4: Population and structure observations

**Files:** Create `readUnitTable.ts` (the Georgia, region and unit table reader that Task 5 reuses for tables 09, 19 and 29), `readPopulation.ts`, `calculations.ts`; tests in `tests/data/demography/readPopulation.test.ts` and `calculations.test.ts`.

**Interfaces:** `readPopulation(sources, geography): DemographyObservation[]` for table 01 (Georgia 2004–2026; the 11 regions and 64 municipalities 2015–2026, starred city components added for 2015–2017; Tbilisi's region takes its municipality's row because Geostat prints no separate one); `readAgeStructure(sources): DemographyObservation[]` for table 02 (Georgia 2004–2026, sexes `total`, `male`, `female`, an all-ages total, 19 age groups and the derived bands, 1,587 rows); `ageBands(groups): { band_0_14, band_15_64, band_65_plus }` in integer persons. `DemographyObservation` carries `seriesId`, `geographyId`, `year`, `value` (integer persons as a string), `unit`, `estimateBasis`, `status`, `sourceId`, `sourceLocator` (sheet, cell and reference date, e.g. `1!AG5 [2025-01-01]`; a band is its summed cell range) and `lastReviewedAt`; the structure rows add `sex` and `ageGroup`. The reference date lives in the locator, as in the canonical columns of Task 7.

- [x] **Step 1: Write failing tests with the audit's values.** Georgia on 1 January: 2004 3,937,716 (`retro_projection`), 2014 3,716,911 (`retro_projection`), 2024 3,694,608 (`pre_census`), 2025 3,930,428 (`census_based`). Derived bands, in persons: 2004 774,246 / 2,609,421 / 554,049; 2014 685,299 / 2,504,647 / 526,965; 2024 721,620 / 2,376,293 / 596,695; 2025 773,322 / 2,466,699 / 690,407; each trio sums to the year's total. Georgia equals the sum of the 64 municipalities in every year 2015–2026 and each region row equals its members; no regional row before 2015; the population file has 923 rows.
- [x] **Step 2: Run the tests.** Expected: fail.
- [x] **Step 3: Implement the readers and the band calculation on integers.** `estimateBasis` follows the reference year; the source locator keeps the stored cell.
- [x] **Step 4: Run the tests; commit.**

### Task 5: Vital-event and migration observations

**Files:** Create `readVital.ts`, `readMigration.ts`; tests in `tests/data/demography/readVital.test.ts` and `readMigration.test.ts`. Extend the sheet reader with `findYearRows` (tables with one row per year), `expectLabel` (a header guard) and a decimals argument on `published`, and the unit-table reader with reviewed stray cells.

**Interfaces:** `readVitalEvents(sources, geography, anomalies): DemographyObservation[]` for tables 09, 19, 29 (counts) and 15, 24, 16, 25, 28 (Georgia-level rates, carried as published); `readMigration(sources, citizenships): DemographyObservation[]` for table 31 (net migration, `citizenship.total`) and table 33 (immigrants and emigrants by sex, the total and by citizenship); table 32 is checked against table 33 in Task 6. Rates carry the published precision as a decimal string with a `unit` of `per_1000_population`, `children_per_woman`, `per_1000_live_births` or `years`. **Published precision is the decimals the workbook displays** (1; 2 for the total fertility rate), rounded half up: Geostat stores some rates unrounded under a one-decimal format (the 2025 crude birth rate is stored 9.621254111811286 and displays 9.6; infant mortality 2014–2018 is likewise), and the digits past the display are not published. A test compares every carried rate with the text the workbook displays. Counts are whole persons, locators carry the calendar year (`1!AG5 [2025]`), and the migration file orders rows by series, citizenship (the reviewed map's order), sex and year.

- [x] **Step 1: Write failing tests.** Births 2014 are 60,635 and 2025 37,867; deaths 2014 49,087 and 2025 44,319; natural increase 2014 11,548. Georgia equals the sum of the 64 municipalities (components added for 2014–2016) and each region equals its members, 2015–2025. Georgia-level series start in 2014 and no earlier row exists; municipalities and regions start in 2015. Total fertility rate 2025 is 1.53, infant mortality rate 7.6, life expectancy 76.0 (males 71.4, females 80.6). Migration for 2012 is 69,063 immigrants, 90,584 emigrants, net −21,521; for 2025, 131,501, 114,374 and +17,127; table 33 Georgian citizens in 2012 are 29,173 immigrants and 60,307 emigrants. No migration row before 2012. A country absent from a year's list yields no row, `Other` is kept as published, and the natural increase rate and net migration rate are not in the output.
- [x] **Step 2: Run the tests.** Expected: fail.
- [x] **Step 3: Implement both readers.** `estimateBasis` is `registered` for vital events and `border_police` for migration; ignore the `AB85` zero only at that cell.
- [x] **Step 4: Run the tests; commit.**

### Task 6: Validation, break register and report

**Files:** Create `validation.ts` (the served rows: coverage, keys, exact identities, the revision guard, the report), `crossChecks.ts` (the checks that read the archive beyond the served rows) and `breaks.ts`; tests in `tests/data/demography/validation.test.ts` and `breaks.test.ts`.

**Interfaces:** `validateDemography({ observations, sources, geography, previous? }): DemographyValidationReport`, which throws a named `DemographyStopError` for each stop condition and otherwise returns the report; `buildBreakRegister(): BreakRow[]` returning the one census entry (`{ breakId: "census_recalculation_2025", appliesTo, referenceDate: "2025-01-01", reason, sourceNote }`; it applies to population stock, structure and every rate with a population denominator including the crude rates, not to event counts, the infant mortality rate or migration, and quotes Geostat's footnote). `UNAFFECTED_BY_CENSUS` lists the series it leaves out, and a test fails when a served series is in neither list. The checks run in this order, so a corrupted value is named by the first check that sees it: coverage and unique keys (`layout_changed`), the archive balance (`balancing_residual`, `census_residual_changed`), exact identities, the table 32 and 33 totals and the mid-year definition (`identity_failed`), the census anchor (`census_anchor`), rate recomputation (`rate_deviation`), then the comparison with the previous capture (`revision`, which the report does not record, because it would make the file depend on whether an earlier capture exists).

- **Mid-year population** is the 1 January value plus half of that year's natural increase and net migration. For 2024 this is the average of the 2024 value and the pre-census 2025 value, which is why Geostat's 2024 rates sit on the pre-census basis. Table 04 also differs from the 1 January average in 2008 (+10,147.5 persons, unexplained, outside the served years), so the mid-year and rate checks run over the served years 2014–2025 only.
- **Rates** (CBR, CDR, natural increase rate, net migration rate, infant mortality rate) are recomputed within 0.05 and the total fertility rate (5 × the sum of the seven age-specific rates) within 0.005, both plus 1e-9 for float noise, because a rate Geostat displays to one decimal sits within half of 0.1 of its exact value. Share aged 65+ and the three dependency ratios are recomputed from the served age bands for 2004–2026. Life expectancy in the abridged table 27 is compared with table 28 over 1994–2025 within 0.25 years.
- **Revisions** stop with a readable list of the first 20 changes and have no accept list. Reviewing a revision is a decision for the day it happens; the stop is what the spec requires.

- [x] **Step 1: Write failing tests for each check in spec §7.** The reviewed archive passes; the report records the 26 source hashes, the coverage of all 16 series (923 population rows; vital events from 2014; migration from 2012), the balancing residual of each of the 32 transitions (0 except +225,922 for 2024→2025), the mid-year check, the census anchor (+847 persons; all 64 municipalities matched, largest 0.818%, Kazbegi), the observed rate deviations (CBR 0.028, CDR 0.047, natural increase rate 0.045, net migration rate 0.048, infant mortality 0.044, total fertility 0.005, share 65+ and dependency ratios up to 0.0496, life expectancy 0.158) and the blank-cell inventory.
- [x] **Step 2: Add one corrupting test per stop condition.** An unreviewed label, a moved header, a blank served cell, a display-rounded Tbilisi value, a second balancing residual in an unserved year, a moved census step, a municipality outside 1% of its census count, a rate that no longer matches (one case per recomputation), a changed 2015–2024 value, a part that no longer adds to its whole (sexes, mid-year, tables 32 and 33), and a row outside the coverage rules. Each must throw its named condition.
- [x] **Step 3: Run the tests.** Expected: fail.
- [x] **Step 4: Implement the checks and the report.** The report records source hashes, coverage by family, the blank-cell inventory, the balancing residual by year, the mid-year check, the census anchor, and the recomputed-rate deviations.
- [x] **Step 5: Run the tests; commit.**

### Task 7: Preparation, canonical files and wiring

**Files:** Create `prepareDemography.ts`, `apps/web/scripts/prepare-demography.ts`, the five canonical CSVs and `data/reports/demography-validation.json`; modify `apps/web/package.json`; test in `tests/data/demography/prepareDemography.test.ts`.

**Interfaces:** `prepareDemography(repositoryRoot)` reads every family, validates the whole and returns the rows, the report and the break register; `buildDemographyArtifacts(result)` returns the files as bytes; `writeDemographyArtifacts(write: boolean, repositoryRoot: string)` writes them or, with `write` false, fails on a missing or stale file. They follow `writeRegionalEconomyArtifacts`, and the CSVs use `serializeBomCsvRows`. All four family files share `series_id, geography_id, year, value, unit, estimate_basis, status, source_id, source_locator, last_reviewed_at`; the structure file adds `sex`, `age_group` after `year`; the migration file adds `sex`, `citizenship_id` after `year`. The break register is one row with `applies_to` as a semicolon-separated list of series ids. The rows of the committed files are the previous capture for the revision guard, so a write that would change one stops before it writes anything. Run the script with `npm run data:prepare-demography` and `npm run data:check-demography`; it prints the row counts, the census step and anchor, and how many rate checks passed.

- [x] **Step 1: Write failing tests.** `--write` produces byte-identical files on a second run; `--check` fails when any committed file differs; the written files contain no row outside the coverage rules in Global Constraints.
- [x] **Step 2: Run the tests.** Expected: fail.
- [x] **Step 3: Implement preparation and the script.** Add `data:prepare-demography` and `data:check-demography` to `package.json` and append `npm run data:check-demography` to `data:validate`.
- [x] **Step 4: Run `npm run data:prepare-demography`, then `npm run data:check-demography`.** Read the report and the row counts: 923 population, 1,587 structure, 2,595 vital and 1,274 migration rows, one break, 11 rate checks within their bounds.
- [x] **Review checkpoint:** the user inspects the break register and the canonical-data diff before Task 8. (Reviewed; the user approved proceeding to Task 8 on 2026-10-01.)
- [x] **Step 5: Commit the code, canonical files and report.**

### Task 8: Registration, methodology, scope amendment and final verification

**Files:** Modify `data/sources/source-documents.csv`, `data/localization/en/documents.json`, `data/localization/en/sources.json`, `data/localization/en/service-messages.json`, `data/localization/ka/service-messages.json`, `apps/web/lib/factQuery/buildSnapshot.ts`, `tests/factQuery/sources.test.ts`, `tests/factQuery/buildSnapshot.test.ts`, `tests/factQuery/localization.test.ts`, the package's `source-manifest.csv`, `Project_Definition.md`; create `docs/data-methodology/demography.md`.

**What registration needed beyond the six registration files.** The fact-query snapshot refuses a source that resolves to no public document (spec section 8.1), and it joins sources to documents by file path through a reviewed manifest. So `buildSnapshot.ts` now also reads the demography package's `source-manifest.csv` (newest vintage), publishing only the `canonical_input` rows stored under `official/`; the validation inputs, the definition PDFs and the reused table 01 (already the municipal package's document) stay evidence. Each document cites the years the dataset serves, not the years the file holds, so the manifest gained `normalized_year_min` and `normalized_year_max` for the 12 canonical inputs, and validation stops if they differ from the years the rows cover. Preparation also stops (`unregistered_source`) when a served source is missing from `source-documents.csv`. The documents are English-language workbooks, so their catalogue entries carry `documentLanguage: "en"`.

- [x] **Step 1: Register the 11 new canonical-input sources** (tables 02, 09, 15, 16, 19, 24, 25, 28, 29, 31, 33) with the IDs in `source-manifest.csv`. `source.geostat_municipal_population` is already registered. Validation-only and definition files stay methodology originals. For each, add the source name, document title, publisher and attribution in English and Georgian to `data/localization/{en,ka}/service-messages.json` (keys `sources.<id>.name` and `documents.<id>.title|publisher|attribution`) and the English entries to `en/documents.json` and `en/sources.json`, following the product-index precedent. Run `npm run i18n:check`. **The Georgian strings are reviewed build inputs: draft them, and the user reviews them before this task is accepted.** (Drafted; awaiting the user's review.)
- [x] **Step 2: Update the two source-count tests from 132 to 143.** Run `npx vitest run tests/factQuery/reference.test.ts`; a disagreement is a stop condition, reported and not edited away. (51 tests agree; the fact-query, MCP and methodology folders pass, 864 tests.)
- [x] **Step 3: Write `docs/data-methodology/demography.md`.** Scope, sources and hashes, definitions from Geostat's metadata, the census break and the 2014 and 2012 start dates, the integer-persons rule, the identities and tolerances, the revision precedent, the refresh rhythm and the stored-versus-displayed note about `municipal-population-2025.csv`.
- [x] **Step 4: Amend `Project_Definition.md`** with a bounded demography data-stage approval. The `დემოგრაფია` sidebar marker stays non-clickable and no page, route or export is approved.
- [x] **Step 5: Run the done-check once.** From `apps/web`: `npm run check`, then `npm run build`. No UI changes, so no browser tests. Report any failure with its output. `npm run check` passed (316 test files, 2,674 tests). `npm run build` cannot finish in the cloud sandbox: Turbopack's `next/font/google` loader fails with `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`, and the commit before this work (`e30ba0c`) fails identically there. With the Google fonts stubbed out temporarily (not committed), the whole build passes: the prebuild steps, the compile, all 251 static pages and the post-build checks, including 21 fact-query publications current at the new data version. The real build, with fonts, runs in CI.
- [x] **Step 6: Commit.** Do not open a pull request unless asked.
