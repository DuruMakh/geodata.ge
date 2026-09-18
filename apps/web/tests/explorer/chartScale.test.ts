import { describe, expect, it } from "vitest";
import { decimalsFor, niceMax } from "../../lib/explorer/chartScale";

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
});
