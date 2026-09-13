import type { ServedGdpObservation } from "../data/gdpOverview/types";
import type { ServedSectorObservation } from "../data/economicSectors/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import type { HubCardModel } from "./hubCards";
export function buildEconomyHubCards(
  facts: ServedGdpObservation[],
  p: Presentation,
  sectorFacts: ServedSectorObservation[] = [],
): HubCardModel[] {
  const t = (k: string) => message(p.messages, `gdp.${k}`);
  const real = facts
    .filter((f) => f.seriesId === "real_usd_2015")
    .sort((a, b) => a.year - b.year);
  const nominal = facts
    .filter((f) => f.seriesId === "nominal_gel")
    .sort((a, b) => a.year - b.year);
  return [
    {
      index: "01",
      title: t("heading"),
      description: t("description"),
      href: "/explorer/economy/gdp",
      comingSoon: false,
      series: real.map((f) => f.value),
      seriesColor: "#1E1B16",
      footer: `${real.at(-1)!.year}: ${(real.at(-1)!.value / 1e9).toFixed(1)} ${t("bn")} ${t("usd")} · ${t("real")}: ${real[0].year}–${real.at(-1)!.year} · ${t("nominal")}: ${nominal[0].year}–${nominal.at(-1)!.year}`,
    },
    ...(["sectors", "regions"] as const).map((id, i) => ({
      index: `0${i + 2}`,
      title: t(id),
      description: t(id + "Description"),
      href: id === "sectors" && sectorFacts.length ? "/explorer/economy/sectors" : null,
      comingSoon: id !== "sectors" || !sectorFacts.length,
      series: null,
      seriesColor: null,
      footer: id === "sectors" && sectorFacts.length ? `${Math.min(...sectorFacts.map(f=>f.year))}–${Math.max(...sectorFacts.map(f=>f.year))}` : null,
    })),
  ];
}
