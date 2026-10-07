import { createElement } from "react";
import { renderGeorgianMarkup } from "../helpers/render-localized";
import { describe, expect, it } from "vitest";
import { RangeStrip, nearestPeriod, rangeChips, stepRangeHandle } from "../../components/main-explorer/range-strip";

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

describe("range strip monthly periods", () => {
  const months = Array.from({ length: 272 }, (_, index) => 2004 * 12 + index);
  const label = (period: number) => `${Math.floor(period / 12)}-${String((period % 12) + 1).padStart(2, "0")}`;

  it("keeps the year chips exactly as before", () => {
    const years = Array.from({ length: 22 }, (_, index) => 2004 + index);
    expect(rangeChips(years, 2004)).toEqual([
      { key: "fiveYears", start: 2021 },
      { key: "tenYears", start: 2016 },
      { key: "allYears", start: 2004 },
    ]);
  });

  it("counts the monthly chips in months, with no one-year chip", () => {
    expect(rangeChips(months, months[0]!, 12).map((chip) => [chip.key, label(chip.start)])).toEqual([
      ["fiveYears", "2021-09"],
      ["tenYears", "2016-09"],
      ["allYears", "2004-01"],
    ]);
  });

  it("steps a month with arrows and a year with Page keys, monthly only", () => {
    const range = { start: months[100]!, end: months[200]!, min: months[0]!, max: months.at(-1)! };
    expect(stepRangeHandle("ArrowLeft", "start", range, 12)).toBe(months[99]);
    expect(stepRangeHandle("ArrowUp", "end", range, 12)).toBe(months[201]);
    expect(stepRangeHandle("PageUp", "end", range, 12)).toBe(months[212]);
    expect(stepRangeHandle("PageDown", "start", range, 12)).toBe(months[88]);
    expect(stepRangeHandle("Home", "end", range, 12)).toBe(range.start);
    expect(stepRangeHandle("PageUp", "start", { start: 2010, end: 2020, min: 2004, max: 2025 })).toBeNull();
    expect(stepRangeHandle("ArrowRight", "start", { start: 2010, end: 2010, min: 2004, max: 2025 })).toBe(2010);
  });

  it("prints formatted periods in the readout, the ends and the slider values", () => {
    const markup = renderGeorgianMarkup(
      createElement(RangeStrip, {
        years: months,
        range: { start: months[0]!, end: months.at(-1)!, min: months[0]!, max: months.at(-1)! },
        onChange: () => {},
        periodsPerYear: 12,
        formatPeriod: label,
      }),
      { "controls.startMonth": "საწყისი თვე", "controls.endMonth": "საბოლოო თვე", "controls.monthRange": "თვეების დიაპაზონი" },
    );
    expect(markup).toContain("2004-01–2026-08");
    expect(markup).toContain('aria-valuetext="2026-08"');
    expect(markup).toContain('aria-label="საწყისი თვე"');
    expect(markup).not.toContain(">1წ<");
  });
});

describe("range strip month/year pickers", () => {
  const months = Array.from({ length: 272 }, (_, index) => 2004 * 12 + index);
  const range = { start: months[0]!, end: months.at(-1)!, min: months[0]!, max: months.at(-1)! };
  const monthShort = (month: number) => ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"][month - 1]!;

  it("snaps a picked month into the other handle's bound", () => {
    // End handle: August 2026 is the last month; picking December 2026 lands on August.
    expect(nearestPeriod(months, 2026, 11, 12, range.start, range.end)).toBe(2026 * 12 + 7);
    // Start handle bounded by an end of March 2010: picking 2015 caps at the end.
    expect(nearestPeriod(months, 2015, 5, 12, range.min, 2010 * 12 + 2)).toBe(2010 * 12 + 2);
    expect(nearestPeriod(months, 2012, 4, 12, range.min, range.end)).toBe(2012 * 12 + 4);
    // A gap in the available months resolves to the nearest available one.
    expect(nearestPeriod([2004 * 12, 2004 * 12 + 2], 2004, 1, 12, 2004 * 12, 2004 * 12 + 2)).toBe(2004 * 12);
  });

  it("covers the readout's months and years with native selects only when month labels are given", () => {
    const render = (formatMonth?: (month: number) => string) =>
      renderGeorgianMarkup(
        createElement(RangeStrip, {
          years: months,
          range,
          onChange: () => {},
          periodsPerYear: 12,
          formatPeriod: (period: number) => `${monthShort((period % 12) + 1)} ${Math.floor(period / 12)}`,
          formatMonth,
        }),
        { "controls.startMonth": "საწყისი თვე", "controls.endMonth": "საბოლოო თვე", "controls.monthRange": "თვეების დიაპაზონი" },
      );
    const markup = render(monthShort);
    expect(markup.match(/<select/g)).toHaveLength(4);
    expect(markup).toContain('aria-label="საწყისი თვე"');
    expect(markup).toContain('aria-label="საბოლოო წელი"');
    expect(markup).toContain('data-testid="range-start-picker"');
    expect(render(undefined)).not.toContain("<select");
  });
});
