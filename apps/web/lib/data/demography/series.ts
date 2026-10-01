import type { EstimateBasis } from "./types";

/** Stable lowercase ASCII series ids; labels are display data, never identifiers. */
export const SERIES = {
  populationTotal: "demography.population_total",
  populationByAgeSex: "demography.population_by_age_sex",
  populationAgeBand: "demography.population_age_band",
  liveBirths: "demography.live_births",
  deaths: "demography.deaths",
  naturalIncrease: "demography.natural_increase",
  crudeBirthRate: "demography.crude_birth_rate",
  crudeDeathRate: "demography.crude_death_rate",
  totalFertilityRate: "demography.total_fertility_rate",
  infantMortalityRate: "demography.infant_mortality_rate",
  lifeExpectancyTotal: "demography.life_expectancy_total",
  lifeExpectancyMale: "demography.life_expectancy_male",
  lifeExpectancyFemale: "demography.life_expectancy_female",
  immigrants: "demography.immigrants",
  emigrants: "demography.emigrants",
  netMigration: "demography.net_migration",
} as const;

/** The archived Geostat tables, by the source ids in the package manifest. */
export const SOURCE_ID = {
  populationUnits: "source.geostat_municipal_population",
  ageSex: "source.geostat_demography_population_age_sex",
  midYear: "source.geostat_demography_population_mid_year",
  births: "source.geostat_demography_births",
  deaths: "source.geostat_demography_deaths",
  naturalIncrease: "source.geostat_demography_natural_increase",
  crudeBirthRate: "source.geostat_demography_crude_birth_rate",
  crudeDeathRate: "source.geostat_demography_crude_death_rate",
  fertility: "source.geostat_demography_fertility",
  infantMortality: "source.geostat_demography_infant_mortality",
  lifeExpectancy: "source.geostat_demography_life_expectancy",
  netMigration: "source.geostat_demography_net_migration",
  migrationCitizenship: "source.geostat_demography_migration_citizenship",
} as const;

/** The day the 2026-10 Geostat capture was reviewed; every observation carries it as `last_reviewed_at`. */
export const REVIEWED_AT = "2026-10-01";

/** Where each series starts. These are decisions, not properties of the files; the end is whatever the file holds. */
export const COVERAGE = {
  /** Georgia-level population and age structure (spec decision 3). */
  populationFrom: 2004,
  /** Regions and municipalities. */
  unitsFrom: 2015,
  /** Vital events start where Geostat moves from retro-projection to registered data. */
  vitalFrom: 2014,
  /** Migration starts where Geostat moves to border-police data. */
  migrationFrom: 2012,
} as const;

/** Lineage of the 1 January population: Geostat's 2018 retro-projection, the 2014-census estimates, then the 2024 census. */
export const RETRO_PROJECTION_THROUGH = 2014;
export const CENSUS_BASED_FROM = 2025;

export function populationEstimateBasis(year: number): EstimateBasis {
  if (year <= RETRO_PROJECTION_THROUGH) return "retro_projection";
  return year >= CENSUS_BASED_FROM ? "census_based" : "pre_census";
}

/** The 19 age rows of the age table, in the order Geostat prints them. */
export const AGE_GROUPS = [
  { label: "0", id: "age_0" },
  { label: "1-4", id: "age_1_4" },
  { label: "5-9", id: "age_5_9" },
  { label: "10-14", id: "age_10_14" },
  { label: "15-19", id: "age_15_19" },
  { label: "20-24", id: "age_20_24" },
  { label: "25-29", id: "age_25_29" },
  { label: "30-34", id: "age_30_34" },
  { label: "35-39", id: "age_35_39" },
  { label: "40-44", id: "age_40_44" },
  { label: "45-49", id: "age_45_49" },
  { label: "50-54", id: "age_50_54" },
  { label: "55-59", id: "age_55_59" },
  { label: "60-64", id: "age_60_64" },
  { label: "65-69", id: "age_65_69" },
  { label: "70-74", id: "age_70_74" },
  { label: "75-79", id: "age_75_79" },
  { label: "80-84", id: "age_80_84" },
  { label: "85+", id: "age_85_plus" },
] as const;

/** Derived bands, as inclusive ranges of indexes into AGE_GROUPS. */
export const AGE_BANDS = [
  { id: "band_0_14", first: 0, last: 3 },
  { id: "band_15_64", first: 4, last: 13 },
  { id: "band_65_plus", first: 14, last: 18 },
] as const;
