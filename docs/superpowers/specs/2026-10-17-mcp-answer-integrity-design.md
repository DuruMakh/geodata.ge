# MCP answer integrity and source evidence

**Date:** 17 October 2026. **Status:** Proposed design for review; implementation has not started.

**Purpose:** Make the existing answers accurately labelled and independently checkable. A correct number with the wrong unit or incomplete originals is not a complete answer.

**Basis:** [Reviewed MCP audit](../reviews/2026-10-17-mcp-full-audit.md), important findings 1–3 and the related source-filter refinements. The audit found no numerical discrepancy in the affected totals. This specification repairs evidence and descriptions, preserving the reviewed calculations.

**Companion documents:** [runtime reliability](2026-10-17-mcp-runtime-reliability-design.md), [discovery and performance](2026-10-17-mcp-discovery-performance-design.md), [freshness and operations](2026-10-17-mcp-freshness-operations-design.md), and the [implementation plan](../plans/2026-10-17-mcp-audit-remediation-implementation.md).

## 1. Scope and user-visible result

1. A ranking of changes in shares says **percentage points**. Relative changes say **percent**. An annual GDP growth rate is described as a percentage.
2. Georgia's combined municipal figures cite the relevant originals for all 69 constituent budgets. Municipal and regional figures continue to exclude the five budgets that cannot be attributed to those territories.
3. Adjara's combined figures cite the relevant year's Treasury transfer evidence as well as municipal and republican expenditure evidence.
4. A city returned by inflation discovery or a query is accepted by `get_sources`, and the shared workbook supporting that city remains available.
5. Source filtering explains when it deliberately preserves the complete inputs of a derived calculation. A ministry observation for 2014 can identify the reviewed 2014 column in its 2015 workbook.

No new datasets, calculations, tools, database tables, runtime fetching or public endpoints are introduced. Do not alter numerical reference expectations to accommodate an implementation mistake.

## 2. Existing owners and reuse

| Treatment | Existing owner and responsibility |
| --- | --- |
| Reuse unchanged | Reviewed municipal preparation and aggregation, actual/planned selection, Decimal arithmetic, source-archive hashes/URLs, caveat registry, source translations, `buildResponseMeta`, publication builders and complete-response limits. |
| Small addition | `apps/web/lib/factQuery/rank.ts` selects the unit from the ranking metric; `gdpSeries.ts` and `apps/web/lib/mcp/instructions.ts` correct English growth wording. |
| Small addition | `sources.ts` resolves an existing logical source's archived documents for the Adjara-derived chain; `observations.ts` applies both entity and year constraints; `queryMunicipal.ts` uses the full country scope. |
| Small addition | `getSources.ts` recognises inflation cities and their registered shared sources; `apps/web/lib/mcp/outputSchema.ts` and `result.ts` expose the precise narrowing outcome. |
| Metadata correction | `data/sources/source-documents.csv`; the existing 2015 workbook row in `data/methodology/source-archives/expenditure.csv`. |
| Canonical documentation | `docs/data-methodology/municipal-functional-annual-2015-2025.md`, `ai-grounding-and-caveats.md`, `public-methodology-and-source-archives.md`. Update only statements changed by this repair. |
| Genuinely new | No production module or source inventory. Extend existing tests. The coordinated public contract adds two enum values described below. |

## 3. Shared public contract: schema 1.6.0

All four specifications target one coordinated data-schema release, **1.6.0**, from the audited 1.5.0 baseline. This version describes Fiscal.ge's data envelopes; it does not change either supported MCP transport version.

- Add `preserved_derived` to `get_sources`' existing `narrowingOutcome` vocabulary.
- Add `internal_error` to the existing error-code schema, as specified by runtime reliability.
- Retain all previous values, request fields, stable IDs, bilingual fields, 14 tools, 11 dataset families and shared URLs.
- Set `SCHEMA_VERSION` in `apps/web/lib/factQuery/types.ts`; regenerate snapshots and publications through the normal builders. Update current contract documentation, instructions, connection translations and version assertions together. Leave historical specifications and audit evidence unchanged.
- Strict clients that cache the old output enum or require schema 1.5.0 must refresh discovery/update their validation. Do not describe new enum values as compatible with every strict old validator. Existing request shapes and the real supported clients must still pass their compatibility tests.
- Source metadata and wording corrections change `dataVersion`. A caller's old `expectedDataVersion` must continue to produce `data_version_changed`, never an answer silently assembled across releases.

This small explicit version update is preferable to disguising an internal fault as an outage or claiming that no narrowing was requested when filters were supplied.

## 4. Correct units without changing arithmetic

For ordinary change rankings, select the unit by `metric`:

| Ranking metric | Returned unit |
| --- | --- |
| `percentage_point_change` | `percentage_points` |
| `percentage_change` | `percent` |
| `absolute_change` | The existing comparison endpoint unit |
| `value` | The existing observation unit |

The `Unit` vocabulary already contains `percentage_points`; reuse it. Preserve supported inflation comparison rules, which already return percentage-point changes correctly. Remove the obsolete comment claiming that the vocabulary lacks that unit.

Test the seven demonstrated combinations: national revenue, national expenditure and ministries, each with share of total and share of GDP; municipal expenditure with share of total. Include a ministry-program case and regional municipal case to cover the shared paths. Ranking values, ordering, exclusions, basis, source evidence and tie behavior must remain equal to the corresponding comparison results.

Change the English GDP growth definition and instructions from percentage points to percent. Georgian wording already says percent and needs no substantive correction. No growth value or calculation changes.

## 5. Complete municipal source chains

### 5.1 Resolve existing Treasury originals

The Treasury registry row currently names the 2015 PDF and prose referring to later annual files. Replace that prose with eleven explicit existing paths, using the supported ` + ` separator:

`docs/Raw Data/Revenue/<year>-jan-dec-consolidated-revenue.pdf`, for 2015–2025.

These originals and their reviewed entries already exist in `data/methodology/source-archives/revenue.csv`, under `source.mof.revenue.<year>.form_1`. Reuse their public paths, checksums and metadata. No new download or duplicate manifest is needed.

### 5.2 Expand the derived chain through logical sources

`sources.ts` currently maps the derived Adjara consolidation source to two republican-payment documents. It must also include the original municipal and transfer inputs. Resolve the following existing logical sources through the current ordinary-source path/alias resolver:

- `source.municipal_portal_archive`
- `source.municipal_mof_annual_and_history_workbooks`
- `source.adjara_republic_budget_actual`
- `source.treasury_consolidated_revenue_actual`

Use a small two-pass extension: resolve ordinary source document sets, then compose the required derived set. Retain the existing document-ID mapping for other derivations. Deduplicate by document ID, preserve deterministic order and mark the inputs `derivation_upstream` using the existing role. Missing configured upstreams fail preparation with an actionable error.

Do not hardcode a second list of 69 files, introduce a general recursive dependency graph, or parse the human derivation sentence to determine inputs. Source IDs and document IDs remain distinct concepts.

### 5.3 Scope each observation correctly

For a Georgia municipal observation, `queryMunicipal.ts` supplies all 69 constituent codes to `resolveDocumentIds`. This applies to country totals, functional totals and their shares. For a municipality, supply its one eligible code; for a region, retain its eligible member codes. Codes `05`, `42`, `43`, `46`, `64` remain excluded from territorial queries and charts.

For each named municipal document, require both the appropriate entity and the observation year. Currently the entity match returns before the year check; that would attach later history books to a 2015 observation after upstream expansion. Preserve the existing rule that an unspecified document year is not guessed. Cross-municipality documents retain the reviewed year rule.

Keep the existing inspectable fallback for genuinely incomplete metadata, but the repaired, known 2015–2025 cases must not use it. Each calculation term must have a relevant original. Do not apply the Adjara adjustment again or change any prepared number.

The resulting metadata may be larger. Deduplicate existing repeated documents, but never trim supporting originals, caveats or calculation terms to fit a response. If a request exceeds the complete 512 KiB wire allowance, refuse it with the improved guidance in the discovery specification. A single representative country-year answer and a lookup of the single expanded derived source must remain usable; measure both complete wire responses after the repair. Requesting fewer source IDs cannot recover an oversized lookup already containing only one source.

## 6. Source-filter behavior

### 6.1 City lookup

Build the valid entity set from the existing municipal/country registries **and** `snapshot.inflation.cityEntities`. Do not accept arbitrary `city.*` strings.

For city filters, use the actual registered source IDs on city facts to recognise the shared city workbook. Its document ID need not contain a city name. Apply the existing dataset and year rules as well. This is not a blanket exemption for every inflation source or every city-like string. A city filter paired with an unrelated source must retain the existing explicit no-match fallback rather than falsely report a successful match.

Verify all six cities, annual/monthly/headline-average sources where supported, and both with and without `datasetId: "inflation"`. The resulting original URL, hash and byte size remain those in the manifest.

### 6.2 Honest outcomes for derived sources

| Situation | `narrowingOutcome` | Document behavior |
| --- | --- | --- |
| No dataset/year/entity filters supplied | `not_requested` | Existing complete list |
| Ordinary source with matching filters | `applied` | Matching list; may equal complete list |
| Ordinary source with no matching document | `dropped_no_match` | Preserve complete list and explain the fallback |
| Derived source with filters supplied | `preserved_derived` | Preserve complete inputs and explain why |

Retain `narrowedBy` as the filters actually requested, `documentCount` as the original count, and `narrowed` as whether the list became smaller. Thus `preserved_derived` has `narrowed: false` without pretending that no filters were requested. Add the same explanation to bilingual readable output. Do not opportunistically filter a derived chain into incomplete evidence.

### 6.3 2014 ministry coverage

The reviewed 2014 figures legitimately come from column 4 of a 2015 expenditure workbook. Set that existing manifest row's year coverage to `2014-2015`; `sourceManifest.ts` already parses ranges. Preserve the actual publication title/year and cell mapping. A 2014 lookup should then match the original rather than fall back. Do not rename the source as a 2014 publication or invent a new metadata field.

## 7. Acceptance evidence

| Requirement | Required proof |
| --- | --- |
| Units | Seven affected combinations and shared program/region paths agree numerically with `compare`; only the correct unit/wording changes. Inflation tests remain green. |
| Country evidence | For every 2015–2025 country total and functional total, the relevant source set covers all 69 inputs; representative shares retain denominator evidence. Compare exact IDs/roles/years, not only a minimum document count. |
| Territorial evidence | Existing single-municipality and region tests still exclude unrelated and aggregate-only municipal originals. Entity-and-year filtering rejects wrong-period books. |
| Adjara evidence | All eleven annual totals identify municipal inputs, republican payments and the same year's transfer original; 2016–2025 no longer falls back to the 2015 Treasury PDF. |
| City workflow | Discover/query → returned source ID → `get_sources` succeeds for every city and supported source, preserving checked archive metadata. |
| Source outcomes | All four outcomes validate against the public schema and are explained consistently in both languages; 2014 ministry filtering is `applied`. |
| Limits and compatibility | Small complete-evidence responses fit; large requests return a complete safe refusal. Modern pinned/automatic and legacy clients pass with schema 1.6.0. |
| Numerical integrity | Code-only repairs pass the unchanged independent reference fixture. A later source refresh follows the documented coverage-metadata review checkpoint; historical numeric expectations are never changed merely to fit the implementation. |

Update stale tests that currently demand only two derived originals or prohibit aggregate-only originals on the country row. These assumptions contradict the documented calculation scope. Preserve their numerical expectations and the correct territorial exclusions.

## 8. Completion boundary

This design is implemented only when the focused tests, regenerated-source checks and integrated completion gate pass. Production completion additionally requires the deployed commit, schema/data identities and relevant live source links to be verified. The October audit remains baseline evidence, not proof of a future fix.
