// apps/web/lib/factQuery/buildSnapshot.ts
//
// The ONE file in lib/factQuery/ permitted to reach the served-data loaders.
// Everything else takes the finished snapshot as an argument. tests/factQuery/
// purity.test.ts excludes this file for exactly that reason.
import path from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { serviceMessagesSchema, validateServiceMessages } from "../i18n/validation";
import type { EnglishCatalogue } from "../i18n/types";
import { SERVICE_MESSAGE_KEYS } from "./localization";
import { loadServedExplorerData, loadServedMunicipalData } from "../data/servedData";
import { loadTaxonomyFiles } from "../data/taxonomy";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { absoluteWorkbookSourceUrl } from "../explorer/workbookModel";
import { PROGRAM_SUCCESSIONS, findProgramSuccession } from "../data/adminSpending/programSuccessions";
import { LEGACY_PROGRAM_JOINS } from "../data/adminSpending/legacyProgramJoins";
import { makeProgramItemId } from "../data/adminSpending/generateAdminSpendingFacts";
import { loadGdpOverviewFacts, loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { GDP_QUERY_SERIES } from "./gdpSeries";
import { loadEconomicSectorFacts, ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { SECTOR_DEFINITIONS } from "./economicSectorsSeries";
import { loadRegionalEconomyFacts, REGIONAL_ECONOMY_REGIONS, REGIONAL_ECONOMY_SECTORS } from "../data/regionalEconomies/importRegionalEconomies";
import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import { REGIONAL_ECONOMY_DEFINITIONS } from "./regionalEconomySeries";
import { loadServedGeneralGovernmentBalanceData } from "../data/generalGovernmentBalance/importGeneralGovernmentBalance";
import { loadServedGovernmentDebtData } from "../data/governmentDebt/importGovernmentDebtFacts";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { hashDataVersion } from "./canonical";
import { resolvePublicSources, type ManifestDocument } from "./sources";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, DEBT_SERIES_LABELS_KA, DEFICIT_SERIES_ID, SCHEMA_VERSION, type BudgetItemMeta, type FactQuerySnapshot, type RawResolvedSource, type ResolvedSource, type ServiceLocalization } from "./types";

export type BuildSnapshotOptions = { releaseCommit: string; generatedAt: string };

// Fixed, environment-independent production origin for the absolute public
// URLs that go into `sources` (below). Deliberately NOT lib/siteUrl.ts's
// resolveSiteUrl(): that falls back to http://localhost:3000 whenever
// NEXT_PUBLIC_SITE_URL/VERCEL_PROJECT_PRODUCTION_URL are unset, which is true
// both for a local `npm test` and for CI's `checks` job (only the separate
// `e2e` job sets NEXT_PUBLIC_SITE_URL — see .github/workflows/ci.yml).
// `sources` is hash-significant content (§4.3 of the query-core spec: "an
// unchanged snapshot rebuilt later has the same dataVersion"), so an
// env-dependent origin would make dataVersion depend on where the build ran
// rather than what data it serves, and would silently produce a non-https
// archiveUrl exactly where "every link is https" most needs to hold.
// docs/deployment.md pins this exact string for NEXT_PUBLIC_SITE_URL in
// Production, so hardcoding it here matches the real deployed value.
const PUBLIC_SITE_ORIGIN = "https://fiscal.ge";

const GDP_SOURCE_MANIFEST_RELATIVE_PATH = ["docs", "Raw Data", "GDP", "national-nominal-gdp"] as const;

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
function isCleanHttpsUrl(value: string): boolean {
  if (!value.startsWith("https://")) return false;
  try {
    return value === new URL(value).href;
  } catch {
    return false;
  }
}

// Kept separate from workbookSources.ts's gdpWorkbookSourceRowSchema to use
// the tightened https check above in
// place of zod's `.url()`, so this path and the officialUrl guard just below
// cannot drift onto two different definitions of "a real URL". Not
// `.strict()`: like its sibling, this only names the columns it needs out of
// source-manifest.csv's wider set (publisher, role, sha256, bytes, ...).
/** An absent column and a present-but-blank cell both mean "no year here". */
const blankableYear = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().optional(),
);

/**
 * Resolves the coverage pair ATOMICALLY. Reading min and max through separate
 * `??` chains let a half-filled row take its min from selected_* and its max
 * from normalized_*, silently reporting a 30-year span across two different
 * column families.
 */
function yearRangeOf(row: {
  selected_year_min?: number;
  selected_year_max?: number;
  normalized_year_min?: number;
  normalized_year_max?: number;
  year_min?: number;
  year_max?: number;
  used_period_min?: number;
  used_period_max?: number;
}): { min: number; max: number } | null {
  if (row.selected_year_min !== undefined && row.selected_year_max !== undefined) {
    return { min: row.selected_year_min, max: row.selected_year_max };
  }
  if (row.normalized_year_min !== undefined && row.normalized_year_max !== undefined) {
    return { min: row.normalized_year_min, max: row.normalized_year_max };
  }
  if (row.year_min !== undefined && row.year_max !== undefined) {
    return { min: row.year_min, max: row.year_max };
  }
  // used_period_*, not source_period_*: the debt manifest records both, and the
  // years this repository actually took from a document are the ones a citation
  // should claim. A bulletin covering 2013-2030 that we read 2013-2016 from
  // must not advertise coverage it did not supply here.
  if (row.used_period_min !== undefined && row.used_period_max !== undefined) {
    return { min: row.used_period_min, max: row.used_period_max };
  }
  return null;
}
export const packageManifestRowSchema = z.object({
  source_id: z.string().trim().min(1),
  // Named `dataset_title` by the GDP and Geostat packages and `dataset` by the
  // IMF WEO one. Accept either; the refine below requires exactly one.
  dataset_title: z.string().trim().min(1).optional(),
  dataset: z.string().trim().min(1).optional(),
  publisher: z.string().trim().min(1),
  retrieved_file_url: z.string().refine(isCleanHttpsUrl, {
    message: "retrieved_file_url must be a clean https:// URL with no embedded whitespace or trailing text",
  }),
  retrieved_at: z.string().trim().min(1),
  local_file: z.string().trim().min(1),
  sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).transform((value) => value.toLowerCase()),
  bytes: z.coerce.number().int().nonnegative(),
  // The two package manifests name their coverage columns differently - GDP
  // uses selected_year_*, the Geostat package normalized_year_* - so accept
  // either and require exactly that one of the pairs is present, rather than
  // silently publishing a document with no coverage years.
  // csv-parse yields "" for a blank cell whose COLUMN exists, and
  // z.coerce.number() turns "" into 0 - so a blank coverage year parsed as
  // year 0, the refine below saw it as present, and a manifest carrying the
  // real range in the other column pair had that range thrown away.
  selected_year_min: blankableYear,
  selected_year_max: blankableYear,
  normalized_year_min: blankableYear,
  normalized_year_max: blankableYear,
  year_min: blankableYear,
  year_max: blankableYear,
  used_period_min: blankableYear,
  used_period_max: blankableYear,
}).refine(
  (row) => yearRangeOf(row) !== null,
  {
    message:
      "a package manifest row needs a complete selected_year_min/max, normalized_year_min/max, year_min/max or used_period_min/max pair",
  },
).refine((row) => (row.dataset_title ?? row.dataset) !== undefined, {
  message: "a package manifest row needs a dataset_title or a dataset",
});

/**
 * Manifests that share the package schema above: a `local_file` relative to
 * the manifest's own directory, and no repository_source_path. The GDP one was
 * always read here. The Geostat municipal population/regional-GDP package was
 * NOT, which is why source.geostat_municipal_population (64 rows) resolved to
 * no public document at all even though its manifest carries the real Geostat
 * URL and sha256 — spec section 8.1's gate could not be turned on until this
 * second directory was read too.
 */
const PACKAGE_MANIFEST_DIRECTORIES: readonly (readonly string[])[] = [
  GDP_SOURCE_MANIFEST_RELATIVE_PATH,
  ["docs", "Raw Data", "Municipalities", "geostat-population-regional-gdp"],
  // The IMF WEO workbook behind the general government balance. Registered in
  // data/sources/source-documents.csv by the deficit merge, so section 8.1's
  // provenance gate sees the source; without this directory it resolved to no
  // public document at all - the same failure the Geostat package had.
  ["docs", "Raw Data", "Deficit", "imf-weo-general-government-balance"],
  // The Ministry of Finance bulletins, strategies and reports behind the debt
  // dataset. Without this, every debt figure would ship with an empty
  // meta.sources - a number no reader could trace.
  ["docs", "Raw Data", "Debt", "government-debt-annual"],
];

function yearsBetween(first: number, last: number): number[] {
  if (last < first) return [];
  return Array.from({ length: last - first + 1 }, (_value, index) => first + index);
}

/**
 * Every public document the reviewed methodology manifests
 * (lib/methodology/sourceManifest.ts) and the GDP source manifest archived,
 * flattened across datasets and keyed by repository path so
 * resolvePublicSources (./sources.ts) can join them against
 * data/sources/source-documents.csv's `source_url_or_file` column. Not
 * role-filtered and not deduplicated by file hash — unlike
 * lib/methodology/workbookSources.ts's loadWorkbookSources /
 * loadGdpWorkbookSources, which do both (for a workbook footer's short
 * "sources used" list) and, doing so, drop the very source_id this join
 * needs. Reuses loadReviewedSourceManifest directly instead: same
 * validation (file exists, byte size, sha256, license), full row set.
 */
async function loadManifestDocumentsUncached(): Promise<ManifestDocument[]> {
  const repositoryRoot = path.resolve(process.cwd(), "../..");

  const perDataset = await Promise.all(
    (["expenditure", "revenue", "municipalities"] as const).map((datasetId) =>
      loadReviewedSourceManifest(repositoryRoot, datasetId),
    ),
  );

  // Geostat documents retain their existing package identities; World Bank originals are new.
  const gdpManifest = await loadReviewedSourceManifest(repositoryRoot, "gdp");
  perDataset.push(gdpManifest.filter(row => row.source_id.startsWith("source.wb_gdp_") && !row.source_id.endsWith("metadata")));
  const sectorManifest = await loadReviewedSourceManifest(repositoryRoot, "economic-sectors");
  perDataset.push(sectorManifest.filter(row => row.source_id.startsWith("source.geostat_sector_")));
  perDataset.push(await loadReviewedSourceManifest(repositoryRoot, "regional-economies"));
  // Inflation's registered sources are the English originals; the Georgian
  // twins (`_ka`) only prove identical values and are not registered sources.
  perDataset.push((await loadReviewedSourceManifest(repositoryRoot, "inflation")).filter(row => !row.source_id.endsWith("_ka")));

  // official_url_or_archive_url is free text, not a validated URL column
  // (sourceManifest.ts's schema only checks it's a non-empty string): most
  // rows hold prose like "Repository archive: docs/Raw Data/..." (an internal
  // path, never usable as a public link), but some genuinely hold the
  // original https:// URL (e.g. https://mof.ge/5039, matsne.gov.ge,
  // web.archive.org). Take it only when isCleanHttpsUrl confirms it's
  // exactly a URL and nothing else — confirmed by inspection to recover 81
  // of 180 rows across the three manifests — never when it's descriptive
  // text, and never a URL with descriptive text trailing after it.
  const documents: ManifestDocument[] = perDataset.flat().map((row) => ({
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
  }));

  // These sources live in package manifests with their own schema (a
  // `local_file` relative to the manifest's own directory, no
  // repository_source_path) and are not LIVE_METHODOLOGY_IDS, so
  // loadReviewedSourceManifest cannot read them. loadGdpWorkbookSources
  // (workbookSources.ts) reads the GDP one but, like loadWorkbookSources,
  // projects source_id away — read them directly here to keep it.
  for (const directory of PACKAGE_MANIFEST_DIRECTORIES) {
    const manifestPath = path.join(repositoryRoot, ...directory, "source-manifest.csv");
    const csv = await readFile(manifestPath, "utf8");
    const rawRows = parse(csv, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as unknown[];

    for (const [index, rawRow] of rawRows.entries()) {
      const parsed = packageManifestRowSchema.safeParse(rawRow);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
        throw new Error(`buildFactQuerySnapshot: invalid source manifest row ${index + 1} in ${directory.join("/")}: ${issues}`);
      }
      const row = parsed.data;
      if (
        directory.join("/") === "docs/Raw Data/Municipalities/geostat-population-regional-gdp" &&
        row.source_id === "geostat_regional_gdp_current_prices"
      ) {
        // The regional-economies methodology manifest publishes these exact
        // bytes under the registered source id used by the regional facts.
        // Keep the package row for validation, but do not emit a duplicate
        // public document identity for the same workbook.
        continue;
      }
      const archivedOriginal = gdpManifest.find((original) =>
        original.source_id === row.source_id && original.sha256 === row.sha256 && original.byte_size === row.bytes,
      );
      documents.push({
        repositoryPath: [...directory, row.local_file].join("/"),
        documentId: row.source_id,
        // Non-null: the second refine above rejects a row carrying neither.
        title: (row.dataset_title ?? row.dataset)!,
        publisher: row.publisher,
        officialUrl: row.retrieved_file_url,
        archiveUrl: archivedOriginal ? absoluteWorkbookSourceUrl(PUBLIC_SITE_ORIGIN, archivedOriginal.downloadHref) : null,
        // Non-null: the schema refine above rejects a row without a complete pair.
        years: yearsBetween(yearRangeOf(row)!.min, yearRangeOf(row)!.max),
        datasetId: null,
        sha256: row.sha256,
        byteSize: row.bytes,
        // The GDP and Geostat packages are workbooks; the debt package is mostly
        // PDF bulletins. Derived from the file rather than assumed, so a
        // citation does not describe a PDF as a spreadsheet.
        mediaType: row.local_file.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        retrievedAt: row.retrieved_at,
        // The package manifests carry no licence or attribution column;
        // reported as absent rather than filled with a guess.
        licenceId: null,
        attribution: null,
      });
    }
  }

  return documents;
}

// Memoized like loadServedExplorerData/loadServedMunicipalData below and
// lib/methodology/workbookSources.ts's own cache: loadReviewedSourceManifest
// re-reads and re-hashes every archived file with no caching of its own, and
// buildFactQuerySnapshot is called repeatedly within one test run (every
// tests/factQuery/*.test.ts case). Not reset-for-tests like servedData.ts's
// cache: nothing here depends on GEODATA_DATA_SOURCE or needs per-test
// isolation.
let manifestDocumentsPromise: Promise<ManifestDocument[]> | null = null;
export function loadManifestDocuments(): Promise<ManifestDocument[]> {
  manifestDocumentsPromise ??= loadManifestDocumentsUncached();
  return manifestDocumentsPromise;
}

/**
 * `${seriesId}:${year}` cells that a series serves THROUGH an approved historical join,
 * from PROGRAM_SUCCESSIONS and LEGACY_PROGRAM_JOINS (lib/data/adminSpending/). Both
 * tables key on `targetCode`, a tavi-VI program CODE — not an item id — and
 * ServedAdminFact (lib/servedRows.ts) exposes no officialCode to join back through.
 * Resolving ids therefore goes through makeProgramItemId, the exact function
 * generateAdminSpendingFacts.ts uses to assign these facts' itemId in the first place,
 * rather than string-building an id that could drift from it.
 *
 * Emitted per CELL rather than per series because a joined series is joined only for
 * SOME of its years. `admin_program.09_01.f5bec61a` serves 2006-2011 through the legacy
 * "09 02" common-courts lines and 2012-2025 natively from its own official code 09 01;
 * a bare series id made program_historical_join claim a join on all twenty years.
 * Both tables already carry the year grain this needs — a succession's
 * `startYear..endYear`, a legacy join's `year` — so nothing is inferred here.
 *
 * PROGRAM_SUCCESSIONS entries resolve directly: single-step resolution (every entry
 * points at the end of a chain, never an intermediate segment) is a documented
 * invariant of that table. LEGACY_PROGRAM_JOINS entries can still chain into a further
 * succession — e.g. a 2006 join lands on code "35 02", which itself succeeds to
 * "27 02" for years 2006-2018 — so each join is re-checked against
 * findProgramSuccession for its own year before falling back to its own target,
 * mirroring generateAdminSpendingFacts.ts's programItemId exactly.
 *
 * A succession's year range can name a year the source code did not actually carry
 * (56 01's 2018-2024 range covers years the payments institution ran under a different
 * code), and a legacy join's year can already be inside its target's succession range,
 * so the set is deduplicated. Today it yields 190 cells across 25 series — 50 from
 * LEGACY_PROGRAM_JOINS (9 series), 140 more from PROGRAM_SUCCESSIONS (20 series, four
 * of them also reached by a legacy join) — and every one of the 190 has a served
 * major_program fact, asserted in tests/factQuery/buildSnapshot.test.ts.
 */
function historicalJoinSeriesYears(): string[] {
  const cells = new Set<string>();

  for (const succession of PROGRAM_SUCCESSIONS) {
    const seriesId = makeProgramItemId(
      succession.targetCode,
      succession.parentItemId,
      succession.targetEraKey ?? "default",
    );
    for (let year = succession.startYear; year <= succession.endYear; year += 1) {
      cells.add(`${seriesId}:${year}`);
    }
  }

  for (const join of LEGACY_PROGRAM_JOINS) {
    const succession = findProgramSuccession(join.targetCode, join.targetParentItemId, join.year);
    const seriesId = succession
      ? makeProgramItemId(succession.targetCode, join.targetParentItemId, succession.targetEraKey ?? "default")
      : makeProgramItemId(join.targetCode, join.targetParentItemId, "default");
    cells.add(`${seriesId}:${join.year}`);
  }

  return [...cells].sort();
}

/**
 * Every array assigned into `content` (below) is hash-significant:
 * `canonicalize` (./canonical.ts) deliberately preserves array order, on the
 * documented assumption that "the served-data loaders already order rows and
 * that order is meaningful." That assumption does not hold across serving
 * modes: the CSV loaders return files in on-disk row order, the db mirror
 * (lib/db/mirrorRows.ts) returns Prisma `ORDER BY` order, and
 * lib/data/servedData.ts only guarantees year-ascending in between
 * (orderExplorerDataForServing, orderMunicipalDataForServing — that file says
 * outright "exact cross-path row order is not claimed here"). Left alone, a
 * CSV regeneration or taxonomy reorder can silently change `dataVersion`
 * between db-mode production and csv-mode previews/CI for identical data.
 *
 * This is the one file permitted to shape data before hashing, so every array
 * entering `content` is re-sorted here by the same keys the mirror's
 * `ORDER BY` uses (lib/db/mirrorRows.ts). Each key list corresponds to that
 * row's database unique constraint (prisma/schema.prisma), so the comparator
 * is total: two distinct rows in a clean dataset cannot tie on every key.
 */
function compareBy<T>(...keys: Array<(row: T) => string | number>): (a: T, b: T) => number {
  return (a, b) => {
    for (const key of keys) {
      const left = key(a);
      const right = key(b);
      if (left === right) continue;
      if (typeof left === "number" && typeof right === "number") return left - right;
      return String(left) < String(right) ? -1 : 1;
    }
    return 0;
  };
}

function sortedBy<T>(rows: T[], ...keys: Array<(row: T) => string | number>): T[] {
  return [...rows].sort(compareBy(...keys));
}

export function enrichSourceTranslations(sources: readonly RawResolvedSource[], catalogue: EnglishCatalogue, kaMessages: Readonly<Record<string, string>>): ResolvedSource[] {
  function kaText(original: string, key: string): string {
    if (Object.hasOwn(kaMessages, key) && kaMessages[key].trim()) return kaMessages[key];
    // Build-time validation only: an English original needs an explicitly authored
    // Georgian companion. Queries never inspect or infer a field's language.
    if (/\p{Script=Georgian}/u.test(original)) return original;
    throw new Error(`Missing reviewed Georgian source companion: ${key}`);
  }
  return sources.map(source => {
    const translation = catalogue.sources[source.sourceId];
    if (!translation || (source.derivation !== null && !translation.derivation)) throw new Error(`Missing reviewed source translation: ${source.sourceId}`);
    return {
      ...source,
      nameKa: kaText(source.name, `sources.${source.sourceId}.name`),
      nameEn: translation.name.text,
      derivationKa: source.derivation === null ? null : kaText(source.derivation, `sources.${source.sourceId}.derivation`),
      derivationEn: source.derivation === null ? null : translation.derivation!.text,
      documents: source.documents.map(document => {
        const translated = catalogue.documents[document.documentId];
        if (!translated || (document.attribution !== null && !translated.attribution)) throw new Error(`Missing reviewed document translation: ${document.documentId}`);
        return {
          ...document,
          titleKa: kaText(document.title, `documents.${document.documentId}.title`), titleEn: translated.title.text,
          publisherKa: kaText(document.publisher, `documents.${document.documentId}.publisher`), publisherEn: translated.publisher.text,
          attributionKa: document.attribution === null ? null : kaText(document.attribution, `documents.${document.documentId}.attribution`),
          attributionEn: document.attribution === null ? null : translated.attribution!.text,
          documentLanguage: translated.documentLanguage,
        };
      }),
    };
  });
}

export async function buildFactQuerySnapshot(options: BuildSnapshotOptions): Promise<FactQuerySnapshot> {
  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const [explorer, municipal, taxonomy, manifestDocuments, debt, deficit, catalogue, serviceKa, serviceEn] = await Promise.all([
    loadServedExplorerData(),
    loadServedMunicipalData(),
    loadTaxonomyFiles("../../data/taxonomy"),
    loadManifestDocuments(),
    loadServedGovernmentDebtData(),
    loadServedGeneralGovernmentBalanceData(),
    loadEnglishCatalogue(repositoryRoot),
    readFile(path.join(repositoryRoot, "data/localization/ka/service-messages.json"), "utf8").then(text => serviceMessagesSchema.parse(JSON.parse(text))),
    readFile(path.join(repositoryRoot, "data/localization/en/service-messages.json"), "utf8").then(text => serviceMessagesSchema.parse(JSON.parse(text))),
    loadServedGdpOverviewData(),
  ]);
  const messageErrors = validateServiceMessages(serviceKa, serviceEn);
  if (messageErrors.length) throw new Error(messageErrors.join("\n"));
  const labelIds = [...new Set([
    ...explorer.glossary.keys(), ...explorer.adminCategories.map(category => category.id),
    ...explorer.adminFacts.map(fact => fact.itemId),
    "expenditure.total", "revenue.total", "admin_spending.total", "municipal.total", "country.georgia",
    ...municipal.functions.map(item => item.id), ...municipal.regions.map(region => region.id),
    ...municipal.municipalities.map(entity => entity.code), ...AGGREGATE_ONLY_MUNICIPAL_CODES,
    ...Object.keys(DEBT_SERIES_LABELS_KA), DEFICIT_SERIES_ID, ...Object.keys(GDP_QUERY_SERIES), "gdp-overview",
    ...ECONOMIC_SECTORS.map(r=>r.id), "economic-sectors",
    ...REGIONAL_ECONOMY_REGIONS.map(region => region.id), REGIONAL_GDP_TOTAL, "regional-economies",
    "national-revenue", "national-expenditure", "ministries", "municipal-expenditure", "government-debt", "general-government-balance",
  ])].sort();
  const localization: ServiceLocalization = {
    labelsEn: Object.fromEntries(labelIds.map(id => {
      if (!catalogue.labels[id]) throw new Error(`Missing reviewed service label: ${id}`);
      return [id, catalogue.labels[id].text];
    })),
    programmeHistoryEn: {},
    messages: {
      ka: Object.fromEntries(SERVICE_MESSAGE_KEYS.map(key => [key, serviceKa[key]])),
      en: Object.fromEntries(SERVICE_MESSAGE_KEYS.map(key => [key, serviceEn[key]])),
    },
  };
  for (const fact of explorer.adminFacts.filter(fact => fact.level === "major_program")) {
    const translated = catalogue.programmeHistory[fact.itemId]?.[fact.year];
    if (!translated || translated.originalKa !== fact.officialLabelKa) throw new Error(`Missing or stale reviewed programme history: ${fact.itemId}:${fact.year}`);
    (localization.programmeHistoryEn[fact.itemId] ??= {})[fact.year] = translated.text;
  }

  // explorer.sourceDocuments' incoming order is not hash-safe either: the CSV
  // loader (lib/data/sources.ts) returns source-documents.csv's file row
  // order, while the db mirror (lib/db/mirrorRows.ts's
  // loadSourceDocumentsFromMirror) returns `ORDER BY id`. resolvePublicSources
  // (./sources.ts) is deliberately silent on order for exactly this reason —
  // both the outer array and each entry's nested `documents` are sorted here,
  // by sourceId and documentId respectively, both of which are unique (source
  // ids are asserted unique at load time; document ids come from the
  // manifests' own source_id, unique across all four manifests — verified by
  // inspection, not just assumed).
  const sources: ResolvedSource[] = sortedBy(
    enrichSourceTranslations(resolvePublicSources({ sourceDocuments: explorer.sourceDocuments, manifestDocuments }), catalogue, serviceKa),
    (source) => source.sourceId,
  ).map((source) => ({
    ...source,
    documents: sortedBy(source.documents, (document) => document.documentId),
  }));

  // GlossaryEntry (lib/data/glossary.ts) carries no sort/display-order column, so
  // sortOrder cannot come from the glossary itself — and it must NOT come from the
  // glossary Map's iteration order either: the CSV loader (lib/data/glossary.ts)
  // inserts in category-glossary.csv's row order, while the db loader
  // (lib/db/mirrorRows.ts's loadGlossaryFromMirror) inserts in `ORDER BY sortOrder,
  // id` order. Those are two different, independently-authored orderings of the same
  // ids, so a position-derived sortOrder would hash to a different dataVersion per
  // mode for identical data. TaxonomyItem.sortOrder (data/taxonomy/revenue-
  // categories.json + spending-fields.json) is the actual authored source of truth —
  // BudgetItem.sortOrder in the database is populated from these same files at
  // import time (scripts/import-budget-facts.ts) — so both modes agree by
  // construction. A glossary id with no taxonomy entry throws rather than silently
  // defaulting to 0, which would reintroduce a mode-independent-looking but wrong
  // value.
  const taxonomySortOrderById = new Map(taxonomy.map((item) => [item.id, item.sortOrder]));

  const items: BudgetItemMeta[] = Array.from(explorer.glossary.entries())
    .map(([id, entry]) => {
      const sortOrder = taxonomySortOrderById.get(id);
      if (sortOrder === undefined) {
        throw new Error(
          `buildFactQuerySnapshot: glossary id "${id}" has no taxonomy entry in data/taxonomy/revenue-categories.json or spending-fields.json`,
        );
      }

      return {
        id,
        side: id.startsWith("revenue.") ? ("revenue" as const) : ("expenditure" as const),
        kaLabel: entry.kaLabel,
        sortOrder,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const slugByCode = Object.fromEntries(MUNICIPALITY_ROUTES.map(({ code, slug }) => [code, slug]));

  const content = {
    schemaVersion: SCHEMA_VERSION,
    localization,
    national: {
      facts: sortedBy(
        explorer.facts,
        (f) => f.year,
        (f) => f.side,
        (f) => f.itemId,
        (f) => f.basis,
      ),
      items,
    },
    ministries: {
      facts: sortedBy(
        explorer.adminFacts,
        (f) => f.year,
        (f) => f.itemId,
      ),
      categories: sortedBy(
        explorer.adminCategories,
        (c) => c.sortOrder,
        (c) => c.id,
      ),
      historicalJoinSeriesYears: historicalJoinSeriesYears(),
    },
    municipal: {
      functions: sortedBy(
        municipal.functions,
        (f) => f.sortOrder,
        (f) => f.id,
      ),
      regions: sortedBy(
        municipal.regions,
        (r) => r.sortOrder,
        (r) => r.id,
      ),
      municipalities: sortedBy(
        municipal.municipalities,
        (m) => m.sortId,
        (m) => m.code,
      ),
      functionFacts: sortedBy(
        municipal.functionFacts,
        (f) => f.year,
        (f) => f.municipalityCode,
        (f) => f.categoryId,
      ),
      totalFacts: sortedBy(
        municipal.totalFacts,
        (f) => f.year,
        (f) => f.municipalityCode,
      ),
      // Served as MunicipalFunctionFact, whose only location field is
      // municipalityCode — but these rows come from MunicipalCountryFunctionFact,
      // whose mirror ORDER BY is scopeId (lib/db/mirrorRows.ts,
      // loadMunicipalCountryFunctionFactsFromMirror). That loader copies
      // row.scopeId into the served row's municipalityCode field, so
      // municipalityCode is where the mirror's scopeId ordering lands here.
      countryFunctionFacts: sortedBy(
        municipal.countryFunctionFacts,
        (f) => f.year,
        (f) => f.municipalityCode,
        (f) => f.categoryId,
      ),
      // Same scopeId -> municipalityCode translation as countryFunctionFacts above.
      countryTotalFacts: sortedBy(
        municipal.countryTotalFacts,
        (f) => f.year,
        (f) => f.municipalityCode,
      ),
      adjaraBudgetAdjustments: sortedBy(municipal.adjaraBudgetAdjustments, (a) => a.year),
      populationFacts: sortedBy(
        municipal.populationFacts,
        (f) => f.year,
        (f) => f.municipalityCode,
      ),
      slugByCode,
    },
    debt: {
      facts: sortedBy(
        debt.facts,
        (f) => f.year,
        (f) => f.seriesId,
      ),
    },
    deficit: { facts: sortedBy(deficit.facts, (f) => f.year) },
    gdpOverview: { facts: sortedBy(await loadGdpOverviewFacts(), f=>f.seriesId, f=>f.year), series: GDP_QUERY_SERIES },
    economicSectors: { facts: sortedBy(await loadEconomicSectorFacts(), f=>f.seriesId,f=>f.measure,f=>f.year), registry: ECONOMIC_SECTORS, definitions: SECTOR_DEFINITIONS },
    regionalEconomies: { facts: sortedBy(await loadRegionalEconomyFacts(), f=>f.regionId,f=>f.seriesId,f=>f.measure,f=>f.year), regions: REGIONAL_ECONOMY_REGIONS, registry: [{ id: REGIONAL_GDP_TOTAL, classificationCode: null, sortOrder: 0, officialName: "Total regional GDP", labelKa: "რეგიონის მთლიანი მშპ", labelEn: "Total regional GDP" }, ...REGIONAL_ECONOMY_SECTORS], definitions: REGIONAL_ECONOMY_DEFINITIONS },
    gdpFacts: sortedBy(explorer.gdpFacts, (f) => f.year),
    sources,
  };

  return {
    ...content,
    dataVersion: hashDataVersion(content),
    releaseCommit: options.releaseCommit,
    generatedAt: options.generatedAt,
  };
}
