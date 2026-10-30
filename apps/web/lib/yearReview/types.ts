// The Year in review page's one data object: built on the server from the served datasets, handed to the browser whole.
// No imports, so the client can take these types without pulling a data loader into its bundle (as lib/servedRows.ts).

export type Values = (number | null)[]; // aligned to the owning block's `years`
export type Category = { id: string; label: string; color: string; values: Values };
export type YearReviewData = {
  budget: {
    years: number[];            // first..last active expenditure year (2004..2026)
    planned: boolean[];         // expenditure active facts of that year are planned
    defaultYear: number;        // last year whose expenditure is not planned
    fields: Category[];         // GEL; sorted by defaultYear value desc, spending.other_unclassified last
    institutions: Category[];   // admin_category level only, same sort
    receipts: (Category & { tax: boolean })[]; // revenue items, GEL, same years (null where absent)
    gdp: Values;                // GEL, current prices
    population: Values;         // persons on 1 January, demography.population_total, country.georgia
  };
  spendingTypes: { years: number[]; total: Values; types: Category[] }; // nominal GEL; types exclude spending_type.total and .expense
  taxBreaks: { years: number[]; vat: Values; income: Values; all: Values }; // GEL (served value is mln: ×1e6)
  refunds: { years: number[]; values: Values };                            // GEL
  balance: { years: number[]; pctGdp: Values; gel: Values; projection: boolean[] };
  debt: {
    stock: { years: number[]; external: Values; domestic: Values; total: Values }; // GEL, actual only
    rates: { years: number[]; total: Values; external: Values; domestic: Values }; // percent
    service: { years: number[]; principal: Values; interest: Values; projection: boolean[] }; // GEL
  };
  municipal: {
    year: number;               // MUNICIPAL_PER_RESIDENT_YEAR
    regions: { id: string; label: string }[];
    places: { code: string; label: string; regionId: string; totalGel: number; perResidentGel: number }[];
  };
  updatedAt: string;            // citedReviewedAt over budget + admin facts, as today's page
  sources: YearReviewSources;   // the source pages' own source lines, for the share pictures
};
/** Each source page's source line in the page language: Tax breaks and refunds, Deficit (with its WEO edition), Debt. */
export type YearReviewSources = { taxBreaks: string; balance: string; debt: string };
