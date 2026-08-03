# Municipal Population and Regional GDP Collection Design

**Date:** 2026-08-03
**Status:** Approved for specification; collection awaits written-spec review
**Scope:** Research package only; no serving-layer, database, route, or UI work

## 1. Goal

Create an auditable official-data package containing:

1. annual population for GeoData.ge's 64 public municipalities for every year from 2015 through 2025; and
2. total regional gross domestic product at current prices for the maximum official annual coverage available within 2005 through 2025.

The package preserves Geostat's original workbooks and source links, maps official geography labels to GeoData.ge identifiers, records definitions and gaps, and proves coverage through machine-readable validation. Missing values are never estimated.

## 2. Scope

### Included

- The 64 municipalities already present in `data/imports/municipalities.csv`.
- Exact municipality exclusions: `05`, `42`, `43`, `46`, and `64`.
- Population as of 1 January for 2015-2025.
- Total regional GDP at current prices, in the official source unit, for all source years whose year is between 2005 and 2025 inclusive.
- The 11 data-bearing region IDs already present in `data/taxonomy/municipal-regions.json`.
- Original official source files, stable source-page links, direct file links, retrieval dates, hashes, sizes, definitions, geographic mappings, normalized research outputs, and validation evidence.

### Excluded

- Municipality-level GDP or GVA.
- Regional GDP by economic activity.
- Municipality-level business turnover, employment, wages, value added, registered entities, active enterprises, or other GDP proxies.
- Estimates, interpolation, extrapolation, backcasting, imputation, or redistribution of missing values.
- Per-capita calculations.
- `data/imports` changes, Prisma models or imports, application loaders, routes, components, charts, tables, CSV export, or other UI work.

## 3. Official Sources

Geostat, the National Statistics Office of Georgia, is the sole statistical source for this package.

### Municipal population

- Source page: `https://www.geostat.ge/en/modules/categories/41/population`
- Dataset title: `Population by regions and self-governed units, as of 1 January`
- Direct workbook observed during discovery: `https://geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx`

The workbook downloaded during collection is authoritative. The page title, workbook sheet labels, units, footnotes, and revision notes are transcribed into the package README. If the direct media URL changes, collection may follow the current download link from the source page, but the final manifest must record the exact retrieved URL.

### Regional GDP

- Source page: `https://www.geostat.ge/en/modules/categories/23/gross-domestic-product-gdp`
- Dataset title: `Distribution of Gross Domestic Product of Georgia by regions at current prices`
- Direct workbook observed during discovery: `https://geostat.ge/media/79752/regional-GDP-ENG.xlsx`

Only total GDP at current prices is normalized. The separate workbook `Georgia's Regions Gross Domestic Product by types of economic activities` is outside scope and must not be downloaded or transformed for this task.

## 4. Package Layout

Create the package under:

`docs/Raw Data/Municipalities/geostat-population-regional-gdp/`

Files:

```text
geostat-population-regional-gdp/
  README.md
  source-manifest.csv
  geography-map.csv
  municipal-population-annual-2015-2025.csv
  regional-gdp-annual-2005-2025-available-years.csv
  municipal-population-and-regional-gdp.xlsx
  validation-report.json
  official/
    01-population-by-self-governed-unit.xlsx
    regional-GDP-ENG.xlsx
```

The `official/` files are immutable source captures. Normalized files may be regenerated only from those captures. Collection must not overwrite any pre-existing raw file unless its hash is identical.

The CSV and XLSX outputs in this research package are intended for human review in Microsoft Excel. CSV files containing Georgian text must be UTF-8 with BOM. This does not change the encoding policy of application-internal files under `data/imports/`.

## 5. Source Manifest

`source-manifest.csv` contains one row per preserved official file with these columns:

```text
source_id
dataset_title
publisher
role
source_page_url
retrieved_file_url
retrieved_at
local_file
sha256
bytes
source_year_min
source_year_max
normalized_year_min
normalized_year_max
notes
```

Rules:

- `publisher` is `National Statistics Office of Georgia (Geostat)`.
- `retrieved_at` is an ISO date in Asia/Tbilisi.
- Hashes are SHA-256 uppercase hexadecimal.
- `source_year_min` and `source_year_max` describe the complete workbook, even when it extends beyond the task window.
- `normalized_year_min` and `normalized_year_max` describe only rows included in the normalized outputs.
- Redirected or updated media URLs are recorded exactly as retrieved.

## 6. Geography Mapping

`geography-map.csv` is the explicit crosswalk between source labels and GeoData.ge identifiers:

```text
geography_level
source_label
source_label_normalized
geodata_id
display_name_ka
region_id
mapping_status
mapping_note
```

Rules:

- Municipality rows map one-to-one to the 64 rows in `data/imports/municipalities.csv`.
- Region rows map one-to-one to the 11 IDs in `data/taxonomy/municipal-regions.json`.
- `mapping_status` is `exact` or `reviewed_alias`; fuzzy or score-based matching is not permitted as final evidence.
- The five excluded codes must not appear as normalized municipality rows.
- National totals, subtotals, autonomous-republic headings, footnotes, and other non-municipality or non-region rows are not assigned artificial GeoData IDs.
- Every reviewed alias requires a plain-language `mapping_note`.

`population-component-map.csv` records source rows that must be added to a
canonical municipality for a bounded period when Geostat published a city and
its surrounding municipality separately:

```text
geodata_id
component_source_label
start_year
end_year
operation
mapping_note
```

The seven starred city rows (`C. Ozurgeti*`, `C. Telavi*`, `C. Mtskheta*`,
`C. Ambrolauri*`, `C. Zugdidi*`, `C. Akhaltsikhe*`, and `C. Gori*`) are additive
components for the corresponding present-day canonical municipality in
2015-2017. This is an explicit temporal composite mapping, not fuzzy matching.
The base `geography-map.csv` remains the one-to-one 64-municipality and
11-region identity crosswalk.

## 7. Normalized Population Dataset

`municipal-population-annual-2015-2025.csv` has this schema:

```text
year
municipality_code
municipality_name_ka
region_id
population_thousand
population_persons
reference_date
source_id
source_sheet
source_unit
transformation
last_reviewed_at
```

Rules:

- `year` is every integer from 2015 through 2025.
- `reference_date` is `YYYY-01-01`.
- `population_thousand` preserves the value and decimal precision published by Geostat.
- `population_persons` is the exact mechanical unit conversion `population_thousand * 1000`; it is not an estimate and must not add precision beyond the published value.
- `source_unit` records the workbook's exact stated unit.
- `transformation` states the sheet/row/column selection and the unit conversion.
- When `population-component-map.csv` applies, `population_thousand` is the sum
  of the base municipality cell and every mapped component cell for that year;
  `transformation` records every contributing A1 cell and the addition.
- Blank, suppressed, unavailable, or non-numeric source cells remain blank in normalized output and are listed as gaps. They are never replaced with zero.
- If the official source has complete coverage, the file contains exactly 704 rows: 64 municipalities times 11 years.

### Population definition

The README must quote or faithfully paraphrase Geostat's population definition and preserve all relevant source footnotes. It must distinguish population as of 1 January from mid-year population and from the unreviewed `Population` column previously found in the MoF municipal portal archive. The MoF population column is not used for values or gap-filling.

## 8. Normalized Regional GDP Dataset

`regional-gdp-annual-2005-2025-available-years.csv` has this schema:

```text
year
region_id
region_name_ka
source_region_label
gdp_current_prices_million_gel
source_id
source_sheet
source_unit
status
transformation
last_reviewed_at
```

Rules:

- Include every official annual year in the preserved workbook that falls between 2005 and 2025 inclusive.
- Do not assume that coverage begins in 2005 or ends in 2025. The validation report records the observed maximum available period.
- Include only total regional GDP at current prices for the 11 mapped GeoData regions.
- Preserve the official source unit. If the workbook reports a different scale, normalize to million GEL only through an exact documented multiplication or division.
- `status` preserves any official preliminary, revised, or other source status that applies to the value or year. If none is stated, use `final_as_published`.
- National totals and source-only residual categories are retained for reconciliation evidence in the validation report but are not emitted as region rows.
- Blank, suppressed, unavailable, or non-numeric source cells remain blank and are listed as gaps. They are never replaced with zero.

### GDP definition

The README must record that this is regional GDP at current prices, not constant-price GDP, real growth, GDP per capita, municipal GDP, or business-sector value added. It must preserve the workbook's revision/status notes and any geographic-allocation notes relevant to interpreting regional totals.

## 9. Excel Review Workbook

`municipal-population-and-regional-gdp.xlsx` contains four sheets:

1. `Read me`
2. `Population`
3. `Regional GDP`
4. `Geography map`

The workbook contains the same normalized rows as the two CSVs and the same geography rows as `geography-map.csv`. The `Read me` sheet records scope, definitions, units, exact coverage, exclusions, source URLs, retrieval date, gap count, and validation status.

## 10. Validation

`validation-report.json` records every check, observed count, and failure. Collection fails closed on an unmapped geography, duplicate key, unexpected excluded code, or source-to-output mismatch.

Required population checks:

- Exact year sequence `[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]`.
- Exact municipality-code set equality with `data/imports/municipalities.csv`.
- Codes `05`, `42`, `43`, `46`, and `64` absent.
- Unique `(year, municipality_code)` keys.
- Expected 704 rows if the source contains a row for every municipality-year; otherwise expected panel size and missing cells are reported separately without synthesis.
- Every municipality maps to its existing `region_id`.
- Values numeric and nonnegative when present.
- `population_persons` equals the exact documented unit conversion.
- Every normalized source value reconciles to its workbook cell or, for an
  explicit temporal composite, to the exact sum of all recorded workbook cells.
- The sum of the 64 canonical municipality values is compared with Geostat's
  published Georgia total for every year. Differences are reported exactly and
  values are never adjusted to force equality.

Required regional GDP checks:

- Observed year sequence is sorted, unique, contiguous if the source itself is contiguous, and bounded to 2005-2025.
- Exact region-ID set equality with the 11 data-bearing GeoData regions for every complete source year.
- Unique `(year, region_id)` keys.
- Values numeric and nonnegative when present.
- Every normalized value reconciles to its workbook cell after any documented unit conversion.
- When the workbook supplies a national total or reconciliation total, the sum of published regional components is compared with it. Any difference is reported exactly; regional values are never adjusted to force equality.
- If any regional component is blank or unavailable, national reconciliation is
  marked incomplete and its regional sum/difference are `null`; missing
  components are never treated as zero.

Required package checks:

- The complete source-manifest schema is validated: exact source IDs, titles,
  publisher, roles, page and file URLs, ISO retrieval dates, local files,
  hashes, byte sizes, source year bounds, normalized year bounds, and notes.
- Original-file hashes and byte sizes match the source manifest.
- CSV headers match the approved schemas.
- Human-facing CSVs begin with a UTF-8 BOM and Georgian text round-trips unchanged.
- XLSX sheet names and row counts match the normalized CSVs.
- Source URLs are present and syntactically valid.
- Gap inventory distinguishes missing, blank, suppressed, non-applicable, and out-of-window cells where the source makes that distinction.

## 11. Documentation and Gaps

`README.md` is the human-readable methodology and handoff. It contains:

- the task scope and explicit exclusions;
- the exact observed coverage of each preserved workbook and normalized output;
- source titles, page URLs, direct file URLs, retrieval date, hashes, and publisher;
- official units, reference dates, definitions, status/revision notes, and transformations;
- the geography-mapping method and every reviewed alias;
- validation results and reconciliation differences;
- a complete gap table with dataset, geography, year, source cell state, and consequence;
- a statement that no missing value was estimated and no UI or serving-layer change was made.

If the source lacks any requested 2015-2025 municipality population cell, the package is still delivered with the gap documented and validation marked `complete_with_official_gaps`; it must not be marked fully complete. Regional GDP is considered complete when all official values within the workbook's maximum available 2005-2025 subperiod are preserved, even if the workbook does not cover the whole 2005-2025 interval.

## 12. Repository Boundaries

This task changes only:

- this design and its implementation plan;
- the new research package under `docs/Raw Data/Municipalities/geostat-population-regional-gdp/`;
- a new matching methodology document under `docs/data-methodology/`; and
- focused collection/validation code and tests needed to generate and verify the research package.

It does not change `Project_Definition.md`, `DESIGN.md`, `AGENTS.md`, `data/imports`, database state, or application behavior because the work is research-only and does not alter served coverage.

## 13. Definition of Done

- Both official Geostat workbooks are preserved locally with exact URLs, hashes, sizes, and retrieval dates.
- Population output covers all source-backed 2015-2025 values for exactly the 64 public municipalities, with no excluded codes and no estimates.
- Regional GDP output covers total GDP at current prices for the maximum official period available within 2005-2025, for all mapped data-bearing regions, with no estimates.
- Geography mappings, definitions, units, revisions, transformations, and gaps are documented.
- CSV and XLSX review artifacts agree row-for-row.
- Machine validation passes or reports only explicit official-source gaps without hiding them.
- Relevant focused tests, `npm run check`, and `npm run build` pass.
- No application UI, route, serving dataset, database schema, or database content changes.
