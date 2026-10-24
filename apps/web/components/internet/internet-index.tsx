"use client";
import type { ClientInternetFact } from "../../lib/data/internet/types";
import { formatInUnit } from "../../lib/explorer/format";
import { INTERNET_PERCENT, internetPercent } from "../../lib/explorer/internet";
import { internetRegionHref } from "../../lib/explorer/internetAreas";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/**
 * The Internet at home index: Georgia's share of homes with internet, then the map and ranked list of the eleven regions'
 * share in the latest year all eleven have. Georgia (the list's first, unranked row) and each region open their own page.
 * There is no map switch.
 */
export function InternetIndex({ facts, regionMap }: {
  /** Georgia's homes with internet, every year. */
  facts: ClientInternetFact[];
  /** The regions' homes with internet in the latest year all eleven have. */
  regionMap: RegionMapModel;
}) {
  const { messages } = useI18n();
  useAppReady();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `internet.${key}`, values);
  const unitLabel = t("unitPercent"), mapLabel = t("mapLabel");
  const latest = facts.filter(f => f.indicatorId === "internet.homes_internet.total").sort((a, b) => a.year - b.year).at(-1)!;
  const georgiaValue = facts.find(f => f.indicatorId === "internet.homes_internet.total" && f.year === regionMap.year)?.value;
  return <div data-testid="internet-homes" className="@container">
    <ExplorerHeading>{t("page.homes.title")}</ExplorerHeading>
    <LatestValueLine testId="internet-latest" sentence={<Message messages={messages} id="internet.latest.homes" values={{ year: latest.year, value: <LatestFigure value={internetPercent(latest.value)} /> }} />} />
    <section data-testid="internet-region-index" className="mt-4">
      <RegionIndex title={t("page.homes.title")} model={regionMap} summary={[]} sourceNote={`${t("sourceNoteHomes")} · ${unitLabel} · ${regionMap.year}.`}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: internetRegionHref, formatValue: value => formatInUnit(value, INTERNET_PERCENT), legend: `${mapLabel} · ${unitLabel}`, testId: "internet-region-map",
          mapAria: t("regionMapAria", { total: mapLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: internetPercent(value), year }),
        }} />
    </section>
  </div>;
}
