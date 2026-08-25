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
