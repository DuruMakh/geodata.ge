from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import openpyxl


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "mof_programmatic_extraction"))

from extract_2005_fact_from_2006_december_budget import extract_pdf_rows as extract_2005_rows  # noqa: E402
from extract_annex_programmatic_rows import extract_pdf_rows as extract_annex_rows  # noqa: E402


OLD_FACTS = REPO_ROOT / "docs" / "Raw Data" / "Expenditure" / "mof.ge" / "old" / "12-month-facts-2004-2025"
EXCEL_DIR = REPO_ROOT / "docs" / "Raw Data" / "Expenditure" / "mof.ge" / "excel-fact-files-2004-2025"
WORK_DIR = Path(__file__).resolve().parent


HEADERS_2005 = [
    "year",
    "source_page",
    "page_row_index",
    "code",
    "parent_code",
    "row_kind",
    "label",
    "fact_2005",
    "plan_2006",
    "budget_funds_2006",
    "credits_and_grants_2006",
]

HEADERS_ANNEX = [
    "year",
    "source_page",
    "page_row_index",
    "code",
    "parent_code",
    "row_kind",
    "label",
    "total_plan",
    "total_actual",
    "total_variance",
    "cofinancing_plan",
    "cofinancing_actual",
    "cofinancing_variance",
    "grants_and_credits_plan",
    "grants_and_credits_actual",
    "grants_and_credits_variance",
    "grants_plan",
    "grants_actual",
    "grants_variance",
    "credits_plan",
    "credits_actual",
    "credits_variance",
]


def clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        text = " ".join(value.replace("\n", " ").split())
        return text if text else None
    return value


def workbook_rows(path: Path) -> list[list[Any]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook["rows"]
        return [[clean(value) for value in row] for row in sheet.iter_rows(values_only=True)]
    finally:
        workbook.close()


def expected_rows(headers: list[str], rows: list[dict[str, Any]]) -> list[list[Any]]:
    return [headers] + [[clean(row.get(header)) for header in headers] for row in rows]


def compare(expected: list[list[Any]], actual: list[list[Any]]) -> dict[str, Any]:
    max_rows = max(len(expected), len(actual))
    mismatch_count = 0
    examples = []
    for index in range(max_rows):
        left = expected[index] if index < len(expected) else None
        right = actual[index] if index < len(actual) else None
        if left != right:
            mismatch_count += 1
            if len(examples) < 10:
                examples.append({"row": index + 1, "expected": left, "actual": right})
    return {
        "expected_rows": len(expected),
        "actual_rows": len(actual),
        "mismatch_count": mismatch_count,
        "mismatch_examples": examples,
    }


def main() -> int:
    report: dict[str, Any] = {"years": {}, "failures": []}

    pdf_2005 = OLD_FACTS / "2005-programmatic-budget-law-from-2006-december" / "sources" / "2005-fact-from-2006-december-tavi-iv.pdf"
    rows_2005 = extract_2005_rows(pdf_2005)
    actual_2005 = workbook_rows(EXCEL_DIR / "2005-fact.xlsx")
    report["years"]["2005"] = {
        "source_pdf": str(pdf_2005.relative_to(REPO_ROOT)),
        "parsed_rows": len(rows_2005),
        "comparison": compare(expected_rows(HEADERS_2005, rows_2005), actual_2005),
    }

    annex_source = OLD_FACTS / "2006-2011-programmatic-annexes" / "sources"
    for year in range(2006, 2012):
        pdf = annex_source / f"{year}-annex.pdf"
        parsed = extract_annex_rows(year, pdf)
        actual = workbook_rows(EXCEL_DIR / f"{year}-fact.xlsx")
        report["years"][str(year)] = {
            "source_pdf": str(pdf.relative_to(REPO_ROOT)),
            "parsed_rows": len(parsed),
            "comparison": compare(expected_rows(HEADERS_ANNEX, parsed), actual),
        }

    for year, result in report["years"].items():
        if result["comparison"]["mismatch_count"]:
            report["failures"].append(f"{year}: extracted PDF rows differ from final Excel")

    output = WORK_DIR / "mof_2005_2011_pdf_grounding_report.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"report={output}")
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
