# Fiscal.ge Query Core Implementation Plan (Part 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/web/lib/factQuery/` — a pure TypeScript query core that answers seven bounded budget questions from a versioned snapshot, returning figures with their sources and their interpretation caveats.

**Architecture:** A build-time snapshot builder reads the existing served-data loaders and freezes an immutable, content-hashed `FactQuerySnapshot`. The query core takes that snapshot as an argument and does nothing else — no filesystem, no database, no network, no logging. Seven functions return a discriminated-union envelope carrying rows, resolved sources, coverage, and caveats produced by a separate rule-driven caveat engine.

**Tech Stack:** TypeScript (strict), Zod (already a dependency), Vitest, Node crypto for hashing. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` (revision 3.0). Section references below (§n) point there.

## Global Constraints

- **Purity.** `lib/factQuery/` performs no filesystem read, database query, network request, model call, or logging. Every function takes a `FactQuerySnapshot` argument. Enforced by a test in Task 1. (§4.1)
- **No provider SDK.** No AI/model package may be imported anywhere under `lib/factQuery/`. (§13)
- **No data changes.** No reviewed financial value, taxonomy file, Prisma model, or import mapper is modified by Part 1. (§2.2)
- **Georgian labels only.** No `labelEn` field on any entity, series, or program. Only caveat and error messages carry `messageEn`. Municipality `entitySlug` comes from the existing `MUNICIPALITY_ROUTES` and is documented as a URL slug, never a translation. (§10)
- **Money.** Full GEL, never thousands or millions. Preserve reviewed precision. (§5.3)
- **Percentages.** 0–100 scale — `12.5` means 12.5%. Differences in percentage points. Never clamped to 0–100. (§5.3)
- **Missing ≠ zero ≠ excluded.** Three distinct states, tested separately. (§7.4)
- **Excluded municipal codes** `05`, `42`, `43`, `46`, `64` never appear in `rows` under any parameter combination. (§5.4)
- **Shared calculations (spec section 4.2).** Reuse the existing helpers — `chooseActivePublicFacts` from `lib/data/activeFacts`, and the totals and share arithmetic in `lib/explorer/explorerData.ts` and `lib/explorer/municipalData.ts`. Where a formula is needed by both the explorer and the query core, extract only the private arithmetic into a small module with no browser, server, or provider dependency. **Never duplicate a formula in a second model, and never change an existing reviewed figure or alter website behaviour as a side effect.** If an existing calculation appears to conflict with methodology, stop and report it — do not fix it inside this work.
- **Commands** run from `apps/web`: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run check`.
- **Test placement:** `apps/web/tests/factQuery/*.test.ts`. The vitest `parallel` project picks these up automatically via `tests/**/*.test.ts`. Do not add them to `HEAVY_TESTS` or `EXCLUSIVE_TEST`.

---

## File Structure

**Created under `apps/web/lib/factQuery/`:**

| File | Responsibility |
| --- | --- |
| `types.ts` | Snapshot and envelope types. No logic, no imports beyond existing row types. |
| `canonical.ts` | Deterministic JSON canonicalisation and `dataVersion` hashing. |
| `buildSnapshot.ts` | Assembles a snapshot from the served-data loaders. The only file that touches loaders. |
| `sources.ts` | Resolves logical source IDs to public documents. |
| `schemas.ts` | Zod request and response schemas — single source for MCP and any later adapter. |
| `caveats/engine.ts` | Rule type and evaluator. |
| `caveats/rules.national.ts` | National and GDP rules. |
| `caveats/rules.municipal.ts` | Municipal rules. |
| `caveats/rules.ministries.ts` | Ministries, program, and cross-cutting rules. |
| `caveats/index.ts` | Rule registry — the single ordered list. |
| `describeCoverage.ts` · `queryNational.ts` · `queryMinistries.ts` · `queryMunicipal.ts` · `compare.ts` · `rank.ts` · `getSources.ts` | One file per public function. |
| `index.ts` | Public barrel. The only entry point consumers import. |

**Created elsewhere:**

- `apps/web/scripts/prepare-fact-query-snapshot.ts` — `--write` / `--check`, mirroring `scripts/prepare-public-datasets.ts`.
- `apps/web/tests/factQuery/*.test.ts`
- `docs/data-methodology/ai-grounding-and-caveats.md`

**Modified:** `apps/web/package.json` (two scripts), `docs/data-methodology/` index if one exists.

---

### Task 1: Snapshot types and purity guard

**Files:**
- Create: `apps/web/lib/factQuery/types.ts`
- Test: `apps/web/tests/factQuery/purity.test.ts`

**Interfaces:**
- Consumes: `ServedBudgetFact`, `ServedAdminFact`, `ServedNationalGdpFact` from `lib/servedRows`; municipal types from `lib/data/municipal/types`; `AdminSpendingCategory` from `lib/data/taxonomy`.
- Produces: `FactQuerySnapshot`, `Measure`, `Unit`, `Severity`, `Caveat`, `Coverage`, `ResolvedSource`, `FactQueryResponse`.

- [ ] **Step 1: Write the failing purity test**

```ts
// apps/web/tests/factQuery/purity.test.ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DIR = path.join(process.cwd(), "lib", "factQuery");
const FORBIDDEN = [
  /(?:from\s+["'](?:node:)?fs|import\s*\(\s*["'](?:node:)?fs)/,
  /(?:from\s+["'](?:node:)?net|import\s*\(\s*["'](?:node:)?net)/,
  /(?:from\s+["'](?:node:)?https?|import\s*\(\s*["'](?:node:)?https?)/,
  /(?:from\s+["'](?:node:)?child_process|import\s*\(\s*["'](?:node:)?child_process)/,
  /(?:from\s+["'](?:node:)?dns|import\s*\(\s*["'](?:node:)?dns)/,
  /\bfetch\s*\(/,
  /(?:from\s+["'].*\/db\/|import\s*\(\s*["'].*\/db\/)/,
  /(?:from\s+["']@prisma\/|import\s*\(\s*["']@prisma\/)/,
  /(?:from\s+["']@ai-sdk\/|import\s*\(\s*["']@ai-sdk\/)/,
  /(?:from\s+["']ai["']|import\s*\(\s*["']ai["'])/,
  /(?:from\s+["']@anthropic-ai\/|import\s*\(\s*["']@anthropic-ai\/)/,
  /console\.\w+\s*\(/,
];

// node:crypto is deliberately NOT forbidden: it is pure computation, and
// Task 2's dataVersion hashing needs createHash.

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

describe("factQuery purity", () => {
  it("imports no io, database, provider sdk, or logging", async () => {
    const files = (await walk(CORE_DIR)).filter((f) => !f.endsWith("buildSnapshot.ts"));
    expect(files.length).toBeGreaterThan(0);

    const offences: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) offences.push(`${path.basename(file)}: ${pattern}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
```

`buildSnapshot.ts` is excluded because it is the one file allowed to reach the loaders; it is not part of the query path.

- [ ] **Step 2: Run it to see it fail**

Run: `npm run test -- tests/factQuery/purity.test.ts`
Expected: FAIL — `ENOENT` on `lib/factQuery`.

- [ ] **Step 3: Create the types module**

```ts
// apps/web/lib/factQuery/types.ts
import type { ServedAdminFact, ServedBudgetFact, ServedNationalGdpFact } from "../servedRows";
import type { AdminSpendingCategory } from "../data/taxonomy";
import type {
  AdjaraBudgetAdjustment,
  Municipality,
  MunicipalFunction,
  MunicipalFunctionFact,
  MunicipalPopulationFact,
  MunicipalRegion,
  MunicipalTotalFact,
} from "../data/municipal/types";

export const SCHEMA_VERSION = "1.0.0" as const;

/** Municipal codes whose budgets are not territorially attributable (spec section 5.4). */
export const AGGREGATE_ONLY_MUNICIPAL_CODES = ["05", "42", "43", "46", "64"] as const;

export type DatasetId =
  | "national-revenue"
  | "national-expenditure"
  | "ministries"
  | "municipal-expenditure";

export type Measure = "amount_gel" | "share_of_total_pct" | "share_of_gdp_pct" | "gel_per_resident";
export type Unit = "GEL" | "percent" | "GEL_per_resident";
export type Severity = "severe" | "note";
export type Availability = "available" | "missing";

export type BudgetItemMeta = {
  id: string;
  side: "revenue" | "expenditure";
  kaLabel: string;
  sortOrder: number;
};

export type Caveat = {
  code: string;
  severity: Severity;
  messageKa: string;
  messageEn: string;
  methodologyRef: string;
  affects: string[];
};

export type Coverage = {
  requestedYears: number[];
  availableYears: number[];
  returnedYears: number[];
  missingCells: { entityId: string; seriesId: string; year: number; reason: string }[];
  excludedEntities: { entityId: string; reason: string }[];
  returnedCount: number;
  expectedCount: number;
};

export type ResolvedSource = {
  sourceId: string;
  name: string;
  lastReviewedAt: string;
  documents: {
    documentId: string;
    title: string;
    officialUrl: string | null;
    archiveUrl: string | null;
  }[];
};

export type FactQuerySnapshot = {
  schemaVersion: typeof SCHEMA_VERSION;
  dataVersion: string;
  releaseCommit: string;
  generatedAt: string;
  national: { facts: ServedBudgetFact[]; items: BudgetItemMeta[] };
  ministries: {
    facts: ServedAdminFact[];
    categories: AdminSpendingCategory[];
    /** Series with an approved join, from PROGRAM_SUCCESSIONS and LEGACY_PROGRAM_JOINS. */
    historicalJoinSeriesIds: string[];
  };
  municipal: {
    functions: MunicipalFunction[];
    regions: MunicipalRegion[];
    municipalities: Municipality[];
    functionFacts: MunicipalFunctionFact[];
    totalFacts: MunicipalTotalFact[];
    countryFunctionFacts: MunicipalFunctionFact[];
    countryTotalFacts: MunicipalTotalFact[];
    adjaraBudgetAdjustments: AdjaraBudgetAdjustment[];
    populationFacts: MunicipalPopulationFact[];
    slugByCode: Record<string, string>;
  };
  gdpFacts: ServedNationalGdpFact[];
  sources: ResolvedSource[];
};

export type FactQueryError = {
  code: string;
  messageKa: string;
  messageEn: string;
  retryable: boolean;
  validChoices?: string[];
};

export type FactQueryResponse =
  | { kind: "catalogue" | "observations" | "comparisons" | "ranking" | "sources"; status: "ok" | "partial" | "empty"; data: unknown; meta: ResponseMeta }
  | { kind: "error"; status: "error"; error: FactQueryError; meta: ResponseMeta };

/** Fields every snapshot-derived response repeats. */
export type ResponseMeta = {
  schemaVersion: string;
  dataVersion: string;
  releaseCommit: string;
  generatedAt: string;
  licence: "CC BY 4.0";
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/";
  sources: ResolvedSource[];
  caveats: Caveat[];
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- tests/factQuery/purity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/types.ts apps/web/tests/factQuery/purity.test.ts
git commit -m "feat(factQuery): add snapshot types and a purity guard"
```

---

### Task 2: Deterministic dataVersion hashing

**Files:**
- Create: `apps/web/lib/factQuery/canonical.ts`
- Test: `apps/web/tests/factQuery/canonical.test.ts`

**Interfaces:**
- Produces: `canonicalize(value: unknown): string`, `hashDataVersion(payload: unknown): string`.

The hash must ignore `dataVersion`, `releaseCommit`, and `generatedAt` so an unchanged snapshot rebuilt later hashes identically (§4.3).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/tests/factQuery/canonical.test.ts
import { describe, expect, it } from "vitest";
import { canonicalize, hashDataVersion } from "../../lib/factQuery/canonical";

describe("canonicalize", () => {
  it("orders object keys so key order cannot change the hash", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("preserves array order, which is meaningful", () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it("distinguishes null from absent", () => {
    expect(canonicalize({ a: null })).not.toBe(canonicalize({}));
  });
});

describe("hashDataVersion", () => {
  it("is stable across rebuilds that change only volatile fields", () => {
    const first = hashDataVersion({ generatedAt: "2026-01-01T00:00:00Z", releaseCommit: "aaa", dataVersion: "x", rows: [1] });
    const second = hashDataVersion({ generatedAt: "2027-06-06T12:00:00Z", releaseCommit: "bbb", dataVersion: "y", rows: [1] });
    expect(first).toBe(second);
  });

  it("changes when any published value changes", () => {
    const before = hashDataVersion({ rows: [1] });
    const after = hashDataVersion({ rows: [2] });
    expect(before).not.toBe(after);
  });

  it("returns a 64-character lowercase hex digest", () => {
    expect(hashDataVersion({ rows: [] })).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/canonical.test.ts`
Expected: FAIL — cannot resolve `../../lib/factQuery/canonical`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/factQuery/canonical.ts
import { createHash } from "node:crypto";

const VOLATILE_KEYS = new Set(["dataVersion", "releaseCommit", "generatedAt"]);

/**
 * Deterministic JSON. Object keys are sorted; array order is preserved because
 * the served-data loaders already order rows and that order is meaningful.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

/** SHA-256 over canonical content, excluding the three volatile identity fields. */
export function hashDataVersion(payload: unknown): string {
  const stripped =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? Object.fromEntries(Object.entries(payload as Record<string, unknown>).filter(([k]) => !VOLATILE_KEYS.has(k)))
      : payload;

  return createHash("sha256").update(canonicalize(stripped), "utf8").digest("hex");
}
```

`node:crypto` is not in the forbidden list in Task 1 — it is pure computation, not IO.

**Shipped implementation differs from the block above and is authoritative.** Review found two
collisions in it that broke the digest's core contract: `NaN`/`Infinity`/`-Infinity`/`undefined`
all canonicalized to `"null"`, and `Map`/`Set`/`Date` all collapsed to `"{}"` because their
contents live in internal slots that `Object.entries` cannot see. `canonicalize` now **throws**
on any value it cannot represent faithfully, and a shared `isPlainObject` predicate gates both
`canonicalize` and `hashDataVersion`'s volatile-key stripping so a top-level `Map` cannot slip
past. Read `apps/web/lib/factQuery/canonical.ts` for the current code.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/canonical.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/canonical.ts apps/web/tests/factQuery/canonical.test.ts
git commit -m "feat(factQuery): add deterministic dataVersion hashing"
```

---

### Task 3: Snapshot builder

**Files:**
- Create: `apps/web/lib/factQuery/buildSnapshot.ts`
- Test: `apps/web/tests/factQuery/buildSnapshot.test.ts`

**Interfaces:**
- Consumes: `loadServedExplorerData()`, `loadServedMunicipalData()` from `lib/data/servedData`; `MUNICIPALITY_ROUTES` from `lib/explorer/municipalityRoutes`; `hashDataVersion` from Task 2; `FactQuerySnapshot` from Task 1.
- Produces: `buildFactQuerySnapshot(options: { releaseCommit: string; generatedAt: string }): Promise<FactQuerySnapshot>`.

Source resolution is added in Task 4; this task leaves `sources: []`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/factQuery/buildSnapshot.test.ts
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "../../lib/factQuery/types";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-08-28T00:00:00.000Z" };

describe("buildFactQuerySnapshot", () => {
  it("carries the national, ministries, municipal and gdp facts", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);

    expect(snapshot.national.facts.length).toBe(527);
    expect(snapshot.ministries.facts.length).toBe(852);
    expect(snapshot.municipal.functionFacts.length).toBe(7040);
    expect(snapshot.municipal.totalFacts.length).toBe(704);
    expect(snapshot.gdpFacts.length).toBe(30);
  });

  it("exposes a url slug for every municipality and none for excluded codes", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);

    expect(Object.keys(snapshot.municipal.slugByCode)).toHaveLength(64);
    expect(snapshot.municipal.slugByCode["11"]).toBe("khulo");
    for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) {
      expect(snapshot.municipal.slugByCode[code]).toBeUndefined();
    }
  });

  it("hashes identically when only the volatile fields differ", async () => {
    const first = await buildFactQuerySnapshot(OPTIONS);
    const second = await buildFactQuerySnapshot({ releaseCommit: "other", generatedAt: "2030-01-01T00:00:00.000Z" });

    expect(second.dataVersion).toBe(first.dataVersion);
    expect(first.dataVersion).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/buildSnapshot.test.ts`
Expected: FAIL — cannot resolve `buildSnapshot`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/factQuery/buildSnapshot.ts
//
// The ONE file in lib/factQuery/ permitted to reach the served-data loaders.
// Everything else takes the finished snapshot as an argument. tests/factQuery/
// purity.test.ts excludes this file for exactly that reason.
import { loadServedExplorerData, loadServedMunicipalData } from "../data/servedData";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { PROGRAM_SUCCESSIONS } from "../data/adminSpending/programSuccessions";
import { LEGACY_PROGRAM_JOINS } from "../data/adminSpending/legacyProgramJoins";
import { hashDataVersion } from "./canonical";
import { SCHEMA_VERSION, type BudgetItemMeta, type FactQuerySnapshot } from "./types";

export type BuildSnapshotOptions = { releaseCommit: string; generatedAt: string };

/**
 * Item ids of the series that carry an approved historical join. Both
 * PROGRAM_SUCCESSIONS and LEGACY_PROGRAM_JOINS key on `targetCode`, which is a
 * tavi-VI program CODE, not an item id. Resolve codes to ids through the served
 * facts' officialCode rather than by string-building an id.
 */
function joinedSeriesIds(adminFacts: ServedAdminFact[]): string[] {
  const joinedCodes = new Set([
    ...PROGRAM_SUCCESSIONS.map((entry) => entry.targetCode),
    ...LEGACY_PROGRAM_JOINS.map((entry) => entry.targetCode),
  ]);

  const ids = new Set<string>();
  for (const fact of adminFacts) {
    if (fact.level !== "major_program") continue;
    const code = officialCodeOf(fact);
    if (code !== null && joinedCodes.has(code)) ids.add(fact.itemId);
  }
  return [...ids].sort();
}

export async function buildFactQuerySnapshot(options: BuildSnapshotOptions): Promise<FactQuerySnapshot> {
  const [explorer, municipal] = await Promise.all([loadServedExplorerData(), loadServedMunicipalData()]);

  const items: BudgetItemMeta[] = Array.from(explorer.glossary.entries())
    .map(([id, entry]) => ({
      id,
      side: id.startsWith("revenue.") ? ("revenue" as const) : ("expenditure" as const),
      kaLabel: entry.kaLabel,
      sortOrder: entry.sortOrder ?? 0,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const slugByCode = Object.fromEntries(MUNICIPALITY_ROUTES.map(({ code, slug }) => [code, slug]));

  const content = {
    schemaVersion: SCHEMA_VERSION,
    national: { facts: explorer.facts, items },
    ministries: {
      facts: explorer.adminFacts,
      categories: explorer.adminCategories,
      historicalJoinSeriesIds: joinedSeriesIds(explorer.adminFacts),
    },
    municipal: {
      functions: municipal.functions,
      regions: municipal.regions,
      municipalities: municipal.municipalities,
      functionFacts: municipal.functionFacts,
      totalFacts: municipal.totalFacts,
      countryFunctionFacts: municipal.countryFunctionFacts,
      countryTotalFacts: municipal.countryTotalFacts,
      adjaraBudgetAdjustments: municipal.adjaraBudgetAdjustments,
      populationFacts: municipal.populationFacts,
      slugByCode,
    },
    gdpFacts: explorer.gdpFacts,
    sources: [],
  };

  return {
    ...content,
    dataVersion: hashDataVersion(content),
    releaseCommit: options.releaseCommit,
    generatedAt: options.generatedAt,
  };
}
```

Two things to resolve while implementing, both by reading the code rather than guessing:

1. If `GlossaryEntry` has no `sortOrder`, drop the `?? 0` and read the field the type actually exposes.
2. `ServedAdminFact` (`lib/servedRows.ts`) does **not** expose `officialCode` — only `officialLabelKa` and `officialInstitutionLabelKa`. Find how `lib/data/adminSpending/generateAdminSpendingFacts.ts` maps a `targetCode` to an `itemId` and reuse that mapping in `joinedSeriesIds`, replacing the `officialCodeOf(fact)` placeholder. Then assert the result is non-empty and every entry appears in the served facts:

```ts
it("resolves historical join series to real served item ids", async () => {
  const snapshot = await buildFactQuerySnapshot(OPTIONS);
  const served = new Set(snapshot.ministries.facts.map((f) => f.itemId));

  expect(snapshot.ministries.historicalJoinSeriesIds.length).toBeGreaterThan(0);
  for (const id of snapshot.ministries.historicalJoinSeriesIds) expect(served.has(id)).toBe(true);
});
```

If no mapping exists, report BLOCKED rather than inventing one — `program_historical_join` firing on the wrong series is worse than not firing.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/buildSnapshot.test.ts && npm run typecheck`
Expected: PASS, 3 tests; typecheck clean.

If a row count assertion fails, do **not** edit the expected number — the spec's §3 counts are verified at baseline `b9704ff05`. Investigate what changed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/buildSnapshot.ts apps/web/tests/factQuery/buildSnapshot.test.ts
git commit -m "feat(factQuery): build a content-hashed snapshot from served data"
```

---

### Task 4: Public source resolver

**Files:**
- Create: `apps/web/lib/factQuery/sources.ts`
- Modify: `apps/web/lib/factQuery/buildSnapshot.ts` (populate `sources`)
- Test: `apps/web/tests/factQuery/sources.test.ts`

**Interfaces:**
- Consumes: `loadWorkbookSources`, `loadGdpWorkbookSources` from `lib/methodology/workbookSources`; `SourceDocumentRow` from the explorer load.
- Produces: `resolvePublicSources(input): ResolvedSource[]`, `selectSources(snapshot, sourceIds): ResolvedSource[]`.

**Why this exists:** every `source_url_or_file` in `data/sources/source-documents.csv` is an internal repository path and 32 are `+`-joined multi-file values. There is no URL to return directly (§8.1).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/factQuery/sources.test.ts
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { selectSources } from "../../lib/factQuery/sources";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-08-28T00:00:00.000Z" };

describe("public source resolution", () => {
  it("never emits an internal repository path as a public url", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expect(snapshot.sources.length).toBeGreaterThan(0);

    for (const source of snapshot.sources) {
      for (const document of source.documents) {
        for (const url of [document.officialUrl, document.archiveUrl]) {
          if (url === null) continue;
          expect(url).toMatch(/^https:\/\//);
          expect(url).not.toContain("docs/Raw Data");
        }
      }
    }
  });

  it("never emits a sentinel source id", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    for (const source of snapshot.sources) {
      expect(source.sourceId).not.toMatch(/^mixed:/);
      expect(source.sourceId.length).toBeGreaterThan(0);
    }
  });

  it("resolves every source id referenced by a served national fact", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const known = new Set(snapshot.sources.map((s) => s.sourceId));
    const referenced = new Set(snapshot.national.facts.flatMap((f) => f.sourceId.split(";").map((s) => s.trim())));

    expect([...referenced].filter((id) => !known.has(id))).toEqual([]);
  });

  it("returns only the requested sources, deduplicated and ordered", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const target = snapshot.sources[0]!.sourceId;

    const selected = selectSources(snapshot, [target, target, "source.does_not_exist"]);
    expect(selected.map((s) => s.sourceId)).toEqual([target]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/sources.test.ts`
Expected: FAIL — cannot resolve `sources`.

- [ ] **Step 3: Implement the pure selector and the build-time resolver**

```ts
// apps/web/lib/factQuery/sources.ts
import type { FactQuerySnapshot, ResolvedSource } from "./types";

/**
 * Pure lookup used by the query path. Unknown ids are dropped, not invented:
 * getSources reports them as a structured error instead (spec section 6.8).
 */
export function selectSources(snapshot: FactQuerySnapshot, sourceIds: readonly string[]): ResolvedSource[] {
  const byId = new Map(snapshot.sources.map((source) => [source.sourceId, source]));
  const seen = new Set<string>();
  const out: ResolvedSource[] = [];

  for (const id of sourceIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const found = byId.get(id);
    if (found) out.push(found);
  }

  return out.sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
}

/** Expand a `;`-joined source cell into its constituent logical ids. */
export function splitSourceIds(raw: string): string[] {
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
```

Then in `buildSnapshot.ts`, replace `sources: []` with a resolver that maps each `SourceDocumentRow` to a `ResolvedSource`, pulling public URLs from `loadWorkbookSources` / `loadGdpWorkbookSources` (which validate `retrieved_file_url` as `https://` and expose `downloadHref`). Add near the top:

```ts
import { loadGdpWorkbookSources, loadWorkbookSources } from "../methodology/workbookSources";
import { splitSourceIds } from "./sources";
```

and build the array before `content`:

```ts
  const workbookSources = [
    ...(await loadWorkbookSources("expenditure", "expenditure-fields")),
    ...(await loadWorkbookSources("expenditure", "expenditure-ministries")),
    ...(await loadWorkbookSources("revenue", "revenue")),
    ...(await loadWorkbookSources("municipalities", "municipal-functional")),
    ...(await loadWorkbookSources("municipalities", "municipal-total")),
    ...(await loadGdpWorkbookSources()),
  ];

  const documentsBySourceId = new Map<string, ResolvedSource["documents"]>();
  for (const entry of workbookSources) {
    for (const id of splitSourceIds(entry.sourceId)) {
      const list = documentsBySourceId.get(id) ?? [];
      list.push({
        documentId: entry.archiveId,
        title: entry.title,
        officialUrl: entry.officialUrl ?? null,
        archiveUrl: entry.downloadHref ?? null,
      });
      documentsBySourceId.set(id, list);
    }
  }

  const sources: ResolvedSource[] = explorer.sourceDocuments
    .map((row) => ({
      sourceId: row.id,
      name: row.sourceName,
      lastReviewedAt: row.lastReviewedAt,
      documents: documentsBySourceId.get(row.id) ?? [],
    }))
    .sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
```

Field names on `WorkbookPublicSource` (`archiveId`, `title`, `officialUrl`, `downloadHref`, `sourceId`) must be confirmed against `lib/explorer/workbookModel.ts`; adjust to the actual property names and re-run typecheck. Do not invent a URL for any source that has none — leave `null`.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/sources.test.ts && npm run typecheck`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/sources.ts apps/web/lib/factQuery/buildSnapshot.ts apps/web/tests/factQuery/sources.test.ts
git commit -m "feat(factQuery): resolve logical source ids to public documents"
```

---

### Task 5: Snapshot generation script wired into data:validate

**Files:**
- Create: `apps/web/scripts/prepare-fact-query-snapshot.ts`
- Modify: `apps/web/package.json`
- Test: `apps/web/tests/factQuery/snapshotScript.test.ts`

**Interfaces:**
- Produces: `npm run data:prepare-fact-query-snapshot` (`--write`) and `data:check-fact-query-snapshot` (`--check`), mirroring `scripts/prepare-public-datasets.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/factQuery/snapshotScript.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("fact query snapshot script", () => {
  it("is registered in both the prepare and validate chains", async () => {
    const pkg = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));

    expect(pkg.scripts["data:prepare-fact-query-snapshot"]).toContain("prepare-fact-query-snapshot.ts");
    expect(pkg.scripts["data:check-fact-query-snapshot"]).toContain("--check");
    expect(pkg.scripts["data:validate"]).toContain("data:check-fact-query-snapshot");
    expect(pkg.scripts.prebuild).toContain("data:prepare-fact-query-snapshot");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/snapshotScript.test.ts`
Expected: FAIL — `expect(undefined).toContain(...)`.

- [ ] **Step 3: Create the script and register it**

```ts
// apps/web/scripts/prepare-fact-query-snapshot.ts
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactQuerySnapshot } from "../lib/factQuery/buildSnapshot";

const OUTPUT = path.join(process.cwd(), "lib", "factQuery", "generated", "snapshot.json");

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

  if (write) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${OUTPUT} dataVersion=${snapshot.dataVersion}\n`);
    return;
  }

  const existing = JSON.parse(await readFile(OUTPUT, "utf8"));
  if (existing.dataVersion !== snapshot.dataVersion) {
    throw new Error(
      `Snapshot is stale: committed dataVersion ${existing.dataVersion} != rebuilt ${snapshot.dataVersion}. Run npm run data:prepare-fact-query-snapshot.`,
    );
  }
  process.stdout.write(`snapshot current dataVersion=${snapshot.dataVersion}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
```

In `package.json`, add:

```json
"data:prepare-fact-query-snapshot": "tsx scripts/prepare-fact-query-snapshot.ts --write",
"data:check-fact-query-snapshot": "tsx scripts/prepare-fact-query-snapshot.ts --check",
```

Append ` && npm run data:check-fact-query-snapshot` to `data:validate`, and ` && npm run data:prepare-fact-query-snapshot` to both `prebuild` and `predev`.

- [ ] **Step 4: Generate, verify, and confirm the check catches staleness**

```bash
npm run data:prepare-fact-query-snapshot
npm run data:check-fact-query-snapshot
npm run test -- tests/factQuery/snapshotScript.test.ts
```

Expected: write prints a `dataVersion`; check prints `snapshot current`; test PASSes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/prepare-fact-query-snapshot.ts apps/web/package.json apps/web/lib/factQuery/generated/snapshot.json apps/web/tests/factQuery/snapshotScript.test.ts
git commit -m "feat(factQuery): generate and gate the snapshot artifact"
```

---

### Task 6: Response envelope and Zod schemas

**Files:**
- Create: `apps/web/lib/factQuery/schemas.ts`
- Test: `apps/web/tests/factQuery/schemas.test.ts`

**Interfaces:**
- Produces: `observationSchema`, `envelopeSchema`, `errorCodeSchema`, `queryNationalInput`, `queryMinistriesInput`, `queryMunicipalInput`, `compareInput`, `rankInput`, `getSourcesInput`, `describeCoverageInput`, plus inferred TypeScript types. This module is the single source from which MCP JSON Schema is later derived (§7.1).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/factQuery/schemas.test.ts
import { describe, expect, it } from "vitest";
import { envelopeSchema, queryNationalInput } from "../../lib/factQuery/schemas";

describe("query input schemas", () => {
  it("normalizes years to unique ascending order", () => {
    const parsed = queryNationalInput.parse({
      side: "revenue",
      seriesIds: ["revenue.vat", "revenue.vat"],
      years: [2020, 2018, 2020],
      measure: "amount_gel",
    });
    expect(parsed.years).toEqual([2018, 2020]);
    expect(parsed.seriesIds).toEqual(["revenue.vat"]);
  });

  it("rejects an empty year list", () => {
    expect(() => queryNationalInput.parse({ side: "revenue", seriesIds: ["revenue.vat"], years: [], measure: "amount_gel" })).toThrow();
  });

  it("rejects gel_per_resident for national data", () => {
    expect(() =>
      queryNationalInput.parse({ side: "revenue", seriesIds: ["revenue.vat"], years: [2020], measure: "gel_per_resident" }),
    ).toThrow();
  });
});

describe("envelope schema", () => {
  it("requires an error when status is error", () => {
    expect(() => envelopeSchema.parse({ kind: "error", status: "error", meta: null })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/schemas.test.ts`
Expected: FAIL — cannot resolve `schemas`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/factQuery/schemas.ts
import { z } from "zod";

const uniqueSortedYears = z
  .array(z.number().int())
  .min(1, "years must not be empty")
  .transform((years) => Array.from(new Set(years)).sort((a, b) => a - b));

const uniqueIds = z.array(z.string().min(1)).min(1).transform((ids) => Array.from(new Set(ids)));

export const expectedDataVersion = z.string().regex(/^[0-9a-f]{64}$/).optional();

const nationalMeasure = z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct"]);
const municipalMeasure = z.enum(["amount_gel", "share_of_total_pct", "gel_per_resident"]);

export const describeCoverageInput = z.object({
  datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"]).optional(),
  search: z.string().max(120).optional(),
  entityType: z.enum(["country", "municipality", "region"]).optional(),
  level: z.enum(["admin_category", "major_program"]).optional(),
  expectedDataVersion,
});

export const queryNationalInput = z.object({
  side: z.enum(["revenue", "expenditure"]),
  seriesIds: uniqueIds,
  years: uniqueSortedYears,
  measure: nationalMeasure,
  expectedDataVersion,
});

export const queryMinistriesInput = z.object({
  level: z.enum(["admin_category", "major_program"]),
  seriesIds: uniqueIds,
  years: uniqueSortedYears,
  measure: nationalMeasure,
  expectedDataVersion,
});

export const queryMunicipalInput = z.object({
  entityIds: uniqueIds,
  seriesIds: uniqueIds,
  years: uniqueSortedYears,
  measure: municipalMeasure,
  expectedDataVersion,
});

export const compareInput = z
  .object({
    target: z.discriminatedUnion("dataset", [
      z.object({ dataset: z.literal("national"), side: z.enum(["revenue", "expenditure"]), seriesIds: uniqueIds }),
      z.object({ dataset: z.literal("ministries"), level: z.enum(["admin_category", "major_program"]), seriesIds: uniqueIds }),
      z.object({ dataset: z.literal("municipal"), entityIds: uniqueIds, seriesIds: uniqueIds }),
    ]),
    fromYear: z.number().int(),
    toYear: z.number().int(),
    measure: z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct", "gel_per_resident"]),
    expectedDataVersion,
  })
  .refine((input) => input.fromYear < input.toYear, { message: "fromYear must be earlier than toYear" });

export const rankInput = z
  .object({
    datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"]),
    dimension: z.enum(["series", "entities"]),
    level: z.enum(["admin_category", "major_program"]).optional(),
    parentSeriesId: z.string().optional(),
    entityType: z.enum(["municipality", "region"]).optional(),
    seriesId: z.string().optional(),
    withinRegionId: z.string().optional(),
    year: z.number().int().optional(),
    fromYear: z.number().int().optional(),
    toYear: z.number().int().optional(),
    measure: z.enum(["amount_gel", "share_of_total_pct", "share_of_gdp_pct", "gel_per_resident"]),
    metric: z.enum(["value", "absolute_change", "percentage_change", "percentage_point_change"]),
    order: z.enum(["descending", "ascending"]).default("descending"),
    limit: z.number().int().min(1).max(100).default(10),
    expectedDataVersion,
  })
  .refine((input) => (input.metric === "value" ? input.year !== undefined : input.fromYear !== undefined && input.toYear !== undefined), {
    message: "value ranking needs one year; change rankings need fromYear and toYear",
  });

export const getSourcesInput = z.object({
  sourceIds: uniqueIds,
  datasetId: z.enum(["national-revenue", "national-expenditure", "ministries", "municipal-expenditure"]).optional(),
  years: z.array(z.number().int()).optional(),
  entityIds: z.array(z.string()).optional(),
  expectedDataVersion,
});

export const errorCodeSchema = z.enum([
  "invalid_parameters",
  "unknown_dataset",
  "unknown_series",
  "unknown_entity",
  "unknown_source",
  "year_out_of_range",
  "unsupported_measure",
  "unsupported_comparison",
  "result_too_large",
  "data_version_changed",
  "rate_limited",
  "service_unavailable",
]);

export const caveatSchema = z.object({
  code: z.string(),
  severity: z.enum(["severe", "note"]),
  messageKa: z.string().min(1),
  messageEn: z.string().min(1),
  methodologyRef: z.string(),
  affects: z.array(z.string()),
});

export const observationSchema = z.object({
  observationId: z.string(),
  datasetId: z.string(),
  budgetScope: z.string(),
  entityId: z.string(),
  entityType: z.enum(["country", "municipality", "region"]),
  entityLabelKa: z.string(),
  entitySlug: z.string().nullable(),
  seriesId: z.string(),
  seriesLabelKa: z.string(),
  level: z.string(),
  parentSeriesId: z.string().nullable(),
  year: z.number().int(),
  measure: z.string(),
  unit: z.enum(["GEL", "percent", "GEL_per_resident"]),
  value: z.number().finite().nullable(),
  availability: z.enum(["available", "missing"]),
  missingReason: z.string().nullable(),
  basis: z.enum(["actual", "planned"]).nullable(),
  valueDefinition: z.string(),
  sourceIds: z.array(z.string()),
  documentIds: z.array(z.string()),
  caveatIds: z.array(z.string()),
});

export const envelopeSchema = z.discriminatedUnion("status", [
  z.object({
    kind: z.enum(["catalogue", "observations", "comparisons", "ranking", "sources"]),
    status: z.enum(["ok", "partial", "empty"]),
    data: z.unknown(),
    meta: z.object({}).passthrough(),
  }),
  z.object({
    kind: z.literal("error"),
    status: z.literal("error"),
    error: z.object({
      code: errorCodeSchema,
      messageKa: z.string().min(1),
      messageEn: z.string().min(1),
      retryable: z.boolean(),
      validChoices: z.array(z.string()).optional(),
    }),
    meta: z.object({}).passthrough(),
  }),
]);

export type QueryNationalInput = z.infer<typeof queryNationalInput>;
export type QueryMinistriesInput = z.infer<typeof queryMinistriesInput>;
export type QueryMunicipalInput = z.infer<typeof queryMunicipalInput>;
export type CompareInput = z.infer<typeof compareInput>;
export type RankInput = z.infer<typeof rankInput>;
export type GetSourcesInput = z.infer<typeof getSourcesInput>;
export type DescribeCoverageInput = z.infer<typeof describeCoverageInput>;
```

The measure enums are narrowed per function, which is how "reject `gel_per_resident` for national" is enforced at parse time rather than in each function body.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/schemas.test.ts && npm run typecheck`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/schemas.ts apps/web/tests/factQuery/schemas.test.ts
git commit -m "feat(factQuery): add zod request and response schemas"
```

---

### Task 7: Caveat engine core

**Files:**
- Create: `apps/web/lib/factQuery/caveats/engine.ts`, `apps/web/lib/factQuery/caveats/index.ts`
- Test: `apps/web/tests/factQuery/caveats/engine.test.ts`

**Interfaces:**
- Produces: `CaveatRule`, `CaveatContext`, `evaluateCaveats(context, rules): Caveat[]`, `CAVEAT_RULES` (empty in this task; filled in Tasks 8–10).

**Critical:** the context carries quality state, not display flags. Revision 1.0 keyed on `showWarning` and would have served Khulo 2024's fallback figure with no warning, because that row has `showWarning=false` with `warningType="source_actual_missing"` (§9.1).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/factQuery/caveats/engine.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext, type CaveatRule } from "../../../lib/factQuery/caveats/engine";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";

const BASE: CaveatContext = {
  datasetId: "national-revenue",
  measure: "amount_gel",
  years: [2020],
  seriesIds: [],
  entityIds: [],
  observations: [],
  municipalTotalInputs: [],
  gdpInputs: [],
  comparison: null,
};

describe("evaluateCaveats", () => {
  it("returns only rules whose predicate holds", () => {
    const rules: CaveatRule[] = [
      { code: "fires", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => ["a"] },
      { code: "quiet", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => false, affects: () => [] },
    ];
    expect(evaluateCaveats(BASE, rules).map((c) => c.code)).toEqual(["fires"]);
  });

  it("orders severe before note, then by code", () => {
    const rules: CaveatRule[] = [
      { code: "b_note", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] },
      { code: "a_severe", severity: "severe", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] },
    ];
    expect(evaluateCaveats(BASE, rules).map((c) => c.code)).toEqual(["a_severe", "b_note"]);
  });

  it("emits each code at most once", () => {
    const rule: CaveatRule = { code: "dup", severity: "note", messageKa: "კ", messageEn: "e", methodologyRef: "x", applies: () => true, affects: () => [] };
    expect(evaluateCaveats(BASE, [rule, rule])).toHaveLength(1);
  });
});

describe("CAVEAT_RULES registry", () => {
  it("has unique codes and non-empty bilingual messages", () => {
    const codes = CAVEAT_RULES.map((rule) => rule.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const rule of CAVEAT_RULES) {
      expect(rule.messageKa.length).toBeGreaterThan(0);
      expect(rule.messageEn.length).toBeGreaterThan(0);
      expect(rule.methodologyRef.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/caveats/engine.test.ts`
Expected: FAIL — cannot resolve `caveats/engine`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/factQuery/caveats/engine.ts
import type { Caveat, DatasetId, Measure, Severity } from "../types";
import type { MunicipalTotalFact, ServedNationalGdpFact } from "../types";

/**
 * Everything a rule may inspect. Deliberately includes the raw quality state of
 * contributing inputs — NOT just the rows that will be displayed, and never
 * `showWarning` alone. Khulo 2024 carries warningType "source_actual_missing"
 * with showWarning false; a display-flag rule would miss it entirely.
 */
export type CaveatContext = {
  datasetId: DatasetId;
  measure: Measure;
  years: number[];
  seriesIds: string[];
  entityIds: string[];
  observations: { entityId: string; seriesId: string; year: number; value: number | null; basis: "actual" | "planned" | null }[];
  municipalTotalInputs: MunicipalTotalFact[];
  gdpInputs: ServedNationalGdpFact[];
  comparison: { fromYear: number; toYear: number; fromDefinition: string; toDefinition: string } | null;
  /** Series carrying an approved succession or legacy join. Only these get program_historical_join. */
  historicalJoinSeriesIds: string[];
};

export type CaveatRule = {
  code: string;
  severity: Severity;
  messageKa: string;
  messageEn: string;
  methodologyRef: string;
  applies: (context: CaveatContext) => boolean;
  affects: (context: CaveatContext) => string[];
};

const SEVERITY_ORDER: Record<Severity, number> = { severe: 0, note: 1 };

export function evaluateCaveats(context: CaveatContext, rules: readonly CaveatRule[]): Caveat[] {
  const emitted = new Map<string, Caveat>();

  for (const rule of rules) {
    if (emitted.has(rule.code)) continue;
    if (!rule.applies(context)) continue;
    emitted.set(rule.code, {
      code: rule.code,
      severity: rule.severity,
      messageKa: rule.messageKa,
      messageEn: rule.messageEn,
      methodologyRef: rule.methodologyRef,
      affects: rule.affects(context),
    });
  }

  return Array.from(emitted.values()).sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}
```

```ts
// apps/web/lib/factQuery/caveats/index.ts
import type { CaveatRule } from "./engine";

/** The single ordered rule list. Tasks 8-10 fill it; spec section 9.2 is the contract. */
export const CAVEAT_RULES: readonly CaveatRule[] = [];

export { evaluateCaveats } from "./engine";
export type { CaveatContext, CaveatRule } from "./engine";
```

Re-export `MunicipalTotalFact` and `ServedNationalGdpFact` from `types.ts` so `engine.ts` stays free of deep import paths.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/caveats/engine.test.ts && npm run typecheck`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/caveats apps/web/lib/factQuery/types.ts apps/web/tests/factQuery/caveats/engine.test.ts
git commit -m "feat(factQuery): add the caveat rule engine"
```

---

### Task 8: National and GDP caveat rules

**Files:**
- Create: `apps/web/lib/factQuery/caveats/rules.national.ts`
- Modify: `apps/web/lib/factQuery/caveats/index.ts`
- Test: `apps/web/tests/factQuery/caveats/national.test.ts`

**Interfaces:**
- Produces: `NATIONAL_CAVEAT_RULES` covering `nominal_gel`, `planned_values`, `revenue_2004_total_scope`, `revenue_2004_liabilities_unavailable`, `budget_scopes_differ`, `negative_revenue_correction`, `revenue_internal_flows_netted`, `gdp_sna_break_2010`, `gdp_preliminary`.

Every rule needs a **firing** and a **non-firing** test (§9.1).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/tests/factQuery/caveats/national.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { NATIONAL_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.national";

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
    datasetId: "national-revenue",
    measure: "amount_gel",
    years: [2020],
    seriesIds: [],
    entityIds: [],
    observations: [],
    municipalTotalInputs: [],
    gdpInputs: [],
    comparison: null,
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, NATIONAL_CAVEAT_RULES).map((c) => c.code);

describe("nominal_gel", () => {
  it("fires for a multi-year GEL request", () => {
    expect(codes(context({ years: [2018, 2020] }))).toContain("nominal_gel");
  });
  it("does not fire for a single year", () => {
    expect(codes(context({ years: [2020] }))).not.toContain("nominal_gel");
  });
  it("does not fire for a percentage measure", () => {
    expect(codes(context({ years: [2018, 2020], measure: "share_of_gdp_pct" }))).not.toContain("nominal_gel");
  });
});

describe("revenue_2004_total_scope", () => {
  it("fires when a 2004 revenue total is requested", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.total"] }))).toContain("revenue_2004_total_scope");
  });
  it("does NOT fire for an individual 2004 tax category", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.vat"] }))).not.toContain("revenue_2004_total_scope");
  });
});

describe("revenue_2004_liabilities_unavailable", () => {
  it("fires when 2004 liabilities are requested", () => {
    expect(codes(context({ years: [2004], seriesIds: ["revenue.increase_liabilities"] }))).toContain(
      "revenue_2004_liabilities_unavailable",
    );
  });
  it("does not fire for 2005 liabilities", () => {
    expect(codes(context({ years: [2005], seriesIds: ["revenue.increase_liabilities"] }))).not.toContain(
      "revenue_2004_liabilities_unavailable",
    );
  });
});

describe("budget_scopes_differ", () => {
  it("fires for a national total on either side", () => {
    expect(codes(context({ seriesIds: ["revenue.total"] }))).toContain("budget_scopes_differ");
    expect(codes(context({ datasetId: "national-expenditure", seriesIds: ["expenditure.total"] }))).toContain("budget_scopes_differ");
  });
  it("does not fire for a category", () => {
    expect(codes(context({ seriesIds: ["revenue.vat"] }))).not.toContain("budget_scopes_differ");
  });
});

describe("gdp caveats", () => {
  it("gdp_sna_break_2010 fires across the standard change", () => {
    const ctx = context({
      measure: "share_of_gdp_pct",
      years: [2009, 2010],
      gdpInputs: [
        { year: 2009, gdpCurrentPricesGel: 1, accountingStandard: "sna_1993", status: "final_as_published", sourceId: "s" },
        { year: 2010, gdpCurrentPricesGel: 1, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "s" },
      ],
    });
    expect(codes(ctx)).toContain("gdp_sna_break_2010");
  });

  it("gdp_sna_break_2010 does NOT fire for 2010 alone", () => {
    const ctx = context({
      measure: "share_of_gdp_pct",
      years: [2010],
      gdpInputs: [{ year: 2010, gdpCurrentPricesGel: 1, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "s" }],
    });
    expect(codes(ctx)).not.toContain("gdp_sna_break_2010");
  });

  it("gdp_preliminary fires when a denominator is preliminary", () => {
    const ctx = context({
      measure: "share_of_gdp_pct",
      years: [2025],
      gdpInputs: [{ year: 2025, gdpCurrentPricesGel: 1, accountingStandard: "sna_2008", status: "preliminary", sourceId: "s" }],
    });
    expect(codes(ctx)).toContain("gdp_preliminary");
  });
});

describe("value-driven rules", () => {
  it("negative_revenue_correction fires on a negative observation", () => {
    const ctx = context({ observations: [{ entityId: "country.georgia", seriesId: "revenue.other_revenue", year: 2020, value: -5, basis: "actual" }] });
    expect(codes(ctx)).toContain("negative_revenue_correction");
  });
  it("does not fire when all values are non-negative", () => {
    const ctx = context({ observations: [{ entityId: "country.georgia", seriesId: "revenue.vat", year: 2020, value: 5, basis: "actual" }] });
    expect(codes(ctx)).not.toContain("negative_revenue_correction");
  });
  it("planned_values fires when any returned basis is planned", () => {
    const ctx = context({ observations: [{ entityId: "country.georgia", seriesId: "revenue.vat", year: 2026, value: 5, basis: "planned" }] });
    expect(codes(ctx)).toContain("planned_values");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/caveats/national.test.ts`
Expected: FAIL — cannot resolve `rules.national`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/factQuery/caveats/rules.national.ts
import type { CaveatRule } from "./engine";

const NATIONAL_TOTAL_IDS = new Set(["revenue.total", "expenditure.total"]);
const LIABILITIES_ID = "revenue.increase_liabilities";
const NETTED_REVENUE_IDS = new Set(["revenue.grants", "revenue.other_revenue"]);

export const NATIONAL_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "nominal_gel",
    severity: "note",
    messageKa: "თანხები ნომინალურ ლარშია, მიმდინარე ფასებში; ინფლაციაზე კორექტირებული არ არის.",
    messageEn: "Amounts are nominal GEL at current prices and are not adjusted for inflation.",
    methodologyRef: "ai-grounding-and-caveats.md#nominal_gel",
    applies: (c) => c.measure === "amount_gel" && c.years.length > 1,
    affects: (c) => c.seriesIds,
  },
  {
    code: "planned_values",
    severity: "severe",
    messageKa: "შედეგი შეიცავს გეგმურ (და არა ფაქტობრივ) მაჩვენებელს.",
    messageEn: "The result contains planned rather than actual values.",
    methodologyRef: "ai-grounding-and-caveats.md#planned_values",
    applies: (c) => c.observations.some((o) => o.basis === "planned"),
    affects: (c) => c.observations.filter((o) => o.basis === "planned").map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "revenue_2004_total_scope",
    severity: "severe",
    messageKa: "2004 წლის შემოსავლების ჯამი უფრო ვიწრო მოცულობისაა: ვალდებულებების ზრდა მიუწვდომელია.",
    messageEn: "The 2004 receipts total has narrower coverage: increase in liabilities is unavailable.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.years.includes(2004) && c.seriesIds.some((id) => NATIONAL_TOTAL_IDS.has(id)),
    affects: () => ["2004"],
  },
  {
    code: "revenue_2004_liabilities_unavailable",
    severity: "severe",
    messageKa: "2004 წლისთვის ვალდებულებების ზრდა მიუწვდომელია — ის ნული არ არის.",
    messageEn: "Increase in liabilities is unavailable for 2004. It is not zero.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.years.includes(2004) && c.seriesIds.includes(LIABILITIES_ID),
    affects: () => [`${LIABILITIES_ID}:2004`],
  },
  {
    code: "budget_scopes_differ",
    severity: "severe",
    messageKa: "ეროვნული შემოსავლებისა და ხარჯების ჯამები სხვადასხვა საბიუჯეტო მოცულობას ეყრდნობა; მათი გამოკლებით დეფიციტი არ დგინდება.",
    messageEn: "National revenue and expenditure totals use different budget concepts; subtracting them does not establish a deficit.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.seriesIds.some((id) => NATIONAL_TOTAL_IDS.has(id)),
    affects: (c) => c.seriesIds.filter((id) => NATIONAL_TOTAL_IDS.has(id)),
  },
  {
    code: "negative_revenue_correction",
    severity: "note",
    messageKa: "უარყოფითი მნიშვნელობა გადამოწმებული კორექციაა და არა დაკარგული მონაცემი.",
    messageEn: "A negative value is a reviewed correction, not missing or invalid data.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.observations.some((o) => o.value !== null && o.value < 0),
    affects: (c) => c.observations.filter((o) => o.value !== null && o.value < 0).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "revenue_internal_flows_netted",
    severity: "note",
    messageKa: "შერჩეული მუხლი შიდა ნაკადების დოკუმენტირებულ ნეტირებას იყენებს.",
    messageEn: "The selected item uses the documented netting of internal flows.",
    methodologyRef: "revenue-methodology.md",
    applies: (c) => c.seriesIds.some((id) => NETTED_REVENUE_IDS.has(id)),
    affects: (c) => c.seriesIds.filter((id) => NETTED_REVENUE_IDS.has(id)),
  },
  {
    code: "gdp_sna_break_2010",
    severity: "note",
    messageKa: "მშპ-ის მაჩვენებელი 2010 წელს აღრიცხვის სტანდარტს იცვლის (SNA 1993 → SNA 2008).",
    messageEn: "The GDP denominator changes accounting standard at 2010 (SNA 1993 to SNA 2008).",
    methodologyRef: "national-nominal-gdp.md",
    applies: (c) => {
      if (c.measure !== "share_of_gdp_pct") return false;
      const standards = new Set(c.gdpInputs.filter((g) => c.years.includes(g.year)).map((g) => g.accountingStandard));
      return standards.size > 1;
    },
    affects: () => ["gdp"],
  },
  {
    code: "gdp_preliminary",
    severity: "note",
    messageKa: "გამოყენებული მშპ-ის მაჩვენებელი წინასწარია.",
    messageEn: "A GDP denominator used by this result is preliminary.",
    methodologyRef: "national-nominal-gdp.md",
    applies: (c) => c.measure === "share_of_gdp_pct" && c.gdpInputs.some((g) => c.years.includes(g.year) && g.status === "preliminary"),
    affects: (c) => c.gdpInputs.filter((g) => c.years.includes(g.year) && g.status === "preliminary").map((g) => `gdp:${g.year}`),
  },
];
```

Then in `caveats/index.ts` replace the empty array:

```ts
import { NATIONAL_CAVEAT_RULES } from "./rules.national";
export const CAVEAT_RULES: readonly CaveatRule[] = [...NATIONAL_CAVEAT_RULES];
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/caveats && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/caveats apps/web/tests/factQuery/caveats/national.test.ts
git commit -m "feat(factQuery): add national and gdp caveat rules"
```

---

### Task 9: Municipal caveat rules

**Files:**
- Create: `apps/web/lib/factQuery/caveats/rules.municipal.ts`
- Modify: `apps/web/lib/factQuery/caveats/index.ts`
- Test: `apps/web/tests/factQuery/caveats/municipal.test.ts`

**Interfaces:**
- Produces: `MUNICIPAL_CAVEAT_RULES` covering `municipality_not_territorial`, `municipal_country_scope`, `adjara_consolidation_applied`, `municipal_functions_no_republican_crosswalk`, `municipal_total_definition_changed`, `municipal_source_actual_missing`, `municipal_source_version_difference`, `municipal_financing_outside_functional`, `municipal_functional_total_gap`, `per_resident_coverage_limited`.

**The load-bearing test in this whole plan** is the Khulo 2024 case: `warningType` drives the rule, never `showWarning`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/tests/factQuery/caveats/municipal.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { MUNICIPAL_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.municipal";
import type { MunicipalTotalFact } from "../../../lib/data/municipal/types";

function total(overrides: Partial<MunicipalTotalFact>): MunicipalTotalFact {
  return {
    year: 2024,
    municipalityCode: "11",
    publicTotalGel: 30969077.43,
    publicTotalMeasure: "functional_total_fallback_missing_payment_actual",
    totalPaymentsGel: null,
    expensesGel: null,
    nonfinancialAssetGrowthGel: null,
    financialAssetGrowthGel: null,
    liabilityDecreaseGel: null,
    functionalSumGel: 30969077.43,
    reconciliationDifferenceGel: null,
    warningAmountGel: null,
    showWarning: false,
    warningType: "source_actual_missing",
    basis: "actual",
    sourceId: "source.example",
    ...overrides,
  };
}

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
    datasetId: "municipal-expenditure",
    measure: "amount_gel",
    years: [2024],
    seriesIds: ["municipal.total"],
    entityIds: ["11"],
    observations: [],
    municipalTotalInputs: [],
    gdpInputs: [],
    comparison: null,
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, MUNICIPAL_CAVEAT_RULES).map((c) => c.code);

describe("municipal_source_actual_missing — the Khulo 2024 regression", () => {
  it("fires even though showWarning is false", () => {
    const ctx = context({ municipalTotalInputs: [total({})] });
    expect(codes(ctx)).toContain("municipal_source_actual_missing");
  });

  it("does not fire for an ordinary clean total", () => {
    const ctx = context({
      entityIds: ["06"],
      municipalTotalInputs: [total({ municipalityCode: "06", warningType: "none", publicTotalMeasure: "total_payments_actual", totalPaymentsGel: 1 })],
    });
    expect(codes(ctx)).not.toContain("municipal_source_actual_missing");
  });
});

describe("other quality-state rules", () => {
  it("municipal_source_version_difference fires on that warning type", () => {
    const ctx = context({ municipalTotalInputs: [total({ warningType: "source_version_difference", showWarning: true })] });
    expect(codes(ctx)).toContain("municipal_source_version_difference");
  });

  it("municipal_financing_outside_functional fires on that warning type", () => {
    const ctx = context({ municipalTotalInputs: [total({ warningType: "financing_outside_functional", showWarning: true })] });
    expect(codes(ctx)).toContain("municipal_financing_outside_functional");
  });
});

describe("municipality_not_territorial", () => {
  it("fires when an excluded code is named", () => {
    expect(codes(context({ entityIds: ["05"] }))).toContain("municipality_not_territorial");
  });
  it("does not fire for an ordinary municipality", () => {
    expect(codes(context({ entityIds: ["11"] }))).not.toContain("municipality_not_territorial");
  });
});

describe("scope rules", () => {
  it("municipal_country_scope fires for the georgia aggregate", () => {
    expect(codes(context({ entityIds: ["country.georgia"] }))).toContain("municipal_country_scope");
  });
  it("adjara_consolidation_applied fires for the adjara region total", () => {
    expect(codes(context({ entityIds: ["region.adjara"], seriesIds: ["municipal.total"] }))).toContain("adjara_consolidation_applied");
  });
  it("municipal_functions_no_republican_crosswalk does NOT attach to an ordinary municipality", () => {
    expect(codes(context({ entityIds: ["11"], seriesIds: ["municipal.education"] }))).not.toContain(
      "municipal_functions_no_republican_crosswalk",
    );
  });
  it("municipal_functions_no_republican_crosswalk fires for an adjara functional query", () => {
    expect(codes(context({ entityIds: ["region.adjara"], seriesIds: ["municipal.education"] }))).toContain(
      "municipal_functions_no_republican_crosswalk",
    );
  });
});

describe("per_resident_coverage_limited", () => {
  it("fires for a non-2025 per-resident request", () => {
    expect(codes(context({ measure: "gel_per_resident", years: [2020] }))).toContain("per_resident_coverage_limited");
  });
  it("does not fire for a 2025 municipal total per-resident request", () => {
    expect(codes(context({ measure: "gel_per_resident", years: [2025], seriesIds: ["municipal.total"] }))).not.toContain(
      "per_resident_coverage_limited",
    );
  });
});

describe("municipal_total_definition_changed", () => {
  it("fires when comparison endpoints use different total definitions", () => {
    const ctx = context({
      comparison: { fromYear: 2015, toYear: 2024, fromDefinition: "functional_total_fallback", toDefinition: "total_payments_actual" },
    });
    expect(codes(ctx)).toContain("municipal_total_definition_changed");
  });
  it("does not fire when both endpoints share a definition", () => {
    const ctx = context({
      comparison: { fromYear: 2020, toYear: 2024, fromDefinition: "total_payments_actual", toDefinition: "total_payments_actual" },
    });
    expect(codes(ctx)).not.toContain("municipal_total_definition_changed");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/caveats/municipal.test.ts`
Expected: FAIL — cannot resolve `rules.municipal`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/factQuery/caveats/rules.municipal.ts
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "../types";
import type { CaveatRule } from "./engine";

const EXCLUDED = new Set<string>(AGGREGATE_ONLY_MUNICIPAL_CODES);
const COUNTRY_ID = "country.georgia";
const ADJARA_ID = "region.adjara";
const TOTAL_SERIES = "municipal.total";

/**
 * Quality-state rules read warningType, never showWarning. Khulo (code 11) 2024
 * carries warningType "source_actual_missing" with showWarning false: a
 * display-flag rule would serve its fallback figure with no warning at all.
 */
function hasWarningType(context: { municipalTotalInputs: { warningType: string; municipalityCode: string; year: number }[] }, type: string) {
  return context.municipalTotalInputs.some((row) => row.warningType === type);
}

function affectedByWarningType(
  context: { municipalTotalInputs: { warningType: string; municipalityCode: string; year: number }[] },
  type: string,
) {
  return context.municipalTotalInputs.filter((row) => row.warningType === type).map((row) => `${row.municipalityCode}:${row.year}`);
}

export const MUNICIPAL_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "municipality_not_territorial",
    severity: "severe",
    messageKa: "მითითებული კოდის ბიუჯეტი ტერიტორიულად მიკუთვნებადი ხარჯი არ არის და გამორიცხულია.",
    messageEn: "The named code's budget is not territorially attributable spending and is excluded.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => c.entityIds.some((id) => EXCLUDED.has(id)),
    affects: (c) => c.entityIds.filter((id) => EXCLUDED.has(id)),
  },
  {
    code: "municipal_country_scope",
    severity: "note",
    messageKa: "საქართველოს მუნიციპალური აგრეგატი მოიცავს 69 გადამოწმებულ ბიუჯეტს და აჭარის ნეტო კორექციას; რეგიონული მწკრივები ამ ჯამს არ ქმნიან.",
    messageEn: "The Georgia municipal aggregate covers 69 reviewed budgets plus the net Adjara adjustment; regional rows do not sum to it.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => c.entityIds.includes(COUNTRY_ID),
    affects: () => [COUNTRY_ID],
  },
  {
    code: "adjara_consolidation_applied",
    severity: "note",
    messageKa: "შედეგი იყენებს აჭარის რესპუბლიკური გადახდების ნეტო კორექციას, ერთხელ.",
    messageEn: "The result applies the net Adjara republican adjustment once.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => c.entityIds.includes(ADJARA_ID) && c.seriesIds.includes(TOTAL_SERIES),
    affects: () => [ADJARA_ID],
  },
  {
    code: "municipal_functions_no_republican_crosswalk",
    severity: "note",
    messageKa: "ფუნქციური კატეგორიები მხოლოდ მუნიციპალურია; რესპუბლიკური ფუნქციური განაწილება არ არსებობს და არ არის გამოგონილი.",
    messageEn: "Functional categories are municipal-only; no republican functional allocation exists and none is invented.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) =>
      (c.entityIds.includes(ADJARA_ID) || c.entityIds.includes(COUNTRY_ID)) && c.seriesIds.some((id) => id !== TOTAL_SERIES),
    affects: (c) => c.entityIds.filter((id) => id === ADJARA_ID || id === COUNTRY_ID),
  },
  {
    code: "municipal_total_definition_changed",
    severity: "severe",
    messageKa: "შედარების წერტილები საჯარო ჯამის სხვადასხვა განსაზღვრებას იყენებს; თანაზომადი ზრდა არ გამოითვლება.",
    messageEn: "The comparison endpoints use different public-total definitions; no like-for-like growth is produced.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => c.comparison !== null && c.comparison.fromDefinition !== c.comparison.toDefinition,
    affects: (c) => (c.comparison ? [`${c.comparison.fromYear}->${c.comparison.toYear}`] : []),
  },
  {
    code: "municipal_source_actual_missing",
    severity: "severe",
    messageKa: "საჭირო ფაქტობრივი გადახდების მაჩვენებელი მიუწვდომელია; გამოყენებულია გადამოწმებული ფუნქციური ჯამი.",
    messageEn: "The required payment actual is unavailable; the reviewed functional total is used instead.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => hasWarningType(c, "source_actual_missing"),
    affects: (c) => affectedByWarningType(c, "source_actual_missing"),
  },
  {
    code: "municipal_source_version_difference",
    severity: "severe",
    messageKa: "ფუნქციური და ჯამური მონაცემები წყაროს სხვადასხვა ვერსიიდანაა; შეჯერება იძულებით არ ხდება.",
    messageEn: "Functional and total inputs come from documented differing source versions; they are not forcibly reconciled.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => hasWarningType(c, "source_version_difference"),
    affects: (c) => affectedByWarningType(c, "source_version_difference"),
  },
  {
    code: "municipal_financing_outside_functional",
    severity: "note",
    messageKa: "საჯარო ჯამი მოიცავს ფინანსურ კომპონენტებს, რომლებიც ათ ფუნქციაზე არ არის განაწილებული.",
    messageEn: "The public total includes financing components not distributed across the ten functions.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => hasWarningType(c, "financing_outside_functional"),
    affects: (c) => affectedByWarningType(c, "financing_outside_functional"),
  },
  {
    code: "municipal_functional_total_gap",
    severity: "note",
    messageKa: "ფუნქციური წილები საჯარო ჯამს სრულად არ ფარავს; 100%-მდე ნორმალიზება არ ხდება.",
    messageEn: "Functional shares do not cover the applicable public total and are never normalised to 100%.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) =>
      c.measure === "share_of_total_pct" &&
      c.municipalTotalInputs.some((row) => row.reconciliationDifferenceGel !== null && row.reconciliationDifferenceGel !== 0),
    affects: (c) =>
      c.municipalTotalInputs
        .filter((row) => row.reconciliationDifferenceGel !== null && row.reconciliationDifferenceGel !== 0)
        .map((row) => `${row.municipalityCode}:${row.year}`),
  },
  {
    code: "per_resident_coverage_limited",
    severity: "severe",
    messageKa: "ერთ მcxოვრებზე გაანგარიშება მხოლოდ 2025 წლის მუნიციპალურ/რეგიონულ ჯამებზეა დაშვებული (ერთ მცხოვრებზე).",
    messageEn: "Per-resident values are supported only for the approved 2025 municipal and region totals.",
    methodologyRef: "municipal-population-regional-gdp.md",
    applies: (c) =>
      c.measure === "gel_per_resident" && (c.years.some((year) => year !== 2025) || c.seriesIds.some((id) => id !== TOTAL_SERIES)),
    affects: (c) => c.years.filter((year) => year !== 2025).map(String),
  },
];
```

Register in `caveats/index.ts`:

```ts
import { MUNICIPAL_CAVEAT_RULES } from "./rules.municipal";
export const CAVEAT_RULES: readonly CaveatRule[] = [...NATIONAL_CAVEAT_RULES, ...MUNICIPAL_CAVEAT_RULES];
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/caveats && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/caveats apps/web/tests/factQuery/caveats/municipal.test.ts
git commit -m "feat(factQuery): add municipal caveat rules keyed on quality state"
```

---

### Task 10: Ministries and program caveat rules

**Files:**
- Create: `apps/web/lib/factQuery/caveats/rules.ministries.ts`
- Modify: `apps/web/lib/factQuery/caveats/index.ts`
- Test: `apps/web/tests/factQuery/caveats/ministries.test.ts`

**Interfaces:**
- Produces: `MINISTRIES_CAVEAT_RULES` covering `program_coverage_partial`, `program_historical_join`, `non_positive_comparison_base`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/tests/factQuery/caveats/ministries.test.ts
import { describe, expect, it } from "vitest";
import { evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats/engine";
import { MINISTRIES_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.ministries";

function context(overrides: Partial<CaveatContext>): CaveatContext {
  return {
    datasetId: "ministries",
    measure: "amount_gel",
    years: [2020],
    seriesIds: [],
    entityIds: ["country.georgia"],
    observations: [],
    municipalTotalInputs: [],
    gdpInputs: [],
    comparison: null,
    ...overrides,
  };
}

const codes = (ctx: CaveatContext) => evaluateCaveats(ctx, MINISTRIES_CAVEAT_RULES).map((c) => c.code);

describe("program_coverage_partial", () => {
  it("fires when a requested program year is missing", () => {
    const ctx = context({
      years: [2015, 2020],
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2015, value: null, basis: null },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).toContain("program_coverage_partial");
  });

  it("does not fire when every requested year is present", () => {
    const ctx = context({
      years: [2020],
      observations: [{ entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" }],
    });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });

  it("treats a genuine zero as present, not missing", () => {
    const ctx = context({
      years: [2020],
      observations: [{ entityId: "country.georgia", seriesId: "p1", year: 2020, value: 0, basis: "actual" }],
    });
    expect(codes(ctx)).not.toContain("program_coverage_partial");
  });
});

describe("non_positive_comparison_base", () => {
  it("fires when the earlier endpoint is zero", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020, fromDefinition: "x", toDefinition: "x" },
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2019, value: 0, basis: "actual" },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).toContain("non_positive_comparison_base");
  });

  it("does not fire for a positive base", () => {
    const ctx = context({
      comparison: { fromYear: 2019, toYear: 2020, fromDefinition: "x", toDefinition: "x" },
      observations: [
        { entityId: "country.georgia", seriesId: "p1", year: 2019, value: 5, basis: "actual" },
        { entityId: "country.georgia", seriesId: "p1", year: 2020, value: 10, basis: "actual" },
      ],
    });
    expect(codes(ctx)).not.toContain("non_positive_comparison_base");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/caveats/ministries.test.ts`
Expected: FAIL — cannot resolve `rules.ministries`.

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/factQuery/caveats/rules.ministries.ts
import type { CaveatRule } from "./engine";

export const MINISTRIES_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "program_coverage_partial",
    severity: "severe",
    messageKa: "მოთხოვნილი პროგრამული მწკრივი ზოგიერთ წელს არ ფარავს; არარსებული მნიშვნელობა ნული არ არის.",
    messageEn: "The requested program series does not cover every requested year; a missing value is not zero.",
    methodologyRef: "ministries-drilldown-programs-methodology.md",
    applies: (c) => c.observations.some((o) => o.value === null),
    affects: (c) => c.observations.filter((o) => o.value === null).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "program_historical_join",
    severity: "note",
    messageKa: "მწკრივი იყენებს დამტკიცებულ ისტორიულ გაერთიანებას; შენარჩუნებულია მისი მოცულობა და ორიგინალი დასახელება.",
    messageEn: "The series uses an approved historical succession join; its scope and original label are preserved.",
    methodologyRef: "ministries-drilldown-programs-methodology.md",
    applies: (c) => c.seriesIds.some((id) => c.historicalJoinSeriesIds.includes(id)),
    affects: (c) => c.seriesIds.filter((id) => c.historicalJoinSeriesIds.includes(id)),
  },
  {
    code: "non_positive_comparison_base",
    severity: "note",
    messageKa: "საწყისი მაჩვენებელი ნულოვანი ან უარყოფითია, ამიტომ პროცენტული ზრდა არ გამოითვლება; აბსოლუტური სხვაობა შესაძლოა დარჩეს.",
    messageEn: "The starting value is zero or negative, so percentage growth is unavailable; an absolute difference may remain.",
    methodologyRef: "ai-grounding-and-caveats.md#non_positive_comparison_base",
    applies: (c) => {
      if (c.comparison === null) return false;
      const from = c.comparison.fromYear;
      return c.observations.some((o) => o.year === from && o.value !== null && o.value <= 0);
    },
    affects: (c) => (c.comparison ? [`base:${c.comparison.fromYear}`] : []),
  },
];
```

Register in `caveats/index.ts` alongside the other two groups, then assert the registry is complete:

```ts
// append to tests/factQuery/caveats/engine.test.ts
it("registers all 22 codes from spec section 9.2", () => {
  expect(CAVEAT_RULES).toHaveLength(22);
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/caveats && npm run typecheck`
Expected: PASS, including the 22-code assertion.

If the count is not 22, reconcile against §9.2 — do not change the expected number.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/factQuery/caveats apps/web/tests/factQuery/caveats
git commit -m "feat(factQuery): complete the 22-code caveat catalogue"
```

---

### Tasks 11–17: the seven query functions

Each follows the identical five-step TDD cycle. Implement in this order, because later functions reuse earlier ones.

| Task | Function | File | Key behaviour to test first |
| --- | --- | --- | --- |
| 11 | `describeCoverage` | `describeCoverage.ts` | Distinguishes served observations, supported calculated totals (`revenue.total`, `expenditure.total`, `admin_spending.total`, `municipal.total`), and taxonomy-only entries. `revenue.taxes_total` must be listed as **not queryable**. Excluded codes appear only in exclusion metadata. `search` matches ids, Georgian names, and slugs. |
| 12 | `queryNational` | `queryNational.ts` | Returns `country.georgia` observations with `budgetScope`. A year outside coverage returns `year_out_of_range` rather than clamping. 2004 liabilities return `availability: "missing"`, never `0`. |
| 13 | `queryMinistries` | `queryMinistries.ts` | `admin_category` and `major_program` levels stay distinct; the admin total is available only at `admin_category`. Program rows carry `parentSeriesId` and never sum into the parent. |
| 14 | `queryMunicipal` | `queryMunicipal.ts` | Excluded codes produce `coverage.excludedEntities` and **no** row. Georgia total uses the served consolidated value without re-adding the Adjara adjustment. Khulo 2024 returns 30969077.43 with `valueDefinition` naming the fallback. |
| 15 | `compare` | `compare.ts` | Reuses the observation queries. `(later − earlier) / earlier × 100`. Percentage measures produce percentage-**point** change. Returns `not_comparable` with endpoints intact for the 2004→2005 receipts total and the 2015→payment-total municipal case. |
| 16 | `rank` | `rank.ts` | Ranks peers only. Ordering happens on full-precision values before formatting. Ties share a `tied: true` flag and sequential `position`. Mixed actual/planned basis returns `unsupported_comparison`. |
| 17 | `getSources` | `getSources.ts` | Resolves via `selectSources`. Unknown ids return `unknown_source` with bounded suggestions and never a fabricated URL. |

**For each of Tasks 11–17:**

- [ ] **Step 1: Write the failing test** in `apps/web/tests/factQuery/<function>.test.ts`, loading the snapshot once via `beforeAll` and `buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-28T00:00:00.000Z" })`. Assert the "Key behaviour" column above plus one envelope-shape assertion: `expect(envelopeSchema.parse(result)).toBeTruthy()`.
- [ ] **Step 2: Run to verify it fails** — `npm run test -- tests/factQuery/<function>.test.ts`.
- [ ] **Step 3: Implement** the function in `apps/web/lib/factQuery/<function>.ts` with the signature `(snapshot: FactQuerySnapshot, rawInput: unknown) => FactQueryResponse`, parsing `rawInput` with the Task 6 schema, returning an `error` envelope with `invalid_parameters` on a Zod failure, and calling `evaluateCaveats(context, CAVEAT_RULES)` before returning.
- [ ] **Step 4: Run to verify it passes** — `npm run test -- tests/factQuery/<function>.test.ts && npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(factQuery): add <function>"`.

After Task 17, export all seven from `apps/web/lib/factQuery/index.ts` and commit that barrel.

---

### Task 18: Agreement with the explorer model

**Files:**
- Test: `apps/web/tests/factQuery/agreement.test.ts`

**Interfaces:**
- Consumes: all seven functions; `buildExplorerModel` from `lib/explorer/explorerData`; `buildMunicipalModel` equivalents from `lib/explorer/municipalData`.

This is the gate that proves an AI answer and a chart cannot disagree (§14.2). It must cover **every** served base observation and supported calculated total, not a sample.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/factQuery/agreement.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { queryNational } from "../../lib/factQuery";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-28T00:00:00.000Z" });
});

describe("query core agrees with the served facts", () => {
  it("returns the exact amount for every served national fact", () => {
    const bySide = { revenue: [] as string[], expenditure: [] as string[] };
    for (const fact of snapshot.national.facts) bySide[fact.side].push(fact.itemId);

    for (const side of ["revenue", "expenditure"] as const) {
      const years = [...new Set(snapshot.national.facts.filter((f) => f.side === side).map((f) => f.year))].sort();
      const seriesIds = [...new Set(bySide[side])];

      const result = queryNational(snapshot, { side, seriesIds, years, measure: "amount_gel" });
      expect(result.status).not.toBe("error");

      const returned = new Map(
        (result.data as { observations: { seriesId: string; year: number; value: number | null }[] }).observations.map((o) => [
          `${o.seriesId}:${o.year}`,
          o.value,
        ]),
      );

      for (const fact of snapshot.national.facts.filter((f) => f.side === side)) {
        expect(returned.get(`${fact.itemId}:${fact.year}`)).toBe(fact.amountGel);
      }
    }
  });

  it("matches the explorer model for every supported calculated total", () => {
    // Spec 14.2 requires agreement with the EXPLORER MODEL, not only the raw facts.
    // Build the same model the explorer route builds (buildExplorerModel from
    // ../../lib/explorer/explorerData) and assert queryNational's revenue.total and
    // expenditure.total equal that model's totalRow value for every year in coverage.
    // A mismatch means the AI and the chart would disagree: investigate the core,
    // never relax the assertion.
    expect.hasAssertions();
  });

  it("computes revenue.total as the sum of its non-overlapping components", () => {
    const years = [...new Set(snapshot.national.facts.filter((f) => f.side === "revenue").map((f) => f.year))].sort();
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.total"], years, measure: "amount_gel" });

    const observations = (result.data as { observations: { year: number; value: number | null }[] }).observations;
    for (const observation of observations) {
      const expected = snapshot.national.facts
        .filter((f) => f.side === "revenue" && f.year === observation.year)
        .reduce((sum, f) => sum + f.amountGel, 0);
      expect(observation.value).toBeCloseTo(expected, 2);
    }
  });

  it("reports 2004 receipts as the reviewed narrower total", () => {
    const result = queryNational(snapshot, { side: "revenue", seriesIds: ["revenue.total"], years: [2004], measure: "amount_gel" });
    const observations = (result.data as { observations: { value: number | null }[] }).observations;

    expect(observations[0]?.value).toBe(2283035800);
    const caveatCodes = result.meta.caveats.map((c) => c.code);
    expect(caveatCodes).toContain("revenue_2004_total_scope");
  });
});
```

Add equivalent blocks for `queryMinistries` (all 852 facts) and `queryMunicipal` (all 7,040 function facts and 704 totals) following the same pattern.

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/agreement.test.ts`
Expected: FAIL until Tasks 11–17 are complete.

- [ ] **Step 3: Fix the query functions until agreement holds**

Do not relax an assertion to make it pass. A mismatch means the query core disagrees with the reviewed data — investigate the core.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- tests/factQuery/agreement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/factQuery/agreement.test.ts
git commit -m "test(factQuery): assert full agreement with the served facts"
```

---

### Task 19: Methodology document and final gate

**Files:**
- Create: `docs/data-methodology/ai-grounding-and-caveats.md`
- Test: `apps/web/tests/factQuery/caveats/documented.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/factQuery/caveats/documented.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";

describe("caveat catalogue documentation", () => {
  it("documents every registered caveat code", async () => {
    const doc = await readFile(
      path.join(process.cwd(), "..", "..", "docs", "data-methodology", "ai-grounding-and-caveats.md"),
      "utf8",
    );
    const undocumented = CAVEAT_RULES.filter((rule) => !doc.includes(rule.code)).map((rule) => rule.code);
    expect(undocumented).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/factQuery/caveats/documented.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the methodology document**

One section per caveat code, each stating the trigger, the severity, both messages, and a link to the upstream methodology document that owns the underlying rule. Reproduce the §9.2 table and add, for each code, the sentence explaining why the rule is what it is. Open with a short paragraph explaining that this document is the single owner of the caveat catalogue and that a code appearing here is not proof its trigger is correct — the firing and non-firing tests are.

- [ ] **Step 4: Run the full gate**

```bash
npm run check
```

Expected: lint, typecheck, all tests, and `data:validate` (now including `data:check-fact-query-snapshot`) all pass.

- [ ] **Step 5: Commit**

```bash
git add docs/data-methodology/ai-grounding-and-caveats.md apps/web/tests/factQuery/caveats/documented.test.ts
git commit -m "docs(factQuery): document the caveat catalogue and gate it in tests"
```

---

## Part 1 completion gate

Per spec §16, Part 1 is done when all of these hold:

- [ ] `npm run check` passes from `apps/web`.
- [ ] Every §9.2 code has both a firing and a non-firing test.
- [ ] `CAVEAT_RULES` has exactly 22 entries and every code is documented.
- [ ] The agreement test covers every served base observation and supported calculated total.
- [ ] A double rebuild produces an identical `dataVersion`.
- [ ] The source resolver reports no unresolved available figure and emits no internal path as a public URL.
- [ ] The purity test passes — no IO, database, provider SDK, or logging under `lib/factQuery/` outside `buildSnapshot.ts`.
- [ ] No reviewed financial value, taxonomy file, or Prisma model was modified.
