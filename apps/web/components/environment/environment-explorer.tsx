"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientEnvironmentFact, EnvironmentCity } from "../../lib/data/environment/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import {
  buildEnvironmentModel, changeEnvironmentSelection, environmentCoverage, environmentSeriesLabel, environmentTopicSeries, environmentUnitLabelKey,
  environmentValueLabel, environmentValueUnit, parseEnvironmentHash, serializeEnvironmentHash, type EnvironmentModel, type EnvironmentSeriesDefinition,
  type EnvironmentState, type EnvironmentTopicId, type EnvironmentTranslate,
} from "../../lib/explorer/environment";
import { buildEnvironmentAreaModel, changeEnvironmentAreaSelection, environmentAreaCoverage, environmentAreaSeries, parseEnvironmentAreaHash, type EnvironmentArea, type EnvironmentAreaTopic } from "../../lib/explorer/environmentAreas";
import { buildEnvironmentCityModel, changeEnvironmentCitySelection, environmentCityCoverage, environmentCitySeries, parseEnvironmentCityHash } from "../../lib/explorer/environmentCities";
import { buildEnvironmentWorkbookExportModel, type EnvironmentWorkbookPage } from "../../lib/explorer/environmentWorkbook";
import { formatInUnit } from "../../lib/explorer/format";
import { rangeFromPatch, resolveRange } from "../../lib/explorer/periodRange";
import { listLatestByHeading } from "../../lib/explorer/unitList";
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
import { Callout, SourceNote } from "../ui/editorial";
import { EnvironmentAreaHeading, EnvironmentCityHeading } from "./environment-place-heading";

/** The page a list belongs to: a national topic page, a city's air quality or a waste or forests area page. */
export type EnvironmentScope = { kind: "topic"; section: EnvironmentTopicId } | { kind: "city"; city: EnvironmentCity } | { kind: "area"; topic: EnvironmentAreaTopic; area: EnvironmentArea };

/** A scope's list, hash reader, selection change, model and years, so the one explorer serves all three kinds of page. */
type ScopeList = {
  series: (facts: readonly ClientEnvironmentFact[]) => EnvironmentSeriesDefinition[];
  parse: (hash: string, facts: readonly ClientEnvironmentFact[]) => EnvironmentState;
  change: (state: EnvironmentState, next: readonly string[], facts: readonly ClientEnvironmentFact[]) => EnvironmentState;
  build: (facts: readonly ClientEnvironmentFact[], state: EnvironmentState) => EnvironmentModel;
  coverage: (facts: readonly ClientEnvironmentFact[], selectedIds?: readonly string[]) => ReturnType<typeof environmentCoverage>;
};
function scopeList(scope: EnvironmentScope): ScopeList {
  switch (scope.kind) {
    case "topic": {
      const { section } = scope;
      return {
        series: () => environmentTopicSeries(section), parse: (hash, facts) => parseEnvironmentHash(hash, section, facts),
        change: (state, next, facts) => changeEnvironmentSelection(state, section, next, facts), build: (facts, state) => buildEnvironmentModel(section, facts, state),
        coverage: (facts, ids) => environmentCoverage(section, facts, ids),
      };
    }
    case "city": {
      const { city } = scope;
      return {
        series: facts => environmentCitySeries(city, facts), parse: (hash, facts) => parseEnvironmentCityHash(hash, city, facts),
        change: (state, next, facts) => changeEnvironmentCitySelection(city, state, next, facts), build: (facts, state) => buildEnvironmentCityModel(city, facts, state),
        coverage: (facts, ids) => environmentCityCoverage(city, facts, ids),
      };
    }
    case "area": {
      const { topic, area } = scope;
      return {
        series: facts => environmentAreaSeries(topic, area, facts), parse: (hash, facts) => parseEnvironmentAreaHash(hash, topic, area, facts),
        change: (state, next, facts) => changeEnvironmentAreaSelection(topic, area, state, next, facts), build: (facts, state) => buildEnvironmentAreaModel(topic, area, facts, state),
        coverage: (facts, ids) => environmentAreaCoverage(topic, area, facts, ids),
      };
    }
  }
}

const scopeKey = (scope: EnvironmentScope) => scope.kind === "topic" ? scope.section : scope.kind === "city" ? `air-quality-${scope.city}` : `${scope.topic}-${scope.area}`;
const workbookPage = (scope: EnvironmentScope): EnvironmentWorkbookPage =>
  scope.kind === "topic" ? { section: scope.section } : scope.kind === "city" ? { city: scope.city } : { topic: scope.topic, area: scope.area };
/** The page whose source note a scope's line under the chart repeats. */
const sourceSection = (scope: EnvironmentScope) => scope.kind === "topic" ? scope.section : scope.kind === "city" ? "air-quality" : scope.topic;

type HashData = { list: ScopeList; facts: ClientEnvironmentFact[] };
const parseState = (hash: string, data: HashData) => data.list.parse(hash, data.facts);

export type EnvironmentExplorerProps = {
  scope: EnvironmentScope; facts: ClientEnvironmentFact[]; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
  /** The page's title (the plain heading of a topic page; a city or area page's heading opens its picker). */
  title: string;
  /** An area page's picker and previous/next order: Georgia, then the regions, with the map's ids. */
  areas?: readonly MunicipalRegion[];
  /** The line under the heading, built on the server page. */
  latest: { measure: string; year: number; value: string; note?: string };
};

/**
 * One Environment and climate page: a national topic, a city's air quality or a waste or forests area. The chart or table
 * shows one unit at a time; the one list names each group's unit in its heading, and limits are dashed grey lines.
 */
export function EnvironmentExplorer({ scope, facts, labels, sources, lastReviewedAt, siteOrigin, title, areas = [], latest }: EnvironmentExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t: EnvironmentTranslate = (key, values) => message(messages, `environment.${key}`, values);
  const key = scopeKey(scope);
  // useHashState re-reads the hash when its data changes, so the list keeps one identity; a page renders the explorer keyed by its scope.
  const [list] = useState(() => scopeList(scope));
  const data = useMemo(() => ({ list, facts }), [list, facts]);
  const { state, update } = useHashState(data, parseState, serializeEnvironmentHash);
  const [query, setQuery] = useState("");
  const model = list.build(facts, state);
  const unit = environmentValueUnit(model.decimals);
  const unitLabel = t(environmentUnitLabelKey(model.unit));
  const valueLabel = (value: number | null | undefined) => environmentValueLabel(value, model.unit, model.decimals, t);
  // A row whose name repeats under another heading (a pollutant's Total, a station) carries its heading outside the list.
  const fullLabel = (series: EnvironmentSeriesDefinition) => environmentSeriesLabel(series, labels, t);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]), dashed: series.stroke === "dashed" }));
  const reference = model.series.find(series => series.reference && series.unit === model.unit);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  // The list reads at the chosen years' end over all of the page's years, so ticking a row of another unit never changes its numbers;
  // a group whose newest figure is older (a station that closed) names its year in its heading.
  const listEnd = resolveRange(state.range, list.coverage(facts)).end;
  const listRows = listLatestByHeading(facts, model.series, listEnd);
  const downloadAction = <ExcelDownloadButton testId="environment-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildEnvironmentWorkbookExportModel({ ...workbookPage(scope), facts, state, labels, sources, siteOrigin, title }, presentation));
  }} />;
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t(`sourceNote.${sourceSection(scope)}`)} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid={`environment-${key}`} className="@container">
    {scope.kind === "city" ? <EnvironmentCityHeading city={scope.city} />
      : scope.kind === "area" ? <EnvironmentAreaHeading topic={scope.topic} area={scope.area} areas={areas} selectedIds={state.selectedIds} />
      : <ExplorerHeading>{title}</ExplorerHeading>}
    <LatestValueLine testId="environment-latest" measure={latest.measure} period={latest.year} value={latest.value} note={latest.note} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={title} data-testid="chart-panel" data-mode={state.mode} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="environment-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5">{chart}</div>
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={list.coverage(facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(list.build(facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t(`sourceNote.${sourceSection(scope)}`)} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/environment", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Every row is listed from the start under a heading that names its unit, so the caption gives the year only. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={listEnd} downloadAction={downloadAction}
        rows={model.series.map(series => {
          const { latest: rowLatest, headingYear } = listRows[series.id]!;
          const headingText = t(`heading.${series.heading}`);
          return { id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(rowLatest?.value, environmentValueUnit(series.decimals)),
            heading: headingYear ? `${headingText} · ${headingYear}` : headingText, searchTerms: [fullLabel(series)] };
        })}
        totalId={model.series.find(series => series.reference)?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => list.change(s, selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS} />
    </ExplorerWorkspace>
  </div>;
}
