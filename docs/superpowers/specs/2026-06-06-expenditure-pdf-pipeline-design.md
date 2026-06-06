# GeoData.ge Expenditure PDF Pipeline Design

Date: 2026-06-06
Status: Draft for user review

## 1. Goal

Build a strict pilot pipeline that turns the 2025 Treasury expenditure PDF into project data without changing existing app data during the pilot.

The pilot source is:

```text
docs/Raw Data/Expenditure/2025-12-month-state-budget-functional-expenditure.pdf
```

The pilot should prove that one expenditure PDF can be extracted into official source rows, validated, and prepared for separate public spending mapping. After the 2025 pilot works, the rollout order is:

```text
2025 -> 2024 -> 2023 -> 2016-2022
```

## 2. Non-Goals

This design does not add a public UI feature.

This design does not replace existing `2023-2025` app data during the pilot.

This design does not use `2025.xlsx` as a pipeline source. The workbook may be used once as a diagnostic comparison, but it is not a future source of truth because it has a different data structure.

This design does not make the parser responsible for assigning public `spending.*` categories. Mapping is a separate stage.

## 3. Chosen Approach

Use a mostly automated pipeline with strict validation:

```text
Treasury PDF -> table extraction -> official source rows CSV -> validation report -> separate pilot facts/report
```

The pipeline is fail-closed for extraction and reconciliation errors. If table rows cannot be parsed, numeric values fail to parse, grand totals do not reconcile, or parent/child subtotals do not reconcile, the run fails and app data is not updated.

Mapping uncertainty is handled separately. Unmapped detail rows must be explicitly assigned to `spending.other_unclassified` by the mapping stage and reported by amount and share. They must not disappear from totals.

## 4. Data Grain

The canonical extracted data starts as official source rows from the PDF.

Each row should preserve:

- official codes where present;
- full hierarchy path;
- official Georgian label;
- `row_type`, with values such as `detail`, `subtotal`, and `total`;
- all extracted numeric columns;
- source and row-level provenance.

Public app facts are derived later from non-double-counted detail rows plus a separate public spending mapping layer.

## 5. Row Identity

Row identity should be based on official codes plus hierarchy path, not labels alone.

Where available, store separate code fields such as functional code, economic code, institution/program/subprogram code, or any other official code exposed by the PDF table. A stable row identity can then be built from the year, code fields, and normalized hierarchy path.

Labels remain display and audit context. They are not the primary identity because labels can change across years.

## 6. Numeric Values and Units

Extract all numeric columns from the expenditure table.

For each numeric column, keep:

- the raw source value as it appears in the PDF;
- the normalized GEL value;
- the source unit, such as `GEL` or `thousand_gel`.

Normalized GEL means the value is converted to full GEL for app and import calculations. For example, if the PDF is in thousand GEL, source value `1,234.5` becomes normalized value `1,234,500`.

## 7. Provenance

Each extracted row should include row-level provenance:

- source file;
- year;
- page number;
- table index;
- row index;
- optional raw row text when useful for debugging.

The source document itself remains stored in `docs/Raw Data/Expenditure`. Source metadata should continue to live in `data/sources/source-documents.csv` when the source catalog needs to be updated.

## 8. Output Locations

Use the existing project data structure instead of introducing a parallel layout:

- raw official source file: `docs/Raw Data/Expenditure/`;
- extracted official rows: `data/staging/`;
- public spending mapping: `data/mappings/`;
- app-ready facts: `data/imports/`;
- validation and import reports: `data/reports/`;
- category definitions and labels: `data/taxonomy/` and `data/glossary/`.

For the pilot, create separate 2025 PDF outputs so current app data stays untouched until the pipeline is trusted.

Phase 1 pilot outputs should include:

- a 2025 official rows staging CSV;
- a 2025 extraction validation report.

Phase 2 pilot outputs, after the mapping stage is implemented, should include:

- a separate 2025 pilot facts file;
- a 2025 mapping/import validation report.

## 9. Extraction Strategy

Use table extraction first.

The first implementation should inspect the 2025 PDF table layout and prefer a table-aware extractor. A custom text parser is a fallback only if table extraction cannot produce reliable columns. OCR is a last resort and should not be used unless the PDF is image-based or text extraction is unusable.

The pilot scope is the full main expenditure execution table in the 2025 PDF, not a single page or sample section.

## 10. Validation

Validation is strict.

Required checks:

- every recognized expenditure table data row has expected identity fields;
- every expected numeric cell parses successfully;
- all extracted numeric columns reconcile at the grand total level;
- all extracted numeric columns reconcile across parent/child subtotal relationships;
- row types prevent double-counting;
- mapping output reports unclassified detail rows by amount and share.

If extraction or numeric reconciliation fails, the run fails and no app data is updated.

If mapping cannot confidently classify a detail row, the row is assigned to `spending.other_unclassified` and the report records the unclassified amount/share. This preserves totals while making mapping gaps visible.

## 11. Pilot Success Criteria

Phase 1 of the 2025 pilot is successful when:

1. The full 2025 expenditure PDF table is extracted.
2. Every table data row has parsed official identity: codes, path, label, and `row_type`.
3. Every numeric column has raw source value, normalized GEL value, and source unit.
4. Grand total checks pass for every extracted numeric column.
5. Parent/child subtotal checks pass for every extracted numeric column.
6. The pilot writes staging and extraction report outputs without changing existing app data.

Phase 2 is successful when:

1. Unmapped detail rows are explicitly represented as `spending.other_unclassified` in the mapping stage.
2. The validation report includes unclassified amount/share.
3. Separate 2025 pilot facts are generated without changing existing app data.

## 12. Testing and Verification

The implementation plan should define focused tests for:

- parsing representative table rows from the 2025 PDF extraction output;
- numeric parsing and GEL normalization;
- row type classification;
- grand total reconciliation;
- parent/child subtotal reconciliation;
- unmapped-row handling into `spending.other_unclassified`;
- proof that existing app import files are not modified by the pilot run.

After the pilot script runs, verification should inspect the generated staging CSV and validation report before any broader rollout.
