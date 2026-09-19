# Explorer Interaction Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The newer explorers behave like the established ones when a reader changes state, shares a link or uses Back.

**Architecture:** These are behaviour fixes inside the existing components, each with a browser or unit test:
1. **Pristine URLs:** GDP and both inflation pages adopt the budget explorer's rule of never stamping the incoming URL.
2. **Sectors history:** push a history entry only for discrete switches.
3. **Debt Clear:** the bulk control restores the family default, mirroring the inflation categories fix `d7c2612ef`.
4. **Sector search:** sectors reuse the shared label matcher.
5. **Announcements:** sectors announce the period on a measure change only, like GDP.
6. **Headers:** the economy heading and the GDP/sectors coverage lines match the other explorers.
7. **DESIGN.md §6.3:** documents every section's hash keys and the write rules.

Hash keys are not renamed. Code unification is spec 8.

**Tech Stack:** React 19, strict TypeScript, Vitest 4 (Node environment), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-explorer-interaction-consistency-design.md`

## Global Constraints

- **Branch:** work on `codex/explorer-interaction-consistency`, created from `main`. Never commit to `main`. Every command runs from `apps/web`.
- **Hash keys stay as they are.** No hash key or value is renamed, so existing shared links keep working.
- **URL write rules** (spec §1.2):
  - Never write the hash while applying an incoming URL.
  - Continuous changes (range, selection) use `history.replaceState`.
  - Only the sectors measure and view switches use `history.pushState`.
  - Every history call sits in `try { … } catch { /* History can be unavailable in some embedded contexts; the UI still works. */ }`, as in `components/main-explorer/use-explorer-state.ts:188-192`.
- **Reference implementation:** the budget explorer (`use-explorer-state.ts:181-193`). Effects depend on the serialized hash string, not the state object, so React StrictMode's double effects in `next dev` cannot stamp a URL.
- **Test loop:** targeted tests while editing; the full gates run once, in Task 8. Browser specs need `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` and `CI=1`: with `CI=1`, `playwright.config.ts` builds and serves production on port 3100 (which must be free); without it the config starts `next dev`, where hydration-dependent interactions are unreliable. Each `CI=1` run pays a build, so red and green runs of neighbouring tasks can share one.

---

### Task 1: Never stamp a pristine URL on GDP and the inflation pages

**Files:**
- Modify: `apps/web/components/gdp/gdp-overview.tsx:58-60`
- Modify: `apps/web/components/inflation/inflation-overview.tsx:61-63`
- Modify: `apps/web/components/inflation/inflation-categories.tsx:87-89`
- Create: `apps/web/tests/browser/pristine-urls.spec.ts`

**Interfaces:**
- Consumes: `serializeGdpHash(state)`, `serializeInflationHash(state)`, `serializeCategoryHash(state)`, which are already imported in the three components.
- Produces: nothing new.

- [ ] **Step 1: Write the failing browser test**

Create `apps/web/tests/browser/pristine-urls.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

// Opening a page must not rewrite its URL: a stamped default hash turns every
// plain link into a deep link. Pages still write the hash once the reader acts.
for (const path of [
  "/en/explorer/economy/gdp",
  "/en/explorer/inflation/overview",
  "/en/explorer/inflation/categories",
  "/en/explorer/economy/sectors",
]) {
  test(`opening ${path} leaves the URL without a hash`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    // Let the post-hydration effects run before reading the URL.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => window.location.hash)).toBe("");
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/pristine-urls.spec.ts --reporter=list`
Expected: the GDP and both inflation tests FAIL, with a hash such as `#indicator=real&view=line&currency=gel&range=all`. The sectors test passes: its hook never writes on mount.

- [ ] **Step 3: Implement for GDP**

In `apps/web/components/gdp/gdp-overview.tsx`, add `useRef` to the existing `react` import. Replace lines 58–60:

```tsx
  useEffect(() => {
    if (ready) history.replaceState(null, "", `#${serializeGdpHash(state)}`);
  }, [state, ready]);
```

with:

```tsx
  const serializedHash = serializeGdpHash(state);
  const hashApplied = useRef(false);
  useEffect(() => {
    if (!ready) return;
    // Skip the run that applies the incoming hash: writing it back would stamp a
    // pristine URL with the default state (use-explorer-state.ts has the same rule).
    if (!hashApplied.current) {
      hashApplied.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${serializedHash}`);
    } catch {
      // History can be unavailable in some embedded contexts; the UI still works.
    }
  }, [serializedHash, ready]);
```

- [ ] **Step 4: Implement for the inflation overview**

In `apps/web/components/inflation/inflation-overview.tsx`, add `useRef` to the `react` import. Replace lines 61–63:

```tsx
  useEffect(() => {
    if (ready) history.replaceState(null, "", `#${serializeInflationHash(state)}`);
  }, [ready, state]);
```

with:

```tsx
  const serializedHash = serializeInflationHash(state);
  const hashApplied = useRef(false);
  useEffect(() => {
    if (!ready) return;
    // Skip the run that applies the incoming hash: writing it back would stamp a
    // pristine URL with the default state (use-explorer-state.ts has the same rule).
    if (!hashApplied.current) {
      hashApplied.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${serializedHash}`);
    } catch {
      // History can be unavailable in some embedded contexts; the UI still works.
    }
  }, [serializedHash, ready]);
```

- [ ] **Step 5: Implement for the inflation categories**

In `apps/web/components/inflation/inflation-categories.tsx`, add `useRef` to the `react` import. Replace lines 87–89:

```tsx
  useEffect(() => {
    if (ready) history.replaceState(null, "", `#${serializeCategoryHash(state)}`);
  }, [ready, state]);
```

with:

```tsx
  const serializedHash = serializeCategoryHash(state);
  const hashApplied = useRef(false);
  useEffect(() => {
    if (!ready) return;
    // Skip the run that applies the incoming hash: writing it back would stamp a
    // pristine URL with the default state (use-explorer-state.ts has the same rule).
    if (!hashApplied.current) {
      hashApplied.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${serializedHash}`);
    } catch {
      // History can be unavailable in some embedded contexts; the UI still works.
    }
  }, [serializedHash, ready]);
```

- [ ] **Step 6: Run the pristine test and the pages' own specs**

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/pristine-urls.spec.ts tests/browser/gdp-overview.spec.ts tests/browser/inflation-overview.spec.ts tests/browser/inflation-categories.spec.ts --reporter=list`
Expected: PASS. The existing hash assertions still pass because they follow an interaction:
- `gdp-overview.spec.ts:61` expects `start=1996&end=2000` after a tab click.
- `gdp-overview.spec.ts:64` expects `range=all` after a tab click.
- `inflation-overview.spec.ts:48` and `:58-60` check `r=` after interactions.

- [ ] **Step 7: Commit**

```bash
git add components/gdp/gdp-overview.tsx components/inflation/inflation-overview.tsx components/inflation/inflation-categories.tsx tests/browser/pristine-urls.spec.ts
git commit -m "fix(explorer): stop stamping a default hash on GDP and inflation pages"
```

---

### Task 2: Sectors push history only for measure and view switches

**Files:**
- Modify: `apps/web/components/economic-sectors/use-economic-sectors-state.ts:41-51`
- Modify: `apps/web/components/economic-sectors/economic-sectors-explorer.tsx:138` (view) and `:155-157` (measure)
- Test: `apps/web/tests/browser/economic-sectors.spec.ts`

**Interfaces:**
- Produces: `update(change: (previous: SectorState) => SectorState, historyMode?: "push" | "replace")`. The default is `"replace"`.

- [ ] **Step 1: Write the failing browser test**

Append to `apps/web/tests/browser/economic-sectors.spec.ts`:

```ts
test("range drags and arrow keys replace history; only measure and view add entries", async ({ page }) => {
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const initial = await page.evaluate(() => history.length);

  await page.getByRole("button", { name: "Real growth %", exact: true }).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "real_growth");
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);

  const startHandle = page.getByRole("slider", { name: "Start year" });
  await startHandle.focus();
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("ArrowRight");
  await expect(startHandle).toHaveAttribute("aria-valuenow", "2016");

  const box = (await page.getByTestId("range-start-handle").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 16 });
  await page.mouse.up();
  expect(await page.evaluate(() => history.length)).toBe(initial + 1);

  await page.goBack();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "nominal");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/economic-sectors.spec.ts -g "range drags" --reporter=list`
Expected: FAIL; `history.length` grows past `initial + 1` after the arrow presses.

- [ ] **Step 3: Implement the history mode in the hook**

In `apps/web/components/economic-sectors/use-economic-sectors-state.ts`, replace the `update` callback (lines 41–51) with:

```ts
  const update = useCallback(
    (change: (previous: SectorState) => SectorState, historyMode: "push" | "replace" = "replace") => {
      const next = change(current.current);
      current.current = next;
      const hash = `#${serializeSectorHash(next)}`;
      if (window.location.hash !== hash) {
        try {
          // Only a discrete switch earns a Back step. A range drag fires once per
          // year crossed and must replace the entry, or Back would replay the drag.
          if (historyMode === "push") window.history.pushState(null, "", hash);
          else window.history.replaceState(null, "", hash);
        } catch {
          // History can be unavailable in some embedded contexts; the UI still works.
        }
      }
      setState(next);
    },
    [],
  );
```

- [ ] **Step 4: Push for the view and measure switches**

In `apps/web/components/economic-sectors/economic-sectors-explorer.tsx`, line 138 changes from

```tsx
                onChange={(mode) => update((s) => ({ ...s, mode }))}
```

to

```tsx
                onChange={(mode) => update((s) => ({ ...s, mode }), "push")}
```

Lines 155–157 change from

```tsx
                onChange={(measure) =>
                  update((s) => changeSectorMeasure(s, measure, facts))
                }
```

to

```tsx
                onChange={(measure) =>
                  update((s) => changeSectorMeasure(s, measure, facts), "push")
                }
```

The range (lines 211–223) and selection (lines 244–246) calls keep the default `"replace"`.

- [ ] **Step 5: Run the sectors spec**

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/economic-sectors.spec.ts --reporter=list`
Expected: PASS, including the new test and the existing test `"sector selections, measures and manual period survive history and language changes"` (lines 164–183), which goes back across two measure clicks.

- [ ] **Step 6: Commit**

```bash
git add components/economic-sectors/use-economic-sectors-state.ts components/economic-sectors/economic-sectors-explorer.tsx tests/browser/economic-sectors.spec.ts
git commit -m "fix(economy): keep range and selection changes out of sectors browser history"
```

---

### Task 3: Debt "Clear" can be undone from the same control

**Files:**
- Modify: `apps/web/components/debt/debt-series-panel.tsx`: imports at lines 9 and 11, props type at lines 14–22, destructuring at lines 34–42, the `SeriesSelector` props at lines 94–98
- Modify: `apps/web/components/debt/debt-explorer.tsx`: the `<DebtSeriesPanel …>` element (lines 279–303)
- Test: `apps/web/tests/explorer/debtRoute.test.tsx`: replace the test at lines 368–395
- Test: `apps/web/tests/browser/debt.spec.ts`

**Interfaces:**
- Consumes: `getDefaultDebtSelection(family: DebtFamily): DebtSeriesId[]` (`lib/explorer/debtExplorer.ts:83`).
- Produces: a new required prop `family: DebtFamily` on `DebtSeriesPanel`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/explorer/debtRoute.test.tsx`, replace the test `"shows an empty nine-row count without offering an impossible select-all action"` (lines 368–395) with:

```tsx
  it("offers the bulk control on an empty selection so clearing can be undone", async () => {
    const components = await loadDebtComponents();
    expect(components).not.toBeNull();
    if (!components) return;

    const noop = () => {};
    const markup = renderGeorgianMarkup(createElement(components.DebtExplorerSurface, {
      facts,
      gdpFacts,
      workbookSources: [],
      lastUpdatedAt: reviewedAt,
      family: "stock",
      chartMode: "line",
      shareOfGdp: false,
      range: { start: 2013, end: 2025, min: 2013, max: 2025 },
      selectedIds: [],
      onChartModeChange: noop,
      onShareChange: noop,
      onRangeChange: noop,
      onSelectionChange: noop,
      onToggleSeries: noop,
    }));
    const visibleText = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    expect(visibleText).toContain("სერიები 0 / 9");
    expect(visibleText).toContain("ყველას მონიშვნა");
    expect(markup).toMatch(/<button[^>]*data-testid="series-toggle-all"[^>]*aria-checked="false"/);
  });
```

Append inside `test.describe("Government Debt explorer", …)` in `apps/web/tests/browser/debt.spec.ts`, before its closing `});`:

```ts
  test("clearing the debt selection can be undone from the same control", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/debt`);
    await expectAppReady(page);
    const bulk = page.getByTestId("series-toggle-all");
    const total = seriesRow(page, "debt.stock.total").getByTestId("series-row-toggle");
    await expect(bulk).toHaveAttribute("aria-checked", "true");

    await bulk.click();
    await expect(total).toHaveAttribute("aria-pressed", "false");
    await expect(bulk).toBeVisible();
    await expect(bulk).toHaveAttribute("aria-checked", "false");

    await bulk.click();
    await expect(total).toHaveAttribute("aria-pressed", "true");
    await expect(bulk).toHaveAttribute("aria-checked", "true");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/explorer/debtRoute.test.tsx`
Expected: the new unit test FAILS; the markup has no `series-toggle-all` button.

- [ ] **Step 3: Implement in the panel**

In `apps/web/components/debt/debt-series-panel.tsx`:

Line 9 becomes:

```tsx
import { getDefaultDebtSelection, type GovernmentDebtExplorerModel } from "../../lib/explorer/debtExplorer";
```

Line 11 becomes:

```tsx
import type { DebtFamily, DebtSeriesId, ServedGovernmentDebtFact } from "../../lib/servedRows";
```

In `DebtSeriesPanelProps` (lines 14–22), add after `items: …;`:

```tsx
  family: DebtFamily;
```

In the destructuring (lines 34–42), add `family,` after `items,`.

Directly before the `return (`, add:

```tsx
  // The bulk control clears, then restores the family's default total. Families
  // are exclusive, so all nine rows can never be selected at once; restoring the
  // default is the reversible state (the inflation categories rule, d7c2612ef).
  const defaultSelection = getDefaultDebtSelection(family);
  const isDefaultSelection =
    selectedIds.length === defaultSelection.length && defaultSelection.every((id) => selectedIds.includes(id));
```

In the `SeriesSelector` element, replace these three props (lines 95–97):

```tsx
        allSelected={false}
        onToggleAll={() => onSelectionChange([])}
        allowSelectAll={false}
```

with:

```tsx
        allSelected={isDefaultSelection}
        onToggleAll={() => onSelectionChange(hasSelection ? [] : getDefaultDebtSelection(family))}
```

- [ ] **Step 4: Pass the family from the surface**

In `apps/web/components/debt/debt-explorer.tsx`, add a line to the `<DebtSeriesPanel` element after `items={model.items}`:

```tsx
            family={props.family}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/explorer/debtRoute.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit 0.

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/debt.spec.ts --reporter=list`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/debt/debt-series-panel.tsx components/debt/debt-explorer.tsx tests/explorer/debtRoute.test.tsx tests/browser/debt.spec.ts
git commit -m "fix(debt): let the bulk control restore the default after clearing"
```

---

### Task 4: Sector search uses the shared label matcher

**Files:**
- Modify: `apps/web/lib/explorer/economicSectors.ts`: new import; new function after `rankSectorDefinitions` (lines 15–24)
- Modify: `apps/web/components/economic-sectors/sector-series-panel.tsx:35-41` and `:61`
- Test: `apps/web/tests/explorer/economicSectors.test.ts`

**Interfaces:**
- Consumes: `matchesLabelQuery(query: string, values: readonly string[]): boolean` (`lib/i18n/search.ts`).
- Produces: `sectorMatchesQuery(definition: SectorDefinition, query: string): boolean`.

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/explorer/economicSectors.test.ts`, add `sectorMatchesQuery` to the import list on line 3. Append:

```ts
test("sector search matches either label or the NACE code with the shared matcher", () => {
  const ict = registry.find((row) => row.id === "sector.j")!;
  expect(sectorMatchesQuery(ict, "information")).toBe(true);
  expect(sectorMatchesQuery(ict, ict.labelKa.slice(0, 5))).toBe(true);
  expect(sectorMatchesQuery(ict, " J ")).toBe(true);
  expect(sectorMatchesQuery(ict, "")).toBe(true);
  expect(sectorMatchesQuery(ict, "no-such-sector")).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/economicSectors.test.ts`
Expected: FAIL with `TypeError: sectorMatchesQuery is not a function`.

- [ ] **Step 3: Implement the matcher**

In `apps/web/lib/explorer/economicSectors.ts`, add after the existing imports:

```ts
import { matchesLabelQuery } from "../i18n/search";
```

Add directly after `rankSectorDefinitions` (after line 24):

```ts
/** Search across both labels and the NACE code with the site's shared matcher. */
export function sectorMatchesQuery(definition: SectorDefinition, query: string): boolean {
  return matchesLabelQuery(query, [definition.labelKa, definition.labelEn, definition.classificationCode ?? ""]);
}
```

- [ ] **Step 4: Use it in the panel**

In `apps/web/components/economic-sectors/sector-series-panel.tsx`, add `sectorMatchesQuery` to the existing import from `"../../lib/explorer/economicSectors"`.

Replace lines 35–41:

```tsx
  const normalized = query.trim().toLocaleLowerCase();
  const ordered = rankSectorDefinitions(registry, endValues);
  const matches = (r: SectorDefinition) =>
    `${r.labelKa} ${r.labelEn} ${r.classificationCode ?? ""}`
      .toLocaleLowerCase()
      .includes(normalized);
  const visible = ordered.filter((r) => r.id === SECTOR_GDP || matches(r));
```

with:

```tsx
  const ordered = rankSectorDefinitions(registry, endValues);
  // Total GDP stays pinned whatever the query, like every panel's total row.
  const visible = ordered.filter((r) => r.id === SECTOR_GDP || sectorMatchesQuery(r, query));
```

Replace line 61:

```tsx
        hasVisibleMatches={ordered.some(matches)}
```

with:

```tsx
        hasVisibleMatches={ordered.some((r) => sectorMatchesQuery(r, query))}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/explorer/economicSectors.test.ts`
Expected: PASS.

Run: `npm run lint && npm run typecheck`
Expected: exit 0. If `SectorDefinition` is now an unused import in the panel, remove it.

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/economic-sectors.spec.ts -g "search never restricts" --reporter=list`
Expected: PASS. With a non-matching query, one row (Total GDP) stays visible.

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/economicSectors.ts components/economic-sectors/sector-series-panel.tsx tests/explorer/economicSectors.test.ts
git commit -m "fix(economy): search sectors with the shared label matcher"
```

---

### Task 5: Sectors announce the period only when the measure changes

**Files:**
- Modify: `apps/web/components/economic-sectors/economic-sectors-explorer.tsx`: react import at line 2; state near line 48; measure `onChange` (lines 155–157, as changed in Task 2); status paragraph at lines 117–122
- Test: `apps/web/tests/explorer/economicSectorsPage.test.tsx`
- Test: `apps/web/tests/browser/economic-sectors.spec.ts`

**Interfaces:**
- Consumes: `update(change, "push")` (Task 2); `buildEconomicSectorsModel`, `changeSectorMeasure` (already imported); the message `sectors.rangeChanged` (ka `პერიოდი: {start}–{end}`, en `Period: {start}–{end}`).
- Produces: nothing new. This matches GDP's `select()` (`components/gdp/gdp-overview.tsx:82-91`).

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/tests/explorer/economicSectorsPage.test.tsx`:

```tsx
test("the sectors status region starts silent", async () => {
  const html = renderToStaticMarkup(await renderEconomicSectorsPage("en"));
  expect(html).toContain('<p role="status" class="sr-only"></p>');
});
```

Append to `apps/web/tests/browser/economic-sectors.spec.ts`:

```ts
test("announces the period when the measure changes, not on every range change", async ({ page }) => {
  await page.goto("/en/explorer/economy/sectors");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  // The explorer's own announcer; the Excel button keeps a separate status line.
  const status = page.getByTestId("economic-sectors-explorer").locator('p.sr-only[role="status"]');
  await expect(status).toHaveText("");

  const startHandle = page.getByRole("slider", { name: "Start year" });
  await startHandle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("");

  await page.getByRole("button", { name: "Real growth %", exact: true }).click();
  await expect(status).toHaveText(/^Period: \d{4}–\d{4}$/);
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npx vitest run tests/explorer/economicSectorsPage.test.tsx`
Expected: the new test FAILS; the status paragraph contains `Period: 2010–2025`.

- [ ] **Step 3: Implement**

In `apps/web/components/economic-sectors/economic-sectors-explorer.tsx`:

Line 2 becomes:

```tsx
import { useMemo, useState } from "react";
```

After `const { state, update } = useEconomicSectorsState(facts, registry);` (line 48), add:

```tsx
  const [announcement, setAnnouncement] = useState("");
```

Replace the status paragraph (lines 117–122):

```tsx
      <p role="status" className="sr-only">
        {message(messages, "sectors.rangeChanged", {
          start: model.range.start,
          end: model.range.end,
        })}
      </p>
```

with:

```tsx
      <p role="status" className="sr-only">
        {announcement}
      </p>
```

Replace the measure `onChange` (as left by Task 2):

```tsx
                onChange={(measure) =>
                  update((s) => changeSectorMeasure(s, measure, facts), "push")
                }
```

with:

```tsx
                onChange={(measure) => {
                  const next = changeSectorMeasure(state, measure, facts);
                  update(() => next, "push");
                  // Announce the period the new measure lands on, as GDP does on a tab change.
                  const nextModel = buildEconomicSectorsModel(facts, registry, next);
                  setAnnouncement(message(messages, "sectors.rangeChanged", {
                    start: nextModel.range.start,
                    end: nextModel.range.end,
                  }));
                }}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/explorer/economicSectorsPage.test.tsx`
Expected: PASS.

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/economic-sectors.spec.ts --reporter=list`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/economic-sectors/economic-sectors-explorer.tsx tests/explorer/economicSectorsPage.test.tsx tests/browser/economic-sectors.spec.ts
git commit -m "fix(economy): announce the sectors period on measure changes only"
```

---

### Task 6: Consistent heading and coverage line

**Files:**
- Modify: `apps/web/lib/pages/economy.tsx:43`
- Modify: `apps/web/components/gdp/gdp-overview.tsx:112-115`
- Modify: `apps/web/lib/pages/economic-sectors.tsx:42`
- Create: `apps/web/tests/explorer/explorerCoverage.test.tsx`
- Test: `apps/web/tests/browser/gdp-overview.spec.ts`

**Interfaces:**
- Consumes: the messages `main.updated` (loaded by both pages: `lib/pages/gdp.tsx:32`, `lib/pages/economic-sectors.tsx:27`) and `formatDisplayDate(isoDate: string, locale: Locale): string` (`lib/explorer/format.ts:151`).
- Produces: nothing new. The format matches debt (`components/debt/debt-explorer.tsx:121-124`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/explorer/explorerCoverage.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { renderEconomicSectorsPage } from "../../lib/pages/economic-sectors";
import { renderGdpPage } from "../../lib/pages/gdp";

test.each(["ka", "en"] as const)("GDP and sectors coverage lines say when the data was updated: %s", async (locale) => {
  const word = locale === "en" ? "Updated" : "განახლდა";
  for (const render of [renderGdpPage, renderEconomicSectorsPage]) {
    const html = renderToStaticMarkup(await render(locale));
    expect(html).toMatch(new RegExp(`\\d{4}–\\d{4} · ${word} `));
  }
});
```

Append to `apps/web/tests/browser/gdp-overview.spec.ts`:

```ts
test("the Economy heading steps from 30px on phones to 40px on wider screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/explorer/economy");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCSS("font-size", "30px");
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(heading).toHaveCSS("font-size", "40px");
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npx vitest run tests/explorer/explorerCoverage.test.tsx`
Expected: FAIL; the coverage reads `1960–2025 · 2026-09-11`.

- [ ] **Step 3: Implement the coverage lines**

In `apps/web/components/gdp/gdp-overview.tsx`, make sure `formatDisplayDate` is imported from `"../../lib/explorer/format"`; add it to the existing import from that module if there is one. Directly after the `select` function (ends at line 92), add:

```tsx
  const lastReviewedAt = facts.map((f) => f.lastReviewedAt).sort().at(-1) ?? "";
```

Replace the `coverage` prop (lines 112–115) with:

```tsx
          coverage={`${m.range.min}–${m.range.max} · ${message(messages, "main.updated", {
            date: locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt,
          })}`}
```

In `apps/web/lib/pages/economic-sectors.tsx`, add the import:

```tsx
import { formatDisplayDate } from "../explorer/format";
```

Replace line 42:

```tsx
        <PageHeader crumbs={crumbs} coverage={`${firstYear}–${lastYear} · ${dateModified}`}/>
```

with:

```tsx
        <PageHeader crumbs={crumbs} coverage={`${firstYear}–${lastYear} · ${message(presentation.messages, "main.updated", { date: locale === "en" ? formatDisplayDate(dateModified, locale) : dateModified })}`}/>
```

- [ ] **Step 4: Implement the heading**

In `apps/web/lib/pages/economy.tsx`, replace line 43:

```tsx
          <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[40px] font-semibold">
```

with:

```tsx
          <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/explorer/explorerCoverage.test.tsx tests/explorer/economicSectorsPage.test.tsx tests/explorer/gdpRoute.test.tsx`
Expected: PASS.

Run: `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/gdp-overview.spec.ts --reporter=list`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/pages/economy.tsx components/gdp/gdp-overview.tsx lib/pages/economic-sectors.tsx tests/explorer/explorerCoverage.test.tsx tests/browser/gdp-overview.spec.ts
git commit -m "fix(economy): align the hub heading and GDP/sectors coverage lines with other explorers"
```

---

### Task 7: Document every section's hash keys in DESIGN.md §6.3

**Files:**
- Modify: `DESIGN.md:334` (the `Keys:` paragraph in §6.3)

**Interfaces:** none. Documentation only.

- [ ] **Step 1: Replace the key paragraph**

In `DESIGN.md`, replace line 334:

```markdown
Keys: `g` grouping (expenditure only), `m` mode, `sh` share measure, `r` range, `sel` selection; `as` analysis side, `ag` analysis grouping, `ay` analysis year. The hash never carries `nav`.
```

with:

```markdown
Keys by section. The hash never carries `nav`, and no key is renamed once shipped — shared links depend on them.

| Section | Keys | Notes |
|---|---|---|
| Expenditure, revenue, analysis | `g` grouping (expenditure only), `m` mode, `sh` share measure, `r` range, `sel` selection; `as` analysis side, `ag` analysis grouping, `ay` analysis year | — |
| Municipalities | `m`, `sh`, `r`, `sel` on the country, region and municipality pages; `lvl=region` on the index | `lvl` switches the index list to regions. |
| Government debt | `f` family, `m`, `sh`, `r`, `sel` | An empty `sel=` is a deliberate clear and survives a reload. |
| General-government deficit | `m`, `sh`, `r`, `sel` | A missing `sh` means percent of GDP, the section's default measure. |
| GDP overview | `indicator`, `view`, `currency`, `range=all` or `start`/`end` | — |
| Economic sectors | `measure`, `view`, `sel`, `range=all` or `start`/`end` | — |
| Inflation overview | `i` indicator, `m` mode, `r=YYYY-MM-YYYY-MM`, `sel`, `t` table series | — |
| Inflation categories | `i`, `m`, `r`, `sel`, `t`, `x` expanded divisions | — |

Write rules: applying an incoming URL never writes the hash, so a pristine URL stays clean; continuous changes (range, selection) replace the history entry; only discrete switches a section's spec asks Back to step through push one — today the economic sectors measure and view.
```

- [ ] **Step 2: Check the municipal keys against the code**

Run: `grep -n "params.get(\"\|params.set(\"" components/municipalities/*.ts* lib/explorer/*unicipal*.ts`
Expected: the municipal parser reads `m`, `sh`, `r` and `sel`. If it reads a different set, correct the "Municipalities" row to the keys the code actually uses before committing.

Result when executed (2026-09-18): that grep finds nothing, because the municipal codec lives in `lib/explorer/urlState.ts`. `parseMunicipalHash` and `serializeMunicipalHash` use the shared `m`, `sh`, `r`, `sel` keys (the explorer on the country, region and municipality pages), and `parseMunicipalLevel` reads `lvl=region`, which the index writes. The row in Step 1 already names both.

- [ ] **Step 3: Commit**

```bash
git add ../../DESIGN.md
git commit -m "docs(design): list each explorer's hash keys and the URL write rules"
```

---

### Task 8: Done-check and acceptance

**Files:** none (verification only).

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 2: Build**

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`
Expected: exit 0. The build bakes the site origin into static pages, the sitemap and workbook links; built without it, the Step 3 suite fails about 139 URL assertions (`http://localhost:3000` instead of `https://fiscal.ge`).

- [ ] **Step 3: Browser suite on the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass. If `municipal-entity.spec.ts` "sourced percentage workbook" times out under load, re-run that file alone before calling it a regression.

- [ ] **Step 4: Acceptance walk**

Check each of these in both locales on `http://localhost:3100`:

1. Opening `/explorer/economy/gdp`, `/explorer/inflation/overview` and `/explorer/inflation/categories` leaves the URL without a hash.
2. On `/explorer/economy/sectors`, dragging the range adds no history entries, and Back after a measure click returns the previous measure.
3. On `/explorer/debt`, the bulk control clears and then restores the stock total.
4. Sector search finds `J`, English labels and Georgian labels.
5. The sectors status region is silent on range changes and names the period after a measure change.
6. The Economy H1 is 30px at 390px.
7. The GDP and sectors coverage lines read `… · Updated …` / `… · განახლდა …`.

- [ ] **Step 5: Hand off**

Push `codex/explorer-interaction-consistency` and open a draft PR with the spec path and the acceptance list. Merge only after CI is green.
