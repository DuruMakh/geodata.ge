import { describe, expect, it } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import kaGroups from "../../lib/i18n/messages/ka/groups.json";
import enGroups from "../../lib/i18n/messages/en/groups.json";
import kaAllData from "../../lib/i18n/messages/ka/allData.json";
import enAllData from "../../lib/i18n/messages/en/allData.json";
import {
  ALL_DATA_PATH, LEGACY_TOPIC_FORWARDS, NAV_GROUPS, NAV_TREE, PAGE_COUNT, currentEntry, currentGroup, groupOfTopic, groupPages, isActivePath, openHub, sourceNoteKey, topicHub,
} from "../../lib/navigation/navTree";

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
    expect(openHub("/explorer/transport/regions/guria").href).toBe("/explorer/transport");
    expect(currentEntry("/explorer/transport/regions/guria")).toBe("/explorer/transport/regions");
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

  it("places Transport directly after Environment and climate, with its five pages", () => {
    const hubs = NAV_TREE.map((hub) => hub.href);
    expect(hubs.indexOf("/explorer/transport")).toBe(hubs.indexOf("/explorer/environment") + 1);
    const hub = NAV_TREE.find((entry) => entry.href === "/explorer/transport")!;
    expect(hub).toMatchObject({ labelKey: "common.transport", railLabelKey: "common.dataTransport", testId: "transport-link" });
    expect(hub.sections.map((section) => [section.href, section.testId])).toEqual(["vehicles", "vehicle-age", "passengers", "freight", "regions"].map((id) => [`/explorer/transport/${id}`, `transport-${id}-link`]));
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
    expect(sourceNoteKey("/explorer")).toBe("common.sourceNote.allData");
    expect(sourceNoteKey("/explorer/expenditure")).toBe("common.budgetStatisticsSourceNote");
    expect(sourceNoteKey("/explorer/municipalities")).toBe("common.budgetStatisticsSourceNote");
    expect(sourceNoteKey("/explorer/municipalities/region/kakheti")).toBe("common.budgetSourceNote");
    expect(sourceNoteKey("/explorer/analysis")).toBe("common.budgetSourceNote");
    expect(sourceNoteKey("/explorer/deficit")).toBe("common.deficitSourceNote");
    expect(sourceNoteKey("/explorer/economy")).toBe("common.sourceNote.group.economy");
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
    expect(sourceNoteKey("/explorer/transport/freight")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/transport/regions/guria")).toBe("common.geostatSourceNote");
    expect(sourceNoteKey("/explorer/external")).toBe("common.sourceNote.group.external");
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

describe("the eight groups over the twenty topics", () => {
  const ka = kaCommon as Record<string, string>;
  const en = enCommon as Record<string, string>;

  it("lists the groups in the approved order", () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual(["budget", "economy", "prices", "labour", "living", "external", "demography", "society"]);
    expect(NAV_GROUPS.map((group) => group.href)).toEqual(["budget", "economy", "prices", "labour", "living", "external", "demography", "society"].map((id) => `/explorer/${id}`));
    expect(NAV_GROUPS.map((group) => group.topics)).toEqual([
      ["budget"],
      ["economy", "business", "housing"],
      ["inflation", "money"],
      ["unemployment", "wages"],
      ["living-standards", "health"],
      ["trade", "external"],
      ["demography"],
      ["education", "science-culture", "crime", "internet", "energy-food", "environment", "transport"],
    ]);
    expect(ALL_DATA_PATH).toBe("/explorer");
  });

  it("puts every topic in exactly one group", () => {
    const ids = NAV_TREE.map((hub) => hub.id);
    expect(new Set(ids).size).toBe(20);
    expect(NAV_GROUPS.flatMap((group) => group.topics).toSorted()).toEqual(ids.toSorted());
    for (const hub of NAV_TREE) expect(groupOfTopic(hub.id).topics).toContain(hub.id);
    expect(topicHub("wages").href).toBe("/explorer/wages");
    expect(topicHub("budget").href).toBe("/explorer");
  });

  it("counts the pages per group from the config", () => {
    expect(NAV_GROUPS.map((group) => groupPages(group).length)).toEqual([7, 13, 8, 11, 11, 11, 5, 34]);
    expect(PAGE_COUNT).toBe(100);
    expect(NAV_GROUPS.flatMap(groupPages).map((section) => section.href).toSorted()).toEqual(NAV_TREE.flatMap((hub) => hub.sections.map((section) => section.href)).toSorted());
  });

  it("finds the group of a page: its own page, else the group of the open hub", () => {
    expect(currentGroup("/explorer")).toBeNull();
    expect(currentGroup("/explorer/labour")?.id).toBe("labour");
    expect(currentGroup("/explorer/wages/regions/adjara")?.id).toBe("labour");
    expect(currentGroup("/explorer/deficit")?.id).toBe("budget");
    expect(currentGroup("/explorer/economy")?.id).toBe("economy");
    expect(currentGroup("/explorer/prices")?.id).toBe("prices");
    expect(currentGroup("/explorer/living")?.id).toBe("living");
    expect(currentGroup("/explorer/living-standards/income")?.id).toBe("living");
    expect(currentGroup("/explorer/transport/regions/guria")?.id).toBe("society");
  });

  it("forwards sixteen old topic addresses to their group section", () => {
    expect(LEGACY_TOPIC_FORWARDS).toHaveLength(16);
    expect(LEGACY_TOPIC_FORWARDS).toContainEqual({ topic: "wages", from: "/explorer/wages", to: "/explorer/labour?topic=wages" });
    expect(LEGACY_TOPIC_FORWARDS).toContainEqual({ topic: "living-standards", from: "/explorer/living-standards", to: "/explorer/living?topic=living-standards" });
    expect(LEGACY_TOPIC_FORWARDS.map((row) => row.topic)).not.toEqual(expect.arrayContaining(["budget"]));
    for (const topic of ["budget", "economy", "external", "demography"]) expect(LEGACY_TOPIC_FORWARDS.some((row) => row.topic === topic)).toBe(false);
    for (const { topic, from, to } of LEGACY_TOPIC_FORWARDS) {
      expect(from).toBe(topicHub(topic).href);
      expect(to).toBe(`${groupOfTopic(topic).href}?topic=${topic}`);
    }
  });

  it("names every group and topic in Georgian and English", () => {
    for (const group of NAV_GROUPS) {
      expect(group.labelKey).toBe(`common.group.${group.id}`);
      expect(ka[group.labelKey], group.labelKey).toBeTruthy();
      expect(en[group.labelKey], group.labelKey).toBeTruthy();
    }
    for (const hub of NAV_TREE) {
      expect(ka[`common.topic.${hub.id}`], hub.id).toBeTruthy();
      expect(en[`common.topic.${hub.id}`], hub.id).toBeTruthy();
    }
  });

  it("gives every group and All data a source note in both languages", () => {
    for (const group of NAV_GROUPS) {
      expect(sourceNoteKey(group.href)).toBe(`common.sourceNote.group.${group.id}`);
      expect(ka[`common.sourceNote.group.${group.id}`]).toBeTruthy();
      expect(en[`common.sourceNote.group.${group.id}`]).toBeTruthy();
    }
    expect(ka["common.sourceNote.allData"]).toBeTruthy();
    expect(en["common.sourceNote.allData"]).toBeTruthy();
  });
});

describe("the group and All data messages", () => {
  const pageKeys = NAV_TREE.flatMap((hub) => hub.sections.map((section) => section.href.replace("/explorer/", "").replaceAll("/", ".")));

  it("give every group a line, a title and a description, and every topic but Budget and Demography a line", () => {
    for (const messages of [kaGroups, enGroups] as Record<string, string>[]) {
      for (const group of NAV_GROUPS) {
        for (const key of [`groups.line.${group.id}`, `groups.metaTitle.${group.id}`, `groups.metaDescription.${group.id}`]) expect(messages[key], key).toBeTruthy();
      }
      for (const hub of NAV_TREE) expect(Boolean(messages[`groups.topicLine.${hub.id}`]), hub.id).toBe(hub.id !== "budget" && hub.id !== "demography");
    }
  });

  it("keep the search words only for real pages, with English words free of Georgian", () => {
    const wordKeys = Object.keys(kaAllData).filter((key) => key.startsWith("allData.words."));
    expect(wordKeys.length).toBeGreaterThan(0);
    expect(Object.keys(enAllData).filter((key) => key.startsWith("allData.words.")).toSorted()).toEqual(wordKeys.toSorted());
    for (const key of wordKeys) {
      expect(pageKeys, key).toContain(key.replace("allData.words.", ""));
      expect((enAllData as Record<string, string>)[key]).not.toMatch(/\p{Script=Georgian}/u);
    }
  });

  it("carry the example words and the plural-safe page count", () => {
    expect([1, 2, 3, 4, 5].map((n) => (kaAllData as Record<string, string>)[`allData.chip.${n}`])).toEqual(["ბათუმი", "ინფლაცია", "ხელფასები", "მშპ", "NEET"]);
    expect([1, 2, 3, 4, 5].map((n) => (enAllData as Record<string, string>)[`allData.chip.${n}`])).toEqual(["Batumi", "inflation", "wages", "GDP", "xelfasebi"]);
    expect((enCommon as Record<string, string>)["common.pagesCount"]).toBe("{n} pages");
    expect((enCommon as Record<string, string>)["common.pagesCountOne"]).toBe("{n} page");
  });
});
