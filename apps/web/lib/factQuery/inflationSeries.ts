// apps/web/lib/factQuery/inflationSeries.ts
//
// The inflation dataset's fixed vocabulary: the series beside the COICOP groups,
// the measures each publishes, units and definitions. COICOP group labels are
// not here: they are Geostat's wording, read from the site's inflation message
// catalogue by buildSnapshot, so the page and an MCP answer name a group alike.
import { CPI_SERIES_MEASURES } from "../data/inflation/types";
import type { Unit } from "./types";

export const INFLATION_DATASET_ID = "inflation" as const;
export const INFLATION_ENTITY_ID = "country.georgia";
export const TARGET_SERIES_ID = "cpi.target";
export const RESIDUAL_SERIES_ID = "cpi.contribution_residual";

export const INFLATION_MEASURES = ["yoy_pct", "mom_pct", "avg12_pct", "index_2010", "target_pct", "basket_weight_pct", "contribution_pp"] as const;
export type InflationMeasure = (typeof INFLATION_MEASURES)[number];

export const INFLATION_MEASURE_UNITS: Record<InflationMeasure, Unit> = {
  yoy_pct: "percent",
  mom_pct: "percent",
  avg12_pct: "percent",
  index_2010: "index_2010_100",
  target_pct: "percent",
  basket_weight_pct: "percent",
  contribution_pp: "percentage_points",
};

type SeriesVocabulary = { labelKa: string; labelEn: string; measures: readonly string[] };

/** Measures as Geostat publishes them: core has neither an index level nor a 12-month average. */
export const NATIONAL_SERIES: Record<"cpi.headline" | "cpi.core" | "cpi.core_ex_tobacco", SeriesVocabulary> = {
  "cpi.headline": { labelKa: "საერთო ინფლაცია", labelEn: "Headline inflation", measures: CPI_SERIES_MEASURES["cpi.headline"] },
  "cpi.core": { labelKa: "საბაზო ინფლაცია", labelEn: "Core inflation", measures: CPI_SERIES_MEASURES["cpi.core"] },
  "cpi.core_ex_tobacco": { labelKa: "საბაზო, თამბაქოს გარეშე", labelEn: "Core excluding tobacco", measures: CPI_SERIES_MEASURES["cpi.core_ex_tobacco"] },
};

export const TARGET_SERIES: SeriesVocabulary = { labelKa: "მიზნობრივი მაჩვენებელი", labelEn: "Inflation target", measures: ["target_pct"] };
export const RESIDUAL_SERIES: SeriesVocabulary = { labelKa: "დანარჩენი", labelEn: "Residual", measures: ["contribution_pp"] };
export const GROUP_MEASURES: readonly InflationMeasure[] = ["yoy_pct", "mom_pct", "basket_weight_pct", "contribution_pp"];

export type InflationGroup = {
  id: string;
  coicopCode: string;
  level: "division" | "subgroup";
  parentId: string | null;
  labelKa: string;
  labelEn: string;
};

export type InflationCityEntity = { id: string; labelKa: string; labelEn: string };

/** What Geostat publishes per city (spec 2026-09-26 §1.1): no index, core, weights or contributions. */
export const CITY_SERIES_MEASURES: Readonly<Record<string, readonly InflationMeasure[]>> = Object.fromEntries([
  ["cpi.headline", ["yoy_pct", "mom_pct", "avg12_pct"]],
  ...Array.from({ length: 12 }, (_, index) => [`cpi.cat.${String(index + 1).padStart(2, "0")}`, ["yoy_pct", "mom_pct"]]),
]);

export const INFLATION_DEFINITIONS: Record<InflationMeasure | "residual", { ka: string; en: string }> = {
  yoy_pct: {
    ka: "სამომხმარებლო ფასების ცვლილება წინა წლის იმავე თვესთან, პროცენტებში, როგორც საქსტატი აქვეყნებს: 2.4 ნიშნავს 2.4%-ს.",
    en: "Change in consumer prices against the same month a year earlier, in percent as Geostat publishes it: 2.4 means 2.4%.",
  },
  mom_pct: {
    ka: "ფასების ცვლილება წინა თვესთან, პროცენტებში, როგორც საქსტატი აქვეყნებს. თვიური ცვლილებების ჯამი წლიური ცვლილების ტოლი არ არის.",
    en: "Change against the previous month, in percent as Geostat publishes it. Monthly changes do not add up to the annual change.",
  },
  avg12_pct: {
    ka: "12-თვიური საშუალო ინფლაცია, როგორც საქსტატი აქვეყნებს; ეს წლიური (წინა წლის იმავე თვესთან) ინფლაცია არ არის.",
    en: "Twelve-month average inflation as Geostat publishes it; not the annual (year-on-year) rate.",
  },
  index_2010: {
    ka: "სამომხმარებლო ფასების ინდექსის დონე, 2010 = 100, როგორც საქსტატი აქვეყნებს; ეს არის ინდექსის დონე, არა პროცენტი.",
    en: "Consumer price index level, 2010 = 100, as Geostat publishes it; a level, not a percentage.",
  },
  target_pct: {
    ka: "საქართველოს ეროვნული ბანკის ამ თვეში მოქმედი ინფლაციის მიზნობრივი მაჩვენებელი, პროცენტებში; ეს არის ორიენტირი, არა პროგნოზი ან შედეგი.",
    en: "The National Bank of Georgia's inflation target in force that month, in percent; a reference, not a forecast or an outcome.",
  },
  basket_weight_pct: {
    ka: "ჯგუფის წილი სამომხმარებლო კალათაში ამ წელს, პროცენტებში, როგორც საქსტატი აქვეყნებს; განყოფილებების წილების ჯამი 100-ის ტოლია.",
    en: "The group's share of the consumer basket in that year, in percent, as Geostat publishes it; divisions sum to 100.",
  },
  contribution_pp: {
    ka: "Fiscal.ge-ის გაანგარიშება: კალათის წილი / 100 × ჯგუფის წლიური ცვლილება, პროცენტულ პუნქტებში. მიახლოებითია და საქსტატის მაჩვენებელი არ არის.",
    en: "Fiscal.ge's calculation: basket weight / 100 × the group's year-on-year change, in percentage points. An approximation, not a Geostat figure.",
  },
  residual: {
    ka: "გამოქვეყნებული საერთო წლიური ინფლაცია გამოკლებული მოთხოვნილი ჯგუფების წვლილი, პროცენტულ პუნქტებში: ყველაფერი, რაც არ მოითხოვეთ, და მიახლოების ცდომილება.",
    en: "Published headline year-on-year inflation minus the requested groups' contributions, in percentage points: everything not requested plus approximation error.",
  },
};
