"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientEnergyFoodFact } from "../../lib/data/energyFood/types";
import { buildEnergyFoodModel, energyFoodCoverage, energyFoodDisplayLabels, energyFoodUnit, parseEnergyFoodHash, serializeEnergyFoodHash, type EnergyFoodSectionId, type EnergyFoodState } from "../../lib/explorer/energyFood";
import { buildEnergyFoodWorkbookExportModel } from "../../lib/explorer/energyFoodWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
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

export type EnergyFoodExplorerProps = {
  section: EnergyFoodSectionId; facts: ClientEnergyFoodFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

type EnergyFoodHashData = { section: EnergyFoodExplorerProps["section"]; facts: EnergyFoodExplorerProps["facts"] };
const parseEnergyFoodState = (hash: string, data: EnergyFoodHashData) => parseEnergyFoodHash(hash, data.section, data.facts);
const serializeEnergyFoodState = (next: EnergyFoodState, data: EnergyFoodHashData) => serializeEnergyFoodHash(next, data.section);

export function EnergyFoodExplorer({ section, facts, labels, sources, lastReviewedAt, siteOrigin }: EnergyFoodExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `energyFood.${key}`, values);
  const hashData = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(hashData, parseEnergyFoodState, serializeEnergyFoodState);
  const [query, setQuery] = useState("");
  const model = buildEnergyFoodModel(section, facts, state);
  // Energy is in thousand tonnes of oil equivalent or GWh; food is a self-sufficiency percent, drawn on a percent axis.
  // The chart panel names the unit, so axis ticks and cells carry numbers only; the latest line adds "GWh" to its value.
  const unitKind = energyFoodUnit(section), percent = unitKind === "percent";
  const unit: ValueUnit = { divisor: 1, label: "", decimals: model.decimals };
  const unitLabel = t(`unit.${unitKind}Long`);
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  const suffix = percent ? "%" : unitKind === "gwh" ? ` ${t("unit.gwh")}` : "";
  const valueLabel = (value: number | null | undefined, decimals?: number) => value == null ? "—" : `${format(value, decimals)}${suffix}`;
  const reference = model.series[0];
  // The list nests plain names; the chart and table name a repeated child with its parent.
  const shown = energyFoodDisplayLabels(section, labels);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: shown[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: shown[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]), planned: model.years.map(() => false) }));
  const total = rows.find(row => row.itemId === reference.id) ?? null;
  // The latest-value line is the page's total in its latest year; supply and electricity add that year's imports (and exports).
  const factFor = (id: string, year: number) => facts.find(f => f.indicatorId === id && f.year === year);
  const latest = facts.filter(f => f.indicatorId === reference.id).sort((a, b) => a.year - b.year).at(-1)!;
  const plain = (id: string) => { const fact = factFor(id, latest.year); return format(fact?.value, fact?.decimals); };
  const note = section === "energy-supply" ? t("latestNote.energy-supply", { value: plain("energy.imports.total") })
    : section === "electricity" ? t("latestNote.electricity", { imports: plain("electricity.imports"), exports: plain("electricity.exports") }) : undefined;
  const title = t(`page.${section}.title`);
  const downloadAction = <ExcelDownloadButton testId="energy-food-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildEnergyFoodWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`energy-food-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="energy-food-latest" measure={t(`latest.${section}`)} period={latest.year} value={valueLabel(latest.value, latest.decimals)} note={note} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-unit={unitKind} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            <span className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={percent} unit={unit} shareLabel={title} formatTooltipValue={value => valueLabel(value)} /></div>
            // Food ratios are whole percents, as Geostat prints them.
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={percent} percentDecimals={0} showChangeColumn={false} shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={percent} unit={unit} formatValue={value => valueLabel(value)} />
          <RangeStrip years={energyFoodCoverage(section, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildEnergyFoodModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(percent ? "sourceNote.food" : "sourceNote.energy")} · {unitLabel} · {model.range.start}–{model.range.end} · {lastReviewedAt}
          <Link href={pageHref("/methodology/energy-food", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Breakdowns nest under their total, listed by their plain names. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue), parentId: series.parentId }))}
        totalId={model.series.find(series => series.reference)?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        nesting={{ selectedLabel: t("nestedSelected"), expansionLabel: label => t("subcategoriesFor", { label }) }} />
    </ExplorerWorkspace>
  </div>;
}
