import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../app/sitemap";
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
    expect(typeof metadataModule.governmentDebtMetadata).toBe("function");
    if (typeof metadataModule.governmentDebtMetadata !== "function") return;

    const metadata = metadataModule.governmentDebtMetadata([
      { year: 2013, family: "stock", status: "actual" },
      { year: 2025, family: "stock", status: "actual" },
      { year: 2030, family: "service", status: "projection_existing_portfolio" },
    ]) as { title?: string; alternates?: { canonical?: string } };

    expect(metadata.title).toContain("2013–2025");
    expect(metadata.title).not.toContain("2030");
    expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/explorer/debt");
  });

  it("publishes the exact unique Fiscal.ge HTML inventory", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    // 87 before this branch, plus /explorer/debt and /methodology/debt from
    // main and /connect from here. This count is pinned on purpose: a new HTML
    // route has to be an explicit decision, and llms.txt asserts every HTML
    // target it links also appears here.
    expect(urls).toHaveLength(90);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith("https://fiscal.ge/"))).toBe(true);
    expect(urls).toContain("https://fiscal.ge/about");
    expect(urls).toContain("https://fiscal.ge/connect");
    expect(urls).toContain("https://fiscal.ge/explorer/debt");
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
