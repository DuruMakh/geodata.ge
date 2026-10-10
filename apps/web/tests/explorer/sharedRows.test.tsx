import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, expect, test } from "vitest";
import { AnalysisView } from "../../components/analysis/analysis-view";
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

test("the Analysis year row markup is recorded", async () => {
  const messages = await getMessages("ka", ["analysis", "common", "controls"]);
  const markup = renderToStaticMarkup(<I18nProvider locale="ka" messages={messages}>
    <AnalysisView model={{ emptyReason: "x", hasPlannedValues: false } as unknown as SingleYearSnapshotModel} years={[2023, 2024, 2025]} plannedYears={new Set([2025])} side="expenditure" grouping="fields" year={2024} lastUpdatedAt="2026-01-01" onSideChange={() => {}} onGroupingChange={() => {}} onYearChange={() => {}} />
  </I18nProvider>);
  expect(markup).toMatchSnapshot();
});
