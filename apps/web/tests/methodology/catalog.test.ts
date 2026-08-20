import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { MunicipalTotalFact } from "../../lib/data/municipal/types";
import {
  FUTURE_METHODOLOGY_DATASETS,
  LIVE_METHODOLOGY_IDS,
  METHODOLOGY_CONTENT,
  buildMethodologyHubEntries,
  deriveMethodologyCoverage,
} from "../../lib/methodology/catalog";
import { validateDecisionCoverage } from "../../lib/methodology/decisionCoverage";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
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
const repositoryRoot = path.resolve(process.cwd(), "../..");

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

  it("keeps the retained article sections in their approved order", () => {
    expect(METHODOLOGY_CONTENT.expenditure.sections.map((section) => section.kind)).toEqual([
      "scope",
      "sources",
      "journey",
      "decisions",
      "classification",
      "validation",
      "limitations",
      "archive",
    ]);

    expect(METHODOLOGY_CONTENT.revenue.sections.map((section) => section.kind)).toEqual([
      "scope",
      "sources",
      "journey",
      "decisions",
      "archive",
    ]);

    expect(METHODOLOGY_CONTENT.municipalities.sections.map((section) => section.kind)).toEqual([
      "scope",
      "sources",
      "journey",
      "archive",
    ]);
  });

  it("publishes the complete 64-page and 69-series municipal boundary without changing anchors", () => {
    const content = METHODOLOGY_CONTENT.municipalities;
    const publicText = [
      content.summaryKa,
      content.disclosureKa,
      ...content.sections.flatMap((section) => section.paragraphsKa),
    ].join(" ");

    expect(content.sections.map((section) => section.id)).toEqual(["scope", "sources", "journey", "archive"]);
    expect(content.reviewedAt).toBe("2026-08-16");
    expect(publicText).toContain("64 საჯარო მუნიციპალიტეტი");
    expect(publicText).toContain("05, 42, 43, 46 და 64");
    expect(publicText).toContain("ტერიტორიულად მიკუთვნებულ ხარჯად არ არის წარმოდგენილი");
    expect(publicText).toContain("აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივი გადასახდელები");
    expect(publicText).toContain("ტრანსფერები");
    expect(publicText).toContain("69 მუნიციპალურ სერიას");
  });

  it("discloses the nominal-GDP denominator without opening a GDP methodology route", () => {
    for (const dataset of ["expenditure", "revenue"] as const) {
      expect(METHODOLOGY_CONTENT[dataset].disclosureKa).toContain("მშპ");
      expect(METHODOLOGY_CONTENT[dataset].disclosureKa).toContain("მიმდინარე ფასებში");
      expect(METHODOLOGY_CONTENT[dataset].disclosureKa).toContain("2010 წლიდან — SNA 2008");
      expect(METHODOLOGY_CONTENT[dataset].disclosureKa).toContain("2025 წლის მშპ წინასწარია");
    }
    expect(METHODOLOGY_CONTENT.expenditure.reviewedAt).toBe("2026-08-20");
    expect(METHODOLOGY_CONTENT.revenue.reviewedAt).toBe("2026-08-20");

    expect(FUTURE_METHODOLOGY_DATASETS.find((entry) => entry.titleKa === "მშპ")).toEqual({
      titleKa: "მშპ",
      href: null,
      state: "future",
    });
  });

  it("publishes the year-specific functional expenditure source boundary", () => {
    const sourceText = METHODOLOGY_CONTENT.expenditure.sections
      .find((section) => section.id === "sources")
      ?.paragraphsKa.join(" ") ?? "";

    expect(sourceText).toContain("2004 წლის სრული სახელმწიფო ბიუჯეტის შესრულების დანართიდან");
    expect(sourceText).toContain("2005–2025 წლებში — ხაზინის E11 ფორმებიდან");
    expect(sourceText).toContain("დამხმარე შემოწმებაა");
  });

  it("retains the complete SHA-256 coverage of the published revenue originals in methodology provenance", async () => {
    const manifest = await loadReviewedSourceManifest(repositoryRoot, "revenue");
    const disclosure = [
      ...METHODOLOGY_CONTENT.revenue.decisions,
      ...METHODOLOGY_CONTENT.revenue.technicalAppendix,
    ].find(
      (decision) => decision.id === "revenue.limitation.legacy_hash_gap",
    );
    const publicText = [disclosure?.titleKa, disclosure?.summaryKa, ...(disclosure?.detailKa ?? [])].join(" ");

    expect(manifest).toHaveLength(22);
    expect(publicText).toContain(`ყველა ${manifest.length} გამოქვეყნებულ PDF-ს SHA-256 აქვს`);
    expect(manifest.some((row) => row.years.includes(2004) && row.official_filename === "2004-annual-execution-report.pdf")).toBe(true);
    expect(publicText).not.toContain("არ აქვთ");
    expect(publicText).not.toContain("ჯერ არ არსებობს");
  });

  it("discloses the partial 2004 revenue panel without inventing liabilities", () => {
    const publicText = [
      METHODOLOGY_CONTENT.revenue.disclosureKa,
      ...METHODOLOGY_CONTENT.revenue.decisions.flatMap((entry) => [entry.titleKa, entry.summaryKa, ...entry.detailKa]),
    ].join(" ");

    expect(publicText).toContain("2004");
    expect(publicText).toContain("ვალდებულებების ზრდა");
    expect(publicText).toContain("არ არის ხელმისაწვდომი");
  });

  it("covers every canonical decision exactly through a public entry", async () => {
    const result = await validateDecisionCoverage();
    expect(result).toEqual({
      canonicalDecisionCount: result.publicMappingCount,
      uncovered: [],
      unknownPublicIds: [],
    });
  });

  it("keeps the canonical 2004 expenditure methodology coverage and source registry current", async () => {
    const [ministries, functional, drilldown, register] = await Promise.all([
      readFile(path.join(repositoryRoot, "docs/data-methodology/ministries-expenditure-methodology.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/ministries-drilldown-programs-methodology.md"), "utf8"),
      readFile(path.join(repositoryRoot, "data/methodology/decision-register.csv"), "utf8"),
    ]);

    expect(ministries).toContain("all 22 resolve");
    expect(ministries).toContain("`source.mof_2004_programmatic_fact_actual`");
    expect(ministries).toContain("2004-annual-execution-annex.pdf");
    expect(ministries).toMatch(/\*\*All 22\s+years pass\*\*/);
    expect(drilldown).toContain("22/22 years ≤1,000");
    expect(functional).toContain("All 22 detailed years");
    expect(functional).toContain("Old 14-group → public category (2004–2006)");
    expect(functional).toContain("year2004StateBudget.ts");
    expect(register).toContain("6b. Old 14-group → public category (2004–2006)");
  });

  it("does not leave current 2004 coverage claims at the pre-feature boundary", async () => {
    const [design, totalOnlyFacts, sourceRegistry, groupC, ministries, oldClassification] = await Promise.all([
      readFile(path.join(repositoryRoot, "DESIGN.md"), "utf8"),
      readFile(path.join(repositoryRoot, "apps/web/lib/data/totalOnlyBudgetFacts.ts"), "utf8"),
      readFile(path.join(repositoryRoot, "apps/web/lib/data/realExpenditurePdf/expenditureSourcesByYear.ts"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/group-c-annual-report-ministries-methodology.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/ministries-expenditure-methodology.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/2005-2006-old-classification-expenditure-methodology.md"), "utf8"),
    ]);

    expect(design).toContain("Expenditure by public spending fields: **2004–2025**");
    expect(design).toContain("Expenditure by ministries (administrative view): **2004–2025**");
    expect(totalOnlyFacts).toContain("2004 expenditure is now detailed via the complete state-budget execution annex");
    expect(sourceRegistry).toContain("2005-2025 E11-era registry");
    expect(sourceRegistry).toContain("year2004StateBudget.ts");
    expect(groupC).toContain("2004–2025 contiguously (22 reconciling years)");
    expect(groupC).not.toContain("Only 2004 remains");
    expect(ministries).toContain("2004 is the sole rounding exception");
    expect(ministries).toContain("Sport / Culture de-merge (2004, 2018–2024)");
    expect(oldClassification).toContain("npm run data:generate-final-2004-expenditure");
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
