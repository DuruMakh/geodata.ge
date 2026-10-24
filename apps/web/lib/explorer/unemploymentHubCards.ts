import type { ClientUnemploymentObservation, UnemploymentGroupDefinition } from "../data/unemployment/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { formatShare } from "./format";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import type { CardGraphic } from "./topicHub";
import { UNEMPLOYMENT_SECTIONS, type UnemploymentSectionId } from "./unemploymentSections";
import { UNEMPLOYMENT_AGE_FIRST_YEAR } from "./unemploymentAge";

/** The youngest bands the age card marks: 15–29, the young people its page is about. */
const YOUNG_BANDS = 3;

/**
 * The latest year's rates its page compares, given the reviewed groups (`groups`): every age band, young people
 * marked, and men beside women, the higher marked.
 */
function graphic(section: UnemploymentSectionId, observations: readonly ClientUnemploymentObservation[], year: number, groups: readonly UnemploymentGroupDefinition[], presentation: Presentation): CardGraphic | undefined {
  if (section !== "age" && section !== "gender") return undefined;
  const rates = new Map(observations.filter(fact => fact.year === year).map(fact => [fact.groupId, fact.value]));
  const rows = groups.filter(group => rates.has(group.id)).sort((a, b) => a.sortOrder - b.sortOrder)
    .map(group => ({ label: presentation.locale === "en" ? group.labelEn : group.labelKa, value: rates.get(group.id)! }));
  if (section === "age") {
    const bars = rows.map((row, index) => ({ ...row, accent: index < YOUNG_BANDS }));
    return { kind: "bars", bars, first: bars[0].label, last: bars.at(-1)!.label };
  }
  const max = Math.max(...rows.map(row => row.value));
  return { kind: "pair", rows: rows.map(row => ({ ...row, text: formatShare(row.value / 100), accent: row.value === max })), max };
}

export function buildUnemploymentHubCards(facts: readonly ClientUnemploymentObservation[], presentation: Presentation, groups?: readonly UnemploymentGroupDefinition[]): HubCardModel[] {
  return UNEMPLOYMENT_SECTIONS.map((section, index) => {
    const observations = facts.filter(fact => fact.dimension === section.breakdown && fact.indicatorId === "unemployment_rate" && (section.id !== "age" || fact.year >= UNEMPLOYMENT_AGE_FIRST_YEAR));
    const years = [...new Set(observations.map(fact => fact.year))].sort((a, b) => a - b);
    const first = years[0], last = years.at(-1)!;
    const national = section.id === "overview" ? observations.sort((a, b) => a.year - b.year) : null;
    const rate = national ? formatShare(national.at(-1)!.value / 100) : null;
    return {
      index: String(index + 1).padStart(2, "0"),
      title: message(presentation.messages, section.labelKey),
      description: message(presentation.messages, `unemployment.page.${section.id}.summary`),
      href: section.href,
      comingSoon: false,
      series: national?.map(fact => fact.value) ?? null,
      seriesColor: national ? INK : null,
      footer: national ? `${last} · ${rate} · ${first}–${last}` : `${first}–${last} · ${message(presentation.messages, "unemployment.annual")}`,
      latest: rate === null ? null : { value: rate, period: String(last) },
      years: coverageRange(first, last),
      graphic: groups ? graphic(section.id, observations, last, groups, presentation) : undefined,
    };
  });
}
