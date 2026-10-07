"use client";
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
} from "../../lib/explorer/gdpWorkbook";
import { formatDisplayDate } from "../../lib/explorer/format";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { PageHeader } from "../shell/page-header";
import { TextTab, SegmentedTabs, SourceNote } from "../ui/editorial";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { GdpSummary } from "./gdp-summary";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { ExplorerPage } from "../explorer-shell/explorer-page";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { rangeFromPatch } from "../../lib/explorer/periodRange";
import { useReplaceHash } from "../explorer-shell/use-replace-hash";
import { INK } from "../../lib/explorer/colors";

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
      planned: m.years.map(() => false),
    },
  ];
  const currentSources = sources.filter((s) =>
    m.sourceIds.includes(s.sourceId),
  );
  function select(indicator: GdpIndicator) {
    const next = changeGdpIndicator(state, indicator, facts),
      nextModel = buildGdpOverviewModel(facts, next, sourceIdRanges);
    setState(next);
    setAnnouncement(
      message(messages, "gdp.rangeChanged", {
        start: nextModel.range.start,
        end: nextModel.range.end,
      }),
    );
  }
  return (
    <ExplorerPage testId="gdp-overview" containerQueries={false}>
      <PageHeader
        crumbs={[
          {
            label: message(messages, "common.home"),
            href: pageHref("/", locale),
          },
          { label: message(messages, "common.data") },
          {
            label: t("economy"),
            href: pageHref("/explorer/economy", locale),
          },
          { label: t("heading") },
        ]}
        coverage={`${m.range.min}–${m.range.max} · ${message(messages, "main.updated", {
          date: locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt,
        })}`}
      />
      <ExplorerHeading>{t("heading")}</ExplorerHeading>
      <p
        data-testid="gdp-unit"
        className="mb-4 text-[13px] text-[var(--muted)]"
      >
        {state.indicator === "real" || d.growth
          ? d.fullUnitLabel
          : state.indicator === "per_capita"
            ? `${t("perPerson")} · ${t("current")}`
            : t("current")}
      </p>
      <div
        data-testid="gdp-indicators"
        className="mb-3 py-2"
      >
        <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 px-1">
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
        </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <section
        data-testid="chart-panel"
        className="border-t border-[var(--ink)] pt-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs
            ariaLabel={message(messages, "controls.viewMode")}
            value={state.mode}
            onChange={(mode) => setState((s) => ({ ...s, mode }))}
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
          {state.indicator === "nominal" ||
          state.indicator === "per_capita" ? (
            <div data-testid="gdp-currency" className="[&_button]:min-w-[40px]">
              <SegmentedTabs
                ariaLabel={t("currency")}
                value={state.currency}
                onChange={(currency) => setState((s) => ({ ...s, currency }))}
                options={[
                  { value: "gel", label: "₾", ariaLabel: "GEL" },
                  { value: "usd", label: "$", ariaLabel: "USD" },
                ]}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-5">
          {state.mode === "line" ? (
            <EditorialLineChart
              axisLeftPadding={90}
              years={m.years}
              series={chartSeries}
              share={d.growth}
              unit={state.indicator === "per_capita"
                ? { ...d.unit, label: state.currency === "gel" ? "₾" : "$" }
                : d.unit}
              shareLabel={d.fullUnitLabel}
            />
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
        <SourceNote>
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
          className="text-xs text-[var(--muted)] underline underline-offset-4"
        >
          {t("methodology")}
        </Link>
      </div>
      <GdpSummary indicator={state.indicator} />
    </ExplorerPage>
  );
}
