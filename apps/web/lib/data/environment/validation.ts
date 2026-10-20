import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import {
  ENVIRONMENT_INDICATORS, ENVIRONMENT_POLLUTANTS, ENVIRONMENT_REGIONS, ENVIRONMENT_RESEARCH_DIRECTORY, ENVIRONMENT_SOURCES, ENVIRONMENT_STATIONS,
  ENVIRONMENT_UNITS, environmentFactKey, type EnvironmentFact, type EnvironmentUnit,
} from "./types";

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

/** Every key the serving package must contain, exactly once, from the research package's `coverage.csv`. */
export function expectedEnvironmentKeys(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Set<string> {
  const file = path.join(/* turbopackIgnore: true */ repositoryRoot, ENVIRONMENT_RESEARCH_DIRECTORY, "coverage.csv");
  const keys = new Set<string>();
  for (const line of parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]) {
    // `unavailable_years` lists printed years without a value between the first and last one, such as "2024" or "2018-2021;2023-2024".
    const unavailable = new Set((line.unavailable_years ? line.unavailable_years.split(";") : []).flatMap(part => {
      const [from, to = from] = part.split("-").map(Number);
      return range(from, to);
    }));
    const first = Number(line.first_year), last = Number(line.last_year);
    // Climate tables print 1990 and 1995, then 2000 on: the years between are not printed, so they are no gap.
    const printed = line.indicator_id.startsWith("environment.climate.") ? [1990, 1995, ...range(2000, last)] : range(first, last);
    const years = printed.filter(year => year >= first && year <= last && !unavailable.has(year));
    if (!ENVIRONMENT_INDICATORS.includes(line.indicator_id) || Number(line.observations) !== years.length) {
      throw new Error(`Invalid environment coverage line: ${line.indicator_id}`);
    }
    for (const year of years) keys.add(`${line.indicator_id}:${year}`);
  }
  return keys;
}

const SUPPLY = "geostat_env_water_supply", HOUSEHOLD = "geostat_env_water_household", WASTEWATER = "geostat_env_wastewater";
/** The workbook and unit each indicator is read in. */
export function environmentContract(indicatorId: string): { sourceId: string; unit: EnvironmentUnit } {
  const [, topic, item, area] = indicatorId.split(".");
  switch (topic) {
    case "ghg": return { sourceId: "geostat_env_ghg", unit: item === "gas_hfcs" || item === "gas_sf6" ? "kt_co2e" : item === "per_person" ? "t_co2e_per_person" : "mt_co2e" };
    case "air": return { sourceId: "geostat_env_air_emissions", unit: "thousand_tonnes" };
    case "aq": return { sourceId: "geostat_env_air_quality", unit: item === "pm10_days" ? "days" : "ug_m3" };
    case "climate": return item === "precipitation" ? { sourceId: "geostat_env_precipitation", unit: "mm" } : { sourceId: "geostat_env_temperature", unit: "celsius" };
    case "water": {
      if (["gross", "lost", "net"].includes(item)) return { sourceId: SUPPLY, unit: "million_m3" };
      if (item === "households") return { sourceId: HOUSEHOLD, unit: "million_m3" };
      if (item === "per_person") return { sourceId: HOUSEHOLD, unit: "m3_per_person" };
      if (item === "lost_share") return { sourceId: "geostat_env_water_losses", unit: "percent" };
      if (item === "people_piped") return { sourceId: SUPPLY, unit: "million_persons" };
      if (item === "share_piped") return { sourceId: SUPPLY, unit: "percent" };
      return { sourceId: WASTEWATER, unit: item.startsWith("share_") ? "percent" : "million_persons" };
    }
    case "waste": return { sourceId: "geostat_env_waste", unit: item === "per_person" ? "kg_per_person" : "thousand_tonnes" };
    default:
      if (item === "fires" || item === "burnt_area") return { sourceId: "geostat_env_fires", unit: item === "fires" ? "fires" : "hectares" };
      if (!area) throw new Error(`Unknown environment indicator: ${indicatorId}`);
      return { sourceId: item === "timber_cut" ? "geostat_env_timber" : "geostat_env_illegal_logging", unit: "m3" };
  }
}

/** Parts may differ from the printed total by Geostat's rounding: 0.15 of the published unit, 2 m³ for timber and logging. */
const ROUNDED = new Decimal("0.15"), FOREST = new Decimal(2);
/** The design document's anchor values (published text), which a rule change must not move. */
const ANCHORS: ReadonlyArray<readonly [string, number, string]> = [
  ["environment.ghg.total", 2000, "11.4"], ["environment.ghg.total", 2022, "20.1"], ["environment.ghg.per_person", 2022, "5.4"],
  ["environment.ghg.sector_land", 2022, "-5.8"], ["environment.air.co.total", 2024, "86.4"],
  ["environment.aq.pm10_avg.tbilisi_a1", 2025, "31"], ["environment.aq.pm10_avg.rustavi_d1", 2025, "51"], ["environment.aq.pm10_days.kutaisi_b1", 2025, "67"],
  ["environment.climate.temperature.georgia", 2024, "10.3"], ["environment.water.lost", 2025, "559.9"], ["environment.water.lost_share", 2025, "64.4"],
  ["environment.waste.collected.georgia", 2024, "1184"], ["environment.forest.timber_cut.georgia", 2024, "376215"],
  ["environment.forest.illegal_logging.georgia", 2014, "45915"],
];

export function validateEnvironmentFacts(facts: readonly EnvironmentFact[], repositoryRoot?: string): void {
  const expected = expectedEnvironmentKeys(repositoryRoot);
  const seen = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = environmentFactKey(fact);
    if (!ENVIRONMENT_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid environment identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Environment observation outside the approved coverage: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate environment observation: ${key}`);
    const contract = environmentContract(fact.indicatorId);
    if (
      !ENVIRONMENT_UNITS.includes(fact.unit) || fact.unit !== contract.unit || fact.basis !== "actual" || fact.valueStatus !== "official" ||
      fact.sourceId !== contract.sourceId || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)
    ) throw new Error(`Invalid environment source contract: ${key}`);
    // A plain decimal with no trailing zero and at most 12 significant digits; a Geostat placeholder is no value.
    if (!/^-?(0|[1-9]\d*)(\.\d*[1-9])?$/.test(fact.value) || fact.value === "-0" || new Decimal(fact.value).sd() > 12) throw new Error(`Invalid environment value: ${key}`);
    // The printed figure is the stored value rounded half up to the decimals Geostat's table shows.
    const shown = new Decimal(fact.publishedValue);
    if (!/^-?(0|[1-9]\d*)(\.\d*[1-9])?$/.test(fact.publishedValue) || !new Decimal(fact.value).toDecimalPlaces(shown.decimalPlaces(), Decimal.ROUND_HALF_UP).equals(shown)) {
      throw new Error(`Environment published value is not its stored value as printed: ${key}`);
    }
    seen.set(key, new Decimal(fact.value));
  }
  const missing = [...expected].filter(key => !seen.has(key));
  if (missing.length) throw new Error(`Incomplete environment coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const id of ENVIRONMENT_SOURCES) if (!facts.some(f => f.sourceId === id)) throw new Error(`Environment source missing from the serving package: ${id}`);

  const value = (indicator: string, year: number) => seen.get(`${indicator}:${year}`) ?? new Decimal(0);
  const yearsOf = (indicator: string) => facts.filter(f => f.indicatorId === indicator).map(f => f.year);
  const agree = (what: string, year: number, total: Decimal, parts: readonly Decimal[], tolerance: Decimal) => {
    if (parts.reduce((sum, part) => sum.plus(part), new Decimal(0)).minus(total).abs().gt(tolerance)) throw new Error(`${what} do not add up: ${year}`);
  };
  const ghg = (item: string, year: number) => value(`environment.ghg.${item}`, year);
  for (const year of yearsOf("environment.ghg.total")) {
    agree("Greenhouse gas sectors", year, ghg("total", year), ["energy", "industry", "agriculture", "waste"].map(s => ghg(`sector_${s}`, year)), ROUNDED);
    agree("Energy emissions", year, ghg("sector_energy", year), ["stationary", "transport", "fugitive"].map(s => ghg(`energy_${s}`, year)), ROUNDED);
    agree("Greenhouse gases", year, ghg("total", year), [ghg("gas_co2", year), ghg("gas_methane", year), ghg("gas_nitrous_oxide", year),
      ghg("gas_hfcs", year).div(1000), ghg("gas_sf6", year).div(1000)], ROUNDED);
    agree("Total and land use", year, ghg("net", year), [ghg("total", year), ghg("sector_land", year)], ROUNDED);
  }
  for (const pollutant of ENVIRONMENT_POLLUTANTS) {
    const air = (part: string, year: number) => value(`environment.air.${pollutant}.${part}`, year);
    for (const year of yearsOf(`environment.air.${pollutant}.total`)) agree(`Air pollutant ${pollutant} sources`, year, air("total", year), [air("stationary", year), air("mobile", year)], ROUNDED);
  }
  for (const year of yearsOf("environment.water.gross")) {
    agree("Water losses and net volume", year, value("environment.water.gross", year), [value("environment.water.lost", year), value("environment.water.net", year)], ROUNDED);
  }
  for (const year of yearsOf("environment.waste.collected.georgia")) {
    agree("Waste regions", year, value("environment.waste.collected.georgia", year), ENVIRONMENT_REGIONS.map(r => value(`environment.waste.collected.${r}`, year)), ROUNDED);
  }
  for (const measure of ["timber_cut", "illegal_logging"]) {
    for (const year of yearsOf(`environment.forest.${measure}.georgia`)) {
      agree(`Forest ${measure} areas`, year, value(`environment.forest.${measure}.georgia`, year),
        [...ENVIRONMENT_REGIONS, "protected_areas"].map(area => value(`environment.forest.${measure}.${area}`, year)), FOREST);
    }
  }
  // A city's yearly limit is served exactly in the years one of its stations has a yearly average of that pollutant.
  for (const fact of facts.filter(f => f.indicatorId.includes("_limit."))) {
    const [, , measure, city] = fact.indicatorId.split(".");
    const pollutant = measure.replace("_limit", "");
    const measured = ENVIRONMENT_STATIONS.filter(s => s.city === city).some(s => seen.has(`environment.aq.${pollutant}_avg.${s.id}:${fact.year}`));
    if (!measured) throw new Error(`Environment limit served without a station value: ${environmentFactKey(fact)}`);
  }
  for (const fact of facts.filter(f => /^environment\.aq\.(pm10|pm25|no2)_avg\./.test(f.indicatorId) && !f.indicatorId.endsWith("zestaponi_e1"))) {
    const [, , measure, station] = fact.indicatorId.split(".");
    const city = ENVIRONMENT_STATIONS.find(s => s.id === station)!.city;
    if (!seen.has(`environment.aq.${measure.replace("_avg", "_limit")}.${city}:${fact.year}`)) throw new Error(`Environment station value without its city's limit: ${environmentFactKey(fact)}`);
  }
  for (const [indicator, year, text] of ANCHORS) {
    if (seen.get(`${indicator}:${year}`)?.toFixed() !== text) throw new Error(`Environment anchor value changed: ${indicator}:${year}`);
  }
}
