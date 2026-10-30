import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sparkline } from "../../components/ui/sparkline";
import { annualSeries, buildSparklinePath, sparklinePoint } from "../../lib/explorer/sparkline";

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

  it("draws only the points in [from, to), on the whole series' scale", () => {
    expect(buildSparklinePath([0, 1, 2], 64, 16, 1, 0, 2)).toEqual(["M1.0 15.0 L32.0 8.0"]);
    expect(buildSparklinePath([0, 1, 2], 64, 16, 1, 1)).toEqual(["M32.0 8.0 L63.0 1.0"]);
  });
});

describe("sparklinePoint", () => {
  it("is the point the path draws for that index, and null where the value or the line is missing", () => {
    expect(sparklinePoint([0, 1, 2], 1, 64, 16)).toEqual({ x: "32.0", y: "8.0" });
    expect(sparklinePoint([0, null, 2, 3], 1, 64, 16)).toBeNull();
    expect(sparklinePoint([7], 0, 64, 16)).toBeNull();
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

describe("Sparkline planFrom", () => {
  const render = (props: Partial<Parameters<typeof Sparkline>[0]> = {}) =>
    renderToStaticMarkup(createElement(Sparkline, { values: [0, 1, 2, 4], color: "#000", area: true, endDot: true, dotIndex: 1, ...props }));

  it("draws the line from the last actual point to the plan dashed and without area, whatever point the dot marks", () => {
    const markup = render({ planFrom: 3 });
    expect(markup).toContain('<path data-testid="sparkline-plan" d="M42.3 8.0 L63.0 1.0" fill="none" stroke="#000" stroke-width="1.2" stroke-dasharray="2 1.5"');
    expect(markup).toContain('<path d="M1.0 15.0 L21.7 11.5 L42.3 8.0 L42.3 16 L1.0 16 Z"');
    // The dot stays on the chosen point.
    expect(markup).toContain('d="M21.7 11.5 L21.7 11.5"');
    expect(markup).not.toContain("L63.0 1.0 L63.0 16");
  });

  it("leaves the drawing unchanged without it", () => {
    expect(render()).not.toContain("sparkline-plan");
    expect(render()).toContain("L63.0 1.0 L63.0 16");
  });
});
