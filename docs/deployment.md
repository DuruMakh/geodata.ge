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
| `MCP_RATE_LIMITER` | Production: `upstash` | Shared Redis counter; missing/unknown configuration fails closed. `memory` remains local-only. |
| `MCP_ALLOWED_ORIGINS` | Production only | Comma-separated approved browser origins; server clients without Origin are permitted. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Production | Encrypted credentials injected by the Upstash integration. Never expose through NEXT_PUBLIC variables. |

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

`/mcp` is the only request-time route. Explorer pages, `/connect`, methodology,
and publications remain static. The endpoint exposes nine read-only tools
through the pinned MCP SDK, stateless Streamable HTTP revision `2025-11-25`.
There is no session store, model invocation, authentication, or write tool.

### Snapshot and network boundary

All budget answers use `apps/web/lib/factQuery/generated/snapshot.json`, prepared
at build time and cached once per function instance. The sole runtime network
exception is `lib/mcp/upstashCounter.ts`, which sends fixed Redis rate-limit
commands to the configured Upstash endpoint. It never sends query arguments,
figures, source documents, prompts, or raw client addresses. There is no runtime
dataset-database access or external data fallback.

The snapshot is included by `outputFileTracingIncludes`. Check the production
build trace at `apps/web/.next/server/app/mcp/route.js.nft.json` for the snapshot
path before release. An unreadable snapshot returns a service error, not data
from a different release.

### Shared production rate limiter

The `fiscal-mcp-limits` Upstash Redis resource is linked to `geodata-ge` Production
through the Vercel Marketplace. It uses the **free** plan, primary region `iad1`,
with `autoUpgrade=false`, `eviction=false`, and `prodPack=false`. The user accepted
the Marketplace terms and authorized production rate limiting. No paid SDK,
subscription, or automatic plan upgrade is required.

Set `MCP_RATE_LIMITER=upstash`. The integration provides `KV_REST_API_URL` and
`KV_REST_API_TOKEN`. The adapter uses native HTTPS with a 1.5-second timeout and
no automatic retry; an unavailable service, invalid response, or missing
credentials fails closed with 503. Memory-only counters are refused in Vercel
Production.

Two limits are checked in order:

1. **60 requests in a rolling minute per client key.** A Redis sorted set uses
   Redis server time and expires 60 seconds after the most recent accepted hit.
   The key is a hash of the trusted platform address header, not a stored raw IP.
   An unidentifiable caller shares one bucket.
2. **10,000 accepted requests per UTC day globally.** The date-keyed integer is
   checked only after the client limit allows the request, so per-client denials
   cannot drain the global quota. The daily key expires automatically.

Each hit is an atomic Lua operation. Counters are shared across function
instances. Production and preview counter namespaces are separate. A limit
reached returns 429 and Retry-After; the daily refusal points to the next UTC day.
These are request allowances, so initialization and discovery also count.

The free service has its own monthly quota (500,000 commands at setup). It does
not guarantee continuous availability under an attack or sustained maximum
traffic. Provider quota exhaustion pauses MCP through the same fail-closed 503;
static pages and bulk files continue working. Review usage before changing the
free plan. Upgrading or enabling automatic upgrades needs explicit approval.

### Other operating limits

| Control | Value |
| --- | --- |
| Request body | 32 KiB, declared-length check plus incremental byte cap |
| Query result | 500 requested cells, checked before query calculation |
| Comparison result | 250 requested pairs, checked before calculation |
| Input arrays | 100 entities, 200 series, 100 years, 100 source IDs |
| Serialized tool result | 512 KiB across text and structured content |
| Function duration | 10 seconds |

An oversized request is rejected in full with guidance to narrow it. Source
references and caveats are never silently trimmed. Every tool publishes its own
output shape. Structured and text answers preserve missingness, relevant
sources, definitions, and exclusions; only `get_sources` includes document
checksums and byte sizes.

### Security and browser access

The Host header is validated against the configured production identity.
X-Forwarded-Host is ignored. Outside production, configured Vercel preview hosts
are also allowed. A present Origin must match `MCP_ALLOWED_ORIGINS`; no Origin
is normal for server-side clients. Suggested production origins for the current
connection page: `https://fiscal.ge,https://claude.ai,https://chatgpt.com,https://chat.openai.com`.

OPTIONS preflight and all POST responses, including errors, use the approved
origin, never a wildcard or credentialed grant. Responses vary by Origin and
are not cached. Retry-After is exposed to approved browser clients. GET and
DELETE return 405: no standalone stream or session termination is provided.

The endpoint is public because the underlying figures and sources are public.
Origin checks are protocol/browser controls, not caller authentication.

### Pause, activation, and release verification

`MCP_ENABLED=true` enables serving only when the limiter is also configured.
Any other value returns 503 with a one-hour Retry-After and the working fallback
`https://fiscal.ge/downloads/data/manifest.json`. Change the Production variable
and redeploy to pause or resume. This does not affect the static site.

The public header's `AI` item and shared footer lead to `/connect`; the page is
in the sitemap and llms.txt. Ship this discovery with a verified, enabled MCP
release. For emergency pauses, the static setup page remains accessible while
the endpoint gives an explicit temporary-service error and bulk fallback.

Release through the Actions-owned pipeline described above. Configure the
production limiter and switch before the final deployment; do not bypass CI.
After Vercel reports READY for the merge commit:

- Check the published catalogue's releaseCommit and dataVersion.
- Connect an SDK client, list all nine tools, discover an entity, and query
  reviewed expenditure, municipal totals, debt, and a signed deficit.
- Check missing values, invalid inputs, source narrowing, and a stale version.
- Verify rate enforcement with bounded test counters or a preview deployment;
  do not consume the global production quota for a load test.
- Open `/connect`, click `AI` from the homepage, verify mobile layout and copy
  controls, and check that the bulk fallback resolves.
- Inspect the post-release runtime error window. A successful build or hook
  alone is not proof the endpoint is live.

### Logs and privacy

Application logs use the allowlist in `lib/mcp/log.ts`: tool, data version,
response bytes, duration, outcome, and bounded error code. HTTP 200 tool errors
are logged as failures. Early refusals are counted too. Unknown caller-provided
tool and method names are recorded as fixed unknown labels, never echoed.

Do not log raw prompts, request bodies, invalid parameter strings, credentials,
addresses, or provider error text. The temporary hashed counter key is not an
application log field. Retain detailed application events for 14 days and
aggregated metrics for 90 days. Vercel/Upstash infrastructure logs are separate;
do not claim providers never process request addresses.

Rollback restores the route and snapshot together. The Redis counters contain
no budget data and require no migration when a code release is rolled back.

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
