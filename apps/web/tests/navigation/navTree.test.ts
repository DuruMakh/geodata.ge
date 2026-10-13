import { afterEach, describe, expect, it } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import sitemap from "../../lib/seo/sitemap";
import { splitLanguagePath } from "../../lib/i18n/routes";
import { NAV_TREE, isActivePath, openHub, sourceNoteKey } from "../../lib/navigation/navTree";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

/** Every explorer page the sitemap publishes, Georgian and English, as the sidebar sees it (language prefix removed). */
async function explorerRoutes(): Promise<string[]> {
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  return (await sitemap())
    .map((entry) => splitLanguagePath(new URL(entry.url).pathname).pathname)
    .filter((pathname) => isActivePath(pathname, "/explorer"));
}

describe("the navigation tree", () => {
  it("gives every sitemap explorer route exactly one active entry, inside the hub it opens", async () => {
    const routes = await explorerRoutes();
    expect(routes.length).toBeGreaterThan(500);
    for (const route of routes) {
      // aria-current: a hub on its own page, a section row on its page and the pages below it.
      const active = NAV_TREE.flatMap((hub) => [
        ...(hub.href === route ? [hub.href] : []),
        ...hub.sections.filter((section) => isActivePath(route, section.href)).map((section) => section.href),
      ]);
      expect(active, route).toHaveLength(1);
      const hub = openHub(route);
      expect([hub.href, ...hub.sections.map((section) => section.href)], route).toContain(active[0]);
    }
  });

  it("opens the hub a page sits under and Budget for the budget sections", () => {
    expect(openHub("/explorer").href).toBe("/explorer");
    expect(openHub("/explorer/municipalities/region/kakheti").href).toBe("/explorer");
    expect(openHub("/explorer/deficit").href).toBe("/explorer");
    expect(openHub("/explorer/economy/regions/adjara").href).toBe("/explorer/economy");
    expect(openHub("/explorer/external/money-from-abroad").href).toBe("/explorer/external");
    expect(openHub("/explorer/demography/population/region/imereti").href).toBe("/explorer/demography");
  });

  it("matches a row's own page and the pages below it, not a sibling that shares its start", () => {
    expect(isActivePath("/explorer/wages/regions", "/explorer/wages/regions")).toBe(true);
    expect(isActivePath("/explorer/wages/regions/adjara", "/explorer/wages/regions")).toBe(true);
    expect(isActivePath("/explorer/money-supply", "/explorer/money")).toBe(false);
  });

  it("names every label in Georgian and English and gives each row its own test id", () => {
    const keys = NAV_TREE.flatMap((hub) => [hub.labelKey, hub.railLabelKey, ...hub.sections.map((section) => section.labelKey)]);
    for (const key of keys) {
      expect((kaCommon as Record<string, string>)[key], key).toBeTruthy();
      expect((enCommon as Record<string, string>)[key], key).toBeTruthy();
    }
    const testIds = NAV_TREE.flatMap((hub) => [hub.testId, ...hub.sections.map((section) => section.testId)]).filter(Boolean);
    expect(new Set(testIds).size).toBe(testIds.length);
  });
});

describe("the explorer footer source note", () => {
  it("picks a page's own note, else the longest address it sits under", () => {
    expect(sourceNoteKey("/explorer")).toBe("common.budgetHubSourceNote");
    expect(sourceNoteKey("/explorer/expenditure")).toBe("common.budgetStatisticsSourceNote");
    expect(sourceNoteKey("/explorer/municipalities")).toBe("common.budgetStatisticsSourceNote");
    expect(sourceNoteKey("/explorer/municipalities/region/kakheti")).toBe("common.budgetSourceNote");
    expect(sourceNoteKey("/explorer/analysis")).toBe("common.budgetSourceNote");
    expect(sourceNoteKey("/explorer/deficit")).toBe("common.deficitSourceNote");
    expect(sourceNoteKey("/explorer/economy")).toBe("common.economySourceNote");
    expect(sourceNoteKey("/explorer/economy/gdp")).toBe("common.economySourceNote");
    expect(sourceNoteKey("/explorer/economy/sectors")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/economy/regions/adjara")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/inflation/cities/batumi")).toBe("common.inflationSourceNote");
    expect(sourceNoteKey("/explorer/inflation/products")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/money/supply")).toBe("common.nbgSourceNote");
    expect(sourceNoteKey("/explorer/external")).toBe("common.externalHubSourceNote");
    expect(sourceNoteKey("/explorer/external/current-account")).toBe("common.nbgSourceNote");
    expect(sourceNoteKey("/explorer/external/foreign-investment")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/demography/population/region/imereti")).toBe("common.geostatSourceNote");
  });

  it("resolves to a note in both languages on every sitemap explorer route", async () => {
    for (const route of await explorerRoutes()) {
      const key = sourceNoteKey(route);
      expect((kaCommon as Record<string, string>)[key], route).toBeTruthy();
      expect((enCommon as Record<string, string>)[key], route).toBeTruthy();
    }
  });
});
