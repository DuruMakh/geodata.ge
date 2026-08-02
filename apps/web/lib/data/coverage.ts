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

// Ministries (organizational) coverage. 2017-2025 is the confirmed baseline.
// 2013 is a drop-in (its workbook is the full tavi 6 actuals table).
// 2014 actuals are recovered from the 2015 workbook's col_4; 2005 is an AcadNusx
// ministry-totals year (see extractOlderMinistryYears). Group C years are extracted from
// the official annual-execution-report PDFs (see extractAnnualReportYears). 2006-2011 are
// legacy AcadNusx reports. Only 2004 (Group D) remains — a scope decision, not extraction.
export const ADMIN_SPENDING_YEARS = [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, ...inclusiveYears(2017, APP_END_YEAR)];

// Municipal coverage. 2015 is the first year the archived portal publishes a
// complete twelve-month functional series for all 69 municipalities; 2014 and
// earlier have no comparable source. See
// docs/data-methodology/municipal-functional-annual-2015-2025.md.
export const MUNICIPAL_START_YEAR = 2015;
export const MUNICIPAL_YEARS = inclusiveYears(MUNICIPAL_START_YEAR, APP_END_YEAR);
