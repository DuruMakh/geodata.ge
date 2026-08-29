// apps/web/lib/factQuery/caveats/engine.ts
import type { Caveat, DatasetId, Measure, Severity } from "../types";
import type { MunicipalTotalFact, ServedNationalGdpFact } from "../types";

/**
 * Everything a rule may inspect. Deliberately includes the raw quality state of
 * contributing inputs — NOT just the rows that will be displayed, and never
 * `showWarning` alone. Khulo 2024 carries warningType "source_actual_missing"
 * with showWarning false; a display-flag rule would miss it entirely.
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
