import type { ClientScienceCultureFact } from "../data/scienceCulture/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { SCIENCE_CULTURE_SECTIONS, scienceCultureValueUnit, type ScienceCultureSectionId } from "./scienceCulture";
import { annualSeries } from "./sparkline";

/** Each card's sparkline and footer follow one series, the page's default: all researchers, Georgian invention applications, museum visitors and theatre audience. */
const HEADLINE: Record<ScienceCultureSectionId, string> = {
  research: "science_culture.researchers.total", patents: "science_culture.invention_applications.local",
  museums: "science_culture.museum_visitors.total", theatres: "science_culture.theatre_audience.total",
};

/** What each page's line counts, the card's caption (`groups.caption.{key}`). */
const CAPTION: Record<ScienceCultureSectionId, string> = { research: "researchers", patents: "inventions", museums: "museumVisitors", theatres: "theatreGoers" };

/**
 * Each card states its page's line: the figure in the page's scale (museum visitors in millions, theatre-goers in thousands) and
 * what the line counts as its caption.
 */
export function buildScienceCultureHubCards(facts: readonly ClientScienceCultureFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `scienceCulture.${key}`);
  return SCIENCE_CULTURE_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    // Visitors are published in thousands; the Museums page states millions to one decimal.
    const value = section.id === "museums" ? `${formatInUnit(last.value, { divisor: 1_000, label: "", decimals: 1 })} ${message(presentation.messages, "groups.unit.million")}`
      : last.unit === "thousand" ? `${formatInUnit(last.value, scienceCultureValueUnit(last.unit))} ${t("unit.thousand")}`
      : formatInUnit(last.value, scienceCultureValueUnit(last.unit));
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: annualSeries(headline), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      latest: { value, period: String(last.year), caption: message(presentation.messages, `groups.caption.${CAPTION[section.id]}`) }, years: coverageRange(headline[0].year, last.year),
    };
  });
}
