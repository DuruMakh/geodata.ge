"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { ClientTransportFact } from "../../lib/data/transport/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { transportLatestValue, transportSeriesLabel, transportUnitLabel, transportValueLabel, transportValueUnit, serializeTransportHash, type TransportSeriesModel, type TransportTranslate } from "../../lib/explorer/transport";
import { TRANSPORT_REGIONS_HREF, buildTransportAreaModel, changeTransportAreaSelection, transportAreaCoverage, transportAreaLatest, transportAreaOfMapId, transportAreaSelectionHash, transportMapId, transportRegionHref, parseTransportAreaHash, type TransportArea } from "../../lib/explorer/transportAreas";
import { buildTransportWorkbookExportModel } from "../../lib/explorer/transportWorkbook";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionPicker, useRefocusAfterPick } from "../regional-economies/region-picker";
import { Callout, SourceNote } from "../ui/editorial";

export type TransportAreaExplorerProps = {
  area: TransportArea; facts: ClientTransportFact[];
  /** Names of the area's series; areaLabels names Georgia and the regions. */
  labels: Record<string, string>; areaLabels: Record<TransportArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string;
  /** The areas offered by the picker and previous/next links, Georgia first, with the map's ids. */
  areas: readonly MunicipalRegion[];
};

/** An area's page: Georgia's or a region's registered vehicles and roads, with the area picker in the heading, as on Housing. */
export function TransportAreaExplorer({ area, facts, labels, areaLabels, sources, lastReviewedAt, siteOrigin, areas }: TransportAreaExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t: TransportTranslate = (key, values) => message(messages, `transport.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientTransportFact[]) => parseTransportAreaHash(hash, area, f), [area]);
  const { state, update } = useHashState(facts, parse, serializeTransportHash);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId();
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  useRefocusAfterPick(pickerTrigger, "region-picker-trigger");
  const model = buildTransportAreaModel(area, facts, state);
  // The chart shows one unit, the selection's: thousand vehicles or km of road; each list row reads in its own unit, named by its heading.
  const unit = transportValueUnit(model.unit);
  const unitLabel = transportUnitLabel(model.unit, t);
  const valueLabel = (value: number | null | undefined) => transportValueLabel(value, model.unit, t);
  const fullLabel = (series: TransportSeriesModel) => transportSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // The table's total is the reference of the selection's unit: all registered vehicles or all roads.
  const reference = model.series.find(series => series.reference && series.unit === model.unit);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  // The latest-value line is the page's headline: its own area's registered vehicles, whatever is chosen below.
  const latest = transportAreaLatest(area, facts);
  const areaName = areaLabels[area];
  const title = t("page.area.regionTitle", { region: areaName });
  // The chart is named after the heading of the selection's unit (its text before the unit).
  const chartLabel = `${t(`heading.${model.unit === "km" ? "roads" : "registered"}`).split(" · ")[0]} · ${areaName}`;
  // Links to another area's page carry the selection, moved to that area, and nothing else.
  const areaHref = (id: string) => `${transportRegionHref(id)}${transportAreaSelectionHash(state.selectedIds, transportAreaOfMapId(id))}`;
  const index = areas.findIndex(item => item.id === transportMapId(area));
  const neighbours = { previous: areas[(index - 1 + areas.length) % areas.length]!, next: areas[(index + 1) % areas.length]! };
  const nameOf = (id: string) => areaLabels[transportAreaOfMapId(id)];
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t("sourceNoteRegions")} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid={`transport-area-${area}`} className="@container">
    <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t("page.area.regionHeadingLead")}{" "}
          <button ref={pickerTrigger} type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} aria-haspopup="dialog" aria-controls={pickerOpen ? pickerId : undefined} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {areaName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker id={pickerId} open={pickerOpen} onClose={() => setPickerOpen(false)} regions={areas} activeRegionId={transportMapId(area)} hrefForRegion={areaHref} indexHref={TRANSPORT_REGIONS_HREF} />
      </div>
      <EntityNeighbourLinks testId="transport-region-navigation" className="mb-3"
        previous={{ href: pageHref(areaHref(neighbours.previous.id), locale), label: nameOf(neighbours.previous.id) }}
        next={{ href: pageHref(areaHref(neighbours.next.id), locale), label: nameOf(neighbours.next.id) }} />
    </div>
    <LatestValueLine testId="transport-latest" measure={t("latest.area")} period={latest.year} value={transportLatestValue(latest.value, "thousand", t)} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={area} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="transport-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : <><ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} crawlCopy={state.mode === "line"} />{state.mode === "line" ? <div className="mt-5">{chart}</div> : null}</>}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={transportAreaCoverage(area, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildTransportAreaModel(area, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t("sourceNoteRegions")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/transport", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Registered vehicles by type, fuel, age and owner, and roads, each sit under a heading that names its unit, so the caption gives the year only. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, transportValueUnit(series.unit)), heading: t(`heading.${series.heading}`) }))}
        totalId={model.series.find(series => series.reference)?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeTransportAreaSelection(area, s, selectedIds, facts), true)} searchable={false}
        downloadAction={<ExcelDownloadButton testId="transport-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildTransportWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin, title }, presentation));
        }} />} />
    </ExplorerWorkspace>
  </div>;
}
