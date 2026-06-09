# GeoData.ge Expenditure PDF Pipeline Design

Date: 2026-06-06
Status: Draft for user review

## 1. Goal

Build a strict pilot pipeline that turns the 2025 Treasury expenditure PDF into separate staged project data without changing existing app data during the pilot.

The pilot source is:

```text
docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf
```

The 2025 PDF pipeline is a separate staged pilot source. It does not replace the current reviewed `2017-2025` expenditure pipeline until the PDF extraction, mapping, and validation outputs are reviewed and explicitly promoted.

After the 2025 pilot works, the rollout order is:

```text
2025 -> 2024 -> 2023 -> 2016-2022
```

Every rollout remains an internal extraction plus review workflow. No unchecked PDF extraction output may update production app imports.

## 2. Non-Goals

This design does not add a public UI feature.

This design does not replace existing `2017-2025` app data during the pilot.

This design does not use `2025.xlsx` as a pipeline source. The workbook comparison is required once for the 2025 pilot as diagnostic evidence, but the workbook is not a future source of truth for this PDF pipeline because it has a different data structure.

This design does not make the parser responsible for assigning public `spending.*` categories. Mapping is a separate stage.

This design does not approve automated production extraction from PDFs. Promotion to app imports requires reviewed mapping and passed validation reports.

## 3. Chosen Approach

Use a mostly automated pilot pipeline with strict validation:

```text
Treasury PDF -> table extraction -> official source rows CSV -> extraction validation report -> separate mapping/import pilot outputs
```

The pipeline is fail-closed for extraction and reconciliation errors. If table rows cannot be parsed, required numeric values fail to parse, additive monetary totals do not reconcile, or derived rate columns do not validate, the run fails and app data is not updated.

Mapping uncertainty is handled separately. Unmapped detail rows must be explicitly assigned to `spending.other_unclassified` by the mapping stage and reported by amount and share. They must not disappear from totals.

## 4. Data Grain and Row Rules

The canonical extracted data starts as official source rows from the PDF.

Each row should preserve:

- official codes where present;
- full hierarchy path;
- official Georgian label;
- `row_type`;
- all accepted numeric columns;
- source and row-level provenance.

Allowed `row_type` values:

- `grand_total`: the one overall table total row.
- `subtotal`: coded or labeled parent rows that aggregate children.
- `detail`: leaf rows eligible for public mapping/facts.
- `context`: headers, section labels, repeated table headers, notes, or other rows retained only for provenance/debugging.

Only non-double-counted detail rows may feed public mapping and pilot facts:

```text
include_in_public_mapping =
  row_type == "detail"
  && is_coded_row == true
  && is_leaf_code == true
  && is_total == false
```

This mirrors the current workbook pipeline's effective public-fact filter: coded leaf rows that are not totals. Rows outside that rule may be stored and used for validation, but they must not be aggregated into public facts.

## 5. Row Identity

Row identity should be based on official codes plus hierarchy path, not labels alone.

Normalize identity inputs before generating IDs:

- trim and collapse whitespace in codes and labels;
- normalize Unicode text consistently;
- remove page-break artifacts from hierarchy labels;
- normalize repeated table header text out of hierarchy paths.

Preferred identity:

```text
year + form_id + official code fields + normalized hierarchy_path
```

Store separate code fields where available, such as functional code, economic code, institution/program/subprogram code, or any other official code exposed by the PDF table.

Fallback identity is allowed only for rows without usable official codes:

```text
year + page_number + table_index + row_index + hash(normalized_label + accepted monetary raw values)
```

Fallback rows must be marked with `identity_confidence = "fallback"` and require review before they can enter public mapping. Labels remain display and audit context; they are not the primary identity.

## 6. Numeric Values, Units, and Schema

Use a wide staging CSV schema, matching the current workbook staging style: one official PDF row per CSV row, with separate columns for each accepted measure.

For monetary columns, keep raw source values, thousand-GEL values, and normalized full-GEL values:

```text
approved_plan_raw
approved_plan_thousand_gel
approved_plan_gel
revised_plan_raw
revised_plan_thousand_gel
revised_plan_gel
actual_raw
actual_thousand_gel
actual_gel
```

For rate columns, keep raw and parsed values but do not treat them as additive:

```text
execution_percent_raw
execution_percent
```

The expected source unit for the 2025 expenditure PDF pilot is `thousand_gel` unless table inspection proves otherwise. Normalized GEL is:

```text
normalized_gel = Math.round(thousand_gel * 1000)
```

Additive monetary columns reconcile by summing. Percentage or execution-rate columns validate as derived values and are never reconciled by summing.

Validation tolerances:

- monetary subtotal/grand-total tolerance: `<= 1000 GEL` per check, to allow thousand-GEL rounding;
- rate tolerance: `<= 0.0001` when stored as a ratio, or `<= 0.01 percentage points` when stored as percent text.

## 7. Provenance and Source Metadata

Each extracted row should include row-level provenance:

- `source_id`;
- `source_file`;
- `year`;
- `form_id`;
- `table_title`;
- `page_number`;
- `table_index`;
- `row_index`;
- optional `raw_row_text` when useful for debugging.

The 2025 pilot source metadata is:

```text
source_id: source.mof_2025_expenditure_pdf_form_e11_actual
source_path: docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf
source_sha256: 1B680A253394C689703BE0279F41860AFEB6EF8D6791D5E42F5BE8C70FF39EAD
source_file_id: cb40ddb8-11f6-4da3-b411-b5a7b565e07b
source_reviewed_at: 2026-06-06
form_id: E11
```

The implementation must inspect and record `table_title`, `page_start`, and `page_end` before parsing. Those fields should appear in the extraction report and source metadata if the source catalog is updated.

The source document itself remains stored in `docs/Raw Data/Expenditure/treasury.ge`. Source catalog updates should continue to use `data/sources/source-documents.csv`.

## 8. Output Locations

Use the existing project data structure instead of introducing a parallel layout:

- raw official source file: `docs/Raw Data/Expenditure/treasury.ge/`;
- extracted official rows: `data/staging/`;
- public spending mapping: `data/mappings/`;
- app-ready facts: `data/imports/`;
- validation and import reports: `data/reports/`;
- category definitions and labels: `data/taxonomy/` and `data/glossary/`.

The pilot must use PDF-specific filenames and must not overwrite current `2017-2025` files.

Phase 1 pilot outputs:

```text
data/staging/expenditure-pdf-official-rows-2025-pilot.csv
data/reports/expenditure-pdf-extraction-report-2025-pilot.json
data/reports/expenditure-pdf-vs-workbook-2025-pilot-report.json
```

Phase 2 pilot outputs, after the mapping stage is implemented:

```text
data/mappings/review/spending-field-mapping-review-2025-pdf-pilot.csv
data/imports/expenditure-facts-2025-pdf-pilot.csv
data/reports/expenditure-pdf-import-report-2025-pilot.json
```

The existing files below are not pilot outputs and must not be modified by the pilot:

```text
data/staging/expenditure-official-rows-2017-2025.csv
data/imports/expenditure-facts-2017-2025.csv
data/imports/budget-facts-2017-2025.csv
```

## 9. Extraction Strategy

Use table extraction first.

The first implementation should inspect the 2025 PDF table layout and prefer a table-aware extractor. A custom text parser is a fallback only if table extraction cannot produce reliable columns. OCR is a last resort and should not be used unless the PDF is image-based or text extraction is unusable.

Before parsing, record the exact extraction boundary:

- form ID;
- table title;
- inclusive page range;
- repeated header/footer patterns;
- excluded cover pages, notes, unrelated forms, and non-table text.

The pilot scope is the full main expenditure execution table in the 2025 PDF, not a single page or sample section. Prior inspection identifies this as Form `E11`, but the implementation must still verify the table title and page range from the PDF before extracting rows.

Reliable columns acceptance criteria:

- headers are matched consistently across table pages;
- required code, label, and actual columns are identified;
- required actual cells parse for every accepted data row;
- additive monetary columns pass grand-total and parent/child reconciliation;
- derived rate columns match recomputed values within tolerance;
- columns failing these checks are not accepted for normalized output.

## 10. Validation

Validation is strict.

Required checks:

- every recognized expenditure table data row has expected identity fields;
- every accepted data row has a parsed label and required actual value;
- accepted monetary columns parse into raw, thousand-GEL, and normalized-GEL values;
- additive monetary columns reconcile at the grand-total level;
- additive monetary columns reconcile across parent/child subtotal relationships;
- derived percentage/rate columns validate against recomputed values and are not summed;
- row types and `include_in_public_mapping` prevent double-counting;
- the 2025 diagnostic workbook comparison report is generated;
- mapping output reports unclassified detail rows by amount and share.

If extraction, numeric parsing, monetary reconciliation, or derived-rate validation fails, the run fails and no app data is updated.

If mapping cannot confidently classify a detail row, the row is assigned to `spending.other_unclassified` and the report records the unclassified amount/share. This preserves totals while making mapping gaps visible.

## 11. Pilot Success Criteria

Phase 1 of the 2025 pilot is successful when:

1. The source PDF hash matches the recorded source metadata.
2. The full 2025 expenditure PDF table boundary is recorded: form ID, table title, and page range.
3. The full table is extracted into `data/staging/expenditure-pdf-official-rows-2025-pilot.csv`.
4. Every accepted table data row has parsed official identity: codes or fallback identity, path, label, `row_type`, and `include_in_public_mapping`.
5. Every accepted monetary column has raw source value, thousand-GEL value, normalized-GEL value, and source unit.
6. Additive monetary grand-total checks pass within tolerance.
7. Additive monetary parent/child subtotal checks pass within tolerance.
8. Derived percentage/rate checks pass within tolerance.
9. The 2025 diagnostic workbook comparison report is written.
10. The pilot writes staging and extraction report outputs without changing existing app data.

Phase 2 is successful when:

1. Unmapped detail rows are explicitly represented as `spending.other_unclassified` in the mapping stage.
2. The validation report includes unclassified amount/share.
3. Separate 2025 pilot facts are generated without changing existing app data.

## 12. Testing and Verification

The implementation plan should define focused tests for:

- source hash checking;
- table-boundary detection and exclusion of repeated headers/footers;
- parsing representative table rows from the 2025 PDF extraction output;
- numeric parsing and GEL normalization;
- additive monetary reconciliation;
- derived rate validation;
- row type classification and `include_in_public_mapping`;
- fallback identity marking;
- unmapped-row handling into `spending.other_unclassified`;
- proof that existing app import files are not modified by the pilot run.

After the pilot script runs, verification should inspect the generated staging CSV, extraction report, workbook diagnostic report, and import/mapping report before any broader rollout.
