# Database production readiness — design

Date: 2026-07-28
Status: approved design, pending implementation plan
Owner decisions: flip production to db-mode + operational hardening; fully
automated data pipeline (no human in the loop after merge); Supabase free tier
with a weekly keep-alive/health check; pipeline approach A ("single deploy
path"); health check cadence reduced from the proposed twice-weekly to weekly
by owner choice.

## 1. Context

The database architecture itself is complete and verified (activation PR #25,
2026-07-14): reviewed CSVs are the source of truth, `npm run data:import`
mirrors them into Supabase inside one transaction with exact parity checks,
and a db-mode build re-verifies the mirror row-by-row against the checkout's
CSVs (`docs/data-methodology/database-import.md`). The deployed site is fully
static in both modes; database failures can only delay rebuilds, never take
the site down.

What is missing is the production operation around it:

1. Production (Vercel) still builds in CSV mode — the `DATABASE_URL` +
   `GEODATA_DATA_SOURCE=db` env vars were never set.
2. The post-merge `db-build` CI job has been skipping silently since it
   landed: the `DATABASE_URL` GitHub Actions secret was never created
   (verified via `gh secret list` on 2026-07-28). Nothing continuously proves
   the mirror is healthy.
3. There is no defined sequence for data updates once production is db-mode:
   a merged data PR leaves the mirror stale, so the next production build
   fails by design until someone runs the import and redeploys.
4. Supabase free-tier projects pause after ~7 days of inactivity; a paused
   project fails every db-mode build until manually resumed.
5. No documented credential-rotation procedure; no written statement that
   backups are deliberately unnecessary.

Municipal expenditure data (PR #29) is raw/staging only — not served, not in
the schema — and is explicitly out of scope here.

## 2. Decisions and rejected alternatives

| Decision | Rationale | Rejected alternatives |
| --- | --- | --- |
| Flip + hardening in one round | Solves the two real operational risks (stale-mirror workflow, free-tier pausing) instead of discovering them in production | Minimal flip only; hardening-first with deferred flip; including municipal schema work |
| Fully automated data pipeline | Parity machinery is strictly stronger than a human reading the report; failed import rolls back and blocks the deploy without touching the live site | Manual runbook (owner runs import locally); semi-automated (CI imports, human redeploys) |
| Approach A: single deploy path — disable Vercel auto-deploy for `main`, deploy only via GitHub Actions → deploy hook | Import→build ordering guaranteed by construction; no failed-build noise; red means something is wrong; enables CI-green gating | B: keep auto-deploy and accept one failed build per data merge (normalizes red deploys); C: ignored-build-step diff heuristic (fragile under rebase merges, logic split across two systems) |
| Every production deploy runs the import unconditionally | Amendment to the approved section 1 (owner-visible in review): "did data change" detection under a `workflow_run` trigger has no clean diff base, the glob list can drift from what the import mirrors, and a half-failed deploy leaves a stale-mirror edge case. The import is idempotent and ~1–2 min on this dataset, so unconditional convergence is simpler and strictly more robust | Conditional import gated on changed-path detection (as originally presented); diff against last successful deploy via API |
| Gate production deploys on CI green (`workflow_run`) | Closes the documented wart (`docs/deployment.md`): a red-CI push to `main` currently still deploys. Latency cost ~10–12 min merge→live is acceptable for an annually-updated statistics site | Deploy directly on push (faster, keeps the wart); folding deploy into `ci.yml` as a final job (loses independent manual dispatch) |
| Supabase free tier + weekly scheduled db-mode build | $0/mo; the scheduled build doubles as keep-alive and mirror health check; pause risk is residual (see §7) and costs one dashboard click | Paid Pro tier (~$25/mo buys "never pause" plus backups the rebuildable mirror does not need) |
| Weekly health-check cadence (Mon 06:00 UTC) | Owner choice | Twice-weekly (recommended for margin against the ~7-day pause window) |
| No database backups | The mirror rebuilds from git-versioned CSVs in minutes; this rationale gets written into the docs so nobody adds backups later | PITR / scheduled dumps |

## 3. Design

### 3.1 Production deploy workflow (`.github/workflows/deploy-production.yml`)

Vercel auto-deploy is disabled for `main` only, via `apps/web/vercel.json`:

```json
{ "git": { "deploymentEnabled": { "main": false } } }
```

Branch and PR preview deployments are unaffected and remain CSV-mode.

The workflow is the single road to production. Triggers:

- `workflow_run`: CI workflow completed on `main` — the job runs only when
  the conclusion is success (§3.2);
- `workflow_dispatch`: manual "import + redeploy" button for reruns, the
  rollout, and emergencies.

One linear job (concurrency group `production-deploy`,
`cancel-in-progress: false` so runs queue and never cancel a mid-flight
import):

1. Checkout `main` (the deploy hook always builds latest `main`, so the
   import must also run from latest `main` — see §7 on this convergence).
2. `npm ci` in `apps/web` (Node 24, npm cache, as in `ci.yml`).
3. `npm run prisma:deploy` — applies any new committed migrations; fast no-op
   otherwise. Uses `DIRECT_URL`.
4. `npm run data:import` — unconditional wipe-and-reload inside one
   transaction with the full parity check; the parity report prints into the
   Actions log. Uses `DIRECT_URL` (falls back to pooled with a warning, which
   in CI should not happen). Any failure stops the workflow: the transaction
   rolls back, no deploy is triggered, production keeps serving the previous
   build.
5. `curl` the Vercel deploy hook (`VERCEL_DEPLOY_HOOK_URL` secret) → Vercel
   builds latest `main` with `GEODATA_DATA_SOURCE=db` and re-verifies the
   fresh mirror row-by-row during the build.

No app code changes anywhere in this design: the serving code
(`apps/web/lib/data/servedData.ts`, `apps/web/lib/db/*`) is already done.

### 3.2 CI-green gating

`deploy-production.yml` fires on `workflow_run` of the CI workflow for
`main`, and its job condition requires
`github.event.workflow_run.conclusion == 'success'` (or
`workflow_dispatch`). Effect: lint, typecheck, unit tests, data validation,
CSV-mode build, audit, and Playwright must all pass on `main` before the
import or deploy start. A red `main` therefore blocks production updates —
the fix for the previously documented wart — and `workflow_dispatch` is the
escape hatch to deploy past a known-flaky check.

### 3.3 Credentials and configuration

GitHub Actions secrets (repo `DuruMakh/geodata.ge`):

| Secret | Value | Used by |
| --- | --- | --- |
| `DIRECT_URL` | Supabase **session pooler** string (port 5432, IPv4-compatible; GitHub runners have no IPv6 and the true direct host `db.<ref>.supabase.co` is IPv6-only) | migrate deploy + import in the deploy workflow |
| `DATABASE_URL` | Pooled string (port 6543, `?pgbouncer=true`) | weekly `db-health` build |
| `VERCEL_DEPLOY_HOOK_URL` | Deploy hook created in Vercel project settings (Git → Deploy Hooks, branch `main`) | deploy step |

Vercel project env vars, **Production scope only** (Preview/Development
deliberately unset so previews — including data-PR previews whose mirror
legitimately lags — keep building CSV-mode):

- `DATABASE_URL` = pooled string;
- `GEODATA_DATA_SOURCE` = `db`.

Local `apps/web/.env` stays as documented in `.env.example` (true direct URL
for `DIRECT_URL`); CI is the only place that substitutes the session pooler.

Early technical verification (rollout step 1, before anything is built on
it): run `npm run data:import` locally once with `DIRECT_URL` pointed at the
session pooler string to prove imports work over it. Fallbacks if it
misbehaves: Supabase's IPv4 add-on (~$4/mo) or importing over the pooled URL
(supported today, warns).

### 3.4 Health check and keep-alive (`.github/workflows/db-health.yml`)

Schedule: `0 6 * * 1` (Mondays 06:00 UTC) plus `workflow_dispatch`. One job:
checkout, `npm ci`, then `GEODATA_DATA_SOURCE=db npm run build` with the
pooled `DATABASE_URL` secret. A single green run simultaneously proves the
database is reachable (and counts as activity against free-tier pausing),
the credentials are valid, and the mirror still matches the checkout's CSVs
row-by-row. Failure notifies via GitHub's standard failed-workflow email to
the owner.

### 3.5 CI changes

Delete the `db-build` job from `.github/workflows/ci.yml`. It has been
skipping silently (secret never set), and its purpose is now covered
properly: every real deploy verifies the mirror during the Vercel build
(§3.1), and `db-health` covers the steady state between deploys (§3.4). CI
keeps its PR-facing jobs unchanged.

### 3.6 Failure modes and runbook (to be written into `docs/deployment.md`)

Every failure leaves the live site serving its previous deploy; nothing here
can take the site down.

| Failure | Symptom | Response |
| --- | --- | --- |
| Import fails (validation, parity, connection) | Deploy workflow red + GitHub email; DB rolled back to previous state | Fix the data (or transient cause), rerun via `workflow_dispatch` |
| Vercel build fails (Supabase paused or unreachable) | Vercel failed-deployment email | Resume the project in the Supabase dashboard, rerun the deploy workflow |
| CI red on `main` | No deploy triggered | Fix `main`; or `workflow_dispatch` the deploy to bypass a known-flaky check |
| GitHub Actions outage / workflow broken | Deploys stall, visible in Actions | Manual fallback: local `npm run data:import`, then `vercel deploy --prod`; or revert the one-line `vercel.json` change to restore auto-deploy |
| Emergency database bypass | Any persistent db-mode blocker | Break-glass: set `GEODATA_DATA_SOURCE=csv` in Vercel Production env and redeploy — production builds straight from the reviewed CSVs |
| Credential rotation | — | Checklist: rotate the database password in Supabase → update 2 GitHub secrets (`DIRECT_URL`, `DATABASE_URL`) + 1 Vercel env (`DATABASE_URL`) + local `.env` → dispatch `db-health` to confirm green |

### 3.7 Documentation updates (same change as implementation)

- `docs/deployment.md`: new deploy flow (Actions-owned production deploys,
  hook, CI gating), env var table, the runbook table above, rotation
  checklist, and the explicit no-backups rationale.
- `docs/data-methodology/database-import.md`: "Re-running for a new data
  year" section rewritten around the automated pipeline; manual import
  demoted to documented fallback; session-pooler note for CI.
- `AGENTS.md` Current Project State: data-serving bullet and deployment
  bullet updated when the flip completes (production builds from the mirror;
  CSV remains the fallback).
- `apps/web/.env.example`: one comment noting CI substitutes the session
  pooler string for `DIRECT_URL`.

## 4. Rollout sequence

Ordered so every step is verifiable and production risk stays zero until the
final, reversible switch:

1. Verify the session-pooler import path locally (§3.3). Blocker gate for
   everything below.
2. Owner: create the Vercel deploy hook; add the 3 GitHub secrets (exact
   `gh secret set` commands will be provided; values come from the owner's
   existing `.env` / Supabase dashboard).
3. Merge the pipeline PR (workflows + `vercel.json` + docs) **while Vercel
   Production is still CSV-mode**. The merge itself exercises the whole
   pipeline end-to-end — CI gate → import → hook → Vercel build (still CSV)
   — with zero production risk.
4. Owner: set the 2 Vercel Production env vars (§3.3).
5. `workflow_dispatch` the deploy workflow → first db-mode production build.
   Verify the Vercel build log shows the db source and the row-by-row parity
   pass; eyeball the live site.
6. `workflow_dispatch` `db-health` once to prove it green. Update the
   `AGENTS.md` status sentences (§3.7). Done.

Rollback at any point: unset the two Vercel env vars (returns production
builds to CSV mode) and/or revert the `vercel.json` line (restores
auto-deploy).

## 5. Verification criteria

- Rollout step 3: deploy workflow green end-to-end on a real merge; Vercel
  shows a hook-triggered production deployment; a PR preview built during
  the same window still uses CSV mode.
- Rollout step 5: production deployment built with `GEODATA_DATA_SOURCE=db`;
  build log contains the parity verification; site renders identically.
- Rollout step 6: `db-health` green on dispatch; first scheduled run green
  the following Monday.
- Repo checks: `npm run check` and `npm run build` pass locally for the PR
  (workflow/config/docs changes must not disturb the app build).
- CI on the PR is green, including Playwright (unchanged UI).

## 6. Out of scope

- Municipal dataset schema/import/UI (raw data only today; design it when a
  UI exists).
- Database backups/PITR (deliberate; rationale documented in §2).
- Paid Supabase tier.
- Content-Security-Policy and custom-domain work (tracked in
  `docs/deployment.md` already, unrelated to the database).
- Any change to serving code, schema, or data files.

## 7. Known accepted risks

- **Weekly keep-alive margin**: a Mon-to-Mon cadence sits at the edge of the
  ~7-day free-tier pause window; deploys and imports add activity, but a
  quiet week plus a delayed cron could still pause the project. Cost when it
  bites: one failed build/health check + one dashboard click to resume.
  Mitigation if it recurs: bump the cron to twice-weekly (one line).
- **Deploy/import overlap race**: workflow N+1's import can commit while
  Vercel is still building deploy N; build N's row-verification may then
  fail against its own checkout. Requires merges minutes apart, is
  self-healing (build N+1 succeeds and is the one that matters), and the
  previous production deploy stays live throughout. Accepted; not worth a
  Vercel-polling serialization step.
- **`workflow_run` builds latest `main`**: if CI for commit A finishes while
  commit B is already on `main`, the triggered run imports and deploys
  latest `main` (B) before B's own CI verdict; B's CI completion triggers
  another converging run. Accepted: the deploy hook can only ever build
  latest `main` anyway, and B still gets fully verified by the build-time
  parity check.
- **Deploy-hook URL secrecy**: anyone holding the URL can trigger builds (a
  nuisance, not a data risk — it only rebuilds latest `main`). Kept in a
  GitHub secret; rotate via Vercel settings if leaked.
