import { describe, expect, it } from "vitest";
import { fitText, gridFor, mixHex, niceTicks, OFF_SQUARE, squarify, stackLabels } from "../../../components/landing/chapters/canvas";

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

describe("gridFor", () => {
  const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  it("keeps rows in 16-220 and the height within 1.04 x the target, or falls back to 40 rows, for widths 280-1440", () => {
    for (let width = 280; width <= 1440; width += 20) {
      const grid = gridFor(width, 10460);
      const target = clampTo(Math.round(width * 0.56), 280, 520);
      if (grid.rows === 40) {
        expect(grid.cols).toBe(Math.ceil(10460 / 40));
      } else {
        expect(grid.rows).toBeGreaterThanOrEqual(16);
        expect(grid.rows).toBeLessThanOrEqual(220);
        expect(grid.rows * grid.cell).toBeLessThanOrEqual(target * 1.04 + 1e-6);
      }
      expect(grid.cols * grid.rows).toBeGreaterThanOrEqual(10460);
      expect(grid.cell).toBeCloseTo(width / grid.cols, 9);
      expect(grid.height).toBe(Math.round(grid.rows * grid.cell));
    }
  });

  it("picks the tallest grid that fits and thins the gap on small cells", () => {
    const wide = gridFor(1000, 10460);
    expect(wide.rows * wide.cell).toBeGreaterThan(520 * 0.9);
    expect(wide.gap).toBe(1.5);
    expect(gridFor(280, 10460).gap).toBe(1);
  });

  it("uses the 40-row fallback when no row count fits", () => {
    const grid = gridFor(300, 5);
    expect(grid.rows).toBe(40);
    expect(grid.cols).toBe(1);
  });
});

describe("mixHex", () => {
  it("interpolates between two hex colours", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("rgb(0,0,0)");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("rgb(255,255,255)");
    expect(mixHex("#000000", "#c8640a", 0.5)).toBe("rgb(100,50,5)");
  });

  it("exports the off-square colour", () => {
    expect(OFF_SQUARE).toBe("#e2d7c4");
  });
});
