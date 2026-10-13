"use client";
import { formatInUnit } from "../../lib/explorer/format";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { wagesRegionHref } from "../../lib/explorer/wages";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/** The Regions index: the map and ranked list only; each region opens its own page. */
export function WagesRegionsIndex({ regionMap, national }: { regionMap: RegionMapModel; national: { year: number; value: number } }) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `wages.${key}`, values);
  const amount = (value: number) => `${formatInUnit(value, { divisor: 1, label: t("unit"), decimals: 1 })} ${t("unit")}`;
  useAppReady();
  return <div data-testid="wages-regions" className="@container">
    <ExplorerHeading>{t("page.regions.title")}</ExplorerHeading>
    <LatestValueLine testId="wages-latest" measure={t("series.average")} period={national.year} value={amount(national.value)} />
    <div data-testid="wages-regions-index">
      <RegionIndex model={regionMap} sourceNote={t("sourceNote")} metric={{
        hrefForRegion: wagesRegionHref, formatValue: amount,
        mapAria: t("regionMapAria", { year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: amount(value), year }),
        legend: t("series.average"), testId: "wages-region-map",
      }} summary={[
        { label: message(messages, "regionalEconomies.regionCount"), value: String(regionMap.regions.length), detail: `${t("series.average")} · ${regionMap.year}` },
        { label: t("series.average"), value: amount(national.value), detail: String(national.year) },
        { label: message(messages, "regionalEconomies.period"), value: `${regionMap.firstYear}–${regionMap.year}`, detail: t("annual") },
      ]} />
      <p className="mt-3 max-w-[900px] text-[11px] leading-relaxed text-[var(--muted)]">{t("regionNote")}</p>
    </div>
  </div>;
}
