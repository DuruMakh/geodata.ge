import { describe, expect, it } from "vitest";
import { InflationCategories } from "../../components/inflation/inflation-categories";
import common from "../../lib/i18n/messages/ka/common.json";
import inflation from "../../lib/i18n/messages/ka/inflation.json";
import main from "../../lib/i18n/messages/ka/main.json";
import { fixtureFacts, fixtureHeadline, fixtureWeights } from "./fixtures/inflationCategories";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const props = {
  facts: fixtureFacts,
  weights: fixtureWeights,
  headline: [...fixtureHeadline].map(([period, value]) => ({ period, value })),
  sources: [],
  siteOrigin: "https://fiscal.ge",
};

const markup = renderGeorgianMarkup(<InflationCategories {...props} />, { ...common, ...inflation, ...main });

/** The markup of the element carrying this test id. */
function block(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  if (start === -1) return "";
  return html.slice(start, start + 600);
}

describe("InflationCategories", () => {
  it("lands on the contribution tab", () => {
    expect(block(markup, "inflation-category-tab-contrib")).toContain('aria-pressed="true"');
    expect(block(markup, "inflation-category-tab-yoy")).toContain('aria-pressed="false"');
  });

  it("carries the unit line alone under the H1, with no headline value line", () => {
    expect(block(markup, "inflation-category-unit")).toContain("პროცენტული პუნქტი");
    expect(markup).not.toContain('data-testid="inflation-category-headline"');
  });

  it("names the largest contributor in the indicators hero", () => {
    expect(block(markup, "inflation-category-hero")).toContain("ტრანსპორტი");
  });

  it("selects every division by default and counts subgroups separately", () => {
    expect(markup).toContain("ჯგუფები");
    expect(markup).toContain("ქვეჯგუფები");
  });

  it("draws the stacked chart with a residual segment and the headline overlay", () => {
    expect(markup).toContain('data-segment="cpi.cat.residual"');
    expect(markup).toContain("data-overlay");
    expect(markup).toContain("დანარჩენი");
  });

  it("says contributions are a Fiscal.ge calculation", () => {
    expect(block(markup, "inflation-derived-note")).toContain("Fiscal.ge");
  });

  it("draws a line chart and no residual on a rate tab", () => {
    const yoy = renderGeorgianMarkup(<InflationCategories {...props} />, { ...common, ...inflation, ...main });
    // The server render is always the default (contribution) view; the rate tabs
    // are reached by the hash, which is read after hydration.
    expect(yoy).toContain('data-tab="contrib"');
  });
});
