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

  it("parses compact numeric rows without absorbing child rows and detects amount column order", () => {
    const rows = parseTreasuryPdfRows({
      year: 2008,
      sourceId: "source.mof_2008_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/Revenue/2008-jan-dec-consolidated-revenue.pdf",
      text: `
        11111 income tax 1,296,344,116.94 1,218,300,448.30 78,043,668.64
        1111101 employer withheld income tax 1,105,673,927.41 1,032,376,588.59 73,297,338.82
        11121 profit tax 592,119,128.28 592,119,128.28 0.00
        2012 11111 income tax 1,636,355,961.72 128,398,324.84 1,764,754,286.56
        1111101 employer withheld income tax 1,356,096,420.00 109,605,096.73 1,465,701,516.73
      `,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sourceCode: "11111",
        labelKa: "income tax",
        stateBudgetActualGel: 1218300448.3,
        territorialBudgetActualGel: 78043668.64,
        consolidatedActualGel: 1296344116.94,
      }),
      expect.objectContaining({
        sourceCode: "1111101",
        labelKa: "employer withheld income tax",
        consolidatedActualGel: 1105673927.41,
      }),
      expect.objectContaining({
        sourceCode: "11121",
        labelKa: "profit tax",
        consolidatedActualGel: 592119128.28,
      }),
      expect.objectContaining({
        sourceCode: "11111",
        labelKa: "income tax",
        stateBudgetActualGel: 1636355961.72,
        territorialBudgetActualGel: 128398324.84,
        consolidatedActualGel: 1764754286.56,
      }),
      expect.objectContaining({
        sourceCode: "1111101",
        labelKa: "employer withheld income tax",
        consolidatedActualGel: 1465701516.73,
      }),
    ]);
  });

  it("parses space-grouped amounts with comma decimals from 2015 PDF text", () => {
    const rows = parseTreasuryPdfRows({
      year: 2015,
      sourceId: "source.mof_2015_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/Revenue/2015-jan-dec-consolidated-revenue.pdf",
      text: `
        0 ჯამური 10 325 300 242,54 2 442 098 474,76 12 767 398 717,30
        1 შემოსავლები 8 826 736 031,77 2 433 953 851,38 11 260 689 883,15
        11 გადასახადები 7 849 171 285,25 1 223 895 866,56 9 073 067 151,81
      `,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sourceCode: "0",
        labelKa: "ჯამური",
        consolidatedActualGel: 12767398717.3,
      }),
      expect.objectContaining({
        sourceCode: "1",
        labelKa: "შემოსავლები",
        stateBudgetActualGel: 8826736031.77,
        territorialBudgetActualGel: 2433953851.38,
        consolidatedActualGel: 11260689883.15,
      }),
      expect.objectContaining({
        sourceCode: "11",
        labelKa: "გადასახადები",
        consolidatedActualGel: 9073067151.81,
      }),
    ]);
  });
  it("parses old 12-digit revenue codes split across wrapped PDF text", () => {
    const rows = parseTreasuryPdfRows({
      year: 2006,
      sourceId: "source.mof_2006_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/Revenue/2006-jan-dec-consolidated-revenue.pdf",
      text: `
        010000000000 ???????????? ??????????? 2,633,110,029.95 518,866,028.42 3,151,976,058.37
        010300000000 ?????????? ??????????? ??????????
        1,332,651,194.89 -58.20 1,332,651,136.69
        014100000000 ??????????? ????????? ????????? ??????? ?????????? ?????
        (????????? ????????? ??????????) 502,843,616.16 0.00 502,843,616.16
        050000000000 ?????? ????? (???????????) 168,205,016.62 2,296,420.00 170,501,436.62
        ??? 3,878,956,453.02 658,959,872.12 4,537,916,325.14
      `,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sourceCode: "010000000000",
        labelKa: "???????????? ???????????",
        section: "revenues",
        consolidatedActualGel: 3151976058.37,
      }),
      expect.objectContaining({
        sourceCode: "010300000000",
        labelKa: "?????????? ??????????? ??????????",
        section: "revenues",
        consolidatedActualGel: 1332651136.69,
      }),
      expect.objectContaining({
        sourceCode: "014100000000",
        labelKa: "??????????? ????????? ????????? ??????? ?????????? ????? (????????? ????????? ??????????)",
        section: "revenues",
        consolidatedActualGel: 502843616.16,
      }),
      expect.objectContaining({
        sourceCode: "050000000000",
        labelKa: "?????? ????? (???????????)",
        section: "liabilities",
        consolidatedActualGel: 170501436.62,
      }),
    ]);
  });

  it("parses old 8-digit revenue codes from 2007 text", () => {
    const rows = parseTreasuryPdfRows({
      year: 2007,
      sourceId: "source.mof_2007_revenue_form1_pdf",
      pdfPath: "docs/Raw Data/Revenue/2007-jan-dec-consolidated-revenue.pdf",
      text: `
        01000000 tax revenue 3,732,585,502.95 658,513,891.07 4,391,099,394.02
        01010000 income tax 0.00 526,747,673.80 526,747,673.80
        03000000 capital operations 449,067,957.47 194,719,025.92 643,786,983.39
        05000000 borrowing 283,487,035.10 4,634,944.78 288,121,979.88
      `,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sourceCode: "01000000",
        labelKa: "tax revenue",
        section: "revenues",
        consolidatedActualGel: 4391099394.02,
      }),
      expect.objectContaining({
        sourceCode: "01010000",
        labelKa: "income tax",
        section: "revenues",
        consolidatedActualGel: 526747673.8,
      }),
      expect.objectContaining({
        sourceCode: "03000000",
        labelKa: "capital operations",
        section: "non_financial_assets",
        consolidatedActualGel: 643786983.39,
      }),
      expect.objectContaining({
        sourceCode: "05000000",
        labelKa: "borrowing",
        section: "liabilities",
        consolidatedActualGel: 288121979.88,
      }),
    ]);
  });
});
