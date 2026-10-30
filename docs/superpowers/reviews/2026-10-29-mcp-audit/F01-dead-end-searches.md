# F01 — Dead-end catalogue searches for topics the website shows but the MCP does not serve

Evaluated 2026-10-29 against the production build of aa2bb120 at http://localhost:3100/mcp. Scratch scripts and raw results: `/tmp/claude-0/audit/eval-F01-dead-end-searches/` (`probe.mjs` → `probe.json`/`probe.txt`, `sitesearch.mts` → `site.json`, `proto.mts`).

## 1. Verdict

**CONFIRMED.** Searching `describe_coverage` for a topic that Fiscal.ge shows on its website but the MCP does not serve almost always comes back with nothing, and the response never points to the page that has the data. Of 265 English and Georgian keywords covering all 17 site-only topics, plus the 4 site-only pages inside served topics, 209 (79%) returned `status: "empty"` with an empty payload. The other 56 returned budget, sector or price series, which answer a different question or are plain substring noise. None of the 265 responses contained a link. Only unemployment has a pointer, and it is hand-written in the server instructions, not in the search result. The audit's claim holds as stated. One part needs adjusting: the fix should not be a new hand-written keyword catalogue, which the approved discovery spec forbids. The website already ships a reviewed bilingual search over all 104 pages, and the MCP can reuse it unchanged. That search finds the right topic for 169 of the 209 empty probes (81%).

## 2. Evidence

### 2.1 What is site-only

`apps/web/lib/navigation/navTree.ts:49-206` lists 20 topics and 104 pages (`PAGE_COUNT`, line 254). The MCP serves 12 of those pages:
- budget: expenditure, revenue, municipalities, debt, deficit
- economy: gdp, sectors, regions
- inflation: all 4 pages

That leaves **92 site-only pages**. 88 of them make up 17 whole topics: business, housing, money, unemployment, wages, living-standards, health/social, education, science-culture, crime, internet, trade, external, energy-food, environment, transport and demography. The other 4 sit inside served topics: expenditure-types, tax-breaks-refunds, analysis and economy/expenditure. Each of these topics' approved scopes in `Project_Definition.md` says "no MCP tool" (for example lines 50, 53, 159, 169, 177, 224, 256, 264, 304 and 332).

### 2.2 Live reproduction (265 calls, each with its own rate-limit key `F01-dead-end-searches-N`)

Request: `tools/call describe_coverage {"search": "<kw>"}`. All 265 returned HTTP 200 with `isError: false`.

An empty result is 893 bytes on the wire, and its whole text twin is:

```
fiscal.ge catalogue — status empty
dataVersion 96d80a5d…
licence CC BY 4.0 (…)

{"datasets":[],"series":[],"entities":[],"exclusions":[]}
```

| Topic | Empty / probes | Topic | Empty / probes |
|---|---|---|---|
| business | 13/14 | crime | 14/15 |
| housing | 5/12 | internet | 7/9 |
| money & banks | 16/18 | trade | 12/17 |
| unemployment | 11/12 | external flows | 11/15 |
| wages | 11/12 | energy & food | 5/14 |
| living standards | 14/15 | environment | 12/18 |
| health & social | 21/26 | transport | 8/12 |
| education | 12/13 | demography | 15/17 |
| science & culture | 8/12 | partial pages (tax breaks, GDP by expenditure…) | 14/14 |

By language: Georgian 90 of 113 empty, English 119 of 152 empty.

Examples named in the finding, all reproduced:
- Empty: `wages`, `ხელფასი`, `exports`, `ექსპორტი`, `remittances`, `გზავნილები`, `poverty`, `სიღარიბე`, `unemployment`, `უმუშევრობა`, `მოსახლეობა`, `პენსია`.
- `pension` returns 1 series, ministries "Co-financing the funded pension scheme". This comes from the hard-coded alias `pension: "საპენსიო"` at `apps/web/lib/factQuery/describeCoverage.ts:779`.
- `population` returns 2 ministry programmes, "Social protection of the population" and "Healthcare for the population".

The 56 non-empty results answer a different question. About 15 are clearly off target:
- `profit` → Profit tax
- `income` → Income tax
- `interest rate` → interest rate on government debt
- `employment` → a ministry programme
- `reserves` → state material reserves
- `pay` → debt servicing
- `საავადმყოფო` → hospital-services CPI

Some are substring noise:
- `age` → 26 series, because "age" is inside man**age**ment and stor**age**
- `culture` → "Agri**culture** and environment"
- `ციხე` (prison) → the municipality ახალ**ციხე** (Akhaltsikhe)
- `wheat` → Buck**wheat**

The remaining ~40 are nearby budget, sector or CPI series, such as health spending or the electricity price index. Those are valid but are not the measure the website page shows. One is a genuine trap: `external debt` returns only *government* external debt. The site's Foreign debt page (`/explorer/external/foreign-debt`) shows the country's gross external debt, which is a different quantity.

### 2.3 Why the result carries no pointer (code)

- `describeCoverage.ts:876-915`: a search without `datasetId` matches only snapshot series and entity labels, then returns `{datasets, series, entities, exclusions}`. Nothing outside the served datasets can match, and the response shape (`apps/web/lib/mcp/outputSchema.ts:124-132`, published with `data.additionalProperties: false`) has no field where a pointer could go.
- `apps/web/lib/mcp/instructions.ts:126-129` is the only pointer: "Unemployment is not served by this MCP … https://fiscal.ge/explorer/unemployment/overview". It is pinned by `apps/web/tests/mcp/tools.test.ts:54`. The "WHAT IS NOT SERVED" list (lines 117-125) does not name wages, trade, pensions, demography or any of the other 16 topics.
- `instructions.ts:51` says "A failed phrase match is not proof that the data is absent." That invites more retries when the empty search was in fact final.

### 2.4 What a real assistant did (existing run, `/mnt/project-files/mcp-audit/evidence/answers.md`, `calls.log`)

Four of the 16 questions were about site-only topics: E8 unemployment, E9 wages, E10 exports to Turkey, K5 average pension.
- **E8**: answered with the fiscal.ge link. This was the only correct redirect, and it came from the instructions, not from the search result.
- **E9** ("the official source would be Geostat"), **E10** ("the usual official source is Geostat") and **K5** (pointed to the Social Service Agency or Geostat): the assistant sent the user away from fiscal.ge, although fiscal.ge has `/explorer/wages/overview`, `/explorer/trade/…` and `/explorer/health/pensions`.
- In K5 the assistant correctly refused to treat the funded-pension co-financing programme as the average pension, but it had to work that out on its own.
- 8 searches went to these four questions (`wage`, `export`, `Turkey`, `unemployment`, `pension`, `საშუალო პენსია`, `პენსია`, plus one repeat).

The good news: no figure was invented. The harm is a lost answer and a wrong referral, not a wrong number.

### 2.5 Reusable assets already on the site

- `apps/web/lib/explorer/search/searchExplorer.ts:345`: `searchExplorer()`, the All data page's search. It is pure code that runs in the browser. It scores word starts against the page name in both languages, the topic, the group and `allData.words`, and it also handles Georgian stems and Latin-keyboard Georgian.
- `apps/web/lib/explorer/allDataIndex.ts:46`: `buildSearchPages()` builds the 104 page records from `common` and `allData` messages. 91 pages have reviewed bilingual extra words in `lib/i18n/messages/{ka,en}/allData.json` (for example "remittances", "pensioners", "salary pay women men", "exports imports").
- `pageHref()` in `apps/web/lib/i18n/routes.ts:20` builds the `/en` mirror. `PUBLIC_SITE_ORIGIN = "https://fiscal.ge"` in `apps/web/lib/factQuery/buildSnapshot.ts:61` is already the fixed, hash-safe origin.
- The All data page also accepts `#q=<words>` (`components/explorer-groups/explorer-search.tsx`), so `https://fiscal.ge/explorer#q=…` works as a generic fallback link.
- The places JSON (`/explorer-places.{ka,en}.json`) is not needed. It is for place names, and place searches already reach MCP entities.

Running `searchExplorer` offline over the same 265 keywords (on the 104 pages, values left empty):
- It found the right topic for **219 of 265 (83%)**, and for **169 of the 209 MCP-empty probes (81%)**. It found the site's page for 50 of the 56 "different question" probes.
- Median result: 1 page. 90th percentile: 5. Maximum: 34, for `environment`/`გარემო`, where the topic name matches every page, hence the cap below.
- Misses (46) are mostly multi-word phrases with one word not in any label ("average wage", "labour force", "foreign direct investment", "household consumption"). The rest are words the site's own search also lacks ("salaries", "earnings", "Turkey", "mortgage", "railway", "teachers").

Results for the finding's examples: `wages`/`ხელფასი` → the 3 wage pages; `pension`/`პენსია` → Pensions and Funded pension; `population`/`მოსახლეობა` → Population; `exports`/`ექსპორტი` → Domestic exports and Trade overview; `remittances`/`გზავნილები` → Money from abroad; `poverty`/`სიღარიბე` → Poverty; `external debt` → Foreign debt.

### 2.6 Policy check

- The approved discovery spec already requires the behaviour the server is missing. `docs/superpowers/specs/2026-10-17-mcp-discovery-performance-design.md:124` says that for "Dataset outside approved MCP scope", the assistant "States the limitation and uses the documented website/static alternative without inventing a tool". The intent fixture `apps/web/tests/factQuery/fixtures/mcpAssistantIntents.ts:146-153` says the same ("Point to the documented website … explorer"). Today a website alternative is documented for only 1 of the 17 topics.
- The same spec, at line 33, says "do not add a guessed synonym catalogue". The audit's proposed "catalogue of site-only topics with bilingual keywords" would break that rule if it were written by hand. Reusing the site's existing, reviewed navigation labels and `allData.words` does not.
- A pointer serves no figures, sources or tools. Every site-only scope says "no MCP tool / central publication", and a link is neither. The pointer must not carry hub-card values: `buildSearchPages` can attach latest values, so pass no hub data. It must also not carry site-only source documents: `buildSnapshot.ts:63-66` deliberately keeps human-explorer sources out of the snapshot. Because this changes the MCP response contract, it needs a short owner-approved spec amendment, like earlier additive MCP changes.

## 3. Real-world impact

- **Who:** anyone who asks an AI client connected to /mcp about labour, wages, prices of homes, banks, trade, remittances, pensions, population, health, education, crime, environment, transport, energy or farming. The site covers more topics outside the MCP than inside it (92 of 104 pages are site-only). The connect page invites general users, so these questions are likely common. In the only real-assistant run, 4 of 16 questions (25%) were of this kind, and 3 of those 4 ended with a referral to another organisation.
- **How badly:** moderate. The assistants did not invent numbers: the instructions' "say so" rule held. The losses are:
  1. The user does not find out that fiscal.ge has the answer.
  2. Wasted calls (8 searches for 4 questions).
  3. A risk of answering a different question from a nearby match: pension → programme, external debt → government-only debt, profit → profit tax.
- **Overstated:** "users get 'not available'". They do, but they are told honestly. No data error was observed.
- **Understated:** the gap is systematic, not a few keywords (79% empty across 265 probes). Substring noise (`age`, `culture`, `ციხე`) makes non-empty results misleading on their own. And the approved spec's acceptance row for out-of-scope datasets is unmet for 16 of 17 topics.

## 4. Root cause

Search matches only what the snapshot serves, and the response has no way to say "not here, but on this website page". The one redirect that exists (unemployment) was written into the instructions as a special case rather than built from the navigation config. As the website grew from 1 to 17 site-only topics, nothing kept the MCP's out-of-scope guidance in step with `NAV_TREE`.

## 5. Recommended fix

**Reuse the website's own page search and send its matches as links, built at snapshot time from `NAV_TREE` plus the existing messages.** No new keyword list, no figures, no new tool.

1. **Snapshot, `lib/factQuery/buildSnapshot.ts`** (the only factQuery file allowed to read messages; `tests/factQuery/purity.test.ts`):
   - Add `website: { pages: SitePage[] }`, built with `buildSearchPages([], ka, en)` (from the `common` and `allData` message files) and filtered to pages not in a new `MCP_SERVED_PAGES` constant.
   - That constant holds the 12 hrefs → `DatasetId[]`. Put it in `lib/factQuery/` beside `DATASET_IDS`; nothing existing maps datasets to pages.
   - Store `href`, `urlKa` and `urlEn` (`PUBLIC_SITE_ORIGIN` + `pageHref`), the page labels, topic labels and words. Leave `value`, `period`, `caption` and `spark` empty.
   - About 30 KB on a 32 MB snapshot. `dataVersion` changes once, and later on any label edit. That matches the existing rule that text is part of the data's identity.
2. **`lib/factQuery/describeCoverage.ts`**, in the no-`datasetId` search branch (lines 876-915):
   - Call `searchExplorer(input.search, "en", snapshot.website.pages, [], null)` unchanged. It is pure and has no fs or messages imports, so it passes the purity rule.
   - Take the top 5 rows and add them as `data.websitePages: [{ topicId, labelKa, labelEn, topicLabelKa, topicLabelEn, urlKa, urlEn }]`, only when there are matches.
   - Keep `status` exactly as it is: `empty` when no served series or entity matched, so the existing tests at `describeCoverage.test.ts:155,269` keep their meaning.
   - Add one bilingual note through the existing `serviceMessage` / `SERVICE_MESSAGE_KEYS` mechanism, for example: "These Fiscal.ge pages show this topic; this connection does not serve their figures. Give the user the link in their language; do not quote a figure for it."
   - The text twin needs no change, because `renderText` already emits `JSON.stringify(data)` (`lib/mcp/result.ts:241-247`).
3. **`lib/mcp/outputSchema.ts:124`**: add the optional `websitePages` (and the note) to the `catalogue` shape. The published `data` schema has `additionalProperties: false`, so **bump `SCHEMA_VERSION` 1.6.0 → 1.7.0** (`lib/factQuery/types.ts:26`). This follows the 1.5.0 precedent for additive optional fields. The bump means updating the "LANGUAGES AND COMPATIBILITY" text (`instructions.ts:97-111`), the connect messages and the tests and specs that pin 1.6.0 (about 10 test files plus the docs).
   - Alternative with no bump: put `websitePages` at the top level of the envelope, which is `.loose()` and has no `additionalProperties: false`, and add one line in `renderText`. This is less tidy.
4. **`lib/mcp/instructions.ts:126-129`**: replace the unemployment special case with one general rule: "Many Fiscal.ge website topics are not served here. A search returns `websitePages` for them: offer that link and do not give a figure." Optionally, name the 17 topics from `NAV_TREE` English labels, and the generic fallback `https://fiscal.ge/explorer#q=<word>` (`/en/explorer#q=` in English). Also soften line 51 so that a search that returns `websitePages` is treated as final.

**Unchanged:** every served value, caveat, the missing-is-not-zero rule, sources, `status` semantics, the dataset-scoped search shape (`datasetId` given → no `websitePages`), publications (`publications.ts:107` calls describeCoverage without search, so the files do not change), and the existing alias and substring matching of served series.

**Compatibility:** clients that ignore unknown fields are unaffected. Clients with strict cached output validators must refresh discovery, the same as every earlier bump, as the instructions already say.

**Risks:**
- Ranking quirks: `health` ranks "Bank health" first, and `ict` matches "convictions" by substring after 3 letters. The cap of 5 and the topic label limit the damage.
- An assistant might fetch the page and quote a figure from it. That is outside the server's control, and the note tells it not to present such a figure as this service's answer.
- Keeping `MCP_SERVED_PAGES` correct needs a test that every entry is a `NAV_TREE` href.

**Separate, smaller defect found on the way (not part of this fix):** substring matching of served labels (`describeCoverage.ts:778-793`) gives noise such as `age` → 26 series, `culture` → Agriculture and `ციხე` → Akhaltsikhe. Matching on word starts, as `searchExplorer` does, would remove it. Report it separately, because it changes existing search results.

**Optional:** adding missing words to `allData.words` (for example "earnings", "salaries", "Turkey", "teachers") would improve the website search and the MCP pointer together. That is a content decision for the owner.

## 6. Effort

**M, low end: about 1-1.5 days.** Without the schema bump (top-level field) it is S.
- Spec amendment and owner approval: 1-2 h.
- Snapshot `website.pages`, the `MCP_SERVED_PAGES` constant, describeCoverage branch and service message: 3 h.
- Output schema, 1.7.0 bump and its ripple (instructions, connect messages, pinned tests, docs `ai-grounding-and-caveats.md`, `ai-reference-intents.md`, `deployment.md`): 3-4 h.
- Instructions rewrite and `tools.test.ts:54`: 0.5 h.
- Tests and the done-check (`npm run check`, build, `connect.spec.ts`/`bilingual-complete.spec.ts` for the version string): 2-3 h.

## 7. How to verify

- Unit tests (`tests/factQuery/describeCoverage.test.ts`):
  - `search: "wages"` and `"ხელფასი"` → `status: "empty"`, `websitePages[0].urlEn === "https://fiscal.ge/en/explorer/wages/overview"`, `urlKa` without `/en`.
  - `"pension"` → the funded-pension programme series **and** websitePages including `/explorer/health/pensions`.
  - `"zzzznotathing"` → no `websitePages`.
  - A `datasetId`-scoped search → no `websitePages`.
  - No `websitePages` entry ever has a number-like field, or an href in `MCP_SERVED_PAGES`.
  - Every `MCP_SERVED_PAGES` key is a `NAV_TREE` href, and the site-only page count equals `PAGE_COUNT − 12`.
- `tests/mcp/outputSchema.test.ts`: the search response validates against the published schema. `tests/mcp/tools.test.ts`: the instructions contain the general rule and no longer hard-code unemployment.
- Intent fixture: extend `outside-mcp-scope` with wages and pension pairs (EN and KA) that require "offer the Fiscal.ge page link, no figure".
- `npx vitest run tests/factQuery/reference.test.ts` must still pass. Only `dataVersion` and `schemaVersion` should change.
- Re-run `/tmp/claude-0/audit/eval-F01-dead-end-searches/probe.mjs` against a fixed build. Targets:
  - At least 169 of the 209 previously empty probes carry a correct-topic link.
  - 0 links to served pages.
  - Added bytes per search: median ~250 B, maximum ~1.4 KB.
  - No served series or status changes for any of the 265 probes (diff `probe.json`).
- Repeat the 4 real-assistant questions (E8, E9, E10, K5). Pass: each answer offers the fiscal.ge page in the user's language, states no invented figure, and makes at most 2 searches.

## 8. Revised rating

- **Impact: Medium.** The gap is systematic and loses answers, but no wrong figures were observed.
- **Effort: M (low end); S without the schema bump.**
- **Plain English:** When someone asks an AI assistant connected to Fiscal.ge about wages, trade, pensions, population or a dozen other topics the website covers, the assistant is told "nothing found" and sends them to other sites. The fix makes the connection answer with a link to the right Fiscal.ge page, found by the website's own search, without giving any numbers it is not approved to serve.
