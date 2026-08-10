# Instruction Context Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repository-controlled persistent instructions by roughly half while preserving GeoData.ge's important behavior and leaving the Engineering Behavior section byte-for-byte unchanged.

**Architecture:** Rewrite only the always-loaded root instruction shell around the protected Engineering Behavior block. Route task-specific detail to existing canonical documents, keep a compact project and safety capsule, and align `CLAUDE.md` so future durable changes update their canonical owner instead of expanding `AGENTS.md`.

**Tech Stack:** Markdown, Git, PowerShell verification, repository-local canonical documentation.

## Global Constraints

- The `## Engineering Behavior` section, including all four subsections, remains byte-for-byte unchanged.
- Modify only `AGENTS.md`, `CLAUDE.md`, this plan, and the approved design document.
- Do not change application code, data, tests, dependencies, deployment configuration, nested app instructions, global Codex configuration, skills, plugins, tools, or memory.
- Keep `Project_Definition.md` section 2 authoritative for scope and `DESIGN.md` authoritative for production visuals and interactions.
- Preserve the data-integrity rules, no-scope-expansion rule, verification gate, and mandatory GitHub delivery flow.
- Target `AGENTS.md` size: 7,000-8,000 characters, or the smallest justified size above that range.

---

### Task 1: Compact the persistent repository instructions

**Files:**

- Modify: `AGENTS.md:1-44`
- Preserve unchanged: `AGENTS.md:45-113`
- Modify: `AGENTS.md:114-209`
- Modify: `CLAUDE.md:12-18`
- Test: PowerShell content and hash checks; `git diff --check`

**Interfaces:**

- Consumes: `docs/superpowers/specs/2026-08-10-instruction-context-reduction-design.md`, `Project_Definition.md`, `DESIGN.md`, `docs/deployment.md`, `docs/data-methodology/database-import.md`, and the existing Engineering Behavior block.
- Produces: a 7,000-8,000-character root `AGENTS.md` with task-routed loading, stable repository precedence, compact durable constraints, and an aligned root `CLAUDE.md` definition of done.

- [ ] **Step 1: Capture the protected block and baseline measurements**

Run from the repository root:

```powershell
$baseline = & 'C:\Program Files\Git\cmd\git.exe' show 596eb41:AGENTS.md
$start = [Array]::IndexOf($baseline, '## Engineering Behavior')
$end = [Array]::IndexOf($baseline, '## Current Project State')
$block = $baseline[$start..($end - 1)] -join "`n"
$bytes = [Text.Encoding]::UTF8.GetBytes($block)
$sha = [Security.Cryptography.SHA256]::Create()
try { $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '') }
finally { $sha.Dispose() }
[pscustomobject]@{
  BaselineCharacters = (($baseline -join "`n").Length)
  EngineeringCharacters = $block.Length
  EngineeringSha256 = $hash
}
```

Expected:

```text
BaselineCharacters     14331
EngineeringCharacters  2348
```

Record the printed SHA-256 value in the terminal output for comparison in Step 5. Do not write it into a persistent repository file.

- [ ] **Step 2: Replace the pre-Engineering instruction shell**

Use `apply_patch` to replace `AGENTS.md` from the first line through the line immediately before `## Engineering Behavior` with exactly:

```markdown
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

```

Do not include `## Engineering Behavior` in the replacement. The existing heading and all content through the line before `## Current Project State` must remain untouched.

- [ ] **Step 3: Replace dated project detail with the compact durable capsule**

Use `apply_patch` to replace `AGENTS.md` from `## Current Project State` through end of file with exactly:

```markdown
## Project Snapshot

GeoData.ge v1 is an implemented Georgian-first Georgia Budget Explorer, not a broad public-data catalog. Current route families are expenditure, revenue, municipalities, and single-year analysis under `/explorer`.

The stack is Next.js 16, strict TypeScript, Tailwind v4, and the custom editorial component layer; do not introduce shadcn. Reviewed CSVs under `data/imports/` are the canonical human-reviewed source of truth. Supabase Postgres via Prisma 7 is the serving mirror, populated only by the transactional, parity-checked `npm run data:import`; never edit the database directly. Builds remain fully static, with CSV mode as the documented fallback. See `docs/data-methodology/database-import.md`.

Production deploys to Vercel through the Actions-owned, CI-gated pipeline. `docs/deployment.md` owns project identifiers, environment configuration, release operations, rollback, and live-verification procedure.

A branch implementation, merged commit, green deploy-trigger workflow, or accepted Vercel hook is not proof that a route is live. Verify the deployed commit and relevant production URLs separately.

## V1 and Data Non-Negotiables

- Do not expand v1 beyond `Project_Definition.md` section 2 without explicit user approval. Excluded features include a broad catalog, clickable drilldown/detail pages, admin UI, public API, uploads, sub-annual data, and automated production document extraction.
- Multi-year institutions and major programs are selectable series, not clickable drilldown.
- Use stable lowercase ASCII category IDs; Georgian and English labels are display data, not identifiers.
- Public expenditure fields come from reviewed mappings over official rows. Preserve every official row. Assign uncertain rows explicitly to `spending.other_unclassified` and retain mapping confidence and notes.
- Store `basis = actual | planned`. When both exist for an item and year, actual wins in public charts, tables, and CSV; active planned values remain visibly marked.
- Every import must produce validation and reconciliation evidence.
- CSV exports retain source and basis metadata.
- Georgian CSVs intended for direct opening in Microsoft Excel must use UTF-8 with BOM and automated encoding regression coverage. Prefer a native XLSX companion when spreadsheet auto-conversion could alter identifiers.
- Municipal codes `05`, `42`, `43`, `46`, and `64` remain excluded because their budgets are not territorially attributable spending inside those municipalities.

## UI Contract

- Production follows the warm editorial system in `DESIGN.md` v4.1. Do not revive the superseded Apple Light/Night, dark, neon, or terminal directions without explicit approval.
- Derive year ranges and defaults from loaded facts; do not hardcode coverage.
- Preserve readable Georgian text, accessible chart labels, distinguishable stable category colors, and data comprehension.

## Workflow and Delivery

Use this sequence: brainstorming/spec -> plan -> implementation -> verification/review -> GitHub delivery when authorized.

GitHub delivery is mandatory when the task includes publishing:

```text
codex/* branch -> commits -> push -> draft PR -> required CI -> review/resolved conversations -> merge -> delete branch
```

Check Git and worktree state before promising branch, commit, push, PR, or merge actions. Do not push implementation commits directly to `main`. Publishing or merging requires task scope or explicit authorization. Required CI must be green before merge; do not bypass a required check.

Use Context7 for current library, framework, SDK, API, CLI, or cloud-service documentation before relying on memory. Do not claim completion without the relevant verification in `CLAUDE.md`.
```

- [ ] **Step 4: Align the root definition of done**

Use `apply_patch` to replace item 4 under `CLAUDE.md`'s `## Definition of done` with:

```markdown
4. Durable project changes update their canonical owner: scope in `Project_Definition.md`, visuals in `DESIGN.md`, data/deployment behavior in the relevant methodology or runbook, and `AGENTS.md` only for always-relevant operational rules.
```

Leave every other command and definition-of-done item unchanged.

- [ ] **Step 5: Prove the Engineering Behavior block is unchanged**

Run:

```powershell
function Get-EngineeringBlock([string[]]$Lines, [string]$EndHeading) {
  $start = [Array]::IndexOf($Lines, '## Engineering Behavior')
  $end = [Array]::IndexOf($Lines, $EndHeading)
  if ($start -lt 0 -or $end -le $start) { throw 'Engineering block boundaries not found' }
  $Lines[$start..($end - 1)] -join "`n"
}

$beforeLines = & 'C:\Program Files\Git\cmd\git.exe' show 596eb41:AGENTS.md
$afterLines = Get-Content 'AGENTS.md'
$before = Get-EngineeringBlock $beforeLines '## Current Project State'
$after = Get-EngineeringBlock $afterLines '## Project Snapshot'
$sha = [Security.Cryptography.SHA256]::Create()
try {
  $beforeHash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($before))).Replace('-', '')
  $afterHash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($after))).Replace('-', '')
}
finally { $sha.Dispose() }
[pscustomobject]@{Before=$beforeHash; After=$afterHash; Identical=($beforeHash -eq $afterHash)}
if ($beforeHash -ne $afterHash) { throw 'Engineering Behavior changed' }
```

Expected: `Identical` is `True` and both hashes equal the value printed in Step 1.

- [ ] **Step 6: Verify size, links, retained rules, and removed dated detail**

Run:

```powershell
$text = Get-Content -Raw 'AGENTS.md'
$requiredPaths = @(
  'Project_Definition.md',
  'DESIGN.md',
  'CLAUDE.md',
  'docs/deployment.md',
  'docs/data-methodology/database-import.md',
  'docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md'
)
$missing = $requiredPaths | Where-Object { -not (Test-Path $_) }
[pscustomobject]@{Characters=$text.Length; MissingLinks=($missing -join ', ')}
if ($text.Length -lt 7000 -or $text.Length -gt 8000) { throw "AGENTS.md length is $($text.Length), outside 7000-8000" }
if ($missing) { throw "Missing instruction links: $($missing -join ', ')" }

$requiredPatterns = @(
  'Project_Definition\.md.*section 2',
  'DESIGN\.md.*v4\.1',
  'spending\.other_unclassified',
  'actual wins',
  'UTF-8 with BOM',
  'never edit the database directly',
  'codex/\* branch -> commits -> push -> draft PR',
  'review/resolved conversations',
  'Municipal codes `05`, `42`, `43`, `46`, and `64` remain excluded',
  'Verify the deployed commit and relevant production URLs separately',
  'Do not push implementation commits directly to `main`',
  'Required CI must be green before merge'
)
foreach ($pattern in $requiredPatterns) {
  if ($text -notmatch $pattern) { throw "Missing required rule: $pattern" }
}

$forbiddenPatterns = @(
  'current branch implements',
  '60 OpenStreetMap polygons',
  '64 municipality pages',
  '11 region roll-up pages',
  'team `durumakh-1974s-projects`',
  'since 2026-07-28'
)
foreach ($pattern in $forbiddenPatterns) {
  if ($text -match [regex]::Escape($pattern)) { throw "Dated detail remains: $pattern" }
}
```

Expected: `Characters` is between 7,000 and 8,000; `MissingLinks` is blank; no exception is thrown.

- [ ] **Step 7: Review the complete documentation diff**

Run:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' diff --check
& 'C:\Program Files\Git\cmd\git.exe' diff -- AGENTS.md CLAUDE.md
& 'C:\Program Files\Git\cmd\git.exe' status --short
```

Expected:

- `git diff --check` exits 0.
- The Engineering Behavior section has no diff hunks.
- Only `AGENTS.md` and `CLAUDE.md` are modified; the plan is already committed separately.
- No application, data, dependency, nested instruction, or deployment file changed.

- [ ] **Step 8: Commit the compact instruction contract**

Run:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- AGENTS.md CLAUDE.md
& 'C:\Program Files\Git\cmd\git.exe' diff --cached --check
& 'C:\Program Files\Git\cmd\git.exe' -c gc.auto=0 commit -m "docs: reduce persistent instruction context"
```

Expected: one documentation commit containing only `AGENTS.md` and `CLAUDE.md`.
