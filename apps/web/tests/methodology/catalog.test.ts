import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { MunicipalTotalFact } from "../../lib/data/municipal/types";
import {
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
  MethodologyContent,
} from "../../lib/methodology/types";
import type { ServedBudgetFact } from "../../lib/servedRows";
import type { ServedGovernmentDebtFact } from "../../lib/servedRows";

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
const debtFacts: ServedGovernmentDebtFact[] = [
  { year: 2013, family: "stock", seriesId: "debt.stock.total", value: 1, valueKind: "amount_gel", status: "actual", sourceId: "debt.source", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2030, family: "service", seriesId: "debt.service.total", value: 1, valueKind: "amount_gel", status: "projection_existing_portfolio", sourceId: "debt.source", snapshotDate: "2025-12-31", lastReviewedAt: "2026-09-01" },
];
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
  it("exposes the approved live datasets", () => {
    expect(LIVE_METHODOLOGY_IDS).toEqual(["expenditure", "revenue", "municipalities", "debt", "gdp", "economic-sectors", "regional-economies", "business", "housing", "inflation", "money", "unemployment", "wages", "poverty", "household-income", "health", "crime", "trade", "external-flows", "energy-food", "demography"]);
    expect(Object.keys(METHODOLOGY_CONTENT)).toEqual(LIVE_METHODOLOGY_IDS);
  });

  it("keeps the Debt methodology concise and discloses its approved boundaries", () => {
    const content = METHODOLOGY_CONTENT.debt;
    const publicText = [
      content.summary,
      content.disclosure,
      ...content.sections.flatMap((section) => section.paragraphs),
    ].join(" ");

    expect(content.sections.map((section) => section.kind)).toEqual(["scope", "sources", "limitations", "archive"]);
    expect(publicText).toContain("მთავრობის ვალი");
    expect(publicText).toMatch(/საჯარო.*სახელმწიფო ვალს/);
    expect(publicText).toContain("2019");
    expect(publicText).toContain("2022");
    expect(publicText).toContain("2015–2017");
    expect(publicText).toContain("2015–2020");
    expect(publicText).toContain("2025");
    expect(publicText).toContain("2025-12-31");
    expect(publicText).toContain("არ წარმოადგენს მომავალი ბიუჯეტის სრულ პროგნოზს");
    expect(publicText.length).toBeLessThan(3_500);
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
      content.summary,
      content.disclosure,
      ...content.sections.flatMap((section) => section.paragraphs),
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

  it("discloses the nominal-GDP denominator on expenditure and revenue, and GDP and inflation keep their own slugs", () => {
    for (const dataset of ["expenditure", "revenue"] as const) {
      expect(METHODOLOGY_CONTENT[dataset].disclosure).toContain("მშპ");
      expect(METHODOLOGY_CONTENT[dataset].disclosure).toContain("მიმდინარე ფასებში");
      expect(METHODOLOGY_CONTENT[dataset].disclosure).toContain("2010 წლიდან — SNA 2008");
      expect(METHODOLOGY_CONTENT[dataset].disclosure).toContain("2025 წლის მშპ წინასწარია");
    }

    expect(METHODOLOGY_CONTENT.gdp.slug).toBe("gdp");
    expect(METHODOLOGY_CONTENT.inflation.slug).toBe("inflation");
  });

  it("publishes the year-specific functional expenditure source boundary", () => {
    const sourceText = METHODOLOGY_CONTENT.expenditure.sections
      .find((section) => section.id === "sources")
      ?.paragraphs.join(" ") ?? "";

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
    const publicText = [disclosure?.title, disclosure?.summary, ...(disclosure?.detail ?? [])].join(" ");

    expect(manifest).toHaveLength(22);
    expect(publicText).toContain(`ყველა ${manifest.length} გამოქვეყნებულ PDF-ს SHA-256 აქვს`);
    expect(manifest.some((row) => row.years.includes(2004) && row.official_filename === "2004-annual-execution-report.pdf")).toBe(true);
    expect(publicText).not.toContain("არ აქვთ");
    expect(publicText).not.toContain("ჯერ არ არსებობს");
  });

  it("discloses the partial 2004 revenue panel without inventing liabilities", () => {
    const publicText = [
      METHODOLOGY_CONTENT.revenue.disclosure,
      ...METHODOLOGY_CONTENT.revenue.decisions.flatMap((entry) => [entry.title, entry.summary, ...entry.detail]),
    ].join(" ");

    expect(publicText).toContain("2004");
    expect(publicText).toContain("ვალდებულებების ზრდა");
    expect(publicText).toContain("არ არის ხელმისაწვდომი");
    expect(publicText).toContain("სოციალურ შენატანებს არ მოიცავს");
    expect(publicText).toContain("459,781,200");
    expect(publicText).toContain("ზუსტი პერიმეტრული შესადარისობა წყაროდან ვერ დასტურდება");
  });

  it("documents the exact 2004 revenue perimeter and residual transformation", async () => {
    const canonical = await readFile(path.join(repositoryRoot, "docs/data-methodology/revenue-methodology.md"), "utf8");

    expect(canonical).toContain("budget organizations' social contributions");
    expect(canonical).toContain("1,811,195,900");
    expect(canonical).toContain("459,781,200");
    expect(canonical).toContain("628,158,100 + 268,649,900 + 161,589,700 + 163,771,500 + 100,138,000 + 29,107,500");
    expect(canonical).toContain("does not establish whether this perimeter is exactly comparable");
    expect(canonical).not.toContain("a complete 11-category panel every year");
  });

  it("uses the current Fiscal.ge brand in every canonical methodology document", async () => {
    const canonicalDocuments = new Set(
      Object.values(METHODOLOGY_CONTENT).flatMap((content) => content.canonicalDocuments),
    );

    for (const document of canonicalDocuments) {
      const canonical = await readFile(path.join(repositoryRoot, document), "utf8");
      expect(canonical, document).not.toMatch(/\bGeoData(?:\.ge)?\b/);
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
    expect(functional).toContain("revenue from 2004–2025");
    expect(METHODOLOGY_CONTENT.expenditure.sections.find((section) => section.id === "scope")?.paragraphs.join(" ")).toContain("შემოსავლების ცალკე სერია 2004–2025");
    expect(register).toContain("6b. Old 14-group → public category (2004–2006)");
  });

  it("does not leave current 2004 coverage claims at the pre-feature boundary", async () => {
    const [design, functionalMethodology, sourceRegistry, groupC, ministries, oldClassification] = await Promise.all([
      readFile(path.join(repositoryRoot, "DESIGN.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md"), "utf8"),
      readFile(path.join(repositoryRoot, "apps/web/lib/data/realExpenditurePdf/expenditureSourcesByYear.ts"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/group-c-annual-report-ministries-methodology.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/ministries-expenditure-methodology.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/data-methodology/2005-2006-old-classification-expenditure-methodology.md"), "utf8"),
    ]);

    expect(design).toContain("Expenditure by public spending fields: **2004–2025**");
    expect(design).toContain("Expenditure by ministries (administrative view): **2004–2025**");
    expect(functionalMethodology).toContain("The 2004 functional facts come from the complete state-budget execution annex");
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
    expect(deriveMethodologyCoverage("expenditure", budgetFacts, municipalFacts, debtFacts)).toEqual({ firstYear: 2005, lastYear: 2025 });
    expect(deriveMethodologyCoverage("revenue", budgetFacts, municipalFacts, debtFacts)).toEqual({ firstYear: 2005, lastYear: 2025 });
    expect(deriveMethodologyCoverage("municipalities", budgetFacts, municipalFacts, debtFacts)).toEqual({ firstYear: 2015, lastYear: 2025 });
    expect(deriveMethodologyCoverage("debt", budgetFacts, municipalFacts, debtFacts)).toEqual({ firstYear: 2013, lastYear: 2030 });
  });

  it("declares where every live dataset's coverage years come from", () => {
    expect(METHODOLOGY_CONTENT.expenditure.coverageSource).toEqual({
      kind: "budgetSide",
      side: "expenditure",
    });
    expect(METHODOLOGY_CONTENT.revenue.coverageSource).toEqual({
      kind: "budgetSide",
      side: "revenue",
    });
    expect(METHODOLOGY_CONTENT.municipalities.coverageSource).toEqual({
      kind: "municipalTotals",
    });
    expect(METHODOLOGY_CONTENT.debt.coverageSource).toEqual({ kind: "governmentDebt" });
  });

  it("will not accept a methodology dataset that omits its coverage source", () => {
    const incomplete = {
      ...METHODOLOGY_CONTENT.expenditure,
      // @ts-expect-error - coverageSource is required; a new dataset must declare it
      coverageSource: undefined,
    } satisfies MethodologyContent;

    expect(incomplete.id).toBe("expenditure");
  });

  it("rejects live datasets without served years", () => {
    expect(() => deriveMethodologyCoverage("revenue", [], municipalFacts, debtFacts)).toThrow(/no served years/i);
  });

  it("builds live hub rows from facts, content metadata, and validated archives", () => {
    const archives: Record<(typeof LIVE_METHODOLOGY_IDS)[number], MethodologyArchiveSummary> = {
      "economic-sectors": {fileCount:3,totalBytes:100,latestRetrievedAt:"2026-09-11",validated:true,minYear:2010,maxYear:2025},
      "regional-economies": {fileCount:2,totalBytes:100,latestRetrievedAt:"2026-09-13",validated:true,minYear:2010,maxYear:2024},
      expenditure: { fileCount: 42, totalBytes: 100, latestRetrievedAt: "2026-08-10", validated: true },
      revenue: { fileCount: 21, totalBytes: 200, latestRetrievedAt: "2026-08-09", validated: true },
      municipalities: { fileCount: 80, totalBytes: 300, latestRetrievedAt: "2026-08-08", validated: true },
      gdp: { fileCount:5, totalBytes:100, latestRetrievedAt:"2026-09-10", validated:true, minYear:1960, maxYear:2025 },
      inflation: { fileCount: 14, totalBytes: 100, latestRetrievedAt: "2026-09-11", validated: true, minYear: 2000, maxYear: 2026 },
      unemployment: { fileCount: 9, totalBytes: 100, latestRetrievedAt: "2026-10-03", validated: true, minYear: 2010, maxYear: 2025 },
      trade: { fileCount: 3, totalBytes: 520677, latestRetrievedAt: "2026-10-07", validated: true, minYear: 1995, maxYear: 2025 },
      "external-flows": { fileCount: 3, totalBytes: 100, latestRetrievedAt: "2026-10-10", validated: true, minYear: 2000, maxYear: 2025 },
      "energy-food": { fileCount: 42, totalBytes: 100, latestRetrievedAt: "2026-10-11", validated: true, minYear: 2013, maxYear: 2025 },
      demography: { fileCount: 2, totalBytes: 100, latestRetrievedAt: "2026-10-03", validated: true, minYear: 2004, maxYear: 2026 },
      wages: { fileCount: 12, totalBytes: 100, latestRetrievedAt: "2026-10-09", validated: true, minYear: 1995, maxYear: 2025 },
      poverty: { fileCount: 7, totalBytes: 100, latestRetrievedAt: "2026-10-10", validated: true, minYear: 2004, maxYear: 2025 },
      "household-income": { fileCount: 21, totalBytes: 100, latestRetrievedAt: "2026-10-11", validated: true, minYear: 2002, maxYear: 2025 },
      health: { fileCount: 36, totalBytes: 100, latestRetrievedAt: "2026-10-15", validated: true, minYear: 2002, maxYear: 2025 },
      crime: { fileCount: 22, totalBytes: 100, latestRetrievedAt: "2026-10-16", validated: true, minYear: 2001, maxYear: 2025 },
      money: { fileCount: 20, totalBytes: 100, latestRetrievedAt: "2026-10-11", validated: true, minYear: 1995, maxYear: 2025 },
      business: { fileCount: 26, totalBytes: 100, latestRetrievedAt: "2026-10-15", validated: true, minYear: 1999, maxYear: 2025 },
      housing: { fileCount: 21, totalBytes: 100, latestRetrievedAt: "2026-10-16", validated: true, minYear: 2006, maxYear: 2025 },
      debt: { fileCount: 10, totalBytes: 400, latestRetrievedAt: "2026-09-01", validated: true },
    };

    expect(buildMethodologyHubEntries({ budgetFacts, municipalFacts, debtFacts, archives })).toEqual([
      {
        id: "expenditure",
        title: METHODOLOGY_CONTENT.expenditure.title,
        summary: METHODOLOGY_CONTENT.expenditure.summary,
        href: "/methodology/expenditure",
        coverage: { firstYear: 2005, lastYear: 2025 },
        originalFileCount: 42,
        reviewedAt: METHODOLOGY_CONTENT.expenditure.reviewedAt,
      },
      {
        id: "revenue",
        title: METHODOLOGY_CONTENT.revenue.title,
        summary: METHODOLOGY_CONTENT.revenue.summary,
        href: "/methodology/revenue",
        coverage: { firstYear: 2005, lastYear: 2025 },
        originalFileCount: 21,
        reviewedAt: METHODOLOGY_CONTENT.revenue.reviewedAt,
      },
      {
        id: "municipalities",
        title: METHODOLOGY_CONTENT.municipalities.title,
        summary: METHODOLOGY_CONTENT.municipalities.summary,
        href: "/methodology/municipalities",
        coverage: { firstYear: 2015, lastYear: 2025 },
        originalFileCount: 80,
        reviewedAt: METHODOLOGY_CONTENT.municipalities.reviewedAt,
      },
      {
        id: "debt",
        title: METHODOLOGY_CONTENT.debt.title,
        summary: METHODOLOGY_CONTENT.debt.summary,
        href: "/methodology/debt",
        coverage: { firstYear: 2013, lastYear: 2030 },
        originalFileCount: 10,
        reviewedAt: METHODOLOGY_CONTENT.debt.reviewedAt,
      },
      {id:"gdp",title:METHODOLOGY_CONTENT.gdp.title,summary:METHODOLOGY_CONTENT.gdp.summary,href:"/methodology/gdp",coverage:{firstYear:1960,lastYear:2025},originalFileCount:5,reviewedAt:METHODOLOGY_CONTENT.gdp.reviewedAt},
      {id:"economic-sectors",title:METHODOLOGY_CONTENT["economic-sectors"].title,summary:METHODOLOGY_CONTENT["economic-sectors"].summary,href:"/methodology/economic-sectors",coverage:{firstYear:2010,lastYear:2025},originalFileCount:3,reviewedAt:METHODOLOGY_CONTENT["economic-sectors"].reviewedAt},
      {id:"regional-economies",title:METHODOLOGY_CONTENT["regional-economies"].title,summary:METHODOLOGY_CONTENT["regional-economies"].summary,href:"/methodology/regional-economies",coverage:{firstYear:2010,lastYear:2024},originalFileCount:2,reviewedAt:METHODOLOGY_CONTENT["regional-economies"].reviewedAt},
      { id: "business", title: METHODOLOGY_CONTENT.business.title, summary: METHODOLOGY_CONTENT.business.summary, href: "/methodology/business", coverage: { firstYear: 1999, lastYear: 2025 }, originalFileCount: 26, reviewedAt: METHODOLOGY_CONTENT.business.reviewedAt },
      { id: "housing", title: METHODOLOGY_CONTENT.housing.title, summary: METHODOLOGY_CONTENT.housing.summary, href: "/methodology/housing", coverage: { firstYear: 2006, lastYear: 2025 }, originalFileCount: 21, reviewedAt: METHODOLOGY_CONTENT.housing.reviewedAt },
      {
        id: "inflation",
        title: METHODOLOGY_CONTENT.inflation.title,
        summary: METHODOLOGY_CONTENT.inflation.summary,
        href: "/methodology/inflation",
        coverage: { firstYear: 2000, lastYear: 2026 },
        originalFileCount: 14,
        reviewedAt: METHODOLOGY_CONTENT.inflation.reviewedAt,
      },
      { id: "money", title: METHODOLOGY_CONTENT.money.title, summary: METHODOLOGY_CONTENT.money.summary, href: "/methodology/money", coverage: { firstYear: 1995, lastYear: 2025 }, originalFileCount: 20, reviewedAt: METHODOLOGY_CONTENT.money.reviewedAt },
      { id: "unemployment", title: METHODOLOGY_CONTENT.unemployment.title, summary: METHODOLOGY_CONTENT.unemployment.summary, href: "/methodology/unemployment", coverage: { firstYear: 2010, lastYear: 2025 }, originalFileCount: 9, reviewedAt: METHODOLOGY_CONTENT.unemployment.reviewedAt },
      { id: "wages", title: METHODOLOGY_CONTENT.wages.title, summary: METHODOLOGY_CONTENT.wages.summary, href: "/methodology/wages", coverage: { firstYear: 1995, lastYear: 2025 }, originalFileCount: 12, reviewedAt: METHODOLOGY_CONTENT.wages.reviewedAt },
      { id: "poverty", title: METHODOLOGY_CONTENT.poverty.title, summary: METHODOLOGY_CONTENT.poverty.summary, href: "/methodology/poverty", coverage: { firstYear: 2004, lastYear: 2025 }, originalFileCount: 7, reviewedAt: METHODOLOGY_CONTENT.poverty.reviewedAt },
      { id: "household-income", title: METHODOLOGY_CONTENT["household-income"].title, summary: METHODOLOGY_CONTENT["household-income"].summary, href: "/methodology/household-income", coverage: { firstYear: 2002, lastYear: 2025 }, originalFileCount: 21, reviewedAt: METHODOLOGY_CONTENT["household-income"].reviewedAt },
      { id: "health", title: METHODOLOGY_CONTENT.health.title, summary: METHODOLOGY_CONTENT.health.summary, href: "/methodology/health", coverage: { firstYear: 2002, lastYear: 2025 }, originalFileCount: 36, reviewedAt: METHODOLOGY_CONTENT.health.reviewedAt },
      { id: "crime", title: METHODOLOGY_CONTENT.crime.title, summary: METHODOLOGY_CONTENT.crime.summary, href: "/methodology/crime", coverage: { firstYear: 2001, lastYear: 2025 }, originalFileCount: 22, reviewedAt: METHODOLOGY_CONTENT.crime.reviewedAt },
      { id: "trade", title: METHODOLOGY_CONTENT.trade.title, summary: METHODOLOGY_CONTENT.trade.summary, href: "/methodology/trade", coverage: { firstYear: 1995, lastYear: 2025 }, originalFileCount: 3, reviewedAt: METHODOLOGY_CONTENT.trade.reviewedAt },
      { id: "external-flows", title: METHODOLOGY_CONTENT["external-flows"].title, summary: METHODOLOGY_CONTENT["external-flows"].summary, href: "/methodology/external-flows", coverage: { firstYear: 2000, lastYear: 2025 }, originalFileCount: 3, reviewedAt: METHODOLOGY_CONTENT["external-flows"].reviewedAt },
      { id: "energy-food", title: METHODOLOGY_CONTENT["energy-food"].title, summary: METHODOLOGY_CONTENT["energy-food"].summary, href: "/methodology/energy-food", coverage: { firstYear: 2013, lastYear: 2025 }, originalFileCount: 42, reviewedAt: METHODOLOGY_CONTENT["energy-food"].reviewedAt },
      { id: "demography", title: METHODOLOGY_CONTENT.demography.title, summary: METHODOLOGY_CONTENT.demography.summary, href: "/methodology/demography", coverage: { firstYear: 2004, lastYear: 2026 }, originalFileCount: 2, reviewedAt: METHODOLOGY_CONTENT.demography.reviewedAt },
    ]);
  });

  it("rejects a hub row without a validated archive", () => {
    const archives = {
      "economic-sectors": {fileCount:3,totalBytes:100,latestRetrievedAt:"2026-09-11",validated:true,minYear:2010,maxYear:2025},
      "regional-economies": {fileCount:2,totalBytes:100,latestRetrievedAt:"2026-09-13",validated:true,minYear:2010,maxYear:2024},
      expenditure: { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-08-10", validated: true },
      revenue: { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-08-10", validated: false },
      municipalities: { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-08-10", validated: true },
      gdp: { fileCount:5, totalBytes:100, latestRetrievedAt:"2026-09-10", validated:true, minYear:1960, maxYear:2025 },
      inflation: { fileCount: 14, totalBytes: 100, latestRetrievedAt: "2026-09-11", validated: true, minYear: 2000, maxYear: 2026 },
      unemployment: { fileCount: 9, totalBytes: 100, latestRetrievedAt: "2026-10-03", validated: true, minYear: 2010, maxYear: 2025 },
      trade: { fileCount: 3, totalBytes: 520677, latestRetrievedAt: "2026-10-07", validated: true, minYear: 1995, maxYear: 2025 },
      "external-flows": { fileCount: 3, totalBytes: 100, latestRetrievedAt: "2026-10-10", validated: true, minYear: 2000, maxYear: 2025 },
      "energy-food": { fileCount: 42, totalBytes: 100, latestRetrievedAt: "2026-10-11", validated: true, minYear: 2013, maxYear: 2025 },
      demography: { fileCount: 2, totalBytes: 100, latestRetrievedAt: "2026-10-03", validated: true, minYear: 2004, maxYear: 2026 },
      wages: { fileCount: 12, totalBytes: 100, latestRetrievedAt: "2026-10-09", validated: true, minYear: 1995, maxYear: 2025 },
      poverty: { fileCount: 7, totalBytes: 100, latestRetrievedAt: "2026-10-10", validated: true, minYear: 2004, maxYear: 2025 },
      "household-income": { fileCount: 21, totalBytes: 100, latestRetrievedAt: "2026-10-11", validated: true, minYear: 2002, maxYear: 2025 },
      health: { fileCount: 36, totalBytes: 100, latestRetrievedAt: "2026-10-15", validated: true, minYear: 2002, maxYear: 2025 },
      crime: { fileCount: 22, totalBytes: 100, latestRetrievedAt: "2026-10-16", validated: true, minYear: 2001, maxYear: 2025 },
      money: { fileCount: 20, totalBytes: 100, latestRetrievedAt: "2026-10-11", validated: true, minYear: 1995, maxYear: 2025 },
      business: { fileCount: 26, totalBytes: 100, latestRetrievedAt: "2026-10-15", validated: true, minYear: 1999, maxYear: 2025 },
      housing: { fileCount: 21, totalBytes: 100, latestRetrievedAt: "2026-10-16", validated: true, minYear: 2006, maxYear: 2025 },
      debt: { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-09-01", validated: true },
    } satisfies Record<(typeof LIVE_METHODOLOGY_IDS)[number], MethodologyArchiveSummary>;

    expect(() => buildMethodologyHubEntries({ budgetFacts, municipalFacts, debtFacts, archives })).toThrow(/validated archive/i);
  });
});

// U29-10: the disclosure says what is official and what is Fiscal.ge's method (DESIGN.md §21); it never repeats the lead.
it.each(["ka", "en"] as const)("every %s methodology disclosure says something its summary does not", async (locale) => {
  const { getMethodologyContent } = await import("../../lib/methodology/catalog");
  for (const id of LIVE_METHODOLOGY_IDS) {
    const content = getMethodologyContent(id, locale);
    expect(content.disclosure, id).not.toBe(content.summary);
  }
});

// Task 48 fix round: nominal GDP joins Geostat's SNA 1993 and SNA 2008 series (docs/data-methodology/gdp-overview.md);
// the disclosure says so rather than claiming no series is spliced.
it.each([
  ["ka", /SNA 1993/, /SNA 2008/, /არცერთი სერია არ არის გადაბმული/],
  ["en", /SNA 1993/, /SNA 2008/, /does not splice, rebase or convert any series/],
] as const)("the %s GDP disclosure names the nominal SNA join", async (locale, older, newer, wrong) => {
  const { getMethodologyContent } = await import("../../lib/methodology/catalog");
  const { disclosure } = getMethodologyContent("gdp", locale);
  expect(disclosure).toMatch(older);
  expect(disclosure).toMatch(newer);
  expect(disclosure).not.toMatch(wrong);
});
