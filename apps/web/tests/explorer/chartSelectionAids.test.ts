import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { enoughInView, legendShown, legendValue } from "../../components/explorer-shell/chart-selection-aids";
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

describe("legendShown", () => {
  it("hides the legend above ten lines by default", () => {
    expect(legendShown(1)).toBe(false);
    expect(legendShown(2)).toBe(true);
    expect(legendShown(10)).toBe(true);
    expect(legendShown(11)).toBe(false);
    expect(legendShown(218)).toBe(false);
    // A page may set its own cap, down to none at all.
    expect(legendShown(11, 20)).toBe(true);
    expect(legendShown(2, 0)).toBe(false);
  });
});

// X1-01/X1-22: the aids are a sibling each page mounts by hand, so a new line-chart page can
// forget them. Every <EditorialLineChart> needs its own <ChartSelectionAids>, apart from
// charts that only ever draw one line or carry a legend of their own.
const WITHOUT_AIDS: Record<string, number> = {
  "gdp/gdp-overview.tsx": 1, // one line, the chosen indicator
  "demography/national-vital-charts.tsx": 2, // fertility rate (one line); age curves (own year legend)
};

describe("phone legend guard", () => {
  it("mounts the phone legend and return pill beside every multi-line chart", () => {
    const root = resolve(process.cwd(), "components");
    const count = (source: string, tag: string) => source.split(tag).length - 1;
    const callers = (readdirSync(root, { recursive: true }) as string[])
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => [file.replaceAll("\\", "/"), readFileSync(resolve(root, file), "utf8")] as const)
      .filter(([, source]) => count(source, "<EditorialLineChart"));
    expect(callers.length).toBeGreaterThan(20);
    const missing = callers
      .map(([file, source]) => [file, count(source, "<EditorialLineChart") - count(source, "<ChartSelectionAids")] as const)
      .filter(([, charts]) => charts !== 0);
    expect(Object.fromEntries(missing)).toEqual(WITHOUT_AIDS);
  });
});
