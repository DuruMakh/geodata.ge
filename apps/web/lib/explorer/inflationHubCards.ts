import { periodFromKey } from "../data/inflation/periods";
import type { CategoryFactInput, CityFactInput, ServedBasketWeightRow, ServedCpiFact } from "../data/inflation/types";
import type { ServedProductData } from "../data/inflation/importProducts";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { formatShare } from "./format";
import type { HubCardModel } from "./hubCards";
import { buildCategoryIndex, latestContributors } from "./inflationCategories";
import { categoryColor, categoryLabel, formatContribution } from "./inflationCategoryLabels";
import { buildCityIndex } from "./inflationCities";
import { latestCityIndicators } from "./inflationCityIndicators";
import { cityLineLabel } from "./inflationCityLabels";
import { periodLabel } from "./inflationLabels";
import { productColor } from "./inflationProducts";

// Inflation hub cards reuse the budget card anatomy (DESIGN.md §6.6). The
// overview, categories, products and cities are all delivered. Figures come
// from served facts at build time.

export type ProductHubSummary = {
  productId: string;
  labelEn: string;
  labelKa: string;
  latestPeriod: string;
  annualChangePct: number;
  annualSeries: Array<number | null>;
};

/** Only this compact result crosses from the product source to the hub card. */
export function buildLatestProductHubSummary(data: ServedProductData): ProductHubSummary | null {
  const annual = data.facts.filter((fact) => fact.measure === "yoy_index_100");
  const latestPeriod = annual.reduce((latest, fact) => fact.period > latest ? fact.period : latest, "");
  const leader = annual.filter((fact) => fact.period === latestPeriod && fact.index100 !== null)
    .sort((a, b) => Number(b.index100) - Number(a.index100) || a.productId.localeCompare(b.productId))[0];
  if (!leader) return null;
  const product = data.catalogue.find((item) => item.productId === leader.productId);
  if (!product) throw new Error(`Latest product leader is absent from the catalogue: ${leader.productId}`);
  return {
    productId: leader.productId, labelEn: product.labelEn, labelKa: product.labelKa, latestPeriod,
    annualChangePct: Number(leader.index100) - 100,
    annualSeries: annual.filter((fact) => fact.productId === leader.productId).sort((a, b) => a.period.localeCompare(b.period))
      .map((fact) => fact.index100 === null ? null : Number(fact.index100) - 100),
  };
}

export function buildInflationHubCards(
  facts: ServedCpiFact[],
  presentation: Presentation,
  categories: CategoryFactInput[],
  weights: ServedBasketWeightRow[],
  productSummary: ProductHubSummary | null = null,
  cities: CityFactInput[] = [],
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

  const productsCard: HubCardModel = {
    index: "03",
    title: t("cardProducts"),
    description: t("cardProductsDescription"),
    href: "/explorer/inflation/products",
    comingSoon: false,
    series: productSummary?.annualSeries ?? null,
    seriesColor: productSummary ? productColor(productSummary.productId) : null,
    footer: productSummary ? `${periodLabel(presentation.messages, periodFromKey(productSummary.latestPeriod), "long")} · ${presentation.locale === "ka" ? productSummary.labelKa : productSummary.labelEn} ${formatShare(productSummary.annualChangePct / 100)}` : null,
  };

  // Cities lead with the highest city's annual rate; the sparkline is the gap
  // between cities, the question the section adds (spec §5).
  const cityIndex = cities.length > 0 ? buildCityIndex(cities) : null;
  const cityLatest = cityIndex === null ? null : latestCityIndicators(cityIndex);
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

  return [overviewCard, categoriesCard, productsCard, citiesCard];
}
