"use client";

import { useState } from "react";
import { CENSUS_STEP, SERIES } from "../../lib/data/demography/series";
import { ACCENT, INK, OTHER_COLOR, SERIES_COLORS } from "../../lib/explorer/colors";
import { AGE_GROUPS, ageCurves, LIFE_SERIES, nationalYears, seriesByYear, UNIT_RATE_2 } from "../../lib/explorer/demographyNational";
import { buildFertilityWorkbookExportModel, buildLifeWorkbookExportModel } from "../../lib/explorer/demographyNationalWorkbook";
import { formatInUnit, UNIT_DENSITY } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { TemplateValues } from "../../lib/i18n/types";
import type { ClientNationalFact } from "../../lib/servedRows";
import { ChartSelectionAids } from "../explorer-shell/chart-selection-aids";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { SectionTitle, SourceNote } from "../ui/editorial";
import { Download, SECTION_CLASS } from "./demography-helpers";

/** The first year of the fertility curve; the last is ACCENT. Distinct from the grey of the years between. */
const FIRST_YEAR_COLOR = SERIES_COLORS["fertility.first_year"]!;

export function NationalVitalCharts({
  facts,
  sources,
  siteOrigin,
}: {
  facts: ClientNationalFact[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
}) {
  const presentation = useI18n();
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  useAppReady();
  const [tfrMode, setTfrMode] = useState<ChartMode>("line");
  const [ageMode, setAgeMode] = useState<ChartMode>("line");
  const [lifeMode, setLifeMode] = useState<ChartMode>("line");
  const years = nationalYears(facts);
  const [first, last] = [years[0]!, years.at(-1)!];
  const breaks = [{ year: CENSUS_STEP.toYear, label: t("breakLabel") }];
  const flat = (record: Record<number, number | null>) => years.map((year) => record[year] ?? null);
  const tfr = seriesByYear(facts, SERIES.totalFertilityRate);
  const curves = ageCurves(facts);
  // x positions 1..7 stand for the seven age groups; the period label prints the group's name.
  const positions = AGE_GROUPS.map((_, index) => index + 1);
  const ageLabel = (position: number) => t(`ageGroup.${AGE_GROUPS[position - 1]}`);
  const ageColor = (year: number) => (year === curves.years[0] ? FIRST_YEAR_COLOR : year === curves.years.at(-1) ? ACCENT : OTHER_COLOR);
  // Grey years first, so the two coloured lines are drawn on top.
  const ageOrder = [...curves.years.slice(1, -1), curves.years[0]!, curves.years.at(-1)!];
  const lifeColor = (colorKey: string | null) => (colorKey === null ? INK : SERIES_COLORS[colorKey]!);
  const rate1 = (value: number) => formatInUnit(value, UNIT_DENSITY);
  const lifeSeries = LIFE_SERIES.map((line) => ({ id: line.seriesId, label: t(line.key), color: lifeColor(line.colorKey), vals: flat(seriesByYear(facts, line.seriesId)) }));
  const nationalSource = t("nationalSource", { first, last });
  const tfrTitle = `${t("tfrLabel")} (${t("tfrUnit")})`;
  const tfrChart = (
    <EditorialLineChart
      years={years}
      series={[{ id: SERIES.totalFertilityRate, label: t("tfrLabel"), color: INK, vals: flat(tfr) }]}
      share={false}
      unit={UNIT_RATE_2}
      shareLabel=""
      formatTooltipValue={(value) => formatInUnit(value, UNIT_RATE_2)}
      breaks={breaks}
      ariaLabel={t("tfrChartAria", { first, last })}
    />
  );
  const asfrLegend = [
    { label: String(curves.years[0]), color: FIRST_YEAR_COLOR },
    { label: String(curves.years.at(-1)), color: ACCENT },
    { label: t("otherYears"), color: OTHER_COLOR },
  ];
  const asfrChart = (
    <EditorialLineChart
      years={positions}
      series={ageOrder.map((year) => ({
        id: String(year),
        label: String(year),
        color: ageColor(year),
        vals: AGE_GROUPS.map((group) => curves.byYear[year]![group]),
      }))}
      share={false}
      unit={UNIT_DENSITY}
      shareLabel=""
      formatTooltipValue={rate1}
      formatPeriod={(position) => ageLabel(position)}
      ariaLabel={t("asfrChartName", { first: curves.years[0]!, last: curves.years.at(-1)! })}
    />
  );
  const lifeChart = (
    <EditorialLineChart
      years={years}
      series={lifeSeries}
      share={false}
      unit={UNIT_DENSITY}
      shareLabel=""
      formatTooltipValue={rate1}
      breaks={breaks}
      ariaLabel={t("lifeChartAria", { first, last })}
    />
  );

  return (
    <>
      <section data-testid="fertility-section" className={SECTION_CLASS}>
        <SectionTitle>{t("fertilityTitle")}</SectionTitle>
        <h3 className="mt-6 mb-3 text-[15px] text-[var(--ink)]">{`${t("tfrLabel")} (${t("tfrUnit")})`}</h3>
        <ModeTabs value={tfrMode} onChange={setTfrMode} testId="tfr" />
        <div className="mt-5">
          <ExplorerTable
            caption={t("tfrChartAria", { first, last })}
            rows={[{ itemId: SERIES.totalFertilityRate, kaLabel: t("tfrLabel"), color: INK, valuesByYear: tfr }]}
            totalRow={null}
            showTotal={false}
            wrapRowLabels
            rowLabelsLocalized
            years={years}
            firstColumnLabel={t("seriesHeader")}
            unit={UNIT_RATE_2}
            share={false}
            showChangeColumn={false}
            breakYears={[CENSUS_STEP.toYear]}
            breakLabel={t("breakLabel")}
            shareValueForYear={() => null}
            crawlCopy={tfrMode === "line"}
          />
          {tfrMode === "line" ? (
            tfrChart
          ) : null}
        </div>
        {/* The rate has no source line of its own (it shares the life section's), so its button sits under the chart, at the right. */}
        <div className="mt-3 flex justify-end">
          <ChartShareButton title={tfrTitle} caption={`${first}–${last}`} source={nationalSource} chart={tfrChart} period={`${first}-${last}`} testId="tfr-share" />
        </div>
        <h3 className="mt-10 mb-3 text-[15px] text-[var(--ink)]">{t("asfrLabel")}</h3>
        <ModeTabs value={ageMode} onChange={setAgeMode} testId="asfr" />
        <div className="mt-5" data-testid="asfr-panel">
          <ExplorerTable
            caption={`${t("asfrLabel")}, ${curves.years[0]!}–${curves.years.at(-1)!}`}
            rows={AGE_GROUPS.map((group) => ({
              itemId: group,
              kaLabel: t(`ageGroup.${group}`),
              color: OTHER_COLOR,
              valuesByYear: seriesByYear(facts, SERIES.ageSpecificFertilityRate, group),
            }))}
            totalRow={null}
            showTotal={false}
            wrapRowLabels
            rowLabelsLocalized
            years={curves.years}
            firstColumnLabel={t("ageHeader")}
            unit={UNIT_DENSITY}
            share={false}
            showChangeColumn={false}
            breakYears={[CENSUS_STEP.toYear]}
            breakLabel={t("breakLabel")}
            shareValueForYear={() => null}
            crawlCopy={ageMode === "line"}
          />
          {ageMode === "line" ? (
            <>
              <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[var(--body)]" data-testid="asfr-legend">
                {asfrLegend.map((item) => (
                  <li key={item.label} className="inline-flex items-center gap-2">
                    <span aria-hidden className="inline-block h-[3px] w-4" style={{ background: item.color }} />
                    {item.label}
                  </li>
                ))}
              </ul>
              {asfrChart}
            </>
          ) : null}
        </div>
        <div className="mt-[18px] max-w-[740px]"><SourceNote testId="asfr-note" action={
          <ChartShareButton title={t("asfrLabel")} caption={`${curves.years[0]!}–${curves.years.at(-1)!}`} legend={asfrLegend} source={nationalSource} chart={asfrChart} period={`${curves.years[0]!}-${curves.years.at(-1)!}`} testId="asfr-share" />
        }>{t("asfrNote")}</SourceNote></div>
        <Download testId="fertility-excel-download" build={() => buildFertilityWorkbookExportModel({ facts, sources, siteOrigin }, presentation)} />
      </section>
      <section data-testid="life-section" className={SECTION_CLASS}>
        <SectionTitle>{t("lifeTitle")}</SectionTitle>
        <div className="mt-5"><ModeTabs value={lifeMode} onChange={setLifeMode} testId="life" /></div>
        <div className="mt-5">
          <ExplorerTable
            caption={t("lifeChartAria", { first, last })}
            rows={LIFE_SERIES.map((line) => ({ itemId: line.seriesId, kaLabel: t(line.key), color: lifeColor(line.colorKey), valuesByYear: seriesByYear(facts, line.seriesId) }))}
            totalRow={null}
            showTotal={false}
            wrapRowLabels
            rowLabelsLocalized
            years={years}
            firstColumnLabel={t("seriesHeader")}
            unit={UNIT_DENSITY}
            share={false}
            showChangeColumn={false}
            breakYears={[CENSUS_STEP.toYear]}
            breakLabel={t("breakLabel")}
            shareValueForYear={() => null}
            crawlCopy={lifeMode === "line"}
          />
          {lifeMode === "line" ? (
            lifeChart
          ) : null}
        </div>
        <ChartSelectionAids series={lifeSeries} chartShown={lifeMode === "line"} share={false} unit={UNIT_DENSITY} formatValue={rate1} />
        <div className="mt-[18px] max-w-[740px]"><SourceNote testId="national-source-note" action={
          <ChartShareButton title={t("lifeTitle")} caption={`${first}–${last}`} legend={lifeSeries.map(({ label, color }) => ({ label, color }))} source={nationalSource} chart={lifeChart} period={`${first}-${last}`} testId="life-share" />
        }>{nationalSource}</SourceNote></div>
        <Download testId="life-excel-download" build={() => buildLifeWorkbookExportModel({ facts, sources, siteOrigin }, presentation)} />
      </section>
    </>
  );
}
