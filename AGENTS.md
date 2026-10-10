# Fiscal.ge Agent Instructions

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

- Inspect relevant files, patterns, tests, and call sites before editing. State important assumptions and tradeoffs; prefer the simplest correct solution. Ask only when unresolved uncertainty materially changes the outcome or risks doing the wrong work.
- Explain plans, choices, and results in plain language for a non-developer. Resolve implementation details independently when the codebase provides the answer.
- The user may ask questions or give tasks in Georgian. Conduct work in English and use English for all communication by default, including questions, plans, progress updates, explanations, and final answers. Respond in Georgian only when the user explicitly requests it.
- Implement only the requested scope. Avoid speculative abstractions, configuration, and handling for impossible cases. Preserve required data validation, source checks, unmapped-row handling, and planned/actual rules.
- Match existing style. Do not refactor, reformat, rename, or remove unrelated code. Remove only imports, variables, functions, and files made unnecessary by your changes; report unrelated issues separately. Every changed line must serve the request.
- Define observable success criteria. For multi-step work, give a short plan pairing each step with its verification; skip formal planning for trivial changes. Reproduce bugs, verify invalid cases for validation changes, and compare behavior before and after refactoring.
- Verify outcomes before claiming completion. During editing, run the narrowest relevant check; run the full completion gate once. Never repeat a passing gate unless its inputs changed. `CLAUDE.md` owns commands and completion requirements.

## Reuse First

Reuse what the repository already has; do not build parallel versions. Before adding anything, find the closest existing component, helper, registry, page or pipeline and follow it.

- Use it as is. If it almost fits, make a small additive change (for example an optional prop) whose default leaves current output and tests unchanged. Do not fork, copy, or write a sibling.
- A new component or abstraction is the exception: name the existing ones considered and why none can be extended.
- Every spec and plan lists what is reused as is, what gets a small addition, and what is genuinely new. Duplicating existing code is a defect.

## Project Snapshot

Fiscal.ge (repository and Vercel project name: GeoData.ge) is an implemented Georgian-first explorer of reviewed Georgian public-finance and economy data, not a broad public-data catalog. Georgian keeps the established URLs; English mirrors them under `/en`. Route families under `/explorer` are budget (expenditure, revenue, municipalities, single-year analysis, debt, deficit), economy (GDP, sectors, regions) and inflation (overview, categories, cities); alongside them sit `/methodology`, `/connect`, `/about` and the read-only `/mcp`. `Project_Definition.md` section 2 owns the authoritative list.

The stack is Next.js 16, strict TypeScript, Tailwind v4, and the custom editorial component layer; do not introduce shadcn. Reviewed CSVs under `data/imports/` are the canonical human-reviewed source of truth. Supabase Postgres via Prisma 7 is the serving mirror, populated only by the transactional, parity-checked `npm run data:import`; never edit the database directly. Builds remain fully static, with CSV mode as the documented fallback. See `docs/data-methodology/database-import.md`.

Explorer pages remain prerendered and are served as static output. The single exception is `/mcp`, the read-only MCP endpoint: it is the application's only request-time route, and it answers from a snapshot bundled at build time, with no dataset database or filesystem access outside the deployed bundle. Its sole network exception is the configured Upstash rate-limit counter; no request fetches budget data or source documents. Its operating limits, pause switch and logging policy live in `docs/deployment.md`.

Production deploys to Vercel through the Actions-owned, CI-gated pipeline. `docs/deployment.md` owns project identifiers, environment configuration, release operations, rollback, and live-verification procedure.

A branch implementation, merged commit, green deploy-trigger workflow, or accepted Vercel hook is not proof that a route is live. Verify the deployed commit and relevant production URLs separately.

## V1 and Data Non-Negotiables

- Do not expand v1 beyond `Project_Definition.md` section 2 without explicit user approval. Excluded features include a broad catalog, clickable drilldown/detail pages, admin UI, a public API beyond the approved read-only MCP and static publications, uploads, sub-annual data other than the approved monthly inflation dataset, and automated production document extraction.
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
- Functional UI icons use Lucide (`lucide-react`), with sizing, accessibility and exceptions owned by `DESIGN.md` §7.2a. Do not introduce a second icon family or replace brand assets/data visualizations with UI icons.
- Derive year ranges and defaults from loaded facts; do not hardcode coverage.
- Under a page heading add only the one-line latest-value (or lead) line; no summary paragraphs or notes there (`DESIGN.md` §17).
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

Check current library, framework, SDK, API, CLI, or cloud-service documentation before relying on memory: Context7 where the agent has it configured, otherwise official docs; for Next.js, the bundled guides in `apps/web/node_modules/next/dist/docs/`. Do not claim completion without the relevant verification in `CLAUDE.md`.
