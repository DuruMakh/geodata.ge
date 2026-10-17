# MCP implementation-plan review

17 October 2026. Review of the [implementation plan](../plans/2026-10-17-mcp-audit-remediation-implementation.md) and its four companion specifications against checkout `4a55558aa7da5ef2197186b3ffab5d2ee0b68474`.

**Verdict:** The architecture and finding coverage are sound, but the original plan had five actionable planning defects. They are corrected in the plan and relevant specifications. No application implementation, source refresh, dependency change or production change was made. This review establishes planning readiness, not that the future fixes pass their tests.

## 1. Important: a valid data refresh conflicts with the unchanged-reference requirement

**Original instruction:** Tasks 8 and 12 expected a newer reviewed CPI vintage and an entirely unchanged passing reference fixture.

**Evidence:** `apps/web/tests/factQuery/fixtures/referenceIntents.ts:1018` and `:1049` explicitly pin the latest available period to `2026-08` for intents 38 and 40. `reference.test.ts:138` compares those arrays exactly. The fixture reads the current packaged snapshot, not a frozen August package.

A local in-memory probe appended a deliberately synthetic September city fact without changing historical facts. The actual query helpers then returned:

| Intent | Original coverage | Coverage after synthetic extension | Historical requested result |
| --- | --- | --- | --- |
| Batumi August 2026 annual inflation | `2016-01`–`2026-08` | `2016-01`–`2026-09` | Unchanged |
| Zugdidi June 2016 annual inflation | `2016-12`–`2026-08` | `2016-12`–`2026-09` | Still missing |

This proves the conflict without claiming that the synthetic values are official September observations. No canonical file was changed.

**Consequence:** The original plan would stop at an expected metadata mismatch or tempt an implementer to weaken the reference gate to make the refresh pass.

**Correction:** Task 8 now stages candidate originals before activation, reports the exact source-backed coverage-only changes and requires review/authorization under the repository's reference stop rule. Historical values, units, missingness and caveats remain protected. The fixture is not made self-fulfilling by deriving expectations from the query under test. Until the checkpoint is resolved, unrelated code fixes continue against the last validated package.

## 2. Important: the local release probe was not configured to reach a working MCP service

**Original instruction:** Task 12 built with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, started localhost and ran the probe without enabling MCP, choosing its local limiter or allowing that local host.

**Evidence:** `apps/web/lib/mcp/limits.ts:32` defaults the route to paused. `createCounter` at `:89` fails closed without a configured limiter. `security.ts:20` and `:69` enforce the configured host, so a localhost request conflicts with the production site URL. Focused calls to the existing controls confirmed:

| Setup | Pause | Host policy | Limiter |
| --- | --- | --- | --- |
| Original documented local setup | Paused | 403 `forbidden_host` | Unavailable |
| Dedicated local server: enabled, memory limiter, preview environment and localhost preview URL | Enabled | Allowed | Allowed |

The first route response under the original setup would be the pause 503; the host and limiter failures are subsequent independent obstacles. A separate loopback HTTP check also found that this Node runtime did not send a caller-specified `Host: fiscal.ge` through native fetch, so a header-only workaround was not adopted.

**Consequence:** A correct implementation could appear broken in the final local check. A rushed workaround might loosen production guards or involve a paid limiter unnecessarily.

**Correction:** Tasks 11–12 now give the dedicated local process `MCP_ENABLED=true`, `MCP_RATE_LIMITER=memory`, `VERCEL_ENV=preview` and `VERCEL_URL=localhost:3100`. This reuses the existing nonproduction host allowance while preserving the production URL baked into browser-test output. Discovery must succeed before the full probe. Environment/process cleanup is explicit, and no production setting changes are included.

## 3. Important: the error fallback could repeat the formatter failure it was meant to catch

**Original instruction:** Catch shaping failures and call `internalErrorResult(snapshot)`, which itself calls the normal metadata/result/formatting helpers.

**Evidence:** `apps/web/lib/mcp/result.ts:307` calls `renderText` from `toolResult`. The installed SDK's registered-tool catch returns a thrown error's message. Re-entering a persistently failing formatter from the callback catch could therefore bypass the intended sanitization. This is a defect in the proposed failure-path design; it is not a newly demonstrated production exploit or a claim that the unimplemented helper already exists.

**Correction:** Task 4 prepares the safe bilingual result and text during server creation, before callbacks run. Callback catches return a fresh small copy; the output-validation guard uses the prepared text. Neither failure path invokes rendering/localization/query helpers again. Persistent post-setup formatting failures are a required test. Failure while preparing the safe result remains covered by the existing outer fixed HTTP-500 response, a separate contract from an HTTP-200 tool error.

## 4. Improvement: the benchmark could hide initial cache cost

**Original instruction:** Extend the existing cold/warm harness and demonstrate a warmed availability gain and stable repeated-request memory.

**Evidence:** `apps/web/scripts/measure-bilingual-mcp.ts:40` ends the cold scenario after snapshot loading and product-index creation; it does not execute the first query or fill the proposed availability cache. Repeating one request also cannot establish memory behavior across distinct valid cache keys.

**Consequence:** A warm-cache improvement might be reported without showing the first-request cost or retained memory needed to obtain it.

**Correction:** Task 7 now requires first-query/cache-fill timing in fresh processes, separately from loader/index cost, followed by warm samples. It exercises distinct supported product/start-year keys before measuring stable repeat behavior. Same-data comparison, independent numerical assertions and non-flaky timing review remain intact.

## 5. Improvement: release verification listed every tool but executed only a subset

**Original instruction:** The release probe checked inventory and a few representative requests while the changes affect shared schema, sources and failure handling across the service.

**Consequence:** An advertised but broken tool could be missed by live release acceptance.

**Correction:** Tasks 11–13 now require successful execution of all 14 tools through the pinned modern client, with a smaller automatic-modern/legacy parity set. A shared request counter includes implicit client exchanges and optional publication/archive reads. The thirty-request per-run ceiling stays binding; if necessary, use explicitly reported separate bounded runs. No production fault injection or load test is added.

## Additional checks and limits

- The planned expanded derived source was modelled from existing localized originals, including all eleven Treasury PDFs. It contained 89 distinct documents; the existing renderer produced an unbounded tool result of **399,869 bytes**, and the existing bound accepted it. This is a feasibility probe, not final protocol wire proof. Task 2 now explicitly checks both a one-country-year answer and the single derived-source lookup in each wire format; a caller cannot reduce source IDs below one.
- Source-chain scoping, all 69 country inputs versus territorial exclusions, city registry reuse, optional internal response hints, snapshot/base cache keys and the schema 1.6.0 decision remain consistent across the four specifications.
- Dependency maintenance still checks embedded SDK code and the existing exception deadline. Retention, real-client access and any new cost/notification arrangement remain explicitly evidence-dependent.
- Review work used code inspection and isolated local probes. No production endpoint calls, new official data downloads, full application build/test gate, database operations or deployment changes were needed. The previous application gates were not repeated because application/data inputs are unchanged.
- The original five planning documents were copied into ignored `.tmp/mcp-plan-review/before/` before editing, for a focused document diff. The temporary probe is `.tmp/mcp-plan-review/probes.ts`; it modifies only in-memory copies and restores process environment.

The updated plan can guide implementation of the code fixes. The data-reference correction must be reviewed with the actual candidate originals before that refresh is activated; external operational claims require their own evidence. Neither boundary is presented as already completed.
