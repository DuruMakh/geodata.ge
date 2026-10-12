import type { ClientWagesFact } from "../data/wages/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import type { HubCardModel } from "./hubCards";
import { WAGES_SECTIONS, wagesCoverage, wagesViews } from "./wages";

export function buildWagesHubCards(facts: readonly ClientWagesFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string, values?: Record<string, string | number>) => message(presentation.messages, `wages.${key}`, values);
  return WAGES_SECTIONS.map((section, index) => {
    const years = [...new Set(wagesViews(section.id).flatMap(view => wagesCoverage(section.id, view, facts).years))].sort((a, b) => a - b);
    const national = section.id === "overview" ? facts.filter(f => f.indicatorId === "average_monthly_nominal_earnings" && f.dimension === "national" && f.sectorId === "total").sort((a, b) => a.year - b.year) : null;
    const last = national?.at(-1);
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false, series: national?.map(f => f.value) ?? null, seriesColor: national ? INK : null,
      footer: last ? `${last.year} · ${t("gelAmount", { amount: formatInUnit(last.value, { divisor: 1, label: "", decimals: 1 }) })} · ${years[0]}–${years.at(-1)}` : `${years[0]}–${years.at(-1)} · ${t("annual")}`,
    };
  });
}
