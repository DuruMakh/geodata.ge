# Municipality Entity-Picker Affordance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make municipality and region heading names visibly clickable by matching the approved terracotta, dashed-underline, and caret treatment.

**Architecture:** Keep the existing `EntityPicker` behavior unchanged and modify only its heading trigger in `MunicipalExplorer`. Drive the caret glyph from the existing `pickerOpen` state and protect the visual contract with real browser assertions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Playwright.

## Global Constraints

- Entity name is always `var(--accent)`.
- Resting affordance is a 1px dashed accent underline at 60% opacity plus a `var(--control)` `▾` caret.
- Hover changes only border/caret color over 100ms; no transforms, size changes, backgrounds, or layout movement.
- Open state uses `▴`; `aria-expanded`, keyboard behavior, focus return, routes, and popover internals remain unchanged.
- Caret is `aria-hidden`; the trigger remains the semantic button.
- Do not address the separate `nanoid` audit failure in this task.

---

### Task 1: Match the preview's heading-trigger affordance

**Files:**
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx:190-204`
- Test: `apps/web/tests/browser/municipal-entity.spec.ts`
- Test: `apps/web/tests/browser/municipal-region.spec.ts`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: existing `pickerOpen: boolean`, `props.triggerLabel: string`, and `entity-picker-trigger` button.
- Produces: `entity-picker-caret` span containing `▾` when closed and `▴` when open.

- [x] **Step 1: Write failing browser coverage for the visible trigger contract**

Add a municipality test that derives expected values directly from the approved tokens and checks real rendered behavior:

```ts
test("the entity picker trigger keeps the preview affordance across rest, hover, and open states", async ({ page }) => {
  await page.goto(ENTITY_URL);
  await expectMunicipalAppReady(page);

  const trigger = page.getByTestId("entity-picker-trigger");
  const caret = page.getByTestId("entity-picker-caret");
  const restingBox = await trigger.boundingBox();

  await expect(trigger).toHaveCSS("color", "rgb(179, 64, 42)");
  await expect(trigger).toHaveCSS("border-bottom-style", "dashed");
  await expect(trigger).toHaveCSS("border-bottom-width", "1px");
  await expect(trigger).toHaveCSS("transition-duration", "0.1s");
  await expect(caret).toHaveText("▾");
  await expect(caret).toHaveCSS("color", "rgb(201, 190, 169)");

  await trigger.hover();
  await expect(caret).toHaveCSS("color", "rgb(179, 64, 42)");
  expect(await trigger.boundingBox()).toEqual(restingBox);

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(caret).toHaveText("▴");
});
```

Add a region-route assertion to the existing region-page coverage:

```ts
const trigger = page.getByTestId("entity-picker-trigger");
await expect(trigger).toHaveCSS("color", "rgb(179, 64, 42)");
await expect(page.getByTestId("entity-picker-caret")).toHaveText("▾");
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts --grep "preview affordance|region page"
```

Expected: FAIL because the current trigger inherits ink, uses a 2px solid underline, has no `entity-picker-caret`, and has no color transition.

- [x] **Step 3: Implement the minimal trigger markup and styles**

Replace only the trigger's class and children:

```tsx
className="group cursor-pointer border-b border-dashed border-[color:color-mix(in_srgb,var(--accent)_60%,transparent)] font-[family-name:var(--font-display)] text-[var(--accent)] transition-colors duration-100 hover:border-[var(--accent)]"
>
  {props.triggerLabel}
  <span
    data-testid="entity-picker-caret"
    aria-hidden
    className="ml-1 inline-block align-middle text-[0.35em] text-[var(--control)] transition-colors duration-100 group-hover:text-[var(--accent)]"
  >
    {pickerOpen ? "▴" : "▾"}
  </span>
```

- [x] **Step 4: Run focused and full verification**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts --grep "preview affordance|region page"
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
```

Expected: all commands PASS. The audit command is outside `check` and remains separately blocked until the user approves the dependency update.

- [x] **Step 5: Run visual QA and update the existing report**

Using the in-app Browser, capture closed, hover, and open states at the same viewport as the supplied preview where practical. Compare the supplied preview and latest implementation together, check console errors, append the evidence and comparison history to `design-qa.md`, and require `final result: passed`.

- [x] **Step 6: Commit, push, and wait for PR checks**

```powershell
git add apps/web/components/municipalities/municipal-explorer.tsx apps/web/tests/browser/municipal-entity.spec.ts apps/web/tests/browser/municipal-region.spec.ts design-qa.md docs/superpowers/plans/2026-08-08-entity-picker-affordance.md
git commit -m "fix: clarify entity picker affordance"
git push origin codex/municipality-map-upgrade
```

Expected: PR #40 updates; CodeRabbit, Vercel, browser CI, and the main CI job rerun. Main CI may remain blocked only by the separately documented `nanoid 3.3.12` audit finding until that lockfile update is approved.
