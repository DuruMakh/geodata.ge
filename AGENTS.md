# GeoData.ge Agent Instructions

These instructions are the operating contract for agents working in this workspace. They are not the full product spec.

## Read First

Before planning or coding, read:

1. `Project_Definition.md`
2. `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`

Use those files as the source of truth for product scope and detailed requirements. Keep this `AGENTS.md` short, current, and focused on rules future agents must not miss.

## Maintenance Rule

Future agents should keep this file up to date when the durable project state changes.

Update the project-specific sections when:

- v1 moves to v2 or the active product scope changes.
- The software stack changes.
- Data architecture, import workflow, deployment workflow, or source-of-truth documents change.
- New non-negotiable project rules are approved by the user.
- Existing project rules become obsolete.

Do not casually rewrite the Engineering Behavior section. Only change it if the user explicitly asks or if there is a clear project-wide reason.

Prefer links to canonical docs over re-summarizing them.

Do not duplicate the full design spec here. Link to the spec and record only the rules that future agents need before engaging with the project.

## Context Discipline

Keep persistent agent context small, current, and non-duplicative.

- Keep `AGENTS.md` short: operational rules and durable non-negotiables only.
- Do not duplicate full specs, plans, schemas, file trees, command logs, or recent-commit summaries here.
- Store product decisions in the design spec, implementation steps in plan files, and current stack/workflow facts here only when they affect every future agent.
- Before adding persistent context, ask: could a future agent recover this from repo files, git history, or a plan in under 30 seconds? If yes, do not add it.
- Capture durable decisions, rejected alternatives, and project-specific footguns that are not obvious from code.
- Make staleness visible: update project-specific sections when v1 becomes v2, the stack changes, source-of-truth docs move, or a major workflow decision changes.
- If context grows large, split detail into a canonical doc and link to it instead of expanding this file.

## Engineering Behavior

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them; don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: would a senior engineer say this is overcomplicated? If yes, simplify.

For GeoData.ge, this does not mean skipping real data validation. Budget import validation, source checks, unmapped-row handling, and planned/actual rules are required because they address real product risks.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if you would do it differently.
- If you notice unrelated dead code, mention it; do not delete it.

When your changes create orphans:

- Remove imports, variables, and functions that your changes made unused.
- Do not remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- Add validation -> write tests for invalid inputs, then make them pass.
- Fix the bug -> write a test that reproduces it, then make it pass.
- Refactor X -> ensure tests pass before and after.

For multi-step tasks, state a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria like "make it work" require clarification.

## Current Project State

GeoData.ge is currently in v1 planning for a Georgian-first Georgia Budget Explorer.

Revenue coverage starts in 2005 because the project does not currently have a reviewed 2004 revenue source. Expenditure coverage starts in 2004.

V1 is not a broad public-data catalog. Do not re-expand scope unless the user explicitly approves it.

Current stack:

- Next.js with TypeScript.
- Vercel.
- Supabase Postgres.
- Prisma.
- Tailwind plus shadcn or a disciplined component layer.

The workspace is a git repository on `main` with a GitHub `origin` remote. Check git state before promising commits, branches, pushes, or PRs.

## V1 Non-Negotiables

V1 includes:

- Annual national budget data for 2004-2025 for expenditure and 2005-2025 for revenue.
- Revenue overview with top-level tax categories shown directly.
- Expenditure overview using public-friendly spending fields.
- Multi-year explorer.
- Single-year budget snapshot.
- CSV export.
- Georgian-first UI.
- Minimal public source label.
- Internal source/provenance metadata.

V1 excludes:

- Broad public data catalog.
- Municipal transfers explorer.
- Capital projects explorer.
- Debt explorer.
- Admin UI.
- Public API.
- User uploads.
- Quarterly or monthly data.
- Automated production extraction from DOCX/PDF.
- Clickable drilldown/detail pages into programs, subprograms, or revenue subcategories.

## Data Rules

Build data foundation before visual richness.

Raw source files under `docs/Raw Data` are organized by data side first: expenditure sources live in `Expenditure/mof.ge` for MoF Excel workbooks and `Expenditure/treasury.ge` for Treasury PDFs, while revenue PDFs live in `Revenue`.

Required data principles:

- Use stable lowercase ASCII category IDs, such as `revenue.vat` and `spending.health`.
- Georgian and English labels are display data, not identifiers.
- Public expenditure fields come from a reviewed mapping layer over official institution/program/subprogram rows.
- Multi-year charts/tables may expose official institutions, programs, and subprograms as selectable series when data exists. This is not clickable drilldown.
- If an official row cannot be confidently mapped, assign it explicitly to `spending.other_unclassified`; no official row may disappear silently from totals.
- Store mapping confidence and notes where mappings are uncertain or require review.
- Use `basis = actual | planned`.
- If planned and actual values both exist for the same item/year, actual wins in public charts, tables, and CSV.
- Planned active values need a subtle badge or planned chart marker.
- Every import should produce an internal validation report.

## UX and Visual Guardrails

Default first view:

- Expenditure.
- Multi-year.
- Nominal GEL.
- Line chart.
- 2004-2025 for expenditure; 2005-2025 for revenue.
- Total expenditure selected.

Single-year mode has no v1 drilldown and should stay top-level. Multi-year mode can allow selecting deeper official rows as chart/table series.

Production UI now follows `DESIGN.md` and the confirmed references in `docs/Design HTML files/`.

The current approved direction is a clean Apple-like analytical Budget Explorer with Light and Night themes. Older dark/neon/terminal prototype styling is superseded for production unless the user explicitly approves a new design change.

Guardrails:

- Georgian text must stay readable.
- Chart labels must remain clear.
- Color choices must be distinguishable.
- Decorative effects must not reduce data comprehension.
- Light and Night themes must keep the same layout, controls, and chart geometry.

## Workflow Rules

Use the Superpowers workflow:

1. Brainstorming/spec.
2. Writing plan.
3. Implementation.
4. Verification/review.

When library, framework, SDK, API, CLI, or cloud-service docs are needed, use Context7 for current documentation before relying on memory.

Do not claim work is complete without running relevant verification.
