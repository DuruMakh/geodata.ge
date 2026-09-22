import type {
  ClientBasketWeightRow,
  ClientCpiFact,
  ClientGdpObservation,
  ClientGovernmentDebtFact,
  ClientInflationTargetRow,
  ClientRegionalEconomyObservation,
  ClientSectorObservation,
  ServedAdminFact,
  ServedBudgetFact,
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
  ServedNationalGdpFact,
  SourceIdRanges,
} from "../servedRows";
import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedSectorObservation } from "../data/economicSectors/types";
import type {
  ServedBasketWeightRow,
  ServedCpiFact,
  ServedInflationTargetRow,
} from "../data/inflation/types";
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

/**
 * Run-length encodes each series' source ids by year. Emitting a run whenever
 * the id changes keeps the lookup correct whatever the data does — blocky
 * vintages collapse to one entry per boundary, interleaved ids simply produce
 * more runs. See SourceIdRanges for why GDP cannot use a coarser key.
 */
export function sourceIdRangesBySeries(
  facts: readonly { seriesId: string; year: number; sourceId: string }[],
): SourceIdRanges {
  const bySeries = new Map<string, { year: number; sourceId: string }[]>();
  for (const fact of facts) {
    const row = { year: fact.year, sourceId: fact.sourceId };
    const rows = bySeries.get(fact.seriesId);
    if (rows) rows.push(row);
    else bySeries.set(fact.seriesId, [row]);
  }
  const ranges: Record<string, { fromYear: number; sourceId: string }[]> = {};
  for (const [seriesId, rows] of bySeries) {
    const runs: { fromYear: number; sourceId: string }[] = [];
    for (const row of [...rows].sort((a, b) => a.year - b.year))
      if (runs.at(-1)?.sourceId !== row.sourceId)
        runs.push({ fromYear: row.year, sourceId: row.sourceId });
    // Newest run first, so a lookup takes the first run starting at or before
    // the year it asks about.
    ranges[seriesId] = runs.reverse();
  }
  return ranges;
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

export function projectInflationTarget(
  row: ServedInflationTargetRow,
): ClientInflationTargetRow {
  const { lastReviewedAt: _lastReviewedAt, ...rest } = row;
  return rest;
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

export type ClientGeneralGovernmentBalanceFact = Omit<
  ServedGeneralGovernmentBalanceFact,
  "sourceId" | "lastReviewedAt"
>;

/**
 * The deficit page's workbook cites its sources from the reviewed manifest,
 * not from the rows, so neither field has a browser reader.
 */
export function projectBalanceFact(
  fact: ServedGeneralGovernmentBalanceFact,
): ClientGeneralGovernmentBalanceFact {
  const { sourceId: _sourceId, lastReviewedAt: _lastReviewedAt, ...rest } = fact;
  return rest;
}
