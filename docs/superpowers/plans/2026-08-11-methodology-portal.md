# Methodology Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved `/methodology` hub and three live dataset methodology pages, publish validated untouched upstream source archives, and add the approved footer/promotion discovery paths without changing explorer data behavior.

**Architecture:** Keep public methodology copy in a typed catalog with an explicit canonical-decision register, and keep source publication in reviewed CSV manifests under `data/methodology/`. A deterministic prebuild step validates source bytes, copies them unchanged into an ignored public-download tree, emits BOM CSV/JSON manifests and stable ZIPs, then static Next.js routes consume those validated summaries. Shared server components render the editorial hub/article/promotion/footer system; only archive filtering and analysis-side promotion targeting require client state.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.8, TypeScript strict mode, Tailwind v4, Zod 4, `csv-parse`, `fflate`, Node 24, Vitest 4, Playwright 1.60, static Vercel deployment.

## Global Constraints

- The approved product/visual contract is `docs/superpowers/specs/2026-08-11-methodology-portal-design.md`, Variant D (“Editorial Fieldbook”).
- Methodology never appears in the landing top header, explorer sidebar/top bar, or another top-level header navigation control.
- Live routes are exactly `/methodology`, `/methodology/expenditure`, `/methodology/revenue`, and `/methodology/municipalities`.
- Future inflation, GDP, population, and unemployment entries are plain non-clickable `მალე` content. They receive no route, anchor, canonical, sitemap entry, archive count, or coverage claim.
- Main public surfaces receive the substantial two-column pre-footer promotion. Explorer pages do not gain a global footer. Municipality/region detail pages receive only a compact contextual link beside the source note.
- The existing landing footer anatomy is extracted without redesign; the only added navigation item is `მეთოდოლოგია` linking to `/methodology`. Methodology pages reuse that same footer component.
- The downloadable archive contains untouched upstream originals only. Never publish `data/imports/**`, generated/normalized CSVs, extracted text sidecars, prepared municipality research outputs, or project-authored city-marker/geometry artifacts as raw originals.
- Initial original-file inventory is exact: 77 expenditure files (every file below `docs/Raw Data/Expenditure/`), 21 revenue PDFs (top-level `docs/Raw Data/Revenue/*.pdf` only), and 77 municipality files (six MoF functional workbooks, 69 MoF municipality-history workbooks, and the two top-level archived portal ZIPs).
- The initial inventory is 175 originals and 61,420,375 source bytes before manifests/ZIPs. Any different count or byte total must be explained by an intentional source addition/removal, not silently accepted.
- Municipality map provenance remains public prose and attribution. The prepared OSM/Natural Earth snapshots and `city-markers.json` are reviewed project inputs, not untouched provider downloads, so they are not archive rows.
- Population/regional-GDP research files remain outside the live municipality archive because that category is still a future marker.
- Municipality public copy explicitly names excluded codes `05`, `42`, `43`, `46`, and `64` and explains the territorial-attribution reason; the originals remain downloadable for provenance.
- Every published row carries an exact SHA-256, byte size, media type, source/archive location, attribution, licence identifier, redistribution status, and retrieval-date basis.
- When an exact historical retrieval date is absent, use the file’s first Git-add date as `retrieved_at`, set `retrieved_at_basis=repository_first_commit_proxy`, and disclose that proxy in the archive introduction/manifest notes. Never present it as an exact source retrieval date.
- Government-document rows use `license_id=official-public-document-no-explicit-license`, preserve MoF/Treasury attribution, and use `redistribution_status=repository_owner_approved`; ODbL/public-domain labels are used only where the corresponding untouched upstream bytes are actually published.
- The archive build accepts only `repository_owner_approved`, `approved_with_attribution`, or `public_domain`; missing/unreviewed/restricted status fails the build.
- Public download paths are stable lowercase ASCII and deterministic. Official filenames and source organization remain separate manifest fields and visible in the archive UI.
- ZIP entry order is public path ascending and every ZIP entry uses the fixed timestamp `1980-01-01T00:00:00Z`; source bytes are never recompressed through a document parser.
- `manifest.csv` starts with the UTF-8 BOM bytes `EF BB BF`; `manifest.json` is stable-key-order UTF-8 JSON with one trailing newline.
- Coverage ranges, source counts, source byte totals, latest retrieval dates, and last review dates are derived from served facts/manifests/content metadata. Do not type them into page JSX.
- Georgian is primary. Display headings use Noto Serif Georgian, UI text uses Noto Sans Georgian, and dates/counts/hashes/sizes use Geist Mono via the existing tokens.
- Use the warm paper/rule hierarchy. No gradients, shadows, new card system, night theme, or radius above 3px.
- Use native `details`/`summary`; future items are not disabled anchors; source rows are a real table in horizontal overflow.
- No structured-data/JSON-LD in the initial release. The spec says it is optional; metadata and sitemap coverage are sufficient and simpler.
- Do not change any existing methodology decision, data classification, source facts, CSV export behavior, database schema, authentication, API, or future-dataset surface.
- Before writing Next.js code, install dependencies and read the relevant local guides under `apps/web/node_modules/next/dist/docs/` as required by `apps/web/AGENTS.md`; follow Next 16 APIs, not remembered APIs.
- Implementation starts by creating/switching this worktree onto `codex/methodology-portal` at the approved plan commit. Do not implement on detached HEAD and do not push to `main`.

---

## File Structure

### Reviewed methodology data

- `data/methodology/decision-register.csv` — one reviewed row for every canonical methodological decision and the public decision entry that covers it.
- `data/methodology/source-archives/expenditure.csv` — reviewed publication metadata for the 77 expenditure originals.
- `data/methodology/source-archives/revenue.csv` — reviewed publication metadata for the 21 revenue originals.
- `data/methodology/source-archives/municipalities.csv` — reviewed publication metadata for the 77 municipality originals.
- `docs/data-methodology/public-methodology-and-source-archives.md` — maintenance, proxy-date, redistribution, deterministic-build, and byte-host rules.

### Catalog, content, and archive preparation

- `apps/web/lib/methodology/types.ts` — dataset IDs and the catalog/content/archive types shared across server and client boundaries.
- `apps/web/lib/methodology/catalog.ts` — live/future catalog, decision-register validation, served coverage derivation, and page-model builders.
- `apps/web/lib/methodology/content/expenditure.ts` — Georgian expenditure summary, sections, decisions, limitations, and canonical references.
- `apps/web/lib/methodology/content/revenue.ts` — Georgian revenue content.
- `apps/web/lib/methodology/content/municipalities.ts` — Georgian municipality content.
- `apps/web/lib/methodology/sourceInventory.ts` — the exact allowlisted original-source inventory rules; excludes derived/prepared files by construction.
- `apps/web/lib/methodology/sourceManifest.ts` — CSV schema/parser, path/hash/licence validation, archive summaries, and generated-manifest serialization.
- `apps/web/lib/methodology/prepareArchives.ts` — unchanged byte copying, BOM/JSON manifest emission, deterministic ZIP creation, validation report, and fixed-point helpers.
- `apps/web/scripts/prepare-methodology-archives.ts` — `--write`/`--check` CLI used by dev, build, validation, and CI.
- `apps/web/public/downloads/methodology/` — ignored generated tree; never edited or committed.
- `data/reports/methodology-archive-validation.json` — ignored latest validation/size report.

### Methodology UI and routes

- `apps/web/components/methodology/document-visuals.tsx` — shared open-document and stacked-source inline SVG/CSS compositions.
- `apps/web/components/methodology/methodology-hub.tsx` — hero, linked live rows, and non-interactive future index.
- `apps/web/components/methodology/methodology-article.tsx` — breadcrumb, facts, disclosure, contents, ordered sections, and archive placement.
- `apps/web/components/methodology/method-journey.tsx` — approved four-step source-to-data spine.
- `apps/web/components/methodology/decision-record.tsx` — grouped native disclosures and same-page technical appendix.
- `apps/web/components/methodology/source-archive.tsx` — client-side search/year filters, zero state, semantic table, and downloads.
- `apps/web/components/methodology/methodology-promo.tsx` — substantial context-aware end section.
- `apps/web/components/site/site-footer.tsx` — extracted existing footer plus one methodology link.
- `apps/web/app/methodology/layout.tsx` — paper shell shared only by methodology routes; no explorer sidebar and no new top-nav item.
- `apps/web/app/methodology/page.tsx` — hub metadata, derived index model, hub, and shared footer.
- `apps/web/app/methodology/[dataset]/page.tsx` — closed static live-category route, metadata, article, and shared footer.
- `apps/web/app/sitemap.ts` — add the hub and the three live category URLs only.

### Existing discovery surfaces

- `apps/web/components/landing/landing-page.tsx` — render substantial hub promotion and extracted footer.
- `apps/web/app/explorer/page.tsx` — render hub promotion; no footer.
- `apps/web/components/main-explorer/main-explorer.tsx` — render expenditure/revenue promotion and analysis-side-aware promotion.
- `apps/web/app/explorer/municipalities/page.tsx` — render municipality promotion after the index.
- `apps/web/components/municipalities/municipal-explorer.tsx` — compact municipality methodology link beside the detail source note.
- `apps/web/app/explorer/municipalities/[code]/page.tsx`, `apps/web/app/explorer/municipalities/region/[id]/page.tsx` — pass the compact methodology target.
- `apps/web/app/globals.css` — extend visible focus treatment to links and summaries; no visual-system rewrite.

### Tests

- `apps/web/tests/methodology/catalog.test.ts` — catalog states, decision traceability, section order, and derived coverage.
- `apps/web/tests/methodology/sourceInventory.test.ts` — exact 77/21/77 inclusion and prepared-file exclusion.
- `apps/web/tests/methodology/sourceManifest.test.ts` — schema/path/hash/licence/duplicate/retrieval validation and BOM serialization.
- `apps/web/tests/methodology/prepareArchives.test.ts` — unchanged copies, deterministic ZIP, manifest membership, and fixed-point generation.
- `apps/web/tests/browser/methodology.spec.ts` — routes, content, filters, disclosures, downloads, discovery links, metadata-adjacent navigation, keyboard focus, and mobile layout.
- Existing browser specs — retain current explorer/landing behavior and add only localized promotion/footer assertions where most legible.

---

### Task 1: Typed catalog and complete decision traceability

**Files:**
- Create: `apps/web/lib/methodology/types.ts`
- Create: `apps/web/lib/methodology/catalog.ts`
- Create: `apps/web/lib/methodology/content/expenditure.ts`
- Create: `apps/web/lib/methodology/content/revenue.ts`
- Create: `apps/web/lib/methodology/content/municipalities.ts`
- Create: `data/methodology/decision-register.csv`
- Create: `apps/web/tests/methodology/catalog.test.ts`

**Interfaces:**
- Produces: `LIVE_METHODOLOGY_IDS`, `MethodologyDatasetId`, `METHODOLOGY_CONTENT`, `FUTURE_METHODOLOGY_DATASETS`, `validateDecisionCoverage()`, `deriveMethodologyCoverage()`, and `buildMethodologyHubEntries()`.
- Consumes later: route generation, page metadata, `MethodologyHub`, `MethodologyArticle`, and sitemap.

- [ ] **Step 1: Create the implementation branch and install the locked dependency tree**

From the repository root:

```powershell
git switch -c codex/methodology-portal
cd apps/web
npm.cmd ci
```

Then locate and read the local Next.js App Router guides for static dynamic routes, `generateMetadata`, `generateStaticParams`, and metadata files before writing route code. Expected: the branch points at the approved plan/spec commits and `npm.cmd ci` completes without changing the lockfile.

- [ ] **Step 2: Write failing catalog/traceability tests**

Start with these invariants:

```ts
import { describe, expect, it } from "vitest";
import {
  FUTURE_METHODOLOGY_DATASETS,
  LIVE_METHODOLOGY_IDS,
  METHODOLOGY_CONTENT,
  deriveMethodologyCoverage,
  validateDecisionCoverage,
} from "../../lib/methodology/catalog";

it("exposes only the three approved live datasets", () => {
  expect(LIVE_METHODOLOGY_IDS).toEqual(["expenditure", "revenue", "municipalities"]);
  expect(Object.keys(METHODOLOGY_CONTENT)).toEqual(LIVE_METHODOLOGY_IDS);
  expect(FUTURE_METHODOLOGY_DATASETS.every((entry) => entry.href === null)).toBe(true);
});

it("keeps the approved layered section order", () => {
  for (const content of Object.values(METHODOLOGY_CONTENT)) {
    expect(content.sections.map((section) => section.kind)).toEqual([
      "scope",
      "sources",
      "journey",
      "decisions",
      "classification",
      "validation",
      "limitations",
      "archive",
    ]);
  }
});

it("covers every canonical decision exactly through a public entry", async () => {
  const result = await validateDecisionCoverage();
  expect(result).toEqual({ canonicalDecisionCount: result.publicMappingCount, uncovered: [], unknownPublicIds: [] });
});

it("derives coverage instead of storing it in page copy", () => {
  expect(deriveMethodologyCoverage("expenditure", budgetFacts, municipalFacts)).toEqual({ firstYear: 2005, lastYear: 2025 });
  expect(deriveMethodologyCoverage("municipalities", budgetFacts, municipalFacts)).toEqual({ firstYear: 2015, lastYear: 2025 });
});
```

- [ ] **Step 3: Run the catalog test and verify it fails**

```powershell
npm.cmd test -- tests/methodology/catalog.test.ts
```

Expected: FAIL because the methodology catalog and decision register do not exist.

- [ ] **Step 4: Add the shared types and fixed live/future IDs**

Use these boundaries in `types.ts`:

```ts
export const LIVE_METHODOLOGY_IDS = ["expenditure", "revenue", "municipalities"] as const;
export type MethodologyDatasetId = (typeof LIVE_METHODOLOGY_IDS)[number];
export type MethodologySectionKind =
  | "scope" | "sources" | "journey" | "decisions"
  | "classification" | "validation" | "limitations" | "archive";

export type MethodologyDecision = {
  id: string;
  groupKa: string;
  titleKa: string;
  statusKa: "ოფიციალური ფაქტი" | "GeoData-ის გადაწყვეტილება" | "შეზღუდვა";
  summaryKa: string;
  detailKa: readonly string[];
  canonicalDecisionIds: readonly string[];
};

export type MethodologyContent = {
  id: MethodologyDatasetId;
  slug: MethodologyDatasetId;
  titleKa: string;
  summaryKa: string;
  reviewedAt: string;
  archiveManifestId: MethodologyDatasetId;
  canonicalDocuments: readonly string[];
  disclosureKa: string;
  keyFacts: readonly { labelKa: string; valueKind: "coverage" | "frequency" | "basis" | "unit"; valueKa?: string }[];
  sections: readonly { id: string; kind: MethodologySectionKind; titleKa: string; paragraphsKa: readonly string[] }[];
  decisions: readonly MethodologyDecision[];
  technicalAppendix: readonly MethodologyDecision[];
};
```

Future items are exactly `ინფლაცია`, `მშპ`, `მოსახლეობა`, and `უმუშევრობა`, each with `href: null` and `state: "future"`.

- [ ] **Step 5: Curate the three content modules and decision register**

Write complete Georgian public prose; do not copy operational commands. The public decision IDs must cover, at minimum, these reviewed choices:

```text
expenditure.scope.2004_excluded
expenditure.basis.actual_payments
expenditure.precedence.actual_over_planned
expenditure.disclosure.official_totals_geodata_categories
expenditure.mapping.cofog
expenditure.mapping.old_14_group
expenditure.mapping.supplement_exact_then_keyword
expenditure.mapping.unclassified_never_dropped
expenditure.decision.2009_tax_arrears
expenditure.decision.2012_disaster_fund
expenditure.decision.donor_coordination
expenditure.decision.2008_financial_aggregates
expenditure.decision.2011_arrears_court_fund
expenditure.decision.2014_2016_residual_review
expenditure.decision.2008_2011_residual_review
expenditure.admin.idp_health_social
expenditure.admin.environment_agriculture
expenditure.admin.sport_culture_demerger
expenditure.admin.penitentiary_justice
expenditure.admin.youth_education
expenditure.admin.finance_three_way_split
expenditure.admin.culture_sport_split
expenditure.admin.debt_service
expenditure.admin.other_costs
expenditure.program.threshold_100m_modern
expenditure.program.modern_presence
expenditure.program.semantic_eras
expenditure.program.successions
expenditure.program.perimeter_changes_not_joined
expenditure.program.legacy_joins
expenditure.program.names_only
expenditure.validation.annual_reconciliation

revenue.scope.consolidated
revenue.scope.2004_excluded
revenue.source.form1
revenue.source.four_code_eras
revenue.basis.actual
revenue.precedence.actual_over_planned
revenue.negative_values_allowed
revenue.mapping.net_internal_grants
revenue.mapping.net_internal_other_revenue
revenue.mapping.combined_asset_decrease
revenue.mapping.opening_balance_excluded
revenue.mapping.other_taxes_2019_2025
revenue.mapping.other_taxes_2008_2018
revenue.mapping.other_taxes_2005_2007
revenue.validation.strict_presence
revenue.crosscheck.workbook_2023_2025
revenue.validation.receipts_identity_10_gel
revenue.limitation.perimeter_asymmetry
revenue.limitation.workbook_advisory
revenue.limitation.legacy_hash_gap

municipalities.scope.2015_2025
municipalities.scope.64_municipalities_11_regions
municipalities.scope.ten_main_functions
municipalities.scope.selected_details_not_served
municipalities.mapping.stable_function_ids
municipalities.mapping.reviewed_region_crosswalk
municipalities.exclusion.five_codes
municipalities.exclusion.abkhazia_region
municipalities.source.2015_2019_portal
municipalities.source.2020_2025_workbooks
municipalities.total.2015_functional_fallback
municipalities.total.2016_2025_official_payments
municipalities.total.khulo_2024_fallback
municipalities.total.functional_vs_public
municipalities.share.not_normalized
municipalities.share.no_forced_residual
municipalities.geometry.osm_odbl
municipalities.geometry.natural_earth_public_domain
municipalities.population.not_imported
municipalities.exclusion.autonomous_budgets
municipalities.encoding.excel_bom
municipalities.validation.coverage_reconciliation
municipalities.limitation.source_transition
```

`decision-register.csv` columns are:

```text
canonical_decision_id,dataset_id,canonical_document,canonical_heading,public_decision_id,classification,reviewed_at
```

Every ID above has at least one register row. Split a canonical heading into multiple rows when it contains multiple independent choices; multiple canonical rows may map to one public decision. `validateDecisionCoverage()` must reject duplicate canonical IDs, missing canonical files/headings, unknown public IDs, dataset mismatches, and uncovered rows.

- [ ] **Step 6: Derive coverage and hub entries from served facts/archive summaries**

Implement pure builders; do not import page components:

```ts
export function deriveMethodologyCoverage(
  id: MethodologyDatasetId,
  budgetFacts: readonly ServedBudgetFact[],
  municipalFacts: readonly MunicipalTotalFact[],
): { firstYear: number; lastYear: number };

export function buildMethodologyHubEntries(input: {
  budgetFacts: readonly ServedBudgetFact[];
  municipalFacts: readonly MunicipalTotalFact[];
  archives: Readonly<Record<MethodologyDatasetId, MethodologyArchiveSummary>>;
}): MethodologyHubEntry[];
```

Throw if a live dataset has no served years or no validated archive; future entries never reach these functions.

- [ ] **Step 7: Run tests and commit**

```powershell
npm.cmd test -- tests/methodology/catalog.test.ts
git add lib/methodology ../../data/methodology/decision-register.csv tests/methodology/catalog.test.ts
git commit -m "feat(methodology): add traced public methodology catalog"
```

Expected: PASS with zero uncovered decisions and only three live IDs.

---

### Task 2: Original-source inventory, manifest validation, and deterministic archives

**Files:**
- Create: `apps/web/lib/methodology/sourceInventory.ts`
- Create: `apps/web/lib/methodology/sourceManifest.ts`
- Create: `apps/web/lib/methodology/prepareArchives.ts`
- Create: `apps/web/scripts/prepare-methodology-archives.ts`
- Create: `apps/web/tests/methodology/sourceInventory.test.ts`
- Create: `apps/web/tests/methodology/sourceManifest.test.ts`
- Create: `apps/web/tests/methodology/prepareArchives.test.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `expectedOriginalSourcePaths()`, `loadReviewedSourceManifest()`, `validateSourceManifest()`, `prepareMethodologyArchives()`, `loadGeneratedArchiveSummaries()`, and the preparation CLI.
- Consumes later: catalog/page loaders and build/data-validation scripts.

- [ ] **Step 1: Add failing inventory and manifest tests**

Assert the exact original boundary:

```ts
it("includes every approved original and no prepared derivative", async () => {
  const inventory = await expectedOriginalSourcePaths(REPOSITORY_ROOT);
  expect(inventory.expenditure).toHaveLength(77);
  expect(inventory.revenue).toHaveLength(21);
  expect(inventory.municipalities).toHaveLength(77);
  expect(inventory.expenditure.reduce(sumBytes, 0)).toBe(53_661_484);
  expect(inventory.revenue.reduce(sumBytes, 0)).toBe(4_667_365);
  expect(inventory.municipalities.reduce(sumBytes, 0)).toBe(3_091_526);
  expect(inventory.revenue.some((row) => row.path.includes("/text/"))).toBe(false);
  expect(inventory.municipalities.some((row) => row.path.includes("combined-annual"))).toBe(false);
  expect(inventory.municipalities.some((row) => row.path.includes("geostat-population"))).toBe(false);
  expect(inventory.municipalities.some((row) => row.path.includes("municipality-map-geometry"))).toBe(false);
});
```

Create table-driven failure tests for `../` traversal, absolute paths, symlinks/out-of-root resolution, missing files, duplicate IDs, duplicate public paths, invalid dataset IDs, mismatched byte sizes/hashes, blank attribution, disallowed redistribution status, missing proxy basis, and public paths outside `downloads/methodology/<dataset>/files/`.

- [ ] **Step 2: Run focused tests and verify they fail**

```powershell
npm.cmd test -- tests/methodology/sourceInventory.test.ts tests/methodology/sourceManifest.test.ts tests/methodology/prepareArchives.test.ts
```

Expected: FAIL because no inventory, parser, or archive generator exists.

- [ ] **Step 3: Implement the exact original inventory allowlist**

Use filesystem enumeration only inside these boundaries:

```ts
const inventoryRules = {
  expenditure: [{ root: "docs/Raw Data/Expenditure", include: () => true }],
  revenue: [{ root: "docs/Raw Data/Revenue", include: (path: string) => path.endsWith(".pdf") && dirname(path).endsWith("Revenue") }],
  municipalities: [
    { root: "docs/Raw Data/Municipalities/mof-functional-classification", include: extension(".xlsx") },
    { root: "docs/Raw Data/Municipalities/mof-municipality-budget-history-2016-2025", include: extension(".xlsx") },
    { root: "docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022", include: topLevelExtension(".zip") },
  ],
} satisfies Record<MethodologyDatasetId, readonly InventoryRule[]>;
```

Return repository-relative forward-slash paths and byte sizes sorted lexicographically. Reject symlinks rather than following them.

- [ ] **Step 4: Define and validate the reviewed manifest schema**

Add the spec’s fields plus an honest date-basis field:

```ts
export type ReviewedSourceManifestRow = {
  source_id: string;
  dataset_id: MethodologyDatasetId;
  year: string;
  source_organization: string;
  display_title_ka: string;
  official_filename: string;
  official_url_or_archive_url: string;
  repository_source_path: string;
  public_download_path: string;
  media_type: string;
  byte_size: number;
  sha256: string;
  retrieved_at: string;
  retrieved_at_basis: "exact" | "source_manifest" | "repository_first_commit_proxy";
  license_id: string;
  attribution_text: string;
  redistribution_status: "repository_owner_approved" | "approved_with_attribution" | "public_domain";
  notes: string;
};
```

Parse with `csv-parse/sync`, validate with Zod, normalize SHA to lowercase, expand year/ranges to `years: number[]`, and sort rows newest maximum year first then `source_id`. The validated public row type includes deterministic `downloadHref` but never exposes repository paths as links.

- [ ] **Step 5: Add deterministic ZIP support and the archive generator**

Add `fflate` as a production dependency because the prebuild runs in the deployment build environment:

```powershell
npm.cmd install fflate@^0.8.2
```

Implement:

```ts
export async function prepareMethodologyArchives(options: {
  repositoryRoot: string;
  publicRoot: string;
  reportPath: string;
  mode: "write" | "check";
}): Promise<Record<MethodologyDatasetId, MethodologyArchiveSummary>>;
```

For each dataset: validate manifest coverage equals `expectedOriginalSourcePaths()`, hash every original, copy with `copyFile`, re-hash the copy, write stable `manifest.json`, write BOM `manifest.csv`, and create `<dataset>-original-sources.zip` from sorted originals plus both manifests. Set every ZIP member’s mtime to `1980-01-01T00:00:00Z`; use the same compression level for every run. The report contains source count/bytes, generated bytes, formats, min/max year, latest retrieval date, proxy-date count, licence/status counts, every output SHA, and `status: "PASS"`.

`check` generates twice under two fresh OS temp directories and compares relative paths, byte sizes, and SHA-256 values. It does not mutate `apps/web/public`.

- [ ] **Step 6: Add exact ZIP/fixed-point tests**

Use three small temp fixtures and assert:

```ts
expect(await sha256(publishedFile)).toBe(await sha256(sourceFile));
expect(readFileSync(manifestCsv).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
expect(zipEntries.map((entry) => entry.name)).toEqual([
  "files/2005/source-a.pdf",
  "files/2006/source-b.xlsx",
  "manifest.csv",
  "manifest.json",
]);
expect(firstRun.outputHashes).toEqual(secondRun.outputHashes);
```

Also assert the ZIP original set equals the individual published set and contains no validation report or ZIP-within-ZIP beyond source ZIP files that are themselves reviewed originals.

- [ ] **Step 7: Wire scripts and ignored artifacts**

Add:

```json
{
  "scripts": {
    "predev": "npm run data:prepare-methodology-archives",
    "prebuild": "npm run data:prepare-methodology-archives",
    "data:prepare-methodology-archives": "tsx scripts/prepare-methodology-archives.ts --write",
    "data:check-methodology-archives": "tsx scripts/prepare-methodology-archives.ts --check"
  }
}
```

Ignore only `apps/web/public/downloads/methodology/`; do not ignore all of `public/`.

- [ ] **Step 8: Run tests and commit**

```powershell
npm.cmd test -- tests/methodology/sourceInventory.test.ts tests/methodology/sourceManifest.test.ts tests/methodology/prepareArchives.test.ts
git add ../../.gitignore package.json package-lock.json lib/methodology/sourceInventory.ts lib/methodology/sourceManifest.ts lib/methodology/prepareArchives.ts scripts/prepare-methodology-archives.ts tests/methodology
git commit -m "feat(methodology): validate deterministic source archives"
```

Expected: PASS for fixture archives and the real inventory boundary; real reviewed manifests are intentionally added in Task 3.

---

### Task 3: Reviewed manifests, real archive generation, and deployment-size gate

**Files:**
- Create: `data/methodology/source-archives/expenditure.csv`
- Create: `data/methodology/source-archives/revenue.csv`
- Create: `data/methodology/source-archives/municipalities.csv`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/package.json`
- Test: `apps/web/tests/methodology/sourceInventory.test.ts`
- Generated/ignored: `apps/web/public/downloads/methodology/**`
- Generated/ignored: `data/reports/methodology-archive-validation.json`

**Interfaces:**
- Consumes: exact source inventory and generator from Task 2.
- Produces: validated real archive summaries and generated static download bytes used by the routes.

- [ ] **Step 1: Extend the real-inventory test to require one reviewed manifest row per original**

```ts
for (const datasetId of LIVE_METHODOLOGY_IDS) {
  const expected = await expectedOriginalSourcePaths(REPOSITORY_ROOT, datasetId);
  const manifest = await loadReviewedSourceManifest(REPOSITORY_ROOT, datasetId);
  expect(manifest.map((row) => row.repository_source_path).toSorted()).toEqual(expected.map((row) => row.path));
}
```

Expected counts are 77, 21, and 77; no prepared file can be substituted for an original.

- [ ] **Step 2: Run the real-manifest test and verify it fails**

```powershell
npm.cmd test -- tests/methodology/sourceInventory.test.ts
```

Expected: FAIL because the three reviewed manifests do not exist.

- [ ] **Step 3: Add the three reviewed manifests with complete metadata**

Create one row per exact inventory path. Use existing exact URLs/retrieval dates from `data/sources/source-documents.csv` and the municipality source manifests when present. For legacy files without exact dates, obtain the proxy without changing the source file:

```powershell
git log --diff-filter=A --follow --format=%as -- "docs/Raw Data/<path>" | Select-Object -Last 1
```

Use ASCII stable IDs and public paths such as:

```csv
source.mof.expenditure.2005.treasury_e11,expenditure,2005,საქართველოს სახელმწიფო ხაზინა,2005 წლის სახელმწიფო ბიუჯეტის ფუნქციური შესრულება,2005-12-month-state-budget-functional-expenditure.pdf,Repository archive: docs/Raw Data/Expenditure/treasury.ge/2005-12-month-state-budget-functional-expenditure.pdf,docs/Raw Data/Expenditure/treasury.ge/2005-12-month-state-budget-functional-expenditure.pdf,downloads/methodology/expenditure/files/2005/treasury-e11.pdf,application/pdf,54972,bfc38acbd91515a224ac9148635537c163662d4bb36e2ad28c963d33fa4f9622,2026-06-30,repository_first_commit_proxy,official-public-document-no-explicit-license,საქართველოს სახელმწიფო ხაზინა,repository_owner_approved,Retrieval date is the repository capture proxy.
```

Rules for all rows:

- `year` is a single year or an inclusive `YYYY-YYYY` range;
- `official_filename` is the exact stored upstream filename;
- `official_url_or_archive_url` uses an exact source URL when recorded, otherwise the explicit `Repository archive: <path>` form;
- hashes/sizes are computed from current committed bytes;
- government rows preserve MoF/Treasury attribution and the owner-approved no-explicit-license status;
- duplicate upstream files in different official source families remain separate rows/public paths if their repository paths are separately preserved;
- the two municipal ZIPs remain ZIP originals; their extracted CSV children are not separately published;
- all five excluded municipality-body workbooks remain in the raw archive because they support the exclusion decision, even though they are not served facts.

- [ ] **Step 4: Generate the real archive twice and inspect the validation report**

```powershell
npm.cmd run data:prepare-methodology-archives
npm.cmd run data:check-methodology-archives
```

Expected: both commands exit 0; the report says `PASS`, 175 originals, 61,420,375 original bytes, all hashes match, and each dataset ZIP reaches a deterministic fixed point.

- [ ] **Step 5: Perform the early deployment-size check required by the spec**

Record from the generated report:

- individual original bytes and largest individual file;
- each ZIP byte size;
- full generated tree bytes and file count;
- source-upload and file-count impact against the current [Vercel limits](https://vercel.com/docs/limits) (currently 100 MB Hobby/1 GB Pro static source upload and 15,000 source files; build-generated output still requires a real preview-deployment check);
- build duration and final static-asset count.

Then run:

```powershell
npm.cmd run build
```

Expected: the generated archive stays within the current deployment path and the static build passes. The known originals are about 58.6 MiB before ZIP copies, the largest original is about 5.46 MiB, and there are only 175 original rows, so any major deviation indicates accidental inclusion of prepared outputs. If the actual preview deployment later rejects the output, keep the same manifest/public URLs and move only byte storage behind a deterministic host adapter; do not shrink the archive product silently.

- [ ] **Step 6: Include archive validation in the standard data gate**

At the end of `scripts/validate-data-files.ts`, invoke the check-mode validator and fail on any non-PASS result. Alternatively chain the exact script without weakening current validation:

```json
"data:validate": "tsx scripts/validate-data-files.ts && npm run data:check-methodology-archives"
```

Do not call `--write` from the validation gate; validation stays non-mutating.

- [ ] **Step 7: Run focused and standard data gates, then commit only reviewed inputs/code**

```powershell
npm.cmd test -- tests/methodology/sourceInventory.test.ts tests/methodology/sourceManifest.test.ts tests/methodology/prepareArchives.test.ts
npm.cmd run data:validate
git status --short
git add ../../data/methodology/source-archives package.json scripts/validate-data-files.ts tests/methodology/sourceInventory.test.ts
git commit -m "data(methodology): publish reviewed original-source manifests"
```

Expected: generated `public/downloads/methodology/**` and report files remain ignored; only reviewed manifests and validation wiring are committed.

---

### Task 4: Shared editorial components, methodology hub, and existing footer extraction

**Files:**
- Create: `apps/web/components/methodology/document-visuals.tsx`
- Create: `apps/web/components/methodology/methodology-hub.tsx`
- Create: `apps/web/components/methodology/methodology-promo.tsx`
- Create: `apps/web/components/site/site-footer.tsx`
- Create: `apps/web/app/methodology/layout.tsx`
- Create: `apps/web/app/methodology/page.tsx`
- Modify: `apps/web/components/landing/landing-page.tsx`
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/tests/browser/methodology.spec.ts`
- Modify: `apps/web/tests/browser/landing.spec.ts`

**Interfaces:**
- Consumes: `buildMethodologyHubEntries()` and validated archive summaries.
- Produces: `MethodologyHub`, `MethodologyPromo`, `SiteFooter`, `/methodology`, and reusable document visuals.

- [ ] **Step 1: Add failing browser coverage for the hub and footer boundary**

```ts
test("methodology hub separates live datasets from future markers", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("მეთოდოლოგია და პირველწყაროები");
  await expect(page.getByTestId("methodology-live-row")).toHaveCount(3);
  await expect(page.getByTestId("methodology-future-row")).toHaveCount(4);
  await expect(page.getByTestId("methodology-future-row").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/2005–2025/);
  await expect(page.getByTestId("methodology-live-row").first()).toContainText(/77/);
});

test("methodology is in the footer but never the landing header", async ({ page }) => {
  await page.goto("http://localhost:3100/");
  await expect(page.getByTestId("landing-header").getByRole("link", { name: "მეთოდოლოგია" })).toHaveCount(0);
  await expect(page.getByTestId("site-footer").getByRole("link", { name: "მეთოდოლოგია" })).toHaveAttribute("href", "/methodology");
  await expect(page.getByTestId("methodology-promo")).toBeVisible();
});
```

- [ ] **Step 2: Run the tests and verify routes/components are missing**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts tests/browser/landing.spec.ts --grep "methodology hub|footer but never"
```

Expected: FAIL because `/methodology`, the shared footer, and promotion do not exist.

- [ ] **Step 3: Extract the existing footer without redesigning it**

Move the current footer JSX verbatim into:

```tsx
export function SiteFooter({ updatedAt }: { updatedAt: string }) { /* existing anatomy */ }
```

Keep current GeoData/contact/source/licence/copyright copy and classes. Add only:

```tsx
<Link href="/methodology" className="text-[12.5px] text-[var(--body)] hover:text-[var(--ink)]">
  მეთოდოლოგია
</Link>
```

Render `<SiteFooter updatedAt={model.updatedAt} />` from the landing component. Preserve `data-testid="landing-footer"` for existing tests and add `data-testid="site-footer"` on the shared element.

- [ ] **Step 4: Build the Variant D document visuals and hub**

`OpenDocumentVisual` carries visible text/labels `SOURCE → METHOD → CHECK → DATA`; `SourceDocumentStack` draws three overlapping ruled pages. Use inline SVG/CSS with `currentColor`, `var(--accent)`, `var(--hairline)`, and `var(--tint)` only; mark explanatory graphics with a concise Georgian accessible name and purely decorative subparts `aria-hidden`.

`MethodologyHub` renders:

```tsx
<main data-testid="methodology-hub">
  <section>{/* overline, H1, trust statement, jump link, open document */}</section>
  <section id="datasets" aria-labelledby="datasets-title">
    {liveEntries.map((entry) => <Link data-testid="methodology-live-row" href={entry.href}>...</Link>)}
  </section>
  <section aria-labelledby="future-title">
    {futureEntries.map((entry) => <div data-testid="methodology-future-row">...<ComingSoonBadge /></div>)}
  </section>
</main>
```

Live rows show only title, one-line scope, derived coverage, manifest file count, content review date, and arrow. There are no nested anchors. Future rows have no pointer/hover/focus classes.

- [ ] **Step 5: Implement the substantial promotion component and landing placement**

Use this interface:

```ts
type MethodologyPromoProps = {
  href: "/methodology" | `/methodology/${MethodologyDatasetId}`;
  titleKa: string;
  bodyKa: string;
};
```

Render a full-width rule-separated two-column section with `SourceDocumentStack`, the lineage label, contextual copy, and one link. It must have generous `py-14`/desktop `py-20` scale and no enclosing card border/background/radius. Place the landing instance after `three-paths` and before `SiteFooter`.

- [ ] **Step 6: Add the hub route and shared methodology layout**

`/methodology` loads served landing/municipal facts, calls the archive summary loader, derives hub rows, renders the hub and `SiteFooter`, and exports Georgian metadata/canonical/OG values. `layout.tsx` supplies only the warm-paper page shell; it does not introduce a global top navigation or explorer sidebar.

- [ ] **Step 7: Extend global focus styles**

Change the existing selector once:

```css
button:focus-visible,
select:focus-visible,
input:focus-visible,
a:focus-visible,
summary:focus-visible {
  outline: 2px solid rgba(179, 64, 42, 0.4);
  outline-offset: 2px;
}
```

Do not otherwise restyle global anchors or disclosures.

- [ ] **Step 8: Run browser tests and commit**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts tests/browser/landing.spec.ts --grep "methodology hub|footer but never|landing renders"
git add app/methodology components/methodology components/site components/landing/landing-page.tsx app/globals.css tests/browser/methodology.spec.ts tests/browser/landing.spec.ts
git commit -m "feat(methodology): add editorial hub and shared footer"
```

Expected: hub and landing checks pass with no top-header methodology link.

---

### Task 5: Layered category articles and interactive original-source archive

**Files:**
- Create: `apps/web/components/methodology/methodology-article.tsx`
- Create: `apps/web/components/methodology/method-journey.tsx`
- Create: `apps/web/components/methodology/decision-record.tsx`
- Create: `apps/web/components/methodology/source-archive.tsx`
- Create: `apps/web/app/methodology/[dataset]/page.tsx`
- Modify: `apps/web/tests/browser/methodology.spec.ts`

**Interfaces:**
- Consumes: `MethodologyContent`, dynamic coverage, and one validated public archive manifest.
- Produces: closed static pages for the three live slugs and client archive filtering.

- [ ] **Step 1: Add failing category/archive browser tests**

Cover layered content, disclosures, and archive behavior:

```ts
test("expenditure methodology exposes the complete layered article", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology/expenditure");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ხარჯები");
  await expect(page.getByTestId("methodology-disclosure")).toContainText("GeoData");
  await expect(page.getByTestId("method-journey-step")).toHaveCount(4);
  await expect(page.getByTestId("decision-record")).toContainText("2004");
  await expect(page.getByTestId("source-archive-row")).toHaveCount(77);
});

test("archive filters by search and year with a visible zero state", async ({ page }) => {
  await page.goto("http://localhost:3100/methodology/revenue#source-archive");
  const archive = page.getByTestId("source-archive");
  await archive.getByRole("button", { name: "2025" }).click();
  await expect(archive.getByRole("button", { name: "2025" })).toHaveAttribute("aria-pressed", "true");
  await expect(archive.getByTestId("source-archive-row")).toHaveCount(1);
  await archive.getByRole("searchbox", { name: "პირველწყაროს ძებნა" }).fill("არარსებული ფაილი");
  await expect(archive.getByTestId("source-archive-empty")).toBeVisible();
});
```

Add a request/download test that fetches one individual file, calculates its SHA-256, compares it to the row/manifest value, and fetches the category ZIP and both manifest downloads with HTTP 200.

- [ ] **Step 2: Run focused browser tests and verify the category route is missing**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts --grep "complete layered article|archive filters|published download"
```

Expected: FAIL because `/methodology/[dataset]` and archive UI do not exist.

- [ ] **Step 3: Build the method journey and decision record**

`MethodJourney` always renders these four ordered concepts with dataset-specific explanatory text supplied by content:

```text
01 Preserve the untouched source
02 Read its year/structural era
03 Apply reviewed classification/transformation
04 Validate, reconcile, publish
```

`DecisionRecord` groups entries by `groupKa`. Each entry is native:

```tsx
<details data-testid="methodology-decision">
  <summary><span>{decision.titleKa}</span><span>{decision.statusKa}</span></summary>
  {decision.detailKa.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
</details>
```

Decision title/status are visible while closed. Render the technical appendix immediately after grouped decisions; do not make it a separate download.

- [ ] **Step 4: Build the layered article shell**

`MethodologyArticle` renders the exact approved anatomy: breadcrumb, H1/summary, four key facts, official-vs-GeoData disclosure, contents, scope, sources, journey, decision record, classification, validation, limitations, and archive. The contents column is normal flow below 1100px and `sticky top-6` only at/above that container width. Add `scroll-mt-6` to section headings.

Key-fact coverage comes from `deriveMethodologyCoverage`; frequency/basis/unit come from typed content values. Last review date comes from `content.reviewedAt`.

- [ ] **Step 5: Implement `SourceArchive` as the only client component in the article**

```ts
type SourceArchiveProps = {
  datasetId: MethodologyDatasetId;
  rows: readonly PublicSourceManifestRow[];
  summary: MethodologyArchiveSummary;
};
```

Behavior:

- ZIP action beside the introduction; separate CSV/JSON manifest links below it;
- underline-only search input with `type="search"` and label `პირველწყაროს ძებნა`;
- horizontally scrollable year buttons, `aria-pressed`, `ყველა` default;
- one filter predicate combining display title, official filename, source organization, format, and year;
- fixed newest-max-year-first order; no sort control;
- visible `ვერაფერი მოიძებნა` zero result;
- semantic table columns exactly Year, source/file, format, size, retrieved, SHA-256, download;
- full hash remains available in text/title; mono cell may wrap/break;
- download accessible name contains Georgian title plus format.

- [ ] **Step 6: Add the closed static category route**

```ts
export const dynamicParams = false;

export function generateStaticParams() {
  return LIVE_METHODOLOGY_IDS.map((dataset) => ({ dataset }));
}
```

Validate the param with `isMethodologyDatasetId`; unknown/future values call `notFound()`. `generateMetadata` uses catalog title/summary, canonical `/methodology/<id>`, and Georgian OG metadata. The page loads the matching served coverage, generated manifest, content, article, and shared footer. Do not create directories/pages for future categories.

- [ ] **Step 7: Run category/browser tests and commit**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts --grep "complete layered article|archive filters|published download"
git add 'app/methodology/[dataset]/page.tsx' components/methodology tests/browser/methodology.spec.ts
git commit -m "feat(methodology): add layered dataset articles and archives"
```

Expected: all three routes render; archive filters/downloads match validated bytes.

---

### Task 6: Promotions on main surfaces and compact municipality-detail links

**Files:**
- Modify: `apps/web/app/explorer/page.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`
- Modify: `apps/web/tests/browser/municipal-region.spec.ts`
- Modify: `apps/web/tests/browser/methodology.spec.ts`

**Interfaces:**
- Consumes: `MethodologyPromo` from Task 4.
- Produces: exact page-to-methodology target mapping without new explorer footer behavior.

- [ ] **Step 1: Add a page-to-target browser matrix**

```ts
for (const [path, expectedHref] of [
  ["/explorer", "/methodology"],
  ["/explorer/expenditure", "/methodology/expenditure"],
  ["/explorer/revenue", "/methodology/revenue"],
  ["/explorer/municipalities", "/methodology/municipalities"],
] as const) {
  test(`${path} ends with the approved methodology promotion`, async ({ page }) => {
    await page.goto(`http://localhost:3100${path}`);
    await expect(page.getByTestId("methodology-promo").getByRole("link")).toHaveAttribute("href", expectedHref);
    await expect(page.locator("footer")).toHaveCount(0);
  });
}
```

Add an analysis test that starts expenditure, checks `/methodology/expenditure`, switches to revenue, and checks `/methodology/revenue`. Add detail-route tests that assert no large promotion but one compact `/methodology/municipalities` link.

- [ ] **Step 2: Run the focused matrix and verify links are missing**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts --grep "approved methodology promotion|analysis promotion|compact methodology"
```

Expected: FAIL because explorer surfaces have no methodology discovery yet.

- [ ] **Step 3: Add the hub and fixed-side explorer promotions**

Append `MethodologyPromo` as the final content inside each route’s existing max-width container:

- `/explorer` → `/methodology`;
- `nav="expenditure"` → `/methodology/expenditure`;
- `nav="revenue"` → `/methodology/revenue`.

Do not wrap a new footer or change the explorer shell/sidebar.

- [ ] **Step 4: Make analysis promotion follow the active side**

In the existing client `MainExplorer`, derive only the target/copy:

```ts
const methodologyDataset: "expenditure" | "revenue" = nav === "analysis" ? analysisSide : nav;
const methodologyHref = `/methodology/${methodologyDataset}` as const;
```

Render the promotion after `AnalysisView`/`ExplorerView`, so the current analysis side immediately updates the link without a route reload. Do not add methodology state to the URL or change analysis controls.

- [ ] **Step 5: Add the municipality-index promotion**

After `<MunicipalitiesIndex />`, render the substantial municipality promotion targeting `/methodology/municipalities`. Keep it inside the existing route `<main>` and container, after the map/list content.

- [ ] **Step 6: Add compact detail links beside source notes**

Extend `MunicipalExplorerProps`:

```ts
methodologyHref: "/methodology/municipalities";
```

Immediately after its existing `SourceNote`, render:

```tsx
<Link data-testid="compact-methodology-link" href={props.methodologyHref} className="...underline...">
  მეთოდოლოგია და პირველწყაროები →
</Link>
```

Pass the fixed href from municipality and region pages. Do not add the large promotion to 75 detail routes.

- [ ] **Step 7: Run affected browser tests and commit**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts tests/browser/main-explorer.spec.ts tests/browser/municipalities.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts
git add app/explorer components/main-explorer/main-explorer.tsx components/municipalities/municipal-explorer.tsx tests/browser
git commit -m "feat(methodology): connect public data surfaces"
```

Expected: correct targets, no explorer footer, analysis target follows its active side, and detail pages remain compact.

---

### Task 7: Sitemap, mobile/accessibility coverage, and public metadata boundaries

**Files:**
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/tests/browser/methodology.spec.ts`

**Interfaces:**
- Consumes: live catalog IDs and content review dates.
- Produces: only four methodology URLs in metadata/sitemap plus final responsive/accessibility gates.

- [ ] **Step 1: Add failing sitemap and closed-route assertions**

The tests must require:

```ts
expect(methodologyUrls).toEqual([
  "/methodology",
  "/methodology/expenditure",
  "/methodology/revenue",
  "/methodology/municipalities",
]);
```

Browser requests to `/methodology/inflation`, `/methodology/gdp`, `/methodology/population`, and `/methodology/unemployment` must return the static 404 surface. Fetch `/sitemap.xml` in the browser test, parse its `<loc>` elements, and assert the exact four methodology URLs. The hub’s future labels remain visible as Georgian content without anchors.

- [ ] **Step 2: Add keyboard/mobile/archive semantics tests**

At 390×844 assert:

- H1 is visible/not clipped;
- open-document visual stacks after hero copy;
- article contents are not sticky;
- archive container scrolls horizontally while the page body does not overflow;
- promotion stacks and remains substantial;
- footer follows promotion only on landing/methodology pages.

Keyboard checks:

```ts
await page.getByTestId("methodology-decision").first().locator("summary").focus();
await page.keyboard.press("Enter");
await expect(page.getByTestId("methodology-decision").first()).toHaveAttribute("open", "");
await expect(page.getByRole("searchbox", { name: "პირველწყაროს ძებნა" })).toBeFocused();
```

Also verify a visible non-zero outline on one live row, year filter, disclosure summary, and download link; future rows are absent from the tab order.

- [ ] **Step 3: Run tests and verify sitemap/mobile gaps fail before the final edits**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts --grep "sitemap|future routes|mobile|keyboard"
```

Expected: sitemap/new responsive assertions fail until wired.

- [ ] **Step 4: Add methodology URLs to the sitemap from live IDs**

Append the hub and `LIVE_METHODOLOGY_IDS.map(...)`; derive category `lastModified` from `METHODOLOGY_CONTENT[id].reviewedAt`. Do not read future entries and do not handwrite their names in sitemap code.

- [ ] **Step 5: Correct only test-proven responsive/focus issues**

Use existing container queries/breakpoints and tokenized focus rules. Do not introduce viewport-specific alternate markup, JavaScript layout measurement, card containment, or a new animation system. Ensure `prefers-reduced-motion` already neutralizes the small row shift/reveal.

- [ ] **Step 6: Run methodology browser coverage and commit**

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts
git add app/sitemap.ts components/methodology app/globals.css tests/browser/methodology.spec.ts
git commit -m "test(methodology): close navigation and accessibility boundaries"
```

---

### Task 8: Canonical operations documentation, full verification, review, and authorized GitHub delivery

**Files:**
- Create: `docs/data-methodology/public-methodology-and-source-archives.md`
- Modify: `AGENTS.md`
- Modify: `docs/deployment.md`
- Review: every file changed in Tasks 1–7

**Interfaces:**
- Consumes: the complete implementation and validation report.
- Produces: a maintained archive workflow, verified feature branch, reviewed draft PR, green CI, and—only after the normal review gate—merge/deployment/live proof.

- [ ] **Step 1: Document the durable archive workflow**

The new methodology document must state:

- reviewed manifests are the only publication control;
- exact 77/21/77 initial inclusion roots and all derived-file exclusions;
- exact-vs-proxy retrieval-date meaning;
- allowed redistribution statuses and attribution requirements;
- originals remain immutable under `docs/Raw Data/`;
- generated public assets are ignored and reproduced by predev/prebuild;
- ZIP timestamp/order/compression contract;
- BOM/JSON manifest contract;
- `--write`, `--check`, data validation, build, and source-update sequence;
- byte-host fallback changes storage only, not product URLs/manifests;
- a new data year requires original capture, reviewed manifest row, methodology decision/content update, archive regeneration, tests, CI, and production download checks together.

- [ ] **Step 2: Update durable project/deployment state without claiming production early**

In `AGENTS.md`, record that the branch implements the approved methodology/source centre and link to the design/operations docs. Explicitly retain “production verification follows merge and deployment.” Do not paste schemas/file trees into `AGENTS.md`.

In `docs/deployment.md`, add the prebuild archive step, generated-output size/report check, representative download smoke checks, and byte-host fallback rule. Do not change the Actions-owned deployment flow.

- [ ] **Step 3: Run decision/archive focused tests together**

```powershell
cd apps/web
npm.cmd test -- tests/methodology/catalog.test.ts tests/methodology/sourceInventory.test.ts tests/methodology/sourceManifest.test.ts tests/methodology/prepareArchives.test.ts
npm.cmd run data:check-methodology-archives
```

Expected: PASS; 0 uncovered decisions, 175 originals, 61,420,375 original bytes, stable ZIP hashes, and BOM manifest.

- [ ] **Step 4: Run the required non-browser gate and build**

```powershell
npm.cmd run check
npm.cmd run build
```

Expected: lint, strict typecheck, all unit tests, existing data validation, methodology archive validation, and static build all PASS in CSV fallback mode.

- [ ] **Step 5: Run the full browser suite**

```powershell
npm.cmd run test:browser
```

Expected: all Playwright tests PASS. If Windows prints all passes but hangs during teardown, report the functional result separately and require hosted CI for the clean release gate; do not call the local command a clean pass.

- [ ] **Step 6: Perform a surgical diff and generated-artifact review**

```powershell
cd ../..
git diff --check
git status --short
git diff origin/main...HEAD --stat
git check-ignore apps/web/public/downloads/methodology/expenditure/manifest.json
```

Confirm:

- no generated archive/output/report is staged;
- no prepared GeoData CSV/text/geometry is labelled an original;
- no top-header/sidebar methodology link or explorer footer exists;
- all four live routes and only those routes are in sitemap;
- future markers are plain text;
- every canonical decision is covered;
- download copy/hash/ZIP membership is exact;
- existing explorer data/state/export behavior is untouched.

- [ ] **Step 7: Request code review and address findings**

Use `superpowers:requesting-code-review` against `origin/main...HEAD`. For findings, use the required review workflow, make only in-scope corrections, rerun affected focused tests plus `npm.cmd run check`/build/browser gates as appropriate, and commit verified fixes.

- [ ] **Step 8: If GitHub delivery is authorized, use the mandatory flow**

Do not push, create a PR, merge, or deploy merely because local implementation is complete. If the user has explicitly authorized GitHub delivery, run after local review is clean:

```powershell
git push -u origin codex/methodology-portal
gh pr create --draft --base main --head codex/methodology-portal --title "feat: add methodology and source portal" --body "Implements the approved Variant D methodology hub, live expenditure/revenue/municipality articles, validated original-source archives, and contextual discovery links.`n`nVerification: npm.cmd run check; npm.cmd run build; npm.cmd run test:browser; npm.cmd run data:check-methodology-archives."
```

Wait for every required CI job; do not bypass failures. Resolve review conversations, mark the PR ready only when implementation/review are complete, merge through the protected flow, delete the branch, and verify the Actions-owned production deployment reaches the merge SHA.

- [ ] **Step 9: Verify production routes and representative bytes**

After Vercel reports READY for the merge SHA, verify HTTP 200 and page identity for:

```text
/
/methodology
/methodology/expenditure
/methodology/revenue
/methodology/municipalities
/explorer
/explorer/expenditure
/explorer/revenue
/explorer/municipalities
/explorer/analysis
```

Download and hash-check one individual file per category, all three category ZIPs, and one CSV/JSON manifest pair. Verify future methodology paths return 404, top navigation remains unchanged, main promotions target correctly, and no runtime console errors appear. Only then update durable production status and close the delivery.
