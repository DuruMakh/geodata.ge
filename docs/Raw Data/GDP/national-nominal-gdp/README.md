# National nominal GDP source package

This package preserves the two reviewed Geostat workbooks used to calculate national revenue and expenditure as a share of GDP.

- `official/GDP-at-current-prices.xlsx` contains the SNA 1993 series for 1996–2018.
- `official/03_GDP-at-Current-Prices.xlsx` contains the SNA 2008 series for 2010–2025.
- `source-manifest.csv` records the official URLs, retrieval date, byte counts, and SHA-256 hashes.

The canonical series uses SNA 1993 for 1996–2009 and the revised SNA 2008 series from 2010 onward. The overlapping years remain in staging for review. Values are read from Geostat's `(=) GDP at market prices` row, rounded to the published one-decimal million-GEL precision, and multiplied by 1,000,000. No interpolation or estimate is added.

Run `npm run data:prepare-national-gdp` from `apps/web` to regenerate the staging CSV, canonical CSV, and validation report. Run `npm run data:check-national-gdp` to verify that regeneration is deterministic without writing files.
