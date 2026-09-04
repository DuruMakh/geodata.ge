import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildTooltipRows,
  EditorialLineChart,
  TOOLTIP_ROW_CAP,
  type ChartSeries,
} from "../../components/main-explorer/editorial-line-chart";
import { UNIT_BN, UNIT_MLN, type ValueUnit } from "../../lib/explorer/format";

function axisLabels(unit: ValueUnit, values: number[]): string[] {
  const series: ChartSeries[] = [
    {
      id: "series",
      label: "სერია",
      color: "#B3402A",
      vals: values,
      planned: values.map(() => false),
    },
  ];
  const markup = renderToStaticMarkup(
    createElement(EditorialLineChart, {
      years: values.map((_, index) => 2024 + index),
      series,
      share: false,
      unit,
      shareLabel: "% წილი",
    }),
  );

  return [...markup.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)]
    .map((match) => match[1])
    .filter((label) => label.endsWith(unit.label));
}

describe("EditorialLineChart amount axes", () => {
  it("uses distinct whole-million labels for small municipal series", () => {
    expect(axisLabels(UNIT_MLN, [100_000, 900_000])).toEqual(["0 მლნ", "1 მლნ", "2 მლნ"]);
  });

  it("uses distinct one-decimal-billion labels across a mixed-sign domain", () => {
    expect(axisLabels(UNIT_BN, [-150_000_000, 450_000_000])).toEqual([
      "−0.3 მლრდ",
      "0.0 მლრდ",
      "0.3 მლრდ",
      "0.6 მლრდ",
      "0.9 მლრდ",
      "1.2 მლრდ",
    ]);
  });
});

describe("EditorialLineChart forecast paths", () => {
  it("keeps actual values solid and continues from their final point with a dashed forecast", () => {
    const markup = renderToStaticMarkup(
      createElement(EditorialLineChart, {
        years: [2023, 2024, 2025, 2026, 2027],
        series: [
          {
            id: "debt-service",
            label: "ვალის გადახდა",
            color: "#1F6E56",
            vals: [30, 35, 40, 38, 34],
            planned: [false, false, false, false, false],
            forecastFromYear: 2026,
          },
        ],
        share: false,
        unit: UNIT_MLN,
        shareLabel: "% წილი",
      }),
    );

    const actualPath = markup.match(/data-testid="chart-series-debt-service-actual" d="([^"]+)"/)?.[1];
    const forecastPath = markup.match(/data-testid="chart-series-debt-service-forecast" d="([^"]+)"/)?.[1];

    expect(actualPath).toContain("L482.0");
    expect(actualPath).not.toContain("L686.0");
    expect(forecastPath).toContain("M482.0");
    expect(forecastPath).toContain("L686.0");
    expect(markup).toContain('stroke-dasharray="6 5"');
  });

  it("does not bridge a missing value across a forecast boundary", () => {
    const markup = renderToStaticMarkup(
      createElement(EditorialLineChart, {
        years: [2024, 2025, 2026, 2027],
        series: [
          {
            id: "debt-service",
            label: "ვალის გადახდა",
            color: "#1F6E56",
            vals: [30, null, 38, 34],
            planned: [false, false, false, false],
            forecastFromYear: 2026,
          },
        ],
        share: false,
        unit: UNIT_MLN,
        shareLabel: "% წილი",
      }),
    );

    const forecastPath = markup.match(/data-testid="chart-series-debt-service-forecast" d="([^"]+)"/)?.[1];

    expect(forecastPath).toContain("M618.0");
    expect(forecastPath).not.toContain("M74.0");
    expect(markup).not.toContain('data-testid="chart-series-debt-service-actual"');
  });
});

// The hover readout renders one row per selected series with no cap, and
// ყველას მონიშვნა is a first-class control: on ministries that measured 1327px
// of tooltip against a 334px chart, 24 of its rows reading "—", with ~993px of
// it unreachable inside the chart's own overflow-x frame.
function line(id: string, vals: (number | null)[]): ChartSeries {
  return { id, label: id, color: "#B3402A", vals, planned: vals.map(() => false) };
}

describe("chart tooltip rows", () => {
  it("drops series with no value at the hovered year", () => {
    const { rows } = buildTooltipRows([line("a", [1, null]), line("b", [2, 5])], 1);

    expect(rows.map((row) => row.id)).toEqual(["b"]);
  });

  it("orders the biggest value first", () => {
    const { rows } = buildTooltipRows([line("small", [1]), line("big", [9]), line("mid", [4])], 0);

    expect(rows.map((row) => row.id)).toEqual(["big", "mid", "small"]);
  });

  it("caps the rows and reports how many it withheld", () => {
    const many = Array.from({ length: 63 }, (_, index) => line(`s${index}`, [index]));
    const { rows, hidden } = buildTooltipRows(many, 0);

    expect(rows).toHaveLength(TOOLTIP_ROW_CAP);
    expect(hidden).toBe(63 - TOOLTIP_ROW_CAP);
  });

  it("withholds nothing when every series fits", () => {
    const { rows, hidden } = buildTooltipRows([line("a", [3]), line("b", [1])], 0);

    expect(rows).toHaveLength(2);
    expect(hidden).toBe(0);
  });

  it("counts only the series that have a value toward the cap", () => {
    const absent = Array.from({ length: 40 }, (_, index) => line(`gap${index}`, [null]));
    const present = Array.from({ length: 3 }, (_, index) => line(`has${index}`, [index + 1]));
    const { rows, hidden } = buildTooltipRows([...absent, ...present], 0);

    expect(rows).toHaveLength(3);
    expect(hidden).toBe(0);
  });
});
