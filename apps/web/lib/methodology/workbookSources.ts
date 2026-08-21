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

export function projectWorkbookSources(
  rows: readonly ValidatedSourceManifestRow[],
): WorkbookPublicSource[] {
  return rows.map((row) => ({
    years: row.years,
    titleKa: row.display_title_ka,
    organizationKa: row.source_organization,
    downloadHref: row.downloadHref,
    retrievedAt: row.retrieved_at,
  }));
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
): Promise<WorkbookPublicSource[]> {
  const existing = cache.get(datasetId);
  if (existing) return existing;

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const pending = loadReviewedSourceManifest(repositoryRoot, datasetId).then(projectWorkbookSources);
  cache.set(datasetId, pending);
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
