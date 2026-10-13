import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadServedHouseholdData, toClientHouseholdFact } from "../../lib/data/household/importHousehold";
import { HOUSEHOLD_AREAS, HOUSEHOLD_SOURCES, type ClientHouseholdFact } from "../../lib/data/household/types";
import {
  buildHouseholdModel, changeHouseholdMeasure, defaultHouseholdState, HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_SECTIONS,
  householdCoverage, householdMeasureHash, householdRegionHref, householdViewSeries, parseHouseholdHash, parseHouseholdMeasure, serializeHouseholdHash, serializeHouseholdMeasure, type HouseholdState,
} from "../../lib/explorer/household";
import { householdRegionPageMetadata, householdRegionStaticParams } from "../../lib/pages/household";
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
  expect(defaultHouseholdState("income")).toEqual({ mode: "line", range: { kind: "all" }, measure: "per_household", selectedIds: ["income.total"] });
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

test("Georgia and each region have their own page under the section, and a link to one carries only the per person choice", () => {
  expect(householdRegionHref("income", "georgia")).toBe("/explorer/living-standards/income/regions/georgia");
  expect(householdRegionHref("income", "region.guria")).toBe("/explorer/living-standards/income/regions/guria");
  expect(householdRegionHref("spending", "region.racha_lechkhumi_kvemo_svaneti")).toBe("/explorer/living-standards/spending/regions/racha_lechkhumi_kvemo_svaneti");
  expect(householdMeasureHash("per_household")).toBe("");
  expect(householdMeasureHash("per_capita")).toBe("#per=person");
  expect(parseHouseholdHash(householdMeasureHash("per_capita"), "income", "region.guria", facts).measure).toBe("per_capita");
  // Georgia first, then the eleven regions; towns and villages have no page.
  expect(HOUSEHOLD_PAGE_AREAS).toEqual(["georgia", ...HOUSEHOLD_AREAS.filter(area => area.startsWith("region."))]);
  const slugs = householdRegionStaticParams().map(params => params.id);
  expect(slugs).toHaveLength(12);
  expect(slugs.slice(0, 3)).toEqual(["georgia", "tbilisi", "adjara"]);
  expect(slugs.some(slug => slug.startsWith("settlement"))).toBe(false);
});

test("the index page keeps only the measure in its hash", () => {
  expect(serializeHouseholdMeasure("per_capita")).toBe("per=person");
  expect(serializeHouseholdMeasure("per_household")).toBe("per=household");
  expect(parseHouseholdMeasure("#per=person")).toBe("per_capita");
  expect(parseHouseholdMeasure("#per=household&view=table&sel=income.total")).toBe("per_household");
  expect(parseHouseholdMeasure("")).toBe("per_household");
  expect(parseHouseholdMeasure("#per=nonsense")).toBe("per_household");
});

test("Georgia's page has towns and villages as lines and starts in 2002", () => {
  const georgia = buildHouseholdModel("income", "georgia", facts.filter(f => ["georgia", "settlement.urban", "settlement.rural"].includes(f.areaId)), defaultHouseholdState("income"));
  expect(georgia.range).toMatchObject({ start: 2002, end: 2025 });
  expect(georgia.series.slice(-2).map(s => s.id)).toEqual(["settlement.urban", "settlement.rural"]);
});

test("a region page's model starts at the region's first year and has no towns or villages lines", () => {
  const guriaFacts = facts.filter(f => f.areaId === "region.guria");
  const guria = buildHouseholdModel("income", "region.guria", guriaFacts, defaultHouseholdState("income"));
  expect(guria.range).toMatchObject({ start: 2019, end: 2025 });
  expect(guria.series.some(s => s.areaId.startsWith("settlement."))).toBe(false);
  expect(guria.series.every(s => s.areaId === "region.guria")).toBe(true);
  expect(guria.selected.map(s => s.id)).toEqual(["income.total"]);
  expect(guria.selected[0].endValue).not.toBeNull();
  expect(buildHouseholdModel("spending", "region.kakheti", facts, defaultHouseholdState("spending")).range).toMatchObject({ start: 2011, end: 2025 });
  // A towns tick from a Georgia link is not a line a region page has: its selection falls back to the total.
  expect(parseHouseholdHash("#sel=settlement.urban", "income", "region.guria", guriaFacts).selectedIds).toEqual(["income.total"]);
  // A range the region's years miss shows all of them.
  expect(parseHouseholdHash("#start=2008&end=2012", "income", "region.guria", guriaFacts).range).toEqual({ kind: "all" });
});

test("changing measure keeps the selection", () => {
  const state: HouseholdState = { ...defaultHouseholdState("income"), selectedIds: ["income.total", "income.wages"] };
  expect(changeHouseholdMeasure(state, "income", "georgia", "per_capita", facts)).toMatchObject({ measure: "per_capita", selectedIds: ["income.total", "income.wages"] });
  expect(changeHouseholdMeasure(state, "income", "region.adjara", "per_capita", facts)).toMatchObject({ measure: "per_capita", selectedIds: ["income.total", "income.wages"] });
});

test("no two lines of Georgia's list share a colour, towns and villages included", () => {
  for (const section of ["income", "spending"] as const) {
    const series = buildHouseholdModel(section, "georgia", facts, defaultHouseholdState(section)).series;
    expect(series.map(s => s.id), section).toEqual(expect.arrayContaining(["settlement.urban", "settlement.rural"]));
    expect(new Set(series.map(s => s.color)).size, section).toBe(series.length);
  }
});

test("the hash round-trips and keeps an explicit empty selection, and no longer carries an area", () => {
  const state: HouseholdState = { mode: "table", measure: "per_capita", range: { kind: "manual", start: 2014, end: 2020 }, selectedIds: ["income.total", "income.remittances"] };
  const hash = serializeHouseholdHash(state);
  expect(hash).not.toContain("area=");
  expect(hash).toContain("per=person");
  expect(hash).not.toContain("tab=");
  expect(parseHouseholdHash(`#${hash}`, "income", "region.adjara", facts)).toEqual(state);
  expect(serializeHouseholdHash(defaultHouseholdState("income"))).toContain("per=household");
  const towns: HouseholdState = { ...defaultHouseholdState("income"), selectedIds: ["income.total", "settlement.urban"] };
  expect(parseHouseholdHash(`#${serializeHouseholdHash(towns)}`, "income", "georgia", facts)).toEqual(towns);
  expect(parseHouseholdHash("#sel=", "income", "georgia", facts).selectedIds).toEqual([]);
  expect(parseHouseholdHash("#per=nonsense", "income", "georgia", facts)).toMatchObject({ measure: "per_household" });
  const spending = serializeHouseholdHash(defaultHouseholdState("spending"));
  expect(parseHouseholdHash(`#${spending}`, "spending", "georgia", facts)).toEqual(defaultHouseholdState("spending"));
});

test("old preview links: the tab and the area are ignored, and the page shows its own area", () => {
  expect(parseHouseholdHash("#tab=parts&area=settlement.rural&per=person&sel=income.total,income.wages", "income", "georgia", facts)).toEqual({
    mode: "line", measure: "per_capita", range: { kind: "all" }, selectedIds: ["income.total", "income.wages"],
  });
  expect(parseHouseholdHash("#area=region.guria&sel=income.total,settlement.urban", "income", "georgia", facts).selectedIds).toEqual(["income.total", "settlement.urban"]);
  // The old Regions tab's selection named areas: Georgia's towns and villages lines remain, other ids are dropped.
  expect(parseHouseholdHash("#tab=areas&per=household&sel=georgia,region.tbilisi,settlement.urban", "income", "georgia", facts).selectedIds).toEqual(["settlement.urban"]);
});

test("a selection naming nothing the area has falls back to the first series, while an empty one stays empty", () => {
  expect(parseHouseholdHash("#tab=areas&per=household&sel=georgia,region.tbilisi", "income", "georgia", facts).selectedIds).toEqual(["income.total"]);
  expect(parseHouseholdHash("#sel=settlement.urban", "spending", "region.guria", facts).selectedIds).toEqual(["spending.consumption"]);
  expect(parseHouseholdHash("#sel=", "income", "region.guria", facts).selectedIds).toEqual([]);
  expect(parseHouseholdHash("#sel=", "income", "georgia", facts).selectedIds).toEqual([]);
});

test("the model carries published values for the chosen measure", () => {
  const perHousehold = buildHouseholdModel("income", "georgia", facts, defaultHouseholdState("income"));
  expect(perHousehold.selected[0].endValue).toBe(2025.8);
  expect(perHousehold.years).toEqual(Array.from({ length: 24 }, (_, i) => 2002 + i));
  const perPerson = buildHouseholdModel("income", "georgia", facts, { ...defaultHouseholdState("income"), measure: "per_capita" });
  expect(perPerson.selected[0].endValue).toBe(630.7);
  expect(buildHouseholdModel("spending", "georgia", facts, defaultHouseholdState("spending")).selected[0].endValue).toBe(1438.7);
  expect(perHousehold.series.filter(s => s.parentId === "income.total")).toHaveLength(8);
  expect(perHousehold.series[0].color).not.toBe(perHousehold.series[1].color);
});

test("towns and villages leave their years before 2006 empty in Georgia's model, never zero", () => {
  const model = buildHouseholdModel("income", "georgia", facts, { ...defaultHouseholdState("income"), selectedIds: ["income.total", "settlement.urban", "settlement.rural"] });
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
    section: "income", area: "georgia", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Georgia",
    state: { mode: "table", measure: "per_household", range: { kind: "manual", start: 2019, end: 2025 }, selectedIds: ids },
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
    section: "income", area: "region.guria", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(["income.total"]), areaLabel: "Guria",
    state: { ...defaultHouseholdState("income"), measure: "per_capita", range: { kind: "manual", start: 2020, end: 2021 } },
  }, presentation);
  expect(model.readable.title).toBe("Income · Where it comes from · Guria · Per person");
  expect(model.filename).toBe("fiscal-household-income-region-guria-per_capita-2020-2021-en.xlsx");
  const custom = buildHouseholdWorkbookExportModel({
    section: "spending", area: "georgia", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(["spending.consumption"]), areaLabel: "Georgia", title: "Custom",
    state: { ...defaultHouseholdState("spending"), range: { kind: "manual", start: 2020, end: 2021 } },
  }, presentation);
  expect(custom.readable.title).toBe("Custom · What it’s spent on · Georgia · Per household");
});

test("a spending workbook for a region per person lists only that source", async () => {
  const ids = ["spending.consumption", "spending.food"];
  const model = buildHouseholdWorkbookExportModel({
    section: "spending", area: "region.guria", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Guria",
    state: { mode: "table", measure: "per_capita", range: { kind: "manual", start: 2020, end: 2025 }, selectedIds: ids },
  }, await presentationFor("en"));
  expect(model.sources.map(source => source.title)).toEqual(["geostat_household_spending_capita_region"]);
  expect(model.readable.rows.map(row => [row.kind, row.parentLabel])).toEqual([["total", null], ["item", "label spending.consumption"]]);
});

test("a missing early towns year is a blank cell, never zero, and the numeric format reaches the value cells", async () => {
  const ids = ["income.total", "settlement.urban"];
  const model = buildHouseholdWorkbookExportModel({
    section: "income", area: "georgia", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Georgia",
    state: { mode: "table", measure: "per_household", range: { kind: "manual", start: 2005, end: 2006 }, selectedIds: ids },
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
    section: "income", area: "georgia", facts, sources, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), areaLabel: "Georgia",
    state: { mode: "table", measure: "per_capita", range: { kind: "manual", start: 2019, end: 2025 }, selectedIds: ids },
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

// U19-04: on a budget site "Spending — Tbilisi" reads as the municipality's budget, so the area pages' titles say "household".
test.each([
  ["en", "spending", "tbilisi", "Household spending — Tbilisi"],
  ["en", "income", "georgia", "Household income — Georgia"],
  ["ka", "spending", "tbilisi", "შინამეურნეობების ხარჯები — თბილისი"],
  ["ka", "income", "georgia", "შინამეურნეობების შემოსავლები — საქართველო"],
] as const)("the %s %s page for %s is titled as household data", async (locale, section, slug, title) => {
  const metadata = await householdRegionPageMetadata(section, slug, locale);
  expect(metadata.title).toBe(title);
  expect(metadata.openGraph?.title).toBe(title);
});
