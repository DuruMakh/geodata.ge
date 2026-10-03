import { CENSUS_STEP, FAMILIES, SERIES } from "./series";

export type BreakRow = {
  breakId: string;
  /** Series ids on either side of the break, which no growth or change in a rate may span. */
  appliesTo: readonly string[];
  referenceDate: string;
  reason: string;
  sourceNote: string;
};

/**
 * Served series that do not depend on the 1 January population: event counts, the infant mortality
 * rate (per live births) and border-police migration, plus the census counts themselves, which hold
 * a single date and so span nothing. Every other served series is on one side of the census break
 * or the other, so a series added without a decision here fails its test.
 */
export const UNAFFECTED_BY_CENSUS: readonly string[] = [
  SERIES.liveBirths,
  SERIES.deaths,
  SERIES.naturalIncrease,
  SERIES.infantMortalityRate,
  SERIES.immigrants,
  SERIES.emigrants,
  SERIES.netMigration,
  SERIES.immigrantsByCitizenshipGroup,
  SERIES.emigrantsByCitizenshipGroup,
  SERIES.censusPopulationByAge,
  SERIES.censusPopulationBySettlement,
];

/** The breaks inside the served data. The method changes of 2014 and 2012 are series start dates, not breaks. */
export function buildBreakRegister(): BreakRow[] {
  return [
    {
      breakId: "census_recalculation_2025",
      appliesTo: Object.values(FAMILIES)
        .flat()
        .filter((seriesId) => !UNAFFECTED_BY_CENSUS.includes(seriesId)),
      referenceDate: CENSUS_STEP.referenceDate,
      reason:
        `Geostat recalculated the 1 January 2025 population from the 2024 census, which puts it ${CENSUS_STEP.residual.toLocaleString("en-US")} persons ` +
        "above what the 2024 population, births, deaths and net migration give. Values before and after are on different bases, so no growth or " +
        "change in a rate may be computed across it. The 2024 rates use the pre-census mid-year population and the 2025 rates the census-based one.",
      sourceNote:
        'Geostat footnote on tables 01, 02, 02-1, 06, 07 and 08: "Based on the results of the 2024 population census, the population size and ' +
        'related data as of January 1, 2025 were recalculated."',
    },
  ];
}
