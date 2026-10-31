import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadServedHousingData } from "../../lib/data/housing/importHousing";
import { loadServedMoneyBanksData } from "../../lib/data/moneyBanks/importMoneyBanks";
import { loadServedRegionalEconomyData } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { loadServedUnemploymentData } from "../../lib/data/unemployment/importUnemployment";
import { moneyBanksAreaSeries } from "../../lib/explorer/moneyBanksAreas";
import { businessAreaPageMetadata } from "../../lib/pages/business-regions";
import { environmentAreaPageMetadata } from "../../lib/pages/environment-areas";
import { healthDeathsAreaPageMetadata } from "../../lib/pages/health-deaths";
import { householdRegionPageMetadata } from "../../lib/pages/household";
import { housingAreaPageMetadata } from "../../lib/pages/housing-shared";
import { internetAreaPageMetadata } from "../../lib/pages/internet-shared";
import { moneyBanksAreaPageMetadata } from "../../lib/pages/money-banks-regions-shared";
import { regionAreaFrame } from "../../lib/pages/region-area-frame";
import { renderRegionalEconomiesPage } from "../../lib/pages/regional-economies";
import { regionalEconomyPageMetadata, renderRegionalEconomyPage } from "../../lib/pages/regional-economy";
import { museumAreaMetadata } from "../../lib/pages/science-culture-shared";
import { transportAreaPageMetadata } from "../../lib/pages/transport-shared";
import { unemploymentRegionPageMetadata } from "../../lib/pages/unemployment-regions";
import { wagesRegionPageMetadata } from "../../lib/pages/wages";
import { housingAreaSeries } from "../../lib/explorer/housingAreas";
import { latestYearOf } from "../../lib/seo/placeTitleForms";

const GEORGIAN_LETTER = /[Ⴀ-ჿ]/;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

const SLUGS = ["georgia", "tbilisi", "imereti", "racha_lechkhumi_kvemo_svaneti"];

describe("region page titles", () => {
  it("word a region's unemployment title with the region in the locative and its own latest year", async () => {
    const { facts } = await loadServedUnemploymentData();
    const latest = latestYearOf(facts, f => f.dimension === "region" && f.groupId === "region.kakheti");
    expect((await unemploymentRegionPageMetadata("kakheti", "ka")).title).toBe(`უმუშევრობა კახეთში ${latest} | Fiscal.ge`);
    expect((await unemploymentRegionPageMetadata("kakheti", "en")).title).toBe(`Unemployment in Kakheti ${latest} | Fiscal.ge`);
  });

  it("word the bank loans title of the compound region with its stored form", async () => {
    const { facts } = await loadServedMoneyBanksData();
    const ids = new Set<string>(moneyBanksAreaSeries("region_samegrelo_zemo_svaneti").map(series => series.id));
    const latest = latestYearOf(facts, f => ids.has(f.indicatorId));
    expect((await moneyBanksAreaPageMetadata("samegrelo_zemo_svaneti", "ka")).title).toBe(`ბანკების სესხები სამეგრელო-ზემო სვანეთში ${latest} | Fiscal.ge`);
    expect((await moneyBanksAreaPageMetadata("samegrelo_zemo_svaneti", "en")).title).toBe(`Bank loans in Samegrelo-Zemo Svaneti ${latest} | Fiscal.ge`);
  });

  it("word the regional economy title with the region in the genitive and its latest year", async () => {
    const { facts } = await loadServedRegionalEconomyData();
    const latest = Math.max(...facts.filter(f => f.regionId === "region.imereti").map(f => f.year));
    expect(latest).toBe(2024);
    expect((await regionalEconomyPageMetadata("imereti", "ka")).title).toBe("იმერეთის ეკონომიკა 2024 | Fiscal.ge");
    expect((await regionalEconomyPageMetadata("imereti", "en")).title).toBe("Imereti economy 2024 | Fiscal.ge");
  });

  it("names Georgia in the locative on its own area page", async () => {
    expect((await housingAreaPageMetadata("georgia", "ka")).title).toContain("საქართველოში");
    expect((await housingAreaPageMetadata("georgia", "en")).title).toMatch(/^Housing and construction in Georgia \d{4} \| Fiscal\.ge$/);
  });

  it("ends a housing title in the area's own latest year", async () => {
    const { facts } = await loadServedHousingData();
    const ids = new Set<string>(housingAreaSeries("region_imereti").map(series => series.id));
    const latest = latestYearOf(facts, f => ids.has(f.indicatorId));
    expect((await housingAreaPageMetadata("imereti", "ka")).title).toBe(`საცხოვრებელი და მშენებლობა იმერეთში ${latest} | Fiscal.ge`);
  });

  it("title a frame area with the latest year the frame's config gives that area", async () => {
    type Fact = { year: number; lastReviewedAt: string; area: "georgia" | "region_imereti" };
    const facts: Fact[] = [
      { area: "georgia", year: 2024, lastReviewedAt: "2026-01-01" }, { area: "georgia", year: 2023, lastReviewedAt: "2026-01-01" },
      { area: "region_imereti", year: 2023, lastReviewedAt: "2026-01-01" }, { area: "region_imereti", year: 2022, lastReviewedAt: "2026-01-01" },
    ];
    const frame = regionAreaFrame<"georgia" | "region_imereti", Fact>({
      hub: "housing", indexHref: "/explorer/housing/regions", indexKey: "regions", areas: ["georgia", "region_imereti"],
      areaSlug: area => area.replace(/^region_/, ""), areaHref: area => `/explorer/housing/regions/${area.replace(/^region_/, "")}`,
      mapId: area => area.replace(/^region_/, "region."), areaHeadingIds: () => [],
      load: async () => ({ facts }), latestYear: (all, area) => latestYearOf(all, f => f.area === area), sourceIds: [],
    });
    expect((await frame.areaPageMetadata("imereti", "ka")).title).toBe("საცხოვრებელი და მშენებლობა იმერეთში 2023 | Fiscal.ge");
    expect((await frame.areaPageMetadata("georgia", "ka")).title).toBe("საცხოვრებელი და მშენებლობა საქართველოში 2024 | Fiscal.ge");
  });
});

describe("regional economy description", () => {
  it("opens the Georgian description with the region in the genitive", async () => {
    const metadata = await regionalEconomyPageMetadata("tbilisi", "ka");
    expect(metadata.description).toContain("გაეცანით თბილისის მშპ-სა");
    expect((await regionalEconomyPageMetadata("tbilisi", "en")).description).toMatch(/^Explore Tbilisi GDP and \d+ economic activities/);
  });

  it("keeps the Dataset name and description on the page itself", async () => {
    const page = JSON.stringify(await renderRegionalEconomyPage("tbilisi", "ka"));
    expect(page).toContain("გაეცანით თბილისის მშპ-სა");
    expect(page).toContain("თბილისი — რეგიონის ეკონომიკა, ");
  });

  it("gives the index's region parts the same description", async () => {
    expect(JSON.stringify(await renderRegionalEconomiesPage("ka"))).toContain("გაეცანით თბილისის მშპ-სა");
  });
});

describe("every region title", () => {
  const loaders: Record<string, (slug: string, locale: "ka" | "en") => Promise<{ title?: unknown }>> = {
    unemployment: (s, l) => unemploymentRegionPageMetadata(s, l), wages: (s, l) => wagesRegionPageMetadata(s, l),
    loans: (s, l) => moneyBanksAreaPageMetadata(s, l), business: (s, l) => businessAreaPageMetadata(s, l),
    housing: (s, l) => housingAreaPageMetadata(s, l), internet: (s, l) => internetAreaPageMetadata(s, l), transport: (s, l) => transportAreaPageMetadata(s, l),
    income: (s, l) => householdRegionPageMetadata("income", s, l), spending: (s, l) => householdRegionPageMetadata("spending", s, l),
    deaths: (s, l) => healthDeathsAreaPageMetadata(l, s), museums: (s, l) => museumAreaMetadata(s, l),
    waste: (s, l) => environmentAreaPageMetadata(s, l, "waste"), forests: (s, l) => environmentAreaPageMetadata(s, l, "forests"),
  };
  // Wages, unemployment and the regional economy have no Georgia page.
  const regionOnly = new Set(["wages", "unemployment"]);

  for (const [family, load] of Object.entries(loaders)) {
    it(`${family}: ends in a year and the brand once, in Georgian and English`, async () => {
      for (const slug of SLUGS.filter(slug => !(regionOnly.has(family) && slug === "georgia"))) {
        const ka = String((await load(slug, "ka")).title), en = String((await load(slug, "en")).title);
        expect(ka, `${family} ${slug}`).toMatch(/ \d{4} \| Fiscal\.ge$/);
        expect(en, `${family} ${slug}`).toMatch(/ \d{4} \| Fiscal\.ge$/);
        expect(en, `${family} ${slug}`).not.toMatch(GEORGIAN_LETTER);
        expect(ka.split("Fiscal.ge")).toHaveLength(2);
      }
    });
  }
});

describe("social-card titles", () => {
  it("stay the same as the page title", async () => {
    const metadata = await wagesRegionPageMetadata("imereti", "ka");
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.twitter?.title).toBe(metadata.title);
  });
});
