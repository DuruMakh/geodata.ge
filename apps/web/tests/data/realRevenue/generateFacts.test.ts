import { describe, expect, it } from "vitest";
import { generateLegacyAggregateRevenueFacts, generateRevenueFacts } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";

function row(
  sourceCode: string,
  labelKa: string,
  actualThousandGel: number,
  consolidatedActualGel = actualThousandGel * 1000,
  section: OfficialRevenueRow["section"] = "revenues",
): OfficialRevenueRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 2,
    sourceCode,
    labelKa,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel,
    executionPercent: null,
    section,
    consolidatedActualGel,
  };
}

const rows = [
  row("1", "revenues", 1000, 1300000),
  row("1.1", "taxes", 800, 1000000),
  row("1.1.4.1.1", "vat", 300, 400000),
  row("1.1.1.1.1", "income tax", 200, 250000),
  row("1.1.1.2.1", "profit tax", 100, 100000),
  row("1.1.4.2", "excise", 90, 110000),
  row("1.1.5.1", "import tax", 40, 40000),
  row("1.1.3", "property tax", 20, 50000),
  row("1.1.6", "other taxes", 50, 50000),
  row("1.3", "grants", 50, 200000),
  row("1.3.3", "internal grants", 10, 75000),
  row("1.4", "other revenue", 150, 100000),
  row("1.4.1.1.3", "internal other revenue", 5, 25000),
  row("31", "non-financial asset decrease", 60, 60000, "non_financial_assets"),
  row("32", "financial asset decrease", 40, 40000, "financial_assets"),
  row("33", "increase in liabilities", 200, 200000, "liabilities"),
  row("41", "opening balance", 300, 300000, "other"),
];

describe("generateRevenueFacts", () => {
  it("generates detailed source-backed revenue facts without the tax aggregate", () => {
    const facts = generateRevenueFacts(rows);

    expect(facts.map((fact) => fact.item_id)).toEqual([
      "revenue.vat",
      "revenue.income_tax",
      "revenue.profit_tax",
      "revenue.excise_tax",
      "revenue.import_tax",
      "revenue.property_tax",
      "revenue.other_taxes",
      "revenue.grants",
      "revenue.other_revenue",
      "revenue.asset_decrease",
      "revenue.increase_liabilities",
    ]);
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item_id: "revenue.vat", amount_gel: "400000" }),
        expect.objectContaining({
          item_id: "revenue.grants",
          amount_gel: "125000",
          mapping_notes: expect.stringContaining("net of Source row 1.3.3"),
        }),
        expect.objectContaining({
          item_id: "revenue.other_revenue",
          amount_gel: "75000",
          mapping_notes: expect.stringContaining("net of Source row 1.4.1.1.3"),
        }),
        expect.objectContaining({
          item_id: "revenue.asset_decrease",
          amount_gel: "100000",
          mapping_notes: expect.stringContaining("Source rows 31 + 32"),
        }),
        expect.objectContaining({
          item_id: "revenue.increase_liabilities",
          amount_gel: "200000",
          mapping_notes: expect.stringContaining("Source row 33"),
        }),
      ]),
    );
    expect(facts.reduce((sum, fact) => sum + Number(fact.amount_gel), 0)).toBe(1500000);
  });

  it("generates legacy aggregate facts for workbook/PDF comparisons", () => {
    const facts = generateLegacyAggregateRevenueFacts(rows);

    expect(facts).toEqual([
      expect.objectContaining({ item_id: "revenue.taxes_total", amount_gel: "800000" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "50000" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "150000" }),
    ]);
  });

  it("uses older numeric Treasury source codes when dotted source codes are absent", () => {
    const oldCodeRows = [
      row("1", "revenues", 1000, 1300000),
      row("11411", "\u02ab\u02ec\u02c0", 300, 400000),
      row("11111", "income tax", 200, 250000),
      row("11121", "profit tax", 100, 100000),
      row("1142", "excise", 90, 110000),
      row("1151", "import tax", 40, 40000),
      row("113", "property tax", 20, 50000),
      row("116", "other taxes", 50, 50000),
      row("13", "grants", 50, 200000),
      row("133", "internal grants", 10, 75000),
      row("14", "other revenue", 150, 100000),
      row("14111", "internal other revenue", 5, 25000),
      row("31", "non-financial asset decrease", 60, 60000, "non_financial_assets"),
      row("32", "financial asset decrease", 40, 40000, "financial_assets"),
      row("33", "increase in liabilities", 200, 200000, "liabilities"),
    ];

    const facts = generateRevenueFacts(oldCodeRows);

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: "revenue.vat",
          amount_gel: "400000",
          mapping_notes: expect.stringContaining("Source row 11411"),
        }),
        expect.objectContaining({ item_id: "revenue.grants", amount_gel: "125000" }),
        expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "75000" }),
        expect.objectContaining({ item_id: "revenue.asset_decrease", amount_gel: "100000" }),
        expect.objectContaining({ item_id: "revenue.increase_liabilities", amount_gel: "200000" }),
      ]),
    );
    expect(facts.map((fact) => fact.mapping_notes).join("\n")).not.toContain("\u02ab\u02ec\u02c0");
  });


  it("uses the tax total residual for compact numeric other taxes", () => {
    const compactRows = [
      row("1", "revenues", 1000, 1300000),
      row("11", "taxes", 800, 1000000),
      row("11411", "VAT", 300, 400000),
      row("11111", "income tax", 200, 250000),
      row("11121", "profit tax", 100, 100000),
      row("1142", "excise", 90, 110000),
      row("1151", "import tax", 40, 40000),
      row("113", "property tax", 20, 50000),
      row("116", "other taxes row below residual", 5, 5000),
      row("13", "grants", 50, 200000),
      row("133", "internal grants", 10, 75000),
      row("14", "other revenue", 150, 100000),
      row("14111", "internal other revenue", 5, 25000),
      row("31", "non-financial asset decrease", 60, 60000, "non_financial_assets"),
      row("32", "financial asset decrease", 40, 40000, "financial_assets"),
      row("33", "increase in liabilities", 200, 200000, "liabilities"),
    ];

    const facts = generateRevenueFacts(compactRows);

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item_id: "revenue.other_taxes", amount_gel: "50000" }),
      ]),
    );
    expect(facts.reduce((sum, fact) => sum + Number(fact.amount_gel), 0)).toBe(1500000);
  });
  it("maps 2006 old 12-digit revenue codes into public revenue categories", () => {
    const rows2006 = [
      row("010000000000", "???????????? ???????????", 3151976.05837, 3151976058.37),
      row("010100000000", "??????????? ??????????", 385945.38753, 385945387.53),
      row("010200000000", "??????? ??????????", 341070.3943, 341070394.30),
      row("010300000000", "?????????? ??????????? ??????????", 1332651.13669, 1332651136.69),
      row("010400000000", "??????", 335622.38997, 335622389.97),
      row("010500000000", "?????? ??????????", 132366.20909, 132366209.09),
      row("010600000000", "??????? ??????????", 51375.08861, 51375088.61),
      row("010700000000", "?????????? ????????? ?????????? ????????????????", 17468.63116, 17468631.16),
      row("010800000000", "?????????? ????? ????????????? ??????? ?????????????????", 546.96419, 546964.19),
      row("010900000000", "?????????? ??????? ??????????????", 339.60276, 339602.76),
      row("011000000000", "??????????? ??????????", 66.62968, 66629.68),
      row("011100000000", "????? ???????? ??????????", 35.13569, 35135.69),
      row("012500000000", "???????? ???????? ??????????", 10889.19754, 10889197.54),
      row("012600000000", "????????? ??????????", 2.95661, 2956.61),
      row("012700000000", "????????? ??????????", 55.81995, 55819.95),
      row("012800000000", "???????? ??????????", 106.33075, 106330.75),
      row("012900000000", "?????????? ??????????? ?????????? ????????????????", 2.92462, 2924.62),
      row("013000000000", "????? ??????????", 34445.12789, 34445127.89),
      row("013100000000", "??????? ?????????????? ???????? ??????????? ??????????", 8.55681, 8556.81),
      row("013300000000", "????????", 1098.0536, 1098053.60),
      row("014000000000", "???? ?????????????????? ??????????", 1975.5967, 1975596.70),
      row("014100000000", "??????????? ????????? ????????? ??????? ?????????? ?????", 502843.61616, 502843616.16),
      row("014500000000", "?????????? ?????? ?????", 3060.30807, 3060308.07),
      row("020000000000", "??????????????? ???????????", 519108.35657, 519108356.57),
      row("030000000000", "??????????? ????????? ?????????????", 564458.25918, 564458259.18, "non_financial_assets"),
      row("040000000000", "????????", 131872.2144, 131872214.40),
      row("050000000000", "?????? ????? (???????????)", 170501.43662, 170501436.62, "liabilities"),
    ].map((candidate) => ({ ...candidate, year: 2006, sourceId: "source.mof_2006_revenue_form1_pdf" }));

    const facts = generateRevenueFacts(rows2006);

    expect(facts).toEqual([
      expect.objectContaining({ item_id: "revenue.vat", amount_gel: "1332651137" }),
      expect.objectContaining({ item_id: "revenue.income_tax", amount_gel: "385945388" }),
      expect.objectContaining({ item_id: "revenue.profit_tax", amount_gel: "341070394" }),
      expect.objectContaining({ item_id: "revenue.excise_tax", amount_gel: "335622390" }),
      expect.objectContaining({ item_id: "revenue.import_tax", amount_gel: "132366209" }),
      expect.objectContaining({ item_id: "revenue.property_tax", amount_gel: "85820217" }),
      expect.objectContaining({ item_id: "revenue.other_taxes", amount_gel: "538500324" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "131872214" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "519108357" }),
      expect.objectContaining({ item_id: "revenue.asset_decrease", amount_gel: "564458259" }),
      expect.objectContaining({ item_id: "revenue.increase_liabilities", amount_gel: "170501437" }),
    ]);
    expect(facts.reduce((sum, fact) => sum + Number(fact.amount_gel), 0)).toBe(4537916326);
  });

  it("maps 2007 old 8-digit revenue codes into public revenue categories", () => {
    const rows2007 = [
      row("01000000", "tax revenue", 4391099.39402, 4391099394.02),
      row("01010000", "income tax", 526747.6738, 526747673.8),
      row("01020000", "profit tax", 554797.06223, 554797062.23),
      row("01030000", "VAT", 1973665.8296, 1973665829.6),
      row("01040000", "excise", 428637.04012, 428637040.12),
      row("01050000", "import tax", 51965.57468, 51965574.68),
      row("01060000", "social tax", 722049.51919, 722049519.19),
      row("01070000", "property tax", 107886.0687, 107886068.7),
      row("01900000", "other unclassified tax", 25350.6257, 25350625.7),
      row("02000000", "other revenue", 880695.22191, 880695221.91),
      row("03000000", "capital operations", 643786.98339, 643786983.39, "non_financial_assets"),
      row("04000000", "grants", 152717.59086, 152717590.86),
      row("05000000", "borrowing", 288121.97988, 288121979.88, "liabilities"),
    ].map((candidate) => ({ ...candidate, year: 2007, sourceId: "source.mof_2007_revenue_form1_pdf" }));

    const facts = generateRevenueFacts(rows2007);

    expect(facts).toEqual([
      expect.objectContaining({ item_id: "revenue.vat", amount_gel: "1973665830" }),
      expect.objectContaining({ item_id: "revenue.income_tax", amount_gel: "526747674" }),
      expect.objectContaining({ item_id: "revenue.profit_tax", amount_gel: "554797062" }),
      expect.objectContaining({ item_id: "revenue.excise_tax", amount_gel: "428637040" }),
      expect.objectContaining({ item_id: "revenue.import_tax", amount_gel: "51965575" }),
      expect.objectContaining({ item_id: "revenue.property_tax", amount_gel: "107886069" }),
      expect.objectContaining({ item_id: "revenue.other_taxes", amount_gel: "747400145" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "152717591" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "880695222" }),
      expect.objectContaining({ item_id: "revenue.asset_decrease", amount_gel: "643786983" }),
      expect.objectContaining({ item_id: "revenue.increase_liabilities", amount_gel: "288121980" }),
    ]);
    expect(facts.reduce((sum, fact) => sum + Number(fact.amount_gel), 0)).toBe(6356421171);
  });
  it("throws when a required detailed revenue source row is missing", () => {
    expect(() => generateRevenueFacts(rows.filter((candidate) => candidate.sourceCode !== "1.3"))).toThrow(
      "Missing required revenue row for 2025: 1.3",
    );
  });

  it("throws when an internal consolidation row is missing", () => {
    expect(() => generateRevenueFacts(rows.filter((candidate) => candidate.sourceCode !== "1.3.3"))).toThrow(
      "Missing required revenue row for 2025: 1.3.3",
    );
  });
});
