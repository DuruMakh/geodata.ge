"use client";

import { ChartPie, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { SectorDefinition } from "../../lib/data/economicSectors/types";
import type { MunicipalRegion } from "../../lib/data/municipal/types";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import {
  buildRegionalEconomyModel,
  changeRegionalEconomyMeasure,
  regionalEconomyDefinitions,
} from "../../lib/explorer/regionalEconomies";
import { buildRegionalEconomyWorkbookExportModel } from "../../lib/explorer/regionalEconomiesWorkbook";
import { regionalEconomyHref } from "../../lib/explorer/regionalEconomyRoutes";
import { formatAmount, formatShare, unitFor, unitsFor } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { RegionHighlights } from "./region-highlights";
import { RegionPicker } from "./region-picker";
import { RegionalEconomySeriesPanel } from "./regional-economy-series-panel";
import { useRegionalEconomyState } from "./use-regional-economy-state";
import type { ClientRegionalEconomyObservation } from "../../lib/servedRows";

export type RegionalEconomyIdentity = {
  id: string;
  slug: string;
  labelKa: string;
  labelEn: string;
};

export function RegionalEconomyExplorer({
  facts,
  registry,
  region,
  regions,
  sources,
  siteOrigin,
}: {
  facts: ClientRegionalEconomyObservation[];
  registry: SectorDefinition[];
  region: RegionalEconomyIdentity;
  regions: MunicipalRegion[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
}) {
  const presentation = useI18n();
  const { locale, messages, englishLabels } = presentation;
  const t = (key: string) => message(messages, `regionalEconomies.${key}`);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { state, update } = useRegionalEconomyState(facts, registry);
  const model = useMemo(() => buildRegionalEconomyModel(facts, registry, state), [facts, registry, state]);
  const share = state.measure === "share_of_region_gdp";
  const measureLabel = t(share ? "shareOfRegionGdp" : "nominal");
  const unit = useMemo(() => unitFor(facts.filter((fact) => fact.measure === "nominal").map((fact) => fact.value), unitsFor(locale).bn), [facts, locale]);
  const labels = new Map(regionalEconomyDefinitions(registry).map((definition) => [definition.id, locale === "en" ? definition.labelEn : definition.labelKa]));
  const series = model.series.map((entry) => ({ ...entry, label: labels.get(entry.id)! }));
  const totalRow = model.rows.find((row) => row.itemId === REGIONAL_GDP_TOTAL) ?? null;
  const regionLabel = locale === "en" ? region.labelEn : region.labelKa;
  const orderedRegions = regions.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  const regionIndex = orderedRegions.findIndex((candidate) => candidate.id === region.id);
  const previousRegion = orderedRegions[(regionIndex - 1 + orderedRegions.length) % orderedRegions.length]!;
  const nextRegion = orderedRegions[(regionIndex + 1) % orderedRegions.length]!;

  return (
    <div data-testid="regional-economy-explorer" className="@container">
      <div className="relative mt-[34px] mb-3 flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-end min-[768px]:justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {t("detailHeadingLead")} {" "}
          <button data-testid="region-picker-trigger" type="button" aria-expanded={pickerOpen} onClick={() => setPickerOpen((open) => !open)} className="group inline-flex max-w-full cursor-pointer items-center gap-2 border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] align-bottom text-left text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]">
            {regionLabel}<ChevronDown aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </h1>
        <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} regions={regions} activeRegionId={region.id} />
        <span data-testid="regional-entity-navigation" className="grid w-full min-w-0 grid-cols-2 items-center gap-4 min-[768px]:flex min-[768px]:w-auto min-[768px]:max-w-[40%] min-[768px]:shrink">
          <Link href={pageHref(regionalEconomyHref(previousRegion.id), locale)} className="block min-w-0 truncate font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            ← {publicLabel(locale, previousRegion.id, previousRegion.kaLabel, englishLabels)}
          </Link>
          <Link href={pageHref(regionalEconomyHref(nextRegion.id), locale)} className="block min-w-0 truncate text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            {publicLabel(locale, nextRegion.id, nextRegion.kaLabel, englishLabels)} →
          </Link>
        </span>
      </div>
      <p data-testid="regional-headline" className="mb-2 text-[13px] text-[var(--body)]">
        {t("total")} · {model.headline?.year ?? "—"}: <span className="font-[family-name:var(--font-numeric)] font-medium text-[var(--ink)]">{share ? formatShare(model.headline ? model.headline.value / 100 : null) : formatAmount(model.headline?.value, locale)}</span>
      </p>
      <div className="mb-[30px] grid text-[13px] text-[var(--muted)]">
        <p aria-hidden={share} className={`[grid-area:1/1] ${share ? "invisible" : ""}`}>{t("contextNominal")}</p>
        <p aria-hidden={!share} className={`[grid-area:1/1] ${share ? "" : "invisible"}`}>{t("contextShare")}</p>
      </div>
      <p role="status" className="sr-only">{message(messages, "regionalEconomies.rangeChanged", { start: model.range.start, end: model.range.end })}</p>
      <div className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10">
        <div className="flex min-w-0 flex-col">
          <section data-testid="regional-chart-panel" data-mode={state.mode} data-measure={state.measure} className="border-t border-[var(--ink)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedTabs ariaLabel={message(messages, "controls.viewMode")} value={state.mode} onChange={(mode) => update((previous) => ({ ...previous, mode }))} options={[
                { value: "line", label: message(messages, "controls.chart"), testId: "regional-mode-line" },
                { value: "table", label: message(messages, "controls.table"), testId: "regional-mode-table" },
              ]} />
              <SegmentedTabs ariaLabel={t("measure")} value={state.measure} onChange={(measure) => update((previous) => changeRegionalEconomyMeasure(previous, measure, facts))} options={[
                { value: "nominal", label: t("nominal"), ariaLabel: t("nominal"), testId: "regional-measure-nominal", icon: <span aria-hidden className="text-base">₾</span> },
                { value: "share_of_region_gdp", label: t("shareOfRegionGdp"), ariaLabel: t("shareOfRegionGdp"), testId: "regional-measure-share", icon: <ChartPie aria-hidden size={18} strokeWidth={1.5} /> },
              ]} />
            </div>
            {!state.selectedIds.length ? <div className="mt-5"><Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout></div>
              : !model.hasData ? <div className="mt-5"><Callout testId="no-range-data-callout">{message(messages, "main.noRangeData")}</Callout></div>
              : state.mode === "line" ? <div className="mt-5"><EditorialLineChart years={model.years} series={series} share={share} unit={unit} shareLabel={measureLabel} formatTooltipValue={share ? undefined : (value) => formatAmount(value, locale)} /></div>
              : <ExplorerTable caption={`${regionLabel} · ${share ? measureLabel : message(messages, "format.bnGel")} · ${model.range.start}–${model.range.end}`} rows={model.rows.filter((row) => row.itemId !== REGIONAL_GDP_TOTAL)} totalRow={totalRow} showTotal={Boolean(totalRow)} totalFirst wrapRowLabels years={model.years} firstColumnLabel={t("sector")} unit={unit} share={share} showChangeColumn={false} shareValueForYear={(row, year) => row.valuesByYear[year] ?? null} />}
            <RangeStrip years={model.availableYears} range={model.range} onChange={(patch) => update((previous) => {
              const start = patch.start ?? model.range.start;
              const end = patch.end ?? model.range.end;
              return { ...previous, range: start === model.range.min && end === model.range.max ? { kind: "all" } : { kind: "manual", start, end } };
            })} />
          </section>
          <div className="mt-[18px]"><SourceNote testId="regional-source-label">{t("source")} {model.range.start}–{model.range.end}</SourceNote></div>
          <div className="mt-3 border-l-2 border-[var(--accent)] bg-[var(--tint)] px-3.5 py-3"><SourceNote>{t("accountingNote")}</SourceNote></div>
        </div>
        <RegionalEconomySeriesPanel registry={registry} selectedIds={state.selectedIds} endYear={model.range.end} endValues={model.endValues} measure={state.measure} onSelectionChange={(selectedIds) => update((previous) => ({ ...previous, selectedIds }))} downloadAction={
          <ExcelDownloadButton testId="regional-excel-download" disabled={!state.selectedIds.length || !model.hasData} onDownload={async () => {
            const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
            await downloadWorkbook(buildRegionalEconomyWorkbookExportModel(facts, registry, state, region, presentation, sources, siteOrigin));
          }} />
        } />
      </div>
      <RegionHighlights facts={facts} registry={registry} year={model.range.end} />
    </div>
  );
}
