# MCP data freshness and operational evidence

**Date:** 17 October 2026. **Status:** Proposed design for review; implementation has not started.

**Purpose:** Keep reviewed inflation current and make the service's actual health, capacity and evidence retention visible. Preserve the existing free-service arrangement until measured needs and a concrete budget decision justify changing it.

**Basis:** [Reviewed audit](../reviews/2026-10-17-mcp-full-audit.md), important findings 5–6 and the already documented Upstash capacity constraint. The service honestly reported August 2026 coverage; the official September headline release was available. Accessible Vercel logs retained one hour, while the runbook required 14 days of events and 90 days of aggregates. External retention and the actual Upstash account usage were not established.

**Companions:** [answer integrity](2026-10-17-mcp-answer-integrity-design.md), [runtime reliability](2026-10-17-mcp-runtime-reliability-design.md), [discovery/performance](2026-10-17-mcp-discovery-performance-design.md), [implementation plan](../plans/2026-10-17-mcp-audit-remediation-implementation.md).

## 1. Reuse and boundaries

| Treatment | Owner |
| --- | --- |
| Reuse unchanged | Official-source review, bilingual workbook parity, product identity/revision guards, canonical CSVs, transactional parity-checked database import, snapshot/publication builders and Actions-owned deployment. |
| Existing data refresh | `docs/Raw Data/Inflation/geostat-cpi/`, `geostat-products/`, their vintage manifests; `data/sources/source-documents.csv`; `data/methodology/source-archives/inflation.csv`; existing imports/reports. |
| Small documentation changes | `docs/data-methodology/inflation-cpi-national.md`, `inflation-products.md`, `ai-grounding-and-caveats.md`, and `docs/deployment.md`. |
| Reuse unchanged | `apps/web/lib/mcp/log.ts` allowlist; limiter implementation, quotas, pause response and static fallback. |
| Genuinely new | `apps/web/scripts/smoke-mcp.ts`, a small operator-run remote verification command, with `tests/scripts/smokeMcp.test.ts`. Existing in-process HTTP test fixtures cannot verify a selected remote release. |
| Conditional external work | Retention/alerts only after the actual existing setup is identified and a concrete destination/cost arrangement is authorized. No automatic new vendor, paid plan, notification recipient or recurring job. |

The implementation does not fetch source data during MCP requests, create a second data API, bypass human review, directly edit the database, or broaden the served dataset scope.

## 2. Refresh reviewed inflation through the normal pipeline

### 2.1 Verify source readiness first

Recheck the [official CPI source page](https://www.geostat.ge/en/modules/categories/26/cpi-inflation) and the [September headline publication](https://www.geostat.ge/en/single-news/3862/inflation-rate-in-georgia-september-2026). The immediate target is September 2026 because it was the demonstrated gap on 17 October. If execution occurs after later releases, record the actual latest available period and review each intervening change; do not mechanically pin the target to this document's date.

Headline publication alone does not establish readiness of every underlying workbook. Treat national/categories/cities as one CPI vintage and product inflation as its separately reviewed vintage. Report their actual coverage separately if products lag. Do not claim the full inflation family is current when only the headline has advanced.

### 2.2 CPI package

Archive all six required CPI workbook roles in both languages: **twelve originals**. Use the existing `docs/Raw Data/Inflation/geostat-cpi/<YYYY-MM>/source-manifest.csv` format with official URL, download/review date, byte size and SHA-256. Follow current latest-vintage retention, keeping earlier bytes recoverable in Git and public download paths stable.

Update the existing source registry and inflation archive manifest, then run `data:prepare-inflation` and `data:check-inflation`. The existing preparation reads the shared workbooks and validates national, category and city figures together. Preserve source precision, missing values, city starts and actual measure availability. Basket weights and targets change only when independently reviewed source information requires it.

Accept the new month's **value coverage** with historical values unchanged, except explicitly reviewed official revisions. Do not require that only new CSV lines change: review-date metadata can legitimately change on historical rows. Separate value/availability/identity changes from provenance-date changes in the review evidence.

The current reference fixture has a known release-sensitive boundary: intents 38 and 40 pin city coverage to `2026-08` even while asking historical questions. A valid later city month changes that coverage without changing Batumi's August value or Zugdidi's missing June 2016 value. Therefore an entirely unchanged fixture cannot pass after that refresh. If the candidate extends either endpoint, record the exact proposed coverage-only expectation changes from reviewed source cells and report them under `CLAUDE.md`'s reference-mismatch stop rule. Do not automatically edit them, make them dynamic from the function under test, or remove coverage assertions. Advance this part only after the precise metadata correction has been reviewed and authorized; reuse explicit authorization already present in the execution scope rather than asking twice. If neither endpoint changes, the unchanged fixture must pass and this extra correction checkpoint is unnecessary. Preserve historical numeric, unit, missingness and caveat expectations. Unexpected differences and any proposed historical revision remain separate stop conditions.

Stage candidate originals outside the automatically selected canonical vintage directory while that checkpoint is unresolved. This keeps unrelated code fixes testable against the last validated package. Use existing parsers for candidate inspection; no second serving pipeline is introduced.

### 2.3 Product package

Archive the four separate annual/monthly English/Georgian originals in `geostat-products/<YYYY-MM>/`. Run `audit-inflation-products.ts --check` before preparation. Retain stable product IDs, the reviewed current basket, source-cell provenance, history boundaries, missingness and existing identity decisions.

A changed roster, unresolved name/group boundary, new missing pattern or historical index revision stops for explicit source review. Do not link products because their names look similar, infer monthly inputs, expand retired-product access, or adjust the existing 0.002 reconciliation tolerance to make a new vintage pass.

If the product package is not ready, retain the last validated product vintage and record the lag. Release of an independently complete CPI refresh need not wait for products, but the freshness item remains partially unresolved until the separate readiness outcome is recorded.

### 2.4 Generated and serving artifacts

Regenerate methodology archives, the MCP snapshot, inflation public page data and fact-query publications. Verify manifest hashes/sizes and matching schema/data identities. The website, Excel exports, static publications and MCP must read the same reviewed values through their existing owners.

For any eventual release, use the existing transactional `npm run data:import` and parity checks through the approved deployment process. No direct database edits or new migration are expected. CSV builds remain the documented fallback; a local CSV build does not prove the production mirror was updated.

## 3. Define a practical freshness responsibility

Assign the existing **data maintainer role** responsibility for reviewing an official release and recording one of: published and reviewed, source package incomplete, revisions awaiting review, or release blocked. The project owner assigns a named person when execution begins; do not invent an owner identity.

Proposed working target: inspect new monthly CPI availability within two business days of official publication, and complete a clean review/release within five business days after all required originals are available. These are review targets for the owner to adopt, not current service guarantees. An incomplete or inconsistent source package is recorded with the missing evidence and next review date.

Use the existing methodology/runbook and implementation verification record; no parallel freshness database. Discovery and connection examples continue to derive dates from served facts. A publication being new and a dataset being newly reviewed are separate timestamps.

This specification does not create a recurring automation. Scheduling or notifications require a concrete authorized channel and owner. A manual review process can operate immediately after adoption.

## 4. Make retention claims match evidence

First inspect the current Vercel project/account and any existing external log destination. Record the observed retention window, successful query time span, data destination, owner and evidence date. A failed drains-list request or an empty filtered search is not proof that external logging does not exist.

The audit recovered logs by selecting the deployment and time window without a full-text `/mcp` search. Use that approach before concluding expected events are missing. Application error records can be infrastructure `info` records with HTTP 200.

Update `docs/deployment.md` to separate:

- **Verified current arrangement:** at the audit, one-hour accessible Vercel retention, with external retention unverified.
- **Required operating target:** 14 days of detailed allowlisted application events and 90 days of aggregates.
- **Unresolved gap and owner action:** how the target will be met or an explicitly accepted smaller target.

Do not rewrite the target as achieved, silently reduce it, or treat daily smoke-test reports as retained production logs. Provider request-address processing remains distinct from the application's privacy policy.

## 5. Minimal release and health probe

Create an operator-run command using the existing official client packages and a few fixed read-only queries:

```text
npx tsx scripts/smoke-mcp.ts --url <target-mcp-url> --expected-schema 1.6.0 --expected-data-version <sha256> --output <report.json>
```

Require an explicit target; do not default to production. Permit local HTTP for test servers and HTTPS for remote targets. Do not accept or save authentication tokens for the public Fiscal.ge probe. Give each request a deadline and bound total requests, redirects and response sizes. Use normal legacy initialization and modern discovery; include pinned modern, automatic modern and legacy proof in the full release mode. Count connection/discovery requests in the budget.

For the release probe, compare the discovered inventory against the fixed expected names and successfully execute **all 14 tools at least once** through the pinned modern client. Use the same small representative scenario set for local and live runs, with the updated source/coverage expectations. Use the automatic modern and legacy clients for a smaller parity set covering a factual query and a source/error result; repeating every tool in every era is unnecessary. Include the city-source flow, corrected ranking unit and explicit stale-version refusal, counting overlapping scenarios once. Listing a tool is not proof that it executes successfully.

Verify returned evidence URLs against the trusted publication/archive inventory before optionally fetching a small sample. Record only status, timing, sizes, identities, per-tool checks and safe failure classifications; no full bodies, prompts, addresses or provider errors. Count requests through one wrapper passed to every client transport and any optional publication/archive fetch, including automatic discovery, initialization, notification, retry and teardown requests. Test the actual chosen clients' request count before setting the release run loose; the thirty-request ceiling below remains binding.

Exit nonzero on protocol failure, identity mismatch, malformed result, `isError` on a success case or failed expected assertion. Treat expected semantic refusals as checked behavior, not an outage. Stop on 429/503 and report retry information; do not keep probing to exhaust a quota. Default release execution is paced and sequential, with a fixed ceiling of 30 HTTP requests. Unit-test the limit and cleanup using local fixtures. If all compatibility cases cannot fit, split into explicitly reported runs rather than silently exceeding the ceiling.

For local built-server verification, preserve the baked `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` used by browser tests. Configure only the dedicated local server process with `MCP_ENABLED=true`, `MCP_RATE_LIMITER=memory`, `VERCEL_ENV=preview` and `VERCEL_URL=localhost:3100`. The existing nonproduction host allowlist then accepts the real localhost Host header. Confirm an expected discovery response before running the full probe. Do not change production settings or weaken `checkRequest`, and do not assume setting a Host header on native Node fetch will override its network host. Restore the local environment and stop the process after verification.

The probe is not a load test or a complete model acceptance test. It does not prove deployment SHA by itself: verify the provider deployment SHA separately and match its published release identities. Do not add a schedule or a new production secret to CI merely to run this command.

## 6. Alert and capacity decisions

Reuse existing fields, keeping synthetic test events separate from live service data. Proposed initial signals for a verified monitoring destination:

| Signal | Initial review rule | Response |
| --- | --- | --- |
| Unexpected internal tool failures | Any `internal_error` is investigable; three within five minutes raises an alert. | Inspect release identity and safe logs; use existing pause/rollback if warranted. |
| Unavailability | Two consecutive bounded probes fail, or repeated `service_unavailable`/HTTP 503 events. | Check pause state, limiter availability and monthly allowance. |
| Quota pressure | Review at 70% monthly commands; urgent review at 90%, or repeated 429 across ordinary activity. | Identify legitimate use versus refusal consumption; decide on mitigation or budget. |
| Latency | Repeated probe duration over 2 seconds or more than 2× its established comparable baseline. | Separate cold start, network, limiter and query cost before changing code. |
| Data lag | Official release observed but review target missed. | Record the source-readiness/revision reason and next action. |

These are proposed starting thresholds, not validated historical norms. Keep individual expected bad-input refusals out of outage alerts. Verify the destination, recipient role, delivery, deduplication and recovery notification with a labelled synthetic fixture or isolated test target; never trigger artificial faults or quota exhaustion in production.

Before activating anything external, prepare a concrete comparison of the existing option and any needed alternative: retention, privacy fields, monthly cost, setup/recovery owner and actual alert proof. If an existing authorized free mechanism can satisfy the target, reuse it. A new paid service, changed retention commitment or notification destination needs an explicit owner decision. Independent code/data work is not blocked by that decision, but operational completion remains open.

The documented free Upstash allowance is 500,000 commands/month. The current ordered limiter normally spends about twelve commands per accepted MCP request, giving roughly 41,000 admitted requests before refusals/other usage. Handshakes and discovery also consume allowance. Refusals have their existing 4/8/11-command paths. Verify the actual account plan and usage before applying this estimate operationally; [pricing](https://upstash.com/pricing/redis) and [command accounting](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs) can change.

Keep 60/minute/client, 1,000/day/client, 10,000/day global and fail-closed behavior. The daily maximum is not sustained monthly capacity. Shared connector addresses may represent many users; no address-identity redesign is justified without observed impact. An upstream abuse rule or atomic limiter redesign is a separate measured proposal, not an automatic part of this plan.

## 7. Acceptance and delivery evidence

- Original hashes, bilingual parity and existing preparation/revision guards pass; each family's actual new coverage and any historical revision are recorded.
- The reference fixture passes with historical numerical expectations intact and only separately reviewed, authorized coverage-metadata corrections. New source dates are not used to disguise changed historical values. An unresolved reference checkpoint leaves the refresh unready, even when the code-only fixes are ready.
- Snapshot, website values, downloads and MCP expose the same reviewed release; publications pass their inventory/hash checks.
- The probe rejects wrong identity and HTTP-200 tool failures, passes expected refusals, obeys its request/timeout bounds and records useful safe evidence.
- The runbook accurately distinguishes observed retention from targets. Actual plan/usage and external alert/retention verification are marked verified or outstanding, never inferred from absence of connector access.
- Once publishing is authorized, required CI and the Actions-owned release pass; provider READY/SHA, public identities and live probes are checked independently.

The implementation review reports three statuses separately: **code ready**, **data refresh ready**, and **operations verified**. A successful build is not proof of live freshness or alert delivery. Rollback follows the existing runbook and restores matching code/snapshot/publications; no automatic destructive data rollback is introduced.
