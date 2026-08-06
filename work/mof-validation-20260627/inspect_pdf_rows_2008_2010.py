from __future__ import annotations

from pathlib import Path

import pdfplumber


ROOT = Path("docs/Raw Data/Expenditure/mof.ge/old/12-month-facts-2004-2025/2006-2011-programmatic-annexes/sources")


for year, page_number, target_row in [(2008, 12, 41), (2010, 15, 11)]:
    path = ROOT / f"{year}-annex.pdf"
    print("====", year, path, "page", page_number, "row", target_row)
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[page_number - 1]
        table = page.extract_table()
        for idx in range(max(0, target_row - 4), min(len(table), target_row + 3)):
            print(idx + 1, table[idx])
