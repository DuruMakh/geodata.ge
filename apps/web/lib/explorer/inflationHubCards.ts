import { periodFromKey } from "../data/inflation/periods";
import type { CategoryFactInput, CityFactInput, ServedBasketWeightRow, ServedCpiFact } from "../data/inflation/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { formatShare } from "./format";
import type { HubCardModel } from "./hubCards";
import { buildCategoryIndex, latestContributors } from "./inflationCategories";
import { categoryColor, categoryLabel, formatContribution } from "./inflationCategoryLabels";
import { buildCityIndex, latestCityIndicators } from "./inflationCities";
import { cityLineLabel } from "./inflationCityLabels";
import { periodLabel } from "./inflationLabels";

// Inflation hub cards reuse the budget card anatomy (DESIGN.md §6.6). The
// overview, categories and cities are delivered; the basket and products
// sections are coming-soon markers with no routes, as on the Economy hub.
// Figures come from served facts at build time.

export function buildInflationHubCards(
  facts: ServedCpiFact[],
  presentation: Presentation,
  categories: CategoryFactInput[],
  weights: ServedBasketWeightRow[],
  cities: CityFactInput[],
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

  const overviewCard: HubCardModel = {
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
  };

  const categoriesCard: HubCardModel = {
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
  };

  // Cities lead with the highest city's annual rate; the sparkline is the gap
  // between cities, the question the section adds (spec §5).
  const cityIndex = cities.length > 0 ? buildCityIndex(cities) : null;
  const cityLatest = cityIndex === null ? null : latestCityIndicators(cityIndex, "cpi.headline");
  const comingSoon = (name: "Basket" | "Products", position: string): HubCardModel => ({
    index: position,
    title: t(`card${name}`),
    description: t(`card${name}Description`),
    href: null,
    comingSoon: true,
    series: null,
    seriesColor: null,
    footer: null,
  });

  const citiesCard: HubCardModel = {
    index: "04",
    title: t("citiesHeading"),
    description: t("citiesDescription"),
    href: "/explorer/inflation/cities",
    comingSoon: false,
    series: cityLatest === null ? null : cityLatest.gap.spark.filter((value): value is number => value !== null),
    seriesColor: INK,
    footer: cityLatest === null
      ? null
      : `${periodLabel(presentation.messages, cityLatest.period, "long")} · ${cityLatest.highest.cityIds.map((id) => cityLineLabel(presentation.messages, id)).join(", ")} ${formatShare(cityLatest.highest.value / 100)}`,
  };

  return [overviewCard, categoriesCard, comingSoon("Basket", "03"), citiesCard, comingSoon("Products", "05")];
}
