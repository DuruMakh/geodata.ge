import { EXPENDITURE_TYPES_TOTAL } from "../data/expenditureTypes/types";
import type { SectorPageConfig } from "./economicSectors";

/** Spending by type on the sectors explorer (spec 2026-10-21 §4). */
export const EXPENDITURE_TYPES_PAGE_CONFIG: SectorPageConfig = {
  scope: "expenditureTypes",
  fileStem: "expenditure-types",
  // Approved departure from "only the total on arrival": the total alone says nothing about the split.
  // "Other costs" (a mixed bag) and the tiny grants are listed but not ticked.
  defaultSelectedIds: [EXPENDITURE_TYPES_TOTAL, "spending_type.social_benefits", "spending_type.investment", "spending_type.compensation", "spending_type.subsidies", "spending_type.goods_services", "spending_type.interest"],
  measureStandIns: {},
  shareHeadlineId: EXPENDITURE_TYPES_TOTAL,
  ranked: false,
  listEveryRow: true,
  highlights: false,
  // The Ministry publishes no price-adjusted figures.
  measures: ["nominal", "share_of_gdp"],
  totalId: EXPENDITURE_TYPES_TOTAL,
};
