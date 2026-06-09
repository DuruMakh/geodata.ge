# 2025 Expenditure Final Data Methodology

Status: working methodology after the 2025 extraction and mapping pilot

Scope: national budget expenditure, actual execution, 2025

This document describes how GeoData.ge should move from official raw source files to the final public expenditure facts used by the app. It also records which files are raw official inputs, which files are generated intermediates, how rows are parsed, and how amounts are combined into the public `spending.*` taxonomy.

## 1. Goal

The goal is to produce one reviewed 2025 expenditure facts file for the public Budget Explorer:

```text
data/imports/expenditure-facts-2025-final.csv
```

The final file must:

- use the existing public expenditure taxonomy from `data/taxonomy/spending-fields.json`;
- include exactly the top-level public spending fields used by the app;
- preserve source and mapping metadata;
- reconcile to the official annual expenditure total;
- avoid using parsed staging files as if they were official raw data.

## 2. Raw Official Source Files

Raw source files live under:

```text
docs/Raw Data/Expenditure/
```

For 2025, the current raw inputs are:

```text
docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf
docs/Raw Data/Expenditure/mof.ge/2025.xlsx
```

For existing earlier app years, the annual Excel files are:

```text
docs/Raw Data/Expenditure/mof.ge/2023 12 tve saitistvis.xls
docs/Raw Data/Expenditure/mof.ge/2024 12 თვე საიტისთვის.xlsx
docs/Raw Data/Expenditure/mof.ge/2025.xlsx
```

For future years or older years, the same rule should apply: the official annual Excel file uploaded to `docs/Raw Data/Expenditure/mof.ge/` is the raw source for program/economic rows. Generated staging CSV files are not raw sources.

## 3. Generated Intermediate Files

These files are produced by our scripts and should be treated as intermediate artifacts:

```text
data/staging/expenditure-official-rows-2023-2025.csv
data/staging/expenditure-pdf-official-rows-2025-pilot.csv
data/staging/expenditure-2025-financial-assets-liabilities-supplement.csv
data/mappings/review/spending-field-mapping-review-2025-pdf-pilot.csv
data/reports/expenditure-final-2025-report.json
```

Important rule:

```text
data/staging/expenditure-official-rows-2023-2025.csv is not official raw data.
```

It is a parsed output derived from annual Excel files. The methodology should be reusable for 2022, earlier years, and future years by running the Excel parser against that year's official Excel file.

## 4. Public Taxonomy

The public app does not expose the full official functional/economic classification directly. It exposes reviewed public spending fields.

The category list comes from:

```text
data/taxonomy/spending-fields.json
```

The 2025 final expenditure output currently uses these public fields:

```text
spending.social_protection
spending.health
spending.education
spending.defence
spending.public_order_safety
spending.infrastructure_regional_development
spending.economic_affairs
spending.agriculture_environment
spending.culture
spending.sport
spending.general_public_services
spending.debt_service
spending.other_unclassified
```

Do not create a new public category for financial assets growth or liabilities decrease. Those rows are classified into the existing public spending fields by the purpose of the mapped official program.

## 5. Source Roles

The 2025 final expenditure data uses two source roles.

### 5.1 Functional PDF Source

Source:

```text
docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf
```

Role:

- provides the main functional classification total;
- covers expenses plus non-financial assets growth;
- gives official functional categories such as `7.2`, `7.3`, `7.7`, `7.9`, `7.10`;
- is mapped directly to public `spending.*` fields.

Current verified PDF mapped total:

```text
25,912,205,639 GEL
```

### 5.2 Annual Excel Source

Source:

```text
docs/Raw Data/Expenditure/mof.ge/2025.xlsx
```

Role:

- provides official program/economic rows;
- supplies the expenditure blocks not included in the functional PDF total;
- is the raw source for extracting:
  - `ფინანსური აქტივების ზრდა`
  - `ვალდებულებების კლება`

Current verified supplement total:

```text
1,811,113,400 GEL
```

Breakdown:

```text
ვალდებულებების კლება: 1,418,282,100 GEL
ფინანსური აქტივების ზრდა: 392,831,300 GEL
```

## 6. PDF Parsing Process

Code:

```text
apps/web/lib/data/realExpenditurePdf/phase1Pilot.ts
apps/web/scripts/extract-expenditure-pdf-pilot.ts
```

Process:

1. Read the official PDF.
2. Verify the expected SHA-256 hash.
3. Attempt table extraction.
4. If table extraction does not produce usable tables, use text fallback.
5. Parse page text into official row segments.
6. Keep only rows needed for public mapping:
   - grand total rows;
   - functional total rows.
7. Exclude economic breakdown rows such as:
   - `2.*`
   - `31`
8. Preserve:
   - source id;
   - source file;
   - year;
   - form id;
   - functional code;
   - hierarchy path;
   - Georgian label;
   - actual amount;
   - raw row text.
9. Write the parsed PDF rows to:

```text
data/staging/expenditure-pdf-official-rows-2025-pilot.csv
```

Validation:

- top-level functional totals must reconcile to the PDF grand total within 1,000 GEL;
- no source row needed for public mapping should disappear silently.

## 7. PDF Functional Mapping Process

Code:

```text
apps/web/lib/data/realExpenditurePdf/publicMapping.ts
```

Output:

```text
data/mappings/review/spending-field-mapping-review-2025-pdf-pilot.csv
```

Process:

1. Take parsed PDF functional rows.
2. Apply reviewed functional-code mapping rules.
3. Emit compact public mapping rows with:
   - functional code;
   - hierarchy path;
   - Georgian label;
   - amount;
   - public spending field id;
   - mapping confidence;
   - mapping reason;
   - include/exclude flag.

Key reviewed decisions:

```text
7.1.6 -> spending.debt_service
7.1.7 -> spending.infrastructure_regional_development
7.2   -> spending.defence
7.3   -> spending.public_order_safety
7.4.2 -> spending.agriculture_environment
7.4.4 -> spending.economic_affairs
7.4.5 -> spending.infrastructure_regional_development
7.5   -> spending.agriculture_environment
7.6   -> spending.infrastructure_regional_development
7.7   -> spending.health
7.8.1 -> spending.sport
7.8.2 -> spending.culture
7.8.3 -> spending.culture
7.8.4 -> spending.culture
7.8.6 -> spending.culture
7.9   -> spending.education
7.10  -> spending.social_protection
```

Validation:

- sum of included mapped rows must match the PDF grand total within 1,000 GEL.

## 8. Excel Parsing Process

The annual Excel file is the raw source for official program/economic rows.

For 2025:

```text
docs/Raw Data/Expenditure/mof.ge/2025.xlsx
```

Current parser/script family:

```text
apps/web/scripts/extract-real-expenditure.ts
```

Current generated staging output:

```text
data/staging/expenditure-official-rows-2023-2025.csv
```

Reusable rule for future years:

1. Add the official annual Excel file to `docs/Raw Data/Expenditure/`.
2. Parse the Excel file into normalized official rows.
3. Preserve official program code, labels, hierarchy state, year, source id, and actual amounts.
4. Generate a staging CSV for review.
5. Never treat that staging CSV as the raw source; it must be reproducible from the Excel file.

The parser must preserve enough row structure to identify a current coded program row and the economic rows that belong under it.

## 9. Supplement Extraction Process

Code:

```text
apps/web/lib/data/realExpenditurePdf/final2025Data.ts
apps/web/scripts/generate-final-2025-expenditure-data.ts
```

Current supplement output:

```text
data/staging/expenditure-2025-financial-assets-liabilities-supplement.csv
```

Process:

1. Parse the annual Excel raw file into official staging rows.
2. Walk the official rows in source order.
3. Track the current coded program row.
4. When a child row has one of these economic labels, extract it:

```text
ფინანსური აქტივების ზრდა
ვალდებულებების კლება
```

5. Attach the extracted amount to the current official program code.
6. Map that program code through the reviewed program mapping file:

```text
data/mappings/review/spending-field-mapping-review-2023-2025.csv
```

7. Write supplement rows with:
   - year;
   - source id;
   - official program code;
   - official program label;
   - economic label;
   - amount;
   - public spending field id;
   - mapping confidence;
   - mapping notes.

Classification rule:

- `ვალდებულებების კლება` is usually debt principal repayment and mostly maps to `spending.debt_service`, but each row still follows its reviewed program mapping.
- `ფინანსური აქტივების ზრდა` is not normal operating spending and not a new public category. It is classified by the purpose of the official program row, for example infrastructure, defence, economic affairs, or agriculture/environment.

## 10. Final Composition Process

Code:

```text
apps/web/lib/data/realExpenditurePdf/final2025Data.ts
apps/web/scripts/generate-final-2025-expenditure-data.ts
```

Final output:

```text
data/imports/expenditure-facts-2025-final.csv
```

Report:

```text
data/reports/expenditure-final-2025-report.json
```

Composition formula:

```text
final expenditure facts
= mapped PDF functional total
+ mapped financial assets growth supplement
+ mapped liabilities decrease supplement
```

Current verified 2025 totals:

```text
PDF mapped total: 25,912,205,639 GEL
Supplement total: 1,811,113,400 GEL
Final total: 27,723,319,039 GEL
Workbook total: 27,723,319,200 GEL
Difference: 161 GEL
```

The 161 GEL difference is rounding-level and passes the current reconciliation tolerance.

## 11. Final Output Row Semantics

Each final public fact row should contain:

```text
year
side
item_id
amount_gel
basis
source_id
official_institution
official_program
official_subprogram
public_spending_field_id
mapping_confidence
mapping_notes
```

For the 2025 final output:

```text
source_id = source.mof_2025_expenditure_pdf_e11_plus_tavi6_supplement_actual
basis = actual
side = expenditure
```

The `mapping_notes` field should state how many PDF rows and supplement rows contributed to the public category:

```text
PDF mapped rows: N; workbook financial-asset/liability supplement rows: N
```

## 12. Category-Level Lineage

Each final public category can be built from one or both source roles.

Examples from the current 2025 output:

```text
spending.social_protection
  Source: PDF functional mapping only

spending.health
  Source: PDF functional mapping only

spending.infrastructure_regional_development
  Source: PDF functional mapping + Excel supplement rows

spending.defence
  Source: PDF functional mapping + Excel supplement rows

spending.debt_service
  Source: PDF functional mapping + Excel supplement rows

spending.other_unclassified
  Source: explicit public fallback category
  Current 2025 amount: 0 GEL
```

The exact source-row counts are recorded in `data/imports/expenditure-facts-2025-final.csv`.

## 13. Validation Gates

A final expenditure run should not be accepted unless these checks pass:

```text
1. Raw PDF hash matches expected hash.
2. PDF functional totals reconcile to the PDF grand total within 1,000 GEL.
3. PDF compact mapping reconciles to the PDF grand total within 1,000 GEL.
4. Annual Excel parser can reproduce the needed program/economic rows.
5. Supplement extraction finds financial assets growth and liabilities decrease rows from the Excel-derived official rows.
6. Every supplement row with an amount maps to a reviewed public spending field, or explicitly maps to spending.other_unclassified.
7. Final total reconciles to the annual Excel workbook total within 1,000 GEL.
8. Final output has the same expenditure category list as data/taxonomy/spending-fields.json.
9. Georgian CSV outputs include UTF-8 BOM for Excel compatibility.
```

Current verification commands:

```powershell
cd apps/web
npx.cmd vitest run --configLoader native --reporter=verbose tests/data/realExpenditurePdf/final2025Data.test.ts tests/data/realExpenditurePdf/publicMapping.test.ts tests/data/realExpenditurePdf/phase1Pilot.test.ts
npm.cmd run data:generate-final-2025-expenditure
```

On this Windows setup, `tsx`-backed scripts may fail inside the sandbox with `spawn EPERM`. If that happens, rerun the same command outside the sandbox before treating it as a pipeline failure.

## 14. Reusable Workflow For Another Year

Use this process for 2022, earlier years, or future years.

1. Add official raw sources:

```text
docs/Raw Data/Expenditure/treasury.ge/<YEAR>-12-month-state-budget-functional-expenditure.pdf
docs/Raw Data/Expenditure/mof.ge/<YEAR annual expenditure workbook>.xls or .xlsx
```

2. Record source metadata:

```text
year
source id
file path
SHA-256 hash
source URL, if available
period
basis
```

3. Parse the functional PDF:

```text
PDF -> parsed functional rows -> compact public PDF mapping
```

4. Parse the annual Excel workbook:

```text
Excel -> normalized official program/economic rows -> staging CSV
```

5. Review or update mappings:

```text
functional PDF mapping for 7.* codes
program/economic row mapping for supplement rows
```

6. Extract supplements:

```text
ფინანსური აქტივების ზრდა
ვალდებულებების კლება
```

7. Compose final facts:

```text
PDF mapped public totals + Excel supplement public totals
```

8. Validate reconciliation:

```text
PDF total
Excel workbook total
final public fact total
unclassified amount
category count
```

9. Write final import output:

```text
data/imports/expenditure-facts-<YEAR>-final.csv
```

10. Write final methodology/report output:

```text
data/reports/expenditure-final-<YEAR>-report.json
```

## 15. Open Implementation Improvement

The current 2025 final generator still reads this intermediate file:

```text
data/staging/expenditure-official-rows-2023-2025.csv
```

That is acceptable only as a current implementation shortcut because the file is generated from official annual Excel sources. For a reusable yearly workflow, the next improvement should be:

```text
annual Excel raw file -> parser -> in-memory official rows -> supplement extraction
```

Then the staging CSV remains an inspectable output, not an input dependency.

## 16. Source Trust Rule

When explaining final data lineage, use this language:

```text
The final 2025 expenditure facts are reviewed public-category aggregates built from official Ministry of Finance/Treasury source documents. The functional PDF supplies the main functional expenditure total. The annual Excel workbook supplies financial-assets-growth and liabilities-decrease rows that are outside the PDF functional total but included in the annual expenditure workbook total. Generated staging CSVs are parser outputs used for review and validation, not official raw data.
```
