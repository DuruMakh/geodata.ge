# 2004 National Revenue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the source-backed 2004 consolidated revenue-and-grants panel while explicitly leaving the unavailable liabilities category blank.

**Architecture:** Keep the Treasury Form #1 extraction pipeline unchanged for 2005–2025. Add one reviewed, typed 2004 handoff sourced from the annual report, merge it into the generated revenue CSV, and teach coverage and validation that 2004 is the sole partial category panel.

**Tech Stack:** Next.js 16, strict TypeScript, Vitest, Playwright, reviewed CSV data.

**Spec:** `docs/superpowers/specs/2026-08-20-2004-national-revenue-design.md`

## Global Constraints

- Publish no estimated or zero-valued 2004 liabilities fact.
- Preserve every 2005–2025 revenue value and identifier.
- Reviewed CSV files remain the canonical source of truth.
- Source and basis metadata must remain available in exports.

---

### Task 1: Add the reviewed 2004 handoff

**Files:**
- Create: `apps/web/lib/data/realRevenue/year2004Revenue.ts`
- Create: `apps/web/tests/data/realRevenue/year2004Revenue.test.ts`
- Modify: `apps/web/lib/data/coverage.ts`
- Modify: `apps/web/tests/data/sourceCoverage.test.ts`

**Interfaces:**
- Produces: `REVENUE_PARTIAL_YEARS` and `YEAR_2004_REVENUE_FACTS` for generation and validation.

- [ ] Write a failing test asserting the ten exact facts, their total, their source ID, and the absence of `revenue.increase_liabilities`.
- [ ] Run the focused test and confirm it fails because the handoff does not exist.
- [ ] Add the minimum typed constant and 2004 partial-coverage declaration.
- [ ] Run the focused test and confirm it passes.

### Task 2: Generate and validate the served data

**Files:**
- Modify: `apps/web/scripts/generate-real-revenue-facts.ts`
- Modify: `apps/web/scripts/compose-budget-facts.ts`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/tests/data/pipelineIntegration.test.ts`
- Modify: `apps/web/tests/explorer/integration.test.ts`
- Rename: `data/imports/revenue-facts-2005-2025.csv` to `data/imports/revenue-facts-2004-2025.csv`
- Rename revenue generation reports from `2005-2025` to `2004-2025` where they describe the public dataset.
- Regenerate: `data/imports/budget-facts-2004-2025.csv`

**Interfaces:**
- Consumes: `YEAR_2004_REVENUE_FACTS`.
- Produces: a deterministic 2004–2025 revenue import with ten rows in 2004 and eleven rows in later years.

- [ ] Add failing integration assertions for 2004 coverage, exact total, ten-item completeness, and missing liabilities.
- [ ] Run the focused tests and confirm the shipped CSV fails those assertions.
- [ ] Merge the curated 2004 handoff into generation, update filenames and validators, and regenerate the composed data.
- [ ] Run focused generation and pipeline tests and confirm they pass.
- [ ] Compare the regenerated 2005–2025 facts with the pre-change file and require zero differences.

### Task 3: Publish provenance and the limitation

**Files:**
- Modify: `data/sources/source-documents.csv`
- Modify: `data/methodology/source-archives/revenue.csv`
- Modify: `apps/web/lib/methodology/content/revenue.ts`
- Modify: `docs/data-methodology/revenue-methodology.md`
- Modify: `Project_Definition.md`
- Modify: `apps/web/components/main-explorer/explorer-view.tsx`
- Modify: applicable methodology and browser tests.

**Interfaces:**
- Produces: resolvable source metadata, downloadable source archive entry, and public Georgian disclosure.

- [ ] Add failing tests for the source registration, archive entry, 2004–2025 coverage, and missing-liability disclosure.
- [ ] Run them and confirm the expected failures.
- [ ] Update the registries, methodology, scope text, and revenue source note.
- [ ] Run the focused tests and confirm they pass.

### Task 4: Verify the complete change

**Files:**
- Inspect all modified files; no additional production files are expected.

- [ ] Run the required data validation and test commands from `CLAUDE.md`.
- [ ] Run typecheck, lint/check, and production build separately.
- [ ] Run the relevant browser test against a dedicated local port.
- [ ] Inspect `git diff --check`, `git status --short`, and the final diff for unrelated changes.
