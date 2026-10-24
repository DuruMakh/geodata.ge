import type { ClientEnergyFoodFact } from "../data/energyFood/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { ENERGY_FOOD_SECTIONS, energyFoodCoverage, energyFoodSeries } from "./energyFood";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";

export function buildEnergyFoodHubCards(facts: readonly ClientEnergyFoodFact[], presentation: Presentation): HubCardModel[] {
  return ENERGY_FOOD_SECTIONS.map((section, index) => {
    // Each card's sparkline is the page's reference series, and its years are those of the reference's group.
    const reference = energyFoodSeries(section.id).find(s => s.reference)!.id;
    const { years } = energyFoodCoverage(section.id, facts, [reference]);
    const headline = facts.filter(f => f.indicatorId === reference).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const { unit } = last;
    const value = `${formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals })}${unit === "percent" ? "%" : ` ${message(presentation.messages, `energyFood.unit.${unit}`)}`}`;
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: message(presentation.messages, `energyFood.page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: headline.map(f => f.value), seriesColor: INK,
      footer: `${last.year} · ${value} · ${years[0]}–${years.at(-1)}`,
      latest: { value, period: String(last.year) }, years: coverageRange(years[0], years.at(-1)!),
    };
  });
}
