import { beforeAll, expect, test } from "vitest";
import { loadBusinessFacts, toClientBusinessFact } from "../../lib/data/business/importBusiness";
import { BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_REGIONS, BUSINESS_SIZES, BUSINESS_SURVEY_SECTORS, type ClientBusinessFact } from "../../lib/data/business/types";
import { INK, OTHER_COLOR } from "../../lib/explorer/colors";
import {
  BUSINESS_HUB_PATH, BUSINESS_SECTIONS, buildBusinessModel, businessCoverage, businessDefaultSelection, businessSeriesColor, businessViews, businessViewSeries,
  changeBusinessView, defaultBusinessState, parseBusinessHash, serializeBusinessHash, type BusinessTopicId,
} from "../../lib/explorer/business";
import {
  BUSINESS_AREAS, buildBusinessAreaModel, businessAreaCoverage, businessAreaDefaultSelection, businessAreaHref, businessAreaSeries,
  businessMapHash, changeBusinessAreaMeasure, parseBusinessAreaHash, serializeBusinessAreaHash,
} from "../../lib/explorer/businessAreas";
import { buildBusinessRegionMapModel } from "../../lib/explorer/businessRegionMap";

let facts: ClientBusinessFact[];
beforeAll(async () => { facts = (await loadBusinessFacts()).map(toClientBusinessFact); });
const span = (coverage: { min: number; max: number }) => [coverage.min, coverage.max];
const TOPICS: readonly BusinessTopicId[] = ["sales", "jobs", "investment-profit", "firms"];

test("the hub lists four topic pages and the regions page", () => {
  expect(BUSINESS_HUB_PATH).toBe("/explorer/business");
  expect(BUSINESS_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["sales", "/explorer/business/sales", "common.businessSales"],
    ["jobs", "/explorer/business/jobs", "common.businessJobs"],
    ["investment-profit", "/explorer/business/investment-profit", "common.businessInvestmentProfit"],
    ["firms", "/explorer/business/firms", "common.businessFirms"],
    ["regions", "/explorer/business/regions", "common.businessRegions"],
  ]);
  expect(businessViews("firms")).toEqual(["count", "rate"]);
  for (const section of ["sales", "jobs", "investment-profit"] as const) expect(businessViews(section)).toEqual(["main"]);
});

test("each topic page starts on its default selection, with coverage from the facts", () => {
  expect(defaultBusinessState("sales")).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["business.turnover.total"] });
  expect(defaultBusinessState("jobs").selectedIds).toEqual(["business.employed.total"]);
  expect(defaultBusinessState("investment-profit").selectedIds).toEqual(["business.investment.total"]);
  expect(defaultBusinessState("firms")).toEqual({ mode: "line", range: { kind: "all" }, view: "count", selectedIds: ["business.births.total", "business.deaths.total"] });
  expect(businessDefaultSelection("firms", "rate")).toEqual(["business.birth_rate.total", "business.death_rate.total"]);
  expect(span(businessCoverage("sales", "main", facts))).toEqual([1999, 2025]);
  expect(span(businessCoverage("jobs", "main", facts))).toEqual([1999, 2025]);
  expect(span(businessCoverage("investment-profit", "main", facts))).toEqual([2006, 2025]);
  expect(span(businessCoverage("firms", "count", facts))).toEqual([2014, 2024]);
  expect(span(businessCoverage("firms", "rate", facts))).toEqual([2014, 2024]);
});

test("Sales and Jobs list the total, then three sizes and fourteen industries under their headings, all top-level", () => {
  for (const [section, measure] of [["sales", "turnover"], ["jobs", "employed"]] as const) {
    const series = businessViewSeries(section, "main");
    expect(series).toHaveLength(18);
    expect(series.every(s => s.parentId === undefined)).toBe(true);
    expect(series[0]).toEqual({ id: `business.${measure}.total`, reference: true });
    expect(series.slice(1).map(s => [s.id, s.heading, s.reference])).toEqual([
      ...BUSINESS_SIZES.map(group => [`business.${measure}.${group}`, "size", false]),
      ...BUSINESS_SURVEY_SECTORS.map(group => [`business.${measure}.${group}`, "industry", false]),
    ]);
  }
});

test("Investment and profit nests sizes and industries under investment, profit and loss", () => {
  const series = businessViewSeries("investment-profit", "main");
  const parents = series.filter(s => !s.parentId);
  expect(parents.map(s => [s.id, s.reference])).toEqual([["business.investment.total", true], ["business.profit.total", false], ["business.loss.total", false]]);
  for (const parent of parents) {
    const measure = parent.id.split(".")[1];
    expect(series.filter(s => s.parentId === parent.id).map(s => s.id)).toEqual([...BUSINESS_SIZES, ...BUSINESS_SURVEY_SECTORS].map(group => `business.${measure}.${group}`));
  }
  expect(series).toHaveLength(3 + 3 * 17);
});

test("Firms nests 18 sections and the unknown activity under each count, and only the 18 sections under each rate", () => {
  const count = businessViewSeries("firms", "count");
  expect(count.filter(s => !s.parentId).map(s => s.id)).toEqual(["business.active.total", "business.births.total", "business.deaths.total"]);
  expect(count.every(s => !s.reference)).toBe(true);
  for (const measure of ["active", "births", "deaths"]) {
    expect(count.filter(s => s.parentId === `business.${measure}.total`).map(s => s.id)).toEqual([...BUSINESS_DEMOGRAPHY_SECTORS, "sector_unknown"].map(group => `business.${measure}.${group}`));
  }
  expect(count).toHaveLength(3 + 3 * 19);
  const rate = businessViewSeries("firms", "rate");
  expect(rate.filter(s => !s.parentId).map(s => s.id)).toEqual(["business.birth_rate.total", "business.death_rate.total"]);
  for (const measure of ["birth_rate", "death_rate"]) {
    expect(rate.filter(s => s.parentId === `business.${measure}.total`).map(s => s.id)).toEqual(BUSINESS_DEMOGRAPHY_SECTORS.map(group => `business.${measure}.${group}`));
  }
  expect(rate).toHaveLength(2 + 2 * 18);
});

test("switching the firms measure carries new and closed firms to their rates and back, drops active firms, and refits the years", () => {
  const count = (selectedIds: string[]) => ({ ...defaultBusinessState("firms"), selectedIds });
  const toRate = changeBusinessView(count(["business.active.total", "business.births.sector_c"]), "firms", "rate", facts);
  expect(toRate).toMatchObject({ view: "rate", selectedIds: ["business.birth_rate.sector_c"] });
  expect(changeBusinessView(count(["business.active.total"]), "firms", "rate", facts).selectedIds).toEqual(["business.birth_rate.total", "business.death_rate.total"]);
  // The unknown activity has no rate listed, so it drops like active firms.
  expect(changeBusinessView(count(["business.births.sector_unknown"]), "firms", "rate", facts).selectedIds).toEqual(["business.birth_rate.total", "business.death_rate.total"]);
  expect(changeBusinessView(count(["business.deaths.total", "business.births.sector_unknown"]), "firms", "rate", facts).selectedIds).toEqual(["business.death_rate.total"]);
  expect(changeBusinessView(toRate, "firms", "count", facts)).toMatchObject({ view: "count", selectedIds: ["business.births.sector_c"] });
  const ranged = { ...count(["business.births.total"]), range: { kind: "manual" as const, start: 2010, end: 2020 } };
  expect(changeBusinessView(ranged, "firms", "rate", facts).range).toEqual({ kind: "manual", start: 2014, end: 2020 });
});

test("the topic hash round-trips, keeps an explicit empty selection, and only firms writes a tab", () => {
  for (const section of TOPICS) {
    const state = { ...defaultBusinessState(section), mode: "table" as const, selectedIds: [] };
    const hash = serializeBusinessHash(state, section);
    expect(hash.includes("sel=&") || hash.endsWith("sel=")).toBe(true);
    expect(new URLSearchParams(hash).has("tab")).toBe(section === "firms");
    expect(parseBusinessHash(`#${hash}`, section, facts)).toEqual(state);
  }
  const rate = { ...defaultBusinessState("firms"), view: "rate" as const, selectedIds: ["business.death_rate.sector_g"], range: { kind: "manual" as const, start: 2015, end: 2022 } };
  expect(parseBusinessHash(`#${serializeBusinessHash(rate, "firms")}`, "firms", facts)).toEqual(rate);
  expect(parseBusinessHash("", "firms", facts)).toEqual(defaultBusinessState("firms"));
  expect(parseBusinessHash("#tab=rate", "sales", facts)).toEqual(defaultBusinessState("sales"));
});

test("the topic models carry the published values, the unit and gaps as null, and never a region", () => {
  const sales = buildBusinessModel("sales", facts, defaultBusinessState("sales"));
  expect(sales.unit).toBe("gel");
  expect(sales.series[0].valuesByYear[2025]).toBe(253725500000);
  expect(sales.selected.map(s => s.id)).toEqual(["business.turnover.total"]);
  expect(sales.years[0]).toBe(1999);
  for (const section of TOPICS) for (const view of businessViews(section)) {
    const model = buildBusinessModel(section, facts, { ...defaultBusinessState(section), view });
    expect(model.series.some(s => /\.region_/.test(s.id))).toBe(false);
  }
  expect(buildBusinessModel("jobs", facts, defaultBusinessState("jobs")).unit).toBe("persons");
  expect(buildBusinessModel("firms", facts, defaultBusinessState("firms")).unit).toBe("enterprises");
  // Geostat prints "…" for section death rates in 2016 and 2019: those years are null, never zero, while the total has a value.
  const rate = buildBusinessModel("firms", facts, { ...defaultBusinessState("firms"), view: "rate" });
  expect(rate.unit).toBe("percent");
  const total = rate.series.find(s => s.id === "business.death_rate.total")!, section = rate.series.find(s => s.id === "business.death_rate.sector_c")!;
  for (const year of [2016, 2019]) { expect(section.valuesByYear[year]).toBeNull(); expect(total.valuesByYear[year]).not.toBeNull(); }
  expect(section.valuesByYear[2015]).not.toBeNull();
});

test("an industry wears its economic-sector colour under every parent; the unknown activity wears the other colour", () => {
  const color = (section: BusinessTopicId, view: "main" | "count" | "rate", id: string) => {
    const series = businessViewSeries(section, view), index = series.findIndex(s => s.id === id);
    return businessSeriesColor(series[index], index);
  };
  // The colour follows the section, not the measure or the position in the list.
  expect(businessSeriesColor({ id: "business.turnover.sector_c", reference: false }, 0)).toBe(color("firms", "count", "business.births.sector_c"));
  expect(color("firms", "count", "business.births.sector_c")).toBe(color("firms", "count", "business.deaths.sector_c"));
  expect(color("firms", "count", "business.births.sector_c")).toBe(color("firms", "rate", "business.birth_rate.sector_c"));
  // The survey's combined B–E group wears manufacturing's colour.
  expect(color("sales", "main", "business.turnover.sector_b_e")).toBe(color("firms", "count", "business.births.sector_c"));
  expect(color("investment-profit", "main", "business.profit.sector_a")).toBe(color("firms", "count", "business.active.sector_a"));
  expect(color("firms", "count", "business.births.sector_unknown")).toBe(OTHER_COLOR);
  expect(color("sales", "main", "business.turnover.total")).toBe(INK);
});

test("the area pages are Georgia and the eleven regions, linked by slug", () => {
  expect(BUSINESS_AREAS).toEqual(["georgia", ...BUSINESS_REGIONS]);
  expect(businessAreaHref("georgia")).toBe("/explorer/business/regions/georgia");
  expect(businessAreaHref("region_samegrelo_zemo_svaneti")).toBe("/explorer/business/regions/samegrelo_zemo_svaneti");
  expect(businessMapHash("turnover")).toBe("");
  expect(businessMapHash("employed")).toBe("#m=jobs");
});

test("an area lists the measure's series for its own group, the bold default first", () => {
  expect(businessAreaSeries("georgia", "money").map(s => [s.id, s.reference])).toEqual([
    ["business.turnover.total", true], ["business.investment.total", false], ["business.profit.total", false], ["business.loss.total", false],
  ]);
  expect(businessAreaSeries("region_guria", "jobs").map(s => [s.id, s.reference])).toEqual([["business.employed.region_guria", true]]);
  expect(businessAreaSeries("region_guria", "firms").map(s => [s.id, s.reference])).toEqual([
    ["business.active.region_guria", false], ["business.births.region_guria", false], ["business.deaths.region_guria", false],
  ]);
  expect(businessAreaDefaultSelection("region_guria", "money")).toEqual(["business.turnover.region_guria"]);
  expect(businessAreaDefaultSelection("georgia", "jobs")).toEqual(["business.employed.total"]);
  expect(businessAreaDefaultSelection("georgia", "firms")).toEqual(["business.births.total", "business.deaths.total"]);
});

test("area pages start on money with sales selected, over the area's coverage", () => {
  expect(parseBusinessAreaHash("", "georgia", facts)).toEqual({ mode: "line", range: { kind: "all" }, measure: "money", selectedIds: ["business.turnover.total"] });
  expect(span(businessAreaCoverage("georgia", "money", facts))).toEqual([1999, 2025]);
  expect(span(businessAreaCoverage("region_guria", "money", facts))).toEqual([2006, 2025]);
  expect(span(businessAreaCoverage("region_guria", "jobs", facts))).toEqual([2006, 2025]);
  expect(span(businessAreaCoverage("georgia", "firms", facts))).toEqual([2014, 2024]);
  const guria = buildBusinessAreaModel("region_guria", facts, parseBusinessAreaHash("", "region_guria", facts));
  expect(guria.years[0]).toBe(2006);
  expect(guria.unit).toBe("gel");
  expect(guria.selected.map(s => s.id)).toEqual(["business.turnover.region_guria"]);
  expect(buildBusinessAreaModel("georgia", facts, parseBusinessAreaHash("#m=firms", "georgia", facts)).unit).toBe("enterprises");
});

test("the area hash keeps only the measure's series, falls back to money, and switching measure selects its default and refits the years", () => {
  expect(parseBusinessAreaHash("#m=firms&sel=business.turnover.region_guria", "region_guria", facts)).toMatchObject({ measure: "firms", selectedIds: [] });
  expect(parseBusinessAreaHash("#m=xyz", "region_guria", facts).measure).toBe("money");
  const state = { ...parseBusinessAreaHash("", "region_guria", facts), range: { kind: "manual" as const, start: 2006, end: 2025 } };
  expect(changeBusinessAreaMeasure(state, "region_guria", "firms", facts)).toEqual({
    mode: "line", measure: "firms", range: { kind: "manual", start: 2014, end: 2024 }, selectedIds: ["business.births.region_guria", "business.deaths.region_guria"],
  });
  const jobs = { ...state, measure: "jobs" as const, mode: "table" as const, selectedIds: [], range: { kind: "manual" as const, start: 2010, end: 2020 } };
  const hash = serializeBusinessAreaHash(jobs);
  expect(new URLSearchParams(hash).get("m")).toBe("jobs");
  expect(new URLSearchParams(hash).get("sel")).toBe("");
  expect(parseBusinessAreaHash(`#${hash}`, "region_guria", facts)).toEqual(jobs);
});

test("the regions map ranks the eleven regions by the latest complete year", () => {
  const sales = buildBusinessRegionMapModel("turnover", facts);
  expect(sales.year).toBe(2025);
  expect(sales.firstYear).toBe(2006);
  expect(sales.regions).toHaveLength(11);
  expect(sales.regions[0]).toMatchObject({ regionId: "region.tbilisi", rank: 1 });
  expect(sales.regions.map(r => r.rank)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
  expect(sales.regions[0].value).toBe(facts.find(f => f.indicatorId === "business.turnover.region_tbilisi" && f.year === 2025)!.value);
  const jobs = buildBusinessRegionMapModel("employed", facts);
  expect(jobs.year).toBe(2025);
  expect(jobs.regions[0].value).toBe(facts.find(f => f.indicatorId === "business.employed.region_tbilisi" && f.year === 2025)!.value);
  const withoutGuria2025 = facts.filter(f => !(f.indicatorId === "business.turnover.region_guria" && f.year === 2025));
  expect(buildBusinessRegionMapModel("turnover", withoutGuria2025).year).toBe(2024);
});
