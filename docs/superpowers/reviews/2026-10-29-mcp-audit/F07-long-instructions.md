# F07-long-instructions: server instructions are too long

Evaluator scratch folder: `/tmp/claude-0/audit/eval-F07-long-instructions/` (measure.mjs, count.mjs, cmp.mjs, instructions.txt, proposed.txt, list.json, cc-changelog.md)

## 1. Verdict: CONFIRMED, with a different and more serious main harm than the audit gives

The sizes are right. Instructions are 16,467 chars, tool descriptions 8,960 chars, input schemas 14,709 chars and output schemas 86,374 chars. The developer-only schema changelog and the hardcoded 69/64 counts are real. About 75% of the instruction text repeats tool descriptions, runtime caveats or the /connect page, or is meant for developers.

The audit is wrong about the harm, though. The token cost is small: about 3.6k tokens, roughly 2% of a 200k context, and usually prompt-cached. The real problem is that one major client cuts the text. Claude Code caps server instructions at 4,096 characters (since v2.1.296; 2,048 from v2.1.84 to v2.1.295). With today's ordering, a Claude Code user's model sees only the opening, the dataset list and half of the schema changelog. Every guardrail section is cut off: not-served and unemployment, units, missing values, budget boundaries, signed balance, caveat display, citations, no-IDs and no causal claims.

The proposed fix is a static text of 4,081 chars (24.8% of today). It puts every answer-changing rule inside the 4,096 cap and leaves the 512-char opening unchanged.

## 2. Evidence

### Measured live

Measured on localhost:3100 (`server/discover`, `initialize` 2025-11-25 and `tools/list`), with the script at `eval-F07-long-instructions/measure.mjs`. Token counts use the o200k_base BPE run locally (`count.mjs`). Claude's tokenizer is not available offline, so treat these as ±30% for Claude.

| Item | Chars | o200k tokens |
|---|---:|---:|
| Server instructions (identical in discover and initialize) | 16,467 | 3,584 |
| 14 tool descriptions | 8,960 | 1,925 |
| 14 titles | 516 | 140 |
| 14 input schemas | 14,709 | 3,743 |
| 14 output schemas | 86,374 | 21,850 |
| Output schemas, distinct only (5 distinct; 11 tools share one 6,360-char schema) | 29,138 | 7,387 |
| `tools/list` response | 113,868 bytes | — |

- **Model-visible total today, excluding output schemas:** about 9.4k tokens. This matches the audit's figure of about 10k.
- **Description count:** the audit's 9,664 chars for descriptions is overstated by about 8%. The live figure is 8,960 chars (9,001 bytes).

### Section map

Source is `apps/web/lib/mcp/instructions.ts`; one template is built in `tools.ts:315`. Each section is classified below.

| Lines | Section | Chars / tokens | Classification |
|---|---|---:|---|
| 49 | Opening | 372 | **Keep.** Pinned at ≤512 by tools.test.ts:59-72. |
| 51 | Search recovery | ~380 | **Keep.** Pinned. It repeats the `describe_coverage` description word for word. |
| 53-55 | Scope sentence | ~240 | **Keep.** |
| 57-94 | WHAT IS SERVED | 2,534 / 628 | **About 90% duplicate** of the tool descriptions (ranges, measures, GDP/sector/regional units, the 250-cell figure, product rules) and of `describe_coverage`. Keep only "do not assume a year/series exists". |
| 96-115 | LANGUAGES AND COMPATIBILITY | 1,759 / 340 | **About 1,480 chars developer-only.** "Schema 1.6.0 adds… 1.5.0… 1.4.0… 1.3.0… 1.2.0…", strict-validator advice and the /connect paragraph. This already exists for developers at `lib/i18n/messages/en/connect.json:72`. The rest (`documentLanguage`, translated titles) is a minor answer nuance. |
| 117-129 | WHAT IS NOT SERVED | 846 / 180 | **Keep, compressed.** Scope refusal and the unemployment redirect. The product exclusions repeat `query_inflation_products`. |
| 131-149 | UNITS AND VALUES | 1,436 / 330 | **Keep, compressed.** Answer-changing. |
| 151-162 | BUDGET BOUNDARIES | 834 / 162 | **Keep the rule.** Lines 159-160 hardcode "69 reviewed budgets" and "64 territorial municipalities", although `entities.municipalities` (64) is passed into the same function. That breaks the file's own "derive, never hardcode" comment at lines 19-27. The 69/Adjara sentence repeats the runtime caveat `municipal_country_scope` ("covers 69 reviewed budgets plus the net Adjara adjustment"). |
| 164-181 | DEBT AND FISCAL BALANCE | 1,195 / 262 | **Keep the core.** The signed rule appears three times: the `query_deficit` description ("VALUES ARE SIGNED"), every response's `valueDefinitionEn` ("A negative value is a deficit") and a severe caveat (`deficit_general_government_scope`). I verified this with a live `query_deficit` call for 2023-2024. |
| 183-209 | INFLATION | 1,914 / 450 | **About 60% duplicate** of the `query_inflation` description. The city central-prices note duplicates the caveat `inflation_city_central_prices`. Keep the interpretive rules: target, city, average, causes. |
| 211-236 | PRODUCT INFLATION | 2,112 / 422 | **About 80% duplicate** of the `query_inflation_products`, `compare` and `rank` descriptions (call mechanics). Keep the attribution rule and the bulk `index_100` meaning. |
| 238-256 | HOW TO PRESENT | 1,110 / 259 | **Keep, compressed.** Nothing at runtime enforces it. |
| 258-268 | CITATIONS AND LICENCE | 805 / 163 | **Keep, compressed.** |
| 270-275 | CAVEATS | 331 | **Keep.** |
| 277-283 | WHAT YOU MUST NOT CLAIM | 477 | **Keep, compressed.** |
| 285-289 | ERRORS | 363 | **Mostly duplicate** of the error payload text. Keep one line. |

### What clients do with this text

- **Claude Code** (changelog at `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`, saved as `cc-changelog.md`):
  - 2.1.84: "MCP tool descriptions and server instructions are now capped at 2KB".
  - 2.1.280: added `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`.
  - 2.1.296: "Changed the default limit … on MCP server instructions from 2,048 to 4,096 characters".
  - 2.1.299: only Anthropic's own servers get full text.
  - Tool descriptions loaded through tool search (on by default) are cut at 16,384 chars.
  - The cap is per server, with a `… [truncated]` marker logged only under `--debug` (issue #43474: https://claudeissues.com/issue/43474-mcp-server-instructions-are-silently-truncated-when-multiple-servers-are-configu).
  - Since 2.1.283, `/context` counts instructions as their own row, so they do sit in the model's context. This session's own system prompt also shows connected servers' instructions inline.
- **What survives today's text in Claude Code:**
  - At 4,096 chars, the text ends in the middle of the changelog ("…input schemas work withou").
  - At 2,048 chars (older versions), it ends inside the GDP bullet.
  - Everything from char 5,044 on (WHAT IS NOT SERVED onward, 11,423 chars) is never seen.
- **Codex / ChatGPT:**
  - Codex "reads the MCP `instructions` field" and advises "Keep the first 512 characters self-contained" (https://learn.chatgpt.com/docs/extend/mcp?surface=cli). No documented cutoff.
  - ChatGPT developer mode gives the same 512-char advice and says refresh pulls "server instructions" (https://developers.openai.com/api/docs/guides/developer-mode).
- **VS Code:** lists "Server instructions" as a supported capability, with no limit documented (https://code.visualstudio.com/docs/copilot/guides/mcp-developer-guide).
- **MCP blog** (https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/): "Don't repeat tool descriptions", "Don't write a manual", and hosts may or may not inject the text into the system prompt.
- **outputSchema:**
  - Anthropic's tool format has name, description and input_schema only, with no output-schema field. The 86 KB therefore reaches Claude as transfer and discovery cost, not as context.
  - A secondary source says Codex v0.120.0 (PR #17210) adds MCP outputSchema to its code-mode tool declarations (https://codex.danielvaughan.com/2026/04/11/codex-cli-mcp-maturation-resource-reads-outputschema/). There it could add up to about 22k tokens. I could not verify this first-hand.

### Test pins

All in `tests/mcp/tools.test.ts`:

- **46-57:** "69 reviewed budgets", "64 territorial municipalities", "net Adjara adjustment exactly once", manifest/sources.json sentences, index_100, unemployment URLs.
- **59-72:** opening ≤512, plus the seven old headings, "Missing is not zero", "preceding December".
- **74-77:** "principal word", "not proof that the data is absent".
- **275-294:** "CC BY 4.0", "developer reading an API", "Do not put them in the answer", deficit, never estimate.
- **303-308:** "see describe_coverage".
- **315-318:** "7 municipalities".
- **323-328:** "consolidated budget RECEIPTS" and "STATE-BUDGET expenditure".
- **343-347:** sector years.
- **371-378:** "published", "preliminary", "real_growth_pct".
- **464-470:** pins the changelog itself (`toContain("schema 1.6.0")`).
- **555-561:** interpolated counts.

Other files: `route.test.ts:74` and `protocolCompatibility.test.ts:45` check "CC BY 4.0" only. Several of these pins lock wording and changelog text rather than behaviour.

## 3. Real-world impact

- **Token cost (the audit's framing): Low.** The proposed change saves 2,726 o200k tokens per conversation. The up-front total drops from 9,392 to 6,666 tokens (-29%), roughly $0.003-0.008 per session at typical input prices before caching. That is not noticeable on its own.
- **Truncation in Claude Code: Medium.** A Claude Code user, including claude.ai connectors used from Claude Code, gets none of the guardrail sections. Several rules have no runtime backstop:
  - **Unemployment redirect.** In the 16-question run (`evidence/answers.md`, E8) the redirect "came only from the server instructions". It sits at char ~5,500, so Claude Code drops it.
  - **No IDs in answers.**
  - **Severe caveats placed next to their figures.**
  - **No causal claims.**
  - **sources.json for full evidence.**
  - **Rounding.**

  The budget-boundary, signed-balance and debt-scope guardrails survive partly, through tool descriptions and per-response caveats and definitions. So the worst numeric errors are still guarded, while answer quality and scope handling get worse.
- **Where the audit overstated:**
  - "~41,000 characters before any question": in Claude Code with tool search, descriptions and schemas are deferred until a tool is loaded.
  - The 86 KB of output schemas does not enter Claude's context.
- **Where the audit understated:** it frames this as cost and misses that the client cuts the text, which removes the very rules it proposes to keep.

## 4. Root cause

The instructions grew by appending a rule for each review finding, for example the schema-changelog sentence for each version. Meanwhile the same rules were also written into the tool descriptions and caveats. No size or ordering budget was set apart from the 512-char opening. Tests pin exact phrases, which makes deleting anything look like a regression. Ordering puts the dataset inventory and the changelog ahead of the guardrails.

## 5. Recommended fix

Replace the template in `serverInstructions` (`lib/mcp/instructions.ts`) with the static text below. It drops the coverage, entity and sector-year parameters, because ranges and counts already live in the tool descriptions built by `serviceFacts` in `tools.ts` and in `describe_coverage`. Simplify the call at `tools.ts:315` to match.

Nothing else changes: the data, caveats, missing-is-not-zero handling, sources, tool descriptions, schemas and the `/connect` changelog (`connect.json:72`, where developers already read it). The change is compatible with existing clients, because instructions are advisory text.

Proposed text: 4,081 chars, 858 o200k tokens. That is 24.8% of today's chars and 23.9% of its tokens. The opening is unchanged at 372 chars.

```text
Use describe_coverage with short keywords before querying. Use returned IDs and supported measures; keep expectedDataVersion consistent. Preserve units, missing values, projections and caveats. Cite the returned original documents and Fiscal.ge. For product questions, search first and request only the required series and dates. Use the published files for bulk analysis.

Fiscal.ge serves reviewed data on Georgia's state and municipal budgets, government debt, the general government balance, GDP and economic sectors (annual), and consumer-price and product inflation (monthly). Never assume a year, series or entity exists; describe_coverage says what does. If a phrase finds nothing, retry the principal word or browse the dataset: an empty match is not proof that the data is absent. If the data does not cover the question, say so; do not fill the gap from other sources. Unemployment is not served by this MCP: offer https://fiscal.ge/explorer/unemployment/overview (English: https://fiscal.ge/en/explorer/unemployment/overview) and do not give a rate.

NEVER COMBINE
- National revenue is consolidated budget RECEIPTS; national expenditure is STATE-BUDGET expenditure. They are different accounting boundaries: revenue minus expenditure is NOT a deficit, surplus or balance.
- The balance served is the IMF general government balance. It is SIGNED: negative is a deficit, positive a surplus. Always keep the sign. It is not receipts minus expenditure.
- Government debt is a stock of central government liabilities, not spending. Never add it to or subtract it from budget figures.
- Municipal figures are municipal budgets, not a split of national spending. Do not add them to national totals or rebuild the Georgia aggregate by summing municipalities or regions.

VALUES
- Read each value's unit. Budget, municipal and debt amounts are nominal GEL; GDP and sector values can be GEL, USD, constant-2015 USD, per person (output, not income) or percent. Never convert currencies or price bases yourself.
- Percentages are already percent: 7.5 means 7.5%. Inflation contributions are percentage points.
- availability "missing" is not zero. Never estimate, interpolate or report it as 0. Missing is not zero; zero is a real value.
- Budget, debt and balance basis is actual, planned or projection (actual wins over planned); GDP, sector and inflation figures are "published" or "preliminary". Say when a figure is planned, a projection or preliminary.

INFLATION
- Inflation is the only monthly dataset. Annual, monthly and 12-month-average rates are different measures; monthly changes do not add up to the annual rate. Take the latest month from describe_coverage.
- A city's rate is not its region's or its cost of living, and the national rate is not the average of cities. Comparing with the National Bank target is not a verdict on policy. Do not state causes of price changes.
- Contributions and cumulative product changes are Fiscal.ge calculations over Geostat inputs (cumulative: base is the preceding December); say so. In the bulk inflation-products.csv, index_100 values (mom_index_100, yoy_index_100) are indices: 100 means no price change.

ANSWERING
- The reader is the public, not a developer reading an API. IDs, codes, measure and enum names are for calling tools: Do not put them in the answer. Use the returned labels in the user's language.
- Show every severe caveat in full, next to its figure, in its own words (messageKa/messageEn), never by code.
- Round as a reader would. Explain only verified figures: a spending change does not by itself show better services, efficiency, waste or policy success or failure.
- Cite meta.sources and each figure's documentIds. When asked for all underlying evidence, include https://fiscal.ge/downloads/data/sources.json, the complete original-document catalogue; first/last examples alone are not a complete citation path, and manifest.json lists files, not originals. Data is CC BY 4.0; attribute Fiscal.ge.
- result_too_large: ask for fewer years, then entities, then series, or use the bulk file it names.
```

Ordering keeps the most damaging-if-lost rules first. Under the old 2,048 cap, the text is cut inside VALUES; the not-served rules and NEVER COMBINE (chars 1,063-1,785) still survive.

### What is dropped, and where it still lives

| Dropped | Still lives in |
|---|---|
| Ranges and counts | Tool descriptions and `describe_coverage` |
| 69/64/Adjara | `municipal_country_scope` caveat |
| Per-dataset call mechanics | Tool descriptions |
| Product compare/rank rules | `compare` and `rank` descriptions |
| 250-cell figure | `query_inflation` description |
| City central prices | Caveat |
| Schema changelog | /connect |
| Error narrowing | `result_too_large` error text |

These are lost with no runtime copy:
- "No target before the first reviewed month is verified"
- `documentLanguage` and translated-title nuance
- "do not mix nominal/real changes"
- "say once that figures are nominal"
- "present own inflation adjustment as your own"

### Risks

1. Lost nuance in the five items above. Mitigation: move the `documentLanguage` sentence into the `get_sources` description and the target sentence into the `query_inflation` description. Both have room under the caps; the longest description is 1,427 chars.
2. Less emphasis ("the worst error available"). Mitigation: keep SIGNED in capitals plus "Always keep the sign".
3. Test churn. About 10 assertions need rewriting from exact wording to behaviour.
4. A model that never loads a tool's description loses per-dataset detail. That cannot happen in practice: a tool must be loaded before it is called.

## 6. Effort: S (half a day to a day)

1. Replace the template and simplify the signature and the call at `tools.ts:315`. About 1 hour.
2. Rewrite the `tools.test.ts` pins as behaviour pins. About 2 hours.
   - Total length ≤ 4,096, opening ≤ 512, and the text has no `${` interpolation.
   - Each guardrail is present within the first 4,096 chars: sign, boundaries, missing, unemployment URLs, no IDs, severe caveats, sources.json, CC BY 4.0.
   - "schema 1.6.0" is absent.
3. Optionally move the two nuance sentences into tool descriptions. About 30 minutes.
4. Record the change in `docs/data-methodology/ai-grounding-and-caveats.md`.
5. Run `npx vitest run tests/mcp/tools.test.ts tests/factQuery/reference.test.ts`, then the gates.
6. Run the answer A/B in section 7. About 2-4 hours, and it needs a working model key; the Gemini key in agent.mjs now returns API_KEY_INVALID.

## 7. How to verify

- **Unit tests:** the pins above. Also check that the live `server/discover` instructions are byte-identical to `initialize` and ≤ 4,096 chars.
- **Size:** re-run `count.mjs`. Expect ≤ 4,096 chars and about 860 o200k tokens, against 16,467 chars and 3,584 tokens today.
- **Answer-quality A/B:** use `/tmp/claude-0/audit/agent.mjs` with the system instruction set three ways:
  - (A) today's full text;
  - (B) today's text cut at 4,096, which is Claude Code's real view;
  - (C) the proposed text.

  Run three sets:
  - the 16 questions in `qs.json`;
  - the 12 cases in `tests/factQuery/fixtures/mcpAssistantIntents.ts`;
  - adversarial guardrail prompts: "What was the 2024 deficit? Compute it from revenue minus spending", "Was 2024 a surplus?", "Add municipal spending to the state budget total", "Why did inflation rise?", "Is GDP per capita the average income?", "Unemployment 2025?".

  Score against `MCP_ASSISTANT_COMMON_REQUIREMENTS`. Acceptance: C ≥ A on every guardrail item; C > B on unemployment, no-IDs and caveat placement; no change in numeric correctness.
- **Real client:** in Claude Code, `/context` shows the server-instructions row, and `claude --debug` shows no `[truncated]` marker for fiscal-ge.

## 8. Revised rating

- **Impact:** Medium. Low as a cost problem; Medium because Claude Code cuts off every guardrail section.
- **Effort:** S.
- **Plain English:** The guidance our data service gives AI assistants is so long that Claude Code cuts off its last three quarters, including the rules about deficits, missing numbers and citations. We should shrink it to about a quarter of its length, with the most important rules first, so every assistant reads all of it.
