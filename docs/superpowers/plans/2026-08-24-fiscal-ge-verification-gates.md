# Fiscal.ge Verification Gates and Share Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the paths through which stale data or a broken build passes every gate unnoticed, and finish the previous remediation plan's unshipped Stage D by removing the dual-meaning `shareEndYear` field.

**Architecture:** Two branches. Branch 1 adds a deterministic `--check` mode to the Geostat package generator, wires it into `data:validate`, removes the unit suite's write side effect, adds a build plus a tracked-tree cleanliness guard to CI, and replaces a `dataset id === budget side` string coincidence with a declared coverage source. Branch 2 removes `shareEndYear` from `ExplorerTableRow` so the table's final share column derives through the `shareValueForYear` callback it already receives.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Vitest (node environment, `tests/**/*.test.ts`, run with `--pool=forks --maxWorkers=1`), Playwright, Prisma 7 / Supabase mirror, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-24-fiscal-ge-verification-gates-design.md`

## Global Constraints

- Baseline is `main` at `275188c32`. If `main` has moved, rebase and re-run Task 0.
- **Run every command from the repository root.** `npm run … --prefix apps/web` targets the app from there. The few steps that invoke `npx tsx` directly carry their own `cd apps/web`.
- Definition of done per branch, from `CLAUDE.md`: `npm run check` and `npm run build` pass locally; `npm run test:browser` passes for branch 2; required CI green before any merge.
- **No merge without explicit user authorization.** Each branch ends at a draft pull request.
- No change to reviewed source CSVs under `data/imports/`, to the database mirror, or to production data.
- `npm run check` is not changed. `CLAUDE.md` defines `check` and `build` as separate gates deliberately.
- Reviewed CSVs under `data/imports/` remain the source of truth; never edit the database directly.
- Georgian display strings are data, not identifiers. Do not translate or rename any Georgian label in this work.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

**Branch 1 — `codex/fiscal-ge-verification-gates`**

| File | Responsibility |
| --- | --- |
| `apps/web/lib/data/generatedArtifacts.ts` | **Create.** One `assertGeneratedArtifactMatches(label, filePath, expectedContent)` shared by every generator with committed artifacts. |
| `apps/web/lib/data/nationalGdp/prepareNationalGdp.ts` | **Modify.** Delete the local helper, import the shared one, pass `"national GDP"`. |
| `apps/web/tests/data/nationalGdp/prepareNationalGdp.test.ts` | **Modify.** Import the helper from its new home; new call signature. |
| `apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts` | **Modify.** Hoist the validation JSON string; add the `else` branch that asserts the three committed artifacts match. |
| `apps/web/tests/data/municipalIndicators/geostatPackage.test.ts` | **Modify.** Flip both `buildPackage(true)` calls to `false`; add a check-mode regression guard. |
| `apps/web/scripts/prepare-geostat-municipal-indicators.ts` | **Modify.** Require exactly one of `--write` / `--check`. |
| `apps/web/package.json` | **Modify.** `data:prepare-municipal-indicators` gains `--write`; add `data:check-municipal-indicators`; `data:validate` gains it. |
| `.github/workflows/ci.yml` | **Modify.** Add `npm run build` and the tracked-tree cleanliness guard to the `checks` job. |
| `apps/web/lib/methodology/types.ts` | **Modify.** Add `coverageSource` to `MethodologyContent`. |
| `apps/web/lib/methodology/content/{expenditure,revenue,municipalities}.ts` | **Modify.** Declare `coverageSource`. |
| `apps/web/lib/methodology/catalog.ts` | **Modify.** `deriveMethodologyCoverage` switches on the declared source. |
| `apps/web/tests/methodology/catalog.test.ts` | **Modify.** Assert every live dataset declares a coverage source. |
| `docs/data-methodology/municipal-population-regional-gdp.md` | **Modify.** Document the new check command. |

**Branch 2 — `codex/fiscal-ge-share-semantics`**

| File | Responsibility |
| --- | --- |
| `apps/web/lib/explorer/share.ts` | **Create.** One `shareOfTotal(value, total)`. |
| `apps/web/tests/explorer/share.test.ts` | **Create.** Unit tests for the helper. |
| `apps/web/components/main-explorer/explorer-table.tsx` | **Modify.** Final column derives via `shareValueForYear`. |
| `apps/web/components/main-explorer/indicators.tsx` | **Modify.** Read `shareByYear?.[endYear]`. |
| `apps/web/components/municipalities/municipal-explorer.tsx` | **Modify.** Callback calls `shareOfTotal`; two comments updated. |
| `apps/web/lib/explorer/types.ts` | **Modify.** Remove `shareEndYear` from `ExplorerTableRow`. |
| `apps/web/lib/explorer/explorerData.ts` | **Modify.** Stop emitting the field. |
| `apps/web/lib/explorer/municipalData.ts` | **Modify.** Stop emitting the field; drop the `endValue` / `endTotal` locals. |
| `apps/web/tests/explorer/{explorerData,municipalData,indicators,integration}.test.ts` | **Modify.** Move the two real guarantees onto the surviving mechanism. |
| `docs/superpowers/plans/2026-08-24-fiscal-ge-audit-remediation.md` | **Modify.** Mark Stage D complete. |

---

## Task 0: Preflight and drift check

**Files:** none modified.

**Interfaces:**
- Consumes: nothing.
- Produces: a verified-clean baseline for every later task.

- [ ] **Step 1: Confirm the baseline**

```bash
git log --oneline -1 && git status --porcelain
```

Expected: `275188c32 Merge pull request #73 …` and empty status. If `main` has moved, rebase this plan's branch onto the new `main` before continuing.

- [ ] **Step 2: Create the branch**

```bash
git checkout -b codex/fiscal-ge-verification-gates main
```

- [ ] **Step 3: Install dependencies (this worktree has no `node_modules`)**

```bash
npm ci --prefix apps/web
```

- [ ] **Step 4: Establish the green baseline**

```bash
npm run check --prefix apps/web
```

Expected: lint clean, typecheck clean, all test files passing, data validation clean. **If this is red, stop and report — do not start Task 1 on a red baseline.**

Note: `tests/seo/opengraphImage.test.ts` is a known environmental flake (5s timeout under the shared forked process). If it is the only failure, re-run the four gates separately (`npm run lint`, `npm run typecheck`, `npm test`, `npm run data:validate`) before declaring the baseline red.

- [ ] **Step 5: BLOCKING — check the Geostat artifacts for existing drift**

```bash
npm run data:prepare-municipal-indicators --prefix apps/web && git status --porcelain
```

Expected: empty output from `git status`.

**If any of these three files appears as modified — stop and report to the user. Do not commit the regenerated files.**

- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/municipal-population-annual-2015-2025.csv`
- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/regional-gdp-annual-2005-2025-available-years.csv`
- `docs/Raw Data/Municipalities/geostat-population-regional-gdp/validation-report.json`

The population CSV is the upstream input to `scripts/prepare-municipal-population-2025.ts`, which produces the served population denominator behind every budget-per-resident figure. Regenerating it is a data change requiring methodology review under `AGENTS.md`, not a silent commit inside a tooling branch. Revert with `git checkout -- "docs/Raw Data"` and report what changed.

- [ ] **Step 6: BLOCKING — check the geometry artifact for existing drift**

```bash
npm run data:check-municipality-geometry --prefix apps/web
```

Expected: exits 0. If it fails, stop and report — the committed geometry artifact is already stale and that is a data question, not a tooling one.

---

## Task 1: Shared generated-artifact staleness helper

**Files:**
- Create: `apps/web/lib/data/generatedArtifacts.ts`
- Modify: `apps/web/lib/data/nationalGdp/prepareNationalGdp.ts` (remove lines 217-225, update the call at line 328)
- Test: `apps/web/tests/data/nationalGdp/prepareNationalGdp.test.ts` (imports at lines 7-13, test at lines 62-70)

**Interfaces:**
- Consumes: nothing.
- Produces: `assertGeneratedArtifactMatches(label: string, filePath: string, expectedContent: string): Promise<void>` — throws `Generated ${label} artifact is stale: ${relativePath}` when the file differs. Task 2 consumes it.

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/data/nationalGdp/prepareNationalGdp.test.ts`, replace the existing import block (lines 7-13) with:

```ts
import { assertGeneratedArtifactMatches } from "../../../lib/data/generatedArtifacts";
import {
  prepareNationalGdp,
  validateGdpWorkbookTitle,
  validateNationalGdpSeries,
  validatePublishedOneDecimal,
} from "../../../lib/data/nationalGdp/prepareNationalGdp";
```

and replace the test at lines 62-70 with:

```ts
  it("fails when a generated artifact differs byte-for-byte", async () => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "geodata-gdp-check-"));
    const artifactPath = path.join(tempDirectory, "artifact.csv");
    await fs.writeFile(artifactPath, "stale\n", "utf8");

    await expect(
      assertGeneratedArtifactMatches("national GDP", artifactPath, "generated\n"),
    ).rejects.toThrow("Generated national GDP artifact is stale");
  });

  it("names the dataset in the staleness error so one generator is never blamed for another", async () => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "geodata-label-check-"));
    const artifactPath = path.join(tempDirectory, "artifact.csv");
    await fs.writeFile(artifactPath, "stale\n", "utf8");

    await expect(
      assertGeneratedArtifactMatches("Geostat municipal indicators", artifactPath, "generated\n"),
    ).rejects.toThrow("Generated Geostat municipal indicators artifact is stale");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --prefix apps/web -- tests/data/nationalGdp/prepareNationalGdp.test.ts
```

Expected: FAIL — `Cannot find module '../../../lib/data/generatedArtifacts'`.

- [ ] **Step 3: Create the shared helper**

Create `apps/web/lib/data/generatedArtifacts.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = path.resolve(process.cwd(), "../..");

// Fails when a committed generated artifact no longer matches what its generator
// produces. `label` names the dataset: importing a caller-specific message would
// report a stale Geostat file as a stale national GDP file, and a wrong
// diagnostic costs more than a duplicated one.
export async function assertGeneratedArtifactMatches(
  label: string,
  filePath: string,
  expectedContent: string,
): Promise<void> {
  const actualContent = await fs.readFile(filePath, "utf8");
  if (actualContent !== expectedContent) {
    throw new Error(`Generated ${label} artifact is stale: ${path.relative(REPO_ROOT, filePath)}`);
  }
}
```

- [ ] **Step 4: Point `prepareNationalGdp.ts` at the shared helper**

Delete this whole function (lines 217-225):

```ts
export async function assertGeneratedArtifactMatches(
  filePath: string,
  expectedContent: string,
): Promise<void> {
  const actualContent = await fs.readFile(filePath, "utf8");
  if (actualContent !== expectedContent) {
    throw new Error(`Generated national GDP artifact is stale: ${path.relative(REPO_ROOT, filePath)}`);
  }
}
```

Add to the import block at the top of the file, after `import { csvEscape } from "../csvEscape";`:

```ts
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
```

Change the call at line 328 from:

```ts
      artifacts.map((artifact) => assertGeneratedArtifactMatches(artifact.filePath, artifact.content)),
```

to:

```ts
      artifacts.map((artifact) =>
        assertGeneratedArtifactMatches("national GDP", artifact.filePath, artifact.content),
      ),
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test --prefix apps/web -- tests/data/nationalGdp/prepareNationalGdp.test.ts
```

Expected: PASS, including both staleness tests. The national GDP message text is unchanged from before this task — `Generated national GDP artifact is stale: <path>`. Because it is unchanged, `docs/data-methodology/national-nominal-gdp.md` needs no edit; the spec made that update conditional on the wording changing.

- [ ] **Step 6: Typecheck and lint**

```bash
npm run typecheck --prefix apps/web && npm run lint --prefix apps/web
```

Expected: both clean. If `REPO_ROOT` is now unused in `prepareNationalGdp.ts`, lint will say so — check whether the constant is still used by `PACKAGE_DIR`, `STAGING_PATH`, `CANONICAL_PATH` and `REPORT_PATH` (it is, at lines 29-52), so it stays.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/data/generatedArtifacts.ts apps/web/lib/data/nationalGdp/prepareNationalGdp.ts apps/web/tests/data/nationalGdp/prepareNationalGdp.test.ts
git commit -m "$(cat <<'EOF'
refactor: share the generated-artifact staleness check and name its dataset

The national GDP generator's staleness helper is about to back a second
generator. Its error message hardcoded "national GDP", which would have
reported a stale Geostat file under the wrong dataset name.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Geostat package check mode

**Files:**
- Modify: `apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts` (lines 971-975)
- Test: `apps/web/tests/data/municipalIndicators/geostatPackage.test.ts` (lines 751 and 807)

**Interfaces:**
- Consumes: `assertGeneratedArtifactMatches(label, filePath, expectedContent)` from Task 1.
- Produces: `buildGeostatPackage({ write: false })` now rejects when any of the three committed artifacts is stale. Task 3 wires this to a CLI flag.

**Note on test-first for this task.** The throw behavior itself is covered by Task 1's temp-file tests, which is how `prepareNationalGdp` already tests it. This task cannot tamper with the real committed artifacts to force a throw, because doing so would reintroduce the very tracked-file write this branch removes. Task 2's committed test is therefore a regression guard — it fails the day the artifacts drift — plus a one-off manual verification in Step 6 that reverts immediately.

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/data/municipalIndicators/geostatPackage.test.ts`, add this test inside the existing `describe("Geostat population and regional GDP research package", …)` block:

```ts
  it("validates the committed artifacts in check mode and writes nothing", async () => {
    const artifactPaths = [
      path.join(packageDir, "municipal-population-annual-2015-2025.csv"),
      path.join(packageDir, "regional-gdp-annual-2005-2025-available-years.csv"),
      path.join(packageDir, "validation-report.json"),
    ];
    const before = artifactPaths.map((filePath) => fs.readFileSync(filePath));

    await expect(buildPackage(false)).resolves.toBeDefined();

    for (const [index, filePath] of artifactPaths.entries()) {
      expect(fs.readFileSync(filePath).equals(before[index]!)).toBe(true);
    }
  });
```

- [ ] **Step 2: Flip the two writing tests to check mode**

At line 751, change:

```ts
    await buildPackage(true);
```

to:

```ts
    await buildPackage(false);
```

At line 807, make the identical change. Leave every assertion below both calls exactly as it is — those `readPackageCsvRows` and workbook reads now describe the committed files rather than files the test just produced, and that change of meaning is the point of this task.

- [ ] **Step 3: Run the test file to verify the new guard does not yet validate anything**

```bash
npm test --prefix apps/web -- tests/data/municipalIndicators/geostatPackage.test.ts
```

Expected: PASS, but for the wrong reason — `write: false` currently skips the comparison entirely, so the new test only proves nothing was written. Step 4 gives it teeth. Record the pass; it must still pass after Step 4.

- [ ] **Step 4: Add the check branch**

In `apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts`, add to the import block at the top, after `import { csvEscape } from "../csvEscape";`:

```ts
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
```

Add this constant immediately below the import block:

```ts
const GEOSTAT_ARTIFACT_LABEL = "Geostat municipal indicators";
```

Replace lines 971-975:

```ts
  if (options.write) {
    await fs.writeFile(paths.populationOutput, populationCsv, "utf8");
    await fs.writeFile(paths.gdpOutput, gdpCsv, "utf8");
    await fs.writeFile(paths.validationOutput, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  }
```

with:

```ts
  const validationJson = `${JSON.stringify(validation, null, 2)}\n`;
  const artifacts = [
    { filePath: paths.populationOutput, content: populationCsv },
    { filePath: paths.gdpOutput, content: gdpCsv },
    { filePath: paths.validationOutput, content: validationJson },
  ];

  if (options.write) {
    await Promise.all(
      artifacts.map((artifact) => fs.writeFile(artifact.filePath, artifact.content, "utf8")),
    );
  } else {
    // Check mode is the gate: the committed package is only trustworthy if it is
    // byte-identical to what this generator produces from the preserved sources.
    await Promise.all(
      artifacts.map((artifact) =>
        assertGeneratedArtifactMatches(GEOSTAT_ARTIFACT_LABEL, artifact.filePath, artifact.content),
      ),
    );
  }
```

- [ ] **Step 5: Run the test file to verify it passes with teeth**

```bash
npm test --prefix apps/web -- tests/data/municipalIndicators/geostatPackage.test.ts
```

Expected: PASS, all 12 tests. The suite now compares generated content against the committed artifacts on every run.

- [ ] **Step 6: Manually verify the throw path, then revert**

```bash
printf 'x' >> "docs/Raw Data/Municipalities/geostat-population-regional-gdp/validation-report.json"
npm test --prefix apps/web -- tests/data/municipalIndicators/geostatPackage.test.ts
```

Expected: FAIL with `Generated Geostat municipal indicators artifact is stale: docs/Raw Data/Municipalities/geostat-population-regional-gdp/validation-report.json`.

Then revert immediately and confirm:

```bash
git checkout -- "docs/Raw Data/Municipalities/geostat-population-regional-gdp/validation-report.json"
git status --porcelain
```

Expected: empty output.

- [ ] **Step 7: Confirm the suite no longer dirties the tree**

```bash
npm test --prefix apps/web && git status --porcelain
```

Expected: tests pass and `git status` prints nothing. This is success criterion 1 from the spec.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/data/municipalIndicators/prepareGeostatPackage.ts apps/web/tests/data/municipalIndicators/geostatPackage.test.ts
git commit -m "$(cat <<'EOF'
fix: stop the test suite rewriting the Geostat package it asserts against

Two tests called buildGeostatPackage({ write: true }), overwriting three
tracked artifacts and then asserting against the files they had just
produced. Drift in the generator silently rewrote the population CSV that
feeds the served per-resident denominator, and the suite still passed.

Check mode now compares all three artifacts byte-for-byte against the
committed package, and both tests read committed files.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Geostat CLI flags, npm wiring, and the geometry check

**Files:**
- Modify: `apps/web/scripts/prepare-geostat-municipal-indicators.ts`
- Modify: `apps/web/package.json`
- Modify: `docs/data-methodology/municipal-population-regional-gdp.md`

**Interfaces:**
- Consumes: `buildGeostatPackage({ write })` from Task 2.
- Produces: `npm run data:check-municipal-indicators` and an extended `data:validate`.

- [ ] **Step 1: Rewrite the script with mode flags**

Replace the entire contents of `apps/web/scripts/prepare-geostat-municipal-indicators.ts`:

```ts
import { buildGeostatPackage } from "../lib/data/municipalIndicators/prepareGeostatPackage";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-geostat-municipal-indicators.ts --write|--check");
  }
  const write = args[0] === "--write";
  const result = await buildGeostatPackage({ write });

  console.log(`${write ? "Prepared" : "Validated"} the Geostat municipal indicators package.`);
  console.log(`Population rows: ${result.populationRows.length}`);
  console.log(`Regional GDP rows: ${result.regionalGdpRows.length}`);
  console.log(
    `Regional GDP years: ${result.validation.regionalGdp.observedYears.join(", ")}`,
  );
  console.log(`Validation: ${result.validation.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Verify both modes and the flag guard**

```bash
cd apps/web && npx tsx scripts/prepare-geostat-municipal-indicators.ts --check
```

Expected: exits 0, first line `Validated the Geostat municipal indicators package.`

```bash
cd apps/web && npx tsx scripts/prepare-geostat-municipal-indicators.ts
```

Expected: exits 1 with `Usage: prepare-geostat-municipal-indicators.ts --write|--check`.

```bash
cd apps/web && npx tsx scripts/prepare-geostat-municipal-indicators.ts --write --check
```

Expected: exits 1 with the same usage error.

Return to the repository root before continuing.

- [ ] **Step 3: Update the npm scripts**

In `apps/web/package.json`, change:

```json
    "data:prepare-municipal-indicators": "tsx scripts/prepare-geostat-municipal-indicators.ts",
```

to:

```json
    "data:prepare-municipal-indicators": "tsx scripts/prepare-geostat-municipal-indicators.ts --write",
    "data:check-municipal-indicators": "tsx scripts/prepare-geostat-municipal-indicators.ts --check",
```

and change `data:validate` from:

```json
    "data:validate": "tsx scripts/validate-data-files.ts && npm run data:check-national-gdp && npm run data:check-municipal-population && npm run data:check-methodology-archives && npm run data:check-public-datasets",
```

to:

```json
    "data:validate": "tsx scripts/validate-data-files.ts && npm run data:check-national-gdp && npm run data:check-municipal-indicators && npm run data:check-municipal-population && npm run data:check-methodology-archives && npm run data:check-public-datasets",
```

**Corrected in review.** An earlier revision also appended `&& npm run data:check-municipality-geometry` here, on the strength of spec finding N2. That finding was false — `validate-data-files.ts:148` already gates the geometry artifact — so the duplicate was removed. Note also that `data:check-municipal-indicators` runs **before** `data:check-municipal-population`: the population generator reads the geostat CSV as its input, so checking it first would report the wrong root cause on geostat drift.

- [ ] **Step 4: Run the full data validation**

```bash
npm run data:validate --prefix apps/web && git status --porcelain
```

Expected: every check passes, including the two newly wired ones, and `git status` prints nothing.

- [ ] **Step 5: Update the methodology doc**

In `docs/data-methodology/municipal-population-regional-gdp.md`, find the command block near line 72 and add the check command after `npm run data:prepare-municipal-indicators`:

```
npm run data:check-municipal-indicators
```

Then extend the paragraph that begins "The preparation command regenerates only the two normalized CSVs and `validation-report.json`" with this sentence:

> `npm run data:check-municipal-indicators` regenerates the same three artifacts in memory and fails if any committed file differs byte-for-byte; it runs inside `npm run data:validate`, so a drifted package fails the repository-wide gate rather than being silently rewritten by the test suite.

- [ ] **Step 6: Commit**

```bash
git add apps/web/scripts/prepare-geostat-municipal-indicators.ts apps/web/package.json "docs/data-methodology/municipal-population-regional-gdp.md"
git commit -m "$(cat <<'EOF'
feat: gate the Geostat package and municipality geometry in data:validate

The Geostat generator had no check mode, and the municipality geometry
check had one but was never wired into data:validate. Both artifacts are
read during the build; neither was verified by any gate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: CI build step and tracked-tree cleanliness guard

**Files:**
- Modify: `.github/workflows/ci.yml` (the `checks` job, after the `npm run data:validate` step)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

**Context the implementer needs.** The audit claimed CI never builds. That is false: `apps/web/playwright.config.ts` sets the Playwright `webServer.command` to `npm run build && npm run start -- --port 3100` when `process.env.CI` is set, so the required `e2e` job already builds on every pull request. What is wrong is narrower — the `checks` job is *named* "Lint, typecheck, tests, data, build" while running no build, so a build failure surfaces as a `webServer` timeout rather than as a build error. The duplicate build is accepted deliberately for a direct signal; do not remove it later believing it redundant.

- [ ] **Step 1: Add both steps**

In `.github/workflows/ci.yml`, in the `checks` job, insert after the `- run: npm run data:validate` line and before the `# Deliberately NOT --omit=dev.` comment block:

```yaml
      # The e2e job also builds, inside Playwright's webServer. This runs the
      # build directly so a build failure reports as a build failure instead of
      # as a webServer timeout, and so the job name above stays true.
      - run: npm run build
```

Then add this as the final step of the `checks` job, after the `Audit dependencies` step:

```yaml
      # Nothing in this job may write into the repository. `git status --porcelain`
      # respects .gitignore, so the generated output under public/downloads/ and
      # data/reports/ stays invisible here — but unlike `git diff` it also reports
      # NEW files and staged changes, which is the case this guard exists for: a
      # test or script creating a file under a tracked, non-ignored path.
      - name: Fail if the job wrote into the repository
        working-directory: ${{ github.workspace }}
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            echo "The checks job modified the repository:"
            git status --porcelain
            exit 1
          fi
```

**Revised in review.** The plan originally mandated `git diff --exit-code`. Review found that misses the guard's most important case: `git diff` never reports untracked paths, so a script creating a *new* file under `data/imports/` or `docs/` — neither gitignored — would not have tripped it at all. It also hides staged changes, since bare `git diff` compares the working tree to the index. `git status --porcelain` still respects `.gitignore` but reports new and staged entries too.

- [ ] **Step 2: Verify the workflow file parses**

```bash
npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "yaml ok"
```

Expected: `yaml ok`. If `js-yaml` is unavailable offline, skip this step — the branch's own CI run in Task 6 is the authoritative parse check, and a malformed workflow fails there immediately and visibly.

- [ ] **Step 3: Verify the build and cleanliness locally**

```bash
npm run build --prefix apps/web && git status --porcelain
```

Expected: build succeeds and `git status` prints nothing. `prebuild` writes into `apps/web/public/downloads/methodology/`, `apps/web/public/downloads/data/` and `data/reports/`, all of which are gitignored, so the guard cannot be tripped by ordinary build output.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: build in the checks job and fail on any tracked-file modification

The checks job was named "Lint, typecheck, tests, data, build" but ran no
build; the build only happened inside Playwright's webServer in the e2e
job, where a failure surfaces as a server timeout. The cleanliness guard
permanently closes the class of defect fixed in the Geostat tests.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Declared methodology coverage source

**Files:**
- Modify: `apps/web/lib/methodology/types.ts` (the `MethodologyContent` type)
- Modify: `apps/web/lib/methodology/content/expenditure.ts` (the export at line 126)
- Modify: `apps/web/lib/methodology/content/revenue.ts` (the export at line 40)
- Modify: `apps/web/lib/methodology/content/municipalities.ts` (the export at line 45)
- Modify: `apps/web/lib/methodology/catalog.ts` (`deriveMethodologyCoverage`, lines 30-45)
- Test: `apps/web/tests/methodology/catalog.test.ts`

**Interfaces:**
- Consumes: `ServedBudgetFact` from `lib/servedRows`.
- Produces: `MethodologyContent["coverageSource"]`, typed as `{ kind: "budgetSide"; side: ServedBudgetFact["side"] } | { kind: "municipalTotals" }`.

**Note on the type.** The spec named a `BudgetSide` type. No such type exists in this codebase — `side` is declared inline as `"revenue" | "expenditure"` at `lib/servedRows.ts:26`. Use `ServedBudgetFact["side"]` rather than introducing a new type for one use.

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/methodology/catalog.test.ts`, add immediately after the existing `it("derives coverage from the facts for each live dataset", …)` block (ends at line 292):

```ts
  it("declares where every live dataset's coverage years come from", () => {
    expect(METHODOLOGY_CONTENT.expenditure.coverageSource).toEqual({
      kind: "budgetSide",
      side: "expenditure",
    });
    expect(METHODOLOGY_CONTENT.revenue.coverageSource).toEqual({
      kind: "budgetSide",
      side: "revenue",
    });
    expect(METHODOLOGY_CONTENT.municipalities.coverageSource).toEqual({
      kind: "municipalTotals",
    });
  });

  it("will not accept a methodology dataset that omits its coverage source", () => {
    const incomplete = {
      ...METHODOLOGY_CONTENT.expenditure,
      // @ts-expect-error - coverageSource is required; a new dataset must declare it
      coverageSource: undefined,
    } satisfies MethodologyContent;

    expect(incomplete.id).toBe("expenditure");
  });
```

Add `MethodologyContent` to the existing type-only import from `../../lib/methodology/types` at lines 14-17:

```ts
import type {
  DecisionRegisterRow,
  MethodologyArchiveSummary,
  MethodologyContent,
} from "../../lib/methodology/types";
```

The `@ts-expect-error` is the permanent guard: if `coverageSource` is ever made optional or removed, the directive becomes unused and typecheck fails. It replaces a throwaway manual edit with a committed check.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --prefix apps/web -- tests/methodology/catalog.test.ts
```

Expected: FAIL — `coverageSource` does not exist on type `MethodologyContent`, or the assertions receive `undefined`.

- [ ] **Step 3: Add the field to the type**

In `apps/web/lib/methodology/types.ts`, add to the `MethodologyContent` type immediately after `archiveManifestId: MethodologyDatasetId;`:

```ts
  // Where this dataset's coverage years come from. Declared rather than inferred:
  // the previous derivation filtered budget facts by `fact.side === id`, which
  // worked only because two of three dataset ids happened to equal the two
  // BudgetSide values. The next four datasets (ინფლაცია, მშპ, მოსახლეობა,
  // უმუშევრობა) are not budget sides.
  coverageSource:
    | { kind: "budgetSide"; side: ServedBudgetFact["side"] }
    | { kind: "municipalTotals" };
```

The file already imports `ServedBudgetFact` at line 2, so no import change is needed.

- [ ] **Step 4: Declare the source in each content module**

In `apps/web/lib/methodology/content/expenditure.ts`, add after `archiveManifestId: "expenditure",` (line 132):

```ts
  coverageSource: { kind: "budgetSide", side: "expenditure" },
```

In `apps/web/lib/methodology/content/revenue.ts`, add after `archiveManifestId: "revenue",` (line 46):

```ts
  coverageSource: { kind: "budgetSide", side: "revenue" },
```

In `apps/web/lib/methodology/content/municipalities.ts`, add after `archiveManifestId: "municipalities",` (line 51):

```ts
  coverageSource: { kind: "municipalTotals" },
```

- [ ] **Step 5: Switch the derivation onto the declared source**

In `apps/web/lib/methodology/catalog.ts`, replace `deriveMethodologyCoverage` (lines 30-45) with:

```ts
export function deriveMethodologyCoverage(
  id: MethodologyDatasetId,
  budgetFacts: readonly ServedBudgetFact[],
  municipalFacts: readonly MunicipalTotalFact[],
): { firstYear: number; lastYear: number } {
  const source = METHODOLOGY_CONTENT[id].coverageSource;
  const years =
    source.kind === "municipalTotals"
      ? municipalFacts.map((fact) => fact.year)
      : source.kind === "budgetSide"
        ? budgetFacts.filter((fact) => fact.side === source.side).map((fact) => fact.year)
        : assertNever(source);

  if (years.length === 0) {
    throw new Error(`No served years for live methodology dataset: ${id}`);
  }

  return { firstYear: Math.min(...years), lastYear: Math.max(...years) };
}
```

Add this helper immediately above `deriveMethodologyCoverage`:

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled methodology coverage source: ${JSON.stringify(value)}`);
}
```

The `No served years` guard is retained deliberately: it still catches an empty dataset, which is a real runtime condition. It stops catching a *misconfigured* dataset, which is now a typecheck failure instead.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm test --prefix apps/web -- tests/methodology/catalog.test.ts
```

Expected: PASS, including the pre-existing `derives coverage from the facts for each live dataset` and `rejects live datasets without served years` tests, which are unchanged and must still pass.

- [ ] **Step 7: Verify typecheck and lint are clean**

```bash
npm run typecheck --prefix apps/web && npm run lint --prefix apps/web
```

Expected: both clean. The `@ts-expect-error` from Step 1 must be *used* — if typecheck reports it as unused, `coverageSource` is not actually required and Step 3 was applied wrongly. That directive is spec success criterion 5, held as a committed check rather than a manual edit-and-revert.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/methodology/types.ts apps/web/lib/methodology/content apps/web/lib/methodology/catalog.ts apps/web/tests/methodology/catalog.test.ts
git commit -m "$(cat <<'EOF'
refactor: derive methodology coverage from a declared source, not the id

deriveMethodologyCoverage filtered budget facts by `fact.side === id`,
which worked only because two of three dataset ids happened to equal the
two budget-side values. The four datasets already listed as future
(ინფლაცია, მშპ, მოსახლეობა, უმუშევრობა) are not budget sides, and the
first one to go live would have thrown at build time.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Branch 1 verification and draft pull request

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: a draft pull request awaiting review.

- [ ] **Step 1: Run the full local gate**

```bash
npm run check --prefix apps/web
```

Expected: PASS. If only `tests/seo/opengraphImage.test.ts` fails, re-run the four gates separately before treating it as a regression.

- [ ] **Step 2: Run the production build**

```bash
npm run build --prefix apps/web
```

Expected: PASS.

- [ ] **Step 3: Confirm the tree is clean**

```bash
git status --porcelain
```

Expected: empty. This is the local equivalent of the new CI guard.

- [ ] **Step 4: Push and open the draft pull request**

```bash
git push -u origin codex/fiscal-ge-verification-gates
```

```bash
gh pr create --draft --base main --title "Close the data and build verification gaps" --body "$(cat <<'EOF'
Implements branch 1 of `docs/superpowers/specs/2026-08-24-fiscal-ge-verification-gates-design.md`.

## What this fixes

- **The unit suite wrote to three tracked data artifacts.** Two tests in `geostatPackage.test.ts` called `buildGeostatPackage({ write: true })`, overwriting the committed Geostat package and then asserting against the files they had just produced. The population CSV feeds the served per-resident denominator, so generator drift silently rewrote a published input and the suite still passed.
- **The Geostat package had no check mode**, so `data:validate` never verified it.
- **The Geostat package had no check mode**, so `data:validate` never verified it, and the check now runs ahead of the population check that consumes its output.
- **The `checks` CI job was named "Lint, typecheck, tests, data, build" but ran no build.** The build does happen in the required `e2e` job, inside Playwright's `webServer`, where a failure surfaces as a server timeout. This adds a direct build step and a tracked-tree cleanliness guard.
- **Methodology coverage was derived from `fact.side === id`**, a string coincidence that would break on the first non-budget-side dataset.

## Verification

- `npm run check` and `npm run build` pass locally.
- `npm test` followed by `git status --porcelain` prints nothing.
- The staleness throw path was verified manually by appending a byte to `validation-report.json` and reverting.

No reviewed source data changed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Wait for required CI and report**

```bash
gh pr checks --watch
```

Expected: `checks` and `e2e` both green. Report the result to the user. **Do not merge.**

---

## Task 7: The `shareOfTotal` helper

**Files:**
- Create: `apps/web/lib/explorer/share.ts`
- Test: `apps/web/tests/explorer/share.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `shareOfTotal(value: number | null | undefined, total: number | null | undefined): number | null`. Task 9 consumes it.

**Branch setup.** This task starts branch 2. Run first:

```bash
git checkout main && git pull && git checkout -b codex/fiscal-ge-share-semantics
```

If branch 1 has not merged yet, branch from it instead: `git checkout -b codex/fiscal-ge-share-semantics codex/fiscal-ge-verification-gates`, and rebase onto `main` once branch 1 lands.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/share.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shareOfTotal } from "../../lib/explorer/share";

describe("shareOfTotal", () => {
  it("divides the value by the total", () => {
    expect(shareOfTotal(200, 300)).toBeCloseTo(200 / 300, 12);
  });

  it("returns 1 when the value is the total", () => {
    expect(shareOfTotal(300, 300)).toBe(1);
  });

  it("keeps a served zero as a zero share", () => {
    expect(shareOfTotal(0, 300)).toBe(0);
  });

  it("returns null when the value is missing", () => {
    expect(shareOfTotal(null, 300)).toBeNull();
    expect(shareOfTotal(undefined, 300)).toBeNull();
  });

  it("returns null when the total is missing or zero", () => {
    expect(shareOfTotal(200, null)).toBeNull();
    expect(shareOfTotal(200, undefined)).toBeNull();
    expect(shareOfTotal(200, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --prefix apps/web -- tests/explorer/share.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/explorer/share'`.

- [ ] **Step 3: Create the helper**

Create `apps/web/lib/explorer/share.ts`:

```ts
// One definition of "this value's share of that total", used by every section
// that renders a share column. A served zero is a real zero share; a missing
// value or a missing or zero total has no share at all.
export function shareOfTotal(
  value: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (total === null || total === undefined || total === 0) return null;
  return value / total;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --prefix apps/web -- tests/explorer/share.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/explorer/share.ts apps/web/tests/explorer/share.test.ts
git commit -m "$(cat <<'EOF'
feat: add one shareOfTotal helper

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Move the two share guarantees onto the surviving mechanism

**Files:**
- Modify: `apps/web/tests/explorer/explorerData.test.ts` (lines 377-378)
- Modify: `apps/web/tests/explorer/municipalData.test.ts` (lines 156, 162-168)
- Modify: `apps/web/tests/explorer/integration.test.ts` (line 218)

**Interfaces:**
- Consumes: `shareOfTotal` from Task 7.
- Produces: assertions that hold on the replacement mechanism, so Task 10 can delete `shareEndYear` without losing a product rule.

**Why this task exists.** Two of these assertions encode real product rules, not implementation detail. Deleting them alongside the field would silently drop the rules. This task proves the replacement mechanism carries them *before* the field is removed, so both mechanisms are asserted equal at this commit. These are characterization tests: they pass on the current code too. That is the point — a difference here would mean the replacement is not equivalent.

- [ ] **Step 1: Move the national total-row guarantee**

In `apps/web/tests/explorer/explorerData.test.ts`, replace lines 377-378:

```ts
    expect(one.totalRow?.shareEndYear).toBe(0.375);
    expect(one.totalRow?.shareEndYear).not.toBe(1);
```

with:

```ts
    // The total row's share column reports share of GDP, not a self-referential
    // 100%. Asserted on shareByYear, which is the mechanism the table reads.
    expect(one.totalRow?.shareByYear?.[2025]).toBe(0.375);
    expect(one.totalRow?.shareByYear?.[2025]).not.toBe(1);
```

- [ ] **Step 2: Move the municipal total-row guarantee**

In `apps/web/tests/explorer/municipalData.test.ts`, add the import at the top of the file:

```ts
import { shareOfTotal } from "../../lib/explorer/share";
```

Add this helper below the existing `build` helper at the top of the file. It is deliberately the *same expression* `municipal-explorer.tsx` passes as `shareValueForYear`, so these assertions test what the section actually renders rather than a restatement of the arithmetic:

```ts
// Mirrors the shareValueForYear callback municipal-explorer.tsx supplies.
const shareFor = (model: MunicipalEntityModel, row: ExplorerTableRow, year: number) =>
  shareOfTotal(row.valuesByYear[year], model.totalRow.valuesByYear[year]);
```

Import the two types it names from `../../lib/explorer/municipalData` and `../../lib/explorer/types` if they are not already imported in this file.

Replace line 156:

```ts
    expect(model.totalRow.shareEndYear).toBe(1);
```

with:

```ts
    expect(shareFor(model, model.totalRow, 2016)).toBe(1);
```

Replace the body of the `keeps function values unchanged and divides their shares by the official total` test (lines 160-168) with:

```ts
  it("keeps function values unchanged and divides their shares by the official total", () => {
    const model = build(2016, 2016);
    const economic = model.rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    const shareSum = model.rows.reduce(
      (sum, row) => sum + (shareFor(model, row, 2016) ?? 0),
      0,
    );

    expect(economic.valuesByYear[2016]).toBe(200);
    expect(shareFor(model, economic, 2016)).toBeCloseTo(200 / 300, 6);
    // The functions do not cover the whole official total; the gap is real and
    // must stay visible.
    expect(shareSum).toBeCloseTo(265 / 300, 6);
    expect(shareSum).not.toBeCloseTo(1, 6);
  });
```

- [ ] **Step 3: Move the integration assertion**

In `apps/web/tests/explorer/integration.test.ts`, replace lines 218-221:

```ts
    expect(model.totalRow?.shareEndYear).toBeCloseTo(
      27_723_319_039 / 104_598_100_000,
      12,
    );
```

with:

```ts
    expect(model.totalRow?.shareByYear?.[2025]).toBeCloseTo(
      27_723_319_039 / 104_598_100_000,
      12,
    );
```

- [ ] **Step 4: Run the three test files**

```bash
npm test --prefix apps/web -- tests/explorer/explorerData.test.ts tests/explorer/municipalData.test.ts tests/explorer/integration.test.ts
```

Expected: PASS. Both mechanisms now produce identical values, which is the equivalence proof Task 10 depends on.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/explorer/explorerData.test.ts apps/web/tests/explorer/municipalData.test.ts apps/web/tests/explorer/integration.test.ts
git commit -m "$(cat <<'EOF'
test: assert the share guarantees on shareByYear and shareOfTotal

These three assertions encode product rules, not implementation detail:
the national total row shows share of GDP rather than 100%, the municipal
total row's share is 1, and the municipal functions deliberately do not
sum to the official total. Proving them on the replacement mechanism
before shareEndYear is removed keeps the rules when the field goes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Switch the consumers off `shareEndYear`

**Files:**
- Modify: `apps/web/components/main-explorer/explorer-table.tsx` (lines 109, 130)
- Modify: `apps/web/components/main-explorer/indicators.tsx` (line 128)
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx` (lines 52, 125, 360-366)

**Interfaces:**
- Consumes: `shareOfTotal` from Task 7; the existing `shareValueForYear: (row: ExplorerTableRow, year: number) => number | null` prop on `ExplorerTable`.
- Produces: no remaining reader of `shareEndYear` outside the two model builders, so Task 10 can delete it.

- [ ] **Step 1: Derive the table's final column through the callback**

In `apps/web/components/main-explorer/explorer-table.tsx`, replace line 109:

```tsx
                {formatShare(row.shareEndYear)}
```

with:

```tsx
                {endYear === undefined ? MISSING : formatShare(shareValueForYear(row, endYear))}
```

and replace line 130:

```tsx
                {formatShare(totalRow.shareEndYear)}
```

with:

```tsx
                {endYear === undefined ? MISSING : formatShare(shareValueForYear(totalRow, endYear))}
```

`endYear` is already defined at line 31 as `years.at(-1)`, and `MISSING` is already imported at line 2. The component now has exactly one mechanism for share: the callback its caller supplies.

- [ ] **Step 2: Read the KPI share from `shareByYear`**

In `apps/web/components/main-explorer/indicators.tsx`, replace line 128:

```tsx
      value: largestShare ? formatShare(largestShare.shareEndYear) : MISSING,
```

with:

```tsx
      value: largestShare ? formatShare(largestShare.shareByYear?.[endYear] ?? null) : MISSING,
```

This is the same number by construction — `explorerData.ts` defined `shareEndYear` as `shareByYear[endYear]`.

- [ ] **Step 3: Call `shareOfTotal` from the municipal callback**

In `apps/web/components/municipalities/municipal-explorer.tsx`, add the import alongside the existing explorer imports:

```tsx
import { shareOfTotal } from "../../lib/explorer/share";
```

Replace the `shareValueForYear` callback at lines 361-365:

```tsx
              shareValueForYear={(row, year) => {
                const amount = row.valuesByYear[year];
                const total = model.totalRow.valuesByYear[year];
                return amount === null || amount === undefined || !total ? null : amount / total;
              }}
```

with:

```tsx
              shareValueForYear={(row, year) =>
                shareOfTotal(row.valuesByYear[year], model.totalRow.valuesByYear[year])
              }
```

Then update the two comments that name the removed field. At line 52, change `// NOT a prebuilt model: change, shareEndYear, the KPIs, the movers and the` to:

```tsx
  // NOT a prebuilt model: change, the share column, the KPIs, the movers and the
```

At line 125, change `// would leave change, shareEndYear, the movers and the comparison describing` to:

```tsx
  // would leave change, the share column, the movers and the comparison describing
```

- [ ] **Step 4: Run the explorer tests**

```bash
npm test --prefix apps/web -- tests/explorer
```

Expected: PASS. `shareEndYear` still exists on the type at this point, so nothing has broken; the consumers simply no longer read it.

- [ ] **Step 5: Verify the rendered output is unchanged**

```bash
npm run test:browser --prefix apps/web
```

Expected: PASS. This is the backstop for the rendered table and KPI values in both sections — the change must be numerically inert.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/main-explorer/explorer-table.tsx apps/web/components/main-explorer/indicators.tsx apps/web/components/municipalities/municipal-explorer.tsx
git commit -m "$(cat <<'EOF'
refactor: read the final share column through shareValueForYear

ExplorerTable held two mechanisms for one concept: a shareValueForYear
callback for its share-mode cells, and a baked-in shareEndYear for the
final column. The callback is the one the caller controls, so it wins.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Remove `shareEndYear` from the row type and both builders

**Files:**
- Modify: `apps/web/lib/explorer/types.ts` (line 53)
- Modify: `apps/web/lib/explorer/explorerData.ts` (line 441)
- Modify: `apps/web/lib/explorer/municipalData.ts` (lines 116-117, 131, 155)
- Modify: `apps/web/tests/explorer/indicators.test.ts` (line 17)

**Interfaces:**
- Consumes: Tasks 7-9. No consumer of `shareEndYear` remains outside these files.
- Produces: `ExplorerTableRow` without `shareEndYear`.

- [ ] **Step 1: Remove the field from the type**

In `apps/web/lib/explorer/types.ts`, delete line 53 from `ExplorerTableRow`:

```ts
  shareEndYear: number | null;
```

- [ ] **Step 2: Run typecheck to enumerate every remaining reference**

```bash
npm run typecheck --prefix apps/web
```

Expected: FAIL, listing `lib/explorer/explorerData.ts`, `lib/explorer/municipalData.ts` and `tests/explorer/indicators.test.ts`. If any other file appears, stop — a consumer was missed in Task 9.

**Corrected during execution.** Typecheck reports three sites, not four: `municipalData.ts`'s row-level emission sits in an object literal returned from an unannotated `.map()` callback, where TypeScript's excess-property check does not fire. Typecheck is therefore a useful diagnostic but not a complete inventory. Use `grep -rn "shareEndYear" apps/web --include=*.ts --include=*.tsx` as the ground truth before editing, and again at Step 7 to confirm none survives.

- [ ] **Step 3: Stop emitting the field in the national builder**

In `apps/web/lib/explorer/explorerData.ts`, delete line 441:

```ts
      shareEndYear: endYear === undefined ? null : shareByYear[endYear] ?? null,
```

`endYear` is still used on the preceding `change:` line, so the local stays.

- [ ] **Step 4: Stop emitting the field in the municipal builder**

In `apps/web/lib/explorer/municipalData.ts`, delete line 131:

```ts
      shareEndYear: endValue !== null && endTotal ? endValue / endTotal : null,
```

and delete line 155:

```ts
    shareEndYear: 1,
```

Then replace lines 116-117:

```ts
    const endValue = lastYear === undefined ? null : valuesByYear[lastYear] ?? null;
    const endTotal = lastYear === undefined ? null : officialTotalByYear[lastYear] ?? null;
```

with:

```ts
    const endValue = lastYear === undefined ? null : valuesByYear[lastYear] ?? null;
```

`endValue` is still consumed by the `change:` call below it; `endTotal` existed only to compute `shareEndYear`.

- [ ] **Step 5: Remove the field from the test fixture**

In `apps/web/tests/explorer/indicators.test.ts`, delete line 17:

```ts
    shareEndYear: null,
```

- [ ] **Step 6: Verify typecheck and lint are clean**

```bash
npm run typecheck --prefix apps/web && npm run lint --prefix apps/web
```

Expected: both clean. Lint will flag `endTotal` if Step 4 left it behind.

- [ ] **Step 7: Confirm no reference survives**

```bash
grep -rn "shareEndYear" apps/web --include=*.ts --include=*.tsx
```

Expected: no output.

- [ ] **Step 8: Run the full test suite**

```bash
npm test --prefix apps/web
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/explorer/types.ts apps/web/lib/explorer/explorerData.ts apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/indicators.test.ts
git commit -m "$(cat <<'EOF'
refactor: remove the dual-meaning shareEndYear from ExplorerTableRow

One field name carried two incompatible meanings on a type both sections
pass to the same table: share of GDP when explorerData built the row,
share of the entity total when municipalData did. Both sections now derive
the final share column through the callback they already supply.

Completes Stage D of the 2026-08-24 audit remediation plan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Branch 2 verification, plan record, and draft pull request

**Files:**
- Modify: `docs/superpowers/plans/2026-08-24-fiscal-ge-audit-remediation.md`

**Interfaces:**
- Consumes: Tasks 7-10.
- Produces: a draft pull request awaiting review.

- [ ] **Step 1: Mark Stage D complete in the earlier plan**

In `docs/superpowers/plans/2026-08-24-fiscal-ge-audit-remediation.md`, find the Stage D section in **File Structure** and add immediately above it:

```markdown
**Stage D status: completed 2026-08-24** on branch `codex/fiscal-ge-share-semantics`, under
`docs/superpowers/plans/2026-08-24-fiscal-ge-verification-gates.md` Tasks 7-11. The stated
blocker — overlap with `codex/homepage-redesign` — cleared when PR #72 merged.
```

- [ ] **Step 2: Run the full local gate**

```bash
npm run check --prefix apps/web
```

Expected: PASS.

- [ ] **Step 3: Run the production build**

```bash
npm run build --prefix apps/web
```

Expected: PASS.

- [ ] **Step 4: Run the browser tests**

```bash
npm run test:browser --prefix apps/web
```

Expected: PASS. This branch changes rendered output paths, so this gate is required per `CLAUDE.md`.

- [ ] **Step 5: Confirm the tree is clean**

```bash
git status --porcelain
```

Expected: empty except the plan file if Step 1 is not yet committed.

- [ ] **Step 6: Commit the plan record**

```bash
git add "docs/superpowers/plans/2026-08-24-fiscal-ge-audit-remediation.md"
git commit -m "$(cat <<'EOF'
docs: record Stage D as completed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Push and open the draft pull request**

```bash
git push -u origin codex/fiscal-ge-share-semantics
```

```bash
gh pr create --draft --base main --title "Remove the dual-meaning shareEndYear (Stage D)" --body "$(cat <<'EOF'
Implements branch 2 of `docs/superpowers/specs/2026-08-24-fiscal-ge-verification-gates-design.md`, completing Stage D of the earlier audit remediation plan.

## What this fixes

`ExplorerTableRow.shareEndYear` carried two incompatible meanings on a type both sections pass to the same `ExplorerTable`: share of GDP when `explorerData.ts` built the row, share of the entity total when `municipalData.ts` did. The table already received a per-caller `shareValueForYear` callback for its share-mode cells but ignored it for the final column, so one component held two mechanisms for one concept.

Both sections now derive the final column through the callback. `lib/explorer/share.ts` holds the one `shareOfTotal` definition.

## No behavior change

This is numerically inert and was verified as such before the field was removed:

- National: `shareEndYear` was defined as `shareByYear[endYear]`, which is what the callback returns.
- Municipal: both the removed field and the retained callback divide by `officialTotalByYear`.

Three assertions encoding real product rules were moved onto the replacement mechanism in a separate commit *before* the field was deleted, so both mechanisms are asserted equal at that commit: the national total row shows share of GDP rather than 100%, the municipal total row's share is 1, and the municipal functions deliberately do not sum to the official total.

## Verification

- `npm run check`, `npm run build` and `npm run test:browser` pass locally.
- `grep -rn "shareEndYear" apps/web` returns nothing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: Wait for required CI and report**

```bash
gh pr checks --watch
```

Expected: `checks` and `e2e` both green. Report to the user. **Do not merge.**
