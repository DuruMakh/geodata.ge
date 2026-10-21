import Decimal from "decimal.js";
import {
  TRANSPORT_FLEET_FUELS, TRANSPORT_FREIGHT_MODES, TRANSPORT_INDICATORS, TRANSPORT_PASSENGER_MODES, TRANSPORT_REGISTER_AREAS, TRANSPORT_REGISTER_PARTS,
  TRANSPORT_ROAD_AREAS, TRANSPORT_ROAD_PARTS, TRANSPORT_ZERO_ROWS, TRANSPORT_SOURCES, TRANSPORT_VEHICLE_TYPES, transportFactKey, type TransportFact, type TransportMeasure,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const LAST_YEAR = 2025;
const UNITS: Record<TransportMeasure, TransportFact["unit"]> = {
  fleet: "thousand_units", registered: "thousand_units", passenger_km: "million_passenger_km", passenger_km_per_person: "passenger_km_per_person",
  passengers: "thousand_passengers", tonne_km: "million_tonne_km", freight_tonnes: "thousand_tonnes", road_km: "km",
};
/** The years a registered-vehicles column is printed in; every other column is printed 2017-2025. */
const REGISTERED_YEARS: Record<string, readonly number[]> = {
  type_unknown: range(2022, 2025), fuel_diesel_gas: [2020, 2022, 2023, 2024, 2025], fuel_hybrid_gas: range(2022, 2025), fuel_hybrid_diesel: range(2022, 2025),
};
/** Parts may differ from the printed total by Geostat's rounding, in thousands (km for roads). */
const TOLERANCE = { national: "0.1", modes: "0.2", regional: "0.2" } as const;
/**
 * The research package's `KNOWN_DIFFERENCES` (prepare.py): years whose parts minus the printed total differ by exactly this
 * much, which must stay as recorded. Every other year must add up within the tolerance.
 */
const KNOWN_DIFFERENCES: Record<string, Record<number, string>> = {
  "fleet.buses by fuel": { 2020: "0.2" },
  "fleet.special by fuel": { 2025: "-0.2" },
};
/** What Geostat prints, as published. */
const ANCHORS: readonly (readonly [string, number, string])[] = [
  ["transport.fleet.cars", 2025, "1650.0"], ["transport.fleet.cars", 2000, "244.8"], ["transport.fleet.cars_fuel_electric", 2025, "15.2"],
  ["transport.fleet.cars_age_over_10", 2025, "1318.9"], ["transport.passenger_km.total", 2025, "11262.1"], ["transport.passenger_km.air", 2025, "1862.6"],
  ["transport.tonne_km.rail", 2025, "3814.9"], ["transport.freight_tonnes.rail_transit", 2025, "7616.6"], ["transport.registered.region_tbilisi", 2025, "855.0"],
  ["transport.registered.total", 2025, "1914.9"], ["transport.registered.region_guria", 2025, "40.7"], ["transport.passengers.metro", 2025, "147641.4"],
];
const parts = (indicatorId: string) => indicatorId.split(".") as [string, TransportMeasure, string];
/** The suffix of a registered-vehicles group after its area, "" for the area's total. */
const registeredPart = (group: string) => {
  const area = [...TRANSPORT_REGISTER_AREAS].sort((a, b) => b.length - a.length).find(a => group === a || group.startsWith(`${a}_`))!;
  return group.slice(area.length + 1);
};

/** The years an indicator is served, as the research package's coverage.csv lists them (without unavailable years). */
function servedYears(measure: TransportMeasure, group: string): number[] {
  const years = (first: number, last = LAST_YEAR, without: readonly number[] = []) => range(first, last).filter(year => !without.includes(year));
  switch (measure) {
    case "fleet":
      if (group.includes("_fuel_")) return years(group.endsWith("_hybrid_gas") ? 2022 : 2017);
      if (group.includes("_age_")) return years(2017);
      return years(2000, LAST_YEAR, group === "special" ? [2004, 2005, 2006] : [2004, 2005]);
    case "passenger_km": case "passenger_km_per_person": return years(2000);
    case "tonne_km": return group === "sea" ? years(2000, 2012, [2009, 2010]) : years(2000);
    case "passengers": return years(group.startsWith("rail") ? 2018 : { metro: 2012, airlines: 2012, airports: 2015, seaports: 2020 }[group]!);
    case "freight_tonnes": return years(group.startsWith("rail") ? 2018 : group.startsWith("seaports") ? 2020 : group === "airlines" ? 2012 : 2015);
    case "registered": return [...(REGISTERED_YEARS[registeredPart(group)] ?? years(2017))];
    case "road_km": return range(2011, 2024);
  }
}

/** The workbook and sheet an observation must come from. */
function expectedSource(measure: TransportMeasure, group: string): { sourceId: string; sheet: string } {
  switch (measure) {
    case "fleet": return group.includes("_age_") ? { sourceId: "geostat_transport_fleet_age", sheet: "H-4" } : { sourceId: "geostat_transport_fleet_fuel", sheet: "H-3" };
    case "passenger_km": case "passenger_km_per_person": return { sourceId: "geostat_transport_passenger_demand", sheet: "H-1" };
    case "tonne_km": return { sourceId: "geostat_transport_freight_demand", sheet: "H-2" };
    case "passengers":
      if (group.startsWith("rail")) return { sourceId: "geostat_transport_rail_passengers", sheet: "Number of passengers" };
      return {
        metro: { sourceId: "geostat_transport_metro", sheet: "2012-2025 Y" },
        airports: { sourceId: "geostat_transport_airports", sheet: "Passengers carried" },
        airlines: { sourceId: "geostat_transport_airlines", sheet: "Number of passengers by quarter" },
        seaports: { sourceId: "geostat_transport_sea_passengers", sheet: "Passenger" },
      }[group]!;
    case "freight_tonnes":
      if (group.startsWith("rail")) return { sourceId: "geostat_transport_rail_goods", sheet: "Transportation" };
      if (group.startsWith("seaports")) return { sourceId: "geostat_transport_sea_freight", sheet: "Freight" };
      return group === "airports" ? { sourceId: "geostat_transport_airports", sheet: "Freight carried" } : { sourceId: "geostat_transport_airlines", sheet: "Volume of freight by quarter" };
    case "registered": {
      const part = registeredPart(group);
      const sheet = part.startsWith("fuel_") ? "fuel type" : part.startsWith("age_") ? "age of vehicle" : part.startsWith("owner_") ? "type of owner" : "type of vehicle";
      return { sourceId: "geostat_transport_registered", sheet };
    }
    case "road_km": return { sourceId: "geostat_transport_roads", sheet: "Roads" };
  }
}

/** Every printed total and the parts Geostat prints beneath it, named as the research package names them. */
function sums(): { name: string; total: string; parts: string[]; tolerance: string }[] {
  const checks: [string, string, string[], keyof typeof TOLERANCE][] = [];
  for (const type of TRANSPORT_VEHICLE_TYPES) {
    checks.push(["fuel", `fleet.${type}`, TRANSPORT_FLEET_FUELS[type].map(fuel => `fleet.${type}_fuel_${fuel}`), "national"]);
    // H-4's age rows are cumulative: up to 10 years, over 10 years and unknown make the total.
    checks.push(["age", `fleet.${type}`, ["up_to_10", "over_10", "unknown"].map(age => `fleet.${type}_age_${age}`), "national"]);
  }
  checks.push(["mode", "passenger_km.total", TRANSPORT_PASSENGER_MODES.filter(m => m !== "total").map(m => `passenger_km.${m}`), "modes"]);
  checks.push(["mode", "tonne_km.total", TRANSPORT_FREIGHT_MODES.filter(m => m !== "total").map(m => `tonne_km.${m}`), "modes"]);
  checks.push(["direction", "freight_tonnes.rail", ["domestic", "exports", "imports", "transit"].map(d => `freight_tonnes.rail_${d}`), "national"]);
  checks.push(["direction", "passengers.rail", ["passengers.rail_domestic", "passengers.rail_international"], "national"]);
  checks.push(["cargo", "freight_tonnes.seaports", ["liquid", "general", "dry"].map(c => `freight_tonnes.seaports_${c}`), "national"]);
  const categories: [string, (part: string) => boolean][] = [
    ["type", part => !/^(fuel|age|owner)_/.test(part)], ["fuel", part => part.startsWith("fuel_")],
    ["owner", part => part.startsWith("owner_")], ["age", part => part.startsWith("age_")],
  ];
  for (const [category, includes] of categories) {
    const categoryParts = TRANSPORT_REGISTER_PARTS.filter(includes);
    for (const suffix of ["", ...categoryParts.map(part => `_${part}`)]) {
      checks.push(["region", `registered.total${suffix}`, TRANSPORT_REGISTER_AREAS.slice(1).map(area => `registered.${area}${suffix}`), "regional"]);
    }
    for (const area of TRANSPORT_REGISTER_AREAS) checks.push([category, `registered.${area}`, categoryParts.map(part => `registered.${area}_${part}`), "regional"]);
  }
  for (const suffix of ["", ...TRANSPORT_ROAD_PARTS.map(part => `_${part}`)]) {
    checks.push(["region", `road_km.total${suffix}`, TRANSPORT_ROAD_AREAS.slice(1).map(area => `road_km.${area}${suffix}`), "regional"]);
  }
  for (const area of TRANSPORT_ROAD_AREAS) checks.push(["road type", `road_km.${area}`, TRANSPORT_ROAD_PARTS.map(part => `road_km.${area}_${part}`), "regional"]);
  return checks.map(([label, total, parts, kind]) => ({ name: `${total} by ${label}`, total, parts, tolerance: TOLERANCE[kind] }));
}

/** Every key the serving package must contain, exactly once. */
export function expectedTransportKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of TRANSPORT_INDICATORS) {
    const [, measure, group] = parts(indicatorId);
    for (const year of servedYears(measure, group)) keys.add(`${indicatorId}:${year}`);
  }
  return keys;
}

/** Km per person is shown as whole numbers; every other unit with one decimal, Geostat's published precision. */
export function transportDisplayDecimals(indicatorId: string): 0 | 1 {
  return parts(indicatorId)[1] === "passenger_km_per_person" ? 0 : 1;
}

export function validateTransportFacts(facts: readonly TransportFact[]): void {
  const expected = expectedTransportKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = transportFactKey(fact);
    if (!TRANSPORT_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid transport identity: ${key}`);
    const [, measure, group] = parts(fact.indicatorId);
    if (fact.year > LAST_YEAR) throw new Error(`Transport observation after 2025: ${key}`);
    if (!expected.has(key)) throw new Error(`Transport observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate transport observation: ${key}`);
    const source = expectedSource(measure, group);
    // The owner sheet is named " type of owner ", with spaces.
    if (fact.unit !== UNITS[measure] || fact.basis !== "actual" || fact.valueStatus !== "official" || fact.sourceId !== source.sourceId
      || fact.sourceSheet.trim() !== source.sheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid transport source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid transport value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.decimalPlaces() > 30) throw new Error(`Transport value outside its range or database precision: ${key}`);
    // Round half-up from the value as Excel displays it (15 significant digits).
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(transportDisplayDecimals(fact.indicatorId))) throw new Error(`Transport published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete transport coverage: ${missing.length} missing, first ${missing[0]}`);

  for (const [key, value] of values) if (TRANSPORT_ZERO_ROWS.includes(key.slice(0, key.lastIndexOf(":"))) && !value.isZero()) throw new Error(`A not-listed transport row is no longer zero: ${key}`);

  for (const { name, total, parts: groups, tolerance } of sums()) {
    const recorded = KNOWN_DIFFERENCES[name] ?? {};
    const [, measure, group] = parts(`transport.${total}`);
    for (const year of servedYears(measure, group)) {
      const found = groups.map(group => values.get(`transport.${group}:${year}`));
      if (found.every(value => value === undefined)) continue; // Geostat prints no breakdown for this year.
      const difference = found.reduce<Decimal>((sum, value) => sum.plus(value ?? 0), new D(0)).minus(values.get(`transport.${total}:${year}`)!);
      const failed = year in recorded ? difference.toString() !== recorded[year] : difference.abs().gt(tolerance);
      if (failed) throw new Error(`The transport parts of ${name} do not add up to the total in ${year} as recorded (${difference})`);
    }
  }
  for (const [indicatorId, year, published] of ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === year)!.publishedValue !== published) throw new Error(`Transport anchor value changed: ${indicatorId}:${year}`);
  if (!TRANSPORT_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Transport source missing from the serving package");
}
