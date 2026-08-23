# Municipality Map Design QA

## Evidence

- Source visual truth: `C:\Users\Mylaptop\.codex\visualizations\2026\08\06\019fd8a6-6e57-7820-8879-5e6681b4761a\municipality-geometry-preview.html`
- Desktop source capture: `C:\tmp\municipality-map-source-desktop.png`
- Desktop implementation capture: `C:\tmp\municipality-map-desktop.png`
- Mobile source capture: `C:\tmp\municipality-map-source-mobile.png`
- Mobile implementation capture: `C:\tmp\municipality-map-mobile.png`
- Final side-by-side desktop comparison: `C:\Users\Mylaptop\.codex\worktrees\00e2\Geodata.ge\.tmp\municipality-map-comparison-desktop-final.png`
- Final side-by-side mobile comparison: `C:\Users\Mylaptop\.codex\worktrees\00e2\Geodata.ge\.tmp\municipality-map-comparison-mobile-final.png`
- Tooltip interaction capture: `C:\Users\Mylaptop\.codex\worktrees\00e2\Geodata.ge\.tmp\municipality-map-tooltip-desktop.png`
- Route/state: `/explorer/municipalities`, latest official year 2025, municipality list active unless otherwise noted. Final implementation captures were regenerated from code HEAD `820b15a473ffa0af6b5707069286ceb7bd4277fc` after the interaction and validation review fixes.

These images are intentionally local, uncommitted QA evidence under Task 7 of the approved implementation plan. The durable regression contract is the municipality browser suite and hosted CI; this document records the human visual comparison rather than defining a pixel-diff baseline.

Desktop source and implementation were both captured at a 1440 x 900 CSS viewport and are 1440 x 900 pixels. Mobile source and implementation were both captured at a 390 x 844 CSS viewport and are 390 x 844 pixels. Pixel dimensions equal CSS viewport dimensions, so the comparison is normalized at 1:1 density.

## Findings

No actionable P0, P1, or P2 visual differences remain.

The geometry in the rendered implementation matches the approved preview: the corrected Zugdidi polygon has the same substantive size and silhouette, municipal boundaries are continuous, the national fit is unchanged, Tbilisi retains its polygon and city marker, and all five green city markers are visible. Abkhazia and the Tskhinvali overlay retain the approved pale hatched treatment. Their labels, explanatory copy, and legend key from the early preview are intentionally absent because the user later approved a stricter no-public-copy contract.

The source is a standalone geometry demonstrator while the implementation is embedded in GeoData's production editorial shell with the ranked list and KPI section. The resulting map scale and Georgian page copy are intentional product-context differences, not fidelity defects.

## Required Fidelity Surfaces

- Fonts and typography: the implementation uses the existing Georgian serif display, Georgian sans UI, and mono numeric system consistently. Headings, map kicker, legend values, tooltip copy, and ranked-list numerals retain clear hierarchy and readable optical weights on desktop and mobile. No clipping or unintended truncation is visible.
- Spacing and layout rhythm: the desktop two-column map/list composition follows the existing shell; the map, legend, KPI rule, and list align cleanly. At 390 x 844 the shell collapses, the map stays within the content column, and the legend wraps without overlap. No persistent control is hidden by horizontal overflow.
- Colors and visual tokens: the warm paper, ink rules, terracotta quantile ramp, pale occupied overlays, and green city markers match the approved direction and the project's tokens. Active Batumi styling preserves the marker color while strengthening its geometry.
- Image quality and asset fidelity: the map remains native deterministic SVG geometry rather than a raster or placeholder substitute. Boundary edges and hatch patterns are crisp at both viewports; no compression, transparency halo, masking, or scaling artifact is visible.
- Copy and content: live Georgian labels and official 2025 values are coherent. The visible tooltip contains only municipality name, formatted amount, and arrow; the accessible name carries the opening action. Linked OpenStreetMap attribution and ODbL are present, with no occupied-territory or no-data map copy.
- Icons and affordances: the existing editorial arrow affordance remains consistent between tooltip and ranked list. No extra open-action text appears visually.
- Accessibility and interaction states: in-app verification found 60 polygons, five markers, two inert overlays, no console warnings/errors, and exact `aria-describedby` ownership on the hovered Batumi marker. The tooltip measured 200 x 50 and remained inside the SVG. Switching to Regions retained all 60 municipality shapes and left no active municipality target. The browser suite separately verified Enter/Space navigation, exact focus behavior, no rectangular SVG outline, list/map precedence, and 340 px tooltip containment.

## Full-view Comparison Evidence

The desktop side-by-side composite compares the two 1440 x 900 captures in one image. It shows the same Georgia silhouette, corrected western municipality geometry, occupied overlays, fill distribution, and five city markers. The mobile side-by-side composite compares both 390 x 844 captures in one image and confirms that the implemented map remains legible and contained inside the collapsed shell.

## Focused-region Comparison Evidence

A separate crop was not needed: in the desktop comparison the map occupies most of the source frame and remains large enough in the implementation frame to inspect Zugdidi, both occupied overlays, the southeast Tbilisi geometry, boundary continuity, and markers directly. The tooltip interaction capture supplies the focused state evidence that is not present in the static source capture.

## Comparison History

- Pass 1: no actionable P0/P1/P2 difference was found, so no visual fix or recapture iteration was required.
- Post-review confirmation: the interaction fix changed target DOM order and tooltip reconciliation without intending a visual redesign. Fresh desktop/mobile captures from `820b15a` were compared again in the final composites; marker visibility, overlay layering, geometry, color, spacing, typography, and responsive containment remain visually unchanged, with no actionable P0/P1/P2 finding.

## Implementation Checklist

- No visual fixes required before structured whole-branch review.
- Preserve the source-derived geometry and current no-public-copy occupied-overlay treatment.
- Keep the browser cleanup timeout separate from assertion results until hosted CI confirms a clean browser command exit.

## Follow-up Polish

No P3 polish item is required for this map upgrade.

## Municipality Interaction Consistency QA — 2026-08-08

### Evidence

- Region-row source visual truth: `C:\Users\Mylaptop\AppData\Local\Temp\codex-clipboard-526ee6e4-02e6-4542-9167-5bc8cc8223b3.png` (working municipality hover state, 453 x 745 pixels).
- Region-row implementation: `C:\Users\Mylaptop\.codex\worktrees\00e2\Geodata.ge\.tmp\municipality-region-row-hover-final.png` (`/explorer/municipalities#lvl=region`, first region hovered, 1270 x 714 CSS viewport and pixels).
- Series source visual truth: `C:\Users\Mylaptop\.codex\worktrees\00e2\Geodata.ge\.tmp\expenditure-series-reference.png` (the existing expenditure explorer's selected-series treatment, 1270 x 714 CSS viewport and pixels).
- Series implementation: `C:\Users\Mylaptop\.codex\worktrees\00e2\Geodata.ge\.tmp\municipal-series-selected-final.png` (`/explorer/municipalities/27`, a newly selected series, 1270 x 714 CSS viewport and pixels).
- Density normalization: all browser captures are 1 CSS pixel to 1 image pixel. The user-provided municipality crop differs in frame size, so it was used only as the focused interaction-state reference; the two full-view series captures use the same viewport and density.

These images remain local, ignored QA evidence. The browser regression tests are the durable interaction contract.

### Findings

No actionable P0, P1, or P2 differences remain. The region row now uses the same pale `--tint` hover background as the working municipality row without activating municipality map geometry. Municipal and region detail explorers now use the same selected/hover tint and 100ms color transition as the expenditure explorer. Their pre-existing category-colored checkboxes remain intentional municipal-series semantics.

### Required Fidelity Surfaces

- Fonts and typography: unchanged; Georgian labels, mono amounts, weights, line heights, truncation, and hierarchy match the existing surfaces.
- Spacing and layout rhythm: unchanged; the fix adds no dimensions, borders, shadows, transforms, or reflow.
- Colors and visual tokens: both interactions resolve to `--tint` (`rgb(241, 234, 220)`), matching the working explorer. The transition duration resolves to `0.1s` and uses the existing color-only motion contract.
- Image quality and asset fidelity: no image, map, icon, or SVG asset changed.
- Copy and content: unchanged.
- Accessibility and interaction states: `aria-pressed` still tracks series selection; region hover remains visually responsive while the map retains zero active municipality targets. `prefers-reduced-motion` continues to be handled globally. In-app console inspection found no warnings or errors beyond React DevTools/HMR informational logs.

### Full-view Comparison Evidence

The expenditure reference and municipality implementation were compared together at the same 1270 x 714 viewport. Selected rows use the same paper/tint contrast and editorial rule hierarchy; no unintended layout, type, color, or content drift is visible.

### Focused-region Comparison Evidence

The user-provided working municipality-row hover and the rendered region-row hover were compared together. Although their crops differ, the relevant row state is readable in both and uses the same tint. Computed browser evidence separately confirmed `rgb(241, 234, 220)` and `0.1s` on the rendered region row and newly selected municipal series row.

### Comparison History

- Pass 1: the original implementation had two P2 consistency gaps: region rows had no hover tint/transition, and municipal explorer series rows had no hover/selected tint/transition.
- Fix: reused the existing `transition-colors duration-100 hover:bg-[var(--tint)]` and selected `bg-[var(--tint)]` treatment on the two affected row types.
- Pass 2: fresh in-app captures and computed-style checks found no remaining actionable P0/P1/P2 mismatch. Focused browser tests passed for both interaction states.

### Implementation Checklist

- Preserve region rows as inert toward municipality geometry while retaining row hover feedback.
- Preserve the shared 100ms color-only transition and selected tint on municipal and region detail series rows.
- Keep focused browser coverage for both states in the municipality suites.

### Follow-up Polish

No P3 refinement is required for this interaction-consistency fix.

## Entity Picker Affordance QA — 2026-08-08

- Source visual truth: `C:\Users\Mylaptop\AppData\Local\Temp\codex-clipboard-03312d30-57b1-41cb-bd9e-6fb95db7eee6.png`.
- Verified route: `/explorer/municipalities/06` in the in-app browser.
- Resting state: entity label is `--accent`, the underline is a 1px dashed accent rule at 60% opacity, and the muted `▾` caret is always visible.
- Hover state: focused Playwright coverage confirms the caret and underline strengthen to accent in 100ms with an unchanged trigger bounding box.
- Open state: `aria-expanded` changes from `false` to `true`, the caret changes to `▴`, and the existing picker opens without layout movement.
- Computed evidence: label `rgb(179, 64, 42)`, caret `rgb(201, 190, 169)`, transition `0.1s`, trigger box `152.475 x 42.2` CSS pixels.
- Fidelity review: typography, spacing, chart layout, picker contents, and accessibility behavior remain unchanged. No actionable P0/P1/P2 difference remains from the requested preview treatment.

## Region Label and Picker Hover QA — 2026-08-08

- Source references: `C:\Users\Mylaptop\AppData\Local\Temp\codex-clipboard-982178dc-4025-44be-84ec-cff9b7e812dd.png` and `C:\Users\Mylaptop\AppData\Local\Temp\codex-clipboard-81cd0171-01b3-482b-bc64-6513fd2fc8c4.png`.
- Implementation capture: `C:\Users\Mylaptop\.codex\worktrees\00e2\Geodata.ge\.tmp\region-picker-hover-final.png`, rendered from `/explorer/municipalities/region/adjara` in the in-app browser.
- Heading: the clickable region trigger is now the canonical `აჭარა`, producing the compact `როგორ იხარჯება აჭარა` headline while retaining the established terracotta trigger, caret, and dashed underline.
- Region row hover: text and the existing 2px left rule resolve to `rgb(179, 64, 42)` over `0.1s`; the grouped tint remains `rgb(241, 234, 220)`.
- Municipality row hover: background resolves to `rgb(241, 234, 220)`, text and left rule to `rgb(179, 64, 42)`, and transition to `0.1s`.
- Layout stability: the region row remained `418 x 35` CSS pixels and the municipality row remained `418 x 34.3` CSS pixels before and after hover.
- Comparison: the two supplied crops and the full implementation capture were inspected together. The excessive region phrase is removed, the picker hierarchy and values are unchanged, and the new hover state supplies the requested visible reaction without movement or added clutter.
- Result: no actionable P0/P1/P2 visual mismatch remains.

final result: passed

## Shared Public Header QA — 2026-08-12

In-app-browser comparison at an explicit 1640×900 desktop viewport, using the same 1640×98 crop as the supplied landing-header screenshot:

- Landing header geometry: x=194.8, y=30, width=1240, height=43.6.
- Methodology header geometry: x=194.8, y=30, width=1240, height=43.6.
- Reference, methodology, and landing share the serif GeoData mark, centered navigation, right-aligned coverage label, baseline, ink rule, and typography anatomy.
- Methodology has zero active links and correctly omits the accent underline; landing retains the active `მთავარი` underline.
- The supplied screenshot has wider outer margins than the current landing shell, so the product-correct criterion is exact methodology alignment with the current landing header while retaining the screenshot anatomy.
- No P0, P1, or P2 differences found.

final result: passed

## Fiscal.ge Homepage Redesign QA — 2026-08-23

### Source and implementation evidence

- Approved source: `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\design-shotgun\homepage-below-hero-2026-08-23\variant-j.html`.
- Source viewport captures: `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\source-desktop.png`, `source-390.png`, and `source-320.png`.
- Final production implementation captures: `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\implementation-production-desktop.png`, `implementation-production-390.png`, and `implementation-production-320.png`.
- Viewports were 1366×768, 390×844, and 320×844 CSS pixels. Every viewport capture has the same pixel dimensions as its CSS viewport, so source and implementation are normalized at 1 CSS pixel to 1 image pixel with no scaling.
- Full-page source/implementation sizes were 1366×2763 / 1366×2505, 390×2966 / 390×3689, and 320×2992 / 320×3902 pixels. Full-page composites are top-aligned at the same viewport width and density with a 16px paper-colored gutter; neither side is rescaled.

### Full-view comparison evidence

- `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\comparison-final-desktop-full.png`
- `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\comparison-final-390-full.png`
- `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\comparison-final-320-full.png`
- First-viewport comparisons are `comparison-final-desktop-viewport.png`, `comparison-final-390-viewport.png`, and `comparison-final-320-viewport.png` in the same directory.

The full-page evidence covers the entire fixed order: header, preserved living-relief hero, one-row country figures, annual masthead, expenditure, revenue, municipalities, the single methodology ledger, and the retained production footer. The implementation is taller on narrow screens because the real footer retains its complete navigation, source, update, contact, and licence content; Variant J has only a two-item prototype footer. This is an approved product-content difference, not a layout defect.

### Focused-region evidence

- `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\comparison-final-desktop-data.png`
- `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\comparison-final-390-data.png`
- `C:\Users\Mylaptop\.codex\worktrees\b9c1\Geodata.ge\apps\web\test-results\homepage-redesign-qa\comparison-final-320-data.png`

These anchor-aligned captures compare the annual masthead, section 01 copy, double-rule total, latest-year/status block, and four-row semantic table at all three widths. They make the responsive index → copy → data order, table fit, amount formatting, and rule hierarchy readable without relying on the resized full-page composites.

### Findings

No actionable P0, P1, or P2 mismatch remains within Task 2's approved homepage-composition boundary.

- Typography: the implementation preserves the serif display hierarchy, Georgian sans overlines/body, mono years and table values, balanced H1/H2 wrapping, and readable 320px table scale. No Georgian text clips or collides.
- Spacing and rhythm: desktop reads index → copy → data; 390px and 320px stack in DOM order. All three ledgers repeat the same spacing, total rules, and table rhythm. The methodology section follows the same numbered structure and the footer begins only after it.
- Tokens and colors: paper, ink, body/muted/faint tiers, hairlines, and terracotta links/indexes use the canonical production tokens. There are no cards, shadows, post-hero graphics, or new decorative effects.
- Asset fidelity: the source's schematic dotted terrain is intentionally not copied. The approved production living-relief WebGL hero is preserved with its real Georgia geometry, elevation, city marker, accessible figure label, and fallback contract; no raster or placeholder asset was introduced.
- Copy and data: hero, country figures, ordered H2s, links, methodology steps, totals, years, basis labels, top-four rows, and shares match the approved contract. Static prototype amounts were not copied; production uses served facts and the existing amount/share formatters.
- Responsive containment: automated and browser-computed checks found `scrollWidth === clientWidth` at 1366, 390, and 320 pixels. The country figures stay in one row, units wrap at 320px, and every table remains within its parent without horizontal scrolling.
- Accessibility: one H1, section-associated H2s, semantic tables with row/column headers and dataset/year labels, assistive-only full mobile captions, decorative indexes hidden from assistive technology, and keyboard-visible direct links were confirmed. Color is not required to understand amount, share, year, or status.
- The shared header still displays `ექსპლორერი` in this Task 2 capture while Variant J displays `მონაცემები`. The approved implementation plan assigns that copy-only shared-header change to Task 3, so it was not pulled into this task's bounded file set or classified as a Task 2 fidelity defect.

### Console and interaction checks

Fresh checks against the production build at each viewport found no console warnings, console errors, or uncaught page errors. The hero CTA reached `#data` with the annual region in view. Two Tab presses from that anchor placed a visible keyboard focus on the revenue dataset link; Enter reached `/explorer/revenue`, where the explorer shell rendered. The focused Playwright file separately passed all four cases covering metadata/copy, canvas-or-fallback, real destinations, ordered sections, obsolete-surface removal, 390px/320px geometry, methodology discovery, and screenshot capture.

### Comparison history

- Pass 1 used the required focused-browser captures from the development server. The page composition and containment were correct, but the development-only Next `N` badge obscured section 01 in the implementation evidence. This was recorded as a P2 evidence defect, not a production UI defect.
- Fix: built the optimized static application, served it with `next start`, and recaptured every viewport, full page, and focused annual state from the production server.
- Pass 2: the badge is absent, no content is obscured, and repeated inspection of typography, rhythm, tokens, asset fidelity, copy, tables, footer, responsive containment, focus, links, and console state found no remaining actionable P0/P1/P2 mismatch within Task 2.

final result: passed
