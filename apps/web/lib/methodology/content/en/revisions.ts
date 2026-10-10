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
  demography: "2026-10-04",
  wages: "2026-10-10",
};
