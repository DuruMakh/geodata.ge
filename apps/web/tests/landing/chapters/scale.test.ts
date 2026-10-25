import { describe, expect, it } from "vitest";
import type { Messages } from "../../../lib/i18n/types";
import { buildScaleChapter } from "../../../lib/landing/chapters/scale";
import type { RevenueSeries, SpendingSeries } from "../../../lib/landing/chapters/types";
import type { ForeignInvestmentFact, MoneyTransferFact } from "../../../lib/data/externalFlows/types";
import type { ServedGdpObservation } from "../../../lib/data/gdpOverview/types";
import type { ServedGeneralGovernmentBalanceFact, ServedGovernmentDebtFact } from "../../../lib/servedRows";

const messages: Messages = {
  "landing.scale.gdp": "ნომინალური მშპ",
  "landing.scale.revenue": "ნაერთი ბიუჯეტის შემოსულობები",
  "landing.scale.spending": "სახელმწიფო ბიუჯეტის ხარჯები",
  "landing.scale.debt": "მთავრობის ვალი",
  "landing.scale.deficit": "ზოგადი მთავრობის დეფიციტი",
  "landing.scale.surplus": "ზოგადი მთავრობის პროფიციტი",
  "landing.scale.municipal": "მუნიციპალიტეტების ბიუჯეტები",
  "landing.scale.fdi": "უცხოური ინვესტიციები",
  "landing.scale.remittances": "ფულადი გზავნილები",
};

const GDP_GEL = 104_598_139_883;
const GDP_USD = 38_143_610_371;

function gdp(seriesId: "nominal_gel" | "nominal_usd", year: number, value: number): ServedGdpObservation {
  return {
    seriesId,
    year,
    value,
    unit: seriesId === "nominal_gel" ? "gel" : "usd",
    status: "published",
    accountingStandard: "sna_2008",
    sourceId: "source.geostat_gdp",
    sourceLocator: "x",
    lastReviewedAt: "2026-01-01",
  };
}

function debt(year: number, value: number | null): ServedGovernmentDebtFact {
  return {
    year,
    family: "stock",
    seriesId: "debt.stock.total",
    value,
    valueKind: "amount_gel",
    status: "actual",
    sourceId: "source.mof_debt",
    snapshotDate: null,
    lastReviewedAt: "2026-01-01",
  };
}

function balance(year: number, generalGovernmentBalanceGel: number): ServedGeneralGovernmentBalanceFact {
  return {
    year,
    generalGovernmentBalancePctGdp: 0,
    generalGovernmentBalanceGel,
    status: "actual",
    sourceId: "source.mof_balance",
    lastReviewedAt: "2026-01-01",
  };
}

function fdi(year: number, valueUsd: string | null): ForeignInvestmentFact {
  return {
    entityId: "fdi.total",
    year,
    valueUsd,
    unit: "usd",
    basis: "actual",
    valueStatus: "numeric",
    sourceId: "source.geostat_fdi_by_quarters",
    sourceSheet: "s",
    sourceCells: "A1",
    sourceUnit: "thousand_usd",
    vintage: "v",
    lastReviewedAt: "2026-01-01",
  };
}

function transfer(year: number, valueUsd: string | null): MoneyTransferFact {
  return {
    entityId: "transfer.total",
    year,
    measure: "received",
    valueUsd,
    unit: "usd",
    basis: "actual",
    valueStatus: "numeric",
    monthsReported: null,
    sourceId: "source.nbg_money_transfers_by_countries",
    sourceSheet: "s",
    sourceCells: "A1",
    sourceUnit: "thousand_usd",
    vintage: "v",
    lastReviewedAt: "2026-01-01",
  };
}

const spending: SpendingSeries = { years: [2024, 2025], planned: [false, false], totals: [20_000_000_000, 21_000_000_000], fields: [] };
const revenue: RevenueSeries = {
  years: [2024, 2025],
  planned: [false, false],
  totals: [19_000_000_000, 20_500_000_000],
  taxShare: [0.9, 0.9],
  bands: [],
  peakBorrowing: null,
};

function input(overrides: Partial<Parameters<typeof buildScaleChapter>[0]> = {}): Parameters<typeof buildScaleChapter>[0] {
  return {
    gdp: [gdp("nominal_gel", 2024, 90_000_000_000), gdp("nominal_gel", 2025, GDP_GEL), gdp("nominal_usd", 2025, GDP_USD)],
    spending,
    revenue,
    debtFacts: [debt(2025, 30_000_000_000)],
    balanceFacts: [balance(2025, -2_000_000_000)],
    municipalTotals: new Map([[2025, 3_000_000_000]]),
    fdiFacts: [fdi(2025, "1900386201")],
    transferFacts: [transfer(2025, "4000000000")],
    ...overrides,
  };
}

describe("buildScaleChapter", () => {
  it("year is the latest nominal_gel year; squares = round(gdpGel / 10_000_000)", () => {
    const chapter = buildScaleChapter(input(), messages);
    expect(chapter.year).toBe(2025);
    expect(chapter.gdpGel).toBe(GDP_GEL);
    expect(chapter.squares).toBe(10_460);
  });

  it("measures come in the order gdp, revenue, spending, debt, balance, municipal, fdi, remittances; defaultId is spending", () => {
    const chapter = buildScaleChapter(input(), messages);
    expect(chapter.measures.map((measure) => measure.id)).toEqual([
      "gdp", "revenue", "spending", "debt", "balance", "municipal", "fdi", "remittances",
    ]);
    expect(chapter.defaultId).toBe("spending");
    expect(chapter.measures[0].label).toBe("ნომინალური მშპ");
    expect(chapter.measures[1].valueGel).toBe(20_500_000_000);
    expect(chapter.measures[2].valueGel).toBe(21_000_000_000);
    expect(chapter.measures[5].valueGel).toBe(3_000_000_000);
  });

  it("usd measures convert with nominal_gel / nominal_usd of the same year", () => {
    const chapter = buildScaleChapter(input(), messages);
    const rate = GDP_GEL / GDP_USD;
    const fdiMeasure = chapter.measures.find((measure) => measure.id === "fdi")!;
    expect(fdiMeasure.valueGel).toBeCloseTo((1_900_386_201 * 104_598_139_883) / 38_143_610_371, 0);
    expect(chapter.measures.find((measure) => measure.id === "remittances")!.valueGel).toBeCloseTo(4_000_000_000 * rate, 0);
  });

  it("balance uses the absolute GEL value and its label says deficit or surplus by sign", () => {
    const deficit = buildScaleChapter(input(), messages).measures.find((measure) => measure.id === "balance")!;
    expect(deficit.valueGel).toBe(2_000_000_000);
    expect(deficit.label).toBe("ზოგადი მთავრობის დეფიციტი");

    const surplus = buildScaleChapter(input({ balanceFacts: [balance(2025, 1_500_000_000)] }), messages).measures.find(
      (measure) => measure.id === "balance",
    )!;
    expect(surplus.valueGel).toBe(1_500_000_000);
    expect(surplus.label).toBe("ზოგადი მთავრობის პროფიციტი");
  });

  it("a zero balance is a surplus, as in chapter 05", () => {
    const zero = buildScaleChapter(input({ balanceFacts: [balance(2025, 0)] }), messages).measures.find((measure) => measure.id === "balance")!;
    expect(zero.valueGel).toBe(0);
    expect(zero.label).toBe("ზოგადი მთავრობის პროფიციტი");
  });

  it("drops FDI and money transfers whose value is not a full numeric year", () => {
    const chapter = buildScaleChapter(
      input({
        fdiFacts: [{ ...fdi(2025, "1900386201"), valueStatus: "not_applicable" }],
        transferFacts: [{ ...transfer(2025, "2000000000"), valueStatus: "partial_months", monthsReported: 6 }],
      }),
      messages,
    );
    expect(chapter.measures.map((measure) => measure.id)).not.toContain("fdi");
    expect(chapter.measures.map((measure) => measure.id)).not.toContain("remittances");
    const blank = buildScaleChapter(input({ transferFacts: [{ ...transfer(2025, "2000000000"), valueStatus: "blank" }] }), messages);
    expect(blank.measures.map((measure) => measure.id)).not.toContain("remittances");
  });

  it("a measure with no value for the year is omitted", () => {
    const chapter = buildScaleChapter(
      input({
        debtFacts: [debt(2024, 28_000_000_000), debt(2025, null)],
        balanceFacts: [],
        municipalTotals: new Map(),
        fdiFacts: [fdi(2025, null)],
        transferFacts: [],
      }),
      messages,
    );
    expect(chapter.measures.map((measure) => measure.id)).toEqual(["gdp", "revenue", "spending"]);
  });

  it("ignores debt facts that are not the actual total stock in GEL", () => {
    const wrong: ServedGovernmentDebtFact[] = [
      { ...debt(2025, 50), seriesId: "debt.stock.external" },
      { ...debt(2025, 60), valueKind: "percent" },
      { ...debt(2025, 70), status: "projection_existing_portfolio" },
    ];
    const chapter = buildScaleChapter(input({ debtFacts: wrong }), messages);
    expect(chapter.measures.some((measure) => measure.id === "debt")).toBe(false);
  });

  it("uses only an actual balance fact, never a projection", () => {
    const projected = buildScaleChapter(input({ balanceFacts: [{ ...balance(2025, -9_000_000_000), status: "projection" }] }), messages);
    expect(projected.measures.some((measure) => measure.id === "balance")).toBe(false);
    const both = buildScaleChapter(
      input({ balanceFacts: [{ ...balance(2025, -9_000_000_000), status: "projection" }, balance(2025, -2_000_000_000)] }),
      messages,
    );
    expect(both.measures.find((measure) => measure.id === "balance")?.valueGel).toBe(2_000_000_000);
  });

  it("marks spending and revenue planned when their value for the year is planned; the rest are actual", () => {
    const actual = buildScaleChapter(input(), messages);
    expect(actual.measures.every((measure) => !measure.planned)).toBe(true);
    const chapter = buildScaleChapter(
      input({ spending: { ...spending, planned: [false, true] }, revenue: { ...revenue, planned: [true, false] } }),
      messages,
    );
    expect(chapter.measures.filter((measure) => measure.planned).map((measure) => measure.id)).toEqual(["spending"]);
  });

  it("share = valueGel / gdpGel; squares = round(valueGel / 10_000_000)", () => {
    const chapter = buildScaleChapter(input(), messages);
    const spendingMeasure = chapter.measures.find((measure) => measure.id === "spending")!;
    expect(spendingMeasure.share).toBeCloseTo(21_000_000_000 / GDP_GEL, 10);
    expect(spendingMeasure.squares).toBe(2_100);
    const gdpMeasure = chapter.measures[0];
    expect(gdpMeasure.share).toBe(1);
    expect(gdpMeasure.squares).toBe(10_460);
  });
});
