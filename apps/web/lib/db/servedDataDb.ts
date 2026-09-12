import type { LoadedExplorerData, LoadedLandingData, MunicipalData } from "../data/servedData";
import type {
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
} from "../servedRows";
import {
  loadAdminCategoriesFromMirror,
  loadAdminFactsFromMirror,
  loadBudgetFactsFromMirror,
  loadGlossaryFromMirror,
  loadMunicipalFunctionFactsFromMirror,
  loadMunicipalAdjaraBudgetAdjustmentsFromMirror,
  loadMunicipalCountryFunctionFactsFromMirror,
  loadMunicipalCountryTotalFactsFromMirror,
  loadMunicipalFunctionsFromMirror,
  loadMunicipalitiesFromMirror,
  loadMunicipalRegionsFromMirror,
  loadMunicipalTotalFactsFromMirror,
  loadMunicipalPopulationFactsFromMirror,
  loadNationalGdpFactsFromMirror,
  loadGovernmentDebtFactsFromMirror,
  loadGeneralGovernmentBalanceFactsFromMirror,
  loadGdpOverviewFactsFromMirror,
  loadInflationBasketWeightsFromMirror,
  loadInflationCategoryFactsFromMirror,
  loadInflationCpiFactsFromMirror,
  loadInflationTargetsFromMirror,
  loadSourceDocumentsFromMirror,
} from "./mirrorRows";
import { prisma } from "./prisma";

// Database-backed loaders for GEODATA_DATA_SOURCE=db, reading the mirror over
// the pooled connection. The row shapes and mapping live in ./mirrorRows so
// the import can run the identical read path inside its transaction.

export async function loadLandingDataFromDb(): Promise<LoadedLandingData> {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactsFromMirror(prisma),
    loadGlossaryFromMirror(prisma),
    loadSourceDocumentsFromMirror(prisma),
  ]);

  return { facts, glossary, sourceDocuments };
}

export async function loadExplorerDataFromDb(): Promise<LoadedExplorerData> {
  const [landing, adminFacts, adminCategories, gdpFacts] = await Promise.all([
    loadLandingDataFromDb(),
    loadAdminFactsFromMirror(prisma),
    loadAdminCategoriesFromMirror(prisma),
    loadNationalGdpFactsFromMirror(prisma),
  ]);

  return { ...landing, adminFacts, adminCategories, gdpFacts };
}

export async function loadGovernmentDebtFactsFromDb(): Promise<ServedGovernmentDebtFact[]> {
  return loadGovernmentDebtFactsFromMirror(prisma);
}

export async function loadGeneralGovernmentBalanceFactsFromDb(): Promise<
  ServedGeneralGovernmentBalanceFact[]
> {
  return loadGeneralGovernmentBalanceFactsFromMirror(prisma);
}

export async function loadMunicipalDataFromDb(): Promise<MunicipalData> {
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
    loadMunicipalFunctionsFromMirror(prisma),
    loadMunicipalRegionsFromMirror(prisma),
    loadMunicipalitiesFromMirror(prisma),
    loadMunicipalFunctionFactsFromMirror(prisma),
    loadMunicipalTotalFactsFromMirror(prisma),
    loadMunicipalCountryFunctionFactsFromMirror(prisma),
    loadMunicipalCountryTotalFactsFromMirror(prisma),
    loadMunicipalAdjaraBudgetAdjustmentsFromMirror(prisma),
    loadMunicipalPopulationFactsFromMirror(prisma),
  ]);

  return {
    functions,
    regions,
    municipalities,
    functionFacts,
    totalFacts,
    countryFunctionFacts,
    countryTotalFacts,
    adjaraBudgetAdjustments,
    populationFacts,
  };
}

export async function loadGdpOverviewFactsFromDb(){return loadGdpOverviewFactsFromMirror(prisma);}

export async function loadInflationDataFromDb() {
  const [facts, targets, categories, weights] = await Promise.all([
    loadInflationCpiFactsFromMirror(prisma),
    loadInflationTargetsFromMirror(prisma),
    loadInflationCategoryFactsFromMirror(prisma),
    loadInflationBasketWeightsFromMirror(prisma),
  ]);
  return { facts, targets, categories, weights };
}
