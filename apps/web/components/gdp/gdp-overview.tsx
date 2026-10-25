"use client";
import { coverageLabel } from "../../lib/explorer/coverageLabel";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ClientGdpObservation, SourceIdRanges } from "../../lib/servedRows";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { pageHref } from "../../lib/i18n/routes";
import {
  DEFAULT_GDP_STATE,
  buildGdpOverviewModel,
  changeGdpIndicator,
  parseGdpHash,
  serializeGdpHash,
  type GdpIndicator,
  type GdpState,
} from "../../lib/explorer/gdpOverview";
import {
  buildGdpWorkbookExportModel,
  gdpDisplay,
  gdpSelectionSources,
} from "../../lib/explorer/gdpWorkbook";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { PageHeader } from "../shell/page-header";
import { TextTab, TextTabGroup, SegmentedTabs, SourceNote } from "../ui/editorial";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { GdpSummary } from "./gdp-summary";
import { ModeTabs } from "../explorer-shell/mode-tabs";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { LatestValueLine } from "../explorer-shell/latest-value-line";
import { formatGdpLatestValue } from "../../lib/explorer/latestValue";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { INK } from "../../lib/explorer/colors";
import { ALL_DATA_PATH } from "../../lib/navigation/navTree";

export type GdpWorkbookSource = WorkbookPublicSource & { sourceId: string };
export function GdpOverview({
  facts,
  sourceIdRanges,
  lastReviewedAt,
  sources,
  siteOrigin,
}: {
  facts: ClientGdpObservation[];
  // GDP cites a different Geostat vintage before and after the SNA 2008
  // switch, and the workbook lists the sources the selected range actually
  // rests on — so the id is carried per run of years, not per series.
  sourceIdRanges: SourceIdRanges;
  lastReviewedAt: string;
  sources: GdpWorkbookSource[];
  siteOrigin: string;
}) {
  const presentation = useI18n(),
    { messages, locale } = presentation;
  const t = (key: string) => message(messages, `gdp.${key}`);
  const [state, setState] = useState<GdpState>(DEFAULT_GDP_STATE);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const parsed = parseGdpHash(window.location.hash);
    // The initial hash is resolved after hydration; SSR remains the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(changeGdpIndicator(parsed, parsed.indicator, facts));
    setReady(true);
  }, [facts]);
  useAppReady();
  const serializedHash = serializeGdpHash(state);
  useReplaceHash(serializedHash, ready);
  const m = useMemo(
    () => buildGdpOverviewModel(facts, state, sourceIdRanges),
    [facts, state, sourceIdRanges],
  );
  const d = gdpDisplay(state, presentation);
  // The latest loaded year of the active indicator, whatever range is selected.
  const latest = useMemo(() => buildGdpOverviewModel(facts, { ...state, range: { kind: "all" } }, sourceIdRanges).headline, [facts, state, sourceIdRanges]);
  const row = {
    itemId: "gdp.overview",
    kaLabel: d.label,
    color: "var(--ink)",
    valuesByYear: Object.fromEntries(m.points.map((p) => [p.year, p.value])),
  };
  const selectedYears = new Set(m.years);
  const preliminaryYears = [
    ...new Set(
      facts
        .filter((fact) => fact.status === "preliminary" && selectedYears.has(fact.year))
        .map((fact) => fact.year),
    ),
  ]
    .sort((left, right) => left - right)
    .join(", ");
  const chartSeries = [
    {
      id: row.itemId,
      label: d.label,
      color: INK,
      // Shared chart percentages use points; table and workbook use fractions.
      vals: m.points.map((p) => d.growth ? p.value * 100 : p.value),
    },
  ];
  const currentSources = gdpSelectionSources(sources, m.sourceIds);
  // Says what the chart now shows: two indicators can share a period, so the period alone may not change.
  function show(next: GdpState) {
    const nextModel = buildGdpOverviewModel(facts, next, sourceIdRanges),
      nextDisplay = gdpDisplay(next, presentation);
    setState(next);
    setAnnouncement(
      `${nextDisplay.label} · ${nextDisplay.fullUnitLabel} · ${message(messages, "gdp.rangeChanged", {
        start: nextModel.range.start,
        end: nextModel.range.end,
      })}`,
    );
  }
  function select(indicator: GdpIndicator) {
    show(changeGdpIndicator(state, indicator, facts));
  }
  const chart = (
    <EditorialLineChart
      years={m.years}
      series={chartSeries}
      share={d.growth}
      unit={state.indicator === "per_capita"
        ? { ...d.unit, label: state.currency === "gel" ? "₾" : "$" }
        : d.unit}
      shareLabel={d.fullUnitLabel}
    />
  );
  const shareAction = (
    <ChartShareButton
      title={t("heading")}
      caption={`${d.label} · ${d.fullUnitLabel} · ${m.range.start}–${m.range.end}`}
      legend={chartSeries.map(({ label, color }) => ({ label, color }))}
      source={state.indicator === "real" || state.indicator === "growth" ? t("wbNote") : t("geostatNote")}
      chart={chart}
      period={`${m.range.start}-${m.range.end}`}
    />
  );
  return (
    <ExplorerPage testId="gdp-overview" containerQueries={false}>
      <PageHeader
        locale={locale}
        messages={messages}
        crumbs={[
          {
            label: message(messages, "common.home"),
            href: pageHref("/", locale),
          },
          { label: message(messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) },
          {
            label: t("economy"),
            href: pageHref("/explorer/economy", locale),
          },
          { label: t("heading") },
        ]}
        coverage={coverageLabel(messages, locale, m.range.min, m.range.max, lastReviewedAt)}
      />
      <ExplorerHeading>{t("heading")}</ExplorerHeading>
      {latest ? (
        <LatestValueLine
          testId="gdp-latest"
          measure={d.label}
          period={latest.year}
          value={formatGdpLatestValue(state, latest.value, messages)}
          note={latest.status === "preliminary" ? t("preliminary") : undefined}
        />
      ) : null}
      <div
        data-testid="gdp-indicators"
        className="mb-3 py-2"
      >
        <TextTabGroup ariaLabel={t("indicator")} className="flex flex-wrap justify-center gap-x-7 gap-y-3 px-1">
          {(["real", "nominal", "growth", "per_capita"] as const).map(
            (id) => (
              <TextTab
                key={id}
                testId={`gdp-tab-${id}`}
                label={t(id)}
                active={state.indicator === id}
                onClick={() => select(id)}
              />
            ),
          )}
        </TextTabGroup>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <section
        data-testid="chart-panel"
        className="border-t border-[var(--ink)] pt-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ModeTabs value={state.mode} onChange={(mode) => setState((s) => ({ ...s, mode }))} />
          {state.indicator === "nominal" ||
          state.indicator === "per_capita" ? (
            <div data-testid="gdp-currency" className="[&_button]:min-w-[40px]">
              <SegmentedTabs
                ariaLabel={t("currency")}
                value={state.currency}
                onChange={(currency) => show({ ...state, currency })}
                options={[
                  { value: "gel", label: t("gel"), icon: <span aria-hidden="true" className="text-base">₾</span> },
                  { value: "usd", label: t("usd"), icon: <span aria-hidden="true" className="text-base">$</span> },
                ]}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-5">
          {state.mode === "line" ? (
            chart
          ) : (
            <ExplorerTable
              caption={`${d.label} · ${d.fullUnitLabel}`}
              rows={[row]}
              totalRow={null}
              showTotal={false}
              years={m.years}
              firstColumnLabel={t("indicator")}
              unit={d.unit}
              share={d.growth}
              showChangeColumn={false}
              preliminaryYears={m.preliminaryYears}
              preliminaryLabel={t("preliminary")}
              rowLabelsLocalized
              shareValueForYear={(r, y) => r.valuesByYear[y] ?? null}
            />
          )}
        </div>
        <RangeStrip
          years={m.availableYears}
          range={m.range}
          onChange={(patch) =>
            setState((s) => ({ ...s, range: rangeFromPatch(m.range, patch) }))
          }
        />
      </section>
      <ExcelDownloadButton
        testId="gdp-download"
        disabled={!m.years.length}
        onDownload={() =>
          downloadWorkbook(
            buildGdpWorkbookExportModel(
              facts,
              state,
              presentation,
              currentSources,
              siteOrigin,
              sourceIdRanges,
            ),
          )
        }
      />
      <div className="mt-5 space-y-2">
        <SourceNote testId="source-label" action={shareAction}>
          {/* The price basis sits with the source, not as a second line under the heading (DESIGN §17). */}
          <span data-testid="gdp-unit">{state.indicator === "real" ? t("constant") : d.growth ? t("percent") : t("current")}</span>
          {" · "}
          {state.indicator === "real" || state.indicator === "growth" ? (
            <>
              {t("wbNote")} {" "}
              {preliminaryYears
                ? message(messages, "gdp.wbPreliminaryBasisNote", {
                    years: preliminaryYears,
                  })
                : ""}
            </>
          ) : (
            <>
              {t("geostatNote")} {" "}
              {preliminaryYears
                ? message(messages, "gdp.preliminaryNote", { years: preliminaryYears })
                : ""}{" "}
              {state.indicator === "per_capita" ? t("perCapitaNote") : ""}
            </>
          )}
        </SourceNote>
        <Link
          href={pageHref("/methodology/gdp", locale)}
          prefetch={false}
          className="inline-flex min-h-11 items-center text-xs text-[var(--muted)] underline underline-offset-4"
        >
          {t("methodology")}
        </Link>
      </div>
      <GdpSummary indicator={state.indicator} />
    </ExplorerPage>
  );
}
