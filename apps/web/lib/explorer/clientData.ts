import type {
  ClientGdpObservation,
  ClientSectorObservation,
  ServedAdminFact,
  ServedBudgetFact,
  ServedNationalGdpFact,
} from "../servedRows";
import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedSectorObservation } from "../data/economicSectors/types";

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
