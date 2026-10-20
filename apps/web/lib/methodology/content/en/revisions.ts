import type { MethodologyDatasetId } from "../../types";

// Translation review dates are independent of the original methodology review.
export const METHODOLOGY_TRANSLATION_REVIEWED_AT: Readonly<Record<MethodologyDatasetId, string>> = {
  trade: "2026-10-08",
  expenditure: "2026-09-06",
  revenue: "2026-09-06",
  municipalities: "2026-09-06",
  debt: "2026-09-06",
  gdp: "2026-09-11",
  "economic-sectors": "2026-09-11",
  "regional-economies": "2026-09-13",
  inflation: "2026-09-11",
  unemployment: "2026-10-04",
  "external-flows": "2026-10-15",
  demography: "2026-10-04",
  wages: "2026-10-10",
  poverty: "2026-10-10",
  "household-income": "2026-10-11",
  health: "2026-10-15",
  education: "2026-10-16",
  "science-culture": "2026-10-20",
  crime: "2026-10-16",
  "energy-food": "2026-10-11",
  environment: "2026-10-20",
  money: "2026-10-11",
  business: "2026-10-15",
  housing: "2026-10-16",
};
