import type { ClientPovertyFact, PovertyIndicator } from "../data/poverty/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { POVERTY_SECTIONS, povertyCoverage, povertyViews } from "./poverty";

/** Each card's sparkline: Georgia's poverty-line rate, and the Gini coefficient by total income. */
const HEADLINE: Record<typeof POVERTY_SECTIONS[number]["id"], PovertyIndicator> = { rates: "poverty.absolute", inequality: "gini.total_income" };

export function buildPovertyHubCards(facts: readonly ClientPovertyFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `poverty.${key}`);
  return POVERTY_SECTIONS.map((section, index) => {
    const years = [...new Set(povertyViews(section.id).flatMap(view => povertyCoverage(section.id, view, facts).years))].sort((a, b) => a - b);
    const national = facts.filter(f => f.indicatorId === HEADLINE[section.id] && f.groupId === "georgia").sort((a, b) => a.year - b.year);
    const last = national.at(-1)!;
    const value = `${formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals })}${section.id === "rates" ? t("unitPercent") : ""}`;
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: national.map(f => f.value), seriesColor: INK,
      footer: `${last.year} · ${value} · ${years[0]}–${years.at(-1)}`,
      latest: { value, period: String(last.year) }, years: coverageRange(years[0], years.at(-1)!),
    };
  });
}
