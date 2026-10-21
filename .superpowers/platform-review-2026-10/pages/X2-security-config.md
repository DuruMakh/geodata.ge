# X2-security-config: security and configuration review

## Summary
The /mcp endpoint is well built. Rate limiting fails closed, the pause switch, Host and Origin checks, the body cap (declared, chunked and understated length) and the bilingual error envelope all held under in-process probes, and no secrets were found in the tree or in history. The one serious hole is outside /mcp. One archived Geostat web page is served from fiscal.ge as live HTML, so its Google Analytics, reCAPTCHA and inline scripts run on the fiscal.ge origin in production. The other findings are availability and hygiene.
Scores: 1 /mcp 9 · 2 headers/CSP 5 · 3 env 8 · 4 deps 7 · 5 Actions 7 · 6 secrets 10 · 7 user input 10 · 8 downloads 6.

## Findings
| id | area | severity | evidence | problem | suggested fix | effort | shared? |
|---|---|---|---|---|---|---|---|
| X2-security-config-01 | 2, 8 (headers, downloads) | high | `data/methodology/source-archives/unemployment.csv:8` publishes `downloads/methodology/unemployment/files/employment-unemployment-en.html` with media type `text/html`. Production `curl -I https://fiscal.ge/downloads/methodology/unemployment/files/employment-unemployment-en.html` returns `content-type: text/html`, `content-disposition: inline` and no CSP. The file has 7 `<script>` tags: `googletagmanager.com/gtag/js?id=UA-12816210-1`, `google.com/recaptcha/api.js`, `/js/app.js` (which resolves against fiscal.ge) and 4 inline scripts. The other 21 HTML captures are published as `*.html.txt` (served `text/plain` + nosniff). The CSP sandbox rule at `next.config.ts:39-46` covers only the two Trade captures. | Opening a source link from the methodology page runs third-party JavaScript on the fiscal.ge origin. It can read same-origin cookies and storage, such as the site's own GA and Clarity cookies. It also reports the visit to Geostat's analytics property and loads Google reCAPTCHA. Nothing stops the next HTML capture from repeating this: no validator rejects a `text/html` public path that is not `.txt`. | (a) Publish this capture as `employment-unemployment-en.html.txt`, like the other 21. (b) Change the existing `/downloads/methodology/:dataset/files/:path*` header rule (`next.config.ts:35-38`) to also send `Content-Security-Policy: sandbox; default-src 'none'`, which covers every archived original. (c) Add an archive-validation check (`scripts/prepare-methodology-archives.ts`) that rejects a `text/html` row whose `public_download_path` does not end in `.txt`. Extend `tests/seo/nextConfig.test.ts:4`. | S | y: `next.config.ts` headers and the methodology archive validator |
| X2-security-config-02 | 1 (/mcp) | medium | `app/mcp/route.ts:39` is a 10,000/day global cap. `lib/mcp/limits.ts:9-10` allows 60/min per key. So one key can use the whole global allowance in 10,000/60 = 167 min. `docs/deployment.md:415-421`: about 10 Upstash commands per accepted request, refused requests also cost commands, and the free plan has a 500,000-command monthly quota. A refused hit still runs `EVAL` + `TIME` + `ZREMRANGEBYSCORE` + `ZCARD` (about 4 commands, `lib/mcp/upstashCounter.ts:16-19`). There is no edge-level limit in front of the function: no middleware/proxy, and `vercel.json` has no firewall rule. | One client polling at 1 request/s takes /mcp to 429 for everyone until UTC midnight. A flood of requests the per-key limit refuses, around 50 per second, still uses up the monthly Upstash quota in about 40 minutes. After that /mcp fails closed (503) for the rest of the month. Docs line 406-407 says per-client denials "cannot drain the global quota". That is true for the app's daily counter, but not for the provider quota, which they do drain. The docs do disclaim availability under attack. | Add a per-key daily cap (e.g. 1,000/key/day, checked before the global one) so no single key can take the shared 10,000. Put a Vercel Firewall rate-limit rule on `/mcp`, if the plan includes it, so floods are dropped before the function runs and before Upstash is charged. Correct the doc sentence. | S–M | n |
| X2-security-config-03 | 8 (downloads/payload) | medium | `lib/pages/expenditure.tsx:74`, `lib/pages/revenue.tsx:72` and `lib/pages/analysis.tsx:55` pass `Array.from(glossary.values())`, which carries `description` and `notes` (`lib/data/glossary.ts:13-19`). The client uses only id and labels (`components/main-explorer/main-explorer.tsx:66`). Live: 6 internal-note strings ("Confirm against source before production" ×3, "Temporary source aggregate for Plan 5…", "Separated from culture by user decision", "Review mappings against official…") on `/explorer/expenditure`, `/explorer/revenue`, `/explorer/analysis` and `/en/explorer/analysis`. | Internal review notes ship in the page source of the three Budget routes in both languages. They read as if the data were unconfirmed. Confirms U05-analysis-02 and U04-revenue-07 at the shared cause. | In the three page loaders, map the entries to `{ id, kaLabel, enLabel }` (one shared helper next to `loadGlossary`). Narrow the `glossaryEntries` prop type to match. | S | y: `lib/pages/{expenditure,revenue,analysis}.tsx` + `lib/data/glossary.ts` |
| X2-security-config-04 | 2 (headers) | low | `next.config.ts:47-55` sets nosniff, `X-Frame-Options: DENY`, Referrer-Policy and Permissions-Policy on `/(.*)`, but no `Content-Security-Policy` anywhere except the two Trade captures. Production `curl -I https://fiscal.ge/` confirms: HSTS is present (Vercel default `max-age=63072000`) and there is no CSP. | No second line of defence for script injection, and no `frame-ancestors`. No current XSS sink was found (area 7 is clean), so this is hardening only. It would also have limited finding 01. | Add a site-wide CSP: `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms`; matching `connect-src`/`img-src` for GA and Clarity (`components/site/site-analytics.tsx:19,32`); `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`. Ship it Report-Only first. | M | n |
| X2-security-config-05 | 5 (Actions) | low | `.github/workflows/ci.yml:1-16` has no `permissions:` block. `db-health.yml:17` and `deploy-production.yml:25` both set `contents: read`. The repository's default token setting could not be read (the proxy refuses `actions/permissions`). | Push-to-main CI runs get whatever the repository default token scope is, possibly read/write, with no need for it. | Add top-level `permissions: { contents: read }` to `ci.yml`. The upload-artifact step needs nothing more. | S | n |
| X2-security-config-06 | 5 (Actions) | low | `deploy-production.yml:23` is `workflow_dispatch` with no ref guard. The job `if` (line 44) admits any dispatch. `DIRECT_URL` (write access to the Supabase mirror, lines 64/68), `DATABASE_URL` and `VERCEL_DEPLOY_HOOK_URL` are repository secrets, not secrets of a protected Environment. | A dispatch from any branch runs that branch's copy of the deploy workflow with production database write credentials. Only people with write access can do this, and the repo has one maintainer, so the exposure is limited. Environment scoping would also make the deploy history auditable. | Add `environment: production` to the job, restricted to deployments from `main`, and move the three secrets into it. Add `github.ref == 'refs/heads/main'` to the dispatch branch of the `if`. | S | n |
| X2-security-config-07 | 3 (env) | low | `.env.example` and `apps/web/.env.example` list only `DATABASE_URL`, `DIRECT_URL` and `GEODATA_DATA_SOURCE`. Missing: `NEXT_PUBLIC_SITE_URL`, which CLAUDE.md requires on builds (`lib/siteUrl.ts:28` silently falls back to `http://localhost:3000`), and `MCP_ENABLED` / `MCP_RATE_LIMITER=memory`, which are needed to exercise /mcp locally (`docs/deployment.md:213-216`). The local build at :3100 answers every /mcp call with 503 `service_unavailable` for this reason. | Local runs differ silently from production: /mcp is paused and canonical URLs point at localhost unless someone reads CLAUDE.md or deployment.md. | Add commented entries for `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, `MCP_ENABLED=true` and `MCP_RATE_LIMITER=memory` (marked local-only), with a pointer to the deployment.md table for the production-only variables. Keep only one of the two copies. | S | n |

Checked and found sound (no finding):
- /mcp:
  - Fail-closed limiter when the variables are missing, the URL is malformed or not `*.upstash.io`, or the service is unreachable (`limits.ts:83-93`, `upstashCounter.ts:30-52`). Memory counter refused in production.
  - Unkeyed callers share one bucket (61st request → 429, measured).
  - Pause switch defaults to off. Live :3100 returns 503 with Retry-After 3600.
  - Host allowlist ignores X-Forwarded-Host (evil host → 403). A present Origin, including `null`, must be allowlisted (→ 403).
  - 32 KiB body cap: declared length, chunked, and understated length all → 413.
  - Malformed JSON → -32700. Batch, number, null, string or missing method → -32600. Unknown method → -32601. Unknown tool → -32602.
  - No stack traces or paths in any error.
  - The log is allow-listed field by field (`log.ts:44-66`). Tool names are matched against a fixed set.
  - CORS never uses `*` or credentials.
  - Production `/mcp` with a foreign Host is refused by Vercel (404).
- Area 7:
  - Every hash parser whitelists its values (e.g. `lib/explorer/urlState.ts:178-185`, `use-trade-sections-state.ts:9-10`).
  - The only `dangerouslySetInnerHTML` is JSON-LD, escaped with `<` → `<` (`lib/seo/structuredData.ts:110-112`).
  - The one `target="_blank"` link has `rel="noreferrer"`.
  - Redirect sinks use only `pageHref` of whitelisted ids.
- Area 6:
  - No keys or credentials in the working tree.
  - Not in the last 400 commits on all branches either (`git log -p` regex for postgres URLs with passwords, JWTs, `sk-`, `AKIA`, `ghp_`, `github_pat_`, `*.upstash.io`, Vercel deploy-hook URLs).
  - `git log -S` for `KV_REST_API_TOKEN=`, `integrations/deploy/` and `sk-ant` finds 0 commits. The 21 commits mentioning `pooler.supabase.com` contain only the `<project-ref>:<PASSWORD>` placeholder.
  - `.gitignore:14-17` and `apps/web/.gitignore:103-105` cover `.env*`.
- Area 5:
  - No `pull_request_target`.
  - No `${{ github.event.* }}` in any `run:` step.
  - CI references no secrets.
  - The deploy `workflow_run` guard admits only push-triggered, successful CI on main.
  - Every action is GitHub-owned (`actions/*@v4`) and Dependabot watches `github-actions`.
- Area 8:
  - All 247 `.xlsx` files under `public/downloads` are official originals under `methodology/*/files`.
  - Generated workbooks carry no internal columns: `workbookModel.test.ts`, `debtWorkbook.test.ts` and `workbookWriter.test.ts` pass, 39 tests, and assert headers and absence of ids.
  - Refuted: `source_id`, `status`, `snapshot_date` and `mapping_notes` in `/downloads/data/*.csv` (U10-gdp-17, U06-debt-14) are documented lineage columns of the processed-data downloads (e.g. `docs/data-methodology/inflation-products.md:47`, `inflation-cpi-national.md:170`). The AGENTS.md "no internal metadata columns" rule applies to Excel workbooks.
  - `repository_source_path` in the methodology manifests points at the public GitHub repo, so it is not a leak.

## Existing plan items still open
- audit-fixes Task 20 (dependency audit) is still open:
  - `apps/web/package.json:191` still pins `fast-uri` to `3.1.7`, the top of the vulnerable range.
  - `npm audit` still reports GHSA-hrr3-gc8f-f4qj (fast-uri, moderate), GHSA-hxh3-vqpv-xpqv (hono 4.13.5, moderate) and GHSA-w5hq-g745-h8pq (uuid 8.3.2 via exceljs, moderate), plus GHSA-vfj7-8cjw-p6xm (braces, high, 5 packages in the eslint-config-next chain).
  - The braces accepted risk expires 2026-11-02 (`scripts/audit-dependencies.ts:7`). From that date CI fails on every PR and deploys stop unless this is resolved.
  - Reachability in production: none.
    - fast-uri comes only through ajv in prisma dev tooling and the dev-only `@modelcontextprotocol/sdk`. It is absent from the `/mcp` trace (`.next/server/app/mcp/route.js.nft.json`: 0 files).
    - hono is dev-only, via `@modelcontextprotocol/sdk` in devDependencies.
    - uuid ships in the browser Excel bundle, but the advisory affects v3/v5/v6 with a caller `buf`, and exceljs uses v4.
    - braces is lint-only.
- audit-fixes Task 19 (function-size guard): not re-verified (no build allowed).

## Tests to drop or merge
| file | test | reason | runtime | drop / merge into |
|---|---|---|---|---|
| none | | Security tests read were targeted and non-overlapping (`tests/mcp/route.test.ts`, `security.test.ts`, `upstashCounter.test.ts`, `rateLimitOrder.test.ts`). Not audited for duplication beyond that. | | |

## Georgian wording for owner review
| page | current text | issue | suggestion |
|---|---|---|---|
| /mcp (rate-limit error) | `მოთხოვნების რაოდენობა ლიმიტს გადააჭარბა. სცადეთ ერთი წუთის შემდეგ, ან ჩამოტვირთეთ ფაილები.` (`app/mcp/route.ts:112`) | The English version gives the manifest URL; the Georgian says only "download the files" with no link. | Add the same URL to the Georgian text. |

## Not checked (and why)
- Live rate-limit enforcement against production Upstash: not tested, to avoid spending the production quota (deployment.md:496 forbids load tests). Rate limiting was verified in-process with the memory counter via a scratch `tsx` probe (no repo files changed).
- Vercel Firewall / WAF configuration and the GitHub repository's default workflow token permissions: not visible from the repo, and the proxy refuses `actions/permissions` and `environments`.
- `npm audit` for outdated majors without a known vulnerability: out of scope per the brief.
- Production build output (function sizes, Task 19): no build allowed.
- `git status` was clean after the three unit test files ran; no tracked files changed.
