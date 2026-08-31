# Fiscal.ge Remaining PageSpeed Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Reduce Fiscal.ge first-load LCP, blocking time, and homepage CPU cost while excluding Microsoft Clarity and preserving the approved living-relief homepage visual.

**Architecture:** Keep the static Next.js App Router pages and the existing client-only Three.js hero. Apply independent, measurable improvements to the hero bundle/runtime, the route-local hero font CSS, and Google Analytics loading. Treat any change to map detail, frame rate, animation timing, or first-paint composition as an explicit approval checkpoint because those are part of the approved homepage design.

**Tech Stack:** Next.js 16.2.11, React 19.2.8, strict TypeScript, Tailwind v4, Three.js, Vitest, Playwright, Lighthouse/PageSpeed Insights, Vercel static deployment.

**Spec:** `DESIGN.md` sections 14 and 19; the accepted constraints in `docs/superpowers/plans/2026-08-28-pagespeed-fixes.md`; the current PageSpeed findings supplied with this task.

## Global Constraints

- Microsoft Clarity is explicitly out of scope. Do not edit its code, loading behavior, cache behavior, or vendor configuration, and do not include its 25 KiB / 1-day-cache row in acceptance criteria.
- Preserve `DESIGN.md` v4.1, the warm editorial palette, Georgian copy, section order, data presentation, routes, metadata, downloads, and source links.
- Preserve the living-relief map's geometry, camera composition, city behavior, reduced-motion still frame, accessible description, and WebGL fallback.
- Do not reduce map detail, lower the target frame rate, change animation timing, replace the visible map with a static asset, or delay the map's first visible appearance without a separate user approval checkpoint.
- Keep self-hosted fonts and `font-display: swap`. Do not remove required Georgian glyph coverage or repeat the previously rejected blanket font-preload removal experiment.
- Do not make all CSS asynchronous. Remove or consolidate only a proven unnecessary stylesheet request; retain CSS needed for first paint.
- Do not change fiscal facts, data pipelines, database behavior, identifiers, SEO contracts, analytics purpose, or browser support policy without the specific task's evidence and approval.
- Do not add production dependencies. Use existing Next.js, Three.js, Playwright, and Vitest patterns and available local tooling.
- Run Windows commands from `apps/web` with `npm.cmd`.
- Do not publish from this plan. If publishing is separately authorized, use the repository's `codex/*` branch, CI, PR, merge, deployment, synchronization, cleanup, and live-verification workflow.

## Current Evidence and Priorities

| Finding | Current evidence | Planned treatment |
|---|---|---|
| Homepage Three.js bundle/runtime | `2b-…js` is 145.6 KiB transferred; it contains `WebGLRenderer`; the report attributes 39,282 ms of total CPU to it and 37,355 ms to `Other` work | Highest priority: tree-shake the import and move only proven invariant work out of the frame loop; visual-fidelity changes require approval |
| Render-blocking CSS | `3f-…css` is only 1.2 KiB but costs about 570 ms; `3j1-…css` is 13.4 KiB; combined estimated savings are 510 ms | Remove the unnecessary route-local stylesheet request if generated output and typography remain equivalent; do not inline all CSS |
| Google Analytics | `gtag.js` is 163.1 KiB and contributes 194 ms CPU; the app injects it with `afterInteractive` | Move only Google Analytics to `lazyOnload` or an equivalent post-load idle boundary; leave Clarity unchanged |
| Fonts | The root layout declares Noto Sans, Noto Serif, and Geist Mono; the landing page separately loads a 110 KiB Eurostile TTF | Consolidate the tiny hero-font CSS request and test a licensed WOFF2 conversion; retain necessary root fonts and `swap` |
| Legacy JavaScript | `1tlen…js` contains a 13.7 KiB old-browser polyfill estimate | Low priority and conditional on a browser-support decision; do not spend the main performance budget here |
| Cache lifetime | Current first-party `/_next/static` CSS/JS responses use `public, max-age=31536000, immutable`; the reported 1-day row is Clarity | No first-party cache configuration change |

The current `next/dynamic` loader already splits the Three.js hero into a post-hydration chunk. That is useful bundle splitting, but it is not an idle boundary; the component still loads because it is mounted in the above-the-fold landing page. The existing loader must not be reimplemented as if it were absent.

The work is split into independent workstreams so each can be accepted or rejected without hiding its effect inside a large mixed change.

## Inline progress (2026-08-31)

- Task 1 baseline: completed locally. The production build succeeded, the intended build was served on port 3110, and the landing browser baseline passed. The full multi-route/three-cold-navigation measurement set remains a final verification item.
- Task 2: rejected after advanced re-review. Public named imports produced identical output; direct `three/src/*` imports reduced the hero chunk from 571,640 to 565,139 raw bytes but made essentially no compressed-transfer difference and added an internal-module maintenance boundary. The namespace import is retained, with no scene geometry, timing, or runtime settings changed.
- Task 2 runtime follow-up: also rejected two exact-visual micro-optimizations under identical five-run, 5-second, 4×-CPU browser profiles. The stable baseline medians were 1,275.6 ms mobile and 1,264.1 ms desktop JavaScript time at about 60 fps. Precomputed typed-array constants increased JavaScript time by 15% mobile and 18% desktop. Skipping outside-country writes after their final entry frame increased mobile JavaScript by 6.8% and total task time by 15.8%; desktop JavaScript improved only 4.5% while total task time still rose 4.3%. Both candidates were fully removed. This exhausts the bounded arithmetic/import options without changing scene scheduling or fidelity.
- Task 3: accepted. The route-local hero-font stylesheet request was consolidated into global CSS; the generated homepage now has one stylesheet instead of two, and the hero font/layout checks passed. WOFF2 conversion was not used because an approved converter and font redistribution terms were not confirmed.
- Task 4: accepted. Only Google Analytics moved to `lazyOnload`; Microsoft Clarity remains unchanged. Runtime analytics checks passed, including one post-load request assertion and no duplicate request.
- Verification harness: corrected four existing Playwright files so `PLAYWRIGHT_BASE_URL` actually controls every navigation. This prevents a stale server on port 3100 from being mistaken for the intended production artifact.
- Task 7 local verification: complete for lint, TypeScript, 852 unit tests, data validation, the 95-route production build, and all 241 browser tests against the same port-3110 artifact. Production PageSpeed/Lighthouse comparisons remain post-deployment evidence and are not claimed locally.
- Tasks 5–6: intentionally paused. The hero runtime remains the dominant potential cost; no visual-fidelity, scheduling, or browser-support change has been authorized.

---

### Task 1: Establish a comparable baseline and isolate the remaining costs

**Files:**

- Inspect: `apps/web/components/landing/hero-relief-lazy.tsx`
- Inspect: `apps/web/components/landing/hero-relief.tsx`
- Inspect: `apps/web/components/landing/landing-page.tsx`
- Inspect: `apps/web/app/layout.tsx`
- Inspect: `apps/web/components/site/site-analytics.tsx`
- Inspect: `apps/web/app/globals.css`
- Inspect: `apps/web/tests/browser/landing.spec.ts`
- Inspect: `apps/web/playwright.config.ts`
- Inspect: `CLAUDE.md`
- Test output: an external evidence directory under `C:/Users/Mylaptop/.codex/visualizations/2026/08/31/`

**Produces:** A reproducible before-measurement set for the same production build, with Clarity recorded as excluded rather than changed.

- [ ] Check the current Git checkout, branch or detached state, commit, worktree changes, dependency state, and Node version before running commands that write build output. Preserve all existing user-owned changes.
- [ ] Build the current production artifact from `apps/web` without changing application source:

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
npm.cmd run build
```

- [ ] Serve that exact build on an unused local port and confirm the response belongs to this build before browser testing. Do not reuse or stop another task's server.
- [ ] Capture at least three independent cold navigations for `/` at mobile and desktop settings, using the same browser version, viewport, CPU/network profile, and cache policy for every comparison. Record LCP element, LCP, FCP, TBT, total CPU, script evaluation, JS transfer, CSS transfer, font arrival, and visible hero readiness.
- [ ] Capture the same measurements for `/explorer`, `/explorer/expenditure`, `/explorer/revenue`, `/explorer/municipalities`, `/explorer/analysis`, `/methodology`, and `/about` because the root layout, fonts, and analytics are shared.
- [ ] Confirm from source and generated output that `2b-…js` contains Three.js, `3f-…css` contains only the route-local hero font rule, and `1tlen…js` contains the flagged compatibility block. Record generated filenames instead of hardcoding current production hashes.
- [ ] Keep Microsoft Clarity present and unchanged in this baseline. Mark its network, CPU, and cache rows as excluded from the fix score; do not block it in the acceptance run.
- [ ] Save the exact commit, build identifier, browser conditions, viewport, cache state, and raw measurements outside application source.

**Gate:** Continue only after the largest CPU cost is still attributable to the hero bundle/runtime and the two CSS requests are still present under the same build. If attribution changes, update the affected task before editing code.

---

### Task 2: Reduce the Three.js bundle without changing the map

**Files:**

- Modify: `apps/web/components/landing/hero-relief.tsx:3` and the corresponding `THREE.*` references
- Test: `apps/web/tests/browser/landing.spec.ts`
- Inspect: `apps/web/components/landing/hero-relief-lazy.tsx`

**Interfaces:**

- Consumes: the existing `HeroRelief` export and `HeroReliefLazy` dynamic import.
- Produces: the same `HeroRelief` component, same DOM fallback, same canvas scene, same pointer behavior, and a smaller or more tree-shakable hero chunk.

- [ ] Run the existing landing browser suite and the production build before editing this task.
- [ ] Replace the namespace import with only the classes used by this file:

```ts
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineLoop,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Material } from "three";
```

- [ ] Replace only the listed `THREE.*` references with the imported names. Do not alter constructor options, shader strings, geometry coordinates, camera values, or animation constants.
- [ ] Build the production artifact and locate the generated hero chunk by searching generated chunks for `WebGLRenderer`. Compare its compressed transfer size and unused-code estimate with Task 1 under identical conditions.
- [ ] Keep the import change only if the hero chunk becomes smaller or the unused-code estimate decreases and all visual/runtime checks remain unchanged. If generated output is identical, revert the import-only candidate.
- [ ] If Task 1 identifies repeated invariant calculations in `updater` as a hot path, precompute only values that do not depend on time, camera, pointer position, or active ripples. The first permitted candidates are `y / 640` depth, static dot coordinates already stored in `F.px`/`F.py`, and static color terms proven identical by a before/after numeric comparison.
- [ ] Add a focused regression only for an accepted runtime change. It must assert canvas visibility, the no-WebGL fallback, no runtime console errors, the reserved statistics position at the four existing responsive widths, and the `prefers-reduced-motion` still scene.
- [ ] Run the focused landing tests, then the full browser suite. Record the same three cold performance navigations as Task 1.
- [ ] Commit this task separately only if its measured improvement survives the gate:

```powershell
git add apps/web/components/landing/hero-relief.tsx apps/web/tests/browser/landing.spec.ts
git commit -m "perf: reduce landing hero bundle cost"
```

**Gate:** No map geometry, city behavior, animation timing, frame-rate target, or first-paint composition may change. If safe bundle/runtime work does not materially improve CPU or transfer, stop this task and document the remaining cost instead of reducing fidelity.

---

### Task 3: Remove the unnecessary route-local hero-font stylesheet request

**Files:**

- Modify: `apps/web/components/landing/landing-page.tsx:1-19,78`
- Modify: `apps/web/app/globals.css:20-22` and a new narrowly scoped hero-font rule
- Test: `apps/web/tests/browser/landing.spec.ts`
- Inspect: generated `3f-…css` and `3j1-…css` output

**Interfaces:**

- Consumes: the existing `heroDisplay` family, weight 600, `font-display: swap`, fallback chain, and landing H1.
- Produces: a `.hero-display` class in the global stylesheet with the same metrics and appearance, without a separate route CSS chunk containing only the font declaration.

- [ ] Run the landing visual/layout tests before editing. Capture the H1 bounding box and country-statistics top position after `document.fonts.ready` at 390×844, 768×900, 1100×900, and 1440×900.
- [ ] Move the current generated declaration into `globals.css` using the exact current fallback metrics:

```css
@font-face {
  font-family: "heroDisplay";
  src: url("../assets/fonts/EurostileGEOMt-Demi.ttf") format("truetype");
  font-display: swap;
  font-weight: 600;
  font-style: normal;
}

@font-face {
  font-family: "heroDisplay Fallback";
  src: local(Arial);
  ascent-override: 54.1%;
  descent-override: 18.03%;
  line-gap-override: 14.43%;
  size-adjust: 138.64%;
}

.hero-display {
  font-family: heroDisplay, "heroDisplay Fallback", "Noto Serif Georgian", serif;
  font-style: normal;
  font-weight: 600;
}
```

- [ ] Remove only the `next/font/local` declaration and `heroDisplay.className` after the global rule is in place. Keep H1 text, spacing, size, weight, fallback order, and responsive classes unchanged; add only `hero-display`.
- [ ] Build and confirm that the route-local `3f-…css` chunk is gone or no longer contains a separate hero-font declaration. Confirm the global CSS still contains the font rule and the browser requests the font only on the landing route where the class is used.
- [ ] Compare font-settled H1 geometry, statistics position, screenshot appearance, font arrival, and LCP against Task 1. Reject the candidate if the H1 changes visibly, the settled statistics position moves by more than 1 CSS pixel, or LCP worsens.
- [ ] If an approved font-conversion tool is already available and the font's modification/redistribution terms are confirmed, create a WOFF2 copy from the same source, update only the `src` format, and compare actual transfer size. If either condition is false, retain the TTF and finish CSS-request consolidation without adding a dependency.
- [ ] Run the landing suite, visual/font checks, and full browser suite. Commit only the accepted candidate:

```powershell
git add apps/web/app/globals.css apps/web/components/landing/landing-page.tsx apps/web/tests/browser/landing.spec.ts
git commit -m "perf: consolidate landing hero font styles"
```

**Gate:** The small `3f-…css` request must be removed or its render-blocking effect materially reduced without typography, layout, font-coverage, or LCP regression. Do not inline the entire global stylesheet.

---

### Task 4: Defer Google Analytics without touching Clarity

**Files:**

- Modify: `apps/web/components/site/site-analytics.tsx:6-21` only
- Test: production browser network trace and existing browser runtime checks
- Do not modify: `apps/web/components/site/site-analytics.tsx:23-36`, the Microsoft Clarity block

**Interfaces:**

- Consumes: the existing hostname guard, `dataLayer`, `gtag` queue, measurement ID `G-RRS446MKJW`, and manually injected `gtag.js` URL.
- Produces: the same Google Analytics bootstrap and measurement ID, created during browser idle time after page resources have loaded.

- [ ] Record current Google Analytics request timing and verify the existing queue is created only on `fiscal.ge`; local/test hosts must remain analytics-free.
- [ ] Change only the Google Analytics `Script` strategy:

```tsx
<Script id="google-analytics" strategy="lazyOnload">
```

Keep the inline queue setup, `gtag("js", new Date())`, `gtag("config", "G-RRS446MKJW")`, hostname guard, and external URL unchanged. Do not create a second analytics loader.
- [ ] Run a production-like browser capture against the real hostname and confirm the initial document, CSS, fonts, hero chunk, and LCP no longer compete with the Google request. Confirm the request still occurs after page load/idle and the `dataLayer` receives the configuration call.
- [ ] Run the local browser runtime suite and verify no new console errors or duplicate Google requests. Do not use the Clarity request as a pass/fail signal.
- [ ] Compare three cold mobile and desktop navigations. Keep the change only if it reduces early network/CPU contention without breaking the queue or introducing a duplicate request.
- [ ] Commit separately:

```powershell
git add apps/web/components/site/site-analytics.tsx
git commit -m "perf: defer Google Analytics until idle"
```

**Gate:** Google Analytics may start later, but it must remain functional. Microsoft Clarity code and behavior must be unchanged.

---

### Task 5: Decide whether an approval-gated hero scheduling change is necessary

**Files to inspect:**

- `apps/web/components/landing/hero-relief-lazy.tsx`
- `apps/web/components/landing/hero-relief.tsx`
- `apps/web/components/landing/landing-page.tsx`
- `DESIGN.md:680-691,771-777`
- Task 1–4 performance evidence

**Produces:** A written decision, backed by measurements, about whether safe code/bundle changes are sufficient or the visual contract must change.

- [ ] Compare the accepted Task 2–4 result against the baseline using the same build conditions. Separate improvements to LCP/TBT from improvements that only move work outside Lighthouse's observation window.
- [ ] If the report still attributes dominant CPU cost to continuous WebGL work, document the remaining cost and present these bounded choices before editing the hero:
  - **Exact-scene scheduling:** keep identical scene detail, frame-rate behavior, and animation timing, but mount the dynamic scene only after the initial page load/idle boundary. Accept only if the map remains visible promptly and the approved primary-visual composition is not materially delayed.
  - **Reduced-cost mobile scene:** keep desktop behavior unchanged but lower mobile dot density/pixel ratio or render a same-composition first frame. This requires explicit approval because it changes mobile fidelity or timing.
- [ ] Do not implement either choice until the user approves the specific visual tradeoff. If no approval is given, retain safe Task 2–4 changes and record the Three.js runtime as the remaining limitation.
- [ ] If exact-scene scheduling is approved, add a browser regression that measures map visibility/readiness and settled statistics position separately from LCP; a faster audit with a late or missing map is not accepted.

**Gate:** This task is an approval checkpoint, not permission to remove, simplify, or hide the homepage's primary visual.

---

### Task 6: Handle the legacy-JavaScript warning only if it is independently worth changing

**Files:**

- Inspect: `apps/web/package.json`
- Inspect: generated `1tlen…js`
- Potentially modify only after browser-support approval: `apps/web/package.json`
- Test: production build and generated-chunk comparison

**Interfaces:**

- Consumes: the product's supported-browser policy and Next.js 16's current browser-target behavior.
- Produces: either a smaller compatibility chunk with the same supported-browser contract or a documented decision to retain the 13.7 KiB warning.

- [ ] Confirm whether the current build uses Next.js's modern default browser target or an explicit Browserslist configuration. Record the actual compatibility module and features it polyfills.
- [ ] Do not replace `.at`, `.flatMap`, `Object.fromEntries`, or related application code merely to silence the audit; first prove that those source changes remove the generated compatibility payload.
- [ ] If the product explicitly accepts the current Next.js 16 minimum browser set, test this isolated configuration:

```json
{
  "browserslist": {
    "production": [
      "chrome 111",
      "edge 111",
      "firefox 111",
      "safari 16.4"
    ]
  }
}
```

Do not add it if older browsers must be supported, and do not retain it if the generated compatibility chunk does not shrink.
- [ ] Run the production build and compare the compatibility chunk, first-party transfer, and existing browser tests. Treat a 13.7 KiB saving as lower priority than any supported-browser regression.
- [ ] If output does not improve, leave `package.json` unchanged and record the warning as a known low-impact Next.js/runtime cost.

**Gate:** No browser-support reduction is accepted without explicit product approval and a generated-output improvement.

---

### Task 7: Verify the accepted fixes as one production artifact

**Files:**

- Inspect all files changed by Tasks 2–4 and any explicitly approved Task 5 change
- Test: `apps/web/tests/browser/landing.spec.ts`
- Test: full `npm.cmd run check`
- Test: production `npm.cmd run build`
- Evidence: external before/after performance directory

- [ ] Run the required local gates from `apps/web` with the production site URL set:

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
npm.cmd run check
npm.cmd run build
```

- [ ] Serve the successful production build and run the full browser suite against it. Confirm the test runner used the intended production server and did not silently reuse another server.
- [ ] Verify the homepage at 320px, 390px, 767px, 768px, 1099px, 1100px, and 1440px widths. Check the living-relief canvas, fallback, reduced motion, H1 font settling, country figures, CTA, keyboard focus, document overflow, and console/runtime errors.
- [ ] Verify shared root-font and analytics behavior on `/explorer`, `/explorer/expenditure`, `/explorer/revenue`, `/explorer/municipalities`, `/explorer/analysis`, `/methodology`, and `/about`. Confirm data values, headings, canonical URLs, source links, and downloads are unchanged.
- [ ] Run at least three independent PageSpeed/Lighthouse measurements per affected device profile on the same final deployment/build. Record exact LCP, FCP, TBT, CPU, JS/CSS transfer, request timing, and score ranges. Keep Clarity rows visible only as excluded context; do not claim its warning was fixed.
- [ ] Require all of the following before declaring implementation successful:
  - `2b-…js` or its replacement has a measured transfer/CPU improvement, or the safe candidate is reverted and the remaining cause is documented.
  - The unnecessary `3f-…css` request is removed or its render-blocking effect is materially reduced without typography/layout regression.
  - Google Analytics loads after initial page resources and remains functional; Clarity is unchanged.
  - The 13.7 KiB legacy-JavaScript warning is either reduced without browser regression or explicitly retained as low priority.
  - Existing UI, data, accessibility, SEO, responsive, reduced-motion, and WebGL fallback checks remain green.
- [ ] Produce a before/after table with exact commit/build, test conditions, metrics, score ranges, changed request tree, and remaining warnings. Do not promise a literal 10× PageSpeed score increase; report actual improvement by metric.
- [ ] Stop at verified local/preview work unless publishing is separately authorized. If publishing is authorized, read `docs/deployment.md`, follow the repository delivery sequence, verify the deployed commit and Vercel `READY` state, then repeat live URL and performance checks.

---

## Plan Self-Review

- The scope excludes Microsoft Clarity explicitly and leaves its source block untouched.
- The largest measured cost, the Three.js hero, is separated from CSS/font and analytics work so each result can be measured and rolled back independently.
- The plan does not silently approve reduced map fidelity, changed animation cadence, a static replacement, or a late first visual; those choices have an explicit approval gate.
- First-party static cache configuration is not changed because current production responses already use a one-year immutable policy.
- The legacy-JavaScript item is conditional because its estimated saving is much smaller than the hero cost and may be controlled by Next.js runtime behavior.
- No code, tests, data, configuration, dependencies, Git state, deployment, or production changes are made by preparing this plan.
