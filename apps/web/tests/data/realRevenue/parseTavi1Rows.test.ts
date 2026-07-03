import { describe, expect, it } from "vitest";
import { parseTavi1Rows } from "../../../lib/data/realRevenue/parseTavi1Rows";

describe("parseTavi1Rows", () => {
  it("parses 2025 tavi 1 rows without a marker column", () => {
    const matrix = [
      [null, null, null, null, null],
      [
        "დასახელება",
        "2025 წლის დამტკიცებული გეგმა",
        "2025 წლის დაზუსტებული გეგმა",
        "2025 წლის ფაქტი",
        "შესრულება %",
      ],
      ["შემოსავლები", 100, 110, 120, 1.09],
      ["გადასახადები", 80, 85, 90, 1.06],
      ["ხარჯები", 70, 75, 76, 1.01],
      ["სხვა ჩანაწერი", 1, 2, 3, 1.5],
    ];

    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        rowNumber: 3,
        labelKa: "შემოსავლები",
        section: "revenues",
        approvedPlanThousandGel: 100,
        revisedPlanThousandGel: 110,
        actualThousandGel: 120,
        executionPercent: 1.09,
      }),
      expect.objectContaining({
        rowNumber: 4,
        labelKa: "გადასახადები",
        section: "revenues",
      }),
      expect.objectContaining({
        rowNumber: 5,
        labelKa: "ხარჯები",
        section: "expenditures",
      }),
      expect.objectContaining({
        rowNumber: 6,
        labelKa: "სხვა ჩანაწერი",
        section: "expenditures",
      }),
    ]);
  });

  it("parses 2023 tavi I rows with a leading marker column", () => {
    const matrix = [
      [
        null,
        "დასახელება",
        "2023 წლის დამტკიცებული გეგმა",
        "2023 წლის დაზუსტებული გეგმა",
        "2023 წლის ფაქტი",
        "შესრულება %",
      ],
      ["A", "გრანტები", 10, 11, 12, 1.09],
      ["A", "სხვა შემოსავლები", 20, 21, 22, 1.05],
    ];

    const rows = parseTavi1Rows({
      year: 2023,
      sourceId: "source.mof_2023_tavi1_actual",
      workbookPath: "docs/Raw Data/2023 12 tve saitistvis.xls",
      sheetName: "I თავი",
      matrix,
    });

    expect(rows.map((row) => row.labelKa)).toEqual(["გრანტები", "სხვა შემოსავლები"]);
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 3]);
    expect(rows.every((row) => row.section === "revenues")).toBe(true);
  });

  it("classifies revenue and financing section rows without dropping formatted numeric strings", () => {
    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        [
          "დასახელება",
          "2025 წლის დამტკიცებული გეგმა",
          "2025 წლის დაზუსტებული გეგმა",
          "2025 წლის ფაქტი",
          "შესრულება %",
        ],
        ["დამატებული ღირებულების გადასახადი", "1 000", "1,100", "1\u00a0234.5", "99%"],
        ["საშემოსავლო გადასახადი", 100, 110, 120, 1.09],
        ["მოგების გადასახადი", 100, 110, 120, 1.09],
        ["აქციზის გადასახადი", 100, 110, 120, 1.09],
        ["იმპორტის გადასახადი", 100, 110, 120, 1.09],
        ["ქონების გადასახადი", 100, 110, 120, 1.09],
        ["სხვა გადასახადები", 100, 110, 120, 1.09],
        ["არაფინანსური აქტივების კლება", 100, 110, 120, 1.09],
        ["ფინანსური აქტივების კლება", 100, 110, 120, 1.09],
        ["ვალდებულებების ზრდა", 100, 110, 120, 1.09],
      ],
    });

    expect(rows.map((row) => [row.labelKa, row.section])).toEqual([
      ["დამატებული ღირებულების გადასახადი", "revenues"],
      ["საშემოსავლო გადასახადი", "revenues"],
      ["მოგების გადასახადი", "revenues"],
      ["აქციზის გადასახადი", "revenues"],
      ["იმპორტის გადასახადი", "revenues"],
      ["ქონების გადასახადი", "revenues"],
      ["სხვა გადასახადები", "revenues"],
      ["არაფინანსური აქტივების კლება", "non_financial_assets"],
      ["ფინანსური აქტივების კლება", "financial_assets"],
      ["ვალდებულებების ზრდა", "liabilities"],
    ]);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        approvedPlanThousandGel: 1000,
        revisedPlanThousandGel: 1100,
        actualThousandGel: 1234.5,
        executionPercent: 0.99,
      }),
    );
  });

  it("uses parent context for real workbook financing child rows", () => {
    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["არაფინანსური აქტივების ცვლილება", 100, 100, 100, 1],
        ["ზრდა", 80, 80, 80, 1],
        ["კლება", 20, 20, 20, 1],
        ["ფინანსური აქტივების ცვლილება", 100, 100, 100, 1],
        ["ზრდა", 60, 60, 60, 1],
        ["კლება", 40, 40, 40, 1],
        ["ვალდებულებების ცვლილება", 100, 100, 100, 1],
        ["ზრდა", 70, 70, 70, 1],
        ["კლება", 30, 30, 30, 1],
      ],
    });

    expect(rows.map((row) => [row.labelKa, row.section])).toEqual([
      ["არაფინანსური აქტივების ცვლილება", "non_financial_assets"],
      ["ზრდა", "non_financial_assets"],
      ["კლება", "non_financial_assets"],
      ["ფინანსური აქტივების ცვლილება", "financial_assets"],
      ["ზრდა", "financial_assets"],
      ["კლება", "financial_assets"],
      ["ვალდებულებების ცვლილება", "liabilities"],
      ["ზრდა", "liabilities"],
      ["კლება", "liabilities"],
    ]);
  });

  it("keeps repeated labels under the expenditure section out of revenue", () => {
    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["შემოსავლები", 100, 100, 100, 1],
        ["გრანტები", 10, 10, 10, 1],
        ["ხარჯები", 80, 80, 80, 1],
        ["გრანტები", 20, 20, 20, 1],
      ],
    });

    expect(rows.map((row) => [row.labelKa, row.section])).toEqual([
      ["შემოსავლები", "revenues"],
      ["გრანტები", "revenues"],
      ["ხარჯები", "expenditures"],
      ["გრანტები", "expenditures"],
    ]);
  });

  it("stops before a repeated header and later summary table", () => {
    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["შემოსავლები", 100, 100, 100, 1],
        ["გადასახადები", 80, 80, 80, 1],
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["შემოსავლები", 100, 100, 100, 1],
      ],
    });

    expect(rows.map((row) => row.labelKa)).toEqual(["შემოსავლები", "გადასახადები"]);
  });

  it("collects warnings for content-bearing dropped rows but not for blank or label-only rows", () => {
    const warnings: string[] = [];
    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["შემოსავლები", 100, 100, 100, 1],
        [null, null, null, null, null],
        ["განმარტებითი ჩანაწერი", null, null, null, null],
        [null, 40, 41, null, null],
        ["გადასახადები", 80, 80, null, 1],
      ],
    });

    expect(rows.map((row) => row.labelKa)).toEqual(["შემოსავლები"]);
    expect(warnings).toHaveLength(0);

    parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["შემოსავლები", 100, 100, 100, 1],
        [null, null, null, null, null],
        ["განმარტებითი ჩანაწერი", null, null, null, null],
        [null, 40, 41, null, null],
        ["გადასახადები", 80, 80, null, 1],
      ],
      warnings,
    });

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("row 5");
    expect(warnings[0]).toContain("no label");
    expect(warnings[1]).toContain("row 6");
    expect(warnings[1]).toContain('label="გადასახადები"');
    expect(warnings[1]).toContain("no actual amount");
  });

  it("warns when a row with a label and amounts classifies as other", () => {
    const warnings: string[] = [];
    const rows = parseTavi1Rows({
      year: 2025,
      sourceId: "source.mof_2025_tavi1_actual",
      workbookPath: "docs/Raw Data/2025.xlsx",
      sheetName: "tavi I",
      matrix: [
        ["დასახელება", "2025 წლის დამტკიცებული გეგმა", "2025 წლის დაზუსტებული გეგმა", "2025 წლის ფაქტი", "შესრულება %"],
        ["ნაშთის ცვლილება", 5, 5, 5, 1],
        ["შემოსავლები", 100, 100, 100, 1],
      ],
      warnings,
    });

    expect(rows.map((row) => [row.labelKa, row.section])).toEqual([
      ["ნაშთის ცვლილება", "other"],
      ["შემოსავლები", "revenues"],
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('label "ნაშთის ცვლილება"');
    expect(warnings[0]).toContain('"other"');
  });
});
