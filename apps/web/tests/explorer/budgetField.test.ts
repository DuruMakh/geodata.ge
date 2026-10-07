import { createElement } from "react";
import { chartGeometry, renderGeorgianMarkup } from "../helpers/render-localized";
import { describe, expect, it } from "vitest";
import { BudgetField } from "../../components/analysis/budget-field";
import analysis from "../../lib/i18n/messages/ka/analysis.json";
import type { SnapshotItem } from "../../lib/explorer/types";

const items: SnapshotItem[] = [
  {
    itemId: "largest",
    kaLabel: "ყველაზე დიდი",
    enLabel: "Largest",
    color: "#B3402A",
    amountGel: 100,
    shareOfTotal: 0.4,
    previousAmountGel: 71.43,
    changeFromPreviousYear: 0.403,
    amountChangeFromPreviousYear: 28.57,
    basis: "actual",
  },
  {
    itemId: "quarter",
    kaLabel: "მეოთხედი",
    enLabel: "Quarter",
    color: "#3F7D6D",
    amountGel: 25,
    shareOfTotal: 0.25,
    previousAmountGel: 25,
    changeFromPreviousYear: 0,
    amountChangeFromPreviousYear: 0,
    basis: "actual",
  },
  {
    itemId: "smallest",
    kaLabel: "ყველაზე მცირე",
    enLabel: "Smallest",
    color: "#476A9A",
    amountGel: 6.25,
    shareOfTotal: 0.1,
    previousAmountGel: 7.8125,
    changeFromPreviousYear: -0.235,
    amountChangeFromPreviousYear: -1.5625,
    basis: "actual",
  },
];

function renderedChart(chartItems: SnapshotItem[] = items): string {
  return renderGeorgianMarkup(createElement(BudgetField, { items: chartItems }), analysis);
}

function attribute(markup: string, name: string): string {
  const value = markup.match(new RegExp(`${name}="([^"]+)"`))?.[1];
  if (!value) throw new Error(`Missing ${name} in ${markup}`);
  return value;
}

describe("BudgetField", () => {
  it("renders compact solid amount-scaled circles", () => {
    const circles = [...chartGeometry(renderedChart(), "desktop").matchAll(/<circle\b[^>]*>/g)].map((match) => match[0]);

    expect(circles).toHaveLength(3);
    expect(circles.map((circle) => Number(attribute(circle, "r")))).toEqual([22, 14, 10]);
    expect(circles.map((circle) => attribute(circle, "fill"))).toEqual(["#B3402A", "#3F7D6D", "#476A9A"]);
    expect(circles.map((circle) => attribute(circle, "stroke"))).toEqual([
      "var(--paper)",
      "var(--paper)",
      "var(--paper)",
    ]);
    expect(circles.map((circle) => Number(attribute(circle, "stroke-width")))).toEqual([2, 2, 2]);
  });

  it("keeps category names in circle tooltips instead of permanent chart labels", () => {
    const markup = renderedChart();
    const visibleText = [...markup.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].map((match) => match[1]);

    expect(visibleText).not.toContain("ყველაზე დიდი");
    expect(visibleText).not.toContain("მეოთხედი");
    expect(visibleText).not.toContain("ყველაზე მცირე");
    expect(markup).toContain("<title>ყველაზე დიდი ·");
    expect(markup).toContain("<title>მეოთხედი ·");
    expect(markup).toContain("<title>ყველაზე მცირე ·");
  });

  it("renders the Y axis at consistent ten-percentage-point intervals", () => {
    const labels = [...renderedChart().matchAll(/<text x="44"[^>]*>([^<]+)<\/text>/g)].map((match) => match[1]);

    expect(labels).toEqual([
      "−40%",
      "−30%",
      "−20%",
      "−10%",
      "0%",
      "+10%",
      "+20%",
      "+30%",
      "+40%",
      "+50%",
    ]);
  });

  it("keeps extreme historical growth ranges readable", () => {
    const extremeItems: SnapshotItem[] = [
      { ...items[0], amountGel: 35_850_390, changeFromPreviousYear: 35.5 },
      { ...items[1], amountGel: 982_329, changeFromPreviousYear: 0 },
    ];
    const labels = [...renderedChart(extremeItems).matchAll(/<text x="44"[^>]*>([^<]+)<\/text>/g)].map(
      (match) => match[1],
    );

    expect(labels).toEqual(["0%", "+1000%", "+2000%", "+3000%", "+4000%"]);
  });

  // D1: phones draw the field at the frame's width, every circle inside it.
  it("draws a phone geometry with every circle inside the drawing", () => {
    const phone = chartGeometry(renderedChart(), "mobile");
    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(phone)!;
    expect(Number(viewBox[1])).toBe(340);
    const circles = [...phone.matchAll(/<circle\b[^>]*>/g)].map((match) => ({
      cx: Number(attribute(match[0], "cx")),
      cy: Number(attribute(match[0], "cy")),
      r: Number(attribute(match[0], "r")),
    }));
    expect(circles).toHaveLength(3);
    for (const circle of circles) {
      expect(circle.cx - circle.r).toBeGreaterThanOrEqual(0);
      expect(circle.cx + circle.r).toBeLessThanOrEqual(Number(viewBox[1]));
      expect(circle.cy - circle.r).toBeGreaterThanOrEqual(0);
      expect(circle.cy + circle.r).toBeLessThanOrEqual(Number(viewBox[2]));
    }
  });
});
