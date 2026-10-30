# MCP discovery, connection guidance and measured performance

**Date:** 17 October 2026. **Status:** Proposed design for review; implementation has not started.

**Purpose:** Help an assistant find a supported question quickly, recover from an oversized request, and explain a complete answer. Reduce repeated availability scans without changing any value or weakening evidence.

**Basis:** [Reviewed audit](../reviews/2026-10-17-mcp-full-audit.md), discovery, setup and performance findings. Small live requests were already fast. A full product catalogue was 469,421 bytes before final protocol metadata, and a separately measured 200-endpoint product query spent about 46 ms on availability versus 0.36 ms on arithmetic. These are diagnostic samples, not production-wide latency guarantees.

**Companions:** [answer integrity](2026-10-17-mcp-answer-integrity-design.md), [runtime reliability](2026-10-17-mcp-runtime-reliability-design.md), [freshness/operations](2026-10-17-mcp-freshness-operations-design.md), [implementation plan](../plans/2026-10-17-mcp-audit-remediation-implementation.md).

## 1. Scope and reuse

| Treatment | Owner |
| --- | --- |
| Reuse unchanged | Existing tools, substring/Georgian search recovery, output envelopes, bilingual evidence, supported query calculations, prefix-product index, snapshot/schema/description caches, static bulk files. |
| Small addition | `apps/web/lib/factQuery/describeCoverage.ts`, `inflationData.ts` and `inflationSeries.ts` produce truthful city-scoped discovery from the current city vocabulary/facts. |
| Small addition | `inflationProductData.ts` caches immutable catalogue and availability summaries by snapshot and actual calculation inputs. |
| Small addition | `apps/web/lib/mcp/instructions.ts` and descriptions in `tools.ts` put the short workflow first; `result.ts` and the route's full-wire guard give request-specific size recovery. |
| Small addition | Existing localization owners, `apps/web/lib/pages/connect.tsx`, `lib/i18n/messages/{ka,en}/connect.json`, and `public/llms.txt` only where current guidance changes. |
| Small addition | Extend `apps/web/scripts/measure-bilingual-mcp.ts` and existing measurement tests; reuse existing browser and transport tests. |
| Genuinely new | A small bilingual human-acceptance case file under `apps/web/tests/factQuery/fixtures/mcpAssistantIntents.ts`, separate from the unchanged numerical reference fixture. It is a review rubric, not a model-calling framework. |

No semantic-search service, embeddings, model calls in the product, new public tool, pagination contract, transport rewrite, UI redesign or removal of useful evidence is required.

## 2. Put the essential workflow first

Start server instructions with a self-contained paragraph no longer than 512 characters. It must cover discovery, returned IDs and supported measures, version consistency, units/missing values/caveats, original citations, targeted product queries and bulk files. Proposed opening:

> Use describe_coverage with short keywords before querying. Use returned IDs and supported measures; keep expectedDataVersion consistent. Preserve units, missing values, projections and caveats. Cite the returned original documents and Fiscal.ge. For product questions, search first and request only the required series and dates. Use the published files for bulk analysis.

The 512-character target follows [current Codex server-instruction guidance](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), checked on 17 October. It is not a claim that every client truncates at that boundary. Retain the detailed domain rules after the opening and update the schema description to the coordinated 1.6.0 contract.

Explain search recovery once in the shared guidance: use one meaningful keyword; if a phrase returns no matches, try the principal word or browse the named dataset. A failed phrase match is not proof that the data is absent. Reuse existing English/Georgian matching; do not add a guessed synonym catalogue or make the tool pretend to understand arbitrary natural-language questions.

Note (2026-10-29, MCP audit fixes): catalogue search now matches whole words and Georgian stems, and links website-only topics through the site's own All data search (`websitePages`). Both reuse the existing English/Georgian labels and the site search; no synonym or keyword catalogue was added. The instructions no longer carry a schema description either: the schema history moved to /connect, and the instructions are static text.

Keep descriptions specific about what a tool can answer and its supported filters. Do not repeatedly insert the full workflow into every description or remove descriptions merely to improve an unmeasured token estimate.

## 3. Make city discovery queryable

For `describe_coverage({ datasetId: "inflation", entityType: "city" })`, return:

- The six existing city entities, with their actual published coverage.
- Only `cpi.headline` and the twelve division series allowed by `CITY_SERIES_MEASURES`.
- Only their city-supported measures and city-derived periods/years: headline annual, monthly and twelve-month average; division annual and monthly.
- No national-only core series, target, price-index level, basket weight, contribution or 43 subgroups.

Reuse `CITY_SERIES_MEASURES`, already used by `queryInflation`, rather than maintaining a second supported-series list. Build coverage from city facts, not national series dates. Catalogue coverage is the union over matching cities, not a guarantee that every city/series has every month; preserve individual entity ranges and the query's explicit missing-cell behavior.

The returned dataset summary for this city-scoped call must agree with the scoped series and measures. Apply the same branch when a global search explicitly asks for `entityType: "city"`; only datasets supporting cities are eligible. Search and level filters still apply within that scope. An unfiltered or country-only inflation request preserves its existing national catalogue behavior. Other entity-type semantics are outside this correction.

Acceptance follows the discover → query → source workflow. For each advertised city series/measure, a query at a genuinely available period succeeds; earlier unavailable cells remain missing, not zero. The source step uses the separate city repair in the answer-integrity specification.

## 4. Give useful oversized-request recovery

Retain the same `result_too_large` code, retryable status, full refusal and bulk link. Add an optional local discriminator to the existing `tooLargeResponse` detail, for example:

```ts
kind?: "cells" | "sources" | "catalogue"
```

Default behavior remains the existing cell-query guidance. The message for source lists must say to request fewer source IDs, then relevant dataset/year/entity filters; warn that derived inputs may stay complete. A catalogue message must suggest a dataset, short search term or supported type/level filter. Do not describe either as “0 cells.” Ordinary observations/comparisons/rankings retain their meaningful count and narrowing guidance.

The same discriminator must reach both `boundedToolResult` and the final HTTP response-size guard. A payload can fit before the protocol envelope and exceed the limit afterwards; that failure must not revert to misleading generic text. Use the already known fixed tool name for the final guard, never arbitrary caller text.

Add reviewed message keys and parameter declarations in `data/localization/{ka,en}/service-messages.json` and `lib/factQuery/localization.ts`. Keep all messages bounded. Never omit citations or return a truncated success.

## 5. Cache availability, not answers

Extend `inflationProductData.ts`'s existing snapshot-keyed cache. Cache the product catalogue's immutable factual summaries and per-product availability by:

- Snapshot object identity, which changes when the release snapshot changes.
- Product ID and measure.
- Cumulative `startYear` when the measure depends on that base.

The returned query coverage remains the union of the requested products' **complete available history** for those calculation inputs. The requested output window must not redefine availability or remove earlier compounding inputs. Different cumulative start years must not share a summary unless their inputs genuinely match.

Do not cache arbitrary combinations of selected product IDs or complete responses. Avoid an unbounded cache keyed by caller-provided request strings. Only validated, supported products/measures/start years may populate entries. Keep cached maps/arrays internal; callers must not mutate a shared entry through a returned catalogue or response. No cache contents are serialized into the build snapshot.

Preserve missing annual cells, missing monthly inputs, late product starts, identity splits, null availability and exact Decimal calculations. The existing prefix-product arithmetic is already efficient and remains unchanged. Add broader catalogue-summary caching only if the existing measurement harness still shows a material repeated scan after this bounded change.

## 6. Performance proof and budgets

Use the existing `measure-bilingual-mcp.ts` harness. Record commit, data version, schema version, runtime, machine/load conditions, sample counts and whether the instance is fresh or warm. Compare before/after on the **same snapshot and machine**; a data refresh is a separate variable.

| Scenario | Evidence and review budget |
| --- | --- |
| One-cell national answer | Same output semantics and full wire size; investigate a repeated median regression above the larger of 25% or 2 ms locally. |
| Targeted product discovery | Fixed representative short searches, with full wire bytes; aim below 64 KiB for the selected narrow examples, without implying every search fits that budget. |
| City discovery | Only queryable city choices; measure bytes and warm query cost before/after. |
| 200 cumulative product endpoints | Separate arithmetic, availability, rendering, SDK validation and serialization where measurable; target at least a 2× improvement in warmed availability time. Report failure to achieve the target rather than claiming it. |
| 100-entry cumulative ranking | Exact values/order/evidence preserved; compare warm query and shaping cost. |
| Full product catalogue and near-limit responses | Record decoded wire size and complete refusal behavior. Hard cap remains 512 KiB; no promise that the full catalogue will always fit as content grows. |
| Fresh process and memory | Five fresh processes: report snapshot read/parse/index separately from the first representative query, its initial availability-cache fill and complete shaping. Then use at least 21 warm samples for focused scenarios. Record heap before/after warming and after exercising distinct supported product/base keys; repeated identical calls alone do not establish a bounded cache. |

These timing thresholds guide review, not fragile wall-clock assertions in shared CI. The existing cold sampler stops after reading/parsing/indexing; extend it before using it to judge the new availability cache. Identify each sample's phases explicitly, and do not add separately measured medians. Deterministic tests enforce output equality, isolation between snapshots/bases, missingness, no mutation and byte limits. Report sample medians/ranges and scope; do not promote small-sample p95 estimates into a service-level promise.

Separately measure the three limiter-call phases if operational evidence still indicates material latency. Preserve ordered charging, quotas, fail-closed behavior and timeout semantics. Replacing them with an atomic counter operation is **not** part of this implementation; it needs measured benefit and a separately reviewed design.

## 7. Finish the connection instructions

Preserve `DESIGN.md` §24: the address, connection steps, existing examples, coverage and technical details. Reuse the current copy controls and page composition.

For Claude, append the conversation-enabling step after connector creation: open the conversation's `+` menu, select Connectors and enable Fiscal.ge. This follows the [official remote-connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), checked on 17 October. Recheck the guide before editing. Keep account/workspace eligibility wording cautious and distinct from Fiscal.ge's public no-sign-in requirement.

After setup, direct the reader to the existing latest-inflation example and ask for the original source and any limitations. Reuse the example's data-derived period; do not hardcode September or another month into product copy. Provide equivalent reviewed Georgian and English guidance. Do not advertise authenticated application proof based only on SDK tests.

Update current schema details and narrowly affected `llms.txt` guidance. Do not rewrite the page's layout or promote implementation details into its main user flow.

## 8. Assistant acceptance, separate from unit tests

Maintain eleven intent pairs in English and Georgian. Store prompts, required behavior and evidence fields, not guessed fixed answers. Preserve the existing 48 reference intents and their historical numerical expectations; the two release-sensitive coverage endpoints follow the explicit review checkpoint in the freshness specification.

| Intent pair | Required behavior |
| --- | --- |
| Latest national inflation | Recovers from an empty phrase search such as `annual inflation` with a short keyword, discovers the actual latest reviewed month, and answers with correct percent unit and original source. |
| City inflation and its source | Discovers a city-supported series, queries it and obtains the shared original with the city filter. |
| City subgroup request | Explains that the national subgroup is not published by city; offers a supported division without inventing data. |
| Spending-share change ranking | Reports percentage points and the correct period pair. |
| Georgia combined municipal total | Explains combined scope and preserves the complete underlying source chain. |
| Adjara combined total | Explains the net adjustment without applying it twice and cites same-year transfer evidence. |
| Khulo 2024 total and education | Discloses that the total uses a functional-total substitute because the source actual total is missing; does not attach that total-only warning to the separately reviewed education figure. |
| Cumulative product change | Searches a product, fixes the start year/base, preserves identity/history caveats and cites monthly inputs. |
| Missing or early product period | Reports missing data and the reason, never zero or an invented continuous history. |
| Broad source/catalogue request | Recovers through relevant smaller requests or static files when the limit is reached. |
| Dataset outside approved MCP scope | States the limitation and uses the documented website/static alternative without inventing a tool. |

Include a scripted stale-data-version recovery check in transport tests. For model-based acceptance, the assistant must rediscover after that error if it occurs rather than combine releases.

Use an available, authorized real client. Record application/version, model if visible, date, language, actual selected tools, factual/unit/citation/caveat outcomes and failures. Do not store personal questions, credentials or private account details. Run in bounded groups respecting rate limits. A local SDK call is protocol proof; a stored-argument test is numerical proof; neither counts as a real assistant completing these prompts.

Every executed pair must pass its factual, unit, missingness and evidence requirements before claiming assistant acceptance. If account access or authorized model use is unavailable, retain this checklist explicitly unverified; independent code work can still complete.

## 9. Completion boundary

Completion requires queryable discovery, useful size recovery, preserved numerical/source semantics, measured before/after results and bilingual browser checks. Any performance target or real-client proof not achieved must remain visible in the implementation review. No projected score increase is promised in advance.
