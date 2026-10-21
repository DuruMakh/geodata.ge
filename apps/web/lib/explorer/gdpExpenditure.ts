import type { SectorPageConfig } from "./economicSectors";

/** GDP by expenditure on the sectors explorer (spec 2026-10-20 §3). */
export const GDP_EXPENDITURE_PAGE_CONFIG: SectorPageConfig = {
  scope: "gdpExpenditure",
  fileStem: "gdp-expenditure",
  // Approved departure from "only the total on arrival": GDP alone is one line and shows no split.
  defaultSelectedIds: ["economy.gdp_total", "gdp_use.households", "gdp_use.government", "gdp_use.investment", "gdp_use.exports", "gdp_use.imports"],
  // Geostat publishes households' and non-profits' real growth only together.
  measureStandIns: {
    "gdp_use.households": "gdp_use.households_npish",
    "gdp_use.npish": "gdp_use.households_npish",
    "gdp_use.households_npish": "gdp_use.households",
  },
  shareHeadlineId: "gdp_use.households",
  ranked: false,
  // Households and non-profits apart have no growth; together they have nothing else; inventories have no growth.
  listEveryRow: false,
  highlights: false,
};
