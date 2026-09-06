# Fiscal.ge Bilingual AI Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Follow active-session delegation instructions before dispatching workers.

**Goal:** Return reviewed Georgian and English names, definitions, and evidence from all current tools and JSON publications while preserving their numerical contracts.

**Architecture:** Add a translation slice and bilingual source descriptions to the deterministic build-time snapshot. Queries resolve display text from that snapshot; stable IDs and numerical algorithms remain unchanged. Both structured and compact text outputs expose the same bilingual meaning, and the existing publication generator consumes those query responses.

**Tech Stack:** Existing TypeScript, Zod, MCP SDK 1.30.0, Vitest, Node crypto and filesystem in build scripts only.

**Spec:** [Approved design](../specs/2026-09-05-fiscal-bilingual-design.md). Read the [master plan](2026-09-05-fiscal-bilingual.md) and [foundation interfaces](2026-09-05-fiscal-bilingual-foundation.md). A1 depends on F3; A2 depends on A1. A3–A5 follow in order.

## Global Constraints

- Keep one endpoint, `/mcp`, and the same nine tool names and input contracts.
- Publish schema version `1.1.0` for the additive language contract.
- Preserve the current input limits, 500-cell limit, 250-comparison-pair limit, ranking limits, 512 KiB complete-result cap, duration cap, rate limiter, and pause behaviour.
- Both languages use the same reviewed facts, calculations, source documents, and editorial design.
- Do not translate IDs or hash keys.
- English text does not silently fall back to Georgian or a technical identifier.
- Source URLs, licence identity, archive bytes/hashes, observation IDs, comparability IDs, missingness, and numerical results retain their current meaning.
- Do not use an outside model, network translation, runtime repository file reads, or the data-serving database. The master plan's remaining constraints apply unchanged.

## Task A1: Pin reviewed service translations and evidence text into the snapshot

**Files:** Modify `apps/web/lib/factQuery/{types,buildSnapshot,sources}.ts` for the added snapshot content and the raw/enriched source boundary; preserve `canonical.ts` hashing semantics. Create `apps/web/lib/factQuery/localization.ts`, `data/localization/{ka,en}/service-messages.json`, `apps/web/tests/factQuery/localization.test.ts`, and `apps/web/scripts/measure-bilingual-mcp.ts`. Modify `apps/web/lib/i18n/validation.ts` and `apps/web/scripts/check-localization.ts`; extend `tests/factQuery/{buildSnapshot,canonical,sources}.test.ts` and existing purity tests. Evidence goes under `.tmp/bilingual/{baseline,final}/`.

**Interfaces:** Extend `FactQuerySnapshot` with required `localization: ServiceLocalization`. Export the following from `types.ts` and `localization.ts`:

```ts
export type ServiceLocalization = {
  labelsEn: Record<string, string>;
  programmeHistoryEn: Record<string, Record<string, string>>;
  messages: { ka: Record<string, string>; en: Record<string, string> };
};
export function serviceLabelEn(snapshot: FactQuerySnapshot, id: string): string;
export function serviceMessage(snapshot: FactQuerySnapshot, locale: 'ka' | 'en', key: string,
  values?: Readonly<Record<string, string | number>>): string;
export function historicalProgrammeLabelEn(snapshot: FactQuerySnapshot, seriesId: string, year: number): string;
```

`localization.ts` is pure and imports no UI dictionaries or build loaders. It receives all text through the snapshot. Source/document translations are stored on `snapshot.sources` once, not duplicated in `localization`. Every new snapshot field participates in existing canonical hashing. Keep `schemaVersion` at its current value while the branch is incomplete; A5 changes the advertised public version only when the full contract is in place.

- [x] Before changing snapshot contents, implement and run the measurement harness against the current snapshot. It imports `buildFactQuerySnapshot`, the nine current query functions, and `boundedToolResult`/`toolResult` from `lib/mcp/result.ts`. Save current structured bytes, text bytes, complete-result bytes, status, requested/returned counts, and response limits. Do not benchmark a raw JSON envelope as if it were the complete protocol result.

```ts
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const result = toolResult(response);
const bounded = boundedToolResult(snapshot, response);
const measurement = {
  structuredBytes: bytes(result.structuredContent ?? null),
  textBytes: Buffer.byteLength(result.content.map(block => block.text).join('\n'), 'utf8'),
  completeBytes: bytes(result),
  isError: result.isError,
  boundedIsError: bounded.isError,
};
```

The existing signatures are `toolResult(response)` and `boundedToolResult(snapshot, response)`. Measure the unbounded complete result and separately record the actual bounded outcome, retaining existing enforcement. The CLI is `npx tsx scripts/measure-bilingual-mcp.ts --output ../../.tmp/bilingual/baseline/mcp.json`; A4 reruns it to `final/mcp.json`.

Use stable fixture scenarios: default catalogue; catalogue restricted to each dataset; national totals for all served years; a ministry and its programmes; municipal total for one entity/all years; latest-year totals across all public municipalities; an ordinary region and Adjara; 495 and 500 existing municipal observation cells selected from the served catalogue; 501 requested cells; one valid comparison; all supported ranking dimensions; debt stock/service/rates; deficit actual and projection years; complete source resolution. Derive available IDs/years from the current catalogue and write the exact selected request arguments into the report for reproducibility. Keep separate input/cell/byte-limit outcomes.
- [x] Add tests that a translation correction changes the hash but a rebuild with the same translation content and different `generatedAt`/`releaseCommit` does not. Use `hashDataVersion` directly for isolated hashing tests, then verify the real snapshot builder consumes the same text.

```ts
it('includes translations in data identity', () => {
  const base = { schemaVersion: '1.0.0', localization: { labelsEn: { 'spending.education': 'Education' } } };
  expect(hashDataVersion(base)).not.toBe(hashDataVersion({
    ...base, localization: { labelsEn: { 'spending.education': 'Education spending' } },
  }));
  expect(hashDataVersion({ ...base, generatedAt: '2026-09-05T00:00:00Z' }))
    .toBe(hashDataVersion({ ...base, generatedAt: '2026-09-06T00:00:00Z' }));
});
```

- [x] Confirm missing snapshot translation/lookup tests fail. Load the F3 catalogue in `buildSnapshot.ts`, project only strings needed by the service, and load both service-message files at build time. Include all exposed dataset/series/entity identities and historical name variants, including names required in exclusions. No query may import `catalogue.server.ts` or `messages.ts`.
- [x] Inventory and assign stable message keys for every existing service definition and explanatory branch. Include query-specific amount/share/rate definitions, historical-name clauses, coverage measure notes, missing/exclusion explanations, comparison reasons, ranking definitions/universe descriptions, publication sum warnings, and error templates. Preserve existing Georgian text while authoring the English counterpart. Parameterize full sentences using the same F2 interpolation syntax, but execute a pure snapshot-local resolver.

```json
{
  "definitions.reviewedAmount": "Reviewed value in GEL at full precision.",
  "definitions.shareOfGdp": "Share of the same year's GDP at current prices, on a 0–100 scale.",
  "definitions.historicalName": "Original official name for this year: {name}.",
  "publication.sumWarning": "This file contains totals and their component rows. Summing all rows double-counts amounts; use level and parentSeriesId."
}
```

These are concrete starting English keys; derive additional keys by the existing code's distinct branches, not by translating a fully formatted Georgian sentence at request time. Add each branch's key to a typed exported `SERVICE_MESSAGE_KEYS` list in `localization.ts`; validate both dictionaries against that list and its variable requirements.
- [x] Build normalized bilingual source/document descriptions once. Existing generic fields remain untouched. Extend `ResolvedSource` with required `nameKa`, `nameEn`, nullable `derivationKa`, and nullable `derivationEn`. Extend `PublicDocument` with `titleKa`, `titleEn`, `publisherKa`, `publisherEn`, nullable `attributionKa`, nullable `attributionEn`, and nullable `documentLanguage`. Use F3's English records; obtain existing Georgian descriptions from current reviewed metadata. Where a generic original is English and no Georgian description exists, author the missing Georgian text under a stable `sources.{sourceId}.{field}` or `documents.{documentId}.{field}` key in the Georgian service-message file. Validate these required keys during build; never guess the original field's language at runtime.
- [x] Keep raw manifest/source input types distinct from enriched output types in this same task. Define `RawPublicDocument = Omit<PublicDocument, 'titleKa' | 'titleEn' | 'publisherKa' | 'publisherEn' | 'attributionKa' | 'attributionEn' | 'documentLanguage'>` and `RawResolvedSource = Omit<ResolvedSource, 'nameKa' | 'nameEn' | 'derivationKa' | 'derivationEn' | 'documents'> & { documents: RawPublicDocument[] }`. Change `ManifestDocument` to `Omit<RawPublicDocument, 'role'> & { repositoryPath: string }`, and have `resolvePublicSources` return raw sources. `buildFactQuerySnapshot` enriches them into `ResolvedSource[]` before hashing. This prevents an intermediate commit from requiring translations on untouched raw archive rows; request-time `selectSources` still returns enriched snapshot sources.
- [x] Review legal attributions as descriptions: preserve the original mandatory attribution field verbatim, and make each translated companion accurately explain it without replacing required legal wording. All document languages are verified values or `null`.
- [x] Update snapshot fixture factories to include a minimal valid localization slice and bilingual sources. Do not weaken purity or evidence tests. Run localization/snapshot/canonical/purity tests, `npm run i18n:check`, and typecheck; commit with `feat: pin reviewed service translations to data snapshots`.

**Done:** every future service translation is snapshot content, deterministic across data modes, with no runtime translation dependency.

> A1 verified on 2026-09-06: full check passed 171 files / 1,682 tests; all 616 query/MCP tests passed, including the unchanged 20-intent financial reference fixture. Production build and all ten publication hash checks passed. Snapshot content now pins 200 service labels, 549 programme-year names, 113 sentence keys in each language, and bilingual evidence for 115 sources. Authored 144 Georgian companions where original source metadata was English; original generic fields, attributions and archive bytes remain unchanged. Service parameter contracts preserve the existing difference between generic Georgian errors and detailed English SDK errors. The public schema remains 1.0.0 until A5. New dataVersion: a6c927f06f86396992ed7afd5fc0aae3accfc83700f3213fc28ddcbc7c1ceeff.

> Measurement evidence: .tmp/bilingual/baseline/mcp.json records 33 scenarios before snapshot changes; .tmp/bilingual/a1-mcp.json records the intermediate result. Exact 501 cells cannot form one valid rectangular request from the current municipal catalogue (501 = 3 × 167). The harness therefore probes the exact result gate with 501 distinct existing cells from two valid requests, labels that fixture explicitly, and separately sends a real 506-cell request. Input, cell and complete-result byte outcomes are recorded separately. The 495/500-cell calls already exceeded the 512 KiB result limit before translation. The first 100-source batch now exceeds that unchanged byte limit; narrower source requests and bulk publications remain available.

> Dependency adjustment: source-field preservation in getSources and shared publisher/attribution hoisting were pulled forward from A3 because the enriched source type requires them. Shared bilingual evidence is 50,969 bytes versus 97,796 bytes expanded (48% saving). The earlier Georgian-only 45 KB regression ceiling was replaced with lossless restoration of every field, a minimum 40% saving against the identical expanded bilingual evidence, and a 64 KiB evidence guard. The protocol limit stays 512 KiB; no source/title is removed. Query labels/definitions, declared output schemas and compact bilingual text remain A2–A4.

## Task A2: Add bilingual catalogue and observation output

**Depends on:** A1. Demonstrate the expenditure example alongside W4's complete vertical slice.

**Files:** Modify `apps/web/lib/factQuery/{describeCoverage,observations,queryNational,queryMinistries,queryMunicipal,queryDebt,queryDeficit,schemas}.ts`, `apps/web/lib/mcp/outputSchema.ts`, and the matching six query/catalogue tests. Create `apps/web/tests/factQuery/bilingualObservations.test.ts`. Update public type exports in `apps/web/lib/factQuery/index.ts` where required.

**Interfaces:** Add required `labelEn` beside `labelKa` in catalogue dataset/entity/series entries; `measureNotesEn` beside existing `measureNotes`; `reasonEn` beside Georgian prose in catalogue exclusions. Observations add required `entityLabelEn`, `seriesLabelEn`, `valueDefinitionEn`, and nullable `missingReasonEn`. Coverage missing cells and excluded entities gain `reasonEn` for their human explanations. Preserve machine reason codes verbatim wherever they already identify a condition; their English explanation is separate. Retain `valueDefinitionId`, existing Georgian fields, values, units, basis, source/document/caveat IDs, and field ordering meaning. Input schemas remain unchanged.

- [x] Add tests for all five observation-producing query functions and six dataset families using the real snapshot. Assert exact known labels plus all English field presence. Use the existing reference fixture for financial expectations; compare language additions separately.

```ts
it('returns the same education observation with reviewed English labels', async () => {
  const snapshot = await buildFactQuerySnapshot({ releaseCommit: 'test', generatedAt: '2026-09-05T00:00:00Z' });
  const response = queryNational(snapshot, { side: 'expenditure', seriesIds: ['spending.education'], years: [2025], measure: 'amount_gel' });
  if (response.kind !== 'observations') throw new Error(`Expected observations, received ${response.kind}`);
  const observation = (response.data as { observations: Observation[] }).observations[0];
  expect(observation.seriesLabelKa).toBe('განათლება');
  expect(observation.seriesLabelEn).toBe('Education');
  expect(observation.valueDefinitionEn).not.toMatch(/[\p{Georgian}]/u);
  expect(observation.observationId).toContain('spending.education:2025:amount_gel');
});
```

- [x] Confirm failure, then add labels to each construction path, including total, missing observation, requested entity, programme, and public-source-only entity cases. Use the same stable IDs in `serviceLabelEn`; do not infer translated names from slugs.

```ts
const englishFields = {
  entityLabelEn: serviceLabelEn(snapshot, entityId),
  seriesLabelEn: serviceLabelEn(snapshot, seriesId),
  valueDefinitionEn: serviceMessage(snapshot, 'en', 'definitions.reviewedAmount'),
};
```

Choose the message key from the existing measure/series kind branch; the excerpt is for the raw reviewed amount case only. Shares must identify the applicable denominator. Programme definitions use `historicalProgrammeLabelEn` when the original-year name is shown; never append untranslated `officialLabelKa` inside English definitions.
- [x] Complete catalogue translation of measure notes and exclusions. Extend English-name discovery by adding reviewed `labelEn` to the existing search fields. Preserve current stable IDs, slug matching, and alias boundary checks from PR #101; do not replace them with broad substring matching that reintroduces ambiguous administrative-name bugs.
- [x] Extend declared observation and tool-output schemas to include all added fields; ensure SDK output validation sees them. Keep `z.strictObject` input contracts unchanged. Tests must prove an old request without any language parameter still works and invalid parameters remain rejected.
- [x] Run `npx vitest run tests/factQuery/bilingualObservations.test.ts tests/factQuery/describeCoverage.test.ts tests/factQuery/queryNational.test.ts tests/factQuery/queryMinistries.test.ts tests/factQuery/queryMunicipal.test.ts tests/factQuery/queryDebt.test.ts tests/factQuery/queryDeficit.test.ts tests/factQuery/schemas.test.ts tests/mcp/outputSchema.test.ts`, then the reference fixture and typecheck. Commit with `feat: return bilingual catalogue and budget observations`.

**Done:** every served dataset has reviewed bilingual names/definitions without changing what any observation measures.

> A2 verified on 2026-09-06: full check passed 172 files / 1,693 tests, including all six observation families, unchanged reference expectations, catalogue/alias cases and SDK output validation. Catalogue names, measure notes, exclusions, observation definitions and missing reasons now expose reviewed English companions. Existing Georgian values and all non-language observation fields are unchanged when English snapshot text is edited. English historical programme definitions use the reviewed original-year translation. Request schemas remain strict and accept no language parameter. Shared source/document English fields from A1 are now explicitly declared in the MCP output schema. Comparison/ranking English additions and compact bilingual text remain A3/A4.

> Expenditure example: the SDK in-memory transport returned Education / განათლება for 2025, exactly GEL 3,045,941,254, citing the same two original documents. This equals the actual English workbook downloaded in W3. Evidence: .tmp/bilingual/a2-expenditure-example.json and a2-workbook-sdk-parity.json. This verifies the declared SDK response, not a production /mcp request. Build passed with 106 static-generation entries and only /mcp dynamic; all ten publication hashes passed. Snapshot dataVersion remains a6c927f06f86396992ed7afd5fc0aae3accfc83700f3213fc28ddcbc7c1ceeff; public schema version remains 1.0.0 until A5. Two old assertions explicitly requiring Georgian-only output were updated to assert the new English fields; financial reference expectations were not changed.

## Task A3: Preserve bilingual evidence through comparisons, rankings, and metadata

**Depends on:** A2.

**Files:** Modify `apps/web/lib/factQuery/{compare,rank,getSources,meta,sources,types}.ts`, `apps/web/lib/factQuery/caveats/{engine,index,rules.national,rules.ministries,rules.municipal,rules.debt,rules.deficit}.ts` where needed for snapshot-pinned messages and English methodology references, and `apps/web/lib/mcp/outputSchema.ts`. Test existing comparisons/rankings/sources/meta/caveats and new `apps/web/tests/factQuery/bilingualEvidence.test.ts`.

**Interfaces:** Comparisons/rank entries and tie-boundary entries gain `entityLabelEn`/`seriesLabelEn`; comparison endpoints gain `valueDefinitionEn` and nullable `missingReasonEn`. Keep current reasons and add aligned `reasonsEn` arrays of English explanations, without changing original machine reason codes. Rankings gain `rankingDefinitionEn`, `universe.descriptionEn`, and `reasonEn` on grouped prose exclusions. Add `methodologyRefEn` to every caveat. The source/document companion fields from A1 must survive `getSources`, response metadata, hoisting, narrowing, and deduplication. Extend `HOISTABLE_DOCUMENT_FIELDS` only for genuinely shared new publisher/attribution fields; document titles and identity remain per-document.

- [x] Add cases for comparable and non-comparable periods, programme historical renames, rate percentage-point changes, municipal definition breaks, Adjara derivation/upstream sources, and a tie at a ranking cutoff. Assert unchanged numerical outputs and complete English explanations.

```ts
it('does not let translated display text affect comparability', () => {
  const comparisonInput = {
    target: { dataset: 'national', side: 'expenditure', seriesIds: ['spending.education'] },
    fromYear: 2020, toYear: 2024, measure: 'amount_gel',
  };
  const changed = structuredClone(snapshot);
  changed.localization.labelsEn['spending.education'] = 'Education expenditure';
  const original = compare(snapshot, comparisonInput);
  const translated = compare(changed, comparisonInput);
  if (original.kind !== 'comparisons' || translated.kind !== 'comparisons') {
    throw new Error('Expected both requests to return comparisons');
  }
  const a = (original.data as { comparisons: Comparison[] }).comparisons;
  const b = (translated.data as { comparisons: Comparison[] }).comparisons;
  expect(b.map(row => [row.comparability, row.absoluteChange, row.percentageChange, row.percentagePointChange]))
    .toEqual(a.map(row => [row.comparability, row.absoluteChange, row.percentageChange, row.percentagePointChange]));
});
```

Use `beforeAll` to build the real snapshot with `buildFactQuerySnapshot({ releaseCommit: 'test', generatedAt: '2026-09-05T00:00:00Z' })`, and import `Comparison` from `compare.ts`. The explicit request shape above matches the current strict comparison schema.
- [x] Confirm failure on missing bilingual fields; propagate the new labels and definitions from observations into the existing comparison/ranking builders. Keep `valueDefinitionId` as the comparability key and existing numeric tie-break ordering. Never compare translated strings to decide whether two measurements are compatible.
- [x] Preserve English fields through source narrowing, document defaults, merged evidence, and `get_sources`. Add a round-trip test expanding hoisted fields: source identity, role, archive URL, hashes where present, and both languages must match the unhoisted source. Preserve A1's raw/enriched type distinction; do not reintroduce translation requirements on raw archive rows.

```ts
const translatedDocument = {
  ...originalDocument,
  titleKa: reviewedTitleKa,
  titleEn: catalogue.documents[originalDocument.documentId].title.text,
  publisherKa: reviewedPublisherKa,
  publisherEn: catalogue.documents[originalDocument.documentId].publisher.text,
};
```

This mapping occurs in A1's build enrichment; A3 verifies downstream code preserves it. It must not be copied into a request-time source resolver with a filesystem catalogue lookup.
- [x] Resolve caveat/error/limitation messages from A1's snapshot keys where the existing code authored them inline. Preserve severity, affects IDs, retryability, valid choices, and exclusion rules. `methodologyRefEn` is the English counterpart for a real human methodology page; for shared machine resources preserve the same URL. Keep original references untouched. If a reference points to an internal methodology document, add its actual public English equivalent from the current methodology mapping, not a guessed `/en/docs/...` address.
- [x] Run comparison, ranking, source, meta, caveat, review-regression, and new evidence tests; run the reference fixture and typecheck. Commit with `feat: carry bilingual evidence through comparisons and rankings`.

**Done:** complex answers and their qualifications remain usable in either language; translation cannot affect eligibility, ranking, or fiscal comparability.

> A3 verified on 2026-09-06: the full check passed 177 files / 1,722 tests, including the unchanged numerical/reference expectations, comparison/ranking/source/meta/caveat tests and 12 new bilingual evidence cases. Translation mutations leave every non-English response field unchanged, including eligibility, historical joins, missing endpoints, values and tie ordering. Caveat and error text now resolves from the pinned snapshot; English references point to existing public topic pages, including the deficit explorer explanation. Narrowed and hoisted evidence retains original and translated descriptions, attributions, document identities and language declarations. The explicit MCP schema declares the added comparison/ranking fields. All source archives and raw CSV validations passed; snapshot identity remains a6c927f06f86396992ed7afd5fc0aae3accfc83700f3213fc28ddcbc7c1ceeff. Schema version remains 1.0.0 until A5 completes the public contract.

## Task A4: Render complete bilingual MCP text within existing limits

**Depends on:** A3.

**Files:** Modify `apps/web/lib/mcp/{result,outputSchema,instructions,tools}.ts`, `apps/web/scripts/measure-bilingual-mcp.ts`, and existing `tests/mcp/{result,outputSchema,limits,tools,reviewRegression}.test.ts`; create `apps/web/tests/mcp/bilingualTransport.test.ts`.

**Interfaces:** Retain `toolResult`, `boundedToolResult`, and all current transport signatures. Every successful tool still returns structured content and its compact text twin. Text observation rows include both entity labels, both series labels, and both definitions; source/caveat text includes both descriptions. Numeric values appear once per row. Bilingual schema properties are explicitly declared; permissive parsing alone is not acceptance evidence.

- [x] Add tests for text-only clients using every response kind: observations, catalogue, comparisons, ranking, sources, and errors. Assert English definitions/sources exist alongside Georgian text and that sensitive caveats still precede lower-priority notes. Pin source/document IDs and numerical values in both representations.

```ts
it('makes the English observation understandable to a text-only client', () => {
  const result = toolResult(educationResponse);
  const text = result.content.map(block => block.text).join('\n');
  expect(text).toContain('Education');
  expect(text).toContain('განათლება');
  expect(text).toContain('GEL');
  expect(text).toContain('sources');
  expect(JSON.stringify(result.structuredContent)).toContain('seriesLabelEn');
});
```

Build `educationResponse` with the same valid query used in A2. Include a separate test where a severe budget-scope caveat is present; do not assume the education-only response should contain it.
- [x] Confirm failure, then extend the compact table headers/rows and source rendering. Preserve numeric types and metadata, show both definitions, and include all qualifications without duplicating whole JSON. Add source-default translation fields to the explicit output schema and inspect the SDK's serialized schema in tests.

```ts
return line(
  observation.entityLabelKa, observation.entityLabelEn,
  observation.seriesLabelKa, observation.seriesLabelEn,
  observation.year, observation.measure, observation.value,
  observation.unit, observation.basis, observation.budgetScope,
  observation.valueDefinition, observation.valueDefinitionEn,
  observation.caveatIds.join(','),
);
```

Retain the existing missing-value rendering branch rather than printing a blank numeric value for missing observations; include `missingReasonEn` beside its existing explanation. English text must not lose coverage `reasonEn`, excluded entities, comparability `reasonsEn`, ranking `rankingDefinitionEn`, or `universe.descriptionEn`.
- [x] Rerun the A1 measurement harness with the exact saved requests. Compare complete serialized bytes and accepted/rejected status. Test 500 versus 501 cells, byte-boundary refusal, ranking bounds, and source-heavy responses; add a regression demonstrating that a below-cell-limit answer may still exceed the byte limit. No numeric limit may be raised to make tests pass.
- [x] Keep source/default reuse and grouped exclusions where meaningful; do not drop translated definitions or evidence to fit. When a request newly exceeds 512 KiB, preserve the existing explicit rejection and manifest/narrower-query guidance, and list the request in the final report. The approved design allows this measured byte-boundary consequence rather than promising every old large request will still fit.
- [x] Run `npx vitest run tests/mcp tests/factQuery/reference.test.ts`, typecheck, and translation checks. Confirm rate-limiter, pause, origin/security, and purity tests remain unchanged in meaning. Commit with `feat: expose bilingual MCP text with bounded payloads`.

**Done:** structured and text-only clients receive equivalent bilingual meaning within the existing enforced limits.

> A4 verified on 2026-09-06: all 158 MCP/reference checks passed, followed by all 11 transport cases after adding the explicit severe national budget-boundary case. Typecheck, lint and translation validation passed. The actual SDK advertises all bilingual fields, including document-default publisher/attribution fields; its unchanged nine-tool surface and request schemas remain covered. Text rows retain English and Georgian definitions, missingness, comparisons, rankings, exclusions and exact source/document IDs. Sources are rendered once per response; defaults remain shared, mandatory original attributions are preserved, and numeric observation values appear once per text row. No security, pause, rate, duration, cell, ranking or byte limit was relaxed.

> The final measurement report has the same 33 inputs and identical limits as the baseline. The first 100-source batch is the only newly oversized request: 362,638 to 696,073 complete serialized bytes; it is explicitly refused with narrower-query and bulk-manifest guidance. The 495-cell and 500-cell municipal cases were already refused by the byte limit (652,923 / 661,780 bytes before; 915,169 / 927,425 after). The exact 501-cell result fixture and real 506-cell request retain their distinct gate evidence. The catalogue remains accepted at 9,390 bytes and all-years national expenditure total at 168,381 bytes. Evidence: .tmp/bilingual/final/mcp.json and a4-* logs. These are SDK/local results, not an external AI-client understanding test.

## Task A5: Publish bilingual JSON, advertise schema 1.1.0, and document clients

**Depends on:** A4; coordinate the connection page with W8 and distribution metadata with W9.

**Files:** Modify `apps/web/lib/factQuery/{publications,types}.ts`, `apps/web/scripts/prepare-fact-query-publications.ts` only where new metadata requires it, `apps/web/lib/mcp/instructions.ts`, `apps/web/public/llms.txt`, `apps/web/lib/pages/connect.tsx`, `apps/web/lib/i18n/messages/{ka,en}/connect.json`, and `docs/data-methodology/{ai-grounding-and-caveats,ai-reference-intents}.md`. Extend `tests/factQuery/{publications,agreement,reference}.test.ts` without changing reference answer expectations, existing publication script tests, and `tests/browser/connect.spec.ts`; create `apps/web/tests/factQuery/bilingualPublications.test.ts`.

**Interfaces:** Set `SCHEMA_VERSION` to `'1.1.0'`. All current publication URLs and row scopes stay unchanged. Add `noticeEn` alongside `notice`, plus bilingual catalogue, supporting description, source, and observation fields from the same snapshot/query core. Advertise both human connection-page URLs and document additive field compatibility; no language input is required.

- [x] Add tests across `manifest.json`, `catalogue.json`, `sources.json`, `national-revenue.json`, `national-expenditure.json`, `ministries.json`, `municipal-expenditure.json`, `government-debt.json`, `government-debt-rates.json`, and `general-government-balance.json`. Use the existing `buildAllPublications(snapshot): PublicationArtifact[]` from `publications.ts`, with `fileName` and `bytes` on each artifact. Every dataset file remains independently interpretable with notices, sources, and caveats.

```ts
const artifacts = buildAllPublications(snapshot);
const artifact = artifacts.find(item => item.fileName === 'national-expenditure.json');
if (!artifact) throw new Error('Missing national expenditure publication');
const published = JSON.parse(artifact.bytes.toString('utf8'));
expect(published.schemaVersion).toBe('1.1.0');
expect(published.dataVersion).toBe(snapshot.dataVersion);
expect(published.noticeEn).toContain('totals');
for (const observation of published.observations) {
  expect(observation.seriesLabelEn.trim()).not.toBe('');
  expect(observation.valueDefinitionEn.trim()).not.toBe('');
}
```

Apply notice/observation assertions to dataset files only, not the catalogue/manifest/source files, whose shapes differ. The existing exporter tests provide byte-decoding and artifact lookup; retain their exact current function rather than inventing alternate serialization.
- [x] Confirm missing bilingual publication/version assertions fail, then add translated publication notices and propagate complete catalogue/observation/evidence structures. Add English companions to prose in `supportingValues` and dataset measure notes as identified by A1. Keep machine keys, row sets, family boundaries, rate units, planned/projection status, and missing cells.

```ts
const published = {
  ...publicationHeader(snapshot),
  datasetId,
  notice: serviceMessage(snapshot, 'ka', 'publication.sumWarning'),
  noticeEn: serviceMessage(snapshot, 'en', 'publication.sumWarning'),
  observations: result.data.observations,
  coverage: result.data.coverage,
  sources: result.meta.sources,
  caveats: result.meta.caveats,
};
```

Retain the current `catalogue` and `supportingValues` fields when applying the shown additions inside `datasetFile`; the excerpt identifies the changed text ownership, not permission to remove existing fields.
- [x] Regenerate publication bytes using the existing preparation command; compute manifest hashes/sizes from those bytes. Confirm raw machine CSVs and original archives still match F1 hashes for identical data. Generated outputs remain ignored and are not committed.
- [x] Update both connection-page versions and server/client guidance. Explain `*Ka`/`*En`, original generic fields, English definitions, original document language, bilingual search, schema `1.1.0`, translation-triggered `dataVersion` changes, and shared endpoint/download URLs. Include paired questions about one national category, one municipality, debt rates, and deficit projections. These examples demonstrate reviewed fields; they do not claim a real external AI client's language understanding was tested unless it was actually exercised.
- [x] Keep the current 20-intent fixture's numerical/source/comparability expectations. Add language assertions and update stale comments saying only questions are bilingual. Run `npm run data:prepare-fact-query-snapshot`, `npm run data:prepare-fact-query-publications`, `npm run data:check-fact-query-publications`, `npx vitest run tests/factQuery tests/mcp`, translation checks, and typecheck. A publication command failure must be fixed before moving on.
- [x] Verify an old valid request still succeeds unchanged and additive fields match the declared SDK schema. Document the caveat for clients rejecting unknown fields or an exact schema version; do not promise byte-for-byte response compatibility.
- [x] Commit named source/documentation files with `feat: publish bilingual fiscal data contract version 1.1`.

**Done:** all current machine publications and tools are bilingual, versioned together, and checked against reviewed data. Proceed to the master's V1 integrated gate, not directly to deployment.

> A5 verified on 2026-09-06: all ten JSON publications now advertise schema 1.1.0 and dataVersion af6e77abba7c9b32ba827219180352e838f541a08bb6e225e2d0004fd34c0c83. Dataset/catalogue/source notices resolve from the pinned snapshot. Municipal population supporting rows retain their original transformation/unit and gain reviewed language companions; the service catalogue now owns 115 sentence keys. All original publication URLs, row counts and coverage match the F1 manifest; sampled original archive hashes match F1. Both builds passed with 190 static entries, only /mcp dynamic, and all ten output hashes verified.

> Final targeted verification passed 72 files / 801 tests across fact-query, MCP, i18n and SEO. The broad run had 1,737 passing tests and one stale single-language inventory assertion; the final targeted run includes its correction and all affected suites. No fiscal reference values were changed: the current fixture has 24 intents (the plan's earlier 20 count was stale). All 21 connection/public-content browser checks passed, including both language examples, unchanged shared endpoint, keyboard copy and responsive layouts. English example and technical-note screenshots were reviewed at 390/1440 px.

> Dependency refinement: the AI guide's new English links triggered the existing sitemap-membership guard, so W9's paired sitemap and genuine page-review dates were completed here. All 91 real page identities have a reviewed English date of 2026-09-06; 182 sitemap entries carry reciprocal ka/en/x-default links, Georgian original dates are preserved, and English dates take the later of data and translation review. Revision validation rejects missing, extra and invalid dates. Page-level metadata and social images remain W9. No production publishing or external AI-client understanding test is claimed.
