import { BUSINESS_REGIONS } from "../business/types";

/** The eight served measures: the road fleet, passenger and freight demand, passengers and freight carried, registered vehicles and road length. */
export const TRANSPORT_MEASURES = ["fleet", "passenger_km", "passenger_km_per_person", "passengers", "tonne_km", "freight_tonnes", "registered", "road_km"] as const;
export type TransportMeasure = (typeof TRANSPORT_MEASURES)[number];
/** H-3 and H-4's vehicle types. */
export const TRANSPORT_VEHICLE_TYPES = ["cars", "buses", "trucks", "special"] as const;
export type TransportVehicleType = (typeof TRANSPORT_VEHICLE_TYPES)[number];
/** The fuel rows served for each type; the others are 0 or nil in every year and are not served. */
export const TRANSPORT_FLEET_FUELS: Record<TransportVehicleType, readonly string[]> = {
  cars: ["petrol", "petrol_gas", "diesel", "gas", "electric", "hybrid", "hybrid_gas", "unknown"],
  buses: ["petrol", "petrol_gas", "diesel", "gas", "electric", "unknown"],
  trucks: ["petrol", "petrol_gas", "diesel", "gas", "electric", "unknown"],
  special: ["petrol", "petrol_gas", "diesel", "electric", "unknown"],
};
/** H-4's age rows, which are cumulative ("up to 5 years" includes "up to 2 years"). Buses have no unknown age. */
export const TRANSPORT_FLEET_AGES = ["up_to_2", "up_to_5", "up_to_10", "over_10", "unknown"] as const;
const fleetAges = (type: TransportVehicleType) => TRANSPORT_FLEET_AGES.filter(age => !(type === "buses" && age === "unknown"));
/** H-1's passenger-km rows. */
export const TRANSPORT_PASSENGER_MODES = ["total", "road", "rail", "metro", "air", "sea"] as const;
/** Passengers carried, by railway, metro, airports, Georgian airlines and sea ports. */
export const TRANSPORT_PASSENGER_GROUPS = ["rail", "rail_domestic", "rail_international", "metro", "airports", "airlines", "seaports"] as const;
/** H-2's tonne-km rows. */
export const TRANSPORT_FREIGHT_MODES = ["total", "road", "rail", "air", "sea"] as const;
/** Freight carried, by railway (and its directions), sea ports (and their cargo types), airports and Georgian airlines. */
export const TRANSPORT_FREIGHT_GROUPS = [
  "rail", "rail_domestic", "rail_exports", "rail_imports", "rail_transit", "seaports", "seaports_liquid", "seaports_general", "seaports_dry", "airports", "airlines",
] as const;
/** The site's 11 regions: the Business hub's IDs, in the same order. */
export const TRANSPORT_REGIONS = BUSINESS_REGIONS;
/** The registered-vehicles workbook's rows: Georgia, the 11 regions, Abkhazia and an unknown region, which together add up to Georgia. */
export const TRANSPORT_REGISTER_AREAS = ["total", ...TRANSPORT_REGIONS, "region_abkhazia", "region_unknown"] as const;
/** The registered-vehicles workbook's columns under each area's total: type, fuel, age and owner. */
export const TRANSPORT_REGISTER_PARTS = [
  "cars", "buses", "trucks", "special", "type_unknown",
  "fuel_gas", "fuel_petrol", "fuel_petrol_gas", "fuel_diesel", "fuel_diesel_gas", "fuel_electric", "fuel_hybrid", "fuel_hybrid_gas", "fuel_hybrid_diesel", "fuel_unknown",
  "age_0_2", "age_2_5", "age_5_10", "age_over_10", "age_unknown",
  "owner_companies", "owner_individuals",
] as const;
/** The road-length workbook's rows: Georgia, the 11 regions and Abkhazia. */
export const TRANSPORT_ROAD_AREAS = ["total", ...TRANSPORT_REGIONS, "region_abkhazia"] as const;
export const TRANSPORT_ROAD_PARTS = ["international", "secondary", "local"] as const;
export type TransportIndicator = `transport.${TransportMeasure}.${string}`;
export function transportIndicator(measure: TransportMeasure, group: string): TransportIndicator {
  return `transport.${measure}.${group}`;
}
/** The 452 served indicators, in the plan's indicator-map order. */
export const TRANSPORT_INDICATORS: readonly TransportIndicator[] = [
  ...TRANSPORT_VEHICLE_TYPES.map(type => transportIndicator("fleet", type)),
  ...TRANSPORT_VEHICLE_TYPES.flatMap(type => TRANSPORT_FLEET_FUELS[type].map(fuel => transportIndicator("fleet", `${type}_fuel_${fuel}`))),
  ...TRANSPORT_VEHICLE_TYPES.flatMap(type => fleetAges(type).map(age => transportIndicator("fleet", `${type}_age_${age}`))),
  ...TRANSPORT_PASSENGER_MODES.map(mode => transportIndicator("passenger_km", mode)),
  transportIndicator("passenger_km_per_person", "total"),
  ...TRANSPORT_PASSENGER_GROUPS.map(group => transportIndicator("passengers", group)),
  ...TRANSPORT_FREIGHT_MODES.map(mode => transportIndicator("tonne_km", mode)),
  ...TRANSPORT_FREIGHT_GROUPS.map(group => transportIndicator("freight_tonnes", group)),
  ...TRANSPORT_REGISTER_AREAS.flatMap(area => [area, ...TRANSPORT_REGISTER_PARTS.map(part => `${area}_${part}`)].map(group => transportIndicator("registered", group))),
  ...TRANSPORT_ROAD_AREAS.flatMap(area => [area, ...TRANSPORT_ROAD_PARTS.map(part => `${area}_${part}`)].map(group => transportIndicator("road_km", group))),
];
/** The 13 Geostat workbooks the observations are read from. */
export const TRANSPORT_SOURCES = [
  "geostat_transport_passenger_demand", "geostat_transport_freight_demand", "geostat_transport_fleet_fuel", "geostat_transport_fleet_age",
  "geostat_transport_rail_goods", "geostat_transport_rail_passengers", "geostat_transport_metro", "geostat_transport_airlines",
  "geostat_transport_airports", "geostat_transport_sea_passengers", "geostat_transport_sea_freight", "geostat_transport_registered", "geostat_transport_roads",
];
/** Every archived source: the 13 served workbooks, the other rail, air, sea and road tables, and the five page captures. */
export const TRANSPORT_PUBLIC_SOURCES = [
  ...TRANSPORT_SOURCES,
  "geostat_transport_rail_turnover", "geostat_transport_rail_infrastructure", "geostat_transport_rail_regions", "geostat_transport_air_infrastructure",
  "geostat_transport_taxi_licences", "geostat_transport_technical_inspections", "geostat_transport_sea_ships",
  "geostat_transport_environment_page", "geostat_transport_rail_page", "geostat_transport_air_page", "geostat_transport_road_page", "geostat_transport_sea_page",
];
export type TransportFact = {
  year: number;
  indicatorId: TransportIndicator;
  /** Exact decimal: the stored workbook number as text (a nil "-" cell is 0). */
  value: string;
  /** The value rounded half-up to its display precision (whole km per person, one decimal otherwise). */
  publishedValue: string;
  unit: "thousand_units" | "million_passenger_km" | "passenger_km_per_person" | "thousand_passengers" | "million_tonne_km" | "thousand_tonnes" | "km";
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientTransportFact = Pick<TransportFact, "year" | "indicatorId" | "sourceId"> & {
  value: number;
  unit: "vehicles" | "pkm" | "pkmPerPerson" | "passengers" | "tkm" | "tonnes" | "km";
  decimals: number;
};
export type TransportAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function transportFactKey(fact: Pick<TransportFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function transportSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
