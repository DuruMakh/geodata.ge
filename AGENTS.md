# GeoData.ge Agent Instructions

These are durable, always-loaded rules for this repository. Load task-specific detail only when the task needs it.

## Task-Routed Sources

- Feature scope: read `Project_Definition.md` section 2.
- UI or interaction work: read `DESIGN.md` and the current task's approved spec.
- Data work: read the relevant file under `docs/data-methodology/`.
- Deployment work: read `docs/deployment.md`.
- Commands and definition of done: read `CLAUDE.md`.
- Historical provenance only: consult `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`; it is not authoritative for current work.

Repository precedence: `Project_Definition.md` section 2 owns scope; `DESIGN.md` owns production visuals and interactions; an approved task spec owns its bounded decisions; this file owns always-relevant stack, workflow, and operational constraints. For current status claims, live repository, CI, deployment, or URL evidence outranks remembered or historical text.

## Context Maintenance

- Keep only durable, always-relevant constraints here.
- Put scope in `Project_Definition.md`, visuals in `DESIGN.md`, task decisions in specs, implementation steps in plans, and operational detail in methodology or runbooks.
- Do not add recent commits, command logs, detailed coverage inventories, or branch-specific implementation summaries.
- Update this file only when an always-relevant stack, workflow, authority, or non-negotiable changes.
- Do not casually rewrite the Engineering Behavior section. Change it only with explicit user approval or a clear project-wide reason.

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

## Project Snapshot

GeoData.ge v1 is an implemented Georgian-first Georgia Budget Explorer, not a broad public-data catalog. Current route families are expenditure, revenue, municipalities, and single-year analysis under `/explorer`.

The stack is Next.js 16, strict TypeScript, Tailwind v4, and the custom editorial component layer; do not introduce shadcn. Reviewed CSVs under `data/imports/` are the canonical human-reviewed source of truth. Supabase Postgres via Prisma 7 is the serving mirror, populated only by the transactional, parity-checked `npm run data:import`; never edit the database directly. Builds remain fully static, with CSV mode as the documented fallback. See `docs/data-methodology/database-import.md`.

Explorer pages remain prerendered and are served as static output. The single exception is `/mcp`, the read-only MCP endpoint: it is the application's only request-time route, and it answers from a snapshot bundled at build time, with no dataset database or filesystem access outside the deployed bundle. Its sole network exception is the configured Upstash rate-limit counter; no request fetches budget data or source documents. Its operating limits, pause switch and logging policy live in `docs/deployment.md`.

Production deploys to Vercel through the Actions-owned, CI-gated pipeline. `docs/deployment.md` owns project identifiers, environment configuration, release operations, rollback, and live-verification procedure.

A branch implementation, merged commit, green deploy-trigger workflow, or accepted Vercel hook is not proof that a route is live. Verify the deployed commit and relevant production URLs separately.

## V1 and Data Non-Negotiables

- Do not expand v1 beyond `Project_Definition.md` section 2 without explicit user approval. Excluded features include a broad catalog, clickable drilldown/detail pages, admin UI, public API, uploads, sub-annual data, and automated production document extraction.
- Multi-year institutions and major programs are selectable series, not clickable drilldown.
- Use stable lowercase ASCII category IDs; Georgian and English labels are display data, not identifiers.
- Public expenditure fields come from reviewed mappings over official rows. Preserve every official row. Assign uncertain rows explicitly to `spending.other_unclassified` and retain mapping confidence and notes.
- Store `basis = actual | planned`. When both exist for an item and year, actual wins in public charts, tables, and Excel workbooks; active planned values remain visibly marked.
- Every import must produce validation and reconciliation evidence.
- Public Excel workbooks retain basis status and validated public-archive source hyperlinks; they do not expose internal metadata columns.
- Georgian methodology manifest CSVs intended for direct opening in Microsoft Excel must use UTF-8 with BOM and automated encoding regression coverage. Public explorer downloads are native `.xlsx` workbooks.
- Municipal codes `05`, `42`, `43`, `46`, and `64` remain excluded because their budgets are not territorially attributable spending inside those municipalities.

## UI Contract

- Production follows the warm editorial system in `DESIGN.md` v4.1. Do not revive the superseded Apple Light/Night, dark, neon, or terminal directions without explicit approval.
- Derive year ranges and defaults from loaded facts; do not hardcode coverage.
- Preserve readable Georgian text, accessible chart labels, distinguishable stable category colors, and data comprehension.
- Only the applicable total is selected by default; it remains first, selectable, and removable.
- Series selection is unlimited. Optional grouping tabs precede search; the next row places `გასუფთავება` / `ყველას მონიშვნა` on the left. Ordinary scopes show `სერიები {selected} / {all}` on the right; ministries show `ძირითადი {selected} / {all} · პროგრამები {selectedPrograms}` so a selected program is never hidden by the top-level bulk count. Search never scopes the bulk action or denominator.

## Workflow and Delivery

Use this sequence: brainstorming/spec -> plan -> implementation -> verification/review -> GitHub delivery when authorized.

GitHub delivery is mandatory when the task includes publishing:

```text
codex/* branch -> commits -> push -> draft PR -> required CI -> review/resolved conversations -> merge -> delete branch
```

Check Git and worktree state before promising branch, commit, push, PR, or merge actions. Do not push implementation commits directly to `main`. Publishing or merging requires task scope or explicit authorization. Required CI must be green before merge; do not bypass a required check.

Use Context7 for current library, framework, SDK, API, CLI, or cloud-service documentation before relying on memory. Do not claim completion without the relevant verification in `CLAUDE.md`.
