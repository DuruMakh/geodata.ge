# Task 7: exposed product query and verified response contracts

Implemented on `1d521243321afbc41b173e195bfceee47d89281b` in `C:/Users/Mylaptop/.codex/worktrees/e3aa/Geodata.ge`, branch `codex/mcp-upgrade-specs`. Local commit is recorded in the Git history with subject `feat(mcp): expose product tools with verified response contracts` (this report ships in that commit).

No push, PR, merge, deployment, database operation, full check, build or subagent was used. Integration gates remain owned by the parent task. Snapshot/publication regeneration was unnecessary: no serialized snapshot inputs, source data, registered service messages, definitions or caveats changed. The audited packaged snapshot remains schema `1.5.0`, dataVersion `2776fc1896f85c77d7b951aa4f13e5d94fdef8135acf92f076df35a6bbec8aa7`.

## Result and boundaries

- Exactly one tool added: `query_inflation_products`, the 14th tool. It uses the existing Task 4 input schema and pure query function, returns observations, inherits read-only annotations, and uses the existing snapshot-backed server.
- The handler uses `productQueryCellCount` before calling the calculation. A realistic request for 167 current products over three reviewed months requests 501 cells, returns the bilingual `result_too_large` refusal and never calls `run`. Five complete-history products compounded from January 2015 to August 2026 require 700 input months but only five output cells; the transported query succeeds with the shared `2014-12` base. The input span is never charged as output.
- Declared catalogue series fields now include `coicopCode`, `firstPeriod`, legal product `measures` and bilingual `historyNotes` with integer `boundaryYear`. Existing `yearsByMeasure`, `periodsByMeasure` and all three dataset measure-note maps remain declared. Parsing the full real product catalogue equals the original response, demonstrating no new field is stripped; wrong classification type, invalid first month, unsupported measure and invalid history-note year are rejected.
- Observation `calculationBasePeriod` was already declared by Task 4; added its public meaning to the declaration. Ranking output now declares the same optional YYYY-MM field. Full cumulative ranking parse equals the original response and a numeric base is rejected. Existing period/year ranges keep homogeneous arrays with `.length(2)`; no tuple JSON Schema was introduced.
- Cumulative text observations append the explicit base column only when present. Monthly ranking text appends period, and cumulative ranking appends the base. Existing definition legend and source/caveat rendering remain intact; source IDs, document IDs, missing reasons, derivation and severe caveat evidence are retained. Annual budget text columns remain unchanged.
- Server instructions and tool descriptions state annual versus derived cumulative meaning, previous-December base, complete-input and late-start rules, conservative history limits, unsupported products/prices/weights/contributions/cities, annual-only compare and value-only rank, and narrowing/bulk guidance. The removed exclusion claim that product indices were wholly unserved is replaced with the actual bounded exclusions. Instructions now require additive schema 1.5.0 acceptance.
- The v2/legacy route composition, SDK handler, modern strict JSON metadata validation, `maxSubscriptions: 0`, `listChanged: false`, final post-SDK wire-size guard, body limit, cell/pair limits, rate limiting and request ceiling are untouched. No limits were raised and no evidence was trimmed.

## Test-first and verification evidence

Commands ran from `apps/web` except the independent CSV audit and Git commands.

1. Before production edits, `npx vitest run --configLoader native tests/mcp/tools.test.ts tests/mcp/outputSchema.test.ts tests/mcp/result.test.ts tests/mcp/protocolCompatibility.test.ts` failed as intended: **10 failed / 80 passed across four files**, duration 6.66 s. Failures: tool preflight missing registration; advertised read-only inventory; instructions inventory count; final inventory set; real city-client inventory; real product-client missing registration; catalogue product fields stripped; ranking base stripped; CALLS inventory missing the product tool; text missing the base column. These were missing contract behaviors, not arithmetic mismatches.
2. After minimal adapter changes, the same four-file feedback run had **1 failed / 90 passed**. The only failure was the old instruction assertion requiring lowercase `schema 1.4.0`; updated that advertised-current-version assertion to `schema 1.5.0`. No numeric expectation changed.
3. Added the eight source-grounded product intents before dispatcher support. `npx vitest run --configLoader native tests/factQuery/reference.test.ts` failed as intended: **6 failed / 53 passed**, duration 6.19 s. Failures were the old 40-intent inventory and missing dispatcher for intents 41–44 and 48. Rank and refused-compare references already matched the independently chosen values. Added only the product dispatcher, controlled synthetic input override, new metadata assertions and 48-intent inventory.
4. The prescribed five-file suite then passed: **5 files / 150 tests**, duration 7.18 s. All 40 prior numeric reference cases were preserved.
5. Affected transport inventory and unchanged final wire-size enforcement were checked with `tests/mcp/route.test.ts tests/mcp/bilingualTransport.test.ts tests/mcp/resultWireLimit.test.ts`: **2 failed / 37 passed**. Both failures were exactly the old 13-tool inventory assertions; changed them to 14. The wire-limit tests passed unchanged.
6. First `npm run typecheck` found six new test-only accesses to the error-or-success union without kind guards. Added explicit guards in the two test files. Final `npm run typecheck` exited 0. No production type error occurred.
7. Final focused integration command:

   `npx vitest run --configLoader native tests/mcp/tools.test.ts tests/mcp/outputSchema.test.ts tests/mcp/result.test.ts tests/mcp/protocolCompatibility.test.ts tests/factQuery/reference.test.ts tests/mcp/route.test.ts tests/mcp/bilingualTransport.test.ts tests/mcp/resultWireLimit.test.ts`

   exited 0: **8 files / 189 tests passed**, duration **8.05 s**. This includes the prescribed suite plus only three affected MCP files. The known Node `MODULE_TYPELESS_PACKAGE_JSON` warning appeared; unrelated package configuration was not changed.
8. Scoped ESLint exited 0 with `--max-warnings 0` on all 13 changed application/test files. `git diff --check` passed. No service-message keys/parameters were added, so a new i18n generation/check was not required for this task.
9. `node docs/superpowers/reviews/2026-10-01-mcp-independent-reference.cjs` from the repository root exited 0, independently recalculating the references and checking archived-original bytes/hashes. Its first invocation failed to resolve an absolute package subpath; corrected the audit-only loader to `createRequire(apps/web/package.json)` and reran successfully.
10. `npx tsx ../../docs/superpowers/reviews/2026-10-01-mcp-wire-evidence.ts` exited 0, writing exact bounded-result and final HTTP wire measurements. The SDK emitted its documented JSON-response notification warning; stateless request/response behavior and subscription refusal remain intentionally unchanged.

## Independent reference provenance

Tracked audit script `2026-10-01-mcp-independent-reference.cjs` reads only `data/imports/cpi-products-monthly.csv`, `data/imports/cpi-products.csv` and the source manifest, using `csv-parse` and an isolated Decimal class at precision 100. It does not import fact-query/explorer arithmetic, run a query or copy any actual response to an expectation. Its output is `2026-10-01-mcp-independent-reference.json`.

The original evidence brief and inventory were used to choose cases, then recalculated from scratch:

- 84,056 canonical facts; 305 current roster products; 305 published annual candidates at 2026-08; **zero missing monthly inputs**. Therefore intent 48 is explicitly synthetic: replace only p0001 `mom_index_100` 2025-02 in a test-local snapshot with null. The real published factor is 98.6808 (`2025!E4`). This does not claim a Geostat monthly source gap.
- Intent 41: p0001 annual index 101.8973 (`source.geostat_product_yoy`, `2026!K4`) minus 100 is exactly **+1.8973%**.
- Intent 42: all twelve p0001 2025 monthly factors at `2025!D4` through `2025!O4`: `99.5466,98.6808,101.9158,101.1221,93.6445,100.6254,97.8588,92.9414,102.2059,99.5407,98.5394,99.1086`. Direct Decimal multiplication of each index / 100, minus one, times 100 produces **−13.792789168144399776337488134436533856143340529895131881553604732111872%**. Fixture is −13.7927891681444 with an explicit 1e-10 tolerance for prefix division/JS finite precision, far tighter than source precision. Base is `2024-12`; original annual index is not used for this expectation.
- Intent 43: p0051 Plum begins at reviewed `2017-01`. The prior product at the same sheet position is a different fruit; no bridge or partial compounded value is accepted for startYear 2015. The missing explanation must name `2017-01`.
- Intent 44: p0089 annual row 2019-01 is blank and `not_published`, `source.geostat_product_yoy`, `2019!D92`. Its monthly input is available; only annual comparison is missing. Expect null with the month and history qualification.
- Intents 45/46: independently sorted all 305 current annual rows with Decimal after subtracting 100. Highest five: p0058 57.5291; p0264 45.4489; p0063 42.6783; p0220 39.5780; p0299 36.5071. Lowest five: p0043 −29.9494; p0064 −29.0482; p0238 −25.4733; p0044 −22.7648; p0051 −20.2006. Audit output records every raw index and source locator.
- Intent 47: cumulative compare is explicitly `unsupported_comparison`; approved contract requires startYear query for accumulated price change.
- Existing city intent 38 retains value 7.0857 and now requires `availablePeriods=[2016-01,2026-08]`. Intent 40 retains its null annual value and now requires `[2016-12,2026-08]`. Existing transported Zugdidi avg12 case independently retains null and `[2017-12,2026-08]`. No prior number was changed.

Audit verifies English upstream workbook bytes and SHA-256 against `docs/Raw Data/Inflation/geostat-products/2026-08/source-manifest.csv`:

- Monthly original `en/products-mom.xlsx`, 583,143 bytes, SHA-256 `26d9b429229cbad2ad6ee2bbefd5e86f52d4482d49abdcc14e270d4a956dcf20`, official direct URL `https://geostat.ge/media/82470/Consumer-Price-Detail-Indices-%28Previous-month%3D100%29.xlsx`.
- Annual original `en/products-yoy.xlsx`, 599,891 bytes, SHA-256 `ec9cd520693db0479f7fd576f0d2f4cfa65c9c9ba607c46ec7679e13b900faf9`, official direct URL `https://geostat.ge/media/82472/Consumer-Price-Detail-Indices-%28The-same-month-of-the-previous-year%3D100%29.xlsx`.

Locators and identity-decision details occur only in reference-authoring evidence, never in the public adapter output.

## Complete-output and final wire budget

Tracked `2026-10-01-mcp-wire-evidence.ts` uses the production `POST` route behind the existing test HTTP bridge with real modern SDK 2.2.0 and legacy SDK 1.30.1 clients. Each client calls `listTools` first, installing cached declared output validators, then calls product annual/cumulative query, full catalogue, annual rank and cumulative rank. Applications return deeply equal full structured responses in both eras; Zod parse equals each original response rather than stripping fields. Protocol tests also compare the product input and output schemas exactly. Modern results include `resultType=complete` and SDK server metadata. No session or subscription is introduced.

All sizes below include UTF-8 bytes. Final wires include JSON-RPC framing and SDK fields. Limit is **524,288 bytes (512 KiB)**. Counts are 305 catalogue entries, 100 annual rank entries from 305 eligible candidates, and 100 cumulative rank entries from 287 eligible / 305 candidates with all 18 ineligible histories explicitly excluded.

| Call | boundedToolResult bytes | Legacy wire bytes / headroom | Modern wire bytes / headroom |
| --- | ---: | ---: | ---: |
| Complete 305-product catalogue | 469,421 | 469,455 / 54,833 | 469,565 / 54,723 |
| Annual ranking, limit 100 | 63,489 | 63,523 / 460,765 | 63,633 / 460,655 |
| Cumulative ranking, limit 100, startYear 2015 | 105,283 | 105,317 / 418,971 | 105,427 / 418,861 |
| Annual reference endpoint | 7,157 | 7,191 / 517,097 | 7,301 / 516,987 |
| Cumulative 2025 reference endpoint | 11,099 | 11,133 / 513,155 | 11,243 / 513,045 |

Both test and tracked audit require strictly positive headroom, successful untrimmed results and valid complete output; JSON evidence records actual counts, exclusions and modern metadata keys. Release/generated timestamps and commit-string length can shift byte totals slightly without affecting the cap; these are measurements of the audited snapshot, not newly imposed arbitrary limits.

## Self-review

Traced every production line to registration, field declaration, evidence-equivalent text or public instruction accuracy. No arithmetic helper, roster, source data, cache, snapshot source, transport, rate limiter, runtime route or database behavior was changed. Existing serving schema owns all new fields, and full parse equality plus malformed-field checks protect both declaration and validation. The final route wire guard is exercised by the unchanged `resultWireLimit.test.ts`; exceeding a budget remains a whole-response refusal with guidance.

The narrowed checks show no outstanding Task 7 contract or byte-budget defect. Full check/build, broader completion gates and production proof remain unperformed by design and must run once during parent integration. These results are local evidence, not a shipped/live claim.
