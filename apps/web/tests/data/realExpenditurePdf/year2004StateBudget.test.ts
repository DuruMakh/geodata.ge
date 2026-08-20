import { beforeAll, describe, expect, it } from "vitest";
import {
  loadYear2004StateBudget,
  parseYear2004StateBudget,
} from "../../../lib/data/realExpenditurePdf/year2004StateBudget";
import { readPdfTextPages, type ExpenditurePdfPageText } from "../../../lib/data/realExpenditurePdf/phase1Pilot";

const annexFile = "../../docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf";
const centralFile = "../../docs/Raw Data/Expenditure/treasury.ge/2004-12-month-state-budget-functional-expenditure.pdf";

const expectedSpendingFieldIds = [
  "spending.agriculture_environment",
  "spending.culture",
  "spending.debt_service",
  "spending.defence",
  "spending.economic_affairs",
  "spending.education",
  "spending.general_public_services",
  "spending.health",
  "spending.infrastructure_regional_development",
  "spending.other_unclassified",
  "spending.public_order_safety",
  "spending.social_protection",
  "spending.sport",
];

describe("2004 complete state-budget functional expenditure", () => {
  let annexPages: ExpenditurePdfPageText[];
  let centralPages: ExpenditurePdfPageText[];

  beforeAll(async () => {
    [annexPages, centralPages] = await Promise.all([
      readPdfTextPages(annexFile).then((pdf) => pdf.pages),
      readPdfTextPages(centralFile).then((pdf) => pdf.pages),
    ]);
  });

  it("parses the complete state-budget actual column and preserves the reviewed source pins", async () => {
    const result = await loadYear2004StateBudget();

    expect(result.grandTotalGel).toBe(1_930_210_300);
    expect(result.groupTotalsGel.get(5)).toBe(147_362_300);
    expect(result.groupTotalsGel.get(6)).toBe(364_257_700);
    expect(result.groupTotalsGel.get(12)).toBe(67_416_800);
  });

  it("maps every public spending field exactly once without emitting a central-budget total", async () => {
    const result = await loadYear2004StateBudget();
    const factIds = result.facts.map((row) => row.item_id).sort();
    const amounts = result.facts.map((row) => Number(row.amount_gel));

    expect(result.facts).toHaveLength(13);
    expect(factIds).toEqual(expectedSpendingFieldIds);
    expect(new Set(factIds).size).toBe(expectedSpendingFieldIds.length);
    expect(amounts.every((amount) => amount >= 0)).toBe(true);
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(1_930_210_300);
    expect(result.facts.every((row) => row.source_id === "source.mof_2004_expenditure_full_state_functional_actual")).toBe(true);
    expect(result.facts.some((row) => row.item_id === "expenditure.total")).toBe(false);
    expect(amounts).not.toContain(1_513_216_526);
    expect(amounts).not.toContain(1_514_348_500);
  });

  it("keeps the printed rounding difference explicit and only in the residual category", async () => {
    const result = await loadYear2004StateBudget();
    const roundedGroupTotalGel = [...result.groupTotalsGel.values()].reduce((sum, amount) => sum + amount, 0);
    const residualFact = result.facts.find((row) => row.item_id === "spending.other_unclassified");

    expect(roundedGroupTotalGel).toBe(1_930_210_400);
    expect(result.roundingAdjustmentGel).toBe(result.grandTotalGel - roundedGroupTotalGel);
    expect(result.roundingAdjustmentGel).toBe(-100);
    expect(residualFact?.amount_gel).toBe("12510400");
    expect(residualFact?.mapping_notes).toContain("-100 GEL source-table rounding reconciliation");
    expect(result.reviewRows.find((row) => row.code === "14.0.0")?.mappingReason).toContain(
      "-100 GEL source-table rounding reconciliation",
    );
  });

  it("pins the exact supporting carve-outs rather than absorbing a wrong column into parent remainders", async () => {
    const result = await loadYear2004StateBudget();
    const reviewAmount = (code: string) => result.reviewRows.find((row) => row.code === code)?.actualGel;

    expect(reviewAmount("8.1.1")).toBe(6_866_000);
    expect(reviewAmount("14.1.0")).toBe(291_350_100);
    expect(reviewAmount("14.2.0")).toBe(128_234_000);
  });

  it("rejects a missing full-state functional group", () => {
    const pages = annexPages.map((page) =>
      page.pageNumber === 232
        ? {
            ...page,
            text: page.text.replace(/05 00 janmrTelobis dacva[\s\S]*?xarji 147 362,3[^\n]*\n/, ""),
          }
        : page,
    );

    expect(() => parseYear2004StateBudget({ annexPages: pages, centralPages })).toThrow(
      "Missing 2004 full-state functional group 05",
    );
  });

  it("rejects a duplicate full-state functional group", () => {
    const pages = annexPages.map((page) =>
      page.pageNumber === 232
        ? {
            ...page,
            text: page.text.replace(
              /(05 00 janmrTelobis dacva[^\n]*\nxarji 147 362,3[^\n]*\n)/,
              "$1$1",
            ),
          }
        : page,
    );

    expect(() => parseYear2004StateBudget({ annexPages: pages, centralPages })).toThrow(
      "Duplicate 2004 full-state functional group 05",
    );
  });
});
