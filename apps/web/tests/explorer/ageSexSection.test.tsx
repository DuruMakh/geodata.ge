import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { AgeSexSection } from "../../components/demography/age-sex-section";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { censusAgeFactsForPlace } from "../../lib/explorer/demographyAgeSex";
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
        <AgeSexSection place={place} facts={censusAgeFactsForPlace(facts, placeId)} sources={[]} siteOrigin="https://fiscal.ge" workbookScope="x" nationalHref="/explorer/demography/age-sex" />
      </I18nProvider>,
    );
  };
});

describe("age and sex census section", () => {
  it("Georgia: anchor, heading, pyramid, key figures and the link to every year", async () => {
    const html = await render("country.georgia");
    expect(html).toContain('id="age-sex"');
    expect(html).toContain('data-testid="age-sex-section"');
    expect(html).toContain("Age and sex · census, 14 November 2024");
    expect(html).toContain('data-testid="age-sex-pyramid"');
    expect(html).toContain("3,929,581");
    expect(html).toContain("17.6%");
    expect(html).toContain("62.5%");
    expect(html).toContain('data-testid="age-sex-national-link"');
    expect(html).toContain('href="/en/explorer/demography/age-sex"');
    expect(html).toContain("Georgia’s pyramid for every year since 2004");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a region: Imereti's counts and shares, and the link that compares the regions", async () => {
    const html = await render("region.imereti");
    expect(html).toContain("510,741");
    expect(html).toContain("22.0%");
    expect(html).toContain("53.6%");
    expect(html).toContain("Compare the regions and see Georgia’s pyramid for every year");
    expect(html).not.toMatch(GEORGIAN);
  });

  it("a municipality has no census rows, so it renders nothing", async () => {
    expect(await render("06")).toBe("");
  });

  it("renders in Georgian", async () => {
    const html = await render("country.georgia", "ka");
    expect(html).toContain("ასაკი და სქესი · აღწერა, 2024 წლის 14 ნოემბერი");
    expect(html).toContain('href="/explorer/demography/age-sex"');
  });
});
