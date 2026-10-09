import { SERIES } from "../data/demography/series";
import type { ClientNationalFact } from "../servedRows";
import type { ValueUnit } from "./format";

/** The five national series the births-deaths page shows. The crude rates and infant mortality are mirrored, not shown. */
export const NATIONAL_SERIES: readonly string[] = [
  SERIES.totalFertilityRate,
  SERIES.ageSpecificFertilityRate,
  SERIES.lifeExpectancyTotal,
  SERIES.lifeExpectancyMale,
  SERIES.lifeExpectancyFemale,
];

/** Geostat's seven mother's-age groups, youngest first; the first and last are wider than the rest, as published. */
export const AGE_GROUPS = ["mother_under_20", "mother_20_24", "mother_25_29", "mother_30_34", "mother_35_39", "mother_40_44", "mother_45_54"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** The total fertility rate prints to two decimals, as Geostat publishes it. */
export const UNIT_RATE_2: ValueUnit = { divisor: 1, label: "", decimals: 2 };

export const LIFE_SERIES = [
  { seriesId: SERIES.lifeExpectancyTotal, key: "lifeTotal", colorKey: null },
  { seriesId: SERIES.lifeExpectancyMale, key: "lifeMale", colorKey: "sex.male" },
  { seriesId: SERIES.lifeExpectancyFemale, key: "lifeFemale", colorKey: "sex.female" },
] as const;

export function nationalYears(facts: readonly ClientNationalFact[]): number[] {
  return [...new Set(facts.map((fact) => fact.year))].sort((left, right) => left - right);
}

export function seriesByYear(facts: readonly ClientNationalFact[], seriesId: string, ageGroup = ""): Record<number, number | null> {
  return Object.fromEntries(
    nationalYears(facts).map((year) => [year, facts.find((fact) => fact.seriesId === seriesId && fact.year === year && fact.ageGroup === ageGroup)?.value ?? null]),
  );
}

/** Each year's rates across the seven age groups: one line per year on the fertility curve. */
export function ageCurves(facts: readonly ClientNationalFact[]): { years: number[]; byYear: Record<number, Record<AgeGroup, number | null>> } {
  const rates = facts.filter((fact) => fact.seriesId === SERIES.ageSpecificFertilityRate);
  const years = nationalYears(rates);
  return {
    years,
    byYear: Object.fromEntries(
      years.map((year) => [
        year,
        Object.fromEntries(AGE_GROUPS.map((group) => [group, rates.find((fact) => fact.year === year && fact.ageGroup === group)?.value ?? null])) as Record<AgeGroup, number | null>,
      ]),
    ),
  };
}
