import { beforeAll, expect, test } from "vitest";
import { loadEnergyFoodFacts, toClientEnergyFoodFact } from "../../lib/data/energyFood/importEnergyFood";
import type { ClientEnergyFoodFact } from "../../lib/data/energyFood/types";
import {
  buildEnergyFoodModel, defaultEnergyFoodState, energyFoodCoverage, energyFoodSeries, energyFoodUnit,
  ENERGY_FOOD_HUB_PATH, ENERGY_FOOD_SECTIONS, parseEnergyFoodHash, serializeEnergyFoodHash, type EnergyFoodSectionId,
} from "../../lib/explorer/energyFood";
import { EDITORIAL_PALETTE, INK } from "../../lib/explorer/colors";
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
