"use client";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import type { ClientSocialFact, SocialSeriesBreak } from "../../lib/data/social/types";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { educationFullLabel } from "../../lib/explorer/education";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { SocialPlaceSet, SocialPopulation, SocialPriceIndex, SocialShownFact, SocialUnit } from "../../lib/explorer/social";
import {
  buildSocialPlaceModel, changeSocialPlaceSelection, parseSocialPlaceHash, socialPlaceCoverage, socialPlaceFacts, socialPlaceList,
} from "../../lib/explorer/socialPlaces";
import { buildSocialWorkbookExportModel, SOCIAL_UNIT_KEYS } from "../../lib/explorer/socialWorkbook";
import { serializeTopicHash, type TopicState } from "../../lib/explorer/topicSeries";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { EntityHeading, type EntityNavigation } from "../municipalities/entity-heading";
import type { EntityPickerCountry, EntityPickerGroup, EntityPickerOverrides } from "../municipalities/entity-picker";
import { EntityWorkspaceShell } from "../municipalities/entity-workspace-shell";
import { Callout, SourceNote } from "../ui/editorial";

export type SocialPlaceExplorerProps = {
  set: SocialPlaceSet;
  place: DemographyPlace;
  /** This place's served facts of the set only. */
  facts: ClientSocialFact[];
  /** The place's 1 January population and the national yearly price index: the divisors of its calculated rows. */
  population: SocialPopulation;
  cpi: SocialPriceIndex;
  /** The counting-change register; the model draws those inside the range that touch a selected row. */
  breaks: SocialSeriesBreak[];
  /** A name for every series the place lists, and for each heading they sit under. */
  labels: Record<string, string>;
  headingLabels: Record<string, string>;
  /** The heading's lead before the place picker ("Pensions —"). */
  title: string;
  /** The one line under the heading: the place's latest figure, as a sentence. */
  metaLine: ReactNode;
  navigation?: EntityNavigation;
  pickerCountry: EntityPickerCountry;
  pickerGroups: EntityPickerGroup[];
  pickerOverrides: EntityPickerOverrides;
  /** The SSA tables, each with the id the served facts name it by, and Geostat's files behind the calculated rows. */
  sources: (WorkbookPublicSource & { sourceId: string })[];
  populationSources: WorkbookPublicSource[];
  cpiSources: WorkbookPublicSource[];
  siteOrigin: string;
  /** The place named in the Excel file (`region-guria`, `ozurgeti`, `georgia`). */
  workbookScope: string;
  lastReviewedAt: string;
  /** Below the source line: a region's list of its municipalities. */
  children?: ReactNode;
};

type SocialPlaceHashData = { set: SocialPlaceSet; placeId: string; facts: SocialShownFact[] };
const parseState = (hash: string, data: SocialPlaceHashData) => parseSocialPlaceHash(hash, data.set, data.placeId, data.facts);
const serializeState = (state: TopicState) => serializeTopicHash(state);
/** Counts need no unit beside their heading; money, averages and shares name theirs. */
const COUNT_UNITS: readonly SocialUnit[] = ["persons", "families"];

/**
 * A Pensions or Subsistence allowance place page, Education's place page with Social's rows: the place heading (picker,
 * previous/next) and the two-column shell around the chart or table, the years, the series list under its headings and
 * Excel. One heading is charted at a time, and a counting change is drawn as a rule. Every place lists the same rows, so
 * the picker and previous/next carry the view's hash unchanged.
 */
export function SocialPlaceExplorer({
  set, place, facts, population, cpi, breaks, labels, headingLabels, title, metaLine, navigation, pickerCountry, pickerGroups, pickerOverrides,
  sources, populationSources, cpiSources, siteOrigin, workbookScope, lastReviewedAt, children,
}: SocialPlaceExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `social.${key}`, values);
  // The hash data is an effect dependency of useHashState, so its identity changes only with the page.
  const shown = useMemo(() => socialPlaceFacts(set, place.id, facts, { population, cpi }), [set, place.id, facts, population, cpi]);
  const hashData = useMemo(() => ({ set, placeId: place.id, facts: shown }), [set, place.id, shown]);
  const { state, update } = useHashState(hashData, parseState, serializeState);
  const model = buildSocialPlaceModel(set, place.id, shown, state, breaks);
  const list = socialPlaceList(set, place.id, shown, state);
  const unitLabelOf = (unit: SocialUnit) => t(SOCIAL_UNIT_KEYS[unit]);
  const lead = model.selected[0] ?? model.series[0]!;
  const unit: ValueUnit = { divisor: 1, label: "", decimals: lead.decimals };
  const unitLabel = unitLabelOf(model.unit);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${formatInUnit(value, unit)} ${unitLabel}`;
  // Outside the list a row is named in full, "Money paid — State pension".
  const fullLabel = (series: { id: string; heading: string }) => educationFullLabel(headingLabels[series.heading], labels[series.id]);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const reference = model.series.find(series => series.reference);
  const newCounting = t("break.newCounting");
  const placeName = placeLabel(place, locale);
  const chartLabel = `${headingLabels[model.heading]} · ${placeName}`;
  return <div data-testid={`social-place-${set}`}>
    <EntityHeading title={title} triggerLabel={placeName} metaLine={<LatestValueLine testId="social-latest" sentence={metaLine} />} entityId={place.id}
      navigation={navigation} pickerCountry={pickerCountry} pickerGroups={pickerGroups} pickerOverrides={pickerOverrides} carryHash />
    <EntityWorkspaceShell testId="social-place-workspace" asideLabel={message(messages, "controls.series")}
      main={<>
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-heading={model.heading}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="social-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} breaks={model.breaks.map(item => ({ year: item.year, label: newCounting }))} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows} totalRow={null} showTotal={false} wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null}
              breakYears={model.breaks.map(item => item.year)} breakLabel={newCounting} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={socialPlaceCoverage(set, place.id, shown, state.selectedIds).years} range={model.range}
            onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildSocialPlaceModel(set, place.id, shown, s, breaks).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(`sourceNote.${set}`)} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/social-protection", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
        {children}
      </>}
      aside={<FlatSeriesPanel caption={list.end}
        rows={model.series.map(series => {
          const { latest, headingYear } = list.rows[series.id]!;
          const heading = COUNT_UNITS.includes(series.unit) ? headingLabels[series.heading] : `${headingLabels[series.heading]} · ${unitLabelOf(series.unit)}`;
          return { id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(latest?.value, { divisor: 1, label: "", decimals: series.decimals }),
            heading: headingYear ? `${heading} · ${headingYear}` : heading };
        })}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeSocialPlaceSelection(s, set, place.id, selectedIds, shown), true)} searchable={false}
        downloadAction={<ExcelDownloadButton testId="social-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildSocialWorkbookExportModel({
            set, placeId: place.id, scope: workbookScope, facts, state, extras: { population, cpi }, labels, headingLabels,
            sources, populationSources, cpiSources, gdpSources: [], siteOrigin, title: `${title} ${placeName}`,
          }, presentation));
        }} />} />} />
  </div>;
}
