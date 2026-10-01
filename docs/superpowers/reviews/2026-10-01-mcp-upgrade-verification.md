# MCP upgrade verification

Date: 2026-10-01 (Asia/Tbilisi)
Task: 2, transport migration only; baseline `c58a7389`.
Status: local SDK compatibility verified; integration gates and human application/production proof remain pending.

## Installed package proof

`npm ls @modelcontextprotocol/server @modelcontextprotocol/client @modelcontextprotocol/sdk @modelcontextprotocol/core` reports server/client/core **2.2.0** and SDK **1.30.1**. All three direct packages are pinned exactly. Only the server package is a production dependency; both client packages are development dependencies. `npm ls --omit=dev` reports only `@modelcontextprotocol/server@2.2.0` among the three direct packages. Lockfile changes were made through npm with the task-local cache.

The exact installed server declarations and implementation were checked, alongside the refreshed official protocol/HTTP/legacy guides held in the task scratch directory and the [official 2026-07-28 migration guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28) checked by the task lead. These revealed three details requiring explicit handling:

1. `responseMode: "json"` affects only modern traffic. The default stateless legacy adapter still returns SSE. Independent actual pinned v2/v1 HTTP calls returned identical city/source results, but failed the all-JSON assertion. The approved correction uses SDK `isLegacyRequest`, the v2 package's stateless JSON `WebStandardStreamableHTTPServerTransport`, and one shared tool factory. Modern traffic uses a shared `createMcpHandler` with `legacy: "reject"` and `responseMode: "json"`. No stream conversion or SDK patch is used.
2. The SDK defaults `tools.listChanged` to true, and its subscription handler can stream despite JSON mode. A controlled test failed with advertised true and SSE/log parsing failure. Explicit `tools.listChanged: false` and `maxSubscriptions: 0` now produce finite JSON refusals without opening streams.
3. Zod's homogeneous two-value tuples became `prefixItems` plus `items: false`, which the frozen v1 client's JSON Schema validator rejected after `listTools`. Equivalent homogeneous arrays of exactly two elements preserve types/cardinality and permit both actual clients to validate coverage. Null-only fields and nullable ranges remain intact.

## Automated client evidence

The test-only local HTTP bridge measures/bounds bodies and closes its HTTP connections; all actual clients and standalone handlers are closed in `finally` blocks.

| Client | Mode | Observed result |
| --- | --- | --- |
| SDK client 2.2.0 | Pin `2026-07-28` | Reports `modern`; discovery, ordered tool listing, coverage, Batumi query and sources complete |
| SDK client 2.2.0 | Automatic | Reports `modern`; same data and sources as pinned client and v1 |
| SDK client 1.30.1 | Legacy initialization | Initializes, lists tools, validates coverage, pings, queries city and retrieves sources |
| SDK client 2.2.0 | Automatic against a test-only v1 server | Probe `server/discover`, then `initialize`; reports `legacy` and completes city query |

The Batumi 2026-08 headline year-on-year query retains **7.0857**, copied from the existing reviewed city regression. The Zugdidi 2016-06 rolling-average case remains null. Structured envelopes are equal between eras against the same snapshot. Successful modern wire results carry `resultType: "complete"`; no response creates a session ID. Legacy initialization never counteroffers a modern revision.

Complete preserved legacy list: **2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07**. Each is directly initialized/tested; none was removed.

Raw tests cover required protocol/method/name headers, mismatches, missing/invalid metadata, unknown versions/methods, original JSON-RPC IDs, modern tool failures, approved CORS, and empty legacy initialized notifications. The installed modern schema requires protocol version and client capabilities; client identity is optional, and a malformed present identity is rejected. The service follows that SDK contract.

## Controls and verification

Pause/host/origin/body checks and minute-before-daily charging order are preserved. Both eras test minute denial, daily denial and either counter becoming unavailable. Request bodies remain capped at 32 KiB; result/cell/comparison/ranking/duration constants remain unchanged. GET/DELETE remain 405, and modern subscription POSTs cannot stream. Fresh servers close after successful and failed exchanges; the shared handler retains no open subscriptions.

Final HTTP serialization is measured after SDK framing/identity metadata. A mutation without this gate returned **524,319 legacy / 524,429 modern bytes** for a tool result of 524,278 bytes; both exceeded the 524,288-byte ceiling. The gate now refuses the whole result with bilingual narrowing/bulk-download guidance, retains request ID/modern envelope metadata, and sends no truncated structured payload.

Logs retain fixed method/tool names, response bytes, duration/outcome/data identity and allow-listed error codes. Discovery is explicitly named. Client identity, capabilities and arguments are absent from captured logs. The SDK emits one fixed warning when the lazy modern handler is first constructed; it contains no client/request information. No global console mutation is introduced.

Commands run from `apps/web`:

- Pre-migration valid modern discovery + pinned-client proof against baseline route: **2 failed / 18 skipped**, expected 400 discovery and pinned negotiation refusal.
- Independent SDK composition HTTP proof: **1 passed** after the default handler's legacy-JSON failure was demonstrated.
- `npx vitest run --configLoader native tests/mcp tests/factQuery/reference.test.ts`: **239 passed / 1 failed across 19 files**. The sole failure was the existing static purity scan treating the SDK's inbound `modernHandler.fetch(checkedRequest)` as an outbound network request. Reference expectations were untouched and passed.
- After excluding only that exact inbound route dispatch, `npx vitest run --configLoader native tests/mcp/purity.test.ts`: **2 passed**. All other fetch prohibitions remain active.
- Final test-only metadata refinements: `npx vitest run --configLoader native tests/mcp/protocolCompatibility.test.ts`: **33 passed**. Unchanged passing tests were not rerun.
- `npm run typecheck`: **passed**. Changed production/test files passed `eslint --max-warnings 0`; each subsequently edited test file passed its own lint rerun.
- `git diff --check`: **passed** before documentation/commit preparation.

The passing scoped coverage is the 240-test run with its sole static-scan finding resolved by the affected-file rerun, plus four additional passing metadata cases. No full `check`, build, browser gate, push, PR, deployment or database operation was run for this task. Those remain integration/delivery work.

`npm audit` reports five moderate dependency findings (ajv/fast-uri, exceljs/uuid, and Hono from the development-only v1 SDK), with no high or critical findings. No unrelated dependency upgrades were attempted.

## Unverified boundaries

This is actual SDK protocol evidence, not proof of Codex, Claude or ChatGPT account eligibility, menus or connection flows. Human application proof belongs to Task 9. No live production compatibility or deployed commit claim is made. Fiscal.ge's data schema remains **1.4.0** in this transport-only task.

## Task 8: packaged snapshot and product response measurements

Measured **2026-10-02, 01:48 Asia/Tbilisi** (`2026-10-01T21:48:32.564Z`) against the packaged schema **1.5.0** snapshot, dataVersion `2776fc1896f85c77d7b951aa4f13e5d94fdef8135acf92f076df35a6bbec8aa7`. The earlier 1.4.0 statement above records Task 2's historical transport-only boundary, not the integrated current schema. Task 8 base: `14f68d5216a17ddfd2e6fd8cb84c20e19fe5f10a`. The artifact's recorded generation commit is `9a7b827df7e8523dfbad69aebd64c41c8f227007`, generated at `2026-10-01T21:01:35.478Z`; that metadata is artifact provenance, not a claim that the base commit was built or deployed. Task 10 will regenerate release metadata during its integrated build.

The [reproducible JSON evidence](2026-10-01-mcp-response-measurements.json) retains every sample, complete structured/text/tool-result byte counts, source/caveat counts, populations, all exclusion IDs/reasons, refusal text and environment. `scripts/measure-bilingual-mcp.ts` now reads the packaged snapshot rather than importing its serving-data builder. It adds seven product query/ranking scenarios and measures the full product catalogue among **45 total scenarios**. No request instrumentation, public contract, query arithmetic or limit changed.

Environment: **Node v24.14.0, Windows 10.0.26200, x64, Intel Core Ultra 7 255U, 14 logical CPUs, 33,752,997,888 bytes RAM**. Measurements ran sequentially without another task check launched alongside the recorded run; unrelated machine activity and OS file caching were uncontrolled. Five separate fresh Node/tsx processes each read, parsed and built the product index. Warm scenarios use one unmeasured query warmup followed by ten measured samples with a shared parsed snapshot and cached index. The fixed 501-cell existing-result fixture measures shaping only and is labelled separately. Percentiles use nearest-rank; all raw outliers remain in JSON.

Snapshot size is **46,285,296 bytes** (44.14 MiB), containing **305 products / 84,056 product facts / 305 annual and 305 monthly runs**. Cold stage timings in milliseconds:

| Stage | Median | Maximum |
| --- | ---: | ---: |
| Synchronous UTF-8 read | 76.42 | 77.28 |
| JSON parse | 94.92 | 97.76 |
| Product packing and Decimal-prefix index construction | 174.44 | 174.64 |
| Read + parse + version validation + index | 345.36 | 346.61 |
| Parent-observed fresh process completion, including Node/tsx/import startup | 624.92 | 631.64 |

These are process-cold samples, not uncached physical-disk measurements. Index timings include the full production `inflationProductIndex` work, not a prepacked substitute. Caches remain outside the serialized snapshot.

Every byte size below is the **complete UTF-8 tool result**, with full structured and equivalent bilingual text evidence. It excludes JSON-RPC, SDK metadata and HTTP framing. Local request-cost timings sum query execution, `boundedToolResult` and final bounded-result JSON serialization; separate diagnostic unbounded rendering is excluded. JSON also records each individual stage. These measurements are not hosted response-time guarantees.

| Product scenario | Rows / actual population | Complete bytes | Bounded bytes | Local request cost median / max ms |
| --- | --- | ---: | ---: | ---: |
| Full catalogue | 305 current products | 469,421 | 469,421 | 53.14 / 78.01 |
| p0001 complete annual history, 2015-01–2026-08 | 140 available cells | 211,660 | 211,660 | 2.74 / 3.75 |
| Annual endpoints at 2026-08 | 200 available cells | 312,164 | 312,164 | 35.46 / 59.47 |
| Cumulative endpoints, January 2015–2026-08 | 200 available cells from 28,000 monthly inputs | 436,276 | 436,276 | 103.93 / 143.21 |
| Cumulative 100 products × five endpoint months | 500 available output cells | 1,051,711 | 1,055, refusal | 77.58 / 99.69 |
| Annual ranking at 2026-08, limit 100 | 305 candidates / 305 eligible / 100 returned | 63,489 | 63,489 | 53.33 / 69.48 |
| Cumulative ranking since January 2015 at 2026-08, limit 100 | 305 candidates / 287 eligible / 100 returned / 18 excluded | 105,283 | 105,283 | 159.17 / 220.42 |
| Maximum actual missing-history annual ranking, 2015-01 | 305 candidates / 287 eligible / 100 returned / 18 excluded | 70,254 | 70,254 | 51.96 / 75.52 |

The missing-history date is chosen by scanning real annual facts for the fewest available current-roster values, breaking ties by earliest month. Current reviewed data bounds that worst actual population at **18 excluded products**; no synthetic missing facts or artificial population is measured. Both rankings list every excluded ID with both language explanations. The new test's initial unsupported expectation of more than 18 was corrected after source inspection; none of the pre-existing numeric references changed.

The **512 KiB / 524,288-byte limit** accepts the whole catalogue with **54,867 bytes tool-result headroom**. The 500-cell cumulative request demonstrates the binding byte boundary: no source, history warning or text was trimmed; the complete oversized answer was replaced by the bilingual refusal directing callers to narrower requests and `https://fiscal.ge/downloads/data/manifest.json`. All 45 bounded outputs fit the byte limit. The largest local request-cost sample is **220.42 ms**; five fresh cold processes also completed below the existing ten-second ceiling on this machine. Startup on Vercel, SDK/HTTP work and shared rate-limiter latency are outside these timings, so no ten-second hosted guarantee is claimed.

Actual final wire proof remains the separate Task 7 real-client evidence: its complete catalogue was **469,455 legacy / 469,565 modern bytes**, with **54,833 / 54,723 bytes final-wire headroom**. Task 8's 469,421-byte tool result matches that earlier bounded result, but is not being presented as a newly measured HTTP wire. Preserved detailed evidence currently resides in `.superpowers/sdd/2026-10-01-mcp-unified-implementation/task-7-report.md` and `task-7-wire-evidence.json`; Task 10 owns moving that preserved evidence out of execution scratch. No account or network request was made for Task 8.

### Bundle and failure boundaries

`next.config.ts` explicitly traces `./lib/factQuery/generated/snapshot.json` into `/mcp`. A TypeScript-AST traversal from `lib/mcp/tools.ts`, `snapshot.ts` and `result.ts` followed **62 project-local runtime modules / 209 import edges**. It omits type-only imports and does not inspect third-party package internals. No path reaches `buildSnapshot`, serving loaders, database modules or the product identity file reader; the sole filesystem import is the packaged snapshot loader. In particular the product arithmetic's product-identity imports are type-only. Existing fact-query and MCP purity tests pass. No built MCP trace exists yet; actual trace inclusion and absence of serving loaders must be confirmed after Task 10's single integrated build. The approved plan now states this division explicitly.

No demonstrated latency regression, repeated-query failure or honest catalogue overflow required a production repair. The existing byte refusal is the intended contract, not a reason to raise limits. The historical small-snapshot timing comment in `lib/mcp/snapshot.ts` was left untouched because Task 8 is scoped to measurement/evidence; current assessable timings are recorded here.

### Narrow verification and pending integration

- Test-first CLI proof failed **2/2** against the old measurement output. During implementation its first combined feedback run had **74 passing tests across five unchanged files** and the new CLI suite failed before assertions because the diagnostic collector treated catalogue exclusions as ranking groups. Restricting that collection to ranking results resolved it. The later new-file run found the unsupported missing-population assumption described above; the final CLI run passed **2/2**, duration **17.19 s**.
- The five passing files were `result.test.ts`, `resultWireLimit.test.ts`, `reference.test.ts`, fact-query `purity.test.ts` and MCP `purity.test.ts`. **All 59 reference tests passed unchanged.** This is passing affected-file evidence, not a claim of one all-green combined rerun.
- Final `npm run typecheck` passed. Scoped `eslint --max-warnings 0` passed on the script and new test; initial lint found four new test-only explicit `any` types, corrected to structural test types.
- The prescribed measurement command completed with **45 scenarios**, writing the linked JSON. Static import audit passed after its audit-only resolver was corrected to recognize explicit `.json` imports. `git diff --check` passed.

No full `check`, build, browser suite, mirror/database read, push, PR, deployment or live verification was run. Full completion gates and built-trace proof remain Task 10; human application/account proof remains Task 9; publishing remains unauthorized. The CLI test uses no absolute latency threshold, so routine machine load is not converted into a false performance contract.
