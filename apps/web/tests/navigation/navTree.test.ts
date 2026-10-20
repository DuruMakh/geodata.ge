import { describe, expect, it } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import { NAV_TREE, currentEntry, isActivePath, openHub, sourceNoteKey } from "../../lib/navigation/navTree";

describe("the navigation tree", () => {
  it("marks the hub on its own page and a row on its page and the pages below it", () => {
    expect(currentEntry("/explorer")).toBe("/explorer");
    expect(currentEntry("/explorer/expenditure")).toBe("/explorer/expenditure");
    expect(currentEntry("/explorer/municipalities/region/kakheti")).toBe("/explorer/municipalities");
    expect(currentEntry("/explorer/wages")).toBe("/explorer/wages");
    expect(currentEntry("/explorer/wages/regions/adjara")).toBe("/explorer/wages/regions");
  });

  it("opens the hub a page sits under and Budget for the budget sections", () => {
    expect(openHub("/explorer").href).toBe("/explorer");
    expect(openHub("/explorer/municipalities/region/kakheti").href).toBe("/explorer");
    expect(openHub("/explorer/deficit").href).toBe("/explorer");
    expect(openHub("/explorer/economy/regions/adjara").href).toBe("/explorer/economy");
    expect(openHub("/explorer/external/money-from-abroad").href).toBe("/explorer/external");
    expect(openHub("/explorer/business/regions/guria").href).toBe("/explorer/business");
    expect(currentEntry("/explorer/business/regions/guria")).toBe("/explorer/business/regions");
    expect(openHub("/explorer/housing/regions/guria").href).toBe("/explorer/housing");
    expect(currentEntry("/explorer/housing/regions/guria")).toBe("/explorer/housing/regions");
    expect(openHub("/explorer/demography/population/region/imereti").href).toBe("/explorer/demography");
    expect(openHub("/explorer/education/schools/region/guria").href).toBe("/explorer/education");
    expect(currentEntry("/explorer/education/schools/region/guria")).toBe("/explorer/education/schools");
    expect(currentEntry("/explorer/education/kindergartens/ozurgeti")).toBe("/explorer/education/kindergartens");
    expect(currentEntry("/explorer/education")).toBe("/explorer/education");
    expect(openHub("/explorer/science-culture/museums/guria").href).toBe("/explorer/science-culture");
    expect(currentEntry("/explorer/science-culture/museums/guria")).toBe("/explorer/science-culture/museums");
  });

  it("places Science and culture after Education with its four pages", () => {
    const hubs = NAV_TREE.map((hub) => hub.href);
    expect(hubs.indexOf("/explorer/science-culture")).toBe(hubs.indexOf("/explorer/education") + 1);
    const hub = NAV_TREE.find((entry) => entry.href === "/explorer/science-culture")!;
    expect(hub).toMatchObject({ labelKey: "common.scienceCulture", railLabelKey: "common.dataScienceCulture", testId: "science-culture-link" });
    expect(hub.sections.map((section) => [section.href, section.testId])).toEqual(["research", "patents", "museums", "theatres"].map((id) => [`/explorer/science-culture/${id}`, `science-culture-${id}-link`]));
  });

  it("places Education after Health with its four pages", () => {
    const hubs = NAV_TREE.map((hub) => hub.href);
    expect(hubs.indexOf("/explorer/education")).toBe(hubs.indexOf("/explorer/health") + 1);
    const hub = NAV_TREE.find((entry) => entry.href === "/explorer/education")!;
    expect(hub).toMatchObject({ labelKey: "common.education", railLabelKey: "common.dataEducation", testId: "education-link" });
    expect(hub.sections.map((section) => [section.href, section.testId])).toEqual([
      ["/explorer/education/schools", "education-schools-link"],
      ["/explorer/education/kindergartens", "education-kindergartens-link"],
      ["/explorer/education/universities", "education-universities-link"],
      ["/explorer/education/vocational", "education-vocational-link"],
    ]);
  });

  it("lists the four social protection pages under Health, after Causes of death", () => {
    const hub = NAV_TREE.find((entry) => entry.href === "/explorer/health")!;
    expect(hub.sections.map((section) => [section.href, section.testId])).toEqual([
      ["/explorer/health/doctors-hospitals", "health-doctors-hospitals-link"],
      ["/explorer/health/illnesses", "health-illnesses-link"],
      ["/explorer/health/causes-of-death", "health-causes-of-death-link"],
      ["/explorer/health/social-payments", "health-social-payments-link"],
      ["/explorer/health/pensions", "health-pensions-link"],
      ["/explorer/health/subsistence-allowance", "health-subsistence-allowance-link"],
      ["/explorer/health/social-package", "health-social-package-link"],
    ]);
    expect(openHub("/explorer/health/pensions/region/guria")).toBe(hub);
    expect(currentEntry("/explorer/health/pensions/region/guria")).toBe("/explorer/health/pensions");
    expect(currentEntry("/explorer/health/subsistence-allowance/ozurgeti")).toBe("/explorer/health/subsistence-allowance");
    expect(currentEntry("/explorer/health/social-package")).toBe("/explorer/health/social-package");
  });

  it("appends Trade composition after the five existing Trade pages", () => {
    const hub = NAV_TREE.find((entry) => entry.href === "/explorer/trade")!;
    expect(hub.sections.map((section) => section.href)).toEqual([
      "/explorer/trade/overview",
      "/explorer/trade/partners",
      "/explorer/trade/products",
      "/explorer/trade/domestic-exports",
      "/explorer/trade/services",
      "/explorer/trade/composition",
    ]);
    expect(hub.sections.at(-1)).toMatchObject({ labelKey: "common.tradeComposition", testId: "trade-composition-link" });
    expect(openHub("/explorer/trade/composition")).toBe(hub);
    expect(currentEntry("/explorer/trade/composition")).toBe("/explorer/trade/composition");
    expect(sourceNoteKey("/explorer/trade/composition")).toBe("common.geostatSourceNote");
  });

  it("places Housing and construction directly after Business, with its four pages", () => {
    const hubs = NAV_TREE.map((hub) => hub.href);
    expect(hubs.indexOf("/explorer/housing")).toBe(hubs.indexOf("/explorer/business") + 1);
    const hub = NAV_TREE.find((entry) => entry.href === "/explorer/housing")!;
    expect(hub).toMatchObject({ labelKey: "common.housing", railLabelKey: "common.dataHousing", testId: "housing-link" });
    expect(hub.sections.map((section) => [section.href, section.testId])).toEqual(["permits", "completed", "prices", "regions"].map((id) => [`/explorer/housing/${id}`, `housing-${id}-link`]));
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
    expect(sourceNoteKey("/explorer/business")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/business/regions/guria")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/housing/prices")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/housing/regions/guria")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/external")).toBe("common.externalHubSourceNote");
    expect(sourceNoteKey("/explorer/external/current-account")).toBe("common.nbgSourceNote");
    expect(sourceNoteKey("/explorer/external/foreign-debt")).toBe("common.nbgSourceNote");
    expect(sourceNoteKey("/explorer/external/reserves")).toBe("common.nbgSourceNote");
    expect(sourceNoteKey("/explorer/external/foreign-investment")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/demography/population/region/imereti")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/education")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/education/schools/batumi")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/health")).toBe("common.socialSourceNote");
    expect(sourceNoteKey("/explorer/health/illnesses")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/health/social-payments")).toBe("common.socialSourceNote");
    expect(sourceNoteKey("/explorer/health/pensions/region/guria")).toBe("common.socialSourceNote");
    expect(sourceNoteKey("/explorer/science-culture")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/science-culture/museums/guria")).toBe("common.geostatSourceNote");
  });
});
