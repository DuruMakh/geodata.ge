import Decimal from "decimal.js";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const canonical = (value: Decimal) => value.toDecimalPlaces(20).toFixed();

// Callers validate finite decimal inputs; null results are gaps, not zeroes.
export function sharePercent(value: string | null, gdp: string | null): string | null {
  if (value === null || gdp === null || new D(gdp).lte(0)) return null;
  return canonical(new D(value).div(gdp).mul(100));
}

export function annualGrowthPercent(current: string | null, previous: string | null): string | null {
  if (current === null || previous === null || new D(previous).lte(0)) return null;
  return canonical(new D(current).div(previous).minus(1).mul(100));
}

export function indexToGrowthPercent(index: string | null): string | null {
  if (index === null) return null;
  return canonical(new D(index).minus(100));
}
