// apps/web/lib/factQuery/caveats/engine.ts
import type { Basis, Caveat, DatasetId, FactQuerySnapshot, Measure, Severity } from "../types";
import { serviceMessage, type ServiceMessageKey } from "../localization";
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
  /**
   * `level` and `parentSeriesId` mirror the Observation fields of the same names
   * (observations.ts), so a rule can tell a program cell from a category cell and from
   * the calculated total. Without `level`, program_coverage_partial's "the requested
   * PROGRAM series does not cover every requested year" fired on any null cell in the
   * ministries dataset, including an admin_category year the category did not exist in.
   */
  observations: {
    entityId: string;
    seriesId: string;
    level: string;
    parentSeriesId: string | null;
    year: number;
    /** Monthly observations only (inflation), YYYY-MM. */
    period?: string;
    value: number | null;
    basis: Basis | null;
    /** Mirrors Observation.valueDefinitionId, so a rule can detect a real definition break between two years without reading display prose. */
    valueDefinitionId: string;
  }[];
  municipalTotalInputs: MunicipalTotalFact[];
  /**
   * `${municipalityCode}:${year}` -> the entityIds in THIS response whose
   * returned figure includes that contributing row.
   *
   * A municipality row reaches the response either as itself or folded inside a
   * region or the country aggregate. Without this map a rule could only name the
   * member code, which at aggregate grain names something the response does not
   * contain: a region query emitted a caveat with 548 affects entries matching
   * zero observations, so the disclosure was simultaneously over-stated in
   * meta.caveats and absent from every row.
   */
  municipalInputServedBy: Record<string, string[]>;
  gdpInputs: ServedNationalGdpFact[];
  /**
   * Set only when the request is a comparison. Carries the two years and
   * nothing else: a rule that needs to know whether the definition changed
   * reads `observations[].valueDefinitionId`, which is the structured identity,
   * rather than being handed display strings the caller pre-compared.
   */
  comparison: { fromYear: number; toYear: number } | null;
  /**
   * `${seriesId}:${year}` cells served through an approved succession or legacy join.
   * Per cell, not per series: a joined series still serves most of its years from its
   * own official code, and program_historical_join must not claim a join on those.
   */
  historicalJoinSeriesYears: string[];
  /**
   * `${categoryId}:${year}` administrative categories actually served in the requested
   * years, pre-scoped like every other array here. Empty outside the ministries dataset.
   * Categories are not all coeval — thirteen run 2004-2025 and
   * admin_spending.regional_development_infrastructure only starts in 2009 — so a
   * program's modern parent can name a category that had no row in the program's year.
   */
  adminCategoryYears: string[];
};

/**
 * What this caveat means for a two-year comparison. Required on every rule so
 * the decision is made once, by whoever knows the data, instead of being
 * inferred later from severity or from a hand-kept list in compare.ts.
 *
 * "breaks"  - the endpoints do not measure the same thing. A comparison whose
 *             endpoints disagree on this caveat is not_comparable.
 * "limits"  - still comparable, but the reader must be told (a GDP accounting
 *             change, an approved program-history join).
 * "none"    - a quality, provenance or presentation disclosure. It rides along
 *             on the row and never suppresses a growth figure.
 *
 * The distinction is load-bearing in BOTH directions. Marking a quality flag
 * as "breaks" declined an ordinary Tbilisi 2019->2023 payment comparison;
 * leaving a coverage change as "none" published revenue.grants 2005->2020 as
 * "+651.19%, comparable" straight across the documented 2008 netting change.
 */
export type ComparisonEffect = "breaks" | "limits" | "none";

export type CaveatRule = {
  code: string;
  severity: Severity;
  /**
   * Severity is about how badly a reader is misled; comparisonEffect is about
   * whether the years are like-for-like. They are independent: gdp_sna_break_2010
   * is a "note" that still limits a comparison, and municipal_source_actual_missing
   * is "severe" but does not stop one.
   */
  comparisonEffect: ComparisonEffect;
  messageKey: ServiceMessageKey;
  methodologyRef: string;
  methodologyRefEn: string;
  /**
   * `context` is pre-scoped to the answered request; `snapshot` is the whole
   * dataset and must only be used for metadata that is not request-scoped —
   * for example which years a publisher still calls preliminary, which a
   * response containing only World Bank cells cannot show.
   */
  applies: (context: CaveatContext, snapshot: FactQuerySnapshot) => boolean;
  affects: (context: CaveatContext, snapshot: FactQuerySnapshot) => string[];
};

const SEVERITY_ORDER: Record<Severity, number> = { severe: 0, note: 1 };

export function evaluateCaveats(snapshot: FactQuerySnapshot, context: CaveatContext, rules: readonly CaveatRule[]): Caveat[] {
  const emitted = new Map<string, Caveat>();

  for (const rule of rules) {
    if (emitted.has(rule.code)) continue;
    if (!rule.applies(context, snapshot)) continue;
    emitted.set(rule.code, {
      code: rule.code,
      severity: rule.severity,
      messageKa: serviceMessage(snapshot, "ka", rule.messageKey),
      messageEn: serviceMessage(snapshot, "en", rule.messageKey),
      methodologyRef: rule.methodologyRef,
      methodologyRefEn: rule.methodologyRefEn,
      affects: rule.affects(context, snapshot),
    });
  }

  return Array.from(emitted.values()).sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}
