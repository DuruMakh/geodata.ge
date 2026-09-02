# Fiscal.ge Query Core Part 2 — Static Publications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish seven build-time JSON files under `/downloads/data/` generated from the Part 1 snapshot, so a person or an AI client can download Fiscal.ge's reviewed budget data with its sources, caveats and coverage attached, without any request-time runtime.

**Architecture:** One new pure module (`lib/factQuery/publications.ts`) turns a `FactQuerySnapshot` into seven `{ fileName, bytes }` artifacts by calling the existing Part 1 query functions — no new calculation, no second definition of an observation. One new thin script (`scripts/prepare-fact-query-publications.ts`) writes or checks them, following the exact `--write` / `--check` shape of its three siblings. The methodology pages and `/llms.txt` then link the files.

**Tech Stack:** TypeScript (strict), Node 22, Vitest 4.1.5, Zod 4.4.3, Next.js 16 App Router, `node:crypto` for SHA-256.

Spec: `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` §12 (publication paths, `llms.txt`), §8.4 (licence), §7.2–7.3 (observation and coverage fields), §16 Part 2 (delivery gate).
Part 1 plan (complete): `docs/superpowers/plans/2026-08-28-fiscal-query-core.md`.

---

## Global Constraints

- **No data changes.** No reviewed financial value, taxonomy file, Prisma model, or import mapper is modified. Never run `npm run data:import` or any script writing to `data/imports/`. (§10.3)
- **No route, no request-time runtime, no database access at request time.** Part 2 adds static files only. `/mcp` and the connection page belong to Part 3. (§16)
- **The "no public API" wording in `/llms.txt` stays true and unchanged in Part 2.** Static files are publications, not an API. Only Part 3 rewords it. Do not touch the `expect(content).toMatch(/no public API/i)` assertion in this part. (§16 Part 2)
- **Licence is CC BY 4.0**, `https://creativecommons.org/licenses/by/4.0/`, in every published file, matching `buildResponseMeta` exactly. (§8.4)
- **Every file carries `schemaVersion`, `dataVersion`, `releaseCommit`, `generatedAt`.** `generatedAt` and `releaseCommit` are never inputs to `dataVersion`. (§4.3)
- **Georgian is the primary language.** Labels published are the reviewed `*Ka` fields. Do not invent English labels for series or entities; there is no English label field. (§7.2, §10)
- **Excluded municipal codes `05`, `42`, `43`, `46`, `64` never appear as territorial rows** and their individual contribution amounts are never exposed. (§5.4, §8.2)
- **Stable lowercase ASCII IDs** are identifiers; Georgian labels are display data.
- Match surrounding file style. `apps/web/lib/factQuery/` uses **LF** line endings in `queryMunicipal.ts`, `queryNational.ts`, `queryMinistries.ts`, `compare.ts`, `getSources.ts`, `observations.ts`, and **CRLF** in `rank.ts`, `buildSnapshot.ts`, `caveats/rules.municipal.ts`. Check with `file` or `git ls-files --eol <path>` before writing a patch script.
- All commands run from `apps/web`.
- Commit format: conventional commits, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.

---

## Why Task 1 exists (read before starting)

Part 2 reconnaissance measured the bulk output and found a **Part 1 correctness defect** that the 1,216 green tests do not catch.

`queryMunicipal` returns, for **Kutaisi (code `11`), education, 2020**, an observation citing **75 `documentIds`** — including `source.mof.municipalities.2016_2025.budget_history_04` (Tbilisi's workbook) and every other municipality's workbook. Spec §7.2 defines `documentIds` as "the exact public originals supporting the result." Tbilisi's workbook does not support Kutaisi's education figure.

The same snapshot, same entity, same year, through `getSources`:

```text
queryMunicipal observation.documentIds: 75
getSources(entityIds:['11'], years:[2020]) documents: 1
  -> [ 'source.mof.municipalities.2016_2025.budget_history_11' ]
```

`getSources` narrows correctly (Part 1 Task 17). `resolveDocumentIds` in `observations.ts` does not — it maps `sourceId -> every document of that source`, with no entity or year dimension.

Measured scope of the defect:

| Dataset | `documentIds` per observation (min / median / max) |
| --- | --- |
| national-revenue | 0 / 1 / 2 |
| national-expenditure | 1 / 2 / 2 |
| ministries (admin) | 0 / 1 / 1 |
| **municipal** | **1 / 75 / 75** |

It is municipal-only. It is also 21.58 MB of the 30.27 MB full municipal response — 71% of the bytes are wrong citations. Publishing that file without fixing this ships a wrong-shaped citation on 9,196 rows.

The document-id convention was verified exact against the real snapshot before this plan was written:

```text
source.municipal_mof_annual_and_history_workbooks documents: 75
codes with 0 matching documents: []      (every one of the 64 codes matches)
codes with >1 matching document: []      (no code matches two)
distinct doc counts: [ 1 ]               (exactly one workbook per code)
documents matching no code: the 5 aggregate-only workbooks (05, 42, 43, 46, 64)
                            + the per-year `<year>.functional_classification` workbooks
```

So the narrowing rule is precise and data-backed, not a guess.

---

## File Structure

**Create:**
- `apps/web/lib/factQuery/publications.ts` — pure builders: snapshot in, seven artifacts out. No filesystem, no `process`, no network.
- `apps/web/scripts/prepare-fact-query-publications.ts` — `--write` / `--check` wrapper.
- `apps/web/tests/factQuery/publications.test.ts` — unit tests over the builders.

**Modify:**
- `apps/web/lib/factQuery/observations.ts` — `resolveDocumentIds` gains an optional scope (Task 1).
- `apps/web/lib/factQuery/queryMunicipal.ts:463` — passes that scope (Task 1).
- `apps/web/tests/factQuery/queryMunicipal.test.ts` — citation-narrowing tests (Task 1).
- `apps/web/package.json` — two npm scripts, `prebuild`/`predev`/`data:validate` wiring (Task 4).
- `apps/web/app/methodology/[dataset]/page.tsx` — JSON links (Task 5).
- `apps/web/components/methodology/methodology-article.tsx` — JSON link rendering (Task 5).
- `apps/web/lib/seo/structuredData.ts` — JSON `DataDownload` distributions (Task 5).
- `apps/web/public/llms.txt` — publication links (Task 6).
- `apps/web/tests/seo/agentFiles.test.ts` — `requiredTargets` **and** the sitemap filter (Task 6).
- `docs/data-methodology/ai-grounding-and-caveats.md` — published-file inventory (Task 7).
- `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` — record the §16 Part 2 inaccuracy (Task 6).

---

## Task 1: Narrow observation citations to the originals that actually support the row

**Files:**
- Modify: `apps/web/lib/factQuery/observations.ts` (`resolveDocumentIds`, ~line 78)
- Modify: `apps/web/lib/factQuery/queryMunicipal.ts:463`
- Test: `apps/web/tests/factQuery/queryMunicipal.test.ts`

**Interfaces:**
- Consumes: `ResolvedSource`, `PublicDocument` from `./types`; `snapshot.municipal.municipalities[].code` and `.regionId`.
- Produces: `DocumentScope` type and the 3-argument `resolveDocumentIds`, exported from `./observations`. Task 3 relies on municipal observations carrying 1–2 `documentIds` for municipality rows.

**Design note for the implementer:** the scope argument is **optional and only `queryMunicipal` passes it**. `queryNational` and `queryMinistries` call sites are unchanged — their documents carry no municipality suffix, so the rule would be a no-op there, and leaving them alone keeps the blast radius to the one dataset with the defect.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/tests/factQuery/queryMunicipal.test.ts` (LF endings). It already builds a snapshot; reuse the existing suite's snapshot fixture and helpers (`data()`, `observationsOf()`) exactly as the surrounding tests do.

```ts
describe("an observation cites only the originals that support it", () => {
  // Spec section 7.2 calls documentIds "the exact public originals supporting
  // the result". The municipality budget-history source archives one workbook
  // per municipality, so Tbilisi's workbook is not an original supporting
  // Kutaisi's education figure. resolveDocumentIds used to attach every
  // document of every cited source to every row: 75 ids on a single-
  // municipality cell, 71% of the municipal publication's bytes.
  it("cites one municipality's own workbook, not all 64", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.education"],
      years: [2020],
      measure: "amount_gel",
    });
    const documentIds = observationsOf(result)[0]!.documentIds;

    expect(documentIds).toContain("source.mof.municipalities.2016_2025.budget_history_11");
    expect(documentIds).not.toContain("source.mof.municipalities.2016_2025.budget_history_04");
    expect(documentIds.length).toBeLessThanOrEqual(3);
  });

  it("keeps a cross-municipality workbook only for the years it covers", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.education"],
      years: [2020, 2016],
      measure: "amount_gel",
    });
    const byYear = new Map(observationsOf(result).map((o) => [o.year, o.documentIds]));
    const yearly = (ids: readonly string[]) => ids.filter((id) => /\.\d{4}\.functional_classification$/.test(id));

    // A workbook naming no municipality is narrowed by its own `years` field,
    // which is reviewed metadata rather than a filename convention.
    for (const [year, ids] of byYear) {
      for (const id of yearly(ids)) {
        expect(id, `year ${year} cited ${id}`).toContain(`.${year}.`);
      }
    }
  });

  it("gives a region the workbooks of its own municipalities and no others", () => {
    const region = snapshot.municipal.regions[0]!;
    const members = snapshot.municipal.municipalities.filter((m) => m.regionId === region.id).map((m) => m.code);
    const outsider = snapshot.municipal.municipalities.find((m) => m.regionId !== region.id)!.code;
    expect(members.length).toBeGreaterThan(0);

    const result = queryMunicipal(snapshot, {
      entityIds: [region.id],
      seriesIds: ["municipal.education"],
      years: [2020],
      measure: "amount_gel",
    });
    const documentIds = observationsOf(result)[0]!.documentIds;

    expect(documentIds).not.toContain(`source.mof.municipalities.2016_2025.budget_history_${outsider}`);
    expect(documentIds.some((id) => members.some((code) => id.endsWith(`_${code}`)))).toBe(true);
  });

  it("still cites every document behind the country aggregate", () => {
    // The country row really is built from all served municipalities, so
    // narrowing must not silently drop provenance here.
    const result = queryMunicipal(snapshot, {
      entityIds: ["country.georgia"],
      seriesIds: ["municipal.education"],
      years: [2020],
      measure: "amount_gel",
    });
    const documentIds = observationsOf(result)[0]!.documentIds;

    expect(documentIds.length).toBeGreaterThan(50);
  });

  it("never cites an excluded municipality's workbook", () => {
    // Codes 05/42/43/46/64 are not territorially attributable (spec 5.4).
    // Their workbooks must not surface as originals behind a public figure.
    const result = queryMunicipal(snapshot, {
      entityIds: ["country.georgia"],
      seriesIds: ["municipal.education"],
      years: [2020],
      measure: "amount_gel",
    });
    const documentIds = observationsOf(result)[0]!.documentIds;

    for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) {
      expect(documentIds).not.toContain(`source.mof.municipalities.2016_2025.budget_history_${code}`);
    }
  });
});
```

Add `AGGREGATE_ONLY_MUNICIPAL_CODES` to the file's existing import from `../../lib/factQuery/types` if it is not already imported.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/factQuery/queryMunicipal.test.ts -t "cites only the originals"
```

Expected: FAIL. The first test fails with `documentIds.length` 75, not `<= 3`, and `toContain(...budget_history_04)` succeeding when it must not.

- [ ] **Step 3: Add the scope to `resolveDocumentIds`**

In `apps/web/lib/factQuery/observations.ts` (LF), replace the existing `resolveDocumentIds` with:

```ts
/**
 * Which municipality workbooks support ONE observation.
 *
 * `entityCodes` is the set whose own published workbook stands behind this
 * row: one code for a municipality row, its member codes for a region row,
 * every served code for the country row. A document naming a municipality
 * outside that set is not an original supporting this figure, and citing it
 * makes a false provenance claim (spec section 7.2).
 *
 * `allCodes` includes the five aggregate-only codes so a workbook naming one
 * of them is recognised as entity-naming and then correctly excluded, rather
 * than falling through to the year-narrowed cross-municipality branch and
 * being cited on every row.
 */
export type DocumentScope = {
  year: number;
  entityCodes: readonly string[];
  allCodes: readonly string[];
};

/** The archive names a municipality in a document id as `_<code>` or `.<code>.`. */
function namedMunicipality(documentId: string, allCodes: readonly string[]): string | undefined {
  return allCodes.find((code) => documentId.endsWith(`_${code}`) || documentId.includes(`.${code}.`));
}

/**
 * documentIds for one observation, given the sources already resolved for
 * the whole response. Takes the resolved list rather than the snapshot so a
 * caller resolves sourceIds once per response (selectSources over the union
 * of every observation's sourceIds) instead of re-walking snapshot.sources
 * once per row.
 *
 * With no `scope` every document of every cited source is returned, which is
 * correct for national and ministries: their sources archive one or two
 * documents each, none of them entity-specific.
 */
export function resolveDocumentIds(
  resolvedSources: readonly ResolvedSource[],
  sourceIds: readonly string[],
  scope?: DocumentScope,
): string[] {
  const documentsBySourceId = new Map(resolvedSources.map((source) => [source.sourceId, source.documents]));
  const seen = new Set<string>();
  const documentIds: string[] = [];

  const supports = (document: PublicDocument): boolean => {
    if (scope === undefined) return true;
    const owner = namedMunicipality(document.documentId, scope.allCodes);
    // Names a municipality: keep it only for the entities this row covers.
    if (owner !== undefined) return scope.entityCodes.includes(owner);
    // Names none: a cross-municipality workbook, narrowed by its reviewed
    // `years` field. An empty `years` means the metadata does not record
    // coverage, so the document is kept rather than dropped on a guess.
    return document.years.length === 0 || document.years.includes(scope.year);
  };

  for (const sourceId of sourceIds) {
    for (const document of documentsBySourceId.get(sourceId) ?? []) {
      if (seen.has(document.documentId) || !supports(document)) continue;
      seen.add(document.documentId);
      documentIds.push(document.documentId);
    }
  }

  return documentIds;
}
```

Add `PublicDocument` to the existing type import from `./types` at the top of `observations.ts`.

- [ ] **Step 4: Pass the scope from `queryMunicipal`**

In `apps/web/lib/factQuery/queryMunicipal.ts`, above the observation-assembly function that contains line 463, add:

```ts
  // Codes whose own workbook supports each entity's rows. Municipalities map
  // to themselves; a region to its members; the country to every served code.
  // The five aggregate-only codes are deliberately absent from every set:
  // they are excluded from public territorial rows (spec 5.4), so their
  // workbooks must never appear as an original behind a published figure.
  const servedCodes = snapshot.municipal.municipalities
    .map((municipality) => municipality.code)
    .filter((code) => !AGGREGATE_ONLY_MUNICIPAL_CODES.includes(code as (typeof AGGREGATE_ONLY_MUNICIPAL_CODES)[number]));
  const codesByEntityId = new Map<string, string[]>([
    [MUNICIPAL_COUNTRY_ID, servedCodes],
    ...snapshot.municipal.regions.map(
      (region) =>
        [
          region.id,
          servedCodes.filter(
            (code) => snapshot.municipal.municipalities.find((m) => m.code === code)?.regionId === region.id,
          ),
        ] as const,
    ),
    ...servedCodes.map((code) => [code, [code]] as const),
  ]);
  // allCodes must include the aggregate-only codes so their workbooks are
  // recognised as entity-naming and excluded, not treated as cross-municipality.
  const allCodes = snapshot.municipal.municipalities.map((municipality) => municipality.code);
```

Then change line 463 from:

```ts
    documentIds: resolveDocumentIds(resolvedSources, core.sourceIds),
```

to:

```ts
    documentIds: resolveDocumentIds(resolvedSources, core.sourceIds, {
      year: core.year,
      entityCodes: codesByEntityId.get(core.entityId) ?? [],
      allCodes,
    }),
```

Verify `MUNICIPAL_COUNTRY_ID` and `AGGREGATE_ONLY_MUNICIPAL_CODES` are imported in this file; add them from `../data/municipal/types` and `./types` respectively if not.

If `servedCodes` already exists in the file under another name, reuse it rather than introducing a second list.

- [ ] **Step 5: Run the new tests**

```bash
npx vitest run tests/factQuery/queryMunicipal.test.ts
```

Expected: PASS, all tests in the file including the pre-existing ones.

- [ ] **Step 6: Prove no other dataset changed and Adjara is still exact**

```bash
npx vitest run tests/factQuery/
```

Expected: PASS. In particular `agreement.test.ts` must still pass — the Adjara 2024 consolidated total must remain exactly `1010741422.69`. If any national or ministries test changed behaviour, the scope leaked into a call site it must not touch.

- [ ] **Step 7: Commit**

```bash
git add lib/factQuery/observations.ts lib/factQuery/queryMunicipal.ts tests/factQuery/queryMunicipal.test.ts
git commit -m "fix(factQuery): cite only the originals that support a municipal row"
```

---

## Task 2: Publication builders for manifest, catalogue and sources

**Files:**
- Create: `apps/web/lib/factQuery/publications.ts`
- Test: `apps/web/tests/factQuery/publications.test.ts`

**Interfaces:**
- Consumes: `FactQuerySnapshot`, `describeCoverage`, `SCHEMA_VERSION` from Part 1; `createHash` from `node:crypto`.
- Produces:
  - `type PublicationArtifact = { fileName: string; bytes: Buffer; rowCount: number }`
  - `function buildCatalogueFile(snapshot: FactQuerySnapshot): PublicationArtifact`
  - `function buildSourcesFile(snapshot: FactQuerySnapshot): PublicationArtifact`
  - `function buildManifestFile(snapshot: FactQuerySnapshot, artifacts: readonly PublicationArtifact[]): PublicationArtifact`
  - `function publicationHeader(snapshot: FactQuerySnapshot): PublicationHeader`
  - Task 3 adds `buildDatasetFiles`; Task 4 consumes `buildAllPublications`.

**Design note:** `buildManifestFile` takes the other artifacts because §12.1 requires the manifest's hashes and byte sizes to describe the actual files. It must therefore be built last, over the exact bytes that get written. Never hash a re-serialization.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/factQuery/publications.test.ts`:

```ts
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import {
  buildCatalogueFile,
  buildManifestFile,
  buildSourcesFile,
  publicationHeader,
} from "../../lib/factQuery/publications";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-09-02T00:00:00.000Z" };
const parse = (bytes: Buffer) => JSON.parse(bytes.toString("utf8"));

describe("publication header", () => {
  it("carries the four identity fields and the licence verbatim", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const header = publicationHeader(snapshot);

    expect(header.schemaVersion).toBe(snapshot.schemaVersion);
    expect(header.dataVersion).toBe(snapshot.dataVersion);
    expect(header.releaseCommit).toBe("test-commit");
    expect(header.generatedAt).toBe("2026-09-02T00:00:00.000Z");
    // Must match buildResponseMeta exactly, or a downloaded file and an MCP
    // answer would state different licences for the same figures.
    expect(header.licence).toBe("CC BY 4.0");
    expect(header.licenceUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
  });
});

describe("catalogue.json", () => {
  it("publishes all four datasets with their series and entities", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = parse(buildCatalogueFile(snapshot).bytes);

    expect(catalogue.datasets.map((d: { datasetId: string }) => d.datasetId).sort()).toEqual([
      "ministries",
      "municipal-expenditure",
      "national-expenditure",
      "national-revenue",
    ]);
    for (const dataset of catalogue.datasets) {
      expect(dataset.series.length, `${dataset.datasetId} series`).toBeGreaterThan(0);
    }
    const municipal = catalogue.datasets.find((d: { datasetId: string }) => d.datasetId === "municipal-expenditure");
    expect(municipal.entities.length).toBeGreaterThan(0);
    expect(catalogue.exclusions.length).toBeGreaterThan(0);
  });

  it("never lists an excluded municipality as a queryable entity", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = parse(buildCatalogueFile(snapshot).bytes);
    const municipal = catalogue.datasets.find((d: { datasetId: string }) => d.datasetId === "municipal-expenditure");
    const entityIds = municipal.entities.map((e: { entityId: string }) => e.entityId);

    for (const code of ["05", "42", "43", "46", "64"]) {
      expect(entityIds).not.toContain(code);
    }
  });
});

describe("sources.json", () => {
  it("publishes every source with its documents and derivation", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const sources = parse(buildSourcesFile(snapshot).bytes);

    expect(sources.sources.length).toBe(snapshot.sources.length);
    for (const source of sources.sources) {
      // Spec 8.1: a source resolves to a public document or a stated derivation.
      expect(source.documents.length > 0 || source.derivation !== null).toBe(true);
    }
  });

  it("keeps the derivation-upstream role on published documents", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const sources = parse(buildSourcesFile(snapshot).bytes);
    const derived = sources.sources.find((s: { sourceId: string }) => s.sourceId === "source.adjara_consolidated_budget");

    // Without the role a consumer rendering documents presents the republican-
    // payments PDF as the publication of the consolidated total.
    expect(derived.documents.map((d: { role: string }) => d.role)).toEqual([
      "derivation_upstream",
      "derivation_upstream",
    ]);
  });
});

describe("manifest.json", () => {
  it("records the exact bytes and hash of every artifact it describes", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = buildCatalogueFile(snapshot);
    const sources = buildSourcesFile(snapshot);
    const manifest = parse(buildManifestFile(snapshot, [catalogue, sources]).bytes);

    for (const artifact of [catalogue, sources]) {
      const entry = manifest.files.find((f: { fileName: string }) => f.fileName === artifact.fileName);
      expect(entry, `${artifact.fileName} missing from manifest`).toBeDefined();
      expect(entry.byteSize).toBe(artifact.bytes.byteLength);
      expect(entry.sha256).toBe(createHash("sha256").update(artifact.bytes).digest("hex"));
      expect(entry.url).toBe(`/downloads/data/${artifact.fileName}`);
    }
  });

  it("does not describe itself", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const catalogue = buildCatalogueFile(snapshot);
    const manifest = buildManifestFile(snapshot, [catalogue]);

    // A manifest cannot carry its own hash: writing the hash changes the bytes.
    expect(parse(manifest.bytes).files.map((f: { fileName: string }) => f.fileName)).not.toContain("manifest.json");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/factQuery/publications.test.ts
```

Expected: FAIL with `Cannot find module '../../lib/factQuery/publications'`.

- [ ] **Step 3: Write `publications.ts`**

Create `apps/web/lib/factQuery/publications.ts` (LF endings, matching its `queryMunicipal.ts` siblings):

```ts
// apps/web/lib/factQuery/publications.ts
//
// Build-time bulk publications (spec section 12.1). Pure: a snapshot in,
// byte buffers out. No filesystem, no process, no network — the script in
// scripts/prepare-fact-query-publications.ts owns all I/O, exactly as
// buildSnapshot/prepare-fact-query-snapshot already split those concerns.
//
// Every figure here comes from the Part 1 query functions. Nothing in this
// file recalculates a budget number, so a published file and an MCP answer
// cannot disagree: there is only one implementation of an observation.
import { createHash } from "node:crypto";
import { describeCoverage } from "./describeCoverage";
import type { DatasetId, FactQuerySnapshot } from "./types";

export type PublicationHeader = {
  schemaVersion: string;
  dataVersion: string;
  releaseCommit: string;
  generatedAt: string;
  publisher: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
};

export type PublicationArtifact = {
  fileName: string;
  bytes: Buffer;
  rowCount: number;
};

const DATASET_IDS: readonly DatasetId[] = [
  "national-revenue",
  "national-expenditure",
  "ministries",
  "municipal-expenditure",
];

/**
 * Repeated at the top of every published file so a download read on its own,
 * without llms.txt or the manifest, still states its version, licence and
 * attribution (spec section 12.1).
 */
export function publicationHeader(snapshot: FactQuerySnapshot): PublicationHeader {
  return {
    schemaVersion: snapshot.schemaVersion,
    dataVersion: snapshot.dataVersion,
    releaseCommit: snapshot.releaseCommit,
    generatedAt: snapshot.generatedAt,
    publisher: "Fiscal.ge",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Fiscal.ge, CC BY 4.0",
  };
}

/** Stable two-space JSON with a trailing newline, matching the snapshot writer. */
function serialize(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function catalogueData(snapshot: FactQuerySnapshot, datasetId: DatasetId) {
  const response = describeCoverage(snapshot, { datasetId });
  if (response.kind !== "catalogue") {
    throw new Error(`describeCoverage(${datasetId}) returned ${response.kind}, expected catalogue`);
  }
  return response.data;
}

export function buildCatalogueFile(snapshot: FactQuerySnapshot): PublicationArtifact {
  const overview = describeCoverage(snapshot, {});
  if (overview.kind !== "catalogue") {
    throw new Error(`describeCoverage({}) returned ${overview.kind}, expected catalogue`);
  }

  const datasets = DATASET_IDS.map((datasetId) => {
    const data = catalogueData(snapshot, datasetId);
    const summary = data.datasets.find((entry) => entry.datasetId === datasetId);
    if (summary === undefined) throw new Error(`No dataset summary for ${datasetId}`);
    return {
      ...summary,
      series: data.series ?? [],
      ...(data.entities !== undefined ? { entities: data.entities } : {}),
    };
  });

  const bytes = serialize({
    ...publicationHeader(snapshot),
    notice:
      "ეს არის გადამოწმებული კატალოგი: რომელი მონაცემთა ნაკრები, ერთეული და სერია არსებობს. ციფრები ცალკეულ ფაილებშია.",
    datasets,
    exclusions: overview.data.exclusions,
  });

  return { fileName: "catalogue.json", bytes, rowCount: datasets.reduce((n, d) => n + d.series.length, 0) };
}

export function buildSourcesFile(snapshot: FactQuerySnapshot): PublicationArtifact {
  const bytes = serialize({
    ...publicationHeader(snapshot),
    notice:
      "წყაროს ჩანაწერი role=\"derivation_upstream\" ნიშნავს, რომ დოკუმენტი გაანგარიშების საწყისი მონაცემია და არა საბოლოო ციფრის პუბლიკაცია.",
    sources: snapshot.sources,
  });

  return { fileName: "sources.json", bytes, rowCount: snapshot.sources.length };
}

/**
 * Built LAST, over the exact buffers that get written. Hashing a
 * re-serialization would let the manifest describe bytes nobody published.
 * The manifest cannot list itself: writing its own hash would change its
 * own bytes.
 */
export function buildManifestFile(
  snapshot: FactQuerySnapshot,
  artifacts: readonly PublicationArtifact[],
): PublicationArtifact {
  const bytes = serialize({
    ...publicationHeader(snapshot),
    files: artifacts.map((artifact) => ({
      fileName: artifact.fileName,
      url: `/downloads/data/${artifact.fileName}`,
      rowCount: artifact.rowCount,
      byteSize: artifact.bytes.byteLength,
      sha256: sha256(artifact.bytes),
      mediaType: "application/json",
    })),
  });

  return { fileName: "manifest.json", bytes, rowCount: artifacts.length };
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/factQuery/publications.test.ts
```

Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/factQuery/publications.ts tests/factQuery/publications.test.ts
git commit -m "feat(factQuery): build the catalogue, sources and manifest publications"
```

---

## Task 3: The four dataset publications

**Files:**
- Modify: `apps/web/lib/factQuery/publications.ts`
- Modify: `apps/web/tests/factQuery/publications.test.ts`

**Interfaces:**
- Consumes: `queryNational`, `queryMinistries`, `queryMunicipal` (Part 1), `publicationHeader` and `serialize` (Task 2), the narrowed `documentIds` (Task 1).
- Produces: `function buildDatasetFiles(snapshot: FactQuerySnapshot): PublicationArtifact[]` returning four artifacts in the order `national-revenue.json`, `national-expenditure.json`, `ministries.json`, `municipal-expenditure.json`; and `function buildAllPublications(snapshot: FactQuerySnapshot): PublicationArtifact[]` returning all seven with `manifest.json` last. Task 4 consumes `buildAllPublications`.

**Design notes for the implementer:**

1. **`amount_gel` only.** Spec §12.1: "Include only the supporting GDP and population values needed to reproduce its allowed ratios." Publish base GEL observations plus `gdpFacts` (national, ministries) or `populationFacts` (municipal), so a consumer computes shares and per-resident figures themselves. Do not publish four measures of every row.

2. **Excluded codes.** Build `entityIds` for the municipal file from `snapshot.municipal.municipalities` **minus** `AGGREGATE_ONLY_MUNICIPAL_CODES`, plus every region id, plus `MUNICIPAL_COUNTRY_ID`.

3. **Summing warning.** §12.1 requires it: these files carry overlapping totals and components. Every observation already carries `level`, `parentSeriesId` and `entityType`, so the role and parentage are explicit; the file adds the warning string.

4. **Status is not an error.** These bulk queries legitimately return `status: "partial"` (a series that does not exist in every year produces missing cells). Assert `kind === "observations"`, never `status === "ok"`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/tests/factQuery/publications.test.ts`:

```ts
describe("dataset publications", () => {
  it("publishes the four files with observations, catalogue, sources and caveats", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const files = buildDatasetFiles(snapshot);

    expect(files.map((f) => f.fileName)).toEqual([
      "national-revenue.json",
      "national-expenditure.json",
      "ministries.json",
      "municipal-expenditure.json",
    ]);

    for (const file of files) {
      const published = parse(file.bytes);
      expect(published.observations.length, `${file.fileName} observations`).toBeGreaterThan(0);
      expect(published.observations.length).toBe(file.rowCount);
      expect(published.catalogue.series.length, `${file.fileName} series`).toBeGreaterThan(0);
      expect(published.sources.length, `${file.fileName} sources`).toBeGreaterThan(0);
      expect(published.coverage, `${file.fileName} coverage`).toBeDefined();
      expect(published.licence).toBe("CC BY 4.0");
      // Spec 12.1: the file must warn that summing all rows is invalid.
      expect(published.notice, `${file.fileName} notice`).toMatch(/ჯამი|არ უნდა/);
    }
  });

  it("gives every observation an explicit role, parentage and level", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    for (const file of buildDatasetFiles(snapshot)) {
      for (const observation of parse(file.bytes).observations) {
        expect(observation.level, `${file.fileName} ${observation.observationId}`).toBeTruthy();
        expect(observation).toHaveProperty("parentSeriesId");
        expect(observation.entityType, `${file.fileName} ${observation.observationId}`).toBeTruthy();
      }
    }
  });

  it("excludes the five aggregate-only municipalities from the municipal file", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const municipal = parse(buildDatasetFiles(snapshot)[3]!.bytes);
    const entityIds = new Set(municipal.observations.map((o: { entityId: string }) => o.entityId));

    for (const code of ["05", "42", "43", "46", "64"]) {
      expect(entityIds.has(code), `code ${code} published as a territorial row`).toBe(false);
    }
    // They must still be named as exclusions with a reason, not silently absent.
    expect(municipal.catalogue.exclusions.length).toBeGreaterThanOrEqual(5);
  });

  it("separates ministries by hierarchy level", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const ministries = parse(buildDatasetFiles(snapshot)[2]!.bytes);
    const levels = new Set(ministries.observations.map((o: { level: string }) => o.level));

    expect(levels.has("admin_category")).toBe(true);
    expect(levels.has("major_program")).toBe(true);
  });

  it("carries the supporting denominators, not precomputed ratios", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const files = buildDatasetFiles(snapshot);
    const revenue = parse(files[0]!.bytes);
    const municipal = parse(files[3]!.bytes);

    expect(revenue.supportingValues.gdpFacts.length).toBeGreaterThan(0);
    expect(municipal.supportingValues.populationFacts.length).toBeGreaterThan(0);
    // amount_gel only: ratios are reproducible from the denominators above.
    expect(new Set(revenue.observations.map((o: { measure: string }) => o.measure))).toEqual(new Set(["amount_gel"]));
  });

  it("keeps every published file within the size budget", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    // A guard against a silent regression republishing per-row duplication.
    // Record the real numbers in the Task 7 verification note.
    for (const file of buildAllPublications(snapshot)) {
      expect(file.bytes.byteLength / 1024 / 1024, `${file.fileName} MB`).toBeLessThan(20);
    }
  });

  it("puts the manifest last so it can hash the others", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const all = buildAllPublications(snapshot);

    expect(all.map((f) => f.fileName)).toEqual([
      "catalogue.json",
      "sources.json",
      "national-revenue.json",
      "national-expenditure.json",
      "ministries.json",
      "municipal-expenditure.json",
      "manifest.json",
    ]);
  });
});
```

Extend the import at the top of the test file to include `buildAllPublications` and `buildDatasetFiles`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/factQuery/publications.test.ts -t "dataset publications"
```

Expected: FAIL — `buildDatasetFiles is not a function`.

- [ ] **Step 3: Implement the dataset builders**

Append to `apps/web/lib/factQuery/publications.ts`, and extend its imports with `queryNational`, `queryMinistries`, `queryMunicipal`, `AGGREGATE_ONLY_MUNICIPAL_CODES`, `MUNICIPAL_COUNTRY_ID` (from `../data/municipal/types`) and `FactQueryResponse`:

```ts
const SUM_WARNING =
  "ამ ფაილში ერთდროულადაა ჯამები და მათი შემადგენელი ნაწილები. ყველა სტრიქონის შეკრება არასწორ შედეგს იძლევა — გამოიყენეთ level და parentSeriesId.";

function observationsOf(response: FactQueryResponse, label: string) {
  if (response.kind !== "observations") {
    const detail = response.kind === "error" ? response.error.messageEn : response.kind;
    throw new Error(`${label} returned ${detail}, expected observations`);
  }
  return response;
}

/**
 * One dataset file. `status` is deliberately not asserted: a bulk query over
 * every series and year legitimately reports "partial", because a series that
 * does not exist in every year produces missing cells. Those cells are
 * published in `coverage` rather than hidden.
 */
function datasetFile(
  snapshot: FactQuerySnapshot,
  datasetId: DatasetId,
  fileName: string,
  response: FactQueryResponse,
  supportingValues: Record<string, unknown>,
): PublicationArtifact {
  const result = observationsOf(response, fileName);
  const bytes = serialize({
    ...publicationHeader(snapshot),
    datasetId,
    notice: SUM_WARNING,
    catalogue: catalogueData(snapshot, datasetId),
    observations: result.data.observations,
    coverage: result.data.coverage,
    supportingValues,
    // Repeated in full, not by reference: spec 12.1 requires source and caveat
    // definitions to stay usable when the file is downloaded on its own.
    sources: result.meta.sources,
    caveats: result.meta.caveats,
  });

  return { fileName, bytes, rowCount: result.data.observations.length };
}

function yearsOf(values: readonly { year: number }[]): number[] {
  return [...new Set(values.map((value) => value.year))].sort((left, right) => left - right);
}

export function buildDatasetFiles(snapshot: FactQuerySnapshot): PublicationArtifact[] {
  const nationalYears = yearsOf(snapshot.national.facts);
  const seriesFor = (side: "revenue" | "expenditure") => [
    ...new Set(snapshot.national.facts.filter((fact) => fact.side === side).map((fact) => fact.itemId)),
  ];
  const gdp = { gdpFacts: snapshot.gdpFacts };

  const ministriesYears = yearsOf(snapshot.ministries.facts);
  const ministriesSeries = snapshot.ministries.categories.map((category) => category.id);

  const municipalYears = yearsOf(snapshot.municipal.functionFacts);
  const municipalSeries = [...snapshot.municipal.functions.map((fn) => fn.id), "municipal.total"];
  const municipalEntities = [
    ...snapshot.municipal.municipalities
      .map((municipality) => municipality.code)
      .filter(
        (code) => !AGGREGATE_ONLY_MUNICIPAL_CODES.includes(code as (typeof AGGREGATE_ONLY_MUNICIPAL_CODES)[number]),
      ),
    ...snapshot.municipal.regions.map((region) => region.id),
    MUNICIPAL_COUNTRY_ID,
  ];

  // Ministries publishes both hierarchy levels in one file (spec 12.1). The
  // two responses are queried separately because level is a request dimension,
  // then concatenated; every row still carries its own `level`.
  const admin = observationsOf(
    queryMinistries(snapshot, {
      level: "admin_category",
      seriesIds: ministriesSeries,
      years: ministriesYears,
      measure: "amount_gel",
    }),
    "ministries.json (admin_category)",
  );
  // Program series are the itemIds of the major_program-level facts: 48
  // distinct ids across 549 facts, verified against the built snapshot.
  const programSeries = [
    ...new Set(
      snapshot.ministries.facts.filter((fact) => fact.level === "major_program").map((fact) => fact.itemId),
    ),
  ];
  const programs = observationsOf(
    queryMinistries(snapshot, {
      level: "major_program",
      seriesIds: programSeries,
      years: ministriesYears,
      measure: "amount_gel",
    }),
    "ministries.json (major_program)",
  );
  const ministriesBytes = serialize({
    ...publicationHeader(snapshot),
    datasetId: "ministries" as const,
    notice: SUM_WARNING,
    catalogue: catalogueData(snapshot, "ministries"),
    observations: [...admin.data.observations, ...programs.data.observations],
    coverage: { admin_category: admin.data.coverage, major_program: programs.data.coverage },
    supportingValues: gdp,
    sources: [
      ...admin.meta.sources,
      ...programs.meta.sources.filter(
        (source) => !admin.meta.sources.some((seen) => seen.sourceId === source.sourceId),
      ),
    ],
    caveats: [
      ...admin.meta.caveats,
      ...programs.meta.caveats.filter((caveat) => !admin.meta.caveats.some((seen) => seen.code === caveat.code)),
    ],
  });

  return [
    datasetFile(
      snapshot,
      "national-revenue",
      "national-revenue.json",
      queryNational(snapshot, {
        side: "revenue",
        seriesIds: seriesFor("revenue"),
        years: nationalYears,
        measure: "amount_gel",
      }),
      gdp,
    ),
    datasetFile(
      snapshot,
      "national-expenditure",
      "national-expenditure.json",
      queryNational(snapshot, {
        side: "expenditure",
        seriesIds: seriesFor("expenditure"),
        years: nationalYears,
        measure: "amount_gel",
      }),
      gdp,
    ),
    {
      fileName: "ministries.json",
      bytes: ministriesBytes,
      rowCount: admin.data.observations.length + programs.data.observations.length,
    },
    datasetFile(
      snapshot,
      "municipal-expenditure",
      "municipal-expenditure.json",
      queryMunicipal(snapshot, {
        entityIds: municipalEntities,
        seriesIds: municipalSeries,
        years: municipalYears,
        measure: "amount_gel",
      }),
      { populationFacts: snapshot.municipal.populationFacts },
    ),
  ];
}

export function buildAllPublications(snapshot: FactQuerySnapshot): PublicationArtifact[] {
  const artifacts = [buildCatalogueFile(snapshot), buildSourcesFile(snapshot), ...buildDatasetFiles(snapshot)];
  return [...artifacts, buildManifestFile(snapshot, artifacts)];
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/factQuery/publications.test.ts
```

Expected: PASS, all tests.

- [ ] **Step 5: Record the real sizes**

```bash
npx tsx -e "import('./lib/factQuery/buildSnapshot').then(async (m)=>{const s=await m.buildFactQuerySnapshot({releaseCommit:'x',generatedAt:new Date().toISOString()});const p=await import('./lib/factQuery/publications');for(const f of p.buildAllPublications(s))console.log(f.fileName, f.rowCount, 'rows', (f.bytes.byteLength/1024/1024).toFixed(2), 'MB');})"
```

Expected: seven lines. `municipal-expenditure.json` is the largest. Paste the output into the Task 7 verification note. If any file exceeds 20 MB the budget test already failed in Step 4 — do not raise the budget; find the duplication.

- [ ] **Step 6: Commit**

```bash
git add lib/factQuery/publications.ts tests/factQuery/publications.test.ts
git commit -m "feat(factQuery): build the four dataset publications from the snapshot"
```

---

## Task 4: Write the files at build time

**Files:**
- Create: `apps/web/scripts/prepare-fact-query-publications.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: `buildAllPublications` (Task 3), `buildFactQuerySnapshot`.
- Produces: `npm run data:prepare-fact-query-publications` and `npm run data:check-fact-query-publications`; the seven files in `apps/web/public/downloads/data/`.

**Critical ordering constraint:** `lib/data/publicDatasetExports.ts` runs `rm(outputRoot, { recursive: true, force: true })` on `public/downloads/data` before writing its three CSVs. The new script must therefore run **after** `data:prepare-public-datasets`, and must **not** clear the directory itself — doing so would delete those CSVs. Write only its own seven files.

`public/downloads/data/` is gitignored (`.gitignore:49`), so nothing here is committed; the files are build output, exactly like the CSVs.

- [ ] **Step 1: Write the script**

Create `apps/web/scripts/prepare-fact-query-publications.ts`, mirroring `prepare-fact-query-snapshot.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactQuerySnapshot } from "../lib/factQuery/buildSnapshot";
import { buildAllPublications } from "../lib/factQuery/publications";

const OUTPUT_DIR = path.join(process.cwd(), "public", "downloads", "data");

function releaseCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  if (write === check) throw new Error("Pass exactly one of --write or --check");

  const snapshot = await buildFactQuerySnapshot({
    releaseCommit: releaseCommit(),
    generatedAt: new Date().toISOString(),
  });
  const artifacts = buildAllPublications(snapshot);

  if (write) {
    // Deliberately NOT clearing OUTPUT_DIR: preparePublicDatasets already
    // wiped and rewrote it with the three public CSVs immediately before this
    // script runs, and clearing again would delete them.
    await mkdir(OUTPUT_DIR, { recursive: true });
    for (const artifact of artifacts) {
      await writeFile(path.join(OUTPUT_DIR, artifact.fileName), artifact.bytes);
      process.stdout.write(
        `${artifact.fileName}: ${artifact.rowCount} rows, ${artifact.bytes.byteLength} bytes\n`,
      );
    }
    process.stdout.write(`wrote ${artifacts.length} publications dataVersion=${snapshot.dataVersion}\n`);
    return;
  }

  // Check: the files on disk must be the files this snapshot produces. A stale
  // publication would let a download disagree with the explorer and with any
  // MCP answer built from the same release.
  const stale: string[] = [];
  for (const artifact of artifacts) {
    const filePath = path.join(OUTPUT_DIR, artifact.fileName);
    const onDisk = await readFile(filePath).catch(() => null);
    if (onDisk === null) {
      stale.push(`${artifact.fileName}: missing`);
      continue;
    }
    // manifest.json and every dataset file embed generatedAt, which changes on
    // every run by design (spec 4.3). Compare the content that must not drift.
    const strip = (bytes: Buffer) =>
      JSON.stringify({ ...JSON.parse(bytes.toString("utf8")), generatedAt: null, releaseCommit: null });
    if (strip(onDisk) !== strip(artifact.bytes)) stale.push(`${artifact.fileName}: content differs`);
  }

  if (stale.length > 0) {
    throw new Error(
      `${stale.length} publication(s) are stale. Run npm run data:prepare-fact-query-publications:\n` +
        stale.map((line) => `  - ${line}`).join("\n"),
    );
  }

  process.stdout.write(`${artifacts.length} publications current dataVersion=${snapshot.dataVersion}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Wire the npm scripts**

In `apps/web/package.json`, add after the two `data:*-fact-query-snapshot` entries:

```json
    "data:prepare-fact-query-publications": "tsx scripts/prepare-fact-query-publications.ts --write",
    "data:check-fact-query-publications": "tsx scripts/prepare-fact-query-publications.ts --check",
```

Change `prebuild` and `predev` (both currently identical) to append the new step **last**:

```json
    "predev": "npm run data:prepare-methodology-archives && npm run data:prepare-public-datasets && npm run data:prepare-fact-query-snapshot && npm run data:prepare-fact-query-publications",
    "prebuild": "npm run data:prepare-methodology-archives && npm run data:prepare-public-datasets && npm run data:prepare-fact-query-snapshot && npm run data:prepare-fact-query-publications",
```

Append to `data:validate`:

```json
    "data:validate": "tsx scripts/validate-data-files.ts && npm run data:check-national-gdp && npm run data:check-municipal-indicators && npm run data:check-municipal-population && npm run data:check-methodology-archives && npm run data:check-public-datasets && npm run data:check-fact-query-snapshot && npm run data:check-fact-query-publications",
```

- [ ] **Step 3: Run it and verify the CSVs survive**

```bash
npm run data:prepare-fact-query-publications && ls -la public/downloads/data/
```

Expected: seven `.json` files **and** the three pre-existing `.csv` files. If a CSV is missing, the ordering constraint was violated.

- [ ] **Step 4: Verify the check mode passes, then catches a stale file**

```bash
npm run data:check-fact-query-publications
```

Expected: `7 publications current dataVersion=<hash>`.

```bash
printf '{"broken":true}\n' > public/downloads/data/catalogue.json && npm run data:check-fact-query-publications; echo "exit=$?"
```

Expected: FAIL, exit 1, naming `catalogue.json: content differs`. Then restore:

```bash
npm run data:prepare-fact-query-publications
```

- [ ] **Step 5: Verify a full clean build produces all ten files**

```bash
npm run build && ls public/downloads/data/
```

Expected: build exit 0; ten files (7 JSON + 3 CSV).

- [ ] **Step 6: Commit**

```bash
git add scripts/prepare-fact-query-publications.ts package.json
git commit -m "feat(build): publish the fact-query JSON files under /downloads/data"
```

---

## Task 5: Link the JSON publications from the methodology pages

**Files:**
- Modify: `apps/web/components/methodology/methodology-article.tsx` (the `processed-dataset-download` block, ~line 70)
- Modify: `apps/web/app/methodology/[dataset]/page.tsx:40-42`
- Modify: `apps/web/lib/seo/structuredData.ts:14`, `:26`, `:123-129`, `:154-160`
- Test: `apps/web/tests/seo/structuredData.test.ts`

**Interfaces:**
- Consumes: the published file names from Task 3.
- Produces: `MethodologyArticleProps.processedDataJsonHrefs: readonly \`/downloads/data/${string}.json\`[]`; `DatasetJsonLdInput.jsonDownloadPaths?: readonly \`/downloads/data/${string}.json\`[]`.

**Spec constraint (§12.2):** "linking both expenditure and ministries JSON from the expenditure methodology." So the expenditure page gets two JSON links, revenue and municipalities one each. Keep the existing CSV link and the existing design; add links beside it, do not replace it.

- [ ] **Step 1: Write the failing structured-data test**

Append to `apps/web/tests/seo/structuredData.test.ts`:

```ts
describe("Dataset distributions describe every published format", () => {
  it("adds a JSON DataDownload beside the CSV", () => {
    const jsonLd = datasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/methodology/expenditure",
      name: "სახელმწიფო ბიუჯეტის ხარჯები",
      description: "საქართველოს სახელმწიფო ბიუჯეტის წლიური ხარჯები გადამოწმებული ოფიციალური წყაროებიდან.",
      firstYear: 2004,
      lastYear: 2025,
      dateModified: "2026-09-02",
      downloadPath: "/downloads/data/national-expenditure.csv",
      jsonDownloadPaths: ["/downloads/data/national-expenditure.json", "/downloads/data/ministries.json"],
    });

    const distribution = (jsonLd as { distribution: { encodingFormat: string; contentUrl: string }[] }).distribution;
    expect(distribution).toEqual([
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: "https://fiscal.ge/downloads/data/national-expenditure.csv" },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://fiscal.ge/downloads/data/national-expenditure.json" },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://fiscal.ge/downloads/data/ministries.json" },
    ]);
  });

  it("keeps the CSV-only shape when no JSON is published", () => {
    const jsonLd = datasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/methodology/revenue",
      name: "სახელმწიფო ბიუჯეტის შემოსავლები",
      description: "საქართველოს სახელმწიფო ბიუჯეტის წლიური შემოსავლები გადამოწმებული ოფიციალური წყაროებიდან.",
      firstYear: 2005,
      lastYear: 2025,
      dateModified: "2026-09-02",
      downloadPath: "/downloads/data/national-revenue.csv",
    });

    expect((jsonLd as { distribution: unknown[] }).distribution).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/seo/structuredData.test.ts -t "every published format"
```

Expected: FAIL — the distribution has one entry, and TypeScript rejects `jsonDownloadPaths`.

- [ ] **Step 3: Widen the structured-data input**

In `apps/web/lib/seo/structuredData.ts`, add to `DatasetJsonLdInput` (after `downloadPath`):

```ts
  /** Published JSON companions to the CSV, in the order they should be listed. */
  jsonDownloadPaths?: readonly `/downloads/data/${string}.json`[];
```

Replace the `distribution` array at ~line 123 with:

```ts
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: absoluteUrl(input.origin, input.downloadPath),
      },
      ...(input.jsonDownloadPaths ?? []).map((jsonPath) => ({
        "@type": "DataDownload" as const,
        encodingFormat: "application/json",
        contentUrl: absoluteUrl(input.origin, jsonPath),
      })),
    ],
```

Leave `explorerDatasetJsonLd` unchanged: the explorer pages link the CSV, and §12.2 asks only for methodology-page links.

- [ ] **Step 4: Add the links to the methodology article**

In `apps/web/components/methodology/methodology-article.tsx`, add to `MethodologyArticleProps`:

```ts
  processedDataJsonHrefs: readonly `/downloads/data/${string}.json`[];
```

Add it to the destructured parameter list, then extend the existing download block. Keep the current CSV anchor exactly as it is and add beneath it, inside the same `<div className="border-b border-[var(--ink)] py-6">`:

```tsx
        {processedDataJsonHrefs.length > 0 ? (
          <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
            {processedDataJsonHrefs.map((href, index) => (
              <span key={href}>
                {index > 0 ? " · " : null}
                <a
                  data-testid="processed-dataset-json"
                  href={href}
                  download
                  className="font-semibold text-[var(--accent)] underline underline-offset-4"
                >
                  {href.split("/").pop()}
                </a>
              </span>
            ))}
            {" — JSON (წყაროებით, დათქმებითა და დაფარვით)"}
          </p>
        ) : null}
```

- [ ] **Step 5: Supply the hrefs per dataset**

In `apps/web/app/methodology/[dataset]/page.tsx`, beside the existing map at lines 40-42, add:

```ts
const processedJsonByDataset: Record<string, readonly `/downloads/data/${string}.json`[]> = {
  // Spec 12.2: the expenditure methodology links both expenditure and
  // ministries JSON. ministries.json has no CSV counterpart in this family.
  expenditure: ["/downloads/data/national-expenditure.json", "/downloads/data/ministries.json"],
  revenue: ["/downloads/data/national-revenue.json"],
  municipalities: ["/downloads/data/municipal-expenditure.json"],
};
```

Pass `processedDataJsonHrefs={processedJsonByDataset[dataset] ?? []}` to `<MethodologyArticle …>` and `jsonDownloadPaths={processedJsonByDataset[dataset] ?? []}` to the `datasetJsonLd(...)` call in the same file. Read the file first: the exact prop names and the `dataset` variable's name must match what is already there.

- [ ] **Step 6: Run lint, typecheck and the unit tests**

```bash
npm run lint && npm run typecheck && npx vitest run tests/seo/
```

Expected: all exit 0.

- [ ] **Step 7: Verify the links resolve in a real browser**

```bash
npm run build && npm run test:browser -- tests/browser/seo.spec.ts
```

Expected: PASS. If `NEXT_PUBLIC_SITE_URL` is unset locally, ~10 seo.spec URL assertions fail for that reason alone — set `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` at both build and test, per the known local recipe.

- [ ] **Step 8: Commit**

```bash
git add components/methodology/methodology-article.tsx app/methodology/[dataset]/page.tsx lib/seo/structuredData.ts tests/seo/structuredData.test.ts
git commit -m "feat(methodology): link the JSON publications beside the processed CSVs"
```

---

## Task 6: Publish the files in `/llms.txt`

**Files:**
- Modify: `apps/web/public/llms.txt`
- Modify: `apps/web/tests/seo/agentFiles.test.ts`
- Modify: `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` (§16 Part 2)

**Spec correction the implementer must make:** §16 Part 2 states "Only `requiredTargets` in `apps/web/tests/seo/agentFiles.test.ts` needs updating, for the added links." **That is wrong.** The file's second test computes

```ts
const htmlTargets = targets.filter((target) => new URL(target).pathname !== "/sitemap.xml");
```

and then asserts every `htmlTarget` appears in the sitemap. A `.json` link is not `/sitemap.xml`, so it lands in `htmlTargets` and fails — the JSON files are downloads, not HTML pages, and correctly do not belong in the sitemap. Two assertions need updating, not one. Record this in the spec.

The "no public API" assertion stays untouched in this part (Global Constraints).

- [ ] **Step 1: Update the test first**

In `apps/web/tests/seo/agentFiles.test.ts`, add to `requiredTargets` after `"https://fiscal.ge/methodology/municipalities"`:

```ts
  "https://fiscal.ge/downloads/data/manifest.json",
  "https://fiscal.ge/downloads/data/catalogue.json",
  "https://fiscal.ge/downloads/data/sources.json",
```

Then replace the `htmlTargets` line in the second test with:

```ts
    // Downloads are published files, not pages: they are deliberately absent
    // from the sitemap, which lists public HTML routes. Spec section 16 claimed
    // only requiredTargets needed updating here; it missed this filter.
    const htmlTargets = targets.filter((target) => !/\.(xml|json|csv)$/.test(new URL(target).pathname));
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/seo/agentFiles.test.ts
```

Expected: FAIL — `targets` does not equal `requiredTargets`, because `llms.txt` has no JSON links yet.

- [ ] **Step 3: Add the section to `llms.txt`**

The link order in the file must match `requiredTargets` exactly (the test asserts array equality). Insert a new section **between** "## Methodology and sources" and "## Site navigation":

```markdown
## Bulk data files

- [Data manifest](https://fiscal.ge/downloads/data/manifest.json) — every published file with its row count, byte size and SHA-256.
- [Capability catalogue](https://fiscal.ge/downloads/data/catalogue.json) — the datasets, entities, series and exclusions that exist.
- [Source resolution](https://fiscal.ge/downloads/data/sources.json) — every logical source with its public originals or its stated derivation.
```

The manifest lists the four dataset files, so they are reachable without adding seven links to a guide the spec says must stay concise.

Also extend the existing guidance paragraph so a client knows these carry caveats. Replace:

```markdown
The data is annual, so it does not provide sub-annual or live budget reporting. Fiscal.ge has no public API. Use the published figures only as documented, and do not invent values when data is unavailable or outside the stated scope.
```

with:

```markdown
The data is annual, so it does not provide sub-annual or live budget reporting. Fiscal.ge has no public API; the bulk files below are static publications, not a query service. Each carries its own sources, caveats and coverage — read them before citing a figure. Use the published figures only as documented, and do not invent values when data is unavailable or outside the stated scope.
```

This keeps `/no public API/i` matching, as Part 2 requires.

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/seo/agentFiles.test.ts
```

Expected: PASS, both tests.

- [ ] **Step 5: Correct the spec**

In `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md`, in the §16 "Part 2 — Static publications" block, replace:

```markdown
Only `requiredTargets` in `apps/web/tests/seo/agentFiles.test.ts` needs updating, for the added links.
```

with:

```markdown
Two assertions in `apps/web/tests/seo/agentFiles.test.ts` need updating: `requiredTargets`, for the added links, and the second test's `htmlTargets` filter, which excluded only `/sitemap.xml` and so treated a published `.json` download as an HTML page required to appear in the sitemap. Downloads are files, not routes, and are correctly absent from it.
```

- [ ] **Step 6: Commit**

```bash
git add public/llms.txt tests/seo/agentFiles.test.ts ../../docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md
git commit -m "feat(seo): publish the bulk data files in llms.txt"
```

---

## Task 7: Part 2 completion gate

**Files:**
- Modify: `docs/data-methodology/ai-grounding-and-caveats.md`
- Modify: `.superpowers/sdd/progress.md`

Spec §16 Part 2 gate: "published JSON figures match the explorer for a sampled set of year and category combinations, checked by downloading the file. Manifest hashes and byte counts match the artifacts. `npm run check` and the `agentFiles` test pass."

- [ ] **Step 1: Prove the published figures match the explorer**

The existing `tests/factQuery/agreement.test.ts` proves the query core matches `buildExplorerModel`. The publications are generated by those same query functions, so the remaining risk is the file-writing step, not the numbers. Write that check as a test — append to `apps/web/tests/factQuery/publications.test.ts`:

```ts
describe("the published bytes carry the same figures the query core returns", () => {
  it("matches queryNational for every published revenue observation", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const published = parse(buildDatasetFiles(snapshot)[0]!.bytes);

    const years = [...new Set(snapshot.national.facts.map((f) => f.year))].sort((a, b) => a - b);
    const seriesIds = [...new Set(snapshot.national.facts.filter((f) => f.side === "revenue").map((f) => f.itemId))];
    const direct = queryNational(snapshot, { side: "revenue", seriesIds, years, measure: "amount_gel" });
    const expected = new Map(
      (direct as { data: { observations: { observationId: string; value: number | null }[] } }).data.observations.map(
        (o) => [o.observationId, o.value],
      ),
    );

    expect(published.observations.length).toBe(expected.size);
    for (const observation of published.observations) {
      expect(observation.value, observation.observationId).toBe(expected.get(observation.observationId));
    }
  });
});
```

Add `queryNational` to the test file's imports.

```bash
npx vitest run tests/factQuery/publications.test.ts
```

Expected: PASS.

- [ ] **Step 2: Verify manifest hashes against the written files**

```bash
npm run data:prepare-fact-query-publications >/dev/null && node -e "
const {createHash}=require('node:crypto'), fs=require('node:fs'), p='public/downloads/data/';
const m=JSON.parse(fs.readFileSync(p+'manifest.json','utf8'));
let bad=0;
for(const f of m.files){const b=fs.readFileSync(p+f.fileName);
  const h=createHash('sha256').update(b).digest('hex');
  const ok=h===f.sha256 && b.byteLength===f.byteSize;
  if(!ok)bad++;
  console.log(ok?'OK ':'BAD', f.fileName, b.byteLength, 'bytes');}
console.log(bad===0?'ALL MATCH':'MISMATCHES: '+bad); process.exit(bad?1:0);"
```

Expected: six `OK` lines and `ALL MATCH`, exit 0.

- [ ] **Step 3: Sample-check one published figure by hand against the live explorer**

Pick one municipality, one function, one year present in `municipal-expenditure.json`, and confirm the same number appears in the explorer UI for that selection. Record the entity, series, year and value in the progress note. This is the owner-verifiable gate: "download a JSON and check it matches the explorer."

- [ ] **Step 4: Run the full gate**

```bash
npm run check && npm run build
```

Expected: both exit 0. Record the test-file and test counts.

```bash
npm run test:browser
```

Expected: PASS (set `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` locally).

- [ ] **Step 5: Document the published files**

Append a section to `docs/data-methodology/ai-grounding-and-caveats.md` listing the seven files, their public URLs, what each contains, the licence, and the note that `amount_gel` is published with GDP and population denominators so ratios are reproducible rather than precomputed. Include the measured row counts and byte sizes from Task 3 Step 5.

- [ ] **Step 6: Record progress and commit**

Append a `# Progress — 2026-09-02 fiscal.ge query core (Part 2)` section to `.superpowers/sdd/progress.md` with per-task status, the Task 1 defect and its fix, the measured file sizes, and the Step 3 sample check.

```bash
git add ../../docs/data-methodology/ai-grounding-and-caveats.md ../../.superpowers/sdd/progress.md
git commit -m "docs: close the Part 2 publication gate"
```

---

## Self-review against the spec

| §12 / §16 requirement | Task |
| --- | --- |
| `manifest.json` — version, inventory, URLs, row counts, hashes, byte sizes, licence, generation time | 2 |
| `catalogue.json` — capabilities, entities, series, totals, hierarchy, exclusions | 2 |
| `sources.json` — complete source and document resolution | 2 |
| Four dataset JSON files, self-contained | 3 |
| Only supporting GDP/population needed for allowed ratios; no precomputed rankings | 3 |
| Role, parentage, geographic level explicit; warn that summing all rows is invalid | 3 |
| Source and caveat definitions usable without `llms.txt` | 3 |
| `ministries.json` is a new published dataset, both hierarchy levels | 3 |
| Generated at build time from the Part 1 snapshot; build quotas do not truncate | 4 |
| Correct content types, no `noindex` inheritance | 4 (files sit outside the `/downloads/methodology/…/files/` `noindex` rule; Next serves `.json` as `application/json`) |
| Links beside processed-data links; expenditure links both expenditure and ministries JSON | 5 |
| `Dataset` structured data aligned with published formats | 5 |
| `llms.txt` links manifest, catalogue, sources | 6 |
| "no public API" stays true and unchanged in Part 2 | Global constraint; 6 |
| `agentFiles` assertions updated | 6 |
| Gate: figures match the explorer; manifest hashes match; `check` passes | 7 |

**Carried forward from Part 1, still undecided by the owner:**
- `apps/web/lib/workbookSources.ts:160` — weak `https` check; reviewer confirmed not exploitable.
- 2004 revenue components compare as like-for-like with 2005, so `rank` publishes a 2004→2005 table topped by `revenue.asset_decrease` +476.6%. A data-review judgement, not a code defect.

Neither blocks Part 2. Both should be settled before Part 3 exposes `rank` through MCP.
