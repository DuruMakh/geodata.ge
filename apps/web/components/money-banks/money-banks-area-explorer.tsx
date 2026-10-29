"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { MONEY_BANKS_REGIONS_HREF, buildMoneyBanksAreaModel, moneyBanksAreaCoverage, moneyBanksAreaOfMapId, moneyBanksAreaSelectionHash, moneyBanksMapId, moneyBanksRegionHref, parseMoneyBanksAreaHash, type MoneyBanksArea } from "../../lib/explorer/moneyBanksAreas";
import { buildMoneyBanksWorkbookExportModel } from "../../lib/explorer/moneyBanksWorkbook";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { MISSING, formatAmount, formatInUnit, unitsFor } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { serializeTopicHash, type TopicState } from "../../lib/explorer/topicSeries";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { Message } from "../../lib/i18n/message";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionPicker, useRefocusAfterPick } from "../regional-economies/region-picker";
import { Callout, SourceNote } from "../ui/editorial";

const serialize = (state: TopicState) => serializeTopicHash(state);

export type MoneyBanksAreaExplorerProps = {
  area: MoneyBanksArea; facts: ClientMoneyBanksFact[];
  /** Names of the area's series; areaLabels names Georgia and the regions. */
  labels: Record<string, string>; areaLabels: Record<MoneyBanksArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string;
  /** The areas offered by the picker and previous/next links, Georgia first, with the map's ids. */
  areas: readonly MunicipalRegion[];
};

/** An area's page: Georgia's or a region's loans, in total, in lari and in foreign currency, with the area picker in the heading, as on Internet at home. */
export function MoneyBanksAreaExplorer({ area, facts, labels, areaLabels, sources, lastReviewedAt, siteOrigin, areas }: MoneyBanksAreaExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `moneyBanks.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientMoneyBanksFact[]) => parseMoneyBanksAreaHash(hash, area, f), [area]);
  const { state, update } = useHashState(facts, parse, serialize);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId();
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  useRefocusAfterPick(pickerTrigger, "region-picker-trigger");
  const model = buildMoneyBanksAreaModel(area, facts, state);
  // One unit on every area, Georgia included: million GEL to one decimal, so a small region's loans still read as a number.
  const unit = { ...unitsFor(locale).mln, decimals: 1 };
  const unitLabel = message(messages, "format.mlnGel");
  const valueLabel = (value: number | null | undefined) => value == null ? MISSING : `${formatInUnit(value, unit)} ${unitLabel}`;
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  // All loans is the area's lari plus its foreign-currency loans, so the table shows it as the total.
  const total = rows.find(row => row.itemId === model.series[0].id) ?? null;
  // The latest-value line is the page's headline: its own area's all loans, whatever is chosen below, read as the site's amounts are.
  const latest = facts.filter(f => f.indicatorId === model.series[0].id).sort((a, b) => a.year - b.year).at(-1)!;
  const areaName = areaLabels[area];
  const title = t("page.area.regionTitle", { region: areaName });
  const chartLabel = `${t("heading.area")} · ${areaName}`;
  // Links to another area's page carry the selection, moved to that area, and nothing else.
  const areaHref = (id: string) => `${moneyBanksRegionHref(id)}${moneyBanksAreaSelectionHash(state.selectedIds, moneyBanksAreaOfMapId(id))}`;
  const index = areas.findIndex(item => item.id === moneyBanksMapId(area));
  const neighbours = { previous: areas[(index - 1 + areas.length) % areas.length]!, next: areas[(index + 1) % areas.length]! };
  const nameOf = (id: string) => areaLabels[moneyBanksAreaOfMapId(id)];
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t("sourceNoteRegions")} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid={`money-area-${area}`} className="@container">
    <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t("page.area.regionHeadingLead")}{" "}
          <button ref={pickerTrigger} type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} aria-haspopup="dialog" aria-controls={pickerOpen ? pickerId : undefined} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {areaName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker id={pickerId} open={pickerOpen} onClose={() => setPickerOpen(false)} regions={areas} activeRegionId={moneyBanksMapId(area)} hrefForRegion={areaHref} indexHref={MONEY_BANKS_REGIONS_HREF} />
      </div>
      <EntityNeighbourLinks testId="money-region-navigation" className="mb-3"
        previous={{ href: pageHref(areaHref(neighbours.previous.id), locale), label: nameOf(neighbours.previous.id) }}
        next={{ href: pageHref(areaHref(neighbours.next.id), locale), label: nameOf(neighbours.next.id) }} />
    </div>
    <LatestValueLine testId="money-latest" sentence={<Message messages={messages} id="moneyBanks.latest.area" values={{ year: latest.year, value: <LatestFigure value={formatAmount(latest.value, locale)} /> }} />} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={area} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="money-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : <><ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} crawlCopy={state.mode === "line"} />{state.mode === "line" ? <div className="mt-5">{chart}</div> : null}</>}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={moneyBanksAreaCoverage(area, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildMoneyBanksAreaModel(area, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t("sourceNoteRegions")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/money", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {unitLabel}</>}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(series.endValue, unit) }))}
        totalId={model.series[0].id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)} searchable={false}
        downloadAction={<ExcelDownloadButton testId="money-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildMoneyBanksWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin, title }, presentation));
        }} />} />
    </ExplorerWorkspace>
  </div>;
}
