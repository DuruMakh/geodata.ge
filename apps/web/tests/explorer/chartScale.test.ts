import { describe, expect, it } from "vitest";
import { axisLabelWidth, axisLeftPaddingFor, decimalsFor, niceMax } from "../../lib/explorer/chartScale";

describe("chart scale helpers", () => {
  it("pads the maximum by 12% and snaps it to a 1, 2, 2.5, 5 or 10 multiple", () => {
    expect(niceMax(0.8)).toBe(1);
    expect(niceMax(1.5)).toBe(2);
    expect(niceMax(2.1)).toBe(2.5);
    expect(niceMax(4)).toBe(5);
    expect(niceMax(6)).toBe(10);
    expect(niceMax(800)).toBe(1000);
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
