// apps/web/lib/factQuery/buildSnapshot.ts
//
// The ONE file in lib/factQuery/ permitted to reach the served-data loaders.
// Everything else takes the finished snapshot as an argument. tests/factQuery/
// purity.test.ts excludes this file for exactly that reason.
import path from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { loadServedExplorerData, loadServedMunicipalData } from "../data/servedData";
import { loadTaxonomyFiles } from "../data/taxonomy";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { absoluteWorkbookSourceUrl } from "../explorer/workbookModel";
import { PROGRAM_SUCCESSIONS, findProgramSuccession } from "../data/adminSpending/programSuccessions";
import { LEGACY_PROGRAM_JOINS } from "../data/adminSpending/legacyProgramJoins";
import { makeProgramItemId } from "../data/adminSpending/generateAdminSpendingFacts";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { hashDataVersion } from "./canonical";
import { resolvePublicSources, type ManifestDocument } from "./sources";
import { SCHEMA_VERSION, type BudgetItemMeta, type FactQuerySnapshot, type ResolvedSource } from "./types";

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

type GdpManifestRow = {
  source_id: string;
  dataset_title: string;
  retrieved_file_url: string;
  local_file: string;
};

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

  const documents: ManifestDocument[] = perDataset.flat().map((row) => ({
    repositoryPath: row.repository_source_path,
    documentId: row.source_id,
    title: row.display_title_ka,
    officialUrl: null,
    archiveUrl: absoluteWorkbookSourceUrl(PUBLIC_SITE_ORIGIN, row.downloadHref),
  }));

  // GDP sources live in a separate manifest with its own schema (no
  // repository_source_path — `local_file` is relative to this manifest's own
  // directory) and are not one of LIVE_METHODOLOGY_IDS, so
  // loadReviewedSourceManifest cannot read them. loadGdpWorkbookSources
  // (workbookSources.ts) reads the same file but, like loadWorkbookSources,
  // projects source_id away — read it directly here to keep it.
  const gdpManifestPath = path.join(repositoryRoot, ...GDP_SOURCE_MANIFEST_RELATIVE_PATH, "source-manifest.csv");
  const gdpCsv = await readFile(gdpManifestPath, "utf8");
  const gdpRows = parse(gdpCsv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as GdpManifestRow[];

  for (const row of gdpRows) {
    if (!row.retrieved_file_url.startsWith("https://")) {
      throw new Error(
        `buildFactQuerySnapshot: GDP source manifest row "${row.source_id}" has a non-https retrieved_file_url`,
      );
    }
    documents.push({
      repositoryPath: [...GDP_SOURCE_MANIFEST_RELATIVE_PATH, row.local_file].join("/"),
      documentId: row.source_id,
      title: row.dataset_title,
      officialUrl: row.retrieved_file_url,
      archiveUrl: null,
    });
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
function loadManifestDocuments(): Promise<ManifestDocument[]> {
  manifestDocumentsPromise ??= loadManifestDocumentsUncached();
  return manifestDocumentsPromise;
}

/**
 * Item ids of the series that carry an approved historical join, from
 * PROGRAM_SUCCESSIONS and LEGACY_PROGRAM_JOINS (lib/data/adminSpending/). Both tables
 * key on `targetCode`, a tavi-VI program CODE — not an item id — and ServedAdminFact
 * (lib/servedRows.ts) exposes no officialCode to join back through. Resolving ids
 * therefore goes through makeProgramItemId, the exact function
 * generateAdminSpendingFacts.ts uses to assign these facts' itemId in the first place,
 * rather than string-building an id that could drift from it.
 *
 * PROGRAM_SUCCESSIONS entries resolve directly: single-step resolution (every entry
 * points at the end of a chain, never an intermediate segment) is a documented
 * invariant of that table. LEGACY_PROGRAM_JOINS entries can still chain into a further
 * succession — e.g. a 2006 join lands on code "35 02", which itself succeeds to
 * "27 02" for years 2006-2018 — so each join is re-checked against
 * findProgramSuccession for its own year before falling back to its own target,
 * mirroring generateAdminSpendingFacts.ts's programItemId exactly.
 */
function historicalJoinSeriesIds(): string[] {
  const ids = new Set<string>();

  for (const succession of PROGRAM_SUCCESSIONS) {
    ids.add(
      makeProgramItemId(succession.targetCode, succession.parentItemId, succession.targetEraKey ?? "default"),
    );
  }

  for (const join of LEGACY_PROGRAM_JOINS) {
    const succession = findProgramSuccession(join.targetCode, join.targetParentItemId, join.year);
    ids.add(
      succession
        ? makeProgramItemId(succession.targetCode, join.targetParentItemId, succession.targetEraKey ?? "default")
        : makeProgramItemId(join.targetCode, join.targetParentItemId, "default"),
    );
  }

  return [...ids].sort();
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

export async function buildFactQuerySnapshot(options: BuildSnapshotOptions): Promise<FactQuerySnapshot> {
  const [explorer, municipal, taxonomy, manifestDocuments] = await Promise.all([
    loadServedExplorerData(),
    loadServedMunicipalData(),
    loadTaxonomyFiles("../../data/taxonomy"),
    loadManifestDocuments(),
  ]);

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
    resolvePublicSources({ sourceDocuments: explorer.sourceDocuments, manifestDocuments }),
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
      historicalJoinSeriesIds: historicalJoinSeriesIds(),
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
