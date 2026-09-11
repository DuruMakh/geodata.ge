import { makePeriod, periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import type { ServedInflationTargetRow } from "../data/inflation/types";
import { message } from "../i18n/messages";
import type { Locale, Presentation } from "../i18n/types";
import { decemberAverages } from "./inflationGrid";
import { MONTH_NUMBERS, periodLabel, seriesLabel } from "./inflationLabels";
import { buildInflationLines, seriesGroup, type InflationIndex, type InflationState, type ResolvedPeriodRange } from "./inflationOverview";
import { SHEET_NAMES, absoluteWorkbookSourceUrl, type WorkbookBasis, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

export type InflationWorkbookSource = WorkbookPublicSource & { sourceId: string; language: Locale };

/** Readable-sheet column key for the annual average, after months 1–12. */
export const SUMMARY_COLUMN = 13;

// Spec §9: the readable sheet mirrors ცხრილი — one row per selected series and
// year, months across — and percentages leave as fractions under Excel's % format.
export function buildInflationWorkbookExportModel(input: {
  index: InflationIndex;
  targets: ServedInflationTargetRow[];
  state: InflationState;
  range: ResolvedPeriodRange;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, targets, state, range, presentation, sources, siteOrigin } = input;
  const { messages, locale } = presentation;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const percent = state.tab !== "index";
  const scale = (value: number) => (percent ? value / 100 : value);
  const { periods, lines } = buildInflationLines(index, targets, state, range);
  const summary = state.tab === "yoy" && lines.some((line) => line.key === "cpi") ? decemberAverages(index.values.get("cpi.headline:avg12_pct")) : null;
  const columns: number[] = [...MONTH_NUMBERS, ...(summary ? [SUMMARY_COLUMN] : [])];
  const firstYear = periodYear(range.start);
  const lastYear = periodYear(range.end);
  const calendarYears = Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => firstYear + offset);

  const rows: WorkbookReadableRow[] = lines.flatMap((line) => {
    const label = seriesLabel(messages, line.key, state.tab);
    const byPeriod = new Map(periods.map((period, position) => [period, line.values[position] ?? null]));
    return [...calendarYears].reverse().flatMap((year) => {
      const valuesByYear: Record<number, number | null> = {};
      const basisByYear: Record<number, WorkbookBasis | null> = {};
      for (const month of MONTH_NUMBERS) {
        const value = byPeriod.get(makePeriod(year, month)) ?? null;
        valuesByYear[month] = value === null ? null : scale(value);
        basisByYear[month] = value === null ? null : "published";
      }
      if (summary) {
        const value = line.key === "cpi" ? summary.get(year) ?? null : null;
        valuesByYear[SUMMARY_COLUMN] = value === null ? null : scale(value);
        basisByYear[SUMMARY_COLUMN] = value === null ? null : "published";
      }
      if (MONTH_NUMBERS.every((month) => valuesByYear[month] === null)) return [];
      return [{ kind: "item" as const, parentLabel: label, label: String(year), valuesByYear, basisByYear, change: null }];
    });
  });

  const unit = percent ? "%" : "2010=100";
  const analysisRows = periods.flatMap((period, position) =>
    lines.flatMap((line) => {
      const value = line.values[position];
      return value === null || value === undefined
        ? []
        : [[periodYear(period), periodMonth(period), seriesLabel(messages, line.key, state.tab), scale(value), unit, t("published")]];
    }),
  );

  const usedSourceIds = new Set<string>();
  for (const line of lines) {
    if (line.key === "target") {
      for (const row of targets) usedSourceIds.add(row.sourceId);
    } else {
      const id = index.sourceIds.get(seriesGroup(line.key, state.tab));
      if (id) usedSourceIds.add(id);
    }
  }
  if (summary) {
    const id = index.sourceIds.get("cpi.headline:avg12_pct");
    if (id) usedSourceIds.add(id);
  }
  // Link the archive copy in the reader's language when one exists.
  const chosen = [...usedSourceIds].flatMap((id) => {
    const candidates = sources.filter((row) => row.sourceId === id);
    const row = candidates.find((entry) => entry.language === locale) ?? candidates.find((entry) => entry.language === "en");
    return row ? [row] : [];
  });

  return {
    locale,
    filename: `fiscal-inflation-${state.tab}-${periodKey(range.start)}-${periodKey(range.end)}${locale === "en" ? "-en" : ""}.xlsx`,
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t(`tab.${state.tab}`),
      subtitle: `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t(`unit.${state.tab}`)}`,
      unitLabel: t(`workbookUnit.${state.tab}`),
      showChangeColumn: false,
      years: columns,
      headerLabels: {
        category: t("seriesYear"),
        columns: columns.map((column) => (column === SUMMARY_COLUMN ? t("annualAverage") : message(messages, `inflation.month.${column}`))),
      },
      rows,
    },
    analysis: {
      headers: [t("year"), t("month"), t("seriesColumn"), t("value"), t("unitColumn"), t("status")],
      rows: analysisRows,
      numericFormats: { 4: percent ? "0.00%" : "#,##0.00" },
    },
    sources: chosen
      .map((row) => ({ ...row, years: row.years.filter((year) => calendarYears.includes(year)), absoluteUrl: absoluteWorkbookSourceUrl(siteOrigin, row.downloadHref) }))
      .filter((row) => row.years.length > 0),
    sourceYears: calendarYears,
  };
}
