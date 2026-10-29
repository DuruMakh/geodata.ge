# F08: describe_coverage search quality

Evaluator: F08-search-quality. Checkout aa2bb120, local production build at http://localhost:3100/mcp. Every request carried its own `x-vercel-forwarded-for: F08-search-quality-*` header. Scripts, test set and raw results are in `/tmp/claude-0/audit/eval-F08-search-quality/` (`queries.mjs` holds the labelled test set, `run.mjs` runs it live, `live.json` has the live results, `sim.mjs` and `score.mjs` hold the simulation and scoring, `scores.json` has per-query rows).

## 1. Verdict: PARTLY CONFIRMED

All four mechanisms the audit names are real, and I reproduced each against localhost. Search matches substrings inside words. A query of two or more words is matched as one literal string. There is no stemming for English. Apart from two one-way aliases there are no cross-language aliases. The size of the harm is smaller than the finding implies, and parts of it are wrong:

- The tool description and server instructions already tell assistants to "use one meaningful keyword" and to treat an empty phrase result as "not proof that the data is absent". A fresh assistant followed that advice: 14 of its 15 real searches were single words (evidence `calls.log`).
- An approved spec explicitly rejected a synonym catalogue (`docs/superpowers/specs/2026-10-17-mcp-discovery-performance-design.md:33`: "do not add a guessed synonym catalogue").
- Two of the audit's examples are not substring defects. "population" returns programmes whose labels really say "the population". Wage/salary synonyms would find nothing, because no wage dataset is among the 11 served.

The audit understated three things:

- The Georgian false positives are worse than the English ones. `ხორცი` (meat) returns 4 programmes through `განხორციელება` (implementation). `ვალი` (debt) returns trousers (`შარვალი`) and eyeglass lenses (`სათვალე`). The query `ონი` (Oni) appears inside 23 labels containing `ღონისძიებები` (activities).
- The Georgian `პენსია` (pension) comes back empty while the English `pension` works. A real assistant hit this in its run.
- The natural query `CPI` fails with `result_too_large`.

## 2. Evidence

### Code

- `apps/web/lib/factQuery/describeCoverage.ts:777-792` `matchesSearch`. It lowercases the query, applies the alias map `{ "დღგ": "revenue.vat", pension: "საპენსიო" }` (line 779, whole query only, one direction), then checks `hay.includes(needle)`. That is a plain substring test of the whole query against each candidate (id, Georgian label, English label, slug).
- `describeCoverage.ts:767-775` `GEORGIAN_CASE_ENDINGS` / `georgianStem` removes one ending, and the stem is then also substring-matched (line 791). A stem of 2 characters must begin the label instead.
- Call sites: lines 885 and 894 (search without a dataset), 912 (exclusions), 922 and 928 (search within one dataset). Each entry is tested on its own, so no ranking is possible.
- Search covers only series and entity fields. Dataset labels ("Government debt" / "სახელმწიფო ვალი", "State-budget expenditure") are never searched.
- Guidance that already mitigates the problem: `apps/web/lib/mcp/tools.ts:149-155` ("Use one meaningful keyword; if a phrase returns no matches, try the principal word or browse the named dataset. A failed phrase match is not proof that the data is absent.") and `apps/web/lib/mcp/instructions.ts:49`. This guidance is pinned by `tests/mcp/tools.test.ts:74-89`.

### Test set and method

I built 139 queries, all run unscoped (`{search}` only) against localhost. The test set has:

- 39 single English words
- 25 English phrases
- 2 English plurals
- 12 synonyms
- 15 single Georgian words
- 6 inflected Georgian forms
- 10 Georgian phrases
- 15 places, including Georgian case forms and phrases
- 6 ids
- 4 typos
- 5 topics that are not served

Each query was labelled by hand against the 531 series and 95 entities the 11 datasets publish:

- `req` lists what a correct answer must contain. This is the basis for recall.
- `ok` lists further results that are reasonable. Anything returned outside `req` ∪ `ok` is a false positive (FP).
- An FP is called "inside-word" when no query word begins any word of the matched entry.

My offline copy of the current matcher returns exactly the same results as the live server on 138 of 138 comparable queries. The one I could not compare is `CPI`, which errors live. So the simulated variants below run against the same catalogue.

### Selected live reproductions

| Query | Status, bytes | Returned | Problem |
|---|---|---|---|
| `VAT` | ok, 3.7 KB | VAT; "Development of innoVATion and technology" | inside-word FP |
| `grants` | ok | Grants; "…displaced persons and miGRANTS" | inside-word FP |
| `oil` | ok, 11 KB | 5 results, 3 wrong: Boiled sausage, Toilet soap, Toilet paper | inside-word FP |
| `Oni` (municipality) | ok, 23 KB | 8 results: conditiONIng, MacarONI, MatsONI, ONIon, ZestafONI, KhONI … | 6 FPs |
| `port` | ok, 51 KB | 28 series (Import tax, Sport, support, transport …); 1 relevant (Anaklia port) | 27 FPs |
| `car` | ok, 31 KB | 15 results (healthCARe, CARpets, CARrot, CARamel …); "Purchase of vehicles" missed | 0 correct |
| `ვალი` (debt) | ok | debt rows plus შარვალი (trousers) ×3, სათვალის ლინზები (lenses) | 4 inside-word FPs |
| `ვალის` | ok, 34 KB | stem `ვალ` adds ვალდებულებები (liabilities), სავალდებულო (compulsory) | 6 FPs |
| `ხორცი` (meat) | ok | meats plus 4 programmes through განხორციელება (implementation) | 4 inside-word FPs |
| `პური` (bread) | ok | Wheat bread plus 2 × ხაჭაპური (khachapuri) | 2 inside-word FPs |
| `food inflation`, `annual inflation`, `წლიური ინფლაცია` | empty, 894 B | nothing | phrase failure |
| `სახელმწიფო ვალი` (government debt; also the dataset's own name) | empty | nothing | phrase failure |
| `Batumi budget`, `Tbilisi inflation` | empty | nothing | phrase failure |
| `პენსია`, `pensions`, `cigarettes`, `roads`, `defense` | empty | nothing | no stemming or aliases |
| `განათლებისთვის` (for education), `დღგ-ს` | empty | nothing | ending not in the list or hyphenated |
| `CPI` (no dataset) | **error `result_too_large`** | the substring `cpi` is in all 364 inflation ids | natural query fails |
| `population` | ok | "Social protection of the population", "Healthcare for the population" | whole-word match; population data is not served |

Across the whole catalogue, each of the 761 distinct English label words (3 letters or more) was tried as a query. For 67 of them (8.8%) substring matching adds inside-word results: 351 extra hits on top of 2,082 word-start hits. The worst are "men" (+61), "ice" (+47), "pen" (+29), "port" (+27) and "air" (+16).

### Scores (139 queries; 134 have a required answer)

| Matcher | Full recall | Zero recall (dead end) | Macro recall | Queries with an FP | Inside-word FPs | Perfect | Macro precision |
|---|---|---|---|---|---|---|---|
| **Live (current)** | 87 | 46 | 0.64 | 14 | 28 | 75 | 0.94 |
| V1: word-start (from 4 letters) + Georgian lemma, all words must match (AND) | 96 | 38 | 0.70 | 5 | 2 | 92 | 0.98 |
| R: V1 + "some words" fallback (ranked union) + typo fallback + the existing aliases made two-way (no new synonyms) | 123 | 10 | 0.90 | 23 | 4 | 104 | 0.91 |
| R + dataset-label matching (adds the dataset's total) | 124 | 8 | 0.92 | 24 | 4 | 104 | 0.92 |
| Upper bound: R + ~30-entry synonym list | 133 | 2 | 0.97 | 23 | 6 | 113 | 0.93 |

The synonym row is self-fulfilling: I wrote the synonyms while looking at my own synonym queries. Read it as a ceiling, not an estimate.

Full-recall counts by category, live vs R:

| Category | Live | R |
|---|---|---|
| English phrases | 13/25 | 24/25 |
| Georgian phrases | 3/10 | 9/10 |
| Inflected Georgian forms | 3/6 | 6/6 |
| English plurals | 0/2 | 2/2 |
| Place phrases | 0/3 | 3/3 |
| Typos | 0/4 | 4/4 |
| Synonyms | 0/12 | 4/12 (only through the existing aliases) |
| Single English words | 32/39 | 34/39 |
| Single Georgian words | 13/15 | 14/15 |
| Not-served topics correctly empty | 5/5 | 5/5 |

- Precision@5: 0.94 live; 0.99 for V1; 0.92 for R. R's "some words" answers (22 queries) bring noise, but contain 83% of the required items, ranked first by word rarity.
- The 28 inside-word FPs disappear with word-boundary matching alone. The 2-4 left are whole-word homonyms, such as `გადასახადი` (tax), which is also the word used in "rentals for housing".

### Existing explorer matcher

The site's All data search is already a better design:

- `lib/explorer/search/searchExplorer.ts:64-117` uses `fold` (`lib/i18n/search.ts:6`), splits the query into words and requires every word to match (`pageScore`, line 100).
- It scores a word-start match at 1 and an inside-word match at 0.7 (`wordScore`, line 69), drops joining words (`JOINING_WORDS`, line 119) and ranks the results.
- `lib/explorer/search/georgian.ts:24` adds a stemmer (`stem`), and line 10 reads Latin text typed on a Georgian keyboard (`latinToGeorgian`).
- Its keyword lists (`allData.words.*` in `lib/i18n/messages/*/allData.json`, 91 entries) describe pages, not series. The factQuery purity test (`tests/factQuery/purity.test.ts:7-8`) forbids importing `i18n/messages`, and most of those keywords are for datasets this service does not serve. So reuse the algorithm and the pure helpers, not the lists.
- The explorer's `stem` leaves words under 5 letters whole, so on its own it would miss `ვალის`→`ვალი` and `ონის`→`ონი`. describeCoverage's own ending list has to stay, compared word against word.

### Tests that pin current behaviour

- `tests/factQuery/describeCoverage.test.ts:147-157`: slug `khulo`, id `revenue.vat`, empty `zzz-no-such-series`.
- `describeCoverage.test.ts:236-241`: city `cpi`, whose exact order is headline then 12 divisions. A ranked result needs a stable sort.
- `describeCoverage.test.ts:246-280`: `ბათუმი` across datasets, `განათლება`.
- `describeCoverage.test.ts:292-317`: `ბათუმის`, `განათლების`, `ონის`, and "a short stem never matches mid-word".
- `tests/factQuery/reviewRegression.test.ts:105-118`: the aliases `დღგ` and `pension`; `constructor` and `__proto__` must return empty.
- `tests/factQuery/inflationCatalogue.test.ts:77`: `Food`.
- `tests/factQuery/inflationProductDiscovery.test.ts:42-49`: every product found by its own Georgian label, English label and id.
- `tests/factQuery/bilingualObservations.test.ts:62`: `Education`.
- `tests/mcp/tools.test.ts:74-89` (phrase-recovery guidance) and `:496-511` (`Batumi`, `zzzznotathing`, exclusion `05`).
- Fixture `tests/factQuery/fixtures/mcpAssistantIntents.ts:49` is built around the empty "annual inflation" search, and spec §114 depends on it.

My prototype broke two of these, which shows the risks are real:

- A plain-object synonym lookup throws on `constructor`.
- Typo correction turns `__proto__` into "photo" (proto→photo, one edit) and returns 3 photo products.

## 3. Real-world impact

**Who is affected:** assistants that call `describe_coverage` with `search`, which the instructions tell them to do first.

**How often:** in the fresh 16-question run, 15 searches were made:

- 2 were wrong dead ends: `პენსია`, and the phrase `საშუალო პენსია` (average pension).
- 4 were correct empties for topics that are not served.
- No answer came out wrong because of search. The assistant recovered or correctly said the data was absent.

**How badly:**

- **Dead ends (the larger effect).** In this test set, 46/134 queries come back empty or without the target. Most are phrases, inflected forms or synonyms. In practice the one-keyword guidance avoids most phrase failures. It cannot help with Georgian `პენსია`, English plurals or `CPI`.
- **Status "empty" invites a wrong conclusion.** The guidance warns against reading it as absence. Every recovery costs a call and pushes clients toward broad scoped browsing (the full inflation catalogue is 84 KB; products are 470 KB).
- **False positives (the smaller effect).** The labels are visible, so a model rarely picks an irrelevant series. Wrong-figure risk is low. The cost is noise and bytes: `port` returns 51 KB for one relevant series, `car` 31 KB for none.

**Overstated by the audit:**

- "population" and wage/salary are coverage gaps, not search defects. That is F01 territory: an empty search should say what is not served.
- The phrase failure was already known, documented and mitigated (2026-10-17 audit line 150; discovery-performance spec §33).

**Understated by the audit:** the Georgian inside-word FPs, the one-way pension alias, the `CPI` error, and that dataset names such as "სახელმწიფო ვალი" / "Government debt" cannot be found at all.

## 4. Root cause

`matchesSearch` treats the query as one opaque string and each label as one opaque string, and tests `includes`. There is no tokenisation, so it cannot tell word boundaries apart from letters inside a word. It cannot see the words of a phrase separately. Its stems are matched as substrings as well.

It decides match/no-match per entry, so it cannot rank or fall back when no entry matches every word. The two aliases apply only when they are the whole query, and only one way.

The earlier design decided to rely on guidance rather than add search features (spec §23 and §33). That was reasonable for phrases. It did not cover inside-word matching, which the guidance cannot fix.

## 5. Recommended fix

Simplest correct design, staying inside spec §33: no new synonym catalogue without owner approval.

1. **Tokenise and match by word.** Change `matchesSearch` in `describeCoverage.ts`:
   - Use `fold` from `lib/i18n/search.ts` (allowed by the purity test).
   - Split the query and the candidate fields on anything that is not a letter or digit. This also splits ids on `.` and `_`, and `მშპ-ის` into `მშპ` + `ის`.
   - Drop joining words, as in `searchExplorer.ts:119`, adding `to`, `by` and `და`.
   - A query word matches a field word when it is equal to it, is a prefix of it (only when the query word has 4 letters or more), or has the same lemma.
   - Lemma means: remove one ending from the existing `GEORGIAN_CASE_ENDINGS`, widened to the explorer's list (`ისთვის`, `იდან`, `ამდე`, `ებით`, `ების`, `ებს`, `ები`), then a final vowel. For English, remove a plural `s`/`es` (5 letters or more).
   - On this catalogue, all 55 lemma groups among the 859 Georgian label words merge only real inflections. Examples: ვალი/ვალის, ხორცი/ხორცის, რეგიონი/რეგიონებში.
   - Keep an id path: when the query looks like an id (it contains `.` or `_`), it matches the exact id or an id prefix, or a segment after a `.`.
2. **All words, then some words.** First return the entries that match every word. If there are none, return the entries that match any word, sorted by summed word rarity (fewer matching entries means a higher weight). Use a stable sort, so ties keep today's catalogue order. Flag these answers with an additive `searchMatch: "all_words" | "some_words"` and a one-line note in the text output. Apply this across the whole search, not per entry: compute per-entry match counts once, then choose.
3. **Make the existing reviewed aliases two-way and case-aware.** Map `vat`↔`დღგ` and `pension`/`pensions`/`პენსია`/`პენსიები`→`საპენსიო`. Use `Object.hasOwn` or a `Map`, as now (the `constructor` test). This is not a new catalogue, but extending it needs the owner's say-so.
4. **Optional:**
   - Also match dataset labels, returning the matched dataset in `datasets` with an empty match list. This finds "Government debt" and "State budget".
   - Allow a one-edit typo correction, only for words of 5 letters or more made only of letters that match nothing. It must not apply to `__proto__`-style tokens, or the pinned regression test fails.
5. **Leave the `CPI` case to the size limit, but make it recoverable.** The existing `result_too_large` already says to narrow. Alternatively, cap search results and mark them truncated. That belongs to the response-size work, not here.

**What stays unchanged:**

- The response shape (`kind`, `status`, `data.datasets/series/entities/exclusions`, `datasetId` tags).
- The ok/empty semantics.
- Accuracy, caveats, missing-is-not-zero, and sources. describe_coverage returns no figures, and its caveat context stays fixed and empty.
- Exclusion matching by code (`05`).
- The guidance text. Phrases mostly work afterwards, but "one keyword" advice stays harmless.

**Compatibility:**

- The only new field is `searchMatch`, which is additive. The instructions already require clients to accept additive fields. The tool's output schema needs it added as optional.
- Result order may change for "some words" answers only.

**Risks:**

- Georgian inflections outside the list. The lemma rule needs at least 2 characters to remain, which is the same guard as today.
- Homonyms stay (`გადასახადი` is both tax and rent payment).
- A "some words" answer is noisier: precision@5 0.92 vs 0.94 today. That is the price of 37 fewer dead ends.
- `zzz-no-such-series` must stay empty. Ignore words under 3 letters in the fallback.
- Expectations that change: `ონის` stays correct. Mid-word results such as `port`→Sport and `ვალის`→liabilities disappear, which is intended. No current test pins those.

## 6. Effort: S (about 1 day)

- Tokeniser, lemma and word matcher, replacing `matchesSearch` (2-3 h).
- Two-pass all/some choice at the five call sites, with stable ranking (2 h).
- `searchMatch` field, output schema and text note (1 h).
- Two-way aliases (0.5 h).
- Tests: port the labelled set from `queries.mjs` as a fixture with thresholds (2 h).
- Run `npx vitest run tests/factQuery/describeCoverage.test.ts tests/factQuery/reviewRegression.test.ts tests/factQuery/reference.test.ts` and the other listed files, then the full gate once.

Dataset-label matching and typo correction add about half a day. A synonym list needs an owner decision first because of spec §33.

## 7. How to verify

- New `tests/factQuery/searchQuality.test.ts`, built from the 139 labelled queries, asserting:
  - zero inside-word FPs on the reproduced cases (`VAT`, `grants`, `oil`, `Oni`, `port`, `ვალი`, `ხორცი`, `პური`);
  - `food inflation`, `annual inflation`, `წლიური ინფლაცია`, `სახელმწიფო ვალი`, `Batumi budget`, `განათლებისთვის`, `პენსია` and `pensions` each contain their target;
  - not-served topics (`wages`, `salary`, `unemployment`, `exports`) stay empty;
  - full-recall count of at least 120 of 134, and inside-word FPs of 4 or fewer.
- All pinned tests above must still pass unchanged, including `constructor`/`__proto__` empty, the city `cpi` order and each product finding itself.
- The `reference.test.ts` fixture must pass (definition of done item 4).
- Measure wire bytes for `port` (51 KB today; a single match returns about 2-4 KB, as `pension` (2.3 KB) and `VAT` (3.7 KB) do now) and `education` (34 KB, about unchanged).
- Re-run the fresh-assistant K5 question: `პენსია` should now find the funded-pension programme on the first call.

## 8. Revised rating

**Impact: Medium** (the audit's framing reads High). **Effort: S.**

Plain English: the data search matches letters inside words and cannot handle two-word or Georgian-inflected queries. It sometimes returns unrelated items (searching "meat" in Georgian brings up government programmes) or nothing at all for sensible requests like "food inflation". Matching whole words and accepting results that contain only some of the words would fix most of this in about a day, without changing any numbers the service reports.
