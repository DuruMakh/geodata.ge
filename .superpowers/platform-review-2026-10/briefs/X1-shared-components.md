You review the SHARED components and helpers of fiscal.ge (cross-cutting unit X1-shared-components): apps/web/components/{explorer-shell,main-explorer,ui,shell,site,seo,hub} and apps/web/lib/{explorer,i18n,navigation,seo}.
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
1. Duplication: the same logic or markup implemented more than once across components/* or lib/* (name every copy with file:line and say which one should stay). Include per-topic copies that should be configurations of a shared component.
2. API consistency: shared components whose props mean different things in different places, boolean-flag sprawl, optional props that every caller passes, inconsistent naming of the same concept (e.g. selection, measure, decimals, locale).
3. Oversized modules: files over ~600 lines or functions over ~150 lines in shared code, with a concrete split.
4. Client/server boundary: shared components marked "use client" that do not need to be, or that pull large data into client bundles. Measure: sizes of the largest client chunks in apps/web/.next/static/chunks (raw and gzip) and which shared modules dominate them.
5. Dead code: exports in shared code with no importer (verify with grep over apps/web, including tests and scripts).
6. Accessibility and design primitives: shared controls (tabs, pickers, tooltips, legends, toggles) — keyboard support, ARIA roles, focus ring, DESIGN.md compliance — since a defect here affects every page.
7. Tests: shared components with no direct test; tests that re-test shared behaviour in many page-level files (name them).

Write your report to /home/user/geodata.ge/.superpowers/platform-review-2026-10/pages/X1-shared-components.md and REWRITE that file after each area you finish (it is your checkpoint if the session is cut off). Format:
  ## Summary (3 lines, score 1–10 per area)
  ## Findings
  | id | area | severity (critical/high/medium/low) | evidence (file:line / URL / number) | problem | suggested fix | effort (S/M/L) | shared? (y/n) |
  ## Tests to drop or merge
  | file | test | reason | runtime | drop / merge into |
  ## Georgian wording for owner review
  | page | current text | issue | suggestion |
  ## Not checked (and why)
"shared? = y" means the cause is in a shared component/helper, not this unit. Name that file.
Finding ids: X1-shared-components-01, X1-shared-components-02, … Severity guide: critical = security hole or page broken for everyone; high = a feature broken or unusable for a group of users (keyboard, screen reader, phone) or a large measurable waste; medium = clear defect with a workaround; low = polish.
Be efficient: aim to finish in roughly 60–80 tool calls. When done, reply with only: the report path, finding counts by severity, and the one most important finding (2 lines max).

Note: some browser specs write screenshot files into tracked docs folders; if `git status` shows changed tracked files after you run a spec, restore them with `git checkout -- <path>` and mention it in your report.
