import type { ClientCrimeFact } from "../data/crime/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { CRIME_SECTIONS, crimeDefaultSelection } from "./crime";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";

/** Each card's sparkline and footer are its page's default series, the published count. A year without a count is a gap in the line, never a zero. */
export function buildCrimeHubCards(facts: readonly ClientCrimeFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `crime.${key}`);
  return CRIME_SECTIONS.map((section, index) => {
    const [seriesId] = crimeDefaultSelection(section.id);
    const valueByYear = new Map(facts.filter(f => f.indicatorId === seriesId).map(f => [f.year, f.value]));
    const years = [...valueByYear.keys()].sort((a, b) => a - b);
    const first = years[0], last = years.at(-1)!;
    const value = formatInUnit(valueByYear.get(last)!, { divisor: 1, label: "", decimals: 0 });
    return {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: Array.from({ length: last - first + 1 }, (_, offset) => valueByYear.get(first + offset) ?? null), seriesColor: INK,
      // Prisons counts the prisoners held at the year's end, as its page's line says; every other title names what its count counts.
      footer: `${last} · ${value} · ${first}–${last}`, latest: { value, period: String(last), ...(section.id === "prisons" ? { caption: t("latest.prisons") } : {}) }, years: coverageRange(first, last),
    };
  });
}
