import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { educationPlaceMetadata } from "../../lib/pages/education-places";
import { populationPlaceMetadata, type PopulationPlaceRoute } from "../../lib/pages/demography-population-place";
import { socialPlaceMetadata } from "../../lib/pages/social-places";

const GEORGIAN_LETTER = /[Ⴀ-ჿ]/;
const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

const KHASHURI: PopulationPlaceRoute = { kind: "municipality", slug: "khashuri" };
const KUTAISI: PopulationPlaceRoute = { kind: "municipality", slug: "kutaisi" };
const BATUMI: PopulationPlaceRoute = { kind: "municipality", slug: "batumi" };
const AKHALKALAKI: PopulationPlaceRoute = { kind: "municipality", slug: "akhalkalaki" };
const GEORGIA: PopulationPlaceRoute = { kind: "country" };
const GURIA: PopulationPlaceRoute = { kind: "region", id: "guria" };
const ROUTES = [GEORGIA, GURIA, KHASHURI, BATUMI];

describe("population place titles", () => {
  it("word a municipality's title the way people search it, with its latest year", async () => {
    expect((await populationPlaceMetadata(KHASHURI, "ka")).title).toBe("ხაშურის მუნიციპალიტეტის მოსახლეობა 2026 | Fiscal.ge");
    expect((await populationPlaceMetadata(KHASHURI, "en")).title).toBe("Khashuri Municipality population 2026 | Fiscal.ge");
    expect((await populationPlaceMetadata(KUTAISI, "ka")).title).toBe("ქუთაისის მოსახლეობა 2026 | Fiscal.ge");
    expect((await populationPlaceMetadata(GEORGIA, "ka")).title).toBe("საქართველოს მოსახლეობა 2026 | Fiscal.ge");
  });

  it("keeps the social-card titles the same as the page title", async () => {
    const metadata = await populationPlaceMetadata(KHASHURI, "ka");
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.twitter?.title).toBe(metadata.title);
  });
});

describe("education place titles", () => {
  it("name the school year the table's last column shows, as the table prints it", async () => {
    expect((await educationPlaceMetadata(AKHALKALAKI, "ka", "schools")).title).toMatch(/^ახალქალაქის მუნიციპალიტეტის სკოლები \d{4}\/\d{2} \| Fiscal\.ge$/);
    expect((await educationPlaceMetadata(BATUMI, "ka", "kindergartens")).title).toMatch(/^ბათუმის საბავშვო ბაღები \d{4}\/\d{2} \| Fiscal\.ge$/);
    expect((await educationPlaceMetadata(KHASHURI, "en", "schools")).title).toMatch(/^Schools in Khashuri Municipality \d{4}\/\d{2} \| Fiscal\.ge$/);
    expect((await educationPlaceMetadata(GURIA, "en", "kindergartens")).title).toMatch(/^Kindergartens in Guria \d{4}\/\d{2} \| Fiscal\.ge$/);
  });
});

describe("social place titles", () => {
  it("word pensions and the subsistence allowance with the place in the locative", async () => {
    expect((await socialPlaceMetadata(KHASHURI, "ka", "pensions")).title).toMatch(/^პენსიები ხაშურის მუნიციპალიტეტში \d{4} \| Fiscal\.ge$/);
    expect((await socialPlaceMetadata(BATUMI, "ka", "subsistence-allowance")).title).toMatch(/^საარსებო შემწეობა ბათუმში \d{4} \| Fiscal\.ge$/);
    expect((await socialPlaceMetadata(GEORGIA, "en", "pensions")).title).toMatch(/^Pensions in Georgia \d{4} \| Fiscal\.ge$/);
    expect((await socialPlaceMetadata(GURIA, "en", "subsistence-allowance")).title).toMatch(/^Subsistence allowance in Guria \d{4} \| Fiscal\.ge$/);
  });
});

describe("every English place title", () => {
  it("has no Georgian letter and ends with the brand once", async () => {
    for (const route of ROUTES) {
      const titles = [
        (await populationPlaceMetadata(route, "en")).title,
        (await educationPlaceMetadata(route, "en", "schools")).title,
        (await educationPlaceMetadata(route, "en", "kindergartens")).title,
        (await socialPlaceMetadata(route, "en", "pensions")).title,
        (await socialPlaceMetadata(route, "en", "subsistence-allowance")).title,
      ].map(String);
      for (const title of titles) {
        expect(title, JSON.stringify(route)).not.toMatch(GEORGIAN_LETTER);
        expect(title, JSON.stringify(route)).toMatch(/ \d{4}(\/\d{2})? \| Fiscal\.ge$/);
        expect(title.split("Fiscal.ge")).toHaveLength(2);
      }
    }
  });
});
