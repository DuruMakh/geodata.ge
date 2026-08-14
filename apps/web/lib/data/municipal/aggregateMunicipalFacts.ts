import type { MunicipalFunctionFact, MunicipalTotalFact } from "./types";

// Sentinels for a group field that disagrees across the municipalities being
// rolled up. Real ids/measures never contain a colon (source ids are
// "source.snake_case", measures are bare "snake_case" — checked against the
// full served 2015-2025 dataset), so a "mixed:" prefix cannot collide with a
// real value and cannot be mistaken for one downstream.
export const MIXED_SOURCE_ID = "mixed:source_id";
export const MIXED_PUBLIC_TOTAL_MEASURE = "mixed:public_total_measure";

/**
 * Sum two nullable component fields. A missing constituent makes the whole
 * group null rather than being silently counted as zero.
 */
function sumNullable(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

/**
 * Carry a string field through only when every constituent agrees; otherwise
 * collapse to `mixedMarker` so no single constituent's value can be mistaken
 * for the group's. Idempotent across a fold: once a group is marked mixed,
 * `current` is the marker itself, which never equals a real incoming value,
 * so it stays mixed.
 */
function agreeOrMixed(current: string, incoming: string, mixedMarker: string): string {
  return current === incoming ? current : mixedMarker;
}

/**
 * Collapse many municipalities' facts into one entity's, for a region roll-up.
 * Called on the SERVER so a region page ships ~110 function rows like a
 * municipality page does, rather than up to twelve times that.
 *
 * What an aggregated row carries, and how, so a later caller never reaches
 * for a field by reflex and gets one arbitrary constituent's value back:
 * - `amountGel`, `publicTotalGel`, `functionalSumGel`: summed. The two
 *   totals are summed independently — never reconcile one against the other.
 * - `totalPaymentsGel`, `expensesGel`, `nonfinancialAssetGrowthGel`,
 *   `financialAssetGrowthGel`, `liabilityDecreaseGel`, and
 *   `reconciliationDifferenceGel`: summed only when every constituent has a
 *   value; if any constituent is null (e.g. a municipality on the
 *   functional-total fallback measure, which has no payment breakdown), the
 *   group's value is null rather than a sum that treats the gap as zero.
 * - `publicTotalMeasure` and `sourceId` (on both fact types): carried
 *   through only when every constituent agrees; otherwise replaced with a
 *   `mixed:` marker (`MIXED_PUBLIC_TOTAL_MEASURE` / `MIXED_SOURCE_ID`) so a
 *   caller can never read one arbitrary constituent's value as the group's.
 *   `sourceMetadataFor` does not recognise the marker and falls back to
 *   blank source fields — blank, not silently wrong.
 * - `functionalCode` and `basis` on function facts are carried from
 *   whichever row lands first: safe, because `functionalCode` is a 1:1
 *   property of `categoryId` (part of the group key) and `basis` is always
 *   the literal "actual" — neither can vary within a group.
 * - `showWarning` / `warningType` / `warningAmountGel` are internal
 *   municipality-grain reconciliation state, so every roll-up resets them.
 */
export function aggregateFactsForEntity(
  entityId: string,
  functionFacts: MunicipalFunctionFact[],
  totalFacts: MunicipalTotalFact[],
): { functionFacts: MunicipalFunctionFact[]; totalFacts: MunicipalTotalFact[] } {
  const functionByKey = new Map<string, MunicipalFunctionFact>();
  for (const row of functionFacts) {
    const key = `${row.year}|${row.categoryId}`;
    const existing = functionByKey.get(key);
    if (existing) {
      existing.amountGel += row.amountGel;
      existing.sourceId = agreeOrMixed(existing.sourceId, row.sourceId, MIXED_SOURCE_ID);
      continue;
    }
    functionByKey.set(key, { ...row, municipalityCode: entityId });
  }

  const totalByYear = new Map<number, MunicipalTotalFact>();
  for (const row of totalFacts) {
    const existing = totalByYear.get(row.year);
    if (existing) {
      existing.publicTotalGel += row.publicTotalGel;
      existing.functionalSumGel += row.functionalSumGel;
      existing.totalPaymentsGel = sumNullable(existing.totalPaymentsGel, row.totalPaymentsGel);
      existing.expensesGel = sumNullable(existing.expensesGel, row.expensesGel);
      existing.nonfinancialAssetGrowthGel = sumNullable(existing.nonfinancialAssetGrowthGel, row.nonfinancialAssetGrowthGel);
      existing.financialAssetGrowthGel = sumNullable(existing.financialAssetGrowthGel, row.financialAssetGrowthGel);
      existing.liabilityDecreaseGel = sumNullable(existing.liabilityDecreaseGel, row.liabilityDecreaseGel);
      existing.reconciliationDifferenceGel = sumNullable(existing.reconciliationDifferenceGel, row.reconciliationDifferenceGel);
      existing.publicTotalMeasure = agreeOrMixed(existing.publicTotalMeasure, row.publicTotalMeasure, MIXED_PUBLIC_TOTAL_MEASURE);
      existing.sourceId = agreeOrMixed(existing.sourceId, row.sourceId, MIXED_SOURCE_ID);
      // Municipality-grain reconciliation state is not attributable to an
      // aggregate row, so it stays reset during the roll-up.
      continue;
    }
    totalByYear.set(row.year, {
      ...row,
      municipalityCode: entityId,
      showWarning: false,
      warningType: "none",
      warningAmountGel: null,
    });
  }

  return {
    functionFacts: Array.from(functionByKey.values()),
    totalFacts: Array.from(totalByYear.values()),
  };
}
