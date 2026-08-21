import path from "node:path";
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

const cache = new Map<MethodologyDatasetId, Promise<WorkbookPublicSource[]>>();

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

export function resetWorkbookSourceCacheForTests(): void {
  cache.clear();
}
