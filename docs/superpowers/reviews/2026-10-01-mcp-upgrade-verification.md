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
