You review ONE unit of fiscal.ge: U17-unemployment-regions — `/explorer/unemployment/regions`, `/explorer/unemployment/regions/[id]` (Georgian at `/…`, English at `/en/…`), representative page `/explorer/unemployment/regions/imereti`. Also review the map index; spot-check the smallest and largest region page. Find real slugs in the sitemap.
Files: `lib/pages/unemployment.tsx`, `lib/pages/unemployment-regions.tsx`, `components/unemployment/unemployment-regions*`. Repo root: /home/user/geodata.ge (app code in apps/web). Live production build: http://localhost:3100 (built with NEXT_PUBLIC_SITE_URL=https://fiscal.ge, so canonical URLs say https://fiscal.ge).

Read-only: do not edit files (except your own report file below), build, run `npm run check`, or install packages. Do not start or stop the server on port 3100. You may fetch pages (curl), read code, and run a single existing test file (`cd apps/web && npx vitest run tests/<path>` or one Playwright spec against the live build: `cd apps/web && PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/<name>.spec.ts --workers=1`). For a 375px check you may write a throwaway Playwright/Node script in /tmp/review-U17-unemployment-regions/ (set PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb so Playwright 1.63 finds the pre-installed Chromium; or launch with executablePath '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'). Never run `playwright install`.
Report only real, specific problems you can point to (file:line, URL, or measured number). Do not write "consider improving X" without evidence. Do not check whether numbers are correct. That is out of scope. Do not call any mcp__hearthbot__ tool.

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
1. Code quality: duplication of something that already exists in the repo (name the existing thing); dead code; oversized components; unclear types; logic that belongs in a shared helper.
2. Performance: HTML size (raw and gzip: `curl -s URL | wc -c` and `curl -s -H 'Accept-Encoding: gzip' URL | wc -c`), JS sent to the browser (sum the `/_next/static/chunks/*.js` referenced by the page, raw and gzip), data shipped but unused (e.g. RSC payload / inline JSON with fields the client never reads), client components that could be server-rendered, chart render cost, images/fonts.
3. UI/UX & design: follows DESIGN.md (heading + one lead line only, selection rules, colors, Lucide icons); clear defaults; empty/error states; readable legends and labels.
4. Mobile: 375px width: overflow, tap targets (< 44px or < 24px per WCAG 2.2), phone legend, chart readability.
5. Accessibility: heading order, chart text alternatives, keyboard use of pickers/tabs, focus visibility, contrast, lang attributes.
6. Bilingual: Georgian and English show the same controls and structure; untranslated or awkward text (list Georgian wording issues separately for the owner to review).
7. SEO & metadata: title/description, canonical, hreflang pair, JSON-LD, sitemap entry (http://localhost:3100/sitemap.xml).
8. Security: user-controlled input reaching the page (URL hash/query parsing), unsafe HTML (dangerouslySetInnerHTML), external links (rel/noopener), leaked internal data (internal ids, file paths, metadata columns in HTML/Excel).
9. Tests, both directions:
   a. Missing: important behaviour on this unit with no unit or browser test.
   b. Unneeded: existing tests for this unit that could be dropped or merged. Look for tests that duplicate another test, check implementation details instead of behaviour, re-test what a shared-component test already covers, are slow for what they prove, or are flaky. For each, give the file, the test name, the reason, its runtime if measurable, and "drop" or "merge into <file>".
   Tests live in apps/web/tests (unit: tests/explorer, tests/data, tests/lib …; browser: tests/browser/*.spec.ts).

Write your report to /home/user/geodata.ge/.superpowers/platform-review-2026-10/pages/U17-unemployment-regions.md and REWRITE that file after each area you finish (it is your checkpoint if the session is cut off). Format:
  ## Summary (3 lines, score 1–10 per area)
  ## Findings
  | id | area | severity (critical/high/medium/low) | evidence (file:line / URL / number) | problem | suggested fix | effort (S/M/L) | shared? (y/n) |
  ## Tests to drop or merge
  | file | test | reason | runtime | drop / merge into |
  ## Georgian wording for owner review
  | page | current text | issue | suggestion |
  ## Not checked (and why)
"shared? = y" means the cause is in a shared component/helper, not this unit. Name that file.
Finding ids: U17-unemployment-regions-01, U17-unemployment-regions-02, … Severity guide: critical = security hole or page broken for everyone; high = a feature broken or unusable for a group of users (keyboard, screen reader, phone) or a large measurable waste; medium = clear defect with a workaround; low = polish.
Be efficient: aim to finish in roughly 60–80 tool calls. When done, reply with only: the report path, finding counts by severity, and the one most important finding (2 lines max).
