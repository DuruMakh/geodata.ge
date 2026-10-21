"use client";
import type { EnvironmentUnit } from "../../lib/data/environment/types";
import { formatInUnit } from "../../lib/explorer/format";
import { environmentUnitLabelKey, environmentValueLabel, environmentValueUnit } from "../../lib/explorer/environment";
import { environmentAreaRoutes, type EnvironmentAreaTopic } from "../../lib/explorer/environmentAreas";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/**
 * The Waste or Forests page: the map and ranked list of the regions' waste collected or timber cut in the latest year all
 * regions with a figure have. Georgia (the list's first, unranked row) and each region open their own page; a region with
 * no figure (Tbilisi's timber) is listed last without a value.
 */
export function EnvironmentRegionIndex({ topic, regionMap, georgiaValue, unit, decimals, latest }: {
  topic: EnvironmentAreaTopic; regionMap: RegionMapModel;
  /** Georgia's figure in the map's year. */
  georgiaValue: number | undefined;
  /** The map's unit and the most decimals its figures were published with. */
  unit: EnvironmentUnit; decimals: number;
  /** The line under the heading, built on the server page. */
  latest: { measure: string; year: number; value: string };
}) {
  const { messages } = useI18n();
  useAppReady();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `environment.${key}`, values);
  const unitLabel = t(environmentUnitLabelKey(unit)), mapLabel = t(`mapLabel.${topic}`);
  return <div data-testid={`environment-${topic}`} className="@container">
    <ExplorerHeading>{t(`page.${topic}.title`)}</ExplorerHeading>
    <LatestValueLine testId="environment-latest" measure={latest.measure} period={latest.year} value={latest.value} />
    <section data-testid="environment-region-index" className="mt-4">
      <RegionIndex model={regionMap} summary={[]} sourceNote={`${t(`sourceNote.${topic}`)} · ${unitLabel} · ${regionMap.year}.`}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: environmentAreaRoutes(topic).regionHref, formatValue: value => formatInUnit(value, environmentValueUnit(decimals)), legend: `${mapLabel} · ${unitLabel}`,
          testId: "environment-region-map", mapAria: t("regionMapAria", { total: mapLabel, unit: unitLabel, year: regionMap.year }),
          entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: environmentValueLabel(value, unit, decimals, t), year }),
        }} />
    </section>
  </div>;
}
