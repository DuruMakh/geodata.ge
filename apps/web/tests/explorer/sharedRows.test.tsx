import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, test } from "vitest";
import { HeatmapTable } from "../../components/main-explorer/heatmap-table";
import { UnemploymentAgeHeatmap } from "../../components/unemployment/unemployment-age-heatmap";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
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
