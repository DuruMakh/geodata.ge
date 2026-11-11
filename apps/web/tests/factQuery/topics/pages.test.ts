// apps/web/tests/factQuery/topics/pages.test.ts
import { describe, expect, it } from "vitest";
import { allDataMessages } from "../../../lib/explorer/allDataMessages";
import { buildSearchPages } from "../../../lib/explorer/allDataIndex";
import { CORE_SERVED_PAGES, MCP_SERVED_PAGES } from "../../../lib/factQuery/servedPages";
import { TOPIC_PAGES, topicDatasetId } from "../../../lib/factQuery/topics/pages";

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
  it("uses school years only for the four education pages", () => {
    const schoolYear = TOPIC_PAGES.filter((page) => page.periodKind === "school_year").map((page) => page.pagePath).sort();
    expect(schoolYear).toEqual(["/explorer/education/kindergartens", "/explorer/education/schools", "/explorer/education/universities", "/explorer/education/vocational"]);
  });
  it("shares no page with the core served pages", () => {
    for (const page of TOPIC_PAGES) expect(Object.hasOwn(CORE_SERVED_PAGES, page.pagePath)).toBe(false);
  });
  it("leaves MCP_SERVED_PAGES as the core pages until the topic adapters are wired in", () => {
    expect(MCP_SERVED_PAGES).toBe(CORE_SERVED_PAGES);
  });
  it("covers every chart page in the navigation: core pages plus topic pages", async () => {
    const [ka, en] = await Promise.all([allDataMessages("ka"), allDataMessages("en")]);
    // The navigation lists chart pages only (group pages are not NAV_TREE sections); Analysis is not a dataset.
    const chartPages = buildSearchPages([], ka, en).map((page) => page.href).filter((href) => href !== "/explorer/analysis");
    const served = [...Object.keys(CORE_SERVED_PAGES), ...TOPIC_PAGES.map((page) => page.pagePath)];
    expect([...chartPages].sort()).toEqual([...served].sort());
  });
});
