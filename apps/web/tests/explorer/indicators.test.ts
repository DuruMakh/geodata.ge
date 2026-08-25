import { describe, expect, it } from "vitest";
import { compoundAnnualGrowth, rankPeriodDeltas } from "../../lib/explorer/indicators";
import { buildKpiShareSeries } from "../../lib/explorer/sparkline";
import type { ExplorerTableRow } from "../../lib/explorer/types";

function row(shareByYear: Record<number, number | null>): ExplorerTableRow {
  return {
    itemId: "revenue.vat",
    parentItemId: null,
    level: "public_field",
    kaLabel: "დღგ",
    enLabel: "VAT",
    color: "#B3402A",
    basisByYear: {},
    valuesByYear: {},
    shareByYear,
    change: null,
  };
}

function valuedRow(itemId: string, valuesByYear: Record<number, number | null>): ExplorerTableRow {
  return {
    itemId,
    parentItemId: null,
    level: "public_field",
    kaLabel: itemId,
    enLabel: itemId,
    color: "#B3402A",
    basisByYear: {},
    valuesByYear,
    shareByYear: {},
    change: null,
  };
}

describe("buildKpiShareSeries", () => {
  it("uses the row's calculated GDP-share series", () => {
    const series = buildKpiShareSeries(row({ 2020: 0.25, 2021: 0.2 }), [2020, 2021]);

    expect(series).toEqual([0.25, 0.2]);
  });

  it("yields null where the same-year GDP share is missing", () => {
    const series = buildKpiShareSeries(row({ 2020: 0.25 }), [2020, 2021]);

    expect(series).toEqual([0.25, null]);
  });

  it("returns an all-null series when there is no row", () => {
    expect(buildKpiShareSeries(null, [2020])).toEqual([null]);
  });
});

describe("compoundAnnualGrowth", () => {
  it("returns the annual rate that compounds start into end over the period", () => {
    // 160 → 370 across 2023→2025 is two compounding intervals, not three years.
    expect(compoundAnnualGrowth(160, 370, 2023, 2025)).toBeCloseTo((370 / 160) ** (1 / 2) - 1, 12);
  });

  it("returns zero for a flat series", () => {
    expect(compoundAnnualGrowth(500, 500, 2020, 2025)).toBeCloseTo(0, 12);
  });

  it("returns a negative rate for a shrinking series", () => {
    const rate = compoundAnnualGrowth(400, 100, 2020, 2022);

    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
    expect(rate!).toBeCloseTo(0.5 - 1, 12);
  });

  it("has no rate without a period to compound over", () => {
    expect(compoundAnnualGrowth(100, 200, 2025, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, 200, 2025, 2024)).toBeNull();
  });

  // Growth from or to a non-positive value is not meaningful for display — the
  // same rule explorerData.ts and singleYear.ts apply to period change.
  it("has no rate from a non-positive base or to a non-positive end", () => {
    expect(compoundAnnualGrowth(0, 200, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(-50, 200, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(200, 0, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(200, -50, 2020, 2025)).toBeNull();
  });

  it("has no rate when an endpoint or a year is missing", () => {
    expect(compoundAnnualGrowth(null, 200, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, null, 2020, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, 200, undefined, 2025)).toBeNull();
    expect(compoundAnnualGrowth(100, 200, 2020, undefined)).toBeNull();
  });
});

describe("rankPeriodDeltas", () => {
  it("orders rows by absolute period increase, biggest first", () => {
    const ranked = rankPeriodDeltas(
      [
        valuedRow("small", { 2020: 100, 2025: 150 }),
        valuedRow("big", { 2020: 100, 2025: 900 }),
        valuedRow("middle", { 2020: 100, 2025: 400 }),
      ],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["big", "middle", "small"]);
    expect(ranked[0].delta).toBe(800);
  });

  // A delta measured against a non-positive start is mostly the unwind of a
  // correction (revenue.other_taxes 2020→2021), not a real increase.
  it("excludes rows whose start is zero or negative", () => {
    const ranked = rankPeriodDeltas(
      [
        valuedRow("fromZero", { 2020: 0, 2025: 900 }),
        valuedRow("fromNegative", { 2020: -200, 2025: 900 }),
        valuedRow("real", { 2020: 100, 2025: 400 }),
      ],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["real"]);
  });

  it("excludes rows missing either endpoint rather than treating a gap as zero", () => {
    const ranked = rankPeriodDeltas(
      [
        valuedRow("noEnd", { 2020: 100 }),
        valuedRow("noStart", { 2025: 400 }),
        valuedRow("nullEnd", { 2020: 100, 2025: null }),
        valuedRow("real", { 2020: 100, 2025: 400 }),
      ],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["real"]);
  });

  it("keeps a shrinking row, ranked last, rather than dropping it", () => {
    const ranked = rankPeriodDeltas(
      [valuedRow("shrank", { 2020: 400, 2025: 100 }), valuedRow("grew", { 2020: 100, 2025: 400 })],
      2020,
      2025,
    );

    expect(ranked.map((entry) => entry.row.itemId)).toEqual(["grew", "shrank"]);
    expect(ranked[1].delta).toBe(-300);
  });

  it("does not mutate the caller's array", () => {
    const rows = [valuedRow("a", { 2020: 100, 2025: 150 }), valuedRow("b", { 2020: 100, 2025: 900 })];

    rankPeriodDeltas(rows, 2020, 2025);

    expect(rows.map((row) => row.itemId)).toEqual(["a", "b"]);
  });
});
