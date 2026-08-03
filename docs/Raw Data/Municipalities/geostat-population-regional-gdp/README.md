# Geostat municipal population and regional GDP research package

## Scope and exclusions

This is a research-only package of official Geostat data. It contains annual population as of 1 January for GeoData.ge's 64 canonical municipalities and total regional GDP at current prices for its 11 canonical regions. It does not change `data/imports`, the serving database, routes, components, charts, tables, exports, or other UI.

The population panel covers 2015-2025; the regional GDP panel covers every in-window year present in the preserved source, 2010-2024. The canonical municipal exclusions are `05`, `42`, `43`, `46`, and `64`; none appears in the normalized population output. Municipal GDP/proxies are out of scope and not present. No estimates, interpolation, imputation, backcasting, or gap filling were created (`estimates_created: 0`).

The old Ministry of Finance municipal-portal `Population` column is unused: it is neither a value source nor a gap-filling source for this package.

## Files and how to review them

| File | Review purpose |
| --- | --- |
| `official/01-population-by-self-governed-unit.xlsx` | Immutable Geostat population capture; sheet `1`. |
| `official/regional-GDP-ENG.xlsx` | Immutable Geostat regional GDP capture; sheet `regional GDP`. |
| `source-manifest.csv` | Retrieved URLs, date, local paths, SHA-256 hashes, byte sizes, and full versus normalized year coverage. |
| `geography-map.csv` | Explicit source-label-to-GeoData ID crosswalk. |
| `municipal-population-annual-2015-2025.csv` | 704 normalized municipality-year rows. |
| `regional-gdp-annual-2005-2025-available-years.csv` | 165 normalized region-year rows. |
| `municipal-population-and-regional-gdp.xlsx` | Excel review workbook with `Read me`, `Population`, `Regional GDP`, and `Geography map` sheets. |
| `validation-report.json` | Machine-readable coverage, gap, hash, reconciliation, and exclusion checks. |

The four human-facing CSVs in this package (`source-manifest.csv`, `geography-map.csv`, and the two normalized files) use UTF-8 with BOM. The XLSX review sheets have the same normalized rows and geography rows as their CSV counterparts.

## Official sources and retrieval

Geostat (National Statistics Office of Georgia) is the sole statistical publisher for both measures. Both files were retrieved on 2026-08-03.

| Source ID | Dataset title and source sheet | Source page | Retrieved file | SHA-256 / bytes |
| --- | --- | --- | --- | --- |
| `geostat_population_self_governed_units` | *Population as of 1 January by regions and self-governed units*; `1` | https://www.geostat.ge/en/modules/categories/41/population | https://www.geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx | `8BD7A1B56E756E8D6BC92192095795B204B23FD18274AAFF39B78C0B0A487A57` / 34,994 |
| `geostat_regional_gdp_current_prices` | *Distribution of gross domestic product by regions at current prices*; `regional GDP` | https://www.geostat.ge/en/modules/categories/23/gross-domestic-product-gdp | https://www.geostat.ge/media/79752/regional-GDP-ENG.xlsx | `DD2042DFF5E2C44B98B4BB140163B5736CF5A71F4683B9E6A359373907D59C35` / 13,871 |

The GDP workbook says `Last update: 23.12.2025` and gives its metadata link as https://www.geostat.ge/media/68649/0403_060225_EN.PDF.

## Population definition and coverage

The population source title is *Population as of 1 January by regions and self-governed units* and its stated unit is `(thousands)`. It is an annual 1 January stock, not a mid-year population measure. The preserved workbook spans 1994-2026; this package normalizes 2015-2025 only.

The normalized output has 704 rows: 64 canonical municipalities for every year 2015-2025, inclusive. `population_thousand` retains Geostat's published precision; `population_persons` is the exact mechanical conversion `population_thousand * 1000`, not an additional estimate. Every normalized source cell is numeric, so the panel has zero official gaps.

The workbook states: “Based on the results of the 2024 population census, the population size and related data as of January 1, 2025 were recalculated.” It also states that `*` data are included in the relevant municipalities before 2014 and starting from 2017, and that `**` data are included in the relevant municipalities before 2006. These source footnotes are preserved in the official workbook; they do not create a normalized 2015-2025 gap for the 64 canonical rows.

## Regional GDP definition and coverage

The source sheet title is *DISTRIBUTION OF GROSS DOMESTIC PRODUCT BY REGIONS (at current prices, mil. GEL)*. It is total regional GDP at current prices in `mil. GEL`; it is not constant-price GDP, real growth, GDP per capita, or municipal GDP.

The preserved workbook covers 2010-2024, which is also the full observed normalized coverage within the requested 2005-2025 window. The output has 165 rows: 11 canonical regions for each of the 15 years. The national `GDP at market prices` row is retained only for validation, not emitted as a region. Every normalized source cell is numeric, so the normalized 2010-2024 panel has zero official gaps.

The workbook provides no per-value preliminary or revised designation. Accordingly, every normalized row preserves the explicit package status `final_as_published`; this records the source as published rather than creating a new statistical revision status.

## Geography mapping

`geography-map.csv` maps 64 source municipality labels one-to-one to `data/imports/municipalities.csv` and 11 source region labels one-to-one to `data/taxonomy/municipal-regions.json`. The final crosswalk permits only `exact` and `reviewed_alias` mappings; it uses no fuzzy matching.

The twelve reviewed aliases are five municipal `C.` city prefixes — Tbilisi (`04`), Batumi (`06`), Kutaisi (`20`), Poti (`32`), and Rustavi (`48`) — and seven regional labels: `Adjara A.R.` maps to `region.adjara` because Geostat uses the autonomous-republic suffix; `Kakheti `, `Mtskheta-Mtianeti `, `Racha-Lechkhumi and Kvemo Svaneti `, `Samegrelo-Zemo Svaneti `, `Samtskhe-Javakheti `, and `Kvemo Kartli ` map after the recorded trailing-source-whitespace review. All other mappings are exact.

National totals, source-only regional headings, footnotes, and other noncanonical rows receive no artificial GeoData ID. The excluded municipal codes `05`, `42`, `43`, `46`, and `64` are outside the canonical municipality crosswalk and normalized output.

## Transformations and units

Population rows select the mapped label from sheet `1`, preserve `(thousands)`, set `reference_date` to `YYYY-01-01`, and calculate `population_persons = population_thousand * 1000`. GDP rows select the mapped label from `regional GDP`, retain `mil. GEL` as million GEL, and apply no scale conversion.

Each normalized row's `transformation` field records the exact source sheet, source worksheet row, year column, and A1 cell. For example, Tbilisi population for 2015 records `W6`, and Tbilisi regional GDP for 2010 records `B3`. This provenance is derived from the preserved XLSX coordinates, not from a reordered CSV row. Blank, suppressed, unavailable, or non-numeric official cells would remain blank and be listed as official gaps; they are never converted to zero.

## Validation and reconciliation

`validation-report.json` reports `status: complete`, zero population gaps, zero regional GDP gaps, `estimates_created: 0`, `excluded_codes_present: []`, `source_hashes_match: true`, and `normalized_values_reconcile: true`. It verifies exact population years 2015-2025, 704 unique municipality-year keys, all 64 canonical municipality codes, and the exact persons conversion. It verifies regional GDP years 2010-2024, 165 unique region-year keys, and all 11 canonical region IDs for every year.

The generator re-reads every selected XLSX cell and compares it with the serialized normalized CSV value. It also checks SHA-256 and byte size against `source-manifest.csv`, UTF-8 BOM and Georgian-text CSV encoding, required headers, and XLSX/CSV sheet-row parity.

For regional GDP, the reported difference is `published national total minus sum of the 11 published regional components`, in million GEL. Values are never changed to force a match. The only non-zero differences are normal published component rounding:

| Year | Difference, million GEL |
| --- | ---: |
| 2012 | +0.1 |
| 2013 | -0.2 |
| 2016 | -0.1 |
| 2017 | -0.1 |
| 2018 | +0.2 |
| 2019 | +0.1 |
| 2021 | -0.2 |
| 2022 | -0.2 |
| 2023 | +0.2 |

All other observed GDP years reconcile to 0.0 million GEL at the published precision.

### Reproduce the package and checks

From the repository root, run:

```powershell
Set-Location apps/web
npm run data:prepare-municipal-indicators
npm test -- tests/data/municipalIndicators/geostatPackage.test.ts
npm run check
npm run build
```

The preparation command regenerates only the two normalized CSVs and `validation-report.json` from the two preserved official workbooks; it first verifies the manifest hashes and byte sizes. Do not overwrite an official capture with a different file.

The XLSX review workbook is authored separately after normalization by the git-ignored SDD support builder `.superpowers/sdd/2026-08-03-municipal-population-regional-gdp-collection/build-review-workbook.mjs`, using the bundled workspace `@oai/artifact-tool` runtime. It reads the generated CSVs and geography map and writes the four review sheets; it is not a committed project dependency or a package-generation command. After authoring, inspect the used workbook ranges, scan for formula errors, render all four sheets, and visually check for clipped headers, unreadable values, excessive widths, blank sheets, or broken data before accepting the workbook. Do not commit the builder, its runtime junction, or render previews. Recheck the generated counts, years, hashes, gaps, and reconciliation against `source-manifest.csv` and `validation-report.json` before publishing any future update.

## Gaps and source limitations

There are no official missing, blank, suppressed, or non-numeric cells in either normalized period: 0 population gaps for 2015-2025 and 0 regional GDP gaps for 2010-2024. GDP years 2005-2009 and 2025 are outside the preserved workbook's observed coverage, not filled gaps. The regional GDP national-total differences above are published rounding differences only, not missing values.

This package preserves the population census-recalculation note and the GDP workbook's 2025-12-23 last-update date and metadata link. A future source revision or changed media URL must be treated as a new capture: record its actual retrieval URL, date, size, hash, source coverage, and any changed footnotes before regenerating normalized outputs.

## No-estimation and no-UI statement

This package is final as published for research review. It creates no estimates and adds no UI, route, loader, database record, Prisma model, or `data/imports` content. It is deliberately absent from the current application and database import scope.
