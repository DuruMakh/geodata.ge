# Municipal population and regional GDP methodology

## Purpose and boundary

This methodology governs the research-only Geostat package at `docs/Raw Data/Municipalities/geostat-population-regional-gdp/`. Geostat, the National Statistics Office of Georgia, is authoritative here because it publishes both the population and regional-GDP workbooks preserved in that package.

The package adds no data to `data/imports`, no database import or database content, and no application loader, route, component, chart, table, CSV export, or UI. Municipal GDP/proxies are out of scope and not present. The old Ministry of Finance portal `Population` column is unused for values and gap filling.

## Measures and observed coverage

### Municipal population

The measure is Geostat's *Population as of 1 January by regions and self-governed units*, sheet `1`, in `(thousands)`. It is population as of each `YYYY-01-01`, not a mid-year measure. The preserved source covers 1994-2026; the normalized output is a complete 2015-2025 panel with 704 rows: 64 canonical municipalities times 11 years. The 2025 values carry the workbook note that, following the 2024 population census, population size and related data as of 1 January 2025 were recalculated.

### Regional GDP

The measure is Geostat's *Distribution of gross domestic product by regions at current prices*, sheet `regional GDP`: total regional GDP at current prices, in `mil. GEL`. The preserved workbook's observed in-window coverage is 2010-2024, so the normalized output has 165 rows: 11 canonical regions times 15 years. It does not claim coverage for 2005-2009 or 2025, because those years are absent from the preserved workbook. The source says it was last updated 2025-12-23 and links metadata at https://www.geostat.ge/media/68649/0403_060225_EN.PDF. It has no stated preliminary or revised row designation; normalized values therefore use `status = final_as_published`.

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

## Normalization rules

For each population value, select the mapped source row and the year column in sheet `1`; retain the published thousands value and calculate `population_persons = population_thousand * 1000`. For each GDP value, select the mapped source row and the year column in `regional GDP`; the source is already `mil. GEL`, so there is no scale conversion. All GDP rows have `status = final_as_published`.

Every normalized row records the source sheet, worksheet row, year column, and A1 source cell in its `transformation` field. The preparation code calculates these coordinates directly from the preserved XLSX worksheet. This protects provenance when source worksheet labels are not ordered like the normalized CSV: the source-cell comparison is based on, for example, population `W6` for Tbilisi in 2015 and GDP `B3` for Tbilisi in 2010, not a derived CSV row position.

An official blank, suppressed, unavailable, or non-numeric source cell must remain blank in the normalized output and appear in the validation gap inventory. It must never become zero. The observed outputs have zero such official gaps: population is complete for 2015-2025 and GDP is complete for the source's 2010-2024 coverage. No estimates were created.

## Validation and reconciliation

The preparation step validates the two source hashes and byte sizes against `source-manifest.csv`, the exact municipality and region crosswalk sets, excluded-code absence, unique keys, year sets, and numeric nonnegative values. It emits the fixed approved CSV headers and writes the normalized CSVs with a UTF-8 BOM, but does not reopen them to validate the BOM or Georgian text. It does not open or validate the XLSX review workbook.

It then recalculates every normalized value from its recorded source workbook cell and compares the serialized CSV entry to that selected cell. `validation-report.json` consequently reports `source_hashes_match: true` and `normalized_values_reconcile: true` as well as `status: complete` and `estimates_created: 0`.

For GDP, the check retains Geostat's `GDP at market prices` national row only as reconciliation evidence. It calculates `published national total minus sum of the 11 regional values`; no regional value is altered. The non-zero differences are +0.1 million GEL (2012, 2019), -0.2 (2013, 2021, 2022), -0.1 (2016, 2017), and +0.2 (2018, 2023). These are published component-rounding differences; all other 2010-2024 years are 0.0 at published precision.

## Reproducible rerun

From the repository root, use the web-package commands in this order:

```powershell
Set-Location apps/web
npm run data:prepare-municipal-indicators
npm test -- tests/data/municipalIndicators/geostatPackage.test.ts
npm run check
npm run build
```

The preparation command regenerates only the two normalized CSVs and `validation-report.json` from the preserved source captures. The focused test independently checks capture hashes, CSV BOM and Georgian-text encoding, source-row/cell values, conversion, crosswalks, zero gaps, and national reconciliation. It opens the review workbook to assert its four sheet names and that its data-row counts equal the CSV row counts; it does not establish row-by-row XLSX value parity. `npm run check` and `npm run build` are the repository-wide validation and production-build gates.

Author the XLSX review workbook separately, after the preparation command, with the git-ignored SDD support builder `.superpowers/sdd/2026-08-03-municipal-population-regional-gdp-collection/build-review-workbook.mjs` and its bundled workspace `@oai/artifact-tool` runtime. The builder reads the generated CSVs and geography map, writes the four review sheets, and is neither a committed project dependency nor part of `npm run data:prepare-municipal-indicators`. Inspect its key workbook ranges, scan for formula errors, render all four sheets, and visually verify legibility and layout before accepting the workbook; do not commit the builder, runtime junction, or render previews.

After any rerun, manually compare every documented count, observed year, source hash, and reconciliation difference with `source-manifest.csv` and `validation-report.json`. Confirm that the status remains `complete`, the population panel remains 704 rows for 2015-2025, the GDP panel remains 165 rows for 2010-2024, and `estimates_created` remains 0. If a source changes, document the new observed coverage, footnotes, last-update/status information, URL, date, byte size, and hash before treating it as a replacement package.
