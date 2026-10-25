import type { ClientHouseholdFact } from "../data/household/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";
import { HOUSEHOLD_SECTIONS, householdCoverage, sectionTotal } from "./household";

export function buildHouseholdHubCards(facts: readonly ClientHouseholdFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `household.${key}`);
  return HOUSEHOLD_SECTIONS.map((section, index) => {
    const { years } = householdCoverage(section.id, "georgia", "per_household", facts);
    const national = facts.filter(f => f.indicatorId === sectionTotal(section.id) && f.areaId === "georgia" && f.measure === "per_household").sort((a, b) => a.year - b.year);
    const last = national.at(-1)!;
    const value = `${formatInUnit(last.value, { divisor: 1, label: "", decimals: 1 })} ${t("unitGel")}`;
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: annualSeries(national), seriesColor: INK,
      footer: `${last.year} · ${value} · ${years[0]}–${years.at(-1)}`,
      latest: { value, period: String(last.year) }, years: coverageRange(years[0], years.at(-1)!),
    };
  });
}
