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
import { formatAmount, formatShare } from "./format";
import { buildSectorHighlights } from "./sectorHighlights";
import { coverageRange } from "./coverageLabel";
export function buildEconomyHubCards(
  facts: ServedGdpObservation[],
  p: Presentation,
  sectorFacts: ServedSectorObservation[] = [],
  regionalFacts: ServedRegionalEconomyObservation[] = [],
  expenditureFacts: ServedSectorObservation[] = [],
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
  const households = expenditureFacts
    .filter((f) => f.seriesId === "gdp_use.households" && f.measure === "share_of_gdp")
    .sort((a, b) => a.year - b.year);
  const latestHouseholds = households.at(-1);
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
  const regionName = region ? publicLabel(p.locale, region.id, region.kaLabel, p.englishLabels) : null;
  const latestNominal = nominal.at(-1)!;
  const sectorShare = sectorHighlights && sectorHighlights.topThreeShare !== null ? formatShare(sectorHighlights.topThreeShare / 100) : null;
  return [
    {
      index: "01",
      title: t("heading"),
      description: t("description"),
      href: "/explorer/economy/gdp",
      comingSoon: false,
      series: real.map((f) => f.value),
      seriesColor: INK,
      // One figure, the economy's size as the landing states it, instead of a
      // three-line run of constant-dollar values and coverage ranges.
      footer: `${latestNominal.year} · ${t("nominal")} ${formatAmount(latestNominal.value, p.locale)}`,
      latest: { value: formatAmount(latestNominal.value, p.locale), period: String(latestNominal.year), caption: t("nominal") },
      years: coverageRange(Math.min(...[...real, ...nominal].map((f) => f.year)), Math.max(...[...real, ...nominal].map((f) => f.year))),
    },
    {
      index: "02",
      title: t("sectors"),
      description: t("sectorsDescription"),
      href: sectorHighlights ? "/explorer/economy/sectors" : null,
      comingSoon: sectorHighlights === null,
      series: sectorHighlights?.trends.topThree ?? null,
      seriesColor: sectorHighlights ? INK : null,
      footer: sectorHighlights && sectorShare !== null
        ? `${latestSectorYear} · ${message(p.messages, "sectors.topThree")} ${sectorShare} · ${Math.min(...sectorYears)}–${latestSectorYear}${sectorHighlights.preliminary ? ` · ${t("preliminary")}` : ""}`
        : null,
      latest: sectorShare === null ? null : { value: sectorShare, period: String(latestSectorYear), caption: message(p.messages, "sectors.topThree") },
      years: latestSectorYear === null ? undefined : coverageRange(Math.min(...sectorYears), latestSectorYear),
    },
    {
      index: "03",
      title: t("expenditure"),
      description: t("expenditureDescription"),
      href: latestHouseholds ? "/explorer/economy/expenditure" : null,
      comingSoon: latestHouseholds === undefined,
      series: latestHouseholds ? households.map((f) => f.value) : null,
      seriesColor: latestHouseholds ? INK : null,
      footer: latestHouseholds
        ? `${latestHouseholds.year} · ${message(p.messages, "gdpExpenditure.householdsShare", { share: formatShare(latestHouseholds.value / 100) })} · ${households[0].year}–${latestHouseholds.year}${latestHouseholds.status === "preliminary" ? ` · ${t("preliminary")}` : ""}`
        : null,
      latest: latestHouseholds ? { value: formatShare(latestHouseholds.value / 100), period: String(latestHouseholds.year), caption: message(p.messages, "gdpExpenditure.largest") } : null,
      years: latestHouseholds ? coverageRange(households[0].year, latestHouseholds.year) : undefined,
    },
    {
      index: "04",
      title: t("regions"),
      description: t("regionsDescription"),
      href: largestRegion ? "/explorer/economy/regions" : null,
      comingSoon: largestRegion === null,
      series: regionTrend,
      seriesColor: largestRegion ? INK : null,
      footer: largestRegion && region
        ? `${latestRegionalYear} · ${message(p.messages, "regionalEconomies.largestRegion")}: ${regionName} · ${message(p.messages, "regionalEconomies.total")} (${message(p.messages, "regionalEconomies.currentPrices")}): ${formatAmount(largestRegion.value, p.locale)} · ${firstRegionalYear}–${latestRegionalYear}`
        : null,
      // The caption names the region the figure belongs to, the largest, as the footer does.
      latest: largestRegion && regionName ? { value: formatAmount(largestRegion.value, p.locale), period: String(latestRegionalYear), caption: regionName } : null,
      years: firstRegionalYear === null || latestRegionalYear === null ? undefined : coverageRange(firstRegionalYear, latestRegionalYear),
    },
  ];
}
