"use client";
import type { ClientHouseholdFact, HouseholdMeasure } from "../../lib/data/household/types";
import { householdMeasureHash, householdRegionHref, parseHouseholdMeasure, sectionTotal, serializeHouseholdMeasure, type HouseholdSectionId } from "../../lib/explorer/household";
import { formatInUnit } from "../../lib/explorer/format";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { useHashState } from "../explorer-shell/use-hash-state";
import { RegionIndex } from "../regional-economies/regional-economies-index";
import { MeasureTabs } from "./household-measure-tabs";

/**
 * The Income or Spending index: Georgia's latest value, the measure switch and the map and ranked list of the section total.
 * Georgia (the list's first row) and each region open their own page, carrying the per person choice.
 */
export function HouseholdIndex({ section, facts, regionMaps }: {
  section: HouseholdSectionId;
  /** Georgia's section total, both measures. */
  facts: ClientHouseholdFact[];
  regionMaps: Record<HouseholdMeasure, RegionMapModel>;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `household.${key}`, values);
  const { state: measure, update } = useHashState(section, parseHouseholdMeasure, serializeHouseholdMeasure);
  const unitLabel = t(`unitLong.${measure}`);
  const valueLabel = (value: number) => `${formatInUnit(value, { divisor: 1, label: t("unitGel"), decimals: 1 })} ${t("unitGel")}`;
  const georgia = (m: HouseholdMeasure) => facts.filter(f => f.indicatorId === sectionTotal(section) && f.areaId === "georgia" && f.measure === m).sort((a, b) => a.year - b.year);
  // The latest-value line is the page's headline: Georgia per household, whichever measure the map shows.
  const latest = georgia("per_household").at(-1)!;
  // The map of the section total, in the latest year every region has, for the chosen measure.
  const regionMap = regionMaps[measure];
  const totalLabel = t(`series.${sectionTotal(section)}`);
  const georgiaValue = georgia(measure).find(f => f.year === regionMap.year)?.value;
  return <div data-testid={`household-${section}`} className="@container">
    <ExplorerHeading>{t(`page.${section}.title`)}</ExplorerHeading>
    <LatestValueLine testId="household-latest" measure={t(`latest.${section}`)} period={latest.year} value={valueLabel(latest.value)} />
    <section data-testid="household-regions" data-measure={measure} className="mt-4">
      <RegionIndex title={t(`page.${section}.title`)} model={regionMap} summary={[]} sourceNote={`${t("sourceNote")} · ${unitLabel} · ${regionMap.year}.`}
        mapControls={<MeasureTabs value={measure} onChange={next => update(() => next, true)} />}
        leadRow={georgiaValue === undefined ? undefined : { id: "georgia", label: t("area.georgia"), value: georgiaValue }} metric={{
          hrefForRegion: id => `${householdRegionHref(section, id)}${householdMeasureHash(measure)}`, formatValue: valueLabel, legend: `${totalLabel} · ${unitLabel}`, testId: "household-region-map",
          mapAria: t("regionMapAria", { total: totalLabel, unit: unitLabel, year: regionMap.year }), entityAria: (name, value, year) => t("regionMapEntityAria", { name, amount: valueLabel(value), year }),
        }} />
    </section>
  </div>;
}
