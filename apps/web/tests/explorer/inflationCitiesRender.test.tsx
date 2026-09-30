import { describe, expect, it } from "vitest";
import { InflationCities } from "../../components/inflation/inflation-cities";
import { packCityFacts } from "../../lib/explorer/inflationCities";
import { GEORGIA_VIEW } from "../../lib/explorer/inflationCityRoutes";
import common from "../../lib/i18n/messages/ka/common.json";
import controls from "../../lib/i18n/messages/ka/controls.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";
import { fixtureCityFacts } from "./fixtures/inflationCities";

const markup = renderGeorgianMarkup(
  <InflationCities view={GEORGIA_VIEW} facts={packCityFacts(fixtureCityFacts)} lastReviewedAt="2026-09-11" sources={[]} siteOrigin="https://fiscal.ge" />,
  { ...common, ...controls, ...inflation, ...main },
);

function block(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  return start === -1 ? "" : html.slice(start, start + 800);
}

describe("InflationCities — Georgia page", () => {
  it("has no tab row, no select and no monthly measure", () => {
    expect(markup).not.toContain('data-testid="inflation-city-tabs"');
    expect(markup).not.toContain("<select");
    expect(markup).not.toContain("თვიური ინფლაცია");
  });

  it("names Georgia in the heading and carries the unit line", () => {
    expect(markup).toContain("ინფლაცია ქალაქებში — საქართველო");
    expect(block(markup, "inflation-city-unit")).toContain("პროცენტი");
  });

  it("selects all seven lines by default, Georgia first", () => {
    const rows = [...markup.matchAll(/data-testid="series-row" data-series-id="([^"]+)"/g)].map((match) => match[1]);
    expect(rows).toEqual(["country.georgia", "city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"]);
    expect(block(markup, "series-status")).toContain("7 / 7");
  });

  it("names the highest city in the indicators and never ranks Georgia", () => {
    const indicators = markup.slice(markup.indexOf('data-testid="inflation-city-indicators"'));
    expect(block(indicators, "inflation-city-hero")).toContain("ბათუმი");
    expect(indicators).toContain("ყველაზე დაბალი");
    expect(indicators).toContain("ქალაქებს შორის სხვაობა");
    expect(indicators).toContain("2 / 6");
  });

  it("states that some prices are the same in every city", () => {
    expect(markup).toContain("ყველა ქალაქზე ვრცელდება");
  });
});
