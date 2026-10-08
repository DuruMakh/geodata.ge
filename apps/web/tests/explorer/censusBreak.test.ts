import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { EditorialLineChart } from "../../components/main-explorer/editorial-line-chart";
import { ExplorerTable } from "../../components/main-explorer/explorer-table";
import { UNIT_PERSONS } from "../../lib/explorer/format";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const COLOR = "#B3402A";
const chart = (years: number[], vals: (number | null)[], breaks?: Array<{ year: number; label: string }>) =>
  renderGeorgianMarkup(createElement(EditorialLineChart, {
    years,
    series: [{ id: "s", label: "S", color: COLOR, vals, planned: vals.map(() => false) }],
    share: false,
    unit: { divisor: 1_000, label: "k", decimals: 0 },
    shareLabel: "%",
    ...(breaks ? { breaks } : {}),
  }));
const pathOf = (html: string) => new RegExp(`<path d="([^"]+)" fill="none" stroke="${COLOR}"`).exec(html)![1]!;
const count = (text: string, token: RegExp) => (text.match(token) ?? []).length;
// Before the browser measures, the markup holds the desktop and the phone drawing (CSS shows one); each must keep the gap.
const drawings = (html: string) => [...html.matchAll(/<svg[^>]*data-geometry="(desktop|mobile)"[^]*?<\/svg>/g)].map((match) => ({ geometry: match[1]!, svg: match[0] }));

describe("EditorialLineChart break", () => {
  const years = [2023, 2024, 2025, 2026];
  const vals = [100, 200, 500, 600];

  it("joins every year when no break is given", () => {
    const html = chart(years, vals);
    expect(count(pathOf(html), /M/g)).toBe(1);
    expect(html).not.toContain('data-testid="chart-break"');
  });

  it("never joins the year before a break to the break year, in the desktop and the phone drawing", () => {
    const html = chart(years, vals, [{ year: 2025, label: "Census re-base" }]);
    expect(drawings(html).map((drawing) => drawing.geometry)).toEqual(["desktop", "mobile"]);
    for (const { geometry, svg } of drawings(html)) {
      expect(count(pathOf(svg), /M/g), geometry).toBe(2);
      expect(count(pathOf(svg), /L/g), geometry).toBe(2);
    }
  });

  it("marks the gap with one labelled dashed rule in each drawing", () => {
    const html = chart(years, vals, [{ year: 2025, label: "Census re-base" }]);
    for (const { geometry, svg } of drawings(html)) {
      expect(count(svg, /data-testid="chart-break"/g), geometry).toBe(1);
      expect(svg, geometry).toContain("Census re-base");
      expect(svg, geometry).toMatch(/data-testid="chart-break"[^]*?stroke-dasharray="4 3"/);
    }
  });

  it("draws nothing for a break the range does not separate", () => {
    for (const range of [[2025, 2026], [2023, 2024]]) {
      const html = chart(range, [1, 2], [{ year: 2025, label: "Census re-base" }]);
      expect(html).not.toContain('data-testid="chart-break"');
      expect(count(pathOf(html), /M/g)).toBe(1);
    }
  });

  it("leaves a series with a gap at the break to the existing gap rule", () => {
    const html = chart(years, [100, 200, null, 600], [{ year: 2025, label: "Census re-base" }]);
    expect(count(pathOf(html), /M/g)).toBe(1);
  });
});

describe("ExplorerTable break", () => {
  const row = { itemId: "country.georgia", kaLabel: "Georgia", color: "#1E1B16", valuesByYear: { 2024: 3_694_608, 2025: 3_930_428 } };
  const table = (extra: { breakYears?: number[]; breakLabel?: string } = {}) =>
    renderGeorgianMarkup(createElement(ExplorerTable, {
      caption: "Population",
      rows: [{ ...row, itemId: "region.adjara", kaLabel: "Adjara", valuesByYear: { 2024: 1_000, 2025: 2_000 } }],
      totalRow: row,
      showTotal: true,
      totalFirst: true,
      years: [2024, 2025],
      firstColumnLabel: "Place",
      unit: UNIT_PERSONS,
      share: false,
      showChangeColumn: false,
      rowLabelsLocalized: true,
      shareValueForYear: () => null,
      ...extra,
    }));

  it("is unchanged when no break year is given", () => {
    expect(table()).not.toContain("border-left");
    expect(table()).toContain("3,694,608");
  });

  it("draws a 2px rule left of the break year on the header and the cells, and labels the header", () => {
    const html = table({ breakYears: [2025], breakLabel: "Census re-base" });
    // The header, the total row and the one body row each carry it once.
    expect(count(html, /border-left:2px solid var\(--ink\)/g)).toBe(3);
    expect(count(html, /Census re-base/g)).toBe(1);
  });

  it("ignores a break year that is the first column", () => {
    expect(table({ breakYears: [2024], breakLabel: "Census re-base" })).not.toContain("border-left");
  });
});
