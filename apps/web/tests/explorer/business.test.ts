import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadBusinessFacts, toClientBusinessFact } from "../../lib/data/business/importBusiness";
import { BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_REGIONS, BUSINESS_SOURCES, BUSINESS_SIZES, BUSINESS_SURVEY_SECTORS, type ClientBusinessFact } from "../../lib/data/business/types";
import { INK, OTHER_COLOR } from "../../lib/explorer/colors";
import {
  BUSINESS_HUB_PATH, BUSINESS_SECTIONS, buildBusinessModel, businessCoverage, businessDefaultSelection, businessHeadingLabel, businessSeriesColor, businessTopicSeries,
  changeBusinessSelection, defaultBusinessState, keepOneBusinessUnit, parseBusinessHash, serializeBusinessHash, type BusinessSeriesDefinition, type BusinessTopicId,
} from "../../lib/explorer/business";
import {
  BUSINESS_AREAS, buildBusinessAreaModel, businessAreaCoverage, businessAreaDefaultSelection, businessAreaHref, businessAreaSelectionHash, businessAreaSeries,
  businessListLatest, businessMapHash, businessRegionHref, parseBusinessAreaHash, parseBusinessMapMeasure, serializeBusinessMapMeasure,
} from "../../lib/explorer/businessAreas";
import { buildBusinessRegionMapModel } from "../../lib/explorer/businessRegionMap";
import { buildBusinessHubCards } from "../../lib/explorer/businessHubCards";
import { buildBusinessWorkbookExportModel } from "../../lib/explorer/businessWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";

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
});

test("each topic page starts on its default selection, with coverage from the facts", () => {
  expect(defaultBusinessState("sales")).toEqual({ mode: "line", range: { kind: "all" }, selectedIds: ["business.turnover.total"] });
  expect(defaultBusinessState("jobs").selectedIds).toEqual(["business.employed.total"]);
  expect(defaultBusinessState("investment-profit").selectedIds).toEqual(["business.investment.total"]);
  expect(defaultBusinessState("firms")).toEqual({ mode: "line", range: { kind: "all" }, selectedIds: ["business.births.total", "business.deaths.total"] });
  expect(businessDefaultSelection("firms")).toEqual(["business.births.total", "business.deaths.total"]);
  expect(span(businessCoverage("sales", facts))).toEqual([1999, 2025]);
  expect(span(businessCoverage("jobs", facts))).toEqual([1999, 2025]);
  expect(span(businessCoverage("investment-profit", facts))).toEqual([2006, 2025]);
  expect(span(businessCoverage("firms", facts))).toEqual([2014, 2024]);
  expect(span(businessCoverage("firms", facts, ["business.birth_rate.total"]))).toEqual([2014, 2024]);
});

test("Sales and Jobs list the total, then three sizes and fourteen industries under their headings, all top-level", () => {
  for (const [section, measure] of [["sales", "turnover"], ["jobs", "employed"]] as const) {
    const series = businessTopicSeries(section);
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
  const series = businessTopicSeries("investment-profit");
  const parents = series.filter(s => !s.parentId);
  expect(parents.map(s => [s.id, s.reference])).toEqual([["business.investment.total", true], ["business.profit.total", false], ["business.loss.total", false]]);
  for (const parent of parents) {
    const measure = parent.id.split(".")[1];
    expect(series.filter(s => s.parentId === parent.id).map(s => s.id)).toEqual([...BUSINESS_SIZES, ...BUSINESS_SURVEY_SECTORS].map(group => `business.${measure}.${group}`));
  }
  expect(series).toHaveLength(3 + 3 * 17);
});

test("Firms lists the counts, each with 18 sections and the unknown activity nested, then the rates with only the 18 sections, under two headings", () => {
  const series = businessTopicSeries("firms");
  expect(series.filter(s => !s.parentId).map(s => [s.id, s.heading])).toEqual([
    ["business.active.total", "count"], ["business.births.total", "count"], ["business.deaths.total", "count"],
    ["business.birth_rate.total", "rate"], ["business.death_rate.total", "rate"],
  ]);
  expect(series.every(s => !s.reference)).toBe(true);
  expect(series.filter(s => s.parentId).every(s => s.heading === undefined)).toBe(true);
  for (const measure of ["active", "births", "deaths"]) {
    expect(series.filter(s => s.parentId === `business.${measure}.total`).map(s => s.id)).toEqual([...BUSINESS_DEMOGRAPHY_SECTORS, "sector_unknown"].map(group => `business.${measure}.${group}`));
  }
  for (const measure of ["birth_rate", "death_rate"]) {
    expect(series.filter(s => s.parentId === `business.${measure}.total`).map(s => s.id)).toEqual(BUSINESS_DEMOGRAPHY_SECTORS.map(group => `business.${measure}.${group}`));
  }
  expect(series).toHaveLength(3 + 3 * 19 + 2 + 2 * 18);
});

test("a heading names a breakdown, or a unit group's measure with its unit unless the measure names it", () => {
  const t = (key: string) => key;
  const units = { gel: "mln GEL", persons: "thousand people", enterprises: "firms", percent: "%" };
  expect(businessHeadingLabel("size", "gel", t, units)).toBe("heading.size");
  expect(businessHeadingLabel("count", "enterprises", t, units)).toBe("measure.count");
  expect(businessHeadingLabel("rate", "percent", t, units)).toBe("measure.rate · %");
  expect(businessHeadingLabel("money", "gel", t, units)).toBe("measure.money · mln GEL");
  expect(businessHeadingLabel("jobs", "persons", t, units)).toBe("measure.jobs · thousand people");
});

test("one unit at a time: a row of another unit replaces the selection, and selecting all takes the first unit group", () => {
  const counts = ["business.births.total", "business.deaths.total"];
  // Ticking within the unit adds; ticking a rate (a total or a nested section) replaces the counts; unticking keeps the rest.
  expect(keepOneBusinessUnit(["business.active.total", ...counts], counts, facts)).toEqual(["business.active.total", ...counts]);
  expect(keepOneBusinessUnit([...counts, "business.birth_rate.total"], counts, facts)).toEqual(["business.birth_rate.total"]);
  expect(keepOneBusinessUnit([...counts, "business.death_rate.sector_c"], counts, facts)).toEqual(["business.death_rate.sector_c"]);
  expect(keepOneBusinessUnit(["business.deaths.total"], counts, facts)).toEqual(["business.deaths.total"]);
  expect(keepOneBusinessUnit([], counts, facts)).toEqual([]);
  // The bulk action from an empty list hands over every top-level row in list order.
  const top = (series: BusinessSeriesDefinition[]) => series.filter(s => !s.parentId).map(s => s.id);
  expect(keepOneBusinessUnit(top(businessTopicSeries("firms")), [], facts)).toEqual(["business.active.total", ...counts]);
  expect(keepOneBusinessUnit(top(businessAreaSeries("region_guria")), [], facts)).toEqual(["turnover", "investment", "profit", "loss"].map(m => `business.${m}.region_guria`));
  // On an area page, ticking Employed replaces Sales.
  expect(keepOneBusinessUnit(["business.turnover.total", "business.employed.total"], ["business.turnover.total"], facts)).toEqual(["business.employed.total"]);
});

test("changing the selection's unit keeps the years, clamped to the new unit's coverage", () => {
  const georgia = businessAreaSeries("georgia");
  const state = (start: number, end: number) => ({ mode: "table" as const, range: { kind: "manual" as const, start, end }, selectedIds: ["business.turnover.total"] });
  expect(changeBusinessSelection(state(2006, 2020), georgia, ["business.turnover.total", "business.births.total"], facts)).toEqual({
    mode: "table", range: { kind: "manual", start: 2014, end: 2020 }, selectedIds: ["business.births.total"],
  });
  // A range the new unit misses entirely shows all of it; a full one stays manual.
  expect(changeBusinessSelection(state(1999, 2010), georgia, ["business.turnover.total", "business.active.total"], facts).range).toEqual({ kind: "all" });
  expect(changeBusinessSelection(state(2014, 2024), georgia, ["business.turnover.total", "business.active.total"], facts).range).toEqual({ kind: "manual", start: 2014, end: 2024 });
  // Back on money, the years stay as they were clamped.
  const firms = { ...state(2014, 2020), selectedIds: ["business.births.total"] };
  expect(changeBusinessSelection(firms, georgia, ["business.births.total", "business.loss.total"], facts)).toMatchObject({ selectedIds: ["business.loss.total"], range: { kind: "manual", start: 2014, end: 2020 } });
});

test("the topic hash round-trips, keeps an explicit empty selection, keeps one unit and writes no tab", () => {
  for (const section of TOPICS) {
    const state = { ...defaultBusinessState(section), mode: "table" as const, selectedIds: [] };
    const hash = serializeBusinessHash(state);
    expect(hash.includes("sel=&") || hash.endsWith("sel=")).toBe(true);
    expect(new URLSearchParams(hash).has("tab")).toBe(false);
    expect(parseBusinessHash(`#${hash}`, section, facts)).toEqual(state);
  }
  const rate = { ...defaultBusinessState("firms"), selectedIds: ["business.death_rate.sector_g"], range: { kind: "manual" as const, start: 2015, end: 2022 } };
  expect(parseBusinessHash(`#${serializeBusinessHash(rate)}`, "firms", facts)).toEqual(rate);
  expect(parseBusinessHash("", "firms", facts)).toEqual(defaultBusinessState("firms"));
  expect(parseBusinessHash("#tab=rate", "firms", facts)).toEqual(defaultBusinessState("firms"));
  // A mixed selection keeps the unit of its first row in list order.
  expect(parseBusinessHash("#sel=business.birth_rate.total,business.deaths.sector_c,business.active.total", "firms", facts).selectedIds).toEqual(["business.active.total", "business.deaths.sector_c"]);
});

test("the topic models carry the published values, the unit and gaps as null, and never a region", () => {
  const sales = buildBusinessModel("sales", facts, defaultBusinessState("sales"));
  expect(sales.unit).toBe("gel");
  expect(sales.series[0].valuesByYear[2025]).toBe(253725500000);
  expect(sales.selected.map(s => s.id)).toEqual(["business.turnover.total"]);
  expect(sales.years[0]).toBe(1999);
  for (const section of TOPICS) {
    const model = buildBusinessModel(section, facts, defaultBusinessState(section));
    expect(model.series.some(s => /\.region_/.test(s.id))).toBe(false);
  }
  expect(buildBusinessModel("jobs", facts, defaultBusinessState("jobs")).unit).toBe("persons");
  expect(buildBusinessModel("firms", facts, defaultBusinessState("firms")).unit).toBe("enterprises");
  // The unit is the selection's, the list's first series' when nothing is selected; each series keeps its own.
  expect(buildBusinessModel("firms", facts, { ...defaultBusinessState("firms"), selectedIds: [] }).unit).toBe("enterprises");
  // Geostat prints "…" for section death rates in 2016 and 2019: those years are null, never zero, while the total has a value.
  const rate = buildBusinessModel("firms", facts, { ...defaultBusinessState("firms"), selectedIds: ["business.death_rate.total"] });
  expect(rate.unit).toBe("percent");
  expect(rate.series.find(s => s.id === "business.active.total")!.unit).toBe("enterprises");
  const total = rate.series.find(s => s.id === "business.death_rate.total")!, section = rate.series.find(s => s.id === "business.death_rate.sector_c")!;
  for (const year of [2016, 2019]) { expect(section.valuesByYear[year]).toBeNull(); expect(total.valuesByYear[year]).not.toBeNull(); }
  expect(section.valuesByYear[2015]).not.toBeNull();
});

test("an industry wears its economic-sector colour under every parent; the unknown activity wears the other colour", () => {
  const color = (section: BusinessTopicId, id: string) => {
    const series = businessTopicSeries(section), index = series.findIndex(s => s.id === id);
    return businessSeriesColor(series[index], index);
  };
  // The colour follows the section, not the measure or the position in the list.
  expect(businessSeriesColor({ id: "business.turnover.sector_c", reference: false }, 0)).toBe(color("firms", "business.births.sector_c"));
  expect(color("firms", "business.births.sector_c")).toBe(color("firms", "business.deaths.sector_c"));
  expect(color("firms", "business.births.sector_c")).toBe(color("firms", "business.birth_rate.sector_c"));
  // The survey's combined B–E group wears manufacturing's colour.
  expect(color("sales", "business.turnover.sector_b_e")).toBe(color("firms", "business.births.sector_c"));
  expect(color("investment-profit", "business.profit.sector_a")).toBe(color("firms", "business.active.sector_a"));
  expect(color("firms", "business.births.sector_unknown")).toBe(OTHER_COLOR);
  expect(color("sales", "business.turnover.total")).toBe(INK);
});

test("the same industry under two parents keeps its colour but not its stroke: each parent's children take their own", () => {
  const stroke = (section: BusinessTopicId, id: string) => {
    const model = buildBusinessModel(section, facts, defaultBusinessState(section));
    const series = model.series.find(s => s.id === id)!;
    return { color: series.color, stroke: series.stroke };
  };
  const construction = ["investment", "profit", "loss"].map(measure => stroke("investment-profit", `business.${measure}.sector_f`));
  expect(new Set(construction.map(s => s.color)).size).toBe(1);
  expect(construction.map(s => s.stroke)).toEqual(["solid", "dashed", "dotted"]);
  const manufacturing = ["active", "births", "deaths"].map(measure => stroke("firms", `business.${measure}.sector_c`));
  expect(new Set(manufacturing.map(s => s.color)).size).toBe(1);
  expect(manufacturing.map(s => s.stroke)).toEqual(["solid", "dashed", "dotted"]);
  // A rate's sections take their stroke among the rates alone, the unit they are charted in.
  expect(["birth_rate", "death_rate"].map(measure => stroke("firms", `business.${measure}.sector_c`).stroke)).toEqual(["solid", "dashed"]);
  // Totals and the flat Sales and Jobs lists stay solid.
  expect(stroke("firms", "business.deaths.total").stroke).toBe("solid");
  expect(buildBusinessModel("sales", facts, defaultBusinessState("sales")).series.every(s => s.stroke === "solid")).toBe(true);
});

test("in every unit group of every list, only the same industry or size under two parents shares a colour", () => {
  /** What a series is: an industry or size is the same line of thought under every parent; anything else is itself. */
  const identity = (id: string) => { const group = id.split(".")[2]; return /^(sector|size)_/.test(group) ? group : id; };
  const unitOf = new Map(facts.map(f => [f.indicatorId as string, f.unit]));
  const lists: [string, BusinessSeriesDefinition[]][] = [
    ...TOPICS.map(section => [section, businessTopicSeries(section)] as [string, BusinessSeriesDefinition[]]),
    ...(["georgia", "region_guria"] as const).map(area => [area, businessAreaSeries(area)] as [string, BusinessSeriesDefinition[]]),
  ];
  for (const [name, series] of lists) {
    // Series of different units never share a chart, so a colour need only be unique within one unit.
    const owner = new Map<string, string>();
    series.forEach((s, index) => {
      const color = `${unitOf.get(s.id)}:${businessSeriesColor(s, index)}`, who = identity(s.id);
      expect(color.endsWith(":undefined"), `${name}: ${s.id} has no colour`).toBe(false);
      expect(owner.get(color) ?? who, `${name}: ${s.id} wears ${color}`).toBe(who);
      owner.set(color, who);
    });
  }
  // A size or a measure's total keeps its colour across pages and parents; a rate wears its count's.
  const colorOf = (series: BusinessSeriesDefinition[], id: string) => { const index = series.findIndex(s => s.id === id); return businessSeriesColor(series[index], index); };
  const sales = businessTopicSeries("sales"), money = businessTopicSeries("investment-profit"), firms = businessTopicSeries("firms");
  expect(colorOf(sales, "business.turnover.size_large")).toBe(colorOf(money, "business.profit.size_large"));
  expect(colorOf(money, "business.investment.size_small")).toBe(colorOf(money, "business.loss.size_small"));
  expect(colorOf(money, "business.loss.total")).toBe(colorOf(businessAreaSeries("region_guria"), "business.loss.region_guria"));
  expect(colorOf(firms, "business.births.total")).toBe(colorOf(businessAreaSeries("georgia"), "business.births.total"));
  expect(colorOf(firms, "business.births.total")).toBe(colorOf(businessAreaSeries("region_guria"), "business.births.region_guria"));
  expect(colorOf(firms, "business.birth_rate.total")).toBe(colorOf(firms, "business.births.total"));
  // On an area page Jobs, alone in its unit, is ink.
  expect(colorOf(businessAreaSeries("region_guria"), "business.employed.region_guria")).toBe(INK);
});

test("the area pages are Georgia and the eleven regions, linked by slug", () => {
  expect(BUSINESS_AREAS).toEqual(["georgia", ...BUSINESS_REGIONS]);
  expect(businessAreaHref("georgia")).toBe("/explorer/business/regions/georgia");
  expect(businessAreaHref("region_samegrelo_zemo_svaneti")).toBe("/explorer/business/regions/samegrelo_zemo_svaneti");
  // A jobs link opens the area with jobs selected, written as the page writes its own selection.
  expect(businessMapHash("turnover", "region_guria")).toBe("");
  expect(businessMapHash("employed", "georgia")).toBe("#sel=business.employed.total");
  expect(businessMapHash("employed", "region_guria")).toBe("#sel=business.employed.region_guria");
  expect(new URLSearchParams(businessMapHash("employed", "region_guria").slice(1)).get("sel")).toBe(new URLSearchParams(serializeBusinessHash({ mode: "line", range: { kind: "all" }, selectedIds: ["business.employed.region_guria"] })).get("sel"));
  // Links between area pages carry the selection, moved to the other area; sales alone carries nothing.
  expect(businessAreaSelectionHash(["business.births.region_guria", "business.deaths.region_guria"], "georgia")).toBe(`#${new URLSearchParams({ sel: "business.births.total,business.deaths.total" })}`);
  expect(businessAreaSelectionHash(["business.turnover.total"], "region_guria")).toBe("");
  expect(businessAreaSelectionHash([], "region_guria")).toBe("#sel=");
  // Map and list rows carry the map's region ids.
  expect(businessRegionHref("georgia")).toBe("/explorer/business/regions/georgia");
  expect(businessRegionHref("region.mtskheta_mtianeti")).toBe("/explorer/business/regions/mtskheta_mtianeti");
});

test("the Regions index keeps its map measure in the hash under the area pages' key", () => {
  expect(parseBusinessMapMeasure("")).toBe("turnover");
  expect(parseBusinessMapMeasure("#m=jobs")).toBe("employed");
  expect(parseBusinessMapMeasure("#m=firms")).toBe("turnover");
  for (const measure of ["turnover", "employed"] as const) expect(parseBusinessMapMeasure(serializeBusinessMapMeasure(measure))).toBe(measure);
});

test("an area lists money, jobs and firms for its own group, each under its heading, with sales the bold default", () => {
  expect(businessAreaSeries("georgia").map(s => [s.id, s.reference, s.heading])).toEqual([
    ["business.turnover.total", true, "money"], ["business.investment.total", false, "money"], ["business.profit.total", false, "money"], ["business.loss.total", false, "money"],
    ["business.employed.total", false, "jobs"],
    ["business.active.total", false, "firms"], ["business.births.total", false, "firms"], ["business.deaths.total", false, "firms"],
  ]);
  expect(businessAreaSeries("region_guria").map(s => s.id)).toEqual(["turnover", "investment", "profit", "loss", "employed", "active", "births", "deaths"].map(m => `business.${m}.region_guria`));
  expect(businessAreaDefaultSelection("region_guria")).toEqual(["business.turnover.region_guria"]);
  expect(businessAreaDefaultSelection("georgia")).toEqual(["business.turnover.total"]);
});

test("area pages start with sales selected, and their years follow the selection's unit", () => {
  expect(parseBusinessAreaHash("", "georgia", facts)).toEqual({ mode: "line", range: { kind: "all" }, selectedIds: ["business.turnover.total"] });
  expect(span(businessAreaCoverage("georgia", facts))).toEqual([1999, 2025]);
  expect(span(businessAreaCoverage("georgia", facts, ["business.investment.total"]))).toEqual([1999, 2025]);
  expect(span(businessAreaCoverage("region_guria", facts, ["business.turnover.region_guria"]))).toEqual([2006, 2025]);
  expect(span(businessAreaCoverage("region_guria", facts, ["business.employed.region_guria"]))).toEqual([2006, 2025]);
  expect(span(businessAreaCoverage("georgia", facts, ["business.births.total"]))).toEqual([2014, 2024]);
  const guria = buildBusinessAreaModel("region_guria", facts, parseBusinessAreaHash("", "region_guria", facts));
  expect(guria.years[0]).toBe(2006);
  expect(guria.unit).toBe("gel");
  expect(guria.selected.map(s => s.id)).toEqual(["business.turnover.region_guria"]);
  const firms = buildBusinessAreaModel("georgia", facts, parseBusinessAreaHash("#sel=business.births.total", "georgia", facts));
  expect(firms.unit).toBe("enterprises");
  expect([firms.years[0], firms.years.at(-1)]).toEqual([2014, 2024]);
  expect(buildBusinessAreaModel("georgia", facts, parseBusinessAreaHash("#sel=", "georgia", facts)).unit).toBe("gel");
});

test("an area list row shows its latest figure up to the chart's last year, so unticked firm counts are never blank", () => {
  expect(businessListLatest(facts, "business.births.region_guria", 2025)?.year).toBe(2024);
  expect(businessListLatest(facts, "business.births.region_guria", 2025)?.value).toBeGreaterThan(0);
  expect(businessListLatest(facts, "business.turnover.region_guria", 2025)?.year).toBe(2025);
  expect(businessListLatest(facts, "business.turnover.region_guria", 2020)?.year).toBe(2020);
  expect(businessListLatest(facts, "business.births.region_guria", 2010)).toBeUndefined();
});

test("the area hash round-trips, ignores the old measure key, keeps one unit and fits the years to it", () => {
  expect(parseBusinessAreaHash("#m=firms", "region_guria", facts)).toEqual(parseBusinessAreaHash("", "region_guria", facts));
  expect(parseBusinessAreaHash("#sel=business.turnover.region_guria,business.employed.region_guria,business.births.region_guria", "region_guria", facts).selectedIds).toEqual(["business.turnover.region_guria"]);
  // The hash's years are refitted to the selection's unit.
  expect(parseBusinessAreaHash("#sel=business.births.region_guria&start=2006&end=2020", "region_guria", facts).range).toEqual({ kind: "manual", start: 2014, end: 2020 });
  const jobs = { mode: "table" as const, selectedIds: ["business.employed.region_guria"], range: { kind: "manual" as const, start: 2010, end: 2020 } };
  const hash = serializeBusinessHash(jobs);
  expect(new URLSearchParams(hash).has("m")).toBe(false);
  expect(parseBusinessAreaHash(`#${hash}`, "region_guria", facts)).toEqual(jobs);
  const empty = { ...jobs, selectedIds: [] };
  expect(parseBusinessAreaHash(`#${serializeBusinessHash(empty)}`, "region_guria", facts)).toEqual(empty);
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

// The catalogue keys Task 6 adds; the tests hand them over directly.
const TEST_MESSAGES = {
  "business.unitMlnGel": "million GEL", "business.unitPersons": "persons", "business.unitFirms": "firms", "business.unitPercent": "%", "business.unitThousandPersons": "thousand",
  "business.status.official": "Official", "business.cardFirms": "{value} new firms",
  "business.page.sales.summary": "sales", "business.page.jobs.summary": "jobs", "business.page.investment-profit.summary": "investment", "business.page.firms.summary": "firms", "business.page.regions.summary": "regions",
  "common.businessSales": "Sales", "common.businessJobs": "Jobs", "common.businessInvestmentProfit": "Investment and profit", "common.businessFirms": "New and closed firms", "common.businessRegions": "Regions",
};
const presentation = async (): Promise<Presentation> => ({ locale: "en", englishLabels: {}, messages: { ...await getMessages("en", ["workbook", "format", "common"]), ...TEST_MESSAGES } });
const SOURCES = BUSINESS_SOURCES.map(sourceId => ({
  sourceId, years: Array.from({ length: 27 }, (_, i) => 1999 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-14",
  downloadHref: `/downloads/methodology/business/files/${sourceId}.xlsx` as const,
}));
// The page hands over a label for every series it lists, parents included.
const labelsFor = (ids: readonly string[]) => Object.fromEntries([...ids, "business.profit.total", "business.loss.total"].map(id => [id, id]));
const topicWorkbook = async (section: BusinessTopicId, selectedIds: string[], start: number, end: number) =>
  buildBusinessWorkbookExportModel({
    section, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds), title: "Title",
    state: { mode: "table", range: { kind: "manual", start, end }, selectedIds },
  }, await presentation());
const areaWorkbook = async (area: Parameters<typeof businessAreaSeries>[0], selectedIds: string[], start: number, end: number) =>
  buildBusinessWorkbookExportModel({
    area, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds), title: "Title",
    state: { mode: "table", range: { kind: "manual", start, end }, selectedIds },
  }, await presentation());
const publishedMillions = (id: string, year: number) => facts.find(f => f.indicatorId === id && f.year === year)!.value / 1_000_000;

test("the Sales workbook exports million GEL for 1999-2025, cites only the turnover file and is readable in Excel", async () => {
  const ids = ["business.turnover.total", "business.turnover.sector_a"];
  const model = await topicWorkbook("sales", ids, 1999, 2025);
  expect(model.filename).toBe("fiscal-business-sales-1999-2025-en.xlsx");
  expect(model.readable.title).toBe("Title");
  expect(model.readable.unitLabel).toBe("million GEL");
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.years).toHaveLength(27);
  expect(model.readable.rows.map(row => [row.label, row.kind])).toEqual([["business.turnover.total", "total"], ["business.turnover.sector_a", "item"]]);
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(253725.5);
  expect(model.readable.rows[1].valuesByYear[2025]).toBe(publishedMillions("business.turnover.sector_a", 2025));
  expect(model.analysis.rows).toHaveLength(54);
  expect(model.analysis.headers).not.toContain("source_cell");
  expect(model.analysis.rows.find(r => r[0] === 2025 && r[1] === "business.turnover.total")).toEqual([2025, "business.turnover.total", 253725.5, "Official"]);
  expect(model.sources.map(s => s.title)).toEqual(["geostat_business_turnover"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/business/files/geostat_business_turnover.xlsx");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  expect(excel.worksheets[1].getCell(2, 3).numFmt).toBe("#,##0.0");
});

test("nested series are labelled with their parent, and the sources follow the exported measures", async () => {
  const ids = ["business.investment.total", "business.loss.sector_g", "business.profit.sector_g"];
  const model = await topicWorkbook("investment-profit", ids, 2020, 2025);
  expect(model.filename).toBe("fiscal-business-investment-profit-2020-2025-en.xlsx");
  expect(model.readable.rows.map(row => [row.kind, row.parentLabel, row.label])).toEqual([
    ["total", null, "business.investment.total"], ["item", "business.profit.total", "business.profit.sector_g"], ["item", "business.loss.total", "business.loss.sector_g"],
  ]);
  expect(model.analysis.rows.map(row => row[1])).toContain("business.profit.total — business.profit.sector_g");
  expect(model.sources.map(s => s.title)).toEqual(["geostat_business_investment", "geostat_business_profit_loss"]);
});

test("the Firms rate workbook uses one decimal and the -rate file name (the counts the plain one), with Geostat's blank section death rates left empty", async () => {
  const ids = ["business.death_rate.sector_c", "business.birth_rate.total"];
  const model = await topicWorkbook("firms", ids, 2014, 2024);
  expect(model.filename).toBe("fiscal-business-firms-rate-2014-2024-en.xlsx");
  // The counts keep the plain name.
  expect((await topicWorkbook("firms", ["business.births.total"], 2014, 2024)).filename).toBe("fiscal-business-firms-2014-2024-en.xlsx");
  expect(model.readable.unitLabel).toBe("%");
  expect(model.readable.numberFormat).toBe("0.0");
  const section = model.readable.rows.find(row => row.label === "business.death_rate.sector_c")!;
  for (const year of [2016, 2019]) { expect(section.valuesByYear[year]).toBeNull(); expect(section.basisByYear[year]).toBeNull(); }
  expect(section.valuesByYear[2015]).not.toBeNull();
  const analysis = (year: number) => model.analysis.rows.find(r => r[0] === year && String(r[1]).endsWith("death_rate.sector_c"))!;
  expect(analysis(2016).slice(2)).toEqual([null, "Not available"]);
  expect(analysis(2015)[3]).toBe("Official");
  expect(model.analysis.numericFormats).toEqual({ 3: "0.0" });
  expect(model.sources.map(s => s.title)).toEqual(["geostat_business_demography"]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  const sheet = excel.worksheets[0];
  const row = [...Array(sheet.rowCount).keys()].map(i => sheet.getRow(i + 1)).find(r => r.getCell(1).value === "business.death_rate.sector_c")!;
  expect(row.getCell(2 + (2016 - 2014)).value).toBeNull();
  expect(row.getCell(2 + (2015 - 2014)).value).not.toBeNull();
});

test("a Guria firms workbook is whole numbers of firms from the demography file alone", async () => {
  const ids = ["business.births.region_guria", "business.deaths.region_guria"];
  const model = await areaWorkbook("region_guria", ids, 2014, 2024);
  expect(model.filename).toBe("fiscal-business-guria-2014-2024-en.xlsx");
  expect(model.readable.unitLabel).toBe("firms");
  expect(model.readable.numberFormat).toBe("#,##0");
  expect(model.readable.rows[0].valuesByYear[2024]).toBe(facts.find(f => f.indicatorId === ids[0] && f.year === 2024)!.value);
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0" });
  expect(model.sources.map(s => s.title)).toEqual(["geostat_business_demography"]);
});

test("area workbooks scale money to million GEL, keep persons whole, and cite the matching survey file", async () => {
  const money = await areaWorkbook("georgia", ["business.turnover.total", "business.profit.total"], 2020, 2025);
  expect(money.filename).toBe("fiscal-business-georgia-2020-2025-en.xlsx");
  expect(money.readable.unitLabel).toBe("million GEL");
  expect(money.readable.rows[0].valuesByYear[2025]).toBe(253725.5);
  expect(money.sources.map(s => s.title)).toEqual(["geostat_business_turnover", "geostat_business_profit_loss"]);
  const jobs = await areaWorkbook("region_adjara", ["business.employed.region_adjara"], 2020, 2025);
  expect(jobs.readable.unitLabel).toBe("persons");
  expect(jobs.readable.numberFormat).toBe("#,##0");
  expect(jobs.readable.rows[0].valuesByYear[2025]).toBe(facts.find(f => f.indicatorId === "business.employed.region_adjara" && f.year === 2025)!.value);
  expect(jobs.sources.map(s => s.title)).toEqual(["geostat_business_employed"]);
  const empty = await topicWorkbook("sales", [], 2020, 2025);
  expect(empty.readable.rows).toEqual([]); expect(empty.analysis.rows).toEqual([]); expect(empty.sources).toEqual([]);
});

test("the hub has five cards: four headline series with their latest values and years, then Regions with its years only", async () => {
  const cards = buildBusinessHubCards(facts, await presentation());
  expect(cards.map(card => card.href)).toEqual(BUSINESS_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.title)).toEqual(["Sales", "Jobs", "Investment and profit", "New and closed firms", "Regions"]);
  expect(cards.map(card => card.footer)).toEqual(["2025 · 253.7 bn GEL · 1999–2025", "2025 · 899.0 thousand · 1999–2025", "2025 · 8.0 bn GEL · 2006–2025", "2024 · 56,259 new firms · 2014–2024", "2006–2025"]);
  expect(cards.map(card => card.series?.length ?? null)).toEqual([27, 27, 20, 11, null]);
  expect(cards[0].series!.at(-1)).toBe(253725500000);
  expect(cards[4]).toMatchObject({ series: null, seriesColor: null, comingSoon: false });
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04", "05"]);
});
