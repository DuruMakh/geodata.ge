"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { ClientHealthFact, HealthArea } from "../../lib/data/health/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { HEALTH_SECTIONS, healthSeriesCoverage } from "../../lib/explorer/health";
import { buildHealthDeathsModel, healthDeathsAreaHref, healthDeathsAreaLatest, healthDeathsSeries, parseHealthDeathsHash, serializeHealthDeathsHash } from "../../lib/explorer/healthDeaths";
import { buildHealthWorkbookExportModel } from "../../lib/explorer/healthWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { PlaceHeading } from "../explorer-shell/place-heading";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionPicker } from "../regional-economies/region-picker";
import { Callout, SourceNote } from "../ui/editorial";

type HealthDeathsExplorerProps = {
  /** The page's area (Georgia or a region), and the areas offered by the picker and previous/next links, Georgia first. */
  area: HealthArea; areas: readonly MunicipalRegion[];
  /** The area's deaths by cause. */
  facts: ClientHealthFact[];
  /** Names of the causes; areaLabels names Georgia and the regions. */
  labels: Record<string, string>; areaLabels: Record<HealthArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string;
};

const INDEX_HREF = HEALTH_SECTIONS.find(section => section.id === "causes-of-death")!.href;
/** Deaths are whole counts as published. */
const UNIT: ValueUnit = { divisor: 1, label: "", decimals: 0 };
const TOTAL = "health.deaths.total";

/** An area's causes-of-death page: Georgia's or a region's chart, list of causes and Excel, with the area picker in the heading. */
export function HealthDeathsExplorer({ area, areas, facts, labels, areaLabels, sources, lastReviewedAt, siteOrigin }: HealthDeathsExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `health.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientHealthFact[]) => parseHealthDeathsHash(hash, area, f), [area]);
  const { state, update } = useHashState(facts, parse, serializeHealthDeathsHash);
  const [query, setQuery] = useState("");
  const model = buildHealthDeathsModel(area, facts, state);
  const unitLabel = t("unitPersons");
  const format = (value: number | null | undefined) => formatInUnit(value, UNIT);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : format(value);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const total = rows.find(row => row.itemId === TOTAL) ?? null;
  const latest = healthDeathsAreaLatest(area, facts);
  const areaName = areaLabels[area];
  const title = t("page.area.regionTitle", { region: areaName });
  const chartLabel = `${t("page.causes-of-death.title")} · ${areaName}`;
  const index = areas.findIndex(item => item.id === area);
  const neighbours = { previous: areas[(index - 1 + areas.length) % areas.length]!, next: areas[(index + 1) % areas.length]! };
  const coverage = healthSeriesCoverage(facts, area, healthDeathsSeries(), `No causes-of-death years for ${area}`);
  const chart = <EditorialLineChart years={model.years} series={lineSeries} share={false} unit={UNIT} shareLabel={chartLabel} formatTooltipValue={valueLabel} />;
  const shareAction = model.selected.length ? <ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
    legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={t("sourceNoteDeaths")} chart={chart} period={`${model.range.start}-${model.range.end}`} /> : undefined;
  return <div data-testid="health-causes-of-death-area" className="@container">
    <PlaceHeading lead={t("page.area.regionHeadingLead")} placeLabel={areaName} triggerTestId="region-picker-trigger"
      picker={(open, close, id) => <RegionPicker id={id} open={open} onClose={close} regions={areas} activeRegionId={area} hrefForRegion={id => healthDeathsAreaHref(id as HealthArea)} indexHref={INDEX_HREF} />}
      neighbours={{
        testId: "health-region-navigation",
        previous: { href: pageHref(healthDeathsAreaHref(neighbours.previous.id as HealthArea), locale), label: areaLabels[neighbours.previous.id as HealthArea] },
        next: { href: pageHref(healthDeathsAreaHref(neighbours.next.id as HealthArea), locale), label: areaLabels[neighbours.next.id as HealthArea] },
      }} />
    <LatestValueLine testId="health-latest" measure={`${t("latest.area")} · ${areaName}`} period={latest.year} value={valueLabel(latest.value)} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={area} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5">{chart}</div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={UNIT} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={UNIT} formatValue={valueLabel} />
          <RangeStrip years={coverage.years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildHealthDeathsModel(area, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label" action={shareAction}>{t("sourceNoteDeaths")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span> · <Link href={pageHref("/methodology/health", locale)} prefetch={false} className="text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {unitLabel}</>}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue) }))}
        totalId={TOTAL} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        downloadAction={<ExcelDownloadButton testId="health-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildHealthWorkbookExportModel({ section: "causes-of-death", area, facts, state, labels, sources, siteOrigin, title }, presentation));
        }} />} />
    </ExplorerWorkspace>
  </div>;
}
