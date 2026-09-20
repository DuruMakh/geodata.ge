import type {
  ClientBasketWeightRow,
  ClientCpiFact,
  ClientGdpObservation,
  ClientGovernmentDebtFact,
  ClientRegionalEconomyObservation,
  ClientSectorObservation,
  ServedAdminFact,
  ServedBudgetFact,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
} from "../servedRows";
import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedSectorObservation } from "../data/economicSectors/types";
import type { ServedBasketWeightRow, ServedCpiFact } from "../data/inflation/types";
import type { ServedRegionalEconomyObservation } from "../data/regionalEconomies/types";

export type ClientBudgetFact = Omit<ServedBudgetFact, "sourceId">;
export type ClientAdminFact = Omit<
  ServedAdminFact,
  "sourceId" | "officialInstitutionLabelKa"
>;
export type ClientNationalGdpFact = Omit<ServedNationalGdpFact, "sourceId">;

export function projectBudgetFact(fact: ServedBudgetFact): ClientBudgetFact {
  return {
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    amountGel: fact.amountGel,
    basis: fact.basis,
  };
}

export function projectAdminFact(fact: ServedAdminFact): ClientAdminFact {
  return {
    year: fact.year,
    itemId: fact.itemId,
    parentItemId: fact.parentItemId,
    level: fact.level,
    amountGel: fact.amountGel,
    basis: fact.basis,
    officialLabelKa: fact.level === "major_program" ? fact.officialLabelKa : null,
  };
}

export function projectGdpFact(fact: ServedNationalGdpFact): ClientNationalGdpFact {
  return {
    year: fact.year,
    gdpCurrentPricesGel: fact.gdpCurrentPricesGel,
    accountingStandard: fact.accountingStandard,
    status: fact.status,
  };
}

export function projectGdpObservation(fact: ServedGdpObservation): ClientGdpObservation {
  return { seriesId: fact.seriesId, year: fact.year, value: fact.value, status: fact.status };
}

export function projectSectorObservation(fact: ServedSectorObservation): ClientSectorObservation {
  return {
    seriesId: fact.seriesId,
    year: fact.year,
    measure: fact.measure,
    value: fact.value,
    status: fact.status,
  };
}

// GDP switched national accounts standard mid-history, so four of its six
// series cite one Geostat vintage before 2010 and another after: the key has
// to carry the year, or a range spanning the switch would lose a source.
export function sourceIdBySeriesYear(
  facts: readonly { seriesId: string; year: number; sourceId: string }[],
): Record<string, string> {
  return Object.fromEntries(facts.map((fact) => [`${fact.seriesId}:${fact.year}`, fact.sourceId]));
}

/** Sectors: every row of a measure comes from the same publication. */
export function sourceIdByMeasure(
  facts: readonly { measure: string; sourceId: string }[],
): Record<string, string> {
  return Object.fromEntries(facts.map((fact) => [fact.measure, fact.sourceId]));
}

export function projectCpiFact(fact: ServedCpiFact): ClientCpiFact {
  return { seriesId: fact.seriesId, measure: fact.measure, period: fact.period, value: fact.value };
}

export function projectBasketWeight(row: ServedBasketWeightRow): ClientBasketWeightRow {
  return { categoryId: row.categoryId, year: row.year, weightPct: row.weightPct };
}

export function projectDebtFact(fact: ServedGovernmentDebtFact): ClientGovernmentDebtFact {
  const { snapshotDate: _snapshotDate, lastReviewedAt: _lastReviewedAt, ...rest } = fact;
  return rest;
}

export function projectRegionalObservation(
  fact: ServedRegionalEconomyObservation,
): ClientRegionalEconomyObservation {
  return {
    regionId: fact.regionId,
    seriesId: fact.seriesId,
    year: fact.year,
    measure: fact.measure,
    value: fact.value,
    status: fact.status,
  };
}

/** Inflation: one publication per series and measure. */
export function sourceIdBySeriesMeasure(
  facts: readonly { seriesId: string; measure: string; sourceId: string }[],
): Record<string, string> {
  return Object.fromEntries(
    facts.map((fact) => [`${fact.seriesId}:${fact.measure}`, fact.sourceId]),
  );
}
