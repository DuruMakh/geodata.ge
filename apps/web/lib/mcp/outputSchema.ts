// apps/web/lib/mcp/outputSchema.ts
//
// The shape every tool returns as `structuredContent`.
//
// Each response has always carried both representations - a structured envelope
// and a human-readable text twin - but no tool DECLARED an output schema, and
// under the MCP spec that declaration is what tells a client structured output
// exists. Without it a client falls back to the text, which is what a real
// client was observed doing: parsing a tab-separated table by hand while the
// parsed object sat beside it.
//
// The SDK validates both the envelope and each tool's data shape. The shared
// union below supports validation of any response; registration narrows it to
// the one kind of answer the selected tool returns.
import { z } from "zod";
import { observationSchema } from "../factQuery/schemas";

const caveat = z
  .object({
    code: z.string(),
    severity: z.enum(["severe", "note"]),
    messageKa: z.string(),
    messageEn: z.string(),
    methodologyRef: z.string(),
    methodologyRefEn: z.string().min(1),
    affects: z.array(z.string()),
  })
  .loose();

/**
 * A document as a response carries it.
 *
 * The hoistable fields are optional because a source states them once in
 * `documentDefaults` when all of its documents agree; they reappear per
 * document only when the documents disagree. `sha256` and `byteSize` are absent
 * by design - get_sources answers that question.
 */
const responseDocument = z
  .object({
    documentId: z.string(),
    title: z.string(),
    titleKa: z.string().min(1),
    titleEn: z.string().min(1),
    documentLanguage: z.enum(["ka", "en", "mul"]).nullable(),
    officialUrl: z.string().nullable(),
    archiveUrl: z.string().nullable(),
    years: z.array(z.number()),
    publisher: z.string().optional(),
    publisherKa: z.string().min(1).optional(),
    publisherEn: z.string().min(1).optional(),
    attribution: z.string().nullable().optional(),
    attributionKa: z.string().nullable().optional(),
    attributionEn: z.string().nullable().optional(),
    licenceId: z.string().nullable().optional(),
    mediaType: z.string().optional(),
    retrievedAt: z.string().optional(),
    datasetId: z.string().nullable().optional(),
    role: z.string().optional(),
  })
  .loose();

const responseSource = z
  .object({
    sourceId: z.string(),
    name: z.string(),
    nameKa: z.string().min(1),
    nameEn: z.string().min(1),
    derivationKa: z.string().nullable(),
    derivationEn: z.string().nullable(),
    lastReviewedAt: z.string(),
    derivation: z.string().nullable(),
    /** Values shared by every document below; a field absent from a document is given here. */
    documentDefaults: responseDocument.pick({ publisher: true, publisherKa: true, publisherEn: true, attribution: true, attributionKa: true, attributionEn: true, licenceId: true, mediaType: true, retrievedAt: true, datasetId: true, role: true }).optional(),
    documents: z.array(responseDocument),
  })
  .loose();

const responseMeta = z
  .object({
    schemaVersion: z.string(),
    dataVersion: z.string(),
    releaseCommit: z.string(),
    generatedAt: z.string(),
    licence: z.string(),
    licenceUrl: z.string(),
    sources: z.array(responseSource),
    caveats: z.array(caveat),
  })
  .loose();

/**
 * A failed call carries `isError` and the bilingual text only - `toolResult`
 * attaches no structured payload to one - so this schema describes successful
 * answers and does not advertise an error shape that can never arrive.
 */
const excludedEntity = z.object({ entityId: z.string(), reason: z.string() });
const bilingualExcludedEntity = excludedEntity.extend({ reasonEn: z.string().min(1) });
const coverage = z.object({
  requestedYears: z.array(z.number().int()), availableYears: z.array(z.number().int()), returnedYears: z.array(z.number().int()),
  missingCells: z.array(z.object({ entityId: z.string(), seriesId: z.string(), year: z.number().int(), period: z.string().optional(), reason: z.string(), reasonEn: z.string().min(1) })),
  excludedEntities: z.array(bilingualExcludedEntity), returnedCount: z.number().int(), expectedCount: z.number().int(),
  requestedPeriods: z.array(z.string()).optional(), availablePeriods: z.array(z.string()).length(2).nullable().optional(),
});
const endpoint = observationSchema.pick({ year: true, period: true, value: true, availability: true, missingReason: true, missingReasonEn: true, basis: true, valueDefinition: true, valueDefinitionEn: true, valueDefinitionId: true, sourceIds: true, documentIds: true });
const dataShapes = {
  observations: z.object({ observations: z.array(observationSchema), coverage }),
  comparisons: z.object({
    comparisons: z.array(z.object({
      comparisonId: z.string(), datasetId: z.string(), entityId: z.string(), entityLabelKa: z.string(), entityLabelEn: z.string().min(1), seriesId: z.string(), seriesLabelKa: z.string(), seriesLabelEn: z.string().min(1),
      measure: z.string(), unit: observationSchema.shape.unit, from: endpoint, to: endpoint,
      absoluteChange: z.number().nullable(), percentageChange: z.number().nullable(), percentagePointChange: z.number().nullable(),
      comparability: z.enum(["comparable", "limited", "not_comparable"]), reasons: z.array(z.string()), reasonsEn: z.array(z.string()), caveatIds: z.array(z.string()),
    })),
    coverage: z.object({ requestedYears: z.array(z.number()), requestedPeriods: z.array(z.string()).length(2).optional(), requestedPairs: z.number(), comparedPairs: z.number(), comparableCount: z.number(), notComparableCount: z.number(), excludedEntities: z.array(bilingualExcludedEntity) }),
  }),
  ranking: z.object({
    entries: z.array(z.object({
      position: z.number(), tied: z.boolean(), entityId: z.string(), entityLabelKa: z.string(), entityLabelEn: z.string().min(1), seriesId: z.string(), seriesLabelKa: z.string(), seriesLabelEn: z.string().min(1),
      value: z.number().nullable(), unit: observationSchema.shape.unit, basis: observationSchema.shape.basis, caveatIds: z.array(z.string()), period: z.string().optional(),
    })),
    universe: z.object({ dimension: z.enum(["series", "entities"]), description: z.string(), descriptionEn: z.string().min(1), candidateCount: z.number(), eligibleCount: z.number(), returnedCount: z.number(), cutoffSplitsTie: z.boolean() }),
    exclusions: z.array(z.object({ reason: z.string(), reasonEn: z.string().min(1), ids: z.array(z.string()) })), rankingDefinition: z.string(), rankingDefinitionEn: z.string().min(1),
  }),
  catalogue: z.object({
    datasets: z.array(z.object({ datasetId: z.string(), budgetScope: z.string(), labelKa: z.string(), labelEn: z.string().min(1), years: z.array(z.number()).length(2), entityTypes: z.array(z.string()), measures: z.array(z.string()), periods: z.array(z.string()).length(2).optional(), measureNotes: z.record(z.string(), z.string()).optional(), measureNotesEn: z.record(z.string(), z.string()).optional(), measureNotesKa: z.record(z.string(), z.string()).optional() })),
series: z.array(z.object({ seriesId: z.string(), labelKa: z.string(), labelEn: z.string().min(1), level: z.string(), parentSeriesId: z.string().nullable(), availability: z.enum(["served", "calculated_total", "taxonomy_only"]), years: z.array(z.number()), yearsByMeasure: z.record(z.string(), z.array(z.number())).optional(), periods: z.array(z.string()).length(2).optional(), periodsByMeasure: z.record(z.string(), z.array(z.string()).length(2)).optional(), datasetId: z.string().optional() })).optional(),
    entities: z.array(z.object({ entityId: z.string(), entityType: z.string(), labelKa: z.string(), labelEn: z.string().min(1), entitySlug: z.string().nullable(), periods: z.array(z.string()).length(2).optional(), datasetId: z.string().optional() })).optional(),
    exclusions: z.array(bilingualExcludedEntity),
  }),
  sources: z.object({
    sources: z.array(z.object({
      sourceId: z.string(), name: z.string(), lastReviewedAt: z.string(), derivation: z.string().nullable(), documentCount: z.number(), narrowed: z.boolean(), narrowingOutcome: z.enum(["not_requested", "applied", "dropped_no_match"]),
      nameKa: z.string().min(1), nameEn: z.string().min(1), derivationKa: z.string().nullable(), derivationEn: z.string().nullable(),
      documents: z.array(responseDocument.extend({ sha256: z.string(), byteSize: z.number() })),
    })),
    narrowedBy: z.object({ datasetId: z.string().optional(), years: z.array(z.number()).optional(), entityIds: z.array(z.string()).optional() }).nullable(),
  }),
};

export const toolOutput = z
  .object({
    kind: z.enum(["observations", "comparisons", "ranking", "catalogue", "sources"]),
    /** How complete the answer is, not whether the call worked. */
    status: z.enum(["ok", "partial", "empty"]),
    /** Present on every successful answer. Its shape is what differs between tools. */
    data: z.union([dataShapes.observations, dataShapes.comparisons, dataShapes.ranking, dataShapes.catalogue, dataShapes.sources]),
    meta: responseMeta,
  })
  .loose();

export function outputSchemaFor(tool: string) {
  const kind = tool === "describe_coverage" ? "catalogue" : tool === "get_sources" ? "sources" : tool === "compare" ? "comparisons" : tool === "rank" ? "ranking" : "observations";
  return toolOutput.extend({ kind: z.literal(kind), data: dataShapes[kind] });
}
