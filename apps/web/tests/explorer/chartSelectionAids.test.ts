import { describe, expect, it } from "vitest";
import { enoughInView, legendValue } from "../../components/explorer-shell/chart-selection-aids";
import { UNIT_BN } from "../../lib/explorer/format";

// Owner decision D4 (2026-10-07): the phone legend and the "↑ chart" pill.
describe("legendValue", () => {
  it("prints the last drawn period like the chart: amounts with their unit, shares as percentages", () => {
    expect(legendValue([1e9, 27.7e9], { share: false, unit: UNIT_BN })).toBe("27.7 მლრდ");
    expect(legendValue([12.5, 19.6], { share: true, unit: UNIT_BN })).toBe("19.6%");
    expect(legendValue([1, 13.94], { share: false, unit: UNIT_BN, formatValue: (value) => `${value.toFixed(1)}%` })).toBe("13.9%");
  });

  it("drops an empty unit label and marks a missing latest value", () => {
    expect(legendValue([101.25], { share: false, unit: { divisor: 1, label: "", decimals: 1 } })).toBe("101.3");
    expect(legendValue([5, null], { share: true, unit: UNIT_BN })).toBe("—");
    expect(legendValue([], { share: true, unit: UNIT_BN })).toBe("—");
  });
});

describe("enoughInView", () => {
  it("needs half the chart, or half a screen of a taller one", () => {
    expect(enoughInView(160, 300, 844)).toBe(true);
    expect(enoughInView(100, 300, 844)).toBe(false);
    expect(enoughInView(430, 2800, 844)).toBe(true);
    expect(enoughInView(300, 2800, 844)).toBe(false);
    expect(enoughInView(-50, 300, 844)).toBe(false);
  });
});
