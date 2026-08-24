# Municipal population and regional GDP methodology

## Purpose and boundary

This methodology governs the preserved Geostat package at `docs/Raw Data/Municipalities/geostat-population-regional-gdp/`. Geostat, the National Statistics Office of Georgia, is authoritative here because it publishes both the population and regional-GDP workbooks preserved in that package.

The complete 2015-2025 population panel and the regional-GDP dataset remain research assets. Only the validated 64-row 2025 municipality population slice is promoted to `data/imports/municipal-population-2025.csv`, mirrored in the database, and used on the municipality index for the bounded budget-per-resident map, supporting list values, and median KPI. It does not create a historical per-capita series, detail-page measure, toggle, or export. Regional GDP remains outside application serving. Municipal GDP/proxies are out of scope and not present. The old Ministry of Finance portal `Population` column is unused for values and gap filling.

## Measures and observed coverage

### Municipal population

The measure is Geostat's *Population as of 1 January by regions and self-governed units*, sheet `1`, in `(thousands)`. It is population as of each `YYYY-01-01`, not a mid-year measure. The preserved source covers 1994-2026; the normalized output is a complete 2015-2025 panel with 704 rows: 64 canonical municipalities times 11 years. The 2025 values carry the workbook note that, following the 2024 population census, population size and related data as of 1 January 2025 were recalculated.

### Regional GDP

The measure is Geostat's *Distribution of gross domestic product by regions at current prices*, sheet `regional GDP`: total regional GDP at current prices, in `mil. GEL`. The preserved workbook's observed in-window coverage is 2010-2024, so the normalized output has 165 rows: 11 canonical regions times 15 years. It does not claim coverage for 2005-2009 or 2025, because those years are absent from the preserved workbook. The source says it was last updated 2025-12-23 and links metadata at https://www.geostat.ge/media/68649/0403_060225_EN.PDF. It has no stated preliminary or revised row designation; normalized values therefore use `status = final_as_published`.

## Bounded 2025 application calculation

The served denominator uses `year = 2025`, `reference_date = 2025-01-01`, and `population_persons` for exactly the 64 canonical public municipalities. Its registered source ID is `source.geostat_municipal_population`. The canonical application file is generated deterministically from the preserved normalized package by `npm run data:prepare-municipal-population`; `npm run data:check-municipal-population` fails if the reviewed output is stale. No estimate or gap filling is permitted.

For a municipality, `budget_per_resident_gel = 2025 public_total_gel / 2025 population_persons`. For a region, the numerator is the same displayed 2025 region total used by the list and the denominator is the exact sum of member-municipality populations. Adjara therefore uses its consolidated total after adding republican actual payments and removing transfers to its six territorial budgets. The median KPI sorts all 64 full-precision municipality results and averages the 32nd and 33rd values. Values are rounded to the nearest whole GEL only when displayed.

Missing, duplicate, zero, negative, or non-finite population fails validation, as does a missing or duplicate 2025 municipal total. The Georgia aggregate receives no per-resident value because its numerator includes five aggregate-only municipal budgets without a territorial population assignment. No population reference-date label is repeated beside the map; the visible source note provides Geostat attribution while source rows retain the exact date and transformation.

## Sources and immutable captures

The manifest records the exact retrieval date (2026-08-03), source pages, actual media URLs, local paths, hashes, sizes, and full versus normalized coverage. Validate preserved captures before using them:

| Source ID | File | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| `geostat_population_self_governed_units` | `official/01-population-by-self-governed-unit.xlsx` | `8BD7A1B56E756E8D6BC92192095795B204B23FD18274AAFF39B78C0B0A487A57` | 34,994 |
| `geostat_regional_gdp_current_prices` | `official/regional-GDP-ENG.xlsx` | `DD2042DFF5E2C44B98B4BB140163B5736CF5A71F4683B9E6A359373907D59C35` | 13,871 |

Source pages are https://www.geostat.ge/en/modules/categories/41/population and https://www.geostat.ge/en/modules/categories/23/gross-domestic-product-gdp. Retrieved files are https://www.geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx and https://www.geostat.ge/media/79752/regional-GDP-ENG.xlsx.

The files under `official/` are immutable captures. If Geostat changes a download or its media URL, preserve the new file separately and revise the manifest from observed facts; do not silently replace the old capture.

## Geography review

`geography-map.csv` is a reviewed one-to-one crosswalk. Its 64 municipality rows equal the code set in `data/imports/municipalities.csv`; its 11 region rows equal the IDs in `data/taxonomy/municipal-regions.json`. The five excluded municipal codes — `05`, `42`, `43`, `46`, and `64` — are not mapped into the normalized population output.

Only exact and reviewed aliases are allowed. The reviewed municipal aliases normalize Geostat's `C.` city prefix for codes `04`, `06`, `20`, `32`, and `48`. The reviewed regional aliases map `Adjara A.R.` to `region.adjara` and trim preserved trailing source whitespace for Kakheti, Mtskheta-Mtianeti, Racha-Lechkhumi and Kvemo Svaneti, Samegrelo-Zemo Svaneti, Samtskhe-Javakheti, and Kvemo Kartli. Each alias has its rationale in `mapping_note`; no fuzzy matching is used.

`population-component-map.csv` is separate from identity mapping. It contains seven explicit `sum` rules for 2015-2017: the separately published `C. Ozurgeti*`, `C. Telavi*`, `C. Mtskheta*`, `C. Ambrolauri*`, `C. Zugdidi*`, `C. Akhaltsikhe*`, and `C. Gori*` rows are added to their corresponding present-day canonical municipalities. The source footnote and populated cells show those cities separately for the 1 January 2015-2017 columns; from 2018 their starred cells are blank and the base municipality row is already combined. These component rows receive no new GeoData IDs.

## Normalization rules

For each population value, select the mapped base row and the year column in sheet `1`. When a component rule applies, add the separately published starred-city cell for that same year. Retain the resulting published-thousands precision and calculate `population_persons = population_thousand * 1000`. The 21 corrected values are: Telavi 58.2/57.7/57.2; Zugdidi 106.7/105.7/104.2; Gori 125.4/124.7/123.8; Ozurgeti 62.8/62.3/61.8; Akhaltsikhe 39.2/39.2/39.3; Mtskheta 54.6/54.4/54.2; and Ambrolauri 11.2/11.1/10.8 for 2015/2016/2017 respectively. For each GDP value, select the mapped label and year column in `regional GDP`; the source is already `mil. GEL`, so there is no scale conversion. All GDP rows have `status = final_as_published`.

Every normalized row records the source sheet, worksheet row, year column, and A1 source cell in its `transformation` field. Composite rows record both inputs and the addition; for example, Telavi 2015 is `W39 + W35 = 58.2`. The preparation code calculates these coordinates directly from the preserved XLSX worksheet. This protects provenance when source worksheet labels are not ordered like the normalized CSV: non-composite examples are population `W6` for Tbilisi in 2015 and GDP `B3` for Tbilisi in 2010, not a derived CSV row position.

An official blank, suppressed, unavailable, or non-numeric source cell must remain blank in the normalized output and appear in the validation gap inventory. It must never become zero. The observed outputs have zero such official gaps: population is complete for 2015-2025 and GDP is complete for the source's 2010-2024 coverage. No estimates were created.

## Validation and reconciliation

The preparation step validates every approved `source-manifest.csv` field, including exact schema, IDs, titles, publisher, roles, URLs, ISO retrieval dates, local paths, hashes, byte sizes, full and normalized year bounds, and notes. It also validates the seven component rules, exact municipality and region crosswalk sets, excluded-code absence, unique keys, year sets, and numeric nonnegative values. Duplicate/unknown component IDs or labels, dates outside 2015-2017, unsupported operations, and missing required component cells fail generation. It emits fixed CSV schemas and writes the normalized CSVs with a UTF-8 BOM.

It then recalculates every normalized value from its recorded source workbook cell or explicit source-cell sum and compares the serialized CSV entry to that evidence. It records official gap inventories and calculates both population and GDP national reconciliations in `validation-report.json`, which reports `source_hashes_match: true`, `normalized_values_reconcile: true`, `status: complete`, and `estimates_created: 0`.

For population, reconciliation is `published Georgia total minus sum of the 64 canonical municipalities`, in thousands. The differences for 2015-2025 are respectively `-0.1, 0.0, -0.3, +0.5, +0.3, -0.1, +0.2, +0.3, +0.1, 0.0, -0.2`. These small differences are published component rounding; values are never adjusted.

For GDP, the check retains Geostat's `GDP at market prices` national row only as reconciliation evidence. It calculates `published national total minus sum of the 11 regional values`; no regional value is altered. The non-zero differences are +0.1 million GEL (2012, 2019), -0.2 (2013, 2021, 2022), -0.1 (2016, 2017), and +0.2 (2018, 2023). These are published component-rounding differences; all other 2010-2024 years are 0.0 at published precision. If any regional component is null, the reconciliation is `complete: false` and both regional sum and difference are null; missing values are never coalesced to zero.

## Reproducible rerun

From the repository root, use the web-package commands in this order:

```powershell
Set-Location apps/web
npm run data:prepare-municipal-indicators
npm run data:check-municipal-indicators
npm run data:prepare-municipal-population
npm test -- tests/data/municipalIndicators/geostatPackage.test.ts
npm run data:check-municipal-population
npm run check
npm run build
```

The preparation command regenerates only the two normalized CSVs and `validation-report.json` from the preserved source captures plus the reviewed geography and population-component maps. `npm run data:check-municipal-indicators` regenerates the same three artifacts in memory and fails if any committed file differs byte-for-byte; it runs inside `npm run data:validate`, so a drifted package fails the repository-wide gate rather than being silently rewritten by the test suite. The focused test checks complete manifest facts and mutation rejection, component-rule failures, all 21 source-cell sums, both national reconciliations, CSV BOMs and Georgian text, and exact four-sheet XLSX semantic parity for every CSV field and value type. `npm run check` and `npm run build` are the repository-wide validation and production-build gates.

Author the XLSX review workbook separately, after the preparation command, with the git-ignored SDD support builder `.superpowers/sdd/2026-08-03-municipal-population-regional-gdp-collection/build-review-workbook.mjs` and its bundled workspace `@oai/artifact-tool` runtime. The builder reads the generated CSVs and geography map, writes the four review sheets, and is neither a committed project dependency nor part of `npm run data:prepare-municipal-indicators`. Inspect its key workbook ranges, scan for formula errors, render all four sheets, and visually verify legibility and layout before accepting the workbook; do not commit the builder, runtime junction, or render previews.

After any rerun, compare every documented count, observed year, source hash, component value, and reconciliation difference with the reviewed inputs and `validation-report.json`. Confirm that status remains `complete`, population remains 704 rows for 2015-2025, GDP remains 165 rows for 2010-2024, all 21 composite values remain source-backed, and `estimates_created` remains 0. If a source changes, document the new observed coverage, footnotes, last-update/status information, URL, date, byte size, and hash before treating it as a replacement package.
