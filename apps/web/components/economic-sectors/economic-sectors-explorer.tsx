"use client";
import { useMemo } from "react";
import { ChartPie, ChartNoAxesCombined } from "lucide-react";
import type {
  SectorDefinition,
  ServedSectorObservation,
} from "../../lib/data/economicSectors/types";
import {
  buildEconomicSectorsModel,
  changeSectorMeasure,
  SECTOR_GDP,
} from "../../lib/explorer/economicSectors";
import { buildEconomicSectorsWorkbookExportModel } from "../../lib/explorer/economicSectorsWorkbook";
import {
  formatAmount,
  formatShare,
  unitFor,
  unitsFor,
} from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { Callout, SegmentedTabs, SourceNote } from "../ui/editorial";
import { SectorSeriesPanel } from "./sector-series-panel";
import { SectorHighlights } from "./sector-highlights";
import { useEconomicSectorsState } from "./use-economic-sectors-state";

export type EconomicSectorsExplorerProps = {
  facts: ServedSectorObservation[];
  registry: SectorDefinition[];
  sources: (WorkbookPublicSource & { sourceId: string })[];
  siteOrigin: string;
};

export function EconomicSectorsExplorer({
  facts,
  registry,
  sources,
  siteOrigin,
}: EconomicSectorsExplorerProps) {
  const presentation = useI18n();
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `sectors.${key}`);
  const { state, update } = useEconomicSectorsState(facts, registry);
  const model = useMemo(
    () => buildEconomicSectorsModel(facts, registry, state),
    [facts, registry, state],
  );
  const percent = state.measure !== "nominal";
  const measureLabel = t(
    state.measure === "share_of_gdp"
      ? "shareOfGdp"
      : percent
        ? "realGrowth"
        : "nominal",
  );
  const unit = useMemo(
    () =>
      unitFor(
        facts.filter((f) => f.measure === "nominal").map((f) => f.value),
        unitsFor(locale).bn,
      ),
    [facts, locale],
  );
  const labels = new Map(
    registry.map((r) => [r.id, locale === "en" ? r.labelEn : r.labelKa]),
  );
  const series = model.series.map((s) => ({ ...s, label: labels.get(s.id)! }));
  const total = model.rows.find((r) => r.itemId === SECTOR_GDP) ?? null;
  const activeSources = sources.filter((s) =>
    model.sourceIds.includes(s.sourceId),
  );
  const preliminaryYears = [
    ...new Set(
      facts
        .filter(
          (f) =>
            f.measure === state.measure &&
            state.selectedIds.includes(f.seriesId) &&
            model.years.includes(f.year) &&
            f.status === "preliminary",
        )
        .map((f) => f.year),
    ),
  ].sort((a, b) => a - b);
  return (
    <div data-testid="economic-sectors-explorer" className="@container">
      <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
        {t("heading")}
      </h1>
      <p
        data-testid="sectors-headline"
        className="mb-2 text-[13px] text-[var(--body)]"
      >
        {t("reference")} · {model.headline?.year ?? "—"}:{" "}
        <span className="font-[family-name:var(--font-numeric)] font-medium text-[var(--ink)]">
          {percent
            ? formatShare(model.headline ? model.headline.value / 100 : null)
            : formatAmount(model.headline?.value, locale)}
        </span>
        {model.headline?.status === "preliminary"
          ? ` · ${t("preliminary")}`
          : ""}
      </p>
      <div className="mb-[30px] grid text-[13px] text-[var(--muted)]">
        {(["nominal", "share_of_gdp", "real_growth"] as const).map(measure => (
          <p key={measure} aria-hidden={measure !== state.measure}
            className={`[grid-area:1/1] ${measure !== state.measure ? "invisible" : ""}`}>
            {t(measure === "nominal" ? "nominalContext" : measure === "share_of_gdp" ? "shareContext" : "growthContext")}
          </p>
        ))}
      </div>
      <p role="status" className="sr-only">
        {message(messages, "sectors.rangeChanged", {
          start: model.range.start,
          end: model.range.end,
        })}
      </p>
      <div
        data-testid="explorer-workspace"
        className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10"
      >
        <div className="flex min-w-0 flex-col">
          <section
            data-testid="chart-panel"
            data-mode={state.mode}
            data-measure={state.measure}
            className="border-t border-[var(--ink)] pt-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedTabs
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => update((s) => ({ ...s, mode }))}
                options={[
                  {
                    value: "line",
                    label: message(messages, "controls.chart"),
                    testId: "chart-mode-line",
                  },
                  {
                    value: "table",
                    label: message(messages, "controls.table"),
                    testId: "chart-mode-table",
                  },
                ]}
              />
              <SegmentedTabs
                ariaLabel={t("measure")}
                value={state.measure}
                onChange={(measure) =>
                  update((s) => changeSectorMeasure(s, measure, facts))
                }
                options={[
                  { value: "nominal", label: t("nominal"), icon: <span aria-hidden="true" className="text-base">₾</span> },
                  { value: "share_of_gdp", label: t("shareOfGdp"), icon: <ChartPie aria-hidden="true" size={18} strokeWidth={1.5} /> },
                  { value: "real_growth", label: t("realGrowth"), icon: <ChartNoAxesCombined aria-hidden="true" size={18} strokeWidth={1.5} /> },
                ]}
              />
            </div>
            {!state.selectedIds.length ? (
              <div className="mt-5">
                <Callout testId="no-selection-callout">
                  {message(messages, "main.noSelection")}
                </Callout>
              </div>
            ) : !model.hasData ? (
              <div className="mt-5">
                <Callout testId="no-range-data-callout">
                  {message(messages, "main.noRangeData")}
                </Callout>
              </div>
            ) : state.mode === "line" ? (
              <div className="mt-5">
                <EditorialLineChart
                  years={model.years}
                  series={series}
                  share={percent}
                  unit={unit}
                  shareLabel={measureLabel}
                  preliminaryLabel={t("preliminary")}
                  formatTooltipValue={percent ? undefined : value => formatAmount(value, locale)}
                />
              </div>
            ) : (
              <ExplorerTable
                caption={`${t("heading")} · ${percent ? measureLabel : message(messages, "format.bnGel")} · ${model.range.start}–${model.range.end}`}
                rows={model.rows.filter((r) => r.itemId !== SECTOR_GDP)}
                totalRow={total}
                showTotal={Boolean(total)}
                totalFirst
                wrapRowLabels
                years={model.years}
                firstColumnLabel={t("sector")}
                unit={unit}
                share={percent}
                showChangeColumn={false}
                preliminaryLabel={t("preliminary")}
                shareValueForYear={(row, year) =>
                  row.valuesByYear[year] ?? null
                }
              />
            )}
            <RangeStrip
              years={model.availableYears}
              range={model.range}
              onChange={(patch) =>
                update((s) => {
                  const start = patch.start ?? model.range.start,
                    end = patch.end ?? model.range.end;
                  return {
                    ...s,
                    range:
                      start === model.range.min && end === model.range.max
                        ? { kind: "all" }
                        : { kind: "manual", start, end },
                  };
                })
              }
            />
          </section>
          <div className="mt-[18px]">
            <SourceNote testId="source-label">
              {t("source")} {model.range.start}–{model.range.end}
              {activeSources.length
                ? ` · ${[...new Set(activeSources.map((s) => s.title))].join("; ")}`
                : ""}
              {preliminaryYears.length
                ? ` · ${t("preliminary")}: ${preliminaryYears.join(", ")}`
                : ""}
            </SourceNote>
          </div>
        </div>
        <SectorSeriesPanel
          registry={registry}
          selectedIds={state.selectedIds}
          endYear={model.range.end}
          endValues={model.endValues}
          measure={state.measure}
          onSelectionChange={(selectedIds) =>
            update((s) => ({ ...s, selectedIds }))
          }
          downloadAction={
            <ExcelDownloadButton
              testId="sectors-excel-download"
              disabled={!state.selectedIds.length || !model.hasData}
              onDownload={async () => {
                const { downloadWorkbook } =
                  await import("../../lib/explorer/workbookWriter.client");
                await downloadWorkbook(
                  buildEconomicSectorsWorkbookExportModel(
                    facts,
                    registry,
                    state,
                    presentation,
                    sources,
                    siteOrigin,
                  ),
                );
              }}
            />
          }
        />
      </div>
      <SectorHighlights facts={facts} registry={registry} year={model.range.end} />
    </div>
  );
}
