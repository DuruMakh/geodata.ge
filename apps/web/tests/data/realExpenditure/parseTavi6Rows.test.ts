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

  it("handles older workbooks with a blank label header", () => {
    const matrix = [
      ["2018 title", null, null, null, null],
      ["thousand GEL", null, null, null, null],
      ["კოდი", "", "2018 approved", "2018 revised", "2018 ფაქტიური შესრულება"],
      ["00 00", "სულ ჯამი", 12491100, 12491100, 12590181.62203],
      ["", "ხარჯები", 9915543.2, 9526424.854, 9543712.67651],
      ["24 14", "ელექტროგადამცემი ქსელი", 1, 2, 3],
    ];

    const rows = parseTavi6Rows({
      year: 2018,
      sourceId: "source.mof_2018_tavi6_actual",
      workbookPath: "docs/Raw Data/Expenditure/mof.ge/2018-tavi-VI.xlsx",
      sheetName: "Sheet1",
      matrix,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 4,
          code: "00 00",
          labelKa: "სულ ჯამი",
          actualThousandGel: 12590181.62203,
        }),
        expect.objectContaining({
          rowNumber: 6,
          code: "24 14",
          labelKa: "ელექტროგადამცემი ქსელი",
          actualThousandGel: 3,
        }),
      ]),
    );
  });

  it("parses comma-formatted numeric strings", () => {
    const matrix = [
      ["კოდი", "დასახელება", "2020 approved", "2020 revised", "2020 ფაქტი", "შესრულება"],
      [null, null, null, null, null, "%"],
      ["00 00", "სულ ჯამი", "15,923,792.9", "15,923,792.9", "16,174,636.1", "101.6%"],
      [null, "ხარჯები", "12,556,416.5", "12,586,545.1", "12,533,887.9", "99.6%"],
    ];

    const rows = parseTavi6Rows({
      year: 2020,
      sourceId: "source.mof_2020_tavi6_actual",
      workbookPath: "docs/Raw Data/Expenditure/mof.ge/2020-tavi-VI.xlsx",
      sheetName: "Sheet1",
      matrix,
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        code: "00 00",
        approvedPlanThousandGel: 15923792.9,
        revisedPlanThousandGel: 15923792.9,
        actualThousandGel: 16174636.1,
        executionPercent: 101.6,
      }),
    );
  });

  it("handles sheets that start directly with the total row", () => {
    const matrix = [
      ["A", "00 00", "სულ ჯამი", 20186021, 20186021, 20163012.51022, 0.99886],
      ["A", "", "ხარჯები", 15342926.8, 15403468.573, 15350159.0694, 0.9965],
      ["A", "01 00", "საქართველოს პარლამენტი", 68035.9, 68035.9, 65390.81381, 0.9611],
    ];

    const rows = parseTavi6Rows({
      year: 2022,
      sourceId: "source.mof_2022_tavi6_actual",
      workbookPath: "docs/Raw Data/Expenditure/mof.ge/2022 redaqtirenadi 12 Tve.xls",
      sheetName: "VI",
      matrix,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        rowNumber: 1,
        code: "00 00",
        labelKa: "სულ ჯამი",
        actualThousandGel: 20163012.51022,
      }),
      expect.objectContaining({
        rowNumber: 2,
        code: null,
        labelKa: "ხარჯები",
      }),
      expect.objectContaining({
        rowNumber: 3,
        code: "01 00",
        labelKa: "საქართველოს პარლამენტი",
      }),
    ]);
  });
});
