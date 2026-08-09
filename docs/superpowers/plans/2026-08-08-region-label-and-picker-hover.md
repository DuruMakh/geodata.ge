# Region Label and Entity-Picker Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten region heading triggers to canonical region names and give every entity-picker row visible hover feedback.

**Architecture:** Keep the existing `MunicipalExplorer` and `EntityPicker` behavior intact. Change the region route's display prop and only the two option-row class lists, then protect the user-visible result with Playwright assertions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Playwright.

## Global Constraints

- Region triggers use `region.kaLabel`; municipality trigger copy is unchanged.
- Region rows keep their resting tint and gain terracotta text and left rule on hover.
- Municipality rows gain the existing tint plus terracotta text and left rule on hover.
- Hover transitions are color-only and exactly 100ms; no movement, transforms, icons, sizing, routing, focus, or popover changes.
- All picker option buttons use the pointer cursor.

---

### Task 1: Region label and picker hover feedback

**Files:**
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Modify: `apps/web/components/municipalities/entity-picker.tsx`
- Test: `apps/web/tests/browser/municipal-region.spec.ts`
- Test: `apps/web/tests/browser/municipal-entity.spec.ts`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: `region.kaLabel`, `picker-region`, and `picker-municipality`.
- Produces: canonical region trigger copy and 100ms hover styles without behavior changes.

- [x] **Step 1: Write failing browser assertions**

Update region navigation coverage to expect the trigger to contain `იმერეთი` and not `მუნიციპალური ბიუჯეტები`. Add hover assertions that check a region row and municipality row resolve to terracotta text and a terracotta left border after hover, use a 100ms transition, and retain their bounding boxes.

- [x] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipal-region.spec.ts tests/browser/municipal-entity.spec.ts --grep "plain region name|picker rows expose hover feedback"
```

Expected: FAIL because the region trigger contains the long genitive phrase and picker options lack the approved hover styles.

- [x] **Step 3: Implement the minimal changes**

Pass `triggerLabel={region.kaLabel}` on region pages. Add `cursor-pointer transition-colors duration-100 hover:border-l-[var(--accent)] hover:text-[var(--accent)]` to both option types and `hover:bg-[var(--tint)]` to municipality options. Preserve active/current classes and every event handler.

- [x] **Step 4: Verify GREEN and regressions**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipal-region.spec.ts tests/browser/municipal-entity.spec.ts --grep "plain region name|picker rows expose hover feedback"
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
```

Expected: all commands pass.

- [x] **Step 5: Run in-app visual QA**

Open the Adjara region route, verify the short label and both picker row hover states against the supplied screenshots, confirm no layout movement, and append evidence to `design-qa.md` with `final result: passed`.

- [x] **Step 6: Commit and push**

Commit the implementation, tests, plan, and QA report, then push `codex/municipality-map-upgrade` to update PR #40.
