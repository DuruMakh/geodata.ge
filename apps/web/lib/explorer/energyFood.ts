import type { ClientEnergyFoodFact, EnergyFoodIndicator } from "../data/energyFood/types";
import { EDITORIAL_PALETTE, INK } from "./colors";
import { resolveRange, refitRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export const ENERGY_FOOD_HUB_PATH = "/explorer/energy-food";
export const ENERGY_FOOD_SECTIONS = [
  { id: "energy-supply", href: `${ENERGY_FOOD_HUB_PATH}/energy-supply`, labelKey: "common.energySupply" },
  { id: "electricity", href: `${ENERGY_FOOD_HUB_PATH}/electricity`, labelKey: "common.electricity" },
  { id: "energy-use", href: `${ENERGY_FOOD_HUB_PATH}/energy-use`, labelKey: "common.energyUse" },
  { id: "food-self-sufficiency", href: `${ENERGY_FOOD_HUB_PATH}/food-self-sufficiency`, labelKey: "common.foodSelfSufficiency" },
] as const;
export type EnergyFoodSectionId = typeof ENERGY_FOOD_SECTIONS[number]["id"];

/** The series ID is the indicator ID. */
export type EnergyFoodSeriesDefinition = { id: EnergyFoodIndicator; reference: boolean; parentId?: string };

/** A top-level row followed by its children, which nest under it. */
function group(id: EnergyFoodIndicator, children: readonly EnergyFoodIndicator[], reference = false): EnergyFoodSeriesDefinition[] {
  return [{ id, reference }, ...children.map(child => ({ id: child, reference: false, parentId: id }))];
}
const row = (id: EnergyFoodIndicator): EnergyFoodSeriesDefinition[] => group(id, []);

const SERIES: Record<EnergyFoodSectionId, readonly EnergyFoodSeriesDefinition[]> = {
  "energy-supply": [
    ...group("energy.supply.total", [
      "energy.supply.natural_gas", "energy.supply.oil_products", "energy.supply.hydro", "energy.supply.biofuel_waste",
      "energy.supply.coal", "energy.supply.crude_oil", "energy.supply.wind_solar_geothermal", "energy.supply.electricity",
    ], true),
    ...row("energy.production.total"),
    ...group("energy.imports.total", [
      "energy.imports.natural_gas", "energy.imports.oil_products", "energy.imports.coal", "energy.imports.crude_oil", "energy.imports.electricity",
    ]),
    ...row("energy.exports.total"),
  ],
  electricity: [
    ...group("electricity.production.total", ["electricity.production.hydro", "electricity.production.thermal", "electricity.production.wind"], true),
    ...row("electricity.imports"),
    ...row("electricity.exports"),
    ...group("electricity.final.total", [
      "electricity.final.households", "electricity.final.commercial_public", "electricity.final.industry",
      "electricity.final.transport", "electricity.final.agriculture", "electricity.final.other_unspecified",
    ]),
    ...row("electricity.losses"),
  ],
  "energy-use": [
    ...group("energy.final.total", [
      "energy.final.households", "energy.final.transport", "energy.final.industry", "energy.final.commercial_public",
      "energy.final.agriculture", "energy.final.other_unspecified", "energy.final.non_energy",
    ], true),
    ...(["natural_gas", "oil_products", "electricity", "biofuel_waste", "coal", "wind_solar_geothermal"] as const).flatMap(fuel => row(`energy.final_fuel.${fuel}`)),
  ],
  "food-self-sufficiency": [
    ...group("food.self_sufficiency.wheat", [], true),
    ...(["maize", "potato", "vegetables", "grapes"] as const).flatMap(crop => row(`food.self_sufficiency.${crop}`)),
    ...group("food.self_sufficiency.meat", [
      "food.self_sufficiency.beef", "food.self_sufficiency.pork", "food.self_sufficiency.sheep_goat_meat", "food.self_sufficiency.poultry_meat",
    ]),
    ...row("food.self_sufficiency.milk"),
    ...row("food.self_sufficiency.eggs"),
  ],
};

/** The series a section offers, reference first. */
export function energyFoodSeries(section: EnergyFoodSectionId): EnergyFoodSeriesDefinition[] {
  return [...SERIES[section]];
}

/**
 * Names for a series outside the nested list (chart tooltip, table, workbook). The list shows plain names, so an
 * imports child reads "Natural gas" like the supply child above it; where a name repeats on a page, the child of a
 * non-reference parent carries its parent's name ("Imports — Natural gas") so no two series share a label.
 */
export function energyFoodDisplayLabels(section: EnergyFoodSectionId, labels: Readonly<Record<string, string>>): Record<string, string> {
  const series = energyFoodSeries(section);
  const counts = new Map<string, number>();
  for (const s of series) counts.set(labels[s.id], (counts.get(labels[s.id]) ?? 0) + 1);
  const reference = series.find(s => s.reference)!.id;
  return Object.fromEntries(series.map(s => [s.id,
    s.parentId && s.parentId !== reference && counts.get(labels[s.id])! > 1 ? `${labels[s.parentId]} — ${labels[s.id]}` : labels[s.id]]));
}

export type EnergyFoodUnit = "ktoe" | "gwh" | "percent";
const UNITS: Record<EnergyFoodSectionId, EnergyFoodUnit> = { "energy-supply": "ktoe", electricity: "gwh", "energy-use": "ktoe", "food-self-sufficiency": "percent" };
export function energyFoodUnit(section: EnergyFoodSectionId): EnergyFoodUnit {
  return UNITS[section];
}

/**
 * Energy supply has 16 non-reference series, two more than the editorial palette holds, so the hub extends the palette
 * with two hexes already in use for economic sectors (sector.j and sector.n). Both sit at CIEDE2000 >= 16 from every
 * palette colour and ink, and at >= 3:1 against paper and tint.
 */
const ENERGY_FOOD_PALETTE = [...EDITORIAL_PALETTE, "#0D89C2", "#474A02"] as const;

/** The reference is drawn in ink; `index` is the series' position among the non-reference series, so no colour repeats on a page. */
export function energyFoodSeriesColor(series: EnergyFoodSeriesDefinition, index: number): string {
  return series.reference ? INK : ENERGY_FOOD_PALETTE[index % ENERGY_FOOD_PALETTE.length];
}

export type EnergyFoodState = { mode: "line" | "table"; range: PeriodRange; selectedIds: string[] };

const cellKey = (f: { indicatorId: string; year: number }) => `${f.indicatorId}:${f.year}`;

/** A section's years: every year any of its series has a value. */
export function energyFoodCoverage(section: EnergyFoodSectionId, facts: readonly ClientEnergyFoodFact[]) {
  const ids = new Set<string>(energyFoodSeries(section).map(s => s.id));
  const years = [...new Set(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error(`No energy and food years for ${section}`);
  return { min: years[0], max: years.at(-1)!, years };
}

export function defaultEnergyFoodState(section: EnergyFoodSectionId): EnergyFoodState {
  return { mode: "line", range: { kind: "all" }, selectedIds: [energyFoodSeries(section)[0].id] };
}

/** The hash carries no tab: a legacy `tab=` key is ignored. */
export function parseEnergyFoodHash(hash: string, section: EnergyFoodSectionId, facts: readonly ClientEnergyFoodFact[]): EnergyFoodState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const series = energyFoodSeries(section);
  const requested = p.has("sel") ? p.get("sel")!.split(",") : [series[0].id];
  return {
    mode: p.get("view") === "table" ? "table" : "line",
    range: refitRange(parseYearRangeKeys(p), energyFoodCoverage(section, facts), { collapseToAll: true }),
    selectedIds: series.map(s => s.id).filter(id => requested.includes(id)),
  };
}

export function serializeEnergyFoodHash(state: EnergyFoodState, _section: EnergyFoodSectionId): string {
  const p = new URLSearchParams();
  p.set("view", state.mode);
  p.set("sel", state.selectedIds.join(","));
  writeYearRangeKeys(p, state.range);
  return p.toString();
}

export type EnergyFoodSeriesModel = EnergyFoodSeriesDefinition & { color: string; valuesByYear: Record<number, number | null>; endValue: number | null };
export type EnergyFoodModel = { range: ResolvedPeriodRange; years: number[]; series: EnergyFoodSeriesModel[]; selected: EnergyFoodSeriesModel[]; decimals: number };

/** Decimals of an empty selection fall back to the unit's own precision. */
const UNIT_DECIMALS: Record<EnergyFoodUnit, number> = { ktoe: 1, gwh: 1, percent: 0 };

export function buildEnergyFoodModel(section: EnergyFoodSectionId, facts: readonly ClientEnergyFoodFact[], state: EnergyFoodState): EnergyFoodModel {
  const range = resolveRange(state.range, energyFoodCoverage(section, facts));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  let colorIndex = 0;
  const series = energyFoodSeries(section).map(definition => {
    const valuesByYear = Object.fromEntries(years.map(year => [year, byCell.get(cellKey({ indicatorId: definition.id, year }))?.value ?? null]));
    return { ...definition, color: energyFoodSeriesColor(definition, definition.reference ? 0 : colorIndex++), valuesByYear, endValue: valuesByYear[range.end] };
  });
  const selected = series.filter(s => state.selectedIds.includes(s.id));
  const selectedIds = new Set<string>(selected.map(s => s.id));
  const selectedDecimals = facts.filter(f => selectedIds.has(f.indicatorId)).map(f => f.decimals);
  const decimals = selectedDecimals.length ? Math.max(...selectedDecimals) : UNIT_DECIMALS[energyFoodUnit(section)];
  return { range, years, series, selected, decimals };
}
