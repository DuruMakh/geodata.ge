"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Hash, Users, type LucideIcon } from "lucide-react";
import { SERIES_COLORS } from "../../lib/explorer/colors";
import { placeLabel, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { buildMarriageModel, defaultMarriageState, type MarriageMeasure, type MarriagePlaceFacts } from "../../lib/explorer/demographyMarriage";
import { buildMarriageWorkbookExportModel } from "../../lib/explorer/demographyMarriageWorkbook";
import { formatInUnit, type ValueUnit } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { TemplateValues } from "../../lib/i18n/types";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { SectionTitle, SegmentedTabs, SourceNote } from "../ui/editorial";
import { Download, SECTION_CLASS } from "./demography-helpers";

// The births section's colours: marriages climb above the line as births do, divorces hang below it as deaths do.
const MARRIAGES = SERIES_COLORS["vital.births"]!;
const DIVORCES = SERIES_COLORS["vital.deaths"]!;
const MEASURES: readonly { value: MarriageMeasure; icon: LucideIcon }[] = [{ value: "count", icon: Hash }, { value: "per1000", icon: Users }];

/** One place's registered marriages and divorces, as published or per 1,000 residents: the section after births and deaths on every Population place page. */
export function MarriageSection({
  place,
  facts,
  sources,
  siteOrigin,
  workbookScope,
  nationalHref,
}: {
  place: DemographyPlace;
  /** This place's two counts and mid-year population (`marriageFactsForPlace`). */
  facts: MarriagePlaceFacts;
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
  workbookScope: string;
  nationalHref: string;
}) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const [mode, setMode] = useState<ChartMode>("line");
  const [measure, setMeasure] = useState<MarriageMeasure>("count");
  const state = useMemo(() => ({ ...defaultMarriageState(), measure }), [measure]);
  const model = useMemo(() => buildMarriageModel(facts, state), [facts, state]);
  if (!model.years.length) return null;
  const name = placeLabel(place, locale);
  const [first, last] = [model.years[0]!, model.years.at(-1)!];
  const unit: ValueUnit = { divisor: 1, label: "", decimals: model.decimals };
  const unitLabel = message(messages, model.unitKey);
  const format = (value: number | null | undefined) => formatInUnit(value, unit);
  const [marriages, divorces] = ["marriages", "divorces"].map((id) => model.series.find((series) => series.id === id)!);
  const values = (series: typeof marriages, sign: 1 | -1) => model.years.map((year) => (series!.valuesByYear[year] === null ? null : sign * series!.valuesByYear[year]!));
  const breaks = model.breaks.map((item) => ({ period: item.year, label: t("breakLabel") }));
  const labels = { marriages: t("marriageSeries.marriages"), divorces: t("marriageSeries.divorces") };

  const chart = (
    <StackedColumnChart
      periods={model.years}
      periodsPerYear={1}
      segments={[
        { id: "marriages", label: labels.marriages, color: MARRIAGES, marker: "up", values: values(marriages, 1) },
        { id: "divorces", label: labels.divorces, color: DIVORCES, marker: "down", values: values(divorces, -1) },
      ]}
      overlay={null}
      legend={[
        { id: "marriages", label: labels.marriages, color: MARRIAGES },
        { id: "divorces", label: labels.divorces, color: DIVORCES },
      ]}
      breaks={breaks}
      formatPeriod={String}
      formatValue={(value) => format(Math.abs(value))}
      readoutOrder="sign-then-magnitude"
      ariaLabel={t("marriageChartAria", { place: name, first, last })}
    />
  );

  return (
    <section id="marriages-divorces" aria-labelledby="marriages-divorces-title" data-testid="marriage-section" className={`@container ${SECTION_CLASS}`}>
      <SectionTitle id="marriages-divorces-title">{t("marriageSectionTitle")}</SectionTitle>
      <div data-testid="marriage-chart-panel" data-mode={mode} data-measure={measure} className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ModeTabs value={mode} onChange={setMode} testId="marriage" lineLabel={t("columns")} />
          <div className="flex items-center gap-3.5">
            <span data-testid="marriage-section-unit" className="text-[11px] text-[var(--muted)]">{unitLabel}</span>
            <SegmentedTabs ariaLabel={t("marriageMeasure")} value={measure} onChange={setMeasure} options={MEASURES.map(({ value, icon: Icon }) => (
              { value, label: t(`marriageMeasure.${value}`), testId: `marriage-section-measure-${value}`, icon: <Icon aria-hidden="true" size={18} strokeWidth={1.5} /> }
            ))} />
          </div>
        </div>
        <div className="mt-5">
          {mode === "line" ? chart : null}
          <ExplorerTable
            caption={t("marriageTableCaption", { place: name, first, last, unit: unitLabel })}
            rows={[
              { itemId: "marriages", kaLabel: labels.marriages, color: MARRIAGES, valuesByYear: marriages!.valuesByYear },
              { itemId: "divorces", kaLabel: labels.divorces, color: DIVORCES, valuesByYear: divorces!.valuesByYear },
            ]}
            totalRow={null}
            showTotal={false}
            wrapRowLabels
            rowLabelsLocalized
            years={model.years}
            firstColumnLabel={t("seriesHeader")}
            unit={unit}
            share={false}
            showChangeColumn={false}
            shareValueForYear={() => null}
            breakYears={model.breaks.map((item) => item.year)}
            breakLabel={t("breakLabel")}
            crawlCopy={mode === "line"}
          />
        </div>
      </div>
      <div className="mt-[18px] flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[640px]"><SourceNote testId="marriage-source-note" action={
          // The chart draws its own colour key, so the picture adds none.
          <ChartShareButton title={`${t("marriageSectionTitle")} · ${name}`} caption={`${unitLabel} · ${first}–${last}`} source={t("marriageSectionSource", { first, last })} chart={chart} period={`${first}-${last}`} testId="marriage-share" />
        }>{t("marriageSectionSource", { first, last })}</SourceNote></div>
        <Download
          testId="marriage-section-excel-download"
          className="w-full max-w-[260px]"
          build={() => buildMarriageWorkbookExportModel({ place: facts, state, labels, sources, siteOrigin, title: `${t("marriageSectionTitle")} · ${name}`, scope: workbookScope }, presentation)}
        />
      </div>
      <Link
        href={pageHref(nationalHref, locale)}
        prefetch={false}
        data-testid="marriage-national-link"
        className="mt-6 flex min-h-11 items-center text-[13px] text-[var(--ink)] underline underline-offset-2"
      >
        {t("marriageCompare")}
      </Link>
    </section>
  );
}
