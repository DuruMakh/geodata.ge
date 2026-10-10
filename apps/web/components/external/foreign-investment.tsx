"use client";
import Link from "next/link";
import type { ClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { FOREIGN_INVESTMENT_DIMENSIONS, FOREIGN_INVESTMENT_TOTAL_ID } from "../../lib/data/externalFlows/types";
import { buildForeignInvestmentModel, foreignInvestmentColor } from "../../lib/explorer/foreignInvestment";
import { foreignInvestmentCoverage, parseForeignInvestmentHash, serializeForeignInvestmentHash, switchForeignInvestmentTab } from "../../lib/explorer/foreignInvestmentState";
import { buildForeignInvestmentWorkbookModel } from "../../lib/explorer/foreignInvestmentWorkbook";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { formatDisplayDate, formatInUnit } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { useHashState } from "./use-money-from-abroad-state";
import { MoneyFromAbroadSeriesPanel } from "./money-from-abroad-series-panel";
import { ExternalRanking } from "./external-ranking";

export function ForeignInvestment({ data, sources, lastReviewedAt, siteOrigin }: { data: ClientForeignInvestmentData; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `external.investment.${key}`, values);
  const { state, update } = useHashState(data, parseForeignInvestmentHash, serializeForeignInvestmentHash), model = buildForeignInvestmentModel(data, state, presentation);
  const label = (id: string) => model.series.find(item => item.id === id)!.label;
  const tabLabel = t(`tab.${state.dimension}`);
  const rows = model.selectedIds.map(id => ({ itemId: id, kaLabel: label(id), color: foreignInvestmentColor(id), valuesByYear: model.valuesByEntity[id] }));
  const total = rows.find(row => row.itemId === FOREIGN_INVESTMENT_TOTAL_ID) ?? null;
  const downloadAction = <ExcelDownloadButton testId="foreign-investment-excel-download" disabled={!model.selectedCount} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildForeignInvestmentWorkbookModel({ data, state, sources, siteOrigin }, presentation));
  }} />;
  return <div data-testid="foreign-investment" className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("intro")}</p>
    <div role="group" aria-label={t("tabs")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">{FOREIGN_INVESTMENT_DIMENSIONS.map(dimension => <TextTab key={dimension} label={t(`tab.${dimension}`)} active={state.dimension === dimension} onClick={() => update(s => switchForeignInvestmentTab(s, dimension, data), true)} testId={`foreign-investment-tab-${dimension}`} />)}</div>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-dimension={state.dimension} data-unit="usd" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} /><span className="text-[11px] text-[var(--muted)]">{tabLabel} · {model.unit.label}</span></div>
          {!model.selectedCount ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selectedIds.map(id => ({ id, label: label(id), color: foreignInvestmentColor(id), vals: model.years.map(year => model.valuesByEntity[id][year]), planned: model.years.map(() => false) }))} share={false} unit={model.unit} shareLabel={tabLabel} showAxisUnit={false} formatTooltipValue={value => `${formatInUnit(value, model.unit)} ${model.unit.label}`} /></div>
            : <ExplorerTable caption={`${t("title")} · ${tabLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== FOREIGN_INVESTMENT_TOTAL_ID)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <RangeStrip years={foreignInvestmentCoverage(data, state.dimension).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildForeignInvestmentModel(data, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} {model.range.start}–{model.range.end} · {locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt}
          <Link href={pageHref("/methodology/external-flows", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{message(messages, "external.methodology")}</Link>
        </SourceNote></div>
      </div>
      <SeriesAside label={message(messages, "controls.series")}><MoneyFromAbroadSeriesPanel key={state.dimension} model={model} totalId={FOREIGN_INVESTMENT_TOTAL_ID} searchPlaceholder={t(`search.${state.dimension}`)} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} downloadAction={downloadAction} /></SeriesAside>
    </ExplorerWorkspace>
    <ExternalRanking key={`${state.dimension}:${model.range.end}`} testId="foreign-investment" data={{ "end-year": model.range.end, dimension: state.dimension }} title={t(`ranking.${state.dimension}`, { year: model.range.end })} itemLabel={t(`item.${state.dimension}`)} shareLabel={t("share")} note={t("shareNote")} empty={t("noRanking")} rows={model.ranking} other={model.other} />
  </div>;
}
