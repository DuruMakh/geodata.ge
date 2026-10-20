"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientScienceCultureFact, ScienceCultureSeriesBreak } from "../../lib/data/scienceCulture/types";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import {
  buildScienceCultureModel, changeScienceCultureSelection, parseScienceCultureHash, scienceCultureCoverage, scienceCultureSeriesLabel, scienceCultureTopicSeries,
  scienceCultureValueLabel, scienceCultureValueUnit, serializeScienceCultureHash, type ScienceCultureSeriesModel, type ScienceCultureTopicId,
} from "../../lib/explorer/scienceCulture";
import { buildScienceCultureWorkbookExportModel } from "../../lib/explorer/scienceCultureWorkbook";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { Message } from "../../lib/i18n/message";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
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

type ScienceCultureHashData = { section: ScienceCultureTopicId; facts: ClientScienceCultureFact[] };
const parseScienceCultureState = (hash: string, data: ScienceCultureHashData) => parseScienceCultureHash(hash, data.section, data.facts);

export type ScienceCultureExplorerProps = {
  section: ScienceCultureTopicId; facts: ClientScienceCultureFact[];
  /** The counting changes that touch the page's series; the model draws those inside the range that touch a selected one. */
  breaks: ScienceCultureSeriesBreak[];
  labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

/** A Science and culture topic page (Research, Patents, Theatres): the chart or table, the one series list and Excel, as on Housing. */
export function ScienceCultureExplorer({ section, facts, breaks, labels, sources, lastReviewedAt, siteOrigin }: ScienceCultureExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string) => message(messages, `scienceCulture.${key}`);
  const data = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(data, parseScienceCultureState, serializeScienceCultureHash);
  const [query, setQuery] = useState("");
  const model = buildScienceCultureModel(section, facts, state, breaks);
  // The chart shows one unit, the selection's; each list row reads in its own unit, named by its heading.
  const unit = scienceCultureValueUnit(model.unit);
  const unitLabel = t(`unit.${model.unit}`);
  const valueLabel = (value: number | null | undefined) => scienceCultureValueLabel(value, model.unit, t);
  // Outside the list a row carries its heading: "Invention patents granted — Foreign".
  const fullLabel = (series: ScienceCultureSeriesModel) => scienceCultureSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // The table's total is the page's reference (its first row) when it is of the selection's unit.
  const reference = model.series.find(series => series.reference && series.unit === model.unit);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  const newCounting = t("break.newCounting");
  // The latest-value line is the page's headline, its default row, whatever the list shows.
  const headline = model.series.find(series => series.reference)!;
  const latest = facts.filter(f => f.indicatorId === headline.id).sort((a, b) => a.year - b.year).at(-1)!;
  const title = t(`page.${section}.title`);
  const downloadAction = <ExcelDownloadButton testId="science-culture-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildScienceCultureWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`science-culture-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="science-culture-latest" sentence={<Message messages={messages} id={`scienceCulture.latest.${section}`}
      values={{ period: latest.year, value: <LatestFigure value={formatInUnit(latest.value, scienceCultureValueUnit(latest.unit))} /> }} />} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="science-culture-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} breaks={model.breaks.map(item => ({ year: item.year, label: newCounting }))} /></div>
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null}
              breakYears={model.breaks.map(item => item.year)} breakLabel={newCounting} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={scienceCultureCoverage(section, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildScienceCultureModel(section, facts, s, breaks).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(`sourceNote.${section}`)} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/science-culture", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Every row is listed from the start under its heading; a heading with a unit other than a count names it, so the caption gives the year only. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, scienceCultureValueUnit(series.unit)), heading: t(`heading.${series.heading}`) }))}
        totalId={headline.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeScienceCultureSelection(s, scienceCultureTopicSeries(section), selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS} />
    </ExplorerWorkspace>
  </div>;
}
