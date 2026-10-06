"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CENSUS_STEP } from "../../lib/data/demography/series";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  municipalityCodeForPlaceId,
  placeIdForMunicipalityCode,
  type DemographyPlace,
} from "../../lib/explorer/demographyAreas";
import {
  buildPopulationHighlights,
  buildPopulationModel,
  changeLevel,
  changeMeasure,
  chooseGeorgia,
  chooseOnMap,
  populationBasisKey,
  setTabSelection,
  toggleSelected,
} from "../../lib/explorer/demographyPopulation";
import type { PopulationMapModels } from "../../lib/explorer/demographyPopulationMaps";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { formatInUnit, thousandsUnit, UNIT_DENSITY, UNIT_PERSONS } from "../../lib/explorer/format";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerWorkspace } from "../explorer-shell/explorer-workspace";
import { MeasurePill } from "../explorer-shell/measure-pill";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { MunicipalityMap } from "../municipalities/municipality-map";
import { RegionalEconomyMap } from "../regional-economies/regional-economy-map";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { PopulationHighlightsSection } from "./population-highlights";
import { PopulationSeriesPanel } from "./population-series-panel";
import { usePopulationState } from "./use-population-state";

export function PopulationExplorer({
  facts,
  places,
  maps,
  tbilisiArea,
  sources,
  siteOrigin,
}: {
  facts: ClientDemographyObservation[];
  places: DemographyPlace[];
  maps: PopulationMapModels;
  /** Tbilisi's area in km² as the reviewed density mapping records it, already formatted (the page reads it, the note prints it). */
  tbilisiArea: string;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const validIds = useMemo(() => places.map((place) => place.id), [places]);
  const { state, update } = usePopulationState(validIds);
  const model = useMemo(() => buildPopulationModel({ facts, places, state, locale }), [facts, places, state, locale]);
  const highlights = useMemo(() => buildPopulationHighlights(model, facts, places), [model, facts, places]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const regions = state.level === "regions";
  const density = regions && state.map === "density";
  const mapYear = density ? maps.densityYear : maps.populationYear;
  const mapUnit = density ? UNIT_DENSITY : UNIT_PERSONS;
  const mapCaption = t(density ? "mapLegendDensity" : "mapLegendPopulation", { year: mapYear });
  const mapAria = t("mapAria", { measure: t(density ? "measureDensity" : "measurePopulation"), year: mapYear });
  const regionModel = density ? maps.regionsDensity : maps.regionsPopulation;
  const municipalityModel = maps.municipalitiesPopulation;
  const selectedRegionIds = state.selectedIds.filter((id) => id.startsWith("region."));
  const selectedCodes = state.selectedIds
    .filter((id) => id === TBILISI_PLACE_ID || places.find((place) => place.id === id)?.level === "municipality")
    .map(municipalityCodeForPlaceId);
  const onlyGeorgia = state.selectedIds.length === 1 && state.selectedIds[0] === GEORGIA_PLACE_ID;
  const breakLabel = t("breakLabel");
  const georgiaRow = model.rows.find((row) => row.itemId === GEORGIA_PLACE_ID) ?? null;
  const rebase = formatInUnit(Math.round(CENSUS_STEP.residual / 1000) * 1000, UNIT_PERSONS);

  return (
    <div data-testid="population-explorer" className="@container">
      <section data-testid="population-map-block" className="mb-10 max-w-[820px]">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <MeasurePill
            testId="population-georgia-pill"
            label={t("georgiaPill")}
            pressed={onlyGeorgia}
            onChange={() => update(chooseGeorgia)}
          />
          <SegmentedTabs
            ariaLabel={t("levelAria")}
            value={state.level}
            onChange={(level) => update((previous) => changeLevel(previous, level))}
            options={[
              { value: "regions", label: t("tabRegions"), testId: "population-level-regions" },
              { value: "municipalities", label: t("tabMunicipalities"), testId: "population-level-municipalities" },
            ]}
          />
          <SegmentedTabs
            ariaLabel={t("measureAria")}
            value={state.map}
            onChange={(map) => update((previous) => changeMeasure(previous, map))}
            options={[
              { value: "population", label: t("measurePopulation"), testId: "population-measure-population" },
              { value: "density", label: t("measureDensity"), testId: "population-measure-density", disabled: !regions },
            ]}
          />
        </div>
        {!regions ? (
          <p data-testid="population-density-note" className="mb-2 text-[12px] text-[var(--muted)]">{t("densityRegionsOnly")}</p>
        ) : null}
        {regions ? (
          <RegionalEconomyMap
            model={regionModel}
            activeRegionId={activeRegionId}
            onActiveRegionChange={setActiveRegionId}
            onSelect={(regionId) => update((previous) => chooseOnMap(previous, regionId))}
            selectedIds={selectedRegionIds}
            wording={{
              groupAria: mapAria,
              legendMin: formatInUnit(regionModel.legendMinGel, mapUnit),
              legendMax: formatInUnit(regionModel.legendMaxGel, mapUnit),
              legendCaption: mapCaption,
            }}
          />
        ) : (
          <MunicipalityMap
            viewBox={municipalityModel.viewBox}
            shapes={municipalityModel.shapes}
            markers={municipalityModel.markers}
            occupiedAreas={municipalityModel.occupiedAreas}
            legendMin={formatInUnit(municipalityModel.legendMinPerResidentGel, UNIT_PERSONS)}
            legendMax={formatInUnit(municipalityModel.legendMaxPerResidentGel, UNIT_PERSONS)}
            activeCode={activeCode}
            onActiveCodeChange={setActiveCode}
            onOpenMunicipality={(code) => update((previous) => chooseOnMap(previous, placeIdForMunicipalityCode(code)))}
            selectedCodes={selectedCodes}
            wording={{ groupAria: mapAria, legendCaption: mapCaption }}
          />
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{t("mapCensusNote")}</p>
        {density ? <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{t("densityNote", { area: tbilisiArea })}</p> : null}
      </section>

      <p role="status" className="sr-only">{t("rangeChanged", { start: model.range.start, end: model.range.end })}</p>
      <ExplorerWorkspace>
        <div className="flex min-w-0 flex-col">
          <section data-testid="population-chart-panel" data-mode={state.mode} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedTabs
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => update((previous) => ({ ...previous, mode }))}
                options={[
                  { value: "line", label: message(messages, "controls.chart"), testId: "population-mode-line" },
                  { value: "table", label: message(messages, "controls.table"), testId: "population-mode-table" },
                ]}
              />
            </div>
            {!state.selectedIds.length ? (
              <div className="mt-5"><Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout></div>
            ) : !model.hasData ? (
              <div className="mt-5"><Callout testId="no-range-data-callout">{message(messages, "main.noRangeData")}</Callout></div>
            ) : state.mode === "line" ? (
              <div className="mt-5">
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
              </div>
            ) : (
              <ExplorerTable
                caption={`${t("tableCaption")} · ${model.range.start}–${model.range.end} · ${t("censusNote", { count: rebase })}`}
                rows={model.rows.filter((row) => row.itemId !== GEORGIA_PLACE_ID)}
                totalRow={georgiaRow}
                showTotal={Boolean(georgiaRow)}
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
            <RangeStrip
              years={model.availableYears}
              range={model.range}
              marker={{ year: CENSUS_STEP.toYear, label: breakLabel }}
              onChange={(patch) => update((previous) => ({ ...previous, range: rangeFromPatch(model.range, patch) }))}
            />
          </section>
          <div className="mt-[18px]">
            <SourceNote testId="population-source-note">
              {t("source", { start: model.range.start, end: model.range.end })}{" "}
              <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
                {message(messages, "common.methodology")}
              </Link>
            </SourceNote>
          </div>
          <div className="mt-3 border-l-2 border-[var(--accent)] bg-[var(--tint)] px-3.5 py-3">
            <SourceNote testId="population-census-note">{t("censusNote", { count: rebase })}</SourceNote>
          </div>
        </div>
        <PopulationSeriesPanel
          places={places}
          listed={model.listed}
          level={state.level}
          selectedIds={state.selectedIds}
          endYear={model.range.end}
          endValues={model.endValues}
          onLevelChange={(level) => update((previous) => changeLevel(previous, level))}
          onToggle={(id) => update((previous) => toggleSelected(previous, id))}
          onSetTabSelection={(selected) =>
            update((previous) => setTabSelection(previous, model.listed.map((place) => place.id), selected))}
          downloadAction={
            <ExcelDownloadButton
              testId="population-excel-download"
              disabled={!state.selectedIds.length || !model.hasData}
              onDownload={async () => {
                const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
                await downloadWorkbook(buildPopulationWorkbookExportModel(facts, places, state, presentation, sources, siteOrigin));
              }}
            />
          }
        />
      </ExplorerWorkspace>
      {highlights ? <PopulationHighlightsSection highlights={highlights} /> : null}
    </div>
  );
}
