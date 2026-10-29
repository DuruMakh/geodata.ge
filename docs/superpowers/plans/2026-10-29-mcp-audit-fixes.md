# MCP audit fixes 1-6 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/mcp` answer well from every client by fixing the six High- and Medium-impact problems in the 29 October audit. The six problems are: instructions that Claude Code truncates, searches that end in silence, substring search, internal codes in sentences, heavy rankings and catalogues, and invisible usage.

**Architecture:** Keep the public, read-only, stateless `/mcp` route and its build-time snapshot.
- Extend the existing modules instead of adding parallel ones: `lib/mcp/instructions.ts`, `describeCoverage.ts` search, `rank.ts`/`meta.ts` evidence, the service-message mechanism, and the `Counter` in `lib/mcp/limits.ts`.
- Reuse the website's own All data search (`lib/explorer/search/searchExplorer.ts`, `allDataIndex.ts`, `georgian.ts`) for page pointers and word matching.
- Release data schema 1.7.0 once, for the two additive catalogue fields.

**Tech Stack:** Next.js 16 route handler, strict TypeScript, Zod, official MCP SDK, Vitest, Upstash REST (existing limiter only).

**Spec:** The per-problem reviews in [`docs/superpowers/reviews/2026-10-29-mcp-audit/`](../reviews/2026-10-29-mcp-audit/) are the design authority for this plan:
- [F07 instructions](../reviews/2026-10-29-mcp-audit/F07-long-instructions.md)
- [F01 dead-end searches](../reviews/2026-10-29-mcp-audit/F01-dead-end-searches.md)
- [F08 search quality](../reviews/2026-10-29-mcp-audit/F08-search-quality.md)
- [F12 small items (a) and (d)](../reviews/2026-10-29-mcp-audit/F12-small-items.md)
- [F02 heavy answers](../reviews/2026-10-29-mcp-audit/F02-heavy-answers.md)
- [F04 shared limits](../reviews/2026-10-29-mcp-audit/F04-shared-rate-limits.md)

Read each one's §5 ("Recommended fix") and §7 ("How to verify") before starting its task. The owner-facing report is https://claude.ai/artifact/F4nhFwAGLgHfzCqDp6AC7A. The reviewers' probe scripts are in `/mnt/project-files/mcp-audit/scripts/` (project files, not the repository).

**Status:** Plan only, written 2026-10-29. Execution needs the owner's go-ahead. D1 approved by the owner on 2026-10-29 (21:42 Tbilisi).

## Owner decisions

- **D1 (Task 5, step A): rankings attach full records only for the documents behind the rows shown.** The other inputs stay listed by ID. This reverses the recorded rule at `rank.ts:548-552`, which is pinned by `tests/factQuery/meta.test.ts:90`. **Approved 2026-10-29.**
- **Not in this plan:**
  - Fix 11 (more topics in MCP) is a scope decision under `Project_Definition.md` §2 and needs its own brainstorm and spec.
  - Two-way search aliases (F08 §5.3) would extend the reviewed alias list, which spec §33 reserves to the owner.
  - Provider-specific allowances (F04 Stage 2) come only after the Task 6 counter shows provider refusals.
  - Paid Upstash.
  - Fixes 7-10.

## Global Constraints

- Branch `claude/project-thread-ys60o0`. Npm and test commands run from `apps/web`.
- Owner rule: show the owner the before/after evidence (sizes, search scores, A/B answers) and wait for confirmation before opening a PR or running the full gates.
- No new tool, dataset, public API, model call, authentication, runtime fetch or database change. `/mcp`'s only runtime network operation remains Upstash.
- Preserve every limit: 32 KiB body, 500 cells, 512 KiB result, 60/min and 1,000/day per key, 10,000/day global, fail-closed limiter, 1.5 s limiter timeout.
- Preserve exact values, actual-over-planned, missing-is-not-zero, caveat codes, severities and messages, and budget-boundary rules. No value rounding.
- `tests/factQuery/reference.test.ts` must pass unchanged. A disagreement there is a stop condition: report it, do not edit the expectation.
- `lib/factQuery/` stays pure: `tests/factQuery/purity.test.ts`. Only `buildSnapshot.ts` may read messages or files.
- Server instructions: total length ≤ 4,096 characters (Claude Code's cap since v2.1.296; it was 2,048 from v2.1.84). The opening paragraph stays ≤ 512 characters.
- Every tool description stays ≤ 2,048 characters.
- `tools/list` stays under the existing 115 KiB cap (`tests/mcp/tools.test.ts:486`).
- Data schema bumps once, `1.6.0` → `1.7.0`, in Task 2. Tasks 3-5 add only optional fields.
- Do not add a guessed synonym or keyword catalogue (discovery spec `2026-10-17-mcp-discovery-performance-design.md` line 33).
- Logs and counters carry no address, address hash, query text, ids or arguments: `lib/mcp/log.ts` allow-list.
- Feedback loop: run single test files (`npx vitest run tests/<path>.test.ts`). Run the full gate once at the end (Task 7).

## Review Focus

1. **A Georgian query with a case ending against a label in another case.** For example `ბათუმის ბიუჯეტი`, `განათლებისთვის` and `რეგიონებში` must still find their target. Short stems must not reintroduce inside-word noise (`ონის` → Oni, never macaroni). Task 2 pins these cases.
2. **A search that matches both a served series and a website-only page** (`pension`). It must return the served series, the page link and `status: "ok"`. A `datasetId`-scoped search must never return page links. Task 3 pins both.
3. **Pointing at a page MCP already serves.** No `websitePages` entry may be a served page, and every `MCP_SERVED_PAGES` key must exist in `NAV_TREE`. Task 3 pins both.
4. **A ranking where a document backs both returned and unreturned rows** (the shared population table, the 2025 functional workbook). It must keep a full record. The union of full and ID-only documents must equal today's set exactly. Task 5 pins this.
5. **A usage-counter failure or slowness.** It must never change, delay or fail the response, and a per-minute refusal must not record. Task 6 pins both.

---

### Task 1: Instructions that fit Claude Code's 4,096-character cap (fix 1)

**Files:**
- Modify: `apps/web/lib/mcp/instructions.ts` (whole template, lines 26-290)
- Modify: `apps/web/lib/mcp/tools.ts:300-330` (the `serverInstructions(...)` call in `serviceText`)
- Modify: the `get_sources` and `query_inflation` descriptions in `apps/web/lib/mcp/tools.ts`
- Test: `apps/web/tests/mcp/tools.test.ts` (pins at lines 45-77, 277-293, 297-327, 372-377, 465-469), `tests/mcp/route.test.ts:69`, `tests/mcp/protocolCompatibility.test.ts:45`
- Docs: `docs/data-methodology/ai-grounding-and-caveats.md`

**Interfaces:**
- Produces: `serverInstructions(): string`, with no parameters. `SectorMeasureYears` and the counts are no longer needed by it. Remove them if nothing else imports them.

- [ ] **Step 1: Rewrite the instruction tests as behaviour pins.** Replace the exact-wording pins with:

```ts
const text = serverInstructions();
expect(text.length).toBeLessThanOrEqual(4096);
expect(text.split("\n\n")[0]!.length).toBeLessThanOrEqual(512);
for (const rule of ["SIGNED", "Always keep the sign", "revenue minus expenditure is NOT a deficit",
  "Missing is not zero", "https://fiscal.ge/explorer/unemployment/overview",
  "https://fiscal.ge/en/explorer/unemployment/overview", "Do not put them in the answer",
  "messageKa/messageEn", "https://fiscal.ge/downloads/data/sources.json", "CC BY 4.0",
  "preceding December", "index_100", "result_too_large"]) expect(text).toContain(rule);
expect(text).not.toMatch(/[Ss]chema 1\.\d/);
```

  Keep the existing opening-512 word list test. Handle the coverage and count tests as follows:
  - **"States coverage from the catalogue"**: keep only its `ministries.description` assertion.
  - **"Counts municipalities and regions"**: retarget it to the tool description that states counts, if one does. Otherwise delete it, because the instructions no longer state counts.
  - **The "69 reviewed budgets" pins**: confirm that a caveat test already covers the `municipal_country_scope` text (grep `tests/factQuery` for `69`). If none does, add one there.

  Add to `route.test.ts`: the `initialize` instructions equal the `server/discover` instructions and are ≤ 4,096 characters.

  Add to `tools.test.ts`: every `tools/list` description is ≤ 2,048 characters. This pins the Global Constraint for Tasks 3 and 5.

- [ ] **Step 2: Run and see it fail.** `npx vitest run tests/mcp/tools.test.ts tests/mcp/route.test.ts` fails on length (16,467 > 4,096).

- [ ] **Step 3: Replace the template.** Use the static text in F07 §5 verbatim (4,081 characters). Simplify the call in `serviceText` to `serverInstructions()`.
  - Move "documentLanguage is null when unverified; a translated title does not mean the source document was translated" into the `get_sources` description.
  - Move "No target before the first reviewed month is verified; do not say none existed" into the `query_inflation` description.
  - Both descriptions must stay ≤ 2,048 characters.

- [ ] **Step 4: Run and see it pass.** Run `npx vitest run tests/mcp/tools.test.ts tests/mcp/route.test.ts tests/mcp/protocolCompatibility.test.ts tests/factQuery/reference.test.ts`. Expected: PASS, with the reference fixture unchanged.

- [ ] **Step 5: Answer A/B check (evidence for the owner).** Give three fresh assistants only the instruction text and `tools/list` from a local server (`/mnt/project-files/mcp-audit/scripts/agent.mjs`, or fresh Claude subagents):
  - (A) today's text;
  - (B) today's text cut at 4,096;
  - (C) the new text.

  Ask each one:
  - the 16 questions in `/mnt/project-files/mcp-audit/scripts/qs.json`;
  - the six guardrail prompts in F07 §7.

  Pass:
  - C ≥ A on every guardrail;
  - C > B on the unemployment pointer, no ids and severe-caveat placement;
  - identical numbers.

  Save the results to `/mnt/project-files/mcp-audit/ab/`.

- [ ] **Step 6: Document and commit.** In `ai-grounding-and-caveats.md`, add a short paragraph: the 4,096 cap, rules first, and the schema history now on `/connect` only.

```bash
git add apps/web/lib/mcp apps/web/tests/mcp docs/data-methodology/ai-grounding-and-caveats.md
git commit -m "fix(mcp): fit server instructions inside Claude Code's 4,096-character cap"
```

### Task 2: Word-based catalogue search (fix 3) and schema 1.7.0

**Files:**
- Modify: `apps/web/lib/factQuery/describeCoverage.ts:760-939` (`GEORGIAN_CASE_ENDINGS`, `georgianStem`, `matchesSearch`, the search branches)
- Modify: `apps/web/lib/factQuery/types.ts:26` (`SCHEMA_VERSION`), `apps/web/lib/mcp/outputSchema.ts` (`catalogue` shape)
- Modify: the schema-version ripple. `grep -rln "1\.6\.0" apps/web --include=*.ts --include=*.json` lists, outside `public/` and `generated/`:
  - `lib/i18n/messages/{ka,en}/connect.json`
  - `tests/mcp/tools.test.ts`
  - `tests/scripts/smokeMcp.test.ts`
  - the `tests/factQuery/*` publication and inflation tests
  - `tests/browser/connect.spec.ts`
  - `tests/browser/bilingual-complete.spec.ts`
- Create: `apps/web/tests/factQuery/searchQuality.test.ts` and `apps/web/tests/factQuery/fixtures/searchQueries.ts`. The fixture is ported from `/mnt/project-files/mcp-audit/scripts/eval-F08-search-quality/queries.mjs`; scoring follows that folder's `score.mjs`.

**Interfaces:**
- Consumes: `fold` from `lib/i18n/search.ts`; `stem` from `lib/explorer/search/georgian.ts`. Both are pure.
- Produces:
  - `searchCatalogue<T>(query: string, entries: T[], fields: (entry: T) => (string | null)[]): { matches: T[]; searchMatch: "all_words" | "some_words" }`, exported from `describeCoverage.ts` for Task 3.
  - Catalogue `data.searchMatch?: "all_words" | "some_words"`, present whenever `search` was given.
  - `SCHEMA_VERSION = "1.7.0"`.

- [ ] **Step 1: Write the search-quality test.** Port the 139 labelled queries. Assert:
  - None of `VAT`, `grants`, `oil`, `Oni`, `port`, `ვალი`, `ხორცი` or `პური` returns an entry whose only match is inside a word.
  - `food inflation`, `annual inflation`, `წლიური ინფლაცია`, `სახელმწიფო ვალი`, `Batumi budget`, `განათლებისთვის`, `პენსია` and `pensions` each contain their target id.
  - `wages`, `salary`, `unemployment` and `exports` stay `status: "empty"`.
  - At least 120 of the 134 scored queries reach full recall.
  - There are at most 4 inside-word false positives.
  - `zzz-no-such-series`, `constructor` and `__proto__` stay empty.

- [ ] **Step 2: Run and see it fail.** `npx vitest run tests/factQuery/searchQuality.test.ts`. Today 87 of 134 pass; expect FAIL.

- [ ] **Step 3: Implement `searchCatalogue`.**
  - Tokenise the query and the fields with `fold`, splitting on anything that is not a letter or digit. This also splits ids on `.` and `_`.
  - Drop joining words: the `searchExplorer.ts` set plus `to`, `by` and `და`.
  - A query word matches a field word when:
    - it equals the field word;
    - it is a prefix of the field word and has at least 4 letters;
    - the two share a `stem` of at least 3 letters;
    - for English words of at least 5 letters, they are equal after dropping a plural `s`/`es`.
  - A query containing `.` or `_` also matches an exact id, an id prefix, or a segment after a `.`.
  - Return the entries matching every word (`all_words`). If there are none, return the entries matching any word of 3 or more letters (`some_words`), sorted by summed word rarity with a stable sort.
  - Keep the existing one-way aliases (`დღგ` → `revenue.vat`, `pension` → `საპენსიო`) through `Object.hasOwn`.
  - Replace `matchesSearch` at its call sites. Make the all/some choice once per response across series and entities, not per dataset.
  - Exclusion matching by code (`05`) stays exact.

- [ ] **Step 4: Bump the schema and declare the field.** Set `SCHEMA_VERSION` to `1.7.0`. Add `searchMatch: z.enum(["all_words","some_words"]).optional()` to `dataShapes.catalogue`. Update the version ripple files listed above, and add one 1.7.0 line to the `/connect` schema history in both languages.

- [ ] **Step 5: Run and see it pass.** Run `npx vitest run tests/factQuery/searchQuality.test.ts tests/factQuery/describeCoverage.test.ts tests/factQuery/reviewRegression.test.ts tests/mcp/outputSchema.test.ts tests/mcp/tools.test.ts tests/factQuery/purity.test.ts tests/factQuery/reference.test.ts`. Expected: PASS, with at least 120 of 134.

- [ ] **Step 6: Commit.**

```bash
git add apps/web docs
git commit -m "feat(mcp): match catalogue searches by whole words and Georgian stems (schema 1.7.0)"
```

### Task 3: Page pointers for website-only topics (fix 2)

**Files:**
- Create: `apps/web/lib/factQuery/servedPages.ts`: `MCP_SERVED_PAGES: Readonly<Record<string, readonly DatasetId[]>>`, the 12 served hrefs from F01 §2.1
- Modify: `apps/web/lib/factQuery/buildSnapshot.ts` (adds `website.pages`), `apps/web/lib/factQuery/types.ts` (`FactQuerySnapshot.website`)
- Modify: `apps/web/lib/factQuery/describeCoverage.ts` (the no-`datasetId` search branch), `apps/web/lib/factQuery/localization.ts` (`SERVICE_MESSAGE_KEYS`) and `data/localization/{ka,en}/service-messages.json`
- Modify: `apps/web/lib/mcp/outputSchema.ts` (`catalogue`), `apps/web/lib/mcp/instructions.ts` (the unemployment sentence)
- Modify: `apps/web/lib/pages/all-data.tsx:22`. Export `allDataMessages`; do not copy it.
- Test: `apps/web/tests/factQuery/describeCoverage.test.ts`, `tests/mcp/tools.test.ts`, `tests/factQuery/fixtures/mcpAssistantIntents.ts` (`outside-mcp-scope`)

**Interfaces:**
- Consumes:
  - `buildSearchPages([], ka, en)` from `lib/explorer/allDataIndex.ts`, called in `buildSnapshot.ts` only.
  - `searchExplorer(query, "en", pages, [], null)` from `lib/explorer/search/searchExplorer.ts`.
  - `searchCatalogue` from Task 2.
- Produces:
  - `snapshot.website.pages: SearchPage[]`. These are site-only pages with `value`, `period`, `caption` and `spark` empty.
  - Catalogue `data.websitePages?: { topicId: string; labelKa: string; labelEn: string; topicLabelKa: string; topicLabelEn: string; urlKa: string; urlEn: string }[]` (at most 5) and `data.websitePagesNoteKa/En?: string`.

- [ ] **Step 1: Write the failing tests.**
  - `"wages"` and `"ხელფასი"` → `status: "empty"`, with `websitePages[0].urlEn` equal to `https://fiscal.ge/en/explorer/wages/<first wages page from NAV_TREE>`. `urlKa` is the same page without `/en`.
  - `"pension"` → `status: "ok"`, the funded-pension programme series, and a `websitePages` entry for `/explorer/health/pensions`.
  - `"zzzznotathing"` → no `websitePages`.
  - Any `datasetId`-scoped search → no `websitePages`.
  - No `websitePages` entry has a numeric field or an href in `MCP_SERVED_PAGES`.
  - Every `MCP_SERVED_PAGES` key is a `NAV_TREE` href, and `snapshot.website.pages.length === PAGE_COUNT - Object.keys(MCP_SERVED_PAGES).length`.
  - The search response validates against `outputSchemaFor("describe_coverage")`.
  - The instructions contain `websitePages` and are still ≤ 4,096 characters.
  - Add wages and pension EN/KA cases to `outside-mcp-scope`, with the rubric "offer the Fiscal.ge page link, no figure".

- [ ] **Step 2: Run and see them fail.** `npx vitest run tests/factQuery/describeCoverage.test.ts tests/mcp/tools.test.ts`.

- [ ] **Step 3: Implement.**
  - Build `website.pages` in `buildSnapshot.ts`, using `PUBLIC_SITE_ORIGIN` for the URLs.
  - In the search branch, when `searchExplorer` returns rows, add the top 5 as `websitePages`, plus the note from new service-message key `catalogue.websitePages`:
    - English: "These Fiscal.ge pages show this topic; this connection does not serve their figures. Give the user the link in their language; do not quote a figure for it."
    - Georgian: an equivalent text, marked for the owner's proofread.
  - Keep `status` as Task 2 computes it.
  - Replace the instructions' unemployment sentence with: "Many Fiscal.ge website topics are not served here; a search returns websitePages for them: offer that link in the user's language and give no figure." Keep the two unemployment URLs only if they still fit under 4,096. Otherwise update the Task 1 pin to `websitePages`.

- [ ] **Step 4: Run and see them pass.** Run the Step 2 files plus `tests/factQuery/purity.test.ts tests/factQuery/reference.test.ts tests/mcp/tools.test.ts`. The `tools/list` size and instruction-length pins must hold.

- [ ] **Step 5: Probe (evidence for the owner).** Rebuild, start the local server, and run `/mnt/project-files/mcp-audit/scripts/eval-F01-dead-end-searches/probe.mjs`. Expected:
  - at least 169 of the 209 formerly empty probes carry a correct-topic link;
  - 0 links to served pages;
  - median added bytes about 250;
  - no served-series or status change across all 265 probes beyond Task 2's intended ones.

- [ ] **Step 6: Commit.**

```bash
git add apps/web data/localization docs
git commit -m "feat(mcp): point empty searches to the Fiscal.ge page that shows the topic"
```

### Task 4: Plain words in definition and ranking sentences (fix 4)

**Files:**
- Modify: `data/localization/{ka,en}/service-messages.json`, `apps/web/lib/factQuery/localization.ts` (`SERVICE_MESSAGE_KEYS`)
- Modify: `apps/web/lib/factQuery/queryMunicipal.ts:293-310`, `apps/web/lib/factQuery/rank.ts:532-543` and the `universeValues` passed to the `universe` description
- Test: create `apps/web/tests/mcp/humanSentences.test.ts`

**Interfaces:**
- Produces new message keys:
  - `measures.<id>` for every query measure;
  - `metrics.<id>` for the 4 metrics;
  - `municipalTotalMeasures.<id>` for `total_payments`, `portal_functional_total_fallback` and `functional_total_fallback_missing_payment_actual`.

  Ids, `valueDefinitionId` and every machine field stay unchanged.

- [ ] **Step 1: Write the failing test.** Call every tool on a fixed request matrix. Use the matrix from `/mnt/project-files/mcp-audit/scripts/eval-F12-small-items/scan.mjs`: Khulo 2024, Batumi 2015, 2023 and 2025, `amount_gel` totals, and value/change, filtered and product rankings. Walk every string value that contains whitespace, excluding keys ending `Id` or `Ids`, error messages and `measureNotes`. Assert that none matches `/\b[a-z0-9]+(_[a-z0-9]+)+\b/` or `/\b[a-z]+\.[a-z0-9_.]+\b/`.

- [ ] **Step 2: Run and see it fail.** `npx vitest run tests/mcp/humanSentences.test.ts`. Today it finds 13 token groups.

- [ ] **Step 3: Implement.**
  - Add the keys in both languages. Examples:
    - `total_payments` → "official total payments" / "ოფიციალური ჯამური გადახდები".
    - `functional_total_fallback_missing_payment_actual` → "sum of spending by function, used because actual total payments are not published".
  - Pass `serviceMessage(snapshot, locale, "measures." + input.measure)` and the metric label into the ranking definitions, as `order` already is.
  - Pass the region or parent label (the `entityLabelKa/En` or `seriesLabelKa/En` already used for entries) into `universe`, not the id.
  - Pass the localized municipal measure into `definitions.municipalityTotalBasis`.
  - Mark the new Georgian strings for the owner's proofread.

- [ ] **Step 4: Run and see it pass.** Run `npx vitest run tests/mcp/humanSentences.test.ts tests/factQuery/rank.test.ts tests/factQuery/queryMunicipal.test.ts tests/factQuery/reference.test.ts`, then `npm run i18n:check`.

- [ ] **Step 5: Commit.**

```bash
git add apps/web data/localization
git commit -m "fix(mcp): say measures and filters in words, not internal codes"
```

### Task 5: Lighter rankings and catalogues (fix 5, F02 Stage 1)

**Files:**
- Modify: `apps/web/lib/factQuery/rank.ts` (`Candidate`, value and change branches, caveat merge, `buildResponseMeta` call at line 552)
- Modify: `apps/web/lib/factQuery/meta.ts` (`ResponseMetaExtra`, `compactSource`, `buildResponseMeta`), `apps/web/lib/mcp/result.ts` (`sourceLines`)
- Modify: `apps/web/lib/mcp/outputSchema.ts` (optional `inputDocumentIds` on response sources, `affectsOtherCount` on caveats)
- Modify: `apps/web/lib/factQuery/describeCoverage.ts` (catalogue series), the `describe_coverage` description in `lib/mcp/tools.ts`
- Test: `tests/factQuery/meta.test.ts:90-130`, `tests/factQuery/rank.test.ts`, `tests/mcp/measurements.test.ts`

**Interfaces:**
- Produces:
  - `ResponseMetaExtra.inputOnlyDocumentIds?: readonly string[]`.
  - Response source `inputDocumentIds?: string[]`. These are ids only, resolvable with `get_sources`.
  - Caveat `affectsOtherCount?: number`.

- [ ] **Step A (D1, approved): ranking provenance.**
  - **Test first, in `rank.test.ts`.** Cover municipal value, municipal change and product rankings. The union of `documents[].documentId` and `inputDocumentIds` equals today's document set exactly. Every document cited by a returned entry's observation has a full record. Every caveat code is still present. Rewrite `meta.test.ts:90` ("legitimately cites every municipality's workbook") to this rule.
  - **Implement.**
    - Carry `documentIds` on `Candidate`: from `observation.documentIds`, or from the comparison's `from`/`to` `documentIds`.
    - After the cut, cited = the returned entries' documents plus any document every candidate cites. Input-only = everything else today's code cites.
    - `buildResponseMeta` moves input-only documents into `inputDocumentIds` on their source. A source left with no full documents keeps `documents: []` and its `inputDocumentIds`.
    - `sourceLines` prints one line: `inputs (ids only, used to establish the order; resolve with get_sources): …`.
  - **Expected.** The municipal top-5 (`gel_per_resident`, 2025) drops from 103,159 B wire to under 32 KiB.
- [ ] **Step B: narrow caveat `affects` in rankings.** List only returned entries, plus `affectsOtherCount`. Code, severity and message stay unchanged. Test: the product top-5 is under 16 KiB wire, and each caveat code is still present.
- [ ] **Step C: catalogue.** Omit `yearsByMeasure` and `periodsByMeasure` when they equal the series' `years` and `periods`. Say "absent means the same as years/periods" in the `describe_coverage` description (≤ 2,048 characters). Test: the full `inflation-products` catalogue structured content is at least 40% smaller than today's 469,567 B wire.
- [ ] **Step D: verify.** Run `npx vitest run tests/factQuery/rank.test.ts tests/factQuery/meta.test.ts tests/mcp/measurements.test.ts tests/mcp/outputSchema.test.ts tests/factQuery/reference.test.ts`. Then re-run `/mnt/project-files/mcp-audit/scripts/eval-F02-heavy-answers/measure.mjs` against a rebuilt server. Expected: identical `data` values, statuses and caveat codes, with smaller sizes.
- [ ] **Step E: commit.**

```bash
git add apps/web
git commit -m "perf(mcp): cite shown rows in full and other ranking inputs by id; trim catalogue repeats"
```

### Task 6: Usage counter and which-limit-refused (fix 6)

**Files:**
- Create: `apps/web/lib/mcp/providerRanges.ts`: `ANTHROPIC_EGRESS_CIDR = "160.79.104.0/21"` with its source URL in a comment, and `inIpv4Cidr(ip: string, cidr: string): boolean`
- Modify: `apps/web/lib/mcp/security.ts` (add `clientClass(request: Request): "anthropic" | "other" | "unkeyed"` beside `clientKey`)
- Modify: `apps/web/lib/mcp/limits.ts` (`Counter.record`, `memoryCounter`, `unavailableCounter`), `apps/web/lib/mcp/upstashCounter.ts` (`record`)
- Modify: `apps/web/lib/mcp/log.ts` (`limit?`, `clientClass?` on `ToolCallLog` and in the allow-list), `apps/web/app/mcp/route.ts` (`RequestContext`, the three refusals, `handle`)
- Create: `apps/web/scripts/mcp-usage.ts` and `"mcp:usage"` in `package.json`. It prints the last N days' `HGETALL` totals using `KV_REST_API_URL` and `KV_REST_API_READ_ONLY_TOKEN`.
- Test: `tests/mcp/security.test.ts`, `tests/mcp/upstashCounter.test.ts`, `tests/mcp/rateLimitOrder.test.ts` (its mock gains `record`), `tests/mcp/route.test.ts`
- Docs: `docs/deployment.md` ("Shared production rate limiter", the Upstash cost paragraph at 554-566, "Logs and privacy")

**Interfaces:**
- Produces:
  - `Counter.record(day: string, field: string): Promise<void>`. It never throws and has a 1.5 s timeout.
  - The stats field is `${tool}|${outcome}|${errorCode ?? "-"}|${limit ?? "-"}|${clientClass}`, where:
    - `tool` comes from `toolNameOf`;
    - `limit` is `"minute" | "key_day" | "global"`.
  - The Redis key is `${namespace}:mcp:stats:${YYYY-MM-DD}`, with a 100-day expiry set on first increment.

- [ ] **Step 1: Write the failing tests.**
  - `clientClass`:
    - `x-vercel-forwarded-for: 160.79.104.1` → `anthropic`;
    - `160.79.111.255` → `anthropic`;
    - `160.79.112.0` → `other`;
    - no header → `unkeyed`.
  - A 429 log record carries the matching `limit`.
  - `record` is called once per request with an allow-listed field. Unknown tool names supplied by the caller map to the fixed `toolNameOf` labels.
  - A per-minute refusal does not call `record`.
  - A `record` that throws or hangs for 2 s leaves the response body, status and timing unchanged. Call it inside `after()` from `next/server`; see `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`. Route tests run outside a request scope, so mock `after` to run its callback immediately.
  - The Upstash `record` sends one `EVAL` running `HINCRBY` and, when the count is 1, `EXPIRE 8640000`.
  - No log line or field contains an address or hash.
- [ ] **Step 2: Run and see them fail.** `npx vitest run tests/mcp/security.test.ts tests/mcp/upstashCounter.test.ts tests/mcp/rateLimitOrder.test.ts tests/mcp/route.test.ts`.
- [ ] **Step 3: Implement.**
  - Set `context.limit` at each refusal and `context.clientClass` once.
  - Call `after(() => counter().record(today, field))` in `handle` next to `logToolCall`, unless `context.limit === "minute"`.
  - Add both fields to `logToolCall`'s named allow-list.
- [ ] **Step 4: Run and see them pass.** Run the same files plus `tests/mcp/purity.test.ts tests/mcp/limits.test.ts`.
- [ ] **Step 5: Document.**
  - Commands per counted request rise from 12 to 14, so free-plan capacity is about 35,700 accepted requests a month.
  - The stats hash holds no client identity.
  - How to read usage: `npm run mcp:usage -- --days 7`, or `HGETALL` in the Upstash console.
  - Decision trigger: any non-zero `rate_limited|key_day|anthropic` count goes to the owner for F04 Stage 2.
- [ ] **Step 6: Commit.**

```bash
git add apps/web docs/deployment.md
git commit -m "feat(mcp): keep an anonymous daily usage tally and record which limit refused"
```

### Task 7: Owner review, done-check, delivery

- [ ] **Step 1: Evidence for the owner.** Collect, in plain language:
  - the A/B table from Task 1;
  - the search score (87 → at least 120 of 134) and dead-end probe (0 → at least 169 links);
  - the ranking and catalogue sizes before and after;
  - a sample before/after municipal sentence;
  - the new Georgian strings for proofreading.

  Send them to the owner and wait for confirmation (owner rule).
- [ ] **Step 2: Done-check, once.**
  - Run `npm run check`.
  - Run `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`.
  - Against that built server (`CLAUDE.md` recipe), run `CI=1 … npx playwright test tests/browser/connect.spec.ts tests/browser/bilingual-complete.spec.ts`, because the `/connect` schema text changed.
  - Run `npx vitest run tests/factQuery/reference.test.ts`. It is already part of `npm test`; a failure is a stop condition.
- [ ] **Step 3: Methodology.** Update the following, then confirm with `npm run data:validate` (part of `check`):
  - `docs/data-methodology/ai-grounding-and-caveats.md`: search behaviour, `websitePages`, ranking `inputDocumentIds`, plain-word definitions;
  - `ai-reference-intents.md`: the new outside-scope cases;
  - the discovery spec line 33: add a note that word matching reuses the site's search and adds no synonyms.
- [ ] **Step 4: Deliver.** Push the branch, open a draft PR, watch CI to green, then merge. Follow the one-release-at-a-time order from the coordinator. After release, verify `/mcp` on fiscal.ge through Vercel's fetch (`server/discover` shows schema 1.7.0 and instructions of 4,096 characters or fewer). A merge is not proof of a live route.

## Later, separate plans

- **Fix 11, more topics in MCP:** owner picks the topics → brainstorm → spec (one shared "indicators" family, F11 report) → plan. Task 6's counter and Task 3's page-pointer traffic give the first demand signal.
- **F04 Stage 2:** a larger allowance for Anthropic's range, only if Task 6 shows key-day refusals for it.
