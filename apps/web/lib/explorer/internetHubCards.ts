import type { ClientInternetFact } from "../data/internet/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";
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
      href: section.href, comingSoon: false, series: annualSeries(headline), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      // Phones and computers states the share owning a mobile phone, as its page's line does; the other titles name their share.
      latest: { value, period: String(last.year), ...(section.id === "devices" ? { caption: message(presentation.messages, "groups.caption.mobilePhone") } : {}) }, years: coverageRange(headline[0].year, last.year),
    };
  });
}
