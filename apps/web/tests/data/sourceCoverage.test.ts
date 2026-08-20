import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_SPENDING_YEARS, EXPENDITURE_DETAILED_YEARS, EXPENDITURE_SOURCE_YEARS, EXPENDITURE_TOTAL_ONLY_YEARS, REVENUE_DETAILED_YEARS, REVENUE_SOURCE_YEARS, REVENUE_TOTAL_ONLY_YEARS } from "../../lib/data/coverage";
import { loadSourceDocuments } from "../../lib/data/sources";

const repoRoot = path.resolve(process.cwd(), "../..");

function repoFile(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

describe("2004-2025 source coverage", () => {
  it("has Treasury functional expenditure PDFs for every expenditure year", () => {
    const missing = EXPENDITURE_SOURCE_YEARS.filter(
      (year) =>
        !fs.existsSync(
          repoFile(`docs/Raw Data/Expenditure/treasury.ge/${year}-12-month-state-budget-functional-expenditure.pdf`),
        ),
    );

    expect(missing).toEqual([]);
  });

  it("registers the complete 2004 state-budget sources with their immutable file pins", async () => {
    const expectedSources = [
      {
        sourceId: "source.mof_2004_expenditure_full_state_functional_actual",
        relativePath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf",
        byteSize: 4_169_590,
        sha256: "c999654e8c2a430778e48fe67c1bfc7d15dc30f76a60ceef4477614a31849889",
      },
      {
        sourceId: "source.mof_2004_programmatic_fact_actual",
        relativePath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-report.pdf",
        byteSize: 797_788,
        sha256: "9e368ddd2e873aa020c552a1e8a2d26115cd8e2dd39e97fe5eb7a384d5b5d52e",
      },
    ];
    const registeredSourceIds = new Set(
      (await loadSourceDocuments("../../data/sources/source-documents.csv")).map((source) => source.sourceId),
    );

    for (const source of expectedSources) {
      const absolutePath = repoFile(source.relativePath);
      expect(registeredSourceIds).toContain(source.sourceId);
      expect(fs.statSync(absolutePath).size).toBe(source.byteSize);
      expect(createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex")).toBe(source.sha256);
    }
  });

  it("has Excel ministry/programmatic workbooks for every admin spending year", () => {
    const missing = ADMIN_SPENDING_YEARS.filter(
      (year) => !fs.existsSync(repoFile(`docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/${year}-fact.xlsx`)),
    );

    expect(missing).toEqual([]);
  });

  it("has revenue PDFs for 2005-2025 and intentionally excludes 2004 revenue", () => {
    const missing = REVENUE_SOURCE_YEARS.filter(
      (year) => !fs.existsSync(repoFile(`docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`)),
    );

    expect(fs.existsSync(repoFile("docs/Raw Data/Revenue/2004-jan-dec-consolidated-revenue.pdf"))).toBe(false);
    expect(missing).toEqual([]);
  });
  it("documents explicit old-year coverage tiers", () => {
    expect(EXPENDITURE_TOTAL_ONLY_YEARS).toEqual([]);
    expect(EXPENDITURE_DETAILED_YEARS[0]).toBe(2005);
    expect(REVENUE_TOTAL_ONLY_YEARS).toEqual([]);
    expect(REVENUE_DETAILED_YEARS[0]).toBe(2005);
    // Ministries backfill: 2005-2016 all covered (2005 AcadNusx ministry totals; 2006-2012 Group C
    // annual-execution reports; 2013/2014 organizational actuals; 2015/2016 tavi-VI reports). Only
    // 2004 is excluded — a scope decision (central-budget-only source), not an extraction gap.
    expect(ADMIN_SPENDING_YEARS[0]).toBe(2005);
    expect(REVENUE_DETAILED_YEARS).toEqual(REVENUE_SOURCE_YEARS);
    expect(ADMIN_SPENDING_YEARS).toContain(2005);
    expect(ADMIN_SPENDING_YEARS).toContain(2006);
    expect(ADMIN_SPENDING_YEARS).toContain(2009);
    expect(ADMIN_SPENDING_YEARS).toContain(2012);
    expect(ADMIN_SPENDING_YEARS).toContain(2016);
    expect(ADMIN_SPENDING_YEARS).not.toContain(2004);
    // 2005-2025 is now contiguous for ministries.
    expect(ADMIN_SPENDING_YEARS).toEqual([...Array(21)].map((_, index) => 2005 + index));
  });
});
