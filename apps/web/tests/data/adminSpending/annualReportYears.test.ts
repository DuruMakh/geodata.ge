import { describe, expect, it } from "vitest";
import { ANNUAL_REPORT_YEAR_EXTRACTORS } from "../../../lib/data/adminSpending/extractAnnualReportYears";
import { extractAdminSpendingOfficialRows } from "../../../lib/data/adminSpending/extractWorkbooks";
import {
  ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL,
  generateAdminSpendingFacts,
} from "../../../lib/data/adminSpending/generateAdminSpendingFacts";
import { parseAnnualReportRows } from "../../../lib/data/adminSpending/parseAnnualReportPdf";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

function categoryTotals(rows: OfficialExpenditureRow[], year: number): Record<string, number> {
  const facts = generateAdminSpendingFacts(rows).filter(
    (fact) => fact.level === "admin_category" && fact.year === year,
  );
  return Object.fromEntries(facts.map((fact) => [fact.itemId.replace("admin_spending.", ""), fact.amountGel]));
}

describe("parseAnnualReportRows", () => {
  it("parses single-line and wrapped coded rows and skips economic-classification lines", () => {
    const text = [
      "ორგანიზაციული",
      "კოდი დასახელება", // header noise
      "00 00 სულ ჯამი 100.0 100.0 90.0",
      "ხარჯები 80.0 80.0 72.0", // economic line (no code) -> ignored
      "შრომის ანაზღაურება 40.0 40.0 39.0", // economic line -> ignored
      "01 00 საქართველოს პარლამენტი 30.0 30.0 28.0", // single-line institution
      "ხარჯები 25.0 25.0 24.0",
      "01 01 საკანონმდებლო საქმიანობა 20.0 20.0 19.0", // program
      "11 00", // wrapped institution: code alone, label + amounts wrap
      "სახელმწიფო რწმუნებულის - გუბერნატორის ადმინისტრაცია",
      "აბაშის, ზუგდიდის მუნიციპალიტეტებში",
      "5.0 5.0 4.5",
    ].join("\n");

    const { rows, warnings } = parseAnnualReportRows(text);
    expect(warnings).toEqual([]);
    expect(rows.map((row) => row.code)).toEqual(["00 00", "01 00", "01 01", "11 00"]);

    const byCode = Object.fromEntries(rows.map((row) => [row.code, row]));
    expect(byCode["00 00"].actualThousandGel).toBe(90);
    expect(byCode["01 00"].label).toBe("საქართველოს პარლამენტი");
    expect(byCode["01 00"].actualThousandGel).toBe(28);
    expect(byCode["11 00"].actualThousandGel).toBe(4.5);
    expect(byCode["11 00"].label).toContain("გუბერნატორის ადმინისტრაცია");
    expect(byCode["11 00"].label).toContain("მუნიციპალიტეტებში");
  });

  it("stops at the post-table narrative section (does not parse code-like prose)", () => {
    const lines = ["00 00 სულ ჯამი 100.0 100.0 90.0", "01 00 პარლამენტი 30.0 30.0 28.0"];
    for (let i = 0; i < 50; i += 1) lines.push("განმარტება: ასიგნებების ცვლილება გამოწვეული იყო რეორგანიზაციით.");
    lines.push("02 00 - საქართველოს პრეზიდენტის ადმინისტრაცია - სხვაობა 5.0 3.0 2.0"); // narrative prose after a big gap
    const { rows } = parseAnnualReportRows(lines.join("\n"));
    expect(rows.map((row) => row.code)).toEqual(["00 00", "01 00"]);
  });

  it("normalizes European (space/comma) and US (comma/dot) number formats", () => {
    const text = ["00 00 სულ ჯამი 1 234,5 1 234,5 1 200,0", "25 00 ფინანსთა 574 203,3 574 203,3 574 203,3"].join("\n");
    const { rows } = parseAnnualReportRows(text);
    expect(rows[0].actualThousandGel).toBe(1200);
    expect(rows[1].actualThousandGel).toBe(574203.3);
  });
});

describe("legacy AcadNusx years with Finance-nested debt + combined culture/sport (2007-2009)", () => {
  // [year, total, debt, financeProper, sport, youthDelta] — Finance split three ways; culture
  // ministry split into culture/sport/youth per the sourced department figures.
  const cases: Array<[number, number, number, number, number]> = [
    [2006, 3_822_512_600, 334_908_600, 80_502_200, 4_705_300],
    [2007, 5_237_131_100, 249_205_000, 107_992_100, 8_682_600],
    [2008, 6_758_831_800, 203_689_100, 107_917_400, 15_125_800],
    [2009, 6_754_106_800, 318_057_600, 142_157_500, 11_784_000],
  ];

  for (const [year, total, debt, financeProper, sport] of cases) {
    it(`${year} reconciles, splits Finance three ways, and peels sport/youth from culture`, () => {
      const rows = ANNUAL_REPORT_YEAR_EXTRACTORS[year]();
      const totals = categoryTotals(rows, year);
      expect(Math.round((rows.find((r) => r.isTotal)?.actualThousandGel ?? 0) * 1000)).toBe(total);
      const sum = Object.values(totals).reduce((s, a) => s + a, 0);
      expect(Math.abs(sum - total)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
      expect(totals.debt_service).toBe(debt);
      // Finance is finance-proper only (transfers/reserves went to Other) — comparable across years.
      expect(totals.finance).toBe(financeProper);
      expect(totals.sport).toBe(sport);
      expect(totals.culture).toBeGreaterThan(0);
    });
  }
});

describe("legacy AcadNusx years (2010, 2011) — institution-level", () => {
  it("2011 reconciles and splits debt from the state-wide institution", () => {
    const rows = ANNUAL_REPORT_YEAR_EXTRACTORS[2011]();
    const totals = categoryTotals(rows, 2011);
    const sourceTotal = Math.round((rows.find((r) => r.isTotal)?.actualThousandGel ?? 0) * 1000);
    expect(sourceTotal).toBe(7_459_279_500);
    const sum = Object.values(totals).reduce((s, a) => s + a, 0);
    expect(Math.abs(sum - sourceTotal)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
    expect(totals.debt_service).toBe(428_356_200); // 50 01 + 50 02
    expect(totals.culture).toBeGreaterThan(0);
    expect(totals.sport).toBeGreaterThan(0); // separate ministries in 2011
  });

  it("2010 reconciles with a synthesized total and the 35 00 overflow correction", () => {
    const rows = ANNUAL_REPORT_YEAR_EXTRACTORS[2010]();
    const totals = categoryTotals(rows, 2010);
    // No coded 00 00 in the source; the extractor synthesizes it from the known payments total.
    const sourceTotal = Math.round((rows.find((r) => r.isTotal)?.actualThousandGel ?? 0) * 1000);
    expect(sourceTotal).toBe(6_972_343_800);
    // The 35 00 overflow cell is corrected to its reconstructed total.
    expect(rows.find((r) => r.code === "35 00")?.actualThousandGel).toBe(1_605_041.4);
    const sum = Object.values(totals).reduce((s, a) => s + a, 0);
    expect(Math.abs(sum - sourceTotal)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
    expect(totals.debt_service).toBe(358_555_800); // 53 01 + 53 02
  });
});

describe("2012 annual-report extraction (drill-down, depth capped at 3)", () => {
  const rows = ANNUAL_REPORT_YEAR_EXTRACTORS[2012]();
  const totals = categoryTotals(rows, 2012);
  const totalRow = rows.find((row) => row.isTotal);

  it("reconciles the category sum to the report's 00 00 payments total", () => {
    const categorySum = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
    const sourceTotal = Math.round((totalRow?.actualThousandGel ?? 0) * 1000);
    expect(sourceTotal).toBe(7_806_801_800);
    expect(Math.abs(categorySum - sourceTotal)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
  });

  it("drops depth-4 subprograms (incomplete) so leaf aggregation reconciles", () => {
    const maxGroups = Math.max(...rows.map((row) => (row.code ? row.code.trim().split(/\s+/).length : 0)));
    expect(maxGroups).toBe(3);
  });

  it("splits debt service and keeps culture/sport separate", () => {
    expect(totals.debt_service).toBeGreaterThan(0);
    expect(totals.culture).toBeGreaterThan(0);
    expect(totals.sport).toBeGreaterThan(0);
  });
});

describe("2015 annual-report extraction (full drill-down)", () => {
  const rows = ANNUAL_REPORT_YEAR_EXTRACTORS[2015]();
  const totals = categoryTotals(rows, 2015);
  const totalRow = rows.find((row) => row.isTotal);

  it("reconciles the category sum to the report's 00 00 payments total", () => {
    const categorySum = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
    const sourceTotal = Math.round((totalRow?.actualThousandGel ?? 0) * 1000);
    expect(sourceTotal).toBe(9_703_127_100);
    expect(Math.abs(categorySum - sourceTotal)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
  });

  it("splits debt service out of the state-wide-payments institution", () => {
    // 58 01 external + 58 02 domestic debt service & repayment = 731,023.7k.
    expect(totals.debt_service).toBe(731_023_700);
  });

  it("carries the full program detail (drillDown enabled 2026-07-07)", () => {
    // 121 depth-2 program rows staged across 23 program-carrying institutions (a few carry a
    // zero actual); e.g. general education 32 02 = 485,043.8k. (Whether a program becomes a
    // drill-down FACT is decided later by the corpus-wide 2017+ qualifying threshold, so assert
    // the extracted rows, not the facts.)
    const programRows = rows.filter((row) => row.code && row.depth === 2 && row.actualThousandGel > 0);
    expect(programRows.length).toBeGreaterThan(100);
    const education = programRows.find((row) => row.code === "32 02");
    expect(education?.actualThousandGel).toBe(485_043.8);
  });
});

describe("2016 annual-report extraction", () => {
  const rows = ANNUAL_REPORT_YEAR_EXTRACTORS[2016]();
  const totals = categoryTotals(rows, 2016);
  const totalRow = rows.find((row) => row.isTotal);

  it("reconciles the category sum to the report's 00 00 payments total", () => {
    const categorySum = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
    const sourceTotal = Math.round((totalRow?.actualThousandGel ?? 0) * 1000);
    expect(sourceTotal).toBe(10_292_234_100);
    expect(Math.abs(categorySum - sourceTotal)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
  });

  it("splits debt service out of the state-wide-payments institution (62 00)", () => {
    // 62 01 external + 62 02 domestic debt service & repayment = 740,185.7k.
    expect(totals.debt_service).toBe(740_185_700);
  });

  it("keeps Culture and Sport separate (distinct ministries in 2016) and populates all categories", () => {
    expect(totals.culture).toBeGreaterThan(0);
    expect(totals.sport).toBeGreaterThan(0);
    expect(totals.culture).not.toBe(totals.sport);
    // All 14 admin categories are represented.
    expect(Object.keys(totals).length).toBe(14);
  });

  it("produces program drill-down facts for 2016 (full-depth year)", () => {
    // Drill-down needs the whole series: the modern-presence rule only keeps a 2016 program
    // identity if it also appears in 2017-2025, so this must run over all extracted years.
    const programFacts = generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
      (fact) => fact.level === "major_program" && fact.year === 2016,
    );
    expect(programFacts.length).toBeGreaterThan(0);
    expect(programFacts.every((fact) => fact.officialCode !== null)).toBe(true);
  }, 30_000);
});
