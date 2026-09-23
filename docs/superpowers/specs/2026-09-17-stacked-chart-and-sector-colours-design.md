# Stacked column chart and economic-sector colours: specification

Date: 2026-09-17
Status: Approved for inline implementation on 2026-09-18. Scope and packaging were approved in conversation on 2026-09-17, after a reviewed audit of the work merged 2026-09-02..09-14.
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 2 of 8. Spec 8 builds on the chart pieces extracted here.

## 1. Outcome and scope

1. The inflation categories page's default chart (`StackedColumnChart`, the contribution tab) follows the DESIGN.md §8.3 chart contract and the categories spec.
2. The 20 economic sectors get explicit, distinguishable colours that do not borrow other concepts' colours.
3. DESIGN.md's statement about `var()` in SVG presentation attributes matches browser behaviour.

### 1.1 User-approved decisions (2026-09-17)

- Packaging only; no visual decision was taken in conversation.

### 1.2 Decisions taken in this spec

- The stacked chart shares pieces with `EditorialLineChart` through extraction. It is not turned into a mode of the line chart.
- Sector colours become explicit registry entries enforced by a test. The implementation PR proposes the 20 hexes, and the owner approves them from a screenshot before merge.
- Chart code keeps literal hex values and `style`-set fonts as house style, whatever the browser result in §4.

## 2. Stacked column chart — `components/main-explorer/stacked-column-chart.tsx`

### 2.1 Evidence

- **Undefined tokens.** Lattice dots use `fill="var(--rule)"` (`:154`). Axis labels and the readout use `fill-[var(--ink-soft)]` / `text-[var(--ink-soft)]` with `font-mono` (`:176`, `:224`, `:269`). `app/globals.css` defines neither `--rule` nor `--ink-soft`, and the theme defines no `--font-mono`. In Chromium 152 (checked 2026-09-17) an undefined variable computes to black. Every visit to `/explorer/inflation/categories` therefore draws about 1,000 black lattice dots and black labels in Tailwind's default monospace stack, instead of `#C9BEA9` at 0.6 and the site's numeric font.
- **No scroll frame.** The SVG is a plain full-width element (`:140`), so on a 390px phone the 920-unit viewBox shrinks 11-unit labels to about 4.2px. DESIGN.md:589 requires a horizontal scroll container, and the categories spec lists `HorizontalScrollHint` as reused (`2026-09-12-inflation-categories-design.md:200`).
- **Hover gaps.** Hover targets are bar-width (`:231-242`), about 3px at 1440px for the default 164 months, so hover drops between bars.
- **Layout shift.** The readout renders in normal flow under the SVG (`:268-277`), moving the range strip and source note on every hover change. It lists every segment, up to 44.
- **Copied helpers.** `niceMax` and `decimalsFor` (`:40-54`) are copies of `components/main-explorer/editorial-line-chart.tsx:76-91`.
- **Missing spec requirements.** There is no keyboard path, and no dot on the last point of the headline overlay. `2026-09-12-inflation-categories-design.md:210` requires both.

### 2.2 Shared chart pieces

Extract from `editorial-line-chart.tsx`, with no visual change to the line chart:

- `lib/explorer/chartScale.ts`: `niceMax`, `decimalsFor`, exported pure functions.
- `components/main-explorer/chart-frame.tsx`:
  - `ChartScrollFrame`: the `HorizontalScrollHint` plus the `min-w-[720px] min-[900px]:max-[1020px]:min-w-0` container (`:188-196`).
  - `ChartTooltip`: the absolutely positioned tooltip with `TOOLTIP_ROW_CAP` and `buildTooltipRows` (`:59-75`, `:365-392`).
  - Chart constants for the lattice (`#C9BEA9`, opacity 0.6, radius 0.7) and for the axis-label fill and `style={{ fontFamily: "var(--font-numeric)" }}`, taken from the line chart's current values (`:216`, `:230`, `:250`, `:263`).

`EditorialLineChart` imports these pieces. Its existing tests pass unchanged.

### 2.3 Stacked chart changes

- **Lattice and labels** use the shared constants. No `--rule`, `--ink-soft` or `font-mono` remains.
- **Scroll frame:** the SVG sits inside `ChartScrollFrame`.
- **Hover targets:** one transparent rectangle per period, one pitch wide and contiguous with its neighbours.
- **Tooltip:** `ChartTooltip` replaces the in-flow readout. It is absolutely positioned and capped at `TOOLTIP_ROW_CAP` with the line chart's overflow row, so hovering never moves surrounding content.
- **Keyboard:**
  - The plot is focusable (`tabIndex={0}`) and described by the existing screen-reader list.
  - ArrowLeft/ArrowRight move the active period and show the tooltip; Home/End jump to the first/last period; Escape clears.
  - If `EditorialLineChart` already has a keyboard model, reuse it unchanged.
- **End dot:** add a dot on the last point of the headline overlay, sized like the line chart's point marker.
- **Selector font:** `components/main-explorer/series-selector.tsx:240` `font-[family-name:var(--font-mono)]` becomes `var(--font-numeric)`. It carries the category panel's weight metadata (`inflation-category-panel.tsx:93`).

### 2.4 Tests

`tests/explorer/stackedColumnChart.test.tsx` asserts:
- the markup contains no `var(--rule)`, `ink-soft` or `font-mono`
- hover rectangles are as wide as the period pitch
- tooltip rows are capped
- the end dot is present
- focus plus ArrowRight activates a period

`tests/browser/inflation-categories.spec.ts` asserts:
- at 390px the chart container scrolls (`scrollWidth > clientWidth`), while the page itself still does not (the existing assertion)
- hovering two adjacent periods leaves the range strip's `boundingBox().y` unchanged

`niceMax` and `decimalsFor` keep their existing coverage after the move.

## 3. Economic-sector colours — `lib/explorer/economicSectors.ts:26-30`

### 3.1 Evidence

`sectorColor` takes a palette index from the ID's last letter over `EDITORIAL_PALETTE` (14 colours), then shades of those colours via `colorForProgram`. On the baseline:

| Sector | Colour | Clashes with |
|---|---|---|
| A Agriculture | `#B3402A` | the reserved accent |
| B Mining | `#1F6E56` | health's exact colour |
| C Manufacturing | `#3D5A98` | education's exact colour |
| G Trade | `#C26E4C` | transport and economic affairs |
| H Transport | `#2F4B3A` | agriculture and environment |
| N Administrative support | `#94856D` | the "other/unclassified" neutral |
| O–T (e.g. P Education `#196D54`, Q Health `#2E4D91`) | shades of A–F | DESIGN.md §4.2's parent/child rule, which makes them look like children of other sectors |

Mining and Education differ by CIE76 ΔE ≈ 1.2, so they are indistinguishable. This breaks the approved sectors spec ("verified for distinguishability and contrast rather than blindly cycling duplicate colors", `2026-09-11-economic-sectors-design.md:163`) and the site-wide rule that a concept keeps its colour (DESIGN.md:940; `lib/explorer/colors.ts:12-13`, `:69-71`). The only test, `tests/explorer/economicSectors.test.ts:51-55`, compares hex strings for uniqueness.

### 3.2 Rule

- Add 20 explicit entries, `sector.a` … `sector.t`, to `SERIES_COLORS` in `lib/explorer/colors.ts`. `economy.gdp_total` stays `INK`. `sectorColor(id)` returns `SERIES_COLORS[id]` and throws for an ID without an entry; the pipeline already restricts IDs to A–T (`lib/data/economicSectors/prepareEconomicSectors.ts:41-44`).
- Constraints, enforced by the test in §3.3:
  1. No sector uses `ACCENT`, `OTHER_COLOR` or `INK`.
  2. A sector reuses a site concept colour only when it is the same concept. The allowlist:
     - `sector.p` Education → `spending.education`
     - `sector.q` Health → `spending.health`
     - `sector.h` Transport → the transport colour (DESIGN.md:940)
     - `sector.a` Agriculture → the agriculture and environment colour
     - `sector.o` Public administration and defence → `spending.defence`
     - `sector.r` Arts and recreation → `spending.culture`

     Every other sector uses no colour of any `SERIES_COLORS` concept outside `sector.*`.
  3. Pairwise CIEDE2000 distance is at least 10 across the 21 series.
  4. Contrast against paper `#F7F2E9` and tint `#F1EADC` is at least 3:1 (the §4.1 non-text floor, as `tests/explorer/colors.test.ts:42` already checks for every registry colour).
- Stop condition: if no set within the editorial palette family meets constraint 3, the implementer reports the best achievable minimum and the candidate set for an owner decision. The threshold is not lowered silently.
- The PR includes a screenshot of `/explorer/economy/sectors` with all 20 sectors selected, and the owner approves the palette before merge.

### 3.3 Tests

Replace `tests/explorer/economicSectors.test.ts:51-55`. The new test asserts:
- one explicit entry per registry ID
- constraints 1–4, with a small CIEDE2000 helper in the test file; contrast uses the existing `contrastRatio` (`lib/explorer/inflationGrid.ts:51`), or `tests/helpers/contrast.ts` once spec 7 has moved it there
- that colours still do not depend on order (keep the existing order-independence case)

## 4. DESIGN.md statement on `var()` in SVG

Evidence: DESIGN.md §8.3 says SVG text sets fonts via `style` because "the `font-family` presentation attribute does not resolve `var()`" (`:571`), and that "`var()` does not resolve in SVG presentation attributes" (`:575`).
- A probe in the desktop app's Chromium 152 on 2026-09-17 found `fill="var(--ink)"`, `stroke="var(--ink)"` and `font-family="var(--num)"` all resolved.
- An undefined variable computed to black.
- Shipped code already relies on resolution (`components/municipalities/municipality-map.tsx:314-315`).

Change:
1. Run the same probe in WebKit and Firefox, using a throwaway Playwright spec that is not committed, on engines installed with the user's consent.
2. If every engine resolves `var()`, reword both sentences:
   - literal hex values and `style`-set fonts are house style for chart code
   - an undefined custom property renders black
   - so chart code must not reference tokens that `globals.css` does not define
3. If an engine does not resolve `var()`, keep the rule and name that engine.
4. If WebKit cannot be tested, reword to state the Chromium result and keep the house-style rule.

## 5. Non-goals

- The line chart's own label size on phones: 11 units in a 720px frame is below the 10px floor (DESIGN.md:586), a pre-existing approved design.
- Budget, municipal and inflation category colours.
- Any change to the sectors chart form or tooltip content.

## 6. Documents to update in the same change

- DESIGN.md §8.3 (`:571`, `:575`), per §4.
- DESIGN.md: the sectors section gains a sector colour table and the §3.2 rule, beside the §25.1 category colour table.

## 7. Verification and acceptance

Feedback while editing:

```bash
npx vitest run tests/explorer/stackedColumnChart.test.tsx tests/explorer/economicSectors.test.ts
```

```bash
npx playwright test tests/browser/inflation-categories.spec.ts tests/browser/economic-sectors.spec.ts
```

Done-check: `npm run check`, `npm run build` and `npm run test:browser` on the production-build recipe.

Acceptance:

- On `/explorer/inflation/categories` in both locales, the default tab meets all of:
  - lattice dots compute to `rgb(201, 190, 169)` at opacity 0.6
  - axis labels use the numeric font
  - the chart scrolls at 390px
  - hovering never moves the range strip
  - the tooltip is capped
  - the chart is reachable and operable by keyboard
  - the headline overlay ends in a dot
- On `/explorer/economy/sectors`, the test-enforced palette is in place and the owner has approved the screenshot.

## 8. Authority and next step

This spec owns the bounded decisions in §1. DESIGN.md stays the owner of the visual rules and is amended in the same change. After user review, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-stacked-chart-and-sector-colours.md`.
