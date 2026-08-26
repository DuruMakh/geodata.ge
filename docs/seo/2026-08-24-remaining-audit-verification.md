# Remaining Fiscal.ge SEO audit verification

Plan date: 2026-08-24
Final local verification date: 2026-08-26
Branch: `codex/fiscal-seo-audit-improvements`
Synchronized `origin/main`: `bd0fed730870e8379c9c772f5e0a2e9b5bccea5d`
Merge commit: `9ccd532a8c31b2a7f0e090279d3210bde078e744`
Implementation and test boundary: `c14ab8a997e4ce28062f09eefdd2e926bca5536e`
Site URL used for every final build and test process: `https://fiscal.ge`

## Outcome and evidence boundary

The remaining local SEO audit and the final whole-branch review are verified at the implementation boundary above. The feature branch contains current `origin/main`, the repository check, production build, complete production-browser suite, focused SEO/browser checks, output measurement, cold font comparison and Git checks all passed. The production build generated 93/93 static pages.

This is local evidence only. Live production, Vercel deployment state, DNS, Search Console, push, pull request, merge to `main` and deployment were not verified or performed.

Port 3100 belonged to another checkout and was not stopped or reused. The final browser suite ran against a fresh production build from this checkout on isolated port 3197. An ignored temporary copy of the ten browser spec files and their shared helper changed only the literal test origin from `http://localhost:3100` to `http://localhost:3197`; the final test process also set `PLAYWRIGHT_BASE_URL`, `SEO_BASE_URL` and `NEXT_PUBLIC_SITE_URL` explicitly. The final command equivalent was:

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3197'
$env:SEO_BASE_URL='http://localhost:3197'
npm.cmd run test:browser -- --config=.tmp/playwright.full-final.config.ts
```

The first whole-suite invocation omitted `NEXT_PUBLIC_SITE_URL` from the Playwright process. It produced 195 passes and nine workbook-link expectation failures: the fresh build correctly emitted `https://fiscal.ge` hyperlinks while those tests defaulted their expected origin to `http://localhost:3000`. Re-running exactly those nine cases with the required variable passed 9/9 without a source change; the corrected complete run then passed 204/204.

## Integration result

`origin/main` at `bd0fed730` was merged without rebasing or rewriting feature history. The rename-aware merge produced one conflict in `apps/web/app/explorer/municipalities/[slug]/page.tsx`. Its resolution retained the slug registry, slug-to-code lookup and slug href generation while also porting main's `shareOfTotal` summary calculation from the former `[code]` page.

The automatically merged overlaps were inspected and verified. They retain:

- one municipal-share definition across chart, table and workbook surfaces;
- NaN-safe compound annual growth and period-delta ranking;
- year-ascending CSV/database served-data ordering; and
- mapped-type parity coverage for every served explorer and municipal dataset.

The merge-focused suite passed 119/119 tests and TypeScript before the merge commit was recorded.

## Audit item outcomes

| Audit invariant | Result | Final machine-readable evidence |
| --- | --- | --- |
| Stable municipality slugs | Pass | The registry contains 64 unique lowercase-ASCII slugs. Examples: `04 -> tbilisi`, `06 -> batumi`, `21 -> chiatura`. `DESIGN.md` now uses `[slug]` and states that numeric codes remain internal data/geometry/join IDs. |
| Final pages and redirects | Pass | All 64 slug requests returned direct 200s. All 64 numeric requests returned one-hop 308s whose `Location` was the matching slug. Unknown slug returned 404. `/06#r=2016-2021` finished at `/batumi#r=2016-2021`, preserving the hash. |
| Client metadata transitions | Pass | A production-browser regression starts on expenditure, uses a real `Link` to root, then a real `Link` to the explorer hub. After all three states it finds exactly one correct canonical and one correct `og:url`. Only the initial load uses `page.goto`. |
| Final URLs everywhere | Pass | Sitemap contains all 64 slug URLs and no numeric municipality URL. Canonical, `og:url`, visible/JSON-LD breadcrumbs, Dataset IDs and internal links use final slug URLs. |
| Unique descriptions | Pass | Municipality descriptions: 64/64 unique and every value is 120–160 Georgian characters. Region descriptions: 11/11 unique and every value is 120–160 characters. |
| Reviewed special counts | Pass | Adjara metadata receives `members.memberCodes.length` from the page facts; Georgia metadata receives `MUNICIPAL_COUNTRY_BUDGET_COUNT`, derived as public pages plus aggregate-only codes. A mutation-style unit test proves the helper renders supplied values rather than owned literals. |
| Adjara and Georgia truthfulness | Pass | Adjara copy states the reviewed six municipalities and internal-transfer removal and does not invent a largest functional share. Georgia copy states the reviewed 69 budget units, the Adjara addition and internal-transfer removal, within the same length boundary. |
| Region titles | Pass | All 11 regions use the shorter unique reviewed title pattern while retaining data-derived coverage and `Fiscal.ge`; visible H1 text is unchanged. The tested example is `იმერეთის ბიუჯეტი 2015–2025 | Fiscal.ge`. |
| Dataset schema | Pass | The generated inventory has 79 explorer/entity Dataset nodes: 3 national/index nodes, 64 municipalities, 11 regions and Georgia. Stable CSV `distribution` entries exist only on expenditure, revenue and the municipal index. Municipality, region and Georgia nodes omit fictional workbook downloads. Analysis publishes no separate Dataset node. |
| Site schema | Pass | Organization includes the absolute 512×512 SVG logo and description; the logo returned 200 as SVG. No unverified `sameAs` or `SearchAction` claim exists. |
| Source-original header boundary | Pass | A real third-party methodology original returned `X-Robots-Tag: noindex, follow`; the processed public CSV and methodology HTML page did not. |
| General security headers | Pass | The exact retained `/(.*)` configuration rule is now tested for `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and the camera/microphone/geolocation `Permissions-Policy`. Fresh HTTP responses from root, source original, processed CSV and methodology HTML also contained all four headers. |
| Root slash alignment | Pass | Root canonical, root Open Graph URL and sitemap root are exactly `https://fiscal.ge/`; non-root URLs remain slashless. |
| Heading hierarchy and caret | Pass | Analysis has one H1 containing `ბიუჯეტის სურათი` and five H2 sections. The explorer hub has four cards and each has one H2. Municipal accessible H1 text contains no `▾`/`▴`; the caret is an aria-hidden CSS triangle. |
| Six caption families | Pass | Meaningful state-aware captions are rendered by the landing dataset table, national/municipal explorer table, national period comparison, analysis ranking, methodology source archive and municipal indicator comparison. Browser checks cover year, scope, entity and percentage-mode changes. |
| Mobile target geometry | Pass | At 375, 390 and the 767px boundary, breadcrumb targets on methodology, national explorer and long Tbilisi paths were at least 24×24 CSS px, non-overlapping, sequentially keyboard reachable, visibly focused and free of page overflow. Footer targets passed the same 375/390 contract. |
| Font loading | Pass | Current build: 4 unique font preloads / 167,156 bytes, down from 5 / 190,264. The accepted Geist-only source blob and all four generated preload filenames are unchanged after the merge. Fresh eight-case cold comparison reproduces exact official CLS, computed style, geometry, line counts and zero changed ready-state pixels. |
| Synthetic-weight boundary | Pass | There is no newly introduced synthetic weight compared with the all-preload baseline. The pre-existing homepage Geist Mono 700 request versus configured 400/500/600 faces is unchanged and outside this task's approved font-family/weight scope. |
| HTML/RSC payload | Pass | Expenditure and analysis exceed the 20% raw-HTML reduction target; no audited route grew. Current browser payload checks found no server-only provenance fields on expenditure, revenue or analysis. |
| Blocking JavaScript | Pass with synchronized-byte note | Every final cold route/viewport still has exactly one blocking Next bootstrap script. Final encoded bytes are recorded below. Small changes from the pre-merge accepted snapshot come from the required mainline indicator integration, not font/config changes. |
| Raw crawl graph | Pass | Municipal index raw server HTML contains 64 municipality links, exactly 1 Georgia link and 11 region links. |
| Browser console and workbooks | Pass | Console warning/error collectors remained empty on the homepage, hub, national explorer and analysis. The complete suite verified national, municipal, region and Georgia workbook generation and source hyperlinks. |
| Visual comparison | Pass | The fresh accepted-Geist-only versus merged-final comparison has zero changed ready-state pixels in all eight route/viewport cases. All 32 inspected typography targets retain equal computed style, geometry and line counts. |
| SDD tracking boundary | Pass | `git ls-files '.superpowers/sdd/**'` returns no entries. The formerly tracked Task 6 report remains available only as ignored local evidence. |

## Output and loading measurements

The before artifact was captured after Tasks 2–6 at `0d33d3831`. The merged final values below were reproduced by `npm.cmd run seo:measure` from the fresh final production build.

| Route | Before HTML | Final HTML | HTML change | Before RSC | Final RSC | RSC change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Expenditure | 610,729 | 420,945 | -189,784 (-31.07%) | 499,943 | 317,778 | -182,165 (-36.44%) |
| Municipality index | 675,990 | 675,731 | -259 (-0.04%) | 275,451 | 275,337 | -114 (-0.04%) |
| Analysis | 309,289 | 243,638 | -65,651 (-21.23%) | 189,242 | 127,662 | -61,580 (-32.54%) |

Font preloads changed from 5 / 190,264 bytes to the final authoritative Geist-only result of 4 / 167,156 bytes. The rejected two-preload candidate is not part of this result.

The current preloaded WOFF2 files are identical to the accepted Geist-only evidence:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `3923fe54496565b7-s.p.05x-t6u6cm6_s.woff2` | 65,284 | `8fa51ac6b67a557f866e939364c3c17f11d344cf0f94028a3963f21e6c0a5403` |
| `3b5957ec9710f119-s.p.0yep9bdaefzzl.woff2` | 24,924 | `f9e49afcbc0a211ad917d281ca25bc57307a45c868a707cac4ef7eb4ca0f0652` |
| `734857d55e2089f8-s.p.3fr6qaig22drb.woff2` | 35,492 | `48294af2c65bcc591e6ac0982174dcbe9e999e95638731467de2ab54f97d97c2` |
| `9a4536d8acff75fc-s.p.05m5z8ok51pb_.woff2` | 41,456 | `471ae4eb863bba8ccbd8a11c06f02855a81e692b1f678ba648d0451a864d3d26` |

`apps/web/app/layout.tsx` has Git blob `d9d8b23a019f815305c183529d1e6608ad4f9dfc` both at pre-merge feature commit `aee4f37b5` and at the final implementation boundary. The relevant font/config source set has no diff across that merge.

Fresh cold JavaScript evidence for the merged branch:

| Route/viewport | Blocking scripts | Final encoded JS bytes | Change from pre-merge accepted snapshot |
| --- | ---: | ---: | ---: |
| Homepage desktop / mobile | 1 / 1 | 334,539 / 334,539 | +84 / +84 |
| Expenditure desktop / mobile | 1 / 1 | 196,876 / 188,528 | +84 / +84 |
| Municipality index desktop / mobile | 1 / 1 | 222,459 / 166,998 | +166 / 0 |
| Analysis desktop / mobile | 1 / 1 | 196,876 / 188,528 | +84 / +84 |

The increases are at most 166 bytes (below 0.08%) and coincide with the required `origin/main` indicator/helper merge. The accepted preload configuration, font corpus, official CLS, rendered pixels and target geometry remain unchanged.

## Verification commands and exact results

All repository commands ran from `apps/web` with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.

- `npm.cmd run check`: exit 0; lint and typecheck passed; 98/98 unit-test files and 833/833 tests passed; every data validator passed.
- `npm.cmd run build`: exit 0; compilation and TypeScript passed; 93/93 static pages generated, including 64 municipality slugs and 11 regions.
- isolated complete production-browser suite on port 3197: final exit 0; 204/204 passed in 2.7 minutes.
- focused browser rerun for the first invocation's environment mismatch: 9/9 passed with no source change.
- focused SEO production-browser suite: 29/29 passed, including the new three-state Link navigation regression.
- focused route/metadata/schema/header/measurement unit suite: 8/8 files and 29/29 tests passed.
- `npm.cmd run seo:measure`: exit 0; reproduced the final HTML/RSC and 4 / 167,156-byte preload measurements above.
- fresh cold merged-final capture and accepted-Geist-only comparison: 8/8 route/viewport cases; exact official CLS parity, all target checks true, zero changed ready-state pixels, cold requests confirmed.
- direct HTTP header probe: root, methodology original, processed CSV and methodology HTML all returned 200 and the four general security headers; only the original returned `X-Robots-Tag`.
- `git diff --check`: exit 0.
- `git merge-base --is-ancestor origin/main HEAD`: exit 0.
- `git ls-files '.superpowers/sdd/**'`: empty.

The expected pre-existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning remains. Next printed `NoFallbackError` server log lines only while browser tests intentionally requested static 404 routes; these were not browser-console warnings/errors. Neither warning failed a gate.

## TDD evidence for the final review fixes

- Count plumbing RED: the new test supplied seven Adjara municipalities and received the hardcoded six; 1/6 failed for the intended reason. GREEN: page-derived/canonical count inputs passed 6/6.
- Security rule mutation RED: temporarily removing `Permissions-Policy` made the exact retained-rule test fail 1/2. Restoring the unchanged production rule passed 2/2.
- Link regression mutation RED: temporarily assigning the explorer hub the expenditure canonical made the non-root → root → non-root test fail on the final state. Restoring the correct metadata passed 1/1 on a fresh production build.

Temporary mutations were restored before the fix commit and do not appear in the final diff.

## UI impact and deferred boundaries

The product impact remains semantic-only plus subtle hit-area changes:

- heading tags and six screen-reader captions improve document and table semantics without changing copy or classes;
- the municipal caret is a small CSS triangle excluded from accessible H1 text;
- mobile breadcrumb/footer links have larger targets and visible keyboard focus;
- route slugs, metadata, schema, response headers, font discovery, count plumbing and removed browser-dead transfer fields do not redesign the interface.

No audit item is blocked. Live production, deployment/DNS state and Search Console remain explicitly deferred because they were excluded from this local-only task.
