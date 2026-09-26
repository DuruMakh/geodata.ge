import type { CityFactInput } from "../../../lib/data/inflation/types";

const MONTHS = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

/** Annual rates for August 2026, the latest month; earlier months are the same value minus 0.1 per month back. */
const LATEST: Record<string, { total: number; food: number }> = {
  "country.georgia": { total: 5.6479, food: 5.0154 },
  "city.tbilisi": { total: 5.6358, food: 4.8642 },
  "city.kutaisi": { total: 5.7517, food: 6.507 },
  "city.batumi": { total: 7.0857, food: 5.9542 },
  "city.gori": { total: 5.3103, food: 4.0405 },
  "city.telavi": { total: 4.3561, food: 3.4353 },
  "city.zugdidi": { total: 5.1062, food: 4.8152 },
};

export const fixtureCityFacts: CityFactInput[] = Object.entries(LATEST).flatMap(([lineId, latest]) =>
  MONTHS.flatMap((period, index) => {
    const back = (MONTHS.length - 1 - index) * 0.1;
    return [
      { lineId, seriesId: "cpi.headline", measure: "yoy_pct" as const, period, value: latest.total - back },
      { lineId, seriesId: "cpi.cat.01", measure: "yoy_pct" as const, period, value: latest.food - back },
      { lineId, seriesId: "cpi.headline", measure: "mom_pct" as const, period, value: 0.2 },
      ...(period === "2025-12" ? [{ lineId, seriesId: "cpi.headline", measure: "avg12_pct" as const, period, value: 4.1 }] : []),
    ];
  }),
);
