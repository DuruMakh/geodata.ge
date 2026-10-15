"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Percent } from "lucide-react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientBusinessFact } from "../../lib/data/business/types";
import { buildBusinessModel, businessCoverage, businessViews, businessViewSeries, changeBusinessView, parseBusinessHash, serializeBusinessHash, type BusinessState, type BusinessTopicId, type BusinessView } from "../../lib/explorer/business";
import { buildBusinessWorkbookExportModel } from "../../lib/explorer/businessWorkbook";
import { formatAmount, formatInUnit, thousandsUnit, unitsFor, type ValueUnit } from "../../lib/explorer/format";
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
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

type BusinessHashData = { section: BusinessTopicId; facts: ClientBusinessFact[] };
const parseBusinessState = (hash: string, data: BusinessHashData) => parseBusinessHash(hash, data.section, data.facts);
const serializeBusinessState = (state: BusinessState, data: BusinessHashData) => serializeBusinessHash(state, data.section);

/** The firms headline: each total's latest count. The line keeps it whichever measure the switch shows. */
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
  const { state, update } = useHashState(data, parseBusinessState, serializeBusinessState);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const model = buildBusinessModel(section, facts, state);
  // Each view has one unit: amounts in million GEL to one decimal (as Geostat prints them), people in thousands, firms
  // as whole numbers and rates in percent to one decimal.
  const percent = model.unit === "percent";
  const mln: ValueUnit = { ...unitsFor(locale).mln, decimals: 1 };
  const unit: ValueUnit = model.unit === "gel" ? mln
    : model.unit === "persons" ? thousandsUnit(locale) : { divisor: 1, label: percent ? t("unitPercent") : "", decimals: percent ? 1 : 0 };
  const unitLabel = { gel: message(messages, "format.mlnGel"), persons: t("unitThousandPeople"), enterprises: t("unitFirms"), percent: t("unitPercent") }[model.unit];
  const format = (value: number | null | undefined) => formatInUnit(value, percent ? { ...unit, label: "" } : unit);
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
  const chartLabel = state.view === "rate" ? t("measure.rate") : title;
  const views = businessViews(section);
  // Firms switches between counts and rates with the icon measure switch (DESIGN §7.2a); the carets close with the view.
  const changeView = (view: BusinessView) => { if (view === state.view) return; setExpanded({}); update(s => changeBusinessView(s, section, view, facts), true); };
  const headings = new Map(businessViewSeries(section, state.view).filter(series => series.heading).map(series => [series.id, t(`heading.${series.heading}`)]));
  const downloadAction = <ExcelDownloadButton testId="business-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildBusinessWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`business-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="business-latest" measure={t(`latest.${section}`)} period={latest.year} value={latestValue} note={closed ? t("latestNote.firms", { value: count(closed.value) }) : undefined} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className={`flex flex-wrap ${views.length > 1 ? "items-center" : "items-end"} justify-between gap-3`}>
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <div className="flex items-center gap-3.5">
              <span data-testid="business-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
              {views.length > 1 ? <SegmentedTabs ariaLabel={t("measure")} value={state.view} onChange={changeView} options={views.map(view => ({
                value: view, label: t(`measure.${view}`), testId: `business-measure-${view}`,
                icon: view === "rate" ? <Percent aria-hidden="true" size={18} strokeWidth={1.5} /> : <Building2 aria-hidden="true" size={18} strokeWidth={1.5} />,
              }))} /> : null}
            </div>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={percent} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={percent} showChangeColumn={false}
              shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} shareDecimalsForRow={() => 1} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={percent} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={businessCoverage(section, state.view, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildBusinessModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/business", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Sales and Jobs list sizes and industries under two headings; elsewhere the parts nest under their total. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue), parentId: series.parentId, heading: headings.get(series.id) }))}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        nesting={{ selectedLabel: t("nestedSelected"), expansionLabel: label => t("subcategoriesFor", { label }), expanded, onExpandedChange: setExpanded }} />
    </ExplorerWorkspace>
  </div>;
}
