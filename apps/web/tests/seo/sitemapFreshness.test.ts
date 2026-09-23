import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../lib/seo/sitemap";
import { loadServedLandingData, loadServedMunicipalData } from "../../lib/data/servedData";
import { loadServedGdpOverviewData } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../../lib/data/economicSectors/importEconomicSectors";
import {
  aggregateFactsForEntity,
  applyAdjaraBudgetAdjustment,
  latestReviewedAtForMunicipalFacts,
  regionFactsFor,
} from "../../lib/explorer/municipalData";
import { MUNICIPALITY_ROUTES } from "../../lib/explorer/municipalityRoutes";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

const SITE = "https://fiscal.ge";

async function sitemapDates(): Promise<Map<string, string | undefined>> {
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
  const entries = await sitemap();
  return new Map(
    entries.map((entry) => [
      entry.url,
      entry.lastModified ? new Date(entry.lastModified).toISOString().slice(0, 10) : undefined,
    ]),
  );
}

describe("sitemap lastmod reports each entity's own reviewed date", () => {
  it("gives every municipality the date its own facts were reviewed", async () => {
    const [dates, municipalData, { sourceDocuments }] = await Promise.all([
      sitemapDates(),
      loadServedMunicipalData(),
      loadServedLandingData(),
    ]);
    const { functionFacts, totalFacts } = municipalData;

    for (const { code, slug } of MUNICIPALITY_ROUTES) {
      const expected = latestReviewedAtForMunicipalFacts(
        sourceDocuments,
        functionFacts.filter((row) => row.municipalityCode === code),
        totalFacts.filter((row) => row.municipalityCode === code),
      );

      expect(dates.get(`${SITE}/explorer/municipalities/${slug}`)).toBe(expected);
    }
  });

  // Adjara is the case that matters here: applyAdjaraBudgetAdjustment folds in the
  // republic budget, whose source document is reviewed later than any member
  // municipality's. Deriving the region date from raw member facts alone silently
  // reports Adjara as older than the date its own page renders.
  it("gives every region the date its page renders, republic adjustment included", async () => {
    const [dates, municipalData, { sourceDocuments }] = await Promise.all([
      sitemapDates(),
      loadServedMunicipalData(),
      loadServedLandingData(),
    ]);
    const { regions, municipalities, functionFacts, totalFacts, adjaraBudgetAdjustments } =
      municipalData;

    for (const region of regions) {
      const members = regionFactsFor(region.id, municipalities, functionFacts, totalFacts);
      const rolled = aggregateFactsForEntity(region.id, members.functionFacts, members.totalFacts);
      const ownTotalFacts =
        region.id === "region.adjara"
          ? applyAdjaraBudgetAdjustment(rolled.totalFacts, adjaraBudgetAdjustments)
          : rolled.totalFacts;
      const expected = latestReviewedAtForMunicipalFacts(
        sourceDocuments,
        members.functionFacts,
        ownTotalFacts,
      );
      const slug = region.id.replace("region.", "");

      expect(dates.get(`${SITE}/explorer/municipalities/region/${slug}`)).toBe(expected);
    }
  });

  it("gives the Georgia roll-up the date its country facts were reviewed", async () => {
    const [dates, municipalData, { sourceDocuments }] = await Promise.all([
      sitemapDates(),
      loadServedMunicipalData(),
      loadServedLandingData(),
    ]);

    const expected = latestReviewedAtForMunicipalFacts(
      sourceDocuments,
      municipalData.countryFunctionFacts,
      municipalData.countryTotalFacts,
    );

    expect(dates.get(`${SITE}/explorer/municipalities/georgia`)).toBe(expected);
  });

  it("does not stamp one global date across every municipal URL", async () => {
    const dates = await sitemapDates();
    const municipalDates = [...dates]
      .filter(([url]) => url.startsWith(`${SITE}/explorer/municipalities`))
      .map(([, date]) => date);

    // The bug this guards: municipality pages render a reviewed date that is older
    // than the newest source document, so a single site-wide maximum misreports
    // them as all having changed on the same day.
    expect(municipalDates.length).toBeGreaterThan(70);
    expect(new Set(municipalDates).size).toBeGreaterThan(1);
  });

  it("leaves the national explorer routes on the site-wide reviewed date", async () => {
    const [dates, { sourceDocuments }] = await Promise.all([sitemapDates(), loadServedLandingData()]);
    const siteWide = sourceDocuments
      .map((source) => source.lastReviewedAt)
      .sort()
      .at(-1);

    // These pages display the site-wide maximum by design, so the sitemap must
    // keep agreeing with them rather than being narrowed alongside the municipal URLs.
    for (const path of ["/explorer/expenditure", "/explorer/revenue", "/explorer/analysis"]) {
      expect(dates.get(`${SITE}${path}`)).toBe(siteWide);
    }
  });

  it("dates the economy pages from their own facts, not the budget documents", async () => {
    const [dates, { facts: gdpFacts }, { facts: sectorFacts }] = await Promise.all([
      sitemapDates(),
      loadServedGdpOverviewData(),
      loadServedEconomicSectorsData(),
    ]);
    const latest = (facts: readonly { lastReviewedAt: string }[]) =>
      facts.map((fact) => fact.lastReviewedAt).sort().at(-1);
    const gdp = latest(gdpFacts);
    const sectors = latest(sectorFacts);

    expect(dates.get(`${SITE}/explorer/economy/gdp`)).toBe(gdp);
    expect(dates.get(`${SITE}/explorer/economy/sectors`)).toBe(sectors);
    // The hub shows both, so it moves when either refreshes.
    expect(dates.get(`${SITE}/explorer/economy`)).toBe([gdp!, sectors!].sort().at(-1));
  });
});
