# Fiscal.ge PageSpeed Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan after the user approves it. Work through the checkboxes sequentially. This document does not authorize implementation, publishing, or deployment by itself.

**Status:** The retained fixes were accepted for release on 29 August 2026 after local verification and user preview. Consistent 90+ mobile performance remains unresolved. The measurements below record the pre-release checkpoint; current delivery status is verified through GitHub and Vercel.

**Goal:** Make the main pages load more consistently, remove the identified readability failures, and preserve the approved design, animated map, and data behavior.

**Architecture:** Keep the existing static Next.js pages, shared editorial components, and separate client loader for the Three.js hero. Fix the specific foreground/background combinations directly. Treat hero sizing, scene processing, and font loading as separate experiments, retaining only improvements supported by measurements and visual checks.

**Tech stack:** Next.js 16.2.11, React 19.2.8, TypeScript, Tailwind v4, Three.js, Vitest, existing Playwright tests, PageSpeed Insights/Lighthouse. No new production dependencies or framework upgrade.

**Spec and evidence:** [DESIGN.md v4.1](C:/Users/Mylaptop/.codex/worktrees/e618/Geodata.ge/DESIGN.md), especially sections 4.1, 5, 19, and 21; [Project_Definition.md section 2](C:/Users/Mylaptop/.codex/worktrees/e618/Geodata.ge/Project_Definition.md); [28 August PageSpeed baseline](C:/Users/Mylaptop/.codex/visualizations/2026/08/28/01a04957-85ab-7413-b01b-05c684939266/pagespeed-audit/report.md). The audit establishes symptoms; it is not proof of every proposed cause.

**Working location:** `C:\Users\Mylaptop\.codex\worktrees\e618\Geodata.ge`. File paths below are relative to this repository unless a full path is supplied. Application commands run in `apps/web` using `npm.cmd` on Windows.

## Latest local checkpoint — 29 August 2026

Retained build: `ry-twu9IE18Ieljt7ac79`, from the existing detached worktree at `b9704ff0520cf5d231585da9eb294540c9a2bd7f`. No commits or publishing were performed.

| Work | Outcome |
|---|---|
| Homepage frame | Compact CSS minimum, intrinsic copy-height floor, and outer-frame resize observation implemented. Twelve standard sizes and enlarged-text/resize/restoration cases pass; geometry and animation are unchanged. |
| Contrast | Both scoped corrections retained; paper and dark-sidebar cases pass. |
| Municipality payload | Exact paths moved to a content-hashed SVG; no path data in client props. Geometry parity, Chromium/Firefox/WebKit rendering, keyboard behavior and no-JavaScript loading pass. |
| Number formatting | Immutable format rules reused. Output and real-budget invariants pass. |
| Font and view-loading experiments | Both font-preload trials and the chart-view split were rejected. Root font configuration and chart imports match HEAD. |
| Verification | Production build: 95 static pages. Full check: 850 tests in 101 files plus all data gates. Full browser suite: 236 tests passed on this retained build. Independent review and follow-ups are closed. |
| Performance target | Final mobile medians: Home 85, hub 90, Expenditure 87, Revenue 87, Municipalities 85, Analysis 86, Methodology 92, About 93. Desktop: 99–100. All 32 runs score 100 for Accessibility, Best Practices and SEO. 90+ on every mobile page remains unmet; Task 3 has no accepted scene-processing optimization. |

The [latest report](C:/Users/Mylaptop/.codex/visualizations/2026/08/28/01a04957-85ab-7413-b01b-05c684939266/pagespeed-fixes/round2/report.md) contains complete measurements and caveats. Use the final recorded LCP identities for further work: the homepage now measures its first data-section heading, while explorer pages measure their main titles. The task-owned server was stopped after verification. The earlier checkpoint and original task proposals below are historical evidence, not current status.

## Historical execution checkpoint — 28 August 2026

- The unchanged production build and `npm.cmd run check` passed: 101 test files, 848 unit tests, and all data validations.
- Ten new browser regressions reproduced the original defects against this worktree's server. Six contrast regressions then passed after the scoped fixes. The four homepage regressions still describe unfinished work; the overall browser suite is not being claimed green.
- Another task serves `localhost:3100` over IPv6. This task uses `127.0.0.1:3100` and an ignored, task-local Playwright configuration in `.tmp/pagespeed/playwright.config.ts` to map browser requests to IPv4. Playwright's separate HTTP client explicitly tries IPv6 first, so `--dns-result-order=ipv4first` does not fix its requests. The SEO suite was rerun with `SEO_BASE_URL=http://127.0.0.1:3100`; the remaining hardcoded archive/logo HTTP checks were independently verified against that explicit address. The repository's Playwright configuration and the other task's server are unchanged.
- The full browser run reported 208 passes and 14 failures. Nine failures were a missing `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` in the test process, one sitemap request hit the other server, and four were the known homepage movement checks. Rerunning the 14 with the correct origin and explicit SEO address cleared all ten setup failures; only the four homepage checks remain. The complete 33-test SEO suite then passed against IPv4. This is not a claim that the complete browser suite is green in a single run.
- A separate read-only review found no actionable issues in the contrast changes or their six regressions. The shared municipal selector and both dark-shell badge callers were included.
- Six final Lighthouse checks (Expenditure, Revenue, and Methodology on mobile/desktop) scored 100 for accessibility and passed the color-contrast audit. An existing unscored sidebar-logo accessible-name warning is recorded separately. These are local automated results, not new production scores or a complete accessibility certification.
- The final mobile Lighthouse runs flagged a slow local CPU; their performance values are inconclusive without a paired baseline under the same conditions. Browser viewport screenshots confirmed the retained contrast changes, including Tbilisi's shared selector. The final production build is `natkpN5xvm5m8u4I8yUZY`.
- The documented tall frame eliminated the initialization jump but introduced a large empty band below the existing map. That experiment was rejected and reverted. Approval was requested to reserve the compact map's natural space from the first paint instead. Neither the map implementation nor its canonical sizing contract has been changed yet.
- Eighteen independent Lighthouse baseline reports were collected for the homepage, Municipalities, and Analysis. A nine-report trial removing the Sans Latin preload left all 17 font binaries byte-identical, but delayed first paint by about 300 ms on the homepage and Municipalities without a consistent score gain. The preload change was reverted.
- Lighthouse reports completed, but Chrome's Windows temporary-profile cleanup returned `EPERM`. The local measurement script records that cleanup warning separately and rejects missing, incomplete, or runtime-error reports. It does not describe the cleanup command as successful.
- Evidence is saved in `C:\Users\Mylaptop\.codex\visualizations\2026\08\28\01a04957-85ab-7413-b01b-05c684939266\pagespeed-fixes`. No implementation commit, PR, merge, or deployment has been made.

The [local checkpoint report](C:/Users/Mylaptop/.codex/visualizations/2026/08/28/01a04957-85ab-7413-b01b-05c684939266/pagespeed-fixes/report.md) records the measurements, rejected experiments, visual evidence, verification limits, and pending approval.

### Performance priority clarification

The user asked why performance has not reached 90+. No performance ceiling has been established, and the performance work is unfinished. The reported accessibility scores are a separate category.

Re-reading the saved mobile baseline reports shows that the largest-content metric (LCP) accounts for most lost score points: 13.0 of 16.6 points on the first homepage run, 16.75 of 20.55 on Municipalities, and 13.25 of 13.55 on Analysis. Each report identifies the main heading as the LCP element. The simulated LCP values in those runs were 4.07s, 4.67s, and 4.08s respectively. These are recorded local lab measurements, not a new production test.

Prioritize tracing the heading's critical loading path (the resources and processing it must wait for) under Task 5. Keep font/style and startup-processing experiments measured and independent from the pending frame decision; approval for the frame contract is not a prerequisite for investigating or testing changes that preserve the existing appearance. The rejected Sans preload trial does not exhaust the available performance work. Fixing only the homepage's layout-movement metric could add at most 1.5 points to that first mobile baseline if all other metrics stayed unchanged, so it cannot by itself establish 90+.

### Second experiment round

- The user approved proceeding with the proposed performance work, including matching reserved homepage space to the existing compact map while keeping its appearance and animation.
- Fresh baseline reports are in `pagespeed-fixes/round2-baseline`. The laptop was on battery and Lighthouse's CPU benchmark index was about 760–800, versus about 4,100–4,300 in the earlier baseline. These sets are not directly comparable. The user was asked to plug in if possible; no power settings or unrelated processes were changed.
- Diagnostic-only Analysis runs with font requests blocked and script requests blocked were used to separate causes. They are not finished-site scores. Blocking scripts reduced simulated LCP from roughly 4.3–4.7s in the fresh baseline to 3.0s; blocking fonts alone did not remove the delay. The first retained-code candidate will therefore separate the mutually exclusive Explorer and Analysis view bundles, preserving server rendering, before repeating measurements.

## The plan in plain language

1. Establish a comparable before/after test, because the homepage's results vary substantially.
2. Stop the homepage content moving when the map initializes, then reduce expensive map work only where a recording proves it is necessary.
3. Correct the faint totals and Methodology badges without disturbing the dark sidebar or the site-wide palette.
4. Test whether unnecessary font preloads delay mobile headings; keep essential styles and all required Georgian characters.
5. Recheck every main page and the affected interactions. Publish only with separate authorization and production proof.

## Global constraints

- Preserve `DESIGN.md` v4.1, the warm editorial colors, Georgian copy, section order, and current data presentation.
- Preserve the living-relief map's geometry, city behavior, camera composition, reduced-motion behavior, and WebGL fallback. No static replacement, fewer dots, lower frame-rate target, or changed animation timing without explicit approval.
- Do not change fiscal facts, coverage, source archives, downloads, database imports, identifiers, routes, canonical URLs, or actual/planned rules.
- Do not change global color values to repair a problem confined to one component or background.
- Keep self-hosted fonts and `display: "swap"`. Do not remove font families, required weights, or Georgian glyph coverage to raise a score.
- Do not make all CSS load asynchronously. A stylesheet can be necessary even when PageSpeed lists it as blocking the first paint.
- No new analytics, DNS changes, email changes, security-header rollout, dependency upgrade, or test-runner reconfiguration in this work.
- Reuse the existing test suites. Add a small shared browser-test helper only where the two new contrast checks need it.
- Do not treat an unavailable WebGL renderer, missing real-user data, duplicate reports, or a green build as successful performance verification.

## Baseline and success criteria

The audit used production pages, Lighthouse 13.4.1, simulated slow mobile conditions, and separate desktop conditions. All pages showed **No Data** for real-user experience.

| Area | Recorded baseline | Verification target |
|---|---|---|
| Homepage mobile | Performance 63, then 90; LCP 5.0 s, then 2.9 s; blocking time 440 ms, then 220 ms | Aim for repeatable 90+ performance and lower loading/blocking measurements, without delaying the visible map to game the test |
| Homepage desktop | Performance 96, then 88; layout movement 0.118 in both observations | CLS at or below 0.1; aim for 0.05 or less for margin; no map-init jump in the targeted geometry test |
| Municipalities / Analysis mobile | Performance 86 / 86; LCP 3.9 s / 3.8 s | Aim for 90+ and LCP at or below 2.5 s; retain changes only when comparable tests establish an improvement |
| Expenditure / Revenue contrast | Accessibility 96 mobile / 97 desktop | Identified values meet at least 4.5:1 on their actual backgrounds; no corresponding PageSpeed failure |
| Methodology contrast | Accessibility 95 mobile / 96 desktop | All four Coming soon badges meet at least 4.5:1; dark-shell badges remain readable |
| Other main pages | Initial performance 94–100 depending on device; SEO and Best Practices 100 | No reproducible deterioration in loading, movement, readability, or existing checks |

Performance scores and timing targets are improvement goals, not guaranteed outcomes. The hard checks are preserved behavior, passing relevant regressions, removal of the specific contrast failures, and honest reporting of repeated measurements. If a timing goal cannot be achieved safely, report the remaining issue and tradeoff; do not hide it or expand scope silently.

Use at least three fresh, independent navigations per device for the routes changed by an experiment, with the same build, browser version, viewport, throttling, and cache policy. Report each value and its range; calculate a median only from distinct measurements. Do not count the two identical homepage repeat reports in the saved audit as established independent measurements. Do not compare a local development-server result directly with a production PageSpeed score.

## Task 1: Prepare comparable measurements and reproduce the moving frame

**Files to inspect:**

- `apps/web/components/landing/landing-page.tsx`
- `apps/web/components/landing/hero-relief-lazy.tsx`
- `apps/web/components/landing/hero-relief.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/tests/browser/landing.spec.ts`
- `apps/web/playwright.config.ts`
- `CLAUDE.md`

**Produces:** A production-build baseline, before screenshots, the initial/final hero geometry, and a recorded classification of expensive work. No production change in this task.

- [x] Recheck Git state and preserve user changes. The planning checkout is clean apart from this document, detached at `b9704ff0520cf5d231585da9eb294540c9a2bd7f`. Do not assume that still holds at execution time. Use the existing worktree; create a `codex/*` branch only when implementation is authorized and permissions allow it.
- [x] Check dependencies. They were absent in this checkout during planning. If still absent, run `npm.cmd ci`, requesting any required installation/network permission. Do not borrow another worktree's build output.
- [x] Set the production canonical origin, then build and serve the actual production artifact:

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
npm.cmd run build
npm.cmd run start -- --port 3100
```

Run the server in its own terminal session. Confirm that port 3100 belongs to this build before using test-server reuse. Do not set `CI=true` merely to change the server mode; it also changes browser selection. Do not overwrite an existing user server.

- [ ] Capture the settled homepage at 390×844, 768×900, 1100×900, and 1440×900. Also inspect 320px, 767/768px, and 1099/1100px width transitions. Use viewport screenshots for the WebGL map; full-page stitching can omit its canvas layer.
- [ ] Record a cold-load browser performance trace, with the map actually rendering, for mobile and desktop. Separate script execution, scene initialization, GPU/shader work, style/layout work, and font arrival. The initial audit's 5.4 seconds labelled Other does not identify a cause by itself.
- [x] Record the figure height and the country-statistics position before and after the scene runs. Correlate any shift with the line that sets `heroFigure.style.height` in `hero-relief.tsx`.
- [x] Record initial font preload requests and actual font usage for `/`, `/explorer/municipalities`, and `/explorer/analysis`. A list of four configured weights does not prove four separate files are downloaded; inspect the generated output and request log.
- [x] Save evidence outside application source. Execution uses the approved visualization directory named in the checkpoint above. Record the exact build/commit, cache state, browser conditions, viewport, and whether WebGL was active.

**Gate:** Continue to the relevant fix only after reproducing its symptom. If the current build differs from the deployed baseline, keep those two sets of results separate and identify which build is being improved.

## Task 2: Stabilize the homepage frame without changing the approved composition

**Modify:** `apps/web/components/landing/landing-page.tsx`, `apps/web/components/landing/hero-relief.tsx`, `apps/web/tests/browser/landing.spec.ts`, and the narrowly affected explanation in `hero-relief-lazy.tsx` if it becomes inaccurate. Update `DESIGN.md` section 19 only if the approved sizing contract changes.

**Consumes:** Task 1's initial/final dimensions and screenshots.

**Produces:** A frame whose space is reserved before the map initializes, with the same readable heading, visible geography, and correct statistics position.

### Important sizing decision

At the initial audit, `DESIGN.md` section 19 specified 330px / 500px / `clamp(560px, 78vh, 820px)` for the outer figure, while runtime replaced it with a cropped map band. The user subsequently approved reserving the existing compact settled composition. The implemented contract uses CSS minimum bounds, an intrinsic grid copy-height floor with 24px clearance, and the unchanged virtual camera frames; section 19 now records that contract.

The preferred first experiment is to let the documented outer figure own its height and fit/crop the canvas inside it, eliminating the late parent-height write. **Do not ship merely deleting that write if it introduces a large blank band, moves the settled composition, clips the map, or leaves the heading overlapping it.** Compare the before/after screenshots from Task 1. If preserving the current settled crop requires changing the documented frame sizes, present that bounded visual comparison for approval before making it the new contract. Do not add an arbitrary timeout, conceal the page, or add a height animation.

- [x] Extend `landing.spec.ts` with the following regression. It compares font-settled server layout against the layout after the real scene initializes. It isolates scene sizing; it does not claim to measure all font-related CLS.

```ts
for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1100, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`hero initialization preserves reserved space at ${viewport.width}px`, async ({ browser, page }) => {
    const initialContext = await browser.newContext({ javaScriptEnabled: false, viewport });
    try {
      const initialPage = await initialContext.newPage();
      await initialPage.goto(baseUrl);
      await initialPage.evaluate(() => document.fonts.ready.then(() => undefined));
      const initialFigure = await initialPage.locator("figure").boundingBox();
      const initialStats = await initialPage.getByTestId("key-numbers").boundingBox();
      expect(initialFigure).not.toBeNull();
      expect(initialStats).not.toBeNull();

      await page.setViewportSize(viewport);
      await page.goto(baseUrl);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expect(page.locator("figure canvas")).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => {
        const figure = await page.locator("figure").boundingBox();
        const stats = await page.getByTestId("key-numbers").boundingBox();
        if (!figure || !stats) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(figure.height - initialFigure!.height),
          Math.abs(stats.y - initialStats!.y),
        );
      }).toBeLessThanOrEqual(1);
      await expectNoPageOverflow(page);
    } finally {
      await initialContext.close();
    }
  });
}
```

- [x] Run it before changing the implementation. Expected current failure: the map initialization changes the reserved height or following section position. If the intended failure does not occur, revisit the reproduction instead of accepting an unrelated failure.

```powershell
npm.cmd run test:browser -- tests/browser/landing.spec.ts -g "hero initialization preserves reserved space"
```

- [x] Implement only the approved sizing treatment. Keep the existing map geography, city behavior, heading text, and responsive composition. Do not introduce a new positioning library or rewrite the scene.
- [x] Run the targeted test again, then the whole landing suite. Inspect ordinary motion, reduced motion, a working WebGL scene, resizing across both breakpoints, enlarged text and restoration, the CTA, and keyboard focus. The existing fallback code is unchanged.
- [x] Repeat the cold-load trace and compare screenshots. Require no scene-init displacement above 1 CSS pixel in the regression; check full-page CLS separately in Lighthouse because font and other shifts remain possible.
- [x] Review independently and retain a local checkpoint. Review findings were fixed and rechecked; commits were not authorized.

## Task 3: Reduce homepage processing only where the trace proves a cost

**Potential modify:** `apps/web/components/landing/hero-relief.tsx` and `apps/web/components/landing/hero-relief-lazy.tsx`.

**Tests:** Existing `apps/web/tests/browser/landing.spec.ts`; extend a regression only for behavior changed by the accepted optimization.

**Consumes:** Task 1's cost attribution and Task 2's stable frame.

**Produces:** A measured reduction in processing without making the map late, incomplete, or visually different.

**Outcome: unresolved.** The existing terrain cache, bounding-box checks, offscreen/hidden handling and lazy loader were confirmed. No additional scene-processing change demonstrated a sufficient measured gain under the current visual constraints. The retained frame fix changes space reservation and resize observation only. Do not describe the map animation as optimized or claim 90+ from this task.

- [ ] Confirm that the expensive work belongs to the scene before editing it. It already has a dynamic loader, cached terrain data, offscreen handling, and hidden-tab handling. Re-adding those features is not a fix.
- [ ] If the repeated dot-update loop is the demonstrated cost, move only calculations that are invariant between frames out of that loop, retaining the same geography, time-based motion, and rendering output. Verify numerical and visual equivalence for the specific expressions changed.
- [ ] If initialization or shader/GPU work dominates instead, test one scheduling or initialization change against that cause. Do not treat a smaller JavaScript download as proof that GPU or main-thread work improved.
- [ ] Keep a candidate only if repeated measurements improve beyond the baseline variation, the map still appears promptly, the targeted layout check stays green, and the existing interaction/runtime checks pass. Record both LCP/blocking time and visible map readiness; moving work past the audit window is not an accepted improvement.
- [ ] If no safe change is demonstrated, leave this task explicitly unresolved with the measured cause and the additional tradeoff needed. Do not remove the map, reduce its detail, introduce a worker subsystem, or change animation cadence under this plan without another approval.
- [ ] Review and checkpoint an accepted optimization separately from the frame fix so its effect and rollback remain clear.

## Task 4: Fix the identified contrast combinations

**Modify:**

- `apps/web/components/main-explorer/series-selector.tsx`
- `apps/web/components/ui/editorial.tsx`
- `apps/web/components/methodology/methodology-hub.tsx`
- `apps/web/tests/browser/main-explorer.spec.ts`
- `apps/web/tests/browser/methodology.spec.ts`
- `DESIGN.md` sections 4.1 and 21, only to document the specific background usage rule.

**Create:** `apps/web/tests/browser/color-contrast.ts`, a small test-only helper shared by the two new checks. Keep the existing palette suite and unrelated municipal test implementation intact.

**Also verify:** `apps/web/components/municipalities/municipal-explorer.tsx`, `apps/web/components/shell/data-sidebar.tsx`, and `apps/web/components/shell/section-nav.tsx`, because they consume the shared components.

**Confirmed cause:** Using current CSS values, `--faint` against `--tint` is 4.21:1, while it is 4.52:1 against plain paper. The Methodology badge uses `--ink-fg-faint`, a dark-sidebar foreground, on paper: 3.22:1. The existing `--muted` color is 5.16:1 on tint and 5.54:1 on paper. These are calculations from repository colors; browser checks must verify the actual painted combinations. Small text needs at least [4.5:1 contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### Test support

- [x] Add this helper, reusing the RGB contrast calculation already established in the municipal browser tests. Its surfaces are explicit opaque elements, so it does not pretend to handle arbitrary transparency/compositing.

```ts
import { expect, type Locator } from "@playwright/test";
import { computedCssColorAlpha } from "./focus-outline";

function luminance(color: string): number {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (channels?.length !== 3) throw new Error(`Expected RGB color: ${color}`);
  const [r, g, b] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export async function expectReadableText(text: Locator, surface: Locator) {
  await expect(text).toBeVisible();
  const [foreground, background] = await Promise.all([
    text.evaluate((element) => getComputedStyle(element).color),
    surface.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(computedCssColorAlpha(foreground)).toBe(1);
  expect(computedCssColorAlpha(background)).toBe(1);
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  expect((lighter + 0.05) / (darker + 0.05), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
}
```

### Series totals

- [x] Import `expectReadableText` from `./color-contrast` into `main-explorer.spec.ts` and add the following behavior check. The last direct span is the existing value element; do not hardcode the budget amount or year.

```ts
for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  for (const section of ["expenditure", "revenue"] as const) {
    test(`${section} series values stay readable on selected and hover backgrounds at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`http://localhost:3100/explorer/${section}`);
      await expectAppReady(page);
      const row = page.locator(`[data-testid="series-row"][data-series-id="${section}.total"]`);
      const toggle = row.getByTestId("series-row-toggle");
      const value = toggle.locator(":scope > span").last();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(row).toHaveCSS("background-color", "rgb(241, 234, 220)");
      await expectReadableText(value, row);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await page.mouse.move(0, 0);
      await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expectReadableText(value, page.locator("body"));
      await row.hover();
      await expect(row).toHaveCSS("background-color", "rgb(241, 234, 220)");
      await expectReadableText(value, row);
    });
  }
}
```

- [x] Run the new test and confirm a contrast failure on the selected value, not a navigation or missing-element failure.
- [x] Change only the value span's foreground from `text-[var(--faint)]` to `text-[var(--muted)]`. This handles ordinary, selected, and hovered rows without changing the palette or conditional styles elsewhere.
- [x] Retest Expenditure and Revenue, plus the municipality detail selector that shares `SeriesSelectorRow`. Preserve amounts, selection, search, expansion, bulk actions, and exports.

### Coming soon badges

- [x] Import `expectReadableText` from `./color-contrast` into `methodology.spec.ts`. Add this check before changing the badge:

```ts
for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`coming-soon badges are readable on paper and ink at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${TEST_BASE_URL}/methodology`);
    const badges = page.getByTestId("methodology-future-row").getByText("მალე", { exact: true });
    await expect(badges).toHaveCount(4);
    for (const badge of await badges.all()) {
      await expectReadableText(badge, page.locator("body"));
    }
    // The sidebar is visible at desktop widths; keep its existing ink styling.
    if (viewport.width >= 900) {
      await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
      const sidebar = page.getByTestId("data-sidebar");
      await expect(sidebar).toBeVisible();
      const inkBadges = sidebar.getByText("მალე", { exact: true });
      await expect(inkBadges).toHaveCount(4);
      for (const badge of await inkBadges.all()) {
        await expectReadableText(badge, sidebar);
      }
    }
  });
}
```

- [x] Confirm the paper-background badge fails before implementation. Keep the count assertion meaningful: there are four named future datasets in the current product contract.
- [x] Give `ComingSoonBadge` one explicit background choice, preserving the existing dark-shell default:

```tsx
export function ComingSoonBadge({ surface = "ink" }: { surface?: "ink" | "paper" }) {
  return (
    <span className={`flex-none rounded-[2px] border border-[#6C6860] px-1.5 py-px font-[family-name:var(--font-numeric)] text-[9px] ${surface === "paper" ? "text-[var(--muted)]" : "text-[var(--ink-fg-faint)]"}`}>
      მალე
    </span>
  );
}
```

- [x] Change only the Methodology hub call to `<ComingSoonBadge surface="paper" />`. Leave existing dark-shell callers on the default. Do not globally change `--ink-fg-faint`, which is already tested against the dark background.
- [x] Run the two relevant browser suites and the existing theme-token unit tests. Confirm mobile/desktop badges, dark sidebar, selected/hovered values, and municipal shared-selector behavior. Update only the corresponding design usage rules.

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts tests/browser/methodology.spec.ts
npm.cmd run test -- tests/explorer/themeTokens.test.ts
```

- [x] Review the bounded contrast patch independently from performance experiments. The checkpoint is the documented local diff and review; no Git commit or publishing was authorized.

## Task 5: Improve mobile heading loading without damaging typography

**Measured startup extension:** The chart-view split reduced Analysis script transfer by 9,792 bytes (196,383 to 186,591), but was rejected after broader measurements did not establish an overall loading improvement. Keep the original imports. Source inspection also found repeated `Intl.NumberFormat` construction in the shared chart/map formatters. Reuse the same immutable rules by precision in `lib/explorer/format.ts`, retaining all values, signs, grouping and rounding. The existing formatter reuse and actual-budget invariants pass. This changes computation only, not typography or data. Both font-preload experiments were reverted; the root font configuration is unchanged.

**Potential modify:** `apps/web/app/layout.tsx`; `apps/web/components/landing/landing-page.tsx` only if its separate display font is implicated. Change `apps/web/app/globals.css` only if an identified style rule requires it, not because the whole stylesheet is listed in PageSpeed.

**Tests:** Existing `apps/web/tests/browser/landing.spec.ts`, `main-explorer.spec.ts`, `methodology.spec.ts`, `municipalities.spec.ts`, `visual-reference.spec.ts`, and `seo.spec.ts`.

**Consumes:** Task 1's font inventory and the stable homepage frame.

- [ ] Establish which actual font files delay the Georgian heading on Municipalities and Analysis. Check request priority, CSS/font arrival, font fallback, and the timing of the heading's paint. Keep the measured heading identity with each record.
- [ ] If a preloaded Latin subset is not needed for the initial content and competes with the Georgian font, test this one change for the implicated Noto font only:

```ts
// Trial only when the recorded request/usage evidence supports it:
subsets: ["georgian"], // formerly ["georgian", "latin"]
```

In Next.js this option chooses subsets to preload. Verify the generated CSS still makes required Latin characters and numbers available; do not equate fewer preloads with permission to remove character coverage. Preserve the font families, weights, swap behavior, and current non-preloaded numeric font. [Next.js font reference](https://nextjs.org/docs/app/api-reference/components/font).

- [x] Test one font at a time and compare fresh measurements. Revert any trial that worsens heading paint, numeric text, font swapping, map/heading placement, or another main page.
- [ ] If the delay is a fallback-metric or style-order issue instead, fix only that demonstrated path and add its reproduction to the existing relevant browser suite. Do not enable global experimental CSS inlining or disable essential styles under this plan.
- [ ] Visually check Georgian headings, Latin text, numeric KPIs, chart labels, navigation, and footer at mobile and desktop sizes. Run the existing font/visual/SEO checks, and repeat all eight main pages because the root font configuration is shared.
- [x] If there is no safe, measured improvement, retain necessary blocking styles and record the remaining opportunity. A zero-warning PageSpeed list is not the goal.
- [ ] Review and checkpoint only accepted font/style changes, separately from the other fixes.

## Task 6: Verify the full result and keep delivery authorization separate

- [x] Run the required local gates from `apps/web`, with the production site URL set:

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
npm.cmd run check
npm.cmd run build
```

- [ ] Serve that successful build on port 3100, then run `npm.cmd run test:browser` against it. Confirm that the test runner reused this production server instead of starting a development server. The current suite contains hardcoded localhost:3100 URLs; do not claim that setting `PLAYWRIGHT_BASE_URL` redirects the entire suite to a preview.
- [ ] Check the actual browser UI, keyboard operation, viewport transitions, reduced motion, WebGL behavior, and console/runtime errors. Do not change unrelated PDF tests, global timeouts, worker settings, or CI configuration to obtain a green run.
- [ ] Recheck the eight original routes on mobile and desktop: `/`, `/explorer`, `/explorer/expenditure`, `/explorer/revenue`, `/explorer/municipalities`, `/explorer/analysis`, `/methodology`, `/about`.
- [ ] For shared-component safety, also exercise `/explorer/municipalities/tbilisi` and the dark sidebar. Preserve chart selection, budgets, downloads, titles, descriptions, canonical URLs, and source links.
- [ ] Produce a before/after table with the exact tested builds, all relevant metrics, score ranges, and screenshots. Explain any remaining warning and whether it is informational or unresolved. Do not claim real-user Core Web Vitals pass/fail while Google still shows No Data.
- [ ] Stop at verified local work unless publishing is authorized. If publishing is requested, follow the existing workflow: `codex/*` branch → commits → push → draft PR → required green CI → review/resolved conversations → merge → production verification → synchronization and branch cleanup. Read `docs/deployment.md` at that point, verify the deployed commit and READY state, and rerun relevant live URLs and PageSpeed checks. A successful deploy trigger alone is not delivery proof.

## Task 7: Remove duplicated municipal map path payload

**Bounded performance extension approved by the user's request to try the speed work:** Preserve the exact reviewed municipal SVG paths, public map values, colors, strokes, occupied-area hatching, accessible names, 64-target roving keyboard navigation, hover/focus behavior, tooltips, and link destinations. Do not simplify coordinates, change geography, or defer the visible map until interaction.

The current index puts every path string in both server-rendered SVG and serialized client props. Test a content-hashed, same-origin SVG asset containing the exact paths and reference them with SVG `use` elements. Keep marker circles and the existing interaction layer. Send only the metadata needed by that layer as client props; no path strings. Keep all content server rendered and reserve the existing viewBox dimensions.

Use the existing municipality geometry preparation/check workflow to keep the derived asset reproducible, and extend the existing municipality map unit/browser coverage for exact path parity, asset loading, unchanged rendering and interactions. No new runtime dependencies, route/API, data edits, or global configuration changes. Compare production HTML/initial transfer and mobile performance with the baseline; revert if rendering or interaction compatibility cannot be preserved. The parent task owns production builds, Lighthouse comparisons, full browser checks, and review.

## Explicit approval checkpoints

Local implementation and the compact homepage sizing decision were approved by the user's request to try the performance work. Preserve the settled map appearance while reserving its space before initialization. Ask again if a safe performance improvement requires reduced animation/detail or a new subsystem, or if publishing is requested separately. Do not ask the user to choose implementation libraries, testing utilities, or agent orchestration.

## Plan review record

- Checked current files, shared callers, existing browser coverage, theme-token tests, and the production design contract.
- Kept the two confirmed contrast fixes separate from the still-to-be-measured hero and font changes.
- Recorded the hero sizing mismatch instead of silently choosing between the written contract and current settled appearance.
- Included concrete regression examples and existing test commands; those examples have not been executed during planning.
- No code, tests, data, configuration, dependencies, Git branch, or deployment changed while preparing this document.
