# F02 — Heavy answers (tool results much larger than the data they carry)

Evaluator: F02-heavy-answers. Commit under test: aa2bb120 (local production build at http://localhost:3100/mcp). Date: 2026-10-29.
Scratch evidence: `/tmp/claude-0/audit/eval-F02-heavy-answers/` (`measure.mjs`, `measure.json`, `raw.json`, `sim*.mjs`, `tok.mjs`).

## 1. Verdict: PARTLY CONFIRMED

The byte figures in the report are accurate and reproduce to within 0.2%. Most of them are wire sizes, though, which count the answer twice: once as `structuredContent` and once as the text twin. No current client puts both halves in front of the model except ChatGPT. For an ordinary one-number question, the half a model actually reads is **about 0.5–1.6 k tokens**. That is modest, and most of it is legitimate citation, caveats and definitions. Measured on the model-visible half, the finding is **confirmed for three call types**:

1. **Municipal rankings.** A top-5 ranking cites all 65–66 workbooks: about 15.8 k tokens, 79% of the payload being source records for municipalities that were not returned.
2. **Dataset catalogues.** `describe_coverage` costs 14.4 k tokens for `inflation` and 78 k for `inflation-products`, roughly 60% of it repeated year/period lists.
3. **Whole-catalogue product rankings.** A caveat's `affects` list holds all 305 products: 3.7 k of the 5.6 k tokens.

The Gemini figure of "25k–108k tokens per simple question" is a cumulative total over 3–6 model turns. Each turn re-sends about 10 k tokens of fixed overhead (tool definitions plus instructions). The largest result-driven part is the 84 KB inflation catalogue call. A single one-number result is not the cause.

The 17 Oct audit flagged this (`docs/superpowers/reviews/2026-10-17-mcp-full-audit.md:133,141`). The remediation changed discovery guidance, not payloads: the 5-entry ranking measured 103,004 B then and 103,159 B now. Some reductions are safe because they keep every evidential document identified. Others would lose evidence or accuracy and should not be made: value rounding, dropping caveats, and cross-call "send once" sourcing.

## 2. Evidence

### 2.1 Method

- 27 successful representative calls covered **all 14 tools**, plus 2 erroring argument probes. Each request used its own `x-vercel-forwarded-for: F02-heavy-answers-<n>` header. Calls came from `/tmp/claude-0/audit/eval-F02-heavy-answers/measure.mjs`, using the arguments a fresh assistant actually used (`/mnt/project-files/mcp-audit/evidence/calls.log`) where available.
- **Bytes** are UTF-8 bytes of the decoded JSON-RPC response ("wire"), of `content[0].text` ("text") and of `JSON.stringify(structuredContent)` ("SC"). Each half is split into data / sources / caveats / definitions / other meta. The text half is split on its `## …` section markers.
- **Tokens** are an exact count with OpenAI's **o200k_base** BPE (GPT-4o/GPT-5 family). The vocabulary came from the `tiktoken@1.0.22` npm tarball's `encoders/o200k_base.json`, used as data only, with a self-written BPE (`tok.mjs`). Sanity checks: "Hello, world!" = 4 and "hello world" = 2, matching tiktoken. Claude and Gemini tokenizers differ and are likely somewhat higher on Georgian text. Treat the counts as ±30% for those models. Bytes/4 gives similar magnitudes here (for example, the municipal ranking's SC is 55,338 B / 4 ≈ 13.8 k against 15.8 k o200k tokens).

### 2.2 Sizes per call (bytes; o200k tokens)

| Call | Wire B | Text B / tok | SC B / tok | SC split (B): data · sources · caveats · meta | Docs in meta / cited by rows |
|---|---|---|---|---|---|
| describe_coverage {} | 24,601 | 11,826 / 2,194 | 12,013 / 2,268 | 11,649 · 0 · 0 · 288 | – |
| describe_coverage inflation | 84,267 | 40,178 / 14,309 | 40,365 / 14,383 | 40,001 · 0 · 0 · 288 | – |
| describe_coverage inflation-products | 469,565 | 224,465 / 78,111 | 224,652 / 78,185 | 224,288 · 0 · 0 · 288 | – |
| describe_coverage municipal-expenditure | 34,099 | 15,904 / 3,994 | 16,091 / 4,068 | 15,727 · – · – · 288 | – |
| describe_coverage search "education" | 34,081 | 16,322 / 4,348 | 16,509 / 4,422 | 16,145 · – · – · 288 | – |
| describe_coverage products + "bread" | 9,103 | 4,253 / 874 | 4,440 / 948 | 4,076 · – · – · 288 | – |
| query_national education 2025 | 9,030 | 3,863 / 728 | 4,787 / 1,017 | 1,409 · 3,013 · 2 · 288 | 2 / 2 |
| query_national VAT 2025 | 6,397 | 2,634 / 540 | 3,424 / 801 | 1,359 · 1,700 · 2 · 288 | 1 / 1 |
| query_national education 2016–2025 | 74,996 | 31,647 / 5,537 | 41,832 / 7,860 | 11,606 · 29,861 · 2 · 288 | 20 / 20 |
| query_ministries education 2025 | 6,793 | 2,820 / 542 | 3,633 / 810 | 1,457 · 1,811 · 2 · 288 | 1 / 1 |
| query_municipal Batumi 2025 | 9,329 | 4,067 / 919 | 4,913 / 1,164 | 1,368 · 3,180 · 2 · 288 | 2 / 2 |
| query_debt %GDP 2025 | 12,467 | 5,491 / 1,237 | 6,577 / 1,561 | 1,462 · 2,736 · 2,016 · 288 | 2 / 2 |
| query_deficit 2024 | 8,723 | 3,728 / 841 | 4,661 / 1,161 | 1,756 · 1,680 · 862 · 288 | 1 / 1 |
| query_gdp growth 2025 | 9,540 | 4,048 / 977 | 5,146 / 1,392 | 1,725 · 1,532 · 1,526 · 288 | 1 / 1 |
| query_economic_sectors C 2024 | 6,223 | 2,564 / 635 | 3,329 / 872 | 1,606 · 1,358 · 2 · 288 | 1 / 1 |
| query_regional_economies Imereti C 2024 | 9,431 | 4,109 / 846 | 4,973 / 1,099 | 1,673 · 2,935 · 2 · 288 | 2 / 2 |
| query_inflation headline 2026-09 | 7,796 | 3,608 / 828 | 3,841 / 971 | 1,566 · 1,910 · 2 · 288 | 1 / 1 |
| query_inflation headline, 12 months | 24,167 | 6,404 / 1,532 | 17,229 / 4,002 | 14,954 (4,932 = per-row definitions) · 1,910 · 2 · 288 | 1 / 1 |
| query_inflation_products bread cumulative | 11,891 | 5,631 / 1,053 | 5,907 / 1,204 | 1,852 · 2,915 · 777 · 288 | 1 / 1 |
| compare national education 2020→2025 | 15,729 | 6,920 / 1,263 | 8,295 / 1,602 | 1,933 · 5,998 · 2 · 288 | 4 / 4 |
| compare municipal Khulo 2024→2025 | 15,809 | 7,182 / 1,510 | 8,235 / 1,793 | 2,469 · 3,872 · 1,527 · 288 | 3 / 3 |
| **rank municipal gel_per_resident 2025 top 5** | **103,159** | 46,811 / 14,045 | **55,338 / 15,845** | 2,285 · **52,693** · 2 · 288 | **66 / (5 entries)** |
| rank municipal amount_gel 2025 top 5 | 99,578 | 45,126 / 13,694 | 53,503 / 15,457 | 2,174 · 50,969 · 2 · 288 | 65 / (5) |
| rank ministries 2025 top 5 | 8,652 | 3,535 / 656 | 4,744 / 986 | 2,573 · 1,811 · 2 · 288 | 1 |
| rank inflation cities food 2026-09 | 12,162 | 5,142 / 1,178 | 6,624 / 1,564 | 3,196 · 1,910 · 1,160 · 288 | 1 |
| rank products cumulative top 5 | 35,194 | 16,310 / 4,896 | 18,490 / 5,599 | 3,967 · 2,915 · **11,245** · 288 | 1 |
| get_sources (education's source) | 10,717 | 3,590 / 711 | 6,755 / 1,300 | n/a | 2 |

Further measurements:

- **Fixed overhead per model turn.** `tools/list` is 113,681 B / 28,267 tokens with output schemas, and 27,083 B / 6,376 tokens with only name, description and inputSchema. The server instructions are 16,469 B / 3,584 tokens.
- **The Gemini run** (`/tmp/claude-0/audit/res-flash.json`, fed text only; `agent.mjs` sums `totalTokenCount` over turns):

  | Question | Cumulative tokens | Max prompt | What drove it |
  |---|---|---|---|
  | E7 deficit | 24,831 | 13,210 | about 10 k fixed overhead plus two 8.7 KB results |
  | E2 inflation | 108,499 | 33,448 | the 84 KB `describe_coverage {datasetId:"inflation"}` result (14.3 k tokens of text) |
  | E1 education | 67,779 | 20,669 | – |

### 2.3 Where the size comes from (code)

- **Both halves are always shipped.** `apps/web/lib/mcp/result.ts:320-330`: `toolResult` returns `structuredContent: response` plus `renderText(response)`.
  - The text twin repeats every source record: `result.ts:250-261` (`sourceLines`) and `:263-287` (`evidenceOf`).
  - For catalogues the text is the whole JSON again (`result.ts:247`). That is why catalogue text and SC are the same size.
- **Source attachment.** `apps/web/lib/factQuery/meta.ts:81-107` (`buildResponseMeta`) narrows each source's documents to `citedDocumentIds` and then compacts them (`compactSource`, `meta.ts:42-71`, which hoists shared publisher and licence fields). The observation and compare tools pass the union of their rows' `documentIds`, so "docs in meta = docs cited by rows" holds for every non-ranking call above.
- **Why the municipal ranking attaches every workbook.** `apps/web/lib/factQuery/rank.ts:376-379` (value branch) and `:423-424` (change branch) set `citedDocumentIds` to all documents the sub-query cited. The sub-query runs over all 64 candidates, because that is what ranking requires. `rank.ts:548-552` states that this is deliberate: "A ranking over all 64 municipalities still names 64 workbooks - it genuinely read them". `tests/factQuery/meta.test.ts:90-92` pins it: "A ranking over every municipality legitimately cites every municipality's workbook, so narrowing cannot help it".
  - The spec basis is `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` §8.2: "A derived figure includes all contributing sources", and §11.3: "never silently trim sources or warnings".
  - It is therefore **deliberate, not a bug**. The cost is about 223 tokens and 759 B per municipal workbook record, × 59 non-returned municipalities.
  - The `RankEntry` carries no `documentIds`, so the response cannot say which workbook backs which row.
  - `meta.ts:26-27` still says rank omits `citedDocumentIds`. That comment is stale.
- **Product-ranking caveat.** `inflation_product_cumulative_derived` arrives from the merged sub-queries (`rank.ts:356-363`) with `affects` listing all 305 `product:period` IDs: 9,604 B for one caveat on a top-5 answer.
- **Catalogue repetition.** Per series, `years`, `yearsByMeasure`, `periods` and `periodsByMeasure` restate the same span. They account for 9.7 k of 14.2 k data tokens for `inflation` and 48.3 k of 78 k for `inflation-products`. Every year is written out, for example `[2015,…,2026]` three times per product.
- **Inside a document record**, the average cost is 211 tokens (o200k, 179 records across these calls):
  - officialUrl: 64.7 tokens. The MoF URLs are percent-encoded Georgian, which halves to 2,533 from 5,172 tokens across the 65 municipal records if decoded.
  - archiveUrl: 31.3 tokens.
  - years: 28.3 tokens.
  - documentId: 19.2 tokens.
  - titleKa, title and titleEn: 44 tokens together. `title` usually equals one of the other two.
- **Precision.** All 63 numeric values across the calls cost 307 tokens; rounding to 2 dp would cost 232. The saving is 75 tokens out of 172 k total SC tokens, or 0.04%.

### 2.4 What clients actually put into model context

| Client | Model sees | Evidence |
|---|---|---|
| **Claude Code** (installed 2.1.42 on this machine) | **structuredContent only**, as `JSON.stringify` (text twin dropped). Results over `MAX_MCP_OUTPUT_TOKENS` (default **25,000**) are written to a file, and the model gets a pointer. | `/opt/node22/lib/node_modules/@anthropic-ai/claude-code/cli.js`: function `BPA` returns `content: JSON.stringify(structuredContent)` when present; `RS9`/`qB1` apply `K_6() = parseInt(process.env.MAX_MCP_OUTPUT_TOKENS ?? "25000")`. Matching user report for v2.1.126: [anthropics/claude-code #55677](https://claudeissues.com/issue/55677-mcp-tool-result-content-text-dropped-from-model-when-structuredcontent-is-also-p). A conflicting older report, [#45575](https://claudeissues.com/issue/45575-tool-responses-with-both-content-text-and-structuredcontent-text-is-hidden), was closed "not planned". |
| **Codex CLI** | structuredContent if present, else content | [MCP client field-visibility survey (2026-06-04, pinned source)](https://olaservo-sandyland.static.hf.space/mcp/structured-content/client-survey.md) |
| **VS Code + Copilot Chat** | `JSON.stringify(structuredContent)`, dropping the text | same survey |
| **Gemini CLI** | content (text) only; never structuredContent | same survey |
| **ChatGPT (Apps/connectors)** | **both**. OpenAI documents `structuredContent` as "concise data the model can inspect" and `content` as helping the model answer; only `_meta` is "hidden from the model". | [OpenAI: Build an MCP server](https://developers.openai.com/plugins/build/mcp-server) |
| claude.ai web / Desktop | not documented; not verified | – |

The MCP spec recommends that servers "SHOULD also duplicate [structured content] into a content text block for backwards compatibility" (quoted in the survey above).

**Conclusion:** for Claude Code, Codex and Copilot the **structuredContent half is what matters**, and it is the larger half (about 1.2–1.4× the text). Gemini CLI uses the text half. ChatGPT pays for both. The compact text table (`result.ts:289-296`) therefore does not help Claude or Codex users.

## 3. Real-world impact

- **Ordinary one-value questions** (most of the 16-question run) cost about 0.5–1.6 k model-visible tokens per result. About 40–60% of that is the source record and about 0–30% is caveats. That is real citation value and not a problem worth a contract change. The audit's "≈ 9 KB" is the wire figure; it overstates what a model reads by 2–3×.
- **"Which municipality spends most / least" questions** carry 15.8 k tokens for 5 rows: 62 municipal records the answer does not mention, each with two URLs.
  - ChatGPT pays about 30 k because it reads both halves.
  - Claude Code stays under its 25 k file-offload threshold only by o200k count. Claude's own tokenizer was not measured, and a `limit: 10–20` ranking or a change ranking (two years of documents) would push it closer.
  - A fresh assistant hit this exact call (E6, 103,170 B).
- **Discovery** hits almost every question: instructions tell assistants to call `describe_coverage` first.
  - Dataset-level calls without a search term are 4–14 k tokens. The full product catalogue is 78 k tokens per half, which exceeds Claude Code's 25 k inline limit, so the model only gets a file pointer.
  - In the Gemini run the inflation catalogue tripled that question's prompt (13 k to 33 k) and the result was re-sent on every following turn.
- **Long series** add about 1.5 k tokens of source records per additional year, because each year cites a different workbook (education 2016–2025: 20 documents, 7.9 k tokens). That is correct and proportional.
- **Overstated:** the claim that the size is the same content repeated in text. It is repeated, but only ChatGPT reads both copies. Also, "25k–108k tokens per simple question" is mostly fixed per-turn overhead plus catalogue results. About 6.4 k tokens of tool definitions and 3.6 k of instructions go with every turn; that overhead belongs to F07-long-instructions, not to result payloads.
- **Understated:** the product-ranking caveat `affects` list (3.7 k tokens). The Claude Code 25 k cut-off also makes the full product catalogue effectively unusable inline there.

## 4. Root cause

1. **A deliberate completeness rule applied literally.** A ranking is treated as a derived figure whose evidence is every candidate's document (rank.ts:548-552, meta.test.ts:90-92, spec §8.2). Every document is then given in full, rather than identified.
2. **Rows do not carry provenance.** `RankEntry` has no `documentIds`, so the server cannot separate the documents behind the returned rows from the documents that only fixed the ordering.
3. **Catalogue fields are verbose.** The schema enumerates every year in up to three parallel lists per series. Caveat `affects` lists are inherited unchanged from internal sub-queries.
4. **The text twin was optimised for the wrong client.** It is compacted, but the clients that dominate (Claude Code, Codex, Copilot) read structuredContent, which was not compacted: per-row definitions, full year lists and redundant `title`/`name`/`publisher` legacy fields.
5. **The 17 Oct remediation** addressed discovery guidance and refusals only (`docs/superpowers/specs/2026-10-17-mcp-discovery-performance-design.md`); no payload change was in scope.

## 5. Recommended fix (staged)

**Principle:** every document that supports a returned number keeps its full record. Every other document that was an input stays **named by ID**, so nothing is silently dropped (§11.3) and each ID resolves through `get_sources`. Caveats, missing reasons, basis, definitions and full-precision values are unchanged.

### Stage 1 — schema-additive, no evidence loss (needs owner sign-off on the rank citation rule)

**1a. Ranking provenance**, in `rank.ts`, `meta.ts`, `result.ts` and `outputSchema.ts`:
- Carry `documentIds` on each internal `Candidate`, from `observation.documentIds`, or `from`/`to` `documentIds` in the change branch.
- After the cut, give `buildResponseMeta` two sets:
  - `citedDocumentIds`: documents of the returned entries, plus any document every candidate shares (the 2025 functional workbook, the population table).
  - a new `inputOnlyDocumentIds`: everything else.
- Extend `ResponseMetaExtra` and `compactSource` in `meta.ts` to emit `inputDocumentIds: string[]` on the source. The response-source object is already `.loose()` in `lib/mcp/outputSchema.ts`; declare the field optional.
- Have `result.ts` `sourceLines` print one line: `inputs (ids only, used to establish the order; resolve with get_sources): …`.
- Optionally add `documentIds` to `RankEntry`. That needs a schema change because entries are `additionalProperties:false`.
- Update `tests/factQuery/meta.test.ts:90-130` to the new rule, rather than deleting the completeness check (see §7).
- Expected: municipal top-5 SC goes from 15.8 k to about 3.7 k tokens (55.3 KB to 13.8 KB; wire about 103 KB to about 27 KB), about 76%. With 2a, it reaches about 3.3 k (−79%).

**1b. Caveat `affects` narrowing for rankings** (`rank.ts`, where caveats are merged):
- List the affected returned entries, plus `affectsOtherCount` (optional field; `caveat` is `.loose()`).
- Keep every caveat code, severity and message.
- Expected: product top-5 goes from 5.6 k to 2.0 k tokens (18.5 KB to 10.1 KB).

**1c. Catalogue: omit `yearsByMeasure`/`periodsByMeasure` when identical to the series' `years`/`periods`.**
- Both are already optional in the published schema. Document "absent = same as `years`/`periods`" in the tool description and in `describeCoverage.ts`.
- Expected: `inflation-products` goes from 78.2 k to 42.5 k tokens (−46%); search "education" −5%; `inflation` −1%.

### Stage 2 — schemaVersion bump (the structuredContent shape changes)

**2a. Year spans as ranges** (`{from,to}`, with explicit gap lists only when not contiguous) in the catalogue and in document `years`.
- Catalogue expected: `inflation` 14.4 k to 9.2 k (−36%); `inflation-products` 78 k to 33 k (−58%).

**2b. Source-record compaction** in `compactSource`:
- Omit `title` when it equals `titleKa`/`titleEn`.
- Omit legacy `name`/`publisher`/`attribution` when they equal the Ka/En variants.
- Omit null fields.
- Expected: −7% to −16% on ordinary answers (for example, `query_gdp` 1,392 to 1,164 tokens).

**2c. Definitions once in structuredContent** (`data.definitions` keyed by `valueDefinitionId`), mirroring what `result.ts:152-170` already does for text.
- Expected: 12-month inflation 4.0 k to 3.0 k (−25%); single values unchanged.

**2d. Full product catalogue becomes a summary by default.**
- Return a summary (counts by COICOP group plus "search by name"; about 0.6 k tokens) unless `search` or an explicit opt-in is given.
- Recommended in the 17 Oct audit (§133). This is a behaviour change that needs owner approval.

### Not recommended

- **Rounding values:** saves 0.04% and harms reproducibility.
- **Dropping caveats or missing reasons:** violates §11.3.
- **"Send each source once across calls":** the server is stateless and cannot know what the client kept.
- **"Citation stubs only, details via get_sources" for ordinary answers:** source records there are only about 300–700 tokens. An extra round trip re-sends the whole context, which costs more in cumulative tokens (the Gemini pattern).
- **Dropping the text twin:** Gemini CLI reads only text, and the spec says SHOULD.
- **Decoding percent-encoded official URLs:** saves about 2.6 k tokens on municipal rankings, but changes a citation link's exact form. Leave it to the owner; it is not needed once 1a lands.

**Compatibility.**
- Stage 1 is additive. Structured clients that validate against the published `outputSchema` accept extra optional fields, and the ranking still lists the same set of documents (part in full, part by ID).
- Clients that expected every candidate's full record in `documents` will now find 59 of them only as IDs. That is the one semantic change, and it needs owner approval because it reverses a deliberate, tested rule.
- Stage 2 changes field types and must bump `schemaVersion`. Clients cache `tools/list` per session, so a deploy can briefly mismatch for long-lived sessions.

**Risks.**
- A wrong "shared document" rule could drop a document that backs a returned row to an ID-only listing. Guard it with the invariant test below.
- `get_sources` cannot currently reproduce the exact rank input set with filters, because the five aggregate-only codes would differ. That is why the IDs must be listed explicitly rather than replaced with a filter hint.

## 6. Effort: M (1–3 days)

- Stage 1a + 1b (S, about 1 day): rank.ts candidate provenance, meta.ts extra, result.ts line, outputSchema optional fields, updated meta/rank tests, reference fixture run.
- Stage 1c (S, half a day): catalogue omission, plus description text and tests.
- Stage 2 (M, 1–2 days): schemaVersion bump, ranges, record compaction, definitions map, publications check, client-compatibility re-run (`scripts/smoke-mcp.ts`), and an owner decision on 2d.

## 7. How to verify

- **Completeness invariant (new test in `tests/factQuery/rank.test.ts`):** for municipal value, municipal change and product rankings:
  - the union of `documents[].documentId` and `inputDocumentIds` equals today's document set, exactly;
  - every document behind a returned entry has a full record;
  - every caveat code is still present.
- `npx vitest run tests/factQuery/reference.test.ts` must pass unchanged (values and orderings).
- **Size budgets in `tests/mcp/measurements.test.ts`**, as relations plus coarse ceilings:
  - municipal top-5 ranking wire < 32 KiB;
  - product top-5 ranking < 16 KiB;
  - full product catalogue SC at least 40% smaller than now.
- Re-run this evaluator's `measure.mjs` against a rebuilt server and compare `measure.json` row by row: identical `data` values, statuses and caveat codes, with lower SC/text tokens.
- Real-client check: Claude Code (structured path) and Gemini CLI (text path) answer E6 ("five municipalities spending most per resident") citing the five workbooks plus the population table, with no file offload.

## 8. Revised rating

- **Impact: Medium.** It is high for rankings over municipalities or products and for full-catalogue discovery, and low for ordinary one-value questions, which are about 1 k tokens and mostly legitimate evidence.
- **Effort: M** (Stage 1 alone is S).
- **Plain English:** Most answers are already a reasonable size. But "top municipalities" answers attach the full record of every one of the 64 budget books, and some catalogue answers list every year three times, so AI assistants spend tens of thousands of words of reading on paperwork. The fix keeps full references for the figures actually shown, names the remaining books only by their ID, and writes year spans once, so nothing is lost and those answers shrink by half to four-fifths.
