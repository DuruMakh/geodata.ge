import { GDP_METHODOLOGY_CONTENT } from "./content/gdp";
import { ECONOMIC_SECTORS_METHODOLOGY } from "./content/economic-sectors";
import { ECONOMIC_SECTORS_METHODOLOGY as EN_SECTORS } from "./content/en/economic-sectors";
import { GDP_METHODOLOGY_CONTENT as EN_GDP } from "./content/en/gdp";
import { INFLATION_METHODOLOGY_CONTENT } from "./content/inflation";
import { INFLATION_METHODOLOGY_CONTENT as EN_INFLATION } from "./content/en/inflation";
import { REGIONAL_ECONOMIES_METHODOLOGY as EN_REGIONAL_ECONOMIES } from "./content/en/regional-economies";
import { REGIONAL_ECONOMIES_METHODOLOGY } from "./content/regional-economies";
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
  "regional-economies": REGIONAL_ECONOMIES_METHODOLOGY,
  inflation: INFLATION_METHODOLOGY_CONTENT,
};

const ENGLISH_METHODOLOGY_CONTENT: Readonly<Record<MethodologyDatasetId, MethodologyContent>> = {
  "economic-sectors": EN_SECTORS,
  "regional-economies": EN_REGIONAL_ECONOMIES,
  expenditure: EN_EXPENDITURE, revenue: EN_REVENUE, municipalities: EN_MUNICIPALITIES, debt: EN_DEBT, gdp: EN_GDP, inflation: EN_INFLATION,
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
