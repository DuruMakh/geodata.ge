import { makePeriod, periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import type { ClientInflationTargetRow } from "../servedRows";
import { message } from "../i18n/messages";
import type { Locale, Presentation } from "../i18n/types";
import { decemberAverages } from "./inflationGrid";
import { MONTH_NUMBERS, periodLabel, seriesLabel } from "./inflationLabels";
import { buildInflationLines, seriesGroup, type InflationIndex, type InflationState, type ResolvedPeriodRange } from "./inflationOverview";
import { SHEET_NAMES, type WorkbookBasis, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow, withAbsoluteUrls, workbookFilename } from "./workbookModel";

export type InflationWorkbookSource = WorkbookPublicSource & { sourceId: string; language: Locale };

/** Readable-sheet column key for the annual average, after months 1–12. */
export const SUMMARY_COLUMN = 13;

/** Every calendar year the period range touches, oldest first. */
export function calendarYearsOf(range: ResolvedPeriodRange): number[] {
  const firstYear = periodYear(range.start);
  const lastYear = periodYear(range.end);
  return Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => firstYear + offset);
}

/**
 * One series on the readable sheet: a row per calendar year, newest first,
 * months across, plus the summary column when `summary` is given. A year
 * without a single month is left out.
 */
export function monthlyReadableRows(
  parentLabel: string,
  byPeriod: Map<number, number | null>,
  calendarYears: readonly number[],
  scale: (value: number) => number,
  summary?: (year: number) => number | null,
): WorkbookReadableRow[] {
  return [...calendarYears].reverse().flatMap((year) => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, WorkbookBasis | null> = {};
    for (const month of MONTH_NUMBERS) {
      const value = byPeriod.get(makePeriod(year, month)) ?? null;
      valuesByYear[month] = value === null ? null : scale(value);
      basisByYear[month] = value === null ? null : "published";
    }
    if (summary) {
      const value = summary(year);
      valuesByYear[SUMMARY_COLUMN] = value === null ? null : scale(value);
      basisByYear[SUMMARY_COLUMN] = value === null ? null : "published";
    }
    if (MONTH_NUMBERS.every((month) => valuesByYear[month] === null)) return [];
    return [{ kind: "item" as const, parentLabel, label: String(year), valuesByYear, basisByYear, change: null }];
  });
}

/** Link the archive copy in the reader's language when one exists, else the English one. */
export function pickLocaleEditions(
  sources: readonly InflationWorkbookSource[],
  sourceIds: Iterable<string>,
  locale: Locale,
): InflationWorkbookSource[] {
  return [...sourceIds].flatMap((id) => {
    const candidates = sources.filter((row) => row.sourceId === id);
    const row = candidates.find((entry) => entry.language === locale) ?? candidates.find((entry) => entry.language === "en");
    return row ? [row] : [];
  });
}

/** The Sources sheet: each chosen edition, narrowed to the calendar years the sheet covers. */
export function monthlyWorkbookSources(
  chosen: readonly InflationWorkbookSource[],
  calendarYears: readonly number[],
  siteOrigin: string,
) {
  return withAbsoluteUrls(
    chosen
      .map((row) => ({ ...row, years: row.years.filter((year) => calendarYears.includes(year)) }))
      .filter((row) => row.years.length > 0),
    siteOrigin,
  );
}

// Spec §9: the readable sheet mirrors ცხრილი — one row per selected series and
// year, months across — and percentages leave as fractions under Excel's % format.
export function buildInflationWorkbookExportModel(input: {
  index: InflationIndex;
  targets: ClientInflationTargetRow[];
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
  const calendarYears = calendarYearsOf(range);

  const rows: WorkbookReadableRow[] = lines.flatMap((line) => {
    const label = seriesLabel(messages, line.key, state.tab);
    const byPeriod = new Map(periods.map((period, position) => [period, line.values[position] ?? null]));
    const lineSummary = summary ? (year: number) => (line.key === "cpi" ? summary.get(year) ?? null : null) : undefined;
    return monthlyReadableRows(label, byPeriod, calendarYears, scale, lineSummary);
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
  const chosen = pickLocaleEditions(sources, usedSourceIds, locale);

  return {
    locale,
    filename: workbookFilename(`inflation-${state.tab}-${periodKey(range.start)}-${periodKey(range.end)}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t(`tab.${state.tab}`),
      subtitle: `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t(`unit.${state.tab}`)}`,
      unitLabel: t(`workbookUnit.${state.tab}`),
      // Inflation is never coloured good/bad, and a published 0.0 must not read as blank.
      numberFormat: percent ? "0.0%" : "#,##0.0",
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
    sources: monthlyWorkbookSources(chosen, calendarYears, siteOrigin),
    sourceYears: calendarYears,
  };
}
