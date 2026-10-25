import { describe, expect, it } from "vitest";
import { classifyAdminSpendingCategory } from "../../../lib/data/adminSpending/categories";
import { extractAdminSpendingOfficialRows } from "../../../lib/data/adminSpending/extractWorkbooks";
import {
  ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL,
  buildAdminSpendingReport,
  generateAdminSpendingFacts,
  unexecutedPlanRows,
} from "../../../lib/data/adminSpending/generateAdminSpendingFacts";
import { loadAdminSpendingFacts } from "../../../lib/data/adminSpending/importAdminSpendingFacts";
import type { AdminSpendingFact } from "../../../lib/data/adminSpending/types";
import { lawTavi6OfficialRows } from "../../../lib/data/budgetLaw/lawRows";
import { PLANNED_BUDGET_YEARS } from "../../../lib/data/coverage";
import { readCsvRecords } from "../../../lib/data/csv";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

// The 2026 law's Article 2 payments total, which is also its Tavi VI "00 00" grand total.
const NATIONAL_2026_TOTAL_GEL = 30_881_358_000;
const CONCORDANCE_PATH = "../../data/mappings/review/admin-spending-program-concordance-2026.csv";

// Extraction re-reads every fact workbook; the whole file shares one pass. Treat as read-only.
let cached: { rows2026: OfficialExpenditureRow[]; allRows: OfficialExpenditureRow[]; facts: AdminSpendingFact[] } | null =
  null;
function generated() {
  if (!cached) {
    const rows2026 = lawTavi6OfficialRows();
    const allRows = [...extractAdminSpendingOfficialRows(), ...rows2026];
    cached = { rows2026, allRows, facts: generateAdminSpendingFacts(allRows, { plannedYears: PLANNED_BUDGET_YEARS }) };
  }
  return cached;
}
const facts2026 = () => generated().facts.filter((fact) => fact.year === 2026);
const historicalFacts = () => generated().facts.filter((fact) => fact.year <= 2025);
const programFact = (year: number, officialCode: string) =>
  generated().facts.find((fact) => fact.year === year && fact.level === "major_program" && fact.officialCode === officialCode);

describe("2026 planned spending by ministry from the budget law", () => {
  it("adds up the 2026 ministry categories to the law's 30,881,358.0 thousand GEL total", () => {
    const { rows2026, facts } = generated();
    const categoryTotal = facts2026()
      .filter((fact) => fact.level === "admin_category")
      .reduce((sum, fact) => sum + fact.amountGel, 0);
    const report = buildAdminSpendingReport(rows2026, facts.filter((fact) => fact.year === 2026));

    expect(Math.abs(categoryTotal - NATIONAL_2026_TOTAL_GEL)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
    expect(report.sourceTotalGelByYear[2026]).toBe(NATIONAL_2026_TOTAL_GEL);
    expect(report.reconciliationStatusByYear[2026]).toBe("passed");
    expect(facts2026().every((fact) => fact.basis === "planned" && fact.sourceId === "source.mof_2026_budget_law_planned")).toBe(
      true,
    );
  }, 60_000);

  it("pins the 14 category amounts to the independent re-derivation from the law's Tavi VI", () => {
    // Figures re-derived by the independent data audit (2026-10-24) from the law itself, not from the generated CSV.
    const lawCategoryAmountsGel: Record<string, number> = {
      "admin_spending.health_social_affairs": 9_668_640_000,
      "admin_spending.debt_service": 4_733_000_000,
      "admin_spending.other_costs": 3_868_879_000,
      "admin_spending.regional_development_infrastructure": 3_246_550_000,
      "admin_spending.education_science_youth": 2_702_198_000,
      "admin_spending.defence": 1_890_000_000,
      "admin_spending.internal_affairs": 1_547_000_000,
      "admin_spending.economy_sustainable_development": 928_550_000,
      "admin_spending.environment_agriculture": 808_161_000,
      "admin_spending.justice": 443_235_000,
      "admin_spending.culture": 364_835_000,
      "admin_spending.sport": 325_310_000,
      "admin_spending.foreign_affairs": 225_000_000,
      "admin_spending.finance": 130_000_000,
    };
    const categories = facts2026().filter((fact) => fact.level === "admin_category");

    expect(Object.fromEntries(categories.map((fact) => [fact.itemId, fact.amountGel]))).toEqual(lawCategoryAmountsGel);
    expect(Object.values(lawCategoryAmountsGel).reduce((sum, amount) => sum + amount, 0)).toBe(NATIONAL_2026_TOTAL_GEL);
  }, 60_000);

  it("ignores the uncoded Tavi VI headcount and economic-breakdown rows", () => {
    const { rows2026 } = generated();
    const headcountRows = rows2026.filter((row) => row.labelKa === "მომუშავეთა რიცხოვნობა");

    expect(headcountRows).toHaveLength(170);
    expect(headcountRows.every((row) => row.code === null && !row.isLeafCode)).toBe(true);
    // No uncoded row reaches a fact: every 2026 fact traces to a coded row.
    const codedLeafTotal = rows2026
      .filter((row) => row.code && row.isLeafCode && !row.isTotal)
      .reduce((sum, row) => sum + Math.round(row.actualThousandGel * 1000), 0);
    expect(codedLeafTotal).toBe(NATIONAL_2026_TOTAL_GEL);
  }, 60_000);

  it("books the 2026 Infrastructure (25 00) and Regional Development (35 00) ministries outside other costs", () => {
    const { rows2026 } = generated();
    const ministryLeaves = rows2026.filter(
      (row) => (row.institutionCode === "25 00" || row.institutionCode === "35 00") && row.isLeafCode && row.actualThousandGel > 0,
    );
    const regional2026 = facts2026().find((fact) => fact.itemId === "admin_spending.regional_development_infrastructure");

    expect(ministryLeaves.length).toBeGreaterThan(0);
    expect(ministryLeaves.map(classifyAdminSpendingCategory).filter((id) => id === "admin_spending.other_costs")).toEqual([]);
    expect(regional2026?.amountGel).toBe(3_113_650_000 + 132_900_000);
  }, 60_000);

  it("leaves every 2004-2025 fact equal to the committed admin-spending-facts-2004-2025.csv, row for row", async () => {
    const committed = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2004-2025.csv");
    expect(historicalFacts()).toEqual(committed);
  }, 60_000);

  it("ships the generated 2026 facts in admin-spending-facts-2026-planned.csv", async () => {
    const committed = await loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2026-planned.csv");
    expect(committed).toEqual(facts2026());
  }, 60_000);

  it("continues the 2025 57 01 external debt service series with the 2026 54 01 row", () => {
    const debt2026 = programFact(2026, "54 01");
    expect(debt2026?.itemId).toBeDefined();
    expect(debt2026?.itemId).toBe(programFact(2025, "57 01")?.itemId);
  }, 60_000);

  it("gives no 2026 fact from institution 57 00 an item id of a 2004-2025 fact", () => {
    // The 2026 law prints 57 00 (Civil Service Bureau) at 0.0 with no programmes; a change in the
    // law's structure that gives a 57 xx row an amount must be reviewed, not pass silently.
    const { rows2026 } = generated();
    expect(rows2026.filter((row) => row.code?.startsWith("57 ") && row.actualThousandGel > 0)).toEqual([]);
    const historicalIds = new Set(historicalFacts().map((fact) => fact.itemId));
    const shared = facts2026().filter((fact) => fact.officialInstitutionCode === "57 00" && historicalIds.has(fact.itemId));
    expect(shared).toEqual([]);
  }, 60_000);

  it("joins every concordance join row to its 2025 series and keeps every other row apart", async () => {
    const concordance = await readCsvRecords(CONCORDANCE_PATH);
    const historicalIds = new Set(historicalFacts().map((fact) => fact.itemId));
    const joins = concordance.filter((row) => row.decision === "join");

    expect(joins.length).toBeGreaterThan(0);
    expect(concordance.every((row) => ["join", "new", "separate"].includes(row.decision))).toBe(true);
    for (const row of joins) {
      const fact = programFact(2026, row.code_2026);
      expect(fact?.itemId, row.code_2026).toBeDefined();
      expect(fact?.itemId, row.code_2026).toBe(programFact(2025, row.code_2025)?.itemId);
    }
    for (const row of concordance.filter((entry) => entry.decision !== "join")) {
      const fact = programFact(2026, row.code_2026);
      if (fact) expect(historicalIds.has(fact.itemId), row.code_2026).toBe(false);
    }
  }, 60_000);

  it("reviews every 2026 programme of at least 100M GEL and every 2026 drill-down point in the concordance", async () => {
    const concordance = await readCsvRecords(CONCORDANCE_PATH);
    const byCode = new Map(concordance.map((row) => [row.code_2026, row]));
    const { rows2026 } = generated();
    const programmes = rows2026.filter((row) => row.code && row.depth === 2);
    const large = programmes.filter((row) => row.actualThousandGel >= 100_000).map((row) => row.code);
    const drillDown = facts2026()
      .filter((fact) => fact.level === "major_program")
      .map((fact) => fact.officialCode);

    expect(large.filter((code) => !byCode.has(code as string))).toEqual([]);
    expect(drillDown.filter((code) => !byCode.has(code as string))).toEqual([]);
    for (const row of concordance) {
      const programme = programmes.find((candidate) => candidate.code === row.code_2026);
      expect(programme?.labelKa, row.code_2026).toBe(row.label_2026);
      expect(Math.round((programme?.actualThousandGel ?? 0) * 1000), row.code_2026).toBe(Number(row.amount_2026_gel));
      expect(row.note.length, row.code_2026).toBeGreaterThan(0);
    }
  }, 60_000);
});

describe("when the 2026 execution report arrives", () => {
  it("keeps the plan rows today, while 2026 has no execution rows", () => {
    const { rows2026, allRows } = generated();
    const executionRows = allRows.slice(0, allRows.length - rows2026.length);

    expect(unexecutedPlanRows(executionRows, rows2026, PLANNED_BUDGET_YEARS)).toEqual({ plannedYears: PLANNED_BUDGET_YEARS, planRows: rows2026 });
  }, 60_000);

  it("generates 2026 as actual from its execution rows, leaves the plan rows out and still reconciles", () => {
    const { rows2026, allRows } = generated();
    // Stand-in execution rows for 2026: the law's own rows under an execution source id.
    const executionRows = [
      ...allRows.slice(0, allRows.length - rows2026.length),
      ...rows2026.map((row) => ({ ...row, sourceId: "source.mof_2026_programmatic_fact_actual" })),
    ];
    const { plannedYears, planRows } = unexecutedPlanRows(executionRows, rows2026, PLANNED_BUDGET_YEARS);
    const facts = generateAdminSpendingFacts([...executionRows, ...planRows], { plannedYears });
    const report = buildAdminSpendingReport(executionRows, facts);

    expect(plannedYears).toEqual([]);
    expect(planRows).toEqual([]);
    expect(facts.filter((fact) => fact.year === 2026).every((fact) => fact.basis === "actual")).toBe(true);
    expect(report.reconciliationStatusByYear[2026]).toBe("passed");
    expect(Object.values(report.reconciliationStatusByYear).every((status) => status === "passed")).toBe(true);
  }, 60_000);
});
