import { describe, expect, it } from "vitest";
import { parseTavi6Rows } from "../../../lib/data/realExpenditure/parseTavi6Rows";

describe("parseTavi6Rows", () => {
  it("parses coded rows and multiplies no values during raw extraction", () => {
    const matrix = [
      [null, null, null, null, null, null],
      [null, "კოდი", "დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
      [null, "00 00", "სულ ჯამი", 100, 100, 110, 1.1],
      [null, "01 00", "საქართველოს პარლამენტი", 10, 11, 12, 1.09],
      [null, null, "ხარჯები", 8, 9, 10, 1.11],
      [null, "01 01", "საკანონმდებლო საქმიანობა", 4, 5, 6, 1.2],
    ];

    const rows = parseTavi6Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi6_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi 6",
      matrix,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 3,
          code: "00 00",
          labelKa: "სულ ჯამი",
          actualThousandGel: 110,
          isTotal: true,
          isLeafCode: false,
        }),
        expect.objectContaining({
          rowNumber: 5,
          code: null,
          labelKa: "ხარჯები",
          isCodedRow: false,
        }),
        expect.objectContaining({
          rowNumber: 6,
          code: "01 01",
          parentCode: "01 00",
          isLeafCode: true,
        }),
      ]),
    );
  });

  it("handles the 2023 workbook leading marker column", () => {
    const matrix = [
      [null, "კოდი", "დასახელება", "2023 წლის დამტკიცებული გეგმა", "2023 წლის დაზუსტებული გეგმა", "2023 წლის ფაქტი", "შესრულება %"],
      ["A", "00 00", "სულ ჯამი", 100, 100, 100, 1],
      ["A", "01 00", "ინსტიტუცია", 25, 25, 25, 1],
    ];

    const rows = parseTavi6Rows({
      year: 2023,
      sourceId: "source.mof_2023_tavi6_actual",
      workbookPath: "docs/Raw Data/2023 12 tve saitistvis.xls",
      sheetName: "VI თავი",
      matrix,
    });

    expect(rows.map((row) => row.code)).toEqual(["00 00", "01 00"]);
  });
});
