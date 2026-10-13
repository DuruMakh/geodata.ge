"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INK, NEGATIVE, SERIES_COLORS } from "../../lib/explorer/colors";
import { placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildVitalPlaceModel } from "../../lib/explorer/demographyVital";
import { buildVitalWorkbookExportModel } from "../../lib/explorer/demographyVitalWorkbook";
import { UNIT_PERSONS } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientDemographyObservation } from "../../lib/servedRows";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { Download, persons, SECTION_CLASS, signedPersons } from "./demography-helpers";

const BIRTHS = SERIES_COLORS["vital.births"]!;
const DEATHS = SERIES_COLORS["vital.deaths"]!;

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
      ? streak.wholeSeries && streak.since !== latest.year
        ? t("vitalDeathsWholeSeries", { first, last })
        : t(streak.since === latest.year ? "vitalDeathsAhead" : "vitalDeathsSince", { year: streak.since })
      : t(streak.kind === "even" ? "vitalEven" : "vitalBirthsAhead", { year: streak.year });

  return (
    <section id="births-deaths" aria-labelledby="births-deaths-title" data-testid="vital-section" className={`@container ${SECTION_CLASS}`}>
      <SectionTitle id="births-deaths-title">{t("vitalTitle")}</SectionTitle>
      {/* No lead line: it repeated the heading and the source note below (U26-13, DESIGN.md §29.2). */}
      <div data-testid="vital-chart-panel" data-mode={mode} className="mt-5">
        <ModeTabs value={mode} onChange={setMode} testId="vital" lineLabel={t("columns")} />
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
              legend={[
                { id: "births", label: t("vitalBirths"), color: BIRTHS },
                { id: "deaths", label: t("vitalDeaths"), color: DEATHS },
                { id: "natural", label: t("vitalNatural"), color: INK },
              ]}
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
              firstColumnLabel={t("seriesHeader")}
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
        <Download
          testId="vital-excel-download"
          className="w-full max-w-[260px]"
          build={() => buildVitalWorkbookExportModel({ facts, place, sources, siteOrigin, scope: workbookScope }, presentation)}
        />
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
        prefetch={false}
        data-testid="vital-national-link"
        className="mt-6 flex min-h-11 items-center text-[13px] text-[var(--ink)] underline underline-offset-2"
      >
        {t("vitalCompare")}
      </Link>
    </section>
  );
}
