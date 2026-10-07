# Trade: reviewed annual data foundation

Date: 2026-10-07

Status: Approved in writing on 2026-10-07. The user approved the data scope and this specification. The expanded source intake is collected; the implementation plan is the next review before preparation code.

Output packaging refinement proposed for that plan review: large product and source-observation CSVs are divided by their existing published source blocks, with complete individual-year files if a block exceeds the plan's file-handling limit. This changes file organization only, retaining the approved observations, schema and validation requirements.

## 1. Outcome

Produce a reproducible, source-preserving annual research package for Georgia's external trade, ready for a later presentation decision. It must show where every figure came from, retain unpublished or unidentified detail honestly, and fail validation if a year, category or source observation disappears.

This stage delivers data, source evidence, methodology and validation. Pages, navigation, charts, public downloads, MCP tools, serving-database imports and deployment are separate decisions. Prepared observations stay in the research package rather than `data/imports`.

## 2. Agreed collection scope

| Family | Content | Complete annual coverage in this capture |
| --- | --- | --- |
| Goods totals | Published export and import values | 1995-2025 |
| Goods partners | All published export and import countries, including historical and unspecified identities | 1995-2025; each country's own available cells remain authoritative |
| Goods products | All published HS four-digit and six-digit rows | Four digits: 1995-2025. Six digits: 2000-2025 |
| Domestic exports | National total, partners, selected four-digit products and the explicit Other commodities remainder | 2014-2025 |
| Broad goods classifications | Published SITC sections and BEC categories | 2000-2025 |
| Goods country groups | Published group totals, kept as their own aggregate rows | 1995-2025; membership limits remain explicit |
| Regional goods trade | Exports and imports for the 11 regions and Unknown, with the published SITC product detail for identified regions | 2022-2025 |
| Services trade | Exports and imports by all 12 service types, countries, and service type × country | 2020-2024 |

Collect complete official workbooks without editing them. They contain monthly and quarterly tabs and preliminary 2026 values; those remain archived evidence. Prepared observations in this stage are complete annual periods only. No annual estimate for 2026 is produced.

Transport-mode tables, trader size, trader economic activity, physical quantities, trade unit-value indices, projections and GDP ratios remain outside preparation. The service scope includes travel, transport, finance, insurance and other published service categories; remittances, investment income and the current-account balance are outside it.

## 3. Sources and current intake

The source package is `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`.

- `official/` contains the original publisher files and source pages.
- `full-source-manifest.json` and its BOM CSV are the expanded intake inventory: **45 source files, including 31 Geostat Excel workbooks**, Geostat definitions and source pages, and NBG reference material. They record original and resolved URLs, publisher, UTC retrieval time, local filename, SHA-256, byte size and content type.
- `source-manifest.*`, `audit.py`, `validation.json` and `reconciliation.csv` document the earlier 19-workbook exploratory capture. Preserve them as that stage's evidence; the expanded preparation consumes the full manifest.
- `full-workbook-inventory.json` and `source-intake-*` describe the expanded workbook structure and initial controls. They do not establish complete extraction or historical comparability.

Primary numerical sources are Geostat's [goods overview](https://www.geostat.ge/en/modules/categories/765/external-merchandise-trade), [exports](https://www.geostat.ge/en/modules/categories/637/export), [imports](https://www.geostat.ge/en/modules/categories/638/import), [domestic exports](https://www.geostat.ge/en/modules/categories/639/domestic-exports) and [services](https://www.geostat.ge/en/modules/categories/766/international-trade-in-services).

The NBG [external-sector methodology](https://nbg.gov.ge/en/statistics/statistics-data) and [2024 balance-of-payments publication](https://nbg.gov.ge/en/publications/balance-of-payments) are reference material for services definitions and matching-year comparisons. Their inputs partly overlap with Geostat, so publisher agreement is a consistency check, not independent proof. Record publication-vintage differences; do not overwrite Geostat cells or silently backfill older service years from a different NBG series. A longer NBG numerical history requires its own reviewed source capture and decision. UN Comtrade is not required for this package.

Preparation and verification read only the archived files. No production fetch, direct database edit or document extraction is introduced. PDFs are methodology and reference reading, not the source of prepared primary observations.

## 4. Publisher definitions and important limits

1. **Value and prices.** Preserve nominal USD values. The national workbook uses million USD; most detail tables use thousand USD. Exports use FOB values at the exporting border. Imports use CIF values including freight and insurance. Goods and services are distinct source families; do not create a combined headline from differently defined inputs.
2. **Partners.** Goods export partners are final destinations; import partners are sending countries, which need not be manufacturing origins. Services concern transactions between residents and non-residents. Country codes and labels remain source-faithful, including former countries and unspecified partners.
3. **Domestic exports.** These include goods produced in Georgia and imported goods substantially processed here. Product detail is a selected list: 96 coded rows for 2014 and 99 in later blocks, plus Other commodities. The remainder cannot be allocated to omitted products. An absent domestic product is not zero.
4. **Regions.** Trade is attributed by the legal entity's registered address. It is not production-location or consumption-location data. Unknown is a necessary part of the country total and has no published product breakdown in this capture. Preserve its totals; do not distribute them among regions or products.
5. **Regional file dates.** The footers state 25 May 2026 while the files also contain preliminary second-quarter 2026 values. Record that discrepancy. The 2026 quarter cells remain archived-only; reconcile every prepared 2022-2025 annual column directly.
6. **Product identities.** Current metadata identifies HS 2022, SITC Revision 4 and BEC Revision 4. Do not infer that all historical cells have already been harmonized to the same edition. HS4 source blocks are 1995-1999, 2000-2014, 2015-2019 and 2020-2025. HS6 blocks are 2000-2008, 2009-2014, 2015-2019 and 2020-2025. Retain block identity and exact labels. Code-prefix parent checks are made only over matched source periods; historical label/code changes are recorded rather than silently joined.
7. **Code formatting.** Older HS6 sheets store codes as numbers with a six-digit display format; modern sheets use strings. Preserve leading zeroes. SITC regional codes use their own four-digit subgroup convention and must not be treated as HS codes.
8. **Missingness and precision.** Preserve blanks, published non-applicable symbols, source zeroes and negligible displayed magnitudes separately. Use stored decimal values for arithmetic. A formatted 0.0 can conceal a small nonzero stored value. Unknown publication status stays unspecified; a complete period alone is not proof of final status.
9. **Aggregate rows.** Totals, country-group subtotals, detailed countries and products have distinct roles. Never add a subtotal to its members or combine alternative classification totals as additive components. Country-group membership is not inferred from today's membership.

## 5. Prepared package and provenance

Create family-specific research CSVs:

- `goods-national-annual.csv`
- `goods-countries-annual.csv`
- `goods-products-annual/`, with one CSV per classification and published source block
- `goods-domestic-annual.csv`
- `goods-country-groups-annual.csv`
- `goods-regions-annual.csv`
- `services-annual.csv`

Every record carries year, flow, original value and unit, normalized USD value, value/publication status, row role, source block, source ID, worksheet, cell and original number format. Relevant dimensions add the original country code and English label, classification and level, product code and label, region identity, or a stable service-type ID and original label. There is no language-label-based identifier. Source and missingness fields remain attached throughout preparation.

`source-observations/` contains the exhaustive annual source-cell inventory, divided by source worksheet/block and including repeated totals and validation/supporting rows. `artifact-manifest.csv` inventories all generated files, row counts and fingerprints. `coverage.csv` states the exact source-block years and observed identities. `identity-review.csv` records historical code/label changes and their disposition: verified equivalent or retained as separate source identity. Do not resolve ambiguous changes by guessing.

`derived-annual.csv` may contain only the previously discussed trade balance, turnover and re-exports: exports minus imports, exports plus imports, and total exports minus domestic exports respectively. Derive them only from matching reviewed inputs, preserve both input references, and identify them as derived. Country/product re-exports remain unavailable where a matching domestic figure is not published. Do not compute growth, shares or other indicators in this stage.

All research CSVs intended for opening in Excel use UTF-8 with BOM. Source workbooks remain untouched. The package README explains coverage, meanings, limits and reproduction commands. A matching `docs/data-methodology/trade-annual.md` owns the data decisions. After written-spec approval, record the bounded research foundation in `Project_Definition.md` without authorizing product integration.

## 6. Preparation and validation

Use the existing unemployment research-package pattern: a package-local `prepare.py` reads stored XLSX XML decimal tokens using Python's standard library; `--write` produces the research files and evidence, while `--check` reproduces and compares them without writes. It uses `Decimal` for arithmetic rather than binary floating-point values. No new application dependency is needed.

Require an explicit source/file/sheet/year/identity inventory pinned to the captured sources. Validate hashes, byte sizes, ZIP integrity, expected layouts, code formatting and uniqueness before preparing values. An unavailable source cell remains unavailable rather than turning into zero.

Reconcile:

- Country, HS4, HS6, SITC and BEC totals with the same-year national goods totals after unit conversion.
- HS6 products with corresponding HS4 parents for every matched source block, with explicit treatment of any publisher exception.
- Domestic-export countries and selected products plus Other commodities with the domestic total; domestic totals with total exports.
- All 11 regional totals plus Unknown with national totals; identified-region product sums with their own total. Unknown product comparisons are explicitly not applicable.
- Service types, country totals and service type × country tables with matching service totals, preserving any unpublished country detail.
- The three permitted derivation formulas and their exact input references.

Stored-value comparisons initially use an absolute tolerance of **USD 1** for aggregation noise. Every discrepancy above it must be explained from source evidence or block acceptance of the affected prepared data. Do not widen a tolerance merely to pass a comparison. NBG publication comparisons account explicitly for displayed precision and vintage; they do not replace internal controls.

## 7. Independent verification and failure tests

Ship `verify_independent.py`, using the bundled `openpyxl` reader, with no dependency on the normalizer's extraction functions. It independently walks the approved source ranges and compares the exact observation keys, values, labels, formats and missingness with the prepared source-cell inventory. Tolerate only the documented conversion noise between XML decimals and the independent reader. Require complete key-set equality and family/source/year counts, not a sample or only total agreement.

Focused failure tests must reject an omitted year, omitted country/product/service block, duplicate key, lost leading zero, incorrect unit conversion, invented zero, changed source fingerprint and altered observation value. They also pin Other commodities preservation, Unknown-region behavior, historical identity separation and exclusion of sub-annual/preliminary-2026 values. Tests exercise those failures rather than simply mirroring implementation output.

## 8. Acceptance and workflow

The package is acceptable when all scoped originals are captured, every prepared annual observation is independently matched, coverage is complete, arithmetic failures are zero, all source limitations are documented, and focused failure tests pass. An unresolved source discrepancy is reported with the affected series and years; it does not receive a passing label.

After written-spec approval: write and review the implementation plan, select its execution method, prepare the package, run the focused checks and independent verifier, perform a review, and run the repository completion gate once (`npm run check` and `npm run build` in `apps/web`). There are no UI changes requiring browser tests.

Preserve the existing isolated worktree and its source intake. Local implementation commits belong on a `codex/*` branch. Push, PR, merge, deployment and synchronization require delivery authorization; none is implied by the research-stage approval.
