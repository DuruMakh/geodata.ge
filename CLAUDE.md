# Fiscal.ge (repo: GeoData.ge) — agent entry point

@AGENTS.md

## Commands (run in `apps/web`)

- `npm run check` — lint + typecheck + unit tests + data validation + `i18n:check`. Run before claiming any work done.
- `npm run test:browser` — Playwright e2e (local Edge; CI uses Chromium). Run for UI-affecting changes.
- `npm run build` — production build (static; reads CSVs from `data/imports` by default, no `.env` needed; `GEODATA_DATA_SOURCE=db` builds from the Supabase mirror instead).
- `npm run data:import` — parity-checked CSV→Supabase import (needs `apps/web/.env`; see `docs/data-methodology/database-import.md`).
- `npm run data:prepare-fact-query-snapshot` — rebuild the snapshot `/mcp` and the JSON publications answer from. Runs in `prebuild`; `--check` runs in `data:validate`.
- `npm run data:check-fact-query-publications` — verify the published JSON files match the snapshot. `prebuild`'s `data:prepare-fact-query-publications` runs the same check on what it has just written.

A worktree you have not installed in recently will fail `npm run typecheck` with errors
that look like real breakage but are a stale `node_modules`. Compare the mtimes of
`node_modules/.package-lock.json` and `package-lock.json` before debugging them.

## Test loop

Measured 2026-10-13 in a 4-core Linux cloud session: `npm run typecheck` is 13s (56s when
`.next/types` is missing; it runs `next typegen` first), `data:validate` is 121s (one process;
147s as the former chain of 30), `npm run build` is 201s with a warm `.next/cache`, and
`main-explorer.spec.ts` (47 tests; one file runs in one worker) is 55s against a built server.
The browser suite is 1,487 tests. The CI runner's numbers are pending its first run on the
one-build workflow. Across this project's session history, 1,225 test and build
invocations cost 13.6 hours of wall clock — the cost is in how often the full gates run,
not in any single run.

So separate the two things you run tests for:

- **Feedback while editing** — run only what your change can break.
  `npx vitest run tests/<path>/<file>.test.ts` is ~10s and skips both the ~500 unrelated
  files and the `pretest` snapshot rebuild that plain `npm test` always pays; it rebuilds
  the snapshot once (~10s) only when the snapshot is missing or one of its inputs changed.
  `npm run typecheck` alone is ~13s. For a single browser spec,
  `npx playwright test tests/browser/<name>.spec.ts` against a built server (below).
- **The done-check** — `npm run check` (plus `npm run build`, plus `npm run test:browser`
  for UI changes) is what you run once, when you believe the work is finished and are
  about to claim it. It is not a progress check.

Do not re-run a gate whose inputs have not changed since it last passed. If `npm run check`
passed and you then edited one test file, re-run that file, not the gate.

When you do need the whole browser suite, build and serve once and point the run at it —
`playwright.config.ts` then defaults to four workers (measured 2026-09-06 on the then 281
tests: 116s against 264s at one worker). It also tests the artifact that deploys rather than
`next dev`:

```
NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

A Linux cloud session has no Edge, so `CI=1` (bundled Chromium) is required there, not
optional. `CI=1` also turns on one retry, so treat a test the summary calls flaky as a
failure to investigate. Start the server in the background and stop it by its PID when done
(`pkill -f next-server` run from a shell matches that shell's own command line and kills it):

```
cd apps/web && NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build && (setsid nohup npm run start -- --port 3100 > /tmp/start-3100.log 2>&1 < /dev/null &)
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/<name>.spec.ts
```

`NEXT_PUBLIC_SITE_URL` is required on the build as well as the test run: the origin is baked
into the static HTML at build time. Without it on the test run ~10 `seo.spec.ts` assertions
fail; without it on the build ~140 URL assertions across seo, bilingual-seo, connect and
municipal specs fail with `http://localhost:3000` — none of it related to your change. Stop
the server before rebuilding: a running `next start` corrupts the `.next` it is serving.

## Definition of done

1. `npm run check` and `npm run build` pass locally.
2. UI changes: `npm run test:browser` passes.
3. Data changes: the matching methodology doc under `docs/data-methodology/` is updated in the same change.
4. Query-service changes (`lib/factQuery/`, `lib/mcp/`, `app/mcp/`): the reference fixture (`npx vitest run tests/factQuery/reference.test.ts`) passes. A disagreement there is a stop condition — report it rather than editing the expectation.
5. Durable project changes update their canonical owner: scope in `Project_Definition.md`, visuals in `DESIGN.md`, data/deployment behavior in the relevant methodology or runbook, and `AGENTS.md` only for always-relevant operational rules.
6. CI (`.github/workflows/ci.yml`) must be green before a PR merges.

## Health Stack

- typecheck: npm run typecheck
- lint: npm run lint
- test: npm test
- e2e: npm run test:browser
- data: npm run data:validate
- build: npm run build

(all from `apps/web`)
