"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { ClientInternetFact } from "../../lib/data/internet/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { INTERNET_PERCENT, internetPercent, internetSeriesLabel, serializeInternetHash, type InternetSeriesModel, type InternetTranslate } from "../../lib/explorer/internet";
import { INTERNET_HOMES_HREF, buildInternetAreaModel, changeInternetAreaSelection, internetAreaCoverage, internetAreaLatest, internetAreaOfMapId, internetAreaSelectionHash, internetMapId, internetRegionHref, parseInternetAreaHash, type InternetArea } from "../../lib/explorer/internetAreas";
import { buildInternetWorkbookExportModel } from "../../lib/explorer/internetWorkbook";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { MISSING, formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionPicker, useRefocusAfterPick } from "../regional-economies/region-picker";
import { Callout, SourceNote } from "../ui/editorial";

const valueLabel = (value: number | null | undefined) => value == null ? MISSING : internetPercent(value);

export type InternetAreaExplorerProps = {
  area: InternetArea; facts: ClientInternetFact[];
  /** Names of the area's series; areaLabels names Georgia and the regions. */
  labels: Record<string, string>; areaLabels: Record<InternetArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string;
  /** The areas offered by the picker and previous/next links, Georgia first, with the map's ids. */
  areas: readonly MunicipalRegion[];
};

/** An area's page: Georgia's or a region's homes with internet and with a computer, with the area picker in the heading, as on Housing. */
export function InternetAreaExplorer({ area, facts, labels, areaLabels, sources, lastReviewedAt, siteOrigin, areas }: InternetAreaExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t: InternetTranslate = (key, values) => message(messages, `internet.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientInternetFact[]) => parseInternetAreaHash(hash, area, f), [area]);
  const { state, update } = useHashState(facts, parse, serializeInternetHash);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId();
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  useRefocusAfterPick(pickerTrigger, "region-picker-trigger");
  const model = buildInternetAreaModel(area, facts, state);
  const unitLabel = t("unitPercent");
  // Georgia's towns and villages are listed under internet and under computer; outside the list a row carries its heading (as in the workbook).
  const fullLabel = (series: InternetSeriesModel) => internetSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  // A computer row wears its internet row's colour and a dashed stroke.
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]), dashed: series.stroke === "dashed" }));
  // The table's total is the area's own homes with internet.
  const total = rows.find(row => row.itemId === model.series[0].id) ?? null;
  // The latest-value line is the page's headline: its own area's homes with internet, whatever is chosen below.
  const latest = internetAreaLatest(area, facts);
  const areaName = areaLabels[area];
  const title = t("page.area.regionTitle", { region: areaName });
  const chartLabel = `${t("heading.homes").split(" · ")[0]} · ${areaName}`;
  // Links to another area's page carry the selection, moved to that area, and nothing else.
  const areaHref = (id: string) => `${internetRegionHref(id)}${internetAreaSelectionHash(state.selectedIds, internetAreaOfMapId(id))}`;
  const index = areas.findIndex(item => item.id === internetMapId(area));
  const neighbours = { previous: areas[(index - 1 + areas.length) % areas.length]!, next: areas[(index + 1) % areas.length]! };
  const nameOf = (id: string) => areaLabels[internetAreaOfMapId(id)];
  return <div data-testid={`internet-area-${area}`} className="@container">
    <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t("page.area.regionHeadingLead")}{" "}
          <button ref={pickerTrigger} type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} aria-haspopup="dialog" aria-controls={pickerOpen ? pickerId : undefined} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {areaName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker id={pickerId} open={pickerOpen} onClose={() => setPickerOpen(false)} regions={areas} activeRegionId={internetMapId(area)} hrefForRegion={areaHref} indexHref={INTERNET_HOMES_HREF} />
      </div>
      <EntityNeighbourLinks testId="internet-region-navigation" className="mb-3"
        previous={{ href: pageHref(areaHref(neighbours.previous.id), locale), label: nameOf(neighbours.previous.id) }}
        next={{ href: pageHref(areaHref(neighbours.next.id), locale), label: nameOf(neighbours.next.id) }} />
    </div>
    <LatestValueLine testId="internet-latest" sentence={<Message messages={messages} id="internet.latest.homes" values={{ year: latest.year, value: <LatestFigure value={internetPercent(latest.value)} /> }} />} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={area} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="internet-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={INTERNET_PERCENT} shareLabel={chartLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={INTERNET_PERCENT} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={INTERNET_PERCENT} formatValue={valueLabel} />
          <RangeStrip years={internetAreaCoverage(area, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildInternetAreaModel(area, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNoteHomes")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/internet", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Every row is a share of homes, under a heading that names it, so the caption gives the year only. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, INTERNET_PERCENT), heading: t(`heading.${series.heading}`) }))}
        totalId={model.series[0].id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeInternetAreaSelection(area, s, selectedIds, facts), true)} searchable={false}
        downloadAction={<ExcelDownloadButton testId="internet-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildInternetWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin, title }, presentation));
        }} />} />
    </ExplorerWorkspace>
  </div>;
}
