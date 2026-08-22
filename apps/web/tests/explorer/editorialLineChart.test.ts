import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialLineChart, type ChartSeries } from "../../components/main-explorer/editorial-line-chart";
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
