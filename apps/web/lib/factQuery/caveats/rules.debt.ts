// apps/web/lib/factQuery/caveats/rules.debt.ts
//
// Every rule here is gated on datasetId. Unlike the national and municipal
// files, two of these fire unconditionally for their dataset, so an ungated
// `applies: () => true` would attach a debt caveat to every municipal answer.
import type { CaveatRule } from "./engine";

const DATASET_ID = "government-debt";

export const DEBT_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "debt_not_budget_scope",
    severity: "severe",
    comparisonEffect: "none",
    messageKey: "caveats.debt_not_budget_scope",
    methodologyRef: "ai-grounding-and-caveats.md#debt_not_budget_scope",
    methodologyRefEn: "/en/methodology/debt",
    // Unconditional within the dataset. The error it prevents does not depend
    // on which series or year was asked for - it depends on debt being in the
    // answer at all, beside budget figures the client may already hold.
    applies: (c) => c.datasetId === DATASET_ID,
    affects: (c) => c.seriesIds,
  },
  {
    code: "debt_service_projection",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKey: "caveats.debt_service_projection",
    methodologyRef: "ai-grounding-and-caveats.md#debt_service_projection",
    methodologyRefEn: "/en/methodology/debt",
    applies: (c) => c.datasetId === DATASET_ID && c.observations.some((o) => o.basis === "projection"),
    affects: (c) => c.observations.filter((o) => o.basis === "projection").map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "debt_rate_not_published",
    severity: "note",
    comparisonEffect: "limits",
    messageKey: "caveats.debt_rate_not_published",
    methodologyRef: "ai-grounding-and-caveats.md#debt_rate_not_published",
    methodologyRefEn: "/en/methodology/debt",
    applies: (c) =>
      c.datasetId === DATASET_ID && c.measure === "rate_percent" && c.observations.some((o) => o.value === null),
    affects: (c) => c.observations.filter((o) => o.value === null).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "debt_gdp_share_vintage",
    severity: "note",
    comparisonEffect: "none",
    // The debt package's own validation report records
    // possible_gdp_vintage_difference against the Ministry's published share.
    // A note, not a severe: the number is right for the denominator used, and
    // this names the denominator so the two can be told apart.
    messageKey: "caveats.debt_gdp_share_vintage",
    methodologyRef: "ai-grounding-and-caveats.md#debt_gdp_share_vintage",
    methodologyRefEn: "/en/methodology/debt",
    applies: (c) => c.datasetId === DATASET_ID && c.measure === "share_of_gdp_pct",
    affects: (c) => c.seriesIds,
  },
];
