# MCP: accurate instructions and discoverable inflation examples

Date: 2026-10-01
Status: accepted for implementation planning by the user's 2026-10-01 request to write the unified implementation plan.
Baseline: fetched main `1c2a0acd07f0fa522bf4f6aab33924b319cc2112` and the live service audited on this date.

## 1. Outcome

A person can understand what Fiscal.ge's AI connection provides, connect a supported application using verified instructions, and ask useful inflation questions. Maintainers can rely on a deployment guide that describes the release's actual formats and limits.

The audit verified 13 tools, ten dataset families, schema 1.4.0 and 20 files listed in the manifest. The manifest itself is an additional file: 21 publication artifacts in total, comprising 16 JSON files including the manifest and five CSV files. The opening bilingual section of `docs/deployment.md` still says schema 1.3.0 and nineteen artifacts, and also instructs clients to accept version 1.1.0. These counts are observations, not permanent constants.

The connection pages already describe city access and link its bulk files, but their example-question list contains no national or city inflation example. Do not treat city access itself as missing.

## 2. Approach and scope

Correct the current canonical guide and extend the existing connection-page content/components. Reuse the warm editorial system, Lucide UI icons, translation catalogues, copy controls and responsive layout in `DESIGN.md` v4.1. No new setup wizard, live status badge, endpoint GET health check or visual redesign.

An alternative separate MCP documentation website would duplicate the current connection page and runbook. The existing pages are sufficient.

Work belongs in `docs/deployment.md`, `lib/pages/connect.tsx`, both scoped connection-message files, `lib/mcp/instructions.ts`, and affected discovery assets/tests. Amend `llms.txt` and build-generated catalogues only through their existing owners/generators. Never edit generated publications by hand.

## 3. Human connection pages

Preserve Georgian `/connect`, English `/en/connect`, the shared endpoint and downloads addresses. Present these in plain language:

- Reviewed data, public read-only access, free service and no Fiscal.ge sign-in requirement. An AI application's own account/plan requirements are a separate matter.
- Coverage and latest periods derived from the loaded snapshot. Do not hardcode the current month, product count or coverage end year.
- National/category inflation, the six price-collection cities and, after product access is implemented, the current-product dataset as distinct kinds of data.
- Unsupported questions receive a meaningful explanation; missing publication is not zero.
- Annual inflation, a monthly change and a 12-month average are different. Contributions are approximate Fiscal.ge calculations. Product cumulative changes are calculated by Fiscal.ge from published monthly indices.
- An outside assistant should cite the attached original sources and preserve the relevant limits.

Add reviewed bilingual examples without changing the layout:

1. What was Georgia's annual inflation in the latest published month?
2. Which of the six measured cities had the highest food inflation that month?
3. How did Batumi's annual inflation rate change between two published months?
4. After product access ships: which current products had the highest annual price increases in the latest month?
5. After product access ships: how much did a selected product's price change cumulatively across a stated calendar-year range?

For cumulative examples, explain the December-before-first-year baseline. Dynamic example text uses real available dates; any static illustrative dates are clearly examples and covered by regression checks. Keep existing budget/economy examples accessible; modest expansion must fit desktop and mobile reading widths.

Product examples and capability claims land with the product implementation, not in an earlier documentation-only release. New protocol claims land only with passed compatibility tests. The wording distinguishes verified support from generic remote-MCP capability.

## 4. Client instructions

Check official application documentation and, where available, the actual UI before altering menu paths. Existing menu paths are unverified in this audit; do not assume they are wrong or current.

For each named application, state any plan/account requirement actually verified, give the connection URL, and explain that Fiscal.ge requires no bearer token or extra credentials. Never suggest disabling application security. Prefer wording that survives minor menu renaming, with a last-verified date in maintainer documentation.

The compatibility spec owns the application test matrix. Do not add application names simply because an SDK test passes. Keep the existing generic note for other remote-MCP clients. ChatGPT's web-reading fallback remains described separately from a direct MCP connection; direct ChatGPT connector instructions are added only after verification.

## 5. Operational and machine-facing documentation

- Replace conflicting schema/count statements with one current contract, ideally pointing to the generated manifest/tool list for changing inventories. If a count is useful, distinguish manifest-listed files from the manifest itself and cover it with a focused check.
- Preserve the source/snapshot boundary, shared limiter, privacy rules, CORS, pause, request/result limits and Actions-owned release procedure.
- Explain transport version separately from data-schema version. The compatibility task introduces dual-protocol support; the product task introduces schema 1.5.0.
- Ensure server instructions, tool descriptions, connection text, capability catalogue and `llms.txt` agree about supported queries and exclusions.
- Update product methodology and `Project_Definition.md` only with the approved product implementation, referencing its spec. Preserve previous product-explorer exclusions as historical scope, with an explicit later amendment rather than rewriting the old approval.
- Release checks include city coverage dates, both protocol eras and product calls once implemented. Existing manual production-proof requirements remain; automated deployment polling is not part of this task.

## 6. Verification and completion

Check both translations for complete keys, correct meanings, matching capabilities and source links. Focused unit tests cover generated coverage/counts where they are stated and prevent product/new-protocol claims appearing before their implementations.

Browser checks cover the Georgian and English pages, both copy buttons, reachable examples/download links, keyboard access, mobile reading at 390px, no horizontal overflow and no console errors. Verify that the wording and supported client flow match the compatibility evidence.

Normal completion requires `npm run check`, `npm run build`, relevant reference tests when machine instructions change, and the browser gate because public page content changes. A future production release verifies both connection URLs and referenced downloads independently of local/CI success.

## 7. Related specifications

[City coverage](2026-10-01-mcp-city-coverage-design.md), [client compatibility](2026-10-01-mcp-client-compatibility-design.md), and [product access](2026-10-01-mcp-inflation-products-design.md).

The existing guide corrections can ship independently. Capability additions must be delivered with the behavior they describe. Review this document before implementation planning.
