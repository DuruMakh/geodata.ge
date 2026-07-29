import { describe, expect, it } from "vitest";
import { buildSparklinePath } from "../../lib/explorer/sparkline";

describe("buildSparklinePath", () => {
  it("draws a single segment across a complete series", () => {
    const segments = buildSparklinePath([0, 1, 2], 64, 16);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toBe("M1.0 15.0 L32.0 8.0 L63.0 1.0");
  });

  it("centres a flat series instead of pinning it to an edge", () => {
    const segments = buildSparklinePath([5, 5, 5], 64, 16);

    expect(segments).toEqual(["M1.0 8.0 L32.0 8.0 L63.0 8.0"]);
  });

  it("splits on gaps rather than bridging them", () => {
    const segments = buildSparklinePath([1, 2, null, 8, 9], 64, 16);

    expect(segments).toHaveLength(2);
    expect(segments[0].startsWith("M1.0")).toBe(true);
    expect(segments[1].startsWith("M47.5")).toBe(true);
  });

  it("drops runs too short to draw", () => {
    expect(buildSparklinePath([1, null, 3], 64, 16)).toEqual([]);
    expect(buildSparklinePath([null, null], 64, 16)).toEqual([]);
    expect(buildSparklinePath([7], 64, 16)).toEqual([]);
  });

  it("ignores non-finite values", () => {
    expect(buildSparklinePath([1, Number.NaN, 3, 4], 64, 16)).toHaveLength(1);
  });
});
