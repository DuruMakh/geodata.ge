# Deployment (Vercel)

The site is a fully static Next.js build served by Vercel. This doc records the
project configuration and the operational workflows: the production deploy pipeline, manual deploys/rollback, environment
variables, GitHub Actions credentials, the runbook, the scheduled health
check, and connecting the custom domain.

## Vercel project

| Setting | Value |
| --- | --- |
| Team | `durumakh-1974s-projects` |
| Project | `geodata-ge` |
| Production URL | https://fiscal.ge |
| Git repository | `github.com/DuruMakh/geodata.ge` (git-connected) |
| Root Directory | `apps/web` |
| Framework preset | Next.js (default build/install commands) |
| Node.js | 24.x (also pinned via `engines` in `apps/web/package.json`) |
| Environment variables | Production: `DATABASE_URL` + `GEODATA_DATA_SOURCE=db` (see Environment variables below); previews/dev: none — CSV-mode builds read `data/imports/` from the repo checkout |

The repo clone on the build machine includes the repo root, so the build can
read `data/` via the `../../` relative paths in `apps/web/lib/data/servedData.ts`.
Before Next.js builds, `prebuild` deterministically prepares the ignored public
methodology downloads from the reviewed manifests and immutable originals; see
`docs/data-methodology/public-methodology-and-source-archives.md`. All app
routes—including `/`, the explorer hub/sections and municipal detail pages,
the methodology hub and its three live category pages, `/robots.txt`,
`/sitemap.xml`, and the 404 page—are prerendered at build time; nothing runs
server-side at request time.

## How deploys happen

- **Production**: pushes to `main` no longer deploy directly — Vercel
  auto-deploy for `main` is disabled (`apps/web/vercel.json`), and the only
  road to production is `.github/workflows/deploy-production.yml`:
  1. CI (`.github/workflows/ci.yml`) completes green on `main`;
  2. the workflow applies any new Prisma migrations (`npm run prisma:deploy`)
     and re-runs the parity-checked import (`npm run data:import`),
     converging the Supabase mirror to the checkout — unconditionally, on
     every deploy (the import is idempotent; the parity report is in the
     workflow log);
  3. it runs the db-mode build itself (`GEODATA_DATA_SOURCE=db npm run
     build`, over the pooled `DATABASE_URL`), so the exact build Vercel is
     about to run is proven before the hook fires — nothing earlier in the
     pipeline exercises that path for this commit, because PR CI builds only
     in CSV mode and `db-health.yml` runs on a weekly schedule rather than per
     commit;
  4. it POSTs the Vercel deploy hook, and Vercel builds latest `main` with
     `GEODATA_DATA_SOURCE=db`, regenerating and validating the methodology
     archives in `prebuild`, and re-verifying the mirror row-by-row during the
     build.
  A failure at any step leaves production serving its previous deploy, and a
  red `main` blocks production updates by design. The workflow's manual
  trigger (Actions → *Deploy production* → *Run workflow*) is the
  "import + redeploy" escape hatch.
- **Previews**: unchanged — every push to any other branch (and every PR)
  gets its own preview deployment, always CSV-mode (the database env vars
  are scoped to Production only), so data-PR previews never depend on the
  mirror. Preview deployments are automatically `noindex`ed by Vercel.

## Methodology archive release checks

`npm run build` runs `npm run data:prepare-methodology-archives` through
`prebuild`. The generated tree under
`apps/web/public/downloads/methodology/` and
`data/reports/methodology-archive-validation.json` are ignored build outputs;
they must not be committed. The reviewed CSV manifests under
`data/methodology/source-archives/` remain the only publication control.

Before a release, inspect the generated report for top-level and per-dataset
`PASS`, expected original counts/source bytes, `generatedBytes`, and output
hashes/sizes. Compare the sum of `generatedBytes` and the full static build
with the active Vercel plan's deployment and per-file limits. Source bytes
alone understate the deployment because individual files, two manifests, and
each category ZIP coexist. The detailed write/check/update contract is in
`docs/data-methodology/public-methodology-and-source-archives.md`.

If Vercel cannot safely serve the archive size, change only byte storage to an
approved object store/CDN and proxy or rewrite the same stable
`/downloads/methodology/<dataset>/...` paths. Do not change the product URLs,
reviewed manifest records, generated CSV/JSON contents, hashes, ZIP membership,
or Actions-owned production flow; external storage is not a new source of
truth.

After Vercel reaches `READY` for the merge SHA, smoke-test one individual
original from each category, all three category ZIPs, and one category's CSV
and JSON manifest pair. Require HTTP 200, manifest-matching SHA-256 for each
byte, the CSV BOM, and exact ZIP membership. A green deploy-hook workflow still
proves only hook acceptance, not these deployed bytes.

## Manual operations (Vercel CLI)

Requires a recent CLI (`npm i -g vercel@latest`; v52 fails with a stale-token
error — updating fixes auth) and `vercel login` as the project owner. Run from
the repo root; `vercel link --repo` links the checkout to the `geodata-ge`
project.

- Inspect production: `vercel inspect https://fiscal.ge --logs`
- List deployments: `vercel ls geodata-ge`
- Manual production deploy from local checkout: `vercel deploy --prod`
  (normally unnecessary — the *Deploy production* workflow owns production;
  this is the GitHub-Actions-outage fallback, see the Runbook)
- Rollback: `vercel rollback` (or dashboard → Deployments → ⋯ → *Instant Rollback*)

## Environment variables

Production builds from the Supabase mirror; previews and local dev need none.

| Variable | Scope | Value |
| --- | --- | --- |
| `DATABASE_URL` | Production only | Supabase pooled connection (port 6543, `?pgbouncer=true`) |
| `GEODATA_DATA_SOURCE` | Production only | `db` |
| `NEXT_PUBLIC_SITE_URL` | Production only | canonical site origin, exactly `https://fiscal.ge` |
| `MCP_ENABLED` | Production only | `true` to serve `/mcp`; anything else (including unset) keeps it paused |
| `MCP_RATE_LIMITER` | Non-production only | selects the shared counter. The ONLY implemented value is `memory`, which is development-only and is refused outright in production. There is no production limiter yet, so any value — including a plausible-looking one — fails closed |
| `MCP_ALLOWED_ORIGINS` | Production only | comma-separated browser origins allowed to call `/mcp`; unset means server clients only |

- The db-mode build renders from the mirror and re-verifies it row-by-row
  against the checkout's CSVs; see
  `docs/data-methodology/database-import.md`.
- **Break-glass CSV fallback**: set `GEODATA_DATA_SOURCE` to `csv` (or
  remove it) in Vercel → Settings → Environment Variables (Production) and
  redeploy; production then builds straight from the reviewed CSVs with no
  database involved. Both modes are guaranteed identical by the parity
  checks.
- **`NEXT_PUBLIC_SITE_URL`**: set to exactly `https://fiscal.ge` in Production.
  It owns Open Graph URLs, canonicals, `robots.txt`, and `sitemap.xml`
  (`apps/web/lib/siteUrl.ts`) independently of Vercel alias ordering. The value
  must be a bare HTTPS origin without a path, query, or fragment.

## Website analytics

The shared root layout loads Google Analytics 4 (`G-RRS446MKJW`) and Microsoft
Clarity (`y9my6v583o`) through `components/site/site-analytics.tsx`. These are
public tracking IDs, not credentials; no additional environment variables or
packages are required. The vendor scripts load asynchronously after hydration
and only when the browser hostname is exactly `fiscal.ge`. Local development,
Vercel preview URLs, and the `geodata-ge.vercel.app` alias do not send visits.

This installation has no consent banner or consent gate, as explicitly requested
by the owner. It does not send a fabricated consent-granted signal or change
provider consent settings. This is not a claim of legal compliance; regional
provider requirements can limit tracking, including Clarity functionality.
Search Console is unchanged, and Vercel Speed Insights is not installed.

GA4 client-side page views rely on **Enhanced measurement → Page views → Page
changes based on browser history events** being enabled for the web stream.
Do not add a second manual page-view tracker while that setting is enabled.
This initial installation does not add custom explorer or Excel-download events.
After deployment, verify the production scripts, GA4 Realtime data, and incoming
Clarity sessions separately; passing local tests does not prove receipt by either
provider. Browser tests intercept vendor requests to avoid polluting real reports.

## GitHub Actions credentials

Three repository secrets (GitHub → Settings → Secrets and variables →
Actions):

| Secret | Value | Used by |
| --- | --- | --- |
| `DIRECT_URL` | Supabase **session pooler** string (port 5432, user `postgres.<project-ref>`). GitHub runners are IPv4-only and the true direct host (`db.<ref>.supabase.co`) is IPv6-only, so this project uses the session pooler for direct-style connections both in CI and in the local `.env`. | migrations + import in `deploy-production.yml` |
| `DATABASE_URL` | Supabase pooled string (port 6543, `?pgbouncer=true`) | weekly build in `db-health.yml` |
| `VERCEL_DEPLOY_HOOK_URL` | Deploy hook URL (Vercel → Settings → Git → Deploy Hooks, branch `main`). Treat as a secret: anyone holding it can trigger rebuilds of latest `main` (a nuisance, not a data risk); rotate in Vercel settings if leaked. | deploy step of `deploy-production.yml` |

## Runbook

Every failure below leaves the live site serving its previous deploy;
nothing here can take the site down.

**A green *Deploy production* run does not mean the deploy landed.** The final
step POSTs the deploy hook and `curl -f` only proves Vercel accepted the
trigger; Vercel then builds asynchronously, after the workflow has already
gone green. Confirm a release by checking the deployment in the Vercel
dashboard, not by the green check in the Actions tab. (Closing this gap means
polling `GET /v13/deployments/{id}` with the hook's returned job id — which
the workflow now extracts and prints — until `READY`/`ERROR`, and that needs a
`VERCEL_TOKEN` secret this pipeline does not currently hold.)

What a green run *does* now prove is that the build works: the workflow runs
`GEODATA_DATA_SOURCE=db npm run build` against the converged mirror before it
fires the hook. A code-level db-mode failure — a `mirrorRows.ts` mapping gap, a
parity assertion, a pooler-only query problem — therefore fails the workflow
red rather than surfacing later as a Vercel email. What remains outside that
gate is environment drift between the runner and Vercel: a pooler paused
between the two builds, or a stale Vercel Production `DATABASE_URL`. Those
still show up only as the Vercel failed-deployment email in the table below,
and with `main` auto-deploy off nothing retries on its own.

| Failure | Symptom | Response |
| --- | --- | --- |
| Import fails (validation, parity, connection) | *Deploy production* red + GitHub email; the mirror transaction rolled back | Fix the data (or transient cause); rerun the workflow from the Actions tab |
| Vercel build fails (Supabase paused or unreachable) | Vercel failed-deployment email | Resume the project in the Supabase dashboard; rerun *Deploy production* |
| CI red on `main` | No deploy triggered | Fix `main`; or run *Deploy production* manually to deploy past a known-flaky check |
| GitHub Actions outage / broken workflow | Deploys stall (visible in the Actions tab) | From a clean `main` checkout: `npm run prisma:deploy` (if new migrations), `npm run data:import`, then `vercel deploy --prod`; or revert the `git.deploymentEnabled` line in `apps/web/vercel.json` to restore auto-deploy |
| Persistent db-mode blocker | Repeated build failures | Break-glass: switch production to CSV mode (see Environment variables) |

### Credential rotation

1. Rotate the database password in the Supabase dashboard.
2. Update the two GitHub secrets (`DIRECT_URL`, `DATABASE_URL`), the Vercel
   Production `DATABASE_URL`, and local `apps/web/.env`.
3. From the Actions tab, run *DB health* (validates the pooled
   `DATABASE_URL` secret) and *Deploy production* (validates `DIRECT_URL`
   via migrate + import, and the Vercel Production `DATABASE_URL` via the
   hook-triggered build); confirm both go green.

### Backups

Deliberately none: the database is a mirror of git-versioned CSVs and
rebuilds from any checkout in minutes (`npm run data:import`). Do not add
backup jobs or PITR — restoring an old snapshot would only create drift for
the next import or build to flag.

## Scheduled health check

`.github/workflows/db-health.yml` runs a db-mode build every Monday
06:00 UTC (plus on demand via *Run workflow*). One green run proves the
database is reachable and credentialed and that the mirror still matches
the checkout's CSVs; the activity also counts against Supabase free-tier
pausing (~7-day inactivity window — weekly cadence is deliberate, an owner
decision; bump the cron to twice-weekly if a quiet week ever pauses the
project). A failure emails the repo owner via GitHub's standard
failed-workflow notification. Note: GitHub auto-disables scheduled
workflows after ~60 days without repository activity (it emails a warning
first); if that happens, re-enable the workflow in the Actions tab — and
if Supabase paused in the meantime, resume the project in the dashboard
before rerunning.

## Connecting the custom domain (owner steps)

1. Buy the domain at any registrar.
2. Vercel dashboard → `geodata-ge` → Settings → Domains → *Add* → enter the
   apex domain (currently `fiscal.ge`). Also add `www.<domain>` and set it to
   redirect to the apex (Vercel offers this in the add-domain flow).
3. Configure DNS at the registrar exactly as the Domains page instructs
   (either an `A`/`CNAME` record pair or switching nameservers to Vercel).
   Vercel provisions TLS automatically once DNS propagates.
4. After the domain shows **Valid Configuration**, trigger one redeploy of
   production (dashboard → Deployments → ⋯ → *Redeploy*, or Actions →
   *Deploy production* → *Run workflow*) so canonicals, `robots.txt`, and
   `sitemap.xml` pick up the new domain via `VERCEL_PROJECT_PRODUCTION_URL`.
5. `https://geodata-ge.vercel.app` is outside the production SEO contract. The
   owner will configure it separately as a preview surface; do not use it as
   production deployment evidence and do not redirect it as part of Fiscal.ge
   SEO work.

## The `/mcp` runtime

`/mcp` is the **first and only request-time route** in this application.
Everything else is prerendered at build time and served as static output, and
that has not changed — the build log shows exactly one dynamic route (`ƒ /mcp`).

### What it serves and where its data comes from

The seven read-only query tools of the fact-query core, over MCP Streamable
HTTP, protocol revision **`2025-11-25`**, stateless, with no session store.
`@modelcontextprotocol/sdk` is pinned to an **exact** version (no caret): the
protocol revision advertised is a compatibility promise, so it must not drift on
a routine `npm update`.

It answers from `apps/web/lib/factQuery/generated/snapshot.json`, written during
`prebuild` and bundled into the function. **There is no request-time database
access, no network access, and no source-document fetching.** If the database
goes down, `/mcp` keeps answering.

That artifact is gitignored, so Next cannot trace it statically. It is included
explicitly via `outputFileTracingIncludes` in `apps/web/next.config.ts`. To
confirm a build actually shipped it:

```bash
node -e "console.log(require('./.next/server/app/mcp/route.js.nft.json').files.filter(f=>f.includes('snapshot.json')))"
```

An empty array means the deployed function has no data and every call will fail.

### Operating limits

| Control | Value | Enforced in |
| --- | --- | --- |
| Request body | 32 KiB, refused on the declared length before the body is read, then re-checked on the real bytes | `app/mcp/route.ts` |
| Returned observation cells | 500 | `lib/mcp/result.ts` |
| Returned comparison pairs | 250 — a comparison row is two cells | `lib/mcp/result.ts` |
| Input arrays | 100 entities, 200 series, 100 years, 100 source ids | `lib/factQuery/schemas.ts` |
| Serialized tool result | 512 KiB, both representations | `lib/mcp/result.ts` |
| Per-key request rate | 60 per rolling minute; an unidentifiable caller shares one bucket rather than skipping the limit | `app/mcp/route.ts` |
| Global daily accepted requests | 10,000 per UTC day, charged only once a request has passed the per-key limit | `app/mcp/route.ts` |
| Request duration | 10 s | `maxDuration` in `app/mcp/route.ts` |

The input array bounds are enforced as `.max()` on the schemas themselves, so a
client reads them as `maxItems` in `tools/list` rather than discovering them by
being refused.

**What a response cites, and what `get_sources` adds.** `meta.sources` answers
"what should I cite": document id, title, coverage years, and both the official
and archived URLs. Fields every document of a source agrees on — publisher,
attribution, licence, media type, retrieval date, dataset, role — are stated once
in that source's `documentDefaults` rather than repeated per document; a field
the documents disagree about stays on each of them. `sha256` and `byteSize`
answer a different question — "do these bytes match what was reviewed" — and are
served by `get_sources` and the published `sources.json`, not by every response.

No document is ever omitted to save space. A ranking over all 64 municipalities
still names all 66 documents it read. Compaction took that response's structured
envelope from 91.0 KiB to 42.4 KiB, of which grouping the ranking's exclusions by
reason — rather than repeating one identical sentence per excluded entity — was
16.3 KiB.

Every tool declares an `outputSchema` (`lib/mcp/outputSchema.ts`). Responses have
always carried a structured twin alongside the text, but without that declaration
a client has no way to know it exists, and real clients were observed parsing the
text table instead. The SDK validates `structuredContent` against the schema and
fails the call on a mismatch, so `tests/mcp/outputSchema.test.ts` runs every tool
against it.

The byte ceiling, not the cell cap, is the binding gate: a compliant 495-cell
municipal request serializes to about 517 KiB. Over-ceiling results are refused
whole with narrowing guidance and a link to the bulk files — never trimmed,
because dropping sources or warnings to make a result fit would publish a
figure without its limitations.

`GET` and `DELETE` return `405`. Handed a `GET` with `Accept:
text/event-stream`, the transport would open a keep-alive SSE stream this server
has nothing to push to, letting an unauthenticated caller pin a function
instance for the full 10 seconds per request.

### The limiter is an owner decision, and the endpoint fails closed without one

`MCP_RATE_LIMITER` selects the shared counter. **Unset, every request is
refused with a retryable 503.** That is deliberate: serving unlimited public
traffic from an unauthenticated endpoint is a stop condition, so `/mcp` cannot
be switched on without a limiter decision having been made.

`memory` selects a process-local counter. It is for **local development only**
and must never be used in production: serverless instances scale horizontally,
so a process-local count of 60 becomes 60 × N and enforces nothing.

Choosing the production limiter — a platform control or a minimal approved
shared counter — requires the owner sign-off described in the release
verification: hosting plan, limiter availability and cost, measured resource
use, expected traffic, budget alerts, and an approved operating budget.

### Two public files claim a live endpoint — do not publish them ahead of the switch

`public/llms.txt` and the `/connect` page both describe `https://fiscal.ge/mcp`
in the present tense, as a service that answers. They are static, so they go
live with **any** production deploy, whatever `MCP_ENABLED` is set to.

A client that reads them and connects to a paused endpoint gets a `503` with a
bilingual message pointing at the site and the published files, so nobody is
left in silence. But the claim is still ahead of the fact. Either enable `/mcp`
in the same release that publishes them, or accept that the two files advertise
a service that answers only with `503` until the switch is on. This is the
owner's call, and it is a sequencing decision rather than a code change.

### Pause and resume

`/mcp` ships **deployed and dark**. It runs only when `MCP_ENABLED` is exactly
`true`; any other value, including unset, returns `503` with `Retry-After` and a
bilingual message pointing at the static site and the published files.

To pause a live endpoint (Vercel → Settings → Environment Variables →
Production), set `MCP_ENABLED` to `false` and redeploy, or remove the variable.
**Pausing `/mcp` does not affect anything else**: static pages, CSV downloads,
the JSON publications and the explorer keep working, because the switch is one
variable on one route. Confirm after pausing:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://fiscal.ge/explorer/municipalities
```

That must still be `200` while `/mcp` returns `503`.

### Logs and privacy

One JSON line per request, built from an allow-list in `apps/web/lib/mcp/log.ts`
— tool name, dataset, measure, year range, entity and series counts, data
version, response size in bytes, duration, outcome, error code.

Result count is **omitted**, not sent as zero: the route knows how large its
reply was but not how many observations are inside it, and a hardcoded `0`
would read as "this answer had no rows".

The tool name is matched against the seven tools and the protocol methods
before it is written; an unrecognised one is recorded as `unknown_tool` or
`unknown_method`. It is never echoed. A caller controls that field completely,
so echoing it would put unbounded caller-supplied text into retained records.

It never records raw prompts, invalid parameter strings, request bodies,
authorization headers, full user agents, or IP addresses. The limiter key is a
truncated hash of the platform's trusted address metadata, used only inside its
enforcement window and never written to these logs. Hashing an address does not
make a persistent record anonymous, which is why it is not persisted.

Retain detailed application events for 14 days and aggregated service metrics
for 90 days. Vercel's own access-log retention is separate and is not covered by
that policy; do not claim no provider ever processes an address.

These records describe tool activity, not people. One key may be an entire
organisation's traffic, and the original question a user asked never reaches
this service at all.

### Rollback

`/mcp` needs no separate rollback: it is part of the same deployment as
everything else, so the standard Vercel rollback restores the previous route and
its snapshot together. To disable it *without* a rollback, use the pause switch
above.

### Security

Host is validated against `NEXT_PUBLIC_SITE_URL` and
`VERCEL_PROJECT_PRODUCTION_URL`, read from the `Host` header only —
`X-Forwarded-Host` is deliberately ignored, since it is client-supplied on a
direct connection. A request with no `Origin` is allowed, because most MCP
clients are servers; a *present* origin must appear in `MCP_ALLOWED_ORIGINS`,
including the opaque `null` origin a sandboxed iframe sends. CORS echoes the one
approved origin, never `*`, and never with credentials, and `Vary: Origin` is
always appended so no cache can hand one origin's answer to another.

A browser also sends a CORS **preflight** before any POST carrying
`content-type: application/json`, so `/mcp` answers `OPTIONS` itself. Without
that, an origin listed in `MCP_ALLOWED_ORIGINS` still could not reach the
endpoint: the framework's own generated `OPTIONS` replies `204` with an `Allow`
header and no CORS headers, and the browser stops there. The preflight runs the
same pause, host and origin checks as a real request.

Host matching is case-insensitive. If neither host variable is configured, the
check is skipped outside production — a bare local server has no site URL — but
in production nothing configured is treated as a misconfiguration and every
request is refused.

**On a preview**, the allowlist also includes the deployment's own address, from
`VERCEL_BRANCH_URL` and `VERCEL_URL`. It has to: Vercel sets
`VERCEL_PROJECT_PRODUCTION_URL` on previews too — to the *production* domain —
so without them a preview's allowlist is the production identity alone and the
endpoint refuses its own address with `forbidden_host` on every request. Those
are platform environment variables rather than headers, so a caller cannot
present them, and they are added only when `VERCEL_ENV` is set to something
other than `production`. In production the configured identity stays the entire
allowlist.

### Testing `/mcp` on a preview

Previews are the only deployed surface where the endpoint can currently answer:
`createCounter()` refuses the in-process counter in production outright, so a
production deploy answers `503` to every request until a real shared limiter
exists (see the owner gate above). To bring a preview up:

1. Push the branch. Every branch except `main` gets a preview automatically
   (`apps/web/vercel.json` disables auto-deploy for `main` only).
2. Set `MCP_ENABLED=true` and `MCP_RATE_LIMITER=memory` on the **Preview**
   scope, then redeploy so the running function reads them. Scope them to the
   branch (`vercel env add <name> preview <branch>`) rather than to previews
   generally, so another branch's preview does not become a live endpoint.
   Also set `MCP_ALLOWED_ORIGINS` — a client that sends an `Origin` header at
   all is refused with `forbidden_origin` when nothing is configured, and a
   `403` with no CORS headers is an opaque failure to debug from the client
   side. `https://claude.ai,https://chatgpt.com,https://chat.openai.com`
   covers the hosted assistants.
3. Decide on Deployment Protection. An MCP client cannot complete Vercel's SSO
   flow and will receive an HTML login page instead of JSON, so protection must
   be disabled for the preview or a bypass token supplied.

The `memory` counter is per-instance and enforces nothing across instances.
That is acceptable for a short-lived test surface and is not a production
limiter; restore protection when testing ends.

Note that `/connect` on a preview displays `https://fiscal.ge/mcp`, because
`resolveSiteUrl()` falls back to `VERCEL_PROJECT_PRODUCTION_URL` and previews
report the production domain there. Use the preview's own origin with `/mcp`
appended, not the address the page shows.

`GET` and `DELETE` return `405` with `Allow: POST`. This is deliberate: passed
to the transport, a `GET` carrying `Accept: text/event-stream` opens a
keep-alive stream this server has nothing to push down, which an unauthenticated
caller could use to pin a function instance for the full 10-second ceiling with
a one-line request.

Access is public and unauthenticated by design: every tool reads approved public
data, and no database credentials exist in request-time code. Origin and host
checks are protocol security controls, not proof of who is calling.

## SEO and headers

- `apps/web/app/robots.ts` and `apps/web/app/sitemap.ts` generate
  `/robots.txt` and `/sitemap.xml` at build time (sitemap `lastModified` comes
  from the newest `lastReviewedAt` in `data/sources/source-documents.csv`).
- Both pages set Georgian titles/descriptions, Open Graph tags, and canonical
  URLs; `metadataBase` comes from `resolveSiteUrl()`.
- Security headers (nosniff, `X-Frame-Options: DENY`, referrer policy,
  permissions policy) are set in `apps/web/next.config.ts` `headers()`;
  Vercel adds HSTS itself. There is deliberately no Content-Security-Policy
  yet — adding one needs testing against the chart/canvas code first.
