"use client";
import type { ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import { formatInUnit, unitsFor } from "../../lib/explorer/format";
import { moneyBanksRegionHref } from "../../lib/explorer/moneyBanksAreas";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { publicLabel } from "../../lib/i18n/labels";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/**
 * The Loans by region index: the largest region's loans, then the map and ranked list of the eleven regions' loans in the
 * latest year all eleven have. Georgia (the list's first, unranked row) and each region open their own page. There is no
 * map switch.
 */
export function MoneyBanksIndex({ facts, regionMap }: {
  /** Georgia's all loans by region, every year. */
  facts: ClientMoneyBanksFact[];
  /** The regions' all loans in the latest year all eleven have. */
  regionMap: RegionMapModel;
}) {
  const { locale, messages, englishLabels } = useI18n();
  useAppReady();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `moneyBanks.${key}`, values);
  // One unit for the whole map and list: billion GEL to one decimal.
  const bn = { ...unitsFor(locale).bn, decimals: 1 };
  const unitLabel = message(messages, "format.bnGel"), mapLabel = t("mapLabel");
  const valueLabel = (value: number) => `${formatInUnit(value, bn)} ${unitLabel}`;
  // The latest-value line is the page's headline: the region with the most loans.
  const largest = regionMap.regions[0];
  const largestName = publicLabel(locale, largest.regionId, largest.nameKa, englishLabels);
  const georgiaValue = facts.find(f => f.year === regionMap.year)?.value;
  return <div data-testid="money-regions" className="@container">
    <ExplorerHeading>{t("page.regions.title")}</ExplorerHeading>
    <LatestValueLine testId="money-latest" sentence={<Message messages={messages} id="moneyBanks.latest.regions" values={{ year: regionMap.year, region: largestName, value: <LatestFigure value={valueLabel(largest.value)} /> }} />} />
    <section data-testid="money-region-index" className="mt-4">
      <RegionIndex model={regionMap} summary={[]} sourceNote={`${t("sourceNoteRegions")} · ${unitLabel} · ${regionMap.year}.`}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: moneyBanksRegionHref, formatValue: valueLabel, legend: `${mapLabel} · ${unitLabel}`, testId: "money-region-map",
          mapAria: t("regionMapAria", { total: mapLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
        }} />
    </section>
  </div>;
}
