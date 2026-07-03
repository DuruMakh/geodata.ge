import { describe, expect, it } from "vitest";
import { parseAdminWorkbookRows } from "../../../lib/data/adminSpending/extractWorkbooks";

const BASE_INPUT = {
  year: 2013,
  sourceId: "source.mof_2013_programmatic_fact_actual",
  workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2013-fact.xlsx",
  sheetName: "extracted_tables",
};

describe("parseAdminWorkbookRows (extracted_tables sheets)", () => {
  it("parses the col_1..col_5 layout when the embedded header matches the assumed columns", () => {
    const rows = parseAdminWorkbookRows({
      ...BASE_INPUT,
      matrix: [
        ["source_page", "source_table", "row_index", "col_1", "col_2", "col_3", "col_4", "col_5"],
        [1, 1, 1, "პროგრამული კოდი", "დასახელება", "2013 წლის დამტკიცებული გეგმა", "2013 წლის დაზუსტბული გეგმა", "2013 წლის ფაქტიური შესრულება"],
        [1, 1, 2, "00 00", "სულ ჯამი", "8,748,500.0", "8,748,500.0", "8,104,217.6"],
        [1, 1, 3, "01 00", "საქართველოს პარლამენტი", "50.0", "51.0", "52.0"],
      ],
    });

    expect(rows.map((row) => [row.code, row.labelKa, row.actualThousandGel])).toEqual([
      ["00 00", "სულ ჯამი", 8104217.6],
      ["01 00", "საქართველოს პარლამენტი", 52],
    ]);
  });

  it("throws when the embedded header shows code and label columns swapped", () => {
    expect(() =>
      parseAdminWorkbookRows({
        ...BASE_INPUT,
        matrix: [
          ["source_page", "source_table", "row_index", "col_1", "col_2", "col_3", "col_4", "col_5"],
          [1, 1, 1, "დასახელება", "პროგრამული კოდი", "2013 წლის დამტკიცებული გეგმა", "2013 წლის დაზუსტბული გეგმა", "2013 წლის ფაქტიური შესრულება"],
          [1, 1, 2, "სულ ჯამი", "00 00", "8,748,500.0", "8,748,500.0", "8,104,217.6"],
        ],
      }),
    ).toThrow(/code column \(col_1\)/);
  });

  it("throws when an amount column header carries code or label text", () => {
    expect(() =>
      parseAdminWorkbookRows({
        ...BASE_INPUT,
        matrix: [
          ["source_page", "source_table", "row_index", "col_1", "col_2", "col_3", "col_4", "col_5"],
          [1, 1, 1, "პროგრამული კოდი", "2013 წლის დამტკიცებული გეგმა", "2013 წლის დაზუსტბული გეგმა", "2013 წლის ფაქტიური შესრულება", "დასახელება"],
          [1, 1, 2, "00 00", "8,748,500.0", "8,748,500.0", "8,104,217.6", "სულ ჯამი"],
        ],
      }),
    ).toThrow(/Extracted-tables header mismatch/);
  });

  it("collects warnings for dropped rows with amounts but stays silent for header and label-only rows", () => {
    const warnings: string[] = [];
    const rows = parseAdminWorkbookRows({
      ...BASE_INPUT,
      matrix: [
        ["source_page", "source_table", "row_index", "col_1", "col_2", "col_3", "col_4", "col_5"],
        [1, 1, 1, "პროგრამული კოდი", "დასახელება", "2013 წლის დამტკიცებული გეგმა", "2013 წლის დაზუსტბული გეგმა", "2013 წლის ფაქტიური შესრულება"],
        [1, 1, 2, "00 00", "სულ ჯამი", "8,748,500.0", "8,748,500.0", "8,104,217.6"],
        [1, 1, 3, "", "ხარჯები შრომის ანაზღაურება საქონელი", null, null, null],
        [1, 2, 1, "", "", "1,000.0", "900.0", null],
        [1, 2, 2, null, null, null, null, null],
      ],
      warnings,
    });

    expect(rows).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("row 5");
    expect(warnings[0]).toContain("no label");
    expect(warnings[0]).toContain("approved=1000");
  });
});

describe("parseAdminWorkbookRows (normalized rows sheets)", () => {
  it("warns about coded or amount-bearing dropped rows but not detail label rows", () => {
    const warnings: string[] = [];
    const rows = parseAdminWorkbookRows({
      year: 2006,
      sourceId: "source.mof_2006_programmatic_fact_actual",
      workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2006-fact.xlsx",
      sheetName: "rows",
      matrix: [
        ["year", "code", "label", "total_actual"],
        [2006, "01 00", "საქართველოს პარლამენტი", 1689717.07],
        [2006, null, "სუბსიდიები, სუბვენციები და მიმდინარე ტრანსფერტები", null],
        [2006, "01 04", "", null],
        [2006, null, "", 500],
      ],
      warnings,
    });

    expect(rows).toHaveLength(1);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("row 4");
    expect(warnings[0]).toContain("code=01 04");
    expect(warnings[1]).toContain("row 5");
    expect(warnings[1]).toContain("actual=500");
  });
});
