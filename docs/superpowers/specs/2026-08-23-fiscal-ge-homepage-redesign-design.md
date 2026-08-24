# Fiscal.ge homepage redesign design

**Status:** Approved 2026-08-23

**Date:** 2026-08-23

**Surface:** Fiscal.ge homepage (`/`) plus the shared public header and one revenue-title wording change

**Approved visual reference:** `design-shotgun/homepage-below-hero-2026-08-23/variant-j.html`

## 1. Objective

Redesign the Fiscal.ge homepage around one clear path from the existing living-relief hero into the three data collections that are available now:

1. national expenditure;
2. national revenue;
3. municipal budgets;
4. one methodology and source section.

The homepage should feel like the entrance to a broader Georgian data platform without presenting future indicators as if they already exist. The current v1 scope remains the Georgia Budget Explorer defined in `Project_Definition.md` section 2.

Variant J is the visual reference for hierarchy, spacing, rules, typography, and responsive composition. It is not production code. Static values and simplified markup in the prototype must not become application data or architecture.

## 2. Success criteria

The redesign succeeds when a visitor can:

- understand the platform identity and reach the available data from the hero;
- distinguish expenditure, revenue, and municipal data without reading a long introduction;
- see each collection's latest available year, applicable total, and four leading rows immediately;
- reach the matching explorer and the methodology centre through ordinary links;
- use the page without horizontal overflow or broken hierarchy on desktop, tablet, 390px mobile, or 320px mobile;
- find concise, server-rendered Georgian content that accurately describes only the data currently available.

The redesign must preserve the existing warm editorial system, the living-relief hero, reviewed data rules, accessibility, and the site's existing SEO foundation.

## 3. Scope

### 3.1 Included

- New homepage information architecture and post-hero layout.
- Agreed header, hero, country-stat, dataset-section, and methodology copy.
- Latest-year expenditure, revenue, and municipality summaries derived from served facts.
- Dedicated responsive behavior for the new homepage sections.
- Homepage metadata and on-page SEO alignment.
- Shared public-header label change from `ექსპლორერი` to `მონაცემები`.
- Revenue editorial title change from `როგორ ივსება საქართველოს ბიუჯეტი` to `როგორ ფინანსდება საქართველოს ბიუჯეტი` wherever that page title is shown or specified.
- Updates to `DESIGN.md` and the relevant automated tests.

### 3.2 Not included

- New datasets, routes, public API, or data extraction.
- Live economy, inflation, unemployment, demographics, trade, or GDP-growth sections.
- A broad data catalogue or clickable future-indicator pages.
- Changes to reviewed budget or municipal source files.
- A new chart, map, illustration, or decorative graphic below the hero.
- A redesign of explorer pages, methodology pages, or the global footer beyond copy/link consistency required by this specification.
- English localization, `hreflang`, a blog, or thin pages generated for years or categories.
- A new analytics or consent product.

## 4. Page structure

The homepage uses this fixed order:

1. shared public header;
2. existing living-relief hero with revised copy;
3. three country figures;
4. national expenditure section;
5. national revenue section;
6. municipal budgets section;
7. one methodology and source section;
8. existing site footer.

The current `სამი გზა მონაცემებამდე` cards, `რა არის Fiscal.ge?` block, and separate large methodology promotion are removed. The new methodology section replaces the duplicated explanatory and methodology material with one coherent destination.

## 5. Header, hero, and country figures

### 5.1 Shared public header

The shared header keeps the existing `Fiscal.ge` brand and visual treatment.

- `მთავარი` remains the active homepage link.
- The public label `ექსპლორერი` becomes `მონაცემები` and continues to link to `/explorer`.
- On methodology routes, neither link receives `aria-current`, matching the existing separate-destination rule.
- Explorer surfaces keep their existing sidebar and breadcrumb architecture; this label change does not add a public header to those routes.

### 5.2 Hero

The living-relief hero remains the primary visual subject. Its geometry, city behavior, motion preferences, WebGL fallback, accessible description, and full-bleed treatment remain governed by `DESIGN.md`.

Exact visible copy:

- overline: `საქართველოს მონაცემების პორტალი`;
- H1: `საქართველო ციფრებში`;
- CTA: `გაეცანი მონაცემებს`.

The CTA is a real link to the first post-hero data section on the same page. The header's `მონაცემები` link remains the direct route to `/explorer`.

### 5.3 Country figures

The figure set remains population, area, and nominal GDP. Only the population statistic is updated.

| Label | Display value | Visible context |
| --- | ---: | --- |
| `მოსახლეობა` | `3.9 მლნ` | `2026 წლის 1 იანვარი · საქსტატი` |
| `ფართობი` | `69.7 ათ. კმ²` | `საქართველოს ტერიტორია` |
| `ეკონომიკის ზომა` | `104.6 მლრდ ₾` | `ნომინალური მშპ · 2025, წინასწარი` |

The population display deliberately uses one decimal (`3.9`), not `3.94`. The full official value may be retained in a code comment, test fixture, accessible source note, or maintenance documentation, but the visible figure stays clean.

These three slowly changing country figures remain explicitly maintained snapshots. Their date/status captions make their reference period clear; they are not inferred from the budget corpus.

## 6. Latest-year dataset sections

### 6.1 Shared visual and content contract

Each of the first three post-hero sections uses the same editorial ledger structure:

- a decorative two-digit index (`01`, `02`, `03`);
- a small dataset overline;
- a question-led H2;
- one concise explanatory sentence using the section's data-derived latest year;
- one direct link to the matching explorer;
- a clearly separated applicable total between two strong horizontal rules;
- the section's latest year and truthful basis/status context;
- one compact table containing exactly four latest-year rows.

There are no post-hero charts, maps, canvases, SVG data graphics, sparklines, waffle grids, Excel previews, prior-year totals, arrows, percentage-change callouts, or decorative illustrations.

There is no annual masthead above the dataset sections. The `#data` anchor and its strong top rule remain, but the complete masthead row, both masthead texts, and its reserved padding are removed so section `01` begins immediately. Each section's own year and basis/status remain authoritative inside its total block.

Every amount, share, year, row label, ordering decision, and basis label comes from the served, reviewed data. The prototype's 2025 values are illustrative snapshots only.

### 6.2 Expenditure

Exact content:

- index: `01`;
- overline: `სახელმწიფო ხარჯები`;
- heading: `როგორ იხარჯება საქართველოს ბიუჯეტი`;
- link label: `ხარჯების მონაცემები →`;
- link destination: `/explorer/expenditure`;
- total label: `მთლიანი ხარჯი`;
- first table-column label: `სფერო`.

Data rules:

- Apply the existing actual-over-planned public-fact rule before determining the latest year or amounts.
- Use the latest year available for active expenditure-field facts.
- Use the same applicable expenditure total semantics as the explorer; do not introduce a separately maintained homepage total.
- Rank eligible expenditure fields by latest-year amount, descending, and display the first four.
- Each row's share is its amount divided by the section's applicable total.
- Stable category ID is the deterministic tie-breaker when amounts are equal.

### 6.3 Revenue

Exact content:

- index: `02`;
- overline: `სახელმწიფო შემოსავლები`;
- heading: `როგორ ფინანსდება საქართველოს ბიუჯეტი`;
- link label: `შემოსავლების მონაცემები →`;
- link destination: `/explorer/revenue`;
- total label: `მთლიანი შემოსავლები`;
- first table-column label: `მუხლი`.

Data rules mirror expenditure:

- Apply the existing actual-over-planned public-fact rule first.
- Use the latest year available for active revenue facts.
- Use the explorer's applicable revenue total semantics.
- Rank eligible revenue rows by latest-year amount, descending, and display the first four.
- Calculate each share against the applicable revenue total.
- Use stable category ID as the tie-breaker.

The new financing wording also replaces the old revenue H1 in the explorer and the corresponding authoritative design text and tests. Search-oriented metadata may still use the accurate phrase `საქართველოს ბიუჯეტის შემოსავლები`; this is not a global replacement of the canonical term `შემოსავლები`.

### 6.4 Municipal budgets

Exact content:

- index: `03`;
- overline: `მუნიციპალური ბიუჯეტები`;
- heading: `როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები`;
- link label: `მუნიციპალური მონაცემები →`;
- link destination: `/explorer/municipalities`;
- total label: `საქართველოს მუნიციპალური ჯამი`;
- first table-column label: `უდიდესი მუნიციპალური ბიუჯეტები`.

Data rules:

- Derive the latest municipal year from the reviewed Georgia country-total facts.
- Use that year's `country.georgia` public total as the section denominator and headline. This preserves the approved Georgia aggregate and Adjara adjustment; it must not be replaced with a sum of the four displayed rows.
- From public municipality total facts for that same year, rank municipalities by `publicTotalGel`, descending, and display the first four.
- Resolve names from the reviewed municipality registry.
- Calculate each displayed municipality's share against the Georgia municipal aggregate.
- Use municipality code as the deterministic tie-breaker.
- Preserve the existing excluded-code rules and never reintroduce aggregate-only codes as municipality rows.

The heading `უდიდესი მუნიციპალური ბიუჯეტები` makes the selection rule explicit. The current result happens to be Tbilisi, Batumi, Rustavi, and Kutaisi because those are the four largest reviewed latest-year totals; the section is not filtered to cities and those names are not hardcoded.

### 6.5 Status and formatting

- A section must not say `ფაქტობრივი შესრულება` when its active latest-year values include planned data.
- Basis/status wording is derived from the active rows and uses the existing approved terms (`ფაქტი`, `გეგმა`, or a truthful mixed indication where necessary).
- Standalone totals and table amounts use the existing production amount-formatting contract rather than prototype-specific fixed precision.
- Shares use the existing one-decimal percentage format.
- A real zero remains zero; missing values are not converted to zero.

## 7. Methodology and footer

The methodology section is the fourth numbered editorial section and uses no graphic.

Exact visible content:

- index: `04`;
- heading: `მეთოდოლოგია და პირველწყაროები`;
- introduction: `თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს, კლასიფიკაციის წესსა და გადამოწმების შედეგს.`;
- link label: `მეთოდოლოგიის ნახვა →`;
- link destination: `/methodology`.

Its compact text list communicates four steps:

1. `ოფიციალური დოკუმენტის შენარჩუნება`;
2. `კლასიფიკაცია და გარდაქმნის წესი`;
3. `შეჯერება და ხარისხის შემოწმება`;
4. `ჩამოსატვირთი მონაცემები`.

The current site footer follows immediately afterward. Existing footer trust, licence, contact, and navigation behavior remains unless a label must change to avoid contradicting this specification.

## 8. Responsive behavior

The implementation follows the approved Variant J composition and the existing editorial breakpoints. Exact CSS may reuse current tokens rather than copying prototype values.

### 8.1 Desktop (`>= 850px` for this landing composition)

- Each dataset ledger reads left to right as index → editorial copy → latest-year data.
- The applicable total and year/status form a clear row above the table.
- Tables align across the three dataset sections.
- The hero keeps its existing full-bleed emphasis.

### 8.2 Tablet and mobile (`< 850px`)

- Page side padding becomes compact and consistent with the editorial system.
- The hero is shorter while still fitting its copy and map safely.
- Country figures remain one compact three-column row rather than three tall stacked cards.
- Each dataset section becomes a single column in this order: index → copy → total/year → table.
- The total and latest year stay on one row while space permits.
- The methodology section becomes one column.
- Tables stay within their parent and the page never relies on horizontal scrolling.

### 8.3 Narrow mobile (`<= 380px`)

- Side padding and type scale reduce without changing content order.
- Hero H1 targets approximately 33px while respecting the existing type scale.
- Country-stat units move below their numeric values to prevent collisions.
- Table labels and numeric columns remain readable and fit the viewport.
- At a 320px viewport, `document.documentElement.scrollWidth` must equal `clientWidth`.

Mobile may visually shorten a country-stat caption, but the full date/source context remains available to assistive technology and must not become inaccurate.

## 9. SEO, content, and trust

### 9.1 Search intent and visible copy

The broad H1 `საქართველო ციფრებში` expresses the platform direction. Current search intent remains explicit through server-rendered H2 headings and body copy containing accurate Georgian terms for the state budget, expenditure, revenue/financing, and municipalities.

The page must not claim that future economic or demographic datasets are live. Future markers already permitted by v1 remain unchanged elsewhere.

### 9.2 Metadata

Retain the root title:

`საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge`

Revise the description so it matches the new visible page and current download experience:

`საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები — ხარჯები, შემოსავლები, მუნიციპალიტეტები, მეთოდოლოგია და ჩამოსატვირთი მონაცემები.`

Preserve the existing Fiscal.ge canonical origin, Open Graph/Twitter metadata, social image, sitemap behavior, robots policy, and structured-data architecture. This redesign does not create a new schema type or indexable route family.

### 9.3 Crawlability and trust

- Hero, dataset, methodology, header, and relevant footer destinations use real `Link`/`<a href>` elements.
- The visible page order and internal links reflect the current product hierarchy.
- Methodology and source language remains concise and factual.
- Existing structured data and metadata must describe only available datasets and downloads.
- Search Console verification, sitemap submission, and post-release measurement remain owner-operated release steps, not repository implementation claims.

### 9.4 Performance

The new content is server-rendered and adds no new client-side visualization library or homepage JavaScript. The living-relief hero remains the only heavy visual system on the page. The redesign must not regress layout stability or ship the municipal corpus to the browser merely to render four rows.

## 10. Accessibility

- The page has one H1. Each dataset and methodology section has an H2 associated with its `<section>`.
- Decorative index numbers are hidden from assistive technology.
- Each data list uses a semantic table with column headers and row headers; its accessible name identifies the dataset and year.
- Amount and share columns remain understandable without color.
- Link labels describe their destinations and retain visible focus treatment.
- Hero reduced-motion behavior, fallback, and accessible description remain intact.
- Shortened mobile captions do not remove the full population date/source from the accessibility tree.
- Reading order in the DOM matches the visual mobile order.
- No content is clipped at 200% zoom or at the tested narrow widths.

## 11. Data-loading and model boundary

The homepage remains a static server-rendered route.

- Load landing budget data and municipal data concurrently.
- Keep the existing municipal loader separate; do not merge municipal rows into `ExplorerData` or expand the reusable landing-data payload.
- Build one compact server-side `LandingModel` containing only the information the page renders: coverage/update context and the three latest-year summaries.
- Pass only that compact model to the landing component. The full municipal function/total corpus must not be serialized into the client response.
- National summaries use `chooseActivePublicFacts` before selecting years, totals, and rows.
- Municipal summary uses `countryTotalFacts`, public `totalFacts`, and reviewed municipality labels.
- Remove the superseded sparkline, waffle, and Excel-preview model fields and their single-use calculation code.
- Reuse existing formatting, labels, tokens, loaders, and link components. Add no dependency and no general-purpose abstraction for this one page.

A suitable model shape is three `LandingDatasetSummary` values, each containing a latest year, total, truthful basis context, and four labelled rows with amount and share. The exact TypeScript names are an implementation detail; the bounded server/client data contract is not.

## 12. Expected implementation boundary

The likely production files are:

- `apps/web/app/page.tsx` — concurrent data loading and aligned metadata;
- `apps/web/lib/landing/landingData.ts` — compact data-derived summary model;
- `apps/web/components/landing/landing-page.tsx` — approved page structure and responsive layout;
- `apps/web/components/site/site-header.tsx` — public nav label;
- `apps/web/components/main-explorer/main-explorer.tsx` — revenue H1 wording;
- landing-model unit tests and the landing, explorer, and methodology browser tests;
- `DESIGN.md` sections 7.1, 11, and 19.

A small landing-only presentational component is acceptable if it makes the three repeated dataset sections easier to read. No broader refactor is justified. `Project_Definition.md` does not require a scope change because this redesign exposes only data already inside v1.

## 13. Verification contract

### 13.1 Model tests

Focused unit tests must prove:

- actual values win over planned values before latest-year selection;
- expenditure, revenue, and municipal latest years are derived independently;
- national totals and top-four rows follow the existing public-fact semantics;
- municipality total comes from the reviewed Georgia aggregate;
- municipality ranking uses all eligible public municipalities, not a city filter;
- municipal shares use the Georgia aggregate denominator;
- ties have stable ordering;
- labels resolve from reviewed registries/glossary;
- missing values are not silently changed to zero.

### 13.2 Browser tests

Browser coverage must prove:

- exact header and hero copy, destinations, and active-nav behavior;
- visible order: expenditure → revenue → municipalities → methodology;
- all three section totals, latest years, four-row tables, and explorer links render;
- the old three-path, about, duplicated methodology-promo, post-hero sparkline, waffle, and Excel-preview surfaces are absent;
- the revenue explorer H1 uses `როგორ ფინანსდება საქართველოს ბიუჯეტი`;
- methodology routes show `მონაცემები` in the shared header with no incorrect active state;
- desktop, 390px, and 320px layouts have no document-level horizontal overflow;
- each table fits its parent at the narrow widths;
- keyboard focus and reduced-motion/fallback behavior remain usable;
- no browser console or page errors occur.

### 13.3 Repository and release checks

Implementation is not complete until the repository's current definition of done passes:

1. focused unit tests;
2. focused browser tests and visual screenshot review;
3. `npm.cmd run check` from `apps/web`;
4. `npm.cmd run build` from `apps/web`;
5. `npm.cmd run test:browser` from `apps/web`;
6. `git diff --check`;
7. required CI and production verification if delivery is authorized later.

Search performance, rankings, or indexing changes are measured after release and are not claimed from repository checks alone.

## 14. Acceptance criteria

The implementation may be accepted when:

- the production homepage matches the approved Variant J hierarchy and responsive intent;
- all exact Georgian labels and headings in this specification are present;
- only the population figure changes among the three hero statistics, and it displays as `3.9 მლნ` with the 2026 date/source;
- the annual masthead and its empty spacing are absent, while the `#data` anchor/top rule lead directly into section `01`;
- each data section renders only its own latest available year, one prominent applicable total, and four latest-year rows;
- all budget and municipal values are served-fact-derived rather than hardcoded;
- the municipality list is correctly identified and computed as the largest municipal budgets;
- the old post-hero card/graphic/duplicate-methodology design is gone;
- desktop and narrow-mobile verification passes without overflow;
- metadata and server-rendered Georgian copy accurately reflect the current budget-focused product;
- `DESIGN.md` and automated tests agree with production behavior.

This document becomes the bounded design contract after user approval. The implementation plan is written only after that approval.
