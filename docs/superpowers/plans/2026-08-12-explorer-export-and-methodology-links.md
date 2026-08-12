# Explorer Export and Methodology Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every explorer CSV action the same visual treatment and remove methodology links outside the homepage and footer.

**Architecture:** Retain the existing download handlers and align the municipality entity button with the established series-panel button. Remove only the three explorer-level `MethodologyPromo` render paths; the homepage and footer continue to own public methodology navigation.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind v4, Playwright.

## Global Constraints

- Preserve existing CSV contents, filenames, and accessible button labels.
- Do not alter `/methodology` routes or their internal navigation.
- Keep the homepage promotion and shared footer methodology link unchanged.
- Follow the warm editorial design system without adding cards or dependencies.

---

### Task 1: Lock the public route contract with failing browser checks

**Files:**
- Modify: `apps/web/tests/browser/methodology.spec.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`

- [x] **Step 1: Replace the explorer-promotion expectations with absence checks**

Assert `methodology-promo` has count zero for `/explorer`, `/explorer/expenditure`, `/explorer/revenue`, `/explorer/analysis`, and `/explorer/municipalities`, while retaining the existing homepage/footer assertions.

- [x] **Step 2: Add the shared CSV-control visual expectation**

Give the national CSV button a stable `data-testid="series-csv"`, then assert that it and `municipal-csv` have the same `h-[38px]`, `w-full`, and ink-paper control classes.

- [x] **Step 3: Run the focused tests to verify they fail**

Run: `npm.cmd exec playwright test tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/methodology.spec.ts`

Expected: FAIL because promotions still exist and the national button lacks the stable test selector.

### Task 2: Implement the minimum UI changes

**Files:**
- Modify: `apps/web/components/main-explorer/series-panel.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/app/explorer/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`

- [x] **Step 1: Align CSV controls**

Add `data-testid="series-csv"` to the established series-panel button. Change the municipality button only to use the same class string, preserving its handler and existing `municipal-csv` selector.

- [x] **Step 2: Remove explorer-level methodology promotion renderings**

Delete the promotion imports and JSX from the hub and municipality index pages. Delete the promotion import, derived dataset/copy variables, and JSX from `MainExplorer`.

- [x] **Step 3: Run the focused tests to verify they pass**

Run: `npm.cmd exec playwright test tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/methodology.spec.ts`

Expected: PASS, including CSV download coverage and the new absence checks.

### Task 3: Verify the production build contract

**Files:**
- Verify only: changed files above

- [x] **Step 1: Run static checks**

Run: `npm.cmd run lint` and `npm.cmd run typecheck`

Expected: both commands PASS.

- [x] **Step 2: Inspect the final diff**

Run: `git diff --check` and `git diff --stat`

Expected: no whitespace errors and only the scoped UI, browser-test, design, and plan files changed.
