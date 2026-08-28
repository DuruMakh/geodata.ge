# Fiscal.ge agent-readiness local verification — 2026-08-28

## Result

The complete local gate passed at `dfc046e1c1fba91448f210a2161f14250d930a14` on `codex/fiscal-agent-readiness`. This is local verification only: no production deployment, GitHub delivery, Search Console activity, or runtime proxy was performed.

## Scope review

- This commit adds this verification record only. It changes no data, homepage wording/headings, navigation, dependencies, metadata types, downloads, routes, static-serving behavior, address, telephone, `sameAs`, public API, or production visual.
- Task 3's approved correction `dfc046e1c` changed only `apps/web/tests/seo/structuredData.test.ts` to narrow the Organization schema assertion.
- The browser-test configuration normally points to port 3100, which is owned by a separate checkout. Verification instead used a Task 5 `next start` process at port 3205 with a temporary, uncommitted no-web-server configuration; it was removed after testing.
- The earlier `git diff --check` and `git diff --cached --check` completed with no output, but covered only staged and unstaged changes. A fresh whole-branch `git diff --check 125e459f901dd44229673c9c832e3ed685375e83..51b84e0c38d2d8b744b460cdac9635a22dbcb683` found the design-spec whitespace errors corrected by this documentation follow-up; the final whole-branch check is clean.

## Complete local gate

| Command | Exact result |
| --- | --- |
| `npm.cmd exec vitest run -- --configLoader native tests/seo/agentFiles.test.ts tests/seo/structuredData.test.ts` | PASS — 2 files, 10 tests, 762ms. |
| `npm.cmd run check` | PASS (exit 0) — lint, typecheck, 100 test files / 843 tests, and all data validation. Vitest duration: 40.76s. |
| `$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'; npm.cmd run build; Remove-Item Env:NEXT_PUBLIC_SITE_URL` | PASS (exit 0) — 95/95 static pages generated. Compilation 5.3s, TypeScript 8.5s, page data 945ms, static generation 1840ms. |
| `npm.cmd run test:browser -- --config .task5-playwright.config.ts landing.spec.ts seo.spec.ts` with `SEO_BASE_URL` and `PLAYWRIGHT_BASE_URL` set to `http://localhost:3205` | PASS (exit 0) — 44/44 browser tests in 38.6s. |

Data validation confirmed 7,040 municipal function rows, 704 municipal total rows, 110 Georgia function rows, 11 Georgia total rows, 64 municipalities, 527 fact rows, 852 administrative-spending fact rows, and 30 national-GDP facts. Archive and public-dataset checks passed for all three data packages.

## Static build classification

The build reports ordinary routes as static (`○`) and the following three parameterised sets as statically generated (`●`) through `generateStaticParams`:

- `/explorer/municipalities/[slug]` — 64 paths.
- `/explorer/municipalities/region/[id]` — 11 paths.
- `/methodology/[dataset]` — 3 paths.

The prerender manifest has 95 routes and those three dynamic patterns, each with `fallback: false`. The artifact includes the custom `/_not-found` page; the build also emits `/robots.txt`, `/sitemap.xml`, icons, Explorer, methodology, municipality, about, and homepage routes. `public/llms.txt` is present for static serving. No route or function lost static classification, because Task 4 was not implemented.

## Built-server HTTP and content evidence

The canonical-host build was served locally only at `http://127.0.0.1:3205` and that Task 5 process was stopped after the checks.

| Probe | Observed response |
| --- | --- |
| `GET /llms.txt` | `200 OK`; `Content-Type: text/plain; charset=UTF-8`; 1,785 bytes; `Vary: Accept-Encoding`. |
| `GET /task5-not-found` | `404 Not Found`; `Content-Type: text/html; charset=utf-8`; 21,419 bytes; cache policy `private, no-cache, no-store, max-age=0, must-revalidate`. |
| `GET /` with `Accept: text/html` | `200 OK`; `Content-Type: text/html; charset=utf-8`; ETag `"5zx8fp4p71ifz"`; 81,798 bytes. |
| `GET /` with `Accept: text/markdown` | Still `200 OK` with the same HTML content type, ETag, and length. Its `Vary` header is `rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding`, not `Accept`. |

Raw homepage HTML contains the H1 `საქართველო ციფრებში`, `data-testid="site-json-ld"`, and Organization and WebSite JSON-LD nodes. The passing browser suite independently covers the raw homepage, structured data, public links, and real 404 response.

## 404 browser evidence

The custom 404 was visually inspected at 1440×900, 390×844, and 320×800 during the first Task 5 pass. The approved Task 3 correction was test-only, so that visual evidence remains applicable. At all three widths it showed the Georgian H1, explanatory copy, and five recovery links without clipping; at 320×800, `clientWidth` and `scrollWidth` were both 320. The final 44-test browser run again passed the real-404, keyboard-focus, and desktop/mobile overflow assertions.

The manual console recorded the expected failed-document 404 request and three existing preload warnings (CSS, compact logo SVG, and Georgian font). The final landing/SEO suite passed its no-unexpected-console-error checks; no console behavior was changed by this verification task.

## Deferred Task 4 and external decisions

Task 4 remains deferred because the owner did not approve a runtime Next.js proxy. Markdown content negotiation is therefore intentionally unimplemented: `Accept: text/markdown` returns HTML, there is no `Vary: Accept`, no `406 Not Acceptable` case, and no alternating-cache evidence. This document does not claim markdown-accept compliance.

Local checks cannot establish Search Console indexing or external brand knowledge. Address, telephone, and external `sameAs` details remain intentionally absent pending owner-verified public information; none were added or inferred.

## Remaining local artifact boundary

The eight task-owned screenshots/logs from `apps/web/.playwright-cli/` were moved out of this worktree after exact source-path validation. They remain recoverable at `C:\Users\Mylaptop\AppData\Local\Temp\fiscal-agent-readiness-playwright-cli-backup`; the source directory no longer exists and was not part of either documentation commit.

## Post-review hardening

The final independent review produced no blocking findings and two bounded hardening recommendations. The raw-homepage heading assertion now reads from the same script/style-stripped HTML as the text and anchor assertions. The five custom-404 recovery links set `prefetch={false}`, preventing unnecessary App Router requests from a page whose purpose is recovery rather than navigation prediction.

Production-mode RED evidence recorded 30 `_rsc` requests across the two 404 viewports before the prefetch change. After the change, the focused 404/raw-homepage run passed 2/2 with zero `_rsc` requests. Fresh final gates passed: `npm.cmd run check` (100 files / 843 tests plus all data validation), canonical-host `npm.cmd run build` (95/95 static pages), and the production landing/SEO suite (44/44).
