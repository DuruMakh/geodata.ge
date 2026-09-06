import type { MetadataRoute } from "next";
import { describe, expect, it } from "vitest";
import { serializeSitemapXml } from "../../lib/seo/sitemap";

describe("serializeSitemapXml", () => {
  it("adds the browser stylesheet without changing sitemap records", () => {
    const entries: MetadataRoute.Sitemap = [
      {
        url: "https://fiscal.ge/explorer?view=a&sort=b",
        lastModified: new Date("2026-09-06T00:00:00.000Z"),
        alternates: {
          languages: {
            ka: "https://fiscal.ge/explorer?view=a&sort=b",
            en: "https://fiscal.ge/en/explorer?view=a&sort=b",
            "x-default": "https://fiscal.ge/explorer?view=a&sort=b",
          },
        },
      },
    ];

    const xml = serializeSitemapXml(entries);

    expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>');
    expect(xml).toContain("<loc>https://fiscal.ge/explorer?view=a&amp;sort=b</loc>");
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://fiscal.ge/en/explorer?view=a&amp;sort=b" />',
    );
    expect(xml).toContain("<lastmod>2026-09-06T00:00:00.000Z</lastmod>");
  });
});
