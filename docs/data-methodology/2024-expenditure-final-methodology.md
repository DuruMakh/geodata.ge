# 2024 Expenditure Final Data Methodology

Status: working methodology after 2024 extraction and mapping

Scope: national budget expenditure, actual execution, 2024

This document records the 2024 run of the same PDF-plus-workbook supplement process documented in `docs/data-methodology/2025-expenditure-final-methodology.md`.

## Raw Official Sources

```text
docs/Raw Data/Expenditure/treasury.ge/2024-12-month-state-budget-functional-expenditure.pdf
docs/Raw Data/Expenditure/mof.ge/2024 12 თვე საიტისთვის.xlsx
```

The 2024 PDF SHA-256 used by the importer is:

```text
DAA2BD22D7F0A43BF7738EA288FA159BB43C3F6F7228D3A9B4CADEB7835BCEC3
```

## Important 2024 PDF Column Difference

The 2024 E11 PDF has four monetary columns:

```text
წლიური ასიგნება
გადახდა
წლიური ვალდებულება
წლის რესურსი
```

For public actual expenditure, the run uses `გადახდა`, which is the second monetary value in each parsed row (`actualAmountIndex = 1`).

This differs from the 2025 E11 PDF, where the payment/actual value is the third monetary value because the PDF includes an additional plan column before payment.

## Generated Outputs

```text
data/staging/expenditure-pdf-official-rows-2024-pilot.csv
data/mappings/review/spending-field-mapping-review-2024-pdf-pilot.csv
data/staging/expenditure-2024-financial-assets-liabilities-supplement.csv
data/imports/expenditure-facts-2024-final.csv
data/reports/expenditure-pdf-extraction-report-2024-pilot.json
data/reports/expenditure-pdf-vs-workbook-2024-pilot-report.json
data/reports/expenditure-final-2024-report.json
```

## Validation Totals

```text
PDF mapped total: 24,291,078,745 GEL
Workbook financial-assets/liabilities supplement: 1,655,264,173 GEL
Final total: 25,946,342,918 GEL
Workbook total: 25,946,342,917 GEL
Difference: 1 GEL
```

The 1 GEL difference is rounding-level and passes the current 1,000 GEL reconciliation tolerance.

## Commands

Run from `apps/web`:

```powershell
npm.cmd run data:extract-expenditure-pdf-2024
npm.cmd run data:generate-final-2024-expenditure
```

On this Windows setup, `tsx` can hit `spawn EPERM` inside the sandbox. If that happens, rerun the same command outside the sandbox before treating it as a pipeline failure.
