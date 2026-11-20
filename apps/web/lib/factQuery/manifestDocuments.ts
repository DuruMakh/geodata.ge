// apps/web/lib/factQuery/manifestDocuments.ts
//
// What a reviewed methodology source archive row (data/methodology/source-archives/<dataset>.csv, read by
// loadReviewedSourceManifest) publishes as a document: the snapshot build's one mapping, used for the core datasets'
// manifests and for the topic adapters' archives (topics/registry.ts) alike. No file access here; the callers read.
import { absoluteWorkbookSourceUrl } from "../explorer/workbookModel";
import type { ValidatedSourceManifestRow } from "../methodology/sourceManifest";
import type { ManifestDocument } from "./sources";

// Fixed, environment-independent production origin for the absolute public
// URLs that go into `sources` (below). Deliberately NOT lib/siteUrl.ts's
// resolveSiteUrl(): that falls back to http://localhost:3000 whenever
// NEXT_PUBLIC_SITE_URL/VERCEL_PROJECT_PRODUCTION_URL are unset, which is true
// both for a local `npm test` and for CI's `checks` job (only the separate
// `build` and `e2e` jobs set NEXT_PUBLIC_SITE_URL — see .github/workflows/ci.yml).
// `sources` is hash-significant content (§4.3 of the query-core spec: "an
// unchanged snapshot rebuilt later has the same dataVersion"), so an
// env-dependent origin would make dataVersion depend on where the build ran
// rather than what data it serves, and would silently produce a non-https
// archiveUrl exactly where "every link is https" most needs to hold.
// docs/deployment.md pins this exact string for NEXT_PUBLIC_SITE_URL in
// Production, so hardcoding it here matches the real deployed value.
export const PUBLIC_SITE_ORIGIN = "https://fiscal.ge";

/**
 * True only when `value` is an https:// URL and nothing else — no leading or
 * trailing whitespace, no trailing prose, nothing the URL parser would
 * silently rewrite. `startsWith("https://")` alone is not enough: a manifest
 * row holding "https://mof.ge/5039 Repository archive: docs/Raw Data/x.pdf"
 * (a real URL followed by internal-path prose — this project reviews
 * documents by appending exactly this kind of note) passes that check and
 * would publish the whole string, prose included, as a public URL. Nor does
 * zod's `.url()` catch it: `new URL(value)` does not throw on trailing
 * garbage, it silently percent-encodes it into the parsed URL, so `.url()`
 * alone accepts the same bad string. Requiring the value to already equal
 * its own parsed `.href` closes both gaps, because percent-encoding
 * anything makes that equality fail.
 *
 * Verified empirically, not just argued: run against every one of the 81
 * `official_url_or_archive_url` values across expenditure.csv/revenue.csv/
 * municipalities.csv that start with "https://", plus both GDP
 * `retrieved_file_url` values — all 83 pass unchanged, including
 * already-percent-encoded Georgian filenames (mof.ge), a matsne.gov.ge
 * download link, and a web.archive.org URL with a second https:// URL
 * embedded in its path. The invariant test in tests/factQuery/sources.test.ts
 * is the durable enforcement of this property: it re-checks every resolved
 * document on each run, so a future manifest row carrying prose fails there.
 */
export function isCleanHttpsUrl(value: string): boolean {
  if (!value.startsWith("https://")) return false;
  try {
    return value === new URL(value).href;
  } catch {
    return false;
  }
}

// official_url_or_archive_url is free text, not a validated URL column
// (sourceManifest.ts's schema only checks it's a non-empty string): most
// rows hold prose like "Repository archive: docs/Raw Data/..." (an internal
// path, never usable as a public link), but some genuinely hold the
// original https:// URL (e.g. https://mof.ge/5039, matsne.gov.ge,
// web.archive.org). Take it only when isCleanHttpsUrl confirms it's
// exactly a URL and nothing else — confirmed by inspection to recover 81
// of 180 rows across the three manifests — never when it's descriptive
// text, and never a URL with descriptive text trailing after it.
export function methodologyManifestDocument(row: ValidatedSourceManifestRow): ManifestDocument {
  return {
    repositoryPath: row.repository_source_path,
    documentId: row.source_id,
    title: row.display_title_ka,
    publisher: row.source_organization,
    officialUrl: isCleanHttpsUrl(row.official_url_or_archive_url) ? row.official_url_or_archive_url : null,
    archiveUrl: absoluteWorkbookSourceUrl(PUBLIC_SITE_ORIGIN, row.downloadHref),
    years: row.years,
    datasetId: row.dataset_id,
    sha256: row.sha256,
    byteSize: row.byte_size,
    mediaType: row.media_type,
    retrievedAt: row.retrieved_at,
    licenceId: row.license_id,
    attribution: row.attribution_text,
  };
}
