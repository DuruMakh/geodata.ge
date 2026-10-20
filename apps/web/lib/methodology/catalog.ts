import { GDP_METHODOLOGY_CONTENT } from "./content/gdp";
import { ECONOMIC_SECTORS_METHODOLOGY } from "./content/economic-sectors";
import { ECONOMIC_SECTORS_METHODOLOGY as EN_SECTORS } from "./content/en/economic-sectors";
import { GDP_EXPENDITURE_METHODOLOGY } from "./content/gdp-expenditure";
import { GDP_EXPENDITURE_METHODOLOGY as EN_GDP_EXPENDITURE } from "./content/en/gdp-expenditure";
import { GDP_METHODOLOGY_CONTENT as EN_GDP } from "./content/en/gdp";
import { INFLATION_METHODOLOGY_CONTENT } from "./content/inflation";
import { INFLATION_METHODOLOGY_CONTENT as EN_INFLATION } from "./content/en/inflation";
import { DEMOGRAPHY_METHODOLOGY } from "./content/demography";
import { DEMOGRAPHY_METHODOLOGY as EN_DEMOGRAPHY } from "./content/en/demography";
import { WAGES_METHODOLOGY_CONTENT } from "./content/wages";
import { WAGES_METHODOLOGY_CONTENT as EN_WAGES } from "./content/en/wages";
import { POVERTY_METHODOLOGY_CONTENT } from "./content/poverty";
import { MONEY_BANKS_METHODOLOGY_CONTENT } from "./content/moneyBanks";
import { POVERTY_METHODOLOGY_CONTENT as EN_POVERTY } from "./content/en/poverty";
import { HOUSEHOLD_INCOME_METHODOLOGY_CONTENT } from "./content/household-income";
import { HOUSEHOLD_INCOME_METHODOLOGY_CONTENT as EN_HOUSEHOLD_INCOME } from "./content/en/household-income";
import { ENERGY_FOOD_METHODOLOGY_CONTENT } from "./content/energyFood";
import { TRANSPORT_METHODOLOGY_CONTENT } from "./content/transport";
import { HEALTH_METHODOLOGY_CONTENT } from "./content/health";
import { HEALTH_METHODOLOGY_CONTENT as EN_HEALTH } from "./content/en/health";
import { CRIME_METHODOLOGY_CONTENT } from "./content/crime";
import { CRIME_METHODOLOGY_CONTENT as EN_CRIME } from "./content/en/crime";
import { EDUCATION_METHODOLOGY_CONTENT } from "./content/education";
import { EDUCATION_METHODOLOGY_CONTENT as EN_EDUCATION } from "./content/en/education";
import { SCIENCE_CULTURE_METHODOLOGY_CONTENT } from "./content/science-culture";
import { SCIENCE_CULTURE_METHODOLOGY_CONTENT as EN_SCIENCE_CULTURE } from "./content/en/science-culture";
import { ENERGY_FOOD_METHODOLOGY_CONTENT as EN_ENERGY_FOOD } from "./content/en/energyFood";
import { ENVIRONMENT_METHODOLOGY_CONTENT } from "./content/environment";
import { ENVIRONMENT_METHODOLOGY_CONTENT as EN_ENVIRONMENT } from "./content/en/environment";
import { TRANSPORT_METHODOLOGY_CONTENT as EN_TRANSPORT } from "./content/en/transport";
import { MONEY_BANKS_METHODOLOGY_CONTENT as EN_MONEY_BANKS } from "./content/en/moneyBanks";
import { BUSINESS_METHODOLOGY_CONTENT } from "./content/business";
import { BUSINESS_METHODOLOGY_CONTENT as EN_BUSINESS } from "./content/en/business";
import { HOUSING_METHODOLOGY_CONTENT } from "./content/housing";
import { HOUSING_METHODOLOGY_CONTENT as EN_HOUSING } from "./content/en/housing";
import { REGIONAL_ECONOMIES_METHODOLOGY as EN_REGIONAL_ECONOMIES } from "./content/en/regional-economies";
import { REGIONAL_ECONOMIES_METHODOLOGY } from "./content/regional-economies";
import { UNEMPLOYMENT_METHODOLOGY_CONTENT } from "./content/unemployment";
import { UNEMPLOYMENT_METHODOLOGY_CONTENT as EN_UNEMPLOYMENT } from "./content/en/unemployment";
import { TRADE_METHODOLOGY_CONTENT } from "./content/trade";
import { TRADE_METHODOLOGY_CONTENT as EN_TRADE } from "./content/en/trade";
import { EXTERNAL_FLOWS_METHODOLOGY_CONTENT } from "./content/external-flows";
import { EXTERNAL_FLOWS_METHODOLOGY_CONTENT as EN_EXTERNAL_FLOWS } from "./content/en/external-flows";
import type { MunicipalTotalFact } from "../data/municipal/types";
import type { Locale } from "../i18n/types";
import { DEBT_METHODOLOGY_CONTENT as EN_DEBT } from "./content/en/debt";
import { EXPENDITURE_METHODOLOGY_CONTENT as EN_EXPENDITURE } from "./content/en/expenditure";
import { MUNICIPALITIES_METHODOLOGY_CONTENT as EN_MUNICIPALITIES } from "./content/en/municipalities";
import { REVENUE_METHODOLOGY_CONTENT as EN_REVENUE } from "./content/en/revenue";
import type { ServedBudgetFact, ServedGovernmentDebtFact } from "../servedRows";
import { DEBT_METHODOLOGY_CONTENT } from "./content/debt";
import { EXPENDITURE_METHODOLOGY_CONTENT } from "./content/expenditure";
import { MUNICIPALITIES_METHODOLOGY_CONTENT } from "./content/municipalities";
import { REVENUE_METHODOLOGY_CONTENT } from "./content/revenue";
import {
  LIVE_METHODOLOGY_IDS,
  type MethodologyContent,
  type MethodologyDatasetId,
  type MethodologyHubEntry,
  type MethodologyHubInput,
} from "./types";

export { LIVE_METHODOLOGY_IDS } from "./types";
export type { MethodologyDatasetId } from "./types";

export const METHODOLOGY_CONTENT: Readonly<Record<MethodologyDatasetId, MethodologyContent>> = {
  expenditure: EXPENDITURE_METHODOLOGY_CONTENT,
  revenue: REVENUE_METHODOLOGY_CONTENT,
  municipalities: MUNICIPALITIES_METHODOLOGY_CONTENT,
  debt: DEBT_METHODOLOGY_CONTENT,
  gdp: GDP_METHODOLOGY_CONTENT,
  "economic-sectors": ECONOMIC_SECTORS_METHODOLOGY,
  "gdp-expenditure": GDP_EXPENDITURE_METHODOLOGY,
  "regional-economies": REGIONAL_ECONOMIES_METHODOLOGY,
  business: BUSINESS_METHODOLOGY_CONTENT,
  housing: HOUSING_METHODOLOGY_CONTENT,
  inflation: INFLATION_METHODOLOGY_CONTENT,
  money: MONEY_BANKS_METHODOLOGY_CONTENT,
  unemployment: UNEMPLOYMENT_METHODOLOGY_CONTENT,
  wages: WAGES_METHODOLOGY_CONTENT,
  poverty: POVERTY_METHODOLOGY_CONTENT,
  "household-income": HOUSEHOLD_INCOME_METHODOLOGY_CONTENT,
  health: HEALTH_METHODOLOGY_CONTENT,
  education: EDUCATION_METHODOLOGY_CONTENT,
  "science-culture": SCIENCE_CULTURE_METHODOLOGY_CONTENT,
  crime: CRIME_METHODOLOGY_CONTENT,
  trade: TRADE_METHODOLOGY_CONTENT,
  "external-flows": EXTERNAL_FLOWS_METHODOLOGY_CONTENT,
  "energy-food": ENERGY_FOOD_METHODOLOGY_CONTENT,
  environment: ENVIRONMENT_METHODOLOGY_CONTENT,
  transport: TRANSPORT_METHODOLOGY_CONTENT,
  demography: DEMOGRAPHY_METHODOLOGY,
};

const ENGLISH_METHODOLOGY_CONTENT: Readonly<Record<MethodologyDatasetId, MethodologyContent>> = {
  "economic-sectors": EN_SECTORS,
  "gdp-expenditure": EN_GDP_EXPENDITURE,
  "regional-economies": EN_REGIONAL_ECONOMIES,
  unemployment: EN_UNEMPLOYMENT,
  trade: EN_TRADE,
  "external-flows": EN_EXTERNAL_FLOWS,
  expenditure: EN_EXPENDITURE, revenue: EN_REVENUE, municipalities: EN_MUNICIPALITIES, debt: EN_DEBT, gdp: EN_GDP, inflation: EN_INFLATION,
  demography: EN_DEMOGRAPHY,
  wages: EN_WAGES,
  poverty: EN_POVERTY,
  "household-income": EN_HOUSEHOLD_INCOME,
  health: EN_HEALTH,
  education: EN_EDUCATION,
  "science-culture": EN_SCIENCE_CULTURE,
  crime: EN_CRIME,
  "energy-food": EN_ENERGY_FOOD,
  environment: EN_ENVIRONMENT,
  transport: EN_TRANSPORT,
  money: EN_MONEY_BANKS,
  business: EN_BUSINESS,
  housing: EN_HOUSING,
};

export function getMethodologyContent(id: MethodologyDatasetId, locale: Locale): MethodologyContent {
  return (locale === "en" ? ENGLISH_METHODOLOGY_CONTENT : METHODOLOGY_CONTENT)[id];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled methodology coverage source: ${JSON.stringify(value)}`);
}

export function deriveMethodologyCoverage(
  id: MethodologyDatasetId,
  budgetFacts: readonly ServedBudgetFact[],
  municipalFacts: readonly MunicipalTotalFact[],
  debtFacts: readonly ServedGovernmentDebtFact[],
  archive?: {minYear?:number;maxYear?:number},
): { firstYear: number; lastYear: number } {
  const source = METHODOLOGY_CONTENT[id].coverageSource;
  if(source.kind === "archive") { if(archive?.minYear === undefined || archive.maxYear === undefined) throw new Error(`Missing ${id} archive coverage`); return {firstYear:archive.minYear,lastYear:archive.maxYear}; }
  const years =
    source.kind === "municipalTotals"
      ? municipalFacts.map((fact) => fact.year)
      : source.kind === "governmentDebt"
        ? debtFacts.map((fact) => fact.year)
      : source.kind === "budgetSide"
        ? budgetFacts.filter((fact) => fact.side === source.side).map((fact) => fact.year)
        : assertNever(source);

  if (years.length === 0) {
    throw new Error(`No served years for live methodology dataset: ${id}`);
  }

  return { firstYear: Math.min(...years), lastYear: Math.max(...years) };
}

export function buildMethodologyHubEntries(input: MethodologyHubInput, locale: Locale = "ka"): MethodologyHubEntry[] {
  return LIVE_METHODOLOGY_IDS.map((id) => {
    const archive = input.archives[id];
    if (!archive || !archive.validated || archive.fileCount < 1) {
      throw new Error(`Live methodology dataset has no validated archive: ${id}`);
    }

    const content = getMethodologyContent(id, locale);
    return {
      id,
      title: content.title,
      summary: content.summary,
      href: locale === "en" ? `/en/methodology/${id}` : `/methodology/${id}`,
      coverage: deriveMethodologyCoverage(id, input.budgetFacts, input.municipalFacts, input.debtFacts, archive),
      originalFileCount: archive.fileCount,
      reviewedAt: content.reviewedAt,
    };
  });
}
