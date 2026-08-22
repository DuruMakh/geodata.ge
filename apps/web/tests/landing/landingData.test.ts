import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { buildLandingModel } from "../../lib/landing/landingData";

const glossary = new Map<string, GlossaryEntry>([
  ["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }],
  [
    "spending.social_protection",
    { id: "spending.social_protection", kaLabel: "სოციალური დაცვა", enLabel: "Social protection", description: "", notes: "" },
  ],
]);

const sourceDocuments: SourceDocumentRow[] = [
  { sourceId: "source.a", sourceName: "A", sourceUrlOrFile: "docs/a", lastReviewedAt: "2026-05-10" },
  { sourceId: "source.b", sourceName: "B", sourceUrlOrFile: "docs/b", lastReviewedAt: "2026-06-01" },
];

function fact(row: Partial<BudgetFactImportRow> & Pick<BudgetFactImportRow, "year" | "side" | "itemId" | "amountGel">): BudgetFactImportRow {
  return {
    basis: "actual",
    sourceId: "source.a",
    officialInstitution: null,
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: row.side === "expenditure" ? row.itemId : null,
    mappingConfidence: row.side === "expenditure" ? "high" : null,
    mappingNotes: "",
    ...row,
  };
}

const facts: BudgetFactImportRow[] = [
  fact({ year: 2005, side: "revenue", itemId: "revenue.vat", amountGel: 400 }),
  fact({ year: 2005, side: "revenue", itemId: "revenue.grants", amountGel: 100 }),
  fact({ year: 2024, side: "revenue", itemId: "revenue.vat", amountGel: 700 }),
  fact({ year: 2025, side: "revenue", itemId: "revenue.vat", amountGel: 900 }),
  fact({ year: 2025, side: "revenue", itemId: "revenue.grants", amountGel: 300 }),
  // Derived totals must not leak into the sparkline or the year range.
  fact({ year: 2025, side: "revenue", itemId: "revenue.total", amountGel: 1200 }),
  fact({ year: 2024, side: "expenditure", itemId: "spending.social_protection", amountGel: 600 }),
  fact({ year: 2025, side: "expenditure", itemId: "spending.social_protection", amountGel: 700 }),
  fact({ year: 2025, side: "expenditure", itemId: "spending.health", amountGel: 200 }),
  fact({ year: 2025, side: "expenditure", itemId: "spending.education", amountGel: 100 }),
];

describe("landing model", () => {
  const model = buildLandingModel({ facts, glossary, sourceDocuments });

  it("derives the year ranges and updated date from active facts", () => {
    expect(model.revMin).toBe(2005);
    expect(model.revMax).toBe(2025);
    expect(model.expMax).toBe(2025);
    expect(model.yearsLabel).toBe("2005–2025");
    expect(model.updatedAt).toBe("2026-06-01");
  });

  it("builds one sparkline point per revenue year and ends on the last total", () => {
    expect(model.sparkTotal.split(" ")).toHaveLength(3);
    expect(model.sparkVat.split(" ")).toHaveLength(3);
    const lastPoint = model.sparkTotal.split(" ").at(-1);
    expect(lastPoint).toBe(`${model.sparkEndX},${model.sparkEndY}`);
    // 2025 total (1200) is the max, so the endpoint sits at the top pad line.
    expect(model.sparkEndY).toBe("6.0");
  });

  it("fills exactly 30 waffle cells proportional to the latest year's structure", () => {
    expect(model.waffleCells).toHaveLength(30);
    // 700/1000 → 21 cells for social protection, sorted first.
    expect(model.waffleCells.filter((color) => color === model.waffleCells[0])).toHaveLength(21);
  });

  it("previews the three-sheet Excel workbook with real labels and the latest two years", () => {
    expect(model.excelPreview.sheetNames).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
    expect(model.excelPreview.headers).toEqual(["კატეგორია", "2024", "2025"]);
    expect(model.excelPreview.rows).toEqual([["სოციალური დაცვა", 600, 700]]);
  });
});
