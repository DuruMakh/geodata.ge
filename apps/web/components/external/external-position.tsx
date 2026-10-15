"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChartPie } from "lucide-react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientExternalPositionFact } from "../../lib/data/externalPosition/types";
import type { CurrentAccountGdp } from "../../lib/explorer/currentAccount";
import { buildExternalPositionModel, changeExternalPositionView, externalPositionCoverage, externalPositionLatestLabel, parseExternalPositionHash, serializeExternalPositionHash, type ExternalPositionSectionId, type ExternalPositionState, type ExternalPositionView } from "../../lib/explorer/externalPosition";
import { buildExternalPositionWorkbookExportModel } from "../../lib/explorer/externalPositionWorkbook";
import { formatInUnit, unitFor, type ValueUnit } from "../../lib/explorer/format";
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
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

const BILLION = 1_000_000_000;
const VIEWS: readonly ExternalPositionView[] = ["amount", "gdp"];
const MEASURE_ICON_SIZE = 18;

type HashData = { section: ExternalPositionSectionId; facts: ClientExternalPositionFact[]; gdp: CurrentAccountGdp[] };
const parseState = (hash: string, data: HashData) => parseExternalPositionHash(hash, data.section, data.facts, data.gdp);
const serializeState = (state: ExternalPositionState) => serializeExternalPositionHash(state);

export type ExternalPositionExplorerProps = {
  section: ExternalPositionSectionId; facts: ClientExternalPositionFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  /** Nominal GDP in US dollars and its Geostat files, for the % of GDP view. */
  gdp: CurrentAccountGdp[]; gdpSources: WorkbookPublicSource[];
  lastReviewedAt: string; siteOrigin: string;
};

/** Foreign debt and Reserves: one workspace laid out like Money and banks, with a latest-period point after the 31 December values. */
export function ExternalPositionExplorer({ section, facts, labels, sources, gdp, gdpSources, lastReviewedAt, siteOrigin }: ExternalPositionExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const key = section === "foreign-debt" ? "debt" : "reserves";
  const t = (suffix: string, values?: Record<string, string | number>) => message(messages, `external.position.${suffix}`, values);
  const data = useMemo(() => ({ section, facts, gdp }), [section, facts, gdp]);
  const { state, update } = useHashState(data, parseState, serializeState);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = buildExternalPositionModel(section, facts, state, gdp);
  const percent = model.unit === "percent";
  // Amounts share one billion-USD scale whose decimals are read from every value the page can show, so they do not move with
  // the selection; a percent keeps one decimal.
  const unitLabel = percent ? t("unitPercent") : t("unitBnUsd");
  const pageIds = new Set<string>(model.series.map(series => series.id));
  const unit: ValueUnit = percent ? { divisor: 1, label: unitLabel, decimals: 1 } : unitFor(facts.filter(f => pageIds.has(f.indicatorId)).map(f => f.value), { divisor: BILLION, label: unitLabel, decimals: 1 });
  const format = (value: number | null | undefined) => formatInUnit(value, { ...unit, label: "" });
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : percent ? `${format(value)}${unitLabel}` : `${format(value)} ${unitLabel}`;
  // The latest-period point (2026 (Sep)) is named wherever it appears; % of GDP has none.
  const latestLabel = model.latest.latestPeriod ? externalPositionLatestLabel(model.latest, messages) : undefined;
  const yearLabel = (year: number) => latestLabel && model.latestYears.includes(year) ? latestLabel : String(year);
  const total = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({
    id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]),
    preliminary: model.years.map(year => model.latestYears.includes(year)), hollowPreliminary: true,
  }));
  const totalRow = rows.find(row => row.itemId === total.id) ?? null;
  const measureLabel = state.view === "gdp" ? t("latestGdp", { measure: message(messages, `external.${key}.latest`) }) : message(messages, `external.${key}.latest`);
  const latestValue = valueLabel(model.latest.value);
  const title = message(messages, `external.${key}.title`);
  const tabLabel = t(`tab.${state.view}`);
  // % of GDP divides by the nominal GDP Current account uses: the source line names it and its preliminary years.
  const preliminaryGdpYears = percent ? model.years.filter(year => gdp.some(row => row.year === year && row.preliminary)) : [];
  const changeView = (view: ExternalPositionView) => { if (view === state.view) return; setExpanded({}); update(s => changeExternalPositionView(s, section, view, facts, gdp), true); };
  const downloadAction = <ExcelDownloadButton testId="position-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildExternalPositionWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title, gdp, gdpSources, latestLabel }, presentation));
  }} />;
  return <div data-testid={section} className="@container">
    <ExplorerHeading>{message(messages, `external.${key}.heading`)}</ExplorerHeading>
    <LatestValueLine testId="position-latest" measure={measureLabel} period={latestLabel ?? model.latest.year} value={latestValue} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <div className="flex items-center gap-3.5">
              <span data-testid="position-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
              <SegmentedTabs ariaLabel={t("measure")} value={state.view} onChange={changeView} options={VIEWS.map(view => ({
                value: view, label: t(`tab.${view}`), testId: `position-measure-${view}`,
                icon: view === "amount" ? <span aria-hidden="true" className="text-base">$</span> : <ChartPie aria-hidden="true" size={MEASURE_ICON_SIZE} strokeWidth={1.5} />,
              }))} />
            </div>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={percent} unit={unit} shareLabel={tabLabel} preliminaryLabel={latestLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${title} · ${tabLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== totalRow)} totalRow={totalRow} showTotal={Boolean(totalRow)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} yearLabel={yearLabel} firstColumnLabel={t("series")} unit={unit} share={percent} showChangeColumn={false}
              shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={percent} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={externalPositionCoverage(section, state.view, facts, gdp).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildExternalPositionModel(section, facts, s, gdp).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")}
          {percent ? <> {message(messages, "main.gdpSource")}{preliminaryGdpYears.length ? ` · ${message(messages, "main.preliminaryGdp", { years: preliminaryGdpYears.join(", ") })}` : null} ·</> : null}
          {" "}{unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/external-flows", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* The parts nest under their total. Both lists have six rows or fewer, so neither has a search field (DESIGN §7.7). */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{yearLabel(model.range.end)} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue), parentId: series.parentId }))}
        totalId={total.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} searchable={false}
        nesting={{ selectedLabel: t("nestedSelected"), expansionLabel: label => t("subcategoriesFor", { label }), expanded, onExpandedChange: setExpanded }} />
    </ExplorerWorkspace>
  </div>;
}
