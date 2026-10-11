import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadEnergyFoodFacts, toClientEnergyFoodFact } from "../../lib/data/energyFood/importEnergyFood";
import type { ClientEnergyFoodFact } from "../../lib/data/energyFood/types";
import {
  buildEnergyFoodModel, defaultEnergyFoodState, energyFoodCoverage, energyFoodSeries, energyFoodUnit,
  ENERGY_FOOD_HUB_PATH, ENERGY_FOOD_SECTIONS, parseEnergyFoodHash, serializeEnergyFoodHash, type EnergyFoodSectionId,
} from "../../lib/explorer/energyFood";
import { EDITORIAL_PALETTE, INK } from "../../lib/explorer/colors";
import { buildEnergyFoodHubCards } from "../../lib/explorer/energyFoodHubCards";
import { buildEnergyFoodWorkbookExportModel } from "../../lib/explorer/energyFoodWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import { contrastRatio } from "../helpers/contrast";

let facts: ClientEnergyFoodFact[];
beforeAll(async () => { facts = (await loadEnergyFoodFacts()).map(toClientEnergyFoodFact); });

test("the hub has four sections with their routes, labels and units", () => {
  expect(ENERGY_FOOD_HUB_PATH).toBe("/explorer/energy-food");
  expect(ENERGY_FOOD_SECTIONS).toEqual([
    { id: "energy-supply", href: "/explorer/energy-food/energy-supply", labelKey: "common.energySupply" },
    { id: "electricity", href: "/explorer/energy-food/electricity", labelKey: "common.electricity" },
    { id: "energy-use", href: "/explorer/energy-food/energy-use", labelKey: "common.energyUse" },
    { id: "food-self-sufficiency", href: "/explorer/energy-food/food-self-sufficiency", labelKey: "common.foodSelfSufficiency" },
  ]);
  expect(ENERGY_FOOD_SECTIONS.map(s => energyFoodUnit(s.id))).toEqual(["ktoe", "gwh", "ktoe", "percent"]);
});

test("each page starts with only its reference selected and coverage taken from the facts", () => {
  expect(defaultEnergyFoodState("energy-supply")).toEqual({ mode: "line", range: { kind: "all" }, selectedIds: ["energy.supply.total"] });
  expect(defaultEnergyFoodState("food-self-sufficiency")).toEqual({ mode: "line", range: { kind: "all" }, selectedIds: ["food.self_sufficiency.wheat"] });
  expect(defaultEnergyFoodState("electricity").selectedIds).toEqual(["electricity.production.total"]);
  expect(defaultEnergyFoodState("energy-use").selectedIds).toEqual(["energy.final.total"]);
  expect(energyFoodCoverage("energy-supply", facts)).toMatchObject({ min: 2013, max: 2024 });
  expect(energyFoodCoverage("food-self-sufficiency", facts)).toMatchObject({ min: 2014, max: 2025 });
  expect(defaultEnergyFoodState("energy-supply")).not.toHaveProperty("view");
});

test("series follow the brief's order, and every id is a distinct indicator of the section's unit", () => {
  const ids = (section: EnergyFoodSectionId) => energyFoodSeries(section).map(s => s.id);
  expect(ids("energy-supply")).toEqual([
    "energy.supply.total", "energy.supply.natural_gas", "energy.supply.oil_products", "energy.supply.hydro", "energy.supply.biofuel_waste", "energy.supply.coal",
    "energy.supply.crude_oil", "energy.supply.wind_solar_geothermal", "energy.supply.electricity",
    "energy.production.total",
    "energy.imports.total", "energy.imports.natural_gas", "energy.imports.oil_products", "energy.imports.coal", "energy.imports.crude_oil", "energy.imports.electricity",
    "energy.exports.total",
  ]);
  expect(ids("electricity")).toEqual([
    "electricity.production.total", "electricity.production.hydro", "electricity.production.thermal", "electricity.production.wind",
    "electricity.imports", "electricity.exports",
    "electricity.final.total", "electricity.final.households", "electricity.final.commercial_public", "electricity.final.industry", "electricity.final.transport",
    "electricity.final.agriculture", "electricity.final.other_unspecified",
    "electricity.losses",
  ]);
  expect(ids("energy-use")).toEqual([
    "energy.final.total", "energy.final.households", "energy.final.transport", "energy.final.industry", "energy.final.commercial_public",
    "energy.final.agriculture", "energy.final.other_unspecified", "energy.final.non_energy",
    "energy.final_fuel.natural_gas", "energy.final_fuel.oil_products", "energy.final_fuel.electricity", "energy.final_fuel.biofuel_waste",
    "energy.final_fuel.coal", "energy.final_fuel.wind_solar_geothermal",
  ]);
  expect(ids("food-self-sufficiency")).toEqual([
    "food.self_sufficiency.wheat", "food.self_sufficiency.maize", "food.self_sufficiency.potato", "food.self_sufficiency.vegetables", "food.self_sufficiency.grapes",
    "food.self_sufficiency.meat", "food.self_sufficiency.beef", "food.self_sufficiency.pork", "food.self_sufficiency.sheep_goat_meat", "food.self_sufficiency.poultry_meat",
    "food.self_sufficiency.milk", "food.self_sufficiency.eggs",
  ]);
  // Every defined series has facts, and each section's references are exactly its first row.
  const factIds = new Set(facts.map(f => f.indicatorId));
  for (const { id } of ENERGY_FOOD_SECTIONS) {
    expect(energyFoodSeries(id).every(s => factIds.has(s.id))).toBe(true);
    expect(energyFoodSeries(id).filter(s => s.reference).map(s => s.id)).toEqual([energyFoodSeries(id)[0].id]);
  }
  // Together the four sections cover every indicator exactly once.
  const all = ENERGY_FOOD_SECTIONS.flatMap(s => ids(s.id));
  expect(new Set(all).size).toBe(all.length);
  expect(new Set(all)).toEqual(factIds);
});

test("children nest under their parent and the top-level rows are counted per page", () => {
  const top = (section: EnergyFoodSectionId) => energyFoodSeries(section).filter(s => !s.parentId);
  expect(top("food-self-sufficiency")).toHaveLength(8);
  const foodParents = new Set(energyFoodSeries("food-self-sufficiency").flatMap(s => (s.parentId ? [s.parentId] : [])));
  expect([...foodParents]).toEqual(["food.self_sufficiency.meat"]);
  expect(energyFoodSeries("food-self-sufficiency").filter(s => s.parentId === "food.self_sufficiency.meat").map(s => s.id)).toEqual([
    "food.self_sufficiency.beef", "food.self_sufficiency.pork", "food.self_sufficiency.sheep_goat_meat", "food.self_sufficiency.poultry_meat",
  ]);
  expect(top("electricity").map(s => s.id)).toEqual(["electricity.production.total", "electricity.imports", "electricity.exports", "electricity.final.total", "electricity.losses"]);
  expect(top("energy-supply")).toHaveLength(4);
  expect(top("energy-use")).toHaveLength(7);
  expect(energyFoodSeries("energy-supply").filter(s => s.parentId === "energy.imports.total")).toHaveLength(5);
  expect(energyFoodSeries("energy-supply").filter(s => s.parentId === "energy.supply.total")).toHaveLength(8);
  expect(energyFoodSeries("electricity").filter(s => s.parentId === "electricity.final.total")).toHaveLength(6);
  // A child never has a reference flag, and its parent precedes it in the list.
  for (const { id } of ENERGY_FOOD_SECTIONS) {
    const list = energyFoodSeries(id);
    for (const s of list.filter(item => item.parentId)) {
      expect(s.reference).toBe(false);
      expect(list.findIndex(item => item.id === s.parentId)).toBeGreaterThanOrEqual(0);
      expect(list.findIndex(item => item.id === s.parentId)).toBeLessThan(list.indexOf(s));
    }
  }
});

test("wind has no rows before 2016, so its early years are gaps rather than zeros", () => {
  const state = parseEnergyFoodHash("#start=2013&end=2015&sel=electricity.production.wind", "electricity", facts);
  expect(state.selectedIds).toEqual(["electricity.production.wind"]);
  const model = buildEnergyFoodModel("electricity", facts, state);
  expect(model.years).toEqual([2013, 2014, 2015]);
  const wind = model.selected.find(s => s.id === "electricity.production.wind")!;
  expect(Object.values(wind.valuesByYear)).toEqual([null, null, null]);
  expect(wind.endValue).toBeNull();
});

test("the hash round-trips, drops unknown ids, keeps an explicit empty selection and never writes tab", () => {
  const state = { mode: "table" as const, range: { kind: "manual" as const, start: 2015, end: 2020 }, selectedIds: ["electricity.production.total", "electricity.final.households"] };
  const hash = serializeEnergyFoodHash(state, "electricity");
  expect(hash).not.toContain("tab=");
  expect(parseEnergyFoodHash(`#${hash}`, "electricity", facts)).toEqual(state);
  expect(parseEnergyFoodHash("#sel=", "energy-supply", facts).selectedIds).toEqual([]);
  expect(parseEnergyFoodHash("#sel=energy.supply.total,not.a.series,food.self_sufficiency.wheat", "energy-supply", facts).selectedIds).toEqual(["energy.supply.total"]);
  expect(parseEnergyFoodHash("", "food-self-sufficiency", facts)).toEqual(defaultEnergyFoodState("food-self-sufficiency"));
  const full = serializeEnergyFoodHash(defaultEnergyFoodState("energy-use"), "energy-use");
  expect(full).not.toContain("tab=");
  expect(parseEnergyFoodHash(`#${full}`, "energy-use", facts)).toEqual(defaultEnergyFoodState("energy-use"));
  // A legacy tab key is ignored, not an error and not echoed back.
  const legacy = parseEnergyFoodHash("#tab=main&sel=energy.final.households", "energy-use", facts);
  expect(legacy).toMatchObject({ mode: "line", selectedIds: ["energy.final.households"] });
  expect(serializeEnergyFoodHash(legacy, "energy-use")).not.toContain("tab=");
});

test("a range outside the coverage is refitted and a full range collapses to all", () => {
  expect(parseEnergyFoodHash("#start=2000&end=2030", "energy-supply", facts).range).toEqual({ kind: "all" });
  expect(parseEnergyFoodHash("#start=2013&end=2024", "energy-supply", facts).range).toEqual({ kind: "all" });
  expect(parseEnergyFoodHash("#start=2016&end=2020", "energy-supply", facts).range).toEqual({ kind: "manual", start: 2016, end: 2020 });
});

test("end values are the published figures", () => {
  const supply = buildEnergyFoodModel("energy-supply", facts, defaultEnergyFoodState("energy-supply"));
  expect(supply.range).toMatchObject({ start: 2013, end: 2024 });
  expect(supply.series.find(s => s.id === "energy.supply.total")!.endValue).toBe(5914.5);
  const electricity = buildEnergyFoodModel("electricity", facts, defaultEnergyFoodState("electricity"));
  expect(electricity.series.find(s => s.id === "electricity.production.total")!.endValue).toBe(14234.1);
  const food = buildEnergyFoodModel("food-self-sufficiency", facts, defaultEnergyFoodState("food-self-sufficiency"));
  expect(food.series.find(s => s.id === "food.self_sufficiency.wheat")!.endValue).toBe(19);
});

test("negative electricity supply passes through unclipped, in 2016 and 2023", () => {
  const model = buildEnergyFoodModel("energy-supply", facts, { mode: "line", range: { kind: "all" }, selectedIds: ["energy.supply.electricity"] });
  expect(model.selected.map(s => s.id)).toEqual(["energy.supply.electricity"]);
  const { valuesByYear } = model.selected[0];
  expect(valuesByYear[2016]!).toBeLessThan(0);
  expect(valuesByYear[2023]!).toBeLessThan(0);
  expect(valuesByYear[2024]!).toBeGreaterThan(0);
  const to2023 = buildEnergyFoodModel("energy-supply", facts, { mode: "line", range: { kind: "manual", start: 2013, end: 2023 }, selectedIds: ["energy.supply.electricity"] });
  expect(to2023.selected[0].endValue!).toBeLessThan(0);
});

test("the model lists every series of the page, colours the reference ink and takes decimals from the selection", () => {
  const model = buildEnergyFoodModel("energy-supply", facts, defaultEnergyFoodState("energy-supply"));
  expect(model.series.map(s => s.id)).toEqual(energyFoodSeries("energy-supply").map(s => s.id));
  expect(model.series[0].color).toBe(INK);
  expect(model.series[1].color).toBe("#B3402A");
  expect(model.decimals).toBe(1);
  expect(buildEnergyFoodModel("food-self-sufficiency", facts, defaultEnergyFoodState("food-self-sufficiency")).decimals).toBe(0);
  expect(buildEnergyFoodModel("food-self-sufficiency", facts, { ...defaultEnergyFoodState("food-self-sufficiency"), selectedIds: [] }).decimals).toBe(0);
});

test("within a page every non-reference series has its own readable colour, even with all selected", () => {
  for (const { id } of ENERGY_FOOD_SECTIONS) {
    const model = buildEnergyFoodModel(id, facts, { ...defaultEnergyFoodState(id), selectedIds: energyFoodSeries(id).map(s => s.id) });
    const others = model.series.filter(s => !s.reference).map(s => s.color);
    expect(model.series.filter(s => s.reference).map(s => s.color), id).toEqual([INK]);
    expect(new Set(others).size, id).toBe(others.length);
    expect(others, id).not.toContain(INK);
    for (const hex of others) {
      expect(contrastRatio(hex, "#F7F2E9"), `${id} ${hex} on paper`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(hex, "#F1EADC"), `${id} ${hex} on tint`).toBeGreaterThanOrEqual(3);
    }
  }
  // Energy supply is the page that outgrows the 14-colour editorial palette: 16 non-reference series.
  const supply = buildEnergyFoodModel("energy-supply", facts, defaultEnergyFoodState("energy-supply")).series.filter(s => !s.reference);
  expect(supply).toHaveLength(16);
  expect(supply.slice(0, 14).map(s => s.color)).toEqual(EDITORIAL_PALETTE);
  expect(supply.slice(14).map(s => s.color)).toEqual(["#0D89C2", "#474A02"]);
});

// The energyFood message namespace arrives with the copy; these are the keys the workbook and the cards read.
const COPY: Record<Locale, Record<string, string>> = {
  en: {
    "energyFood.unit.ktoe": "ktoe", "energyFood.unit.gwh": "GWh", "energyFood.unit.percent": "%", "energyFood.series": "Series",
    "energyFood.status.published": "Published", "energyFood.status.no_flow": "No flow",
    "common.energySupply": "Energy supply", "common.electricity": "Electricity", "common.energyUse": "Energy use", "common.foodSelfSufficiency": "Food self-sufficiency",
    ...Object.fromEntries(ENERGY_FOOD_SECTIONS.flatMap(({ id }) => [[`energyFood.page.${id}.title`, `${id} title`], [`energyFood.page.${id}.summary`, `${id} summary`]])),
  },
  ka: {
    "energyFood.unit.ktoe": "ktoe", "energyFood.unit.gwh": "GWh", "energyFood.unit.percent": "%", "energyFood.series": "სერია",
    "energyFood.status.published": "გამოქვეყნებული", "energyFood.status.no_flow": "ნაკადი არ არის",
    "common.energySupply": "ენერგიის მიწოდება", "common.electricity": "ელექტროენერგია", "common.energyUse": "ენერგიის მოხმარება", "common.foodSelfSufficiency": "სურსათის თვითუზრუნველყოფა",
    ...Object.fromEntries(ENERGY_FOOD_SECTIONS.flatMap(({ id }) => [[`energyFood.page.${id}.title`, `${id} სათაური`], [`energyFood.page.${id}.summary`, `${id} აღწერა`]])),
  },
};
const presentationFor = async (locale: Locale): Promise<Presentation> => ({ locale, englishLabels: {}, messages: { ...(await getMessages(locale, ["workbook", "format"])), ...COPY[locale] } });
const sourceFor = (sourceId: string, years: number[]) => ({
  sourceId, years, title: sourceId, organization: "Geostat", retrievedAt: "2026-10-11",
  downloadHref: `/downloads/methodology/energy-food/files/${sourceId}.xlsx` as const,
});
const BALANCE_YEARS = Array.from({ length: 12 }, (_, i) => 2013 + i);
const SOURCES = [
  ...BALANCE_YEARS.map(year => sourceFor(`geostat_energy_balance_${year}_aggregated`, [year])),
  ...BALANCE_YEARS.map(year => sourceFor(`geostat_energy_balance_${year}_electricity`, [year])),
  sourceFor("geostat_food_balance_sheets", Array.from({ length: 12 }, (_, i) => 2014 + i)),
];
const loadWorkbook = async (model: Parameters<typeof createWorkbookBuffer>[0]) => { const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model)); return excel; };

test.each(["en", "ka"] as const)("the %s energy-supply workbook keeps two series over five years and only the five balance sources", async (locale: Locale) => {
  const ids = ["energy.imports.total", "energy.imports.natural_gas"];
  const labels = { "energy.imports.total": "Imports", "energy.imports.natural_gas": "Natural gas imports" };
  const model = buildEnergyFoodWorkbookExportModel({
    section: "energy-supply", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels,
    state: { mode: "table", range: { kind: "manual", start: 2020, end: 2024 }, selectedIds: ids },
  }, await presentationFor(locale));
  expect(model.filename).toBe(`fiscal-energy-food-energy-supply-2020-2024${locale === "en" ? "-en" : ""}.xlsx`);
  expect(model.readable.years).toEqual([2020, 2021, 2022, 2023, 2024]);
  expect(model.readable.rows.map(row => row.label)).toEqual(["Imports", "Natural gas imports"]);
  expect(model.readable.rows.every(row => Object.keys(row.valuesByYear).length === 5)).toBe(true);
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.unitLabel).toBe(COPY[locale]["energyFood.unit.ktoe"]);
  expect(model.analysis.rows).toHaveLength(10);
  expect(model.analysis.headers).toHaveLength(4);
  expect(model.analysis.headers.join(" ")).not.toMatch(/source_cell|sheet|source_id/i);
  expect(model.sources.map(source => source.title)).toEqual([2020, 2021, 2022, 2023, 2024].map(year => `geostat_energy_balance_${year}_aggregated`));
  expect(model.sources.every(source => source.absoluteUrl === `https://fiscal.ge${source.downloadHref}`)).toBe(true);
  const excel = await loadWorkbook(model);
  expect(excel.worksheets).toHaveLength(3);
});

test("the analysis sheet formats exactly its value column, whichever section it is", async () => {
  for (const [section, format] of [["energy-supply", "#,##0.0"], ["electricity", "#,##0.0"], ["energy-use", "#,##0.0"], ["food-self-sufficiency", "0"]] as const) {
    const state = { ...defaultEnergyFoodState(section), range: { kind: "manual" as const, start: 2016, end: 2018 } };
    const model = buildEnergyFoodWorkbookExportModel({
      section, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { [state.selectedIds[0]]: "Total" }, state,
    }, await presentationFor("en"));
    const { headers, rows, numericFormats } = model.analysis;
    // The value column is the only one holding numbers other than the year, and it is the only one keyed.
    const valueColumns = headers.flatMap((_, i) => (i > 0 && rows.every(r => typeof r[i] === "number") ? [i + 1] : []));
    expect(valueColumns).toEqual([3]);
    expect(Object.keys(numericFormats ?? {}).map(Number)).toEqual(valueColumns);
    expect(numericFormats).toEqual({ 3: format });
    expect(model.readable.numberFormat).toBe(format);
    const sheet = (await loadWorkbook(model)).getWorksheet(model.sheetNames[1])!;
    for (let row = 2; row <= rows.length + 1; row++) {
      expect(sheet.getCell(row, 3).numFmt, `${section} value cell`).toBe(format);
      expect(sheet.getCell(row, 2).numFmt, `${section} label cell`).not.toBe(format);
    }
  }
});

test("gaps stay blank cells, a dash is a zero marked no flow and a published zero stays a zero", async () => {
  const electricity = buildEnergyFoodWorkbookExportModel({
    section: "electricity", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { "electricity.production.wind": "Wind" },
    state: { mode: "table", range: { kind: "manual", start: 2014, end: 2017 }, selectedIds: ["electricity.production.wind"] },
  }, await presentationFor("en"));
  expect(electricity.readable.rows[0].valuesByYear).toMatchObject({ 2014: null, 2015: null });
  expect(electricity.readable.rows[0].valuesByYear[2016]).toBeGreaterThan(0);
  expect(electricity.readable.rows[0].basisByYear).toMatchObject({ 2014: null, 2015: null, 2016: "published" });
  expect(electricity.analysis.rows.slice(0, 3).map(r => r.slice(2))).toEqual([[null, "Not available"], [null, "Not available"], [expect.any(Number), "Published"]]);
  // Only the years that have a value cite a source.
  expect(electricity.sources.map(source => source.title)).toEqual(["geostat_energy_balance_2016_electricity", "geostat_energy_balance_2017_electricity"]);
  const excel = await loadWorkbook(electricity);
  expect(excel.getWorksheet(electricity.sheetNames[1])!.getCell(2, 3).value).toBeNull();

  const crude = buildEnergyFoodWorkbookExportModel({
    section: "energy-supply", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { "energy.imports.crude_oil": "Crude oil imports", "energy.supply.crude_oil": "Crude oil supply" },
    state: { mode: "table", range: { kind: "manual", start: 2013, end: 2014 }, selectedIds: ["energy.imports.crude_oil", "energy.supply.crude_oil"] },
  }, await presentationFor("en"));
  const cell = (year: number, label: string) => crude.analysis.rows.find(r => r[0] === year && r[1] === label)!.slice(2);
  expect(cell(2013, "Crude oil supply")).toEqual([0, "No flow"]);
  expect(cell(2013, "Crude oil imports")).toEqual([0, "No flow"]);
  expect(cell(2014, "Crude oil supply")).toEqual([0, "Published"]);
});

test("the food workbook is whole numbers with the published wheat ratios, and a source missing from the list is an error", async () => {
  const model = buildEnergyFoodWorkbookExportModel({
    section: "food-self-sufficiency", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { "food.self_sufficiency.wheat": "Wheat" },
    state: { mode: "table", range: { kind: "manual", start: 2022, end: 2025 }, selectedIds: ["food.self_sufficiency.wheat"] },
  }, await presentationFor("en"));
  expect(model.filename).toBe("fiscal-energy-food-food-self-sufficiency-2022-2025-en.xlsx");
  expect(model.readable.numberFormat).toBe("0");
  expect(model.readable.amountDecimals).toBe(0);
  const wheat = (year: number) => model.analysis.rows.find(r => r[0] === year)!.slice(2);
  expect(wheat(2023)).toEqual([22, "Published"]);
  expect(wheat(2025)).toEqual([19, "Published"]);
  expect(model.sources.map(source => source.title)).toEqual(["geostat_food_balance_sheets"]);
  expect(model.sources[0].years).toEqual([2022, 2023, 2024, 2025]);
  expect(() => buildEnergyFoodWorkbookExportModel({
    section: "food-self-sufficiency", facts, sources: [], siteOrigin: "https://fiscal.ge", labels: {}, state: defaultEnergyFoodState("food-self-sufficiency"),
  }, { locale: "en", englishLabels: {}, messages: COPY.en })).toThrow(/geostat_food_balance_sheets/);
});

test("the hub has four cards with sparklines and the latest published values", async () => {
  const cards = buildEnergyFoodHubCards(facts, await presentationFor("en"));
  expect(cards.map(card => card.href)).toEqual(ENERGY_FOOD_SECTIONS.map(s => s.href));
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04"]);
  expect(cards.map(card => card.title)).toEqual(["Energy supply", "Electricity", "Energy use", "Food self-sufficiency"]);
  expect(cards.map(card => card.footer)).toEqual(["2024 · 5,914.5 · 2013–2024", "2024 · 14,234.1 · 2013–2024", "2024 · 5,456.7 · 2013–2024", "2025 · 19% · 2014–2025"]);
  expect(cards.map(card => card.series?.length)).toEqual([12, 12, 12, 12]);
  expect(cards.map(card => card.series!.at(-1))).toEqual([5914.5, 14234.1, 5456.7, 19]);
  expect(cards.every(card => card.comingSoon === false && card.seriesColor === INK)).toBe(true);
  expect(cards.map(card => card.description)).toEqual(ENERGY_FOOD_SECTIONS.map(s => `${s.id} summary`));
  const ka = buildEnergyFoodHubCards(facts, await presentationFor("ka"));
  expect(ka.map(card => card.footer)).toEqual(cards.map(card => card.footer));
});
