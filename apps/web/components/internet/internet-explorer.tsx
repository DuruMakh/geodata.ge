"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientInternetFact } from "../../lib/data/internet/types";
import { INTERNET_PERCENT, buildInternetModel, changeInternetSelection, internetCoverage, internetPercent, internetSeriesLabel, parseInternetHash, serializeInternetHash, type InternetSeriesModel, type InternetTopicId, type InternetTranslate } from "../../lib/explorer/internet";
import { buildInternetWorkbookExportModel } from "../../lib/explorer/internetWorkbook";
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
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SourceNote } from "../ui/editorial";

type InternetHashData = { section: InternetTopicId; facts: ClientInternetFact[] };
const parseInternetState = (hash: string, data: InternetHashData) => parseInternetHash(hash, data.section, data.facts);
const valueLabel = (value: number | null | undefined) => value == null ? MISSING : internetPercent(value);

export type InternetExplorerProps = {
  section: InternetTopicId; facts: ClientInternetFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

/** An Internet and technology topic page (Users, Shopping and services online, Phones and computers): the chart or table, the one series list and Excel, as on Housing. */
export function InternetExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin }: InternetExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t: InternetTranslate = (key, values) => message(messages, `internet.${key}`, values);
  const data = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(data, parseInternetState, serializeInternetHash);
  const [query, setQuery] = useState("");
  const model = buildInternetModel(section, facts, state);
  // A group's name repeats under every heading; outside the list it carries its heading (as in the workbook).
  const fullLabel = (series: InternetSeriesModel) => internetSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // The chart shows one heading, the selection's; its total is that heading's Everyone row.
  const heading = model.selected[0]?.heading;
  const total = rows.find(row => row.itemId === model.series.find(series => series.reference && series.heading === heading)?.id) ?? null;
  const title = t(`page.${section}.title`);
  const chartLabel = heading ? t(`heading.${heading}`).split(" · ")[0] : title;
  // The latest-value line is the page's headline (its default series), whatever the list shows.
  const latest = facts.filter(f => f.indicatorId === model.series[0].id).sort((a, b) => a.year - b.year).at(-1)!;
  const unitLabel = t("unitPercent");
  const downloadAction = <ExcelDownloadButton testId="internet-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildInternetWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`internet-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="internet-latest" sentence={<Message messages={messages} id={`internet.latest.${section}`} values={{ year: latest.year, value: <LatestFigure value={internetPercent(latest.value)} /> }} />} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-heading={heading ?? ""} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="internet-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={INTERNET_PERCENT} shareLabel={chartLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={INTERNET_PERCENT} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={INTERNET_PERCENT} formatValue={valueLabel} />
          <RangeStrip years={internetCoverage(section, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildInternetModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(`sourceNote.${section}`)} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/internet", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Every row is listed from the start under a heading that names its measure and who it counts, so the caption gives the year only. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, INTERNET_PERCENT), heading: t(`heading.${series.heading}`) }))}
        totalId={model.series[0].id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeInternetSelection(section, s, selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS} />
    </ExplorerWorkspace>
  </div>;
}
