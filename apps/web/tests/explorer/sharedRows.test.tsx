import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, test } from "vitest";
import { AnalysisView } from "../../components/analysis/analysis-view";
import { HeatmapTable } from "../../components/main-explorer/heatmap-table";
import { YearButtonRow } from "../../components/ui/year-button-row";
import { UnemploymentAgeHeatmap } from "../../components/unemployment/unemployment-age-heatmap";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import type { SingleYearSnapshotModel } from "../../lib/explorer/types";
import { buildUnemploymentAgeHeatmap } from "../../lib/explorer/unemploymentAge";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";

let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });

test("the Unemployment age heat map markup is recorded", async () => {
  const model = buildUnemploymentAgeHeatmap(facts, UNEMPLOYMENT_GROUPS, "unemployment_rate", [2024, 2025]);
  const messages = await getMessages("en", ["unemployment", "format", "controls"]);
  const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}><UnemploymentAgeHeatmap model={model} indicator="unemployment_rate" /></I18nProvider>);
  expect(markup).toMatchSnapshot();
});

test("the Analysis year row tags the planned year, presses only the value and keeps the tag when active", async () => {
  const messages = await getMessages("ka", ["analysis", "common", "controls"]);
  const yearRow = (year: number) => {
    const markup = renderToStaticMarkup(<I18nProvider locale="ka" messages={messages}>
      <AnalysisView model={{ emptyReason: "x", hasPlannedValues: false } as unknown as SingleYearSnapshotModel} years={[2023, 2024, 2025]} plannedYears={new Set([2025])} side="expenditure" grouping="fields" year={year} lastUpdatedAt="2026-01-01" onSideChange={() => {}} onGroupingChange={() => {}} onYearChange={() => {}} />
    </I18nProvider>);
    const row = markup.match(/<div data-testid="analysis-year-selector"[\s\S]*?<\/div>/)![0];
    return [...row.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attributes, content]) => ({ attributes: attributes!, content: content! }));
  };
  const buttons = yearRow(2024);
  expect(buttons.map((button) => button.content.replace(/<[^>]+>[^<]*<\/[^>]+>/g, ""))).toEqual(["2023", "2024", "2025"]);
  expect(buttons.map((button) => button.content.includes("გეგმა"))).toEqual([false, false, true]);
  expect(buttons.map((button) => button.attributes.includes('aria-pressed="true"'))).toEqual([false, true, false]);
  for (const button of buttons) expect(button.attributes).toContain("min-h-9");
  // The tag stays when the planned year is the active one.
  const active = yearRow(2025);
  expect(active[2]!.attributes).toContain('aria-pressed="true"');
  expect(active[2]!.content).toContain("გეგმა");
});

test("HeatmapTable draws the break rule and label on the break year only", () => {
  const rows = [{ id: "a", label: "Row A", values: [1, 2] }];
  const props = { caption: "Cap", rowHeader: "Age", years: [2024, 2025], rows, maximum: 2, format: (v: number | null) => String(v), scaleLabel: "Scale" };
  const marked = renderToStaticMarkup(<HeatmapTable {...props} breakYear={2025} breakLabel="Census" />);
  const rule = "border-left:2px solid var(--ink)";
  const header = (year: number) => marked.match(new RegExp(`<th[^>]*>${year}[^<]*(<sup[^>]*>[^<]*</sup>)?</th>`))![0];
  expect(header(2025)).toContain(rule);
  expect(header(2025)).toContain("Census");
  expect(header(2024)).not.toContain(rule);
  expect(marked.match(/<td[^>]*data-heatmap-cell="a:2025"[^>]*>/)![0]).toContain(rule);
  expect(marked.match(/<td[^>]*data-heatmap-cell="a:2024"[^>]*>/)![0]).not.toContain(rule);
  expect(marked.match(/Census/g)).toHaveLength(1);
  const plain = renderToStaticMarkup(<HeatmapTable {...props} />);
  expect(plain).not.toContain(rule);
  expect(plain).not.toContain("Census");
});

test("YearButtonRow tags only the years tagFor names and presses only the value", () => {
  const markup = renderToStaticMarkup(<YearButtonRow years={[2024, 2025]} value={2024} onChange={() => {}} tagFor={year => year === 2025 ? "Census" : null} testId="row" />);
  expect(markup).toContain('data-testid="row"');
  expect(markup.match(/Census/g)).toHaveLength(1);
  expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(markup).toMatch(/aria-pressed="true"[^>]*>2024</);
});
