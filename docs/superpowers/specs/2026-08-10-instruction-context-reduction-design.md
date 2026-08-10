# Instruction Context Reduction Design

Date: 2026-08-10
Status: Approved design

## 1. Goal

Reduce the repository-controlled persistent instruction context by roughly half while preserving the rules that protect GeoData.ge's scope, data integrity, visual contract, verification, and GitHub delivery process.

The root `AGENTS.md` is the primary target. Its current `origin/main` version is 14,331 characters. The revised file should be approximately 7,000-8,000 characters without weakening project behavior.

## 2. Explicit Exception

The `## Engineering Behavior` section, including all four subsections, remains byte-for-byte unchanged. The user explicitly excluded the duplicated engineering-behavior guidance from this cleanup.

The implementation must not reword, relocate, or deduplicate that section.

## 3. Scope

This change may modify:

- `AGENTS.md`
- `CLAUDE.md`, only where its definition of done currently forces durable state back into `AGENTS.md`
- this design and its implementation plan

This change does not modify:

- application code, data, tests, dependencies, or deployment configuration
- `Project_Definition.md`, `DESIGN.md`, or data/deployment methodology
- nested `apps/web/AGENTS.md` and `apps/web/CLAUDE.md`
- Codex system or developer instructions, tool schemas, skill catalogs, plugins, global memory, or user configuration outside this repository

## 4. Instruction Architecture

### 4.1 Task-routed loading

Replace the broad read-first list with a compact routing table:

- Feature scope: read `Project_Definition.md` section 2.
- UI or interaction work: read `DESIGN.md` and the current task's approved spec.
- Data work: read the relevant file under `docs/data-methodology/`.
- Deployment work: read `docs/deployment.md`.
- Verification commands: read `CLAUDE.md`.
- Historical provenance only: consult the 2026-05-10 historical v1 spec.

The historical spec must no longer be mandatory for ordinary planning or coding. It contains superseded coverage, architecture, and visual decisions and is valuable only as provenance.

### 4.2 Repository document precedence

Keep a short, explicit repository-level hierarchy:

1. `Project_Definition.md` section 2 owns product scope.
2. `DESIGN.md` owns production visuals and interaction behavior.
3. Task-specific approved specs own their bounded feature decisions.
4. `AGENTS.md` owns always-relevant stack, workflow, and operational constraints.
5. Historical specs are non-authoritative provenance.

For current status claims, live repository, CI, deployment, or URL evidence outranks remembered or historical text.

### 4.3 Persistent-context rule

Compress the maintenance and context-discipline sections into a few enforceable rules:

- Keep only durable, always-relevant constraints in `AGENTS.md`.
- Put scope in `Project_Definition.md`, visuals in `DESIGN.md`, task decisions in specs, implementation steps in plans, and operational detail in methodology/runbooks.
- Do not add recent commits, command logs, detailed coverage inventories, or branch-specific implementation summaries.
- Update `AGENTS.md` only when an always-relevant stack, workflow, authority, or non-negotiable changes.

### 4.4 Compact project capsule

Replace the dated, branch-specific `Current Project State` narrative with a stable capsule that retains:

- GeoData.ge v1 is a Georgian-first budget explorer, not a broad catalog.
- Implemented route families: expenditure, revenue, municipalities, and analysis.
- Next.js 16, strict TypeScript, Tailwind v4, and the custom editorial component layer.
- Reviewed CSVs are the human-reviewed source of truth.
- Supabase/Postgres via Prisma is the serving mirror and must be populated only through the parity-checked import.
- Production is a static Vercel build controlled by the Actions deployment pipeline; `docs/deployment.md` is authoritative.

Detailed route counts, map geometry counts, coverage inventories, activation dates, team identifiers, deployment history, and branch/live caveats move out of persistent context because their canonical owners already exist.

### 4.5 Hard project rules

Retain compact versions of the rules whose omission could cause irreversible or high-cost errors:

- Do not expand v1 beyond `Project_Definition.md` section 2 without explicit approval.
- Series selection is not clickable drilldown.
- Stable lowercase ASCII IDs are identifiers; Georgian and English labels are display data.
- Reviewed mappings preserve every official row; uncertain rows go to `spending.other_unclassified` with confidence and notes.
- `actual` overrides `planned` for public values; active planned values remain visibly marked.
- Every import produces validation and reconciliation evidence.
- Human-facing Georgian CSVs use UTF-8 BOM with regression coverage; use XLSX when spreadsheet auto-conversion threatens identifiers.
- Never edit the database directly; use the transactional parity-checked import.

### 4.6 UI rules

Replace duplicated visual detail with one strong authority pointer to `DESIGN.md`. Keep only the rules needed before that document is loaded:

- Production follows `DESIGN.md` v4.1's warm editorial system.
- Do not revive superseded Apple Light/Night, dark, neon, or terminal directions without explicit approval.
- Preserve Georgian readability, accessible chart labels, stable category colors, and data comprehension.
- Year ranges and defaults derive from loaded facts rather than hardcoded coverage.

### 4.7 Workflow and delivery

Preserve, in compact form:

1. Brainstorm/spec.
2. Plan.
3. Implementation.
4. Verification/review.
5. GitHub delivery when authorized.

Keep the mandatory delivery sequence and prohibition on direct implementation pushes to `main`:

```text
codex/* -> commits -> push -> draft PR -> required CI -> resolved review -> merge -> delete branch
```

Keep `CLAUDE.md` as the command and definition-of-done authority. Keep the rule that required CI must be green before merge.

## 5. `CLAUDE.md` Alignment

Replace the definition-of-done instruction that always requires updating `AGENTS.md`'s `Current Project State` with a source-owner rule:

> Durable project changes update their canonical owner: scope in `Project_Definition.md`, visuals in `DESIGN.md`, data/deployment behavior in the relevant methodology or runbook, and `AGENTS.md` only for always-relevant operational rules.

This prevents future work from recreating the context bloat being removed.

## 6. Verification

The implementation is complete when:

- the Engineering Behavior section is byte-for-byte identical before and after the cleanup
- `AGENTS.md` is 7,000-8,000 characters, or the smallest size above that range justified by a preserved invariant
- all repository links named by `AGENTS.md` exist
- every retained high-risk rule in sections 4.5-4.7 is present
- no dated branch-specific narrative remains in `AGENTS.md`
- `CLAUDE.md` points durable updates to their canonical owners
- `git diff --check` passes
- the documentation diff contains no application, data, dependency, or deployment changes

The application test suite is not required for the documentation-only implementation, but the already-run pre-change baseline remains recorded: lint, typecheck, 537 tests, and data validation passed on commit `596eb41`.

## 7. Rejected Alternatives

### Minimal edits

Changing only the read-first list would save too little context and leave dated state embedded in every task.

### New instruction-pack files

Splitting rules into several new agent-specific files could reduce the root file further, but it would add routing and maintenance overhead. Existing canonical product, design, methodology, and deployment documents already provide the required on-demand packs.

### Editing global Codex context

Runtime tool manuals, skills, plugins, and memory account for much of the total loaded prompt, but they are outside this repository's authority and require separate, explicit configuration work.
