import { describe, expect, it } from "vitest";
import { fitText, niceTicks, squarify, stackLabels } from "../../../components/landing/chapters/canvas";

describe("squarify", () => {
  it("areas are proportional to values and fill the rectangle (sum of areas = w*h within 1e-6)", () => {
    const values = [40, 25, 15, 10, 6, 4];
    const rects = squarify(values, 10, 20, 300, 180);
    const areas = rects.map(([, , w, h]) => w * h);
    expect(areas.reduce((a, b) => a + b, 0)).toBeCloseTo(300 * 180, 6);
    const total = values.reduce((a, b) => a + b, 0);
    areas.forEach((area, i) => expect(area).toBeCloseTo((values[i] / total) * 300 * 180, 6));
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(y).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(x + w).toBeLessThanOrEqual(310 + 1e-9);
      expect(y + h).toBeLessThanOrEqual(200 + 1e-9);
    }
  });

  it("zero values get zero rectangles", () => {
    const rects = squarify([5, 0, 3, 0], 0, 0, 100, 50);
    expect(rects[1][2] * rects[1][3]).toBe(0);
    expect(rects[3][2] * rects[3][3]).toBe(0);
    expect(rects[0][2] * rects[0][3] + rects[2][2] * rects[2][3]).toBeCloseTo(5000, 6);
  });

  it("returns empty rectangles when there is nothing to lay out", () => {
    expect(squarify([0, 0], 1, 2, 100, 50)).toEqual([
      [1, 2, 0, 0],
      [1, 2, 0, 0],
    ]);
  });
});

describe("niceTicks", () => {
  it("covers the maximum with at most n steps of a round size", () => {
    const { step, top, ticks } = niceTicks(32.4, 7);
    expect(top).toBeGreaterThanOrEqual(32.4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(top);
    expect(ticks.length - 1).toBeLessThanOrEqual(7);
    expect([1, 2, 2.5, 5]).toContain(+(step / Math.pow(10, Math.floor(Math.log10(step)))).toFixed(6));
  });
});

describe("stackLabels", () => {
  it("keeps gap and stays within [lo, hi]", () => {
    const y = stackLabels([200, 195, 190, 40, 10], 14, 12, 220);
    for (let i = 1; i < y.length; i++) expect(y[i - 1] - y[i]).toBeGreaterThanOrEqual(14 - 1e-9);
    for (const v of y) {
      expect(v).toBeGreaterThanOrEqual(12);
      expect(v).toBeLessThanOrEqual(220);
    }
  });

  it("re-stacks upward when a crowded group would fall below lo", () => {
    const y = stackLabels([30, 28, 26, 24], 14, 12, 220);
    expect(y[y.length - 1]).toBe(12);
    for (let i = 1; i < y.length; i++) expect(y[i - 1] - y[i]).toBeGreaterThanOrEqual(14 - 1e-9);
    for (const v of y) {
      expect(v).toBeGreaterThanOrEqual(12);
      expect(v).toBeLessThanOrEqual(220);
    }
  });

  it("returns an empty list for no labels", () => {
    expect(stackLabels([], 14, 0, 100)).toEqual([]);
  });
});

describe("fitText", () => {
  const ctx = { measureText: (s: string) => ({ width: s.length * 10 }) as TextMetrics };

  it("keeps text that fits and shortens text that does not", () => {
    expect(fitText(ctx, "abc", 30)).toBe("abc");
    expect(fitText(ctx, "abcdefgh", 50)).toBe("abcd…");
    expect(fitText(ctx, "abcdefgh", 5)).toBe("");
  });
});
