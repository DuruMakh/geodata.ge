import { afterEach, describe, expect, it, vi } from "vitest";
import { anchoredRect, bindChartPointer, blockLabelTier, blockTone, fitText, gridFor, lerpRect, mixHex, niceTicks, OFF_SQUARE, sparkPoints, squarify, stackLabels } from "../../../components/landing/chapters/canvas";

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

  it("stays within a given height instead of the target", () => {
    for (const [width, height] of [[892, 500], [335, 280], [1000, 520]]) {
      const grid = gridFor(width, 10460, height);
      expect(grid.rows * grid.cell).toBeLessThanOrEqual(height);
      expect(grid.rows * grid.cell).toBeGreaterThan(height * 0.95);
      expect(grid.cols * grid.rows).toBeGreaterThanOrEqual(10460);
    }
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

describe("anchoredRect", () => {
  it("the largest value fills the whole area, anchored bottom-left", () => {
    expect(anchoredRect(30, 30, 600, 400)).toEqual([0, 0, 600, 400]);
  });

  it("scales both sides by sqrt(value / max), so the area is proportional to the value", () => {
    const [x, y, w, h] = anchoredRect(7.5, 30, 600, 400);
    expect(x).toBe(0);
    expect(w).toBeCloseTo(300, 9);
    expect(h).toBeCloseTo(200, 9);
    expect(y).toBeCloseTo(200, 9); // bottom edge stays on the chart floor
    expect((w * h) / (600 * 400)).toBeCloseTo(7.5 / 30, 9);
  });

  it("has no area for a zero value or a missing maximum", () => {
    expect(anchoredRect(0, 30, 600, 400)).toEqual([0, 400, 0, 0]);
    expect(anchoredRect(5, 0, 600, 400)).toEqual([0, 400, 0, 0]);
  });
});

describe("blockLabelTier", () => {
  it("picks what fits in a block", () => {
    expect(blockLabelTier(200, 120)).toBe("nameAmountShare");
    expect(blockLabelTier(82, 64)).toBe("nameAmountShare");
    expect(blockLabelTier(82, 63.9)).toBe("nameAmount");
    expect(blockLabelTier(82, 46)).toBe("nameAmount");
    expect(blockLabelTier(81.9, 46)).toBe("share");
    expect(blockLabelTier(82, 45.9)).toBe("share");
    expect(blockLabelTier(44, 24)).toBe("share");
    expect(blockLabelTier(43.9, 24)).toBe("none");
    expect(blockLabelTier(44, 23.9)).toBe("none");
    expect(blockLabelTier(0, 0)).toBe("none");
  });
});

describe("blockTone", () => {
  it("runs from the dark end to the light end of the ramp by rank", () => {
    expect(blockTone(0, 13)).toBe(mixHex("#26211b", "#d6cab5", 0));
    expect(blockTone(11, 13)).toBe(mixHex("#26211b", "#d6cab5", 1));
  });

  it("gets lighter with every rank", () => {
    const lum = (s: string) => s.match(/\d+/g)!.map(Number).reduce((a, b) => a + b, 0);
    const tones = Array.from({ length: 13 }, (_, i) => lum(blockTone(i, 13)));
    for (let i = 1; i < tones.length; i++) expect(tones[i]).toBeGreaterThan(tones[i - 1]);
  });

  it("does not divide by zero for tiny lists", () => {
    for (const n of [0, 1, 2, 3]) expect(blockTone(0, n)).toMatch(/^rgb\(/);
  });
});

describe("lerpRect", () => {
  it("interpolates every side", () => {
    expect(lerpRect([0, 0, 10, 10], [10, 20, 30, 50], 0.5)).toEqual([5, 10, 20, 30]);
    expect(lerpRect([1, 2, 3, 4], [9, 9, 9, 9], 0)).toEqual([1, 2, 3, 4]);
    expect(lerpRect([1, 2, 3, 4], [9, 9, 9, 9], 1)).toEqual([9, 9, 9, 9]);
  });
});

describe("sparkPoints", () => {
  it("maps the smallest value to the bottom and the largest to the top, evenly across the width", () => {
    const pts = sparkPoints([10, 20, 40], 1000, 6, 40);
    expect(pts.map(([x]) => x)).toEqual([0, 500, 1000]);
    expect(pts[0][1]).toBe(40);
    expect(pts[2][1]).toBe(6);
    expect(pts[1][1]).toBeCloseTo(40 - (10 / 30) * 34, 9);
  });

  it("draws a flat line mid-way for a constant or single-value series", () => {
    expect(sparkPoints([5, 5, 5], 100, 0, 40).map(([, y]) => y)).toEqual([20, 20, 20]);
    expect(sparkPoints([5], 100, 0, 40)).toEqual([[0, 20]]);
    expect(sparkPoints([], 100, 0, 40)).toEqual([]);
  });
});

describe("bindChartPointer", () => {
  type Handler = (event?: unknown) => void;
  const target = () => {
    const map: Record<string, Handler[]> = {};
    return {
      map,
      addEventListener: (type: string, fn: Handler) => void (map[type] ??= []).push(fn),
      removeEventListener: (type: string, fn: Handler) => void (map[type] = (map[type] ?? []).filter((f) => f !== fn)),
      fire: (type: string, event?: unknown) => (map[type] ?? []).forEach((fn) => fn(event)),
      count: () => Object.values(map).reduce((n, list) => n + list.length, 0),
    };
  };

  function setup() {
    const doc = target();
    const win = target();
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", win);
    const inside = {};
    const canvas = { ...target(), contains: (node: unknown) => node === inside };
    const calls: string[] = [];
    const unbind = bindChartPointer(canvas as unknown as HTMLElement, (event) => calls.push(`move:${event.pointerType}`), () => calls.push("leave"));
    return { doc, win, canvas, inside, calls, unbind };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a mouse leaving hides the tooltip; a touch tap keeps it through pointerleave", () => {
    const s = setup();
    s.canvas.fire("pointermove", { pointerType: "mouse" });
    s.canvas.fire("pointerleave", { pointerType: "mouse" });
    expect(s.calls).toEqual(["move:mouse", "leave"]);

    s.calls.length = 0;
    s.canvas.fire("pointerdown", { pointerType: "touch", target: s.inside });
    s.doc.fire("pointerdown", { pointerType: "touch", target: s.inside });
    s.canvas.fire("pointerleave", { pointerType: "touch" });
    expect(s.calls).toEqual(["move:touch"]);
  });

  it("hides a tapped tooltip on a press outside the canvas or on scroll, once", () => {
    const s = setup();
    s.canvas.fire("pointerdown", { pointerType: "touch", target: s.inside });
    s.doc.fire("pointerdown", { pointerType: "touch", target: {} });
    s.doc.fire("pointerdown", { pointerType: "touch", target: {} });
    expect(s.calls).toEqual(["move:touch", "leave"]);

    s.calls.length = 0;
    s.canvas.fire("pointerdown", { pointerType: "touch", target: s.inside });
    s.win.fire("scroll");
    s.win.fire("scroll");
    expect(s.calls).toEqual(["move:touch", "leave"]);

    // A mouse user scrolling over the chart is left alone; pointerleave covers the mouse.
    s.calls.length = 0;
    s.canvas.fire("pointerdown", { pointerType: "mouse", target: s.inside });
    s.win.fire("scroll");
    expect(s.calls).toEqual(["move:mouse"]);
  });

  it("removes every listener it added", () => {
    const s = setup();
    expect([s.canvas.count(), s.doc.count(), s.win.count()]).toEqual([3, 1, 1]);
    s.unbind();
    expect([s.canvas.count(), s.doc.count(), s.win.count()]).toEqual([0, 0, 0]);
  });
});
