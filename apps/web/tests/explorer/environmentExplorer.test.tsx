import { beforeAll, expect, test } from "vitest";
import { EnvironmentExplorer, type EnvironmentScope } from "../../components/environment/environment-explorer";
import { loadEnvironmentFacts, toClientEnvironmentFact } from "../../lib/data/environment/importEnvironment";
import type { ClientEnvironmentFact } from "../../lib/data/environment/types";
import { environmentLabelKey } from "../../lib/explorer/environment";
import { getMessages } from "../../lib/i18n/messages.server";
import { message } from "../../lib/i18n/messages";
import type { Messages } from "../../lib/i18n/types";
import { chartGeometry, renderPageMarkup } from "../helpers/render-localized";

let facts: ClientEnvironmentFact[];
let messages: Messages;
beforeAll(async () => {
  facts = (await loadEnvironmentFacts()).map(toClientEnvironmentFact);
  messages = await getMessages("en", ["environment", "format", "main", "workbook"]);
});

const render = (scope: EnvironmentScope) => {
  const labels = Object.fromEntries(facts.filter(f => !f.indicatorId.includes(".treatment_")).map(f => [f.indicatorId, message(messages, `environment.${environmentLabelKey(f.indicatorId)}`)]));
  return renderPageMarkup("en", <EnvironmentExplorer scope={scope} facts={facts} labels={labels} sources={[]} lastReviewedAt="2026-10-20" siteOrigin="https://fiscal.ge"
    title="Title" latest={{ measure: "Measure", year: 2022, value: "20.1" }} />, messages);
};
const textOf = (html: string) => html.replace(/<[^>]+>/g, "|").split("|").map(part => part.trim()).filter(Boolean);

test("Greenhouse gases lists its headings in the design's order, and forests and land keep their minus sign", () => {
  const text = textOf(render({ kind: "topic", section: "greenhouse-gases" }));
  const headings = ["Total · million t CO₂ eq.", "By sector · million t CO₂ eq.", "Energy in detail · million t CO₂ eq.", "By gas · million t CO₂ eq.", "Fluorinated gases · thousand t CO₂ eq.", "Per person · t CO₂ eq."];
  expect(headings.map(heading => text.indexOf(heading))).toEqual([...headings.map(heading => text.indexOf(heading))].sort((a, b) => a - b));
  expect(headings.every(heading => text.includes(heading))).toBe(true);
  expect(text[text.indexOf("Forests and land") + 1]).toBe("−5.8");
});

test("a city page draws its yearly limit as a dashed line under the city's picker heading", () => {
  const html = render({ kind: "city", city: "tbilisi" });
  expect(html).toContain('data-testid="city-picker-trigger"');
  expect(chartGeometry(html, "desktop")).toMatch(/stroke-dasharray/);
});

test("a page without a limit draws no dashed line", () => {
  expect(chartGeometry(render({ kind: "topic", section: "greenhouse-gases" }), "desktop")).not.toMatch(/stroke-dasharray/);
});
