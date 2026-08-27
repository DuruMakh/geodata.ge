# Fiscal.ge Brand Kit v2.0 Integration Design

**Date:** 2026-08-27

**Status:** Approved

**Approved visual direction:** Balanced identity preview
**Source:** `Fiscal.ge_Brand_Kit_2026 (2).zip`, Brand Kit v2.0 dated 2026-08-27

## 1. Goal

Integrate the approved Fiscal.ge logo system across the platform wherever product identity is expected, without turning data pages into advertising surfaces or changing the approved warm editorial design.

Success means that a visitor sees one coherent Fiscal.ge identity in the public header, Explorer shell, footer, browser icons, search metadata, and social sharing image. The existing homepage hero, charts, tables, copy hierarchy, navigation behavior, and downloadable data contract remain intact.

## 2. Approved Direction

The production direction follows the approved balanced preview:

- Use the full horizontal v2.0 lockup where at least 280px of logo width is available.
- Use the compact logo in narrow light-background contexts.
- Use the reversed mark with a separate text label in the dark Explorer sidebar, where the 232px sidebar cannot contain the full 280px reversed lockup.
- Use the brand mark for favicon, app-icon, and structured-data identity.
- Use the full horizontal lockup and reversed mark in the Open Graph image.
- Keep the homepage hero free of a second large logo.

The Brand Kit's colors and type families already match the production design system. This work does not replace the current palette or typography tokens.

## 3. Brand Kit Authority and Known Conflict

The v2.0 PDF and README set the full horizontal logo's minimum width to **280px** and the mark's minimum size to **24px**. The supplied `fiscal-brand-tokens.json` still says `horizontalPx: 180`.

For this implementation:

- 280px is authoritative because it is stated in both the visual guide and README and matches the redesigned lockup's longer descriptor line.
- The application must not import the conflicting 180px value.
- The inconsistency should be reported for correction in the next Brand Kit export, but it does not block integration.
- The short terracotta divider is part of the v2.0 horizontal artwork and must not be removed, stretched, recreated, or styled separately.

## 4. Asset Map

Only reviewed delivery assets from Brand Kit v2.0 enter the application. Editable source variants and redundant raster exports are not needed at runtime.

| Purpose | Brand Kit asset | Production role |
|---|---|---|
| Public desktop header | `fiscal-logo-horizontal.svg` | Full light-background lockup at 280px or wider |
| Narrow public header and footer | `fiscal-logo-compact.svg` | Compact light-background identity |
| Dark Explorer sidebar | `fiscal-logo-mark-reversed.svg` | Reversed mark beside the existing text identity |
| Search/Organization logo | `fiscal-logo-mark.svg` | Standalone public mark at the stable structured-data URL |
| Browser favicon | `favicon.ico`, `favicon.svg` | Legacy favicon plus scalable App Router icon |
| Apple touch icon | `apple-touch-icon-180.png` | App Router Apple icon |
| Social image | horizontal SVG plus reversed mark | Embedded into the generated Open Graph image |

The implementation should keep assets under a clearly named public brand directory, except files that use Next.js metadata conventions inside `app/`. The existing stable `/fiscal-ge-logo.svg` URL remains available for Organization JSON-LD and is replaced with the reviewed square v2.0 mark rather than renamed.

## 5. Surface Design

### 5.1 Public Header

`SiteHeader` remains the shared header for the homepage, About, methodology hub, and methodology dataset routes.

- At widths of 768px and above, show the full horizontal v2.0 SVG at exactly 280px wide by default.
- Below 768px, switch to the compact SVG at approximately 118-138px wide, depending on the available nav width.
- Use native responsive image selection so the browser loads the applicable asset; do not swap an `<img>` through CSS `content`.
- Preserve the existing nav labels, active state, destination URLs, year-range label, and bottom rule.
- Keep the logo link at the top-left and make it return to `/`.
- If the image is inside a named home link, use an empty image `alt` and give the link the accessible name `Fiscal.ge — მთავარი` to avoid duplicate announcements.

The header may grow modestly to accommodate the full lockup, but it must remain visually subordinate to the homepage hero and page titles.

### 5.2 Explorer Sidebar and Mobile Explorer Bar

The Explorer shell keeps its existing widths, collapse behavior, mobile in-flow navigation, focus management, and stored collapse preference.

- Expanded desktop and mobile top-bar states show the reversed mark at no less than 24px, targeted at about 30px.
- Beside the mark, retain `Fiscal.ge` and the navigation-specific sublabel `ღია მონაცემები` as live text.
- The sublabel is not presented as the formal brand descriptor; when the formal descriptor is used elsewhere, it remains exactly `საქართველოს მონაცემების პორტალი`.
- The mark and text live inside the existing home link, whose accessible name is `Fiscal.ge — მთავარი`.
- The collapsed 52px rail keeps the current accent-square home affordance. Adding a second logo to the rail would crowd the toggle and vertical context label, so it is out of scope.

The full reversed horizontal logo is not used in the 232px sidebar because doing so would violate the 280px minimum width.

### 5.3 Footer

Replace the text-only `Fiscal.ge` footer signature with the compact SVG at about 135-150px wide.

- Keep the existing descriptor sentence, contact link, navigation, source/update text, copyright, and CC BY 4.0 notice.
- Make the compact logo a home link with the same accessible-name rule used in the header.
- Do not repeat the full horizontal descriptor lockup in the footer; the compact signature keeps the footer secondary.

### 5.4 Browser and App Icons

Use Next.js App Router metadata file conventions:

- Keep the top-level `app/favicon.ico` location for legacy browser support.
- Add the scalable `app/icon.svg` from the supplied favicon SVG.
- Add `app/apple-icon.png` from the supplied 180px Apple touch icon.

Next.js should generate the corresponding icon and Apple touch `<link>` elements. No manual duplicate icon declarations belong in root metadata.

### 5.5 Structured Data and Public Logo URL

The Organization JSON-LD keeps the stable `/fiscal-ge-logo.svg` URL and publishes the reviewed SVG's actual 520×650 dimensions.

- Replace the current placeholder-style F artwork with the reviewed v2.0 mark.
- Preserve the existing Organization name, URL, email, description, and relationship to the WebSite node.
- Do not add unverified `sameAs`, SearchAction, or social-profile claims.

### 5.6 Open Graph and Twitter Image

Retain the existing generated 1200×630 image and Georgian title contract, but replace the text-only `FISCAL.GE` treatment with the reviewed logo system.

- Place the full horizontal v2.0 lockup on the paper side at a size safely above 280px.
- Use the reversed mark as a secondary visual anchor on an ink-colored area.
- Retain the page title `საქართველოს ბიუჯეტის მონაცემები` and the trust line `გადამოწმებული · მრავალწლიანი · ღია`.
- Preserve the existing Georgian font embedding so characters never render as missing-glyph boxes.
- Read the SVG assets at build time and embed them in the generated image; the build must not depend on a running application URL.

The same generated image continues to serve Open Graph and Twitter metadata through the existing metadata helper.

## 6. Explicit Non-Goals

This integration does not:

- add a second logo to the homepage hero;
- place logos inside charts, tables, KPI blocks, maps, tooltips, or dataset cards;
- add visible logo artwork to public Excel workbook cells or methodology CSVs;
- change workbook creator metadata from `Fiscal.ge`;
- alter the existing palette, typography, hero, route copy, navigation information architecture, or dataset behavior;
- import editable SVG variants, transparent PNG duplicates, or the Brand Kit PDF into the runtime bundle;
- rename protected internal identifiers such as `GEODATA_DATA_SOURCE`, `geodata_id`, `geodata_decision`, `geodata-ge`, or `geodata:sidebar-collapsed`.

## 7. Accessibility Contract

- Every linked brand treatment has one clear accessible name and no duplicate image announcement.
- Decorative marks inside already named links use empty alternative text.
- The standalone Organization logo SVG retains an internal `<title>` or equivalent accessible name.
- Logo focus states reuse the existing accent outline and meet the current minimum target-size rules.
- No logo text may be reconstructed with an unavailable font; production uses the outlined, non-editable SVG exports.
- Responsive switching must not create layout shift after the page loads.
- The 320px viewport must retain zero document-level horizontal overflow.

## 8. Implementation Boundaries

Expected production areas are limited to:

- reviewed brand assets under `apps/web/public/` and metadata icon files under `apps/web/app/`;
- `apps/web/components/site/site-header.tsx`;
- `apps/web/components/site/site-footer.tsx`;
- `apps/web/components/shell/data-sidebar.tsx`;
- `apps/web/app/opengraph-image.tsx`;
- structured-data and related branding tests;
- `DESIGN.md` sections 6.7, 7.1, 19, and the SEO/social-image contract.

A small shared logo component is acceptable only if it removes real repeated responsive or accessibility logic across these surfaces. A general logo framework, theme configuration layer, or new dependency is not justified.

## 9. Verification

### Automated checks

- Asset tests confirm the served v2.0 SVGs and icons exist with the expected content types.
- Structured-data tests confirm the stable logo URL and the reviewed mark's 520×650 dimensions.
- Open Graph tests confirm a 1200×630 PNG, visible brand artwork, and distinct Georgian glyph shapes.
- Browser tests confirm the full desktop logo source and minimum 280px rendered width at representative widths of 768px and above.
- Browser tests confirm the compact logo source below 768px.
- Explorer tests confirm the reversed mark, text identity, existing collapse/mobile behavior, focus return, and route navigation.
- Header/footer tests confirm accessible names and prevent duplicate announcements.
- Responsive tests cover at least 1440px, approximately 900px, 767px, 390px, and 320px, with no page overflow.
- Existing landing, methodology, Explorer, SEO, build, and data checks remain green.

### Visual checks

- Desktop public header shows the full v2.0 descriptor and terracotta divider without clipping.
- Compact header remains legible on mobile and leaves enough room for navigation.
- Explorer mark and text remain balanced in both the 232px sidebar and mobile top bar.
- Footer remains secondary to page content.
- Open Graph output is inspected at full size and as a small sharing-card thumbnail.
- Homepage hero, ledger rhythm, data visualizations, and page hierarchy are unchanged outside the branded surfaces.

## 10. Acceptance Criteria

The feature is ready for delivery when:

1. All approved surfaces use the correct v2.0 asset for their background and available width.
2. No full horizontal lockup renders below 280px and no mark renders below 24px.
3. The formal descriptor is always written as `საქართველოს მონაცემების პორტალი`.
4. Header, sidebar, footer, favicon, Organization JSON-LD, and social image form one consistent identity.
5. Hero, charts, tables, downloads, navigation behavior, data, and SEO content remain functionally unchanged.
6. Automated and real-browser checks pass at desktop and mobile sizes.
7. Production deployment is not claimed from a branch, merge, or deploy trigger alone; the deployed commit and representative live URLs must be verified separately if release is later authorized.
