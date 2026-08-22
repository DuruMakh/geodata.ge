export type WorkbookBasis = "actual" | "planned";

export type WorkbookPoint = {
  amountGel: number;
  measureValue?: number | null;
  basis: WorkbookBasis;
};

export type WorkbookSeries = {
  id: string;
  kind: "total" | "group" | "item";
  parentLabelKa: string | null;
  labelKa: string;
  pointsByYear: Record<number, WorkbookPoint | null | undefined>;
};

export type WorkbookPublicSource = {
  years: number[];
  titleKa: string;
  organizationKa: string;
  downloadHref: `/downloads/methodology/${string}` | `https://${string}`;
  retrievedAt: string;
};

export type WorkbookMeasure =
  | { kind: "amount"; unitLabelKa: string; readableScale: number }
  | { kind: "percentage"; unitLabelKa: string; analysisHeaderKa: string };

export type WorkbookExportInput = {
  filenameBase: string;
  titleKa: string;
  groupLabelKa: string;
  years: number[];
  measure: WorkbookMeasure;
  totalId: string | null;
  series: WorkbookSeries[];
  sources: WorkbookPublicSource[];
  siteOrigin: string;
};

export type WorkbookReadableRow = {
  kind: WorkbookSeries["kind"];
  parentLabelKa: string | null;
  labelKa: string;
  valuesByYear: Record<number, number | null>;
  basisByYear: Record<number, WorkbookBasis | null>;
  change: number | null;
};

export type WorkbookExportModel = {
  filename: string;
  sheetNames: readonly ["მარტივი ცხრილი", "მონაცემები", "წყაროები"];
  readable: {
    titleKa: string;
    subtitleKa: string;
    unitLabelKa: string;
    years: number[];
    rows: WorkbookReadableRow[];
  };
  analysis: {
    headers: string[];
    rows: Array<Array<string | number | null>>;
  };
  sources: Array<WorkbookPublicSource & { absoluteUrl: string }>;
};

const statusKa = (basis: WorkbookBasis) => (basis === "planned" ? "გეგმა" : "ფაქტი");

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
  return measure.kind === "percentage" ? point.measureValue ?? null : point.amountGel / measure.readableScale;
}

function subtitleKa(rows: WorkbookReadableRow[], years: number[], unitLabelKa: string): string {
  const bases = new Set(Object.values(rows.flatMap((row) => Object.values(row.basisByYear))).filter((basis): basis is WorkbookBasis => basis !== null));
  const basis = bases.size > 1 ? "ფაქტი და გეგმა" : bases.has("planned") ? "გეგმა" : "ფაქტი";
  const period = years.length > 0 ? `${years[0]}–${years.at(-1)}` : "პერიოდი არ არის";
  return `${period} · ${basis} · ${unitLabelKa}`;
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
      parentLabelKa: series.parentLabelKa,
      labelKa: series.labelKa,
      valuesByYear,
      basisByYear,
      change: safeChange(valuesByYear[years[0] ?? 0] ?? null, valuesByYear[years.at(-1) ?? 0] ?? null),
    };
  });

  const nonTotalsExist = input.series.some((series) => series.kind !== "total");
  const analysisSeries = input.series.filter((series) => !nonTotalsExist || series.kind !== "total");
  const headers = ["წელი", "მთავარი ჯგუფი", "კატეგორია", "თანხა (₾)", "სტატუსი", ...(input.measure.kind === "percentage" ? [input.measure.analysisHeaderKa] : [])];
  const analysisRows: Array<Array<string | number | null>> = [];
  for (const year of years) {
    for (const series of analysisSeries) {
      const point = series.pointsByYear[year];
      if (!point) continue;
      const row: Array<string | number | null> = [year, series.parentLabelKa ?? input.groupLabelKa, series.labelKa, point.amountGel];
      row.push(statusKa(point.basis));
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
    filename: `fiscal-${input.filenameBase}${range}.xlsx`,
    sheetNames: ["მარტივი ცხრილი", "მონაცემები", "წყაროები"],
    readable: {
      titleKa: input.titleKa,
      subtitleKa: subtitleKa(rows, years, input.measure.unitLabelKa),
      unitLabelKa: input.measure.unitLabelKa,
      years,
      rows,
    },
    analysis: { headers, rows: analysisRows },
    sources,
  };
}
