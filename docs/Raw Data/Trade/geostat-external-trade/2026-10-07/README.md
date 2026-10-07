# Prepared annual trade research package

The source capture and reproducible research files are prepared. **Overall source acceptance is held** for two publisher discrepancies in UK service imports (2022 and 2024). Both published representations remain unchanged and the relevant comparisons remain failed. No product integration has been authorized.

The core capture preserves 45 original files, including 31 Geostat Excel workbooks. Preparation covers **364,495 source observations**, **364,461 primary observations** and **3,473 reviewed derivations**. The reconciliation report contains **59,166 passed checks**, **3,220 unavailable comparisons**, **82 source-code allocation exceptions** and **2 unresolved failures**. Source fidelity and the publisher's internal agreement are separate checks.

See [the methodology](../../../../data-methodology/trade-annual.md), `source-review.md`, `source-limitations.csv` and `unresolved-source-issues.json`. The two UK differences are approximately USD 192,237 (2022) and USD 379,884 (2024). Historical source-code allocation exceptions retain their measured differences and never receive a passing prefix label.

[Verification and final review](verification-review.md) records the independent reader, 39 focused tests, two fresh-checkout fixes and the repository results. The full website suite passes 3,026 tests with a recorded local timing exception; the build, data validation and localization checks pass. The standard combined check's earlier timeouts remain explicitly recorded.

## Reproduction

From the repository root, using the bundled Python (or a compatible Python with openpyxl for the independent reader):

```powershell
$tradePython = 'C:/Users/Mylaptop/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$tradePackage = 'docs/Raw Data/Trade/geostat-external-trade/2026-10-07'
& $tradePython -X utf8 "$tradePackage/prepare.py" --write
& $tradePython -X utf8 "$tradePackage/prepare.py" --check
& $tradePython -X utf8 "$tradePackage/verify_independent.py"
& $tradePython -X utf8 "$tradePackage/prepare.py" --check
& $tradePython -X utf8 "$tradePackage/prepare.py" --acceptance
& $tradePython -X utf8 "$tradePackage/test_prepare.py"
```

Write/check commands reproduce source-faithful files and return 0 on byte parity. The acceptance command returns **2** while the two source discrepancies remain; a passing reproduction or independent cell match does not clear that hold. The independent report is regenerated only by its separate reader. All commands are offline and leave original workbooks untouched.

Family CSVs contain source-preserving series with their roles; `source-observations/` additionally retains supporting/unidentified cells. Product/source chunks follow the published blocks, with complete-year splits only if a chunk exceeds 50,000,000 bytes. Every generated CSV uses UTF-8 BOM and LF records. Excel may auto-convert codes or round long decimals; import code/value text columns explicitly when full fidelity matters.

## Earlier intake evidence

The material below records the exploratory capture before final preparation. Its counts and audits remain evidence of that earlier stage.

# External trade source collection and initial validation

## Expanded source intake

The collection was expanded on 7 October 2026 after the user agreed to include six-digit goods, services and regional goods trade. The active inventory is `full-source-manifest.json` / `full-source-manifest.csv`: **45 source files, 31 Geostat Excel workbooks and 79 worksheets**, with Geostat and NBG reference material.

The expanded intake checks report **301 passes, zero arithmetic/integrity failures and eight unavailable detail comparisons**. The unavailable comparisons are the four annual export and import product breakdowns for the Unknown region: only its totals are published. This is an explicit source limitation, not a zero-valued product breakdown.

`full-workbook-inventory.json`, `source-intake-summary.json` and `source-intake-reconciliation.csv` record this intake review. The package still awaits preparation and independent source-cell verification. The written data specification is `docs/superpowers/specs/2026-10-07-trade-data-design.md` and awaits review before the implementation plan.

## Earlier exploratory capture

Captured on 7 October 2026 from the National Statistics Office of Georgia (Geostat). This is a research archive and an initial source audit. It establishes the available data and a proposed collection scope before a normalized dataset or page design is approved.

The capture contains **19 untouched Excel workbooks, six source/methodology pages and two methodology documents**, with **55 worksheets**. The national overview is marked last updated on **21 September 2026**; the other originals retain their own source dates. Complete annual history ends in **2025**. The national, country and product 2026 columns cover **January-August** and are preliminary; the supporting regional files use quarters.

## Available data and recommended use

| Data | Captured complete annual coverage | Recommendation |
| --- | --- | --- |
| National exports and imports | 1995-2025 | Primary. Keep the published values. Trade balance and turnover can be derived from these same inputs with the official formulas. |
| Exports and imports by partner country | 1995-2025 | Primary. Preserve every published country code, its own missingness and historical identity, including unspecified destinations. Avoid collecting only the current top ten countries. |
| Domestic exports by partner country | 2014-2025 | Primary. Supports a domestic/re-export distinction over the shared period, subject to matching source identities and coverage. |
| Detailed export/import products, HS four-digit codes | 1995-2025 in separate source blocks | Primary research detail. Retain the separate blocks and official labels; review code equivalence before joining a historical product series. |
| Domestic exports by product | 2014-2025 | Primary, with a published limitation: 96 selected product rows in 2014 and 99 in the later blocks, plus an explicit Other commodities remainder. This is not a complete domestic-export product catalogue. |
| Broad product sections, SITC | 2000-2025; ten coded sections | Useful supporting classification. All sections sum to the published total. Keep these separate from HS products rather than counting both as additive detail. |
| Broad economic categories, BEC | 2000-2025; seven coded categories | Optional supporting data. Keep the originals while deciding whether an additional grouping is useful. |
| Country groups | 1995-2025 | Optional. The totals match, but group membership and overlapping group definitions need a separate review. |
| Regional trade and SITC subgroups | Annual columns for 2022-2025 and quarterly columns including 2026 | Supporting originals captured. Defer preparation until the geographic attribution and annual/quarterly handling are reviewed. |
| Monthly values | Embedded in the national, country and product workbooks | Retain the untouched originals. Prepare annual history first; individual monthly series are a separate scope decision. |

The available source-link inventory also records detailed HS six-digit products, more detailed SITC/BEC classifications, transport modes, trader size and trader economic activity. Those workbooks were not downloaded in this capture. The source site separately publishes trade unit-value indices. These are optional extensions, not necessary inputs for the proposed initial annual package.

## Source hierarchy

1. **Geostat Excel tables** are the primary numerical source: [overview](https://www.geostat.ge/en/modules/categories/765/external-merchandise-trade), [exports](https://www.geostat.ge/en/modules/categories/637/export), [imports](https://www.geostat.ge/en/modules/categories/638/import), and [domestic exports](https://www.geostat.ge/en/modules/categories/639/domestic-exports).
2. **Geostat methodology and metadata** define the scope, classifications, valuation and revisions: [brief methodology](https://www.geostat.ge/media/80069/external_trade_methodology.html), [February 2026 metadata](https://www.geostat.ge/media/76934/1001_190226_EN.PDF). These are captured here.
3. **Geostat's external-trade portal** is a possible supplementary source for additional country/product combinations and quantities. Its interactive extraction was not inspected in this audit: [portal](https://ex-trade.geostat.ge/en).
4. **UN Comtrade** is a supplementary source for international comparisons and cross-checks. Its releases should not silently replace the selected Geostat capture: [data documentation](https://uncomtrade.org/docs/content-of-data/). No Comtrade data were collected.
5. **The National Bank of Georgia** publishes balance-of-payments statistics, including services. That would be a separate collection with its own definitions: [balance-of-payments publications](https://nbg.gov.ge/en/publications/balance-of-payments). No NBG data were collected.

Geostat compiles merchandise trade primarily from Revenue Service customs declarations, with additional energy sources. The public reviewed Geostat tables are sufficient for this stage; a separate collection of raw customs declarations is unnecessary.

## Definitions that must survive preparation

- This package concerns **trade in goods**. Services, tourism receipts, remittances and the current-account balance belong to other datasets.
- Values are **nominal USD**. Most breakdown workbooks use **thousand USD**, while the national workbook uses **million USD**. Convert units explicitly and preserve source units.
- Exports include domestic exports and re-exports. Domestic exports also include imported goods substantially processed in Georgia; they are not a measure of purely Georgian-origin raw materials or domestic value added.
- Export partners are the final destination; import partners are the sending country. An import partner does not necessarily identify where the product was manufactured.
- Export values use FOB, measured at the exporting border. Import values use CIF, including international freight and insurance. These are the official merchandise-trade conventions; do not silently substitute balance-of-payments goods values.
- Current metadata names **HS 2022**, **SITC Revision 4** and **BEC Revision 4**. Historical code and label equivalence has not yet been established for every product.
- Keep source symbols, blank cells, genuine zero values, historical country identities and aggregate rows distinct. Do not add country-group subtotals to their member countries.
- Keep the latest complete annual period separate from preliminary, incomplete current-year data. Record the capture date because Geostat revises historical values regularly.
- Preserve the published **Other commodities** domestic-export remainder. Do not allocate it to omitted products or calculate re-exports for an omitted product by treating its domestic exports as zero.

## Initial validation performed

The saved audit has **865 passing checks and zero failures**:

- 27 source-file fingerprints and byte sizes, the expected 19-workbook inventory, valid workbook ZIP structures and the 55-worksheet count.
- Explicit annual coverage and source units for 20 annual tables, with no duplicate codes in their coded rows.
- 314 annual published-total comparisons across the national, country, product, domestic, SITC, BEC and country-group sources.
- 252 annual detail-sum checks. Country subtotals are excluded from leaf sums; domestic products include their explicit Other commodities row.
- 64 national month-count checks and 64 month-sum checks, including the eight-month 2026 period.
- 12 checks that the annual domestic-export total does not exceed total exports.

Arithmetic uses stored worksheet values, with a tolerance of **0.001 thousand USD ($1)** for floating-point summation differences. These checks reconcile values before display rounding.

**Limits of this audit:** it does not independently re-extract every source cell, reconcile individual monthly series or quarterly regional tables, validate country-group membership, or approve historical product-code equivalence. No normalized trade observations have been promoted into `data/imports`, a database mirror, public downloads or the website.

## What the next preparation stage needs

- One annual source-preserving observation inventory with each value's workbook, sheet and cell, explicit flow, country/product code, source unit, period and publication status.
- Explicit expected coverage by source block, so an omitted year or category cannot disappear unnoticed.
- Reviewed country identities and product-code equivalence across the historical blocks.
- Independent verification of the prepared observations against the archived source cells, including missing values and residual categories.
- Derived balance, turnover, shares and growth only from compatible reviewed inputs. Re-export derivations need matching total and domestic-export coverage and must be labelled as derived.

## Reproduce the initial audit

Use Python with `openpyxl`, available in the Codex bundled workspace runtime:

```powershell
python "docs/Raw Data/Trade/geostat-external-trade/2026-10-07/audit.py"
```

This reads the stored sources, recalculates the checks and compares them with `validation.json` and `reconciliation.csv`. It uses no network and changes no files. `--write` regenerates the audit evidence after a deliberately reviewed capture change.

`source-manifest.csv` and `reconciliation.csv` use UTF-8 with BOM for direct opening in Microsoft Excel. `source-manifest.json` includes exact original/resolved URLs, UTC retrieval timestamps, source filenames, SHA-256 fingerprints, byte sizes and content types. The source workbooks and methodology documents retain their original names and bytes.
