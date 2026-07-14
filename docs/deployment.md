# Deployment (Vercel)

The site is a fully static Next.js build served by Vercel. This doc records the
project configuration and the operational workflows: automatic deploys,
manual deploys/rollback, environment variables, and connecting the custom
domain.

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
| Environment variables | None required — the default CSV-mode build reads `data/imports/` from the repo checkout |

The repo clone on the build machine includes the repo root, so the build can
read `data/` via the `../../` relative paths in `apps/web/lib/data/servedData.ts`.
Every route (`/`, `/explorer`, `/robots.txt`, `/sitemap.xml`, the 404 page) is
prerendered at build time; nothing runs server-side at request time.

## How deploys happen

- **Production**: every push to `main` triggers a production deploy.
  Repo policy still applies: merge to `main` only with green CI
  (`.github/workflows/ci.yml`). Vercel builds run independently of CI, so a
  red-CI push to `main` would still deploy — don't push directly to `main`.
- **Previews**: every push to any other branch (and every PR) gets its own
  preview deployment; the URL is posted on the PR by the Vercel GitHub app.
  Preview deployments are automatically `noindex`ed by Vercel.

## Manual operations (Vercel CLI)

Requires a recent CLI (`npm i -g vercel@latest`; v52 fails with a stale-token
error — updating fixes auth) and `vercel login` as the project owner. Run from
the repo root; `vercel link --repo` links the checkout to the `geodata-ge`
project.

- Inspect production: `vercel inspect https://geodata-ge.vercel.app --logs`
- List deployments: `vercel ls geodata-ge`
- Manual production deploy from local checkout: `vercel deploy --prod`
  (normally unnecessary — push to `main` instead)
- Rollback: `vercel rollback` (or dashboard → Deployments → ⋯ → *Instant Rollback*)

## Environment variables

None are required for the default CSV-mode build.

- **DB-mode builds** (planned production mode; see
  `docs/data-methodology/database-import.md`): set `DATABASE_URL` (pooled,
  port 6543) and `GEODATA_DATA_SOURCE=db` in the Vercel project → Settings →
  Environment Variables (Production). The build then renders from the Supabase
  mirror and re-verifies it row-by-row against the checkout's CSVs.
- **`NEXT_PUBLIC_SITE_URL`** (optional): overrides the canonical site origin
  used in Open Graph URLs, canonicals, `robots.txt`, and `sitemap.xml`
  (`apps/web/lib/siteUrl.ts`). Normally unset — the build uses Vercel's
  `VERCEL_PROJECT_PRODUCTION_URL`, which automatically becomes the custom
  domain once one is attached.

## Connecting the custom domain (owner steps)

1. Buy the domain at any registrar.
2. Vercel dashboard → `geodata-ge` → Settings → Domains → *Add* → enter the
   apex domain (e.g. `geodata.ge`). Also add `www.<domain>` and set it to
   redirect to the apex (Vercel offers this in the add-domain flow).
3. Configure DNS at the registrar exactly as the Domains page instructs
   (either an `A`/`CNAME` record pair or switching nameservers to Vercel).
   Vercel provisions TLS automatically once DNS propagates.
4. After the domain shows **Valid Configuration**, trigger one redeploy of
   production (dashboard → Deployments → ⋯ → *Redeploy*, or push to `main`) so
   canonicals, `robots.txt`, and `sitemap.xml` pick up the new domain via
   `VERCEL_PROJECT_PRODUCTION_URL`.
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
