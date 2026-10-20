"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Hash, Users, type LucideIcon } from "lucide-react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import {
  buildMarriageModel,
  changeMarriageSelection,
  parseMarriageHash,
  serializeMarriageHash,
  type MarriageMeasure,
  type MarriagePlaceFacts,
  type MarriageState,
} from "../../lib/explorer/demographyMarriage";
import { buildMarriageWorkbookExportModel } from "../../lib/explorer/demographyMarriageWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestFigure, LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

export type MarriageExplorerProps = {
  /** Georgia's nine series and its mid-year population (`marriageFactsForPlace` with every id). */
  place: MarriagePlaceFacts;
  /** Full names for the chart, table and workbook; `listLabels` are the short names under the list's headings. */
  labels: Record<string, string>;
  listLabels: Record<string, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string;
  siteOrigin: string;
};

const parseState = (hash: string, place: MarriagePlaceFacts) => parseMarriageHash(hash, place);
const serializeState = (state: MarriageState) => serializeMarriageHash(state);

/** The measure switch: icons only, named by their tooltips (DESIGN §7.2a). */
const MEASURES: readonly { value: MarriageMeasure; icon: LucideIcon }[] = [{ value: "count", icon: Hash }, { value: "per1000", icon: Users }];

/** The Marriages and divorces page: Georgia's counts, average ages and marriage length under their headings, as published or per 1,000 residents. */
export function MarriageExplorer({ place, labels, listLabels, sources, lastReviewedAt, siteOrigin }: MarriageExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `demography.${key}`, values);
  const { state, update } = useHashState(place, parseState, serializeState);
  const [query, setQuery] = useState("");
  const model = buildMarriageModel(place, state);
  const years = useMemo(() => [...new Set(place.facts.map((fact) => fact.year))].sort((a, b) => a - b), [place]);
  // The panel names the unit, so axis ticks and cells carry numbers only.
  const unit: ValueUnit = { divisor: 1, label: "", decimals: model.decimals };
  const unitLabel = message(messages, model.unitKey);
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  const valueLabel = (value: number | null | undefined) => (value == null ? "—" : format(value));
  // A list row keeps its own decimals: the ages and length have one, the counts none unless they are rates.
  const rowDecimals = (group: string) => (group === "years" || state.measure === "per1000" ? 1 : 0);
  const rows = model.selected.map((series) => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map((series) => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map((year) => series.valuesByYear[year]) }));
  const breakLabel = t("breakLabel");
  // The latest line is Georgia's published counts, whichever measure is shown.
  const latestOf = (id: string) => place.facts.filter((fact) => fact.indicatorId === id).sort((a, b) => a.year - b.year).at(-1)!;
  const [marriages, divorces] = [latestOf("marriages"), latestOf("divorces")];
  const title = t("marriagesTitle");
  const changeMeasure = (measure: MarriageMeasure) => {
    if (measure !== state.measure) update((s) => ({ ...s, measure }), true);
  };
  const downloadAction = (
    <ExcelDownloadButton
      testId="marriage-excel-download"
      disabled={!model.selected.length}
      onDownload={async () => {
        const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
        await downloadWorkbook(buildMarriageWorkbookExportModel({ place, state, labels, sources, siteOrigin, title, scope: "georgia" }, presentation));
      }}
    />
  );
  return (
    <div data-testid="marriage-explorer" className="@container">
      <ExplorerHeading>{title}</ExplorerHeading>
      <LatestValueLine
        testId="marriage-latest"
        sentence={<>{marriages.year}: <LatestFigure value={format(marriages.value, 0)} /> {t("marriageLatestMarriages")}, <LatestFigure value={format(divorces.value, 0)} /> {t("marriageLatestDivorces")}</>}
      />
      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="chart-panel" data-mode={state.mode} data-measure={state.measure} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ModeTabs value={state.mode} onChange={(mode) => update((s) => ({ ...s, mode }), true)} />
              <div className="flex items-center gap-3.5">
                <span data-testid="marriage-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
                <SegmentedTabs ariaLabel={t("marriageMeasure")} value={state.measure} onChange={changeMeasure} options={MEASURES.map(({ value, icon: Icon }) => (
                  { value, label: t(`marriageMeasure.${value}`), testId: `marriage-measure-${value}`, icon: <Icon aria-hidden="true" size={18} strokeWidth={1.5} /> }
                ))} />
              </div>
            </div>
            {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("marriageEmpty")}</Callout></div>
              : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} breaks={model.breaks.map((item) => ({ year: item.year, label: breakLabel }))} /></div>
              : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows} totalRow={null} showTotal={false} wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("seriesHeader")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null}
                breakYears={model.breaks.map((item) => item.year)} breakLabel={breakLabel} />}
            <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
            <RangeStrip years={years} range={model.range} onChange={(patch) => update((s) => ({ ...s, range: rangeFromPatch(buildMarriageModel(place, s).range, patch) }))} />
          </section>
          <div className="mt-[18px]"><SourceNote testId="source-label">{t("marriageSource")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span> · <Link href={pageHref("/methodology/demography", locale)} prefetch={false} className="text-[var(--accent)] underline underline-offset-4">{message(messages, "common.methodology")}</Link>
          </SourceNote></div>
        </div>
        <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={model.range.end} downloadAction={downloadAction}
          rows={model.series.map((series) => ({ id: series.id, label: listLabels[series.id], color: series.color, value: format(series.endValue, rowDecimals(series.group)), heading: t(`marriageHeading.${series.heading}`) }))}
          selectedIds={state.selectedIds} onSelectionChange={(selectedIds) => update((s) => changeMarriageSelection(s, selectedIds, place), true)}
          query={query} onQueryChange={setQuery} searchPlaceholder={t("marriageSearch")} searchable={model.series.length > SEARCHABLE_MIN_ROWS} />
      </ExplorerWorkspace>
    </div>
  );
}
