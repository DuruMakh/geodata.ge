import { describe, expect, it, vi } from "vitest";
import { inflationProductsMetadata } from "../../lib/pages/inflation";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { loadPageRevisions } from "../../lib/i18n/page-revisions.server";
import sitemap from "../../lib/seo/sitemap";
import { inflationProductDatasetJsonLd } from "../../lib/seo/inflationProductDataset";

describe("product inflation discovery", () => {
  it("indexes both localized product routes and dates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, revisions, urls, metadata] = await Promise.all([
        listPublicPagePaths(), loadPageRevisions(), sitemap(), inflationProductsMetadata("en"),
      ]);
      expect(paths).toContain("/explorer/inflation/products");
      expect(revisions["/explorer/inflation/products"]).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(urls.map((entry) => entry.url)).toContain("https://fiscal.ge/explorer/inflation/products");
      expect(urls.map((entry) => entry.url)).toContain("https://fiscal.ge/en/explorer/inflation/products");
      expect(metadata.alternates?.canonical).toBe("https://fiscal.ge/en/explorer/inflation/products");
      expect(metadata.alternates?.languages?.ka).toBe("https://fiscal.ge/explorer/inflation/products");
    } finally { vi.unstubAllEnvs(); }
  });

  it("describes the product dataset without inventing a static CSV download", () => {
    const node = inflationProductDatasetJsonLd({
      locale: "en", origin: "https://fiscal.ge", firstPeriod: "2015-01", lastPeriod: "2026-08", reviewedAt: "2026-09-27",
      sourceUrls: ["https://fiscal.ge/downloads/methodology/inflation/files/en/products-yoy.xlsx"],
    });
    expect(node["@type"]).toBe("Dataset");
    expect(JSON.stringify(node)).toContain("Cumulative");
    expect(JSON.stringify(node)).toContain("Geostat");
    expect(JSON.stringify(node)).not.toContain("/downloads/data/cpi-products");
    expect(node).not.toHaveProperty("distribution");
  });
});
