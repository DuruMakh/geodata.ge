import { describe, expect, it } from "vitest";
import { parseTreasuryPdfRows } from "../../../lib/data/realRevenue/parseTreasuryPdfRows";

describe("parseTreasuryPdfRows", () => {
  it("parses state, territorial, and consolidated actual amounts from compact PDF text", () => {
    const rows = parseTreasuryPdfRows({
      year: 2025,
      sourceId: "source.mof_2025_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/2025.pdf",
      text: `
        1 revenues 23 991 135 307.76 6 531 123 080.21 30 522 258 387.97
        1.1 taxes 21 957 477 792.24 3 578 872 280.23 25 536 350 072.47
        1.1.4.2 excise 2,728,646,344.44 0.00 2,728,646,344.44
      `,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sourceCode: "1",
        labelKa: "revenues",
        section: "revenues",
        stateBudgetActualGel: 23991135307.76,
        territorialBudgetActualGel: 6531123080.21,
        consolidatedActualGel: 30522258387.97,
      }),
      expect.objectContaining({
        sourceCode: "1.1",
        labelKa: "taxes",
        section: "revenues",
      }),
      expect.objectContaining({
        sourceCode: "1.1.4.2",
        labelKa: "excise",
        stateBudgetActualGel: 2728646344.44,
      }),
    ]);
    expect(rows[0]?.actualThousandGel).toBeCloseTo(23991135.30776);
  });

  it("does not treat dates and report years as row codes", () => {
    const rows = parseTreasuryPdfRows({
      year: 2024,
      sourceId: "source.mof_2024_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/2024.pdf",
      text: "03/19/2025 13:30 2024 treasury 1 revenues 1,000.00 2,000.00 3,000.00",
    });

    expect(rows.map((row) => row.sourceCode)).toEqual(["1"]);
  });
});
