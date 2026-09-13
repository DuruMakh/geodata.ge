# Regional economies

Status: canonical preparation is implemented. This dataset supplies reviewed regional GDP and sector observations for the Regional economies explorer. Public serving, database mirroring and page integration are separate implementation checkpoints.

## Scope

The dataset covers Georgia's 11 Geostat regional units for every year from 2010 through 2024. Each region has one total regional GDP series and 20 NACE Rev. 2 activity series (A–T). The two public measures are nominal GEL and share of the selected region's GDP. It contains no 2025 estimate, municipality GDP, population, per-capita result, regional real growth, national-share measure or multi-region chart data.

Stable region identities come only from `data/taxonomy/municipal-regions.json`. The reviewed crosswalk maps Geostat's full and shortened source labels, including `Adjara A.R.`, `Racha`, `Samegrelo` and `Samtskhe`, to those IDs without fuzzy matching. Activity identities and bilingual labels come only from `data/taxonomy/economic-sectors.json`.

## Sources and preservation

Geostat is the authoritative publisher. Preparation reads three local, hash-verified originals and never fetches them at build time:

| Role | Reviewed original | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| Regional GDP totals | `regional-GDP-ENG.xlsx` | `dd2042dff5e2c44b98b4bb140163b5736cf5a71f4683b9e6a359373907d59c35` | 13,871 |
| Regional GDP by activity | `regional-GDP-by-activities-ENG.xlsx` | `88e337bd82a5232ea5260f011b11cb2d82c2cec5115fddbe92d14d1ff3945337` | 99,089 |
| National validation | `03_GDP-at-Current-Prices.xlsx` | `21a576c9c20434a87bcb32047cd143eef2b8d3f3ff360442b420c76b0da27d34` | 50,098 |

The regional-total file is reused from the existing municipal research archive. The national workbook is reused from GDP overview. The activity workbook is preserved under `docs/Raw Data/Economy/regional-economies/sources/`. `source-manifest.json` records the original URLs, file roles, workbook sheets, capture date and source metadata URL. All regional workbooks state `Last update: 23.12.2025`; their annual columns end at 2024.

## Accounting and calculations

Activity values are gross value added (GVA) at basic prices in million GEL. Total regional GDP is at market prices in million GEL. For each region and year, preparation verifies:

```text
sum of 20 activity GVA values = GDP at basic prices
GDP at basic prices + taxes on products - subsidies on products = GDP at market prices
activity share = activity GVA / the same region and year's market-price GDP * 100
```

Taxes and subsidies are reconciliation controls, not selectable sectors. Therefore, the 20 activity shares are not expected to sum to 100%. Total regional GDP is emitted as 100% in the share measure. The denominator always comes from the complete regional total and never changes with the user's selected activity rows.

Numeric text is read directly from each hash-verified worksheet XML before conversion to decimal arithmetic. Published million-GEL values are multiplied by exactly 1,000,000. Derived percentages use a 50-significant-digit decimal context and are rounded once to 20 decimal places. Published source values are not rounded. Zero remains an observed value; missing, nonfinite or nonpositive GDP denominators fail preparation.

The accounting tolerance is fixed at 0.01 GEL after full-GEL scaling. All 165 region/year accounts reconcile within that tolerance. Each year's 11 regional totals also reconciles both to the total in the regional publication and to the separately archived national GDP workbook.

The national and regional activity publications have seven reviewed allocation differences above 0.01 million GEL: sectors A, C and R in 2020; C and F in 2021; and K and O in 2022. Their signed source-exact values are retained in `data/reports/regional-economies-validation.json`. Preparation fails if this exact set changes. Regional amounts and shares always use the regional publication; the application never mixes a regional numerator with a national-sector denominator.

## Outputs and validation

- `data/imports/regional-economies-annual.csv` is the canonical public fact file: 6,930 rows = 11 regions × 15 years × 21 series × 2 measures. It contains 3,465 nominal and 3,465 share observations.
- `data/staging/regional-economies-reconciliation.csv` contains 495 tax, subsidy and net-product-tax control rows. These rows are evidence and are never served as selectable economic activities.
- `data/reports/regional-economies-validation.json` records source hashes, coverage, counts, duplicate/missing checks, accounting results and the seven cross-publication differences.

Both CSV files use UTF-8 with BOM and deterministic ordering. Canonical keys are `(region_id, series_id, measure, year)`. The flat observation fields retain units, valuation, current-price basis, calculation, status, source ID, source locator and review date. The database mirror must preserve the exact decimal text and pass full read-back parity before a transaction can commit.

Run from `apps/web`:

```text
npx vitest run tests/data/regionalEconomies
npm run data:prepare-regional-economies
npm run data:check-regional-economies
```

`--write` rebuilds the three artifacts from local originals. `--check` regenerates them in memory and compares exact bytes without writing. The check is part of `npm run data:validate`. Ordinary builds and runtime pages use reviewed canonical data or its verified database mirror; they do not read source workbooks or contact Geostat.
