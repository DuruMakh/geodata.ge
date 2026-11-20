// apps/web/tests/factQuery/topics/pages.test.ts
import { describe, expect, it } from "vitest";
import { allDataMessages } from "../../../lib/explorer/allDataMessages";
import { buildSearchPages } from "../../../lib/explorer/allDataIndex";
import { CORE_SERVED_PAGES, MCP_SERVED_PAGES } from "../../../lib/factQuery/servedPages";
import { catalogueData } from "../../../lib/factQuery/publications";
import { TOPIC_PAGES, topicDatasetId } from "../../../lib/factQuery/topics/pages";
import { testSnapshot } from "../../helpers/factQuerySnapshot";

describe("TOPIC_PAGES", () => {
  it("lists the 91 chart pages of spec section 3", () => {
    expect(TOPIC_PAGES).toHaveLength(91);
  });
  it("has unique dataset ids that are the page path after /explorer/ with slashes as dashes", () => {
    const ids = TOPIC_PAGES.map((page) => page.datasetId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const page of TOPIC_PAGES) expect(page.datasetId).toBe(topicDatasetId(page.pagePath));
    expect(topicDatasetId("/explorer/education/schools")).toBe("education-schools");
    expect(topicDatasetId("/explorer/expenditure-types")).toBe("expenditure-types");
  });
  // Vocational colleges count calendar years, as their page does (educationPeriodLabel("vocational") is String).
  it("uses school years only for the schools, kindergartens and universities pages", () => {
    const schoolYear = TOPIC_PAGES.filter((page) => page.periodKind === "school_year").map((page) => page.pagePath).sort();
    expect(schoolYear).toEqual(["/explorer/education/kindergartens", "/explorer/education/schools", "/explorer/education/universities"]);
  });
  it("shares no page with the core served pages", () => {
    for (const page of TOPIC_PAGES) expect(Object.hasOwn(CORE_SERVED_PAGES, page.pagePath)).toBe(false);
  });
  it("serves the core pages and every topic page, each topic page with its own dataset", () => {
    expect(MCP_SERVED_PAGES).toEqual({ ...CORE_SERVED_PAGES, ...Object.fromEntries(TOPIC_PAGES.map((page) => [page.pagePath, [page.datasetId]])) });
  });
  it("covers every chart page in the navigation: core pages plus topic pages", async () => {
    const [ka, en] = await Promise.all([allDataMessages("ka"), allDataMessages("en")]);
    // The navigation lists chart pages only (group pages are not NAV_TREE sections); Analysis is not a dataset.
    const chartPages = buildSearchPages([], ka, en).map((page) => page.href).filter((href) => href !== "/explorer/analysis");
    const served = [...Object.keys(CORE_SERVED_PAGES), ...TOPIC_PAGES.map((page) => page.pagePath)];
    expect([...chartPages].sort()).toEqual([...served].sort());
  });
  // The shared snapshot is what the registered adapters build, so a page no adapter builds would be missing from it.
  it("builds every topic page's dataset in the snapshot, once, with series", () => {
    const snapshot = testSnapshot();
    const built = snapshot.topics.datasets.map((dataset) => dataset.page.datasetId);
    expect([...built].sort()).toEqual(TOPIC_PAGES.map((page) => page.datasetId).sort());
    expect(built).toHaveLength(91);
    for (const dataset of snapshot.topics.datasets) expect(dataset.series.length, dataset.page.datasetId).toBeGreaterThan(0);
  });
  it("lists the 102 datasets of the catalogue: 11 core and 91 topic", () => {
    const datasets = catalogueData(testSnapshot()).datasets;
    expect(datasets).toHaveLength(102);
    const topicIds = new Set<string>(TOPIC_PAGES.map((page) => page.datasetId));
    expect(datasets.filter((dataset) => topicIds.has(dataset.datasetId))).toHaveLength(91);
    expect(datasets.filter((dataset) => !topicIds.has(dataset.datasetId))).toHaveLength(11);
  });
});
