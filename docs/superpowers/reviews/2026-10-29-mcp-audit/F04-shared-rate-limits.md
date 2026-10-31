# F04 — Shared rate-limit buckets for hosted assistants, and the Upstash monthly quota

Evaluated 2026-10-29 against commit aa2bb120 (the live commit). The code was read only. One local limiter test was run against http://localhost:3100/mcp, using that server's in-memory 60-per-minute counter.

## 1. Verdict: PARTLY CONFIRMED (the mechanism is real and now backed by the providers' own docs; the impact has not happened yet; most of it was already documented)

The finding's mechanism holds. The per-client key is a hash of the source address and nothing else. Every Claude.ai custom-connector call comes from Anthropic's one published outbound range, `160.79.104.0/21`, so all Claude.ai users of fiscal.ge draw on the buckets of however few addresses Anthropic actually uses. Fiscal.ge's own /connect page sends people to exactly this route as its first recommendation.

Two parts of the finding are overstated:

- **It is not new.** `docs/deployment.md:539-540` already says that callers behind one connector's outbound addresses share the 1,000/day cap. The 2026-10-17 audit and the freshness spec (`docs/superpowers/specs/2026-10-17-mcp-freshness-operations-design.md:120`) record an explicit decision: "no address-identity redesign is justified without observed impact." The Upstash cost (12 commands per request, about 41,000 accepted requests a month) is also documented, at `docs/deployment.md:554-566`.
- **There is no observed impact.** A production runtime-log query over the last 55 minutes returned no log groups at all. No firewall configuration exists for the project (the API returned 404).

What is new and actionable:

1. **The precondition in the decision cannot currently be measured.** The application log records the same `rate_limited` code for all three limits, and it has no field that says which kind of client was refused. Vercel Hobby keeps logs for one hour. Nobody can therefore tell whether "observed impact" has occurred.
2. **Provider facts the earlier work did not have.** OpenAI documents a per-user field, `_meta["openai/subject"]`, sent "for the purposes of rate limiting". Anthropic sends no per-user identity on no-sign-in connectors.
3. **A griefing path.** One heavy or hostile Claude.ai user can spend a shared address's 1,000-a-day allowance in about 17 minutes. That blocks every Claude.ai user who comes out of the same address until 00:00 UTC.

## 2. Evidence

### Code

- `apps/web/lib/mcp/security.ts:114-118`: `clientKey` is `sha256(x-vercel-forwarded-for ?? x-real-ip)`, cut to 32 hex characters. Nothing else feeds the key: not the body, `_meta`, `clientInfo` or the user agent.
- `apps/web/app/mcp/route.ts:322-339`: three checks run in order.
  1. `mcp:rate:<key>`: 60 in a rolling 60 seconds (`limits.ts:11`).
  2. `mcp:keyday:<key>:<UTC date>`: 1,000 (`limits.ts:17`).
  3. `mcp:daily:<UTC date>`: 10,000 (`route.ts:40`).

  An unkeyed request falls into one shared `unkeyed` bucket. Every verdict of "unavailable" refuses the request with 503, so the design fails closed.
- `route.ts:143-152` and `route.ts:225-235`: the per-key daily refusal and the global daily refusal both return `error.data.code = "rate_limited"`, the same code as the per-minute refusal. The log (`lib/mcp/log.ts:44-58`) carries no client class and no indication of which limit fired. Logs alone cannot separate "Claude.ai's shared address hit its day cap" from "someone hit the minute cap".
- `lib/mcp/upstashCounter.ts:9-25`: one `EVAL` per check. Upstash bills an EVAL as 1 command plus 1 for each `redis.call` ([Upstash billing](https://upstash.com/docs/redis/overall/billing.md)). Recomputed costs:

  | Check | Commands |
  |---|---|
  | Rolling minute | EVAL + TIME + ZREMRANGEBYSCORE + ZCARD + ZADD + EXPIRE = 6 |
  | Each fixed daily key | EVAL + GET + INCR = 3 (4 on the day's first hit) |
  | Accepted request | 12 |
  | Minute refusal | 4 |
  | Per-key daily refusal | 8 |
  | Global daily refusal | 11 |

  These match `docs/deployment.md:555-561` exactly, so the 17 Oct figure is correct. Upstash's free tier is still 500K commands a month; pay-as-you-go is $0.20 per 100K ([Upstash pricing](https://upstash.com/pricing/redis.md)).

### Local reproduction

Script: `/tmp/claude-0/audit/eval-F04-shared-rate-limits/bucket.mjs`. Output: `/tmp/claude-0/audit/eval-F04-shared-rate-limits/bucket.out.json`.

- **61 `tools/call` requests from one address.** All used the same `x-vercel-forwarded-for`, with `_meta["openai/subject"]` alternating between `v1/user-A` and `v1/user-B` (two simulated ChatGPT users behind one egress address). Result: 60 × HTTP 200, then 1 × HTTP 429 `rate_limited` with `retry-after: 60` on call 61. The two "users" drew on one bucket.
- **A different address straight afterwards:** HTTP 200, so buckets are separate per address.
- **The same address with a different `user-agent` (`openai-mcp/1.0.0`) and a different `x-real-ip`:** HTTP 429. `x-vercel-forwarded-for` wins, and the user agent is ignored.

### Production (read-only, through Vercel MCP)

- `get_runtime_logs` for production, the last 55 minutes, grouped by path: **no groups at all**. That means no recent `/mcp` traffic, or none that produced a log.
- `get_firewall_config(active)`: **404, "config not found"**. No WAF rules exist.

### Provider documentation

- **Anthropic.** The [IP address reference](https://platform.claude.com/docs/en/api/ip-addresses) lists one outbound IPv4 range, `160.79.104.0/21` (2,048 addresses), "for example, when making MCP tool calls to external servers", and says it "will not change without notice".
  - [Test your connector](https://claude.com/docs/connectors/building/testing) says "Claude reaches your server from Anthropic's infrastructure". It also says `clientInfo.name` varies ("claude-ai", "Anthropic", "claude-code"), is "unauthenticated", and is for "telemetry and coarse feature detection only".
  - [Troubleshooting](https://claude.com/docs/connectors/building/troubleshooting.md) names "a rate limiter in front of your server" returning 429 as a known failure, and advises allowlisting the published range. Connectors are IPv4-only.
  - [Custom connectors](https://claude.com/docs/connectors/custom) shows that a no-sign-in connector sends no per-user credential. Request headers are a fixed, per-connector value, limited to an approved list and in beta.
  - **Conclusion: no per-user identity exists that a public, no-sign-in server could use.**
- **OpenAI.** The [IP egress ranges guide](https://developers.openai.com/api/docs/guides/ip-addresses.md) publishes `openai.com/chatgpt-connectors.json` (plugins, connectors, GPT Actions) and `chatgpt-agents.json` (Codex cloud). It says "the ranges can change", and an OpenAI representative called them "best effort" ([community thread, July 2026](https://community.openai.com/t/bug-unpublished-ip-addresses/1385835)). Observed MCP traffic came from `/28` blocks with the user agent `openai-mcp/1.0.0`.
  - The [Apps SDK reference](https://developers.openai.com/plugins/reference) documents `_meta["openai/subject"]` on tool calls: "Anonymized user id sent to MCP servers for the purposes of rate limiting and identification". It also documents `openai/session`, a per-conversation id.
  - Not verified: whether ChatGPT developer-mode custom connectors send it. The JSON files could not be downloaded from this machine (the proxy refused the connection), so the prefixes were not counted.
- **Vercel.** The [request headers reference](https://vercel.com/docs/headers/request-headers.md) says `x-forwarded-for` is "the public IP address of the client", and that Vercel overwrites it and does "not forward external IPs" (custom XFF needs an Enterprise trusted proxy). `x-vercel-forwarded-for` is identical, and `x-real-ip` is identical.
  - So the key really is the TCP peer address that Vercel sees, which for a hosted assistant is the provider's NAT egress address.
  - [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) is available on Hobby: 1 rule, keyed by IP or JA4, fixed window from 10 seconds to 10 minutes, 1,000,000 allowed requests included. [Requests the WAF mitigates are free](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing) and never reach the function, so they never spend Upstash commands.

## 3. Real-world impact

Who is affected:

- **Claude.ai web, desktop and mobile users** on the custom connector (the first recommendation on /connect, `lib/i18n/messages/en/connect.json:17-20`).
- **ChatGPT developer-mode and Codex cloud users**, through OpenAI's ranges.

Local clients are not affected, because they connect from each user's own address: Claude Code, the Codex CLI and app as /connect configures them, Cursor and VS Code.

Requests per question:

- The fresh-assistant run used 29 tool calls for 16 questions, about 1.8 per question.
- Real stateless clients add initialize, notifications/initialized and tools/list per conversation, and each counts.
- So a one-question conversation is about 5 requests, and a three-question one is about 2.8 per question.

Capacity scenarios, all requests counted:

| Scenario | Binding limit | Daily capacity |
|---|---|---|
| Claude.ai leaves through 1 address to fiscal.ge | per-key 1,000/day; 60/min | about 200 one-question chats (up to about 360 questions); about 12 new chats per minute at peak |
| Claude.ai spread over 2 or more addresses | Upstash free quota | about 1,389 accepted requests a day averaged over a month (500,000 / 12 / 30), about 280-500 questions a day **site-wide, every client combined** |
| Any mix, burst day | global 10,000/day | about 2,000-3,500 questions in one day, but that spends 24% of the month's Upstash quota |
| Griefing: one user loops tool calls through Claude.ai | per-key day cap | 1,000 requests at 60 a minute takes about 17 minutes and 12,000 commands (2.4% of the monthly quota), then blocks every Claude.ai user on that address until 00:00 UTC (04:00 Tbilisi) |
| Retries after the day cap is exhausted | Upstash quota | each refused retry still costs 8 commands. One address at 60 a minute spends the 500K quota in about 17 hours, and then **everyone** gets 503 until the month resets |

What the audit got right, overstated and understated:

- **Overstated:** "1,000/day for all users of one assistant" is only true if the provider uses one egress address for fiscal.ge. Anthropic's range has 2,048 addresses and OpenAI's has many `/28` blocks, and how traffic is spread across them is unknown. Once traffic spreads, the Upstash monthly quota, not the per-key cap, is the real ceiling, and that ceiling applies to every client equally. The two numbers are close (1,000 vs about 1,389 a day), so the per-key cap is rarely the only constraint.
- **Understated:** the griefing path, and the fact that the documented decision ("wait for observed impact") cannot be acted on because the logs cannot show it.
- **Today's real impact: none observed.** The traffic is too low to see.

## 4. Root cause

The service has no authentication by design, and its only trusted caller identity is the network address. Hosted assistants deliberately concentrate many users behind a few provider-owned addresses. The limiter treats an address as one client and applies a per-person-sized allowance (60 a minute, 1,000 a day) to what may be a whole provider's user base.

A second gap, in observability: refusals are logged with one shared code and no client class. Combined with one-hour log retention, nobody can detect when this starts to matter.

## 5. Recommended fix (measure first; change identity only if the data shows it)

### Stage 0: zero code, $0, measurement available today

The keys in Upstash are the unsalted SHA-256 of the IPv4 string, truncated. The owner, or an agent with Upstash console access, can:

1. Hash all 2,048 addresses in `160.79.104.0/21`, and optionally OpenAI's published prefixes.
2. Match them against the live `production:mcp:keyday:*:<date>` keys in the Upstash data browser.
3. Read their counts.

This answers "how many Anthropic addresses reach us, and how close is each to 1,000?" without touching code. It is also a side note: the hash is reversible for IPv4. The window is short-lived and `security.ts:109-111` already acknowledges this, so it is not a new defect.

### Stage 1: measurement in code, size S, no change to limits

- **Which limit refused.** In `app/mcp/route.ts`, add a bounded `limit` value (`minute` | `key_day` | `global`) for 429 responses. One way is to keep `errorCode: "rate_limited"` and add one new allow-listed field, `limit`, to `ToolCallLog` in `lib/mcp/log.ts`, by deliberate edit as that file requires.
- **Client class.** Add `clientClass: "anthropic" | "openai" | "other" | "unkeyed"` to the log.
  - Compute it in `lib/mcp/security.ts`, next to `clientKey`, by testing the trusted address against a small reviewed constant module, for example `lib/mcp/providerRanges.ts`.
  - That module holds the Anthropic `/21`, and OpenAI's prefixes vendored with their `creationTime` and source URLs.
  - It must not fetch at runtime: `/mcp`'s only network exception is Upstash.
  - Log the coarse class, never the address.
- **A durable count of the event that matters.** Only on the per-key-day denial path, `INCR mcp:keydaydeny:<class>:<date>`. This costs about 2 commands, and only when a denial happens. The number survives the one-hour log window.
- Update `docs/deployment.md` "Shared production rate limiter" and "Logs and privacy" to cover these fields and the 70%/90% review thresholds.

### Stage 2: only if Stage 0 or 1 shows provider addresses being refused (owner decision), size M

Keep the three ordered checks and fail-closed. Change only how the key and limits are chosen, through a small class-to-limits table in `lib/mcp/limits.ts`:

| Caller | Key | Minute | Day |
|---|---|---|---|
| `other` or `unkeyed` | as today | as today | as today |
| `openai` (address in an OpenAI range **and** `_meta["openai/subject"]` present on `tools/call`) | `openai:<sha256(subject)>` | 60/min | 1,000/day |
| `anthropic` (address in `160.79.104.0/21`) | per address, as today | larger | larger |

- For `openai`, add a provider-wide cap, for example `mcp:provider:openai:<date>` at 5,000, as an extra check. Requests without `subject` (initialize, tools/list) stay on the address key. The subject is trusted only from OpenAI's addresses, and even then is bounded by the provider cap, because Codex cloud and GPT Actions also leave from OpenAI infrastructure and could forge `_meta`.
- For `anthropic` there is no per-user identity to key on. Give the range's addresses a larger allowance (for example 300 a minute and 5,000 a day), bounded by a provider-wide day cap below the 10,000 global. This accepts that one Claude user can still spend Claude's share, but no longer anyone else's.
- The global 10,000/day and the Upstash quota stay as the hard ceiling.

### Stage 3: protect the quota and cost (independent of identity, owner decision)

- **(a) A Vercel WAF rule.** Hobby allows one rate-limit rule, and it is free. Use it on `/mcp`, keyed by IP, for example 120 per 60 seconds, with a condition excluding the provider ranges. Floods and refusal retries then stop at the edge before they cost Upstash commands. This closes the "refused retries drain the month" path. The 17 Oct audit already suggested it; it has not been created, because no firewall configuration exists.
- **(b) Fewer Upstash commands per request.** Combine the three checks into one EVAL over three KEYS (the same order, the same semantics): 12 → 10 commands. Turning the minute window into a fixed INCR window as well would give about 7, but that changes the spec's "rolling minute" and needs approval.
- **(c) Pay-as-you-go Upstash.** For example, 1M requests a month at 12 commands each is 12M commands, about $24 a month. This is money and needs explicit approval; `autoUpgrade=false` stays.

### Unchanged by every stage

Accuracy, caveats, missing-is-not-zero, sources and response shapes are untouched. These are changes to the limiter and logging only.

### Compatibility

- Existing clients see no change in Stages 0, 1 and 3a.
- Stage 2 only loosens limits for provider callers. The 429 envelope, the codes and `retry-after` stay the same.

### Risks

- OpenAI ranges are "best effort" and drift. A stale list wrongly classifies some traffic as `other`, which is safe because it falls back to today's behaviour. It must never fall the other way.
- Trusting `openai/subject` without the address gate would let anyone mint unlimited identities, so the address gate and the provider cap are mandatory.
- A WAF rule set too low blocks legitimate assistants, so start it in Log mode.

## 6. Effort

- **Stage 0: S.** About an hour with Upstash console access.
- **Stage 1: S** (under a day).
  - providerRanges module plus a CIDR membership helper (about 20 lines, no dependency);
  - the `clientClass` and `limit` log fields;
  - the denial counter;
  - tests in `tests/mcp/security.test.ts`, `rateLimitOrder.test.ts` and `upstashCounter.test.ts`;
  - the deployment.md update.
- **Stage 2: M** (1-3 days).
  - the class-to-limits table;
  - the provider-cap check wired into `serve` after the per-key checks;
  - order tests, including that a spoofed subject from a non-OpenAI address is ignored;
  - a doc and spec update.
- **Stage 3a: S.** Dashboard or API, owner action. **3b: S-M. 3c: owner billing.**

## 7. How to verify the fix

- **Unit tests:**
  - `clientKey` and the classifier: `160.79.104.1` gives `anthropic`; `160.79.112.0` gives `other`; an OpenAI prefix gives `openai`; no header gives `unkeyed`.
  - `_meta.openai/subject` changes the key only when the address is in an OpenAI range.
  - Log records carry `limit` and `clientClass`, and never an address or subject.
  - Order test: per-key, then provider, then global; a refusal at each step charges nothing later.
- **Local, with the same harness as above:**
  - Repeat the 61-call test with two subjects from an OpenAI-range header: each subject gets its own 60.
  - With a non-OpenAI header: still one shared 60.
  - The 61st call from a provider address passes under its larger cap.
- **Upstash command cost:** count commands per accepted and refused request with a stub counter, and in a preview against Upstash's usage graph (expect 12, or 10 after 3b).
- **Production, after release:** for a week, read the `keydaydeny` counters and the `clientClass` breakdown. The decision trigger is any non-zero `anthropic` or `openai` key-day denial.

## 8. Revised rating

- **Impact: Medium.** The risk is not yet observed. It becomes High for Claude.ai users as adoption grows, or as soon as one heavy user appears, and today nobody can see it happen.
- **Effort: S** for measurement (Stages 0-1, plus the free WAF rule). **M** if provider-aware buckets prove necessary.

Plain English: everyone who uses Fiscal.ge through Claude.ai or ChatGPT reaches it from the same few company computers, so they share one daily allowance that one heavy user could use up for everyone; first we should start counting when that happens (cheap and free), and only then give those companies' traffic its own, larger, still-capped allowance.
