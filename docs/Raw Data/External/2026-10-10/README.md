# External flows: annual research package (remittances, FDI, current account)

Prepared on 10 October 2026 from the unedited capture in `official/` (see `official/README.md`). This is a research foundation only. No page, route, download, MCP tool or serving-database import is authorized by it. Specification: `docs/superpowers/specs/2026-10-09-remittances-investment-data-design.md`. Methodology: `docs/data-methodology/external-flows-annual.md`.

## Files

| File | Content | Years |
| --- | --- | --- |
| `money-transfers-annual.csv` | NBG money transfers through fast transfer systems: national total and every published country or remainder, inflow and outflow. Each annual value is the sum of the twelve published months (`source_cells` lists them). | 2000–2025 |
| `bop-annual.csv` | NBG balance of payments (BPM6): all 37 lines of the short presentation, plus compensation of employees, personal transfers, workers' remittances, personal and total remittances, and direct-investment liabilities by instrument. | 2000–2025 |
| `fdi-flows-annual.csv` | Geostat FDI: annual total, by country (with the three published groups), by NACE section, by component and by region; and Geostat's BPM6 table (balance, assets, liabilities). | Total 1996–2025; countries 1996; regions 2009; components 2013; sectors 2016; BPM6 2000 |
| `fdi-position-annual.csv` | Geostat FDI position at 31 December, by country and by NACE section. | 2015–2025 |
| `shares-of-gdp-annual.csv` | Current-account balance, personal-transfer credit, money-transfer inflow and Geostat FDI as a percentage of nominal GDP in USD (`data/imports/gdp-overview-annual.csv`), with both input references. | GDP from 1996 |
| `money-transfer-country-identities.csv` | Reviewed mapping of every published money-transfer label, per period sheet, to one country identifier. 28 renamed or abbreviated labels are joined; remainders stay separate. | |
| `prepared-reconciliation.csv`, `prepared-validation.json` | Every arithmetic check and cross-table comparison, and the run summary. | |
| `independent-verification.json` | Result of the separate openpyxl reader. | |
| `artifact-manifest.csv` | Row counts and SHA-256 of every generated file. | |

Every value keeps its source file, sheet and cells, unit, publication vintage and status: `numeric`, `blank`, `not_applicable` (Geostat's `-`), or `partial_months` for a money-transfer year where some months are blank (`months_reported` gives the count). A blank or `-` never becomes zero. 2026 values stay in the originals only.

## Results

- 14,851 observations. 1,003 checks pass and none fail.
- 76 comparisons are recorded rather than forced to agree:
  - 26 compare Geostat's FDI total with NBG's direct-investment liabilities. They differ every year, up to USD 192.6 million (2023).
  - 50 compare the REMC monthly sums with NBG's published annual totals in REMM. They differ by at most USD 2,102.
- REMM publishes no 2024 column, so 2024 rests on the REMC monthly sum alone. That sum matches NBG's 2024 publication: USD 3,361.5 million.
- The independent reader finds the same 14,851 source cells and recomputes every value.

## Reproduction

From this folder, with Python 3.11+ and openpyxl for the independent reader:

```
python prepare.py --write
python verify_independent.py
python prepare.py --check
python test_prepare.py
```

`--check` regenerates everything in memory, requires byte equality and requires current, passing independent evidence. All commands are offline and leave the originals untouched. The stored-decimal XLSX reader is reused from the Trade package (`../../Trade/geostat-external-trade/2026-10-07/archive.py`).
