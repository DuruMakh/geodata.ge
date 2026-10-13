"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { unpackFacts, type FactsInput } from "../../lib/data/packedFacts";
import type { ClientWagesFact } from "../../lib/data/wages/types";
import { buildWagesHeatmap, buildWagesModel, changeWagesView, parseWagesHash, serializeWagesHash, wagesCoverage, wagesRegionHref, wagesViews, type WagesSectionId, type WagesState, type WagesView } from "../../lib/explorer/wages";
import { buildWagesWorkbookExportModel } from "../../lib/explorer/wagesWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { HeatmapSection } from "../main-explorer/heatmap-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SEARCHABLE_MIN_ROWS } from "../main-explorer/series-selector";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionPicker } from "../regional-economies/region-picker";
import { PlaceHeading } from "../explorer-shell/place-heading";
import { Callout, SELECT_CLASS, SourceNote } from "../ui/editorial";


type WagesHashData = { section: WagesSectionId; facts: ClientWagesFact[] };
const parseWages = (hash: string, { section, facts }: WagesHashData) => parseWagesHash(hash, section, facts);
const serializeWages = (state: WagesState, { section }: WagesHashData) => serializeWagesHash(state, section);

export type WagesExplorerProps = {
  section: WagesSectionId; facts: FactsInput<ClientWagesFact>; labels: Record<string, string>; sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string; siteOrigin: string;
  /** Region pages: the region and the regions offered by the picker and previous/next links. */
  regionId?: string; regions?: readonly MunicipalRegion[];
};

export function WagesExplorer({ section, facts: shippedFacts, labels, sources, lastReviewedAt, siteOrigin, regionId, regions }: WagesExplorerProps) {
  const facts = unpackFacts(shippedFacts);
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `wages.${key}`, values);
  const hashData = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(hashData, parseWages, serializeWages);
  const regionName = regionId ? labels[regionId] : "";
  const ordered = regions ?? [], regionIndex = ordered.findIndex(region => region.id === regionId);
  const neighbours = regionIndex < 0 ? null : { previous: ordered[(regionIndex - 1 + ordered.length) % ordered.length]!, next: ordered[(regionIndex + 1) % ordered.length]! };
  const [query, setQuery] = useState("");
  const model = buildWagesModel(section, facts, state);
  const unit: ValueUnit = { divisor: 1, label: t("unit"), decimals: model.decimals };
  const format = (value: number | null | undefined, decimals = model.decimals) => formatInUnit(value, { ...unit, decimals });
  // Averages are published to one decimal and the median in whole lari, so a mixed selection formats each series at its own precision.
  const decimalsOf = (id: string) => model.series.find(series => series.id === id)?.decimals ?? model.decimals;
  const valueLabel = (value: number | null | undefined, id?: string) => value == null ? "—" : `${format(value, id ? decimalsOf(id) : model.decimals)} ${unit.label}`;
  const reference = model.series[0];
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const total = rows.find(row => row.itemId === reference.id) ?? null;
  // The latest-value line states the page's own place: Georgia, or the region.
  const latest = facts.filter(f => f.indicatorId === "average_monthly_nominal_earnings" && f.dimension === (regionId ? "region" : "national") && f.sectorId === "total" && f.value !== null).sort((a, b) => a.year - b.year).at(-1)!;
  const title = regionId ? t("regionTitle", { region: regionName }) : t(`page.${section}.title`);
  const changeView = (view: WagesView) => { if (view === state.view) return; setQuery(""); update(s => changeWagesView(s, section, view, facts), true); };
  const downloadAction = <ExcelDownloadButton testId="wages-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildWagesWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin, title, regionId }, presentation));
  }} />;
  const heatmap = section === "industries" ? buildWagesHeatmap(model) : null;
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  return <div data-testid={`wages-${section}`} className="@container">
    {regionId ? <PlaceHeading
      lead={t("regionHeadingLead")}
      placeLabel={regionName}
      triggerTestId="region-picker-trigger"
      picker={(open, close, id) => <RegionPicker id={id} open={open} onClose={close} regions={ordered} activeRegionId={regionId} hrefForRegion={wagesRegionHref} indexHref="/explorer/wages/regions" />}
      neighbours={neighbours ? {
        testId: "wages-region-navigation",
        previous: { href: pageHref(wagesRegionHref(neighbours.previous.id), locale), label: labels[neighbours.previous.id] },
        next: { href: pageHref(wagesRegionHref(neighbours.next.id), locale), label: labels[neighbours.next.id] },
      } : undefined}
    /> : <ExplorerHeading>{title}</ExplorerHeading>}
    <LatestValueLine testId="wages-latest" measure={regionId ? `${t("series.average")} · ${regionName}` : t("series.average")} period={latest.year} value={`${format(latest.value, 1)} ${unit.label}`} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-unit="gel" className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            {section === "industries" ? <label className="min-w-0 w-full text-[11px] min-[768px]:text-[10px] font-semibold text-[var(--muted)] min-[768px]:max-w-[360px]"><span className="sr-only">{t("groupLabel")}</span>
              <select data-testid="wages-group" value={state.view} className={SELECT_CLASS} onChange={event => changeView(event.target.value as WagesView)}>
                {wagesViews(section).map(view => <option key={view} value={view}>{t(`group.${view}`)}</option>)}
              </select>
            </label> : <span className="text-[11px] text-[var(--muted)]">{t("unitMonthly")}</span>}
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={(value, id) => valueLabel(value, id)} /></div>
            : <ExplorerTable caption={`${title} · ${t("unitMonthly")} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== reference.id)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} decimalsForRow={row => decimalsOf(row.itemId)} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={(value, id) => valueLabel(value, id)} />
          <RangeStrip years={wagesCoverage(section, state.view, facts).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildWagesModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(state.view === "median" || section === "overview" ? "sourceNoteMedian" : "sourceNote")} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/wages", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
        {regionId ? <p className="mt-3 max-w-[800px] text-[11px] leading-relaxed text-[var(--muted)]">{t("regionNote")}</p> : null}
        {state.view === "business" || state.view === "non_business" ? <p className="mt-3 max-w-[800px] text-[11px] leading-relaxed text-[var(--muted)]">{t("nonBusinessNote")}</p> : null}
      </div>
      {/* The Overview nests women, men, public and non-public under the average (as Unemployment nests its subcategories). */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{model.range.end} · {t("unitMonthly")}</>} downloadAction={downloadAction}
        rows={model.series.map(series => ({ id: series.id, label: labels[series.id], color: series.color, value: format(series.endValue, series.decimals), parentId: series.parentId }))}
        totalId={model.series.find(series => series.reference)?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable={model.series.length > SEARCHABLE_MIN_ROWS}
        nesting={{ selectedLabel: t("nestedSelected"), expansionLabel: label => t("subcategoriesFor", { label }) }} />
    </ExplorerWorkspace>
    {heatmap ? <HeatmapSection testId="wages-industry-heatmap" indicator={state.view} unit="gel" title={t("heatmapTitle")} caption={`${t(`group.${state.view}`)} · ${t("unitMonthly")} · ${model.years[0]}–${model.years.at(-1)}`}
      note={t("heatmapNote")} scaleLabel={t("heatmapScale")} rowHeader={t("industry")} years={heatmap.years} maximum={heatmap.maximum} format={value => format(value)} wrapRowLabels
      rows={heatmap.rows.map(row => ({ id: row.id, label: labels[row.id], values: row.values }))} /> : null}
  </div>;
}
