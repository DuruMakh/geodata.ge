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
// The SDK validates `structuredContent` against this and fails the call on a
// mismatch, so the envelope is described exactly and `data` - whose shape is
// what differs between a ranking, a catalogue and a set of observations - is
// left open. Narrowing `data` per tool is a later job; declaring that it exists
// is this one.
import { z } from "zod";

const caveat = z
  .object({
    code: z.string(),
    severity: z.enum(["severe", "note"]),
    messageKa: z.string(),
    messageEn: z.string(),
    methodologyRef: z.string(),
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
    officialUrl: z.string().nullable(),
    archiveUrl: z.string().nullable(),
    years: z.array(z.number()),
    publisher: z.string().optional(),
    attribution: z.string().nullable().optional(),
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
    lastReviewedAt: z.string(),
    derivation: z.string().nullable(),
    /** Values shared by every document below; a field absent from a document is given here. */
    documentDefaults: z.record(z.string(), z.unknown()).optional(),
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
export const toolOutput = z
  .object({
    kind: z.enum(["observations", "comparisons", "ranking", "catalogue", "sources"]),
    /** How complete the answer is, not whether the call worked. */
    status: z.enum(["ok", "partial", "empty"]),
    /** Present on every successful answer. Its shape is what differs between tools. */
    data: z.record(z.string(), z.unknown()),
    meta: responseMeta,
  })
  .loose();
