import { periodFromKey } from "../data/inflation/periods";
import type { CategoryFactInput, ServedBasketWeightRow, ServedCpiFact } from "../data/inflation/types";
import type { ServedProductData } from "../data/inflation/importProducts";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { formatShare } from "./format";
import type { HubCardModel } from "./hubCards";
import { buildCategoryIndex, latestContributors } from "./inflationCategories";
import { categoryColor, categoryLabel, formatContribution } from "./inflationCategoryLabels";
import { periodLabel } from "./inflationLabels";
import { productColor } from "./inflationProducts";

// Inflation hub cards reuse the budget card anatomy (DESIGN.md §6.6). The
// overview, categories and products are delivered; cities is a coming-soon
// marker. Figures come from
// served facts at build time.

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
    {
      index: "03",
      title: t("cardProducts"),
      description: t("cardProductsDescription"),
      href: "/explorer/inflation/products",
      comingSoon: false,
      series: productSummary?.annualSeries ?? null,
      seriesColor: productSummary ? productColor(productSummary.productId) : null,
      footer: productSummary ? `${periodLabel(presentation.messages, periodFromKey(productSummary.latestPeriod), "long")} · ${presentation.locale === "ka" ? productSummary.labelKa : productSummary.labelEn} ${formatShare(productSummary.annualChangePct / 100)}` : null,
    },
    {
      index: "04",
      title: t("cardCities"),
      description: t("cardCitiesDescription"),
      href: null,
      comingSoon: true,
      series: null,
      seriesColor: null,
      footer: null,
    },
  ];
}
