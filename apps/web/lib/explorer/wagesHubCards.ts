import type { ClientWagesFact } from "../data/wages/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import { formatInUnit } from "./format";
import { annualSeries } from "./sparkline";
import type { HubCardModel } from "./hubCards";
import type { CardGraphic } from "./topicHub";
import { WAGES_SECTIONS, wagesCoverage, wagesSummaryValues, wagesViews } from "./wages";

/** The Industries card's bars: the three activities with the highest average wage in their latest year, the highest marked. */
function topIndustries(facts: readonly ClientWagesFact[], labels: Readonly<Record<string, string>>, amount: (value: number) => string): CardGraphic {
  const sections = facts.filter(f => f.indicatorId === "average_monthly_nominal_earnings" && f.dimension === "national" && f.groupId === "georgia" && f.sectorId !== "total" && f.value !== null);
  const year = Math.max(...sections.map(f => f.year));
  const top = sections.filter(f => f.year === year).sort((a, b) => b.value! - a.value!).slice(0, 3);
  return { kind: "pair", rows: top.map((f, index) => ({ label: labels[f.sectorId], value: f.value!, text: amount(f.value!), accent: index === 0 })), max: top[0].value!, period: String(year) };
}

/** `labels` are the pages' series names (`wagesLabels`); with them the Industries card draws its top three. */
export function buildWagesHubCards(facts: readonly ClientWagesFact[], presentation: Presentation, labels?: Readonly<Record<string, string>>): HubCardModel[] {
  const t = (key: string, values?: Record<string, string | number>) => message(presentation.messages, `wages.${key}`, values);
  const amount = (value: number | null) => t("gelAmount", { amount: formatInUnit(value, { divisor: 1, label: "", decimals: 1 }) });
  const summaryValues = wagesSummaryValues(facts);
  return WAGES_SECTIONS.map((section, index) => {
    const years = [...new Set(wagesViews(section.id).flatMap(view => wagesCoverage(section.id, view, facts).years))].sort((a, b) => a - b);
    const national = section.id === "overview" ? facts.filter(f => f.indicatorId === "average_monthly_nominal_earnings" && f.dimension === "national" && f.sectorId === "total").sort((a, b) => a.year - b.year) : null;
    const last = national?.at(-1);
    const value = last ? amount(last.value) : null;
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`, summaryValues),
      href: section.href, comingSoon: false, series: national ? annualSeries(national) : null, seriesColor: national ? INK : null,
      footer: last ? `${last.year} · ${value} · ${years[0]}–${years.at(-1)}` : `${years[0]}–${years.at(-1)} · ${t("annual")}`,
      latest: last && value ? { value, period: String(last.year) } : null, years: coverageRange(years[0], years.at(-1)!),
      graphic: section.id === "industries" && labels ? topIndustries(facts, labels, amount) : undefined,
    };
  });
}
