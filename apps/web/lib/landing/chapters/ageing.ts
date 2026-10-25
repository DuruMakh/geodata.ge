import type { ServedDemographyObservation } from "../../data/demography/types";
import type { AgeingChapter, ReliefPlace } from "./types";
import { chapterNeed } from "./need";

// Chapter 06: who lives here and how that is changing. Pure reading of the
// served demography facts for Georgia, plus births and deaths per municipality
// aligned with the chapter 04 places so the map can colour the same cells.

const GEORGIA = "country.georgia";
const POPULATION = "demography.population_by_age_sex";
const AGE_BAND = "demography.population_age_band";
const TOTAL_CITIZENSHIP = "citizenship.total";
const BANDS = ["band_0_14", "band_15_64", "band_65_plus"];
const ADULT_AGES = ["5_9", "10_14", "15_19", "20_24", "25_29", "30_34", "35_39", "40_44", "45_49", "50_54", "55_59", "60_64", "65_69", "70_74", "75_79", "80_84"];
const AGE_GROUPS = [["age_0", "age_1_4"], ...ADULT_AGES.map((age) => [`age_${age}`]), ["age_85_plus"]];
const AGE_LABELS = ["0–4", ...ADULT_AGES.map((age) => age.replace("_", "–")), "85+"];

const need = chapterNeed("Ageing chapter");

export function buildAgeingChapter(facts: ServedDemographyObservation[], places: ReliefPlace[]): AgeingChapter {
  const georgia = facts.filter((fact) => fact.geographyId === GEORGIA);
  const series = (seriesId: string) => georgia.filter((fact) => fact.seriesId === seriesId);
  const latestYear = (seriesId: string, rows: ServedDemographyObservation[]) => need(rows.length ? Math.max(...rows.map((row) => row.year)) : undefined, seriesId);
  const value = (rows: ServedDemographyObservation[], year: number, pick: (row: ServedDemographyObservation) => boolean, what: string) =>
    need(rows.find((row) => row.year === year && pick(row))?.value, `${what} ${year}`);

  const population = series(POPULATION);
  const populationYears = population.map((row) => row.year);
  const year = latestYear(POPULATION, population);
  const baseYear = need(populationYears.length ? Math.min(...populationYears) : undefined, POPULATION);
  const ageSeries = (sex: "male" | "female", at: number) =>
    AGE_GROUPS.map((groups) => groups.reduce((sum, ageGroup) => sum + value(population, at, (row) => row.sex === sex && row.ageGroup === ageGroup, `${POPULATION} ${sex} ${ageGroup}`), 0));
  const men = ageSeries("male", year);
  const women = ageSeries("female", year);

  const bands = series(AGE_BAND).filter((row) => row.sex === "total");
  const oldShareAt = (at: number) => {
    const band = (id: string) => value(bands, at, (row) => row.ageGroup === id, `${AGE_BAND} ${id}`);
    return band("band_65_plus") / BANDS.reduce((sum, id) => sum + band(id), 0);
  };
  const bandYears = bands.map((row) => row.year);
  const oldYear = latestYear(AGE_BAND, bands);
  const oldBaseYear = need(bandYears.length ? Math.min(...bandYears) : undefined, AGE_BAND);
  const oldShare = oldShareAt(oldYear);
  const oldShareBase = oldShareAt(oldBaseYear);
  // The heading and sentence compare the share with the pyramid's years, so the two series must end and start together.
  if (oldYear !== year) throw new Error(`Ageing chapter: 65+ share is for ${oldYear} but the pyramid is for ${year}`);
  if (oldBaseYear !== baseYear) throw new Error(`Ageing chapter: 65+ base share is for ${oldBaseYear} but the pyramid base is ${baseYear}`);

  const total = (rows: ServedDemographyObservation[], at: number, what: string) => value(rows, at, () => true, what);
  const lifeTotal = series("demography.life_expectancy_total");
  const lifeYear = latestYear("demography.life_expectancy_total", lifeTotal);
  const fertilityRows = series("demography.total_fertility_rate");
  const fertilityYear = latestYear("demography.total_fertility_rate", fertilityRows);

  const netRows = series("demography.net_migration").filter((row) => row.sex === "total" && (row.citizenshipId ?? TOTAL_CITIZENSHIP) === TOTAL_CITIZENSHIP);
  const net = new Map(netRows.map((row) => [row.year, row.value]));
  const migrationYears = [latestYear("demography.net_migration", netRows)];
  while (net.has(migrationYears[0]! - 1)) migrationYears.unshift(migrationYears[0]! - 1);

  const vitalYear = latestYear("demography.live_births", series("demography.live_births"));
  const vitalBySeries = (seriesId: string) =>
    new Map(facts.filter((fact) => fact.seriesId === seriesId && fact.year === vitalYear).map((fact) => [fact.geographyId, fact.value]));
  const births = vitalBySeries("demography.live_births");
  const deaths = vitalBySeries("demography.deaths");
  const placeVital = (code: string) => {
    const placeBirths = births.get(code);
    const placeDeaths = deaths.get(code);
    return placeBirths === undefined || placeDeaths === undefined ? null : { births: placeBirths, deaths: placeDeaths };
  };

  const womenPer100Men = (100 * value(population, year, (row) => row.sex === "female" && row.ageGroup === "total", `${POPULATION} female total`)) / value(population, year, (row) => row.sex === "male" && row.ageGroup === "total", `${POPULATION} male total`);
  const oldestWomenPerMan = women.at(-1)! / men.at(-1)!;
  // The women card's note says the gap widens with age; fail the build rather than print a claim the data does not make.
  if (!(oldestWomenPerMan > womenPer100Men / 100)) {
    throw new Error(`Ageing chapter: women per man aged 85+ (${oldestWomenPerMan.toFixed(2)}) is not above the all-ages ratio (${(womenPer100Men / 100).toFixed(2)}) in ${year}`);
  }

  return {
    pyramid: { year, baseYear, ages: AGE_LABELS, men, women, baseMen: ageSeries("male", baseYear), baseWomen: ageSeries("female", baseYear) },
    oldShare: { year: oldYear, share: oldShare },
    oldShareBase: { year: oldBaseYear, share: oldShareBase },
    ageing: oldShare > oldShareBase,
    womenPer100Men,
    oldestWomenPerMan,
    lifeExpectancy: {
      year: lifeYear,
      total: total(lifeTotal, lifeYear, "demography.life_expectancy_total"),
      women: total(series("demography.life_expectancy_female"), lifeYear, "demography.life_expectancy_female"),
      men: total(series("demography.life_expectancy_male"), lifeYear, "demography.life_expectancy_male"),
    },
    fertility: { year: fertilityYear, rate: total(fertilityRows, fertilityYear, "demography.total_fertility_rate") },
    migration: { years: migrationYears, net: migrationYears.map((netYear) => net.get(netYear)!) },
    births: {
      year: vitalYear,
      births: need(births.get(GEORGIA), "demography.live_births Georgia"),
      deaths: need(deaths.get(GEORGIA), `demography.deaths Georgia ${vitalYear}`),
      places: places.map((place) => placeVital(place.code)),
    },
  };
}
