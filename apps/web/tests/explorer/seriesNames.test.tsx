import { describe, expect, it, vi } from "vitest";
import { FullRanking } from "../../components/analysis/ranking";
import { ExplorerView } from "../../components/main-explorer/explorer-view";
import type { ExplorerModel } from "../../lib/explorer/explorerData";
import { UNIT_BN } from "../../lib/explorer/format";
import type { ExplorerItem, ExplorerTableRow, SnapshotItem } from "../../lib/explorer/types";
import analysis from "../../lib/i18n/messages/ka/analysis.json";
import format from "../../lib/i18n/messages/ka/format.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";

vi.mock("next/navigation", () => ({ usePathname: () => "/explorer/expenditure", useRouter: () => ({ replace: () => {} }) }));

// Longer than every cut the components used to make (30, 40, 46 and 52 characters, or two words).
const HEALTH = "ჯანმრთელობის, შრომისა და სოციალური დაცვის გრძელი სახელწოდების სამინისტრო";
const ROADS = "ინფრასტრუქტურისა და რეგიონული განვითარების გრძელი სახელწოდების სამინისტრო";
const YEARS = [2020, 2025];

const item = (id: string, kaLabel: string, color: string, level: ExplorerItem["level"], sortOrder: number): ExplorerItem => ({
  id, side: "expenditure", parentItemId: null, level, kaLabel, enLabel: kaLabel, color, sortOrder,
});
const row = (source: ExplorerItem, start: number, end: number): ExplorerTableRow => ({
  itemId: source.id, parentItemId: null, level: source.level, kaLabel: source.kaLabel, enLabel: source.enLabel, color: source.color,
  basisByYear: {}, valuesByYear: { 2020: start, 2025: end }, shareByYear: {}, change: end / start - 1,
});

const total = item("expenditure.total", "მთლიანი ხარჯი", "#1E1B16", "total", 0);
const health = item("spending.health", HEALTH, "#B3402A", "public_field", 1);
const roads = item("spending.roads", ROADS, "#2F5D8A", "public_field", 2);
const healthRow = row(health, 4e9, 6e9);
const roadsRow = row(roads, 3e9, 3.3e9);
const model: ExplorerModel = {
  years: YEARS,
  items: [total, health, roads],
  selectedItems: [health, roads],
  points: [health, roads].flatMap((source, index) => YEARS.map((year) => ({ year, itemId: source.id, value: (index + 3) * 1e9, basis: "actual" as const }))),
  tableRows: [healthRow, roadsRow],
  totalRow: row(total, 10e9, 12e9),
  comparisonRows: [healthRow, roadsRow],
  topGrowth: [healthRow, roadsRow],
  bottomGrowth: [roadsRow, healthRow],
  hasPlannedValues: false,
  gdpByYear: {},
};
const noop = () => {};

const section = (html: string, testId: string) => {
  const start = html.indexOf(`data-testid="${testId}"`);
  expect(start, testId).toBeGreaterThan(-1);
  const tag = html.lastIndexOf("<", start);
  const name = /^<(\w+)/.exec(html.slice(tag))![1]!;
  // The section's own markup, up to the matching close of its tag (no nesting of the same tag here).
  return html.slice(tag, html.indexOf(`</${name}>`, start) + name.length + 3);
};
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, "\n");

describe("series names", () => {
  it("long names reach the DOM in full", () => {
    const html = renderGeorgianMarkup(
      <ExplorerView
        model={model}
        scope="fields"
        unit={UNIT_BN}
        showGrouping={false}
        grouping="fields"
        chartMode="line"
        share={false}
        range={{ start: 2020, end: 2025, min: 2020, max: 2025 }}
        scopeYears={YEARS}
        selectedIds={[health.id, roads.id]}
        expandedMinistries={[]}
        lastUpdatedAt=""
        onGroupingChange={noop}
        onChartModeChange={noop}
        onShareChange={noop}
        onRangeChange={noop}
        onSelectionChange={noop}
        onToggleSeries={noop}
        onToggleExpanded={noop}
        downloadAction={null}
      />,
      { ...main, ...format },
    );

    // Phone legend (and with it the chart tooltip, which reads the same series labels).
    const legend = textOf(section(html, "chart-phone-legend"));
    for (const name of [HEALTH, ROADS]) expect(legend).toContain(`\n${name}\n`);

    // Side KPIs, movers and the period comparison.
    const indicators = textOf(section(html, "period-indicators"));
    expect(indicators).toContain(`\n${HEALTH}\n`); // biggest increase, fastest mover, comparison row
    expect(indicators).toMatch(new RegExp(`\n${HEALTH}\n+, 2025\n`)); // largest share of GDP; its year is its own span
    expect(indicators.match(new RegExp(`\n${ROADS}\n`, "g"))?.length).toBeGreaterThanOrEqual(3);
    expect(legend + indicators).not.toContain("…");
  });

  it("long names reach the ranking in full at every width", () => {
    const snapshot = (source: ExplorerItem, amountGel: number): SnapshotItem => ({
      itemId: source.id, kaLabel: source.kaLabel, enLabel: source.enLabel, color: source.color, amountGel, shareOfTotal: amountGel / 9e9,
      previousAmountGel: null, changeFromPreviousYear: null, amountChangeFromPreviousYear: null, basis: "actual",
    });
    const html = renderGeorgianMarkup(
      <FullRanking rows={[snapshot(health, 6e9), snapshot(roads, 3e9)]} side="expenditure" grouping="fields" year={2025} />,
      analysis,
    );
    const body = textOf(/<tbody>[\s\S]*<\/tbody>/.exec(html)![0]);
    for (const name of [HEALTH, ROADS]) expect(body.match(new RegExp(`\n${name}\n`, "g")), name).toHaveLength(1);
    expect(body).not.toContain("…");
  });
});
