"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ChartPie } from "lucide-react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientTaxBreaksRefundsFact } from "../../lib/data/taxBreaksRefunds/types";
import type { ClientNationalGdpFact } from "../../lib/explorer/clientData";
import {
  buildTaxBreaksRefundsModel, parseTaxBreaksRefundsHash, serializeTaxBreaksRefundsHash, taxBreaksRefundsCoverage, taxBreaksRefundsHeadline, taxBreaksRefundsViewFacts,
  type TaxBreaksRefundsHeading, type TaxBreaksRefundsState, type TaxBreaksRefundsView,
} from "../../lib/explorer/taxBreaksRefunds";
import { buildTaxBreaksRefundsWorkbookExportModel } from "../../lib/explorer/taxBreaksRefundsWorkbook";
import { formatAmount, formatInUnit, unitFor, unitsFor, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch, refitRange } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

type HashData = { facts: ClientTaxBreaksRefundsFact[]; gdpFacts: ClientNationalGdpFact[] };
const parseState = (hash: string, data: HashData) => parseTaxBreaksRefundsHash(hash, data.facts, data.gdpFacts);
const serializeState = (state: TaxBreaksRefundsState) => serializeTaxBreaksRefundsHash(state);
const VIEWS: readonly TaxBreaksRefundsView[] = ["amount", "gdp"];

export type TaxBreaksRefundsExplorerProps = {
  facts: ClientTaxBreaksRefundsFact[]; labels: Record<string, string>; headings: Record<TaxBreaksRefundsHeading, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  /** National GDP and its Geostat files, for the % of GDP view. */
  gdpFacts: ClientNationalGdpFact[]; gdpSources: WorkbookPublicSource[];
  lastReviewedAt: string; siteOrigin: string;
};

export function TaxBreaksRefundsExplorer({ facts, labels, headings, sources, gdpFacts, gdpSources, lastReviewedAt, siteOrigin }: TaxBreaksRefundsExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `taxBreaksRefunds.${key}`, values);
  const data = useMemo(() => ({ facts, gdpFacts }), [facts, gdpFacts]);
  const { state, update } = useHashState(data, parseState, serializeState);
  const model = buildTaxBreaksRefundsModel(facts, state, gdpFacts);
  const viewFacts = taxBreaksRefundsViewFacts(state.view, facts, gdpFacts);
  // Amounts share one million-GEL scale, its decimals read from every amount the page can show. Shares take one decimal,
  // two for a row with any share under 0.1%.
  const percent = model.unit === "percent";
  const unit: ValueUnit = percent ? { divisor: 1, label: t("unitPercent"), decimals: 1 } : unitFor(facts.map(f => f.value), unitsFor(locale).mln);
  const unitLabel = percent ? t("unitPercent") : message(messages, "format.mlnGel");
  const decimalsOf = (id: string) => viewFacts.some(f => f.indicatorId === id && f.value !== 0 && Math.abs(f.value) < 0.1) ? 2 : 1;
  const format = (value: number | null | undefined, id: string) => formatInUnit(value, percent ? { divisor: 1, label: "", decimals: decimalsOf(id) } : unit);
  const valueLabel = (value: number | null | undefined, id: string) => value == null ? "—" : percent ? `${format(value, id)}${unitLabel}` : `${format(value, id)} ${unitLabel}`;
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // The line names the latest refunds: billions in ₾, a share in % of GDP.
  const headline = taxBreaksRefundsHeadline(viewFacts);
  const headlineValue = percent ? `${formatInUnit(headline.value, { divisor: 1, label: "", decimals: 1 })}${t("unitPercent")}` : formatAmount(headline.value, locale);
  const latestLine = <>{t("latest.refunds")} {headline.year}: <LatestFigure value={headlineValue} /></>;
  const preliminaryGdpYears = percent ? model.years.filter(year => gdpFacts.some(f => f.year === year && f.status === "preliminary")) : [];
  const title = t("title");
  const tabLabel = t(`tab.${state.view}`);
  // Tax breaks end a year before refunds, so each row reads at its own latest year in range and its heading names that year
  // when it is not the range's last (as on Environment).
  const latestInRange = (series: typeof model.series[number]) => model.years.filter(year => series.valuesByYear[year] != null).at(-1);
  const headingYear = (heading: TaxBreaksRefundsHeading) => Math.max(...model.series.filter(s => s.heading === heading).map(s => latestInRange(s) ?? -Infinity));
  const headingText = (heading: TaxBreaksRefundsHeading) => {
    const year = headingYear(heading);
    return Number.isFinite(year) && year !== model.range.end ? `${headings[heading]} · ${year}` : headings[heading];
  };
  const changeView = (view: TaxBreaksRefundsView) => {
    if (view === state.view) return;
    update(s => ({ ...s, view, range: refitRange(s.range, taxBreaksRefundsCoverage(view, s.selectedIds, facts, gdpFacts), { collapseToAll: false }) }), true);
  };
  const downloadAction = <ExcelDownloadButton testId="tax-breaks-refunds-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildTaxBreaksRefundsWorkbookExportModel({ facts, state, labels, sources, siteOrigin, title, gdpFacts, gdpSources }, presentation));
  }} />;
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={percent} unit={unit} shareLabel={tabLabel} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${tabLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t("sourceNote")} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid="tax-breaks-refunds" className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="tax-breaks-refunds-latest" sentence={latestLine} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <div className="flex items-center gap-3.5">
              <span data-testid="tax-breaks-refunds-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
              <SegmentedTabs ariaLabel={t("measure")} value={state.view} onChange={changeView} options={VIEWS.map(view => ({
                value: view, label: t(`tab.${view}`), testId: `tax-breaks-refunds-measure-${view}`,
                icon: view === "amount" ? <span aria-hidden="true" className="text-base">₾</span> : <ChartPie aria-hidden="true" size={18} strokeWidth={1.5} />,
              }))} />
            </div>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5">{chart}</div>
            : <ExplorerTable caption={`${tabLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows} totalRow={null} showTotal={false} wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={percent} showChangeColumn={false}
              shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} shareDecimalsForRow={row => decimalsOf(row.itemId)} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={percent} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={taxBreaksRefundsCoverage(state.view, state.selectedIds, facts, gdpFacts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildTaxBreaksRefundsModel(facts, s, gdpFacts).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t("sourceNote")}
          {percent ? <> · {message(messages, "main.gdpSource")}{preliminaryGdpYears.length ? ` ${message(messages, "main.preliminaryGdp", { years: preliminaryGdpYears.join(", ") })}` : null}</> : null}
          {" · "}{unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/tax-breaks-refunds", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Every row is listed from the start under its heading; sixteen fixed rows need no search field (DESIGN §7.7). */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => {
          const year = latestInRange(series);
          return { id: series.id, label: labels[series.id], color: series.color, value: format(year === undefined ? null : series.valuesByYear[year], series.id), heading: headingText(series.heading) };
        })}
        selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} searchable={false} />
    </ExplorerWorkspace>
  </div>;
}
