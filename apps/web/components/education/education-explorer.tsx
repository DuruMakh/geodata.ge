"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { ClientEducationFact } from "../../lib/data/education/types";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import {
  buildEducationModel, changeEducationSelection, educationCoverage, educationFullLabel, educationPeriodLabel, educationTopicList, parseEducationHash, serializeEducationHash,
  type EducationTopicId,
} from "../../lib/explorer/education";
import { buildEducationWorkbookExportModel } from "../../lib/explorer/educationWorkbook";
import { formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";
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

type EducationHashData = { section: EducationTopicId; facts: ClientEducationFact[] };
const parseEducationState = (hash: string, data: EducationHashData) => parseEducationHash(hash, data.section, data.facts);

export type EducationExplorerProps = {
  section: EducationTopicId;
  /** Georgia's facts of the series the page lists. */
  facts: ClientEducationFact[];
  /** A name for every listed series, and for each heading (measure) they sit under. */
  labels: Record<string, string>;
  headingLabels: Record<string, string>;
  /** The one line under the heading: the latest figure, as a sentence. */
  latestLine: ReactNode;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string;
  siteOrigin: string;
};

/**
 * Universities or Vocational colleges: the Business topic workspace (chart or table, years, the series list under its
 * headings with search, Excel). Every row counts persons, so rows from different headings chart together. Universities
 * label school years (`2025/26`), vocational colleges calendar years.
 */
export function EducationExplorer({ section, facts, labels, headingLabels, latestLine, sources, lastReviewedAt, siteOrigin }: EducationExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `education.${key}`, values);
  const data = useMemo(() => ({ section, facts }), [section, facts]);
  const { state, update } = useHashState(data, parseEducationState, serializeEducationHash);
  const [query, setQuery] = useState("");
  const model = buildEducationModel(section, facts, state);
  // The list reads at the chosen years' end over all of the page's years: a row shows its latest value up to then, and a
  // heading whose rows stop earlier (graduates) names their year.
  const list = educationTopicList(section, facts, state);
  const period = educationPeriodLabel(section);
  const unit = UNIT_PERSONS;
  const unitLabel = t("unitPersons");
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : `${formatInUnit(value, unit)} ${unitLabel}`;
  // Outside the list a row is named under its heading: "Graduates — Women".
  const fullLabel = (series: { id: string; heading: string }) => educationFullLabel(headingLabels[series.heading], labels[series.id]);
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const reference = model.series.find(series => series.reference);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  const title = t(`page.${section}.title`);
  const downloadAction = <ExcelDownloadButton testId="education-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildEducationWorkbookExportModel({ section, facts, state, labels, headingLabels, sources, siteOrigin, title }, presentation));
  }} />;
  return <div data-testid={`education-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="education-latest" sentence={latestLine} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <span data-testid="education-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={false} unit={unit} shareLabel={title} formatTooltipValue={valueLabel} formatPeriod={period} /></div>
            : <ExplorerTable caption={`${title} · ${unitLabel} · ${period(model.range.start)}–${period(model.range.end)}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} yearLabel={period} firstColumnLabel={t("series")} unit={unit} share={false} showChangeColumn={false} shareValueForYear={() => null} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={false} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={educationCoverage(section, facts, state.selectedIds).years} range={model.range} formatPeriod={period}
            onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildEducationModel(section, facts, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(`sourceNote.${section}`)} · {unitLabel} · {period(model.range.start)}–{period(model.range.end)} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/education", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={<>{period(list.end)} · {unitLabel}</>} downloadAction={downloadAction}
        rows={model.series.map(series => {
          const { latest, headingYear } = list.rows[series.id]!;
          return { id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(latest?.value, unit),
            heading: headingYear ? `${headingLabels[series.heading]} · ${period(headingYear)}` : headingLabels[series.heading] };
        })}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeEducationSelection(s, section, selectedIds, facts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable />
    </ExplorerWorkspace>
  </div>;
}
