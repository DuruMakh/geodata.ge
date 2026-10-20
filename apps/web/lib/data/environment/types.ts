import { BUSINESS_REGIONS } from "../business/types";

/** The nine cities with monitoring stations, in Geostat's sheet order. */
export const ENVIRONMENT_CITIES = ["tbilisi", "kutaisi", "batumi", "rustavi", "zestaponi", "zugdidi", "akhaltsikhe", "telavi", "mestia"] as const;
export type EnvironmentCity = (typeof ENVIRONMENT_CITIES)[number];
/** The 16 monitoring stations: `<city>_<Geostat code>`, in Geostat's order. Zestaponi's is the one manual station. */
export const ENVIRONMENT_STATIONS = [
  { id: "tbilisi_a1", city: "tbilisi", code: "A1" }, { id: "tbilisi_a2", city: "tbilisi", code: "A2" }, { id: "tbilisi_a3", city: "tbilisi", code: "A3" },
  { id: "tbilisi_a4", city: "tbilisi", code: "A4" }, { id: "tbilisi_a5", city: "tbilisi", code: "A5" },
  { id: "kutaisi_b1", city: "kutaisi", code: "B1" }, { id: "kutaisi_b2", city: "kutaisi", code: "B2" },
  { id: "batumi_c1", city: "batumi", code: "C1" }, { id: "batumi_c2", city: "batumi", code: "C2" },
  { id: "rustavi_d1", city: "rustavi", code: "D1" }, { id: "rustavi_d2", city: "rustavi", code: "D2" },
  { id: "zestaponi_e1", city: "zestaponi", code: "E1" },
  { id: "zugdidi_f1", city: "zugdidi", code: "F1" }, { id: "akhaltsikhe_g1", city: "akhaltsikhe", code: "G1" },
  { id: "telavi_h1", city: "telavi", code: "H1" }, { id: "mestia_i1", city: "mestia", code: "I1" },
] as const satisfies readonly { id: string; city: EnvironmentCity; code: string }[];
/** The pollutants an automatic station measures, each with a city-wide yearly limit; Zestaponi's manual station measures the other four. */
export const ENVIRONMENT_STATION_MEASURES = ["pm10", "pm25", "no2"] as const;
export const ENVIRONMENT_MANUAL_MEASURES = ["tsp", "so2", "no2", "mno2"] as const;
export const ENVIRONMENT_POLLUTANTS = ["co", "nox", "so2", "nh3", "nmvoc", "tsp", "pm10", "pm25"] as const;
/** The site's 11 regions: the Business hub's IDs, in the same order. */
export const ENVIRONMENT_REGIONS = BUSINESS_REGIONS;

const stationsOf = (city: EnvironmentCity) => ENVIRONMENT_STATIONS.filter(station => station.city === city).map(station => station.id);
/** A city's indicators in page order: each pollutant's station averages then the city's limit, then the days over the PM10 limit. */
function cityIndicators(city: EnvironmentCity): string[] {
  if (city === "zestaponi") return ENVIRONMENT_MANUAL_MEASURES.map(measure => `environment.aq.${measure}_avg.zestaponi_e1`);
  return [
    ...ENVIRONMENT_STATION_MEASURES.flatMap(measure => [...stationsOf(city).map(id => `environment.aq.${measure}_avg.${id}`), `environment.aq.${measure}_limit.${city}`]),
    ...stationsOf(city).map(id => `environment.aq.pm10_days.${id}`),
  ];
}
const areas = (prefix: string, extra: readonly string[] = []) => [`${prefix}.georgia`, ...ENVIRONMENT_REGIONS.map(region => `${prefix}.${region}`), ...extra.map(area => `${prefix}.${area}`)];

/**
 * Every indicator the research package can serve, in its page order. One has no rows: Geostat prints no timber cut in
 * Tbilisi in any year. The served observations are checked against the package's coverage, not this list.
 */
export const ENVIRONMENT_INDICATORS: readonly string[] = [
  ...["total", "net", "sector_energy", "sector_industry", "sector_agriculture", "sector_waste", "sector_land", "energy_stationary", "energy_transport",
    "energy_fugitive", "gas_co2", "gas_methane", "gas_nitrous_oxide", "gas_hfcs", "gas_sf6", "per_person"].map(id => `environment.ghg.${id}`),
  ...ENVIRONMENT_POLLUTANTS.flatMap(pollutant => ["total", "stationary", "mobile"].map(part => `environment.air.${pollutant}.${part}`)),
  ...ENVIRONMENT_CITIES.flatMap(cityIndicators),
  ...["temperature", "temperature_anomaly"].flatMap(kind => ["georgia", "tbilisi", "warmest", "coldest"].map(area => `environment.climate.${kind}.${area}`)),
  ...["georgia", "tbilisi", "wettest", "driest"].map(area => `environment.climate.precipitation.${area}`),
  ...["gross", "lost", "net", "households", "lost_share", "people_piped", "people_sewers", "people_treatment", "share_piped", "share_sewers",
    "share_treatment", "per_person", "treatment_primary", "treatment_secondary", "treatment_tertiary"].map(id => `environment.water.${id}`),
  ...areas("environment.waste.collected"), "environment.waste.per_person",
  ...areas("environment.forest.timber_cut", ["protected_areas"]), ...areas("environment.forest.illegal_logging", ["protected_areas"]),
  "environment.forest.fires", "environment.forest.burnt_area",
];

export const ENVIRONMENT_UNITS = [
  "mt_co2e", "kt_co2e", "t_co2e_per_person", "thousand_tonnes", "ug_m3", "days", "celsius", "mm", "million_m3", "million_persons", "percent",
  "m3_per_person", "kg_per_person", "m3", "fires", "hectares",
] as const;
export type EnvironmentUnit = (typeof ENVIRONMENT_UNITS)[number];

/** The workbooks the reviewed values are read from. */
export const ENVIRONMENT_SOURCES = [
  "geostat_env_ghg", "geostat_env_air_emissions", "geostat_env_air_quality", "geostat_env_temperature", "geostat_env_precipitation",
  "geostat_env_water_household", "geostat_env_water_supply", "geostat_env_water_losses", "geostat_env_wastewater", "geostat_env_waste",
  "geostat_env_timber", "geostat_env_illegal_logging", "geostat_env_fires",
];
/** Every archived source: the 13 served workbooks and their Georgian versions, the 14 archived-only workbooks and the six page captures. */
export const ENVIRONMENT_PUBLIC_SOURCES = [
  ...ENVIRONMENT_SOURCES,
  ...ENVIRONMENT_SOURCES.map(id => `${id}_ka`),
  "geostat_env_ods", "geostat_env_protected_areas_indicator", "geostat_env_fertilizer", "geostat_env_pesticide", "geostat_env_final_energy",
  "geostat_env_primary_energy", "geostat_env_renewable_energy", "geostat_env_stationary_air_pollution", "geostat_env_protected_areas",
  "geostat_env_violations", "geostat_env_protected_area_visitors", "geostat_env_water_quality", "geostat_env_forest_area", "geostat_env_timber_purpose",
  "geostat_env_page_565", "geostat_env_page_565_ka", "geostat_env_page_73", "geostat_env_page_73_ka", "geostat_env_page_822", "geostat_env_page_822_ka",
];

/** The reviewed research package the serving files are promoted from. */
export const ENVIRONMENT_RESEARCH_DIRECTORY = "docs/Raw Data/Environment/geostat-environment-annual";

export type EnvironmentFact = {
  year: number;
  indicatorId: string;
  /** The published number as plain decimal text: 12 significant digits, no trailing zeros. */
  value: string;
  /** Equals `value`: every served cell is the published figure. */
  publishedValue: string;
  unit: EnvironmentUnit;
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};

/** `decimals` is the published value's: a series is shown to the most decimals any of its years carries. */
export type ClientEnvironmentFact = Pick<EnvironmentFact, "year" | "indicatorId" | "sourceId" | "unit"> & { value: number; decimals: number };

export function environmentFactKey(fact: Pick<EnvironmentFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function environmentSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
