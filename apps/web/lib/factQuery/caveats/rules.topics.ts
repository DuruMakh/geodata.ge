// apps/web/lib/factQuery/caveats/rules.topics.ts
//
// The topic datasets' value-status and basis disclosures (query_indicators). Each fires only on an AVAILABLE topic
// cell: a topic observation is the only kind that carries `status`, and a missing cell carries no disclosure whatever
// codes the store holds for it (ruling R8). Affects is the precise entity:series:year cell.
import type { CaveatContext, CaveatRule } from "./engine";
import type { ServiceMessageKey } from "../localization";
import type { Severity } from "../types";

type Cell = CaveatContext["observations"][number];

const cells = (c: CaveatContext, test: (cell: Cell) => boolean) => c.observations.filter((o) => o.status !== undefined && o.value !== null && test(o));

function topicRule(code: string, severity: Severity, comparisonEffect: CaveatRule["comparisonEffect"], messageKey: ServiceMessageKey, test: (cell: Cell) => boolean): CaveatRule {
  return {
    code,
    severity,
    comparisonEffect,
    messageKey,
    methodologyRef: `ai-grounding-and-caveats.md#${code}`,
    methodologyRefEn: "/en/methodology",
    applies: (c) => cells(c, test).length > 0,
    affects: (c) => cells(c, test).map((o) => `${o.entityId}:${o.seriesId}:${o.year}`),
  };
}

export const TOPIC_CAVEAT_RULES: readonly CaveatRule[] = [
  topicRule("topic_survey_estimate", "note", "none", "caveats.topic_survey_estimate", (o) => o.status === "survey_estimate"),
  topicRule("topic_derived", "note", "none", "caveats.topic_derived", (o) => o.status === "derived"),
  topicRule("topic_partial_period", "severe", "limits", "caveats.topic_partial_period", (o) => o.status === "partial"),
  // planned_values' own wording, under a topic code: planned_values names series:year, which across several places
  // would mark every place's cell in that year planned.
  topicRule("topic_planned", "severe", "none", "caveats.planned_values", (o) => o.basis === "planned"),
  topicRule("topic_preliminary", "note", "limits", "caveats.topic_preliminary", (o) => o.basis === "preliminary"),
  // A projection is not an outcome: like debt_service_projection and deficit_projection, a change into it is not a change.
  topicRule("topic_projection", "severe", "breaks", "caveats.topic_projection", (o) => o.basis === "projection"),
];
