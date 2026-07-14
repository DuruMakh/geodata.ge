# GeoData.ge — agent entry point

@AGENTS.md

## Commands (run in `apps/web`)

- `npm run check` — lint + typecheck + unit tests + data validation. Run before claiming any work done.
- `npm run test:browser` — Playwright e2e (local Edge; CI uses Chromium). Run for UI-affecting changes.
- `npm run build` — production build (static; reads CSVs from `data/imports` by default, no `.env` needed; `GEODATA_DATA_SOURCE=db` builds from the Supabase mirror instead).
- `npm run data:import` — parity-checked CSV→Supabase import (needs `apps/web/.env`; see `docs/data-methodology/database-import.md`).

## Definition of done

1. `npm run check` and `npm run build` pass locally.
2. UI changes: `npm run test:browser` passes.
3. Data changes: the matching methodology doc under `docs/data-methodology/` is updated in the same change.
4. Durable project-state changes: update `AGENTS.md` "Current Project State".
5. CI (`.github/workflows/ci.yml`) must be green before a PR merges.

## Health Stack

- typecheck: npm run typecheck
- lint: npm run lint
- test: npm test
- e2e: npm run test:browser
- data: npm run data:validate
- build: npm run build

(all from `apps/web`)
