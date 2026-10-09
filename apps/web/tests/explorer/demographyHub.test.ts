import { describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import { INK } from "../../lib/explorer/colors";
import { buildDemographyHubCards } from "../../lib/explorer/demographyHubCards";
import { DEMOGRAPHY_PAGES, LIVE_DEMOGRAPHY_PAGES } from "../../lib/explorer/demographyRoutes";
import { getMessages } from "../../lib/i18n/messages.server";
import { getPresentation } from "../../lib/i18n/presentation.server";

describe("demography routes", () => {
  it("name the four pages in hub order and only the population and migration pages are live", () => {
    expect(DEMOGRAPHY_PAGES.map((page) => page.id)).toEqual(["population", "age-sex", "migration", "births-deaths"]);
    expect(DEMOGRAPHY_PAGES.map((page) => page.path)).toEqual([
      "/explorer/demography/population",
      "/explorer/demography/age-sex",
      "/explorer/demography/migration",
      "/explorer/demography/births-deaths",
    ]);
    expect(LIVE_DEMOGRAPHY_PAGES.map((page) => page.id)).toEqual(["population", "migration"]);
  });

  it("have a sidebar label in both languages for every live page", async () => {
    for (const locale of ["ka", "en"] as const) {
      const common = await getMessages(locale, ["common"]);
      for (const page of LIVE_DEMOGRAPHY_PAGES) expect(common[page.labelKey]?.trim()).toBeTruthy();
    }
  });
});

describe("demography hub cards", () => {
  it("link only the live pages and show the other two as coming soon", async () => {
    const [{ facts }, presentation] = await Promise.all([loadServedDemographyData(), getPresentation("en", ["demography", "common"], [])]);
    const cards = buildDemographyHubCards(facts, presentation);
    expect(cards.map((card) => card.index)).toEqual(["01", "02", "03", "04"]);
    expect(cards.map((card) => card.title)).toEqual(["Population", "Age and sex", "Migration", "Births, deaths and fertility"]);
    expect(cards.map((card) => card.href)).toEqual(["/explorer/demography/population", null, "/explorer/demography/migration", null]);
    expect(cards.map((card) => card.comingSoon)).toEqual([false, true, false, true]);
  });

  it("draw the population card from Georgia's series with the census gap as a break in the line", async () => {
    const [{ facts }, presentation] = await Promise.all([loadServedDemographyData(), getPresentation("en", ["demography", "common"], [])]);
    const georgia = facts
      .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === "country.georgia")
      .sort((left, right) => left.year - right.year);
    const card = buildDemographyHubCards(facts, presentation)[0]!;
    expect(card.series).toHaveLength(georgia.length + 1);
    expect(card.series!.filter((value) => value === null)).toHaveLength(1);
    expect(card.series![0]).toBe(georgia[0]!.value);
    expect(card.series!.at(-1)).toBe(georgia.at(-1)!.value);
    expect(card.seriesColor).toBe(INK);
    expect(card.footer).toBe("2026: 3,941,103 people · 2004–2026");
  });

  it("draws the migration card from Geostat's published net", async () => {
    const { facts } = await loadServedDemographyData();
    const presentation = await getPresentation("en", ["demography"], []);
    const card = buildDemographyHubCards(facts, presentation)[2]!;
    expect(card.series).toHaveLength(14);
    expect(card.footer).toBe("2025: net migration +17,127 · 2012–2025");
  });
});
