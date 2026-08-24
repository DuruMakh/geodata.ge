# Fiscal.ge verification gates and share semantics design

**Status:** Approved 2026-08-24

**Date:** 2026-08-24

**Baseline:** `main` at `275188c32` (PR #73 merged; remediation Stages A–C shipped, Stage D absent)

**Surface:** data-validation scripts, `npm` script wiring, CI workflow, methodology coverage derivation, and the explorer table's share column. No reviewed source data changes.

## 1. Objective

Close the paths through which incorrect data or a broken build can pass every gate unnoticed, and finish the one unshipped stage of the previous remediation plan.

This spec covers the subset of the 2026-08-23 architecture audit (re-reviewed 2026-08-24) that survives independent verification as both real and cheap. It deliberately excludes the audit's structural findings (H1 dataset registry, H2 component promotion, M3 import extraction), which the re-review argues should be designed against a concrete next dataset rather than pre-built.

## 2. Evidence base

Every claim below was re-verified against the working tree at `275188c32`. The audit and its re-review disagree on several points; where they do, this section records what the code actually shows.

### 2.1 Corrections to the audit

| Audit claim | Verified verdict |
| --- | --- |
| H3: "Required CI never builds the site" | **False.** `apps/web/playwright.config.ts` sets the Playwright `webServer.command` to `npm run build && npm run start -- --port 3100` when `process.env.CI` is set. The `e2e` job builds on every pull request, and `e2e` is a required check. The surviving defect is narrower: the `checks` job is named "Lint, typecheck, tests, data, build" while running no build, so a build failure surfaces as a `webServer` timeout rather than as a build error. |
| M2: "a forgotten mirror column is absent from both sides, so parity passes" | **False.** `assertSameServedRows` in `apps/web/lib/data/servedDataParity.ts` matches rows by the natural key and then compares `canonical(csvRow)` against `canonical(dbRow)` — full JSON with sorted top-level keys. A column present in the CSV projection but missing from the mirror mapper fails parity loudly. |
| M1: "the only thing keeping `node:fs` out of the browser bundle is `import type`" | **Accurate as a portability risk, but there is no live leak.** `components/municipalities/municipality-map.tsx` and `municipalities-index.tsx` both use `import type`; the sole value import is in the server route `app/explorer/municipalities/page.tsx`. |
| M6: `docs/Raw Data` file count | **214 tracked files** (`git ls-files`). The re-review's 208 is wrong. |
| M5: "six routes repeat the wrapper" / "five route pages" | **Seven files** carry `min-h-screen bg-[var(--paper)]` — six pages plus `app/methodology/layout.tsx`. |
| F-D: `shareEndYear` dual meaning | **Real, but no live numeric error.** `ExplorerTable` already receives a per-caller `shareColumnLabel`, and both denominators are internally consistent: `municipalData.ts` divides by `officialTotalByYear[lastYear]`, which is the same series the total row renders. The defect is structural — the component holds two mechanisms for one concept. |

### 2.2 Findings neither review made

**N1 — the unit test suite writes to three git-tracked data artifacts.**
`apps/web/tests/data/municipalIndicators/geostatPackage.test.ts` calls `buildPackage(true)` at lines 751 and 807. That resolves to `buildGeostatPackage({ write: true })`, whose write branch at `apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts:971-975` writes:

- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/municipal-population-annual-2015-2025.csv`
- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/regional-gdp-annual-2005-2025-available-years.csv`
- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/validation-report.json`

All three are tracked. Both tests then read those paths back and assert against them, so the assertions describe files the test itself just produced. The first file is the upstream input to `scripts/prepare-municipal-population-2025.ts`, which produces the served population denominator behind every budget-per-resident figure. Generator drift therefore rewrites a published denominator's source and the suite still passes.

**N2 — `data:check-municipality-geometry` exists but is not part of `data:validate`.**
`scripts/prepare-municipality-geometry.ts` already implements a `--check` mode and `package.json` already exposes it. `data:validate` runs `validate-data-files`, `check-national-gdp`, `check-municipal-population`, `check-methodology-archives` and `check-public-datasets`, and stops. The geometry artifact is read with `readFileSync` at module scope in `lib/explorer/municipalityMapData.ts` on every build.

### 2.3 Facts that shape the design

- `buildGeostatPackage` writes **only three text artifacts**. The review workbook `municipal-population-and-regional-gdp.xlsx` is authored separately by a git-ignored builder, as `docs/data-methodology/municipal-population-regional-gdp.md` line 82 states. A `--check` mode therefore needs no binary comparison and is fully deterministic.
- `apps/web/public/downloads/methodology/`, `apps/web/public/downloads/data/` and `data/reports/*.json` are all gitignored, so the `prebuild` step's writes never dirty tracked files. A tracked-tree cleanliness guard is safe to run after a build.
- `lib/data/nationalGdp/prepareNationalGdp.ts` already implements the exact staleness pattern this spec needs, via the exported `assertGeneratedArtifactMatches(filePath, expectedContent)` and a `write ? writeFile : assert` fork.

## 3. Success criteria

The work succeeds when all of the following hold:

1. `npm test` leaves the tracked working tree clean; no test writes to a tracked file.
2. `npm run data:validate` fails if either the geostat package artifacts or the municipality geometry artifact is stale relative to its generator.
3. The `checks` CI job runs a production build, and its name accurately describes its steps.
4. Any tracked-file mutation introduced by lint, tests, data validation or the build fails CI.
5. Adding a fourth methodology dataset that is not a budget side fails typecheck until it declares where its coverage years come from, instead of throwing at build time.
6. `ExplorerTableRow` has no `shareEndYear` field, and the table's final share column is derived through the same `shareValueForYear` callback that populates its share-mode cells.
7. The two share guarantees that currently live in tests survive on the replacement mechanism: the national total row's share is share-of-GDP and not 1; the municipal total row's share is 1.
8. `npm run check`, `npm run build` and `npm run test:browser` pass on each branch; required CI is green on each pull request.

## 4. Scope

### 4.1 Included

- A `--check` mode for the Geostat municipal-indicators package, wired into `data:validate` (audit L4, finding N1).
- Wiring the existing municipality-geometry check into `data:validate` (finding N2).
- Removing the write side effect from the two Geostat tests.
- Adding `npm run build` and a tracked-tree cleanliness guard to the CI `checks` job (audit H3).
- Replacing the `dataset id === budget side` coincidence in methodology coverage derivation with a declared source (audit M4).
- The previous remediation plan's unshipped Stage D: removing `shareEndYear` from `ExplorerTableRow` (audit F-D).
- Updates to `docs/data-methodology/municipal-population-regional-gdp.md` and, if the generalized helper changes its wording, `docs/data-methodology/national-nominal-gdp.md`.

### 4.2 Not included

- Audit H1 (dataset descriptor registry), H2 (promoting shared chart components out of `main-explorer/`), M3 (extracting the import transaction). Deferred until a concrete next dataset provides a design case.
- Audit M1 (`node:fs` in the view layer), M5 (shared page shell), M6 (root directory topology), L1 (`@/` alias), L2 (ui to explorer inversion), L3 (per-year npm scripts).
- Any change to reviewed source CSVs under `data/imports/`, to the database mirror, or to production data. If the work reveals drift, it stops (see section 7).
- Folding `npm run build` into `npm run check`. `CLAUDE.md` defines them as separate gates deliberately, and that stays.
- Any change to the Playwright configuration or the `e2e` job.

## 5. Design — Branch 1: verification gates

Branch name: `codex/fiscal-ge-verification-gates`.

### 5.1 D1 — deterministic Geostat package check

**Shared helper.** Move `assertGeneratedArtifactMatches` out of `lib/data/nationalGdp/prepareNationalGdp.ts` into a new `lib/data/generatedArtifacts.ts`, adding a `label` parameter so the thrown message names the dataset:

```ts
export async function assertGeneratedArtifactMatches(
  label: string,
  filePath: string,
  expectedContent: string,
): Promise<void>;
```

`prepareNationalGdp.ts` imports it and passes `"national GDP"`, preserving its current message text. Importing the existing helper unchanged was rejected: it would report "Generated national GDP artifact is stale" for a Geostat file, and a wrong diagnostic is worse than a duplicated one.

**Check branch.** `buildGeostatPackage` gains an `else` to its `if (options.write)` block that calls the helper for all three artifacts with label `"Geostat municipal indicators"`. The function's return value is unchanged in both modes.

**Script.** `scripts/prepare-geostat-municipal-indicators.ts` requires exactly one of `--write` or `--check`, matching `scripts/prepare-national-gdp.ts`. Its existing console summary is retained and its verb reflects the mode.

**Wiring.** In `apps/web/package.json`:

- `data:prepare-municipal-indicators` gains `--write`.
- New `data:check-municipal-indicators` runs `--check`.
- `data:validate` appends `&& npm run data:check-municipal-indicators`.

**Tests.** In `tests/data/municipalIndicators/geostatPackage.test.ts`, both `buildPackage(true)` calls become `buildPackage(false)`. The `readPackageCsvRows` and workbook assertions that follow them are unchanged in text but change in meaning: they now read committed files rather than files the test produced moments earlier. That change of meaning — not the removal of the write — is the point.

### 5.2 D2 — municipality geometry check

`data:validate` appends `&& npm run data:check-municipality-geometry`. No source change; the check mode already exists.

### 5.3 D3 — CI contract

In `.github/workflows/ci.yml`, the `checks` job gains two steps after `npm run data:validate`:

1. `- run: npm run build` — the job name becomes true, and a build failure reports as a build failure rather than as a Playwright `webServer` timeout.
2. A final tracked-tree cleanliness guard, run from the repository workspace root rather than the `apps/web` default working directory:

```yaml
      - name: Fail if any tracked file was modified
        working-directory: ${{ github.workspace }}
        run: git diff --exit-code
```

`git diff --exit-code` reports only modifications to tracked files, so the gitignored `prebuild` and `next build` outputs listed in section 2.3 cannot trip it. The guard is placed last so it covers lint, tests, data validation and the build in one step; its diff output names the changed files, which is sufficient attribution.

This duplicates the build already performed in the required `e2e` job, at a cost of roughly two to four minutes of CI per pull request. That cost is accepted deliberately in exchange for a direct build signal that does not depend on the Playwright server lifecycle.

`npm run check` is not changed.

### 5.4 D4 — declared methodology coverage

`MethodologyContent` in `lib/methodology/types.ts` gains:

```ts
coverageSource:
  | { kind: "budgetSide"; side: BudgetSide }
  | { kind: "municipalTotals" };
```

The three content modules under `lib/methodology/content/` declare it. `deriveMethodologyCoverage` in `lib/methodology/catalog.ts` switches exhaustively on `coverageSource.kind` with a `never` fallthrough, replacing both the `id === "municipalities"` special case and the `fact.side === id` filter. Its `No served years for live methodology dataset` guard is retained — it still catches an empty dataset, which is a real condition; it stops catching a misconfigured dataset, which becomes a typecheck failure instead.

`FUTURE_METHODOLOGY_DATASETS` is unchanged. The four listed future datasets are the reason for the change: none of them is a budget side.

## 6. Design — Branch 2: Stage D share semantics

Branch name: `codex/fiscal-ge-share-semantics`, cut from `main` after branch 1 merges.

This finishes the unshipped Stage D of `docs/superpowers/plans/2026-08-24-fiscal-ge-audit-remediation.md`, whose stated blocker (overlap with the homepage redesign branch) was removed when PR #72 merged.

- **New** `lib/explorer/share.ts` exporting one `shareOfTotal(value: number | null, total: number | null | undefined): number | null`, returning `null` when the value is absent or the total is absent or zero.
- **`lib/explorer/types.ts`** removes `shareEndYear` from `ExplorerTableRow`. `shareByYear` stays.
- **`components/main-explorer/explorer-table.tsx`** renders the final column as `formatShare(shareValueForYear(row, endYear))` for both the body rows and the total row, returning the missing marker when `endYear` is undefined.
- **`components/main-explorer/indicators.tsx`** reads `largestShare.shareByYear?.[endYear] ?? null`. This is the same number by construction: `explorerData.ts` computes `shareEndYear` as `shareByYear[endYear]`.
- **`lib/explorer/explorerData.ts`** stops emitting the field. `shareByYear` already carries every year including the last.
- **`lib/explorer/municipalData.ts`** stops emitting the field on both the function rows and the total row, and the `endValue` / `endTotal` locals that existed only to compute it are removed.
- **`components/municipalities/municipal-explorer.tsx`** calls `shareOfTotal` inside the `shareValueForYear` callback it already passes. Its two comments naming `shareEndYear` are updated to name what the code now does.

**Guarantees that must move, not disappear.** Two existing assertions encode real product rules and are rewritten against the surviving mechanism rather than deleted:

- `tests/explorer/explorerData.test.ts:377-378` asserts the national total row's end-year share is `0.375` and explicitly not `1` — that is, the total row shows share of GDP, not a self-referential 100%. This moves to `totalRow.shareByYear`.
- `tests/explorer/municipalData.test.ts:156` asserts the municipal total row's share is `1`, and `:162` asserts the function rows' shares sum to 1. These become assertions over `shareOfTotal` applied to the model, preserving both properties.

`tests/explorer/indicators.test.ts:17` and `tests/explorer/integration.test.ts:218` are mechanical updates.

## 7. Risks and stop conditions

**Drift in the Geostat artifacts (blocking).** Wiring a real `--check` into `data:validate` will fail immediately if the committed artifacts have already drifted from what the generator produces. The current circular test is exactly the mechanism that would have hidden such drift.

The first action on branch 1 is therefore:

```bash
npm run data:prepare-municipal-indicators
git status --porcelain
```

If the tree is clean, the artifacts are current and the work proceeds. **If any of the three artifacts changes, the work stops and reports.** The population CSV feeds the served per-resident denominator; regenerating it is a data change requiring methodology review under `AGENTS.md`, not a silent commit inside a tooling branch. The same stop condition applies to `npm run data:check-municipality-geometry` on its first run.

**Duplicate CI build cost.** Accepted, and recorded in section 5.3 so a later reader does not remove one build believing it redundant without knowing the trade was deliberate.

**Stage D behavior change.** The rewrite must be numerically inert. The national path is provably so (`shareEndYear` was defined as `shareByYear[endYear]`). The municipal path is provably so (both the removed field and the retained callback divide by `officialTotalByYear`). `npm run test:browser` is the backstop for the rendered table and KPI values.

## 8. Testing strategy

Every change is test-first: write the failing assertion, observe the named failure, apply the minimal fix, observe the pass.

| Change | Failing test written first |
| --- | --- |
| D1 helper | `assertGeneratedArtifactMatches` throws with the label and the relative path when the expected content differs. |
| D1 check branch | `buildGeostatPackage({ write: false })` rejects when a committed artifact does not match generated content. |
| D1 script | The script rejects zero flags and rejects both flags together. |
| D1 tests | The two flipped tests pass against committed files with no write. |
| D2 | Covered by running `npm run data:validate` and observing the geometry check execute. |
| D3 | Observed on the branch's own CI run: the build step appears and passes, and the cleanliness guard passes. |
| D4 | A synthetic fourth `MethodologyDatasetId` without a `coverageSource` fails typecheck; the three live datasets derive unchanged coverage. |
| Stage D | The two moved guarantees fail before the mechanism exists, then pass. |

Definition of done per branch, from `CLAUDE.md`: `npm run check` and `npm run build` pass locally; `npm run test:browser` passes for branch 2, which changes rendered output paths; required CI is green.

## 9. Documentation updates

- `docs/data-methodology/municipal-population-regional-gdp.md` — document `npm run data:check-municipal-indicators` and its inclusion in `data:validate`, mirroring the existing sentence at line 21 that describes `data:check-municipal-population`. Update the command block near line 72.
- `docs/data-methodology/national-nominal-gdp.md` — touch only if the generalized helper's message text changes.
- `docs/superpowers/plans/2026-08-24-fiscal-ge-audit-remediation.md` — mark Stage D complete when branch 2 merges, so the plan's record matches reality.
- No `AGENTS.md`, `Project_Definition.md` or `DESIGN.md` change. Nothing here alters scope, stack, authority or production visuals.

## 10. Delivery

Two branches, in order, each through a draft pull request:

1. `codex/fiscal-ge-verification-gates` — D1, D2, D3, D4.
2. `codex/fiscal-ge-share-semantics` — Stage D, cut after branch 1 merges.

Each branch: commits, push, draft pull request, required CI green, review. **No merge without explicit authorization.** The split reflects blast radius: branch 1 touches scripts, npm wiring, CI and one derivation function; branch 2 touches a shared view-model type and six rendering files.
