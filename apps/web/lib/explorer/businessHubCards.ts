import type { ClientBusinessFact } from "../data/business/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { BUSINESS_SECTIONS, type BusinessSectionId } from "./business";
import { buildBusinessRegionMapModel } from "./businessRegionMap";
import { formatAmount, formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";

/** Each card's sparkline and footer years follow one series: firms' sales, people employed, investment and new firms. Regions has none, only the map's years. */
const HEADLINE: Record<Exclude<BusinessSectionId, "regions">, string> = {
  sales: "business.turnover.total", jobs: "business.employed.total", "investment-profit": "business.investment.total", firms: "business.births.total",
};

export function buildBusinessHubCards(facts: readonly ClientBusinessFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string, values?: Record<string, string | number>) => message(presentation.messages, `business.${key}`, values);
  return BUSINESS_SECTIONS.map((section, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
    };
    if (section.id === "regions") {
      const map = buildBusinessRegionMapModel("turnover", facts);
      return { ...card, series: null, seriesColor: null, footer: `${map.firstYear}–${map.year}`, years: coverageRange(map.firstYear, map.year) };
    }
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const value = last.unit === "gel" ? formatAmount(last.value, presentation.locale)
      : last.unit === "persons" ? `${formatInUnit(last.value, { divisor: 1_000, label: "", decimals: 1 })} ${t("unitThousandPersons")}`
      : t("cardFirms", { value: formatInUnit(last.value, { divisor: 1, label: "", decimals: 0 }) });
    // Investment and profit leads with investment, as its page's line does; the other titles name their figure.
    return { ...card, series: annualSeries(headline), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      latest: { value, period: String(last.year), ...(section.id === "investment-profit" ? { caption: t("latest.investment-profit") } : {}) }, years: coverageRange(headline[0].year, last.year) };
  });
}
