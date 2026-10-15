"use client";
import { Users } from "lucide-react";
import type { ClientBusinessFact } from "../../lib/data/business/types";
import { businessMapHash, businessRegionHref, parseBusinessMapMeasure, serializeBusinessMapMeasure, type BusinessMapMeasure } from "../../lib/explorer/businessAreas";
import { formatInUnit, unitFor, unitsFor } from "../../lib/explorer/format";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useHashState } from "../explorer-shell/use-hash-state";
import { RegionIndex } from "../regional-economies/regional-economies-index";
import { SegmentedTabs } from "../ui/editorial";

const TOTAL_ID: Record<BusinessMapMeasure, string> = { turnover: "business.turnover.total", employed: "business.employed.total" };

/**
 * The Regions index: the largest region's sales, the map measure switch and the map and ranked list of the eleven regions.
 * Georgia (the list's first row) and each region open their own page, carrying the jobs choice.
 */
export function BusinessIndex({ facts, regionMaps }: {
  /** Georgia's sales and jobs totals. */
  facts: ClientBusinessFact[];
  regionMaps: Record<BusinessMapMeasure, RegionMapModel>;
}) {
  const { locale, messages, englishLabels } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `business.${key}`, values);
  const { state: measure, update } = useHashState(null, parseBusinessMapMeasure, serializeBusinessMapMeasure);
  const regionMap = regionMaps[measure];
  // One unit for the whole map and list: billion GEL (decimals that keep the smallest region apart from zero) or thousand people.
  const bn = unitFor(regionMaps.turnover.regions.map(region => region.value), unitsFor(locale).bn);
  const unitLabel = measure === "turnover" ? message(messages, "format.bnGel") : t("unitThousandPeople");
  const valueLabel = (value: number) => measure === "turnover" ? `${formatInUnit(value, bn)} ${unitLabel}` : `${formatInUnit(value, { divisor: 1_000, label: "", decimals: 1 })} ${t("unitThousandPersons")}`;
  // The latest-value line is the page's headline: the region with the largest sales, whichever measure the map shows.
  const largest = regionMaps.turnover.regions[0];
  const largestName = publicLabel(locale, largest.regionId, largest.nameKa, englishLabels);
  const georgiaValue = facts.find(f => f.indicatorId === TOTAL_ID[measure] && f.year === regionMap.year)?.value;
  const mapLabel = t(`map.${measure}`);
  return <div data-testid="business-regions" className="@container">
    <ExplorerHeading>{t("page.regions.title")}</ExplorerHeading>
    <LatestValueLine testId="business-latest" measure={t("latest.regions", { region: largestName })} period={regionMaps.turnover.year} value={`${formatInUnit(largest.value, bn)} ${message(messages, "format.bnGel")}`} />
    <section data-testid="business-region-index" data-measure={measure} className="mt-4">
      <RegionIndex model={regionMap} summary={[]} sourceNote={`${t("sourceNoteRegions")} · ${unitLabel} · ${regionMap.year}.`}
        mapControls={<SegmentedTabs<BusinessMapMeasure> ariaLabel={t("measure")} value={measure} onChange={next => update(() => next, true)} options={[
          { value: "turnover", label: t("map.turnover"), testId: "business-map-turnover", icon: <span aria-hidden="true" className="text-base">₾</span> },
          { value: "employed", label: t("map.employed"), testId: "business-map-employed", icon: <Users aria-hidden="true" size={18} strokeWidth={1.5} /> },
        ]} />}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: id => `${businessRegionHref(id)}${businessMapHash(measure)}`, formatValue: valueLabel, legend: `${mapLabel} · ${unitLabel}`, testId: "business-region-map",
          mapAria: t("regionMapAria", { total: mapLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
        }} />
    </section>
  </div>;
}
