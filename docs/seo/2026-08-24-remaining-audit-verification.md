# Remaining Fiscal.ge SEO audit verification

Plan date: 2026-08-24
Local verification date: 2026-08-26
Verified checkout: `codex/fiscal-seo-audit-improvements` at test-boundary commit `b1c2ba350`
Site URL used for build and checks: `https://fiscal.ge`

## Outcome and evidence boundary

The remaining local SEO audit is verified. The repository check, production build, complete production-browser suite, focused SEO checks, output measurement and Git whitespace check all passed. The production build generated 93/93 static pages.

This is local evidence only. Live production, Vercel deployment state, Search Console, push, pull request, merge and deployment were not verified or performed.

Port 3100 belonged to another checkout and was not stopped or reused. The complete browser suite ran against a fresh production build from this checkout on isolated port 3188. A temporary exact copy of all 11 browser-suite files changed only the literal test origin from `http://localhost:3100` to `http://localhost:3188`; `PLAYWRIGHT_BASE_URL` and `SEO_BASE_URL` were also set to that origin. A temporary Playwright configuration started `npm run start -- --port 3188` with `reuseExistingServer: false`. The command equivalent was:

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3188'
$env:SEO_BASE_URL='http://localhost:3188'
npm.cmd run test:browser -- --config=playwright.task8.config.ts
```

The first complete run found one stale test assertion: the Georgia aggregate test still expected the caret glyph that Task 5 intentionally removed from accessible H1 text. That run ended with 202 passed and 1 failed. The original test was corrected to require the approved caret-free heading; no product code changed. The exact test then passed 1/1 and the complete suite passed 203/203 in 2.5 minutes, exit 0.

## Audit item outcomes

| Audit invariant | Result | Current machine-readable evidence |
| --- | --- | --- |
| Stable municipality slugs | Pass | The registry contains 64 unique lowercase-ASCII slugs. Examples: `04 -> tbilisi`, `06 -> batumi`, `21 -> chiatura`. Focused route/SEO units passed. |
| Final pages and redirects | Pass | All 64 slug requests returned direct 200s. All 64 numeric requests returned one-hop 308s whose `Location` was the matching slug. Unknown slug returned 404. `/06#r=2016-2021` finished at `/batumi#r=2016-2021`, preserving the hash. |
| Final URLs everywhere | Pass | Sitemap contains all 64 slug URLs and no numeric municipality URL. Canonical, `og:url`, visible/JSON-LD breadcrumbs, Dataset IDs and internal links use final slug URLs. |
| Unique descriptions | Pass | Municipality descriptions: 64/64 unique and every value is 120–160 Georgian characters. Region descriptions: 11/11 unique and every value is 120–160 characters. |
| Adjara and Georgia truthfulness | Pass | Adjara copy states six municipalities and internal-transfer removal and does not invent a largest functional share. Georgia copy states 69 budget units, the Adjara addition and internal-transfer removal, within the same length boundary. |
| Region titles | Pass | All 11 regions use the shorter unique reviewed title pattern while retaining data-derived coverage and `Fiscal.ge`; visible H1 text is unchanged. The exact tested example is `იმერეთის ბიუჯეტი 2015–2025 | Fiscal.ge`. The focused `municipalMetadata.test.ts` case `uses a shorter unique region title` passed within the 26/26 focused audit tests. |
| Dataset schema | Pass | The generated inventory has 79 explorer/entity Dataset nodes: 3 national/index nodes, 64 municipalities, 11 regions and Georgia. Stable CSV `distribution` entries exist only on expenditure, revenue and the municipal index. Municipality, region and Georgia nodes omit fictional workbook downloads. Analysis publishes no separate Dataset node. |
| Site schema | Pass | Organization includes the absolute 512×512 SVG logo and description; the logo returned 200 as SVG. No unverified `sameAs` or `SearchAction` claim exists. |
| Source-original header boundary | Pass | A real third-party methodology original returned `X-Robots-Tag: noindex, follow`; the processed public CSV and the methodology HTML page did not. General security headers remain covered by the configuration tests. |
| Root slash alignment | Pass | Root canonical, root Open Graph URL and sitemap root are exactly `https://fiscal.ge/`; non-root URLs remain slashless. |
| Heading hierarchy and caret | Pass | Analysis has one H1 containing `ბიუჯეტის სურათი` and five H2 sections. The explorer hub has four cards and each has one H2. Municipal accessible H1 text contains no `▾`/`▴`; the caret is an aria-hidden CSS triangle. |
| Six caption families | Pass | Meaningful state-aware captions are rendered by the landing dataset table, national/municipal explorer table, national period comparison, analysis ranking, methodology source archive and municipal indicator comparison. Browser checks cover year, scope, entity and percentage-mode changes. |
| Mobile target geometry | Pass | At 375, 390 and the 767px boundary, breadcrumb targets on methodology, national explorer and long Tbilisi paths were at least 24×24 CSS px, non-overlapping, sequentially keyboard reachable, visibly focused and free of page overflow. Footer targets passed the same 375/390 contract. |
| Font loading | Pass | Current build: 4 unique font preloads / 167,156 bytes, down from 5 / 190,264. The accepted cold evidence was recomputed successfully for 8 route/viewport cases: official CLS parity, all four inspected faces loaded by first contentful paint, equal computed family/weight/line-height, stable boxes/line counts and 0 changed ready-state pixels. |
| HTML/RSC payload | Pass | Expenditure and analysis exceed the 20% raw-HTML reduction target; no audited route grew. Current browser payload checks found no server-only provenance fields on expenditure, revenue or analysis. |
| Blocking JavaScript | Pass | Cold control and accepted candidate remained one blocking bootstrap script on every route/viewport. Encoded JavaScript bytes were exactly equal per pair. |
| Raw crawl graph | Pass | Municipal index raw server HTML contains 64 municipality links, exactly 1 Georgia link and 11 region links. |
| Browser console | Pass | Browser console warning/error collectors on the homepage, hub, national explorer and analysis returned empty arrays; the complete suite passed. Next printed `NoFallbackError` server log lines only while tests intentionally requested static 404 routes; these were not browser-console warnings/errors. |
| Visual comparison | Pass | Semantic changes produced no meaningful redesign. Stable Task 5 comparisons were pixel-identical for hub/analysis; the municipality difference was limited to the required caret pixels. Task 6 desktop header/footer before/after files have identical SHA-256 hashes. Accepted Task 7 control/candidate comparisons had 0 changed ready-state pixels in all 8 cases. Fresh Task 8 desktop/mobile captures were inspected with no clipping, overflow or unexpected hierarchy change. |

## Redirect and route examples

The public URL is intentionally separate from the numeric data identity:

```text
04 -> /explorer/municipalities/tbilisi
06 -> /explorer/municipalities/batumi
21 -> /explorer/municipalities/chiatura
```

For every one of the 64 entries, the numeric URL returned a direct permanent 308 and the target slug returned 200 with redirect following disabled. The browser-state check proved that the redirect does not discard `#r=2016-2021`. Sitemap and raw HTML checks found no numeric municipality destinations.

## Output and loading measurements

The before artifact was captured after Tasks 2–6 at `0d33d3831`. The after values below were reproduced from the final Task 8 production build by `npm.cmd run seo:measure`.

| Route | Before HTML | After HTML | HTML change | Before RSC | After RSC | RSC change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Expenditure | 610,729 | 420,945 | -189,784 (-31.07%) | 499,943 | 317,778 | -182,165 (-36.44%) |
| Municipality index | 675,990 | 675,731 | -259 (-0.04%) | 275,451 | 275,337 | -114 (-0.04%) |
| Analysis | 309,289 | 243,638 | -65,651 (-21.23%) | 189,242 | 127,662 | -61,580 (-32.54%) |

Font preloads changed from 5 / 190,264 bytes to the final authoritative Geist-only result of 4 / 167,156 bytes. The rejected two-preload candidate is not part of this result.

Cold blocking-JavaScript evidence remained count `1 -> 1` and byte-identical:

| Route/viewport | Control -> final encoded JS bytes |
| --- | ---: |
| Homepage | 334,455 -> 334,455 |
| Expenditure desktop / mobile | 196,792 -> 196,792 / 188,444 -> 188,444 |
| Municipality index desktop / mobile | 222,293 -> 222,293 / 166,998 -> 166,998 |
| Analysis desktop / mobile | 196,792 -> 196,792 / 188,444 -> 188,444 |

## Verification commands and exact results

All repository commands ran from `apps/web` with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.

- `npm.cmd run check`: exit 0; lint and typecheck passed; 96/96 unit-test files and 810/810 tests passed; every data validator passed. The historical 2004 PDF timeout did not reproduce.
- `npm.cmd run build`: exit 0; compilation and TypeScript passed; 93/93 static pages generated, including 64 municipality slugs and 11 regions.
- isolated complete `npm.cmd run test:browser -- --config=playwright.task8.config.ts`: final exit 0; 203/203 passed in 2.5 minutes.
- corrected Georgia focused browser test: 1/1 passed.
- focused SEO production-browser suite: 28/28 passed.
- focused route/metadata/schema/header unit suite: 7/7 files and 26/26 tests passed.
- `npm.cmd run seo:measure`: exit 0; reproduced the final HTML/RSC and 4 / 167,156-byte preload measurements above.
- accepted cold comparison recomputation: exit 0 for both 8-case comparisons.
- `git diff --check`: exit 0.

The expected pre-existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning remains. It did not fail lint, typecheck or tests. A pre-existing homepage year label still requests computed Geist Mono weight 700 while the configured Geist Mono files stop at 600; this was identical in the all-preload control and remains outside this audit's allowed font-family/weight scope.

## UI impact and deferred boundaries

The product impact is semantic-only plus subtle hit-area changes:

- heading tags and six screen-reader captions improve document and table semantics without changing copy or classes;
- the municipal caret is now a small CSS triangle excluded from accessible H1 text;
- mobile breadcrumb/footer links have larger invisible/low-impact target geometry and visible keyboard focus;
- route slugs, metadata, schema, response headers, font discovery and removed browser-dead transfer fields do not redesign the interface.

The only detected visual difference from the audited semantic work is the intended few-pixel caret shape; no meaningful desktop/mobile difference was detected elsewhere. The one-line Georgia browser-test correction has no product or UI effect.

No audit item is blocked. Live production, deployment/DNS state and Search Console remain explicitly deferred because they were excluded from this local-only task.
