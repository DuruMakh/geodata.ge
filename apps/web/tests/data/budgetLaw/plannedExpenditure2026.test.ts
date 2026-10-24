import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { lawFunctionalRows, lawTavi6Matrix } from "../../../lib/data/budgetLaw/lawRows";
import { readDocxTables } from "../../../lib/data/budgetLaw/readDocxTables";
import { BUDGET_LAW_2026 } from "../../../lib/data/budgetLaw/sources";
import { parseAdminWorkbookRows } from "../../../lib/data/adminSpending/extractWorkbooks";
import { loadBudgetFactRows } from "../../../lib/data/importBudgetFacts";
import { composeFinalExpenditureFacts } from "../../../lib/data/realExpenditurePdf/final2025Data";
import type { ExpenditurePdfOfficialRow } from "../../../lib/data/realExpenditurePdf/phase1Pilot";
import {
  budgetLawArticle9ExtraMappingRules,
  generateCompactPdfSpendingMappings,
  validateCompactPdfSpendingMappings,
} from "../../../lib/data/realExpenditurePdf/publicMapping";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const article9Table = readDocxTables(BUDGET_LAW_2026.tavi3DocxPath).find((table) => table.some((row) => row[0] === "7"))!;
const tavi6Table = readDocxTables(BUDGET_LAW_2026.tavi6DocxPath)[0];

type SupplementCsvRow = { code: string; economic_label_ka: string; amount_gel: string; public_spending_field_id: string };
type E11CsvRow = { row_type: string; functional_code: string; actual_gel: string; hierarchy_path: string; label_ka: string };

const lawMappings = (column: "fact2024" | "plan2026") =>
  generateCompactPdfSpendingMappings(lawFunctionalRows(article9Table, column), budgetLawArticle9ExtraMappingRules);

function readCsv<T>(relativePath: string): T[] {
  return parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as T[];
}

describe("2026 planned spending by area from the budget law", () => {
  it("ships 13 planned field rows that add up to the law's Article 2 payments total", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/expenditure-facts-2026-planned.csv");
    expect(rows).toHaveLength(13);
    expect(rows.every((row) => row.basis === "planned" && row.year === 2026 && row.side === "expenditure")).toBe(true);
    expect(rows.every((row) => row.sourceId === "source.mof_2026_budget_law_planned")).toBe(true);
    const totalGel = rows.reduce((sum, row) => sum + row.amountGel, 0);
    expect(Math.abs(totalGel - 30_881_358_000)).toBeLessThanOrEqual(1000);
  });

  it("maps every Article 9 functional row of the 2026 plan with the unchanged COFOG rules", () => {
    const rows = lawFunctionalRows(article9Table, "plan2026");
    expect(rows.find((row) => row.rowType === "grand_total")?.actualGel).toBe(27_311_597_000);
    const mappings = generateCompactPdfSpendingMappings(rows, budgetLawArticle9ExtraMappingRules);
    const validation = validateCompactPdfSpendingMappings(rows, mappings);
    expect(validation.status).toBe("passed");
    expect(validation.mappedTotalActualGel).toBe(27_311_597_000);
  });

  it("supplements financial assets growth and liabilities decrease from the Tavi VI leaf rows", () => {
    const supplements = readCsv<SupplementCsvRow>(
      "data/staging/expenditure-2026-planned-financial-assets-liabilities-supplement.csv",
    );
    const total = (label: string) =>
      supplements.filter((row) => row.economic_label_ka === label).reduce((sum, row) => sum + Number(row.amount_gel), 0);
    expect(total("ფინანსური აქტივების ზრდა")).toBe(650_000_000);
    expect(total("ვალდებულებების კლება")).toBe(2_919_761_000);
    const liabilityRows = supplements.filter((row) => row.economic_label_ka === "ვალდებულებების კლება");
    // 45 12 (a transfer to an eparchy training centre) is education, as reviewed for 2024 and 2025.
    const educationRow = liabilityRows.filter((row) => row.code === "45 12");
    expect(educationRow).toEqual([expect.objectContaining({ amount_gel: "61000", public_spending_field_id: "spending.education" })]);
    const debtRows = liabilityRows.filter((row) => row.code !== "45 12");
    expect(debtRows.length).toBeGreaterThan(0);
    expect(debtRows.every((row) => row.public_spending_field_id === "spending.debt_service")).toBe(true);
  });

  it("reads the Tavi VI rows in the parseTavi6Rows fallback shape", () => {
    const rows = parseAdminWorkbookRows({
      year: 2026,
      sourceId: BUDGET_LAW_2026.sourceId,
      workbookPath: "docs/Raw Data/Expenditure/mof.ge/budget-law-2026/2026-tavi-VI.docx",
      sheetName: "Tavi VI",
      matrix: lawTavi6Matrix(tavi6Table),
    });
    expect(rows.find((row) => row.code === "00 00")?.actualThousandGel).toBe(30_881_358);
    expect(rows.filter((row) => row.isCodedRow)).toHaveLength(373);
  });

  it("maps the law's own 2024 fact column to the shipped 2024 total net of the 2024 supplements", async () => {
    // Per field the law restates 2024 under its own functional split, so only the total is compared.
    const lawTotalGel = lawMappings("fact2024").reduce((sum, row) => sum + row.amountGel, 0);
    const shipped = await loadBudgetFactRows("../../data/imports/expenditure-facts-2024-final.csv");
    const supplements = readCsv<SupplementCsvRow>("data/staging/expenditure-2024-financial-assets-liabilities-supplement.csv");
    const expectedGel =
      shipped.reduce((sum, row) => sum + row.amountGel, 0) - supplements.reduce((sum, row) => sum + Number(row.amount_gel), 0);
    expect(Math.abs(lawTotalGel - expectedGel)).toBeLessThanOrEqual(1000);
  });

  it("maps every Article 9 code that the 2024 E11 report also has to the same field", () => {
    const e11Rows = readCsv<E11CsvRow>("data/staging/expenditure-pdf-official-rows-2024-pilot.csv").map(
      (row) =>
        ({
          year: 2024,
          sourceId: "source.e11",
          rowType: row.row_type,
          functionalCode: row.functional_code || null,
          hierarchyPath: row.hierarchy_path,
          labelKa: row.label_ka,
          actualGel: Number(row.actual_gel),
        }) as ExpenditurePdfOfficialRow,
    );
    const e11FieldByCode = new Map(
      generateCompactPdfSpendingMappings(e11Rows).map((row) => [row.functionalCode, row.publicSpendingFieldId]),
    );
    const shared = lawMappings("fact2024").filter((row) => e11FieldByCode.has(row.functionalCode));
    expect(shared.length).toBe(e11FieldByCode.size);
    for (const row of shared) expect(row.publicSpendingFieldId, row.functionalCode).toBe(e11FieldByCode.get(row.functionalCode));
  });

  it("keeps composeFinalExpenditureFacts actual by default and marks planned rows when asked", () => {
    const input = {
      year: 2026,
      finalSourceId: "source.test",
      sourceFiles: [],
      pdfMappings: [],
      supplements: [],
      spendingFieldIds: ["spending.defence"],
      workbookTotalGel: 0,
    };
    expect(composeFinalExpenditureFacts(input).facts[0].basis).toBe("actual");
    const planned = composeFinalExpenditureFacts({ ...input, basis: "planned" });
    expect(planned.facts[0].basis).toBe("planned");
    expect(planned.facts[0].mapping_notes).toContain("law Article 9");
  });
});
