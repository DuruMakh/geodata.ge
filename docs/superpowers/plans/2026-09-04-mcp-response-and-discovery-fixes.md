# MCP response size and discovery fixes — implementation plan

**Goal:** Cut a broad `/mcp` response from 91 KB to ~42 KB without omitting any cited
document, and close three defects that only appear when a real client uses the endpoint.

**Origin:** Measured against the deployed preview on 2026-09-04. The size problem was found
by hitting a per-result limit on a 64-municipality ranking; the three discovery defects came
from a model reporting its own weak points after using the server, then verified against the
code. Two of that model's three claims were wrong as stated; the evidence below is what
survived checking.

## Global constraints

- Response rendering only. The snapshot, `dataVersion`, the published JSON files
  (`publications.ts` reads `snapshot.sources` directly) and `get_sources`' own `data` payload
  are untouched. No data revalidation, no re-import.
- No cited document is ever omitted from a response. Narrowing already guarantees this and
  the guarantee stands.
- The 20-intent reference fixture must pass unchanged. It asserts on `sourceIds` and
  `documentIds`; both survive every change here.
- Georgian and English messages stay bilingual wherever they already are.

---

## Task 1: Compact `meta.sources`

**Problem.** A 64-municipality ranking emits 66 documents × 1,063 B = 69 KB. Seven fields are
byte-identical across all 65 documents of the municipal source (`publisher`, `attribution`,
`licenceId`, `mediaType`, `retrievedAt`, `datasetId`, `role`), and two more (`sha256`,
`byteSize`) are integrity metadata that `get_sources` already serves.

**Files:** `lib/factQuery/meta.ts`, `lib/factQuery/types.ts`, `tests/factQuery/meta.test.ts`

- [ ] **Step 1:** Add a `ResponseSource` type: `ResolvedSource` with `documents:
  ResponseDocument[]` and optional `documentDefaults`. `ResponseDocument` is `PublicDocument`
  minus `sha256`/`byteSize`, with the seven hoistable fields optional.
- [ ] **Step 2:** In `buildResponseMeta`, after the existing narrowing, map each source: a
  hoistable field whose value is identical across every one of that source's documents moves
  into `documentDefaults` and is deleted from each document; a field that differs stays on
  each document. `sha256` and `byteSize` are always dropped. `documentId`, `title`, `years`,
  `officialUrl` and `archiveUrl` never hoist — they identify the specific document.
- [ ] **Step 3:** Tests — a field identical across documents is hoisted and absent from each
  document; a field that differs within one source stays per-document and no
  `documentDefaults` entry is made for it; `sha256`/`byteSize` are absent; document count is
  unchanged.
- [ ] **Verify:** `npx vitest run tests/factQuery/` passes; a 64-municipality ranking's
  `meta.sources` drops from ~69 KB to ~37 KB.

## Task 2: Group ranking exclusions by reason

**Problem.** `data.exclusions` is one row per excluded entity, each repeating an identical
Georgian sentence: 16.9 KB for 64 entities saying the same thing.

**Files:** `lib/factQuery/rank.ts`, `lib/mcp/result.ts`, `tests/factQuery/rank.test.ts`

- [ ] **Step 1:** Change the exclusion type from `{ id, reason }[]` to `{ reason, ids:
  string[] }[]`, preserving first-seen reason order and, within a reason, the existing id
  order.
- [ ] **Step 2:** Update the text twin at `result.ts:139` to print one line per reason with
  its ids, rather than `id (reason); id (reason); …`.
- [ ] **Step 3:** Update `rank.test.ts` assertions to the new shape, and add one asserting
  that the union of all `ids` equals the set of excluded entities — grouping must lose no id.
- [ ] **Verify:** `npx vitest run tests/factQuery/rank.test.ts`; exclusions block drops from
  16.9 KB to ~0.6 KB.

## Task 3: Declare `outputSchema` on all seven tools

**Problem.** Every response already carries `structuredContent`, but no tool declares an
`outputSchema`. Under the MCP spec that field is what tells a client structured output exists,
so clients fall back to parsing the human-readable text table — which is what a real client was
observed doing.

**Files:** `lib/mcp/tools.ts`, `lib/mcp/outputSchema.ts` (new), `tests/mcp/tools.test.ts`

- [ ] **Step 1:** Define one shared envelope schema in `lib/mcp/outputSchema.ts`: `kind`,
  `status`, `data`, `meta`, with `meta` typed (schemaVersion, dataVersion, releaseCommit,
  generatedAt, licence, licenceUrl, sources, caveats) and `data` a passthrough object. The SDK
  validates `structuredContent` against this schema and fails the call on a mismatch, so the
  schema is deliberately permissive where the payload varies by tool. Narrowing `data`
  per tool is a follow-up, not this task.
- [ ] **Step 2:** Pass `outputSchema` in the `registerTool` options alongside `inputSchema`.
- [ ] **Step 3:** Test that every registered tool advertises an `outputSchema` in `tools/list`,
  and that a real call's `structuredContent` validates against it.
- [ ] **Verify:** `npx vitest run tests/mcp/`; `tools/list` shows an `outputSchema` for all
  seven; a live `tools/call` still returns 200.

## Task 4: Make `describe_coverage` searchable before you know the dataset

**Problem A.** `search` filters within a dataset (`describeCoverage.ts:522`, `:528`), so with
no `datasetId` it returns nothing — silently. The tool's own description says "Ask this FIRST
when you do not already know an id", which is precisely when the dataset is also unknown.

**Problem B.** Matching is case-insensitive substring, so `ბათუმი` matches but `ბათუმის` —
the genitive, the form a real Georgian question uses — does not. `განათლების` likewise misses
`განათლება`, because Georgian changes the final vowel rather than only appending.

**Files:** `lib/factQuery/describeCoverage.ts`, `lib/mcp/tools.ts`,
`tests/factQuery/describeCoverage.test.ts`

- [ ] **Step 1:** When `search` is given and `datasetId` is not, search all four datasets and
  return the union. Each returned series and entity carries a `datasetId` field in this case
  only, so a caller can tell where a match lives; the single-dataset shape is unchanged.
- [ ] **Step 2:** Before matching, strip a common Georgian case ending from the query — `ის`,
  `ში`, `ზე`, `თვის`, `მა`, `ად`, `ით`, `ს` — and match on the stem, but only when the stem
  is at least 2 characters. Longest suffix wins. `ბათუმის` → `ბათუმ` → matches `ბათუმი`;
  `განათლების` → `განათლებ` → matches `განათლება`.
- [ ] **Step 3:** Update the `describe_coverage` description to state that `search` works
  without a `datasetId` and that matches then name their dataset.
- [ ] **Step 4:** Tests — cross-dataset search finds a municipal entity and a national series
  in one call; each cross-dataset match names its dataset; the single-dataset shape gains no
  `datasetId`; `ბათუმის` finds `ბათუმი`; `განათლების` finds `განათლება`; a two-character id
  like `06` is not matched by suffix stripping.
- [ ] **Verify:** `npx vitest run tests/factQuery/describeCoverage.test.ts`.

---

## Definition of done

1. `npm run check` and `npm run build` pass.
2. `npx vitest run tests/factQuery/reference.test.ts` — the 20-intent fixture — passes.
3. `docs/deployment.md` records the `meta.sources` / `get_sources` split.
4. Re-measured against the deployed preview: the 64-municipality ranking is ~42 KB, and
   `ბათუმის` with no `datasetId` returns Batumi.
