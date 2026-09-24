import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedSectorObservation } from "../data/economicSectors/types";
import type { ServedRegionalEconomyObservation } from "../data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import { ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import type { HubCardModel } from "./hubCards";
import { INK } from "./colors";
import { formatAmount, formatInUnit, formatShare, UNIT_BN } from "./format";
import { buildSectorHighlights } from "./sectorHighlights";
export function buildEconomyHubCards(
  facts: ServedGdpObservation[],
  p: Presentation,
  sectorFacts: ServedSectorObservation[] = [],
  regionalFacts: ServedRegionalEconomyObservation[] = [],
): HubCardModel[] {
  const t = (k: string) => message(p.messages, `gdp.${k}`);
  const real = facts
    .filter((f) => f.seriesId === "real_usd_2015")
    .sort((a, b) => a.year - b.year);
  const nominal = facts
    .filter((f) => f.seriesId === "nominal_gel")
    .sort((a, b) => a.year - b.year);
  const sectorYears = sectorFacts.filter((f) => f.measure === "nominal").map((f) => f.year);
  const latestSectorYear = sectorYears.length ? Math.max(...sectorYears) : null;
  const sectorHighlights = latestSectorYear === null
    ? null
    : buildSectorHighlights(sectorFacts, ECONOMIC_SECTORS, latestSectorYear);
  const regionalTotals = regionalFacts.filter((f) => f.measure === "nominal" && f.seriesId === REGIONAL_GDP_TOTAL);
  const regionalYears = regionalTotals.map((f) => f.year);
  const firstRegionalYear = regionalYears.length ? Math.min(...regionalYears) : null;
  const latestRegionalYear = regionalYears.length ? Math.max(...regionalYears) : null;
  const largestRegion = latestRegionalYear === null
    ? null
    : regionalTotals.filter((f) => f.year === latestRegionalYear).sort((a, b) => b.value - a.value)[0];
  const regionTrend = largestRegion && firstRegionalYear !== null && latestRegionalYear !== null
    ? Array.from({ length: latestRegionalYear - firstRegionalYear + 1 }, (_, index) =>
      regionalTotals.find((f) => f.regionId === largestRegion.regionId && f.year === firstRegionalYear + index)?.value ?? null)
    : null;
  const region = largestRegion && REGIONAL_ECONOMY_REGIONS.find((r) => r.id === largestRegion.regionId);
  return [
    {
      index: "01",
      title: t("heading"),
      description: t("description"),
      href: "/explorer/economy/gdp",
      comingSoon: false,
      series: real.map((f) => f.value),
      seriesColor: INK,
      footer: `${real.at(-1)!.year}: ${formatInUnit(real.at(-1)!.value, UNIT_BN)} ${t("bn")} (${t("constant")}) · ${t("real")}: ${real[0].year}–${real.at(-1)!.year} · ${t("nominal")}: ${nominal[0].year}–${nominal.at(-1)!.year}`,
    },
    {
      index: "02",
      title: t("sectors"),
      description: t("sectorsDescription"),
      href: sectorHighlights ? "/explorer/economy/sectors" : null,
      comingSoon: sectorHighlights === null,
      series: sectorHighlights?.trends.topThree ?? null,
      seriesColor: sectorHighlights ? INK : null,
      footer: sectorHighlights && sectorHighlights.topThreeShare !== null
        ? `${latestSectorYear} · ${message(p.messages, "sectors.topThree")} ${formatShare(sectorHighlights.topThreeShare / 100)} · ${Math.min(...sectorYears)}–${latestSectorYear}${sectorHighlights.preliminary ? ` · ${t("preliminary")}` : ""}`
        : null,
    },
    {
      index: "03",
      title: t("regions"),
      description: t("regionsDescription"),
      href: largestRegion ? "/explorer/economy/regions" : null,
      comingSoon: largestRegion === null,
      series: regionTrend,
      seriesColor: largestRegion ? INK : null,
      footer: largestRegion && region
        ? `${latestRegionalYear} · ${message(p.messages, "regionalEconomies.largestRegion")}: ${publicLabel(p.locale, region.id, region.kaLabel, p.englishLabels)} · ${message(p.messages, "regionalEconomies.total")} (${message(p.messages, "regionalEconomies.currentPrices")}): ${formatAmount(largestRegion.value, p.locale)} · ${firstRegionalYear}–${latestRegionalYear}`
        : null,
    },
  ];
}
