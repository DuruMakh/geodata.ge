import { createElement } from "react";
import { chartGeometry, renderGeorgianMarkup } from "../helpers/render-localized";
import { describe, expect, it } from "vitest";
import {
  buildTooltipRows,
  EditorialLineChart,
  TOOLTIP_ROW_CAP,
  type ChartSeries,
} from "../../components/main-explorer/editorial-line-chart";
import { UNIT_BN, UNIT_MLN, type ValueUnit } from "../../lib/explorer/format";
import { axisLabelWidth } from "../../lib/explorer/chartScale";

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
  const markup = renderGeorgianMarkup(
    createElement(EditorialLineChart, {
      years: values.map((_, index) => 2024 + index),
      series,
      share: false,
      unit,
      shareLabel: "% წილი",
    }),
  );

  return [...chartGeometry(markup, "desktop").matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)]
    .map((match) => match[1])
    .filter((label) => label.endsWith(unit.label));
}

describe("EditorialLineChart amount axes", () => {
  it("uses distinct whole-million labels for small municipal series", () => {
    // The top is the first whole-million gridline past the data, not a snapped 2.
    expect(axisLabels(UNIT_MLN, [100_000, 900_000])).toEqual(["0 მლნ", "1 მლნ"]);
  });

  it("uses distinct one-decimal-billion labels across a mixed-sign domain", () => {
    expect(axisLabels(UNIT_BN, [-150_000_000, 450_000_000])).toEqual([
      "−0.2 მლრდ",
      "−0.1 მლრდ",
      "0.0 მლრდ",
      "0.1 მლრდ",
      "0.2 მლრდ",
      "0.3 მლრდ",
      "0.4 მლრდ",
      "0.5 მლრდ",
    ]);
  });
});

describe("EditorialLineChart y labels", () => {
  // Right-aligned labels at a fixed 74-unit padding put the "5" of "50.0 მლრდ"
  // left of the viewBox, where the svg clips it: the axis read 0.0 … 0.0 მლრდ.
  it.each([
    ["billions", UNIT_BN, [27_700_000_000, 31_000_000_000]],
    ["millions", UNIT_MLN, [9_000_000_000, 9_400_000_000]],
  ] as const)("never start left of the viewBox for %s", (_, unit, values) => {
    const markup = renderGeorgianMarkup(
      createElement(EditorialLineChart, {
        years: values.map((__, index) => 2024 + index),
        series: [{ id: "s", label: "s", color: "#B3402A", vals: [...values], planned: values.map(() => false) }],
        share: false,
        unit,
        shareLabel: "% წილი",
      }),
    );
    const labels = [...markup.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="end"[^>]*>([^<]+)<\/text>/g)];
    expect(labels.length).toBeGreaterThan(2);
    for (const [, x, label] of labels) {
      expect(Number(x) - axisLabelWidth(label!)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("EditorialLineChart forecast paths", () => {
  it("keeps actual values solid and continues from their final point with a dashed forecast", () => {
    const markup = renderGeorgianMarkup(
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
    const markup = renderGeorgianMarkup(
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

describe("EditorialLineChart monthly periods", () => {
  const months = Array.from({ length: 272 }, (_, index) => 2004 * 12 + index);
  const series: ChartSeries[] = [
    { id: "cpi", label: "CPI", color: "#1E1B16", vals: months.map((_, index) => (index % 24) - 3), planned: months.map(() => false) },
    { id: "target", label: "Target", color: "#B3402A", vals: months.map(() => 3), planned: months.map(() => false), dashed: true },
  ];
  const markup = renderGeorgianMarkup(
    createElement(EditorialLineChart, {
      years: months,
      series,
      share: true,
      unit: UNIT_BN,
      shareLabel: "%",
      periodsPerYear: 12,
      formatPeriod: (period: number, kind: "axis" | "tooltip") => (kind === "axis" ? String(Math.floor(period / 12)) : `m${period}`),
    }),
  );

  it("prints formatted calendar-year labels", () => {
    const labels = [...chartGeometry(markup, "desktop").matchAll(/<text\b[^>]*>(\d{4})<\/text>/g)].map((match) => match[1]);
    expect(labels).toEqual(["2004", "2006", "2008", "2010", "2012", "2014", "2016", "2018", "2020", "2022", "2024", "2026"]);
  });

  it("dashes a reference series and leaves ordinary series solid", () => {
    expect(markup).toMatch(/data-testid="chart-series-target-dashed"[^>]*stroke-dasharray="6 5"/);
    expect(markup).not.toContain("chart-series-cpi-dashed");
  });

  it("spaces lattice columns by half-years", () => {
    const width = Number(/<pattern[^>]*\swidth="([\d.]+)"/.exec(chartGeometry(markup, "desktop"))?.[1]);
    expect(width).toBeCloseTo((816 / 271) * 6, 3);
  });

  it("labels the first and the latest month on a phone, and Januaries between them without collisions", () => {
    const phone = chartGeometry(markup, "mobile");
    const labels = [...phone.matchAll(/<text\b[^>]*>(\d{4})<\/text>/g)].map((match) => match[1]);
    expect(labels[0]).toBe("2004");
    // The latest period (index 271, 2026) closes the axis; the regular labels between are evenly spaced years.
    expect(labels.at(-1)).toBe("2026");
    expect(labels.length).toBeLessThanOrEqual(8);
    const regular = labels.slice(1, -1).map(Number);
    const gaps = new Set(regular.slice(1).map((year, index) => year - regular[index]!));
    expect(gaps.size).toBeLessThanOrEqual(1);
  });
});

// D1 (2026-10-07): phones draw the chart at the frame's width instead of
// scrolling a 920-unit drawing that rendered its 11-unit labels at 8.6px.
describe("EditorialLineChart phone geometry", () => {
  const years = Array.from({ length: 22 }, (_, index) => 2004 + index);
  const markup = renderGeorgianMarkup(
    createElement(EditorialLineChart, {
      years,
      series: [{ id: "total", label: "სულ", color: "#1E1B16", vals: years.map((_, index) => 4e9 + index * 1.2e9), planned: years.map(() => false) }],
      share: false,
      unit: UNIT_BN,
      shareLabel: "% წილი",
    }),
  );

  it("renders both drawings before measuring and lets CSS pick one", () => {
    expect(chartGeometry(markup, "desktop")).toMatch(/class="[^"]*max-\[768px\]:hidden/);
    expect(chartGeometry(markup, "mobile")).toMatch(/class="[^"]*hidden max-\[768px\]:block/);
    expect(chartGeometry(markup, "desktop")).toContain('viewBox="0 0 920 320"');
    expect(chartGeometry(markup, "mobile")).toMatch(/viewBox="0 0 340 \d+"/);
  });

  it("prints the unit once above the axis and plain numbers on the ticks", () => {
    const phone = chartGeometry(markup, "mobile");
    expect(phone).toMatch(/<text data-unit-caption[^>]*>მლრდ<\/text>/);
    const ticks = [...phone.matchAll(/<text[^>]*text-anchor="end"[^>]*>([^<]+)<\/text>/g)].map((match) => match[1]);
    expect(ticks.length).toBeGreaterThan(3);
    for (const tick of ticks) expect(tick).toMatch(/^−?[\d.,]+$/);
  });

  it("thins the years so they fit, keeping the first and the latest", () => {
    const labels = [...chartGeometry(markup, "mobile").matchAll(/<text\b[^>]*>(\d{4})<\/text>/g)].map((match) => match[1]);
    expect(labels[0]).toBe("2004");
    expect(labels.at(-1)).toBe("2025");
    expect(labels.length).toBeLessThanOrEqual(7);
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the desktop drawing's labels untouched", () => {
    const labels = [...chartGeometry(markup, "desktop").matchAll(/<text\b[^>]*>(\d{4})<\/text>/g)].map((match) => match[1]);
    expect(labels).toEqual(["2004", "2006", "2008", "2010", "2012", "2014", "2016", "2018", "2020", "2022", "2025"]);
  });
});
