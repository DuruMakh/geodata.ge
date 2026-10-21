"use client";
import type { ClientTransportFact } from "../../lib/data/transport/types";
import { formatInUnit } from "../../lib/explorer/format";
import { transportLatestValue, transportValueLabel, transportValueUnit } from "../../lib/explorer/transport";
import { transportRegionHref } from "../../lib/explorer/transportAreas";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/**
 * The Regions index: the region with the most registered vehicles, then the map and ranked list of the eleven regions'
 * registered vehicles. Georgia (the list's first, unranked row) and each region open their own page. There is no map switch.
 */
export function TransportIndex({ facts, regionMap }: {
  /** Georgia's registered vehicles, every year. */
  facts: ClientTransportFact[];
  /** The regions' registered vehicles in the latest year all eleven have. */
  regionMap: RegionMapModel;
}) {
  const { locale, messages, englishLabels } = useI18n();
  useAppReady();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `transport.${key}`, values);
  // The map, list and line read in thousand vehicles to one decimal, named by the legend and the source line.
  const unitLabel = t("unitThousandVehicles"), mapLabel = t("mapLabel");
  const valueLabel = (value: number) => transportValueLabel(value, "vehicles", t);
  const largest = regionMap.regions[0];
  const largestName = publicLabel(locale, largest.regionId, largest.nameKa, englishLabels);
  const georgiaValue = facts.find(f => f.indicatorId === "transport.registered.total" && f.year === regionMap.year)?.value;
  return <div data-testid="transport-regions" className="@container">
    <ExplorerHeading>{t("page.regions.title")}</ExplorerHeading>
    <LatestValueLine testId="transport-latest" measure={t("latest.regions", { region: largestName })} period={regionMap.year} value={transportLatestValue(largest.value, "thousand", t)} />
    <section data-testid="transport-region-index" className="mt-4">
      <RegionIndex model={regionMap} summary={[]} sourceNote={`${t("sourceNoteRegions")} · ${unitLabel} · ${regionMap.year}.`}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: transportRegionHref, formatValue: value => formatInUnit(value, transportValueUnit("vehicles")), legend: `${mapLabel} · ${unitLabel}`, testId: "transport-region-map",
          mapAria: t("regionMapAria", { total: mapLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
        }} />
    </section>
  </div>;
}
