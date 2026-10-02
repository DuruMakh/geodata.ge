# MCP upgrade verification

## Current integrated state — Task 10

Date: **2026-10-02 (Asia/Tbilisi)**. Integrated baseline: `ccf50e9e8c898a337a9ce4c8e5e7906bf0107b62`. Data schema is now **1.5.0**, with **14 read-only tools / 11 dataset families**. Tasks 1–9 completed their independent task reviews. Task 10 completed local gate components, the production build/postbuild, **632 browser tests**, bundle inspection and compiled-endpoint proof. Its initial full `check` stopped on three outdated test assumptions; the affected tests and remaining components passed separately, as recorded below. No nonexistent all-green combined rerun is claimed. A fresh GPT-6 Astra [whole-branch and Task 10 review](2026-10-02-mcp-final-review.md) approved local readiness at `b8b9c262`, with zero Critical/Important findings and one temporary-guide pointer corrected below. Publishing is not authorized.

Tasks 3–7 package **305 current products / 84,056 exact-decimal facts / 47 public bilingual history notes** without source locators or internal identity-decision fields. Product annual queries subtract 100 from published annual indices; cumulative queries use the shared explorer's complete monthly compounding from January `startYear`, relative to the preceding December. Missing inputs and reviewed identity splits remain explicit nulls/qualifications. Catalogue/source discovery, annual comparisons and value ranking cover the current roster with unchanged public input/result caps. Two product publications join the shared manifest: **22 listed files / 23 artifacts**. Complete tool schemas/text retain classifications, history notes, sources, caveats and cumulative bases. Eight product reference cases, including independently CSV-derived values, the unsupported cumulative-comparison contract and an explicitly synthetic missing-input check, augment the unchanged forty earlier intents; the reference test suite contains **59 tests**.

The preserved [Task 7 contract report](2026-10-01-mcp-tool-contract-report.md), [independent CSV reference audit](2026-10-01-mcp-independent-reference.cjs) and [results](2026-10-01-mcp-independent-reference.json), [real-SDK wire audit](2026-10-01-mcp-wire-evidence.ts) and [historical results](2026-10-01-mcp-wire-evidence.json), and [Task 8 runtime import audit](2026-10-01-mcp-import-audit.cjs) and [results](2026-10-01-mcp-import-audit.json) now live in durable review storage. Their original evidence meaning is preserved; compiled-server results will be recorded separately.

Task 8 measured the packaged snapshot and complete response budgets; Task 9 added bilingual dynamic national/city/product examples and qualified current official client guidance. Human application/account/protocol/sourced-answer proof and actual safe database-mirror parity remain **unverified**. Automated SDK, CSV and structural parity evidence cannot substitute for those boundaries. Production Upstash enforcement and live deployment also remain unverified.

### Recorded decisions and their costs if wrong

These are the controller's execution rulings, in order. None changes the reviewed numbers or raises an operating limit.

1. Use the official SDK's separate legacy/modern JSON adapters and one tool factory because its default legacy handler streamed. If wrong, adapter wiring needs repair; real-client parity and teardown tests cover it.
2. Disable tool-change subscriptions and set subscription capacity to zero because listening otherwise opened SSE. If wrong after an SDK change, refusal behavior needs adjustment.
3. Treat modern client identity as recommended/optional, following the final standard and installed SDK; version/capabilities and invalid-present identity remain validated. If wrong, metadata validation needs revisiting; identity is never authentication.
4. Declare the cumulative measure type in Task 3 so basic product discovery compiles before Task 4. If wrong, type declarations or task sequencing need repair; old validators were not widened.
5. Apply history notes conservatively to older mapped histories and the p0148 discrepancy throughout its public history, based on reviewed evidence. If wrong, notes may need narrowing; values remain unchanged.
6. Defer actual bundle tracing to the single Task 10 build while checking configuration/imports in Task 8. If wrong, a bundle defect is discovered later; actual trace proof remained required and passed.
7. Reuse independent reviewer sessions when the agent harness refused new threads. If wrong, retained context may bias a task review; scoped packages and the later fresh Astra whole-branch review mitigate this. New slots later permitted Luna's final mechanical inventory and that fresh review.
8. Use existing Playwright tools for screenshots when the Windows agent-browser helper failed to launch. If wrong, the alternate tool may miss an automation-specific problem; visual inspection and the 632-test browser gate complement it.
9. Complete the failed broad check through affected-test reruns and the remaining validation steps because only assertions changed. If wrong, a cross-file test effect could be missed; unchanged full-run results, corrected files, types and lint cover the changed tree. The initial command failure remains recorded.

### Verified flow and retained access boundaries

| Boundary | Local evidence |
| --- | --- |
| Connection pages and copy controls | Both languages, desktop/390px screenshots and connection assertions within 632 passing browser tests |
| SDK clients to the compiled endpoint | 18 real HTTP requests, both protocol eras, 14 tools and six full-schema-equal call pairs |
| Endpoint to bundled data | Snapshot/data identity, 121-entry trace, eight compiled files and complementary import audit |
| Data to values and source evidence | 59 passing reference tests, independent CSV arithmetic, explicit missingness, definitions and caveats |
| Bulk publications | 22 manifest-listed files plus the manifest; build checks and served product hashes agree |
| Human assistant account and sourced model answer | Unverified; SDK evidence is separate |
| Real mirror, production counter, CI and live deployment | Unverified; future authorized release must prove them |

## Historical Task 2 — transport-only checkpoint

Date: 2026-10-01 (Asia/Tbilisi)
Task: 2, transport migration only; baseline `c58a7389`.
Status: local SDK compatibility verified; integration gates and human application/production proof remain pending.

## Installed package proof

`npm ls @modelcontextprotocol/server @modelcontextprotocol/client @modelcontextprotocol/sdk @modelcontextprotocol/core` reports server/client/core **2.2.0** and SDK **1.30.1**. All three direct packages are pinned exactly. Only the server package is a production dependency; both client packages are development dependencies. `npm ls --omit=dev` reports only `@modelcontextprotocol/server@2.2.0` among the three direct packages. Lockfile changes were made through npm with the task-local cache.

The exact installed server declarations and implementation were checked, alongside the official [protocol-version guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md), [HTTP-serving guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md), [legacy-client guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/legacy-clients.md) and [2026-07-28 migration guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28). These sources were checked for the pinned SDK during implementation. They revealed three details requiring explicit handling:

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

Actual final wire proof remains the separate Task 7 real-client evidence: its complete catalogue was **469,455 legacy / 469,565 modern bytes**, with **54,833 / 54,723 bytes final-wire headroom**. Task 8's 469,421-byte tool result matches that earlier bounded result, but is not being presented as a newly measured HTTP wire. Preserved detailed evidence resides in the [Task 7 report](2026-10-01-mcp-tool-contract-report.md) and [wire results](2026-10-01-mcp-wire-evidence.json), relocated from execution scratch by Task 10. No account or network request was made for Task 8.

### Bundle and failure boundaries

`next.config.ts` explicitly traces `./lib/factQuery/generated/snapshot.json` into `/mcp`. A TypeScript-AST traversal from `lib/mcp/tools.ts`, `snapshot.ts` and `result.ts` followed **62 project-local runtime modules / 209 import edges**. It omits type-only imports and does not inspect third-party package internals. No path reaches `buildSnapshot`, serving loaders, database modules or the product identity file reader; the sole filesystem import is the packaged snapshot loader. In particular the product arithmetic's product-identity imports are type-only. Existing fact-query and MCP purity tests pass. No built MCP trace exists yet; actual trace inclusion and absence of serving loaders must be confirmed after Task 10's single integrated build. The approved plan now states this division explicitly.

No demonstrated latency regression, repeated-query failure or honest catalogue overflow required a production repair. The existing byte refusal is the intended contract, not a reason to raise limits. The historical small-snapshot timing comment in `lib/mcp/snapshot.ts` was left untouched because Task 8 is scoped to measurement/evidence; current assessable timings are recorded here.

### Narrow verification and pending integration

- Test-first CLI proof failed **2/2** against the old measurement output. During implementation its first combined feedback run had **74 passing tests across five unchanged files** and the new CLI suite failed before assertions because the diagnostic collector treated catalogue exclusions as ranking groups. Restricting that collection to ranking results resolved it. The later new-file run found the unsupported missing-population assumption described above; the final CLI run passed **2/2**, duration **17.19 s**.
- The five passing files were `result.test.ts`, `resultWireLimit.test.ts`, `reference.test.ts`, fact-query `purity.test.ts` and MCP `purity.test.ts`. **All 59 reference tests passed unchanged.** This is passing affected-file evidence, not a claim of one all-green combined rerun.
- Final `npm run typecheck` passed. Scoped `eslint --max-warnings 0` passed on the script and new test; initial lint found four new test-only explicit `any` types, corrected to structural test types.
- The prescribed measurement command completed with **45 scenarios**, writing the linked JSON. Static import audit passed after its audit-only resolver was corrected to recognize explicit `.json` imports. `git diff --check` passed.

No full `check`, build, browser suite, mirror/database read, push, PR, deployment or live verification was run. Full completion gates and built-trace proof remain Task 10; human application/account proof remains Task 9; publishing remains unauthorized. The CLI test uses no absolute latency threshold, so routine machine load is not converted into a false performance contract.

## Task 9: bilingual discovery and application guidance

Date: **2026-10-02 (Asia/Tbilisi)**. Base `9dfb8356313bddce564de54c02c1a8e2515d675f`. This is local content and documentation work; no build, browser execution, deployment or human account connection is claimed.

Both connection pages keep the existing warm composition, selectable endpoint/prompt, two copy controls and all five budget/economy questions. Five inflation questions now cover national annual inflation, highest annual food inflation among all measured cities, Batumi's annual-rate change in percentage points, current-product annual ranking, and a selected product's complete January-to-endpoint cumulative change relative to the December before its first year. Coverage, product/city counts, national and product latest months, a month shared by all city food series and two real Batumi headline months come from the packaged snapshot. A shared product calculation selects an actually complete cumulative history. Current examples resolve to **2026-08**, Batumi **2026-07 → 2026-08**, and **Wheat flour / პურის ფქვილი, 2015-01 → 2026-08 relative to 2014-12**. The page states **305 current products, 2015-01–2026-08** and **six city histories, 2016-01–2026-08**, with shorter/missing individual histories disclosed. It distinguishes published base-100 inputs, published annual-index-minus-100 rates and Fiscal.ge's compounded result. Product metadata/CSV and locale-appropriate methodology links use shared existing URLs.

`llms.txt`, the connection language/technical notes, runbook and caveat-contract owner now agree on **data schema 1.5.0**, modern **2026-07-28** discovery/per-request metadata and preserved legacy **2025-11-25** initialization. The changing tool/file inventories are owned by `tools/list`, `catalogue.json` and `manifest.json`; the manifest is an additional artifact, not one of its listed files. `llms.txt` explicitly includes the 14th tool, `query_inflation_products`, with product compare/rank/missingness/exclusion semantics and bulk guidance. No operating limit or service instruction code changed. §2C now explicitly calls the product-MCP approval a later amendment; earlier explorer approval is retained. The existing product methodology already contains the complete Tasks 4–6 contract and was not duplicated. Historical dated runbook release counts/timings remain historical. Only `/connect`'s English review date changes to `2026-10-02`, so its sitemap translation freshness matches the edited copy.

### Application documentation versus actual application proof

Used the OpenAI Docs skill, searched official domains and opened current primary pages. [OpenAI's MCP guidance](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) was fetched directly (the former developers.openai.com/codex/mcp address redirects there), and [its docs-MCP quickstart](https://developers.openai.com/learn/docs-mcp) was also opened. They establish documented remote Streamable HTTP setup and the shared desktop/CLI/IDE configuration; the quickstart establishes CLI URL registration. The page's Codex block is qualified as official guidance and links the source, rather than claiming current menus/account access were tested. Local `Get-Command codex` resolves the standalone executable; fresh `codex --version` returns **codex-cli 0.146.1**. No login/configuration/model command was executed.

[Claude's current primary guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) was opened and its current connector/account and Customize/Connectors instructions inspected. It documents Free/Pro/Max/Team/Enterprise support (one custom connector on Free), owner-controlled organization setup and an individual Pro/Max flow, with No sign in available for unauthenticated servers. The public page qualifies account/workspace rules and links this guide. Fiscal.ge requires no token/extra headers; that does not waive an assistant's own account/security rules.

| Application | Actual observation in this environment | Still unverified |
| --- | --- | --- |
| Codex | Installed CLI version 0.146.1 only; current official docs read | Current desktop menus/version, personal plan/account eligibility, negotiated app protocol, completed sourced answer |
| Claude | Current official docs read; historical owner clickthrough retained as provenance | Installed/authenticated app version, personal eligibility, actual connector/menu flow, negotiated protocol, completed sourced answer |
| ChatGPT | Existing separate web-reading prompt preserved | Its own direct custom-connector flow/eligibility/protocol/sourced answer; no direct setup added |

Native application control is disabled here and no Fiscal.ge connector is exposed in the available tool inventory. Therefore the human-login/model-answer matrix cannot be completed in this session. There was no credential request, configuration change, login or model call. Official documentation reads are evidence of published guidance, not human application proof; earlier SDK evidence proves transport contracts separately.

### Focused checks and deferred browser proof

- Test-first rendered-page checks: **3 failed / 4 passed** before page changes, expected missing new example/date behavior. After implementation, **6 passed / 1 failed** because the new test used a Georgian December stem that excluded the actual inflected wording; corrected the test's stem, with baseline meaning intact. No numeric reference was changed.
- `npx vitest run --configLoader native tests/seo/connect.test.tsx tests/mcp/coverageLanguages.test.ts tests/methodology/inflationProductsContent.test.ts tests/i18n/messages.test.ts tests/i18n/coverage.test.ts`: **5 files / 25 tests passed**, duration **4.16 s**. The new earlier-snapshot test removes facts after `2025-12` and verifies dates move to December/November 2025 while the previous-December cumulative base stays explicit; it catches hardcoded release-month examples.
- After refining only the new Georgian text: affected `tests/seo/connect.test.tsx` rerun **7/7 passed**, duration **1.75 s**. After the single review-date edit: `tests/i18n/pageRevisions.test.ts` **2/2 passed**, duration **2.42 s**. These constitute **27 distinct passing tests**, with affected reruns; no all-green final combined rerun is claimed.
- Final `npm run i18n:check` passed: **287 labels / 121 page identities**. First type check found an inferred optional-undefined field in the new example-values union; annotating that array with the existing `TemplateValues` type resolved it. Final `npm run typecheck` passed. Scoped `eslint --max-warnings 0` passed for the page, rendered-content test and browser spec. `git diff --check` passed.
- Browser assertions now cover both locales at **390px**, ten total examples, actual product publication/catalogue counts and coverage, shared downloads, methodology links, both copy controls invoked by keyboard, no horizontal overflow and no page/console errors. Existing desktop/mobile and budget/economy assertions remain. **These browser assertions have not run**; Task 10 owns the single built-artifact browser/visual gate and full check/build.

No source facts, snapshot content, query arithmetic, transport, rates, limits, route, CSS system, account/configuration or database mirror changed. No publication was edited by hand or regenerated. Publishing remains unauthorized; actual human connection proof remains an explicit access boundary, not a passing SDK inference.

## Task 10: integrated local gate and compiled artifact

All npm/npx commands ran from `apps/web`, with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`; Git and the standalone CJS audits ran from the repository root. This task changed no production behavior. The only test repairs are the demonstrated generic-label assumption and stale agent-guide matcher/link inventory. The reference fixture's sole change is its relocated evidence path in a comment; every numeric expectation remains unchanged.

### Completion commands and actual results

| Check | Actual result | Recorded output |
| --- | --- | --- |
| `npm run check` once | Full lint and types passed; units: **2,705 passed / 3 failed / 7 skipped**, **314 passed / 2 failed / 1 skipped files**, 293.19 s. Chain stopped before data/localization steps. | [Initial check](2026-10-02-mcp-check.log) |
| Affected `localization.test.ts` + `agentFiles.test.ts` | **10/10 passed**, 9.88 s; subsequent typecheck and scoped ESLint passed. | [Repair tests](2026-10-02-mcp-repair-tests.log) |
| Remaining `npm run data:validate` | Passed all fifteen validation stages, including all source/archive and publication-input checks. Products: **305 / 84,056 facts / 83,880 published / 176 unavailable / zero monthly gaps**. | [Data validation](2026-10-02-mcp-data-validation.log) |
| Remaining `npm run i18n:check` | **287 labels / 121 public page identities**, registered messages valid. | [Localization](2026-10-02-mcp-i18n.log) |
| `npm run build` once | Compilation, TypeScript and **251 generated static pages** passed; `/mcp` is the only dynamic route. All postbuild checks passed; **23 publications current / 22 manifest-listed files**, hashes verified. | [Build and postbuild](2026-10-02-mcp-build.log) |
| `CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test` | **632/632 passed using four workers**, 3.4 minutes, against the built artifact. | [Browser gate](2026-10-02-mcp-browser.log) |

The three initial failures were: the translation test calling the old generic dictionary for a product ID instead of checking its reviewed product-catalogue label; the guide test matching a superseded tool-list sentence; and the guide's exact link inventory missing the approved product explorer/CSV/JSON links. The repair verifies every returned product English label against the reviewed snapshot catalogue, nonempty and without Georgian characters. Every old dictionary/unknown-label check is retained. The guide test now verifies all fourteen named tools and all **47 earlier links plus three added links = 50**, without changing public content.

Assembled passing unit evidence is **2,708 passed / 7 skipped across 316 passing files / one skipped file**. The full run included the unchanged **59-test reference suite** (48 bilingual intents plus eleven inventory/boundary tests); none failed or was skipped. A [declaration inventory](2026-10-02-mcp-reference-inventory.json) confirms the selected file; its twelve static templates are not an extra execution or a claim of twelve reference tests. The seven skipped tests belong to the existing disposable-local-debt-database suite, because no `GEODATA_TEST_DATABASE_URL` was configured. No database connection was attempted. Passing broad components were not repeated after the test-only repairs.

Other validation counts include 132 resolved logical sources, 30 national GDP facts, 37 balance facts, 126 debt facts, 6,930 regional-economy facts, and 47 nominal-GDP artifact comparisons. Product validation independently checked **41,830 monthly arithmetic cells / 3,157 prior-year checks**, with **29 reviewed links / 18 splits** and unchanged archived-original hashes. The build's five existing public CSV output checks, regional-economy CSV check and inflation CSV check all passed.

### Bundle and runtime separation

The [reproducible build audit](2026-10-02-mcp-bundle-audit.cjs) and [actual trace/chunk evidence](2026-10-02-mcp-bundle-audit.json) resolve `.next/server/app/mcp/route.js.nft.json`: **121 trace entries**, including the **46,285,296-byte snapshot**, schema **1.5.0**, dataVersion `2776fc1896f85c77d7b951aa4f13e5d94fdef8135acf92f076df35a6bbec8aa7`, generation commit **ccf50e9e8c898a337a9ce4c8e5e7906bf0107b62**. Snapshot SHA-256 is `fb2b358d3c41952bfc35a8f4be7142a0aa714d53d69aa26bc31a47e474945107`, generated at `2026-10-01T22:37:33.069Z`. Two trace entries resolve to the same snapshot; the recorded byte size is the actual file size, not two copies added together.

The audit inspected **eight compiled route/trace JavaScript files**, as well as the trace paths and current Next tracing configuration. No serving-data loader, snapshot builder, database module/client/configuration, product-identity file reader, raw-import/original-document path or development v1 SDK file matched the recorded bans. The relocated Task 8 AST audit still reports **62 project-local runtime modules / 209 edges**, with `node:fs` imported only by `lib/mcp/snapshot.ts`. These complementary checks inspect bundled code as well as traced files; trace absence alone is not used to claim every source module is absent. They establish this local artifact, not hosted function size/performance or safe mirror parity.

### Actual compiled SDK endpoint proof

After the successful build, an owned `next start --port 3100` ran with temporary local-only `MCP_ENABLED=true`, `MCP_RATE_LIMITER=memory`, `VERCEL_ENV=development` and the Fiscal.ge site URL. The production Host/origin guards were retained. The [audit utility](2026-10-02-mcp-built-endpoint.ts), [JSON evidence](2026-10-02-mcp-built-endpoint.json) and [output](2026-10-02-mcp-built-endpoint.log) use actual modern SDK **2.2.0 pinned to 2026-07-28** and legacy SDK **1.30.1** transports against the compiled Next route, not the source bridge.

The initial global-fetch Host override was refused with `forbidden_host`; a direct global-fetch check reproduced it. The supported SDK custom-fetch option now uses bounded `node:http` solely to send `Host: fiscal.ge` while its socket URL stays localhost:3100. No server guard, production setting or MCP negotiation code changed. The successful audit made **18 SDK HTTP requests**, below the existing minute limit. Discovery/initialization and both cached fourteen-tool listings completed; all six subsequent call pairs validated their declared output schemas and returned deeply identical full structured content, matching the build's schema/dataVersion/releaseCommit. No session was issued.

| Compiled call | Observed content | Legacy wire / modern wire bytes |
| --- | --- | ---: |
| Full product catalogue | 305 current series, full reviewed metadata | 469,455 / 469,565 |
| Rice annual, 2026-08 | **1.8973%**, published annual source | 7,191 / 7,301 |
| Rice cumulative, January–December 2025 | **−13.7927891681444%**, **2024-12 base**, upstream monthly source and derivation caveat | 11,133 / 11,243 |
| Annual rank100 | 305 candidates / 305 eligible / 100 returned | 63,523 / 63,633 |
| Since-2015 cumulative rank100 | 305 candidates / 287 eligible / 100 returned, qualified missing histories | 105,317 / 105,427 |
| Product sources | Two original source records, unchanged registered metadata | 12,871 / 12,981 |

Every final JSON-RPC reply stays below **524,288 bytes**, with **54,723 bytes modern catalogue headroom**. The annual/cumulative numeric checks use the independent direct-CSV audit, not an application output copied to an expectation. Served product CSV (**7,150,643 bytes**, SHA-256 `1485663e95d3b40cf5a35166f859df5045a5b013ecee3953a09894700080b7ff`) and metadata JSON (**492,893 bytes**, SHA-256 `d2b81db6992ad274d2d3174b011b196da91d9800e03e19f91a803f4fc58170d8`) match the served manifest. [Separate rerun source-bridge evidence](2026-10-02-mcp-source-bridge-evidence.json) verifies the relocated wire utility; the historical Task 7 reference/wire JSON files were independently compared byte-for-byte to their base Git versions and preserved.

### Browser, logs and process cleanup

Before the full browser gate, the task lead captured and inspected both `/connect` locales at **390×844** and **1280×900** using the existing Playwright screenshot CLI. All four captures completed, with meaningful content, preserved typography/copy blocks and no visible clipping, blank page or error overlay. Screenshot review alone is not measured overflow, console or keyboard proof. The succeeding full browser suite includes the exact mobile overflow, console/page-error, copy-control keyboard, current examples, download/link and existing product-explorer assertions.

The [owned server log](2026-10-02-mcp-server.log) contains the two expected initial Host refusals and seven framework `Internal: NoFallbackError` messages observed while negative-404 browser coverage ran. Request-path correlation is not present in those framework lines, so a precise cause is not claimed; all recovery/404/browser assertions passed. Successful compiled MCP calls logged only approved activity fields and `outcome: ok`; the SDK's fixed JSON-mode warning appeared once. No model call, account operation or sensitive request-body logging occurred.

The owned server's listener was stopped after all verification. An independent port-3100 bind probe succeeded; no unrelated process was terminated and no rebuild occurred while serving. The managed terminal wrapper remained allocated after Ctrl-C, but the serving listener was gone. Final independent approval and its documentation resolution are recorded at the top of this report. Human assistant access, safe database-mirror parity, production Upstash, GitHub CI and deployed/live behavior remain unverified; no push/PR/merge/deployment was performed.

### Subsequent user-requested review

A fresh [requested code review and resolution](2026-10-02-mcp-requested-review.md) identified one Important omission: monthly availability was present in structured responses but absent from their text. The correction at `be792bf7` adds bilingual spans, exact years and null/gap explanations without changing facts or limits; the reviewer confirmed it resolved. Fresh focused tests and the rebuilt artifact passed. The refreshed broad check encountered one unchanged import-test timeout, which passed its isolated rerun; the remaining validation stages passed separately. Fresh assembled evidence is **2,713 passing unit tests plus seven database skips**, without a successful combined-check claim. The new build identifies `be792bf7`; earlier compiled-endpoint/browser evidence above retains its original artifact identity and is not relabelled as a rerun. All external release boundaries remain.
