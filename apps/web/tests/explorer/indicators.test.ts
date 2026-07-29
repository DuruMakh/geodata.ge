import { describe, expect, it } from "vitest";
import { buildKpiShareSeries } from "../../lib/explorer/sparkline";
import type { ExplorerTableRow } from "../../lib/explorer/types";

function row(valuesByYear: Record<number, number | null>): ExplorerTableRow {
  return {
    itemId: "revenue.vat",
    parentItemId: null,
    level: "public_field",
    detailLabel: null,
    kaLabel: "დღგ",
    enLabel: "VAT",
    color: "#B3402A",
    basisByYear: {},
    sourceByYear: {},
    valuesByYear,
    change: null,
    shareEndYear: null,
  };
}

describe("buildKpiShareSeries", () => {
  it("divides the row by the total for each year", () => {
    const series = buildKpiShareSeries(row({ 2020: 25, 2021: 50 }), row({ 2020: 100, 2021: 200 }), [2020, 2021]);

    expect(series).toEqual([0.25, 0.25]);
  });

  it("yields null where either side is missing", () => {
    const series = buildKpiShareSeries(row({ 2020: 25 }), row({ 2020: 100, 2021: 200 }), [2020, 2021]);

    expect(series).toEqual([0.25, null]);
  });

  it("yields null rather than dividing by a zero total", () => {
    const series = buildKpiShareSeries(row({ 2020: 25 }), row({ 2020: 0 }), [2020]);

    expect(series).toEqual([null]);
  });

  it("returns an all-null series when there is no total row", () => {
    expect(buildKpiShareSeries(row({ 2020: 25 }), null, [2020])).toEqual([null]);
  });
});
