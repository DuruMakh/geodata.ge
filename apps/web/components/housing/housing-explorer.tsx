"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientHousingFact } from "../../lib/data/housing/types";
import { buildHousingModel, changeHousingSelection, housingCount, housingCoverage, housingSeriesLabel, housingTopicSeries, housingUnitLabel, housingValueLabel, housingValueUnit, parseHousingHash, serializeHousingHash, type HousingSeriesModel, type HousingTopicId, type HousingTranslate } from "../../lib/explorer/housing";
import { buildHousingWorkbookExportModel } from "../../lib/explorer/housingWorkbook";
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
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SourceNote } from "../ui/editorial";

type HousingHashData = { section: HousingTopicId; facts: ClientHousingFact[] };
const parseHousingState = (hash: string, data: HousingHashData) => parseHousingHash(hash, data.section, data.facts);

/** The headline series: the number of objects (with their floor area beside it) or the price index. */
const LATEST_ID: Record<HousingTopicId, string> = { permits: "housing.permits_count.total", completed: "housing.completed_count.total", prices: "housing.price_index.total" };

export type HousingExplorerProps = {
  section: HousingTopicId; facts: ClientHousingFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

/** A Housing topic page (Building permits, Completed buildings, Home prices): the chart or table, the one series list and Excel, as on Business. */
export function HousingExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin }: HousingExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t: HousingTranslate = (key, values) => message(messages, `housing.${key}`, values);
  const data = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(data, parseHousingState, serializeHousingHash);
  const [query, setQuery] = useState("");
  const model = buildHousingModel(section, facts, state);
  // The chart shows one unit, the selection's; each list row reads in its own unit, named by its heading.
  const unit = housingValueUnit(model.unit);
  const unitLabel = housingUnitLabel(model.unit, t);
  const valueLabel = (value: number | null | undefined) => housingValueLabel(value, model.unit, t);
  // A Tbilisi district is listed under flats and under houses with one name; outside the list it carries its heading (as in the workbook).
  const fullLabel = (series: HousingSeriesModel) => housingSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  // A district's house row wears its flat row's colour and a dashed stroke.
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]), dashed: series.stroke === "dashed" }));
  // The table's total is the reference of the selection's unit: all buildings by number or by floor area, or the price index.
  const reference = model.series.find(series => series.reference && series.unit === model.unit);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  // The latest-value line is the page's headline, whatever the list shows.
  const latestOf = (id: string) => facts.filter(f => f.indicatorId === id).sort((a, b) => a.year - b.year).at(-1)!;
  const latest = latestOf(LATEST_ID[section]);
  const latestValue = section === "prices" ? formatInUnit(latest.value, housingValueUnit("index")) : housingCount(latest.value);
  const title = t(`page.${section}.title`);
  const downloadAction = <ExcelDownloadButton testId="housing-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildHousingWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t(`sourceNote.${section}`)} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid={`housing-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="housing-latest" measure={t(`latest.${section}`)} period={section === "prices" ? t("latestPeriod.prices", { year: latest.year }) : latest.year} value={latestValue} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="housing-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5">{chart}</div>
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={housingCoverage(section, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildHousingModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t(`sourceNote.${section}`)} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/housing", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Every row is listed from the start under a heading that names its unit, so the caption gives the year only. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, housingValueUnit(series.unit)), heading: t(`heading.${series.heading}`) }))}
        totalId={model.series.find(series => series.reference)?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeHousingSelection(s, housingTopicSeries(section), selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS} />
    </ExplorerWorkspace>
  </div>;
}
