import type { SectorDefinition } from "../data/economicSectors/types";
import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import type { ClientRegionalEconomyObservation } from "../servedRows";

export function buildRegionalEconomyHighlights(
  facts: readonly ClientRegionalEconomyObservation[],
  registry: readonly SectorDefinition[],
  year: number,
) {
  const sectors = registry.filter((definition) => definition.classificationCode !== null);
  const order = new Map(sectors.map((definition) => [definition.id, definition.sortOrder]));
  const annual = facts.filter((fact) => fact.year === year);
  const nominal = annual
    .filter((fact) => fact.measure === "nominal" && order.has(fact.seriesId))
    .sort((left, right) => right.value - left.value || order.get(left.seriesId)! - order.get(right.seriesId)!);
  const shares = new Map(
    annual.filter((fact) => fact.measure === "share_of_region_gdp").map((fact) => [fact.seriesId, fact.value]),
  );
  const largest = nominal[0] ?? null;
  const topThree = nominal.slice(0, 3);
  const total = annual.find((fact) => fact.seriesId === REGIONAL_GDP_TOTAL && fact.measure === "nominal") ?? null;
  const history = facts.filter((fact) => fact.year <= year);
  const firstYear = history.length > 0 ? Math.min(...history.map((fact) => fact.year)) : year;
  const years = annual.length > 0 ? Array.from({ length: year - firstYear + 1 }, (_, index) => firstYear + index) : [];
  const byCell = new Map(history.map((fact) => [`${fact.seriesId}:${fact.measure}:${fact.year}`, fact.value]));
  return {
    year,
    largest,
    largestSharePct: largest ? shares.get(largest.seriesId) ?? null : null,
    total,
    topThree,
    topThreeSharePct: topThree.length === 3 && topThree.every((fact) => shares.has(fact.seriesId))
      ? topThree.reduce((sum, fact) => sum + shares.get(fact.seriesId)!, 0)
      : null,
    publishedSectorCount: nominal.length,
    trends: {
      largest: largest ? years.map((currentYear) => byCell.get(`${largest.seriesId}:nominal:${currentYear}`) ?? null) : [],
      total: years.map((currentYear) => byCell.get(`${REGIONAL_GDP_TOTAL}:nominal:${currentYear}`) ?? null),
      topThreeShare: years.map((currentYear) => {
        const values = topThree.map((fact) => byCell.get(`${fact.seriesId}:share_of_region_gdp:${currentYear}`));
        return values.length === 3 && values.every((value) => value !== undefined)
          ? values.reduce((sum, value) => sum + value!, 0)
          : null;
      }),
    },
  };
}
