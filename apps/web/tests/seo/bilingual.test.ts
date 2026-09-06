import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fiscalMetadata } from "../../lib/seo/metadata";
import { pageHref } from "../../lib/i18n/routes";
import { datasetJsonLd, explorerDatasetJsonLd, siteJsonLd } from "../../lib/seo/structuredData";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
afterAll(() => vi.unstubAllEnvs());

describe("paired page metadata", () => {
  for (const path of ["/", "/explorer/debt", "/explorer/municipalities/khulo", "/methodology/expenditure"] as const) {
    for (const locale of ["ka", "en"] as const) {
      it(`pairs ${locale} ${path} with its own canonical and social image`, () => {
        const metadata = fiscalMetadata({ title: "Budget data", description: "Reviewed Georgia budget data and source documents.", path, locale });
        const ka = new URL(path, "https://fiscal.ge").href;
        const en = new URL(pageHref(path, "en"), "https://fiscal.ge").href;
        expect(metadata.alternates).toEqual({ canonical: locale === "en" ? en : ka, languages: { ka, en, "x-default": ka } });
        const image = `https://fiscal.ge${locale === "en" ? "/en" : ""}/opengraph-image`;
        expect(metadata.openGraph).toMatchObject({ locale: locale === "en" ? "en_GB" : "ka_GE", url: locale === "en" ? en : ka, images: [expect.objectContaining({ url: image, width: 1200, height: 630 })] });
        expect(metadata.twitter).toMatchObject({ images: [expect.objectContaining({ url: image })] });
        if (locale === "en") expect(JSON.stringify(metadata)).not.toMatch(/\p{Script=Georgian}/u);
      });
    }
  }

  it("keeps one dataset identity and shared distribution URLs across translated descriptions", () => {
    const input = { origin: "https://fiscal.ge", name: "Budget data", description: "Reviewed annual state budget expenditure with original public source evidence.", firstYear: 2004, lastYear: 2025, dateModified: "2026-09-06", downloadPath: "/downloads/data/national-expenditure.csv" as const };
    const ka = datasetJsonLd({ ...input, locale: "ka", path: "/methodology/expenditure",
      datasetId: "national-expenditure", jsonDownloadPaths: ["/downloads/data/national-expenditure.json"] });
    const en = datasetJsonLd({ ...input, locale: "en", path: "/en/methodology/expenditure",
      datasetId: "national-expenditure", jsonDownloadPaths: ["/downloads/data/national-expenditure.json"] });
    expect(en["@id"]).toBe(ka["@id"]);
    expect(en.url).toBe("https://fiscal.ge/en/methodology/expenditure");
    expect(en.inLanguage).toEqual(["ka", "en"]);
    expect(en.distribution).toEqual(ka.distribution);
    expect(en.distribution.find(item => item.encodingFormat === "application/json")).toMatchObject({ inLanguage: ["ka", "en"] });
    expect(en.spatialCoverage.name).toBe("Georgia");
    const explorer = explorerDatasetJsonLd({ ...input, locale: "en", path: "/en/explorer/expenditure",
      datasetId: "national-expenditure", spatialCoverageName: "Georgia" });
    expect(explorer["@id"]).toBe("https://fiscal.ge/explorer/expenditure#dataset");
  });

  it("describes the English site without Georgian metadata and retains the shared publisher", () => {
    const data = siteJsonLd("https://fiscal.ge", "en");
    expect(JSON.stringify(data)).not.toMatch(/\p{Script=Georgian}/u);
    expect(data["@graph"].find(item => item["@type"] === "WebSite")?.inLanguage).toEqual(["ka", "en"]);
    expect(data["@graph"].find(item => item["@type"] === "Organization")?.["@id"]).toBe("https://fiscal.ge/#organization");
  });
});
