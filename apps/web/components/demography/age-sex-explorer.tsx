"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CENSUS_STEP } from "../../lib/data/demography/series";
import {
  ageYears,
  annualPyramid,
  bandShares,
  crossesBreak,
  effectiveMeasure,
  heatmapRows,
  parseAgeSexHash,
  serializeAgeSexHash,
  womenPer100Men,
  type AgeMeasure,
  type AgeSexState,
} from "../../lib/explorer/demographyAgeSex";
import {
  buildAgeYearWorkbookExportModel,
  buildPyramidWorkbookExportModel,
} from "../../lib/explorer/demographyAgeSexWorkbook";
import { formatInUnit, formatShare, UNIT_DENSITY } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientAgeFact } from "../../lib/servedRows";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { HeatmapTable } from "../main-explorer/heatmap-table";
import { Callout, SectionTitle, SegmentedTabs, SourceNote } from "../ui/editorial";
import { YearPicker } from "../ui/year-picker";
import { Download } from "./national-vital-charts";
import { PopulationPyramid } from "./population-pyramid";

const SECTION_CLASS = "mt-16 border-t-2 border-[var(--ink)] pt-[22px]";
const percent = (value: number | null) => formatShare(value === null ? null : value / 100);

/** Georgia's age structure on 1 January of every year: the pyramid and the age-by-year heat map. */
export function AgeSexExplorer({
  facts,
  sources,
  siteOrigin,
}: {
  facts: ClientAgeFact[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const years = useMemo(() => ageYears(facts), [facts]);
  const [state, setState] = useState<AgeSexState>(() => parseAgeSexHash("", years));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(parseAgeSexHash(window.location.hash, years));
    setReady(true);
  }, [years]);
  useAppReady();
  useReplaceHash(serializeAgeSexHash(state, years), ready);

  const [first, last] = [years[0]!, years.at(-1)!];
  const update = (patch: Partial<AgeSexState>) => setState((previous) => ({ ...previous, ...patch }));
  const breakLabel = t("breakLabel");
  const source = (
    <>
      {t("annualSource", { first, last })}{" "}
      <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
        {message(messages, "common.methodology")}
      </Link>
      .
    </>
  );

  // Pyramid
  const pyramid = useMemo(() => annualPyramid(facts, state.year), [facts, state.year]);
  const comparePyramid = useMemo(() => (state.compare === null ? null : annualPyramid(facts, state.compare)), [facts, state.compare]);
  const compare = state.compare === null || comparePyramid === null ? null : { pyramid: comparePyramid, year: state.compare };
  const crossing = state.compare !== null && crossesBreak(state.year, state.compare);
  const measure = effectiveMeasure(state);
  const shares = bandShares(pyramid);
  const place = t("georgia");
  const date = String(state.year);
  const chooseYear = (year: number) => update({ year, compare: state.compare === year ? null : state.compare });

  // Heat map
  const heat = useMemo(() => heatmapRows(facts, years), [facts, years]);
  const heatCaption = t("heatCaption", { first, last });

  return (
    <>
      <section data-testid="age-sex-pyramid" className={SECTION_CLASS}>
        <SectionTitle>{t("pyramidTitle")}</SectionTitle>
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <YearPicker
            label={t("yearMenu")}
            years={years}
            value={state.year}
            onChange={(year) => chooseYear(year!)}
            markYear={CENSUS_STEP.toYear}
            markLabel={breakLabel}
            testId="age-sex-year-select"
          />
          <YearPicker
            label={t("compareMenu")}
            years={years.filter((year) => year !== state.year)}
            value={state.compare}
            onChange={(year) => update({ compare: year })}
            noneLabel={t("compareNone")}
            markYear={CENSUS_STEP.toYear}
            markLabel={breakLabel}
            testId="age-sex-compare-select"
          />
          <SegmentedTabs<AgeMeasure>
            ariaLabel={t("measureLabel")}
            value={measure}
            onChange={(next) => update({ measure: next })}
            options={[
              { value: "share", label: "%", testId: "age-sex-measure-share" },
              {
                value: "persons",
                label: t("measurePersons"),
                testId: "age-sex-measure-persons",
                disabled: crossing,
                title: crossing ? t("personsDisabled") : undefined,
              },
            ]}
          />
        </div>
        {crossing ? (
          <div className="mt-4">
            <Callout testId="age-sex-compare-note">{t("compareNote", { year: state.year, compare: state.compare! })}</Callout>
          </div>
        ) : null}
        <div className="mt-5" data-testid="age-sex-pyramid-panel" data-measure={measure}>
          <div className="mx-auto max-w-[640px]">
            <PopulationPyramid
              pyramid={pyramid}
              year={state.year}
              compare={compare}
              measure={measure}
              ariaLabel={t("pyramidAria", { place, date })}
              testId="age-sex-pyramid-figure"
            />
          </div>
        </div>
        <p data-testid="age-sex-pyramid-summary" className="mt-4 font-[family-name:var(--font-numeric)] text-[12px] text-[var(--body)]">
          {t("pyramidSummary", {
            young: percent(shares.young),
            working: percent(shares.working),
            old: percent(shares.old),
            ratio: formatInUnit(womenPer100Men(pyramid), UNIT_DENSITY),
          })}
        </p>
        <div className="mt-[18px] max-w-[740px]"><SourceNote testId="age-sex-pyramid-source">{source}</SourceNote></div>
        <Download
          testId="age-sex-pyramid-excel-download"
          build={() => buildPyramidWorkbookExportModel({ facts, sources, siteOrigin, year: state.year, compare: state.compare }, presentation)}
        />
      </section>

      <section data-testid="age-sex-heatmap" className={SECTION_CLASS}>
        <SectionTitle>{t("heatTitle")}</SectionTitle>
        <p className="mt-2 text-[12px] text-[var(--body)]">{heatCaption}</p>
        <p className="mt-2 max-w-[800px] text-[12px] leading-relaxed text-[var(--muted)]">{t("heatNote")}</p>
        <HeatmapTable
          caption={heatCaption}
          rowHeader={t("ageGroupHeader")}
          years={years}
          rows={heat.rows}
          maximum={heat.maximum}
          format={percent}
          scaleLabel={t("heatScale")}
          breakYear={CENSUS_STEP.toYear}
          breakLabel={breakLabel}
        />
        <div className="mt-[18px] max-w-[740px]"><SourceNote testId="age-sex-heatmap-source">{source}</SourceNote></div>
        <Download testId="age-sex-heatmap-excel-download" build={() => buildAgeYearWorkbookExportModel({ facts, sources, siteOrigin }, presentation)} />
      </section>
    </>
  );
}
