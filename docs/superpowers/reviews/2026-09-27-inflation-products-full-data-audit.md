# Product inflation data: independent audit

Date: 2026-09-27. Scope: the August 2026 Geostat product-index archive, reviewed 2015-onward current-product catalogue, identity decisions, canonical facts, and validation report. This is an audit of the local data foundation; the product explorer has not been published. Two independent read-only reviewers examined numeric/source fidelity and product identities separately. The coordinating review inspected the preparation and validation code and reran the targeted repository checks. No canonical data or mapping was changed.

## Opinion

**No incorrect canonical index, missing current product, duplicate fact, or confirmed false historical link was found.** All 84,056 canonical fact cells were independently compared with their original English workbook locators. The four live files linked by Geostat matched the four archived files byte for byte. This establishes full *source fidelity* for the current vintage. It cannot certify the accuracy of Geostat's underlying price collection, unchanged retail specifications, or the semantic equivalence of every English and Georgian label.

Three review points remain before an unconditional product-page sign-off: two conservative history splits that merit one final identity decision, one materially inconsistent official bilingual label, and a future-refresh arithmetic coverage gap. None is a detected wrong numeric fact.

## Coverage and evidence

| Check | Independent result |
| --- | --- |
| Official vintage | The four current links on [Geostat's English](https://www.geostat.ge/en/modules/categories/293/consumer-price-detail-indices) and [Georgian](https://www.geostat.ge/ka/modules/categories/293/samomkhmareblo-fasebis-detaluri-indeksebi) detail-index pages returned files whose byte counts and SHA-256 hashes exactly match `docs/Raw Data/Inflation/geostat-products/2026-08/source-manifest.csv`. The [publication calendar](https://www.geostat.ge/en/calendar) schedules September 2026 CPI for October 2, so August is the latest published month on this audit date. |
| Current roster | 305 unique catalogue products. All 305 English names and order match Geostat's separate [2026 consumer-basket list](https://www.geostat.ge/media/80088/Inflation_methodology_short_ENG.html); five differ only in apostrophe typography. The catalogue's Georgian labels and two-digit groups match the archived Georgian workbook. |
| Canonical facts | Every one of 84,056 facts resolves to its stated original workbook cell and matches its value: 83,880 published numbers and 176 explicit `not_published` cells. No missing fact within an assigned product history or duplicate source-ID/locator pair was found. |
| Bilingual sources | Across all 2011–2026 year sheets, the English and Georgian editions agree on year-item order, group, 111,462 numeric comparison cells, and 770 annual unavailable markers. No formula or parity mismatch was found. |
| Historical identities | Independent chain traversal reproduces 29 links, 18 splits, zero unresolved boundaries, and no duplicate assignment. Of 305 current products, 287 trace to 2015, 11 begin in 2017, four in 2019, two in 2020, and one in 2023. The 29 accepted links pass all 319 January–November annual/monthly boundary checks; maximum error is 0.000288347 index points. |
| Arithmetic inside committed facts | All 38,673 annual indices for which the 2015-floor facts contain a verified 12-month path reconcile; maximum error is 0.000583342 index points, below the 0.002 guard. |
| Additional 2014-backed check | Of the report's 3,179 `arithmeticUncomparable` cells, 3,157 are January–November 2015 and can be checked against the archived 2014 monthly workbook with exact bilingual identity. All pass the same guard; maximum error is 0.000612395 at English `2015!F68`. The remaining 22 are the first 11 annual months for each of the two disputed splits below. Their candidate predecessor paths also reconcile, but are not accepted identity links. |
| Wider archive arithmetic | 51,628 annual source values with an exact bilingual 12-month path reconcile; none exceeds 0.002 index points. Cells without such a path were not counted as passes. |

The repository's `npm run data:check-inflation-products` and `npx tsx scripts/audit-inflation-products.ts --check` both passed. Four focused product-source/identity/preparation test files passed (29 tests). These built-in checks were separate from the independent workbook and CSV comparisons above. The worktree was clean at the start of the audit; this note is the sole audit change.

## Findings

### Important: two conservative splits deserve a final identity review

- `identity.p0179.2019` in `data/mappings/inflation-products/decisions.csv`: 2018 **Coffee set / ყავის სერვიზი** (`C184`) becomes 2019 **Coffee cup with saucer / ყავის ფინჯანი ლამბაქით** (`C184`). The current decision starts p0179 in 2019 and omits 2015–2018 (96 potential monthly/annual fact rows). All 11 January–November 2019 annual indices reconcile through the earlier source path; maximum difference is 0.000103313 index points. January's published `2019!D184` is 103.9718 versus 103.971843 reconstructed.
- `identity.p0269.2020`: 2019 **Tourist trip / ტურისტული მოგზაურობა** (`C273`) becomes 2020 **Tourist trip abroad / ტურისტული მოგზაურობა ქვეყნის გარეთ** (`C272`). The current decision starts p0269 in 2020 and omits 2019 (24 potential rows). All 11 January–November 2020 annual indices reconcile through the earlier path; maximum difference is 0.000145410. January's published `2020!D272` is 94.2905 versus 94.290505 reconstructed.

The other 16 splits have the first-year January–November annual-unavailable pattern. These two instead have continuous published annual indices, just as the accepted rename links do. Yet “set” versus “single cup” and “tourist trip” versus “abroad” are materially different descriptions. This is evidence for continuous *statistical series*, not proof of unchanged retail specifications. The cautious split is defensible, but the reason should be confirmed consistently before using these histories in the public explorer. Do not alter the approved mapping automatically.

### Important: one official bilingual label is semantically inconsistent

Catalogue p0148 (line 149) reproduces Geostat's **Chipboard / თაბაშირ-მუყაოს ფილა** at 2026 `C151`. The Georgian describes gypsum/plasterboard rather than wood chipboard. Geostat's separate English 2026 basket also says “Chipboard,” so this is a source-level ambiguity, not a transcription error. Preserve the original labels for provenance; seek Geostat clarification or disclose the ambiguity before presenting them as equivalent goods.

### Important for future refreshes: 2014-backed annual checks are not automated

`data/reports/inflation-products-validation.json` correctly reports 3,179 annual cells as uncomparable **from the public 2015-floor fact file**. However, 3,157 of those can be checked from the already archived 2014 source and passed independently in this audit. The preparation guard currently checks only the 38,673 annual cells with 12 months inside the canonical file. Extending it to the 2014-backed cells would retain this audit assurance automatically on future source refreshes. The remaining 22 depend on the two identity decisions above.

### Lower priority

`docs/superpowers/reviews/2026-09-26-inflation-products-identity-proposals.md` still describes the canonical facts as unwritten. That status sentence is stale; it does not affect the data.

## Specific decisions and limits

The user-approved p0088 **sparkling mineral water** link to the earlier generic **Mineral water / მინერალური წყალი** has all 11 2019 boundary comparisons within 0.000244642 index points. p0089 **still mineral water** remains separate from 2019; its January–November 2019 annual cells are explicitly unavailable. No contrary source evidence was found.

Six accepted links have broader or narrower descriptions (milk p0029/p0030, butter p0038, cheese p0033, toy p0244, khinkali p0279). Their published annual indices reconcile across the boundary. Geostat's [2018 basket announcement](https://www.geostat.ge/en/single-news/1047/consumer-basket-2018) also says that the 2018 basket was unchanged from 2017, supporting the first three as index-series continuities. Neither fact proves a fixed brand or product specification. Geostat's [CPI technical manual](https://www.geostat.ge/media/80168/CPI_Methodology_ENG.html) describes replacement and quality adjustment within price collection.

The report's 37 source year-item rows outside the current trace since 2015 are **rows**, not 37 distinct retired products. They also include prior labels intentionally excluded by splits. The current catalogue contains every item in the latest 2026 basket once and omits the unassigned historical rows by design.

**Assurance boundary:** this audit verifies transcription, source parity, coverage, arithmetic where comparable, and documented identity decisions. The sources examined did not provide a row-level historical identity crosswalk or the underlying observed retail prices and specifications. A literal 100% guarantee of real-world data validity is therefore unavailable. The reviewed data is suitable as an accurately reproduced Geostat index dataset, with the three findings above resolved or disclosed before public presentation.
