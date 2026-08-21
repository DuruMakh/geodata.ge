# Fiscal.ge SEO Optimization Design

Date: 2026-08-21

Status: Approved planning scope from the owner request to complete SEO optimization for a Georgian audience

Product: Fiscal.ge Georgian Budget Explorer

Canonical production origin: `https://fiscal.ge`

## 1. Objective

Make Fiscal.ge reliably discoverable for Georgian-language budget searches while preserving the product's narrow, evidence-first v1 scope.

The implementation must improve five outcomes together:

1. Google and other search engines receive one unambiguous canonical host and can discover every public page through normal links.
2. Search-result titles and snippets match the language Georgian users actually use for national and municipal budgets.
3. Search engines can understand Fiscal.ge as a publisher of reviewed civic datasets, not only as an interactive application.
4. Search Console provides a measurable indexing and query baseline for future iteration.
5. Performance, content, and trust improvements reinforce the existing methodology and source-provenance strengths.

SEO must not weaken data accuracy, invent current-year figures, publish unreviewed interpretations, or expand v1 into a broad public-data catalog.

## 2. Verified Baseline

The live audit on 2026-08-21 verified:

- `https://fiscal.ge/` returns HTTP 200.
- The homepage canonical and Open Graph URL are `https://fiscal.ge`.
- `/robots.txt` allows all crawlers and names `https://fiscal.ge/sitemap.xml`.
- `/sitemap.xml` contains the current public route set on the Fiscal.ge origin.
- Representative expenditure and municipality pages return HTTP 200 with Georgian titles, descriptions, canonicals, and visible server-rendered content.
- The document language is `ka`.
- No audited page includes JSON-LD structured data.
- No audited page exposes an Open Graph image.
- `https://geodata-ge.vercel.app/` currently points canonically to Fiscal.ge. The owner intends to repurpose that hostname as a preview surface later, so changing or redirecting it is outside this SEO scope.
- The municipality index and entity picker use buttons plus client navigation for many destinations instead of ordinary anchor links.
- The live uncompressed HTML is approximately 530 KB for expenditure, 545 KB for analysis, and 625 KB for the municipality index. Brotli reduces transfer size, but parsing and hydration still require field measurement.
- The repository has no Search Console setup evidence, search performance baseline, or dedicated SEO regression suite.

The planning checkout is detached at `4778df71`, while `origin/main` and production include Fiscal.ge branding from PR #64 at `2c5c1403`. Implementation must start from current `origin/main`, not from the detached audit checkout.

## 3. Audience and Search Intent

### 3.1 Primary audience

- Georgian journalists and editors.
- Policy analysts, economists, researchers, and students.
- Civil-society and public-sector observers.
- Citizens seeking a plain-language answer about national or municipal budgets.

### 3.2 Query clusters

| Intent | Representative Georgian query language | Primary page family |
| --- | --- | --- |
| National overview | `საქართველოს ბიუჯეტი`, `სახელმწიფო ბიუჯეტი`, `ბიუჯეტი 2025` | `/`, `/explorer` |
| Expenditure | `საქართველოს ბიუჯეტის ხარჯები`, `რაში იხარჯება ბიუჯეტი`, `ბიუჯეტის ხარჯები სფეროების მიხედვით` | `/explorer/expenditure` |
| Revenue | `საქართველოს ბიუჯეტის შემოსავლები`, `ბიუჯეტის შემოსავლები`, `საგადასახადო შემოსავლები` | `/explorer/revenue` |
| Single-year analysis | `საქართველოს ბიუჯეტის ანალიზი`, `2025 წლის ბიუჯეტის ფაქტი` | `/explorer/analysis` |
| Municipality | `თბილისის ბიუჯეტი`, `ბათუმის ბიუჯეტი`, `[ადგილის ნათესაობითი ფორმა] ბიუჯეტი` | Municipality pages |
| Region | `აჭარის მუნიციპალური ბიუჯეტი`, `[რეგიონის] მუნიციპალიტეტების ბიუჯეტები` | Region pages |
| Download and reuse | `ბიუჯეტის მონაცემები csv`, `ღია საბიუჯეტო მონაცემები` | Methodology dataset pages |
| Trust and method | `ბიუჯეტის მონაცემების წყარო`, `ფაქტი და გეგმა`, `ბიუჯეტის კლასიფიკაცია` | Methodology pages |
| Educational | `რა არის სახელმწიფო ბიუჯეტი`, `როგორ ივსება ბიუჯეტი` | Homepage and budget hub |

The initial copy uses this evidence-based vocabulary. Search Console query data becomes authoritative after enough impressions accumulate.

## 4. Approaches Considered

### A. Metadata-only patch

Change titles, descriptions, and social tags without changing discovery, datasets, trust content, or measurement.

This is low effort but incomplete. It cannot prove indexing and leaves the strongest Fiscal.ge asset—reviewed downloadable data—opaque to dataset search.

### B. Focused full-funnel SEO foundation — selected

Lock the canonical Fiscal.ge origin, improve metadata, add structured data and stable downloads, make internal navigation crawlable, add concise Georgian explanatory content, establish Search Console, add trust information, and measure performance.

This is the recommended balance. It improves the current 86-page product without creating a publishing CMS or hundreds of thin pages.

### C. Programmatic year/category landing pages

Generate many pages for every year, category, ministry, and filter combination.

This is rejected for v1. Most combinations would duplicate the explorer, compete with one another, and create thin content. A new indexable page is allowed later only when Search Console proves demand and the page provides a distinct, substantial answer.

## 5. Canonical Host Contract

`https://fiscal.ge` is the only indexable production origin.

Requirements:

- Every HTML page on Fiscal.ge has a self-referencing absolute canonical.
- `robots.txt`, sitemap URLs, Open Graph URLs, structured-data URLs, and download URLs use `https://fiscal.ge`.
- Preview deployments remain `noindex` and point canonical metadata at Fiscal.ge.
- `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` is set explicitly in Production so canonical output does not depend on Vercel's choice of production alias.
- Search Console verifies the Fiscal.ge Domain property; its submitted sitemap contains only Fiscal.ge URLs.
- This implementation does not change, redirect, index-control, or otherwise configure `geodata-ge.vercel.app`; the owner's later preview-site setup is a separate operational task.

No request-time middleware is introduced for domain handling.

## 6. Indexable Page Inventory

The optimized index contains:

- Homepage.
- Budget hub.
- Expenditure, revenue, and single-year analysis routes.
- Municipality index, Georgia aggregate, 64 municipality pages, and 11 region pages.
- Methodology hub and three dataset methodology pages.
- One new `/about` trust page.

Filter state stored in hashes remains non-indexable. The implementation must not generate sitemap entries or canonicals for series selections, tabs, years, measures, chart views, or search terms.

Download files are discoverable through dataset pages and structured data but are not separate sitemap HTML entries.

## 7. Metadata Contract

### 7.1 Shared rules

- Site name is `Fiscal.ge` everywhere.
- Titles are Georgian-first and describe the user answer before the brand.
- Titles remain concise and unique; the preferred format is `[specific subject] | Fiscal.ge`.
- Data coverage is derived from loaded facts, never hardcoded in reusable logic.
- Descriptions state the page's data scope, coverage, actual/planned meaning, and useful action where space permits.
- Every indexable page defines canonical, description, Open Graph title/description/URL, and an image inherited from the root social-card asset.
- Twitter uses `summary_large_image`.
- No keywords meta tag is added.
- No Georgian/English `hreflang` is added until real English equivalents exist at distinct URLs.

### 7.2 Required title patterns

| Route | Title pattern |
| --- | --- |
| `/` | `საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge` |
| `/explorer` | `საქართველოს ბიუჯეტის მონაცემები | Fiscal.ge` |
| `/explorer/expenditure` | `საქართველოს ბიუჯეტის ხარჯები {firstYear}–{lastYear} | Fiscal.ge` |
| `/explorer/revenue` | `საქართველოს ბიუჯეტის შემოსავლები {firstYear}–{lastYear} | Fiscal.ge` |
| `/explorer/analysis` | `საქართველოს ბიუჯეტის ანალიზი — {latestYear} ფაქტი | Fiscal.ge` |
| `/explorer/municipalities` | `საქართველოს მუნიციპალიტეტების ბიუჯეტები {firstYear}–{lastYear} | Fiscal.ge` |
| Municipality | `{genitiveName} ბიუჯეტი {firstYear}–{lastYear} | Fiscal.ge` |
| Region | `{genitiveRegionName} მუნიციპალიტეტების ბიუჯეტები {firstYear}–{lastYear} | Fiscal.ge` |
| Georgia aggregate | `საქართველოს მუნიციპალური ბიუჯეტების ჯამი {firstYear}–{lastYear} | Fiscal.ge` |
| `/methodology` | `ბიუჯეტის მონაცემთა მეთოდოლოგია და პირველწყაროები | Fiscal.ge` |
| Dataset methodology | `{datasetTitle} — მეთოდოლოგია და მონაცემები | Fiscal.ge` |
| `/about` | `Fiscal.ge-ის შესახებ — მონაცემები, წყაროები და შესწორებები` |

Region title generation uses the existing reviewed `REGION_GENITIVE_KA` registry. Municipality titles use the canonical official `nameKa` value, whose closed 64-row registry is validated to end in `მუნიციპალიტეტი`, and form the possessive phrase as `${nameKa}ს ბიუჯეტი` (for example, `ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი`). The short `displayNameKa` must not receive a guessed suffix.

## 8. Structured Data Contract

Structured data is server-rendered JSON-LD and must describe visible content only.

### 8.1 Site entities

The root layout publishes an `@graph` containing:

- `Organization` with `@id=https://fiscal.ge/#organization`, name `Fiscal.ge`, URL, and public contact email.
- `WebSite` with `@id=https://fiscal.ge/#website`, Georgian language, publisher reference, and canonical URL.

Do not add `SearchAction` because Fiscal.ge does not provide a global indexable site search.

### 8.2 Breadcrumbs

Every nested HTML page publishes `BreadcrumbList` matching the visible breadcrumb hierarchy and canonical URLs.

### 8.3 Dataset catalog

- `/methodology` publishes `DataCatalog` listing the three live dataset pages.
- Each live methodology dataset page publishes `Dataset` with a unique name, Georgian description of at least 50 characters, canonical URL, temporal coverage derived from served facts, spatial coverage, `dateModified`, creator reference, and `includedInDataCatalog`.
- Each dataset includes `DataDownload` distributions only for stable, public, full-dataset download URLs.
- Fiscal.ge's processed datasets use the already-published `CC BY 4.0` reuse statement and link to `https://creativecommons.org/licenses/by/4.0/`. Original official files retain their separate per-file manifest licensing and redistribution metadata; the Fiscal.ge dataset license must not be presented as a license granted by the original publishers.

### 8.4 Serialization safety

JSON-LD serialization replaces `<` with its Unicode escape so data-derived labels cannot terminate the script element. All structured-data builders are pure and unit tested.

## 9. Stable Public Dataset Downloads

Build preparation generates UTF-8-with-BOM CSV files at stable URLs:

- `/downloads/data/national-expenditure-2004-2025.csv`
- `/downloads/data/national-revenue-2004-2025.csv`
- `/downloads/data/municipal-expenditure-2015-2025.csv`

File names may derive their year bounds during generation, but each release preserves the prior stable URL through a redirect or continues serving the previous name if a year is added. The implementation plan may choose a coverage-neutral filename if that makes URL stability simpler.

The generated exports:

- come only from reviewed canonical imports;
- preserve source and basis metadata;
- contain stable identifiers and Georgian/English labels where the existing export contract supplies them;
- pass exact row-count/content validation;
- begin with the UTF-8 BOM;
- are regenerated during `prebuild` and checked during `data:validate`;
- are linked visibly from the matching methodology page.

Interactive filtered CSV export remains unchanged.

## 10. Crawlable Internal Navigation

- Municipality, region, and Georgia rows that navigate to a page use `Link`/`<a href>` rather than buttons.
- Map geometry may remain interactive SVG controls, but the adjacent list provides ordinary links to the same municipality pages.
- Entity-picker navigation options expose a real destination URL. The combobox interaction and keyboard behavior remain intact.
- Homepage entry points link directly to expenditure, revenue, analysis, and municipality routes.
- Explorer pages link to their matching methodology dataset pages.
- Methodology pages link back to the corresponding explorer.
- Municipality pages link to their region, neighboring municipalities, the municipality index, and municipality methodology.
- Visible breadcrumb links and JSON-LD breadcrumbs describe the same hierarchy.

No hidden SEO-only link list is added.

## 11. Georgian On-Page Content

The content addition is concise and factual, not a blog system.

Each core explorer family receives a server-rendered introduction that:

- uses the primary Georgian query language naturally;
- defines what the figures measure;
- states the actual coverage and basis;
- explains what can be compared or downloaded;
- links to methodology;
- avoids claims about the current year when reviewed actual data stops earlier.

Each municipality and region page receives one entity-specific summary paragraph assembled from reviewed labels and loaded coverage, not a generic block repeated unchanged across all pages.

The homepage adds a compact Georgian explanatory section answering what the state budget is, how Fiscal.ge differs from official legal documents, and where users can inspect sources.

Copy quality requirements:

- Georgian is human-reviewed before release.
- Municipality names use correct grammatical forms.
- `ფაქტი`, `გეგმა`, `ხარჯები`, `შემოსავლები`, and `% მშპ-ში` retain the project's approved glossary meanings.
- No FAQ rich-result markup is added merely to pursue a search feature.

## 12. Trust Page

`/about` explains:

- what Fiscal.ge is and is not;
- who publishes it, using only owner-approved public identity information;
- how reviewed official sources become public data;
- how to report a suspected error;
- how corrections and dataset updates are recorded;
- how to cite Fiscal.ge;
- the public contact email;
- the current CC BY 4.0 processed-data reuse statement, clearly separated from original-document rights recorded in source manifests.

The page links to `/methodology` and the explorer. The footer links to `/about`.

## 13. Social Preview Image

Add one branded 1200×630 image using the existing warm editorial design system:

- paper background, ink rules, serif Georgian title, terracotta accent;
- Fiscal.ge name and `საქართველოს ბიუჯეტის მონაცემები`;
- no chart or number that can become stale;
- legible when reduced to a messaging-app preview.

The root metadata provides the image to every route. Route-specific images are deferred unless post-release sharing data proves value.

## 14. Measurement and Operations

### 14.1 Search Console owner steps

- Verify the Fiscal.ge Domain property through DNS.
- Submit `https://fiscal.ge/sitemap.xml`.
- Inspect `/`, expenditure, revenue, analysis, municipality index, one municipality, one region, methodology hub, one dataset page, and `/about`.
- Record submitted/indexed counts and all exclusion reasons.
- Request indexing only for the priority sample after verification; do not submit all URLs manually.
- Confirm Google's selected canonical matches the declared Fiscal.ge canonical on the representative sample.

### 14.2 Baseline report

Record at release and then monthly:

- valid indexed pages versus sitemap pages;
- clicks, impressions, CTR, and position;
- branded versus non-branded queries;
- query clusters from section 3.2;
- top landing pages;
- countries and devices;
- Core Web Vitals route groups;
- stable dataset-download events if privacy-compatible analytics is later approved.

Search Console is required. A general analytics vendor is not introduced in this SEO implementation without a separate privacy/product decision.

## 15. Performance Contract

SEO implementation must not make current payloads worse.

- Capture Lighthouse/PageSpeed baselines for one URL from each route family before and after implementation.
- Use Search Console field data once available.
- Keep structured data and copy server-rendered without shipping new client JavaScript.
- Investigate the municipality index first because it has the largest audited HTML transfer.
- Defer inactive data or heavy visual code only when the change preserves current behavior and passes existing browser coverage.
- Target good field Core Web Vitals at the 75th percentile: LCP at most 2.5 s, INP at most 200 ms, and CLS at most 0.1.

Performance remediation that requires a major explorer architecture change gets its own follow-up spec. This SEO scope includes low-risk payload reductions and measurement, not a rewrite.

## 16. Tests and Release Verification

Automated coverage must prove:

- canonical origin resolution prefers `https://fiscal.ge` in production;
- title/description builders derive year ranges from facts;
- municipality and region titles use reviewed grammatical labels;
- every sitemap URL is unique, uses Fiscal.ge, and corresponds to an indexable route;
- `/about` is in the sitemap;
- JSON-LD builders return required types and absolute URLs;
- serialized JSON-LD is safe;
- dataset descriptions and distributions satisfy the local schema contract;
- stable downloads have BOM, expected headers, correct rows, and source/basis metadata;
- municipality and entity-picker destinations have real `href` values;
- social metadata includes an absolute 1200×630 image and large-image card;
- no indexable page accidentally emits `noindex`.

Release gates:

1. Focused unit and browser tests.
2. `npm.cmd run check`.
3. `npm.cmd run build`.
4. `npm.cmd run test:browser`.
5. `git diff --check`.
6. Draft PR, required CI, review, merge, and production deployment.
7. Live verification on Fiscal.ge, including robots, sitemap, metadata, structured data, downloads, console errors, and representative mobile/desktop pages.
8. Search Console submission and URL Inspection evidence.

## 17. Success Criteria

The first SEO release is complete when:

- Fiscal.ge serves indexable 200 HTML with internally consistent canonical, sitemap, robots, social, and structured-data URLs.
- All intended HTML pages have unique Georgian titles, descriptions, self-canonicals, social images, and the required structured data.
- All 64 municipality pages and 11 region pages are reachable through real links.
- Search Console accepts the sitemap and the representative live inspections report indexable pages.
- Three stable, validated, BOM-safe dataset downloads are public and represented as `DataDownload` distributions.
- The trust page and Georgian explanatory copy are live.
- Required repository checks and live-route verification pass.
- A dated baseline report exists for future comparison.

Ranking, traffic, or rich-result appearance is not claimed as an immediate release outcome. Those depend on crawling, competition, query demand, and external references and are monitored after release.

## 18. Explicit Non-Goals

- No broad data catalog.
- No blog or CMS.
- No generated page for every filter, year, category, ministry, or program.
- No English version or `hreflang` in this release.
- No paid-link or bulk-directory campaign.
- No unreviewed 2026 plan data added for keyword freshness.
- No direct database changes.
- No analytics vendor added without a separate privacy decision.
- No promise of rankings or rich results.
