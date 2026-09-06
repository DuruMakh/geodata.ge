import { createElement } from "react";
import { renderGeorgianMarkup } from "../helpers/render-localized";
import { describe, expect, it } from "vitest";
import { RangeStrip } from "../../components/main-explorer/range-strip";

// "1წ" set start = end = max, a range of one year. Every figure in
// ძირითადი ინდიკატორები is a start-to-end delta, so one click collapsed the whole
// section to 0.0% and named სოციალური დაცვა both the fastest and the slowest
// growing category. The chip is gone; the rail handles still reach that range,
// which is what the Indicators guard is for.
function chipLabels(years: number[]): string[] {
  const markup = renderGeorgianMarkup(
    createElement(RangeStrip, {
      years,
      range: { start: years[0]!, end: years[years.length - 1]!, min: years[0]!, max: years[years.length - 1]! },
      onChange: () => {},
    }),
  );

  return [...markup.matchAll(/<button[^>]*aria-pressed[^>]*>([^<]+)<\/button>/g)].map((match) => match[1]!);
}

describe("range strip quick chips", () => {
  it("offers no one-year chip", () => {
    expect(chipLabels(Array.from({ length: 22 }, (_, index) => 2004 + index))).not.toContain("1წ");
  });

  it("keeps the multi-year chips", () => {
    expect(chipLabels(Array.from({ length: 22 }, (_, index) => 2004 + index))).toEqual(["5წ", "10წ", "ყველა"]);
  });

  it("still offers ყველა on a short scope that cannot show 5წ or 10წ", () => {
    expect(chipLabels([2023, 2024, 2025])).toEqual(["ყველა"]);
  });
});

describe("range strip markers", () => {
  it("renders an optional labelled marker at the supplied year", () => {
    const markup = renderGeorgianMarkup(
      createElement(RangeStrip, {
        years: [2023, 2024, 2025, 2026, 2027],
        range: { start: 2023, end: 2027, min: 2023, max: 2027 },
        onChange: () => {},
        marker: { year: 2026, label: "პროგნოზი" },
      }),
    );

    expect(markup).toContain('data-testid="range-marker"');
    expect(markup).toContain("პროგნოზი");
  });

  it("does not render a marker when none is supplied", () => {
    const markup = renderGeorgianMarkup(
      createElement(RangeStrip, {
        years: [2023, 2024, 2025],
        range: { start: 2023, end: 2025, min: 2023, max: 2025 },
        onChange: () => {},
      }),
    );

    expect(markup).not.toContain('data-testid="range-marker"');
  });
});
