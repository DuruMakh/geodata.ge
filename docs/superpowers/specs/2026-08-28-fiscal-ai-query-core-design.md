# Fiscal.ge AI grounding layer — query core and external surfaces design

**Status:** Approved 2026-08-28

**Date:** 2026-08-28

**Baseline:** `main` at `3a1d86876` (PR #87 merged)

**Surface:** a new `apps/web/lib/factQuery/` module, one new Vercel Function route (`/mcp`), new static grounding artifacts (`/llms.txt`, indexable bulk dumps), English label completion for the municipal taxonomy, a Georgian/English evaluation fixture, and scope/deployment documentation updates. No reviewed source data changes.

## 1. Objective

Make Fiscal.ge the grounding source for Georgian public-budget analysis, on and off the site, by exposing the reviewed fact base through one deterministic, provenance-carrying, caveat-carrying query interface.

This spec covers the shared query core and the external (zero-inference-cost) surfaces only. The on-platform assistant is a separate, dependent spec — see §4.2 and §10.

The product insight this design rests on: the reviewed CSVs are already public and downloadable, so the data alone is not defensible. What is defensible is knowing how to read it correctly. A naive consumer pointed at `municipal-function-facts-2015-2025.csv` will rank excluded municipal codes, double-count Adjara, and compare 2004 revenue to 2005 — because nothing in the file says otherwise. Encoding those rules into every query response is the deliverable.

## 2. Evidence base

Every claim below was verified against the working tree at `3a1d86876`.

### 2.1 Facts that shape the design

| Fact | Verified value | Consequence |
| --- | --- | --- |
| Total reviewed fact volume | 10,241 CSV rows, 1.6 MB across `data/imports/` | No retrieval, embedding, or vector search is warranted. The correct architecture is deterministic query over a small typed table. |
| Basis coverage | Every served row is `actual` — 527 budget, 286 expenditure, 852 admin, all `basis=actual` | The planned/actual precedence rule is latent, not live. The envelope must still carry `basis`, because the CSV contract permits `planned` rows. |
| Aggregate IDs in taxonomy | `revenue.taxes_total` exists in `data/taxonomy/revenue-categories.json` but appears in zero fact rows | A consumer that enumerates taxonomy IDs and sums them would double-count. `describeCoverage` must distinguish served IDs from taxonomy IDs. |
| Municipal reconciliation flags | 46 rows carry `show_warning`; `warning_type` distribution is `financing_outside_functional` 21, `source_version_difference` 24, `source_actual_missing` 1, `none` 658 | A structured caveat channel already exists in the data and must be surfaced, not dropped. |
| English label coverage | `enLabel` present in `revenue-categories.json`, `spending-fields.json`, `admin-spending-categories.json`, and `data/glossary/category-glossary.csv`. Absent from `municipal-functions.json`, `municipal-regions.json`, and `municipalities.csv` | Bilingual output is roughly 85 strings away from complete: 10 functions, 11 regions, 64 municipality names. |
| Served-data contract | `apps/web/lib/servedRows.ts` is the zero-import browser contract; `apps/web/lib/data/servedData.ts` exposes `loadServedLandingData()`, `loadServedExplorerData()`, `loadServedMunicipalData()` over a `csv \| db` source with parity checks | The query core builds directly on these loaders. The AI and the explorer charts therefore read identical rows by construction, not by convention. |
| Runtime posture | No API routes exist; the site builds and deploys fully static | `/mcp` introduces the first server-side runtime. Static explorer routes are unaffected. |
| Downloads robots policy | `apps/web/next.config.ts` sets `X-Robots-Tag: noindex, follow` on `/downloads/methodology/:dataset/files/:path*` | Correct for the raw methodology archive; wrong for grounding dumps, which must be discoverable. Dumps need a separate indexable path. |
| Source registry | 104 entries in `data/sources/source-documents.csv` | `getSources` resolves against an existing registry; no new provenance model is required. |
| Data licence | CC BY 4.0, declared in `apps/web/components/site/site-footer.tsx:55` and `apps/web/app/about/page.tsx:34` | Attribution is an existing licence condition, not a new request. The new surfaces must state it machine-readably. |
| V1 scope text | `Project_Definition.md` §2 lists "Public API" under *Excluded From V1* | This spec requires an explicit, bounded scope amendment. |

### 2.2 Semantic traps the caveat engine must encode

These are the documented rules a consumer cannot infer from the files alone. Each is already owned by an existing methodology document; this spec re-expresses them as machine-readable caveats.

| Trap | Correct reading |
| --- | --- |
| Municipal codes `05`, `42`, `43`, `46`, `64` | Excluded from territorial analysis; their budgets are not spending inside those municipalities. Country-aggregate only. |
| Adjara region and `/georgia` | Consolidation adds Adjara Autonomous Republic actual payments once and removes republic-to-territorial transfers. Naive summation double-counts. |
| 2004 revenue | Covers revenue and grants only; increase in liabilities starts in 2005 and is neither estimated nor zero. Not comparable to later years without a note. |
| `% GDP` measure spanning 2010 | The reviewed denominator uses SNA 1993 through 2009 and SNA 2008 from 2010. |
| Any multi-year GEL series | Nominal current prices. Not inflation-adjusted. |
| Ministries drill-down before 2017 | Major-program rows are partial from 2012 and contiguous only 2017–2025. 2004 has no major-program rows. |
| Municipal ten functions | Municipal-only. No reviewed Adjara republican function crosswalk exists; no residual is allocated. |
| Rows carrying `show_warning` | The specific `warning_type` applies and must travel with the number. |

## 3. Decisions locked during brainstorming

These were settled with the project owner on 2026-08-28 and are not re-opened by implementation.

1. **Answer authorship.** The on-platform assistant (Spec 2) may write free-form narrative including explanations the data cannot support, presented as one continuous answer without a segregated interpretation block. Numbers carry inline source references. This spec's contribution is that the query core supplies caveats the narrative can incorporate.
2. **Languages.** Georgian and English, selected by the language of the question.
3. **External surfaces.** MCP server and `llms.txt` plus bulk dumps. No public REST API. Schema.org enrichment is not pursued as a standalone item.
4. **Access posture.** Open and free, no login, hard-capped. Applies to Spec 2; Spec 1 has no inference cost.
5. **Query core approach.** Typed tool functions over a fixed catalogue. No model-authored SQL, and no SQL escape hatch until query logs prove a need.
6. **No model lock-in.** No provider SDK is called directly. Model selection is configuration, not code.

## 4. Scope

### 4.1 Included

- `apps/web/lib/factQuery/` — six typed query functions, the shared response envelope, and the caveat engine.
- A single Zod schema module from which both MCP JSON Schema and AI SDK tool definitions are derived.
- `/mcp` — a remote MCP server exposing the six functions, with citation and licence metadata.
- `/llms.txt` — a machine-readable description of the datasets, coverage, stable IDs, caveats, licence, and endpoints.
- Indexable bulk dumps (complete JSON per dataset plus a manifest) generated at build time from the served-data loaders.
- English labels for the municipal taxonomy: 10 functions, 11 regions, 64 municipality names.
- A Georgian and English evaluation fixture of approximately 40 questions with hand-verified expected answers, expected sources, and expected caveats.
- Anonymized MCP query logging.
- `Project_Definition.md` §2 amendment permitting these two bounded surfaces.
- `docs/deployment.md` update covering the first server-side runtime.

### 4.2 Not included

- The on-platform assistant, its UI, `/api/ask`, rate limiting, spend caps, and answer caching. That is Spec 2, dependent on this spec.
- A public REST/JSON API.
- Any model-authored SQL path.
- Authentication, accounts, or per-user quotas.
- Any new or re-reviewed source data. This spec serves the existing reviewed fact base unchanged.
- Quarterly, monthly, debt, or capital-projects data, and the four `მალე` indicator datasets.

## 5. Design — the query core

### 5.1 Placement and data source

`apps/web/lib/factQuery/` sits above `lib/data/servedData.ts` and consumes `loadServedExplorerData()` and `loadServedMunicipalData()`. It performs no file or database access of its own and holds no provider SDK import. It is pure TypeScript over loaded rows.

This placement is the correctness guarantee: any divergence between an AI answer and an explorer chart would require the shared loader to return different rows to two callers in the same build.

### 5.2 The response envelope

Every function returns one shape:

```ts
type FactQueryResult = {
  rows: Array<{
    year: number;
    entityId: string;          // itemId, municipality code, or region id
    labelKa: string;
    labelEn: string;
    value: number;
    basis: "actual" | "planned";
    sourceId: string;
  }>;
  unit: "GEL" | "share_of_gdp" | "share_of_total" | "GEL_per_resident";
  sources: Array<{ sourceId: string; name: string; url: string; lastReviewedAt: string }>;
  caveats: Array<{
    code: string;              // stable ASCII id, e.g. "nominal_gel"
    severity: "severe" | "note";
    messageKa: string;
    messageEn: string;
  }>;
  coverage: {
    years: [number, number];
    completeness: "contiguous" | "partial";
    excludedEntities: string[];
  };
  citation: { ka: string; en: string; url: string; licence: "CC BY 4.0" };
};
```

Uniformity across all six functions is what makes both consumers trustworthy: no caller needs per-function knowledge of where provenance lives.

`severity` separates caveats that invalidate a naive reading (`severe` — 2004 revenue comparability, excluded codes) from those that contextualise it (`note` — nominal GEL). Consumers may style them differently; neither may be dropped.

### 5.3 The six functions

| Function | Signature intent |
| --- | --- |
| `describeCoverage()` | Returns available datasets, year ranges per dataset, served category IDs with Georgian and English labels, available units, and the excluded-entity list. Distinguishes served IDs from taxonomy-only IDs such as `revenue.taxes_total`. |
| `queryNational(side, itemIds[], years, measure)` | Revenue categories or public spending fields, in GEL, share of GDP, or share of the applicable total. |
| `queryMinistries(itemIds[], years, level)` | Admin categories and major programs, honouring the existing succession joins. |
| `queryMunicipal(entities[], categoryIds[], years, measure)` | Municipalities, regions, or the Georgia aggregate; ten functional categories or the public total. |
| `rank(scope, year, measure, limit)` | Ordered results — the shape most natural-language questions resolve to. |
| `getSources(sourceIds[])` | Resolves source IDs to name, official URL, and review date from `data/sources/source-documents.csv`. |

### 5.4 The caveat engine

Caveats fire from the parameters and rows of the actual query, never generically. The engine is a pure function `(query, rows) => Caveat[]`, tested independently of the query functions.

| Trigger condition | Caveat code | Severity |
| --- | --- | --- |
| `unit === "GEL"` and the year range spans more than one year | `nominal_gel` | note |
| `side === "revenue"` and years include 2004 | `revenue_2004_incomparable` | severe |
| `measure === "share_of_gdp"` and years span 2010 | `gdp_sna_break_2010` | note |
| Requested entity is in `{05, 42, 43, 46, 64}` | `municipality_not_territorial` | severe |
| Entity is the Adjara region or the Georgia aggregate | `adjara_consolidation_applied` | note |
| Any returned row carries `show_warning` | `municipal_<warning_type>` | severe |
| Ministries query at `major_program` level with years before 2017 | `ministries_drilldown_partial` | severe |
| Municipal functional query | `municipal_functions_no_republican_crosswalk` | note |

Excluded entities are never silently included: a query naming one returns it in `coverage.excludedEntities` with the `severe` caveat and omits it from `rows`.

### 5.5 Schema definitions

One module defines each function's parameters as a Zod schema. MCP tool JSON Schema and AI SDK tool definitions are both derived from it. Neither consumer declares parameters independently, so the two surfaces cannot drift.

## 6. Design — external surfaces

### 6.1 MCP server at `/mcp`

A Vercel Function exposing the six functions as MCP tools. Public, unauthenticated, IP rate-limited. It contains transport and schema translation only; all logic lives in `lib/factQuery/`.

**Attribution.** Every tool response carries the envelope's `citation` object naming Fiscal.ge, the CC BY 4.0 licence, and a deep link to the corresponding explorer view. The server's MCP `instructions` string states that attribution is a licence condition when figures are reported. The deep link is the operative mechanism: it returns the reader to Fiscal.ge to verify.

**Errors teach rather than fail.** An unrecognised category ID returns the valid list; an out-of-range year returns the coverage bounds; an unknown entity returns the nearest matches. A model that misfires once should self-correct on the next call rather than abandon the tool and answer from memory.

**Logging.** Anonymized tool name, parameters, and result size. No IP retention beyond rate-limiting need. These logs are the input to Spec 2's design.

### 6.2 `/llms.txt`

Markdown at the site root covering: datasets and year coverage; stable category IDs with Georgian and English labels; the excluded-municipality list; the §2.2 traps in prose; the CC BY 4.0 licence and its attribution condition; the `/mcp` endpoint; and bulk-dump URLs. It is written so that a consumer reading only this file still avoids the severe traps.

### 6.3 Bulk dumps

Complete JSON per dataset plus a manifest recording dataset name, row count, year coverage, source IDs, licence, and generation timestamp. Generated at build time from the same served-data loaders.

These are written to `apps/web/public/data/` and served from `/data/`, outside `/downloads/methodology/` and therefore without its `noindex` header, because discoverability is their purpose. `/data/manifest.json` is the entry point referenced from `/llms.txt`.

### 6.4 Model portability

No provider SDK is imported anywhere in this spec's surface. `lib/factQuery/` contains no LLM code at all, and the MCP server delegates inference to whichever client connects. Spec 2 will select models through AI SDK v6 configuration so that changing model or provider is a configuration change.

## 7. Risks and stop conditions

| Risk | Response |
| --- | --- |
| MCP specification churn breaks the transport layer | Keep `/mcp` a thin adapter. All behaviour lives in `lib/factQuery/`, which has no protocol dependency. A protocol break is a rewrite of the adapter only. |
| Connecting models ignore the citation and report figures uncredited | Cannot be enforced technically. Mitigated by citation in every response, the `instructions` string, and the explorer deep link. Measured by referral traffic, not assumed. |
| Bulk dumps enable wholesale copying without credit | Accepted. The data is already public and CC BY 4.0; the licence, not obscurity, is the protection. Machine-readable licence declaration strengthens the position relative to today. |
| First server-side runtime complicates a deploy pipeline built for static output | `docs/deployment.md` is updated in the same change. Static explorer routes keep their current behaviour; the runtime is confined to `/mcp`. |
| Caveat text drifts from the methodology documents it restates | Caveat messages are sourced from the methodology docs and covered by tests asserting each `code` is documented. Stop condition: if a caveat cannot be traced to a methodology document, the caveat is wrong or the document is missing. |
| The typed-function catalogue cannot express real user questions | Accepted for this spec. Query logs from §6.1 provide the evidence for whether a seventh function or an escape hatch is warranted. Do not pre-build one. |

## 8. Testing strategy

1. **Unit tests per query function** against fixture data, asserting rows, units, sources, and coverage.
2. **Caveat-firing tests** — the load-bearing layer. Each row of the §5.4 table becomes an assertion that the caveat fires when its condition holds and does not fire when it does not. Additional negative tests assert that excluded municipal codes never appear in `rows` under any parameter combination.
3. **Envelope conformance tests** asserting all six functions return the same shape with non-empty `sources` and a populated `citation`.
4. **Schema derivation tests** asserting the MCP JSON Schema and the AI SDK tool definitions derive from the same Zod source and stay structurally equivalent.
5. **Parity test** asserting a `factQuery` result and the corresponding explorer view model report the same figures for a sampled set of year/category combinations.
6. **The evaluation fixture** — approximately 40 Georgian and English questions with hand-verified expected values, sources, and required caveat codes. In this spec it runs against the query functions directly, scoring numeric accuracy and caveat coverage. Spec 2 reuses it end-to-end, which is what makes a model swap measurable rather than a matter of impression.
7. `npm run check` and `npm run build` pass. No browser tests are required; this spec ships no UI.

## 9. Documentation updates

- `Project_Definition.md` §2: amend the "Public API" exclusion to permit the MCP endpoint and static grounding artifacts, and record what remains excluded (REST API, authentication, write access).
- `docs/deployment.md`: the first server-side runtime, its environment configuration, and its verification procedure.
- `docs/data-methodology/`: a new document owning the caveat catalogue, cross-referencing the existing methodology documents each caveat restates.
- `AGENTS.md`: only if an always-relevant operational constraint emerges. Not expected.

## 10. Delivery

Spec 1 is independently shippable and carries no inference cost. Sequence within it:

1. `lib/factQuery/` — envelope, six functions, caveat engine, with tests.
2. Municipal English labels and the evaluation fixture.
3. `/mcp`, then `/llms.txt` and bulk dumps.
4. Documentation and scope amendments in the same change as the code they describe.

Spec 2 (the on-platform assistant) is brainstormed separately after `/mcp` query logs exist, so that its UI placement and question-handling are designed against observed questions rather than predicted ones.
