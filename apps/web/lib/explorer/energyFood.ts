import { ENERGY_FOOD_UNIT_DECIMALS, energyFoodIndicatorUnit, type ClientEnergyFoodFact, type EnergyFoodFact, type EnergyFoodIndicator } from "../data/energyFood/types";
import { EDITORIAL_PALETTE, INK } from "./colors";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, serializeTopicHash, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

export const ENERGY_FOOD_HUB_PATH = "/explorer/energy-food";
export const ENERGY_FOOD_SECTIONS = [
  { id: "energy-supply", href: `${ENERGY_FOOD_HUB_PATH}/energy-supply`, labelKey: "common.energySupply" },
  { id: "electricity", href: `${ENERGY_FOOD_HUB_PATH}/electricity`, labelKey: "common.electricity" },
  { id: "energy-use", href: `${ENERGY_FOOD_HUB_PATH}/energy-use`, labelKey: "common.energyUse" },
  { id: "food-self-sufficiency", href: `${ENERGY_FOOD_HUB_PATH}/food-self-sufficiency`, labelKey: "common.foodSelfSufficiency" },
  { id: "farming", href: `${ENERGY_FOOD_HUB_PATH}/farming`, labelKey: "common.farming" },
] as const;
export type EnergyFoodSectionId = typeof ENERGY_FOOD_SECTIONS[number]["id"];

export type EnergyFoodHeading = "output" | "harvests" | "livestock" | "products" | "prices";
/** The series ID is the indicator ID. Farming rows sit flat under a heading; the four energy and food pages have none. */
export type EnergyFoodSeriesDefinition = { id: EnergyFoodIndicator; reference: boolean; parentId?: string; heading?: EnergyFoodHeading };

/** A top-level row followed by its children, which nest under it. */
function group(id: EnergyFoodIndicator, children: readonly EnergyFoodIndicator[], reference = false): EnergyFoodSeriesDefinition[] {
  return [{ id, reference }, ...children.map(child => ({ id: child, reference: false, parentId: id }))];
}
const row = (id: EnergyFoodIndicator): EnergyFoodSeriesDefinition[] => group(id, []);
const headed = (heading: EnergyFoodHeading, ids: readonly EnergyFoodIndicator[]): EnergyFoodSeriesDefinition[] =>
  ids.map(id => ({ id, reference: id === "farming.output.total", heading }));

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
  farming: [
    ...headed("output", ["farming.output.total", "farming.output.crops", "farming.output.livestock", "farming.output.services"]),
    ...headed("harvests", (["wheat", "barley", "maize", "beans", "potatoes", "vegetables", "melons", "grapes", "apples", "peaches", "tangerines", "hazelnuts", "walnuts"] as const)
      .map(crop => `farming.harvest.${crop}` as const)),
    ...headed("livestock", (["cattle", "dairy_cows", "pigs", "sheep_goats", "poultry"] as const).map(animal => `farming.livestock.${animal}` as const)),
    ...headed("products", (["meat", "beef", "pork", "sheep_goat_meat", "poultry_meat", "milk", "eggs"] as const).map(product => `farming.products.${product}` as const)),
    ...headed("prices", (["wheat", "maize", "potatoes", "tomatoes", "apples", "grapes", "hazelnuts", "beef", "pork", "poultry_meat", "milk", "eggs"] as const)
      .map(product => `farming.price.${product}` as const)),
  ],
};
const HEADINGS = new Map<string, EnergyFoodHeading>(SERIES.farming.map(s => [s.id, s.heading!]));

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

export type EnergyFoodUnit = EnergyFoodFact["unit"];

/**
 * The rows one chart can hold. A chart shows one group at a time: the four energy and food pages are one unit each; a farming
 * row's group is its heading and unit, so harvests and meat (both thousand tonnes) stay separate charts, and the twelve
 * farm-gate prices (per kg, litre or piece) share one.
 */
export function energyFoodGroup(id: string): string {
  const unit = energyFoodIndicatorUnit(id as EnergyFoodIndicator);
  const heading = HEADINGS.get(id);
  if (!heading) return unit;
  return heading === "prices" ? "price" : `${heading}:${unit}`;
}

/**
 * Energy supply has 16 non-reference series, two more than the editorial palette holds, so the hub extends the palette
 * with two hexes already in use for economic sectors (sector.j and sector.n). Both sit at CIEDE2000 >= 16 from every
 * palette colour and ink, and at >= 3:1 against paper and tint.
 */
const ENERGY_FOOD_PALETTE = [...EDITORIAL_PALETTE, "#0D89C2", "#474A02"] as const;

/** The reference is drawn in ink; `index` is the series' position among the non-reference series of its group, so no colour repeats on a chart. */
function energyFoodSeriesColor(series: EnergyFoodSeriesDefinition, index: number): string {
  return series.reference ? INK : ENERGY_FOOD_PALETTE[index % ENERGY_FOOD_PALETTE.length];
}

export type EnergyFoodState = TopicState;

const cellKey = (f: { indicatorId: string; year: number }) => `${f.indicatorId}:${f.year}`;

/** A section's years: every year any series of the selection's group has a value, or any of its series when nothing is selected. */
export function energyFoodCoverage(section: EnergyFoodSectionId, facts: readonly ClientEnergyFoodFact[], selectedIds: readonly string[] = []) {
  return unitListCoverage(energyFoodSeries(section), selectedIds, facts, `No energy and food years for ${section}`, energyFoodGroup);
}

/** A page's "updated" date: the latest review date among its own series' facts, so adding farming leaves the energy pages' dates as they were. */
export function energyFoodLastReviewedAt(section: EnergyFoodSectionId, facts: readonly { indicatorId: string; lastReviewedAt: string }[]): string {
  const ids = new Set<string>(energyFoodSeries(section).map(s => s.id));
  return facts.filter(f => ids.has(f.indicatorId)).map(f => f.lastReviewedAt).sort().at(-1)!;
}

export function defaultEnergyFoodState(section: EnergyFoodSectionId): EnergyFoodState {
  return { mode: "line", range: { kind: "all" }, selectedIds: [energyFoodSeries(section)[0].id] };
}

/** The hash carries no tab: a legacy `tab=` key is ignored. A selection that mixes groups keeps its first row's group. */
export function parseEnergyFoodHash(hash: string, section: EnergyFoodSectionId, facts: readonly ClientEnergyFoodFact[]): EnergyFoodState {
  const series = energyFoodSeries(section);
  return parseUnitListHash(hash, series, [series[0].id], facts, `No energy and food years for ${section}`, energyFoodGroup);
}

/** A new selection, kept to one group; the years stay, clamped to that group's coverage. */
export function changeEnergyFoodSelection(state: EnergyFoodState, section: EnergyFoodSectionId, next: readonly string[], facts: readonly ClientEnergyFoodFact[]): EnergyFoodState {
  return changeUnitListSelection(state, energyFoodSeries(section), next, facts, `No energy and food years for ${section}`, energyFoodGroup);
}

export function serializeEnergyFoodHash(state: EnergyFoodState, _section: EnergyFoodSectionId): string {
  return serializeTopicHash(state);
}

export type EnergyFoodSeriesModel = TopicSeriesModel<EnergyFoodSeriesDefinition>;
/** `unit` is the first selected series' unit (else the first series'); `unitKey` names it, "price" for the farm-gate prices' shared axis. */
export type EnergyFoodModel = {
  range: ResolvedPeriodRange; years: number[]; series: EnergyFoodSeriesModel[]; selected: EnergyFoodSeriesModel[]; decimals: number; unit: EnergyFoodUnit; unitKey: string;
};


export function buildEnergyFoodModel(section: EnergyFoodSectionId, facts: readonly ClientEnergyFoodFact[], state: EnergyFoodState): EnergyFoodModel {
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  const colorIndex = new Map<string, number>();
  const nextColor = (id: string) => { const index = colorIndex.get(energyFoodGroup(id)) ?? 0; colorIndex.set(energyFoodGroup(id), index + 1); return index; };
  const { range, years, series, selected } = buildTopicModel({ range: state.range, coverage: energyFoodCoverage(section, facts, state.selectedIds), definitions: energyFoodSeries(section), selectedIds: state.selectedIds,
    value: (definition, year) => byCell.get(cellKey({ indicatorId: definition.id, year }))?.value, color: definition => energyFoodSeriesColor(definition, definition.reference ? 0 : nextColor(definition.id)) });
  const selectedIds = new Set<string>(selected.map(s => s.id));
  const first = selected[0]?.id ?? series[0].id;
  const unit = energyFoodIndicatorUnit(first);
  const group = energyFoodGroup(first);
  const selectedDecimals = facts.filter(f => selectedIds.has(f.indicatorId)).map(f => f.decimals);
  const decimals = selectedDecimals.length ? Math.max(...selectedDecimals) : ENERGY_FOOD_UNIT_DECIMALS[unit]; // an empty selection falls back to the unit's own precision
  return { range, years, series, selected, decimals, unit, unitKey: group === "price" ? "price" : unit };
}
