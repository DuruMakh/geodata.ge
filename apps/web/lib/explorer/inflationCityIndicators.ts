import { CPI_CITY_IDS, type CpiCityId } from "../data/inflation/types";
import { CITY_CATEGORIES, GEORGIA_LINE_ID, HEADLINE_ID, cityValues, type CityIndex } from "./inflationCities";
import { displayedValue } from "./inflationGrid";
import { periodBounds } from "./periodRange";

// ძირითადი ინდიკატორები for the cities pages: the latest published month, year on
// year. Differences argue from the printed one-decimal figures, so a reader's own
// subtraction always agrees with the page.

export type CityRate = { cityIds: string[]; value: number; deltaPp: number | null };
export type CityIndicators = {
  period: number;
  national: number | null;
  highest: CityRate;
  /** `fell` says whether the lowest city actually got cheaper, so the page never claims a fall that did not happen. */
  lowest: CityRate & { fell: boolean };
  gap: { value: number; spark: Array<number | null> };
  aboveNational: { count: number; total: number; spark: Array<number | null> } | null;
};

const SPARK_MONTHS = 36;

/**
 * Spec §6: the latest published month, year on year, for the picked category,
 * whatever the tab or range. Cities only — Georgia is the benchmark, never a
 * ranked entry. Ties name every tied city. Differences and the fall wording argue
 * from the printed one-decimal figures, so they never disagree with them.
 */
export function latestCityIndicators(index: CityIndex, category: string): CityIndicators | null {
  const series = CPI_CITY_IDS.flatMap((cityId) => {
    const values = cityValues(index, cityId, category, "yoy_pct");
    return values ? [{ cityId, values }] : [];
  });
  if (series.length === 0) return null;
  const period = periodBounds(series.map((entry) => entry.values), "City data has no periods").max;
  const national = cityValues(index, GEORGIA_LINE_ID, category, "yoy_pct");
  const at = (month: number) =>
    series.flatMap((entry) => {
      const value = entry.values.get(month);
      return value === undefined ? [] : [{ cityId: entry.cityId, value }];
    });
  const present = at(period);
  if (present.length === 0) return null;
  const nationalNow = national?.get(period) ?? null;
  const max = Math.max(...present.map((row) => row.value));
  const min = Math.min(...present.map((row) => row.value));
  const rate = (value: number): CityRate => ({
    cityIds: present.filter((row) => row.value === value).map((row) => row.cityId),
    value,
    deltaPp: nationalNow === null ? null : displayedValue(displayedValue(value) - displayedValue(nationalNow)),
  });
  const window = Array.from({ length: SPARK_MONTHS }, (_, offset) => period - SPARK_MONTHS + 1 + offset);
  return {
    period,
    national: nationalNow,
    highest: rate(max),
    lowest: { ...rate(min), fell: displayedValue(min) < 0 },
    gap: {
      value: displayedValue(displayedValue(max) - displayedValue(min)),
      spark: window.map((month) => {
        const rows = at(month);
        return rows.length < 2 ? null : Math.max(...rows.map((row) => row.value)) - Math.min(...rows.map((row) => row.value));
      }),
    },
    aboveNational:
      nationalNow === null
        ? null
        : {
            count: present.filter((row) => row.value > nationalNow).length,
            total: present.length,
            spark: window.map((month) => {
              const base = national?.get(month);
              const rows = at(month);
              return base === undefined || rows.length === 0 ? null : rows.filter((row) => row.value > base).length;
            }),
          },
  };
}

export type CityCategoryRate = { categoryId: string; value: number; deltaPp: number | null };
export type CityCategoryIndicators = {
  period: number;
  /** The city's total with Georgia's beside it; null if the city has no total that month. */
  total: { value: number; national: number | null; deltaPp: number | null } | null;
  fastest: CityCategoryRate;
  /** `fell` follows the printed rate, so −0.03 (shown 0.0%) never reads as a fall. */
  slowest: CityCategoryRate & { fell: boolean };
  breadth: { rose: number; total: number; spark: Array<number | null> };
};

const printedDelta = (value: number, national: number | undefined): number | null =>
  national === undefined ? null : displayedValue(displayedValue(value) - displayedValue(national));

/**
 * Spec 2026-09-30 §5: a city page's indicators — the city's total against Georgia,
 * then the Categories page's three rate questions over the city's own divisions.
 * Each division is compared with Georgia's same division. Ties keep COICOP order.
 */
export function latestCityCategoryIndicators(index: CityIndex, cityId: CpiCityId): CityCategoryIndicators | null {
  const divisions = CITY_CATEGORIES.slice(1).flatMap((categoryId) => {
    const values = cityValues(index, cityId, categoryId, "yoy_pct");
    return values ? [{ categoryId, values }] : [];
  });
  if (divisions.length === 0) return null;
  const period = periodBounds(divisions.map((entry) => entry.values), "City data has no periods").max;
  const present = divisions.flatMap((entry) => {
    const value = entry.values.get(period);
    return value === undefined ? [] : [{ categoryId: entry.categoryId, value }];
  });
  if (present.length === 0) return null;
  const rate = (row: { categoryId: string; value: number }): CityCategoryRate => ({
    categoryId: row.categoryId,
    value: row.value,
    deltaPp: printedDelta(row.value, cityValues(index, GEORGIA_LINE_ID, row.categoryId, "yoy_pct")?.get(period)),
  });
  const ranked = [...present].sort((a, b) => b.value - a.value);
  const slowest = ranked.at(-1)!;
  const totalNow = cityValues(index, cityId, HEADLINE_ID, "yoy_pct")?.get(period);
  const nationalTotal = cityValues(index, GEORGIA_LINE_ID, HEADLINE_ID, "yoy_pct")?.get(period);
  const window = Array.from({ length: SPARK_MONTHS }, (_, offset) => period - SPARK_MONTHS + 1 + offset);
  return {
    period,
    total: totalNow === undefined ? null : { value: totalNow, national: nationalTotal ?? null, deltaPp: printedDelta(totalNow, nationalTotal) },
    fastest: rate(ranked[0]!),
    slowest: { ...rate(slowest), fell: displayedValue(slowest.value) < 0 },
    breadth: {
      rose: present.filter((row) => displayedValue(row.value) > 0).length,
      total: present.length,
      spark: window.map((month) => {
        const rows = divisions.flatMap((entry) => {
          const value = entry.values.get(month);
          return value === undefined ? [] : [value];
        });
        return rows.length === 0 ? null : rows.filter((value) => displayedValue(value) > 0).length;
      }),
    },
  };
}
