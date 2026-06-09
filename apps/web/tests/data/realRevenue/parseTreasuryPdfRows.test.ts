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

  it("parses bare receipt codes before child rows and opening balance rows", () => {
    const rows = parseTreasuryPdfRows({
      year: 2025,
      sourceId: "source.mof_2025_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/2025.pdf",
      text: `
        31 non-financial asset decrease 60,000.00 5,000.00 65,000.00
        31.1 fixed assets 40,000.00 5,000.00 45,000.00
        32 financial asset decrease 35,000.00 5,000.00 40,000.00
        32.1 domestic debtors 35,000.00 5,000.00 40,000.00
        33 increase in liabilities 190,000.00 10,000.00 200,000.00
        33.1 domestic creditors 120,000.00 10,000.00 130,000.00
        41 opening balance 300,000.00 20,000.00 320,000.00
        41.1 treasury balance 300,000.00 20,000.00 320,000.00
      `,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sourceCode: "31",
        labelKa: "non-financial asset decrease",
        section: "non_financial_assets",
        consolidatedActualGel: 65000,
      }),
      expect.objectContaining({ sourceCode: "31.1", labelKa: "fixed assets" }),
      expect.objectContaining({
        sourceCode: "32",
        labelKa: "financial asset decrease",
        section: "financial_assets",
        consolidatedActualGel: 40000,
      }),
      expect.objectContaining({ sourceCode: "32.1", labelKa: "domestic debtors" }),
      expect.objectContaining({
        sourceCode: "33",
        labelKa: "increase in liabilities",
        section: "liabilities",
        consolidatedActualGel: 200000,
      }),
      expect.objectContaining({ sourceCode: "33.1", labelKa: "domestic creditors" }),
      expect.objectContaining({
        sourceCode: "41",
        labelKa: "opening balance",
        section: "opening_balance",
        consolidatedActualGel: 320000,
      }),
      expect.objectContaining({ sourceCode: "41.1", labelKa: "treasury balance" }),
    ]);
  });

  it("parses older numeric source codes without page-header rows", () => {
    const rows = parseTreasuryPdfRows({
      year: 2018,
      sourceId: "source.mof_2018_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/2018.pdf",
      text: `
        1 revenues 10,000.00 2,000.00 12,000.00
        page 1 of 13 -- 114112 imported products 1.00 2.00 3.00
        11 taxes 9,000.00 1,000.00 10,000.00
        11111 income tax 2,000.00 300.00 2,300.00
        11411 VAT 4,000.00 0.00 4,000.00
        13 grants 500.00 1,500.00 2,000.00
        133 internal grants 100.00 1,100.00 1,200.00
        14 other revenue 400.00 300.00 700.00
        14111 other government sector interest 10.00 0.00 10.00
      `,
    });

    expect(rows.map((row) => row.sourceCode)).toEqual([
      "1",
      "114112",
      "11",
      "11111",
      "11411",
      "13",
      "133",
      "14",
      "14111",
    ]);
    expect(rows.find((row) => row.sourceCode === "11411")).toEqual(
      expect.objectContaining({
        labelKa: "VAT",
        section: "revenues",
        consolidatedActualGel: 4000,
      }),
    );
  });
});
