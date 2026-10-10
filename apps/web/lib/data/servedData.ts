import type { AdminSpendingCategory, AdminSpendingFact } from "./adminSpending/types";
import { loadAdminSpendingCategoriesFile } from "./adminSpending/categoriesFile";
import { loadAdminSpendingFacts } from "./adminSpending/importAdminSpendingFacts";
import { loadGlossary, type GlossaryEntry } from "./glossary";
import { loadBudgetFactRows, type BudgetFactImportRow } from "./importBudgetFacts";
import { loadNationalGdpFacts } from "./nationalGdp/importNationalGdp";
import type { NationalGdpFact } from "./nationalGdp/types";
import { resetEconomicSectorsCacheForTests } from "./economicSectors/importEconomicSectors";
import { resetGdpOverviewCacheForTests } from "./gdpOverview/importGdpOverview";
import { resetGeneralGovernmentBalanceCacheForTests } from "./generalGovernmentBalance/importGeneralGovernmentBalance";
import { resetGovernmentDebtCacheForTests } from "./governmentDebt/importGovernmentDebtFacts";
import { resetInflationCacheForTests } from "./inflation/importInflation";
import { resetRegionalEconomyCacheForTests } from "./regionalEconomies/importRegionalEconomies";
import { resetDemographyCacheForTests } from "./demography/importDemography";
import { resolveServedDataSource, type ServedDataSource } from "./servedDataSource";
import { loadSourceDocuments, type SourceDocumentRow } from "./sources";
import type {
  ServedAdminFact,
  ServedBudgetFact,
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../servedRows";
import {
  adjaraBudgetAdjustmentParityKey,
  adminFactParityKey,
  assertSameServedRows,
  budgetFactParityKey,
  municipalFunctionFactParityKey,
  municipalTotalFactParityKey,
  municipalPopulationFactParityKey,
  nationalGdpFactParityKey,
  governmentDebtFactParityKey,
  generalGovernmentBalanceFactParityKey,
} from "./servedDataParity";
import type {
  AdjaraBudgetAdjustment,
  Municipality,
  MunicipalFunction,
  MunicipalFunctionFact,
  MunicipalRegion,
  MunicipalPopulationFact,
  MunicipalTotalFact,
} from "./municipal/types";
import { loadAdjaraBudgetAdjustments } from "./municipal/importAdjaraBudgetAdjustments";
import { loadMunicipalitiesFile } from "./municipal/municipalitiesFile";
import { loadMunicipalPopulationFacts } from "./municipal/importMunicipalPopulation";
import {
  loadMunicipalCountryFunctionFacts,
  loadMunicipalCountryTotalFacts,
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "./municipal/importMunicipalFacts";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "./municipal/taxonomyFiles";

// The one list of files the site serves. The database import mirrors exactly
// these files (scripts/import-budget-facts.ts imports this constant), so
// "what the site serves" and "what the import mirrors" cannot drift apart.
export const SERVED_DATA_FILES = {
  gdpOverviewFacts: "../../data/imports/gdp-overview-annual.csv",
  economicSectorFacts: "../../data/imports/economic-sectors-annual.csv",
  tradeOverviewFacts: "../../data/imports/trade-overview-annual.csv",
  tradePartnerEntities: "../../data/taxonomy/trade-partners.json",
  tradePartnerFacts: "../../data/imports/trade-partners-annual.csv",
  moneyTransferEntities: "../../data/taxonomy/money-transfer-countries.json",
  moneyTransferFacts: "../../data/imports/money-transfers-annual.csv",
  regionalEconomyFacts: "../../data/imports/regional-economies-annual.csv",
  demographyPopulationFacts: "../../data/imports/demography-population-annual.csv",
  demographyDensityFacts: "../../data/imports/demography-density-annual.csv",
  demographyMigrationFacts: "../../data/imports/demography-migration-annual.csv",
  inflationCpiFacts: "../../data/imports/cpi-national-monthly.csv",
  inflationTargets: "../../data/imports/nbg-inflation-target.csv",
  inflationCategoryFacts: "../../data/imports/cpi-categories-monthly.csv",
  inflationBasketWeights: "../../data/imports/cpi-basket-weights.csv",
  inflationCityFacts: "../../data/imports/cpi-cities-monthly.csv",
  budgetFacts: "../../data/imports/budget-facts-2004-2025.csv",
  adminSpendingFacts: "../../data/imports/admin-spending-facts-2004-2025.csv",
  glossary: "../../data/glossary/category-glossary.csv",
  sourceDocuments: "../../data/sources/source-documents.csv",
  adminSpendingCategories: "../../data/taxonomy/admin-spending-categories.json",
  municipalFunctions: "../../data/taxonomy/municipal-functions.json",
  municipalRegions: "../../data/taxonomy/municipal-regions.json",
  municipalities: "../../data/imports/municipalities.csv",
  municipalFunctionFacts: "../../data/imports/municipal-function-facts-2015-2025.csv",
  municipalTotalFacts: "../../data/imports/municipal-total-facts-2015-2025.csv",
  municipalPopulationFacts: "../../data/imports/municipal-population-2025.csv",
  municipalCountryFunctionFacts:
    "../../data/imports/municipal-georgia-function-facts-2015-2025.csv",
  municipalCountryTotalFacts: "../../data/imports/municipal-georgia-total-facts-2015-2025.csv",
  municipalAdjaraBudgetAdjustments:
    "../../data/imports/municipal-adjara-budget-adjustments-2015-2025.csv",
  gdpFacts: "../../data/imports/national-gdp-annual-1996-2025.csv",
  governmentDebtFacts: "../../data/imports/government-debt-facts-2013-2030.csv",
  generalGovernmentBalanceFacts:
    "../../data/imports/general-government-balance-annual-1995-2031.csv",
} as const;

export { loadServedGovernmentDebtData } from "./governmentDebt/importGovernmentDebtFacts";
export { loadServedGeneralGovernmentBalanceData } from "./generalGovernmentBalance/importGeneralGovernmentBalance";
export { loadServedRegionalEconomyData } from "./regionalEconomies/importRegionalEconomies";
export { loadServedDemographyData } from "./demography/importDemography";

// Both live in servedDataSource.ts so the loaders re-exported above can read
// the mode without importing this module back.
export { resolveServedDataSource, type ServedDataSource };

// Full ingestion rows: what the loaders read and what the parity check compares.
// Exported only so the db loader can declare the same shape — no page or
// component should consume these; they stop at the narrowing below.
export type LoadedLandingData = {
  facts: BudgetFactImportRow[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
};

export type LoadedExplorerData = LoadedLandingData & {
  adminFacts: AdminSpendingFact[];
  adminCategories: AdminSpendingCategory[];
  gdpFacts: NationalGdpFact[];
};

// What callers get: the same data with the ingestion-only columns projected
// away (lib/servedRows.ts). These rows are what reaches the browser.
export type LandingData = {
  facts: ServedBudgetFact[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
};

export type ExplorerData = LandingData & {
  adminFacts: ServedAdminFact[];
  adminCategories: AdminSpendingCategory[];
  gdpFacts: ServedNationalGdpFact[];
};

// Municipal data is its own load, not part of ExplorerData: only the
// municipalities routes read it, and folding 8,349 rows into the explorer
// payload would make every other route pay for them on every build — and, in
// db mode, parity-check them too.
export type MunicipalData = {
  functions: MunicipalFunction[];
  regions: MunicipalRegion[];
  municipalities: Municipality[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  countryFunctionFacts: MunicipalFunctionFact[];
  countryTotalFacts: MunicipalTotalFact[];
  adjaraBudgetAdjustments: AdjaraBudgetAdjustment[];
  populationFacts: MunicipalPopulationFact[];
};

// The explorer model walks the facts and lets the last one win, so each series
// carries its most recent official name (lib/explorer/explorerData.ts). That
// needs year-ascending order.
//
// Only the admin facts need this. The public facts reach every model through
// chooseActivePublicFacts, which sorts by (year, itemId) itself, and no other
// consumer of `facts` depends on incoming order. Admin facts go straight into
// the model — `active = adminFacts.map(adminFactForModel)` — with no sort at
// all, so on the CSV path their order is whatever the generator last emitted.
// The db path gets it from its ORDER BY (lib/db/mirrorRows.ts).
//
// The sort is stable, so file order still decides within a year; exact
// cross-path row order is not claimed here, and parity compares by key.
function byYearAscending<T extends { year: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.year - right.year);
}

// The ordering contract, applied on BOTH serving paths.
//
// The csv path used to apply byYearAscending inline in its loaders and the db
// path applied nothing, leaving the db path's guarantee to the ORDER BY inside
// lib/db/mirrorRows.ts. Parity compares by key and is order-insensitive
// (servedDataParity.ts), so a dropped ORDER BY would reach production with
// every gate green and mislabel each joined ministry series. Routing both
// paths through one function makes the contract hold regardless of the query.
export function orderExplorerDataForServing(data: LoadedExplorerData): LoadedExplorerData {
  return {
    ...data,
    adminFacts: byYearAscending(data.adminFacts),
    gdpFacts: byYearAscending(data.gdpFacts),
  };
}

export function orderMunicipalDataForServing(data: MunicipalData): MunicipalData {
  return {
    ...data,
    functionFacts: byYearAscending(data.functionFacts),
    totalFacts: byYearAscending(data.totalFacts),
    countryFunctionFacts: byYearAscending(data.countryFunctionFacts),
    countryTotalFacts: byYearAscending(data.countryTotalFacts),
    adjaraBudgetAdjustments: byYearAscending(data.adjaraBudgetAdjustments),
    populationFacts: byYearAscending(data.populationFacts),
  };
}

// Projection to the served rows. The return annotations are the drift guard:
// widen an ingestion union and assigning it here stops typechecking.
function toServedBudgetFact(fact: BudgetFactImportRow): ServedBudgetFact {
  return {
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    amountGel: fact.amountGel,
    basis: fact.basis,
    sourceId: fact.sourceId,
  };
}

function toServedAdminFact(fact: AdminSpendingFact): ServedAdminFact {
  return {
    year: fact.year,
    itemId: fact.itemId,
    parentItemId: fact.parentItemId,
    level: fact.level,
    amountGel: fact.amountGel,
    basis: fact.basis,
    sourceId: fact.sourceId,
    officialLabelKa: fact.officialLabelKa,
    officialInstitutionLabelKa: fact.officialInstitutionLabelKa,
  };
}

function toServedNationalGdpFact(fact: NationalGdpFact): ServedNationalGdpFact {
  return {
    year: fact.year,
    gdpCurrentPricesGel: fact.gdpCurrentPricesGel,
    accountingStandard: fact.accountingStandard,
    status: fact.status,
    sourceId: fact.sourceId,
  };
}

async function loadLandingDataFromCsv(): Promise<LoadedLandingData> {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts),
    loadGlossary(SERVED_DATA_FILES.glossary),
    loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
  ]);

  return { facts, glossary, sourceDocuments };
}

async function loadExplorerDataFromCsv(): Promise<LoadedExplorerData> {
  const [landing, adminFacts, adminCategories, gdpFacts] = await Promise.all([
    loadLandingDataFromCsv(),
    loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts),
    loadAdminSpendingCategoriesFile(SERVED_DATA_FILES.adminSpendingCategories),
    loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts),
  ]);

  return orderExplorerDataForServing({ ...landing, adminFacts, adminCategories, gdpFacts });
}

async function loadMunicipalDataFromCsv(): Promise<MunicipalData> {
  const [
    functions,
    regions,
    municipalities,
    functionFacts,
    totalFacts,
    countryFunctionFacts,
    countryTotalFacts,
    adjaraBudgetAdjustments,
    populationFacts,
  ] = await Promise.all([
    loadMunicipalFunctionsFile(SERVED_DATA_FILES.municipalFunctions),
    loadMunicipalRegionsFile(SERVED_DATA_FILES.municipalRegions),
    loadMunicipalitiesFile(SERVED_DATA_FILES.municipalities),
    loadMunicipalFunctionFacts(SERVED_DATA_FILES.municipalFunctionFacts),
    loadMunicipalTotalFacts(SERVED_DATA_FILES.municipalTotalFacts),
    loadMunicipalCountryFunctionFacts(SERVED_DATA_FILES.municipalCountryFunctionFacts),
    loadMunicipalCountryTotalFacts(SERVED_DATA_FILES.municipalCountryTotalFacts),
    loadAdjaraBudgetAdjustments(SERVED_DATA_FILES.municipalAdjaraBudgetAdjustments),
    loadMunicipalPopulationFacts(SERVED_DATA_FILES.municipalPopulationFacts),
  ]);

  return orderMunicipalDataForServing({
    functions,
    regions,
    municipalities,
    functionFacts,
    totalFacts,
    countryFunctionFacts,
    countryTotalFacts,
    adjaraBudgetAdjustments,
    populationFacts,
  });
}

// One parity check per served dataset. The mapped types are the guard: adding a
// field to MunicipalData or LoadedExplorerData without adding its entry here is
// a typecheck error, not a silent hole. Before this, an unchecked dataset
// compiled, passed every test, and reached production unverified — parity only
// protects the datasets it is called on.
type ParityCheck<TRow> = { label: string; keyOf: (row: TRow) => string };

export const MUNICIPAL_PARITY_CHECKS: {
  [K in keyof MunicipalData]: ParityCheck<MunicipalData[K][number]>;
} = {
  functions: { label: "municipal functions", keyOf: (row) => row.id },
  regions: { label: "municipal regions", keyOf: (row) => row.id },
  municipalities: { label: "municipalities", keyOf: (row) => row.code },
  functionFacts: { label: "municipal function facts", keyOf: municipalFunctionFactParityKey },
  totalFacts: { label: "municipal total facts", keyOf: municipalTotalFactParityKey },
  countryFunctionFacts: {
    label: "Georgia municipal function facts",
    keyOf: municipalFunctionFactParityKey,
  },
  countryTotalFacts: {
    label: "Georgia municipal total facts",
    keyOf: municipalTotalFactParityKey,
  },
  adjaraBudgetAdjustments: {
    label: "Adjara budget adjustments",
    keyOf: adjaraBudgetAdjustmentParityKey,
  },
  populationFacts: {
    label: "municipal population facts",
    keyOf: municipalPopulationFactParityKey,
  },
};

// glossary is a Map rather than a row array, so it cannot sit in a mapped type
// over row arrays; assertExplorerParity checks it by hand below. Nothing at
// runtime enumerates this type, so completeness here rests entirely on the
// Omit — widening it is the one way to serve an unverified explorer dataset.
type ExplorerRowFields = Omit<LoadedExplorerData, "glossary">;

export const EXPLORER_ROW_PARITY_CHECKS: {
  [K in keyof ExplorerRowFields]: ParityCheck<ExplorerRowFields[K][number]>;
} = {
  facts: { label: "budget facts", keyOf: budgetFactParityKey },
  sourceDocuments: { label: "source documents", keyOf: (row) => row.sourceId },
  adminFacts: { label: "admin spending facts", keyOf: adminFactParityKey },
  adminCategories: { label: "admin spending categories", keyOf: (row) => row.id },
  gdpFacts: { label: "national GDP facts", keyOf: nationalGdpFactParityKey },
};

export const GOVERNMENT_DEBT_PARITY_CHECK: ParityCheck<ServedGovernmentDebtFact> = {
  label: "Government Debt facts",
  keyOf: governmentDebtFactParityKey,
};

export const GENERAL_GOVERNMENT_BALANCE_PARITY_CHECK: ParityCheck<ServedGeneralGovernmentBalanceFact> = {
  label: "general-government balance facts",
  keyOf: generalGovernmentBalanceFactParityKey,
};

// The database is only served after proving it still matches the reviewed
// CSVs in this checkout, row by row. This catches a stale mirror (CSVs merged
// without re-running `npm run data:import`), any direct database edit, and
// any import mapping bug — the build fails loudly instead of serving drifted
// data.
function assertLandingParity(db: LoadedLandingData, csv: LoadedLandingData): void {
  assertSameServedRows("budget facts", csv.facts, db.facts, budgetFactParityKey);
  assertSameServedRows(
    "glossary entries",
    [...csv.glossary.values()],
    [...db.glossary.values()],
    (row) => row.id,
  );
  assertSameServedRows("source documents", csv.sourceDocuments, db.sourceDocuments, (row) => row.sourceId);
}

// The loops below cannot correlate the key type across iterations, so each row
// array is widened to object[] at the call site. The two declarations above are
// where the type safety lives; these are just the walks. Two small explicit
// loops rather than one generic helper — the shared version needed a
// ParityCheck<never> parameter and a Record<string, unknown> cast on the data,
// which cost more comprehension than it saved.
function assertExplorerParity(db: LoadedExplorerData, csv: LoadedExplorerData): void {
  assertSameServedRows(
    "glossary entries",
    [...csv.glossary.values()],
    [...db.glossary.values()],
    (row) => row.id,
  );

  for (const [field, check] of Object.entries(EXPLORER_ROW_PARITY_CHECKS)) {
    const rowCheck = check as ParityCheck<object>;
    const key = field as keyof ExplorerRowFields;
    assertSameServedRows(rowCheck.label, csv[key] as object[], db[key] as object[], rowCheck.keyOf);
  }
}

function assertMunicipalParity(db: MunicipalData, csv: MunicipalData): void {
  for (const [field, check] of Object.entries(MUNICIPAL_PARITY_CHECKS)) {
    const rowCheck = check as ParityCheck<object>;
    const key = field as keyof MunicipalData;
    assertSameServedRows(rowCheck.label, csv[key] as object[], db[key] as object[], rowCheck.keyOf);
  }
}

async function loadServedLandingDataUncached(): Promise<LoadedLandingData> {
  if (resolveServedDataSource() === "db") {
    const { loadLandingDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadLandingDataFromDb(), loadLandingDataFromCsv()]);
    assertLandingParity(db, csv);
    return db;
  }

  return loadLandingDataFromCsv();
}

async function loadServedExplorerDataUncached(): Promise<LoadedExplorerData> {
  if (resolveServedDataSource() === "db") {
    const { loadExplorerDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadExplorerDataFromDb(), loadExplorerDataFromCsv()]);
    assertExplorerParity(db, csv);
    return orderExplorerDataForServing(db);
  }

  return loadExplorerDataFromCsv();
}

async function loadServedMunicipalDataUncached(): Promise<MunicipalData> {
  if (resolveServedDataSource() === "db") {
    const { loadMunicipalDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadMunicipalDataFromDb(), loadMunicipalDataFromCsv()]);
    assertMunicipalParity(db, csv);
    return orderMunicipalDataForServing(db);
  }

  return loadMunicipalDataFromCsv();
}

// Build-time memo. Every route calls one of these, and generateMetadata calls
// again alongside its own page, so a build made 8 separate loads — each one
// re-parsing the CSVs, and in db mode re-running the whole row-by-row parity
// check. Caching the promise rather than the value also collapses concurrent
// callers onto one load, and the explorer dataset satisfies landing callers
// too, so a route that needs both pays for one load instead of two.
//
// Not `use cache`: that directive requires cacheComponents (node_modules/next/
// dist/docs/01-app/03-api-reference/01-directives/use-cache.md), which turns on
// PPR and dynamic-by-default rendering — the opposite of this project's fully
// static contract. Next's own guidance for non-fetch data sources is React
// `cache()` (…/02-guides/caching-without-cache-components.md), but that is
// scoped to a single render pass, so it would dedupe generateMetadata against
// its page and nothing more. A module-level promise covers that case and the
// cross-route one, which is what a static build needs.
//
// Safe because the site is fully static: these run only under `next build` and
// the tsx data scripts, both short-lived processes over immutable inputs, so
// there is no long-running server for the cache to go stale under. A rejection
// is cached too, which is what we want — the first parity failure is the build
// failure, and repeating it would only reprint the same error.
let landingDataPromise: Promise<LandingData> | null = null;
let explorerDataPromise: Promise<ExplorerData> | null = null;
let municipalDataPromise: Promise<MunicipalData> | null = null;

// The memo would otherwise freeze the resolved data source for the life of the
// process, which is right for a build but wrong for a test file that switches
// GEODATA_DATA_SOURCE between cases: the first load would decide the mode for
// every later one and the rest would silently assert against cached data.
export function resetServedDataCacheForTests(): void {
  landingDataPromise = null;
  explorerDataPromise = null;
  municipalDataPromise = null;
  resetGovernmentDebtCacheForTests();
  resetGeneralGovernmentBalanceCacheForTests();
  resetGdpOverviewCacheForTests();
  resetEconomicSectorsCacheForTests();
  resetRegionalEconomyCacheForTests();
  resetDemographyCacheForTests();
  resetInflationCacheForTests();
}

export function loadServedLandingData(): Promise<LandingData> {
  // ExplorerData is a superset of LandingData, so if the explorer load is
  // already in flight, reuse it rather than re-parsing the same CSVs and, in
  // db mode, running a second full parity pass over the same rows.
  landingDataPromise ??=
    explorerDataPromise ??
    loadServedLandingDataUncached().then((loaded) => ({
      ...loaded,
      facts: loaded.facts.map(toServedBudgetFact),
    }));
  return landingDataPromise;
}

export function loadServedExplorerData(): Promise<ExplorerData> {
  explorerDataPromise ??= loadServedExplorerDataUncached().then((loaded) => ({
    ...loaded,
    facts: loaded.facts.map(toServedBudgetFact),
    adminFacts: loaded.adminFacts.map(toServedAdminFact),
    gdpFacts: loaded.gdpFacts.map(toServedNationalGdpFact),
  }));
  // Later landing callers in this process reuse the superset.
  landingDataPromise ??= explorerDataPromise;
  return explorerDataPromise;
}

export function loadServedMunicipalData(): Promise<MunicipalData> {
  municipalDataPromise ??= loadServedMunicipalDataUncached();
  return municipalDataPromise;
}
