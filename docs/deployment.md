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
the sole request-time route; the older all-static description below predates MCP.

Data schema **1.5.0** includes current-product inflation and reviewed language
companions. The authoritative tool inventory is `tools/list`; dataset families
and coverage are in `catalogue.json`. `manifest.json` lists every publication
with row count, bytes and SHA-256; the manifest itself is one additional artifact,
not one of its listed files. Derive changing inventories from these owners rather
than retaining old fixed counts. Requests do not gain a language argument.
Clients must accept additive fields and data schema 1.5.0; byte-identical response
compatibility is not promised. Transport revisions are a separate contract:
modern `2026-07-28` and preserved legacy `2025-11-25` share the endpoint.
Translation changes alter `dataVersion`. Retain the existing body, cell, pair,
ranking, byte, duration, rate and pause limits. Large bilingual evidence responses
can require narrower queries; never trim evidence or increase limits to fit.

The existing `npm run check` includes translation validation; `prebuild` prepares
the snapshot/publications, and `postbuild` verifies publication hashes. Before
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
sessions or subscriptions. GET and DELETE remain 405. The data schema is 1.5.0,
independent of either protocol revision.
The legacy adapter also retains `2025-06-18`, `2025-03-26`, `2024-11-05` and
`2024-10-07`; the modern era is never proposed during legacy initialization.
There is no session store, model invocation, authentication, or write tool.

### Snapshot and network boundary

All MCP data answers use `apps/web/lib/factQuery/generated/snapshot.json`, prepared
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

The free service has its own monthly quota (500,000 commands at setup).
[Upstash counts EVAL and its nested Redis commands](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs):
the current successful request uses six for the minute bucket and four for the
daily bucket. That allows roughly 50,000 accepted requests per month before
other usage; refused requests also consume commands. The 10,000/day application
ceiling is not guaranteed sustainable daily capacity on the free plan. It does
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

Official documentation was checked **2026-10-02**. [OpenAI's Codex MCP guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
documents remote Streamable HTTP and shared configuration across desktop/CLI/IDE.
The documented app path is Settings → MCP servers → Add server, name/transport/URL,
then save/restart. [OpenAI's docs-MCP quickstart](https://developers.openai.com/learn/docs-mcp)
also documents `codex mcp add <name> --url <url>`. Local `codex --version` reports
**codex-cli 0.146.1**; that is executable-version evidence only. Current desktop
menus, account/plan eligibility, selected protocol and a completed sourced model
question were not tested. No configuration, login, credentials or model request
was touched.

[Claude's current remote-connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
documents remote connectors for Free/Pro/Max/Team/Enterprise, with one custom
connector on Free; organization owners manage workspace permissions. The individual
flow documented for Pro/Max is Customize → Connectors → Add → Add custom connector,
then name/URL/authentication and confirmation. Fiscal.ge itself requires no bearer
token or extra headers; the documented No sign in option applies to this public
server. Claude's authenticated application/version, personal eligibility, negotiated
protocol and one sourced question remain unverified. SDK compatibility is not proof
of an application's account access or menus.

`/connect` labels these steps as official guidance and links the primary guides.
Historical owner clickthroughs are earlier provenance, not current app proof.
Direct ChatGPT custom-connector setup remains unverified and is not advertised;
the page retains its separate web-reading prompt and static-file fallback. Future
human proof must record app/version, account eligibility, date, protocol and a
completed question citing Fiscal.ge's source/limitations, without collecting secrets.

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

- `apps/web/app/robots.ts` and `apps/web/app/sitemap.xml/route.ts` generate
  `/robots.txt` and `/sitemap.xml` at build time; the sitemap data and XML
  serializer live in `apps/web/lib/seo/sitemap.ts` (sitemap `lastModified`
  comes from the newest `lastReviewedAt` in `data/sources/source-documents.csv`).
- Both pages set Georgian titles/descriptions, Open Graph tags, and canonical
  URLs; `metadataBase` comes from `resolveSiteUrl()`.
- Security headers (nosniff, `X-Frame-Options: DENY`, referrer policy,
  permissions policy) are set in `apps/web/next.config.ts` `headers()`;
  Vercel adds HSTS itself. There is deliberately no Content-Security-Policy
  yet — adding one needs testing against the chart/canvas code first.


## GDP dataset release checks

### National sectors release checks

For the sectors release, require the Actions-owned pipeline to apply `20260912000000_economic_sectors`, import all 987 exact-decimal observations with parity, and pass the database-mode build before triggering Vercel. Preserve the already deployed inflation migration and import in the combined release. After Vercel is READY at the merge commit, verify both language sector pages, methodology/originals, all three measures and native Excel downloads. Check the central sector CSV/JSON against their manifest hashes and exercise `query_economic_sectors`, including missing 2010 growth and the bilingual stale-version error. Source-exact sector GDP may differ in the final decimal digits from the unchanged GDP overview representation; the sector validation report documents the difference. Local preview checks do not establish production delivery.

The Economy/GDP addition has 94 bilingual page identities (188 sitemap URLs), ten MCP tools including `query_gdp`, and seven datasets. It adds `gdp-overview.json` and `gdp-overview.csv` to the central publication manifest. Before release, validate all six GDP series against their source data, confirm exact CSV/database parity and source-status semantics, and check both language overview/methodology pages. Apply the GDP migration through the existing pipeline only; verify the deployed commit and a real `query_gdp` response after deployment. Growth MCP values are percent, not fractions; preliminary values are not forecasts or planned budgets.

The inflation MCP addition (`docs/superpowers/specs/2026-09-14-inflation-mcp-design.md`) brings the endpoint to twelve tools with `query_inflation`, moves the schema to 1.2.0 (an additive `period` on monthly observations, comparison endpoints and ranking entries), and adds `inflation-national.json`, `inflation-categories.csv` and `inflation-categories.json` to the manifest. The packaged snapshot grows from about 4.4 MB to about 15.5 MB, measured on 2026-09-14, most of it the monthly category table. After deployment, verify the deployed commit; that `tools/list` on `https://fiscal.ge/mcp` includes `query_inflation`; one real call each of `query_inflation`, `compare` with an inflation target and `rank` with `datasetId: "inflation"`; and that the three files are served with the manifest's hashes.

The regional-economies addition (`docs/superpowers/specs/2026-09-13-regional-economies-design.md`) brings the endpoint to thirteen tools with `query_regional_economies`, moves the schema to 1.3.0, and adds `regional-economies.json` and `regional-economies.csv` to the manifest. After deployment, verify the deployed commit; both language route families; one real `query_regional_economies` call for Imereti nominal GDP and one sector share; and both files against the manifest hashes.

For an authorized GDP release, require the pipeline to apply `20260911000000_gdp_overview`, import 251 GDP observations with field parity, and pass the database-mode build before triggering Vercel. After the deployment is READY at the merged SHA, verify the Georgian and English Economy hub, GDP overview and GDP methodology URLs; all four tabs and summaries; nominal GEL/USD controls; and a native Excel download in each language. Check the overview Dataset metadata and all six route URLs in the sitemap. Query all six GDP series for 2025 and one early real-GDP year through the live MCP endpoint, verify original-source links, and compare the public GDP JSON/CSV bytes with their central manifest hashes. These live checks are separate from local disposable-database evidence and do not establish search indexing.

### Demography release checks

For the demography release, require the Actions-owned pipeline to apply `20261008100000_demography`, replace the 1,068 `DemographyFact` rows (923 population, 145 density) with parity checked inside the import transaction, and pass the database-mode build before triggering Vercel; the workflow log must show `[OK ] DemographyFact: csv=1068 db=1068`. CI has no Postgres and the database-backed demography tests skip without `GEODATA_TEST_DATABASE_URL`, so this deploy is the first real run of the migration, the table and the import step: none of them has been exercised against a database before this release. An optional rehearsal beforehand: point `GEODATA_TEST_DATABASE_URL` at a disposable local PostgreSQL database (never production; the test refuses any other host; on a plain PostgreSQL, create two empty roles named `anon` and `authenticated` first, because the migrations from `20260911000000_gdp_overview` on, the demography one included, revoke table access from those two Supabase roles (all but `20260917000000_government_debt_source_document`, which adds a foreign key and revokes nothing) and nothing in the repository creates them), apply the migrations and run the import against it as in the manual fallback of `docs/data-methodology/database-import.md` (`npm run prisma:deploy`, then `npm run data:import`, with `DATABASE_URL` and `DIRECT_URL` set to that database for the two commands), run `npx vitest run tests/data/demography/importIntegration.test.ts`, then do one `GEODATA_DATA_SOURCE=db npm run build` against the same database. After Vercel is READY at the merge commit, open the demography hub (`/explorer/demography`), the Population index (`/explorer/demography/population`), one place page (for example `/explorer/demography/population/batumi`) and the methodology page (`/methodology/demography`) in Georgian and under `/en`, follow one original-source link, and download a native Excel workbook from the place page in each language (the index has no download), checking that the Summary sheet's 2025 header shows both the year and the re-base label. The place pages are a closed set of 75 (Georgia, the 11 regions and the 63 municipalities other than Tbilisi), so also open Tbilisi from the index map and expect `/explorer/demography/population/region/tbilisi`, and expect `/explorer/demography/population/tbilisi` and any other address outside the set to return 404. Demography has no `/mcp` tool, catalogue dataset or central JSON/CSV file, so the MCP and central-manifest checks above do not apply; the methodology archive smoke test does.

For the Migration release there is no new migration: the import replaces `DemographyFact` with 2,846 rows (923 population, 145 density, 1,778 migration) and the workflow log must show `[OK ] DemographyFact: csv=2846 db=2846`. After Vercel is READY, open `/explorer/demography/migration` and `/en/explorer/demography/migration`, check that the hub links two pages, download the workbook in each language, and open the two new originals (tables 31 and 33) on `/methodology/demography`.

A failing step stops the job before the deploy hook, so Vercel builds nothing and production keeps serving its previous deploy. A failed import rolls back completely: fix the cause and rerun *Deploy production*. A migration that fails while running is recorded by Prisma as failed, and every later run then stops at `prisma:deploy` with P3009 until `npx prisma migrate resolve --rolled-back 20261008100000_demography` (after removing any half-made table; `--applied` only if the table was completed by hand) is run from `apps/web` with `DIRECT_URL` set. To undo a release use Vercel's Instant Rollback (see Manual operations), not a git revert of the merge: the reverted importer no longer deletes `DemographyFact`, so its `SourceDocument` delete hits the table's `ON DELETE RESTRICT` foreign key and every later deploy fails at the import until someone empties the table by hand. After a rollback Vercel stops assigning new production deployments to the domain until one is promoted (for example with `vercel promote`).
