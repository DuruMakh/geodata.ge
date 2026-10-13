import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { JsonLd } from "../../components/seo/json-ld";
import { inflationProductsMetadata, renderInflationProducts } from "../../lib/pages/inflation-products";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { loadPageRevisions } from "../../lib/i18n/page-revisions.server";
import sitemap from "../../lib/seo/sitemap";

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

  it("describes the product dataset with the published product CSV and the Geostat files it was read from", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const page = await renderInflationProducts("en");
      const find = (node: unknown): Record<string, unknown> | undefined => {
        if (Array.isArray(node)) return node.map(find).find(Boolean);
        if (!isValidElement<Record<string, unknown>>(node)) return undefined;
        if (node.type === JsonLd && node.props.testId === "product-dataset-json-ld") return node.props.data as Record<string, unknown>;
        return find(node.props.children);
      };
      const node = find(page)!;
      expect(node["@type"]).toBe("Dataset");
      expect(node["@id"]).toBe("https://fiscal.ge/en/explorer/inflation/products#dataset");
      expect(JSON.stringify(node)).toContain("Cumulative");
      expect(JSON.stringify(node)).toContain("Geostat");
      expect(node.distribution).toEqual([{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: "https://fiscal.ge/downloads/data/inflation-products.csv" }]);
      expect((node.isBasedOn as string[]).length).toBeGreaterThan(0);
      expect(JSON.stringify(node)).not.toMatch(/\p{Script=Georgian}/u);
    } finally { vi.unstubAllEnvs(); }
  });
});
