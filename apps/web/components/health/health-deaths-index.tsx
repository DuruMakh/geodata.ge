"use client";
import type { ClientHealthFact, HealthArea } from "../../lib/data/health/types";
import { healthDeathsAreaHref } from "../../lib/explorer/healthDeaths";
import { formatInUnit } from "../../lib/explorer/format";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/**
 * The Causes of death index: Georgia's latest death rate, then the map and ranked list of the regions' rates.
 * Georgia (the list's first, unranked row) and each region open their own causes-of-death page.
 */
export function HealthDeathsIndex({ georgiaRates, regionMap }: {
  /** Georgia's death rate per 1,000 people, every year. */
  georgiaRates: ClientHealthFact[];
  /** The regions' death rates in the latest year all eleven have. */
  regionMap: RegionMapModel;
}) {
  const { messages } = useI18n();
  useAppReady();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `health.${key}`, values);
  const latest = georgiaRates.toSorted((a, b) => a.year - b.year).at(-1)!;
  const rate = (value: number) => formatInUnit(value, { divisor: 1, label: "", decimals: latest.decimals });
  const unitLabel = t("unitPerThousand"), rateLabel = t("series.health.death_rate.total");
  const georgiaValue = georgiaRates.find(f => f.year === regionMap.year)?.value;
  return <div data-testid="health-causes-of-death" className="@container">
    <ExplorerHeading>{t("page.causes-of-death.title")}</ExplorerHeading>
    <LatestValueLine testId="health-latest" measure={t("latest.causes-of-death")} period={latest.year} value={rate(latest.value)} />
    <section data-testid="health-regions" className="mt-4">
      <RegionIndex model={regionMap} summary={[]} sourceNote={`${t("sourceNoteDeaths")} · ${unitLabel} · ${regionMap.year}.`}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: id => healthDeathsAreaHref(id as HealthArea), formatValue: rate, legend: `${rateLabel} · ${unitLabel}`, testId: "health-region-map",
          mapAria: t("regionMapAria", { unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: rate(value), year }),
        }} />
    </section>
  </div>;
}
