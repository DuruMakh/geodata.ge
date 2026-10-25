import { ECONOMIC_SECTORS } from "../../data/economicSectors/importEconomicSectors";
import { WAGES_SECTORS, type WagesFact } from "../../data/wages/types";
import { publicLabel } from "../../i18n/labels";
import type { Presentation } from "../../i18n/types";
import type { WageGapChapter } from "./types";

// Chapter 08: what a month's work pays, and the gap between women and men.
// Pure reading of the served annual earnings facts. The year is the latest with
// a national average; the median is the one figure that may sit in an earlier
// year of its own.

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Wage gap chapter: no data for ${what}`);
  return value;
}

export function buildWageGapChapter(facts: WagesFact[], presentation: Presentation): WageGapChapter {
  const numbers = new Map<string, number>();
  for (const fact of facts) if (fact.value !== null) numbers.set(`${fact.indicatorId}:${fact.dimension}:${fact.groupId}:${fact.sectorId}:${fact.year}`, Number(fact.value));
  const at = (indicator: WagesFact["indicatorId"], dimension: WagesFact["dimension"], groupId: string, sectorId: string, year: number) =>
    numbers.get(`${indicator}:${dimension}:${groupId}:${sectorId}:${year}`);
  const average = (dimension: WagesFact["dimension"], groupId: string, sectorId: string, year: number) =>
    at("average_monthly_nominal_earnings", dimension, groupId, sectorId, year);

  const nationalYears = facts
    .filter((fact) => fact.indicatorId === "average_monthly_nominal_earnings" && fact.dimension === "national" && fact.groupId === "georgia" && fact.sectorId === "total" && fact.value !== null)
    .map((fact) => fact.year)
    .sort((a, b) => a - b);
  const year = need(nationalYears.at(-1), "the national average earnings");

  const nationalAverage = need(average("national", "georgia", "total", year), `national average ${year}`);
  const women = need(average("sex", "women", "total", year), `women ${year}`);
  const men = need(average("sex", "men", "total", year), `men ${year}`);
  const publicSector = need(average("ownership", "public", "total", year), `public sector ${year}`);
  const nonPublic = need(average("ownership", "non_public", "total", year), `non-public sector ${year}`);

  const sectors = ECONOMIC_SECTORS.filter((sector) => (WAGES_SECTORS as readonly string[]).includes(sector.id))
    .flatMap((sector) => {
      const sectorAverage = average("national", "georgia", sector.id, year);
      const sectorWomen = average("sex", "women", sector.id, year);
      const sectorMen = average("sex", "men", sector.id, year);
      if (sectorAverage === undefined || sectorWomen === undefined || sectorMen === undefined) return [];
      return [{ id: sector.id, label: publicLabel(presentation.locale, sector.id, sector.labelKa, presentation.englishLabels), average: sectorAverage, women: sectorWomen, men: sectorMen }];
    })
    .sort((a, b) => b.average - a.average);
  need(sectors.length ? sectors : undefined, `sector averages ${year}`);

  const medianYear = need(
    facts
      .filter((fact) => fact.indicatorId === "median_monthly_earnings" && fact.dimension === "national" && fact.groupId === "georgia" && fact.sectorId === "total" && fact.value !== null)
      .map((fact) => fact.year)
      .sort((a, b) => b - a)[0],
    "median earnings",
  );
  const median = { year: medianYear, value: need(at("median_monthly_earnings", "national", "georgia", "total", medianYear), `median ${medianYear}`) };

  return {
    year,
    average: nationalAverage,
    women,
    men,
    ratio: women / men,
    median,
    publicSector,
    nonPublic,
    history: { years: nationalYears, values: nationalYears.map((when) => need(average("national", "georgia", "total", when), `national average ${when}`)) },
    sectors,
  };
}
