# MCP: current-client compatibility with existing-client support

Date: 2026-10-01
Status: accepted for implementation planning by the user's 2026-10-01 request to write the unified implementation plan; implementation and production compatibility are not yet verified.
Baseline: fetched main `1c2a0acd07f0fa522bf4f6aab33924b319cc2112`; MCP SDK dependency 1.30.1.

## 1. Outcome

One public address, `https://fiscal.ge/mcp`, accepts the existing initialization-based MCP clients and clients using the current `2026-07-28` protocol. Both receive the same reviewed data, tools, evidence and operating limits.

The live endpoint currently accepts the `2025-11-25` initialization flow and rejects a request declaring `2026-07-28`. That proves lack of direct support for the newer protocol; it does not prove that every newer application fails, because some clients can fall back to the older flow.

The distinction matters: changing a version string alone is insufficient. The current standard changes request metadata, discovery, HTTP headers and protocol result envelopes.

## 2. Approach and scope

Considered approaches:

| Approach | Consequence |
| --- | --- |
| Keep the old server and document client fallback | Lowest immediate effort, but clients supporting only the new protocol remain excluded. |
| Support both protocols at the existing address | Recommended: preserves existing connections and admits modern clients. |
| Replace the old protocol or create a second address | Adds a migration burden for users or duplicate deployment/maintenance work. |

Use the official TypeScript SDK's HTTP adapters, keeping the query core unchanged. Registry metadata checked on 2026-10-01 reports stable `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.2.0. During execution, actual pinned modern/v1 clients proved equal city/source results, but the installed handler's `responseMode: "json"` did not apply to its legacy fallback. Preserve plain JSON through the SDK's documented composition: `isLegacyRequest` routes legacy requests to its exported `WebStandardStreamableHTTPServerTransport` with `sessionIdGenerator: undefined` and `enableJsonResponse: true`; modern requests use `createMcpHandler` with `legacy: "reject"` and `responseMode: "json"`. Both use the same fresh-server tool factory and the same endpoint. No manual event-stream conversion or SDK patch is introduced. Retain the v1 SDK client as a development-only test dependency; do not ship a second server implementation merely for tests.

Before replacing the transport, prove the chosen SDK can serve both eras without stored sessions or standalone streams. If that proof fails, report the incompatibility and revise the design rather than hand-build a protocol stack or weaken the existing limits.

No authentication, accounts, write tools, model calls, prompts, resources, tasks, elicitation or subscriptions are added. All dataset queries remain snapshot-backed. No new runtime route or hosting provider is introduced.

## 3. Wire behavior

### Existing clients

- Preserve `initialize`, `notifications/initialized`, `tools/list`, `tools/call` and the supported legacy ping behavior.
- Keep `2025-11-25` as the documented and explicitly tested legacy revision. Record the SDK's complete advertised legacy list; preserve existing earlier revisions accepted by the transport or surface a proposed removal for review.
- Preserve old tool names, argument handling, structured results and useful text results. Do not require modern-only metadata/headers from legacy requests.
- Continue without generated session IDs, a session store or background GET stream.

### Current clients

- Implement `server/discover` with correct identity, capabilities, supported modern versions and instructions using the SDK's discovery contract.
- Accept direct tool listing/calls carrying required per-request protocol version and capabilities metadata; an initialization handshake is not required. Client identity is recommended by the final standard, rather than mandatory: accept its omission and validate it when present, following the SDK.
- Validate `MCP-Protocol-Version`, `Mcp-Method` and, where applicable, `Mcp-Name` against the body. Delegate version-specific parsing/validation, including permitted name encoding, to the SDK.
- Reject missing/mismatched required modern headers and metadata with the appropriate protocol response. Unsupported versions return the recognized modern error with supported versions; unsupported methods use the modern method-not-found status/error behavior.
- Include `resultType: complete` on modern protocol results. The Fiscal.ge data envelope inside `structuredContent` is unchanged by transport migration.
- Discovery/version handling follows the SDK's separation of eras; never advertise a modern version through a legacy `initialize` counteroffer.

### Shared behavior

Tool order is deterministic. Tool declarations retain read-only, non-destructive, idempotent and closed-world annotations and per-tool output schemas. Successful structured output must match its schema. Existing text output retains numbers, units, missingness, sources and caveats; do not replace it with a lossy summary.

GET and DELETE remain 405, with no request-time background stream. OPTIONS remains an approved-origin preflight. Return plain bounded JSON for completed request/response work. Do not advertise capabilities the service does not implement.

## 4. Security, cost and logs

Keep the current pause switch, host/origin validation, incremental 32 KiB body limit, shared Upstash minute/daily limits, 500-cell query cap, 250-comparison cap, 512 KiB serialized-result cap, and 10-second function ceiling.

The controls apply to both eras, including discovery; use the existing charging order so minute-limit refusals do not drain the daily allowance. Do not lower security checks to make an SDK example work. Extend approved browser CORS request headers with the required modern protocol headers. No arbitrary caller-selected custom headers or wildcard origins are introduced.

Privacy logs remain restricted to approved fixed tool/protocol names, timings, size, outcome, data identity and approved error codes. Add `server/discover` to the fixed method inventory; never log client identity, capabilities, raw metadata, arguments or request bodies. Revise response/log classification only where modern result/error envelopes require it.

Preserve safe handling of unreadable snapshots, rate-limiter failure, unsupported origin/host, oversized requests and unexpected failures. Protocol errors may differ by era; application errors retain their bilingual explanations and bulk fallback.

## 5. Compatibility proof

Automated tests use actual pinned clients as well as raw protocol requests:

1. A v1 client initializes, lists tools, discovers coverage, queries a city, and retrieves sources.
2. A v2 client pinned to the modern version discovers and calls the same tools without initialization.
3. A v2 automatic client connects successfully; explicitly exercise its fallback against a legacy-only test server so the fallback assertion is real.
4. Both eras return identical application envelopes against the same snapshot, excluding request/transport bookkeeping.
5. Modern missing headers, mismatches, bad metadata, unknown method/version and failed tool cases have correct status, body and request ID behavior.
6. Both eras respect pause, origin/host, body, result, rate and timeout constraints. Browser preflight admits the required modern headers only for approved origins.
7. GET/DELETE refuse promptly and no session/stream survives a completed or failed call.

For each supported human application, record application/version, account eligibility, date, protocol used and one completed sourced question. Start with Codex and Claude, which the connection page currently names. Add ChatGPT setup instructions only after its actual custom-connection flow and eligibility are checked. A successful generic SDK call is not proof of an application's menus or account access. If a human-login test cannot be completed in this environment, report that boundary; do not label it passed or claim that client is verified.

The normal `check`, build, reference and affected browser gates apply. Production proof separately requires a matching deployed release, both protocol flows, representative tool calls, publication integrity and runtime-error checks from the runbook. This task does not introduce deployment workflow polling or bypass the existing Actions pipeline.

## 6. Owners and sequencing

Changes belong in `app/mcp/route.ts`, `lib/mcp/`, pinned package manifests, protocol tests and the applicable operational documentation. Keep query arithmetic outside the transport. [Documentation work](2026-10-01-mcp-documentation-design.md) publishes only the compatibility evidence actually achieved.

Transport protocol versions are separate from Fiscal.ge's data schema: this migration does not itself change schema 1.4.0. [Product access](2026-10-01-mcp-inflation-products-design.md) independently adds schema 1.5.0. Execute and verify transport migration separately from product calculation changes before combining them for final delivery.

## 7. Primary sources checked 2026-10-01

- [Versioning and compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Tools and structured output](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [Official TypeScript SDK protocol guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)
- [Server package registry metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fserver) and [client package metadata](https://registry.npmjs.org/@modelcontextprotocol%2Fclient)

The standard and package releases above were checked live. They are the planning references, not evidence that Fiscal.ge already implements the proposed behavior.
