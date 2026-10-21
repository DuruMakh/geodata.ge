"use client";
import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import type { ClientEducationFact } from "../../lib/data/education/types";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { educationFullLabel, educationPeriodLabel, serializeEducationHash } from "../../lib/explorer/education";
import {
  buildEducationPlaceModel, changeEducationPlaceSelection, educationPlaceCoverage, educationPlaceLinkHash, educationPlaceList, parseEducationPlaceHash, type EducationPlaceSet,
} from "../../lib/explorer/educationPlaces";
import { buildEducationWorkbookExportModel } from "../../lib/explorer/educationWorkbook";
import { formatInUnit, thousandsUnit, UNIT_PERSONS, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
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
import { EntityHeading } from "../municipalities/entity-heading";
import type { EntityPickerCountry, EntityPickerGroup, EntityPickerOverrides } from "../municipalities/entity-picker";
import { EntityWorkspaceShell } from "../municipalities/entity-workspace-shell";
import { Callout, SourceNote } from "../ui/editorial";

/** A neighbour's page: its place id, so the link can carry the selection moved to it. */
type Neighbour = { id: string; label: string; href: string };

export type EducationPlaceExplorerProps = {
  set: EducationPlaceSet;
  place: DemographyPlace;
  /** This place's served facts only. */
  facts: ClientEducationFact[];
  /** A name for every series the place lists, and for each heading (measure) they sit under. */
  labels: Record<string, string>;
  headingLabels: Record<string, string>;
  /** The heading's lead before the place picker ("Schools —"). */
  title: string;
  /** The one line under the heading: the place's latest figure, as a sentence. */
  metaLine: ReactNode;
  navigation?: { prev: Neighbour; next: Neighbour };
  pickerCountry: EntityPickerCountry;
  pickerGroups: EntityPickerGroup[];
  pickerOverrides: EntityPickerOverrides & { hrefById: Readonly<Record<string, string>> };
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  /** The place named in the Excel file (`guria`, `ozurgeti`, `georgia`). */
  workbookScope: string;
  lastReviewedAt: string;
  /** Below the source line: a region's list of its municipalities. */
  children?: ReactNode;
};

/**
 * A Schools or Kindergartens place page: the Population place heading (picker, previous/next) and two-column shell around
 * the Business area workspace (chart or table, years, the series list under its headings, Excel). One heading is charted
 * at a time; the picker and previous/next carry the selection, moved to the place they open.
 */
export function EducationPlaceExplorer({
  set, place, facts, labels, headingLabels, title, metaLine, navigation, pickerCountry, pickerGroups, pickerOverrides, sources, siteOrigin, workbookScope, lastReviewedAt, children,
}: EducationPlaceExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `education.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientEducationFact[]) => parseEducationPlaceHash(hash, set, place.id, f), [set, place.id]);
  const { state, update } = useHashState(facts, parse, serializeEducationHash);
  const model = buildEducationPlaceModel(set, place.id, facts, state);
  // The list reads at the chosen years' end over all of the place's years, each row its latest value up to then (`buildEducationList`).
  const list = educationPlaceList(set, place.id, facts, state);
  const period = educationPeriodLabel(set);
  // Counts are whole numbers; Georgia's pupils are Geostat's thousands to one decimal (the client holds whole persons).
  const inThousands = (series: { decimals: number }) => series.decimals === 1;
  const valueUnit = (series: { decimals: number }): ValueUnit => inThousands(series) ? thousandsUnit(locale) : UNIT_PERSONS;
  const lead = model.selected[0] ?? model.series[0]!;
  const unit = valueUnit(lead);
  const unitLabel = t(inThousands(lead) ? "unitThousandPupils" : model.unit === "institutions" ? "unitInstitutions" : "unitPersons");
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${formatInUnit(value, unit)} ${unitLabel}`;
  // Outside the list a row is named in full, "Teachers — Women"; a heading's total that bears the heading's name keeps it alone.
  const fullLabel = (series: { id: string; heading: string }) => educationFullLabel(headingLabels[series.heading], labels[series.id]);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // The selection's heading total, when ticked, leads the table.
  const total = rows.find(row => row.itemId.endsWith(".total")) ?? null;
  const reference = model.series.find(series => series.reference);
  const placeName = placeLabel(place, locale);
  const chartLabel = `${headingLabels[model.heading]} · ${placeName}`;
  // Links to another place's page carry the mode, the years and the selection, moved to that place (its parse refits the years).
  const withState = (href: string, placeId: string) => `${href}${educationPlaceLinkHash(state, set, placeId)}`;
  const overrides = { ...pickerOverrides, hrefById: Object.fromEntries(Object.entries(pickerOverrides.hrefById).map(([id, href]) => [id, withState(href, id)])) };
  const neighbours = navigation && {
    prev: { label: navigation.prev.label, href: withState(navigation.prev.href, navigation.prev.id) },
    next: { label: navigation.next.label, href: withState(navigation.next.href, navigation.next.id) },
  };
  return <div data-testid={`education-place-${set}`}>
    <EntityHeading title={title} triggerLabel={placeName} metaLine={<LatestValueLine testId="education-latest" sentence={metaLine} />} entityId={place.id}
      navigation={neighbours} pickerCountry={pickerCountry} pickerGroups={pickerGroups} pickerOverrides={overrides} />
    <EntityWorkspaceShell testId="education-place-workspace" asideLabel={message(messages, "controls.series")}
      main={<>
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-heading={model.heading}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="education-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} formatPeriod={period} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${period(model.range.start)}–${period(model.range.end)}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} yearLabel={period} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={educationPlaceCoverage(set, place.id, facts, state.selectedIds).years} range={model.range} formatPeriod={period}
            onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildEducationPlaceModel(set, place.id, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(`sourceNote.${set}`)} · {unitLabel} · {period(model.range.start)}–{period(model.range.end)} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/education", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
        {children}
      </>}
      aside={<FlatSeriesPanel caption={period(list.end)}
        rows={model.series.map(series => {
          const { latest, headingYear } = list.rows[series.id]!;
          const heading = inThousands(series) ? `${headingLabels[series.heading]} · ${t("unitThousandPupils")}` : headingLabels[series.heading];
          return { id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(latest?.value, valueUnit(series)),
            heading: headingYear ? `${heading} · ${period(headingYear)}` : heading };
        })}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeEducationPlaceSelection(s, set, place.id, selectedIds, facts), true)} searchable={false}
        downloadAction={<ExcelDownloadButton testId="education-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildEducationWorkbookExportModel({ set, placeId: place.id, scope: workbookScope, facts, state, labels, headingLabels, sources, siteOrigin, title: `${title} ${placeName}` }, presentation));
        }} />} />} />
  </div>;
}
