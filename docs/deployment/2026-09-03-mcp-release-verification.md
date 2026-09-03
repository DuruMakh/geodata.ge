# MCP release verification — 2026-09-03

Evidence for the Part 3 release gate (query-core spec §14.4, §14.5, §16). This
records what has been verified and, just as importantly, what has **not** — the
release gate is not met until the second table is filled in too.

Nothing in this release is deployed or published. `/mcp` is implemented and
ships **switched off**: it serves requests only when `MCP_ENABLED` is exactly
`true`, and with no shared limiter configured every request is refused. Turning
it on is the owner's authorised step, not a consequence of merging.

## Verified locally

| Check | Result |
| --- | --- |
| `npm run check` | exit 0 |
| `npm run build` (cold, output directory deleted first) | exit 0; 10 published files; `postbuild` verification passed |
| Route inventory | one dynamic route (`ƒ /mcp`); every other route still prerendered |
| Snapshot reaches the function | `.next/server/app/mcp/route.js.nft.json` lists `snapshot.json`; 98 traced files total |
| `npm run test:browser` against a production build | **220/220 passed, 3.1 min** |
| §14.3 reference fixture | 20 intents + 11 boundary cases pass |
| Protocol revision | SDK pinned at exactly `1.30.0`; `LATEST_PROTOCOL_VERSION = 2025-11-25` |
| Live HTTP round trip | `initialize`, `tools/list`, `tools/call` verified against a running server; seven tools, read-only annotations, no session header |
| Khulo 2024 end to end | `30,969,077.43 GEL` with `municipal_source_actual_missing` (severe) in both languages and both source documents linked |
| `GET`/`DELETE` | `405` with `Allow: POST`; no SSE stream opened |
| Guards | paused → 503; unapproved host → 403; unapproved origin → 403; oversized body → 413; no limiter → 503; rate limit → 429 |
| Log allow-list | `ip`, `userAgent`, `body`, `prompt`, `authorization` all dropped |
| No provider SDK, no database, no network in the runtime | enforced by `tests/mcp/purity.test.ts` |

### Performance (application level)

Measured through the route handler in-process, 30 runs each, so this excludes
network and platform cold start. Spec §11.4 targets: warm p95 < 1 s, first cold
response < 5 s.

| Call | Median | p95 | Max |
| --- | --- | --- | --- |
| Cold first request (incl. 3.26 MB snapshot read + parse) | — | — | **35.8 ms** |
| `initialize` | 0.7 ms | 1.8 ms | 3.8 ms |
| `tools/list` | 1.2 ms | 2.6 ms | 3.1 ms |
| `query_national`, 1 cell | 1.2 ms | 2.2 ms | 9.9 ms |
| `query_municipal`, 1 cell | 1.1 ms | 3.0 ms | 3.2 ms |
| `query_municipal`, 704 cells (refused over the cap) | 98.2 ms | 187.2 ms | 195.4 ms |
| `describe_coverage` | 1.2 ms | 2.7 ms | 2.8 ms |
| `rank`, 64 municipalities | 22.5 ms | 32.2 ms | 33.6 ms |

The application is nowhere near the budget: the worst case is the request the
service *refuses*, at roughly 5× under the warm target. Production latency adds
platform cold start and network and must be measured against the deployment
before public enablement.

### Response size

Narrowing `meta.sources` to the documents an answer actually cites took a
one-cell municipal response from **80.0 KiB to 4.4 KiB**. The §11.3 cell and
byte caps were measured as mutually unreachable for municipal data — a
compliant 495-cell request serializes to 517 KiB against a 512 KiB ceiling — so
the byte ceiling is the binding gate and over-cap requests are refused with
guidance rather than trimmed.

## Not yet verified — requires a deployment and owner decisions

| # | Gate | Blocked on |
| --- | --- | --- |
| 1 | **Hosting plan, limiter availability and cost, expected traffic, budget alerts, approved operating budget** | Owner decision (§11.4). Blocks everything below. |
| 2 | MCP Inspector against the deployed endpoint | Deployment |
| 3 | Two independently implemented real AI clients, versions recorded | Deployment + a test budget for client usage |
| 4 | Bilingual answer checks — the 40 prompts through real clients | Same as 3 |
| 5 | Cross-instance quota enforcement, counter failure, pause and recovery in production | Deployment + a chosen shared limiter |
| 6 | db-mode vs CSV-mode snapshot parity (§14.2) | No `DATABASE_URL` locally. Production builds in db mode while every check here ran in CSV mode; the two `dataVersion` values must be identical. |
| 7 | Deployed queries answering with no request-time database connectivity | Deployment |
| 8 | Production latency: warm p95 and first cold response, with region, concurrency and payload sizes | Deployment |
| 9 | Application logs contain no forbidden field, in production | Deployment |
| 10 | The six production-proof checks of §16 | Merge + deploy |

**Gate 6 deserves emphasis.** Production builds with `GEODATA_DATA_SOURCE=db`,
and the snapshot is built through the same loaders, so the deployed endpoint and
the published JSON files are generated from the database mirror — not from the
CSVs every check above used. §14.2 requires the two to agree. If the two
`dataVersion` hashes differ, that is a stop condition: report the difference,
do not pick a mode and proceed.

```bash
GEODATA_DATA_SOURCE=csv npm run data:prepare-fact-query-snapshot
```

```bash
GEODATA_DATA_SOURCE=db npm run data:prepare-fact-query-snapshot
```

Each prints `dataVersion=<hash>`. They must match.

## Open decisions carried into this release

1. **Percentage-point unit.** A `percentage_point_change` ranking reports
   `unit: "percent"`. The unit vocabulary has no percentage-point member and
   adding one changes the shared schema. Imprecise but no longer false — the
   previous behaviour reported a percentage change as `GEL`.
2. **2004 revenue components.** `rank` publishes a 2004→2005 table topped by
   `revenue.asset_decrease` at +476.6%. `/mcp` exposes `rank` to outside
   clients, so this should be settled before enablement.
3. **`workbookSources.ts:160` weak https check.** A reviewer confirmed it is not
   exploitable today. Tighten or accept explicitly.
4. **CI dependency audit.** `npm audit --audit-level=high` already fails on
   `main` with 4 high advisories, none from the MCP SDK — verified against the
   pre-SDK lockfile, which produces identical counts. It is a hard gate in
   `.github/workflows/ci.yml`, so it will block the pull request regardless of
   this work.

## Snapshot identity at the time of writing

```
dataVersion 3f4b6f9cfe0bd92dcd6c780497f3a8ab47455fb506d49bf88b1843b5292a6f69
sources     104, all resolved
```
