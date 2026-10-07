# Annual Trade Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare and independently verify the approved annual goods, services and regional trade research package, with every value linked to its original source cell.

**Architecture:** Preserve the existing 45-file capture. A package-local standard-library XML reader feeds explicit, frozen source layouts and family readers. Decimal arithmetic, coverage controls and a separate openpyxl verifier validate the complete observation inventory. The outputs remain research files, with product/source-observation CSVs separated by their published historical blocks.

**Tech Stack:** Bundled Python 3, standard-library `Decimal`, `csv`, `json`, XML and ZIP readers; bundled `openpyxl` for independent verification; `unittest` for focused failure tests. No application dependency is added.

**Spec:** `docs/superpowers/specs/2026-10-07-trade-data-design.md`, approved 2026-10-07. This plan proposes only the §5 file-packaging refinement: source-block CSVs instead of two large combined CSVs. The inspected annual tables contain approximately 359,000 numeric cells before completeness/missingness classification, making source blocks useful for review and file handling. Plan approval also approves this packaging refinement.

## Global Constraints

- Goods totals, partners and HS4: 1995-2025. HS6: 2000-2025. Domestic exports: 2014-2025. SITC sections/BEC: 2000-2025. Regional goods: 2022-2025. Services: 2020-2024. Every publisher-defined identity retains its own available cells.
- Prepare complete annual periods only. Monthly/quarterly tabs and preliminary 2026 columns remain archived evidence.
- Use stored XML decimal tokens, not displayed amounts. Normalize million/thousand USD explicitly. Use `Decimal` precision 50 and USD 1 aggregation tolerance; never widen it merely to pass a comparison.
- Preserve source blanks, the published `-` non-applicable marker, true numeric zero and small nonzero values displaying as 0.0. Publication status defaults to `unspecified` unless the source marks it explicitly.
- HS4 blocks: 1995-1999, 2000-2014, 2015-2019, 2020-2025. HS6 blocks: 2000-2008, 2009-2014, 2015-2019, 2020-2025. Keep source-block identities; do not infer harmonization from today's classification metadata.
- Preserve all source labels and exact sheet names, including `Sheet1 ` in the services export joint table and trailing spaces elsewhere. Normalized lookup labels never replace the recorded original label.
- Domestic products are a selected list plus Other commodities. Unknown-region totals have no product detail. Preserve both limits without allocating a remainder or inventing zeroes.
- Registered-address regional attribution, partner definitions and FOB/CIF conventions remain explicit. Goods and services stay separate domains.
- All generated research CSVs use UTF-8 with BOM, LF record separators, fixed column order and deterministic sorting. Generate no live timestamps.
- No change to routes, UI, navigation, `data/imports`, public source registration, serving databases, MCP or public downloads. No network in preparation/check/verification commands. PDFs remain reference reading only.
- Source files are already collected. Re-download only if a verified capture problem requires it; never silently replace a source vintage.
- Work in this worktree and `codex/trade-data-foundation`. Preserve the earlier exploratory audit. Local commits are allowed; delivery requires separate authorization.

## Review Focus

1. Whole years or zero-valued rows disappear while sums still pass: Task 1 freezes an independent source-cell/key inventory; Task 5 mutates omissions.
2. Legacy numeric codes lose leading zeroes or source blocks are silently joined: Tasks 1 and 3 pin `010121` and retained historical identities.
3. A subtotal or alternative classification is counted twice: Tasks 2-4 preserve row roles and test leaf-only sums against independent totals.
4. Missing/non-applicable detail becomes zero or a derived figure: Tasks 2 and 4 pin `-`, absent domestic counterparts and Unknown-region detail.
5. Preparation and verification share the same extraction mistake: Task 5 uses a separate reader and independent source-range/key coverage, checking raw values, units, labels and formats.

---

## File Map and Contracts

Let `P` mean `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/`; these are exact package-relative paths, not another working directory.

| Responsibility | Files under P |
| --- | --- |
| Verified sources and XML cells | `archive.py`, `source-layouts.json`, `expected-observation-inventory.json` |
| Shared observation schema | `model.py` |
| Goods partners/domestic/groups and permitted derivations | `read_goods.py` |
| HS4/HS6/SITC/BEC products and parent checks | `read_products.py` |
| Regions and services | `read_regions_services.py` |
| Assembly, validation and deterministic artifacts | `prepare.py`, `validation.py` |
| Independent source walk and failure tests | `verify_independent.py`, `test_prepare.py` |
| Research evidence | `coverage.csv`, `identity-review.csv`, `source-limitations.csv`, `artifact-manifest.csv`, `prepared-validation.json`, `prepared-reconciliation.csv`, `independent-verification.json`, `source-review.md` |

Preserve existing `audit.py`, its original manifest and reports. Expanded preparation reads `full-source-manifest.*` and produces separately named `prepared-*` reports.

Common primary CSV columns, in order: `year,flow,item_id,value_usd,source_value,source_unit,value_status,publication_status,role,source_block,source_id,source_sheet,source_cell,source_label,source_number_format`.

Family dimension columns precede those common columns:

- National: `geography_id`.
- Countries: `partner_code,partner_label_en,source_group_id,source_group_label_en`.
- Products: `classification,classification_level,product_code,product_label_en`.
- Domestic: `dimension,geography_id,partner_code,partner_label_en,classification,classification_level,product_code,product_label_en`.
- Country groups: `group_id,group_label_en`.
- Regions: `geography_id,geography_label_en,classification,classification_level,product_code,product_label_en,attribution_basis`.
- Services: `dimension,partner_code,partner_label_en,service_id,service_label_en`.

The source-observation chunks use the superset of these fields plus `family`. Empty dimensions are empty strings. `source_value` retains the native token/text; `value_usd` is empty for unavailable observations. Values are strings in serialized CSV records, with Decimal conversion used for arithmetic. Source-cell identity is `(source_id, source_sheet, source_cell)`; prepared series identity also includes flow, dimensions and source block.

Pin `flow` to `export`, `import` or `domestic_export`; `value_status` to `numeric`, `blank` or `not_applicable`; `role` to `total`, `subtotal`, `detail`, `residual` or `supporting`; and `source_unit` to `million_usd` or `thousand_usd`. Numeric zero has status `numeric`. Source layouts freeze row roles and lowercase ASCII `item_id` values: totals use `goods.total` or `services.total`, products use `goods.{classification}.{source_block}.{product_code}`, and a partner without a reviewed source code uses `partner.{source_id}.{sheet_index}.{row_index}` rather than a label-based ID. Separate source identities stay separate unless `identity-review.csv` approves the match.

`derived-annual.csv` uses `year,domain,dimension,item_id,indicator_id,value_usd,value_status,publication_status,input_source_refs,role`. Input references use exact source ID, sheet and cell triples serialized as JSON in one CSV field; role is `derived`.

Output files: the six non-product family CSVs named in spec §5; `goods-products-annual/{hs4|hs6|sitc1|bec1}-{source_block}.csv`; `source-observations/{source_id}-{sheet_index:02d}-{source_block}.csv`; the derived CSV and evidence files above. Sheet indices are one-based workbook order, retaining exact sheet names inside records. If a generated chunk exceeds the package's 50,000,000-byte handling limit, divide that entire chunk into complete individual years, inserting `-{year}` before `.csv`; never split a year's rows or alter identities. `artifact-manifest.csv` has `file,family,source_block,row_count,sha256,bytes`. It excludes itself from fingerprints to avoid a circular digest.

Evidence contracts:

- `coverage.csv`: `family,flow,source_id,source_sheet,source_block,year,identity_count,numeric_count,blank_count,not_applicable_count,source_key_count,key_sha256`; one row per source block/year.
- `identity-review.csv`: `family,left_source_id,left_identity,right_source_id,right_identity,first_year,last_year,disposition,evidence`; reviewed input with disposition `verified_equivalent` or `retained_separate`, never regenerated by preparation.
- `source-limitations.csv`: `limitation_id,family,flow,first_year,last_year,source_refs,status,explanation`; exact source triples in `source_refs`, with unavailable comparisons distinguished from arithmetic checks.
- `prepared-reconciliation.csv`: `check,family,flow,year,item_id,expected_usd,actual_usd,difference_usd,tolerance_usd,status,source_refs,evidence`; `status` is `pass`, `fail` or `not_published`. Unsupported comparisons have empty numeric comparison fields.
- `expected-observation-inventory.json`: keyed by source/sheet/block/year, with complete coordinate/key lists or hashes, expected row/code counts, status counts and label/code-format fingerprints. Capture only through the explicit reviewed command in Task 1; ordinary preparation and verification cannot update it.
- `source-layouts.json`: a list of reviewed table objects containing `family,flow,source_id,source_sheet,sheet_index,source_block,source_unit,year_columns,rows,excluded_rows,header_cells`. `year_columns` maps year strings to Excel column letters. Each `rows` entry carries `row_index,role,item_id,dimensions,label_cells,code_cells`; dimensions use the fixed family columns, while label/code/header cells retain exact coordinates and captured values/formats. Excluded rows carry coordinates and an explicit reason.

Core interfaces:

- `archive.load_verified_sources(package_root: Path) -> dict[str, dict]`: exact 45-source set and manifest parity; returns verified source descriptors.
- `archive.read_stored_sheet(path: Path, sheet_name: str) -> dict[str, Cell]`: `Cell` has `value: Decimal | str | None`, `raw_token: str`, `native_type: str` and `number_format: str`.
- `model.Observation`: a dictionary of the fixed string fields above; `model.numeric_usd(row: Observation) -> Decimal | None` interprets the already-classified status.
- Family readers accept `(sources: dict, layouts: list[dict], package_root: Path) -> list[Observation]` and retain total/subtotal/detail/residual roles.
- `validation.validate_observations(rows: list[Observation], inventory: dict, identities: list[dict]) -> dict`: coverage, exact keys, unit identities and arithmetic evidence; raises a named error on an unexplained failure.
- `prepare.prepare_package(package_root: Path) -> tuple[list[Observation], dict[str, bytes], dict]`: returns observations, deterministic artifacts and validation report. `prepare.write_or_check(package_root: Path, write: bool) -> dict` writes approved outputs or compares all expected artifact bytes without mutation.
- `verify_independent.verify_package(package_root: Path) -> dict`: independently reads sources and all source-observation chunks, returning full coverage/value evidence or failing.
- `verify_independent.capture_inventory(package_root: Path) -> dict`: independently walks only the reviewed source layouts and returns the frozen source inventory for Task 1. It must not call normalizer readers or conversion helpers.

Commands run from the repository root. Initialize these task-specific PowerShell variables once; every test script ends with `unittest.main()` so a named test class selects its focused tests:

```powershell
$tradePython = 'C:/Users/Mylaptop/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$tradePackage = 'docs/Raw Data/Trade/geostat-external-trade/2026-10-07'
& $tradePython -X utf8 "$tradePackage/test_prepare.py" ArchiveTests
```

Later commands use these exact two variables. For a focused failing run, the named new assertion must fail; an unrelated import/runtime error is not evidence of the intended failure. Passing focused runs exit 0 and print `OK`.

### Task 1: Verified archive, exact source layouts and observation contracts

**Files:** Create `P/archive.py`, `P/model.py`, `P/source-layouts.json`, `P/expected-observation-inventory.json`, the source-walk/capture portion of `P/verify_independent.py`, `P/test_prepare.py` and `P/source-review.md`.

**Interfaces:** Implements the two archive functions and `Observation` contract above. Produces verified source descriptors, stored cells, explicit layouts and a frozen coverage inventory for all later tasks.

- [ ] Write failing `ArchiveTests` assertions: exactly 45 unique source descriptors and 31 XLSX files; missing/duplicate manifest entries fail `source_inventory`; modified source bytes fail `source_fingerprint`; a changed sheet/header or an unassigned data-bearing row fails `source_layout`.
- [ ] Pin stored-value/code examples: national `AF5` equals `Decimal('7287.805027574291')` in million USD; an old HS6 `A7` storing `10121` with format `000000` becomes code `010121`; regional `B10` becomes the four-digit SITC subgroup `001.1`; preserve exact original labels and sheet names. Blank, `-`, zero and a nonzero value formatted 0.0 have distinct outcomes. Unknown cell types are rejected rather than guessed.
- [ ] Pin `test_legacy_hs6_stored_cell` directly against the archived sheet, before product normalization:

```python
cells = archive.read_stored_sheet(
    PACKAGE_ROOT / 'official/Export-Product-by-6-digit-2000-2014.xlsx',
    '2009-2014-years',
)
assert cells['A7'].value == Decimal('10121')
assert cells['A7'].number_format == '000000'
```

- [ ] Run `& $tradePython -X utf8 "$tradePackage/test_prepare.py" ArchiveTests`. Confirm the named cases fail before adding their implementation.
- [ ] Implement the archive/XML reader by following the existing unemployment reader's stored-token approach, without changing that package. Freeze exact workbook/sheet/year/row roles and source code lists from direct source inspection. National uses only rows 5/20; regions use annual columns H/M/R/W; ordinary tables use their annual tabs; services use their published 2020-2024 columns. Footer and unused-cell exclusions are recorded explicitly.
- [ ] Implement `verify_independent.capture_inventory` using openpyxl; run `& $tradePython -X utf8 "$tradePackage/verify_independent.py" --capture-inventory` now, before family normalization. Capture source-cell key digests, row/code inventories, numeric/blank/symbol counts and label/format fingerprints; review table boundaries and every excluded row. Store code-cell coordinates and their native values/formats in the reviewed layouts as well as numeric-cell formats. The normalizer cannot regenerate or overwrite this inventory.
- [ ] Repeat the focused tests, require all assertions to pass, and commit the task's package files and the previously uncommitted source capture. The captured inventory is not a claim of finished preparation.

### Task 2: Goods totals, partners, domestic exports and country groups

**Files:** Create `P/read_goods.py` and `P/identity-review.csv`; extend `P/model.py`, `P/test_prepare.py` and `P/source-review.md`.

**Interfaces:** `read_goods.read_goods(...) -> list[Observation]` follows the family-reader contract. `read_goods.derive_goods(rows: list[Observation], compatible_pairs: set[tuple]) -> list[dict]` returns only approved derivations with source references. Supplies national/country/domestic/group rows to later validation.

- [ ] Write failing `GoodsTests`: annual national coverage is exactly 1995-2025, partners retain their published source-year cells, domestic coverage is 2014-2025, and no row has year 2026 or a sub-annual period. National 2025 exports normalize to `Decimal('7287805027.574291')` USD. Thousand-USD inputs use factor 1000, million-USD inputs factor 1000000, with no rounding.
- [ ] Pin domestic 2014's 96 coded products, later blocks' 99, and the one explicit Other commodities remainder. Removing that remainder fails completeness and reconciliation. Removing an all-zero country row must fail frozen coverage even if the sum is unchanged.
- [ ] Pin aggregate roles: partner-table EU/CIS/Other-country subtotals are excluded from country leaf sums. Separate country-group tables have five published groups (EU, CIS, BSEC, OECD, GUAM); they are overlapping aggregates and are never summed into a new total.
- [ ] Pin derivations with small reviewed fixtures: exports 100/imports 120 produce balance -20 and turnover 220; total exports 100/domestic 40 produce re-exports 60 and both source references. A missing/non-applicable or unreviewed counterpart produces no derived amount. Other commodities cannot be matched to an invented export counterpart.
- [ ] Run `& $tradePython -X utf8 "$tradePackage/test_prepare.py" GoodsTests` and confirm the new assertions fail.
- [ ] Implement the fixed family layouts and reviewed same-year matching, then require the focused command to print `OK`. Derived balance/turnover are national goods measures in this stage; re-exports can additionally use reviewed country/HS4 pairs. Do not add service-derived indicators or growth/shares.
- [ ] Review all historical partner labels/code changes and same-year derivation matches. Preserve separate source identities when equivalence cannot be established. Commit this independently tested task.

### Task 3: Detailed products and classification reconciliation

**Files:** Create `P/read_products.py`; extend `P/test_prepare.py`, `P/identity-review.csv` and `P/source-review.md`.

**Interfaces:** `read_products.read_products(...) -> list[Observation]` implements the family-reader contract. `read_products.compare_hs_parents(rows: list[Observation], compatible_pairs: set[tuple]) -> list[dict]` emits every same-period HS6-to-HS4 comparison and explicit publisher exceptions for `validation.py`.

- [ ] Write failing `ProductsTests`: HS4 uses its four specified source blocks; HS6 uses 2000-2008, 2009-2014, 2015-2019 and 2020-2025. No six-digit observation is produced for 1995-1999. Leading zeroes and distinct historical source-block IDs survive serialization.
- [ ] Pin ten SITC sections and seven BEC categories per published source block, retaining every source code. Removing a zero-valued product/year or an entire block fails the frozen key inventory; duplicate source/series keys fail `duplicate_key`.
- [ ] Pin prefix reconciliation with fixtures: `010121=30` and `010129=70` reconcile with same-period HS4 `0101=100`; a same-period discrepancy of USD 2 fails at USD 1 tolerance. Different/unreviewed historical periods are not combined to manufacture a match.
- [ ] Run `& $tradePython -X utf8 "$tradePackage/test_prepare.py" ProductsTests` and confirm the new assertions fail.
- [ ] Implement fixed product readers and the comparison function, then require the focused command to print `OK`. Full annual HS4/HS6/SITC/BEC totals must also reconcile against Task 2's national totals.
- [ ] Review the full real-source parent-comparison report and code/label changes. Any unexplained mismatch stops acceptance of the affected prepared data. Document source-supported exceptions with source IDs, years and cells; never relax the tolerance or silently reclassify a product. Commit the tested task.

### Task 4: Registered-address regions and services

**Files:** Create `P/read_regions_services.py`; extend `P/test_prepare.py`, `P/source-limitations.csv`, `P/identity-review.csv` and `P/source-review.md`.

**Interfaces:** `read_regions_services.read_regions(...)` and `read_regions_services.read_services(...)` implement the family-reader contract. They produce distinct region and service records; neither feeds a combined goods/services total.

Region IDs reuse the established IDs `region.tbilisi`, `region.adjara`, `region.guria`, `region.imereti`, `region.kakheti`, `region.mtskheta_mtianeti`, `region.racha_lechkhumi_kvemo_svaneti`, `region.samegrelo_zemo_svaneti`, `region.samtskhe_javakheti`, `region.kvemo_kartli` and `region.shida_kartli`; Unknown uses `region.unknown`. Preserve the original row labels, including trailing spaces.

Service IDs follow the 12 source rows, in order: `services.manufacturing`, `services.maintenance_repair`, `services.transport`, `services.travel`, `services.construction`, `services.insurance_pension`, `services.financial`, `services.intellectual_property`, `services.telecommunications_computer_information`, `services.other_business`, `services.personal_cultural_recreational`, `services.government`. Freeze the full corresponding original labels in `source-layouts.json`; totals use `services.total`.

- [ ] Write failing `RegionTests`: exactly 11 named regions plus Unknown for exports/imports in 2022-2025; `attribution_basis='registered_address'`; Unknown totals at source rows 4789/8255 are retained. There are no Unknown product rows, no municipal rows and no quarter/2026 rows. The eight unavailable Unknown product comparisons are labelled `not_published`, not passed arithmetic or zeroes.
- [ ] Pin region leaf sums: all 11 regions plus Unknown reconcile to each national annual total; each identified region's SITC details reconcile to its own total. Record the conflicting May 2026 footer/second-quarter columns while leaving those quarters archived-only.
- [ ] Write failing `ServicesTests`: all 12 published service types and 2020-2024 source coverage; country-only, type-only and joint rows have separate dimensions and stable type IDs. Exports `2020 maintenance/repair` remains the published `-` with unavailable numeric value. Service totals/types/countries/joint rows retain their own source keys and are not added twice.
- [ ] Pin current 2024 service exports from the type table: source `F5=7706284.984759998` thousand USD normalizes to `7706284984.759998` USD. Missing source-country/type detail remains unavailable; no pre-2020 or 2025 service observation is introduced.
- [ ] Run `& $tradePython -X utf8 "$tradePackage/test_prepare.py" RegionTests ServicesTests` and confirm the new assertions fail.
- [ ] Implement the fixed region blocks and service sections, then require the focused command to print `OK` and real-source region/service totals to reconcile. Review sparse joint-table coverage and all section-boundary exclusions.
- [ ] Document the NBG reference comparison at its published precision/vintage in `source-review.md`. Shared inputs make it a consistency cross-read; it is not the independent verifier and cannot overwrite a Geostat value. Commit this tested task.

### Task 5: Deterministic preparation, independent verification and completion

**Files:** Create `P/prepare.py`, `P/validation.py` and the specified research/evidence artifacts; extend Task 1's `P/verify_independent.py`, `P/test_prepare.py` and `P/README.md`; create `docs/data-methodology/trade-annual.md`; amend only the research-foundation scope in `Project_Definition.md` §2.

**Interfaces:** Implements the validation, assembly and independent-verification contracts above, extending the independent source walk already shipped in Task 1. Normal verification cannot invoke capture mode or change reviewed inputs.

- [ ] Write failing `PrepareTests`: two writes yield identical bytes; check mode is read-only; every expected artifact is inventoried with row count/hash; all CSVs have BOM and correct quoting, including Unicode country names; missing/stale artifacts fail `artifact_mismatch`. No generated CSV contains a 2026/sub-annual primary record. The fixed 50,000,000-byte limit and the specified whole-year split preserve the exact key set, year boundaries and artifact filenames. Check mode rejects stale files in both generated chunk directories while preserving all original audit reports.
- [ ] Write failing `IndependentTests`: omitted year, omitted zero row, duplicate key, lost leading zero, invented zero for `-`, changed label/format, altered value/unit and changed source fingerprint each fail their named check. The verifier must not import `archive.py`, family-reader extraction functions or normalizer unit/code helpers.
- [ ] Set up the independent walk: openpyxl reads the approved source ranges, checking complete source-key set equality, frozen coverage digests and exact labels/status/formats. Compare independent native/USD numbers within USD 0.001 reader-conversion noise; separately require normalized USD to equal exact native Decimal × scale, so incorrect conversion cannot hide within that tolerance. Deliberate USD 0.01 corruption must fail. Report per-source/family/year counts and maximum observed conversion difference.
- [ ] Run `& $tradePython -X utf8 "$tradePackage/test_prepare.py" PrepareTests IndependentTests` and confirm the new assertions fail.
- [ ] Implement the minimal preparation/writer/validator and verifier, and require the focused command to print `OK`. Source integrity/coverage/roles precede arithmetic, then derivation/input checks and artifact reproduction. A known unsupported comparison is separately counted; an unexplained failure blocks a passing package.
- [ ] Run the commands below in order and read every report. Each exits 0; preparation/check reports zero failures, the independent verifier reports complete key-set equality and zero unexplained differences, and all focused tests print `OK`. A spot check or matching grand total is insufficient:

```powershell
& $tradePython -X utf8 "$tradePackage/prepare.py" --write
& $tradePython -X utf8 "$tradePackage/prepare.py" --check
& $tradePython -X utf8 "$tradePackage/verify_independent.py"
& $tradePython -X utf8 "$tradePackage/test_prepare.py"
```
- [ ] Update the methodology/README with exact resulting coverage/counts, actual source exceptions, registered-address meaning, missingness, historical identity limits, reproduction commands and independent-verification evidence. Add the bounded research foundation to §2; keep all product-integration exclusions. Resolve any fresh review findings with targeted checks.
- [ ] Run `npm run check` and `npm run build` once in `apps/web`. Browser tests are unnecessary because there are no UI changes. Verify Git changes stay within this research scope; commit the verified package. Do not push or merge without delivery authorization.

## Plan Self-Review and Handoff

Scope coverage: all eight spec families, permitted derivations, source provenance, offline preparation, complete annual bounds, independent coverage/value checks, failure tests, methodology and final repository gates have owning tasks. The five Review Focus cases each have explicit tests above. No implementation action starts until this plan is reviewed and an execution method is selected.

Recommended execution: **Native**. One agent implements these five tasks here, with the complete independent reader check and a fresh final review. Most tasks share the same observation/identity contracts, so this avoids repeated handoffs. **Subagent-driven** remains available if the user prefers separate implementers/reviewers per task and the additional context cost.
