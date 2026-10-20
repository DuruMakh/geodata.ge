# GDP by expenditure

Status: served at `/explorer/economy/expenditure` (Economy hub). Design: `docs/superpowers/specs/2026-10-20-gdp-expenditure-design.md`.

## Scope and sources

Geostat's National Accounts tables 08 (GDP by categories of use, current prices, million GEL), 09 (real growth by categories of use, previous year = 100) and 10 (the same categories at constant 2019 prices), release of 28 September 2026. The originals, their URLs, SHA-256 hashes, byte sizes and the reviewed row mapping are in `docs/Raw Data/Economy/gdp-expenditure/source-manifest.json`; labels and headings in `data/taxonomy/gdp-expenditure.json`.

Coverage: amounts and shares 2010–2025, real growth 2011–2025, annual columns only. 2025 is preliminary (Geostat's `2025*`; revision announced for 13 November 2026). Quarterly columns and 2026 are not read.

Series (`economy.gdp_total` plus `gdp_use.*`): total consumption, households, non-profits serving households (NPISH), government with its individual and collective services, total investment (gross capital formation), buildings and equipment (gross fixed capital formation), change in inventories, total exports with goods and services, total imports with goods and services.

- Households and NPISH are separate at current prices, but Geostat publishes their real growth only together. `gdp_use.households_npish` carries that growth; it has no amount, and the two parts have no growth. Nothing is summed by Fiscal.ge.
- Change in inventories has amounts (negative in 2017 and 2021) but no growth rate (Geostat: `x`, not applicable).
- Net acquisition of valuables (P.53) is `…` in every year and is not served.
- Imports are stored as positive amounts, as Geostat prints them. GDP = consumption + investment + exports − imports, so shares of GDP do not add up to 100.

## Calculations

- Amounts: the cell's XML text × 1,000,000 with 50-digit decimal arithmetic (full GEL), no rounding.
- Share of GDP: amount ÷ same-year GDP (row B.1*g of table 08) × 100, rounded once to 20 decimal places; preliminary if either input is. This is a Fiscal.ge calculation.
- Real growth: published index − 100.

## Checks (preparation fails otherwise)

- Every original's hash and size before any parsing; sheet name, SNA codes and row labels, annual headers, preliminary markers, first and last annual columns, and the release notes.
- Each year, within 0.01 GEL: consumption + investment + exports − imports = GDP; the table's closing GDP row = GDP; households + NPISH + government = consumption; individual + collective = government; fixed capital + inventories = investment; goods + services = exports and = imports; GDP = the Sectors page's `economy.gdp_total` (`data/imports/economic-sectors-annual.csv`). The largest difference in this release is 0.00002 GEL; GDP is digit-for-digit identical to Sectors.
- Each growth rate against the constant-price table's year-on-year change, within 0.0000000001 percentage points.
- The valuables row (tables 08, 09) and the inventories growth row (tables 09, 10) contain no numbers.
- Served rows: known ids, one row per series, measure and year, complete coverage per series and measure, share pairs recomputed exactly, preliminary years the newest suffix (`lib/data/gdpExpenditure/validation.ts`).

## Outputs and reproduction

- `data/imports/gdp-expenditure-annual.csv` (722 rows: 256 amounts, 256 shares, 210 growth rates), UTF-8 with BOM, the Sectors columns.
- `data/reports/gdp-expenditure-validation.json`: hashes, counts, per-year identity differences and all growth checks.

From `apps/web`: `npm run data:prepare-gdp-expenditure` writes both; `npm run data:check-gdp-expenditure` (part of `data:validate`) regenerates them in memory and fails on any byte difference.

Refresh: download the three tables again, update the manifest's hashes, sizes, columns, preliminary years, `releasedAt` and the two release notes, then run the prepare script and review the diff. When Geostat revises 2025, the GDP total must still equal the Sectors page's, so refresh both in one change.

## Serving

The mirror table `GdpExpenditureFact` holds the same 722 rows and is compared field by field inside the import transaction. The page is browse-only: no `/mcp` tool and no central JSON/CSV file.
