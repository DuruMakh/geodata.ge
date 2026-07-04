export function inclusiveYears(startYear: number, endYear: number): number[] {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
}

export const APP_START_YEAR = 2004;
export const APP_END_YEAR = 2025;
export const REVENUE_START_YEAR = 2005;

export const EXPENDITURE_SOURCE_YEARS = inclusiveYears(APP_START_YEAR, APP_END_YEAR);
// 2004 is deliberately not loaded for now: its treasury E11 is central-budget
// scoped (~1.51B) rather than the full state budget, so it would understate the
// year against the rest of the series. The source PDF stays recognized above.
export const EXPENDITURE_TOTAL_ONLY_YEARS: number[] = [];
export const EXPENDITURE_DETAILED_YEARS = inclusiveYears(2005, APP_END_YEAR);
export const EXPENDITURE_YEARS = [...EXPENDITURE_TOTAL_ONLY_YEARS, ...EXPENDITURE_DETAILED_YEARS];

export const REVENUE_SOURCE_YEARS = inclusiveYears(REVENUE_START_YEAR, APP_END_YEAR);
export const REVENUE_TOTAL_ONLY_YEARS: number[] = [];
export const REVENUE_DETAILED_YEARS = inclusiveYears(2005, APP_END_YEAR);
export const REVENUE_YEARS = [...REVENUE_TOTAL_ONLY_YEARS, ...REVENUE_DETAILED_YEARS].sort((a, b) => a - b);

export const ADMIN_SPENDING_YEARS = inclusiveYears(2017, APP_END_YEAR);
