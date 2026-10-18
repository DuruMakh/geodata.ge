# Fiscal.ge MCP audit

17 October 2026. Read-only assessment of the public service at https://fiscal.ge/mcp, revised after a second independent review of the findings.

**Overall score: 7.5 out of 10.** Fiscal.ge has a sound foundation: fast small queries, reproducible figures, explicit limitations, strong request limits, and working modern and legacy connections. Its main weaknesses are incomplete evidence for some combined totals, several misleading labels and discovery failures, a missed monthly data release, and limited operational visibility.

This score assesses the existing approved MCP service. It does not penalize it for deliberately excluding newer website datasets. It is an engineering judgment based on the evidence below, not a certification or an availability guarantee.

The second review leaves the overall score at **7.5/10**, with stronger evidence behind the numerical assessment. No critical production defect was demonstrated. The most valuable work is to improve citations, labels, error handling and discovery. Small requests are already fast; a service rewrite is not justified.

| Area | Score | Assessment |
| --- | ---: | --- |
| Numerical correctness | 8.5/10 | Broad snapshot reconciliation, missingness and calculation checks passed; some unit descriptions do not. |
| Sources and verifiability | 7/10 | Detailed, accessible originals are usual; consolidated municipal evidence has important gaps. |
| Protocol and client compatibility | 9/10 | All 14 tools worked; legacy, pinned modern and automatic modern clients connected successfully. |
| Security and privacy | 8.5/10 | Public, read-only, bounded service; an unexpected-tool-error boundary needs repair. |
| Performance | 8/10 | Small live requests are fast; discovery can be unnecessarily large and some local calculations are more expensive. |
| Assistant and human usability | 7/10 | Bilingual setup and output are useful; instruction order, source lookup and recovery guidance need improvement. |
| Availability and operational visibility | 6.5/10 | Shared limits and safe shutdown are good; sustained capacity and retained operational evidence need attention. |
| Freshness | 6.5/10 | Inflation is one official release behind; the endpoint honestly reports its coverage. |

**What changed after reviewing the findings**

| Original finding | Second-review conclusion |
| --- | --- |
| 1. Municipal source chains | Confirmed; national citations need all 69 constituent budgets, while territorial views retain their 64-budget scope. Arithmetic was independently reconciled. |
| 2. Percentage labels | Confirmed across seven dataset/measure combinations. Ranking values agree with comparisons; the returned unit is wrong. The GDP wording error is English-only. |
| 3. City source lookup | Confirmed for all six city IDs locally and Batumi on production. |
| 4. Internal error exposure | Confirmed under injected internal faults in both protocol eras. No ordinary tested input exposed a real internal error or secret. |
| 5. Inflation freshness | Confirmed for the headline series. This establishes a review lag, not that every detailed source is ready. |
| 6. Operational retention | Confirmed mismatch between the runbook and accessible Vercel retention. Separate external monitoring remains unverified. |
| 7. Free-plan capacity | Reclassified as an already documented operating constraint. The first report overstated its novelty. |

Two further refinements matter: city-filtered discovery can offer unsupported national subgroups, and the measured 200-endpoint cumulative query spent much more time calculating availability metadata than price changes. The earlier website-wide **5/10** coverage score has been withdrawn because no approved coverage target or user-demand weighting supports it.

**What was established**

The checkout and live release both identify commit `4a55558aa7da5ef2197186b3ffab5d2ee0b68474`. Vercel reported production deployment `dpl_Erifm5Fm3H6i9s4kx5GKH9mmq5nh` as READY with the Fiscal.ge domains. The live manifest and regenerated local snapshot share data version `d09de86ea1f4b5c111fdf2accdebdb8c9f85500f5d785ad87f8d60ccafeff7c4`, schema `1.5.0`.

The service exposes 14 tools over 11 dataset families. All 14 returned a successful representative live answer. Live tests also covered both protocol eras, automatic negotiation, missing values, invalid arguments, stale data versions, oversized queries and bodies, malformed JSON, browser-origin rejection and unsupported HTTP methods. Requests were paced; production quotas were not deliberately exhausted.

All 22 central publications, totaling 57,002,699 bytes, matched their live manifest hashes and sizes. Nine distinct sampled source-archive links returned HTTP 200; the CPI source workbook also matched the checksum returned by `get_sources`. All seven existing connection-page browser tests passed against production, including both languages, mobile layout, keyboard copying and AI navigation.

**Important findings**

**1. Combined municipal totals are not fully supported by their cited originals.**

The live 2025 Georgia municipal total is **6,110,301,258.08 GEL**, but its evidence names only the Adjara republican-payments workbook. This does not supply all municipal inputs and the internal transfers used in the combined figure. A local query for Adjara's 2025 total also includes a 2015 receipts PDF as the transfer evidence. Requesting the transfer source specifically for 2025 falls back to that 2015 document and labels the narrowing `dropped_no_match`.

This is a source-completeness defect, not evidence that the arithmetic is wrong. It matters because an assistant can give the correct number with a citation that cannot establish the calculation.

The source omission affects all eleven published national totals from 2015–2025 and the shares calculated from them: 132 available country cells. Independent arithmetic checks reconcile the totals to all 69 prepared budget rows plus the net Adjara adjustment; they also reconcile the 110 national functional totals. The five budgets excluded from territorial municipal views still contribute to the national total. The existing country source-filter scope contains only the 64 territorially attributable municipality codes, so simply adding upstream source IDs would still risk filtering out relevant national inputs. Separately, 121 available Adjara cells spanning 2016–2025 use transfer evidence that resolves only to 2015.

Repair the derived-source mapping so each calculation term has relevant-year originals. Resolve the annual Treasury documents explicitly and preserve all 69 inputs when citing the national total, while retaining territorial exclusions in municipal and regional results. Check the source chain for Georgia and Adjara across the eleven years. Reuse the existing source registry and archive resolver, and verify that fuller evidence respects the response limit without dropping citations.

Evidence: `apps/web/lib/factQuery/sources.ts:91`, `apps/web/lib/factQuery/queryMunicipal.ts:186`, `apps/web/lib/factQuery/queryMunicipal.ts:233`, `apps/web/lib/factQuery/observations.ts:167`, `data/sources/source-documents.csv:103`; local data probes and live country/Adjara responses. `docs/data-methodology/municipal-functional-annual-2015-2025.md:214` explicitly permits those five original citations for the country total.

**2. Some percentages and percentage-point changes are labelled incorrectly.**

A live ranking of 2024–2025 changes in spending shares gives social protection a change of **1.1198120965560037** with `unit: "percent"`. The correct unit is **percentage points**. A share moving from 20% to 21% rises by one percentage point; its relative increase is 5%. These are different claims.

The reverse wording problem appears in the service instructions and GDP growth definition: an annual growth rate is described as percentage points even though its value is a percentage. The live GDP response contains this contradictory English definition alongside the correct `percent` unit.

All seven affected dataset/measure combinations reproduced: share of total and share of GDP for national revenue, national expenditure and ministries, plus share of total for municipal expenditure. Programme and regional rankings share this code path. Ranking values agree with the corresponding comparisons.

Choose the ranking unit by metric: percentage-point change uses `percentage_points`; relative percentage change uses `percent`; absolute change retains the endpoint's unit. Correct the two English growth descriptions; the Georgian GDP definition already says percent correctly. Existing types support `percentage_points`, so no new vocabulary is needed. Verify all seven combinations and preserve the already correct inflation units.

Evidence: `apps/web/lib/factQuery/rank.ts:470`, `apps/web/lib/factQuery/gdpSeries.ts:29`, `apps/web/lib/mcp/instructions.ts:68`; live `rank-pp` and `GDP-2025` responses.

**3. The normal city-to-source workflow breaks.**

`query_inflation` accepts `city.batumi` and returns August 2026 annual inflation of **7.0857%**. Passing that same city to `get_sources`, together with its valid source ID and year, returns `unknown_entity` and a list of municipal IDs. This was reproduced locally and on production.

The source validator reads the municipal entity registry but omits the inflation city registry. All six city IDs fail locally. Add those existing city IDs and retain the shared workbook that contains the city sheets; its document ID does not name individual cities. Until repaired, source lookup works when the city filter is omitted.

Evidence: `apps/web/lib/factQuery/getSources.ts:132`; live `city-source-filter` response. Reproduction arguments: `{"sourceIds":["source.geostat_cpi_yoy"],"entityIds":["city.batumi"],"years":[2026]}`.

**4. Unexpected tool exceptions can expose internal error text.**

The outer HTTP handler has a safe error response, but the SDK catches exceptions thrown inside a registered tool before that outer handler sees them. A local fault-injection test made a tool throw a synthetic internal file-path error. Both modern and legacy routes returned the full synthetic message to the caller as an HTTP 200 tool error.

Catch unexpected failures around the complete registered tool callback and return the existing safe bilingual service error. Keep useful validation errors intact and classify internal failures distinctly in the safe logs. Check both protocol eras. SDK output-validation errors occur after the callback, so that boundary needs separate verification before claiming every unexpected error is sanitized. This is a demonstrated failure-handling gap; no current production request was shown to expose real secrets. An additional 41 local POST cases found no naturally reachable internal exception or protection bypass.

Evidence: `apps/web/lib/mcp/tools.ts:434`, `apps/web/app/mcp/route.ts:208`; ignored diagnostic `.tmp/mcp-audit-security/tool-failure.ts`.

**5. Inflation data is one release behind.**

Live discovery stops at August 2026. A live September headline-inflation request returns `year_out_of_range`, explicitly saying coverage ends in August. Geostat published its [September 2026 inflation release on 2 October](https://www.geostat.ge/en/single-news/3862/inflation-rate-in-georgia-september-2026), fifteen days before this audit.

Refresh the reviewed inflation inputs through the existing validation and release process. Establish an owner and an expected review interval after each official release, and make the most recent reviewed period easy for assistants to state. Preserve the snapshot architecture and review requirement. The existence of the headline release alone does not establish that every detailed product or city workbook is ready for ingestion.

Evidence: live catalogue and `freshness.json`; source registry review dates and the linked official release.

**6. Operational evidence is shorter lived than the runbook implies.**

The runbook calls for fourteen days of detailed events and ninety days of aggregates. The actual Vercel log interface rejected a 24-hour query because this account's Hobby retention is one hour. A recent-window read worked and showed the intended privacy-preserving records. A one-hour runtime-error query found no runtime error clusters. Expected tool refusals were present in application logs and should not be mistaken for service outages.

No external retention or alerting setup was verified. The drains query returned 404, which is not proof that no external system exists. Align the runbook with the actual retention arrangement, identify the operating owner, and verify alerts for unexpected tool errors, 503 responses, slow calls and quota pressure. Alerts must read the application's `outcome` and `errorCode`: tool failures can have HTTP 200 and an infrastructure log level of `info`.

Evidence: `docs/deployment.md:588`, `apps/web/lib/mcp/log.ts:42`, `apps/web/app/mcp/route.ts:229`; provider evidence retained with the audit diagnostics.

**Documented capacity constraint, not a new defect**

The service permits 60 requests per minute and 1,000 per day for one network identity, with a global daily ceiling of 10,000. It makes three ordered limiter calls per accepted request. Its current implementation normally consumes about twelve Redis commands per accepted request; refusals consume commands too.

On the documented free plan, [Upstash provides 500,000 monthly commands](https://upstash.com/pricing/redis). That is approximately **41,000 accepted MCP requests per month**, before refusals and other consumption, or roughly **1,400 per day averaged over thirty days**. Initialization, discovery and other admitted requests also count; these are not 41,000 completed user questions. The runbook already explains this calculation, refusal costs and fail-closed exhaustion at `docs/deployment.md:465–479`. The 10,000 daily ceiling is a protective maximum, not a sustained capacity promise. This is a known tradeoff of the authorized free setup. Current Upstash account plan, usage and remaining quota were not independently verified.

Monitor usage before traffic grows. Evaluate an upstream abuse rule so rejected traffic does not keep consuming the application's Redis allowance. If legitimate use requires more capacity, make a budget decision using measured traffic. Keep fail-closed behavior. Clients sharing a connector's outbound address also share the 1,000/day allowance; assess whether this affects real users before changing identity handling.

Evidence: `docs/deployment.md:428`, `apps/web/lib/mcp/upstashCounter.ts:9`, `apps/web/app/mcp/route.ts:320`; [Upstash command accounting](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs).

**Performance measurements and improvements**

| Measurement | Result | Meaning |
| --- | ---: | --- |
| Ten repeated live one-cell national queries | Median 215 ms; range 205–430 ms | End-to-end request and body-read time from this audit machine; pacing time excluded. |
| Corresponding application duration logs | Median 14 ms; range 12–221 ms | Service handling time; different from end-to-end client latency. |
| Early connection requests | Up to 2.60 seconds | Initial requests were slower; cold-start and network components were not independently isolated. |
| Packaged snapshot | 32,096,273 bytes | Loaded once per function instance. |
| Five fresh local processes, snapshot read + parse + product index | Median 366 ms; range 315–385 ms | Local Windows measurement, excluding SDK, HTTP and limiter calls. |
| National total over 22 years, local query + response shaping | 2.25 ms median | Already inexpensive. |
| All 64 municipal entries for the latest year, same local timing | 17.42 ms median | Moderate work. |
| Full product catalogue, same local timing | 57.60 ms median | 469,421 bytes before the final protocol envelope. |
| 200 cumulative product endpoints, same local timing | 132.24 ms median | Query execution and response construction together. |
| 100-entry cumulative product ranking, same local timing | 170.87 ms median | A useful future regression benchmark. |

The local scenario measurements use ten warm samples each and were taken while other verification was running. Ten live samples describe this small run; they do not establish a production-wide p95 or a service-level objective. Live responses already use Brotli compression. Response-size figures above are decoded content sizes, not compressed network transfer sizes.

A separate second-pass measurement isolated the work for 200 cumulative product endpoints using 21 warm samples: **0.36 ms** for endpoint arithmetic, **46.37 ms** for coverage calculation, and **51.85 ms** for the full query before response rendering. These separately measured medians are not additive, and their scope differs from the earlier 132.24 ms result. They identify the useful optimization target: repeated historical availability scans. Existing cumulative prefix caches already make the arithmetic inexpensive. Evidence: `apps/web/lib/factQuery/inflationProductData.ts:67`, `apps/web/lib/factQuery/queryInflationProducts.ts:87`, `.tmp/mcp-second-experience/timing.json`.

The best improvement order is:

1. **Ask for less irrelevant information.** The full product catalogue uses about 89.5% of the 512 KiB response allowance. Direct assistants to `describe_coverage` with a product search first. Retain the complete catalogue for questions that need it and the existing static files for bulk analysis.
2. **Put essential instructions first.** The instructions contain 14,305 characters; their first 512 end inside regional coverage detail. Move discovery, units, missing values, citations and version consistency into a short opening. [Current Codex guidance recommends a self-contained first 512 characters](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). This does not establish universal truncation at exactly 512 characters.
3. **Cache immutable coverage summaries.** Global catalogue searches and product queries repeatedly scan historical availability, even when returning a small match or one endpoint. Reuse summaries per snapshot, product, measure and cumulative start year where those inputs affect coverage. Preserve missing-month and late-start rules. The local education and Batumi discovery probes each took about 44 ms. Extend existing caches; the arithmetic is already efficient.
4. **Measure limiter phases before redesigning them.** One atomic operation could replace the three sequential network calls while preserving ordered charging. However, ordinary service-side requests in this sample already took roughly 14 ms, so the available gain must be measured. Do not weaken global limits to gain a few milliseconds.
5. **Set coarse performance and response-size regression budgets.** Track a one-cell query, a product search, a large ranking and a near-limit response. Avoid fragile tests that depend on exact machine timings.

The service already caches its parsed snapshot, generated tool descriptions and JSON Schemas. Recommending those same changes again would add no value. The 113,676-byte modern tool inventory includes repeated output schemas; this is client-discovery overhead, not proof that every client places all those bytes in model context.

Much of the response size is useful explanation and evidence. A representative one-value national tool result is 8,860 bytes; a five-entry ranking is 103,004 bytes, including 53,005 bytes of structured metadata, predominantly sources. Full product discovery carries approximately 225 KB each of structured data and text. Favor targeted discovery and existing deduplication over removing citations or caveats. These are byte measurements, not token estimates. Fitting the server's allowance does not guarantee that every assistant client retains the entire result.

**Further usability and protocol improvements**

- **Make city discovery match the city query's capabilities.** On production, `describe_coverage` with `datasetId: "inflation"`, `entityType: "city"`, and `level: "subgroup"` returns six cities and 43 national-only subgroups. Querying Batumi with the returned `cpi.cat.01_1` fails. The refusal correctly explains the restriction and lists valid choices, so this is minor recovery friction. Filter or clearly identify national-only series when city scope is requested. Evidence: `apps/web/lib/factQuery/describeCoverage.ts:914`, `apps/web/lib/factQuery/queryInflation.ts:139`.
- **Make oversized-response advice specific to the tool.** The source-batch measurements correctly refuse 45-source and 100-source results of 568,691 and 653,312 bytes. Their error says “0 cells” and recommends fewer years, entities and series instead of fewer source IDs. Say which part of this request to reduce and retain the bulk-file link. Evidence: `apps/web/lib/mcp/result.ts:319` and `data/localization/en/service-messages.json:144`.
- **Finish Claude setup with enabling the connector in the conversation and a test question.** The existing page stops after adding the connector. [Claude's official guide includes the conversation activation step](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). Current Codex menu guidance matched the official documentation reviewed for this audit. Evidence: `apps/web/lib/i18n/messages/en/connect.json:19` and its Georgian counterpart.
- **Apply origin validation consistently to unsupported HTTP methods.** An invalid-origin GET or DELETE returns 405; the [Streamable HTTP specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) requires 403 for an invalid present Origin. This is a minor consistency defect: those methods return no data, create no sessions and open no streams. Evidence: `apps/web/app/mcp/route.ts:382` and live boundary tests.
- **Add real assistant acceptance checks.** The 48 reference intents test prewritten tool arguments and expected results. They do not test a person's Georgian or English question passing through Claude or Codex, tool choice, interpretation and final citations. Use a small representative bilingual set, including missing periods, percentage points, Khulo's boundary, city sources and combined municipal totals. Account-specific setup and final model-answer behavior remain separate from SDK compatibility.
- **Test short-keyword search recovery.** Discovery uses literal matching: local searches for `annual inflation` and `food inflation` return no matches while `inflation` and `food` find valid choices. Explain short-keyword retries in guidance and test whether actual assistants recover before adding search functionality.
- **Improve source-filter outcome metadata.** A filtered derived-source request can report `narrowingOutcome: "not_requested"` even when a year was supplied. Retaining all upstream evidence is deliberate; the reported reason should describe that exemption accurately. Separately, the 2014 ministry original is correctly the 2015 workbook's reviewed `col_4`, but its document metadata lists only 2015, causing a fallback on a 2014 filter. Follow the reviewed column mapping when recording covered years. Neither case proves an incorrect figure or a wrong original. Evidence: `apps/web/lib/factQuery/getSources.ts`, `data/sources/source-documents.csv:81`, `docs/data-methodology/2005-2014-ministries-expenditure-methodology.md:31`.
- **Keep maintenance focused on shared registries.** The missing city validator is an example of independently maintained entity lists drifting apart. Extend the existing registries where appropriate; a parallel query architecture is unnecessary.

**Security and dependencies**

The architecture limits the consequences of misuse: tool calls cannot write data, execute commands, query a live database or fetch caller-chosen URLs. Data comes from the packaged snapshot. Only the fixed rate-limit operations use a runtime network service. Original sources and methodology remain available as static fallbacks.

| Safeguard | Current behavior |
| --- | --- |
| Request body | 32 KiB, with an incremental check as bytes arrive |
| Requested output | 500 query cells or 250 comparison pairs |
| Input lists | At most 100 entities, 200 series, 100 years or 100 source IDs |
| Complete response | 512 KiB, including text, structured output and final protocol metadata |
| Request duration | 10-second function ceiling; 1.5-second timeout for each limiter request |
| Browser access | Approved origins only for POST/preflight; production host validation |
| Failure of shared limiter | Stops serving with a retry response, preserving static fallback access |
| Data consistency | Optional expected data version refuses calls spanning different snapshots |
| Privacy | Allowlisted operational fields; no raw request bodies, prompts, credentials or client addresses in application logs |

Oversized results are refused in full rather than silently losing sources or caveats. A cell-count allowance is not a promise that every request of that size fits the byte allowance. Actual-over-planned selection, missing-not-zero behavior, non-comparable periods, forecast labels and budget-accounting boundaries are retained in the shared query core.

The production-dependency audit reported **zero high or critical entries and three moderate entries**: `fast-uri`, `uuid`, and `exceljs` through `uuid`. The full installation reported five high entries in the existing development-only lint chain and four moderate entries. The five high entries represent the accepted `braces` advisory propagating through its dependants, not five separately demonstrated attacks on MCP.

The repository's audit policy accepted exactly the existing lint-chain exception and blocked no additional high/critical entry. That exception expires **2 November 2026 at 00:00 UTC**. This is accepted risk, not a fixed dependency.

The override pins `fast-uri` to 3.1.7 while the [current advisory lists 3.1.8 as patched](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj). Review that small update and the other moderate findings. Do not blindly accept npm's suggested major downgrades of Next ESLint or ExcelJS. Installed-package audit output alone does not prove exploitability in the deployed MCP route.

The second review identified a dependency-maintenance complication: SDK 2.2.0 embeds its own `fast-uri` 3.1.0 in `node_modules/@modelcontextprotocol/server/dist/ajvProvider-CEoC__sr.mjs`, and that code appears in the built MCP chunk. Updating the top-level override alone will not update the SDK's embedded copy. Review the SDK's bundled dependency as part of remediation. The advisory concerns host comparisons using that parser; this service's host and Origin checks use native URL parsing and exact comparisons, and callers cannot trigger arbitrary URL fetches. No exploit path was demonstrated. Absence of a separately traced package file does not establish absence of bundled code. The project's function-size check reports the MCP function at **54.7 MB**, below its **200 MB** budget.

The current deployment relies on Vercel's trusted address headers. A self-hosted deployment would need a separate trusted-proxy policy: the current helper also accepts Vercel-named headers outside Vercel. This is a portability caveat, not a demonstrated bypass on the current platform. Evidence: `apps/web/lib/mcp/security.ts:114` and [Vercel's request-header documentation](https://vercel.com/docs/headers/request-headers).

**Coverage and deliberate exclusions**

| Tools | Current purpose | Live representative call |
| --- | --- | --- |
| `describe_coverage` | Find datasets, entities, series and available periods | Passed |
| `query_national` | State expenditure or consolidated receipts | Passed |
| `query_ministries` | Administrative categories and major programmes | Passed |
| `query_municipal` | Municipal budgets and reviewed aggregates | Passed; source-completeness finding above |
| `query_debt` | Government debt, service and interest rates | Passed |
| `query_deficit` | Reviewed general-government balance | Passed |
| `query_gdp` | Six annual GDP series | Passed; definition wording finding above |
| `query_economic_sectors` | National sector values, shares and growth | Passed |
| `query_regional_economies` | Published regional GDP and activities | Passed |
| `query_inflation` | National and city inflation | Passed; September freshness gap |
| `query_inflation_products` | Current-roster annual and cumulative product changes | Passed |
| `compare` | Supported endpoint comparisons with comparability rules | Passed |
| `rank` | Supported ranking universes and exclusions | Passed; unit finding above |
| `get_sources` | Original documents and source filtering | Passed; city-filter defect above |

Trade, unemployment, demography, wages, newer living-standards series, external flows, energy and food, money and banks, Business, Health, Housing and Crime are available on the website but deliberately excluded from MCP in their approved scopes. Their absence is not a regression in the approved service. A meaningful coverage score would require an agreed target and evidence about the questions users want answered.

Choose subsequent coverage according to actual question demand. Extending the existing snapshot, catalogue, query and publication pipeline is preferable to a second data service. Authentication, write tools, subscriptions and model calls are not required for the present public read-only use case. MCP resources and prompts are optional capabilities, not missing mandatory features.

**Recommended sequence**

| Order | Work | Completion evidence |
| --- | --- | --- |
| 1 | Correct units and growth definitions; repair city source lookup; sanitize unexpected tool failures | All seven share-change combinations use percentage points, all six cities resolve their workbook, and injected faults return safe errors in both protocol eras |
| 2 | Complete municipal source chains and review September inflation | National evidence includes all 69 inputs; Adjara transfers have relevant-year originals; reviewed monthly coverage advances through the normal release pipeline |
| 3 | Improve instruction order, targeted discovery, coverage caching and oversized-result guidance | City discovery gives usable choices; small bilingual assistant acceptance set passes; measured latency/size improves with identical values, sources and missingness |
| 4 | Verify retention and alerts; measure quota usage; set coarse latency and size budgets | Retained operational evidence and a tested alert path, with documented limits and owners |
| 5 | Consider more datasets or capacity | A bounded approved scope based on demand and measured usage |

These changes reuse the current core, schemas, registries, archive resolver, error format and deployment pipeline. A rewrite is not justified by the findings.

Alongside the first two stages, review the moderate dependencies and the existing development-only lint-chain exception before its **2 November 2026** expiry. Check embedded SDK copies as well as the lockfile. Neither a paid plan nor an exception renewal follows automatically from this audit.

**Evidence and limits**

The following completion gates passed during the first audit on the same application commit and snapshot. They were not repeated during the second review because no application or data inputs changed.

| Final check | Result |
| --- | --- |
| `npm run check` | Passed: lint, types, 4,978 tests, 36 data checks and language validation |
| Test inventory | 523 files passed; one file and 13 tests skipped |
| `npm run build` and its function-size check | Passed; `/mcp` is the only dynamic application route |
| Existing connection-page browser suite against production | 7 passed |
| Live representative tool calls | 14 of 14 passed |
| Protocol clients | Legacy SDK, pinned modern and automatic modern passed |
| Central publication integrity | 22 of 22 hashes and sizes matched |
| Source samples | 9 archive links resolved; one downloaded original matched its declared checksum |
| Final recent runtime-error window | No runtime error clusters returned for `/mcp`; expected audit refusals remain distinct |
| Repository state | Only this audit report and its compact evidence file were added; no implementation edits |

The second review added the following checks:

| Additional check | Coverage and outcome |
| --- | --- |
| Observation consistency | 89,119 observations checked for availability, finite values and metadata references; another 3,168 programme observations checked for availability and provenance presence; no additional structural defect |
| Raw inflation to query agreement | 50,198 national, category and city cells agreed exactly |
| Annual budget reconciliation | 1,379 national/ministry facts and 5,105 annual totals/derived cells agreed |
| Product annual calculation | 42,028 index-to-percent cells agreed, including missing values |
| Product cumulative calculation | 270,840 independently compounded endpoints across start years 2015–2026 agreed, including gaps and late starts |
| National comparisons and rankings | 16,632 comparison pairs and 15,710 ranking entries agreed numerically; the ranking-unit defect remains |
| Municipal national aggregates | All 11 combined totals reconciled to 69 prepared budgets plus the net adjustment; 110 functional totals reconciled exactly |
| Local HTTP boundaries | 41 POST cases plus GET/DELETE/OPTIONS checks; no naturally triggered internal exception or bypass demonstrated |
| Response parity | 10 handler calls across modern and legacy modes preserved equivalent errors and bilingual missing-value explanations |
| Fresh production reproductions | 12 paced MCP requests reproduced the cited behavior and the city discovery mismatch; data version and release matched the first audit |
| Provider verification | Production deployment still READY on the audited commit; all 12 new probe events visible in safe application logs; 24-hour logs again rejected by Hobby retention; final 50-minute error query returned no runtime clusters |

The numerical checks use the released snapshot and prepared reviewed CSVs. They do not independently re-extract every original. Calculated floating-point values were compared with a relative tolerance of 1e-10; national municipal totals used exact decimal reconciliation. Sixteen apparent GDP denominator differences were checked against the documented 0.1 million GEL precision and all matched that rounding; they are not unresolved discrepancies. The scenario counts overlap and should not be added into a count of unique records. Structural reference checks establish that cited IDs resolve, not that every citation supplies every calculation input; the municipal finding demonstrates that distinction.

Compact retained evidence: `docs/superpowers/reviews/2026-10-17-mcp-audit-evidence.json`, including `secondReview`, reproduction arguments, dispositions and hashes of the diagnostic files. The first-pass live scripts made 67 paced MCP HTTP requests and the second pass added 12, for 79 total. One second-pass GDP probe initially used an invalid prefixed series ID; the ordinary validation error was recorded and the corrected request confirmed the definition issue. A local programme scan similarly corrected 66 invalid diagnostic requests and then verified all 3,168 programme observations. These harness mistakes are not service defects.

The audit used current source inspection, independent reviews of security/data/usability, fault injection, local scenario measurements, real SDK clients, direct HTTP requests, checksum verification, browser tests, provider reads and current official documentation. It did not perform an adversarial load test, exhaust production quotas, modify production configuration or datasets, or connect a person's authenticated Claude/ChatGPT/Codex account. No service changes were made.

The Vercel firewall configuration read returned 404. This cannot establish whether platform protection is absent. Current Upstash account usage and any external monitoring system were not independently verified. Numerical probes and reference cases are not a re-extraction and re-audit of every original source document.

First-pass diagnostics are in `apps/web/.tmp/mcp-audit/`, `.tmp/mcp-audit-data/`, `.tmp/mcp-audit-security/` and `.tmp/mcp-audit-experience/`. Second-pass diagnostics are in `apps/web/.tmp/mcp-second-review/`, `.tmp/mcp-second-data/`, `.tmp/mcp-second-security/` and `.tmp/mcp-second-experience/`. These ignored directories retain requests, responses, calculation probes, timings, dependency reports, provider evidence and verification logs. The earlier all-tools harness also corrected a missing ministries fixture before completing all 14 tools.
