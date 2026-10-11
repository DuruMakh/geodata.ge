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
] as const;
export type EnergyFoodIndicator = (typeof ENERGY_FOOD_INDICATORS)[number];
const BALANCE_YEARS = Array.from({ length: 12 }, (_, i) => 2013 + i);
/** The workbooks the reviewed values are read from, plus the efficiency workbook used only to cross-check totals. */
export const ENERGY_FOOD_SOURCES = [
  ...BALANCE_YEARS.map(year => `geostat_energy_balance_${year}_aggregated`),
  ...BALANCE_YEARS.map(year => `geostat_energy_balance_${year}_electricity`),
  "geostat_energy_efficiency",
  "geostat_food_balance_sheets",
];
/** Every archived source, including the Georgian-language workbooks and the page captures. */
export const ENERGY_FOOD_PUBLIC_SOURCES = [
  ...ENERGY_FOOD_SOURCES,
  "geostat_energy_balance_2024_aggregated_ka",
  "geostat_food_balance_sheets_ka",
  ...BALANCE_YEARS.map(year => `geostat_energy_balance_page_${year}`),
  "geostat_energy_balance_index_page",
  "geostat_food_security_page",
];
export type EnergyFoodFact = {
  year: number;
  indicatorId: EnergyFoodIndicator;
  /** Exact stored source decimal, or 0 for a dash. */
  value: string;
  /** The value as Geostat displays it. */
  publishedValue: string;
  unit: "ktoe" | "gwh" | "percent";
  basis: "actual";
  valueStatus: "published" | "no_flow";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceNumberFormat: string;
  lastReviewedAt: string;
};
export type ClientEnergyFoodFact = Pick<EnergyFoodFact, "year" | "indicatorId" | "sourceId"> & { value: number; decimals: number };
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
