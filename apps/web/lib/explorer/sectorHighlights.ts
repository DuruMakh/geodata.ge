import type { SectorDefinition } from "../data/economicSectors/types";
import type { ClientSectorObservation } from "../servedRows";
import { SECTOR_GDP } from "./economicSectors";

/** National point-in-time highlights deliberately have no chart-selection input. */
export function buildSectorHighlights(facts: readonly ClientSectorObservation[], registry: readonly SectorDefinition[], year: number) {
  const order = new Map(registry.filter(r => r.id !== SECTOR_GDP).map(r => [r.id, r.sortOrder]));
  const annual = facts.filter(f => f.year === year && order.has(f.seriesId));
  const tie = (a: ClientSectorObservation, b: ClientSectorObservation) => order.get(a.seriesId)! - order.get(b.seriesId)!;
  const nominal = annual.filter(f => f.measure === "nominal").sort((a, b) => b.value - a.value || tie(a, b));
  const growth = annual.filter(f => f.measure === "real_growth");
  const shares = new Map(annual.filter(f => f.measure === "share_of_gdp").map(f => [f.seriesId, f.value]));
  const largest = nominal[0] ?? null;
  const topThree = nominal.slice(0, 3);
  const growthYears = facts.filter(f => f.measure === "real_growth" && order.has(f.seriesId)).map(f => f.year);
  const fastest = [...growth].sort((a, b) => b.value - a.value || tie(a, b))[0] ?? null;
  const slowest = [...growth].sort((a, b) => a.value - b.value || tie(a, b))[0] ?? null;
  const history = facts.filter(f => f.year <= year && order.has(f.seriesId));
  const firstYear = history.length ? Math.min(...history.map(f => f.year)) : year;
  const years = Array.from({ length: year - firstYear + 1 }, (_, i) => firstYear + i);
  const byCell = new Map(history.map(f => [`${f.seriesId}:${f.measure}:${f.year}`, f.value]));
  const growthTrend = (winner: ClientSectorObservation | null) => winner
    ? years.map(y => byCell.get(`${winner.seriesId}:real_growth:${y}`) ?? null) : [];
  return {
    year, largest, largestShare: largest ? shares.get(largest.seriesId) ?? null : null,
    fastest, slowest,
    trends: {
      fastest: growthTrend(fastest), slowest: growthTrend(slowest),
      topThree: years.map(y => {
        const values = topThree.map(f => byCell.get(`${f.seriesId}:share_of_gdp:${y}`));
        return values.length === 3 && values.every(v => v !== undefined)
          ? values.reduce((sum, v) => sum + v, 0) : null;
      }),
    },
    topThree,
    topThreeShare: topThree.length === 3 && topThree.every(f => shares.has(f.seriesId))
      ? topThree.reduce((sum, f) => sum + shares.get(f.seriesId)!, 0) : null,
    growthFirstYear: growthYears.length ? Math.min(...growthYears) : null,
    preliminary: annual.some(f => f.status === "preliminary"),
  };
}
