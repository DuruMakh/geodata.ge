# Task 6 — Mobile breadcrumb and footer tap targets

## Scope and implementation

Changed only the requested link surfaces and their browser coverage:

- `BreadcrumbTrail` links: `inline-flex min-h-6 items-center`.
- Explorer `PageHeader` breadcrumb links: `inline-flex min-h-6 items-center`.
- `SiteFooter` email and navigation links: `inline-flex min-h-6 items-center self-start`.

No visible copy, separator margins, footer grid, footer gap, or desktop-only styling changed. The email link already measured wider than 24px, so no `min-w-6` fallback was needed.

## RED evidence

With the production code unchanged and the new targeted tests added, the isolated Playwright run failed as intended:

```text
footer target height: received 16.5px; required >= 24px
breadcrumb target height: received 15px; required >= 24px
```

Command (from `apps/web`, using the isolated server):

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
$env:SEO_BASE_URL = 'http://localhost:3106'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3106'
npm.cmd run test:browser -- tests/browser/seo.spec.ts tests/browser/landing.spec.ts --grep '24px mobile targets'
```

Result: 2 failed for the intended missing minimum-height behavior.

## GREEN geometry, focus, and overflow evidence

The same targeted command passed after the minimal classes were applied. The final checks use Playwright's real Edge browser at both required viewports, assert every applicable link is at least 24 by 24 CSS pixels, compare every pair of target rectangles for overlap, assert `scrollWidth <= clientWidth`, and tab sequentially through each area while checking `:focus-visible` and a non-`none` outline.

| Viewport | Surface | Target sizes (CSS px) | Overlap | Overflow | Keyboard focus |
| --- | --- | --- | --- | --- | --- |
| 375×812 | BreadcrumbTrail | 49.52×24, 89.38×24 | none | none | all visible |
| 375×812 | Explorer PageHeader | 54.63×24, 51.98×24 | none | none | all visible |
| 375×812 | SiteFooter | 92.41×24, 192.47×24, 127.92×24, 101.56×24, 123.38×24 | none | none | all visible |
| 390×844 | BreadcrumbTrail | 49.52×24, 89.38×24 | none | none | all visible |
| 390×844 | Explorer PageHeader | 54.63×24, 51.98×24 | none | none | all visible |
| 390×844 | SiteFooter | 92.41×24, 192.47×24, 127.92×24, 101.56×24, 123.38×24 | none | none | all visible |

Final targeted run: 2 passed (24.0s).

Final focused suite:

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
$env:SEO_BASE_URL = 'http://localhost:3106'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3106'
npm.cmd run test:browser -- tests/browser/seo.spec.ts tests/browser/landing.spec.ts
```

Result: exit 0, 35 passed (2.5m).

## Browser and visual evidence

Port 3100 was left untouched. An isolated development server ran at `http://localhost:3106` with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.

The requested `agent-browser` executable was not installed on this machine, so the repository's working Playwright/Edge browser was used instead. I reviewed these screenshots:

- `apps/web/test-results/task-6-visual/breadcrumb-375.png`
- `apps/web/test-results/task-6-visual/footer-375.png`
- `apps/web/test-results/task-6-visual/breadcrumb-1440.png`
- `apps/web/test-results/task-6-visual/footer-1440.png`

Mobile retains readable Georgian copy and the editorial rule layout without horizontal overflow. At 1440px the breadcrumb rule and footer three-column composition remain visually stable; the only effect is the intended, layout-neutral target height around links.

## Verification commands and results

| Command | Result |
| --- | --- |
| `npm.cmd run lint` | exit 0 |
| `npm.cmd run typecheck` | exit 0 |
| focused Playwright command above | exit 0, 35 passed |
| `$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'; npm.cmd run build` | exit 0; 93 static pages generated |
| `git diff --check` | exit 0 |

`npm.cmd run check` was run and exited 1 because its unrelated 2004 PDF test setup exceeded its existing 30-second hook timeout. A direct reproduction also exited 1 with the same result:

```text
tests/data/realExpenditurePdf/year2004StateBudget.test.ts
beforeAll at line 32 timed out after 30000ms
```

The aggregate run otherwise reported 94 passing suites, 799 passing tests, and 7 skipped tests. This task does not touch the PDF/data path, and no unrelated test or data code was changed.

## Self-review

- All production changes are the prescribed minimum target classes.
- Tests exercise rendered link geometry and keyboard behavior rather than source strings.
- Test helper rectangle logic uses Playwright's actual `x/y/width/height` shape and passed typecheck.
- No target overlaps, no document overflow, and no email-width fallback was required.
- `git diff --check` is clean.

## Fix round 1 — review follow-up

### Stronger keyboard and route coverage

The previous target tests programmatically focused the first link in each area. They now require the natural post-navigation state (`document.activeElement === document.body`) and reach **every** target, including the first, through sequential `Tab` presses. Each focused target proves all of the following:

- it was not skipped in target order;
- it matches `:focus-visible`;
- its outline style is not `none`;
- its outline width is greater than zero; and
- its outline color is neither `transparent` nor fully transparent `rgba(0, 0, 0, 0)`.

The breadcrumb geometry test now also covers `/explorer/municipalities/tbilisi`, the representative longest PageHeader trail, at 375×812 and 390×844. It checks all four linked crumbs as well as the existing public breadcrumb and ordinary explorer header routes for the 24px minimum, pairwise non-overlap, and document overflow.

### Desktop correction and retained visual proof

The initial unconditional `inline-flex min-h-6 items-center` approach was not desktop-neutral. Relative to the parent commit, it expanded the 1440px Tbilisi PageHeader link from 14px to 24px and the first footer link from 16.5px to 24px. Applying only the minimum-height rule at the mobile breakpoint still left the PageHeader link at 15.75px because unconditional `inline-flex` changed its desktop line box.

The final correction scopes **all** target-layout utilities (`inline-flex`, `min-h-6`, `items-center`, and footer `self-start`) to `max-[767px]`. This preserves the 24px mobile targets while restoring native desktop link layout.

Retained, independently inspectable 1440px screenshot pairs:

- Before PageHeader: `.superpowers/sdd/2026-08-24-fiscal-ge-seo-audit-improvements/task-6-visual-round1/before/page-header-tbilisi-1440.png`
- After PageHeader: `.superpowers/sdd/2026-08-24-fiscal-ge-seo-audit-improvements/task-6-visual-round1/after/page-header-tbilisi-1440.png`
- Before footer: `.superpowers/sdd/2026-08-24-fiscal-ge-seo-audit-improvements/task-6-visual-round1/before/site-footer-1440.png`
- After footer: `.superpowers/sdd/2026-08-24-fiscal-ge-seo-audit-improvements/task-6-visual-round1/after/site-footer-1440.png`

The `before` pair was rendered from the parent commit through a temporary source restore while the worktree was clean; all Task 6 sources were then restored from `HEAD`. No stash was needed or created. The final exact raw-pixel comparison is:

| Surface | Before / after dimensions | Changed pixels | Mean absolute channel difference | Final link height |
| --- | --- | --- | --- | --- |
| Tbilisi PageHeader | 1140×48 / 1140×48 | 0 (0%) | 0 | 14px |
| SiteFooter | 1240×263 / 1240×263 | 0 (0%) | 0 | 16.5px |

This is stronger than visual inspection alone: the final desktop images are byte-for-byte identical at decoded-pixel level.

### Fix-round verification

The normal Playwright configuration tried to create a second development server because port 3100 was not reusable at that moment. To keep port 3100 untouched and test only the existing isolated 3106 server, a temporary no-web-server Playwright configuration was used and removed immediately after the run.

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
$env:SEO_BASE_URL = 'http://localhost:3106'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3106'
npx.cmd playwright test --config=.task-6-playwright.config.ts tests/browser/seo.spec.ts tests/browser/landing.spec.ts --grep '24px mobile targets'
```

Result: exit 0, 2 passed (12.0s).

The same isolated configuration then ran both browser files: exit 0, 35 passed (1.2m).
