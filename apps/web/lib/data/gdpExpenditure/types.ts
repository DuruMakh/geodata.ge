import type { SectorMeasure } from "../economicSectors/types";

export const GDP_EXPENDITURE_REGISTRY_PATH = "data/taxonomy/gdp-expenditure.json";
export const GDP_EXPENDITURE_CSV_PATH = "data/imports/gdp-expenditure-annual.csv";
export const GDP_EXPENDITURE_GDP = "economy.gdp_total";

// Geostat publishes households and non-profits apart only at current prices, one combined
// series for real growth, and no growth rate for inventories (they can be negative).
const CURRENT_PRICE_ONLY = new Set(["gdp_use.households", "gdp_use.npish", "gdp_use.inventories"]);
const GROWTH_ONLY = new Set(["gdp_use.households_npish"]);

export function gdpExpenditureMeasures(seriesId: string): readonly SectorMeasure[] {
  if (GROWTH_ONLY.has(seriesId)) return ["real_growth"];
  if (CURRENT_PRICE_ONLY.has(seriesId)) return ["nominal", "share_of_gdp"];
  return ["nominal", "share_of_gdp", "real_growth"];
}

