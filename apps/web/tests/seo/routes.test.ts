import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../lib/seo/sitemap";
import { MUNICIPALITY_ROUTES } from "../../lib/explorer/municipalityRoutes";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("indexable Fiscal.ge routes", () => {
  it("builds canonical debt metadata from actual stock coverage", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const metadataModule = await import("../../lib/seo/metadata") as Record<string, unknown>;
    const internalLinks = await import("../../lib/seo/internalLinks") as Record<string, unknown>;

    expect(internalLinks.DEBT_EXPLORER_PATH).toBe("/explorer/debt");
    expect(internalLinks.DEFICIT_EXPLORER_PATH).toBe("/explorer/deficit");
    expect(typeof metadataModule.governmentDebtMetadata).toBe("function");
    expect(typeof metadataModule.generalGovernmentDeficitMetadata).toBe("function");
    if (typeof metadataModule.governmentDebtMetadata !== "function") return;

    const metadata = metadataModule.governmentDebtMetadata([
      { year: 2013, family: "stock", status: "actual" },
      { year: 2025, family: "stock", status: "actual" },
      { year: 2030, family: "service", status: "projection_existing_portfolio" },
    ]) as { title?: string; alternates?: { canonical?: string } };

    expect(metadata.title).toContain("2013–2025");
    expect(metadata.title).not.toContain("2030");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/debt");

    if (typeof metadataModule.generalGovernmentDeficitMetadata !== "function") return;
    const deficitMetadata = metadataModule.generalGovernmentDeficitMetadata([
      { year: 1995, status: "actual" },
      { year: 2025, status: "actual" },
      { year: 2031, status: "projection" },
    ]) as { title?: string; alternates?: { canonical?: string } };
    expect(deficitMetadata.title).toContain("1995–2025");
    expect(deficitMetadata.title).not.toContain("2031");
    expect(deficitMetadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/deficit");
  });

  it("publishes the exact unique Fiscal.ge HTML inventory", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    // Regional economies add a bilingual index, eleven bilingual detail pages
    // and one bilingual methodology page; inflation categories and products
    // add bilingual identities, and the inflation cities page and its six city
    // pages add seven more bilingual pairs (the Georgia page plus one per city).
    // The four unemployment data pages add four bilingual pairs behind their hub.
    // The trade hub, the trade overview and the trade methodology add three more pairs.
    // The demography methodology adds one more, and the demography hub and
    // Population page add two more bilingual pairs; the 75 Population place
    // pages (Georgia, 11 regions and 63 municipalities) add 75 more pairs.
    // Trading partners and Products each add one further bilingual pair.
    // The Migration page adds one more bilingual pair, and so does the Births, deaths and fertility page.
    expect(urls).toHaveLength(446);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith("https://fiscal.ge/"))).toBe(true);
    expect(urls).toContain("https://fiscal.ge/about");
    expect(urls).toContain("https://fiscal.ge/connect");
    expect(urls).toContain("https://fiscal.ge/explorer/debt");
    expect(urls).toContain("https://fiscal.ge/explorer/deficit");
    expect(urls).toContain("https://fiscal.ge/explorer/trade/partners");
    expect(urls).toContain("https://fiscal.ge/en/explorer/trade/partners");
    expect(urls).toContain("https://fiscal.ge/explorer/trade/products");
    expect(urls).toContain("https://fiscal.ge/en/explorer/trade/products");
    expect(urls).toContain("https://fiscal.ge/explorer/economy/regions");
    expect(urls).toContain("https://fiscal.ge/en/explorer/economy/regions/imereti");
    expect(urls).toContain("https://fiscal.ge/methodology/debt");
    expect(urls.some((url) => url.includes("#") || url.includes("?"))).toBe(false);
  });

  it("publishes municipality slugs and never the numeric source identities", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const urls = (await sitemap()).map((entry) => entry.url);
    const municipalityUrls = urls.filter((url) => /^https:\/\/fiscal\.ge\/explorer\/municipalities\/(?!georgia$|region\/)/.test(url));

    expect(municipalityUrls).toEqual(
      MUNICIPALITY_ROUTES.map(({ slug }) => `https://fiscal.ge/explorer/municipalities/${slug}`),
    );
    expect(municipalityUrls.some((url) => /\/\d{2}$/.test(url))).toBe(false);
  });
});
