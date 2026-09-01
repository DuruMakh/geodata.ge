import { describe, expect, it } from "vitest";
import {
  buildDebtExplorerModel,
  getDefaultDebtSelection,
  selectDebtSeries,
} from "../../lib/explorer/debtExplorer";
import type { ServedGovernmentDebtFact, ServedNationalGdpFact } from "../../lib/servedRows";

const facts: ServedGovernmentDebtFact[] = [
  { year: 2025, family: "stock", seriesId: "debt.stock.total", value: 400, valueKind: "amount_gel", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "stock", seriesId: "debt.stock.domestic", value: 150, valueKind: "amount_gel", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "stock", seriesId: "debt.stock.external", value: 250, valueKind: "amount_gel", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "service", seriesId: "debt.service.total", value: 101, valueKind: "amount_gel", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "service", seriesId: "debt.service.principal", value: 70, valueKind: "amount_gel", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "service", seriesId: "debt.service.interest", value: 31, valueKind: "amount_gel", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2026, family: "service", seriesId: "debt.service.total", value: 100.1, valueKind: "amount_gel", status: "projection_existing_portfolio", sourceId: null, snapshotDate: "2025-12-31", lastReviewedAt: "2026-09-01" },
  { year: 2026, family: "service", seriesId: "debt.service.principal", value: 70.04, valueKind: "amount_gel", status: "projection_existing_portfolio", sourceId: null, snapshotDate: "2025-12-31", lastReviewedAt: "2026-09-01" },
  { year: 2026, family: "service", seriesId: "debt.service.interest", value: 30.05, valueKind: "amount_gel", status: "projection_existing_portfolio", sourceId: null, snapshotDate: "2025-12-31", lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "rate", seriesId: "debt.rate.total", value: 4.5, valueKind: "percent", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "rate", seriesId: "debt.rate.domestic", value: null, valueKind: "percent", status: "not_available", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "rate", seriesId: "debt.rate.external", value: 2.5, valueKind: "percent", status: "actual", sourceId: null, snapshotDate: null, lastReviewedAt: "2026-09-01" },
];

const gdpFacts: ServedNationalGdpFact[] = [
  { year: 2025, gdpCurrentPricesGel: 800, accountingStandard: "sna_2008", status: "preliminary", sourceId: "gdp" },
];

describe("Government Debt explorer model", () => {
  it("defaults to only the total Government Debt series", () => {
    expect(getDefaultDebtSelection("stock")).toEqual(["debt.stock.total"]);
  });

  it("keeps unlimited selections within one family", () => {
    expect(selectDebtSeries(["debt.stock.total"], "debt.stock.domestic")).toEqual([
      "debt.stock.total",
      "debt.stock.domestic",
    ]);
  });

  it("replaces a selection when a series belongs to another family", () => {
    expect(selectDebtSeries(["debt.stock.total", "debt.stock.domestic"], "debt.service.total")).toEqual([
      "debt.service.total",
    ]);
  });

  it("allows the active family to be cleared completely", () => {
    expect(selectDebtSeries(["debt.stock.total"], "debt.stock.total")).toEqual([]);
  });

  it("builds the approved nine-series hierarchy with every parent expanded", () => {
    const model = buildDebtExplorerModel({
      facts,
      gdpFacts,
      family: "stock",
      selectedIds: ["debt.stock.total"],
      range: { start: 2025, end: 2025 },
      shareOfGdp: false,
    });

    expect(model.items.map((item) => [item.id, item.parentItemId, item.kaLabel])).toEqual([
      ["debt.stock.total", null, "მთლიანი ვალი"],
      ["debt.stock.domestic", "debt.stock.total", "საშინაო ვალი"],
      ["debt.stock.external", "debt.stock.total", "საგარეო ვალი"],
      ["debt.service.total", null, "ვალის გადახდა"],
      ["debt.service.principal", "debt.service.total", "ძირი თანხა"],
      ["debt.service.interest", "debt.service.total", "პროცენტი"],
      ["debt.rate.total", null, "საპროცენტო განაკვეთი"],
      ["debt.rate.domestic", "debt.rate.total", "საშინაო განაკვეთი"],
      ["debt.rate.external", "debt.rate.total", "საგარეო განაკვეთი"],
    ]);
    expect(model.expandedParentIds).toEqual([
      "debt.stock.total",
      "debt.service.total",
      "debt.rate.total",
    ]);
  });

  it("calculates stock shares from same-year GDP", () => {
    const model = buildDebtExplorerModel({
      facts,
      gdpFacts,
      family: "stock",
      selectedIds: ["debt.stock.total"],
      range: { start: 2025, end: 2025 },
      shareOfGdp: true,
    });

    expect(model.points).toEqual([
      expect.objectContaining({ itemId: "debt.stock.total", year: 2025, value: 0.5 }),
    ]);
    expect(model.totalRow?.shareByYear?.[2025]).toBe(0.5);
  });

  it("uses the source-preserving forecast service total instead of recomputing its children", () => {
    const model = buildDebtExplorerModel({
      facts,
      gdpFacts,
      family: "service",
      selectedIds: ["debt.service.total"],
      range: { start: 2025, end: 2026 },
      shareOfGdp: false,
    });

    expect(model.points.find((point) => point.year === 2026)).toEqual(
      expect.objectContaining({ value: 100.1, status: "projection_existing_portfolio" }),
    );
    expect(model.forecastStartYear).toBe(2026);
  });

  it("keeps documented rate gaps as null values", () => {
    const model = buildDebtExplorerModel({
      facts,
      gdpFacts,
      family: "rate",
      selectedIds: ["debt.rate.domestic"],
      range: { start: 2025, end: 2025 },
      shareOfGdp: false,
    });

    expect(model.points[0]).toEqual(expect.objectContaining({ value: null, status: "not_available" }));
    expect(model.tableRows[0]?.valuesByYear[2025]).toBeNull();
  });
});
