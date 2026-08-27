# Fiscal.ge Brand Kit v2.0 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the reviewed Fiscal.ge Brand Kit v2.0 assets into the platform header, Explorer shell, footer, browser metadata, structured data, and social image without changing the approved hero or data experience.

**Architecture:** Keep branding at the existing shared presentation boundaries: `SiteHeader`, `SiteFooter`, `DataSidebar`, App Router metadata files, Organization JSON-LD, and the generated Open Graph image. Use reviewed static assets directly, native responsive `<picture>` selection for the public header, and test the exact asset bytes plus rendered browser behavior rather than adding a new branding framework.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.8, strict TypeScript, Tailwind CSS v4, Vitest 4.1.5, Playwright 1.60, Sharp 0.35.3.

**Spec:** `docs/superpowers/specs/2026-08-27-fiscal-brand-integration-design.md`

## Global Constraints

- Brand Kit source package: `C:\Users\Mylaptop\Downloads\Fiscal.ge_Brand_Kit_2026 (2).zip`.
- Full horizontal lockups render at no less than 280px; marks render at no less than 24px.
- The full descriptor is always `საქართველოს მონაცემების პორტალი`.
- Preserve the existing palette, typography, homepage hero, route copy, navigation behavior, datasets, tables, charts, downloads, and workbook creator metadata.
- Do not add logos to the hero, charts, tables, maps, tooltips, dataset cards, Excel cells, or methodology CSVs.
- Keep `/fiscal-ge-logo.svg` stable for Organization JSON-LD.
- Keep `GEODATA_DATA_SOURCE`, `geodata_id`, `geodata_decision`, `geodata-ge`, and `geodata:sidebar-collapsed` unchanged.
- Use outlined, non-editable SVG exports; do not ship the PDF, editable SVGs, token exports, or redundant PNG logo variants.
- Add no runtime dependency.
- Run commands from `apps/web` with `npm.cmd` on Windows.

---

### Task 1: Install and lock the reviewed runtime brand assets

**Files:**
- Create: `apps/web/public/brand/fiscal-logo-horizontal.svg`
- Create: `apps/web/public/brand/fiscal-logo-compact.svg`
- Create: `apps/web/public/brand/fiscal-logo-mark-reversed.svg`
- Replace: `apps/web/public/fiscal-ge-logo.svg`
- Replace: `apps/web/app/favicon.ico`
- Create: `apps/web/app/icon.svg`
- Create: `apps/web/app/apple-icon.png`
- Create: `apps/web/tests/branding/brandAssets.test.ts`

**Interfaces:**
- Consumes: reviewed files inside `brandkit/assets/` in the supplied ZIP.
- Produces: stable public URLs `/brand/fiscal-logo-horizontal.svg`, `/brand/fiscal-logo-compact.svg`, `/brand/fiscal-logo-mark-reversed.svg`, and `/fiscal-ge-logo.svg`; App Router icon metadata files.

- [ ] **Step 1: Write the failing asset-integrity test**

Create `apps/web/tests/branding/brandAssets.test.ts`:

```ts
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const assets = [
  ["public/brand/fiscal-logo-horizontal.svg", "219236e7dc8f2c6f3c1fdbdda0ba53aba97305987ace07f2c1573f4c9697a3e5"],
  ["public/brand/fiscal-logo-compact.svg", "a2bda77adb7339299908a5340b5dbd7cbe265520e23d0ffe165b78a3a63086e1"],
  ["public/brand/fiscal-logo-mark-reversed.svg", "14556ca9f06ddd62f9c217d2b9287458eedc8fae2f20278e460aefc82a0968d7"],
  ["public/fiscal-ge-logo.svg", "f1456b9be13675cfb0d101c741d73d06fd1cec10c579a05afbe3a5fd0c67d587"],
  ["app/favicon.ico", "c460ed1578aba6e7c518f9936ee00c29460ad45c0a3d9900a0fbf373143dad0f"],
  ["app/icon.svg", "f1456b9be13675cfb0d101c741d73d06fd1cec10c579a05afbe3a5fd0c67d587"],
  ["app/apple-icon.png", "6e7a0d8f37ee0d23721b72fb52f49b6f49ce01a4dd660c3209ab01b05ac84096"],
] as const;

describe("Fiscal.ge Brand Kit v2.0 runtime assets", () => {
  it.each(assets)("keeps the reviewed bytes for %s", async (relativePath, expectedHash) => {
    const bytes = await readFile(join(process.cwd(), relativePath));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedHash);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run from `apps/web`:

```powershell
npm.cmd test -- tests/branding/brandAssets.test.ts
```

Expected: FAIL because the new `public/brand` assets and App Router icon files do not exist and the existing logo/favicon bytes do not match Brand Kit v2.0.

- [ ] **Step 3: Extract only the approved runtime assets**

From the repository root, extract the ZIP to a task-specific temporary directory, then copy only the mapped files:

```powershell
$brandTemp = 'C:\Users\Mylaptop\.codex\worktrees\448f\Geodata.ge\tmp\brand-kit-v2-implementation'
New-Item -ItemType Directory -Force -Path $brandTemp | Out-Null
tar -xf 'C:\Users\Mylaptop\Downloads\Fiscal.ge_Brand_Kit_2026 (2).zip' -C $brandTemp
New-Item -ItemType Directory -Force -Path 'apps\web\public\brand' | Out-Null
Copy-Item -LiteralPath "$brandTemp\brandkit\assets\fiscal-logo-horizontal.svg" -Destination 'apps\web\public\brand\fiscal-logo-horizontal.svg'
Copy-Item -LiteralPath "$brandTemp\brandkit\assets\fiscal-logo-compact.svg" -Destination 'apps\web\public\brand\fiscal-logo-compact.svg'
Copy-Item -LiteralPath "$brandTemp\brandkit\assets\fiscal-logo-mark-reversed.svg" -Destination 'apps\web\public\brand\fiscal-logo-mark-reversed.svg'
Copy-Item -LiteralPath "$brandTemp\brandkit\assets\fiscal-logo-mark.svg" -Destination 'apps\web\public\fiscal-ge-logo.svg' -Force
Copy-Item -LiteralPath "$brandTemp\brandkit\assets\favicon.ico" -Destination 'apps\web\app\favicon.ico' -Force
Copy-Item -LiteralPath "$brandTemp\brandkit\assets\favicon.svg" -Destination 'apps\web\app\icon.svg'
Copy-Item -LiteralPath "$brandTemp\brandkit\assets\apple-touch-icon-180.png" -Destination 'apps\web\app\apple-icon.png'
```

Do not copy `fiscal-brand-tokens.json`: its stale 180px horizontal minimum conflicts with the approved 280px rule.

- [ ] **Step 4: Run the asset test and confirm it passes**

Run:

```powershell
npm.cmd test -- tests/branding/brandAssets.test.ts
```

Expected: PASS for all seven reviewed hashes.

- [ ] **Step 5: Commit the reviewed asset boundary**

```powershell
git add apps/web/public/brand apps/web/public/fiscal-ge-logo.svg apps/web/app/favicon.ico apps/web/app/icon.svg apps/web/app/apple-icon.png apps/web/tests/branding/brandAssets.test.ts
git commit -m "feat: add reviewed Fiscal.ge brand assets"
```

---

### Task 2: Replace text-only public header and footer identities

**Files:**
- Modify: `apps/web/components/site/site-header.tsx:15-44`
- Modify: `apps/web/components/site/site-footer.tsx:5-53`
- Modify: `apps/web/tests/browser/landing.spec.ts:139-347`

**Interfaces:**
- Consumes: `/brand/fiscal-logo-horizontal.svg` and `/brand/fiscal-logo-compact.svg` from Task 1.
- Produces: `data-testid="site-header-logo"`, `data-testid="site-footer-logo"`, and one accessible home link named `Fiscal.ge — მთავარი` in each shared surface.

- [ ] **Step 1: Add failing responsive and accessibility browser coverage**

Append to `apps/web/tests/browser/landing.spec.ts`:

```ts
test("shared brand identity uses the full desktop lockup and compact mobile lockup", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 900, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 768, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 767, height: 900, asset: "fiscal-logo-compact.svg", minimumWidth: 118 },
    { width: 390, height: 844, asset: "fiscal-logo-compact.svg", minimumWidth: 118 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const logo = page.getByTestId("site-header-logo");
    await expect(logo).toBeVisible();
    expect(await logo.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain(viewport.asset);
    expect((await logo.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(viewport.minimumWidth);
    await expect(page.getByTestId("landing-header").getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true })).toHaveCount(1);
    await expect(logo).toHaveAttribute("alt", "");
  }
});

test("shared footer uses the compact logo without changing its trust content", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByTestId("site-footer");
  await expect(footer.getByTestId("site-footer-logo")).toHaveAttribute("src", "/brand/fiscal-logo-compact.svg");
  await expect(footer.getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true })).toHaveCount(1);
  await expect(footer).toContainText("info@fiscal.ge");
  await expect(footer).toContainText("CC BY 4.0");
});
```

- [ ] **Step 2: Run the two tests and confirm they fail**

Run:

```powershell
npm.cmd run test:browser -- landing.spec.ts --grep "shared brand identity|shared footer uses"
```

Expected: FAIL because the header/footer test IDs, image sources, and accessible home links do not exist.

- [ ] **Step 3: Implement native responsive selection in `SiteHeader`**

Replace the text-only brand span with this named link and picture. Preserve the existing nav and year label:

```tsx
<Link
  href="/"
  aria-label="Fiscal.ge — მთავარი"
  className="block aspect-[1080/340] w-[118px] flex-none min-[768px]:aspect-[1600/545] min-[768px]:w-[280px]"
>
  <picture>
    <source
      media="(max-width: 767px)"
      srcSet="/brand/fiscal-logo-compact.svg"
    />
    <img
      data-testid="site-header-logo"
      src="/brand/fiscal-logo-horizontal.svg"
      width="1600"
      height="545"
      alt=""
      className="block h-full w-full object-contain"
    />
  </picture>
</Link>
```

Change the header alignment from baseline alignment to centered alignment, then keep the active underline touching the existing bottom rule. Verify the nav does not wrap at 768px before changing any nav spacing.

- [ ] **Step 4: Implement the compact footer signature**

Replace only the first text-only `Fiscal.ge` span in `SiteFooter`:

```tsx
<Link href="/" aria-label="Fiscal.ge — მთავარი" className="block w-[150px]">
  <img
    data-testid="site-footer-logo"
    src="/brand/fiscal-logo-compact.svg"
    width="1080"
    height="340"
    alt=""
    className="block h-auto w-full"
  />
</Link>
```

Do not change the footer description, email, navigation links, source/update copy, copyright, or licence.

- [ ] **Step 5: Run focused header/footer tests**

Run:

```powershell
npm.cmd run test:browser -- landing.spec.ts --grep "shared brand identity|shared footer uses|footer links|methodology is in the footer"
```

Expected: PASS at desktop, tablet, and mobile widths with the original footer behavior preserved.

- [ ] **Step 6: Commit the shared public identity**

```powershell
git add apps/web/components/site/site-header.tsx apps/web/components/site/site-footer.tsx apps/web/tests/browser/landing.spec.ts
git commit -m "feat: brand the shared header and footer"
```

---

### Task 3: Integrate the reversed mark into the Explorer shell

**Files:**
- Modify: `apps/web/components/shell/data-sidebar.tsx:98-182`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts:1155-1244`

**Interfaces:**
- Consumes: `/brand/fiscal-logo-mark-reversed.svg` from Task 1.
- Produces: `data-testid="sidebar-brand-mark"` in expanded desktop and mobile top-bar states; keeps the existing collapsed-rail home affordance.

- [ ] **Step 1: Extend existing sidebar browser coverage with failing assertions**

Add this test near the current sidebar tests in `main-explorer.spec.ts`:

```ts
test("Explorer branding uses the reversed mark without changing shell behavior", async ({ page }) => {
  for (const viewport of [
    { width: 1200, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/explorer/expenditure");
    const sidebar = page.getByTestId("data-sidebar");
    const home = sidebar.getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true });
    const mark = sidebar.getByTestId("sidebar-brand-mark");
    await expect(home).toHaveCount(1);
    await expect(mark).toHaveAttribute("src", "/brand/fiscal-logo-mark-reversed.svg");
    await expect(mark).toHaveAttribute("alt", "");
    expect((await mark.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(24);
    await expect(home).toContainText("Fiscal.ge");
    await expect(home).toContainText("ღია მონაცემები");
  }
});
```

In the existing collapse test, add:

```ts
await expect(page.getByTestId("sidebar-brand-mark")).toHaveCount(0);
await expect(page.getByRole("link", { name: "მთავარი", exact: true })).toBeVisible();
```

- [ ] **Step 2: Run the focused sidebar tests and confirm failure**

Run:

```powershell
npm.cmd run test:browser -- main-explorer.spec.ts --grep "Explorer branding|sidebar collapses|sidebar is a full-width"
```

Expected: FAIL because the reversed mark and accessible brand-link name are absent.

- [ ] **Step 3: Replace the expanded/mobile text-only brand block**

Inside the existing `railed ? null : (...)` branch, use:

```tsx
<Link
  href="/"
  aria-label="Fiscal.ge — მთავარი"
  className="flex min-w-0 items-center gap-2.5 no-underline"
>
  <img
    data-testid="sidebar-brand-mark"
    src="/brand/fiscal-logo-mark-reversed.svg"
    width="520"
    height="650"
    alt=""
    className="h-auto w-[30px] flex-none"
  />
  <span className="flex min-w-0 flex-col gap-0.5">
    <span className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--paper)]">
      Fiscal.ge
    </span>
    <span className="font-[family-name:var(--font-numeric)] text-[8.5px] tracking-[0.1em] text-[var(--ink-fg-faint)]">
      ღია მონაცემები
    </span>
  </span>
</Link>
```

Keep the existing toggle as a sibling. Do not alter the `railed` branch, storage key, width transition, mobile sheet, Escape handling, or focus return.

- [ ] **Step 4: Run focused sidebar tests and the shell hydration test**

Run:

```powershell
npm.cmd run test:browser -- main-explorer.spec.ts --grep "Explorer branding|sidebar collapses|sidebar is a full-width|explorer hydrates"
```

Expected: PASS with the existing 232px/52px shell contracts unchanged.

- [ ] **Step 5: Commit the Explorer identity**

```powershell
git add apps/web/components/shell/data-sidebar.tsx apps/web/tests/browser/main-explorer.spec.ts
git commit -m "feat: brand the Explorer sidebar"
```

---

### Task 4: Update structured, browser, and social identity

**Files:**
- Modify: `apps/web/app/opengraph-image.tsx:1-51`
- Modify: `apps/web/lib/seo/structuredData.ts:43-55`
- Modify: `apps/web/tests/seo/opengraphImage.test.ts:1-36`
- Modify: `apps/web/tests/seo/structuredData.test.ts:11-39`
- Modify: `apps/web/tests/browser/seo.spec.ts:93-225`

**Interfaces:**
- Consumes: reviewed mark, full horizontal lockup, reversed mark, and App Router icon files from Task 1.
- Produces: unchanged 1200×630 PNG contract, visible Brand Kit colors, stable Organization logo URL with accurate 520×650 dimensions, generated icon and Apple-touch link tags.

- [ ] **Step 1: Strengthen the Open Graph test before implementation**

Decode the full PNG for dimensions and brand-color coverage, then keep a separate crop for the existing Georgian-glyph check:

```ts
const fullImage = await sharp(png)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

function countPixelsNear(
  data: Buffer,
  channels: number,
  target: readonly [number, number, number],
  tolerance = 3,
) {
  let count = 0;
  for (let offset = 0; offset < data.length; offset += channels) {
    if (
      Math.abs(data[offset] - target[0]) <= tolerance &&
      Math.abs(data[offset + 1] - target[1]) <= tolerance &&
      Math.abs(data[offset + 2] - target[2]) <= tolerance
    ) count += 1;
  }
  return count;
}

expect(fullImage.info.width).toBe(1200);
expect(fullImage.info.height).toBe(630);
expect(countPixelsNear(fullImage.data, fullImage.info.channels, [179, 64, 42])).toBeGreaterThan(500);
expect(countPixelsNear(fullImage.data, fullImage.info.channels, [31, 110, 86])).toBeGreaterThan(150);
expect(countPixelsNear(fullImage.data, fullImage.info.channels, [144, 104, 69])).toBeGreaterThan(100);
```

Keep the existing distinct-Georgian-glyph assertion and 20-second timeout.

- [ ] **Step 2: Add failing browser metadata coverage**

Add to `seo.spec.ts`:

```ts
test("root metadata publishes the reviewed browser and Apple icons", async ({ page, request }) => {
  await page.goto(`${BASE_URL}/`);
  const iconHrefs = await page.locator('link[rel="icon"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLLinkElement).href),
  );
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(iconHrefs.some((href) => href.includes("/icon.svg"))).toBe(true);
  expect(appleHref).toContain("/apple-icon.png");

  for (const href of [...iconHrefs, new URL(appleHref!, BASE_URL).href]) {
    expect((await request.get(href)).ok()).toBe(true);
  }
});
```

In the existing Organization logo browser test, keep the URL, update the expected dimensions to 520×650, and continue verifying the logo endpoint returns SVG content successfully. Exact asset identity is covered by `brandAssets.test.ts`, so the browser test must not duplicate source-text assertions.

- [ ] **Step 3: Run focused SEO tests and confirm the Open Graph assertion fails**

Run:

```powershell
npm.cmd test -- tests/seo/opengraphImage.test.ts tests/seo/structuredData.test.ts
npm.cmd run test:browser -- seo.spec.ts --grep "reviewed browser|Organization schema"
```

Expected: the Open Graph color assertions FAIL because the current image lacks the green and brown logo colors. Icon browser coverage should pass only after Task 1 assets are recognized by Next.js; if the generated filenames differ by a query string, keep path-prefix matching and do not hardcode the query.

- [ ] **Step 4: Embed the reviewed SVGs in `OpenGraphImage` at build time**

Load the font and SVG text without a running site:

```tsx
const notoSansGeorgian = readFile(join(process.cwd(), "assets/fonts/NotoSansGeorgian-Regular.ttf"));
const horizontalLogo = readFile(join(process.cwd(), "public/brand/fiscal-logo-horizontal.svg"), "utf8");
const reversedMark = readFile(join(process.cwd(), "public/brand/fiscal-logo-mark-reversed.svg"), "utf8");

function svgDataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
```

Await all three at the start of `OpenGraphImage`. Render the full horizontal logo at least 360px wide on the paper portion, keep the Georgian title, render an ink panel containing the reversed mark, and retain the exact trust line. Preserve `size`, `alt`, `contentType`, and the embedded Georgian font declaration.

- [ ] **Step 5: Preserve the structured-data contract while validating the new bytes**

Change only the Organization logo dimensions in `siteJsonLd` from 512×512 to the reviewed SVG's actual 520×650 dimensions. In `structuredData.test.ts`, use this exact expectation:

```ts
logo: {
  "@type": "ImageObject",
  url: "https://fiscal.ge/fiscal-ge-logo.svg",
  width: 520,
  height: 650,
},
```

The stable URL now serves the reviewed mark installed in Task 1. Do not add `sameAs` or `SearchAction`.

- [ ] **Step 6: Run focused unit and browser SEO tests**

Run:

```powershell
npm.cmd test -- tests/seo/opengraphImage.test.ts tests/seo/structuredData.test.ts tests/branding/brandAssets.test.ts
npm.cmd run test:browser -- seo.spec.ts --grep "reviewed browser|Organization schema|search metadata"
```

Expected: PASS with a 1200×630 PNG, distinct Georgian glyphs, all three logo accent colors, valid icons, and the unchanged Organization graph.

- [ ] **Step 7: Commit metadata and social identity**

```powershell
git add apps/web/app/opengraph-image.tsx apps/web/lib/seo/structuredData.ts apps/web/tests/seo/opengraphImage.test.ts apps/web/tests/seo/structuredData.test.ts apps/web/tests/browser/seo.spec.ts
git commit -m "feat: update Fiscal.ge social identity"
```

---

### Task 5: Synchronize the design contract and run the full release-quality gate

**Files:**
- Modify: `DESIGN.md:343-379`
- Modify: `DESIGN.md:398-404`
- Modify: `DESIGN.md:771-791`
- Verify only: all implementation and test files from Tasks 1-4

**Interfaces:**
- Consumes: completed branded surfaces and tests from Tasks 1-4.
- Produces: authoritative design documentation and complete local verification evidence; no deployment or publishing action.

- [ ] **Step 1: Update the production design contract**

Record these exact decisions in the relevant `DESIGN.md` sections:

```text
Public header: full v2.0 horizontal lockup at 280px from 768px upward; compact lockup below 768px.
Explorer expanded/mobile identity: reversed mark at approximately 30px plus live text Fiscal.ge / ღია მონაცემები.
Explorer collapsed rail: unchanged accent-square home affordance; no logo.
Footer: compact lockup at approximately 150px; trust, navigation, and licence content unchanged.
Hero: no additional logo.
Metadata: reviewed mark at /fiscal-ge-logo.svg with 520×650 dimensions; App Router favicon/icon/apple-icon files; generated 1200×630 social image using the horizontal lockup and reversed mark.
Minimums: full horizontal lockup 280px; mark 24px.
```

Also record that the supplied token JSON's 180px value is not authoritative for production.

- [ ] **Step 2: Run all focused unit tests together**

From `apps/web`:

```powershell
npm.cmd test -- tests/branding/brandAssets.test.ts tests/seo/opengraphImage.test.ts tests/seo/structuredData.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the full static quality gate**

Run:

```powershell
npm.cmd run check
```

Expected: ESLint passes with zero warnings, TypeScript emits no errors, all Vitest projects pass, and data validation reports no drift.

- [ ] **Step 4: Run a canonical-host production build**

Run:

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fiscal.ge'
npm.cmd run build
Remove-Item Env:NEXT_PUBLIC_SITE_URL
```

Expected: Next.js build succeeds, statically generates every route, and recognizes `favicon.ico`, `icon.svg`, `apple-icon.png`, and `opengraph-image` metadata.

- [ ] **Step 5: Run the representative browser suites**

Run:

```powershell
npm.cmd run test:browser -- landing.spec.ts main-explorer.spec.ts seo.spec.ts
```

Expected: PASS for the landing, Explorer shell, responsive branding, footer, metadata, and SEO routes.

- [ ] **Step 6: Perform real-browser visual QA**

Open the production-mode or Playwright-served application and inspect:

```text
/ at 1440×900, 900×900, 768×900, 767×900, 390×844, and 320×800
/methodology at 1440×900 and 390×844
/explorer/expenditure at 1200×900, 900×900, 390×844, and collapsed desktop rail
/opengraph-image at full 1200×630 and a small sharing-card thumbnail
```

For each width confirm the correct logo asset, no clipping, no document overflow, visible focus, unchanged nav destinations, preserved hero hierarchy, and no console errors. Save representative desktop/mobile screenshots as verification artifacts, not production assets.

- [ ] **Step 7: Review the complete diff for scope**

Run:

```powershell
git diff main...HEAD --stat
git diff main...HEAD -- apps/web/components apps/web/app apps/web/lib/seo apps/web/tests DESIGN.md
git status --short --branch
```

Expected: only reviewed assets, named branding surfaces, their tests, and `DESIGN.md` changed. There are no data, chart, table, hero, workbook, route-copy, dependency, or internal-identifier changes.

- [ ] **Step 8: Commit the synchronized design and verification contract**

```powershell
git add DESIGN.md
git commit -m "docs: record Fiscal.ge brand integration"
```

- [ ] **Step 9: Stop at the delivery boundary**

Report the exact branch, HEAD commit, focused/full test results, build result, browser widths checked, and any untracked temporary files. Do not push, open a PR, merge, deploy, or claim production impact unless the user separately authorizes publishing.
