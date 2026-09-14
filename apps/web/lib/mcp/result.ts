// apps/web/lib/mcp/result.ts
//
// Turns a FactQueryResponse into what an MCP client receives: the envelope as
// structured content, plus an equivalent text representation for clients that
// consume text (spec section 11.1). Pure - no transport, no filesystem, no
// logging. The route wires it; this file decides shape and size.
import { INPUT_LIMITS } from "../factQuery/schemas";
import { buildResponseMeta } from "../factQuery/meta";
import { serviceMessage } from "../factQuery/localization";
import type { Comparison } from "../factQuery/compare";
import type { GetSourcesData, ResolvedSourceView } from "../factQuery/getSources";
import type { RankData } from "../factQuery/rank";
import type { Observation } from "../factQuery/observations";
import type { Caveat, FactQueryResponse, FactQuerySnapshot, ResponseSource, ResolvedSource } from "../factQuery/types";

/** Spec section 11.3's operating limits, one constant per row of that table. */
export const LIMITS = {
  /** Incoming body; rejected before full processing. */
  bodyBytes: 32 * 1024,
  /** Returned observation cells per tool call. */
  cells: 500,
  /** Comparison candidates (endpoint pairs) per call. */
  comparisonPairs: 250,
  /** Ranking output. */
  rankDefault: 10,
  rankMax: 100,
  /**
   * Serialized tool result, including evidence and BOTH representations.
   *
   * This is the binding gate, not `cells`. A real 495-cell municipal request
   * exceeds this ceiling even though it satisfies the cell cap, and can still
   * produce a response this ceiling must refuse. Sources and warnings are never
   * silently trimmed to fit; the whole result is refused with guidance instead.
   */
  resultBytes: 512 * 1024,
  /**
   * Input array bounds, further restricted by coverage and result limits.
   *
   * Taken from the schemas rather than restated here: these are enforced by
   * `.max()` on the input arrays, which is also what publishes them to clients
   * as `maxItems`. A second copy in this file is how they came to be declared
   * in one place and enforced in none.
   */
  ...INPUT_LIMITS,
  /**
   * Request duration.
   *
   * Documents the platform setting - `maxDuration` in app/mcp/route.ts - which
   * is what actually stops a long request. Nothing in this module enforces it.
   */
  durationMs: 10_000,
} as const;

export type ToolResult = {
  /** MCP types structured content as a record, so match that rather than `unknown`. */
  structuredContent?: Record<string, unknown>;
  content: { type: "text"; text: string }[];
  isError: boolean;
};

export const BULK_DATA_URL = "https://fiscal.ge/downloads/data/manifest.json";

function line(...cells: (string | number | null)[]): string {
  return cells.map((cell) => (cell === null ? "" : String(cell))).join("\t");
}

function observationLine(observation: Observation): string {
  const value =
    observation.value === null ? `missing${observation.missingReason ? ` (${observation.missingReason})` : ""}` : observation.value;
  return line(
    observation.entityLabelKa,
    observation.entityLabelEn,
    observation.seriesLabelKa,
    observation.seriesLabelEn,
    // A monthly observation's month, or twelve months of one year read as twelve identical rows.
    observation.period ?? observation.year,
    observation.measure,
    value,
    observation.unit,
    observation.basis,
    // The accounting boundary, without which a text-mode reader cannot tell
    // consolidated receipts from state-budget expenditure - the one distinction
    // that makes these figures unsafe to subtract from each other.
    observation.budgetScope,
    observation.valueDefinition,
    observation.valueDefinitionEn,
    observation.missingReasonEn,
    observation.caveatIds.join(","),
    observation.entityId,
    observation.seriesId,
    observation.sourceIds.join(","),
    observation.documentIds.join(","),
  );
}

function comparisonLine(comparison: Comparison): string {
  return line(
    comparison.entityLabelKa,
    comparison.entityLabelEn,
    comparison.seriesLabelKa,
    comparison.seriesLabelEn,
    `${comparison.from.period ?? comparison.from.year}→${comparison.to.period ?? comparison.to.year}`,
    comparison.measure,
    comparison.from.value,
    comparison.to.value,
    comparison.from.basis,
    comparison.to.basis,
    comparison.absoluteChange,
    comparison.percentageChange,
    comparison.percentagePointChange,
    comparison.unit,
    comparison.comparability,
    // Why it is not comparable. Without this a text-mode client sees
    // `not_comparable`, two populated endpoints and empty change columns, and
    // no statement of what makes the two years incompatible.
    comparison.reasons.join(","),
    comparison.reasonsEn.join(","),
    comparison.from.valueDefinition,
    comparison.from.valueDefinitionEn,
    comparison.to.valueDefinition,
    comparison.to.valueDefinitionEn,
    comparison.from.missingReason,
    comparison.from.missingReasonEn,
    comparison.to.missingReason,
    comparison.to.missingReasonEn,
    comparison.caveatIds.join(","),
    comparison.entityId,
    comparison.seriesId,
    comparison.from.sourceIds.join(","),
    comparison.from.documentIds.join(","),
    comparison.to.sourceIds.join(","),
    comparison.to.documentIds.join(","),
  );
}

function sourceView(source: ResolvedSourceView): string {
  return line(source.sourceId, source.name, source.documents.length, source.narrowingOutcome);
}

function excludedLines(coverage: { excludedEntities: { entityId: string; reason: string; reasonEn: string }[] }): string[] {
  return coverage.excludedEntities.map((entity) => `excluded ${entity.entityId}: ${entity.reason} | ${entity.reasonEn}`);
}

function bodyOf(response: Extract<FactQueryResponse, { kind: Exclude<FactQueryResponse["kind"], "error"> }>): string[] {
  const data = response.data as Record<string, unknown>;

  if (response.kind === "observations") {
    const { observations, coverage } = data as { observations: Observation[]; coverage: { returnedCount: number; expectedCount: number; excludedEntities: { entityId: string; reason: string; reasonEn: string }[] } };
    return [
      "# entityKa\tentityEn\tseriesKa\tseriesEn\tyearOrPeriod\tmeasure\tvalue\tunit\tbasis\tbudgetScope\tdefinitionKa\tdefinitionEn\tmissingReasonEn\tcaveats\tentityId\tseriesId\tsourceIds\tdocumentIds",
      ...observations.map(observationLine),
      `returned ${coverage.returnedCount} of ${coverage.expectedCount} requested cells`,
      ...excludedLines(coverage),
    ];
  }

  if (response.kind === "comparisons") {
    const { comparisons, coverage } = data as { comparisons: Comparison[]; coverage: { excludedEntities: { entityId: string; reason: string; reasonEn: string }[] } };
    return [
      "# entityKa\tentityEn\tseriesKa\tseriesEn\tyearsOrPeriods\tmeasure\tfrom\tto\tfromBasis\ttoBasis\tchange\tpct\tpp\tunit\tcomparability\treasonsKa\treasonsEn\tfromDefinitionKa\tfromDefinitionEn\ttoDefinitionKa\ttoDefinitionEn\tfromMissingKa\tfromMissingEn\ttoMissingKa\ttoMissingEn\tcaveats\tentityId\tseriesId\tfromSources\tfromDocuments\ttoSources\ttoDocuments",
      ...comparisons.map(comparisonLine),
      ...excludedLines(coverage),
    ];
  }

  if (response.kind === "ranking") {
    const { entries, universe, exclusions, rankingDefinition, rankingDefinitionEn } = data as RankData;
    return [
      rankingDefinition,
      rankingDefinitionEn,
      `${universe.description} | ${universe.descriptionEn}`,
      "# position\tentityKa\tentityEn\tseriesKa\tseriesEn\tvalue\tunit\tbasis\ttied\tcaveats\tentityId\tseriesId",
      ...entries.map((entry) =>
        line(entry.position, entry.entityLabelKa, entry.entityLabelEn, entry.seriesLabelKa, entry.seriesLabelEn, entry.value, entry.unit, entry.basis, entry.tied ? "tied" : "", entry.caveatIds.join(","), entry.entityId, entry.seriesId),
      ),
      `${universe.returnedCount} of ${universe.eligibleCount} eligible from ${universe.candidateCount} candidates` +
        (universe.cutoffSplitsTie ? " — the cutoff splits a tie, so the last place is arbitrary" : ""),
      // One line per reason. Printing the reason once per entity repeated the
      // same sentence sixty-four times.
      ...exclusions.map((group) => `excluded (${group.reason} | ${group.reasonEn}): ${group.ids.join(", ")}`),
    ];
  }

  if (response.kind === "sources") {
    const { sources, narrowedBy } = data as GetSourcesData;
    return [
      "# sourceId\tname\tdocuments\tscope",
      ...sources.flatMap((source) => [
        sourceView(source),
        ...(source.narrowingOutcome === "dropped_no_match" ? ["No document matched the requested filters; showing the full source instead."] : []),
        ...sourceLines(source),
      ]),
      ...(narrowedBy === null ? [] : [`requested filters: ${JSON.stringify(narrowedBy)}`]),
    ];
  }

  // catalogue: a nested capability description with no natural table, so its
  // own JSON is the clearest text form. Not pretty-printed: describe_coverage
  // is the first call every client is told to make, and the full catalogue is
  // ~36 KiB minified - indenting it added roughly another 35 KiB of whitespace
  // to a payload that already ships beside its structured twin, for no gain to
  // a reader that parses it anyway.
  return [JSON.stringify(data)];
}

function sourceLines(source: ResponseSource | ResolvedSource): string[] {
  const defaults = "documentDefaults" in source ? source.documentDefaults : undefined;
  return [
    line(source.sourceId, source.nameKa, source.nameEn, source.name, source.derivationKa, source.derivationEn, source.derivation, source.lastReviewedAt),
    ...(defaults ? [`document defaults: ${JSON.stringify(defaults)}`] : []),
    "# documentId\ttitleKa\ttitleEn\toriginalTitle\tyears\tofficialUrl\tarchiveUrl\tdocumentLanguage\tmetadata",
    ...source.documents.map(document => {
      const { documentId, titleKa, titleEn, title, years, officialUrl, archiveUrl, documentLanguage, ...metadata } = document;
      return line(documentId, titleKa, titleEn, title, years.join(","), officialUrl, archiveUrl, documentLanguage, JSON.stringify(metadata));
    }),
  ];
}

function evidenceOf(sources: readonly ResponseSource[], caveats: readonly Caveat[]): string[] {
  const out: string[] = [];

  if (sources.length > 0) {
    out.push("", "## წყაროები / sources");
    for (const source of sources) {
      out.push(...sourceLines(source));
    }
  }

  if (caveats.length > 0) {
    // Severe first: a model that reads top-down must meet the disqualifying
    // limitation before the housekeeping note.
    const ordered = [...caveats].sort((left, right) =>
      left.severity === right.severity ? left.code.localeCompare(right.code) : left.severity === "severe" ? -1 : 1,
    );
    out.push("", "## შენიშვნები / caveats");
    for (const caveat of ordered) {
      out.push(`${caveat.code} (${caveat.severity}): ${caveat.messageKa} | ${caveat.messageEn}`);
      out.push(`methodology: ${caveat.methodologyRef} | ${caveat.methodologyRefEn}; affects: ${caveat.affects.join(",")}`);
    }
  }

  return out;
}

/**
 * The text twin is a compact table, not a second serialization of the JSON.
 *
 * Spec section 11.1 requires an EQUIVALENT representation - equivalent in
 * content, not in structure - and section 11.3 counts both representations
 * against one 512 KiB ceiling. Re-serializing the envelope would spend half the
 * budget restating what `structuredContent` already carries exactly.
 */
export function renderText(response: FactQueryResponse): string {
  const header = [
    `fiscal.ge ${response.kind} — status ${response.status}`,
    `dataVersion ${response.meta.dataVersion}`,
    `licence ${response.meta.licence} (${response.meta.licenceUrl})`,
  ];

  if (response.kind === "error") {
    return [
      ...header,
      "",
      `error ${response.error.code} (retryable: ${response.error.retryable})`,
      response.error.messageKa,
      response.error.messageEn,
      ...(response.error.validChoices === undefined ? [] : [`valid choices: ${response.error.validChoices.join(", ")}`]),
      ...evidenceOf(response.meta.sources, response.meta.caveats),
    ].join("\n");
  }

  return [...header, "", ...bodyOf(response), ...evidenceOf(response.kind === "sources" ? [] : response.meta.sources, response.meta.caveats)].join("\n");
}

/** Shapes one envelope. Applies no limit - see boundedToolResult. */
export function toolResult(response: FactQueryResponse): ToolResult {
  const content = [{ type: "text" as const, text: renderText(response) }];

  // A failed call has no structured payload to validate against an output
  // schema, so it carries text only.
  return response.kind === "error"
    ? { content, isError: true }
    : // The envelope is a plain JSON object, but a discriminated union is not
      // implicitly assignable to an index-signature type, so state the fact.
      { structuredContent: response as unknown as Record<string, unknown>, content, isError: false };
}

export function tooLargeResponse(
  snapshot: FactQuerySnapshot,
  detail: { returned: number; bytes: number },
): FactQueryResponse {
  const key = detail.bytes > 0 ? "errors.resultTooLargeBytes" : "errors.resultTooLargeCells";
  const values = { cells: detail.returned, ...(detail.bytes > 0 ? { kib: Math.round(detail.bytes / 1024) } : {}), bulkUrl: BULK_DATA_URL };

  return {
    kind: "error",
    status: "error",
    error: {
      code: "result_too_large",
      messageKa: serviceMessage(snapshot, "ka", key, values),
      messageEn: serviceMessage(snapshot, "en", key, values),
      retryable: true,
    },
    meta: buildResponseMeta(snapshot),
  };
}

function cellCount(response: FactQueryResponse): number {
  if (response.kind === "observations") {
    return (response.data as { observations: unknown[] }).observations.length;
  }
  if (response.kind === "comparisons") return (response.data as { comparisons: unknown[] }).comparisons.length;
  if (response.kind === "ranking") return (response.data as RankData).entries.length;
  return 0;
}

/**
 * The shaping every caller should use. Refuses rather than trims: a truncated
 * answer is a wrong answer wearing a correct one's shape, and section 11.3
 * forbids silently dropping sources or warnings to fit.
 */
export function boundedToolResult(snapshot: FactQuerySnapshot, response: FactQueryResponse): ToolResult {
  const returned = cellCount(response);
  // A comparison row is two endpoint cells, which is exactly why 11.3 gives it
  // its own smaller ceiling. Gating comparisons at `cells` allowed 500 rows -
  // a thousand cells, double the declared limit.
  const cap = response.kind === "comparisons" ? LIMITS.comparisonPairs : LIMITS.cells;
  // Cheap pre-check, so an obviously oversized result is never serialized.
  if (returned > cap) return toolResult(tooLargeResponse(snapshot, { returned, bytes: 0 }));

  const result = toolResult(response);
  const bytes = Buffer.byteLength(JSON.stringify(result), "utf8");
  return bytes > LIMITS.resultBytes ? toolResult(tooLargeResponse(snapshot, { returned, bytes })) : result;
}
