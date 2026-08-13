import { describe, expect, it } from "vitest";
import { buildExplorerModel, getDefaultSelection, isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import type { AdminSpendingCategory, AdminSpendingFact } from "../../lib/data/adminSpending/types";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";
import type { ServedNationalGdpFact } from "../../lib/servedRows";

const glossary = new Map<string, GlossaryEntry>([
  ["spending.health", { id: "spending.health", kaLabel: "ჯანმრთელობა", enLabel: "Health", description: "", notes: "" }],
  ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Education", description: "", notes: "" }],
  ["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }],
  ["spending.social", { id: "spending.social", kaLabel: "Social", enLabel: "Social", description: "", notes: "" }],
  ["revenue.income_tax", { id: "revenue.income_tax", kaLabel: "Income tax", enLabel: "Income tax", description: "", notes: "" }],
  ["revenue.other_revenue", { id: "revenue.other_revenue", kaLabel: "Other revenue", enLabel: "Other revenue", description: "", notes: "" }],
]);

const facts: BudgetFactImportRow[] = [
  { year: 2024, side: "expenditure", itemId: "spending.health", amountGel: 100, basis: "actual", sourceId: "source.one", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "expenditure", itemId: "spending.health", amountGel: 150, basis: "planned", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2024, side: "expenditure", itemId: "spending.education", amountGel: 300, basis: "actual", sourceId: "source.one", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "expenditure", itemId: "spending.education", amountGel: 300, basis: "actual", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "revenue", itemId: "revenue.vat", amountGel: 500, basis: "planned", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: null, mappingConfidence: null, mappingNotes: "" },
];

const sourceDocuments: SourceDocumentRow[] = [
  {
    sourceId: "source.one",
    sourceName: "Reviewed 2024 execution",
    sourceUrlOrFile: "docs/source-2024",
    lastReviewedAt: "2026-05-10",
  },
  {
    sourceId: "source.two",
    sourceName: "Reviewed 2025 planned budget scenario",
    sourceUrlOrFile: "docs/source-2025-plan",
    lastReviewedAt: "2026-05-11",
  },
  {
    sourceId: "source.gdp",
    sourceName: "Reviewed nominal GDP",
    sourceUrlOrFile: "docs/gdp.xlsx",
    lastReviewedAt: "2026-08-13",
  },
];

const gdpFacts: ServedNationalGdpFact[] = [
  {
    year: 2024,
    gdpCurrentPricesGel: 1_000,
    accountingStandard: "sna_2008",
    status: "final_as_published",
    sourceId: "source.gdp",
  },
  {
    year: 2025,
    gdpCurrentPricesGel: 2_000,
    accountingStandard: "sna_2008",
    status: "preliminary",
    sourceId: "source.gdp",
  },
];

const adminCategories = new Map<string, AdminSpendingCategory>([
  [
    "admin_spending.health_social_affairs",
    {
      id: "admin_spending.health_social_affairs",
      kaLabel: "Health ministry",
      enLabel: "Health ministry",
      sortOrder: 10,
    },
  ],
  [
    "admin_spending.education_science_youth",
    {
      id: "admin_spending.education_science_youth",
      kaLabel: "Education ministry",
      enLabel: "Education ministry",
      sortOrder: 20,
    },
  ],
]);

const adminFacts: AdminSpendingFact[] = [
  {
    year: 2025,
    itemId: "admin_spending.education_science_youth",
    parentItemId: null,
    level: "admin_category",
    amountGel: 400,
    basis: "actual",
    sourceId: "source.two",
    officialCode: null,
    officialLabelKa: null,
    officialInstitutionCode: null,
    officialInstitutionLabelKa: null,
    mappingConfidence: "high",
    mappingNotes: "",
  },
  {
    year: 2025,
    itemId: "admin_spending.health_social_affairs",
    parentItemId: null,
    level: "admin_category",
    amountGel: 600,
    basis: "actual",
    sourceId: "source.two",
    officialCode: null,
    officialLabelKa: null,
    officialInstitutionCode: null,
    officialInstitutionLabelKa: null,
    mappingConfidence: "high",
    mappingNotes: "",
  },
  {
    year: 2025,
    itemId: "admin_program.education.general",
    parentItemId: "admin_spending.education_science_youth",
    level: "major_program",
    amountGel: 250,
    basis: "actual",
    sourceId: "source.two",
    officialCode: "32 02",
    officialLabelKa: "General education",
    officialInstitutionCode: "32 00",
    officialInstitutionLabelKa: "Education ministry",
    mappingConfidence: "medium",
    mappingNotes: "",
  },
];

describe("main explorer data model", () => {
  it("defaults each populated scope to only its total", () => {
    expect(getDefaultSelection("expenditure", facts)).toEqual(["expenditure.total"]);
    expect(getDefaultSelection("revenue", facts)).toEqual(["revenue.total"]);
    expect(getDefaultSelection("expenditure", facts, "ministries", adminFacts)).toEqual([
      "admin_spending.total",
    ]);
    expect(getDefaultSelection("expenditure", facts, "ministries", [])).toEqual([]);
  });

  it("identifies derived total item IDs", () => {
    expect(isDerivedTotalItemId("expenditure.total")).toBe(true);
    expect(isDerivedTotalItemId("revenue.total")).toBe(true);
    expect(isDerivedTotalItemId("admin_spending.total")).toBe(true);
    expect(isDerivedTotalItemId("spending.health")).toBe(false);
    expect(isDerivedTotalItemId("revenue.vat")).toBe(false);
  });

  it("builds derived total points and planned-year metadata", () => {
    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2024,
      endYear: 2025,
      measure: "nominal",
      gdpFacts,
    });

    expect(model.years).toEqual([2024, 2025]);
    expect(model.points).toEqual([
      expect.objectContaining({ year: 2024, value: 400, basis: "actual" }),
      expect.objectContaining({ year: 2025, value: 450, basis: "planned" }),
    ]);
    expect(model.hasPlannedValues).toBe(true);
    expect(model.tableRows.find((row) => row.itemId === "expenditure.total")?.sourceByYear[2025]).toEqual({
      sourceName: "Reviewed 2025 planned budget scenario",
      sourceUrlOrFile: "docs/source-2025-plan",
      lastReviewedAt: "2026-05-11",
    });
    expect(model.summary.biggestShareChange).not.toBeNull();
  });

  it("uses readable Georgian labels for derived total series", () => {
    const expenditureModel = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2024,
      endYear: 2025,
      measure: "nominal",
    });
    const revenueModel = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "revenue",
      selectedItemIds: ["revenue.total"],
      startYear: 2025,
      endYear: 2025,
      measure: "nominal",
    });

    const ministryModel = buildExplorerModel({
      facts,
      adminFacts,
      adminCategories: new Map(),
      expenditureGrouping: "ministries",
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["admin_spending.total"],
      startYear: 2024,
      endYear: 2025,
      measure: "nominal",
    });

    expect(expenditureModel.items.find((item) => item.id === "expenditure.total")?.kaLabel).toBe("მთლიანი ხარჯი");
    expect(revenueModel.items.find((item) => item.id === "revenue.total")?.kaLabel).toBe("მთლიანი შემოსავლები");
    expect(ministryModel.items.find((item) => item.id === "admin_spending.total")?.kaLabel).toBe("მთლიანი ხარჯი");
    expect(expenditureModel.items.find((item) => item.id === "expenditure.total")?.color).toBe("#1E1B16");
    expect(revenueModel.items.find((item) => item.id === "revenue.total")?.color).toBe("#1E1B16");
    expect(ministryModel.items.find((item) => item.id === "admin_spending.total")?.color).toBe("#1E1B16");
  });

  it("keeps the active side total available when the total series is not selected", () => {
    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2024,
      endYear: 2025,
      measure: "nominal",
    });

    expect(model.tableRows.map((row) => row.itemId)).toEqual(["spending.health"]);
    expect(model.totalRow?.itemId).toBe("expenditure.total");
    expect(model.totalRow?.valuesByYear[2025]).toBe(450);
  });

  it("orders selectable series by 2025 amount for both budget sides", () => {
    const localFacts: BudgetFactImportRow[] = [
      { ...facts[0], year: 2024, itemId: "spending.health", amountGel: 900, publicSpendingFieldId: "spending.health" },
      { ...facts[0], year: 2024, itemId: "spending.education", amountGel: 100, publicSpendingFieldId: "spending.education" },
      { ...facts[0], year: 2024, itemId: "spending.social", amountGel: 50, publicSpendingFieldId: "spending.social" },
      { ...facts[1], year: 2025, itemId: "spending.health", amountGel: 150, publicSpendingFieldId: "spending.health" },
      { ...facts[3], year: 2025, itemId: "spending.education", amountGel: 300, publicSpendingFieldId: "spending.education" },
      { ...facts[1], year: 2025, itemId: "spending.social", amountGel: 450, publicSpendingFieldId: "spending.social" },
      { ...facts[4], year: 2024, itemId: "revenue.vat", amountGel: 900 },
      { ...facts[4], year: 2024, itemId: "revenue.income_tax", amountGel: 100 },
      { ...facts[4], year: 2024, itemId: "revenue.other_revenue", amountGel: 50 },
      { ...facts[4], year: 2025, itemId: "revenue.vat", amountGel: 500 },
      { ...facts[4], year: 2025, itemId: "revenue.income_tax", amountGel: 800 },
      { ...facts[4], year: 2025, itemId: "revenue.other_revenue", amountGel: 1200 },
    ];

    const expenditureModel = buildExplorerModel({
      facts: localFacts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2024,
      endYear: 2024,
      measure: "nominal",
    });
    const revenueModel = buildExplorerModel({
      facts: localFacts,
      glossary,
      sourceDocuments,
      side: "revenue",
      selectedItemIds: ["revenue.total"],
      startYear: 2024,
      endYear: 2024,
      measure: "nominal",
    });

    expect(expenditureModel.items.map((item) => item.id)).toEqual([
      "expenditure.total",
      "spending.social",
      "spending.education",
      "spending.health",
    ]);
    expect(revenueModel.items.map((item) => item.id)).toEqual([
      "revenue.total",
      "revenue.other_revenue",
      "revenue.income_tax",
      "revenue.vat",
    ]);
  });

  it("builds nested ministry and major-program rows from admin spending facts", () => {
    const model = buildExplorerModel({
      facts,
      adminFacts,
      adminCategories,
      expenditureGrouping: "ministries",
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: [
        "admin_spending.total",
        "admin_spending.health_social_affairs",
        "admin_spending.education_science_youth",
        "admin_program.education.general",
      ],
      startYear: 2025,
      endYear: 2025,
      measure: "share_of_gdp",
      gdpFacts,
    });

    expect(model.items.map((item) => item.id)).toEqual([
      "admin_spending.total",
      "admin_spending.health_social_affairs",
      "admin_spending.education_science_youth",
      "admin_program.education.general",
    ]);
    expect(model.items.find((item) => item.id === "admin_spending.total")).toEqual(
      expect.objectContaining({ parentItemId: null, level: "total", detailLabel: null }),
    );
    expect(model.items.find((item) => item.id === "admin_spending.health_social_affairs")).toEqual(
      expect.objectContaining({ parentItemId: null, level: "admin_category", detailLabel: null, enLabel: "Health ministry" }),
    );
    expect(model.items.find((item) => item.id === "admin_program.education.general")).toEqual(
      expect.objectContaining({
        parentItemId: "admin_spending.education_science_youth",
        level: "major_program",
        kaLabel: "General education",
        enLabel: "General education",
        // Drill-down programs are surfaced by name only; the official code is not shown.
        detailLabel: null,
      }),
    );
    expect(model.items.some((item) => item.id.startsWith("spending."))).toBe(false);
    expect(model.totalRow?.valuesByYear[2025]).toBe(1000);
    expect(model.points.find((point) => point.itemId === "admin_spending.health_social_affairs")?.value).toBe(0.3);
    expect(model.points.find((point) => point.itemId === "admin_program.education.general")?.value).toBe(0.125);
  });

  it("labels a program series by its most recent official name, not by an earlier joined point's", () => {
    // Pre-2012 legacy-join points sort first (facts are year-ascending) and carry source-year
    // organizational labels; the series display name must come from the LATEST fact.
    const legacyJoined: AdminSpendingFact = {
      year: 2006,
      itemId: "admin_program.education.general",
      parentItemId: "admin_spending.education_science_youth",
      level: "major_program",
      amountGel: 120,
      basis: "actual",
      sourceId: "source.two",
      officialCode: "32 03",
      officialLabelKa: "Schools + support units (2006 join)",
      officialInstitutionCode: "32 00",
      officialInstitutionLabelKa: "Education ministry (2006)",
      mappingConfidence: "medium",
      mappingNotes: "Pre-2012 organizational line(s) joined to this modern program series.",
    };

    const model = buildExplorerModel({
      facts,
      adminFacts: [legacyJoined, ...adminFacts],
      adminCategories,
      expenditureGrouping: "ministries",
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["admin_spending.total", "admin_program.education.general"],
      startYear: 2025,
      endYear: 2025,
      measure: "share_of_gdp",
      gdpFacts,
    });

    expect(model.items.find((item) => item.id === "admin_program.education.general")).toEqual(
      expect.objectContaining({ kaLabel: "General education", enLabel: "General education" }),
    );
  });

  it("treats the biggest share-of-GDP change as the largest movement in either direction", () => {
    const localFacts: BudgetFactImportRow[] = [
      { ...facts[0], itemId: "spending.health", amountGel: 900 },
      { ...facts[1], itemId: "spending.health", amountGel: 100 },
      { ...facts[2], itemId: "spending.education", amountGel: 100 },
      { ...facts[3], itemId: "spending.education", amountGel: 250 },
      { ...facts[2], itemId: "spending.social", amountGel: 100 },
      { ...facts[3], itemId: "spending.social", amountGel: 150 },
    ];

    const model = buildExplorerModel({
      facts: localFacts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2024,
      endYear: 2025,
      measure: "nominal",
      gdpFacts,
    });

    expect(model.summary.biggestShareChange?.itemId).toBe("spending.health");
  });

  it("calculates share of GDP and keeps per-point nominal percent change", () => {
    const shareModel = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2024,
      endYear: 2025,
      measure: "share_of_gdp",
      gdpFacts,
    });

    expect(shareModel.points[0]?.percentChange).toBeNull();
    expect(shareModel.points[1]?.percentChange).toBe(0.5);
    expect(shareModel.points[1]?.value).toBeCloseTo(0.075, 4);
  });

  it("uses same-year GDP for detail and total rows regardless of selection", () => {
    const localFacts: BudgetFactImportRow[] = [
      { ...facts[1], itemId: "spending.health", amountGel: 250 },
      { ...facts[3], itemId: "spending.education", amountGel: 500 },
    ];
    const build = (selectedItemIds: string[]) =>
      buildExplorerModel({
        facts: localFacts,
        gdpFacts,
        glossary,
        sourceDocuments,
        side: "expenditure",
        selectedItemIds,
        startYear: 2025,
        endYear: 2025,
        measure: "share_of_gdp",
      });

    const one = build(["expenditure.total", "spending.health"]);
    const many = build(["expenditure.total", "spending.health", "spending.education"]);

    expect(one.points.find((point) => point.itemId === "spending.health")?.value).toBe(0.125);
    expect(many.points.find((point) => point.itemId === "spending.health")?.value).toBe(0.125);
    expect(one.totalRow?.shareEndYear).toBe(0.375);
    expect(one.totalRow?.shareEndYear).not.toBe(1);
    expect(one.gdpByYear[2025]).toMatchObject({
      gdpCurrentPricesGel: 2_000,
      status: "preliminary",
      source: { sourceName: "Reviewed nominal GDP" },
    });
  });

  it("returns null when the same-year GDP denominator is missing", () => {
    const model = buildExplorerModel({
      facts,
      gdpFacts: gdpFacts.filter((row) => row.year !== 2025),
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2024,
      endYear: 2025,
      measure: "share_of_gdp",
    });

    expect(model.points.find((point) => point.year === 2025)?.value).toBeNull();
    expect(model.tableRows[0]?.shareByYear?.[2025]).toBeNull();
    expect(model.points.find((point) => point.year === 2025)?.amountGel).toBe(150);
    expect(model.summary.biggestShareChange).toBeNull();
  });

  it("preserves negative revenue corrections as negative GDP shares", () => {
    const model = buildExplorerModel({
      facts: [{ ...facts[4], amountGel: -20 }],
      gdpFacts,
      glossary,
      sourceDocuments,
      side: "revenue",
      selectedItemIds: ["revenue.vat"],
      startYear: 2025,
      endYear: 2025,
      measure: "share_of_gdp",
    });

    expect(model.points[0]?.value).toBe(-0.01);
  });
  it("uses explicit total facts for totals-only years without exposing fake categories", () => {
    const localFacts: BudgetFactImportRow[] = [
      { ...facts[0], year: 2004, itemId: "expenditure.total", amountGel: 1000, publicSpendingFieldId: null, sourceId: "source.one" },
      { ...facts[0], year: 2005, itemId: "expenditure.total", amountGel: 1100, publicSpendingFieldId: null, sourceId: "source.one" },
      { ...facts[0], year: 2006, itemId: "spending.health", amountGel: 400, publicSpendingFieldId: "spending.health", sourceId: "source.two" },
      { ...facts[2], year: 2006, itemId: "spending.education", amountGel: 800, publicSpendingFieldId: "spending.education", sourceId: "source.two" },
    ];

    const model = buildExplorerModel({
      facts: localFacts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2004,
      endYear: 2006,
      measure: "nominal",
    });

    expect(model.years).toEqual([2004, 2005, 2006]);
    expect(model.points.map((point) => [point.year, point.amountGel])).toEqual([
      [2004, 1000],
      [2005, 1100],
      [2006, 1200],
    ]);
    expect(model.items.map((item) => item.id)).toEqual(["expenditure.total", "spending.education", "spending.health"]);
    expect(model.comparisonRows.map((row) => row.itemId)).toEqual(["spending.education", "spending.health"]);
    expect(model.totalRow?.sourceByYear[2004]).toEqual({
      sourceName: "Reviewed 2024 execution",
      sourceUrlOrFile: "docs/source-2024",
      lastReviewedAt: "2026-05-10",
    });
  });
});
