"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { ClientLabourFact } from "../../lib/data/labour/types";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import {
  buildLabourModel, changeLabourSelection, labourCoverage, labourFullLabel, labourList, parseLabourHash, serializeLabourHash,
  type LabourHeading, type LabourSectionId,
} from "../../lib/explorer/labour";
import { buildLabourWorkbookExportModel } from "../../lib/explorer/labourWorkbook";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { FlatSeriesPanel } from "../explorer-shell/flat-series-panel";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { useHashState } from "../explorer-shell/use-hash-state";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { Callout, SourceNote } from "../ui/editorial";

type LabourHashData = { section: LabourSectionId; facts: ClientLabourFact[] };
const parseLabourState = (hash: string, data: LabourHashData) => parseLabourHash(hash, data.section, data.facts);
/** Thousands of people, hours and percentages all show Geostat's one decimal. */
const ONE_DECIMAL: ValueUnit = { divisor: 1, label: "", decimals: 1 };

export type LabourExplorerProps = {
  section: LabourSectionId;
  /** The facts of the series the page lists. */
  facts: ClientLabourFact[];
  /** A name for every listed series, and for each heading they sit under. */
  labels: Record<string, string>;
  headingLabels: Record<string, string>;
  /** The one line under the heading: the latest figure of the page total. */
  latestLine: ReactNode;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string;
  siteOrigin: string;
};

/**
 * Jobs by industry, Hours worked, Informal jobs or Young people: the Education topic workspace (chart or table, years,
 * the series list under its headings with search, Excel). Each page has one unit, so any rows chart together.
 * EducationExplorer is not reused: it builds its own model, list and period labels and reads `education.*` messages inside.
 */
export function LabourExplorer({ section, facts, labels, headingLabels, latestLine, sources, lastReviewedAt, siteOrigin }: LabourExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string) => message(messages, `labour.${key}`);
  const data = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(data, parseLabourState, serializeLabourHash);
  const [query, setQuery] = useState("");
  const model = buildLabourModel(section, facts, state);
  // The list reads at the chosen years' end over all of the page's years: a row shows its latest value up to then.
  const list = labourList(section, facts, state);
  const unit = ONE_DECIMAL;
  const unitLabel = t(`unit.${model.unit}`);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : model.unit === "percent" ? `${formatInUnit(value, unit)}%` : `${formatInUnit(value, unit)} ${unitLabel}`;
  // Outside the list a row is named under its heading: "Women — Construction".
  const fullLabel = (series: { id: string; heading: LabourHeading }) => labourFullLabel(series.heading, headingLabels[series.heading], labels[series.id]);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const reference = model.series.find(series => series.reference);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  const title = t(`page.${section}.title`);
  const downloadAction = <ExcelDownloadButton testId="labour-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildLabourWorkbookExportModel({ section, facts, state, labels, headingLabels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`labour-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="labour-latest" sentence={latestLine} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="labour-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={labourCoverage(section, facts, state.selectedIds).years} range={model.range}
            onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildLabourModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} · {unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/unemployment", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{list.end} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => {
          const { latest, headingYear } = list.rows[series.id]!;
          return { id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(latest?.value, unit),
            heading: headingYear ? `${headingLabels[series.heading]} · ${headingYear}` : headingLabels[series.heading] };
        })}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeLabourSelection(s, section, selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable />
    </ExplorerWorkspace>
  </div>;
}
