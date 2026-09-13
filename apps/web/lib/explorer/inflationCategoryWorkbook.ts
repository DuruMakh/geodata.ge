import { makePeriod, periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import {
  RESIDUAL_ID,
  buildCategoryLines,
  buildStackModel,
  latestWeight,
  type CategoryIndex,
  type CategoryState,
  type ResolvedPeriodRange,
} from "./inflationCategories";
import { categoryLabel } from "./inflationCategoryLabels";
import { MONTH_NUMBERS, periodLabel } from "./inflationLabels";
import type { InflationWorkbookSource } from "./inflationWorkbook";
import {
  SHEET_NAMES,
  absoluteWorkbookSourceUrl,
  type WorkbookBasis,
  type WorkbookExportModel,
  type WorkbookReadableRow,
} from "./workbookModel";

const WEIGHTS_SOURCE_ID = "source.geostat_basket_weights";

// Spec §9: the readable sheet mirrors ცხრილი — one row per selected category and
// year, months across. Rate tabs leave as fractions under Excel's % format;
// contributions are percentage points and leave as plain signed numbers. The
// contribution tab adds the residual row, so the exported parts re-add to the
// published headline exactly as they do on screen.
export function buildInflationCategoryWorkbookExportModel(input: {
  index: CategoryIndex;
  state: CategoryState;
  range: ResolvedPeriodRange;
  headline: Map<number, number>;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, state, range, headline, presentation, sources, siteOrigin } = input;
  const { messages, locale } = presentation;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const contribution = state.tab === "contrib";
  // A rate leaves as a fraction under Excel percent format; a contribution is
  // percentage points and stays a plain number, as it does on screen.
  const scale = (value: number) => (contribution ? value : value / 100);

  // Both tabs produce the same shape: an ordered list of labelled series. Only the
  // contribution tab appends the residual.
  const series = contribution
    ? (() => {
        const stack = buildStackModel(index, state, range, headline);
        return {
          periods: stack.periods,
          entries: [
            ...stack.segments.map((segment) => ({ id: segment.categoryId, values: segment.values })),
            { id: RESIDUAL_ID, values: stack.residual as Array<number | null> },
          ],
        };
      })()
    : (() => {
        const lines = buildCategoryLines(index, state, range);
        return { periods: lines.periods, entries: lines.lines.map((line) => ({ id: line.key, values: line.values })) };
      })();

  const label = (id: string) => (id === RESIDUAL_ID ? t("categoryResidual") : categoryLabel(messages, id));
  const firstYear = periodYear(range.start);
  const lastYear = periodYear(range.end);
  const calendarYears = Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => firstYear + offset);

  const rows: WorkbookReadableRow[] = series.entries.flatMap((entry) => {
    const byPeriod = new Map(series.periods.map((period, position) => [period, entry.values[position] ?? null]));
    return [...calendarYears].reverse().flatMap((year) => {
      const valuesByYear: Record<number, number | null> = {};
      const basisByYear: Record<number, WorkbookBasis | null> = {};
      for (const month of MONTH_NUMBERS) {
        const value = byPeriod.get(makePeriod(year, month)) ?? null;
        valuesByYear[month] = value === null ? null : scale(value);
        basisByYear[month] = value === null ? null : "published";
      }
      if (MONTH_NUMBERS.every((month) => valuesByYear[month] === null)) return [];
      return [
        { kind: "item" as const, parentLabel: label(entry.id), label: String(year), valuesByYear, basisByYear, change: null },
      ];
    });
  });

  const unit = contribution ? t("pp") : "%";
  const analysisRows = series.periods.flatMap((period, position) =>
    series.entries.flatMap((entry) => {
      const value = entry.values[position];
      if (value === null || value === undefined) return [];
      const isResidual = entry.id === RESIDUAL_ID;
      const weight = isResidual ? null : latestWeight(index, entry.id);
      return [
        [
          periodYear(period),
          periodMonth(period),
          label(entry.id),
          isResidual ? "" : entry.id.replace("cpi.cat.", "").replace("_", "."),
          isResidual ? "" : entry.id.includes("_") ? 3 : 2,
          weight === null ? null : weight / 100,
          scale(value),
          unit,
          t("published"),
        ],
      ];
    }),
  );

  // Only a contribution export depends on the basket weights; a rate export is
  // the published price change alone and must not claim the weights source.
  const usedSourceIds = new Set<string>();
  for (const entry of series.entries) {
    if (entry.id === RESIDUAL_ID) continue;
    const measure = state.tab === "mom" ? "mom_pct" : "yoy_pct";
    for (const fact of index.values.keys()) {
      if (fact === `${entry.id}:${measure}`) usedSourceIds.add(measure === "yoy_pct" ? "source.geostat_cpi_yoy" : "source.geostat_cpi_mom");
    }
  }
  if (contribution) usedSourceIds.add(WEIGHTS_SOURCE_ID);

  const chosen = [...usedSourceIds].flatMap((id) => {
    const candidates = sources.filter((row) => row.sourceId === id);
    const row = candidates.find((entry) => entry.language === locale) ?? candidates.find((entry) => entry.language === "en");
    return row ? [row] : [];
  });

  const subtitle = `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t(`categoryWorkbookUnit.${state.tab}`)}`;

  return {
    locale,
    filename: `fiscal-inflation-categories-${state.tab}-${periodKey(range.start)}-${periodKey(range.end)}${locale === "en" ? "-en" : ""}.xlsx`,
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t(`categoryTab.${state.tab}`),
      // A derived measure says so on the sheet, not only on the page.
      subtitle: contribution ? `${subtitle} · ${t("categoryContributionNote")}` : subtitle,
      unitLabel: t(`categoryWorkbookUnit.${state.tab}`),
      numberFormat: contribution ? "+0.0;−0.0;0.0" : "0.0%",
      showChangeColumn: false,
      years: [...MONTH_NUMBERS],
      headerLabels: {
        category: t("seriesYear"),
        columns: MONTH_NUMBERS.map((column) => message(messages, `inflation.month.${column}`)),
      },
      rows,
    },
    analysis: {
      headers: [
        t("year"),
        t("month"),
        t("categoryColumn"),
        t("coicopColumn"),
        t("levelColumn"),
        t("weightColumn"),
        t("value"),
        t("unitColumn"),
        t("status"),
      ],
      rows: analysisRows,
      numericFormats: { 6: '0.0"%"', 7: contribution ? "0.00" : "0.00%" },
    },
    sources: chosen
      .map((row) => ({
        ...row,
        years: row.years.filter((year) => calendarYears.includes(year)),
        absoluteUrl: absoluteWorkbookSourceUrl(siteOrigin, row.downloadHref),
      }))
      .filter((row) => row.years.length > 0),
    sourceYears: calendarYears,
  };
}
