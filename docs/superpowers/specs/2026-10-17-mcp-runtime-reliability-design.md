# MCP safe failures and dependency maintenance

**Date:** 17 October 2026. **Status:** Proposed design for review; implementation has not started.

**Purpose:** An unexpected failure must give an assistant a safe, useful error and give the operator a reliable failure signal, without exposing internal error text or weakening validation.

**Basis:** [Reviewed MCP audit](../reviews/2026-10-17-mcp-full-audit.md), important finding 4, dependency findings and unsupported-method refinement. Synthetic fault injection demonstrated raw exception text in both protocol eras. No ordinary tested production input exposed a secret or demonstrated an exploitable dependency path.

**Companions:** [answer integrity and schema 1.6.0](2026-10-17-mcp-answer-integrity-design.md), [discovery/performance](2026-10-17-mcp-discovery-performance-design.md), [operations](2026-10-17-mcp-freshness-operations-design.md), [implementation plan](../plans/2026-10-17-mcp-audit-remediation-implementation.md).

## 1. Scope and preserved behavior

Cover unexpected failures in the registered callback, response shaping and the SDK's subsequent output validation. Preserve useful input-validation and semantic errors. Make unsupported GET/DELETE requests use the existing host/Origin policy before returning 405. Review dependency advisories through the current audit policy and real transport tests.

Preserve the public read-only endpoint, stateless modern and legacy transports, the bundled snapshot, no-auth connection, fixed Upstash network exception, pause switch, timeouts, quotas, body/cell/byte limits, static fallback and logging allowlist. This is not a transport rewrite, new authentication system or self-hosting project.

## 2. Reuse and small additions

| Treatment | Owner |
| --- | --- |
| Reuse unchanged | `apps/web/lib/mcp/result.ts`'s `toolResult`, `BULK_DATA_URL`; `lib/factQuery/meta.ts`'s `buildResponseMeta`; route error classification and one-record logging; existing HTTP test bridge and client fixtures. |
| Small addition | `result.ts` adds `internalErrorResult(snapshot): ToolResult`; `tools.ts` catches callback failures and sanitizes the existing public Standard Schema output validator. |
| Small addition | `lib/factQuery/schemas.ts` admits `internal_error`; `lib/factQuery/localization.ts` and `data/localization/{ka,en}/service-messages.json` own its reviewed message. Coordinate with schema 1.6.0. |
| Small addition | `app/mcp/route.ts` applies its existing request-origin/host checks to unsupported GET/DELETE requests. |
| Existing maintenance | `apps/web/package.json`, `package-lock.json`, `scripts/audit-dependencies.ts`, its tests and existing CI audit step. Change only dependencies needed for the reviewed findings. |
| Genuinely new | `apps/web/tests/mcp/toolFailure.test.ts`, isolating injected callback/output faults from the existing server-factory failure tests. No new production module or error framework. |

## 3. Safe internal-error contract

The public code is `internal_error`. It means an unexpected server calculation, shaping or output-validation failure. `service_unavailable` continues to mean an intentional pause or unavailable infrastructure such as the shared limiter.

Use fixed, reviewed bilingual wording with the meaning: “The service could not complete this request. Try again later, or use the published files.” Include the existing bulk-data URL. Mark it retryable, without directing the client to retry in a tight loop.

`internalErrorResult(snapshot)` constructs a normal safe error envelope through existing metadata/result helpers, then returns the existing **text-only** MCP error shape: `isError: true`, no `structuredContent`, and a line beginning `error internal_error`. It must not accept an exception argument or interpolate exception messages, stacks, paths, parameter strings or validator issue details.

Prepare this trusted result and its safe text **during server creation, before any registered callback runs**. A callback catch returns a fresh small copy of the prepared result; the output validator uses the prepared text. Neither failure path may call `toolResult`, `renderText`, localization or query helpers again. Otherwise a formatter failure could throw again while formatting its own error and reach the SDK's raw-message handler. If preparing the safe result itself fails, use the existing outer factory/route failure boundary, which returns its fixed bilingual HTTP 500. Keep setup failure distinct from an HTTP-200 tool failure.

The route records exactly one allowlisted event with `outcome: "error"` and `errorCode: "internal_error"`. HTTP 200 remains possible for a tool error; monitors must read that event rather than HTTP status alone. No new raw diagnostics enter application logs.

## 4. Put the boundary where the failure occurs

### 4.1 Registered callback

Wrap the complete callback in `createMcpServer`, including requested-cell calculation, the pre-work limit result, `tool.run`, rendering and bounded-response shaping. Return semantic query errors unchanged. Catch an unexpected thrown value, whether or not it is an `Error`, and return a fresh copy of the already prepared safe result. Never reconstruct it inside the catch.

Before returning a non-error `ToolResult`, require `structuredContent` to exist. The installed SDK checks for its absence before calling the output validator; the validator guard alone would miss this branch.

### 4.2 SDK output validation

The SDK validates successful output after the callback returns. The implementation must exercise this actual late stage, not merely validate a result inside the callback and assume the SDK cannot fail later.

Extend the existing adapter signature locally:

```ts
convertedOnce(schema: ZodTypeAny, safeValidationError?: string): StandardSchemaWithJSON
```

Input registrations remain unchanged. For output registrations only, wrap the existing `~standard.validate` function:

1. Await its result, accepting either a synchronous result or a promise.
2. Return a valid result unchanged.
3. For validation issues, a thrown value or a rejected promise, throw a new error containing only the fixed safe bilingual tool-error text.

The SDK then converts that fixed text to its error result. Preserve its JSON Schema cache, validation rules and public registration interface. Do not add a second full output-validation pass, accept invalid output, coerce it into success, subclass private SDK methods, monkeypatch the package, or match arbitrary exception prefixes to decide whether they are safe.

The current adapter and SDK behavior were inspected in version 2.2.0. Reconfirm this interaction if dependency maintenance selects a different version. This boundary covers the specified callback and output-validation stages; it is not a claim about every possible failure inside future SDK internals. The existing outer route boundary remains in place for uncaught route failures.

## 5. Unsupported methods

Run the existing host/Origin validation before GET/DELETE return 405. Valid or absent allowed Origin with the expected host still returns 405 and the existing allowed-method information. Invalid Origin or host returns the same 403 policy as other requests. OPTIONS retains its existing behavior.

Do not initialize a session, start a stream, load query data or charge a shared limiter merely to refuse an unsupported method. Existing POST ordering and limiter charging remain unchanged. This is policy consistency; the audit did not show GET/DELETE returning private data.

## 6. Dependency decisions

The audit baseline is SDK 2.2.0, a top-level `fast-uri` override at 3.1.7, and an embedded SDK copy at 3.1.0. The [upstream advisory](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj), checked on 17 October, identifies 3.1.8 as patched. Verify current advisories and supported releases again at implementation time.

1. Review the small top-level `fast-uri` patch and resulting lockfile separately from the SDK candidate. A package override does not replace code embedded inside the SDK bundle.
2. Inspect a candidate SDK's release notes **and downloaded package artifact**. Establish whether its bundled parser implementation is patched; neither a newer package number nor a clean package-manager audit proves that.
3. Accept an SDK change only after the modern pinned, modern automatic and legacy clients, malformed requests, safe-output failures and function-size checks pass. Keep server/client versions mutually supported.
4. If no suitable patched SDK exists, document the embedded dependency, reachable use and remaining exposure. Current host/Origin decisions use native URL parsing with exact comparisons, and the service does not fetch caller-supplied URLs. Do not present that as a universal security guarantee or vendor-patch the SDK simply to silence the finding.
5. Review `uuid`/ExcelJS through a supported dependency path and the affected workbook regression tests. Do not accept a suggested major downgrade automatically or broaden this task into an Excel rewrite.
6. Preserve the full production-and-development audit, exact existing lint-chain exception, malformed-report rejection and blocking of additional high/critical findings. The accepted lint exception expires **2 November 2026, 00:00 UTC**. Fix it through a supported path or seek a separate explicit decision before expiry; this design does not renew it.

A remaining accepted or unreachable moderate advisory must be reported as remaining, with evidence. Do not mark dependency remediation complete solely because a command exits successfully.

## 7. Acceptance matrix

Test the real route with both modern and legacy requests. Inject synthetic identifying text into the fault and assert it is absent from the complete response and captured logs.

| Scenario | Required result |
| --- | --- |
| Query throws an Error containing a synthetic path/token | Safe bilingual `internal_error`; no synthetic text, stack or internal path. |
| Query throws a non-Error value | Same safe result. |
| Result shaping/localization keeps throwing after successful server setup | Same safe tool result; the fallback does not re-enter the failing formatter or localization path. |
| Preparing the safe result fails during server creation | Existing fixed bilingual HTTP 500 and one safe internal-error event; no raw factory error. |
| Success lacks structured content | Safe failure before the SDK's unsafe missing-content branch. |
| Registered output validator reports issues | Actual SDK late-validation path returns safe text; no issue details. |
| Validator throws or rejects asynchronously | Same safe behavior, no unhandled rejection. |
| Invalid request argument shape | Existing public SDK argument error remains useful and classified as invalid input. |
| Unknown series/entity/year or unsupported measure | Existing bilingual semantic error and specific code remain intact. |
| Each callback/output fault | Correct request ID/protocol metadata, `isError: true`, exactly one safe internal-error log event. Setup failures retain their separate outer HTTP-500 contract. |
| Successful tools | Existing output schemas, both representations, response limits and reference values still pass. |
| GET/DELETE origin matrix | Correct 403/405 distinction; no stream, session, data access or limiter charge. |
| Dependency candidate | Artifact inspection, audit-policy tests, real-client compatibility and unchanged function budget provide separate evidence. |

Tests should restore module mocks and use the existing bounded HTTP bridge. `routeFailure.test.ts`'s factory-error coverage remains useful but does not replace callback/output-stage tests.

## 8. Completion and rollback

Integrate with the other specifications before the repository's full completion gate. Record precise dependency versions and any unresolved advisory. A release rolls back code and its bundled snapshot together through the existing deployment procedure; no database or Redis migration is required by these runtime changes.
