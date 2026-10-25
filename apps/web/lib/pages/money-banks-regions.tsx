import { MoneyBanksIndex } from "../../components/money-banks/money-banks-index";
import { toClientMoneyBanksFact } from "../data/moneyBanks/importMoneyBanks";
import type { MoneyBanksFact } from "../data/moneyBanks/types";
import { buildMoneyBanksRegionMapModel } from "../explorer/moneyBanksRegionMap";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import type { Locale } from "../i18n/types";
import { renderMoneyBanksRegionsFrame } from "./money-banks-regions-shared";

/** The Loans by region index: the map and list whose rows open the area pages. The map is built here; the page receives only Georgia's all loans. */
export function renderMoneyBanksRegionsPage(locale: Locale) {
  let map: RegionMapModel | undefined;
  const regionMap = (facts: MoneyBanksFact[]) => map ??= buildMoneyBanksRegionMapModel(facts.map(toClientMoneyBanksFact));
  return renderMoneyBanksRegionsFrame(locale, undefined, facts => { const model = regionMap(facts); return [model.firstYear, model.year]; }, ({ facts }) =>
    <MoneyBanksIndex facts={facts.filter(f => f.indicatorId === "loans_region.georgia.total").map(toClientMoneyBanksFact)} regionMap={regionMap(facts)} />);
}
