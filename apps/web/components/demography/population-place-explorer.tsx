"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CENSUS_STEP, SERIES } from "../../lib/data/demography/series";
import { partsOf, placeColor, placeIdForMunicipalityCode, placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildPopulationHighlights, buildPopulationModel, populationBasisKey } from "../../lib/explorer/demographyPopulation";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { formatInUnit, thousandsUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";
import { EntityHeading, type EntityNavigation } from "../municipalities/entity-heading";
import type { EntityPickerCountry, EntityPickerGroup, EntityPickerOverrides } from "../municipalities/entity-picker";
import { EntityWorkspaceShell } from "../municipalities/entity-workspace-shell";
import { useMunicipalState } from "../municipalities/use-municipal-state";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { PopulationHighlightsSection } from "./population-highlights";

export function PopulationPlaceExplorer({
  place,
  places,
  facts,
  title,
  metaLine,
  navigation,
  pickerCountry,
  pickerGroups,
  pickerOverrides,
  sourceNote,
  densityNote,
  sources,
  siteOrigin,
  workbookScope,
  backHref,
  children,
}: {
  place: DemographyPlace;
  places: DemographyPlace[];
  facts: ClientDemographyObservation[];
  title: string;
  metaLine: string;
  navigation?: EntityNavigation;
  pickerCountry: EntityPickerCountry;
  pickerGroups: EntityPickerGroup[];
  pickerOverrides?: EntityPickerOverrides;
  /** Inline content only: it renders inside the source note's paragraph. */
  sourceNote: ReactNode;
  /** The area note for a page that shows a density (Georgia's, a region's); a municipality's page passes none. */
  densityNote?: string;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  /** The place named in the Excel file (`batumi`, `region-adjara`, `georgia`). */
  workbookScope: string;
  backHref: string;
  children?: ReactNode;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);

  const parts = useMemo(() => partsOf(place, places), [place, places]);
  const listedIds = useMemo(() => new Set([place.id, ...parts.map((part) => part.id)]), [place, parts]);
  // The years of the place itself: Georgia 2004–2026, everything else 2015–2026. Its parts never reach further.
  const allYears = useMemo(
    () =>
      [...new Set(facts
        .filter((fact) => fact.seriesId === SERIES.populationTotal && placeIdForMunicipalityCode(fact.geographyId) === place.id)
        .map((fact) => fact.year))].sort((left, right) => left - right),
    [facts, place],
  );
  const state = useMunicipalState(allYears, [place.id], listedIds);
  useAppReady();
  const model = useMemo(
    () =>
      buildPopulationModel({
        facts,
        places,
        query: { selectedIds: state.selectedIds, range: { kind: "manual", start: state.range.start, end: state.range.end } },
        locale,
      }),
    [facts, places, state.selectedIds, state.range.start, state.range.end, locale],
  );
  const highlights = useMemo(() => buildPopulationHighlights(model, facts, places, place.id), [model, facts, places, place.id]);
  // The tick-list: the page's own place first whatever its value (the total stays first), then its parts in the order the model ranks them.
  const listed = useMemo(
    () => [place, ...model.ranked.filter((candidate) => candidate.id !== place.id && listedIds.has(candidate.id))],
    [model, place, listedIds],
  );

  const [seriesQuery, setSeriesQuery] = useState("");
  const regionOf = (candidate: DemographyPlace) => (candidate.regionId === null ? undefined : places.find((other) => other.id === candidate.regionId));
  const matches = (candidate: DemographyPlace) =>
    matchesLabelQuery(seriesQuery, [candidate.nameKa, candidate.nameEn, regionOf(candidate)?.nameKa ?? "", regionOf(candidate)?.nameEn ?? ""]);
  const visible = listed.filter((candidate) => candidate.id === place.id || matches(candidate));
  const hasSelection = state.selectedIds.length > 0;
  const breakLabel = t("breakLabel");
  const rebase = formatInUnit(Math.round(CENSUS_STEP.residual / 1000) * 1000, UNIT_PERSONS);
  const placeRow = model.rows.find((row) => row.itemId === place.id) ?? null;

  return (
    <>
      <EntityHeading
        title={title}
        triggerLabel={placeLabel(place, locale)}
        metaLine={metaLine}
        entityId={place.id}
        navigation={navigation}
        pickerCountry={pickerCountry}
        pickerGroups={pickerGroups}
        pickerOverrides={pickerOverrides}
      />
      <p role="status" className="sr-only">{t("rangeChanged", { start: model.range.start, end: model.range.end })}</p>
      <EntityWorkspaceShell
        testId="population-place-workspace"
        main={
          <>
            <section data-testid="population-chart-panel" data-mode={state.chartMode}>
              <div className="mb-[18px] flex flex-col items-start gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-5">
                <SegmentedTabs<ChartMode>
                  ariaLabel={message(messages, "municipal.viewMode")}
                  value={state.chartMode}
                  onChange={state.setChartMode}
                  options={[
                    { value: "line", label: message(messages, "municipal.line"), testId: "population-mode-line" },
                    { value: "table", label: message(messages, "municipal.table"), testId: "population-mode-table" },
                  ]}
                />
                <span className="min-w-0 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">{t("unitLine")}</span>
              </div>
              {!hasSelection ? (
                <div className="mt-5"><Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout></div>
              ) : !model.hasData ? (
                <div className="mt-5"><Callout testId="no-range-data-callout">{message(messages, "main.noRangeData")}</Callout></div>
              ) : state.chartMode === "line" ? (
                <EditorialLineChart
                  years={model.years}
                  series={model.series}
                  share={false}
                  unit={thousandsUnit(locale)}
                  shareLabel=""
                  formatTooltipValue={(value) => formatInUnit(value, UNIT_PERSONS)}
                  formatPeriod={(period, kind) =>
                    kind === "axis" ? String(period) : `${period} · ${message(messages, populationBasisKey(period))}`}
                  breaks={[{ year: CENSUS_STEP.toYear, label: breakLabel }]}
                />
              ) : (
                <ExplorerTable
                  caption={`${t("tableCaption")} · ${model.range.start}–${model.range.end} · ${t("censusNote", { count: rebase })}`}
                  rows={model.rows.filter((row) => row.itemId !== place.id)}
                  totalRow={placeRow}
                  showTotal={placeRow !== null}
                  totalFirst
                  wrapRowLabels
                  years={model.years}
                  firstColumnLabel={t("placeHeader")}
                  unit={UNIT_PERSONS}
                  share={false}
                  showChangeColumn={false}
                  rowLabelsLocalized
                  breakYears={[CENSUS_STEP.toYear]}
                  breakLabel={breakLabel}
                  shareValueForYear={() => null}
                />
              )}
              <div className="mt-6 border-t border-[var(--hairline-soft)] pt-4">
                <RangeStrip
                  years={allYears}
                  range={state.range}
                  marker={{ year: CENSUS_STEP.toYear, label: breakLabel, labelSide: "auto" }}
                  onChange={state.setRange}
                />
              </div>
            </section>
            <div className="mt-5 max-w-[640px]">
              <SourceNote testId="population-source-note">{sourceNote}</SourceNote>
            </div>
            <p
              data-testid="population-census-note"
              className="mt-5 max-w-[740px] border-l-2 border-[var(--accent)] bg-[var(--tint)] px-4 py-3 text-[13px] leading-[1.65] text-[var(--body)]"
            >
              {t("censusNote", { count: rebase })}
            </p>
            {children}
          </>
        }
        aside={
          <>
            <SeriesSelector
              query={seriesQuery}
              onQueryChange={setSeriesQuery}
              searchPlaceholder={message(messages, "municipal.search")}
              selectedCount={state.selectedIds.length}
              totalCount={listed.length}
              hasSelection={hasSelection}
              allSelected={listed.every((candidate) => state.selectedIds.includes(candidate.id))}
              onToggleAll={() => state.setSelectedIds(hasSelection ? [] : listed.map((candidate) => candidate.id))}
              hasVisibleMatches={listed.some(matches)}
            >
              {visible.map((candidate) => (
                <SeriesSelectorRow
                  key={candidate.id}
                  id={candidate.id}
                  label={placeLabel(candidate, locale)}
                  color={placeColor(candidate)}
                  value={formatInUnit(model.endValues[candidate.id] ?? null, UNIT_PERSONS)}
                  selected={state.selectedIds.includes(candidate.id)}
                  level={candidate.id === place.id ? "total" : "category"}
                  wrapLabel
                  onToggle={() => state.toggleSeries(candidate.id)}
                />
              ))}
            </SeriesSelector>
            <ExcelDownloadButton
              testId="population-excel-download"
              disabled={!hasSelection || !model.hasData}
              onDownload={async () => {
                const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
                await downloadWorkbook(
                  buildPopulationWorkbookExportModel(
                    facts,
                    places,
                    { selectedIds: state.selectedIds, range: { kind: "manual", start: state.range.start, end: state.range.end } },
                    presentation,
                    sources,
                    siteOrigin,
                    workbookScope,
                    place.id,
                  ),
                );
              }}
            />
            <Link
              href={pageHref(backHref, locale)}
              data-testid="population-back-link"
              className="mt-3.5 block text-[12px] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
            >
              {t("backToIndex")}
            </Link>
          </>
        }
      />
      {highlights ? <PopulationHighlightsSection highlights={highlights} densityNote={densityNote} /> : null}
    </>
  );
}
