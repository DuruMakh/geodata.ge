import type { MetadataRoute } from "next";
import { describe, expect, it, vi } from "vitest";
import { GET } from "../../app/sitemap.xml/route";
import { NAV_GROUPS } from "../../lib/navigation/navTree";
import sitemap, { DATA_TABLES_LIVE_AT, serializeSitemapXml, withDataTablesRelease } from "../../lib/seo/sitemap";

const SITE = "https://fiscal.ge";
const reviewed = (path: string, date: string): MetadataRoute.Sitemap[number] => ({ url: `${SITE}${path}`, lastModified: new Date(date) });

// The release of 2026-11-23 put the data tables into every chart page's HTML and changed no figure (spec §11 of
// docs/superpowers/specs/2026-11-21-ai-readable-data-tables-design.md).
describe("the data tables' release in the sitemap", () => {
  it("is the minute after the release's deployment was ready", () => {
    expect(DATA_TABLES_LIVE_AT.toISOString()).toBe("2026-11-23T16:20:00.000Z");
  });

  it("dates a page that carries the tables, reviewed before the release, by the release, in both languages", () => {
    const dates = withDataTablesRelease([
      reviewed("/explorer/education/schools", "2026-10-16"),
      reviewed("/en/explorer/education/schools", "2026-10-16"),
      reviewed("/explorer/municipalities/region/adjara", "2026-07-26"),
    ]).map((entry) => entry.lastModified);
    expect(dates).toEqual([DATA_TABLES_LIVE_AT, DATA_TABLES_LIVE_AT, DATA_TABLES_LIVE_AT]);
  });

  it("keeps the date of data reviewed after the release", () => {
    const later = [reviewed("/explorer/education/schools", "2027-02-01"), reviewed("/en/explorer/education/schools", "2027-02-01")];
    expect(withDataTablesRelease(later)).toEqual(later);
  });

  it("leaves the pages that carry no data table on their own dates", () => {
    const without = [
      "/", "/about", "/connect", "/explorer", ...NAV_GROUPS.map((group) => group.href),
      "/explorer/analysis", "/explorer/inflation/products", "/methodology", "/methodology/debt",
    ].flatMap((path) => [reviewed(path, "2026-10-16"), reviewed(path === "/" ? "/en" : `/en${path}`, "2026-10-16")]);
    expect(withDataTablesRelease(without)).toEqual(without);
  });

  it("changes nothing in a record but its date", () => {
    const languages = { ka: `${SITE}/explorer/debt`, en: `${SITE}/en/explorer/debt`, "x-default": `${SITE}/explorer/debt` };
    const [entry] = withDataTablesRelease([{ ...reviewed("/explorer/debt", "2026-10-20"), alternates: { languages } }]);
    expect(entry).toEqual({ url: `${SITE}/explorer/debt`, lastModified: DATA_TABLES_LIVE_AT, alternates: { languages } });
  });

  it("is in the published /sitemap.xml, and only on the pages that carry the tables", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
    try {
      const xml = await (await GET()).text();
      const entries = await sitemap();
      expect(xml).toBe(serializeSitemapXml(withDataTablesRelease(entries)));

      const published = new Map([...xml.matchAll(/<loc>([^<]+)<\/loc>\n {4}<lastmod>([^<]+)<\/lastmod>/g)].map((match) => [match[1]!, match[2]!]));
      expect(published.size).toBe(entries.length);
      for (const path of ["/explorer/education/schools", "/en/explorer/education/schools"]) {
        expect(new Date(published.get(`${SITE}${path}`)!).getTime(), path).toBeGreaterThanOrEqual(DATA_TABLES_LIVE_AT.getTime());
      }
      for (const path of ["/explorer/budget", "/en/explorer/budget", "/methodology/debt", "/"]) {
        const dataDate = entries.find((entry) => entry.url === new URL(path, SITE).href)!.lastModified!;
        expect(published.get(new URL(path, SITE).href), path).toBe(new Date(dataDate).toISOString());
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
