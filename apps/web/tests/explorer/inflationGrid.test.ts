import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import { GRID_TINTS, MOM_BINS, YOY_BINS, binFor, buildMonthGrid, contrastRatio, decemberAverages, displayedValue, legendLabels } from "../../lib/explorer/inflationGrid";
import { formatInflationValue } from "../../lib/explorer/inflationLabels";

const series = new Map<number, number>();
for (let period = makePeriod(2024, 3); period <= makePeriod(2026, 8); period += 1) series.set(period, (period % 13) - 2);

describe("month grid", () => {
  it("bins on the spec's five-step scales", () => {
    expect([-0.1, 0, 2.99, 3, 6, 9.99, 10].map((value) => binFor(value, YOY_BINS))).toEqual([0, 1, 1, 2, 3, 3, 4]);
    expect([-0.01, 0, 0.5, 1, 2].map((value) => binFor(value, MOM_BINS))).toEqual([0, 1, 2, 3, 4]);
    expect(legendLabels(YOY_BINS)).toEqual(["< 0%", "0–3%", "3–6%", "6–10%", "≥ 10%"]);
    expect(legendLabels(MOM_BINS)).toEqual(["< 0%", "0–0.5%", "0.5–1%", "1–2%", "≥ 2%"]);
  });

  it("bins and prints the one-decimal value a reader sees", () => {
    expect(displayedValue(2.96)).toBe(3);
    expect(Object.is(displayedValue(-0.0078), 0)).toBe(true);
    const values = new Map([[makePeriod(2025, 1), 2.96], [makePeriod(2025, 2), -0.0078]]);
    const [row] = buildMonthGrid({ values, range: { start: makePeriod(2025, 1), end: makePeriod(2025, 2) }, edges: YOY_BINS });
    expect(row!.cells.slice(0, 2)).toMatchObject([{ bin: 2 }, { bin: 1 }]);
    expect([formatInflationValue(2.96, "yoy"), formatInflationValue(-0.0078, "yoy"), formatInflationValue(-0.0078, "mom")]).toEqual(["3.0%", "0.0%", "0.0%"]);
  });

  it("passes WCAG AA for every tint and its text", () => {
    for (const tint of GRID_TINTS) expect(contrastRatio(tint.text, tint.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("lists years newest first and separates empty from missing cells", () => {
    const rows = buildMonthGrid({ values: series, range: { start: makePeriod(2024, 1), end: makePeriod(2026, 8) }, edges: YOY_BINS });
    expect(rows.map((row) => row.year)).toEqual([2026, 2025, 2024]);
    expect(rows[0]!.cells[8]).toEqual({ kind: "empty" }); // September 2026: not yet published
    expect(rows[2]!.cells[0]).toEqual({ kind: "missing" }); // January 2024: in range, before the series starts
    expect(rows[2]!.cells[2]).toMatchObject({ kind: "value", value: series.get(makePeriod(2024, 3)) });
    expect(rows.every((row) => row.summary === null)).toBe(true);
  });

  it("blanks months outside a manual range and prints plain values without edges", () => {
    const rows = buildMonthGrid({ values: series, range: { start: makePeriod(2025, 4), end: makePeriod(2025, 9) }, edges: null });
    expect(rows.map((row) => row.year)).toEqual([2025]);
    expect(rows[0]!.cells[2]).toEqual({ kind: "empty" });
    expect(rows[0]!.cells[3]).toMatchObject({ kind: "value", bin: null });
    expect(rows[0]!.cells[9]).toEqual({ kind: "empty" });
  });

  it("adds the December 12-month average for complete years only", () => {
    const avg12 = new Map([[makePeriod(2024, 12), 1.1], [makePeriod(2025, 12), 3.9], [makePeriod(2026, 8), 5.1]]);
    const summary = decemberAverages(avg12);
    expect([...summary]).toEqual([[2024, 1.1], [2025, 3.9]]);
    const rows = buildMonthGrid({ values: series, range: { start: makePeriod(2024, 1), end: makePeriod(2026, 8) }, edges: YOY_BINS, summaryByYear: summary });
    expect(rows[0]!.summary).toEqual({ kind: "empty" });
    expect(rows[1]!.summary).toEqual({ kind: "value", value: 3.9, bin: null });
  });
});
