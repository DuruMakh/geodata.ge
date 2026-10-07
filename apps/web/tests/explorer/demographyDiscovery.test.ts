import { describe, expect, it, vi } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { populationPlacePaths } from "../../lib/explorer/demographyPlaceRoutes";
import { DEMOGRAPHY_PAGES } from "../../lib/explorer/demographyRoutes";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { loadPageRevisions } from "../../lib/i18n/page-revisions.server";
import sitemap from "../../lib/seo/sitemap";

const PAGES = ["/explorer/demography", "/explorer/demography/population", "/methodology/demography"] as const;

describe("demography discovery", () => {
  it("indexes the hub, the live page and the methodology in both languages with real English dates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, revisions, entries] = await Promise.all([listPublicPagePaths(), loadPageRevisions(), sitemap()]);
      for (const path of PAGES) {
        expect(paths).toContain(path);
        expect(revisions[path]).toMatch(/^2026-\d{2}-\d{2}$/);
        const ka = entries.find((entry) => entry.url === `https://fiscal.ge${path}`);
        const en = entries.find((entry) => entry.url === `https://fiscal.ge/en${path}`);
        expect(ka?.alternates?.languages).toEqual({
          ka: `https://fiscal.ge${path}`,
          en: `https://fiscal.ge/en${path}`,
          "x-default": `https://fiscal.ge${path}`,
        });
        expect(en?.alternates).toEqual(ka?.alternates);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("indexes all 75 place pages in both languages with real English dates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [{ regions }, paths, revisions, entries] = await Promise.all([loadServedMunicipalData(), listPublicPagePaths(), loadPageRevisions(), sitemap()]);
      const placePaths = populationPlacePaths(regions.map((region) => region.id));
      expect(placePaths).toHaveLength(75);
      for (const path of placePaths) {
        expect(paths, path).toContain(path);
        expect(revisions[path], path).toMatch(/^2026-\d{2}-\d{2}$/);
        const ka = entries.find((entry) => entry.url === `https://fiscal.ge${path}`);
        const en = entries.find((entry) => entry.url === `https://fiscal.ge/en${path}`);
        expect(ka?.alternates?.languages, path).toEqual({ ka: `https://fiscal.ge${path}`, en: `https://fiscal.ge/en${path}`, "x-default": `https://fiscal.ge${path}` });
        expect(en?.alternates, path).toEqual(ka?.alternates);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("lists no page that is not live", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, entries] = await Promise.all([listPublicPagePaths(), sitemap()]);
      // Built from the routes module, the one place that says which pages are live. With every page live there is
      // nothing to exclude, and an empty pattern would match every path, so then the pattern matches nothing.
      const notLivePaths = DEMOGRAPHY_PAGES.filter((page) => !page.live).map((page) => page.path);
      const notLive = notLivePaths.length > 0 ? new RegExp(notLivePaths.join("|")) : /(?!)/;
      expect(paths.some((path) => notLive.test(path))).toBe(false);
      expect(entries.some((entry) => notLive.test(entry.url))).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("dates the Georgian pages by the latest review of the figures they show", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [entries, { facts }] = await Promise.all([sitemap(), loadServedDemographyData()]);
      // The served rows come from two files, population and density, reviewed on different days. The pages show
      // both, so the date is the latest over every row of both, read from the facts as the economy pages' test does.
      const latest = (rows: readonly { lastReviewedAt: string }[]) => rows.map((row) => row.lastReviewedAt).sort().at(-1);
      for (const path of ["/explorer/demography", "/explorer/demography/population", "/explorer/demography/population/batumi"]) {
        const entry = entries.find((candidate) => candidate.url === `https://fiscal.ge${path}`);
        expect(new Date(entry!.lastModified!).toISOString().slice(0, 10)).toBe(latest(facts));
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
