import type { GlossaryEntry } from "../data/glossary";
import {
  MUNICIPAL_COUNTRY_ID,
  type Municipality,
  type MunicipalTotalFact,
} from "../data/municipal/types";
import type { SourceDocumentRow } from "../data/sources";
import type {
  ServedBudgetFact,
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
} from "../servedRows";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "../explorer/explorerData";

// Compact server-side model: budget-derived landing values come from the same
// active facts as the explorer, while shared page context stays lightweight.

export type LandingBasisStatus = "actual" | "planned" | "mixed";

export type LandingSummaryRow = {
  id: string;
  labelKa: string;
  amountGel: number;
  share: number;
};

export type LandingDatasetSummary = {
  latestYear: number;
  totalGel: number;
  basis: LandingBasisStatus;
  rows: LandingSummaryRow[];
};

export type LandingDebtSummary = {
  latestYear: number;
  totalGel: number;
  domesticGel: number;
  externalGel: number;
};

export type LandingDeficitSummary = {
  latestActualYear: number;
  percentGdp: number;
  recentActual: Array<{ year: number; percentGdp: number }>;
};

export type LandingContext = {
  yearsLabel: string;
  updatedAt: string;
};

export type LandingModel = LandingContext & {
  expenditure: LandingDatasetSummary;
  revenue: LandingDatasetSummary;
  municipalities: LandingDatasetSummary;
  debt: LandingDebtSummary;
  deficit: LandingDeficitSummary;
};

type BuildLandingModelInput = {
  facts: ServedBudgetFact[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  municipalities: Municipality[];
  municipalTotalFacts: MunicipalTotalFact[];
  municipalCountryTotalFacts: MunicipalTotalFact[];
  debtFacts: ServedGovernmentDebtFact[];
  balanceFacts: ServedGeneralGovernmentBalanceFact[];
};

function basisStatus(rows: ServedBudgetFact[]): LandingBasisStatus {
  const hasActual = rows.some((row) => row.basis === "actual");
  const hasPlanned = rows.some((row) => row.basis === "planned");
  return hasActual && hasPlanned ? "mixed" : hasPlanned ? "planned" : "actual";
}

function buildNationalSummary(
  activeFacts: ServedBudgetFact[],
  glossary: Map<string, GlossaryEntry>,
  side: ServedBudgetFact["side"],
): LandingDatasetSummary {
  const detailFacts = activeFacts.filter((fact) => fact.side === side && !isDerivedTotalItemId(fact.itemId));
  const latestYear = detailFacts.map((fact) => fact.year).sort((left, right) => left - right).at(-1) ?? 0;
  const latestFacts = detailFacts.filter((fact) => fact.year === latestYear);
  const totalId = side === "revenue" ? "revenue.total" : "expenditure.total";
  const explicitTotal = activeFacts.find((fact) => fact.year === latestYear && fact.itemId === totalId);
  const totalGel = explicitTotal?.amountGel ?? latestFacts.reduce((sum, fact) => sum + fact.amountGel, 0);

  return {
    latestYear,
    totalGel,
    basis: basisStatus(explicitTotal ? [...latestFacts, explicitTotal] : latestFacts),
    rows: latestFacts
      .slice()
      .sort((left, right) => right.amountGel - left.amountGel || left.itemId.localeCompare(right.itemId))
      .slice(0, 4)
      .map((fact) => ({
        id: fact.itemId,
        labelKa: glossary.get(fact.itemId)?.kaLabel ?? fact.itemId,
        amountGel: fact.amountGel,
        share: fact.amountGel / totalGel,
      })),
  };
}

function buildMunicipalSummary(
  municipalities: Municipality[],
  municipalTotalFacts: MunicipalTotalFact[],
  municipalCountryTotalFacts: MunicipalTotalFact[],
): LandingDatasetSummary {
  const countryTotal = municipalCountryTotalFacts
    .filter((fact) => fact.municipalityCode === MUNICIPAL_COUNTRY_ID)
    .slice()
    .sort((left, right) => left.year - right.year)
    .at(-1)!;
  const labels = new Map(municipalities.map((municipality) => [municipality.code, municipality.displayNameKa]));

  return {
    latestYear: countryTotal.year,
    totalGel: countryTotal.publicTotalGel,
    basis: "actual",
    rows: municipalTotalFacts
      .filter((fact) => fact.year === countryTotal.year && labels.has(fact.municipalityCode))
      .slice()
      .sort(
        (left, right) =>
          right.publicTotalGel - left.publicTotalGel || left.municipalityCode.localeCompare(right.municipalityCode),
      )
      .slice(0, 4)
      .map((fact) => ({
        id: fact.municipalityCode,
        labelKa: labels.get(fact.municipalityCode)!,
        amountGel: fact.publicTotalGel,
        share: fact.publicTotalGel / countryTotal.publicTotalGel,
      })),
  };
}

function buildDebtSummary(facts: ServedGovernmentDebtFact[]): LandingDebtSummary {
  const latestYear = facts
    .filter((fact) => fact.family === "stock" && fact.status === "actual" && fact.valueKind === "amount_gel")
    .map((fact) => fact.year)
    .sort((left, right) => left - right)
    .at(-1)!;
  const latest = facts.filter((fact) => fact.year === latestYear && fact.family === "stock");
  const valueFor = (seriesId: ServedGovernmentDebtFact["seriesId"]) => {
    const value = latest.find((fact) => fact.seriesId === seriesId)?.value;
    if (value === null || value === undefined) throw new Error(`Missing ${seriesId} for ${latestYear}`);
    return value;
  };

  return {
    latestYear,
    totalGel: valueFor("debt.stock.total"),
    domesticGel: valueFor("debt.stock.domestic"),
    externalGel: valueFor("debt.stock.external"),
  };
}

function buildDeficitSummary(facts: ServedGeneralGovernmentBalanceFact[]): LandingDeficitSummary {
  const recentActual = facts
    .filter((fact) => fact.status === "actual")
    .slice()
    .sort((left, right) => left.year - right.year)
    .slice(-3);
  const latestActual = recentActual.at(-1)!;

  return {
    latestActualYear: latestActual.year,
    percentGdp: latestActual.generalGovernmentBalancePctGdp,
    recentActual: recentActual.map((fact) => ({
      year: fact.year,
      percentGdp: fact.generalGovernmentBalancePctGdp,
    })),
  };
}

function buildLandingContextFromActive(
  activeFacts: ServedBudgetFact[],
  sourceDocuments: SourceDocumentRow[],
): LandingContext {
  const revenueYears = Array.from(new Set(activeFacts.filter((fact) => fact.side === "revenue").map((fact) => fact.year))).sort(
    (left, right) => left - right,
  );
  const revMin = revenueYears.at(0) ?? 0;
  const revMax = revenueYears.at(-1) ?? 0;

  return {
    yearsLabel: revMin && revMax ? `${revMin}–${revMax}` : "",
    updatedAt: sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "",
  };
}

export function buildLandingContext({
  facts,
  sourceDocuments,
}: Pick<BuildLandingModelInput, "facts" | "sourceDocuments">): LandingContext {
  return buildLandingContextFromActive(
    chooseActivePublicFacts(facts).filter((fact) => !isDerivedTotalItemId(fact.itemId)),
    sourceDocuments,
  );
}

export function buildLandingModel({
  facts,
  glossary,
  sourceDocuments,
  municipalities,
  municipalTotalFacts,
  municipalCountryTotalFacts,
  debtFacts,
  balanceFacts,
}: BuildLandingModelInput): LandingModel {
  const active = chooseActivePublicFacts(facts);
  const context = buildLandingContextFromActive(
    active.filter((fact) => !isDerivedTotalItemId(fact.itemId)),
    sourceDocuments,
  );
  const expenditure = buildNationalSummary(active, glossary, "expenditure");
  const revenue = buildNationalSummary(active, glossary, "revenue");
  const municipalSummary = buildMunicipalSummary(municipalities, municipalTotalFacts, municipalCountryTotalFacts);

  return {
    ...context,
    expenditure,
    revenue,
    municipalities: municipalSummary,
    debt: buildDebtSummary(debtFacts),
    deficit: buildDeficitSummary(balanceFacts),
  };
}
