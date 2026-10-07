"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClientUnemploymentObservation, UnemploymentBreakdown, UnemploymentGroupDefinition, UnemploymentIndicator, UnemploymentSex } from "../../lib/data/unemployment/types";
import { unemploymentIndicators, unemploymentIsRate } from "../../lib/data/unemployment/types";
import { buildUnemploymentModel, buildUnemploymentComposition } from "../../lib/explorer/unemployment";
import { buildUnemploymentAgeHeatmap } from "../../lib/explorer/unemploymentAge";
import { changeUnemploymentBreakdown, changeUnemploymentEducationSex, changeUnemploymentIndicator, changeUnemploymentOverviewSelection, type UnemploymentState } from "../../lib/explorer/unemploymentState";
import { unemploymentSeriesLabel, unemploymentUsesIndicatorSeries } from "../../lib/explorer/unemploymentOverview";
import { NATIONAL_UNEMPLOYMENT_VIEWS, type UnemploymentSectionId } from "../../lib/explorer/unemploymentSections";
import { buildUnemploymentWorkbookExportModel } from "../../lib/explorer/unemploymentWorkbook";
import { formatDisplayDate, formatInUnit, formatShare } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import { publicLabel } from "../../lib/i18n/labels";
import { unemploymentRegionHref } from "../../lib/explorer/unemploymentRegionRoutes";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { RegionPicker } from "../regional-economies/region-picker";
import { ChevronDown } from "lucide-react";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { EntityNeighbourLinks } from "../explorer-shell/entity-neighbour-links";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { Callout, SegmentedTabs, SourceNote, SwatchBar, SectionTitle, TextTab } from "../ui/editorial";
import { UnemploymentSeriesPanel } from "./unemployment-series-panel";
import { UnemploymentOverviewSeriesPanel } from "./unemployment-overview-series-panel";
import { useUnemploymentState } from "./use-unemployment-state";
import { UnemploymentAgeHeatmap } from "./unemployment-age-heatmap";

export type UnemploymentExplorerProps = { section: UnemploymentSectionId; regionId?: string; regions?: MunicipalRegion[]; facts: ClientUnemploymentObservation[]; registry: UnemploymentGroupDefinition[]; sources: (WorkbookPublicSource & { sourceId: string })[]; lastReviewedAt: string; siteOrigin: string };
const selectClass = "min-w-0 w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent py-2 text-[12px] text-[var(--ink)]";
export function UnemploymentExplorer({ section, regionId, regions, facts, registry, sources, lastReviewedAt, siteOrigin }: UnemploymentExplorerProps) {
  const presentation = useI18n(), { locale, messages } = presentation;
  const t = (key: string) => message(messages, `unemployment.${key}`);
  const { state, update } = useUnemploymentState(facts, registry, section, regionId);
  const [query, setQuery] = useState(""), [announcement, setAnnouncement] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const region = regionId ? registry.find(group => group.id === regionId)! : null;
  const regionName = region ? locale === "en" ? region.labelEn : region.labelKa : "";
  const orderedRegions = (regions ?? []).slice().sort((left, right) => left.sortOrder - right.sortOrder);
  const regionIndex = orderedRegions.findIndex(candidate => candidate.id === regionId);
  const neighbours = regionIndex < 0 ? null : {
    previous: orderedRegions[(regionIndex - 1 + orderedRegions.length) % orderedRegions.length]!,
    next: orderedRegions[(regionIndex + 1) % orderedRegions.length]!,
  };
  const model = useMemo(() => buildUnemploymentModel(facts, registry, state), [facts, registry, state]);
  const composition = useMemo(() => buildUnemploymentComposition(facts, model.years), [facts, model.years]);
  const ageHeatmap = useMemo(() => section === "age" ? buildUnemploymentAgeHeatmap(facts, registry, state.indicator, model.years) : null, [section, facts, registry, state.indicator, model.years]);
  const regionalStatusYears = section === "regions" ? facts.filter(f => f.dimension === "region" && ["hired", "self_employed"].includes(f.indicatorId)).map(f => f.year) : [];
  const labels = new Map(model.definitions.map(group => [group.id, unemploymentSeriesLabel(group, state, presentation)]));
  const selectedIndicators = [...new Set(model.definitions.filter(group => state.selectedIds.includes(group.id)).map(group => group.indicatorId))];
  const indicatorLabel = (selectedIndicators.length ? selectedIndicators : [state.indicator]).map(indicator => t(`indicator.${indicator}`)).join(" · "), unit = { divisor: 1, label: t("thousandPersons"), decimals: 1 };
  const valueLabel = (value: number | null | undefined) => model.percent ? formatShare(value == null ? null : value / 100) : `${formatInUnit(value, unit)} ${unit.label}`;
  // Latest value of the active indicator for the page's own place (Georgia, or the region).
  // The age page carries no national rows, so it states its first selected group instead.
  const placeFacts = facts.filter(f => f.dimension === (regionId ? "region" : "national") && (!regionId || f.groupId === regionId) && f.indicatorId === state.indicator && f.value != null);
  const latestGroup = placeFacts.length ? null : model.definitions.find(group => state.selectedIds.includes(group.id)) ?? null;
  const latest = (latestGroup ? facts.filter(f => f.groupId === latestGroup.groupId && f.indicatorId === latestGroup.indicatorId && f.value != null) : placeFacts).sort((a, b) => a.year - b.year).at(-1);
  const latestGroupLabel = latestGroup ? registry.find(group => group.id === latestGroup.groupId) : undefined;
  const latestMeasure = t(`indicator.${latestGroup?.indicatorId ?? state.indicator}`) + (latestGroupLabel ? ` · ${locale === "en" ? latestGroupLabel.labelEn : latestGroupLabel.labelKa}` : "");
  const rows = model.rows.map(row => ({ ...row, kaLabel: labels.get(row.itemId)! }));
  const total = rows.find(row => row.itemId === model.referenceId) ?? null;
  const change = (transform: (previous: UnemploymentState) => UnemploymentState) => {
    const next = update(transform, "push"), nextModel = buildUnemploymentModel(facts, registry, next);
    setAnnouncement(`${t(`indicator.${next.indicator}`)} · ${nextModel.range.start}–${nextModel.range.end}`);
  };
  const noteKey = ({ age: "ageNote", region: "regionNote", education: "educationNote", long_term: "longTermNote" } as Partial<Record<UnemploymentBreakdown, string>>)[state.breakdown];
  const downloadAction = <ExcelDownloadButton testId="unemployment-excel-download" disabled={!state.selectedIds.length || !model.hasData} onDownload={async () => {
    const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
    await downloadWorkbook(buildUnemploymentWorkbookExportModel(facts, registry, state, presentation, sources, siteOrigin));
  }} />;
  return <div data-testid="unemployment-explorer" className="@container">
    {region ? <div className="flex flex-col min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between min-[768px]:gap-3">
      <div className="relative min-w-0 min-[768px]:flex-1">
        <ExplorerHeading>{t("regionHeadingLead")}{" "}
          <button type="button" data-testid="region-picker-trigger" aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {regionName}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </ExplorerHeading>
        <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} regions={regions!} activeRegionId={region.id} hrefForRegion={unemploymentRegionHref} indexHref="/explorer/unemployment/regions" />
      </div>
      {/* Previous/next in the regions' fixed order, as on Economy region pages;
          the bottom margin matches the heading's so both share a baseline row. */}
      {neighbours ? <EntityNeighbourLinks
        testId="unemployment-region-navigation"
        className="mb-3"
        previous={{ href: pageHref(unemploymentRegionHref(neighbours.previous.id), locale), label: publicLabel(locale, neighbours.previous.id, neighbours.previous.kaLabel, presentation.englishLabels) }}
        next={{ href: pageHref(unemploymentRegionHref(neighbours.next.id), locale), label: publicLabel(locale, neighbours.next.id, neighbours.next.kaLabel, presentation.englishLabels) }}
      /> : null}
    </div> : <ExplorerHeading>{t(`page.${section}.title`)}</ExplorerHeading>}
    {latest ? <LatestValueLine testId="unemployment-latest" measure={latestMeasure} period={latest.year} value={valueLabel(latest.value)} /> : null}
    <p className="mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{region ? message(messages, "unemployment.regionSummary", { region: regionName }) : t(section === "regions" ? "regionalComparisonSummary" : `page.${section}.summary`)}</p>
    <p role="status" className="sr-only">{announcement}</p>
    {section === "overview" ? <div data-testid="unemployment-national-tabs" role="group" aria-label={t("nationalViews")} className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-3">
      {NATIONAL_UNEMPLOYMENT_VIEWS.map(breakdown => <TextTab key={breakdown} label={t(breakdown === "national" ? "overviewTab" : `breakdown.${breakdown}`)} active={state.breakdown === breakdown} testId={`unemployment-tab-${breakdown}`} onClick={() => { if (breakdown === state.breakdown) return; setQuery(""); change(s => changeUnemploymentBreakdown(s, breakdown, facts)); }} />)}
    </div> : null}
    <ExplorerWorkspace>
      <div className="flex min-w-0 flex-col">
        <section data-testid="chart-panel" data-mode={state.mode} data-indicator={state.indicator} data-breakdown={state.breakdown} data-unit={model.percent ? "percent" : "thousand_persons"} className="border-t border-[var(--ink)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={mode => update(s => ({ ...s, mode }), "push")}
              options={[{ value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" }, { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" }]} />
            {section === "age" ? <label className="min-w-0 w-full text-[10px] font-semibold text-[var(--muted)] min-[768px]:max-w-[360px]"><span className="sr-only">{t("indicator")}</span>
                <select data-testid="unemployment-indicator" value={state.indicator} className={selectClass}
                  onChange={event => { const indicator = event.target.value as UnemploymentIndicator; change(s => changeUnemploymentIndicator(s, indicator, facts)); }}>
                  {[true, false].map(rate => <optgroup key={String(rate)} label={t(rate ? "rateHeader" : "countHeader")}>
                    {unemploymentIndicators(state.breakdown).filter(indicator => unemploymentIsRate(indicator) === rate).map(indicator => <option key={indicator} value={indicator}>{t(`indicator.${indicator}`)}</option>)}
                  </optgroup>)}
                </select>
            </label> : <span className="text-[11px] text-[var(--muted)]">{model.percent ? "%" : unit.label}</span>}
          </div>
          {!state.selectedIds.length ? <div className="mt-5"><Callout testId="no-selection-callout">{t("emptySelection")}</Callout></div>
            : !model.hasData ? <div className="mt-5"><Callout testId="no-range-data-callout">{t("emptyRange")}</Callout></div>
            : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={model.series.map(series => ({ ...series, label: labels.get(series.id)! }))} share={model.percent} unit={unit} shareLabel={indicatorLabel} axisLeftPadding={model.percent ? undefined : 180} formatTooltipValue={valueLabel} /></div>
            : <ExplorerTable caption={`${indicatorLabel} · ${model.percent ? "%" : unit.label} · ${model.range.start}–${model.range.end}`} rows={rows.filter(row => row.itemId !== model.referenceId)} totalRow={total} showTotal={Boolean(total)} totalFirst wrapRowLabels rowLabelsLocalized
              years={model.years} firstColumnLabel={t(unemploymentUsesIndicatorSeries(state) ? "series" : "group")} unit={unit} share={model.percent} showChangeColumn={false} shareValueForYear={(row, year) => row.valuesByYear[year] ?? null} />}
          <ChartSelectionAids series={model.series.map(series => ({ ...series, label: labels.get(series.id)! }))} chartShown={state.mode === "line"} share={model.percent} unit={unit} formatValue={valueLabel} />
          <RangeStrip years={model.availableYears} range={model.range} onChange={patch => update(s => ({ ...s, range: rangeFromPatch(buildUnemploymentModel(facts, registry, s).range, patch) }))} />
        </section>
        <div className="mt-[18px]"><SourceNote testId="source-label">{t("sourceNote")} {model.range.start}–{model.range.end} · {locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt}
          <Link href={pageHref("/methodology/unemployment", locale)} className="ml-2 text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link>
        </SourceNote></div>
        {(section === "overview" || section === "regions") && noteKey ? <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t(noteKey)}</p> : null}
        {(section === "overview" && ["national", "settlement"].includes(state.breakdown) || regionalStatusYears.length > 0) ? <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("employmentStatusNote")}{regionalStatusYears.length > 0 ? ` ${message(messages, "unemployment.regionalEmploymentStatusNote", { start: Math.min(...regionalStatusYears), end: Math.max(...regionalStatusYears) })}` : null}</p> : null}
      </div>
      {unemploymentUsesIndicatorSeries(state) ? <UnemploymentOverviewSeriesPanel key={state.breakdown} definitions={model.definitions} referenceId={model.referenceId} state={state} endYear={model.range.end} endValues={model.endValues} query={query} onQueryChange={setQuery}
        onSelectionChange={selectedIds => change(s => changeUnemploymentOverviewSelection(s, selectedIds, facts, registry))} downloadAction={downloadAction} /> : <UnemploymentSeriesPanel definitions={model.definitions} referenceId={model.referenceId} selectedIds={state.selectedIds} endYear={model.range.end} endValues={model.endValues} indicator={state.indicator} query={query} onQueryChange={setQuery}
        onSelectionChange={selectedIds => update(s => ({ ...s, selectedIds }))}
        controls={state.breakdown === "education" ? <SegmentedTabs ariaLabel={t("sex")} value={state.educationSex} onChange={(sex: UnemploymentSex) => change(s => changeUnemploymentEducationSex(s, sex, facts))} options={(["total", "women", "men"] as const).map(sex => ({ value: sex, label: t(`sex.${sex}`) }))} /> : undefined}
        downloadAction={downloadAction} />}
    </ExplorerWorkspace>
    {ageHeatmap ? <UnemploymentAgeHeatmap model={ageHeatmap} indicator={state.indicator} /> : null}
    {section === "overview" && state.breakdown === "national" ? <section data-testid="unemployment-composition" className="mt-12 border-t-2 border-[var(--ink)] pt-5">
      <SectionTitle>{t("compositionTitle")}</SectionTitle>
      <p className="mt-2 max-w-[900px] text-[12px] leading-relaxed text-[var(--muted)]">{t("compositionNote")}</p>
      <div className="my-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[var(--muted)]">{composition.segments.map(segment => <span key={segment.id} className="flex items-center gap-2"><SwatchBar color={segment.color} />{t(`composition.${segment.id}`)}</span>)}</div>
      <StackedColumnChart {...composition} segments={composition.segments.map(segment => ({ ...segment, label: t(`composition.${segment.id}`) }))} formatPeriod={String} formatValue={value => `${formatInUnit(value, unit)} ${unit.label}`} ariaLabel={t("compositionAria")} />
    </section> : null}
  </div>;
}
