import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { JsonLd } from "../../components/seo/json-ld";
import { renderInflationProducts } from "../../lib/pages/inflation-products";

describe("product inflation discovery", () => {
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
