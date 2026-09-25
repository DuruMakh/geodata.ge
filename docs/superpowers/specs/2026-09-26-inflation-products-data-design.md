# Inflation products: reviewed data foundation

Date: 2026-09-26

Status: Draft for user review. This document covers the data stage of the product inflation explorer.

## 1. Outcome and scope

Prepare a reviewed, reproducible monthly dataset of price changes for individual goods and services in Georgia's current consumer basket. The public explorer will start at **2015-01** and include **every product in the latest published basket**, including products added after 2015. A product's history begins at its first verified observation within that range. Products that have left the latest basket stay in Geostat's archived workbooks and the validation inventory but do not appear in the delivered product catalogue or facts.

The existing third hub-card position becomes `პროდუქტები` / Products; the separate fifth Products placeholder is removed. Basket weights remain context in Categories, and there is no standalone `სამომხმარებლო კალათა` card. This data-stage spec does not define the page layout, implement the route, or change the existing inflation pages. The page and its exports need a subsequent design section before implementation.

Geostat publishes each product's index with **previous month = 100** and **same month of the previous year = 100**. Preserve those published indices in canonical data. The explorer can display `index − 100` as a percentage price change. These sources do not supply a price in GEL, a city-specific product figure, a product's individual basket weight, or an exact contribution to headline inflation. Do not derive or imply any of those measures. Geostat's workbook note says an unavailable product price may be imputed when calculating its index; a published index must not be described as a literal shop price observation.

User decisions on 2026-09-26: use the conservative product-identity rule below; start in 2015 rather than 2016 because the 2015 and 2016 lists are identical; include all latest-basket products and omit retired products from the delivered dataset; review the identity decisions and generated data along the way.

`Project_Definition.md` §2C currently excludes product-level indices. When this data stage is accepted, amend §2C to record this bounded approval. The existing public-page exclusion remains until the page design is approved.

## 2. Official sources and initial audit

Source pages: [English detailed indices](https://www.geostat.ge/en/modules/categories/293/consumer-price-detail-indices) and [Georgian detailed indices](https://www.geostat.ge/ka/modules/categories/293/samomkhmareblo-fasebis-detaluri-indeksebi). Each publishes a previous-month and a same-month-last-year XLSX. They have year sheets from 2011 through 2026; the current 2026 sheet ends in August. The data pipeline publishes from 2015, but may inspect 2014 source cells to verify 2015 annual comparisons.

The four current files were read directly on 2026-09-26. Their initial inventory is evidence for this design, not a count to hardcode into future refreshes:

| Edition and measure | Bytes | SHA-256 |
| --- | ---: | --- |
| [English, previous month](https://geostat.ge/media/82470/Consumer-Price-Detail-Indices-%28Previous-month%3D100%29.xlsx) | 583,143 | `26d9b429229cbad2ad6ee2bbefd5e86f52d4482d49abdcc14e270d4a956dcf20` |
| [Georgian, previous month](https://geostat.ge/media/82469/detaluri-indeqsebi-%28wina-tve%3D100%29.xlsx) | 580,426 | `7154963abfe05c0f8e5edd953ef0fb91274fde4911ce0a45eac7f3efc02bbd9c` |
| [English, same month last year](https://geostat.ge/media/82472/Consumer-Price-Detail-Indices-%28The-same-month-of-the-previous-year%3D100%29.xlsx) | 599,891 | `ec9cd520693db0479f7fd576f0d2f4cfa65c9c9ba607c46ec7679e13b900faf9` |
| [Georgian, same month last year](https://geostat.ge/media/82471/detaluri-indeqsebi-wliuri-%28wina-wlis-shesabamisi-tve%3D100%29.xlsx) | 599,155 | `c4f87ab0b44d94538d7a0783371c28d639359977d8d00d12dcf588fa4b9390df` |

The year sheets have an item number, a two-digit COICOP group code, a name, and one column per published month. In 2015 and 2016 the same 295 items appear with unchanged names. The latest basket has 305 items; 2011 had 266, and counts change at several year boundaries. Item numbers are **sheet-local positions, not product identities**: 219 items with unchanged names moved position between 2011 and 2012.

Across all four workbooks and all 16 sheets, the English and Georgian versions have matching item numbers, group codes, and numeric cells. The monthly workbook has 56,116 positive numeric cells. The annual workbook has 55,346 positive numeric cells and 770 explicit nonnumeric cells: 70 item-year cases with January–November unavailable and December present. The source uses both `...` and an ellipsis character. The annual and monthly workbooks list the same items in each year.

For 51,914 cells whose item can be matched by unchanged group and English name across the necessary months, compounding twelve monthly indices agrees with the published annual index within 0.000613 index points. Other cells were not compared because the preceding 2010 monthly file is absent or an item changed or lacks a verified identity. This arithmetic check supports validation; it does not authorize automatic identity matches.

## 3. Archive and source reader

Archive the four untouched files under `docs/Raw Data/Inflation/geostat-products/<latest YYYY-MM>/`, with a source manifest recording the source-page URL, exact download URL, retrieval date, byte count, SHA-256, language, measure and local path. Follow the existing latest-vintage retention rule: earlier source files remain recoverable from git history. Register their source IDs and public methodology downloads alongside the current CPI sources. No automated production fetching.

The reader must locate the year sheet, item header, month columns and item rows by validated content. It must reject a changed layout rather than guessing a column or accepting an extra row. Within each year, match the four editions using the item number **only after** checking that their item counts, order, group codes and published numeric values agree. Pair English and Georgian labels from that verified row. Never use the number to join one year to another.

Read and inventory **all** source rows, including products no longer in the latest basket. Validate every published month in a sheet, every value's type and positivity, unique item number and name/group combination within the year, and the supported missing markers. Unexpected text, a new missing-value pattern, a duplicate, or a shifted source layout stops preparation for review.

## 4. Product identity and current-basket cohort

Use a curated lowercase ASCII `product_id` that remains fixed when a reviewed label changes. The two-digit COICOP code identifies only the main group; it is not a product ID. The source item number is not stable between years.

Start with the latest year's full roster. Trace each current product backward no earlier than 2015. Exact agreement of group code **and both normalized English and Georgian names** across adjacent years is a continuity candidate. Normalization may remove only whitespace and case differences; it must not alter the meaning of a name. Any changed label, changed group, missing year, or apparent replacement enters a review ledger. The ledger records both source names, years, group codes, the proposed link or split, and the evidence and reason. Similar spelling, one unchanged language, neighboring row position, or similar index values are clues for review, never automatic proof.

Every current product receives a reviewed ID. Confirmed renames retain that ID. A genuine new or replacement product gets a new ID, and its earlier months remain unavailable. If continuity remains uncertain, split the series at that boundary and show only the verified later history; do not fabricate a join. If a product later leaves the latest basket, it is removed from the delivered catalogue and facts at the reviewed refresh while its source rows remain archived and inventoried. The workbooks cannot prove that Geostat never changes a product's specification while keeping the same name; keep this limitation explicit in the methodology.

The initial exact bilingual match connects 258 of the latest 305 products continuously back to 2015. The other 47 have a later exact-match start and require either a reviewed earlier link or a shorter public history. These numbers are review workload indicators, not assumptions to hardcode. The product mapping report must list every changed-name candidate and every latest-cohort start or split for human review before canonical data are written.

## 5. Canonical files and missing values

Create one reviewed product catalogue with each current `product_id`, current English and Georgian labels, latest COICOP group, first verified period and source decision reference. Create one canonical monthly fact file with `product_id`, measure (`mom_index_100` or `yoy_index_100`), `period`, published index value or blank, availability, source ID, precise workbook cell locator and review date. Keep published precision; display percentages are derived from the stored index.

Write an explicit unavailable row for each published `...` or ellipsis cell belonging to a current product. Its value is blank and its availability says Geostat did not publish an index for that cell. Do not convert it to zero, interpolate it, or assert a more specific reason without source evidence. A product absent from an entire year has no rows for that year; charts and tables show a gap and do not connect a line across it.

Keep the reviewed name/identity decisions in a separate compact mapping ledger. Do not add old retired products to the public catalogue merely to preserve their source history. Preserve source locators so a displayed value can be traced back to its original cell.

## 6. Validation and review stops

Preparation fails unless all of these hold:

1. Every archived file matches its manifest bytes and SHA-256; source IDs are registered; all expected year and month headers parse. Coverage is derived from the file, with 2015 as the public floor.
2. The four editions' product inventories align within every year. English and Georgian numeric values match exactly for each measure and month. A current item cannot silently disappear from one edition.
3. Within-year identifiers, group codes and product names are unique and valid. All published indices are finite and positive. Only reviewed missing markers are accepted, with every unavailable cell counted in the validation report.
4. Every latest-basket product has a reviewed ID and a documented earliest safe period. Every cross-year name/group transition affecting the current cohort has an explicit same-product or split decision; the import never uses fuzzy or row-number matching.
5. Where twelve monthly indices and a verified product identity exist, their compounded index agrees with the published annual index within a tight tolerance calibrated from the source's four-decimal rounding. The initial corpus maximum is 0.000613 index points; a proposed guard of 0.002 stops larger discrepancies for review. Uncomparable cells are reported, not treated as passing.
6. Every overlapping previously published canonical cell is compared on refresh. A changed historical index, missing marker, identity decision or latest-basket membership is a stop-and-review event with a readable diff. A reviewed genuine change must be documented; the pipeline never silently overwrites history.

The validation report records the latest period, roster by year, included and excluded counts, mapping decisions and splits, source hashes, missing-cell inventory, language parity, arithmetic-check coverage and maximum error, and any reviewed revision. Tests must corrupt one representative case for each stop condition and show that preparation fails.

Review checkpoints: first inspect the candidate identity ledger and unresolved transitions; then inspect the canonical-data diff and validation report. Only after the data stage passes do we design the product page and integrate the reviewed files into the serving mirror, downloads and public experience.

## 7. Acceptance for this data stage

The archived originals, current-product catalogue, identity ledger, canonical facts and validation report are reproducible from the reviewed sources. Every one of the latest products appears once in the catalogue. Published cells match the source exactly, explicit missing cells remain missing, dropped products do not enter the delivered dataset, and all validation stops above are exercised. The existing inflation datasets and their public figures stay unchanged. No product page or production deployment is part of this data-stage acceptance.
