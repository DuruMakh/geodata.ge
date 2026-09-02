# Fiscal.ge Query Core Part 3 — Runtime, Discovery and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `/mcp` — a read-only, unauthenticated, stateless MCP endpoint serving the seven Part 1 query functions from the packaged snapshot — plus the Georgian connection page that makes it findable, the `llms.txt` rewording that stops claiming "no public API", and the operating limits, privacy controls and pause switch that make public enablement safe.

**Architecture:** One Next.js Route Handler at `app/mcp/route.ts` is the only request-time code in the repository. It loads the build-time snapshot from the deployed bundle (no database, no network, no source-document fetch), converts the MCP JSON-RPC call into a Part 1 function call through the existing Zod schemas, and returns the validated envelope as structured content plus a compact text twin. Everything numeric stays in the pure core: the route adds transport, limits, security and logging, and nothing else. The connection page is an ordinary prerendered page in the `/about` mould.

**Tech Stack:** TypeScript (strict), Node 24, Next.js 16.2.11 App Router, `@modelcontextprotocol/sdk` 1.30.0 (`WebStandardStreamableHTTPServerTransport`), Zod 4.4.3, Vitest 4.1.5, Playwright.

Spec: `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` §11 (endpoint and operations), §12.2–12.3 (`llms.txt`, connection page), §13 (truth policy), §14.4–14.5 (verification and acceptance), §15 (documentation), §16 Part 3 (delivery gate), §18 (stop conditions).
Part 1 plan (complete): `docs/superpowers/plans/2026-08-28-fiscal-query-core.md`.
Part 2 plan (complete): `docs/superpowers/plans/2026-09-02-fiscal-query-core-part-2-publications.md`.

---

## Global Constraints

- **No data changes.** No reviewed financial value, taxonomy file, Prisma model, or import mapper is modified. Never run `npm run data:import` or any script writing to `data/imports/`. Never edit the Supabase database directly. (§10.3)
- **No model SDK, no inference, no provider dependency.** There are no production model-inference calls in this release. Do not add `ai`, `@ai-sdk/*`, `@anthropic-ai/*` or any provider package, even to demonstrate portability. `tests/factQuery/purity.test.ts` enforces this for `lib/factQuery/`; Task 4 extends the same guard to the runtime modules. (§13, decision 6)
- **The query core stays pure.** `lib/factQuery/**` must not import `fs`, `net`, `http`, `child_process`, `dns`, Prisma, or call `fetch` or `console.*` (`buildSnapshot.ts` excepted). The runtime snapshot loader therefore lives **outside** `lib/factQuery/`, in `lib/mcp/`. Adding `fs` to a `lib/factQuery/` file fails `purity.test.ts`.
- **No request-time database.** The route must answer with no database connectivity and must not refresh from the database during a request. A limiter that requires the live database is a §18 stop condition. (§4.4, §11.2, §18)
- **No request-time filesystem access outside the deployed bundle**, and no fetching of source documents. (§14.4)
- **Public unauthenticated access is intentional.** Do not add auth, accounts, API keys or OAuth. (§2.3 decision 4)
- **Read-only tools only.** No writes, arbitrary URLs, filesystem paths, SQL, or model sampling. Every tool is annotated `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`. (§11.1)
- **Protocol revision is `2025-11-25`, stateless, no session store.** Do not advertise a newer revision. Lock the SDK version exactly (no `^`). (§11.1)
- **Georgian is the primary language.** Page copy, tool descriptions' user-facing nouns and every label are the reviewed Georgian. Only Fiscal.ge's own caveat and error text is also authored in English. Do not invent English labels for series, entities or programs. (§10, §2.3 decision 2)
- **Truth policy (§13).** Server instructions must state that the service reports verified figures and their limitations, and must not present unsupported causes, outcomes or predictions as fact. An increase in spending does not by itself prove improved services, efficiency, corruption, or policy success.
- **Licence is CC BY 4.0**, `https://creativecommons.org/licenses/by/4.0/`, unchanged in every envelope.
- **Excluded municipal codes `05`, `42`, `43`, `46`, `64`** never appear as territorial rows and their individual contributions are never exposed. (§5.4)
- **Errors and logs must never expose environment variables, internal paths, raw prompts, request bodies, authorization headers, full user agents, or IP addresses.** (§11.2, §11.5)
- Match surrounding file style. `apps/web/lib/factQuery/` is **LF** in `observations.ts`, `queryMunicipal.ts`, `queryNational.ts`, `queryMinistries.ts`, `compare.ts`, `getSources.ts`, `publications.ts`, and **CRLF** in `rank.ts`, `buildSnapshot.ts`, `caveats/rules.municipal.ts`. `AGENTS.md`, `Project_Definition.md`, `apps/web/public/llms.txt` and files under `docs/superpowers/plans/` are LF; the spec and `docs/data-methodology/ai-grounding-and-caveats.md` are CRLF. Check with `git ls-files --eol <path>` before writing a patch script.
- All commands run from `apps/web` unless stated otherwise.
- Commit format: conventional commits, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.
- **Do not push, open a PR, or merge without explicit owner authorization.** Do not push implementation commits to `main`.

---

## Reconnaissance findings — read before starting

Three things were measured against the working tree at `6733dfbc9` before this plan was written. Two change what the tasks must do; one removes the biggest architectural risk.

### Finding A — `meta.sources` ships documents the answer does not cite (Task 1)

Part 2's review fixed `observation.documentIds` so a row cites only the originals that support it. `meta.sources` was never narrowed the same way. It still carries **every document of every cited source**.

Measured, one municipal cell (Khulo `11`, `municipal.total`, 2024, `amount_gel`):

```text
response total          80.0 KiB
  meta.sources          77.9 KiB   1 source, 75 documents
  data.observations      1.2 KiB   1 row, citing 2 documentIds
  meta.caveats           0.5 KiB
```

97% of the answer to "what did Khulo spend in 2024" is metadata for 73 documents that do not support it. Narrowing `meta.sources[].documents` to the union of the returned rows' `documentIds` takes the same response to **4.4 KiB — an 18× reduction** — and costs nothing at scale (a 495-cell municipal response drops 24.9 KiB). For an MCP client this is the difference between roughly 20,000 and roughly 1,100 tokens of provenance per answer.

### Finding B — §11.3's two size limits are mutually unreachable (Task 2)

§11.3 sets both "maximum 500 returned observation cells" and "maximum 512 KiB serialized tool result including evidence and both representations". Measured on real municipal data:

| Query | Cells | Serialized |
| --- | --- | --- |
| 45 municipalities × `municipal.total` × 11 years | 495 | **541.9 KiB** |
| after Task 1 narrowing | 495 | ~517 KiB |

A municipal observation averages **1,049 bytes** (the largest fields are `valueDefinition` at 202 B and `documentIds` at 130 B). 500 cells cannot fit 512 KiB, and the "equivalent text representation" has not been counted yet. The cell cap is unreachable before the byte cap for the municipal dataset.

**Resolution adopted by this plan:** the byte ceiling is the binding gate, checked on the serialized result. The cell cap stays at the spec's 500 as a cheap pre-check. The text twin is a **compact table**, not a re-serialization of the JSON — §11.1 requires an *equivalent* representation, equivalent in content, not in structure. Over-limit requests get `result_too_large` with narrowing guidance and a bulk-file link, which §11.3 already mandates. Task 2 records this as a spec correction with the measurements above.

### Finding C — the architectural risks are cleared

Verified by execution, not assumption:

- **Snapshot JSON round-trip is lossless.** `hashDataVersion(JSON.parse(readFileSync(snapshot.json)))` equals the freshly built `dataVersion` (`3f4b6f9c…`), `JSON.stringify` of both is byte-identical at 2,336,880 chars, and all seven functions return identical output on the parsed and the built snapshot. `canonicalize` already throws on any value `JSON.stringify` cannot represent, so this is structural, not luck.
- **Cost is negligible.** 3.26 MB artifact: `readFileSync` 6.8 ms, `JSON.parse` 4.8 ms. Warm query medians 0.0–0.3 ms; the slowest observed single call was 1.5 ms (municipal). §11.4's p95 < 1 s warm and < 5 s cold are dominated by function boot, not by this work.
- **The SDK fits.** `@modelcontextprotocol/sdk@1.30.0` still declares `LATEST_PROTOCOL_VERSION = '2025-11-25'` — the exact revision §11.1 requires — and ships `WebStandardStreamableHTTPServerTransport` with `handleRequest(req: Request): Promise<Response>`, which is precisely a Next.js Route Handler signature. Deep subpath imports resolve via the package's `"./*"` export.
- **All seven Zod schemas convert to JSON Schema.** The SDK routes Zod v4 through `z4mini.toJSONSchema(schema, { io: 'input' })`; every input schema in `lib/factQuery/schemas.ts` converts cleanly, including the two that carry `.refine()` and the transforms on `years` and id arrays. **Caveat:** `.refine()` constraints are invisible in the emitted JSON Schema — `fromYear < toYear` and "value ranking needs one year" still enforce at parse time but are not advertised. Tool descriptions must state them in words (Task 4, Step 3).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/lib/factQuery/meta.ts` (modify) | Narrow `sources[].documents` to cited documents. |
| `apps/web/lib/mcp/snapshot.ts` (create) | Read and cache the packaged snapshot. The only `fs` in the runtime path. |
| `apps/web/lib/mcp/result.ts` (create) | Envelope → structured content + compact text twin; byte ceiling; `result_too_large` guidance. |
| `apps/web/lib/mcp/tools.ts` (create) | The seven tool definitions: name, Georgian description, schema, annotations, dispatch. |
| `apps/web/lib/mcp/instructions.ts` (create) | Server instructions text (§11.1, §13). |
| `apps/web/lib/mcp/security.ts` (create) | Origin/host validation, body cap, client address from trusted platform metadata. |
| `apps/web/lib/mcp/limits.ts` (create) | Limit constants, shared counter interface, pause switch. |
| `apps/web/lib/mcp/log.ts` (create) | The allow-listed log record. Nothing else may log. |
| `apps/web/app/mcp/route.ts` (create) | The Route Handler: POST/GET/DELETE, wiring only. |
| `apps/web/app/connect/page.tsx` (create) | The Georgian connection page. |
| `apps/web/app/sitemap.ts` (modify) | Add the connection page. |
| `apps/web/public/llms.txt` (modify) | Reword "no public API"; link the connection page. |
| `apps/web/tests/mcp/*.test.ts` (create) | Unit and integration tests per task. |
| `apps/web/tests/browser/connect.spec.ts` (create) | Connection page browser coverage. |
| `apps/web/next.config.ts` (modify) | `outputFileTracingIncludes` for the snapshot. |

---

## Task 1: Narrow `meta.sources` to the documents the answer cites

**Files:**
- Modify: `apps/web/lib/factQuery/meta.ts`
- Modify: `apps/web/lib/factQuery/queryNational.ts:355`, `queryMinistries.ts:429`, `queryMunicipal.ts:540`, `compare.ts:311`, `rank.ts` (its `buildResponseMeta` call)
- Test: `apps/web/tests/factQuery/meta.test.ts` (create)

**Interfaces:**
- Consumes: `ResolvedSource`, `ResponseMeta`, `Caveat` from `lib/factQuery/types.ts`.
- Produces: `ResponseMetaExtra` gains `citedDocumentIds?: readonly string[]`. `buildResponseMeta(snapshot, extra)` keeps its signature.

This is a Part 1 correctness fix, but it belongs here: §11.3's byte ceiling is unenforceable while a one-cell answer costs 80 KiB. Do it first — Task 2's limits are measured against the fixed sizes.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/meta.test.ts` (LF):

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { getSources } from "../../lib/factQuery/getSources";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
});

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("response meta carries only the evidence behind the answer", () => {
  // Measured before the fix: this exact call returned 80.0 KiB, of which 77.9 KiB
  // was meta.sources - one source carrying all 75 municipal workbooks, when the
  // single returned row cites 2 of them. Narrowing takes it to 4.4 KiB.
  it("narrows meta.sources[].documents to the documents the rows cite", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const cited = new Set((result.data as { observations: { documentIds: string[] }[] }).observations.flatMap((o) => o.documentIds));
    const carried = result.meta.sources.flatMap((source) => source.documents.map((d) => d.documentId));

    expect(carried.length).toBeGreaterThan(0);
    expect([...new Set(carried)].sort()).toEqual([...cited].sort());
    expect(bytes(result)).toBeLessThan(8 * 1024);
  });

  // Narrowing points at the right original; it never hides provenance. Same
  // contract resolveDocumentIds states: a cited source must always show
  // something a reader can open.
  it("never leaves a cited source with zero documents", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["region.adjara"],
      seriesIds: ["municipal.total"],
      years: [2016, 2020, 2024],
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    for (const source of result.meta.sources) {
      const archived = snapshot.sources.find((s) => s.sourceId === source.sourceId);
      if (archived === undefined || archived.documents.length === 0) continue;
      expect(source.documents.length, `${source.sourceId} was narrowed to nothing`).toBeGreaterThan(0);
    }
  });

  // getSources' whole purpose is to return documents. Narrowing must not touch it.
  it("leaves getSources' own document listing intact", () => {
    const sourceId = "source.municipal_mof_annual_and_history_workbooks";
    const result = getSources(snapshot, { sourceIds: [sourceId] });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const archived = snapshot.sources.find((s) => s.sourceId === sourceId);
    expect(result.meta.sources[0]!.documents.length).toBe(archived!.documents.length);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/factQuery/meta.test.ts
```

Expected: the first test FAILS. `carried` has 75 entries against `cited`'s 2, and `bytes(result)` is about 81,900 against the 8,192 bound. The second and third pass already.

- [ ] **Step 3: Implement the narrowing**

In `apps/web/lib/factQuery/meta.ts`, extend the extra type and filter:

```ts
export type ResponseMetaExtra = {
  sources?: ResolvedSource[];
  caveats?: Caveat[];
  /**
   * Every documentId the returned rows actually cite. When supplied, each
   * source's `documents` is narrowed to it.
   *
   * Without this a one-cell municipal answer carried all 75 municipal
   * workbooks - 77.9 KiB of a 80.0 KiB response - to support a row citing two
   * of them. `documentIds` was narrowed per observation in Part 2; `meta` was
   * not, so the evidence block still answered "which documents exist for this
   * source" rather than "which documents support this answer".
   *
   * Omitted by getSources, whose result IS the document listing, and by
   * describeCoverage, which returns no observations.
   */
  citedDocumentIds?: readonly string[];
};

export function buildResponseMeta(snapshot: FactQuerySnapshot, extra?: ResponseMetaExtra): ResponseMeta {
  const sources = extra?.sources ?? [];
  const cited = extra?.citedDocumentIds === undefined ? null : new Set(extra.citedDocumentIds);

  return {
    schemaVersion: snapshot.schemaVersion,
    dataVersion: snapshot.dataVersion,
    releaseCommit: snapshot.releaseCommit,
    generatedAt: snapshot.generatedAt,
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    sources:
      cited === null
        ? sources
        : sources.map((source) => {
            const kept = source.documents.filter((document) => cited.has(document.documentId));
            // Narrowing points at the right original; it never hides
            // provenance. A source the rows cite must always show something a
            // reader can open, so an empty filter falls back to everything the
            // source archives - the same rule resolveDocumentIds applies.
            return { ...source, documents: kept.length > 0 ? kept : source.documents };
          }),
    caveats: extra?.caveats ?? [],
  };
}
```

- [ ] **Step 4: Pass `citedDocumentIds` from every observation-producing function**

In `queryNational.ts:355`, `queryMinistries.ts:429` and `queryMunicipal.ts:540`, each already has its observation array in scope (named `observations` in all three). Change each `buildResponseMeta` call to add the union:

```ts
const meta = buildResponseMeta(snapshot, {
  sources: resolvedSources,
  caveats,
  citedDocumentIds: [...new Set(observations.flatMap((observation) => observation.documentIds))],
});
```

`compare.ts:311` and `rank.ts` build their results from endpoints and entries rather than raw observations. Read each file's result shape first: if the entries carry `documentIds`, pass the same union over them; if they do not, leave the call unchanged and add a one-line comment saying the result cites no documents directly. Do not invent a field.

Leave `getSources.ts:230` and `describeCoverage.ts:503` untouched.

- [ ] **Step 5: Run the test and the full core suite**

```bash
npx vitest run tests/factQuery/
```

Expected: PASS, including `publications.test.ts`'s "never cites a source while showing none of its documents" — that test reads `published.sources`, which is now narrowed, so it proves the fallback works.

- [ ] **Step 6: Confirm the published files shrank and still verify**

```bash
npm run data:prepare-fact-query-publications && npm run data:check-fact-query-publications
```

Expected: writes 7 files, then `ok`. Record the new byte sizes of `municipal-expenditure.json` from `public/downloads/data/manifest.json` in the commit message — the file's per-observation evidence is unchanged, but its `sources` block is now scoped.

- [ ] **Step 7: Commit**

```bash
git add lib/factQuery/meta.ts lib/factQuery/queryNational.ts lib/factQuery/queryMinistries.ts lib/factQuery/queryMunicipal.ts lib/factQuery/compare.ts lib/factQuery/rank.ts tests/factQuery/meta.test.ts
git commit -m "fix(factQuery): narrow meta.sources to the documents the answer cites"
```

---

## Task 2: MCP result shaping and the size ceiling

**Files:**
- Create: `apps/web/lib/mcp/result.ts`
- Test: `apps/web/tests/mcp/result.test.ts`

**Interfaces:**
- Consumes: `FactQueryResponse`, `FactQuerySnapshot` from `lib/factQuery`.
- Produces:
  - `export const LIMITS: { bodyBytes: 32768; cells: 500; comparisonPairs: 250; rankDefault: 10; rankMax: 100; resultBytes: 524288; entities: 100; series: 200; years: 100; sourceIds: 100; durationMs: 10000 }`
  - `export function toolResult(response: FactQueryResponse): { structuredContent?: unknown; content: { type: "text"; text: string }[]; isError: boolean }`
  - `export function tooLargeResponse(snapshot: FactQuerySnapshot, detail: { returned: number; bytes: number }): FactQueryResponse`
  - `export function renderText(response: FactQueryResponse): string`

Pure module. No transport, no `fs`, no logging.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/mcp/result.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { queryNational } from "../../lib/factQuery/queryNational";
import { LIMITS, toolResult, tooLargeResponse } from "../../lib/mcp/result";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
});

const size = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("MCP tool results", () => {
  it("carries the envelope as structured content and an equivalent text twin", () => {
    const response = queryNational(snapshot, {
      side: "expenditure",
      seriesIds: ["expenditure.total"],
      years: [2024],
      measure: "amount_gel",
    });
    const result = toolResult(response);

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual(response);
    expect(result.content).toHaveLength(1);
    // The text twin must carry the number, its unit, its year and the data
    // version - a text-only client must be able to answer and cite from it.
    expect(result.content[0]!.text).toContain("2024");
    expect(result.content[0]!.text).toContain(snapshot.dataVersion.slice(0, 12));
    expect(result.content[0]!.text).toMatch(/GEL/);
  });

  it("marks an error envelope as an error", () => {
    const response = queryNational(snapshot, {
      side: "revenue",
      seriesIds: ["revenue.not_a_series"],
      years: [2024],
      measure: "amount_gel",
    });
    const result = toolResult(response);

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("unknown_series");
  });

  // Spec 11.3 sets BOTH "500 cells" and "512 KiB including both
  // representations". Measured on real municipal data they are mutually
  // unreachable: 495 cells serialize to 541.9 KiB (517 KiB after Task 1),
  // at an average 1,049 bytes per municipal observation. The byte ceiling is
  // therefore the binding gate, and the text twin is a compact table rather
  // than a second copy of the JSON.
  it("keeps a full-width municipal answer inside the serialized ceiling", () => {
    const codes = snapshot.municipal.municipalities.map((m) => m.code).slice(0, 45);
    const years = Array.from({ length: 11 }, (_, i) => 2015 + i);
    const response = queryMunicipal(snapshot, {
      entityIds: codes,
      seriesIds: ["municipal.total"],
      years,
      measure: "amount_gel",
    });
    const result = toolResult(response);

    expect(size(result)).toBeLessThanOrEqual(LIMITS.resultBytes);
  });

  it("refuses an oversized result with narrowing guidance and a bulk link", () => {
    const response = tooLargeResponse(snapshot, { returned: 4200, bytes: 1_500_000 });
    const result = toolResult(response);

    expect(result.isError).toBe(true);
    if (response.kind !== "error") throw new Error("expected an error envelope");
    expect(response.error.code).toBe("result_too_large");
    expect(response.error.retryable).toBe(true);
    expect(response.error.messageKa.length).toBeGreaterThan(0);
    // Guidance, not a bare refusal: say how to narrow, and where the bulk file is.
    expect(result.content[0]!.text).toContain("/downloads/data/");
  });

  it("never trims sources or caveats to fit", () => {
    const response = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "amount_gel",
    });
    const result = toolResult(response);

    if (response.kind === "error") throw new Error("expected data");
    expect((result.structuredContent as typeof response).meta.sources).toEqual(response.meta.sources);
    expect((result.structuredContent as typeof response).meta.caveats).toEqual(response.meta.caveats);
    // Khulo 2024 is the case spec 2.4 names: show_warning=false with a real
    // quality problem. Its caveat must survive into the text a model reads.
    expect(result.content[0]!.text).toContain("municipal_source_actual_missing");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/mcp/result.test.ts
```

Expected: FAIL, `Cannot find module '../../lib/mcp/result'`.

- [ ] **Step 3: Implement `lib/mcp/result.ts`**

Write the module with these rules, in this order:

1. `LIMITS` exactly as in the Interfaces block above, each constant carrying a one-line comment naming its §11.3 row.
2. `renderText(response)` builds a compact, deterministic text block:
   - a header line with `kind`, `status`, `dataVersion`, `licence`;
   - for observation results, one tab-delimited line per row: `entityLabelKa \t seriesLabelKa \t year \t value \t unit \t basis \t caveatIds.join(",")`, with `missing` in place of a null value and its `missingReason` appended;
   - for `comparisons`, `ranking`, `sources` and `catalogue`, the equivalent flat table over that result's own fields;
   - then `## წყაროები` listing `sourceId — name` and each cited document's title and its `archiveUrl ?? officialUrl`;
   - then `## შენიშვნები` listing every caveat as `code (severity): messageKa | messageEn`;
   - for an error envelope, `error.code`, both messages, `retryable`, and `validChoices` when present.
   Severe caveats are listed before notes. Never truncate the source or caveat sections.
3. `toolResult(response)` returns `{ structuredContent: response, content: [{ type: "text", text: renderText(response) }], isError: response.kind === "error" }`. For an error envelope, omit `structuredContent` (a failed call has no structured payload to validate).
4. `tooLargeResponse(snapshot, detail)` returns an `error` envelope built through `buildResponseMeta(snapshot)` with `code: "result_too_large"`, `retryable: true`, bilingual messages naming the returned count and the byte size, and guidance text that says which axis to narrow (years, then entities, then series) and points at `https://fiscal.ge/downloads/data/` for whole-dataset needs.

Georgian text is authored copy, not a translation of the English: write both.

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/mcp/result.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Record the spec correction**

Append to `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` §11.3 (CRLF file), directly under the limits table, a note stating that the 500-cell and 512 KiB limits were measured as mutually unreachable for municipal data (495 cells = 541.9 KiB pre-narrowing, 1,049 B per observation), that the byte ceiling is the binding gate, and that the text representation is a compact table rather than a second serialization. Cite the measurements.

- [ ] **Step 6: Commit**

```bash
git add lib/mcp/result.ts tests/mcp/result.test.ts ../../docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md
git commit -m "feat(mcp): shape query envelopes into tool results within the size ceiling"
```

---

## Task 3: Load the packaged snapshot at request time

**Files:**
- Create: `apps/web/lib/mcp/snapshot.ts`
- Modify: `apps/web/next.config.ts`
- Test: `apps/web/tests/mcp/snapshot.test.ts`

**Interfaces:**
- Produces: `export function loadPackagedSnapshot(): FactQuerySnapshot` — synchronous, memoized at module scope, throws a bundle error if the artifact is absent or its `schemaVersion` does not match `SCHEMA_VERSION`.

`lib/factQuery/**` may not import `fs` (`purity.test.ts`). This module is why `lib/mcp/` exists.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/mcp/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashDataVersion } from "../../lib/factQuery/canonical";
import { queryNational } from "../../lib/factQuery/queryNational";
import { SCHEMA_VERSION } from "../../lib/factQuery/types";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

describe("packaged snapshot", () => {
  it("loads, and its content still hashes to its own dataVersion", () => {
    const snapshot = loadPackagedSnapshot();

    expect(snapshot.schemaVersion).toBe(SCHEMA_VERSION);
    expect(snapshot.dataVersion).toMatch(/^[0-9a-f]{64}$/);
    // Proves the JSON round trip lost nothing: the digest is computed over the
    // parsed object, so any dropped or coerced value would change it.
    expect(hashDataVersion(snapshot)).toBe(snapshot.dataVersion);
  });

  it("is memoized, not re-read per call", () => {
    expect(loadPackagedSnapshot()).toBe(loadPackagedSnapshot());
  });

  it("answers a real query", () => {
    const result = queryNational(loadPackagedSnapshot(), {
      side: "expenditure",
      seriesIds: ["expenditure.total"],
      years: [2024],
      measure: "amount_gel",
    });

    expect(result.kind).toBe("observations");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run tests/mcp/snapshot.test.ts
```

Expected: FAIL, `Cannot find module '../../lib/mcp/snapshot'`.

- [ ] **Step 3: Implement the loader**

Create `apps/web/lib/mcp/snapshot.ts`:

```ts
// apps/web/lib/mcp/snapshot.ts
//
// The one place the runtime touches the filesystem. lib/factQuery/ may not
// import fs (tests/factQuery/purity.test.ts), and the route must answer with no
// database and no network (spec 4.4, 11.2), so the snapshot written by
// `data:prepare-fact-query-snapshot` during prebuild is read from the deployed
// bundle exactly once per instance.
import { readFileSync } from "node:fs";
import path from "node:path";
import { SCHEMA_VERSION, type FactQuerySnapshot } from "../factQuery/types";

const SNAPSHOT_PATH = path.join(process.cwd(), "lib", "factQuery", "generated", "snapshot.json");

let cached: FactQuerySnapshot | undefined;

/**
 * Measured cost on the 3.26 MB artifact: 6.8 ms to read, 4.8 ms to parse, once
 * per instance. Deliberately synchronous — it runs during module evaluation on
 * the first request, and an async loader would let two concurrent requests race
 * to parse the same 3 MB.
 *
 * An unreadable or incompatible bundle throws. Spec 4.4: the endpoint returns a
 * service error with no figures; it never falls back to another data version or
 * an outside source.
 */
export function loadPackagedSnapshot(): FactQuerySnapshot {
  if (cached !== undefined) return cached;

  let parsed: FactQuerySnapshot;
  try {
    parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as FactQuerySnapshot;
  } catch {
    // No path, no errno, no environment detail: spec 11.2 forbids leaking
    // internal paths through errors.
    throw new Error("snapshot_unavailable");
  }

  if (parsed.schemaVersion !== SCHEMA_VERSION) throw new Error("snapshot_incompatible");
  if (!/^[0-9a-f]{64}$/.test(parsed.dataVersion ?? "")) throw new Error("snapshot_incompatible");

  cached = parsed;
  return cached;
}
```

- [ ] **Step 4: Trace the artifact into the function bundle**

In `apps/web/next.config.ts`, add above `async redirects()`:

```ts
  // The /mcp route reads the build-time snapshot at request time. Next traces
  // only what it can see statically, and this path is built by `prebuild`
  // rather than imported, so it must be included explicitly or the deployed
  // function has no data to answer from.
  outputFileTracingIncludes: {
    "/mcp": ["./lib/factQuery/generated/snapshot.json"],
  },
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run tests/mcp/snapshot.test.ts
```

Expected: PASS, 3 tests. If the artifact is missing, run `npm run data:prepare-fact-query-snapshot` first.

- [ ] **Step 6: Prove the artifact reaches the built function**

This is the step that catches a tracing mistake before deployment, so do not skip it. Task 4 creates the route; until then, verify after Task 4 and record the result here. The check:

```bash
npm run build && node -e "const t=require('./.next/server/app/mcp/route.js.nft.json'); console.log(t.files.filter(f=>f.includes('snapshot.json')))"
```

Expected: a non-empty array naming `snapshot.json`. If the trace file has a different name, locate it with `ls .next/server/app/mcp/`. If the array is empty, the fallback is a static import (`import snapshotJson from "../factQuery/generated/snapshot.json"`), which Next bundles unconditionally at the cost of a larger function; take it only if tracing genuinely fails, and record why.

- [ ] **Step 7: Commit**

```bash
git add lib/mcp/snapshot.ts next.config.ts tests/mcp/snapshot.test.ts
git commit -m "feat(mcp): load the packaged snapshot at request time"
```

---

## Task 4: The `/mcp` route and its seven tools

**Files:**
- Create: `apps/web/lib/mcp/tools.ts`, `apps/web/lib/mcp/instructions.ts`, `apps/web/app/mcp/route.ts`
- Modify: `apps/web/package.json` (dependency)
- Test: `apps/web/tests/mcp/tools.test.ts`, `apps/web/tests/mcp/route.test.ts`

**Interfaces:**
- Consumes: `LIMITS`, `toolResult`, `tooLargeResponse` (Task 2); `loadPackagedSnapshot` (Task 3); the seven functions and seven input schemas from `lib/factQuery`.
- Produces:
  - `export const TOOLS: readonly ToolDefinition[]` where `ToolDefinition = { name: string; title: string; description: string; schema: z.ZodTypeAny; run: (snapshot: FactQuerySnapshot, input: never) => FactQueryResponse }` (`never` so the seven differently-typed inputs share one readonly array; each handler casts its own parsed value)
  - `export function createMcpServer(): McpServer`
  - `export const SERVER_INSTRUCTIONS: string`

Tool names: `describe_coverage`, `query_national`, `query_ministries`, `query_municipal`, `compare`, `rank`, `get_sources`.

- [ ] **Step 1: Install the SDK at an exact version**

```bash
npm install --save-exact @modelcontextprotocol/sdk@1.30.0
```

Verify the pin and the protocol revision:

```bash
node -e "console.log(require('./package.json').dependencies['@modelcontextprotocol/sdk'])" && node -e "import('@modelcontextprotocol/sdk/types.js').then(t=>console.log(t.LATEST_PROTOCOL_VERSION, t.SUPPORTED_PROTOCOL_VERSIONS))"
```

Expected: `1.30.0` with no caret, then `2025-11-25 [ '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07' ]`.

Then run `npm audit --audit-level=high` — CI fails on high advisories and this dependency pulls a large transitive tree.

- [ ] **Step 2: Write the failing test**

Create `apps/web/tests/mcp/tools.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, SERVER_INSTRUCTIONS, TOOLS } from "../../lib/mcp/tools";

async function connected() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([createMcpServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("MCP tool surface", () => {
  it("advertises exactly the seven read-only query functions", async () => {
    const { tools } = await (await connected()).listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "compare", "describe_coverage", "get_sources", "query_ministries",
      "query_municipal", "query_national", "rank",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name}`).toBe(true);
      expect(tool.annotations?.destructiveHint, `${tool.name}`).toBe(false);
      expect(tool.annotations?.openWorldHint, `${tool.name}`).toBe(false);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description!.length).toBeGreaterThan(40);
    }
  });

  // The .refine() constraints do not survive into JSON Schema (verified with
  // z4mini.toJSONSchema, which the SDK uses for Zod v4). A model that cannot
  // see them must be told them in words, or it will guess and get an error.
  it("states in prose the constraints JSON Schema cannot express", async () => {
    const { tools } = await (await connected()).listTools();
    const compare = tools.find((tool) => tool.name === "compare")!;
    const rank = tools.find((tool) => tool.name === "rank")!;

    expect(compare.description).toMatch(/fromYear/);
    expect(rank.description).toMatch(/year|fromYear/);
  });

  it("answers a real call with structured content and text", async () => {
    const result = await (await connected()).callTool({
      name: "query_national",
      arguments: { side: "expenditure", seriesIds: ["expenditure.total"], years: [2024], measure: "amount_gel" },
    });

    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { kind: string }).kind).toBe("observations");
    expect((result.content as { type: string; text: string }[])[0]!.text).toContain("2024");
  });

  it("returns a tool error, not a transport failure, for a bad argument", async () => {
    const result = await (await connected()).callTool({
      name: "query_national",
      arguments: { side: "expenditure", seriesIds: ["expenditure.not_a_series"], years: [2024], measure: "amount_gel" },
    });

    expect(result.isError).toBe(true);
  });

  it("tells the client what the service is for and what it must not claim", () => {
    // Spec 13: the truth policy is part of the contract, not decoration.
    expect(SERVER_INSTRUCTIONS).toMatch(/CC BY 4\.0/);
    expect(SERVER_INSTRUCTIONS).toMatch(/GEL/);
    expect(SERVER_INSTRUCTIONS.toLowerCase()).toMatch(/caveat|limitation/);
    expect(SERVER_INSTRUCTIONS.toLowerCase()).toMatch(/deficit/);
    expect(TOOLS).toHaveLength(7);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
npx vitest run tests/mcp/tools.test.ts
```

Expected: FAIL, `Cannot find module '../../lib/mcp/tools'`.

- [ ] **Step 4: Write the server instructions**

Create `apps/web/lib/mcp/instructions.ts` exporting `SERVER_INSTRUCTIONS`. It must state, in plain English (this text is read by models, not by site visitors):

- what the service serves: reviewed annual Georgian state-budget revenue and expenditure 2004–2025, ministries and major programs, and municipal expenditure 2015–2025;
- that all amounts are GEL, nominal, not inflation-adjusted, and that shares and per-resident values are derived from the published denominators;
- that `basis` is `actual` or `planned` and actual wins where both exist;
- that a `missing` cell means the reviewed data does not contain it — never estimate, interpolate or infer it;
- that national revenue and national expenditure are **different accounting boundaries**: subtracting their totals is not a deficit;
- that every returned severe caveat must be shown to the user near the figure it qualifies;
- that figures must be cited from `meta.sources` and `documentIds`, and the licence is CC BY 4.0 with attribution to Fiscal.ge;
- the §13 truth policy verbatim in substance: verified figures may be explained and clearly identified interpretations offered, but unsupported causes, outcomes, assumptions or predictions must not be presented as established fact, and an increase in spending does not by itself prove improved services, efficiency, corruption or policy success;
- that when the data cannot answer a question, the correct response is to say so.

- [ ] **Step 5: Implement the tools module**

Create `apps/web/lib/mcp/tools.ts`. The shape, with one tool written out in full and the rest following it exactly:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import {
  compare, describeCoverage, getSources, queryMinistries, queryMunicipal, queryNational,
} from "../factQuery";
import {
  compareInput, describeCoverageInput, getSourcesInput, queryMinistriesInput,
  queryMunicipalInput, queryNationalInput, rankInput,
} from "../factQuery/schemas";
import { rank } from "../factQuery/rank";
import { LIMITS, toolResult, tooLargeResponse } from "./result";
import { loadPackagedSnapshot } from "./snapshot";
import { SERVER_INSTRUCTIONS } from "./instructions";
import type { FactQueryResponse, FactQuerySnapshot } from "../factQuery/types";

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  schema: z.ZodTypeAny;
  run: (snapshot: FactQuerySnapshot, input: never) => FactQueryResponse;
};

// Read-only, non-destructive, closed world: every answer comes from the
// packaged snapshot, so there is nothing to write and nothing outside to reach.
const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "query_national",
    title: "სახელმწიფო ბიუჯეტი",
    description:
      "Annual Georgian state-budget revenue or expenditure by category, 2004-2025, in nominal GEL. " +
      "Measures: amount_gel, share_of_total_pct, share_of_gdp_pct. " +
      "Revenue and expenditure are different accounting boundaries: subtracting their totals is not a deficit.",
    schema: queryNationalInput,
    run: (snapshot, input) => queryNational(snapshot, input),
  },
  // ... describe_coverage, query_ministries, query_municipal, compare, rank, get_sources
] as const;

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "fiscal-ge", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.schema, annotations: ANNOTATIONS },
      (args: unknown) => {
        const snapshot = loadPackagedSnapshot();
        const parsed = tool.schema.safeParse(args);
        if (!parsed.success) {
          // The core owns the bilingual error text; a raw ZodError would be
          // English-only and would leak our internal field paths.
          return toolResult(invalidParameters(snapshot, parsed.error));
        }

        const response = tool.run(snapshot, parsed.data as never);
        const cells = countCells(response);
        if (cells > LIMITS.cells) {
          return toolResult(tooLargeResponse(snapshot, { returned: cells, bytes: 0 }));
        }

        const result = toolResult(response);
        const bytes = Buffer.byteLength(JSON.stringify(result), "utf8");
        // The byte ceiling is the binding gate, not the cell cap: 495 municipal
        // cells serialize past 512 KiB (see Finding B).
        return bytes > LIMITS.resultBytes ? toolResult(tooLargeResponse(snapshot, { returned: cells, bytes })) : result;
      },
    );
  }

  return server;
}
```

Write `invalidParameters` and `countCells` as small local helpers in the same file.

Then:

- `TOOLS` — seven entries, each with the Zod schema imported from `lib/factQuery/schemas.ts` (do not redefine any schema) and a `run` that calls the matching function.
- Descriptions in English, each naming: what the tool answers, its dataset and year coverage, its legal measures, and any constraint the JSON Schema cannot carry (`compare` requires `fromYear < toYear`; `rank` needs `year` for `metric: "value"` and `fromYear`+`toYear` for change metrics; `rank` on municipalities needs `entityType` and exactly one `seriesId`).
- `createMcpServer()` builds `new McpServer({ name: "fiscal-ge", version: <package version> }, { instructions: SERVER_INSTRUCTIONS })` and calls `registerTool` for each entry with `annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }`.
- Each handler: `loadPackagedSnapshot()` → `definition.schema.parse(args)` → `definition.run` → cell pre-check against `LIMITS.cells` → `toolResult` → serialized-size check against `LIMITS.resultBytes` → on breach, `toolResult(tooLargeResponse(...))`.
- A Zod parse failure becomes the core's own `invalid_parameters` error envelope, not a thrown exception, so the client sees the bilingual message.

If `registerTool` rejects a refined schema (`compareInput`, `rankInput` are `.refine()`d and are not plain `ZodObject`), the fallback is to register the unrefined base object as `inputSchema` and parse with the full refined schema inside the handler — export the base objects from `schemas.ts` for that, and keep the refined schema as the parser so the constraint is still enforced. Verify which path is needed by running the test; do not guess.

- [ ] **Step 6: Run the tools test**

```bash
npx vitest run tests/mcp/tools.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Write the route handler**

Create `apps/web/app/mcp/route.ts`:

```ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../../lib/mcp/tools";

// The only request-time code in the repository. Node runtime: the snapshot
// loader reads from the deployed bundle. Never prerendered — this is a
// protocol endpoint, not a page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10; // spec 11.3: 10 s request ceiling

async function handle(request: Request): Promise<Response> {
  // Stateless: no sessionIdGenerator, no session store, one transport per
  // request. enableJsonResponse keeps a fixed single POST a plain JSON reply
  // rather than an SSE stream (spec 11.1).
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer();
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export { handle as POST, handle as GET, handle as DELETE };
```

Task 5 wraps this with the security and limit checks; keep this step to transport wiring so a failure here is unambiguous.

- [ ] **Step 8: Write the route test**

Create `apps/web/tests/mcp/route.test.ts` driving the exported handler with real `Request` objects: an `initialize` POST returning protocol `2025-11-25`; a `tools/list` POST returning seven tools; a `tools/call` POST returning a figure; an unknown method returning a JSON-RPC error; malformed JSON returning a 400. Assert the initialize response advertises `2025-11-25` and no `Mcp-Session-Id` header (stateless).

- [ ] **Step 9: Run the full suite and build**

```bash
npm run check && npm run build
```

Expected: both exit 0. Then run Task 3 Step 6's tracing check now that `/mcp` exists.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json lib/mcp/tools.ts lib/mcp/instructions.ts app/mcp/route.ts tests/mcp/tools.test.ts tests/mcp/route.test.ts
git commit -m "feat(mcp): serve the seven query functions over Streamable HTTP"
```

---

## Task 5: The bilingual reference fixture

**Files:**
- Create: `apps/web/tests/factQuery/fixtures/referenceIntents.ts`
- Create: `apps/web/tests/factQuery/reference.test.ts`
- Create: `docs/data-methodology/ai-reference-intents.md`

Section 14.3 defines this and states plainly that the inventory "defines tests to be authored during implementation; it is not a claim that the fixture exists or has passed." Nothing has authored it yet. It is the deliverable that actually proves the product answers real questions correctly, and it must exist before real clients are pointed at the endpoint in Task 9.

"Bilingual" is the language of the **question**, not of the data. Labels stay Georgian (section 10); the client answers in the asking language by translating them, and the fixture checks it does so without corrupting figures, scope or caveats.

**Interfaces:**
- Produces: `export const REFERENCE_INTENTS: readonly ReferenceIntent[]` where

```ts
export type ReferenceIntent = {
  id: number;
  promptKa: string;
  promptEn: string;
  /** The tool calls a correct client must make. Order-independent. */
  expectedCalls: { tool: string; arguments: Record<string, unknown> }[];
  /** Manually checked against the reviewed data. `null` means the cell must be missing. */
  expectedValues: { observationId: string; value: number | null; unit: string }[];
  allowedRounding: number;
  expectedStatus: "ok" | "partial" | "empty" | "error";
  expectedBudgetScope: string | null;
  requiredSourceIds: string[];
  requiredDocumentIds: string[];
  requiredCaveatCodes: string[];
  /** True when the correct answer is to decline or qualify rather than compute. */
  mustDeclineOrQualify: boolean;
  note: string;
};
```

- [ ] **Step 1: Author the 20 intents**

Create `apps/web/tests/factQuery/fixtures/referenceIntents.ts` with all 20 rows of section 14.3's table, each carrying `promptKa` and `promptEn` — 40 prompts. Copy the intents verbatim in substance; do not substitute easier questions.

Fill `expectedValues` by **querying the snapshot and manually checking the result against the reviewed data**, not by recording whatever the code returns. Two values are already fixed by the spec and must be typed in as constants, then confirmed:

- intent 3, total receipts 2004: `2,283,035,800` GEL exactly (section 3);
- intent 12, Khulo 2024: `30,969,077.43` GEL, measure `functional_total_fallback_missing_payment_actual`, and it must **not** be presented as a claimed payment actual (section 2.4).

Intent 4 (increase in liabilities, 2004) expects `null` — missing, never zero. Intent 18 (country aggregate or historical per-resident) expects an error or an explicit refusal; there is no denominator to invent. Intent 19 (an excluded municipal code) expects an exclusion with an explanation and **no numeric territorial row**.

Money uses the existing exact-money helpers; ratio intents use a tolerance tight enough to catch a scaling or denominator mistake. Formatting never determines an expectation.

- [ ] **Step 2: Write the deterministic test and watch it fail**

Create `apps/web/tests/factQuery/reference.test.ts`, which for each intent runs `expectedCalls` against the snapshot through the same dispatch `lib/mcp/tools.ts` uses, then asserts value, status, budget scope, required sources, required documents and required caveats. Assert `REFERENCE_INTENTS` has exactly 20 entries and that every one has both a non-empty `promptKa` and `promptEn`.

```bash
npx vitest run tests/factQuery/reference.test.ts
```

Expected: FAIL while intents are still being filled in. Each failure names the intent id and what disagreed. Fix the fixture where the fixture is wrong; **stop and report** where the code is wrong — a disagreement here is a section 18 stop condition, not something to reconcile by editing the expectation.

- [ ] **Step 3: Add the boundary cases section 14.3 requires beyond the table**

In the same test file: the other excluded municipal codes, unknown entity and series IDs, an unsupported 2026 request at this baseline, negative corrections, zero comparison bases, ranking ties, each limit error, and a `data_version_changed` response when `expectedDataVersion` does not match.

- [ ] **Step 4: Run the suite**

```bash
npx vitest run tests/factQuery/
```

Expected: PASS.

- [ ] **Step 5: Publish the intents as methodology**

Create `docs/data-methodology/ai-reference-intents.md` listing the 20 intents, both prompts, the expected answer in words, and the caveat each one must carry. This is what an owner reads to check the service answers real questions, without reading test code.

- [ ] **Step 6: Commit**

```bash
git add tests/factQuery/fixtures/referenceIntents.ts tests/factQuery/reference.test.ts ../../docs/data-methodology/ai-reference-intents.md
git commit -m "test(factQuery): author the 20-intent bilingual reference fixture"
```

Running explicit calls tests arithmetic and evidence, not language understanding. The 40 prompts go through real AI clients in Task 9; that half may cost money and needs an authorized test budget. The production service still makes no inference calls.

---

## Task 6: Security, limits, privacy and the pause switch

**Files:**
- Create: `apps/web/lib/mcp/security.ts`, `apps/web/lib/mcp/limits.ts`, `apps/web/lib/mcp/log.ts`
- Modify: `apps/web/app/mcp/route.ts`, `docs/deployment.md`
- Test: `apps/web/tests/mcp/security.test.ts`, `apps/web/tests/mcp/limits.test.ts`

**Interfaces:**
- Produces:
  - `export function checkRequest(request: Request): { ok: true } | { ok: false; status: number; code: string }`
  - `export function clientKey(request: Request): string | null` — from trusted platform metadata only
  - `export function isPaused(): boolean`
  - `export type Counter = { hit(key: string, windowSeconds: number, max: number): Promise<"allow" | "deny" | "unavailable"> }`
  - `export function logToolCall(record: ToolCallLog): void` where `ToolCallLog` allows only: `tool`, `datasetId?`, `measure?`, `years?`, `entityCount?`, `seriesCount?`, `dataVersion`, `resultCount`, `resultBytes`, `durationMs`, `outcome`, `errorCode?`

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/mcp/security.test.ts` must assert:
- a POST with no `Origin` is allowed (origin-less server clients are valid, §11.2);
- a POST with an unapproved `Origin` is rejected 403;
- a POST with an approved `Origin` is allowed;
- a POST with a `Host` outside the deployment's configured hosts is rejected 403;
- a forwarded-host header alone cannot change the accepted host (spoofing);
- a body over `LIMITS.bodyBytes` is rejected 413 **before** it is fully parsed — assert on a `Content-Length` above the cap without reading the stream;
- no rejection response body contains any environment variable name, absolute path, or stack frame.

`apps/web/tests/mcp/limits.test.ts` must assert:
- `isPaused()` is true when the pause variable is set, and a paused request returns a `service_unavailable` envelope with `retryable: true` and HTTP 503;
- a counter returning `"unavailable"` stops expensive processing with a retryable service error rather than quietly disabling the limit (§11.3);
- a counter returning `"deny"` produces `rate_limited` with retry guidance;
- `logToolCall` drops any key not on the allow-list — pass a record with `ip`, `userAgent`, `body` and `prompt` and assert none appears in the emitted record.

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run tests/mcp/security.test.ts tests/mcp/limits.test.ts
```

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement the three modules**

`security.ts` — the two checks that are easiest to get subtly wrong, written out:

```ts
// Host is read from the Host header ONLY. X-Forwarded-Host is client-supplied
// on a direct connection, so honouring it would let a caller name whatever host
// it liked and walk straight through this check (spec 11.2: reject spoofed host
// forwarding).
function approvedHosts(): Set<string> {
  const hosts = new Set<string>();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site !== undefined) hosts.add(new URL(site).host);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel !== undefined) hosts.add(vercel);
  return hosts;
}

export function checkRequest(request: Request): { ok: true } | { ok: false; status: number; code: string } {
  const hosts = approvedHosts();
  const host = request.headers.get("host");
  if (hosts.size > 0 && (host === null || !hosts.has(host))) {
    return { ok: false, status: 403, code: "forbidden_host" };
  }

  const origin = request.headers.get("origin");
  // No Origin at all is the normal case for a server-side MCP client and is
  // permitted (spec 11.2). A PRESENT origin must be one we explicitly support:
  // an unknown or opaque ("null") origin is rejected rather than waved through.
  if (origin !== null) {
    const allowed = (process.env.MCP_ALLOWED_ORIGINS ?? "")
      .split(",").map((value) => value.trim()).filter((value) => value.length > 0);
    if (!allowed.includes(origin)) return { ok: false, status: 403, code: "forbidden_origin" };
  }

  return { ok: true };
}
```

An origin check is a protocol security control, not proof of caller identity. Never reply `Access-Control-Allow-Origin: *` and never set `Access-Control-Allow-Credentials`; echo the one approved origin.

`log.ts` — build from an allow-list, never by spreading the input:

```ts
export type ToolCallLog = {
  tool: string; datasetId?: string; measure?: string; years?: string;
  entityCount?: number; seriesCount?: number; dataVersion: string;
  resultCount: number; resultBytes: number; durationMs: number;
  outcome: "ok" | "error"; errorCode?: string;
};

// Spreading the caller's object is how a request body, a user agent or an
// address ends up in analytics. Every field is named here or it does not ship
// (spec 11.5).
export function logToolCall(record: ToolCallLog): void {
  const safe = {
    tool: record.tool, datasetId: record.datasetId, measure: record.measure,
    years: record.years, entityCount: record.entityCount, seriesCount: record.seriesCount,
    dataVersion: record.dataVersion, resultCount: record.resultCount,
    resultBytes: record.resultBytes, durationMs: record.durationMs,
    outcome: record.outcome, errorCode: record.errorCode,
  };
  process.stdout.write(`${JSON.stringify(safe)}\n`);
}
```

`security.ts`, remaining rules:
- Approved origins come from `MCP_ALLOWED_ORIGINS` (comma-separated, exact origins, no wildcard). Absent or empty means browser origins are not supported and only origin-less clients are served.
- Approved hosts come from the deployment's own configuration (`NEXT_PUBLIC_SITE_URL` host plus `VERCEL_PROJECT_PRODUCTION_URL` when present). Read the `Host` header directly; ignore `X-Forwarded-Host` for the decision.
- No credentialed CORS. If an origin is approved, reply with that exact origin, never `*`, and never `Access-Control-Allow-Credentials`.
- `clientKey` reads only the platform's own trusted request metadata; if it is absent, return `null` and let the caller treat the request as unkeyed rather than trusting a client-supplied header.
- Comment the reason on each check: an origin check is a protocol security control, not proof of caller identity (§11.2).

`limits.ts`:
- The constants live in `result.ts`; re-export rather than duplicate.
- `isPaused()` reads `MCP_ENABLED`. **The endpoint is disabled unless `MCP_ENABLED === "true"`.** Default-off is deliberate: §18 makes per-process-only abuse protection and unapproved paid services stop conditions, so the route ships deployed and dark until the owner authorizes the hosting configuration and any operating budget (Task 9 gate). Pausing must not affect static pages or downloads — it is one variable on one route.
- `Counter` is an interface with two implementations: a no-op that returns `"unavailable"` (the default, which therefore fails closed), and the platform limiter chosen at the Task 8 gate. Do not add a paid dependency in this task.

`log.ts`:
- Build the record from an explicit allow-list of keys. Never spread the input. Never log headers, bodies, addresses or user agents. `years` is logged as a compact range, not the raw array, when it exceeds five entries.

- [ ] **Step 4: Wire them into the route**

In `app/mcp/route.ts`, before creating the transport: `isPaused()` → 503; `checkRequest` → its status; `Content-Length` over `LIMITS.bodyBytes` → 413; counter check → 429 or 503. After the call, `logToolCall`. Each rejection body is a JSON-RPC error with the core's bilingual message shape.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run tests/mcp/
```

Expected: PASS.

- [ ] **Step 6: Document the runtime in `docs/deployment.md`**

Add a section covering: the first request-time route and what changed; the snapshot bundling and how to confirm it in a build; the declared protocol revision and pinned SDK version; every §11.3 limit and where it is enforced; the log fields and the 14-day / 90-day retention split; the `MCP_ENABLED` pause switch with the exact commands to flip it and the statement that static pages and downloads are unaffected; rollback; and the live-proof procedure from §16. Do not record temporary deployment status.

- [ ] **Step 7: Commit**

```bash
git add lib/mcp/security.ts lib/mcp/limits.ts lib/mcp/log.ts app/mcp/route.ts tests/mcp/security.test.ts tests/mcp/limits.test.ts ../../docs/deployment.md
git commit -m "feat(mcp): enforce origin, size, rate and pause controls"
```

---

## Task 7: The connection page

**Files:**
- Create: `apps/web/app/connect/page.tsx`
- Modify: `apps/web/app/sitemap.ts`, `DESIGN.md`
- Test: `apps/web/tests/browser/connect.spec.ts`

An MCP endpoint with no discovery path is a feature nobody uses. This is the one human-facing surface in §12 and the entire funnel (§12.3).

- [ ] **Step 1: Write the failing browser test**

Create `apps/web/tests/browser/connect.spec.ts` asserting, against `/connect`:
- the `h1` is Georgian;
- the endpoint URL `https://fiscal.ge/mcp` is visible and has a copy control that is keyboard reachable and has an accessible Georgian name;
- per-application connection steps are present for at least two named clients;
- example questions are present in Georgian;
- the coverage statement names **both** what is served (2004–2025 national, 2015–2025 municipal) and what is not (quarterly, monthly, debt, capital projects) — this is what stops a user asking for out-of-scope data and concluding the tool is broken;
- the page passes the suite's existing responsive and accessibility checks at mobile and desktop widths;
- the page is reachable from `/about` or the footer, whichever the site's existing navigation convention uses.

- [ ] **Step 2: Run it to verify it fails**

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/connect.spec.ts
```

Expected: FAIL — 404, no such route. Follow the local recipe: build with `NEXT_PUBLIC_SITE_URL` set, start the server yourself, and kill any stale process on the port first.

- [ ] **Step 3: Build the page**

Model it on `apps/web/app/about/page.tsx`: same shell (`SiteHeader`, `BreadcrumbTrail`, `SiteFooter`), same `fiscalMetadata` call with `path: "/connect"`, same section rhythm and type scale. `DESIGN.md` v4.1 governs; introduce no new visual direction, chart type or interaction pattern. The copy control is the only interactive element — a button that writes the endpoint to the clipboard and confirms in Georgian.

Derive the coverage years from loaded facts (`DESIGN.md` §2.1 and the UI contract: never hardcode coverage). Use the same loader the other pages use.

- [ ] **Step 4: Add the sitemap entry**

In `apps/web/app/sitemap.ts`, add `{ url: `${siteUrl}/connect`, lastModified }` beside `/about`. The connection page is HTML and is linked from `llms.txt`, so `agentFiles.test.ts`'s sitemap assertion requires it.

- [ ] **Step 5: Run the test**

```bash
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/connect.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Record the page in `DESIGN.md`**

Add the connection page to `DESIGN.md` under the existing page inventory: its shell, its one new control (the copy button) and its Georgian-first copy rule. Preserve the production visual system; record what exists rather than proposing anything new.

- [ ] **Step 7: Commit**

```bash
git add app/connect/page.tsx app/sitemap.ts tests/browser/connect.spec.ts ../../DESIGN.md
git commit -m "feat(connect): publish the Georgian MCP connection page"
```

---

## Task 8: `llms.txt`, the three `agentFiles` updates, and the scope documents

**Files:**
- Modify: `apps/web/public/llms.txt`, `apps/web/tests/seo/agentFiles.test.ts`, `Project_Definition.md`, `AGENTS.md`, `CLAUDE.md`, `docs/data-methodology/ai-grounding-and-caveats.md`

§16 Part 3 names three coordinated updates in `agentFiles.test.ts`. All three must land in this change or CI fails or the site publishes a false statement.

- [ ] **Step 1: Update the test first, and watch it fail**

In `apps/web/tests/seo/agentFiles.test.ts`:
1. Replace `expect(content).toMatch(/no public API/i)` with an assertion that the text describes the read-only MCP connection **and** still excludes what remains excluded — for example `expect(content).toMatch(/read-only MCP/i)` plus `expect(content).toMatch(/no REST query API/i)`.
2. Add `"https://fiscal.ge/connect"` to `requiredTargets` in the position it will occupy in the file — `targets` is compared with `toEqual`, so order matters.
3. The `htmlTargets` filter already excludes `.xml`, `.json` and `.csv`, so `/connect` correctly falls through to the sitemap assertion. Confirm the sitemap entry from Task 7 satisfies it rather than weakening the filter.

```bash
npx vitest run tests/seo/agentFiles.test.ts
```

Expected: FAIL — `/connect` is not in `llms.txt` yet, and the wording assertions do not match.

- [ ] **Step 2: Reword `llms.txt`**

Replace the sentence `Fiscal.ge has no public API; the bulk files below are static publications, not a query service.` with wording that:
- describes the read-only MCP connection as a public programmatic interface, honestly (§2.2: "MCP is a public programmatic interface and must be described honestly as such");
- preserves the exclusions that remain true: no REST query API, no writes, no accounts, no sub-annual or unavailable datasets;
- keeps the existing "do not invent values" and "annual" guarantees the test asserts.

Add the connection link. Keep it concise — full taxonomies belong behind links, not in the root guide. Generate no second handwritten inventory: the manifest and catalogue already carry coverage and identifiers.

- [ ] **Step 3: Run the test**

```bash
npx vitest run tests/seo/agentFiles.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 4: Add the bounded V2 scope section**

In `Project_Definition.md`, add a **V2 Scope** section. Leave V1's §2 and its "Excluded From V1" list untouched — they are the record of a shipped release. The new section states that V2 lifts the public-interface exclusion **only** for the read-only MCP connection and the static publications, and that a REST query API, accounts and write access remain excluded. Distinguish the existing revenue and expenditure concepts (§15).

- [ ] **Step 5: Correct the static-build claim**

In `AGENTS.md`, replace the blanket fully-static statement in **Project Snapshot** with: static explorer pages plus one isolated snapshot-backed `/mcp` runtime route that reads no database at request time. Do not touch the Engineering Behavior section.

In `CLAUDE.md`, record the actual generation and verification commands for the runtime and add the runtime and connection-page items to the definition of done.

In `docs/data-methodology/ai-grounding-and-caveats.md` (CRLF), add the MCP connection beside the bulk files: the endpoint, the declared protocol revision, the seven tools, and the statement that the same observation and caveat definitions serve both surfaces.

In each existing dataset methodology under `docs/data-methodology/`, add **only** the relevant public-query, source and measure reference — which tool serves that dataset and which measures are legal for it. Section 15 also requires resolving any contradiction found between a methodology and the implemented behaviour **before** publication; if one turns up, stop and report it rather than editing the methodology to match the code.

- [ ] **Step 6: Run the full check**

```bash
npm run check
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add public/llms.txt tests/seo/agentFiles.test.ts ../../Project_Definition.md ../../AGENTS.md ../../CLAUDE.md ../../docs/data-methodology/ai-grounding-and-caveats.md
git commit -m "docs(mcp): describe the connection honestly and bound the V2 scope"
```

---

## Task 9: Integration verification and release evidence

**Files:**
- Create: `docs/deployment/2026-XX-XX-mcp-release-verification.md` (dated on the day it is run)

Nothing here is a code change. It is the §16 Part 3 gate, and it is what the owner verifies without reading code.

- [ ] **Step 1: Owner gate — hosting, limiter and budget**

**Stop and ask the owner before any public enablement.** §11.4 and §18 require, on record: the actual hosting plan; whether a shared limiter is available and at what cost; measured resource use and expected traffic; budget alerts; and an approved operating budget. Implementation approval does not authorize a plan upgrade, a paid database, a paid counter, or unlimited overages.

Until this is answered, `MCP_ENABLED` stays unset and the route is deployed and dark. Record the answer in the verification document.

- [ ] **Step 2: MCP Inspector**

Run MCP Inspector against the deployed endpoint. Record the Inspector version. Confirm: initialization at `2025-11-25`; seven tools discovered with their schemas and read-only annotations; a valid call returning a figure with sources and caveats; an invalid call returning a tool error, not a transport failure; GET and DELETE behaving as the stateless transport defines (a browser GET returning 405 is not itself a failure).

- [ ] **Step 3: Two independently implemented real clients**

Connect at least two real AI clients that support the declared transport. Record client and SDK versions. Advertise only tested compatibility. At least one run must exercise: Georgian and English question handling, tool error recovery, a multi-step version-aware sequence, citations, and a severe caveat surfacing near the figure it qualifies.

Use the Khulo 2024 case deliberately: `show_warning=false` with `warning_type=source_actual_missing`. If a client presents that figure without its caveat, that is a release blocker, not a note.

- [ ] **Step 4: Limits, counter failure, pause and recovery**

Test against the deployment: origin and host rejection; invalid JSON; unknown methods; schema failures; each size limit; cross-instance quota enforcement; counter failure behaving as a retryable service error; timeout; cancellation; and pause followed by recovery. Confirm static pages, CSV downloads and JSON downloads keep working while `/mcp` is paused.

Confirm application logs contain none of the forbidden fields.

- [ ] **Step 5: Prove the db-mode snapshot equals the CSV-mode snapshot**

Production builds with `GEODATA_DATA_SOURCE=db` (the 2026-07-28 flip), and `buildFactQuerySnapshot` loads through `lib/data/servedData.ts`, which switches on that variable. Every verification in Tasks 1-8 ran in CSV mode. Section 14.2 requires the two to agree, and a `dataVersion` that differs by mode would mean the deployed endpoint and the published JSON files describe different releases.

```bash
GEODATA_DATA_SOURCE=csv npm run data:prepare-fact-query-snapshot
```

```bash
GEODATA_DATA_SOURCE=db npm run data:prepare-fact-query-snapshot
```

Each run prints `dataVersion=<hash>`. Expected: the two hashes are identical. If they differ, that is a section 18 stop condition — report the difference; do not pick a mode and proceed.

- [ ] **Step 6: No request-time database, no outside files**

Prove deployed queries answer with no database connectivity and that requests fetch no source document and read no file outside the deployed bundle.

- [ ] **Step 7: Browser citation verification**

In a real browser, open representative `exact_view` citation links and confirm year, categories, grouping and measure survive a reload. Verify multi-entity supporting links, methodology download links, JSON and CSV accessibility, the connection page, and existing explorer behaviour. An HTTP 200 without the correct restored view is not sufficient.

```bash
npm run test:browser
```

- [ ] **Step 8: Performance**

Under documented representative load, record warm p95 and first cold response, with test region, concurrency and payload sizes. Targets: warm p95 below 1 s, first cold response below 5 s, excluding the client model's own answer time. Failure requires investigation before public enablement — do not enable and hope.

- [ ] **Step 9: Release acceptance**

Walk §14.5 item by item and record each result. One critical failure blocks release; do not average it away.

- [ ] **Step 10: Write the verification document and commit**

Record every version, measurement and outcome from Steps 1–8 with dates. Store live evidence here, never in permanent agent instructions.

```bash
git add ../../docs/deployment/2026-XX-XX-mcp-release-verification.md
git commit -m "docs(mcp): record the Part 3 release verification evidence"
```

---

## Publishing

Only when the owner explicitly authorizes it:

```text
branch -> commits -> push -> draft PR -> required CI green -> review + resolved conversations -> merge -> delete branch
```

Do not bypass a required check. Do not push implementation commits to `main`. Production is proven only after Vercel reports `READY` for the merge commit **and** the six direct production checks in §16 pass — a green deploy-trigger workflow or a successful local build is not production proof.

---

## Open questions for the owner

These are carried forward and still unanswered. The first two predate this plan.

1. **`apps/web/lib/workbookSources.ts:160` weak https check.** A reviewer confirmed it is not exploitable today. Tighten it or accept it explicitly.
2. **2004 revenue components.** `rank` publishes a 2004→2005 table topped by `revenue.asset_decrease` at +476.6%. Part 3 exposes `rank` through MCP to outside clients, so this should be settled before Step 1's gate, not after.
3. **Hosting, limiter and operating budget** (Task 9 Step 1) — blocks public enablement, not implementation.
4. **Deferred from Part 2, unchanged:** the polymorphic `coverage` shape across published files; §12.1's "calculation rules" self-containment element, whose root cause is Part 1's `Observation` type; and `status` not being published.
