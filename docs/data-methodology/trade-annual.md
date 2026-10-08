# Annual trade research foundation

Approved scope: 2026-10-07. This is a research package, with source acceptance holds where the publisher's tables disagree. Product presentation and serving integration require a separate approved design.

## Source capture and coverage

The frozen package is `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`. It preserves 45 original files, including 31 Geostat workbooks with 79 worksheets, official methodology/source pages and NBG reference material. `full-source-manifest.*` records URLs, retrieval time, byte size and SHA-256. Originals are not edited, and Git preserves their exact bytes.

| Family | Complete annual periods | Limits |
| --- | --- | --- |
| Goods totals and partners | 1995-2025 | Source-defined countries, including historical and unspecified identities |
| HS4 products | 1995-2025 | Four published historical blocks remain distinct |
| HS6 products | 2000-2025 | Four published blocks; early tables have no descriptions |
| SITC sections and BEC categories | 2000-2025 | Ten sections and seven categories, respectively |
| Country groups | 1995-2025 | EU, CIS, BSEC, OECD and GUAM overlap; membership is not inferred |
| Domestic exports | 2014-2025 | National/country totals; 96 selected HS4 rows for 2014, 99 later, plus Other commodities |
| Registered-address regions | 2022-2025 | Eleven regions plus Unknown; identified-region SITC detail |
| Services | 2020-2024 | Twelve types, country tables and sparse type-country tables |

The reviewed layouts contain 364,495 annual source observations, including blanks, symbols, repeated totals and supporting rows. The originals also contain monthly/quarterly data and 2026 periods; those are archived evidence only. No annual 2026 estimate or NBG historical backfill is prepared.

Primary numerical sources are Geostat's [goods overview](https://www.geostat.ge/en/modules/categories/765/external-merchandise-trade), [exports](https://www.geostat.ge/en/modules/categories/637/export), [imports](https://www.geostat.ge/en/modules/categories/638/import), [domestic exports](https://www.geostat.ge/en/modules/categories/639/domestic-exports) and [services](https://www.geostat.ge/en/modules/categories/766/international-trade-in-services). NBG [external-sector statistics](https://nbg.gov.ge/en/statistics/statistics-data) and its [2024 balance-of-payments publication](https://nbg.gov.ge/en/publications/balance-of-payments) are supplementary reference material.

## Definitions and preservation rules

Amounts are nominal USD. National goods use million USD; detail workbooks use thousand USD. Preparation reads stored XLSX XML decimal tokens and uses Decimal arithmetic with precision 50. Source values, normalized USD, exact source worksheet/cell, labels, original formats, row role, source block and value/publication status remain attached.

Goods exports use FOB prices; imports use CIF. Export partners are final destinations; import partners are sending countries, which need not be manufacturing origins. Services cover resident/non-resident transactions. Goods and services remain separate domains, without a combined headline.

Blanks and published dashes remain unavailable. Numeric zero stays numeric; a small stored amount displayed as 0.0 is preserved. Published negative correction values are not discarded. Publication status remains unspecified unless the source explicitly marks it. Excel can auto-convert code columns and round long numbers: use text-column import to inspect research CSV codes/precision, or inspect the preserved workbooks. The files themselves retain the original code text and exact decimal tokens.

Domestic products are a selected list with an explicit Other commodities remainder; omitted products are not zero and the remainder is not allocated. Regions reflect trading entities' registered addresses, not physical production or consumption locations. Unknown-region totals remain part of Georgia and have no published product detail.

Legacy HS6 numeric identifiers regain leading zeroes under their six-digit convention. Regional SITC uses its separate four-digit subgroup convention (`001.1`). Tiny binary storage noise in numeric code cells is handled only for identifiers, within 0.0000000001; it never rounds monetary values. Original code tokens and formats remain in reviewed layouts. Historical source-block identities are retained and no historical HS edition is imputed from current HS2022 metadata.

Totals, section subtotals, detailed rows, explicit residuals and supporting controls have distinct roles. Alternative classifications and country-group aggregates are not additive components. Supporting regional legal/person rows and joint-service control rows stay in source-observation evidence.

## Source comparability limits and acceptance holds

There are 82 individual HS6-prefix/HS4 allocation differences in five historical code clusters. Their combined native subtotals reconcile; exact affected years, differences and source references are pinned in `source-comparison-exceptions.json`. Individual differences retain their numbers with `source_exception` status, never a passing prefix label. No value or code is remapped. The [WCO correlation guidance](https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs_nomenclature_previous_editions/correlation_table_2002.aspx?p=1) documents renumbering across HS revisions; it does not prove an edition for every Geostat cell. The source does not declare the exact reasons for the clay/mineral and Mixed goods allocations, so those native series are not interchangeable.

The regional footers state 25 May 2026 while second-quarter 2026 columns are present. This conflict is recorded, and 2026 is not prepared. Eight Unknown-region product comparisons remain `not_published`.

Joint service exports publish unlabelled maintenance/repair amounts at `Sheet1 !F36` and `G36` for 2023/2024. These cells reconcile the service subtotals, remain supporting unidentified remainders, and are not assigned to any country. Country-to-joint comparisons require twelve explicitly published numeric counterparts; absent or symbolic detail is not filled with zero.

Two publisher discrepancies remain unresolved: UK service imports for 2022 and 2024 differ between the country-only total and the sum of all twelve published type-country values, by approximately USD 192,237 and USD 379,884 respectively. Both originals and all source references are preserved in `unresolved-source-issues.json`. These comparisons remain failed, and overall source acceptance is held. Source-cell fidelity verification does not resolve the discrepancy or choose which publisher representation is correct.

NBG's 2024 report publishes services exports/imports of 7,706.3/3,814.8 million USD, agreeing with Geostat at the report's displayed precision. NBG's rounded 0.0 for 2020 maintenance/repair does not replace Geostat's primary dash. Shared inputs make this a consistency cross-read, not independent statistical proof.

## Preparation, evidence and verification

### National goods Overview serving subset

The Trade hub and Overview design was approved on 2026-10-08. The first public page uses only the 62 national goods export/import observations and 62 reviewed balance/turnover derivations for 1995-2025. Its canonical serving file is `data/imports/trade-overview-annual.csv`; its scoped evidence is `data/reports/trade-overview-validation.json`.

The preparation checks the original national workbook's SHA-256, stored XML decimal tokens, million-USD header, annual year columns, flow rows, source labels and each cell's number format. Exact decimal arithmetic verifies the USD conversion and both derivation identities. Source references retain their export-before-import order. No native value is rounded during preparation or database copying; browser charts and native Excel numeric cells use the usual JavaScript/Excel number representation and explicit readable USD units.

The scoped report records `national_goods_overview` acceptance separately from the wider research package. The two UK services holds remain unchanged and do not become accepted comparisons. A hold affecting the selected national goods observations blocks this subset. The original research files are never rewritten by the serving preparer.

Historical records use actual basis to distinguish observed trade from forecasts. Their source publication status remains unspecified; a complete annual period is not labelled final. Exports retain FOB valuation, imports retain CIF valuation, and both remain nominal USD. The public page adds no services, re-exports, partial 2026 periods, GDP ratios or inflation adjustment.

Run `npm run data:prepare-trade-overview` to regenerate the two serving artifacts and `npm run data:check-trade-overview` to reproduce their exact bytes without writing. Serving reads only these small artifacts; it does not import the raw workbook reader.

`prepare.py --write` creates deterministic family CSVs, source-observation chunks, the three allowed derivations (national goods balance/turnover and reviewed re-exports), coverage, reconciliation and validation reports. Large product/source chunks follow published blocks and, if necessary, complete-year boundaries. CSVs use UTF-8 BOM, LF records and fixed columns. `--check` reproduces their exact bytes without writes. This proves reproduction, not source acceptance. `--acceptance` exits nonzero while the source holds remain.

`verify_independent.py` separately reads every approved range through openpyxl without importing the normalizer readers or helpers. It checks complete source key-set equality, frozen metadata/count fingerprints, original workbook unit headers, every prepared source and primary cell, labels, codes, formats, missingness and derivation references. Native/USD identities must be exact; independent reader conversion noise is limited to USD 0.001. The reconciliation tolerance remains USD 1, and is not widened to pass comparisons.

Primary records must retain the fixed family columns, including empty display fields and product/country identifiers. Both validators independently establish the full eligible derived-key set. Balance and turnover require national goods export/import totals; re-exports require the matching export/domestic-export scope, reviewed source identity and reviewed year range. Domain, dimension, item, source-reference order, status and role must agree. Missing, duplicate, extra or scientifically misidentified derivations fail even if their arithmetic is correct.

`artifact-manifest.csv` records generated data/evidence row counts, sizes and fingerprints, excluding its own hash. The independent report fingerprints its exact input artifacts; check mode rejects stale evidence. Historical identity review and source limitations remain reviewed inputs. The original 19-workbook exploratory audit is preserved separately and does not substitute for this expanded validation.

Run from the repository root:

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

The source-acceptance command intentionally returns exit code 2 for the two unresolved comparisons. Focused tests pin omitted years/zero rows/blocks, duplicate keys, lost leading zeroes, invented zeroes, unit/value changes, source corruption, stale artifacts and reports, source remainders and known holds. Repository completion also requires `npm run check` and `npm run build` in `apps/web`; there are no UI changes requiring browser tests.
