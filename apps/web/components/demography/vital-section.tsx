"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INK, NEGATIVE, SERIES_COLORS } from "../../lib/explorer/colors";
import { placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildVitalPlaceModel } from "../../lib/explorer/demographyVital";
import { buildVitalWorkbookExportModel } from "../../lib/explorer/demographyVitalWorkbook";
import { formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { SectionTitle, SegmentedTabs, SourceNote } from "../ui/editorial";

const BIRTHS = SERIES_COLORS["vital.births"]!;
const DEATHS = SERIES_COLORS["vital.deaths"]!;
const persons = (value: number | null | undefined) => formatInUnit(value, UNIT_PERSONS);
const signedPersons = (value: number | null | undefined) =>
  value === null || value === undefined ? persons(value) : `${value > 0 ? "+" : ""}${persons(value)}`;

/** One place's registered births and deaths: the section every Population place page ends with. Counts only, so no census-break marker. */
export function VitalSection({
  place,
  facts,
  sources,
  siteOrigin,
  workbookScope,
  nationalHref,
}: {
  place: DemographyPlace;
  /** This place's rows only (`vitalFactsForPlace`). */
  facts: ClientDemographyObservation[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  workbookScope: string;
  nationalHref: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [mode, setMode] = useState<ChartMode>("line");
  const model = useMemo(() => buildVitalPlaceModel(facts, place.id), [facts, place.id]);
  if (!model) return null;
  const name = placeLabel(place, locale);
  const [first, last] = [model.years[0]!, model.years.at(-1)!];
  const { latest, streak } = model;
  const values = (record: Record<number, number | null>, sign: 1 | -1) => model.years.map((year) => (record[year] === null ? null : sign * record[year]!));
  const streakSentence =
    streak.kind === "deaths-ahead"
      ? t("vitalDeathsSince", { year: streak.since })
      : t(streak.kind === "even" ? "vitalEven" : "vitalBirthsAhead", { year: streak.year });

  return (
    <section id="births-deaths" data-testid="vital-section" className="@container mt-16 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{t("vitalTitle")}</SectionTitle>
      <p className="mt-2 mb-5 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("vitalLead", { place: name, first, last })}</p>
      <div data-testid="vital-chart-panel" data-mode={mode}>
        <SegmentedTabs<ChartMode>
          ariaLabel={message(messages, "controls.viewMode")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "line", label: t("columns"), testId: "vital-mode-line" },
            { value: "table", label: message(messages, "controls.table"), testId: "vital-mode-table" },
          ]}
        />
        <div className="mt-5">
          {mode === "line" ? (
            <StackedColumnChart
              periods={model.years}
              periodsPerYear={1}
              segments={[
                { id: "births", label: t("vitalBirths"), color: BIRTHS, marker: "up", values: values(model.births, 1) },
                { id: "deaths", label: t("vitalDeaths"), color: DEATHS, marker: "down", values: values(model.deaths, -1) },
              ]}
              overlay={{ label: t("vitalNatural"), values: values(model.natural, 1) }}
              formatPeriod={String}
              formatValue={(value) => persons(Math.abs(value))}
              formatOverlayValue={(value) => signedPersons(value)}
              readoutOrder="sign-then-magnitude"
              ariaLabel={t("vitalChartAria", { place: name, first, last })}
            />
          ) : (
            <ExplorerTable
              caption={t("vitalTableCaption", { place: name, first, last })}
              rows={[
                { itemId: "vital.births", kaLabel: t("vitalBirths"), color: BIRTHS, valuesByYear: model.births },
                { itemId: "vital.deaths", kaLabel: t("vitalDeaths"), color: DEATHS, valuesByYear: model.deaths },
              ]}
              totalRow={{ itemId: "vital.natural", kaLabel: t("vitalNatural"), color: INK, valuesByYear: model.natural }}
              showTotal
              wrapRowLabels
              rowLabelsLocalized
              years={model.years}
              firstColumnLabel={t("placeHeader")}
              unit={UNIT_PERSONS}
              share={false}
              showChangeColumn={false}
              shareValueForYear={() => null}
            />
          )}
        </div>
      </div>
      <div className="mt-[18px] flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[640px]"><SourceNote testId="vital-source-note">{t("vitalSource", { first, last })}</SourceNote></div>
        <div className="w-full max-w-[260px]">
          <ExcelDownloadButton
            testId="vital-excel-download"
            disabled={false}
            onDownload={async () => {
              const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
              await downloadWorkbook(buildVitalWorkbookExportModel({ facts, place, sources, siteOrigin, scope: workbookScope }, presentation));
            }}
          />
        </div>
      </div>
      <div className={KPI_GRID_CLASS} data-testid="vital-highlights" data-end-year={latest.year}>
        <HeroKpi label={t("vitalHeroLabel", { year: latest.year })} value={signedPersons(latest.natural)} valueColor={latest.natural < 0 ? NEGATIVE : "var(--ink)"}>
          <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{streakSentence}</p>
        </HeroKpi>
        <SideKpiList
          kpis={[
            { label: t("vitalBirths"), value: persons(latest.births), unit: "", color: BIRTHS, detail: `${first}: ${persons(model.births[first])}`, spark: { values: values(model.births, 1), color: BIRTHS } },
            { label: t("vitalDeaths"), value: persons(latest.deaths), unit: "", color: DEATHS, detail: `${first}: ${persons(model.deaths[first])}`, spark: { values: values(model.deaths, 1), color: DEATHS } },
            { label: t("vitalRatio"), value: latest.ratio === null ? persons(null) : persons(Math.round(latest.ratio)), unit: "", color: INK, detail: String(latest.year), spark: null },
          ]}
        />
      </div>
      <Link
        href={pageHref(nationalHref, locale)}
        data-testid="vital-national-link"
        className="mt-6 flex min-h-11 items-center text-[13px] text-[var(--ink)] underline underline-offset-2"
      >
        {t("vitalCompare")}
      </Link>
    </section>
  );
}
