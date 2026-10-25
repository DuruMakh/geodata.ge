import { describe, expect, it } from "vitest";
import { annualSeries, buildSparklinePath } from "../../lib/explorer/sparkline";

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

describe("annualSeries", () => {
  it("spans the first to the last year, a year without a value a gap rather than a join", () => {
    expect(annualSeries([{ year: 2020, value: 1 }, { year: 2023, value: 4 }, { year: 2021, value: null }])).toEqual([1, null, null, 4]);
  });

  it("spans the years it is given, beyond the points' own", () => {
    expect(annualSeries([{ year: 2021, value: 2 }], 2019, 2022)).toEqual([null, null, 2, null]);
  });
});
