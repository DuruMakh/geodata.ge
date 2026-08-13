# National nominal GDP denominator, 1996–2025

Status: reviewed annual denominator for the national revenue and expenditure multi-year explorers.

## Public use

`% მშპ-ში` is calculated independently for every series and year:

```text
share_of_gdp = national budget amount in GEL / same-year nominal GDP at current prices in GEL
```

The denominator never depends on which series are selected. The derived total is divided by GDP in the same way and is therefore not forced to 100%. When a same-year denominator is absent, the share is missing rather than estimated. This rule applies to the national revenue and expenditure multi-year explorers only. Municipality measures and single-year composition remain shares of their applicable budget total. No separate GDP explorer route is created.

## Official sources and coverage

Both originals are National Statistics Office of Georgia (Geostat) workbooks from the [Gross Domestic Product page](https://www.geostat.ge/index.php/en/modules/categories/23/gross-domestic-product-gdp):

| Canonical years | Accounting standard | Preserved workbook | Reviewed bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| 1996–2009 | SNA 1993 | `docs/Raw Data/GDP/national-nominal-gdp/official/GDP-at-current-prices.xlsx` | 94,214 | `1F9BEFDCA89F3A635F66ABB14892386A9947BF7294045E4442832AA53E63DC8E` |
| 2010–2025 | SNA 2008 | `docs/Raw Data/GDP/national-nominal-gdp/official/03_GDP-at-Current-Prices.xlsx` | 50,098 | `21A576C9C20434A87BCB32047CD143EEF2B8D3F3FF360442B420C76B0DA27D34` |

The SNA 1993 workbook publishes 1996–2018 and the SNA 2008 workbook publishes 2010–2025. All overlapping 2010–2018 observations remain in `data/staging/national-gdp-source-facts-1996-2025.csv` for review. The canonical series deliberately selects SNA 1993 through 2009 and the revised SNA 2008 series from 2010 onward, producing exactly one observation for every 1996–2025 year.

## Extraction and units

The deterministic preparation script reads the `(=) GDP at market prices` row from each reviewed workbook. The canonical `valuation` is therefore `market_prices`; “current prices” describes the nominal price basis rather than the valuation. The script rounds the source to the published one-decimal million-GEL precision, then multiplies by 1,000,000 to obtain GEL. It does not interpolate, forecast, or back-cast values.

The current workbook marks 2025 with an asterisk; the canonical row is therefore `preliminary`. Earlier selected rows are retained as `final_as_published`. The canonical CSV preserves the accounting standard, status, workbook sheet and cell, source unit, transformation, and review date beside every value.

## Reproduction and validation

From `apps/web`:

```bash
npm run data:prepare-national-gdp
npm run data:check-national-gdp
```

The preparation command regenerates:

- `data/staging/national-gdp-source-facts-1996-2025.csv` — both source series, including overlap;
- `data/imports/national-gdp-annual-1996-2025.csv` — the 30-row canonical series;
- `data/reports/national-gdp-annual-1996-2025-validation.json` — source hashes, byte counts, counts, coverage, and overlap.

The check command regenerates all three artifacts in memory and requires an exact byte-for-byte match with the committed files. It also validates unique source-year keys, complete source coverage, the 2010 accounting-standard handoff, the exact overlap, and the 2025 preliminary status.

`npm run data:validate` additionally requires one positive, unique, source-registered denominator for every served national budget year. `npm run data:import` mirrors the canonical rows transactionally into `NationalGdpFact`, reads them back through the database serving path, and compares every field against the reviewed CSV before commit.

National CSV downloads append `gdp_current_prices_gel`, `gdp_accounting_standard`, `gdp_status`, GDP source metadata, and `share_of_gdp`, allowing every displayed ratio to be reproduced. Georgian CSV output retains the UTF-8 BOM required for direct Excel opening.
