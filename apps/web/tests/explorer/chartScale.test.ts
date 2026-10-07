import { describe, expect, it } from "vitest";
import { axisLabelWidth, axisLeftPaddingFor, decimalsFor, niceScale } from "../../lib/explorer/chartScale";

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
