import { describe, expect, it } from "vitest";
import { nearestPeriodIndex, stepPeriodIndex } from "../../lib/explorer/chartNavigation";

describe("chart navigation", () => {
  // viewBox 920 wide, 74 left and 30 right padding: a 816-unit plot; 5 periods sit 204 apart.
  it("maps a pointer to the nearest period across the whole plot, with no gaps", () => {
    expect(nearestPeriodIndex(0, 5, 920, 74, 30)).toBe(0);
    expect(nearestPeriodIndex((74 + 101) / 920, 5, 920, 74, 30)).toBe(0);
    expect(nearestPeriodIndex((74 + 103) / 920, 5, 920, 74, 30)).toBe(1);
    expect(nearestPeriodIndex(1, 5, 920, 74, 30)).toBe(4);
    expect(nearestPeriodIndex(0.5, 1, 920, 74, 30)).toBe(0);
  });

  it("steps, jumps and clears the active period by key", () => {
    expect(stepPeriodIndex("ArrowRight", null, 12)).toBe(0);
    expect(stepPeriodIndex("ArrowRight", 11, 12)).toBe(11);
    expect(stepPeriodIndex("ArrowLeft", null, 12)).toBe(11);
    expect(stepPeriodIndex("ArrowLeft", 0, 12)).toBe(0);
    expect(stepPeriodIndex("Home", 5, 12)).toBe(0);
    expect(stepPeriodIndex("End", 5, 12)).toBe(11);
    expect(stepPeriodIndex("Escape", 5, 12)).toBeNull();
    expect(stepPeriodIndex("a", 5, 12)).toBeUndefined();
    expect(stepPeriodIndex("ArrowRight", null, 0)).toBeUndefined();
  });
});
