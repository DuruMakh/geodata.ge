// apps/web/lib/factQuery/caveats/engine.ts
import type { Caveat, DatasetId, Measure, Severity } from "../types";
import type { MunicipalTotalFact, ServedNationalGdpFact } from "../types";

/**
 * Everything a rule may inspect. Deliberately includes the raw quality state of
 * contributing inputs — NOT just the rows that will be displayed, and never
 * `showWarning` alone. Khulo 2024 carries warningType "source_actual_missing"
 * with showWarning false; a display-flag rule would miss it entirely.
 */
/**
 * SCOPING CONTRACT — read before writing a rule.
 *
 * Every array here is PRE-SCOPED to the request the query function actually
 * answered. `observations` holds only the rows being returned; `gdpInputs`
 * only the denominators actually used; `municipalTotalInputs` only the total
 * rows that actually contributed. They are never the full snapshot.
 *
 * This is what lets a rule stay simple and still be precise. `gdp_sna_break_2010`
 * can ask "do the supplied denominators span more than one accounting standard?"
 * and be correct, because a single-year 2010 query supplies exactly one row. A
 * rule written against the unfiltered snapshot would fire on every query.
 *
 * Callers must honour this. A query function that passes unfiltered rows will
 * make rules over-fire, and no type error will catch it.
 */
export type CaveatContext = {
  datasetId: DatasetId;
  measure: Measure;
  years: number[];
  seriesIds: string[];
  entityIds: string[];
  observations: { entityId: string; seriesId: string; year: number; value: number | null; basis: "actual" | "planned" | null }[];
  municipalTotalInputs: MunicipalTotalFact[];
  gdpInputs: ServedNationalGdpFact[];
  comparison: { fromYear: number; toYear: number; fromDefinition: string; toDefinition: string } | null;
  /** Series carrying an approved succession or legacy join. Only these get program_historical_join. */
  historicalJoinSeriesIds: string[];
};

export type CaveatRule = {
  code: string;
  severity: Severity;
  messageKa: string;
  messageEn: string;
  methodologyRef: string;
  applies: (context: CaveatContext) => boolean;
  affects: (context: CaveatContext) => string[];
};

const SEVERITY_ORDER: Record<Severity, number> = { severe: 0, note: 1 };

export function evaluateCaveats(context: CaveatContext, rules: readonly CaveatRule[]): Caveat[] {
  const emitted = new Map<string, Caveat>();

  for (const rule of rules) {
    if (emitted.has(rule.code)) continue;
    if (!rule.applies(context)) continue;
    emitted.set(rule.code, {
      code: rule.code,
      severity: rule.severity,
      messageKa: rule.messageKa,
      messageEn: rule.messageEn,
      methodologyRef: rule.methodologyRef,
      affects: rule.affects(context),
    });
  }

  return Array.from(emitted.values()).sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}
