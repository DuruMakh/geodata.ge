import type { ClientEnergyFoodFact, EnergyFoodIndicator } from "../data/energyFood/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { ENERGY_FOOD_SECTIONS, energyFoodCoverage, energyFoodUnit, type EnergyFoodSectionId } from "./energyFood";
import { formatInUnit } from "./format";
import type { HubCardModel } from "./hubCards";

/** Each card's sparkline: the page's reference series. */
const HEADLINE: Record<EnergyFoodSectionId, EnergyFoodIndicator> = {
  "energy-supply": "energy.supply.total", electricity: "electricity.production.total", "energy-use": "energy.final.total", "food-self-sufficiency": "food.self_sufficiency.wheat",
};

export function buildEnergyFoodHubCards(facts: readonly ClientEnergyFoodFact[], presentation: Presentation): HubCardModel[] {
  return ENERGY_FOOD_SECTIONS.map((section, index) => {
    const { years } = energyFoodCoverage(section.id, facts);
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const value = `${formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals })}${energyFoodUnit(section.id) === "percent" ? "%" : ""}`;
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: message(presentation.messages, `energyFood.page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: headline.map(f => f.value), seriesColor: INK,
      footer: `${last.year} · ${value} · ${years[0]}–${years.at(-1)}`,
    };
  });
}
