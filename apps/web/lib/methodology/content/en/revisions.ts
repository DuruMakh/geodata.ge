import type { MethodologyDatasetId } from "../../types";

// Translation review dates are independent of the original methodology review.
export const METHODOLOGY_TRANSLATION_REVIEWED_AT: Readonly<Record<MethodologyDatasetId, string>> = {
  expenditure: "2026-09-06",
  revenue: "2026-09-06",
  municipalities: "2026-09-06",
  debt: "2026-09-06",
  gdp: "2026-09-11",
  "economic-sectors": "2026-09-11",
};
