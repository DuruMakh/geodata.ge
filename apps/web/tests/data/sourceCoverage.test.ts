import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_SPENDING_YEARS, EXPENDITURE_DETAILED_YEARS, EXPENDITURE_SOURCE_YEARS, EXPENDITURE_TOTAL_ONLY_YEARS, REVENUE_DETAILED_YEARS, REVENUE_SOURCE_YEARS, REVENUE_TOTAL_ONLY_YEARS } from "../../lib/data/coverage";

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
    expect(EXPENDITURE_TOTAL_ONLY_YEARS).toEqual([2004, 2005]);
    expect(EXPENDITURE_DETAILED_YEARS[0]).toBe(2017);
    expect(REVENUE_TOTAL_ONLY_YEARS).toEqual([2005]);
    expect(REVENUE_DETAILED_YEARS[0]).toBe(2006);
    expect(ADMIN_SPENDING_YEARS[0]).toBe(2017);
    expect(REVENUE_DETAILED_YEARS).toEqual(expect.arrayContaining([2008, 2009, 2010, 2011, 2012, 2014, 2015, 2016]));
    expect(REVENUE_DETAILED_YEARS).not.toContain(2013);
    expect(ADMIN_SPENDING_YEARS).not.toContain(2012);
    expect(ADMIN_SPENDING_YEARS).not.toContain(2013);
  });
});
