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
    messageKa:
      "ეს არის ზოგადი მთავრობის ბალანსი საერთაშორისო სავალუტო ფონდის გაზომვით — და არა აქ მოწოდებული შემოსულობებისა და ხარჯების სხვაობა. ეს ორი ერთმანეთს არ უტოლდება.",
    messageEn:
      "This is the general government balance as measured by the IMF - not the difference between the receipts and expenditure served here. The two are not the same quantity.",
    methodologyRef: "ai-grounding-and-caveats.md#deficit_general_government_scope",
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
    messageKa:
      "მომავალი წლების მაჩვენებელი საერთაშორისო სავალუტო ფონდის პროგნოზია და არა დაფიქსირებული შედეგი.",
    messageEn: "Future-year values are an IMF forecast, not a recorded outcome.",
    methodologyRef: "ai-grounding-and-caveats.md#deficit_projection",
    applies: (c) => c.datasetId === DATASET_ID && c.observations.some((o) => o.basis === "projection"),
    affects: (c) => c.observations.filter((o) => o.basis === "projection").map((o) => `${o.seriesId}:${o.year}`),
  },
];
