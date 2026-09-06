// apps/web/lib/factQuery/caveats/rules.deficit.ts
//
// Two rules, both gated on datasetId, both severe.
//
// deficit_projection is a SEPARATE code from debt_service_projection rather
// than one shared "this is a projection" rule, because the reason differs and
// the reason is what a reader needs: a debt-service projection is a schedule
// of obligations already incurred, while this is a forecast of an economy. One
// message cannot say both truthfully.
import type { CaveatRule } from "./engine";

const DATASET_ID = "general-government-balance";

export const DEFICIT_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "deficit_general_government_scope",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.deficit_general_government_scope",
    methodologyRef: "ai-grounding-and-caveats.md#deficit_general_government_scope",
    methodologyRefEn: "/en/explorer/deficit",
    // Unconditional within the dataset, and for the same reason as
    // debt_not_budget_scope: the error is available the moment this number sits
    // beside budget figures, whatever year was asked for.
    applies: (c) => c.datasetId === DATASET_ID,
    affects: (c) => c.seriesIds,
  },
  {
    code: "deficit_projection",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKey: "caveats.deficit_projection",
    methodologyRef: "ai-grounding-and-caveats.md#deficit_projection",
    methodologyRefEn: "/en/explorer/deficit",
    applies: (c) => c.datasetId === DATASET_ID && c.observations.some((o) => o.basis === "projection"),
    affects: (c) => c.observations.filter((o) => o.basis === "projection").map((o) => `${o.seriesId}:${o.year}`),
  },
];
