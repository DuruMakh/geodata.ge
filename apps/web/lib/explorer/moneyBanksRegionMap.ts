import { MONEY_BANKS_LOAN_AREAS, loansRegionIndicator, type ClientMoneyBanksFact } from "../data/moneyBanks/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { moneyBanksMapId } from "./moneyBanksAreas";
import { buildLatestValueRegionMapModel, latestCompleteRegionYear, type RegionMapModel } from "./regionalEconomyMap";

/**
 * The map of Loans by region: each region's loans outstanding in the latest year all eleven regions have, as published,
 * ranked from the highest. Regions are keyed by the map's `region.<id>` ids.
 */
export function buildMoneyBanksRegionMapModel(facts: readonly ClientMoneyBanksFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(MONEY_BANKS_LOAN_AREAS.filter(area => area !== "georgia").map(area => [loansRegionIndicator(area, "total"), moneyBanksMapId(area)]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, ...latestCompleteRegionYear(facts, regionOf, "No year has loans for every region"), measure: "loans" });
}
