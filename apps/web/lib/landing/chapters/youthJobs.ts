import { REGIONAL_ECONOMY_REGIONS } from "../../data/regionalEconomies/importRegionalEconomies";
import type { ServedUnemploymentObservation } from "../../data/unemployment/types";
import { publicLabel } from "../../i18n/labels";
import type { Presentation } from "../../i18n/types";
import type { ComparisonId, LabourSplit, YouthJobsChapter } from "./types";
import { chapterNeed } from "./need";

// Chapter 07: how many of the young are without a job, against everyone 15+.
// Pure reading of the served annual labour-force facts: the national row, the
// three five-year age groups that make up 15–29, and the regional rates.

const NATIONAL = "georgia";
const YOUTH_GROUPS = ["age.15_19", "age.20_24", "age.25_29"];

const need = chapterNeed("Youth jobs chapter");

/** Whole numbers that sum to exactly 100, shares rounded by the largest remainder. */
export function per100(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const exact = values.map((value) => (value / total) * 100);
  const whole = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let left = 100 - whole.reduce((sum, value) => sum + value, 0), i = 0; left > 0; left--, i++) whole[order[i]!.index]!++;
  return whole;
}

/** The word for youth rate / overall rate, with 1.95–2.05 counting as "twice". */
export function comparisonFor(ratio: number): ComparisonId {
  if (ratio <= 1) return "notHigher";
  if (ratio < 1.2) return "littleHigher";
  if (ratio < 1.75) return "oneAndHalf";
  if (ratio < 1.95) return "almostTwice";
  if (ratio <= 2.05) return "twice";
  return "moreThanTwice";
}

function split(employed: number, unemployed: number, outside: number): LabourSplit {
  return { employed, unemployed, outside, rate: (unemployed / (employed + unemployed)) * 100, per100: per100([employed, unemployed, outside]) as [number, number, number] };
}

export function buildYouthJobsChapter(facts: ServedUnemploymentObservation[], presentation: Presentation): YouthJobsChapter {
  const rows = facts.filter((fact) => fact.sex === "total");
  const level = (dimension: ServedUnemploymentObservation["dimension"], groupId: string, indicatorId: ServedUnemploymentObservation["indicatorId"], year: number) =>
    rows.find((fact) => fact.dimension === dimension && fact.groupId === groupId && fact.indicatorId === indicatorId && fact.year === year)?.value;
  const levels = (dimension: ServedUnemploymentObservation["dimension"], groupId: string, year: number) => {
    const employed = level(dimension, groupId, "employed", year);
    const unemployed = level(dimension, groupId, "unemployed", year);
    const outside = level(dimension, groupId, "outside_labour_force", year);
    return employed === undefined || unemployed === undefined || outside === undefined ? undefined : { employed, unemployed, outside };
  };

  const years = [...new Set(rows.filter((fact) => fact.dimension === "national" && fact.groupId === NATIONAL).map((fact) => fact.year))].sort((a, b) => b - a);
  const year = need(years.find((at) => levels("national", NATIONAL, at) && YOUTH_GROUPS.every((id) => levels("age", id, at))), "a year with the national row and all three youth age groups");

  const national = need(levels("national", NATIONAL, year), `national ${year}`);
  const groups = YOUTH_GROUPS.map((id) => need(levels("age", id, year), `${id} ${year}`));
  const all = split(national.employed, national.unemployed, national.outside);
  const youth = split(...(["employed", "unemployed", "outside"] as const).map((key) => groups.reduce((sum, group) => sum + group[key], 0)) as [number, number, number]);
  const ratio = youth.rate / all.rate;

  const regions = rows
    .filter((fact) => fact.dimension === "region" && fact.indicatorId === "unemployment_rate" && fact.year === year)
    .map((fact) => {
      const region = need(REGIONAL_ECONOMY_REGIONS.find((item) => item.id === fact.groupId), `region ${fact.groupId}`);
      return { id: region.id, label: publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels), rate: fact.value };
    })
    .sort((a, b) => b.rate - a.rate);
  need(regions.length ? regions : undefined, `regional unemployment rates ${year}`);

  return { year, all, youth, ratio, comparison: comparisonFor(ratio), regions };
}
