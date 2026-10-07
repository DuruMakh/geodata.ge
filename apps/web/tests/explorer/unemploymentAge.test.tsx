import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, test } from "vitest";
import { UnemploymentExplorer } from "../../components/unemployment/unemployment-explorer";
import { UnemploymentAgeHeatmap } from "../../components/unemployment/unemployment-age-heatmap";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../../lib/data/unemployment/importUnemployment";
import type { ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { buildUnemploymentAgeHeatmap } from "../../lib/explorer/unemploymentAge";
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
