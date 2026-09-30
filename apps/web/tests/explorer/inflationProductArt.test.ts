import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { loadProductCatalogueCsv } from "../../lib/data/inflation/importProducts";
import { InflationProductArt, productArtPath } from "../../components/inflation/inflation-product-art";

describe("individual-product artwork", () => {
  it("covers every current product with one transparent, distinct icon", async () => {
    const products = await loadProductCatalogueCsv();
    const dir = path.resolve("public/inflation-products");
    const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".webp"));
    const expected = products.map((row) => `${row.productId.split(".").at(-1)}.webp`).sort();
    expect(files.sort()).toEqual(expected);
    const hashes = new Set<string>();
    for (const file of files) {
      const bytes = await fs.readFile(path.join(dir, file));
      expect(bytes.byteLength).toBeLessThanOrEqual(40_000);
      const metadata = await sharp(bytes).metadata();
      expect(metadata.width).toBeLessThanOrEqual(128);
      expect(metadata.height).toBeLessThanOrEqual(128);
      expect(metadata.hasAlpha).toBe(true);
      const alpha = (await sharp(bytes).stats()).channels[3]!;
      expect(alpha.min).toBe(0);
      expect(alpha.max).toBeGreaterThan(0);
      hashes.add(createHash("sha256").update(bytes).digest("hex"));
    }
    expect(hashes.size).toBe(products.length);
  });

  it("renders small decorative art beside the official product name", () => {
    expect(productArtPath("cpi.product.p0058")).toBe("/inflation-products/p0058.webp");
    const html = renderToStaticMarkup(createElement(InflationProductArt, { productId: "cpi.product.p0058" }));
    expect(html).toContain('alt=""');
    expect(html).toContain("p0058.webp");
    expect(html).not.toMatch(/emoji|fallback|initials/i);
  });
});
