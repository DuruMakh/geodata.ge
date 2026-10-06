import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { RangeStrip, type RangeMarker } from "../../components/main-explorer/range-strip";
import { renderGeorgianMarkup } from "../helpers/render-localized";

// A marker's label is centred on the marker, so a marker near an end of the rail pushes half its label past the
// page edge (the Population page's 1 January 2025 census re-base sits 95.5% along a 2004–2026 strip). With
// `labelSide: "auto"` the label takes the side with room, the way the line chart places its break label
// (editorial-line-chart.tsx: `toTheLeft = bx > W / 2`, so exactly the middle goes to the right of the marker).
// Without it the label stays centred, which is what Debt and Deficit draw for their forecast boundary.

// The marker as it was drawn before `labelSide` existed, copied from the rendered markup.
const MARKER_CLASS = "pointer-events-none absolute top-0 bottom-0 z-[1] w-px bg-[var(--accent)]";
const CENTRED_LABEL_CLASS = "absolute -top-4 -translate-x-1/2 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[9px] font-medium text-[var(--accent)]";
const labelClassAt = (side: "right-0" | "left-0") => CENTRED_LABEL_CLASS.replace("-translate-x-1/2", side);

// 2000–2020: every year is 5% of the rail, so each position below is exact.
const YEARS = Array.from({ length: 21 }, (_, index) => 2000 + index);
const LABEL = "პროგნოზი";

function renderMarker(marker: RangeMarker, years = YEARS) {
  const markup = renderGeorgianMarkup(
    createElement(RangeStrip, {
      years,
      range: { start: years[0]!, end: years.at(-1)!, min: years[0]!, max: years.at(-1)! },
      onChange: () => {},
      marker,
    }),
  );
  const block = /<div[^>]*data-testid="range-marker"[\s\S]*?<\/span><\/div>/.exec(markup)?.[0] ?? "";
  return {
    block,
    left: /style="left:([\d.]+%)"/.exec(block)?.[1],
    markerClass: /<div[^>]*class="([^"]*)"/.exec(block)?.[1],
    labelClass: /<span class="([^"]*)"/.exec(block)?.[1] ?? "",
  };
}

// Class order carries no meaning; the set of classes does.
const classSet = (value: string) => [...new Set(value.split(/\s+/))].sort();

describe("range strip marker label, default", () => {
  it.each([
    [2019, "95.00%"],
    [2004, "20.00%"],
    [2010, "50.00%"],
  ])("keeps the centred label at %i (%s along the rail) when labelSide is omitted", (year, left) => {
    expect(renderMarker({ year, label: LABEL }).block).toBe(
      `<div data-testid="range-marker" class="${MARKER_CLASS}" style="left:${left}"><span class="${CENTRED_LABEL_CLASS}">${LABEL}</span></div>`,
    );
  });
});

describe('range strip marker label, labelSide "auto"', () => {
  it("end-anchors the label of a marker 95% along the rail, so it extends to the left and stays inside the page", () => {
    const { left, labelClass } = renderMarker({ year: 2019, label: LABEL, labelSide: "auto" });
    expect(left).toBe("95.00%");
    expect(classSet(labelClass)).toEqual(classSet(labelClassAt("right-0")));
  });

  it("start-anchors the label of a marker 20% along the rail, so it extends to the right", () => {
    const { left, labelClass } = renderMarker({ year: 2004, label: LABEL, labelSide: "auto" });
    expect(left).toBe("20.00%");
    expect(classSet(labelClass)).toEqual(classSet(labelClassAt("left-0")));
  });

  it("start-anchors exactly at the middle, as the chart does (its test is bx > W / 2, so the middle is not to the left)", () => {
    const { left, labelClass } = renderMarker({ year: 2010, label: LABEL, labelSide: "auto" });
    expect(left).toBe("50.00%");
    expect(classSet(labelClass)).toEqual(classSet(labelClassAt("left-0")));
  });

  it.each([
    [2009, "45.00%", "left-0"],
    [2011, "55.00%", "right-0"],
    [2000, "0.00%", "left-0"],
    [2020, "100.00%", "right-0"],
  ] as const)("anchors the marker at %i (%s along the rail) with %s", (year, left, side) => {
    const result = renderMarker({ year, label: LABEL, labelSide: "auto" });
    expect(result.left).toBe(left);
    expect(classSet(result.labelClass)).toEqual(classSet(labelClassAt(side)));
  });

  it("end-anchors the Population page's 2025 marker on its 2004–2026 strip", () => {
    const years = Array.from({ length: 23 }, (_, index) => 2004 + index);
    const { left, labelClass } = renderMarker({ year: 2025, label: "Census re-base", labelSide: "auto" }, years);
    expect(left).toBe("95.45%");
    expect(classSet(labelClass)).toEqual(classSet(labelClassAt("right-0")));
  });

  it.each([2019, 2004, 2010])("moves only the label: the marker line at %i stays where it was", (year) => {
    const centred = renderMarker({ year, label: LABEL });
    const anchored = renderMarker({ year, label: LABEL, labelSide: "auto" });
    expect(anchored.left).toBe(centred.left);
    expect(anchored.markerClass).toBe(centred.markerClass);
    expect(anchored.block).toContain(`>${LABEL}</span>`);
  });
});
