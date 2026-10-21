You review the build, CI and test suite of fiscal.ge (cross-cutting unit X3-build-ci-tests).
Repo root: /home/user/geodata.ge (app code in apps/web). Live production build: http://localhost:3100 (built with NEXT_PUBLIC_SITE_URL=https://fiscal.ge).
Read-only: do not edit files (except your own report file below), do not build, run `npm run check`, or install packages, and do not start/stop the server on port 3100. You may read code, fetch pages, run read-only commands (git log, npm audit --omit=dev and npm audit, du, grep), and run single existing test files. Report only real, specific problems you can point to (file:line, URL, or measured number). No "consider improving X" without evidence. Do not check whether data numbers are correct. Do not call any mcp__hearthbot__ tool.
The 30 page units already reviewed their own pages; their reports are in /home/user/geodata.ge/.superpowers/platform-review-2026-10/pages/*.md. Read them for findings marked "shared? = y" and confirm or refute them at the shared cause, but do not just copy them: your value is what a single page review cannot see.
Two existing plans already cover some work; do not re-report items they cover, but do say in one line per item if you find one of their items is still open/incomplete: (1) docs/superpowers/plans/2026-10-11-audit-fixes.md (implemented and merged in PR #176), (2) the component-reuse plan copy at /tmp/claude-0/-home-user-geodata-ge/c1a1f4d7-4aa2-5d29-89b1-55ea467d0401/scratchpad/ref/2026-10-11-component-reuse.md with its progress ledger /tmp/claude-0/-home-user-geodata-ge/c1a1f4d7-4aa2-5d29-89b1-55ea467d0401/scratchpad/ref/progress.md (Tasks 0–10 done on the owner's local branch, NOT yet merged to main; Tasks 11–14 pending).

Context you must respect (these are the owner's deliberate decisions, NOT findings):
- Under each page heading there is only one short line of small text (DESIGN.md §17). Missing summary paragraphs are intended.
- No "% of GDP" or foreign-currency tabs; those are icon-only toggles. Fewer tabs is preferred; icon toggles instead of tabs.
- Regional data uses the map; clicking a region or "Georgia" opens its own page.
- No "Imports:" / "By type:" prefixes in series names.
- Hub pages show yearly data only (inflation is the approved monthly exception).
- Georgian relative poverty is "ფარდობითი სიღარიბე".
- No tourism or exchange-rate pages.
- Lucide is the icon set; a non-Lucide icon is allowed only where DESIGN.md §7.2a allows it (e.g. the family icon on Living standards).
The authorities: DESIGN.md (visuals/interaction), Project_Definition.md §2 (scope), AGENTS.md (UI contract). Cite the section when you say something breaks a rule.

Areas:
1. Build time: the most recent production build log is at /tmp/claude-0/build.log (it includes `time` output at the end). Break down where the time goes (prebuild snapshot, compile, typecheck, static generation of ~589 pages, postbuild). Identify concrete savings.
2. CI: .github/workflows/*.yml — job graph, what runs twice, caching (npm, .next/cache, Playwright browsers), whether the browser suite rebuilds, total wall clock. Use the GitHub data available via `git log` only; you have no GitHub API. Read the workflow files and estimate.
3. Unit test suite: run `cd apps/web && npx vitest run --reporter=json --outputFile=/tmp/review-X3/vitest.json` ONCE (this is allowed for you; it does not modify the repo) and report the 15 slowest files and the 15 slowest tests, total duration, and the cost of the `pretest` snapshot rebuild. Look for slow shared setup repeated across many files (e.g. loading all CSVs, building the full snapshot, rendering whole pages) and propose one shared fixture.
4. Browser suite: count specs/tests in apps/web/tests/browser; find tests that duplicate each other across spec files (same page + same assertion), fixed sleeps (waitForTimeout), retries configured, tests that run every page at 3 viewports × 2 languages where one would prove the behaviour. Do NOT run the whole browser suite; you may run one spec file with --workers=1 against http://localhost:3100 to time it (prefix the command with PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100).
5. Suite-level redundancy: tests covering the same thing across files (unit vs browser vs data validation), snapshot tests of implementation details, tests that re-check data that `npm run data:validate` already checks.
6. Flaky tests: search git log for commits mentioning flaky/flake/retry/timeout in tests, and for test.fixme/skip/retries; report which tests and why.
7. Gate composition: what `npm run check` runs (apps/web/package.json) and its measured time per CLAUDE.md; anything run twice between check, build (prebuild/postbuild) and CI.
For each test you propose to drop or merge, give file, test name, reason, runtime, and drop / merge into <file>. Give expected total time saved on `npm test` and on the browser suite.

Write your report to /home/user/geodata.ge/.superpowers/platform-review-2026-10/pages/X3-build-ci-tests.md and REWRITE that file after each area you finish (it is your checkpoint if the session is cut off). Format:
  ## Summary (3 lines, score 1–10 per area)
  ## Findings
  | id | area | severity (critical/high/medium/low) | evidence (file:line / URL / number) | problem | suggested fix | effort (S/M/L) | shared? (y/n) |
  ## Tests to drop or merge
  | file | test | reason | runtime | drop / merge into |
  ## Georgian wording for owner review
  | page | current text | issue | suggestion |
  ## Not checked (and why)
"shared? = y" means the cause is in a shared component/helper, not this unit. Name that file.
Finding ids: X3-build-ci-tests-01, X3-build-ci-tests-02, … Severity guide: critical = security hole or page broken for everyone; high = a feature broken or unusable for a group of users (keyboard, screen reader, phone) or a large measurable waste; medium = clear defect with a workaround; low = polish.
Be efficient: aim to finish in roughly 60–80 tool calls. When done, reply with only: the report path, finding counts by severity, and the one most important finding (2 lines max).

Note: some browser specs write screenshot files into tracked docs folders; if `git status` shows changed tracked files after you run a spec, restore them with `git checkout -- <path>` and mention it in your report.
