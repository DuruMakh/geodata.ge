import { describe, expect, it } from "vitest";
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
    shareEndYear: null,
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
