# X3 build, CI and tests (checkpoint, unit suite pending)

## Summary
Checkpoint: areas 1, 2, 4, 6 and 7 drafted; unit-suite timings (area 3) still running.
Scores so far: build 5/10, CI 4/10, browser suite 4/10, flaky 6/10, gate composition 5/10.

## Findings
| id | area | severity | evidence | problem | suggested fix | effort | shared? |
|---|---|---|---|---|---|---|---|
| X3-build-ci-tests-01 | CI | high | `.github/workflows/ci.yml:54` and `:87` with `playwright.config.ts:35` | Each CI run builds the whole site twice. | Run Playwright in the checks job against the build it already made. | M | n |
| X3-build-ci-tests-02 | Browser suite | high | `npx playwright test --list`: 1403 tests in 64 files | Suite grew from 281 tests to 1403; CI runs it at 1 worker. | See report. | L | n |

## Tests to drop or merge
(pending)

## Georgian wording for owner review
None.

## Not checked (and why)
(pending)
