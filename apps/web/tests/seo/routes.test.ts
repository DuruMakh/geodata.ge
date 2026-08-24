import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../app/sitemap";
import { MUNICIPALITY_ROUTES } from "../../lib/explorer/municipalityRoutes";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("indexable Fiscal.ge routes", () => {
  it("publishes the exact unique Fiscal.ge HTML inventory", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toHaveLength(87);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith("https://fiscal.ge/"))).toBe(true);
    expect(urls).toContain("https://fiscal.ge/about");
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
