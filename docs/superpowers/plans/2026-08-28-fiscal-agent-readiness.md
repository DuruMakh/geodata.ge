# Fiscal.ge Agent Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable agent recovery and discovery surfaces, protect the already-correct server-rendered homepage and identity schema, and provide a separately gated path to exact Markdown content negotiation.

**Architecture:** Keep the approved application static for Tasks 1–3: use an App Router `not-found.tsx`, a checked public `llms.txt`, existing JSON-LD helpers, and request-level Playwright verification. Task 4 is isolated because exact Accept negotiation requires a thin Next.js proxy and statically generated Markdown representations; it must not be executed without explicit approval of that runtime boundary.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.8, strict TypeScript, Tailwind CSS v4, Vitest 4.1.5, Playwright 1.60, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-28-fiscal-agent-readiness-design.md`

## Global Constraints

- Preserve `DESIGN.md` v4.1, existing routes, data, copy, metadata, navigation, downloads, and fully static serving for Tasks 1–3.
- Add no dependency, public API, database request, hidden crawler-only content, phone, physical address, or unverified `sameAs` identity.
- Treat current homepage SSR and Organization name/description as passing behavior to protect, not code to rewrite.
- Append `Accept` to `Vary`; never replace the existing `rsc` and Next router tokens.
- Run commands from `apps/web` with `npm.cmd` on Windows and set `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` for production builds and SEO browser tests.
- Stop after local verification. Push, PR, merge, deployment, Search Console, and external brand work are outside this plan.

---

### Task 1: Publish checked agent instructions

**Files:**
- Create: `apps/web/public/llms.txt`
- Create: `apps/web/tests/seo/agentFiles.test.ts`
- Modify: `apps/web/tests/browser/seo.spec.ts`

**Interface:** Produces `GET /llms.txt` as the canonical agent guide and links only to real public Fiscal.ge resources.

- [ ] Write a failing Vitest file that loads `public/llms.txt` and asserts: exactly one leading H1; a following blockquote; a pre-heading `**When to use Fiscal.ge:**` paragraph; H2 sections containing Markdown links; the annual-data, no-public-API, and no-invented-values limitations; and unique `https://fiscal.ge/...` targets.
- [ ] Run `npm.cmd test -- tests/seo/agentFiles.test.ts`; expect failure because the file is absent.
- [ ] Add `public/llms.txt` in this order: `# Fiscal.ge`; one-sentence Georgian-budget summary; specific when-to-use and limitation prose without another heading; `## Core data`; `## Methodology and sources`; `## Site navigation`. Link `/`, `/explorer`, `/explorer/expenditure`, `/explorer/revenue`, `/explorer/analysis`, `/explorer/municipalities`, `/methodology`, the three methodology pages, `/about`, and `/sitemap.xml` with concise descriptions.
- [ ] Extend the unit test to compare every linked HTML path with the existing sitemap inventory and assert `/sitemap.xml` separately as the one machine-readable link. Add a request-level Playwright test that fetches `/llms.txt`, asserts `200` and `text/plain; charset=utf-8`, then requests every listed internal URL and asserts `200`.
- [ ] Run `npm.cmd test -- tests/seo/agentFiles.test.ts` and `npm.cmd run test:browser -- seo.spec.ts --grep "agent instructions"`; expect both focused checks to pass.
- [ ] Commit: `feat: publish Fiscal.ge agent instructions`.

### Task 2: Add a useful real-404 recovery page

**Files:**
- Create: `apps/web/app/not-found.tsx`
- Modify: `apps/web/tests/browser/seo.spec.ts`
- Modify: `DESIGN.md` only to record the new recovery-page contract.

**Interface:** Unknown HTML routes retain status 404 and expose links to `/`, `/explorer`, `/methodology`, `/sitemap.xml`, and `/llms.txt`.

- [ ] Add a failing Playwright request/browser test for a unique nonexistent path. Assert HTTP 404, `text/html`, one H1, short Georgian recovery copy, all five raw-HTML links, no page overflow at 390px, keyboard-reachable links, and no console errors.
- [ ] Run `npm.cmd run test:browser -- seo.spec.ts --grep "404 recovery"`; expect the link assertions to fail against the bare Next.js page.
- [ ] Implement `app/not-found.tsx` with `next/link`, the existing paper/ink/accent variables, a compact Fiscal.ge identity, one H1, one explanatory paragraph, and the five destinations. Do not load data merely to display the shared year label or footer.
- [ ] Record in `DESIGN.md` that the 404 is a minimal editorial recovery surface using existing tokens and real navigation, with no illustration or new visual system.
- [ ] Re-run the focused test at desktop and mobile widths; expect 404 status and all recovery/accessibility assertions to pass.
- [ ] Commit: `feat: add agent-friendly 404 recovery`.

### Task 3: Protect current SSR and verified Organization identity

**Files:**
- Modify: `apps/web/lib/seo/structuredData.ts`
- Modify: `apps/web/tests/seo/structuredData.test.ts`
- Modify: `apps/web/tests/browser/seo.spec.ts`

**Interface:** `siteJsonLd(origin)` retains the existing Organization fields and adds `contactPoint: { "@type": "ContactPoint", email: "info@fiscal.ge", contactType: "general inquiries", availableLanguage: "ka" }`.

- [ ] Strengthen the unit test first to require Organization `name`, `description`, `url`, `email`, logo, and the exact email-only ContactPoint; continue asserting that `address`, `telephone`, and `sameAs` are absent.
- [ ] Add a raw-response Playwright regression for `/`: strip scripts/styles/tags from the response body, assert more than 500 meaningful characters, assert heading sequence `H1,H2,H2,H2,H2`, and confirm the core explorer and methodology links occur in the server HTML.
- [ ] Run the focused unit/browser tests. Expect only the new ContactPoint assertion to fail; the SSR assertions must already pass before production code changes.
- [ ] Add only the verified ContactPoint object to `siteJsonLd`; do not change the existing schema types or add an address/phone.
- [ ] Re-run `npm.cmd test -- tests/seo/structuredData.test.ts` and `npm.cmd run test:browser -- seo.spec.ts --grep "Organization schema|raw homepage"`; expect all assertions to pass.
- [ ] Commit: `feat: clarify Fiscal.ge agent contact`.

### Task 4: Add exact Markdown negotiation — explicit runtime approval required

**Approval gate:** Do not execute this task until the owner explicitly accepts a request-time Next.js proxy in front of the currently static pages. If approval is not given, Tasks 1–3 remain complete and this audit item remains intentionally deferred.

**Files:**
- Create: `apps/web/lib/agent/accept.ts`
- Create: `apps/web/lib/agent/markdownRoutes.ts`
- Create: `apps/web/content/agent/*.md`
- Create: `apps/web/app/_agent/markdown/[[...slug]]/route.ts`
- Create: `apps/web/proxy.ts`
- Create: `apps/web/tests/agent/accept.test.ts`
- Modify: `apps/web/tests/browser/seo.spec.ts`

**Interfaces:**
- `preferredRepresentation(header: string | null): "text/html" | "text/markdown" | null` parses media ranges, q-values, specificity, and client-order ties.
- `appendVaryAccept(headers: Headers): void` preserves existing tokens and adds `Accept` once.
- `MARKDOWN_ROUTES` maps each supported canonical pathname to one curated Markdown source file.
- The route handler returns UTF-8 `text/markdown`, 404 for an unmapped source, and `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.

- [ ] Write failing parser tests covering missing Accept, exact Markdown, mixed HTML/Markdown q-values, wildcards, specificity, `q=0`, malformed q-values, client-order ties, and no acceptable representation. Add Vary tests for absent, existing Next.js tokens, existing case-insensitive `accept`, and duplicate prevention.
- [ ] Implement the smallest parser that satisfies RFC 9110 selection for the two produced types; do not use substring matching or add a dependency.
- [ ] Create concise Markdown representations for `/`, `/about`, `/explorer`, the three national explorer pages, `/explorer/municipalities`, `/methodology`, and its three dataset pages. Include their stable scope, coverage, methodology, and download links; omit volatile headline totals. Do not duplicate the 64 municipality pages in this first bounded release.
- [ ] Add a force-static catch-all route handler with generated static parameters from `MARKDOWN_ROUTES`; return `Content-Type: text/markdown; charset=utf-8`, `Vary: Accept`, and `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`. An unmapped internal handler request returns 404.
- [ ] Add `proxy.ts` for only the supported canonical paths: Markdown preference rewrites to the internal handler, HTML continues normally, and no acceptable type returns 406. Append `Accept` to the response Vary on every negotiated path without removing Next.js tokens.
- [ ] Add production-browser request tests for default HTML, exact Markdown, q-value preference in both directions, wildcard fallback, 406, UTF-8 Georgian text, an unmapped internal-handler 404, preserved Next router Vary tokens, and cache-safe alternating HTML/Markdown requests to the same URL.
- [ ] Compare 20 cold and 20 warm requests for the supported HTML routes against a build without Task 4. Stop for owner review if the proxy adds more than 20 ms to the median or 50 ms to p95, changes the HTML body/status, contaminates alternating cache variants, or creates a request-time function outside the explicitly approved proxy.
- [ ] Commit only after the focused unit and protocol tests pass: `feat: negotiate Markdown for agents`.

### Task 5: Run the complete local gate and record the remaining boundary

**Files:**
- Create: `docs/seo/2026-08-28-agent-readiness-verification.md`
- Verify: all files from Tasks 1–4.

- [ ] From `apps/web`, run the focused agent/SEO unit tests, then `npm.cmd run check`.
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` and run `npm.cmd run build`; verify all existing static pages plus the custom 404 and agent files are emitted. If Task 4 ran, identify the exact routes/functions that are no longer purely static.
- [ ] Run `npm.cmd run test:browser -- landing.spec.ts seo.spec.ts` and inspect the 404 at 1440×900, 390×844, and 320×800 without changing the homepage or Explorer visuals.
- [ ] Probe the local production server with curl for 404 status, `/llms.txt`, raw homepage headings/text, JSON-LD, HTML negotiation, and—only if Task 4 ran—Markdown, Vary, 406, and alternating-cache behavior.
- [ ] Run `git diff --check` and inspect the diff for any data, homepage copy, navigation, dependency, address/phone, public-API, or unrelated visual change.
- [ ] Record exact pass counts, build route classification, HTTP headers/statuses, the Task 4 approval/execution boundary, and the still-external brand-indexing/address decisions in the verification document.
- [ ] Commit: `docs: record Fiscal.ge agent readiness verification`.
