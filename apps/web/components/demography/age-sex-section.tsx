"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COVERAGE } from "../../lib/data/demography/series";
import { INK } from "../../lib/explorer/colors";
import { bandShares, censusPyramid, urbanShare, type AgeMeasure } from "../../lib/explorer/demographyAgeSex";
import { buildCensusPlaceWorkbookExportModel } from "../../lib/explorer/demographyAgeSexWorkbook";
import { GEORGIA_PLACE_ID, placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { formatInUnit, formatShare, UNIT_PERSONS } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientAgeFact } from "../../lib/servedRows";
import { HeroKpi, KPI_GRID_CLASS, SideKpiList } from "../main-explorer/kpi-blocks";
import { SectionTitle, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { Download, ModeTabs } from "./national-vital-charts";
import { PopulationPyramid, PyramidTable } from "./population-pyramid";

type Settlement = ClientAgeFact["settlement"];
const SETTLEMENTS = [
  { id: "total", key: "settlementAll" },
  { id: "urban", key: "settlementUrban" },
  { id: "rural", key: "settlementRural" },
] as const;

/** One place's 2024 census pyramid by settlement: the block Georgia's and every region's Population page ends with. A municipality has no census age rows, so it gets nothing. */
export function AgeSexSection({
  place,
  facts,
  sources,
  siteOrigin,
  workbookScope,
  nationalHref,
}: {
  place: DemographyPlace;
  /** This place's census rows only (`censusAgeFactsForPlace`). */
  facts: ClientAgeFact[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  workbookScope: string;
  nationalHref: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [settlement, setSettlement] = useState<Settlement>("total");
  const [measure, setMeasure] = useState<AgeMeasure>("share");
  const [mode, setMode] = useState<ChartMode>("line");
  const whole = useMemo(() => (facts.length === 0 ? null : censusPyramid(facts, "total")), [facts]);
  const pyramid = useMemo(() => (facts.length === 0 ? null : censusPyramid(facts, settlement)), [facts, settlement]);
  if (whole === null || pyramid === null) return null;
  const name = placeLabel(place, locale);
  const date = t("censusDate");
  const first = COVERAGE.populationFrom;
  const isGeorgia = place.id === GEORGIA_PLACE_ID;

  return (
    <section id="age-sex" data-testid="age-sex-section" className="@container mt-16 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{t("ageSexCensusHeading")}</SectionTitle>
      <div className="mt-4 mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          {SETTLEMENTS.map(({ id, key }) => (
            <TextTab key={id} label={t(key)} active={settlement === id} onClick={() => setSettlement(id)} testId={`age-sex-settlement-${id}`} />
          ))}
        </div>
        <SegmentedTabs<AgeMeasure>
          ariaLabel={t("measureLabel")}
          value={measure}
          onChange={setMeasure}
          options={[
            { value: "share", label: "%", testId: "age-sex-measure-share" },
            { value: "persons", label: t("measurePersons"), testId: "age-sex-measure-persons" },
          ]}
        />
      </div>
      <ModeTabs value={mode} onChange={setMode} testId="age-sex" lineLabel={t("pyramidMode")} />
      <div className="mt-5" data-testid="age-sex-panel" data-mode={mode} data-settlement={settlement}>
        {mode === "line" ? (
          <PopulationPyramid pyramid={pyramid} compare={null} measure={measure} ariaLabel={t("pyramidAria", { place: name, date })} testId="age-sex-pyramid" />
        ) : (
          <PyramidTable pyramid={pyramid} compare={null} caption={t("pyramidTableCaption", { place: name, date })} />
        )}
      </div>
      <div className="mt-[18px] flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[640px]"><SourceNote testId="age-sex-source-note">{t("censusSource")}</SourceNote></div>
        <Download
          testId="age-sex-excel-download"
          build={() => buildCensusPlaceWorkbookExportModel({ facts, sources, siteOrigin, place, settlement, scope: workbookScope }, presentation)}
        />
      </div>
      <div className={KPI_GRID_CLASS} data-testid="age-sex-highlights">
        <HeroKpi label={t("kpiOld")} value={formatShare(bandShares(whole).old / 100)}>
          <p className="mt-4 text-[0.78125rem] leading-relaxed text-[var(--body)]">{date}</p>
        </HeroKpi>
        <SideKpiList
          kpis={[
            { label: t("kpiCounted"), value: formatInUnit(whole.total, UNIT_PERSONS), unit: "", color: INK, detail: date, spark: null },
            { label: t("kpiUrban"), value: formatShare(urbanShare(facts) / 100), unit: "", color: INK, detail: date, spark: null },
          ]}
        />
      </div>
      <Link
        href={pageHref(nationalHref, locale)}
        data-testid="age-sex-national-link"
        className="mt-6 flex min-h-11 items-center text-[13px] text-[var(--ink)] underline underline-offset-2"
      >
        {t(isGeorgia ? "ageSexGeorgiaLink" : "ageSexNationalLink", { first })}
      </Link>
    </section>
  );
}
