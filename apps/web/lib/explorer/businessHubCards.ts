import type { ClientBusinessFact } from "../data/business/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { BUSINESS_SECTIONS, type BusinessSectionId } from "./business";
import { buildBusinessRegionMapModel } from "./businessRegionMap";
import { formatAmount, formatInUnit } from "./format";
import type { HubCardModel } from "./hubCards";

/** Each card's sparkline and footer years follow one series: firms' sales, people employed, investment and new firms. Regions has none, only the map's years. */
const HEADLINE: Record<Exclude<BusinessSectionId, "regions">, string> = {
  sales: "business.turnover.total", jobs: "business.employed.total", "investment-profit": "business.investment.total", firms: "business.births.total",
};

export function buildBusinessHubCards(facts: readonly ClientBusinessFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `business.${key}`);
  return BUSINESS_SECTIONS.map((section, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
    };
    if (section.id === "regions") {
      const map = buildBusinessRegionMapModel("turnover", facts);
      return { ...card, series: null, seriesColor: null, footer: `${map.firstYear}–${map.year}` };
    }
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const value = last.unit === "gel" ? formatAmount(last.value, presentation.locale)
      : last.unit === "persons" ? `${formatInUnit(last.value, { divisor: 1_000, label: "", decimals: 1 })} ${t("unitThousandPersons")}`
      : formatInUnit(last.value, { divisor: 1, label: "", decimals: 0 });
    return { ...card, series: headline.map(f => f.value), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}` };
  });
}
