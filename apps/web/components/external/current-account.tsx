"use client";
import Link from "next/link";
import type { ClientCurrentAccountFact } from "../../lib/data/externalFlows/importCurrentAccount";
import { CURRENT_ACCOUNT_PARTS, CURRENT_ACCOUNT_SERIES, type CurrentAccountSeriesId } from "../../lib/data/externalFlows/types";
import { buildCurrentAccountModel, type CurrentAccountGdp } from "../../lib/explorer/currentAccount";
import { CURRENT_ACCOUNT_TABS, currentAccountCoverage, parseCurrentAccountHash, serializeCurrentAccountHash } from "../../lib/explorer/currentAccountState";
import { buildCurrentAccountWorkbookModel } from "../../lib/explorer/currentAccountWorkbook";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { formatDisplayDate, formatInUnit } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { MeasurePill } from "../explorer-shell/measure-pill";
import { SeriesAside } from "../explorer-shell/series-aside";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote, SwatchBar, TextTab } from "../ui/editorial";
import { useHashState } from "./use-money-from-abroad-state";
import { MoneyFromAbroadSeriesPanel } from "./money-from-abroad-series-panel";

export function CurrentAccount({ facts, gdp, sources, lastReviewedAt, siteOrigin }: { facts: ClientCurrentAccountFact[]; gdp: CurrentAccountGdp[]; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `external.account.${key}`, values);
  const { state, update } = useHashState(facts, parseCurrentAccountHash, serializeCurrentAccountHash), model = buildCurrentAccountModel(facts, gdp, state, presentation);
  const balance = state.tab === "balance", percent = state.unit === "gdp";
  const shown: CurrentAccountSeriesId[] = balance ? [...CURRENT_ACCOUNT_SERIES] : model.selectedIds;
  const label = (id: CurrentAccountSeriesId) => model.series.find(item => item.id === id)!.label, color = (id: CurrentAccountSeriesId) => model.series.find(item => item.id === id)!.color;
  const valueLabel = (value: number | null) => percent ? `${formatInUnit(value, model.unit)}%` : `${formatInUnit(value, model.unit)} ${model.unit.label}`;
  const tabLabel = t(`tab.${state.tab}`);
  const rows = shown.map(id => ({ itemId: id, kaLabel: label(id), color: color(id), valuesByYear: model.valuesById[id] }));
  const total = rows.find(row => row.itemId === "ca.balance") ?? null;
  const scaled = (id: CurrentAccountSeriesId) => model.years.map(year => { const value = model.valuesById[id][year]; return value === null ? null : value / model.unit.divisor; });
  const downloadAction = <ExcelDownloadButton testId="current-account-excel-download" disabled={!shown.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildCurrentAccountWorkbookModel({ facts, gdp, state, sources, siteOrigin }, presentation));
  }} />;
  return <div data-testid="current-account" className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("intro")}</p>
    <div role="group" aria-label={t("tabs")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">{CURRENT_ACCOUNT_TABS.map(tab => <TextTab key={tab} label={t(`tab.${tab}`)} active={state.tab === tab} onClick={() => update(s => ({ ...s, tab }), true)} testId={`current-account-tab-${tab}`} />)}</div>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-tab={state.tab} data-unit={state.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            <div className="flex items-center gap-3">
              {percent ? null : <span className="text-[11px] text-[var(--muted)]">{tabLabel} · {model.unit.label}</span>}
              <MeasurePill label={message(messages, "main.percentGdp")} pressed={percent} onChange={pressed => update(s => ({ ...s, unit: pressed ? "gdp" : "usd" }), true)} />
            </div>
          </div>
          {!shown.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "table" ? <ExplorerTable caption={`${t("title")} · ${tabLabel} · ${model.unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== "ca.balance")} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={model.unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />
            : balance ? <div className="mt-5"><StackedColumnChart periods={model.years} periodsPerYear={1} segments={CURRENT_ACCOUNT_PARTS.map(id => ({ id, label: label(id), color: color(id), values: scaled(id) }))} overlay={{ label: label("ca.balance"), values: scaled("ca.balance") }} formatPeriod={String} formatValue={value => valueLabel(value * model.unit.divisor)} readoutOrder="sign-then-magnitude" ariaLabel={t("balanceAria")} /></div>
              : <div className="mt-5"><EditorialLineChart years={model.years} series={shown.map(id => ({ id, label: label(id), color: color(id), vals: model.years.map(year => model.valuesById[id][year]), planned: model.years.map(() => false) }))} share={false} unit={model.unit} shareLabel={tabLabel} showAxisUnit={false} formatTooltipValue={valueLabel} /></div>}
          <RangeStrip years={currentAccountCoverage(facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildCurrentAccountModel(facts, gdp, s, presentation).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{message(messages, "external.sourceNote")} {model.range.start}–{model.range.end} · {locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt}
          {model.preliminaryGdpYears.length ? ` · ${message(messages, "main.preliminaryGdp", { years: model.preliminaryGdpYears.join(", ") })}` : null}
          <Link href={pageHref("/methodology/external-flows", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{message(messages, "external.methodology")}</Link>
        </SourceNote></div>
      </div>
      <SeriesAside label={message(messages, "controls.series")}>
        {balance ? <>
          <p className="mb-3 text-[11px] text-[var(--muted)]">{model.range.end} · {percent ? message(messages, "main.percentGdp") : model.unit.label}</p>
          <ul data-testid="current-account-key" aria-label={t("key")} className="mb-5">
            {CURRENT_ACCOUNT_SERIES.map(id => <li key={id} data-series-id={id} className={`flex items-baseline gap-2 border-b border-[var(--hairline)] py-2 text-[13px] ${id === "ca.balance" ? "font-semibold text-[var(--ink)]" : "text-[var(--body)]"}`}>
              <SwatchBar color={color(id)} className="self-center" />
              <span className="min-w-0 flex-1">{label(id)}</span>
              <span className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--muted)]">{formatInUnit(model.endValues[id], model.unit)}</span>
            </li>)}
          </ul>
          {downloadAction}
        </> : <MoneyFromAbroadSeriesPanel model={{ ...model, valuesByEntity: model.valuesById, selectedCount: model.selectedIds.length, totalCount: CURRENT_ACCOUNT_SERIES.length }} totalId="ca.balance" searchPlaceholder={t("search")} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds: CURRENT_ACCOUNT_SERIES.filter(id => selectedIds.includes(id)) }), true)} downloadAction={downloadAction} />}
      </SeriesAside>
    </ExplorerWorkspace>
  </div>;
}
