import { describe, expect, it } from "vitest";
import { squarify } from "../../lib/explorer/treemapLayout";

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

describe("squarify (pinned layout)", () => {
  it("lays the classic example out row by row along the shorter side, in input order", () => {
    // Bruls, Huizing and van Wijk's example: values 6, 6, 4, 3, 2, 2, 1 on a 6 × 4 area.
    const rects = squarify([6, 6, 4, 3, 2, 2, 1], 0, 0, 6, 4);
    const rounded = rects.map((rect) => rect.map((value) => Math.round(value * 1000) / 1000));
    expect(rounded).toEqual([
      [0, 0, 3, 2],
      [0, 2, 3, 2],
      [3, 0, 1.714, 2.333],
      [4.714, 0, 1.286, 2.333],
      [3, 2.333, 1.2, 1.667],
      [4.2, 2.333, 1.2, 1.667],
      [5.4, 2.333, 0.6, 1.667],
    ]);
  });

  it("scales areas by an explicit total, leaving the rest of the area empty", () => {
    const rects = squarify([50, 25], 0, 0, 1000, 430, 100);
    expect(rects[0][2] * rects[0][3] + rects[1][2] * rects[1][3]).toBeCloseTo(0.75 * 1000 * 430, 6);
    expect(squarify([1, 2], 0, 0, 1000, 430, 0)).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });
});
