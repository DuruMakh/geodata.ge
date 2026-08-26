# Fiscal.ge Remaining SEO Audit Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Fiscal.ge SEO audit improvements while preserving the current interface and static-data architecture.

**Architecture:** Separate public route slugs from numeric data IDs through one explicit registry; derive metadata/schema from reviewed served facts; make semantic accessibility changes without visual redesign; and reduce font/RSC cost only when reproducible build measurements prove improvement. Implementation is staged so URL migration, metadata/indexing, accessibility, and performance can be reviewed independently.

**Tech Stack:** Next.js 16.2 App Router, strict TypeScript, React, Tailwind CSS v4, Vitest, Playwright, static Vercel builds.

**Spec:** `docs/superpowers/specs/2026-08-24-fiscal-ge-seo-audit-improvements-design.md`

## Global Constraints

- Preserve the current Fiscal.ge design, layout, visible copy hierarchy, charts, map, controls, colors and typography.
- Keep numeric municipality codes as the CSV/database identity; use slugs only for public routes.
- Do not add visible SEO sections, English pages, crawler-only text/link collections, public APIs, or runtime database requests.
- Entity Dataset schema must omit `distribution` when no stable HTTP download exists.
- Search Console and GitHub/Vercel delivery are excluded.
- Run build/browser checks with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.
- Current verified baselines: expenditure HTML 606,208/RSC 497,871 bytes; municipality index HTML 671,189/RSC 273,265; analysis HTML 307,239/RSC 188,375; five font preloads totaling 190,264 bytes.

---

### Task 1: Add reproducible SEO output measurements

**Files:**
- Create: `apps/web/scripts/measure-seo-output.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/tests/seo/outputMeasurement.test.ts`

**Interfaces:**
- Consumes: `.next/server/app/**/*.html`, matching `.rsc` files, and `.next/static/media/*.woff2`.
- Produces: `measureSeoOutput(root): SeoOutputMeasurement[]` and `npm run seo:measure` JSON/text output.

- [ ] **Step 1: Write the failing measurement test**

Create a temporary fixture containing one HTML file, one RSC file and two font files. Assert exact byte counts and deduplicated font preload bytes:

```ts
expect(measureSeoOutput(fixtureRoot, ["/explorer/expenditure"])).toEqual([
  {
    route: "/explorer/expenditure",
    htmlBytes: 120,
    rscBytes: 40,
    fontPreloadCount: 2,
    fontPreloadBytes: 30,
  },
]);
```

- [ ] **Step 2: Run the focused test and verify failure**

```powershell
npm.cmd test -- tests/seo/outputMeasurement.test.ts
```

Expected: FAIL because `measure-seo-output.ts` does not exist.

- [ ] **Step 3: Implement the measurement helper and CLI**

Use `Buffer.byteLength`/file sizes, not JavaScript character counts. Measure exactly these routes:

```ts
export const AUDITED_ROUTES = [
  "/explorer/expenditure",
  "/explorer/municipalities",
  "/explorer/analysis",
] as const;

export type SeoOutputMeasurement = {
  route: string;
  htmlBytes: number;
  rscBytes: number;
  fontPreloadCount: number;
  fontPreloadBytes: number;
};
```

Resolve `/route` to `.next/server/app/route.html` and `.rsc`; extract only `<link rel="preload" ... as="font">` WOFF2 hrefs and sum their corresponding `.next/static/media` files once.

- [ ] **Step 4: Add the package command**

```json
"seo:measure": "tsx scripts/measure-seo-output.ts"
```

- [ ] **Step 5: Run the build and pin the baseline in the task report**

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'
npm.cmd run build
npm.cmd run seo:measure
```

Expected starting values are the five numbers in Global Constraints. Do not hardcode those values as permanent tests; the acceptance tests in Task 7 compare a captured before/after report.

- [ ] **Step 6: Commit the measurement harness**

```powershell
git add apps/web/scripts/measure-seo-output.ts apps/web/tests/seo/outputMeasurement.test.ts apps/web/package.json
git commit -m "test: measure Fiscal.ge SEO output cost"
```

---

### Task 2: Migrate municipality routes from codes to stable slugs

**Files:**
- Create: `apps/web/lib/explorer/municipalityRoutes.ts`
- Create: `apps/web/tests/explorer/municipalityRoutes.test.ts`
- Move: `apps/web/app/explorer/municipalities/[code]/page.tsx` -> `apps/web/app/explorer/municipalities/[slug]/page.tsx`
- Modify: `apps/web/lib/seo/internalLinks.ts`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/next.config.ts`
- Modify: municipality index, picker, map, region member and previous/next link callers
- Modify: numeric-route assertions across `apps/web/tests/browser/*.spec.ts` and `apps/web/tests/seo/*.test.ts`

**Interfaces:**
- Consumes: the exact 64 code/slug pairs in the spec.
- Produces: `MUNICIPALITY_ROUTES`, `municipalitySlugForCode(code)`, `municipalityCodeForSlug(slug)`, and `municipalityHrefForCode(code)`.

- [ ] **Step 1: Write registry tests before the registry**

Assert exact parity with the reviewed municipality file, uniqueness, syntax and representative mappings:

```ts
const rows = await loadMunicipalitiesFile("../../data/imports/municipalities.csv");
expect(MUNICIPALITY_ROUTES).toHaveLength(64);
expect(new Set(MUNICIPALITY_ROUTES.map((row) => row.code))).toEqual(new Set(rows.map((row) => row.code)));
expect(new Set(MUNICIPALITY_ROUTES.map((row) => row.slug)).size).toBe(64);
expect(MUNICIPALITY_ROUTES.every((row) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug))).toBe(true);
expect(municipalityHrefForCode("04")).toBe("/explorer/municipalities/tbilisi");
expect(municipalityCodeForSlug("chiatura")).toBe("21");
expect(municipalityCodeForSlug("unknown")).toBeNull();
```

- [ ] **Step 2: Run the focused test and verify failure**

```powershell
npm.cmd test -- tests/explorer/municipalityRoutes.test.ts
```

- [ ] **Step 3: Add the dependency-free explicit registry**

Use the exact list from the spec. The public API is:

```ts
export type MunicipalityRoute = { code: string; slug: string };
export const MUNICIPALITY_ROUTES: readonly MunicipalityRoute[] = [
  { code: "04", slug: "tbilisi" },
  { code: "06", slug: "batumi" },
  { code: "07", slug: "kobuleti" },
  { code: "08", slug: "khelvachauri" },
  { code: "09", slug: "keda" },
  { code: "10", slug: "shuakhevi" },
  { code: "11", slug: "khulo" },
  { code: "12", slug: "akhmeta" },
  { code: "13", slug: "gurjaani" },
  { code: "14", slug: "dedoplistskaro" },
  { code: "15", slug: "telavi" },
  { code: "16", slug: "lagodekhi" },
  { code: "17", slug: "sagarejo" },
  { code: "18", slug: "sighnaghi" },
  { code: "19", slug: "kvareli" },
  { code: "20", slug: "kutaisi" },
  { code: "21", slug: "chiatura" },
  { code: "22", slug: "tkibuli" },
  { code: "23", slug: "tskaltubo" },
  { code: "24", slug: "baghdati" },
  { code: "25", slug: "vani" },
  { code: "26", slug: "zestafoni" },
  { code: "27", slug: "terjola" },
  { code: "28", slug: "samtredia" },
  { code: "29", slug: "sachkhere" },
  { code: "30", slug: "kharagauli" },
  { code: "31", slug: "khoni" },
  { code: "32", slug: "poti" },
  { code: "33", slug: "zugdidi" },
  { code: "34", slug: "abasha" },
  { code: "35", slug: "martvili" },
  { code: "36", slug: "mestia" },
  { code: "37", slug: "senaki" },
  { code: "38", slug: "chkhorotsku" },
  { code: "39", slug: "tsalenjikha" },
  { code: "40", slug: "khobi" },
  { code: "41", slug: "gori" },
  { code: "44", slug: "kareli" },
  { code: "45", slug: "kaspi" },
  { code: "47", slug: "khashuri" },
  { code: "48", slug: "rustavi" },
  { code: "49", slug: "bolnisi" },
  { code: "50", slug: "gardabani" },
  { code: "51", slug: "dmanisi" },
  { code: "52", slug: "tetritskaro" },
  { code: "53", slug: "marneuli" },
  { code: "54", slug: "tsalka" },
  { code: "55", slug: "lanchkhuti" },
  { code: "56", slug: "ozurgeti" },
  { code: "57", slug: "chokhatauri" },
  { code: "58", slug: "borjomi" },
  { code: "59", slug: "adigeni" },
  { code: "60", slug: "aspindza" },
  { code: "61", slug: "akhalkalaki" },
  { code: "62", slug: "akhaltsikhe" },
  { code: "63", slug: "ninotsminda" },
  { code: "65", slug: "dusheti" },
  { code: "66", slug: "tianeti" },
  { code: "67", slug: "mtskheta" },
  { code: "68", slug: "kazbegi" },
  { code: "69", slug: "ambrolauri" },
  { code: "70", slug: "lentekhi" },
  { code: "71", slug: "oni" },
  { code: "72", slug: "tsageri" },
] as const;

const byCode = new Map(MUNICIPALITY_ROUTES.map((row) => [row.code, row.slug]));
const bySlug = new Map(MUNICIPALITY_ROUTES.map((row) => [row.slug, row.code]));

export function municipalitySlugForCode(code: string): string | null {
  return byCode.get(code) ?? null;
}
export function municipalityCodeForSlug(slug: string): string | null {
  return bySlug.get(slug) ?? null;
}
export function municipalityHrefForCode(code: string): `/explorer/municipalities/${string}` {
  const slug = municipalitySlugForCode(code);
  if (!slug) throw new Error(`Missing municipality route for code ${code}`);
  return `/explorer/municipalities/${slug}`;
}
```

- [ ] **Step 4: Change the dynamic page boundary to slugs**

In `[slug]/page.tsx`:

```ts
export const dynamicParams = false;

export async function generateStaticParams() {
  return MUNICIPALITY_ROUTES.map(({ slug }) => ({ slug }));
}

function requiredMunicipalityCode(slug: string): string {
  const code = municipalityCodeForSlug(slug);
  if (!code) notFound();
  return code;
}
```

Resolve `code` once at the top of `generateMetadata` and the page. Use `municipalityHrefForCode(code)` for canonical, breadcrumb JSON-LD and all previous/next/member links. Keep `entityId`, workbook basename and every data lookup numeric.

- [ ] **Step 5: Update all internal route construction**

Replace string interpolation of municipality codes with the helper in:

```text
lib/seo/internalLinks.ts
app/sitemap.ts
components/municipalities/municipalities-index.tsx
components/municipalities/entity-picker.tsx
components/municipalities/municipality-map.tsx
app/explorer/municipalities/region/[id]/page.tsx
```

Keep `georgia` and `/region/{id}` branches unchanged.

- [ ] **Step 6: Add 64 explicit 308 redirects**

Import the registry in `next.config.ts` and add:

```ts
async redirects() {
  return MUNICIPALITY_ROUTES.map(({ code, slug }) => ({
    source: `/explorer/municipalities/${code}`,
    destination: `/explorer/municipalities/${slug}`,
    permanent: true,
  }));
},
```

Next.js 16 uses status 308 for `permanent: true`. Sixty-four redirects are well below Vercel's documented 1,024 configuration limit.

- [ ] **Step 7: Add browser redirect and route inventory tests**

Generate tests from the registry:

```ts
for (const { code, slug } of MUNICIPALITY_ROUTES) {
  const oldResponse = await request.get(`${BASE_URL}/explorer/municipalities/${code}`, { maxRedirects: 0 });
  expect(oldResponse.status()).toBe(308);
  expect(oldResponse.headers().location).toBe(`/explorer/municipalities/${slug}`);
  expect((await request.get(`${BASE_URL}/explorer/municipalities/${slug}`)).status()).toBe(200);
}
```

Also assert one browser navigation from `/06#r=2016-2021` finishes on `/batumi#r=2016-2021`, unknown slug returns 404, sitemap contains all 64 slugs and zero numeric entity paths, and no redirect chain occurs.

- [ ] **Step 8: Run route-focused verification**

```powershell
npm.cmd test -- tests/explorer/municipalityRoutes.test.ts tests/seo/internalLinks.test.ts tests/seo/routes.test.ts
npm.cmd run build
npm.cmd run test:browser -- tests/browser/seo.spec.ts tests/browser/municipalities.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/methodology.spec.ts
```

- [ ] **Step 9: Commit the URL migration**

```powershell
git add apps/web/app apps/web/components/municipalities apps/web/lib/explorer/municipalityRoutes.ts apps/web/lib/seo apps/web/next.config.ts apps/web/tests
git commit -m "feat: add readable municipality URLs"
```

---

### Task 3: Complete entity metadata, Dataset schema and root URL contracts

**Files:**
- Create: `apps/web/lib/seo/municipalMetadata.ts`
- Create: `apps/web/tests/seo/municipalMetadata.test.ts`
- Create: `apps/web/public/fiscal-ge-logo.svg`
- Modify: `apps/web/lib/seo/metadata.ts`
- Modify: `apps/web/lib/seo/structuredData.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: expenditure, revenue, municipality index, municipality entity, region and Georgia pages
- Modify: `apps/web/tests/seo/metadata.test.ts`
- Modify: `apps/web/tests/seo/structuredData.test.ts`
- Modify: `apps/web/tests/browser/seo.spec.ts`

**Interfaces:**
- Consumes: route-scoped totals/functions, latest review date, canonical path and stable public CSV paths.
- Produces: pure 120–160 character Georgian descriptions, shorter unique region titles, optional-distribution explorer Dataset JSON-LD and complete Organization schema.

- [ ] **Step 1: Write failing description/title tests**

Create fixtures for all 64 municipalities, 11 regions, Adjara and Georgia. Assert:

```ts
expect(new Set(municipalityDescriptions).size).toBe(64);
expect(new Set(regionDescriptions).size).toBe(11);
expect([...municipalityDescriptions, ...regionDescriptions].every((text) => text.length >= 120 && text.length <= 160)).toBe(true);
expect(adjaraDescription).toContain("6 მუნიციპალიტეტ");
expect(adjaraDescription).toContain("შიდა ტრანსფერ");
expect(adjaraDescription).not.toContain("ყველაზე დიდი ფუნქციური");
expect(georgiaDescription).toContain("69");
expect(regionBudgetTitleKa("იმერეთის", 2015, 2025)).toBe("იმერეთის ბიუჯეტი 2015–2025 | Fiscal.ge");
```

- [ ] **Step 2: Implement pure municipal metadata helpers**

Define explicit inputs so metadata never reloads or guesses facts:

```ts
export type RankedEntitySeoInput = {
  nameKa: string;
  firstYear: number;
  latestYear: number;
  latestTotalGel: number;
  rank: number;
  rankOutOf: 64 | 11;
  largestCategoryKa: string;
  largestCategoryShare: number;
};

export function municipalityDescriptionKa(input: RankedEntitySeoInput): string;
export function regionDescriptionKa(input: RankedEntitySeoInput): string;
export function adjaraDescriptionKa(input: Omit<RankedEntitySeoInput, "largestCategoryKa" | "largestCategoryShare">): string;
export function georgiaDescriptionKa(input: { firstYear: number; latestYear: number; latestTotalGel: number }): string;
export function regionBudgetTitleKa(regionGenitiveKa: string, firstYear: number, lastYear: number): string;
```

Use existing `formatAmount`, `formatShare` and `georgianOrdinal`; do not duplicate number formatting.

- [ ] **Step 3: Reuse page-computed facts in metadata**

For municipality/region pages, extract a small server helper per route that calculates coverage, latest total, rank and largest function from served data. Call it from both `generateMetadata` and page rendering. Adjara must bypass largest-function copy; Georgia must use 69 reviewed units plus the existing Adjara adjustment semantics.

- [ ] **Step 4: Make canonical/Open Graph URLs absolute**

Change `fiscalMetadata` to use the canonical origin:

```ts
const absolute = new URL(path, `${resolveSiteUrl()}/`).href;
return {
  // ...
  alternates: { canonical: absolute },
  openGraph: { /* existing fields */ url: absolute },
};
```

Update unit tests to expect `https://fiscal.ge/` for `/` and `https://fiscal.ge/explorer/expenditure` for non-root routes. This fixes the built root slash mismatch without adding trailing slashes elsewhere.

- [ ] **Step 5: Add flexible explorer/entity Dataset JSON-LD**

Add a new helper rather than weakening the existing methodology contract:

```ts
export type ExplorerDatasetJsonLdInput = {
  origin: string;
  path: `/${string}`;
  name: string;
  description: string;
  firstYear: number;
  lastYear: number;
  dateModified: string;
  spatialCoverageName: string;
  downloadPath?: `/downloads/data/${string}.csv`;
};
```

Return `@id: absoluteUrl(origin, path) + "#dataset"`, publisher/creator references, CC BY 4.0, real temporal/spatial coverage and `distribution` only when `downloadPath` exists.

Render it server-side on:

```text
/explorer/expenditure -> national-expenditure.csv
/explorer/revenue -> national-revenue.csv
/explorer/municipalities -> municipal-expenditure.csv
64 municipality pages -> no distribution
11 region pages -> no distribution
/explorer/municipalities/georgia -> no distribution
```

Do not add a separate Dataset node to `/explorer/analysis`.

- [ ] **Step 6: Complete Organization schema**

Create a 512 by 512 SVG using only existing design tokens (paper background, ink mark/text and terracotta accent). Add:

```ts
description: "Fiscal.ge საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებულ მონაცემებს ქართულად აქვეყნებს.",
logo: {
  "@type": "ImageObject",
  url: `${origin}/fiscal-ge-logo.svg`,
  width: 512,
  height: 512,
},
```

Do not add `sameAs` or `SearchAction`.

- [ ] **Step 7: Add structured-data and rendered-head coverage**

Unit tests parse every node, assert stable `#dataset` IDs, entity nodes lack `distribution`, stable CSV nodes have correct 200-target paths, Organization logo is absolute, and site graph contains neither `sameAs` nor `SearchAction`.

Browser tests assert root canonical/OG are exactly `https://fiscal.ge/`, all representative slug/entity canonicals are final URLs, and `/fiscal-ge-logo.svg` returns 200 with an SVG content type.

- [ ] **Step 8: Run focused verification and commit**

```powershell
npm.cmd test -- tests/seo/metadata.test.ts tests/seo/municipalMetadata.test.ts tests/seo/structuredData.test.ts
npm.cmd run build
npm.cmd run test:browser -- tests/browser/seo.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/municipal-georgia.spec.ts
git add apps/web
git commit -m "feat: complete Fiscal.ge entity SEO metadata"
```

---

### Task 4: Add narrow indexing headers and protect the crawl graph

**Files:**
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/tests/seo/nextConfig.test.ts`
- Modify: `apps/web/tests/browser/seo.spec.ts`

**Interfaces:**
- Consumes: Next.js `headers()` and the existing route registry/crawl links.
- Produces: a methodology-original-only `X-Robots-Tag` rule and regression proof that processed datasets/pages remain indexable.

- [ ] **Step 1: Write a failing config test**

Load the exported Next config, call `headers()`, and assert a rule exactly equal to:

```ts
{
  source: "/downloads/methodology/:dataset/files/:path*",
  headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
}
```

Also assert no matching rule exists for `/downloads/data/:path*` or `/methodology/:path*`.

- [ ] **Step 2: Add the narrow header before the general security rule**

Return both rules from `headers()`. Do not add a robots.txt disallow.

- [ ] **Step 3: Add HTTP and crawl-graph browser assertions**

Request one real methodology original, one processed CSV and one methodology HTML page:

```ts
expect(original.headers()["x-robots-tag"]).toBe("noindex, follow");
expect(processed.headers()["x-robots-tag"]).toBeUndefined();
expect(methodologyPage.headers()["x-robots-tag"]).toBeUndefined();
```

Retain the raw-index assertions for exactly one Georgia and 11 region links, update municipality href expectations to slugs, and assert 64 slug municipality links remain in server HTML.

- [ ] **Step 4: Prove source bytes are untouched**

Reuse the methodology archive checks:

```powershell
npm.cmd test -- tests/methodology/prepareArchives.test.ts tests/methodology/sourceInventory.test.ts tests/seo/nextConfig.test.ts
npm.cmd run test:browser -- tests/browser/seo.spec.ts tests/browser/methodology.spec.ts
```

- [ ] **Step 5: Commit the indexing boundary**

```powershell
git add apps/web/next.config.ts apps/web/tests/seo/nextConfig.test.ts apps/web/tests/browser/seo.spec.ts
git commit -m "fix: noindex third-party source originals"
```

---

### Task 5: Correct headings, municipal H1 text and table semantics

**Files:**
- Modify: `apps/web/components/hub/budget-hub.tsx`
- Modify: `apps/web/components/analysis/{treemap,every-100,radar,budget-field,ranking}.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/components/main-explorer/explorer-table.tsx`
- Modify: `apps/web/components/main-explorer/indicators.tsx`
- Modify: `apps/web/components/municipalities/municipal-indicators.tsx`
- Modify: `apps/web/components/analysis/ranking.tsx`
- Modify: `apps/web/components/landing/landing-dataset-section.tsx`
- Modify: `apps/web/components/methodology/source-archive.tsx`
- Modify: relevant browser tests in `main-explorer.spec.ts`, `municipal-entity.spec.ts`, `landing.spec.ts`, `methodology.spec.ts`, and `seo.spec.ts`

**Interfaces:**
- Consumes: current model labels, entity/scope, selected measure and range.
- Produces: visually unchanged H2 hierarchy, caret-free accessible H1 text and state-aware captions.

- [ ] **Step 1: Add failing semantic browser assertions**

```ts
await expect(page.locator("main h1")).toHaveCount(1);
await expect(page.locator("main h2")).toHaveCount(5); // analysis sections
await expect(page.getByTestId("hub-card").locator("h2")).toHaveCount(1);
await expect(page.locator("h1")).not.toContainText(/[▾▴]/);
await expect(page.locator("table caption")).not.toHaveCount(0);
```

Add caption text assertions after changing entity, measure, range and analysis side/year.

- [ ] **Step 2: Change elements without changing classes**

- `CardBody`: replace the title `<p>` with `<h2>` and keep the class string byte-for-byte.
- Replace the five top-level analysis component `<h3>` tags with `<h2>` and keep class strings.
- Do not change nested headings such as mover labels that are not top-level analysis sections.

- [ ] **Step 3: Replace the H1 caret glyph with a CSS shape**

In `MunicipalExplorer`, replace the glyph span with:

```tsx
<span
  aria-hidden="true"
  className={`ml-1 inline-block h-0 w-0 border-x-[4px] border-x-transparent ${
    pickerOpen ? "border-b-[5px] border-b-current" : "border-t-[5px] border-t-current"
  }`}
/>
```

Keep the existing button, `aria-expanded`, keyboard behavior and picker state. The H1 text content must end with `triggerLabel`.

- [ ] **Step 4: Add explicit caption props to reusable tables**

Update `ExplorerTable` to require `caption: string` and render:

```tsx
<table ...>
  <caption className="sr-only">{caption}</caption>
  {/* existing table children */}
</table>
```

Pass captions that name scope/entity, measure and selected range. Example:

```ts
`${props.triggerLabel} — ${state.share ? "წილი მთლიან ბიუჯეტში" : "ხარჯები ლარში"}, ${state.range.start}–${state.range.end}`
```

- [ ] **Step 5: Caption all remaining concrete tables**

Add `sr-only` captions to:

```text
main-explorer/indicators.tsx -> scope + comparison + selected range
municipalities/municipal-indicators.tsx -> entity + comparison + selected range
analysis/ranking.tsx -> side/grouping + year
landing/landing-dataset-section.tsx -> dataset title + coverage
methodology/source-archive.tsx -> dataset + source archive
```

Thread only the smallest missing label/year props; do not add visible text or new state.

- [ ] **Step 6: Run semantic and visual regression tests**

```powershell
npm.cmd run typecheck
npm.cmd run test:browser -- tests/browser/seo.spec.ts tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/landing.spec.ts tests/browser/methodology.spec.ts
```

Capture 1440px and 390px screenshots of hub, analysis and municipality pages and compare with the pre-change screenshots; semantic-only changes must have no meaningful pixel difference.

- [ ] **Step 7: Commit semantic fixes**

```powershell
git add apps/web/components apps/web/tests/browser
git commit -m "fix: improve Fiscal.ge document semantics"
```

---

### Task 6: Increase breadcrumb and footer mobile tap targets

**Files:**
- Modify: `apps/web/components/seo/breadcrumb-json-ld.tsx`
- Modify: `apps/web/components/shell/page-header.tsx`
- Modify: `apps/web/components/site/site-footer.tsx`
- Modify: `apps/web/tests/browser/seo.spec.ts`
- Modify: `apps/web/tests/browser/landing.spec.ts`

**Interfaces:**
- Consumes: existing links and focus styles.
- Produces: non-overlapping target rectangles at least 24 by 24 CSS pixels at 375px and 390px.

- [ ] **Step 1: Add target-geometry helpers and failing tests**

```ts
async function expectMinimumTarget(locator: Locator, size = 24) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(size);
  expect(box!.height).toBeGreaterThanOrEqual(size);
}
```

Run at viewports 375x812 and 390x844 for every breadcrumb/footer link. Compare rectangles pairwise and assert they do not overlap; assert `document.documentElement.scrollWidth <= innerWidth`.

- [ ] **Step 2: Apply the smallest layout-neutral classes**

Use `inline-flex min-h-6 items-center` on breadcrumb links and `inline-flex min-h-6 items-center self-start` on footer links. If the email width is below 24px in the actual font, add `min-w-6`. Keep separator margins and footer grid/gaps unchanged.

- [ ] **Step 3: Verify focus and desktop layout**

Tab through both areas, assert `:focus-visible` is visible, and compare 1440px footer/header screenshots. If minimum heights create a significant visual gap, use a positioned pseudo-element hit area only where the test proves adjacent rectangles still do not overlap.

- [ ] **Step 4: Run focused tests and commit**

```powershell
npm.cmd run test:browser -- tests/browser/seo.spec.ts tests/browser/landing.spec.ts
git add apps/web/components/seo/breadcrumb-json-ld.tsx apps/web/components/shell/page-header.tsx apps/web/components/site/site-footer.tsx apps/web/tests/browser
git commit -m "fix: enlarge Fiscal.ge navigation targets"
```

---

### Task 7: Reduce font preloads and browser-dead RSC data

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/lib/explorer/clientData.ts`
- Create: `apps/web/tests/explorer/clientData.test.ts`
- Modify: `apps/web/lib/servedRows.ts`
- Modify: `apps/web/lib/data/activeFacts.ts`
- Modify: `apps/web/lib/explorer/explorerData.ts`
- Modify: `apps/web/lib/explorer/singleYear.ts`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: expenditure, revenue and analysis route pages
- Modify: relevant explorer/unit/browser tests

**Interfaces:**
- Consumes: full served rows on the server.
- Produces: `ClientBudgetFact`, `ClientAdminFact`, `ClientNationalGdpFact` and projection helpers containing only fields read in browser models.

- [ ] **Step 1: Capture the pre-change measurement and font screenshots**

```powershell
$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'
npm.cmd run build
npm.cmd run seo:measure > seo-before.txt
```

At 1440px and 390px capture homepage, expenditure, municipality index and analysis. Record computed `font-family`, `font-weight`, line count and bounding boxes for H1, body copy, table numerals and footer.

- [ ] **Step 2: Write failing client-projection tests**

```ts
expect(projectBudgetFact(fullBudgetFact)).toEqual({
  year: fullBudgetFact.year,
  side: fullBudgetFact.side,
  itemId: fullBudgetFact.itemId,
  amountGel: fullBudgetFact.amountGel,
  basis: fullBudgetFact.basis,
});
expect(projectAdminFact(fullProgramFact)).not.toHaveProperty("sourceId");
expect(projectAdminFact(fullProgramFact)).not.toHaveProperty("officialInstitutionLabelKa");
expect(projectAdminFact(fullCategoryFact).officialLabelKa).toBeNull();
expect(projectGdpFact(fullGdpFact)).not.toHaveProperty("sourceId");
```

- [ ] **Step 3: Add narrow browser DTOs**

```ts
export type ClientBudgetFact = Omit<ServedBudgetFact, "sourceId">;
export type ClientAdminFact = Omit<ServedAdminFact, "sourceId" | "officialInstitutionLabelKa">;
export type ClientNationalGdpFact = Omit<ServedNationalGdpFact, "sourceId">;
```

Projection rules:

- preserve `officialLabelKa` only for `major_program`; category labels come from `adminCategories`;
- keep GDP accounting standard/status because the explorer model and preliminary-data note read them;
- keep full server served rows for review-date/source calculations, then project immediately before passing props to `MainExplorer`.

Generalize `chooseActivePublicFacts` to a minimal structural constraint containing `year`, `side`, `itemId` and `basis`; remove the unused `sourceId` member from internal `ModelFact`/`SnapshotFact` types and mappings.

- [ ] **Step 4: Prove model and export parity**

Run the same fixtures through full and projected inputs and assert deep equality for:

```text
buildExplorerModel output
buildSingleYearSnapshotModel output
initial selected series
all supported year ranges/groupings/measures
workbook export model
```

The route still computes `lastUpdatedAt` from full rows before projection.

- [ ] **Step 5: Trial selective font preload**

First set `preload: false` only on `Geist_Mono`; build, measure and compare computed fonts/wrapping. If the byte reduction is small but safe, then trial `preload: false` on `Noto_Serif_Georgian` while keeping the primary Noto Sans Georgian UI font preloaded. Retain the smallest-preload candidate that meets all of:

```text
fewer than five preloads
fewer than 190,264 preload bytes
no newly introduced synthetic weight compared with the all-preload baseline
identical computed font families and line wrapping after load
no meaningful screenshot difference
no worse CLS/fallback flash in the Playwright trace
```

Do not change font families, weights or `display: "swap"` in this task.

- [ ] **Step 6: Build and enforce payload acceptance**

```powershell
npm.cmd run build
npm.cmd run seo:measure > seo-after.txt
```

Calculate per-route percentage as `(beforeHtml - afterHtml) / beforeHtml * 100`. Require at least one audited route >=20%, every audited route >-5% (no more than 5% growth), and no increase in blocking JavaScript from the build/browser trace.

If the DTO projection misses 20%, stop this task and report the measured gap. Create a separate approved design for lazy static chunks; do not add fetches or generated public data inside this SEO batch.

- [ ] **Step 7: Run full affected tests and commit only accepted changes**

```powershell
npm.cmd test -- tests/explorer/clientData.test.ts tests/explorer/explorerData.test.ts tests/explorer/singleYear.test.ts tests/explorer/workbookModel.test.ts
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts tests/browser/municipalities.spec.ts tests/browser/seo.spec.ts
git add apps/web/app apps/web/components/main-explorer apps/web/lib apps/web/tests
git commit -m "perf: reduce Fiscal.ge critical payloads"
```

---

### Task 8: Run complete verification and prepare the evidence report

**Files:**
- Create: `docs/seo/2026-08-24-remaining-audit-verification.md`
- Modify only if a verification failure directly traces to this implementation.

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: local evidence report only; no push, PR, merge or deployment.

- [ ] **Step 1: Run the complete local gates**

```powershell
cd apps/web
$env:NEXT_PUBLIC_SITE_URL='https://fiscal.ge'
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
npm.cmd run seo:measure
cd ../..
git diff --check
```

All commands must exit 0. Record exact unit/browser test counts and the 93-page-or-updated static route inventory.

- [ ] **Step 2: Recheck every audit invariant**

Record machine-readable evidence for:

```text
64 slug 200s; 64 one-hop 308s; unknown slug 404
sitemap/canonical/OG/Breadcrumb/Dataset final slug URLs
64/11 unique description counts and length bounds
Adjara/Georgia special-case strings
Dataset nodes and absent fictional entity distributions
source-original header boundary
root trailing slash alignment
heading counts, H1 text and six caption families
375/390 target rectangles and overflow
font count/bytes and computed font checks
before/after HTML/RSC/JS measurements
64 + 1 + 11 raw index crawl links
zero browser console warnings/errors
desktop/mobile screenshot comparison
```

- [ ] **Step 3: Inspect the final worktree boundary**

```powershell
git status --short
git diff --stat
git diff --check
```

Confirm generated `.next`, `node_modules`, temporary screenshots and `seo-before.txt`/`seo-after.txt` are not staged. Preserve any pre-existing user changes.

- [ ] **Step 4: Write the verification report**

`docs/seo/2026-08-24-remaining-audit-verification.md` must include:

- audit item-by-item outcome;
- exact UI impact (expected: semantic-only plus subtle hit-area changes);
- examples `04 -> tbilisi`, `06 -> batumi`, `21 -> chiatura`;
- redirect and hash evidence;
- before/after HTML, RSC, preload bytes and blocking JS;
- schema coverage and omitted entity downloads;
- exact test counts/results;
- any deferred/blocked item;
- any detected visual difference;
- explicit statement that live production and Search Console were not verified.

- [ ] **Step 5: Commit the report**

```powershell
git add docs/seo/2026-08-24-remaining-audit-verification.md
git commit -m "docs: verify remaining Fiscal.ge SEO audit"
```

Do not push, open a PR, merge or deploy in this plan.
