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
};

export const FUTURE_METHODOLOGY_DATASETS = [
  { title: "ინფლაცია", href: null, state: "future" },
  { title: "მშპ", href: null, state: "future" },
  { title: "მოსახლეობა", href: null, state: "future" },
  { title: "უმუშევრობა", href: null, state: "future" },
] as const;

const ENGLISH_METHODOLOGY_CONTENT: Readonly<Record<MethodologyDatasetId, MethodologyContent>> = {
  expenditure: EN_EXPENDITURE, revenue: EN_REVENUE, municipalities: EN_MUNICIPALITIES, debt: EN_DEBT,
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
): { firstYear: number; lastYear: number } {
  const source = METHODOLOGY_CONTENT[id].coverageSource;
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
      coverage: deriveMethodologyCoverage(id, input.budgetFacts, input.municipalFacts, input.debtFacts),
      originalFileCount: archive.fileCount,
      reviewedAt: content.reviewedAt,
    };
  });
}
