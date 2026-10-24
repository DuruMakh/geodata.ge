import type { ClientLabourFact } from "../data/labour/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit, formatShare } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { LABOUR_SECTIONS, labourDefaultSelection, labourUnit, ONE_DECIMAL } from "./labour";

/**
 * Each card's sparkline and footer follow its page's total (spec §8), numbered on from Unemployment's own cards
 * (`startIndex`). A year without a value is a gap in the line, never a zero.
 */
export function buildLabourHubCards(facts: readonly ClientLabourFact[], presentation: Presentation, startIndex: number): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `labour.${key}`);
  return LABOUR_SECTIONS.map((section, index) => {
    const [seriesId] = labourDefaultSelection(section.id);
    const valueByYear = new Map(facts.filter(f => f.indicatorId === seriesId).map(f => [f.year, f.value]));
    const years = [...valueByYear.keys()].sort((a, b) => a - b);
    const first = years[0], last = years.at(-1)!;
    const unit = labourUnit(section.id), value = valueByYear.get(last)!;
    const shown = unit === "percent" ? formatShare(value / 100) : `${formatInUnit(value, ONE_DECIMAL)} ${t(`cardUnit.${unit}`)}`;
    return {
      index: String(startIndex + index).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
      series: Array.from({ length: last - first + 1 }, (_, offset) => valueByYear.get(first + offset) ?? null), seriesColor: INK,
      footer: `${last} · ${shown} · ${first}–${last}`, latest: { value: shown, period: String(last) }, years: coverageRange(first, last),
    };
  });
}
