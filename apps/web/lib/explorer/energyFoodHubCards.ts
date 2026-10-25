import type { ClientEnergyFoodFact } from "../data/energyFood/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { ENERGY_FOOD_SECTIONS, energyFoodCoverage, energyFoodSeries, type EnergyFoodSectionId } from "./energyFood";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";

/** The cards whose title does not say what the figure measures: they state their page line's measure as the caption. */
const CAPTIONED: ReadonlySet<EnergyFoodSectionId> = new Set(["food-self-sufficiency", "farming"]);

export function buildEnergyFoodHubCards(facts: readonly ClientEnergyFoodFact[], presentation: Presentation): HubCardModel[] {
  return ENERGY_FOOD_SECTIONS.map((section, index) => {
    // Each card's sparkline is the page's reference series, over the years the page covers; a preliminary latest value is marked.
    const reference = energyFoodSeries(section.id).find(s => s.reference)!.id;
    const { years } = energyFoodCoverage(section.id, facts);
    const headline = facts.filter(f => f.indicatorId === reference).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const { unit } = last;
    const value = `${formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals })}${unit === "percent" ? "%" : ` ${message(presentation.messages, `energyFood.unit.${unit}`)}`}`;
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: message(presentation.messages, `energyFood.page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: annualSeries(headline, years[0], years.at(-1)), seriesColor: INK,
      footer: `${last.year} · ${value} · ${years[0]}–${years.at(-1)}`,
      latest: {
        value, period: String(last.year), ...(CAPTIONED.has(section.id) ? { caption: message(presentation.messages, `energyFood.latest.${section.id}`) } : {}),
        ...(last.valueStatus === "preliminary" ? { status: "preliminary" as const } : {}),
      },
      years: coverageRange(years[0], years.at(-1)!),
    };
  });
}
