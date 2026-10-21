"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { ClientBusinessFact } from "../../lib/data/business/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { businessHeadingLabel, changeBusinessSelection, serializeBusinessHash, type BusinessUnit } from "../../lib/explorer/business";
import { BUSINESS_REGIONS_HREF, buildBusinessAreaModel, businessAreaCoverage, businessAreaOfMapId, businessAreaSelectionHash, businessAreaSeries, businessMapId, businessRegionHref, parseBusinessAreaHash, type BusinessArea } from "../../lib/explorer/businessAreas";
import { buildBusinessWorkbookExportModel } from "../../lib/explorer/businessWorkbook";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatAmount, formatInUnit, thousandsUnit, unitsFor, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch, resolveRange } from "../../lib/explorer/periodRange";
import { listLatestByHeading } from "../../lib/explorer/unitList";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { RegionPicker, useRefocusAfterPick } from "../regional-economies/region-picker";
import { Callout, SourceNote } from "../ui/editorial";

export type BusinessAreaExplorerProps = {
  area: BusinessArea; facts: ClientBusinessFact[];
  /** Names of the area's series; areaLabels names Georgia and the regions. */
  labels: Record<string, string>; areaLabels: Record<BusinessArea, string>;
  sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string;
  /** The areas offered by the picker and previous/next links, Georgia first, with the map's ids. */
  areas: readonly MunicipalRegion[];
};

/** An area's page: Georgia's or a region's chart, series list and Excel, with the area picker in the heading, as on Living standards. */
export function BusinessAreaExplorer({ area, facts, labels, areaLabels, sources, lastReviewedAt, siteOrigin, areas }: BusinessAreaExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `business.${key}`, values);
  // parse is an effect dependency of useHashState, so its identity changes only with the page.
  const parse = useCallback((hash: string, f: ClientBusinessFact[]) => parseBusinessAreaHash(hash, area, f), [area]);
  const { state, update } = useHashState(facts, parse, serializeBusinessHash);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId();
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  useRefocusAfterPick(pickerTrigger, "region-picker-trigger");
  const model = buildBusinessAreaModel(area, facts, state);
  // The chart shows one unit, the selection's. Amounts are in million GEL to one decimal (as Geostat prints them) on every
  // area, Georgia included; people are in thousands, firms whole numbers; each list row reads in its own unit, named by
  // its heading. The latest line reads as the site's amounts do (billion GEL from a billion).
  const valueUnit = (unit: BusinessUnit): ValueUnit => unit === "gel" ? { ...unitsFor(locale).mln, decimals: 1 } : unit === "persons" ? thousandsUnit(locale) : { divisor: 1, label: "", decimals: 0 };
  const unit = valueUnit(model.unit);
  const unitLabels: Record<BusinessUnit, string> = { gel: message(messages, "format.mlnGel"), persons: t("unitThousandPeople"), enterprises: t("unitFirms"), percent: t("unitPercent") };
  const unitLabel = unitLabels[model.unit];
  const format = (value: number | null | undefined) => formatInUnit(value, unit);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${format(value)} ${unitLabel}`;
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: labels[series.id], color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: labels[series.id], color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const reference = model.series.find(series => series.reference);
  // The list reads at the chosen years' end over the whole page's years, so ticking a row of another unit (firm counts stop a
  // year earlier) never changes the numbers it shows.
  const listEnd = resolveRange(state.range, businessAreaCoverage(area, facts)).end;
  const listRows = listLatestByHeading(facts, model.series, listEnd);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  // The latest-value line is the page's headline: its own area's sales, whatever is chosen below.
  const latest = facts.filter(f => f.indicatorId === `business.turnover.${area === "georgia" ? "total" : area}`).sort((a, b) => a.year - b.year).at(-1)!;
  const areaName = areaLabels[area];
  const title = t("page.area.regionTitle", { region: areaName });
  // The chart is named after the heading of the selection's unit group.
  const chartLabel = `${t(`measure.${model.series.find(series => series.unit === model.unit)!.heading}`)} · ${areaName}`;
  // Links to another area's page carry the selection, moved to that area, and nothing else; the index reads only the jobs choice.
  const areaHref = (id: string) => `${businessRegionHref(id)}${businessAreaSelectionHash(state.selectedIds, businessAreaOfMapId(id))}`;
  const index = areas.findIndex(item => item.id === businessMapId(area));
  const neighbours = { previous: areas[(index - 1 + areas.length) % areas.length]!, next: areas[(index + 1) % areas.length]! };
  const nameOf = (id: string) => areaLabels[businessAreaOfMapId(id)];
  return <div data-testid={`business-area-${area}`} className="@container">
    <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t("page.area.regionHeadingLead")}{" "}
          <button ref={pickerTrigger} type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} aria-haspopup="dialog" aria-controls={pickerOpen ? pickerId : undefined} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {areaName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker id={pickerId} open={pickerOpen} onClose={() => setPickerOpen(false)} regions={areas} activeRegionId={businessMapId(area)} hrefForRegion={areaHref} indexHref={`${BUSINESS_REGIONS_HREF}${model.unit === "persons" ? "#m=jobs" : ""}`} />
      </div>
      <EntityNeighbourLinks testId="business-region-navigation" className="mb-3"
        previous={{ href: pageHref(areaHref(neighbours.previous.id), locale), label: nameOf(neighbours.previous.id) }}
        next={{ href: pageHref(areaHref(neighbours.next.id), locale), label: nameOf(neighbours.next.id) }} />
    </div>
    <LatestValueLine testId="business-latest" measure={t("latest.area")} period={latest.year} value={formatAmount(latest.value, locale)} note={areaName} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-area={area} data-unit={model.unit} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="business-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={chartLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={businessAreaCoverage(area, facts, state.selectedIds).years} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildBusinessAreaModel(area, facts, s).range, patch) }))} />
        </section>
        {/* A region's line names the head-office caveat; Georgia's totals need none. */}
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(area === "georgia" ? "sourceNote" : "sourceNoteRegions")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/business", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      {/* Money, jobs and firms each sit under a heading that names their unit, so the caption gives the year only; a group whose
          latest figures are older than that year names their year in its heading. */}
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={listEnd}
        rows={model.series.map(series => {
          const { latest, headingYear } = listRows[series.id]!;
          const heading = series.heading && businessHeadingLabel(series.heading, series.unit, t, unitLabels);
          return { id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(latest?.value, valueUnit(series.unit)),
            heading: heading && headingYear ? `${heading} · ${headingYear}` : heading };
        })}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeBusinessSelection(s, businessAreaSeries(area), selectedIds, facts), true)} searchable={false}
        downloadAction={<ExcelDownloadButton testId="business-excel-download" disabled={!state.selectedIds.length} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildBusinessWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin, title }, presentation));
        }} />} />
    </ExplorerWorkspace>
  </div>;
}
