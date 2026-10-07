import { describe, expect, it } from "vitest";
import { axisLabelWidth, axisLeftPaddingFor, decimalsFor, fitAxisLabels, niceScale, periodAnchors } from "../../lib/explorer/chartScale";

describe("chart scale helpers", () => {
  // Review cases (2026-10-07): the old top (max × 1.12 snapped to 1/2/2.5/5/10,
  // then four equal steps) gave 27.7 → 50, 104 → 200, 27% → 50%, −45% → −100%.
  it.each([
    ["expenditure 27.7 bn", 0, 27.7, 0, { bottom: 0, top: 30, step: 5 }],
    ["GDP nominal 104 bn", 0, 104, 0, { bottom: 0, top: 120, step: 20 }],
    ["unemployment rate 27%", 0, 27, 0, { bottom: 0, top: 30, step: 5 }],
    ["unemployment by age 52%", 0, 52, 0, { bottom: 0, top: 60, step: 10 }],
    ["GDP growth −45% … +12%", -45, 12, 0, { bottom: -50, top: 20, step: 10 }],
    ["deficit to −9%", -9, 0, 0, { bottom: -10, top: 0, step: 2 }],
    ["unemployed ~3,150", 0, 3150, 0, { bottom: 0, top: 3500, step: 500 }],
  ])("fits %s just past the data", (_, min, max, quantum, expected) => {
    expect(niceScale(min, max, quantum)).toEqual(expected);
  });

  it("keeps zero on a gridline with one shared step", () => {
    for (const [min, max] of [[-45, 12], [-0.3, 1.7], [-1234, 98765], [-3, 3]]) {
      const { top, bottom, step } = niceScale(min!, max!);
      expect(top).toBeGreaterThan(max!);
      expect(bottom).toBeLessThanOrEqual(min!);
      expect(Math.abs(top / step - Math.round(top / step))).toBeLessThan(1e-9);
      expect(Math.abs(bottom / step - Math.round(bottom / step))).toBeLessThan(1e-9);
    }
  });

  it("steps in whole multiples of an amount unit's quantum (debt: no 0/13/26/39/52)", () => {
    const quantum = 1_000_000_000;
    const { step, top } = niceScale(0, 46_500_000_000, quantum);
    expect(step % quantum).toBe(0);
    expect([10, 20, 25].map((n) => n * quantum)).toContain(step);
    expect(top).toBe(50 * quantum);
  });

  it("falls back to the finest printable step when the quantum allows no four intervals", () => {
    expect(niceScale(0, 900_000, 1_000_000)).toEqual({ bottom: 0, top: 1_000_000, step: 1_000_000 });
  });

  it("uses the fewest decimals that print the gridline step exactly", () => {
    expect(decimalsFor(2, 2)).toBe(0);
    expect(decimalsFor(0.5, 2)).toBe(1);
    expect(decimalsFor(0.25, 2)).toBe(2);
    expect(decimalsFor(0.125, 2)).toBe(2);
  });

  // Browser-measured getComputedTextLength at 11px (Geist Mono + Noto Sans
  // Georgian). The estimate may run wide, never narrow: narrow clips a digit.
  it.each([
    ["50.0 მლრდ", 70.14],
    ["0.0 მლრდ", 63.55],
    ["2004", 26.41],
  ])("estimates %s at no less than its measured width", (label, measured) => {
    expect(axisLabelWidth(label)).toBeGreaterThanOrEqual(measured - 0.05);
    expect(axisLabelWidth(label)).toBeLessThan(measured + 4);
  });

  it("widens the left padding past the house minimum only for wide labels", () => {
    expect(axisLeftPaddingFor(["0%", "25%"], 74)).toBe(74);
    const padding = axisLeftPaddingFor(["0.0 მლრდ", "50.0 მლრდ"], 74);
    expect(padding).toBeGreaterThan(74);
    expect(padding - 10 - axisLabelWidth("50.0 მლრდ")).toBeGreaterThanOrEqual(0);
  });
});

describe("fitted phone axis labels", () => {
  // A 300-unit plot from x=40, labels 26 units wide: first anchored start,
  // last anchored end, the rest centred (the line chart's anchoring).
  const axis = (count: number, plot = 300, labelWidth = 26) => {
    const x = (index: number) => 40 + (count <= 1 ? plot / 2 : (index * plot) / (count - 1));
    return (index: number): [number, number] =>
      index === 0
        ? [x(index) - 4, x(index) - 4 + labelWidth]
        : index === count - 1
          ? [x(index) + 4 - labelWidth, x(index) + 4]
          : [x(index) - labelWidth / 2, x(index) + labelWidth / 2];
  };
  const collisionFree = (indices: number[], extent: (index: number) => [number, number], gap = 8) =>
    indices.every((index, position) => position === 0 || extent(indices[position - 1]!)[1] + gap <= extent(index)[0]);

  it("always labels the first and the latest period without collisions", () => {
    for (const count of [2, 5, 12, 22, 45, 66]) {
      const extent = axis(count);
      const indices = fitAxisLabels(count, periodAnchors(Array.from({ length: count }, (_, index) => 2000 + index)), extent);
      expect(indices[0]).toBe(0);
      expect(indices.at(-1)).toBe(count - 1);
      expect(collisionFree(indices, extent)).toBe(true);
    }
  });

  it("thins 2004–2025 to an even stride on a phone", () => {
    const indices = fitAxisLabels(22, periodAnchors(Array.from({ length: 22 }, (_, index) => 2004 + index)), axis(22));
    const regular = indices.slice(0, -1);
    const strides = new Set(regular.slice(1).map((index, position) => index - regular[position]!));
    expect(strides.size).toBe(1);
    expect(indices.length).toBeLessThanOrEqual(8);
  });

  it("labels Januaries on a monthly axis, plus the first and the latest month", () => {
    // Mar 2021 … Aug 2026: the first and last periods are not Januaries.
    const months = Array.from({ length: 66 }, (_, index) => 2021 * 12 + 2 + index);
    const indices = fitAxisLabels(66, periodAnchors(months, 12), axis(66, 300, 30));
    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBe(65);
    for (const index of indices.slice(1, -1)) expect(months[index]! % 12).toBe(0);
    expect(collisionFree(indices, axis(66, 300, 30))).toBe(true);
  });

  it("keeps only the latest label when the first and the latest cannot both fit", () => {
    expect(fitAxisLabels(2, [0, 1], axis(2, 30))).toEqual([1]);
    expect(fitAxisLabels(1, [0], axis(1))).toEqual([0]);
    expect(fitAxisLabels(0, [], axis(0))).toEqual([]);
  });
});
