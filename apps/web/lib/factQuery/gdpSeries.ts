import type { GdpSeriesId } from "../data/gdpOverview/types";
import type { Unit } from "./types";
export const GDP_QUERY_SERIES: Record<
  GdpSeriesId,
  {
    labelKa: string;
    labelEn: string;
    unit: Unit;
    definitionKa: string;
    definitionEn: string;
  }
> = {
  real_usd_2015: {
    labelKa: "რეალური მშპ, 2015 წლის აშშ დოლარი",
    labelEn: "Real GDP, constant 2015 USD",
    unit: "USD_2015",
    definitionKa:
      "რეალური მთლიანი შიდა პროდუქტი 2015 წლის მუდმივი ფასებით, აშშ დოლარში; მსოფლიო ბანკის გამოქვეყნებული დონე.",
    definitionEn:
      "Real GDP in constant 2015 US dollars, published by the World Bank; a level, not an index or current-price amount.",
  },
  real_growth_percent: {
    labelKa: "მშპ-ის რეალური წლიური ზრდა",
    labelEn: "Annual real GDP growth",
    unit: "percent",
    definitionKa:
      "რეალური მშპ-ის წლიური ცვლილება პროცენტებში: 7.5 ნიშნავს 7.5%-ს; არ არის მშპ-ის წილი.",
    definitionEn:
      "Annual real GDP growth in percentage points: 7.5 means 7.5%, not a fraction or share of GDP.",
  },
  nominal_gel: {
    labelKa: "ნომინალური მშპ, ლარი",
    labelEn: "Nominal GDP, GEL",
    unit: "GEL",
    definitionKa:
      "ნომინალური მშპ მიმდინარე ფასებით, ლარში; საქსტატის გამოქვეყნებული მონაცემი.",
    definitionEn:
      "Nominal GDP at current prices in GEL, published by Geostat; not inflation-adjusted growth.",
  },
  nominal_usd: {
    labelKa: "ნომინალური მშპ, აშშ დოლარი",
    labelEn: "Nominal GDP, USD",
    unit: "USD",
    definitionKa:
      "ნომინალური მშპ მიმდინარე ფასებით, აშშ დოლარში; საქსტატის გამოქვეყნებული მონაცემი.",
    definitionEn:
      "Nominal GDP at current prices in USD, published by Geostat. Exchange-rate changes affect the USD series; it is not real growth.",
  },
  per_capita_gel: {
    labelKa: "ნომინალური მშპ ერთ სულ მოსახლეზე, ლარი",
    labelEn: "Nominal GDP per capita, GEL",
    unit: "GEL_per_person",
    definitionKa:
      "ნომინალური მშპ ერთ სულ მოსახლეზე მიმდინარე ფასებით, ლარში; არ არის საშუალო შემოსავალი.",
    definitionEn:
      "Nominal GDP per person at current prices in GEL, published by Geostat; economic output per person, not average income.",
  },
  per_capita_usd: {
    labelKa: "ნომინალური მშპ ერთ სულ მოსახლეზე, აშშ დოლარი",
    labelEn: "Nominal GDP per capita, USD",
    unit: "USD_per_person",
    definitionKa:
      "ნომინალური მშპ ერთ სულ მოსახლეზე მიმდინარე ფასებით, აშშ დოლარში; არ არის საშუალო შემოსავალი.",
    definitionEn:
      "Nominal GDP per person at current prices in USD, published by Geostat; economic output per person, not average income.",
  },
};
