"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientTransportFact } from "../../lib/data/transport/types";
import { buildTransportModel, changeTransportSelection, transportCoverage, transportLatestValue, transportSeriesLabel, transportTopicSeries, transportUnitLabel, transportValueLabel, transportValueUnit, parseTransportHash, serializeTransportHash, type TransportSeriesModel, type TransportTopicId, type TransportTranslate } from "../../lib/explorer/transport";
import { buildTransportWorkbookExportModel } from "../../lib/explorer/transportWorkbook";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SourceNote } from "../ui/editorial";

type TransportHashData = { section: TransportTopicId; facts: ClientTransportFact[] };
const parseTransportState = (hash: string, data: TransportHashData) => parseTransportHash(hash, data.section, data.facts);

/** The headline series: passenger cars, cars over 10 years old, all passenger-km or all tonne-km. */
const LATEST_ID: Record<TransportTopicId, string> = {
  vehicles: "transport.fleet.cars", "vehicle-age": "transport.fleet.cars_age_over_10", passengers: "transport.passenger_km.total", freight: "transport.tonne_km.total",
};

export type TransportExplorerProps = {
  section: TransportTopicId; facts: ClientTransportFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

/** A Transport topic page (Vehicles, Vehicle age, Passengers, Freight): the chart or table, the one series list and Excel, as on Housing. */
export function TransportExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin }: TransportExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t: TransportTranslate = (key, values) => message(messages, `transport.${key}`, values);
  const data = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(data, parseTransportState, serializeTransportHash);
  const [query, setQuery] = useState("");
  const model = buildTransportModel(section, facts, state);
  // The chart shows one unit, the selection's; each list row reads in its own unit, named by its heading.
  const unit = transportValueUnit(model.unit);
  const unitLabel = transportUnitLabel(model.unit, t);
  const valueLabel = (value: number | null | undefined) => transportValueLabel(value, model.unit, t);
  // A fuel or age row is listed under each vehicle type with one name; outside the list it carries its heading (as in the workbook).
  const fullLabel = (series: TransportSeriesModel) => transportSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // The table's total is the reference of the selection's unit, where the page has one: all passenger-km, per person or all tonne-km.
  const reference = model.series.find(series => series.reference && series.unit === model.unit);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  // The latest-value line is the page's headline, whatever the list shows.
  const latestOf = (id: string) => facts.filter(f => f.indicatorId === id).sort((a, b) => a.year - b.year).at(-1)!;
  const latest = latestOf(LATEST_ID[section]);
  const title = t(`page.${section}.title`);
  const downloadAction = <ExcelDownloadButton testId="transport-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildTransportWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`transport-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="transport-latest" measure={t(`latest.${section}`)} period={latest.year} value={transportLatestValue(latest.value, section === "vehicles" || section === "vehicle-age" ? "million" : "billion", t)} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="transport-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={transportCoverage(section, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildTransportModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(`sourceNote.${section}`)} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/transport", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Every row is listed from the start under a heading that names its unit, so the caption gives the year only. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, transportValueUnit(series.unit)), heading: t(`heading.${series.heading}`) }))}
        totalId={model.series.find(series => series.reference)?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeTransportSelection(s, transportTopicSeries(section), selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS} />
    </ExplorerWorkspace>
  </div>;
}
