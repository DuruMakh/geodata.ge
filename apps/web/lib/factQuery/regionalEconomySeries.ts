import type { RegionalEconomyMeasure } from "../data/regionalEconomies/types";

export const REGIONAL_ECONOMY_QUERY_MEASURES = {
  amount_gel: "nominal",
  share_of_region_gdp_pct: "share_of_region_gdp",
} as const satisfies Record<string, RegionalEconomyMeasure>;

export const REGIONAL_ECONOMY_DEFINITIONS = {
  nominal: {
    ka: "ეკონომიკური საქმიანობის მთლიანი დამატებული ღირებულება საბაზისო ფასებში, მიმდინარე ლარში.",
    en: "Economic-activity gross value added at basic prices in current GEL.",
    totalKa: "რეგიონის მთლიანი შიდა პროდუქტი საბაზრო ფასებში, მიმდინარე ლარში.",
    totalEn: "Total regional GDP at market prices in current GEL.",
  },
  share_of_region_gdp: {
    ka: "საქმიანობის დამატებული ღირებულება / იმავე რეგიონის იმავე წლის სრული მშპ საბაზრო ფასებში × 100. შერჩეული საქმიანობები მნიშვნელს არ ცვლის.",
    en: "Activity GVA / the same region and year's complete market-price GDP × 100. Selected activities never change the denominator.",
    totalKa: "რეგიონის მთლიანი მშპ / იმავე რეგიონის იმავე წლის მთლიანი მშპ × 100 = 100%.",
    totalEn: "Total regional GDP / the same region and year's total regional GDP × 100 = 100%.",
  },
} as const;
