import { describe, expect, it } from "vitest";
import type { MunicipalTotalFact } from "../../lib/data/municipal/types";
import {
  FUTURE_METHODOLOGY_DATASETS,
  LIVE_METHODOLOGY_IDS,
  METHODOLOGY_CONTENT,
  buildMethodologyHubEntries,
  deriveMethodologyCoverage,
  validateDecisionCoverage,
} from "../../lib/methodology/catalog";
import type {
  DecisionRegisterRow,
  MethodologyArchiveSummary,
} from "../../lib/methodology/types";
import type { ServedBudgetFact } from "../../lib/servedRows";

const budgetFacts: ServedBudgetFact[] = [
  { year: 2005, side: "expenditure", itemId: "spending.health", amountGel: 1, basis: "actual", sourceId: "source.1" },
  { year: 2025, side: "expenditure", itemId: "spending.health", amountGel: 2, basis: "actual", sourceId: "source.2" },
  { year: 2005, side: "revenue", itemId: "revenue.vat", amountGel: 3, basis: "actual", sourceId: "source.3" },
  { year: 2025, side: "revenue", itemId: "revenue.vat", amountGel: 4, basis: "actual", sourceId: "source.4" },
];

const municipalFact = (year: number): MunicipalTotalFact => ({
  year,
  municipalityCode: "04",
  publicTotalGel: 1,
  publicTotalMeasure: "total_payments",
  totalPaymentsGel: 1,
  expensesGel: 1,
  nonfinancialAssetGrowthGel: 0,
  financialAssetGrowthGel: 0,
  liabilityDecreaseGel: 0,
  functionalSumGel: 1,
  reconciliationDifferenceGel: 0,
  warningAmountGel: null,
  showWarning: false,
  warningType: "none",
  basis: "actual",
  sourceId: "source.municipal",
});

const municipalFacts = [municipalFact(2015), municipalFact(2025)];

const validCanonicalDocument = "docs/data-methodology/revenue-methodology.md";
const validCanonicalHeading = "6.1 Publish the consolidated column";

const registerRow = (overrides: Partial<DecisionRegisterRow> = {}): DecisionRegisterRow => ({
  canonicalDecisionId: "revenue.scope.consolidated",
  datasetId: "revenue",
  canonicalDocument: validCanonicalDocument,
  canonicalHeading: validCanonicalHeading,
  publicDecisionId: "revenue.scope.consolidated",
  classification: "official_fact",
  reviewedAt: "2026-08-11",
  ...overrides,
});

describe("methodology catalog", () => {
  it("exposes only the three approved live datasets", () => {
    expect(LIVE_METHODOLOGY_IDS).toEqual(["expenditure", "revenue", "municipalities"]);
    expect(Object.keys(METHODOLOGY_CONTENT)).toEqual(LIVE_METHODOLOGY_IDS);
    expect(FUTURE_METHODOLOGY_DATASETS).toEqual([
      { titleKa: "ინფლაცია", href: null, state: "future" },
      { titleKa: "მშპ", href: null, state: "future" },
      { titleKa: "მოსახლეობა", href: null, state: "future" },
      { titleKa: "უმუშევრობა", href: null, state: "future" },
    ]);
  });

  it("keeps the approved layered section order", () => {
    for (const content of Object.values(METHODOLOGY_CONTENT)) {
      expect(content.sections.map((section) => section.kind)).toEqual([
        "scope",
        "sources",
        "journey",
        "decisions",
        "classification",
        "validation",
        "limitations",
        "archive",
      ]);
    }
  });

  it("covers every canonical decision exactly through a public entry", async () => {
    const result = await validateDecisionCoverage();
    expect(result).toEqual({
      canonicalDecisionCount: result.publicMappingCount,
      uncovered: [],
      unknownPublicIds: [],
    });
  });

  it.each([
    {
      name: "duplicate canonical IDs",
      rows: [registerRow(), registerRow()],
      message: /duplicate canonical decision id/i,
    },
    {
      name: "missing canonical files",
      rows: [registerRow({ canonicalDocument: "docs/data-methodology/does-not-exist.md" })],
      message: /canonical document does not exist/i,
    },
    {
      name: "missing canonical headings",
      rows: [registerRow({ canonicalHeading: "Heading that is absent" })],
      message: /canonical heading does not exist/i,
    },
    {
      name: "unknown public IDs",
      rows: [registerRow({ publicDecisionId: "revenue.unknown" })],
      message: /unknown public decision id/i,
    },
    {
      name: "dataset mismatches",
      rows: [registerRow({ datasetId: "expenditure" })],
      message: /dataset mismatch/i,
    },
    {
      name: "uncovered canonical rows",
      rows: [registerRow({ canonicalDecisionId: "revenue.unmapped.canonical-choice" })],
      message: /uncovered canonical decision/i,
    },
  ])("rejects $name", async ({ rows, message }) => {
    await expect(validateDecisionCoverage(rows)).rejects.toThrow(message);
  });

  it("derives coverage from the facts for each live dataset", () => {
    expect(deriveMethodologyCoverage("expenditure", budgetFacts, municipalFacts)).toEqual({ firstYear: 2005, lastYear: 2025 });
    expect(deriveMethodologyCoverage("revenue", budgetFacts, municipalFacts)).toEqual({ firstYear: 2005, lastYear: 2025 });
    expect(deriveMethodologyCoverage("municipalities", budgetFacts, municipalFacts)).toEqual({ firstYear: 2015, lastYear: 2025 });
  });

  it("rejects live datasets without served years", () => {
    expect(() => deriveMethodologyCoverage("revenue", [], municipalFacts)).toThrow(/no served years/i);
  });

  it("builds live hub rows from facts, content metadata, and validated archives", () => {
    const archives: Record<(typeof LIVE_METHODOLOGY_IDS)[number], MethodologyArchiveSummary> = {
      expenditure: { fileCount: 42, totalBytes: 100, latestRetrievedAt: "2026-08-10", validated: true },
      revenue: { fileCount: 21, totalBytes: 200, latestRetrievedAt: "2026-08-09", validated: true },
      municipalities: { fileCount: 80, totalBytes: 300, latestRetrievedAt: "2026-08-08", validated: true },
    };

    expect(buildMethodologyHubEntries({ budgetFacts, municipalFacts, archives })).toEqual([
      {
        id: "expenditure",
        titleKa: METHODOLOGY_CONTENT.expenditure.titleKa,
        summaryKa: METHODOLOGY_CONTENT.expenditure.summaryKa,
        href: "/methodology/expenditure",
        coverage: { firstYear: 2005, lastYear: 2025 },
        originalFileCount: 42,
        reviewedAt: METHODOLOGY_CONTENT.expenditure.reviewedAt,
      },
      {
        id: "revenue",
        titleKa: METHODOLOGY_CONTENT.revenue.titleKa,
        summaryKa: METHODOLOGY_CONTENT.revenue.summaryKa,
        href: "/methodology/revenue",
        coverage: { firstYear: 2005, lastYear: 2025 },
        originalFileCount: 21,
        reviewedAt: METHODOLOGY_CONTENT.revenue.reviewedAt,
      },
      {
        id: "municipalities",
        titleKa: METHODOLOGY_CONTENT.municipalities.titleKa,
        summaryKa: METHODOLOGY_CONTENT.municipalities.summaryKa,
        href: "/methodology/municipalities",
        coverage: { firstYear: 2015, lastYear: 2025 },
        originalFileCount: 80,
        reviewedAt: METHODOLOGY_CONTENT.municipalities.reviewedAt,
      },
    ]);
  });

  it("rejects a hub row without a validated archive", () => {
    const archives = {
      expenditure: { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-08-10", validated: true },
      revenue: { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-08-10", validated: false },
      municipalities: { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-08-10", validated: true },
    } satisfies Record<(typeof LIVE_METHODOLOGY_IDS)[number], MethodologyArchiveSummary>;

    expect(() => buildMethodologyHubEntries({ budgetFacts, municipalFacts, archives })).toThrow(/validated archive/i);
  });
});
