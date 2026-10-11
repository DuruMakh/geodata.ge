import Decimal from "decimal.js";
import { ENERGY_FOOD_INDICATORS, ENERGY_FOOD_SOURCES, energyFoodFactKey, type EnergyFoodFact, type EnergyFoodIndicator } from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const group = (id: EnergyFoodIndicator) => id.split(".")[0] as "energy" | "electricity" | "food";
const FOOD_SHEETS: Record<string, string> = {
  wheat: "Wheat", maize: "Maize", potato: "Potato", vegetables: "Vegetables", grapes: "Grapes", meat: "Meat", beef: "Beef", pork: "Pork",
  sheep_goat_meat: "Sheep and Goat Meat", poultry_meat: "Poultry Meat", milk: "Milk and Milk Products", eggs: "Egg",
};
/** Each indicator's published years (research package coverage.csv). */
const years = (id: EnergyFoodIndicator) => group(id) === "food" ? range(2014, 2025) : id === "electricity.production.wind" ? range(2016, 2024) : range(2013, 2024);

/** Every key the serving package must contain, exactly once. */
export function expectedEnergyFoodKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of ENERGY_FOOD_INDICATORS) for (const year of years(indicatorId)) keys.add(`${indicatorId}:${year}`);
  return keys;
}

/**
 * Decimals Geostat displays a fixed-precision cell with. A `General` cell has no
 * fixed precision (it shows the stored value), so it is checked at the call site.
 */
export function energyFoodDisplayDecimals(numberFormat: string): number {
  // "#,##0.0;[Red]#,##0.0" only recolours negatives, so its first section sets the precision.
  const match = /^(?:#,##)?0(?:\.(0+))?$/.exec(numberFormat.split(";")[0]);
  if (!match) throw new Error(`Unexpected energy and food number format: ${numberFormat}`);
  return match[1]?.length ?? 0;
}

const expectedSource = (fact: EnergyFoodFact) => {
  const kind = group(fact.indicatorId);
  return kind === "food" ? "geostat_food_balance_sheets" : `geostat_energy_balance_${fact.year}_${kind === "energy" ? "aggregated" : "electricity"}`;
};
const sheetMatches = (fact: EnergyFoodFact) => {
  const kind = group(fact.indicatorId);
  return kind === "energy" ? fact.sourceSheet === "KTOE" : kind === "electricity" ? /^GWh&TJ$/i.test(fact.sourceSheet) : fact.sourceSheet === FOOD_SHEETS[fact.indicatorId.split(".")[2]];
};

export function validateEnergyFoodFacts(facts: readonly EnergyFoodFact[]): void {
  const expected = expectedEnergyFoodKeys();
  const seen = new Set<string>();
  for (const fact of facts) {
    const key = energyFoodFactKey(fact);
    if (!ENERGY_FOOD_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid energy and food identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Energy and food observation outside the approved coverage: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate energy and food observation: ${key}`);
    const unit = { energy: "ktoe", electricity: "gwh", food: "percent" }[group(fact.indicatorId)];
    if (
      fact.unit !== unit || fact.basis !== "actual" || !["published", "no_flow"].includes(fact.valueStatus) || fact.sourceId !== expectedSource(fact) ||
      !ENERGY_FOOD_SOURCES.includes(fact.sourceId) || !sheetMatches(fact) || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)
    ) throw new Error(`Invalid energy and food source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid energy and food value: ${key}`); }
    if (!value.isFinite() || value.decimalPlaces() > 20) throw new Error(`Energy and food value outside its range or database precision: ${key}`);
    if (unit === "percent" ? !value.gt(0) : value.lt(0) && fact.indicatorId !== "energy.supply.electricity") throw new Error(`Energy and food value outside its range or database precision: ${key}`);
    if (fact.valueStatus === "no_flow" && !value.isZero()) throw new Error(`Energy and food no-flow value is not zero: ${key}`);
    let published: Decimal;
    try { published = new D(fact.publishedValue); } catch { throw new Error(`Invalid energy and food published value: ${key}`); }
    // Excel keeps 15 significant digits, so the stored value is cut to 15 before it is shown.
    const stored = value.toSignificantDigits(15);
    // A General cell shows the stored value as is; any other format rounds it half-up to the format's decimals.
    const shown = fact.sourceNumberFormat === "General" ? stored : stored.toDecimalPlaces(energyFoodDisplayDecimals(fact.sourceNumberFormat));
    if (!shown.eq(published)) throw new Error(`Energy and food published value does not match its stored value: ${key}`);
    // Food ratios publish as whole numbers. Cells formatted "0" round a decimal (47.1 shows 47); General cells show the stored value, which is then an integer.
    if (unit === "percent" && (!published.isInteger() || (fact.sourceNumberFormat === "General" && !value.isInteger()))) throw new Error(`Invalid energy and food ratio, not a whole number: ${key}`);
    seen.add(key);
  }
  const missing = [...expected].filter(key => !seen.has(key));
  if (missing.length) throw new Error(`Incomplete energy and food coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const id of ENERGY_FOOD_SOURCES.filter(id => id !== "geostat_energy_efficiency")) if (!facts.some(f => f.sourceId === id)) throw new Error(`Energy and food source missing from the serving package: ${id}`);
}
