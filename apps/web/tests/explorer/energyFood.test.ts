import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadEnergyFoodFacts, toClientEnergyFoodFact } from "../../lib/data/energyFood/importEnergyFood";
import type { ClientEnergyFoodFact } from "../../lib/data/energyFood/types";
import {
  buildEnergyFoodModel, changeEnergyFoodSelection, defaultEnergyFoodState, energyFoodCoverage, energyFoodDisplayLabels, energyFoodGroup, energyFoodLastReviewedAt, energyFoodSeries,
  ENERGY_FOOD_SECTIONS, parseEnergyFoodHash, serializeEnergyFoodHash, type EnergyFoodSectionId,
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
  // Together the five sections cover every indicator exactly once.
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

test("the list keeps plain fuel names, and outside it no two series a chart can show together share a name", async () => {
  for (const locale of ["ka", "en"] as const) {
    const messages = await getMessages(locale, ["energyFood"]);
    for (const { id: section } of ENERGY_FOOD_SECTIONS) {
      const labels = Object.fromEntries(energyFoodSeries(section).map(s => [s.id, messages[`energyFood.series.${s.id}`]]));
      expect(Object.values(labels).every(Boolean), `${locale} ${section} labels`).toBe(true);
      const shown = energyFoodDisplayLabels(section, labels);
      // One chart holds one group (the four energy and food pages are one group each), so names are distinct per group.
      for (const group of new Set(energyFoodSeries(section).map(s => energyFoodGroup(s.id)))) {
        const ids = energyFoodSeries(section).filter(s => energyFoodGroup(s.id) === group).map(s => s.id);
        expect(new Set(ids.map(id => shown[id])).size, `${locale} ${section} ${group}`).toBe(ids.length);
      }
    }
  }
  const en = await getMessages("en", ["energyFood"]);
  const labels = Object.fromEntries(energyFoodSeries("energy-supply").map(s => [s.id, en[`energyFood.series.${s.id}`]]));
  expect(labels["energy.imports.natural_gas"]).toBe("Natural gas");
  const shown = energyFoodDisplayLabels("energy-supply", labels);
  expect(shown["energy.imports.natural_gas"]).toBe("Imports — Natural gas");
  expect(shown["energy.supply.natural_gas"]).toBe("Natural gas");
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
  expect(ENERGY_FOOD_SECTIONS.slice(0, 4).map(s => buildEnergyFoodModel(s.id, facts, defaultEnergyFoodState(s.id))).map(m => [m.unit, m.unitKey])).toEqual([
    ["ktoe", "ktoe"], ["gwh", "gwh"], ["ktoe", "ktoe"], ["percent", "percent"],
  ]);
});

test("within a chart's group every non-reference series has its own readable colour, even with all selected", () => {
  for (const { id } of ENERGY_FOOD_SECTIONS) {
    const model = buildEnergyFoodModel(id, facts, { ...defaultEnergyFoodState(id), selectedIds: energyFoodSeries(id).map(s => s.id) });
    expect(model.series.filter(s => s.reference).map(s => s.color), id).toEqual([INK]);
    for (const group of new Set(model.series.map(s => energyFoodGroup(s.id)))) {
      const others = model.series.filter(s => !s.reference && energyFoodGroup(s.id) === group).map(s => s.color);
      expect(new Set(others).size, `${id} ${group}`).toBe(others.length);
      expect(others, `${id} ${group}`).not.toContain(INK);
    }
    for (const hex of model.series.filter(s => !s.reference).map(s => s.color)) {
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
    "energyFood.status.published": "Published", "energyFood.status.no_flow": "No flow", "energyFood.status.preliminary": "Preliminary", "energyFood.unit.price": "₾", "energyFood.unit.priceLong": "₾ per kg (milk per litre, eggs per piece)",
    "common.energySupply": "Energy supply", "common.electricity": "Electricity", "common.energyUse": "Energy use", "common.foodSelfSufficiency": "Food self-sufficiency",
    "common.farming": "Farming", "energyFood.unit.million_gel": "million ₾",
    "energyFood.latest.food-self-sufficiency": "Wheat self-sufficiency", "energyFood.latest.farming": "Farm output",
    ...Object.fromEntries(ENERGY_FOOD_SECTIONS.flatMap(({ id }) => [[`energyFood.page.${id}.title`, `${id} title`], [`energyFood.page.${id}.summary`, `${id} summary`]])),
  },
  ka: {
    "energyFood.unit.ktoe": "ათასი ტ.ნ.ე.", "energyFood.unit.gwh": "გვტ.სთ", "energyFood.unit.percent": "%", "energyFood.series": "სერია",
    "energyFood.status.published": "გამოქვეყნებული", "energyFood.status.no_flow": "ნაკადი არ არის", "energyFood.status.preliminary": "წინასწარი", "energyFood.unit.price": "₾", "energyFood.unit.priceLong": "₾ 1 კგ-ზე (რძე 1 ლიტრზე, კვერცხი 1 ცალზე)",
    "common.energySupply": "ენერგიის მიწოდება", "common.electricity": "ელექტროენერგია", "common.energyUse": "ენერგიის მოხმარება", "common.foodSelfSufficiency": "სურსათის თვითუზრუნველყოფა",
    "common.farming": "სოფლის მეურნეობა", "energyFood.unit.million_gel": "მლნ ₾",
    "energyFood.latest.food-self-sufficiency": "ხორბლით თვითუზრუნველყოფა", "energyFood.latest.farming": "პროდუქციის გამოშვება",
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
  sourceFor("geostat_farming_general", Array.from({ length: 16 }, (_, i) => 2010 + i)),
  sourceFor("geostat_farming_prices", Array.from({ length: 12 }, (_, i) => 2014 + i)),
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

test("the hub has five cards with sparklines and the latest published values in their units", async () => {
  const cards = buildEnergyFoodHubCards(facts, await presentationFor("en"));
  expect(cards.map(card => card.href)).toEqual(ENERGY_FOOD_SECTIONS.map(s => s.href));
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04", "05"]);
  expect(cards.map(card => card.title)).toEqual(["Energy supply", "Electricity", "Energy use", "Food self-sufficiency", "Farming"]);
  expect(cards.map(card => card.footer)).toEqual([
    "2024 · 5,914.5 ktoe · 2013–2024", "2024 · 14,234.1 GWh · 2013–2024", "2024 · 5,456.7 ktoe · 2013–2024", "2025 · 19% · 2014–2025", "2025 · 8,384.9 million ₾ · 2006–2025",
  ]);
  // Each sparkline spans its page's years; Farming's page reaches back to 2006 through its other series.
  expect(cards.map(card => card.series?.length)).toEqual([12, 12, 12, 12, 20]);
  expect(cards.map(card => card.latest?.caption ?? null)).toEqual([null, null, null, "Wheat self-sufficiency", "Farm output"]);
  // Farming's latest output is published as preliminary.
  expect(cards.map(card => card.latest?.status ?? null)).toEqual([null, null, null, null, "preliminary"]);
  expect(cards.map(card => card.series!.at(-1))).toEqual([5914.5, 14234.1, 5456.7, 19, 8384.9]);
  expect(cards.every(card => card.comingSoon === false && card.seriesColor === INK)).toBe(true);
  expect(cards.map(card => card.description)).toEqual(ENERGY_FOOD_SECTIONS.map(s => `${s.id} summary`));
  const ka = buildEnergyFoodHubCards(facts, await presentationFor("ka"));
  expect(ka.map(card => card.footer)).toEqual([
    "2024 · 5,914.5 ათასი ტ.ნ.ე. · 2013–2024", "2024 · 14,234.1 გვტ.სთ · 2013–2024", "2024 · 5,456.7 ათასი ტ.ნ.ე. · 2013–2024", "2025 · 19% · 2014–2025", "2025 · 8,384.9 მლნ ₾ · 2006–2025",
  ]);
});

const FARMING_HEADINGS = {
  output: ["farming.output.total", "farming.output.crops", "farming.output.livestock", "farming.output.services"],
  harvests: ["farming.harvest.wheat", "farming.harvest.barley", "farming.harvest.maize", "farming.harvest.beans", "farming.harvest.potatoes", "farming.harvest.vegetables",
    "farming.harvest.melons", "farming.harvest.grapes", "farming.harvest.apples", "farming.harvest.peaches", "farming.harvest.tangerines", "farming.harvest.hazelnuts", "farming.harvest.walnuts"],
  livestock: ["farming.livestock.cattle", "farming.livestock.dairy_cows", "farming.livestock.pigs", "farming.livestock.sheep_goats", "farming.livestock.poultry"],
  products: ["farming.products.meat", "farming.products.beef", "farming.products.pork", "farming.products.sheep_goat_meat", "farming.products.poultry_meat",
    "farming.products.milk", "farming.products.eggs"],
  prices: ["farming.price.wheat", "farming.price.maize", "farming.price.potatoes", "farming.price.tomatoes", "farming.price.apples", "farming.price.grapes",
    "farming.price.hazelnuts", "farming.price.beef", "farming.price.pork", "farming.price.poultry_meat", "farming.price.milk", "farming.price.eggs"],
};

test("farming lists 41 rows under five headings in the spec's order, output total first and selected alone", () => {
  const series = energyFoodSeries("farming");
  expect(series).toHaveLength(41);
  expect(series.map(s => s.id)).toEqual(Object.values(FARMING_HEADINGS).flat());
  expect(series.map(s => s.heading)).toEqual(Object.entries(FARMING_HEADINGS).flatMap(([heading, ids]) => ids.map(() => heading)));
  expect(series.every(s => !s.parentId)).toBe(true);
  expect(series.filter(s => s.reference).map(s => s.id)).toEqual(["farming.output.total"]);
  expect(defaultEnergyFoodState("farming").selectedIds).toEqual(["farming.output.total"]);
  // The four energy and food pages have no headings.
  for (const { id } of ENERGY_FOOD_SECTIONS.slice(0, 4)) expect(energyFoodSeries(id).every(s => s.heading === undefined), id).toBe(true);
});

test("a shared hash that mixes groups keeps the first row's group", () => {
  const state = parseEnergyFoodHash("#sel=farming.harvest.wheat,farming.price.wheat", "farming", facts);
  expect(state.selectedIds).toEqual(["farming.harvest.wheat"]);
  expect(buildEnergyFoodModel("farming", facts, state).years).toEqual(Array.from({ length: 20 }, (_, i) => 2006 + i));
  expect(energyFoodCoverage("farming", facts)).toMatchObject({ min: 2006, max: 2025 });
  expect(energyFoodCoverage("farming", facts, ["farming.output.total"])).toMatchObject({ min: 2010, max: 2025 });
});

test("ticking a price after the output total replaces the selection and clamps the years, and ticking the output total again keeps them", () => {
  const start = defaultEnergyFoodState("farming");
  // "All years" stays all and follows the group: 2014-2025 for prices.
  const allPrices = changeEnergyFoodSelection(start, "farming", ["farming.output.total", "farming.price.wheat"], facts);
  expect(allPrices).toMatchObject({ selectedIds: ["farming.price.wheat"], range: { kind: "all" } });
  expect(buildEnergyFoodModel("farming", facts, allPrices).range).toMatchObject({ start: 2014, end: 2025 });
  // A chosen range is clamped to the group's years and never collapsed back to all.
  const chosen = { ...start, range: { kind: "manual" as const, start: 2010, end: 2025 } };
  const prices = changeEnergyFoodSelection(chosen, "farming", ["farming.output.total", "farming.price.wheat"], facts);
  expect(prices.selectedIds).toEqual(["farming.price.wheat"]);
  expect(prices.range).toEqual({ kind: "manual", start: 2014, end: 2025 });
  const back = changeEnergyFoodSelection(prices, "farming", ["farming.price.wheat", "farming.output.total"], facts);
  expect(back.selectedIds).toEqual(["farming.output.total"]);
  expect(back.range).toEqual({ kind: "manual", start: 2014, end: 2025 });
  // Adding a row of the same group keeps both.
  expect(changeEnergyFoodSelection(start, "farming", ["farming.output.total", "farming.output.crops"], facts).selectedIds).toEqual(["farming.output.total", "farming.output.crops"]);
});

test("harvests and meat are separate groups although both are thousand tonnes, and all prices are one group", () => {
  expect(energyFoodGroup("farming.harvest.wheat")).not.toBe(energyFoodGroup("farming.products.meat"));
  expect(energyFoodGroup("farming.products.meat")).toBe(energyFoodGroup("farming.products.beef"));
  expect(energyFoodGroup("farming.products.milk")).not.toBe(energyFoodGroup("farming.products.meat"));
  expect(new Set(FARMING_HEADINGS.prices.map(energyFoodGroup))).toEqual(new Set(["price"]));
  expect(energyFoodGroup("energy.supply.total")).toBe("ktoe");
  const state = changeEnergyFoodSelection({ ...defaultEnergyFoodState("farming"), selectedIds: ["farming.harvest.wheat"] }, "farming", ["farming.harvest.wheat", "farming.products.meat"], facts);
  expect(state.selectedIds).toEqual(["farming.products.meat"]);
});

test("no colour repeats within any farming group, and the reference is ink", () => {
  const model = buildEnergyFoodModel("farming", facts, defaultEnergyFoodState("farming"));
  expect(model.series[0].color).toBe(INK);
  for (const [heading, ids] of Object.entries(FARMING_HEADINGS)) {
    for (const group of new Set(ids.map(energyFoodGroup))) {
      const colors = model.series.filter(s => !s.reference && energyFoodGroup(s.id) === group).map(s => s.color);
      expect(new Set(colors).size, `${heading} ${group}`).toBe(colors.length);
      expect(colors[0], `${heading} ${group} starts the palette`).toBe(EDITORIAL_PALETTE[0]);
    }
  }
});

test("the model's unit and unitKey follow the selection", () => {
  const milk = buildEnergyFoodModel("farming", facts, { ...defaultEnergyFoodState("farming"), selectedIds: ["farming.price.milk"] });
  expect([milk.unit, milk.unitKey, milk.decimals]).toEqual(["gel_per_litre", "price", 2]);
  expect(milk.range).toMatchObject({ start: 2014, end: 2025 });
  const output = buildEnergyFoodModel("farming", facts, defaultEnergyFoodState("farming"));
  expect([output.unit, output.unitKey, output.decimals]).toEqual(["million_gel", "million_gel", 1]);
  expect(output.years[0]).toBe(2010);
  const empty = buildEnergyFoodModel("farming", facts, { ...defaultEnergyFoodState("farming"), selectedIds: [] });
  expect([empty.unit, empty.unitKey]).toEqual(["million_gel", "million_gel"]);
  expect(empty.years[0]).toBe(2006);
});

test("the farming price workbook formats values 0.00 and names the price unit", async () => {
  const model = buildEnergyFoodWorkbookExportModel({
    section: "farming", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { "farming.price.wheat": "Wheat", "farming.price.milk": "Milk, per litre" },
    state: { mode: "table", range: { kind: "manual", start: 2024, end: 2025 }, selectedIds: ["farming.price.wheat", "farming.price.milk"] },
  }, await presentationFor("en"));
  expect(model.filename).toBe("fiscal-energy-food-farming-2024-2025-en.xlsx");
  expect(model.readable.numberFormat).toBe("0.00");
  expect(model.readable.amountDecimals).toBe(2);
  // The file names the price unit in full: a price without "per kg" would read as lari per anything.
  expect(model.readable.unitLabel).toBe("₾ per kg (milk per litre, eggs per piece)");
  expect(model.readable.subtitle).toBe("2024–2025 · ₾ per kg (milk per litre, eggs per piece)");
  expect(model.analysis.headers[2]).toBe("₾ per kg (milk per litre, eggs per piece)");
  expect(model.analysis.numericFormats).toEqual({ 3: "0.00" });
  expect(model.analysis.rows.find(r => r[0] === 2025 && r[1] === "Wheat")!.slice(2)).toEqual([0.57, "Published"]);
  expect(model.sources.map(source => source.title)).toEqual(["geostat_farming_prices"]);
});

test("the output workbook marks 2025 preliminary in the status column", async () => {
  const model = buildEnergyFoodWorkbookExportModel({
    section: "farming", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { "farming.output.total": "Farm output, total" },
    state: { mode: "table", range: { kind: "manual", start: 2023, end: 2025 }, selectedIds: ["farming.output.total"] },
  }, await presentationFor("en"));
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.unitLabel).toBe("million ₾");
  expect(model.analysis.rows.map(r => r.slice(0, 1).concat(r.slice(3)))).toEqual([[2023, "Published"], [2024, "Published"], [2025, "Preliminary"]]);
  expect(model.analysis.rows.at(-1)![2]).toBe(8384.9);
});

test("each page's updated date comes from its own facts", async () => {
  const served = await loadEnergyFoodFacts();
  expect(energyFoodLastReviewedAt("energy-supply", served)).toBe("2026-10-11");
  expect(energyFoodLastReviewedAt("food-self-sufficiency", served)).toBe("2026-10-11");
  expect(energyFoodLastReviewedAt("farming", served)).toBe("2026-10-20");
});
