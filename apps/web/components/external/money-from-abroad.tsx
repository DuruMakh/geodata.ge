"use client";
import Link from "next/link";
import type { ClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_MEASURES, MONEY_TRANSFER_TOTAL_ID, PERSONAL_TRANSFERS_ID } from "../../lib/data/externalFlows/types";
import { buildMoneyTransfersModel, moneyTransferColor, type MoneyTransferFigures } from "../../lib/explorer/moneyTransfers";
import { moneyTransfersCoverage, setMoneyTransfersTab } from "../../lib/explorer/moneyTransfersState";
import { buildMoneyTransfersWorkbookModel } from "../../lib/explorer/moneyTransfersWorkbook";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { formatDisplayDate, formatInUnit, formatShare } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { SeriesAside } from "../explorer-shell/series-aside";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { KPI_UNIT_CLASS, SIDE_KPI_VALUE_CLASS } from "../main-explorer/kpi-blocks";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, Overline, SectionTitle, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { useMoneyFromAbroadState } from "./use-money-from-abroad-state";
import { MoneyFromAbroadSeriesPanel } from "./money-from-abroad-series-panel";
import { MoneyFromAbroadRanking } from "./money-from-abroad-ranking";

/** NBG adds microfinance organizations to the transfer statistics from January 2010 (spec section 4). */
const MICROFINANCE_BREAK_YEAR = 2010;
const FIGURE_UNIT = { divisor: 1_000_000, decimals: 1 } as const;

export function MoneyFromAbroadFigures({ figures }: { figures: MoneyTransferFigures }) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `external.money.${key}`, values);
  const unit = { ...FIGURE_UNIT, label: message(messages, "external.unit.million") };
  const items = [
    { id: "received", value: formatInUnit(figures.received, unit), unit: figures.received === null ? "" : unit.label },
    { id: "sent", value: formatInUnit(figures.sent, unit), unit: figures.sent === null ? "" : unit.label },
    { id: "estimate", value: formatInUnit(figures.estimate, unit), unit: figures.estimate === null ? "" : unit.label },
    { id: "share", value: formatShare(figures.receivedShareOfGdp), unit: "" },
  ];
  return <section data-testid="money-from-abroad-figures" data-year={figures.year} className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
    <SectionTitle>{t("figuresTitle", { year: figures.year })}</SectionTitle>
    <div className="mt-[22px] grid gap-x-8 gap-y-5 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
      {items.map(item => <div key={item.id} data-testid="money-from-abroad-figure" data-figure={item.id} className="min-w-0 border-t border-[var(--hairline-soft)] pt-3.5">
        <Overline>{t(`figure.${item.id}`)}</Overline>
        <p className={`mt-[7px] ${SIDE_KPI_VALUE_CLASS}`}>{item.value}{item.unit ? <span className={KPI_UNIT_CLASS}>{item.unit}</span> : null}</p>
      </div>)}
    </div>
  </section>;
}

export function MoneyFromAbroad({ data, sources, lastReviewedAt, siteOrigin }: { data: ClientMoneyTransfersData; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const presentation = useI18n(), { locale, messages, englishLabels } = presentation;
  const t = (key: string) => message(messages, `external.money.${key}`);
  const { state, update } = useMoneyFromAbroadState(data), model = buildMoneyTransfersModel(data, state, presentation);
  const entities = new Map(data.entities.map(entity => [entity.id, entity]));
  const label = (id: string) => publicLabel(locale, id, entities.get(id)!.labelKa, englishLabels);
  const measureLabel = message(messages, `external.measure.${state.measure}`);
  const partialByYear = (id: string) => Object.fromEntries(Object.keys(model.partialMonths[id] ?? {}).map(year => [Number(year), true]));
  const rows = model.selectedIds.map(id => ({ itemId: id, kaLabel: label(id), color: moneyTransferColor(id), valuesByYear: model.valuesByEntity[id], preliminaryByYear: partialByYear(id) }));
  const total = rows.find(row => row.itemId === MONEY_TRANSFER_TOTAL_ID) ?? null;
  const transfersShown = model.selectedIds.some(id => id !== PERSONAL_TRANSFERS_ID);
  const breakShown = transfersShown && model.years.includes(MICROFINANCE_BREAK_YEAR - 1) && model.years.includes(MICROFINANCE_BREAK_YEAR);
  const partialShown = model.selectedIds.some(id => model.partialMonths[id]);
  const downloadAction = <ExcelDownloadButton testId="money-from-abroad-excel-download" disabled={!model.selectedCount} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildMoneyTransfersWorkbookModel({ data, state, sources, siteOrigin }, presentation));
  }} />;
  return <div data-testid="money-from-abroad" className="@container">
    <ExplorerHeading>{message(messages, "external.money.title")}</ExplorerHeading>
    <p className="mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("intro")}</p>
    <div role="group" aria-label={t("measure")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">{MONEY_TRANSFER_MEASURES.map(measure => <TextTab key={measure} label={message(messages, `external.measure.${measure}`)} active={state.measure === measure} onClick={() => update(s => ({ ...s, measure }), true)} testId={`money-from-abroad-measure-${measure}`} />)}</div>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-measure={state.measure} data-unit="usd" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} /><span className="text-[11px] text-[var(--muted)]">{measureLabel} · {model.unit.label}</span></div>
          {!model.selectedCount ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.selectedIds.map(id => ({ id, label: label(id), color: moneyTransferColor(id), vals: model.years.map(year => model.valuesByEntity[id][year]), planned: model.years.map(() => false), preliminary: model.years.map(year => Boolean(model.partialMonths[id]?.[year])), hollowPreliminary: true, ...(id === PERSONAL_TRANSFERS_ID ? { continuousAcrossBreaks: true } : {}) }))} share={false} unit={model.unit} shareLabel={measureLabel} showAxisUnit={false} preliminaryLabel={t("partial")} formatTooltipValue={value => `${formatInUnit(value, model.unit)} ${model.unit.label}`} {...(transfersShown ? { breaks: [{ year: MICROFINANCE_BREAK_YEAR, label: t("breakLabel") }] } : {})} /></div>
            : <ExplorerTable caption={`${message(messages, "external.money.title")} · ${measureLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== MONEY_TRANSFER_TOTAL_ID)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} preliminaryLabel={t("partial")} {...(breakShown ? { breakYears: [MICROFINANCE_BREAK_YEAR], breakLabel: t("breakLabel") } : {})} />}
          <RangeStrip years={moneyTransfersCoverage(data).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildMoneyTransfersModel(data, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{message(messages, "external.sourceNote")} {model.range.start}–{model.range.end} · {locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt}
          <Link href={pageHref("/methodology/external-flows", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{message(messages, "external.methodology")}</Link>
        </SourceNote></div>
        {partialShown ? <p data-testid="money-from-abroad-partial-note" className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("partialNote")}</p> : null}
      </div>
      <SeriesAside label={message(messages, "controls.series")}><MoneyFromAbroadSeriesPanel key={state.tab} data={data} state={state} model={model} onTabChange={tab => update(s => setMoneyTransfersTab(s, tab), true)} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} downloadAction={downloadAction} /></SeriesAside>
    </ExplorerWorkspace>
    <MoneyFromAbroadFigures figures={model.figures} />
    <MoneyFromAbroadRanking key={`${state.measure}:${model.range.end}`} model={model} measure={state.measure} />
  </div>;
}
