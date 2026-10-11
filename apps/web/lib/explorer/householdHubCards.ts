import type { ClientHouseholdFact, HouseholdIndicator } from "../data/household/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import type { HubCardModel } from "./hubCards";
import { HOUSEHOLD_SECTIONS, householdCoverage } from "./household";

/** Each card's sparkline: Georgia's average monthly income, and its consumption spending, per household. */
const HEADLINE: Record<typeof HOUSEHOLD_SECTIONS[number]["id"], HouseholdIndicator> = { income: "income.total", spending: "spending.consumption" };

export function buildHouseholdHubCards(facts: readonly ClientHouseholdFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `household.${key}`);
  return HOUSEHOLD_SECTIONS.map((section, index) => {
    const { years } = householdCoverage(section.id, "parts", "georgia", "per_household", facts);
    const national = facts.filter(f => f.indicatorId === HEADLINE[section.id] && f.areaId === "georgia" && f.measure === "per_household").sort((a, b) => a.year - b.year);
    const last = national.at(-1)!;
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: national.map(f => f.value), seriesColor: INK,
      footer: `${last.year} · ${formatInUnit(last.value, { divisor: 1, label: "", decimals: 1 })} ${t("unitGel")} · ${years[0]}–${years.at(-1)}`,
    };
  });
}
