import Decimal from "decimal.js";
import {
  HOUSING_DISTRICT_MEASURES, HOUSING_INDICATORS, HOUSING_PERMIT_COMPLETED_MEASURES, HOUSING_REGIONS, HOUSING_SOURCES, HOUSING_TYPES,
  housingFactKey, type HousingFact, type HousingMeasure,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const FIRST_YEAR = 2006;
const LAST_YEAR = 2025;
const INDEX_FIRST_YEAR = 2020;
const DISTRICT_FIRST_YEAR = 2021;
const UNITS: Record<HousingMeasure, HousingFact["unit"]> = {
  permits_count: "count", permits_area: "square_metres", completed_count: "count", completed_area: "square_metres",
  price_index: "index_2020", price_flat: "gel_per_square_metre", price_house: "gel_per_square_metre",
};
/** Years in which the by-type sheet has no column for a type; the completed sheets have no holiday-camps column at all. */
const MISSING_TYPE_YEARS: Record<string, readonly number[]> = {
  "permits.preschool": [2008],
  "permits.holiday_camps": range(FIRST_YEAR, LAST_YEAR).filter(year => year !== 2022 && year !== 2023),
  "completed.preschool": [2006, 2009, 2011, 2012, 2021],
  "completed.holiday_camps": range(FIRST_YEAR, LAST_YEAR),
};
/** Completed objects: a region's residential cell is "…" (no data), number and area alike, although its total is printed. */
const NO_RESIDENTIAL_YEARS: Record<string, readonly number[]> = {
  region_samegrelo_zemo_svaneti: [2006], region_kakheti: [2006], region_racha_lechkhumi_kvemo_svaneti: [2010, 2011],
};
/** Parts may differ from the printed total by Geostat's rounding: square metres by 1, numbers not at all. */
const TOLERANCE: Record<"count" | "square_metres", string> = { count: "0", square_metres: "1" };
/**
 * The research package's `KNOWN_DIFFERENCES` (prepare.py): years whose 11 regions minus Georgia's printed total differ by
 * exactly this many square metres, which must stay as recorded. Every other year must add up within the tolerance.
 */
const KNOWN_DIFFERENCES: Record<string, Record<number, string>> = {
  permits_area: { 2024: "-1" },
  completed_area: { 2024: "1" },
};
/** What Geostat prints, as published. */
const ANCHORS: readonly (readonly [string, number, string])[] = [
  ["housing.permits_count.total", 2025, "11578"], ["housing.permits_area.total", 2025, "11397190"],
  ["housing.completed_count.total", 2025, "3393"], ["housing.completed_area.total", 2025, "3509126"],
  ["housing.permits_area.region_tbilisi", 2025, "6423329"], ["housing.permits_count.region_guria", 2025, "150"],
  ["housing.price_index.total", 2020, "107.2"], ["housing.price_index.total", 2025, "159.4"],
];
/** The workbook's stored value, which its cell format shows as 5874. */
const VALUE_ANCHORS: readonly (readonly [string, number, string])[] = [["housing.price_flat.district_vake", 2025, "5873.77"]];
const parts = (indicatorId: string) => indicatorId.split(".") as [string, HousingMeasure, string];
const isDistrictPrice = (measure: HousingMeasure) => (HOUSING_DISTRICT_MEASURES as readonly string[]).includes(measure);
const unitKind = (measure: HousingMeasure) => (UNITS[measure] === "count" ? "count" : "square_metres") as "count" | "square_metres";

/** The years an indicator is served, as the research package's coverage.csv lists them (without unavailable years). */
function servedYears(measure: HousingMeasure, group: string): number[] {
  if (measure === "price_index") return range(INDEX_FIRST_YEAR, LAST_YEAR);
  if (isDistrictPrice(measure)) return range(DISTRICT_FIRST_YEAR, LAST_YEAR);
  const kind = measure.split("_")[0];
  const missing = group.startsWith("type_")
    ? MISSING_TYPE_YEARS[`${kind}.${group.slice(5)}`] ?? []
    : kind === "completed" && group.endsWith("_residential") ? NO_RESIDENTIAL_YEARS[group.replace(/_residential$/, "")] ?? [] : [];
  return range(FIRST_YEAR, LAST_YEAR).filter(year => !missing.includes(year));
}

/** The workbook, sheet and source an observation must come from. */
function expectedSource(measure: HousingMeasure, group: string, year: number): { sourceId: string; sheet: string } {
  if (measure === "price_index") return { sourceId: "geostat_housing_price_index", sheet: "RPPI" };
  if (isDistrictPrice(measure)) return { sourceId: "geostat_housing_tbilisi_prices", sheet: measure === "price_flat" ? "Flats" : "Detached houses" };
  const kind = measure.split("_")[0] as "permits" | "completed";
  if (group === "total" || (HOUSING_REGIONS as readonly string[]).includes(group)) {
    return { sourceId: `geostat_housing_${kind}_regions`, sheet: kind === "permits" ? "permissions" : "completed objects" };
  }
  return { sourceId: `geostat_housing_${kind}_types`, sheet: String(year) };
}

/** Every key the serving package must contain, exactly once. */
export function expectedHousingKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of HOUSING_INDICATORS) {
    const [, measure, group] = parts(indicatorId);
    for (const year of servedYears(measure, group)) keys.add(`${indicatorId}:${year}`);
  }
  return keys;
}

/** The index is shown with one decimal; counts, square metres and district prices as whole numbers. */
export function housingDisplayDecimals(indicatorId: string): 0 | 1 {
  return UNITS[parts(indicatorId)[1]] === "index_2020" ? 1 : 0;
}

export function validateHousingFacts(facts: readonly HousingFact[]): void {
  const expected = expectedHousingKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = housingFactKey(fact);
    if (!HOUSING_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid housing identity: ${key}`);
    const [, measure, group] = parts(fact.indicatorId);
    if (fact.year > LAST_YEAR) throw new Error(`Housing observation after 2025: ${key}`);
    if (!expected.has(key)) throw new Error(`Housing observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate housing observation: ${key}`);
    const source = expectedSource(measure, group, fact.year);
    // Prices are the fourth-quarter cells; the sheet of a by-type observation is its year (the completed 2012 sheet is named "2012 ").
    if (fact.unit !== UNITS[measure] || fact.basis !== "actual" || fact.valueStatus !== "official" || fact.sourceId !== source.sourceId
      || fact.sourceSheet.trim() !== source.sheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid housing source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid housing value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.decimalPlaces() > 30) throw new Error(`Housing value outside its range or database precision: ${key}`);
    // Round half-up from the value as Excel displays it (15 significant digits).
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(housingDisplayDecimals(fact.indicatorId))) throw new Error(`Housing published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete housing coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const [indicatorId, year, published] of ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === year)!.publishedValue !== published) throw new Error(`Housing anchor value changed: ${indicatorId}:${year}`);
  for (const [indicatorId, year, stored] of VALUE_ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === year)!.value !== stored) throw new Error(`Housing anchor value changed: ${indicatorId}:${year}`);

  const years = range(FIRST_YEAR, LAST_YEAR);
  const addsUp = (measure: HousingMeasure, kind: string, groups: readonly string[], recorded: Record<number, string>) => {
    const tolerance = TOLERANCE[unitKind(measure)];
    for (const year of years) {
      const sum = groups.reduce((total, group) => total.plus(values.get(`housing.${measure}.${group}:${year}`) ?? 0), new D(0));
      const difference = sum.minus(values.get(`housing.${measure}.total:${year}`)!);
      const failed = year in recorded ? difference.toString() !== recorded[year] : difference.abs().gt(tolerance);
      if (failed) throw new Error(`The housing ${measure} ${kind}s do not add up to the total in ${year} as recorded`);
    }
  };
  for (const measure of HOUSING_PERMIT_COMPLETED_MEASURES) {
    addsUp(measure, "region", HOUSING_REGIONS, KNOWN_DIFFERENCES[measure] ?? {});
    addsUp(measure, "type", HOUSING_TYPES.map(type => `type_${type}`), {});
    for (const region of HOUSING_REGIONS) {
      for (const year of years) {
        const residential = values.get(`housing.${measure}.${region}_residential:${year}`);
        if (residential?.gt(values.get(`housing.${measure}.${region}:${year}`)!)) throw new Error(`The housing ${measure} residential buildings of ${region} exceed its total in ${year}`);
      }
    }
  }
  if (!HOUSING_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Housing source missing from the serving package");
}
