"use client";
import type { ClientScienceCultureFact } from "../../lib/data/scienceCulture/types";
import { formatInUnit } from "../../lib/explorer/format";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { scienceCultureValueLabel, scienceCultureValueUnit } from "../../lib/explorer/scienceCulture";
import { museumRegionHref } from "../../lib/explorer/scienceCultureMuseums";
import { Message } from "../../lib/i18n/message";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { RegionIndex } from "../regional-economies/regional-economies-index";

/**
 * The Museums index: Georgia's museum visitors in the latest year, then the map and ranked list of the eleven regions'
 * visitors. Georgia (the list's first, unranked row) and each region open their own page. There is no map switch.
 */
export function MuseumsIndex({ facts, regionMap }: {
  /** Georgia's museum visitors (thousand), every year. */
  facts: ClientScienceCultureFact[];
  /** The regions' museum visitors in the latest year all eleven have. */
  regionMap: RegionMapModel;
}) {
  const { messages } = useI18n();
  useAppReady();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `scienceCulture.${key}`, values);
  // The map and list read in thousands to one decimal, named by the legend and the source line; the line reads in millions.
  const unitLabel = t("unit.thousand"), mapLabel = t("mapLabel");
  const latest = facts.filter(f => f.indicatorId === "science_culture.museum_visitors.total").sort((a, b) => a.year - b.year).at(-1)!;
  const georgiaValue = facts.find(f => f.indicatorId === "science_culture.museum_visitors.total" && f.year === regionMap.year)?.value;
  return <div data-testid="science-culture-museums" className="@container">
    <ExplorerHeading>{t("page.museums.title")}</ExplorerHeading>
    <LatestValueLine testId="science-culture-latest" sentence={<Message messages={messages} id="scienceCulture.latest.museumsIndex"
      values={{ period: latest.year, value: <LatestFigure value={formatInUnit(latest.value, { divisor: 1_000, label: "", decimals: 1 })} /> }} />} />
    <section data-testid="science-culture-region-index" className="mt-4">
      <RegionIndex title={t("page.museums.title")} model={regionMap} summary={[]} sourceNote={`${t("sourceNoteMuseums")} · ${unitLabel} · ${regionMap.year}.`}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: museumRegionHref, formatValue: value => formatInUnit(value, scienceCultureValueUnit("thousand")), legend: `${mapLabel} · ${unitLabel}`, testId: "science-culture-region-map",
          mapAria: t("regionMapAria", { total: mapLabel, unit: unitLabel, year: regionMap.year }),
          entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: scienceCultureValueLabel(value, "thousand", t), year }),
        }} />
    </section>
  </div>;
}
