"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { ClientScienceCultureFact } from "../../lib/data/scienceCulture/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { scienceCultureSeriesLabel, scienceCultureValueLabel, scienceCultureValueUnit, serializeScienceCultureHash, type ScienceCultureSeriesModel } from "../../lib/explorer/scienceCulture";
import {
  MUSEUMS_HREF, buildMuseumAreaModel, changeMuseumAreaSelection, museumAreaCoverage, museumAreaLatest, museumAreaOfMapId, museumAreaSelectionHash, museumMapId, museumRegionHref, parseMuseumAreaHash, type MuseumArea,
} from "../../lib/explorer/scienceCultureMuseums";
import { buildScienceCultureWorkbookExportModel } from "../../lib/explorer/scienceCultureWorkbook";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { Message } from "../../lib/i18n/message";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionPicker, useRefocusAfterPick } from "../regional-economies/region-picker";
import { Callout, SourceNote } from "../ui/editorial";

export type MuseumAreaExplorerProps = {
  area: MuseumArea; facts: ClientScienceCultureFact[];
  /** Names of the area's series; areaLabels names Georgia and the regions. */
  labels: Record<string, string>; areaLabels: Record<MuseumArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string;
  /** The areas offered by the picker and previous/next links, Georgia first, with the map's ids. */
  areas: readonly MunicipalRegion[];
};

/** A museum area's page: Georgia's or a region's visitors, group tours, exhibitions and museums, with the area picker in the heading, as on Housing. */
export function MuseumAreaExplorer({ area, facts, labels, areaLabels, sources, lastReviewedAt, siteOrigin, areas }: MuseumAreaExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `scienceCulture.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientScienceCultureFact[]) => parseMuseumAreaHash(hash, area, f), [area]);
  const { state, update } = useHashState(facts, parse, serializeScienceCultureHash);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId();
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  useRefocusAfterPick(pickerTrigger, "region-picker-trigger");
  const model = buildMuseumAreaModel(area, facts, state);
  // The chart shows one unit, the selection's; each list row reads in its own unit, named by its heading.
  const unit = scienceCultureValueUnit(model.unit);
  const unitLabel = t(`unit.${model.unit}`);
  const valueLabel = (value: number | null | undefined) => scienceCultureValueLabel(value, model.unit, t);
  // Outside the list a row carries its heading ("Museums — Art"); a row named as its heading keeps its own name ("Visitors").
  const fullLabel = (series: ScienceCultureSeriesModel) => scienceCultureSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // The table's total is the visitors row when the selection is in thousands.
  const reference = model.series.find(series => series.reference && series.unit === model.unit);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  // The latest-value line is the page's headline: its own area's visitors, whatever is chosen below.
  const headline = model.series.find(series => series.reference)!;
  const latest = museumAreaLatest(area, facts);
  const areaName = areaLabels[area];
  const title = t("page.area.regionTitle", { region: areaName });
  // The chart is named after the heading of the selection's first row (its text before the unit) and the area.
  const chartLabel = `${t(`heading.${(model.selected[0] ?? headline).heading}`).split(" · ")[0]} · ${areaName}`;
  // Links to another area's page carry the selection, moved to that area, and nothing else.
  const areaHref = (id: string) => `${museumRegionHref(id)}${museumAreaSelectionHash(state.selectedIds, museumAreaOfMapId(id))}`;
  const index = areas.findIndex(item => item.id === museumMapId(area));
  const neighbours = { previous: areas[(index - 1 + areas.length) % areas.length]!, next: areas[(index + 1) % areas.length]! };
  const nameOf = (id: string) => areaLabels[museumAreaOfMapId(id)];
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t("sourceNoteMuseums")} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid={`science-culture-museums-${area}`} className="@container">
    <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t("page.area.regionHeadingLead")}{" "}
          <button ref={pickerTrigger} type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} aria-haspopup="dialog" aria-controls={pickerOpen ? pickerId : undefined} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {areaName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker id={pickerId} open={pickerOpen} onClose={() => setPickerOpen(false)} regions={areas} activeRegionId={museumMapId(area)} hrefForRegion={areaHref} indexHref={MUSEUMS_HREF} />
      </div>
      <EntityNeighbourLinks testId="science-culture-region-navigation" className="mb-3"
        previous={{ href: pageHref(areaHref(neighbours.previous.id), locale), label: nameOf(neighbours.previous.id) }}
        next={{ href: pageHref(areaHref(neighbours.next.id), locale), label: nameOf(neighbours.next.id) }} />
    </div>
    {/* The heading names the area, so the line does not repeat it. */}
    <LatestValueLine testId="science-culture-latest" sentence={<Message messages={messages} id="scienceCulture.latest.area"
      values={{ period: latest.year, value: <LatestFigure value={formatInUnit(latest.value, scienceCultureValueUnit(latest.unit))} /> }} />} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={area} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="science-culture-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : <><ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} crawlCopy={state.mode === "line"} />{state.mode === "line" ? <div className="mt-5">{chart}</div> : null}</>}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={museumAreaCoverage(area, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildMuseumAreaModel(area, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t("sourceNoteMuseums")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/science-culture", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Each heading names its unit where it is not a count, so the caption gives the year only. Georgia's list (18 rows) is searchable. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, scienceCultureValueUnit(series.unit)), heading: t(`heading.${series.heading}`) }))}
        totalId={headline.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeMuseumAreaSelection(area, s, selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        downloadAction={<ExcelDownloadButton testId="science-culture-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildScienceCultureWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin, title }, presentation));
        }} />} />
    </ExplorerWorkspace>
  </div>;
}
