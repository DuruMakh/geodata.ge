"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ServedGdpObservation } from "../../lib/data/gdpOverview/types";
import { I18nProvider, useI18n } from "../../lib/i18n/provider";
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
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { PageHeader } from "../shell/page-header";
import { TextTab, SegmentedTabs, SourceNote } from "../ui/editorial";
import { EditorialLineChart } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { GdpSummary } from "./gdp-summary";

export type GdpWorkbookSource = WorkbookPublicSource & { sourceId: string };
export function GdpOverview({
  facts,
  sources,
  siteOrigin,
}: {
  facts: ServedGdpObservation[];
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
    document.body.dataset.appReady = "true";
    return () => {
      delete document.body.dataset.appReady;
    };
  }, [facts]);
  const serializedHash = serializeGdpHash(state);
  const hashApplied = useRef(false);
  useEffect(() => {
    if (!ready) return;
    // Skip the run that applies the incoming hash: writing it back would stamp a
    // pristine URL with the default state (use-explorer-state.ts has the same rule).
    if (!hashApplied.current) {
      hashApplied.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${serializedHash}`);
    } catch {
      // History can be unavailable in some embedded contexts; the UI still works.
    }
  }, [serializedHash, ready]);
  const m = useMemo(() => buildGdpOverviewModel(facts, state), [facts, state]);
  const d = gdpDisplay(state, presentation);
  const row = {
    itemId: "gdp.overview",
    kaLabel: d.label,
    color: "var(--ink)",
    valuesByYear: Object.fromEntries(m.points.map((p) => [p.year, p.value])),
  };
  const chartSeries = [
    {
      id: row.itemId,
      label: d.label,
      color: "#1E1B16",
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
      nextModel = buildGdpOverviewModel(facts, next);
    setState(next);
    setAnnouncement(
      message(messages, "gdp.rangeChanged", {
        start: nextModel.range.start,
        end: nextModel.range.end,
      }),
    );
  }
  return (
    <main
      data-testid="gdp-overview"
      className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]"
    >
      <div className="mx-auto max-w-[1180px]">
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
          coverage={`${m.range.min}–${m.range.max} · ${facts
            .map((f) => f.lastReviewedAt)
            .sort()
            .at(-1)}`}
        />
        <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {t("heading")}
        </h1>
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
          className="mb-3 overflow-x-auto py-2"
          onFocusCapture={(event) =>
            event.target.scrollIntoView({ block: "nearest", inline: "nearest" })
          }
        >
          <div className="mx-auto flex w-max gap-7 px-1">
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
              <I18nProvider
                {...presentation}
                englishLabels={{
                  ...presentation.englishLabels,
                  "gdp.overview": d.label,
                }}
              >
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
                  shareValueForYear={(r, y) => r.valuesByYear[y] ?? null}
                />
              </I18nProvider>
            )}
          </div>
          <RangeStrip
            years={m.availableYears}
            range={m.range}
            onChange={(patch) =>
              setState((s) => {
                const start = patch.start ?? m.range.start,
                  end = patch.end ?? m.range.end;
                return {
                  ...s,
                  range:
                    start === m.range.min && end === m.range.max
                      ? { kind: "all" }
                      : { kind: "manual", start, end },
                };
              })
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
              ),
            )
          }
        />
        <div className="mt-5 space-y-2">
          <SourceNote>
            {state.indicator === "real" || state.indicator === "growth"
              ? t("wbNote")
              : t("geostatNote")}{" "}
            {state.indicator === "per_capita" ? t("perCapitaNote") : ""}
          </SourceNote>
          <Link
            href={pageHref("/methodology/gdp", locale)}
            className="text-xs text-[var(--muted)] underline underline-offset-4"
          >
            {t("methodology")}
          </Link>
        </div>
        <GdpSummary indicator={state.indicator} />
      </div>
    </main>
  );
}
