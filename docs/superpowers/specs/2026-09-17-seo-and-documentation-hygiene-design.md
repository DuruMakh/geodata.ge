# SEO metadata and documentation hygiene: specification

Date: 2026-09-17
Status: Draft for user review. Scope and packaging approved in conversation on 2026-09-17 after a reviewed audit of the work merged 2026-09-02..09-14.
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 7 of 8. No dependency on the other specs.

## 1. Outcome and scope

1. The GDP methodology page emits the same Dataset metadata as the other datasets. The sitemap dates the economy pages from their own data.
2. Comments, scope text and dead code stop contradicting the shipped product.

### 1.1 User-approved decisions (2026-09-17)

- Analytics stay unchanged: GA4, Microsoft Clarity, Vercel Analytics and Speed Insights (`components/site/site-analytics.tsx`, `components/site/root-document.tsx:48`). This spec covers only SEO and documentation.

### 1.2 Decisions taken in this spec

- Inflation keeps its hand-built Dataset JSON-LD. The shared vocabulary deliberately excludes it (`lib/seo/datasetVocabulary.ts:28-30`), and `tests/browser/inflation-overview.spec.ts:126` pins its shape.
- Scope text in `Project_Definition.md` is corrected to match what already ships. No scope is added.

### 1.3 Already fixed on `main`

Merges #118 and #120 fixed these audit items, so they are out of scope:
- the tool-count comment (`lib/mcp/tools.ts:3` now says twelve, and twelve are registered)
- the hard-coded "seven datasets" and coverage text in tool descriptions and server instructions
- the "29 codes" comment
- the misplaced "No seriesIds" comment (`lib/factQuery/schemas.ts:117` now sits above the deficit input)

## 2. GDP methodology Dataset JSON-LD

Evidence: `lib/pages/methodology-article.tsx:133-141` hand-builds Dataset JSON-LD for `gdp` and `inflation`. It drops the keywords and `variableMeasured`, and emits `distribution` as a single object. `lib/seo/datasetVocabulary.ts` now has a `gdp-overview` entry (`:98`) that `datasetJsonLd()` (`lib/seo/structuredData.ts:194`) can use.

Change:
- `gdp` renders through `datasetJsonLd` with the `gdp-overview` vocabulary: path, locale, coverage, dates and download as the other methodology articles pass them.
- The hand-built branch keeps only `inflation`.

Tests: the SEO tests (`tests/browser/seo.spec.ts` or `tests/seo/*`) assert that `/methodology/gdp` and `/en/methodology/gdp` JSON-LD carries `keywords`, `variableMeasured` and an array `distribution` with the GDP CSV.

## 3. Sitemap dates for the economy pages

Evidence: `lib/seo/sitemap.ts:70-72` gives `/explorer/economy`, `/explorer/economy/gdp` and `/explorer/economy/sectors` the budget `lastModified`. Inflation, debt and deficit derive their own dates in the same file (e.g. `inflationModified`, and debt at `:78-82`). A GDP or sectors data refresh therefore never moves those URLs' `lastmod`.

Change:
- GDP: the maximum `lastReviewedAt` of the GDP overview facts.
- Sectors: the maximum of the sector facts.
- Economy hub: the later of the two.
- Apply the same in the English list.

Test: the sitemap unit test (extend the existing one, or add `tests/seo/sitemap.test.ts`) asserts the three dates come from fixture facts, not the budget date.

## 4. Scope text — `Project_Definition.md`

Evidence:
- `:35` lists `მალე` markers for `უმუშევრობა`, `ინფლაცია`, `ეკონომიკური ზრდა` and `დემოგრაფია`. Inflation and economic growth (GDP and sectors) ship, and the sidebar shows two teasers (`components/shell/data-sidebar.tsx:18`).
- `:85-86` still lists "public debt" among datasets excluded in V2, although the debt explorer ships (`:34`) and `/mcp` serves `query_debt`.

Change:
- `:35` names only the teasers the sidebar shows.
- Remove "public debt" from the `:85-86` exclusion.
- No other scope line changes.

## 5. Comments and dead code

- **`lib/factQuery/index.ts:3-9`.** The comment says "Consumers import from here, never from a module inside the folder" and "The seven functions are pure". Both are false: `lib/mcp/tools.ts` and `lib/factQuery/publications.ts` import modules directly, and there are more than seven query functions. Reword to describe the real surface without a count, keeping the purity statement and the pointer to `tests/factQuery/purity.test.ts`.
- **`lib/methodology/catalog.ts:39-42`.** `FUTURE_METHODOLOGY_DATASETS` has no runtime importer; its only reference is the assertion `tests/methodology/catalog.test.ts:73-76`, which pins its value. Delete the export and those four assertion lines. This is the one test expectation this spec removes.
- **`lib/explorer/inflationGrid.ts:44-56`.** `luminance` and the exported `contrastRatio` serve only `tests/explorer/inflationGrid.test.ts` and `tests/explorer/inflationCategoryGrid.test.ts`. Move them to `tests/helpers/contrast.ts` and point both tests at it. `lib/explorer/colors.ts:160-174` keeps its own private runtime luminance function, which is used in production.
- **Dense one-line code.** Reformat to the surrounding style, one property or statement per line, with no logic change:
  - `lib/factQuery/queryEconomicSectors.ts`, whole file
  - `lib/db/servedDataDb.ts:104`
  - `lib/db/mirrorRows.ts:459-462`
  - `lib/seo/datasetVocabulary.ts:97-98`
  - any remaining single-line builders in `lib/factQuery/publications.ts`, `lib/factQuery/describeCoverage.ts` and `lib/mcp/tools.ts`

  `lib/factQuery/queryGdp.ts` is already formatted and is excluded.

## 6. Non-goals

- Analytics, consent and privacy pages (user decision above).
- Inflation JSON-LD shape.
- Any wording change in user-facing copy.

## 7. Documents to update in the same change

- `Project_Definition.md`: §4 of this spec.

## 8. Verification and acceptance

- Feedback: run the sitemap and SEO unit tests, then `npx playwright test tests/browser/seo.spec.ts` with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`.
- Done-check: `npm run check`, `npm run build`, `npm run test:browser` on the production-build recipe.
- Acceptance:
  - GDP methodology JSON-LD comes from the shared builder.
  - Economy sitemap dates follow their data.
  - `Project_Definition.md` no longer contradicts shipped datasets.
  - `FUTURE_METHODOLOGY_DATASETS` and the test-only runtime helpers are gone.
  - Reformatted files have no behaviour change: all existing tests pass unchanged, except the removed `catalog.test.ts` assertion and the two grid tests' import path.

## 9. Authority and next step

This spec owns the bounded decisions in §1. `Project_Definition.md` stays the scope owner and is corrected in the same change. After user review, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-seo-and-documentation-hygiene.md`.
