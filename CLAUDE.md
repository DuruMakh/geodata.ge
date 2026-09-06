# GeoData.ge — agent entry point

@AGENTS.md

## Commands (run in `apps/web`)

- `npm run check` — lint + typecheck + unit tests + data validation. Run before claiming any work done.
- `npm run test:browser` — Playwright e2e (local Edge; CI uses Chromium). Run for UI-affecting changes.
- `npm run build` — production build (static; reads CSVs from `data/imports` by default, no `.env` needed; `GEODATA_DATA_SOURCE=db` builds from the Supabase mirror instead).
- `npm run data:import` — parity-checked CSV→Supabase import (needs `apps/web/.env`; see `docs/data-methodology/database-import.md`).
- `npm run data:prepare-fact-query-snapshot` — rebuild the snapshot `/mcp` and the JSON publications answer from. Runs in `prebuild`; `--check` runs in `data:validate`.
- `npm run data:check-fact-query-publications` — verify the published JSON files match the snapshot. Runs as `postbuild`, after the files exist.

A worktree you have not installed in recently will fail `npm run typecheck` with errors
that look like real breakage but are a stale `node_modules`. Compare the mtimes of
`node_modules/.package-lock.json` and `package-lock.json` before debugging them.

## Test loop

Measured 2026-09-06 on a 14-core Windows box: `npm run check` is 100-145s depending on load
(lint 22s, typecheck 8s, `npm test` 58s, `data:validate` 35s), `npm run build` is 48s, and
the browser suite is 264s at one worker. Across this project's session history, 1,225 test and build
invocations cost 13.6 hours of wall clock — the cost is in how often the full gates run,
not in any single run.

So separate the two things you run tests for:

- **Feedback while editing** — run only what your change can break.
  `npx vitest run tests/<path>/<file>.test.ts` is ~5s and skips both the 150 unrelated
  files and the 4s `pretest` snapshot rebuild that plain `npm test` always pays.
  `npm run typecheck` alone is ~8s. For a single browser spec,
  `npx playwright test tests/browser/<name>.spec.ts`.
- **The done-check** — `npm run check` (plus `npm run build`, plus `npm run test:browser`
  for UI changes) is what you run once, when you believe the work is finished and are
  about to claim it. It is not a progress check.

Do not re-run a gate whose inputs have not changed since it last passed. If `npm run check`
passed and you then edited one test file, re-run that file, not the gate.

When you do need the whole browser suite, build and serve once and point the run at it —
`playwright.config.ts` then defaults to four workers, which is 116s against 264s for the
same 281 tests. It also tests the artifact that deploys rather than `next dev`:

```
npm run build && npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

`NEXT_PUBLIC_SITE_URL` is required or ~10 `seo.spec.ts` URL assertions fail locally for
reasons that have nothing to do with your change.

## Definition of done

1. `npm run check` and `npm run build` pass locally.
2. UI changes: `npm run test:browser` passes.
3. Data changes: the matching methodology doc under `docs/data-methodology/` is updated in the same change.
4. Query-service changes (`lib/factQuery/`, `lib/mcp/`, `app/mcp/`): the 20-intent reference fixture (`npx vitest run tests/factQuery/reference.test.ts`) passes. A disagreement there is a stop condition — report it rather than editing the expectation.
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
