import { describe, expect, it } from "vitest";
import { readCsvRecords } from "../../lib/data/csv";
import { GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS } from "../../lib/data/governmentDebt/types";
import {
  buildDebtDeck,
  buildDebtExplorerModel,
  DEBT_RATE_SOURCE_DECIMALS,
  debtRateDecimals,
  formatDebtRate,
  getDefaultDebtSelection,
  selectDebtSeries,
} from "../../lib/explorer/debtExplorer";
import type {
  DebtFamily,
  DebtSeriesId,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../../lib/servedRows";

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
  it("defaults to the total, keeps unlimited selections within one family, replaces across families and clears completely", () => {
    expect(getDefaultDebtSelection("stock")).toEqual(["debt.stock.total"]);
    expect(selectDebtSeries(["debt.stock.total"], "debt.stock.domestic")).toEqual([
      "debt.stock.total",
      "debt.stock.domestic",
    ]);
    expect(selectDebtSeries(["debt.stock.total", "debt.stock.domestic"], "debt.service.total")).toEqual([
      "debt.service.total",
    ]);
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

    expect(model.items.map((item) => [item.id, item.parentItemId, item.kaLabel, item.color])).toEqual([
      ["debt.stock.total", null, "მთლიანი ვალი", "#1E1B16"],
      ["debt.stock.domestic", "debt.stock.total", "საშინაო ვალი", "#A5822B"],
      ["debt.stock.external", "debt.stock.total", "საგარეო ვალი", "#496F83"],
      ["debt.service.total", null, "ვალის გადახდა", "#1F6E56"],
      ["debt.service.principal", "debt.service.total", "ძირი თანხა", "#725B8F"],
      ["debt.service.interest", "debt.service.total", "პროცენტი", "#B3402A"],
      ["debt.rate.total", null, "საპროცენტო განაკვეთი", "#1E1B16"],
      ["debt.rate.domestic", "debt.rate.total", "საშინაო განაკვეთი", "#A5822B"],
      ["debt.rate.external", "debt.rate.total", "საგარეო განაკვეთი", "#496F83"],
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

describe("interest-rate precision", () => {
  it("takes each rate's decimals from what its source prints", () => {
    // Chart labels in the monthly report and the 2019-2021 strategy print one decimal; the later strategy tables two.
    expect(debtRateDecimals("source.mof_monthly_debt_report_2026_07")).toBe(1);
    expect(debtRateDecimals("mof_debt_strategy_2019_2021")).toBe(1);
    expect(debtRateDecimals("source.mof_debt_strategy_2022_2025")).toBe(2);
    expect(debtRateDecimals("source.mof_debt_strategy_2023_2026")).toBe(2);
    expect(debtRateDecimals("mof_debt_strategy_2025_2029")).toBe(2);
    // Every reviewed rate source states its precision; none falls back to the one-decimal default.
    expect(Object.keys(DEBT_RATE_SOURCE_DECIMALS).sort()).toEqual([...GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS].sort());
  });

  it("formats a rate as printed: 3.1% stays 3.1%, 9.20% keeps its zero, 0.95% is not rounded away", () => {
    const facts = [
      { year: 2015, family: "rate", seriesId: "debt.rate.total", value: 3.1, valueKind: "percent", status: "actual", sourceId: "source.mof_monthly_debt_report_2026_07" },
      { year: 2018, family: "rate", seriesId: "debt.rate.domestic", value: 8.3, valueKind: "percent", status: "actual", sourceId: "source.mof_debt_strategy_2019_2021" },
      { year: 2022, family: "rate", seriesId: "debt.rate.domestic", value: 9.2, valueKind: "percent", status: "actual", sourceId: "source.mof_debt_strategy_2023_2026" },
      { year: 2021, family: "rate", seriesId: "debt.rate.external", value: 0.95, valueKind: "percent", status: "actual", sourceId: "source.mof_debt_strategy_2023_2026" },
    ] as const;
    const format = formatDebtRate(facts);
    expect(format(3.1, "debt.rate.total", 2015)).toBe("3.1%");
    expect(format(8.3, "debt.rate.domestic", 2018)).toBe("8.3%");
    expect(format(9.2, "debt.rate.domestic", 2022)).toBe("9.20%");
    expect(format(0.95, "debt.rate.external", 2021)).toBe("0.95%");
  });

  it("never truncates a served rate: each value has no more decimals than its source prints", async () => {
    const rows = await readCsvRecords("../../data/imports/government-debt-facts-2013-2030.csv");
    const rates = rows.filter((row) => row.family === "rate" && row.value !== "");
    expect(rates.length).toBe(22);
    for (const row of rates) {
      expect((row.value.split(".")[1] ?? "").length, `${row.series_id} ${row.year}`).toBeLessThanOrEqual(debtRateDecimals(row.source_id));
    }
  });
});

describe("debt deck", () => {
  function deckFact(
    year: number,
    family: DebtFamily,
    seriesId: DebtSeriesId,
    value: number | null,
    status: ServedGovernmentDebtFact["status"] = "actual",
  ): ServedGovernmentDebtFact {
    return {
      year,
      family,
      seriesId,
      value,
      valueKind: family === "rate" ? "percent" : "amount_gel",
      status,
      sourceId: null,
      snapshotDate: status === "projection_existing_portfolio" ? "2025-12-31" : null,
      lastReviewedAt: "2026-09-01",
    };
  }

  // Values copied from data/imports/government-debt-facts-2013-2030.csv.
  const deckFacts: ServedGovernmentDebtFact[] = [
    deckFact(2024, "stock", "debt.stock.total", 33_169_300_000),
    deckFact(2025, "stock", "debt.stock.total", 35_934_400_000),
    deckFact(2025, "stock", "debt.stock.domestic", 12_000_000_000),
    deckFact(2024, "service", "debt.service.total", 4_810_480_000),
    deckFact(2025, "service", "debt.service.total", 4_369_500_000),
    deckFact(2029, "service", "debt.service.total", 3_879_110_512, "projection_existing_portfolio"),
    deckFact(2030, "service", "debt.service.total", 3_720_016_442, "projection_existing_portfolio"),
    deckFact(2024, "rate", "debt.rate.total", 4.9),
    deckFact(2025, "rate", "debt.rate.total", 4.7),
  ];

  it("leads the stock family with its latest actual total and relative change", () => {
    expect(buildDebtDeck(deckFacts, "stock")).toEqual({
      year: 2025,
      value: 35_934_400_000,
      change: { kind: "relative", value: expect.closeTo(35_934_400_000 / 33_169_300_000 - 1, 12) },
    });
  });

  it("never leads debt service with an existing-portfolio projection", () => {
    expect(buildDebtDeck(deckFacts, "service")).toEqual({
      year: 2025,
      value: 4_369_500_000,
      change: { kind: "relative", value: expect.closeTo(4_369_500_000 / 4_810_480_000 - 1, 12) },
    });
  });

  it("reports an interest-rate change in percentage points", () => {
    const deck = buildDebtDeck(deckFacts, "rate");
    expect(deck?.year).toBe(2025);
    expect(deck?.value).toBe(4.7);
    expect(deck?.change?.kind).toBe("points");
    expect(deck?.change?.value).toBeCloseTo(-0.2, 10);
  });

  it("shows no change when the previous year is missing or not actual", () => {
    expect(buildDebtDeck([deckFact(2025, "stock", "debt.stock.total", 1)], "stock")?.change).toBeNull();
    expect(buildDebtDeck([
      deckFact(2024, "rate", "debt.rate.total", null, "not_available"),
      deckFact(2025, "rate", "debt.rate.total", 4.7),
    ], "rate")?.change).toBeNull();
  });

  it("returns null when the family has no actual total", () => {
    expect(buildDebtDeck([
      deckFact(2026, "service", "debt.service.total", 5, "projection_existing_portfolio"),
    ], "service")).toBeNull();
  });
});
