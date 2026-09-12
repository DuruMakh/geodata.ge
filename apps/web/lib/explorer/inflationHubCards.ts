import { periodFromKey } from "../data/inflation/periods";
import type { ServedCpiFact } from "../data/inflation/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { formatShare } from "./format";
import type { HubCardModel } from "./hubCards";
import { periodLabel } from "./inflationLabels";

// Inflation hub cards reuse the budget card anatomy (DESIGN.md §6.6). Only the
// overview is delivered; the other four sections are coming-soon markers with
// no routes, as on the Economy hub. Figures come from served facts at build time.

const COMING_SOON = ["Categories", "Basket", "Cities", "Products"] as const;

export function buildInflationHubCards(facts: ServedCpiFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `inflation.${key}`);
  const yoy = facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct").sort((a, b) => a.period.localeCompare(b.period));
  const last = yoy.at(-1);
  return [
    {
      index: "01",
      title: t("heading"),
      description: t("description"),
      href: "/explorer/inflation/overview",
      comingSoon: false,
      series: yoy.map((fact) => fact.value),
      seriesColor: INK,
      footer: last ? `${periodLabel(presentation.messages, periodFromKey(last.period), "long")} · ${formatShare(last.value / 100)}` : null,
    },
    ...COMING_SOON.map((name, offset) => ({
      index: `0${offset + 2}`,
      title: t(`card${name}`),
      description: t(`card${name}Description`),
      href: null,
      comingSoon: true,
      series: null,
      seriesColor: null,
      footer: null,
    })),
  ];
}
