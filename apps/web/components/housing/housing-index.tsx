"use client";
import type { ClientHousingFact } from "../../lib/data/housing/types";
import { formatInUnit } from "../../lib/explorer/format";
import { housingFloorArea, housingValueLabel, housingValueUnit } from "../../lib/explorer/housing";
import { housingRegionHref } from "../../lib/explorer/housingAreas";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/**
 * The Regions index: the region with the most floor area permitted, then the map and ranked list of the eleven regions'
 * permitted floor area. Georgia (the list's first, unranked row) and each region open their own page. There is no map switch.
 */
export function HousingIndex({ facts, regionMap }: {
  /** Georgia's permitted floor area, every year. */
  facts: ClientHousingFact[];
  /** The regions' permitted floor area in the latest year all eleven have. */
  regionMap: RegionMapModel;
}) {
  const { locale, messages, englishLabels } = useI18n();
  useAppReady();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `housing.${key}`, values);
  // The map and list read in thousand m² to one decimal, named by the legend and the source line; the line keeps million m².
  const unitLabel = t("unitThousandSquareMetres"), mapLabel = t("mapLabel");
  const valueLabel = (value: number) => housingValueLabel(value, "area", t);
  const largest = regionMap.regions[0];
  const largestName = publicLabel(locale, largest.regionId, largest.nameKa, englishLabels);
  const georgiaValue = facts.find(f => f.indicatorId === "housing.permits_area.total" && f.year === regionMap.year)?.value;
  return <div data-testid="housing-regions" className="@container">
    <ExplorerHeading>{t("page.regions.title")}</ExplorerHeading>
    <LatestValueLine testId="housing-latest" measure={t("latest.regions", { region: largestName })} period={regionMap.year} value={housingFloorArea(largest.value, t)} />
    <section data-testid="housing-region-index" className="mt-4">
      <RegionIndex title={t("page.regions.title")} model={regionMap} summary={[]} sourceNote={`${t("sourceNoteRegions")} · ${unitLabel} · ${regionMap.year}.`}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: housingRegionHref, formatValue: value => formatInUnit(value, housingValueUnit("area")), legend: `${mapLabel} · ${unitLabel}`, testId: "housing-region-map",
          mapAria: t("regionMapAria", { total: mapLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
        }} />
    </section>
  </div>;
}
