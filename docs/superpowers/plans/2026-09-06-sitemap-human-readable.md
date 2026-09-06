# Human-readable XML sitemap presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing bilingual sitemap data and make `/sitemap.xml` render as a readable technical page in browsers through a standard XML stylesheet.

**Architecture:** Move the current sitemap data function into `lib/seo/sitemap.ts`, where it remains directly testable and continues to return `MetadataRoute.Sitemap`. Replace Next's automatic metadata-file response with a static `app/sitemap.xml/route.ts` handler that serializes those entries and adds the XML stylesheet processing instruction. Add `public/sitemap.xsl` as a standalone browser presentation layer; crawlers continue to receive XML with the same `<url>`, `<loc>`, `<lastmod>`, and `xhtml:link` data.

**Tech Stack:** Next.js 16 App Router route handler, TypeScript, Vitest, Playwright, XSLT 1.0, static public asset.

---

### Task 1: Add the serialization regression test

**Files:**
- Create: `apps/web/tests/seo/sitemapPresentation.test.ts`
- Create later: `apps/web/lib/seo/sitemap.ts`

- [x] **Step 1: Write the failing test**

Add a focused test for the public XML serializer. It must prove the stylesheet instruction is present, XML-sensitive text is escaped, and bilingual alternates remain in the document:

```ts
import type { MetadataRoute } from "next";
import { describe, expect, it } from "vitest";
import { serializeSitemapXml } from "../../lib/seo/sitemap";

describe("serializeSitemapXml", () => {
  it("adds the browser stylesheet without changing sitemap records", () => {
    const entries: MetadataRoute.Sitemap = [
      {
        url: "https://fiscal.ge/explorer?view=a&sort=b",
        lastModified: new Date("2026-09-06T00:00:00.000Z"),
        alternates: {
          languages: {
            ka: "https://fiscal.ge/explorer?view=a&sort=b",
            en: "https://fiscal.ge/en/explorer?view=a&sort=b",
            "x-default": "https://fiscal.ge/explorer?view=a&sort=b",
          },
        },
      },
    ];

    const xml = serializeSitemapXml(entries);

    expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>');
    expect(xml).toContain("<loc>https://fiscal.ge/explorer?view=a&amp;sort=b</loc>");
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://fiscal.ge/en/explorer?view=a&amp;sort=b" />',
    );
    expect(xml).toContain("<lastmod>2026-09-06T00:00:00.000Z</lastmod>");
  });
});
```

- [x] **Step 2: Run the focused test and verify the expected failure**

Run from `apps/web`:

```powershell
npx vitest run --configLoader native tests/seo/sitemapPresentation.test.ts
```

Expected result: the test fails because `../../lib/seo/sitemap` and `serializeSitemapXml` do not exist yet.

### Task 2: Move the sitemap data builder and add the custom XML route

**Files:**
- Create: `apps/web/lib/seo/sitemap.ts`
- Create: `apps/web/app/sitemap.xml/route.ts`
- Delete: `apps/web/app/sitemap.ts`
- Modify: `apps/web/tests/seo/sitemapFreshness.test.ts`
- Modify: `apps/web/tests/seo/routes.test.ts`
- Modify: `apps/web/tests/seo/agentFiles.test.ts`
- Modify: `apps/web/tests/i18n/inventory.test.ts`
- Modify: `apps/web/tests/i18n/pageRevisions.test.ts`

- [x] **Step 1: Move the existing data function without changing its records**

Copy the current implementation from `apps/web/app/sitemap.ts` into `apps/web/lib/seo/sitemap.ts`, retaining the same imports and default `sitemap()` export. Add a named `serializeSitemapXml(entries: MetadataRoute.Sitemap): string` export below it. The serializer must:

```ts
const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

const escapeXml = (value: string): string =>
  value.replace(/[<>&'\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);

const serializeLastModified = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : value;
```

Generate the same `<loc>`, `<lastmod>`, and `xhtml:link` values as Next's sitemap output, escaping all attribute and element values. Start the document with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
```

- [x] **Step 2: Update direct test imports**

Change the five existing tests that import `../../app/sitemap` to import the default data function from `../../lib/seo/sitemap`. Do not change their assertions about URL inventory, freshness, or localization.

- [x] **Step 3: Replace the metadata-file route with a static route handler**

Create `apps/web/app/sitemap.xml/route.ts`:

```ts
import sitemap, { serializeSitemapXml } from "../../lib/seo/sitemap";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const xml = serializeSitemapXml(await sitemap());

  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
```

- [x] **Step 4: Remove the old metadata route**

Delete `apps/web/app/sitemap.ts` so Next does not see two route definitions for `/sitemap.xml`.

- [x] **Step 5: Run the focused tests and verify they pass**

Run:

```powershell
npx vitest run --configLoader native tests/seo/sitemapPresentation.test.ts tests/seo/sitemapFreshness.test.ts tests/seo/routes.test.ts tests/seo/agentFiles.test.ts
```

Expected result: all selected tests pass, including the existing 182-URL bilingual inventory and per-entity freshness checks.

### Task 3: Add the readable browser presentation

**Files:**
- Create: `apps/web/public/sitemap.xsl`

- [x] **Step 1: Add the XSLT view**

Create an XSLT 1.0 stylesheet that transforms the existing `urlset` into a readable HTML document. Keep it independent from the React application and use only inline CSS so it works when opened directly from `/sitemap.xml`.

The view must include:

- A short `Fiscal.ge / XML sitemap` heading and a count of `<url>` records.
- One row per `<url>` with the page URL, last-modified date, and language links.
- Monospaced URL/date text, readable wrapping for long URLs, clear row separators, and a restrained warm-paper/ink/terracotta palette consistent with the site without loading the main application shell.
- A responsive single-column row layout at narrow widths so the view never requires page-wide horizontal scrolling.
- On narrow screens, the URL, last-modified label, and language links must be stacked as separate readable blocks.

### Task 4: Verify the route and browser presentation

**Files:**
- Modify: `apps/web/tests/browser/seo.spec.ts`

- [x] **Step 1: Add a browser regression check**

Add a test that requests `/sitemap.xml`, checks HTTP 200 and `application/xml`, verifies the stylesheet instruction and all 182 `<loc>` values remain present, then opens the URL in a browser and confirms the transformed page contains the sitemap heading, 182 visible rows, no console errors, no horizontal overflow at desktop and mobile widths, and stacked URL/date blocks on mobile.

- [x] **Step 2: Run the focused browser test**

Run against the built app according to `CLAUDE.md`:

```powershell
npm run build
npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/seo.spec.ts
```

Expected result: the sitemap XML stays valid and the browser displays the styled table at both tested widths.

- [x] **Step 3: Run the required completion checks**

From `apps/web`, run:

```powershell
npm run check
npm run build
git diff --check
```

Expected result: all checks pass with no unrelated tracked-file changes.

- [x] **Step 4: Review the final diff and commit the implementation**

Inspect `git status --short`, `git diff --stat`, and `git diff --check`. Stage only the sitemap implementation, tests, stylesheet, and plan files, then commit:

```powershell
git add apps/web/app/sitemap.xml/route.ts apps/web/lib/seo/sitemap.ts apps/web/public/sitemap.xsl apps/web/tests/seo/sitemapPresentation.test.ts apps/web/tests/seo/sitemapFreshness.test.ts apps/web/tests/seo/routes.test.ts apps/web/tests/seo/agentFiles.test.ts apps/web/tests/browser/seo.spec.ts docs/superpowers/plans/2026-09-06-sitemap-human-readable.md
git commit -m "feat: add human-readable sitemap presentation"
```
