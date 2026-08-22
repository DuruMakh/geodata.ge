import path from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import {
  loadReviewedSourceManifest,
  type ValidatedSourceManifestRow,
} from "./sourceManifest";
import type { MethodologyDatasetId } from "./types";

export type WorkbookSourceRole =
  | "revenue"
  | "expenditure-fields"
  | "expenditure-ministries"
  | "municipal-functional"
  | "municipal-total";

export function projectWorkbookSources(
  rows: readonly ValidatedSourceManifestRow[],
): WorkbookPublicSource[] {
  const preferred = new Map<string, { row: ValidatedSourceManifestRow; years: Set<number> }>();
  for (const row of rows) {
    const existing = preferred.get(row.sha256);
    if (!existing) {
      preferred.set(row.sha256, { row, years: new Set(row.years) });
    } else {
      for (const year of row.years) existing.years.add(year);
      if (sourcePreference(row) < sourcePreference(existing.row)) existing.row = row;
    }
  }
  return [...preferred.values()].map(({ row, years }) => ({
    years: [...years].sort((left, right) => left - right),
    titleKa: row.display_title_ka,
    organizationKa: row.source_organization,
    downloadHref: row.downloadHref,
    retrievedAt: row.retrieved_at,
  }));
}

function sourcePreference(row: ValidatedSourceManifestRow): number {
  if (row.source_id.includes("mof_excel_fact")) return 0;
  if (row.source_id.includes("mof_final_fact")) return 1;
  return 2;
}

function yearOf(row: ValidatedSourceManifestRow): number {
  return row.years[0] ?? Number(row.year.slice(0, 4));
}

function roleRows(
  datasetId: MethodologyDatasetId,
  rows: readonly ValidatedSourceManifestRow[],
  role: WorkbookSourceRole,
): readonly ValidatedSourceManifestRow[] {
  if (role === "revenue") return rows;
  if (role === "municipal-functional") {
    return rows.filter((row) => row.source_id.includes("functional_classification") || row.source_id.includes("portal_functional"));
  }
  if (role === "municipal-total") {
    return rows.filter((row) => row.source_id.includes("budget_history") || row.source_id.includes("adjara.republic"));
  }
  if (role === "expenditure-ministries") {
    return rows.filter((row) => row.source_id.includes("mof_excel_fact"));
  }
  if (datasetId !== "expenditure") return rows;

  return rows.filter((row) => {
    const year = yearOf(row);
    if (year === 2004) return row.source_id.includes("mof_annual_execution_annex");
    if (year <= 2007) return row.source_id.includes("treasury_e11");
    if (year <= 2016) return row.source_id.includes("treasury_e11") || row.source_id.includes("mof_annual_execution");
    return row.source_id.includes("treasury_e11") || row.source_id.includes("mof_excel_fact");
  });
}

const municipalHistoryHrefPattern = /\/mof-municipality-budget-history-(\d{2})\.xlsx$/;
const adjaraRepublicHrefPattern = /\/adjara-republic-actual-payments\.(?:pdf|xlsx)$/;

export function scopeMunicipalWorkbookSources(
  sources: readonly WorkbookPublicSource[],
  scope: {
    municipalityCodes: readonly string[];
    includeAdjaraRepublic: boolean;
  },
): WorkbookPublicSource[] {
  const includedCodes = new Set(scope.municipalityCodes);
  return sources.filter((source) => {
    const historyCode = municipalHistoryHrefPattern.exec(source.downloadHref)?.[1];
    if (historyCode !== undefined) return includedCodes.has(historyCode);
    return scope.includeAdjaraRepublic || !adjaraRepublicHrefPattern.test(source.downloadHref);
  });
}

const gdpWorkbookSourceRowSchema = z.object({
  accounting_standard: z.enum(["sna_1993", "sna_2008"]),
  retrieved_file_url: z.string().url().startsWith("https://"),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  selected_year_min: z.coerce.number().int(),
  selected_year_max: z.coerce.number().int(),
});

const titleByStandard = {
  sna_1993: "მშპ მიმდინარე ფასებში — SNA 1993",
  sna_2008: "მშპ მიმდინარე ფასებში — SNA 2008",
} as const;

export function projectGdpWorkbookSources(rows: readonly unknown[]): WorkbookPublicSource[] {
  return rows.map((row, index) => {
    const parsed = gdpWorkbookSourceRowSchema.parse(row);
    if (parsed.selected_year_max < parsed.selected_year_min) {
      throw new Error(`Invalid descending GDP selected year range at row ${index + 1}`);
    }
    const years = Array.from(
      { length: parsed.selected_year_max - parsed.selected_year_min + 1 },
      (_, offset) => parsed.selected_year_min + offset,
    );
    return {
      years,
      titleKa: titleByStandard[parsed.accounting_standard],
      organizationKa: "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)",
      downloadHref: parsed.retrieved_file_url as `https://${string}`,
      retrievedAt: parsed.retrieved_at,
    };
  });
}

const cache = new Map<MethodologyDatasetId, Promise<WorkbookPublicSource[]>>();
let gdpWorkbookSourcesPromise: Promise<WorkbookPublicSource[]> | undefined;

export function loadWorkbookSources(
  datasetId: MethodologyDatasetId,
  role: WorkbookSourceRole = datasetId === "revenue" ? "revenue" : datasetId === "municipalities" ? "municipal-functional" : "expenditure-fields",
): Promise<WorkbookPublicSource[]> {
  const cacheKey = `${datasetId}:${role}` as MethodologyDatasetId;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const pending = loadReviewedSourceManifest(repositoryRoot, datasetId)
    .then((rows) => projectWorkbookSources(roleRows(datasetId, rows, role)));
  cache.set(cacheKey, pending);
  return pending;
}

export function loadGdpWorkbookSources(): Promise<WorkbookPublicSource[]> {
  if (gdpWorkbookSourcesPromise) return gdpWorkbookSourcesPromise;

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const manifestPath = path.join(
    repositoryRoot,
    "docs",
    "Raw Data",
    "GDP",
    "national-nominal-gdp",
    "source-manifest.csv",
  );
  gdpWorkbookSourcesPromise = readFile(manifestPath, "utf8").then((csv) => projectGdpWorkbookSources(parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as unknown[]));
  return gdpWorkbookSourcesPromise;
}

export function resetWorkbookSourceCacheForTests(): void {
  cache.clear();
  gdpWorkbookSourcesPromise = undefined;
}
