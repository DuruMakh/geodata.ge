# GeoData methodology portal design

**Status:** Approved 2026-08-11

**Approved visual direction:** Variant D, Editorial Fieldbook

**Preview:** `design-shotgun/methodology-portal-2026-08-11/variant-d.html`

## 1. Purpose

GeoData needs a public methodology and source centre that scales beyond the current budget explorer. It must explain every material data decision, make untouched upstream source files downloadable, and organize both by dataset rather than as one long technical document.

The first release covers:

- state expenditure;
- state revenue;
- municipalities.

The information architecture must later accept inflation, GDP, population, unemployment, and other datasets without redesigning the system or implying that unavailable data already exists.

The experience is a balanced portal. Public explanation and original-source access have equal weight. A visitor should be able to understand what a dataset means without technical knowledge, while a researcher should be able to inspect the complete decision record, validation approach, limitations, and source archive.

This approval extends the current product scope beyond minimal source labels to dedicated public methodology and original-source pages. It does not re-expand GeoData into a broad data catalog: only datasets that are already live receive methodology routes.

## 2. Approved decisions

### 2.1 Discovery

- Methodology is not a top-header navigation item.
- The methodology hub and all live dataset methodology routes show the same public-site header as the landing page above their page content. The shared header keeps `GeoData`, `მთავარი`, `ექსპლორერი`, the loaded site coverage range, and the existing responsive rule-based anatomy.
- Neither `მთავარი` nor `ექსპლორერი` is active on methodology routes: neither link receives the accent underline or `aria-current`, because methodology is a separate destination. No methodology tab is added.
- The landing page and methodology routes use one shared header component so their typography, spacing, responsive behavior, links, and coverage context cannot drift. The landing page retains `მთავარი` as its active link.
- The current landing footer gains a simple `მეთოდოლოგია` link to `/methodology`.
- Methodology pages reuse the current footer anatomy and include the same link; extracting that existing anatomy into a shared component is allowed, but changing its layout or content system is not.
- Relevant main data pages end with a substantial methodology promotion. Where a current footer exists, the promotion sits above it; explorer surfaces do not gain a new global footer in this scope.
- The promotion is a full editorial section with breathing room, document imagery, source-to-data context, and one direct link. It is not a narrow horizontal strip, a small utility notice, or a generic card.
- Footer redesign is outside this work. Only the methodology link is in scope.

### 2.2 Routes

- `/methodology` — methodology hub.
- `/methodology/expenditure` — state expenditure.
- `/methodology/revenue` — state revenue.
- `/methodology/municipalities` — municipal data.

Future datasets appear on the hub only as non-clickable `მალე` markers. They get a route only when the dataset, public methodology, validation record, and source archive are ready together.

### 2.3 Reading model

Category pages use layered reading:

1. plain-language summary;
2. dataset scope and definitions;
3. source-to-data process;
4. complete reviewed methodology decisions;
5. classification and transformation rules;
6. validation and reconciliation;
7. known limitations and coverage gaps;
8. untouched upstream source archive.

Technical detail stays available on the page. It is not hidden exclusively in downloadable developer documentation.

### 2.4 Download boundary

Methodology downloads are untouched upstream originals only. For the budget datasets these are official government documents; municipality methodology may also include original licensed geometry or other non-government upstream sources. GeoData-produced or normalized CSV files remain on the relevant explorer surfaces and must not be labelled as raw originals.

Each live category provides:

- individual official-file downloads;
- text search and quick year filters;
- a category-level ZIP containing every original;
- a machine-readable and human-readable manifest;
- retrieval date, byte size, media type, original URL or archive location, and SHA-256 for every file.

## 3. Information architecture

### 3.1 Hub

The hub opens with the explicit title `მეთოდოლოგია და პირველწყაროები`, a concise trust statement, and an open-document visual showing the path from source to published data. It then presents the live datasets as rule-separated editorial rows rather than a card mosaic.

Each live row exposes only information useful for choosing a destination:

- category name and one-line scope;
- served coverage range, derived from data;
- current original-file count, derived from the manifest;
- last methodology review date, derived from content metadata;
- link to the category page.

The initial rows are:

1. `ხარჯები`;
2. `შემოსავლები`;
3. `მუნიციპალიტეტები`.

Below the live rows, a quiet future-data index shows non-clickable `მალე` entries for inflation, GDP, population, and unemployment. These are direction markers only: no page, archive, count, coverage claim, or disabled link is rendered.

### 3.2 Category page

Every category page follows the same anatomy while allowing dataset-specific content:

1. breadcrumb;
2. category title and plain-language definition;
3. key facts: period, frequency, basis or measure, and unit;
4. prominent disclosure distinguishing official facts from GeoData classifications;
5. sticky in-page contents on desktop, normal-flow contents on mobile;
6. `რას ზომავს`;
7. official source families;
8. a numbered source-to-data journey;
9. full decision record;
10. classification and transformation rules;
11. validation and reconciliation;
12. known limitations and exclusions;
13. original-source archive.

The decision record is grouped by topic for scanning. Every decision stated in the canonical repository methodology documents must have a public entry or an explicit row in a same-page technical appendix; operational commands that carry no methodological choice do not count as decisions. Native `details` disclosures may collapse explanations, but decision titles and status remain visible without interaction.

### 3.3 Page-to-methodology mapping

The substantial promotion appears on primary public surfaces:

| Public surface | Promotion target |
|---|---|
| `/` | `/methodology` |
| `/explorer` | `/methodology` |
| `/explorer/expenditure` | `/methodology/expenditure` |
| `/explorer/revenue` | `/methodology/revenue` |
| `/explorer/municipalities` | `/methodology/municipalities` |
| `/explorer/analysis` | the methodology page for the active analysis side |

Municipality and region detail pages retain a compact contextual methodology link with their source note instead of repeating the full pre-footer promotion on every one of the 75 detail routes. This keeps the large visual section on main pages, as approved, while preserving direct methodology access from detailed data.

## 4. Visual design

Variant D combines Variant A's information architecture with Variant C's visual and explanatory personality.

### 4.1 System

- Reuse `DESIGN.md` v4.1 tokens: warm paper, ink, terracotta accent, serif display, sans UI, mono metadata.
- Content sits directly on paper with the existing rule hierarchy.
- No gradients, container shadows, rounded card system, night theme, or additional accent palette.
- Document illustrations are CSS or inline SVG compositions using the approved tokens. They are explanatory, not decorative stock imagery.
- Display headings use Noto Serif Georgian; UI copy uses Noto Sans Georgian; counts, dates, hashes, sizes, and metadata use Geist Mono.

### 4.2 Hub hero

The hero uses a two-column desktop composition:

- left: overline, explicit page title, one short statement, and a jump link to the dataset index;
- right: an open document with source lines, a simple data trace, and the annotation `SOURCE → METHOD → CHECK → DATA`.

On mobile, text comes first and the document visual stacks below. The first heading must not clip, and the visual may reduce in height without losing its source-to-data meaning.

### 4.3 Dataset index

Live datasets are full-width rows separated by hairlines. Hover and focus may add the existing tint and a small horizontal shift. The whole row is the link.

This is not a license for cards outside the existing hub-card exception. Future items are plain muted text with `მალე` badges and no hover, focus, or pointer treatment.

### 4.4 Numbered method journey

The category page's main explanatory visual has four steps:

1. preserve the untouched official source;
2. read the source's year or structural era;
3. apply reviewed classification and transformation rules;
4. validate, reconcile, and publish.

Desktop uses a restrained vertical spine with numbered circular markers and mono process metadata. Mobile removes the decorative spine if needed but keeps the same order and labels.

### 4.5 Archive

The source archive remains a research tool, not a visual story:

- category ZIP action beside the archive introduction;
- underline-only search;
- quick year filters;
- a fixed newest-year-first table in the initial release, with no separate sort control;
- horizontally scrollable table on small screens;
- direct download action per row.

The initial visible columns are:

```text
Year | Original source/file | Format | Size | Retrieved | SHA-256 | Download
```

The exact official filename and original source organization remain available even if a shorter Georgian display title is added.

### 4.6 Pre-footer promotion

The promotion is a substantial two-column editorial section:

- one side: three overlapping source-document illustrations;
- other side: overline, strong methodology heading, a thin `SOURCE → METHOD → CHECK → DATA` lineage, short contextual copy, and one link.

It uses generous vertical space and stacks on mobile. It is neither a narrow horizontal strip nor a contained card. Where a current footer follows, that footer remains unchanged except for its methodology link.

## 5. Dataset content requirements

### 5.1 Expenditure

The public methodology consolidates the relevant decisions currently distributed across the expenditure, ministries, program, and historical-era documents. It must explain at least:

- served coverage begins in 2005;
- the reviewed 2004 source is excluded from the served series because it is central-budget scoped;
- 12-month actual execution is the public basis;
- actual wins when planned and actual coexist;
- official totals versus GeoData public-field classification;
- COFOG and older-classification era handling;
- ministry and program semantic eras and succession decisions;
- stable public IDs and official-label preservation;
- uncertain mappings go to `spending.other_unclassified` with notes rather than disappearing;
- annual reconciliation and validation boundaries.

### 5.2 Revenue

The page must explain at least:

- served coverage begins in 2005;
- top-level public categories are official budget-classification lines;
- old and new source-code eras and reviewed crosswalks;
- grants and internal-flow handling;
- the 2023–2025 workbook cross-check;
- actual/planned precedence;
- reconciliation, known source gaps, and validation boundaries.

### 5.3 Municipalities

The page must explain at least:

- 2015–2025 coverage;
- 64 served municipalities and 11 data-bearing region roll-ups;
- ten main functional categories;
- the official public-total series versus the sum of functional categories;
- why functional shares can sum below or above 100%;
- excluded codes `05`, `42`, `43`, `46`, and `64` and the territorial-attribution reason;
- regional aggregation and geography crosswalk rules;
- source families, encoding requirements, validation, limitations, and map-geometry provenance.

Future population and regional-GDP methodology remains a future dataset marker until its public data surface is approved. Its existing research package does not by itself create a live methodology category.

## 6. Content source of truth

The public pages are curated from, and must remain traceable to, the repository's canonical methodology and source records. They do not replace internal maintenance documents or copy implementation commands into public prose.

Initial canonical inputs include:

- `docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md`;
- `docs/data-methodology/ministries-expenditure-methodology.md`;
- `docs/data-methodology/ministries-drilldown-programs-methodology.md`;
- year- and era-specific expenditure methodology documents;
- `docs/data-methodology/revenue-methodology.md`;
- `docs/data-methodology/municipal-functional-annual-2015-2025.md`;
- `data/sources/source-documents.csv`;
- source manifests and immutable originals under `docs/Raw Data/`.

Each public category record carries:

- stable category ID and route slug;
- Georgian title and summary;
- review date;
- live/future state;
- ordered content sections;
- explicit disclosures;
- references to canonical internal documents;
- source archive manifest ID.

Coverage ranges, source counts, byte totals, and latest retrieval/review dates are derived, never typed into page components.

## 7. Source archive generation

The deployed application remains static. Original downloads and ZIP archives are therefore prepared deterministically before the Next.js build.

The preparation step:

1. reads a reviewed per-category manifest;
2. resolves every source path under approved `docs/Raw Data/` roots;
3. rejects traversal, missing files, duplicate public paths, duplicate IDs, and hash mismatches;
4. verifies the reviewed redistribution status and required attribution for every entry;
5. copies source bytes unchanged into the generated public-download tree;
6. writes `manifest.csv` with UTF-8 BOM for direct Excel use and `manifest.json` for machine use;
7. creates one deterministic category ZIP with entries sorted by public path;
8. emits a validation report with file count, total bytes, formats, year coverage, licence status, and hash status.

The generated public tree is a build artifact and is not a second human-edited source of truth. The originals remain under `docs/Raw Data/`; the reviewed manifest controls publication.

Minimum manifest fields:

```text
source_id
dataset_id
year
source_organization
display_title_ka
official_filename
official_url_or_archive_url
repository_source_path
public_download_path
media_type
byte_size
sha256
retrieved_at
license_id
attribution_text
redistribution_status
notes
```

The implementation plan must include an early deployment-size check using the generated archive output. If the static host cannot safely serve the full archive, the approved product behavior stays the same and only the byte host changes; the public manifest and URLs remain deterministic.

## 8. Component and route boundaries

The implementation should use small shared units:

- `MethodologyHub` — title, visual, live dataset index, future markers;
- `MethodologyArticle` — layered category content and sticky contents;
- `MethodJourney` — four-step explanation;
- `DecisionRecord` — grouped native disclosures;
- `SourceArchive` — ZIP action, search, year filters, and file table;
- `MethodologyPromo` — substantial context-aware pre-footer section;
- typed methodology catalog and manifest loader;
- static `/methodology/[dataset]` route generation for live categories only.

Dataset-specific public copy and decision records remain data/content, not conditionals embedded throughout shared layout components.

## 9. States and accessibility

- Georgian is the primary language and must remain readable at every breakpoint.
- All interactive rows, filters, disclosures, and downloads have visible keyboard focus.
- The whole live dataset row is one link; nested links are not allowed.
- Future dataset markers are plain content, not disabled anchors.
- Native `details` preserves keyboard and screen-reader disclosure behavior.
- Search has an explicit accessible name and a visible zero-results message.
- Year filters expose pressed state.
- Source tables retain real table semantics and use horizontal overflow on narrow screens.
- Download actions include file title and format in their accessible names.
- Motion is limited to small hover/reveal changes and snaps off under `prefers-reduced-motion`.
- A manifest or file-integrity failure fails the build; the page must not publish a broken download row.

## 10. SEO and sitemap

- The hub and three live category pages receive Georgian titles, descriptions, canonicals, and open-graph metadata.
- Only live category routes enter the sitemap.
- Future markers create no route, canonical, sitemap entry, or structured-data claim.
- Category pages may expose a `Dataset` structured-data record only when its download URLs and coverage are derived from the validated manifest and served data.

## 11. Verification and acceptance criteria

### 11.1 Content

- Every decision in the canonical category methodology has a public entry or an explicit row in a technical appendix on the same page; purely operational commands are excluded from this requirement.
- Official facts and GeoData classifications are clearly distinguished.
- Coverage, basis, units, exclusions, limitations, and last review date are visible.
- Prepared GeoData CSV files are not presented as raw originals.

### 11.2 Archive integrity

- Every public source row resolves to an unchanged source file.
- Manifest byte sizes and SHA-256 values match the published bytes.
- ZIP contents equal the individual published file set plus manifests.
- Manifest generation is deterministic and reaches a clean fixed point.
- Georgian human-facing manifest CSV begins with a UTF-8 BOM.
- Every published byte has reviewed redistribution status and preserves required attribution and licence metadata.

### 11.3 Navigation and UX

- No methodology item appears in the top header.
- The current landing footer and methodology-page footer anatomy link to `/methodology` without a broader footer redesign or a new global explorer footer.
- Main surfaces use the approved substantial pre-footer promotion and correct context target.
- Municipality and region detail pages expose a compact contextual methodology link.
- Future markers are non-clickable and announced as `მალე`.
- Hub, category article, archive filters, tables, and promotion work at desktop and mobile widths.

### 11.4 Engineering gates

- lint;
- TypeScript check;
- unit tests for catalog and manifest validation;
- data validation, including hashes and deterministic ZIP output;
- static build;
- browser tests for routes, contextual links, archive filtering, disclosures, downloads, keyboard focus, and mobile layout;
- required hosted CI;
- post-merge production checks for all live routes and representative individual/ZIP downloads.

## 12. Out of scope

- redesigning the site footer;
- adding methodology to the top header;
- publishing empty pages for future datasets;
- presenting normalized or filtered GeoData CSV files as original sources;
- changing existing data classifications or methodology decisions during page implementation;
- adding authentication, an admin editor, a public API, or user uploads;
- building future inflation, GDP, population, or unemployment data surfaces;
- changing the explorer's data behavior beyond contextual methodology links and the approved promotion.
