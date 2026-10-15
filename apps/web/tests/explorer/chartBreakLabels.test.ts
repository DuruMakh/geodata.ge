import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { EditorialLineChart } from "../../components/main-explorer/editorial-line-chart";
import { chartGeometry, renderGeorgianMarkup } from "../helpers/render-localized";

const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const vals = [100, 200, 300, 400, 500, 600, 700];
// The phone drawing is 340px wide: breaks one year apart sit well inside the width of their two labels.
const phone = (breaks: Array<{ year: number; label: string }>) =>
  chartGeometry(renderGeorgianMarkup(createElement(EditorialLineChart, {
    years,
    series: [{ id: "s", label: "S", color: "#B3402A", vals, planned: vals.map(() => false) }],
    share: false,
    unit: { divisor: 1_000, label: "k", decimals: 0 },
    shareLabel: "%",
    breaks,
  })), "mobile");
const rules = (svg: string) => (svg.match(/stroke-dasharray="4 3"/g) ?? []).length;
const labels = (svg: string) => [...svg.matchAll(/<g data-testid="chart-break">[^]*?<\/g>/g)]
  .flatMap(([group]) => [...group.matchAll(/<text [^>]*\by="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map(([, y, text]) => ({ y: Number(y), text: text! })));

describe("EditorialLineChart break labels on a narrow chart", () => {
  it("prints a label once when two nearby breaks share it, and keeps both rules", () => {
    const svg = phone([{ year: 2023, label: "Re-base" }, { year: 2024, label: "Re-base" }]);
    expect(rules(svg)).toBe(2);
    expect(labels(svg)).toHaveLength(1);
  });

  it("drops the second label one line lower when two nearby breaks differ", () => {
    const svg = phone([{ year: 2023, label: "Re-base" }, { year: 2024, label: "New method" }]);
    expect(rules(svg)).toBe(2);
    const [first, second] = labels(svg);
    expect(labels(svg)).toHaveLength(2);
    expect(second!.y).toBeGreaterThan(first!.y);
    expect(second!.y - first!.y).toBe(15);
  });

  it("draws a single break as before", () => {
    const svg = phone([{ year: 2023, label: "Re-base" }]);
    expect(rules(svg)).toBe(1);
    expect(labels(svg)).toHaveLength(1);
  });
});
