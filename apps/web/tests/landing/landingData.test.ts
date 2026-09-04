import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { Municipality, MunicipalTotalFact } from "../../lib/data/municipal/types";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { buildLandingContext, buildLandingModel } from "../../lib/landing/landingData";
import type {
  ServedBudgetFact,
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
} from "../../lib/servedRows";

function glossaryEntry(id: string, kaLabel: string): [string, GlossaryEntry] {
  return [id, { id, kaLabel, enLabel: id, description: "", notes: "" }];
}

const glossary = new Map<string, GlossaryEntry>([
  glossaryEntry("spending.alpha", "ალფა"),
  glossaryEntry("spending.beta", "ბეტა"),
  glossaryEntry("spending.gamma", "გამა"),
  glossaryEntry("spending.delta", "დელტა"),
  glossaryEntry("spending.epsilon", "ეფსილონი"),
  glossaryEntry("revenue.alpha", "შემოსავალი ა"),
  glossaryEntry("revenue.beta", "შემოსავალი ბ"),
  glossaryEntry("revenue.gamma", "შემოსავალი გ"),
  glossaryEntry("revenue.delta", "შემოსავალი დ"),
  glossaryEntry("revenue.epsilon", "შემოსავალი ე"),
  glossaryEntry("spending.missing", "მონაცემის გარეშე"),
]);

const sourceDocuments: SourceDocumentRow[] = [
  { sourceId: "source.a", sourceName: "A", sourceUrlOrFile: "docs/a", lastReviewedAt: "2026-05-10" },
  { sourceId: "source.b", sourceName: "B", sourceUrlOrFile: "docs/b", lastReviewedAt: "2026-06-01" },
];

const facts: ServedBudgetFact[] = [
  { year: 2025, side: "expenditure", itemId: "spending.alpha", amountGel: 400, basis: "planned", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.alpha", amountGel: 40, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.beta", amountGel: 40, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.gamma", amountGel: 30, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.delta", amountGel: 20, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.epsilon", amountGel: 10, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "expenditure.total", amountGel: 999, basis: "planned", sourceId: "source.a" },
  { year: 2026, side: "expenditure", itemId: "expenditure.total", amountGel: 1_100, basis: "actual", sourceId: "source.a" },
  { year: 2004, side: "revenue", itemId: "revenue.alpha", amountGel: 1, basis: "actual", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.alpha", amountGel: 50, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.beta", amountGel: 20, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.gamma", amountGel: 15, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.delta", amountGel: 10, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.epsilon", amountGel: 5, basis: "planned", sourceId: "source.a" },
  { year: 2026, side: "revenue", itemId: "revenue.total", amountGel: 120, basis: "actual", sourceId: "source.a" },
];

const municipalities: Municipality[] = [
  { code: "10", sortId: 10, nameKa: "არაქალაქი", displayNameKa: "არაქალაქი", regionId: "region.a", isSelfGoverningCity: false },
  { code: "11", sortId: 11, nameKa: "ქალაქი", displayNameKa: "ქალაქი", regionId: "region.a", isSelfGoverningCity: true },
  { code: "12", sortId: 12, nameKa: "მუნიციპალიტეტი 12", displayNameKa: "მუნიციპალიტეტი 12", regionId: "region.b", isSelfGoverningCity: false },
  { code: "13", sortId: 13, nameKa: "მუნიციპალიტეტი 13", displayNameKa: "მუნიციპალიტეტი 13", regionId: "region.b", isSelfGoverningCity: false },
  { code: "14", sortId: 14, nameKa: "მუნიციპალიტეტი 14", displayNameKa: "მუნიციპალიტეტი 14", regionId: "region.c", isSelfGoverningCity: false },
  { code: "15", sortId: 15, nameKa: "ფაქტის გარეშე", displayNameKa: "ფაქტის გარეშე", regionId: "region.c", isSelfGoverningCity: false },
];

function municipalTotal(year: number, municipalityCode: string, publicTotalGel: number): MunicipalTotalFact {
  return {
    year,
    municipalityCode,
    publicTotalGel,
    publicTotalMeasure: "total_payments",
    totalPaymentsGel: publicTotalGel,
    expensesGel: null,
    nonfinancialAssetGrowthGel: null,
    financialAssetGrowthGel: null,
    liabilityDecreaseGel: null,
    functionalSumGel: publicTotalGel,
    reconciliationDifferenceGel: null,
    warningAmountGel: null,
    showWarning: false,
    warningType: "none",
    basis: "actual",
    sourceId: "source.municipal",
  };
}

const municipalTotalFacts = [
  municipalTotal(2026, "11", 250),
  municipalTotal(2026, "10", 250),
  municipalTotal(2026, "12", 200),
  municipalTotal(2026, "13", 150),
  municipalTotal(2026, "14", 100),
];

const municipalCountryTotalFacts = [municipalTotal(2025, "country.georgia", 900), municipalTotal(2026, "country.georgia", 1_000)];

const debtFacts: ServedGovernmentDebtFact[] = [
  {
    year: 2024,
    family: "stock",
    seriesId: "debt.stock.total",
    value: 900,
    valueKind: "amount_gel",
    status: "actual",
    sourceId: "source.debt",
    snapshotDate: "2024-12-31",
    lastReviewedAt: "2026-07-01",
  },
  {
    year: 2025,
    family: "stock",
    seriesId: "debt.stock.domestic",
    value: 300,
    valueKind: "amount_gel",
    status: "actual",
    sourceId: "source.debt",
    snapshotDate: "2025-12-31",
    lastReviewedAt: "2026-07-01",
  },
  {
    year: 2025,
    family: "stock",
    seriesId: "debt.stock.external",
    value: 700,
    valueKind: "amount_gel",
    status: "actual",
    sourceId: "source.debt",
    snapshotDate: "2025-12-31",
    lastReviewedAt: "2026-07-01",
  },
  {
    year: 2025,
    family: "stock",
    seriesId: "debt.stock.total",
    value: 1_000,
    valueKind: "amount_gel",
    status: "actual",
    sourceId: "source.debt",
    snapshotDate: "2025-12-31",
    lastReviewedAt: "2026-07-01",
  },
];

const balanceFacts: ServedGeneralGovernmentBalanceFact[] = [
  {
    year: 2023,
    generalGovernmentBalancePctGdp: -2.329,
    generalGovernmentBalanceGel: -1_883,
    status: "actual",
    sourceId: "source.balance",
    lastReviewedAt: "2026-09-04",
  },
  {
    year: 2024,
    generalGovernmentBalancePctGdp: -2.267,
    generalGovernmentBalanceGel: -2_109,
    status: "actual",
    sourceId: "source.balance",
    lastReviewedAt: "2026-09-04",
  },
  {
    year: 2025,
    generalGovernmentBalancePctGdp: -1.455,
    generalGovernmentBalanceGel: -1_526,
    status: "actual",
    sourceId: "source.balance",
    lastReviewedAt: "2026-09-04",
  },
  {
    year: 2026,
    generalGovernmentBalancePctGdp: -2.327,
    generalGovernmentBalanceGel: -2_672,
    status: "projection",
    sourceId: "source.balance",
    lastReviewedAt: "2026-09-04",
  },
];

describe("landing model", () => {
  const model = buildLandingModel({
    facts,
    glossary,
    sourceDocuments,
    municipalities,
    municipalTotalFacts,
    municipalCountryTotalFacts,
    debtFacts,
    balanceFacts,
  });

  it("uses the active explicit total for the latest detail year", () => {
    expect(model.expenditure).toMatchObject({ latestYear: 2025, totalGel: 999, basis: "mixed" });
    expect(model.expenditure.rows.map((row) => row.id)).toEqual([
      "spending.alpha",
      "spending.beta",
      "spending.gamma",
      "spending.delta",
    ]);
    expect(model.expenditure.rows[0]).toMatchObject({ labelKa: "ალფა", amountGel: 40 });
    expect(model.expenditure.rows[0]!.share).toBeCloseTo(40 / 999);
  });

  it("falls back to the latest detail sum when an explicit total is absent", () => {
    expect(model.revenue).toMatchObject({ latestYear: 2024, totalGel: 100, basis: "planned" });
    expect(model.revenue.rows).toHaveLength(4);
  });

  it("keeps shared context and independently derived latest years", () => {
    expect(model.yearsLabel).toBe("2004–2024");
    expect(model.updatedAt).toBe("2026-06-01");
  });

  it("uses the Georgia aggregate and ranks every eligible municipality", () => {
    expect(model.municipalities).toMatchObject({ latestYear: 2026, totalGel: 1_000, basis: "actual" });
    expect(model.municipalities.rows.map((row) => row.id)).toEqual(["10", "11", "12", "13"]);
    expect(model.municipalities.rows[0]).toEqual({
      id: "10",
      labelKa: "არაქალაქი",
      amountGel: 250,
      share: 0.25,
    });
    expect(model.municipalities.rows.some((row) => row.id === "15")).toBe(false);
  });

  it("uses the latest actual debt stock and preserves its domestic and external split", () => {
    expect(model.debt).toEqual({
      latestYear: 2025,
      totalGel: 1_000,
      domesticGel: 300,
      externalGel: 700,
    });
  });

  it("keeps deficit projections off the homepage summary", () => {
    expect(model.deficit).toEqual({
      latestActualYear: 2025,
      percentGdp: -1.455,
      recentActual: [
        { year: 2023, percentGdp: -2.329 },
        { year: 2024, percentGdp: -2.267 },
        { year: 2025, percentGdp: -1.455 },
      ],
    });
  });

  it("fails instead of presenting a missing debt stock component as zero", () => {
    expect(() =>
      buildLandingModel({
        facts,
        glossary,
        sourceDocuments,
        municipalities,
        municipalTotalFacts,
        municipalCountryTotalFacts,
        debtFacts: debtFacts.filter((fact) => fact.seriesId !== "debt.stock.external"),
        balanceFacts,
      }),
    ).toThrow("Missing debt.stock.external for 2025");
  });
});

describe("landing context", () => {
  it("keeps shared page metadata available without municipal facts", () => {
    expect(buildLandingContext({ facts, sourceDocuments })).toEqual({
      yearsLabel: "2004–2024",
      updatedAt: "2026-06-01",
    });
  });
});
