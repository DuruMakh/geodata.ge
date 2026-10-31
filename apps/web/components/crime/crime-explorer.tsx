"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Hash, Users, type LucideIcon } from "lucide-react";
import type { ClientCrimeFact, CrimeSeriesBreak } from "../../lib/data/crime/types";
import { buildCrimeModel, changeCrimeMeasure, crimeCoverage, crimeDefaultSelection, crimeUnitKey, parseCrimeHash, serializeCrimeHash, type CrimeMeasure, type CrimePopulation, type CrimeSectionId, type CrimeState } from "../../lib/explorer/crime";
import { buildCrimeWorkbookExportModel } from "../../lib/explorer/crimeWorkbook";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { keepOneUnit } from "../../lib/explorer/unitList";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
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

export type CrimeExplorerProps = {
  section: CrimeSectionId; facts: ClientCrimeFact[];
  /** Georgia's population on 1 January of each year, the divisor of the per-100,000 view. */
  population: CrimePopulation;
  /** The counting changes that touch the page's series; the model draws those inside the range that touch a selected one. */
  breaks: CrimeSeriesBreak[];
  labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
};

type CrimeHashData = { section: CrimeSectionId; facts: ClientCrimeFact[] };
const parseCrimeState = (hash: string, data: CrimeHashData) => parseCrimeHash(hash, data.section, data.facts);
const serializeCrimeState = (state: CrimeState) => serializeCrimeHash(state);

/** The measure switch: icons only, named by their tooltips (DESIGN §7.2a). */
const MEASURES: readonly { value: CrimeMeasure; icon: LucideIcon }[] = [{ value: "count", icon: Hash }, { value: "per100k", icon: Users }];
/** The latest line on Road accidents adds the people killed. */
const ROAD_KILLED = "crime.road.killed";

/** One Crime and justice page: the section's list under its headings, as published counts or per 100,000 people, for Georgia. */
export function CrimeExplorer({ section, facts, population, breaks, labels, sources, lastReviewedAt, siteOrigin }: CrimeExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `crime.${key}`, values);
  const hashData = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(hashData, parseCrimeState, serializeCrimeState);
  const [query, setQuery] = useState("");
  const model = buildCrimeModel(section, facts, population, state, breaks);
  // The panel names the unit, so axis ticks and cells carry numbers only: counts are whole, rates have one decimal.
  const unit: ValueUnit = { divisor: 1, label: "", decimals: model.decimals };
  const unitLabel = message(messages, model.unitKey);
  // Road accidents in count lists accidents and people, so its headings name them and its caption gives the year only.
  const mixedUnits = new Set(model.series.map(series => crimeUnitKey(state.measure, series.id))).size > 1;
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : format(value);
  const reference = model.series.find(series => series.reference);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const total = reference ? rows.find(row => row.itemId === reference.id) ?? null : null;
  const newCounting = t("break.newCounting");
  // The latest-value line is the page total's published count, whichever measure is shown.
  const latestOf = (id: string) => facts.filter(f => f.indicatorId === id).sort((a, b) => a.year - b.year).at(-1)!;
  const latest = latestOf(crimeDefaultSelection(section)[0]);
  const killed = section === "road-accidents" ? latestOf(ROAD_KILLED) : null;
  const title = t(`page.${section}.title`);
  const changeMeasure = (measure: CrimeMeasure) => {
    if (measure !== state.measure) update(s => changeCrimeMeasure(s, measure), true);
  };
  const downloadAction = <ExcelDownloadButton testId="crime-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildCrimeWorkbookExportModel({ section, facts, population, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} breaks={model.breaks.map(item => ({ year: item.year, label: newCounting }))} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t(`sourceNote.${section}`)} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid={`crime-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="crime-latest" measure={t(`latest.${section}`)} period={latest.year} value={format(latest.value, 0)}
      note={killed && killed.year === latest.year ? t("latest.killed", { count: format(killed.value, 0) }) : undefined} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-measure={state.measure} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <div className="flex items-center gap-3.5">
              <span data-testid="crime-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
              <SegmentedTabs ariaLabel={t("measure")} value={state.measure} onChange={changeMeasure} options={MEASURES.map(({ value, icon: Icon }) => (
                { value, label: t(`measure.${value}`), testId: `crime-measure-${value}`, icon: <Icon aria-hidden="true" size={18} strokeWidth={1.5} /> }
              ))} />
            </div>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : <><ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null}
              breakYears={model.breaks.map(item => item.year)} breakLabel={newCounting} crawlCopy={state.mode === "line"} />{state.mode === "line" ? <div className="mt-5">{chart}</div> : null}</>}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={crimeCoverage(section, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildCrimeModel(section, facts, population, s, breaks).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t(`sourceNote.${section}`)} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span> · <Link href={pageHref("/methodology/crime", locale)} prefetch={false} className="text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={mixedUnits ? model.range.end : <>{model.range.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue), heading: series.heading ? t(`heading.${series.heading}`) : undefined }))}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds: keepOneUnit(selectedIds, s.selectedIds, facts) }), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS} />
    </ExplorerWorkspace>
  </div>;
}
