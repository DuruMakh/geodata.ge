# Fiscal.ge: complete Georgian and English experience

**Status:** design draft for owner review. The overall direction, Georgian default with `/en`, and inclusion of the AI connection and its public data are approved in conversation. The detailed design below is proposed for review; implementation has not started.

**Date:** 2026-09-05

**Repository baseline inspected:** `1cf524f29` (PR #101). Counts below describe this checkout, not a permanent coverage limit.

## 1. Outcome and approved scope

A reader can discover Fiscal.ge, explore any current dataset, understand its limitations, and download usable data in either Georgian or English. An AI client can obtain reviewed names and explanations in both languages from the same service. Switching languages never changes what a number measures.

Approved decisions:

- Georgian stays at all existing page addresses; English equivalents use `/en`.
- English covers the complete public website and its interactions, Excel downloads, and the AI connection's responses and labelled data publications.
- Both languages use the same reviewed facts, calculations, source documents, and editorial design.
- English uses clear international wording, with the existing British spelling convention for authored prose. Official names retain their established spelling.
- The language switch preserves the current page and shareable explorer settings.
- Original source files remain original. Their descriptions are translated and their document language is identified where verified.

This is localization of existing capabilities. It adds no dataset, currency conversion, account system, public REST service, on-site AI assistant, or automatic production translation service.

## 2. What the current implementation provides

The current code offers reusable foundations, but it does not yet provide an English experience:

| Foundation | Observed state | Design consequence |
|---|---|---|
| National taxonomy | 14 revenue entries and 13 spending entries have English labels | Use these as translation seeds; verify which entries are publicly served and review their wording. |
| Ministry groups | 14 administrative categories have English labels | Review terminology and reuse stable identifiers. |
| Major programmes | `adminFactForModel` assigns the Georgian official label to both language fields | Author reviewed English display names and the historical-name translations actually exposed to readers. |
| Municipal content | 10 functions, 11 regions, and the municipality import have Georgian-only label fields | Add English presentation records without changing budget imports or database tables. |
| Page shell and search metadata | Root HTML language, navigation, descriptions, and structured data select Georgian | Make the document language and all public text explicit per language. |
| Excel | Model and writer use Georgian names, headings, units, and statuses | Localize the existing export pipeline while retaining the workbook structure and values. |
| AI connection | Nine tools serve six dataset families; labels and several explanations are Georgian-only; caveats and errors already contain both languages | Complete the existing contract through additive bilingual fields and text output. |
| Machine CSVs | Exporters use stable identifiers and machine field names | Keep one shared set; explain their fields in both connection-page versions. |

Inventory owners include `apps/web/app/`, `apps/web/components/`, `apps/web/lib/explorer/`, `apps/web/lib/methodology/`, `apps/web/lib/seo/`, `apps/web/lib/factQuery/`, and `apps/web/lib/mcp/`.

## 3. Public pages and addresses

Every existing indexable public page gets an English counterpart:

| Page family | Georgian address | English address |
|---|---|---|
| Home | `/` | `/en` |
| Data hub | `/explorer` | `/en/explorer` |
| Expenditure, revenue, analysis, debt, deficit | `/explorer/{section}` | `/en/explorer/{section}` |
| Municipality index | `/explorer/municipalities` | `/en/explorer/municipalities` |
| Country municipal aggregate | `/explorer/municipalities/georgia` | `/en/explorer/municipalities/georgia` |
| Municipality | `/explorer/municipalities/{slug}` | `/en/explorer/municipalities/{slug}` |
| Region | `/explorer/municipalities/region/{id}` | `/en/explorer/municipalities/region/{id}` |
| Methodology hub and live subjects | `/methodology` and `/methodology/{dataset}` | `/en/methodology` and `/en/methodology/{dataset}` |
| About and AI connection | `/about`, `/connect` | `/en/about`, `/en/connect` |

Keep the existing Latin municipality slugs and region identifiers. Generate both language route sets from the same loaded entity and methodology lists. Coverage and dates remain derived from the data.

Keep `/mcp`, `/downloads/`, `/sitemap.xml`, `/robots.txt`, and `/llms.txt` shared. There is no `/en/mcp` endpoint or second numerical data pipeline. Only actual public page links receive a language prefix. Asset URLs, archive URLs, email links, official external links, and protocol endpoints do not.

Existing municipality-code redirects remain. English code addresses redirect to the corresponding English slug addresses. Preserve query strings and explorer fragments, including across these redirects. Existing legacy hash navigation must also resolve within the chosen language.

## 4. Language switching and navigation

The page address determines its language, including direct visits and reloads. Do not redirect visitors based on location, browser settings, or a remembered language. The English address itself is a bookmarkable preference.

Use the text control **ქართული / English**, with a clear active state and language-specific accessible names. Reuse the existing editorial control styling. Provide it in the public header, expanded explorer sidebar, and mobile explorer navigation. The collapsed desktop rail offers an accessible `EN`/`KA` language link without requiring expansion.

Switch to the same page while preserving its query string and full explorer hash. National grouping, selected series, year range, measure, chart/table mode, single-year settings, and the equivalent municipal, debt, and deficit settings must survive using their existing serializers. Do not translate IDs or hash keys. A temporary search-box query and open menu are not persistent analytical settings.

Header, sidebar, footer, breadcrumbs, related links, entity navigation, methodology links, and recovery links keep the chosen page language. Both-language name search works within the existing search scopes. It must not change selector ordering, bulk-action scope, or denominators. Preserve IDs, approved aliases, and the recent MCP ambiguous-name regression fixes; do not invent fuzzy aliases.

## 5. Page architecture and static rendering

Use two thin route trees with shared page renderers and components:

- `app/(ka)/...` serves existing URLs with a Georgian root document.
- `app/(en)/en/...` serves English URLs with an English root document.
- Shared root presentation owns fonts, global styles, analytics, and language-aware site metadata. Each root supplies the appropriate `html lang` and content dictionary.
- Existing route-specific page logic moves into shared renderers only where needed by both route trees. Thin wrappers pass the language; calculations and large page implementations are not copied.
- Route handlers and shared metadata files stay at their current public addresses. All explorer and content pages remain prerendered; `/mcp` remains the sole request-time application route.

There is no request-time language middleware and no use of request headers or cookies to choose page content. Pass locale explicitly to server-side renderers, calculations that return display copy, metadata builders, and export builders. A small client context can distribute the active locale and the route's relevant messages to interactive children. Numerical calculations remain language-independent.

Next.js documents a full document navigation between different root layouts. This is acceptable when switching languages: the destination restores analytical settings from the URL. Navigation within each language retains the existing app navigation behaviour.

The shared unmatched-URL response is a small, static bilingual 404 with clearly marked Georgian and English recovery links and correctly marked language sections. Known page-level missing-content states use the current language. Use Next.js `global-not-found` for the multiple-root global response; its `experimental.globalNotFound` setting is a bounded framework risk to verify in the first production-build checkpoint. Confirm real 404 status, no indexing, styling, and recovery under both URL prefixes. Do not turn unknown URLs into runtime page rendering.

Use lightweight typed dictionaries and explicit route helpers with existing dependencies. Two languages and the present message complexity do not require a translation platform or an additional localization library.

## 6. Translation ownership and completeness

Create a presentation-only English catalogue under `data/localization/en/`, with separate files for entity/series names and source/document descriptions. Stable category, programme, entity, source, and document IDs are the lookup keys. Historical programme label variants additionally use the actual served year. They must not derive identity from translated text or manufacture continuity across definition changes.

Seed this catalogue from existing English labels, then review it. It becomes the English public-display authority for these records. Existing mirrored `enLabel` fields remain legacy data fields; public renderers, exports, and the AI snapshot consume the new catalogue consistently rather than choosing between competing English sources. Georgian names continue to come from current reviewed data and public-copy owners.

Keep interface dictionaries under `apps/web/lib/i18n/`, organized by the actual public sections. Extract current Georgian strings without rewriting approved copy. English dictionaries use the same typed keys. Store long methodology translations alongside the existing methodology content, linked by the same section and decision IDs.

The presentation catalogue loads at build time and is applied after either CSV or database loading. It needs no database schema change, direct database edit, or new data import. Both data modes must produce the same localized public labels from the same catalogue.

Build-time validation checks:

1. Every shared message key has both language entries and matching interpolation requirements.
2. Every served public series, total, entity, source, and document has the required English presentation record. Include aggregate-only entities where the public source catalogue exposes them.
3. Every displayed historical programme-name variant is covered.
4. English methodology has every public section, decision, limitation, appendix entry, and source description in its Georgian counterpart.
5. English text does not silently fall back to Georgian or a technical identifier.

Allow explicitly marked original-language quotations and original document titles where they help identification. English explanations must accompany them. Brand names and stable machine identifiers are also valid exceptions. Record exceptions specifically; a broad Georgian-text allowance would hide missing translations.

Runtime visitors never receive an automatic translation. Translations may be drafted with assistance during authoring, then checked for meaning, terminology, and source fidelity before acceptance. Review representative homepage copy, explorer terminology, a methodology decision, programme names, and an exported workbook before extending the wording across all sections.

## 7. Editorial, financial, and visual rules

Translate complete sentences and templates rather than concatenating translated words. This includes municipal ranking summaries, period comparisons, chart descriptions, accessibility text, plural forms, and source-period labels.

Use clear English for international readers, with precise accounting terminology. Review the receipts page and total carefully: financing items mean a blanket translation as ordinary revenue can mislead. Preserve distinctions between state-budget expenditure, consolidated budget receipts, government debt, and the general-government balance. The English glossary may use a more precise display title without changing Georgian copy or stable data IDs.

Retain actual-versus-planned precedence, projections, preliminary statuses, missing values, genuine zeros, signed deficit values, nominal amounts, GDP denominators, the municipal/Adjara boundaries, and all comparability caveats. Translation never changes any of those rules.

Keep the warm editorial colours, layout hierarchy, chart forms, selection behaviour, and existing hero assets. Fonts already request Latin and Georgian subsets; inspect the actual English rendering before adding or changing fonts. Check long ministry names and small-screen controls. Translate visible text embedded in any image or SVG asset that needs it, while preserving the approved composition.

Preserve numerical precision, scaling thresholds, minus signs, missing-value symbols, and machine numeric types. English displays use `GEL`, `million`/`billion` in explanatory text, and `mln`/`bn` where chart space is constrained. Existing number grouping and decimal behaviour stay consistent. Use unambiguous dates such as `5 September 2026`; machine dates retain ISO format. Language changes do not convert currencies.

## 8. Methodology, archives, and Excel

Translate the complete existing public methodology, including technical appendices where publicly exposed. English readers get the same source links and decision coverage. Internal operational documents do not need parallel translations.

Source descriptions distinguish a translated display title from the untouched original. Record the original document language only when verified; use an explicit unknown value otherwise. Preserve publisher identity, source coverage, derivation roles, archive addresses, retrieval dates, file hashes, licence identity, and attribution requirements. Translating a description does not make the attached document an official English publication.

Reuse the current workbook model/writer with locale-aware display fields. Generalize Georgian-specific presentation property names where necessary inside that export pipeline; retain data fields and numerical logic.

English workbooks have exactly three sheets: `Summary`, `Data`, and `Sources`. The readable sheet stays category-by-year and opens first. The analysis sheet uses `Year`, `Group`, `Category`, `Amount (GEL)`, and `Status`, with the appropriate GDP-share or interest-rate column for the active measure. Labels, status text, titles, number-format annotations, source descriptions, and hyperlink text use English. Preserve genuine numeric cells, the debt-rate blank-amount rule, filters, frozen panes, hierarchy, and source lineage.

Georgian filenames retain their existing form; English files add `-en` before `.xlsx`. Both languages export the same active years, series, grouping, measure, and source selection. Both retain the existing restriction against internal metadata columns in public Excel downloads.

Raw machine CSV exports retain their current URLs, schemas, values, and encoding: their fields are identifiers rather than natural-language labels. The bilingual catalogue and connection documentation explain them. Original methodology manifests remain integrity records and do not acquire translated columns. Localized archive interfaces provide the readable descriptions.

## 9. Bilingual AI connection and public JSON

Keep one endpoint, `/mcp`, and the same nine tool names and input contracts. Return both languages through additive fields; do not require a new language argument. An English-speaking client can select reviewed English text without translating Georgian itself.

The additive contract is:

| Existing surface | Added bilingual support |
|---|---|
| Dataset, entity, series catalogue entries | English companions to every `labelKa`/`kaLabel` field, named `labelEn`/`enLabel` consistently with the existing shape. |
| Observations, comparisons, and rankings | `entityLabelEn` and `seriesLabelEn` beside existing Georgian fields, including entries for tie boundaries. |
| Observation definitions and comparison endpoint definitions | `valueDefinitionEn`; preserve the current Georgian `valueDefinition` field and the language-independent `valueDefinitionId`. |
| Sources | `nameEn` and nullable `derivationEn`, preserving existing `name` and `derivation`. |
| Source documents | `titleEn`, `publisherEn`, nullable `attributionEn`, and nullable `documentLanguage`, preserving original fields and legal attribution. |
| Catalogue exclusion descriptions | English companions for any Georgian prose; stable reason codes remain unchanged. |
| Publication notices | `noticeEn` beside existing `notice`, including the warning about totals and their component rows. |
| Caveats and errors | Retain and review the existing Georgian and English messages; update methodology links to expose an English counterpart through additive `methodologyRefEn` on caveats. |

Where an existing generic prose field is already English, retain it and add a Georgian companion if the Georgian description is absent. Language-neutral codes, IDs, URLs, enum values, and standard licence identifiers do not need translated copies. Schema declarations must enumerate the new public fields: relying on permissive object parsing is insufficient.

Apply this across catalogue discovery, national queries, ministries, municipalities, debt, deficit, comparisons, rankings, source resolution, response metadata, and both MCP output representations. The text representation includes both reviewed names and definitions, with bilingual source descriptions and caveats, while remaining a compact rendering rather than a second JSON dump. Update client guidance to explain language fields and show matching Georgian/English examples. The service provides facts and reviewed text; it still does not generate conversational answers itself.

Publish schema version `1.1.0` for the additive language contract. Preserve existing field names, numerical meanings, IDs, ordering, queries, and source resolution. Do not silently replace a Georgian value with English. Document that consumers which reject additional fields or pin an exact schema version may need to update; verify compatibility using existing requests and field-level assertions.

Build the service's required translations and definition templates into its snapshot so translations participate in `dataVersion`. A translation-only correction changes the version; a rebuild of identical content does not. UI-only wording need not change the service version. All service responses and JSON publications must resolve translations from that bundled snapshot, avoiding request-time reads of repository translation files or network translation calls.

Keep the current catalogue, source-resolution, manifest, and dataset JSON URLs. All six dataset families and the separate debt-rate publication carry the same bilingual contract, including supporting labels and prose. Regenerate manifest hashes and sizes from actual bytes. Files remain usable independently, with their sources, caveats, and notices attached. `llms.txt` describes the contract and links to both human-facing connection pages.

## 10. Operating limits and compatibility

Adding text increases payload size. Preserve the current input limits, 500-cell limit, 250-comparison-pair limit, ranking limits, 512 KiB complete-result cap, duration cap, rate limiter, and pause behaviour. The byte limit includes structured and text representations.

Measure representative and boundary-sized responses before and after localization. Keep shared document translations in the existing source/default structure where applicable. Do not drop sources, qualifications, Georgian fields, or English explanations to fit. An oversized response uses the existing explicit rejection and bulk-download guidance. The release report must identify representative requests that newly exceed the byte limit; matching the cell limit alone is not a promise that a response fits. Changing operating limits requires a separate justified decision.

Preserve security headers, archive noindex rules, endpoint behaviour, and the snapshot-only data-access boundary. Language support introduces no additional service or paid runtime dependency.

## 11. Search, sharing, and discovery

Each real language page has its own title, description, canonical URL, social image/alternative text, breadcrumb labels, and appropriate structured data. Canonicals point to the page's own language URL; English does not canonicalize to Georgian.

Each equivalent pair declares reciprocal `hreflang` entries for `ka` and `en`, plus `x-default` pointing to the existing Georgian page. A shared sitemap includes both language URLs and their alternates, generated from the same route inventory. Preserve content-derived freshness and include a genuine translation revision when that changes the localized page; a rebuild alone is not a content update.

Page language declarations describe the actual page. Machine dataset distributions containing bilingual labels describe both languages where relevant. Shared stable dataset identity and source/download URLs must not accidentally split one numerical dataset into conflicting identities. English links go to English methodology pages; original archive links remain shared.

Publish language alternates only when both pages contain their complete content. English titles and summaries use natural wording for Georgia the country and the relevant budget scope. This adds no thin page for each year/filter or new SEO-only content section.

## 12. Verification and acceptance

| Check | What must be demonstrated |
|---|---|
| Translation coverage | Every current public route and all dynamic records have English content; no unintended Georgian fallback or raw IDs in English display copy. |
| Numerical parity | Matched Georgian/English views and exports have identical values, units of measurement, missingness, status, ordering, and source selection. |
| Navigation | Direct entry, reload, switching, back/forward, legacy links, code redirects, internal links, and both-prefix 404 recovery work. Language switching preserves all URL-encoded analytical settings. |
| Search | Georgian and English names find the same intended entities/series in every existing search surface; ambiguous terms and bulk-action rules stay protected. |
| Browser and accessibility | Desktop and mobile page families, header/sidebar states, chart tooltips, keyboard controls, accessible names, and long labels are verified in both languages without clipping or new console errors. |
| Excel | Open actual generated workbooks from each explorer family. Verify all three sheets, localized annotations, numeric cells, active selections, percentages/rates, and working source links. |
| Search metadata | Correct initial HTML language, self-canonical, reciprocal alternates, sitemap coverage, structured data, social previews, and real noindex 404 responses. |
| AI contracts | Exercise all nine tools, structured and text output, labels, definitions, source defaults, caveats, errors, comparisons, ties, rankings, and bilingual discovery. |
| AI data integrity | Existing reference fixture and data/evidence assertions pass unchanged in meaning. Add language-specific assertions separately; do not rewrite expected numbers or comparability outcomes to accommodate a failure. |
| Publications and versions | All published files agree with the service snapshot; their hashes and sizes verify; translation changes affect the service data version deterministically. |
| Operating bounds | Result-byte checks include both representations; oversized responses fail explicitly; pause and rate-limit behaviour remain correct. |
| Static/performance | Production build confirms content pages are prerendered and `/mcp` is the only request-time route. Measure build growth, page payloads, fonts, and the bilingual service payload. Send only the route's necessary dictionaries and label sets to the browser. |

Implementation verification uses the repository's existing commands from `apps/web`: `npm run check`, `npm run build`, and `npm run test:browser`. Query changes additionally run `npx vitest run tests/factQuery/reference.test.ts`. Use an isolated local port and the configurable production-like browser base URL. Existing tests require intentional updates for moved route wrappers and added language fields, while preserving their behavioural and financial assertions.

Validation of this design document alone does not imply any of those implementation checks have passed.

## 13. Delivery sequence

1. **Foundation and representative translation:** establish the inventory, glossary, dictionaries, route roots, shared route helpers, and global recovery. Prove the static build and review representative English copy.
2. **One complete vertical slice:** implement expenditure, including fields and programmes, switching/state, methodology, sources, English Excel, metadata, and a matching bilingual service example. This establishes patterns for the rest.
3. **Complete public coverage:** extend shared patterns to all remaining page families, all nine tools and data publications, search, long-form methodology, source descriptions, and downloads. Public English launch waits for complete coverage.
4. **Verification and release preparation:** run the acceptance checks, review changes, and prepare the delivery evidence. Internal development may use several commits; deployment must not advertise a partially translated English site.

These are work packages within one bilingual release, not separate product launches. The implementation plan follows owner review of this design.

When publishing is authorized, use the existing branch, PR, required CI, review, merge, deployment, synchronization, and cleanup workflow. Verify the deployed commit, representative Georgian and English URLs, downloads, and live MCP responses separately. A merged PR or accepted deployment trigger is not proof of a bilingual production site. Roll back the website, snapshot, and publications as a matching release if necessary.

## 14. Canonical documentation updates

During implementation, add the approved bilingual scope in `Project_Definition.md` without rewriting the shipped V1 historical record. Update `DESIGN.md` where its current Georgian-only wording, accessibility labels, typography guidance, and Excel contract need explicit language variants. Retain the warm editorial rules and Georgian defaults.

Update the relevant methodology/runbook documentation for public label ownership, publication schema/version behaviour, verification, and release operations. Keep `AGENTS.md` concise; change it only if a durable always-relevant rule actually changes. Do not rewrite historical specs to make them appear to have included English already.

## 15. Technical references checked during design

- [Next.js App Router internationalization](https://nextjs.org/docs/app/guides/internationalization): dictionaries and prerendered language routes.
- [Next.js route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups): groups do not alter URLs; separate roots cause full document navigation.
- [Next.js missing-page conventions](https://nextjs.org/docs/app/api-reference/file-conventions/not-found): the experimental global missing-page response supports multiple roots and owns its full document.
- [Google multilingual site guidance](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites): distinct language URLs, complete page-language content, language links, and avoiding automatic language redirects.

Repository evidence: `apps/web/app/layout.tsx`, `apps/web/app/sitemap.ts`, `apps/web/lib/explorer/explorerData.ts`, `apps/web/lib/explorer/urlState.ts`, `apps/web/lib/explorer/workbookModel.ts`, `apps/web/lib/explorer/workbookWriter.client.ts`, `apps/web/lib/data/publicDatasetExports.ts`, `apps/web/lib/methodology/types.ts`, `apps/web/lib/factQuery/{types,observations,canonical,publications}.ts`, `apps/web/lib/mcp/{outputSchema,result,instructions}.ts`, and the matching test families.
