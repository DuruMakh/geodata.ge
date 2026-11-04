# Static export and Supabase retirement (release 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve every fiscal.ge page as a static file, run `/mcp` as one Vercel Function at the same address, and stop releases from touching Supabase.

**Architecture:**
- `next build` with `output: "export"` writes `apps/web/out/`.
- Redirects and headers move from `next.config.ts` into `lib/site/routing.ts`. A script generates `apps/web/vercel.json` from that module, and the file is check-guarded.
- The `/mcp` route body becomes `lib/mcp/handler.ts`, re-exported by `api/mcp.ts` and reached through a rewrite.
- A small Node server (`scripts/serve-static.ts`) applies the same `vercel.json` locally and in CI.
- `deploy-production.yml` loses its database steps.

**Tech Stack:** Next.js 16.4 (App Router, static export), Vercel (preset Other via `vercel.json`), `@vercel/functions` (`waitUntil`), Vitest, Playwright, tsx.

**Spec:** `docs/superpowers/specs/2026-11-04-static-export-and-supabase-retirement-design.md`

## Global Constraints

- Public URLs, the 166 redirects (308, query string kept), the 5 header rules and `https://fiscal.ge/mcp` behave exactly as today.
- `vercel.json` sets `framework: null`, `buildCommand: "npm run build"`, `outputDirectory: "out"`, `cleanUrls: true`, `trailingSlash: false`, and `git.deploymentEnabled.main: false`.
- The `/mcp` function: `api/mcp.ts`, `maxDuration: 10`, `includeFiles: "lib/factQuery/generated/snapshot.json"`, rewrite `/mcp` → `/api/mcp`.
- Two extra header rules:
  - `/_next/static/(.*)` → `Cache-Control: public, max-age=31536000, immutable`;
  - `/opengraph-image` and `/en/opengraph-image` → `Content-Type: image/png`.
- The only new dependency is `@vercel/functions`. No other package is added.
- No published number, label or page design changes. The database code stays dormant until release 2.
- Push and open a PR only after Duru has seen screenshots and said go. Merge only after the go on the Preview and after syncing with main.

## Review Focus

1. `GET /explorer/trade/?x=1` (trailing slash plus a query) → 308 to `/explorer/trade?x=1`. Tested in Task 5.
2. A legacy hub forward whose destination already has a query (`/explorer/wages` → `/explorer/labour?topic=wages`) still lands there when the old link carried its own query. Tested in Task 5 against `vercel.json`.
3. An unknown address (`/en/nope`, `/explorer/municipalities/05`) answers status 404 with the not-found page, not 200. Tested in Task 5.
4. RSC prefetches (`/explorer/trade.txt?_rsc=abc`, `/explorer/__next._tree.txt?_rsc=abc`) answer 200 with the file despite the query. Tested in Task 5, and by the browser suite in Task 7.
5. The anonymous usage tally still runs after a reply now that `after()` is gone: `waitUntil` is called once per tallied request, and a throwing counter never changes the response. Tested in Task 3.

---

### Task 1: Move redirects and headers into `lib/site/routing.ts`

**Files:**
- Create: `apps/web/lib/site/routing.ts`
- Modify: `apps/web/next.config.ts` (the CSP block, `redirects()` and `headers()` bodies move out; next.config calls the new functions for now)
- Modify: `apps/web/tests/site/redirects.test.ts`, `apps/web/tests/seo/nextConfig.test.ts` (import the new module instead of `next.config`)

**Interfaces:**
- Produces:
  - `export type SiteRedirect = { source: string; destination: string; permanent: true }`
  - `export type SiteHeaderRule = { source: string; headers: { key: string; value: string }[] }`
  - `export function siteRedirects(): SiteRedirect[]`: same 166 entries, same order as today
  - `export function siteHeaders(): SiteHeaderRule[]`: same 5 rules, same order
  - `export const contentSecurityPolicy: string`: `NODE_ENV` dependency kept

- [ ] **Step 1:** In both tests, replace `await nextConfig.redirects?.()` with `siteRedirects()` and `await nextConfig.headers?.()` with `siteHeaders()`. Run `npx vitest run tests/site/redirects.test.ts tests/seo/nextConfig.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 2:** Create `lib/site/routing.ts` by moving the existing code verbatim. Make `next.config.ts` `redirects: async () => siteRedirects()` and `headers: async () => siteHeaders()`.
- [ ] **Step 3:** Run the same two tests plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 4:** Commit `refactor: move site redirects and headers into lib/site/routing`.

### Task 2: Generate `vercel.json`

**Files:**
- Create: `apps/web/scripts/prepare-vercel-config.ts`, `apps/web/tests/site/vercelConfig.test.ts`
- Modify: `apps/web/vercel.json` (generated), `apps/web/package.json` (script `site:prepare-vercel-config`), `apps/web/scripts/validate-all.ts` (add the `--check` run, following how it lists the other `--check` steps)

**Interfaces:**
- Consumes: `siteRedirects()`, `siteHeaders()` (Task 1).
- Produces: `export function buildVercelConfig(): VercelConfig` in `scripts/prepare-vercel-config.ts`. The CLI writes the file with 2-space JSON plus a trailing newline, or with `--check` exits 1 when the file differs.

- [ ] **Step 1:** Write tests:
  - `vercel.json on disk equals buildVercelConfig()` (deep equal of the parsed file);
  - `keeps every Next redirect as a permanent redirect`: `config.redirects` deep-equals `siteRedirects()`, length 166;
  - `serves the export with clean URLs and no trailing slash`: checks `framework === null`, `outputDirectory === "out"`, `buildCommand === "npm run build"`, `cleanUrls === true`, `trailingSlash === false`, `git.deploymentEnabled.main === false`;
  - `routes /mcp to its function`: `rewrites` equals `[{ source: "/mcp", destination: "/api/mcp" }]` and `functions["api/mcp.ts"]` equals `{ maxDuration: 10, includeFiles: "lib/factQuery/generated/snapshot.json" }`;
  - `headers are the site rules plus static-asset caching and og-image type`: the first 5 equal `siteHeaders()`, then the two rules from Global Constraints. The og-image source is `/:locale(en)?/opengraph-image` or two rules; pick one and assert it;
  - `stays under Vercel's 2,048 routes`: redirects + headers + rewrites < 2048.

  Run them. Expected: FAIL.
- [ ] **Step 2:** Implement `buildVercelConfig()` and the CLI. Use `--check` like `prepare-fact-query-snapshot.ts` does. Run `npm run site:prepare-vercel-config` to write the file.
- [ ] **Step 3:** Run `npx vitest run tests/site/vercelConfig.test.ts` and `npx tsx scripts/prepare-vercel-config.ts --check`. Expected: PASS, exit 0.
- [ ] **Step 4:** Commit `feat: generate vercel.json from the site routing rules`.

### Task 3: `/mcp` becomes `lib/mcp/handler.ts` + `api/mcp.ts`

**Files:**
- Create: `apps/web/lib/mcp/handler.ts` (moved body of `app/mcp/route.ts`), `apps/web/api/mcp.ts`
- Delete: `apps/web/app/mcp/route.ts`
- Modify: the imports in the 11 test files and `scripts/measure-bilingual-mcp.ts` listed by `grep -rn "app/mcp/route" tests scripts`; the comment in `lib/mcp/result.ts:48`; `package.json` (add `@vercel/functions`, exact current version)
- Test: `apps/web/tests/mcp/route.test.ts` ("declares the runtime…" becomes a vercel.json check), `apps/web/tests/mcp/snapshot.test.ts` ("is traced into the /mcp function bundle" reads `vercel.json` `functions["api/mcp.ts"].includeFiles`), a new usage-tally test in `tests/mcp/route.test.ts`

**Interfaces:**
- Produces:
  - `lib/mcp/handler.ts` exports `POST`, `OPTIONS`, `GET`, `DELETE` with today's signatures;
  - `api/mcp.ts` is `export { POST, OPTIONS, GET, DELETE } from "../lib/mcp/handler";`.

- [ ] **Step 1:** Repoint every import to `lib/mcp/handler` and rewrite the two config tests as above. Add a test `tallies a served request after the reply through waitUntil`:
  - mock `@vercel/functions` with `vi.mock` so `waitUntil` captures its promise;
  - POST a valid `tools/call` under the memory limiter;
  - assert `waitUntil` was called once, and the response status and body equal a run whose counter `record` throws.

  Run `npx vitest run tests/mcp tests/scripts/smokeMcp.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 2:** Move the file with `git mv` so history follows. Drop the three segment exports. Replace `after(cb)` with `waitUntil(cb())`, wrapped in the same try/catch. Keep the comment's meaning. Install `@vercel/functions`.
- [ ] **Step 3:** Run the same tests, `npm run typecheck` and `npx vitest run tests/mcp/purity.test.ts tests/factQuery/purity.test.ts tests/factQuery/reference.test.ts`. Expected: PASS. A reference-fixture disagreement is a stop condition (CLAUDE.md DoD 4).
- [ ] **Step 4:** Commit `refactor(mcp): serve /mcp from an api/ function instead of an app route`.

### Task 4: Switch the build to static export

**Files:**
- Modify:
  - `apps/web/next.config.ts`: add `output: "export"`; remove `redirects`, `headers`, `outputFileTracingIncludes` and `outputFileTracingExcludes`, and the comments that describe them;
  - `apps/web/app/robots.ts`: `export const dynamic = "force-static";`;
  - `apps/web/package.json`: remove `postbuild` and `check:function-size`;
  - comments that point at next.config for redirects or the trace (`lib/seo/sitemap.ts:293`, `lib/data/pageDataFiles.ts:10`, `tests/methodology/sourceInventory.test.ts:112`, `tests/browser/poverty.spec.ts:118`): point them at `lib/site/routing.ts` / `vercel.json`.
- Delete: `apps/web/scripts/check-function-size.ts` and its test, if any (`grep -rn check-function-size tests`).

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** Run `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`. Expected:
  - success;
  - `out/` holds `index.html`, `en.html`, `404.html`, `robots.txt`, `sitemap.xml`, `opengraph-image` and `explorer-places.ka.json`;
  - `find out -name '*.html' | wc -l` is about 1,558;
  - no `out/mcp*`;
  - no "redirects/headers will not work" warnings.
- [ ] **Step 3:** Run `npm run typecheck` and `npx vitest run tests/site tests/seo`. Expected: PASS.
- [ ] **Step 4:** Commit `feat: build the site as a static export`.

### Task 5: Local static server and CI

**Files:**
- Create: `apps/web/scripts/serve-static.ts`, `apps/web/tests/scripts/serveStatic.test.ts`
- Modify:
  - `apps/web/package.json`: `"start": "tsx scripts/serve-static.ts"`;
  - `.github/workflows/ci.yml`: the build artifact paths become `apps/web/out` and `apps/web/lib/factQuery/generated`; the cache hash includes `apps/web/lib/site/**`; comments say "static server" instead of "next start";
  - `apps/web/playwright.config.ts`: comments only; the CI command stays `npm run build && npm run start -- --port 3100`;
  - browser specs that test redirects on the default local dev server: add the `test.skip(!process.env.PLAYWRIGHT_BASE_URL && !process.env.CI, …)` guard `poverty.spec.ts:119` already uses. Find them with `grep -ln "toHaveURL\|redirect" tests/browser`.

**Interfaces:**
- Consumes: `vercel.json` (Task 2), `out/` (Task 4), `lib/mcp/handler.ts` (Task 3).
- Produces:
  - `export function createStaticServer(options: { root: string; config: VercelConfig }): http.Server`;
  - the CLI reads `--port` (default 3000), `root = out`, and `config = vercel.json`.
- Behaviour:
  - Order: trailing-slash 308, then redirects (path-to-regexp sources, 308, query appended unless the destination has one, else merged), then the `/mcp` rewrite to the handler, then the file lookup (`path`, `path.html`, `path/index.html`; query ignored), then `404.html` with status 404.
  - Header rules whose source matches the request path are added to every response.
  - Content types come from extension, with no new dependency. Extensionless files under the og-image rule get their header from config.
  - Use the `path-to-regexp` version already in `node_modules`, if `npm ls path-to-regexp` shows one as a direct-safe transitive dependency. Otherwise convert the sources the way R3's `serve.js` did, using the build's routes manifest regexes. Record the choice in the file header.

- [ ] **Step 1:** Write the tests against a temp `root` and a small config:
  - the 5 Review Focus cases (1–4 here; 5 is Task 3);
  - `serves /en from en.html`;
  - `adds the site-wide security headers to a page and to a 404`;
  - `adds X-Robots-Tag noindex to /page-data/x.json`;
  - `POST /mcp reaches the handler` (stub handler injected through an optional `mcpHandler` option, default the real one).

  Run `npx vitest run tests/scripts/serveStatic.test.ts`. Expected: FAIL.
- [ ] **Step 2:** Implement `serve-static.ts`.
- [ ] **Step 3:** Run the tests. Expected: PASS. Then start the server on the Task 4 output (CLAUDE.md `setsid nohup npm run start -- --port 3100` recipe) and run `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/main-explorer.spec.ts tests/browser/seo.spec.ts`. Expected: all pass.
- [ ] **Step 4:** Commit `feat: serve the static export locally and in CI with the deployed routing rules`.

### Task 6: Releases stop using Supabase; docs

**Files:**
- Modify: `.github/workflows/deploy-production.yml` (remove the three database steps and rewrite the header comment: CI green on main → POST the deploy hook; the database secrets are no longer read)
- Delete: `.github/workflows/db-health.yml`
- Modify docs:
  - `docs/deployment.md`:
    - settings table: preset Other via `vercel.json`, output `out`;
    - env table: drop `DATABASE_URL` and `GEODATA_DATA_SOURCE` from Production;
    - release flow, rollback (Instant Rollback);
    - the `/mcp` function section;
    - a Preview checklist that copies the spec's §3.6 list;
    - remove the db-health and secret-rotation steps that only served the mirror;
  - `docs/data-methodology/database-import.md`: a top note "Retired from releases on 2026-11-xx; the code is removed in release 2";
  - `AGENTS.md` line 46: CSVs are read directly at build, and the Supabase mirror is retired. Keep the rest. `AGENTS.md` line 48: `/mcp` is the only function. Its wording about "request-time route" stays true;
  - `CLAUDE.md`: the `build`, `data:import` and start lines, and the note that `npm run start` now serves `out/`;
  - `Project_Definition.md` "Data serving (current)": CSVs are read at build; Supabase is retired.

- [ ] **Step 1:** Make the edits. Check them with `grep -rn "GEODATA_DATA_SOURCE=db\|db-health\|data:import" .github docs/deployment.md AGENTS.md CLAUDE.md Project_Definition.md`. Expected: only retired or historical mentions remain.
- [ ] **Step 2:** Run `npx vitest run tests/deployment` (or whatever tests read the workflows: `grep -rln "deploy-production\|db-health" apps/web/tests`). Fix the expectations that describe removed steps. Expected: PASS.
- [ ] **Step 3:** Commit `chore: release from the reviewed CSVs and retire the Supabase mirror from the release path`.

### Task 7: Verify (the done-check, once)

- [ ] **Step 1: Parity.** Build `origin/main` in a disposable worktree in CSV mode, and compare every `.next/server/app/**/*.html` with `out/**/*.html`. Use R3's `parity.py`, which strips scripts and asset hints. Expected: identical except the 3 known differences. Save the report to `/mnt/project-files/static-site-switch/parity.md`.
- [ ] **Step 2:** Run `npm run check` once. Expected: PASS.
- [ ] **Step 3:** Run the full browser suite against `npm run start` on port 3100 (CLAUDE.md recipe, `CI=1`). Expected: all pass, no flaky.
- [ ] **Step 4:** Run `npx tsx scripts/smoke-mcp.ts` against `http://localhost:3100/mcp` with `MCP_ENABLED=true MCP_RATE_LIMITER=memory`. Expected: `ok: true`.
- [ ] **Step 5:** Take screenshots of home, All data, a place page and the 404, in ka and en. Send them to Duru with the parity result, and wait for the go before pushing.

### Task 8: Preview and release (owner-gated)

- [ ] **Step 1:** After Duru's go:
  - sync with main;
  - add Preview env vars scoped to the branch: `MCP_ENABLED=true`, `MCP_RATE_LIMITER=memory`;
  - push the branch (no PR yet) for a Vercel Preview.
- [ ] **Step 2:** Run the spec's §3.6 Preview checks and send Duru the Preview link.
- [ ] **Step 3:** After Duru's go:
  - open the PR and subscribe to it;
  - when CI is green, remove the Production `DATABASE_URL` and `GEODATA_DATA_SOURCE` in Vercel;
  - merge;
  - verify fiscal.ge with the same checks and the MCP smoke test.
- [ ] **Step 4:** Remind Duru to look at ISR Reads and Fast Origin Transfer on the Usage page in 2–3 days. Then plan release 2 (database code removal) as its own spec → plan.
