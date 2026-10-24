"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientBusinessFact } from "../../lib/data/business/types";
import { buildBusinessModel, businessCoverage, businessHeadingLabel, businessTopicSeries, changeBusinessSelection, parseBusinessHash, serializeBusinessHash, type BusinessTopicId, type BusinessUnit } from "../../lib/explorer/business";
import { buildBusinessWorkbookExportModel } from "../../lib/explorer/businessWorkbook";
import { formatAmount, formatInUnit, thousandsUnit, unitsFor, type ValueUnit } from "../../lib/explorer/format";
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

type BusinessHashData = { section: BusinessTopicId; facts: ClientBusinessFact[] };
const parseBusinessState = (hash: string, data: BusinessHashData) => parseBusinessHash(hash, data.section, data.facts);

/** The firms headline: each total's latest count. The line keeps it whatever the list shows. */
const LATEST_ID: Record<BusinessTopicId, string> = { sales: "business.turnover.total", jobs: "business.employed.total", "investment-profit": "business.investment.total", firms: "business.births.total" };

export type BusinessExplorerProps = {
  section: BusinessTopicId; facts: ClientBusinessFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

/** A Business topic page (Sales, Jobs, Investment and profit, Firms): the chart or table, the series list and Excel, as on Money and banks. */
export function BusinessExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin }: BusinessExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `business.${key}`, values);
  const data = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(data, parseBusinessState, serializeBusinessHash);
  const [query, setQuery] = useState("");
  const model = buildBusinessModel(section, facts, state);
  // The chart shows one unit, the selection's: amounts in million GEL to one decimal (as Geostat prints them), people in
  // thousands, firms as whole numbers and rates in percent to one decimal. Each list row reads in its own unit.
  const percent = model.unit === "percent";
  const mln: ValueUnit = { ...unitsFor(locale).mln, decimals: 1 };
  const valueUnit = (unit: BusinessUnit): ValueUnit => unit === "gel" ? mln
    : unit === "persons" ? thousandsUnit(locale) : { divisor: 1, label: unit === "percent" ? t("unitPercent") : "", decimals: unit === "percent" ? 1 : 0 };
  const unit = valueUnit(model.unit);
  const unitLabels: Record<BusinessUnit, string> = { gel: message(messages, "format.mlnGel"), persons: t("unitThousandPeople"), enterprises: t("unitFirms"), percent: t("unitPercent") };
  const unitLabel = unitLabels[model.unit];
  // A list that mixes units (Firms' counts and rates) names each unit in its heading, so its caption gives the year only.
  const mixedUnits = new Set(model.series.map(series => series.unit)).size > 1;
  const format = (value: number | null | undefined) => formatInUnit(value, unit);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : percent ? `${format(value)}${unitLabel}` : `${format(value)} ${unitLabel}`;
  // Outside the list, a nested series carries its parent's name (as in the workbook): Construction under profit and under loss stay apart.
  const fullLabel = (series: { id: string; parentId?: string }) => series.parentId ? `${labels[series.parentId]} — ${labels[series.id]}` : labels[series.id];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  // Each parent's children keep their industry colours and take the parent's stroke, so the same industry under two parents reads apart.
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]), dashed: series.stroke === "dashed", dotted: series.stroke === "dotted" }));
  const reference = model.series.find(series => series.reference);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  // The latest-value line is the page's headline, whatever the list shows: firms' sales, people employed, investment, or new firms with the closed beside them.
  // Its amount reads as the site's amounts do: billion GEL to one decimal from a billion, million GEL below.
  const latestOf = (id: string) => facts.filter(f => f.indicatorId === id).sort((a, b) => a.year - b.year).at(-1)!;
  const latest = latestOf(LATEST_ID[section]);
  const count = (value: number) => formatInUnit(value, { divisor: 1, label: "", decimals: 0 });
  const latestValue = section === "jobs" ? `${formatInUnit(latest.value, { divisor: 1_000, label: "", decimals: 1 })} ${t("unitThousandPersons")}` : section === "firms" ? count(latest.value) : formatAmount(latest.value, locale);
  const closed = section === "firms" ? facts.find(f => f.indicatorId === "business.deaths.total" && f.year === latest.year) : undefined;
  const title = t(`page.${section}.title`);
  const chartLabel = percent ? t("measure.rate") : title;
  const downloadAction = <ExcelDownloadButton testId="business-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildBusinessWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={percent} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t("sourceNote")} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid={`business-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="business-latest" measure={t(`latest.${section}`)} period={latest.year} value={latestValue} note={closed ? t("latestNote.firms", { value: count(closed.value) }) : undefined} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="business-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5">{chart}</div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={percent} showChangeColumn={false}
              shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} shareDecimalsForRow={() => 1} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={percent} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={businessCoverage(section, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildBusinessModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t("sourceNote")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/business", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Sales and Jobs list sizes and industries under two headings, Firms its counts and rates; elsewhere the parts nest under their total. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={mixedUnits ? model.range.end : <>{model.range.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, valueUnit(series.unit)), parentId: series.parentId,
          heading: series.heading && businessHeadingLabel(series.heading, series.unit, t, unitLabels) }))}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeBusinessSelection(s, businessTopicSeries(section), selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        nesting={{ selectedLabel: t("nestedSelected"), expansionLabel: label => t("subcategoriesFor", { label }) }} />
    </ExplorerWorkspace>
  </div>;
}
