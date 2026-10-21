"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChartPie } from "lucide-react";
import type { ClientSocialFact, SocialSeriesBreak } from "../../lib/data/social/types";
import type { ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { educationFullLabel } from "../../lib/explorer/education";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import {
  buildSocialModel, changeSocialSelection, changeSocialView, parseSocialHash, serializeSocialHash, socialCoverage, socialTopicList, socialViews,
  type SocialPayView, type SocialState, type SocialTopicId,
} from "../../lib/explorer/social";
import { buildSocialWorkbookExportModel, SOCIAL_UNIT_KEYS } from "../../lib/explorer/socialWorkbook";
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
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";

type SocialHashData = { section: SocialTopicId; facts: ClientSocialFact[]; gdpFacts: ClientNationalGdpFact[] };
const parseSocialState = (hash: string, data: SocialHashData) => parseSocialHash(hash, data.section, data.facts, data.gdpFacts);
const serializeSocialState = (state: SocialState, data: SocialHashData) => serializeSocialHash(state, data.section);

export type SocialExplorerProps = {
  section: SocialTopicId;
  /** Georgia's facts of the series the page lists. */
  facts: ClientSocialFact[];
  /** National GDP and its Geostat files, for Social payments' % of GDP view (empty on Social package). */
  gdpFacts: ClientNationalGdpFact[];
  gdpSources: WorkbookPublicSource[];
  /** The counting-change register; the model draws those inside the range that touch a selected row. */
  breaks: SocialSeriesBreak[];
  /** A name for every listed series, and for each heading they sit under. */
  labels: Record<string, string>;
  headingLabels: Record<string, string>;
  /** The one line under the heading: the latest figure, as a sentence. */
  latestLine: ReactNode;
  /** The SSA tables, each with the id the served facts name it by. */
  sources: (WorkbookPublicSource & { sourceId: string })[];
  lastReviewedAt: string;
  siteOrigin: string;
};

/**
 * Social payments or Social package: Education's topic workspace (chart or table, years, the series list under its headings,
 * Excel) with Social's rules. One heading is charted at a time, a counting change is drawn as a rule, and a year a programme
 * ran only part of is marked with its months in the table. Social payments switches its money between million GEL and
 * % of GDP with the Money and banks icon switch; the latest line keeps the money headline, so the view is read from the
 * unit caption beside the switch.
 */
export function SocialExplorer({ section, facts, gdpFacts, gdpSources, breaks, labels, headingLabels, latestLine, sources, lastReviewedAt, siteOrigin }: SocialExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `social.${key}`, values);
  const data = useMemo(() => ({ section, facts, gdpFacts }), [section, facts, gdpFacts]);
  const { state, update } = useHashState(data, parseSocialState, serializeSocialState);
  const [query, setQuery] = useState("");
  const model = buildSocialModel(section, facts, state, { breaks, gdpFacts });
  const list = socialTopicList(section, facts, gdpFacts, state);
  const gdpView = state.view === "gdp";
  const unitLabelOf = (unit: keyof typeof SOCIAL_UNIT_KEYS) => t(SOCIAL_UNIT_KEYS[unit]);
  const lead = model.selected[0] ?? model.series[0]!;
  const unit: ValueUnit = { divisor: 1, label: "", decimals: lead.decimals };
  const unitLabel = gdpView ? t("unitPercentGdp") : unitLabelOf(model.unit);
  const valueLabel = (value: number | null | undefined) => value == null ? "—" : gdpView ? `${formatInUnit(value, unit)}%` : `${formatInUnit(value, unit)} ${unitLabel}`;
  // Outside the list a row is named in full, "Money paid — State pension".
  const fullLabel = (series: { id: string; heading: string }) => educationFullLabel(headingLabels[series.heading], labels[series.id]);
  const partialMark = (months: Record<number, number>) => Object.fromEntries(Object.entries(months).map(([year, n]) => [year, t("months.partial", { n })]));
  const rows = model.selected.map(series => ({ itemId: series.id, kaLabel: fullLabel(series), color: series.color, valuesByYear: series.valuesByYear, markByYear: partialMark(series.partialMonths) }));
  const lineSeries = model.selected.map(series => ({ id: series.id, label: fullLabel(series), color: series.color, vals: model.years.map(year => series.valuesByYear[year]) }));
  const reference = model.series.find(series => series.reference);
  const total = rows.find(row => row.itemId === reference?.id) ?? null;
  const title = t(`page.${section}.title`);
  const chartLabel = `${title} · ${headingLabels[model.heading]}`;
  const newCounting = t("break.newCounting");
  const views = socialViews(section, model.heading);
  // % of GDP divides by the debt page's GDP: the source line names it and its preliminary years, as on Money and banks.
  const preliminaryGdpYears = gdpView ? model.years.filter(year => gdpFacts.some(f => f.year === year && f.status === "preliminary")) : [];
  const changeView = (view: SocialPayView) => { if (view !== state.view) update(s => changeSocialView(s, section, view, facts, gdpFacts), true); };
  const downloadAction = <ExcelDownloadButton testId="social-excel-download" disabled={!model.selected.length} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildSocialWorkbookExportModel({
      section, facts, state, gdpFacts, labels, headingLabels, sources, populationSources: [], cpiSources: [], gdpSources, siteOrigin, title,
    }, presentation));
  }} />;
  return <div data-testid={`social-${section}`} className="@container">
    <ExplorerHeading>{title}</ExplorerHeading>
    <LatestValueLine testId="social-latest" sentence={latestLine} />
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section aria-label={chartLabel} data-testid="chart-panel" data-mode={state.mode} data-view={state.view} data-heading={model.heading} className="border-t border-[var(--ink)] pt-4">
          <div className={`flex flex-wrap ${views.length > 1 ? "items-center" : "items-end"} justify-between gap-3`}>
            <ModeTabs value={state.mode} onChange={mode => update(s => ({ ...s, mode }), true)} />
            <div className="flex items-center gap-3.5">
              <span data-testid="social-unit-label" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
              {views.length > 1 ? <SegmentedTabs ariaLabel={t("measure")} value={state.view} onChange={changeView} options={views.map(view => ({
                value: view, label: t(`tab.${view}`), testId: `social-measure-${view}`,
                icon: view === "gdp" ? <ChartPie aria-hidden="true" size={18} strokeWidth={1.5} /> : <span aria-hidden="true" className="text-base">₾</span>,
              }))} /> : null}
            </div>
          </div>
          {!model.selected.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={lineSeries} share={gdpView} unit={unit} shareLabel={gdpView ? t("tab.gdp") : chartLabel} formatTooltipValue={valueLabel} breaks={model.breaks.map(item => ({ year: item.year, label: newCounting }))} /></div>
            : <ExplorerTable caption={`${chartLabel} · ${unitLabel} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row !== total)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized years={model.years} firstColumnLabel={t("series")} unit={unit} share={gdpView} showChangeColumn={false}
              // % of GDP cells print as Money and banks prints them, "5.90%".
              shareValueForYear={(row, year) => { const value = row.valuesByYear[year]; return value == null ? null : value / 100; }} shareDecimalsForRow={() => lead.decimals}
              breakYears={model.breaks.map(item => item.year)} breakLabel={newCounting} />}
          <ChartSelectionAids series={lineSeries} chartShown={state.mode === "line"} share={gdpView} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={socialCoverage(section, state.view, facts, gdpFacts, state.selectedIds).years} range={model.range}
            onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildSocialModel(section, facts, s, { breaks, gdpFacts }).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t(`sourceNote.${section}`)}
          {gdpView ? <> · {message(messages, "main.gdpSource")}{preliminaryGdpYears.length ? ` ${message(messages, "main.preliminaryGdp", { years: preliminaryGdpYears.join(", ") })}` : null}</> : null}
          {" · "}{unitLabel} · {model.range.start}–{model.range.end} · <span className="whitespace-nowrap">{updatedDate(lastReviewedAt, locale)}</span>
          <Link href={pageHref("/methodology/social-protection", locale)} prefetch={false} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <FlatSeriesPanel asideLabel={message(messages, "controls.series")} caption={list.end} downloadAction={downloadAction}
        rows={model.series.map(series => {
          const { latest, headingYear } = list.rows[series.id]!;
          // Counts need no unit beside their heading; money, averages and the return name theirs (the return keeps its own in the % of GDP view).
          const heading = series.unit === "persons" || series.unit === "families" || series.unit === "employers" ? headingLabels[series.heading] : `${headingLabels[series.heading]} · ${gdpView && series.unit === "percent" ? t("unitPercentGdp") : unitLabelOf(series.unit)}`;
          return { id: series.id, label: labels[series.id], color: series.color, value: formatInUnit(latest?.value, { divisor: 1, label: "", decimals: series.decimals }),
            heading: headingYear ? `${heading} · ${headingYear}` : heading };
        })}
        totalId={reference?.id} pinTotal selectedIds={state.selectedIds} onSelectionChange={selectedIds => update(s => changeSocialSelection(s, section, selectedIds, facts, gdpFacts), true)}
        query={query} onQueryChange={setQuery} searchPlaceholder={t("search")} searchable />
    </ExplorerWorkspace>
  </div>;
}
