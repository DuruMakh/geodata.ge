import type { ClientScienceCultureFact } from "../data/scienceCulture/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import type { HubCardModel } from "./hubCards";
import { SCIENCE_CULTURE_SECTIONS, type ScienceCultureSectionId } from "./scienceCulture";

/** Each card's sparkline and footer follow one series, the page's default: all researchers, Georgian invention applications, museum visitors and theatre audience. */
const HEADLINE: Record<ScienceCultureSectionId, string> = {
  research: "science_culture.researchers.total", patents: "science_culture.invention_applications.local",
  museums: "science_culture.museum_visitors.total", theatres: "science_culture.theatre_audience.total",
};

export function buildScienceCultureHubCards(facts: readonly ClientScienceCultureFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `scienceCulture.${key}`);
  return SCIENCE_CULTURE_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const value = formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals });
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: headline.map(f => f.value), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
    };
  });
}
