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
    // The only selects are the range strip's month/year pickers (no measure select).
    const selects = [...markup.matchAll(/<select[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]);
    expect(selects).toEqual(["საწყისი თვე", "საწყისი წელი", "საბოლოო თვე", "საბოლოო წელი"]);
    expect(markup.match(/<select/g)).toHaveLength(4);
    expect(markup).not.toContain("თვიური ინფლაცია");
  });

  it("names Georgia in the heading and carries the unit line", () => {
    expect(markup).toContain("ინფლაცია ქალაქებში —");
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

  it("puts the place name in a picker trigger with no previous/next links", () => {
    expect(block(markup, "city-picker-trigger")).toContain("საქართველო");
    expect(block(markup, "city-picker-trigger")).toContain('aria-expanded="false"');
    expect(markup).not.toContain('data-testid="city-entity-navigation"');
  });
});

describe("InflationCities — city page", () => {
  const cityMarkup = renderGeorgianMarkup(
    <InflationCities view={{ kind: "city", cityId: "city.batumi" }} facts={packCityFacts(fixtureCityFacts)} lastReviewedAt="2026-09-11" sources={[]} siteOrigin="https://fiscal.ge" />,
    { ...common, ...controls, ...inflation, ...main },
  );

  it("names the city in the trigger and links its neighbours in Geostat's order", () => {
    expect(block(cityMarkup, "city-picker-trigger")).toContain("ბათუმი");
    const navigation = block(cityMarkup, "city-entity-navigation");
    expect(navigation).toContain('href="/explorer/inflation/cities/kutaisi"');
    expect(navigation).toContain('href="/explorer/inflation/cities/gori"');
  });

  it("lists the total and 12 divisions with only the total selected", () => {
    expect(block(cityMarkup, "series-status")).toContain("1 / 13");
  });

  it("shows the city's own indicators, not the city ranking", () => {
    const indicators = cityMarkup.slice(cityMarkup.indexOf('data-testid="inflation-city-category-indicators"'));
    expect(cityMarkup).toContain('data-testid="inflation-city-category-indicators"');
    expect(cityMarkup).not.toContain('data-testid="inflation-city-indicators"');
    expect(block(indicators, "inflation-city-category-hero")).toContain("ბათუმი");
    expect(indicators).toContain("ყველაზე გაძვირებული");
    expect(indicators).toContain("ინფლაციის სიგანე");
  });
});
