import path from "node:path";
import type { InflationWorkbookSource } from "../explorer/inflationWorkbook";
import type { loadEnglishCatalogue } from "../i18n/catalogue.server";
import type { Locale } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import type { loadReviewedSourceManifest } from "../methodology/sourceManifest";

// Shared by the inflation hub and page modules. Each route has its own module, so
// a page ships only its own explorer: keep client components out of this file.

export const inflationRepositoryRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");

// Archive rows ending in "_ka" are the Georgian twins of the English source files.
export function inflationWorkbookSources(
  manifest: Awaited<ReturnType<typeof loadReviewedSourceManifest>>,
  locale: Locale,
  documents: Awaited<ReturnType<typeof loadEnglishCatalogue>>["documents"],
): InflationWorkbookSource[] {
  const projected = projectPublicSources(manifest, locale, documents);
  return manifest.map((row) => {
    const shown = projected.find((entry) => entry.source_id === row.source_id)!;
    return {
      sourceId: row.source_id.replace(/_ka$/, ""),
      language: row.source_id.endsWith("_ka") ? "ka" : "en",
      years: row.years,
      title: shown.title,
      organization: shown.publisher,
      downloadHref: row.downloadHref,
      retrievedAt: row.retrieved_at,
    };
  });
}
