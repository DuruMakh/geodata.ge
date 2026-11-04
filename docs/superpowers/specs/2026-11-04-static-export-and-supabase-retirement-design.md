# Static export and Supabase retirement — design

Date: 2026-11-04. Status: draft for owner review.
Inputs: platform audit 2026-11-02 (P1 "every prerendered page is a billed ISR read"), re-review R3
(`/mnt/project-files/platform-audit-2026-11/re-review/R3-hosting-no-pro.md`, with its draft
`vercel.candidate.json`), owner answers in the audit thread.

## 1. Goal

Keep fiscal.ge on Vercel's free Hobby plan by serving every page as a plain file. Release the
site straight from the reviewed CSVs and retire the Supabase mirror.

What the owner said:

- No Vercel Pro. Avoid a paid plan if at all possible (2026-11-02).
- Retiring Supabase is fine "if it is doing nothing for us" (2026-11-02). The audit confirmed it
  changes no published number: every build already proves the mirror equals the CSVs row by row.
- Fast Origin Transfer is a second limit being hit, alongside ISR Reads (2026-11-04).
- "okay continue" to the static switch (2026-11-04).

Why this works. Next.js App Router pages are stored on Vercel as ISR objects even with
`revalidate: false`. Every CDN miss therefore costs ISR read units and Fast Origin Transfer.
A static export (`output: "export"`) deploys only static files, so both of those go to zero
for pages. CDN Requests and Fast Data Transfer are unchanged.

Success criteria:

1. Production pages answer without `x-nextjs-prerender`, and ISR Reads on the Usage page stay
   at about 0 after release. Fast Origin Transfer grows only by `/mcp` traffic.
2. Every public page, redirect and response header behaves as it does today. The exported HTML
   matches the current build for every page, apart from asset hashes.
3. `https://fiscal.ge/mcp` keeps its address, behaviour, limits and logging.
4. Releases no longer touch Supabase. No published number changes.
5. `npm run check`, `npm run build` and the full browser suite pass, with the suite run against
   the static output.

## 2. Two releases

| Release | Contents | Why separate |
|---|---|---|
| **1. Static site** | Static export, `/mcp` as a Vercel Function, generated `vercel.json`, static local server, and the release pipeline and Vercel build stop using Supabase. Docs. | The change that saves the money. Small enough to review and to roll back in one click in Vercel. |
| **2. Remove the database code** | Delete Prisma, `lib/db/`, the import script, migrations, per-dataset mirror-parity code and tests, the CI `mirror` job and the Prisma/pg dependencies. | About 100 files, almost all deletion, with no behaviour change. It is reviewed on its own and waits until release 1 has been live for a few days. |

Owner steps after release 2: delete the GitHub secrets `DIRECT_URL` and `DATABASE_URL`, then
pause the Supabase project. Delete the Supabase project after about 30 quiet days.

## 3. Release 1 design

### 3.1 Static export

- `next.config.ts` gets `output: "export"`.
  - `redirects()` and `headers()` move out (Next ignores them under export; see 3.2).
  - `outputFileTracingIncludes` and `outputFileTracingExcludes` are removed. They only shaped
    the Next.js server function, which no longer exists.
- `app/robots.ts` gets `export const dynamic = "force-static"`. This was the one build blocker
  besides `/mcp`.
- `app/mcp/` leaves `app/` (see 3.3).
- The build writes `apps/web/out/`. R3 measured 1,558 HTML files plus RSC/segment `.txt` files
  and `downloads/`.
- `postbuild` (`check-function-size.ts`) measures the Next.js server function. That function is
  gone, so the guard and its script are removed. The new function's size is checked by Vercel
  itself (250 MB limit), and the snapshot is about 32 MB.
- `next dev` still works for local editing. In dev it no longer applies redirects or headers,
  which only matters for testing those two things. The tests in 3.5 cover them against the
  real config.

### 3.2 Redirects and headers move to a generated `vercel.json`

- The 166 redirects and 5 header rules move unchanged from `next.config.ts` into one module,
  `lib/site/routing.ts`.
  - It exports `siteRedirects()` and `siteHeaders()`, built from the same sources as today:
    `MUNICIPALITY_ROUTES`, `LEGACY_TOPIC_FORWARDS` and the CSP string.
- `scripts/prepare-vercel-config.ts` writes `apps/web/vercel.json` from that module. It follows
  the repo's existing `prepare-* --check` pattern, and `--check` runs in `data:validate`, so a
  stale file fails `npm run check`.
- The generated file holds:
  - `framework: null`, `buildCommand: "npm run build"` and `outputDirectory: "out"`. Setting
    these in the file means nobody changes Vercel dashboard settings, and the Preview tests
    exactly what production will run.
  - `cleanUrls: true` and `trailingSlash: false`, matching today's URLs.
  - `redirects`: the 166 rules, `permanent: true` (308, as today).
  - `headers`: the 5 rules, plus 2 that Next.js used to add itself:
    - `/_next/static/(.*)` → `Cache-Control: public, max-age=31536000, immutable`;
    - `/opengraph-image` and `/en/opengraph-image` → `Content-Type: image/png`, because the
      files have no extension.
  - `rewrites`: `/mcp` → `/api/mcp`.
  - `functions`: `api/mcp.ts` with `maxDuration: 10` and
    `includeFiles: "lib/factQuery/generated/snapshot.json"`.
  - `git.deploymentEnabled.main: false`, kept as today.
- This is about 175 routes, far under Vercel's 2,048.

`vercel.ts` was considered, because it could import the route lists directly with no generated
file. It was rejected: the local server and tests would then need Vercel's config package to
evaluate it. A plain generated file is what both Vercel and the tests read, and it can be
inspected by eye.

### 3.3 `/mcp` as a Vercel Function at the same address

- The body of `app/mcp/route.ts` moves to `lib/mcp/handler.ts`. It is already Web-standard
  (`Request` → `Response`).
  - Its `GET`/`POST`/`OPTIONS`/`DELETE` exports keep their names and behaviour.
  - `export const runtime / dynamic / maxDuration` become the `functions` entry in `vercel.json`.
- `apps/web/api/mcp.ts` re-exports those handlers. Vercel runs named method exports in `api/` as
  Node functions, and the rewrite keeps the public URL `https://fiscal.ge/mcp`.
- `after()` from `next/server` only works inside Next.js. It becomes `waitUntil()` from
  `@vercel/functions`, Vercel's own small package and the one new dependency. Without it the
  anonymous daily usage tally would silently stop.
  - Behaviour stays the same: the tally runs after the reply, failures are swallowed, and
    outside a request (unit tests) it is skipped.
- The snapshot loader, the security checks (host allow-list, `x-vercel-forwarded-for` client
  key), the limiter, logging and the environment variables are unchanged. The function runs in
  the same Vercel project, so the headers it reads are the same.
- The 12 tests and scripts that import `app/mcp/route` import `lib/mcp/handler` instead.
- `lib/mcp/` and `lib/factQuery/` purity tests keep their rules: no database and no network
  beyond Upstash.

**Main risk.** `@modelcontextprotocol/server` is ESM-only and is loaded from a function that
Vercel compiles. This cannot be proven locally and is proven on the Preview (3.6).

**Fallback.** If it cannot work in this project, a separate small project serves
`mcp.fiscal.ge`. The connector address changes, which would be the owner's call. It is not
taken without asking.

### 3.4 Local serving and CI

- `npm run start` becomes `tsx scripts/serve-static.ts`, a small Node server (no new dependency)
  that reads the same `vercel.json`:
  - it serves `out/` with clean URLs, the 308 trailing-slash rule, the redirects (keeping the
    query string), the headers, and `404.html` with status 404;
  - it routes `/mcp` to `lib/mcp/handler.ts`.
  - The existing commands in `CLAUDE.md` (`npm run start -- --port 3100`) keep working.
- CI's `build` job uploads `out/` and the generated files instead of `.next/`. The `e2e` job
  starts the same `npm run start`. The Playwright `webServer` in CI mode is unchanged in shape.
- Today's redirect and header unit tests (`tests/site/redirects.test.ts`,
  `tests/seo/nextConfig.test.ts` and similar) read `lib/site/routing.ts`. A new test checks
  that `vercel.json` equals what the script would write.

### 3.5 Supabase out of the release path

- `deploy-production.yml` drops three steps: migrations, `data:import` and the db-mode
  verification build. It keeps green-CI gating, `ref: main` and the deploy hook.
  - Pinning the deploy to the tested commit, and confirming Vercel finished, stay out of scope
    (separate audit item).
- `db-health.yml` is deleted. Its only job was proving the mirror still matched, and keeping
  the free Supabase project from pausing.
- **At release (owner-approved step):** remove the Vercel Production variables `DATABASE_URL`
  and `GEODATA_DATA_SOURCE`, so the Vercel build reads the CSVs. A leftover
  `GEODATA_DATA_SOURCE=db` would make the build read a mirror that no longer gets updated.
- The code that can still read the database stays dormant until release 2. Its tests keep
  running in CI's `mirror` job, so nothing is half-removed.
- Docs, updated in the same change:
  - `docs/deployment.md`: settings table, environment variables, release steps, rollback,
    `/mcp` function, Preview verification.
  - `docs/data-methodology/database-import.md`: marked retired, kept until release 2.
  - `AGENTS.md`: the stack and serving sentences.
  - `CLAUDE.md`: the build, import and start lines.
  - `Project_Definition.md`: the "Data serving (current)" list.

### 3.6 Verification

Locally:

- the narrow unit tests while editing, then `npm run check` and `npm run build` once;
- the whole browser suite against `npm run start` on the static output (CI=1, Chromium);
- an HTML parity comparison of every exported page against a build of current `main`, reusing
  R3's method. Expect identical output apart from asset hashes and the 3 known harmless
  differences;
- `scripts/smoke-mcp.ts` (the existing MCP smoke probe: 14 tools, modern and legacy clients) against the local server.

On a Vercel Preview of the branch (pushed only after the owner has seen screenshots and said
go):

- Add Preview-only variables for this branch: `MCP_ENABLED=true`, `MCP_RATE_LIMITER=memory`,
  as an earlier branch had.
- Checks:
  - no `x-nextjs-prerender` header on pages;
  - unknown paths return 404;
  - 3 sample redirects keep the query string;
  - the security, CSP-Report-Only and X-Robots-Tag headers are present;
  - `/_next/static` is immutable;
  - the og-image is `image/png`;
  - `/mcp` answers `initialize` and a real `tools/call`;
  - Georgian and English pages open and an Excel download works.
- The owner gets the Preview link to click through.

After release:

- the same curl checks on fiscal.ge;
- the `/mcp` smoke test;
- on the Usage page over the following days, ISR Reads stay about 0 and Fast Origin Transfer
  stops growing with page traffic.

### 3.7 Rollback

Vercel's Instant Rollback to the last pre-switch deployment restores the old site in a minute.
That deployment is already built and does not read Supabase at request time. A code revert also
works while the Supabase project is still alive, which is why the project is only paused after
release 2.

## 4. Reuse (AGENTS.md "Reuse first")

| Kind | What |
|---|---|
| Used as is | `MUNICIPALITY_ROUTES`, `LEGACY_TOPIC_FORWARDS`, the CSP string, all of `lib/mcp/*` (security, limits, snapshot, tools, log, result), the CSV loaders, `prebuild`, the Playwright suite, the deploy hook |
| Small change | `next.config.ts` (export; rules moved out), `app/robots.ts` (one line), route body becomes `lib/mcp/handler.ts` (`after` → `waitUntil`), `package.json` scripts, `ci.yml` (artifact path), `deploy-production.yml` (three steps removed), the redirect/header tests (import source) |
| New | `lib/site/routing.ts` (moved rules, not new logic), `scripts/prepare-vercel-config.ts` (follows the `prepare-* --check` pattern), `api/mcp.ts` (re-export), `scripts/serve-static.ts`. No existing static server exists in the repo; `next start` cannot serve an export. |
| Removed | `app/mcp/route.ts`, `scripts/check-function-size.ts`, `db-health.yml`, the tracing settings |

## 5. Out of scope

- Firewall rules.
- Pinning deploys to the tested commit.
- Slimming page size.
- The 600 thin municipality pages.
- Any change to data, labels or page design.

## 6. Remaining limits after the switch

Today these limits are only part of the picture; after the switch they are the only ones left
that apply to pages:

- CDN Requests (1M a month);
- Fast Data Transfer (100 GB).

The `/mcp` function also uses Function Invocations and Active CPU (4 h). These are unchanged by
this work, and the owner should glance at them on the Usage page monthly.
