# Series Selector Indeterminate State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the shared series bulk control correct empty, partial, and all-selected visuals/accessibility, while renaming the multi-year expenditure grouping tab to `სამინისტროები` and using the short `ძებნა` placeholder.

**Architecture:** Keep the existing shared `SeriesSelector` boundary and caller-owned selection callbacks. Derive a three-state accessibility/visual value from the existing `hasSelection` and `allSelected` props inside the shared component; no new state model or caller prop is needed. Change only the national multi-year adapter's display copy.

**Tech Stack:** Next.js 16, React 19, strict TypeScript, Tailwind v4, Playwright, Vitest.

## Global Constraints

- None selected: empty square, `ყველას მონიშვნა`, `aria-checked="false"`, click selects all.
- Partial selection: transparent square with a centered ink dash, `გასუფთავება`, `aria-checked="mixed"`, click clears all.
- All selected: ink-filled square with the existing paper checkmark, `გასუფთავება`, `aria-checked="true"`, click clears all.
- The bulk button uses `role="checkbox"`; remove its current `aria-pressed` state.
- Search never scopes the bulk state, denominator, or click action.
- The multi-year expenditure grouping tab displays `სამინისტროები`.
- The multi-year expenditure search placeholder is `ძებნა` in both fields and ministries groupings.
- Internal grouping value `ministries`, ministry/program hierarchy search, row checkboxes, URL state, CSV, charts, tables, data, and default selections remain unchanged.
- Do not add a second checkbox abstraction, a state machine, or dataset-specific tri-state props.

---

## File Map

### Application files

- `apps/web/components/main-explorer/series-selector.tsx` — derive and render the shared bulk control's three states.
- `apps/web/components/main-explorer/series-panel.tsx` — update only the multi-year ministries tab label and search placeholder.

### Test files

- `apps/web/tests/browser/main-explorer.spec.ts` — prove all three bulk states, click behavior, search independence, and the national copy.
- `apps/web/tests/browser/municipal-entity.spec.ts` — prove the shared tri-state behavior also reaches the municipal caller.

### Maintained documentation

- `DESIGN.md` — record the tri-state bulk indicator and the multi-year `სამინისტროები` / `ძებნა` copy.

### Deliberately unchanged

- `apps/web/components/analysis/analysis-view.tsx` and analysis copy.
- `apps/web/components/municipalities/municipal-explorer.tsx`.
- National and municipal state hooks, URL parsers, CSV helpers, data files, routes, and schemas.

At execution start, record the follow-up review base with
`git rev-parse HEAD` before Task 1 changes any file. Use that exact recorded SHA
for the final review range.

---

### Task 1: Implement the shared tri-state control and national copy

**Files:**
- Modify: `apps/web/tests/browser/main-explorer.spec.ts:78-168`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts:398-415`
- Modify: `apps/web/components/main-explorer/series-selector.tsx:35-74`
- Modify: `apps/web/components/main-explorer/series-panel.tsx:116-132`

**Interfaces:**
- Consumes: the existing `SeriesSelectorProps` values `selectedCount`, `totalCount`, `hasSelection`, `allSelected`, and `onToggleAll`.
- Produces: unchanged `SeriesSelector` and `SeriesSelectorRow` exports; the bulk button exposes `role="checkbox"`, `aria-checked="false" | "mixed" | "true"`, and a child `data-testid="series-toggle-indicator"`.

- [ ] **Step 1: Add the failing national tri-state and copy contract**

Add this focused browser test beside the existing standardized-selector tests in `main-explorer.spec.ts`:

```ts
test("bulk selector exposes mixed, empty, and checked states", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const bulk = panel.getByTestId("series-toggle-all");
  const indicator = panel.getByTestId("series-toggle-indicator");

  await expect(bulk).toHaveAttribute("role", "checkbox");
  await expect(bulk).toHaveAttribute("aria-checked", "mixed");
  await expect(indicator).toHaveText("—");

  await panel.getByTestId("series-row").nth(1).getByTestId("series-row-toggle").click();
  await expect(panel.getByTestId("series-status")).toContainText(/სერიები\s*2 \/ \d+/);
  await expect(bulk).toHaveAttribute("aria-checked", "mixed");
  await expect(indicator).toHaveText("—");

  await bulk.click();
  await expect(bulk).toHaveAttribute("aria-checked", "false");
  await expect(indicator).toHaveText("");
  await expect(bulk).toHaveText("ყველას მონიშვნა");

  await panel.getByTestId("series-search").fill("ჯანმრთელობა");
  await bulk.click();
  await expect(bulk).toHaveAttribute("aria-checked", "true");
  await expect(indicator).toHaveText("✓");
  await expect(bulk).toHaveText("გასუფთავება");
});
```

Extend `explorer controls expose line, table, grouping, and the share pill` with these assertions before and after activating the ministries grouping:

```ts
await expect(seriesPanel.getByTestId("grouping-ministries")).toHaveText("სამინისტროები");
await expect(seriesPanel.getByTestId("series-search")).toHaveAttribute("placeholder", "ძებნა");

await seriesPanel.getByTestId("grouping-ministries").click();
await expect(seriesPanel.getByTestId("series-search")).toHaveAttribute("placeholder", "ძებნა");
```

If that test already clicks the grouping control, add only the assertions at the corresponding pre-click and post-click positions; do not duplicate the click.

- [ ] **Step 2: Extend the municipal shared-state contract**

In `municipal-entity.spec.ts`, extend `bulk actions ignore the active municipal search`:

```ts
const indicator = panel.getByTestId("series-toggle-indicator");

await expect(bulk).toHaveAttribute("role", "checkbox");
await expect(bulk).toHaveAttribute("aria-checked", "mixed");
await expect(indicator).toHaveText("—");

await bulk.click();
await expect(bulk).toHaveAttribute("aria-checked", "false");
await expect(indicator).toHaveText("");
await expect(bulk).toHaveText("ყველას მონიშვნა");

await panel.getByTestId("series-search").fill("განათლება");
await bulk.click();
await expect(bulk).toHaveAttribute("aria-checked", "true");
await expect(indicator).toHaveText("✓");
```

Keep the existing assertions proving that all 11 global rows become selected while search is active.

- [ ] **Step 3: Run the focused browser tests and verify RED**

Run:

```powershell
npm.cmd --prefix apps/web run test:browser -- tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts --grep "bulk selector exposes|bulk actions ignore|explorer controls expose"
```

Expected: FAIL because the current button has `aria-pressed`, lacks `aria-checked` and `series-toggle-indicator`, renders no partial dash, and still displays `უწყებები` plus the long ministries placeholder.

- [ ] **Step 4: Implement the minimal shared three-state rendering**

In `SeriesSelector`, derive the state immediately before `return`:

```ts
const bulkState: "false" | "mixed" | "true" =
  hasSelection && allSelected ? "true" : hasSelection ? "mixed" : "false";
const bulkMark = bulkState === "true" ? "✓" : bulkState === "mixed" ? "—" : "";
```

Update only the bulk button and its indicator:

```tsx
<button
  type="button"
  role="checkbox"
  data-testid="series-toggle-all"
  aria-checked={bulkState}
  onClick={onToggleAll}
  className="grid shrink-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-1 pr-1 pl-0.5 text-left"
>
  <span
    aria-hidden
    data-testid="series-toggle-indicator"
    className="inline-flex size-3.5 items-center justify-center border-[1.5px] text-[9px] leading-none"
    style={{
      borderColor: bulkState === "false" ? "var(--control)" : "var(--ink)",
      backgroundColor: bulkState === "true" ? "var(--ink)" : "transparent",
      color: bulkState === "true" ? "var(--paper)" : "var(--ink)",
    }}
  >
    {bulkMark}
  </span>
  {/* Keep the existing action-label span unchanged. */}
</button>
```

Remove `aria-pressed={allSelected}` from this button. Do not change row-level `aria-pressed` controls.

- [ ] **Step 5: Update the national multi-year copy**

In `series-panel.tsx`, make exactly these two copy changes:

```tsx
<TextTab
  label="სამინისტროები"
  active={grouping === "ministries"}
  onClick={() => onGroupingChange("ministries")}
  testId="grouping-ministries"
/>
```

```tsx
searchPlaceholder="ძებნა"
```

The placeholder no longer needs an `isMinistries` conditional. Keep `isMinistries` because the same adapter still uses it for hierarchy behavior and row rendering.

- [ ] **Step 6: Run the focused browser tests and verify GREEN**

Run the Step 3 command again.

Expected: all selected tests print `ok`. If Windows hangs only after all pass output, record the functional pass count and non-clean timeout separately.

- [ ] **Step 7: Run both complete affected browser specs**

Run:

```powershell
npm.cmd --prefix apps/web run test:browser -- tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts
```

Expected: every national and municipal entity test prints `ok`; no selector, hierarchy, URL, CSV, or search regression.

- [ ] **Step 8: Commit the behavior and copy change**

```powershell
git add apps/web/components/main-explorer/series-selector.tsx apps/web/components/main-explorer/series-panel.tsx apps/web/tests/browser/main-explorer.spec.ts apps/web/tests/browser/municipal-entity.spec.ts
git commit -m "fix(explorer): show partial bulk selection state"
```

---

### Task 2: Synchronize the visual contract and run final verification

**Files:**
- Modify: `DESIGN.md:382, 402-404, 601`
- Verify: all Task 1 files

**Interfaces:**
- Consumes: Task 1's bulk control contract (`role="checkbox"`, `aria-checked`, `series-toggle-indicator`) and the new multi-year copy.
- Produces: canonical design wording matching the implemented selector; no runtime interface.

- [ ] **Step 1: Update the grouping and search copy in `DESIGN.md`**

In the explorer-specific text-tab rule, change only the multi-year expenditure copy to:

```text
the grouping tabs (`სფეროები / სამინისტროები`, expenditure multi-year only)
```

In the search rule, replace the long placeholder requirement with:

```text
The placeholder is `ძებნა` in both fields and ministries grouping.
```

Do not change analysis-view labels or the internal `ministries` identifier.

- [ ] **Step 2: Document the tri-state bulk indicator and accessibility**

Add this compact rule to the action/status-row description:

```text
The bulk indicator is a three-state checkbox: empty (`aria-checked="false"`),
partial with a centered ink dash (`aria-checked="mixed"`), or ink-filled with
a paper checkmark (`aria-checked="true"`). Empty selects all; partial and full
states clear all.
```

Update the accessibility checklist to include `aria-checked` alongside the existing toggle/expansion states.

- [ ] **Step 3: Search for stale active multi-year requirements**

Run:

```powershell
rg -n "სფეროები / უწყებები|ძებნა — უწყება ან პროგრამა|aria-pressed.*series-toggle-all" DESIGN.md apps/web/components/main-explorer apps/web/tests/browser
```

Expected: no active match in the multi-year selector implementation or its maintained design rules. Matches outside that surface, such as analysis-view copy, remain unchanged by design.

- [ ] **Step 4: Commit the documentation update**

```powershell
git add DESIGN.md
git commit -m "docs: specify tri-state series bulk control"
```

- [ ] **Step 5: Run the full non-browser gate**

Run:

```powershell
npm.cmd --prefix apps/web run check
```

Expected: lint, typecheck, unit tests, and data validation all exit 0. The existing Vitest module-type warning is non-blocking but must be reported honestly.

- [ ] **Step 6: Run the production build**

Run:

```powershell
npm.cmd --prefix apps/web run build
```

Expected: exit 0 and all 86 static pages generated.

- [ ] **Step 7: Run the complete browser suite**

Run:

```powershell
npm.cmd --prefix apps/web run test:browser
```

Expected: every test prints `ok`. If all tests pass but Windows teardown hangs, report functional green separately from the non-clean command exit; hosted CI remains the delivery gate.

- [ ] **Step 8: Inspect the live preview**

Open or reload:

```text
http://127.0.0.1:3100/explorer/expenditure
```

Verify visually:

- the total-only initial state shows a centered dash in the bulk square;
- selecting a second row keeps the dash;
- clearing produces an empty square and `ყველას მონიშვნა`;
- selecting all produces the ink-filled checkmark state;
- the grouping tab reads `სამინისტროები`;
- search displays only `ძებნა` in both expenditure groupings;
- municipal and region explorers inherit the same tri-state control.

- [ ] **Step 9: Audit final scope and branch state**

Run:

```powershell
git diff --check
git status --short --branch
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- apps/web/components/analysis apps/web/lib apps/web/app apps/web/prisma data
```

Expected: clean branch; only the planned selector, national adapter copy, browser tests, design/spec/plan docs, and earlier standardized-explorer work differ from `origin/main`. The protected analysis, data, URL, CSV, schema, and route areas have no new diff from this plan.

- [ ] **Step 10: Request final code review**

Use `superpowers:requesting-code-review` against the range from the recorded pre-Task-1 base SHA through the final implementation HEAD. Resolve verified Critical/Important findings through one reviewed fix wave, rerun affected tests, and keep GitHub delivery separate until explicitly authorized.
