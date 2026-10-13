"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { ClientMoneyTransferFact, ClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { unpackFacts, type FactsInput } from "../../lib/data/packedFacts";
import { MONEY_TRANSFER_MEASURES, MONEY_TRANSFER_TOTAL_ID } from "../../lib/data/externalFlows/types";
import { buildMoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { moneyTransfersCoverage, parseMoneyTransfersHash, serializeMoneyTransfersHash } from "../../lib/explorer/moneyTransfersState";
import { buildMoneyTransfersWorkbookModel } from "../../lib/explorer/moneyTransfersWorkbook";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { formatInUnit } from "../../lib/explorer/format";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { useI18n } from "../../lib/i18n/provider";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SourceNote, TextTab } from "../ui/editorial";
import { useHashState } from "../explorer-shell/use-hash-state";
import { MoneyFromAbroadSeriesPanel } from "./money-from-abroad-series-panel";
import { MoneyFromAbroadRanking } from "./money-from-abroad-ranking";


export function MoneyFromAbroad({ data: input, sources, lastReviewedAt, siteOrigin }: { data: Omit<ClientMoneyTransfersData, "facts"> & { facts: FactsInput<ClientMoneyTransferFact> }; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const data = useMemo(() => ({ ...input, facts: unpackFacts(input.facts) }), [input]);
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `external.money.${key}`, values);
  const { state, update } = useHashState(data, parseMoneyTransfersHash, serializeMoneyTransfersHash), model = buildMoneyTransfersModel(data, state, presentation);
  const label = (id: string) => model.series.find(item => item.id === id)!.label;
  const measureLabel = message(messages, `external.measure.${state.measure}`);
  const partialByYear = (id: string) => Object.fromEntries(Object.keys(model.partialMonths[id] ?? {}).map(year => [Number(year), true]));
  const rows = model.selectedIds.map(id => ({ itemId: id, kaLabel: label(id), color: model.colorById[id], valuesByYear: model.valuesByEntity[id], preliminaryByYear: partialByYear(id) }));
  const total = rows.find(row => row.itemId === MONEY_TRANSFER_TOTAL_ID) ?? null;
  const partialShown = model.partialYears.length > 0;
  const downloadAction = <ExcelDownloadButton testId="money-from-abroad-excel-download" disabled={!model.selectedCount} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildMoneyTransfersWorkbookModel({ data, state, sources, siteOrigin }, presentation));
  }} />;
  const valueLabel = (value: number) => `${formatInUnit(value, model.unit)} ${model.unit.label}`;
  const lineSeries = model.selectedIds.map(id => ({ id, label: label(id), color: model.colorById[id], vals: model.years.map(year => model.valuesByEntity[id][year]), planned: model.years.map(() => false), preliminary: model.years.map(year => Boolean(model.partialMonths[id]?.[year])), hollowPreliminary: true }));
  return <div data-testid="money-from-abroad" className="@container">
    <ExplorerHeading>{message(messages, "external.money.title")}</ExplorerHeading>
    <div role="group" aria-label={t("measure")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">{MONEY_TRANSFER_MEASURES.map(measure => <TextTab key={measure} label={message(messages, `external.measure.${measure}`)} active={state.measure === measure} onClick={() => update(s => ({ ...s, measure }), true)} testId={`money-from-abroad-measure-${measure}`} />)}</div>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-measure={state.measure} data-unit="usd" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} /><span className="text-[11px] text-[var(--muted)]">{measureLabel} · {model.unit.label}</span></div>
          {!model.selectedCount ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={model.unit} shareLabel={measureLabel} showAxisUnit={false} preliminaryLabel={t("partial")} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${message(messages, "external.money.title")} · ${measureLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== MONEY_TRANSFER_TOTAL_ID)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} preliminaryLabel={t("partial")} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={model.unit} formatValue={valueLabel} />
          <RangeStrip years={moneyTransfersCoverage(data).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildMoneyTransfersModel(data, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{message(messages, "external.sourceNote")} {model.range.start}–{model.range.end} · {updatedDate(lastReviewedAt, locale)}
          <Link href={pageHref("/methodology/external-flows", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{message(messages, "external.methodology")}</Link>
        </SourceNote></div>
        {partialShown ? <p data-testid="money-from-abroad-partial-note" className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("partialNote", { years: model.partialYears.join(", ") })}</p> : null}
      </div>
      <SeriesAside label={message(messages, "controls.series")}><MoneyFromAbroadSeriesPanel model={model} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} downloadAction={downloadAction} /></SeriesAside>
    </ExplorerWorkspace>
    <MoneyFromAbroadRanking key={`${state.measure}:${model.range.end}`} model={model} measure={state.measure} />
  </div>;
}
