import type { Locale } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";

export type WorkbookBasis = "actual" | "planned" | "forecast" | "not_available";

export type WorkbookPoint = {
  amountGel: number | null;
  measureValue?: number | null;
  basis: WorkbookBasis;
};

export type WorkbookSeries = {
  id: string;
  kind: "total" | "group" | "item";
  parentLabel: string | null;
  label: string;
  pointsByYear: Record<number, WorkbookPoint | null | undefined>;
};

export type WorkbookPublicSource = {
  years: number[];
  title: string;
  organization: string;
  downloadHref: `/downloads/methodology/${string}` | `https://${string}`;
  retrievedAt: string;
};

export type WorkbookMeasure =
  | { kind: "amount"; unitLabel: string; readableScale: number }
  | { kind: "percentage"; unitLabel: string; analysisHeader: string };

export type WorkbookExportInput = {
  locale: Locale;
  filenameBase: string;
  title: string;
  groupLabel: string;
  years: number[];
  measure: WorkbookMeasure;
  totalId: string | null;
  series: WorkbookSeries[];
  includeTotalsInAnalysis?: boolean;
  sources: WorkbookPublicSource[];
  siteOrigin: string;
};

export type WorkbookReadableRow = {
  kind: WorkbookSeries["kind"];
  parentLabel: string | null;
  label: string;
  valuesByYear: Record<number, number | null>;
  basisByYear: Record<number, WorkbookBasis | null>;
  change: number | null;
};

export const SHEET_NAMES = {
  ka: ["მარტივი ცხრილი", "მონაცემები", "წყაროები"],
  en: ["Summary", "Data", "Sources"],
} as const;

export type WorkbookExportModel = {
  locale: Locale;
  filename: string;
  sheetNames: (typeof SHEET_NAMES)[Locale];
  readable: {
    title: string;
    subtitle: string;
    unitLabel: string;
    years: number[];
    rows: WorkbookReadableRow[];
  };
  analysis: {
    headers: string[];
    rows: Array<Array<string | number | null>>;
  };
  sources: Array<WorkbookPublicSource & { absoluteUrl: string }>;
};

const statusLabel = (basis: WorkbookBasis, locale: Locale) => workbookMessage(locale, ({
  actual: "workbook.actual", planned: "workbook.planned", forecast: "workbook.forecast", not_available: "workbook.unavailable",
} as const)[basis]);

export function absoluteWorkbookSourceUrl(
  siteOrigin: string,
  downloadHref: WorkbookPublicSource["downloadHref"],
): string {
  if (downloadHref.startsWith("https://")) return downloadHref;
  return `${siteOrigin.replace(/\/+$/, "")}/${downloadHref.replace(/^\/+/, "")}`;
}

function safeChange(start: number | null, end: number | null): number | null {
  if (start === null || end === null || start <= 0 || end < 0) return null;
  return end / start - 1;
}

function readableValue(measure: WorkbookMeasure, point: WorkbookPoint | null | undefined): number | null {
  if (!point) return null;
  return measure.kind === "percentage"
    ? point.measureValue ?? null
    : point.amountGel === null
      ? null
      : point.amountGel / measure.readableScale;
}

function subtitle(rows: WorkbookReadableRow[], years: number[], unitLabel: string, locale: Locale): string {
  const statuses = Object.values(rows.flatMap((row) => Object.values(row.basisByYear))).filter((basis): basis is WorkbookBasis => basis !== null);
  const bases = new Set(statuses.filter((basis) => basis !== "not_available"));
  const basis = bases.has("actual") && bases.has("forecast")
    ? workbookMessage(locale, "workbook.actualForecast")
    : bases.has("actual") && bases.has("planned")
      ? workbookMessage(locale, "workbook.actualPlanned")
      : bases.has("forecast")
        ? workbookMessage(locale, "workbook.forecast")
        : bases.has("planned")
          ? workbookMessage(locale, "workbook.planned")
          : statuses.includes("not_available")
            ? workbookMessage(locale, "workbook.unavailable")
          : workbookMessage(locale, "workbook.actual");
  const period = years.length > 0 ? `${years[0]}–${years.at(-1)}` : workbookMessage(locale, "workbook.noPeriod");
  return `${period} · ${basis} · ${unitLabel}`;
}

export function buildWorkbookExportModel(input: WorkbookExportInput): WorkbookExportModel {
  const years = [...input.years];
  const rows = input.series.map<WorkbookReadableRow>((series) => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, WorkbookBasis | null> = {};
    for (const year of years) {
      const point = series.pointsByYear[year];
      valuesByYear[year] = readableValue(input.measure, point);
      basisByYear[year] = point?.basis ?? null;
    }
    return {
      kind: series.kind,
      parentLabel: series.parentLabel,
      label: series.label,
      valuesByYear,
      basisByYear,
      change: safeChange(valuesByYear[years[0] ?? 0] ?? null, valuesByYear[years.at(-1) ?? 0] ?? null),
    };
  });

  const nonTotalsExist = input.series.some((series) => series.kind !== "total");
  const analysisSeries = input.includeTotalsInAnalysis
    ? input.series
    : input.series.filter((series) => !nonTotalsExist || series.kind !== "total");
  const headers = (["workbook.year", "workbook.group", "workbook.category", "workbook.amountGel", "workbook.status"] as const).map(key => workbookMessage(input.locale, key));
  if (input.measure.kind === "percentage") headers.push(input.measure.analysisHeader);
  const analysisRows: Array<Array<string | number | null>> = [];
  for (const year of years) {
    for (const series of analysisSeries) {
      const point = series.pointsByYear[year];
      if (!point) continue;
      const row: Array<string | number | null> = [year, series.parentLabel ?? input.groupLabel, series.label, point.amountGel];
      row.push(statusLabel(point.basis, input.locale));
      if (input.measure.kind === "percentage") row.push(point.measureValue ?? null);
      analysisRows.push(row);
    }
  }

  const sourcesByHref = new Map<string, WorkbookPublicSource>();
  for (const source of input.sources) {
    const activeYears = source.years.filter((year) => years.includes(year));
    if (activeYears.length === 0) continue;
    const existing = sourcesByHref.get(source.downloadHref);
    sourcesByHref.set(source.downloadHref, existing
      ? { ...existing, years: [...new Set([...existing.years, ...activeYears])].sort((left, right) => left - right) }
      : { ...source, years: [...new Set(activeYears)].sort((left, right) => left - right) });
  }
  const sources = [...sourcesByHref.values()].sort((left, right) => (left.years[0] ?? 0) - (right.years[0] ?? 0)).map((source) => ({
    ...source,
    absoluteUrl: absoluteWorkbookSourceUrl(input.siteOrigin, source.downloadHref),
  }));

  const range = years.length > 0 ? `-${years[0]}-${years.at(-1)}` : "";
  return {
    locale: input.locale,
    filename: `fiscal-${input.filenameBase}${range}${input.locale === "en" ? "-en" : ""}.xlsx`,
    sheetNames: SHEET_NAMES[input.locale],
    readable: {
      title: input.title,
      subtitle: subtitle(rows, years, input.measure.unitLabel, input.locale),
      unitLabel: input.measure.unitLabel,
      years,
      rows,
    },
    analysis: { headers, rows: analysisRows },
    sources,
  };
}
