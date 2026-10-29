# F12 — Four small items (code leaks in sentences, `retryable` on result_too_large, unrounded values, usage counters)

Evaluated against the production build of aa2bb120 at http://localhost:3100/mcp. Scratch scripts and raw responses: `/tmp/claude-0/audit/eval-F12-small-items/` (`scan.mjs`, `scan.json`, `analyze2.mjs`, `hits2.txt`, `big.mjs`).

Summary table

| Item | Verdict | Impact | Effort |
|---|---|---|---|
| (a) Codes inside human sentences | CONFIRMED, and broader than reported (all `rank` calls, not only Khulo) | Medium | S |
| (b) `retryable: true` on result_too_large | PARTLY CONFIRMED (a deliberate, recorded decision that contradicts the codebase's own definition; small practical effect) | Low | S |
| (c) Unrounded values | NOT CONFIRMED as a defect (full precision is deliberate and matches the source; rounding is already in the instructions). One small gap remains: the instructions do not give the site's rounding rules | Low | S |
| (d) Operators cannot see usage | PARTLY CONFIRMED. The gap is already recorded and open in `docs/deployment.md`. What is new is a $0 design that reuses Upstash for the "90 days of aggregates" half of the target | Medium | S–M |

---

## (a) Internal codes inside Ka/En human-readable sentences

### 1. Verdict
CONFIRMED, and wider than the audit said. A scan of 41 successful responses from all 14 tools (every sentence-like string in `structuredContent`) found raw codes in exactly three templated sentence families. (1) Every municipal **amount_gel total for a single municipality** has `valueDefinition`/`valueDefinitionEn` ending in a raw measure code, not only Khulo 2024. (2) **Every `rank` response** has `rankingDefinition`/`rankingDefinitionEn` with raw measure and metric enums. (3) Filtered rankings put raw ids in `universe.description`/`descriptionEn`. Caveat messages, missing reasons, notices and source titles are clean. Error messages repeat the caller's own ids, which is correct. `describe_coverage` measureNotes mention `(municipal.total)` on purpose, as a calling hint.

### 2. Evidence
Measured responses (`scan.json`):
- `query_municipal {entityIds:["11","04",...], seriesIds:["municipal.total"], years:[2015,2023,2024,2025], measure:"amount_gel"}` returns `valueDefinitionEn` set to "The municipality's public total, measured on the following basis: total_payments." The 2015 rows end "…: portal_functional_total_fallback." Khulo 2024 ends "…: functional_total_fallback_missing_payment_actual." The Georgian text is identical in form ("…გაზომვის საფუძველი: total_payments."). The same sentences appear in the text legend and in `compare` (`from`/`to.valueDefinition*`).
- Snapshot population: `municipal.totalFacts` holds 639 `total_payments`, 64 `portal_functional_total_fallback` and 1 `functional_total_fallback_missing_payment_actual`. So **all 704 municipality-level total cells** carry a code in their definition sentence. Regions, the country, shares and per-resident values use other keys and are clean.
- `rank … measure:"gel_per_resident", metric:"value"` returns "Ranked by gel_per_resident in 2025, descending." and "დალაგება მაჩვენებლით gel_per_resident, 2025 წელი, კლებადობით." Change rankings return "Ranked by percentage_change (amount_gel), 2023→2024, descending." and "…percentage_point_change (share_of_total_pct)…". These are also the first two lines of the text rendering.
- `rank withinRegionId:"region.adjara"` returns "Member municipalities of region region.adjara; …". `rank level:"subgroup", parentSeriesId:"cpi.cat.01"` returns "COICOP subgroups within cpi.cat.01.". Ministries `programmesWithinParent` uses the same pattern (`{parentId}`).

Code locations:
- `apps/web/lib/factQuery/queryMunicipal.ts:293-310`: `totalValueDefinition` passes `publicTotalMeasure` straight into `{measure}`.
- `apps/web/lib/factQuery/rank.ts:532-543`: `rankingDefinitionFor` passes `input.measure`/`input.metric`. Only `order` is localized.
- `apps/web/lib/factQuery/rank.ts:258-259, 285-286, 299-301`: `universeValues = { regionId | parentId }` holds raw ids.
- Templates: `data/localization/en/service-messages.json:29,32,33,94,173,179,182,183` (and the same lines in `ka/`). `SERVICE_MESSAGE_PARAMETERS` is in `apps/web/lib/factQuery/localization.ts:175+`.
- Contradiction: `apps/web/lib/mcp/instructions.ts:240-256` tells the model that ids, codes and measure names such as `amount_gel` and `gel_per_resident` must never appear in an answer, "not even in parentheses". The server's own reader-facing sentences contain exactly those tokens.

### 3. Real-world impact
- The highest-risk case is the sentence a model quotes to explain *what a number means*. Khulo 2024 and every 2015 municipal total are exactly the cells whose definition changed. The code there carries the meaning, and the reader gets `functional_total_fallback_missing_payment_actual` in its place. The severe caveat `municipal_source_actual_missing` does explain it in words, which limits the damage.
- Every rank answer: a model that paraphrases "Ranked by percentage_point_change (share_of_total_pct)" has to translate the enum on its own. Georgian users get a Georgian sentence with English snake_case inside.
- Frequency: 100% of `rank` calls, and every single-municipality amount query. The 16-question fresh-assistant run (`evidence/answers.md`) did not leak codes into answers: a strong model obeyed the instruction and filtered them. The cost falls on weaker models and on clients that show the definition text directly. The audit understated the scope (it said "Khulo") and slightly overstated the severity (a strong model copes).

### 4. Root cause
The templates were written with a `{measure}` parameter, and the call sites fill it with the stable id because no localized label set exists for measures, metrics or municipal total measures. `labels.json` (5,887 entries) has no measure labels. Ids for regions and parents are passed even though the snapshot already carries their reviewed labels.

### 5. Recommended fix
- Add bilingual service-message keys under the existing `SERVICE_MESSAGE_KEYS` mechanism (`localization.ts`, both `service-messages.json` files):
  - `measures.<id>` for the 13 query measures, for example `share_of_total_pct` → "share of the total" / "წილი ჯამში".
  - `metrics.<id>` for the 4 metrics.
  - `municipalTotalMeasures.<id>` for the 3 municipal total measures, for example `total_payments` → "official total payments" and `functional_total_fallback_missing_payment_actual` → "sum of functional spending, used because the payments actual is not published".
- In `rank.ts:532-543`, pass `serviceMessage(…, "measures."+input.measure)` and the metric label, as `order` already does.
- In `rank.ts` universe, pass the region or parent **label** (`entityLabelKa/En` / `seriesLabelKa/En` lookups already used for entries) in place of the id.
- In `queryMunicipal.ts:308`, pass the localized municipal-measure label.
- Unchanged: `valueDefinitionId` (e.g. `municipal:amount_gel:total:total_payments`), `measure`, ids, caveats and all values. Machine-readable identity stays in the `*Id` fields, so clients that parse ids are unaffected. Only free text changes.
- Risk: the definition text changes, so `valueDefinition` legend entries change wording but not their ids. The `i18n:check` parity and the `SERVICE_MESSAGE_PARAMETERS` checks guard both languages. The Georgian wording needs owner review.

### 6. Effort
S: about 20 key pairs and three call sites, one test per family, and a paragraph in `docs/data-methodology/ai-grounding-and-caveats.md`.

### 7. How to verify
- A unit test that walks all sentence strings (any value containing whitespace, excluding `*Id`/`*Ids` keys and echoed error ids) in a response matrix covering every tool. It asserts no `/\b[a-z0-9]+(_[a-z0-9]+)+\b/` and no dotted id token. The scan in `analyze2.mjs` is the prototype: today it reports 13 path/token groups, and after the fix it should report 0, apart from the intentional measureNotes hint.
- Run `npx vitest run tests/factQuery/reference.test.ts`. It must still pass unchanged, because values and ids do not move.

### 8. Rating
Impact **Medium**, Effort **S**. Plain English: some explanation sentences the service sends to AI assistants contain internal computer codes in place of words, so add proper Georgian and English wording for those few terms.

---

## (b) `result_too_large` says `retryable: true`

### 1. Verdict
PARTLY CONFIRMED. The flag is true, and resending the identical request fails identically. The value was chosen on purpose and recorded twice: plan `docs/superpowers/plans/2026-09-02-fiscal-query-core-part-3-runtime.md:430` and the discovery spec `docs/superpowers/specs/2026-10-17-mcp-discovery-performance-design.md:54`, which says "Retain the same result_too_large code, retryable status". Tests pin it: `apps/web/tests/mcp/result.test.ts:41,230`. However, the code base's own definition elsewhere says the opposite (`apps/web/lib/factQuery/describeCoverage.ts:806-812`): "Retrying the identical request will fail identically; the client must change the request first, so this is not 'retryable' in the transient sense rate_limited/service_unavailable use." By that definition, result_too_large is the one case that breaks the rule. Every other "change your request" error (`invalid_parameters`, `unknown_*`, `year_out_of_range`, and even `data_version_changed`) is `false`. Only `internal_error` (`result.ts:341`) and `result_too_large` (`result.ts:365`) are `true`.

### 2. Evidence
- `big.mjs`: `query_municipal` with all 64 municipalities × 11 years of `municipal.total` was sent twice. Both times the reply was HTTP 200, 1,176 bytes, `isError: true`, with the text `error result_too_large (retryable: true)` and "Result too large: 704 cells. Narrow the request and ask again…". The second send took 11 ms and gave the same refusal.
- The flag exists **only as a word in the text block**. Errors carry no `structuredContent` (`apps/web/lib/mcp/result.ts:321-330`), and rate-limit/503 refusals are JSON-RPC errors with `retry-after` and no `retryable` field (`apps/web/app/mcp/route.ts:43-52,117-133`). So no program parses it. Only the LLM reads it.
- MCP spec (2025-11-25 Tools, "Error Handling"): there is no retryable field. Tool execution errors "contain actionable feedback that language models can use to self-correct and retry with adjusted parameters" (https://modelcontextprotocol.io/specification/2025-11-25/server/tools). The TS SDK guide likewise says to put the recovery hint in the text (https://ts.sdk.modelcontextprotocol.io/v2/servers/errors.md). In that loose spec sense, "retry after adjusting" fits *every* isError result, which is why the in-repo meaning (transient: same request may succeed later) is the one that matters.
- `apps/web/lib/mcp/instructions.ts:286-290` mentions the "retryable flag" without defining it, then says "result_too_large means narrow the request".

### 3. Real-world impact
Small. The same text says "Narrow the request and ask again", and the instructions say the same, so a capable model narrows. The failure mode is a generic agent wrapper or a weak model that treats `retryable: true` as "resend". Each wasted resend is cheap (≈1.2 KB, 11–64 ms) but costs about 12 Upstash commands and one of the caller's 60/minute. No repeat-retry was observed in the 16-question run. The audit is right that the signal contradicts itself, but the harm is low.

### 4. Root cause
"Retryable" was never defined in the error contract (`docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` §7.4 only says "a retryable flag"). The plan author used "can succeed if retried differently". The later describeCoverage author used "transient", and both meanings shipped.

### 5. Recommended fix
Set `retryable: false` in `tooLargeResponse` (`apps/web/lib/mcp/result.ts:347-368`). Update the two test assertions. Define the flag in one sentence in the instructions ERRORS paragraph and in spec §7.4: "retryable: true means the same request may succeed later without changes (internal_error); every other error needs a changed request." The message text, code and bulk link stay unchanged. This reverses a recorded decision, so it needs owner sign-off, which is the reason it is not a "just fix it". Compatibility: no client parses the field, so nothing breaks. If the owner prefers to keep it, the alternative is to keep `true` and define it in the instructions as "retry *after narrowing*". That is acceptable but leaves the asymmetry with `invalid_parameters`.

### 6. Effort
S: a one-line code change, two test lines, one instructions sentence and one spec sentence.

### 7. How to verify
`npx vitest run tests/mcp/result.test.ts tests/mcp/toolFailure.test.ts`. A live check: the oversized query above shows `(retryable: false)`, and the internal-error fixture still shows `true`.

### 8. Rating
Impact **Low**, Effort **S**. Plain English: when a question asks for too much data, the error tells the AI it may "try again" even though only a smaller question will work, so mark it as not retryable and say what the flag means.

---

## (c) Values arrive unrounded

### 1. Verdict
NOT CONFIRMED as a defect. Full precision is a recorded requirement. The core spec says "Preserve reviewed precision" (`docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md:222`) and "Order full-precision values before formatting" (`:330`). The products spec says "Preserve decimal/source precision and compare before display rounding" (`2026-10-01-mcp-inflation-products-design.md:27`). The served numbers equal the source and the published files byte for byte:
- `27066204097.3435` is the World Bank API value verbatim (`apps/web/public/downloads/methodology/gdp/files/ny.gdp.mktp.kd.json`, `data/imports/gdp-overview-annual.csv:252`).
- `8.788238718532389` is the value in `apps/web/public/downloads/data/regional-economies.json:149930`.
Rounding is already delegated to the model by `apps/web/lib/mcp/instructions.ts:255-256`: "Round money and percentages the way a reader reads them. A per-resident figure of 4373.278503508772 is a float, not a number anyone would write." The 16-question run rounded correctly every time: "about 4,396 GEL" for 4395.6423, "34.4% (34.35%)", "GEL 3.05 billion".

### 2. Evidence
- Text and structured representations carry the same full value (`renderText`, `apps/web/lib/mcp/result.ts:297+`). Example: rank text row `1 ონი Oni … 4395.642297654735 GEL_per_resident`.
- The byte cost of precision is negligible. A value is about 17 characters, versus about 6 rounded, in responses of 7–35 KB that are dominated by source and definition evidence.

### 3. Real-world impact
Low. One real, minor gap: the instructions say "round the way a reader reads", but they do not state the site's own rules (`DESIGN.md:939,944`: percentages 1 decimal, inflation 1 decimal, interest rates 2, standalone amounts 3 significant digits in მლნ/მლრდ ₾, halves away from zero). So an assistant may say "5.57%" for September inflation while fiscal.ge shows 5.6%. A display-rounded companion field would not help enough to justify itself. It would add bytes to every cell in two representations, invite models to compute from rounded numbers, and bring locale formatting decisions into the API.

### 4. Root cause
This is a design choice, not a bug. The only gap is that the rounding guidance does not reuse the DESIGN.md display rules.

### 5. Recommended fix (optional)
Replace the one generic line at `instructions.ts:255-256` with three lines taken from `DESIGN.md:939/944`: compute with the full values; present percentages and inflation to 1 decimal and interest rates to 2; present amounts at 3 significant digits in million/billion GEL. Data, structured output and reproducibility stay unchanged.

### 6. Effort
S: instructions text and a snapshot test of the instructions.

### 7. How to verify
The existing instructions tests, plus a re-run of the fresh-assistant set, checking that quoted figures match the site's displayed figures.

### 8. Rating
Impact **Low**, Effort **S**. Plain English: the service deliberately sends exact source numbers and already tells assistants to round them, so the only improvement is to tell them to round the same way the website does.

---

## (d) Operators cannot see usage

### 1. Verdict
PARTLY CONFIRMED. The problem is real but **already recorded and open**. `docs/deployment.md` ("Logs and privacy" and "Proposed monitoring arrangement — owner decision pending") states the operating target of **14 days of detailed events and 90 days of aggregates**. It records the observed Hobby **one-hour** retention and leaves operations "outstanding". It proposes Vercel Pro ($20+/month) plus a Better Stack drain, pending an owner decision. The earlier audit (`docs/superpowers/reviews/2026-10-17-mcp-full-audit.md:96-110`) and `docs/superpowers/specs/2026-10-17-mcp-freshness-operations-design.md` §4/§6 cover it too, and §6 says: "If an existing authorized free mechanism can satisfy the target, reuse it." Not new: the retention gap, the alerts and the Pro/Better Stack option. **New:** none of those documents considers using the already-authorized Upstash store for the aggregate half of the target. That costs $0, adds no vendor, keeps runtime networking "limited to Upstash", and needs no plan change.

### 2. Evidence
- `apps/web/lib/mcp/log.ts:44-61` writes one allowlisted JSON line to stdout per request (`apps/web/app/mcp/route.ts:210-238`). Nothing aggregates it.
- The only durable counts are the limiter keys. `mcp:daily:<date>` (`route.ts:337`) is a single accepted-request integer that **expires one day after the first hit** (`DAY_SECONDS`), so even yesterday's total is gone.
- Protocol era is not recorded anywhere (`ToolCallLog` has no era field).
- Upstash billing (https://upstash.com/docs/redis/overall/billing): EVAL is billed as 1, plus 1 per `redis.call`; each pipeline command is billed individually. The free tier has 500K commands/month and 250 MB. The current cost is 12 commands per accepted request (`docs/deployment.md`, "Shared production rate limiter"), so about 41,600 accepted requests/month.

### 3. Real-world impact
The owner cannot answer "how many questions did the MCP get last week, which tools, how many errors, and are legacy-era clients still using it". That blocks the capacity, budget and deprecation decisions the runbook itself asks for ("Review usage before changing the free plan"). It does not affect users or answer accuracy. Impact is medium for operations and zero for data correctness.

### 4. Root cause
Logging was designed for a log destination that was never provisioned. Hobby keeps logs for one hour, and the only shared state (Upstash) is used only for limits.

### 5. Recommended fix: cheapest privacy-preserving daily counters
- **What:** one Redis hash per UTC day, `${namespace}:mcp:stats:YYYY-MM-DD`, with expiry 100 days (covering the 90-day aggregate target). Each request increments **one joint field** `tool|outcome|errorCode|era|slow`:
  - `tool`: the existing bounded label from `toolNameOf` (14 tools plus fixed protocol-method and `unknown_*` labels).
  - `outcome`/`errorCode`: exactly the values `handle()` already computes for `logToolCall`, bounded by `LOG_ERROR_CODES`.
  - `era`: `2026-07-28`, `2025-11-25` or `other`/`none`, from an allowlist, never the raw header.
  - `slow`: `1` if durationMs > 2000, matching the runbook's proposed latency signal.
  One joint field gives every per-tool, per-error and per-era breakdown by summing, at the price of a single increment.
- **How (reuse):** add `record(day, field)` to the existing `Counter` type and `upstashCounter()` (`apps/web/lib/mcp/upstashCounter.ts`). Use the same fetch, timeout and fail-silent handling, with a 4-line Lua script: `local n = redis.call('HINCRBY', KEYS[1], ARGV[1], 1) if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end`. `memoryCounter()` gets a no-op or in-memory version for tests. Call it from `handle()` next to `logToolCall`, inside `after()` from `next/server` (supported in Route Handlers per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), so it adds no latency. A failed record is dropped silently and must never fail the request; this is unlike the limiter, which fails closed.
- **Scope:** count requests that passed the two per-key limits (that is, admitted requests plus global-daily refusals). Do **not** count per-key 429s. That keeps an attacker from spending more of the shared allowance through the stats path, and `rate_limited` volume is already visible in the 1-hour logs.
- **Command cost:** EVAL + HINCRBY = **2 commands** per counted request (3 for the first appearance of a field each day, a few hundred times a day at most). That moves 12 to 14 per accepted request, so free-tier capacity goes from ~41,600 to ~35,700 accepted requests/month (−14%), before refusals. A cheaper variant at +1 folds the HINCRBY into the existing global-daily EVAL (`route.ts:337`), but that runs before the outcome is known and so loses outcome/errorCode. It is not recommended.
- **Storage:** under 1,000 fields/day × about 60 B × 100 days, roughly 1–6 MB of the 250 MB.
- **Privacy:** no client key or hash, no IP, no ids, years or arguments. Daily granularity only, and every component comes from a fixed allowlist. This is strictly less than the already-approved log allowlist (`log.ts:5-12`).
- **Reading:** `HGETALL` per day from the Upstash console, or a small read-only operator script using `KV_REST_API_READ_ONLY_TOKEN` (the integration's read-only token; confirm it is present). A read costs 1 command per day.
- **Unchanged:** the limiter logic, fail-closed behaviour, the stdout logs, the no-vendor/no-drain posture and the free plan.
- **Not covered:** the 14-day *detailed* events and alert delivery. Those stay as the documented pending owner decision. This design closes only the "90 days of aggregates" half and gives the usage numbers that decision needs.
- **Docs:** update the deployment.md Upstash cost paragraph (12 becomes 14) and the "Logs and privacy" section in the same change.

### 6. Effort
S–M (about 1 day):
- `record()` plus the Lua script and unit tests for the field allowlist and fail-silent behaviour.
- The `after()` call in `handle()` with an era allowlist.
- An operator read script.
- deployment.md updates.
- A preview-deployment check against the preview namespace.

### 7. How to verify
- Unit tests: the field is always built from allowlisted parts (fuzz caller-supplied tool names and `mcp-protocol-version` values, which must map to fixed labels); a recorder throw or a 1.5 s timeout does not change the response; per-key refusals do not record.
- On a preview deployment, send N known calls (ok, invalid_parameters, result_too_large, legacy era) and confirm `HGETALL` matches exactly. Confirm the TTL is about 100 days, and measure Upstash command use per request (expect +2).
- Check the existing route tests and the `npx vitest run tests/factQuery/reference.test.ts` fixture (no query change).

### 8. Rating
Impact **Medium**, Effort **S–M**. Plain English: the owner cannot see how much the AI service is used because the free hosting keeps logs for only an hour, so keep a tiny anonymous daily tally (which tool, success or error, which client version) in the storage the service already uses, at no extra cost.
