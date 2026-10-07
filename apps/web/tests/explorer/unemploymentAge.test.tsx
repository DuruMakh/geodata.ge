import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, test } from "vitest";
import { UnemploymentExplorer } from "../../components/unemployment/unemployment-explorer";
import { UnemploymentAgeHeatmap } from "../../components/unemployment/unemployment-age-heatmap";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { buildUnemploymentAgeHeatmap, unemploymentAgeHeatmapBin } from "../../lib/explorer/unemploymentAge";
import { MAP_RAMP } from "../../lib/explorer/colors";
import { buildUnemploymentModel } from "../../lib/explorer/unemployment";
import { parseUnemploymentHash } from "../../lib/explorer/unemploymentState";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";

let facts: ClientUnemploymentObservation[];
beforeAll(async () => { facts = (await loadServedUnemploymentData()).facts; });

test("age scope keeps all reviewed history in the source but displays only modern groups from 2020", () => {
  const state = parseUnemploymentHash("start=2010&end=2025&sel=georgia,age.15_24,age.20_24", facts, UNEMPLOYMENT_GROUPS, "age");
  const model = buildUnemploymentModel(facts, UNEMPLOYMENT_GROUPS, state);
  expect([model.range.start, model.range.end]).toEqual([2020, 2025]);
  expect(state.selectedIds).toEqual(["age.20_24"]);
  expect(model.definitions).toHaveLength(11);
  expect(model.referenceId).toBe("");
  expect(model.headline).toBeNull();
  expect(model.definitions.map(group => group.id)).toEqual(["age.15_19", "age.20_24", "age.25_29", "age.30_34", "age.35_39", "age.40_44", "age.45_49", "age.50_54", "age.55_59", "age.60_64", "age.65_plus"]);
  expect(facts.some(fact => fact.dimension === "age" && fact.year < 2020)).toBe(true);
});

test("removed age selections restore a modern default, while an explicitly empty selection stays empty", () => {
  expect(parseUnemploymentHash("sel=georgia,age.15_24&start=2011&end=2018", facts, UNEMPLOYMENT_GROUPS, "age")).toMatchObject({ selectedIds: ["age.15_19", "age.25_29"], range: { kind: "all" } });
  expect(parseUnemploymentHash("sel=", facts, UNEMPLOYMENT_GROUPS, "age").selectedIds).toEqual([]);
});

test.each(["unemployment_rate", "employed"] as const)("the %s heatmap covers all ages and uses the exact selected indicator and years", indicator => {
  const model = buildUnemploymentAgeHeatmap(facts, UNEMPLOYMENT_GROUPS, indicator, [2024, 2025]);
  expect(model.rows).toHaveLength(11);
  expect(model.years).toEqual([2024, 2025]);
  const age = model.rows.find(row => row.id === "age.20_24")!;
  expect(age.values[1]).toBe(facts.find(fact => fact.dimension === "age" && fact.groupId === age.id && fact.indicatorId === indicator && fact.year === 2025)!.value);
  expect(model.maximum).toBe(Math.max(...model.rows.flatMap(row => row.values.filter(value => value !== null))));
});

test("an unavailable heatmap observation stays empty and does not turn into zero", async () => {
  const model = buildUnemploymentAgeHeatmap(facts.filter(fact => !(fact.groupId === "age.20_24" && fact.indicatorId === "employed" && fact.year === 2025)), UNEMPLOYMENT_GROUPS, "employed", [2024, 2025]);
  expect(model.rows.find(row => row.id === "age.20_24")!.values).toEqual([expect.any(Number), null]);
  const messages = await getMessages("en", ["unemployment", "format", "controls"]);
  const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}><UnemploymentAgeHeatmap model={model} indicator="employed" /></I18nProvider>);
  expect(markup).toContain('data-value=""');
  expect(markup).toContain("—");
});

test.each(["ka", "en"] as const)("the %s age page retains all eight indicators in a labelled grouped dropdown and has an all-age heatmap", async locale => {
  const messages = await getMessages(locale, ["unemployment", "common", "controls", "main", "format", "workbook"]);
  const markup = renderToStaticMarkup(<I18nProvider locale={locale} messages={messages}><UnemploymentExplorer section="age" facts={facts} registry={UNEMPLOYMENT_GROUPS} sources={[]} lastReviewedAt="2026-10-03" siteOrigin="https://fiscal.ge" /></I18nProvider>);
  expect(markup).toContain('data-testid="unemployment-indicator"');
  expect(markup.match(/<option /g)).toHaveLength(8);
  expect(markup.match(/<optgroup /g)).toHaveLength(2);
  expect(markup).not.toContain('data-testid="unemployment-headline"');
  expect(markup).not.toContain('data-series-id="georgia"');
  expect(markup).toContain('data-testid="unemployment-age-heatmap"');
  expect(markup.match(/data-heatmap-group=/g)).toHaveLength(11);
  expect(markup.match(/data-heatmap-cell=/g)).toHaveLength(66);
  expect(markup).toContain("39.0%");
});

test("the heatmap scale runs in six equal bins from zero to the accent, with readable text on every bin", () => {
  expect([0, 9, 10, 25, 44, 59.9, 60].map(value => unemploymentAgeHeatmapBin(value, 60, MAP_RAMP.length))).toEqual([0, 0, 1, 2, 4, 5, 5]);
  expect(unemploymentAgeHeatmapBin(5, 0, MAP_RAMP.length)).toBe(0);
  expect(MAP_RAMP.at(-1)).toBe("#B3402A");
  const channel = (hex: string, index: number) => { const c = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const luminance = (hex: string) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const contrast = (a: string, b: string) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
  const ink = "#1E1B16", paper = "#F7F2E9";
  MAP_RAMP.forEach((fill, bin) => expect(contrast(fill, bin === MAP_RAMP.length - 1 ? paper : ink), fill).toBeGreaterThanOrEqual(4.5));
});

test("the darkest heatmap cells carry paper text on the accent", async () => {
  const messages = await getMessages("ka", ["unemployment", "format", "controls"]);
  const model = buildUnemploymentAgeHeatmap(facts, UNEMPLOYMENT_GROUPS, "unemployment_rate", [2024, 2025]);
  const markup = renderToStaticMarkup(<I18nProvider locale="ka" messages={messages}><UnemploymentAgeHeatmap model={model} indicator="unemployment_rate" /></I18nProvider>);
  const darkest = markup.match(/<td[^>]*data-bin="5"[^>]*>/g) ?? [];
  expect(darkest.length).toBeGreaterThan(0);
  for (const cell of darkest) expect(cell).toContain("background-color:#B3402A;color:var(--paper)");
  expect(markup).not.toContain("color-mix");
});
