import type { ClientUnemploymentObservation } from "../data/unemployment/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { formatShare } from "./format";
import { INK } from "./colors";
import type { HubCardModel } from "./hubCards";
import { UNEMPLOYMENT_SECTIONS } from "./unemploymentSections";
import { UNEMPLOYMENT_AGE_FIRST_YEAR } from "./unemploymentAge";

export function buildUnemploymentHubCards(facts: readonly ClientUnemploymentObservation[], presentation: Presentation): HubCardModel[] {
  return UNEMPLOYMENT_SECTIONS.map((section, index) => {
    const observations = facts.filter(fact => fact.dimension === section.breakdown && fact.indicatorId === "unemployment_rate" && (section.id !== "age" || fact.year >= UNEMPLOYMENT_AGE_FIRST_YEAR));
    const years = [...new Set(observations.map(fact => fact.year))].sort((a, b) => a - b);
    const first = years[0], last = years.at(-1)!;
    const national = section.id === "overview" ? observations.sort((a, b) => a.year - b.year) : null;
    return {
      index: String(index + 1).padStart(2, "0"),
      title: message(presentation.messages, section.labelKey),
      description: message(presentation.messages, `unemployment.page.${section.id}.summary`),
      href: section.href,
      comingSoon: false,
      series: national?.map(fact => fact.value) ?? null,
      seriesColor: national ? INK : null,
      footer: national ? `${last} · ${formatShare(national.at(-1)!.value / 100)} · ${first}–${last}` : `${first}–${last} · ${message(presentation.messages, "unemployment.annual")}`,
    };
  });
}
