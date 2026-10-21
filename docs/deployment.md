# Deployment (Vercel)

The site is a fully static Next.js build served by Vercel. This doc records the
project configuration and the operational workflows: the production deploy pipeline, manual deploys/rollback, environment
variables, GitHub Actions credentials, the runbook, the scheduled health
check, and connecting the custom domain.

## Bilingual release contract

The current human route inventory is owned by the localized route inventory and
published `sitemap.xml`, with paired Georgian and English HTML. Georgian addresses remain unchanged; English
uses `/en`, self canonicals and reciprocal `ka`/`en`/`x-default` links. Sitemap
Georgian dates retain existing data/content freshness; English dates use the later
of that date and the reviewed translation date. Do not infer indexing from a
successful build or deployment.

`/mcp`, `/downloads/`, `/robots.txt`, `/sitemap.xml` and `/llms.txt` remain shared.
The two social images at `/opengraph-image` and `/en/opengraph-image` use explicit
`force-static` GET routes, avoiding Next.js route-group filename suffixes. Both
are generated at build time. All human pages remain prerendered and `/mcp` remains
the sole request-time route.

Data schema **1.6.0** includes current-product inflation and reviewed language
companions. The authoritative tool inventory is `tools/list`; dataset families
and coverage are in `catalogue.json`. `manifest.json` lists every publication
with row count, bytes and SHA-256; the manifest itself is one additional artifact,
not one of its listed files. Derive changing inventories from these owners rather
than retaining old fixed counts. Requests do not gain a language argument.
Schema 1.6.0 adds `internal_error` and the `preserved_derived` source narrowing
outcome. Strict clients caching output enums must refresh discovery; clients
requiring schema 1.5.0 must update their validation. Request shapes stay unchanged.
Clients must accept additive fields and data schema 1.6.0; byte-identical response
compatibility is not promised. Transport revisions are a separate contract:
modern `2026-07-28` and preserved legacy `2025-11-25` share the endpoint.
Translation changes alter `dataVersion`. Retain the existing body, cell, pair,
ranking, byte, duration, rate and pause limits. Large bilingual evidence responses
can require narrower queries; never trim evidence or increase limits to fit.

The existing `npm run check` includes translation validation; `prebuild` prepares
the snapshot/publications and verifies the written publication hashes. Before
release, run the full browser suite against the new build and inspect both image
URLs, language-switch state, original archives and English workbook sheets.
`scripts/measure-bilingual-output.ts` records decoded HTML/asset bytes separately
from supplied encoded-length headers, build inventory, publication hashes and
baseline comparison; `scripts/measure-bilingual-mcp.ts` retains complete-result
measurements. Historical asset reports are local evidence under `.tmp/bilingual/`;
current MCP evidence lives under `docs/superpowers/reviews/`. Neither is deployment
proof. A local CSV build with credential-free database-loader fixtures does not
replace the production pipeline's database-mode parity check. Verify the deployed
commit and both language URL families separately after an authorized release.

The 2026-09-06 local comparison measured 99 to 191 static-generation entries,
37.59 to 46.13 seconds of build time, and 2,404,505 to 2,553,522 decoded bytes of
emitted client JavaScript (6.2% growth); emitted fonts stayed at 335,992 bytes.
These are observed build/file measurements, not network timing or a performance
guarantee. Snapshot size grew from 3,485,225 to 3,760,913 bytes. Original snapshot
fields and source records were checked against the F1 baseline; only added
translations and version/release metadata differ. The 100-source MCP batch newly
exceeds the unchanged 512 KiB cap; ordinary measured requests retain their prior
acceptance. Reproducing the asset comparison requires the exact baseline build
at `.tmp/bilingual/baseline-checkout` (detached `ac9f53fc0`, CSV mode, same lockfile)
alongside the current build. The full local report is `.tmp/bilingual/final/comparison.md`.

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
`docs/data-methodology/public-methodology-and-source-archives.md`. Every
human page—`/`, every explorer hub, section and place page, the methodology
hub and its category pages, `/about` and `/connect`—and `/robots.txt`,
`/sitemap.xml` and the 404 page are prerendered at build time. The only
request-time route is `/mcp` (see "The `/mcp` runtime" below).

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
- **Function size**: Vercel refuses any server function over 250 MB. On
  2026-10-10 the methodology pages traced every file under `public/downloads`
  into their functions (250.13 MB) and the production deploy failed; the fix
  is `outputFileTracingExcludes: { "*": ["./public/downloads/**"] }` in
  `apps/web/next.config.ts` (the pages are prerendered and the CDN serves
  `public/` directly). `npm run check:function-size`, run in `postbuild`, sums
  every route's `.nft.json` trace together with the shared
  `next-server.js.nft.json` files, prints the five largest and fails the build
  above 200 MB, so the next such regression fails in CI rather than at deploy.
  A data loader that reads files under `public/` or `docs/Raw Data/` at
  request time, without a `/* turbopackIgnore: true */` path hint, is the
  usual cause.
- **CI** (`.github/workflows/ci.yml`, every PR and every push to `main`):
  the `checks` job (lint, typecheck, unit tests, `data:validate`) and the `build`
  job run in parallel. `build` builds the site once (with
  `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, and `GEODATA_TYPECHECK_GATED=1` so
  `next build` skips the TypeScript pass `checks` already runs) and uploads the
  build and the files `prebuild` generates as the `next-build` artifact, without
  `.next/cache` or source maps. The `e2e` job waits for `build` only: it
  downloads the artifact, starts `next start` on port 3100, waits until it
  answers, runs the browser suite against it and prints the server log if
  anything fails. `.next/cache` (keyed on the lockfile and the tracked source)
  and the Playwright browsers are cached. Job limits: 30 minutes (`checks`), 20
  (`build`) and 45 (`e2e`). Every job fails if it wrote into the repository.
  Playwright retries a failed test once in CI and reports it as flaky. Still to
  measure on the first CI runs: each job's step times and the critical path
  (`build` then `e2e`) against the former layout; the browser suite at two
  against four workers, then pin `PW_WORKERS` in the `e2e` job; the artifact's
  size and transfer time; the `.next/cache` save time and size; the runner's
  cores and memory; and whether a second run of the same PR restores both caches
  exactly (caches saved on a PR are scoped to it, so its first run is cold).
- **Known flaky tests.** Record each one here with its cause; a retry is not a fix.
  - `main-explorer.spec.ts` "opening … fetches no other page's data" (seen on
    `/explorer/expenditure` at 1280px). Fixed 2026-10-13. The test waited for
    Playwright's `networkidle` twice. Under load Playwright reports it before
    `DOMContentLoaded`. A request after that point (the sidebar's compact logo),
    followed by the `load` event, clears it for good (Playwright 1.63), so the
    second wait hung until the 30 s timeout. The test now waits until React
    has hydrated every link and, after scrolling, until no request has been in
    flight for half a second.
  - `main-explorer.spec.ts` "legacy nav hashes redirect to their route". Fixed
    2026-10-13. The hub redirects from an effect, so only after it hydrates. The
    test gave the hub's hydration and the redirect one 5 s window from the `load`
    event. It now waits for the hub's `data-app-ready` first.
  - `mobile-series-picking.spec.ts` phone-legend deep link (worked around in the
    test in `a1574bb1`, not fixed in the app). An address-bar change to the hash
    alone leaves a history entry without the Next.js router's state. The router
    ignores it, and its next history write can put the old URL back, which drops
    the hash.
  - Load-dependent, cause not established: `municipal-entity.spec.ts` "sourced
    percentage workbook", download or request specs under a loaded machine, and
    the unit test `tests/seo/opengraphImage.test.ts`.
- **Previews**: unchanged — every push to any other branch (and every PR)
  gets its own preview deployment, always CSV-mode (the database env vars
  are scoped to Production only), so data-PR previews never depend on the
  mirror. Preview deployments are automatically `noindex`ed by Vercel.

## Temporary dependency-security exception

On **2026-10-03** the owner explicitly approved temporary acceptance of
[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
for `braces@3.0.3`, through the existing development-only chain
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
The advisory has no published patched version; [upstream PR #72](https://github.com/micromatch/braces/pull/72)
is a proposed fix, not a released remedy. This is accepted risk, not a claim
that the dependency is fixed.

The inspected Next ESLint helper receives its root-directory pattern from
repository-owned ESLint settings; this repository does not set `next.rootDir`,
so the helper uses the trusted working directory. Lockfile entries are all
development-only, and the actual built MCP trace excludes these packages.
No request argument, reviewed workbook, upload or external data supplies a
brace pattern on this path. Changing this usage requires reassessment.

`scripts/audit-dependencies.ts` still asks npm to audit **all dependencies,
including development tools**, prints the unfiltered report, and fails for
other high/critical findings. It accepts only this exact advisory, its current
named development-only ancestors and the reviewed package/version paths.
The reviewed ancestor versions are `micromatch@4.0.8`, `fast-glob@3.3.1`,
`@next/eslint-plugin-next@16.3.8` and `eslint-config-next@16.3.8`; a version
change is blocking until reassessed.
Production-use findings, changed paths, additional advisories, malformed
reports, registry failures and expiry remain blocking. CI retains the existing
three attempts for registry failures and its original high-severity threshold.

The exception **expires at 2026-11-02 00:00 UTC**. Check the upstream advisory
and release during dependency maintenance; once an official fix is available,
update the compatible dependency chain, verify lint/audit and remove this
exception and its tests. Extending acceptance beyond expiry requires explicit
owner approval and fresh exposure evidence. No automatic renewal is permitted.

## Current dependency-security review (2026-10-17)

The reviewed maintenance updates standalone `fast-uri` **3.1.7 → 3.1.8**
([advisory](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj)) and the existing
development-only Hono resolution **4.13.5 → 4.13.7**
([advisory](https://github.com/advisories/GHSA-hxh3-vqpv-xpqv)). Hono stays
within legacy SDK 1.31.0's declared `^4.11.4` range; no direct dependency or
additional override is introduced. Its affected JSX rendering operation was
not found in Fiscal's application path; the legacy SDK imports Hono only in
its example server.

The full npm audit, including development tools, now reports **7 package
findings: 2 moderate, 5 high, 0 critical**. The two moderate findings are
`uuid@8.3.2` and its parent `exceljs@4.4.0`, from the
[same advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq); they are
not two independent vulnerabilities. ExcelJS remains on its latest supported
release and declares uuid `^8.3.0`, which has no patched in-range version.
The inspected ExcelJS path calls only zero-argument `uuidv4()`, rather than
the advisory's affected v3/v5/v6 output-buffer operations. ExcelJS still ships
for workbook downloads, so retain the finding and recheck upstream releases.
Do not apply npm's suggested ExcelJS downgrade or a cross-major uuid override
without separate compatibility review of workbook and browser exports.

The npm report does **not** enumerate the SDK's embedded parser. Server and
client remain **2.2.0**, with the legacy test SDK **1.31.0**. Official 2.3.1
server/client tarballs were inspected and integrity-checked: the candidate
server's AJV provider is byte-for-byte identical to installed 2.2.0 and both
candidates retain executable `fast-uri@3.1.0` code. Actual resolver probes
still return host `A.com` for `//%41.com`, whereas standalone 3.1.8 returns
`a.com`. The advisory's separate `equal() === false` example did not reproduce;
the observed parser discrepancy remains unresolved. The server uses this
provider for schema validation. Fiscal owns the schemas, uses native `URL`
and exact allowlists for Host/Origin checks, and fetches no caller URL; these
limit the demonstrated exposure but do not establish a universal guarantee.
Keep this embedded residual open until an upstream artifact actually fixes it.

The five high findings are the exact temporary lint-chain exception above.
The policy and its expiry remain unchanged: **2026-11-02 00:00 UTC / 04:00
Tbilisi**. Before then, recheck an official braces patch or supported lint-chain
replacement; if none exists, raise the unresolved release blocker for an
explicit owner decision. Passing the policy command does not mean all findings
are fixed. The focused policy, MCP failure/privacy, legacy/modern protocol,
output-schema, security and unchanged reference tests verify this maintenance;
the integrated completion gate and production function-size check remain
separate release requirements.

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
Search Console is unchanged.

Vercel Web Analytics and Speed Insights are also mounted in the shared root
document for both languages. They render only when Vercel's build-time `VERCEL`
system variable is `1`: local and GitHub CI builds do not request Vercel-only
script endpoints. Vercel preview and production builds include both integrations.
Enable both products in the Vercel project dashboard before deploying; preserve
automatic system environment variables. Web Analytics measures visits and Speed
Insights collects real-user performance metrics; neither adds custom events.
After deployment, verify their scripts and collection requests in the browser,
then check dashboard receipt separately. Local browser checks do not prove
Vercel has received measurements.

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
and publications remain static. The endpoint exposes the read-only tools listed
by `tools/list` through pinned server SDK 2.2.0. Stateless Streamable HTTP supports
modern `2026-07-28` discovery and per-request metadata, and preserved legacy
`2025-11-25` initialization. Both return finite JSON responses; neither creates
sessions or subscriptions. GET and DELETE remain 405. The data schema is 1.6.0,
independent of either protocol revision.
The legacy adapter also retains `2025-06-18`, `2025-03-26`, `2024-11-05` and
`2024-10-07`; the modern era is never proposed during legacy initialization.
There is no session store, model invocation, authentication, or write tool.

### Snapshot and network boundary

All MCP data answers use `apps/web/lib/factQuery/generated/snapshot.json`, prepared
at build time and cached once per function instance. It is written minified: 32.1 MB
on 2026-10-13 (46.3 MB indented), about 0.2 s to read and 0.3 s to parse on the first
request of each instance. The server text built from it (coverage, tool descriptions,
instructions) and the tools' JSON Schemas are also built once per instance. The sole runtime network
exception is `lib/mcp/upstashCounter.ts`, which sends fixed Redis rate-limit
commands to the configured Upstash endpoint. It never sends query arguments,
figures, source documents, prompts, or raw client addresses. There is no runtime
dataset-database access or external data fallback.

The snapshot is included by `outputFileTracingIncludes`. Check the production
build trace at `apps/web/.next/server/app/mcp/route.js.nft.json` for the snapshot
path before release. An unreadable snapshot returns a service error, not data
from a different release.

### Shared production rate limiter

The setup record links `fiscal-mcp-limits` to `geodata-ge` Production
through the Vercel Marketplace, on the **free** plan in `iad1`,
with `autoUpgrade=false`, `eviction=false`, and `prodPack=false`. The user accepted
the Marketplace terms and authorized production rate limiting. No paid SDK,
subscription, or automatic plan upgrade is required.

Read-only inspection on **17 October 2026** did not independently establish the
current Upstash resource binding, assigned plan, billing period, allowance or
command usage. The authenticated installation was identified, but resource-list
inspection failed with a CLI error and the dashboard returned no usable content.
These unavailable surfaces do not establish an absent resource or zero usage.
Treat the plan/region/settings above and the 500,000-command setup allowance below
as historical setup evidence. The project owner must provide a functioning
resource/account inspection or dated account evidence before reporting current
headroom or applying the proposed 70%/90% quota-pressure review thresholds.

Set `MCP_RATE_LIMITER=upstash`. The integration provides `KV_REST_API_URL` and
`KV_REST_API_TOKEN`. The adapter uses native HTTPS with a 1.5-second timeout and
no automatic retry; an unavailable service, invalid response, or missing
credentials fails closed with 503. Memory-only counters are refused in Vercel
Production.

Three limits are checked in order, each only after the one before it has
allowed the request:

1. **60 requests in a rolling minute per client key.** A Redis sorted set uses
   Redis server time and expires 60 seconds after the most recent accepted hit.
   The key is a hash of the trusted platform address header, not a stored raw IP.
   An unidentifiable caller shares one bucket.
2. **1,000 requests per UTC day per client key**, the same key as the minute
   limit. Without it one key at 60 a minute could take the whole global
   allowance in under three hours. Callers behind one shared address (one
   connector's few outbound addresses, for example) share this cap.
3. **10,000 accepted requests per UTC day globally.**

Per-client refusals (limits 1 and 2) never touch the application's global daily
counter, so they cannot drain it. They are not free: every refusal still costs
Upstash commands (below). Both daily keys are date-keyed integers that expire
automatically.

Each hit is an atomic Lua operation; the route tells it whether the window is
rolling (the minute) or fixed (the date-stamped daily keys). Counters are shared across function
instances. Production and preview counter namespaces are separate. A limit
reached returns 429 and Retry-After; either daily refusal points to the next UTC day.
These are request allowances, so initialization and discovery also count.

The free service has its own monthly quota (500,000 commands at setup).
[Upstash counts EVAL and its nested Redis commands](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs):
the current successful request uses six for the minute bucket and three for each
of the two daily buckets (a daily key's expiry is set once, by the first hit of
the day), twelve in all. That allows roughly 41,000 accepted requests per month
before other usage. Refused requests also consume commands: about four for a
minute refusal, eight for a per-client daily refusal and eleven for a global
daily refusal, which passes both per-client checks first. The
10,000/day application ceiling is not guaranteed sustainable daily capacity on
the free plan. It does
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

For product cumulative queries, only output endpoints count as cells; the monthly
inputs from January of `startYear` do not consume the output allowance. Ranking
retains default 10 / maximum 100 entries and considers the whole current roster,
with missing/incomplete histories explicitly excluded.

The byte ceiling, not the cell count, is what binds. The text representation
prints each value definition once, in a legend keyed by `definitionId`, not on
every row. Practical accepted cell counts depend on definitions and source
evidence; no fixed cell count guarantees byte acceptance. The final post-SDK
JSON-RPC result also passes the same 512 KiB wire guard, including modern metadata.
See `docs/superpowers/reviews/2026-10-01-mcp-upgrade-verification.md` and its linked
measurement JSON for recorded local costs, complete result sizes and limits.

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
- Connect real modern pinned/automatic and legacy SDK clients, compare the
  complete `tools/list` inventory with the registered tools, discover an entity, and query
  revenue, expenditure, ministries, municipal totals, debt, deficit, GDP,
  national sectors, regional economies, national/city inflation, and current
  product annual/cumulative inflation. Check per-city/per-measure available dates,
  percentage-point annual comparisons, full-roster rankings/exclusions and
  `get_sources`; validate complete outputs and both final wire budgets.
- Check missing values, invalid inputs, source narrowing, and a stale version.
- Verify rate enforcement with bounded test counters or a preview deployment;
  do not consume the global production quota for a load test.
- Open `/connect`, click `AI` from the homepage, verify mobile layout and copy
  controls, and check that the bulk fallback resolves.
- Inspect the post-release runtime error window. A successful build or hook
  alone is not proof the endpoint is live.

### Human application guidance and evidence boundary

Official documentation was checked **2026-10-17**. [OpenAI's Codex MCP guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
documents remote Streamable HTTP and shared configuration across desktop/CLI/IDE.
The documented app path is Settings → MCP servers → Add server, name/transport/URL,
then save/restart. Local `codex --version` reports **codex-cli 0.146.1** and
`codex login status` reports an existing ChatGPT login. Subsequent authenticated
[staged CLI acceptance](superpowers/reviews/2026-10-17-mcp-remediation-verification.md)
executed all 22 English/Georgian prompts in isolated, ephemeral read-only runs:
initially 16 passed/6 failed; six affected repeats yielded 4 passes/2 failures,
then the final two yielded 2 passes/0 failures.
These are staged observations, not one fresh clean 22-case run on the final build.
The selected model and negotiated protocol were not visible. Authenticated desktop,
Claude and ChatGPT acceptance, current desktop menus, and account/workspace
eligibility for those other application setups remain unverified.

[Claude's current remote-connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
documents remote connectors for Free/Pro/Max/Team/Enterprise, with one custom
connector on Free; organization owners manage workspace permissions. The individual
flow documented for Pro/Max is Customize → Connectors → Add → Add custom connector,
then name/URL/authentication and confirmation. Its official
[connected-services guidance](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)
then requires opening the conversation's **+ → Connectors** menu and switching on
the saved connector for that conversation. The two official pages differ slightly
on the creation menu; `/connect` retains its version-dependent-menu caveat.
Fiscal.ge itself requires no bearer
token or extra headers; the documented No sign in option applies to this public
server. Claude's authenticated application/version, personal eligibility, negotiated
protocol and one sourced question remain unverified. SDK compatibility is not proof
of an application's account access or menus.

`/connect` labels these steps as official guidance and links the primary guides.
After setup it points to the existing national-inflation example, whose latest
month comes from reviewed data and whose question asks for the original source
and limitations. It does not hardcode a release month.
Historical owner clickthroughs are earlier provenance, not current app proof.
Direct ChatGPT custom-connector setup remains unverified and is not advertised;
the page retains its separate web-reading prompt and static-file fallback. Future
human proof must record app/version, account eligibility, date, protocol and a
completed question citing Fiscal.ge's source/limitations, without collecting secrets.
The eleven paired English/Georgian prompts and review requirements live separately
from the 48 numerical references in
`apps/web/tests/factQuery/fixtures/mcpAssistantIntents.ts`. Record actual tool
selection, units, original citations, caveats, missingness, version consistency
and any required recovery in an authorized real client before marking a case
passed. Task 10 supplies the rubric; Task 12 owns execution. SDK/unit tests do not
establish assistant acceptance, and no acceptance prompts have been run by Task 10.

### Logs and privacy

Application logs use the allowlist in `lib/mcp/log.ts`: tool, data version,
response bytes, duration, outcome, and bounded error code. HTTP 200 tool errors
are logged as failures. Early refusals are counted too. Unknown caller-provided
tool and method names are recorded as fixed unknown labels, never echoed.

Do not log raw prompts, request bodies, invalid parameter strings, credentials,
addresses, or provider error text. The temporary hashed counter key is not an
application log field. The operating target is **14 days of detailed allowlisted
application events and 90 days of aggregates**. Vercel/Upstash infrastructure logs are separate;
do not claim providers never process request addresses.

**Observed 17 October 2026:** authenticated Vercel inspection confirmed production
`dpl_Erifm5Fm3H6i9s4kx5GKH9mmq5nh`, READY at
`4a55558aa7da5ef2197186b3ffab5d2ee0b68474`, for `geodata-ge` in
`durumakh-1974s-projects`. This is a dated observation, not the identity of a later
release. A deployment-scoped two-hour runtime query was refused with an explicit
Hobby **one-hour retention** limit. A 30-minute aggregate query without full-text
`/mcp` filtering succeeded but returned no groups; it proves query access, not
healthy MCP traffic. Application errors can be HTTP 200 and infrastructure `info`.
The project drains API returned 404; external retention and alert delivery remain
**unverified**, rather than proven absent. Smoke reports sample release checks and
do not satisfy continuous production-log retention.

The project owner assigns an operations maintainer to close this gap or explicitly
accept a different target. Until then, operational verification remains outstanding.
The current option is the accessible Vercel window, manual incident-evidence
preservation and **$0 incremental cost**; continuous capture and alerts are unproved.
First inspect any owner-identified, already-authorized destination, its retained
records and actual alert path. Older Hobby drains may be grandfathered; a failed
inspection is no reason to purchase a replacement.

### Proposed monitoring arrangement — owner decision pending

If no existing authorized arrangement meets the target, the minimum researched
alternative is Vercel Pro provider-side export of this project's production
function logs, without sampling, to a project-owned Better Stack HTTP source,
proposed name `fiscal-mcp-production`, Germany region. The actual source/ingestion
hostname and recipient have not been created or selected. No application log
shipping is added: MCP runtime networking remains limited to Upstash.
[Vercel Drains](https://vercel.com/docs/drains) requires Pro or Enterprise for new
drains and charges $0.50/GB export; Hobby/Pro Trial cannot create this path.
[Vercel Pro](https://vercel.com/pricing) starts at $20/month for one deploying seat,
plus usage; this is not a capped $20 bill.

As researched on 17 October, [Better Stack pricing](https://betterstack.com/pricing)
lists logs at $0.10/GB ingest and $0.05/GB-month retention, with standard queries
included; free logs last three days. Email/Slack appears in its personal free offer;
a monthly responder licence is $34 if needed. Do not assume personal eligibility
or custom retention is free. [EU metrics billing](https://betterstack.com/docs/logs/billing-for-metrics/)
includes 30 GB retained metrics, then $0.50/GB-month. Obtain an actual account quote
for 14-day logs, 90-day metrics, email alerts, limits and any minimum commitment
before approval; volume and account entitlement are unverified, so no total bill
is promised. No paid plan, destination, recipient, schedule or subscription is
authorized by this proposal.

Use the [documented Vercel integration](https://betterstack.com/docs/logs/vercel/log-drain/)
and configure both retentions explicitly. Parse only the existing application
allowlist plus an operational timestamp; discard other function messages and
provider envelope fields. Extract bounded tool/outcome/error counts, bytes and
duration aggregates that survive deletion of original logs. A provider drain
envelope may reach the vendor with request metadata before filtering: approval
must cover that processing. Vercel's IP-hiding setting is team-wide and needs its
own authorization. The application-event source must never retain raw bodies,
prompts, authorization, addresses, user agents or provider error text.

The project owner adopts cost, processing/retention and a real operations email
recipient. The operations maintainer configures and recovers delivery. Proposed
starting signals are three `internal_error` events in five minutes, two consecutive
failed bounded probes/repeated 503, quota review at 70%/90% of verified allowance,
and repeated latency over two seconds or twice a comparable baseline. These are
proposals, not validated norms. Ordinary expected bad-input refusals and sparse
legitimate traffic alone must not trigger outage alerts.

After authorization, prove the Vercel-to-destination path with a labelled drain
test and safe fixtures from an isolated test deployment/source. Three synthetic
internal failures (including an HTTP-200 tool error) must open one deduplicated
alert at the actual approved recipient; ordinary bad input must not. Healthy
fixtures must produce recovery after the configured window. Record rule/event
identities, timestamps, receipt, parser rejection and delivery failure handling;
direct sink injection alone does not prove Vercel delivery. Verify effective
14/90 settings and retained records, then observe raw expiry and aggregate survival
at their elapsed retention checkpoints. Backdated fixtures do not prove 90 days of
durability. Never inject faults or exhaust quota in production. Retention and
actual alert/recovery delivery must be demonstrated before operations is verified.

### Bounded release probe

From `apps/web`, use an explicit target and independently reviewed release identity:

```text
npx tsx scripts/smoke-mcp.ts --url <target-mcp-url> --expected-schema 1.6.0 --expected-data-version <reviewed-sha256> --output <existing-output-directory/report.json>
```

The operator command has no production default, authentication input, new secret
or schedule. HTTPS is required remotely; loopback HTTP is permitted for local
tests. It exits nonzero for a failed required check, wrong schema/data identity,
tool error inside HTTP 200, malformed output or failed expected refusal. Its
compact JSON stores only checks, validated identities, timings, statuses, sizes
and safe classifications; no query/response bodies, target addresses, tokens or
provider messages. Use an existing ignored output directory, not a public folder.
Run it as a standalone process: tool discovery temporarily replaces process-wide
`console.warn`, restores it in `finally`, and classifies an SDK warning
as a protocol failure. Do not embed this operator command in a concurrent server.

Pinned modern `2026-07-28` executes all 14 advertised required tools; automatic
modern and real legacy `2025-11-25` repeat the sourced historical Batumi answer,
city-filtered originals and stale-version refusal. The ranking checks share changes
in **percentage points**. Historical query values stay fixed; returned coverage is
validated against that query and the supplied release identity, allowing later
clean source vintages. Listing a tool alone is insufficient. The real-client
fixture measures **29 HTTP requests total**, including legacy initialization,
initialized notification and its refused optional GET. Closing stateless clients
aborts transport resources; it does not add a DELETE. Every transport uses one
counting fetch, including implicit requests/retries/cleanup: **request 31 is never
sent**. Any future compatibility expansion must use explicitly reported separate
runs if necessary. This is not a load test.

Calls run sequentially, at least 1.1 seconds apart, with a ten-second deadline
covering headers and body, no redirects and at most 512 KiB per response. A 429/503
stops every queued request and records bounded numeric Retry-After information.
The default probe fetches no publication/archive sample, preserving budget margin.
Verify provider READY/SHA separately: the probe's data identities do not establish
the production deployment commit by themselves.

For built-local proof, preserve build-time `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.
Set only the dedicated server process to `MCP_ENABLED=true`,
`MCP_RATE_LIMITER=memory`, `VERCEL_ENV=preview`, `VERCEL_URL=localhost:3100`;
confirm discovery succeeds before the full probe. This uses the existing local
Host allowance. Restore that process environment and stop its process tree after
verification; never loosen production guards or change production settings.

The data maintainer role separately reviews official CPI and product availability.
Proposed, **not yet owner-adopted**, targets are availability review within two
business days of publication and clean review/release within five business days
after every required original is available. Record incomplete sources, revisions
awaiting review or release blockers and a next review date. Scheduling and
notifications need a separately approved owner/channel; this runbook creates none.

Rollback restores the route and snapshot together. The Redis counters contain
no budget data and require no migration when a code release is rolled back.

## SEO and headers

- `apps/web/app/robots.ts` and `apps/web/app/sitemap.xml/route.ts` generate
  `/robots.txt` and `/sitemap.xml` at build time; the sitemap data and XML
  serializer live in `apps/web/lib/seo/sitemap.ts`. Each URL's `lastModified`
  is the newest `lastReviewedAt` of the data that page shows (a hub: of every
  dataset its cards read), and a page's Georgian and English URLs share it.
- Both pages set Georgian titles/descriptions, Open Graph tags, and canonical
  URLs; `metadataBase` comes from `resolveSiteUrl()`.
- Security headers (nosniff, `X-Frame-Options: DENY`, referrer policy,
  permissions policy) are set in `apps/web/next.config.ts` `headers()`;
  Vercel adds HSTS itself.
- Page data under `/page-data/` (`apps/web/lib/data/pageDataFiles.ts`): JSON a
  page fetches after load instead of carrying it in its HTML, today the
  inflation products runs and the categories' monthly runs. Each name carries a
  hash of its content, so the rule in `headers()` sends
  `Cache-Control: public, max-age=31536000, immutable` and
  `X-Robots-Tag: noindex`. `prebuild` writes the files and reads them back
  (`data:prepare-inflation-public`; `data:check-inflation-public` repeats that
  check on its own); they are not publications and appear in no manifest,
  `llms.txt` or sitemap.
- Every response also carries a `Content-Security-Policy-Report-Only` header
  (the `contentSecurityPolicy` constant in `apps/web/next.config.ts`): only the
  site itself, plus Google Analytics (`www.googletagmanager.com`,
  `*.google-analytics.com`, `*.analytics.google.com`) and Microsoft Clarity
  (`*.clarity.ms`, `c.bing.com`) as loaded by
  `apps/web/components/site/site-analytics.tsx`, with `frame-ancestors 'none'`,
  `object-src 'none'` and `base-uri 'self'`. It is report-only so a missed
  source cannot break a page: browsers block nothing and print each violation
  in the console as `[Report Only] Refused to …` (an info message). There is no
  `report-uri`, because a collecting endpoint would be a second request-time
  route, so watch the console on production pages. Pages are prerendered, so
  Next.js's inline scripts cannot carry a per-request nonce and `script-src`
  allows `'unsafe-inline'`; the policy therefore limits where scripts, images
  and connections may come from and who may frame the site, but does not stop
  an injected inline script. To enforce it, as a separate decision: confirm the
  production console shows no reports on the landing page, an explorer page, a
  methodology page and an Excel download in both languages, with analytics
  loaded (judge this on the production domain: preview deployments also load
  the Vercel toolbar from `vercel.live`, which shows up as reports there and is
  not a site problem); keep the enforced site-wide policy off the archived
  originals under `/downloads/methodology/:dataset/files/` by giving the
  `/(.*)` source a negative lookahead for that path. This matters because while the policy is
  report-only the archive rule's enforcing `sandbox; default-src 'none'` header
  has a different key and is sent alongside it, but once both rules set
  `Content-Security-Policy` Next.js keeps only the later rule's value, and the
  site-wide rule comes later today, so it would silently replace the sandbox.
  Keeping it off the archive also keeps `object-src 'none'` away from the
  archived PDFs, which must still open in the browser's viewer. Then rename the
  header key to `Content-Security-Policy`, update
  `tests/seo/nextConfig.test.ts`, and confirm with `curl -sI` that a non-PDF
  archive file still receives the sandbox policy.


## Dataset release checks

### National sectors release checks

For the sectors release, require the Actions-owned pipeline to apply `20260912000000_economic_sectors`, import all 987 exact-decimal observations with parity, and pass the database-mode build before triggering Vercel. Preserve the already deployed inflation migration and import in the combined release. After Vercel is READY at the merge commit, verify both language sector pages, methodology/originals, all three measures and native Excel downloads. Check the central sector CSV/JSON against their manifest hashes and exercise `query_economic_sectors`, including missing 2010 growth and the bilingual stale-version error. Source-exact sector GDP may differ in the final decimal digits from the unchanged GDP overview representation; the sector validation report documents the difference. Local preview checks do not establish production delivery.

### GDP release checks

The Economy/GDP addition has 94 bilingual page identities (188 sitemap URLs), ten MCP tools including `query_gdp`, and seven datasets. It adds `gdp-overview.json` and `gdp-overview.csv` to the central publication manifest. Before release, validate all six GDP series against their source data, confirm exact CSV/database parity and source-status semantics, and check both language overview/methodology pages. Apply the GDP migration through the existing pipeline only; verify the deployed commit and a real `query_gdp` response after deployment. Growth MCP values are percent, not fractions; preliminary values are not forecasts or planned budgets.

For an authorized GDP release, require the pipeline to apply `20260911000000_gdp_overview`, import 251 GDP observations with field parity, and pass the database-mode build before triggering Vercel. After the deployment is READY at the merged SHA, verify the Georgian and English Economy hub, GDP overview and GDP methodology URLs; all four tabs and summaries; nominal GEL/USD controls; and a native Excel download in each language. Check the overview Dataset metadata and all six route URLs in the sitemap. Query all six GDP series for 2025 and one early real-GDP year through the live MCP endpoint, verify original-source links, and compare the public GDP JSON/CSV bytes with their central manifest hashes. These live checks are separate from local disposable-database evidence and do not establish search indexing.

### Inflation MCP release checks

The inflation MCP addition (`docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`) brings the endpoint to twelve tools with `query_inflation`, moves the schema to 1.2.0 (an additive `period` on monthly observations, comparison endpoints and ranking entries), and adds `inflation-national.json`, `inflation-categories.csv` and `inflation-categories.json` to the manifest. The packaged snapshot grows from about 4.4 MB to about 15.5 MB, measured on 2026-09-14, most of it the monthly category table. After deployment, verify the deployed commit; that `tools/list` on `https://fiscal.ge/mcp` includes `query_inflation`; one real call each of `query_inflation`, `compare` with an inflation target and `rank` with `datasetId: "inflation"`; and that the three files are served with the manifest's hashes.

### Regional economies release checks

The regional-economies addition (`docs/superpowers/specs/2026-09-13-regional-economies-design.md`) brings the endpoint to thirteen tools with `query_regional_economies`, moves the schema to 1.3.0, and adds `regional-economies.json` and `regional-economies.csv` to the manifest. After deployment, verify the deployed commit; both language route families; one real `query_regional_economies` call for Imereti nominal GDP and one sector share; and both files against the manifest hashes.

### Demography release checks

For the demography release, require the Actions-owned pipeline to apply `20261008100000_demography`, replace the 1,068 `DemographyFact` rows (923 population, 145 density) with parity checked inside the import transaction, and pass the database-mode build before triggering Vercel; the workflow log must show `[OK ] DemographyFact: csv=1068 db=1068`. CI has no Postgres and the database-backed demography tests skip without `GEODATA_TEST_DATABASE_URL`, so this deploy is the first real run of the migration, the table and the import step: none of them has been exercised against a database before this release. An optional rehearsal beforehand: point `GEODATA_TEST_DATABASE_URL` at a disposable local PostgreSQL database (never production; the test refuses any other host; on a plain PostgreSQL, create two empty roles named `anon` and `authenticated` first, because the migrations from `20260911000000_gdp_overview` on, the demography one included, revoke table access from those two Supabase roles (all but `20260917000000_government_debt_source_document`, which adds a foreign key and revokes nothing) and nothing in the repository creates them), apply the migrations and run the import against it as in the manual fallback of `docs/data-methodology/database-import.md` (`npm run prisma:deploy`, then `npm run data:import`, with `DATABASE_URL` and `DIRECT_URL` set to that database for the two commands), run `npx vitest run tests/data/demography/importIntegration.test.ts`, then do one `GEODATA_DATA_SOURCE=db npm run build` against the same database. After Vercel is READY at the merge commit, open the demography hub (`/explorer/demography`), the Population index (`/explorer/demography/population`), one place page (for example `/explorer/demography/population/batumi`) and the methodology page (`/methodology/demography`) in Georgian and under `/en`, follow one original-source link, and download a native Excel workbook from the place page in each language (the index has no download), checking that the Summary sheet's 2025 header shows both the year and the re-base label. The place pages are a closed set of 75 (Georgia, the 11 regions and the 63 municipalities other than Tbilisi), so also open Tbilisi from the index map and expect `/explorer/demography/population/region/tbilisi`, and expect `/explorer/demography/population/tbilisi` and any other address outside the set to return 404. Demography has no `/mcp` tool, catalogue dataset or central JSON/CSV file, so the MCP and central-manifest checks above do not apply; the methodology archive smoke test does.

For the Migration release there is no new demography migration: the Population release (a7b24bd8) applied `20261008100000_demography`, and Trade partners (50ffb869, with `20261008233336_trade_partners`) was live on 2026-10-09, so this deploy normally applies none (if a later release is not yet live when it ships, its migrations run first, as usual), and the import replaces `DemographyFact` with 2,846 rows (923 population, 145 density, 1,778 migration) and the workflow log must show `[OK ] DemographyFact: csv=2846 db=2846`. After Vercel is READY, open `/explorer/demography/migration` and `/en/explorer/demography/migration`, check that the hub links two pages, download the workbook in each language, and open the two new originals (tables 31 and 33) on `/methodology/demography`.

For the Births, deaths and fertility release there is again no new demography migration, and the import replaces `DemographyFact` with 5,525 rows (2,846 as before, 2,595 vital events, 84 age-specific fertility rates); the workflow log must show `[OK ] DemographyFact: csv=5525 db=5525`. After Vercel is READY, open `/explorer/demography/births-deaths` and `/en/explorer/demography/births-deaths` (the ranked places, Georgia 85 births per 100 deaths in 2025, the fertility and life-expectancy blocks), open one place page's `#births-deaths` section in each language (for example Imereti, which shows 4,275 births and 7,197 deaths for 2025), download the section's workbook and the national page's two workbooks, check that the hub links three pages, and open the eight new originals (tables 09, 15, 16, 19, 24, 25, 28 and 29) on `/methodology/demography`.

For the Age and sex release there is again no new demography migration, and the import replaces `DemographyFact` with 9,740 rows (5,525 as before, 1,587 age-structure and 2,628 census rows); the workflow log must show `[OK ] DemographyFact: csv=9740 db=9740`. After Vercel is READY, open `/explorer/demography/age-sex` and `/en/explorer/demography/age-sex` (the pyramid opens first, the heat map follows, and the regional glance at the foot ranks Racha-Lechkhumi and Kvemo Svaneti first at 31.2% aged 65+ with no region linking anywhere; the pyramid opens on 2026 with 18.1% aged 65+, and the 2025 option of the Year menu carries the census label, and the Compared with menu starts on None), open one place page's `#age-sex` section in each language (Imereti's page shows 510,741 people counted) and confirm a municipality's page has none, download the section's workbook and the national page's two workbooks (pyramid and heat map), check that the hub links four pages, and open the two new originals (population on 1 January by five-year age group and sex, and the 2024 census by age and settlement) on `/methodology/demography`.

### Wages release checks

For the Wages release, require the Actions-owned pipeline to apply `20261010060000_wages` and fill `WagesFact` with the 1,929 rows of `data/imports/wages-annual.csv` (1,917 published values and 12 unavailable cells), with parity checked inside the import transaction, and pass the database-mode build before triggering Vercel. CI has no Postgres, so this deploy is the first real run of the wages migration and import. After Vercel is READY, open `/explorer/wages`, `/explorer/wages/overview` (2025 Georgia average 2,165.2 GEL), `/explorer/wages/industries`, `/explorer/wages/regions`, one region page (for example `/explorer/wages/regions/adjara`) and `/methodology/wages` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Wages has no `/mcp` tool or central JSON/CSV file.

### Current account release checks

For the Current account release, require the Actions-owned pipeline to apply `20261010160000_current_account` and fill `CurrentAccountFact` with the 390 rows of `data/imports/current-account-annual.csv` (five series, credit, debit and net, 2000–2025), with parity checked inside the import transaction; the workflow log must show `[OK ] CurrentAccountFact: csv=390 db=390`. CI has no Postgres, so this deploy is the first real run of the migration and import. After Vercel is READY, open `/explorer/external`, `/explorer/external/current-account` (2025 balance −1.12 billion USD, −2.9% of GDP) and `/methodology/external-flows` in Georgian and under `/en`, and download one workbook in each language. Current account has no `/mcp` tool or central JSON/CSV file.

### Poverty and inequality release checks

For the Poverty and inequality release, require the Actions-owned pipeline to apply `20261010180000_poverty` and fill `PovertyFact` with the 491 rows of `data/imports/poverty-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] PovertyFact: csv=491 db=491`), and pass the database-mode build before triggering Vercel. CI has no Postgres, so this deploy is the first real run of the poverty migration and import. After Vercel is READY, open `/explorer/living-standards`, `/explorer/living-standards/poverty` (2025 poverty-line rate 7.1%, then the Relative poverty and International lines tabs), `/explorer/living-standards/inequality` (2025 Gini by total income 0.34) and `/methodology/poverty` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Poverty has no `/mcp` tool or central JSON/CSV file.

### Living standards release checks

For the Living standards release, require the Actions-owned pipeline to apply `20261012090000_household_income_spending` and fill `HouseholdIncomeSpendingFact` with the 10,638 rows of `data/imports/household-income-spending-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] HouseholdIncomeSpendingFact: csv=10638 db=10638`), and pass the database-mode build before triggering Vercel. CI has no Postgres, so this deploy is the first real run of the household migration and import. After Vercel is READY, open `/explorer/living-standards`, `/explorer/living-standards/income` (2025 Georgia total income per household 2,025.8 ₾ and the per person switch recolouring the map, then Georgia in the list opening `/explorer/living-standards/income/regions/georgia` with years from 2002 and Towns ticked, and a region on the map and one in the list each opening its own page, such as `/explorer/living-standards/income/regions/guria` with years from 2019), `/explorer/living-standards/spending` (2025 consumption spending per household 1,438.7 ₾) and `/methodology/household-income` in Georgian and under `/en`, download one workbook in each language from Income or Spending, and open one original Geostat workbook from the methodology page. Confirm that `/explorer/poverty`, `/explorer/poverty/rates` and `/explorer/poverty/inequality` (and their `/en` twins) answer with a permanent redirect to the hub, Poverty and Inequality. Household income and spending has no `/mcp` tool or central JSON/CSV file.

### Energy and food release checks

For the Energy and food release, require the Actions-owned pipeline to apply `20261011120000_energy_food` (RLS on, public grants revoked) and fill `EnergyFoodFact` with the 681 rows of `data/imports/energy-food-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] EnergyFoodFact: csv=681 db=681`), and pass the database-mode build before triggering Vercel. CI has no Postgres, so this deploy is the first real run of the energy and food migration and import. After Vercel is READY, open `/explorer/energy-food`, `/explorer/energy-food/energy-supply` (2024 domestic supply 5,914.5 thousand tonnes of oil equivalent), `/explorer/energy-food/electricity` (2024 production 14,234.1 GWh), `/explorer/energy-food/energy-use`, `/explorer/energy-food/food-self-sufficiency` (2025 wheat 19%) and `/methodology/energy-food` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Energy and food has no `/mcp` tool or central JSON/CSV file.

### Farming release checks

The Farming page adds 708 rows to `EnergyFoodFact` and needs no migration. Require the pipeline's import to fill the table with the 1,389 rows of `data/imports/energy-food-annual.csv` (the workflow log must show `[OK ] EnergyFoodFact: csv=1389 db=1389`); the 13 `source.geostat_farming_*` and `source.geostat_agriculture_page` rows of `data/sources/source-documents.csv` arrive in the same import. After Vercel is READY, open `/explorer/energy-food` (five cards), `/explorer/energy-food/farming` (2025 farm output 8,384.9 million ₾) and `/methodology/energy-food` in Georgian and under `/en`, download one Farming workbook in each language, and open one original Geostat agriculture workbook from the methodology page.

### Health release checks

For the Health release, require the Actions-owned pipeline to apply `20261016140000_health` (RLS on, public grants revoked) and fill `HealthFact` with the 4,204 rows of `data/imports/health-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] HealthFact: csv=4204 db=4204`), and pass the database-mode build before triggering Vercel. The 36 `source.geostat_health_*` and `source.geostat_death*` rows of `data/sources/source-documents.csv` arrive in the same import. CI has no Postgres, so this deploy is the first real run of the health migration and import. After Vercel is READY, open `/explorer/health`, `/explorer/health/doctors-hospitals` (2025 doctors 22,491), `/explorer/health/illnesses`, `/explorer/health/causes-of-death`, `/explorer/health/causes-of-death/regions/guria` (2025 deaths 1,567) and `/methodology/health` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Health has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

### Crime and justice release checks

For the Crime and justice release, require the Actions-owned pipeline to apply `20261016210000_crime` (RLS on, public grants revoked) and fill `CrimeFact` with the 1,262 rows of `data/imports/crime-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] CrimeFact: csv=1262 db=1262`), and pass the database-mode build before triggering Vercel. The 22 `source.geostat_crime_*` rows of `data/sources/source-documents.csv` arrive in the same import. CI has no Postgres, so this deploy is the first real run of the crime migration and import. After Vercel is READY, open `/explorer/crime`, `/explorer/crime/recorded` (2025 recorded crimes 54,134), `/explorer/crime/convictions` (2025 convicts 22,767), `/explorer/crime/prisons` (2025 prison population 11,153), `/explorer/crime/victims` (2025 victims 17,209), `/explorer/crime/road-accidents` (2025 accidents 5,969) and `/methodology/crime` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Crime and justice has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

### Money and banks release checks

For the Money and banks release, require the Actions-owned pipeline to apply `20261011130000_money_banks` and fill `MoneyBanksFact` with the 730 rows of `data/imports/money-banks-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] MoneyBanksFact: csv=730 db=730`; 730 is the expected count, to be confirmed by that first run), and pass the database-mode build before triggering Vercel. CI has no Postgres, so this deploy is the first real run of the money migration and import. After Vercel is READY, open `/explorer/money`, `/explorer/money/supply` (2025 broad money 57.7 billion GEL), `/explorer/money/loans-deposits` (2025 bank loans 72.5 billion GEL with deposits beside them, then the foreign-currency share icon), `/explorer/money/interest-rates` (2025 National Bank rate 8.00%), `/explorer/money/bank-health` (2025 bad loans 2.5% of all loans) and `/methodology/money` in Georgian and under `/en`, download one workbook in each language, and open one original NBG workbook from the methodology page. Money and banks has no `/mcp` tool or central JSON/CSV file.

### Foreign debt and reserves release checks

For the Foreign debt and Reserves release, require the Actions-owned pipeline to apply `20261015120000_external_position` (RLS on, public grants revoked) and fill `ExternalPositionFact` with the 254 rows of `data/imports/external-position-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] ExternalPositionFact: csv=254 db=254`), and pass the database-mode build before triggering Vercel. CI has no Postgres, so this deploy is the first real run of the external position migration and import. After Vercel is READY, open `/explorer/external/foreign-debt` (2025 gross external debt 27.0 billion USD, with the 2026-06-30 point as the latest) and `/explorer/external/reserves` (2025 official reserve assets 6.2 billion USD, with the 2026-09-30 point as the latest) in Georgian and under `/en`, and download one workbook from each page in each language. Foreign debt and Reserves have no `/mcp` tool or central JSON/CSV file.

### Business release checks

For the Business release, require the Actions-owned pipeline to apply `20261015220000_business` (RLS on, public grants revoked) and fill `BusinessFact` with the 4,643 rows of `data/imports/business-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] BusinessFact: csv=4643 db=4643`), and pass the database-mode build before triggering Vercel. CI has no Postgres, so this deploy is the first real run of the business migration and import. After Vercel is READY, check the 2025 anchors on the Business pages in Georgian and under `/en`: turnover of all enterprises 253,725.5 million GEL and 899,026 persons employed. Business has no `/mcp` tool or central JSON/CSV file.

### Housing release checks

For the Housing release, require the Actions-owned pipeline to apply `20261016200000_housing` (RLS on, public grants revoked) and fill `HousingFact` with the 3,222 rows of `data/imports/housing-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] HousingFact: csv=3222 db=3222`), and pass the database-mode build before triggering Vercel. The 21 `source.geostat_housing_*` rows of `data/sources/source-documents.csv` arrive in the same import. CI has no Postgres, so this deploy is the first real run of the housing migration and import. After Vercel is READY, check the 2025 anchors on the Housing pages in Georgian and under `/en`: 11,578 permits granted covering 11,397,190 square metres and a residential price index of 159.4 (2020 average = 100); open `/methodology/housing` in both languages, download one workbook in each language, and open one original Geostat workbook from the methodology page. Housing has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

### Education release checks

For the Education release, require the Actions-owned pipeline to apply `20261016220000_education` (RLS on, public grants revoked) and fill `EducationFact` with the 8,815 rows of `data/imports/education-annual.csv` (170 of them hidden old vocational fields), with parity checked inside the import transaction (the workflow log must show `[OK ] EducationFact: csv=8815 db=8815`), and pass the database-mode build before triggering Vercel. The 46 `source.geostat_education_*` rows of `data/sources/source-documents.csv` arrive in the same import. CI has no Postgres, so this deploy is the first real run of the education migration and import. After Vercel is READY, check the 2025/26 anchors on the Education pages in Georgian and under `/en`: 2,292 schools and 644.2 thousand pupils in Georgia. Open `/methodology/education` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Education has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

### Social protection release checks

For the Social protection release, require the Actions-owned pipeline to apply `20261020190000_social` (RLS on, public grants revoked) and fill `SocialFact` with the 22,087 rows of `data/imports/social-protection-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] SocialFact: csv=22087 db=22087`), and pass the database-mode build before triggering Vercel. The 25 `source.ssa_*` rows and the 6 `source.pension_fund_*` rows of `data/sources/source-documents.csv` arrive in the same import. CI has no Postgres, so this deploy is the first real run of the social migration and import. After Vercel is READY, check the 2025 anchors on the Social protection pages in Georgian and under `/en`: 888,518 pensioners and an average pension of 405.13 GEL a month in Georgia, and 6,166.1 million GEL in all social payments. Social protection has no `/mcp` tool or central JSON/CSV file, its counting-change register `social-protection-series-breaks.csv` is read from the CSV and not mirrored, and its sources stay out of the fact-query snapshot.

### Funded pension release checks

The Funded pension page ships with the Social protection release: its 99 rows are part of the 22,087 `SocialFact` rows, and the workflow log must show `[OK ] SocialFact: csv=22087 db=22087`. After Vercel is READY, check `/explorer/health/funded-pension` and `/en/explorer/health/funded-pension`: the latest line reads `2025: 8.24 billion GEL in pension savings` (Georgian `2025: 8.24 მლრდ ლარი საპენსიო დანაზოგში`), and the eighth card of the Health and social protection hub shows `2025 · 8,237.5 million GEL · 2019–2025`. Download one workbook in each language and open `/methodology/social-protection` in both. The page has no `/mcp` tool or central JSON/CSV file, and the Pension Fund sources stay out of the fact-query snapshot.

### GDP by expenditure release checks

For the GDP by expenditure release, require the Actions-owned pipeline to apply `20261020100000_gdp_expenditure` (RLS on, public grants revoked) and fill `GdpExpenditureFact` with the 722 rows of `data/imports/gdp-expenditure-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] GdpExpenditureFact: csv=722 db=722`), and pass the database-mode build before triggering Vercel. The three `source.geostat_gdp_use_*` rows of `data/sources/source-documents.csv` arrive in the same import. After Vercel is READY, check `/explorer/economy/expenditure` in Georgian and under `/en`: GDP 2025 104.6 billion GEL and households 72.3 billion GEL (69.1% of GDP); open `/methodology/gdp-expenditure` in both languages and download one workbook. The page has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

For the Spending by type release, require the Actions-owned pipeline to apply `20261021120000_expenditure_types` (RLS on, public grants revoked) and fill `ExpenditureTypeFact` with the 480 rows of `data/imports/expenditure-types-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] ExpenditureTypeFact: csv=480 db=480`), and pass the database-mode build before triggering Vercel. The `source.mof_gfs_general_government_2002_2025` row of `data/sources/source-documents.csv` arrives in the same import. After Vercel is READY, check `/explorer/expenditure-types` in Georgian and under `/en`: total spending 2025 29.7 billion GEL (28.4% of GDP) and social benefits 9.1 billion GEL; open `/methodology/expenditure-types` in both languages and download one workbook. The page has no `/mcp` tool or central JSON/CSV file, and its source stays out of the fact-query snapshot.

The same release applies `20261021180000_municipal_population_precision`, which widens `MunicipalPopulationFact.populationThousand` from one to three decimals. PR #211 started serving Geostat's stored three-decimal thousands; its own release (Deploy production run 39654819490) failed the import parity check because the column rounded them to one decimal (`row 2025:04 differs: csv … 1335.671 … db … 1335.7`). Nothing reached production, since the import transaction rolled back. After this release the workflow log must show the municipal population parity line as `[OK ]`.

### Science and culture release checks

For the Science and culture release, require the Actions-owned pipeline to apply `20261020090000_science_culture` (RLS on, public grants revoked) and fill `ScienceCultureFact` with the 1,733 rows of `data/imports/science-culture-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] ScienceCultureFact: csv=1733 db=1733`), and pass the database-mode build before triggering Vercel. The 33 `source.geostat_*` rows for the science and culture archive (`docs/Raw Data/ScienceCulture/`) of `data/sources/source-documents.csv` arrive in the same import. The counting-change register `science-culture-series-breaks.csv` is read from the CSV and not mirrored. CI has no Postgres, so this deploy is the first real run of the science and culture migration and import. After Vercel is READY, check the 2024 and 2025 anchors on the Science and culture pages in Georgian and under `/en`: 14,046 researchers in 2024 and 1,998.9 thousand museum visitors in 2025. Open `/methodology/science-culture` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Science and culture has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

### Internet release checks

For the Internet and technology release, require the Actions-owned pipeline to apply `20261020180000_internet` (RLS on, public grants revoked) and fill `InternetFact` with the 1,055 rows of `data/imports/internet-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] InternetFact: csv=1055 db=1055`), and pass the database-mode build before triggering Vercel. The 36 `source.geostat_ict_*` rows of `data/sources/source-documents.csv` arrive in the same import. CI has no Postgres, so this deploy is the first real run of the internet migration and import. After Vercel is READY, check the 2026 anchors on the Internet and technology pages in Georgian and under `/en`: 93.5% of homes have internet, 89.6% used the internet in the last 3 months and 93.3% own a mobile phone; open `/methodology/internet` in both languages, download one workbook in each language, and open one original Geostat workbook from the methodology page. The hub has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

### Transport release checks

For the Transport release, require the Actions-owned pipeline to apply `20261020120000_transport` (RLS on, public grants revoked) and fill `TransportFact` with the 4,301 rows of `data/imports/transport-annual.csv`, with parity checked inside the import transaction (the workflow log must show `[OK ] TransportFact: csv=4301 db=4301`), and pass the database-mode build before triggering Vercel. The 25 `source.geostat_transport_*` rows of `data/sources/source-documents.csv` arrive in the same import. CI has no Postgres, so this deploy is the first real run of the transport migration and import. After Vercel is READY, check the 2025 anchors on the Transport pages in Georgian and under `/en`: 1,650.0 thousand passenger cars, 11,262.1 million passenger-km and 1,914.9 thousand registered vehicles in Georgia. Open `/methodology/transport` in Georgian and under `/en`, download one workbook in each language, and open one original Geostat workbook from the methodology page. Transport has no `/mcp` tool or central JSON/CSV file, and its sources stay out of the fact-query snapshot.

### When a release step fails

A failing step stops the job before the deploy hook, so Vercel builds nothing and production keeps serving its previous deploy. A failed import rolls back completely: fix the cause and rerun *Deploy production*. A migration that fails while running is recorded by Prisma as failed, and every later run then stops at `prisma:deploy` with P3009 until `npx prisma migrate resolve --rolled-back 20261008100000_demography` (after removing any half-made table; `--applied` only if the table was completed by hand) is run from `apps/web` with `DIRECT_URL` set. To undo a release use Vercel's Instant Rollback (see Manual operations), not a git revert of the merge: the reverted importer no longer deletes `DemographyFact`, so its `SourceDocument` delete hits the table's `ON DELETE RESTRICT` foreign key and every later deploy fails at the import until someone empties the table by hand. After a rollback Vercel stops assigning new production deployments to the domain until one is promoted (for example with `vercel promote`).
