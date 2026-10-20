export const ENERGY_FOOD_INDICATORS = [
  "energy.supply.total", "energy.supply.coal", "energy.supply.crude_oil", "energy.supply.oil_products", "energy.supply.natural_gas",
  "energy.supply.hydro", "energy.supply.wind_solar_geothermal", "energy.supply.biofuel_waste", "energy.supply.electricity",
  "energy.production.total", "energy.exports.total",
  "energy.imports.total", "energy.imports.coal", "energy.imports.crude_oil", "energy.imports.oil_products", "energy.imports.natural_gas", "energy.imports.electricity",
  "energy.final.total", "energy.final.industry", "energy.final.transport", "energy.final.commercial_public", "energy.final.households",
  "energy.final.agriculture", "energy.final.other_unspecified", "energy.final.non_energy",
  "energy.final_fuel.coal", "energy.final_fuel.oil_products", "energy.final_fuel.natural_gas", "energy.final_fuel.wind_solar_geothermal",
  "energy.final_fuel.biofuel_waste", "energy.final_fuel.electricity",
  "electricity.production.total", "electricity.imports", "electricity.exports", "electricity.losses",
  "electricity.production.thermal", "electricity.production.hydro", "electricity.production.wind",
  "electricity.final.total", "electricity.final.industry", "electricity.final.transport", "electricity.final.commercial_public",
  "electricity.final.households", "electricity.final.agriculture", "electricity.final.other_unspecified",
  "food.self_sufficiency.wheat", "food.self_sufficiency.maize", "food.self_sufficiency.potato", "food.self_sufficiency.vegetables",
  "food.self_sufficiency.grapes", "food.self_sufficiency.meat", "food.self_sufficiency.beef", "food.self_sufficiency.pork",
  "food.self_sufficiency.sheep_goat_meat", "food.self_sufficiency.poultry_meat", "food.self_sufficiency.milk", "food.self_sufficiency.eggs",
  "farming.output.total", "farming.output.crops", "farming.output.livestock", "farming.output.services",
  "farming.harvest.wheat", "farming.harvest.barley", "farming.harvest.maize", "farming.harvest.beans", "farming.harvest.potatoes",
  "farming.harvest.vegetables", "farming.harvest.melons", "farming.harvest.grapes", "farming.harvest.apples", "farming.harvest.peaches",
  "farming.harvest.tangerines", "farming.harvest.hazelnuts", "farming.harvest.walnuts",
  "farming.livestock.cattle", "farming.livestock.dairy_cows", "farming.livestock.pigs", "farming.livestock.sheep_goats", "farming.livestock.poultry",
  "farming.products.meat", "farming.products.beef", "farming.products.pork", "farming.products.sheep_goat_meat", "farming.products.poultry_meat",
  "farming.products.milk", "farming.products.eggs",
  "farming.price.wheat", "farming.price.maize", "farming.price.potatoes", "farming.price.tomatoes", "farming.price.apples", "farming.price.grapes",
  "farming.price.hazelnuts", "farming.price.beef", "farming.price.pork", "farming.price.poultry_meat", "farming.price.milk", "farming.price.eggs",
] as const;
export type EnergyFoodIndicator = (typeof ENERGY_FOOD_INDICATORS)[number];
const BALANCE_YEARS = Array.from({ length: 12 }, (_, i) => 2013 + i);
/** Geostat's Agriculture workbooks, one per farming list heading except the two crop tables. */
const FARMING_WORKBOOKS = ["general", "annual_crops", "permanent_crops", "livestock_numbers", "livestock_products", "prices"] as const;
/** The workbooks the reviewed values are read from, plus the efficiency workbook used only to cross-check totals. */
export const ENERGY_FOOD_SOURCES = [
  ...BALANCE_YEARS.map(year => `geostat_energy_balance_${year}_aggregated`),
  ...BALANCE_YEARS.map(year => `geostat_energy_balance_${year}_electricity`),
  "geostat_energy_efficiency",
  "geostat_food_balance_sheets",
  ...FARMING_WORKBOOKS.map(key => `geostat_farming_${key}`),
];
/** Every archived source, including the Georgian-language workbooks and the page captures. */
export const ENERGY_FOOD_PUBLIC_SOURCES = [
  ...ENERGY_FOOD_SOURCES,
  "geostat_energy_balance_2024_aggregated_ka",
  "geostat_food_balance_sheets_ka",
  ...BALANCE_YEARS.map(year => `geostat_energy_balance_page_${year}`),
  "geostat_energy_balance_index_page",
  "geostat_food_security_page",
  ...FARMING_WORKBOOKS.map(key => `geostat_farming_${key}_ka`),
  "geostat_agriculture_page",
];
export type EnergyFoodFact = {
  year: number;
  indicatorId: EnergyFoodIndicator;
  /** Exact stored source decimal, or 0 for a dash. */
  value: string;
  /** The value as Geostat displays it. */
  publishedValue: string;
  unit: "ktoe" | "gwh" | "percent" | FarmingUnit;
  basis: "actual";
  /** `no_flow` is an energy dash (served as 0); `preliminary` is a farming value under a starred year heading. */
  valueStatus: "published" | "no_flow" | "preliminary";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceNumberFormat: string;
  lastReviewedAt: string;
};
export type FarmingUnit = "million_gel" | "thousand_tonnes" | "thousand_head" | "million_litres" | "million_pieces" | "gel_per_kg" | "gel_per_litre" | "gel_per_piece";
/** Decimals every published value of a unit carries: one for energy, electricity and farm quantities, two for farm-gate prices, none for the food ratios. */
export const ENERGY_FOOD_UNIT_DECIMALS: Record<EnergyFoodFact["unit"], number> = {
  ktoe: 1, gwh: 1, percent: 0, million_gel: 1, thousand_tonnes: 1, thousand_head: 1, million_litres: 1, million_pieces: 1, gel_per_kg: 2, gel_per_litre: 2, gel_per_piece: 2,
};

/** Each indicator's unit: fixed by its family, and for farming by its row (meat in tonnes, milk in litres, eggs in pieces). */
export function energyFoodIndicatorUnit(id: EnergyFoodIndicator): EnergyFoodFact["unit"] {
  const [family, kind, item] = id.split(".");
  if (family === "energy") return "ktoe";
  if (family === "electricity") return "gwh";
  if (family === "food") return "percent";
  if (kind === "output") return "million_gel";
  if (kind === "livestock") return "thousand_head";
  if (kind === "price") return item === "milk" ? "gel_per_litre" : item === "eggs" ? "gel_per_piece" : "gel_per_kg";
  return item === "milk" ? "million_litres" : item === "eggs" ? "million_pieces" : "thousand_tonnes";
}

export type ClientEnergyFoodFact = Pick<EnergyFoodFact, "year" | "indicatorId" | "sourceId" | "valueStatus" | "unit"> & { value: number; decimals: number };
export type EnergyFoodAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function energyFoodFactKey(fact: Pick<EnergyFoodFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function energyFoodSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
