import type { ClientInternetFact } from "../data/internet/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { INTERNET_SECTIONS, internetPercent, type InternetSectionId } from "./internet";

/** Each card's sparkline, latest figure and years follow its page's default series; Internet at home follows Georgia's homes with internet. */
const HEADLINE: Record<InternetSectionId, string> = {
  homes: "internet.homes_internet.total", users: "internet.used_3m.total", online: "internet.bought_online.total", devices: "internet.own_mobile.total",
};

export function buildInternetHubCards(facts: readonly ClientInternetFact[], presentation: Presentation): HubCardModel[] {
  return INTERNET_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!, value = internetPercent(last.value);
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: message(presentation.messages, `internet.page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: headline.map(f => f.value), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      latest: { value, period: String(last.year) }, years: coverageRange(headline[0].year, last.year),
    };
  });
}
