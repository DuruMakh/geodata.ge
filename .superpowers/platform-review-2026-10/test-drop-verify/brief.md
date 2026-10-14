You verify proposed test drops for fiscal.ge (repo root /home/user/geodata.ge, app in apps/web, tests in apps/web/tests). Group {{G}}.
Input: /home/user/geodata.ge/.superpowers/platform-review-2026-10/test-drop-verify/input-{{G}}.md. Each line is `Dnnn <unit> | file | test | reason | runtime | drop / merge into |`, written by a page reviewer. Reviewers are often wrong: a test that "duplicates" another may assert something the other does not, at a different viewport, language or state.

For EVERY row:
1. Find the named test(s) in the file (line numbers may be approximate; search by name). If it does not exist, verdict MISSING.
2. Read the test body AND the test(s)/file the reason says already cover it. Compare assertion by assertion: page/route, language, viewport, state, and what is asserted.
3. Verdict:
   - CONFIRMED: dropping (or merging as proposed) loses no assertion that is not checked elsewhere. Say where each assertion is still covered.
   - PARTIAL: drop/merge is right only if specific assertions move to the named target; list exactly which.
   - REJECTED: the test proves something unique (name it), or the proposal would weaken a rule in AGENTS.md / DESIGN.md / CLAUDE.md (e.g. a copy-lock that guards DESIGN §17 one-line-lead, a data-rule test for actual-vs-planned, unmapped rows, basis marking, excluded municipal codes, Excel internal-column checks). Brittle-but-important tests should be PARTIAL ("rewrite as …"), not CONFIRMED drops.
4. Runtime: for browser specs, measure per-test durations by running each affected spec file ONCE: `cd /home/user/geodata.ge/apps/web && PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/<name>.spec.ts --workers=1 --reporter=json > /tmp/verify-{{G}}/<name>.json` and read `duration` per test. For a large spec you may filter with `-g "<test name>"`. For unit tests: `npx vitest run tests/<path> --reporter=json --outputFile=/tmp/verify-{{G}}/<name>.json`. Record ms per proposed test (or "est" if you could not run it).
Rules: Read-only. Do not edit any repo file except your result file. Do not build, run `npm run check`, run the whole suite, install packages, or start/stop the server on port 3100. Some specs (e.g. trade-services.spec.ts) rewrite tracked PNG files; after any run, run `cd /home/user/geodata.ge && git status --short` and restore any changed tracked file with `git checkout -- <path>`. Do not call any mcp__hearthbot__ tool.

Write /home/user/geodata.ge/.superpowers/platform-review-2026-10/test-drop-verify/result-{{G}}.md, rewriting it every ~20 rows as a checkpoint:
  ## Summary — counts CONFIRMED / PARTIAL / REJECTED / MISSING; total measured runtime of CONFIRMED+PARTIAL drops, split into browser (s, at 1 worker) and unit (s)
  ## Verdicts
  | id | file | test | verdict | evidence (where each assertion is still covered, or what is unique) | runtime ms | final action (drop / merge into <file:test> / keep / rewrite as …) |
One row per input row, same ids. Be concise in evidence (≤ 40 words).
When done, reply with only the result path and the four counts.
