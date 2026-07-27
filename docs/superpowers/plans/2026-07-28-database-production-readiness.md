# Database Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip GeoData.ge production to db-mode with a single Actions-owned deploy path: CI-green gate → unconditional parity-checked import → Vercel deploy hook, plus a weekly db-health workflow and a documented runbook.

**Architecture:** Vercel auto-deploy is disabled for `main` only (`apps/web/vercel.json`); a new `deploy-production.yml` workflow fires after CI succeeds on `main`, converges the Supabase mirror to the checkout (`prisma:deploy` + `data:import`, unconditionally — the import is idempotent), then POSTs the Vercel deploy hook so the db-mode build re-verifies the mirror row-by-row. A weekly `db-health.yml` build doubles as free-tier keep-alive and drift detection. No app code, schema, or data changes anywhere.

**Tech Stack:** GitHub Actions (workflow_run, workflow_dispatch, cron), Vercel deploy hooks + `vercel.json`, existing npm scripts (`prisma:deploy`, `data:import`, `build`), Supabase session pooler (IPv4) for CI.

**Spec:** `docs/superpowers/specs/2026-07-28-database-production-readiness-design.md`

## Global Constraints

- No new npm dependencies; no changes under `apps/web/lib/`, `apps/web/app/`, `apps/web/components/`, `apps/web/prisma/`, or `data/`.
- Node version in workflows: `24` with npm cache keyed on `apps/web/package-lock.json` (copy of `ci.yml`'s setup).
- Secret names exactly: `DIRECT_URL` (session pooler, port 5432), `DATABASE_URL` (pooled, port 6543, `?pgbouncer=true`), `VERCEL_DEPLOY_HOOK_URL`.
- Workflow display names exactly: `CI` (exists), `Deploy production`, `DB health` — `deploy-production.yml` references CI by the name `CI`.
- Health-check cron exactly `"0 6 * * 1"` (Mondays 06:00 UTC, weekly by owner decision).
- Vercel env vars (`DATABASE_URL`, `GEODATA_DATA_SOURCE=db`) are **Production scope only**; previews must stay CSV-mode.
- `db-health.yml` must FAIL when its secret is missing — no skip-when-unset (that silent skip is the bug being removed).
- Every commit message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; PR bodies end with the 🤖 Claude Code footer.
- Working branch: `claude/database-production-readiness-8d1bbf` (current worktree); repo merges use merge commits.
- Owner-performed steps (secrets, hook, Vercel env) are marked **[OWNER]** — Claude provides exact commands/clicks but never handles credential values.

---

### Task 1: Verify the session-pooler import path locally **[OWNER-GATED, BLOCKER]**

Proves imports work over the IPv4-compatible session pooler before anything is built on it (spec §3.3, rollout step 1). GitHub runners have no IPv6; the true direct host is IPv6-only.

**Files:** none (temporary local `.env` edit, reverted).

**Interfaces:**
- Produces: confirmed session-pooler connection string format that Task 8 stores as the `DIRECT_URL` repo secret.

- [ ] **Step 1 [OWNER]: Fetch the session pooler string**

Supabase dashboard → project → **Connect** → **Session pooler** tab. Copy the URI — shape:

```
postgresql://postgres.<project-ref>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

(Host says `pooler.supabase.com`, port `5432`, user `postgres.<project-ref>` — that combination is the session pooler. `aws-1` vs `aws-0` varies by project; copy whatever the dashboard shows.)

- [ ] **Step 2 [OWNER]: Point local `DIRECT_URL` at it temporarily**

In `apps/web/.env`, comment out the existing `DIRECT_URL=` line and add the session-pooler URI as `DIRECT_URL=` beneath it.

- [ ] **Step 3: Run the import over the session pooler**

```bash
cd apps/web && npm run data:import
```

Expected: the run completes with `Parity status: PASSED` in the printed report and exit code 0. (Data is unchanged since 2026-07-14, so this is a no-op re-mirror — the point is proving the connection path.)

If it fails on connection: fallbacks are the Supabase IPv4 add-on (~$4/mo) or using the pooled URL as CI's `DIRECT_URL` (supported, warns). Stop and surface to owner before proceeding.

- [ ] **Step 4 [OWNER]: Revert `.env`**

Restore the original `DIRECT_URL` (true direct host) and delete the temporary line. Verify with:

```bash
cd apps/web && npm run data:import
```

Expected: `Parity status: PASSED` again (now over the direct connection, no fallback warning).

---

### Task 2: Create `.github/workflows/deploy-production.yml`

**Files:**
- Create: `.github/workflows/deploy-production.yml`

**Interfaces:**
- Consumes: CI workflow named `CI` (`.github/workflows/ci.yml`); npm scripts `prisma:deploy`, `data:import`; secrets `DIRECT_URL`, `VERCEL_DEPLOY_HOOK_URL` (created in Task 8).
- Produces: workflow display name `Deploy production` (referenced by runbook docs in Task 6 and rollout commands in Tasks 9/11); concurrency group `production-deploy`.

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/deploy-production.yml` with exactly:

```yaml
name: Deploy production

# The single road to production (spec: docs/superpowers/specs/
# 2026-07-28-database-production-readiness-design.md). Vercel auto-deploy for
# main is disabled in apps/web/vercel.json, so production only updates when
# this workflow succeeds: CI green on main -> converge the Supabase mirror to
# the checkout (migrations + parity-checked import, unconditionally — the
# import is idempotent) -> POST the Vercel deploy hook, whose db-mode build
# re-verifies the mirror row-by-row. Any failure leaves production serving
# its previous deploy.

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: production-deploy
  cancel-in-progress: false

defaults:
  run:
    working-directory: apps/web

jobs:
  import-and-deploy:
    name: Converge mirror, then deploy
    # workflow_run also fires when CI fails; deploy only after green CI.
    # workflow_dispatch is the manual escape hatch (reruns, rollout,
    # deploying past a known-flaky check).
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      # The deploy hook always builds latest main, so the import must also
      # run from latest main (not the workflow_run head SHA).
      - uses: actions/checkout@v4
        with:
          ref: main
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      # DIRECT_URL is the Supabase session pooler string (port 5432): GitHub
      # runners are IPv4-only and the true direct host is IPv6-only.
      # prisma.config.ts and the import both resolve DIRECT_URL first.
      - name: Apply migrations (no-op when none are new)
        env:
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: npm run prisma:deploy
      - name: Converge mirror (parity-checked import)
        env:
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: npm run data:import
      - name: Trigger Vercel production build
        env:
          VERCEL_DEPLOY_HOOK_URL: ${{ secrets.VERCEL_DEPLOY_HOOK_URL }}
        run: curl -fsS --retry 3 -X POST "$VERCEL_DEPLOY_HOOK_URL"
```

- [ ] **Step 2: Validate the YAML parses**

From the repo root:

```bash
npx --yes js-yaml .github/workflows/deploy-production.yml
```

Expected: the parsed document prints as JSON, exit code 0. A syntax error exits non-zero — fix before committing.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-production.yml
git commit -m "feat(deploy): add Actions-owned production deploy workflow

CI-green gate (workflow_run) -> prisma:deploy + unconditional parity-checked
data:import -> Vercel deploy hook. workflow_dispatch is the manual escape
hatch. Spec 2026-07-28 §3.1–§3.2.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Create `.github/workflows/db-health.yml`

**Files:**
- Create: `.github/workflows/db-health.yml`

**Interfaces:**
- Consumes: secret `DATABASE_URL` (pooled; created in Task 8); npm script `build`; env switch `GEODATA_DATA_SOURCE=db` (existing, `apps/web/lib/data/servedData.ts`).
- Produces: workflow display name `DB health` (referenced by runbook docs in Task 6 and rollout Task 12).

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/db-health.yml` with exactly:

```yaml
name: DB health

# Weekly db-mode build (spec 2026-07-28 §3.4): one green run proves the
# Supabase mirror is reachable and credentialed and still matches the
# checkout's CSVs row-by-row, and the activity prevents free-tier pausing.
# Weekly cadence is an owner decision; if a quiet week ever pauses the
# project anyway, bump this to twice-weekly.
#
# Deliberately NO skip-when-secret-missing: a misconfigured secret must fail
# loudly (the old ci.yml db-build job skipped silently for weeks).

on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:

permissions:
  contents: read

defaults:
  run:
    working-directory: apps/web

jobs:
  db-build:
    name: DB-mode build (Supabase mirror)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      - name: Build from the database mirror
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GEODATA_DATA_SOURCE: db
        run: npm run build
```

- [ ] **Step 2: Validate the YAML parses**

```bash
npx --yes js-yaml .github/workflows/db-health.yml
```

Expected: parsed JSON printed, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/db-health.yml
git commit -m "feat(deploy): add weekly db-health workflow (keep-alive + drift check)

Mondays 06:00 UTC db-mode build against the pooled connection; fails loudly
when the secret is missing. Spec 2026-07-28 §3.4.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Remove the silently-skipping `db-build` job from CI

**Files:**
- Modify: `.github/workflows/ci.yml:36-62`

**Interfaces:**
- Consumes: nothing.
- Produces: `ci.yml` keeps jobs `checks` and `e2e` only; its display name stays `CI` (Task 2's `workflow_run` reference depends on it).

- [ ] **Step 1: Delete the job**

In `.github/workflows/ci.yml`, delete this entire block (the comment and the `db-build` job — between the `checks` job's last line and the `e2e` job):

```yaml
  # Post-merge check of the canonical serving path: builds from the Supabase
  # mirror (including the build's row-by-row DB<->CSV verification). Runs on
  # main only — on a data PR the mirror legitimately lags the CSVs until
  # `npm run data:import` runs after merge, so this must not block PRs.
  # Requires the DATABASE_URL repository secret; skips (green) when unset.
  db-build:
    name: DB-mode build (Supabase mirror)
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      - name: Build from the database mirror
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GEODATA_DATA_SOURCE: db
        run: |
          if [ -z "$DATABASE_URL" ]; then
            echo "DATABASE_URL secret not configured — skipping db-mode build."
            exit 0
          fi
          npm run build
```

Rationale (goes in the commit message): every real deploy now verifies the mirror during the Vercel build, and `DB health` covers the steady state; this job's skip-when-unset behavior hid a never-configured secret for weeks.

- [ ] **Step 2: Validate the YAML parses and jobs are intact**

```bash
npx --yes js-yaml .github/workflows/ci.yml
```

Expected: parsed JSON printed with exactly two keys under `jobs` (`checks`, `e2e`), exit code 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(ci): drop the silently-skipping db-build job

Superseded: the deploy workflow's Vercel build verifies the mirror on every
real deploy, and db-health.yml covers the steady state. The job had been
skipping green since it landed because the DATABASE_URL secret was never
created. Spec 2026-07-28 §3.5.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Create `apps/web/vercel.json` (disable auto-deploy for `main` only)

**Files:**
- Create: `apps/web/vercel.json` (Vercel reads it from the project Root Directory, which is `apps/web`)

**Interfaces:**
- Consumes: nothing.
- Produces: `main` pushes no longer auto-deploy; previews for all other branches unchanged. Production deploys arrive only via the deploy hook (Task 2's final step). Deploy hooks operate independently of `git.deploymentEnabled`, which is verified live in Task 9.

- [ ] **Step 1: Write the file**

Create `apps/web/vercel.json` with exactly:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

- [ ] **Step 2: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/web/vercel.json','utf8')); console.log('vercel.json OK')"
```

Expected: `vercel.json OK`, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/vercel.json
git commit -m "feat(deploy): disable Vercel auto-deploy for main (previews unchanged)

Production now deploys only via the deploy hook at the end of the
deploy-production workflow, guaranteeing import-before-build ordering.
Spec 2026-07-28 §3.1.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Documentation — deployment.md, database-import.md, .env.example

**Files:**
- Modify: `docs/deployment.md` (sections: How deploys happen, Manual operations, Environment variables; new sections: GitHub Actions credentials, Runbook, Scheduled health check)
- Modify: `docs/data-methodology/database-import.md` (One-time setup addition; Re-running section rewrite; Failure modes addition)
- Modify: `apps/web/.env.example` (session-pooler comment)

**Interfaces:**
- Consumes: workflow names `Deploy production` / `DB health` (Tasks 2–3), secret names (Global Constraints), `vercel.json` behavior (Task 5).
- Produces: the runbook the rollout tasks (9–12) and future operators follow.

- [ ] **Step 1: Rewrite `docs/deployment.md` "How deploys happen"**

Replace the entire existing section (the two bullets under `## How deploys happen`) with:

```markdown
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
```

- [ ] **Step 2: Update the manual-deploy bullet in "Manual operations (Vercel CLI)"**

Replace the line:

```markdown
- Manual production deploy from local checkout: `vercel deploy --prod`
  (normally unnecessary — push to `main` instead)
```

with:

```markdown
- Manual production deploy from local checkout: `vercel deploy --prod`
  (normally unnecessary — the *Deploy production* workflow owns production;
  this is the GitHub-Actions-outage fallback, see the Runbook)
```

- [ ] **Step 3: Rewrite `docs/deployment.md` "Environment variables"**

Replace the section body (keep the `NEXT_PUBLIC_SITE_URL` bullet's existing text verbatim as shown) with:

```markdown
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
```

- [ ] **Step 4: Add the three new sections to `docs/deployment.md`**

Insert between the Environment variables section and `## Connecting the custom domain (owner steps)`:

```markdown
## GitHub Actions credentials

Three repository secrets (GitHub → Settings → Secrets and variables →
Actions):

| Secret | Value | Used by |
| --- | --- | --- |
| `DIRECT_URL` | Supabase **session pooler** string (port 5432, user `postgres.<project-ref>`). GitHub runners are IPv4-only and the true direct host (`db.<ref>.supabase.co`) is IPv6-only, so CI substitutes the session pooler; local `.env` keeps the true direct URL. | migrations + import in `deploy-production.yml` |
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
| GitHub Actions outage / broken workflow | Deploys stall (visible in the Actions tab) | From a clean `main` checkout: `npm run data:import`, then `vercel deploy --prod`; or revert the `git.deploymentEnabled` line in `apps/web/vercel.json` to restore auto-deploy |
| Persistent db-mode blocker | Repeated build failures | Break-glass: switch production to CSV mode (see Environment variables) |

### Credential rotation

1. Rotate the database password in the Supabase dashboard.
2. Update the two GitHub secrets (`DIRECT_URL`, `DATABASE_URL`), the Vercel
   Production `DATABASE_URL`, and local `apps/web/.env`.
3. Run *DB health* from the Actions tab and confirm it goes green.

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
failed-workflow notification.
```

- [ ] **Step 5: Update `docs/data-methodology/database-import.md`**

5a. After the `## One-time setup` numbered list (after item 5), add:

```markdown
### CI credentials (GitHub Actions)

The deploy pipeline runs the same commands in CI. GitHub-hosted runners are
IPv4-only and Supabase's true direct host (`db.<ref>.supabase.co`) is
IPv6-only, so the `DIRECT_URL` **repository secret** holds the Supabase
**session pooler** string (port 5432, user `postgres.<project-ref>`)
instead — it behaves like a direct connection for migrations and the
import. Local `.env` keeps the true direct URL. Secret table:
`docs/deployment.md`.
```

5b. Replace the entire `## Re-running for a new data year` section with:

```markdown
## Re-running for a new data year

1. Land the reviewed CSVs as usual (extraction → staging → review →
   promotion into `data/imports/`, with the matching methodology doc).
2. If the data introduced new columns or datasets, reconcile
   `apps/web/prisma/schema.prisma` and author the migration in development
   (`npm run prisma:migrate`); commit it with the data change.
3. Merge to `main`. Nothing else is manual: after CI passes,
   `.github/workflows/deploy-production.yml` applies any new migrations
   (`npm run prisma:deploy`), re-runs `npm run data:import` (every
   production deploy converges the mirror to the checkout,
   unconditionally), and triggers the Vercel production build, which
   re-verifies the mirror row-by-row. The parity report is in the workflow
   log.

### Manual fallback (Actions outage or local work)

From `apps/web`, with `.env` configured:

1. `npm run prisma:deploy` (only if there are new migrations).
2. `npm run data:import`; check the report says `Parity status: PASSED`.
3. Redeploy the site (`vercel deploy --prod` from the repo root, or rerun
   the *Deploy production* workflow once Actions is back).
```

5c. In `## Failure modes`, add one bullet at the top of the list:

```markdown
- Import fails inside the deploy pipeline → the *Deploy production* workflow
  goes red and no deploy is triggered; production keeps serving the
  previous build. Fix and rerun from the Actions tab.
```

- [ ] **Step 6: Update `apps/web/.env.example`**

After the `DIRECT_URL=` line, add:

```bash
# In GitHub Actions, the DIRECT_URL *secret* holds the Supabase session
# pooler string (port 5432, user postgres.<project-ref>) instead: runners
# are IPv4-only and the direct host above is IPv6-only. Locally keep the
# real direct connection.
```

- [ ] **Step 7: Proofread against the spec**

Read the three modified files end to end. Check: secret names match Global Constraints; workflow names are *Deploy production* / *DB health*; no leftover claims that pushing to `main` auto-deploys production; no contradiction between deployment.md and database-import.md.

- [ ] **Step 8: Commit**

```bash
git add docs/deployment.md docs/data-methodology/database-import.md apps/web/.env.example
git commit -m "docs: deploy pipeline, runbook, rotation, session-pooler CI note

deployment.md: Actions-owned production deploys, env table, runbook,
credential rotation, no-backups rationale, weekly health check.
database-import.md: automated re-run flow with manual fallback; CI
credential note. Spec 2026-07-28 §3.6–§3.7.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Local verification sweep, push branch, open PR

**Files:** none created; verifies Tasks 2–6.

**Interfaces:**
- Consumes: all prior commits on `claude/database-production-readiness-8d1bbf`.
- Produces: an open PR with green CI, ready for Task 9's merge.

- [ ] **Step 1: Run the repo checks**

```bash
cd apps/web && npm run check
```

Expected: lint, typecheck, unit tests, and data validation all pass (nothing in this branch touches app code or data — any failure is pre-existing or a mistake; investigate before proceeding).

- [ ] **Step 2: Run the production build (CSV default)**

```bash
cd apps/web && npm run build
```

Expected: static build succeeds with no `.env` needed.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin claude/database-production-readiness-8d1bbf
gh pr create --title "feat(deploy): database production readiness — Actions-owned deploy pipeline" --body "Implements docs/superpowers/specs/2026-07-28-database-production-readiness-design.md:

- deploy-production.yml: CI-green gate → prisma:deploy + unconditional parity-checked data:import → Vercel deploy hook
- db-health.yml: weekly db-mode build (keep-alive + drift check), fails loudly on missing secret
- ci.yml: drop the silently-skipping db-build job
- apps/web/vercel.json: disable Vercel auto-deploy for main (previews unchanged)
- docs: deployment runbook, credential rotation, no-backups rationale, session-pooler CI note

Merging this is rollout step 3 (spec §4): the merge itself exercises the full pipeline end-to-end while Vercel Production is still CSV-mode — zero production risk. Requires the three repo secrets (rollout step 2) to be in place first.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4: Confirm CI green on the PR**

```bash
gh pr checks --watch
```

Expected: `checks` and `e2e` both pass. Note: `Deploy production` does NOT run on the PR (workflow_run only fires for `main`) — that is correct behavior, not a gap.

---

### Task 8: Create the deploy hook and the three repo secrets **[OWNER]**

Do this BEFORE merging the PR (Task 9): the first post-merge deploy run needs all three secrets.

**Files:** none (GitHub/Vercel dashboard state).

**Interfaces:**
- Consumes: session-pooler string verified in Task 1; pooled string from `apps/web/.env`; hook URL from Vercel.
- Produces: repo secrets `DIRECT_URL`, `DATABASE_URL`, `VERCEL_DEPLOY_HOOK_URL` consumed by Tasks 2–3's workflows.

- [ ] **Step 1 [OWNER]: Create the Vercel deploy hook**

Vercel dashboard → `geodata-ge` → Settings → Git → **Deploy Hooks** → Create Hook: name `production-deploy`, branch `main`. Copy the generated URL.

- [ ] **Step 2 [OWNER]: Set the three secrets**

Each command prompts for the value — paste it there (values never land in shell history or chat):

```bash
gh secret set DIRECT_URL
```

(paste the session-pooler string from Task 1)

```bash
gh secret set DATABASE_URL
```

(paste the pooled string — port 6543 with `?pgbouncer=true`, same as local `.env`)

```bash
gh secret set VERCEL_DEPLOY_HOOK_URL
```

(paste the hook URL from Step 1)

- [ ] **Step 3: Verify**

```bash
gh secret list
```

Expected: exactly three rows — `DATABASE_URL`, `DIRECT_URL`, `VERCEL_DEPLOY_HOOK_URL` — each with a fresh `Updated` date.

---

### Task 9: Merge the PR and watch the pipeline prove itself (still CSV-mode)

Rollout step 3: production risk is zero — Vercel Production has no db env vars yet, so the hook-triggered build is CSV-mode.

**Files:** none.

**Interfaces:**
- Consumes: PR from Task 7, secrets from Task 8.
- Produces: pipeline verified end-to-end; `main` contains all workflow/config/doc changes.

- [ ] **Step 1: Merge**

```bash
gh pr merge --merge
```

Expected: merge commit lands on `main`. Vercel does NOT start a git-triggered production build (auto-deploy now disabled — first live proof of `vercel.json`).

- [ ] **Step 2: Watch CI, then the deploy workflow**

```bash
gh run list --branch main --limit 3
```

Expected sequence: `CI` runs on the merge commit (~5–8 min); when it succeeds, `Deploy production` appears. Then:

```bash
gh run watch --exit-status $(gh run list --workflow "Deploy production" --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: green. In the log: `prisma:deploy` reports no pending migrations; `data:import` prints `Parity status: PASSED`; the curl step exits 0.

- [ ] **Step 3: Confirm the hook produced a production deployment**

```bash
vercel ls geodata-ge
```

Expected: a new production deployment (● Ready) timestamped after the workflow's curl step — proving deploy hooks work with auto-deploy disabled. The site content is unchanged (same CSVs).

If NO deployment appeared: deploy hooks are being blocked by the auto-deploy setting — remove `apps/web/vercel.json` via revert PR (restores auto-deploy; system returns to pre-rollout behavior) and re-plan. This is the one architectural assumption verified only live.

---

### Task 10: Set the Vercel Production env vars **[OWNER]**

**Files:** none (Vercel project settings).

**Interfaces:**
- Consumes: pooled connection string (same value as the `DATABASE_URL` secret).
- Produces: production builds run db-mode from the next deploy onward.

- [ ] **Step 1 [OWNER]: Add the two variables (Production scope ONLY)**

Vercel dashboard → `geodata-ge` → Settings → Environment Variables → *Add*:

1. Key `DATABASE_URL`, value = pooled string (port 6543, `?pgbouncer=true`), Environments: **Production** only, mark **Sensitive**.
2. Key `GEODATA_DATA_SOURCE`, value `db`, Environments: **Production** only.

Leave Preview and Development unchecked for both — previews must keep building CSV-mode.

- [ ] **Step 2: Verify scopes**

Dashboard shows both variables listed with the `Production` badge only. (CLI check, optional: `vercel env ls` from the linked repo root — both rows say `Production`.)

---

### Task 11: First db-mode production deploy

**Files:** none.

**Interfaces:**
- Consumes: everything above.
- Produces: production served from the Supabase mirror — the flip itself.

- [ ] **Step 1: Dispatch the deploy workflow**

```bash
gh workflow run "Deploy production"
gh run watch --exit-status $(gh run list --workflow "Deploy production" --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: green; import prints `Parity status: PASSED`; curl exits 0. (If the watch command grabs the previous run because the new one hasn't registered yet, wait a few seconds and re-run the `gh run list` lookup.)

- [ ] **Step 2: Verify the Vercel build ran db-mode and succeeded**

```bash
vercel inspect https://geodata-ge.vercel.app --logs
```

Expected: newest production deployment is ● Ready and its build log shows no database errors. Success **is** the verification: any mirror↔CSV mismatch or connection failure throws during the build (`apps/web/lib/data/servedData.ts` parity assertions), so a Ready deployment built with `GEODATA_DATA_SOURCE=db` proves the parity held.

- [ ] **Step 3: Eyeball the live site**

Open https://geodata-ge.vercel.app — landing page KPI/deck render, explorer tab loads, charts draw, Georgian text intact. Content should be pixel-identical to before (same data, different source).

---

### Task 12: Health check, status docs, memory

**Files:**
- Modify: `AGENTS.md` (two sentences in Current Project State)
- Modify: `docs/superpowers/specs/2026-07-28-database-production-readiness-design.md:4` (status line)
- Update (local, not committed): memory `db-activation-2026-07.md` + `MEMORY.md`

**Interfaces:**
- Consumes: completed flip (Task 11).
- Produces: repo and memory state that future agents read as current truth.

- [ ] **Step 1: Dispatch DB health once**

```bash
gh workflow run "DB health"
gh run watch --exit-status $(gh run list --workflow "DB health" --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: green — proves the scheduled job's credentials and build path independently of the deploy workflow.

- [ ] **Step 2: Update AGENTS.md on a fresh branch**

(This session runs in a git worktree, and `main` is checked out in the primary working tree — branch straight off `origin/main` instead of checking `main` out:)

```bash
git fetch origin && git checkout -b claude/db-flip-status-docs origin/main
```

In `AGENTS.md` Current Project State, replace the sentence:

```text
Production (Vercel) still builds with the CSV default until `DATABASE_URL` + `GEODATA_DATA_SOURCE=db` are set in the Vercel project env. Update this sentence when that changes.
```

with:

```text
Production (Vercel) builds from the mirror (`GEODATA_DATA_SOURCE=db`, since 2026-07-28) via the Actions-owned deploy pipeline; CSV mode remains the documented break-glass fallback (`docs/deployment.md`).
```

And replace the deployment bullet's opening:

```text
- Deployment: Vercel project `geodata-ge` (team `durumakh-1974s-projects`), git-connected to `origin` — push to `main` auto-deploys production at https://geodata-ge.vercel.app; branches/PRs get preview deployments.
```

with:

```text
- Deployment: Vercel project `geodata-ge` (team `durumakh-1974s-projects`), git-connected to `origin` — production deploys via `.github/workflows/deploy-production.yml` (CI-green gate → parity-checked import → deploy hook; `main` auto-deploy disabled) to https://geodata-ge.vercel.app; branches/PRs still get preview deployments.
```

- [ ] **Step 3: Update the spec status line**

In `docs/superpowers/specs/2026-07-28-database-production-readiness-design.md`, replace:

```text
Status: approved design, pending implementation plan
```

with:

```text
Status: implemented 2026-07-28 (plan: docs/superpowers/plans/2026-07-28-database-production-readiness.md)
```

- [ ] **Step 4: Commit, PR, merge**

```bash
git add AGENTS.md docs/superpowers/specs/2026-07-28-database-production-readiness-design.md
git commit -m "docs: record db-mode production flip in AGENTS.md and spec status

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push -u origin claude/db-flip-status-docs
gh pr create --title "docs: record db-mode production flip" --body "Status-line updates after completing the 2026-07-28 database production readiness rollout: production now builds from the Supabase mirror via the Actions-owned deploy pipeline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
gh pr merge --merge
```

Expected: CI green, merge lands. Note: this merge itself triggers `Deploy production` (CI-green → no-op import → redeploy) — that is the steady state working as designed; confirm it goes green.

- [ ] **Step 5: Update memory**

Rewrite `C:\Users\Mylaptop\.claude\projects\C--Users-Mylaptop-Desktop-Projects-Geodata-ge\memory\db-activation-2026-07.md` so the body records: flip COMPLETE 2026-07-28; production = db-mode via Actions-owned pipeline (deploy-production.yml: CI-green gate → unconditional import → deploy hook; main auto-deploy off); db-health.yml Mondays 06:00 UTC = keep-alive + drift check (weekly by owner choice); secrets DIRECT_URL (session pooler, IPv4)/DATABASE_URL/VERCEL_DEPLOY_HOOK_URL; runbook in docs/deployment.md; break-glass = GEODATA_DATA_SOURCE=csv. Update its `MEMORY.md` index line to match (flip DONE, pipeline live).

---

## Execution notes

- Task order is strict: 1 → (2–6 in any order, 7) → 8 → 9 → 10 → 11 → 12. Tasks 2–6 are pure repo edits in the worktree; 1, 8, 10 need the owner present.
- Nothing before Task 10 can affect what visitors see; Tasks 10–11 are reversible by unsetting the two Vercel env vars.
- If Task 9 Step 3 fails (hook blocked), the single-line revert of `vercel.json` restores today's behavior exactly.
