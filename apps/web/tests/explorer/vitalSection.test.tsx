import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { VitalSection } from "../../components/demography/vital-section";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { vitalFactsForPlace } from "../../lib/explorer/demographyVital";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { loadPopulationBasics } from "../../lib/pages/demography-population";

const GEORGIAN = /\p{Script=Georgian}/u;
let render: (placeId: string, locale?: "ka" | "en") => Promise<string>;
beforeAll(async () => {
  const { facts } = await loadServedDemographyData();
  render = async (placeId, locale = "en") => {
    const [{ places }, presentation] = await Promise.all([
      loadPopulationBasics(locale),
      getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook", "municipal"], []),
    ]);
    const place = places.find((candidate) => candidate.id === placeId)!;
    return renderToStaticMarkup(
      <I18nProvider {...presentation}>
        <VitalSection place={place} facts={vitalFactsForPlace(facts, placeId)} sources={[]} siteOrigin="https://fiscal.ge" workbookScope="x" nationalHref="/explorer/demography/births-deaths" />
      </I18nProvider>,
    );
  };
});

describe("births and deaths section", () => {
  it("Georgia: anchor, heading, lead, chart, key figures and the national link", async () => {
    const html = await render("country.georgia");
    expect(html).toContain('id="births-deaths"');
    expect(html).toContain("Births and deaths registered in Georgia, 2014–2025.");
    expect(html).toContain('data-testid="vital-chart-panel"');
    expect(html).toContain("−6,452");
    expect(html).toContain("37,867");
    expect(html).toContain("44,319");
    expect(html).toMatch(/Births per 100 deaths[\s\S]{0,600}>85</); // the ratio's label, then its value; widen the gap if the KPI markup is longer
    expect(html).toContain("Deaths have outnumbered births every year since 2020.");
    expect(html).toContain('href="/en/explorer/demography/births-deaths"');
    expect(html).not.toContain("Census re-base");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a region, a municipality where births lead, and one where they are equal", async () => {
    expect(await render("region.imereti")).toContain("Deaths have outnumbered births every year since 2015.");
    expect(await render("06")).toContain("Births outnumbered deaths in 2025.");
    expect(await render("17")).toContain("Births and deaths were equal in 2025.");
  });

  it("a one-year streak names the year, not 'every year since'", async () => {
    const html = await render("07");
    expect(html).toContain("Deaths outnumbered births in 2025.");
    expect(html).not.toContain("every year since 2025");
  });

  it("renders in Georgian", async () => {
    const html = await render("country.georgia", "ka");
    expect(html).toContain("დაბადებები და გარდაცვალებები");
    expect(html).toContain('href="/explorer/demography/births-deaths"');
  });
});
