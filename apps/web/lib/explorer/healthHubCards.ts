import type { ClientHealthFact } from "../data/health/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import { HEALTH_SECTIONS, type HealthSectionId } from "./health";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";

/** Each card's sparkline and footer are its page's headline series: Georgia's, in the stored unit and as published. */
const HEADLINES: Record<HealthSectionId, ClientHealthFact["indicatorId"]> = {
  "doctors-hospitals": "health.staff.doctors", "illnesses": "health.illness.respiratory", "causes-of-death": "health.deaths.total",
};

export function buildHealthHubCards(facts: readonly ClientHealthFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `health.${key}`);
  return HEALTH_SECTIONS.map((section, index) => {
    const headline = facts.filter(f => f.indicatorId === HEADLINES[section.id] && f.areaId === "georgia").sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    // Illness groups are published in thousands, where the figure keeps one decimal and its unit word; the others are counts.
    const thousands = last.unit === "persons_thousand";
    const value = thousands ? `${formatInUnit(last.value, { divisor: 1, label: "", decimals: 1 })} ${t("thousand")}` : formatInUnit(last.value, { divisor: 1, label: "", decimals: 0 });
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: headline.map(f => f.value), seriesColor: INK,
      footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      latest: { value, period: String(last.year) }, years: coverageRange(headline[0].year, last.year),
    };
  });
}
