"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientUnemploymentObservation, UnemploymentBreakdown, UnemploymentGroupDefinition, UnemploymentIndicator, UnemploymentSex } from "../../lib/data/unemployment/types";
import { unemploymentIndicators } from "../../lib/data/unemployment/types";
import { buildUnemploymentModel, buildUnemploymentComposition } from "../../lib/explorer/unemployment";
import { changeUnemploymentBreakdown, changeUnemploymentEducationSex, changeUnemploymentIndicator, UNEMPLOYMENT_BREAKDOWNS, type UnemploymentState } from "../../lib/explorer/unemploymentState";
import { buildUnemploymentWorkbookExportModel } from "../../lib/explorer/unemploymentWorkbook";
import { formatDisplayDate, formatInUnit, formatShare } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { Callout, SegmentedTabs, SourceNote, SwatchBar, SectionTitle } from "../ui/editorial";
import { UnemploymentSeriesPanel } from "./unemployment-series-panel";
import { useUnemploymentState } from "./use-unemployment-state";

export type UnemploymentExplorerProps = { facts: ClientUnemploymentObservation[]; registry: UnemploymentGroupDefinition[]; sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string };
const selectClass = "min-w-0 w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent py-2 text-[12px] text-[var(--ink)]";
export function UnemploymentExplorer({ facts, registry, sources, lastReviewedAt, siteOrigin }: UnemploymentExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string) => message(messages, `unemployment.${key}`);
  const { state, update } = useUnemploymentState(facts, registry);
  const [query, setQuery] = useState(""), [announcement, setAnnouncement] = useState("");
  const model = useMemo(() => buildUnemploymentModel(facts, registry, state), [facts, registry, state]);
  const composition = useMemo(() => buildUnemploymentComposition(facts, model.years), [facts, model.years]);
  const labels = new Map(registry.map(group => [group.id, locale === "en" ? group.labelEn : group.labelKa]));
  const indicatorLabel = t(`indicator.${state.indicator}`), unit = { divisor: 1, label: t("thousandPersons"), decimals: 1 };
  const valueLabel = (value: number | null | undefined) => model.percent ? formatShare(value == null ? null : value / 100) : `${formatInUnit(value, unit)} ${unit.label}`;
  const rows = model.rows.map(row => ({ ...row, kaLabel: labels.get(row.itemId)! }));
  const total = rows.find(row => row.itemId === model.referenceId) ?? null;
  const change = (transform: (previous: UnemploymentState) => UnemploymentState) => {
    const next = update(transform, "push"), nextModel = buildUnemploymentModel(facts, registry, next);
    setAnnouncement(`${t(`indicator.${next.indicator}`)} · ${nextModel.range.start}–${nextModel.range.end}`);
  };
  const noteKey = ({ age: "ageNote", region: "regionNote", education: "educationNote", long_term: "longTermNote" } as Partial<Record<UnemploymentBreakdown, string>>)[state.breakdown];
  return <div data-testid="unemployment-explorer" className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("summary")}</p>
    <p data-testid="unemployment-headline" className="mb-2 text-[13px] text-[var(--body)]">
      {labels.get(model.referenceId)} · {indicatorLabel} · {model.headline?.year ?? "—"}: <span className="font-[family-name:var(--font-numeric)] font-medium text-[var(--ink)]">{valueLabel(model.headline?.value)}</span>
    </p>
    <p className="mb-[30px] text-[12px] leading-relaxed text-[var(--muted)]">{t("surveyEstimate")}{noteKey ? ` · ${t(noteKey)}` : ""}</p>
    <p role="status" className="sr-only">{announcement}</p>
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-indicator={state.indicator} data-breakdown={state.breakdown} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), "push")}
              options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            <label className="min-w-0 w-full text-[10px] font-semibold text-[var(--muted)] min-[768px]:max-w-[360px]">{t("indicator")}
              <select data-testid="unemployment-indicator" value={state.indicator} className={selectClass} onChange={event => { const indicator = event.target.value as UnemploymentIndicator; change(s => changeUnemploymentIndicator(s, indicator, facts)); }}>
                {unemploymentIndicators(state.breakdown).map(indicator => <option key={indicator} value={indicator}>{t(`indicator.${indicator}`)}</option>)}
              </select>
            </label>
          </div>
          {!state.selectedIds.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : !model.hasData ? <div className="mt-5"><Callout testId="no-range-data-callout">{t("emptyRange")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.series.map(series => ({ ...series, label: labels.get(series.id)! }))} share={model.percent} unit={unit} shareLabel={indicatorLabel} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${indicatorLabel} · ${model.percent ? "%" : unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== model.referenceId)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized
              years={model.years} firstColumnLabel={t("group")} unit={unit} share={model.percent} showChangeColumn={false} shareValueForYear={(row, year) => row.valuesByYear[year] ?? null} />}
          <RangeStrip years={model.availableYears} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildUnemploymentModel(facts, registry, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} {model.range.start}–{model.range.end} · {formatDisplayDate(lastReviewedAt, locale)}
          <Link href={pageHref("/methodology/unemployment", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
      </div>
      <UnemploymentSeriesPanel definitions={model.definitions} referenceId={model.referenceId} selectedIds={state.selectedIds} endYear={model.range.end} endValues={model.endValues} indicator={state.indicator} query={query} onQueryChange={setQuery}
        onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }))}
        controls={<div className="space-y-3">
          <label className="block text-[10px] font-semibold text-[var(--muted)]">{t("breakdown")}
            <select data-testid="unemployment-breakdown" value={state.breakdown} className={selectClass} onChange={event => { const breakdown = event.target.value as UnemploymentBreakdown; setQuery(""); change(s => changeUnemploymentBreakdown(s, breakdown, facts)); }}>
              {UNEMPLOYMENT_BREAKDOWNS.map(breakdown => <option key={breakdown} value={breakdown}>{t(`breakdown.${breakdown}`)}</option>)}
            </select>
          </label>
          {state.breakdown === "education" ? <SegmentedTabs ariaLabel={t("sex")} value={state.educationSex} onChange={(sex: UnemploymentSex) => change(s => changeUnemploymentEducationSex(s, sex, facts))} options={(["total", "women", "men"] as const).map(sex => ({ value: sex, label: t(`sex.${sex}`) }))} /> : null}
        </div>}
        downloadAction={<ExcelDownloadButton testId="unemployment-excel-download" disabled={!state.selectedIds.length || !model.hasData} onDownload={async () => {
          const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
          await downloadWorkbook(buildUnemploymentWorkbookExportModel(facts, registry, state, presentation, sources, siteOrigin));
        }} />} />
    </ExplorerWorkspace>
    <section data-testid="unemployment-composition" className="mt-12 border-t-2 border-[var(--ink)] pt-5">
      <SectionTitle>{t("compositionTitle")}</SectionTitle>
      <p className="mt-2 max-w-[900px] text-[12px] leading-relaxed text-[var(--muted)]">{t("compositionNote")}</p>
      <div className="my-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[var(--muted)]">{composition.segments.map(segment => <span key={segment.id} className="flex items-center gap-2"><SwatchBar color={segment.color} />{t(`composition.${segment.id}`)}</span>)}</div>
      <StackedColumnChart {...composition} segments={composition.segments.map(segment => ({ ...segment, label: t(`composition.${segment.id}`) }))} formatPeriod={String} formatValue={value => `${formatInUnit(value, unit)} ${unit.label}`} ariaLabel={t("compositionAria")} />
    </section>
  </div>;
}
