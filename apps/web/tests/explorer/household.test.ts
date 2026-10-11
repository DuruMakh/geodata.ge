import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadServedHouseholdData, toClientHouseholdFact } from "../../lib/data/household/importHousehold";
import { HOUSEHOLD_AREAS, HOUSEHOLD_SOURCES, type ClientHouseholdFact } from "../../lib/data/household/types";
import {
  buildHouseholdModel, changeHouseholdArea, changeHouseholdMeasure, defaultHouseholdState, HOUSEHOLD_SECTIONS,
  householdCoverage, householdViewSeries, parseHouseholdHash, serializeHouseholdHash, type HouseholdState,
} from "../../lib/explorer/household";
import { buildHouseholdHubCards } from "../../lib/explorer/householdHubCards";
import { buildHouseholdRegionMapModel } from "../../lib/explorer/householdRegionMap";
import { buildHouseholdWorkbookExportModel, householdWorkbookSources } from "../../lib/explorer/householdWorkbook";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { projectPublicSources } from "../../lib/methodology/publicSources";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { LIVING_STANDARDS_HUB_PATH, LIVING_STANDARDS_SECTIONS } from "../../lib/explorer/livingStandards";
import { message } from "../../lib/i18n/messages";
import { resolveRange } from "../../lib/explorer/periodRange";

let facts: ClientHouseholdFact[];
beforeAll(async () => { facts = (await loadServedHouseholdData()).facts.map(toClientHouseholdFact); });

test("the hub lists the four living-standards pages", () => {
  expect(LIVING_STANDARDS_HUB_PATH).toBe("/explorer/living-standards");
  expect(HOUSEHOLD_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["income", "/explorer/living-standards/income", "common.householdIncome"],
    ["spending", "/explorer/living-standards/spending", "common.householdSpending"],
  ]);
  expect(LIVING_STANDARDS_SECTIONS.map(s => s.href)).toEqual([
    "/explorer/living-standards/income", "/explorer/living-standards/spending", "/explorer/living-standards/poverty", "/explorer/living-standards/inequality",
  ]);
});

test("each page starts on Georgia per household with only its total, and coverage comes from the facts", () => {
  expect(defaultHouseholdState("income")).toEqual({ mode: "line", range: { kind: "all" }, area: "georgia", measure: "per_household", selectedIds: ["income.total"] });
  expect(defaultHouseholdState("spending").selectedIds).toEqual(["spending.consumption"]);
  expect(householdCoverage("income", "georgia", "per_household", facts)).toMatchObject({ min: 2002, max: 2025 });
  expect(householdCoverage("income", "region.tbilisi", "per_household", facts)).toMatchObject({ min: 2011, max: 2025 });
});

test("parts nest under their total in spec order, and Georgia adds towns and villages after them while a region does not", () => {
  const income = householdViewSeries("income", "region.guria");
  expect(income.map(s => [s.id, s.reference, s.parentId])).toEqual([
    ["income.total", true, undefined],
    ...["wages", "self_employment", "agriculture_sales", "property", "pensions_assistance", "remittances", "gifts", "non_cash"].map(k => [`income.${k}`, false, "income.total"]),
    ["income.other_inflows", false, undefined],
    ["income.borrowing_dissaving", false, "income.other_inflows"],
    ["income.property_disposal", false, "income.other_inflows"],
  ]);
  expect(income.every(s => s.areaId === "region.guria")).toBe(true);
  expect(income.filter(s => s.parentId === "income.total")).toHaveLength(8);
  const spending = householdViewSeries("spending", "georgia");
  expect(spending.map(s => [s.id, s.indicatorId, s.areaId, s.reference, s.parentId])).toEqual([
    ["spending.consumption", "spending.consumption", "georgia", true, undefined],
    ...["food", "clothing", "household_goods", "health", "housing_utilities", "transport", "education", "other_consumption", "non_cash"].map(k => [`spending.${k}`, `spending.${k}`, "georgia", false, "spending.consumption"]),
    ["spending.non_consumption", "spending.non_consumption", "georgia", false, undefined],
    ...["saving_lending", "agriculture", "transfers", "property"].map(k => [`spending.${k}`, `spending.${k}`, "georgia", false, "spending.non_consumption"]),
    // Towns and villages are the section total for each, as top-level lines of their own.
    ["settlement.urban", "spending.consumption", "settlement.urban", false, undefined],
    ["settlement.rural", "spending.consumption", "settlement.rural", false, undefined],
  ]);
  expect(householdViewSeries("income", "georgia").slice(-2).map(s => [s.id, s.indicatorId])).toEqual([["settlement.urban", "income.total"], ["settlement.rural", "income.total"]]);
  expect(householdViewSeries("income", "region.tbilisi").some(s => s.areaId.startsWith("settlement."))).toBe(false);
});

test("choosing a region that starts later narrows a chosen range, and choosing Georgia again keeps those years", () => {
  const start: HouseholdState = { ...defaultHouseholdState("income"), range: { kind: "manual", start: 2011, end: 2016 } };
  const guria = changeHouseholdArea(start, "income", "region.guria", facts);
  expect(guria.area).toBe("region.guria");
  expect(resolveRange(guria.range, householdCoverage("income", "region.guria", "per_household", facts))).toMatchObject({ start: 2019, end: 2025 });
  const back = changeHouseholdArea(guria, "income", "georgia", facts);
  expect(back.range).toEqual({ kind: "manual", start: 2019, end: 2025 });
  expect(resolveRange(back.range, householdCoverage("income", "georgia", "per_household", facts))).toMatchObject({ start: 2019, end: 2025 });
  // "All" stays "all", so a later data year still widens the view.
  expect(changeHouseholdArea(defaultHouseholdState("income"), "income", "region.guria", facts).range).toEqual({ kind: "all" });
});

test("changing area or measure keeps the selection the new area has", () => {
  const state: HouseholdState = { ...defaultHouseholdState("income"), selectedIds: ["income.total", "income.wages"] };
  expect(changeHouseholdArea(state, "income", "region.adjara", facts)).toMatchObject({ area: "region.adjara", selectedIds: ["income.total", "income.wages"] });
  expect(changeHouseholdMeasure(state, "income", "per_capita", facts)).toMatchObject({ measure: "per_capita", selectedIds: ["income.total", "income.wages"] });
});

test("leaving Georgia for Guria drops the towns and villages ticks, keeps the others and starts in 2019", () => {
  const state: HouseholdState = { ...defaultHouseholdState("income"), selectedIds: ["income.total", "income.remittances", "settlement.urban", "settlement.rural"] };
  const guria = changeHouseholdArea(state, "income", "region.guria", facts);
  expect(guria.selectedIds).toEqual(["income.total", "income.remittances"]);
  expect(buildHouseholdModel("income", facts, guria).range).toMatchObject({ start: 2019, end: 2025 });
  // A chosen range is refitted to Guria's years too.
  const chosen = changeHouseholdArea({ ...state, range: { kind: "manual", start: 2008, end: 2012 } }, "income", "region.guria", facts);
  expect(chosen.range).toEqual({ kind: "manual", start: 2019, end: 2025 });
  expect(changeHouseholdArea(guria, "income", "georgia", facts).selectedIds).toEqual(["income.total", "income.remittances"]);
});

test("an area change that leaves nothing ticked falls back to the first series, while an empty selection stays empty", () => {
  const towns: HouseholdState = { ...defaultHouseholdState("income"), selectedIds: ["settlement.urban", "settlement.rural"] };
  expect(changeHouseholdArea(towns, "income", "region.guria", facts).selectedIds).toEqual(["income.total"]);
  expect(changeHouseholdArea({ ...towns, selectedIds: [] }, "income", "region.guria", facts).selectedIds).toEqual([]);
});

test("towns and villages draw in colours no other line of Georgia's list uses", () => {
  for (const section of ["income", "spending"] as const) {
    const series = buildHouseholdModel(section, facts, defaultHouseholdState(section)).series;
    for (const id of ["settlement.urban", "settlement.rural"]) {
      const color = series.find(s => s.id === id)!.color;
      expect(series.filter(s => s.color === color).map(s => s.id), `${section} ${id}`).toEqual([id]);
    }
  }
});

test("the hash round-trips, writes the area only for a region and keeps an explicit empty selection", () => {
  const state: HouseholdState = { mode: "table", area: "region.adjara", measure: "per_capita", range: { kind: "manual", start: 2014, end: 2020 }, selectedIds: ["income.total", "income.remittances"] };
  const hash = serializeHouseholdHash(state);
  expect(hash).toContain("area=region.adjara");
  expect(hash).toContain("per=person");
  expect(hash).not.toContain("tab=");
  expect(parseHouseholdHash(`#${hash}`, "income", facts)).toEqual(state);
  expect(serializeHouseholdHash(defaultHouseholdState("income"))).not.toContain("area=");
  expect(serializeHouseholdHash(defaultHouseholdState("income"))).toContain("per=household");
  const towns: HouseholdState = { ...defaultHouseholdState("income"), selectedIds: ["income.total", "settlement.urban"] };
  expect(parseHouseholdHash(`#${serializeHouseholdHash(towns)}`, "income", facts)).toEqual(towns);
  expect(parseHouseholdHash("#sel=", "income", facts).selectedIds).toEqual([]);
  expect(parseHouseholdHash("#area=region.mars", "income", facts)).toMatchObject({ area: "georgia", measure: "per_household", selectedIds: ["income.total"] });
  expect(parseHouseholdHash("#per=nonsense", "income", facts)).toMatchObject({ measure: "per_household" });
  const spending = serializeHouseholdHash(defaultHouseholdState("spending"));
  expect(parseHouseholdHash(`#${spending}`, "spending", facts)).toEqual(defaultHouseholdState("spending"));
});

test("old links: a towns or villages area opens Georgia, and the tab is ignored", () => {
  expect(parseHouseholdHash("#tab=parts&area=settlement.rural&per=person&sel=income.total,income.wages", "income", facts)).toEqual({
    mode: "line", area: "georgia", measure: "per_capita", range: { kind: "all" }, selectedIds: ["income.total", "income.wages"],
  });
  expect(parseHouseholdHash("#tab=parts&area=settlement.urban", "income", facts).area).toBe("georgia");
  expect(parseHouseholdHash("#tab=parts&area=region.guria&sel=income.total", "income", facts)).toMatchObject({ area: "region.guria", selectedIds: ["income.total"] });
  // The old Regions tab's selection named areas: Georgia's towns and villages lines remain, other ids are dropped.
  expect(parseHouseholdHash("#tab=areas&per=household&sel=georgia,region.tbilisi,settlement.urban", "income", facts)).toMatchObject({ area: "georgia", selectedIds: ["settlement.urban"] });
});

test("a selection naming nothing the area has falls back to the first series, while an empty one stays empty", () => {
  expect(parseHouseholdHash("#tab=areas&per=household&sel=georgia,region.tbilisi", "income", facts).selectedIds).toEqual(["income.total"]);
  expect(parseHouseholdHash("#area=region.guria&sel=settlement.urban", "spending", facts).selectedIds).toEqual(["spending.consumption"]);
  expect(parseHouseholdHash("#area=region.guria&sel=", "income", facts).selectedIds).toEqual([]);
  expect(parseHouseholdHash("#sel=", "income", facts).selectedIds).toEqual([]);
});

test("the model carries published values for the chosen measure", () => {
  const perHousehold = buildHouseholdModel("income", facts, defaultHouseholdState("income"));
  expect(perHousehold.selected[0].endValue).toBe(2025.8);
  expect(perHousehold.years).toEqual(Array.from({ length: 24 }, (_, i) => 2002 + i));
  const perPerson = buildHouseholdModel("income", facts, { ...defaultHouseholdState("income"), measure: "per_capita" });
  expect(perPerson.selected[0].endValue).toBe(630.7);
  expect(buildHouseholdModel("spending", facts, defaultHouseholdState("spending")).selected[0].endValue).toBe(1438.7);
  expect(perHousehold.series.filter(s => s.parentId === "income.total")).toHaveLength(8);
  expect(perHousehold.series[0].color).not.toBe(perHousehold.series[1].color);
});

test("towns and villages leave their years before 2006 empty in Georgia's model, never zero", () => {
  const model = buildHouseholdModel("income", facts, { ...defaultHouseholdState("income"), selectedIds: ["income.total", "settlement.urban", "settlement.rural"] });
  expect(model.range).toMatchObject({ start: 2002, end: 2025 });
  const towns = model.series.find(s => s.id === "settlement.urban")!;
  expect(towns.valuesByYear[2005]).toBeNull();
  expect(towns.valuesByYear[2006]).not.toBeNull();
  expect(model.selected.map(s => s.id)).toEqual(["income.total", "settlement.urban", "settlement.rural"]);
  expect(model.selected.map(s => s.color)).toHaveLength(new Set(model.selected.map(s => s.color)).size);
});

test("the Regions map colours the eleven regions by the section total in the latest year all of them have, as published", () => {
  const income = buildHouseholdRegionMapModel("income", "per_household", facts);
  expect(income.year).toBe(2025);
  expect(income.regions).toHaveLength(11);
  expect(new Set(income.regions.map(region => region.regionId))).toEqual(new Set(HOUSEHOLD_AREAS.filter(area => area.startsWith("region."))));
  expect(income.regions.find(region => region.regionId === "region.tbilisi")!.value).toBe(2317.5);
  expect(income.regions.map(region => region.rank)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
  expect(income.regions[0].value).toBe(Math.max(...income.regions.map(region => region.value)));
  expect(income.regions.every((region, i) => i === 0 || income.regions[i - 1].value >= region.value)).toBe(true);
  expect([income.legendMin, income.legendMax]).toEqual([income.regions.at(-1)!.value, income.regions[0].value]);
  expect(income.regions.every(region => region.pathD.startsWith("M") && region.bucket >= 0 && region.bucket <= 5)).toBe(true);
  const perPerson = buildHouseholdRegionMapModel("income", "per_capita", facts);
  expect(perPerson.regions.find(region => region.regionId === "region.tbilisi")!.value).toBe(745.4);
  expect(perPerson.regions.map(region => region.value)).not.toEqual(income.regions.map(region => region.value));
  expect(buildHouseholdRegionMapModel("spending", "per_household", facts).regions.every(region => region.value > 0)).toBe(true);
  // A year missing one region is not a map year: the map falls back to the latest complete one.
  const withoutGuria2025 = facts.filter(f => !(f.year === 2025 && f.areaId === "region.guria"));
  expect(buildHouseholdRegionMapModel("income", "per_household", withoutGuria2025).year).toBe(2024);
});

const SOURCES = HOUSEHOLD_SOURCES.map(sourceId => ({
  sourceId, years: Array.from({ length: 24 }, (_, i) => 2002 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-11",
  downloadHref: `/downloads/methodology/household/files/${sourceId}.xlsx` as const,
}));
const presentationFor = async (locale: Locale): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["household", "workbook", "format", "common"]) });
const labelsFor = (ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, `label ${id}`]));

test.each(["ka", "en"] as const)("the %s income workbook for Georgia with towns and villages keeps three lines over seven years and only the national and settlement sources", async (locale: Locale) => {
  const ids = ["income.total", "settlement.urban", "settlement.rural"];
  const presentation = await presentationFor(locale);
  const model = buildHouseholdWorkbookExportModel({
    section: "income", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Georgia",
    state: { mode: "table", area: "georgia", measure: "per_household", range: { kind: "manual", start: 2019, end: 2025 }, selectedIds: ids },
  }, presentation);
  expect(model.filename).toBe(`fiscal-household-income-georgia-per_household-2019-2025${locale === "en" ? "-en" : ""}.xlsx`);
  expect(model.readable.years).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  expect(model.readable.rows).toHaveLength(3);
  expect(model.readable.numberFormat).toBe("0.0");
  expect(model.readable.unitLabel).toBe("₾");
  expect(model.analysis.rows).toHaveLength(21);
  expect(model.analysis.numericFormats).toEqual({ 3: "0.0" });
  expect(model.analysis.headers.join(" ")).not.toMatch(/source_cell|sheet|source_id/i);
  expect(model.readable.rows.map(row => row.kind)).toEqual(["total", "group", "group"]);
  expect(model.analysis.rows.at(-1)!.slice(0, 3)).toEqual([2025, "label settlement.rural", expect.any(Number)]);
  expect(model.analysis.rows.at(-3)![3]).toBe(message(presentation.messages, "household.status.survey_estimate"));
  expect(model.sources.map(source => source.title)).toEqual(["geostat_household_income_household_national", "geostat_household_income_household_settlement"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/household/files/geostat_household_income_household_national.xlsx");
});

test("the workbook title names the page, its list, the area and the measure", async () => {
  const presentation = await presentationFor("en");
  const model = buildHouseholdWorkbookExportModel({
    section: "income", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(["income.total"]), areaLabel: "Guria",
    state: { ...defaultHouseholdState("income"), area: "region.guria", measure: "per_capita", range: { kind: "manual", start: 2020, end: 2021 } },
  }, presentation);
  expect(model.readable.title).toBe("Income · Where it comes from · Guria · Per person");
  expect(model.filename).toBe("fiscal-household-income-region-guria-per_capita-2020-2021-en.xlsx");
  const custom = buildHouseholdWorkbookExportModel({
    section: "spending", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(["spending.consumption"]), areaLabel: "Georgia", title: "Custom",
    state: { ...defaultHouseholdState("spending"), range: { kind: "manual", start: 2020, end: 2021 } },
  }, presentation);
  expect(custom.readable.title).toBe("Custom · What it’s spent on · Georgia · Per household");
});

test("a spending workbook for a region per person lists only that source", async () => {
  const ids = ["spending.consumption", "spending.food"];
  const model = buildHouseholdWorkbookExportModel({
    section: "spending", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Guria",
    state: { mode: "table", area: "region.guria", measure: "per_capita", range: { kind: "manual", start: 2020, end: 2025 }, selectedIds: ids },
  }, await presentationFor("en"));
  expect(model.sources.map(source => source.title)).toEqual(["geostat_household_spending_capita_region"]);
  expect(model.readable.rows.map(row => [row.kind, row.parentLabel])).toEqual([["total", null], ["item", "label spending.consumption"]]);
});

test("a missing early towns year is a blank cell, never zero, and the numeric format reaches the value cells", async () => {
  const ids = ["income.total", "settlement.urban"];
  const model = buildHouseholdWorkbookExportModel({
    section: "income", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Georgia",
    state: { mode: "table", area: "georgia", measure: "per_household", range: { kind: "manual", start: 2005, end: 2006 }, selectedIds: ids },
  }, await presentationFor("en"));
  const gap = model.analysis.rows.find(row => row[0] === 2005 && row[1] === "label settlement.urban")!;
  expect(gap[2]).toBeNull();
  expect(gap[3]).toBe("Not available");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  const data = excel.getWorksheet("Data")!;
  const header = data.getRow(1).values as unknown[];
  expect(header[3]).toBe("Amount (₾ a month)");
  for (let row = 2; row <= model.analysis.rows.length + 1; row++) expect(data.getCell(row, 3).numFmt).toBe("0.0");
  const gapRow = model.analysis.rows.indexOf(gap) + 2;
  expect(data.getCell(gapRow, 3).value).toBeNull();
  expect(data.getCell(2, 1).numFmt).not.toBe("0.0");
  expect(data.getCell(2, 3).type).toBe(ExcelJS.ValueType.Number);
});

test.each(["ka", "en"] as const)("the %s income workbook lists validated links to the archived Geostat workbooks it was built from", async (locale: Locale) => {
  const root = path.resolve(process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(root, "household-income"), loadEnglishCatalogue(root)]);
  const sources = householdWorkbookSources(manifest, projectPublicSources(manifest, locale, catalogue.documents));
  // Only the twelve served workbooks, not the population totals, page captures or metadata.
  expect(sources.map(source => source.sourceId).sort()).toEqual([...HOUSEHOLD_SOURCES].sort());
  const ids = ["income.total", "settlement.urban"];
  const model = buildHouseholdWorkbookExportModel({
    section: "income", facts, sources, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Georgia",
    state: { mode: "table", area: "georgia", measure: "per_capita", range: { kind: "manual", start: 2019, end: 2025 }, selectedIds: ids },
  }, await presentationFor(locale));
  expect(model.sources.map(source => source.absoluteUrl)).toEqual([
    "https://fiscal.ge/downloads/methodology/household-income/files/107-income-per-capita.xlsx",
    "https://fiscal.ge/downloads/methodology/household-income/files/108-income-per-capita-settlement.xlsx",
  ]);
  expect(model.sources.every(source => source.organization && source.title && source.retrievedAt === "2026-10-11")).toBe(true);
  expect(model.sources[0].title).toBe(locale === "en" ? "Distribution of average monthly incomes per capita" : "ერთ სულ მოსახლეზე საშუალო თვიური შემოსავლების განაწილება");
});

test("the hub has an income and a spending card with Georgia per-household sparklines", async () => {
  const cards = buildHouseholdHubCards(facts, await presentationFor("en"));
  expect(cards.map(card => card.href)).toEqual(["/explorer/living-standards/income", "/explorer/living-standards/spending"]);
  expect(cards.map(card => card.footer)).toEqual(["2025 · 2,025.8 ₾ · 2002–2025", "2025 · 1,438.7 ₾ · 2002–2025"]);
  expect(cards.map(card => card.series?.length)).toEqual([24, 24]);
  expect(cards.map(card => card.index)).toEqual(["01", "02"]);
});
