from __future__ import annotations

from pathlib import Path

import openpyxl


EXCEL_DIR = Path("docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025")
FINAL_DIR = Path("docs/Raw Data/Expenditure/mof.ge/final-fact-files-2004-2025")
ERRORS = {"#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A"}


def inspect(path: Path) -> list[dict[str, object]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=False)
    found: list[dict[str, object]] = []
    try:
        for sheet in workbook.worksheets:
            for row in sheet.iter_rows(values_only=False):
                for cell in row:
                    if isinstance(cell.value, str) and cell.value in ERRORS:
                        row_values = []
                        for candidate in sheet[cell.row]:
                            if candidate.value is not None:
                                row_values.append(str(candidate.value)[:120])
                        found.append(
                            {
                                "sheet": sheet.title,
                                "cell": cell.coordinate,
                                "value": cell.value,
                                "row_preview": row_values[:15],
                            }
                        )
                        if len(found) >= 25:
                            return found
    finally:
        workbook.close()
    return found


for year in [2020, 2021, 2022, 2024, 2025]:
    output = EXCEL_DIR / f"{year}-fact.xlsx"
    source_xlsx = FINAL_DIR / f"{year}-fact.xlsx"
    print(f"YEAR {year} output={output}")
    for item in inspect(output):
        print(item)
    if source_xlsx.exists():
        print(f"YEAR {year} source={source_xlsx}")
        for item in inspect(source_xlsx)[:5]:
            print("source", item)
