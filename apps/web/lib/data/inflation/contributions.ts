import { periodFromKey, periodKey, periodYear } from "./periods";
import type { CategoryFactInput, ServedBasketWeightRow } from "./types";

// A category's share of the headline: its published price change, weighted by its
// share of the basket. Never stored — derived at build time from two published
// series, as `% of GDP` is in lib/explorer/debtExplorer.ts (spec §4.6).

/**
 * Weights begin in 2012, but that first column reconstructs the headline an order
 * of magnitude worse than every later year (0.82 pp mean against ≤0.13 pp), so
 * contributions begin the year after. 2012 weights still ship as panel context.
 */
export const CONTRIBUTION_FIRST_YEAR = 2013;

/** Monitoring tripwires against a future Geostat change, not accuracy claims. */
export const MAX_RECONSTRUCTION_ERROR_PP = 1.0;
export const MAX_MEAN_RECONSTRUCTION_ERROR_PP = 0.2;

export function contributionFor(changePct: number, weightPct: number): number {
  return (weightPct / 100) * changePct;
}

export function buildContributionIndex(
  facts: CategoryFactInput[],
  weights: ServedBasketWeightRow[],
): Map<string, Map<number, number>> {
  const weightByKey = new Map(weights.map((row) => [`${row.categoryId}:${row.year}`, row.weightPct]));
  const index = new Map<string, Map<number, number>>();
  for (const fact of facts) {
    if (fact.measure !== "yoy_pct") continue;
    const period = periodFromKey(fact.period);
    const year = periodYear(period);
    if (year < CONTRIBUTION_FIRST_YEAR) continue;
    const weightPct = weightByKey.get(`${fact.categoryId}:${year}`);
    if (weightPct === undefined) continue;
    if (!index.has(fact.categoryId)) index.set(fact.categoryId, new Map());
    index.get(fact.categoryId)!.set(period, contributionFor(fact.value, weightPct));
  }
  return index;
}

export type ReconstructionErrors = { months: number; maxPp: number; meanPp: number; worstPeriod: string | null };

/** How far the summed parts fall from the published whole, month by month. */
export function reconstructionErrors(
  contributions: Map<string, Map<number, number>>,
  headline: Map<number, number>,
): ReconstructionErrors {
  const sums = new Map<number, number>();
  for (const byPeriod of contributions.values()) {
    for (const [period, value] of byPeriod) sums.set(period, (sums.get(period) ?? 0) + value);
  }
  let maxPp = 0;
  let total = 0;
  let months = 0;
  let worstPeriod: string | null = null;
  for (const [period, sum] of sums) {
    const published = headline.get(period);
    if (published === undefined) continue;
    const error = Math.abs(published - sum);
    months += 1;
    total += error;
    if (error > maxPp) {
      maxPp = error;
      worstPeriod = periodKey(period);
    }
  }
  return { months, maxPp, meanPp: months === 0 ? 0 : total / months, worstPeriod };
}

export function assertReconstruction(errors: ReconstructionErrors): void {
  if (errors.maxPp > MAX_RECONSTRUCTION_ERROR_PP) {
    throw new Error(
      `Category contributions miss the published headline by ${errors.maxPp.toFixed(3)} pp at ${errors.worstPeriod} (limit ${MAX_RECONSTRUCTION_ERROR_PP})`,
    );
  }
  if (errors.meanPp > MAX_MEAN_RECONSTRUCTION_ERROR_PP) {
    throw new Error(
      `Category contributions miss the published headline by ${errors.meanPp.toFixed(3)} pp on average (limit ${MAX_MEAN_RECONSTRUCTION_ERROR_PP})`,
    );
  }
}
