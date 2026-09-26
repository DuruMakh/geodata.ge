# Inflation: individual product indices

Owner of: `data/mappings/inflation-products/catalogue.csv`, `decisions.csv`, `data/imports/cpi-products.csv`, `data/imports/cpi-products-monthly.csv`, `data/reports/inflation-products-identity-review.csv`, `data/reports/inflation-products-validation.json`, `docs/Raw Data/Inflation/geostat-products/`, and `npm run data:prepare-inflation-products` / `data:check-inflation-products`. Approved data scope: `docs/superpowers/specs/2026-09-26-inflation-products-data-design.md`.

## Meaning and coverage

The reviewed files cover every item in the **latest Geostat consumer basket**, including products that entered after 2015. Public history begins in **January 2015**, or at a product's later first verified observation. The August 2026 source vintage has 305 current items and ends in August 2026. Earlier retired items remain in the untouched source workbooks but are absent from the reviewed catalogue and facts. The report counts historical source rows outside the current cohort; this is a row inventory, not a count of distinct retired products.

Geostat publishes each item's index against the **previous month = 100** and the **same month of the previous year = 100**. The canonical file stores the original index, including its source precision and workbook cell locator. A displayed percentage change is exactly `index − 100`. The workbooks do not give a GEL shop price, product-level basket weight, city-specific product index or exact contribution to headline inflation. A published index can involve an imputed price under Geostat's workbook note; it is not necessarily a literal shop observation.

## Source archive and identity

Four original XLSX files, English and Georgian for each comparison, are archived under `docs/Raw Data/Inflation/geostat-products/2026-08/`. Their manifest has direct Geostat URLs, download date, byte size and SHA-256. The files contain year sheets from 2011 through 2026. English indices supply the fact cells; Georgian editions must match the entire within-year item order and all published values. The parser checks headers, formulas, duplicate items, group codes, positive numeric values, missing markers and the last published month. Item numbers are valid **only within a year**.

Product IDs (`cpi.product.p0001` and onward) are fixed in the reviewed catalogue. Adjacent years join automatically only when the COICOP group and both English and Georgian names agree after case and whitespace normalization. Every changed-name/group boundary needs a row in `decisions.csv` naming the current and earlier source items and a reason. Similar spelling, identical row number, one unchanged language, or matching index values are review clues only. An unresolved boundary stops preparation; an uncertain or genuinely new product starts a shorter series.

For this vintage, 47 first boundaries were reviewed: **29 linked** and **18 split**. After following the links backward, no further unresolved boundary remained. **287** current products have verified history to 2015, and **18** start later. The review explicitly links the pre-2019 generic `Mineral water / მინერალური წყალი` history to current sparkling mineral water (p0088); still mineral water (p0089) is separate from 2019. Bakery khachapuri (p0010) is separate from the earlier café item. A linked Geostat series may have changed its product description; the files do not prove an unchanged retail specification or brand across years.

## Missing values and validation

The source's `...` and `…` cells become explicit facts with a blank `index_100` and `availability=not_published`, never zero or an estimate. The reviewed source pattern has no unavailable monthly indices; unavailable annual indices occupy January through November for an item-year and December is published. Any new missing-value pattern stops preparation for review. An item absent from a whole year has no fact rows for that year. The August 2026 reviewed cohort has **84,056 fact rows**, of which **176** are explicit unavailable cells. The source gives no more specific reason for those cells.

`prepare-inflation-products` verifies all four source hashes, the full year-by-year English/Georgian inventories and values, the latest cohort, all identity decisions, provenance and the source registry. It compounds twelve published monthly indices where the verified identity and all twelve cells exist, then compares with Geostat's annual index. The guard is **0.002 index points**. This vintage has **38,673** comparable annual cells, maximum error **0.000583342**, and **3,179** published annual cells that cannot be compared from the public 2015-floor fact file or lack a verified twelve-month path. Uncomparable cells are reported rather than counted as passes.

On refresh, every previously committed product fact is compared against the freshly parsed full workbook **before** the latest-cohort filter. A changed index, changed missing status, missing source cell, changed identity decision or changed latest roster stops with a readable difference. The committed catalogue IDs and source-cell provenance remain stable unless an explicit reviewed update is made. `--check` byte-compares the two canonical CSVs and the JSON validation report. The CSVs begin with a UTF-8 BOM for direct Excel opening.

## Refresh and delivery boundary

1. Archive all four new untouched Geostat editions in a new `<YYYY-MM>` vintage with their official URLs, byte sizes and hashes. Keep the earlier vintage recoverable in Git history.
2. Run `npx tsx scripts/audit-inflation-products.ts --check` from `apps/web`; review any current-roster or name boundary and update `decisions.csv` with source names and reasons before preparing facts.
3. Run `npm run data:prepare-inflation-products`, inspect the canonical diff and validation report, then run `npm run data:check-inflation-products` and the repository checks. Historical source revisions require an explicit review; do not silently overwrite them.

This data foundation does **not** serve the product explorer. Page design, the serving mirror, downloads of prepared facts, MCP access and production publication remain separate work.
