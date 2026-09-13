# National economic sectors

Status: canonical preparation is implemented. This checkpoint supplies reviewed observations and reproducible validation evidence; public serving and database integration are separate tasks.

## Scope and source evidence

The initial dataset covers the 20 NACE Rev. 2 activities A–T and a separate national market-price GDP reference. Regional sectors are excluded. Stable identities and bilingual labels are in `data/taxonomy/economic-sectors.json`.

The reviewed Geostat originals and exact mappings are documented in `docs/Raw Data/Economy/economic-sectors/source-manifest.json` and `source-review.md`. The nominal original already archived for GDP overview is reused unchanged. Published growth indices and constant-price values were captured separately on 2026-09-11. All numerical originals have a 2026-06-19 release date; 2025 is preliminary, with revision scheduled for 2026-11-16.

The approved coverage is nominal/share 2010–2025 and real growth 2011–2025. The canonical file contains 336 nominal observations (320 activity amounts and 16 GDP references), 336 GDP shares and 315 growth observations: 987 available observations. All 21 missing 2010 growth cells are listed explicitly in the report. No compatible 2009 volume input or published 2010 sector-growth column was found; no missing rate is estimated. The 2010 volume level supports the 2011 growth check only.

## Calculations

- Nominal sector amounts are gross value added at basic prices. Read numeric text directly from the hash-verified workbook XML, without an intermediate JavaScript number, then convert published million GEL to full GEL using decimal arithmetic. Apply the same exact-text extraction to growth indices and validation volumes.
- GDP share is sector GVA divided by same-year market-price GDP, multiplied by 100. It is independent of selection. Shares do not necessarily sum to 100 because GDP includes net product taxes. The reference series uses published market-price GDP, not summed GVA.
- The growth original is a previous-year=100 index. Subtract 100 to obtain annual real growth in percentage points. Retain `calculation = index_to_growth` and the original cell locator. Validate independently against consecutive chain-linked constant 2019 values, without summing chain-linked components.
- Canonical percentages use 7.5 for 7.5%. Future chart data retain that scale; table and Excel percentage cells convert once to 0.075.
- Calculated ratios use 50-digit decimal precision, rounded once to 20 decimal places. Published values must fit Decimal(40,20) without rounding at import. A missing result stays missing; zero and negative growth remain meaningful.

The national growth reference comes from the same Geostat release, independently of sector rates. The existing GDP overview's World Bank national-growth series and the Budget denominator CSV remain unchanged.

## Validation ownership

`validateSectorObservations` validates flat canonical fields, exact decimal capacity, annual years, stable identities, units, valuation, status, provenance, duplicate keys, nominal/share pairs and share-status propagation. It reports gaps separately. It does not embed original workbook inputs in stored or served observations.

Preparation checks all original SHA-256 hashes and byte sizes before parsing any workbook. It enforces the reviewed source units, classification, annual coverage, activity codes/full official names, control-row labels, release note and preliminary markers. Quarter columns and 2026 Q1 are excluded. Duplicate annual headers, missing numeric inputs, unexpected gaps and mismatched mappings fail preparation. Source notes remain in the report, and locators retain annual header text, including `2025*`; its meaning is captured as `preliminary` before serialization. Shares retain both numerator and denominator locators and propagate preliminary status. Published growth status must agree with its supporting volume inputs.

For every year, preparation records in full GEL: summed sector GVA, published basic-price total, product taxes, subsidies, market-price GDP, `sum(GVA) - basic total`, and `basic total + taxes - subsidies - GDP`. Both differences must be within the predeclared 0.01 GEL tolerance. The existing GDP overview stores the workbook reader's binary-number representation. `overviewGdpParity` checks exact equality to that legacy projection (source million GEL → JavaScript number → decimal GEL), not equality to the original XML decimal. `overviewRepresentationDifferenceGel` in the validation report records source-exact GDP minus that existing overview observation. Sector reference amounts and share denominators retain the source-exact value. Neither the GDP overview nor any Budget denominator file is written or replaced. Chain-linked volume components are never summed for reconciliation.

Both source-evidence and preparation regression tests check every nominal year and all 315 published growth indices against source controls. Fixed source tolerances are 0.00000001 million GEL for nominal reconciliation and 0.0000000001 percentage points for growth comparison. Preparation rejects changed tolerances. The report retains the published index, converted growth, both volume values and locators, independently calculated growth and signed difference for every check. Future CSV/database parity must remain exact, without these tolerances.

## Outputs and reproduction

- `data/imports/economic-sectors-annual.csv`: flat canonical observation fields, ordered by stable series ID, measure (nominal, share, growth), then ascending year.
- `data/staging/economic-sectors-reconciliation.csv`: sixteen annual reconciliation rows, with differences, tolerance and exact overview GDP parity.
- `data/reports/economic-sectors-validation.json`: source hashes/vintages and notes, counts by measure/status, per-series annual coverage, explicit missing cells, annual reconciliations and all growth checks.

Both CSVs use UTF-8 with BOM and normal CSV quoting/escaping. Canonical fields are `series_id,year,measure,value,unit,valuation,price_basis,calculation,status,source_id,source_locator,last_reviewed_at`. Original supporting inputs belong in the validation report, not nested canonical fields. The original XML decimal representation is multiplied by one million using a dedicated 50-digit context; only derived percentages are rounded to 20 decimal places. The small household sector remains nonzero (2025: 86,354,085.573384111 GEL). All 63 observations for 2025 are preliminary.

Run from `apps/web`:

```text
npx vitest run tests/data/economicSectors/prepareEconomicSectors.test.ts
npm run data:prepare-economic-sectors
npm run data:check-economic-sectors
```

`--write` regenerates the three outputs from local originals. `--check` regenerates them in memory and compares exact bytes, failing on any difference without writing. The check is appended to the existing data validation chain. Neither mode fetches upstream sources or uses the current clock; review dates come from the reviewed manifest. Geostat must be credited and archived originals must remain unchanged.

## Serving and public outputs

The page's four highlights use all national activities in the selected final year, excluding the GDP reference from rankings and ignoring checked chart series. Largest-sector and top-three rankings use nominal GVA; the top-three statistic sums those activities' existing GDP shares without renormalizing. Growth extremes use the published real annual growth observations, never nominal or whole-range changes. Missing 2010 growth remains unavailable; preliminary years are labelled. These display summaries do not add canonical observations or query measures.

Decorative highlight sparklines retain the final year's winner(s) over the available history through that year. The top-three line sums the same three sectors' GDP shares in each historical year; it does not switch membership retrospectively. Missing annual cells break the line. The hero gauge shows the largest sector's same-year GDP share.

The transactional importer mirrors all 987 observations into `EconomicSectorFact` and checks exact decimal parity before committing. A rejected parity check rolls back the complete import. The page can build from the mirror or canonical CSV fallback; both generate static Georgian and English pages. There is no browser-time database query.

The active selection, measure and range feed the shared three-sheet Excel writer. Nominal analysis values retain full GEL; GDP-share analysis also retains the nominal amount, while growth never gets an invented amount column. Percentages become spreadsheet fractions; preliminary status and validated original-source links remain visible.

The bundled fact-query snapshot includes a dedicated `query_economic_sectors` tool, leaving the GDP overview query unchanged. Central CSV contains 987 exact-decimal observations; JSON includes 1,008 cells with the 21 unavailable 2010 growth cells explicitly missing. Prebuild prepares the CSV before generating the central manifest; postbuild verifies publication bytes and hashes. Regional sectors are excluded.
