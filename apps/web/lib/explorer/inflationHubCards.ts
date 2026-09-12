import { periodFromKey } from "../data/inflation/periods";
import type { ServedBasketWeightRow, ServedCpiCategoryFact, ServedCpiFact } from "../data/inflation/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { formatShare } from "./format";
import type { HubCardModel } from "./hubCards";
import { buildCategoryIndex, latestContributors } from "./inflationCategories";
import { categoryColor, categoryLabel, formatContribution } from "./inflationCategoryLabels";
import { periodLabel } from "./inflationLabels";

// Inflation hub cards reuse the budget card anatomy (DESIGN.md §6.6). The
// overview and categories are delivered; the other three sections are
// coming-soon markers with no routes, as on the Economy hub. Figures come from
// served facts at build time.

const COMING_SOON = ["Basket", "Cities", "Products"] as const;

export function buildInflationHubCards(
  facts: ServedCpiFact[],
  presentation: Presentation,
  categories: ServedCpiCategoryFact[] = [],
  weights: ServedBasketWeightRow[] = [],
): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `inflation.${key}`);
  const yoy = facts
    .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct")
    .sort((a, b) => a.period.localeCompare(b.period));
  const last = yoy.at(-1);

  // The card leads with the largest contributor, which is the question the
  // section answers; with no category data it stays a plain link.
  const index = categories.length > 0 ? buildCategoryIndex(categories, weights) : null;
  const top = index === null ? null : latestContributors(index, 1);
  const leader = top?.contributors[0] ?? null;
  const leaderSeries =
    index === null || leader === null
      ? null
      : [...(index.contributions.get(leader.categoryId) ?? new Map())]
          .sort((a, b) => a[0] - b[0])
          .map(([, value]) => value);

  return [
    {
      index: "01",
      title: t("heading"),
      description: t("description"),
      href: "/explorer/inflation/overview",
      comingSoon: false,
      series: yoy.map((fact) => fact.value),
      seriesColor: INK,
      footer: last
        ? `${periodLabel(presentation.messages, periodFromKey(last.period), "long")} · ${formatShare(last.value / 100)}`
        : null,
    },
    {
      index: "02",
      title: t("categoriesHeading"),
      description: t("categoriesDescription"),
      href: "/explorer/inflation/categories",
      comingSoon: false,
      series: leaderSeries,
      seriesColor: leader === null ? INK : categoryColor(leader.categoryId),
      footer:
        top && leader
          ? `${periodLabel(presentation.messages, top.period, "long")} · ${categoryLabel(presentation.messages, leader.categoryId)} ${formatContribution(leader.value)} ${t("pp")}`
          : null,
    },
    ...COMING_SOON.map((name, offset) => ({
      index: `0${offset + 3}`,
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
