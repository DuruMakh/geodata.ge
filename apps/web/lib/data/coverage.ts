export function inclusiveYears(startYear: number, endYear: number): number[] {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
}

export const APP_START_YEAR = 2004;
export const APP_END_YEAR = 2025;
export const REVENUE_START_YEAR = 2005;

export const EXPENDITURE_SOURCE_YEARS = inclusiveYears(APP_START_YEAR, APP_END_YEAR);
export const EXPENDITURE_TOTAL_ONLY_YEARS: number[] = [];
export const EXPENDITURE_DETAILED_YEARS = inclusiveYears(APP_START_YEAR, APP_END_YEAR);
export const EXPENDITURE_YEARS = [...EXPENDITURE_TOTAL_ONLY_YEARS, ...EXPENDITURE_DETAILED_YEARS];

export const REVENUE_SOURCE_YEARS = inclusiveYears(REVENUE_START_YEAR, APP_END_YEAR);
export const REVENUE_TOTAL_ONLY_YEARS: number[] = [];
export const REVENUE_DETAILED_YEARS = inclusiveYears(2005, APP_END_YEAR);
export const REVENUE_YEARS = [...REVENUE_TOTAL_ONLY_YEARS, ...REVENUE_DETAILED_YEARS].sort((a, b) => a - b);

// Ministries (organizational) coverage. 2017-2025 is the confirmed baseline.
// 2013 is a drop-in (its workbook is the full tavi 6 actuals table).
// 2014 actuals are recovered from the 2015 workbook's col_4; 2005 is an AcadNusx
// ministry-totals year (see extractOlderMinistryYears). Group C years are extracted from
// the official annual-execution-report PDFs (see extractAnnualReportYears). 2006-2011 are
// legacy AcadNusx reports. 2004 is a reviewed ministry-total handoff from the complete annex.
export const ADMIN_SPENDING_YEARS = inclusiveYears(2004, APP_END_YEAR);

// Municipal coverage. 2015 is the first year the archived portal publishes a
// complete twelve-month functional series for the 69-unit raw package; the
// public serving layer intentionally excludes five occupied-territory municipal
// bodies and serves 64. Earlier years have no comparable source. See
// docs/data-methodology/municipal-functional-annual-2015-2025.md.
export const MUNICIPAL_START_YEAR = 2015;
export const MUNICIPAL_YEARS = inclusiveYears(MUNICIPAL_START_YEAR, APP_END_YEAR);
