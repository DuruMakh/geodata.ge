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
| Production URL | https://geodata-ge.vercel.app (until the custom domain is attached) |
| Git repository | `github.com/DuruMakh/geodata.ge` (git-connected) |
| Root Directory | `apps/web` |
| Framework preset | Next.js (default build/install commands) |
| Node.js | 24.x (also pinned via `engines` in `apps/web/package.json`) |
| Environment variables | Production: `DATABASE_URL` + `GEODATA_DATA_SOURCE=db` (see Environment variables below); previews/dev: none — CSV-mode builds read `data/imports/` from the repo checkout |

The repo clone on the build machine includes the repo root, so the build can
read `data/` via the `../../` relative paths in `apps/web/lib/data/servedData.ts`.
Every route (`/`, `/explorer`, `/explorer/expenditure`, `/explorer/revenue`,
`/explorer/analysis`, `/robots.txt`, `/sitemap.xml`, the 404 page) is
prerendered at build time; nothing runs server-side at request time.

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
  3. it POSTs the Vercel deploy hook, and Vercel builds latest `main` with
     `GEODATA_DATA_SOURCE=db`, re-verifying the mirror row-by-row during the
     build.
  A failure at any step leaves production serving its previous deploy, and a
  red `main` blocks production updates by design. The workflow's manual
  trigger (Actions → *Deploy production* → *Run workflow*) is the
  "import + redeploy" escape hatch.
- **Previews**: unchanged — every push to any other branch (and every PR)
  gets its own preview deployment, always CSV-mode (the database env vars
  are scoped to Production only), so data-PR previews never depend on the
  mirror. Preview deployments are automatically `noindex`ed by Vercel.

## Manual operations (Vercel CLI)

Requires a recent CLI (`npm i -g vercel@latest`; v52 fails with a stale-token
error — updating fixes auth) and `vercel login` as the project owner. Run from
the repo root; `vercel link --repo` links the checkout to the `geodata-ge`
project.

- Inspect production: `vercel inspect https://geodata-ge.vercel.app --logs`
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
| `NEXT_PUBLIC_SITE_URL` | optional, normally unset | canonical site origin override (below) |

- The db-mode build renders from the mirror and re-verifies it row-by-row
  against the checkout's CSVs; see
  `docs/data-methodology/database-import.md`.
- **Break-glass CSV fallback**: set `GEODATA_DATA_SOURCE` to `csv` (or
  remove it) in Vercel → Settings → Environment Variables (Production) and
  redeploy; production then builds straight from the reviewed CSVs with no
  database involved. Both modes are guaranteed identical by the parity
  checks.
- **`NEXT_PUBLIC_SITE_URL`** (optional): overrides the canonical site origin
  used in Open Graph URLs, canonicals, `robots.txt`, and `sitemap.xml`
  (`apps/web/lib/siteUrl.ts`). Normally unset — the build uses Vercel's
  `VERCEL_PROJECT_PRODUCTION_URL`, which automatically becomes the custom
  domain once one is attached.

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
   apex domain (e.g. `geodata.ge`). Also add `www.<domain>` and set it to
   redirect to the apex (Vercel offers this in the add-domain flow).
3. Configure DNS at the registrar exactly as the Domains page instructs
   (either an `A`/`CNAME` record pair or switching nameservers to Vercel).
   Vercel provisions TLS automatically once DNS propagates.
4. After the domain shows **Valid Configuration**, trigger one redeploy of
   production (dashboard → Deployments → ⋯ → *Redeploy*, or Actions →
   *Deploy production* → *Run workflow*) so canonicals, `robots.txt`, and
   `sitemap.xml` pick up the new domain via `VERCEL_PROJECT_PRODUCTION_URL`.
5. `https://geodata-ge.vercel.app` keeps working as an alias; its pages point
   their canonical URLs at the custom domain, so search engines index only the
   domain.

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
